# QD21 KROK 0 — backfill 3 kanonicznych kart bazowych (opcja B z QB0e), numer `20262306`

Wpis 234 (zakres) + Wpis 237 (numer `20262306`, kolejność: QD17 → QD21).
Wszystkie pomiary NA KOPII, żywy staging nietknięty: dump `~/Developer/kopie/staging-auto-20260919T0330.dump`
→ kontener `qoder-d-pg-9` (pgvector:pg18, `127.0.0.1:6638`), baza `consultify_qd21`, 1912 tabel, RESTORE_RC=0.
Pomiary: `forensics.sql` ([1]–[12]), `forensics-2.sql` ([13]–[20]), partie [21]–[30] — całość w `forensics-output.log` (RC=0; 2 ERRORy to zarzucone zapytania [23]/[26] o nieistniejącą kolumnę `organizations.slug`, poprawione jako [23b]/[23c]/[26b]).

## Werdykt KROK 0: premisa WPISU prawdziwa, backfill = dokładnie 3 wiersze + 3 linki dla 1 organizacji

1. **`org_count = 13`; dokładnie JEDNA org nie ma żadnej z 3 kanonicznych kart** ([1], [25]: rozkład `0 kart → 1 org`, `3 karty → 12 org`).
   To `ateliertoys-demo` / „Atelier Toys", `status=active`, `is_active=1`, `organization_type=DEMO`,
   `created_at 2026-09-18 01:37:32.293952` ([23c]) — czyli org powstała **18.09 01:37**, PO zastosowaniu `20262271` (16.09 19:59),
   więc nigdy nie dostała kart. Zbiór do backfillu ([2]) = 3 pary (rodzina, źródło): DOC-BASE/`document_template`,
   DECK-BASE/`presentation_template`, SHEET-BASE/`sheet_template`, `links_teraz = 0` dla każdej.
2. **Luka 36→39 to dokładnie ta jedna org** ([3]): `org_count=13`, oczekiwane `13*3=39`, `snapshot_count=36`, `link_count=36`.
   Backfill 3+3 domyka lukę bez ponownego uruchamiania `20262271`.
3. **Zero kolizji identyfikatorów** ([8], [18]): deterministyczne ID z wzorca `20262271` dla tej org
   (`template-1-docbase-dbe36314c896d1721f89ba349dec6bdd`, `template-1-deckbase-9165a795aa6cee069903513512316ce2`,
   `template-1-sheetbase-6dbf21b25f2e19a22d352e558a6cd59c` + 3 `template-1-link-…`) → `kolizja_artifact=0`, `kolizja_link=0`,
   a wierszy `template-1-%` dla `ateliertoys-demo` jest **0**.
4. **To nie są duplikaty i nic nie kasujemy**: 3 kanoniczne źródła istnieją ([11] = 1/1/1), a scoped readback (kształt opcji A)
   daje dziś **0 grup z duplikatem** ([19]); niescopedowany readback `20262271:502-511` daje **4 grupy** ([20]) — potwierdzenie
   QB0e. `20262306` musi asertować wersję SCOPED i **nie** wznawiać `20262271`.

## Ustalenia, które zmieniają kształt migracji (plik:linia / pomiar)

- **`public` jest jedyną żywą tabelą — kwalifikuj jawnie.** Istnieją DWA obiekty o nazwie `v8_output_artifacts`:
  `public.v8_output_artifacts` (`relkind=r`, **1031 wierszy**) i `v8.v8_output_artifacts` (`relkind=r`, **0 wierszy**,
  stary zestaw kolumn: bez `artifact_family`/`title_snapshot`/`canonical_home`) — [13], [14], [21].
  `v8.v8_artifact_origin_links` **nie istnieje** ([13] zwraca 3 wiersze, nie 4). `20262271` pisał do `public`
  ([22]: marker `migration:20262271_template_base_family` → public 29, v8 0). `search_path = "$user", public` ([15]).
  → `20262306` pisze `public.v8_output_artifacts` / `public.v8_artifact_origin_links` z jawną kwalifikacją.
- **`ON CONFLICT DO NOTHING` bez wskazania celu (bare).** `v8_artifact_origin_links` ma DWA cele unikatowe:
  PK `link_id` oraz `idx_v81_origin_unique (organization_id, origin_runtime, origin_record_id)` ([7]);
  `v8_output_artifacts` ma tylko PK `artifact_id`. Wskazanie jednego celu zostawiłoby drugi jako żywy wyjątek —
  bare `DO NOTHING` jest jedyną formą, która nigdy nie rzuca. (`20262271` używał `DO UPDATE`, QD21 ma użyć `DO NOTHING` — Wpis 234.)
- **CHECK-i do spełnienia** ([7]): `output_type ∈ {report,presentation,sheet}`,
  `delivery_state ∈ {draft,generated,editing,in_review,ready,shared,archived}`,
  `artifact_family ∈ {document,presentation,sheet,template}`,
  `visibility_scope ∈ {private,project,organization,review_shared,demo}`,
  `origin_runtime ∈ {…,document_template,presentation_template,sheet_template,…}`.
- **NOT NULL bez domyślnej** ([28]): artefakt → `artifact_id, organization_id, output_type, created_by`;
  link → `link_id, artifact_id, organization_id, origin_runtime, origin_record_id`. Reszta ma domyślne.
- **`created_at`/`last_transition_at` są TEXT (`default now()`)** w obu tabelach ([28]) i **nie ma ich w etapie 1 `20262305`**
  (`grep 'v8_output_artifacts|v8_artifact_origin_links' server/migrations/20262305_created_at_timestamptz_etap1.sql` = 0 trafień),
  więc po etapie 1 typ nadal TEXT → wstawiamy `CURRENT_TIMESTAMP::text` dokładnie jak `20262271`.
- **Znacznik `.down.sql`**: istniejące karty bazowe mają `created_by` = `migration:20262271_template_base_family` (29)
  lub `system` (7) ([9]); w całej rodzinie bazowej dodatkowo `system` 312, UUID użytkownika 6, `20262272` 4 ([24]).
  → rollback kasuje WYŁĄCZNIE wiersze z własnym znacznikiem `migration:20262306_…`, nigdy po rodzinie.
- **Asercja „per org dokładnie 3 kanoniczne" musi liczyć LINKI/źródła, nie `is_draft=0`.**
  Mierzone per `org_id` ([29]): `a3e05d4a-…` (DBR77) ma `canonical_links=3` ([1]), ale `deck=0` przy `is_draft=0`
  (jego karta DECK-BASE `09b7e011-c7d5-438d-97ee-85244a4d6fe9` jest draftem, [12]). Asercja po `is_draft=0`
  wywróciłaby się na org, której nic nie brakuje.
- **Org nie ma znacznika „skasowana"**: `organizations` ma `status`/`is_active` ([23b]); populacja = 5 `expired` TRIAL,
  4 `active` TRIAL, 3 `active` PAID, 1 `active` DEMO ([16]). `20262271:326,391` bierze `FROM organizations o CROSS JOIN bases b`
  **bez filtra**, a readback `org_count = count(*) FROM organizations` (`:432`) → `20262306` też bez filtra (inaczej
  `snapshot_count = org_count*3` nigdy się nie domknie). `ateliertoys-demo` ma 18 użytkowników (ADMIN/MANAGER/USER, [26b]),
  ale FK z `created_by`/`users.organization_id` nie ma ([27]: 0 ograniczeń obcych w obu tabelach) → `created_by` = marker migracji jest bezpieczny.
- **Artefakty, które już ma ta org, są inne** ([17]): `ateliertoys-demo--output-artifact--forward-2015-board-readout`
  (family `executive-board-readout`) i `…-forward-2015-roi-report` (family `value-realization-report`) — seed demo, nie karty bazowe.

## BAZA niezmienników PRZED (do asercji PO i do testu RealPG)

Odcisk globalny ([30]): `arty=1031`, `linki=956`, `md5(zbioru artifact_id)=93ab6abbff7818896ecdbdced2e1bad0`.
Po UP: `arty=1034`, `linki=959`, md5 zmieniony o 3 nowe ID; po DOWN: powrót do 1031/956 i md5 PRZED.

Per `org_id` — aktywne (`is_draft=0`) karty bazowe; **kolumny `doc/deck/sheet/base_razem/wszystkie_arty` mają się NIE zmienić
dla 12 istniejących org**, a dla `ateliertoys-demo` przejść `0/0/0/0/2` → `1/1/1/3/5` ([29]):

| org_id | doc | deck | sheet | base_razem | wszystkie_arty |
|---|---|---|---|---|---|
| 3935603f-e81c-4fc3-a154-623394e7cc32 | 21 | 1 | 1 | 48 | 50 |
| 3af18124-275e-484c-8ca1-b512915423c9 | 21 | 1 | 1 | 91 | 94 |
| 468b234c-66c4-54e1-b626-5e0fb3a92f6a | 21 | 1 | 1 | 97 | 129 |
| 8bed87c6-a77e-4d7b-a2b7-bffedfb89c02 | 1 | 1 | 1 | 3 | 3 |
| 9151ee70-0141-43fd-9614-8ea609a7e5aa | 1 | 1 | 1 | 3 | 3 |
| a3e05d4a-5397-419d-b486-8e44366c0063 | 21 | 0 | 1 | 91 | 708 |
| a6b81efe-98b8-426d-bac6-03340e1ea4f6 | 1 | 1 | 1 | 3 | 3 |
| **ateliertoys-demo** | **0** | **0** | **0** | **0** | **2** |
| b8dbb6e9-e855-4245-9748-21e5186390d2 | 1 | 1 | 1 | 3 | 3 |
| be953b47-1dba-469c-98cb-414806f36276 | 1 | 1 | 1 | 3 | 3 |
| c56e8bd5-3295-4366-b150-72e978fb8f18 | 1 | 1 | 1 | 3 | 3 |
| dbr77 | 1 | 1 | 1 | 3 | 3 |
| system | 1 | 1 | 1 | 3 | 3 |

(Uwaga: `[10]` w logu grupuje po `o.name`, więc 3 orgi „TT22TT" zlały się w jeden wiersz `23/3/3`, a `wszystkie_base=1`
dla org bez kart to artefakt `LEFT JOIN` — tabela powyżej jest mierzona po `org_id` i to ona jest bazą.)

## Co dalej (po QD17, zgodnie z kolejnością Wpisu 237)

Gałąź od aktualnego tipa linii, pliki `server/migrations/20262306_*.sql` + `.down.sql`; preflight na tej samej kopii
z asercją `pending` (zmierzę i podam DOKŁADNĄ listę — na kopii z bieżącego tipa to `{20262304, 20262306}`, bo `20262305`
wchodzi dopiero w okno PO wdrożeniu 32), UP→DOWN→UP, `pg_dump -s` diff = 0 obiektów (migracja czysto DML),
test RealPG (org bez kart → 3 po UP; org z 21 DOC-BASE → nadal 21, md5 jej wierszy bez zmian), mutacje RED.
Pliku migracji nie tworzę przed QD17.
