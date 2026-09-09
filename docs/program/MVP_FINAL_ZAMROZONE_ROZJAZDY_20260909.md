# Rozjazdy: rejestr zamrożenia vs mapa przyrządu językowego (09.09.2026)

Paczka PORZĄDKI-1, ZADANIE B. Pełne porównanie dla każdego pliku `src/**/*.{ts,tsx}`
(4117 zbadanych, te same wykluczenia co przyrząd: `__tests__/`, `__mocks__/`, `.test.`
`.spec.`, `.stories.`, `dev-render/`, `scripts/`, `tests/`, `src/components/demo/`,
`src/data/demo`, `.d.ts` — `scripts/i18n/pomiar-jezyka.wyjatki.json` `pomijaneSciezki`).

Skrypt: `scripts/dev/porownanie-rejestr-przyrzad-20260909.mjs` (jednorazowy, powtarzalny —
nie zmienia przyrządu, importuje efemeryczną kopię `scripts/i18n/pomiar-jezyka.mjs`).

**Wynik: 794 rozjazdy, 0 duplikatów** (żaden plik nie był w dwóch modułach rejestru naraz).
Wszystkie 794 ZASTOSOWANO (`scripts/dev/rozszerz-rejestr-20260909.mjs`) — rejestr po zmianie
ma 0 rozjazdów względem przyrządu (zweryfikowane ponownym uruchomieniem porównania).

## Korespondencja nazw (nazwa-wg-przyrządu -> klucz rejestru)

Zweryfikowana empirycznie: dla każdego klucza rejestru policzono, jaki moduł-wg-przyrządu
mają jego pliki dzisiejsze — wygrywa zdecydowana większość (patrz commit).

| przyrząd (pomiar-jezyka.mjs) | rejestr (MVP_FINAL_ZAMROZONE.json) |
|---|---|
| 01 Chat | 13_CHAT |
| 02 My Work | 07_MY_WORK_AGENT |
| 03 Interview | 02_INTERVIEW |
| 04 Tools | 03_TOOLS |
| 05 Assessment | 04_ASSESSMENT |
| 06 Initiatives | 05_INITIATIVES |
| 07 Execution | 06_EXECUTION |
| 08 Results | (brak — moduł nie zamrożony) |
| 09 Finance | (brak — moduł nie zamrożony) |
| 10 Materials | 11_MATERIALS |
| 11 Audits | 12_AUDITS |
| 12 Meeting | 08_MEETINGS |
| 13 Organization | 01_ORGANIZATION |
| 14 Admin Panel | 14_ADMIN |
| 15 Settings | 15_SETTINGS |
| 16 Partner Portal | 16_PARTNER |
| ZZ wspólne | (brak — nie moduł, poza zakresem) |

## Grupy rozjazdów (aktualny modul rejestru -> oczekiwany wg przyrządu)

BRAK = plik nie był wymieniony w ŻADNYM module rejestru (zupełnie nowy wpis).
Pozostałe pary = plik BYŁ już zamrożony, ale pod złym kluczem (przeniesienie).

| aktualny (przed) | oczekiwany (po) wg przyrządu | liczba plików |
|---|---|---|
| BRAK | 14_ADMIN | 261 |
| BRAK | 11_MATERIALS | 236 |
| BRAK | 03_TOOLS | 43 |
| BRAK | 05_INITIATIVES | 40 |
| BRAK | 06_EXECUTION | 32 |
| BRAK | 15_SETTINGS | 31 |
| BRAK | 07_MY_WORK_AGENT | 29 |
| 04_ASSESSMENT | 11_MATERIALS | 23 |
| 04_ASSESSMENT | 03_TOOLS | 13 |
| 07_MY_WORK_AGENT | 15_SETTINGS | 12 |
| 11_MATERIALS | 03_TOOLS | 10 |
| 01_ORGANIZATION | 03_TOOLS | 10 |
| BRAK | 12_AUDITS | 9 |
| BRAK | 16_PARTNER | 9 |
| BRAK | 04_ASSESSMENT | 8 |
| BRAK | 13_CHAT | 7 |
| 06_EXECUTION | 11_MATERIALS | 5 |
| 07_MY_WORK_AGENT | 11_MATERIALS | 3 |
| BRAK | 08_MEETINGS | 3 |
| BRAK | 01_ORGANIZATION | 2 |
| 07_MY_WORK_AGENT | 06_EXECUTION | 2 |
| 01_ORGANIZATION | 05_INITIATIVES | 2 |
| BRAK | 02_INTERVIEW | 2 |
| 07_MY_WORK_AGENT | 14_ADMIN | 1 |
| 07_MY_WORK_AGENT | 16_PARTNER | 1 |

**Suma: 82 przeniesienia (plik już zamrożony, zły klucz) + 712 zupełnie nowych wpisów = 794.**

## STOP / ryzyko do rozliczenia z nadzorcą PRZED merge

712 z 794 zmian to pliki, które NIGDY nie były w rejestrze zamrożenia pod ŻADNYM modułem —
rozszerzenie mrozi je po raz pierwszy. Próbka dat ostatniego commita w największych grupach
(`BRAK -> 14_ADMIN` 261, `BRAK -> 11_MATERIALS` 236) pokazuje pliki dotykane W TRAKCIE tej
sesji (09.09), np. `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` (09.09),
`src/components/Reports/Premium/Editor/Toolbar/EditorToolbar.tsx` (09.09),
`src/components/SuperAdmin/FeatureFlagsPanel.tsx` (09.03) — czyli obszary z aktywną,
bieżącą pracą (prawdopodobnie „Program 7 rozbudów narzędzi” / Vegas). Po scaleniu tej gałęzi
KAŻDY kolejny commit dotykający tych plików będzie wymagał `[ODMROZENIE <MODUL> DEC-<numer>]`
— to zgodne z literalnym brzmieniem zlecenia („mapa przyrządu = prawda”, KAŻDA ścieżka), ale
ma natychmiastowy efekt operacyjny: zablokuje bez ostrzeżenia commity robotników/Codexów
pracujących dziś na Materiałach/Adminie na innych gałęziach, jeśli i kiedy ta gałąź zostanie
scalona do wspólnej bazy. Rekomendacja: nadzorca weryfikuje z właścicielem/aktywnymi sesjami
PRZED scaleniem — merge samego rejestru jest odwracalny (git revert na docs/), ale zaskoczenie
kogoś w środku pracy nie jest tanie do naprawienia w czasie.

Sprawdzone niezależnie: nawet grupa jawnie zgłoszona przez robotników jako bezpieczna
(`BRAK -> 16_PARTNER`, Trial/Subscriber) ma pliki dotknięte dziś o 01:17-01:34 — data
commita sama w sobie NIE odróżnia niezawodnie „bezpiecznego domknięcia” od „aktywnej pracy”.

## Pełne listy plików per grupa

### BRAK -> 14_ADMIN (261)

- `src/components/SuperAdmin/AlertPlaygroundTester.tsx`
- `src/components/SuperAdmin/AnalyticsPanel.tsx`
- `src/components/SuperAdmin/ApiManagementPanel.tsx`
- `src/components/SuperAdmin/BackupPanel.tsx`
- `src/components/SuperAdmin/BulkActions.tsx`
- `src/components/SuperAdmin/ConfigurationPanel.tsx`
- `src/components/SuperAdmin/ContentAnalyticsDashboard.tsx`
- `src/components/SuperAdmin/ContentCategoriesManager.tsx`
- `src/components/SuperAdmin/ContentFilters.tsx`
- `src/components/SuperAdmin/ContentSearch.tsx`
- `src/components/SuperAdmin/ContentTagsManager.tsx`
- `src/components/SuperAdmin/EmailConfigurationPanel.tsx`
- `src/components/SuperAdmin/EmailTemplateEditor.tsx`
- `src/components/SuperAdmin/EmailTemplatesPanel.tsx`
- `src/components/SuperAdmin/FeatureFlagsPanel.tsx`
- `src/components/SuperAdmin/IncidentRunbooksCard.tsx`
- `src/components/SuperAdmin/IntegrationsPanel.tsx`
- `src/components/SuperAdmin/LegalPanel.tsx`
- `src/components/SuperAdmin/ModelRegistry/ModelAuditLog.tsx`
- `src/components/SuperAdmin/ModelRegistry/ModelCatalogTable.tsx`
- `src/components/SuperAdmin/ModelRegistry/ModelRegistryHub.tsx`
- `src/components/SuperAdmin/ModelRegistry/PricingPanel.tsx`
- `src/components/SuperAdmin/ModelRegistry/PurposeAssignmentsEditor.tsx`
- `src/components/SuperAdmin/ModelRegistry/index.ts`
- `src/components/SuperAdmin/ModelRegistry/types.ts`
- `src/components/SuperAdmin/ModelTierAssignments.tsx`
- `src/components/SuperAdmin/OperationsHealthDrilldownPanel.tsx`
- `src/components/SuperAdmin/PartnerOutreachPanel.tsx`
- `src/components/SuperAdmin/PlaybookTemplateAnalytics.tsx`
- `src/components/SuperAdmin/PlaybookTemplateComments.tsx`
- `src/components/SuperAdmin/PlaybookTemplateReviews.tsx`
- `src/components/SuperAdmin/PlaybookTemplateVersionHistory.tsx`
- `src/components/SuperAdmin/ResourceLimitInput.tsx`
- `src/components/SuperAdmin/SecurityPanel.tsx`
- `src/components/SuperAdmin/SignalNode.tsx`
- `src/components/SuperAdmin/SubscriberTokenManagementPanel.tsx`
- `src/components/SuperAdmin/SuperAdminAISettings.tsx`
- `src/components/SuperAdmin/SuperAdminSignalCenter.tsx`
- `src/components/SuperAdmin/SuperAdminStatusIndicators.tsx`
- `src/components/SuperAdmin/SuperadminRootClosurePanel.tsx`
- `src/components/SuperAdmin/TabLayout.tsx`
- `src/components/SuperAdmin/UsageStatsPanel.tsx`
- `src/components/SuperAdmin/billing/BillingOverviewPanel.tsx`
- `src/components/SuperAdmin/billing/CreditNotesPanel.tsx`
- `src/components/SuperAdmin/billing/InvoicesPanel.tsx`
- `src/components/SuperAdmin/billing/SubscriptionsPanel.tsx`
- `src/components/SuperAdmin/billing/index.ts`
- `src/components/SuperAdmin/data/BackupConfigPanel.tsx`
- `src/components/SuperAdmin/data/DataExportPanel.tsx`
- `src/components/SuperAdmin/data/index.ts`
- `src/components/SuperAdmin/index.ts`
- `src/components/SuperAdmin/integrations/WebhookDeliveriesModal.tsx`
- `src/components/SuperAdmin/integrations/WebhooksPanel.tsx`
- `src/components/SuperAdmin/integrations/index.ts`
- `src/components/SuperAdmin/security/IPAccessRulesPanel.tsx`
- `src/components/SuperAdmin/security/LoginAttemptsPanel.tsx`
- `src/components/SuperAdmin/security/SecurityPoliciesPanel.tsx`
- `src/components/SuperAdmin/security/SessionManagementPanel.tsx`
- `src/components/SuperAdmin/security/index.ts`
- `src/components/SuperAdmin/system/EnterpriseAnalyticsPanel.tsx`
- `src/components/SuperAdmin/system/EnterpriseApiManagement.tsx`
- `src/components/SuperAdmin/system/EnterpriseAuditLog.tsx`
- `src/components/SuperAdmin/system/EnterpriseBackupPanel.tsx`
- `src/components/SuperAdmin/system/EnterpriseConfigurationPanel.tsx`
- `src/components/SuperAdmin/system/EnterpriseFeatureFlags.tsx`
- `src/components/SuperAdmin/system/EnterpriseHealthMonitor.tsx`
- `src/components/SuperAdmin/system/EnterpriseIntegrationsHub.tsx`
- `src/components/SuperAdmin/system/EnterpriseSecurityPanel.tsx`
- `src/components/SuperAdmin/system/index.ts`
- `src/components/billing/AddCardModal.tsx`
- `src/components/billing/BillingFeaturePending.tsx`
- `src/components/billing/CreditNotesPanel.tsx`
- `src/components/billing/InvoiceTemplateEditor.tsx`
- `src/components/billing/PaymentMethodsPanel.tsx`
- `src/components/billing/PlanCard.tsx`
- `src/components/billing/QuotaWarningBanner.tsx`
- `src/components/billing/SubscriptionAnalytics.tsx`
- `src/components/billing/SubscriptionManager.tsx`
- `src/components/billing/TaxSettingsForm.tsx`
- `src/components/billing/TaxSettingsPanel.tsx`
- `src/components/billing/UsageAlertsConfig.tsx`
- `src/components/billing/UsageMeters.tsx`
- `src/components/billing/index.ts`
- `src/views/SystemHealthDashboard.tsx`
- `src/views/superadmin/AIBudgetsView.tsx`
- `src/views/superadmin/AIConfigurationView.tsx`
- `src/views/superadmin/AIDevelopmentModule.tsx`
- `src/views/superadmin/AIInfrastructureModule.tsx`
- `src/views/superadmin/AIIntelligenceView.tsx`
- `src/views/superadmin/AIObservabilityDashboard.tsx`
- `src/views/superadmin/AIOperationsModule.tsx`
- `src/views/superadmin/AIPlatformModule.tsx`
- `src/views/superadmin/AIPlatformModule/AIPlatformModule.tsx`
- `src/views/superadmin/AIPlatformModule/Analytics/CostAnalyticsTab.tsx`
- `src/views/superadmin/AIPlatformModule/Analytics/CustomReportsTab.tsx`
- `src/views/superadmin/AIPlatformModule/Analytics/LLMObservatoryTab.tsx`
- `src/views/superadmin/AIPlatformModule/Analytics/PerformanceMetricsTab.tsx`
- `src/views/superadmin/AIPlatformModule/Analytics/PricingRegistryTab.tsx`
- `src/views/superadmin/AIPlatformModule/Analytics/UsageAnalyticsTab.tsx`
- `src/views/superadmin/AIPlatformModule/Analytics/index.ts`
- `src/views/superadmin/AIPlatformModule/Configuration/AIGovernanceTab.tsx`
- `src/views/superadmin/AIPlatformModule/Configuration/GlobalSettingsTab.tsx`
- `src/views/superadmin/AIPlatformModule/Configuration/LLMProvidersTab.tsx`
- `src/views/superadmin/AIPlatformModule/Configuration/ModelTiersTab.tsx`
- `src/views/superadmin/AIPlatformModule/Configuration/OrgAIPolicyTab.tsx`
- `src/views/superadmin/AIPlatformModule/Configuration/PurposeAssignmentsTab.tsx`
- `src/views/superadmin/AIPlatformModule/Configuration/RoutingRulesTab.tsx`
- `src/views/superadmin/AIPlatformModule/Configuration/index.ts`
- `src/views/superadmin/AIPlatformModule/Development/ExperimentsTab.tsx`
- `src/views/superadmin/AIPlatformModule/Development/ModelRegistryTab.tsx`
- `src/views/superadmin/AIPlatformModule/Development/PromptBuilderTab.tsx`
- `src/views/superadmin/AIPlatformModule/Development/PromptRegistryTab.tsx`
- `src/views/superadmin/AIPlatformModule/Development/PromptsLibraryTab.tsx`
- `src/views/superadmin/AIPlatformModule/Development/index.ts`
- `src/views/superadmin/AIPlatformModule/Executive/AIUseCaseControlPlane.tsx`
- `src/views/superadmin/AIPlatformModule/Knowledge/DocumentsRAGTab.tsx`
- `src/views/superadmin/AIPlatformModule/Knowledge/KnowledgeBaseTab.tsx`
- `src/views/superadmin/AIPlatformModule/Knowledge/StrategicDirectionsTab.tsx`
- `src/views/superadmin/AIPlatformModule/Knowledge/index.ts`
- `src/views/superadmin/AIPlatformModule/Operations/HealthMonitoringTab.tsx`
- `src/views/superadmin/AIPlatformModule/Operations/MarketInboxTab.tsx`
- `src/views/superadmin/AIPlatformModule/Operations/MissionControlTab.tsx`
- `src/views/superadmin/AIPlatformModule/Operations/PerformanceDashboardTab.tsx`
- `src/views/superadmin/AIPlatformModule/Operations/SLAManagementTab.tsx`
- `src/views/superadmin/AIPlatformModule/Operations/index.ts`
- `src/views/superadmin/AIPlatformModule/Policy/PolicyEnforcementTab.tsx`
- `src/views/superadmin/AIPlatformModule/Security/APIKeysTab.tsx`
- `src/views/superadmin/AIPlatformModule/Security/AccessControlTab.tsx`
- `src/views/superadmin/AIPlatformModule/Security/AuditLogsTab.tsx`
- `src/views/superadmin/AIPlatformModule/Security/ComplianceTab.tsx`
- `src/views/superadmin/AIPlatformModule/Security/index.ts`
- `src/views/superadmin/AIPlatformModule/index.ts`
- `src/views/superadmin/APIManagementView.tsx`
- `src/views/superadmin/BillingCenterView.tsx`
- `src/views/superadmin/ComplianceCenterView.tsx`
- `src/views/superadmin/ConfigurationModule.tsx`
- `src/views/superadmin/ContentModule.tsx`
- `src/views/superadmin/CustomRolesBuilder.tsx`
- `src/views/superadmin/CustomersModule.tsx`
- `src/views/superadmin/EmailTemplatesView.tsx`
- `src/views/superadmin/FeatureUpdatesAdminView.tsx`
- `src/views/superadmin/GlobalSecurityPostureView.tsx`
- `src/views/superadmin/GovernanceModule.tsx`
- `src/views/superadmin/InvoiceCenterView.tsx`
- `src/views/superadmin/LLMManagementView.tsx`
- `src/views/superadmin/ModuleAccessControlView.tsx`
- `src/views/superadmin/ModuleWaitlistView.tsx`
- `src/views/superadmin/OrganizationResourceManager.tsx`
- `src/views/superadmin/OrganizationsView.tsx`
- `src/views/superadmin/OverviewModule.tsx`
- `src/views/superadmin/PlatformOperationsView.tsx`
- `src/views/superadmin/PlaybookEditorView.tsx`
- `src/views/superadmin/PlaybookTemplatesListView.tsx`
- `src/views/superadmin/PresentationBenchmarkTrendView.tsx`
- `src/views/superadmin/PresentationGovernanceAlertSubscriptionsView.tsx`
- `src/views/superadmin/PresentationGovernanceWatchlistView.tsx`
- `src/views/superadmin/PresentationOperationsHealthView.tsx`
- `src/views/superadmin/PresentationTelemetryView.tsx`
- `src/views/superadmin/PresentationTemplateGovernanceView.tsx`
- `src/views/superadmin/RevenueModule.tsx`
- `src/views/superadmin/SCIMProvisioningView.tsx`
- `src/views/superadmin/SSOConfigurationView.tsx`
- `src/views/superadmin/SecurityModule.tsx`
- `src/views/superadmin/SecurityPoliciesView.tsx`
- `src/views/superadmin/SubscriptionPlansManager.tsx`
- `src/views/superadmin/SuperAdminAIAnalyticsView.tsx`
- `src/views/superadmin/SuperAdminAccessRequestsView.tsx`
- `src/views/superadmin/SuperAdminDashboard.tsx`
- `src/views/superadmin/SuperAdminFeedbackAnalyticsView.tsx`
- `src/views/superadmin/SuperAdminFeedbackBacklogView.tsx`
- `src/views/superadmin/SuperAdminFeedbackView.tsx`
- `src/views/superadmin/SuperAdminLegalView.tsx`
- `src/views/superadmin/SuperAdminMetricsView.tsx`
- `src/views/superadmin/SuperAdminOrgDetailsModal.tsx`
- `src/views/superadmin/SuperAdminPlansView.tsx`
- `src/views/superadmin/SuperAdminRevenueView.tsx`
- `src/views/superadmin/SuperAdminSignalsView.tsx`
- `src/views/superadmin/SuperAdminStorageDetailModal.tsx`
- `src/views/superadmin/SuperAdminUserManagement.tsx`
- `src/views/superadmin/SuperAdminView.tsx`
- `src/views/superadmin/SystemModule.tsx`
- `src/views/superadmin/SystemSettings.tsx`
- `src/views/superadmin/TenantCommandCenterView.tsx`
- `src/views/superadmin/VirtualWorkersModule/ConversationBrowser.tsx`
- `src/views/superadmin/VirtualWorkersModule/EvaluationsPanel.tsx`
- `src/views/superadmin/VirtualWorkersModule/InsightsPanel.tsx`
- `src/views/superadmin/VirtualWorkersModule/KnowledgeAssignmentPanel.tsx`
- `src/views/superadmin/VirtualWorkersModule/ReleasePanel.tsx`
- `src/views/superadmin/VirtualWorkersModule/WorkerAnalyticsDashboard.tsx`
- `src/views/superadmin/VirtualWorkersModule/WorkerDetail.tsx`
- `src/views/superadmin/VirtualWorkersModule/WorkerPreviewPanel.tsx`
- `src/views/superadmin/VirtualWorkersModule/WorkerProfileEditor.tsx`
- `src/views/superadmin/VirtualWorkersModule/WorkersList.tsx`
- `src/views/superadmin/VirtualWorkersModule/index.tsx`
- `src/views/superadmin/WhitelabelStudioView.tsx`
- `src/views/superadmin/analytics/AnalyticsModuleView.tsx`
- `src/views/superadmin/analytics/BusinessMetricsView.tsx`
- `src/views/superadmin/analytics/DashboardBuilderView.tsx`
- `src/views/superadmin/analytics/DemoTrialAnalyticsView.tsx`
- `src/views/superadmin/analytics/PredictiveAnalyticsView.tsx`
- `src/views/superadmin/analytics/SavedReportsView.tsx`
- `src/views/superadmin/analytics/index.ts`
- `src/views/superadmin/components/ABTestingDashboard.tsx`
- `src/views/superadmin/components/AI/AICoreRuntimePanel.tsx`
- `src/views/superadmin/components/AI/PromptOsRuntimeSummaryPanel.tsx`
- `src/views/superadmin/components/AI/UsageAnalyticsDashboard.tsx`
- `src/views/superadmin/components/AICostDashboard.tsx`
- `src/views/superadmin/components/AIPerformanceDashboard.tsx`
- `src/views/superadmin/components/AdminKnowledgeView.tsx`
- `src/views/superadmin/components/BulkOperationsView.tsx`
- `src/views/superadmin/components/LLMHealthPanel.tsx`
- `src/views/superadmin/components/PromptAssistantPanel.tsx`
- `src/views/superadmin/components/PromptBlockBuilder.tsx`
- `src/views/superadmin/components/PromptManagementUI.tsx`
- `src/views/superadmin/components/PromptTestBench.tsx`
- `src/views/superadmin/components/SLADashboard.tsx`
- `src/views/superadmin/components/UserAssignmentsPanel.tsx`
- `src/views/superadmin/components/V8AdminDiagnosticsPanel.tsx`
- `src/views/superadmin/components/shared/AdminTable.tsx`
- `src/views/superadmin/components/shared/Button.tsx`
- `src/views/superadmin/components/shared/Card.tsx`
- `src/views/superadmin/components/shared/MetricCard.tsx`
- `src/views/superadmin/components/shared/PageHeader.tsx`
- `src/views/superadmin/customers/ContractManagementView.tsx`
- `src/views/superadmin/customers/CustomerAnalyticsView.tsx`
- `src/views/superadmin/customers/CustomerAutomationView.tsx`
- `src/views/superadmin/customers/CustomerCommunicationView.tsx`
- `src/views/superadmin/customers/CustomerComplianceView.tsx`
- `src/views/superadmin/customers/CustomerLifecycleView.tsx`
- `src/views/superadmin/customers/CustomerSuccessPlaybooksView.tsx`
- `src/views/superadmin/customers/index.ts`
- `src/views/superadmin/iam/AdminAuditLogsView.tsx`
- `src/views/superadmin/iam/AdminSessionsView.tsx`
- `src/views/superadmin/iam/ApprovalWorkflowsView.tsx`
- `src/views/superadmin/iam/AuditEventsViewer.tsx`
- `src/views/superadmin/iam/DLPView.tsx`
- `src/views/superadmin/iam/IAMModuleView.tsx`
- `src/views/superadmin/iam/PermissionsMatrixView.tsx`
- `src/views/superadmin/iam/SecurityIncidentsView.tsx`
- `src/views/superadmin/iam/ThreatIntelligenceView.tsx`
- `src/views/superadmin/iam/index.ts`
- `src/views/superadmin/partners/PartnerProgramConfig.tsx`
- `src/views/superadmin/partners/index.ts`
- `src/views/superadmin/revenue/PartnerSettlementsView.tsx`
- `src/views/superadmin/revenue/PaymentMethodsView.tsx`
- `src/views/superadmin/revenue/PricingPlansAdvancedView.tsx`
- `src/views/superadmin/revenue/RevenueForecastView.tsx`
- `src/views/superadmin/revenue/RevenueModuleView.tsx`
- `src/views/superadmin/revenue/RevenueRecognitionView.tsx`
- `src/views/superadmin/revenue/SubscriptionChangesView.tsx`
- `src/views/superadmin/revenue/index.ts`
- `src/views/superadmin/security/DeviceManagementView.tsx`
- `src/views/superadmin/security/IPWhitelistView.tsx`
- `src/views/superadmin/security/MFAView.tsx`
- `src/views/superadmin/security/PasswordPolicyView.tsx`
- `src/views/superadmin/security/SecurityEventsView.tsx`
- `src/views/superadmin/security/SecurityModuleView.tsx`
- `src/views/superadmin/support/CustomerHealthView.tsx`
- `src/views/superadmin/support/CustomerSuccessNotesView.tsx`
- `src/views/superadmin/support/SupportModuleView.tsx`
- `src/views/superadmin/support/SupportTicketsView.tsx`

### BRAK -> 11_MATERIALS (236)

- `src/components/DocumentStudio/CommentThreadItem.tsx`
- `src/components/DocumentStudio/CreateTemplateFromArtifactModal.tsx`
- `src/components/DocumentStudio/DocumentCommentsPanel.tsx`
- `src/components/DocumentStudio/DocumentExportSuccessNote.tsx`
- `src/components/DocumentStudio/DocumentSchemaDiffView.tsx`
- `src/components/DocumentStudio/DocumentStudioAiEntryPanel.tsx`
- `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx`
- `src/components/DocumentStudio/DocumentStudioFileMenu.tsx`
- `src/components/DocumentStudio/DocumentStudioGeneratingPanel.tsx`
- `src/components/DocumentStudio/DocumentStudioIntakeForm.tsx`
- `src/components/DocumentStudio/DocumentStudioOutlinePanel.tsx`
- `src/components/DocumentStudio/DocumentStudioQaPanel.tsx`
- `src/components/DocumentStudio/DocumentStudioReportView.tsx`
- `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx`
- `src/components/DocumentStudio/DocumentStudioView.tsx`
- `src/components/DocumentStudio/DocumentUndoRedoControls.tsx`
- `src/components/DocumentStudio/api.ts`
- `src/components/DocumentStudio/blocks/DocChartBlock.tsx`
- `src/components/DocumentStudio/blocks/DocKpiStrip.tsx`
- `src/components/DocumentStudio/blocks/DocTableBlock.tsx`
- `src/components/DocumentStudio/blocks/docBlockContent.ts`
- `src/components/DocumentStudio/blocks/docChartPalette.ts`
- `src/components/DocumentStudio/blocks/index.ts`
- `src/components/DocumentStudio/diffText.ts`
- `src/components/DocumentStudio/documentArtifactCommands.ts`
- `src/components/DocumentStudio/documentDiffModel.ts`
- `src/components/DocumentStudio/editor/DocumentTipTapEditor.tsx`
- `src/components/DocumentStudio/editor/collapsedSectionsExtension.ts`
- `src/components/DocumentStudio/editor/documentEditorExtensions.ts`
- `src/components/DocumentStudio/editor/index.ts`
- `src/components/DocumentStudio/editor/nodeNames.ts`
- `src/components/DocumentStudio/editor/nodes/ChartNode.tsx`
- `src/components/DocumentStudio/editor/nodes/DocImageNode.tsx`
- `src/components/DocumentStudio/editor/nodes/DocSectionNode.tsx`
- `src/components/DocumentStudio/editor/nodes/KpiStripNode.tsx`
- `src/components/DocumentStudio/editor/nodes/QuoteNode.tsx`
- `src/components/DocumentStudio/editor/nodes/payloadAttrs.ts`
- `src/components/DocumentStudio/editor/schemaToTipTap.ts`
- `src/components/DocumentStudio/editor/tipTapToSchema.ts`
- `src/components/DocumentStudio/editor/useManualPrompt.tsx`
- `src/components/DocumentStudio/inline-ai/DocumentInlineAIMenu.tsx`
- `src/components/DocumentStudio/inline-ai/index.ts`
- `src/components/DocumentStudio/inline-ai/useDocumentInlineAI.ts`
- `src/components/DocumentStudio/intakeGate.ts`
- `src/components/DocumentStudio/publicReader/ReaderBlockRenderer.tsx`
- `src/components/DocumentStudio/publicReader/ReaderCommentsPanel.tsx`
- `src/components/DocumentStudio/publicReader/SharedDocumentReaderPage.tsx`
- `src/components/DocumentStudio/publicReader/clientReaderApi.ts`
- `src/components/DocumentStudio/templateStructureOps.ts`
- `src/components/FullReportDocument.tsx`
- `src/components/PresentationStudio/PresentationStudioLayoutAuditBanner.tsx`
- `src/components/PresentationStudio/PresentationStudioLayoutCapacityAdminPanel.tsx`
- `src/components/PresentationStudio/PresentationStudioPage.tsx`
- `src/components/PresentationStudio/PresentationStudioSetupForm.tsx`
- `src/components/PresentationStudio/PresentationStudioSourceArtifactPicker.tsx`
- `src/components/Presentations/BrandKitSettings.tsx`
- `src/components/Presentations/DeckBuilder/AgentActivityPanel.tsx`
- `src/components/Presentations/DeckBuilder/AgentPanel.tsx`
- `src/components/Presentations/DeckBuilder/AnimatedBlock.tsx`
- `src/components/Presentations/DeckBuilder/BlockToolbar.tsx`
- `src/components/Presentations/DeckBuilder/CardCanvas.tsx`
- `src/components/Presentations/DeckBuilder/CardFloatingToolbar.tsx`
- `src/components/Presentations/DeckBuilder/CardRenderer.tsx`
- `src/components/Presentations/DeckBuilder/CommandPalette.tsx`
- `src/components/Presentations/DeckBuilder/ConflictBanner.tsx`
- `src/components/Presentations/DeckBuilder/DeckAuditLogModal.tsx`
- `src/components/Presentations/DeckBuilder/DeckBuilder.tsx`
- `src/components/Presentations/DeckBuilder/DeckBuilderBottomBar.tsx`
- `src/components/Presentations/DeckBuilder/DeckBuilderMelsChips.tsx`
- `src/components/Presentations/DeckBuilder/DeckBuilderMelsRightRail.tsx`
- `src/components/Presentations/DeckBuilder/DeckBuilderMelsView.tsx`
- `src/components/Presentations/DeckBuilder/DeckBuilderTopBar.tsx`
- `src/components/Presentations/DeckBuilder/DeckCommentsPanel.tsx`
- `src/components/Presentations/DeckBuilder/DeckGovernanceCardModal.tsx`
- `src/components/Presentations/DeckBuilder/DeckOverflowWarning.tsx`
- `src/components/Presentations/DeckBuilder/DeckPresenceStack.tsx`
- `src/components/Presentations/DeckBuilder/DeckQualityGatesPanel.tsx`
- `src/components/Presentations/DeckBuilder/DeckRelationsPanel.tsx`
- `src/components/Presentations/DeckBuilder/DeckThemeContext.tsx`
- `src/components/Presentations/DeckBuilder/EditCardPopup.tsx`
- `src/components/Presentations/DeckBuilder/EditableBlock.tsx`
- `src/components/Presentations/DeckBuilder/MediaLibraryBrowser.tsx`
- `src/components/Presentations/DeckBuilder/PresenceIndicators.tsx`
- `src/components/Presentations/DeckBuilder/PresentMode.tsx`
- `src/components/Presentations/DeckBuilder/PresentationReviewPanel.tsx`
- `src/components/Presentations/DeckBuilder/ShareAnalyticsPanel.tsx`
- `src/components/Presentations/DeckBuilder/ShareModal.tsx`
- `src/components/Presentations/DeckBuilder/SlideSorter.tsx`
- `src/components/Presentations/DeckBuilder/SourceTraceability.tsx`
- `src/components/Presentations/DeckBuilder/ThemeSwitcher.tsx`
- `src/components/Presentations/DeckBuilder/TipTapEditor.tsx`
- `src/components/Presentations/DeckBuilder/VersionHistoryPanel.tsx`
- `src/components/Presentations/DeckBuilder/blockOps.ts`
- `src/components/Presentations/DeckBuilder/blocks/ArtifactEmbedBlock.tsx`
- `src/components/Presentations/DeckBuilder/blocks/BulletListBlock.tsx`
- `src/components/Presentations/DeckBuilder/blocks/CalloutBlock.tsx`
- `src/components/Presentations/DeckBuilder/blocks/ChartBlock.tsx`
- `src/components/Presentations/DeckBuilder/blocks/DividerBlock.tsx`
- `src/components/Presentations/DeckBuilder/blocks/HeadingBlock.tsx`
- `src/components/Presentations/DeckBuilder/blocks/ImageBlock.tsx`
- `src/components/Presentations/DeckBuilder/blocks/KpiWidgetBlock.tsx`
- `src/components/Presentations/DeckBuilder/blocks/MetricStripBlock.tsx`
- `src/components/Presentations/DeckBuilder/blocks/ParagraphBlock.tsx`
- `src/components/Presentations/DeckBuilder/blocks/SmartDiagramBlock.tsx`
- `src/components/Presentations/DeckBuilder/blocks/SmartLayoutBlock.tsx`
- `src/components/Presentations/DeckBuilder/blocks/TableBlock.tsx`
- `src/components/Presentations/DeckBuilder/blocks/TimelineBlock.tsx`
- `src/components/Presentations/DeckBuilder/blocks/blockDensity.ts`
- `src/components/Presentations/DeckBuilder/blocks/deckChartAdapter.ts`
- `src/components/Presentations/DeckBuilder/deckCommentsApi.ts`
- `src/components/Presentations/DeckBuilder/deckData.ts`
- `src/components/Presentations/DeckBuilder/deckTextSanitizer.ts`
- `src/components/Presentations/DeckBuilder/geometryOps.ts`
- `src/components/Presentations/DeckBuilder/index.ts`
- `src/components/Presentations/DeckBuilder/layouts/LayoutEngine.ts`
- `src/components/Presentations/DeckBuilder/manualEditing.ts`
- `src/components/Presentations/DeckBuilder/metricStripEditor.ts`
- `src/components/Presentations/DeckBuilder/presentationApproval.ts`
- `src/components/Presentations/DeckBuilder/presentationArtifactCommands.ts`
- `src/components/Presentations/DeckBuilder/useCollaboration.ts`
- `src/components/Presentations/DeckBuilder/useDataRefresh.ts`
- `src/components/Presentations/DeckBuilder/useDeckAutosave.ts`
- `src/components/Presentations/DeckBuilder/useDeckState.ts`
- `src/components/Presentations/DeckBuilder/useVersionHistory.ts`
- `src/components/Presentations/PresentationWizard.tsx`
- `src/components/Presentations/SharedPresentationView.tsx`
- `src/components/Presentations/wizard/ColorSetGallery.tsx`
- `src/components/Presentations/wizard/GeneratingStep.tsx`
- `src/components/Presentations/wizard/ImageStyleSelector.tsx`
- `src/components/Presentations/wizard/OutlineStep.tsx`
- `src/components/Presentations/wizard/PresentationModeSelector.tsx`
- `src/components/Presentations/wizard/ResultStep.tsx`
- `src/components/Presentations/wizard/SetupStep.tsx`
- `src/components/Presentations/wizard/SourceStep.tsx`
- `src/components/Presentations/wizard/WizardShell.tsx`
- `src/components/Presentations/wizard/index.ts`
- `src/components/Presentations/wizard/types.ts`
- `src/components/ReportBuilder/BlockRenderer.tsx`
- `src/components/ReportBuilder/BlockTypesManager.tsx`
- `src/components/ReportBuilder/ReportEditor/BlockAIActions.tsx`
- `src/components/ReportBuilder/ReportEditor/BrandVoicePanel.tsx`
- `src/components/ReportBuilder/ReportEditor/CreateInitiativeModal.tsx`
- `src/components/ReportBuilder/ReportEditor/EntityLinksPanel.tsx`
- `src/components/ReportBuilder/ReportEditor/SourceTraceabilityPanel.tsx`
- `src/components/ReportBuilder/ReportsComposer.tsx`
- `src/components/ReportBuilder/ScheduleReportModal.tsx`
- `src/components/ReportBuilder/TemplatePickerModal.tsx`
- `src/components/ReportBuilder/TemplatesManager.tsx`
- `src/components/ReportBuilder/blocks/CalloutBlock.tsx`
- `src/components/ReportBuilder/blocks/TableBlock.tsx`
- `src/components/ReportBuilder/blocks/TextBlock.tsx`
- `src/components/ReportBuilder/index.ts`
- `src/components/ReportBuilder/libraryTemplateResolveClient.ts`
- `src/components/ReportBuilder/steps/ConfigureStructureStep.tsx`
- `src/components/ReportBuilder/steps/GenerateStep.tsx`
- `src/components/ReportBuilder/steps/IntentStep.tsx`
- `src/components/ReportBuilder/steps/OutlineProposalStep.tsx`
- `src/components/ReportBuilder/steps/ReviewEditStep.tsx`
- `src/components/ReportBuilder/steps/SourceSelectStep.tsx`
- `src/components/ReportBuilder/steps/UploadChaosStep.tsx`
- `src/components/ReportBuilder/visuals/AssessmentMatrix.tsx`
- `src/components/Reports/EmbeddedMatrix.tsx`
- `src/components/Reports/ExecutiveReport.tsx`
- `src/components/Reports/FinancialImpact.tsx`
- `src/components/Reports/GanttChart.tsx`
- `src/components/Reports/HeatmapMatrix.tsx`
- `src/components/Reports/ImportReportModal.tsx`
- `src/components/Reports/IndustryBenchmark.tsx`
- `src/components/Reports/InitiativesReportSection.tsx`
- `src/components/Reports/KeyTakeaways.tsx`
- `src/components/Reports/Management/ApprovalWorkflow.tsx`
- `src/components/Reports/Management/ExportControls.tsx`
- `src/components/Reports/Management/ManagementReportsView.tsx`
- `src/components/Reports/Management/PortfolioHealthReport.tsx`
- `src/components/Reports/Management/RaidReport.tsx`
- `src/components/Reports/Management/ReportComments.tsx`
- `src/components/Reports/Management/ReportGeneratorDrawer.tsx`
- `src/components/Reports/Management/ReportHistoryTable.tsx`
- `src/components/Reports/Management/ReportScheduleView.tsx`
- `src/components/Reports/Management/ReportTemplatesView.tsx`
- `src/components/Reports/Management/ReportTypeSelector.tsx`
- `src/components/Reports/Management/ReportingAutomationWorkspace.tsx`
- `src/components/Reports/Management/ReportsHub.tsx`
- `src/components/Reports/Management/SteeringCommitteeReport.tsx`
- `src/components/Reports/Management/TeamMeetingReport.tsx`
- `src/components/Reports/Management/VersionHistory.tsx`
- `src/components/Reports/Management/index.ts`
- `src/components/Reports/Management/shared/DecisionsRequiredSection.tsx`
- `src/components/Reports/Management/shared/MetricCard.tsx`
- `src/components/Reports/Management/shared/RAGIndicator.tsx`
- `src/components/Reports/Management/shared/ReportFooter.tsx`
- `src/components/Reports/Management/shared/ReportHeader.tsx`
- `src/components/Reports/Management/shared/ReportSkeleton.tsx`
- `src/components/Reports/Management/shared/TaskListSection.tsx`
- `src/components/Reports/Management/shared/TrendIndicator.tsx`
- `src/components/Reports/Premium/Editor/Extensions/Callout.tsx`
- `src/components/Reports/Premium/Editor/Extensions/ExecutiveSummary.tsx`
- `src/components/Reports/Premium/Editor/Extensions/GapHeatmap.tsx`
- `src/components/Reports/Premium/Editor/Extensions/MaturityRadar.tsx`
- `src/components/Reports/Premium/Editor/Extensions/MetricCard.tsx`
- `src/components/Reports/Premium/Editor/Extensions/RecommendationCard.tsx`
- `src/components/Reports/Premium/Editor/Extensions/index.tsx`
- `src/components/Reports/Premium/Editor/PremiumReportEditor.tsx`
- `src/components/Reports/Premium/Editor/Toolbar/AIAssistantPanel.tsx`
- `src/components/Reports/Premium/Editor/Toolbar/BlockInsertMenu.tsx`
- `src/components/Reports/Premium/Editor/Toolbar/EditorToolbar.tsx`
- `src/components/Reports/Premium/index.ts`
- `src/components/Reports/ProgressRing.tsx`
- `src/components/Reports/RadarChart.tsx`
- `src/components/Reports/ReadingModeToggle.tsx`
- `src/components/Reports/ReportBuilder.tsx`
- `src/components/Reports/ReportCommentPanel.tsx`
- `src/components/Reports/ReportHeader.tsx`
- `src/components/Reports/ReportSection.tsx`
- `src/components/Reports/ReportsEntryRouter.tsx`
- `src/components/Reports/RichTextEditor.tsx`
- `src/components/Reports/RiskMatrix.tsx`
- `src/components/Reports/ShareModal.tsx`
- `src/components/Reports/SponsorReportView.tsx`
- `src/components/Reports/StickyNavigation.tsx`
- `src/components/Reports/TableOfContents.tsx`
- `src/components/Reports/index.ts`
- `src/components/documents/ContextAssetSelector.tsx`
- `src/views/PublicArtifactView.tsx`
- `src/views/ReportBuilderView.tsx`
- `src/views/docs/DocsApiReferenceView.tsx`
- `src/views/docs/DocsArticleView.tsx`
- `src/views/docs/DocsCategoryView.tsx`
- `src/views/docs/DocsChangelogView.tsx`
- `src/views/docs/DocsHomeView.tsx`
- `src/views/docs/DocsSearchView.tsx`
- `src/views/docs/DocsSecurityView.tsx`
- `src/views/reports/InitiativeExecutionReport.tsx`
- `src/views/reports/OrganizationOverviewReport.tsx`
- `src/views/reports/PublicReportBuilderView.tsx`
- `src/views/reports/PublicReportView.tsx`

### BRAK -> 03_TOOLS (43)

- `src/components/Knowledge/MediaUploader.tsx`
- `src/components/Megatrend/AIInsightsCard.tsx`
- `src/components/Megatrend/CustomTrendCard.tsx`
- `src/components/Megatrend/IndustryBaselineCard.tsx`
- `src/components/Megatrend/MegatrendsWorkspace.tsx`
- `src/components/Megatrend/TrendDetailCard.tsx`
- `src/components/Megatrend/TrendRadarCard.tsx`
- `src/components/PlaybookEditor/PlaybookCanvas.tsx`
- `src/components/PlaybookEditor/PlaybookNode.tsx`
- `src/components/PlaybookEditor/PlaybookPropertiesPanel.tsx`
- `src/components/PlaybookEditor/PlaybookToolbar.tsx`
- `src/components/PlaybookEditor/index.tsx`
- `src/components/Studio/StudioCanvas.tsx`
- `src/components/Studio/StudioChat.tsx`
- `src/components/Studio/StudioExportModal.tsx`
- `src/components/Studio/StudioLinkModal.tsx`
- `src/components/Studio/StudioSidebar.tsx`
- `src/components/Studio/StudioToolbar.tsx`
- `src/components/Studio/hooks/index.ts`
- `src/components/Studio/hooks/useStudioAI.tsx`
- `src/components/Studio/hooks/useStudioDocument.tsx`
- `src/components/Studio/index.ts`
- `src/components/Studio/nodes/DecisionNode.tsx`
- `src/components/Studio/nodes/MindmapNode.tsx`
- `src/components/Studio/nodes/OrgUnitNode.tsx`
- `src/components/Studio/nodes/ProcessStepNode.tsx`
- `src/components/Studio/nodes/RACICell.tsx`
- `src/components/Studio/nodes/StartEndNode.tsx`
- `src/components/Studio/nodes/SwimLaneNode.tsx`
- `src/components/Studio/nodes/TextNode.tsx`
- `src/components/Studio/nodes/index.ts`
- `src/components/TemplateBuilder/templateBuilderFields.tsx`
- `src/components/method-workspace/answerStateColors.ts`
- `src/components/method-workspace/index.ts`
- `src/views/KnowledgeBaseEntryView.tsx`
- `src/views/KnowledgeBaseView.tsx`
- `src/views/Module1ContextView.tsx`
- `src/views/StudioUnavailableView.tsx`
- `src/views/StudioView.tsx`
- `src/views/ToolsShowcasePage.tsx`
- `src/views/knowledge/KnowledgeBaseArticlePage.tsx`
- `src/views/knowledge/KnowledgeBaseCategoryPage.tsx`
- `src/views/knowledge/KnowledgeBaseHomePage.tsx`

### BRAK -> 05_INITIATIVES (40)

- `src/components/InitiativeCard.tsx`
- `src/components/InitiativeDetailModal.tsx`
- `src/components/InitiativeIntelligenceTab.tsx`
- `src/components/InitiativeTaskBoard.tsx`
- `src/components/InitiativeTasksTab.tsx`
- `src/components/Initiatives/CapacityOptionsPanel.tsx`
- `src/components/Initiatives/Generator/GeneratorInicjatywModal.tsx`
- `src/components/Initiatives/Generator/GeneratorPlanuModal.tsx`
- `src/components/Initiatives/Generator/adapters/assessment.ts`
- `src/components/Initiatives/Generator/adapters/audit.ts`
- `src/components/Initiatives/Generator/adapters/interview.ts`
- `src/components/Initiatives/Generator/adapters/tool.ts`
- `src/components/Initiatives/Generator/types.ts`
- `src/components/Initiatives/Menu2PresetDropdown.tsx`
- `src/components/Initiatives/cards/CapacityAnalysisCard.tsx`
- `src/components/Initiatives/cards/PlanCard.tsx`
- `src/components/Initiatives/cards/PlanRoleDemandEditor.tsx`
- `src/components/Initiatives/initiativeOriginSubresources.ts`
- `src/components/Initiatives/lifecycle/InitiativeLifecycleActions.tsx`
- `src/components/Initiatives/lifecycle/InitiativeReasonDialog.tsx`
- `src/components/Initiatives/lifecycle/initiativeLifecycleMessages.ts`
- `src/components/Initiatives/lifecycle/useInitiativeLifecycle.ts`
- `src/components/Initiatives/planProposalReview.ts`
- `src/components/Initiatives/planSolverReason.ts`
- `src/components/Portfolio/InitiativeGridCard.tsx`
- `src/components/Portfolio/InitiativeSidePanel.tsx`
- `src/components/Portfolio/PortfolioAiPanel.tsx`
- `src/components/Portfolio/PortfolioListView.tsx`
- `src/components/Portfolio/PortfolioMatrixView.tsx`
- `src/components/Portfolio/PortfolioTimelineView.tsx`
- `src/components/Portfolio/index.ts`
- `src/components/RebalanceModal.tsx`
- `src/components/RoadmapCapacityHeatmap.tsx`
- `src/components/RoadmapGantt.tsx`
- `src/components/RoadmapKanban.tsx`
- `src/components/RoadmapSummary.tsx`
- `src/views/FullInitiativesView.tsx`
- `src/views/FullRoadmapView.tsx`
- `src/views/InitiativeManagementView.tsx`
- `src/views/PortfolioView.tsx`

### BRAK -> 06_EXECUTION (32)

- `src/components/Execution/ExecutionActionCards.tsx`
- `src/components/Execution/ExecutionReportDocument.tsx`
- `src/components/Execution/delaySignals.ts`
- `src/components/Execution/executionRealData.ts`
- `src/components/Execution/executionReportModel.ts`
- `src/components/Execution/raidGovernance.ts`
- `src/components/FullPilotWorkspace.tsx`
- `src/components/PMO/AuditTrailViewer.tsx`
- `src/components/PMO/CharterBuilder.tsx`
- `src/components/PMO/GateStatus.tsx`
- `src/components/PMO/InitiativeCompletenessChecker.tsx`
- `src/components/PMO/PMODashboard.tsx`
- `src/components/PMO/PMOHealthSection.tsx`
- `src/components/PMO/PMOStatusBar.tsx`
- `src/components/PMO/PMOSystemMessages.tsx`
- `src/components/PMO/PhaseIndicator.tsx`
- `src/components/PMO/ProjectTeamPanel.tsx`
- `src/components/PMO/RACIMatrix.tsx`
- `src/components/PMO/StatusTransitionDropdown.tsx`
- `src/components/PMO/WorkstreamBoard.tsx`
- `src/components/PMO/index.ts`
- `src/components/Projects/PMORoleSelector.tsx`
- `src/components/Projects/ProjectTeamBoard.tsx`
- `src/components/RolloutStrategyTab.tsx`
- `src/components/RolloutTeamsTab.tsx`
- `src/components/TaskCard.tsx`
- `src/components/TaskDetailModal.tsx`
- `src/components/Team/MultiPerspectiveView.tsx`
- `src/components/WorkloadChart.tsx`
- `src/views/FullExecutionView.tsx`
- `src/views/FullPilotView.tsx`
- `src/views/ProjectIntelligenceView.tsx`

### BRAK -> 15_SETTINGS (31)

- `src/components/AISettings/AuditLogViewer.tsx`
- `src/components/AISettings/ModelSelector.tsx`
- `src/components/AISettings/ProactivitySelector.tsx`
- `src/components/AISettings/SettingsCard.tsx`
- `src/components/AISettings/SettingsSlider.tsx`
- `src/components/AISettings/SettingsToggle.tsx`
- `src/components/AISettings/index.ts`
- `src/components/CookieConsentBanner.tsx`
- `src/components/Education/ToolVideoModal.tsx`
- `src/components/Gamification/AchievementsList.tsx`
- `src/components/Gamification/UserLevelBadge.tsx`
- `src/components/Help/DocumentationRenderer.tsx`
- `src/components/Help/FloatingHelpWidget.tsx`
- `src/components/Help/GlobalHelpSearch.tsx`
- `src/components/Help/HelpFeedbackWidget.tsx`
- `src/components/Help/MicroVideoHelpModal.tsx`
- `src/components/Help/MicroVideoHelpTrigger.tsx`
- `src/components/Help/OnboardingPlaybooksPanel.tsx`
- `src/components/Help/VideoPlayer.tsx`
- `src/components/Help/WhatsNewModal.tsx`
- `src/components/InviteUserModal.tsx`
- `src/components/Onboarding/EnterpriseOnboardingWizard.tsx`
- `src/components/Onboarding/FeatureSpotlight.tsx`
- `src/components/Onboarding/GoalSelector.tsx`
- `src/components/Onboarding/Tooltip.tsx`
- `src/components/Onboarding/TourProvider.tsx`
- `src/components/OnboardingTour.tsx`
- `src/views/AppIntroView.tsx`
- `src/views/ChangelogView.tsx`
- `src/views/OnboardingWizard.tsx`
- `src/views/WelcomeView.tsx`

### BRAK -> 07_MY_WORK_AGENT (29)

- `src/components/CaseWorkspace/CaseDetailScreen.tsx`
- `src/components/CaseWorkspace/CaseWorkspaceHub.tsx`
- `src/components/CaseWorkspace/CaseWorkspaceRoute.tsx`
- `src/components/CaseWorkspace/CasesListScreen.tsx`
- `src/components/CaseWorkspace/PlanGraphCanvas.tsx`
- `src/components/CaseWorkspace/PlanView.tsx`
- `src/components/CaseWorkspace/RealizacjaView.tsx`
- `src/components/CaseWorkspace/RezultatyView.tsx`
- `src/components/CaseWorkspace/api.ts`
- `src/components/CaseWorkspace/apiIntake.ts`
- `src/components/CaseWorkspace/apiLightStart.ts`
- `src/components/CaseWorkspace/apiResults.ts`
- `src/components/CaseWorkspace/caseWorkspaceFlag.ts`
- `src/components/CaseWorkspace/podglad/daneProbne.ts`
- `src/components/CaseWorkspace/podglad/main.tsx`
- `src/components/CaseWorkspace/types.ts`
- `src/components/CaseWorkspace/ui.tsx`
- `src/components/Journey/JourneyProgressBar.tsx`
- `src/components/Journey/MilestoneBadge.tsx`
- `src/components/MyWork/InboxActionCards.tsx`
- `src/components/MyWork/mojaPracaWidocznosc.ts`
- `src/components/MyWork/notebook/NotebookPageListRow.tsx`
- `src/components/MyWork/notebook/NotebookViewFilterSelect.tsx`
- `src/components/MyWork/notebook/notebookViewLensPredicates.ts`
- `src/components/MyWork/taskSectionVisibility.ts`
- `src/components/MyWork/tytulyKartMenu3.ts`
- `src/views/ActionProposalView.tsx`
- `src/views/AgentPlanView.tsx`
- `src/views/MyApprovalsView.tsx`

### 04_ASSESSMENT -> 11_MATERIALS (23)

- `src/components/ReportBuilder/ExportSharePanel.tsx`
- `src/components/ReportBuilder/QualityGatesPanel.tsx`
- `src/components/ReportBuilder/ReportAgentChat.tsx`
- `src/components/ReportBuilder/ReportEditor/BlockCard.tsx`
- `src/components/ReportBuilder/ReportEditor/BlockPalette.tsx`
- `src/components/ReportBuilder/ReportEditor/BlockSettingsPanel.tsx`
- `src/components/ReportBuilder/ReportEditor/BlockSettingsRegistry.tsx`
- `src/components/ReportBuilder/ReportEditor/ChapterNavigation.tsx`
- `src/components/ReportBuilder/ReportEditor/EscalationBanner.tsx`
- `src/components/ReportBuilder/ReportEditor/NarrativeEngineMetadata.tsx`
- `src/components/ReportBuilder/ReportEditor/ReportEditor.tsx`
- `src/components/ReportBuilder/ReportEditor/ReviewPanel.tsx`
- `src/components/ReportBuilder/ReportEditor/SettingsPanel.tsx`
- `src/components/ReportBuilder/ReportEditor/StaleDataBadge.tsx`
- `src/components/ReportBuilder/ReportEditor/index.ts`
- `src/components/ReportBuilder/blocks/ChartRenderer.tsx`
- `src/components/ReportBuilder/blocks/InitiativeCards.tsx`
- `src/components/ReportBuilder/blocks/KPICards.tsx`
- `src/components/ReportBuilder/blocks/MatrixHeatmap.tsx`
- `src/components/ReportBuilder/blocks/PrioritizationMatrix.tsx`
- `src/components/ReportBuilder/blocks/RoadmapTimeline.tsx`
- `src/components/ReportBuilder/blocks/SmartBlockRenderer.tsx`
- `src/components/ReportBuilder/useReportBuilder.ts`

### 04_ASSESSMENT -> 03_TOOLS (13)

- `src/components/method-workspace/AnswerStateControl.tsx`
- `src/components/method-workspace/InterviewFocusPanel.tsx`
- `src/components/method-workspace/LiveMatrix.tsx`
- `src/components/method-workspace/MethodNavigator.tsx`
- `src/components/method-workspace/MethodWorkspaceShell.tsx`
- `src/components/method-workspace/QuestionHelpDisclosure.tsx`
- `src/components/method-workspace/ResolutionCard.tsx`
- `src/components/method-workspace/SaveStateIndicator.tsx`
- `src/components/method-workspace/TeresaPreviewPanel.tsx`
- `src/components/method-workspace/VoiceAnswerChannel.tsx`
- `src/components/method-workspace/skipReasonCodes.ts`
- `src/components/method-workspace/types.ts`
- `src/components/method-workspace/useMethodWorkspaceSave.ts`

### 07_MY_WORK_AGENT -> 15_SETTINGS (12)

- `src/components/Help/FeatureUpdatesPanel.tsx`
- `src/components/Help/HelpDeepLinkListener.tsx`
- `src/components/Help/HelpSidePanel.tsx`
- `src/components/Help/HelpToggleButton.tsx`
- `src/components/Help/KnowledgeArticleView.tsx`
- `src/components/Help/KnowledgeLibrary.tsx`
- `src/components/Notifications/notificationContent.ts`
- `src/components/Onboarding/FirstRunOnboarding.tsx`
- `src/components/Onboarding/OnboardingFirstLoginCTA.tsx`
- `src/components/Onboarding/firstRunConfig.ts`
- `src/components/Onboarding/firstRunEvents.ts`
- `src/components/Onboarding/useFirstRunOnboarding.ts`

### 11_MATERIALS -> 03_TOOLS (10)

- `src/components/TemplateBuilder/TemplateBuilder.tsx`
- `src/components/TemplateBuilder/TemplateBuilderShell.tsx`
- `src/components/TemplateBuilder/TemplateCenterEditors.tsx`
- `src/components/TemplateBuilder/TemplateCreateWizard.tsx`
- `src/components/TemplateBuilder/TemplateRightPanel.tsx`
- `src/components/TemplateBuilder/TemplateStructureList.tsx`
- `src/components/TemplateBuilder/index.ts`
- `src/components/TemplateBuilder/templateBuilderApi.ts`
- `src/components/TemplateBuilder/templateBuilderFlags.ts`
- `src/components/TemplateBuilder/templateBuilderModel.ts`

### 01_ORGANIZATION -> 03_TOOLS (10)

- `src/views/ContextBuilder/modules/ChallengeMapModule.tsx`
- `src/views/ContextBuilder/modules/GoalsExpectationsModule.tsx`
- `src/views/ContextBuilder/modules/OrganizationProfileModule.tsx`
- `src/views/ContextBuilder/modules/StrategicSynthesisModule.tsx`
- `src/views/ContextBuilder/modules/SynthesisSummary.tsx`
- `src/views/ContextBuilder/modules/TransformationScenarios.tsx`
- `src/views/ContextBuilder/modules/organizationProfileTaxonomy.tsx`
- `src/views/ContextBuilder/shared/AITextArea.tsx`
- `src/views/ContextBuilder/shared/ContextDocUploader.tsx`
- `src/views/ContextBuilder/shared/DynamicList.tsx`

### BRAK -> 12_AUDITS (9)

- `src/components/Audit/method/GeneratorWnioskuAudytuModal.tsx`
- `src/components/Audit/method/NewAuditOutputModal.tsx`
- `src/components/Audit/method/NewAuditReportModal.tsx`
- `src/components/Audit/method/tabs/AuditConclusionsTab.tsx`
- `src/components/Audit/method/wnioski/projekcjaWnioskowAudytu.ts`
- `src/components/Audit/method/workspace/AuditActionCards.tsx`
- `src/views/AuditsShowcasePage.tsx`
- `src/views/DRDAuditReportView.tsx`
- `src/views/DRDMatrixPreview.tsx`

### BRAK -> 16_PARTNER (9)

- `src/components/Subscriber/SubscriberDashboardLayout.tsx`
- `src/components/Subscriber/SubscriberDispatchTable.tsx`
- `src/components/Subscriber/SubscriberHealthBadge.tsx`
- `src/components/Trial/TrialBanner.tsx`
- `src/components/Trial/TrialTransitionConfirmation.tsx`
- `src/views/BecomePartnerView.tsx`
- `src/views/PartnerApplicationView.tsx`
- `src/views/TrialEntryView.tsx`
- `src/views/subscriber/SubscriberDashboardPage.tsx`

### BRAK -> 04_ASSESSMENT (8)

- `src/components/assessment/assessmentOutputProjection.ts`
- `src/components/assessment/drd/drdNazwa.ts`
- `src/components/assessment/wnioski/GeneratorWnioskuModal.tsx`
- `src/components/assessment/wnioski/projekcjaWnioskow.ts`
- `src/components/assessment/wnioski/typyWierszaWnioskow.ts`
- `src/components/assessment/wnioski/wnioskiOcenyApi.ts`
- `src/views/FreeAssessmentView.tsx`
- `src/views/PublicMiniAssessmentView.tsx`

### BRAK -> 13_CHAT (7)

- `src/components/AIChat/TeresaDocumentProposalCard.tsx`
- `src/components/AIChat/canvasDocumentProposal.ts`
- `src/components/AIChat/czatWidocznosc.ts`
- `src/components/Chat/ChatActionButton.tsx`
- `src/components/Chat/ChatSmartSuggestions.tsx`
- `src/components/Chat/index.ts`
- `src/views/SharedConversationView.tsx`

### 06_EXECUTION -> 11_MATERIALS (5)

- `src/components/Reports/GeneratedReportView.tsx`
- `src/components/Reports/Wizard/ReportGeneratorWizard.tsx`
- `src/components/Reports/Wizard/index.ts`
- `src/components/Reports/Wizard/reportWizardTypes.ts`
- `src/components/Reports/reportContentGenerator.ts`

### 07_MY_WORK_AGENT -> 11_MATERIALS (3)

- `src/components/DocumentStudio/inline-ai/inlineActionPrompts.ts`
- `src/components/documents/DocumentSidePanel.tsx`
- `src/components/documents/DocumentToggleButton.tsx`

### BRAK -> 08_MEETINGS (3)

- `src/components/Meeting/MeetingsWave2Placeholder.tsx`
- `src/components/Meeting/meetingOperatorBriefI18n.ts`
- `src/views/PublicBookingView.tsx`

### BRAK -> 01_ORGANIZATION (2)

- `src/components/OrgSwitcher.tsx`
- `src/views/OrgSetupWizard.tsx`

### 07_MY_WORK_AGENT -> 06_EXECUTION (2)

- `src/components/PMO/PMOStatusBanner.tsx`
- `src/components/TaskDropdown.tsx`

### 01_ORGANIZATION -> 05_INITIATIVES (2)

- `src/components/Strategy/DeepDivePanel.tsx`
- `src/components/Strategy/ScenarioCard.tsx`

### BRAK -> 02_INTERVIEW (2)

- `src/components/Survey/SurveyShell.tsx`
- `src/views/PublicInterviewRespondentView.tsx`

### 07_MY_WORK_AGENT -> 14_ADMIN (1)

- `src/components/SystemHealth.tsx`

### 07_MY_WORK_AGENT -> 16_PARTNER (1)

- `src/components/Trial/TrialExpiredGate.tsx`

