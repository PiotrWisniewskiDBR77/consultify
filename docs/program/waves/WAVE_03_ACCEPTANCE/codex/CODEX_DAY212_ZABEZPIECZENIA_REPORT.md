# CODEX DAY 212 — zabezpieczenia bez testu omijającego

Stan: **PARTIAL / rdzeń A.1, A.2, A.5 i R.2 wykonany; A.3/A.4 częściowe**  
Marker: `fe33ce80360ac0b6751a5f605d6c758853a4dfa3`  
Gałąź: `codex/day212-zabezpieczenia-20260831`

## Stan wejściowy i korekty wobec instrukcji

```text
MARKER OK
fe33ce80360ac0b6751a5f605d6c758853a4dfa3
```

Tip `github-backup/codex/m03-admin-20260824` uciekł do przodu o 12 commitów, w tym późniejsze scalenie 207. Zgodnie z DEC-2026-08-26-95 praca pozostała dokładnie na markerze; lista commitów i plików została zmierzona przed startem. Instrukcja podaje w jednym miejscu T1=6791, a w innym 6792; własny pomiar daje **6792**.

Porty `6152`, `5094`, `5095` były wolne. Kontener: `cx-day212-pg`, baza `cx212`. Pierwsza migracja zakończyła pełny łańcuch, replay: `Applying migrations: 0`.

## A.1 — inwentarz czterech rodzin

### (a) Zasięg i wielodostępność

Komenda: `grep -rEno "(function|async function|private async|public async|private|async)..." server/src --include="*.ts" | grep -v __tests__ | sort -u`. Wynik enumerowalny: **34**. Surowy census `organization_id = $N/?`: **6792**. Nie enumeruję 6792 fragmentów SQL jako osobnych zabezpieczeń, ponieważ wiele to powtórzone predykaty w zapytaniach, a jednostką oceny mutacyjnej jest nazwana, wielokrotnego użytku bramka.

| plik:linia | bramka | co chroni | test omijający |
|---|---|---|---|
| `server/src/controllers/DecisionController.ts:650` | `assertRelatedObjectsBelongToOrg` | Graniczy zasób obsługiwany przez `server/src/controllers/DecisionController.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/routes/ai/agent-plan.routes.ts:206` | `assertPlanInOrg` | Graniczy zasób obsługiwany przez `server/src/routes/ai/agent-plan.routes.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/routes/ideaBusinessCase.routes.ts:89` | `assertIdeaInOrg` | Graniczy zasób obsługiwany przez `server/src/routes/ideaBusinessCase.routes.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/routes/ideaFinancialCase.routes.ts:104` | `assertIdeaInOrg` | Graniczy zasób obsługiwany przez `server/src/routes/ideaFinancialCase.routes.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/routes/raid.routes.ts:36` | `assertRaidItemInOrganization` | Graniczy zasób obsługiwany przez `server/src/routes/raid.routes.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZWERYFIKOWANE — istniejący test 4/4 SKIP przez nazwę DB |
| `server/src/routes/v8/finance-intelligence.routes.ts:95` | `assertAnalysisOwnedByOrg` | Graniczy zasób obsługiwany przez `server/src/routes/v8/finance-intelligence.routes.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/InterviewInsightService.ts:1057` | `buildInsightScopeSessionWhereClause` | Graniczy zasób obsługiwany przez `server/src/services/InterviewInsightService.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/InterviewInsightService.ts:984` | `buildDefaultAnalysisScope` | Graniczy zasób obsługiwany przez `server/src/services/InterviewInsightService.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/ai/embeddingService.ts:341` | `buildKnowledgeDocAccessFilter` | Graniczy zasób obsługiwany przez `server/src/services/ai/embeddingService.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | TAK — A.2 mutacja RED/GREEN |
| `server/src/services/canvasMaterialize.ts:116` | `assertOrgScopedReferences` | Graniczy zasób obsługiwany przez `server/src/services/canvasMaterialize.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/demo/financeDemoCoherencePolicy.ts:1061` | `assertNoCrossOrgDependencies` | Graniczy zasób obsługiwany przez `server/src/services/demo/financeDemoCoherencePolicy.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/demo/financeDemoCoherencePolicy.ts:349` | `assertDemoOrganizationMarker` | Graniczy zasób obsługiwany przez `server/src/services/demo/financeDemoCoherencePolicy.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/demo/financeDemoCoherencePolicy.ts:879` | `assertQuarantineOrganizationReusable` | Graniczy zasób obsługiwany przez `server/src/services/demo/financeDemoCoherencePolicy.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/initiative/initiativeCapabilityMatrix.ts:473` | `assertUsersInOrganization` | Graniczy zasób obsługiwany przez `server/src/services/initiative/initiativeCapabilityMatrix.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/initiative/initiativeClosureService.ts:234` | `assertInitiativeInOrg` | Graniczy zasób obsługiwany przez `server/src/services/initiative/initiativeClosureService.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/initiative/initiativeKpiAssignmentService.ts:250` | `assertInitiativeBelongsToOrg` | Graniczy zasób obsługiwany przez `server/src/services/initiative/initiativeKpiAssignmentService.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/initiative/initiativeKpiAssignmentService.ts:260` | `assertKpiBelongsToOrg` | Graniczy zasób obsługiwany przez `server/src/services/initiative/initiativeKpiAssignmentService.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/interviewEnterpriseService.ts:167` | `assertSessionInOrg` | Graniczy zasób obsługiwany przez `server/src/services/interviewEnterpriseService.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/interviewManagerScope.ts:70` | `buildAssignmentManagerScopeClause` | Graniczy zasób obsługiwany przez `server/src/services/interviewManagerScope.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/interviewManagerScope.ts:90` | `buildSessionManagerScopeClause` | Graniczy zasób obsługiwany przez `server/src/services/interviewManagerScope.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/managementReportsService.ts:1184` | `assertCommentInReportAndOrganization` | Graniczy zasób obsługiwany przez `server/src/services/managementReportsService.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/managementReportsService.ts:138` | `assertReportInOrganization` | Graniczy zasób obsługiwany przez `server/src/services/managementReportsService.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/managementReportsService.ts:156` | `assertProjectInOrganization` | Graniczy zasób obsługiwany przez `server/src/services/managementReportsService.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/organizationIdentityService.ts:109` | `assertOrganizationNameAvailable` | Graniczy zasób obsługiwany przez `server/src/services/organizationIdentityService.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/resultsVnext/kpi/kpiPerspectivesRepository.ts:352` | `buildScopedKpisBase` | Graniczy zasób obsługiwany przez `server/src/services/resultsVnext/kpi/kpiPerspectivesRepository.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/resultsVnext/kpi/kpiRecoveryChildCommands.ts:171` | `assertActiveOrganizationMember` | Graniczy zasób obsługiwany przez `server/src/services/resultsVnext/kpi/kpiRecoveryChildCommands.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/resultsVnext/okr/okrAttentionRepository.ts:70` | `buildScopedOkrSetsBase` | Graniczy zasób obsługiwany przez `server/src/services/resultsVnext/okr/okrAttentionRepository.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/resultsVnext/okr/okrPerspectivesRepository.ts:127` | `buildScopedOkrSetsBase` | Graniczy zasób obsługiwany przez `server/src/services/resultsVnext/okr/okrPerspectivesRepository.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/resultsVnext/platform/visibilityScopedQuery.ts:160` | `buildVisibilityScopedCte` | Graniczy zasób obsługiwany przez `server/src/services/resultsVnext/platform/visibilityScopedQuery.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/resultsVnext/roi/roiFinanceReconciliationCommands.ts:132` | `assertActiveFinanceOwnerRole` | Graniczy zasób obsługiwany przez `server/src/services/resultsVnext/roi/roiFinanceReconciliationCommands.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/resultsVnext/roi/roiOrgPerspectiveRepository.ts:100` | `buildScopedRoiCasesBase` | Graniczy zasób obsługiwany przez `server/src/services/resultsVnext/roi/roiOrgPerspectiveRepository.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/tablePlatform/TableAiEditorLevels/handlerHelpers.ts:29` | `assertTableInOrganization` | Graniczy zasób obsługiwany przez `server/src/services/tablePlatform/TableAiEditorLevels/handlerHelpers.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/v8/governedRetrievalService.ts:741` | `buildScopeResolution` | Graniczy zasób obsługiwany przez `server/src/services/v8/governedRetrievalService.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |
| `server/src/services/v8/workspaceCrossModuleService.ts:137` | `assertSessionInOrg` | Graniczy zasób obsługiwany przez `server/src/services/v8/workspaceCrossModuleService.ts` do organizacji, zakresu lub właściciela wyrażonego nazwą bramki. | NIEZNANE — wymaga mutacji |

### (b) Bramy zatwierdzenia i stanu

Komenda T3 z instrukcji; wynik: **43**.

| plik:linia | warunek | co chroni | test omijający |
|---|---|---|---|
| `server/src/controllers/AssessmentController.ts:1459` | `.status !== 'APPROVED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/controllers/AssessmentController.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/domain/initiatives-execution/portfolioDecision.ts:83` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/domain/initiatives-execution/portfolioDecision.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/domain/initiatives-execution/portfolioDecision.ts:200` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/domain/initiatives-execution/portfolioDecision.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/domain/initiatives-execution/resourceCommitment.ts:63` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/domain/initiatives-execution/resourceCommitment.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/domain/initiatives-execution/reportRun.ts:240` | `.status !== 'APPROVED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/domain/initiatives-execution/reportRun.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/domain/initiatives-execution/managementIntervention.ts:425` | `.status !== 'APPROVED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/domain/initiatives-execution/managementIntervention.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/domain/initiatives-execution/managementIntervention.ts:454` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/domain/initiatives-execution/managementIntervention.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/domain/initiatives-execution/scheduleDecision.ts:116` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/domain/initiatives-execution/scheduleDecision.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/domain/initiatives-execution/scheduleDecision.ts:124` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/domain/initiatives-execution/scheduleDecision.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/domain/initiatives-execution/scheduleDecision.ts:134` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/domain/initiatives-execution/scheduleDecision.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/domain/initiatives-execution/planScenario.ts:139` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/domain/initiatives-execution/planScenario.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/domain/initiatives-execution/capacityScenario.ts:134` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/domain/initiatives-execution/capacityScenario.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/routes/report-builder.routes.ts:3061` | `.status !== 'APPROVED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/routes/report-builder.routes.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/routes/pmo/initiativesCapacityAdvisor.routes.ts:59` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/routes/pmo/initiativesCapacityAdvisor.routes.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/routes/pmo/initiativesCapacityAdvisor.routes.ts:60` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/routes/pmo/initiativesCapacityAdvisor.routes.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/routes/admin-data.routes.ts:696` | `.status != 'COMPLETED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/routes/admin-data.routes.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/routes/status-reports.routes.ts:101` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/routes/status-reports.routes.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/routes/dataExport.routes.ts:222` | `.status !== 'COMPLETED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/routes/dataExport.routes.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/partnerOperatorReviewService.ts:71` | `.status !== 'COMPLETED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/partnerOperatorReviewService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/aiActionExecutor.ts:773` | `.status !== ACTION_STATUS.APPROVED` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/aiActionExecutor.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | TAK — A.2 mutacja RED/GREEN |
| `server/src/services/reportBuilderService.ts:986` | `.status !== 'APPROVED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/reportBuilderService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/partnerReferralService.ts:998` | `.status !== 'COMPLETED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/partnerReferralService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/resultsVnext/platform/visibilityResolver.ts:484` | `.status !== 'ACTIVE'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/resultsVnext/platform/visibilityResolver.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/partnerAccrualPolicy.ts:29` | `.status !== 'APPROVED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/partnerAccrualPolicy.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/partnerConnectionService.ts:212` | `.status !== 'COMPLETED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/partnerConnectionService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/assessment/drdCandidateHandoff.ts:190` | `.status !== 'APPROVED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/assessment/drdCandidateHandoff.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/proposalApprovalService.ts:703` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/caseWorkspace/proposalApprovalService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/waitSubscriptionService.ts:526` | `.status !== 'ACTIVE'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/caseWorkspace/waitSubscriptionService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/waitSubscriptionService.ts:755` | `.status !== 'ACTIVE'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/caseWorkspace/waitSubscriptionService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/waitSubscriptionService.ts:1689` | `.status !== 'ACTIVE'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/caseWorkspace/waitSubscriptionService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/waitSubscriptionService.ts:1709` | `.status !== 'ACTIVE'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/caseWorkspace/waitSubscriptionService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/waitSubscriptionService.ts:1772` | `.status !== 'ACTIVE'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/caseWorkspace/waitSubscriptionService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/runLifecycleService.ts:658` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/caseWorkspace/runLifecycleService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/runLifecycleService.ts:785` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/caseWorkspace/runLifecycleService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/casePlanVersionService.ts:943` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/caseWorkspace/casePlanVersionService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/eventInboxService.ts:685` | `.status !== 'ACTIVE'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/caseWorkspace/eventInboxService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/lightOneClickService.ts:381` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/caseWorkspace/lightOneClickService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/playService.ts:1624` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/caseWorkspace/playService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/runBindingService.ts:224` | `.status !== 'PUBLISHED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/caseWorkspace/runBindingService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/executionBvpService.ts:71` | `.status !== 'ACTIVE'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/executionBvpService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/partnerCertificationService.ts:574` | `.status !== 'COMPLETED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/partnerCertificationService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/finance/canonical/artifactVersionService.ts:1367` | `.status !== 'APPROVED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/finance/canonical/artifactVersionService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |
| `server/src/services/stakeholderCommService.ts:959` | `.status !== 'COMPLETED'` | Blokuje przejście zasobu obsługiwanego przez `server/src/services/stakeholderCommService.ts` poza wymagany stan zatwierdzony/aktywny/ukończony. | NIEZNANE — wymaga mutacji |

### (c) Idempotencja

Komendy T4; wynik: **6 plików / 292 wystąpienia**.

| plik | mechanizm | co chroni | test omijający |
|---|---|---|---|
| `server/scripts/legacy-task-cutover-runner.ts` | `clientRequestId` | Ledger cutover: NOT EXISTS i checksum blokują ponowną migrację tej samej pracy. | TAK — A.2 mutacja RED/GREEN |
| `server/src/domain/initiatives-execution/managementIntervention.ts` | `clientRequestId` | Receipt komendy interwencji rozróżnia replay od konfliktu clientRequestId. | NIEZNANE — wymaga mutacji |
| `server/src/domain/initiatives-execution/materialCommand.ts` | `clientRequestId` | Centralny receipt execution-spine blokuje podwójne wykonanie komendy. | NIEZNANE — A.3 nieukończone |
| `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts` | `clientRequestId` | Trwały postgresowy zapis i odczyt receipt wiąże clientRequestId z payloadem. | NIEZNANE — wymaga mutacji |
| `server/src/routes/pmo/initiativesCapacityAdvisor.routes.ts` | `clientRequestId` | Trasa capacity advisor wiąże ponowienie żądania z clientRequestId. | NIEZNANE — wymaga mutacji |
| `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` | `clientRequestId` | Runtime inicjatyw deduplikuje komendy wejściowe po clientRequestId. | NIEZNANE — wymaga mutacji |

Dodatkowy census `ON CONFLICT.*DO NOTHING` dał **396** wystąpień. Nie doliczam ich automatycznie do rdzenia: idiom pełni mieszane role (seed, cache, outbox, deduplikacja), a sama składnia bez klucza biznesowego i readbacku nie dowodzi samodzielnego zabezpieczenia. Lista pozostaje artefaktem do osobnej klasyfikacji semantycznej.

### (d) Uprawnienia i role

Komenda T5; wynik: **69** nazwanych eksportowanych guardów.

| plik:linia | guard | co chroni | test omijający |
|---|---|---|---|
| `server/src/middleware/trialEntryGuard.middleware.ts:299` | `requireOrgContext` | Ogranicza operację nazwaną `requireOrgContext` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/trialEntryGuard.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/resultsInternalBetaVisibility.middleware.ts:80` | `requireResultsInternalBetaVisibility` | Ogranicza operację nazwaną `requireResultsInternalBetaVisibility` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/resultsInternalBetaVisibility.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/effectiveCapability.middleware.ts:405` | `requireProjectCapability` | Ogranicza operację nazwaną `requireProjectCapability` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/effectiveCapability.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/effectiveCapability.middleware.ts:586` | `requireAnyProjectCapability` | Ogranicza operację nazwaną `requireAnyProjectCapability` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/effectiveCapability.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/effectiveCapability.middleware.ts:767` | `requireTaskCapability` | Ogranicza operację nazwaną `requireTaskCapability` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/effectiveCapability.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/effectiveCapability.middleware.ts:770` | `requireInterviewCapability` | Ogranicza operację nazwaną `requireInterviewCapability` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/effectiveCapability.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/effectiveCapability.middleware.ts:773` | `requireAnyInterviewCapability` | Ogranicza operację nazwaną `requireAnyInterviewCapability` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/effectiveCapability.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/effectiveCapability.middleware.ts:778` | `requireInitiativeCapability` | Ogranicza operację nazwaną `requireInitiativeCapability` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/effectiveCapability.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/effectiveCapability.middleware.ts:781` | `requireDecisionCapability` | Ogranicza operację nazwaną `requireDecisionCapability` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/effectiveCapability.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/effectiveCapability.middleware.ts:784` | `requireAnyInitiativeCapability` | Ogranicza operację nazwaną `requireAnyInitiativeCapability` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/effectiveCapability.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/effectiveCapability.middleware.ts:789` | `requireSupportCapability` | Ogranicza operację nazwaną `requireSupportCapability` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/effectiveCapability.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/effectiveCapability.middleware.ts:792` | `requireBillingCapability` | Ogranicza operację nazwaną `requireBillingCapability` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/effectiveCapability.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/v8Auth.middleware.ts:138` | `requireV` | Ogranicza operację nazwaną `requireV` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/v8Auth.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:22` | `requireCanonicalExecutionWriter` | Ogranicza operację nazwaną `requireCanonicalExecutionWriter` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:59` | `requireCanonicalInitiativeExecutionWriter` | Ogranicza operację nazwaną `requireCanonicalInitiativeExecutionWriter` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/confirmAction.middleware.ts:62` | `requireConfirmation` | Ogranicza operację nazwaną `requireConfirmation` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/confirmAction.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/permission.middleware.ts:262` | `requirePermission` | Ogranicza operację nazwaną `requirePermission` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/permission.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/permission.middleware.ts:328` | `requireAnyPermission` | Ogranicza operację nazwaną `requireAnyPermission` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/permission.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/permission.middleware.ts:436` | `requireAllPermissions` | Ogranicza operację nazwaną `requireAllPermissions` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/permission.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/apiVersion.middleware.ts:388` | `requireVersion` | Ogranicza operację nazwaną `requireVersion` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/apiVersion.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/apiKeyAuth.middleware.ts:353` | `requireApiKeyPermission` | Ogranicza operację nazwaną `requireApiKeyPermission` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/apiKeyAuth.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/frameworkEntitlement.middleware.ts:177` | `requireFrameworkAccess` | Ogranicza operację nazwaną `requireFrameworkAccess` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/frameworkEntitlement.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/frameworkEntitlement.middleware.ts:247` | `requireDynamicFrameworkAccess` | Ogranicza operację nazwaną `requireDynamicFrameworkAccess` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/frameworkEntitlement.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/requireAudit.middleware.ts:78` | `requireAudit` | Ogranicza operację nazwaną `requireAudit` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/requireAudit.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/auditsStrictMembership.middleware.ts:146` | `requireActiveTenantMembership` | Ogranicza operację nazwaną `requireActiveTenantMembership` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/auditsStrictMembership.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/auditsStrictMembership.middleware.ts:157` | `requireActiveTenantMembershipOrUnavailable` | Ogranicza operację nazwaną `requireActiveTenantMembershipOrUnavailable` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/auditsStrictMembership.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/auditsStrictMembership.middleware.ts:168` | `requireActiveAuditsMembership` | Ogranicza operację nazwaną `requireActiveAuditsMembership` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/auditsStrictMembership.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/rbac.middleware.ts:173` | `requireRole` | Ogranicza operację nazwaną `requireRole` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/rbac.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/rbac.middleware.ts:211` | `requireOrgAccess` | Ogranicza operację nazwaną `requireOrgAccess` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/rbac.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/rbac.middleware.ts:257` | `requireOrgRole` | Ogranicza operację nazwaną `requireOrgRole` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/rbac.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/superAdmin.middleware.ts:517` | `requireSuperAdminCapability` | Ogranicza operację nazwaną `requireSuperAdminCapability` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/superAdmin.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/auth.middleware.ts:1612` | `requireRole` | Ogranicza operację nazwaną `requireRole` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/auth.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/auth.middleware.ts:1655` | `requireSuperAdmin` | Ogranicza operację nazwaną `requireSuperAdmin` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/auth.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/auth.middleware.ts:1675` | `requireOrganization` | Ogranicza operację nazwaną `requireOrganization` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/auth.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/auth.middleware.ts:1815` | `requirePermission` | Ogranicza operację nazwaną `requirePermission` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/auth.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/permissionMiddleware.ts:80` | `requirePermission` | Ogranicza operację nazwaną `requirePermission` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/permissionMiddleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/permissionMiddleware.ts:147` | `requireAnyPermission` | Ogranicza operację nazwaną `requireAnyPermission` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/permissionMiddleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/permissionMiddleware.ts:217` | `requireAllPermissions` | Ogranicza operację nazwaną `requireAllPermissions` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/permissionMiddleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/featureGate.middleware.ts:234` | `requireFeature` | Ogranicza operację nazwaną `requireFeature` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/featureGate.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/featureGate.middleware.ts:315` | `requireAccess` | Ogranicza operację nazwaną `requireAccess` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/featureGate.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/internalTools.middleware.ts:110` | `requireInternalToolsAccess` | Ogranicza operację nazwaną `requireInternalToolsAccess` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/internalTools.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/userStateGuard.middleware.ts:189` | `requireState` | Ogranicza operację nazwaną `requireState` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/userStateGuard.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/userStateGuard.middleware.ts:247` | `requirePhase` | Ogranicza operację nazwaną `requirePhase` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/userStateGuard.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/middleware/userStateGuard.middleware.ts:295` | `requirePermission` | Ogranicza operację nazwaną `requirePermission` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/middleware/userStateGuard.middleware.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/utils/requestOrganization.ts:19` | `requireRequestOrganizationId` | Ogranicza operację nazwaną `requireRequestOrganizationId` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/utils/requestOrganization.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/routes/my-work/_helpers.ts:6` | `requireUser` | Ogranicza operację nazwaną `requireUser` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/routes/my-work/_helpers.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/routes/my-work/_helpers.ts:44` | `requireTables` | Ogranicza operację nazwaną `requireTables` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/routes/my-work/_helpers.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/routes/caseWorkspace/_shared/access.ts:37` | `requireCaseAccessForActor` | Ogranicza operację nazwaną `requireCaseAccessForActor` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/routes/caseWorkspace/_shared/access.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/routes/caseWorkspace/_shared/access.ts:42` | `requireOrgMemberForActor` | Ogranicza operację nazwaną `requireOrgMemberForActor` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/routes/caseWorkspace/_shared/access.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/routes/caseWorkspace/_shared/access.ts:47` | `requireOrgRoleForActor` | Ogranicza operację nazwaną `requireOrgRoleForActor` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/routes/caseWorkspace/_shared/access.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/demo/atelierFinanceOperatorHold.ts:304` | `requireDurableOperatorHoldStorage` | Ogranicza operację nazwaną `requireDurableOperatorHoldStorage` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/demo/atelierFinanceOperatorHold.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/materialExport/materialExportPolicyService.ts:20` | `requireApprovedExportEngine` | Ogranicza operację nazwaną `requireApprovedExportEngine` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/materialExport/materialExportPolicyService.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/decisionOutcomeService.ts:73` | `requiresRationale` | Ogranicza operację nazwaną `requiresRationale` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/decisionOutcomeService.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/audits/permissions.ts:309` | `requireCapability` | Ogranicza operację nazwaną `requireCapability` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/audits/permissions.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/partnerProgramLedgerService.ts:362` | `requiresDualControl` | Ogranicza operację nazwaną `requiresDualControl` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/partnerProgramLedgerService.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/caseWorkspaceAuthContext.ts:324` | `requireOrgMember` | Ogranicza operację nazwaną `requireOrgMember` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/caseWorkspace/caseWorkspaceAuthContext.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/caseWorkspaceAuthContext.ts:344` | `requireOrgMemberWithClient` | Ogranicza operację nazwaną `requireOrgMemberWithClient` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/caseWorkspace/caseWorkspaceAuthContext.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/caseWorkspaceAuthContext.ts:379` | `requireOrgRole` | Ogranicza operację nazwaną `requireOrgRole` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/caseWorkspace/caseWorkspaceAuthContext.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/caseWorkspaceAuthContext.ts:416` | `requireCaseAccess` | Ogranicza operację nazwaną `requireCaseAccess` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/caseWorkspace/caseWorkspaceAuthContext.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/adapters/_shared.ts:66` | `requireNonBlankInput` | Ogranicza operację nazwaną `requireNonBlankInput` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/caseWorkspace/adapters/_shared.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/adapters/_shared.ts:74` | `requireEnumInput` | Ogranicza operację nazwaną `requireEnumInput` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/caseWorkspace/adapters/_shared.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/autonomyPolicyService.ts:475` | `requiredControlFor` | Ogranicza operację nazwaną `requiredControlFor` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/caseWorkspace/autonomyPolicyService.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/caseWorkspace/autonomyPolicyService.ts:882` | `requireAutonomyFor` | Ogranicza operację nazwaną `requireAutonomyFor` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/caseWorkspace/autonomyPolicyService.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/workCanvasService.ts:388` | `requiredCapabilityForTarget` | Ogranicza operację nazwaną `requiredCapabilityForTarget` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/workCanvasService.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/legacyCutover/requireActiveMembership.ts:14` | `requireActiveMembership` | Ogranicza operację nazwaną `requireActiveMembership` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/legacyCutover/requireActiveMembership.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/legacyCutover/requireActiveMembership.ts:47` | `requireFinanceEditorMembership` | Ogranicza operację nazwaną `requireFinanceEditorMembership` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/legacyCutover/requireActiveMembership.ts`. | TAK — A.3 mutacja RED/GREEN |
| `server/src/services/finance/canonical/baselineComputeService.ts:336` | `requireAssumption` | Ogranicza operację nazwaną `requireAssumption` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/finance/canonical/baselineComputeService.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/finance/keyboard/KeyboardCommandRegistry.ts:867` | `requiresConfirmationBeforeExecuting` | Ogranicza operację nazwaną `requiresConfirmationBeforeExecuting` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/finance/keyboard/KeyboardCommandRegistry.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/documentStudio/documentQaService.ts:108` | `requiresApprovalForExport` | Ogranicza operację nazwaną `requiresApprovalForExport` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/documentStudio/documentQaService.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/initiative/initiativeGovernanceGuard.ts:135` | `requireInitiativeWriteAccess` | Ogranicza operację nazwaną `requireInitiativeWriteAccess` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/initiative/initiativeGovernanceGuard.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/OrgPoliciesService.ts:39` | `requireNoLegalHold` | Ogranicza operację nazwaną `requireNoLegalHold` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/OrgPoliciesService.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/executionActionRegistryService.ts:44` | `requireImplementedExecutionAction` | Ogranicza operację nazwaną `requireImplementedExecutionAction` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/executionActionRegistryService.ts`. | TAK — A.3 mutacja RED/GREEN |
| `server/src/services/tablePlatform/ErrorHandling.ts:95` | `requireString` | Ogranicza operację nazwaną `requireString` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/tablePlatform/ErrorHandling.ts`. | NIEZNANE — wymaga mutacji |
| `server/src/services/tablePlatform/ErrorHandling.ts:105` | `requireUUID` | Ogranicza operację nazwaną `requireUUID` do uwierzytelnionej roli, członkostwa albo dostępnej zdolności w `server/src/services/tablePlatform/ErrorHandling.ts`. | NIEZNANE — wymaga mutacji |

Łącznie tabela obejmuje **152/152** pozycji enumerowalnego rdzenia. Status `NIEZNANE` nie jest domniemaniem braku testu — oznacza brak wykonanej mutacji.

## A.2 — regresja 204/207/210

Wszystkie komendy miały jawne `--retry=0`; realDB dodatkowo pełny env z `DB_TYPE=postgres`, `MOCK_DB=false` i `DATABASE_URL=...6152/cx212`.

| pozycja | GREEN | mutacja | wynik mutacji | przywrócenie |
|---|---|---|---|---|
| 204 Guard A/B | 3/3, pełne nazwy w `a2-204-green.json` | usunięte oba bloki `NOT EXISTS`; `if (existing.rows[0])` → `if (false && existing.rows[0])` | **0/3, trzy czerwone** | `cp`, diff pusty |
| 210 access filter | 7/7 | początek `buildKnowledgeDocAccessFilter` zwraca `{sql:'1=1',params:[]}` | **4/7; trzy izolacyjne czerwone** | `cp`, diff pusty |
| 207 approval gate | 5/5 | `if (action.status !== APPROVED)` → `if (false && ...)` | **4/5; czerwony dokładnie „never executes a rejected proposal”** | `cp`, diff pusty |

Pełne nazwy czerwone 204: end-to-end replay, Guard A selector, Guard B checksum. Pełne nazwy czerwone 210: prywatny dokument A niewidoczny dla B (direct, pgvector dispatcher, sqlite fallback). Pełna nazwa czerwona 207: `AIActionExecutor Wave 3 runtime lifecycle never executes a rejected proposal`.

Pułapka mocków: 204 realDB nie używa `vi.mock/vi.fn`; 210 hoistuje mock i sam dokumentuje naprawę lifetime, wykonana mutacja czerwieni trzy przypadki; 207 resetuje implementacje w lokalnym `beforeEach(resetDb)`, więc globalny `clearAllMocks` nie unieważnia wyniku.

## A.3 — kandydaci w kolejności ryzyka

| # | pozycja | werdykt | dowód |
|---|---|---|---|
| 1 | `raid.routes.ts:36` | **NIEZWERYFIKOWANE** | znaleziony lepszy kandydat niż sugerował grep: `raid.routes.tenant-isolation.mounted.realdb.test.ts`, ale oba przebiegi miały 4/4 SKIP, bo istniejący test wymaga nazwy DB zaczynającej się od `consultify_raid_idor_test`; to narusza wzorzec Z31 i nie jest PASS |
| 2 | `requireFinanceEditorMembership` | **POKRYTE** | 17/17 GREEN → po wyłączeniu sprawdzenia roli 16/17, czerwony „denies viewer/revoked and accepts owner/admin/finance editor” |
| 3 | `assertInitiativeInOrg` | **POMINIĘTE** | brak czasu po obowiązkowym rdzeniu |
| 4 | `requireImplementedExecutionAction` | **POKRYTE** | 13/13 GREEN → po wyłączeniu bramy 12/13, czerwony „fails closed for a hidden or missing action” |
| 5 | `executeMaterialCommand/findReceipt` | **POMINIĘTE** | niższy priorytet niż 1–4 |
| 6 | `AssessmentController.status` | **POMINIĘTE** | niższy priorytet |
| 7 | `managementIntervention` | **POMINIĘTE** | niższy priorytet |
| 8 | `requireRole` | **POMINIĘTE** | najniższy priorytet, istnieją dwa dedykowane pliki, ale bez mutacji pozostaje NIEZNANE |

## A.4 — nowe testy omijające

Nie dodano nowego testu. Pozycje 2 i 4 są już realnie pokryte. Dla pozycji 1 nie wolno uznać trwałego SKIP za dowód; napisanie nowego nieprzypiętego do nazwy bazy testu pozostaje pierwszym zadaniem kontynuacji. Pozycje 3 i 5–8 nie zostały zmierzone, więc nie wolno jeszcze decydować, czy wymagają nowych plików.

## A.5 — bezpiecznik metodyczny

Dopisano wyłącznie `REGUŁA NR 7 — zabezpieczenie musi mieć własną mutację` na końcu `00_ZASADY_PRACY.md`. Reguły 1–6 nie zostały zmienione. Reguła cytuje rzeczywisty `server/src/services/ai/embeddingService.ts:341`.

## Pomiar nazw §0.4a

Zakres faktycznie uruchomionych pakietów: A.2 (204/207/210) oraz A.3 (finance/registry). Przed: **45 pełnych nazw**; po: **45**; `diff`: **0 linii**, żadna nazwa nie zniknęła i żadna nie została dodana. Nie jest to twierdzenie o całym repo, tylko o jawnie wymienionych pakietach.

## ZNALEZISKA

1. `tests/integration/routes/raid.routes.tenant-isolation.mounted.realdb.test.ts:34-44`: test realDB przypina się do prefiksu nazwy bazy. Na przydzielonej `cx212` raportuje 4 SKIP przy exit 0. Promień: regresja cross-tenant PUT/PATCH/DELETE RAID może wyglądać na zieloną bez wykonania. Rekomendacja: osobny dyżur testowy usuwa przywiązanie zgodnie z Z31 i powtarza mutację strażnika.
2. `ON CONFLICT ... DO NOTHING`: 396 wystąpień jest zbyt szerokim zbiorem składniowym, by rzetelnie nazwać je zabezpieczeniami idempotencji bez identyfikacji klucza i skutku. Rekomendacja: osobny census semantyczny.
3. Tip bazowy zawiera późniejsze scalenie 207, ale marker go nie ma. To nie defekt markera; odbiorca musi scalać wynik z uwzględnieniem konfliktu `aiActionExecutor.ts`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Inwentarz zawiera wszystkie **152/152** wiersze rdzenia, lecz dla większości status pokrycia jest świadomie `NIEZNANE`; pełna klasyfikacja semantyczna nie została wykonana mutacyjnie.
- 207 jest rozstrzygnięte realną mutacją: 5/5 → 4/5.
- Z ośmiu pozycji A.3 dwie (#2, #4) wykonano w obie strony; #1 wykonano, ale oba przebiegi były SKIP i dowód odrzucono; pięć (#3, #5–#8) nie zostało zmutowanych.
- Pułapkę `beforeAll/clearAllMocks` sprawdzono dla wszystkich faktycznie uznanych dowodów; nie wykonano tej kontroli dla pominiętych kandydatów.
- Reguła nr 7 cytuje realny plik i linię.
- Nie zweryfikowano wszystkich 396 przypadków `ON CONFLICT DO NOTHING`.
- Nie wykonano pełnego repo-wide pakietu testów; porównanie 45 nazw dotyczy wyłącznie pakietów dowodowych.

## Pominięte i kolejność

Po rdzeniu ukończono A.3 #2 i #4; #1 ujawnił blokujący SKIP. Pozostały #3 oraz #5–#8, jawnie w kolejności instrukcji. A.4 dla #1 jest pierwszą kontynuacją; dla pozostałych decyzja dopiero po mutacji.

## Z30 — zero wysyłki

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Artefakty

Katalog: `/private/tmp/cx-day212-zabezpieczenia-artefakty`. Kluczowe SHA-256:

- `T1-T11.log`: `be1f178db070dc3b8d4400be3f36e95cd4c4162b2b4a4fb0811081b481bffbe0`
- `a2-204-green/red.json`: `735451c11d3c19de8ca8f78ce1e4c51fff2f926b23786765d6eb179f5693721d3` / `8dacea74db12862ef33ad93636df791b51da3c186662883c3043387e97560137`
- `a2-207-green/red.json`: `2999be3974a0a45dda89099817f9aac05911fcae1892c4640d144f35f69eeb70` / `34176dffc495c6801ceda914bb64200d0bc16986468b0812181e635e1f1bd7e2`
- `a2-210-green/red.json`: `e30c490c1825df1c463541472896adc0c052d6baa35397f841bd177e17fb8274` / `1f701bce417e6d6e4e2bc44c4a8ed0d9a1efe0a72537271564a9c8c27b31a1da`
- `przed-nazwy.txt` i `po-nazwy.txt`: `e78c242955f480692b2e2ca611f8aa1dac173871d5132adb7e0c15416b67b734`
- `nazwy.diff`: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`


