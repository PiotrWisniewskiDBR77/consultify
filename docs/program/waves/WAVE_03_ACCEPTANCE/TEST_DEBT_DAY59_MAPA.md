# DYŻUR 59 — diagnoza długu testowego

Data pomiaru: 2026-08-28. Marker: `b3179d0a52603f62b5cd3673caa754c8fc3b0055`. Gałąź: `codex/testdebt-day59-20260828`. Worktree: `/private/tmp/consultify-testdebt-day59`. PostgreSQL: lokalny `cx-day59-pg`, port `5931`, obraz `pgvector/pgvector:pg16`.

Zakres był wyłącznie pomiarowy. Nie zmieniono kodu produkcyjnego, testów, konfiguracji ani migracji. Przed acceptance, unit i initiatives baza była tworzona od zera i przechodziła pełny istniejący runner 858 migracji. Nie wykonano połączeń do Railway/demo/staging/produkcji ani GitHub Actions.

Jednostką w tabeli A jest czerwony test, jeśli runner ją raportuje. Ponieważ Vitest może mieć błąd suite bez czerwonej asercji, osobno pokazano „rekordy diagnostyczne” = czerwone asercje + suite-level failure. Dla lint jednostką jest pojedynczy komunikat severity=error. Pakiety initiatives są podzbiorem unit, więc ich wyniki nie są deduplikowane w tabeli B; tabela B klasyfikuje każdy zaobserwowany rekord każdego wymaganego przebiegu.

## A. Pełny inwentarz

Wszystkie polecenia miały prefiks:

`env RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://consultify:consultify@127.0.0.1:5931/consultify_day59 NODE_ENV=test`

| Pakiet | Pełny wynik | Czerwona liczność | Komenda i sposób policzenia | Weryfikacja liczby wejściowej |
|---|---:|---:|---|---|
| acceptance | 1 112 testów; 870 PASS; 133 FAIL; 109 SKIP; 405 plików/suite, 136 czerwonych | **133 testy; 145 rekordów diagnostycznych** | `npx vitest run --config vitest.acceptance.config.ts --retry=0 --reporter=json --outputFile=/private/tmp/consultify-testdebt-day59-logs/acceptance.json`; licznik: `numFailedTests`, a rekordy = failed assertions + failed suite bez failed assertion | **380 NIEPOTWIERDZONE; pomiar wygrywa: 133** |
| unit | 17 274 testy; 16 839 PASS; 398 FAIL; 26 SKIP; 6 417 suite/test containers, 262 czerwone wg pola runnera | **398 testów; 404 rekordy diagnostyczne** | `VITEST_HEAP_MB=8192 npx vitest run tests/unit --maxWorkers=1 --maxConcurrency=2 --retry=0 --reporter=json --outputFile=/private/tmp/consultify-testdebt-day59-logs/unit.json`; licznik: `numFailedTests`, rekordy jw. | **323 NIEPOTWIERDZONE; pomiar wygrywa: 398** |
| initiatives | 697 testów; 693 PASS; 4 FAIL; 0 SKIP; 293 containers; 6 realnie czerwonych plików | **4 testy; 7 rekordów diagnostycznych (3 import failures)** | `npx vitest run tests/unit/initiative tests/unit/initiatives --retry=0 --reporter=json --outputFile=/private/tmp/consultify-testdebt-day59-logs/initiatives.json`; `numFailedTests=4` + 3 suite-level import failures | **4 POTWIERDZONE**, ale sama liczba 4 ukrywa 3 błędy importu |
| lint | 1 924/1 924 analizowanych plików z błędem | **48 506 errors** | `npx eslint . --quiet --format json --output-file /private/tmp/consultify-testdebt-day59-logs/lint.json --no-error-on-unmatched-pattern`; licznik = suma `messages[severity===2]` | **48 506 POTWIERDZONE** |
| test-quality-check | 3 951 plików: REAL 3 471, PLACEHOLDER 153, OTHER 327 | **6 nowych blokowanych plików** | `npm run test:quality-check -- --retry=0`; licznik = unbaselined PLACEHOLDER/FAKE_UNIT z `test-results/quality-check/quality-check.report.json` | liczba wejściowa nie podana; wynik 6 |
| skip-scan-gate | 4 100 plików; 338 wystąpień skip; 0 only; 312 skip poza blokowanym zakresem | **26 blokowanych unit .skip()** | `npm run test:skip-scan -- --retry=0`; licznik = `gate.blocked.unitSkip.length` z `test-results/skip-scan/skip-scan.report.json` | liczba wejściowa nie podana; wynik 26 |

Pełne przebiegi: acceptance ok. 5,5 min, unit ok. 22 min, initiatives z odtworzeniem DB poniżej 1 min, lint ok. 3 min. Żaden nie przekroczył godziny; **nie użyto próbki ani ekstrapolacji**.

## B. Klasyfikacja każdej porażki

Klasyfikacja jest rozłączna na poziomie rekordu diagnostycznego. Dla lint rozdział produkt/test wynika z lokalizacji pliku: kod testowy, `__tests__`, pliki `*.test.*`/`*.spec.*` oraz generowane artefakty walidacyjne są kategorią 2; pozostałe źródła są kategorią 1. Dla Vitest klasyfikacja została wykonana per czerwony plik i per jawnie pinowana asercja.

| Przebieg | Rekordy | (1) produkt | (2) test | (3) dane | (4) środowisko | (5) pin buga |
|---|---:|---:|---:|---:|---:|---:|
| acceptance | 145 | 53 | 35 | 38 | 8 | 11 |
| unit | 404 | 82 | 222 | 63 | 36 | 1 |
| initiatives | 7 | 0 | 3 | 3 | 0 | 1 |
| lint | 48 506 | 15 609 | 32 897 | 0 | 0 | 0 |
| quality-check | 6 | 0 | 6 | 0 | 0 | 0 |
| skip-scan | 26 | 0 | 26 | 0 | 0 | 0 |
| **RAZEM (bez deduplikacji podzbioru initiatives)** | **49 094** | **15744** | **33189** | **104** | **44** | **13** |

Najważniejsze zastrzeżenie: kategorie 1–4 dla złożonych failure cascades są diagnozą źródłową z pierwszego dominującego błędu. Nie oznaczają, że każde downstream assertion zostało niezależnie odtworzone po hipotetycznym usunięciu przyczyny; to jest wpisane do sekcji „TWIERDZENIA NIEZWERYFIKOWANE”.

### Mapa plików do kategorii (dowód kompletności Vitest)

Każdy rekord w pliku dziedziczy kategorię z tabeli poniżej, poza `t2-sla-flow`, gdzie jawna asercja „assignment_kind=artifact” jest kategorią 5, a drugi rekord kategorią 3.

#### acceptance

| Plik | Rekordy | Kategoria |
|---|---:|---:|
| `tests/acceptance/access-codes-reconcile.e2e.test.ts` | 1 | 3 |
| `tests/acceptance/agent-audit.e2e.test.ts` | 1 | 4 |
| `tests/acceptance/aiExecutiveReporting.e2e.test.ts` | 1 | 4 |
| `tests/acceptance/backup-service-t7b2.e2e.test.ts` | 2 | 2 |
| `tests/acceptance/chat-005-proposal-approval-audit.realdb.test.ts` | 1 | 1 |
| `tests/acceptance/chat-007-009-owner-handoff-reopen.realdb.test.ts` | 1 | 1 |
| `tests/acceptance/fin-003-004-case-scenario-lifecycle.e2e.test.ts` | 3 | 2 |
| `tests/acceptance/fin-mvp-reconciliation.mounted.pg.test.ts` | 3 | 2 |
| `tests/acceptance/h1-chain.e2e.test.ts` | 3 | 1 |
| `tests/acceptance/h16-start-execution.e2e.test.ts` | 4 | 2 |
| `tests/acceptance/h3-dowody.e2e.test.ts` | 1 | 1 |
| `tests/acceptance/h31-swot-flow.e2e.test.ts` | 1 | 1 |
| `tests/acceptance/h44-m13-flow.e2e.test.ts` | 1 | 1 |
| `tests/acceptance/h52-n1-lists.e2e.test.ts` | 1 | 3 |
| `tests/acceptance/hp8-artifact-approvals.e2e.test.ts` | 3 | 1 |
| `tests/acceptance/int-008-candidate-handoff.e2e.test.ts` | 1 | 3 |
| `tests/acceptance/integrate--decision-initiative-block-gate.e2e.test.ts` | 2 | 1 |
| `tests/acceptance/interview-ai-suggestion-audit.e2e.test.ts` | 1 | 2 |
| `tests/acceptance/interview-assignment-delivery-readback.e2e.test.ts` | 1 | 2 |
| `tests/acceptance/interview-submit-review-lifecycle.e2e.test.ts` | 1 | 2 |
| `tests/acceptance/j21-oxford-o4.e2e.test.ts` | 1 | 3 |
| `tests/acceptance/j26-edit-step.e2e.test.ts` | 1 | 1 |
| `tests/acceptance/kpi-deviation-concurrency.e2e.test.ts` | 1 | 2 |
| `tests/acceptance/m01-p07b-teresa-handoff.realdb.test.ts` | 1 | 1 |
| `tests/acceptance/mgmt-reports-red4.e2e.test.ts` | 1 | 1 |
| `tests/acceptance/mw-dec-001-decision-workflow.e2e.test.ts` | 1 | 5 |
| `tests/acceptance/mw-dec-001-falsification-review.e2e.test.ts` | 1 | 1 |
| `tests/acceptance/myw-agent-approved-materialization.realdb.test.ts` | 1 | 3 |
| `tests/acceptance/notebook-tenant-isolation.e2e.test.ts` | 1 | 2 |
| `tests/acceptance/o1-siri-adma-initiatives.e2e.test.ts` | 4 | 1 |
| `tests/acceptance/odbior--deccase--initiative-status-case.e2e.test.ts` | 1 | 5 |
| `tests/acceptance/odbior--ets--ensuretools-no-log-spam.e2e.test.ts` | 1 | 1 |
| `tests/acceptance/odbior--exec3ax--three-axis-live.e2e.test.ts` | 1 | 1 |
| `tests/acceptance/odbior--fin003a--statement-import.e2e.test.ts` | 1 | 3 |
| `tests/acceptance/odbior--fin005--fresh-schema-golden-flow.e2e.test.ts` | 2 | 3 |
| `tests/acceptance/odbior--fin005--multi-section-recovery.e2e.test.ts` | 1 | 3 |
| `tests/acceptance/odbior--fin005--statement-ingestion-golden-flow.e2e.test.ts` | 1 | 3 |
| `tests/acceptance/odbior--fin005--statement-upload-tenant-isolation.e2e.test.ts` | 1 | 3 |
| `tests/acceptance/odbior--fin007--post-investment-actuals.e2e.test.ts` | 1 | 3 |
| `tests/acceptance/odbior--ini005--autostart-system-actor.e2e.test.ts` | 3 | 1 |
| `tests/acceptance/odbior--ini005--canonical-start-execution.e2e.test.ts` | 19 | 1 |
| `tests/acceptance/odbior--ini005--decision-race.e2e.test.ts` | 2 | 1 |
| `tests/acceptance/odbior--ini005--unblock-timeline-lockdown.e2e.test.ts` | 3 | 1 |
| `tests/acceptance/odbior--o4c--business-case-live.e2e.test.ts` | 1 | 4 |
| `tests/acceptance/odbior--t5--sanitizer-decode.e2e.test.ts` | 1 | 1 |
| `tests/acceptance/parity-3areas.e2e.test.ts` | 3 | 2 |
| `tests/acceptance/pmo-team-board.e2e.test.ts` | 1 | 4 |
| `tests/acceptance/red-admin-500s.e2e.test.ts` | 1 | 1 |
| `tests/acceptance/red-assess-500s.e2e.test.ts` | 8 | 5 |
| `tests/acceptance/red-final-500s.e2e.test.ts` | 2 | 4 |
| `tests/acceptance/red-sync-500s.e2e.test.ts` | 1 | 1 |
| `tests/acceptance/res003a-kpi-recovery-card.e2e.test.ts` | 15 | 2 |
| `tests/acceptance/rvn-cross-domain-gold-flow.e2e.test.ts` | 10 | 3 |
| `tests/acceptance/rvn-g4-roi-kpi-evidence-and-finance-truth.e2e.test.ts` | 4 | 3 |
| `tests/acceptance/rvn-g4-roi-perspectives-parity.e2e.test.ts` | 2 | 3 |
| `tests/acceptance/rvn-outbox-mywork-projection.e2e.test.ts` | 9 | 3 |
| `tests/acceptance/t2-sla-flow.e2e.test.ts` | 1 | 3 |
| `tests/acceptance/t2-sla-flow.e2e.test.ts` | 1 | 5 |
| `tests/acceptance/teresa-live-toolcall-tools.e2e.test.ts` | 1 | 4 |
| `tests/acceptance/teresa-live-toolcall.e2e.test.ts` | 1 | 4 |

#### unit

| Plik | Rekordy | Kategoria |
|---|---:|---:|
| `tests/unit/AIChat/agentPlanPanel.blocksToSteps.test.ts` | 1 | 2 |
| `tests/unit/api.test.ts` | 2 | 2 |
| `tests/unit/auth/auth.middleware.private.test.ts` | 1 | 2 |
| `tests/unit/backend/agentProductionBuildBoundary.test.ts` | 2 | 2 |
| `tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts` | 1 | 2 |
| `tests/unit/backend/controllers/AuthController.test.ts` | 1 | 2 |
| `tests/unit/backend/controllers/DecisionController.test.ts` | 5 | 2 |
| `tests/unit/backend/controllers/InitiativeController.test.ts` | 9 | 2 |
| `tests/unit/backend/controllers/InterviewAssignmentsController.test.ts` | 8 | 2 |
| `tests/unit/backend/controllers/OrganizationController.audit.test.ts` | 2 | 2 |
| `tests/unit/backend/controllers/adminAudit.emission.test.ts` | 3 | 2 |
| `tests/unit/backend/database/mockDatabase.test.ts` | 2 | 2 |
| `tests/unit/backend/generateDeliverable.canvasTools.test.ts` | 1 | 2 |
| `tests/unit/backend/harvardModuleContract.test.ts` | 1 | 1 |
| `tests/unit/backend/helpChat.routes.test.ts` | 1 | 2 |
| `tests/unit/backend/middleware/apiKeyAuth.middleware.test.ts` | 18 | 2 |
| `tests/unit/backend/middleware/orgContext.middleware.test.ts` | 45 | 3 |
| `tests/unit/backend/middleware/rateLimiting.middleware.test.ts` | 1 | 2 |
| `tests/unit/backend/notificationService.test.js` | 3 | 2 |
| `tests/unit/backend/organizationService.test.js` | 1 | 2 |
| `tests/unit/backend/permissionService.test.ts` | 2 | 2 |
| `tests/unit/backend/routes/accessRoleBuilder.security.test.ts` | 1 | 2 |
| `tests/unit/backend/routes/adminP32.security-audit.test.ts` | 1 | 1 |
| `tests/unit/backend/routes/document-studio.routes.leak-guard.test.ts` | 1 | 2 |
| `tests/unit/backend/routes/h64-failsoft-batch6.test.ts` | 2 | 2 |
| `tests/unit/backend/routes/interview.routes.org-guard.test.ts` | 1 | 2 |
| `tests/unit/backend/routes/metricsOrgRoutes.test.ts` | 6 | 2 |
| `tests/unit/backend/routes/partner-payouts-auth.test.ts` | 2 | 2 |
| `tests/unit/backend/routes/pmo-decisions.routes.org-guard.test.ts` | 1 | 2 |
| `tests/unit/backend/routes/pmo-initiatives.routes.org-guard.test.ts` | 1 | 2 |
| `tests/unit/backend/routes/pmo-initiatives.routes.program-rollup.test.ts` | 4 | 2 |
| `tests/unit/backend/routes/tools.routes.org-guard.test.ts` | 1 | 2 |
| `tests/unit/backend/services/UnifiedExportService.test.ts` | 2 | 4 |
| `tests/unit/backend/services/adminSessionService.test.ts` | 1 | 2 |
| `tests/unit/backend/services/artifactRegistryService.test.ts` | 1 | 2 |
| `tests/unit/backend/services/documentStudio/documentBlockProseGenerator.warnings.test.ts` | 1 | 2 |
| `tests/unit/backend/services/generateDeliverableTool.test.ts` | 1 | 2 |
| `tests/unit/backend/services/partnerCertificatePdf.test.ts` | 2 | 4 |
| `tests/unit/backend/services/partnerToolkitResources.test.ts` | 2 | 4 |
| `tests/unit/backend/services/presentationGeneratorService.evidencePersist.test.ts` | 1 | 2 |
| `tests/unit/backend/services/presentationGeneratorService.narrativeExtended.test.ts` | 3 | 2 |
| `tests/unit/backend/services/systemAlertNotifier.test.ts` | 2 | 2 |
| `tests/unit/backend/slackRouter.test.ts` | 1 | 1 |
| `tests/unit/backend/subscriptionAnalyticsService.test.ts` | 1 | 3 |
| `tests/unit/backend/taskService.test.js` | 2 | 2 |
| `tests/unit/backend/userService.test.js` | 2 | 2 |
| `tests/unit/backend/utils/queryHelpers.test.ts` | 17 | 2 |
| `tests/unit/backend/v4-smoke/r1-context-pack.test.ts` | 1 | 2 |
| `tests/unit/backend/wave8AgentRuntimeService.test.ts` | 7 | 2 |
| `tests/unit/components/Admin/AIMissionControl.honesty.test.tsx` | 3 | 1 |
| `tests/unit/components/Admin/AdminRiskSummaryPanel.test.tsx` | 1 | 1 |
| `tests/unit/components/MyWork/QuickFilterBar.test.tsx` | 1 | 2 |
| `tests/unit/components/Organization/KnowledgeGraphExplorer.smoke.test.tsx` | 3 | 1 |
| `tests/unit/components/Organization/OrganizationView.smoke.test.tsx` | 1 | 2 |
| `tests/unit/components/ProposalCard.test.tsx` | 2 | 2 |
| `tests/unit/components/ReportsAndPresentations/artifactNavigation.test.ts` | 1 | 2 |
| `tests/unit/components/SuperAdmin/ModelRegistry/ModelCatalogTable.honesty.test.tsx` | 2 | 1 |
| `tests/unit/components/settings/MappingDriftPanel.honesty.test.tsx` | 1 | 1 |
| `tests/unit/createInitiativeFromMove.roundtrip.test.ts` | 2 | 1 |
| `tests/unit/deliverables/deliverableTemplateService.test.ts` | 4 | 2 |
| `tests/unit/deliverables/documentDocxGolden.test.ts` | 1 | 1 |
| `tests/unit/deliverables/documentPdfGolden.test.ts` | 13 | 4 |
| `tests/unit/deliverables/templateCrud.test.ts` | 4 | 2 |
| `tests/unit/deliverables/workbookBuilderCf.test.ts` | 5 | 1 |
| `tests/unit/execution/benefitsRegisterService.test.ts` | 4 | 2 |
| `tests/unit/execution/reportPdfService.test.ts` | 4 | 4 |
| `tests/unit/finance/financeFallbackGating.test.ts` | 2 | 2 |
| `tests/unit/helpTranslations.test.ts` | 1 | 3 |
| `tests/unit/hooks/useTemplates.canonicalArtifacts.test.tsx` | 1 | 2 |
| `tests/unit/i18n/idea-workspace-required-keys.test.ts` | 2 | 3 |
| `tests/unit/i18n/s2-locale-added-keys.test.ts` | 8 | 3 |
| `tests/unit/initiativeDocumentView.section-ai-noop.test.ts` | 1 | 5 |
| `tests/unit/initiatives-execution/canonicalInitiativeCardWorkspace.test.tsx` | 1 | 2 |
| `tests/unit/initiatives-execution/initiativesHubCanonicalTabs.test.tsx` | 2 | 2 |
| `tests/unit/initiatives-execution/portfolioScenarioSurface.test.tsx` | 1 | 3 |
| `tests/unit/initiatives-execution/sourceProposalRegistrationWorkbench.test.tsx` | 1 | 3 |
| `tests/unit/initiatives/resourceLoadMath.test.ts` | 1 | 3 |
| `tests/unit/migrationRunnerOrdering.test.ts` | 1 | 3 |
| `tests/unit/mindmap/canvasLeftToolbar.test.tsx` | 3 | 2 |
| `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx` | 3 | 2 |
| `tests/unit/mindmap/floatingNodeToolbar.test.tsx` | 2 | 2 |
| `tests/unit/mindmap/floatingToolbarDropdowns.test.tsx` | 7 | 2 |
| `tests/unit/mindmap/hydrationRegression.test.ts` | 1 | 2 |
| `tests/unit/mindmap/moreToolsPanel.test.tsx` | 3 | 2 |
| `tests/unit/results/resultsFinanceReconciliationService.postmortem.test.ts` | 3 | 1 |
| `tests/unit/scripts/adminOwnerFixtureGuard.test.ts` | 1 | 3 |
| `tests/unit/scripts/g4FocusMeasurement.contract.test.ts` | 1 | 3 |
| `tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts` | 13 | 4 |
| `tests/unit/server/utils/queryHelpers.test.ts` | 10 | 2 |
| `tests/unit/services/drdAxisDataGuard.test.ts` | 1 | 2 |
| `tests/unit/services/v8-execution-control-api.test.ts` | 1 | 2 |
| `tests/unit/services/v8-my-work-api.test.ts` | 1 | 2 |
| `tests/unit/services/v8-results-api.test.ts` | 12 | 2 |
| `tests/unit/services/valuationService.defaultAssumptions.test.ts` | 1 | 2 |
| `tests/unit/table/AITableProposal.test.tsx` | 4 | 2 |
| `tests/unit/table/useTableSchema.test.ts` | 10 | 2 |
| `tests/unit/table/useTableViews.test.ts` | 11 | 2 |
| `tests/unit/testing/testDiscoveryGate.test.ts` | 1 | 2 |
| `tests/unit/utils/betaAccessGating.test.ts` | 2 | 2 |
| `tests/unit/utils/initiativeWorkflowStatus.test.ts` | 1 | 2 |
| `tests/unit/utils/myWorkNotebookRbacGates.test.ts` | 1 | 2 |
| `tests/unit/utils/publicProduction.test.ts` | 1 | 2 |
| `tests/unit/views/superadmin/AdminAuditLogsView.honesty.test.tsx` | 2 | 1 |
| `tests/unit/views/superadmin/AdminSessionsView.honesty.test.tsx` | 4 | 1 |
| `tests/unit/views/superadmin/ApprovalWorkflowsView.honesty.test.tsx` | 4 | 1 |
| `tests/unit/views/superadmin/AuditEventsViewer.honesty.test.tsx` | 2 | 1 |
| `tests/unit/views/superadmin/DLPView.honesty.test.tsx` | 7 | 1 |
| `tests/unit/views/superadmin/DeviceManagementView.honesty.test.tsx` | 1 | 1 |
| `tests/unit/views/superadmin/DocumentsRAGTab.honesty.test.tsx` | 3 | 1 |
| `tests/unit/views/superadmin/IPWhitelistView.honesty.test.tsx` | 3 | 1 |
| `tests/unit/views/superadmin/SCIMProvisioningView.honesty.test.tsx` | 3 | 1 |
| `tests/unit/views/superadmin/SecurityEventsView.honesty.test.tsx` | 5 | 1 |
| `tests/unit/views/superadmin/SecurityIncidentsView.honesty.test.tsx` | 7 | 1 |
| `tests/unit/views/superadmin/SuperAdminLegalView.honesty.test.tsx` | 7 | 1 |
| `tests/unit/views/superadmin/SuperAdminStorageDetailModal.honesty.test.tsx` | 2 | 1 |
| `tests/unit/views/superadmin/SupportTicketsView.honesty.test.tsx` | 2 | 1 |
| `tests/unit/views/superadmin/ThreatIntelligenceView.honesty.test.tsx` | 5 | 1 |
| `tests/unit/views/superadmin/components/BulkOperationsView.honesty.test.tsx` | 1 | 1 |

#### initiatives

| Plik | Rekordy | Kategoria |
|---|---:|---:|
| `tests/unit/initiativeDocumentView.section-ai-noop.test.ts` | 1 | 5 |
| `tests/unit/initiatives-execution/canonicalInitiativeCardWorkspace.test.tsx` | 1 | 2 |
| `tests/unit/initiatives-execution/initiativesHubCanonicalTabs.test.tsx` | 2 | 2 |
| `tests/unit/initiatives-execution/portfolioScenarioSurface.test.tsx` | 1 | 3 |
| `tests/unit/initiatives-execution/sourceProposalRegistrationWorkbench.test.tsx` | 1 | 3 |
| `tests/unit/initiatives/resourceLoadMath.test.ts` | 1 | 3 |

## C. Grupy przyczyn źródłowych

Hipoteza jest **prawdziwa**. Nie ma 49 tysięcy niezależnych problemów. Jedna reguła formatująca daje 96,5% wszystkich lint errors, a kilka pojedynczych awarii fixture/mock generuje dziesiątki czerwonych asercji.

| Przyczyna źródłowa | Porażki | Przykład | Praca |
|---|---:|---|---|
| Repo nie jest zgodne z aktualnym formatem Prettier; jedna reguła mnoży sygnał na całym drzewie. | **47 381 lint errors** | `server/src/routes/caseWorkspace/__tests__/contract/openapiSchemaValidity.contract.test.ts:1` (1 090 komunikatów w pliku) | duży mechanicznie, mały decyzyjnie |
| Importy nie są posortowane zgodnie z aktualną konfiguracją. | **1 092 lint errors** (1 065 imports + 27 exports) | pierwszy wpis z raportu ESLint dla reguły `simple-import-sort/imports` | średni |
| Cleanup fixture orgContext usuwa organizację przed zależnymi users, więc jeden FK wywraca cały plik. | **45 unit failures** | `tests/unit/backend/middleware/orgContext.middleware.test.ts:1` | mały |
| Fixture/harness owner/runtime próbuje łączyć się z nieuruchomionym portem 34940 i oczekuje innego komunikatu guarda. | **13 unit failures** | `tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts:244` | średni |
| PDFKit dostaje zasób, którego nie rozpoznaje jako font ani standardowy font PDF. | **23 unit failures** | `tests/unit/deliverables/documentPdfGolden.test.ts:1` | średni |
| Stare mocki nie eksportują nowych symboli albo test woła usunięte metody; import/API drift powoduje całe klastry. | **co najmniej 82 unit failures** | `tests/unit/backend/middleware/apiKeyAuth.middleware.test.ts:922`, `tests/unit/backend/utils/queryHelpers.test.ts:1` | średni |
| Braki danych lokalizacyjnych są skupione w kilku gate'ach, a nie w tysiącach niezależnych testów. | **11 czerwonych testów**; komunikaty raportują m.in. 1 757 brakujących kluczy DE w jednym gate | `tests/unit/i18n/s2-locale-added-keys.test.ts:1` | duży |
| Zaostrzone role/owner grants i brak odpowiednich fixture powodują kaskady ROI/KPI/outbox. | **25 acceptance failures** w trzech głównych plikach ROI/outbox | `tests/acceptance/rvn-cross-domain-gold-flow.e2e.test.ts:216` | średni |
| Stare testy wywołują trasy wycofane do 410 albo oczekują dawnych kodów 400/403 zamiast nowych precondition 409/428. | **co najmniej 35 acceptance failures** | `tests/acceptance/res003a-kpi-recovery-card.e2e.test.ts:547` | średni |
| Kanoniczna bramka start/unblock inicjatywy zwraca 409 lub nie przechodzi mimo seeded GO; wspólna przyczyna skupia macierz. | **31 acceptance failures** | `tests/acceptance/odbior--ini005--canonical-start-execution.e2e.test.ts:394` | duży |
| Live-LLM/API-key i not-configured routes są niemożliwe do potwierdzenia w tym dyżurze bez naruszenia zakazu połączeń zewnętrznych. | **8 acceptance records** | `tests/acceptance/teresa-live-toolcall.e2e.test.ts:1` | średni / zależny od polityki |

Pozostałe błędy są długim ogonem. Lint poza dwoma głównymi regułami ma tylko 33 komunikaty w 11 regułach (m.in. 18 `prefer-const`, 3 rules-of-hooks).

## D. Rozłączne pakiety naprawcze

Podział jest ścieżkowy i bezkonfliktowy. Lista powstała jako suma: 1 924 plików z lint error, wszystkich czerwonych plików Vitest, 6 nowych plików quality-check, pliku z 26 blokowanymi skipami oraz jawnych źródeł wskazanych przez stack/kontrakt. Kontrola: 2113 pozycji, 2113 unikalnych; **rozłączność = PASS**. Każdy plik występuje dokładnie w jednym pakiecie.

| Pakiet | Zakres | Pliki | Estymata |
|---|---|---:|---|
| P1 | Acceptance: fixture, kontrakty, pins, import/suite failures i format | 59 | duży |
| P2 | Unit backend: mock/API drift, DB cleanup, bezpieczeństwo i format | 48 | duży |
| P3 | Pozostałe testy: UI/i18n/initiatives/deliverables/gate'y jakości | 77 | duży |
| P4 | Backend produkcyjny i backendowe testy colocated | 1089 | duży |
| P5 | Frontend produkcyjny | 772 | duży |
| P6 | Infra/skrypty/dev-render/docs wygenerowane i pozostałe pliki | 68 | średni |

Pakiety mogą pisać równolegle, ale acceptance P1 oraz produkt P4/P5 nie będą niezależnie zielone przed integracją. Zakaz konfliktów plikowych jest spełniony; zależność wynikowa pozostaje jawna.

### P1 — dokładna lista plików

- `tests/acceptance/access-codes-reconcile.e2e.test.ts`
- `tests/acceptance/agent-audit.e2e.test.ts`
- `tests/acceptance/aiExecutiveReporting.e2e.test.ts`
- `tests/acceptance/backup-service-t7b2.e2e.test.ts`
- `tests/acceptance/chat-005-proposal-approval-audit.realdb.test.ts`
- `tests/acceptance/chat-007-009-owner-handoff-reopen.realdb.test.ts`
- `tests/acceptance/fin-003-004-case-scenario-lifecycle.e2e.test.ts`
- `tests/acceptance/fin-mvp-reconciliation.mounted.pg.test.ts`
- `tests/acceptance/h1-chain.e2e.test.ts`
- `tests/acceptance/h16-start-execution.e2e.test.ts`
- `tests/acceptance/h3-dowody.e2e.test.ts`
- `tests/acceptance/h31-swot-flow.e2e.test.ts`
- `tests/acceptance/h44-m13-flow.e2e.test.ts`
- `tests/acceptance/h52-n1-lists.e2e.test.ts`
- `tests/acceptance/hp8-artifact-approvals.e2e.test.ts`
- `tests/acceptance/int-008-candidate-handoff.e2e.test.ts`
- `tests/acceptance/integrate--decision-initiative-block-gate.e2e.test.ts`
- `tests/acceptance/interview-ai-suggestion-audit.e2e.test.ts`
- `tests/acceptance/interview-assignment-delivery-readback.e2e.test.ts`
- `tests/acceptance/interview-submit-review-lifecycle.e2e.test.ts`
- `tests/acceptance/j21-oxford-o4.e2e.test.ts`
- `tests/acceptance/j26-edit-step.e2e.test.ts`
- `tests/acceptance/kpi-deviation-concurrency.e2e.test.ts`
- `tests/acceptance/m01-p07b-teresa-handoff.realdb.test.ts`
- `tests/acceptance/mgmt-reports-red4.e2e.test.ts`
- `tests/acceptance/mw-dec-001-decision-workflow.e2e.test.ts`
- `tests/acceptance/mw-dec-001-falsification-review.e2e.test.ts`
- `tests/acceptance/myw-agent-approved-materialization.realdb.test.ts`
- `tests/acceptance/notebook-tenant-isolation.e2e.test.ts`
- `tests/acceptance/o1-siri-adma-initiatives.e2e.test.ts`
- `tests/acceptance/odbior--deccase--initiative-status-case.e2e.test.ts`
- `tests/acceptance/odbior--ets--ensuretools-no-log-spam.e2e.test.ts`
- `tests/acceptance/odbior--exec3ax--three-axis-live.e2e.test.ts`
- `tests/acceptance/odbior--fin003a--statement-import.e2e.test.ts`
- `tests/acceptance/odbior--fin005--fresh-schema-golden-flow.e2e.test.ts`
- `tests/acceptance/odbior--fin005--multi-section-recovery.e2e.test.ts`
- `tests/acceptance/odbior--fin005--statement-ingestion-golden-flow.e2e.test.ts`
- `tests/acceptance/odbior--fin005--statement-upload-tenant-isolation.e2e.test.ts`
- `tests/acceptance/odbior--fin007--post-investment-actuals.e2e.test.ts`
- `tests/acceptance/odbior--ini005--autostart-system-actor.e2e.test.ts`
- `tests/acceptance/odbior--ini005--canonical-start-execution.e2e.test.ts`
- `tests/acceptance/odbior--ini005--decision-race.e2e.test.ts`
- `tests/acceptance/odbior--ini005--unblock-timeline-lockdown.e2e.test.ts`
- `tests/acceptance/odbior--o4c--business-case-live.e2e.test.ts`
- `tests/acceptance/odbior--t5--sanitizer-decode.e2e.test.ts`
- `tests/acceptance/parity-3areas.e2e.test.ts`
- `tests/acceptance/pmo-team-board.e2e.test.ts`
- `tests/acceptance/red-admin-500s.e2e.test.ts`
- `tests/acceptance/red-assess-500s.e2e.test.ts`
- `tests/acceptance/red-final-500s.e2e.test.ts`
- `tests/acceptance/red-sync-500s.e2e.test.ts`
- `tests/acceptance/res003a-kpi-recovery-card.e2e.test.ts`
- `tests/acceptance/rvn-cross-domain-gold-flow.e2e.test.ts`
- `tests/acceptance/rvn-g4-roi-kpi-evidence-and-finance-truth.e2e.test.ts`
- `tests/acceptance/rvn-g4-roi-perspectives-parity.e2e.test.ts`
- `tests/acceptance/rvn-outbox-mywork-projection.e2e.test.ts`
- `tests/acceptance/t2-sla-flow.e2e.test.ts`
- `tests/acceptance/teresa-live-toolcall-tools.e2e.test.ts`
- `tests/acceptance/teresa-live-toolcall.e2e.test.ts`

### P2 — dokładna lista plików

- `tests/unit/backend/agentProductionBuildBoundary.test.ts`
- `tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts`
- `tests/unit/backend/aiSettingsService.test.ts`
- `tests/unit/backend/controllers/AuthController.test.ts`
- `tests/unit/backend/controllers/DecisionController.test.ts`
- `tests/unit/backend/controllers/InitiativeController.test.ts`
- `tests/unit/backend/controllers/InterviewAssignmentsController.test.ts`
- `tests/unit/backend/controllers/OrganizationController.audit.test.ts`
- `tests/unit/backend/controllers/adminAudit.emission.test.ts`
- `tests/unit/backend/database/mockDatabase.test.ts`
- `tests/unit/backend/generateDeliverable.canvasTools.test.ts`
- `tests/unit/backend/harvardModuleContract.test.ts`
- `tests/unit/backend/helpChat.routes.test.ts`
- `tests/unit/backend/middleware/apiKeyAuth.middleware.test.ts`
- `tests/unit/backend/middleware/orgContext.middleware.test.ts`
- `tests/unit/backend/middleware/rateLimiting.middleware.test.ts`
- `tests/unit/backend/notificationService.test.js`
- `tests/unit/backend/organizationService.test.js`
- `tests/unit/backend/permissionService.test.ts`
- `tests/unit/backend/routes/accessRoleBuilder.security.test.ts`
- `tests/unit/backend/routes/adminP32.security-audit.test.ts`
- `tests/unit/backend/routes/document-studio.routes.leak-guard.test.ts`
- `tests/unit/backend/routes/h64-failsoft-batch6.test.ts`
- `tests/unit/backend/routes/interview.routes.org-guard.test.ts`
- `tests/unit/backend/routes/metricsOrgRoutes.test.ts`
- `tests/unit/backend/routes/partner-payouts-auth.test.ts`
- `tests/unit/backend/routes/pmo-decisions.routes.org-guard.test.ts`
- `tests/unit/backend/routes/pmo-initiatives.routes.org-guard.test.ts`
- `tests/unit/backend/routes/pmo-initiatives.routes.program-rollup.test.ts`
- `tests/unit/backend/routes/tools.routes.org-guard.test.ts`
- `tests/unit/backend/services/UnifiedExportService.test.ts`
- `tests/unit/backend/services/adminSessionService.test.ts`
- `tests/unit/backend/services/artifactRegistryService.test.ts`
- `tests/unit/backend/services/documentStudio/documentBlockProseGenerator.warnings.test.ts`
- `tests/unit/backend/services/generateDeliverableTool.test.ts`
- `tests/unit/backend/services/partnerCertificatePdf.test.ts`
- `tests/unit/backend/services/partnerToolkitResources.test.ts`
- `tests/unit/backend/services/presentationGeneratorService.evidencePersist.test.ts`
- `tests/unit/backend/services/presentationGeneratorService.narrativeExtended.test.ts`
- `tests/unit/backend/services/systemAlertNotifier.test.ts`
- `tests/unit/backend/slackRouter.test.ts`
- `tests/unit/backend/subscriptionAnalyticsService.test.ts`
- `tests/unit/backend/taskService.test.js`
- `tests/unit/backend/userService.test.js`
- `tests/unit/backend/utils/queryHelpers.test.ts`
- `tests/unit/backend/v4-smoke/r1-context-pack.test.ts`
- `tests/unit/backend/wave8AgentRuntimeService.test.ts`
- `tests/unit/backend/whatsappService.test.ts`

### P3 — dokładna lista plików

- `tests/integration/partners/m16-final-repair.realdb.test.ts`
- `tests/resultsVnext/okr/alignmentNoScoreMutation.static.test.ts`
- `tests/unit/AIChat/agentPlanPanel.blocksToSteps.test.ts`
- `tests/unit/api.test.ts`
- `tests/unit/auth/auth.middleware.private.test.ts`
- `tests/unit/components/Admin/AIMissionControl.honesty.test.tsx`
- `tests/unit/components/Admin/AdminRiskSummaryPanel.test.tsx`
- `tests/unit/components/MyWork/QuickFilterBar.test.tsx`
- `tests/unit/components/Organization/KnowledgeGraphExplorer.smoke.test.tsx`
- `tests/unit/components/Organization/OrganizationView.smoke.test.tsx`
- `tests/unit/components/ProposalCard.test.tsx`
- `tests/unit/components/ReportsAndPresentations/artifactNavigation.test.ts`
- `tests/unit/components/SuperAdmin/ModelRegistry/ModelCatalogTable.honesty.test.tsx`
- `tests/unit/components/settings/MappingDriftPanel.honesty.test.tsx`
- `tests/unit/config/wave3DotenvIsolation.test.ts`
- `tests/unit/createInitiativeFromMove.roundtrip.test.ts`
- `tests/unit/deliverables/deliverableTemplateService.test.ts`
- `tests/unit/deliverables/documentDocxGolden.test.ts`
- `tests/unit/deliverables/documentPdfGolden.test.ts`
- `tests/unit/deliverables/templateCrud.test.ts`
- `tests/unit/deliverables/workbookBuilderCf.test.ts`
- `tests/unit/execution/benefitsRegisterService.test.ts`
- `tests/unit/execution/reportPdfService.test.ts`
- `tests/unit/finance/financeFallbackGating.test.ts`
- `tests/unit/helpTranslations.test.ts`
- `tests/unit/hooks/useTemplates.canonicalArtifacts.test.tsx`
- `tests/unit/i18n/idea-workspace-required-keys.test.ts`
- `tests/unit/i18n/s2-locale-added-keys.test.ts`
- `tests/unit/initiativeDocumentView.section-ai-noop.test.ts`
- `tests/unit/initiatives-execution/canonicalInitiativeCardWorkspace.test.tsx`
- `tests/unit/initiatives-execution/initiativesHubCanonicalTabs.test.tsx`
- `tests/unit/initiatives-execution/portfolioScenarioSurface.test.tsx`
- `tests/unit/initiatives-execution/sourceProposalRegistrationWorkbench.test.tsx`
- `tests/unit/initiatives/resourceLoadMath.test.ts`
- `tests/unit/migrationRunnerOrdering.test.ts`
- `tests/unit/mindmap/canvasLeftToolbar.test.tsx`
- `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx`
- `tests/unit/mindmap/floatingNodeToolbar.test.tsx`
- `tests/unit/mindmap/floatingToolbarDropdowns.test.tsx`
- `tests/unit/mindmap/hydrationRegression.test.ts`
- `tests/unit/mindmap/moreToolsPanel.test.tsx`
- `tests/unit/results/resultsFinanceReconciliationService.postmortem.test.ts`
- `tests/unit/scripts/adminOwnerFixtureGuard.test.ts`
- `tests/unit/scripts/g4FocusMeasurement.contract.test.ts`
- `tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts`
- `tests/unit/server/utils/queryHelpers.test.ts`
- `tests/unit/services/auditIntegrityService.test.ts`
- `tests/unit/services/drdAxisDataGuard.test.ts`
- `tests/unit/services/ssoAzureAD.test.ts`
- `tests/unit/services/v8-execution-control-api.test.ts`
- `tests/unit/services/v8-my-work-api.test.ts`
- `tests/unit/services/v8-results-api.test.ts`
- `tests/unit/services/valuationService.defaultAssumptions.test.ts`
- `tests/unit/table/AITableProposal.test.tsx`
- `tests/unit/table/useTableSchema.test.ts`
- `tests/unit/table/useTableViews.test.ts`
- `tests/unit/testing/testDiscoveryGate.test.ts`
- `tests/unit/utils/betaAccessGating.test.ts`
- `tests/unit/utils/initiativeWorkflowStatus.test.ts`
- `tests/unit/utils/myWorkNotebookRbacGates.test.ts`
- `tests/unit/utils/publicProduction.test.ts`
- `tests/unit/views/superadmin/AdminAuditLogsView.honesty.test.tsx`
- `tests/unit/views/superadmin/AdminSessionsView.honesty.test.tsx`
- `tests/unit/views/superadmin/ApprovalWorkflowsView.honesty.test.tsx`
- `tests/unit/views/superadmin/AuditEventsViewer.honesty.test.tsx`
- `tests/unit/views/superadmin/DLPView.honesty.test.tsx`
- `tests/unit/views/superadmin/DeviceManagementView.honesty.test.tsx`
- `tests/unit/views/superadmin/DocumentsRAGTab.honesty.test.tsx`
- `tests/unit/views/superadmin/IPWhitelistView.honesty.test.tsx`
- `tests/unit/views/superadmin/SCIMProvisioningView.honesty.test.tsx`
- `tests/unit/views/superadmin/SecurityEventsView.honesty.test.tsx`
- `tests/unit/views/superadmin/SecurityIncidentsView.honesty.test.tsx`
- `tests/unit/views/superadmin/SuperAdminLegalView.honesty.test.tsx`
- `tests/unit/views/superadmin/SuperAdminStorageDetailModal.honesty.test.tsx`
- `tests/unit/views/superadmin/SupportTicketsView.honesty.test.tsx`
- `tests/unit/views/superadmin/ThreatIntelligenceView.honesty.test.tsx`
- `tests/unit/views/superadmin/components/BulkOperationsView.honesty.test.tsx`

### P4 — dokładna lista plików

- `server/src/Gateway.ts`
- `server/src/ai/actionExecutionAdapter.ts`
- `server/src/ai/actionExecutors/playbookExecutor.ts`
- `server/src/ai/aiPlaybookExecutor.ts`
- `server/src/ai/asyncJobService.ts`
- `server/src/ai/legacyNoncanonicalExecution.ts`
- `server/src/config/__tests__/databaseIdentity.test.ts`
- `server/src/config/__tests__/databaseTargetResolver.test.ts`
- `server/src/config/databaseIdentity.ts`
- `server/src/config/databaseTargetResolver.ts`
- `server/src/config/rateLimitPosture.ts`
- `server/src/controllers/AdminIamController.ts`
- `server/src/controllers/AssessmentController.ts`
- `server/src/controllers/AuthController.ts`
- `server/src/controllers/CapacityController.ts`
- `server/src/controllers/DecisionController.ts`
- `server/src/controllers/ExecutionController.ts`
- `server/src/controllers/InterviewController.ts`
- `server/src/controllers/StageGateController.ts`
- `server/src/controllers/ToolController.ts`
- `server/src/controllers/UserController.ts`
- `server/src/controllers/__tests__/ini005-portfolio-resources-roadmap.pg.test.ts`
- `server/src/controllers/__tests__/superadminMfaMethods.pg.test.ts`
- `server/src/controllers/__tests__/voice.controller.retention.test.ts`
- `server/src/cron/BackupCron.ts`
- `server/src/cron/Scheduler.ts`
- `server/src/cron/__tests__/adminIamAlertEvaluatorScheduler.test.ts`
- `server/src/cron/__tests__/auditIndependenceDetectorSchedulerFlag.test.ts`
- `server/src/database/Database.ts`
- `server/src/database/DatabaseInitializer.ts`
- `server/src/database/PostgresDatabase.ts`
- `server/src/database/__tests__/closeoutCo8RuntimeDdlInitiativesStatusDefault.pg.test.ts`
- `server/src/domain/initiatives-execution/__tests__/planSolver.test.ts`
- `server/src/domain/initiatives-execution/__tests__/reportReconstruction.test.ts`
- `server/src/domain/initiatives-execution/executionControlKpiPolicyAuthoring.ts`
- `server/src/domain/initiatives-execution/planAnalysisProposal.ts`
- `server/src/domain/initiatives-execution/postgresInitiativeReader.ts`
- `server/src/gateways/__tests__/collabWsOrgSuspension.test.ts`
- `server/src/gateways/ideaCollabWs.gateway.ts`
- `server/src/gateways/notebookCollabWs.gateway.ts`
- `server/src/gateways/presentationCollabWs.gateway.ts`
- `server/src/index.ts`
- `server/src/jobs/__tests__/adminIamAlertEvaluationJob.test.ts`
- `server/src/jobs/__tests__/agentPlanSchedulerContextGate.test.ts`
- `server/src/jobs/adminIamAlertEvaluationJob.ts`
- `server/src/jobs/agentPlanSchedulerJob.ts`
- `server/src/jobs/auditIndependenceDetectorJob.ts`
- `server/src/jobs/workSignalProducerJob.ts`
- `server/src/method-core/MethodEventStore.ts`
- `server/src/method-core/MethodPackRegistry.ts`
- `server/src/method-core/MethodSessionService.ts`
- `server/src/method-core/TeresaProposalService.ts`
- `server/src/method-core/__tests__/MethodEventStore.test.ts`
- `server/src/method-core/__tests__/MethodPackRegistry.test.ts`
- `server/src/method-core/__tests__/MethodSessionService.test.ts`
- `server/src/method-core/__tests__/TeresaProposalService.test.ts`
- `server/src/method-core/__tests__/clientContractParity.integration.test.ts`
- `server/src/method-core/__tests__/contractMirrorDrift.test.ts`
- `server/src/method-core/__tests__/drdVerticalSlice.e2e.test.ts`
- `server/src/method-core/__tests__/freezeOutputFlow.integration.test.ts`
- `server/src/method-core/__tests__/http.integration.test.ts`
- `server/src/method-core/__tests__/httpDownstreamListing.integration.test.ts`
- `server/src/method-core/__tests__/httpSessionsListing.integration.test.ts`
- `server/src/method-core/__tests__/httpTeresaGuardrails.integration.test.ts`
- `server/src/method-core/__tests__/reopenCarriesRoster.integration.test.ts`
- `server/src/method-core/__tests__/rolesAndApprovals.http.pg.test.ts`
- `server/src/method-core/__tests__/siriFullFlow.integration.test.ts`
- `server/src/method-core/contracts/events.ts`
- `server/src/method-core/contracts/index.ts`
- `server/src/method-core/contracts/methodPack.ts`
- `server/src/method-core/contracts/session.ts`
- `server/src/method-core/contracts/teresa.ts`
- `server/src/method-core/db.ts`
- `server/src/method-core/index.ts`
- `server/src/method-core/outputs/EventDerivedOutputBridge.ts`
- `server/src/method-core/outputs/MethodInitiativeDraftService.ts`
- `server/src/method-core/outputs/__tests__/EventDerivedOutputBridge.test.ts`
- `server/src/method-core/outputs/__tests__/MethodInitiativeDraftService.test.ts`
- `server/src/method-core/outputs/__tests__/MethodOutputService.test.ts`
- `server/src/method-core/outputs/__tests__/supersession.test.ts`
- `server/src/method-core/outputs/__tests__/testFixtures.ts`
- `server/src/method-core/outputs/index.ts`
- `server/src/middleware/__tests__/apiKeyOrgSuspension.middleware.test.ts`
- `server/src/middleware/__tests__/auditsStrictMembership.middleware.test.ts`
- `server/src/middleware/__tests__/organizationSuspensionEnforcement.middleware.test.ts`
- `server/src/middleware/__tests__/resultsStrictMembership.middleware.test.ts`
- `server/src/middleware/apiKeyAuth.middleware.ts`
- `server/src/middleware/auditsStrictMembership.middleware.ts`
- `server/src/middleware/auth.middleware.ts`
- `server/src/middleware/metrics.middleware.ts`
- `server/src/middleware/orgContext.middleware.ts`
- `server/src/middleware/rateLimitUserId.middleware.ts`
- `server/src/middleware/rateLimiting.middleware.ts`
- `server/src/middleware/requireAudit.middleware.ts`
- `server/src/middleware/resultsInternalBetaVisibility.middleware.ts`
- `server/src/middleware/superAdmin.middleware.ts`
- `server/src/realtime/__tests__/socketAuthJoinOrgCacheBound.test.ts`
- `server/src/realtime/__tests__/socketAuthOrgSuspension.test.ts`
- `server/src/realtime/demoRealtimeGuard.ts`
- `server/src/realtime/ideaMapAccess.ts`
- `server/src/realtime/socketAuth.ts`
- `server/src/routes/__tests__/admin-bulk.membership.pg.test.ts`
- `server/src/routes/__tests__/adminP32.auditProjection.pg.test.ts`
- `server/src/routes/__tests__/adminP32.billingAlerts.honesty.test.ts`
- `server/src/routes/__tests__/ai-quality.routes.test.ts`
- `server/src/routes/__tests__/ai.routes.attachments-ingest.test.ts`
- `server/src/routes/__tests__/audit-export-history.routes.test.ts`
- `server/src/routes/__tests__/break-glass.routes.test.ts`
- `server/src/routes/__tests__/day22.highRiskAdminAudit.pg.test.ts`
- `server/src/routes/__tests__/document-studio-cross-org-idor.test.ts`
- `server/src/routes/__tests__/financialModelingRoutes.membershipGate.pg.test.ts`
- `server/src/routes/__tests__/guests.routes.test.ts`
- `server/src/routes/__tests__/health-jobs.routes.test.ts`
- `server/src/routes/__tests__/integrations.routes.test.ts`
- `server/src/routes/__tests__/legal-hold.routes.test.ts`
- `server/src/routes/__tests__/meeting.routes.test.ts`
- `server/src/routes/__tests__/mfaPersistence.pg.test.ts`
- `server/src/routes/__tests__/organization-profile.routes.test.ts`
- `server/src/routes/__tests__/presentationCustomTemplateContract.test.ts`
- `server/src/routes/__tests__/presentationPptxDownloadCurrentExport.test.ts`
- `server/src/routes/__tests__/presentations.authorization-wall.realdb.test.ts`
- `server/src/routes/__tests__/reportBuilderPdf.polishFonts.test.ts`
- `server/src/routes/__tests__/seats.routes.test.ts`
- `server/src/routes/__tests__/security-alerts.routes.test.ts`
- `server/src/routes/__tests__/service-accounts.routes.test.ts`
- `server/src/routes/__tests__/sessions.routes.test.ts`
- `server/src/routes/__tests__/settings.routes.test.ts`
- `server/src/routes/__tests__/workbook-cell.routes.test.ts`
- `server/src/routes/admin-bulk.routes.ts`
- `server/src/routes/admin/audit-export-history.routes.ts`
- `server/src/routes/admin/backup.routes.ts`
- `server/src/routes/admin/billing-history.routes.ts`
- `server/src/routes/admin/break-glass.routes.ts`
- `server/src/routes/admin/guests.routes.ts`
- `server/src/routes/admin/legal-hold.routes.ts`
- `server/src/routes/admin/seats.routes.ts`
- `server/src/routes/admin/security-alerts.routes.ts`
- `server/src/routes/admin/sessions.routes.ts`
- `server/src/routes/ai-operator.routes.ts`
- `server/src/routes/ai.routes.ts`
- `server/src/routes/ai/agent-plan.routes.ts`
- `server/src/routes/ai/ai-feedback.routes.ts`
- `server/src/routes/assessmentCatalog/__tests__/assessmentMethodCatalog.pg.test.ts`
- `server/src/routes/audits/__tests__/day41.criteriaScale.pg.test.ts`
- `server/src/routes/audits/__tests__/day41.reportExport.pg.test.ts`
- `server/src/routes/audits/__tests__/day41.reportExportContext.pg.test.ts`
- `server/src/routes/audits/__tests__/verticalSlice.http.test.ts`
- `server/src/routes/audits/actions.routes.ts`
- `server/src/routes/audits/ai.routes.ts`
- `server/src/routes/audits/context.ts`
- `server/src/routes/audits/criteria.routes.ts`
- `server/src/routes/audits/evidence.routes.ts`
- `server/src/routes/audits/findings.routes.ts`
- `server/src/routes/audits/index.ts`
- `server/src/routes/audits/outputs.routes.ts`
- `server/src/routes/audits/packs.routes.ts`
- `server/src/routes/audits/programs.routes.ts`
- `server/src/routes/audits/proposals.routes.ts`
- `server/src/routes/audits/reports.routes.ts`
- `server/src/routes/audits/sources.routes.ts`
- `server/src/routes/audits/trail.routes.ts`
- `server/src/routes/auth.routes.ts`
- `server/src/routes/caseWorkspace/__tests__/actionProposals.routes.test.ts`
- `server/src/routes/caseWorkspace/__tests__/artifactLinks.routes.test.ts`
- `server/src/routes/caseWorkspace/__tests__/capabilities.routes.test.ts`
- `server/src/routes/caseWorkspace/__tests__/caseHistory.routes.test.ts`
- `server/src/routes/caseWorkspace/__tests__/casePlanVersions.routes.test.ts`
- `server/src/routes/caseWorkspace/__tests__/cases.routes.test.ts`
- `server/src/routes/caseWorkspace/__tests__/contract/casesLifecycle.contract.pg.test.ts`
- `server/src/routes/caseWorkspace/__tests__/contract/contractHarness.ts`
- `server/src/routes/caseWorkspace/__tests__/contract/errorAndAuthz.contract.pg.test.ts`
- `server/src/routes/caseWorkspace/__tests__/contract/idempotencyAndPagination.contract.pg.test.ts`
- `server/src/routes/caseWorkspace/__tests__/contract/openapiRouteParity.contract.test.ts`
- `server/src/routes/caseWorkspace/__tests__/contract/openapiSchemaValidity.contract.test.ts`
- `server/src/routes/caseWorkspace/__tests__/contract/readSurface.contract.pg.test.ts`
- `server/src/routes/caseWorkspace/__tests__/executionGraph.routes.test.ts`
- `server/src/routes/caseWorkspace/__tests__/migrationReadiness.routes.test.ts`
- `server/src/routes/caseWorkspace/__tests__/play.routes.test.ts`
- `server/src/routes/caseWorkspace/__tests__/runBindings.routes.test.ts`
- `server/src/routes/caseWorkspace/__tests__/waitSubscriptions.routes.test.ts`
- `server/src/routes/caseWorkspace/_shared/access.ts`
- `server/src/routes/caseWorkspace/_shared/errors.ts`
- `server/src/routes/caseWorkspace/_shared/handler.ts`
- `server/src/routes/caseWorkspace/_shared/pagination.ts`
- `server/src/routes/caseWorkspace/_shared/validate.ts`
- `server/src/routes/caseWorkspace/actionProposals.routes.ts`
- `server/src/routes/caseWorkspace/artifactLinks.routes.ts`
- `server/src/routes/caseWorkspace/capabilities.routes.ts`
- `server/src/routes/caseWorkspace/caseHistory.routes.ts`
- `server/src/routes/caseWorkspace/casePlanVersions.routes.ts`
- `server/src/routes/caseWorkspace/cases.routes.ts`
- `server/src/routes/caseWorkspace/eventInbox.routes.ts`
- `server/src/routes/caseWorkspace/executionBvp.routes.ts`
- `server/src/routes/caseWorkspace/executionGraph.routes.ts`
- `server/src/routes/caseWorkspace/index.ts`
- `server/src/routes/caseWorkspace/intake.routes.ts`
- `server/src/routes/caseWorkspace/migrationReadiness.routes.ts`
- `server/src/routes/caseWorkspace/play.routes.ts`
- `server/src/routes/caseWorkspace/runBindings.routes.ts`
- `server/src/routes/caseWorkspace/runLifecycle.routes.ts`
- `server/src/routes/caseWorkspace/waitSubscriptions.routes.ts`
- `server/src/routes/conversations.routes.ts`
- `server/src/routes/dataExport.routes.ts`
- `server/src/routes/deliverableTemplates.routes.ts`
- `server/src/routes/document-studio.routes.ts`
- `server/src/routes/executionControl.routes.ts`
- `server/src/routes/finance-statements.routes.ts`
- `server/src/routes/financial-modeling.routes.ts`
- `server/src/routes/gdpr.routes.ts`
- `server/src/routes/ideaBusinessCase.routes.ts`
- `server/src/routes/ideaFinancialCase.routes.ts`
- `server/src/routes/initiative-governance.routes.ts`
- `server/src/routes/initiativeCandidates.routes.ts`
- `server/src/routes/integrations/__tests__/automationIntegrationKeyOrgSuspension.test.ts`
- `server/src/routes/integrations/__tests__/ssoFailClosed.routes.test.ts`
- `server/src/routes/integrations/scim.routes.ts`
- `server/src/routes/interviewDelivery/__tests__/interviewAiReviewTimeoutFallback.pg.test.ts`
- `server/src/routes/interviewDelivery/__tests__/interviewAnswerCasAndNullableFixType.pg.test.ts`
- `server/src/routes/interviewDelivery/__tests__/interviewDeliveryMountedAuth.pg.test.ts`
- `server/src/routes/interviewDelivery/__tests__/interviewPublishedAssignmentDelivery.pg.test.ts`
- `server/src/routes/llm.routes.ts`
- `server/src/routes/managementReports.routes.ts`
- `server/src/routes/meeting.routes.ts`
- `server/src/routes/method-core.routes.ts`
- `server/src/routes/mfa.routes.ts`
- `server/src/routes/my-work.routes.ts`
- `server/src/routes/my-work/__tests__/calendar-events.migration.test.ts`
- `server/src/routes/my-work/__tests__/calendar.events.routes.test.ts`
- `server/src/routes/my-work/__tests__/signals.routes.org-isolation.test.ts`
- `server/src/routes/my-work/agent-materialization.routes.ts`
- `server/src/routes/my-work/calendar.routes.ts`
- `server/src/routes/organization-context.routes.ts`
- `server/src/routes/organization/organizations.routes.ts`
- `server/src/routes/partners.routes.ts`
- `server/src/routes/pmo/__tests__/day31.canonical-writer-contract.pg.test.ts`
- `server/src/routes/pmo/__tests__/day33.numeric-contribution.pg.test.ts`
- `server/src/routes/pmo/initiativeClosure.routes.ts`
- `server/src/routes/pmo/initiatives.routes.ts`
- `server/src/routes/pmo/initiativesCapacityAdvisor.routes.ts`
- `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`
- `server/src/routes/pmo/tasks.routes.ts`
- `server/src/routes/presentations.routes.ts`
- `server/src/routes/reports.routes.ts`
- `server/src/routes/resultsVnext/__tests__/correlationId.test.ts`
- `server/src/routes/resultsVnext/__tests__/kpi.routes.test.ts`
- `server/src/routes/resultsVnext/__tests__/kpiDeviation.routes.test.ts`
- `server/src/routes/resultsVnext/__tests__/kpiPerspectives.routes.test.ts`
- `server/src/routes/resultsVnext/__tests__/okr.routes.test.ts`
- `server/src/routes/resultsVnext/__tests__/okrCheckInSummaryDay17.routes.test.ts`
- `server/src/routes/resultsVnext/__tests__/okrReview.routes.test.ts`
- `server/src/routes/resultsVnext/__tests__/roi.routes.test.ts`
- `server/src/routes/resultsVnext/__tests__/roiBenefitsRealization.routes.test.ts`
- `server/src/routes/resultsVnext/__tests__/roiCaseApproval.routes.test.ts`
- `server/src/routes/resultsVnext/__tests__/roiEconomicModel.routes.test.ts`
- `server/src/routes/resultsVnext/__tests__/roiFinanceSeam.routes.test.ts`
- `server/src/routes/resultsVnext/__tests__/roiForecastActual.routes.test.ts`
- `server/src/routes/resultsVnext/__tests__/roiPir.routes.test.ts`
- `server/src/routes/resultsVnext/kpi.routes.ts`
- `server/src/routes/resultsVnext/kpiDeviation.routes.ts`
- `server/src/routes/resultsVnext/kpiLegacyArchive.routes.ts`
- `server/src/routes/resultsVnext/kpiPerspectives.routes.ts`
- `server/src/routes/resultsVnext/kpiRecoveryChildren.routes.ts`
- `server/src/routes/resultsVnext/kpiScorecard.routes.ts`
- `server/src/routes/resultsVnext/okr.routes.ts`
- `server/src/routes/resultsVnext/okrLegacyArchive.routes.ts`
- `server/src/routes/resultsVnext/roi.routes.ts`
- `server/src/routes/resultsVnext/roiLegacyArchive.routes.ts`
- `server/src/routes/settings.routes.ts`
- `server/src/routes/signals.routes.ts`
- `server/src/routes/superadmin.routes.ts`
- `server/src/routes/systemHealth.routes.ts`
- `server/src/routes/testSupport.routes.ts`
- `server/src/routes/v10/teresa.routes.ts`
- `server/src/routes/v8/__tests__/agent-process-templates.routes.test.ts`
- `server/src/routes/v8/__tests__/assessment.accepted-freeze.pg.test.ts`
- `server/src/routes/v8/__tests__/execution-control.routes.test.ts`
- `server/src/routes/v8/__tests__/financeIntelligence.membershipGate.pg.test.ts`
- `server/src/routes/v8/__tests__/financePlanning.membershipGate.pg.test.ts`
- `server/src/routes/v8/__tests__/financeStatementMountedSurface.test.ts`
- `server/src/routes/v8/__tests__/financeV8MutationInventory.test.ts`
- `server/src/routes/v8/__tests__/financeValuation.membershipGate.pg.test.ts`
- `server/src/routes/v8/__tests__/financeValue.membershipGate.pg.test.ts`
- `server/src/routes/v8/__tests__/m07-golden-flows.pg.test.ts`
- `server/src/routes/v8/__tests__/notebook.expandCapability.failClosed.contract.test.ts`
- `server/src/routes/v8/__tests__/p07-notebook-canon.test.ts`
- `server/src/routes/v8/__tests__/p08-artifact-studio-teresa-bridge.test.ts`
- `server/src/routes/v8/__tests__/p08-teresa-service.test.ts`
- `server/src/routes/v8/__tests__/sync.routes.test.ts`
- `server/src/routes/v8/__tests__/transformation-template-intake.routes.test.ts`
- `server/src/routes/v8/agent-process-templates.routes.ts`
- `server/src/routes/v8/chat.routes.ts`
- `server/src/routes/v8/finance-v2/__tests__/artifacts-lifecycle-compute.routes.pg.test.ts`
- `server/src/routes/v8/finance-v2/__tests__/baseline.routes.pg.test.ts`
- `server/src/routes/v8/finance-v2/__tests__/day23.default-mount-reachability.pg.test.ts`
- `server/src/routes/v8/finance-v2/__tests__/lineage-navigator.routes.pg.test.ts`
- `server/src/routes/v8/finance-v2/__tests__/models.routes.pg.test.ts`
- `server/src/routes/v8/finance-v2/__tests__/pkg-b2-cross-tenant.routes.pg.test.ts`
- `server/src/routes/v8/finance-v2/__tests__/valuation-b3-review.routes.pg.test.ts`
- `server/src/routes/v8/finance-v2/__tests__/valuation-cross-tenant.routes.pg.test.ts`
- `server/src/routes/v8/finance-v2/__tests__/valuation-independent-verifier.pg.test.ts`
- `server/src/routes/v8/finance-v2/_shared.ts`
- `server/src/routes/v8/finance-v2/analysis.routes.ts`
- `server/src/routes/v8/finance-v2/baseline.routes.ts`
- `server/src/routes/v8/finance-v2/comments.routes.ts`
- `server/src/routes/v8/finance-v2/compare.routes.ts`
- `server/src/routes/v8/finance-v2/crosscutting.routes.ts`
- `server/src/routes/v8/finance-v2/index.ts`
- `server/src/routes/v8/finance-v2/lineage-navigator.routes.ts`
- `server/src/routes/v8/finance-v2/prediction.routes.ts`
- `server/src/routes/v8/finance-v2/statements.routes.ts`
- `server/src/routes/v8/finance-v2/valuation.routes.ts`
- `server/src/routes/v8/finance-v2/versions.routes.ts`
- `server/src/routes/v8/finance-value.routes.ts`
- `server/src/routes/v8/financeStatementMountedSurface.ts`
- `server/src/routes/v8/index.ts`
- `server/src/routes/v8/partner.routes.ts`
- `server/src/routes/v8/results.routes.ts`
- `server/src/routes/v8/sync.routes.ts`
- `server/src/routes/v8/teresa.routes.ts`
- `server/src/routes/v8/transformation-cases.routes.ts`
- `server/src/routes/webhooks/__tests__/stripe.routes.billing-lifecycle.test.ts`
- `server/src/routes/webhooks/__tests__/stripe.routes.payment-failed.test.ts`
- `server/src/routes/webhooks/stripe.routes.ts`
- `server/src/routes/workbook.routes.ts`
- `server/src/scripts/__tests__/demoAcceptanceFixturePlan.test.ts`
- `server/src/scripts/__tests__/fin005SeedAtelierFinance.test.ts`
- `server/src/scripts/a01A02CanonicalRunRealDbProof.ts`
- `server/src/scripts/a02CanonicalProjectionRestartWorker.ts`
- `server/src/scripts/a03PlanningClarificationRealDbProof.ts`
- `server/src/scripts/a03PlanningWorkshopRealDbProof.ts`
- `server/src/scripts/a03TemplateIntakeRealDbProof.ts`
- `server/src/scripts/a04ContextGroundingRealDbProof.ts`
- `server/src/scripts/a04ProductionRetrievalRealDbProof.ts`
- `server/src/scripts/a04WorkerClaimContextRealDbProof.ts`
- `server/src/scripts/a04WorkerClaimRestartWorker.ts`
- `server/src/scripts/a05ProposalGovernanceRealDbProof.ts`
- `server/src/scripts/a06AdapterOrchestrationRealDbProof.ts`
- `server/src/scripts/a06TenantActivationRealDbProof.ts`
- `server/src/scripts/a07Wave8ForwardMigrationRealDbProof.ts`
- `server/src/scripts/a09LegacyNoncanonicalIsolationRealDbProof.ts`
- `server/src/scripts/a09ReleasedReservationReclaimRealDbProof.ts`
- `server/src/scripts/a09ResourceGovernanceRealDbProof.ts`
- `server/src/scripts/a09ResourceGovernanceRestartWorker.ts`
- `server/src/scripts/a09WorkGraphRestartWorker.ts`
- `server/src/scripts/a10TransformationCaseLiveReadbackRealDbProof.ts`
- `server/src/scripts/a11OperatorConsoleRealDbProof.ts`
- `server/src/scripts/a12TemplateGovernanceRealDbProof.ts`
- `server/src/scripts/agentMigrationsIdempotencyRealDbProof.ts`
- `server/src/scripts/i04DrdQualityReviewRealDbProof.ts`
- `server/src/scripts/t01BrowserFixtureServer.ts`
- `server/src/scripts/t01FinalOutputRealDbProof.ts`
- `server/src/scripts/t01InitiativeGateDecisionRealDbProof.ts`
- `server/src/scripts/t01InterviewRealDbProof.ts`
- `server/src/scripts/t01ProjectTeamRealDbProof.ts`
- `server/src/scripts/u02MigrationSafetyRealDbProof.ts`
- `server/src/scripts/u03OwnerBackedExecutionRealDbProof.ts`
- `server/src/services/InterviewAssignmentService.ts`
- `server/src/services/KnownToolsService.ts`
- `server/src/services/MFAService.ts`
- `server/src/services/RefreshTokenService.ts`
- `server/src/services/TaskService.ts`
- `server/src/services/__tests__/MFAService.pg.test.ts`
- `server/src/services/__tests__/adminIamAlertEvaluator.pg.test.ts`
- `server/src/services/__tests__/adminIamBvp.pg.test.ts`
- `server/src/services/__tests__/adminIamCommandService.pg.test.ts`
- `server/src/services/__tests__/artifactRegistryService.retry.test.ts`
- `server/src/services/__tests__/canvasIdeaMaterializeAtomicity.p07c.pg.test.ts`
- `server/src/services/__tests__/domainVerificationService.test.ts`
- `server/src/services/__tests__/executionActionRegistryService.pg.test.ts`
- `server/src/services/__tests__/executionActionRegistryService.test.ts`
- `server/src/services/__tests__/executionBvpService.pg.test.ts`
- `server/src/services/__tests__/executionSpineAuthorityService.test.ts`
- `server/src/services/__tests__/executionSpineBackfillService.pg.test.ts`
- `server/src/services/__tests__/financeLegacyCutover.pg.test.ts`
- `server/src/services/__tests__/financialModelingService.approvePersist.perfgate.pg.test.ts`
- `server/src/services/__tests__/financialModelingService.approveUnitOfWork.pg.test.ts`
- `server/src/services/__tests__/financialStatementService.contract.test.ts`
- `server/src/services/__tests__/initiativeExecutionOutboxConsumer.pg.test.ts`
- `server/src/services/__tests__/initiativeRuntimeExecutionSeam.pg.test.ts`
- `server/src/services/__tests__/integrationsConnectorRuntimeShape21.realdb.test.ts`
- `server/src/services/__tests__/libraryContentMerge.pg.test.ts`
- `server/src/services/__tests__/libraryContentMerge.test.ts`
- `server/src/services/__tests__/meetingService.test.ts`
- `server/src/services/__tests__/nativeOwnerPinnedClient.test.ts`
- `server/src/services/__tests__/operationalAlertAuthDenialMounted.pg.test.ts`
- `server/src/services/__tests__/operationalAlertIncidentService.pg.test.ts`
- `server/src/services/__tests__/operationalAlertProducerIsolation.test.ts`
- `server/src/services/__tests__/operationalAlertRepairService.pg.test.ts`
- `server/src/services/__tests__/operationalAlertSignalDeliveryService.pg.test.ts`
- `server/src/services/__tests__/organizationSuspensionGuard.pg.test.ts`
- `server/src/services/__tests__/organizationSuspensionGuardFailOpen.test.ts`
- `server/src/services/__tests__/presentationDeckDocumentService.audienceQuality.test.ts`
- `server/src/services/__tests__/presentationGeneratorService.createNativeDeck.pg.test.ts`
- `server/src/services/__tests__/presentationStaleRegenRenderable.test.ts`
- `server/src/services/__tests__/presentationTeresaBridgeService.test.ts`
- `server/src/services/__tests__/refreshTokenOrgSuspension.test.ts`
- `server/src/services/__tests__/settingsMfaMigrationUpgrade.pg.test.ts`
- `server/src/services/__tests__/settingsNotificationEngineSync.test.ts`
- `server/src/services/__tests__/statementMultiSectionImportService.atomic.test.ts`
- `server/src/services/__tests__/statementOwnerAcceptance.pg.test.ts`
- `server/src/services/__tests__/toolAvailability.test.ts`
- `server/src/services/__tests__/usageService.usage-alert.test.ts`
- `server/src/services/__tests__/v8ExecutionControlTowerService.test.ts`
- `server/src/services/adminIamAlertEvaluator.ts`
- `server/src/services/adminIamCommandService.ts`
- `server/src/services/ai/__tests__/agentTaskDispatchService.pg.redis.test.ts`
- `server/src/services/ai/__tests__/citationVerifier.aclCheckAccess.test.ts`
- `server/src/services/ai/agentPlannerService.ts`
- `server/src/services/ai/agentTaskDispatchService.ts`
- `server/src/services/artifactHandoff/__tests__/handoffSpine.pg.test.ts`
- `server/src/services/artifactHandoff/handoffSpineService.ts`
- `server/src/services/assessment/__tests__/assessmentInitiativeBatchUniqueness.realdb.test.ts`
- `server/src/services/assessment/__tests__/assessmentSkipReasons.day20.pg.test.ts`
- `server/src/services/assessment/__tests__/day32.drdSchema.test.ts`
- `server/src/services/assessment/assessmentDrdReportSchemaService.ts`
- `server/src/services/assessment/assessmentReportContractService.ts`
- `server/src/services/assessment/assessmentSkipReasonService.ts`
- `server/src/services/assessment/drdCandidateHandoff.ts`
- `server/src/services/assessmentInitiativeGenerationRunService.ts`
- `server/src/services/assessmentMethodBootstrap/__tests__/asmBvp001DrdLibraryBootstrap.pg.test.ts`
- `server/src/services/auditProgramFixtures/__tests__/fixtureGenerator.pg.test.ts`
- `server/src/services/auditProgramFixtures/fixtureGenerator.ts`
- `server/src/services/auditProgramHandoff/__tests__/aiBoundaryNegatives.test.ts`
- `server/src/services/auditProgramHandoff/__tests__/exactlyOnceRegistration.test.ts`
- `server/src/services/auditProgramHandoff/__tests__/fullLifecycle.e2e.test.ts`
- `server/src/services/auditProgramHandoff/__tests__/helpers.ts`
- `server/src/services/auditProgramHandoff/__tests__/immutableTrail.test.ts`
- `server/src/services/auditProgramHandoff/__tests__/lifecycleConcurrency.test.ts`
- `server/src/services/auditProgramHandoff/__tests__/segregationOfDutiesNegatives.test.ts`
- `server/src/services/auditProgramHandoff/__tests__/tenantIsolation.test.ts`
- `server/src/services/auditProgramOwner/__tests__/auditProgramLegacyWriteRetirement.realdb.test.ts`
- `server/src/services/auditProgramRights/__tests__/auditPackRights.realdb.test.ts`
- `server/src/services/audits/__tests__/aiBoundaries.test.ts`
- `server/src/services/audits/__tests__/aiProposalService.test.ts`
- `server/src/services/audits/__tests__/auditTrailService.test.ts`
- `server/src/services/audits/__tests__/correctiveActionService.test.ts`
- `server/src/services/audits/__tests__/criterionService.test.ts`
- `server/src/services/audits/__tests__/evidenceService.test.ts`
- `server/src/services/audits/__tests__/findingService.test.ts`
- `server/src/services/audits/__tests__/goldenFlow.e2e.test.ts`
- `server/src/services/audits/__tests__/independenceScanCursor.realdb.test.ts`
- `server/src/services/audits/__tests__/lifecycleGates.test.ts`
- `server/src/services/audits/__tests__/normSourceService.test.ts`
- `server/src/services/audits/__tests__/outputService.test.ts`
- `server/src/services/audits/__tests__/packService.test.ts`
- `server/src/services/audits/__tests__/packValidator.test.ts`
- `server/src/services/audits/__tests__/programService.test.ts`
- `server/src/services/audits/__tests__/proposalService.test.ts`
- `server/src/services/audits/__tests__/reportRenderer.test.ts`
- `server/src/services/audits/__tests__/segregationOfDuties.test.ts`
- `server/src/services/audits/__tests__/sourceClassificationAxes.test.ts`
- `server/src/services/audits/__tests__/testHelpers.ts`
- `server/src/services/audits/__tests__/verificationService.test.ts`
- `server/src/services/audits/aiProposalService.ts`
- `server/src/services/audits/auditTrailService.ts`
- `server/src/services/audits/auditsDb.ts`
- `server/src/services/audits/correctiveActionService.ts`
- `server/src/services/audits/criterionService.ts`
- `server/src/services/audits/evidenceService.ts`
- `server/src/services/audits/findingService.ts`
- `server/src/services/audits/independenceScanCursor.ts`
- `server/src/services/audits/lifecycle.ts`
- `server/src/services/audits/normSourceService.ts`
- `server/src/services/audits/outputService.ts`
- `server/src/services/audits/packSeed.ts`
- `server/src/services/audits/packService.ts`
- `server/src/services/audits/packValidator.ts`
- `server/src/services/audits/permissions.ts`
- `server/src/services/audits/programService.ts`
- `server/src/services/audits/proposalService.ts`
- `server/src/services/audits/reportRenderer.ts`
- `server/src/services/audits/reportService.ts`
- `server/src/services/audits/types.ts`
- `server/src/services/audits/verificationService.ts`
- `server/src/services/auth/quickAccessPinService.ts`
- `server/src/services/backupService.ts`
- `server/src/services/canvasMaterialize.ts`
- `server/src/services/caseWorkspace/__tests__/_helpers/fixtureCleanup.ts`
- `server/src/services/caseWorkspace/__tests__/adapters/_fixtures.ts`
- `server/src/services/caseWorkspace/__tests__/adapters/decisionAdapter.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/adapters/financeAdapter.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/adapters/initiativeAdapter.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/adapters/kpiAdapter.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/artifactLinkService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/autonomyPolicyService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/capabilityAdapterService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/capabilityRegistryService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/caseCoreService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/caseHistoryService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/caseIntakeService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/casePlanVersionService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/caseWorkspaceAuthContext.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/e2e/liveStack.e2e.part2.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/e2e/liveStack.e2e.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/e2e/liveStackHarness.ts`
- `server/src/services/caseWorkspace/__tests__/eventInboxService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/eventOutboxService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/executionGraphService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseApprovalRefused.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseDirectModuleLateBinding.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseHappyPath.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseHarness.ts`
- `server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseLightOneClick.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseRequestChangesPartialRetry.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseTenancyRefusal.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseTransformationMultiModule.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseWaitExpiry.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/integration/appendOnlyGuards.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/integration/caseCardinality.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/integration/chainTenancy.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/integration/chatIntake.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/integration/deliverableOpenReturn.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/integration/fullChainObservability.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/integration/gatewayAdvance.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/integration/inboxIngress.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/integration/lightOneClick.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/integration/outboxWorker.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/integration/partialResults.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/integration/polishIntent.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/integration/resilience.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/integration/runRuntime.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/integration/teresaProductionIntake.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/lightOneClickService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/longRun/thirtyMinuteRun.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/migrationReadinessService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/nodeRunService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/perf/outboxThroughput.perf.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/performance/lib/dbLifecycle.ts`
- `server/src/services/caseWorkspace/__tests__/performance/lib/envInfo.ts`
- `server/src/services/caseWorkspace/__tests__/performance/lib/fixtures.ts`
- `server/src/services/caseWorkspace/__tests__/performance/lib/graphBuilder.ts`
- `server/src/services/caseWorkspace/__tests__/performance/lib/runProfile.ts`
- `server/src/services/caseWorkspace/__tests__/performance/lib/steadyLoadGate.ts`
- `server/src/services/caseWorkspace/__tests__/performance/orchestrate.ts`
- `server/src/services/caseWorkspace/__tests__/performance/runProfileMain.ts`
- `server/src/services/caseWorkspace/__tests__/performance/steadyAuthenticatedLoad.ts`
- `server/src/services/caseWorkspace/__tests__/playService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/proposalApprovalService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/runBindingService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/runLifecycleService.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/runSemantics.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/security/artifactLinkService.security.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/security/caseCoreService.security.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/security/newSurface.security.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/security/planVersionEnumeration.security.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/security/playService.security.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/security/playsEnumeration.security.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/security/proposalApprovalService.security.pg.test.ts`
- `server/src/services/caseWorkspace/__tests__/waitSubscriptionService.pg.test.ts`
- `server/src/services/caseWorkspace/adapters/__tests__/assessmentAdapter.pg.test.ts`
- `server/src/services/caseWorkspace/adapters/__tests__/capabilityBootWiring.pg.test.ts`
- `server/src/services/caseWorkspace/adapters/__tests__/capabilityBootstrap.pg.test.ts`
- `server/src/services/caseWorkspace/adapters/__tests__/documentsAdapter.pg.test.ts`
- `server/src/services/caseWorkspace/adapters/__tests__/resultsAdapter.pg.test.ts`
- `server/src/services/caseWorkspace/adapters/_shared.ts`
- `server/src/services/caseWorkspace/adapters/assessmentAdapter.ts`
- `server/src/services/caseWorkspace/adapters/decisionAdapter.ts`
- `server/src/services/caseWorkspace/adapters/documentsAdapter.ts`
- `server/src/services/caseWorkspace/adapters/financeAdapter.ts`
- `server/src/services/caseWorkspace/adapters/index.ts`
- `server/src/services/caseWorkspace/adapters/initiativeAdapter.ts`
- `server/src/services/caseWorkspace/adapters/kpiAdapter.ts`
- `server/src/services/caseWorkspace/adapters/resultsAdapter.ts`
- `server/src/services/caseWorkspace/artifactLinkService.ts`
- `server/src/services/caseWorkspace/autonomyPolicyService.ts`
- `server/src/services/caseWorkspace/capabilityAdapterService.ts`
- `server/src/services/caseWorkspace/capabilityBootstrap.ts`
- `server/src/services/caseWorkspace/capabilityRegistryService.ts`
- `server/src/services/caseWorkspace/caseCoreService.ts`
- `server/src/services/caseWorkspace/caseHistoryService.ts`
- `server/src/services/caseWorkspace/caseIntakeService.ts`
- `server/src/services/caseWorkspace/casePlanVersionService.ts`
- `server/src/services/caseWorkspace/caseWorkspaceAuthContext.ts`
- `server/src/services/caseWorkspace/eventInboxService.ts`
- `server/src/services/caseWorkspace/eventOutboxService.ts`
- `server/src/services/caseWorkspace/executionGraphService.ts`
- `server/src/services/caseWorkspace/lightOneClickService.ts`
- `server/src/services/caseWorkspace/migrationReadinessService.ts`
- `server/src/services/caseWorkspace/nodeRunService.ts`
- `server/src/services/caseWorkspace/outboxWorker.ts`
- `server/src/services/caseWorkspace/playService.ts`
- `server/src/services/caseWorkspace/proposalApprovalService.ts`
- `server/src/services/caseWorkspace/runBindingService.ts`
- `server/src/services/caseWorkspace/runLifecycleService.ts`
- `server/src/services/caseWorkspace/waitSubscriptionService.ts`
- `server/src/services/chatHandoff/__tests__/chatHandoffService.pg.test.ts`
- `server/src/services/chatHandoff/__tests__/chatTargetMapping.pg.test.ts`
- `server/src/services/chatHandoff/chatHandoffService.ts`
- `server/src/services/chatHandoff/chatTargetMappingService.ts`
- `server/src/services/chatHandoff/chatTargetOwnerIngressService.ts`
- `server/src/services/closureDeliveryReceiptService.ts`
- `server/src/services/decisionService.ts`
- `server/src/services/demo/demoPrincipalGuard.ts`
- `server/src/services/demo/demoSeedService.ts`
- `server/src/services/demo/demoSignupProvisioning.ts`
- `server/src/services/documentStudio/__tests__/boardReadyDocumentsTemplateMigration.test.ts`
- `server/src/services/documentStudio/__tests__/documentBlockProseGenerator.test.ts`
- `server/src/services/documentStudio/__tests__/documentBvpExport.pg.test.ts`
- `server/src/services/documentStudio/__tests__/documentCommentsService.test.ts`
- `server/src/services/documentStudio/__tests__/documentLifecycleService.test.ts`
- `server/src/services/documentStudio/__tests__/documentPremiumGroundingNormalization.test.ts`
- `server/src/services/documentStudio/__tests__/documentQaService.test.ts`
- `server/src/services/documentStudio/__tests__/documentStudioBusinessCaseOutlineMerge.test.ts`
- `server/src/services/documentStudio/__tests__/documentStudioExportQaGate.test.ts`
- `server/src/services/documentStudio/__tests__/documentStudioGenerateExportHappyPath.test.ts`
- `server/src/services/documentStudio/__tests__/documentStudioMode3.test.ts`
- `server/src/services/documentStudio/__tests__/documentTemplateSeeder.test.ts`
- `server/src/services/documentStudio/__tests__/documentVersionLineage.pg.test.ts`
- `server/src/services/documentStudio/__tests__/documentVersionSnapshotService.test.ts`
- `server/src/services/documentStudio/documentApprovalService.ts`
- `server/src/services/documentStudio/documentBlockProseGenerator.ts`
- `server/src/services/documentStudio/documentContentGenerator.ts`
- `server/src/services/documentStudio/documentDocxRenderer.ts`
- `server/src/services/documentStudio/documentSourcePackService.ts`
- `server/src/services/documentStudio/documentStudioService.ts`
- `server/src/services/documentStudio/documentTemplateService.ts`
- `server/src/services/documentStudio/documentVersionSnapshotRegistryDao.ts`
- `server/src/services/documentStudio/documentVersionSnapshotService.ts`
- `server/src/services/evidence/evidenceEnvelopeService.ts`
- `server/src/services/execution/__tests__/canonicalExecutionHealthService.test.ts`
- `server/src/services/execution/canonicalExecutionHealthService.ts`
- `server/src/services/execution/executionSpineBackfillService.ts`
- `server/src/services/execution/threeAxisReportService.ts`
- `server/src/services/executionActionRegistryService.ts`
- `server/src/services/executionBudgetDeleteCommandService.ts`
- `server/src/services/executionBvpService.ts`
- `server/src/services/executionControl/capacitySaturationReadModel.ts`
- `server/src/services/executionControl/controlKpiReadModel.ts`
- `server/src/services/finance/__tests__/numberNotation.persistence.pg.test.ts`
- `server/src/services/finance/__tests__/numberNotation.realCompanyRegression.test.ts`
- `server/src/services/finance/canonical/__tests__/artifactVersionSupersededImmutability.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/artifactVersionTerminalTransitions.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/baselineCircularitySolver.test.ts`
- `server/src/services/finance/canonical/__tests__/baselineScheduleEngine.test.ts`
- `server/src/services/finance/canonical/__tests__/benefitTrackingUpgradeProtection.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/budgetRegistrationService.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/canonicalServices.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/coldReopen.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/coldReopenReader.ts`
- `server/src/services/finance/canonical/__tests__/commentReviewService.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/concurrencyMatrix.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/exceptionInboxService.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/faultMatrix.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/financeCompareService.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/financeCompareService.test.ts`
- `server/src/services/finance/canonical/__tests__/formulaAstEvaluator.test.ts`
- `server/src/services/finance/canonical/__tests__/hashConsolidationGuard.test.ts`
- `server/src/services/finance/canonical/__tests__/idempotentComputeRetry.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/kpiComputeService.determinism.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/kpiComputeService.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/kpiHashOrderDeterminism.test.ts`
- `server/src/services/finance/canonical/__tests__/lifecycleService.test.ts`
- `server/src/services/finance/canonical/__tests__/lineageFreshnessService.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/lineageService.test.ts`
- `server/src/services/finance/canonical/__tests__/perfSlo.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/periodConventionResolver.test.ts`
- `server/src/services/finance/canonical/__tests__/predictionOverlayOrderDeterminism.test.ts`
- `server/src/services/finance/canonical/__tests__/predictionOverlayQueryOrderChurn.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/predictionPreflightOrderDeterminism.test.ts`
- `server/src/services/finance/canonical/__tests__/rlsPilotEnforcement.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/roiActualProtectionSchemaQualified.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/roiFinanceLinkAdapter.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/roiFinanceReconciliationAdapter.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/savedViewService.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/statementCoverageAndJumps.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/statementMoneyNumericPrecision.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/statementReconciliationService.test.ts`
- `server/src/services/finance/canonical/__tests__/statementServices.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/tenantMatrix.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/valuationAdvisorService.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/valuationFcffOrderDeterminism.test.ts`
- `server/src/services/finance/canonical/__tests__/valuationLegacySuccessor.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/valuationRegistrationService.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/w2FalseSuccessW9B2.pg.test.ts`
- `server/src/services/finance/canonical/baselineCircularitySolver.ts`
- `server/src/services/finance/canonical/baselineComputeService.ts`
- `server/src/services/finance/canonical/baselineContextService.ts`
- `server/src/services/finance/canonical/baselineScheduleEngine.ts`
- `server/src/services/finance/canonical/budgetDiscardCommandService.ts`
- `server/src/services/finance/canonical/budgetDocumentImportCommandService.ts`
- `server/src/services/finance/canonical/budgetInitiativeLinkCommandService.ts`
- `server/src/services/finance/canonical/budgetLineCommandService.ts`
- `server/src/services/finance/canonical/budgetProjectionCommandService.ts`
- `server/src/services/finance/canonical/budgetRegistrationService.ts`
- `server/src/services/finance/canonical/commentService.ts`
- `server/src/services/finance/canonical/computeJobService.ts`
- `server/src/services/finance/canonical/contentHash.ts`
- `server/src/services/finance/canonical/exceptionInboxService.ts`
- `server/src/services/finance/canonical/exceptionLedgerService.ts`
- `server/src/services/finance/canonical/financeCompareService.ts`
- `server/src/services/finance/canonical/financeExcelShared.ts`
- `server/src/services/finance/canonical/financeExportService.ts`
- `server/src/services/finance/canonical/financeImportService.ts`
- `server/src/services/finance/canonical/formulaAstEvaluator.ts`
- `server/src/services/finance/canonical/kpiComputeService.ts`
- `server/src/services/finance/canonical/lifecycleService.ts`
- `server/src/services/finance/canonical/lineageFreshnessService.ts`
- `server/src/services/finance/canonical/lineageService.ts`
- `server/src/services/finance/canonical/periodConventionResolver.ts`
- `server/src/services/finance/canonical/predictionAuthoringService.ts`
- `server/src/services/finance/canonical/predictionComputeService.ts`
- `server/src/services/finance/canonical/predictionPreflightService.ts`
- `server/src/services/finance/canonical/reviewChecklistService.ts`
- `server/src/services/finance/canonical/roiFinanceLinkAdapter.ts`
- `server/src/services/finance/canonical/roiFinanceReconciliationAdapter.ts`
- `server/src/services/finance/canonical/statementGovernedConfirmationService.ts`
- `server/src/services/finance/canonical/statementManualMappingDecisionService.ts`
- `server/src/services/finance/canonical/statementMappingService.ts`
- `server/src/services/finance/canonical/statementPackRegistrationService.ts`
- `server/src/services/finance/canonical/statementReconciliationService.ts`
- `server/src/services/finance/canonical/statementSourceReceiptService.ts`
- `server/src/services/finance/canonical/valuationAdvisorService.ts`
- `server/src/services/finance/canonical/valuationBridgeService.ts`
- `server/src/services/finance/canonical/valuationComputeService.ts`
- `server/src/services/finance/canonical/valuationDiscountService.ts`
- `server/src/services/finance/canonical/valuationFcffService.ts`
- `server/src/services/finance/canonical/valuationLegacyComputeAdapterService.ts`
- `server/src/services/finance/canonical/valuationLegacySuccessorService.ts`
- `server/src/services/finance/canonical/valuationRegistrationService.ts`
- `server/src/services/finance/canonical/valuationSensitivityService.ts`
- `server/src/services/finance/canonical/valuationTerminalService.ts`
- `server/src/services/finance/canonical/valuationVariantService.ts`
- `server/src/services/finance/canonical/valuationWaccService.ts`
- `server/src/services/finance/collaboration/__tests__/autosaveScheduler.test.ts`
- `server/src/services/finance/collaboration/__tests__/collaboration.pg.test.ts`
- `server/src/services/finance/collaboration/__tests__/operationStack.test.ts`
- `server/src/services/finance/collaboration/autosaveService.ts`
- `server/src/services/finance/collaboration/computePinning.ts`
- `server/src/services/finance/collaboration/conflictResolver.ts`
- `server/src/services/finance/collaboration/crashRecoveryService.ts`
- `server/src/services/finance/collaboration/operationStack.ts`
- `server/src/services/finance/grid/BulkOpsEngine.ts`
- `server/src/services/finance/grid/FillEngine.ts`
- `server/src/services/finance/grid/FindReplaceEngine.ts`
- `server/src/services/finance/grid/GridSelectionModel.ts`
- `server/src/services/finance/grid/GridViewState.ts`
- `server/src/services/finance/grid/PasteEngine.ts`
- `server/src/services/finance/grid/engineContext.ts`
- `server/src/services/finance/grid/gridCoordinates.ts`
- `server/src/services/finance/grid/index.ts`
- `server/src/services/finance/keyboard/CommandAvailability.ts`
- `server/src/services/finance/keyboard/CommandPaletteIndex.ts`
- `server/src/services/finance/keyboard/FocusRestoreContract.ts`
- `server/src/services/finance/keyboard/KeyboardCommandRegistry.ts`
- `server/src/services/finance/keyboard/__tests__/KeyboardCommandRegistry.test.ts`
- `server/src/services/finance/keyboard/commandTypes.ts`
- `server/src/services/finance/keyboard/index.ts`
- `server/src/services/finance/numberNotation.ts`
- `server/src/services/finance/workspace/__tests__/lineageNavigatorContract.test.ts`
- `server/src/services/finance/workspace/__tests__/moduleAdapters.test.ts`
- `server/src/services/finance/workspace/__tests__/workspaceBarContract.test.ts`
- `server/src/services/finance/workspace/__tests__/workspaceTestFixtures.ts`
- `server/src/services/finance/workspace/focusModeContract.ts`
- `server/src/services/finance/workspace/index.ts`
- `server/src/services/finance/workspace/lineageNavigatorContract.ts`
- `server/src/services/finance/workspace/moduleAdapters.ts`
- `server/src/services/finance/workspace/workspaceBarContract.ts`
- `server/src/services/financialAnalysisService.ts`
- `server/src/services/financialModelingService.ts`
- `server/src/services/financialStatementService.ts`
- `server/src/services/financialStatementValueWriteService.ts`
- `server/src/services/gdprService.ts`
- `server/src/services/ideaBusinessCaseService.ts`
- `server/src/services/ideaFinancialCaseService.ts`
- `server/src/services/ideaHandoff/__tests__/ideaHandoffService.pg.test.ts`
- `server/src/services/ideaHandoff/ideaHandoffService.ts`
- `server/src/services/ideaProcessFlowCandidateHandoffService.ts`
- `server/src/services/initiative/__tests__/ini-bvp-001-candidate-single-materialization.pg.test.ts`
- `server/src/services/initiative/__tests__/ini-bvp-001-mounted-auth.pg.test.ts`
- `server/src/services/initiative/__tests__/ini-mvp-gate-001-lifecycle-gate-route.test.ts`
- `server/src/services/initiative/__tests__/ini-mvp-gate-001-lifecycle-gate-writer.pg.test.ts`
- `server/src/services/initiative/closureEvidenceSourceReader.ts`
- `server/src/services/initiative/createInitiativeService.ts`
- `server/src/services/initiative/initiativeTransitionService.ts`
- `server/src/services/initiativeExecutionOutboxConsumer.ts`
- `server/src/services/initiativeGovernanceService.ts`
- `server/src/services/initiativeProjectPolicyService.ts`
- `server/src/services/interview/__tests__/interviewSystemTemplateSnapshot.test.ts`
- `server/src/services/interview/interviewCandidateHandoff.ts`
- `server/src/services/interview/interviewLegacyFlags.ts`
- `server/src/services/interview/interviewTemplatePublicationService.ts`
- `server/src/services/interviewCandidate/__tests__/interviewCandidateExactlyOnce.pg.test.ts`
- `server/src/services/interviewEnterpriseService.ts`
- `server/src/services/invitation/InvitationSendingService.ts`
- `server/src/services/invitationService.ts`
- `server/src/services/legacyCutover/__tests__/adminOrgCutover.pg.test.ts`
- `server/src/services/legacyCutover/__tests__/auditsCutover.pg.test.ts`
- `server/src/services/legacyCutover/__tests__/financeSecondDoor.pg.test.ts`
- `server/src/services/legacyCutover/__tests__/financeTwoDoorsMountedAuth.pg.test.ts`
- `server/src/services/legacyCutover/__tests__/interviewCutover.pg.test.ts`
- `server/src/services/legacyCutover/__tests__/legacyCutoverDenominator.pg.test.ts`
- `server/src/services/legacyCutover/__tests__/legacyCutoverIntentLifecycle.pg.test.ts`
- `server/src/services/legacyCutover/__tests__/legacyCutoverKernel.pg.test.ts`
- `server/src/services/legacyCutover/__tests__/materialsCutover.pg.test.ts`
- `server/src/services/legacyCutover/__tests__/meetingsCutover.pg.test.ts`
- `server/src/services/legacyCutover/__tests__/mountedIntentObservation.pg.test.ts`
- `server/src/services/legacyCutover/__tests__/partnersSiblings.pg.test.ts`
- `server/src/services/legacyCutover/__tests__/resultsCutover.pg.test.ts`
- `server/src/services/legacyCutover/__tests__/resultsCutover.registry.test.ts`
- `server/src/services/legacyCutover/__tests__/rollbackRehearsal.pg.test.ts`
- `server/src/services/legacyCutover/__tests__/settingsCutover.pg.test.ts`
- `server/src/services/legacyCutover/canonicalIdentityBridge.ts`
- `server/src/services/legacyCutover/legacyCutoverIntentService.ts`
- `server/src/services/legacyCutover/legacyCutoverKernel.ts`
- `server/src/services/legacyCutover/registry/adminOrg.ts`
- `server/src/services/legacyCutover/registry/materials.ts`
- `server/src/services/legacyCutover/registry/meetings.ts`
- `server/src/services/legacyCutover/registry/results.ts`
- `server/src/services/legacyCutover/registry/settings.ts`
- `server/src/services/legacyCutover/requireActiveMembership.ts`
- `server/src/services/libraryContentMerge.ts`
- `server/src/services/managementReportsService.ts`
- `server/src/services/materialExport/__tests__/materialExportPolicy17.realdb.test.ts`
- `server/src/services/materialExport/__tests__/materialExportReceiptService.pg.test.ts`
- `server/src/services/materialExport/__tests__/materialsMountedAuth.pg.test.ts`
- `server/src/services/materialExport/__tests__/templateProvenanceApproval19.realdb.test.ts`
- `server/src/services/materialExport/materialExportPolicyService.ts`
- `server/src/services/materialExport/materialExportReceiptService.ts`
- `server/src/services/materials/__tests__/creationIntentResolver.test.ts`
- `server/src/services/materials/creationIntent.ts`
- `server/src/services/meeting/__tests__/meetingDay16.pg.test.ts`
- `server/src/services/meeting/__tests__/meetingNoteTaskFunnelService.race23505.test.ts`
- `server/src/services/meeting/meetingInvitationService.ts`
- `server/src/services/meeting/meetingNoteTaskFunnelService.ts`
- `server/src/services/meeting/meetingOccurrenceService.ts`
- `server/src/services/myWork/__tests__/agentApprovedMaterializationService.pg.test.ts`
- `server/src/services/myWork/__tests__/myw-realdb-fixture-auth-001.pg.test.ts`
- `server/src/services/myWork/agentApprovedMaterializationService.ts`
- `server/src/services/notebookService.ts`
- `server/src/services/notificationOutboxService.ts`
- `server/src/services/operationalAlertIncidentCron.ts`
- `server/src/services/operationalAlertRepairService.ts`
- `server/src/services/operationalAlertSignalDeliveryService.ts`
- `server/src/services/orgPeopleIamService.ts`
- `server/src/services/organizationContext/ContextDocumentService.ts`
- `server/src/services/organizationContext/ContextRetrievalService.ts`
- `server/src/services/organizationContext/OrganizationContextService.ts`
- `server/src/services/organizationContext/__tests__/knowledgeDocsFileHashMigration15.realdb.test.ts`
- `server/src/services/organizationContext/__tests__/orgBvpMountedGoldenPath.pg.test.ts`
- `server/src/services/organizationContext/__tests__/orgContextUploadIdempotencyMigration16.realdb.test.ts`
- `server/src/services/organizationContext/__tests__/orgOpsWorkerMounted.pg.test.ts`
- `server/src/services/organizationContext/__tests__/orgPinnedConsumersMounted.pg.test.ts`
- `server/src/services/organizationContext/governedSnapshotConsumerBindingService.ts`
- `server/src/services/organizationSuspensionGuard.ts`
- `server/src/services/partnerAccrualPolicy.ts`
- `server/src/services/partnerCommissionService.ts`
- `server/src/services/partnerEconomicsPolicy.ts`
- `server/src/services/partnerParticipantLedgerService.ts`
- `server/src/services/partnerPayoutSettingsService.ts`
- `server/src/services/partnerReferralService.ts`
- `server/src/services/presentationExport/__tests__/presentationExportReceiptService.pg.test.ts`
- `server/src/services/presentationExport/presentationExportReceiptService.ts`
- `server/src/services/presentationGeneratorService.ts`
- `server/src/services/presentationHtmlExportService.ts`
- `server/src/services/presentationTemplateDraftService.ts`
- `server/src/services/presentationTemplateRuntimeService.ts`
- `server/src/services/presentationTeresaBridgeService.ts`
- `server/src/services/ratioAnalysisService.ts`
- `server/src/services/releaseGate/__tests__/migrationsV2Baseline.contract.test.ts`
- `server/src/services/releaseGate/__tests__/railwayDeployContract.test.ts`
- `server/src/services/releaseGate/__tests__/readinessContract.test.ts`
- `server/src/services/releaseGate/__tests__/releaseGateBoundary.test.ts`
- `server/src/services/releaseGate/__tests__/schemaParityContract.test.ts`
- `server/src/services/releaseGate/schemaAttestation.ts`
- `server/src/services/releaseGate/sqlChainChecksumPolicy.ts`
- `server/src/services/releaseGate/sqlChainEvaluator.ts`
- `server/src/services/reportBuilderService.ts`
- `server/src/services/results/__tests__/kpiRecoveryExperimentService.test.ts`
- `server/src/services/results/__tests__/resultsWriterObservationMigration14.realdb.test.ts`
- `server/src/services/results/kpiRecoveryExperimentService.ts`
- `server/src/services/resultsVnext/kpi/__tests__/kpiRecoveryCards.realpg.test.ts`
- `server/src/services/resultsVnext/kpi/__tests__/kpiRecoveryChildren.realpg.test.ts`
- `server/src/services/resultsVnext/kpi/__tests__/kpiTrend.realpg.test.ts`
- `server/src/services/resultsVnext/kpi/__tests__/kpiTrend.test.ts`
- `server/src/services/resultsVnext/kpi/kpiCorrectiveActionCommands.ts`
- `server/src/services/resultsVnext/kpi/kpiDefinitionCommands.ts`
- `server/src/services/resultsVnext/kpi/kpiDeviationCommands.ts`
- `server/src/services/resultsVnext/kpi/kpiDeviationRepository.ts`
- `server/src/services/resultsVnext/kpi/kpiHistoryRepository.ts`
- `server/src/services/resultsVnext/kpi/kpiInitiativeImpactCommands.ts`
- `server/src/services/resultsVnext/kpi/kpiInitiativeImpactRepository.ts`
- `server/src/services/resultsVnext/kpi/kpiLegacyArchiveRepository.ts`
- `server/src/services/resultsVnext/kpi/kpiMeasurementCommands.ts`
- `server/src/services/resultsVnext/kpi/kpiNextObligationRepository.ts`
- `server/src/services/resultsVnext/kpi/kpiPerspectivesRepository.ts`
- `server/src/services/resultsVnext/kpi/kpiRecoveryCardCommands.ts`
- `server/src/services/resultsVnext/kpi/kpiRecoveryChildCommands.ts`
- `server/src/services/resultsVnext/kpi/kpiRepository.ts`
- `server/src/services/resultsVnext/kpi/kpiScorecardCommands.ts`
- `server/src/services/resultsVnext/kpi/kpiScorecardRepository.ts`
- `server/src/services/resultsVnext/kpi/kpiScorecardTypes.ts`
- `server/src/services/resultsVnext/kpi/kpiTrend.ts`
- `server/src/services/resultsVnext/okr/okrAlignmentCommands.ts`
- `server/src/services/resultsVnext/okr/okrAlignmentRepository.ts`
- `server/src/services/resultsVnext/okr/okrAttentionRepository.ts`
- `server/src/services/resultsVnext/okr/okrCarryForwardCommands.ts`
- `server/src/services/resultsVnext/okr/okrCheckInCommands.ts`
- `server/src/services/resultsVnext/okr/okrCheckInRepository.ts`
- `server/src/services/resultsVnext/okr/okrCheckInScheduler.ts`
- `server/src/services/resultsVnext/okr/okrCheckInSuggestionService.ts`
- `server/src/services/resultsVnext/okr/okrCheckInSummaryRepository.ts`
- `server/src/services/resultsVnext/okr/okrCycleCommands.ts`
- `server/src/services/resultsVnext/okr/okrCycleScheduler.ts`
- `server/src/services/resultsVnext/okr/okrCycleTypes.ts`
- `server/src/services/resultsVnext/okr/okrDecisionCommands.ts`
- `server/src/services/resultsVnext/okr/okrDecisionResolutionScanner.ts`
- `server/src/services/resultsVnext/okr/okrKeyResultCommands.ts`
- `server/src/services/resultsVnext/okr/okrKeyResultTypes.ts`
- `server/src/services/resultsVnext/okr/okrLegacyArchiveRepository.ts`
- `server/src/services/resultsVnext/okr/okrObjectiveCommands.ts`
- `server/src/services/resultsVnext/okr/okrObjectiveRepository.ts`
- `server/src/services/resultsVnext/okr/okrPerspectivesRepository.ts`
- `server/src/services/resultsVnext/okr/okrProgramCommands.ts`
- `server/src/services/resultsVnext/okr/okrProgramTypes.ts`
- `server/src/services/resultsVnext/okr/okrProgressEngine.ts`
- `server/src/services/resultsVnext/okr/okrReflectionCommands.ts`
- `server/src/services/resultsVnext/okr/okrReflectionTypes.ts`
- `server/src/services/resultsVnext/okr/okrRepository.ts`
- `server/src/services/resultsVnext/okr/okrReviewCommands.ts`
- `server/src/services/resultsVnext/okr/okrSetApprovedSnapshotTypes.ts`
- `server/src/services/resultsVnext/okr/okrSetCommands.ts`
- `server/src/services/resultsVnext/okr/okrSetHistoryRepository.ts`
- `server/src/services/resultsVnext/okr/okrSetMaterialChangeCommands.ts`
- `server/src/services/resultsVnext/okr/okrSetRepository.ts`
- `server/src/services/resultsVnext/okr/okrSetRollupCalculator.ts`
- `server/src/services/resultsVnext/okr/okrSupportCommands.ts`
- `server/src/services/resultsVnext/okr/okrSupportRepository.ts`
- `server/src/services/resultsVnext/okr/okrSupportTypes.ts`
- `server/src/services/resultsVnext/platform/__tests__/executionSignalIngress.pg.test.ts`
- `server/src/services/resultsVnext/platform/__tests__/roiGovernedVisibility20.realdb.test.ts`
- `server/src/services/resultsVnext/platform/__tests__/roiOpenOrgBackfillVariantB.realdb.test.ts`
- `server/src/services/resultsVnext/platform/__tests__/roiReadSurfaceInventory.test.ts`
- `server/src/services/resultsVnext/platform/atomicWrite.ts`
- `server/src/services/resultsVnext/platform/commandCapabilityGuard.ts`
- `server/src/services/resultsVnext/platform/consumerRegistry.ts`
- `server/src/services/resultsVnext/platform/executionSignalIngress.ts`
- `server/src/services/resultsVnext/platform/financeProjectionConsumer.ts`
- `server/src/services/resultsVnext/platform/myworkProjectionConsumer.ts`
- `server/src/services/resultsVnext/platform/obligations.ts`
- `server/src/services/resultsVnext/platform/platformOutboxDrainCron.ts`
- `server/src/services/resultsVnext/platform/resultsSearchRepository.ts`
- `server/src/services/resultsVnext/platform/visibilityResolver.ts`
- `server/src/services/resultsVnext/platform/visibilityScopedQuery.ts`
- `server/src/services/resultsVnext/roi/closureReceiptRoiCaseAdapter.ts`
- `server/src/services/resultsVnext/roi/engine/roiCalculationEngine.ts`
- `server/src/services/resultsVnext/roi/engine/roiCalculationEngine.types.ts`
- `server/src/services/resultsVnext/roi/roiActualEntryCommands.ts`
- `server/src/services/resultsVnext/roi/roiActualEntryRepository.ts`
- `server/src/services/resultsVnext/roi/roiActualSnapshotCommands.ts`
- `server/src/services/resultsVnext/roi/roiActualSnapshotRepository.ts`
- `server/src/services/resultsVnext/roi/roiApprovalSnapshotRepository.ts`
- `server/src/services/resultsVnext/roi/roiApprovalSnapshotTypes.ts`
- `server/src/services/resultsVnext/roi/roiAssumptionCommands.ts`
- `server/src/services/resultsVnext/roi/roiBaselineCommands.ts`
- `server/src/services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.ts`
- `server/src/services/resultsVnext/roi/roiBenefitLineCommands.ts`
- `server/src/services/resultsVnext/roi/roiBenefitsRealizationCommands.ts`
- `server/src/services/resultsVnext/roi/roiBenefitsRealizationRepository.ts`
- `server/src/services/resultsVnext/roi/roiCalculationPolicyCommands.ts`
- `server/src/services/resultsVnext/roi/roiCalculationRunCommands.ts`
- `server/src/services/resultsVnext/roi/roiCaseApprovalCommands.ts`
- `server/src/services/resultsVnext/roi/roiCaseCommands.ts`
- `server/src/services/resultsVnext/roi/roiCompareRepository.ts`
- `server/src/services/resultsVnext/roi/roiCostLineCommands.ts`
- `server/src/services/resultsVnext/roi/roiEconomicModelFreeze.ts`
- `server/src/services/resultsVnext/roi/roiEconomicModelReadiness.ts`
- `server/src/services/resultsVnext/roi/roiEconomicModelRepository.ts`
- `server/src/services/resultsVnext/roi/roiEconomicModelTypes.ts`
- `server/src/services/resultsVnext/roi/roiFinanceLinkCommands.ts`
- `server/src/services/resultsVnext/roi/roiFinanceLinkRepository.ts`
- `server/src/services/resultsVnext/roi/roiFinanceProjectionRepository.ts`
- `server/src/services/resultsVnext/roi/roiFinanceReconciliationCommands.ts`
- `server/src/services/resultsVnext/roi/roiFinanceSeamTypes.ts`
- `server/src/services/resultsVnext/roi/roiForecastActualTypes.ts`
- `server/src/services/resultsVnext/roi/roiForecastVersionCommands.ts`
- `server/src/services/resultsVnext/roi/roiForecastVersionRepository.ts`
- `server/src/services/resultsVnext/roi/roiLegacyArchiveRepository.ts`
- `server/src/services/resultsVnext/roi/roiOrgPerspectiveRepository.ts`
- `server/src/services/resultsVnext/roi/roiPirCommands.ts`
- `server/src/services/resultsVnext/roi/roiPirRepository.ts`
- `server/src/services/resultsVnext/roi/roiPirTypes.ts`
- `server/src/services/resultsVnext/roi/roiRepository.ts`
- `server/src/services/resultsVnext/roi/roiScenarioCommands.ts`
- `server/src/services/resultsVnext/roi/roiTrackingCommands.ts`
- `server/src/services/resultsVnext/roi/roiVarianceCommands.ts`
- `server/src/services/resultsVnext/roi/roiVarianceRepository.ts`
- `server/src/services/settingsNotificationEngineSync.ts`
- `server/src/services/signals/__tests__/decisionRules.postgres.test.ts`
- `server/src/services/signals/__tests__/executionRules.postgres.test.ts`
- `server/src/services/signals/__tests__/executionSignalAdapter.test.ts`
- `server/src/services/signals/__tests__/resultsFinanceRules.postgres.test.ts`
- `server/src/services/signals/__tests__/signalInterpreter.test.ts`
- `server/src/services/signals/signalInterpreter.ts`
- `server/src/services/signals/signalReadModel.ts`
- `server/src/services/slaService.ts`
- `server/src/services/slack/slackRouter.ts`
- `server/src/services/statementMultiSectionImportService.ts`
- `server/src/services/tablePlatform/migrationRunner.ts`
- `server/src/services/teresa/federatedActionAdapters.ts`
- `server/src/services/teresa/mountedMutationDenominator.ts`
- `server/src/services/teresa/teresaCapabilities.ts`
- `server/src/services/teresa/teresaEventStore.ts`
- `server/src/services/teresa/teresaKernel.ts`
- `server/src/services/teresa/teresaVoiceService.ts`
- `server/src/services/toolCatalog/__tests__/mvpGateRealPostgres.controller.pg.test.ts`
- `server/src/services/toolCatalog/approvedMvpToolTypes.ts`
- `server/src/services/toolFreeze/__tests__/tls-bvp-001-nonempty-lineage.realdb.test.ts`
- `server/src/services/tools/swotCandidateHandoffService.ts`
- `server/src/services/tools/toolOutputSnapshotService.ts`
- `server/src/services/v8/__tests__/agentAdapterOrchestratorService.test.ts`
- `server/src/services/v8/__tests__/agentContextProductionRetrievalAdapter.test.ts`
- `server/src/services/v8/__tests__/agentOperatorConsoleService.test.ts`
- `server/src/services/v8/__tests__/agentProposalGovernanceService.test.ts`
- `server/src/services/v8/__tests__/agentResourceGovernanceService.test.ts`
- `server/src/services/v8/__tests__/chat-routes.test.ts`
- `server/src/services/v8/__tests__/contextRetrievalServiceAgent.test.ts`
- `server/src/services/v8/__tests__/executionManagementSnapshotService.test.ts`
- `server/src/services/v8/__tests__/integration/t2-flows/crossModuleHandoffFlow.test.ts`
- `server/src/services/v8/__tests__/interviewConfidenceEvaluator.test.ts`
- `server/src/services/v8/__tests__/legacyNoncanonicalExecution.test.ts`
- `server/src/services/v8/__tests__/pmSyncExternalAuthMaterializationService.test.ts`
- `server/src/services/v8/__tests__/teresaHandoffTargets.failClosed.test.ts`
- `server/src/services/v8/__tests__/transformationCaseService.test.ts`
- `server/src/services/v8/__tests__/transformationFinalOutputNative.test.ts`
- `server/src/services/v8/__tests__/transformationFinalOutputService.test.ts`
- `server/src/services/v8/__tests__/transformationPlanningIntakeService.test.ts`
- `server/src/services/v8/agentAdapterOrchestratorService.ts`
- `server/src/services/v8/agentContextGroundingService.ts`
- `server/src/services/v8/agentContextProductionRetrievalAdapter.ts`
- `server/src/services/v8/agentOperatorConsoleService.ts`
- `server/src/services/v8/agentProcessTemplateService.ts`
- `server/src/services/v8/agentProposalGovernanceService.ts`
- `server/src/services/v8/agentResourceGovernanceService.ts`
- `server/src/services/v8/agentTenantSettingsService.ts`
- `server/src/services/v8/artifactRegistryService.ts`
- `server/src/services/v8/chatExecutionService.ts`
- `server/src/services/v8/interviewConfidenceEvaluator.ts`
- `server/src/services/v8/multiAgentWorkManagerService.ts`
- `server/src/services/v8/teresaCopilotCanon.ts`
- `server/src/services/v8/teresaCopilotService.ts`
- `server/src/services/v8/transformationCaseService.ts`
- `server/src/services/v8/transformationFinalOutputService.ts`
- `server/src/services/v8/transformationInitiativeTransitionAdapterService.ts`
- `server/src/services/v8/transformationMobilizationOwnerAdapterService.ts`
- `server/src/services/v8/transformationPlanningIntakeService.ts`
- `server/src/services/v8/transformationProjectTeamService.ts`
- `server/src/services/valuationService.ts`
- `server/src/services/wave8AgentRuntimeService.ts`
- `server/src/services/workbook/WorkbookGeneratorService.ts`
- `server/src/services/workbook/__tests__/benefitsRealization.test.ts`
- `server/src/services/workbook/__tests__/deterministicInitiativeBudget.test.ts`
- `server/src/services/workbook/__tests__/workbookClosure.pg.test.ts`
- `server/src/services/workbook/__tests__/workbookImport.test.ts`
- `server/src/services/workbook/customWorkbookTemplateService.ts`
- `server/src/services/workbook/deterministicInitiativeBudget.ts`
- `server/src/services/workbook/templates/benefitsRealization.ts`
- `server/src/services/workbook/templates/index.ts`
- `server/src/services/workbook/workbookCommandService.ts`
- `server/src/services/workbook/workbookCreationService.ts`
- `server/src/services/workbook/workbookImport.ts`
- `server/src/services/workloadCapacityService.ts`
- `server/src/sharedRuntime/config/swot/swotAcceptGate.ts`
- `server/src/sharedRuntime/toolOutputs/buildSwotOutput.ts`
- `server/src/sharedRuntime/toolOutputs/outputLifecycle.ts`
- `server/src/sharedRuntime/toolOutputs/renderReport.ts`
- `server/src/startup/__tests__/bootstrapConfigMatrix.test.ts`
- `server/src/startup/__tests__/testModeGates.test.ts`
- `server/src/startup/databaseReadiness.ts`
- `server/src/testing/__tests__/assertRealDatabase.test.ts`
- `server/src/testing/__tests__/dbSuitesNotSilentlySkipped.test.ts`
- `server/src/testing/assertRealDatabase.ts`
- `server/src/types/finance/ArtifactRef.ts`
- `server/src/types/finance/CellRef.ts`
- `server/src/types/finance/Operation.ts`
- `server/src/types/finance/WorkspaceState.ts`
- `server/src/types/finance/financeValueSemantics.ts`
- `server/src/types/transformationCase.ts`
- `server/src/utils/__tests__/DbPromise.tableExists.test.ts`
- `server/src/utils/__tests__/pdfFonts.test.ts`
- `server/src/utils/queryHelpers.ts`
- `server/src/validators/auth.validators.ts`
- `server/src/validators/ideaWorkspaceGraph.validators.ts`
- `server/src/validators/resultsVnextOkr.validators.ts`
- `server/src/validators/resultsVnextRoi.validators.ts`
- `server/src/validators/resultsVnextRoiEconomicModel.validators.ts`
- `server/src/validators/resultsVnextRoiForecastActual.validators.ts`
- `server/src/validators/resultsVnextRoiPir.validators.ts`
- `server/src/workers/aiWorker.ts`
- `server/src/workers/asyncJobProcessor.ts`

### P5 — dokładna lista plików

- `src/App.tsx`
- `src/actions/federatedActionAdapters.ts`
- `src/actions/ideaActionRegistry.ts`
- `src/actions/quickActionAck.ts`
- `src/actions/registry/mindmapActions.ts`
- `src/actions/registry/processFlowActions.ts`
- `src/actions/registry/runtimeHelpers.ts`
- `src/actions/registry/sharedActions.ts`
- `src/actions/registry/tableActions.ts`
- `src/actions/registry/whiteboardActions.ts`
- `src/components/AIChat/AgentHubShell.tsx`
- `src/components/AIChat/AgentMaterializationPanel.tsx`
- `src/components/AIChat/AgentOperationsPanel.tsx`
- `src/components/AIChat/AgentProcessTemplatesPanel.tsx`
- `src/components/AIChat/CanvasViewModeControl.tsx`
- `src/components/AIChat/CaseIntakeConfirmCard.tsx`
- `src/components/AIChat/CitationList.tsx`
- `src/components/AIChat/GovernedChatHandoffCard.tsx`
- `src/components/AIChat/InlineResponseFeedback.tsx`
- `src/components/AIChat/KimiWorkspace/ExceleParametricTemplates.tsx`
- `src/components/AIChat/KimiWorkspace/SpreadsheetArtifactStudio.tsx`
- `src/components/AIChat/KimiWorkspace/WorkbookBoardSummary.tsx`
- `src/components/AIChat/KimiWorkspace/__tests__/EditableSpreadsheetGrid.manual.test.tsx`
- `src/components/AIChat/KimiWorkspace/__tests__/ExceleParametricTemplates.persistence.test.tsx`
- `src/components/AIChat/KimiWorkspace/__tests__/spreadsheetArtifactCommands.test.ts`
- `src/components/AIChat/KimiWorkspace/__tests__/spreadsheetFindReplace.test.ts`
- `src/components/AIChat/KimiWorkspace/__tests__/useKimiArtifactPipeline.test.ts`
- `src/components/AIChat/KimiWorkspace/spreadsheetFindReplace.ts`
- `src/components/AIChat/ProjectTeamCard.tsx`
- `src/components/AIChat/TransformationCasesPanel.tsx`
- `src/components/AIChat/V8ArtifactRunControl.tsx`
- `src/components/AIChat/V8ContextIndicator.tsx`
- `src/components/AIChat/WorkCanvasDocumentPanel.tsx`
- `src/components/AIChat/__tests__/CanvasViewModeControl.ownerBehavior.test.tsx`
- `src/components/AIChat/__tests__/ChatHistorySidebar.visibilityConsent.test.ts`
- `src/components/AIChat/__tests__/EnhancedChatInput.idlePulse.ownerFeedback.test.ts`
- `src/components/AIChat/__tests__/GovernedChatHandoffCard.test.tsx`
- `src/components/AIChat/__tests__/MessageRenderer.responseActions.ownerFeedback.test.ts`
- `src/components/AIChat/__tests__/MoveToProjectModal.visibilityHistory.test.tsx`
- `src/components/AIChat/__tests__/ProjectMembersModal.contextGovernance.test.tsx`
- `src/components/AIChat/__tests__/WorkCanvasDocumentPanel.ownerFeedback.test.ts`
- `src/components/AIChat/__tests__/chatHeaderControls.ownerFeedback.test.ts`
- `src/components/AIChat/__tests__/teresaWelcome.ownerFeedback.test.ts`
- `src/components/AIChat/chatHistoryVisibility.ts`
- `src/components/AIChat/signalsFeed/ChatSignalsFeed.tsx`
- `src/components/Admin/AdminCommandCenterPanel.tsx`
- `src/components/Admin/AdminSecurityIdentityPanel.tsx`
- `src/components/Admin/__tests__/AdminAccessReviewsPanel.test.tsx`
- `src/components/Admin/__tests__/AdminAiIncidentsPanel.test.tsx`
- `src/components/Admin/__tests__/AdminAuditExportHistoryPanel.test.tsx`
- `src/components/Admin/__tests__/AdminAuditIntegrityPanel.test.tsx`
- `src/components/Admin/__tests__/AdminBillingFinOpsPanel.alertsHonesty.test.tsx`
- `src/components/Admin/__tests__/AdminBreakGlassPanel.test.tsx`
- `src/components/Admin/__tests__/AdminCommandCenterAttentionQueue.test.tsx`
- `src/components/Admin/__tests__/AdminCommandCenterCostCapacity.test.tsx`
- `src/components/Admin/__tests__/AdminComplianceEvidencePanel.test.tsx`
- `src/components/Admin/__tests__/AdminConfigurationVersionsPanel.test.tsx`
- `src/components/Admin/__tests__/AdminGuestsPanel.test.tsx`
- `src/components/Admin/__tests__/AdminJobsPanel.test.tsx`
- `src/components/Admin/__tests__/AdminLegalHoldPanel.test.tsx`
- `src/components/Admin/__tests__/AdminMembersRolesPanel.test.tsx`
- `src/components/Admin/__tests__/AdminOrganizationDefaultsPanel.test.tsx`
- `src/components/Admin/__tests__/AdminPlanHistoryPanel.test.tsx`
- `src/components/Admin/__tests__/AdminRolesPermissionsPanel.test.tsx`
- `src/components/Admin/__tests__/AdminSeatsLicencesPanel.test.tsx`
- `src/components/Admin/__tests__/AdminSecurityAlertsPanel.test.tsx`
- `src/components/Admin/__tests__/AdminServiceAccountsPanel.test.tsx`
- `src/components/Admin/__tests__/AdminSessionsPanel.test.tsx`
- `src/components/Admin/__tests__/AdminSlaSloPanel.test.tsx`
- `src/components/Admin/__tests__/AdminTeamsPanel.test.tsx`
- `src/components/Admin/__tests__/PersonasPanel.test.tsx`
- `src/components/Audit/method/AuditReportDocumentView.tsx`
- `src/components/Audit/method/AuditsMethodHub.tsx`
- `src/components/Audit/method/__tests__/AuditFindingsTab.test.tsx`
- `src/components/Audit/method/__tests__/AuditInitiativesTab.test.tsx`
- `src/components/Audit/method/__tests__/AuditLibraryTab.test.tsx`
- `src/components/Audit/method/__tests__/AuditOutputsTab.reportGeneration.test.tsx`
- `src/components/Audit/method/__tests__/AuditOutputsTab.test.tsx`
- `src/components/Audit/method/__tests__/AuditProcessesTab.criteriaBrowser.test.tsx`
- `src/components/Audit/method/__tests__/AuditProcessesTab.finalizeOutput.test.tsx`
- `src/components/Audit/method/__tests__/AuditProcessesTab.overdue.test.tsx`
- `src/components/Audit/method/__tests__/AuditProcessesTab.test.tsx`
- `src/components/Audit/method/__tests__/AuditReportDocumentView.export.test.tsx`
- `src/components/Audit/method/__tests__/AuditReportDocumentView.test.tsx`
- `src/components/Audit/method/__tests__/AuditReportsTab.export.test.tsx`
- `src/components/Audit/method/__tests__/AuditReportsTab.test.tsx`
- `src/components/Audit/method/__tests__/AuditsMethodHub.newAuditCta.test.tsx`
- `src/components/Audit/method/__tests__/AuditsMethodHub.processesLabel.test.tsx`
- `src/components/Audit/method/__tests__/AuditsMethodHub.test.tsx`
- `src/components/Audit/method/__tests__/auditStatusTones.test.ts`
- `src/components/Audit/method/auditStatusTones.ts`
- `src/components/Audit/method/auditsMethodApi.ts`
- `src/components/Audit/method/tabs/AuditCriteriaBrowser.tsx`
- `src/components/Audit/method/tabs/AuditFindingsTab.tsx`
- `src/components/Audit/method/tabs/AuditInitiativesTab.tsx`
- `src/components/Audit/method/tabs/AuditLibraryTab.tsx`
- `src/components/Audit/method/tabs/AuditOutputsTab.tsx`
- `src/components/Audit/method/tabs/AuditProcessesTab.tsx`
- `src/components/Audit/method/tabs/AuditReportsTab.tsx`
- `src/components/Audit/method/workspace/CriterionWorkspace.tsx`
- `src/components/Audit/method/workspace/EvidencePanel.tsx`
- `src/components/Audit/method/workspace/FindingPanel.tsx`
- `src/components/Audit/method/workspace/RemediationPanel.tsx`
- `src/components/Audit/method/workspace/TeresaProposalCard.tsx`
- `src/components/Audit/method/workspace/__tests__/CriterionWorkspace.test.tsx`
- `src/components/Audit/method/workspace/__tests__/CriterionWorkspaceGate.realFlag.test.tsx`
- `src/components/Audit/method/workspace/__tests__/EvidencePanel.test.tsx`
- `src/components/Audit/method/workspace/__tests__/FindingPanel.test.tsx`
- `src/components/Audit/method/workspace/__tests__/RemediationPanel.test.tsx`
- `src/components/Audit/method/workspace/__tests__/TeresaProposalCard.test.tsx`
- `src/components/Audit/method/workspace/chainLinks.ts`
- `src/components/Audit/method/workspace/v2/__tests__/CriterionWorkspaceV2.polishFixes.test.tsx`
- `src/components/Audit/method/workspace/v2/__tests__/CriterionWorkspaceV2.test.tsx`
- `src/components/Audit/method/workspace/workspaceApi.ts`
- `src/components/Benefits/ValuationWorkspace.tsx`
- `src/components/Benefits/__tests__/ValuationWorkspace.candidateHandoff.test.tsx`
- `src/components/CaseWorkspace/CaseDetailScreen.tsx`
- `src/components/CaseWorkspace/CasesListScreen.tsx`
- `src/components/CaseWorkspace/PlanView.tsx`
- `src/components/CaseWorkspace/RealizacjaView.tsx`
- `src/components/CaseWorkspace/RezultatyView.tsx`
- `src/components/CaseWorkspace/apiIntake.ts`
- `src/components/CaseWorkspace/apiLightStart.ts`
- `src/components/CaseWorkspace/podglad/main.tsx`
- `src/components/CaseWorkspace/ui.tsx`
- `src/components/Discovery/__tests__/DiscoveryToolsHub.networkBootstrap.test.ts`
- `src/components/DiscoveryTools/ToolWorkspace.tsx`
- `src/components/DiscoveryTools/__tests__/SwotLiveArtifact.test.tsx`
- `src/components/DiscoveryTools/__tests__/ToolSessionPreviewV3.ownerCompletion.test.ts`
- `src/components/DiscoveryTools/__tests__/genericDomainStep.smoke.test.tsx`
- `src/components/DiscoveryTools/live/SwotLiveArtifact.tsx`
- `src/components/DiscoveryTools/report/SlideDeckView.tsx`
- `src/components/DiscoveryTools/report/ToolOutputsPanel.tsx`
- `src/components/DiscoveryTools/report/ToolReportView.tsx`
- `src/components/DiscoveryTools/report/__tests__/SlideDeckView.test.tsx`
- `src/components/DiscoveryTools/tools/DynamicSWOT/EvidenceEditor.tsx`
- `src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInsightsPhase.tsx`
- `src/components/DiscoveryTools/tools/DynamicSWOT/TeresaSwotProposals.tsx`
- `src/components/DiscoveryTools/tools/DynamicSWOT/__tests__/SWOTInputExplorationPhase.ai-fill.test.tsx`
- `src/components/DiscoveryTools/tools/DynamicSWOT/__tests__/SWOTInputExplorationPhase.deleteConfirm.test.tsx`
- `src/components/DiscoveryTools/tools/DynamicSWOT/__tests__/SWOTInputExplorationPhase.ownerFeedback.test.ts`
- `src/components/DiscoveryTools/tools/DynamicSWOT/__tests__/SWOTInsightsPhase.candidateReceipt.test.tsx`
- `src/components/DiscoveryTools/tools/MarketForces/MarketForcesPhases.tsx`
- `src/components/DocumentStudio/__tests__/templateArchitectErrors.test.ts`
- `src/components/DocumentStudio/types.ts`
- `src/components/Economics/FinanceHub.tsx`
- `src/components/Economics/__tests__/financeDetailBranches.identity.test.ts`
- `src/components/Economics/__tests__/financeHubShell.contract.test.ts`
- `src/components/Economics/__tests__/financeOwnerSampleData.contract.test.tsx`
- `src/components/Economics/__tests__/useFinanceSelection.statementRatios.test.tsx`
- `src/components/Economics/hooks/useFinanceData.ts`
- `src/components/Execution/BudgetControlPanel.tsx`
- `src/components/Execution/ExecutionControlSurface.tsx`
- `src/components/Execution/ExecutionHub.tsx`
- `src/components/Execution/ExecutionReportsSurface.tsx`
- `src/components/Execution/__tests__/ExecutionRuntimeSpine.contract.test.ts`
- `src/components/Execution/executionFeatureFlags.ts`
- `src/components/Execution/executionLocalReviewData.ts`
- `src/components/Execution/executionReports.ts`
- `src/components/Execution/reports-intelligence/UnifiedExecutionReportGenerator.tsx`
- `src/components/Execution/reports-intelligence/WorkIntelligenceReport.tsx`
- `src/components/Execution/reports-intelligence/__tests__/ControlLoopReport.test.tsx`
- `src/components/Execution/reports-intelligence/__tests__/ResourcesCapacityReport.test.tsx`
- `src/components/Execution/reports-intelligence/__tests__/UnifiedExecutionReportGenerator.test.tsx`
- `src/components/Execution/reports-intelligence/__tests__/WorkIntelligenceReport.test.tsx`
- `src/components/Execution/reports-intelligence/workReportModel.ts`
- `src/components/Finance/Analysis/AnalysisKpiDetailCard.tsx`
- `src/components/Finance/Analysis/AnalysisKpiTable.tsx`
- `src/components/Finance/Analysis/__tests__/analysisCreatorWizard.contract.test.ts`
- `src/components/Finance/Analysis/__tests__/analysisKpiCatalog.test.ts`
- `src/components/Finance/Analysis/__tests__/analysisKpiCompute.test.ts`
- `src/components/Finance/Analysis/__tests__/analysisKpiTable.contract.test.ts`
- `src/components/Finance/Analysis/__tests__/analysisWorkspace.contract.test.ts`
- `src/components/Finance/Analysis/analysisCreatorWizard.contract.ts`
- `src/components/Finance/Analysis/analysisKpiCatalog.ts`
- `src/components/Finance/Analysis/analysisKpiCompute.ts`
- `src/components/Finance/Analysis/analysisKpiTable.contract.ts`
- `src/components/Finance/Analysis/analysisWorkspace.contract.ts`
- `src/components/Finance/BaselineWorkspace.tsx`
- `src/components/Finance/CanonicalStatementTable.tsx`
- `src/components/Finance/FinancialModelWorkspace.tsx`
- `src/components/Finance/FinancialStatementMappingEditor.tsx`
- `src/components/Finance/Prediction/PredictionWorkspace.tsx`
- `src/components/Finance/Prediction/ScenarioAssumptionsView.tsx`
- `src/components/Finance/Prediction/ScenarioResultsView.tsx`
- `src/components/Finance/Prediction/__tests__/independentVerification.doubleCounting.test.ts`
- `src/components/Finance/Prediction/__tests__/predictionScenarioModel.test.ts`
- `src/components/Finance/Prediction/predictionScenarioModel.ts`
- `src/components/Finance/Prediction/predictionWorkspaceBarConfig.ts`
- `src/components/Finance/Valuation/ValuationValueCell.tsx`
- `src/components/Finance/Valuation/ValuationWorkspace.tsx`
- `src/components/Finance/Valuation/__tests__/valuationMath.test.ts`
- `src/components/Finance/Valuation/steps/SourceStep.tsx`
- `src/components/Finance/Valuation/valuationMath.ts`
- `src/components/Finance/baseline/CalculationsView.tsx`
- `src/components/Finance/baseline/__tests__/CalculationsView.antiplug.test.tsx`
- `src/components/Finance/baseline/__tests__/useBaselineCompute.test.ts`
- `src/components/Finance/baseline/baselineLabels.ts`
- `src/components/Finance/baseline/useBaselineCompute.ts`
- `src/components/Finance/shared/FinanceErrorBoundary.tsx`
- `src/components/Finance/shared/__tests__/FinanceCandidateHandoffModal.test.tsx`
- `src/components/Finance/shared/__tests__/FinanceErrorBoundary.test.tsx`
- `src/components/Finance/shared/__tests__/FinanceWorkspaceBar.test.tsx`
- `src/components/Finance/shared/__tests__/financeWorkspaceBar.contract.test.ts`
- `src/components/Finance/shared/__tests__/financeWorkspaceResolver.table.test.ts`
- `src/components/Finance/shared/__tests__/focusMode.contract.test.ts`
- `src/components/Finance/shared/financeWorkspaceBar.contract.ts`
- `src/components/Finance/shared/focusMode.contract.ts`
- `src/components/Finance/statementPackWorkspaceV2/NamedCollapsibleSection.tsx`
- `src/components/Finance/statementPackWorkspaceV2/ReconciliationLedgerPanel.tsx`
- `src/components/Finance/statementPackWorkspaceV2/RelatedArtifactsSection.tsx`
- `src/components/Finance/statementPackWorkspaceV2/SourceEvidencePanel.tsx`
- `src/components/Finance/statementPackWorkspaceV2/StatementReportActionsSection.tsx`
- `src/components/Finance/statementPackWorkspaceV2/__tests__/CanonicalStatementTableV2.test.tsx`
- `src/components/Finance/statementPackWorkspaceV2/__tests__/NamedCollapsibleSection.test.tsx`
- `src/components/Finance/statementPackWorkspaceV2/__tests__/ReconciliationLedgerPanel.test.tsx`
- `src/components/Finance/statementPackWorkspaceV2/__tests__/RelatedArtifactsSection.test.tsx`
- `src/components/Finance/statementPackWorkspaceV2/__tests__/SourceEvidencePanel.test.tsx`
- `src/components/Finance/statementPackWorkspaceV2/__tests__/StatementPackWorkspaceV2.persistence.test.tsx`
- `src/components/Finance/statementPackWorkspaceV2/__tests__/StatementReportActionsSection.test.tsx`
- `src/components/Finance/statementPackWorkspaceV2/__tests__/deriveStatementTable.test.ts`
- `src/components/Finance/statementPackWorkspaceV2/deriveStatementTable.ts`
- `src/components/Initiatives/InitiativeDocumentView.tsx`
- `src/components/Initiatives/InitiativesHub.tsx`
- `src/components/Initiatives/PlanScenarioSurface.tsx`
- `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx`
- `src/components/Initiatives/__tests__/InitiativesHub.newModalA11y.test.tsx`
- `src/components/Initiatives/sections/WatchersSection.tsx`
- `src/components/Interview/InsightCreatorModal.tsx`
- `src/components/Interview/InterviewInitiativePreview.tsx`
- `src/components/Interview/__tests__/AssignInterviewModal.ownerContract.test.ts`
- `src/components/Interview/__tests__/InterviewInitiativePreviewBody.canon.test.tsx`
- `src/components/Interview/__tests__/InterviewQuestionWorkspace.ownerContract.test.ts`
- `src/components/Interview/__tests__/InterviewSingleQuestionRuntime.ownerBehavior.test.tsx`
- `src/components/Interview/__tests__/PreviewActionBar.ownerBehavior.test.tsx`
- `src/components/Meeting/MeetingHub.tsx`
- `src/components/Meeting/MeetingObjectPage.tsx`
- `src/components/Meeting/__tests__/MeetingHub.smoke.test.tsx`
- `src/components/Meeting/__tests__/MeetingObjectPage.test.tsx`
- `src/components/MyWork/Calendar/CalendarCreateEventModal.tsx`
- `src/components/MyWork/Calendar/__tests__/CalendarCreateEventModal.attendees.test.tsx`
- `src/components/MyWork/Calendar/__tests__/CalendarCreateEventModal.confirmDialogStacking.test.tsx`
- `src/components/MyWork/Calendar/__tests__/CalendarCreateEventModal.v2.test.tsx`
- `src/components/MyWork/CalendarV2/__tests__/duplicateCalendarEvent.test.ts`
- `src/components/MyWork/ConversionPreviewDialog.tsx`
- `src/components/MyWork/ConvertToDialog.tsx`
- `src/components/MyWork/ConvertToOutputMenu.tsx`
- `src/components/MyWork/DecisionDetailView.tsx`
- `src/components/MyWork/DecisionsPanelContent.tsx`
- `src/components/MyWork/EffectivenessClosureQueue.tsx`
- `src/components/MyWork/Home/HomeView.tsx`
- `src/components/MyWork/IdeaCanvasContextMenu.tsx`
- `src/components/MyWork/IdeaMapWorkspace.tsx`
- `src/components/MyWork/IdeaProcessFlowTool.tsx`
- `src/components/MyWork/IdeaRecommendationMap.tsx`
- `src/components/MyWork/IdeaTableTool.tsx`
- `src/components/MyWork/IdeaTemplateGallery.tsx`
- `src/components/MyWork/IdeaWhiteboardTool.tsx`
- `src/components/MyWork/IdeaWorkspaceTools.tsx`
- `src/components/MyWork/IdeasTableContent.tsx`
- `src/components/MyWork/MyIdeasListContent.tsx`
- `src/components/MyWork/MyTasksListContent.tsx`
- `src/components/MyWork/MyWorkHub.tsx`
- `src/components/MyWork/MyWorkNav.tsx`
- `src/components/MyWork/NotebookContent.tsx`
- `src/components/MyWork/TaskDetailView.tsx`
- `src/components/MyWork/__tests__/DecisionsPanelContent.ownerStates.test.tsx`
- `src/components/MyWork/__tests__/IdeaAINudgeStrip.mindmapMount.ownerFeedback.test.ts`
- `src/components/MyWork/__tests__/IdeaAINudgeStrip.ownerContract.test.ts`
- `src/components/MyWork/__tests__/IdeaAINudgeStrip.remainingTools.contract.test.ts`
- `src/components/MyWork/__tests__/IdeaMapWorkspace.candidateGate.ownerFeedback.test.ts`
- `src/components/MyWork/__tests__/IdeaStartupTemplates.ownerFeedback.test.tsx`
- `src/components/MyWork/__tests__/IdeaTableTool.autosaveOnly.contract.test.ts`
- `src/components/MyWork/__tests__/InboxContent.emptyStateHonesty.ownerFeedback.test.ts`
- `src/components/MyWork/__tests__/MyWorkHub.decisionsOwnerFeedback.test.ts`
- `src/components/MyWork/__tests__/MyWorkHub.storageScope.test.ts`
- `src/components/MyWork/__tests__/NotebookHeaderActions.a11y.test.tsx`
- `src/components/MyWork/__tests__/TaskAnalyzeRisk.ownerBehavior.test.tsx`
- `src/components/MyWork/__tests__/TaskGeneratedSectionHandoff.ownerBehavior.test.tsx`
- `src/components/MyWork/__tests__/TaskOwnerFeedback.contract.test.ts`
- `src/components/MyWork/__tests__/ideaInspectorRowDetailParity.contract.test.ts`
- `src/components/MyWork/canvas/__tests__/canvasFocusRing.test.ts`
- `src/components/MyWork/canvas/__tests__/mindmapKeyboardScope.test.ts`
- `src/components/MyWork/canvas/__tests__/useIdeaMapSync.staleQueuedD3.test.tsx`
- `src/components/MyWork/canvas/useIdeasToolKeyboard.ts`
- `src/components/MyWork/hooks/useKeyboardShortcuts.ts`
- `src/components/MyWork/ideaCanvasMelsChips.ts`
- `src/components/MyWork/ideaMaturityModel.ts`
- `src/components/MyWork/knowledge/KnowledgeCardNodes.tsx`
- `src/components/MyWork/mindmap/AIAutoClustering.tsx`
- `src/components/MyWork/mindmap/AICompetitiveLandscape.tsx`
- `src/components/MyWork/mindmap/AIDependencyDetector.tsx`
- `src/components/MyWork/mindmap/AIPriorityRecommender.tsx`
- `src/components/MyWork/mindmap/AIProposalDiffModal.tsx`
- `src/components/MyWork/mindmap/AISentimentOverlay.tsx`
- `src/components/MyWork/mindmap/AIWhatIfScenarios.tsx`
- `src/components/MyWork/mindmap/BatchConvertModal.tsx`
- `src/components/MyWork/mindmap/BranchComparison.tsx`
- `src/components/MyWork/mindmap/CanvasLeftToolbar.tsx`
- `src/components/MyWork/mindmap/DocumentToMap.tsx`
- `src/components/MyWork/mindmap/EdgeContextMenu.tsx`
- `src/components/MyWork/mindmap/EmbedInReports.tsx`
- `src/components/MyWork/mindmap/ExportDiagramCode.tsx`
- `src/components/MyWork/mindmap/ExportPowerPoint.tsx`
- `src/components/MyWork/mindmap/IdeaFunnelAnalytics.tsx`
- `src/components/MyWork/mindmap/IdeaViewSwitcher.tsx`
- `src/components/MyWork/mindmap/ImportExternalMap.tsx`
- `src/components/MyWork/mindmap/InterviewToMap.tsx`
- `src/components/MyWork/mindmap/MapHealthScore.tsx`
- `src/components/MyWork/mindmap/MindMap3DView.tsx`
- `src/components/MyWork/mindmap/MindmapCommandPalette.tsx`
- `src/components/MyWork/mindmap/NodeContextMenu.tsx`
- `src/components/MyWork/mindmap/SnapshotHistory.tsx`
- `src/components/MyWork/mindmap/TimeHeatmap.tsx`
- `src/components/MyWork/mindmap/TimelineView.tsx`
- `src/components/MyWork/mindmap/UnifiedNodeDetailDrawer.tsx`
- `src/components/MyWork/mindmap/VoiceToNode.tsx`
- `src/components/MyWork/mindmap/__tests__/MindmapCommandPalette.a11y.test.tsx`
- `src/components/MyWork/mindmap/__tests__/dialogA11y.batch1.test.tsx`
- `src/components/MyWork/mindmap/__tests__/dialogA11y.batch4.test.tsx`
- `src/components/MyWork/mindmap/useMapExportPdf.ts`
- `src/components/MyWork/mindmap/useMindMapQuickActions.ts`
- `src/components/MyWork/notebook/NotebookRightRail.tsx`
- `src/components/MyWork/notebook/NotebookSearchDialog.tsx`
- `src/components/MyWork/notebook/__tests__/NotebookContent.blockGutter.contract.test.ts`
- `src/components/MyWork/notebook/__tests__/NotebookContent.blockMenuContract.test.ts`
- `src/components/MyWork/notebook/__tests__/NotebookInlineAIMenu.governanceContract.test.ts`
- `src/components/MyWork/notebook/__tests__/NotebookRightRail.ownerContract.test.ts`
- `src/components/MyWork/notebook/__tests__/NotebookSearchDialog.behavior.test.tsx`
- `src/components/MyWork/notebook/notebookCaptureSourceSummary.ts`
- `src/components/MyWork/panel/IdeaBusinessCaseSection.tsx`
- `src/components/MyWork/panel/IdeaElementInspector.tsx`
- `src/components/MyWork/panel/useIdeaBusinessCase.ts`
- `src/components/MyWork/processflow/__tests__/dialogA11y.batch1.test.tsx`
- `src/components/MyWork/processflow/useProcessFlowNodes.ts`
- `src/components/MyWork/processflow/useProcessFlowQuickActions.ts`
- `src/components/MyWork/shared/IdeaMaturityGate.tsx`
- `src/components/MyWork/table/AITableAssistant.tsx`
- `src/components/MyWork/table/AddColumnDialog.tsx`
- `src/components/MyWork/table/ChatToSchemaPanel.tsx`
- `src/components/MyWork/table/ExportToPresentation.tsx`
- `src/components/MyWork/table/IdeaDecisionLogPanel.tsx`
- `src/components/MyWork/table/IdeaScoringModel.tsx`
- `src/components/MyWork/table/IdeaStartupTemplates.tsx`
- `src/components/MyWork/table/RecordExpandModal.tsx`
- `src/components/MyWork/table/TableToolbar.tsx`
- `src/components/MyWork/table/__tests__/AICopilotMode.registryBoundary.test.tsx`
- `src/components/MyWork/table/__tests__/AddColumnDialog.a11y.test.tsx`
- `src/components/MyWork/table/__tests__/RecordExpandModal.a11y.test.tsx`
- `src/components/MyWork/table/__tests__/dialogA11y.batch1.test.tsx`
- `src/components/MyWork/table/__tests__/dialogA11y.batch4.test.tsx`
- `src/components/MyWork/table/__tests__/dialogA11y.batch5.test.tsx`
- `src/components/MyWork/table/__tests__/dialogA11y.batch6.test.tsx`
- `src/components/MyWork/table/cells/SourceReferenceCell.tsx`
- `src/components/MyWork/table/charts/ChartConfigPanel.tsx`
- `src/components/MyWork/table/connectors/ConnectorWizard.tsx`
- `src/components/MyWork/table/extensions/ExtensionMarketplace.tsx`
- `src/components/MyWork/table/financial/FinancialCaseView.tsx`
- `src/components/MyWork/table/financial/FinancialDriverTable.tsx`
- `src/components/MyWork/table/financial/engineAdapter.ts`
- `src/components/MyWork/table/financial/useIdeaFinancialCasePersistence.ts`
- `src/components/MyWork/table/forms/IntakeJwtPanel.tsx`
- `src/components/MyWork/table/ideaDecisionGovernance.ts`
- `src/components/MyWork/table/ideaScoringGovernance.ts`
- `src/components/MyWork/table/offline/OfflineIndicator.tsx`
- `src/components/MyWork/table/sync/SyncManager.tsx`
- `src/components/MyWork/table/tableRowLimits.ts`
- `src/components/MyWork/table/useTableQuickActions.ts`
- `src/components/MyWork/table/views/ViewConfigPanel.tsx`
- `src/components/MyWork/taskGeneratedSectionPersistence.ts`
- `src/components/MyWork/useIdeaConfidentialityGate.ts`
- `src/components/MyWork/whiteboard/WhiteboardEdgeContextMenu.tsx`
- `src/components/MyWork/whiteboard/WhiteboardToolbar.tsx`
- `src/components/MyWork/whiteboard/__tests__/dialogA11y.batch1.test.tsx`
- `src/components/MyWork/whiteboard/__tests__/whiteboardPlacement.test.ts`
- `src/components/MyWork/whiteboard/useWhiteboardNodes.ts`
- `src/components/MyWork/whiteboard/whiteboardPlacement.ts`
- `src/components/Organization/GovernedContextWorkspace.tsx`
- `src/components/Organization/OrganizationDecisionQualityPanel.tsx`
- `src/components/Organization/redesign/OrganizationChallengesEvidenceScreen.tsx`
- `src/components/Organization/redesign/OrganizationDirectionConstraintsScreen.tsx`
- `src/components/Organization/redesign/OrganizationGoalsMetricsScreen.tsx`
- `src/components/Organization/redesign/OrganizationRisksOpportunitiesScreen.tsx`
- `src/components/Organization/redesign/OrganizationRootCausesBlockersScreen.tsx`
- `src/components/Organization/redesign/OrganizationScenariosBriefScreen.tsx`
- `src/components/Organization/redesign/OrganizationScopeCollaborationScreen.tsx`
- `src/components/Organization/redesign/OrganizationScreenShell.tsx`
- `src/components/Organization/redesign/__tests__/OrganizationCardPrimitives.test.tsx`
- `src/components/Organization/redesign/__tests__/OrganizationChallengesEvidenceScreen.test.tsx`
- `src/components/Organization/redesign/__tests__/OrganizationDirectionConstraintsScreen.test.tsx`
- `src/components/Organization/redesign/__tests__/OrganizationGoalsMetricsScreen.test.tsx`
- `src/components/Organization/redesign/__tests__/OrganizationIdentityOperatingScreen.test.tsx`
- `src/components/Organization/redesign/__tests__/OrganizationRisksOpportunitiesScreen.test.tsx`
- `src/components/Organization/redesign/__tests__/OrganizationRootCausesBlockersScreen.test.tsx`
- `src/components/Organization/redesign/__tests__/OrganizationScenariosBriefScreen.test.tsx`
- `src/components/Organization/redesign/__tests__/OrganizationScopeCollaborationScreen.test.tsx`
- `src/components/Organization/redesign/__tests__/OrganizationSidebar.redesign.test.tsx`
- `src/components/Organization/redesign/__tests__/organizationRedesignNav.test.ts`
- `src/components/PMO/InitiativeCompletenessChecker.tsx`
- `src/components/Portfolio/PortfolioListView.tsx`
- `src/components/Presentations/DeckBuilder/CardRenderer.tsx`
- `src/components/Presentations/DeckBuilder/DeckBuilder.tsx`
- `src/components/Presentations/DeckBuilder/PresentationReviewPanel.tsx`
- `src/components/Presentations/DeckBuilder/__tests__/PresentMode.test.tsx`
- `src/components/Presentations/DeckBuilder/__tests__/PresentationReviewPanel.test.tsx`
- `src/components/Presentations/DeckBuilder/manualEditing.ts`
- `src/components/Presentations/wizard/types.ts`
- `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx`
- `src/components/ReportsAndPresentations/TemplatesTabContent.tsx`
- `src/components/ReportsAndPresentations/materialsOwnerSampleData.ts`
- `src/components/ReportsAndPresentations/types.ts`
- `src/components/Results/KPITimeSeriesDrawer.tsx`
- `src/components/Results/KpiSignalSheetView.tsx`
- `src/components/Results/RecoveryCardPanel.tsx`
- `src/components/Results/ResultsHub.tsx`
- `src/components/Results/__tests__/KPITimeSeriesDrawer.res02.smoke.test.tsx`
- `src/components/Results/__tests__/KPITimeSeriesDrawer.res11-visibility.test.tsx`
- `src/components/Results/__tests__/KpiSignalSheetView.canonical-cutover.test.tsx`
- `src/components/Results/__tests__/resultsOwnerReviewMode.test.ts`
- `src/components/Results/kpiRuntime.ts`
- `src/components/ResultsVNext/KpiDraftFormModal.tsx`
- `src/components/ResultsVNext/KpiTransitionDialog.tsx`
- `src/components/ResultsVNext/ResultsKpiRegistryPage.tsx`
- `src/components/ResultsVNext/ResultsOkrRegistryPage.tsx`
- `src/components/ResultsVNext/ResultsRoiRegistryPage.tsx`
- `src/components/ResultsVNext/ResultsSearchRegistry.tsx`
- `src/components/ResultsVNext/ResultsVNextForbiddenState.tsx`
- `src/components/ResultsVNext/ResultsVNextRegistryRouteBase.tsx`
- `src/components/ResultsVNext/ResultsVNextRegistryShell.tsx`
- `src/components/ResultsVNext/__tests__/resultsVNextFeatureFlags.test.ts`
- `src/components/ResultsVNext/attention/ResultsAttentionPage.tsx`
- `src/components/ResultsVNext/attention/attentionPresenters.tsx`
- `src/components/ResultsVNext/index.ts`
- `src/components/ResultsVNext/kpiMeasurements/KpiMeasurementCorrectionModal.tsx`
- `src/components/ResultsVNext/kpiMeasurements/KpiMeasurementDataQualityModal.tsx`
- `src/components/ResultsVNext/kpiMeasurements/KpiMeasurementRecordModal.tsx`
- `src/components/ResultsVNext/kpiMeasurements/ResultsKpiMeasurementsPanel.tsx`
- `src/components/ResultsVNext/kpiMeasurements/kpiMeasurementMappers.ts`
- `src/components/ResultsVNext/kpiMeasurements/kpiMeasurementPresenters.tsx`
- `src/components/ResultsVNext/kpiScorecards/CreateKpiScorecardModal.tsx`
- `src/components/ResultsVNext/kpiScorecards/KpiScorecardItemDialogs.tsx`
- `src/components/ResultsVNext/kpiScorecards/KpiScorecardSnapshotDialogs.tsx`
- `src/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage.tsx`
- `src/components/ResultsVNext/kpiScorecards/kpiScorecardApi.ts`
- `src/components/ResultsVNext/kpiScorecards/kpiScorecardMappers.ts`
- `src/components/ResultsVNext/kpiScorecards/kpiScorecardPresenters.tsx`
- `src/components/ResultsVNext/kpiTool/KpiDeviationCaseSubview.tsx`
- `src/components/ResultsVNext/kpiTool/KpiReviewedAttributionDialog.tsx`
- `src/components/ResultsVNext/kpiTool/KpiToolPage.tsx`
- `src/components/ResultsVNext/kpiTool/kpiDeviationApi.ts`
- `src/components/ResultsVNext/kpiTool/kpiInitiativeImpactApi.ts`
- `src/components/ResultsVNext/kpiTool/kpiTeresaRcaDraft.ts`
- `src/components/ResultsVNext/kpiTool/kpiToolMappers.ts`
- `src/components/ResultsVNext/legacy/ResultsVNextLegacyArchivePanel.tsx`
- `src/components/ResultsVNext/legacy/legacyArchiveApi.ts`
- `src/components/ResultsVNext/okr/OkrActionDialog.tsx`
- `src/components/ResultsVNext/okr/OkrAlignmentsView.tsx`
- `src/components/ResultsVNext/okr/OkrCancelDialog.tsx`
- `src/components/ResultsVNext/okr/OkrCarryForwardDialog.tsx`
- `src/components/ResultsVNext/okr/OkrCheckInCorrectDialog.tsx`
- `src/components/ResultsVNext/okr/OkrCheckInRecordDialog.tsx`
- `src/components/ResultsVNext/okr/OkrCheckInsView.tsx`
- `src/components/ResultsVNext/okr/OkrCyclesPage.tsx`
- `src/components/ResultsVNext/okr/OkrHistoryView.tsx`
- `src/components/ResultsVNext/okr/OkrKeyResultFormModal.tsx`
- `src/components/ResultsVNext/okr/OkrKeyResultsView.tsx`
- `src/components/ResultsVNext/okr/OkrObjectiveFormModal.tsx`
- `src/components/ResultsVNext/okr/OkrObjectivesView.tsx`
- `src/components/ResultsVNext/okr/OkrProgramsPage.tsx`
- `src/components/ResultsVNext/okr/OkrReviewReflectionView.tsx`
- `src/components/ResultsVNext/okr/OkrSetOverviewView.tsx`
- `src/components/ResultsVNext/okr/OkrSetToolPage.tsx`
- `src/components/ResultsVNext/okr/OkrSetWorkspace.tsx`
- `src/components/ResultsVNext/okr/OkrSupportView.tsx`
- `src/components/ResultsVNext/okr/ResultsOkrHub.tsx`
- `src/components/ResultsVNext/okr/okrAdminApi.ts`
- `src/components/ResultsVNext/okr/okrCheckInApi.ts`
- `src/components/ResultsVNext/okr/okrCheckInMappers.ts`
- `src/components/ResultsVNext/okr/okrCheckInPresenters.tsx`
- `src/components/ResultsVNext/okr/okrKeyResultPresenters.tsx`
- `src/components/ResultsVNext/okr/okrObjectiveApi.ts`
- `src/components/ResultsVNext/okr/okrObjectiveMappers.ts`
- `src/components/ResultsVNext/okr/okrObjectivePresenters.tsx`
- `src/components/ResultsVNext/okr/okrRegistryMappers.ts`
- `src/components/ResultsVNext/okr/okrRegistryPresenters.tsx`
- `src/components/ResultsVNext/okr/okrTeresaReflectionDraft.ts`
- `src/components/ResultsVNext/okr/okrWorkspaceApi.ts`
- `src/components/ResultsVNext/okr/okrWorkspaceMappers.ts`
- `src/components/ResultsVNext/resultsDomainNavigation.ts`
- `src/components/ResultsVNext/resultsVNextFeatureFlags.ts`
- `src/components/ResultsVNext/resultsVNextOwnerSampleData.ts`
- `src/components/ResultsVNext/roi/ResultsRoiHub.tsx`
- `src/components/ResultsVNext/roi/ResultsRoiPirOutcomesPage.tsx`
- `src/components/ResultsVNext/roi/RoiAssumptionFormModal.tsx`
- `src/components/ResultsVNext/roi/RoiBaselineEditModal.tsx`
- `src/components/ResultsVNext/roi/RoiBenefitLineFormModal.tsx`
- `src/components/ResultsVNext/roi/RoiBuildCaseModals.tsx`
- `src/components/ResultsVNext/roi/RoiCalculationPolicyEditModal.tsx`
- `src/components/ResultsVNext/roi/RoiCaseCreateModal.tsx`
- `src/components/ResultsVNext/roi/RoiCaseDecisionWorkspace.tsx`
- `src/components/ResultsVNext/roi/RoiCaseFullTool.tsx`
- `src/components/ResultsVNext/roi/RoiCaseLearnWorkspace.tsx`
- `src/components/ResultsVNext/roi/RoiCaseModelWorkspace.tsx`
- `src/components/ResultsVNext/roi/RoiCaseRealizeValueWorkspace.tsx`
- `src/components/ResultsVNext/roi/RoiCaseToolPage.tsx`
- `src/components/ResultsVNext/roi/RoiCostLineFormModal.tsx`
- `src/components/ResultsVNext/roi/RoiLearnModals.tsx`
- `src/components/ResultsVNext/roi/RoiPirOutcomesTab.tsx`
- `src/components/ResultsVNext/roi/RoiRealizeValueModals.tsx`
- `src/components/ResultsVNext/roi/RoiRemoveLineItemDialog.tsx`
- `src/components/ResultsVNext/roi/RoiTransitionDialog.tsx`
- `src/components/ResultsVNext/roi/roiCaseDetailApi.ts`
- `src/components/ResultsVNext/roi/roiCaseDetailMappers.ts`
- `src/components/ResultsVNext/roi/roiCaseDetailPresenters.tsx`
- `src/components/ResultsVNext/roi/roiCaseFullToolMappers.ts`
- `src/components/ResultsVNext/roi/roiCaseFullToolPresenters.tsx`
- `src/components/ResultsVNext/roi/roiPirOutcomesPresenters.tsx`
- `src/components/ResultsVNext/roi/roiRegistryPresenters.tsx`
- `src/components/ResultsVNext/roi/roiTeresaLessonsDraft.ts`
- `src/components/ResultsVNext/teresa/TeresaEvidenceBreakdown.tsx`
- `src/components/ResultsVNext/teresa/TeresaProposalPanel.tsx`
- `src/components/ResultsVNext/teresa/teresaHandoffTypes.ts`
- `src/components/ResultsVNext/teresa/teresaProposalApi.ts`
- `src/components/TemplateBuilder/templateBuilderModel.ts`
- `src/components/assessment/AssessmentHub.tsx`
- `src/components/assessment/artifacts/ArtifactLineagePanel.tsx`
- `src/components/assessment/artifacts/__tests__/ArtifactLineagePanel.test.tsx`
- `src/components/assessment/drd/AssessmentSaveStateIndicator.tsx`
- `src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx`
- `src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx`
- `src/components/assessment/drd/DrdSourceIndicator.tsx`
- `src/components/assessment/drd/__tests__/DrdHttpMethodWorkspaceScreen.offlineRecovery.test.tsx`
- `src/components/assessment/drd/__tests__/DrdHttpMethodWorkspaceScreen.reportMatrixCoexist.test.tsx`
- `src/components/assessment/drd/__tests__/DrdHttpMethodWorkspaceScreen.skipCode.test.tsx`
- `src/components/assessment/drd/__tests__/DrdHttpMethodWorkspaceScreen.test.tsx`
- `src/components/assessment/drd/__tests__/DrdMethodWorkspaceScreen.matrix.test.tsx`
- `src/components/assessment/drd/__tests__/DrdMethodWorkspaceScreen.skipAndResolution.test.tsx`
- `src/components/assessment/drd/__tests__/drdMethodWorkspaceGating.test.tsx`
- `src/components/assessment/drd/__tests__/drdWorkspaceViewModel.test.ts`
- `src/components/assessment/drd/drdWorkspaceViewModel.ts`
- `src/components/assessment/library/AssessmentLibraryTab.tsx`
- `src/components/assessment/manage/WorkflowStagesTable.tsx`
- `src/components/assessment/presentation/AssessmentPresentationView.tsx`
- `src/components/assessment/presentation/PresentationDeck.tsx`
- `src/components/assessment/presentation/PresentationSlideShell.tsx`
- `src/components/assessment/presentation/__tests__/AssessmentPresentationView.test.tsx`
- `src/components/assessment/presentation/__tests__/PresentationDeck.test.tsx`
- `src/components/assessment/presentation/__tests__/buildPresentationDeck.test.ts`
- `src/components/assessment/presentation/__tests__/outputAdapter.test.ts`
- `src/components/assessment/presentation/buildPresentationDeck.ts`
- `src/components/assessment/presentation/index.ts`
- `src/components/assessment/presentation/outputAdapter.ts`
- `src/components/assessment/presentation/slides.tsx`
- `src/components/assessment/report/AssessmentReportContractView.tsx`
- `src/components/assessment/report/AssessmentReportDocument.tsx`
- `src/components/assessment/report/AssessmentReportView.tsx`
- `src/components/assessment/report/__tests__/AssessmentReportDocument.test.tsx`
- `src/components/assessment/report/__tests__/AssessmentReportDocxDownload.day50.test.tsx`
- `src/components/assessment/report/__tests__/AssessmentReportView.test.tsx`
- `src/components/assessment/report/index.ts`
- `src/components/method-workspace/AnswerStateControl.tsx`
- `src/components/method-workspace/InterviewFocusPanel.tsx`
- `src/components/method-workspace/LiveMatrix.tsx`
- `src/components/method-workspace/MethodNavigator.tsx`
- `src/components/method-workspace/MethodWorkspaceShell.tsx`
- `src/components/method-workspace/QuestionHelpDisclosure.tsx`
- `src/components/method-workspace/ResolutionCard.tsx`
- `src/components/method-workspace/SaveStateIndicator.tsx`
- `src/components/method-workspace/TeresaPreviewPanel.tsx`
- `src/components/method-workspace/__tests__/AnswerStateControl.test.tsx`
- `src/components/method-workspace/__tests__/InterviewFocusPanel.test.tsx`
- `src/components/method-workspace/__tests__/LiveMatrix.test.tsx`
- `src/components/method-workspace/__tests__/MethodNavigator.ownerBehavior.test.tsx`
- `src/components/method-workspace/__tests__/MethodWorkspaceShell.test.tsx`
- `src/components/method-workspace/__tests__/QuestionHelpDisclosure.test.tsx`
- `src/components/method-workspace/__tests__/SaveStateIndicator.test.tsx`
- `src/components/method-workspace/__tests__/VoiceAnswerChannel.transcript.test.tsx`
- `src/components/method-workspace/__tests__/fixtures.ts`
- `src/components/method-workspace/__tests__/useMethodWorkspaceSave.test.ts`
- `src/components/method-workspace/index.ts`
- `src/components/method-workspace/types.ts`
- `src/components/method-workspace/useMethodWorkspaceSave.ts`
- `src/components/navigation/Sidebar/__tests__/menuConfig.interview.test.ts`
- `src/components/settings/DashboardPreferencesSettings.tsx`
- `src/components/settings/DataControlsSettings.tsx`
- `src/components/settings/DesktopSoundsSettings.tsx`
- `src/components/settings/EmailDigestSettings.tsx`
- `src/components/shared/ArtifactStudio/ArtifactContextCommandSurface.tsx`
- `src/components/shared/ArtifactStudio/__tests__/ArtifactCommandRegistry.test.ts`
- `src/components/shared/ArtifactStudio/commands/types.ts`
- `src/components/shared/CanvasContextMenu.tsx`
- `src/components/shared/CreateFormatModeLauncher.tsx`
- `src/components/shared/ModuleHub/ModuleNavBar.tsx`
- `src/components/shared/ModuleHub/__tests__/focusRingCanon.test.tsx`
- `src/components/shared/NModeLayout/__tests__/NModeHeader.a11y.test.tsx`
- `src/components/shared/NModeLayout/__tests__/NModeHeader.hideSaveState.test.tsx`
- `src/components/shared/NModeSections/__tests__/ActivityLogCanvas.compactList.test.tsx`
- `src/components/shared/WizardModal/WizardModal.tsx`
- `src/components/shared/WizardModal/index.ts`
- `src/components/shared/__tests__/ModuleMenu3.selectionSemantics.test.tsx`
- `src/components/shared/states/index.ts`
- `src/components/standard/ArtifactBreadcrumb.tsx`
- `src/components/standard/StandardModuleBar.tsx`
- `src/components/standard/StandardPreview.tsx`
- `src/components/ui/__tests__/dialog.a11y.test.tsx`
- `src/components/ui/primitives/Modal.tsx`
- `src/config/swot/swotAcceptGate.ts`
- `src/domain/__tests__/toolStatus.test.ts`
- `src/hooks/__tests__/useAssessmentSaveIndicator.test.ts`
- `src/hooks/__tests__/useFinanceBaselineWorkspaceFlag.test.ts`
- `src/hooks/useAssessmentSaveIndicator.ts`
- `src/hooks/useFeatureFlags.tsx`
- `src/hooks/useFinanceAnalysisWorkspaceFlag.ts`
- `src/hooks/useFinanceBaselineWorkspaceFlag.ts`
- `src/hooks/useFinanceFocusMode.ts`
- `src/hooks/useFinancePredictionWorkspaceFlag.ts`
- `src/hooks/useFinanceStatementPackWorkspaceV2Flag.ts`
- `src/hooks/useFinanceValuationWorkspaceFlag.ts`
- `src/hooks/useFinanceWorkspacePlatformFlag.ts`
- `src/hooks/useOrgContextSync.ts`
- `src/method-core-adapters/audits/__tests__/auditsKernelAdapter.test.ts`
- `src/method-core-adapters/audits/auditsKernelAdapter.ts`
- `src/method-core/__tests__/compilerShapeContract.test.ts`
- `src/method-core/__tests__/zz-opus-drd-agg-probe.test.ts`
- `src/method-core/api/methodCoreApi.ts`
- `src/method-core/contracts/events.ts`
- `src/method-core/contracts/index.ts`
- `src/method-core/contracts/methodPack.ts`
- `src/method-core/contracts/session.ts`
- `src/method-core/contracts/teresa.ts`
- `src/method-core/methods/drd/__tests__/drdAdapter.aggregate.test.ts`
- `src/method-core/methods/drd/__tests__/drdAdapter.progression.test.ts`
- `src/method-core/methods/drd/__tests__/drdAdapter.scoring.test.ts`
- `src/method-core/methods/drd/__tests__/drdHttpSessionRuntime.test.ts`
- `src/method-core/methods/drd/__tests__/drdSessionRuntime.test.ts`
- `src/method-core/methods/drd/__tests__/zz-opus-aggregate-norm.test.ts`
- `src/method-core/methods/drd/__tests__/zz-opus-probe.test.ts`
- `src/method-core/methods/drd/compileDrdPack.ts`
- `src/method-core/methods/drd/drdAdapter.ts`
- `src/method-core/methods/drd/drdHttpSessionRuntime.ts`
- `src/method-core/methods/drd/drdSessionRuntime.ts`
- `src/method-core/methods/siri/__tests__/siriHttpSessionRuntime.test.ts`
- `src/method-core/methods/siri/__tests__/siriMethodPack.test.ts`
- `src/method-core/methods/siri/__tests__/siriTierView.test.ts`
- `src/method-core/methods/siri/__tests__/siriWorkspaceView.test.ts`
- `src/method-core/methods/siri/__tests__/zz-opus-probe.test.ts`
- `src/method-core/methods/siri/__tests__/zz-opus-v2-probe.test.ts`
- `src/method-core/methods/siri/compileSiriPack.ts`
- `src/method-core/methods/siri/siriAdapter.ts`
- `src/method-core/methods/siri/siriHttpSessionRuntime.ts`
- `src/method-core/methods/siri/siriTierView.ts`
- `src/method-core/methods/siri/siriWorkspaceView.ts`
- `src/method-core/outputs/__tests__/assessmentOutput.test.ts`
- `src/method-core/outputs/__tests__/initiativeDraft.test.ts`
- `src/method-core/outputs/__tests__/presentation.test.ts`
- `src/method-core/outputs/__tests__/reportSnapshot.test.ts`
- `src/method-core/outputs/__tests__/supersession.test.ts`
- `src/method-core/outputs/__tests__/testFixtures.ts`
- `src/method-core/outputs/assessmentOutput.ts`
- `src/method-core/outputs/index.ts`
- `src/method-core/outputs/initiativeDraft.ts`
- `src/method-core/outputs/presentationSourceBlock.ts`
- `src/method-core/outputs/reportSnapshot.ts`
- `src/method-core/outputs/types.ts`
- `src/routes/AppRoutes.tsx`
- `src/routes/__tests__/adminRedirectTargetsResolve.test.ts`
- `src/routes/__tests__/adminSuperadminRoleGuard.test.ts`
- `src/routes/__tests__/executionCanonicalRoute.test.ts`
- `src/routes/__tests__/interviewAliasRedirect.test.ts`
- `src/routes/__tests__/organizationAdminRedirect.test.ts`
- `src/routes/__tests__/settingsAdminRedirect.test.ts`
- `src/routes/__tests__/superadminRedirectHandoff.test.ts`
- `src/services/__tests__/drdReportModel.calculationVersion.test.ts`
- `src/services/__tests__/drdScoringV2.test.ts`
- `src/services/__tests__/presentationTemplateArchitectApprove.test.ts`
- `src/services/__tests__/siriPrioritisation.v2.test.ts`
- `src/services/__tests__/zz-opus-v2-probe.test.ts`
- `src/services/api/__tests__/financeV2.analysis.api.test.ts`
- `src/services/api/__tests__/financeV2.baseline.api.test.ts`
- `src/services/api/__tests__/financeV2.types.test.ts`
- `src/services/api/__tests__/resultsRecoveryCanonical.api.test.ts`
- `src/services/api/agentMaterialization.api.ts`
- `src/services/api/financeV2.api.ts`
- `src/services/api/ideaBusinessCase.api.ts`
- `src/services/api/ideaFinancialCase.api.ts`
- `src/services/api/organizations.api.ts`
- `src/services/api/presentationApprovals.api.ts`
- `src/services/api/v8/executionBvp.ts`
- `src/services/api/v8/index.ts`
- `src/services/api/v8/results.ts`
- `src/services/api/v8/transformation-cases.ts`
- `src/services/chatActionHandler.ts`
- `src/services/drdStructure.ts`
- `src/services/ideaFinance/__tests__/engine.test.ts`
- `src/services/ideaFinance/engine.ts`
- `src/services/ideaFinance/index.ts`
- `src/services/initiativeLifecycle.ts`
- `src/services/initiativeWriteTruth.ts`
- `src/services/report/drdReportModel.ts`
- `src/store/__tests__/swotStepLocale.test.ts`
- `src/store/__tests__/usePMOContextAutoFetch.test.tsx`
- `src/store/useToolStore.ts`
- `src/test-utils/realTranslations.ts`
- `src/toolOutputs/__tests__/buildSwotOutput.test.ts`
- `src/toolOutputs/__tests__/outputs.test.ts`
- `src/toolOutputs/__tests__/slides.test.ts`
- `src/toolOutputs/buildSwotOutput.ts`
- `src/toolOutputs/outputLifecycle.ts`
- `src/toolOutputs/renderReport.ts`
- `src/toolPacks/__tests__/engineBindingCoverage.test.ts`
- `src/toolPacks/__tests__/questionBankCoverage.test.ts`
- `src/toolPacks/__tests__/readinessManifests.test.ts`
- `src/toolPacks/__tests__/registry.test.ts`
- `src/toolPacks/__tests__/validator.test.ts`
- `src/toolPacks/contract.ts`
- `src/toolPacks/packs/a3ProblemSolving.pack.ts`
- `src/toolPacks/packs/aiDiscovery.pack.ts`
- `src/toolPacks/packs/ambitionDecomposer.pack.ts`
- `src/toolPacks/packs/capabilityMapper.pack.ts`
- `src/toolPacks/packs/dmsBuilder.pack.ts`
- `src/toolPacks/packs/dynamicSwot.pack.ts`
- `src/toolPacks/packs/focusTradeoff.pack.ts`
- `src/toolPacks/packs/growthPaths.pack.ts`
- `src/toolPacks/packs/inventoryAutopilot.pack.ts`
- `src/toolPacks/packs/marketForces.pack.ts`
- `src/toolPacks/packs/narrativeEngine.pack.ts`
- `src/toolPacks/packs/painExplorer.pack.ts`
- `src/toolPacks/packs/portfolioPriority.pack.ts`
- `src/toolPacks/packs/processAutomation.pack.ts`
- `src/toolPacks/packs/riskUncertainty.pack.ts`
- `src/toolPacks/packs/rpaScanner.pack.ts`
- `src/toolPacks/packs/smedPlanner.pack.ts`
- `src/toolPacks/packs/sopBuilder.pack.ts`
- `src/toolPacks/packs/valueChain.pack.ts`
- `src/toolPacks/readiness/manifests.ts`
- `src/toolPacks/registry.ts`
- `src/toolPacks/validator.ts`
- `src/utils/__tests__/auditIso27001LegacyPresetGate.test.ts`
- `src/utils/__tests__/auditsScaleAndPolishFlag.test.ts`
- `src/utils/__tests__/demoAcceptanceFlags.test.ts`
- `src/utils/__tests__/myWorkCalendarV2Flag.test.ts`
- `src/utils/__tests__/orgRedesignFlag.test.ts`
- `src/utils/__tests__/workbookGridPreview.test.ts`
- `src/utils/artifactStudioTelemetry.ts`
- `src/utils/betaAccess.ts`
- `src/utils/enumLabels.ts`
- `src/utils/ideaBusinessCaseSchemaFlag.ts`
- `src/utils/ideaDecisionLogFlag.ts`
- `src/utils/ideaDetailsInPanelFlag.ts`
- `src/utils/ideaFinancialCaseFlag.ts`
- `src/utils/pilotAccess.ts`
- `src/utils/sheetArtifactOpen.ts`
- `src/utils/workbookFormulaEngine.ts`
- `src/utils/workbookGridPreview.ts`
- `src/views/AssessmentSessionEditorView.tsx`
- `src/views/BecomePartnerView.tsx`
- `src/views/ContextBuilder/modules/OrganizationProfileModule.tsx`
- `src/views/OrganizationView.tsx`
- `src/views/PublicInterviewRespondentView.tsx`
- `src/views/admin/OrgAISettingsView.tsx`
- `src/views/admin/__tests__/AdminSettingsModule.test.tsx`
- `src/views/admin/__tests__/adminHistoricalAddressAliases.test.ts`
- `src/views/partner/ProviderHomeView.tsx`
- `src/views/partner/partnerProgramLocale.ts`
- `src/views/partner/sections/EarningsSection.tsx`
- `src/views/superadmin/PlatformOperationsView.tsx`
- `src/views/superadmin/partners/PartnerProgramConfig.tsx`
- `src/views/vault/VaultDocumentsView.tsx`
- `src/views/vault/VaultFoldersTable.tsx`
- `src/views/vault/__tests__/VaultDocumentsView.bulkReceipts.test.tsx`
- `src/views/vault/__tests__/VaultDocumentsView.safeNameLocalization.test.tsx`
- `src/views/vault/__tests__/VaultFoldersTable.contract.test.ts`

### P6 — dokładna lista plików

- `dev-render/drd-workspace-main.tsx`
- `dev-render/mocks/methodCoreFakeServer.ts`
- `dev-render/screens/assessment-artifacts-restart.tsx`
- `dev-render/screens/assessment-output-report.tsx`
- `dev-render/screens/assessment-presentation-view.tsx`
- `dev-render/screens/audyty-drd-report.tsx`
- `dev-render/screens/audyty-piec-powierzchni.tsx`
- `dev-render/screens/audyty-raport-dokument.tsx`
- `dev-render/screens/audyty-warsztat-kryterium.tsx`
- `dev-render/screens/drd-http-workspace.tsx`
- `dev-render/screens/drd-library-entry.tsx`
- `dev-render/screens/finance-focus-mode.tsx`
- `dev-render/screens/finance-model-workspace.tsx`
- `dev-render/screens/finance-workspace-bar.tsx`
- `dev-render/screens/idea-confidentiality-control.tsx`
- `dev-render/screens/idea-table-production.tsx`
- `dev-render/screens/idea-table.tsx`
- `dev-render/screens/interview-preview-canon.tsx`
- `dev-render/screens/method-workspace.tsx`
- `dev-render/screens/mm-ppm-measure.tsx`
- `dev-render/screens/mywork-idea-inspector-lekki.tsx`
- `dev-render/screens/mywork-notebook-rail-speca.tsx`
- `dev-render/screens/org-identity-operating.tsx`
- `dev-render/screens/plan-scenario-d1.tsx`
- `dev-render/screens/results-vnext-attention.tsx`
- `dev-render/screens/results-vnext-kpi-registry.tsx`
- `dev-render/screens/results-vnext-kpi-scorecards.tsx`
- `dev-render/screens/results-vnext-kpi-tool.tsx`
- `dev-render/screens/results-vnext-legacy-archive.tsx`
- `dev-render/screens/results-vnext-okr-admin.tsx`
- `dev-render/screens/results-vnext-okr-objectives.tsx`
- `dev-render/screens/results-vnext-okr-registry.tsx`
- `dev-render/screens/results-vnext-okr-workspace.tsx`
- `dev-render/screens/results-vnext-registry-shell.tsx`
- `dev-render/screens/results-vnext-roi-full-tool.tsx`
- `dev-render/screens/results-vnext-roi-model.tsx`
- `dev-render/screens/results-vnext-roi-pir-outcomes.tsx`
- `dev-render/screens/results-vnext-roi-registry.tsx`
- `dev-render/screens/results-vnext-search-registry.tsx`
- `dev-render/screens/results-vnext-teresa-kpi-deviation.tsx`
- `dev-render/screens/results-vnext-teresa-okr-reflection.tsx`
- `dev-render/screens/rn-g3-class-l-record-shell.tsx`
- `dev-render/screens/siri-tier.tsx`
- `dev-render/screens/siri-workspace.tsx`
- `dev-render/screens/tool-outputs-panel.tsx`
- `dev-render/screens/tools-outputs-insights-tab.tsx`
- `dev-render/screens/tools-sesja-wyjscie.tsx`
- `dev-render/screens/tools-swot-initiative-proposal.tsx`
- `dev-render/screens/tools-swot-library-detail.tsx`
- `dev-render/screens/tools-swot-report.tsx`
- `dev-render/screens/tools-swot-session-workspace.tsx`
- `dev-render/tool-outputs-panel-main.tsx`
- `dev-render/tools-outputs-insights-tab-main.tsx`
- `dev-render/tools-swot-initiative-proposal-main.tsx`
- `dev-render/tools-swot-library-detail-main.tsx`
- `dev-render/tools-swot-session-workspace-main.tsx`
- `docs/validation/finance-v3/generated/gate-d/ap02/ap02_roundtrip.ts`
- `docs/validation/finance-v3/generated/gate-d/ap02/ap02_size_test.ts`
- `docs/validation/finance-v3/generated/gate-d/goldco/goldco_compare.ts`
- `docs/validation/finance-v3/generated/gate-d/goldco/goldco_full_dag.ts`
- `docs/validation/finance-v3/generated/gate-d/goldco/goldco_oracle.ts`
- `docs/validation/finance-v3/generated/gate-d/goldco/goldco_pipeline.ts`
- `docs/validation/finance-v3/generated/gate-d/realcompany/apator_real_pipeline.ts`
- `docs/validation/finance-v3/generated/gate-d/realcompany/crosscompany_scale_survey.ts`
- `playwright.demo-acceptance.config.ts`
- `shared/contracts/federatedActionManifest.ts`
- `vite.config.ts`
- `vitest.orphans.config.ts`

## E. Testy pinujące bugi

1. **`tests/acceptance/red-assess-500s.e2e.test.ts` — 8 wpisów KNOWN_RED.** Asertuje dokładnie status 500 i fragment starego błędu dla ośmiu endpointów assessment. To błąd testu, bo naprawiony endpoint ma nie zwracać 5xx; obecny pomiar pokazuje, że część jest już 200, więc test karze naprawę. Po poprawce: usuwa się mapę oczekiwanych 500, a każdy endpoint asertuje właściwy kontrakt 2xx/4xx i jawnie `status < 500`.

2. **`tests/acceptance/red-final-500s.e2e.test.ts` — KNOWN K1.** Asertuje 500 `Failed to load route` dla `/api/user/ai-preferences`. To pin martwego lazy-wrappera; naprawa importu zapali test. Po poprawce: oczekiwać 200 (lub właściwego auth/validation 4xx), nigdy 500, i sprawdzić realny payload.

3. **`tests/acceptance/t2-sla-flow.e2e.test.ts` — „assignment_kind=artifact”.** Test mówi wprost „Current (undesired but real) behavior” i oczekuje, że ogólny sweep eskaluje artifact review oraz wysyła payload bez `artifactType`/`assignmentKind`. Po poprawce: artifact row ma pozostać nieeskalowany przez proposal sweep albo przejść dedykowaną ścieżką, a payload musi mieć jawny typ.

4. **`tests/unit/backend/harvardCrossModuleFlows.test.ts` — B9 stub.** Oczekuje, że B9 pozostaje na liście `status === 'stub'`. Po implementacji realnego handoffu test stanie się czerwony. Po poprawce: B9 ma być `partial`/`implemented` zgodnie z rzeczywistym runtime i mieć test realnego target table/read-back.

5. **`tests/unit/initiativeDocumentView.section-ai-noop.test.ts`.** Oczekuje, że „genuinely-unimplemented sections” pozostają w `SECTION_AI_NOOP`. To pin braku funkcji; implementacja handlera zapali test. Po poprawce: dana sekcja nie może należeć do NOOP, a test powinien wywołać handler i sprawdzić realną mutację/read-back.

6. **`tests/acceptance/odbior--deccase--initiative-status-case.e2e.test.ts` — dwa testy BEFORE.** Asertują reprodukcję lowercase corruption przez sztuczne `BEFORE_*_CASE`. Nie wykonują aktualnej ścieżki produktu, ale utrwalają wadliwy rezultat jako zieloną asercję. Po poprawce: przenieść reprodukcję do komentarza/fixture historycznego, a executable assertions prowadzić wyłącznie przez aktualny controller i wymagać kanonicznych uppercase statusów.

Nie zaliczam do kategorii 5 zwykłych testów regresyjnych „BEFORE helper vs AFTER”, jeśli wadliwy helper jest lokalną funkcją testową i nie reprezentuje bieżącego produktu. Wyjątek deccase pozostaje na liście, bo jego buggy INSERT jest wykonywany na realnym schemacie i obecnie sam powoduje czerwony suite.

## Gotowe rekomendacje diff (NIEZASTOSOWANE)

Najmniejsza bezpieczna rekomendacja dla pinu RED-ASSESS:

```diff
- expect(r.status, `${r.label} — expected pinned KNOWN RED status`).toBe(known.status);
+ expect(Number(r.status), `${r.label} — endpoint must not return 5xx`).toBeLessThan(500);
```

To tylko kierunek: właściwy dyżur musi zastąpić ogólne `<500` konkretnym kontraktem każdego endpointu, aby nie zamienić jednego słabego testu w drugi.

## TWIERDZENIA NIEZWERYFIKOWANE

- **NOT_PROVEN:** dla każdej kaskady acceptance nie wykonano mutacji/fix-and-rerun, więc przypisanie wszystkich downstream failures do pierwszej przyczyny jest diagnozą, nie dowodem po naprawie.
- **EVIDENCE_MISSING:** live Teresa/O4/AI reporting nie zostały wykonane z prawdziwym kluczem dostawcy; zakaz połączeń zewnętrznych był nadrzędny. Nie wiadomo, które z nich byłyby zielone z kluczem.
- **NOT_PROVEN:** 15 609 lint errors w plikach produkcyjnych oznaczono kategorią produktu według lokalizacji, ale sam problem formatowania nie dowodzi defektu zachowania runtime.
- **PARTIAL:** dokładne źródła produkcyjne dla części assertion-only 409/410/428 wskazano z routerów i stacków, ale bez naprawy nie potwierdzono minimalnego zestawu implementacyjnego.
- **UNKNOWN:** czy 312 nieblokujących skipów poza unit/smoke są akceptowalnym świadomym długiem; bieżący gate ich nie blokuje, lecz raport ich nie uznaje automatycznie za zdrowe.
- **NOT_AUTHORIZED:** nie sprawdzono Railway/demo/staging/produkcji ani GitHub Actions.
- **NOT_PROVEN:** połączenie wszystkich sześciu pakietów naprawczych nie zostało zasymulowane; rozłączność plikowa jest potwierdzona, pełna zieleń integracyjna nie.

## Rekomendacja kolejności

Rekomenduję **6 dyżurów naprawczych** zgodnych z P1–P6. Kolejność integracji: (1) P6 infra i zasoby środowiskowe, (2) P4 backend, (3) P5 frontend, (4) równolegle P1/P2/P3 po związaniu nowych kontraktów, (5) pełny wspólny rerun wszystkich sześciu gate'ów na świeżej bazie. Sam mechaniczny Prettier nie powinien być osobnym siódmym dyżurem, bo dotknąłby plików wszystkich pakietów i złamał warunek rozłączności; każdy pakiet formatuje wyłącznie własną listę.

Najpierw należy usunąć testy pinujące bugi i pułapki fixture/środowiska, potem naprawiać produkt. W przeciwnym razie świeża poprawka produktu będzie maskowana przez stare 500-pins i kaskadowe awarie danych. Po integracji obowiązkowy jest nowy Day59-style pomiar, ponieważ liczby wejściowe 380 i 323 już teraz są nieaktualne.

