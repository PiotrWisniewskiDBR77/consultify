# RN-G1 Platform Foundation — Approved Design

> Status: APPROVED FOR IMPLEMENTATION (Integration Owner review 2026-08-09).
> Zamraża schemat i algorytmy dla implementatora. Odchylenia od tego dokumentu
> wymagają aktualizacji tu + noty w `EXECUTION_LEDGER.md` §7, nie cichej zmiany.
> Cztery otwarte decyzje z draftu już rozstrzygnięte — patrz `EXECUTION_LEDGER.md` §7.

## A) Event envelope + transactional outbox

Trzy tabele: **event log** (źródło prawdy, immutable) / **outbox** (kolejka
dostawy per konsument) / **projection checkpoints** (pozycja replay per read-model).

### A.1 `rvn_platform_events` (append-only)

```sql
CREATE TABLE rvn_platform_events (
  event_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence               BIGINT GENERATED ALWAYS AS IDENTITY,
  schema_version          SMALLINT NOT NULL DEFAULT 1,
  event_type              TEXT NOT NULL,
  aggregate_type           TEXT NOT NULL,
  aggregate_id            TEXT NOT NULL,
  organization_id          TEXT NOT NULL,
  actor_user_id            TEXT NULL,
  actor_effective_role       TEXT NOT NULL,
  command_id              UUID NOT NULL,
  correlation_id            UUID NOT NULL,
  causation_id             UUID NULL,
  occurred_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  policy_version            TEXT NOT NULL,
  before_state             JSONB NULL,
  after_state              JSONB NULL,
  state_hash              TEXT NOT NULL,
  reason                  TEXT NULL,
  evidence_refs             JSONB NOT NULL DEFAULT '[]',
  source                  TEXT NOT NULL,
  idempotency_key            TEXT NOT NULL,
  expected_version           INT NULL,
  resulting_version           INT NOT NULL,
  payload                 JSONB NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX ux_rvn_events_idem ON rvn_platform_events(organization_id, idempotency_key);
CREATE INDEX idx_rvn_events_aggregate ON rvn_platform_events(organization_id, aggregate_type, aggregate_id, sequence);
CREATE INDEX idx_rvn_events_occurred ON rvn_platform_events(organization_id, occurred_at);
CREATE INDEX idx_rvn_events_correlation ON rvn_platform_events(correlation_id);
```

Immutability jest DB-level, nie konwencja: po utworzeniu tabeli, REVOKE UPDATE/DELETE
dla roli aplikacyjnej (nazwę roli ustalić z istniejącym wzorcem uprawnień w repo —
sprawdzić jak inne tabele to robią, jeśli w ogóle; jeśli repo nie ma per-tabela REVOKE
nigdzie indziej, udokumentować to jako nowy wzorzec w komentarzu migracji, nie pomijać).

`aggregate_type` celowo BEZ CHECK constraint — walidacja w apce względem wspólnej
TS listy (patrz C.3). Powód: unikanie losu 3-krotnie zduplikowanego CHECK na
`v8_canonical_object_states` (patrz C.1).

### A.2 `rvn_platform_outbox`

```sql
CREATE TABLE rvn_platform_outbox (
  outbox_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES rvn_platform_events(event_id),
  consumer_group    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','claimed','dispatched','failed','dead_letter')),
  attempts        INT NOT NULL DEFAULT 0,
  max_attempts      INT NOT NULL DEFAULT 8,
  next_attempt_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_by       TEXT NULL,
  claimed_at       TIMESTAMPTZ NULL,
  claim_expires_at   TIMESTAMPTZ NULL,
  dispatched_at     TIMESTAMPTZ NULL,
  last_error       TEXT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, consumer_group)
);

CREATE INDEX idx_rvn_outbox_poll ON rvn_platform_outbox(status, next_attempt_at)
  WHERE status IN ('pending','failed');
```

### A.3 `rvn_platform_projection_checkpoints`

```sql
CREATE TABLE rvn_platform_projection_checkpoints (
  projection_name       TEXT NOT NULL,
  organization_id        TEXT NOT NULL,
  last_applied_sequence     BIGINT NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (projection_name, organization_id)
);
```

### A.4 Wzorzec atomowego zapisu (kopiuj wzorzec z `decisionCollaborationService.ts:809-940`)

```
BEGIN
SELECT ... FROM <agregat> WHERE id=$1 AND organization_id=$2 FOR UPDATE
  -- expected_version != current_version → ROLLBACK, typed 409 STALE_VERSION
UPDATE <agregat> SET ..., row_version = row_version + 1 WHERE id=$1
INSERT INTO rvn_platform_events (...) ON CONFLICT (organization_id, idempotency_key) DO NOTHING
  RETURNING event_id
  -- brak zwróconego wiersza = retry duplikatu → czytaj istniejący wynik, ROLLBACK, zwróć go
INSERT INTO rvn_platform_outbox (event_id, consumer_group, status)
  SELECT $event_id, cg, 'pending' FROM unnest($applicable_consumer_groups) cg
COMMIT
```

`$applicable_consumer_groups` = statyczna mapa `event_type → consumer_group[]` w
kodzie TS (decyzja #4 z EXECUTION_LEDGER §7), nie osobna tabela.

### A.5 Drain/consumer (cron, reużyj istniejącej infrastruktury crona z NotificationOutboxService)

```sql
-- claim
UPDATE rvn_platform_outbox
SET status='claimed', claimed_by=$worker, claimed_at=now(), claim_expires_at=now()+interval '2 minutes'
WHERE outbox_id IN (
  SELECT outbox_id FROM rvn_platform_outbox
  WHERE status IN ('pending','failed') AND next_attempt_at <= now()
  ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED
) RETURNING *;

-- reaper (ten sam cron, kolejny krok)
UPDATE rvn_platform_outbox SET status='pending'
WHERE status='claimed' AND claim_expires_at < now();
```

Sukces → `dispatched`. Porażka → `attempts+=1`, exponential backoff w `next_attempt_at`,
po `max_attempts` → `dead_letter` (wymaga alertu, nie cichy koniec).

At-least-once dostawa — konsument MUSI być idempotentny, wzorem istniejącego
upsert-by-natural-key w `v8_canonical_object_states` (`myWorkRoofService.ts:167-206`).

### A.6 Replay/rebuild

`rvn_platform_events.sequence` = globalny porządek. Rebuild: reset tabeli projekcji
(per-org lub globalnie) → reset checkpoint → batch read `WHERE organization_id=$org
AND sequence > $checkpoint ORDER BY sequence` → apply per `event_type` → awansuj
checkpoint po committed batchu. Outbox NIE jest replayowany generycznie (nie
wysyłamy ponownie 10k historycznych powiadomień przy rebuildzie) — replay dotyczy
wyłącznie wewnętrznych projekcji.

## B) ABAC/visibility resolver

### B.1 Schema

```sql
CREATE TABLE rvn_platform_visibility_policies (
  policy_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       TEXT NOT NULL,
  domain             TEXT NOT NULL,
  policy_version        INT NOT NULL,
  visibility_mode       TEXT NOT NULL CHECK (visibility_mode IN
                          ('OPEN_ORG','SCOPE','MANAGEMENT_CHAIN','PRIVATE','RESTRICTED_ACL')),
  allow_narrowing_only    BOOLEAN NOT NULL DEFAULT true,
  default_scope_type     TEXT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  effective_from        TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to         TIMESTAMPTZ NULL,
  created_by          TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, domain, policy_version),
  EXCLUDE USING gist (
    organization_id WITH =, domain WITH =,
    tstzrange(effective_from, effective_to) WITH &&
  )
);

CREATE TABLE rvn_platform_resource_visibility (
  resource_type   TEXT NOT NULL,
  resource_id    TEXT NOT NULL,
  organization_id  TEXT NOT NULL,
  visibility_mode  TEXT NOT NULL,
  policy_id     UUID NOT NULL REFERENCES rvn_platform_visibility_policies(policy_id),
  scope_type     TEXT NULL,
  scope_id      TEXT NULL,
  owner_user_id   TEXT NULL,
  sensitivity    TEXT NULL,
  PRIMARY KEY (resource_type, resource_id)
);
CREATE INDEX idx_rvn_rv_scope ON rvn_platform_resource_visibility(organization_id, resource_type, scope_type, scope_id);
CREATE INDEX idx_rvn_rv_owner ON rvn_platform_resource_visibility(organization_id, resource_type, owner_user_id);

CREATE TABLE rvn_platform_resource_acl (
  resource_type  TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  grantee_type  TEXT NOT NULL CHECK (grantee_type IN ('user','team','role')),
  grantee_id   TEXT NOT NULL,
  access_level  TEXT NOT NULL CHECK (access_level IN ('view','contribute','approve')),
  granted_by   TEXT NOT NULL,
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (resource_type, resource_id, grantee_type, grantee_id)
);
```

Note: `EXCLUDE USING gist` na `tstzrange` wymaga rozszerzenia `btree_gist` — jeśli
nie jest już włączone w bazie, migracja musi zawierać `CREATE EXTENSION IF NOT
EXISTS btree_gist;` przed tą tabelą.

### B.2 Management-chain closure (materialized, service-layer maintenance — decyzja #1)

```sql
CREATE TABLE rvn_platform_management_chain_closure (
  organization_id    TEXT NOT NULL,
  ancestor_user_id    TEXT NOT NULL,
  descendant_user_id   TEXT NOT NULL,
  depth           INT NOT NULL,
  PRIMARY KEY (organization_id, ancestor_user_id, descendant_user_id)
);
CREATE INDEX idx_rvn_mgmt_descendant ON rvn_platform_management_chain_closure(organization_id, descendant_user_id);
CREATE INDEX idx_rvn_mgmt_ancestor ON rvn_platform_management_chain_closure(organization_id, ancestor_user_id);
```

Maintenance: service-layer, w TEJ SAMEJ transakcji co `UPDATE user_profile_extended
SET manager_id=...`. Rekompozycja closure dla dotkniętego poddrzewa (nie całej
organizacji). **Cycle protection obowiązkowy**: twardy limit kroków (bound =
rozmiar organizacji), odrzucić zapis który nie dochodzi do roota (typed error)
PRZED zapisaniem jakiegokolwiek wiersza closure.

### B.3 Algorytm resolvera

Wejście: `(userId, organizationId, resourceType, resourceId, action)` → `{allow, reason}`.

```
0. Tenant gate: resource.organization_id != user.organization_id → DENY(CROSS_TENANT)
   — PIERWSZY predykat w SQL, zawsze.
1. SELECT z rvn_platform_resource_visibility WHERE (resource_type, resource_id)
   — brak wiersza → DENY(NO_VISIBILITY_RECORD). Fail-closed, nigdy fail-open.
2. RBAC/PBAC short-circuit (reuse effectiveAccessService — NIE wynajdywać):
   superadmin/admin/odpowiednia capability → ALLOW(RBAC_OVERRIDE), CHYBA że
   sensitivity='restricted' AND mode=RESTRICTED_ACL → wymaga break-glass audit event.
3. Rozgałęzienie wg visibility_mode:
   OPEN_ORG          → ALLOW
   PRIVATE           → ALLOW jeśli user_id==owner_user_id, inaczej DENY(PRIVATE_NOT_OWNER)
   SCOPE             → ALLOW jeśli user należy do scope_type/scope_id (istniejące
                        tabele członkostwa: team_members/initiative_contributors),
                        inaczej DENY(OUT_OF_SCOPE)
   MANAGEMENT_CHAIN   → ALLOW jeśli user_id==owner_user_id LUB EXISTS w
                        rvn_platform_management_chain_closure
                        (ancestor_user_id=user_id AND descendant_user_id=owner_user_id),
                        inaczej DENY(NOT_IN_CHAIN)
   RESTRICTED_ACL      → ALLOW jeśli EXISTS w rvn_platform_resource_acl dla
                        user/team/role z access_level>=wymaganym, inaczej DENY(NOT_ON_ACL)
4. Visibility ≠ capability. Resolver odpowiada TYLKO "czy widzisz że istnieje".
   Osobny check (effectiveAccessService + maker-checker submitted_by≠approved_by)
   odpowiada "czy możesz zmutować/zatwierdzić". Nigdy nie łączyć w jeden wynik.
```

### B.4 Wpięcie (query-builder wrapper, NIE middleware)

Reużywalny wrapper `rvnVisibilityScopedQuery(baseQuery, {userId, organizationId,
resourceType, action})` generujący CTE `rvn_visible_resources(resource_type,
resource_id)` (odzwierciedla rozgałęzienie z B.3), który KAŻDE domenowe
repozytorium INNER JOIN-uje PRZED własnymi filtrami (status, daty, tekst).
Domenowe repozytorium nigdy nie rozmawia z tabelą bazową bezpośrednio — konwencja
egzekwowalna code-review/lintem, analogicznie do `check-list-canon.sh`.
COUNT(*), full-text search, CSV export i kontekst Teresy startują z TEJ SAMEJ
wrapowanej query. Teresa: rozszerzenie reguły P08 `no_silent_writes` o równoległą
`no_ungated_reads` — Teresa nigdy nie robi raw query, zawsze przez te same
funkcje repozytorium co UI.

## C) Typed MyWork/Decision references

### C.1 MyWork — rozszerzenie `CanonicalObjectType`

`server/src/types/myWorkRoofPackage.ts:24-33` — dopisać NA KOŃCU tablicy:
`'kpi','roi_case','okr_set','deviation_case'`. Nigdy nie reorderować/usuwać
istniejących wartości (`'task','decision','initiative','milestone','approval',
'ai_proposal','notification','signal'`).

DB: CHECK constraint na `v8_canonical_object_states.object_type` jest
**zduplikowany w 3 miejscach** (`20260323_v8_mywork_roof.sql`,
`20260719_baseline_gap.sql` — schema `public` I `v8`, `migrations-v2/
001_baseline_20260413.sql`). Migracja celuje w `public.` (wzorzec wszystkich
innych tabel znalezionych w audycie), z NOT VALID + VALIDATE (unika pełnego
table-scan locka):

```sql
ALTER TABLE v8_canonical_object_states DROP CONSTRAINT v8_canonical_object_states_object_type_check;
ALTER TABLE v8_canonical_object_states ADD CONSTRAINT v8_canonical_object_states_object_type_check
  CHECK (object_type = ANY (ARRAY['task','decision','initiative','milestone','approval',
    'ai_proposal','notification','signal','kpi','roi_case','okr_set','deviation_case']::text[]))
  NOT VALID;
ALTER TABLE v8_canonical_object_states VALIDATE CONSTRAINT v8_canonical_object_states_object_type_check;
```

**GATE KOMENTARZ W PLIKU MIGRACJI (obowiązkowy)**: `-- PRZED PROMOCJĄ NA DEMO:
zweryfikować przez information_schema który schema (public vs v8) jest realnie
żywy na demo — patrz EXECUTION_LEDGER.md §7 decyzja #3. Ta migracja NIE jest
auto-promowana przez sam fakt istnienia w gałęzi.`

Runtime: zero zmian w istniejących konsumentach (upsert-by-natural-key jest
type-agnostic). Nowe serwisy wołają istniejący `setCanonicalObjectState({objectType:
'kpi', ...})` identycznie jak dzisiejsi callerzy.

### C.2 Decision references — ZERO migracji potrzebnej

`link_graph_edges` (`20260303_link_graph_v3.sql`) już jest w pełni generyczne/
polimorficzne (`source_type TEXT, source_id TEXT, target_type TEXT, target_id
TEXT, relation TEXT`, bez CHECK). Reużyj istniejący endpoint `POST /api/my-work/
link-graph/edges` z `target_type='kpi'|'roi_case'|'okr_set'|'deviation_case'`.
NIE tworzyć nowej tabeli/endpointu (istniejący komentarz w kodzie: "architectural
rule #6: do not invent a new evidence-link table/endpoint").

### C.3 Jedna wspólna lista typów

`aggregate_type` (A.1), `object_type` (C.1), `source_type`/`target_type` (C.2),
`resource_type` (B.1) MUSZĄ czerpać z JEDNEJ wspólnej TS stałej (rozszerzony
`CanonicalObjectTypeValues` jako SSOT), nie z osobnych list per warstwa —
inaczej Platform dodaje CZWARTĄ równoległą taksonomię nazw zasobów, dokładnie
wzorzec, który ten program ma naprawić (5 systemów ROI, 4 tabele KPI).

## D) Kolejność migracji

| # | Plik | Zawartość |
|---|---|---|
| 1 | `<date>_rvn_platform_events_outbox.sql` | A.1 (+REVOKE), A.2, A.3 + indeksy |
| 2 | `<date>_rvn_platform_visibility_core.sql` | B.1 (3 tabele, + `CREATE EXTENSION IF NOT EXISTS btree_gist` jeśli brak) |
| 3 | `<date>_rvn_platform_management_chain.sql` | B.2 (bez triggera — maintenance = service layer) |
| 4 | `<date>_rvn_platform_canonical_object_type_extend.sql` | C.1 ALTER, z gate-komentarzem |

`<date>` = 8-cyfrowa data w formacie `YYYYMMDD`, NIGDY numeracja `9xx`.

Poza zakresem tej implementacji: seed domyślnych policies (rollout script per-org,
osobne zadanie), `link_graph_edges` (zero zmian), dopisanie `'okr'` do
`HandoffTargetModule` w `teresaCopilotCanon.ts` (workstream Teresa, nie Platform).
