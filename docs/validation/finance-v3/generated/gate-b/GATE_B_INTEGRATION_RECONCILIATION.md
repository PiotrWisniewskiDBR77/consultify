# Gate B — rekoncyliacja integracyjna (orkiestrator, po B01–B04)

WP-B01–WP-B04 pisane były równolegle w tym samym worktree. B02 i B03 jawnie
zaznaczyły w swoich ADR-ach, że zakładają kształt WP-B01, którego jeszcze
nie widziały w chwili pisania. Ten dokument jest autorytatywnym scaleniem —
Gate C (WP-C01 realne migracje) implementuje TEN kształt, nie żaden
z trzech ADR-ów osobno.

## 1. Nazewnictwo — B01 jest kanoniczne

B02 i B03 pisały `business_versions`/`id`/`working_revisions` bez prefiksu.
Realny, scommitowany DDL z B01 to:

- `finance_artifacts` (PK `artifact_id`)
- `finance_business_versions` (PK `business_version_id`)
- `finance_working_revisions` (PK `working_revision_id`)
- `finance_artifact_aliases`
- `finance_engine_manifests` (PK `engine_manifest_id`)

Wszystkie odniesienia w B02/B03/przyszłych B05–B07 do `business_versions`/`id`
czytać jako `finance_business_versions`/`business_version_id`. Nie przepisuję
tu treści ADR-ów — to jest mapowanie nazw przy implementacji w Gate C.

## 2. Kolumny brakujące na `finance_business_versions` (wymagane przez B02/B03, nieobecne w DDL B01)

B01 dostarczyło: `business_version_id, artifact_id, organization_id, version_no,
status, freshness, source_working_revision_id, parent_version_id,
superseded_by_version_id, compute_snapshot_id, compute_run_id,
engine_manifest_id, content_semantic_hash, approved_by, approved_at,
approval_note, invalidated_reason, immutable_since, created_by, created_at,
updated_at`.

**Do dodania** (DECYZJA: dodajemy, nie tworzymy osobnej tabeli — jeden wiersz
per wersja pozostaje kanoniczny, zgodnie z duchem B01):

| Kolumna | Typ | Źródło wymagania | Uzasadnienie |
|---|---|---|---|
| `risk_tier` | `TEXT CHECK IN ('LOW','MATERIAL','HIGH_RISK')` | B02 §7 | Maker-checker (DEC-FIN-001) wymaga tego pola przy `submit_for_review`, zamrożonego, nigdy obniżalnego. |
| `submitted_by`, `submitted_at` | `TEXT`, `TIMESTAMPTZ` | B02 §5.1, §9 | Przejście DRAFT→READY_FOR_REVIEW musi być audytowalne bez sięgania wyłącznie do `artifact_lifecycle_events`. |
| `archived_by`, `archived_at` | `TEXT`, `TIMESTAMPTZ` | B02 §9 | Symetria z `approved_by/at`, `invalidated_reason`. |
| `superseded_at` | `TIMESTAMPTZ` | B02 §9 | B01 ma `superseded_by_version_id`, brak znacznika czasu przejścia. |
| `reopen_reason`, `reopened_by`, `reopened_at` | `TEXT`, `TEXT`, `TIMESTAMPTZ` | B02 §6.2 | Reopen tworzy `vN+1` — te pola opisują NOWY wiersz, nie stary (stary dostaje `superseded_at`/`superseded_by_version_id`). |
| `freshness_reason` | `TEXT` | B03 §7 | B01 ma `freshness`, ale nie ma powodu — B03 wymaga priorytetu powodów (`SOURCE_INVALIDATED` > `ASSUMPTION_REGISTRY_CHANGED` > `NEW_SOURCE_VERSION`). |
| `stale_since` | `TIMESTAMPTZ` | B03 §7 | Idempotentny upsert freshness z B03 wymaga tego pola, żeby nie "odświeżać" wieku staleness. |

## 3. Constraint brakujący (B03 §4)

```sql
ALTER TABLE finance_business_versions
  ADD CONSTRAINT uq_finance_bv_id_org UNIQUE (business_version_id, organization_id);
```

Wymagane, żeby `finance_lineage_edges` (B03) mogło mieć złożony FK
`(source_version_id, organization_id) REFERENCES finance_business_versions
(business_version_id, organization_id)` — atomowa gwarancja tenant-safety
przez integralność referencyjną, nie przez CHECK+subquery.

## 4. Nowa tabela `artifact_lifecycle_events` (własność B02, nie B01)

B02 wymaga append-only audit log. To NIE jest w zakresie B01 (który projektował
tożsamość/wersję, nie audyt przejść) — poprawnie zaprojektowane jako osobna
tabela B02, referencująca `finance_business_versions.business_version_id`.
Brak konfliktu, tylko potwierdzenie własności.

## 5. Licznik wersji — pytanie B02 §10.4 ROZWIĄZANE przez istniejący DDL B01

B01 **już** zaimplementowało dwa niezależne liczniki, dokładnie jak
rekomendowało B02: `finance_business_versions.version_no` (`UNIQUE
(artifact_id, version_no)`) i `finance_working_revisions.revision_seq`
(`UNIQUE (artifact_id, revision_seq)`). Nie wymaga dalszej decyzji.

## 6. Otwarte pytania B02/B03 — rozstrzygnięcia orkiestratora (DEC-FIN-012, rutynowe)

| # | Pytanie | Rozstrzygnięcie |
|---|---|---|
| B02-Q1 | Archive `APPROVED` z otwartym draftem-potomkiem | Zablokowane domyślnie (`409 OPEN_DRAFT_EXISTS`) — wymaga jawnego `force=true` z osobnym uprawnieniem. Bezpieczniejszy default. |
| B02-Q2 | Kto domyślnie może `reopen` | Przyjmuję rekomendację B02: `approver`/`finance_admin` only. |
| B02-Q3 | `branch_new_version` z historycznych stanów | Odłożone do P2 (poza Gate B/C core scope). |
| B02-Q5 | Emergency approval — kto włącza | Przyjmuję rekomendację B02: operator platformy, nie `finance_admin` organizacji (SoD). |
| B03-Q3/4 | Miejsce `freshness_state`, nazwa | Rozstrzygnięte w §2 powyżej: na `finance_business_versions`, kolumny `freshness`/`freshness_reason`/`stale_since`. |

## 7. ESKALOWANE — nie rutynowe

**B02-Q4 (próg materialności — konkretna liczba/wzór).** To jest dosłownie
`Decyzja właścicielska #8` z `FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
sekcja 8 — apetyt na ryzyko, nie technikalia. Żeby nie blokować Gate C,
przyjmuję **tymczasowy placeholder**: 5% wartości linii/subtotala LUB
konfigurowalny per-organizacja próg (cokolwiek niższe), jawnie oznaczony
`PROVISIONAL_PENDING_OWNER_DECISION` w kodzie i migracji. Nie wchodzi do
żadnego GO-gate jako finalny bez potwierdzenia właścicielskiego.
