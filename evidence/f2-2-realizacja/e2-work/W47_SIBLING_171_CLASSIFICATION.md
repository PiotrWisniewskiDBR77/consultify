# S4 Wpis 47 — full importer sibling classification (171 files)

**Result: PASS — 0 candidate-new or candidate-worse red files against base `eba9d72ad9c730728b212ee7826164519e4d095c`.**

- Candidate FE (121 files): 517 passed tests, 49 failed tests, 5 skipped tests; 28 nonzero files. All 28 are inherited. The count is the 27-file v2 debt plus the already documented order-dependent `InitiativeConsultingAnalysisView.behavior.test.tsx` (1/12 on both candidate and base in this exact per-file run).
- Candidate DB family (50 files): 58 passed tests, 31 failed tests, 58 skipped tests; 9 nonzero files. All 9 are inherited or improved relative to the exact base run; none is candidate-new.
- Every `*.pg.test.ts` ran with `MOCK_DB=false`, `RUN_DB_TESTS=1`, and the local PG18 URL. Candidate PG: `executionWorkAnalysis.gateway.pg` 3/3, `portfolioConsultingAnalysisRuntime.gateway.pg` 3/3, `execution-bank-native-baseline.gateway.pg` 5/5; total 11/11 collected PASS, 0 skipped. The delta-only `initiativesExecutionRuntime.dropdown.pg` was also run the same way: 2/2 PASS, 0 skipped.
- Classification totals: {'UNCHANGED_GREEN_OR_SKIP': 124, 'EXPANDED_GREEN': 4, 'INHERITED_NONZERO_IDENTICAL': 36, 'ADDITIVE_GREEN': 4, 'CANDIDATE_FIXES_BASE_RED': 2, 'INHERITED_NONZERO_IMPROVED': 1}. Candidate-new/worse red: 0.
- Each file below was run independently as `npx vitest run <file> --retry=0`; RealPG/PG files used `MOCK_DB=false`.

| File | Classification | Candidate | Base eba |
|---|---|---|---|
| `server/src/cron/__tests__/adminIamAlertEvaluatorScheduler.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  4 passed (4) | Tests  4 passed (4) |
| `server/src/cron/__tests__/auditIndependenceDetectorSchedulerFlag.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  5 skipped (5) | Tests  5 skipped (5) |
| `server/src/cron/__tests__/workSignalProducerScheduler.test.ts` | EXPANDED_GREEN | Tests  3 passed (3) | Tests  2 passed (2) |
| `server/src/domain/initiatives-execution/__tests__/initiativeWorkReportReader.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 passed (1) | Tests  1 passed (1) |
| `server/src/domain/initiatives-execution/__tests__/initiativeWorkloadReportAdapter.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 passed (1) | Tests  1 passed (1) |
| `server/src/domain/initiatives-execution/__tests__/projectLineageCycle.dbr77.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  3 passed (3) | Tests  3 passed (3) |
| `server/src/routes/__tests__/executionReports.export.test.ts` | INHERITED_NONZERO_IDENTICAL | Tests  1 failed \| 4 passed (5) | Tests  1 failed \| 4 passed (5) |
| `server/src/routes/pmo/__tests__/day17ControlKpis.routes.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  3 passed (3) | Tests  3 passed (3) |
| `server/src/routes/pmo/__tests__/day17ReportReconstruction.routes.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  4 passed (4) | Tests  4 passed (4) |
| `server/src/routes/pmo/__tests__/executionReportE4.serverFlag.routes.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  2 passed (2) | Tests  2 passed (2) |
| `server/src/routes/pmo/__tests__/initiativeForecastCanonical.routes.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  9 passed (9) | Tests  9 passed (9) |
| `server/src/routes/pmo/__tests__/portfolioConsultingAnalysisRuntime.routes.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  6 passed (6) | Tests  6 passed (6) |
| `server/src/routes/pmo/__tests__/portfolioDispositionRegistryRuntime.routes.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  5 passed (5) | Tests  5 passed (5) |
| `server/src/routes/pmo/__tests__/reportDefinitions.adminGate.routes.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  8 passed (8) | Tests  8 passed (8) |
| `server/src/routes/pmo/__tests__/reportRun.workReportFlag.routes.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  4 passed (4) | Tests  4 passed (4) |
| `server/src/routes/pmo/__tests__/workReport.serverFlag.routes.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  2 passed (2) | Tests  2 passed (2) |
| `server/src/services/__tests__/scheduledInitiativeWorkReport.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  4 passed (4) | Tests  4 passed (4) |
| `src/components/Execution/__tests__/ExecutionBankViews.columnWidths.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  9 passed (9) | Tests  9 passed (9) |
| `src/components/Execution/__tests__/ExecutionBankViews.falaB.behavior.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  6 passed (6) | Tests  6 passed (6) |
| `src/components/Execution/__tests__/ExecutionControlSurface.columnWidths.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  1 passed (1) | Tests  1 passed (1) |
| `src/components/Execution/__tests__/ExecutionControlSurface.daneRealne.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  11 passed (11) | Tests  11 passed (11) |
| `src/components/Execution/__tests__/ExecutionControlSurface.raidSygnaly.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  26 passed (26) | Tests  26 passed (26) |
| `src/components/Execution/__tests__/ExecutionControlSurface.rozstrzyganie.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  11 passed (11) | Tests  11 passed (11) |
| `src/components/Execution/__tests__/ExecutionHub.bankPreviewCanon.test.tsx` | EXPANDED_GREEN | Tests  9 passed (9) | Tests  8 passed (8) |
| `src/components/Execution/__tests__/ExecutionReportE4Surface.canon.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  4 passed (4) | Tests  4 passed (4) |
| `src/components/Execution/__tests__/ExecutionReportsSurface.addReportMenu.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  5 passed (5) | Tests  5 passed (5) |
| `src/components/Execution/__tests__/ExecutionReportsSurface.emptyState.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  3 passed (3) | Tests  3 passed (3) |
| `src/components/Execution/__tests__/ExecutionReportsSurface.emptyTiles.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  3 passed (3) | Tests  3 passed (3) |
| `src/components/Execution/__tests__/ExecutionResources.chipyLiczaOsoby.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  5 passed (5) | Tests  5 passed (5) |
| `src/components/Execution/__tests__/ExecutionResources.podgladZaleglosci.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  2 passed (2) | Tests  2 passed (2) |
| `src/components/Execution/__tests__/ExecutionResources.wiszacaRealizacja.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  6 passed (6) | Tests  6 passed (6) |
| `src/components/Execution/__tests__/ExecutionResources.zaleglosc.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  5 passed (5) | Tests  5 passed (5) |
| `src/components/Execution/__tests__/ExecutionSurfaces.hangingCase.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  9 passed (9) | Tests  9 passed (9) |
| `src/components/Execution/__tests__/ExecutionWorkSurface.columnWidths.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  4 passed (4) | Tests  4 passed (4) |
| `src/components/Execution/__tests__/ExecutionWorkSurface.daneRealne.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  8 passed (8) | Tests  8 passed (8) |
| `src/components/Execution/__tests__/ExecutionWorkSurface.edycjaWierszem.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  6 failed \| 8 passed (14) | Tests  6 failed \| 8 passed (14) |
| `src/components/Execution/__tests__/ExecutionWorkSurface.otworzZadanie.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  1 passed (1) | Tests  1 passed (1) |
| `src/components/Execution/__tests__/ExecutionWorkSurface.ownerNames.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  1 failed \| 1 passed (2) | Tests  1 failed \| 1 passed (2) |
| `src/components/Execution/__tests__/executionBankHandoff.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  9 passed (9) | Tests  9 passed (9) |
| `src/components/Execution/__tests__/executionBankModel.test.ts` | EXPANDED_GREEN | Tests  9 passed (9) | Tests  7 passed (7) |
| `src/components/Execution/__tests__/executionCaseNPlusOne.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  5 passed (5) | Tests  5 passed (5) |
| `src/components/Execution/__tests__/executionWorkAnalysisFlag.test.ts` | ADDITIVE_GREEN | Tests  2 passed (2) | Tests summary missing |
| `src/components/Execution/reports-intelligence/__tests__/ControlLoopReport.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  6 passed (6) | Tests  6 passed (6) |
| `src/components/Execution/reports-intelligence/__tests__/ResourcesCapacityReport.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  4 passed (4) | Tests  4 passed (4) |
| `src/components/Execution/reports-intelligence/__tests__/UnifiedExecutionReportGenerator.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  6 passed (6) | Tests  6 passed (6) |
| `src/components/Execution/reports-intelligence/__tests__/WorkIntelligenceReport.canon.test.tsx` | ADDITIVE_GREEN | Tests  5 passed (5) | Tests summary missing |
| `src/components/Execution/reports-intelligence/__tests__/WorkIntelligenceReport.test.tsx` | EXPANDED_GREEN | Tests  9 passed (9) | Tests  7 passed (7) |
| `src/components/Execution/reports-intelligence/__tests__/reportsFlagOff.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  4 passed (4) | Tests  4 passed (4) |
| `src/components/Execution/reports-intelligence/__tests__/workAnalysisModel.test.ts` | ADDITIVE_GREEN | Tests  4 passed (4) | Tests summary missing |
| `src/components/Initiatives/__tests__/InitiativeConsultingAnalysisView.behavior.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  1 failed \| 11 passed (12) | Tests  1 failed \| 11 passed (12) |
| `src/components/Initiatives/__tests__/InitiativeConsultingAnalysisView.proposedDisposition.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  2 passed (2) | Tests  2 passed (2) |
| `src/components/Initiatives/__tests__/InitiativeParkingView.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  4 passed (4) | Tests  4 passed (4) |
| `src/components/Initiatives/__tests__/InitiativeWorkReportView.kanon.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  5 passed (5) | Tests  5 passed (5) |
| `src/components/Initiatives/__tests__/InitiativeWorkloadSurface.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  7 passed (7) | Tests  7 passed (7) |
| `src/components/Initiatives/__tests__/InitiativesHub.deepLinkRuntimeV1.source.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  3 passed (3) | Tests  3 passed (3) |
| `src/components/Initiatives/__tests__/InitiativesHub.fourButtonsE1.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  7 passed (7) | Tests  7 passed (7) |
| `src/components/Initiatives/__tests__/InitiativesHub.journeyNavigation.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  2 passed (2) | Tests  2 passed (2) |
| `src/components/Initiatives/__tests__/InitiativesHub.licznikiSpojne.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  2 passed (2) | Tests  2 passed (2) |
| `src/components/Initiatives/__tests__/InitiativesHub.menu3Chips.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  2 failed \| 1 passed (3) | Tests  2 failed \| 1 passed (3) |
| `src/components/Initiatives/__tests__/InitiativesHub.newModalA11y.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  3 passed (3) | Tests  3 passed (3) |
| `src/components/Initiatives/__tests__/InitiativesHub.pustaLista.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  2 passed (2) | Tests  2 passed (2) |
| `src/components/Initiatives/__tests__/InitiativesHub.smoke.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  15 passed (15) | Tests  15 passed (15) |
| `src/components/Initiatives/__tests__/InitiativesHub.workReportFlag.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  4 passed (4) | Tests  4 passed (4) |
| `src/components/Initiatives/__tests__/PlanScenarioSurface.listaPlanow.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  2 failed (2) | Tests  2 failed (2) |
| `src/components/Initiatives/__tests__/PlanScenarioSurface.regulaBledu.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  1 passed (1) | Tests  1 passed (1) |
| `src/components/Initiatives/__tests__/initiativeDocumentSource.saveRuntimeOnlyMetadata.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  7 passed (7) | Tests  7 passed (7) |
| `src/components/Initiatives/__tests__/initiativeKartaRealnyRekord.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  6 passed (6) | Tests  6 passed (6) |
| `src/components/Initiatives/__tests__/initiativeRegisterProjection.legacyMerge.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  5 passed (5) | Tests  5 passed (5) |
| `src/components/Initiatives/__tests__/initiativeRegisterProjection.ownerName.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  6 passed (6) | Tests  6 passed (6) |
| `src/components/Initiatives/__tests__/initiativeRegisterProjection.statusReconciliation.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  6 passed (6) | Tests  6 passed (6) |
| `src/components/Initiatives/__tests__/nativeForecastCardReachability.behavior.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  5 passed (5) | Tests  5 passed (5) |
| `src/components/Initiatives/sections/__tests__/OperationalForecastEditor.adversarial.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  7 passed (7) | Tests  7 passed (7) |
| `src/components/Initiatives/sections/__tests__/OperationalForecastEditor.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  9 passed (9) | Tests  9 passed (9) |
| `src/services/__tests__/initiativeWriteTruth.odmowaPoPolsku.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  7 passed (7) | Tests  7 passed (7) |
| `tests/components/Execution/ExecutionBankViews.behavior.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  3 passed (3) | Tests  3 passed (3) |
| `tests/components/Execution/ExecutionBankViews.k5Naprawy.behavior.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  7 passed (7) | Tests  7 passed (7) |
| `tests/components/Execution/ExecutionBankViews.valueCleared.behavior.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  1 passed (1) | Tests  1 passed (1) |
| `tests/components/Execution/ExecutionHub.e1aNavigation.behavior.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  6 passed (6) | Tests  6 passed (6) |
| `tests/components/Execution/ExecutionHub.e1bBankViews.behavior.test.tsx` | CANDIDATE_FIXES_BASE_RED | Tests  5 passed (5) | Tests  3 failed \| 1 passed (4) |
| `tests/components/Execution/ExecutionHub.e1bReviewerGaps.behavior.test.tsx` | CANDIDATE_FIXES_BASE_RED | Tests  6 passed (6) | Tests  1 failed \| 4 passed (5) |
| `tests/components/Execution/ExecutionHub.k5Naprawy.behavior.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  1 failed \| 5 passed (6) | Tests  1 failed \| 5 passed (6) |
| `tests/components/Execution/ExecutionHub.managerAvailability.behavior.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  4 passed (4) | Tests  4 passed (4) |
| `tests/components/Execution/ExecutionHub.managerScope.root-review.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  1 passed (1) | Tests  1 passed (1) |
| `tests/components/Initiatives/InitiativeDocumentView.autosave.behavior.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  10 passed (10) | Tests  10 passed (10) |
| `tests/components/Initiatives/InitiativeDocumentView.canonicalNavigation.behavior.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  6 passed (6) | Tests  6 passed (6) |
| `tests/components/Initiatives/InitiativesHub.load-error-state.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  no tests | Tests  no tests |
| `tests/unit/backend/cron/schedulerBackupLifecycle.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  5 passed (5) | Tests  5 passed (5) |
| `tests/unit/initiatives-execution/aiAnalysisProposalReviewQueue.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  1 failed (1) | Tests  1 failed (1) |
| `tests/unit/initiatives-execution/analysisDecisionQueue.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  1 failed (1) | Tests  1 failed (1) |
| `tests/unit/initiatives-execution/analysisReadiness.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  2 passed (2) | Tests  2 passed (2) |
| `tests/unit/initiatives-execution/canonicalWorkHardeningPanel.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  2 passed (2) | Tests  2 passed (2) |
| `tests/unit/initiatives-execution/capacityScenarioSurface.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  no tests | Tests  no tests |
| `tests/unit/initiatives-execution/closureDecisionQueue.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  2 failed (2) | Tests  2 failed (2) |
| `tests/unit/initiatives-execution/definitionDecisionQueue.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  1 passed (1) | Tests  1 passed (1) |
| `tests/unit/initiatives-execution/definitionReadiness.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  4 passed (4) | Tests  4 passed (4) |
| `tests/unit/initiatives-execution/definitionRemediationQueue.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  no tests | Tests  no tests |
| `tests/unit/initiatives-execution/deliveryResultsAcceptanceQueue.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  2 failed (2) | Tests  2 failed (2) |
| `tests/unit/initiatives-execution/effectivenessClosureQueue.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  3 failed (3) | Tests  3 failed (3) |
| `tests/unit/initiatives-execution/executionBankAcceptedBaselineProjection.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  11 passed (11) | Tests  11 passed (11) |
| `tests/unit/initiatives-execution/executionCanonicalWorkQueue.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  1 passed (1) | Tests  1 passed (1) |
| `tests/unit/initiatives-execution/executionCasesBulk.routes.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  7 passed (7) | Tests  7 passed (7) |
| `tests/unit/initiatives-execution/executionCasesInitiativeTitle.test.ts` | INHERITED_NONZERO_IDENTICAL | Tests  1 failed (1) | Tests  1 failed (1) |
| `tests/unit/initiatives-execution/executionControlSurface.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  5 failed (5) | Tests  5 failed (5) |
| `tests/unit/initiatives-execution/executionReportsSurface.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  5 failed \| 3 passed (8) | Tests  5 failed \| 3 passed (8) |
| `tests/unit/initiatives-execution/executionWorkResources.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  6 failed (6) | Tests  6 failed (6) |
| `tests/unit/initiatives-execution/gateSignoffQueue.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  2 failed (2) | Tests  2 failed (2) |
| `tests/unit/initiatives-execution/handoffExecutionSurfaces.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  1 failed (1) | Tests  1 failed (1) |
| `tests/unit/initiatives-execution/listRegisteredInitiativesPagination.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  4 passed (4) | Tests  4 passed (4) |
| `tests/unit/initiatives-execution/materialChangeQueue.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  1 failed (1) | Tests  1 failed (1) |
| `tests/unit/initiatives-execution/planGeneratorPrzewod.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  1 failed \| 1 passed (2) | Tests  1 failed \| 1 passed (2) |
| `tests/unit/initiatives-execution/planPublishConfirmationWire.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  2 passed (2) | Tests  2 passed (2) |
| `tests/unit/initiatives-execution/planScenarioSurface.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  no tests | Tests  no tests |
| `tests/unit/initiatives-execution/planTrybMocyBezDegradacji.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  5 passed (5) | Tests  5 passed (5) |
| `tests/unit/initiatives-execution/planWariantIObciazenie.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  no tests | Tests  no tests |
| `tests/unit/initiatives-execution/planWarsztatKarty.test.tsx` | UNCHANGED_GREEN_OR_SKIP | Tests  10 passed (10) | Tests  10 passed (10) |
| `tests/unit/initiatives-execution/portfolioDecisionQueue.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  2 failed (2) | Tests  2 failed (2) |
| `tests/unit/initiatives-execution/postgresInitiativeReaderListRegister.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  6 passed (6) | Tests  6 passed (6) |
| `tests/unit/initiatives-execution/readSourceProposal.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  2 passed (2) | Tests  2 passed (2) |
| `tests/unit/initiatives-execution/scheduleDecisionQueue.test.tsx` | INHERITED_NONZERO_IDENTICAL | Tests  1 failed (1) | Tests  1 failed (1) |
| `tests/unit/initiatives/initiativeListAuthorization.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  4 passed (4) | Tests  4 passed (4) |
| `tests/unit/services/initiativeWriteTruth.test.ts` | INHERITED_NONZERO_IDENTICAL | Tests  1 failed \| 3 passed (4) | Tests  1 failed \| 3 passed (4) |
| `server/src/domain/initiatives-execution/__tests__/capacityCompute.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 passed (1) | Tests  1 passed (1) |
| `server/src/domain/initiatives-execution/__tests__/initiativeOwnerEligibility.swiezyProjekt.realdb.test.ts` | INHERITED_NONZERO_IDENTICAL | Tests  5 skipped (5) | Tests  5 skipped (5) |
| `server/src/routes/__tests__/executionWorkAnalysis.gateway.pg.test.ts` | ADDITIVE_GREEN | Tests  3 passed (3) | Tests summary missing |
| `server/src/routes/pmo/__tests__/portfolioConsultingAnalysisRuntime.gateway.pg.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  3 passed (3) | Tests  3 passed (3) |
| `tests/acceptance/ini-ui-canonical-mounted.realpg.test.ts` | INHERITED_NONZERO_IDENTICAL | Tests summary missing | Tests summary missing |
| `tests/integration/api.test.ts` | INHERITED_NONZERO_IDENTICAL | Tests  no tests | Tests  no tests |
| `tests/integration/crossflow/cf-00-full-transformation-lineage.realdb.test.ts` | INHERITED_NONZERO_IMPROVED | Tests  4 passed \| 1 skipped (5) | Tests  5 skipped (5) |
| `tests/integration/crossflow/flow-accepted-classic-runtime-adoption.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  3 skipped (3) | Tests  3 skipped (3) |
| `tests/integration/execution-bank-native-baseline.gateway.pg.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  5 passed (5) | Tests  5 passed (5) |
| `tests/integration/execution-change-progress-spine.golden-flow.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  12 passed (12) | Tests  12 passed (12) |
| `tests/integration/initiatives-execution/adoptChatDraftInitiative.gateway.realdb.test.ts` | INHERITED_NONZERO_IDENTICAL | Tests  6 failed \| 1 passed (7) | Tests  6 failed \| 1 passed (7) |
| `tests/integration/initiatives-execution/adoptChatDraftInitiative.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  5 passed (5) | Tests  5 passed (5) |
| `tests/integration/initiatives-execution/aiEvidenceGovernance.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 skipped (1) | Tests  1 skipped (1) |
| `tests/integration/initiatives-execution/authorizationBoundary.http.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  5 skipped (5) | Tests  5 skipped (5) |
| `tests/integration/initiatives-execution/capacityOptions.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 skipped (1) | Tests  1 skipped (1) |
| `tests/integration/initiatives-execution/capacityScenario.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 skipped (1) | Tests  1 skipped (1) |
| `tests/integration/initiatives-execution/deliveryAcceptance.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  2 skipped (2) | Tests  2 skipped (2) |
| `tests/integration/initiatives-execution/effectivenessClosure.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  2 skipped (2) | Tests  2 skipped (2) |
| `tests/integration/initiatives-execution/executionCasesQueryCount.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  3 passed (3) | Tests  3 passed (3) |
| `tests/integration/initiatives-execution/executionMilestone.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 skipped (1) | Tests  1 skipped (1) |
| `tests/integration/initiatives-execution/executionReportE4.gateway.smtp.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  5 skipped (5) | Tests  5 skipped (5) |
| `tests/integration/initiatives-execution/executionWork.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 skipped (1) | Tests  1 skipped (1) |
| `tests/integration/initiatives-execution/executionWorkHardening.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 skipped (1) | Tests  1 skipped (1) |
| `tests/integration/initiatives-execution/gateSignoff.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 skipped (1) | Tests  1 skipped (1) |
| `tests/integration/initiatives-execution/gateSignoffProjection.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  2 skipped (2) | Tests  2 skipped (2) |
| `tests/integration/initiatives-execution/goldenThread.http.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 skipped (1) | Tests  1 skipped (1) |
| `tests/integration/initiatives-execution/handoffAcceptance.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  2 skipped (2) | Tests  2 skipped (2) |
| `tests/integration/initiatives-execution/initiativeCardsClosure.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  3 skipped (3) | Tests  3 skipped (3) |
| `tests/integration/initiatives-execution/initiativeListDefaultWiringQueries.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  2 passed (2) | Tests  2 passed (2) |
| `tests/integration/initiatives-execution/initiativeListPagination.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  4 passed (4) | Tests  4 passed (4) |
| `tests/integration/initiatives-execution/initiativeWorkReport.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 skipped (1) | Tests  1 skipped (1) |
| `tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts` | INHERITED_NONZERO_IDENTICAL | Tests  15 failed (15) | Tests  15 failed (15) |
| `tests/integration/initiatives-execution/managementIntervention.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  2 skipped (2) | Tests  2 skipped (2) |
| `tests/integration/initiatives-execution/materialChange.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 skipped (1) | Tests  1 skipped (1) |
| `tests/integration/initiatives-execution/nordwerkThreeInitiative.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 skipped (1) | Tests  1 skipped (1) |
| `tests/integration/initiatives-execution/operationalAllocation.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  2 skipped (2) | Tests  2 skipped (2) |
| `tests/integration/initiatives-execution/planDependencies.http.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  6 passed (6) | Tests  6 passed (6) |
| `tests/integration/initiatives-execution/planResequenceIntervention.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  2 skipped (2) | Tests  2 skipped (2) |
| `tests/integration/initiatives-execution/planScenario.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  2 skipped (2) | Tests  2 skipped (2) |
| `tests/integration/initiatives-execution/planScenarioRegulaBledu.http.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  2 skipped (2) | Tests  2 skipped (2) |
| `tests/integration/initiatives-execution/planSolver50x4.realdb.test.ts` | INHERITED_NONZERO_IDENTICAL | Tests  2 failed \| 3 passed (5) | Tests  2 failed \| 3 passed (5) |
| `tests/integration/initiatives-execution/planningBridge.http.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  5 passed (5) | Tests  5 passed (5) |
| `tests/integration/initiatives-execution/portfolioDecisionColdReadback.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 passed (1) | Tests  1 passed (1) |
| `tests/integration/initiatives-execution/registerInitiative.realdb.test.ts` | INHERITED_NONZERO_IDENTICAL | Tests  5 failed (5) | Tests  5 failed (5) |
| `tests/integration/initiatives-execution/reportDefinition.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 skipped (1) | Tests  1 skipped (1) |
| `tests/integration/initiatives-execution/reportRun.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  2 skipped (2) | Tests  2 skipped (2) |
| `tests/integration/initiatives-execution/resultsMeasurement.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  2 skipped (2) | Tests  2 skipped (2) |
| `tests/integration/initiatives-execution/scheduleDecision.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 skipped (1) | Tests  1 skipped (1) |
| `tests/integration/initiatives-execution/scheduledInitiativeWorkReport.fullstack.realdb.test.ts` | UNCHANGED_GREEN_OR_SKIP | Tests  1 skipped (1) | Tests  1 skipped (1) |
| `tests/integration/initiatives-execution/submitSourceProposal.realdb.test.ts` | INHERITED_NONZERO_IDENTICAL | Tests  3 failed (3) | Tests  3 failed (3) |
