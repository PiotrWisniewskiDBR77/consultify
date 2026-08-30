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

Schemat `tasks` ma 80 kolumn. Rdzen pochodzi z `000_initdb_core_tables.sql:198`; rozszerzenia, ktore realnie weszly do fresh-DB, pochodza z `000_z_core_baseline.sql`, `060_work_dimensions.sql`, `247_initiative_enhancements.sql`, `731_tasks_missing_columns.sql`, `20260127_pmo_task_fields.sql`, `20260128_task_notification_rules.sql`, `20260128_task_overdue_notifications.sql`, `20260213_task_source_origin.sql`, `20260311_origin_tracking.sql`, `20260719_red_tasks_sla_escalation_columns.sql`, `20260801_exe002004_idempotency_keys.sql` i `20260830_day175_task_risk_alternatives.sql`. Pliki pod `server/migrations/never-ran/` nie sa zrodlem schematu.

Pełny stan fresh-DB, w kolejnosci ordinalnej:

`id, project_id, organization_id, title, description, status, priority, assignee_id, reporter_id, due_date, estimated_hours, checklist, attachments, tags, task_type, initiative_id, why, expected_outcome, decision_impact, evidence_required, strategic_contribution, roadmap_initiative_id, kpi_id, raid_item_id, assignees, progress, blocked_reason, sla_hours, sla_due_at, escalation_level, escalated_to_id, last_escalated_at, custom_status_id, step_phase, budget_allocated, budget_spent, risk_rating, acceptance_criteria, blocking_issues, completed_at, created_at, updated_at, idempotency_key, created_by, started_at, backup_assignee_id, list_id, workstream_id, source, owner_id, requires_acceptance, acceptance_type, acceptor_id, weight, weight_reason, blocked_by_decision_id, blocked_at, custom_fields_json, parent_task_id, sort_order, story_points, actual_hours, sprint_id, idea_id, notify_on_overdue, notify_on_acceptance, notify_on_unassigned, notify_on_blocked, last_overdue_notified_at, last_acceptance_notified_at, last_unassigned_notified_at, last_blocked_notified_at, source_type, source_id, effort_estimate_hours, is_milestone, milestone_target_date, required_skills, risks, alternatives`.

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

Za brama 409 sa wszystkie 24 mutujace trasy routera `pmo/tasks.routes.ts` (middleware na linii 67), pod obiema bazami `/api/tasks` i `/api/pmo/tasks`. Brama obejmuje tez mutacje `/api/execution-control`, `/api/v8/execution-control/manager`, `/api/v8/execution-control` oraz waski zestaw tras inicjatyw. GET/HEAD/OPTIONS przechodza; jedyny wyjatek mutacyjny to `DELETE /budget/entries/:id`.

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

## A4. Projekt migracji addytywnej

Wybor: wyłącznie `executeMaterialCommand` i `createExecutionTask`, partiami. Surowy SQL do `ie_aggregate_state` jest odrzucony, bo omija receipt, audit, outbox, CAS i relation claim.

Koperta: `organizationId` z wiersza; `actorId` = dedykowane, istniejace konto systemowe migracji zatwierdzone przez wlasciciela (nie podszywac sie pod autora); `aggregateType=execution_task`; `aggregateId=legacy task id` albo namespaced deterministycznie; `expectedVersion=0`; `clientRequestId=tasks-canonical-v1:<org>:<legacy-id>`; `correlationId=tasks-cutover:<batch-id>`; `policyId=execution-work`, `policyVersion=1`; `commandType=execution.task.create`; `createIfMissing=true`. Aktor systemowy jest propozycja, nie potwierdzonym kontraktem.

Algorytm: (1) zamrozic lub przekierowac wszystkie writery poza brama; (2) snapshot denominatora; (3) rozstrzygnac brakujace pola i domy; (4) grupowac per `execution_case`; (5) w transakcji pobrac aktualna wersje case, wywolac jedno polecenie, odczytac receipt+task+case; (6) szeregowo kontynuowac per case, rownolegle tylko miedzy sprawami; (7) checkpoint po kazdym wierszu. Replay tego samego requestu musi zwrocic `REPLAYED`; inny fingerprint pod tym ID to konflikt i STOP pozycji.

To nie powinna byc migracja DDL. Runner SQL nie moze wywolac domenowego command handlera. Potrzebny jest osobny, jednorazowy runner aplikacyjny po pelnych migracjach, z default OFF i jawnym confirmem; ewentualny DDL rejestru cutover musi byc datowany po `20260830_day175...`, przejsc naming validator i fresh gate. `tasks.risks` wolno czytac dopiero po migracji Day175; fazowy sorter uruchamia wszystkie `NNN_` przed `YYYYMMDD_`.

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

Fresh-DB: 870 migracji, replay 0, `DAY161_FRESH_MIGRATION_GATE=PASS`. Seed: 1 org, 1 user, 1 ACTIVE member, 1 project, 8 flags; sam seed tworzy 0 tasks/agregatow. Dwa wiersze legacy dodano jawnie jako syntetyczne, nie zastane: 2 total, 1 personal/no initiative/no due/no sla, 1 z initiative lecz bez active case. Migracji danych nie wykonano.

Realny replay Day160 jest `NOT_PROVEN`: beforeAll asertuje twardo bazę `cx160`, a afterAll zapisuje do `/private/tmp/cx-day160...`; na bazie dyzuru wszystkie 3 testy zostaly skipped. Nie obchodzono tego straznika. Przed dyzurem wykonania trzeba naprawic test zgodnie z Z31 i ponowic realny ApiGateway/JWT/PG readback.
