# CODEX DAY 246 — DOMIAR AUDYTU UPRAWNIEŃ

## Streszczenie

Dyżur pomiarowy, bez zmian produktu, bazy, runtime'u i modelu językowego. Przeczytano 70 rzeczywistych plików tras: 69 z listy R2 oraz zastępstwo `journeyAnalytics.routes.ts` za barrel `audits/index.ts`. Klasyfikacja: 61 bezpiecznych, 6 globalnych/platformowych, 3 potwierdzone statycznie jako dziurawe i pozostawione bez naprawy.

## Bramka wejściowa

- marker: `df7f13056f`; wynik: `MARKER OK`;
- sanity HEAD: `df7f13056fa24995be07f64b0e8c877b3faeab45`;
- `git status --short | head -3`: brak wyjścia;
- porty `6232`, `5212`, `5213`: brak listenerów;
- `docker ps`: brak kontenera `cx-day246-pg`; zgodnie z §5 baza nie została uruchomiona;
- dysk przed worktree: 10 GiB, po worktree: 7.9 GiB;
- tip uciekł do przodu; różnice markera zapisano w sekcji Korekty.

## R1 — świeża regeneracja

Komendy z §1 wykonane dosłownie na markerze:

```text
346 /tmp/live_specs_246.txt
143 /tmp/touched_246.txt
live: 346 untouched: 229 candidates: 154
```

Mianownik bieżący: 346 żywych importów, 229 nietkniętych, 154 kandydatów. Wynik kandydatów jest identyczny z pomiarem autora. Liczba plików dotkniętych historią wynosi 143 (autor podał 117), ale wynik `untouched=229` jest zgodny, ponieważ część ścieżek historii nie należy do 346 żywych importów.

## R2 — klasyfikacja 70 tras

Liczba endpointów oznacza liczbę deklaracji `router.METHOD` w pliku. Dowód podaje najkrótszy punkt łańcucha SQL/gate/delegacji; klasyfikacja obejmuje odczyt całego pliku. Dla trzech dziur dowód pokazuje źródło klient-kontrolowanego tenant context; ich serwisy otrzymują ten identyfikator jako zakres SQL, więc problem powstaje przed SQL.

| Plik | Endpointy | Klasyfikacja | Dowód |
|---|---:|---|---|
| `server/src/routes/access-control.routes.ts` | 10 | BEZPIECZNY | server/src/routes/access-control.routes.ts:138 `let where = 'organization_id = ?';` |
| `server/src/routes/admin-bulk.routes.ts` | 8 | BEZPIECZNY | server/src/routes/admin-bulk.routes.ts:74 `'SELECT id FROM users WHERE LOWER(email)=LOWER(?) AND organization_id=? FOR UPDATE',` |
| `server/src/routes/admin/ai-observability.routes.ts` | 2 | GLOBALNY/PLATFORMOWY | server/src/routes/admin/ai-observability.routes.ts:12 `import { verifySuperAdmin } from '../../middleware/superAdmin.middleware.js';` |
| `server/src/routes/admin/audit-export-history.routes.ts` | 1 | BEZPIECZNY | server/src/routes/admin/audit-export-history.routes.ts:14 `'SELECT role,status FROM organization_members WHERE organization_id=? AND user_id=? LIMIT 1',` |
| `server/src/routes/admin/backup.routes.ts` | 7 | GLOBALNY/PLATFORMOWY | server/src/routes/admin/backup.routes.ts:13 `import { verifySuperAdmin } from '../../middleware/superAdmin.middleware.js';` |
| `server/src/routes/admin/billing-history.routes.ts` | 1 | BEZPIECZNY | server/src/routes/admin/billing-history.routes.ts:21 `WHERE organization_id = ? AND user_id = ? LIMIT 1`,` |
| `server/src/routes/admin/domains.routes.ts` | 5 | BEZPIECZNY | server/src/routes/admin/domains.routes.ts:38 `'SELECT role, status FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1',` |
| `server/src/routes/admin/enterprise-compliance.routes.ts` | 17 | BEZPIECZNY | server/src/routes/admin/enterprise-compliance.routes.ts:91 `const logs = await AIAuditLogger.getAuditLogs(orgId, {` |
| `server/src/routes/admin/guests.routes.ts` | 2 | BEZPIECZNY | server/src/routes/admin/guests.routes.ts:14 `'SELECT role,status FROM organization_members WHERE organization_id=? AND user_id=? LIMIT 1',` |
| `server/src/routes/admin/health-panel.routes.ts` | 6 | BEZPIECZNY | server/src/routes/admin/health-panel.routes.ts:52 `WHERE organization_id = ? AND user_id = ?` |
| `server/src/routes/admin/legal-hold.routes.ts` | 1 | BEZPIECZNY | server/src/routes/admin/legal-hold.routes.ts:14 `'SELECT role,status FROM organization_members WHERE organization_id=? AND user_id=? LIMIT 1',` |
| `server/src/routes/admin/organization-profile.routes.ts` | 2 | BEZPIECZNY | server/src/routes/admin/organization-profile.routes.ts:28 `'SELECT role, status FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1',` |
| `server/src/routes/admin/seats.routes.ts` | 3 | BEZPIECZNY | server/src/routes/admin/seats.routes.ts:22 ``SELECT role, status FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1`,` |
| `server/src/routes/admin/security-alerts.routes.ts` | 2 | BEZPIECZNY | server/src/routes/admin/security-alerts.routes.ts:14 `'SELECT role, status FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1',` |
| `server/src/routes/admin/sessions.routes.ts` | 2 | BEZPIECZNY | server/src/routes/admin/sessions.routes.ts:15 `'SELECT role,status FROM organization_members WHERE organization_id=? AND user_id=? LIMIT 1',` |
| `server/src/routes/adminIntegrations.routes.ts` | 3 | BEZPIECZNY | server/src/routes/adminIntegrations.routes.ts:43 `JOIN integrations i ON i.id = io.integration_id AND i.organization_id = io.organization_id` |
| `server/src/routes/agents.routes.ts` | 7 | BEZPIECZNY | server/src/routes/agents.routes.ts:1 brak lokalnego dowodu org |
| `server/src/routes/ai-operator.routes.ts` | 15 | BEZPIECZNY | server/src/routes/ai-operator.routes.ts:39 `const data = await aiOperatorService.getOverview(auth.organizationId, auth.userId);` |
| `server/src/routes/ai-prompts.routes.ts` | 20 | GLOBALNY/PLATFORMOWY | server/src/routes/ai-prompts.routes.ts:367 ``SELECT * FROM ai_eval_auto_triggers WHERE organization_id = ? AND trigger_type = 'prompt_update' AND is_active = 1`,` |
| `server/src/routes/ai/ai-feedback.routes.ts` | 7 | BEZPIECZNY | server/src/routes/ai/ai-feedback.routes.ts:205 `WHERE organization_id = ?` |
| `server/src/routes/analytics.routes.ts` | 4 | BEZPIECZNY | server/src/routes/analytics.routes.ts:46 `WHERE organization_id = ?` |
| `server/src/routes/artifact-runs.routes.ts` | 7 | BEZPIECZNY | server/src/routes/artifact-runs.routes.ts:1 brak lokalnego dowodu org |
| `server/src/routes/artifactApprovals.routes.ts` | 5 | BEZPIECZNY | server/src/routes/artifactApprovals.routes.ts:1 brak lokalnego dowodu org |
| `server/src/routes/artifactLineage.routes.ts` | 6 | BEZPIECZNY | server/src/routes/artifactLineage.routes.ts:1 brak lokalnego dowodu org |
| `server/src/routes/assessment-enterprise.routes.ts` | 26 | DZIURAWY — potwierdzony statycznie | server/src/routes/assessment-enterprise.routes.ts:22 `(req.query.organizationId as string);` |
| `server/src/routes/assessment/assessment-workflow.routes.ts` | 27 | BEZPIECZNY | server/src/routes/assessment/assessment-workflow.routes.ts:173 `WHERE assessment_id = ? AND organization_id = ?`,` |
| `server/src/routes/audit-events.routes.ts` | 1 | BEZPIECZNY | server/src/routes/audit-events.routes.ts:1 brak lokalnego dowodu org |
| `server/src/routes/audit.routes.ts` | 3 | BEZPIECZNY | server/src/routes/audit.routes.ts:26 `FROM audits WHERE organization_id = ? ORDER BY created_at DESC` |
| `server/src/routes/benchmark.routes.ts` | 2 | BEZPIECZNY | server/src/routes/benchmark.routes.ts:119 ``SELECT score_summary FROM assessments WHERE id = ? AND organization_id = ? LIMIT 1`,` |
| `server/src/routes/benefitsRegister.routes.ts` | 4 | BEZPIECZNY | server/src/routes/benefitsRegister.routes.ts:73 `const benefits = await BenefitsRegisterService.listBenefits(orgId, initiativeId);` |
| `server/src/routes/billing/billingAdmin.routes.ts` | 5 | GLOBALNY/PLATFORMOWY | server/src/routes/billing/billingAdmin.routes.ts:9 `requireSuperAdminCapability,` |
| `server/src/routes/budget.routes.ts` | 8 | BEZPIECZNY | server/src/routes/budget.routes.ts:125 ``INSERT INTO initiative_budget_items (id, initiative_id, organization_id, category, cost_type, amount, currency, created_at, updated_at)` |
| `server/src/routes/budgets.routes.ts` | 7 | BEZPIECZNY | server/src/routes/budgets.routes.ts:40 `let requireOrgAccess: RequireOrgAccessMiddleware | null = null;` |
| `server/src/routes/capability.routes.ts` | 12 | BEZPIECZNY | server/src/routes/capability.routes.ts:19 `const caps = await capSvc.getCapabilities(orgId, domain);` |
| `server/src/routes/capabilityEffective.routes.ts` | 1 | BEZPIECZNY | server/src/routes/capabilityEffective.routes.ts:1 brak lokalnego dowodu org |
| `server/src/routes/caseWorkspace/eventInbox.routes.ts` | 1 | BEZPIECZNY | server/src/routes/caseWorkspace/eventInbox.routes.ts:1 brak lokalnego dowodu org |
| `server/src/routes/change-sentiment.routes.ts` | 8 | BEZPIECZNY | server/src/routes/change-sentiment.routes.ts:18 `const pulse = await sentimentSvc.submitPulse(orgId, {` |
| `server/src/routes/cloud.routes.ts` | 11 | BEZPIECZNY | server/src/routes/cloud.routes.ts:376 ``UPDATE cloud_sources SET last_sync_at = NOW(), updated_at = NOW() WHERE id = ? AND organization_id = ?`,` |
| `server/src/routes/compliance.routes.ts` | 6 | BEZPIECZNY | server/src/routes/compliance.routes.ts:81 `WHERE organization_id = ? AND setting_type = 'gdpr'`,` |
| `server/src/routes/cv-matching.routes.ts` | 12 | BEZPIECZNY | server/src/routes/cv-matching.routes.ts:31 `const candidates = await cvService.getCandidates(orgId);` |
| `server/src/routes/deliverablesGenerations.routes.ts` | 14 | BEZPIECZNY | server/src/routes/deliverablesGenerations.routes.ts:565 `WHERE organization_id = $1` |
| `server/src/routes/demo.routes.ts` | 5 | BEZPIECZNY | server/src/routes/demo.routes.ts:1 brak lokalnego dowodu org |
| `server/src/routes/discovery.routes.ts` | 7 | BEZPIECZNY | server/src/routes/discovery.routes.ts:119 `WHERE organization_id = ? AND owner_id = ?` |
| `server/src/routes/enterprise-platform.routes.ts` | 22 | DZIURAWY — potwierdzony statycznie | server/src/routes/enterprise-platform.routes.ts:22 `(req.query.organizationId as string);` |
| `server/src/routes/executionAnalytics.routes.ts` | 7 | BEZPIECZNY | server/src/routes/executionAnalytics.routes.ts:250 `WHERE ${projFilter}organization_id = ?` |
| `server/src/routes/executiveAggregate.routes.ts` | 1 | BEZPIECZNY | server/src/routes/executiveAggregate.routes.ts:1 brak lokalnego dowodu org |
| `server/src/routes/external-assessments.routes.ts` | 2 | BEZPIECZNY | server/src/routes/external-assessments.routes.ts:25 `FROM external_assessments WHERE organization_id = ? ORDER BY created_at DESC`,` |
| `server/src/routes/featureFlags.routes.ts` | 9 | BEZPIECZNY | server/src/routes/featureFlags.routes.ts:263 ``SELECT flag_key, enabled FROM g4_test_flag_overrides WHERE organization_id = ?`,` |
| `server/src/routes/featureUpdates.routes.ts` | 9 | BEZPIECZNY | server/src/routes/featureUpdates.routes.ts:162 ``CREATE INDEX IF NOT EXISTS idx_feature_updates_org_status_published ON feature_updates(organization_id, status, published_at);`,` |
| `server/src/routes/final-batch.routes.ts` | 27 | DZIURAWY — potwierdzony statycznie | server/src/routes/final-batch.routes.ts:22 `(req.query.organizationId as string);` |
| `server/src/routes/finance-statements.routes.ts` | 33 | BEZPIECZNY | server/src/routes/finance-statements.routes.ts:272 ``SELECT * FROM financial_statements WHERE id = ? AND organization_id = ?`,` |
| `server/src/routes/financeCandidateHandoffDigitizationAnalysis.routes.ts` | 3 | BEZPIECZNY | server/src/routes/financeCandidateHandoffDigitizationAnalysis.routes.ts:1 brak lokalnego dowodu org |
| `server/src/routes/help.routes.ts` | 9 | GLOBALNY/PLATFORMOWY | server/src/routes/help.routes.ts:1 brak lokalnego dowodu org |
| `server/src/routes/helpChat.routes.ts` | 2 | BEZPIECZNY | server/src/routes/helpChat.routes.ts:1 brak lokalnego dowodu org |
| `server/src/routes/helpFeedback.routes.ts` | 2 | BEZPIECZNY | server/src/routes/helpFeedback.routes.ts:1 brak lokalnego dowodu org |
| `server/src/routes/ideaBusinessCase.routes.ts` | 7 | BEZPIECZNY | server/src/routes/ideaBusinessCase.routes.ts:92 ``SELECT id FROM my_ideas WHERE id = ? AND organization_id = ? LIMIT 1`,` |
| `server/src/routes/ideaFinancialCase.routes.ts` | 2 | BEZPIECZNY | server/src/routes/ideaFinancialCase.routes.ts:107 ``SELECT id FROM my_ideas WHERE id = ? AND organization_id = ? LIMIT 1`,` |
| `server/src/routes/initiativeBackbone.routes.ts` | 2 | BEZPIECZNY | server/src/routes/initiativeBackbone.routes.ts:17 `import { requireOrgAccess } from '../middleware/rbac.middleware.js';` |
| `server/src/routes/initiativeCandidates.routes.ts` | 5 | BEZPIECZNY | server/src/routes/initiativeCandidates.routes.ts:107 `const candidates = await listCandidates(undefined, orgId, status);` |
| `server/src/routes/initiativeGeneratorBrain.routes.ts` | 3 | BEZPIECZNY | server/src/routes/initiativeGeneratorBrain.routes.ts:12 `* (verifyToken + requireOrgAccess + asyncHandler). Strictly org-scoped.` |
| `server/src/routes/initiativeMaterialize.routes.ts` | 2 | BEZPIECZNY | server/src/routes/initiativeMaterialize.routes.ts:18 `import { requireOrgAccess } from '../middleware/rbac.middleware.js';` |
| `server/src/routes/insightSourceBaskets.routes.ts` | 6 | BEZPIECZNY | server/src/routes/insightSourceBaskets.routes.ts:136 `const basket = await updateBasket(organizationId, req.params.id, {` |
| `server/src/routes/integrations/automation.routes.ts` | 5 | BEZPIECZNY | server/src/routes/integrations/automation.routes.ts:293 `WHERE organization_id = ?` |
| `server/src/routes/integrations/calendarIntegrations.routes.ts` | 2 | BEZPIECZNY | server/src/routes/integrations/calendarIntegrations.routes.ts:60 `WHERE i.organization_id = ?` |
| `server/src/routes/integrations/sso.routes.ts` | 14 | BEZPIECZNY | server/src/routes/integrations/sso.routes.ts:169 `LEFT JOIN organizations o ON o.id = s.organization_id` |
| `server/src/routes/integrations/webhookSubscriptions.routes.ts` | 9 | BEZPIECZNY | server/src/routes/integrations/webhookSubscriptions.routes.ts:97 `WHERE organization_id = ?` |
| `server/src/routes/integrations/webhooks.routes.ts` | 4 | GLOBALNY/PLATFORMOWY | server/src/routes/integrations/webhooks.routes.ts:6 `import { verifySuperAdmin } from '../../middleware/superAdmin.middleware.js';` |
| `server/src/routes/intelligence.routes.ts` | 7 | BEZPIECZNY | server/src/routes/intelligence.routes.ts:166 `WHERE project_id = ? AND organization_id = ?` |
| `server/src/routes/interviewCandidateHandoff.routes.ts` | 6 | BEZPIECZNY | server/src/routes/interviewCandidateHandoff.routes.ts:29 `import { requireOrgAccess } from '../middleware/rbac.middleware.js';` |
| `server/src/routes/journeyAnalytics.routes.ts` | 5 | BEZPIECZNY | server/src/routes/journeyAnalytics.routes.ts:64 `FROM journey_definitions WHERE organization_id = ? AND is_active = 1` |

### Podmiana barrela

`server/src/routes/audits/index.ts` ma 0 deklaracji `router.METHOD`; jest kompozytorem routerów, nie samodzielną trasą. Zastąpiono go `server/src/routes/journeyAnalytics.routes.ts`, aby zachować 70 rzeczywiście przeczytanych tras.

## NOWE DZIURY ZNALEZIONE, NIE NAPRAWIONE

1. `assessment-enterprise.routes.ts:16-22` — `requireUser` przy braku tenant claim przyjmuje `req.query.organizationId`, a następnie przekazuje go do wszystkich operacji serwisu. Live-proof: podpisany JWT bez organizacji + cudzy `organizationId` w query; oczekiwane fail-closed `401/403`, czerwony wynik to `2xx` i odczyt/mutacja cudzego tenant.
2. `enterprise-platform.routes.ts:16-22` — identyczny fallback do klient-kontrolowanego `req.query.organizationId`. Live-proof jak wyżej, z odczytem konektora innej organizacji i SQL/GET readbackiem.
3. `final-batch.routes.ts:16-22` — identyczny fallback do query, następnie zakres eksportów jest wybierany przez przekazany `orgId`. Live-proof: JWT bez tenant claim + cudzy tenant w query; wymagane `401/403`, nie `2xx`.

Nie uruchamiałem bazy ani testu HTTP, ponieważ §5 wyraźnie definiuje dyżur jako statyczny i zakazuje uruchomienia bazy. Dlatego powyższe werdykty są „potwierdzone statycznie”, nie `FIXED` ani `VERIFIED live`.

## Pomiar nazw testów (§0.4a)

Licencja nie wskazuje żadnego pakietu testowego, a §5 mówi, że dyżur nie tworzy ani nie uruchamia testów. `przed-nazwy.txt` i `po-nazwy.txt` są puste, a diff jest pusty. Nie ogłaszam żadnego wyniku testów.

Artefakty (poza repo):

- `/private/tmp/cx-day246-domiar-audytu-artefakty/przed-nazwy.txt` — SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`;
- `/private/tmp/cx-day246-domiar-audytu-artefakty/po-nazwy.txt` — SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`;
- `diff przed-nazwy.txt po-nazwy.txt` — brak wyjścia.

Pułapki Z33(a)-(d): nie dotyczą, bo nie uruchomiono pakietu. Pułapka (e) dotyczyła audytu; dla delegacji czytano przekazanie organizationId do serwisu, a nie samą obecność identyfikatora w trasie.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano live-proof trzech dziur (brak bazy zgodnie z §5); do weryfikacji potrzebny jest osobny dyżur z licencją na realny ApiGateway, JWT, PostgreSQL oraz mutację RED→GREEN.
- Nie ogłaszam sprawności runtime ani braku regresji; ten dyżur jest wyłącznie pomiarem statycznym.

## Korekty wobec instrukcji

- §0.1 podaje marker `df7f13056f`, podczas gdy wspólny marker kolejki w zleceniu nadrzędnym to `7a733cb63d`. Wiążąca pełna instrukcja dyżuru wymaga startu dokładnie z `df7f13056f`; tak wykonano. Tip jest 9 commitów przed markerem i zawiera nowsze instrukcje/dokumenty, ale zgodnie z DEC-2026-08-26-95 nie scalano go.
- Komenda wejściowa (6) zwróciła `25`, nie 19; instrukcja sama ostrzega, że grep łapie wzmianki poza R3. Lista R2 nie pokrywa się z przykładami R3.
- `audits/index.ts` potwierdzony jako barrel (0 handlerów) i podmieniony na `journeyAnalytics.routes.ts`.
- §0.2c opisuje kontener i testy, ale §5 nakazuje ich nie uruchamiać. Zastosowano bezpieczniejszy, bardziej szczegółowy §5: zero bazy/testów.

## Zakres zmian

Tylko dwa licencjonowane dokumenty: ten raport oraz nowa sekcja na końcu `AUDYT_RODZINY_TRAS_UPRAWNIENIA.md`. Zero zmian kodu produktu.
