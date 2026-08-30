# CODEX DAY 160 — BRAMA ZAPISU ZADAŃ

Status: **POMIAR ZAKOŃCZONY — bez zmian produktu**
Marker: `218d020958`  
Gałąź: `codex/day160-brama-zadania-20260830`  
Zasoby: PostgreSQL `cx-day160-pg` na `127.0.0.1:6048`, runtime testowy przez `ApiGateway` (bez `server/src/index.ts`)

## Wejście §0.1

Wynik kroku (2), dosłownie:

```text
MARKER OK
```

Tip `github-backup/codex/m03-admin-20260824` był przed rozpoczęciem pracy nowszy od markera. Zgodnie z `DEC-2026-08-26-95` worktree powstał dokładnie z markera; nie wykonano rebase.

Wykonane komendy rozjazdu:

```bash
git -C "$VAULT" log --oneline 218d020958..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 218d020958..github-backup/codex/m03-admin-20260824
```

Pierwsza zwróciła 18 commitów (od `d330187693` do `4c8f2750a9`), druga 113 ścieżek. Pełne, nieucięte wyniki są w `day160-tip-log.txt` i `day160-tip-files.txt` z hashami poniżej; nie scalano żadnego z tych plików do worktree dyżuru.

Wynik kroku (7), dosłownie:

```text
218d020958a0470e043ce5be9537a1b15f351884
```

`git status --short | head -3` nie zwrócił żadnej linii.

Wolne miejsce przed pracą: `38 GiB`. Porty `6048`, `4988`, `4989`: `WOLNY`.

## Korekty wobec instrukcji

### Port PostgreSQL

- `§0.1/Z7/§0.2c/§0.5`: „Twój JEDYNY port bazy to `6048`”; `6047` jest imiennie zakazany jako „odbiór nadzorcy 159”.
- `§4/B7`: „baza na porcie `6047`”.

Konflikt rozstrzygnięto na rzecz `6048`, ponieważ wskazują go procedura uruchomieniowa, reguła STOP, wklejka właściciela i zakaz zajmowania `6047`.

### Ścieżka wyjątku budżetowego

R1 podaje `DELETE /api/budget/entries/:id`, lecz wyjątek bramy jest zamontowany na produkcyjnej trasie `DELETE /api/execution-control/budget/entries/:entryId` (`server/src/Gateway.ts:1384-1391`, `server/src/routes/executionControl.routes.ts:600-601`). Pomiar wykonano na rzeczywiście bramowanej trasie. Instrukcyjny prefiks `/api/budget` wskazuje inny router i nie mierzy wyjątku `requireCanonicalExecutionWriter`.

### Konfiguracja Vitest

Komenda uruchomiona z roota z `--config server/vitest.config.ts` utworzyła JSON z `numTotalTests: 0`; nie została uznana za PASS. Konfiguracja ma `include: src/**`, więc właściwy przebieg wykonano z katalogu `server/`, na tym samym pliku i z tym samym kompletem env.

## Z30 — brak wysyłki

```text
BRAK ZMIENNYCH POCZTY
```

Grep `startNotificationOutboxDrainCron|outboxWorker|platformOutboxDrainCron` w `server/src/Gateway.ts`: 0 trafień.

Po migracjach:

```text
 key | left
-----+------
(0 rows)
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## PostgreSQL i migracje

Kontener: `pgvector/pgvector:pg16`, nazwa `cx-day160-pg`, mapowanie wyłącznie `127.0.0.1:6048:5432`, baza `cx160`.

- pierwszy pełny przebieg: `✅ Postgres migrations complete`;
- drugi przebieg: `Applying migrations: 0`, `✅ Postgres migrations complete`.

## R1 — realny HTTP dla `/api/tasks`

Test: `server/src/routes/__tests__/day160.task-write-gate.pg.test.ts`. Montaż: `ApiGateway.getInstance().initializeRoutes(app)`. Token: JWT podpisany `JWT_SECRET` przebiegu. DB: realny PostgreSQL, strażnik `assertRealPostgresTestEnvironment()` bez argumentów. Retry: `--retry=0` oraz `{ retry: 0 }`.

| Operacja                           | HTTP | Dosłowne ciało                                                                                                                                                                              | DB przed → po               |
| ---------------------------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `POST /api/tasks`                  |  409 | `{"error":"Legacy execution writes are retired. Use the canonical Runtime-v1 execution API.","code":"EXECUTION_RUNTIME_V1_WRITE_REQUIRED","canonicalWriter":"/api/initiatives/runtime-v1"}` | `tasks 0→0`, `comments 0→0` |
| `PUT /api/tasks/:id`               |  409 | jak wyżej                                                                                                                                                                                   | `tasks 0→0`, `comments 0→0` |
| `DELETE /api/tasks/:id`            |  409 | jak wyżej                                                                                                                                                                                   | `tasks 0→0`, `comments 0→0` |
| `POST /api/tasks/:taskId/comments` |  409 | jak wyżej                                                                                                                                                                                   | `tasks 0→0`, `comments 0→0` |

Wniosek R1: brama runtime blokuje wszystkie cztery zmierzone mutacje przed handlerami i nie zmienia tabel `tasks`/`task_comments`.

### Wyjątek budżetowy

`DELETE /api/execution-control/budget/entries/:entryId?initiativeId=:id&expectedVersion=1`, z `X-Idempotency-Key`, zwrócił `404` (nie 409) i ciało z trwałym receipt o `outcome: "NOT_FOUND"`, `reasonCode: "budget_entry_not_found"`; `budget_entries 0→0`. To dowodzi dotarcia przez wyjątek bramy do kanonicznego handlera. Receipt jest z definicji niemutowalny; zostanie usunięty razem z wolumenem efemerycznego kontenera.

## R3 — realna ścieżka personal task

`POST /api/my-work/personal-tasks` zwrócił `201`. Surowy readback SQL potwierdził dokładnie jeden nowy wiersz:

```text
task_type      = personal
initiative_id  = NULL
project_id     = NULL
organization_id = organizacja JWT
assignee_id     = użytkownik JWT
```

`tasks 0→1`. Odpowiedzi na dwa osobne pytania:

1. Czy da się utworzyć jakiekolwiek zadanie? **TAK — zadanie osobiste.**
2. Czy zmierzona działająca ścieżka tworzy zadanie powiązane z inicjatywą/projektem? **NIE — oba klucze są `NULL`.**

Nie jest to funkcjonalny zamiennik kanonicznej ścieżki zadania inicjatywy/projektu.

## Pułapki środowiska Z33

- `DB_TYPE`: konfiguracja serwerowa wpisuje `sqlite`; test ustawia i asertuje `postgres` przed inicjalizacją Gateway/DB.
- `ENABLE_TEST_AUTH_BYPASS=false`: prawdziwy `verifyToken`, JWT podpisany sekretem przebiegu.
- `ENABLE_V8_GLOBAL=true` i `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`: ustawione w tej samej linii; badane trasy nie opierają wyniku na wcześniejszym fałszywym 404 ani testowym bypassie visibility.
- Kanoniczne polecenie i legacy `tasks` nie zostały utożsamione: pomiar sprawdza rzeczywistą tabelę `tasks`.
- Brak repliki routera: użyto realnego `ApiGateway`.

## Wynik testu dowodowego

JSON: `success=true`, `numTotalTests=3`, `numPassedTests=3`, `numFailedTests=0`.

Pełne nazwy PASS:

1. `Day 160 task write gate through the real ApiGateway and PostgreSQL R1 records POST, PUT, DELETE and comment writes as 409 with unchanged database`
2. `Day 160 task write gate through the real ApiGateway and PostgreSQL R1 records the governed budget-delete exception reaching its handler`
3. `Day 160 task write gate through the real ApiGateway and PostgreSQL R3 creates a personal task and reads its exact storage coordinates`

## R2 — inwentarz obsługi 409

Pomiar objął bezpośrednie wywołania mutujące rodzinę `/tasks` i publiczne wrappery, z wykluczeniem tras o podobnej nazwie, ale innym routerze (`/api/focus/tasks`, `/my-work/tasks/ai-text`, Runtime-v1 execution-case). Żaden z poniższych komunikatów nie rozróżnia kodu `EXECUTION_RUNTIME_V1_WRITE_REQUIRED` od awarii sieciowej/500.

| Wołacz (plik:linia)                                                       | Mutacja                       | Catch obejmuje await?             | Co widzi użytkownik / stan UI po 409                                                                                                            |
| ------------------------------------------------------------------------- | ----------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/apiTyped.ts:257`                                            | create                        | nie w wrapperze                   | odrzucony Promise; decyzja należy do konsumenta                                                                                                 |
| `src/services/apiTyped.ts:260`                                            | update                        | nie w wrapperze                   | odrzucony Promise                                                                                                                               |
| `src/services/apiTyped.ts:262`                                            | delete                        | nie w wrapperze                   | odrzucony Promise                                                                                                                               |
| `src/services/apiTyped.ts:265`                                            | status                        | nie w wrapperze                   | odrzucony Promise                                                                                                                               |
| `src/services/apiTyped.ts:268`                                            | assign                        | nie w wrapperze                   | odrzucony Promise                                                                                                                               |
| `src/services/apiTyped.ts:271`                                            | bulk update                   | nie w wrapperze                   | odrzucony Promise                                                                                                                               |
| `src/services/apiTyped.ts:277`                                            | comment                       | nie w wrapperze                   | odrzucony Promise                                                                                                                               |
| `src/services/api.ts:4739-4761` / `src/services/api/tasks.api.ts:110-117` | create                        | nie w wrapperze                   | błąd `Failed to create task`; wrapper nie pokazuje UI                                                                                           |
| `src/services/api.ts:4775-4781` / `src/services/api/tasks.api.ts:119-127` | update                        | nie w wrapperze                   | błąd `Failed to update task`; wrapper nie pokazuje UI                                                                                           |
| `src/services/api.ts:4784-4790` / `src/services/api/tasks.api.ts:151-159` | delete                        | nie w wrapperze                   | błąd `Failed to delete task`; wrapper nie pokazuje UI                                                                                           |
| `src/services/api.ts:6288-6296` / `src/services/api/tasks.api.ts:169-178` | comment                       | nie w wrapperze                   | błąd `Failed to add comment`; wrapper nie pokazuje UI                                                                                           |
| `src/hooks/useActionHandler.ts:428`                                       | create                        | tak, `:427-440`                   | toast `Failed to create task`; zwrot `cancelled`; spinner zerowany w `finally`                                                                  |
| `src/services/chatActionHandler.ts:120`                                   | create                        | tak, zewnętrzny `try`             | zwrot `success:false` z ogólnym tekstem błędu; brak dedykowanego toastu w handlerze                                                             |
| `src/components/MyWork/TaskDetailModal.tsx:154,164`                       | update/create                 | tak, `:170-174`                   | toast `Failed to save task`; `saving=false`; modal pozostaje                                                                                    |
| `src/components/Initiatives/InitiativeDocumentView.tsx:3514`              | create                        | tak, `:3546-3550`                 | `e.message` lub `Failed to create task`; `isMutating=false`                                                                                     |
| `src/components/Initiatives/sections/TasksMilestonesSection.tsx:788`      | create helper                 | w helperze nie; w wywołaniach tak | manual: `failedToCreateTask`; duplikacja/AI: własne ogólne toasty; spinner zerowany                                                             |
| `src/components/Initiatives/sections/TasksMilestonesSection.tsx:932`      | delete                        | tak                               | toast `failedToRemove`; lista bez optymistycznego usunięcia                                                                                     |
| `src/components/Results/ResultsKpiReportsView.tsx:516`                    | create (pętla)                | tak, `:532-536`                   | toast `Failed to create tasks`; modal pozostaje; spinner zerowany                                                                               |
| `src/components/InitiativeTasksTab.tsx:64`                                | create                        | tak                               | tylko `console.error`; użytkownik nie dostaje komunikatu, modal pozostaje                                                                       |
| `src/components/InitiativeTasksTab.tsx:74`                                | update                        | tak                               | tylko `console.error`; brak komunikatu                                                                                                          |
| `src/components/InitiativeTasksTab.tsx:126`                               | bulk update                   | tak                               | tylko `console.error`; spinner zerowany                                                                                                         |
| `src/components/InitiativeTasksTab.tsx:154`                               | generated create              | tak                               | `alert('AI Generation failed')`; spinner zerowany                                                                                               |
| `src/components/InitiativeTaskBoard.tsx:66`                               | generated create              | tak                               | `alert('Failed to generate tasks. Please try again.')`; spinner zerowany                                                                        |
| `src/components/dashboard/UserTaskList.tsx:49`                            | create                        | tak                               | brak komunikatu; modal jest zamykany także w catch — cicha porażka                                                                              |
| `src/components/Portfolio/InitiativeSidePanel.tsx:203`                    | update                        | tak                               | tylko `console.error`; modal pozostaje                                                                                                          |
| `src/components/MyWork/TaskInbox.tsx:128`                                 | update                        | tak                               | toast `Failed to update task`; stan lokalny zmienia się dopiero po sukcesie                                                                     |
| `src/components/MyWork/TaskInbox.tsx:144`                                 | delete                        | tak                               | toast `Failed to delete task`; rekord pozostaje                                                                                                 |
| `src/components/MyWork/TasksCalendarView.tsx:219`                         | update non-personal           | tak                               | toast `Failed to update`; spinner per task zerowany                                                                                             |
| `src/components/MyWork/MyTasksList.tsx:251`                               | update                        | tak                               | toast `Failed to update task`; stan lokalny zmienia się dopiero po sukcesie                                                                     |
| `src/components/MyWork/MyTasksList.tsx:287`                               | delete                        | tak                               | toast `Failed to delete task`; rekord pozostaje                                                                                                 |
| `src/components/MyWork/TaskDetailView.tsx:1890`                           | accept/update                 | tak                               | toast `Failed to start task`; flow wraca do `idle`; brak bannera                                                                                |
| `src/components/MyWork/TaskDetailView.tsx:3217`                           | generate section              | tak                               | ogólny błąd generowania; karta wychodzi ze stanu generowania w catch                                                                            |
| `src/components/MyWork/Focus/FocusBoard.tsx:433`                          | update                        | tak                               | optymistyczna zmiana cofnięta przez reload; toast `Failed to update task`                                                                       |
| `src/components/MyWork/IdeaMapWorkspace.tsx:3420`                         | create                        | tak                               | toast błędu; link artefaktu nie jest dopisywany                                                                                                 |
| `src/components/Execution/ExecutionHub.tsx:2973`                          | patch                         | tak                               | stan optymistyczny cofnięty; toast „Nie udało się zaktualizować statusu zadania”                                                                |
| `src/components/Initiatives/calendar/InitiativeCalendar.tsx:153`          | update przez `/api/pmo/tasks` | tak                               | rollback przesunięcia; **brak komunikatu**                                                                                                      |
| `src/components/Initiatives/sections/GateReadinessSection.tsx:946`        | update                        | tak, wspólny catch `:968`         | `e.message` lub `failedToApply`; jeden błąd przerywa dalszą pętlę                                                                               |
| `src/components/Initiatives/sections/DependenciesSection.tsx:371,376`     | delete/add dependency         | tak                               | ogólny toast błędu; spinner zerowany                                                                                                            |
| `src/components/MyWork/shared/DependenciesSection.tsx:335`                | add                           | tak                               | rozróżnia tylko circular/duplicate; 409 wpada w `Failed to add dependency`                                                                      |
| `src/components/MyWork/shared/DependenciesSection.tsx:398`                | delete                        | tak                               | toast `Failed to remove`                                                                                                                        |
| `src/components/MyWork/shared/DependenciesSection.tsx:416`                | duplicate                     | tak                               | toast `Failed to duplicate dependency`                                                                                                          |
| `src/components/MyWork/shared/DependenciesSection.tsx:485-486`            | replace dependency            | tak                               | toast `Failed to update dependency`; po udanym DELETE i zablokowanym POST może powstać częściowa operacja, choć obecna brama blokuje już DELETE |

Wniosek R2: bezpośredni inwentarz znalazł **32 miejsca konsumenckie / grupy operacji** (nie siedem). Obsługa jest niejednolita: większość ma catch, lecz co najmniej cztery powierzchnie są dla użytkownika ciche (`InitiativeTasksTab`, `UserTaskList`, `InitiativeSidePanel`, `InitiativeCalendar`). Żadna zbadana powierzchnia nie tłumaczy 409 jako wycofanej legacy powierzchni ani nie prowadzi do Runtime-v1.

## R3 — inwentarz pisarzy `tasks`

Komenda bez `__tests__` znalazła 28 tekstowych trafień. Po odjęciu komentarza w `chatHandoffService.ts` i jednorazowego skryptu dowodowego pozostaje **26 realnych miejsc INSERT w 23 plikach**.

| Pisarz (plik:linia)                                         | Brama kanoniczna                                                                    | Konsument / charakter                                                     |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `mcp/mcpServer.ts:482`                                      | nie                                                                                 | MCP, poza bezpośrednim `src/` UI                                          |
| `ai/actionProposalEngine.ts:125`                            | zależy od wywołującego                                                              | wewnętrzny silnik AI, nie router                                          |
| `ai/actionExecutors/taskExecutor.ts:69`                     | zależy od wywołującego                                                              | wewnętrzny executor                                                       |
| `controllers/DecisionController.ts:2274,2291`               | nie na poziomie serwisu                                                             | efekt uboczny decyzji, nie ogólna akcja task UI                           |
| `controllers/TaskController.ts:1286`                        | **tak** dla obu montaży `tasks.routes.ts`                                           | główny frontend `/api/tasks`; realnie 409                                 |
| `routes/executionControl.routes.ts:930`                     | **tak**, przy montażu Gateway i V8                                                  | execution-control                                                         |
| `routes/feedback.routes.ts:1174`                            | nie                                                                                 | efekt uboczny feedback ticketu; frontend feedback, nie ogólny create task |
| `routes/my-work.routes.ts:1379`                             | **nie**                                                                             | `Api.createPersonalTask`; realnie 201 w tym dyżurze                       |
| `routes/my-work.routes.ts:7545`                             | nie                                                                                 | notebook/conversion wewnątrz My Work                                      |
| `routes/my-work/calendar.routes.ts:929`                     | nie                                                                                 | efekt operacji kalendarza My Work                                         |
| `routes/v8/my-work.routes.ts:2868`                          | nie (tylko global/V8 gates)                                                         | V8 My Work                                                                |
| `routes/v8/results.routes.ts:2137,3565`                     | nie (results gates, nie writer gate)                                                | Results UI / działania KPI                                                |
| `routes/pmo/initiatives.routes.ts:1779,1806`                | **tak dla `/:id/apply-template`** przez `requireCanonicalInitiativeExecutionWriter` | apply-template; wzorzec ścieżki jest jawnie bramowany                     |
| `routes/integrations/automation.routes.ts:406`              | nie                                                                                 | integracja automation, mount stub; brak bezpośredniego ogólnego task UI   |
| `services/aiActionExecutor.ts:1101`                         | zależy od wywołującego                                                              | wewnętrzny executor                                                       |
| `services/InterviewAssignmentService.ts:1348`               | zależy od wywołującego                                                              | efekt przypisania wywiadu                                                 |
| `services/TaskService.ts:153`                               | zależy od wywołującego                                                              | serwis współdzielony                                                      |
| `services/blueprintService.ts:302`                          | zależy od wywołującego                                                              | materializacja blueprintu                                                 |
| `services/initiativeGovernanceService.ts:451`               | zależy od wywołującego                                                              | governance initiative                                                     |
| `services/demo/demoSeedService.ts:2339`                     | nie dotyczy runtime użytkownika                                                     | seed demo; nie traktowano jako działającej ścieżki produktu               |
| `services/resultsVnext/kpi/kpiRecoveryChildCommands.ts:434` | zależy od wywołującego                                                              | wewnętrzne polecenie recovery KPI                                         |
| `services/health/healthProbeService.ts:800`                 | nie dotyczy zwykłego UI                                                             | zapis sondy zdrowia                                                       |
| `services/notebookConversionService.ts:226`                 | zależy od wywołującego                                                              | konwersja notebooka, nie ogólny create task                               |

„Zależy od wywołującego” oznacza, że sam serwis nie jest routerem i nie ma middleware; nie podniesiono jego statusu do osłoniętego bez dowodu wszystkich wejść. Głęboki dowód runtime, zgodnie z zakresem, wykonano tylko dla `TaskController` i `my-work.routes.ts:1379`.

Wniosek: tabela `tasks` nie ma jednego writer authority. Brama zamyka główną rodzinę `/api/tasks`, lecz inne źródła nadal zapisują do tej samej tabeli. Zmierzona ścieżka personal task jest prawdziwa, ale tworzy osobny byt bez inicjatywy/projektu.

## R4 — materiał do decyzji właściciela

### Wariant A — kanoniczne polecenia Runtime-v1

Zakres techniczny:

- zaprojektować komendy create/update/delete/comment/dependency/assignment dla tasków w `server/src/domain/initiatives-execution/**` i trwałe receipt/CAS/idempotency;
- zdecydować, czy kanoniczny zapis nadal materializuje `tasks`, czy migruje read/write model do `ie_aggregate_state`; dziś `postgresMaterialCommandUnitOfWork.ts` zapisuje inny agregat;
- przepiąć 23 mutujące trasy w `server/src/routes/pmo/tasks.routes.ts` i ich kontrolery/serwisy;
- ujednolicić lub jawnie odseparować `server/src/routes/my-work.routes.ts` personal tasks oraz pozostałych pisarzy z tabeli R3;
- zmienić klienty `src/services/api.ts`, `src/services/api/tasks.api.ts`, `src/services/apiTyped.ts` i konsumentów R2 tak, by obsługiwały receipt/readback;
- migracja/backfill istniejących `tasks`, testy tenant/CAS/idempotency i runtime HTTP w obie strony.

Rząd wielkości: **15–30 dni roboczych** dla pierwszego zamkniętego pionowego zakresu; więcej, jeśli wszystkie 23 trasy i wszyscy pisarze mają być migrowani jednocześnie. Ryzyka: dwa magazyny podczas migracji, niespójny read model, utrata powiązań/comment/dependency, niezgodność personal tasks, koszt backfillu i długie okno dual-write/cutover.

Odkrycie personal task zwiększa zakres wariantu A: trzeba świadomie objąć lub wyłączyć działającą dziś ścieżkę poza Runtime-v1, inaczej writer authority pozostanie wielokrotne.

### Wariant B — cofnięcie lub zawężenie bramy legacy

Zakres techniczny:

- zmienić regułę `requireCanonicalExecutionWriter` lub miejsce jej montowania w `server/src/routes/pmo/tasks.routes.ts`/`server/src/Gateway.ts`, imiennie dopuszczając wybrane operacje;
- zachować normalne `verifyToken`, membership, audit i capability gates;
- uruchomić realne testy wszystkich ponownie otwartych mutacji oraz tenant/readback/idempotency;
- ujednolicić komunikaty klientów R2 i jasno oznaczyć, które ścieżki nadal są wycofane;
- zaplanować późniejsze usunięcie wyjątku, by rozwiązanie nie stało się trwałym dual-write bez właściciela.

Rząd wielkości: **3–7 dni roboczych** dla kontrolowanego przywrócenia create/update/delete/comment z testami; więcej dla całych 23 tras. Ryzyka: ponowne otwarcie legacy writerów, dalsze dwa rozłączne magazyny (`tasks` i `ie_aggregate_state`), rozjazd receipt/audit oraz utrwalenie niejednolitego modelu uprawnień.

Odkrycie personal task pokazuje, że wariant B nie tworzyłby pierwszego wyjątku od Runtime-v1 — produkt już ma działający writer poza bramą. Jednocześnie poszerzenie legacy zwiększyłoby liczbę takich wyjątków. To informacja kosztowa i ryzykowa, nie rekomendacja wyboru.

Codex **nie wybiera** wariantu A ani B; decyzja należy do właściciela.

## Pomiar zasięgu testów Z24

Instrukcja odwołuje się do `§0.4a`, ale wydany plik nie zawiera takiej sekcji ani algorytmu poza komendą listy zmienionych plików. Nie przepisano cudzej liczby. Własny mianownik zmian produktu wynosi **0**, bo diff zawiera tylko nowy test i raport. Pakiet dowodowy uruchomił wszystkie **3/3** przypadki nowego pliku po pełnych migracjach; porównanie wykonano po `fullName`, nie tylko po liczbie. Nie uruchamiano szerokiej suity katalogu jako rzekomego dowodu dla niezmienionego produktu.

## Artefakty poza repo

| Artefakt                                                                           | SHA-256                                                            |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `/private/tmp/cx-day160-brama-zadania-artefakty/day160-http-db-evidence.json`      | `e69d2b35eb39021acbf952f17cc027948c7324b0f1fbb7362503744a9857f625` |
| `/private/tmp/cx-day160-brama-zadania-artefakty/day160-vitest.json`                | `69d3f039395364b2b3e7ea0675a5eae91b1cf8b3ab0f148f071c6f86ec7a49c8` |
| `/private/tmp/cx-day160-brama-zadania-artefakty/day160-migrate-first.log`          | `6440828e95cffc197b0323c27a0abc0fb5ff717e467d70feebe357ab55dc1be9` |
| `/private/tmp/cx-day160-brama-zadania-artefakty/day160-migrate-second.log`         | `3c544f9bb72e1aba0bd0877cbf9fe3fc5cf30cf2242cf910f51b44a5f9ec1563` |
| `/private/tmp/cx-day160-brama-zadania-artefakty/day160-front-mutation-context.txt` | `e84107ecd03af4c187fba5d40454e1c4f4329a71930f8fd82200ad34a506d1f1` |
| `/private/tmp/cx-day160-brama-zadania-artefakty/day160-front-task-callers.txt`     | `7eed4abe707c2f1ee9ac63703a419766425da39145e08a133fcc038b0e8c1009` |
| `/private/tmp/cx-day160-brama-zadania-artefakty/day160-task-writers.txt`           | `6eadd58e92def95d99748a3e4b1e6c1d06cc80a33490d0398a61e353fb636c05` |
| `/private/tmp/cx-day160-brama-zadania-artefakty/day160-tip-files.txt`              | `998ee9d952033113c0c0906890018c12b1c04d82e521c962005fcb4746efef85` |
| `/private/tmp/cx-day160-brama-zadania-artefakty/day160-tip-log.txt`                | `7df81e45fc0efd4592b699f3d22b594018a8bff81ecd7ee62b3bfc834900c0ac` |

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano głębokiego runtime dla 21 pozostałych plików-pisarzy R3; zakres zamawiał realny E2E tylko dla `/api/tasks` i `/api/my-work/personal-tasks`. Ich klasyfikacja „zależy od wywołującego” pozostaje celowo niepodniesiona do osłoniętej/nieosłoniętej.
- Nie uruchamiano UI ani `server/src/index.ts`; dyżur nie wymaga nowego wizualium.
- Nie wykonano pomiaru na demo/staging/produkcji — celowo i zgodnie z Z28.

## Sprzątanie zasobów

Po utrwaleniu artefaktów wykonano `docker rm -fv cx-day160-pg`. Kontener i jego wolumen są usunięte; porty `6048`, `4988`, `4989` po sprzątaniu zwróciły `WOLNY`. Niemutowalne receipts i wszystkie pozostałe dane pomiarowe istniały wyłącznie w usuniętym wolumenie.
