# Analiza Wyłączonych Testów - vitest.config.ts

## Data analizy: 2026-01-04

## Kategorie wyłączonych testów

### 1. AI Backend Services (Complex Mock Setup)
**Status:** Większość oznaczona jako "ENABLED - migrated to unified pattern", ale nadal wyłączone

#### Można przywrócić (oznaczone jako ENABLED):
- `tests/unit/backend/enhancedContextBuilder.test.js` - ENABLED
- `tests/unit/backend/aiDecisionGovernance.test.js` - ENABLED
- `tests/unit/backend/aiPipeline.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/aiSimulationEngine.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/aiActions.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/aiAnalyticsService.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/aiAssessmentFormHelper.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/aiAssessmentPartnerService.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/aiContextBuilder.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/aiCoreLayer.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/aiExecutiveReporting.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/aiKnowledgeManager.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/aiMaturityMonitor.test.js` - ENABLED - migrated to unified pattern + createMockDb
- `tests/unit/backend/aiPolicyEngine.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/aiPromptHierarchy.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/aiRiskChangeControl.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/aiSettingsService.test.js` - ENABLED - migrated to unified pattern

#### Wymaga naprawy:
- `tests/unit/backend/ai/aiPipeline-artifacts.test.js` - import chain issues

### 2. Assessment & PMO Services (Database Mock Issues)
**Status:** Większość oznaczona jako FIXED, ale nadal wyłączone

#### Można przywrócić (oznaczone jako FIXED):
- `tests/unit/backend/assessmentServices.test.js` - FIXED - no DB needed
- `tests/unit/backend/assessmentRBAC.test.js` - FIXED - Phase 1C: no DB needed
- `tests/unit/backend/pmoHealthService.test.js` - FIXED - uses createMockDb
- `tests/unit/backend/pmoStandardsMapping.test.js` - FIXED - service enabled with data

#### Wymaga naprawy:
- `tests/unit/backend/assessmentService.test.js` - nie ma komentarza FIXED
- `tests/unit/backend/assessmentWorkflowService.test.js` - nie ma komentarza FIXED

### 3. Financial & Billing (Complex State)
**Status:** Większość oznaczona jako FIXED/ENABLED, ale nadal wyłączone

#### Można przywrócić:
- `tests/unit/backend/financialCalculatorService.test.js` - FIXED - uses createRequire (naprawione w tej fazie)
- `tests/unit/backend/billingService.test.js` - FIXED - stabilized
- `tests/unit/backend/billingWebhookService.test.js` - ENABLED - migrated to unified pattern - stabilized
- `tests/unit/backend/economicsService.test.js` - FIXED - uses vi.hoisted
- `tests/unit/backend/settlementService.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/tokenBillingService.test.js` - ENABLED FOR FIXING (naprawić)
- `tests/unit/backend/tokenLedger.enterprise.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/tokenLedgerService.test.js` - ENABLED - migrated to unified pattern

### 4. Services with Database Dependency Issues
**Status:** Większość oznaczona jako ENABLED/FIXED

#### Można przywrócić:
- `tests/unit/backend/playbookResolver.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/decisionTriggerService.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/initiativeService.multiTenant.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/initiativeTemplateService.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/initiativeGeneratorService.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/multiFrameworkAssessmentService.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/evidenceLedgerService.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/regulatoryModeGuard.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/analyticsService.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/metricsAggregator.test.js` - ENABLED - migrated to unified pattern
- `tests/unit/backend/capacityService.test.js` - FIXED - Phase 1C: ESM dynamic imports + inline hoisted mock
- `tests/unit/backend/escalationService.test.js` - FIXED - Phase 1C: ESM dynamic imports + inline hoisted mock
- `tests/unit/backend/executionMonitorService.test.js` - FIXED - passes
- `tests/unit/backend/helpService.test.js` - FIXED - Phase 1B: validation tests only
- `tests/unit/backend/observability.test.js` - FIXED - Phase 1B: ESM dynamic imports
- `tests/unit/backend/progressService.test.js` - FIXED - Phase 1B: ESM dynamic imports + inline hoisted mock
- `tests/unit/backend/roadmapService.test.js` - FIXED - Phase 3: inline hoisted mock
- `tests/unit/backend/scenarioService.test.js` - FIXED - Phase 3: inline hoisted mock
- `tests/unit/backend/scmsServices.test.js` - 48 tests PASS
- `tests/unit/backend/variableResolver.test.js` - ESM top-level await (naprawione w tej fazie)
- `tests/unit/backend/versioningService.test.js` - FIXED - Phase 1B: ESM dynamic imports + inline hoisted mock
- `tests/unit/backend/docIndexer.test.js` - FIXED - 13 tests pass (naprawione w tej fazie)

#### Wymaga naprawy:
- `tests/unit/backend/rapidLeanService-extended.test.js` - import issues
- `tests/unit/backend/statusReportService.test.js` - TODO: fix queryHelpers mock timeouts
- `tests/unit/backend/usageService.test.js` - nie ma komentarza FIXED
- `tests/unit/backend/ingestionService.test.js` - import issues
- `tests/unit/backend/legalService.test.js` - nie ma komentarza FIXED
- `tests/unit/backend/webhookService.test.js` - nie ma komentarza FIXED
- `tests/unit/backend/edgeCases.test.js` - 12/15 pass
- `tests/unit/backend/errorRecovery.test.js` - 5/9 pass
- `tests/unit/backend/systemIntegrity.test.js` - 0/3 pass - all fail

### 5. Middleware Tests
**Status:** Większość oznaczona jako FIXED

#### Można przywrócić:
- `tests/unit/backend/middleware/authMiddleware.test.js` - FIXED
- `tests/unit/backend/middleware/orgContextMiddleware.test.js` - FIXED
- `tests/unit/backend/middleware/superAdminMiddleware.test.js` - FIXED
- `tests/unit/backend/middleware/adminMiddleware.test.js` - FIXED
- `tests/unit/backend/middleware/auditLog.test.js` - FIXED
- `tests/unit/backend/middleware/featureGate.test.js` - FIXED - 7 tests
- `tests/unit/backend/middleware/legalComplianceMiddleware.test.js` - FIXED
- `tests/unit/backend/middleware/rbac.test.js` - 48 tests PASS
- `tests/unit/backend/middleware/demoGuard.test.js` - 5 tests PASS
- `tests/unit/backend/middleware/securityHeadersMiddleware.test.js` - 10 tests PASS
- `tests/unit/backend/middleware/economicsValidation.test.js` - 9 tests PASS
- `tests/unit/backend/middleware/invitationRateLimiter.test.js` - 7 tests PASS

#### Wymaga naprawy:
- `tests/unit/backend/middleware/performanceMetrics.test.js` - database import chain issue
- `tests/unit/backend/middleware/userStateGuard.test.js` - partial - 2/4 pass
- `tests/unit/backend/middleware/trialEntryGuard.test.js` - ESM top-level await issue

### 6. Controllers
**Status:** Jeden wyłączony

#### Wymaga naprawy:
- `tests/unit/backend/controllers/superAdminController.test.js` - wyłączony

### 7. Other Unstable Tests
**Status:** Większość oznaczona jako FIXED

#### Można przywrócić:
- `tests/unit/services/errorLogger.test.ts` - Database.js import - FIXED
- `tests/unit/asyncJobService.test.js` - Database.js import - FIXED
- `tests/unit/connectorAdapter.test.js` - FIXED - 11 tests pass
- `tests/unit/connectorRegistry.test.js` - FIXED - 14 tests pass
- `tests/unit/helpFeedback.test.js` - FIXED
- `tests/unit/notificationOutboxService.test.js` - FIXED
- `tests/unit/policyEngine.test.js` - FIXED
- `tests/unit/secretsVault.test.js` - FIXED - 12 tests pass
- `tests/unit/slaService.test.js` - FIXED - 7 tests pass
- `tests/unit/workqueueService.test.js` - FIXED - 13 tests pass (naprawione w tej fazie)
- `tests/unit/hooks/useAccessPolicy.test.tsx` - FIXED - 25 tests pass

#### Wymaga naprawy:
- `tests/unit/actionProposalEngine.test.js` - webResearchService import chain
- `tests/unit/adminModules.test.tsx` - partial failures

### 8. Infrastructure Blockers (Native Crashes)
**Status:** Problemy z Vitest threading vs SQLite

#### Wymaga naprawy:
- `tests/unit/backend/ragService.test.js` - Database.js import (Still hanging)

## Plan działania

### Faza 1: Przywrócenie testów oznaczonych jako FIXED/ENABLED
1. Usunąć z exclude wszystkie testy oznaczone jako "ENABLED - migrated to unified pattern"
2. Usunąć z exclude wszystkie testy oznaczone jako "FIXED"
3. Uruchomić testy i sprawdzić czy rzeczywiście działają

### Faza 2: Naprawa critical service tests
1. `tests/unit/backend/tokenBillingService.test.js` - ENABLED FOR FIXING
2. `tests/unit/backend/middleware/performanceMetrics.test.js` - database import chain issue
3. `tests/unit/backend/controllers/superAdminController.test.js`

### Faza 3: Naprawa pozostałych testów z problemami
1. Import chain issues
2. ESM top-level await issues
3. Partial failures

## Statystyki

- **Można przywrócić natychmiast:** ~60+ testów (oznaczonych jako FIXED/ENABLED)
- **Wymaga naprawy:** ~15 testów
- **Infrastructure blockers:** 1 test (ragService.test.js)

