import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import "../src/index.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import PanelUwag from "./PanelUwag";
const PrototypeHarness = ({ context, legacy }) => {
  void context;
  return /* @__PURE__ */ jsx(Fragment, { children: legacy });
};
const Day237SpotkaniaScreen = React.lazy(() => import("./screens/day237-spotkania"));
const Day235MaterialyDokumentyScreen = React.lazy(
  () => import("./screens/day235-materialy-dokumenty")
);
const Day235MaterialyPrezentacjeScreen = React.lazy(
  () => import("./screens/day235-materialy-prezentacje")
);
const Day235MaterialyExceleScreen = React.lazy(
  () => import("./screens/day235-materialy-excele")
);
const Day238UstawieniaScreen = React.lazy(() => import("./screens/day238-ustawienia"));
const Day235MaterialyArchitektSzablonowScreen = React.lazy(
  () => import("./screens/day235-materialy-architekt-szablonow")
);
const IdeaFinancialCasePersistenceScreen = React.lazy(
  () => import("./screens/idea-financial-case-persistence")
);
const MaterialyLauncherScreen = React.lazy(() => import("./screens/materialy-launcher"));
const MaterialyTemplateLibrarySliceScreen = React.lazy(
  () => import("./screens/materialy-template-library-slice")
);
const MaterialyDraftTemplateVisibilityFixScreen = React.lazy(
  () => import("./screens/materialy-draft-template-visibledraft-fix")
);
const DocumentStudioTemplateResolveErrorScreen = React.lazy(
  () => import("./screens/document-studio-template-resolve-error")
);
const PrezentacjeTemplateStatesScreen = React.lazy(
  () => import("./screens/prezentacje-template-states")
);
const ReportBuilderLibraryTemplateScreen = React.lazy(
  () => import("./screens/report-builder-library-template")
);
const MaterialsRegistryScreen = React.lazy(() => import("./screens/materials-registry"));
const AudytyDrdReportScreen = React.lazy(() => import("./screens/audyty-drd-report"));
const DocumentStudioContextChipScreen = React.lazy(
  () => import("./screens/document-studio-context-chip")
);
const DocumentStudioResumeErrorScreen = React.lazy(
  () => import("./screens/document-studio-resume-error")
);
const DocumentStudioAiTeresaScreen = React.lazy(
  () => import("./screens/document-studio-ai-teresa")
);
const DocumentStudioStreamingHonestyN3Screen = React.lazy(
  () => import("./screens/document-studio-streaming-honesty-n3")
);
const DocumentStudioMenuPlikuScreen = React.lazy(
  () => import("./screens/document-studio-menu-pliku")
);
const DocumentStudioSaveAsTemplateScreen = React.lazy(
  () => import("./screens/document-studio-save-as-template")
);
const MenuCanonSidebarCheckScreen = React.lazy(() => import("./screens/menu-canon-sidebar-check"));
const AngielskieResztkiI18nScreen = React.lazy(() => import("./screens/angielskie-resztki-i18n"));
const AssessmentQualityReviewPanelScreen = React.lazy(
  () => import("./screens/assessment-quality-review-panel")
);
const AssessmentPresentationViewScreen = React.lazy(
  () => import("./screens/assessment-presentation-view")
);
const PrawyPasJednaFormulaScreen = React.lazy(
  () => import("./screens/prawy-pas-jedna-formula")
);
import "./slowLocaleFetch";
import i18n from "../src/i18n";
import { useAppStore } from "../src/store/useAppStore";
const AccentSoftTokenFixScreen = React.lazy(() => import("./screens/accent-soft-token-fix"));
const UiFoundationFocus01EvidenceScreen = React.lazy(
  () => import("./screens/ui-foundation-focus-01-evidence")
);
const AdminCommandCenterPanelScreen = React.lazy(
  () => import("./screens/admin-command-center-panel")
);
const AdminAIControlCenterPanelScreen = React.lazy(
  () => import("./screens/admin-ai-control-center-panel")
);
const AdminSsoSelfServiceCardScreen = React.lazy(
  () => import("./screens/admin-sso-self-service-card")
);
const AdminSecurityScreen = React.lazy(() => import("./screens/admin-security"));
const AdminBillingScreen = React.lazy(() => import("./screens/admin-billing"));
const AdminTeamScreen = React.lazy(() => import("./screens/admin-team"));
const PartnerPortalScreen = React.lazy(() => import("./screens/partner-portal"));
const AdminAiScreen = React.lazy(() => import("./screens/admin-ai"));
const UstawieniaGrupyScreen = React.lazy(() => import("./screens/ustawienia-grupy"));
const OrgLegacyScreen = React.lazy(() => import("./screens/org-legacy"));
const AdminAuditScreen = React.lazy(() => import("./screens/admin-audit"));
const AdminHealthScreen = React.lazy(() => import("./screens/admin-health"));
const AdminCommandScreen = React.lazy(() => import("./screens/admin-command"));
const SuperadminPlatformOperationsDay15Screen = React.lazy(
  () => import("./screens/superadmin-platform-operations-day15")
);
const AgentPlanCanvasScreen = React.lazy(() => import("./screens/agent-plan-canvas"));
const Day207WriteProposalScreen = React.lazy(() => import("./screens/day207-write-proposal"));
const Day221AudytyWarsztatScreen = React.lazy(() => import("./screens/day221-audyty-warsztat"));
const Day220AudytyRejestrScreen = React.lazy(() => import("./screens/day220-audyty-rejestr"));
const AgentPlanViewScreen = React.lazy(() => import("./screens/agent-plan-view"));
const AgentHubScreen = React.lazy(() => import("./screens/agent-hub"));
const TabeleFala2PrzedPoScreen = React.lazy(() => import("./screens/tabele-fala2-przed-po"));
const MenuDlugiDomkniecieScreen = React.lazy(() => import("./screens/menu-dlugi-domkniecie"));
const AgentWarsztatScreen = React.lazy(() => import("./screens/agent-warsztat"));
const DrdLibraryEntryScreen = React.lazy(() => import("./screens/drd-library-entry"));
const InitiativeRecordScreen = React.lazy(() => import("./screens/initiative-record"));
const VaultSejfWnetrzeScreen = React.lazy(() => import("./screens/vault-sejf-wnetrze"));
const VaultFolderBlockProofScreen = React.lazy(() => import("./screens/vault-folder-block-proof"));
const MyWorkIdeaInspectorLekkiScreen = React.lazy(
  () => import("./screens/mywork-idea-inspector-lekki")
);
const MyWorkNotebookRailSpecAScreen = React.lazy(
  () => import("./screens/mywork-notebook-rail-speca")
);
const PrawyPasNotatnikSystemScreen = React.lazy(
  () => import("./screens/prawy-pas-notatnik-system")
);
const PrawyPasIdeaSystemScreen = React.lazy(() => import("./screens/prawy-pas-idea-system"));
const PrawyPasTabeleSystemScreen = React.lazy(() => import("./screens/prawy-pas-tabele-system"));
const PrawyPasPrezentacjeSystemScreen = React.lazy(
  () => import("./screens/prawy-pas-prezentacje-system")
);
const PrawyPasDeckBuilderSystemScreen = React.lazy(
  () => import("./screens/prawy-pas-deck-builder-system")
);
const CalendarSyncSettingsScreen = React.lazy(() => import("./screens/calendar-sync-settings"));
const NotebookQuickCaptureScreen = React.lazy(() => import("./screens/notebook-quick-capture"));
const AssessmentInitiativesPanelScreen = React.lazy(
  () => import("./screens/assessment-initiatives-panel")
);
const AssessmentInitiativesTableScreen = React.lazy(
  () => import("./screens/assessment-initiatives-table")
);
const AssessmentFiveSurfacesScreen = React.lazy(() => import("./screens/assessment-five-surfaces"));
const AssessmentManagePanelScreen = React.lazy(() => import("./screens/assessment-manage-panel"));
const AssessmentListScreen = React.lazy(() => import("./screens/assessment-list"));
const AssessmentMatrycaScreen = React.lazy(() => import("./screens/assessment-matryca"));
const StandardModuleBarChildrenScreen = React.lazy(
  () => import("./screens/standard-module-bar-children")
);
const AssessmentMenu3StatusChipsScreen = React.lazy(
  () => import("./screens/assessment-menu3-status-chips")
);
const AssessmentReportsPanelScreen = React.lazy(() => import("./screens/assessment-reports-panel"));
const AssessmentReportsTableScreen = React.lazy(() => import("./screens/assessment-reports-table"));
const AssessmentOutputReportScreen = React.lazy(() => import("./screens/assessment-output-report"));
const AssessmentReportContractScreen = React.lazy(
  () => import("./screens/assessment-report-contract")
);
const CanvasKebabRestructureScreen = React.lazy(() => import("./screens/canvas-kebab-restructure"));
const CanvasNewDocScreen = React.lazy(() => import("./screens/canvas-new-doc"));
const CanvasToolbarMdHistoryScreen = React.lazy(
  () => import("./screens/canvas-toolbar-md-history")
);
const CapabilityGateDemoScreen = React.lazy(() => import("./screens/capability-gate-demo"));
const ChatBladAiScreen = React.lazy(() => import("./screens/chat-blad-ai"));
const ChatSplitTeresaRightScreen = React.lazy(() => import("./screens/chat-split-teresa-right"));
const ChatToolStepsDay206Screen = React.lazy(() => import("./screens/chat-tool-steps-day206"));
const CrimsonMyWorkWave2Screen = React.lazy(() => import("./screens/crimson-mywork-wave2"));
const CrimsonWaveChromeScreen = React.lazy(
  () => import("./screens/crimson-wave-chrome-2026-07-26")
);
const DecisionRecordScreen = React.lazy(() => import("./screens/decision-record"));
const DocumentStudioBlocksI18nScreen = React.lazy(
  () => import("./screens/document-studio-blocks-i18n")
);
const ExceleEngineRevealScreen = React.lazy(() => import("./screens/excele-engine-reveal"));
const WordIntakeUseLlmDefaultScreen = React.lazy(
  () => import("./screens/word-intake-uselm-default")
);
const DocumentStudioM1SharePrimaryScreen = React.lazy(
  () => import("./screens/document-studio-m1-share-primary")
);
const DocumentStudioNowyDokumentMartweprzyciskiScreen = React.lazy(
  () => import("./screens/document-studio-nowy-dokument-martwe-przyciski")
);
const EvFootballFieldScreen = React.lazy(() => import("./screens/ev-football-field"));
const ToolsSwotLiveScreen = React.lazy(() => import("./screens/tools-swot-live"));
const ToolsSwotLibraryDetailScreen = React.lazy(() => import("./screens/tools-swot-library-detail"));
const ToolsSwotSessionWorkspaceScreen = React.lazy(() => import("./screens/tools-swot-session-workspace"));
const ToolsPortfolioPrioritySessionWorkspaceScreen = React.lazy(() => import("./screens/tools-portfolio-priority-session-workspace"));
const ToolsSesjaWyjscieScreen = React.lazy(() => import("./screens/tools-sesja-wyjscie"));
const ToolOutputsPanelScreen = React.lazy(() => import("./screens/tool-outputs-panel"));
const ToolsOutputsInsightsTabScreen = React.lazy(() => import("./screens/tools-outputs-insights-tab"));
const ChatSignalsFeedScreen = React.lazy(() => import("./screens/chat-signals-feed"));
const ExecSummaryOnelookScreen = React.lazy(() => import("./screens/exec-summary-onelook"));
const ExecutionReportDay11Screen = React.lazy(() => import("./screens/execution-report-day11"));
const ExecutionTabScreen = React.lazy(() => import("./screens/execution-tab"));
const FinanceValuePanelsScreen = React.lazy(() => import("./screens/finance-value-panels"));
const Day200FinancePanelsScreen = React.lazy(() => import("./screens/day200-finance-panels"));
const Day233FinanseRejestryScreen = React.lazy(
  () => import("./screens/day233-finanse-rejestry")
);
const Day233FinansePaneleScreen = React.lazy(() => import("./screens/day233-finanse-panele"));
const FinanceHubScreen = React.lazy(() => import("./screens/finance-hub"));
const FinanceModelWorkspaceScreen = React.lazy(() => import("./screens/finance-model-workspace"));
const FinanceWorkspaceBarScreen = React.lazy(() => import("./screens/finance-workspace-bar"));
const FinanceFocusModeScreen = React.lazy(() => import("./screens/finance-focus-mode"));
const FinanceStatementPackWorkspaceV2Screen = React.lazy(
  () => import("./screens/finance-statement-pack-workspace-v2")
);
const FinanceBaselineWorkspaceScreen = React.lazy(
  () => import("./screens/finance-baseline-workspace")
);
const FinancePredictionWorkspaceScreen = React.lazy(
  () => import("./screens/finance-prediction-workspace")
);
const FinanceIdBridgeScreen = React.lazy(() => import("./screens/finance-id-bridge"));
const FinanceAnalysisWorkspaceScreen = React.lazy(
  () => import("./screens/finance-analysis-workspace")
);
const FinanceValuationWorkspaceScreen = React.lazy(
  () => import("./screens/finance-valuation-workspace")
);
const FinanceLineageNavigatorScreen = React.lazy(
  () => import("./screens/finance-lineage-navigator")
);
const FinanceComparePanelScreen = React.lazy(() => import("./screens/finance-compare-panel"));
const FinanceCommentsPanelScreen = React.lazy(() => import("./screens/finance-comments-panel"));
const FinanceSavedViewsPanelScreen = React.lazy(
  () => import("./screens/finance-saved-views-panel")
);
const FinanceExportImportPanelScreen = React.lazy(
  () => import("./screens/finance-export-import-panel")
);
const GenDeckContentHintsScreen = React.lazy(() => import("./screens/gen-deck-content-hints"));
const GenExcelTemplatesTabScreen = React.lazy(() => import("./screens/gen-excel-templates-tab"));
const GenWordContentHintsScreen = React.lazy(() => import("./screens/gen-word-content-hints"));
const DeckQualityBadgeScreen = React.lazy(() => import("./screens/deck-quality-badge"));
const WordQualityBadgeScreen = React.lazy(() => import("./screens/word-quality-badge"));
const I18nFala1SmokeScreen = React.lazy(() => import("./screens/i18n-fala1-smoke"));
const IdeaConfidentialityControlScreen = React.lazy(
  () => import("./screens/idea-confidentiality-control")
);
const IdeaTemplatesCatalogScreen = React.lazy(() => import("./screens/idea-templates-catalog"));
const IdeasTeresaPanelScreen = React.lazy(() => import("./screens/ideas-teresa-panel"));
const MelsCanvasWorkspaceScreen = React.lazy(() => import("./screens/melscanvas-workspace"));
const MeetingsModuleScreen = React.lazy(() => import("./screens/meetings-module"));
const ProcessFlowCanvasScreen = React.lazy(() => import("./screens/processflow-canvas"));
const WhiteboardCanvasScreen = React.lazy(() => import("./screens/whiteboard-canvas"));
const IdeaTableTimelineStuckScreen = React.lazy(
  () => import("./screens/idea-table-timeline-stuck")
);
const WhiteboardWorkshopScreen = React.lazy(() => import("./screens/whiteboard-workshop"));
const B2TemplateGalleryScreen = React.lazy(() => import("./screens/b2-template-gallery"));
const MindmapI18nSmokeScreen = React.lazy(() => import("./screens/mindmap-i18n-smoke"));
const MmPpmMeasureScreen = React.lazy(() => import("./screens/mm-ppm-measure"));
const ModelCatalogTableScreen = React.lazy(() => import("./screens/model-catalog-table"));
const NavDeclutterSidebarScreen = React.lazy(() => import("./screens/navdeclutter-sidebar"));
const NotatnikCentrumMysliScreen = React.lazy(() => import("./screens/notatnik-centrum-mysli"));
const NotatnikOsieroconeGrafScreen = React.lazy(() => import("./screens/notatnik-osierocone-graf"));
const PartnerSettlementsViewScreen = React.lazy(() => import("./screens/partner-settlements-view"));
const PromptRegistryTabScreen = React.lazy(() => import("./screens/prompt-registry-tab"));
const PublicBookingWidgetScreen = React.lazy(() => import("./screens/public-booking-widget"));
const ReportBuilderBlockTypesScreen = React.lazy(
  () => import("./screens/report-builder-block-types")
);
const ReportBuilderTemplatesScreen = React.lazy(() => import("./screens/report-builder-templates"));
const RoseDangerTokenParityScreen = React.lazy(() => import("./screens/rose-danger-token-parity"));
const SettingsCrimsonNeutralizedScreen = React.lazy(
  () => import("./screens/settings-crimson-neutralized")
);
const StandardGridCardScreen = React.lazy(() => import("./screens/standard-grid-card"));
const StandardKanbanCardScreen = React.lazy(() => import("./screens/standard-kanban-card"));
const TemplateBuilderDeckScreen = React.lazy(() => import("./screens/template-builder-deck"));
const TemplateBuilderDocScreen = React.lazy(() => import("./screens/template-builder-doc"));
const TemplateBuilderTableScreen = React.lazy(() => import("./screens/template-builder-table"));
const TemplateCreateWizardScreen = React.lazy(() => import("./screens/template-create-wizard"));
const TemplateLibraryNewEntryScreen = React.lazy(
  () => import("./screens/template-library-new-entry")
);
const UnifiedCreateLauncherScreen = React.lazy(() => import("./screens/unified-create-launcher"));
const Wave3CreatorsCrimsonScreen = React.lazy(() => import("./screens/wave3-creators-crimson"));
const Wave4ChoicesCrimsonScreen = React.lazy(() => import("./screens/wave4-choices-crimson"));
const Wave5InternalCrimsonScreen = React.lazy(() => import("./screens/wave5-internal-crimson"));
const ZwornikProjectsScreen = React.lazy(() => import("./screens/zwornik-projects"));
const KartaToolScreen = React.lazy(() => import("./screens/karta-tool"));
const KartaInitiativeScreen = React.lazy(() => import("./screens/karta-initiative"));
const KartaInsightScreen = React.lazy(() => import("./screens/karta-insight"));
const KartaInterviewScreen = React.lazy(() => import("./screens/karta-interview"));
const InterviewProgressbar153Screen = React.lazy(
  () => import("./screens/interview-progressbar-153")
);
const InterviewPreviewCanonScreen = React.lazy(() => import("./screens/interview-preview-canon"));
const InterviewCreatorShellScreen = React.lazy(() => import("./screens/interview-creator-shell"));
const InterviewSessionsStatusScreen = React.lazy(
  () => import("./screens/interview-sessions-status")
);
const KartaDecisionScreen = React.lazy(() => import("./screens/karta-decision"));
const KartaNotificationScreen = React.lazy(() => import("./screens/karta-notification"));
const KartaTaskScreen = React.lazy(() => import("./screens/karta-task"));
const KartaTaskPelnaScreen = React.lazy(() => import("./screens/karta-task-pelna"));
const MyWorkInboxScreen = React.lazy(() => import("./screens/mywork-inbox"));
const MyWorkCalendarScreen = React.lazy(() => import("./screens/mywork-calendar"));
const MyWorkDecisionsScreen = React.lazy(() => import("./screens/mywork-decisions"));
const MyWorkTasksScreen = React.lazy(() => import("./screens/mywork-tasks"));
const ReportsHubManagementScreen = React.lazy(() => import("./screens/reports-hub-management"));
const PreviewZakladkiScreen = React.lazy(() => import("./screens/preview-4-zakladki"));
const IdeaTableToolKebabScreen = React.lazy(() => import("./screens/idea-table-tool-kebab"));
const IdeaTableRecordTemplatesScreen = React.lazy(
  () => import("./screens/idea-table-record-templates")
);
const IdeaTableToolEmptyFilterScreen = React.lazy(
  () => import("./screens/idea-table-tool-empty-filter")
);
const IdeaTableToolPasteScreen = React.lazy(() => import("./screens/idea-table-tool-paste"));
const IdeaTableToolSortFilterScreen = React.lazy(
  () => import("./screens/idea-table-tool-sortfilter")
);
const IdeaTableToolGroupingScreen = React.lazy(() => import("./screens/idea-table-tool-grouping"));
const IdeaTableScreen = React.lazy(() => import("./screens/idea-table"));
const IdeaTableProductionScreen = React.lazy(() => import("./screens/idea-table-production"));
const AuthLoginScreen = React.lazy(() => import("./screens/auth-login"));
const AuthRegisterScreen = React.lazy(() => import("./screens/auth-register"));
const AuthCodeEntryScreen = React.lazy(() => import("./screens/auth-code-entry"));
const AuthForgotPasswordScreen = React.lazy(() => import("./screens/auth-forgot-password"));
const AuthResetPasswordScreen = React.lazy(() => import("./screens/auth-reset-password"));
const AuthVerifyEmailScreen = React.lazy(() => import("./screens/auth-verify-email"));
const MindmapCanvasScreen = React.lazy(() => import("./screens/mindmap-canvas"));
const MyWorkIdeaTopBarScreen = React.lazy(() => import("./screens/mywork-idea-topbar"));
const TeresaConfirmChipScreen = React.lazy(() => import("./screens/teresa-confirm-chip"));
const ChatCrimsonSearchResearchScreen = React.lazy(
  () => import("./screens/chat-crimson-search-research")
);
const ChatCrimsonPrivateMessageScreen = React.lazy(
  () => import("./screens/chat-crimson-private-message")
);
const ChatCrimsonProjectMembersScreen = React.lazy(
  () => import("./screens/chat-crimson-project-members")
);
const ChatV8ArtifactRunSearchScreen = React.lazy(
  () => import("./screens/chat-v8-artifact-run-search")
);
const ChatMessageRequiredSurfacesScreen = React.lazy(
  () => import("./screens/chat-message-required-surfaces")
);
const TeresaChipySugestiiScreen = React.lazy(() => import("./screens/teresa-chipy-sugestii"));
const TeresaChipyPanelArtefaktuScreen = React.lazy(
  () => import("./screens/teresa-chipy-panel-artefaktu")
);
const DeckArtifactScreen = React.lazy(() => import("./screens/deck-artifact"));
const DocumentArtifactScreen = React.lazy(() => import("./screens/document-artifact"));
const ReportArtifactScreen = React.lazy(() => import("./screens/report-artifact"));
const InsightArtifactScreen = React.lazy(() => import("./screens/insight-artifact"));
const DrdEmbeddedMatrixAxisLevelsScreen = React.lazy(
  () => import("./screens/drd-embedded-matrix-axis-levels")
);
const DrdMacierzOcenyScreen = React.lazy(() => import("./screens/drd-macierz-oceny"));
const DrdMacierzObszaryPoziomyScreen = React.lazy(
  () => import("./screens/drd-macierz-obszary-poziomy")
);
const IdeasPreviewOverlayScreen = React.lazy(() => import("./screens/ideas-preview-overlay"));
const SheetArtifactScreen = React.lazy(() => import("./screens/sheet-artifact"));
const ExceleEdytowalnaSiatkaScreen = React.lazy(() => import("./screens/excele-edytowalna-siatka"));
const ExcelePrawyPanelStandardScreen = React.lazy(
  () => import("./screens/excele-prawy-panel-standard")
);
const NTypeAnalizujAiScreen = React.lazy(() => import("./screens/ntype-analizuj-ai"));
const Day214TeresaAdoptCardScreen = React.lazy(() => import("./screens/day214-teresa-adopt-card"));
const Day228ImageStyleFieldScreen = React.lazy(
  () => import("./screens/day228-image-style-field")
);
const Day231KonspektZWiedzyScreen = React.lazy(
  () => import("./screens/day231-konspekt-z-wiedzy")
);
const Day230PrzepelnienieScreen = React.lazy(() => import("./screens/day230-przepelnienie"));
const Day232AgentDeckuScreen = React.lazy(() => import("./screens/day232-agent-decku"));
const Day234WynikiRejestryScreen = React.lazy(
  () => import("./screens/day234-wyniki-rejestry")
);
const Day234WynikiNarzedziaScreen = React.lazy(
  () => import("./screens/day234-wyniki-narzedzia")
);
const AiosScreen = React.lazy(() => import("./screens/aios"));
const VaultScopeSelectorScreen = React.lazy(() => import("./screens/vault-scope-selector"));
const VaultSafesTableScreen = React.lazy(() => import("./screens/vault-safes-table"));
const ExceleReopenVerifyScreen = React.lazy(() => import("./screens/excele-reopen-verify"));
const ExceleJedenWidokRecentScreen = React.lazy(
  () => import("./screens/excele-jeden-widok-recent")
);
const ExceleJedenWidokMaterialyScreen = React.lazy(
  () => import("./screens/excele-jeden-widok-materialy")
);
const ExceleJedenWidokPustyScreen = React.lazy(() => import("./screens/excele-jeden-widok-pusty"));
const OdbiorScreen = React.lazy(() => import("./screens/odbior"));
const FabRailKebabScreen = React.lazy(() => import("./screens/fab-rail-kebab"));
const PrawyPanelSzynaIkonScreen = React.lazy(() => import("./screens/prawy-panel-szyna-ikon"));
const Exe002004UiAuditScreen = React.lazy(() => import("./screens/exe-002-004-ui-audit"));
const AudytyPiecPowierzchniScreen = React.lazy(() => import("./screens/audyty-piec-powierzchni"));
const OrgIdentityOperatingScreen = React.lazy(() => import("./screens/org-identity-operating"));
const Day236OrganizacjaScreen = React.lazy(() => import("./screens/day236-organizacja"));
const StagingFixesInitiativesI18nScreen = React.lazy(
  () => import("./screens/staging-fixes-initiatives-i18n")
);
const InicjatywyListaScreen = React.lazy(() => import("./screens/inicjatywy-lista"));
const CapacityAdvisorA3Screen = React.lazy(() => import("./screens/capacity-advisor-a3"));
const PlanScenarioD1Screen = React.lazy(() => import("./screens/plan-scenario-d1"));
const StagingFixesExecutionI18nScreen = React.lazy(
  () => import("./screens/staging-fixes-execution-i18n")
);
const AudytyWarsztatKryteriumScreen = React.lazy(
  () => import("./screens/audyty-warsztat-kryterium")
);
const AudytyRaportDokumentScreen = React.lazy(() => import("./screens/audyty-raport-dokument"));
const Mw007CalendarNarrowViewportScreen = React.lazy(
  () => import("./screens/mw-007-calendar-narrow-viewport")
);
const MethodWorkspaceScreen = React.lazy(() => import("./screens/method-workspace"));
const DrdHttpWorkspaceScreen = React.lazy(() => import("./screens/drd-http-workspace"));
const SiriWorkspaceScreen = React.lazy(() => import("./screens/siri-workspace"));
const SiriTierScreen = React.lazy(() => import("./screens/siri-tier"));
const AssessmentArtifactsRestartScreen = React.lazy(
  () => import("./screens/assessment-artifacts-restart")
);
const ResultsVNextRegistryShellScreen = React.lazy(
  () => import("./screens/results-vnext-registry-shell")
);
const ResultsVNextKpiRegistryScreen = React.lazy(
  () => import("./screens/results-vnext-kpi-registry")
);
const ResultsZestawieniaScreen = React.lazy(() => import("./screens/results-zestawienia"));
const ResultsVNextRoiRegistryScreen = React.lazy(
  () => import("./screens/results-vnext-roi-registry")
);
const ResultsVNextRoiModelScreen = React.lazy(() => import("./screens/results-vnext-roi-model"));
const ResultsVNextRoiFullToolScreen = React.lazy(
  () => import("./screens/results-vnext-roi-full-tool")
);
const RoiJednaKartaScreen = React.lazy(() => import("./screens/roi-jedna-karta"));
const WskaznikJednaKartaScreen = React.lazy(() => import("./screens/wskaznik-jedna-karta"));
const CelJednaKartaScreen = React.lazy(() => import("./screens/cel-jedna-karta"));
const ResultsVNextOkrRegistryScreen = React.lazy(
  () => import("./screens/results-vnext-okr-registry")
);
const ResultsVNextSearchRegistryScreen = React.lazy(
  () => import("./screens/results-vnext-search-registry")
);
const ResultsVNextOkrObjectivesScreen = React.lazy(
  () => import("./screens/results-vnext-okr-objectives")
);
const ResultsVNextOkrWorkspaceScreen = React.lazy(
  () => import("./screens/results-vnext-okr-workspace")
);
const ResultsVNextOkrAdminScreen = React.lazy(() => import("./screens/results-vnext-okr-admin"));
const ResultsVNextKpiScorecardsScreen = React.lazy(
  () => import("./screens/results-vnext-kpi-scorecards")
);
const ResultsVNextKpiToolScreen = React.lazy(() => import("./screens/results-vnext-kpi-tool"));
const ResultsVNextLegacyArchiveScreen = React.lazy(
  () => import("./screens/results-vnext-legacy-archive")
);
const ResultsVNextAttentionScreen = React.lazy(() => import("./screens/results-vnext-attention"));
const ResultsVNextRoiPirOutcomesScreen = React.lazy(
  () => import("./screens/results-vnext-roi-pir-outcomes")
);
const RnG3ClassLRecordShellScreen = React.lazy(
  () => import("./screens/rn-g3-class-l-record-shell")
);
const ResultsVNextTeresaKpiDeviationScreen = React.lazy(
  () => import("./screens/results-vnext-teresa-kpi-deviation")
);
const ResultsVNextTeresaOkrReflectionScreen = React.lazy(
  () => import("./screens/results-vnext-teresa-okr-reflection")
);
const ToolsSwotReportScreen = React.lazy(() => import("./screens/tools-swot-report"));
const ToolsSwotInitiativeProposalScreen = React.lazy(
  () => import("./screens/tools-swot-initiative-proposal")
);
const Day267MaterialyHubZrzutyScreen = React.lazy(
  () => import("./screens/day267-materialy-hub-zrzuty")
);
const SCREENS = {
  "day237-spotkania": {
    label: "Dy\u017Cur 237 \u2014 realne MeetingHub / MeetingObjectPage / Sidebar; &view=list|object|member-sidebar|member-direct &state=pending|rejected|approved",
    render: () => /* @__PURE__ */ jsx(Day237SpotkaniaScreen, {})
  },
  "day238-ustawienia": {
    label: "Dy\u017Cur 238 \u2014 REALNY SettingsSidebar + reprezentatywny panel ka\u017Cdej z 10 zmierzonych grup. &section=profile|regional|ai-behavior|notifications-overview|security-dashboard|connected-apps|data-controls|billing|theme|developer &role=OWNER|MEMBER &proof=restricted|allowed|owner",
    render: () => /* @__PURE__ */ jsx(Day238UstawieniaScreen, {})
  },
  "day235-materialy-dokumenty": {
    label: "Dy\u017Cur 235 \u2014 realny Document Studio; &view=registry pokazuje wsp\xF3lny rejestr Materia\u0142\xF3w",
    render: () => /* @__PURE__ */ jsx(Day235MaterialyDokumentyScreen, {})
  },
  "day235-materialy-prezentacje": {
    label: "Dy\u017Cur 235 \u2014 realny Deck Template Builder, cztery slajdy",
    render: () => /* @__PURE__ */ jsx(Day235MaterialyPrezentacjeScreen, {})
  },
  "day235-materialy-excele": {
    label: "Dy\u017Cur 235 \u2014 realny ExceleView z arkuszem formu\u0142owym NPV/IRR",
    render: () => /* @__PURE__ */ jsx(Day235MaterialyExceleScreen, {})
  },
  "day235-materialy-architekt-szablonow": {
    label: "Dy\u017Cur 235 \u2014 realny architekt szablon\xF3w Word: draft, approved, deprecated",
    render: () => /* @__PURE__ */ jsx(Day235MaterialyArchitektSzablonowScreen, {})
  },
  "angielskie-resztki-i18n": {
    label: 'I18N \u2014 REALNY <MonteCarloNpvPanel> (Driver -> Czynnik, ziarna Revenue/Cost -> Przychody/Koszty) + REALNY <EditableSpreadsheetGrid> z 250 wierszami (stopka rowCap: brakuj\u0105ce kimi.showingAllRows/showAllRows, showingRows k\u0142ama\u0142 "25"). &theme=light|dark &rows=<n>',
    render: () => /* @__PURE__ */ jsx(AngielskieResztkiI18nScreen, {})
  },
  "calendar-sync-settings": {
    label: '#24b \u2014 UI \u201EPo\u0142\u0105cz kalendarz" (Ustawienia \u2192 Calendar Sync). Mock provider\xF3w (Google po\u0142\u0105czony, Outlook/Apple do po\u0142\u0105czenia), zero Api/fetch.',
    render: () => /* @__PURE__ */ jsx(CalendarSyncSettingsScreen, {})
  },
  "notebook-quick-capture": {
    label: '#12a \u2014 REALNY <NotebookQuickCapture> (pasek szybkiego wrzucania w Notatniku). Wpisz tekst, aby zobaczy\u0107 przycisk \u201EWrzu\u0107" w stanie aktywnym.',
    render: () => /* @__PURE__ */ jsx(NotebookQuickCaptureScreen, {})
  },
  "meetings-module": {
    label: "MOD06 Meetings etap 2 \u2014 REALNY <MeetingHub> (lista) + <MeetingObjectPage> (Szczeg\xF3\u0142y/Protok\xF3\u0142/Decyzje). &view=list|object &tab=details|minutes|decisions",
    render: () => /* @__PURE__ */ jsx(MeetingsModuleScreen, {})
  },
  "org-identity-operating": {
    label: 'M01 Organizacja \u2014 REALNY <OrganizationView> z flag\u0105 orgRedesignV1 ON: ekran \u201ETo\u017Csamo\u015B\u0107 i model dzia\u0142ania" (11 ekran\xF3w w nawigacji, Menu 2/3 ze StandardModuleBar, prawy panel stanu). Dodaj &ff_org_redesign_v1=1 w URL.',
    render: () => /* @__PURE__ */ jsx(OrgIdentityOperatingScreen, {})
  },
  "day236-organizacja": {
    label: "DAY 236 Organizacja \u2014 REALNY <OrganizationView>, komplet 11 tras redesignu. &orgRoute=profile/identity-scale|profile/position-direction|goals/strategic-intent|goals/stakeholder-expectations|challenges/declared-challenges|challenges/root-causes|strategy/risks-opportunities|strategy/executive-brief|sources/claims-sources|sources/knowledge-graph|readiness/summary; &redesign=off dla legacy; &persona=member dla ograniczonej persony.",
    render: () => /* @__PURE__ */ jsx(Day236OrganizacjaScreen, {})
  },
  "staging-fixes-initiatives-i18n": {
    label: 'TRI-MUST-05 staging-fixes-20260826 Naprawa 1 \u2014 REALNY <InitiativesHub>: weryfikacja brakuj\u0105cych kluczy i18n (toast/hub/filters/materialize/kanban) i selektora poziomu inicjatywy w modalu "Nowa inicjatywa" (getInitiativeLevels(t) zamiast statycznej angielskiej sta\u0142ej).',
    render: () => /* @__PURE__ */ jsx(StagingFixesInitiativesI18nScreen, {})
  },
  "inicjatywy-lista": {
    label: "Pomiar KPI/OKR/ROI 2026-08-30 \u2014 LISTA INICJATYW: REALNY <InitiativesHub> (StandardModuleBar + StandardTable, kanon triady) pod odkrywaln\u0105 nazw\u0105 \u2014 w\u0142a\u015Bciciel nigdy nie widzia\u0142 tego ekranu. Dane przyk\u0142adowe (isDemoMode).",
    render: () => /* @__PURE__ */ jsx(InicjatywyListaScreen, {})
  },
  "capacity-advisor-a3": {
    label: "Day 49 A.3 \u2014 real CapacityScenarioSurface demoMode=false, transport capacity-options intercepted; &phase=before|after &state=default|empty",
    render: () => /* @__PURE__ */ jsx(CapacityAdvisorA3Screen, {})
  },
  "plan-scenario-d1": {
    label: "Day 49 D.1 \u2014 real PlanScenarioSurface demoMode=false, transport plan-scenarios intercepted, full load() path, full PL i18n; &state=default|empty",
    render: () => /* @__PURE__ */ jsx(PlanScenarioD1Screen, {})
  },
  "staging-fixes-execution-i18n": {
    label: "TRI-MUST-05 staging-fixes-20260826 Naprawa 1 \u2014 REALNY <ExecutionHub>: weryfikacja brakuj\u0105cych kluczy i18n (failedDesc/noDataDesc) i etykiet highlights katalogu raport\xF3w (zak\u0142adka Raporty) przet\u0142umaczonych przez t(...).",
    render: () => /* @__PURE__ */ jsx(StagingFixesExecutionI18nScreen, {})
  },
  "audyty-piec-powierzchni": {
    label: "U8 \u2014 REALNY <AuditsMethodHub> (Library\xB7Processes\xB7Outputs\xB7Reports\xB7Initiatives), auditsFiveSurfacesV1. &tab=library|processes|outputs|reports|initiatives, &state=default|empty|loading|error",
    render: () => /* @__PURE__ */ jsx(AudytyPiecPowierzchniScreen, {})
  },
  "audyty-warsztat-kryterium": {
    label: "W4 \u2014 REALNY <CriterionWorkspace> (\u0142a\u0144cuch 18 ogniw: EvidencePanel\xB7FindingPanel\xB7RemediationPanel\xB7TeresaProposalCard). &role=auditee|auditor|lead_auditor|reviewer|action_owner, &stage=fresh|evidence|tested|finding|remediation|closed, &state=loading|error|forbidden, &teresa=1",
    render: () => /* @__PURE__ */ jsx(AudytyWarsztatKryteriumScreen, {})
  },
  "audyty-raport-dokument": {
    label: "U9 \u2014 NAPRAWA 2 (2026-08-26): REALNY <AuditReportDocumentView> \u2014 pe\u0142ny widok tre\u015Bci raportu, `GET /audits/reports/:id/presentation`, SPEC-A Dokument (NModeShell+ArtifactRightPanel). &status=draft|in_review|approved|published (default: approved).",
    render: () => /* @__PURE__ */ jsx(AudytyRaportDokumentScreen, {})
  },
  "tools-swot-report": {
    label: "Tools \u2014 Dynamic SWOT: Output -> Report/Presentation (deterministyczny renderer, Executive Paper/Night)",
    render: () => /* @__PURE__ */ jsx(ToolsSwotReportScreen, {})
  },
  "tools-swot-initiative-proposal": {
    label: "Tools \u2014 Dynamic SWOT: SummaryStep dynamic-swot branch (Results & Readiness, night-sweep-20260826 #3)",
    render: () => /* @__PURE__ */ jsx(ToolsSwotInitiativeProposalScreen, {})
  },
  "drd-library-entry": {
    label: 'OCENA \u2014 zak\u0142adka \u201EBiblioteka" (wej\u015Bcie do metodyki DRD): REALNY <AssessmentHub initialTab="library"> \u2192 AssessmentLibraryTab. Do 2026-09-02 by\u0142a to REPLIKA triady.',
    render: () => /* @__PURE__ */ jsx(DrdLibraryEntryScreen, {})
  },
  "drd-http-workspace": {
    label: "T5 \u2014 REALNY <DrdHttpMethodWorkspaceScreen> (P0C, HTTP source-of-truth, ff drdHttpSourceOfTruthV1 not-yet-wired) \u2014 &stage=fresh|inprogress|blocked|frozen &state=loading|error|offline|conflict &view=interview|split|matrix",
    render: () => /* @__PURE__ */ jsx(DrdHttpWorkspaceScreen, {})
  },
  "assessment-artifacts-restart": {
    label: 'T5 \u2014 REALNY <AssessmentHub initialTab="outputs"> (AssessmentOutputsTab P0D kernel rewrite, 2026-08-13) \u2014 &tab=outputs|reports|initiatives &select=1 &lineage=1',
    render: () => /* @__PURE__ */ jsx(AssessmentArtifactsRestartScreen, {})
  },
  "method-workspace": {
    label: "A5 \u2014 Method Workspace shell (interview/split/matrix), ff methodWorkspaceShellV1. &view=interview|split|matrix &state=default|resolution|savefailed|teresaRich",
    render: () => /* @__PURE__ */ jsx(MethodWorkspaceScreen, {})
  },
  "siri-workspace": {
    label: "A7 \u2014 SIRI vertical slice: REALNY <MethodWorkspaceShell> (A5) wpi\u0119ty w dane SIRI (siriWorkspaceView/siriAdapter). &view=interview|split|matrix &case=default|leapfrog",
    render: () => /* @__PURE__ */ jsx(SiriWorkspaceScreen, {})
  },
  "siri-tier": {
    label: "A7 \u2014 SIRI TIER / Prioritisation Matrix (osobny widok po freeze, bez MethodWorkspaceShell; siriTierView \u2192 siriPrioritisation). &frozen=1|0 &flag=1|0 &horizon=strategic|tactical|operational",
    render: () => /* @__PURE__ */ jsx(SiriTierScreen, {})
  },
  "results-vnext-registry-shell": {
    label: "RN-G2 P0 \u2014 REALNY <ResultsVNextRegistryShell> (KPI/ROI/OKR): loading/empty/error/forbidden + locked/honest-missing. &domain=kpi|roi|okr &state=ready|loading|empty|error|forbidden &reason=<deny> &selected=<id|none>",
    render: () => /* @__PURE__ */ jsx(ResultsVNextRegistryShellScreen, {})
  },
  "results-vnext-kpi-registry": {
    label: "RN-G2 P1 \u2014 REALNY <ResultsKpiRegistryPage> (KPI registry, real GET/POST /vnext/results/kpi* stubbed): My/Org tabs, status chips, lifecycle kebab (activate/suspend/archive), lazy measurement preview, deep-link forbidden. &state=ready|loading|empty|error &kpiId=<id> &ff=off",
    render: () => /* @__PURE__ */ jsx(ResultsVNextKpiRegistryScreen, {})
  },
  "results-zestawienia": {
    label: "DECYZJA_WYNIKI_TRZY_POZIOMY (2026-08-30) \u2014 prototyp POZIOMU 1: rejestr ZESTAWIE\u0143 OKRESOWYCH (nie pojedynczych wska\u017Anik\xF3w), ten sam budulec co results-vnext-kpi-registry (ResultsVNextRegistryShell = StandardModuleBar+StandardTable+StandardPreview) z r\u0119cznymi wierszami \u2014 zast\u0119puje tre\u015B\u0107 dzisiejszego rejestru KPI. Klik prowadzi (docelowo) na poziom 2 = results-vnext-kpi-scorecards. &state=ready|loading|empty|error &filter=all|open|closed &selected=<id|none>",
    render: () => /* @__PURE__ */ jsx(ResultsZestawieniaScreen, {})
  },
  "results-vnext-roi-registry": {
    label: 'RN-G2 P2 \u2014 REALNY route entry <ResultsRoiRegistryPage> (flaga roiRegistry: OFF -> EmptyState "results-vnext-roi-disabled", ON -> realny <ResultsRoiHub>): All cases + Benefits realization, honest NPV/IRR/payback, lock badges. &tab=all|benefits &state=ready|loading|empty|error &selected=<caseId|none> &calc=loading|ready &ff=off',
    render: () => /* @__PURE__ */ jsx(ResultsVNextRoiRegistryScreen, {})
  },
  "results-vnext-roi-model": {
    label: 'RN-G2 \xA7G #12-14 \u2014 REALNY <RoiCaseFullTool initialPhase="build"> -> <RoiCaseModelWorkspace>: Baseline+polityka (2-wierszowa tabela), Za\u0142o\u017Cenia/Koszty/Korzy\u015Bci CRUD. &tab=settings|assumptions|cost-lines|benefit-lines &state=ready|loading|empty|error &selected=<id|none> &locked=1 &nullBaseline=1 &nullPolicy=1 &editBaseline=1 &editPolicy=1 &assumptionForm=create|edit &costLineForm=create|edit &benefitLineForm=create|edit &removeAssumption=1 &removeCostLine=1 &removeBenefitLine=1 &formState=idle|saving|error|conflict',
    render: () => /* @__PURE__ */ jsx(ResultsVNextRoiModelScreen, {})
  },
  "results-vnext-roi-full-tool": {
    label: 'FALA 1 (ROI) \u2014 REALNY <ResultsRoiHub> -> <RoiCaseFullTool> (4 fazy: Build Case/Decision/Realize Value/Learn), window.fetch stubbed statefully for the whole /vnext/results/roi surface, real onClose (no harness no-op). Click the case row, then kebab "Otw\xF3rz pe\u0142ne narz\u0119dzie".',
    render: () => /* @__PURE__ */ jsx(ResultsVNextRoiFullToolScreen, {})
  },
  "roi-jedna-karta": {
    label: "DECYZJA W\u0141A\u015ACICIELA (2026-08-30) \u2014 PROTOTYP jednej N-karty ROI (wzorzec: karta Inicjatywy), zast\u0119puje 3 osobne ekrany (registry zostaje list\u0105 poza kart\u0105). 5 sekcji lewego menu: Za\u0142o\u017Cenia/Model/Wynik/Wyniki po wdro\u017Ceniu/Wnioski i rekomendacja + prawy panel 7 sekcji kanonu. &sekcja=zalozenia|model|wynik|wyniki-po-wdrozeniu|wnioski",
    render: () => /* @__PURE__ */ jsx(RoiJednaKartaScreen, {})
  },
  "wskaznik-jedna-karta": {
    label: "DECYZJA W\u0141A\u015ACICIELA (2026-08-30) \u2014 PROTOTYP jednej N-karty wska\u017Anika (poziom 3 z DECYZJA_WYNIKI_TRZY_POZIOMY.md), ta sama formu\u0142a co roi-jedna-karta. Ci\u0105g\u0142o\u015B\u0107 NordFood/SMED L3: KPI-0087 czyta si\u0119 z ROI i cel. 5 sekcji: Kontrakt/Pomiary/Odchylenia/Dzia\u0142ania koryguj\u0105ce/Rodow\xF3d + prawy panel 7 sekcji kanonu. &sekcja=kontrakt|pomiary|odchylenia|dzialania-korygujace|rodowod",
    render: () => /* @__PURE__ */ jsx(WskaznikJednaKartaScreen, {})
  },
  "cel-jedna-karta": {
    label: "DECYZJA W\u0141A\u015ACICIELA (2026-08-30) \u2014 PROTOTYP jednej N-karty celu/OKR (poziom 3 z DECYZJA_WYNIKI_TRZY_POZIOMY.md), ta sama formu\u0142a co roi-jedna-karta i wskaznik-jedna-karta. Ci\u0105g\u0142o\u015B\u0107 NordFood/SMED L3: OKR-0019, KR1 czyta si\u0119 automatycznie z KPI-0087. 5 sekcji: Cel/Kluczowe rezultaty/Post\u0119p/Powi\u0105zania/Refleksja + prawy panel 7 sekcji kanonu. &sekcja=cel|kluczowe-rezultaty|postep|powiazania|refleksja",
    render: () => /* @__PURE__ */ jsx(CelJednaKartaScreen, {})
  },
  "results-vnext-okr-registry": {
    label: 'RN-G2 P3 #23 \u2014 REALNY route entry <ResultsOkrRegistryPage> (flaga okrRegistry: OFF -> EmptyState "results-vnext-okr-disabled", ON -> realny <ResultsOkrHub>), window.fetch stubbed for /api/vnext/results/okr*. Organization/My/Company tabs (real clicks, real fetch per tab), honest progress/confidence, lock badges, real ?setId= deep link. &state=ready|loading|empty|error &ff=off',
    render: () => /* @__PURE__ */ jsx(ResultsVNextOkrRegistryScreen, {})
  },
  "results-vnext-search-registry": {
    label: "D.2 \u2014 REALNY <ResultsSearchRegistry> (the same component ResultsKpiRegistryPage mounts for ?resultsView=search), Api.get stubbed for /vnext/results/search. &state=ready|empty|error &q=<initial query>",
    render: () => /* @__PURE__ */ jsx(ResultsVNextSearchRegistryScreen, {})
  },
  "results-vnext-okr-objectives": {
    label: "RN-G2 \xA7G #25 \u2014 REALNE <OkrObjectivesView>/<OkrKeyResultsView>/<OkrCheckInsView> (OQ-UI-I fix 2026-08-11: production components + window.fetch stub, real modals with real onClose \u2014 not eight no-ops). Click through the real drill (Cele -> Kluczowe Rezultaty -> Check-iny) inside the harness. &level=objectives|keyResults|checkIns (initial level) &setStatus=<status> &state=ready|loading|empty|error",
    render: () => /* @__PURE__ */ jsx(ResultsVNextOkrObjectivesScreen, {})
  },
  "results-vnext-okr-workspace": {
    label: "RN-G3 lane okr full-tool task (2026-08-11) \u2014 REALNY <OkrSetWorkspace> (pe\u0142ne narz\u0119dzie: Przegl\u0105d/Cele i KR/Dopasowania/Rozmowy i wsparcie/Przegl\u0105d i refleksja/Historia), window.fetch stubbed, real component + real tab clicks; onSetChanged/onBackToSets real (harness state), status po przej\u015Bciu cyklu \u017Cycia faktycznie si\u0119 od\u015Bwie\u017Ca. &setStatus=<status> &asOwner=1",
    render: () => /* @__PURE__ */ jsx(ResultsVNextOkrWorkspaceScreen, {})
  },
  "results-vnext-okr-admin": {
    label: "RN-G3 lane okr full-tool task (2026-08-11) \u2014 REALNE <OkrProgramsPage>/<OkrCyclesPage> (powierzchnie administracyjne Programu/Cyklu, OSOBNE od Set workspace), window.fetch stubbed. &page=programs|cycles",
    render: () => /* @__PURE__ */ jsx(ResultsVNextOkrAdminScreen, {})
  },
  "results-vnext-kpi-scorecards": {
    label: 'RN-G2 P1 #8 \u2014 REALNY <ResultsKpiScorecardDetailPage> (trasa /results/kpi/scorecards/:scorecardId pod MemoryRouter, Api.get/Api.post stubbed) \u2014 szczeg\xF3\u0142y karty (Pozycje/Migawki), status GET .../status, lock NO_MEMBERS. Lista kart wynik\xF3w = zak\u0142adka "Karty wynik\xF3w" w results-vnext-kpi-registry (REALNY <ResultsKpiRegistryPage>), nie osobny ekran tutaj. &tab=items|snapshots &state=ready|loading|empty|error|forbidden &selected=<id|none> &scorecard=sc-1|sc-2|sc-3|sc-4',
    render: () => /* @__PURE__ */ jsx(ResultsVNextKpiScorecardsScreen, {})
  },
  "results-vnext-kpi-tool": {
    label: "RN-G3 lane \u2014 REALNY <KpiToolPage> + <KpiDeviationCaseSubview> (klasa L, D03/D05), zamontowane pod jednym <MemoryRouter> z prawdziwym useNavigate() mi\u0119dzy nimi. &view=tool|case &state=ready|loading|error &caseState=open|analysis_required|plan_required|plan_submitted|approved|executing|recovery_observed|verification|closed &severity=warning|critical &escalated=1 &impacts=0 &ff=off",
    render: () => /* @__PURE__ */ jsx(ResultsVNextKpiToolScreen, {})
  },
  "results-vnext-teresa-kpi-deviation": {
    label: 'RN-G5 lane teresa (2026-08-12) \u2014 REALNY <KpiDeviationCaseSubview> Phase 2 "Popro\u015B Teres\u0119 o zapis przez pipeline" (reflection_rca), window.fetch stubbed statefully for /api/v8/teresa/proposal* (P08) PLUS Api.get/post/put for /vnext/results/kpi*. Case starts at analysis_required. &teresaDown=1 (transport failure -> manual fallback) &teresaDeny=1 (first execute denies -> blocked banner, no silent success)',
    render: () => /* @__PURE__ */ jsx(ResultsVNextTeresaKpiDeviationScreen, {})
  },
  "results-vnext-teresa-okr-reflection": {
    label: 'RN-G5 lane teresa (2026-08-12) \u2014 REALNY <OkrReviewReflectionView> "Popro\u015B Teres\u0119 o szkic refleksji" (reflection_synthesis), window.fetch stubbed statefully for /api/v8/teresa/proposal* (P08) PLUS /api/vnext/results/okr/*. Set status=review, one Objective. &teresaDown=1 (transport failure -> manual fallback) &teresaDeny=1 (first execute denies -> blocked banner, no silent success)',
    render: () => /* @__PURE__ */ jsx(ResultsVNextTeresaOkrReflectionScreen, {})
  },
  "results-vnext-legacy-archive": {
    label: "RN-G2 R09-3 \u2014 REALNY <ResultsVNextLegacyArchivePanel> (kpi/roi/okr .../legacy index, tylko do odczytu, prep pod kolejn\u0105 fal\u0119 \u2014 NIEPODPI\u0118ty do \u017Cadnego huba). &domain=kpi|roi|okr &state=ready|loading|empty|error",
    render: () => /* @__PURE__ */ jsx(ResultsVNextLegacyArchiveScreen, {})
  },
  "results-vnext-attention": {
    label: "RN-G5 \xA7G #30 \u2014 REALNY <ResultsAttentionPage> (przekrojowy widok KPI+OKR attention/team-health, Api.get stubbed). Menu2 KPI/OKR, Menu3 = bucket (real counts). &kpiState=ready|loading|empty|error &okrState=ready|loading|empty|error &ff=off",
    render: () => /* @__PURE__ */ jsx(ResultsVNextAttentionScreen, {})
  },
  "results-vnext-roi-pir-outcomes": {
    label: "RN-G5 \xA7G #11 \u2014 REALNY <RoiPirOutcomesTab> przez <ResultsRoiPirOutcomesPage> (ROI org PIR-outcomes, window.fetch stubbed dla /org/pir-outcomes). Gotowy do wpi\u0119cia jako 3. zak\u0142adka ResultsRoiHub. &state=ready|loading|empty|error &ff=off",
    render: () => /* @__PURE__ */ jsx(ResultsVNextRoiPirOutcomesScreen, {})
  },
  "rn-g3-class-l-record-shell": {
    label: "RN-G3 tor PLATFORMY \xA71 \u2014 DEMONSTRACJA przepisu pow\u0142oki klasy L (archetyp Rekord): ArtifactBreadcrumb + NModeShell + ArtifactRightPanel/ArtifactPropertiesTable, zero nowego standardu. &save=idle|saving|saved|error|conflict &teresa=1",
    render: () => /* @__PURE__ */ jsx(RnG3ClassLRecordShellScreen, {})
  },
  "idea-financial-case-persistence": {
    label: "E09 RISK-12 \u2014 REALNY <FinancialCaseDialog> z REALNYM zapisem: ?state=empty|loading|dirty|saving|saved|error|conflict|reopened (stanowy mock transportu)",
    render: () => /* @__PURE__ */ jsx(IdeaFinancialCasePersistenceScreen, {})
  },
  "mw-007-calendar-narrow-viewport": {
    label: "MW-07 Codex FINAL UX FIX_REQUIRED \u2014 REALNY <CalendarView>: sidebar nie nachodzi na grid poni\u017Cej breakpointu mobile (useIsMobile + Drawer)",
    render: () => /* @__PURE__ */ jsx(Mw007CalendarNarrowViewportScreen, {})
  },
  "exe-002-004-ui-audit": {
    label: 'EXE-002-004 \u2014 audyt UI: milestone-creation (Tasks & Milestones) + RAID persistence (RaidSection), REALNY <InitiativeDocumentView sourceModule="execution">, stanowy mock POST/PATCH/DELETE',
    render: () => /* @__PURE__ */ jsx(Exe002004UiAuditScreen, {})
  },
  "fab-rail-kebab": {
    label: "PILNE-9 \u2014 p\u0142ywaj\u0105ce przyciski vs kebab ostatniego wiersza (&fix=off = stan przed)",
    render: () => /* @__PURE__ */ jsx(FabRailKebabScreen, {})
  },
  "materialy-launcher": {
    label: "MATERIA\u0141Y \u2014 tablica Dodaj (format\xD7tryb) &variant=materials|templates",
    render: () => /* @__PURE__ */ jsx(MaterialyLauncherScreen, {})
  },
  "materialy-template-library-slice": {
    label: 'MATERIA\u0141Y \u2014 Biblioteka wzorc\xF3w, slice \u201Eszablon dokumentu": Legacy \xB7 osierocony (bez u\u017Cycia) \xB7 brak metadanych',
    render: () => /* @__PURE__ */ jsx(MaterialyTemplateLibrarySliceScreen, {})
  },
  "materialy-draft-template-visibledraft-fix": {
    label: 'MATERIA\u0141Y \u2014 naprawa 2026-07-28: draft szablonu dokumentu teraz widoczny w Bibliotece (owner: "New template" nie pokazywa\u0142 mojej pracy)',
    render: () => /* @__PURE__ */ jsx(MaterialyDraftTemplateVisibilityFixScreen, {})
  },
  "document-studio-template-resolve-error": {
    label: 'DOCUMENT STUDIO \u2014 \u201EU\u017Cyj wzorca" odrzucone serwerowo: stan blokuj\u0105cy (bez pickera, bez AI). ?case=orphaned|forbidden|deprecated|not_indexed|resolving',
    render: () => /* @__PURE__ */ jsx(DocumentStudioTemplateResolveErrorScreen, {})
  },
  "prezentacje-template-states": {
    label: 'PREZENTACJE \u2014 \u201EU\u017Cyj wzorca" z Biblioteki (R11 deck slice): 2 stany blokuj\u0105ce + \u0142adowanie. ?variant=orphaned (DOMY\u015ALNY)|forbidden|loading (spinner 20 s = timeout transportu, potem stan blokuj\u0105cy)',
    render: () => /* @__PURE__ */ jsx(PrezentacjeTemplateStatesScreen, {})
  },
  "report-builder-library-template": {
    label: 'REPORT BUILDER \u2014 \u201EU\u017Cyj wzorca" z Biblioteki (report_template, R1 2026-07-26): sukces (modal, pole zablokowane) + stany blokuj\u0105ce. ?variant=success|orphaned|deprecated|forbidden',
    render: () => /* @__PURE__ */ jsx(ReportBuilderLibraryTemplateScreen, {})
  },
  "materials-registry": {
    label: 'MATERIA\u0141Y \u2014 rejestr wsp\xF3lny \u201EWszystkie" (materials-registry-fix, 2026-08-25): REALNY OutputsAggregateTabContent, trzy wiersze mieszane po naprawie projekcji Document/Sheet/Presentation.',
    render: () => /* @__PURE__ */ jsx(MaterialsRegistryScreen, {})
  },
  "document-studio-resume-error": {
    label: "DOCUMENT STUDIO \u2014 nieudane wznowienie (P0.2): blokuj\u0105cy b\u0142\u0105d PL zamiast intake. ?case=notfound|server",
    render: () => /* @__PURE__ */ jsx(DocumentStudioResumeErrorScreen, {})
  },
  "document-studio-context-chip": {
    label: "DOCUMENT STUDIO \u2014 chip kontekstu organizacji (P0 2026-07-27): co zostanie automatycznie do\u0142\u0105czone.",
    render: () => /* @__PURE__ */ jsx(DocumentStudioContextChipScreen, {})
  },
  "document-studio-ai-teresa": {
    label: 'DOCUMENT STUDIO \u2014 FAZA B1 (2026-07-27): "Z AI" bez formularza, Teresa z boku (ff_zai_teresa).',
    render: () => /* @__PURE__ */ jsx(DocumentStudioAiTeresaScreen, {})
  },
  "document-studio-streaming-honesty-n3": {
    label: "DOCUMENT STUDIO \u2014 N3 (2026-07-28): doktryna streaming \u2014 notyfikacja fallback, Stop, chipy \u017Ar\xF3de\u0142, plan w Mode 3. ?simFail=1 dla naprawy #1.",
    render: () => /* @__PURE__ */ jsx(DocumentStudioStreamingHonestyN3Screen, {})
  },
  "document-studio-menu-pliku": {
    label: 'DOCUMENT STUDIO \u2014 N19/N20 (2026-07-28): menu \u201EPlik" (Nowy\xB7Otw\xF3rz\xB7Zapisz\xB7Zapisz jako) + afordancje wyj\u015Bcia (Start over / breadcrumb).',
    render: () => /* @__PURE__ */ jsx(DocumentStudioMenuPlikuScreen, {})
  },
  "document-studio-save-as-template": {
    label: 'DOCUMENT STUDIO \u2014 FALA 2 (2026-07-28): \u201EZr\xF3b z tego wzorzec" \u2014 Plik\u2192Zr\xF3b z tego wzorzec\u21923-5 pyta\u0144 doprecyzowuj\u0105cych\u2192createTemplateFromArtifact.',
    render: () => /* @__PURE__ */ jsx(DocumentStudioSaveAsTemplateScreen, {})
  },
  "audyty-drd-report": {
    label: 'AUDYTY \u2014 zak\u0142adka \u201ERaporty": REALNY <AuditsMethodHub ?tab=reports> (/audit-programs) + REALNY DRDAuditReportView (?variant=report, ff_drd_report). Do 2026-09-02 wariant listowy montowa\u0142 niezamontowany w produkcie AuditsHub.',
    render: () => /* @__PURE__ */ jsx(AudytyDrdReportScreen, {})
  },
  "assessment-quality-review-panel": {
    label: "ASSESSMENT \u2014 ASM-005/006/007: Outputs \u2192 evidence/scoring + accept/return + niezmienny output. ?variant=mixed|accepted|empty",
    render: () => /* @__PURE__ */ jsx(AssessmentQualityReviewPanelScreen, {})
  },
  "assessment-presentation-view": {
    label: "ASSESSMENT \u2014 Widok prezentacji (9 slajd\xF3w z zamro\u017Conego Outputu, tryb pe\u0142noekranowy, zero recompute). ?variant=full|risksOnly|allMet|unknowns|empty|noOutput|notFound|forbidden|offline|badShape &narrative=1",
    render: () => /* @__PURE__ */ jsx(AssessmentPresentationViewScreen, {})
  },
  "prawy-pas-jedna-formula": {
    label: 'GRAFIKA \u2014 Prawy pas jako JEDNA FORMU\u0141A (szyna 56px: Artefakt \xB7 narz\u0119dzie zale\u017Cne od typu). Bez czatu w pasie \u2014 decyzja 2026-09-01 \u201Ejedna Teresa, w swoim oknie". Interaktywny \u2014 prze\u0142\u0105cznik notatka/idea.',
    render: () => /* @__PURE__ */ jsx(PrawyPasJednaFormulaScreen, {})
  },
  "prawy-pas-jedna-formula-notatka-artefakt": {
    label: "GRAFIKA \u2014 jw., wariant do zrzutu: Notatka \xB7 tryb Artefakt (7 sekcji akordeonu, Akcje+W\u0142a\u015Bciwo\u015Bci rozwini\u0119te).",
    render: () => /* @__PURE__ */ jsx(
      PrawyPasJednaFormulaScreen,
      {
        initialObjectType: "notatka",
        initialRailMode: "artefakt",
        interactive: false
      }
    )
  },
  "prawy-pas-jedna-formula-notatka-teresa": {
    label: 'GRAFIKA \u2014 jw., Notatka. Dawny \u201Etryb Teresa" ODRZUCONY 2026-09-01 (\u201Ejedna Teresa, w swoim oknie") \u2014 adres zostaje, renderuje panel artefaktu z przyciskiem \u201EZapytaj Teres\u0119 o t\u0119 notatk\u0119".',
    render: () => /* @__PURE__ */ jsx(
      PrawyPasJednaFormulaScreen,
      {
        initialObjectType: "notatka",
        initialRailMode: "teresa",
        interactive: false
      }
    )
  },
  "prawy-pas-jedna-formula-idea-artefakt": {
    label: "GRAFIKA \u2014 jw., wariant do zrzutu: Idea \xB7 tryb Artefakt (7 sekcji akordeonu, Akcje+W\u0142a\u015Bciwo\u015Bci rozwini\u0119te).",
    render: () => /* @__PURE__ */ jsx(
      PrawyPasJednaFormulaScreen,
      {
        initialObjectType: "idea",
        initialRailMode: "artefakt",
        interactive: false
      }
    )
  },
  "prawy-pas-jedna-formula-idea-teresa": {
    label: 'GRAFIKA \u2014 jw., Idea. Dawny \u201Etryb Teresa" ODRZUCONY 2026-09-01 (\u201Ejedna Teresa, w swoim oknie") \u2014 adres zostaje, renderuje panel artefaktu z przyciskiem \u201EZapytaj Teres\u0119 o t\u0119 ide\u0119".',
    render: () => /* @__PURE__ */ jsx(
      PrawyPasJednaFormulaScreen,
      {
        initialObjectType: "idea",
        initialRailMode: "teresa",
        interactive: false
      }
    )
  },
  "menu-canon-sidebar-check": {
    label: 'SIDEBAR \u2014 potwierdzenie braku osobnej pozycji "Excel" po feat/materials-menu-canon-5-tabs.',
    render: () => /* @__PURE__ */ jsx(MenuCanonSidebarCheckScreen, {})
  },
  //  'initiatives-portfolio-analysis': {
  //    label:
  //      'Inicjatywy → analiza portfela — 5 podwidoków po wycięciu atrap AI (&sub=…, &ai=ok|fail|empty)',
  //    render: () => <InitiativesPortfolioAnalysisScreen />,
  //  },
  "ntype-analizuj-ai": {
    label: 'n-Type ETAP 3 \u2014 \u201EAnalizuj z AI": menu 2 + panel wynik\xF3w (Braki \xB7 Ryzyka \xB7 Sugestie \xB7 Zmiany)',
    render: () => /* @__PURE__ */ jsx(NTypeAnalizujAiScreen, {})
  },
  odbior: {
    label: "\u2605 PANEL ODBIORU \u2014 wszystkie obszary (rejestr/3-DO-ODBIORU), \u017Cywe ekrany + werdykty",
    render: () => /* @__PURE__ */ jsx(OdbiorScreen, {})
  },
  "gen-deck-content-hints": {
    label: "DOKUMENTY \u2014 Gen. Deck catch-up: per-slide content hints w Deck Template Architect (audyt 2026-07-22)",
    render: () => /* @__PURE__ */ jsx(GenDeckContentHintsScreen, {})
  },
  "gen-excel-templates-tab": {
    label: 'DOKUMENTY \u2014 Gen. Excel W1: zak\u0142adka huba "Generator szablon\xF3w Excel" (ff_workbook_templates, 3 wzorce)',
    render: () => /* @__PURE__ */ jsx(GenExcelTemplatesTabScreen, {})
  },
  "gen-word-content-hints": {
    label: "DOKUMENTY \u2014 Gen. Word W2: content hints per sekcja w Word Template Architect (ff_tpl_editor)",
    render: () => /* @__PURE__ */ jsx(GenWordContentHintsScreen, {})
  },
  "deck-quality-badge": {
    label: "DOKUMENTY \u2014 Deck W4: badge jako\u015Bci (critic/M19) na kroku wyniku kreatora (&clean=1 dla 0 uwag)",
    render: () => /* @__PURE__ */ jsx(DeckQualityBadgeScreen, {})
  },
  "word-quality-badge": {
    label: "DOKUMENTY \u2014 Word W4: badge fabrykacji w panelu QA Document Studio (&clean=1 dla zweryfikowane)",
    render: () => /* @__PURE__ */ jsx(WordQualityBadgeScreen, {})
  },
  "word-intake-uselm-default": {
    label: 'DOKUMENTY \u2014 Word intake: domy\u015Blnie \u201EWygeneruj tre\u015B\u0107 z AI" (audyt 2026-07-22, Word #8)',
    render: () => /* @__PURE__ */ jsx(WordIntakeUseLlmDefaultScreen, {})
  },
  "excele-engine-reveal": {
    label: "DOKUMENTY \u2014 Excel: silnik arkuszy pod /excele (home) (audyt 2026-07-22, Sheet #9)",
    render: () => /* @__PURE__ */ jsx(ExceleEngineRevealScreen, {})
  },
  "excele-reopen-verify": {
    label: 'DOKUMENTY \u2014 Excel: naprawa "nie mam czego otworzy\u0107" \u2014 reopen wisz\u0105cego artifactId \u2192 honest error zamiast pustego fake-podgl\u0105du (2026-07-23)',
    render: () => /* @__PURE__ */ jsx(ExceleReopenVerifyScreen, {})
  },
  "excele-jeden-widok-recent": {
    label: 'EXCELE \u2014 "jeden Excel" \u015Bcie\u017Cka 3: Recent/Saved tab \u2192 otwarcie \u2192 edytowalna siatka (2026-07-28)',
    render: () => /* @__PURE__ */ jsx(ExceleJedenWidokRecentScreen, {})
  },
  "excele-jeden-widok-materialy": {
    label: 'EXCELE \u2014 "jeden Excel" \u015Bcie\u017Cka 4: Materia\u0142y \u2192 Arkusze \u2192 otwarcie z listy \u2192 edytowalna siatka, nie pobranie/Table Studio (2026-07-28)',
    render: () => /* @__PURE__ */ jsx(ExceleJedenWidokMaterialyScreen, {})
  },
  "excele-jeden-widok-pusty": {
    label: 'EXCELE \u2014 "jeden Excel" \u015Bcie\u017Cka 2: Start new \u2192 Czysto \u2192 pusta ale edytowalna siatka (12x30), nie zast\u0119pczy obrazek (2026-07-28)',
    render: () => /* @__PURE__ */ jsx(ExceleJedenWidokPustyScreen, {})
  },
  // (deck-artifact / sheet-artifact są zarejestrowane niżej, w bloku DOKUMENTY
  // razem z document-artifact — scalenie fix/crimson-deck-sheet dołożyło tu ich
  // duplikat, zdjęty przy rozwiązywaniu konfliktu.)
  "idea-table-tool-kebab": {
    label: "IDEE Table \u2014 K1 kebab wiersza (PlatformGridView, prawy-klik) \u2014 audyt-idee 2026-07-22",
    render: () => /* @__PURE__ */ jsx(IdeaTableToolKebabScreen, {})
  },
  "idea-table-record-templates": {
    label: "IDEE Table \u2014 RecordTemplateManager (RISK-06 dead-mount wiring). ?stan=lista|pusty|blad \u2014 2026-08-12",
    render: () => /* @__PURE__ */ jsx(IdeaTableRecordTemplatesScreen, {})
  },
  "idea-table-tool-paste": {
    label: "IDEE Table \u2014 Ctrl/Cmd+V wklejanie (PlatformGridView, Z16b domkni\u0119cie) \u2014 2026-07-22",
    render: () => /* @__PURE__ */ jsx(IdeaTableToolPasteScreen, {})
  },
  "idea-table-tool-sortfilter": {
    label: "IDEE Table \u2014 Sortowanie po nag\u0142\xF3wku + filtr per kolumna (PlatformGridView, Fala 7) \u2014 2026-07-22",
    render: () => /* @__PURE__ */ jsx(IdeaTableToolSortFilterScreen, {})
  },
  "idea-table-tool-empty-filter": {
    label: "IDEE Table \u2014 Stan pustego filtra + resize kolumn + g\u0119sto\u015B\u0107 wierszy (PlatformGridView, Fala 8) \u2014 2026-07-23",
    render: () => /* @__PURE__ */ jsx(IdeaTableToolEmptyFilterScreen, {})
  },
  "idea-table-tool-grouping": {
    label: 'IDEE Table \u2014 Grupowanie: dropdown "Grupuj wg" + zwijanie grup (PlatformGridView, Fala 10) \u2014 2026-07-23',
    render: () => /* @__PURE__ */ jsx(IdeaTableToolGroupingScreen, {})
  },
  "karta-tool": {
    label: "KARTY N \u2014 Tool (harness odbioru 2026-07-21)",
    render: () => /* @__PURE__ */ jsx(KartaToolScreen, {})
  },
  "initiative-record": {
    label: "FORMULA-20 \u2014 REALNY <InitiativeDocumentView> (archetyp C\xB7Rekord, SPEC-A), showcase fixture init-showcase-margin-leakage-recovery",
    render: () => /* @__PURE__ */ jsx(InitiativeRecordScreen, {})
  },
  "karta-initiative": {
    label: "KARTY N \u2014 Initiative (harness odbioru 2026-07-21)",
    render: () => /* @__PURE__ */ jsx(KartaInitiativeScreen, {})
  },
  "karta-insight": {
    label: "KARTY N \u2014 Insight (harness odbioru 2026-07-21)",
    render: () => /* @__PURE__ */ jsx(KartaInsightScreen, {})
  },
  "karta-interview": {
    label: "KARTY N \u2014 Interview Session (harness odbioru 2026-07-21)",
    render: () => /* @__PURE__ */ jsx(KartaInterviewScreen, {})
  },
  "interview-progressbar-153": {
    label: "153-crimson-naprawa \u2014 InterviewWorkspace dedicated_question_workspace (progress bar bg-c-accent -> bg-c-success)",
    render: () => /* @__PURE__ */ jsx(InterviewProgressbar153Screen, {})
  },
  "interview-preview-canon": {
    label: "DEC-2026-08-25-53 \u2014 Interview Sesje/Inicjatywy PREVIEW rebuilt onto TABLE_AND_PREVIEW_CANON \xA77 (REALNE TableWithPreviewLayout + Interview{Session,Initiative}PreviewBody/Footer). &variant=session|initiative &kebab=1 (otwiera kebab Details na starcie)",
    render: () => /* @__PURE__ */ jsx(InterviewPreviewCanonScreen, {})
  },
  "interview-creator-shell": {
    label: "DEC-2026-08-25-67 \u2014 Interview Creator Shell (&step=1|2|3 &scene=default|off|empty)",
    render: () => /* @__PURE__ */ jsx(InterviewCreatorShellScreen, {})
  },
  "interview-sessions-status": {
    label: 'UI-latki-20260828 \u2014 REALNY <InterviewHub /> zak\u0142adka Sesje, kolumna status: 5 wierszy (assigned/in_progress/submitted/approved/completed) \u2014 weryfikacja etykiety "Przydzielony" i neutralnego tonu dla assigned.',
    render: () => /* @__PURE__ */ jsx(InterviewSessionsStatusScreen, {})
  },
  "karta-decision": {
    label: "KARTY N \u2014 Decision (harness odbioru 2026-07-21)",
    render: () => /* @__PURE__ */ jsx(KartaDecisionScreen, {})
  },
  "karta-notification": {
    label: "KARTY N \u2014 Notification (harness odbioru 2026-07-21)",
    render: () => /* @__PURE__ */ jsx(KartaNotificationScreen, {})
  },
  "karta-task": {
    label: "KARTY N \u2014 Task (harness odbioru 2026-07-21)",
    render: () => /* @__PURE__ */ jsx(KartaTaskScreen, {})
  },
  "karta-task-pelna": {
    label: "02-moja-praca \u2014 Task pe\u0142ny rekord (double-click, N-mode) \u2014 re-eksport karta-task, 145-nowe-ekrany 2026-08-31",
    render: () => /* @__PURE__ */ jsx(KartaTaskPelnaScreen, {})
  },
  "mywork-inbox": {
    label: "02-moja-praca \u2014 Skrzynka (zak\u0142adka domy\u015Blna) \u2014 145-nowe-ekrany 2026-08-31",
    render: () => /* @__PURE__ */ jsx(MyWorkInboxScreen, {})
  },
  "mywork-calendar": {
    label: "02-moja-praca \u2014 Kalendarz (widok bazowy) \u2014 145-nowe-ekrany 2026-08-31",
    render: () => /* @__PURE__ */ jsx(MyWorkCalendarScreen, {})
  },
  "mywork-decisions": {
    label: '02-moja-praca \u2014 Decyzje (DecisionsPanelContent, nast\u0119pca 12 wycofanych kolejek decyzyjnych) \u2014 dy\u017Cur "ekrany bez wpisu" 2026-09-03',
    render: () => /* @__PURE__ */ jsx(MyWorkDecisionsScreen, {})
  },
  "mywork-tasks": {
    label: '02-moja-praca \u2014 Zadania, widok LISTY (MyTasksListContent, r\xF3\u017Cny od pojedynczej karty karta-task.tsx) \u2014 dy\u017Cur "ekrany bez wpisu" 2026-09-03',
    render: () => /* @__PURE__ */ jsx(MyWorkTasksScreen, {})
  },
  "reports-hub-management": {
    label: 'Wyniki \u2014 Raporty zarz\u0105dcze PMO (ReportsHub: Team Meeting/Steering Committee/Portfolio Health/RAID) \u2014 dy\u017Cur "ekrany bez wpisu" 2026-09-03',
    render: () => /* @__PURE__ */ jsx(ReportsHubManagementScreen, {})
  },
  "preview-4-zakladki": {
    label: "KARTY N \u2014 Preview \u2014 4 zakladki My Work (harness odbioru 2026-07-21)",
    render: () => /* @__PURE__ */ jsx(PreviewZakladkiScreen, {})
  },
  "accent-soft-token-fix": {
    label: "J23 \u2014 bg-c-accent-soft opacity bug fix (cTok): odznaka REKOMENDACJA tint vs pe\u0142ny crimson",
    render: () => /* @__PURE__ */ jsx(AccentSoftTokenFixScreen, {})
  },
  "ui-foundation-focus-01-evidence": {
    label: "UI-FOUNDATION-FOCUS-01 \u2014 Visual QA evidence (Etap 2, 2026-08-03)",
    render: () => /* @__PURE__ */ jsx(UiFoundationFocus01EvidenceScreen, {})
  },
  "admin-command-center-panel": {
    label: "F-CC1\u2026F-CC4 Command Center \u2014 Overview (ju\u017C zdj\u0119te)/Audyt SOC2/DLP/Rezydencja/Retencja/Polityka AI (&tab=)",
    render: () => /* @__PURE__ */ jsx(AdminCommandCenterPanelScreen, {})
  },
  "admin-ai-control-center-panel": {
    label: "Day 218 \u2014 AI policy honest full/empty/unavailable states (&state=)",
    render: () => /* @__PURE__ */ jsx(AdminAIControlCenterPanelScreen, {})
  },
  "finance-hub": {
    label: 'GRAFIKA 17 \u2014 REALNY <FinanceHub> (ekran wej\u015Bciowy Finans\xF3w, brakuj\u0105ca \u201Epierwsza karta" \u2014 sze\u015B\u0107 analizowanych sp\xF3\u0142ek, PLN/EUR/USD/GBP). &tab=statements|analysis|models|prediction|valuation',
    render: () => /* @__PURE__ */ jsx(FinanceHubScreen, {})
  },
  "day233-finanse-rejestry": {
    label: "Day233 \u2014 realny FinanceHub, pi\u0119\u0107 rejestr\xF3w z fixture owner-review; &tab=statements|analysis|models|prediction|valuation",
    render: () => /* @__PURE__ */ jsx(Day233FinanseRejestryScreen, {})
  },
  "day233-finanse-panele": {
    label: "Day233 \u2014 21 realnych paneli Finans\xF3w; &panel=monte-carlo|real-options|frontier|sensitivity|scenarios|banking|cash-forecast|driver|driver-tree|extended-ratios|headcount|investment-appraisal|rolling-forecast|valuation-visuals|value|value-attribution|value-capture|value-ledger|variance-bridge|variance-narration|ev-basket",
    render: () => /* @__PURE__ */ jsx(Day233FinansePaneleScreen, {})
  },
  "admin-sso-self-service-card": {
    label: "HP-24 SSO self-service \u2014 SAML skonfigurowany (2 domeny) + panel wyniku testu",
    render: () => /* @__PURE__ */ jsx(AdminSsoSelfServiceCardScreen, {})
  },
  // admin-security (runda pełna) — odbiór grafiki 146-admin-security (2026-08-31),
  // domena "Bezpieczeństwo i tożsamość" (adminNavigation.ts), 10 ekranów,
  // mapowanie 1:1 z AdminSettingsModule.tsx case 'security'. security-policy
  // i sso są ALIASEM tej samej zakładki `policy` w AdminSecurityIdentityPanel
  // (WIRE_ONLY, nie błąd harnessu) — patrz nagłówek dev-render/screens/admin-security.tsx.
  "admin-security-security-policy": {
    label: "Admin security \u2014 Polityka bezpiecze\u0144stwa (AdminSecurityIdentityPanel tab=policy)",
    render: () => /* @__PURE__ */ jsx(AdminSecurityScreen, { adminScreen: "security-policy" })
  },
  "admin-security-sso": {
    label: "Admin security \u2014 SSO (ALIAS Polityki bezpiecze\u0144stwa, ta sama zak\u0142adka policy)",
    render: () => /* @__PURE__ */ jsx(AdminSecurityScreen, { adminScreen: "sso" })
  },
  "admin-security-scim-lifecycle": {
    label: "Admin security \u2014 SCIM i cykl \u017Cycia (AdminSecurityIdentityPanel tab=scim)",
    render: () => /* @__PURE__ */ jsx(AdminSecurityScreen, { adminScreen: "scim-lifecycle" })
  },
  "admin-security-sessions": {
    label: "Admin security \u2014 Sesje (AdminSessionsPanel, StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminSecurityScreen, { adminScreen: "sessions" })
  },
  "admin-security-api-access": {
    label: "Admin security \u2014 Dost\u0119p API (AdminSecurityIdentityPanel tab=api-access, ApiKeysManagementView)",
    render: () => /* @__PURE__ */ jsx(AdminSecurityScreen, { adminScreen: "api-access" })
  },
  "admin-security-domains": {
    label: "Admin security \u2014 Domeny (AdminDomainsPanel, StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminSecurityScreen, { adminScreen: "domains" })
  },
  "admin-security-service-accounts": {
    label: "Admin security \u2014 Konta us\u0142ugowe (AdminServiceAccountsPanel, StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminSecurityScreen, { adminScreen: "service-accounts" })
  },
  "admin-security-security-alerts": {
    label: "Admin security \u2014 Alerty bezpiecze\u0144stwa (AdminSecurityAlertsPanel, StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminSecurityScreen, { adminScreen: "security-alerts" })
  },
  "admin-security-break-glass": {
    label: "Admin security \u2014 Break-glass (AdminBreakGlassPanel, StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminSecurityScreen, { adminScreen: "break-glass" })
  },
  "admin-security-risk-summary": {
    label: "Admin security \u2014 Podsumowanie ryzyka (AdminSecurityIdentityPanel tab=risk)",
    render: () => /* @__PURE__ */ jsx(AdminSecurityScreen, { adminScreen: "risk-summary" })
  },
  // admin-billing (runda pełna) — odbiór grafiki 146-admin-billing (2026-08-31),
  // domena "Rozliczenia i plany" (adminNavigation.ts), 9 ekranów, mapowanie
  // 1:1 z AdminSettingsModule.tsx case 'billing'. Dwie pary są aliasami tej
  // samej zakładki w produkcie (usage-costs≡overview, billing-details≡budgets-alerts)
  // — patrz nagłówek dev-render/screens/admin-billing.tsx.
  "admin-billing-overview": {
    label: "Admin billing \u2014 Przegl\u0105d (AdminBillingFinOpsPanel screen=summary)",
    render: () => /* @__PURE__ */ jsx(AdminBillingScreen, { adminScreen: "overview" })
  },
  "admin-billing-plan-limits": {
    label: "Admin billing \u2014 Plan i limity (AdminBillingFinOpsPanel screen=plan)",
    render: () => /* @__PURE__ */ jsx(AdminBillingScreen, { adminScreen: "plan-limits" })
  },
  "admin-billing-usage-costs": {
    label: "Admin billing \u2014 Wykorzystanie i koszty (ALIAS Przegl\u0105du, ta sama zak\u0142adka summary)",
    render: () => /* @__PURE__ */ jsx(AdminBillingScreen, { adminScreen: "usage-costs" })
  },
  "admin-billing-payment-methods": {
    label: "Admin billing \u2014 Metody p\u0142atno\u015Bci (AdminBillingFinOpsPanel screen=payments)",
    render: () => /* @__PURE__ */ jsx(AdminBillingScreen, { adminScreen: "payment-methods" })
  },
  "admin-billing-invoices": {
    label: "Admin billing \u2014 Faktury (AdminBillingFinOpsPanel screen=invoices)",
    render: () => /* @__PURE__ */ jsx(AdminBillingScreen, { adminScreen: "invoices" })
  },
  "admin-billing-seats-licences": {
    label: "Admin billing \u2014 Miejsca i licencje (AdminSeatsLicencesPanel, StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminBillingScreen, { adminScreen: "seats-licences" })
  },
  "admin-billing-billing-details": {
    label: "Admin billing \u2014 Dane rozliczeniowe (ALIAS Bud\u017Cet\xF3w i alert\xF3w, ta sama zak\u0142adka controls)",
    render: () => /* @__PURE__ */ jsx(AdminBillingScreen, { adminScreen: "billing-details" })
  },
  "admin-billing-budgets-alerts": {
    label: "Admin billing \u2014 Bud\u017Cety i alerty (AdminBillingFinOpsPanel screen=controls)",
    render: () => /* @__PURE__ */ jsx(AdminBillingScreen, { adminScreen: "budgets-alerts" })
  },
  "admin-billing-plan-history": {
    label: "Admin billing \u2014 Historia zmian planu (AdminPlanHistoryPanel, StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminBillingScreen, { adminScreen: "plan-history" })
  },
  // admin-team (runda pełna) — odbiór grafiki 146-admin-team (2026-08-31),
  // domena "Zespół i dostęp" (adminNavigation.ts), 8 ekranów, mapowanie 1:1
  // z AdminSettingsModule.tsx case 'team'. Patrz nagłówek
  // dev-render/screens/admin-team.tsx dla mapowania komponentów i endpointów.
  "admin-team-members": {
    label: "Admin team \u2014 U\u017Cytkownicy (AdminMembersRolesPanel screen=members)",
    render: () => /* @__PURE__ */ jsx(AdminTeamScreen, { adminScreen: "members" })
  },
  "admin-team-invitations": {
    label: "Admin team \u2014 Zaproszenia (AdminMembersRolesPanel screen=invitations, StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminTeamScreen, { adminScreen: "invitations" })
  },
  "admin-team-roles-permissions": {
    label: "Admin team \u2014 Role i uprawnienia (AdminRolesPermissionsPanel, StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminTeamScreen, { adminScreen: "roles-permissions" })
  },
  "admin-team-teams": {
    label: "Admin team \u2014 Zespo\u0142y (AdminTeamsPanel, StandardTable + panel cz\u0142onk\xF3w po klikni\u0119ciu)",
    render: () => /* @__PURE__ */ jsx(AdminTeamScreen, { adminScreen: "teams" })
  },
  "admin-team-guests-external": {
    label: "Admin team \u2014 Go\u015Bcie i dost\u0119p zewn\u0119trzny (AdminGuestsPanel, StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminTeamScreen, { adminScreen: "guests-external" })
  },
  "admin-team-access-requests": {
    label: "Admin team \u2014 Wnioski o dost\u0119p (AdminAccessRequestsPanel \u2014 STATYCZNY placeholder, brak API)",
    render: () => /* @__PURE__ */ jsx(AdminTeamScreen, { adminScreen: "access-requests" })
  },
  "admin-team-access-reviews": {
    label: "Admin team \u2014 Przegl\u0105dy dost\u0119p\xF3w (AdminAccessReviewsPanel, StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminTeamScreen, { adminScreen: "access-reviews" })
  },
  "admin-team-ownership": {
    label: "Admin team \u2014 W\u0142asno\u015B\u0107 (AdminMembersRolesPanel screen=ownership \u2192 OwnershipManagementView)",
    render: () => /* @__PURE__ */ jsx(AdminTeamScreen, { adminScreen: "ownership" })
  },
  // admin-ai (runda pełna) — odbiór grafiki 146-admin-ai (2026-08-31), domena
  // "Sterowanie AI" (adminNavigation.ts), 10 ekranów, mapowanie 1:1 z
  // AdminSettingsModule.tsx case 'ai' + AI_MODULE_TAB_BY_SCREEN. Pięć z nich
  // (models-providers/ai-limits-budgets/data-privacy/ai-operations/ai-audit)
  // dzielą tę samą powłokę AdminAIControlCenterPanel→AIModule z podwójnym
  // wewnętrznym pill-tabs — patrz nagłówek dev-render/screens/admin-ai.tsx.
  "admin-ai-policy-autonomy": {
    label: "Admin ai \u2014 Polityka i autonomia (AdminAIControlCenterPanel tab=settings \u2192 OrgAISettingsView, tab policy)",
    render: () => /* @__PURE__ */ jsx(AdminAiScreen, { adminScreen: "policy-autonomy" })
  },
  "admin-ai-personas": {
    label: "Admin ai \u2014 Persony (PersonasPanel)",
    render: () => /* @__PURE__ */ jsx(AdminAiScreen, { adminScreen: "personas" })
  },
  "admin-ai-models-providers": {
    label: "Admin ai \u2014 Modele i dostawcy (AIModule tab=models-providers \u2192 ModelsProvidersTab, tabela HTML surowa, bez StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminAiScreen, { adminScreen: "models-providers" })
  },
  "admin-ai-ai-limits-budgets": {
    label: "Admin ai \u2014 Limity i bud\u017Cety (AIModule tab=access-limits \u2192 AccessLimitsTab, tabela HTML surowa, bez StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminAiScreen, { adminScreen: "ai-limits-budgets" })
  },
  "admin-ai-data-privacy": {
    label: "Admin ai \u2014 Dane i prywatno\u015B\u0107 (AIModule tab=features-privacy \u2192 FeaturesPrivacyTab)",
    render: () => /* @__PURE__ */ jsx(AdminAiScreen, { adminScreen: "data-privacy" })
  },
  "admin-ai-quality-evaluations": {
    label: "Admin ai \u2014 Ewaluacje jako\u015Bci (AdminAiQualityPanel, StandardTable \xD72)",
    render: () => /* @__PURE__ */ jsx(AdminAiScreen, { adminScreen: "quality-evaluations" })
  },
  "admin-ai-ai-incidents": {
    label: "Admin ai \u2014 Incydenty AI (AdminAiIncidentsPanel, StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminAiScreen, { adminScreen: "ai-incidents" })
  },
  "admin-ai-configuration-versions": {
    label: "Admin ai \u2014 Wersje konfiguracji (AdminConfigurationVersionsPanel, StandardTable, V8 prompt-os)",
    render: () => /* @__PURE__ */ jsx(AdminAiScreen, { adminScreen: "configuration-versions" })
  },
  "admin-ai-ai-operations": {
    label: "Admin ai \u2014 Operacje AI (AIModule tab=ai-health \u2192 AIMissionControl)",
    render: () => /* @__PURE__ */ jsx(AdminAiScreen, { adminScreen: "ai-operations" })
  },
  "admin-ai-ai-audit": {
    label: "Admin ai \u2014 Audyt AI (AIModule tab=audit-compliance \u2192 AuditComplianceTab, tabela HTML surowa, bez StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminAiScreen, { adminScreen: "ai-audit" })
  },
  // admin-audit-health (runda pełna) — odbiór grafiki 146-admin-audit-health
  // (2026-08-31), domeny "Dziennik audytu" (audit) i "Stan systemu" (health)
  // z adminNavigation.ts, mapowanie 1:1 z AdminSettingsModule.tsx case
  // 'audit' / case 'health'. Trzy pary aliasów tej samej zakładki w
  // produkcie (high-risk-changes≡events, retention-export≡events,
  // diagnostics≡service-status) i osobny gate UNAUTHORIZED dla
  // platform-operations (CAN_ACCESS_PLATFORM_OPERATIONS na sztywno false)
  // — patrz nagłówki dev-render/screens/admin-audit.tsx i admin-health.tsx.
  "admin-audit-events": {
    label: "Admin audit \u2014 Zdarzenia (AdminAuditLogPanel, FilterableTable)",
    render: () => /* @__PURE__ */ jsx(AdminAuditScreen, { adminScreen: "events" })
  },
  "admin-audit-high-risk-changes": {
    label: "Admin audit \u2014 Zmiany wysokiego ryzyka (ALIAS Zdarze\u0144, ten sam AdminAuditLogPanel)",
    render: () => /* @__PURE__ */ jsx(AdminAuditScreen, { adminScreen: "high-risk-changes" })
  },
  "admin-audit-compliance-evidence": {
    label: "Admin audit \u2014 Dowody zgodno\u015Bci (AdminComplianceEvidencePanel, StandardTable \u2014 kolumny Zdarzenie/Aktor/Ryzyko PUSTE, patrz nag\u0142\xF3wek pliku)",
    render: () => /* @__PURE__ */ jsx(AdminAuditScreen, { adminScreen: "compliance-evidence" })
  },
  "admin-audit-retention-export": {
    label: "Admin audit \u2014 Retencja i eksport (ALIAS Zdarze\u0144, ten sam AdminAuditLogPanel)",
    render: () => /* @__PURE__ */ jsx(AdminAuditScreen, { adminScreen: "retention-export" })
  },
  "admin-audit-integrity": {
    label: "Admin audit \u2014 Integralno\u015B\u0107 (AdminAuditIntegrityPanel, karty, bez tabeli)",
    render: () => /* @__PURE__ */ jsx(AdminAuditScreen, { adminScreen: "integrity" })
  },
  "admin-audit-legal-hold": {
    label: "Admin audit \u2014 Legal hold (AdminLegalHoldPanel, karta statusu, bez tabeli)",
    render: () => /* @__PURE__ */ jsx(AdminAuditScreen, { adminScreen: "legal-hold" })
  },
  "admin-audit-export-history": {
    label: "Admin audit \u2014 Historia eksport\xF3w (AdminAuditExportHistoryPanel, StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminAuditScreen, { adminScreen: "export-history" })
  },
  "admin-health-service-status": {
    label: "Admin health \u2014 Stan us\u0142ug (AdminHealthPanel canRunDiagnostics=false \u2192 statyczna karta UNKNOWN, patrz nag\u0142\xF3wek pliku)",
    render: () => /* @__PURE__ */ jsx(AdminHealthScreen, { adminScreen: "service-status" })
  },
  "admin-health-diagnostics": {
    label: "Admin health \u2014 Diagnostyka (ALIAS Stanu us\u0142ug, ten sam AdminHealthPanel)",
    render: () => /* @__PURE__ */ jsx(AdminHealthScreen, { adminScreen: "diagnostics" })
  },
  "admin-health-dependencies": {
    label: "Admin health \u2014 Zale\u017Cno\u015Bci (AdminDependenciesPanel, karty <details>, bez tabeli)",
    render: () => /* @__PURE__ */ jsx(AdminHealthScreen, { adminScreen: "dependencies" })
  },
  "admin-health-incident-history": {
    label: "Admin health \u2014 Historia incydent\xF3w (AdminIncidentHistoryPanel, karty, bez tabeli)",
    render: () => /* @__PURE__ */ jsx(AdminHealthScreen, { adminScreen: "incident-history" })
  },
  "admin-health-queues-jobs": {
    label: "Admin health \u2014 Kolejki i zadania (AdminJobsPanel, StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminHealthScreen, { adminScreen: "queues-jobs" })
  },
  "admin-health-sla-slo": {
    label: "Admin health \u2014 SLA / SLO (AdminSlaSloPanel, karty, bez tabeli)",
    render: () => /* @__PURE__ */ jsx(AdminHealthScreen, { adminScreen: "sla-slo" })
  },
  "admin-health-platform-operations": {
    label: "Admin health \u2014 Operacje platformowe (gate UNAUTHORIZED, odfiltrowane z menu \u2014 brak dost\u0119pu z nawigacji)",
    render: () => /* @__PURE__ */ jsx(AdminHealthScreen, { adminScreen: "platform-operations" })
  },
  // admin-command (runda pełna) — odbiór grafiki 146-admin-command
  // (2026-08-31), domena "Centrum administracyjne" (adminNavigation.ts), 11
  // ekranów, mapowanie 1:1 z AdminSettingsModule.tsx case 'command'. Po
  // naprawie ADM-OWN-001 (DEC night-fixes-b-20260826) żaden z 11 nie jest
  // aliasem innego — organization-defaults ma osobny komponent (formularz,
  // bez StandardTable, to poprawne dla tego typu treści), pozostałe 10 mają
  // odrębną treść wewnątrz AdminCommandCenterPanel. Patrz nagłówek
  // dev-render/screens/admin-command.tsx dla mapowania endpointów i
  // ZNALEZISKA (bug w attention-queue: sygnał "ryzyko" czyta płaską ścieżkę
  // `risk?.highRiskCount`, backend zwraca zagnieżdżoną
  // `risk.summary.audit.highRiskCount` — sygnał zawsze pokazuje 0/info).
  "admin-command-overview": {
    label: "Admin command \u2014 Przegl\u0105d (AdminCommandCenterPanel aggregationOnly, kafle+podsumowania)",
    render: () => /* @__PURE__ */ jsx(AdminCommandScreen, { adminScreen: "overview" })
  },
  "admin-command-attention-queue": {
    label: "Admin command \u2014 Kolejka uwagi (CommandCenterAttentionQueue; ZNALEZISKO: sygna\u0142 ryzyka zawsze info/0, patrz nag\u0142\xF3wek admin-command.tsx)",
    render: () => /* @__PURE__ */ jsx(AdminCommandScreen, { adminScreen: "attention-queue" })
  },
  "admin-command-cost-capacity": {
    label: "Admin command \u2014 Koszt i pojemno\u015B\u0107 (CommandCenterCostCapacity, StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminCommandScreen, { adminScreen: "cost-capacity" })
  },
  "admin-command-organization-defaults": {
    label: "Admin command \u2014 Ustawienia domy\u015Blne organizacji (AdminOrganizationDefaultsPanel, formularz surowy <label>/<input>)",
    render: () => /* @__PURE__ */ jsx(AdminCommandScreen, { adminScreen: "organization-defaults" })
  },
  "admin-command-agent-trace": {
    label: "Admin command \u2014 \u015Alad agent\xF3w (CommandCenterAgentTraceTab, StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminCommandScreen, { adminScreen: "agent-trace" })
  },
  "admin-command-audit": {
    label: "Admin command \u2014 Audyt SOC2 (CommandCenterAuditTab, StandardTable)",
    render: () => /* @__PURE__ */ jsx(AdminCommandScreen, { adminScreen: "audit" })
  },
  "admin-command-dlp": {
    label: "Admin command \u2014 DLP (CommandCenterDlpTab, StandardTable+kebab)",
    render: () => /* @__PURE__ */ jsx(AdminCommandScreen, { adminScreen: "dlp" })
  },
  "admin-command-residency": {
    label: "Admin command \u2014 Rezydencja danych (CommandCenterResidencyTab, formularz)",
    render: () => /* @__PURE__ */ jsx(AdminCommandScreen, { adminScreen: "residency" })
  },
  "admin-command-retention": {
    label: "Admin command \u2014 Retencja (CommandCenterRetentionTab, StandardTable, inline edit)",
    render: () => /* @__PURE__ */ jsx(AdminCommandScreen, { adminScreen: "retention" })
  },
  "admin-command-ai-policy": {
    label: "Admin command \u2014 Polityka AI (CommandCenterAiPolicyTab, formularz)",
    render: () => /* @__PURE__ */ jsx(AdminCommandScreen, { adminScreen: "ai-policy" })
  },
  "admin-command-benchmark": {
    label: "Admin command \u2014 Benchmark konsultingowy (CommandCenterBenchmarkTab, karty statyczne)",
    render: () => /* @__PURE__ */ jsx(AdminCommandScreen, { adminScreen: "benchmark" })
  },
  "superadmin-platform-operations-day15": {
    label: "Day 15 \u2014 REALNY <PlatformOperationsView>, katalogi fixture; &scene=ready|empty|error",
    render: () => /* @__PURE__ */ jsx(SuperadminPlatformOperationsDay15Screen, {})
  },
  "agent-plan-view": {
    label: "HP-4 F3 \u2014 /agent-plan entry point (AgentManifestLauncher \u2192 AgentPlanPanel), ff_agentPlan; append &ff_agentPlan=1 to the URL",
    render: () => /* @__PURE__ */ jsx(AgentPlanViewScreen, {})
  },
  "agent-plan-canvas": {
    label: "AGT-007 \u2014 AgentPlanCanvas przestawialny schemat (\u015Bcie\u017Cka \u2460 5-fazowy vs \u2461 pusty), status planning",
    render: () => /* @__PURE__ */ jsx(AgentPlanCanvasScreen, {})
  },
  "day207-write-proposal": {
    label: "Day207 \u2014 real ExecutionProposalMessage for a same-turn pending WRITE proposal",
    render: () => /* @__PURE__ */ jsx(Day207WriteProposalScreen, {})
  },
  "day221-audyty-warsztat": {
    label: "Day221 \u2014 Audyty D-5: prototyp warsztatu, SPEC-A Rekord L, 18 ogniw / 4 fazy / prawy panel",
    render: () => /* @__PURE__ */ jsx(Day221AudytyWarsztatScreen, {})
  },
  "day220-audyty-rejestr": {
    label: "Day220 \u2014 Audyty: Sesje/Raporty/Ustalenia, pe\u0142ne polskie warto\u015Bci; &view=processes|reports|findings",
    render: () => /* @__PURE__ */ jsx(Day220AudytyRejestrScreen, {})
  },
  "agent-hub": {
    label: "AGT-010 \u2014 pow\u0142oka Run agent (Moje procesy | Szablony) PRZED AgentPlanWorkspace, tabela planning/executing/awaiting_approval/completed/failed",
    render: () => /* @__PURE__ */ jsx(AgentHubScreen, {})
  },
  "tabele-fala2-przed-po": {
    label: "FALA TABEL 2026-07-28 \u2014 PRZED/PO: priorytet kropka+tekst (N-24/N-29), Delete na ko\u0144cu stopki podgl\u0105du (PILNE-10), kontrola regresji Approve/Reject",
    render: () => /* @__PURE__ */ jsx(TabeleFala2PrzedPoScreen, {})
  },
  "menu-dlugi-domkniecie": {
    label: 'AGT-015 \xA76 D1-D4 \u2014 ikona CTA/\u201ENowy agent"/FolderCreateDialog, montowane z REALNYM HubBarSlotsProvider (agent-hub bez providera nie pokazuje Menu 2). &empty=1 \u2192 agent-hub empty-state',
    render: () => /* @__PURE__ */ jsx(MenuDlugiDomkniecieScreen, {})
  },
  "agent-warsztat": {
    label: "WARSZTAT AGENTA \u2014 3 kolumny (sterowanie \xB7 schemat blokowy \xB7 paleta klock\xF3w); &case=planning|executing|approval",
    render: () => /* @__PURE__ */ jsx(AgentWarsztatScreen, {})
  },
  "vault-sejf-wnetrze": {
    label: 'VAULT \u2014 wn\u0119trze sejfu po redesignie (Menu 1/2/3 + StandardTable + preview + panel \u201EDodaj dokument"). ?pusty=1 \u2192 stan pusty',
    render: () => /* @__PURE__ */ jsx(VaultSejfWnetrzeScreen, {})
  },
  "vault-folder-block-proof": {
    label: 'VLT-FOLDERS \u2014 klocek "Vault-kontekst" (AgentPlanCanvas): select Poziom + DRUGI select Folder wewn\u0105trz sejfu',
    render: () => /* @__PURE__ */ jsx(VaultFolderBlockProofScreen, {})
  },
  "mywork-idea-inspector-lekki": {
    label: "DEC-68 \u2014 LEKKI inspektor elementu Idea (360px, accordion, bez obw\xF3dek) wg mywork-inspektor-prototyp.html",
    render: () => /* @__PURE__ */ jsx(PrototypeHarness, { context: "idea", legacy: /* @__PURE__ */ jsx(MyWorkIdeaInspectorLekkiScreen, {}) })
  },
  "mywork-notebook-rail-speca": {
    label: "DEC-69 \u2014 prawa szyna Notatnika w kanonie SPEC-A (5 sekcji accordion, nie tabs) wg mywork-notatnik-szyna-prototyp.html. NAPRAWA (2026-08-30): flaga ff_notebookSpecAShell jest domy\u015Blnie OFF i harness jej nie ustawia\u0142 \u2014 ten wpis teraz FORSUJE j\u0105 ON (localStorage), wi\u0119c ekran pokazuje SPEC-A, nie stary panel. Por\xF3wnanie ze STARYM: mywork-notebook-rail-speca-stary.",
    render: () => /* @__PURE__ */ jsx(PrototypeHarness, { context: "notebook", legacy: /* @__PURE__ */ jsx(MyWorkNotebookRailSpecAScreen, { specA: true }) })
  },
  "mywork-notebook-rail-speca-stary": {
    label: "DEC-69 \u2014 jw., ale STARA szyna Notatnika (ff_notebookSpecAShell wymuszona OFF) \u2014 do por\xF3wnania PRZED/PO z mywork-notebook-rail-speca.",
    render: () => /* @__PURE__ */ jsx(MyWorkNotebookRailSpecAScreen, { specA: false })
  },
  "prawy-pas-notatnik-artefakt": {
    label: "PRAWY PAS (system) \u2014 Notatnik, tryb ARTEFAKT (akordeon kanonu). Wymaga ?ff_artifact_right_rail=1",
    render: () => /* @__PURE__ */ jsx(PrawyPasNotatnikSystemScreen, { tryb: "artefakt" })
  },
  "prawy-pas-notatnik-teresa": {
    label: "PRAWY PAS (system) \u2014 Notatnik, tryb TERESA (pe\u0142na wysoko\u015B\u0107, w\u0142asne pole pisania). Wymaga ?ff_artifact_right_rail=1",
    render: () => /* @__PURE__ */ jsx(PrawyPasNotatnikSystemScreen, { tryb: "teresa" })
  },
  "prawy-pas-notatnik-struktura": {
    label: "PRAWY PAS (system) \u2014 Notatnik, tryb zale\u017Cny od typu: STRUKTURA NOTATKI. Wymaga ?ff_artifact_right_rail=1",
    render: () => /* @__PURE__ */ jsx(PrawyPasNotatnikSystemScreen, { tryb: "struktura" })
  },
  "prawy-pas-idea-artefakt": {
    label: 'PRAWY PAS (system) \u2014 Idea, tryb ARTEFAKT (akordeon kanonu, bez \u201EHistoria" \u2014 bez zastosowania). Wymaga ?ff_artifact_right_rail=1',
    render: () => /* @__PURE__ */ jsx(PrawyPasIdeaSystemScreen, { tryb: "artefakt" })
  },
  "prawy-pas-idea-teresa": {
    label: 'PRAWY PAS (system) \u2014 Idea, tryb TERESA (4 komendy + CTA \u201ERozmawiaj z Teres\u0105", wyj\u0119te z akordeonu). Wymaga ?ff_artifact_right_rail=1',
    render: () => /* @__PURE__ */ jsx(PrawyPasIdeaSystemScreen, { tryb: "teresa" })
  },
  "prawy-pas-idea-sugestie": {
    label: "PRAWY PAS (system) \u2014 Idea, tryb zale\u017Cny od typu: SUGESTIE (IdeaAISuggestionsPanel, w\u0142asna ikona szyny). Wymaga ?ff_artifact_right_rail=1",
    render: () => /* @__PURE__ */ jsx(PrawyPasIdeaSystemScreen, { tryb: "sugestie" })
  },
  // Trzeci krok rozwożenia (2026-08-30, ANALIZA_PRAWY_PANEL.md §7 krok 4):
  // Tabele — powierzchnia TRUDNA (7 narzędzi „po artefakcie" bez ŻADNEJ
  // sekcji „o artefakcie" — dodajemy ósmy, pierwszy tool `'artefakt'`,
  // reszta 1:1). Wymaga TAKŻE `?ff_melsTabele=1` — `<TabeleView>` montuje
  // `TabeleMelsView` (jedyny konsument `TabeleRightRail.tsx`) tylko za tą
  // WCZEŚNIEJSZĄ, osobną flagą (domyślnie OFF, EPIC-T16); bez niej ten
  // harness renderowałby legacy `KimiWorkspaceShell`, który nie ma right
  // railu wcale (zła powierzchnia — patrz pułapka z arkuszem, CLAUDE.md).
  "prawy-pas-tabele-off": {
    label: "PRAWY PAS (system) \u2014 Tabele, STAN DZISIEJSZY, szyna ZAMKNI\u0118TA (bez propa activeRightRailToolId \u2014 dok\u0142adnie jak w produkcji). Wymaga ?ff_melsTabele=1 \u2014 sumy kontrolne z tym wpisem PRZED zmian\u0105 dowodz\u0105 OFF-identyczno\u015Bci niezale\u017Cnie od harness-owego propa steruj\u0105cego.",
    render: () => /* @__PURE__ */ jsx(PrawyPasTabeleSystemScreen, { tryb: "closed" })
  },
  "prawy-pas-tabele-search": {
    label: 'PRAWY PAS (system) \u2014 Tabele, tryb SEARCH (pierwszy tool \u201Epo artefakcie", stan dzisiejszy z otwartym panelem). Wymaga ?ff_melsTabele=1',
    render: () => /* @__PURE__ */ jsx(PrawyPasTabeleSystemScreen, { tryb: "search" })
  },
  "prawy-pas-tabele-artefakt": {
    label: "PRAWY PAS (system) \u2014 Tabele, tryb ARTEFAKT (akordeon kanonu: W\u0142a\u015Bciwo\u015Bci/Powi\u0105zania/Komentarze \u2014 jedyne z realnymi danymi). Wymaga ?ff_melsTabele=1&ff_artifact_right_rail=1",
    render: () => /* @__PURE__ */ jsx(PrawyPasTabeleSystemScreen, { tryb: "artefakt" })
  },
  // Czwarty/piąty krok rozwożenia (2026-08-31, tor grafiki, dwie „trudne"
  // szyny): Prezentacje (generator) — dziś JEDEN identyfikator `activity`
  // bez akordeonu. Baseline OFF renderuje się bez `?ff_artifact_right_rail`.
  "prawy-pas-prezentacje-off": {
    label: 'PRAWY PAS (system) \u2014 Prezentacje (generator), STAN DZISIEJSZY (ikona \u201EActivity", bez akordeonu) \u2014 sumy kontrolne z tym wpisem PRZED zmian\u0105 dowodz\u0105 OFF-identyczno\u015Bci.',
    render: () => /* @__PURE__ */ jsx(PrawyPasPrezentacjeSystemScreen, {})
  },
  "prawy-pas-prezentacje-artefakt": {
    label: "PRAWY PAS (system) \u2014 Prezentacje (generator), tryb ARTEFAKT (akordeon kanonu, jedyna zastosowana sekcja: Historia). Wymaga ?ff_artifact_right_rail=1",
    render: () => /* @__PURE__ */ jsx(PrawyPasPrezentacjeSystemScreen, {})
  },
  // Deck Builder — dziś SZEŚĆ płaskich identyfikatorów (blocks/media/
  // evidence/relations/comments/activity) na jednej szynie. ON: Blocks
  // (po artefakcie, osobna ikona) → Artefakt (Powiązania/Źródła/Komentarze/
  // Historia scalone w akordeon).
  "prawy-pas-deck-builder-off": {
    label: "PRAWY PAS (system) \u2014 Deck Builder, STAN DZISIEJSZY (5 p\u0142askich ikon: Blocks/Comments/Activity/Relations/Evidence) \u2014 sumy kontrolne z tym wpisem PRZED zmian\u0105 dowodz\u0105 OFF-identyczno\u015Bci.",
    render: () => /* @__PURE__ */ jsx(PrawyPasDeckBuilderSystemScreen, {})
  },
  "prawy-pas-deck-builder-blocks": {
    label: "PRAWY PAS (system) \u2014 Deck Builder, tryb PO ARTEFAKCIE: BLOCKS (osobna ikona, \u017Cywa edycja). Wymaga ?ff_artifact_right_rail=1",
    render: () => /* @__PURE__ */ jsx(PrawyPasDeckBuilderSystemScreen, { tryb: "blocks" })
  },
  "prawy-pas-deck-builder-artefakt": {
    label: "PRAWY PAS (system) \u2014 Deck Builder, tryb ARTEFAKT (akordeon kanonu: Powi\u0105zania/\u0179r\xF3d\u0142a i za\u0142o\u017Cenia/Komentarze/Historia, scalone z 4 dawnych p\u0142askich ikon). Wymaga ?ff_artifact_right_rail=1",
    render: () => /* @__PURE__ */ jsx(PrawyPasDeckBuilderSystemScreen, { tryb: "artefakt" })
  },
  "capability-gate-demo": {
    label: "Faza C \u2014 CapabilityGate: shadow vs debugCapabilities vs enforce (model r\xF3l PM)",
    render: () => /* @__PURE__ */ jsx(CapabilityGateDemoScreen, {})
  },
  "template-create-wizard": {
    label: "#83c START kreatora szablonu (nazwa \u2192 typ \u2192 dost\u0119pno\u015B\u0107)",
    render: () => /* @__PURE__ */ jsx(TemplateCreateWizardScreen, {})
  },
  "public-booking-widget": {
    label: "#24c Publiczny widget booking (Calendly-like, niezalogowany) \u2014 CTA neutralny",
    render: () => /* @__PURE__ */ jsx(PublicBookingWidgetScreen, {})
  },
  "document-studio-blocks-i18n": {
    label: "M18 #3 \u2014 Document Studio bloki: puste stany i18n (Table/Kpi/Chart)",
    render: () => /* @__PURE__ */ jsx(DocumentStudioBlocksI18nScreen, {})
  },
  "document-studio-m1-share-primary": {
    label: 'M18 #2 \u2014 Document Studio M1: "Udost\u0119pnij" primary, Export DOCX obok (kanon Formu\u0142y)',
    render: () => /* @__PURE__ */ jsx(DocumentStudioM1SharePrimaryScreen, {})
  },
  "document-studio-nowy-dokument-martwe-przyciski": {
    label: "P-10/P-11/P-12 (2026-07-28) \u2014 Nowy dokument: edycja tytu\u0142u, Cofnij/Pon\xF3w, przyciski paska",
    render: () => /* @__PURE__ */ jsx(DocumentStudioNowyDokumentMartweprzyciskiScreen, {})
  },
  "wave3-creators-crimson": {
    label: "Fala 3 \u2014 ReportBuilder+AIChat+Meeting: crimson-fill CTA sweep (swatch, PO naprawie)",
    render: () => /* @__PURE__ */ jsx(Wave3CreatorsCrimsonScreen, {})
  },
  "template-library-new-entry": {
    label: 'Wpi\u0119cie \u201ENowy szablon" (Biblioteka wzorc\xF3w \u2192 TemplateBuilderFlow)',
    render: () => /* @__PURE__ */ jsx(TemplateLibraryNewEntryScreen, {})
  },
  "template-builder-doc": {
    label: "#83c/#83d Builder DOKUMENT (Word) \u2014 wsp\xF3lna pow\u0142oka MELS",
    render: () => /* @__PURE__ */ jsx(TemplateBuilderDocScreen, {})
  },
  "template-builder-deck": {
    label: "#83c/#83d Builder PREZENTACJA (Deck) \u2014 wsp\xF3lna pow\u0142oka MELS",
    render: () => /* @__PURE__ */ jsx(TemplateBuilderDeckScreen, {})
  },
  "template-builder-table": {
    label: "#83c/#83d Builder ARKUSZ (Excel) \u2014 wsp\xF3lna pow\u0142oka MELS",
    render: () => /* @__PURE__ */ jsx(TemplateBuilderTableScreen, {})
  },
  "notatnik-centrum-mysli": {
    label: "Notatnik = CENTRUM MY\u015ALI (#16 auto-notatka \xB7 #21 przypomnij \xB7 #23 presence)",
    render: () => /* @__PURE__ */ jsx(PrototypeHarness, { context: "notebook", legacy: /* @__PURE__ */ jsx(NotatnikCentrumMysliScreen, {}) })
  },
  "notatnik-osierocone-graf": {
    label: "#18 Notatnik \u2014 graf po\u0142\u0105cze\u0144 (naprawiony) + osierocone notatki",
    render: () => /* @__PURE__ */ jsx(NotatnikOsieroconeGrafScreen, {})
  },
  "ev-football-field": {
    label: "EV Basket Football Field (Finance)",
    render: () => /* @__PURE__ */ jsx(EvFootballFieldScreen, {})
  },
  "finance-value-panels": {
    label: "Section B \u2014 M16 ValueOffice + DriverPlanner: real-data wiring, POPULATED vs EMPTY (&panel=value|driver &state=populated|empty)",
    render: () => /* @__PURE__ */ jsx(FinanceValuePanelsScreen, {})
  },
  "day200-finance-panels": {
    label: "Dy\u017Cur 200 \u2014 pozosta\u0142ych 14/21 paneli finans\xF3w (&panel=banking|cash-forecast|driver-tree|extended-ratios|headcount|investment-appraisal|rolling-forecast|valuation-visuals|value-attribution|value-capture|value-ledger|variance-bridge|variance-narration|ev-basket)",
    render: () => /* @__PURE__ */ jsx(Day200FinancePanelsScreen, {})
  },
  "finance-model-workspace": {
    label: "Finance model workspace",
    render: () => /* @__PURE__ */ jsx(FinanceModelWorkspaceScreen, {})
  },
  "finance-workspace-bar": {
    label: "Finance workspace bar",
    render: () => /* @__PURE__ */ jsx(FinanceWorkspaceBarScreen, {})
  },
  "finance-focus-mode": { label: "Finance focus mode", render: () => /* @__PURE__ */ jsx(FinanceFocusModeScreen, {}) },
  "finance-statement-pack-workspace-v2": {
    label: "Finance statement pack workspace",
    render: () => /* @__PURE__ */ jsx(FinanceStatementPackWorkspaceV2Screen, {})
  },
  "finance-baseline-workspace": {
    label: "Finance baseline workspace",
    render: () => /* @__PURE__ */ jsx(FinanceBaselineWorkspaceScreen, {})
  },
  "finance-prediction-workspace": {
    label: "Finance prediction workspace",
    render: () => /* @__PURE__ */ jsx(FinancePredictionWorkspaceScreen, {})
  },
  "finance-id-bridge": { label: "Finance ID bridge", render: () => /* @__PURE__ */ jsx(FinanceIdBridgeScreen, {}) },
  "finance-analysis-workspace": {
    label: "Finance analysis workspace",
    render: () => /* @__PURE__ */ jsx(FinanceAnalysisWorkspaceScreen, {})
  },
  "finance-valuation-workspace": {
    label: "Finance valuation workspace",
    render: () => /* @__PURE__ */ jsx(FinanceValuationWorkspaceScreen, {})
  },
  "finance-lineage-navigator": {
    label: "Finance lineage navigator",
    render: () => /* @__PURE__ */ jsx(FinanceLineageNavigatorScreen, {})
  },
  "finance-compare-panel": {
    label: "Finance compare panel",
    render: () => /* @__PURE__ */ jsx(FinanceComparePanelScreen, {})
  },
  "finance-comments-panel": {
    label: "Finance comments panel",
    render: () => /* @__PURE__ */ jsx(FinanceCommentsPanelScreen, {})
  },
  "finance-saved-views-panel": {
    label: "Finance saved views panel",
    render: () => /* @__PURE__ */ jsx(FinanceSavedViewsPanelScreen, {})
  },
  "finance-export-import-panel": {
    label: "Finance export import panel",
    render: () => /* @__PURE__ */ jsx(FinanceExportImportPanelScreen, {})
  },
  //  'execution-change-signals': {
  //    label:
  //      'M14-wire — ExecutionChangeSignalsPanel (capacity signals · ADKAR readiness · champions), flaga changeSignals default OFF',
  //    render: () => <ExecutionChangeSignalsScreen />,
  //  },
  "execution-report-day11": {
    label: "Execution Day 11 \u2014 reports intelligence and governed generator",
    render: () => /* @__PURE__ */ jsx(ExecutionReportDay11Screen, {})
  },
  // 145-execution-taby — REALNY <ExecutionHub initialTab="..."> pełna powłoka
  // (Menu 1 StandardModuleBar + treść zakładki), 7 brakujących zakładek z 8
  // (rejestr grafiki pokrywał dotąd tylko "Raporty"). Dane: patrz nagłówek
  // dev-render/screens/execution-tab.tsx (demo-fallback/local-review, zero
  // ręcznego mockowania fetch — realne ścieżki degradacji produktu w DEV).
  "execution-tab-list": {
    label: 'Realizacja \u2192 zak\u0142adka "Realizacje" (Portfolio), REALNY <ExecutionHub initialTab="list">',
    render: () => /* @__PURE__ */ jsx(ExecutionTabScreen, { tab: "list" })
  },
  "execution-tab-work": {
    label: 'Realizacja \u2192 zak\u0142adka "Praca", REALNY <ExecutionHub initialTab="work"> (ExecutionWorkSurface)',
    render: () => /* @__PURE__ */ jsx(ExecutionTabScreen, { tab: "work" })
  },
  "execution-tab-resources": {
    label: 'Realizacja \u2192 zak\u0142adka "Zasoby", REALNY <ExecutionHub initialTab="resources"> (ExecutionResourcesSurface)',
    render: () => /* @__PURE__ */ jsx(ExecutionTabScreen, { tab: "resources" })
  },
  "execution-tab-control": {
    label: 'Realizacja \u2192 zak\u0142adka "Sterowanie", REALNY <ExecutionHub initialTab="control"> (ExecutionControlSurface)',
    render: () => /* @__PURE__ */ jsx(ExecutionTabScreen, { tab: "control" })
  },
  "execution-tab-rollout": {
    label: 'Realizacja \u2192 zak\u0142adka "Rollout" (chromeless, /rollout deep-link), REALNY <ExecutionHub initialTab="rollout"> (RolloutTab: Plan/KPI/Ryzyka/Zmiany/Zamkni\u0119cie)',
    render: () => /* @__PURE__ */ jsx(ExecutionTabScreen, { tab: "rollout" })
  },
  "execution-tab-summary": {
    label: 'Realizacja \u2192 zak\u0142adka "Summary one-look" (chromeless, za flag\u0105 summaryOneLook \u2014 domy\u015Blnie ON poza public-prod), REALNY <ExecutionHub initialTab="summary">',
    render: () => /* @__PURE__ */ jsx(ExecutionTabScreen, { tab: "summary" })
  },
  "execution-tab-people_change": {
    label: 'Realizacja \u2192 zak\u0142adka "People & Change" (chromeless, osi\u0105gana z Action Center), REALNY <ExecutionHub initialTab="people_change"> (ExecutionManagementView)',
    render: () => /* @__PURE__ */ jsx(ExecutionTabScreen, { tab: "people_change" })
  },
  //  'execution-export-prezentacja': {
  //    label:
  //      'Naprawa 2026-07-27 — Execution „Export as presentation" → PrezentacjeView konsumuje sourceType/sourceName/content (2 fazy: klik → auto-start Z AI)',
  //    render: () => <ExecutionExportPrezentacjaScreen />,
  //  },
  "tools-swot-live": {
    label: "Narz\u0119dzia \u2192 Dynamic SWOT: sesja na \u017Cywo",
    render: () => /* @__PURE__ */ jsx(ToolsSwotLiveScreen, {})
  },
  "tools-swot-library-detail": {
    label: "Narz\u0119dzia \u2192 Dynamic SWOT: karta w bibliotece",
    render: () => /* @__PURE__ */ jsx(ToolsSwotLibraryDetailScreen, {})
  },
  "tools-swot-session-workspace": {
    label: "Narz\u0119dzia \u2192 Dynamic SWOT: warsztat sesji",
    render: () => /* @__PURE__ */ jsx(ToolsSwotSessionWorkspaceScreen, {})
  },
  "tools-portfolio-priority-session-workspace": {
    label: "Narz\u0119dzia \u2192 Priorytetyzacja Portfolio: warsztat sesji",
    render: () => /* @__PURE__ */ jsx(ToolsPortfolioPrioritySessionWorkspaceScreen, {})
  },
  "tools-sesja-wyjscie": {
    label: "Narz\u0119dzia \u2192 wyj\u015Bcie z sesji",
    render: () => /* @__PURE__ */ jsx(ToolsSesjaWyjscieScreen, {})
  },
  "tool-outputs-panel": {
    label: "Narz\u0119dzia \u2192 panel rezultat\xF3w",
    render: () => /* @__PURE__ */ jsx(ToolOutputsPanelScreen, {})
  },
  "tools-outputs-insights-tab": {
    label: "Narz\u0119dzia \u2192 zak\u0142adka wniosk\xF3w",
    render: () => /* @__PURE__ */ jsx(ToolsOutputsInsightsTabScreen, {})
  },
  "chat-signals-feed": {
    label: "Czat \u2192 strumie\u0144 sygna\u0142\xF3w",
    render: () => /* @__PURE__ */ jsx(ChatSignalsFeedScreen, {})
  },
  "exec-summary-onelook": {
    label: "Realizacja \u2192 streszczenie na jeden rzut oka",
    render: () => /* @__PURE__ */ jsx(ExecSummaryOnelookScreen, {})
  },
  "assessment-list": {
    label: 'OCENA \u2014 lista ocen: REALNY <AssessmentHub initialTab="processes"> (/assessment?tab=processes). Do 2026-09-02 by\u0142a to REPLIKA triady, nie produkt.',
    render: () => /* @__PURE__ */ jsx(AssessmentListScreen, {})
  },
  "assessment-five-surfaces": {
    label: "T22 final closeout \u2014 real AssessmentHub with five surfaces forced ON",
    render: () => /* @__PURE__ */ jsx(AssessmentFiveSurfacesScreen, {})
  },
  "assessment-manage-panel": {
    label: "ASM-ID TRIADA \u2014 real <AssessmentManagePanel> (Workflow/Team/Reports/Initiatives tabs, crimson sweep verification) \u2014 &tab=workflow|team|reports|initiatives|logs",
    render: () => /* @__PURE__ */ jsx(AssessmentManagePanelScreen, {})
  },
  "assessment-matryca": {
    label: "SPEC-A archetyp D \u2014 sesja Assessment jako Matryca: REALNY <DRDMatrixSession> w realnej pow\u0142oce <TopBar> (Menu 1) + <ArtifactRightPanel>. &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(AssessmentMatrycaScreen, {})
  },
  "standard-module-bar-children": {
    label: "StandardModuleBar + children (rozszerzenie 2026-07-26, program ujednolicenia Menu 9 hub\xF3w)",
    render: () => /* @__PURE__ */ jsx(StandardModuleBarChildrenScreen, {})
  },
  "assessment-menu3-status-chips": {
    label: "#71 REALNY AssessmentHub \u2014 Menu 3 klikalne chipy statusu (ff assessmentMenu3StatusChips forced ON)",
    render: () => /* @__PURE__ */ jsx(AssessmentMenu3StatusChipsScreen, {})
  },
  "assessment-initiatives-panel": {
    label: "\xA727-todo: InitiativesManagementPanel (Assessment\u2192Manage\u2192Initiatives) \u2192 StandardTable",
    render: () => /* @__PURE__ */ jsx(AssessmentInitiativesPanelScreen, {})
  },
  "assessment-reports-panel": {
    label: "\xA727-todo: ReportsManagementPanel (Assessment\u2192Manage\u2192Reports) \u2192 StandardTable",
    render: () => /* @__PURE__ */ jsx(AssessmentReportsPanelScreen, {})
  },
  "assessment-initiatives-table": {
    label: 'OCENA \u2014 zak\u0142adka \u201EInicjatywy": REALNY <AssessmentHub initialTab="initiatives">. Do 2026-09-02 montowany martwy InitiativesTable (zero wo\u0142aczy w src/).',
    render: () => /* @__PURE__ */ jsx(AssessmentInitiativesTableScreen, {})
  },
  "report-builder-block-types": {
    label: "\xA727-todo: BlockTypesManager (Report Builder \u2192 Block Types) \u2192 StandardTable",
    render: () => /* @__PURE__ */ jsx(ReportBuilderBlockTypesScreen, {})
  },
  "report-builder-templates": {
    label: "\xA727-todo: TemplatesManager (Report Builder \u2192 Templates) \u2192 StandardTable",
    render: () => /* @__PURE__ */ jsx(ReportBuilderTemplatesScreen, {})
  },
  "model-catalog-table": {
    label: "\xA727-todo: ModelCatalogTable (SuperAdmin \u2192 Model Registry) \u2192 StandardTable",
    render: () => /* @__PURE__ */ jsx(ModelCatalogTableScreen, {})
  },
  "partner-settlements-view": {
    label: "\xA727-todo: PartnerSettlementsView (SuperAdmin \u2192 Revenue) \u2192 StandardTable \xD74",
    render: () => /* @__PURE__ */ jsx(PartnerSettlementsViewScreen, {})
  },
  "prompt-registry-tab": {
    label: "Oxford O5.5: PromptRegistryTab (SuperAdmin \u2192 AI Platform \u2192 Development) \u2192 StandardTable (ff promptRegistryUi)",
    render: () => /* @__PURE__ */ jsx(PromptRegistryTabScreen, {})
  },
  "assessment-reports-table": {
    label: 'OCENA \u2014 zak\u0142adka \u201ERaporty" (widok globalny): REALNY <AssessmentHub initialTab="reports">. Do 2026-09-02 montowany martwy ReportsTable (zero wo\u0142aczy w src/).',
    render: () => /* @__PURE__ */ jsx(AssessmentReportsTableScreen, {})
  },
  "assessment-output-report": {
    label: "Assessment Report (SPEC-A Dokument) \u2014 renderer zamro\u017Conego Outputu; ?variant=happy|edge|not-frozen",
    render: () => /* @__PURE__ */ jsx(AssessmentOutputReportScreen, {})
  },
  "assessment-report-contract": {
    label: "Assessment Report Contract \u2014 7 rozdzia\u0142\xF3w SPEC-A; ?scenario=pelny|sloty|pominiecia|blad",
    render: () => /* @__PURE__ */ jsx(AssessmentReportContractScreen, {})
  },
  "canvas-new-doc": {
    label: '#87a Canvas "+" New \u2014 3 opcje startu (Czysty/Z szablonu/Z canvasa) \u2192 Teresa',
    render: () => /* @__PURE__ */ jsx(CanvasNewDocScreen, {})
  },
  "canvas-toolbar-md-history": {
    label: "#87c naprawa: Import Markdown + Historia przeniesiona do kebaba \u2014 REALNY <WorkCanvasDocumentPanel>, g\u0142\xF3wny pasek (kebab: ?screen=canvas-kebab-restructure)",
    render: () => /* @__PURE__ */ jsx(CanvasToolbarMdHistoryScreen, {})
  },
  "canvas-kebab-restructure": {
    label: '#87d: restrukturyzacja kebaba \u201E\u22EF" w nazwane grupy \u2014 REALNY <WorkCanvasDocumentPanel>, harness sam klika trigger [data-testid="canvas-menu-root"]',
    render: () => /* @__PURE__ */ jsx(CanvasKebabRestructureScreen, {})
  },
  "chat-blad-ai": {
    label: "CHAT-OWN-016 \u2014 Czat w stanie b\u0142\u0119du dostawcy AI (?stan=blad-ai&wariant=przed|po)",
    render: () => /* @__PURE__ */ jsx(ChatBladAiScreen, {})
  },
  "chat-split-teresa-right": {
    label: "D17 /chat split ODWR\xD3CONY \u2014 artefakt po LEWEJ, Teresa po PRAWEJ",
    render: () => /* @__PURE__ */ jsx(ChatSplitTeresaRightScreen, {})
  },
  "chat-tool-steps-day206": {
    label: "Day206 \u2014 realny komponent krok\xF3w narz\u0119dzi READ Teresy",
    render: () => /* @__PURE__ */ jsx(ChatToolStepsDay206Screen, {})
  },
  "crimson-mywork-wave2": {
    label: "Crimson Wave #2 (MyWork) \u2014 CTA/aktywne bg-c-accent \u2192 neutralne (PRZED/PO)",
    render: () => /* @__PURE__ */ jsx(CrimsonMyWorkWave2Screen, {})
  },
  "crimson-wave-chrome-2026-07-26": {
    label: "Crimson purge 2026-07-26 (audyt TRIADA) \u2014 6 plik\xF3w shared/ModuleHub + MyWorkHub + InboxContent (PRZED/PO)",
    render: () => /* @__PURE__ */ jsx(CrimsonWaveChromeScreen, {})
  },
  "decision-record": {
    label: "VF1-4 \u2014 REALNY <DecisionDetailView> (archetyp C\xB7Rekord, SPEC-A pow\u0142oka) N-mode; &ff_vf1DecisionSpeca=1 wraz z VITE_VF1_DECISION_SPECA=true dla stan\xF3w gated",
    render: () => /* @__PURE__ */ jsx(DecisionRecordScreen, {})
  },
  "standard-grid-card": {
    label: "#76a JEDEN kanon karty grid/kafelkowej (StandardGridCard)",
    render: () => /* @__PURE__ */ jsx(StandardGridCardScreen, {})
  },
  "standard-kanban-card": {
    label: "#75b JEDEN kanon karty kanban (StandardKanbanCard)",
    render: () => /* @__PURE__ */ jsx(StandardKanbanCardScreen, {})
  },
  "mindmap-i18n-smoke": {
    label: "Smoke i18n fala 2 \u2014 M06 Mind Map modale (ideas.mindmap.*). ?variant=assign|attach|evidence (domy\u015Blnie assign) \u2014 modale s\u0105 fixed, jeden na raz",
    render: () => /* @__PURE__ */ jsx(MindmapI18nSmokeScreen, {})
  },
  "mm-ppm-measure": {
    label: "MM-P2 (2026-08-10) \u2014 pomiar wysoko\u015Bci PPM w\u0119z\u0142a Mind Map (1280\xD7800, do-usuniecia po odbiorze)",
    render: () => /* @__PURE__ */ jsx(MmPpmMeasureScreen, {})
  },
  "navdeclutter-sidebar": {
    label: "ODB O5 \u2014 REALNY <Sidebar> (navDeclutterFlag, default OFF); &ff_navDeclutter=1 dla ON",
    render: () => /* @__PURE__ */ jsx(NavDeclutterSidebarScreen, {})
  },
  "prawy-panel-szyna-ikon": {
    label: "P-01 (28.07) \u2014 Deck Builder prawy panel: REALNY <RightRail> zepsuty vs mock propozycji (szyna ikon zawsze widoczna)",
    render: () => /* @__PURE__ */ jsx(PrawyPanelSzynaIkonScreen, {})
  },
  "melscanvas-workspace": {
    label: "ODB O5 \u2014 REALNY <IdeaMapWorkspace> (melsCanvasFlag, default OFF); &ff_melsCanvas=1 dla ON",
    render: () => /* @__PURE__ */ jsx(MelsCanvasWorkspaceScreen, {})
  },
  "processflow-canvas": {
    label: "Fala 8 \u2014 Process Flow: kraw\u0119dzie (strza\u0142ka domy\u015Blna + smoothstep + etykiety)",
    render: () => /* @__PURE__ */ jsx(ProcessFlowCanvasScreen, {})
  },
  "whiteboard-canvas": {
    label: "Fala 8 \u2014 Whiteboard: \u0142\u0105czniki (4-str uchwyty magnetyczne)",
    render: () => /* @__PURE__ */ jsx(WhiteboardCanvasScreen, {})
  },
  "idea-table-timeline-stuck": {
    label: 'fix/table-timeline-stuck \u2014 REALNY <IdeaMapWorkspace initialTool="table"> \u2014 zak\u0142adka Timeline blokuje typ widoku na Gantt',
    render: () => /* @__PURE__ */ jsx(IdeaTableTimelineStuckScreen, {})
  },
  "whiteboard-workshop": {
    label: "Naprawa 2026-07-26 \u2014 Whiteboard Session Layer/Scenes/prawy klik (mock stanowy); &ff_whiteboardSessionInPanel=1 dla ON",
    render: () => /* @__PURE__ */ jsx(WhiteboardWorkshopScreen, {})
  },
  "b2-template-gallery": {
    label: "B2 \u2014 galeria szablon\xF3w Idei (mock STANOWY) dla 4 narz\u0119dzi; &tool=mindmap|whiteboard|process_flow|table, &empty=1 dla pustej kanwy",
    render: () => /* @__PURE__ */ jsx(B2TemplateGalleryScreen, {})
  },
  "i18n-fala1-smoke": {
    label: "Smoke i18n fala 1 \u2014 realne TemplateBuilder (M10) / FormulaEditor (M08); &part=interview|ideas",
    render: () => /* @__PURE__ */ jsx(I18nFala1SmokeScreen, {})
  },
  "ideas-teresa-panel": {
    label: "D16/D17 JEDEN prawy panel idei = dok Teresy (IdeaRightPanel)",
    render: () => /* @__PURE__ */ jsx(PrototypeHarness, { context: "idea", legacy: /* @__PURE__ */ jsx(IdeasTeresaPanelScreen, {}) })
  },
  "idea-confidentiality-control": {
    label: "RISK-22 Poufno\u015B\u0107 Idei \u2014 REALNY IdeaWorkspaceTools w IdeaRightPanel (?lang=pl|en, ?level=, ?fail=1)",
    render: () => /* @__PURE__ */ jsx(IdeaConfidentialityControlScreen, {})
  },
  "idea-templates-catalog": {
    label: "#10-AB Baza ~40 startowych szablon\xF3w konsultingowych (7 kategorii)",
    render: () => /* @__PURE__ */ jsx(IdeaTemplatesCatalogScreen, {})
  },
  "zwornik-projects": {
    label: "#78 Zwornik /projects \u2014 Stakeholderzy \xB7 Finanse \xB7 Zesp\xF3\u0142 \xB7 Role \xB7 Zadania",
    render: () => /* @__PURE__ */ jsx(ZwornikProjectsScreen, {})
  },
  "settings-crimson-neutralized": {
    label: "Fala 1 Settings \u2014 crimson CTA/toggle/selected \u2192 neutralne (PRZED/PO, kanon #1)",
    render: () => /* @__PURE__ */ jsx(SettingsCrimsonNeutralizedScreen, {})
  },
  "rose-danger-token-parity": {
    label: "fix/rose-regression \u2014 dow\xF3d parytetu rose-* vs danger-* (Execution+Settings sweep)",
    render: () => /* @__PURE__ */ jsx(RoseDangerTokenParityScreen, {})
  },
  "wave4-choices-crimson": {
    label: "Fala 4: bg-c-accent CTA/wybor \u2192 neutralne (Assessment/Initiatives/Execution/Results/Decisions)",
    render: () => /* @__PURE__ */ jsx(Wave4ChoicesCrimsonScreen, {})
  },
  "wave5-internal-crimson": {
    label: "wave5-internal-crimson: naprawa bg-c-accent w Studio (Export/Link modal) \u2014 CTA/toggle/selected-tab",
    render: () => /* @__PURE__ */ jsx(Wave5InternalCrimsonScreen, {})
  },
  "unified-create-launcher": {
    label: 'I1-I3 Faza 0/1 \u2014 UnifiedCreateLauncher "+ Nowy" (Insight/Initiative/Decision), Krok 0 \u2014 &context=mywork|interview|initiatives',
    render: () => /* @__PURE__ */ jsx(UnifiedCreateLauncherScreen, {})
  },
  "vault-scope-selector": {
    label: 'VLT-003 \u2014 REALNY <DocumentsRAGTab variant="client"> \u2014 selektor poziomu upload, badge, filtr, ostrze\u017Cenie zmiany zakresu',
    render: () => /* @__PURE__ */ jsx(VaultScopeSelectorScreen, {})
  },
  "vault-safes-table": {
    label: "VLT-005 \u2014 REALNY <ClientDocumentsVault> \u2014 tabela sejf\xF3w (M\xF3j/Organizacji/per projekt) \u2192 klik otwiera dokumenty sejfu, breadcrumb + powr\xF3t",
    render: () => /* @__PURE__ */ jsx(VaultSafesTableScreen, {})
  },
  "idea-table": {
    label: "IDEE \u2014 Idea jako tabela (pe\u0142ny obiekt: lista + podgl\u0105d + prawy panel)",
    render: () => /* @__PURE__ */ jsx(IdeaTableScreen, {})
  },
  "idea-table-production": {
    label: "IDEE \u2014 Idea jako tabela, KSZTA\u0141T PRODUKCYJNY (MyIdeasListContent.tsx:1785-1791, bez ArtifactRightPanel \u2014 S9-GATE4EVIDENCE TASK 1)",
    render: () => /* @__PURE__ */ jsx(IdeaTableProductionScreen, {})
  },
  "mindmap-canvas": {
    label: "IDEE \u2014 Idea jako mapa my\u015Bli (pe\u0142ny obiekt, archetyp Canvas)",
    render: () => /* @__PURE__ */ jsx(MindmapCanvasScreen, {})
  },
  "mywork-idea-topbar": {
    label: "IDEE \u2014 CA\u0141A g\xF3ra: rz\u0105d pilli MyWorkHub + Menu 1 + Menu 3 (flaga ff_ideaTopBarOneLine=1 \u2192 jedna linia)",
    render: () => /* @__PURE__ */ jsx(MyWorkIdeaTopBarScreen, {})
  },
  "teresa-confirm-chip": {
    label: "IDEE \u2014 Teresa: kontrolka potwierdzenia akcji trwa\u0142ych (F1-A)",
    render: () => /* @__PURE__ */ jsx(TeresaConfirmChipScreen, {})
  },
  "chat-crimson-search-research": {
    label: "CHAT 315 \u2014 realne wyszukiwanie + MessageRenderer/ResearchProgress",
    render: () => /* @__PURE__ */ jsx(ChatCrimsonSearchResearchScreen, {})
  },
  "chat-crimson-private-message": {
    label: "CHAT 315 \u2014 realny tryb prywatny + opcje/deep-thinking/przerwanie/ostrze\u017Cenie",
    render: () => /* @__PURE__ */ jsx(ChatCrimsonPrivateMessageScreen, {})
  },
  "chat-crimson-project-members": {
    label: "CHAT 315 \u2014 realny modal cz\u0142onk\xF3w projektu, pola z kanonicznym fokusem",
    render: () => /* @__PURE__ */ jsx(ChatCrimsonProjectMembersScreen, {})
  },
  "chat-v8-artifact-run-search": {
    label: "CHAT 315 \u2014 realna rozwini\u0119ta kontrolka V8ArtifactRunControl + wyszukiwanie",
    render: () => /* @__PURE__ */ jsx(ChatV8ArtifactRunSearchScreen, {})
  },
  "chat-message-required-surfaces": {
    label: "CHAT 315 \u2014 realny MessageRenderer: research/opcje/deep-thinking/przerwanie/ostrze\u017Cenie",
    render: () => /* @__PURE__ */ jsx(ChatMessageRequiredSurfacesScreen, {})
  },
  "teresa-chipy-sugestii": {
    label: "TERESA \u2014 chipy sugestii pod oknem rozmowy (kontekst raportu vs insightu)",
    render: () => /* @__PURE__ */ jsx(TeresaChipySugestiiScreen, {})
  },
  "teresa-chipy-panel-artefaktu": {
    label: "TERESA \u2014 chipy sugestii w panelu artefaktu (POZIOM 3, historia ze sklepu)",
    render: () => /* @__PURE__ */ jsx(TeresaChipyPanelArtefaktuScreen, {})
  },
  "ideas-preview-overlay": {
    label: "IDEE \u2014 Idea: podgl\u0105d nak\u0142adkowy nad list\u0105",
    render: () => /* @__PURE__ */ jsx(IdeasPreviewOverlayScreen, {})
  },
  "deck-artifact": {
    label: "DOKUMENTY \u2014 Prezentacja jako artefakt (pe\u0142ny obiekt)",
    render: () => /* @__PURE__ */ jsx(DeckArtifactScreen, {})
  },
  "document-artifact": {
    label: "DOKUMENTY \u2014 Dokument tekstowy jako artefakt (pe\u0142ny obiekt)",
    render: () => /* @__PURE__ */ jsx(DocumentArtifactScreen, {})
  },
  "sheet-artifact": {
    label: "DOKUMENTY \u2014 Arkusz jako artefakt (pe\u0142ny obiekt: zak\u0142adki, siatka, formu\u0142y)",
    render: () => /* @__PURE__ */ jsx(SheetArtifactScreen, {})
  },
  "report-artifact": {
    label: 'DOKUMENTY \u2014 Report jako artefakt (GeneratedReportView, wariant \u201Eraport doradczy")',
    render: () => /* @__PURE__ */ jsx(ReportArtifactScreen, {})
  },
  "insight-artifact": {
    label: "DOKUMENTY \u2014 Insight jako artefakt (tryb demo komponentu)",
    render: () => /* @__PURE__ */ jsx(InsightArtifactScreen, {})
  },
  "drd-embedded-matrix-axis-levels": {
    label: "DRD \u2014 EmbeddedMatrix dow\xF3d naprawy maxLevel (culture/cybersecurity=6, SSOT drdStructure.ts)",
    render: () => /* @__PURE__ */ jsx(DrdEmbeddedMatrixAxisLevelsScreen, {})
  },
  "drd-macierz-oceny": {
    label: "DRD \u2014 MACIERZ OCENY, stan zastany do AUDYTU (realny DRDAssessmentEditor, \u017Cywy w produkcie), &os=1..7",
    render: () => /* @__PURE__ */ jsx(DrdMacierzOcenyScreen, {})
  },
  "drd-macierz-obszary-poziomy": {
    label: "DRD \u2014 MACIERZ 2D obszary (kolumny) \xD7 poziomy (wiersze), realny AreaMatrixTable, &os=1..7",
    render: () => /* @__PURE__ */ jsx(DrdMacierzObszaryPoziomyScreen, {})
  },
  "excele-edytowalna-siatka": {
    label: "DOKUMENTY \u2014 Excel EDYTOWALNY (NPV/IRR, za ff_excele_edit \u2014 klik\u2192edycja\u2192przeliczenie\u2192zapis)",
    render: () => /* @__PURE__ */ jsx(ExceleEdytowalnaSiatkaScreen, {})
  },
  "excele-prawy-panel-standard": {
    label: "DOKUMENTY \u2014 Excel PRAWY PANEL = szyna ikon jak Word (NPV/IRR, za ff_excele_right_rail)",
    render: () => /* @__PURE__ */ jsx(ExcelePrawyPanelStandardScreen, {})
  },
  "day214-teresa-adopt-card": {
    label: "FIX-214 pkt 4 \u2014 REALNY <GovernedInitiativeHandoffCard> (karta adopcji szkicu z czatu Teresy, za ENABLE_TERESA_ADOPT_CHAT_DRAFT, domy\u015Blnie OFF), 4 stany (idle/blocked/ready/adopted) nap\u0119dzone realnymi klikni\u0119ciami przeciw przechwyconemu fetch \u2014 dane z fixture w harnessie, NIE z realnego przebiegu (patrz komentarz w pliku ekranu).",
    render: () => /* @__PURE__ */ jsx(Day214TeresaAdoptCardScreen, {})
  },
  "day228-image-style-field": {
    label: 'FIX-228 pkt 3 \u2014 REALNY <PresentationTemplateArchitectView>, pole \u201EStyl obrazu" za flag\u0105 presentationImageStyleUiV1 (domy\u015Blnie OFF). &scene=on|off.',
    render: () => /* @__PURE__ */ jsx(Day228ImageStyleFieldScreen, {})
  },
  "day231-konspekt-z-wiedzy": {
    label: "Day231 \u2014 realny OutlineStep z widocznymi \u017Ar\xF3d\u0142ami przy tezach; dane z props\xF3w harnessu, nie z realnego przebiegu.",
    render: () => /* @__PURE__ */ jsx(Day231KonspektZWiedzyScreen, {})
  },
  "day230-przepelnienie": {
    label: "Day230 \u2014 realny komponent ostrze\u017Cenia przed eksportem; stan overflow/clean z props\xF3w harnessu.",
    render: () => /* @__PURE__ */ jsx(Day230PrzepelnienieScreen, {})
  },
  "day232-agent-decku": {
    label: "Day232 \u2014 agent decku: pending/applied/rejected oraz nast\u0119pne ruchy; dane z props\xF3w harnessu, nie z realnego przebiegu.",
    render: () => /* @__PURE__ */ jsx(Day232AgentDeckuScreen, {})
  },
  "day234-wyniki-rejestry": {
    label: "Dy\u017Cur 234 \u2014 trzy REALNE rejestry Wynik\xF3w, izolowane per domena. &domain=kpi|roi|okr &ff=off (jawny dow\xF3d bramki OFF) &state=ready|loading|empty|error",
    render: () => /* @__PURE__ */ jsx(Day234WynikiRejestryScreen, {})
  },
  "day234-wyniki-narzedzia": {
    label: "Dy\u017Cur 234 \u2014 reprezentatywne wycinki REALNYCH pe\u0142nych narz\u0119dzi KPI/OKR/ROI na r\u0119cznych fixture harnessu. &domain=kpi|roi|okr + parametry domenowe",
    render: () => /* @__PURE__ */ jsx(Day234WynikiNarzedziaScreen, {})
  },
  // aios (runda pełna) — 146-aios, Internal Tools / AI OS (8 pozycji submenu),
  // odbiór grafiki 2026-08-31. Realne komponenty z src/components/AIChat/,
  // przełącznik `&screen=` w dev-render/screens/aios.tsx.
  "aios-home": {
    label: "AI OS \u2014 Home (AIOSHub, harness odbioru 2026-08-31)",
    render: () => /* @__PURE__ */ jsx(AiosScreen, {})
  },
  "aios-actions": {
    label: "AI OS \u2014 AI Actions (ActionCenter, harness odbioru 2026-08-31) &screen=actions",
    render: () => /* @__PURE__ */ jsx(AiosScreen, {})
  },
  "aios-research": {
    label: "AI OS \u2014 Research Sessions (ResearchSessionsDock, harness odbioru 2026-08-31) &screen=research",
    render: () => /* @__PURE__ */ jsx(AiosScreen, {})
  },
  "aios-artifacts": {
    label: "AI OS \u2014 Artifacts (Wave5ArtifactRuntimePanel, harness odbioru 2026-08-31) &screen=artifacts",
    render: () => /* @__PURE__ */ jsx(AiosScreen, {})
  },
  "aios-memory": {
    label: "AI OS \u2014 Memory & Scope (Wave6ContextLearningPanel, harness odbioru 2026-08-31) &screen=memory",
    render: () => /* @__PURE__ */ jsx(AiosScreen, {})
  },
  "aios-connectors": {
    label: "AI OS \u2014 Connectors (Wave7ConnectorAdminPanel, harness odbioru 2026-08-31) &screen=connectors",
    render: () => /* @__PURE__ */ jsx(AiosScreen, {})
  },
  "aios-agents": {
    label: "AI OS \u2014 Agents (Wave8AgentCatalogPanel, harness odbioru 2026-08-31) &screen=agents",
    render: () => /* @__PURE__ */ jsx(AiosScreen, {})
  },
  "aios-outcomes": {
    label: "AI OS \u2014 KPI/ROI & AI Ops (Wave9OutcomeAIOpsPanel, harness odbioru 2026-08-31) &screen=outcomes",
    render: () => /* @__PURE__ */ jsx(AiosScreen, {})
  },
  // ustawienia-organizacja (runda pełna) — odbiór grafiki 150-ustawienia-organizacja
  // (2026-08-31). Ustawienia: REALNY <SettingsView>, 10 grup nawigacji
  // (SettingsSidebar.tsx). Patrz nagłówek dev-render/screens/ustawienia-grupy.tsx.
  "ustawienia-personalne": {
    label: "Ustawienia \u2014 PERSONAL (REALNY <SettingsView>, grupa my-settings \u2192 profile)",
    render: () => /* @__PURE__ */ jsx(UstawieniaGrupyScreen, { grupa: "personalne" })
  },
  "ustawienia-workflow": {
    label: "Ustawienia \u2014 WORKFLOW (REALNY <SettingsView>, grupa work-preferences \u2192 dashboard)",
    render: () => /* @__PURE__ */ jsx(UstawieniaGrupyScreen, { grupa: "workflow" })
  },
  "ustawienia-ai-automatyzacja": {
    label: "Ustawienia \u2014 MODULES: AI & AUTOMATION (REALNY <SettingsView>, grupa ai-automation-group \u2192 ai-behavior)",
    render: () => /* @__PURE__ */ jsx(UstawieniaGrupyScreen, { grupa: "ai-automatyzacja" })
  },
  "ustawienia-powiadomienia": {
    label: "Ustawienia \u2014 MODULES: NOTIFICATIONS (REALNY <SettingsView>, grupa notifications \u2192 notifications-overview)",
    render: () => /* @__PURE__ */ jsx(UstawieniaGrupyScreen, { grupa: "powiadomienia" })
  },
  "ustawienia-bezpieczenstwo": {
    label: "Ustawienia \u2014 SECURITY (REALNY <SettingsView>, grupa security \u2192 security-dashboard)",
    render: () => /* @__PURE__ */ jsx(UstawieniaGrupyScreen, { grupa: "bezpieczenstwo" })
  },
  "ustawienia-integracje": {
    label: "Ustawienia \u2014 MODULES: INTEGRATIONS (REALNY <SettingsView>, grupa integrations \u2192 connected-apps, surowy fetch)",
    render: () => /* @__PURE__ */ jsx(UstawieniaGrupyScreen, { grupa: "integracje" })
  },
  "ustawienia-dane-prywatnosc": {
    label: "Ustawienia \u2014 DATA & PRIVACY (REALNY <SettingsView>, grupa data-privacy \u2192 data-controls)",
    render: () => /* @__PURE__ */ jsx(UstawieniaGrupyScreen, { grupa: "dane-prywatnosc" })
  },
  "ustawienia-billing": {
    label: "Ustawienia \u2014 BILLING (REALNY <SettingsView>, grupa billing \u2192 billing; renderContent() zwraca null \u2014 ZNALEZISKO, patrz nag\u0142\xF3wek pliku)",
    render: () => /* @__PURE__ */ jsx(UstawieniaGrupyScreen, { grupa: "billing" })
  },
  "ustawienia-wyglad": {
    label: "Ustawienia \u2014 APPEARANCE (REALNY <SettingsView>, grupa appearance \u2192 theme)",
    render: () => /* @__PURE__ */ jsx(UstawieniaGrupyScreen, { grupa: "wyglad" })
  },
  "ustawienia-zaawansowane": {
    label: "Ustawienia \u2014 ADVANCED & HISTORY (REALNY <SettingsView>, grupa advanced \u2192 import-export)",
    render: () => /* @__PURE__ */ jsx(UstawieniaGrupyScreen, { grupa: "zaawansowane" })
  },
  // Organizacja: REALNY <OrganizationView>, wariant DOMYŚLNY (flaga orgRedesignV1
  // OFF), 20 ekranów brakujących w rejestrze. Patrz nagłówek
  // dev-render/screens/org-legacy.tsx. `org-identity-operating` (profile/identity-scale)
  // ma już wpis — pominięty tutaj (choć renderuje wariant ON, patrz ZGŁASZAM w raporcie).
  "org-operating-model": {
    label: "Organizacja \u2014 Model dzia\u0142ania (REALNY <OrganizationView>, domy\u015Blnie OFF, profile/operating-model)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "profile", screen: "operating-model" })
  },
  "org-position-direction": {
    label: "Organizacja \u2014 Pozycja i kierunek (REALNY <OrganizationView>, domy\u015Blnie OFF, profile/position-direction)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "profile", screen: "position-direction" })
  },
  "org-technology-culture-constraints": {
    label: "Organizacja \u2014 Technologia, kultura i ograniczenia (REALNY <OrganizationView>, domy\u015Blnie OFF, profile/technology-culture-constraints)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "profile", screen: "technology-culture-constraints" })
  },
  "org-strategic-intent": {
    label: "Organizacja \u2014 Intencja strategiczna (REALNY <OrganizationView>, domy\u015Blnie OFF, goals/strategic-intent)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "goals", screen: "strategic-intent" })
  },
  "org-success-metrics": {
    label: "Organizacja \u2014 Mierniki sukcesu (REALNY <OrganizationView>, domy\u015Blnie OFF, goals/success-metrics)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "goals", screen: "success-metrics" })
  },
  "org-scope-boundaries": {
    label: "Organizacja \u2014 Zakres i granice (REALNY <OrganizationView>, domy\u015Blnie OFF, goals/scope-boundaries)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "goals", screen: "scope-boundaries" })
  },
  "org-stakeholder-expectations": {
    label: "Organizacja \u2014 Oczekiwania interesariuszy (REALNY <OrganizationView>, domy\u015Blnie OFF, goals/stakeholder-expectations)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "goals", screen: "stakeholder-expectations" })
  },
  "org-declared-challenges": {
    label: "Organizacja \u2014 Zadeklarowane wyzwania (REALNY <OrganizationView>, domy\u015Blnie OFF, challenges/declared-challenges)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "challenges", screen: "declared-challenges" })
  },
  "org-root-causes": {
    label: "Organizacja \u2014 Przyczyny \u017Ar\xF3d\u0142owe (REALNY <OrganizationView>, domy\u015Blnie OFF, challenges/root-causes)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "challenges", screen: "root-causes" })
  },
  "org-goal-blockers": {
    label: "Organizacja \u2014 Blockery cel\xF3w (REALNY <OrganizationView>, domy\u015Blnie OFF, challenges/goal-blockers)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "challenges", screen: "goal-blockers" })
  },
  "org-evidence": {
    label: "Organizacja \u2014 Dowody (REALNY <OrganizationView>, domy\u015Blnie OFF, challenges/evidence)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "challenges", screen: "evidence" })
  },
  "org-risks-opportunities": {
    label: "Organizacja \u2014 Ryzyka i szanse (REALNY <OrganizationView>, domy\u015Blnie OFF, strategy/risks-opportunities)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "strategy", screen: "risks-opportunities" })
  },
  "org-scenarios": {
    label: "Organizacja \u2014 Scenariusze (REALNY <OrganizationView>, domy\u015Blnie OFF, strategy/scenarios)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "strategy", screen: "scenarios" })
  },
  "org-recommendation": {
    label: "Organizacja \u2014 Rekomendacja (REALNY <OrganizationView>, domy\u015Blnie OFF, strategy/recommendation)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "strategy", screen: "recommendation" })
  },
  "org-executive-brief": {
    label: "Organizacja \u2014 Executive brief (REALNY <OrganizationView>, domy\u015Blnie OFF, strategy/executive-brief)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "strategy", screen: "executive-brief" })
  },
  "org-files": {
    label: "Organizacja \u2014 Pliki (REALNY <OrganizationView>, domy\u015Blnie OFF, sources/files, statyczny komunikat NIEZWERYFIKOWANE)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "sources", screen: "files" })
  },
  "org-claims-sources": {
    label: "Organizacja \u2014 Twierdzenia i \u017Ar\xF3d\u0142a (REALNY <OrganizationView>, domy\u015Blnie OFF, sources/claims-sources)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "sources", screen: "claims-sources" })
  },
  "org-source-conflicts": {
    label: "Organizacja \u2014 Konflikty \u017Ar\xF3de\u0142 (REALNY <OrganizationView>, domy\u015Blnie OFF, sources/source-conflicts)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "sources", screen: "source-conflicts" })
  },
  "org-knowledge-graph": {
    label: "Organizacja \u2014 Graf wiedzy (REALNY <OrganizationView>, domy\u015Blnie OFF, sources/knowledge-graph)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "sources", screen: "knowledge-graph" })
  },
  "org-summary": {
    label: "Organizacja \u2014 Gotowo\u015B\u0107 organizacji (REALNY <OrganizationView>, domy\u015Blnie OFF, readiness/summary)",
    render: () => /* @__PURE__ */ jsx(OrgLegacyScreen, { module: "readiness", screen: "summary" })
  },
  "day267-materialy-hub-zrzuty": {
    label: "Day267 \u2014 realny ReportsAndPresentationsHub; &tab=outputs_all|outputs_documents|presentations|outputs_sheets|templates &state=ready|empty|loading|error",
    render: () => /* @__PURE__ */ jsx(Day267MaterialyHubZrzutyScreen, {})
  },
  "auth-login": {
    label: "LOGOWANIE \u2014 REALNY <AuthView initialStep=LOGIN> w <AuthLayout> (kompozycja /login z AppRoutes.tsx). &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(AuthLoginScreen, {})
  },
  "auth-register": {
    label: "REJESTRACJA \u2014 REALNY <AuthView initialStep=REGISTER> w <AuthLayout> (kompozycja /register). &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(AuthRegisterScreen, {})
  },
  "auth-code-entry": {
    label: 'ZAPROSZENIE DO ORGANIZACJI \u2014 REALNY <AuthView initialStep=CODE_ENTRY> (krok "Wpisz kod dost\u0119pu" z /login lub /register). &lang=pl|en &theme=light|dark',
    render: () => /* @__PURE__ */ jsx(AuthCodeEntryScreen, {})
  },
  "auth-forgot-password": {
    label: "ODZYSKIWANIE HAS\u0141A \u2014 REALNY <ForgotPasswordView> w <AuthLayout> (kompozycja /forgot-password). &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(AuthForgotPasswordScreen, {})
  },
  "auth-reset-password": {
    label: "ZMIANA HAS\u0141A Z LINKU \u2014 REALNY <ResetPasswordView> w <AuthLayout> (kompozycja /reset-password, ?token= obecny). &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(AuthResetPasswordScreen, {})
  },
  "auth-verify-email": {
    label: "WERYFIKACJA E-MAIL \u2014 REALNY <VerifyEmail> (UWAGA: martwy komponent, brak trasy w AppRoutes.tsx \u2014 patrz komentarz w pliku ekranu). &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(AuthVerifyEmailScreen, {})
  },
  // Moduł 16 „Partner" (Partner Portal) — pierwszy komplet zrzutów, 2026-09-02.
  // Realny <PartnerPortalViewNew /> spod /partner/* (AppRoutes.tsx:3494), dane
  // przez window.fetch stub. Patrz dev-render/screens/partner-portal.tsx.
  "partner-start-unconnected": {
    label: "Partner \u2014 Start, profil NIEPOD\u0141\u0104CZONY (stan pusty). &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(PartnerPortalScreen, { wariant: "start-unconnected" })
  },
  "partner-start-active": {
    label: "Partner \u2014 Start, partner AKTYWNY (kafle salda + nast\u0119pny krok). &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(PartnerPortalScreen, { wariant: "start-active" })
  },
  "partner-start-error": {
    label: "Partner \u2014 Start, b\u0142\u0105d ustalenia statusu po\u0142\u0105czenia. &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(PartnerPortalScreen, { wariant: "start-error" })
  },
  "partner-dashboard": {
    label: "Partner \u2014 Dashboard (przegl\u0105d: klienci, przych\xF3d, certyfikacja). &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(PartnerPortalScreen, { wariant: "dashboard" })
  },
  "partner-referral-tools-filled": {
    label: "Partner \u2014 Polecenia / Moje linki i kody, tabela kampanii WYPE\u0141NIONA (kebab realny). &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(PartnerPortalScreen, { wariant: "referral-tools-filled" })
  },
  "partner-referral-tools-empty": {
    label: "Partner \u2014 Polecenia / Moje linki i kody, tabela kampanii PUSTA. &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(PartnerPortalScreen, { wariant: "referral-tools-empty" })
  },
  "partner-organizations-filled": {
    label: "Partner \u2014 Klienci / Organizacje, FilterableTable WYPE\u0141NIONA (hideRowActions \u2014 brak kebaba). &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(PartnerPortalScreen, { wariant: "organizations-filled" })
  },
  "partner-organizations-empty": {
    label: "Partner \u2014 Klienci / Organizacje, PUSTA lista. &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(PartnerPortalScreen, { wariant: "organizations-empty" })
  },
  "partner-earnings-filled": {
    label: "Partner \u2014 Prowizje (saldo + tabela transakcji, hideRowActions). &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(PartnerPortalScreen, { wariant: "earnings-filled" })
  },
  "partner-academy-filled": {
    label: "Partner \u2014 Akademia / \u015Acie\u017Cka nauki (karty certyfikacji). &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(PartnerPortalScreen, { wariant: "academy-filled" })
  },
  "partner-resources-filled": {
    label: "Partner \u2014 Materia\u0142y / Dokumentacja. &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(PartnerPortalScreen, { wariant: "resources-filled" })
  },
  "partner-profile-filled": {
    label: "Partner \u2014 Profil / Informacje o firmie. &lang=pl|en &theme=light|dark",
    render: () => /* @__PURE__ */ jsx(PartnerPortalScreen, { wariant: "profile-filled" })
  }
};
const params = new URLSearchParams(window.location.search);
const screenKey = params.get("screen") || "assessment-list";
const lang = params.get("lang") || "pl";
const theme = params.get("theme") || "light";
const root = document.documentElement;
root.classList.toggle("dark", theme === "dark");
useAppStore.setState({ theme: theme === "dark" ? "dark" : "light" });
new MutationObserver(() => {
  const powinnaByc = theme === "dark";
  if (root.classList.contains("dark") !== powinnaByc) {
    root.classList.toggle("dark", powinnaByc);
  }
}).observe(root, { attributes: true, attributeFilter: ["class"] });
document.body.style.background = "var(--c-bg)";
void i18n.changeLanguage(lang);
const entry = SCREENS[screenKey];
const mount = document.getElementById("dev-render-root");
function Fallback() {
  return /* @__PURE__ */ jsxs("div", { style: { padding: 24, fontFamily: "system-ui", color: "var(--c-text)" }, children: [
    /* @__PURE__ */ jsx("h1", { children: "Dev Render Harness" }),
    /* @__PURE__ */ jsxs("p", { children: [
      "Unknown ",
      /* @__PURE__ */ jsxs("code", { children: [
        "?screen=",
        screenKey
      ] }),
      ". Available screens:"
    ] }),
    /* @__PURE__ */ jsx("ul", { children: Object.entries(SCREENS).map(([k, v]) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("a", { href: `?screen=${k}&lang=${lang}&theme=${theme}`, children: [
      k,
      " \u2014 ",
      v.label
    ] }) }, k)) })
  ] });
}
class DebugBoundary extends React.Component {
  constructor() {
    super(...arguments);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return /* @__PURE__ */ jsx("pre", { style: { padding: 24, whiteSpace: "pre-wrap", color: "red" }, children: String(this.state.error.stack || this.state.error.message) });
    }
    return this.props.children;
  }
}
createRoot(mount).render(
  /* @__PURE__ */ jsx(React.StrictMode, { children: /* @__PURE__ */ jsxs(DebugBoundary, { children: [
    /* @__PURE__ */ jsx(
      React.Suspense,
      {
        fallback: /* @__PURE__ */ jsx("div", { style: { padding: 24, color: "#64748b" }, children: "\u0141adowanie ekranu\u2026" }),
        children: entry ? entry.render() : /* @__PURE__ */ jsx(Fallback, {})
      }
    ),
    params.get("uwagi") !== "0" && /* @__PURE__ */ jsx(PanelUwag, { ekran: screenKey }),
    /* @__PURE__ */ jsx(
      Toaster,
      {
        position: "bottom-center",
        toastOptions: {
          duration: 4e3,
          style: {
            maxWidth: "min(420px, calc(100vw - 2rem))",
            padding: "10px 14px",
            borderRadius: "12px",
            fontSize: "14px",
            lineHeight: "1.4",
            background: "var(--c-surface-raised)",
            color: "var(--c-text)",
            border: "1px solid var(--c-border)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.14)"
          },
          success: {
            iconTheme: { primary: "var(--c-success)", secondary: "var(--c-surface-raised)" }
          },
          error: {
            duration: 6e3,
            iconTheme: { primary: "var(--c-danger)", secondary: "var(--c-surface-raised)" }
          }
        }
      }
    )
  ] }) })
);
