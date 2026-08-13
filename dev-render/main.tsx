/**
 * DEV-RENDER HARNESS entry.
 *
 * Mounts a REAL screen component with mock data + the app's real CSS
 * (Tailwind + c-* tokens) + working i18n, so the supervisor can screenshot it
 * BEFORE the owner sees it (CLAUDE.md #7). Dev-only; never ships to demo.
 *
 * URL params:
 *   ?screen=assessment-list   which screen to mount (see SCREENS registry)
 *   &lang=pl|en         i18n language (default pl)
 *   &theme=light|dark   applies the app's `.dark` class strategy (default light)
 *
 * Extend by adding an entry to SCREENS below.
 */
// Real app stylesheet: Tailwind layers + the full c-* token system (light+dark).
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import PanelUwag from './PanelUwag';
const IdeaFinancialCasePersistenceScreen = React.lazy(
  () => import('./screens/idea-financial-case-persistence')
);
const MaterialyLauncherScreen = React.lazy(() => import('./screens/materialy-launcher'));
const MaterialyTemplateLibrarySliceScreen = React.lazy(
  () => import('./screens/materialy-template-library-slice')
);
const MaterialyDraftTemplateVisibilityFixScreen = React.lazy(
  () => import('./screens/materialy-draft-template-visibledraft-fix')
);
const DocumentStudioTemplateResolveErrorScreen = React.lazy(
  () => import('./screens/document-studio-template-resolve-error')
);
const PrezentacjeTemplateStatesScreen = React.lazy(
  () => import('./screens/prezentacje-template-states')
);
const ReportBuilderLibraryTemplateScreen = React.lazy(
  () => import('./screens/report-builder-library-template')
);
const AudytyDrdReportScreen = React.lazy(() => import('./screens/audyty-drd-report'));
const DocumentStudioContextChipScreen = React.lazy(
  () => import('./screens/document-studio-context-chip')
);
const DocumentStudioResumeErrorScreen = React.lazy(
  () => import('./screens/document-studio-resume-error')
);
const DocumentStudioAiTeresaScreen = React.lazy(
  () => import('./screens/document-studio-ai-teresa')
);
const DocumentStudioStreamingHonestyN3Screen = React.lazy(
  () => import('./screens/document-studio-streaming-honesty-n3')
);
const DocumentStudioMenuPlikuScreen = React.lazy(
  () => import('./screens/document-studio-menu-pliku')
);
const DocumentStudioSaveAsTemplateScreen = React.lazy(
  () => import('./screens/document-studio-save-as-template')
);
const MenuCanonSidebarCheckScreen = React.lazy(() => import('./screens/menu-canon-sidebar-check'));
// (2026-08-13, T5) `./screens/tools-sesja-wyjscie.tsx` does not exist in this
// worktree (dangling import — same class of defect as commit 8b379a0eb9
// fixed elsewhere) and Vite's import-analysis plugin fails HARD on it at
// transform time, breaking every dev-render screen, not just this one —
// removed the registration to unblock the harness. Not part of T5's scope
// (Assessment); flag for whoever owns the NARZĘDZIA tools-sesja-wyjscie
// screen to re-add the real file.
const AssessmentQualityReviewPanelScreen = React.lazy(
  () => import('./screens/assessment-quality-review-panel')
);

// TEST-ONLY: must import before `../src/i18n` — see file header. Opt-in via
// `?slowLocale=<ms>`; no effect otherwise.
import './slowLocaleFetch';

// Real app i18n init (HttpBackend loads /locales/** served from repo `public/`).
import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
const AccentSoftTokenFixScreen = React.lazy(() => import('./screens/accent-soft-token-fix'));
const UiFoundationFocus01EvidenceScreen = React.lazy(
  () => import('./screens/ui-foundation-focus-01-evidence')
);
const AdminCommandCenterPanelScreen = React.lazy(
  () => import('./screens/admin-command-center-panel')
);
const AdminSsoSelfServiceCardScreen = React.lazy(
  () => import('./screens/admin-sso-self-service-card')
);
const AgentPlanCanvasScreen = React.lazy(() => import('./screens/agent-plan-canvas'));
const AgentPlanViewScreen = React.lazy(() => import('./screens/agent-plan-view'));
const AgentHubScreen = React.lazy(() => import('./screens/agent-hub'));
const TabeleFala2PrzedPoScreen = React.lazy(() => import('./screens/tabele-fala2-przed-po'));
const MenuDlugiDomkniecieScreen = React.lazy(() => import('./screens/menu-dlugi-domkniecie'));
const AgentWarsztatScreen = React.lazy(() => import('./screens/agent-warsztat'));
const VaultSejfWnetrzeScreen = React.lazy(() => import('./screens/vault-sejf-wnetrze'));
const VaultFolderBlockProofScreen = React.lazy(() => import('./screens/vault-folder-block-proof'));
const AssessmentInitiativesPanelScreen = React.lazy(
  () => import('./screens/assessment-initiatives-panel')
);
const AssessmentInitiativesTableScreen = React.lazy(
  () => import('./screens/assessment-initiatives-table')
);
const AssessmentFiveSurfacesScreen = React.lazy(() => import('./screens/assessment-five-surfaces'));
const AssessmentListScreen = React.lazy(() => import('./screens/assessment-list'));
const StandardModuleBarChildrenScreen = React.lazy(
  () => import('./screens/standard-module-bar-children')
);
const AssessmentMenu3StatusChipsScreen = React.lazy(
  () => import('./screens/assessment-menu3-status-chips')
);
const AssessmentReportsPanelScreen = React.lazy(() => import('./screens/assessment-reports-panel'));
const AssessmentReportsTableScreen = React.lazy(() => import('./screens/assessment-reports-table'));
const AssessmentOutputReportScreen = React.lazy(() => import('./screens/assessment-output-report'));
const CanvasKebabRestructureScreen = React.lazy(() => import('./screens/canvas-kebab-restructure'));
const CanvasNewDocScreen = React.lazy(() => import('./screens/canvas-new-doc'));
const CanvasToolbarMdHistoryScreen = React.lazy(
  () => import('./screens/canvas-toolbar-md-history')
);
const CapabilityGateDemoScreen = React.lazy(() => import('./screens/capability-gate-demo'));
const ChatSplitTeresaRightScreen = React.lazy(() => import('./screens/chat-split-teresa-right'));
const CrimsonMyWorkWave2Screen = React.lazy(() => import('./screens/crimson-mywork-wave2'));
const CrimsonWaveChromeScreen = React.lazy(
  () => import('./screens/crimson-wave-chrome-2026-07-26')
);
const DecisionRecordScreen = React.lazy(() => import('./screens/decision-record'));
const DocumentStudioBlocksI18nScreen = React.lazy(
  () => import('./screens/document-studio-blocks-i18n')
);
const ExceleEngineRevealScreen = React.lazy(() => import('./screens/excele-engine-reveal'));
const WordIntakeUseLlmDefaultScreen = React.lazy(
  () => import('./screens/word-intake-uselm-default')
);
const DocumentStudioM1SharePrimaryScreen = React.lazy(
  () => import('./screens/document-studio-m1-share-primary')
);
const DocumentStudioNowyDokumentMartweprzyciskiScreen = React.lazy(
  () => import('./screens/document-studio-nowy-dokument-martwe-przyciski')
);
const EvFootballFieldScreen = React.lazy(() => import('./screens/ev-football-field'));
const ExecutionChangeSignalsScreen = React.lazy(() => import('./screens/execution-change-signals'));
const ExecutionExportPrezentacjaScreen = React.lazy(
  () => import('./screens/execution-export-prezentacja')
);
const FinanceValuePanelsScreen = React.lazy(() => import('./screens/finance-value-panels'));
const FinanceModelWorkspaceScreen = React.lazy(() => import('./screens/finance-model-workspace'));
const FinanceWorkspaceBarScreen = React.lazy(() => import('./screens/finance-workspace-bar'));
const FinanceFocusModeScreen = React.lazy(() => import('./screens/finance-focus-mode'));
const FinanceStatementPackWorkspaceV2Screen = React.lazy(() => import('./screens/finance-statement-pack-workspace-v2'));
const FinanceBaselineWorkspaceScreen = React.lazy(() => import('./screens/finance-baseline-workspace'));
const FinancePredictionWorkspaceScreen = React.lazy(() => import('./screens/finance-prediction-workspace'));
const FinanceIdBridgeScreen = React.lazy(() => import('./screens/finance-id-bridge'));
const FinanceAnalysisWorkspaceScreen = React.lazy(() => import('./screens/finance-analysis-workspace'));
const FinanceValuationWorkspaceScreen = React.lazy(() => import('./screens/finance-valuation-workspace'));
const FinanceLineageNavigatorScreen = React.lazy(() => import('./screens/finance-lineage-navigator'));
const FinanceComparePanelScreen = React.lazy(() => import('./screens/finance-compare-panel'));
const FinanceCommentsPanelScreen = React.lazy(() => import('./screens/finance-comments-panel'));
const FinanceSavedViewsPanelScreen = React.lazy(() => import('./screens/finance-saved-views-panel'));
const FinanceExportImportPanelScreen = React.lazy(() => import('./screens/finance-export-import-panel'));
const GenDeckContentHintsScreen = React.lazy(() => import('./screens/gen-deck-content-hints'));
const GenExcelTemplatesTabScreen = React.lazy(() => import('./screens/gen-excel-templates-tab'));
const GenWordContentHintsScreen = React.lazy(() => import('./screens/gen-word-content-hints'));
const DeckQualityBadgeScreen = React.lazy(() => import('./screens/deck-quality-badge'));
const WordQualityBadgeScreen = React.lazy(() => import('./screens/word-quality-badge'));
const I18nFala1SmokeScreen = React.lazy(() => import('./screens/i18n-fala1-smoke'));
const IdeaConfidentialityControlScreen = React.lazy(
  () => import('./screens/idea-confidentiality-control')
);
const IdeaTemplatesCatalogScreen = React.lazy(() => import('./screens/idea-templates-catalog'));
const IdeasTeresaPanelScreen = React.lazy(() => import('./screens/ideas-teresa-panel'));
const MelsCanvasWorkspaceScreen = React.lazy(() => import('./screens/melscanvas-workspace'));
const ProcessFlowCanvasScreen = React.lazy(() => import('./screens/processflow-canvas'));
const WhiteboardCanvasScreen = React.lazy(() => import('./screens/whiteboard-canvas'));
const IdeaTableTimelineStuckScreen = React.lazy(
  () => import('./screens/idea-table-timeline-stuck')
);
const WhiteboardWorkshopScreen = React.lazy(() => import('./screens/whiteboard-workshop'));
const B2TemplateGalleryScreen = React.lazy(() => import('./screens/b2-template-gallery'));
const MindmapI18nSmokeScreen = React.lazy(() => import('./screens/mindmap-i18n-smoke'));
const MmPpmMeasureScreen = React.lazy(() => import('./screens/mm-ppm-measure'));
const ModelCatalogTableScreen = React.lazy(() => import('./screens/model-catalog-table'));
const NavDeclutterSidebarScreen = React.lazy(() => import('./screens/navdeclutter-sidebar'));
const NotatnikCentrumMysliScreen = React.lazy(() => import('./screens/notatnik-centrum-mysli'));
const NotatnikOsieroconeGrafScreen = React.lazy(() => import('./screens/notatnik-osierocone-graf'));
const PartnerSettlementsViewScreen = React.lazy(() => import('./screens/partner-settlements-view'));
const PromptRegistryTabScreen = React.lazy(() => import('./screens/prompt-registry-tab'));
const PublicBookingWidgetScreen = React.lazy(() => import('./screens/public-booking-widget'));
const ReportBuilderBlockTypesScreen = React.lazy(
  () => import('./screens/report-builder-block-types')
);
const ReportBuilderTemplatesScreen = React.lazy(() => import('./screens/report-builder-templates'));
const ResultsThreePairsScreen = React.lazy(() => import('./screens/results-three-pairs'));
const RoseDangerTokenParityScreen = React.lazy(() => import('./screens/rose-danger-token-parity'));
const SettingsCrimsonNeutralizedScreen = React.lazy(
  () => import('./screens/settings-crimson-neutralized')
);
const StandardKanbanCardScreen = React.lazy(() => import('./screens/standard-kanban-card'));
const TemplateBuilderDeckScreen = React.lazy(() => import('./screens/template-builder-deck'));
const TemplateBuilderDocScreen = React.lazy(() => import('./screens/template-builder-doc'));
const TemplateBuilderTableScreen = React.lazy(() => import('./screens/template-builder-table'));
const TemplateCreateWizardScreen = React.lazy(() => import('./screens/template-create-wizard'));
const TemplateLibraryNewEntryScreen = React.lazy(
  () => import('./screens/template-library-new-entry')
);
const UnifiedCreateLauncherScreen = React.lazy(() => import('./screens/unified-create-launcher'));
const Wave3CreatorsCrimsonScreen = React.lazy(() => import('./screens/wave3-creators-crimson'));
const Wave4ChoicesCrimsonScreen = React.lazy(() => import('./screens/wave4-choices-crimson'));
const Wave5InternalCrimsonScreen = React.lazy(() => import('./screens/wave5-internal-crimson'));
const ZwornikProjectsScreen = React.lazy(() => import('./screens/zwornik-projects'));
const KartaToolScreen = React.lazy(() => import('./screens/karta-tool'));
const KartaInitiativeScreen = React.lazy(() => import('./screens/karta-initiative'));
const KartaInsightScreen = React.lazy(() => import('./screens/karta-insight'));
const KartaInterviewScreen = React.lazy(() => import('./screens/karta-interview'));
const KartaDecisionScreen = React.lazy(() => import('./screens/karta-decision'));
const KartaNotificationScreen = React.lazy(() => import('./screens/karta-notification'));
const KartaTaskScreen = React.lazy(() => import('./screens/karta-task'));
const PreviewZakladkiScreen = React.lazy(() => import('./screens/preview-4-zakladki'));
const IdeaTableToolKebabScreen = React.lazy(() => import('./screens/idea-table-tool-kebab'));
const IdeaTableRecordTemplatesScreen = React.lazy(
  () => import('./screens/idea-table-record-templates')
);
const IdeaTableToolEmptyFilterScreen = React.lazy(
  () => import('./screens/idea-table-tool-empty-filter')
);
const IdeaTableToolPasteScreen = React.lazy(() => import('./screens/idea-table-tool-paste'));
const IdeaTableToolSortFilterScreen = React.lazy(
  () => import('./screens/idea-table-tool-sortfilter')
);
const IdeaTableToolGroupingScreen = React.lazy(() => import('./screens/idea-table-tool-grouping'));
const IdeaTableScreen = React.lazy(() => import('./screens/idea-table'));
const IdeaTableProductionScreen = React.lazy(() => import('./screens/idea-table-production'));
const MindmapCanvasScreen = React.lazy(() => import('./screens/mindmap-canvas'));
const MyWorkIdeaTopBarScreen = React.lazy(() => import('./screens/mywork-idea-topbar'));
const TeresaConfirmChipScreen = React.lazy(() => import('./screens/teresa-confirm-chip'));
const TeresaChipySugestiiScreen = React.lazy(() => import('./screens/teresa-chipy-sugestii'));
const TeresaChipyPanelArtefaktuScreen = React.lazy(
  () => import('./screens/teresa-chipy-panel-artefaktu')
);
const DeckArtifactScreen = React.lazy(() => import('./screens/deck-artifact'));
const DocumentArtifactScreen = React.lazy(() => import('./screens/document-artifact'));
const IdeasPreviewOverlayScreen = React.lazy(() => import('./screens/ideas-preview-overlay'));
const SheetArtifactScreen = React.lazy(() => import('./screens/sheet-artifact'));
const ExceleEdytowalnaSiatkaScreen = React.lazy(() => import('./screens/excele-edytowalna-siatka'));
const ExcelePrawyPanelStandardScreen = React.lazy(
  () => import('./screens/excele-prawy-panel-standard')
);
const NTypeAnalizujAiScreen = React.lazy(() => import('./screens/ntype-analizuj-ai'));
// Ekrany ładujemy LENIWIE (React.lazy) — i to jest wymóg poprawności, nie optymalizacja.
// Każdy screen instaluje swój stub `window.fetch` jako efekt uboczny importu. Przy
// statycznych importach ładowały się WSZYSTKIE moduły naraz, więc stub ekranu ładowanego
// później przechwytywał żądania ekranu otwartego (np. mapa myśli zjadała dane karty
// inicjatywy — „Nie udało się załadować karty"). Leniwy import = instaluje się stub
// wyłącznie otwartego ekranu, a kolejność importów przestaje cokolwiek znaczyć.
const VaultScopeSelectorScreen = React.lazy(() => import('./screens/vault-scope-selector'));
const VaultSafesTableScreen = React.lazy(() => import('./screens/vault-safes-table'));
// (Zdjeta 2026-07-23) Tu stal zapomniany blok 68 STATYCZNYCH importow ekranow —
// pozostalosc po niedokonczonym scaleniu (zostal nawet znacznik `|||||||`), przez
// co plik sie NIE PARSOWAL, a kazdy ekran mial dwie deklaracje: leniwa wyzej
// i statyczna tutaj. Statyczne importy odpalaly stub `window.fetch` KAZDEGO
// ekranu naraz — dokladnie defekt, ktory React.lazy wyzej ma likwidowac.
// Uwaga historyczna VLT-003 („import musi byc ostatni, bo stuby sie nakladaja")
// dotyczyla tamtego statycznego swiata i przy leniwym ladowaniu nie obowiazuje.
const ExceleReopenVerifyScreen = React.lazy(() => import('./screens/excele-reopen-verify'));
const ExceleJedenWidokRecentScreen = React.lazy(
  () => import('./screens/excele-jeden-widok-recent')
);
const ExceleJedenWidokMaterialyScreen = React.lazy(
  () => import('./screens/excele-jeden-widok-materialy')
);
const ExceleJedenWidokPustyScreen = React.lazy(() => import('./screens/excele-jeden-widok-pusty'));
const OdbiorScreen = React.lazy(() => import('./screens/odbior'));
const InitiativesPortfolioAnalysisScreen = React.lazy(
  () => import('./screens/initiatives-portfolio-analysis')
);
// ── Screen registry (extensible) ──────────────────────────────────────────
const FabRailKebabScreen = React.lazy(() => import('./screens/fab-rail-kebab'));
const PrawyPanelSzynaIkonScreen = React.lazy(() => import('./screens/prawy-panel-szyna-ikon'));
const Exe002004UiAuditScreen = React.lazy(() => import('./screens/exe-002-004-ui-audit'));
const Mw007CalendarNarrowViewportScreen = React.lazy(
  () => import('./screens/mw-007-calendar-narrow-viewport')
);
const MethodWorkspaceScreen = React.lazy(() => import('./screens/method-workspace'));
const DrdHttpWorkspaceScreen = React.lazy(() => import('./screens/drd-http-workspace'));
const AssessmentArtifactsRestartScreen = React.lazy(
  () => import('./screens/assessment-artifacts-restart')
);
const ResultsVNextRegistryShellScreen = React.lazy(
  () => import('./screens/results-vnext-registry-shell')
);
const ResultsVNextKpiRegistryScreen = React.lazy(
  () => import('./screens/results-vnext-kpi-registry')
);
const ResultsVNextRoiRegistryScreen = React.lazy(
  () => import('./screens/results-vnext-roi-registry')
);
const ResultsVNextRoiModelScreen = React.lazy(
  () => import('./screens/results-vnext-roi-model')
);
const ResultsVNextRoiFullToolScreen = React.lazy(
  () => import('./screens/results-vnext-roi-full-tool')
);
const ResultsVNextOkrRegistryScreen = React.lazy(
  () => import('./screens/results-vnext-okr-registry')
);
const ResultsVNextOkrObjectivesScreen = React.lazy(
  () => import('./screens/results-vnext-okr-objectives')
);
const ResultsVNextOkrWorkspaceScreen = React.lazy(
  () => import('./screens/results-vnext-okr-workspace')
);
const ResultsVNextOkrAdminScreen = React.lazy(
  () => import('./screens/results-vnext-okr-admin')
);
const ResultsVNextKpiScorecardsScreen = React.lazy(
  () => import('./screens/results-vnext-kpi-scorecards')
);
const ResultsVNextKpiToolScreen = React.lazy(
  () => import('./screens/results-vnext-kpi-tool')
);
const ResultsVNextLegacyArchiveScreen = React.lazy(
  () => import('./screens/results-vnext-legacy-archive')
);
const ResultsVNextAttentionScreen = React.lazy(() => import('./screens/results-vnext-attention'));
const ResultsVNextRoiPirOutcomesScreen = React.lazy(
  () => import('./screens/results-vnext-roi-pir-outcomes')
);
const RnG3ClassLRecordShellScreen = React.lazy(() => import('./screens/rn-g3-class-l-record-shell'));
const ResultsVNextTeresaKpiDeviationScreen = React.lazy(
  () => import('./screens/results-vnext-teresa-kpi-deviation')
);
const ResultsVNextTeresaOkrReflectionScreen = React.lazy(
  () => import('./screens/results-vnext-teresa-okr-reflection')
);

const SCREENS: Record<string, { label: string; render: () => React.ReactElement }> = {
  'drd-http-workspace': {
    label:
      'T5 — REALNY <DrdHttpMethodWorkspaceScreen> (P0C, HTTP source-of-truth, ff drdHttpSourceOfTruthV1 not-yet-wired) — &stage=fresh|inprogress|blocked|frozen &state=loading|error|offline|conflict &view=interview|split|matrix',
    render: () => <DrdHttpWorkspaceScreen />,
  },
  'assessment-artifacts-restart': {
    label:
      'T5 — REALNY <AssessmentHub initialTab="outputs"> (AssessmentOutputsTab P0D kernel rewrite, 2026-08-13) — &tab=outputs|reports|initiatives &select=1 &lineage=1',
    render: () => <AssessmentArtifactsRestartScreen />,
  },
  'method-workspace': {
    label:
      'A5 — Method Workspace shell (interview/split/matrix), ff methodWorkspaceShellV1. &view=interview|split|matrix &state=default|resolution|savefailed|teresaRich',
    render: () => <MethodWorkspaceScreen />,
  },
  'results-vnext-registry-shell': {
    label:
      'RN-G2 P0 — REALNY <ResultsVNextRegistryShell> (KPI/ROI/OKR): loading/empty/error/forbidden + locked/honest-missing. &domain=kpi|roi|okr &state=ready|loading|empty|error|forbidden &reason=<deny> &selected=<id|none>',
    render: () => <ResultsVNextRegistryShellScreen />,
  },
  'results-vnext-kpi-registry': {
    label:
      'RN-G2 P1 — REALNY <ResultsKpiRegistryPage> (KPI registry, real GET/POST /vnext/results/kpi* stubbed): My/Org tabs, status chips, lifecycle kebab (activate/suspend/archive), lazy measurement preview, deep-link forbidden. &state=ready|loading|empty|error &kpiId=<id> &ff=off',
    render: () => <ResultsVNextKpiRegistryScreen />,
  },
  'results-vnext-roi-registry': {
    label:
      'RN-G2 P2 — REALNY route entry <ResultsRoiRegistryPage> (flaga roiRegistry: OFF -> EmptyState "results-vnext-roi-disabled", ON -> realny <ResultsRoiHub>): All cases + Benefits realization, honest NPV/IRR/payback, lock badges. &tab=all|benefits &state=ready|loading|empty|error &selected=<caseId|none> &calc=loading|ready &ff=off',
    render: () => <ResultsVNextRoiRegistryScreen />,
  },
  'results-vnext-roi-model': {
    label:
      'RN-G2 §G #12-14 — REALNY <RoiCaseFullTool initialPhase="build"> -> <RoiCaseModelWorkspace>: Baseline+polityka (2-wierszowa tabela), Założenia/Koszty/Korzyści CRUD. &tab=settings|assumptions|cost-lines|benefit-lines &state=ready|loading|empty|error &selected=<id|none> &locked=1 &nullBaseline=1 &nullPolicy=1 &editBaseline=1 &editPolicy=1 &assumptionForm=create|edit &costLineForm=create|edit &benefitLineForm=create|edit &removeAssumption=1 &removeCostLine=1 &removeBenefitLine=1 &formState=idle|saving|error|conflict',
    render: () => <ResultsVNextRoiModelScreen />,
  },
  'results-vnext-roi-full-tool': {
    label:
      'FALA 1 (ROI) — REALNY <ResultsRoiHub> -> <RoiCaseFullTool> (4 fazy: Build Case/Decision/Realize Value/Learn), window.fetch stubbed statefully for the whole /vnext/results/roi surface, real onClose (no harness no-op). Click the case row, then kebab "Otwórz pełne narzędzie".',
    render: () => <ResultsVNextRoiFullToolScreen />,
  },
  'results-vnext-okr-registry': {
    label:
      'RN-G2 P3 #23 — REALNY route entry <ResultsOkrRegistryPage> (flaga okrRegistry: OFF -> EmptyState "results-vnext-okr-disabled", ON -> realny <ResultsOkrHub>), window.fetch stubbed for /api/vnext/results/okr*. Organization/My/Company tabs (real clicks, real fetch per tab), honest progress/confidence, lock badges, real ?setId= deep link. &state=ready|loading|empty|error &ff=off',
    render: () => <ResultsVNextOkrRegistryScreen />,
  },
  'results-vnext-okr-objectives': {
    label:
      'RN-G2 §G #25 — REALNE <OkrObjectivesView>/<OkrKeyResultsView>/<OkrCheckInsView> (OQ-UI-I fix 2026-08-11: production components + window.fetch stub, real modals with real onClose — not eight no-ops). Click through the real drill (Cele -> Kluczowe Rezultaty -> Check-iny) inside the harness. &level=objectives|keyResults|checkIns (initial level) &setStatus=<status> &state=ready|loading|empty|error',
    render: () => <ResultsVNextOkrObjectivesScreen />,
  },
  'results-vnext-okr-workspace': {
    label:
      'RN-G3 lane okr full-tool task (2026-08-11) — REALNY <OkrSetWorkspace> (pełne narzędzie: Przegląd/Cele i KR/Dopasowania/Rozmowy i wsparcie/Przegląd i refleksja/Historia), window.fetch stubbed, real component + real tab clicks; onSetChanged/onBackToSets real (harness state), status po przejściu cyklu życia faktycznie się odświeża. &setStatus=<status> &asOwner=1',
    render: () => <ResultsVNextOkrWorkspaceScreen />,
  },
  'results-vnext-okr-admin': {
    label:
      'RN-G3 lane okr full-tool task (2026-08-11) — REALNE <OkrProgramsPage>/<OkrCyclesPage> (powierzchnie administracyjne Programu/Cyklu, OSOBNE od Set workspace), window.fetch stubbed. &page=programs|cycles',
    render: () => <ResultsVNextOkrAdminScreen />,
  },
  'results-vnext-kpi-scorecards': {
    label:
      'RN-G2 P1 #8 — REALNY <ResultsKpiScorecardDetailPage> (trasa /results/kpi/scorecards/:scorecardId pod MemoryRouter, Api.get/Api.post stubbed) — szczegóły karty (Pozycje/Migawki), status GET .../status, lock NO_MEMBERS. Lista kart wyników = zakładka "Karty wyników" w results-vnext-kpi-registry (REALNY <ResultsKpiRegistryPage>), nie osobny ekran tutaj. &tab=items|snapshots &state=ready|loading|empty|error|forbidden &selected=<id|none> &scorecard=sc-1|sc-2|sc-3|sc-4',
    render: () => <ResultsVNextKpiScorecardsScreen />,
  },
  'results-vnext-kpi-tool': {
    label:
      'RN-G3 lane — REALNY <KpiToolPage> + <KpiDeviationCaseSubview> (klasa L, D03/D05), zamontowane pod jednym <MemoryRouter> z prawdziwym useNavigate() między nimi. &view=tool|case &state=ready|loading|error &caseState=open|analysis_required|plan_required|plan_submitted|approved|executing|recovery_observed|verification|closed &severity=warning|critical &escalated=1 &impacts=0 &ff=off',
    render: () => <ResultsVNextKpiToolScreen />,
  },
  'results-vnext-teresa-kpi-deviation': {
    label:
      'RN-G5 lane teresa (2026-08-12) — REALNY <KpiDeviationCaseSubview> Phase 2 "Poproś Teresę o zapis przez pipeline" (reflection_rca), window.fetch stubbed statefully for /api/v8/teresa/proposal* (P08) PLUS Api.get/post/put for /vnext/results/kpi*. Case starts at analysis_required. &teresaDown=1 (transport failure -> manual fallback) &teresaDeny=1 (first execute denies -> blocked banner, no silent success)',
    render: () => <ResultsVNextTeresaKpiDeviationScreen />,
  },
  'results-vnext-teresa-okr-reflection': {
    label:
      'RN-G5 lane teresa (2026-08-12) — REALNY <OkrReviewReflectionView> "Poproś Teresę o szkic refleksji" (reflection_synthesis), window.fetch stubbed statefully for /api/v8/teresa/proposal* (P08) PLUS /api/vnext/results/okr/*. Set status=review, one Objective. &teresaDown=1 (transport failure -> manual fallback) &teresaDeny=1 (first execute denies -> blocked banner, no silent success)',
    render: () => <ResultsVNextTeresaOkrReflectionScreen />,
  },
  'results-vnext-legacy-archive': {
    label:
      'RN-G2 R09-3 — REALNY <ResultsVNextLegacyArchivePanel> (kpi/roi/okr .../legacy index, tylko do odczytu, prep pod kolejną falę — NIEPODPIĘty do żadnego huba). &domain=kpi|roi|okr &state=ready|loading|empty|error',
    render: () => <ResultsVNextLegacyArchiveScreen />,
  },
  'results-vnext-attention': {
    label:
      'RN-G5 §G #30 — REALNY <ResultsAttentionPage> (przekrojowy widok KPI+OKR attention/team-health, Api.get stubbed). Menu2 KPI/OKR, Menu3 = bucket (real counts). &kpiState=ready|loading|empty|error &okrState=ready|loading|empty|error &ff=off',
    render: () => <ResultsVNextAttentionScreen />,
  },
  'results-vnext-roi-pir-outcomes': {
    label:
      'RN-G5 §G #11 — REALNY <RoiPirOutcomesTab> przez <ResultsRoiPirOutcomesPage> (ROI org PIR-outcomes, window.fetch stubbed dla /org/pir-outcomes). Gotowy do wpięcia jako 3. zakładka ResultsRoiHub. &state=ready|loading|empty|error &ff=off',
    render: () => <ResultsVNextRoiPirOutcomesScreen />,
  },
  'rn-g3-class-l-record-shell': {
    label:
      'RN-G3 tor PLATFORMY §1 — DEMONSTRACJA przepisu powłoki klasy L (archetyp Rekord): ArtifactBreadcrumb + NModeShell + ArtifactRightPanel/ArtifactPropertiesTable, zero nowego standardu. &save=idle|saving|saved|error|conflict &teresa=1',
    render: () => <RnG3ClassLRecordShellScreen />,
  },
  'idea-financial-case-persistence': {
    label:
      'E09 RISK-12 — REALNY <FinancialCaseDialog> z REALNYM zapisem: ?state=empty|loading|dirty|saving|saved|error|conflict|reopened (stanowy mock transportu)',
    render: () => <IdeaFinancialCasePersistenceScreen />,
  },
  'mw-007-calendar-narrow-viewport': {
    label:
      'MW-07 Codex FINAL UX FIX_REQUIRED — REALNY <CalendarView>: sidebar nie nachodzi na grid poniżej breakpointu mobile (useIsMobile + Drawer)',
    render: () => <Mw007CalendarNarrowViewportScreen />,
  },
  'exe-002-004-ui-audit': {
    label:
      'EXE-002-004 — audyt UI: milestone-creation (Tasks & Milestones) + RAID persistence (RaidSection), REALNY <InitiativeDocumentView sourceModule="execution">, stanowy mock POST/PATCH/DELETE',
    render: () => <Exe002004UiAuditScreen />,
  },
  'fab-rail-kebab': {
    label: 'PILNE-9 — pływające przyciski vs kebab ostatniego wiersza (&fix=off = stan przed)',
    render: () => <FabRailKebabScreen />,
  },
  'materialy-launcher': {
    label: 'MATERIAŁY — tablica Dodaj (format×tryb) &variant=materials|templates',
    render: () => <MaterialyLauncherScreen />,
  },
  'materialy-template-library-slice': {
    label:
      'MATERIAŁY — Biblioteka wzorców, slice „szablon dokumentu": Legacy · osierocony (bez użycia) · brak metadanych',
    render: () => <MaterialyTemplateLibrarySliceScreen />,
  },
  'materialy-draft-template-visibledraft-fix': {
    label:
      'MATERIAŁY — naprawa 2026-07-28: draft szablonu dokumentu teraz widoczny w Bibliotece (owner: "New template" nie pokazywał mojej pracy)',
    render: () => <MaterialyDraftTemplateVisibilityFixScreen />,
  },
  'document-studio-template-resolve-error': {
    label:
      'DOCUMENT STUDIO — „Użyj wzorca" odrzucone serwerowo: stan blokujący (bez pickera, bez AI). ?case=orphaned|forbidden|deprecated|not_indexed|resolving',
    render: () => <DocumentStudioTemplateResolveErrorScreen />,
  },
  'prezentacje-template-states': {
    label:
      'PREZENTACJE — „Użyj wzorca" z Biblioteki (R11 deck slice): loading + 2 stany blokujące. ?variant=loading|orphaned|forbidden',
    render: () => <PrezentacjeTemplateStatesScreen />,
  },
  'report-builder-library-template': {
    label:
      'REPORT BUILDER — „Użyj wzorca" z Biblioteki (report_template, R1 2026-07-26): sukces (modal, pole zablokowane) + stany blokujące. ?variant=success|orphaned|deprecated|forbidden',
    render: () => <ReportBuilderLibraryTemplateScreen />,
  },
  'document-studio-resume-error': {
    label:
      'DOCUMENT STUDIO — nieudane wznowienie (P0.2): blokujący błąd PL zamiast intake. ?case=notfound|server',
    render: () => <DocumentStudioResumeErrorScreen />,
  },
  'document-studio-context-chip': {
    label:
      'DOCUMENT STUDIO — chip kontekstu organizacji (P0 2026-07-27): co zostanie automatycznie dołączone.',
    render: () => <DocumentStudioContextChipScreen />,
  },
  'document-studio-ai-teresa': {
    label:
      'DOCUMENT STUDIO — FAZA B1 (2026-07-27): "Z AI" bez formularza, Teresa z boku (ff_zai_teresa).',
    render: () => <DocumentStudioAiTeresaScreen />,
  },
  'document-studio-streaming-honesty-n3': {
    label:
      'DOCUMENT STUDIO — N3 (2026-07-28): doktryna streaming — notyfikacja fallback, Stop, chipy źródeł, plan w Mode 3. ?simFail=1 dla naprawy #1.',
    render: () => <DocumentStudioStreamingHonestyN3Screen />,
  },
  'document-studio-menu-pliku': {
    label:
      'DOCUMENT STUDIO — N19/N20 (2026-07-28): menu „Plik" (Nowy·Otwórz·Zapisz·Zapisz jako) + afordancje wyjścia (Start over / breadcrumb).',
    render: () => <DocumentStudioMenuPlikuScreen />,
  },
  'document-studio-save-as-template': {
    label:
      'DOCUMENT STUDIO — FALA 2 (2026-07-28): „Zrób z tego wzorzec" — Plik→Zrób z tego wzorzec→3-5 pytań doprecyzowujących→createTemplateFromArtifact.',
    render: () => <DocumentStudioSaveAsTemplateScreen />,
  },
  'audyty-drd-report': {
    label:
      'AUDYTY — zakładka „Raporty DRD" (ff_drd_report) + DRDAuditReportView. ?variant=list|report',
    render: () => <AudytyDrdReportScreen />,
  },
  'assessment-quality-review-panel': {
    label:
      'ASSESSMENT — ASM-005/006/007: Outputs → evidence/scoring + accept/return + niezmienny output. ?variant=mixed|accepted|empty',
    render: () => <AssessmentQualityReviewPanelScreen />,
  },
  'menu-canon-sidebar-check': {
    label:
      'SIDEBAR — potwierdzenie braku osobnej pozycji "Excel" po feat/materials-menu-canon-5-tabs.',
    render: () => <MenuCanonSidebarCheckScreen />,
  },
  'initiatives-portfolio-analysis': {
    label:
      'Inicjatywy → analiza portfela — 5 podwidoków po wycięciu atrap AI (&sub=…, &ai=ok|fail|empty)',
    render: () => <InitiativesPortfolioAnalysisScreen />,
  },
  'ntype-analizuj-ai': {
    label:
      'n-Type ETAP 3 — „Analizuj z AI": menu 2 + panel wyników (Braki · Ryzyka · Sugestie · Zmiany)',
    render: () => <NTypeAnalizujAiScreen />,
  },
  odbior: {
    label: '★ PANEL ODBIORU — wszystkie obszary (rejestr/3-DO-ODBIORU), żywe ekrany + werdykty',
    render: () => <OdbiorScreen />,
  },
  'gen-deck-content-hints': {
    label:
      'DOKUMENTY — Gen. Deck catch-up: per-slide content hints w Deck Template Architect (audyt 2026-07-22)',
    render: () => <GenDeckContentHintsScreen />,
  },
  'gen-excel-templates-tab': {
    label:
      'DOKUMENTY — Gen. Excel W1: zakładka huba "Generator szablonów Excel" (ff_workbook_templates, 3 wzorce)',
    render: () => <GenExcelTemplatesTabScreen />,
  },
  'gen-word-content-hints': {
    label:
      'DOKUMENTY — Gen. Word W2: content hints per sekcja w Word Template Architect (ff_tpl_editor)',
    render: () => <GenWordContentHintsScreen />,
  },
  'deck-quality-badge': {
    label:
      'DOKUMENTY — Deck W4: badge jakości (critic/M19) na kroku wyniku kreatora (&clean=1 dla 0 uwag)',
    render: () => <DeckQualityBadgeScreen />,
  },
  'word-quality-badge': {
    label:
      'DOKUMENTY — Word W4: badge fabrykacji w panelu QA Document Studio (&clean=1 dla zweryfikowane)',
    render: () => <WordQualityBadgeScreen />,
  },
  'word-intake-uselm-default': {
    label: 'DOKUMENTY — Word intake: domyślnie „Wygeneruj treść z AI" (audyt 2026-07-22, Word #8)',
    render: () => <WordIntakeUseLlmDefaultScreen />,
  },
  'excele-engine-reveal': {
    label: 'DOKUMENTY — Excel: silnik arkuszy pod /excele (home) (audyt 2026-07-22, Sheet #9)',
    render: () => <ExceleEngineRevealScreen />,
  },
  'excele-reopen-verify': {
    label:
      'DOKUMENTY — Excel: naprawa "nie mam czego otworzyć" — reopen wiszącego artifactId → honest error zamiast pustego fake-podglądu (2026-07-23)',
    render: () => <ExceleReopenVerifyScreen />,
  },
  'excele-jeden-widok-recent': {
    label:
      'EXCELE — "jeden Excel" ścieżka 3: Recent/Saved tab → otwarcie → edytowalna siatka (2026-07-28)',
    render: () => <ExceleJedenWidokRecentScreen />,
  },
  'excele-jeden-widok-materialy': {
    label:
      'EXCELE — "jeden Excel" ścieżka 4: Materiały → Arkusze → otwarcie z listy → edytowalna siatka, nie pobranie/Table Studio (2026-07-28)',
    render: () => <ExceleJedenWidokMaterialyScreen />,
  },
  'excele-jeden-widok-pusty': {
    label:
      'EXCELE — "jeden Excel" ścieżka 2: Start new → Czysto → pusta ale edytowalna siatka (12x30), nie zastępczy obrazek (2026-07-28)',
    render: () => <ExceleJedenWidokPustyScreen />,
  },
  // (deck-artifact / sheet-artifact są zarejestrowane niżej, w bloku DOKUMENTY
  // razem z document-artifact — scalenie fix/crimson-deck-sheet dołożyło tu ich
  // duplikat, zdjęty przy rozwiązywaniu konfliktu.)
  'idea-table-tool-kebab': {
    label: 'IDEE Table — K1 kebab wiersza (PlatformGridView, prawy-klik) — audyt-idee 2026-07-22',
    render: () => <IdeaTableToolKebabScreen />,
  },
  'idea-table-record-templates': {
    label: 'IDEE Table — RecordTemplateManager (RISK-06 dead-mount wiring) — 2026-08-12',
    render: () => <IdeaTableRecordTemplatesScreen />,
  },
  'idea-table-tool-paste': {
    label: 'IDEE Table — Ctrl/Cmd+V wklejanie (PlatformGridView, Z16b domknięcie) — 2026-07-22',
    render: () => <IdeaTableToolPasteScreen />,
  },
  'idea-table-tool-sortfilter': {
    label:
      'IDEE Table — Sortowanie po nagłówku + filtr per kolumna (PlatformGridView, Fala 7) — 2026-07-22',
    render: () => <IdeaTableToolSortFilterScreen />,
  },
  'idea-table-tool-empty-filter': {
    label:
      'IDEE Table — Stan pustego filtra + resize kolumn + gęstość wierszy (PlatformGridView, Fala 8) — 2026-07-23',
    render: () => <IdeaTableToolEmptyFilterScreen />,
  },
  'idea-table-tool-grouping': {
    label:
      'IDEE Table — Grupowanie: dropdown "Grupuj wg" + zwijanie grup (PlatformGridView, Fala 10) — 2026-07-23',
    render: () => <IdeaTableToolGroupingScreen />,
  },
  'karta-tool': {
    label: 'KARTY N — Tool (harness odbioru 2026-07-21)',
    render: () => <KartaToolScreen />,
  },
  'karta-initiative': {
    label: 'KARTY N — Initiative (harness odbioru 2026-07-21)',
    render: () => <KartaInitiativeScreen />,
  },
  'karta-insight': {
    label: 'KARTY N — Insight (harness odbioru 2026-07-21)',
    render: () => <KartaInsightScreen />,
  },
  'karta-interview': {
    label: 'KARTY N — Interview Session (harness odbioru 2026-07-21)',
    render: () => <KartaInterviewScreen />,
  },
  'karta-decision': {
    label: 'KARTY N — Decision (harness odbioru 2026-07-21)',
    render: () => <KartaDecisionScreen />,
  },
  'karta-notification': {
    label: 'KARTY N — Notification (harness odbioru 2026-07-21)',
    render: () => <KartaNotificationScreen />,
  },
  'karta-task': {
    label: 'KARTY N — Task (harness odbioru 2026-07-21)',
    render: () => <KartaTaskScreen />,
  },
  'preview-4-zakladki': {
    label: 'KARTY N — Preview — 4 zakladki My Work (harness odbioru 2026-07-21)',
    render: () => <PreviewZakladkiScreen />,
  },
  'accent-soft-token-fix': {
    label:
      'J23 — bg-c-accent-soft opacity bug fix (cTok): odznaka REKOMENDACJA tint vs pełny crimson',
    render: () => <AccentSoftTokenFixScreen />,
  },
  'ui-foundation-focus-01-evidence': {
    label: 'UI-FOUNDATION-FOCUS-01 — Visual QA evidence (Etap 2, 2026-08-03)',
    render: () => <UiFoundationFocus01EvidenceScreen />,
  },
  'admin-command-center-panel': {
    label:
      'F-CC1…F-CC4 Command Center — Overview (już zdjęte)/Audyt SOC2/DLP/Rezydencja/Retencja/Polityka AI (&tab=)',
    render: () => <AdminCommandCenterPanelScreen />,
  },
  'admin-sso-self-service-card': {
    label: 'HP-24 SSO self-service — SAML skonfigurowany (2 domeny) + panel wyniku testu',
    render: () => <AdminSsoSelfServiceCardScreen />,
  },
  'agent-plan-view': {
    label:
      'HP-4 F3 — /agent-plan entry point (AgentManifestLauncher → AgentPlanPanel), ff_agentPlan; append &ff_agentPlan=1 to the URL',
    render: () => <AgentPlanViewScreen />,
  },
  'agent-plan-canvas': {
    label:
      'AGT-007 — AgentPlanCanvas przestawialny schemat (ścieżka ① 5-fazowy vs ② pusty), status planning',
    render: () => <AgentPlanCanvasScreen />,
  },
  'agent-hub': {
    label:
      'AGT-010 — powłoka Run agent (Moje procesy | Szablony) PRZED AgentPlanWorkspace, tabela planning/executing/awaiting_approval/completed/failed',
    render: () => <AgentHubScreen />,
  },
  'tabele-fala2-przed-po': {
    label:
      'FALA TABEL 2026-07-28 — PRZED/PO: priorytet kropka+tekst (N-24/N-29), Delete na końcu stopki podglądu (PILNE-10), kontrola regresji Approve/Reject',
    render: () => <TabeleFala2PrzedPoScreen />,
  },
  'menu-dlugi-domkniecie': {
    label:
      'AGT-015 §6 D1-D4 — ikona CTA/„Nowy agent"/FolderCreateDialog, montowane z REALNYM HubBarSlotsProvider (agent-hub bez providera nie pokazuje Menu 2). &empty=1 → agent-hub empty-state',
    render: () => <MenuDlugiDomkniecieScreen />,
  },
  'agent-warsztat': {
    label:
      'WARSZTAT AGENTA — 3 kolumny (sterowanie · schemat blokowy · paleta klocków); &case=planning|executing|approval',
    render: () => <AgentWarsztatScreen />,
  },
  'vault-sejf-wnetrze': {
    label:
      'VAULT — wnętrze sejfu po redesignie (Menu 1/2/3 + StandardTable + preview + panel „Dodaj dokument"). ?pusty=1 → stan pusty',
    render: () => <VaultSejfWnetrzeScreen />,
  },
  'vault-folder-block-proof': {
    label:
      'VLT-FOLDERS — klocek "Vault-kontekst" (AgentPlanCanvas): select Poziom + DRUGI select Folder wewnątrz sejfu',
    render: () => <VaultFolderBlockProofScreen />,
  },
  'capability-gate-demo': {
    label: 'Faza C — CapabilityGate: shadow vs debugCapabilities vs enforce (model ról PM)',
    render: () => <CapabilityGateDemoScreen />,
  },
  'template-create-wizard': {
    label: '#83c START kreatora szablonu (nazwa → typ → dostępność)',
    render: () => <TemplateCreateWizardScreen />,
  },
  'public-booking-widget': {
    label: '#24c Publiczny widget booking (Calendly-like, niezalogowany) — CTA neutralny',
    render: () => <PublicBookingWidgetScreen />,
  },
  'document-studio-blocks-i18n': {
    label: 'M18 #3 — Document Studio bloki: puste stany i18n (Table/Kpi/Chart)',
    render: () => <DocumentStudioBlocksI18nScreen />,
  },
  'document-studio-m1-share-primary': {
    label: 'M18 #2 — Document Studio M1: "Udostępnij" primary, Export DOCX obok (kanon Formuły)',
    render: () => <DocumentStudioM1SharePrimaryScreen />,
  },
  'document-studio-nowy-dokument-martwe-przyciski': {
    label:
      'P-10/P-11/P-12 (2026-07-28) — Nowy dokument: edycja tytułu, Cofnij/Ponów, przyciski paska',
    render: () => <DocumentStudioNowyDokumentMartweprzyciskiScreen />,
  },
  'document-studio-blocks-i18n': {
    label: 'M18 #3 — Document Studio bloki: puste stany i18n (Table/Kpi/Chart)',
    render: () => <DocumentStudioBlocksI18nScreen />,
  },
  'wave3-creators-crimson': {
    label: 'Fala 3 — ReportBuilder+AIChat+Meeting: crimson-fill CTA sweep (swatch, PO naprawie)',
    render: () => <Wave3CreatorsCrimsonScreen />,
  },
  'template-library-new-entry': {
    label: 'Wpięcie „Nowy szablon" (Biblioteka wzorców → TemplateBuilderFlow)',
    render: () => <TemplateLibraryNewEntryScreen />,
  },
  'template-builder-doc': {
    label: '#83c/#83d Builder DOKUMENT (Word) — wspólna powłoka MELS',
    render: () => <TemplateBuilderDocScreen />,
  },
  'template-builder-deck': {
    label: '#83c/#83d Builder PREZENTACJA (Deck) — wspólna powłoka MELS',
    render: () => <TemplateBuilderDeckScreen />,
  },
  'template-builder-table': {
    label: '#83c/#83d Builder ARKUSZ (Excel) — wspólna powłoka MELS',
    render: () => <TemplateBuilderTableScreen />,
  },
  'results-three-pairs': {
    label: '#81 Results — 3 pary (KPI/ROI/OKR)',
    render: () => <ResultsThreePairsScreen />,
  },
  'notatnik-centrum-mysli': {
    label: 'Notatnik = CENTRUM MYŚLI (#16 auto-notatka · #21 przypomnij · #23 presence)',
    render: () => <NotatnikCentrumMysliScreen />,
  },
  'notatnik-osierocone-graf': {
    label: '#18 Notatnik — graf połączeń (naprawiony) + osierocone notatki',
    render: () => <NotatnikOsieroconeGrafScreen />,
  },
  'ev-football-field': {
    label: 'EV Basket Football Field (Finance)',
    render: () => <EvFootballFieldScreen />,
  },
  'finance-value-panels': {
    label:
      'Section B — M16 ValueOffice + DriverPlanner: real-data wiring, POPULATED vs EMPTY (&panel=value|driver &state=populated|empty)',
    render: () => <FinanceValuePanelsScreen />,
  },
  'finance-model-workspace': { label: 'Finance model workspace', render: () => <FinanceModelWorkspaceScreen /> },
  'finance-workspace-bar': { label: 'Finance workspace bar', render: () => <FinanceWorkspaceBarScreen /> },
  'finance-focus-mode': { label: 'Finance focus mode', render: () => <FinanceFocusModeScreen /> },
  'finance-statement-pack-workspace-v2': { label: 'Finance statement pack workspace', render: () => <FinanceStatementPackWorkspaceV2Screen /> },
  'finance-baseline-workspace': { label: 'Finance baseline workspace', render: () => <FinanceBaselineWorkspaceScreen /> },
  'finance-prediction-workspace': { label: 'Finance prediction workspace', render: () => <FinancePredictionWorkspaceScreen /> },
  'finance-id-bridge': { label: 'Finance ID bridge', render: () => <FinanceIdBridgeScreen /> },
  'finance-analysis-workspace': { label: 'Finance analysis workspace', render: () => <FinanceAnalysisWorkspaceScreen /> },
  'finance-valuation-workspace': { label: 'Finance valuation workspace', render: () => <FinanceValuationWorkspaceScreen /> },
  'finance-lineage-navigator': { label: 'Finance lineage navigator', render: () => <FinanceLineageNavigatorScreen /> },
  'finance-compare-panel': { label: 'Finance compare panel', render: () => <FinanceComparePanelScreen /> },
  'finance-comments-panel': { label: 'Finance comments panel', render: () => <FinanceCommentsPanelScreen /> },
  'finance-saved-views-panel': { label: 'Finance saved views panel', render: () => <FinanceSavedViewsPanelScreen /> },
  'finance-export-import-panel': { label: 'Finance export import panel', render: () => <FinanceExportImportPanelScreen /> },
  'execution-change-signals': {
    label:
      'M14-wire — ExecutionChangeSignalsPanel (capacity signals · ADKAR readiness · champions), flaga changeSignals default OFF',
    render: () => <ExecutionChangeSignalsScreen />,
  },
  'execution-export-prezentacja': {
    label:
      'Naprawa 2026-07-27 — Execution „Export as presentation" → PrezentacjeView konsumuje sourceType/sourceName/content (2 fazy: klik → auto-start Z AI)',
    render: () => <ExecutionExportPrezentacjaScreen />,
  },
  'assessment-list': {
    label: 'Assessment list (TRIADA: StandardModuleBar + StandardTable)',
    render: () => <AssessmentListScreen />,
  },
  'assessment-five-surfaces': {
    label: 'T22 final closeout — real AssessmentHub with five surfaces forced ON',
    render: () => <AssessmentFiveSurfacesScreen />,
  },
  'standard-module-bar-children': {
    label:
      'StandardModuleBar + children (rozszerzenie 2026-07-26, program ujednolicenia Menu 9 hubów)',
    render: () => <StandardModuleBarChildrenScreen />,
  },
  'assessment-menu3-status-chips': {
    label:
      '#71 REALNY AssessmentHub — Menu 3 klikalne chipy statusu (ff assessmentMenu3StatusChips forced ON)',
    render: () => <AssessmentMenu3StatusChipsScreen />,
  },
  'assessment-initiatives-panel': {
    label: '§27-todo: InitiativesManagementPanel (Assessment→Manage→Initiatives) → StandardTable',
    render: () => <AssessmentInitiativesPanelScreen />,
  },
  'assessment-reports-panel': {
    label: '§27-todo: ReportsManagementPanel (Assessment→Manage→Reports) → StandardTable',
    render: () => <AssessmentReportsPanelScreen />,
  },
  'assessment-initiatives-table': {
    label: '§27-todo batch2: InitiativesTable (Assessment→Board→Initiatives) → StandardTable',
    render: () => <AssessmentInitiativesTableScreen />,
  },
  'report-builder-block-types': {
    label: '§27-todo: BlockTypesManager (Report Builder → Block Types) → StandardTable',
    render: () => <ReportBuilderBlockTypesScreen />,
  },
  'report-builder-templates': {
    label: '§27-todo: TemplatesManager (Report Builder → Templates) → StandardTable',
    render: () => <ReportBuilderTemplatesScreen />,
  },
  'model-catalog-table': {
    label: '§27-todo: ModelCatalogTable (SuperAdmin → Model Registry) → StandardTable',
    render: () => <ModelCatalogTableScreen />,
  },
  'partner-settlements-view': {
    label: '§27-todo: PartnerSettlementsView (SuperAdmin → Revenue) → StandardTable ×4',
    render: () => <PartnerSettlementsViewScreen />,
  },
  'prompt-registry-tab': {
    label:
      'Oxford O5.5: PromptRegistryTab (SuperAdmin → AI Platform → Development) → StandardTable (ff promptRegistryUi)',
    render: () => <PromptRegistryTabScreen />,
  },
  'assessment-reports-table': {
    label: '§27-todo batch2: ReportsTable (Assessment→Board→Reports, global) → StandardTable',
    render: () => <AssessmentReportsTableScreen />,
  },
  'assessment-output-report': {
    label:
      'Assessment Report (SPEC-A Dokument) — renderer zamrożonego Outputu; ?variant=happy|edge|not-frozen',
    render: () => <AssessmentOutputReportScreen />,
  },
  'canvas-new-doc': {
    label: '#87a Canvas "+" New — 3 opcje startu (Czysty/Z szablonu/Z canvasa) → Teresa',
    render: () => <CanvasNewDocScreen />,
  },
  'canvas-toolbar-md-history': {
    label: '#87c naprawa: Import Markdown + Historia przeniesiona do kebaba (#87d wciąż otwarte)',
    render: () => <CanvasToolbarMdHistoryScreen />,
  },
  'canvas-kebab-restructure': {
    label: '#87d: restrukturyzacja kebaba „⋯" — 14 sekcji → 8 nazwanych grup (PRZED/PO)',
    render: () => <CanvasKebabRestructureScreen />,
  },
  'chat-split-teresa-right': {
    label: 'D17 /chat split ODWRÓCONY — artefakt po LEWEJ, Teresa po PRAWEJ',
    render: () => <ChatSplitTeresaRightScreen />,
  },
  'crimson-mywork-wave2': {
    label: 'Crimson Wave #2 (MyWork) — CTA/aktywne bg-c-accent → neutralne (PRZED/PO)',
    render: () => <CrimsonMyWorkWave2Screen />,
  },
  'crimson-wave-chrome-2026-07-26': {
    label:
      'Crimson purge 2026-07-26 (audyt TRIADA) — 6 plików shared/ModuleHub + MyWorkHub + InboxContent (PRZED/PO)',
    render: () => <CrimsonWaveChromeScreen />,
  },
  'decision-record': {
    label:
      'VF1-4 — REALNY <DecisionDetailView> (archetyp C·Rekord, SPEC-A powłoka) N-mode; &ff_vf1DecisionSpeca=1 wraz z VITE_VF1_DECISION_SPECA=true dla stanów gated',
    render: () => <DecisionRecordScreen />,
  },
  'standard-kanban-card': {
    label: '#75b JEDEN kanon karty kanban (StandardKanbanCard)',
    render: () => <StandardKanbanCardScreen />,
  },
  'mindmap-i18n-smoke': {
    label: 'Smoke i18n fala 2 — M06 Mind Map modale (ideas.mindmap.*)',
    render: () => <MindmapI18nSmokeScreen />,
  },
  'mm-ppm-measure': {
    label: 'MM-P2 (2026-08-10) — pomiar wysokości PPM węzła Mind Map (1280×800, do-usuniecia po odbiorze)',
    render: () => <MmPpmMeasureScreen />,
  },
  'navdeclutter-sidebar': {
    label: 'ODB O5 — REALNY <Sidebar> (navDeclutterFlag, default OFF); &ff_navDeclutter=1 dla ON',
    render: () => <NavDeclutterSidebarScreen />,
  },
  'prawy-panel-szyna-ikon': {
    label:
      'P-01 (28.07) — Deck Builder prawy panel: REALNY <RightRail> zepsuty vs mock propozycji (szyna ikon zawsze widoczna)',
    render: () => <PrawyPanelSzynaIkonScreen />,
  },
  'melscanvas-workspace': {
    label:
      'ODB O5 — REALNY <IdeaMapWorkspace> (melsCanvasFlag, default OFF); &ff_melsCanvas=1 dla ON',
    render: () => <MelsCanvasWorkspaceScreen />,
  },
  'processflow-canvas': {
    label: 'Fala 8 — Process Flow: krawędzie (strzałka domyślna + smoothstep + etykiety)',
    render: () => <ProcessFlowCanvasScreen />,
  },
  'whiteboard-canvas': {
    label: 'Fala 8 — Whiteboard: łączniki (4-str uchwyty magnetyczne)',
    render: () => <WhiteboardCanvasScreen />,
  },
  'idea-table-timeline-stuck': {
    label:
      'fix/table-timeline-stuck — REALNY <IdeaMapWorkspace initialTool="table"> — zakładka Timeline blokuje typ widoku na Gantt',
    render: () => <IdeaTableTimelineStuckScreen />,
  },
  'whiteboard-workshop': {
    label:
      'Naprawa 2026-07-26 — Whiteboard Session Layer/Scenes/prawy klik (mock stanowy); &ff_whiteboardSessionInPanel=1 dla ON',
    render: () => <WhiteboardWorkshopScreen />,
  },
  'b2-template-gallery': {
    label:
      'B2 — galeria szablonów Idei (mock STANOWY) dla 4 narzędzi; &tool=mindmap|whiteboard|process_flow|table, &empty=1 dla pustej kanwy',
    render: () => <B2TemplateGalleryScreen />,
  },
  'i18n-fala1-smoke': {
    label:
      'Smoke i18n fala 1 — realne TemplateBuilder (M10) / FormulaEditor (M08); &part=interview|ideas',
    render: () => <I18nFala1SmokeScreen />,
  },
  'ideas-teresa-panel': {
    label: 'D16/D17 JEDEN prawy panel idei = dok Teresy (IdeaRightPanel)',
    render: () => <IdeasTeresaPanelScreen />,
  },
  'idea-confidentiality-control': {
    label:
      'RISK-22 Poufność Idei — REALNY IdeaWorkspaceTools w IdeaRightPanel (?lang=pl|en, ?level=, ?fail=1)',
    render: () => <IdeaConfidentialityControlScreen />,
  },
  'idea-templates-catalog': {
    label: '#10-AB Baza ~40 startowych szablonów konsultingowych (7 kategorii)',
    render: () => <IdeaTemplatesCatalogScreen />,
  },
  'zwornik-projects': {
    label: '#78 Zwornik /projects — Stakeholderzy · Finanse · Zespół · Role · Zadania',
    render: () => <ZwornikProjectsScreen />,
  },
  'settings-crimson-neutralized': {
    label: 'Fala 1 Settings — crimson CTA/toggle/selected → neutralne (PRZED/PO, kanon #1)',
    render: () => <SettingsCrimsonNeutralizedScreen />,
  },
  'rose-danger-token-parity': {
    label: 'fix/rose-regression — dowód parytetu rose-* vs danger-* (Execution+Settings sweep)',
    render: () => <RoseDangerTokenParityScreen />,
  },
  'wave4-choices-crimson': {
    label:
      'Fala 4: bg-c-accent CTA/wybor → neutralne (Assessment/Initiatives/Execution/Results/Decisions)',
    render: () => <Wave4ChoicesCrimsonScreen />,
  },
  'wave5-internal-crimson': {
    label:
      'wave5-internal-crimson: naprawa bg-c-accent w Studio (Export/Link modal) — CTA/toggle/selected-tab',
    render: () => <Wave5InternalCrimsonScreen />,
  },
  'unified-create-launcher': {
    label:
      'I1-I3 Faza 0/1 — UnifiedCreateLauncher "+ Nowy" (Insight/Initiative/Decision), Krok 0 — &context=mywork|interview|initiatives',
    render: () => <UnifiedCreateLauncherScreen />,
  },
  'vault-scope-selector': {
    label:
      'VLT-003 — REALNY <DocumentsRAGTab variant="client"> — selektor poziomu upload, badge, filtr, ostrzeżenie zmiany zakresu',
    render: () => <VaultScopeSelectorScreen />,
  },
  'vault-safes-table': {
    label:
      'VLT-005 — REALNY <ClientDocumentsVault> — tabela sejfów (Mój/Organizacji/per projekt) → klik otwiera dokumenty sejfu, breadcrumb + powrót',
    render: () => <VaultSafesTableScreen />,
  },
  'idea-table': {
    label: 'IDEE — Idea jako tabela (pełny obiekt: lista + podgląd + prawy panel)',
    render: () => <IdeaTableScreen />,
  },
  'idea-table-production': {
    label:
      'IDEE — Idea jako tabela, KSZTAŁT PRODUKCYJNY (MyIdeasListContent.tsx:1785-1791, bez ArtifactRightPanel — S9-GATE4EVIDENCE TASK 1)',
    render: () => <IdeaTableProductionScreen />,
  },
  'mindmap-canvas': {
    label: 'IDEE — Idea jako mapa myśli (pełny obiekt, archetyp Canvas)',
    render: () => <MindmapCanvasScreen />,
  },
  'mywork-idea-topbar': {
    label:
      'IDEE — CAŁA góra: rząd pilli MyWorkHub + Menu 1 + Menu 3 (flaga ff_ideaTopBarOneLine=1 → jedna linia)',
    render: () => <MyWorkIdeaTopBarScreen />,
  },
  'teresa-confirm-chip': {
    label: 'IDEE — Teresa: kontrolka potwierdzenia akcji trwałych (F1-A)',
    render: () => <TeresaConfirmChipScreen />,
  },
  'teresa-chipy-sugestii': {
    label: 'TERESA — chipy sugestii pod oknem rozmowy (kontekst raportu vs insightu)',
    render: () => <TeresaChipySugestiiScreen />,
  },
  'teresa-chipy-panel-artefaktu': {
    label: 'TERESA — chipy sugestii w panelu artefaktu (POZIOM 3, historia ze sklepu)',
    render: () => <TeresaChipyPanelArtefaktuScreen />,
  },
  'ideas-preview-overlay': {
    label: 'IDEE — Idea: podgląd nakładkowy nad listą',
    render: () => <IdeasPreviewOverlayScreen />,
  },
  'deck-artifact': {
    label: 'DOKUMENTY — Prezentacja jako artefakt (pełny obiekt)',
    render: () => <DeckArtifactScreen />,
  },
  'document-artifact': {
    label: 'DOKUMENTY — Dokument tekstowy jako artefakt (pełny obiekt)',
    render: () => <DocumentArtifactScreen />,
  },
  'sheet-artifact': {
    label: 'DOKUMENTY — Arkusz jako artefakt (pełny obiekt: zakładki, siatka, formuły)',
    render: () => <SheetArtifactScreen />,
  },
  'excele-edytowalna-siatka': {
    label:
      'DOKUMENTY — Excel EDYTOWALNY (NPV/IRR, za ff_excele_edit — klik→edycja→przeliczenie→zapis)',
    render: () => <ExceleEdytowalnaSiatkaScreen />,
  },
  'excele-prawy-panel-standard': {
    label: 'DOKUMENTY — Excel PRAWY PANEL = szyna ikon jak Word (NPV/IRR, za ff_excele_right_rail)',
    render: () => <ExcelePrawyPanelStandardScreen />,
  },
};

const params = new URLSearchParams(window.location.search);
const screenKey = params.get('screen') || 'assessment-list';
const lang = params.get('lang') || 'pl';
const theme = params.get('theme') || 'light';

// Apply theme via the app's `.dark` class strategy (tailwind darkMode:'class').
const root = document.documentElement;
root.classList.toggle('dark', theme === 'dark');

// Ekrany montujące `AppProviders` mają własny ThemeSync, który czyta motyw ze
// store (domyślnie 'system') i NADPISUJE klasę ustawioną powyżej — wtedy
// `?theme=dark` dawał jasny ekran, gdy przeglądarka miała jasny motyw systemowy.
// Ustawiamy więc motyw w store, żeby ThemeSync doszedł do tego samego wniosku.
useAppStore.setState({ theme: theme === 'dark' ? 'dark' : 'light' });

// Dodatkowy bezpiecznik: gdyby jakikolwiek provider zdjął klasę po zamontowaniu,
// przywracamy ją. Harness ma pokazywać motyw z adresu, zawsze.
new MutationObserver(() => {
  const powinnaByc = theme === 'dark';
  if (root.classList.contains('dark') !== powinnaByc) {
    root.classList.toggle('dark', powinnaByc);
  }
}).observe(root, { attributes: true, attributeFilter: ['class'] });
document.body.style.background = 'var(--c-bg)';

// Apply language (component reads i18n.language for its inline pl/en copy).
void i18n.changeLanguage(lang);

const entry = SCREENS[screenKey];
const mount = document.getElementById('dev-render-root')!;

function Fallback(): React.ReactElement {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', color: 'var(--c-text)' }}>
      <h1>Dev Render Harness</h1>
      <p>
        Unknown <code>?screen={screenKey}</code>. Available screens:
      </p>
      <ul>
        {Object.entries(SCREENS).map(([k, v]) => (
          <li key={k}>
            <a href={`?screen=${k}&lang=${lang}&theme=${theme}`}>
              {k} — {v.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

class DebugBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <pre style={{ padding: 24, whiteSpace: 'pre-wrap', color: 'red' }}>
          {String(this.state.error.stack || this.state.error.message)}
        </pre>
      );
    }
    return this.props.children;
  }
}

createRoot(mount).render(
  <React.StrictMode>
    <DebugBoundary>
      {/* Suspense: ekrany są leniwe, więc render czeka na pobranie modułu. */}
      <React.Suspense
        fallback={<div style={{ padding: 24, color: '#64748b' }}>Ładowanie ekranu…</div>}
      >
        {entry ? entry.render() : <Fallback />}
      </React.Suspense>
      {/* Panel uwag właściciela — obecny na KAŻDYM ekranie odbioru (zapis: /__uwagi). */}
      <PanelUwag ekran={screenKey} />
      {/* Toasty (react-hot-toast). Do 2026-07-23 harness NIE montował <Toaster/>,
          więc każdy `toast.error(...)` z ekranu był NIEWIDOCZNY — a to właśnie
          toastem produkt mówi „AI niedostępne, oto powód". Bez tego nie dało się
          zweryfikować oczami ścieżki awaryjnej. */}
      <Toaster position="bottom-center" />
    </DebugBoundary>
  </React.StrictMode>
);
