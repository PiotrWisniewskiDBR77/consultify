# Gate fail triage snapshot — f6a00552802d3a5d0f2bbd2c72316c05b55b8f82

Źródło: `tests` discovery/shard JSON z `/var/folders/.../consultify-standard-sharded-f6a00552802d-hr9J8k`.

## Liczba faili wg obszaru
| Obszar | Fail testów |
|---|---:|
| Other | 124 |
| Routing/Auth | 122 |
| Artifact/Materials | 73 |
| Superadmin | 66 |
| MyWork | 56 |
| Initiatives | 40 |
| Assessment | 28 |
| Audits | 19 |
| AIChat | 14 |
| Finance | 12 |
| Results | 8 |
| Tools | 8 |
| Interview | 7 |
| Execution | 4 |

## Top pliki z największą liczbą failów (pierwsze 120)
| Faili | Obszar | Plik |
|---:|---|---|
| 13 | Audits | server/src/routes/audits/__tests__/mounting.integration.test.ts |
| 13 | Superadmin | tests/integration/routes/superadmin-ai-platform.test.js |
| 12 | Other | tests/hooks/useKeyboardShortcuts.test.ts |
| 12 | Superadmin | tests/integration/routes/superadmin-system.test.js |
| 11 | Other | tests/unit/table/useTableViews.test.ts |
| 10 | Artifact/Materials | tests/components/ArtifactApprovalStatusBar.5types.test.tsx |
| 10 | Assessment | tests/components/assessment/AssessmentHub.menu3BulkRow.t20.test.tsx |
| 10 | Other | tests/unit/table/useTableSchema.test.ts |
| 9 | Routing/Auth | tests/integration/routes/billing.no-demo.analytics-and-revenue.test.ts |
| 8 | Artifact/Materials | tests/components/ReportsAndPresentations/PresentationsTabContent.qualityBadge.test.tsx |
| 8 | Superadmin | tests/integration/routes/superadmin-analytics.test.js |
| 7 | Routing/Auth | tests/integration/auth.test.ts |
| 7 | Superadmin | tests/integration/routes/superadmin-configuration.test.js |
| 6 | Initiatives | tests/components/Initiatives/InitiativesHub.r11-wiring.source-anchor.test.ts |
| 6 | MyWork | tests/components/MyWork/NotebookQuickCapture.test.tsx |
| 6 | Interview | tests/integration/interview/interview-routes.test.ts |
| 6 | Routing/Auth | tests/integration/llmHealth.test.js |
| 6 | Routing/Auth | tests/integration/routes/access-control.test.js |
| 6 | Routing/Auth | tests/integration/routes/invitations.test.js |
| 6 | Routing/Auth | tests/integration/routes/mediaIngestion.no-stubs.test.ts |
| 5 | MyWork | src/components/MyWork/table/provenance/__tests__/ValidationBadge.test.tsx |
| 5 | Other | tests/component/controllers/InitiativeController.test.ts |
| 5 | MyWork | tests/components/MyWork/AICommandPrompt.test.tsx |
| 5 | MyWork | tests/components/MyWork/ConvertChecklistModal.test.tsx |
| 5 | Results | tests/components/Results/AIInsightsPanel.test.tsx |
| 5 | Assessment | tests/integration/assessment/assessment-routes.test.ts |
| 5 | Other | tests/integration/resource-management-api.test.ts |
| 5 | Initiatives | tests/integration/routes/initiatives.test.js |
| 4 | Artifact/Materials | server/src/routes/__tests__/presentationCustomTemplateContract.test.ts |
| 4 | Tools | src/components/DiscoveryTools/__tests__/genericDomainStep.smoke.test.tsx |
| 4 | MyWork | src/components/MyWork/__tests__/IdeaTemplateGallery.l06.test.tsx |
| 4 | MyWork | src/components/MyWork/table/provenance/__tests__/RowGutterIndicator.test.tsx |
| 4 | Initiatives | tests/components/Initiatives/InitiativeCharterWizard.dedup.test.tsx |
| 4 | Initiatives | tests/components/Initiatives/InitiativesHub.t30-wiring.source-anchor.test.ts |
| 4 | MyWork | tests/components/MyWork/AIInlineResponse.test.tsx |
| 4 | Other | tests/components/smoke/hubs.smoke.test.tsx |
| 4 | Artifact/Materials | tests/integration/deliverables/templateApi.test.ts |
| 4 | Initiatives | tests/integration/initiatives/gate-ai-soft-block.test.ts |
| 4 | Finance | tests/integration/routes/economicsFlow.test.js |
| 4 | Routing/Auth | tests/integration/routes/notifications.test.js |
| 4 | Routing/Auth | tests/integration/routes/skills-gap.auth.routes.test.ts |
| 4 | Superadmin | tests/integration/routes/superadmin-revenue.test.js |
| 4 | Artifact/Materials | tests/unit/backend/routes/workbook.routes.grounding-hydration.test.ts |
| 4 | Other | tests/unit/table/AITableProposal.test.tsx |
| 3 | Audits | src/components/Audit/__tests__/AuditOrchestratorWizard.test.tsx |
| 3 | Audits | src/components/Audit/__tests__/AuditsHub.test.tsx |
| 3 | AIChat | tests/components/AIChat/UnifiedChatPanel.helpers.test.ts |
| 3 | Finance | tests/components/Finance/DriverPlannerPanelM16.test.tsx |
| 3 | Initiatives | tests/components/Initiatives/InitiativeCharterWizard.b3-hints.test.tsx |
| 3 | MyWork | tests/components/MyWork/NotebookContextPanel.outputs.test.tsx |
| 3 | Results | tests/components/Results/ValueDriverTree.test.tsx |
| 3 | Artifact/Materials | tests/components/shared/NModeBlocks/ArtifactAttachPopover.paste-contract.test.tsx |
| 3 | Other | tests/components/ValuationVisualsPanel.test.tsx |
| 3 | Other | tests/integration/ai/ai-attachments-ingest-typegate.test.ts |
| 3 | Assessment | tests/integration/assessment-reports.routes.test.js |
| 3 | Assessment | tests/integration/assessment-reports.routes.test.ts |
| 3 | Other | tests/integration/metricsFullFlow.test.js |
| 3 | Routing/Auth | tests/integration/routes/customers-module.test.js |
| 3 | Artifact/Materials | tests/integration/routes/documents.test.js |
| 3 | Routing/Auth | tests/integration/routes/organizationData.no-stubs.test.ts |
| 3 | Routing/Auth | tests/integration/routes/stubbed-legacy-routes.no-501.test.ts |
| 3 | Superadmin | tests/integration/routes/superadmin-customers.test.js |
| 3 | Superadmin | tests/integration/routes/superadmin-iam.test.js |
| 3 | Other | tests/unit/components/Admin/AIMissionControl.honesty.test.tsx |
| 3 | Routing/Auth | tests/unit/components/Organization/KnowledgeGraphExplorer.smoke.test.tsx |
| 3 | Other | tests/unit/scripts/testing/coverage-thresholds.gate.contract.test.ts |
| 3 | Artifact/Materials | tests/unit/views/superadmin/DocumentsRAGTab.honesty.test.tsx |
| 3 | Superadmin | tests/unit/views/superadmin/IPWhitelistView.honesty.test.tsx |
| 2 | Artifact/Materials | server/src/routes/__tests__/presentationTemplateApprovalLibraryRoundTrip.test.ts |
| 2 | Artifact/Materials | server/src/services/__tests__/artifactRegistryPresentationTemplatePosture.test.ts |
| 2 | Execution | server/src/services/v8/__tests__/executionSpineService.initiative-scope.test.ts |
| 2 | AIChat | src/components/AIChat/KimiWorkspace/tabeleShell/__tests__/TabeleSourcePackPanel.test.tsx |
| 2 | MyWork | src/components/MyWork/table/provenance/__tests__/AddSourceDialog.test.tsx |
| 2 | MyWork | src/components/MyWork/table/provenance/__tests__/SourcePopover.test.tsx |
| 2 | AIChat | tests/components/AIChat/AgentPlanPanel.readableLabels.test.tsx |
| 2 | AIChat | tests/components/AIChat/KimiWorkspace/PrezentacjeView.templateBrief.test.tsx |
| 2 | Assessment | tests/components/assessment/AssessmentHub.rowMenu.t20.test.tsx |
| 2 | Assessment | tests/components/assessment/SiriAdmaGuidance.test.tsx |
| 2 | Other | tests/components/controllers/InitiativeController.test.ts |
| 2 | Other | tests/components/DriverPlannerPanel.test.tsx |
| 2 | Finance | tests/components/Finance/ValuationVisualsPanelM16.test.tsx |
| 2 | Initiatives | tests/components/Initiatives/InitiativeGantt.render.test.tsx |
| 2 | Other | tests/components/partner/ProviderHomeView.v8-onboarding-status.test.tsx |
| 2 | Artifact/Materials | tests/components/ReportsAndPresentations/PresentationsTabContent.deeplink.test.tsx |
| 2 | Artifact/Materials | tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.templateStatusChips.test.tsx |
| 2 | Artifact/Materials | tests/components/shared/artifact-actions/ArtifactActionPanel.governance.test.tsx |
| 2 | Other | tests/integration/admin/admin-navigation.test.ts |
| 2 | Other | tests/integration/ai-enterprise-verification.test.ts |
| 2 | Other | tests/integration/ai/ai-attachments-ingest.test.ts |
| 2 | Other | tests/integration/aiLayersIntegration.test.js |
| 2 | Other | tests/integration/backend/planLimits.test.js |
| 2 | Artifact/Materials | tests/integration/deliverables/templateSeeds.integration.test.ts |
| 2 | Routing/Auth | tests/integration/flows/access-limit-integration.test.ts |
| 2 | Other | tests/integration/helpApi.test.ts |
| 2 | Initiatives | tests/integration/initiatives/initiatives.ai-generation.unavailable.no-placeholders.test.ts |
| 2 | Initiatives | tests/integration/initiatives/notifications-org-scope.test.ts |
| 2 | Other | tests/integration/performance/dbOptimization.test.ts |
| 2 | Routing/Auth | tests/integration/routes/ai-experiments.test.js |
| 2 | Routing/Auth | tests/integration/routes/ai-memory.test.js |
| 2 | Routing/Auth | tests/integration/routes/ai-performance.test.js |
| 2 | Routing/Auth | tests/integration/routes/ai-prompts.test.js |
| 2 | Routing/Auth | tests/integration/routes/ai-training.test.js |
| 2 | Routing/Auth | tests/integration/routes/decisions.remind.routes.test.ts |
| 2 | Artifact/Materials | tests/integration/routes/deliverablesGenerations.bundle.test.ts |
| 2 | Routing/Auth | tests/integration/routes/health-data-context.test.ts |
| 2 | Routing/Auth | tests/integration/routes/health-faults.l3.test.ts |
| 2 | Routing/Auth | tests/integration/routes/helpRoutes.test.ts |
| 2 | MyWork | tests/integration/routes/my-work-presence.contract.test.ts |
| 2 | Routing/Auth | tests/integration/routes/pmo/projects.aiRole-and-regulatory.real.test.ts |
| 2 | Artifact/Materials | tests/integration/routes/premiumReports.no-stubs.test.ts |
| 2 | Routing/Auth | tests/integration/routes/sessions.test.js |
| 2 | Superadmin | tests/integration/routes/superadmin-security.test.js |
| 2 | Other | tests/unit/api.test.ts |
| 2 | Other | tests/unit/backend/harvardCrossModuleFlows.test.ts |
| 2 | Other | tests/unit/backend/services/systemAlertNotifier.test.ts |
| 2 | MyWork | tests/unit/components/MyWork/shared/QuickActions.test.tsx |
| 2 | Other | tests/unit/components/ProposalCard.test.tsx |
| 2 | Superadmin | tests/unit/components/SuperAdmin/ModelRegistry/ModelCatalogTable.honesty.test.tsx |
| 2 | Other | tests/unit/createInitiativeFromMove.roundtrip.test.ts |
| 2 | Finance | tests/unit/finance/financeFallbackGating.test.ts |

## Priorytet napraw (operacyjny, na ten moment)
- P0: `Routing/Auth`, `Superadmin` i blokery, które blokują wejścia do rdzenia testów e2e / autoryzacji.
- P1: `MyWork`, `Initiatives`, `Assessment`, `Finance`, `Results` – widoczne user-facing i niezbędne do odbiorów tygodnia.
- P2: `Tools`, `AIChat`, `Artifact/Materials` i `Execution` po ustabilizowaniu podstaw.
- P3: pozostałe rozproszone `Other`.