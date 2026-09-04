# CODEX DAY 319 — zakres bezpiecznika DDL

Stan: W TOKU. Marker: `bc18bc7acac2ec825ebb3db2f1309738ab034d58`.

## Start

```text
MARKER OK
bc18bc7acac2ec825ebb3db2f1309738ab034d58
```

Tip `github-backup/grafika/m03-20260902` był o dwa commity dalej niż marker; różnica obejmowała wyłącznie instrukcje 319–321. Worktree celowo utworzono z markera.

## R1 — zakres bezpiecznika

Pomiar wejściowy: 504 wystąpienia w 160 plikach `server/src`; 197 w 98 plikach `server/src/services`. Bezpiecznik miał 79 wyjątków i skanował tylko `services`. Po zmianie skanuje `server/src`, jawnie nie czyta zakazanego `server/src/_backup`, pomija `__tests__` i ma 135 wyjątków.

Nowe pozycje zastanego długu poza `services` (właściciel kolejnego dyżuru schematowego; nieusunięte dziś, bo R1 zabezpiecza mianownik przed R2/R3):

| Plik | Liczba |
|---|---:|
| `server/src/controllers/DecisionController.ts` | 2 |
| `server/src/controllers/InterviewController.ts` | 8 |
| `server/src/controllers/SuperAdminController.ts` | 11 |
| `server/src/controllers/ToolController.ts` | 6 |
| `server/src/controllers/UserController.ts` | 1 |
| `server/src/cron/AIOpsReportCron.ts` | 1 |
| `server/src/database/DatabaseInitializer.ts` | 67 |
| `server/src/database/PostgresDatabase.ts` | 73 |
| `server/src/database/migrations/add_resource_tables.sql` | 2 |
| `server/src/index.ts` | 1 |
| `server/src/jobs/aiWatchdog.ts` | 2 |
| `server/src/middleware/demoGuard.middleware.ts` | 1 |
| `server/src/routes/admin/domains.routes.ts` | 1 |
| `server/src/routes/adminP32.routes.ts` | 8 |
| `server/src/routes/aiSettingsFallback.ts` | 1 |
| `server/src/routes/assessment-reports.routes.ts` | 3 |
| `server/src/routes/assessment/assessment-level-attachments.routes.ts` | 1 |
| `server/src/routes/assessment/assessment-workflow.routes.ts` | 3 |
| `server/src/routes/chat-projects.routes.ts` | 2 |
| `server/src/routes/client-errors.routes.ts` | 1 |
| `server/src/routes/compliance.routes.ts` | 1 |
| `server/src/routes/consultant-project-access.routes.ts` | 1 |
| `server/src/routes/discovery.routes.ts` | 1 |
| `server/src/routes/featureFlags.routes.ts` | 2 |
| `server/src/routes/featureUpdates.routes.ts` | 3 |
| `server/src/routes/feedback.routes.ts` | 4 |
| `server/src/routes/integrations/scim.routes.ts` | 5 |
| `server/src/routes/integrations/sso.routes.ts` | 1 |
| `server/src/routes/integrations/webhooks.routes.ts` | 1 |
| `server/src/routes/intelligence.routes.ts` | 2 |
| `server/src/routes/llm.routes.ts` | 7 |
| `server/src/routes/module-access.routes.ts` | 1 |
| `server/src/routes/organization/approved-domains.routes.ts` | 1 |
| `server/src/routes/organization/branding.routes.ts` | 1 |
| `server/src/routes/organization/organization-data.routes.ts` | 1 |
| `server/src/routes/organization/ownership.routes.ts` | 1 |
| `server/src/routes/organization/rbac.routes.ts` | 3 |
| `server/src/routes/pmo/pmoRoles.routes.ts` | 2 |
| `server/src/routes/pmo/workstreams.routes.ts` | 1 |
| `server/src/routes/public-contact.routes.ts` | 1 |
| `server/src/routes/resultsStrategic.routes.ts` | 5 |
| `server/src/routes/security/roles.routes.ts` | 1 |
| `server/src/routes/securityPolicies.routes.ts` | 1 |
| `server/src/routes/share.routes.ts` | 2 |
| `server/src/routes/superadmin.routes.ts` | 2 |
| `server/src/routes/systemHealth.routes.ts` | 1 |
| `server/src/routes/testSupport.routes.ts` | 11 |
| `server/src/routes/user/user-keyboard-shortcuts.routes.ts` | 1 |
| `server/src/routes/v8/execution-control.routes.ts` | 2 |
| `server/src/routes/v8/interview.routes.ts` | 4 |
| `server/src/routes/webhooks/stripe.routes.ts` | 1 |
| `server/src/routes/work-canvas.routes.ts` | 4 |
| `server/src/routes/workbook.routes.ts` | 1 |
| `server/src/scripts/a03PlanningClarificationRealDbProof.ts` | 2 |
| `server/src/scripts/t01FinalOutputRealDbProof.ts` | 7 |
| `server/src/utils/ensureUserOnboardingStatusTable.ts` | 1 |

Dowody mutacyjne, pełne wyjścia: `/private/tmp/cx-day319-ddl-zakres-artefakty/r1-mutacja-controller-red.txt`, `r1-mutacja-controller-green.txt`, `r1-mutacja-route-red.txt`, `r1-mutacja-route-green.txt`, `r1-mutacja-database-red.txt`, `r1-mutacja-database-green.json`. Mutacje: `AssessmentController.ts`, `health.routes.ts`, `ConnectionPool.ts`; wszystkie poza listą wyjątków i poza `services`. Po każdym cofnięciu diff pliku mutowanego był pusty.

Porównanie nazw testów: zmieniła się wyłącznie nazwa przypadku zakresowego z `services` na `server/src`; test `AUTOINCREMENT` zachował nazwę i zakres `services`. Pliki: `/private/tmp/cx-day319-ddl-zakres-artefakty/przed-nazwy.txt`, `po-r1-nazwy.txt`.

Pułapki Z33: pakiet jest czysto plikowy, nie montuje `ApiGateway`, auth ani bazy. `RUN_DB_TESTS=0 MOCK_DB=true`; dowodzi wyłącznie statycznego zakresu strażnika. Nie jest dowodem egzekucji ani migracji.

## Korekty wobec instrukcji

- Pomiar 504/160 i 197/98 potwierdził liczby instrukcji.
- Po uruchomieniu własnego kontenera `lsof :6335` pokazuje proces tunelu Dockera; to oczekiwany własny listener, nie zajęty zasób wejściowy.

## TWIERDZENIA NIEZWERYFIKOWANE

- R2–R6 pozostają niewykonane na tym etapie raportu.
