---
doc_id: funkcje-plan-migracji-tasks-kanon
status: canonical
owner: piotr
truth_type: design
established: 2026-08-30
---

# Plan migracji `tasks` -> kanon Runtime-v1

Werdykt: migracja jest wykonalna tylko jako kontrolowany program polecen produktowych, nie jako jednorazowy `INSERT ... SELECT`. Na markerze `18661cc6a0` nie istnieje bezstratne mapowanie 80 kolumn legacy na 16-polowy `ExecutionTask`, zadania osobiste nie maja domu kanonicznego, a utworzenie kazdego `execution_task` zmienia wersje `execution_case`. Brama 409 musi zostac; jej zdjecie przywraca legacy writer.

## A1. Inwentarz obu magazynow

Rozstrzygajacy pomiar fresh-DB:

```sql
SELECT ordinal_position,column_name,data_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='tasks'
ORDER BY ordinal_position;
-- 80 rows
```

Schemat `tasks` ma 80 kolumn. Rdzen pochodzi z `000_initdb_core_tables.sql:198`; rozszerzenia, ktore realnie weszly do fresh-DB, pochodza z `000_z_core_baseline.sql`, `060_work_dimensions.sql`, `247_initiative_enhancements.sql`, `731_tasks_missing_columns.sql`, `20260127_pmo_task_fields.sql`, `20260128_task_notification_rules.sql`, `20260128_task_overdue_notifications.sql`, `20260213_task_source_origin.sql`, `20260311_origin_tracking.sql`, `20260719_baseline_gap.sql`, `20260719_red_tasks_sla_escalation_columns.sql`, `20260801_exe002004_idempotency_keys.sql` i `20260830_day175_task_risk_alternatives.sql`. `20260719_baseline_gap.sql` byl pominiety w poprzedniej wersji tej listy — dopisany po zweryfikowaniu, ze jest realnym zrodlem 5 kolumn (patrz tabela nizej). Pliki pod `server/migrations/never-ran/` nie sa zrodlem schematu.

Atrybucja kolumna → migracja tworzaca (plik:linia), w kolejnosci ordinalnej fresh-DB. Kolejnosc uruchamiania migracji: faza NUMBERED (prefiks `NNN_`, sortowana numerycznie) zawsze przed faza DATED (prefiks `YYYYMMDD_`, sortowana po dacie, przy tej samej dacie po nazwie pliku) — `migrate.postgres.ts` (`sortMigrationsDeterministically`/`phaseAndKeyFor`). Gdy kolumne probuje utworzyc wiecej niz jedna migracja (wszystkie uzywaja `ADD COLUMN IF NOT EXISTS` albo `DO $$ ... EXCEPTION WHEN duplicate_column`), atrybucja idzie do tej, ktora uruchamia sie jako pierwsza wg tej kolejnosci; pozostale sa no-opami zweryfikowanymi w tresci pliku:

| # | Kolumna | Migracja:linia |
|---|---|---|
| 1 | id | `000_initdb_core_tables.sql:199` |
| 2 | project_id | `000_initdb_core_tables.sql:200` |
| 3 | organization_id | `000_initdb_core_tables.sql:201` |
| 4 | title | `000_initdb_core_tables.sql:202` |
| 5 | description | `000_initdb_core_tables.sql:203` |
| 6 | status | `000_initdb_core_tables.sql:204` |
| 7 | priority | `000_initdb_core_tables.sql:205` |
| 8 | assignee_id | `000_initdb_core_tables.sql:206` |
| 9 | reporter_id | `000_initdb_core_tables.sql:207` |
| 10 | due_date | `000_initdb_core_tables.sql:208` |
| 11 | estimated_hours | `000_initdb_core_tables.sql:209` |
| 12 | checklist | `000_initdb_core_tables.sql:210` |
| 13 | attachments | `000_initdb_core_tables.sql:211` |
| 14 | tags | `000_initdb_core_tables.sql:212` |
| 15 | task_type | `000_initdb_core_tables.sql:217` |
| 16 | initiative_id | `000_initdb_core_tables.sql:224` |
| 17 | why | `000_initdb_core_tables.sql:225` |
| 18 | expected_outcome | `20260801_exe002004_idempotency_keys.sql:76` |
| 19 | decision_impact | `20260801_exe002004_idempotency_keys.sql:77` |
| 20 | evidence_required | `20260801_exe002004_idempotency_keys.sql:78` |
| 21 | strategic_contribution | `20260801_exe002004_idempotency_keys.sql:79` |
| 22 | roadmap_initiative_id | `20260801_exe002004_idempotency_keys.sql:80` |
| 23 | kpi_id | `20260801_exe002004_idempotency_keys.sql:81` |
| 24 | raid_item_id | `20260801_exe002004_idempotency_keys.sql:82` |
| 25 | assignees | `20260801_exe002004_idempotency_keys.sql:83` |
| 26 | progress | `20260801_exe002004_idempotency_keys.sql:84` |
| 27 | blocked_reason | `247_initiative_enhancements.sql:96` |
| 28 | sla_hours | `20260719_red_tasks_sla_escalation_columns.sql:26` |
| 29 | sla_due_at | `20260719_red_tasks_sla_escalation_columns.sql:27` |
| 30 | escalation_level | `20260719_red_tasks_sla_escalation_columns.sql:28` |
| 31 | escalated_to_id | `20260719_red_tasks_sla_escalation_columns.sql:29` |
| 32 | last_escalated_at | `20260719_red_tasks_sla_escalation_columns.sql:30` |
| 33 | custom_status_id | `000_initdb_core_tables.sql:213` |
| 34 | step_phase | `000_initdb_core_tables.sql:223` |
| 35 | budget_allocated | `000_initdb_core_tables.sql:218` |
| 36 | budget_spent | `000_initdb_core_tables.sql:219` |
| 37 | risk_rating | `000_initdb_core_tables.sql:220` |
| 38 | acceptance_criteria | `000_initdb_core_tables.sql:221` |
| 39 | blocking_issues | `000_initdb_core_tables.sql:222` |
| 40 | completed_at | `000_initdb_core_tables.sql:216` |
| 41 | created_at | `000_initdb_core_tables.sql:214` |
| 42 | updated_at | `000_initdb_core_tables.sql:215` |
| 43 | idempotency_key | `20260801_exe002004_idempotency_keys.sql:69` |
| 44 | created_by | `20260801_exe002004_idempotency_keys.sql:70` |
| 45 | started_at | `20260127_pmo_task_fields.sql:5` |
| 46 | backup_assignee_id | `20260127_pmo_task_fields.sql:14` |
| 47 | list_id | `731_tasks_missing_columns.sql:3` |
| 48 | workstream_id | `731_tasks_missing_columns.sql:4` |
| 49 | source | `20260213_task_source_origin.sql:2` |
| 50 | owner_id | `20260127_pmo_task_fields.sql:6` |
| 51 | requires_acceptance | `20260127_pmo_task_fields.sql:9` |
| 52 | acceptance_type | `20260127_pmo_task_fields.sql:10` |
| 53 | acceptor_id | `20260127_pmo_task_fields.sql:11` |
| 54 | weight | `20260127_pmo_task_fields.sql:17` |
| 55 | weight_reason | `20260127_pmo_task_fields.sql:18` |
| 56 | blocked_by_decision_id | `247_initiative_enhancements.sql:94` |
| 57 | blocked_at | `247_initiative_enhancements.sql:95` |
| 58 | custom_fields_json | `20260719_baseline_gap.sql:13581` |
| 59 | parent_task_id | `731_tasks_missing_columns.sql:5` |
| 60 | sort_order | `731_tasks_missing_columns.sql:6` |
| 61 | story_points | `731_tasks_missing_columns.sql:7` |
| 62 | actual_hours | `731_tasks_missing_columns.sql:8` |
| 63 | sprint_id | `731_tasks_missing_columns.sql:9` |
| 64 | idea_id | `731_tasks_missing_columns.sql:10` |
| 65 | notify_on_overdue | `20260128_task_notification_rules.sql:4` |
| 66 | notify_on_acceptance | `20260128_task_notification_rules.sql:5` |
| 67 | notify_on_unassigned | `20260128_task_notification_rules.sql:6` |
| 68 | notify_on_blocked | `20260128_task_notification_rules.sql:7` |
| 69 | last_overdue_notified_at | `20260128_task_notification_rules.sql:9` |
| 70 | last_acceptance_notified_at | `20260128_task_notification_rules.sql:10` |
| 71 | last_unassigned_notified_at | `20260128_task_notification_rules.sql:11` |
| 72 | last_blocked_notified_at | `20260128_task_notification_rules.sql:12` |
| 73 | source_type | `20260311_origin_tracking.sql:7` |
| 74 | source_id | `20260311_origin_tracking.sql:8` |
| 75 | effort_estimate_hours | `20260719_baseline_gap.sql:13583` |
| 76 | is_milestone | `20260719_baseline_gap.sql:13585` |
| 77 | milestone_target_date | `20260719_baseline_gap.sql:13587` |
| 78 | required_skills | `20260719_baseline_gap.sql:13589` |
| 79 | risks | `20260830_day175_task_risk_alternatives.sql:3` |
| 80 | alternatives | `20260830_day175_task_risk_alternatives.sql:4` |

Rozliczenie zrodel: 27/80 kolumn z `000_initdb_core_tables.sql` (CREATE TABLE, faza NUMBERED, linie 199-225); 11/80 z pozostalych migracji NUMBERED (`247_initiative_enhancements.sql` 3, `731_tasks_missing_columns.sql` 8); 42/80 z migracji DATED (`20260127_pmo_task_fields.sql` 8, `20260128_task_notification_rules.sql` 8, `20260213_task_source_origin.sql` 1, `20260311_origin_tracking.sql` 2, `20260719_baseline_gap.sql` 5, `20260719_red_tasks_sla_escalation_columns.sql` 5, `20260801_exe002004_idempotency_keys.sql` 11, `20260830_day175_task_risk_alternatives.sql` 2). Suma 27+11+42=80, zgodnie z pomiarem SQL powyzej. `20260128_task_overdue_notifications.sql:5` i wiekszosc z 15 powtorzonych `ADD COLUMN IF NOT EXISTS` w `20260801_exe002004_idempotency_keys.sql:85-99` sa zweryfikowanymi no-opami (kolumna juz istnieje z wczesniejszej migracji) — nie sa w tabeli jako zrodlo.

Boczna obserwacja poza zakresem FIX-184 (nie rozwiazana, nie wchodzi do listy 80 kolumn powyzej — ta lista jest przybita realnym pomiarem SQL wlasciciela): `060_work_dimensions.sql:198` bezwarunkowo (bez `IF NOT EXISTS`) dodaje `tasks.facility_id`, ktorej NIE MA w 80-kolumnowym pomiarze fresh-DB. Brak DROP w calym `server/migrations` (zweryfikowane grepem). Przyczyna nieobecnosci tej kolumny w schemacie jest `NOT_PROVEN` i nie byla dalej scigana — dopisane do sekcji TWIERDZENIA NIEZWERYFIKOWANE odpowiedniego raportu.

Kanon material-command z migracji 932 obejmuje `ie_aggregate_state`, `ie_command_receipts`, `ie_audit_events`, `ie_outbox_events`, `ie_aggregate_relations`; ta sama migracja tworzy tez szosta tabele `ie_governance_policies`. Kazdy zapis materialny ma w jednej transakcji stan, receipt, audit i outbox; relacje sa osobnym elementem. `935_plan_scenario_time_basis.sql` dodaje walidacje payloadu, a `20261110_initiatives_day21_list_keyset_index.sql` indeks listy. Produkcyjny pisarz jest jeden: `postgresMaterialCommandUnitOfWork.ts:287,295`.

Typy zwiazane z praca: `execution_task` (zadanie wykonawcze), `execution_decision`, `execution_milestone`, `execution_case`, `task` (remediation Definition; nie jest synonimem `execution_task`), `decision`, `raid_item`, `raid_mitigation`, `operational_allocation`, `manager_execution_action`. Grep wszystkich literałów wykazal ponadto typy inicjatyw, KPI, OKR, finansow, raportow i governance; komenda odtwarzajaca:

```bash
rg -o --no-filename "aggregateType: '[^']+'|aggregate_type\\s*=\\s*'[^']+'" server/src server/migrations \
  --glob '*.ts' --glob '*.sql' --glob '!server/src/_backup/**' --glob '!server/migrations/never-ran/**' | sort -u
```

`ExecutionTask` (`executionWork.ts:23-47`) ma: `taskId, executionCaseId, initiativeId, title, description, status, assigneeId, ownerId, dueAt, slaAt, evidenceRefs, blockerDecisionIds, dependencyTaskIds, milestoneIds?, blastRadius?, createdAt, completedAt`. `blastRadius` niesie milestone/version/status/readiness/forecastVarianceDays/sourceVersions.

## A2. Pisarze i czytelnicy

Powtarzalny inwentarz liniowy:

```bash
grep -rn "INSERT INTO tasks" --include='*.ts' server/src/ | grep -v '/dist/' | grep -v '_backup' | wc -l   # 35
grep -rn "UPDATE tasks" --include='*.ts' server/src/ | grep -v '/dist/' | grep -v '_backup' | wc -l       # 68
grep -rn "DELETE FROM tasks" --include='*.ts' server/src/ | grep -v '/dist/' | grep -v '_backup' | wc -l # 18
grep -rn "FROM tasks" --include='*.ts' server/src/ | grep -v '/dist/' | grep -v '_backup' | wc -l        # 322
grep -rn "INSERT INTO ie_aggregate_state" --include='*.ts' server/src/ | grep -v '/dist/' | wc -l          # 9
grep -rn "UPDATE ie_aggregate_state" --include='*.ts' server/src/ | grep -v '/dist/' | wc -l              # 1
grep -rn "FROM ie_aggregate_state" --include='*.ts' server/src/ | grep -v '/dist/' | wc -l               # 89
grep -rn "INSERT INTO tasks\|UPDATE tasks\|DELETE FROM tasks" --include='*.ts' server/src/ \
 | grep -v '/dist/' | grep -v '_backup' | cut -d: -f1 | sort -u | wc -l                                  # 52
```

Klasyfikacja plikow z mutacjami `tasks`: kod produkcyjny skupia sie w `controllers/{Task,Initiative,Decision,Interview}Controller.ts`, `services/{TaskService,InterviewAssignmentService,taskAssignmentService,automationRulesService,blueprintService,inboxTriageService,initiativeGovernanceService,notebookConversionService,aiActionExecutor}.ts`, `services/ai/tools/createTask.ts`, `services/chatHandoff/chatHandoffService.ts`, trasach `my-work.routes.ts`, `executionControl.routes.ts`, `feedback.routes.ts`, `pmo/{tasks,initiatives}.routes.ts`, `v8/{execution-control,interview-insights,my-work,results}.routes.ts`, integracjach i cronach. Testy i skrypty dowodowe sa oddzielnymi trafieniami; `_backup` nie dal trafien i nie jest produktem.

Za brama 409 sa wszystkie 24 mutujace trasy routera `pmo/tasks.routes.ts` (`router.use(requireCanonicalExecutionWriter)` na `tasks.routes.ts:67`, przed kazda rejestracja trasy), pod obiema bazami `/api/tasks` i `/api/pmo/tasks`. Ten sam middleware jest zamontowany tez w `Gateway.ts:1389` (`/api/execution-control`), `Gateway.ts:1454` (`/api/v8/execution-control/manager`), `v8/index.ts:107` (`/api/v8/execution-control`) i przez `requireCanonicalInitiativeExecutionWriter` w `pmo/initiatives.routes.ts:160` (waski zestaw legacy tras inicjatyw execution-work, read-only od Runtime-v1). GET/HEAD/OPTIONS przechodza zawsze (`executionSpineLegacyReadOnly.middleware.ts:30-34`); jedyny wyjatek mutacyjny w calym kodzie to `DELETE /budget/entries/:id` (tam samo, `:11`) — sciezka, ktorej nie ma w `pmo/tasks.routes.ts`, wiec nie zwalnia zadnej z 24 tras ponizej z bramy.

Wszystkie 24 mutujace trasy `pmo/tasks.routes.ts` (POST/PUT/DELETE), w kolejnosci wystapienia w pliku:

| Plik:linia | Metoda + sciezka | Co robi | Za/poza brama |
|---|---|---|---|
| `tasks.routes.ts:90` | POST / | utworzenie zadania (`TaskController.createTask`, capability `task.create`) | ZA |
| `tasks.routes.ts:122` | POST /:id/sections/:sectionKey/generate | generowanie sekcji zadania (`TaskController.generateSection`) | ZA |
| `tasks.routes.ts:166` | POST /custom-fields | utworzenie definicji pola niestandardowego (`task_custom_field_schemas`) | ZA |
| `tasks.routes.ts:218` | PUT /custom-fields/:fieldId | aktualizacja definicji pola niestandardowego | ZA |
| `tasks.routes.ts:291` | DELETE /custom-fields/:fieldId | dezaktywacja (soft-delete) pola niestandardowego | ZA |
| `tasks.routes.ts:323` | POST /baseline-snapshots | snapshot bazowy zadan inicjatywy/projektu (`task_baseline_snapshots`) | ZA |
| `tasks.routes.ts:959` | POST /time-entries | wpis czasu pracy + upsert alokacji (`time_entries`, `task_allocations`) | ZA |
| `tasks.routes.ts:1065` | POST /allocations | utworzenie/aktualizacja alokacji zadania (`task_allocations`) | ZA |
| `tasks.routes.ts:1154` | PUT /:id | aktualizacja zadania (`TaskController.updateTask`, capability `task.update`) | ZA |
| `tasks.routes.ts:1166` | DELETE /:id | usuniecie zadania (`TaskController.deleteTask`, capability `task.delete`) | ZA |
| `tasks.routes.ts:1187` | POST /:taskId/comments | dodanie komentarza | ZA |
| `tasks.routes.ts:1198` | DELETE /:taskId/comments/:commentId | usuniecie komentarza | ZA |
| `tasks.routes.ts:1208` | POST /:id/assign | przypisanie zadania (capability `task.assign`) | ZA |
| `tasks.routes.ts:1220` | POST /:id/reassign | zmiana przypisania (capability `task.reassign`) | ZA |
| `tasks.routes.ts:1232` | POST /:id/unassign | usuniecie przypisania (capability `task.unassign`) | ZA |
| `tasks.routes.ts:1243` | POST /:id/escalate | eskalacja zadania | ZA |
| `tasks.routes.ts:1254` | POST /:taskId/escalations/:escalationId/resolve | rozwiazanie eskalacji | ZA |
| `tasks.routes.ts:1303` | POST /:id/block | blokada zadania (capability `task.status.update`) | ZA |
| `tasks.routes.ts:1315` | POST /:id/unblock | odblokowanie zadania | ZA |
| `tasks.routes.ts:1326` | POST /:id/move | przeniesienie zadania | ZA |
| `tasks.routes.ts:1339` | PUT /:id/risk-alternatives | zapis ryzyk/alternatyw (`risks`, `alternatives`) | ZA |
| `tasks.routes.ts:1356` | POST /:id/dependencies | dodanie zaleznosci | ZA |
| `tasks.routes.ts:1362` | DELETE /:id/dependencies/:depId | usuniecie zaleznosci | ZA |
| `tasks.routes.ts:1368` | POST /:id/milestone | ustawienie `is_milestone`/`milestone_target_date` | ZA |

Wszystkie 24 sa ZA brama — zaden z nich nie pasuje do jedynego wyjatku (`DELETE /budget/entries/:id`), a middleware na `:67` obejmuje caly router bez wyjatku dla konkretnych podtras.

Poza brama sa pisarze wywolywani z pozostalych routerow, w tym potwierdzony historycznie `POST /api/my-work/personal-tasks`; statycznie widoczne sa tez trasy feedback, automations/webhooks, calendar, interview, results i uslugi/AI. Dokladna liczba osiagalnych dróg produkcyjnych poza brama pozostaje `NOT_PROVEN`: klasyfikacja wymaga przejscia kazdego call-site przez montaz `Gateway`, a Day160 nie uruchomil sie z powodu przypietej nazwy bazy. To oznacza, ze jednorazowa migracja bez najpierw zamkniecia/przepisania wszystkich writerow jest niewystarczajaca.

Czytelnicy kanonu produkcyjni: `postgresInitiativeReader.ts`, `postgresMaterialCommandUnitOfWork.ts`, `executionBvpService.ts` oraz `services/executionControl/{canonicalExecutionReadProjections,governanceDataQualityReadModel,ownerIndependentKpiReader,reportClassificationReadModel}.ts`. Czytelnikow legacy jest 103 pliki wg `rg -l 'FROM tasks'` (86 produkcyjnych, 16 testowych, 1 skrypt).

## A3. Mapowanie pol

| Kolumna `tasks` | Pole kanonu | Uwagi / utrata |
|---|---|---|
| id | taskId / aggregateId | deterministycznie zachowac |
| organization_id | envelope.organizationId | wymagane, nie payload |
| initiative_id | initiativeId | NULL = brak domu |
| title | title | wymagane, trim != empty |
| description | description | NULL -> pusty string tylko po decyzji |
| status | status | kanon wylicza przy create; mapowanie `todo/in_progress/done` wymaga polityki |
| assignee_id | assigneeId | wymagane, NULL niekwalifikowalne |
| owner_id | ownerId | wymagane; fallback do reporter/created_by wymaga decyzji |
| due_date | dueAt | parsowalne, wymagane |
| sla_due_at | slaAt | tekst legacy; parsowalne, wymagane |
| attachments, evidence_required | evidenceRefs | tylko po jawnej normalizacji do referencji governance |
| blocked_by_decision_id | blockerDecisionIds | pojedyncze -> tablica; reszta blokad nie mapuje sie automatycznie |
| parent_task_id | dependencyTaskIds | semantyka parent != dependency; nie kopiowac bez decyzji |
| completed_at | completedAt | create ustawia NULL; wymaga osobnego polecenia transition |
| created_at | createdAt | create ustawia teraz; zachowanie historii wymaga rozszerzenia commandu |
| is_milestone, milestone_target_date | milestoneIds / blastRadius | nie sa to te same dane; brak bezposredniego mapowania |

Pola bez odpowiednika (decyzja wlasciciela): `project_id, priority, reporter_id, estimated_hours, checklist, tags, task_type, why, expected_outcome, decision_impact, strategic_contribution, roadmap_initiative_id, kpi_id, raid_item_id, assignees, progress, blocked_reason, sla_hours, escalation_level, escalated_to_id, last_escalated_at, custom_status_id, step_phase, budget_allocated, budget_spent, risk_rating, acceptance_criteria, blocking_issues, updated_at, idempotency_key, created_by, started_at, backup_assignee_id, list_id, workstream_id, source, requires_acceptance, acceptance_type, acceptor_id, weight, weight_reason, blocked_at, custom_fields_json, sort_order, story_points, actual_hours, sprint_id, idea_id, cztery flagi notify, cztery znaczniki last_*_notified_at, source_type, source_id, effort_estimate_hours, required_skills, risks, alternatives`. `attachments` i `evidence_required` sa mapowalne tylko warunkowo; nie sa uznane za zachowane bez walidacji.

Wymagane w kanonie bez pewnego zrodla: `executionCaseId` (wyszukac aktywna sprawe po org+initiative), `initiativeId`, `assigneeId`, `ownerId`, `dueAt`, `slaAt`. Na syntetycznej bazie 2 wiersze: 1 bez initiative/personal/due/sla; drugi ma initiative, ale 0 aktywnych spraw. Kwalifikowalne bez przygotowania: 0/2. Zakres MVP: tylko nie-personal, z initiative, aktywna sprawa, assignee+owner i parsowalne due+sla; reszta do jawnego rejestru pominiec, bez zgadywania fallbackow.

### `risks` / `alternatives` — mechanizm i miejsce w kanonie

Jedyny pisarz: `TaskController.updateTaskRiskAlternatives` (`TaskController.ts:3058-3089`), SQL `UPDATE tasks SET risks = CAST(? AS JSONB), alternatives = CAST(? AS JSONB) ...` (`TaskController.ts:3071`). Trasa: `PUT /:id/risk-alternatives` (`pmo/tasks.routes.ts:1339-1344`, `requireAudit` + `validateBody(UpdateTaskSchema)`), zamontowana ZA brama — `router.use(requireCanonicalExecutionWriter)` na `tasks.routes.ts:67` poprzedza wszystkie trasy tego routera. Skutek: od zamkniecia bramy ta trasa zwraca 409 na kazde wywolanie; kolumny `risks`/`alternatives` sa dzis w praktyce puste/niemodyfikowalne przez produkcyjne UI.

Kanon `ExecutionTask` (`executionWork.ts:23-48`) nie ma dzis pola na ryzyka/alternatywy. Dwie opcje miejsca:

- **Pola w payloadzie `ExecutionTask`** — `risks?`/`alternatives?` wprost w agregacie zadania; kazda zmiana wymaga nowej komendy material-command (np. `execution.task.risk-alternatives.update`) i inkrementacji wersji `execution_task` przy kazdej edycji ryzyk, analogicznie do wzorca `caseAndRollup` (`executionWork.ts:78-117`), ktory dzis inkrementuje wersje `execution_case` przy kazdym create zadania.
- **Sidecar-agregat** (np. `aggregateType='execution_task_risk_register'`, kluczowany po `taskId`, powiazany relacja) — zgodny z juz istniejacym wzorcem relacji `EXECUTION_CASE_TASK:${task.taskId}` (`executionWork.ts:167-176`, `tx.claimRelation`); nie zmienia ksztaltu `ExecutionTask` ani jego czytelnikow (`postgresInitiativeReader.ts`, `services/executionControl/canonicalExecutionReadProjections.ts` i in.), wersjonuje ryzyka niezaleznie od reszty zadania.

Rekomendacja: sidecar-agregat — mniejszy promien wybuchu (zero zmian w istniejacych czytelnikach kanonu i w szeroko uzywanym ksztalcie `ExecutionTask`), zgodny z istniejacym w tym samym pliku wzorcem relacji.

## A4.0. Budowa domu kanonicznego (geneza `execution_case`)

Jedyna geneza `execution_case` w kodzie produkcyjnym: `handoffAcceptance.ts:245-251`, wewnatrz `decideHandoffAcceptance` (`commandType='initiative.handoff.decide'`). Zadnego innego wolania `persistRelatedAggregate(..., 'execution_case', ...)` nie ma w `server/src/domain/initiatives-execution` (zweryfikowane grepem po calym katalogu). Kazde polecenie ponizej biegnie przez `executeMaterialCommand`, ktore w jednej transakcji zawsze zapisuje agregat, audit, outbox i receipt (`materialCommand.ts:518,526,539,560`: `persistAggregate` → `appendAudit` → `appendOutbox` → `saveReceipt`). Zweryfikowany lancuch poleceń per inicjatywa:

1. `initiative.register` — rejestracja inicjatywy (`registerInitiative.ts:84`), aggregateType `initiative`.
2. `initiative.schedule.request` — wniosek o harmonogram (`scheduleDecision.ts:187`).
3. `initiative.schedule.decide` z outcome `APPROVED`/`CONDITIONALLY_APPROVED` (`scheduleDecision.ts:275`) — przy zatwierdzeniu tworzy `handoff_package` (`scheduleDecision.ts:372-378`, wersja 0→1) i ustawia inicjatywe na `SCHEDULED`.
4. `initiative.handoff.request` — wniosek o przyjecie handoffu (`handoffAcceptance.ts:64`) — tworzy `decision` w stanie `PENDING`, juz z przydzielonym `executionCaseId` w payloadzie (`handoffAcceptance.ts:135`, wersja 0→1).
5. `initiative.handoff.decide` z outcome != `RETURN_WITH_BLOCKERS` (`handoffAcceptance.ts:155`) — wymaga inicjatywy w stanie `SCHEDULED` i autorytetu Execution Managera zgodnego z `decision.authorityId`; tworzy `execution_case` (`handoffAcceptance.ts:245-251`, wersja 0→1, `state:'ACTIVE'`) i przestawia inicjatywe na `lifecycleState:'IN_EXECUTION'`, `executionState:'ACTIVE'`.

Migracja zadania z legacy `tasks` do kanonu wymaga wiec NAJPIERW, zeby docelowa inicjatywa przeszla caly powyzszy lancuch (5 komend, 5 transakcji z audit+outbox+receipt kazda). To nie jest praca migracji danych — to warunek wstepny po stronie produktowej/operacyjnej, ktory moze w ogole nie byc spelniony dla wielu inicjatyw z zadaniami legacy.

Pierwszy krok dyzuru wykonania: pomiar denominatora PRZED jakimkolwiek zapisem, wynik idzie do wlasciciela PRZED startem wykonania.

```sql
-- aktywne sprawy kanoniczne (execution_case, stan ACTIVE)
SELECT count(*) AS active_execution_cases
FROM ie_aggregate_state
WHERE aggregate_type = 'execution_case'
  AND payload_json->>'state' = 'ACTIVE';

-- inicjatywy legacy z co najmniej jednym zadaniem
SELECT count(DISTINCT initiative_id) AS legacy_initiatives_with_tasks
FROM tasks
WHERE initiative_id IS NOT NULL;
```

Roznica miedzy tymi dwiema liczbami to inicjatywy z zadaniami legacy, ktore NIE maja jeszcze domu kanonicznego — ich zadania nie maja dokad trafic bez uprzedniego przeprowadzenia lancucha powyzej. Zgodnie z odkryciem odbioru 184 ("koszt D-7 moze byc zanizony o rzad wielkosci") ten pomiar, nie kod migracji, jest pierwszym artefaktem dyzuru wykonania.

## A4. Projekt migracji addytywnej

Wybor: wyłącznie `executeMaterialCommand` i `createExecutionTask`, partiami. Surowy SQL do `ie_aggregate_state` jest odrzucony, bo omija receipt, audit, outbox, CAS i relation claim.

Koperta: `organizationId` z wiersza; `actorId` = dedykowane, istniejace konto systemowe migracji zatwierdzone przez wlasciciela (nie podszywac sie pod autora); `aggregateType=execution_task`; `aggregateId=legacy task id` albo namespaced deterministycznie; `expectedVersion=0`; `clientRequestId=tasks-canonical-v1:<org>:<legacy-id>`; `correlationId=tasks-cutover:<batch-id>`; `policyId=execution-work`, `policyVersion=1`; `commandType=execution.task.create`; `createIfMissing=true`; **`expectedCaseVersion`** (wymagane pole payloadu — `createExecutionTask` przyjmuje `Omit<ExecutionTask, 'taskId'|'status'|'createdAt'|'completedAt'> & { expectedCaseVersion: number }`, `executionWork.ts:126-129`; bez tego pola walidacja rzuca przed zapisem, `executionWork.ts:140-148`). Aktor systemowy jest propozycja, nie potwierdzonym kontraktem.

Algorytm: (1) zamrozic lub przekierowac wszystkie writery poza brama; (2) snapshot denominatora; (3) rozstrzygnac brakujace pola i domy; (4) grupowac per `execution_case`; (5) w transakcji pobrac aktualna wersje case, wywolac jedno polecenie, odczytac receipt+task+case; (6) szeregowo kontynuowac per case, rownolegle tylko miedzy sprawami; (7) checkpoint po kazdym wierszu. Replay tego samego requestu musi zwrocic `REPLAYED`; inny fingerprint pod tym ID to konflikt i STOP pozycji.

To nie powinna byc migracja DDL. Runner SQL nie moze wywolac domenowego command handlera. Potrzebny jest osobny, jednorazowy runner aplikacyjny po pelnych migracjach, z default OFF i jawnym confirmem; DDL rejestru cutover ma klucz `20261721_`, czyli po zmierzonym maksimum fazy DATED `20261720_day131_teresa_knowledge_boundaries.sql`, oraz musi przejsc naming validator i fresh gate. `tasks.risks` wolno czytac dopiero po migracji Day175; fazowy sorter uruchamia wszystkie `NNN_` przed `YYYYMMDD_`.

Rozliczenie: trwały `legacy_task_cutover_ledger` (org, legacy_task_id, batch_id, status, reason_code, client_request_id, canonical_id, case_version_before/after, timestamps, checksum), unikalny po org+legacy id. Kontrole:

```sql
SELECT count(*) FROM tasks;
SELECT reason_code,count(*) FROM legacy_task_cutover_ledger WHERE batch_id=$1 GROUP BY reason_code;
SELECT count(*) FROM legacy_task_cutover_ledger WHERE batch_id=$1 AND status='MIGRATED';
SELECT count(*) FROM tasks t LEFT JOIN legacy_task_cutover_ledger l
 ON l.organization_id=t.organization_id AND l.legacy_task_id=t.id AND l.batch_id=$1
 WHERE l.legacy_task_id IS NULL;
-- warunek: total = MIGRATED + SKIPPED + FAILED; unmatched = 0
```

## A5. Los bramy 409

Nie zdejmowac. Docelowo pozostawic jako tombstone kompatybilnosci albo przepisac stare trasy na polecenia kanoniczne pod tym samym middleware. Zdjecie middleware reaktywuje legacy. Warunki cutover: 100% denominatora rozliczone, wszystkie writery poza brama zamkniete/przekierowane, consumer readback po kanonie, brak wzrostu `tasks` w oknie obserwacji i komunikaty UI dla 409. Ciche zaleznosci UI do osobnej pracy: `InitiativeTasksTab.tsx`, `dashboard/UserTaskList.tsx`; uczciwy wzorzec: `useActionHandler.ts`.

Biezacy pomiar: 24 mutujace trasy `pmo/tasks.routes.ts`, +1 wobec 23 z odbioru 160; „22” oznaczalo stare 22 pliki, nie operacje. Dzis grep daje 52 pliki mutujace (wliczajac testy/skrypty) i 35/68/18 linii INSERT/UPDATE/DELETE; nie wolno porownywac tych roznych denominatorow jak jednej liczby.

### Jedyny potwierdzony pisarz poza brama: `POST /api/my-work/personal-tasks` — warianty

Zweryfikowane: trasa montowana w `Gateway.ts:1036` (`app.use('/api/my-work', myWorkRoutes)`) BEZ `requireCanonicalExecutionWriter` ani zadnego innego gate middleware. `POST /personal-tasks` (`my-work.routes.ts:1283`) pisze wprost `INSERT INTO tasks` (`my-work.routes.ts:1379`). Trzy warianty domkniecia tej luki:

| Wariant | Koszt (rzad) | Skutek dla bramy | Rekomendacja |
|---|---|---|---|
| (i) Osobny dom/typ agregatu `personal` (np. `aggregateType='personal_task'`, bez initiative/execution_case) | tygodnie — nowy command handler create/update/delete, nowy payload+audit+outbox+receipt, nowy read-model dla My Work, migracja danych osobnych (`tasks WHERE initiative_id IS NULL`) | brama musi objac `/api/my-work/personal-tasks` nowym mountem, analogicznym do `Gateway.ts:1389` | NIE jako pierwszy krok — najdrozszy wariant, uzasadniony tylko przy duzym wolumenie/wadze personal tasks |
| (ii) Zadania osobiste trwale w legacy + zawezenie migracji do zadan z `initiative_id` | dni — zero nowego typu agregatu; A3 juz definiuje zakres MVP jako „tylko nie-personal, z initiative"; trzeba jedynie formalnie zamrozic ten wyjatek | brama nadal NIE obejmuje `/api/my-work/personal-tasks` (status quo, ale swiadomie zaakceptowany, nie przeoczony) | TAK — najtansza opcja, zgodna z juz przyjetym zakresem MVP (A3) |
| (iii) Rozszerzenie kanonu o zadania bez sprawy (`executionCaseId` opcjonalny) | tygodnie-miesiac — zmiana kontraktu `ExecutionTask` (`executionWork.ts:23-48`) i jego walidacji tworzacej, ktora dzis wymaga `p.executionCaseId` (`executionWork.ts:140-141`), plus zmiana wszystkich czytelnikow kanonu (`postgresInitiativeReader.ts`, `services/executionControl/canonicalExecutionReadProjections.ts` i in.) | pozwala docelowo zamknac brame rowniez dla personal-tasks, ale dopiero po przebudowie kontraktu | NIE teraz — zbyt inwazyjne na zakres FIX-184; do rozwazenia jako osobny program, jesli pomiar uzasadni |

Rekomendacja: wariant (ii), chyba ze pomiar denominatora (A4.0) pokaze wolumen/znaczenie personal-tasks na tyle duze, ze uzasadnia koszt wariantu (i). Zaden z trzech wariantow nie jest wykonany w tym dyzurze — to analiza, nie decyzja.

## A6. Ryzyka i odwrot

| Ryzyko | Objaw | Detekcja | Reakcja |
|---|---|---|---|
| podwojny zapis | duplikat lub rozjazd | porownanie ledger/receipt/tasks po legacy id | najpierw zamknac writery; deterministyczny request ID |
| konflikt wersji case | 409/validation i czesciowa partia | FAILED reason + current case version | szeregowo per case, odswiezyc wersje, bez losowego retry |
| osierocone dane | task bez case/initiative | left join do aktywnego execution_case | SKIPPED z reason; decyzja wlasciciela |
| utrata 60+ pol | brak ryzyk/SLA/acceptance | checksum mapowania i lista non-null bez odpowiednika | rozszerzyc payload/sidecar przed cutover |
| writer poza brama | `tasks` rosnie po snapshot | count/max(created_at) w oknie | przekierowac lub zablokowac przed migracja |
| replay mismatch | konflikt receipt | receipt fingerprint | nie zmieniac payloadu pod tym samym request ID |
| cichy UI 409 | okno znika/brak komunikatu | e2e per consumer | osobny fix UI przed finalnym cutover |

Destrukcyjny rollback jest odrzucony. Usuniecie samego agregatu zostawia audit/outbox/receipt/relation i blokuje ponowne wersje; sprzatanie ich niszczy niezmienny dziennik. Strategia to `forward repair`: male partie, checkpoint po kazdym wierszu, brak usuwania udanych agregatow, korekta kolejnym poleceniem. Przed startem wymagany backup lokalny/operacyjny i dry-run denominatora; po pierwszym commicie produkcyjnym odwrot oznacza zatrzymanie kolejnych partii, nie kasowanie historii.

## A7. Pomiar lokalny

Fresh-DB: log `day161-fresh-migration-gate.log:6` = `Applying migrations: 870`, `day161-fresh-migration-gate.log:877` = `✅ Postgres migrations complete`. Replay: log `day161-fresh-migration-gate-replay.log` = `Applying migrations: 0` + `✅ Postgres migrations complete`. Napis `DAY161_FRESH_MIGRATION_GATE=PASS` nie wystepuje w zadnym z tych dwoch logow (zweryfikowane grepem) — usuniety jako niepodparty; oba logi lezaly w `/private/tmp/cx-day184-analiza-migracji-artefakty/`. Seed: 1 org, 1 user, 1 ACTIVE member, 1 project, 8 flags; sam seed tworzy 0 tasks/agregatow. Dwa wiersze legacy dodano jawnie jako syntetyczne, nie zastane: 2 total, 1 personal/no initiative/no due/no sla, 1 z initiative lecz bez active case. Migracji danych nie wykonano.

Realny replay Day160 jest `NOT_PROVEN`: beforeAll asertuje twardo bazę `cx160`, a afterAll zapisuje do `/private/tmp/cx-day160...`; na bazie dyzuru wszystkie 3 testy zostaly skipped. Nie obchodzono tego straznika. Przed dyzurem wykonania trzeba naprawic test zgodnie z Z31 i ponowic realny ApiGateway/JWT/PG readback.

## A8. Wykonanie — etap 1 (Day197)

R1: M1 na fresh-DB + Case Workspace seed dał 0 aktywnych `execution_case` i 0
inicjatyw legacy z zadaniami. M2 nie dostarczył denominatora: aktualny
`db:seed:demo:contract` narusza `initiatives_status_check` wartością `completed`
i kończy się przed utworzeniem zadań. M3 nie został uruchomiony, ponieważ Z28
zabrania dostępu do demo/staging/produkcji; pozostawiono paczkę read-only dla
nadzorcy lub właściciela. Etap 2 pozostaje zależny od realnego M3 oraz decyzji
o koncie systemowym migracji.

R2a: addytywny `legacy_task_cutover_ledger` powstał w migracji `20261721_`.
Fresh gate zastosował 871 migracji, replay zastosował 0 i zakończył się
`DAY161_FRESH_MIGRATION_GATE=PASS`. Walidator nazw utrzymał 92 zastane problemy
(92 przed i 92 po); nowy plik nie zwiększył długu.

R2b: **STOP MERYTORYCZNY**. Pięć poleceń opisanych w A4.0 nie tworzy
przechodniego łańcucha: `initiative.register` zapisuje `REGISTERED_DRAFT`, a
bezpośrednie `initiative.schedule.request` wymaga `APPROVED_BACKLOG`. Realny
kontrakt PostgreSQL Day197 potwierdza ten błąd. Brakujące przejścia obejmują
co najmniej proces prowadzący do decyzji portfelowej; nie wolno ich zastąpić
surowym UPDATE ani seedem agregatu. Dlatego nie utworzono pilotażowego zadania,
nie powstał runner zapisujący i D1-D4 pozostają `NOT_PROVEN`.

R3: masowe przenoszenie nie zostało uruchomione, brama 409 pozostała bez zmian.
Gotowość do etapu 2: ledger i fresh gate są gotowe; niegotowe są realny M3,
pełny licencjonowany łańcuch lifecycle, konto systemowe oraz pilot D1-D4.
