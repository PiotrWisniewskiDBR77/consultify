# R1 — macierz 18 × 10

| Pełna nazwa | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | RED/GREEN | mediana RED/GREEN ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Agent Hub rate-limit routing keeps the database GET /agent-manifests outside the generative AI bucket | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 0/10 | n/a/0.1 |
| Agent Hub rate-limit routing keeps the database GET /agent-manifests/manifest-1 outside the generative AI bucket | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 0/10 | n/a/0.1 |
| Agent Hub rate-limit routing keeps the database GET /agent-plan outside the generative AI bucket | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 0/10 | n/a/1.4 |
| Agent Hub rate-limit routing keeps the database GET /agent-plan/plan-1 outside the generative AI bucket | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 0/10 | n/a/0.1 |
| Agent Hub rate-limit routing keeps the database GET /agent-plan/processes outside the generative AI bucket | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 0/10 | n/a/0.1 |
| Agent Hub rate-limit routing retains the generative limiter for GET /chat | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 0/10 | n/a/0.1 |
| Agent Hub rate-limit routing retains the generative limiter for PATCH /agent-plan/plan-1/steps | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 0/10 | n/a/0.1 |
| Agent Hub rate-limit routing retains the generative limiter for POST /agent-plan | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 0/10 | n/a/0.1 |
| Agent Hub rate-limit routing retains the generative limiter for POST /chat | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 0/10 | n/a/0.1 |
| Day 274 — inicjatywa z Oceny dociera do listy runtime-v1 POST z Oceny jest widoczny przez GET runtime-v1 | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 0/10 | n/a/198.1 |
| Day 274 — inicjatywa z Oceny dociera do listy runtime-v1 obcy tenant nie widzi inicjatyw właściciela | RED | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 1/9 | 15.4/44.7 |
| Day 275 — panel jakości czyta dokładne answers.drd przez ApiGateway i RealPG zwraca dokładny stan obszaru oraz scoring z tej samej tenantowej bazy | RED | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 1/9 | 76.0/147.8 |
| Day 276 deck autosave persistence through ApiGateway and real PostgreSQL autosave changes deck_json, advances version and snapshots the prior version | RED | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 1/9 | 64.9/69.9 |
| Day 276 deck autosave persistence through ApiGateway and real PostgreSQL returns 409 for a stale X-Deck-Version and preserves the saved deck | RED | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 1/9 | 16.6/25.3 |
| Day 276 workbook cell persistence through ApiGateway and real PostgreSQL foreign tenant cannot see or mutate the workbook | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 0/10 | n/a/23.6 |
| Day 276 workbook cell persistence through ApiGateway and real PostgreSQL owner persists a setCell value, advances version and creates a revision row | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 0/10 | n/a/77.4 |
| Day 277 decision enhancements through ApiGateway and PostgreSQL foreign tenant cannot see or overwrite the decision enhancements | RED | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 1/9 | 15.9/35.4 |
| Day 277 decision enhancements through ApiGateway and PostgreSQL owner writes all five fields, SQL sees them, and detail reads them back | RED | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | GREEN | 1/9 | 78.0/216.5 |

## Rozstrzygnięcie

- Rdzeń 10/10 RED: brak.
- Pierścień mieszany: Day 274 — inicjatywa z Oceny dociera do listy runtime-v1 obcy tenant nie widzi inicjatyw właściciela; Day 275 — panel jakości czyta dokładne answers.drd przez ApiGateway i RealPG zwraca dokładny stan obszaru oraz scoring z tej samej tenantowej bazy; Day 276 deck autosave persistence through ApiGateway and real PostgreSQL autosave changes deck_json, advances version and snapshots the prior version; Day 276 deck autosave persistence through ApiGateway and real PostgreSQL returns 409 for a stale X-Deck-Version and preserves the saved deck; Day 277 decision enhancements through ApiGateway and PostgreSQL foreign tenant cannot see or overwrite the decision enhancements; Day 277 decision enhancements through ApiGateway and PostgreSQL owner writes all five fields, SQL sees them, and detail reads them back.
- Teza podziału 4 + 4 została obalona: przypadki day276-workbook były GREEN 10/10, a day277 oraz trzy pozostałe przypadki rotujące były RED tylko w przebiegu 01 i GREEN w 02–10.
- H3 została obalona: domniemany rdzeń day277 przeszedł zielono bez zmiany kodu w 9/10 przebiegów; nie jest stałym defektem w tym pomiarze.
- H4 potwierdzona dla wszystkich przypadków mieszanych: pojedynczy RED był szybszy niż mediana GREEN (patrz ostatnia kolumna).
