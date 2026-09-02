# CODEX DAY 239 — REALIZACJA: dwa magazyny zadań

Data pomiaru: 2026-09-01
Gałąź: `codex/day239-realizacja-20260901`
Baza: marker `319f3490c6`, lokalny PostgreSQL `cx239` na `127.0.0.1:6188`
Charakter: POMIAROWY. Nie wykonano migracji, scalenia ani naprawy produktu.

## Wynik w jednym akapicie

Na świeżej bazie marker tworzy legacy `tasks` z **80 kolumnami** oraz osobną tabelę komentarzy z 6 kolumnami. Kanoniczny `ExecutionTask` ma **17 pól najwyższego poziomu** w jednym `payload_json JSONB`. To nie są równoważne magazyny: legacy zachowuje znacznie szerszy model danych, natomiast kanon zapewnia wymagany „dom” zadania, kontrolę wersji, relacje, audyt, outbox i paragon polecenia. Na lokalnej miniaturze M3 było `8` rekordów wyłącznie w legacy i `0` w kanonie; jest to test zapytań, nie stan stagingu. Jedyny dostępny pomiar stagingu jest cudzym, historycznym pomiarem z 31.08: `467` legacy, w tym `411` bez `owner_id`, `265` bez `initiative_id`, `49` bez `assignee_id`, `195` bez terminu i `467` bez SLA; nie wolno traktować tych wartości jako potwierdzonych na dziś.

## 0. Dowód wejścia

### Marker i sanity — wynik dosłowny

```text
319f3490c6 instrukcja 239 Realizacja — dyzur POMIAROWY pod decyzje wlasciciela o dwoch magazynach zadan (zakaz migrowania)
MARKER OK
319f3490c6c7ce50c7c26700f9f55a27150703bb
```

`git status --short | head -3` nie wypisał nic. Przy pierwszym sprawdzeniu było 13 GiB wolne, przy drugim 11 GiB. Porty `6188`, `5164`, `5165` były wolne. Tip gałęzi bazowej uciekł o 31 commitów i 56 ścieżek; pełne listy są w artefaktach `day239-tip-divergence-{log,files}.txt`. Start zgodnie z instrukcją nastąpił dokładnie z markera.

### Migracje i brak wysyłki

Pierwszy przebieg: `Applying migrations: 880`, `Postgres migrations complete`. Drugi przebieg: `Applying migrations: 0`, `Postgres migrations complete`. `settings WHERE key LIKE 'smtp%'` zwróciło `0 rows`; środowisko wypisało `BRAK ZMIENNYCH POCZTY`; grep drenaży w `server/src/Gateway.ts` zwrócił 0 trafień.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R1. Inwentarz obu magazynów

### Legacy

Pełny łańcuch migracji utworzył **80 kolumn** `tasks`; wynik z `information_schema.columns` znajduje się w `day239-tasks-schema.txt`. Osobna tabela `task_comments` ma `id, task_id, user_id, content, created_at, updated_at` (`server/migrations/000_initdb_core_tables.sql:234`). `owner_id` dokłada późniejsza migracja (`server/migrations/20260127_pmo_task_fields.sql:6`), a nie bazowy `CREATE TABLE`.

### Kanon

`ExecutionTask` ma **17 pól najwyższego poziomu**: `taskId, executionCaseId, initiativeId, title, description, status, assigneeId, ownerId, dueAt, slaAt, evidenceRefs, blockerDecisionIds, dependencyTaskIds, milestoneIds, blastRadius, createdAt, completedAt` (`server/src/domain/initiatives-execution/executionWork.ts:25-50`). SQL nie narzuca im osobnych kolumn: przechowuje dowolny obiekt w `payload_json JSONB` (`server/migrations/932_initiatives_execution_material_commands.sql:33-40`).

### Jedna transakcja zapisu

Przechwycony przebieg `execution.task.create` wykazał w jednym `BEGIN…COMMIT` zapisy do dokładnie pięciu tabel: `ie_aggregate_relations`, `ie_aggregate_state`, `ie_audit_events`, `ie_outbox_events`, `ie_command_receipts`. Dowód: `day239-task-create-sql.log`. Test dnia 197 sam uruchamia `initiative.register`, a próbę kolejnego przejścia kończy `ROLLBACK`; dlatego tezę o zadaniu potwierdził licencjonowany test `day204-legacy-task-cutover-idempotency.realdb.test.ts`, nie sam plik dnia 197.

## R2. Pełna tabela różnic pól

Legenda: **K** = po wyborze legacy jako jedynego magazynu giną kanoniczne informacje bez kolumn legacy: `executionCaseId`, `evidenceRefs`, `blockerDecisionIds`, `dependencyTaskIds`, `milestoneIds`, `blastRadius`, a systemowo także atomowy audyt/outbox/paragon. Dowód braku pól legacy po stronie kanonu: pełny interfejs (`executionWork.ts:25-50`). Dowód K: ten sam interfejs oraz pięciotabelowy log transakcji. „Brak” oznacza brak semantycznie równoważnego pola, a nie tylko inną nazwę.

|   # | Kolumna legacy                  | Odpowiednik kanoniczny                            | Jeśli wygrywa kanon                                                                                                   | Jeśli wygrywa legacy                              |
| --: | ------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
|   1 | `id`                            | `taskId`                                          | mapowalne 1:1                                                                                                         | K                                                 |
|   2 | `project_id`                    | brak                                              | ginie przypisanie do projektu                                                                                         | K                                                 |
|   3 | `organization_id`               | koperta/klucz SQL, nie payload                    | wartość zachowana jako klucz organizacji                                                                              | K                                                 |
|   4 | `title`                         | `title`                                           | —                                                                                                                     | K                                                 |
|   5 | `description`                   | `description`                                     | —                                                                                                                     | K                                                 |
|   6 | `status`                        | `status` wyliczany                                | giną dowolne wartości legacy; potrzebna jawna mapa `todo` itd.; kanon wylicza status (`executionWork.ts:120-125,146`) | ginie wyliczanie statusu z blokad                 |
|   7 | `priority`                      | brak                                              | ginie priorytet                                                                                                       | K                                                 |
|   8 | `assignee_id`                   | `assigneeId`                                      | mapowalne, jeśli tożsamość istnieje                                                                                   | K                                                 |
|   9 | `reporter_id`                   | brak                                              | ginie reporter                                                                                                        | K                                                 |
|  10 | `due_date`                      | `dueAt`                                           | mapowalne tylko gdy parsowalne i niepuste (`executionWork.ts:137-145`)                                                | K                                                 |
|  11 | `estimated_hours`               | brak                                              | ginie estymata                                                                                                        | K                                                 |
|  12 | `checklist`                     | brak                                              | ginie checklista                                                                                                      | K                                                 |
|  13 | `attachments`                   | brak                                              | giną załączniki                                                                                                       | K                                                 |
|  14 | `tags`                          | brak                                              | giną tagi                                                                                                             | K                                                 |
|  15 | `task_type`                     | brak                                              | ginie typ zadania                                                                                                     | K                                                 |
|  16 | `initiative_id`                 | `initiativeId`                                    | mapowalne tylko dla zadania z inicjatywą                                                                              | K                                                 |
|  17 | `why`                           | brak                                              | ginie uzasadnienie                                                                                                    | K                                                 |
|  18 | `expected_outcome`              | brak                                              | ginie oczekiwany wynik                                                                                                | K                                                 |
|  19 | `decision_impact`               | brak                                              | ginie wpływ decyzji                                                                                                   | K                                                 |
|  20 | `evidence_required`             | brak; `evidenceRefs` to dowody, nie wymóg         | ginie opis wymaganych dowodów                                                                                         | giną referencje realnych dowodów                  |
|  21 | `strategic_contribution`        | brak                                              | ginie wkład strategiczny                                                                                              | K                                                 |
|  22 | `roadmap_initiative_id`         | brak                                              | ginie relacja roadmapowa                                                                                              | K                                                 |
|  23 | `kpi_id`                        | brak                                              | ginie relacja KPI                                                                                                     | K                                                 |
|  24 | `raid_item_id`                  | brak                                              | ginie relacja RAID                                                                                                    | K                                                 |
|  25 | `assignees`                     | brak                                              | ginie lista wielu wykonawców                                                                                          | K                                                 |
|  26 | `progress`                      | brak                                              | ginie procent postępu                                                                                                 | K                                                 |
|  27 | `blocked_reason`                | brak; `blockerDecisionIds` to identyfikatory      | ginie tekst powodu blokady                                                                                            | giną powiązania z decyzjami blokującymi           |
|  28 | `sla_hours`                     | brak                                              | ginie liczba godzin SLA                                                                                               | K                                                 |
|  29 | `sla_due_at`                    | `slaAt`                                           | mapowalne tylko gdy parsowalne i niepuste; cudzy pomiar: 467/467 puste                                                | K                                                 |
|  30 | `escalation_level`              | brak                                              | ginie poziom eskalacji                                                                                                | K                                                 |
|  31 | `escalated_to_id`               | brak                                              | ginie adresat eskalacji                                                                                               | K                                                 |
|  32 | `last_escalated_at`             | brak                                              | ginie historia ostatniej eskalacji                                                                                    | K                                                 |
|  33 | `custom_status_id`              | brak                                              | ginie status niestandardowy                                                                                           | K                                                 |
|  34 | `step_phase`                    | brak                                              | ginie faza kroku                                                                                                      | K                                                 |
|  35 | `budget_allocated`              | brak                                              | ginie budżet zadania                                                                                                  | K                                                 |
|  36 | `budget_spent`                  | brak                                              | ginie wykonanie budżetu zadania                                                                                       | K                                                 |
|  37 | `risk_rating`                   | brak                                              | ginie ocena ryzyka                                                                                                    | K                                                 |
|  38 | `acceptance_criteria`           | brak                                              | giną kryteria akceptacji                                                                                              | K                                                 |
|  39 | `blocking_issues`               | brak                                              | ginie tekst przeszkód                                                                                                 | K                                                 |
|  40 | `completed_at`                  | `completedAt`                                     | runner tworzy `null`; zakończenie ustawia czas bieżący (`executionWork.ts:155-160,312-317`), więc historia ginie      | K                                                 |
|  41 | `created_at`                    | `createdAt`                                       | tworzenie ustawia czas bieżący (`executionWork.ts:155-160`), więc historia ginie                                      | K                                                 |
|  42 | `updated_at`                    | `ie_aggregate_state.updated_at`, nie pole zadania | można zachować tylko po zmianie ścieżki zapisu; obecny writer nadpisuje                                               | K                                                 |
|  43 | `idempotency_key`               | `client_request_id` w paragonie, nie payload      | semantyka może być przeniesiona tylko jawną regułą                                                                    | kanoniczny paragon jest silniejszy niż wolne pole |
|  44 | `created_by`                    | aktor audytu, nie pole zadania                    | ginie jako atrybut zadania bez jawnego mapowania                                                                      | K                                                 |
|  45 | `started_at`                    | brak                                              | ginie data startu                                                                                                     | K                                                 |
|  46 | `backup_assignee_id`            | brak                                              | ginie zastępca                                                                                                        | K                                                 |
|  47 | `list_id`                       | brak                                              | ginie lista                                                                                                           | K                                                 |
|  48 | `workstream_id`                 | brak                                              | ginie strumień pracy                                                                                                  | K                                                 |
|  49 | `source`                        | brak                                              | ginie źródło                                                                                                          | K                                                 |
|  50 | `owner_id`                      | `ownerId`                                         | mapowalne, ale wymagane; cudzy pomiar: 411/467 puste (`executionWork.ts:137-145`)                                     | K                                                 |
|  51 | `requires_acceptance`           | brak                                              | ginie obowiązek akceptacji                                                                                            | K                                                 |
|  52 | `acceptance_type`               | brak                                              | ginie typ akceptacji                                                                                                  | K                                                 |
|  53 | `acceptor_id`                   | brak                                              | ginie akceptujący                                                                                                     | K                                                 |
|  54 | `weight`                        | brak                                              | ginie waga                                                                                                            | K                                                 |
|  55 | `weight_reason`                 | brak                                              | ginie uzasadnienie wagi                                                                                               | K                                                 |
|  56 | `blocked_by_decision_id`        | `blockerDecisionIds[]`                            | mapowalne jako jeden element, ale wymaga jawnej reguły                                                                | ginie możliwość wielu decyzji                     |
|  57 | `blocked_at`                    | brak                                              | ginie czas blokady                                                                                                    | K                                                 |
|  58 | `custom_fields_json`            | brak                                              | giną wszystkie pola niestandardowe                                                                                    | K                                                 |
|  59 | `parent_task_id`                | brak; `dependencyTaskIds` nie oznacza rodzica     | ginie hierarchia rodzic–dziecko                                                                                       | giną zależności kanoniczne                        |
|  60 | `sort_order`                    | brak                                              | ginie kolejność                                                                                                       | K                                                 |
|  61 | `story_points`                  | brak                                              | giną story points                                                                                                     | K                                                 |
|  62 | `actual_hours`                  | brak                                              | ginie czas rzeczywisty                                                                                                | K                                                 |
|  63 | `sprint_id`                     | brak                                              | ginie sprint                                                                                                          | K                                                 |
|  64 | `idea_id`                       | brak                                              | ginie powiązanie z pomysłem                                                                                           | K                                                 |
|  65 | `notify_on_overdue`             | brak                                              | ginie preferencja powiadomienia                                                                                       | K                                                 |
|  66 | `notify_on_acceptance`          | brak                                              | ginie preferencja powiadomienia                                                                                       | K                                                 |
|  67 | `notify_on_unassigned`          | brak                                              | ginie preferencja powiadomienia                                                                                       | K                                                 |
|  68 | `notify_on_blocked`             | brak                                              | ginie preferencja powiadomienia                                                                                       | K                                                 |
|  69 | `last_overdue_notified_at`      | brak                                              | ginie ślad powiadomienia                                                                                              | K                                                 |
|  70 | `last_acceptance_notified_at`   | brak                                              | ginie ślad powiadomienia                                                                                              | K                                                 |
|  71 | `last_unassigned_notified_at`   | brak                                              | ginie ślad powiadomienia                                                                                              | K                                                 |
|  72 | `last_blocked_notified_at`      | brak                                              | ginie ślad powiadomienia                                                                                              | K                                                 |
|  73 | `source_type`                   | brak                                              | ginie typ źródła                                                                                                      | K                                                 |
|  74 | `source_id`                     | brak                                              | ginie identyfikator źródła                                                                                            | K                                                 |
|  75 | `effort_estimate_hours`         | brak                                              | ginie druga estymata wysiłku                                                                                          | K                                                 |
|  76 | `is_milestone`                  | brak; `milestoneIds` to relacje                   | ginie informacja, że zadanie jest kamieniem milowym                                                                   | giną relacje do kamieni milowych                  |
|  77 | `milestone_target_date`         | brak                                              | ginie termin kamienia milowego                                                                                        | K                                                 |
|  78 | `required_skills`               | brak                                              | giną wymagane umiejętności                                                                                            | K                                                 |
|  79 | `risks`                         | brak                                              | ginie struktura ryzyk JSONB                                                                                           | K                                                 |
|  80 | `alternatives`                  | brak                                              | ginie struktura alternatyw JSONB                                                                                      | K                                                 |
|   — | `task_comments` (osobna tabela) | brak                                              | giną wszystkie komentarze (`000_initdb_core_tables.sql:234-241` vs pełny interfejs `executionWork.ts:25-50`)          | K                                                 |

Wniosek tabeli: wybór kanonu bez rozszerzenia modelu lub jawnego archiwum traci treść **64 z 80 kolumn bez prostego odpowiednika**, a kolejne pola mają tylko częściowe lub warunkowe mapowanie. Ta liczba jest klasyfikacją tego raportu: 16 kolumn uznano za mapowalne/pośrednio zachowywalne (`id, organization_id, title, description, status, assignee_id, due_date, initiative_id, sla_due_at, completed_at, created_at, updated_at, idempotency_key, created_by, owner_id, blocked_by_decision_id`), nie obietnicą bezstratnej migracji.

## R3. Wołacze i osiągalność

Pełny grep bez `head` dał **41 trafień frontu** i **134 trafienia backendu**; surowe listy są w `day239-front-callers.txt` i `day239-back-callers.txt`. Liczby oznaczają trafienia, nie unikalne pliki ani funkcje.

Legacy: klient `src/services/api/tasks.api.ts:85-181`, drugi klient `src/services/api.ts:4673-4785,6282-6299,7072`, bezpośredni odczyt `StudioLinkModal.tsx:53`, `ExecutiveView.tsx:107`, oraz konsumenci `MyProjects.tsx:379,602` i `TaskDetailView.tsx:1900,1946`. Backend jest osiągalny przez realny montaż `Gateway.ts:474,903` → `tasks.routes.ts`; ten sam router jest też montowany pod `/api/pmo/tasks` (`Gateway.ts:1150`). Bramka `requireCanonicalExecutionWriter` jest przed handlerami (`tasks.routes.ts:67`), więc metody mutacyjne kontrolera istnieją i są podpięte, lecz każde zwykłe POST/PUT/DELETE kończy się `409` przed handlerem (`executionSpineLegacyReadOnly.middleware.ts:24-41`).

Kanon: klient zadań `runtimeApi.ts:24-46` i konsumenci Execution Hub/Work/Reports wskazani w pełnym artefakcie; główne: `ExecutionHub.tsx:88,1244`, `ExecutionWorkSurface.tsx:26`, raporty Intelligence oraz liczne kolejki My Work. Backend: `Gateway.ts:689` → `initiatives.routes.ts:155` → `initiativesExecutionRuntime.routes.ts:4229-4298`; odczyt zadań: `postgresInitiativeReader.ts:316,443`; zapis: `executionWork.ts:183-206,221-326` i pięciotabelowa jednostka pracy. Dodatkowi czytelnicy, których lista instrukcji nie wymieniała, obejmują m.in. `canonicalExecutionReadProjections.ts`, `governanceDataQualityReadModel.ts`, `reportClassificationReadModel.ts` i `ownerIndependentKpiReader.ts` — dowód w artefakcie backendowym.

Korekta tezy T4: `tasks.api.ts` nie zawiera literalnego `api/tasks`, tylko `${API_URL}/tasks` (`tasks.api.ts:86`); brak trafienia w początkowym grepie nie oznacza braku wołacza.

## R4. Zapytania rozliczeniowe i próba lokalna

Seed `scripts/dev/day204-m3-shape-seed-local.mjs` ma barierę loopback i odmowę dla każdego innego hosta (`:7-11`). Na lokalnym `cx239` utworzył 3 inicjatywy i 8 zadań: 6 inicjatywowych, 2 osobiste, wszystkie bez SLA.

Wynik `day239-reconciliation.sql`:

| Metryka lokalna                       | Wynik | Mianownik/znaczenie                                                          |
| ------------------------------------- | ----: | ---------------------------------------------------------------------------- |
| legacy total                          |     8 | wszystkie lokalne `tasks`                                                    |
| kanon total                           |     0 | lokalne `ie_aggregate_state` typu `execution_task` po seedzie, przed testami |
| tylko legacy, bez mapowania           |     8 | legacy bez wpisu MIGRATED w ledgerze                                         |
| tylko kanon, bez mapowania            |     0 | kanon bez wpisu MIGRATED w ledgerze                                          |
| obecne po obu stronach przez ledger   |     0 | przecięcie potwierdzone ledgerem                                             |
| ten sam identyfikator po obu stronach |     0 | podzbiór przecięcia                                                          |
| bez ownera                            |   4/8 | `owner_id IS NULL`                                                           |
| bez inicjatywy                        |   2/8 | `initiative_id IS NULL`                                                      |
| bez wykonawcy                         |   1/8 | `assignee_id IS NULL`                                                        |
| bez ownera i inicjatywy               |   1/8 | część wspólna                                                                |
| bez wszystkich trzech                 |   1/8 | potrójna część wspólna                                                       |
| bez co najmniej jednego z trzech      |   5/8 | suma mnogościowa                                                             |

Dry-run (bez `--write`, bez `--confirm-batch`) rozważył 1 inicjatywę i pokazał 4 zadania: `task-1a MISSING_SLA_AT`, `task-1b MISSING_OWNER`, dwa osobiste `PERSONAL_NO_INITIATIVE`. Nie zapisał nic do kanonu ani ledgerów. Plik SQL jest gotowym produktem do późniejszego uruchomienia przez uprawnionego nadzorcę; ten raport nie autoryzuje ani nie wykonuje połączenia ze stagingiem.

## DLA WŁAŚCICIELA

### Wariant A — zostawiamy stary magazyn jako jedyny

**Zyskujemy:** zachowujemy wszystkie 80 pól zadań oraz komentarze; teraz nie trzeba przenosić historycznych rekordów.
**Tracimy:** zadania nie mają obecnego mechanizmu bezpiecznego zapisu z kontrolą wersji, pełnym śladem audytowym i jednoznacznym potwierdzeniem wykonania. Trzeba ten mechanizm odbudować nad starym magazynem albo z niego zrezygnować.
**Ile danych trzeba ruszyć:** teraz zero; trzeba natomiast zmienić obowiązującą blokadę zapisu i zdecydować, co zrobić z zadaniami, które już powstały w nowym magazynie.
**Co jest nieodwracalne:** sama zmiana blokady jest odwracalna. Nieodwracalna staje się utrata nowych danych, jeśli przez okres przejściowy jeden ekran zapisuje gdzie indziej niż drugi.

### Wariant B — nowy magazyn staje się jedyny

**Zyskujemy:** jeden kontrolowany sposób zapisu, z historią zmian, kontrolą konfliktów i potwierdzeniem każdej operacji.
**Tracimy:** bez rozbudowy nowego modelu nie ma prostego miejsca dla treści 64 z 80 pól legacy ani dla komentarzy. Dotyczy to m.in. checklist, załączników, tagów, budżetu zadania, relacji KPI/RAID/roadmapa, eskalacji SLA, akceptacji, pól własnych, sprintów, czasu pracy, ryzyk i alternatyw. Historyczne daty utworzenia i zakończenia obecny proces nadpisuje.
**Ile danych trzeba ruszyć:** cudzy pomiar z 31.08 wskazywał 467 rekordów legacy, ale nie jest to liczba potwierdzona na dziś. Ten sam pomiar wskazywał, że przy rygorystycznej regule kompletności 0 z 467 przechodziło bez decyzji o uzupełnianiu braków.
**Co jest nieodwracalne:** aby cofnąć pojedynczy transfer i pozwolić później powtórzyć go pod tym samym numerem wersji, trzeba usunąć jego wpis audytowy i zdarzenie do dalszego przetwarzania. Nie da się jednocześnie zachować pełnego śladu i umożliwić identycznego ponowienia.

### Wariant C — jawnie utrzymujemy oba i je mapujemy

**Zyskujemy:** nie wymuszamy natychmiastowej utraty szerokich danych legacy; istnieje już techniczny ledger mapowań i runner z trybem próbnym.
**Tracimy:** przez cały okres przejściowy dwa ekrany mogą nadal pokazywać różne zadania. Każdy nowy zapis tylko do jednego magazynu zwiększa koszt uzgodnienia. Dochodzi stały koszt reguł synchronizacji i rozstrzygania konfliktów.
**Ile danych trzeba ruszyć:** do ustalenia po świeżym, autoryzowanym pomiarze. Historyczna podłoga to 467 zadań do sklasyfikowania; 265 bez inicjatywy było proponowanych do pozostawienia w legacy, a około 202 do rozważenia pod transfer. To plan historyczny, nie dzisiejszy stan.
**Co jest nieodwracalne:** dla każdego przenoszonego zadania obowiązuje ten sam konflikt między zachowaniem pełnego audytu a możliwością ponowienia po cofnięciu. Polityka retencji musi być wybrana przed pierwszym realnym pilotem.

### Przypisy techniczne do wariantów

- blokada legacy: `executionSpineLegacyReadOnly.middleware.ts:24-41`, montaż `tasks.routes.ts:67`;
- wymagane pola kanonu i nadpisanie daty utworzenia: `executionWork.ts:131-160`;
- nadpisanie daty zakończenia: `executionWork.ts:279-317`;
- unikalność wersji audytu/outboxu: `932_initiatives_execution_material_commands.sql:82-115`;
- cudzy pomiar: `CODEX_DAY197_MIGRACJA_E1_REPORT.md:253-259`;
- historyczne `0 z 467`: `CODEX_DAY204_MIGRACJA_E2_REPORT.md:78`.

## Tabela mianowników

|                      Liczba | Źródło                              | Mianownik / ograniczenie                                                                                                            |
| --------------------------: | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
|                     880 / 0 | własne dwa przebiegi migracji       | liczba zastosowanych migracji w świeżym / drugim przebiegu                                                                          |
|                          80 | własne `information_schema.columns` | kolumny tabeli `public.tasks` po pełnych migracjach markera                                                                         |
|                          17 | własne liczenie pól interfejsu      | pola najwyższego poziomu `ExecutionTask`; zagnieżdżone pola `blastRadius` nie są liczone osobno                                     |
|                           6 | własny schemat                      | kolumny osobnej tabeli `task_comments`                                                                                              |
|                           5 | własny log SQL                      | tabele kanoniczne dotknięte przez pojedyncze `execution.task.create`; ledger cutover jest szóstym zapisem tylko w wariancie cutover |
|                       64/80 | klasyfikacja R2                     | kolumny bez prostego odpowiednika / wszystkie kolumny legacy                                                                        |
|                    41 / 134 | pełny grep                          | trafienia wzorców front / backend, nie liczba unikalnych wołaczy                                                                    |
|              8, 0, 5/8 itd. | własna lokalna miniatura            | syntetyczna baza `cx239`, nie staging                                                                                               |
| 467, 411, 265, 49, 195, 467 | cudzy pomiar 31.08                  | legacy total; braki ownera, inicjatywy, wykonawcy, terminu, SLA; stan niezweryfikowany dziś                                         |
|                     14 / 67 | cudzy pomiar 31.08                  | aktywne domy kanoniczne / inicjatywy legacy z zadaniami; nie wiadomo dla jakich organizacji                                         |
|                       0/467 | cudzy raport dnia 204               | wynik ścisłej reguły kompletności na miniaturze o kształcie M3, nie wykonana migracja produkcyjna                                   |

## Testy i pułapki fałszywej zieleni

Przed zmianą dokumentacji uruchomiono 6 licencjonowanych plików, 20 pełnych nazw, `--retry=0`: 20 PASS, 0 FAIL, 0 SKIP (`day239-przed.json`, `przed-nazwy.txt`). Konfiguracja root wykryła wszystkie wskazane pliki; nie użyto server configu, bo ten zbiór jest zebrany przez root `vitest.config.ts`.

Po zmianie dokumentacji uruchomiono identyczną komendę: 20 PASS, 0 FAIL, 0 SKIP (`day239-po.json`, `po-nazwy.txt`). `diff przed-nazwy.txt po-nazwy.txt` ma 0 linii: żadna pełna nazwa nie została dodana ani usunięta. SHA-256 obu list nazw jest identyczne: `b33511e9707fe592140e019bb28be25c37c73634f1fef2d584a9bdb16e631952`.

Pułapki: (a) `ENABLE_V8_GLOBAL=true`, choć pakiety nie dowodzą HTTP; (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) `MOCK_DB=false DB_TYPE=postgres` i realny SQL widoczny w logu kontenera; (d) `ENABLE_TEST_AUTH_BYPASS=false`, choć pakiety nie dowodzą auth; (e) numery linii sprawdzono na markerze, a wymagania kanonu potwierdzono w `prepareExecutionTaskCreation`. `RUN_DB_TESTS=1`, jawny loopback `DATABASE_URL`, `NODE_ENV=test`, `JWT_SECRET` i `--retry=0` znajdowały się w tej samej linii polecenia. Nie twierdzę, że te testy dowodzą ścieżki HTTP przez ApiGateway — dowodzą schematu, transakcji i runnera.

## Korekty wobec instrukcji

1. Instrukcja odsyła w R6 do `§R.2` / „CZĘŚCI A” i przy licencji do `§R.1`, ale te sekcje nie istnieją w wydanym pliku. Zastosowano bezpieczny pełny format: dowody, R1–R5, mianowniki, testy, korekty i nieweryfikowalne twierdzenia.
2. Szkic mówi o „~60” kolumnach; własny pomiar po 880 migracjach daje 80.
3. Komenda T4 oczekuje trafienia `api/tasks` w `tasks.api.ts`, ale realny kod składa `${API_URL}/tasks`; funkcja jest wołaczem mimo braku literalnego wzorca.
4. `find '*legacy-task-cutover*'` zwraca 5 plików, ale licencja obejmuje 6; szósty to `day204-r1-mines.realdb.test.ts`.
5. Wariant A w instrukcji mówi „zero danych do ruszenia” i jednocześnie opisuje żywy Runtime-v1. Nie potwierdzono liczby istniejących kanonicznych zadań na realnej bazie, więc uczciwa wartość przeniesienia wstecz to `UNKNOWN`, nie zero.
6. Teza „każdy dzień dokłada nowe zadania wyłącznie do Runtime-v1” jest logiczną możliwością wynikającą z bramki, ale nie została dowiedziona pomiarem produkcyjnych zapisów. Raport nie przedstawia jej jako zmierzonego faktu.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wiadomo, ile zadań jest **dzisiaj** w którym magazynie na demo/staging/produkcji. Zakaz zdalnego dostępu był zachowany.
- Nie wiadomo, dla kogo realnie istnieje `14` domów kanonicznych z cudzego pomiaru 31.08 — w szczególności nie można uczciwie stwierdzić, czy należą tylko do organizacji syntetycznych.
- Nie wiadomo, ile komentarzy i ile niepustych wartości w 64 kategoriach bez prostego odpowiednika faktycznie istnieje na realnej bazie; tabela R2 opisuje promień możliwej utraty, nie zmierzoną objętość treści.
- Nie udowodniono w tym dyżurze ścieżki HTTP GET/POST przez podpisany JWT i ApiGateway, ponieważ zakres jest pomiarowo-dokumentacyjny, a mutacja legacy jest celowo zablokowana. Osiągalność R3 jest dowodem statycznym montażu, nie twierdzeniem „działa end-to-end”.

## Artefakty

Wszystkie znajdują się poza repo w `/private/tmp/cx-day239-realizacja-artefakty`. Kluczowe: `day239-reconciliation.sql`, `day239-tasks-schema.txt`, `day239-front-callers.txt`, `day239-back-callers.txt`, `day239-task-create-sql.log`, `day239-przed.json`, `przed-nazwy.txt`, rozjazd tipa. Końcowe sumy SHA-256 są odświeżane po przebiegu „po”.

Manifest: `/private/tmp/cx-day239-realizacja-artefakty/SHA256SUMS.txt`. Kluczowe sumy: SQL rozliczeniowy `c1b543e646892166bc9bcea97fc163e6f97c6e77949f522a15d61dc7e75ddb37`; schemat 80 kolumn `5d58c8b9f4368471c84736385c25c1eec3304bff1d89231b176d6a69bd14f792`; log transakcji zadania `efe40d3b2506de6874f962747e2b480dbd48a2847418220b2f80bded1c0ca9eb`; pusty diff nazw `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
