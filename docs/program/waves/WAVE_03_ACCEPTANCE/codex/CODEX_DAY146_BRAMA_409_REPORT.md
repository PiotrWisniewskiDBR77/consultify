# CODEX DAY 146 — rozstrzygnięcie bramy zapisu 409

## Stan wejściowy

Dokument był `WYDANY`. Zastosowałem `§0.1-BIS`; nie wykonałem fetch, worktree add ani push.

```text
$ git merge-base --is-ancestor c685ea65af HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short
[brak wyjścia]
$ git branch --show-current
codex/day146-brama-zapisu-20260830
$ ls -la node_modules
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 10:22 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
Filesystem        Size    Used   Avail Capacity iused ifree %iused Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    20Gi    37%    459k  214M    0% /
$ lsof -nP -iTCP:6032 -sTCP:LISTEN
[brak wyjścia]
$ lsof -nP -iTCP:4958 -sTCP:LISTEN
[brak wyjścia]
$ lsof -nP -iTCP:4959 -sTCP:LISTEN
[brak wyjścia]
$ git rev-parse HEAD
c685ea65af27c8346ade55ab0a648d7fa78e7263
$ git status --short | head -3
[brak wyjścia]
```

Obowiązkowe T1–T4, dosłownie:

```text
### T1
server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:3:export const EXECUTION_SPINE_LEGACY_READ_ONLY_CODE = 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED' as const;
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2201: legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2210: legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2219: legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2228: legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2237: legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
### T2
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2201: legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2210: legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2219: legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2228: legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2237: legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
### T3
350
### T4 RAID
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:600: raid: z.array(z.record(z.string(), z.unknown())),
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2212: raidMitigation: {
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2215: 'POST /api/initiatives/runtime-v1/initiatives/:initiativeId/raid-mitigations/:raidItemId',
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:4820: '/initiatives/:initiativeId/raid-mitigations/:raidItemId',
### T4 COMMENT
[brak wyjścia]
```

## KOREKTY wobec instrukcji

1. `§0.1/T2` mówi „KTÓRE TRASY W NIĄ UDERZAJĄ”, ale literalny grep zwraca wyłącznie pięć deklaracji `legacyDenialCode` w routerze kanonicznym. Montowania są wykrywane po symbolach middleware: `tasks.routes.ts:67`, `initiatives.routes.ts:160`, `v8/index.ts:107`. T2 nie jest inwentarzem tras.
2. `§0.2d(5)` mówi, że env z linii komend może nadpisać `test.env.DB_TYPE='sqlite'`; `§0.1-BIS` rozstrzyga odwrotnie. Zastosowałem bezpieczniejsze, późniejsze `§0.1-BIS`: chronionego configu nie zmieniłem; nie uruchamiałem pakietu DB na configu przypinającym SQLite.
3. `Z13` wskazuje nazwę `CODEX_DAY146_BRAMA_ZAPISU_REPORT.md`, a tabela licencji i `§R.2` wskazują `CODEX_DAY146_BRAMA_409_REPORT.md`. Wybrałem późniejszą, imienną ścieżkę z tabeli licencji; utworzyłem dokładnie jeden dokument.
4. W tekście występuje martwe `§0.4/§0.4a`; zgodnie z `§0.1-BIS` pominąłem ten odsyłacz. Pomiar zakresu wykonałem własnym parserem AST, bez przepisywania liczby.
5. Zdublowane nagłówki `#1` i wiersze `B8` nie zmieniają zakresu; zachowałem jedną sekcję korekt i jedną niepustą sekcję twierdzeń niezweryfikowanych.

## R1 — pełny inwentarz

Metoda liczenia: jedna powierzchnia = unikalna para metoda HTTP + pełna ścieżka po uwzględnieniu prefiksu montowania. Nie liczę ekranów, plików ani literalnych wystąpień kodu. Wynik: **73 trasy** (23 Tasks + 30 Initiatives + 20 V8).

### Tasks — globalna brama, 23/23 mutacji

`router.use(requireCanonicalExecutionWriter)` w `tasks.routes.ts:67` odrzuca każdą metodę inną niż GET/HEAD/OPTIONS:

| Metoda | Ścieżka |
|---|---|
| POST | `/api/tasks/` |
| POST | `/api/tasks/:id/sections/:sectionKey/generate` |
| POST | `/api/tasks/custom-fields` |
| PUT | `/api/tasks/custom-fields/:fieldId` |
| DELETE | `/api/tasks/custom-fields/:fieldId` |
| POST | `/api/tasks/baseline-snapshots` |
| POST | `/api/tasks/time-entries` |
| POST | `/api/tasks/allocations` |
| PUT | `/api/tasks/:id` |
| DELETE | `/api/tasks/:id` |
| POST | `/api/tasks/:taskId/comments` |
| DELETE | `/api/tasks/:taskId/comments/:commentId` |
| POST | `/api/tasks/:id/assign` |
| POST | `/api/tasks/:id/reassign` |
| POST | `/api/tasks/:id/unassign` |
| POST | `/api/tasks/:id/escalate` |
| POST | `/api/tasks/:taskId/escalations/:escalationId/resolve` |
| POST | `/api/tasks/:id/block` |
| POST | `/api/tasks/:id/unblock` |
| POST | `/api/tasks/:id/move` |
| POST | `/api/tasks/:id/dependencies` |
| DELETE | `/api/tasks/:id/dependencies/:depId` |
| POST | `/api/tasks/:id/milestone` |

### Initiatives — brama selektywna, 30 tras

`initiatives.routes.ts:160` używa czterech wzorców z `executionSpineLegacyReadOnly.middleware.ts:49-54`; metody odczytowe zawsze przechodzą. Dokładne mutacje dopasowane przez te regexy:

| Rodzina regex | Metoda i ścieżki |
|---|---|
| `/:id/(start-execution|block|unblock|move)` | POST `/api/initiatives/:id/start-execution`; POST `/:id/block`; POST `/:id/unblock`; POST `/:id/move` |
| `/:id/milestones/**` | POST `/api/initiatives/:id/milestones`; PUT i DELETE `/api/initiatives/:id/milestones/:milestoneId` |
| `/:id/resources/**` | POST `/api/initiatives/:id/resources`; DELETE i PUT `/api/initiatives/:id/resources/:resourceId`; POST `/api/initiatives/:id/resources/ai-apply-log` |
| `/:id/staffing-plans/**` | POST `/api/initiatives/:id/staffing-plans`; PUT i DELETE `/:id/staffing-plans/:planId`; POST `/:id/staffing-plans/:planId/roles`; PUT i DELETE `/:id/staffing-plans/:planId/roles/:roleId`; POST `/:id/staffing-plans/:planId/sync-capacity` |
| `/:id/budget-items/**` | POST `/api/initiatives/:id/budget-items`; PUT i DELETE `/api/initiatives/:id/budget-items/:itemId` |
| `/:id/raid/**` | POST `/api/initiatives/:id/raid`; PATCH i DELETE `/api/initiatives/:id/raid/:raidId` |
| `/:id/gate-roles/**` | PUT `/api/initiatives/:id/gate-roles` |
| lifecycle | POST `/api/initiatives/:id/lifecycle-transition-proposals`; POST `/:id/lifecycle-transition-executions`; POST `/:id/lifecycle-gate-decisions` |
| template | POST `/api/initiatives/:id/apply-template`; POST `/:id/apply-blueprint` |

W skrótach po pierwszej pełnej ścieżce prefiks pozostaje `/api/initiatives`.

### V8 Execution Control — globalna brama, 20 tras

`v8/index.ts:107` montuje bramę na `/api/v8/execution-control`. Wyjątek `DELETE /budget/entries/:id` z middleware `:7-13` jest kanonicznym poleceniem i **nie** należy do listy. Zablokowane są:

| Metoda | Ścieżka |
|---|---|
| POST | `/api/v8/execution-control/risk-signals/dismiss` |
| PATCH | `/api/v8/execution-control/raid/:id/mitigation` |
| POST | `/api/v8/execution-control/delay-signals/dismiss` |
| POST | `/api/v8/execution-control/delay-signals/detect` |
| POST | `/api/v8/execution-control/budget/entries` |
| POST | `/api/v8/execution-control/realizations` |
| POST | `/api/v8/execution-control/realizations/baseline` |
| POST | `/api/v8/execution-control/timeline-update` |
| POST | `/api/v8/execution-control/interventions/reassign` |
| POST | `/api/v8/execution-control/interventions/smooth` |
| POST | `/api/v8/execution-control/interventions/replan` |
| POST | `/api/v8/execution-control/interventions/escalate` |
| POST | `/api/v8/execution-control/interventions/dependency` |
| POST | `/api/v8/execution-control/manager/lanes/:laneId/problem-actions/execute` |
| POST | `/api/v8/execution-control/manager/lanes/:laneId/suggestions/apply` |
| POST | `/api/v8/execution-control/manager/lanes/:laneId/decisions` |
| POST | `/api/v8/execution-control/manager/lanes/:laneId/execute` |
| POST | `/api/v8/execution-control/manager/lanes/:laneId/ai/recommend` |
| POST | `/api/v8/execution-control/manager/lanes/:laneId/ai/triage` |
| POST | `/api/v8/execution-control/manager/lanes/:laneId/ai/manage-all` |

### Inna rodzina 409 — jawnie wykluczona

`initiativesExecutionRuntime.routes.ts:6434-6441` zwraca `409 VERSION_OR_IDEMPOTENCY_CONFLICT` po `MaterialCommandConflictError` i podaje `expectedVersion/currentVersion`. Dodatkowo `execution-control.routes.ts:894-905` rozróżnia `BASELINE_VERSION_CONFLICT` i `IDEMPOTENCY_KEY_REUSED`. To konflikty CAS/idempotencji powstałe **wewnątrz** aktywnego polecenia; brama legacy kończy żądanie przed handlerem stałym kodem `EXECUTION_RUNTIME_V1_WRITE_REQUIRED`. Liczba 350 z T3 nie opisuje zasięgu bramy.

## R2 — jedna przyczyna dla każdej powierzchni

Źródłem rozstrzygającym jest kanoniczny `GET /execution-write-map` w `initiativesExecutionRuntime.routes.ts:4978-5015` oraz realne deklaracje poleceń `:4696-4926`.

- **Błędna ścieżka wołacza — 5 tras:** V8 `POST /budget/entries`, `POST /realizations`, `PATCH /raid/:id/mitigation`, manager `POST .../problem-actions/execute`, manager `POST .../suggestions/apply`. Każda ma imienne mapowanie na istniejące polecenie Runtime-v1.
- **Brak polecenia Runtime-v1 — 68 tras:** wszystkie 23 mutacje Tasks, wszystkie 30 selektywne mutacje Initiatives oraz pozostałe 15 mutacji V8 wymienionych w R1. Żadna nie ma wpisu `legacyPath` w kanonicznym write-map. To rozstrzygnięcie obejmuje każdy wiersz R1 dokładnie raz.
- **Brak capability — 0 tras jako przyczyna tej bramy.** Capability jest oceniana po wejściu do Runtime-v1 (`capabilities` na `:2164-2240`); legacy middleware nie sprawdza capability i zwraca 409 wyłącznie z powodu metody/ścieżki.

**PRIORYTET — komentarze Zadania:** POST i DELETE `/api/tasks/:taskId/comments...` należą do grupy „brak polecenia”. Grep `comment` w Runtime-v1 nie znajduje polecenia komentarza Zadania; frontend wywołuje legacy `Api.addTaskComment/deleteTaskComment` (`TaskDetailView.tsx:186-200`, `api.ts:6287-6300`). Przyczyna jest taka sama jak RAID create/delete: brak kanonicznej komendy.

**PRIORYTET — RAID:** POST/PATCH/DELETE `/api/initiatives/:id/raid...` nie mają poleceń create/update/delete w Runtime-v1. Istniejące `raid-mitigation.record` (`:4820`) dotyczy wyłącznie mitygacji już istniejącego elementu i nie jest poleceniem tworzenia/usuwania RAID.

## R3 — rozstrzygnięcie projektowe

Kontrola kompletności R3: grupy rekomendacji są rozłączne i sumują się do R1: 2 komentarze Zadania + 3 operacje RAID + 21 innych Tasks + 27 innych Initiatives + 5 zmapowanych V8 + 15 niezmapowanych V8 = **73**. Każda powierzchnia ma dokładnie jedną rekomendację.

| Powierzchnia | Rekomendacja | Uzasadnienie |
|---|---|---|
| **PRIORYTET: komentarz Zadania POST/DELETE** | Dodać polecenia Runtime-v1 create/delete comment i przepiąć `TaskDetailView` | Komentarz jest trwałym elementem współpracy, a obecny aktywny UI woła legacy bez alternatywy. |
| **PRIORYTET: RAID create/update/delete** | Dodać osobne polecenia Runtime-v1 dla bytu RAID i przepiąć Initiative | Mitygacja nie zastępuje cyklu życia elementu RAID; obecny ekran jawnie tworzy i usuwa legacy. |
| Pozostałe 21 mutacji Tasks | Decyzja domenowa per rodzina; do czasu decyzji wyłączyć aktywne wołacze z widocznym powodem | Globalna brama blokuje także authoring/AI/custom fields, więc automatyczne tworzenie 21 poleceń rozszerzyłoby Runtime bez zatwierdzonego modelu. |
| 27 pozostałych mutacji Initiatives (poza trzema RAID) | Dodać polecenia tylko dla lifecycle/execution work; authoring/template zasłonić precedensem DEC-120 do decyzji właściciela | Regex łączy wykonanie z authoringiem; samo „jest pod bramą” nie dowodzi, że wszystko powinno wejść do Runtime. |
| 5 tras z istniejącym mapowaniem V8 | Przepiąć wołacze na wskazane polecenia Runtime-v1 | Backend publikuje już dokładną mapę; dodawanie kolejnego polecenia byłoby duplikatem. |
| Pozostałe 15 tras V8 | Zastosować widoczne wyłączenie zapisu; projektować polecenie dopiero po decyzji dla danej rodziny | Brak mapowania kanonicznego; nie wolno symulować sukcesu ani omijać bramy. |

Precedens T4 ma obecnie zasięg **trzech widocznie wyłączonych akcji**: Add Budget Entry i Record Realization w `BudgetControlPanel.tsx:547-653` oraz Save RAID Mitigation w `MitigationPanel.tsx:34-39,232-253`. Oba stany pokazują powód „Saving is moving to the canonical execution registry — in progress”; nie wysyłają żądania. Delete budget entry pozostaje aktywny, bo ma precyzyjny wyjątek i kanoniczny readback. To wzorzec przejściowy, nie docelowa implementacja.

## R4 — Decyzja przechodzi, Zadanie nie

`decisions.routes.ts:7-28` nie importuje żadnej funkcji bramy; po `verifyToken` i `requireOrgAccess` (`:32-33`) komentarze POST/PUT/DELETE są montowane na `:207-228`. Natomiast `tasks.routes.ts:16` importuje bramę, a `:67` montuje ją globalnie przed komentarzami POST/DELETE (`:1187-1198`).

Jednoznaczny wynik: komentarz Decyzji przechodzi **nie dlatego, że spełnia warunek bramy, lecz dlatego, że nigdy do niej nie wchodzi**. Jest to osobna luka niespójności authority, nie wzorzec do naśladowania.

Kontrola R4: trzy mutacje komentarza Decyzji (POST/PUT/DELETE) pozostają poza bramą, podczas gdy dwie mutacje komentarza Zadania (POST/DELETE) wpadają w globalną bramę Tasks; odczyty GET w obu routerach nie są blokowane.

## W-A — dowód mutacyjny

Nie ma zastosowania: dyżur jest czysto pomiarowy i projektowy, bez pozycji naprawczej i bez zmiany produktu. Nie wykonywałem mutacji kodu produkcyjnego.

## W-C — pomiar różnicowy

Produkt na markerze i po pracy jest identyczny; jedyną zmianą jest raport. Parser AST na markerze dał 23 + 30 + 20 = 73. Po utworzeniu raportu ta sama komenda dała ten sam zestaw pełnych nazw tras; artefakt `day146-extracted-routes.txt` jest dowodem bazowym. Nie raportuję zastanych porażek jako wyniku dyżuru.

## Pułapki (a)–(e) per pakiet

Nie uruchamiałem pakietu Vitest jako dowodu: R1–R4 są pomiarem montowania i kontraktu kodu, a nie twierdzeniem o działaniu runtime. (a) V8 feature gate, (b) results beta guard, (c) DB_TYPE oraz (d) auth bypass nie mogą zafałszować statycznego inwentarza. Pułapka (e) została wyłączona przez klasyfikację po kodzie odpowiedzi i miejscu zapadania, nie przez `status(409)`; 350 wystąpień nie zostało przypisanych do bramy.

Migracje wykonano przed jakimkolwiek pomiarem zapisującym: pierwszy przebieg zakończył się `✅ Postgres migrations complete`, drugi `Applying migrations: 0` i `✅ Postgres migrations complete`. Nie wykonywałem żądania HTTP ani zapisu aplikacyjnego, więc nie używam słowa „działa” dla ścieżek produktu.

Deklaracja Z30: **Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

## Artefakty poza repo

| Artefakt | SHA-256 |
|---|---|
| `/private/tmp/cx-day146-brama-zapisu-artefakty/day146-input-T1-T4.txt` | `1b83ba953476aed414b9592151b3015cb870e8a85ea81dfc6acc5a836a97d1c4` |
| `/private/tmp/cx-day146-brama-zapisu-artefakty/day146-migrate-1.log` | `ba3135b77c308f1a80c80057bfecc50c8d498b5647a9ee755e09b2e45b787119` |
| `/private/tmp/cx-day146-brama-zapisu-artefakty/day146-migrate-2.log` | `b236083fa9187fa6b8cd78ea1b0e9c1212ce3e8b9228a39b2a683531a4e83844` |
| `/private/tmp/cx-day146-brama-zapisu-artefakty/day146-z30.txt` | `6c28fedcc4d2dc2ac8eb4e07b56a4ef0114f73a564308bd8388b18bb4fa8b6c9` |
| `/private/tmp/cx-day146-brama-zapisu-artefakty/day146-extracted-routes.txt` | `02f0e03b8fd3a2a52b7f05b471225bc496e622b770dafd3f201336031caacf28` |
| `/private/tmp/cx-day146-brama-zapisu-artefakty/day146-extracted-routes-after.txt` | `02f0e03b8fd3a2a52b7f05b471225bc496e622b770dafd3f201336031caacf28` |

## W-D — granica rozłączności

Końcowy wynik przed commitem odbiorowym:

```text
$ git diff --name-only c685ea65af..HEAD
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY146_BRAMA_409_REPORT.md
$ git status --short
[brak wyjścia]
$ cmp -s day146-extracted-routes.txt day146-extracted-routes-after.txt && echo 'AST SET IDENTICAL'
AST SET IDENTICAL
```

Zero zmian `src/**`, `server/src/routes/**`, `server/migrations/**` i bramy.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowałem 73 tras realnym HTTP; nie twierdzę, że każda jest osiągalna przez aktualny konsument frontendowy. R1 dowodzi zachowania po dotarciu żądania do zamontowanego middleware.
- Nie zweryfikowałem owner acceptance dla rekomendacji R3; są projektem do decyzji, nie zatwierdzonym zakresem implementacji.
- Nie ustaliłem, które z 68 brakujących poleceń mają zostać trwale wycofane zamiast przeniesione. Do rozstrzygnięcia potrzebna jest decyzja właściciela per rodzina domenowa.
- Nie uruchomiłem runtime 4958/4959 ani żadnego modelu językowego; nie było to potrzebne do statycznego inwentarza i byłoby poza dowodem wymaganym w R1–R4.
