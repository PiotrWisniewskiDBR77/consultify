# B9 — D-99 real AppRoutes + colocated-tests preflight

Baza: `origin/integracja/20260911` = `d9f8b2203f636e62c527f5237a3e504afd0a211d` z `git ls-remote`, 2026-09-18 CDT. Zakres B9: D-99 oraz pomiar `colocated-tests`; bez włączania CI i bez zmian w workflow.

## D-99

D-99 jest zamknięty testem na realnym `AppRoutes`, nie na lokalnym lustrze gate'a. Nowy test `src/routes/__tests__/AppRoutes.executionRetired.real.test.tsx` montuje prawdziwy `AppRoutes` w `MemoryRouter`, stubuje tylko shell i ciężki leaf `ExecutionHub`, a następnie sprawdza:

- `/execution?tab=rollout&view=kanban#row-1` uruchamia prawdziwy `ExecutionRetiredTabGate` i kończy na `/execution?tab=list&view=kanban#row-1`;
- `/rollout?view=kanban#risk` uruchamia prawdziwy `RedirectToCanonicalTab tab="list"`, kończy na `/execution?view=kanban&tab=list#risk` i emituje event redirectu od razu do listy, bez bounce przez `tab=rollout`.

Mutacje RED:

- zdjęcie `ExecutionRetiredTabGate` z pierwszej realnej trasy `/execution` → `MUT_GATE_RC=1`, oczekiwano `tab=list`, zostało `tab=rollout`;
- zmiana realnego `/rollout` z `tab="list"` na `tab="rollout"` → `MUT_ROLLOUT_EVENT_RC=1`, event redirectu wskazał `/execution?...&tab=rollout`, a test wymaga od razu canonical list.

Focused GREEN: `src/routes/__tests__/AppRoutes.executionRetired.real.test.tsx`, `executionRetiredDeepLinkRedirect.test.tsx`, `executionCanonicalRoute.test.ts` = 3 pliki / 42 PASS.

## colocated-tests — pomiar linii

Workflow definiuje job `colocated-tests` w `.github/workflows/test-suite.yml:629-693`: migrate DB, `npx vitest run server/src --no-file-parallelism`, potem `npx vitest run src`. Lokalnie nie uruchamiałem migracji ani CI. Zmierzyłem preflight na linii, żeby ustalić, co jest czerwone przed propozycją fail-closed.

Pełny `npx vitest run src --reporter=json` nie oddał JSON-u po lokalnym timeoutowym preflighcie i został przerwany kodem 130. Pomiar shardami pokazał, że obecny filtr `src` nie jest czysto frontendowy: raporty zawierają wiele `server/src/**/__tests__/**`, więc job `src` dubluje część obszaru serwerowego zamiast mierzyć tylko frontend.

| run | suites | failed suites | tests | failed tests | top failures |
|---|---:|---:|---:|---:|---|
| src shard 1/8 | 946 | 87 | 3041 | 83 | `teresaHandoffTargets.failClosed`, `contractMirrorDrift`, `AuditReportsTab` |
| src shard 2/8 | 1032 | 108 | 3539 | 127 | `table-platform.routes`, `caseWorkspace liveStack`, `menuContract` |
| src shard 3/8 | 978 | 95 | 2874 | 79 | `meeting.routes`, `economics.routes.validation`, `template-lifecycle-acl` |
| src shard 4/8 | 1003 | 84 | 3175 | 48 | `documentPdfRendererParity`, `packService`, `migrationIntegrity` |
| src shard 5/8 | 1093 | 88 | 3382 | 89 | `EditableSpreadsheetGrid.artifactStudio`, `validation-status-acl`, `workbookClosure.pg` |
| src shard 6/8 | 1062 | 91 | 3098 | 56 | `EditableSpreadsheetGrid.manual`, `document-studio-client-reader.routes`, `VaultDocumentsView.bulkReceipts` |
| src shard 7/8 | 979 | 77 | 3235 | 59 | `financial-modeling.routes.validation`, `DbPromise.timeout`, `MainLayout.teresaMenu1` |
| src shard 8/8 | 1099 | 138 | 3473 | 158 | `cross-org-idor`, `document-studio-share-links`, `resultsFinanceRules.postgres` |

Osobny lokalny `server/src` preflight z envami workflow (`DB_TYPE=postgres`, `RUN_DB_TESTS=1`, `MOCK_DB=false`) nie oddał JSON-u w 180 s. Pliki `server-src.stdout/stderr` są puste, więc lokalny wynik tej części to `TIMEOUT/NO_REPORT`, nie lista czerwieni.

## Propozycja bez włączania CI

Nie włączać `colocated-tests` jako wymaganej bramki w obecnym kształcie. Najpierw trzeba zrobić osobną paczkę porządkującą job:

1. poprawić scope, żeby frontend step nie łapał `server/src` przez luźny filtr `src`;
2. uruchomić serwerowe colocated wyłącznie po pewnym DB migrate i z raportem, który nie ginie przy timeout;
3. dodać baseline/allowlistę obecnych czerwieni albo ratchet „no new failures”, bo linia ma dziś dziesiątki czerwonych suite'ów;
4. dopiero po zielonym lub zratchetowanym baseline włączyć fail-closed.

Evidence files: `docs/program/D99_COLOCATED_20260918/evidence/colocated-summary.json` oraz shard JSON-y w tym samym katalogu.
