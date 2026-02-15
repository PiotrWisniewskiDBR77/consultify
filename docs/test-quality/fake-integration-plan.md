# Fake Integration Tests (plan naprawy)

Stan na dziś (po czyszczeniu placeholderów):

- `FAKE_INTEGRATION`: **0** plików (usunięte jako testy-atrapy)
- `PLACEHOLDER`: **0**

## Definicja „FAKE_INTEGRATION” (co naprawiamy)

Test jest „fake integration”, gdy:

- robi `app = express()` i wystawia **lokalne mock-route’y** w teście (zamiast realnych routerów/kontrolerów),
- oraz nie dotyka kodu aplikacji (`server/src/**`, `src/**`).

Cel: każdy taki test ma albo:

1. importować i testować realny kod (`server/src/routes/**`, `server/src/controllers/**`, `server/src/services/**`), albo
2. zostać usunięty, jeśli był tylko atrapą bez wartości diagnostycznej.

## Zasady przeróbki (żeby nie wróciła ściema)

- Zakaz lokalnych handlerów typu `app.get('/x', (req,res)=>...)` w testach integracyjnych.
- Dozwolone są mocki **na granicach**: DB (`DbPromise`/`getDatabase`), Redis, zewnętrzne SDK – ale router/kontroler/serwis ma być realny.
- Zero `expect(true).toBe(true)`, zero `describe.skip()` jako „test”.

## Priorytety

1. Pliki `tests/integration/**/**-endpoints.test.ts` (najłatwiejsze do „uszczelnienia” przez import realnych routerów).
2. Pliki security/compliance (żeby przestały być deklaratywne).
3. Performance/load (albo realny test, albo usunięcie – bez atrap).

## Usunięte pliki (57)

Te testy były lokalnymi `express()` + mock-route’ami i nie dotykały aplikacji. Zostały usunięte zamiast utrzymywania „fałszywej integracji”.

```
tests/economics/economicsApi.test
tests/integration/actionDecision.test.js
tests/integration/actionExecution.test.js
tests/integration/ai/ai-endpoints.test.ts
tests/integration/ai-enterprise-verification.test.js
tests/integration/ai-settings-api.test
tests/integration/aiExplainability.test.js
tests/integration/aiFailure.test.js
tests/integration/analytics/analytics-endpoints.test.ts
tests/integration/apiOptimization.test.ts
tests/integration/apiResilience.test.js
tests/integration/assessment-ai.integration.test
tests/integration/assessment-api.integration.test
tests/integration/assessment-rbac.integration.test
tests/integration/assessment-reports.integration.test
tests/integration/assessment-workflow.integration.test
tests/integration/audit/audit-endpoints.test.ts
tests/integration/budget.integration.test
tests/integration/clients/client-endpoints.test.ts
tests/integration/comments/comment-endpoints.test.ts
tests/integration/contracts/contract-endpoints.test.ts
tests/integration/criticalEndpoints.test.js
tests/integration/external-services.test.ts
tests/integration/files/file-endpoints.test.ts
tests/integration/helpPlaybooks.test.js
tests/integration/invoices/invoice-endpoints.test.ts
tests/integration/legal.test.ts
tests/integration/notifications/notification-endpoints.test.ts
tests/integration/organizations/organization-endpoints.test.ts
tests/integration/payments/payment-endpoints.test.ts
tests/integration/projects/project-endpoints.test.ts
tests/integration/rapidlean-observations.test.js
tests/integration/recommendationEngine.integration.test.js
tests/integration/reports/report-endpoints.test.ts
tests/integration/search/search-endpoints.test.ts
tests/integration/settings/settings-endpoints.test.ts
tests/integration/settingsAPI.test
tests/integration/status-reports.integration.test
tests/integration/studio-api.test.ts
tests/integration/subscriptions/subscription-endpoints.test.ts
tests/integration/superadmin-api-endpoints.test.ts
tests/integration/superadmin-database-schema.test.ts
tests/integration/system-module-api.test
tests/integration/tasks/task-endpoints.test.ts
tests/integration/tasks.test.js
tests/integration/tasks.test.ts
tests/integration/templates/template-endpoints.test.ts
tests/integration/transaction.test.js
tests/integration/users/user-endpoints.test.ts
tests/integration/vendors/vendor-endpoints.test.ts
tests/integration/webhooks/webhook-endpoints.test.ts
tests/performance/api/api-response-times.test.ts
tests/performance/load/load-testing.test.ts
tests/security/compliance/gdpr.test.js
tests/security/compliance/soc2.test.js
tests/server/routes/content.test
tests/unit/backend/controllers/authController.test.js
```
