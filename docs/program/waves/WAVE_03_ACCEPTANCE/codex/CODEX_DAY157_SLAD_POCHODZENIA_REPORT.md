# CODEX DAY157 — ślad pochodzenia i cofanie

## Stan wejściowy

Dokument: `WYDANY`. Marker: `43322a8b31`. Gałąź: `codex/day157-slad-pochodzenia-20260830`.

```text
$ git merge-base --is-ancestor 43322a8b31 HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short
[brak wyjścia]
$ git branch --show-current
codex/day157-slad-pochodzenia-20260830
$ ls -la node_modules
lrwxr-xr-x ... node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
/dev/disk3s1s1  1.8Ti  12Gi  23Gi  34% ... /
$ lsof -nP -iTCP:6044 -sTCP:LISTEN
[brak wyjścia]
$ lsof -nP -iTCP:4982 -sTCP:LISTEN
[brak wyjścia]
$ lsof -nP -iTCP:4983 -sTCP:LISTEN
[brak wyjścia]
```

Komendy T1–T4 wykonano dosłownie. T1 znalazła 10 pierwszych pisarzy `tasks`; T2 zwróciła `0`; T3 zwróciła `5` route'ów i zero trafień undo; T4 zwróciła m.in. `results.routes.ts`, `interview-insights.routes.ts`, `teresa.routes.ts`. Pełne wyjście: `day157-input-and-email-preflight.txt`.

Kontener `cx-day157-pg` uruchomiono jako `pgvector/pgvector:pg16` wyłącznie na `127.0.0.1:6044`. Pierwszy przebieg zastosował pełny łańcuch migracji i zakończył się `Postgres migrations complete`; drugi: `Applying migrations: 0`, `Postgres migrations complete`.

## Korekty wobec instrukcji

- §0.1-BIS rozstrzyga konflikt Z34a z końcowym „Nie pushujesz”: nie wykonano push.
- §0.1-BIS rozstrzyga martwe odwołanie Z24 do nieistniejącego §0.4a: pominięto je.
- §0.2c(B) mówi „Dla testów serwerowych dodajesz `--config server/vitest.config.ts`”, lecz §0.1-BIS stwierdza, że ten config przypina SQLite i nakazuje config poza repo. Zastosowano bezpieczniejsze, późniejsze §0.1-BIS: `/private/tmp/cx-day157-slad-pochodzenia-scratch/vitest.day157.config.ts`, uruchomiony z `server/`.
- Teza T2 mówi o „co najmniej dwóch realnych ścieżkach”. Pomiar kodu potwierdza brak pól w obu INSERT-ach, ale ten dyżur nie wykonał ich pełną ścieżką HTTP, więc ich osiągalność pozostaje `NOT_PROVEN`, nie „działa”.
- Znany fakt `tasks.source` bez pisarza nie jest odkryciem dyżuru; pomiar tylko go potwierdził.

## R1 — kolumny i realny rozkład

| Obiekt | Kolumna | Schemat PG | Pisarz kodu | Rozkład przed testem |
|---|---|---|---|---|
| tasks | `source` | TAK, default `manual` | NIE; brak jawnego pisarza poza migracją/backfillem | 0 wierszy |
| tasks | `source_type/source_id` | TAK/TAK | TAK; m.in. `TaskService.ts:153`, caller `agentApprovedMaterializationService.ts:235-237` zapisuje `myw_agent_proposal` i `planId:version:hash` | 0 wierszy |
| decisions | `source_type/source_id` | TAK/TAK | TAK; `decisionService.ts:250`, caller `agentApprovedMaterializationService.ts:241-244` | 0 wierszy |
| notebook_pages | `materialization_provenance` | TAK (`jsonb`) | TAK; `notebookService.ts:289`, caller `agentApprovedMaterializationService.ts:248-250`; równolegle zapisuje `source_type/source_id` | 0 wierszy |

Wszystkie rozkłady po pełnych migracjach zwróciły literalnie `(0 rows)`. Schematy, indeksy i SELECT-y: `day157-r1-r2-db-static.txt`.

Werdykt planu „nie ma śladu pochodzenia”: **częściowo nieaktualny**. Ślad jest wiarygodnie zapisywany przez approved-materialization dla trzech typów, ale nie jest uniwersalny; `tasks.source` jest martwe, a inne ścieżki AI zapisują inne znaczenia lub nic.

## R2 — cofanie sześciu powierzchni

| Powierzchnia | Undo | Dowód |
|---|---:|---|
| decki | TAK | POST `/decks/:deckId/agent-history/:operationId/revert`, `presentations.routes.ts:6838`; POST `/decks/:deckId/agent-history/bulk-revert`, `:7099` |
| Teresa/XLSX | TAK | POST `/proposal/:id/undo`, `v8/teresa.routes.ts:293` |
| schema-proposals | TAK | POST `/schema/proposals/:proposalId/undo`, `table-platform.routes.ts:1861` |
| `myw_agent_materialization_*` | NIE | dokładnie 5 route'ów: GET source, GET proposals, POST proposals, POST decision, POST materialize; zero DELETE/undo/revert/rollback |
| chat-actions / `TaskExecutor.execute` | NIE | `taskExecutor.ts:69` tylko INSERT; brak mechanizmu undo powiązanego z tym zapisem |
| approve-action / `_executeCreateTask` | NIE | `aiActionExecutor.ts:1101` tylko INSERT; T2 grep = 0 pól provenance |

Baza potwierdza guardy: `trg_myw_agent_proposal_guard` (`myw_agent_proposal_guard`), `trg_myw_agent_approval_append_only` (`myw_agent_append_only_guard`) i `trg_myw_agent_receipt_append_only` (`myw_agent_receipt_guard`) blokują UPDATE/DELETE zgodnie z migracją `20261001...:120-164`. To chroni dziennik, ale nie daje cofnięcia obiektów docelowych.

## R3 — projekt i dowód sandboxowy

Jeden predykat operacyjny jest możliwy jako jawny UNION trzech gałęzi, nie jako identyczny warunek kolumnowy:

```sql
SELECT 'task', id FROM tasks WHERE organization_id=$1 AND source_type='myw_agent_proposal'
UNION ALL SELECT 'decision', id FROM decisions WHERE organization_id=$1 AND source_type='myw_agent_proposal'
UNION ALL SELECT 'notebook', id FROM notebook_pages WHERE organization_id=$1
  AND source_type='myw_agent_proposal' AND materialization_provenance IS NOT NULL;
```

To jest minimalny fail-closed predykat istniejącego schematu. Nie parsuje `source_id` po dwukropkach. Projekt docelowy powinien użyć osobnego, niezmiennego identyfikatora operacji/proposal jako klucza obcego na każdym obiekcie i rejestru cofnięcia; obecny string `planId:version:hash` nie jest bezpiecznym kluczem relacyjnym.

Test `day157.provenance-revert.pg.test.ts` wykonał realnie: proposal → oddzielny approver → materialization przez `agentApprovedMaterializationService` dla task/decision/notebook; dodał po jednym rekordzie ręcznym; policzył predykat; usunął wyłącznie trafienia w sandboxie; sprawdził pozostawienie ręcznych.

```text
DB_IDENTITY role=app identity=127.0.0.1:6044/cx157 ...
DAY157_COUNTS count_before=3 count_reverted=3 count_after=0
Test Files 1 passed (1)
Tests 1 passed (1)
```

R3 jest projektem/prototypem, nie wdrożeniem i nie endpointem produktu.

## R4 — powierzchnie AI i pochodzenie

| Plik:linia | Obiekt | Pochodzenie | Wartość / wynik |
|---|---|---|---|
| `ai/actionExecutors/taskExecutor.ts:69` | task | NIE | dynamiczny INSERT bez source |
| `services/aiActionExecutor.ts:1101` | task | NIE | approve-action INSERT bez source |
| `services/aiActionExecutor.ts:1213` | decision | NIE | INSERT bez source |
| `services/aiOrchestrator.ts` | — | brak pisarza tych 3 tabel | brak trafień INSERT/create w pomiarze |
| `services/notebookAIEnrichService.ts` | — | brak twórcy notebook page | wzbogacanie, brak INSERT/createNotebookNote |
| `services/canvasMaterialize.ts:578` | decision | TAK | caller przekazuje `sourceType='work_canvas'`, `sourceId=sourceDraftId` (`:561-562`) |
| `services/canvasMaterialize.ts:601` | task | TAK | ten sam kontrakt `work_canvas` |
| `services/myWork/agentApprovedMaterializationService.ts:235` | task | TAK | `source_type='myw_agent_proposal'`, `source_id=planId:version:hash` |
| `services/myWork/agentApprovedMaterializationService.ts:241` | decision | TAK | jak wyżej |
| `services/myWork/agentApprovedMaterializationService.ts:248` | notebook | TAK | `source_type/source_id` plus `materialization_provenance` |
| `controllers/DecisionController.ts:2274` | task z decyzji | TAK z fallbackiem NIE | `source_type='decision'`, `source_id=decision id`; fallback `:2291` bez source |
| `routes/v8/interview-insights.routes.ts:1002-1023` | decision | TAK, best-effort | follow-up UPDATE `interview_insight`, findingId |
| `routes/v8/interview-insights.routes.ts:1041-1065` | task | TAK, best-effort | follow-up UPDATE `interview_insight`, findingId |
| `routes/v8/results.routes.ts:2137` | task | TAK | INSERT zawiera `source_type/source_id` |
| `routes/v8/results.routes.ts:3565` | task | TAK | wymagany `sourceType` signal/report/reconciliation i `sourceRef` |

Pełny szeroki inwentarz syntaktycznych pisarzy (w tym powierzchnie nie-AI, skrypty i serwisy kanoniczne) ma 309 linii w `day157-r4-writers.txt`. Nie utożsamiam samego grepu z osiągalnością runtime.

## Testy i pułapki (a)–(e)

W-A: nie ma zastosowania — zero napraw produktu, więc nie wykonywano mutacji produkcyjnej red→green. R3 jest niezależnym prototypem danych na sandboxie.

W-C: nie ma porównywalnego testu na markerze, bo licencjonowany plik dowodowy powstał w tym dyżurze; nie przepisuję liczby z innego pakietu. Dwa identyczne przebiegi po dodaniu testu (verbose i JSON) mają ten sam pełny `fullName` i oba: 1/1 PASS.

Pułapki:

- (a) `ENABLE_V8_GLOBAL=true`; test nie idzie przez V8 route, ale zmienna była jawna.
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; strażnik nie leży na wywołanej ścieżce serwisowej.
- (c) zewnętrzny config nie ustawia `DB_TYPE`; `expect(process.env.DB_TYPE).toBe('postgres')` i `DB_IDENTITY ...127.0.0.1:6044/cx157` dowodzą PG.
- (d) `ENABLE_TEST_AUTH_BYPASS=false`; test serwisowy nie jest dowodem HTTP/auth.
- (e) test sprawdza dane z każdego pisarza osobno; nie używa samej obecności kolumny jako dowodu.

Reporter JSON zawiera pełną nazwę: `DAY157 provenance predicate and sandbox revert — real PG materializes three traced rows and reverts exactly the predicate match`, status `passed`, bez skip.

## Z30 — brak wysyłki

`env` zwrócił `BRAK ZMIENNYCH POCZTY`; `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy; grep Gateway dla drenów zwrócił 0 trafień.

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

## Artefakty i SHA-256

- `day157-input-and-email-preflight.txt` — `ececa9eedee5babb0706e644a700dd562878fc0257ba021516f7a1e5662eadae`
- `day157-migrate-1.log` — `ed11e430a5f6b487d4ef57ba943dcc6d3663bbe82d304577a4f37cc94c8b7309`
- `day157-migrate-2.log` — `59f52c2fba8bcccbdee75f1e5d6f21ed2f12a7410957de854b90c78f6b9827d3`
- `day157-r1-r2-db-static.txt` — `63f49d9d6687db75b7ef82d0b7127df14639b7bb465b19c8b28c08b98d6ba04f`
- `day157-r3-vitest-verbose.log` — `a5ec12c7a599b70718592ad870a506a174acdcd5f84f58847d0aa1f631deeafe`
- `day157-r3-vitest.json` — `6ed76e1acec1e25cf80fea41c8e8325a4b8c2fab0dba74232f5d2e679313f38d`
- `day157-r4-writers.txt` — `bc98c4047598e371d1a37f6d60eab6396ffd9b0a03e29093cc27d9ffaf89a213`

Wszystkie leżą w `/private/tmp/cx-day157-slad-pochodzenia-artefakty/` i nie wchodzą do repo.

## W-D — granica rozłączności

```text
$ git diff --name-only 43322a8b31..HEAD
server/src/routes/__tests__/day157.provenance-revert.pg.test.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY157_SLAD_POCHODZENIA_REPORT.md
```

Oba pliki są w tabeli licencji. Zero zmian produktu, migracji, `src/` frontu i chronionych configów.

## TWIERDZENIA NIEZWERYFIKOWANE

- `NOT_PROVEN`: pełna osiągalność sześciu powierzchni przez realny `ApiGateway`, podpisany JWT i HTTP; dyżur mierzył kod, DB i serwis R3, nie uruchamiał runtime 4982/4983.
- `NOT_PROVEN`: czy wszystkie 309 syntaktycznych trafień szerokiego inwentarza są aktywnymi ścieżkami AI; tabela R4 rozstrzyga wymagane imienne powierzchnie, nie każdą ścieżkę biznesową repo.
- `NOT_PROVEN`: atomowy, produkcyjny rollback wraz ze skutkami zależnymi/outboxem; R3 usuwa tylko trzy obiekty docelowe w efemerycznym sandboxie.
- `NOT_PROVEN`: semantyka `source_type/source_id` poza opisanymi pisarzami; znane są co najmniej trzy różne znaczenia i nie wolno ich scalać bez decyzji schematowej.
- `EVIDENCE_MISSING`: akcept właściciela dla docelowego klucza operacji i polityki soft-delete versus hard-delete.

Stan końcowy: **POMIAR R1/R2/R4 WYKONANY; R3 PROTOTYP SANDBOXOWY PASS; ZERO ZMIAN PRODUKTU; NIE PUSHOWANO.**
