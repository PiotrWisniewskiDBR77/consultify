# Rejestr testów pustych — dyżur 309

## Mianownik i metoda

- Pliki testowe: 5403.
- Bloki `it/test` rozpoznane przez AST: 42474.
- Kandydaci ze słabymi-only asercjami i sygnałem sieci/bazy: 17.
- Pliki pominięte z powodu błędu odczytu/parsera: 0.
- `PUSTY` wymaga dowodu mutacyjnego; skaner nigdy nie nadaje tej klasy na podstawie tekstu.

## Klasyfikacja

| ID | Plik | Linia | Blok | Klasa | Dowód | Działanie |
|---|---|---:|---|---|---|---|
| E0001 | src/components/Meeting/__tests__/MeetingHub.smoke.test.tsx | 120 | shows an honest error + retry when the operator brief fetch fails (500) | SŁABY | Wyłącznie słabe asercje po sygnale sieci/bazy; bez mutacji nie wolno nazwać PUSTY. | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |
| E0002 | src/components/MyWork/notebook/__tests__/SlashMenu.behavior.test.tsx | 145 | filters by id substring (e.g. "ai") | SŁABY | Wyłącznie słabe asercje po sygnale sieci/bazy; bez mutacji nie wolno nazwać PUSTY. | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |
| E0003 | server/src/routes/__tests__/table-platform.routes.test.ts | 427 | POST /tables/:tableId/records/query route exists | UZASADNIONY | Nazwa jawnie obiecuje wyłącznie smoke/istnienie; mutacja produktu nadal nie została wykonana. | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |
| E0004 | server/src/routes/v8/__tests__/help.routes.test.ts | 79 | returns bilingual rationale with en + pl | SŁABY | Wyłącznie słabe asercje po sygnale sieci/bazy; bez mutacji nie wolno nazwać PUSTY. | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |
| E0005 | server/src/services/ai/__tests__/chatPolicyGateway.retrieval.test.ts | 35 | blocks cross-user private scope for all consumer classes | SŁABY | Wyłącznie słabe asercje po sygnale sieci/bazy; bez mutacji nie wolno nazwać PUSTY. | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |
| E0006 | server/src/services/v8/__tests__/governedRetrievalService.test.ts | 318 | ACL result validates against Zod schema | SŁABY | Wyłącznie słabe asercje po sygnale sieci/bazy; bez mutacji nie wolno nazwać PUSTY. | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |
| E0007 | tests/backend/contentService.test.ts | 629 | should return dashboard data | SŁABY | Wyłącznie słabe asercje po sygnale sieci/bazy; bez mutacji nie wolno nazwać PUSTY. | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |
| E0008 | tests/components/Initiatives/CandidatesTable.t28.test.tsx | 49 | populated: real columns from InitiativeCandidate (sourceType/status/fitScore/createdAt) | SŁABY | Wyłącznie słabe asercje po sygnale sieci/bazy; bez mutacji nie wolno nazwać PUSTY. | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |
| E0009 | tests/integration/ai/ollama.integration.test.ts | 22 | should have Ollama server running | SŁABY | Wyłącznie słabe asercje po sygnale sieci/bazy; bez mutacji nie wolno nazwać PUSTY. | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |
| E0010 | tests/integration/ai/ollama.integration.test.ts | 82 | should generate streaming response | SŁABY | Wyłącznie słabe asercje po sygnale sieci/bazy; bez mutacji nie wolno nazwać PUSTY. | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |
| E0011 | tests/integration/ai/ollama.integration.test.ts | 102 | should respond to chat completions (OpenAI format) | SŁABY | Wyłącznie słabe asercje po sygnale sieci/bazy; bez mutacji nie wolno nazwać PUSTY. | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |
| E0012 | tests/integration/mywork/my-work.convert.contract.test.ts | 226 | my_ideas promoted_to is updated after conversion | SŁABY | Wyłącznie słabe asercje po sygnale sieci/bazy; bez mutacji nie wolno nazwać PUSTY. | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |
| E0013 | tests/integration/pmo-project-members.integration.test.ts | 115 | should include all object types in RACI matrix | SŁABY | Wyłącznie słabe asercje po sygnale sieci/bazy; bez mutacji nie wolno nazwać PUSTY. | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |
| E0014 | tests/integration/services/workbook.p23ext.test.ts | 374 | GET /workbook/list returns workbook list | SŁABY | Wyłącznie słabe asercje po sygnale sieci/bazy; bez mutacji nie wolno nazwać PUSTY. | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |
| E0015 | tests/unit/backend/aiContextBuilder.test.ts | 68 | should build complete context with all layers | SŁABY | Wyłącznie słabe asercje po sygnale sieci/bazy; bez mutacji nie wolno nazwać PUSTY. | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |
| E0016 | tests/unit/backend/siemService.test.ts | 232 | should allow overriding axios | SŁABY | Wyłącznie słabe asercje po sygnale sieci/bazy; bez mutacji nie wolno nazwać PUSTY. | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |
| E0017 | tests/unit/services/scimService.test.ts | 114 | should create a new group | SŁABY | Wyłącznie słabe asercje po sygnale sieci/bazy; bez mutacji nie wolno nazwać PUSTY. | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |

## Podmiot testu zdefiniowany lokalnie

Wykryto 190 plików. To osobna lista do ręcznego przeglądu, nie automatyczny werdykt `PUSTY`.

W tym 64 plików nie ma żadnego statycznego importu z `src/` ani `server/src/`.

| Plik | Import produktu | Podmiot (linia) |
|---|---|---|
| src/components/AIChat/CanvasEditor/__tests__/CanvasRichEditor.externalSync.test.tsx | TAK | Harness (22) |
| src/components/AIChat/KimiWorkspace/__tests__/EditableSpreadsheetGrid.artifactStudio.test.tsx | TAK | Harness (35) |
| src/components/AIChat/KimiWorkspace/__tests__/day276-cisza-przy-bledzie.test.tsx | TAK | Harness (35) |
| src/components/AIChat/KimiWorkspace/tabeleShell/__tests__/useTabeleRightRailPanels.test.tsx | TAK | Probe (69) |
| src/components/AIChat/__tests__/AgentHubNavigation.test.tsx | TAK | LocationProbe (81) |
| src/components/AIChat/__tests__/CanvasViewModeControl.ownerBehavior.test.tsx | TAK | Harness (10) |
| src/components/AIChat/__tests__/day206.toolStepsSlot.test.tsx | TAK | MessageSlots (31) |
| src/components/Audit/method/__tests__/AuditsMethodHub.test.tsx | TAK | LocationProbe (198) |
| src/components/DiscoveryTools/steps/__tests__/ContextStep.mission-navigation.test.tsx | TAK | Harness (14) |
| src/components/DiscoveryTools/tools/DynamicSWOT/__tests__/SWOTBuildPhase.a11y-states.test.tsx | TAK | Harness (57) |
| src/components/DiscoveryTools/tools/DynamicSWOT/__tests__/SWOTBuildPhase.interaction.test.tsx | TAK | Harness (68) |
| src/components/DiscoveryTools/tools/DynamicSWOT/__tests__/SWOTInputExplorationPhase.ai-fill.test.tsx | TAK | Harness (10) |
| src/components/DiscoveryTools/tools/DynamicSWOT/__tests__/SWOTInputExplorationPhase.deleteConfirm.test.tsx | TAK | Harness (22) |
| src/components/DiscoveryTools/tools/DynamicSWOT/__tests__/SWOTInputExplorationPhase.orderCanon.test.tsx | TAK | Harness (24) |
| src/components/Finance/Analysis/__tests__/AnalysisCreatorWizard.a11y.test.tsx | TAK | TriggerHarness (40) |
| src/components/Finance/shared/__tests__/FinanceErrorBoundary.test.tsx | TAK | SafeSibling (24), Boom (20) |
| src/components/Finance/statementPackWorkspaceV2/__tests__/NamedCollapsibleSection.test.tsx | TAK | Harness (14) |
| src/components/Initiatives/Wizard/__tests__/InitiativeWizardModal.a11y.test.tsx | TAK | Harness (54) |
| src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx | TAK | Harness (65) |
| src/components/MyWork/canvas/__tests__/useIdeaMapSync.rv006.test.tsx | TAK | Harness (41) |
| src/components/MyWork/canvas/__tests__/useIdeaMapSync.staleQueuedD3.test.tsx | TAK | Harness (65) |
| src/components/MyWork/canvas/__tests__/whiteboardContextMenu.keyboard.integration.test.tsx | TAK | WhiteboardKeyboardMenuHarness (34) |
| src/components/MyWork/mindmap/__tests__/AIProposalDiffModal.a11y.test.tsx | TAK | Trigger (33) |
| src/components/MyWork/mindmap/__tests__/MindmapCommandPalette.a11y.test.tsx | TAK | Trigger (25) |
| src/components/MyWork/mindmap/__tests__/dialogA11y.batch1.test.tsx | TAK | Harness (37) |
| src/components/MyWork/mindmap/__tests__/dialogA11y.batch2.test.tsx | TAK | Harness (31) |
| src/components/MyWork/mindmap/__tests__/dialogA11y.batch3.test.tsx | TAK | Harness (32) |
| src/components/MyWork/mindmap/__tests__/dialogA11y.batch4.test.tsx | TAK | Harness (31) |
| src/components/MyWork/mindmap/__tests__/useMindMapNodes.addSiblingReentrancy.test.tsx | TAK | Harness (78) |
| src/components/MyWork/mindmap/__tests__/useMindMapQuickActions.aiExpandTarget.test.tsx | TAK | Harness (18) |
| src/components/MyWork/notebook/__tests__/NotebookRightRail.behavior.test.tsx | TAK | Harness (36) |
| src/components/MyWork/processflow/__tests__/ExportDialog.a11y.test.tsx | TAK | Trigger (28) |
| src/components/MyWork/processflow/__tests__/dialogA11y.batch1.test.tsx | TAK | Harness (32) |
| src/components/MyWork/table/__tests__/AddColumnDialog.a11y.test.tsx | TAK | Trigger (26) |
| src/components/MyWork/table/__tests__/RecordExpandModal.a11y.test.tsx | TAK | Trigger (31) |
| src/components/MyWork/table/__tests__/RowDetailPanel.a11y.test.tsx | TAK | Trigger (100) |
| src/components/MyWork/table/__tests__/RowDetailPanel.comments.test.tsx | TAK | StatefulHarness (104) |
| src/components/MyWork/table/__tests__/TablePlatformFrontend.test.tsx | TAK | TableCtxConsumer (355), PlatformTableContextEffectHarness (379), OpenChatToSchemaOnMount (420) |
| src/components/MyWork/table/__tests__/dialogA11y.batch1.test.tsx | TAK | Harness (50) |
| src/components/MyWork/table/__tests__/dialogA11y.batch2.test.tsx | TAK | Harness (37) |
| src/components/MyWork/table/__tests__/dialogA11y.batch3.test.tsx | TAK | Harness (44) |
| src/components/MyWork/table/__tests__/dialogA11y.batch4.test.tsx | TAK | Harness (55) |
| src/components/MyWork/table/__tests__/dialogA11y.batch5.test.tsx | TAK | Harness (58) |
| src/components/MyWork/table/financial/__tests__/FinancialCaseDialog.a11y.test.tsx | TAK | Trigger (23) |
| src/components/MyWork/table/provenance/__tests__/AddSourceDialog.test.tsx | TAK | Trigger (58) |
| src/components/MyWork/whiteboard/__tests__/dialogA11y.batch1.test.tsx | TAK | Harness (28) |
| src/components/__tests__/RouterSync.pilotMeetings.test.tsx | TAK | MeetingsListStub (90), InterviewStub (94) |
| src/components/__tests__/RouterSync.pilotSettingsSilentRedirect.test.tsx | TAK | WebhooksStub (99), ProfileStub (103) |
| src/components/method-workspace/__tests__/LiveMatrix.test.tsx | TAK | ControlledMatrix (18) |
| src/components/method-workspace/__tests__/MethodWorkspaceShell.test.tsx | TAK | Harness (25) |
| src/components/shared/ExecutiveModuleShell/__tests__/useRailState.test.ts | TAK | LS_KEY (20) |
| src/components/shared/__tests__/CanvasContextMenu.keyboard.test.tsx | TAK | Harness (7) |
| src/components/ui/__tests__/dialog.a11y.test.tsx | TAK | Fixture (33), Trigger (47) |
| src/components/ui/primitives/__tests__/useDialogA11y.test.tsx | TAK | TestDialog (29), Harness (42) |
| src/hooks/__tests__/useTeresaVoice.capability-and-bargein.test.tsx | TAK | Harness (43) |
| src/hooks/__tests__/useTeresaVoice.test.tsx | TAK | Harness (52), HarnessWithApiKey (89), HarnessWithToggleableEnabled (100) |
| src/method-core/methods/drd/__tests__/drdAdapter.scoring.test.ts | TAK | L1Q (6) |
| server/src/services/__tests__/docChangelogParityService.test.ts | TAK | SAMPLE_CHANGELOG (45) |
| tests/components/AIChat/ArtifactsPanel.test.tsx | NIE | ArtifactsPanel (7) |
| tests/components/AIChat/FocusModeSelector.test.tsx | NIE | FocusModeSelector (7) |
| tests/components/AIChat/MessageBubble.test.tsx | NIE | MessageBubble (7) |
| tests/components/AIChat/ThinkingBlock.test.tsx | NIE | ThinkingBlock (7) |
| tests/components/Admin/AIModule.test.tsx | TAK | AIModule (14) |
| tests/components/Admin/AIPerformanceDashboard.test.tsx | TAK | AIPerformanceDashboard (14) |
| tests/components/Admin/AdminLayout.test.tsx | NIE | AdminLayout (13) |
| tests/components/Admin/AdminSidebar.test.tsx | NIE | AdminSidebar (13) |
| tests/components/Admin/AuditLogViewer.test.tsx | TAK | AuditLogViewer (14) |
| tests/components/Admin/BillingModule.test.tsx | TAK | BillingModule (14) |
| tests/components/Admin/OverviewModule.test.tsx | TAK | OverviewModule (14) |
| tests/components/Admin/PromptManagementUI.test.tsx | TAK | PromptManagementUI (14) |
| tests/components/Admin/SecurityModule.test.tsx | TAK | SecurityModule (14) |
| tests/components/Admin/TeamModule.test.tsx | TAK | TeamModule (14) |
| tests/components/Admin/WorkspaceModule.test.tsx | TAK | WorkspaceModule (14) |
| tests/components/AppProviders.help-context.test.tsx | TAK | HelpProbe (70) |
| tests/components/AssessmentHubDashboard.test.tsx | NIE | MockAssessmentHubDashboard (41) |
| tests/components/ChatPanel.test.tsx | TAK | ChatPanel (14) |
| tests/components/CommandPaletteGlobalSearch.test.tsx | TAK | Opener (23) |
| tests/components/DashboardOverview.test.tsx | TAK | DashboardOverview (14) |
| tests/components/Discovery/useSurfaceUrlSync.test.tsx | TAK | Harness (22) |
| tests/components/DocumentStudio/TransformativeConfirmDialog.focusReturn.test.tsx | TAK | Harness (16) |
| tests/components/Economics/FinancePreviewPanel.v8-analysis-mutations.test.tsx | TAK | FooterHarness (137), PredictionFooterHarness (142), ModelFooterHarness (147), CanonicalValuationPreviewHarness (152) |
| tests/components/Economics/FinancialMetricsPanel.test.tsx | NIE | FinancialMetricsPanel (7) |
| tests/components/ErrorBoundary.test.tsx | TAK | Thrower (10) |
| tests/components/Execution/RolloutRegisterEditModal.modalRegression.test.tsx | TAK | Harness (38) |
| tests/components/MyWork/DecisionsPanel.test.tsx | NIE | MockDecisionsPanel (61) |
| tests/components/MyWork/IdeaDrawingLayer.keyboardDrawing.test.tsx | TAK | Harness (51) |
| tests/components/MyWork/InboxTriage.test.tsx | NIE | InboxTriage (8) |
| tests/components/MyWork/MyWorkHub.test.tsx | NIE | MockMyWorkHub (28) |
| tests/components/MyWork/PulseItemPickerModal.modalRegression.test.tsx | TAK | Harness (28) |
| tests/components/MyWork/laneAckRisk30.test.tsx | TAK | Harness (59) |
| tests/components/MyWork/table/financial/FinancialCaseDialog.persistence.test.tsx | NIE | Harness (119) |
| tests/components/MyWork/useProcessFlowQuickActions.edgeBus.test.tsx | TAK | Harness (58) |
| tests/components/MyWork/useProcessFlowQuickActions.laneBus.test.tsx | TAK | Harness (69) |
| tests/components/MyWork/useProcessFlowQuickActions.nodeBus.test.tsx | TAK | Harness (66) |
| tests/components/MyWork/useProcessFlowQuickActions.pf-dead-actions.test.tsx | TAK | Harness (49) |
| tests/components/MyWork/useProcessFlowQuickActions.toolbarBus.test.tsx | TAK | Harness (62) |
| tests/components/MyWork/useWhiteboardQuickActions.edgeBus.test.tsx | TAK | Harness (45) |
| tests/components/MyWork/useWhiteboardQuickActions.wb-ai.test.tsx | TAK | Harness (29) |
| tests/components/Onboarding/OnboardingComplete.test.tsx | NIE | OnboardingComplete (7) |
| tests/components/Onboarding/OnboardingProgress.test.tsx | NIE | OnboardingProgress (7) |
| tests/components/Onboarding/OnboardingStep.test.tsx | NIE | OnboardingStep (7) |
| tests/components/Onboarding/OnboardingWelcome.test.tsx | NIE | OnboardingWelcome (7) |
| tests/components/Onboarding/OnboardingWizard.test.tsx | NIE | OnboardingWizard (7) |
| tests/components/ReportsAndPresentations/TemplatesTabContent.galleryFlag.test.tsx | TAK | TabHarness (140) |
| tests/components/ResultsVNext/ResultsVNextRegistryShell.focusEscape.test.tsx | TAK | Harness (27) |
| tests/components/RouteErrorBoundary.test.tsx | TAK | Thrower (10) |
| tests/components/SuperAdmin/AIModules.test.tsx | TAK | AIModules (14) |
| tests/components/SuperAdmin/BackupConfigPanel.test.tsx | TAK | BackupConfigPanel (14) |
| tests/components/SuperAdmin/BillingOverviewPanel.test.tsx | TAK | BillingOverviewPanel (14) |
| tests/components/SuperAdmin/ConfigurationModule.test.tsx | TAK | ConfigurationModule (14) |
| tests/components/SuperAdmin/ContentModule.test.tsx | TAK | ContentModule (14) |
| tests/components/SuperAdmin/DataExportPanel.test.tsx | TAK | DataExportPanel (14) |
| tests/components/SuperAdmin/EmailConfigurationPanel.test.tsx | TAK | EmailConfigurationPanel (14) |
| tests/components/SuperAdmin/IPAccessRulesPanel.test.tsx | TAK | IPAccessRulesPanel (14) |
| tests/components/SuperAdmin/InvoicesPanel.test.tsx | TAK | InvoicesPanel (14) |
| tests/components/SuperAdmin/PlaybookTemplateComments.test.tsx | TAK | PlaybookTemplateComments (14) |
| tests/components/SuperAdmin/SecurityModule.test.tsx | TAK | SecurityModule (14) |
| tests/components/SuperAdmin/SecurityPoliciesPanel.test.tsx | TAK | SecurityPoliciesPanel (14) |
| tests/components/SuperAdmin/SessionManagementPanel.test.tsx | TAK | SessionManagementPanel (14) |
| tests/components/SuperAdmin/SubscriptionsPanel.test.tsx | TAK | SubscriptionsPanel (14) |
| tests/components/SuperAdmin/SuperAdminDashboard.test.tsx | TAK | SuperAdminDashboard (14) |
| tests/components/SuperAdmin/SuperAdminMetricsView.test.tsx | TAK | SuperAdminMetricsView (14) |
| tests/components/SuperAdmin/SuperAdminOrgDetailsModal.test.tsx | TAK | SuperAdminOrgDetailsModal (14) |
| tests/components/SuperAdmin/SuperAdminSignalCenter.test.tsx | TAK | SuperAdminSignalCenter (14) |
| tests/components/SuperAdmin/SuperAdminView.test.tsx | TAK | SuperAdminView (14) |
| tests/components/SuperAdmin/SystemModule.test.tsx | TAK | SystemModule (14) |
| tests/components/SuperAdmin/WebhookDeliveriesModal.test.tsx | TAK | WebhookDeliveriesModal (14) |
| tests/components/ViewErrorBoundary.test.tsx | TAK | Thrower (11) |
| tests/components/assessment/AssessmentHub.five-surfaces-off.test.tsx | TAK | LocationProbe (67) |
| tests/components/assessment/AssessmentHub.five-surfaces.real-provider.test.tsx | TAK | LocationProbe (87) |
| tests/components/assessment/AssessmentHub.five-surfaces.test.tsx | TAK | LocationProbe (74) |
| tests/components/billing/AddCardModal.modalRegression.test.tsx | TAK | Harness (29) |
| tests/components/organization-route-role-gate.test.tsx | TAK | LocationProbe (79) |
| tests/components/partner/PartnerPortalView.route-alignment.test.tsx | TAK | LocationProbe (48) |
| tests/components/partner/PartnerPortalView.test.tsx | TAK | TestWrapper (54) |
| tests/components/partner/PartnerStartRouter.routing.test.tsx | TAK | OnboardingSurface (25) |
| tests/components/policy-context.superadmin-bypass.test.tsx | TAK | AccessPolicyProbe (37), TrialProbe (47) |
| tests/unit/components/Assessment/RolloutPlanTab.test.tsx | NIE | MockRolloutPlanTab (13) |
| tests/unit/components/Demo/DemoLoadingOverlay.test.tsx | NIE | MockDemoLoadingOverlay (13) |
| tests/unit/components/Demo/DemoUpgradePrompt.test.tsx | NIE | MockDemoUpgradePrompt (13) |
| tests/unit/components/Demo/DemoWelcomeTour.test.tsx | NIE | MockDemoWelcomeTour (13) |
| tests/unit/components/Demo/SmartDemoBanner.test.tsx | NIE | MockSmartDemoBanner (13) |
| tests/unit/components/Modal/ExitIntentModal.test.tsx | NIE | MockExitIntentModal (13) |
| tests/unit/components/Navigation/Sidebar.test.tsx | NIE | MockSidebar (13) |
| tests/unit/components/UI/Accordion.test.tsx | NIE | MockAccordion (13) |
| tests/unit/components/UI/Alert.test.tsx | NIE | MockAlert (13) |
| tests/unit/components/UI/Avatar.test.tsx | NIE | MockAvatar (13) |
| tests/unit/components/UI/Badge.test.tsx | NIE | MockBadge (13) |
| tests/unit/components/UI/Breadcrumb.test.tsx | NIE | MockBreadcrumb (13) |
| tests/unit/components/UI/Button.test.tsx | NIE | MockButton (13) |
| tests/unit/components/UI/Card.test.tsx | NIE | MockCard (13) |
| tests/unit/components/UI/Checkbox.test.tsx | NIE | MockCheckbox (13) |
| tests/unit/components/UI/Chip.test.tsx | NIE | MockChip (13) |
| tests/unit/components/UI/Collapse.test.tsx | NIE | MockCollapse (13) |
| tests/unit/components/UI/DataTable.test.tsx | NIE | MockDataTable (13) |
| tests/unit/components/UI/DatePicker.test.tsx | NIE | MockDatePicker (13) |
| tests/unit/components/UI/Divider.test.tsx | NIE | MockDivider (13) |
| tests/unit/components/UI/Drawer.test.tsx | NIE | MockDrawer (13) |
| tests/unit/components/UI/Dropdown.test.tsx | NIE | MockDropdown (13) |
| tests/unit/components/UI/EmptyState.test.tsx | NIE | MockEmptyState (13) |
| tests/unit/components/UI/FileUpload.test.tsx | NIE | MockFileUpload (13) |
| tests/unit/components/UI/FormControl.test.tsx | NIE | MockFormControl (13) |
| tests/unit/components/UI/Input.test.tsx | NIE | MockInput (13) |
| tests/unit/components/UI/Label.test.tsx | NIE | MockLabel (13) |
| tests/unit/components/UI/Modal.test.tsx | NIE | MockModal (13) |
| tests/unit/components/UI/Pagination.test.tsx | NIE | MockPagination (13) |
| tests/unit/components/UI/Popover.test.tsx | NIE | MockPopover (13) |
| tests/unit/components/UI/ProgressBar.test.tsx | NIE | MockProgressBar (13) |
| tests/unit/components/UI/Radio.test.tsx | NIE | MockRadio (13) |
| tests/unit/components/UI/RadioGroup.test.tsx | NIE | MockRadioGroup (13) |
| tests/unit/components/UI/Rating.test.tsx | NIE | MockRating (13) |
| tests/unit/components/UI/SearchInput.test.tsx | NIE | MockSearchInput (13) |
| tests/unit/components/UI/Select.test.tsx | NIE | MockSelect (13) |
| tests/unit/components/UI/Skeleton.test.tsx | NIE | MockSkeleton (13) |
| tests/unit/components/UI/Slider.test.tsx | NIE | MockSlider (13) |
| tests/unit/components/UI/Spinner.test.tsx | NIE | MockSpinner (13) |
| tests/unit/components/UI/Stepper.test.tsx | NIE | MockStepper (13) |
| tests/unit/components/UI/Switch.test.tsx | NIE | MockSwitch (13) |
| tests/unit/components/UI/Tabs.test.tsx | NIE | MockTabs (13) |
| tests/unit/components/UI/Textarea.test.tsx | NIE | MockTextarea (13) |
| tests/unit/components/UI/Timeline.test.tsx | NIE | MockTimeline (13) |
| tests/unit/components/UI/Toast.test.tsx | NIE | MockToast (13) |
| tests/unit/components/UI/Tooltip.test.tsx | NIE | MockTooltip (13) |
| tests/unit/deliverables/deckCompositionDataPath.test.ts | TAK | UNIFIED (63) |
| tests/unit/execution/raidDependencyService.test.ts | TAK | E (13) |
| tests/unit/hooks/usePageMeta.shell-titles.test.tsx | TAK | MetaHarness (11) |
| tests/unit/initiatives-execution/tableWithPreviewAccessibility.test.tsx | TAK | Harness (16) |
| tests/unit/initiatives-execution/tableWithPreviewMobileAccessibility.test.tsx | TAK | MobileHarness (11) |
| tests/unit/mywork/useIdeaConfidentialityGate.test.tsx | TAK | TestHarness (58) |
| tests/unit/naglowkiKolumnJezyk.test.ts | NIE | KLUCZ_NAGLOWKA (22) |

## Martwe od urodzenia — rodzina `_DB_PREFIX`

Pomiar literalny wykrył 37 plików (instrukcja/DEC mówi o 43; aktualny mianownik to wynik poniżej):

- `server/src/cron/__tests__/auditIndependenceDetectorSchedulerFlag.test.ts`
- `server/src/jobs/__tests__/adminIamAlertEvaluationJob.test.ts`
- `server/src/routes/audits/__tests__/mounting.integration.test.ts`
- `server/src/routes/v8/__tests__/financeIntelligence.membershipGate.pg.test.ts`
- `server/src/routes/v8/__tests__/financePlanning.membershipGate.pg.test.ts`
- `server/src/routes/v8/__tests__/financeValuation.membershipGate.pg.test.ts`
- `server/src/routes/v8/__tests__/financeValue.membershipGate.pg.test.ts`
- `server/src/services/__tests__/adminIamAlertEvaluator.pg.test.ts`
- `server/src/services/auditProgramRights/__tests__/auditPackRights.realdb.test.ts`
- `server/src/services/audits/__tests__/independenceScanCursor.realdb.test.ts`
- `server/src/services/finance/__tests__/financeDigitizationAnalysisCandidateHandoff.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/digitizationAnalysisArchiveCommandService.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/digitizationAnalysisFinancialsCommandService.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/digitizationAnalysisInitiativeLinkCommandService.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/digitizationAnalysisRegistrationService.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/digitizationAnalysisScenarioCommandService.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/digitizationAnalysisUpdateCommandService.pg.test.ts`
- `server/src/services/finance/canonical/__tests__/financeSettingsCommandService.pg.test.ts`
- `server/src/services/interviewCandidate/__tests__/interviewCandidateExactlyOnce.pg.test.ts`
- `server/src/services/results/__tests__/resultsWriterObservation.pg.test.ts`
- `server/src/services/results/__tests__/resultsWriterObservationMigration14.realdb.test.ts`
- `tests/acceptance/results-strict-membership.mounted.pg.test.ts`
- `tests/integration/ai/organizations-trial-tokens-used-migration.realpg.test.ts`
- `tests/integration/closure-evidence/meeting-notebook-evidence.realdb.test.ts`
- `tests/integration/crossflow/cf-00-closure-receipt-roi-binding.realdb.test.ts`
- `tests/integration/flow-transform-drd-source-adapter.realdb.test.ts`
- `tests/integration/flow-transform-four-source-lineage.realdb.test.ts`
- `tests/integration/partners/partner-economics-mounted-auth.realpg.test.ts`
- `tests/integration/partners/partner-economics-telemetry.realdb.test.ts`
- `tests/integration/partners/partner-owner-organization-binding.realdb.test.ts`
- `tests/integration/scripts/migrationRunnerStrict.realpg.test.ts`
- `tests/integration/settings/account-deletion-lifecycle.pg.test.ts`
- `tests/integration/settings/gdpr-settings-no-stubs.test.ts`
- `tests/integration/settings/settings-cold-session.realdb.test.ts`
- `tests/integration/tls-007-swot-candidate-handoff.realdb.test.ts`
- `tests/resultsVnext/roi/roiFinanceReconciliation.realdb.test.ts`
- `tests/resultsVnext/roi/roiRealdbOrgFixtureHelper.realdb.test.ts`

Nie uruchamiano CI i nie dowodzono dla każdego pliku, że odpowiadająca zmienna jest nieustawiona we wszystkich workflow; to twierdzenie pozostaje NIEZWERYFIKOWANE.

## Pominięte i dlaczego

- 0 plików pominiętych przez odczyt/parser.

## Twierdzenia niezweryfikowane

- Żaden kandydat nie ma klasy `PUSTY`, dopóki test nie przejdzie po celowanej mutacji funkcji produkcyjnej.
- Statyczny sygnał fetch/bazy nie dowodzi, że wywołanie jest osiągalne ani że globalna atrapa obsłużyła żądanie.
- Klasa `UZASADNIONY` opisuje zgodność nazwy z testem smoke, nie dowód zachowania produktu.

## R3/R4 — stan dowodów i wzmocnień

- 0 bloków sklasyfikowano jako `PUSTY`, ponieważ nie wykonano wymaganych 20 celowanych mutacji funkcji produkcyjnych.
- 20 bloków `SŁABY` i 1 `UZASADNIONY` pozostają do weryfikacji/wzmocnienia; nie zmieniono ich w `test.todo`, ponieważ Z35 jednocześnie zakazuje `.todo`.
- Nie skasowano ani nie osłabiono żadnego testu.

## Pięć twierdzeń DEC-2026-08-28-186

- Cztery wskazane pliki uruchomione razem z `--retry=0`: 35/35 przypadków PASS.
- Pięć dawniej czerwonych twierdzeń (clone-on-write, bulk revoke, DLP x2, incident create) jest obecnie zielonych na markerze; bez mutacji produktu nie stanowi to ponownego dowodu naprawy.
