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
const PrototypeHarness = ({ context, legacy }: { context: 'idea' | 'notebook'; legacy: React.ReactNode }) => {
  // Day342: never replace a complete acceptance screen with the isolated
  // prototype. Production hosts below consume the flag themselves; screens
  // without a production mount must remain unchanged and expose that gap.
  void context;
  return <>{legacy}</>;
};
const Day237SpotkaniaScreen = React.lazy(() => import('./screens/day237-spotkania'));
const Day235MaterialyDokumentyScreen = React.lazy(
  () => import('./screens/day235-materialy-dokumenty')
);
const Day235MaterialyPrezentacjeScreen = React.lazy(
  () => import('./screens/day235-materialy-prezentacje')
);
const Day235MaterialyExceleScreen = React.lazy(
  () => import('./screens/day235-materialy-excele')
);
const Day238UstawieniaScreen = React.lazy(() => import('./screens/day238-ustawienia'));
const Day235MaterialyArchitektSzablonowScreen = React.lazy(
  () => import('./screens/day235-materialy-architekt-szablonow')
);
const IdeaFinancialCasePersistenceScreen = React.lazy(
  () => import('./screens/idea-financial-case-persistence')
);
const PodgladPomysluSufitStopkiScreen = React.lazy(
  () => import('./screens/podglad-pomyslu-sufit-stopki')
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
// GRAFIKA (2026-09-01, zadanie 3 — audyt rodziny): plik ekranu istniał i miał
// ocenę w docs/program/grafika/status.json (materials-registry, ocena B, z
// realną listą "naprawione"), ale main.tsx nigdy go nie importował ani nie
// rejestrował — `git log -S"materials-registry" -- dev-render/main.tsx` nie
// zwraca ŻADNEGO commitu. Dopisuję tylko rejestrację, plik gotowy bez zmian.
const MaterialsRegistryScreen = React.lazy(() => import('./screens/materials-registry'));
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
const AngielskieResztkiI18nScreen = React.lazy(() => import('./screens/angielskie-resztki-i18n'));
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
const AssessmentPresentationViewScreen = React.lazy(
  () => import('./screens/assessment-presentation-view')
);
// GRAFIKA (2026-08-30, ANALIZA_PRAWY_PANEL.md) — prototyp „prawy pas jako
// jedna formuła" (szyna ikon 56px: Artefakt · Teresa · narzędzie zależne od
// typu). Jeden plik/komponent, zarejestrowany 5×: interaktywny (przełącznik
// klikany przez Piotra) + 4 warianty ze stałym stanem startowym potrzebne dla
// deterministycznych zrzutów skryptowych (grafika-zrzuty.mjs nie klika UI).
const PrawyPasJednaFormulaScreen = React.lazy(
  () => import('./screens/prawy-pas-jedna-formula')
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
const AdminAIControlCenterPanelScreen = React.lazy(
  () => import('./screens/admin-ai-control-center-panel')
);
const AdminSsoSelfServiceCardScreen = React.lazy(
  () => import('./screens/admin-sso-self-service-card')
);
// admin-security (runda pełna) — 10 ekranów domeny security z adminNavigation.ts,
// jeden plik z przełącznikiem `adminScreen`, patrz dev-render/screens/admin-security.tsx
// (wzorzec 1:1 z admin-billing.tsx poniżej).
const AdminSecurityScreen = React.lazy(() => import('./screens/admin-security'));
// admin-billing (runda pełna) — 9 ekranów domeny billing z adminNavigation.ts,
// jeden plik z przełącznikiem `adminScreen`, patrz dev-render/screens/admin-billing.tsx.
const AdminBillingScreen = React.lazy(() => import('./screens/admin-billing'));
// admin-team (runda pełna) — 8 ekranów domeny team z adminNavigation.ts,
// jeden plik z przełącznikiem `adminScreen`, patrz dev-render/screens/admin-team.tsx
// (wzorzec 1:1 z admin-billing.tsx powyżej).
const AdminTeamScreen = React.lazy(() => import('./screens/admin-team'));
// Moduł 16 „Partner" — pierwszy komplet zrzutów dla przeglądu właściciela
// (dotąd ZERO ekranów w rejestrze grafiki). Patrz dev-render/screens/partner-portal.tsx.
const PartnerPortalScreen = React.lazy(() => import('./screens/partner-portal'));
// admin-ai (runda pełna) — 10 ekranów domeny ai z adminNavigation.ts, jeden
// plik z przełącznikiem `adminScreen`, patrz dev-render/screens/admin-ai.tsx
// (wzorzec 1:1 z admin-billing.tsx powyżej).
const AdminAiScreen = React.lazy(() => import('./screens/admin-ai'));
// ustawienia-organizacja (runda pełna) — 150-ustawienia-organizacja
// (2026-08-31): 10 grup Ustawień (SettingsSidebar.tsx navGroups, ZWERYFIKOWANE
// w kodzie — nie 9 jak sugerowała dokumentacja) + 20 brakujących ekranów
// modułu Organizacja wariantu DOMYŚLNEGO (OrganizationSidebar.tsx,
// ORGANIZATION_MODULES — flaga orgRedesignV1 OFF od 2026-08-29). Patrz
// nagłówki dev-render/screens/ustawienia-grupy.tsx i org-legacy.tsx.
const UstawieniaGrupyScreen = React.lazy(() => import('./screens/ustawienia-grupy'));
const Day377GovernedConnectScreen = React.lazy(
  () => import('./screens/day377-governed-connect')
);
const OrgLegacyScreen = React.lazy(() => import('./screens/org-legacy'));
// admin-audit-health (runda pełna) — 7+7 ekranów domen audit i health
// z adminNavigation.ts, dwa pliki z przełącznikiem `adminScreen`, patrz
// dev-render/screens/admin-audit.tsx i admin-health.tsx (wzorzec 1:1
// z admin-billing.tsx powyżej).
const AdminAuditScreen = React.lazy(() => import('./screens/admin-audit'));
const AdminHealthScreen = React.lazy(() => import('./screens/admin-health'));
// admin-command (runda pełna) — 11 ekranów domeny command z adminNavigation.ts
// ("Centrum administracyjne"), jeden plik z przełącznikiem `adminScreen`,
// patrz dev-render/screens/admin-command.tsx (wzorzec 1:1 z admin-billing.tsx
// powyżej). Nie duplikuje istniejącego wpisu `admin-command-center-panel`
// (ten zostaje — fotografuje te same 6 zakładek przez stary `&tab=`); ta
// runda dodaje osobny wiersz na KAŻDY z 11 nav-slotów, w tym te, których
// stary story nie fotografował (attention-queue, cost-capacity,
// organization-defaults, agent-trace, benchmark).
const AdminCommandScreen = React.lazy(() => import('./screens/admin-command'));
const SuperadminPlatformOperationsDay15Screen = React.lazy(
  () => import('./screens/superadmin-platform-operations-day15')
);
const AgentPlanCanvasScreen = React.lazy(() => import('./screens/agent-plan-canvas'));
const Day207WriteProposalScreen = React.lazy(() => import('./screens/day207-write-proposal'));
const Day221AudytyWarsztatScreen = React.lazy(() => import('./screens/day221-audyty-warsztat'));
const Day220AudytyRejestrScreen = React.lazy(() => import('./screens/day220-audyty-rejestr'));
const AgentPlanViewScreen = React.lazy(() => import('./screens/agent-plan-view'));
const AgentHubScreen = React.lazy(() => import('./screens/agent-hub'));
const TabeleFala2PrzedPoScreen = React.lazy(() => import('./screens/tabele-fala2-przed-po'));
const MenuDlugiDomkniecieScreen = React.lazy(() => import('./screens/menu-dlugi-domkniecie'));
const AgentWarsztatScreen = React.lazy(() => import('./screens/agent-warsztat'));
// GRAFIKA (2026-08-30, tor 13-agent-planowanie): drd-library-entry i
// initiative-record istniały w dev-render/screens/ ale nigdy nie trafiły do
// SCREENS — ten sam brak wpisu jak przy report-artifact/insight-artifact
// (patrz komentarz niżej przy ReportArtifactScreen). Bez wpisu harness
// pokazywał tylko awaryjną listę ekranów, więc nie dało się w ogóle zmierzyć.
const DrdLibraryEntryScreen = React.lazy(() => import('./screens/drd-library-entry'));
const InitiativeRecordScreen = React.lazy(() => import('./screens/initiative-record'));
const VaultSejfWnetrzeScreen = React.lazy(() => import('./screens/vault-sejf-wnetrze'));
const VaultFolderBlockProofScreen = React.lazy(() => import('./screens/vault-folder-block-proof'));
const MyWorkIdeaInspectorLekkiScreen = React.lazy(
  () => import('./screens/mywork-idea-inspector-lekki')
);
const MyWorkNotebookRailSpecAScreen = React.lazy(
  () => import('./screens/mywork-notebook-rail-speca')
);
// GRAFIKA (2026-08-30, ANALIZA_PRAWY_PANEL.md) — NOTATNIK na wspólnym prawym
// pasie `ArtifactRightRail` (szyna 56px: Artefakt · Teresa · Struktura), za
// flagą `?ff_artifact_right_rail=1`. Jeden plik ekranu, zarejestrowany 3× ze
// stałym trybem startowym — `grafika-zrzuty.mjs` nie klika UI, a wszystkie
// trzy tryby pod jednym `?screen=` nadpisywałyby sobie plik wyjściowy.
const PrawyPasNotatnikSystemScreen = React.lazy(
  () => import('./screens/prawy-pas-notatnik-system')
);
// Drugi krok rozwożenia (2026-08-30, ANALIZA_PRAWY_PANEL.md §7 krok 4): Idee
// na tym samym wzorcu — jeden plik ekranu, zarejestrowany 3× ze stałym
// trybem startowym (Artefakt/Teresa/Sugestie).
const PrawyPasIdeaSystemScreen = React.lazy(() => import('./screens/prawy-pas-idea-system'));
// Trzeci krok (2026-08-30): Tabele, powierzchnia trudna — patrz komentarz
// przy rejestracji SCREENS niżej.
const PrawyPasTabeleSystemScreen = React.lazy(() => import('./screens/prawy-pas-tabele-system'));
// Tor grafiki (2026-08-30/31, ANALIZA_PRAWY_PANEL.md §6 uzupełnienie
// „dokumenty"): dwie kolejne powierzchnie TRUDNE — Prezentacje (generator,
// dziś jeden płaski identyfikator `activity`) i Deck Builder (dziś sześć
// płaskich identyfikatorów, bez rozróżnienia „o artefakcie"/„po artefakcie").
// Montują REALNY `PrezentacjeMelsView`/`DeckBuilderMelsView` (adaptery
// prezentacyjne, nie kopie) z minimalnymi, ale prawdziwymi propsami.
const PrawyPasPrezentacjeSystemScreen = React.lazy(
  () => import('./screens/prawy-pas-prezentacje-system')
);
const PrawyPasDeckBuilderSystemScreen = React.lazy(
  () => import('./screens/prawy-pas-deck-builder-system')
);
// Odbiór grafiki (2026-08-30): pliki ekranów już istniały (napisane, gotowe,
// bez zależności Api/fetch) ale nigdy nie zostały wpięte do rejestru SCREENS —
// `?screen=calendar-sync-settings` / `?screen=notebook-quick-capture` renderowały
// awaryjną listę harnessu zamiast realnego ekranu. Dopisuję tylko rejestrację.
const CalendarSyncSettingsScreen = React.lazy(() => import('./screens/calendar-sync-settings'));
const NotebookQuickCaptureScreen = React.lazy(() => import('./screens/notebook-quick-capture'));
// ZLECENIE 1.1-J (06.09) — lewa lista "Moje notatki" w jednej linii (kebab pionowy).
const NotatnikListaScreen = React.lazy(() => import('./screens/notatnik-lista-11j'));
const MojaPracaNotatnikToggleEmptyScreen = React.lazy(
  () => import('./screens/mojapraca-notatnik-toggle-empty')
);
// ZLECENIE 1.1-J2 (06.09) — nagłówek listy notatek: filtr rozwijany z licznikami
// (DEC-405b) + naprawa pustego dymka nad wstecz/+/lupa (DEC-405c).
const NotatnikHeaderFiltrScreen = React.lazy(
  () => import('./screens/notatnik-header-filtr-11j2')
);
// ZLECENIE 1.1-J2 (06.09, DEC-408) — Menu 2 „Sejf klienta” → „Sejfy”, okruszek
// „Moja Praca › Sejfy”. REALNY <MyWorkHub> na zakładce vault.
const MyWorkVaultSejfyScreen = React.lazy(() => import('./screens/mywork-vault-sejfy-11j2'));
const AssessmentInitiativesPanelScreen = React.lazy(
  () => import('./screens/assessment-initiatives-panel')
);
const AssessmentInitiativesTableScreen = React.lazy(
  () => import('./screens/assessment-initiatives-table')
);
const AssessmentFiveSurfacesScreen = React.lazy(() => import('./screens/assessment-five-surfaces'));
const AssessmentManagePanelScreen = React.lazy(() => import('./screens/assessment-manage-panel'));
const AssessmentListScreen = React.lazy(() => import('./screens/assessment-list'));
const AssessmentMatrycaScreen = React.lazy(() => import('./screens/assessment-matryca'));
const StandardModuleBarChildrenScreen = React.lazy(
  () => import('./screens/standard-module-bar-children')
);
const AssessmentMenu3StatusChipsScreen = React.lazy(
  () => import('./screens/assessment-menu3-status-chips')
);
const AssessmentReportsPanelScreen = React.lazy(() => import('./screens/assessment-reports-panel'));
const AssessmentReportsTableScreen = React.lazy(() => import('./screens/assessment-reports-table'));
const AssessmentOutputReportScreen = React.lazy(() => import('./screens/assessment-output-report'));
const AssessmentReportContractScreen = React.lazy(
  () => import('./screens/assessment-report-contract')
);
const CanvasKebabRestructureScreen = React.lazy(() => import('./screens/canvas-kebab-restructure'));
const CanvasNewDocScreen = React.lazy(() => import('./screens/canvas-new-doc'));
const CanvasToolbarMdHistoryScreen = React.lazy(
  () => import('./screens/canvas-toolbar-md-history')
);
const CapabilityGateDemoScreen = React.lazy(() => import('./screens/capability-gate-demo'));
const ChatBladAiScreen = React.lazy(() => import('./screens/chat-blad-ai'));
const ChatSplitTeresaRightScreen = React.lazy(() => import('./screens/chat-split-teresa-right'));
const ChatToolStepsDay206Screen = React.lazy(() => import('./screens/chat-tool-steps-day206'));
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
// OSIEROCONY (odbior grafiki 2026-08-30): komponent ExecutionChangeSignalsPanel
// zostal usuniety z produktu jako fantom (DEC-120/A7). Ekran nie moze sie
// wyrenderowac, a jego zepsuty import zatruwal wspolny serwer dev-render —
// blad z tego pliku wyciekal na zrzuty INNYCH ekranow. Wyrejestrowany, plik
// zostaje. Powrot = odkomentowac po przywroceniu komponentu.
// Dopisane 2026-08-30 (odbiór grafiki): osiem ekranów istniało jako pliki
// z domyślnym eksportem i NIGDY nie było zarejestrowanych — harness na każdy
// z nich odpowiadał listą awaryjną „Unknown ?screen=…". Nikt ich nie widział.
const ToolsSwotLiveScreen = React.lazy(() => import('./screens/tools-swot-live'));
const ToolsSwotLibraryDetailScreen = React.lazy(() => import('./screens/tools-swot-library-detail'));
const ToolsSwotSessionWorkspaceScreen = React.lazy(() => import('./screens/tools-swot-session-workspace'));
const ToolsSesjaWyjscieScreen = React.lazy(() => import('./screens/tools-sesja-wyjscie'));
const ToolOutputsPanelScreen = React.lazy(() => import('./screens/tool-outputs-panel'));
const ToolsOutputsInsightsTabScreen = React.lazy(() => import('./screens/tools-outputs-insights-tab'));
const ChatSignalsFeedScreen = React.lazy(() => import('./screens/chat-signals-feed'));
const ExecSummaryOnelookScreen = React.lazy(() => import('./screens/exec-summary-onelook'));
// const ExecutionChangeSignalsScreen = React.lazy(() => import('./screens/execution-change-signals'));
const ExecutionReportDay11Screen = React.lazy(() => import('./screens/execution-report-day11'));
// 145-execution-taby — REALNY <ExecutionHub initialTab=...>, 7 brakujących
// zakładek (rejestr grafiki pokrywał dotąd tylko "reports"). Jeden plik
// ekranu (dev-render/screens/execution-tab.tsx), tab podany wprost w propie
// per rejestr — patrz komentarz w pliku ekranu za "DLACZEGO".
const ExecutionTabScreen = React.lazy(() => import('./screens/execution-tab'));
// const ExecutionExportPrezentacjaScreen = React.lazy(
//   () => import('./screens/execution-export-prezentacja')
// );
const FinanceValuePanelsScreen = React.lazy(() => import('./screens/finance-value-panels'));
const Day200FinancePanelsScreen = React.lazy(() => import('./screens/day200-finance-panels'));
const Day233FinanseRejestryScreen = React.lazy(
  () => import('./screens/day233-finanse-rejestry')
);
const Day233FinansePaneleScreen = React.lazy(() => import('./screens/day233-finanse-panele'));
const FinanceHubScreen = React.lazy(() => import('./screens/finance-hub'));
const FinanceModelWorkspaceScreen = React.lazy(() => import('./screens/finance-model-workspace'));
const FinanceWorkspaceBarScreen = React.lazy(() => import('./screens/finance-workspace-bar'));
const FinanceFocusModeScreen = React.lazy(() => import('./screens/finance-focus-mode'));
const FinanceStatementPackWorkspaceV2Screen = React.lazy(
  () => import('./screens/finance-statement-pack-workspace-v2')
);
const FinanceBaselineWorkspaceScreen = React.lazy(
  () => import('./screens/finance-baseline-workspace')
);
const FinancePredictionWorkspaceScreen = React.lazy(
  () => import('./screens/finance-prediction-workspace')
);
const FinanceIdBridgeScreen = React.lazy(() => import('./screens/finance-id-bridge'));
const FinanceAnalysisWorkspaceScreen = React.lazy(
  () => import('./screens/finance-analysis-workspace')
);
const FinanceValuationWorkspaceScreen = React.lazy(
  () => import('./screens/finance-valuation-workspace')
);
const FinanceLineageNavigatorScreen = React.lazy(
  () => import('./screens/finance-lineage-navigator')
);
const FinanceComparePanelScreen = React.lazy(() => import('./screens/finance-compare-panel'));
const FinanceCommentsPanelScreen = React.lazy(() => import('./screens/finance-comments-panel'));
const FinanceSavedViewsPanelScreen = React.lazy(
  () => import('./screens/finance-saved-views-panel')
);
const FinanceExportImportPanelScreen = React.lazy(
  () => import('./screens/finance-export-import-panel')
);
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
const MeetingsModuleScreen = React.lazy(() => import('./screens/meetings-module'));
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
const RoseDangerTokenParityScreen = React.lazy(() => import('./screens/rose-danger-token-parity'));
const SettingsCrimsonNeutralizedScreen = React.lazy(
  () => import('./screens/settings-crimson-neutralized')
);
const StandardGridCardScreen = React.lazy(() => import('./screens/standard-grid-card'));
const StandardKanbanCardScreen = React.lazy(() => import('./screens/standard-kanban-card'));
const TemplateBuilderDeckScreen = React.lazy(() => import('./screens/template-builder-deck'));
const TemplateBuilderDocScreen = React.lazy(() => import('./screens/template-builder-doc'));
const TemplateBuilderTableScreen = React.lazy(() => import('./screens/template-builder-table'));
const TemplateCreateWizardScreen = React.lazy(() => import('./screens/template-create-wizard'));
const TemplateLibraryNewEntryScreen = React.lazy(
  () => import('./screens/template-library-new-entry')
);
const Wave3CreatorsCrimsonScreen = React.lazy(() => import('./screens/wave3-creators-crimson'));
const Wave4ChoicesCrimsonScreen = React.lazy(() => import('./screens/wave4-choices-crimson'));
const Wave5InternalCrimsonScreen = React.lazy(() => import('./screens/wave5-internal-crimson'));
const ZwornikProjectsScreen = React.lazy(() => import('./screens/zwornik-projects'));
const KartaToolScreen = React.lazy(() => import('./screens/karta-tool'));
const KartaInitiativeScreen = React.lazy(() => import('./screens/karta-initiative'));
const KartaInsightScreen = React.lazy(() => import('./screens/karta-insight'));
const KartaInterviewScreen = React.lazy(() => import('./screens/karta-interview'));
const InterviewProgressbar153Screen = React.lazy(
  () => import('./screens/interview-progressbar-153')
);
const InterviewPreviewCanonScreen = React.lazy(() => import('./screens/interview-preview-canon'));
const InterviewCreatorShellScreen = React.lazy(() => import('./screens/interview-creator-shell'));
const InterviewSessionsStatusScreen = React.lazy(
  () => import('./screens/interview-sessions-status')
);
const KartaDecisionScreen = React.lazy(() => import('./screens/karta-decision'));
const KartaNotificationScreen = React.lazy(() => import('./screens/karta-notification'));
const KartaTaskScreen = React.lazy(() => import('./screens/karta-task'));
const KartaDzialaniaScreen = React.lazy(() => import('./screens/karta-dzialania'));
const KartaTaskPelnaScreen = React.lazy(() => import('./screens/karta-task-pelna'));
// [ODMROZENIE 00_SHARED DEC-422] Trzy karty N modułu Wyniki weszły do rejestru
// (`src/components/standard/registry.ts`), a bramka `scripts/karty-n-smoke.mjs`
// wymaga dla każdego wpisu żywego ekranu harnessu.
const KartaMiernikScreen = React.lazy(() => import('./screens/karta-miernik'));
const KartaCelOkrScreen = React.lazy(() => import('./screens/karta-cel-okr'));
const KartaAnalizaRoiScreen = React.lazy(() => import('./screens/karta-analiza-roi'));
const MyWorkInboxScreen = React.lazy(() => import('./screens/mywork-inbox'));
const MyWorkCalendarScreen = React.lazy(() => import('./screens/mywork-calendar'));
const MyWorkCalendarDisconnectedScreen = React.lazy(
  () => import('./screens/mywork-calendar-disconnected')
);
// M03 (dyżur 2026-09-03, "ekrany bez wpisu w harnessie"): DecisionsPanelContent
// — następca 12 wycofanych kolejek decyzyjnych, osiągalny (MyWorkHub.tsx:135
// import, :4202 mount), NIGDY dotąd niezmierzony ani niepokazany właścicielowi.
// Patrz dev-render/screens/mywork-decisions.tsx.
const MyWorkDecisionsScreen = React.lazy(() => import('./screens/mywork-decisions'));
// M03 (dyżur 2026-09-03, "ekrany bez wpisu w harnessie"): MyTasksListContent
// — widok LISTY zadań, osiągalny (MyWorkHub.tsx:159 import, :4093 mount).
// karta-task.tsx/karta-task-pelna.tsx montują tylko pojedynczą kartę zadania
// (Api.getPersonalTasks tam zwraca celowo []) — to osobny, dotąd nieujęty
// ekran. Patrz dev-render/screens/mywork-tasks.tsx.
const MyWorkTasksScreen = React.lazy(() => import('./screens/mywork-tasks'));
// M03 (dyżur 2026-09-03, "ekrany bez wpisu w harnessie"): ReportsHub —
// moduł raportów zarządczych PMO, trasa /reports/management, osiągalny
// (AppRoutes.tsx lazy import + mount), zero wpisu w harnessie. Patrz
// dev-render/screens/reports-hub-management.tsx.
const ReportsHubManagementScreen = React.lazy(() => import('./screens/reports-hub-management'));
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
// GRAFIKA (2026-09-02, grafika/logowanie-i18n-20260902): pre-login screen
// family had NO harness entry at all — the login-screen i18n bug was found
// on a live staging screenshot, not through this harness. Registering the
// family here per CLAUDE.md #7 (owner never sees a raw/unvetted screen).
const AuthLoginScreen = React.lazy(() => import('./screens/auth-login'));
const AuthRegisterScreen = React.lazy(() => import('./screens/auth-register'));
const AuthCodeEntryScreen = React.lazy(() => import('./screens/auth-code-entry'));
const AuthForgotPasswordScreen = React.lazy(() => import('./screens/auth-forgot-password'));
const AuthResetPasswordScreen = React.lazy(() => import('./screens/auth-reset-password'));
const AuthVerifyEmailScreen = React.lazy(() => import('./screens/auth-verify-email'));
const MindmapCanvasScreen = React.lazy(() => import('./screens/mindmap-canvas'));
const MyWorkIdeaTopBarScreen = React.lazy(() => import('./screens/mywork-idea-topbar'));
const TeresaConfirmChipScreen = React.lazy(() => import('./screens/teresa-confirm-chip'));
const ChatCrimsonSearchResearchScreen = React.lazy(
  () => import('./screens/chat-crimson-search-research')
);
const ChatCrimsonPrivateMessageScreen = React.lazy(
  () => import('./screens/chat-crimson-private-message')
);
const ChatCrimsonProjectMembersScreen = React.lazy(
  () => import('./screens/chat-crimson-project-members')
);
const ChatV8ArtifactRunSearchScreen = React.lazy(
  () => import('./screens/chat-v8-artifact-run-search')
);
const ChatMessageRequiredSurfacesScreen = React.lazy(
  () => import('./screens/chat-message-required-surfaces')
);
const Mvp11ePonowOdpowiedzScreen = React.lazy(
  () => import('./screens/mvp-11e-ponow-odpowiedz')
);
const TeresaChipySugestiiScreen = React.lazy(() => import('./screens/teresa-chipy-sugestii'));
const TeresaChipyPanelArtefaktuScreen = React.lazy(
  () => import('./screens/teresa-chipy-panel-artefaktu')
);
const DeckArtifactScreen = React.lazy(() => import('./screens/deck-artifact'));
const DocumentArtifactScreen = React.lazy(() => import('./screens/document-artifact'));
// GRAFIKA (2026-08-30): report-artifact/insight-artifact istniały w
// dev-render/screens/ od vf0 (1c97db682d) ale nigdy nie trafiły do SCREENS —
// jedyne dwa z tamtej paczki, które ktoś pominął (deck/document/sheet-artifact
// obok nich są zarejestrowane). Bez wpisu ekran nie istnieje dla harnessu
// (fallback = lista awaryjna), więc nie dało się go w ogóle zmierzyć.
const ReportArtifactScreen = React.lazy(() => import('./screens/report-artifact'));
const InsightArtifactScreen = React.lazy(() => import('./screens/insight-artifact'));
const DrdEmbeddedMatrixAxisLevelsScreen = React.lazy(
  () => import('./screens/drd-embedded-matrix-axis-levels')
);
const DrdMacierzOcenyScreen = React.lazy(() => import('./screens/drd-macierz-oceny'));
const IdeasPreviewOverlayScreen = React.lazy(() => import('./screens/ideas-preview-overlay'));
const SheetArtifactScreen = React.lazy(() => import('./screens/sheet-artifact'));
const ExceleEdytowalnaSiatkaScreen = React.lazy(() => import('./screens/excele-edytowalna-siatka'));
const ExcelePrawyPanelStandardScreen = React.lazy(
  () => import('./screens/excele-prawy-panel-standard')
);
const NTypeAnalizujAiScreen = React.lazy(() => import('./screens/ntype-analizuj-ai'));
const Day214TeresaAdoptCardScreen = React.lazy(() => import('./screens/day214-teresa-adopt-card'));
const Day228ImageStyleFieldScreen = React.lazy(
  () => import('./screens/day228-image-style-field')
);
const Day231KonspektZWiedzyScreen = React.lazy(
  () => import('./screens/day231-konspekt-z-wiedzy')
);
const Day230PrzepelnienieScreen = React.lazy(() => import('./screens/day230-przepelnienie'));
const Day232AgentDeckuScreen = React.lazy(() => import('./screens/day232-agent-decku'));
const Day234WynikiRejestryScreen = React.lazy(
  () => import('./screens/day234-wyniki-rejestry')
);
const Day234WynikiNarzedziaScreen = React.lazy(
  () => import('./screens/day234-wyniki-narzedzia')
);
// aios (runda pełna) — 146-aios, Internal Tools / AI OS submenu (8 ekranów), 2026-08-31.
const AiosScreen = React.lazy(() => import('./screens/aios'));
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
// const InitiativesPortfolioAnalysisScreen = React.lazy(
//   () => import('./screens/initiatives-portfolio-analysis')
// );
// ── Screen registry (extensible) ──────────────────────────────────────────
const FabRailKebabScreen = React.lazy(() => import('./screens/fab-rail-kebab'));
const PrawyPanelSzynaIkonScreen = React.lazy(() => import('./screens/prawy-panel-szyna-ikon'));
const Exe002004UiAuditScreen = React.lazy(() => import('./screens/exe-002-004-ui-audit'));
const AudytyPiecPowierzchniScreen = React.lazy(() => import('./screens/audyty-piec-powierzchni'));
const OrgIdentityOperatingScreen = React.lazy(() => import('./screens/org-identity-operating'));
const Day236OrganizacjaScreen = React.lazy(() => import('./screens/day236-organizacja'));
const StagingFixesInitiativesI18nScreen = React.lazy(
  () => import('./screens/staging-fixes-initiatives-i18n')
);
// Pomiar mechaniki KPI/OKR/ROI (2026-08-30) — kanoniczne wejście "lista
// inicjatyw" pod odkrywalną nazwą. Sam REALNY <InitiativesHub> już istniał w
// harnessie (patrz StagingFixesInitiativesI18nScreen wyżej) — ten wpis go
// tylko wystawia pod nazwą, którą właściciel faktycznie odnajdzie.
const InicjatywyListaScreen = React.lazy(() => import('./screens/inicjatywy-lista'));
const CapacityAdvisorA3Screen = React.lazy(() => import('./screens/capacity-advisor-a3'));
const PlanScenarioD1Screen = React.lazy(() => import('./screens/plan-scenario-d1'));
const StagingFixesExecutionI18nScreen = React.lazy(
  () => import('./screens/staging-fixes-execution-i18n')
);
const AudytyWarsztatKryteriumScreen = React.lazy(
  () => import('./screens/audyty-warsztat-kryterium')
);
const AudytyRaportDokumentScreen = React.lazy(() => import('./screens/audyty-raport-dokument'));
const Mw007CalendarNarrowViewportScreen = React.lazy(
  () => import('./screens/mw-007-calendar-narrow-viewport')
);
const MethodWorkspaceScreen = React.lazy(() => import('./screens/method-workspace'));
const DrdHttpWorkspaceScreen = React.lazy(() => import('./screens/drd-http-workspace'));
const SiriWorkspaceScreen = React.lazy(() => import('./screens/siri-workspace'));
const SiriTierScreen = React.lazy(() => import('./screens/siri-tier'));
const AssessmentArtifactsRestartScreen = React.lazy(
  () => import('./screens/assessment-artifacts-restart')
);
const ResultsVNextRegistryShellScreen = React.lazy(
  () => import('./screens/results-vnext-registry-shell')
);
const ResultsVNextKpiRegistryScreen = React.lazy(
  () => import('./screens/results-vnext-kpi-registry')
);
const ResultsZestawieniaScreen = React.lazy(() => import('./screens/results-zestawienia'));
const ResultsVNextRoiRegistryScreen = React.lazy(
  () => import('./screens/results-vnext-roi-registry')
);
const RoiVisibilityActivationScreen = React.lazy(
  () => import('./screens/roi-visibility-activation')
);
const DrdZamrozenieWlascicielScreen = React.lazy(
  () => import('./screens/drd-zamrozenie-wlasciciel')
);
const ResultsVNextRoiModelScreen = React.lazy(() => import('./screens/results-vnext-roi-model'));
const ResultsVNextRoiFullToolScreen = React.lazy(
  () => import('./screens/results-vnext-roi-full-tool')
);
const RoiJednaKartaScreen = React.lazy(() => import('./screens/roi-jedna-karta'));
const WskaznikJednaKartaScreen = React.lazy(() => import('./screens/wskaznik-jedna-karta'));
const CelJednaKartaScreen = React.lazy(() => import('./screens/cel-jedna-karta'));
const ResultsVNextOkrRegistryScreen = React.lazy(
  () => import('./screens/results-vnext-okr-registry')
);
const ResultsVNextSearchRegistryScreen = React.lazy(
  () => import('./screens/results-vnext-search-registry')
);
const ResultsVNextOkrObjectivesScreen = React.lazy(
  () => import('./screens/results-vnext-okr-objectives')
);
const ResultsVNextOkrWorkspaceScreen = React.lazy(
  () => import('./screens/results-vnext-okr-workspace')
);
const ResultsVNextOkrAdminScreen = React.lazy(() => import('./screens/results-vnext-okr-admin'));
const ResultsVNextKpiScorecardsScreen = React.lazy(
  () => import('./screens/results-vnext-kpi-scorecards')
);
const ResultsVNextKpiToolScreen = React.lazy(() => import('./screens/results-vnext-kpi-tool'));
const P7kWynikiPrototypeScreen = React.lazy(() => import('./screens/p7k-wyniki-prototype'));
// ROI (P7K C) — REALNE ekrany ROI (L1 rejestr + L2 karta N w trzech częściach)
// z podstawionym transportem; prototyp wyżej zostaje jako obraz odniesienia.
const P7kCRoiScreen = React.lazy(() => import('./screens/p7k-c-roi'));
const P7kWynikiKpiScreen = React.lazy(() => import('./screens/p7k-wyniki-kpi'));
const ResultsVNextLegacyArchiveScreen = React.lazy(
  () => import('./screens/results-vnext-legacy-archive')
);
const ResultsVNextRoiPirOutcomesScreen = React.lazy(
  () => import('./screens/results-vnext-roi-pir-outcomes')
);
const RnG3ClassLRecordShellScreen = React.lazy(
  () => import('./screens/rn-g3-class-l-record-shell')
);
const ResultsVNextTeresaKpiDeviationScreen = React.lazy(
  () => import('./screens/results-vnext-teresa-kpi-deviation')
);
const ResultsVNextTeresaOkrReflectionScreen = React.lazy(
  () => import('./screens/results-vnext-teresa-okr-reflection')
);

const ToolsSwotReportScreen = React.lazy(() => import('./screens/tools-swot-report'));
const ToolsSwotInitiativeProposalScreen = React.lazy(
  () => import('./screens/tools-swot-initiative-proposal')
);
const Day267MaterialyHubZrzutyScreen = React.lazy(
  () => import('./screens/day267-materialy-hub-zrzuty')
);

const SCREENS: Record<string, { label: string; render: () => React.ReactElement }> = {
  'day237-spotkania': {
    label:
      'Dyżur 237 — realne MeetingHub / MeetingObjectPage / Sidebar; &view=list|object|member-sidebar|member-direct &state=pending|rejected|approved',
    render: () => <Day237SpotkaniaScreen />,
  },
  'day238-ustawienia': {
    label:
      'Dyżur 238 — REALNY SettingsSidebar + reprezentatywny panel każdej z 10 zmierzonych grup. &section=profile|regional|ai-behavior|notifications-overview|security-dashboard|connected-apps|data-controls|billing|theme|developer &role=OWNER|MEMBER &proof=restricted|allowed|owner',
    render: () => <Day238UstawieniaScreen />,
  },
  'day235-materialy-dokumenty': {
    label: 'Dyżur 235 — realny Document Studio; &view=registry pokazuje wspólny rejestr Materiałów',
    render: () => <Day235MaterialyDokumentyScreen />,
  },
  'day235-materialy-prezentacje': {
    label: 'Dyżur 235 — realny Deck Template Builder, cztery slajdy',
    render: () => <Day235MaterialyPrezentacjeScreen />,
  },
  'day235-materialy-excele': {
    label: 'Dyżur 235 — realny ExceleView z arkuszem formułowym NPV/IRR',
    render: () => <Day235MaterialyExceleScreen />,
  },
  'day235-materialy-architekt-szablonow': {
    label: 'Dyżur 235 — realny architekt szablonów Word: draft, approved, deprecated',
    render: () => <Day235MaterialyArchitektSzablonowScreen />,
  },
  'angielskie-resztki-i18n': {
    label:
      'I18N — REALNY <MonteCarloNpvPanel> (Driver -> Czynnik, ziarna Revenue/Cost -> Przychody/Koszty) + REALNY <EditableSpreadsheetGrid> z 250 wierszami (stopka rowCap: brakujące kimi.showingAllRows/showAllRows, showingRows kłamał "25"). &theme=light|dark &rows=<n>',
    render: () => <AngielskieResztkiI18nScreen />,
  },
  'calendar-sync-settings': {
    label:
      '#24b — UI „Połącz kalendarz" (Ustawienia → Calendar Sync). Mock providerów (Google połączony, Outlook/Apple do połączenia), zero Api/fetch.',
    render: () => <CalendarSyncSettingsScreen />,
  },
  'notebook-quick-capture': {
    label:
      '#12a — REALNY <NotebookQuickCapture> (pasek szybkiego wrzucania w Notatniku). Wpisz tekst, aby zobaczyć przycisk „Wrzuć" w stanie aktywnym.',
    render: () => <NotebookQuickCaptureScreen />,
  },
  'notatnik-lista-11j': {
    label:
      'ZLECENIE 1.1-J — REALNY <NotebookPageListRow> (lewa lista „Moje notatki"), 11 wierszy jednoliniowych, kebab pionowy. Kliknij ⋮ na dowolnym wierszu, żeby zobaczyć menu (Konwertuj/Przypnij/Archiwizuj).',
    render: () => <NotatnikListaScreen />,
  },
  'mojapraca-notatnik-toggle-empty': {
    label:
      'H2 (1.1-H) — REALNY edytor Tiptap (extensions.ts + EDITOR_STYLES z NotebookContent.tsx) z pustym blokiem toggle. &case=empty-toggle|text &lang=pl|en',
    render: () => <MojaPracaNotatnikToggleEmptyScreen />,
  },
  'notatnik-header-filtr-11j2': {
    label:
      'ZLECENIE 1.1-J2 — REALNY <NotebookHeaderActions> + <NotebookViewFilterSelect> + <NotebookPageListRow>. DEC-405b: 6 chipów → 1 filtr rozwijany z licznikami obok „Szukaj w notatkach…”. DEC-405c: najedź na wstecz/+/lupa — dymek z tekstem, nie pusty (side="bottom", nieprzycięty przez overflow-hidden).',
    render: () => <NotatnikHeaderFiltrScreen />,
  },
  'mywork-vault-sejfy-11j2': {
    label:
      'ZLECENIE 1.1-J2 (DEC-408) — REALNY <MyWorkHub> zakładka „Sejfy” (było „Sejf klienta”/„Client Vault”). Sprawdź pill Menu 2 + okruszek topbaru „Moja Praca › Sejfy”.',
    render: () => <MyWorkVaultSejfyScreen />,
  },
  'meetings-module': {
    label:
      'MOD06 Meetings etap 2 — REALNY <MeetingHub> (lista) + <MeetingObjectPage> (Szczegóły/Protokół/Decyzje). &view=list|object &tab=details|minutes|decisions',
    render: () => <MeetingsModuleScreen />,
  },
  'org-identity-operating': {
    label:
      'M01 Organizacja — REALNY <OrganizationView> z flagą orgRedesignV1 ON: ekran „Tożsamość i model działania" (11 ekranów w nawigacji, Menu 2/3 ze StandardModuleBar, prawy panel stanu). Dodaj &ff_org_redesign_v1=1 w URL.',
    render: () => <OrgIdentityOperatingScreen />,
  },
  'day236-organizacja': {
    label:
      'DAY 236 Organizacja — REALNY <OrganizationView>, komplet 11 tras redesignu. &orgRoute=profile/identity-scale|profile/position-direction|goals/strategic-intent|goals/stakeholder-expectations|challenges/declared-challenges|challenges/root-causes|strategy/risks-opportunities|strategy/executive-brief|sources/claims-sources|sources/knowledge-graph|readiness/summary; &redesign=off dla legacy; &persona=member dla ograniczonej persony.',
    render: () => <Day236OrganizacjaScreen />,
  },
  'staging-fixes-initiatives-i18n': {
    label:
      'TRI-MUST-05 staging-fixes-20260826 Naprawa 1 — REALNY <InitiativesHub>: weryfikacja brakujących kluczy i18n (toast/hub/filters/materialize/kanban) i selektora poziomu inicjatywy w modalu "Nowa inicjatywa" (getInitiativeLevels(t) zamiast statycznej angielskiej stałej).',
    render: () => <StagingFixesInitiativesI18nScreen />,
  },
  'inicjatywy-lista': {
    label:
      'Pomiar KPI/OKR/ROI 2026-08-30 — LISTA INICJATYW: REALNY <InitiativesHub> (StandardModuleBar + StandardTable, kanon triady) pod odkrywalną nazwą — właściciel nigdy nie widział tego ekranu. Dane przykładowe (isDemoMode).',
    render: () => <InicjatywyListaScreen />,
  },
  'capacity-advisor-a3': {
    label:
      'Day 49 A.3 — real CapacityScenarioSurface demoMode=false, transport capacity-options intercepted; &phase=before|after &state=default|empty',
    render: () => <CapacityAdvisorA3Screen />,
  },
  'plan-scenario-d1': {
    label:
      'Day 49 D.1 — real PlanScenarioSurface demoMode=false, transport plan-scenarios intercepted, full load() path, full PL i18n; &state=default|empty',
    render: () => <PlanScenarioD1Screen />,
  },
  'staging-fixes-execution-i18n': {
    label:
      'TRI-MUST-05 staging-fixes-20260826 Naprawa 1 — REALNY <ExecutionHub>: weryfikacja brakujących kluczy i18n (failedDesc/noDataDesc) i etykiet highlights katalogu raportów (zakładka Raporty) przetłumaczonych przez t(...).',
    render: () => <StagingFixesExecutionI18nScreen />,
  },
  'audyty-piec-powierzchni': {
    label:
      'U8 — REALNY <AuditsMethodHub> (Library·Processes·Outputs·Reports·Initiatives), auditsFiveSurfacesV1. &tab=library|processes|outputs|reports|initiatives, &state=default|empty|loading|error',
    render: () => <AudytyPiecPowierzchniScreen />,
  },
  'audyty-warsztat-kryterium': {
    label:
      'W4 — REALNY <CriterionWorkspace> (łańcuch 18 ogniw: EvidencePanel·FindingPanel·RemediationPanel·TeresaProposalCard). ' +
      '&role=auditee|auditor|lead_auditor|reviewer|action_owner, ' +
      '&stage=fresh|evidence|tested|finding|remediation|closed, ' +
      '&state=loading|error|forbidden, &teresa=1',
    render: () => <AudytyWarsztatKryteriumScreen />,
  },
  'audyty-raport-dokument': {
    label:
      'U9 — NAPRAWA 2 (2026-08-26): REALNY <AuditReportDocumentView> — pełny widok treści raportu, ' +
      '`GET /audits/reports/:id/presentation`, SPEC-A Dokument (NModeShell+ArtifactRightPanel). ' +
      '&status=draft|in_review|approved|published (default: approved).',
    render: () => <AudytyRaportDokumentScreen />,
  },
  'tools-swot-report': {
    label:
      'Tools — Dynamic SWOT: Output -> Report/Presentation (deterministyczny renderer, Executive Paper/Night)',
    render: () => <ToolsSwotReportScreen />,
  },
  'tools-swot-initiative-proposal': {
    label:
      'Tools — Dynamic SWOT: SummaryStep dynamic-swot branch (Results & Readiness, night-sweep-20260826 #3)',
    render: () => <ToolsSwotInitiativeProposalScreen />,
  },
  'drd-library-entry': {
    label:
      'OCENA — zakładka „Biblioteka" (wejście do metodyki DRD): REALNY <AssessmentHub initialTab="library"> → AssessmentLibraryTab. Do 2026-09-02 była to REPLIKA triady.',
    render: () => <DrdLibraryEntryScreen />,
  },
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
  'siri-workspace': {
    label:
      'A7 — SIRI vertical slice: REALNY <MethodWorkspaceShell> (A5) wpięty w dane SIRI (siriWorkspaceView/siriAdapter). &view=interview|split|matrix &case=default|leapfrog',
    render: () => <SiriWorkspaceScreen />,
  },
  'siri-tier': {
    label:
      'A7 — SIRI TIER / Prioritisation Matrix (osobny widok po freeze, bez MethodWorkspaceShell; siriTierView → siriPrioritisation). &frozen=1|0 &flag=1|0 &horizon=strategic|tactical|operational',
    render: () => <SiriTierScreen />,
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
  'results-zestawienia': {
    label:
      'DECYZJA_WYNIKI_TRZY_POZIOMY (2026-08-30) — prototyp POZIOMU 1: rejestr ZESTAWIEŃ OKRESOWYCH (nie pojedynczych wskaźników), ten sam budulec co results-vnext-kpi-registry (ResultsVNextRegistryShell = StandardModuleBar+StandardTable+StandardPreview) z ręcznymi wierszami — zastępuje treść dzisiejszego rejestru KPI. Klik prowadzi (docelowo) na poziom 2 = results-vnext-kpi-scorecards. &state=ready|loading|empty|error &filter=all|open|closed &selected=<id|none>',
    render: () => <ResultsZestawieniaScreen />,
  },
  'drd-zamrozenie-wlasciciel': {
    label:
      'BLOKADA ODBIORU 05.09 — REALNY <DrdHttpMethodWorkspaceScreen> w stanie „do przeglądu": przycisk „Zamroź" jest odblokowany dla właściciela ORGANIZACJI, choć nikt nie ma procesowej roli approver (tej roli nie da się w aplikacji nadać). Warstwa HTTP stubowana; zachowanie serwera dowodzi ownerFreeze.http.pg.test.ts. &rola=owner|czlonek',
    render: () => <DrdZamrozenieWlascicielScreen />,
  },
  'roi-visibility-activation': {
    label:
      'BLOKADA ODBIORU 05.09 — REALNY <ResultsRoiHub> w stanie „domena ROI wygaszona dla organizacji": zamiast martwego „Brak spraw ROI" ekran mówi, czego brakuje, i daje właścicielowi/adminowi jednorazową akcję „Włącz ROI dla organizacji" (POST /vnext/results/roi/visibility-policy). Warstwa HTTP stubowana w harnessie — nowej trasy nie ma jeszcze na stagingu. &rola=owner|czlonek &stan=wylaczone|wlaczone',
    render: () => <RoiVisibilityActivationScreen />,
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
  'roi-jedna-karta': {
    label:
      'DECYZJA WŁAŚCICIELA (2026-08-30) — PROTOTYP jednej N-karty ROI (wzorzec: karta Inicjatywy), zastępuje 3 osobne ekrany (registry zostaje listą poza kartą). 5 sekcji lewego menu: Założenia/Model/Wynik/Wyniki po wdrożeniu/Wnioski i rekomendacja + prawy panel 7 sekcji kanonu. &sekcja=zalozenia|model|wynik|wyniki-po-wdrozeniu|wnioski',
    render: () => <RoiJednaKartaScreen />,
  },
  'wskaznik-jedna-karta': {
    label:
      'DECYZJA WŁAŚCICIELA (2026-08-30) — PROTOTYP jednej N-karty wskaźnika (poziom 3 z DECYZJA_WYNIKI_TRZY_POZIOMY.md), ta sama formuła co roi-jedna-karta. Ciągłość NordFood/SMED L3: KPI-0087 czyta się z ROI i cel. 5 sekcji: Kontrakt/Pomiary/Odchylenia/Działania korygujące/Rodowód + prawy panel 7 sekcji kanonu. &sekcja=kontrakt|pomiary|odchylenia|dzialania-korygujace|rodowod',
    render: () => <WskaznikJednaKartaScreen />,
  },
  'cel-jedna-karta': {
    label:
      'DECYZJA WŁAŚCICIELA (2026-08-30) — PROTOTYP jednej N-karty celu/OKR (poziom 3 z DECYZJA_WYNIKI_TRZY_POZIOMY.md), ta sama formuła co roi-jedna-karta i wskaznik-jedna-karta. Ciągłość NordFood/SMED L3: OKR-0019, KR1 czyta się automatycznie z KPI-0087. 5 sekcji: Cel/Kluczowe rezultaty/Postęp/Powiązania/Refleksja + prawy panel 7 sekcji kanonu. &sekcja=cel|kluczowe-rezultaty|postep|powiazania|refleksja',
    render: () => <CelJednaKartaScreen />,
  },
  'results-vnext-okr-registry': {
    label:
      'RN-G2 P3 #23 — REALNY route entry <ResultsOkrRegistryPage> (flaga okrRegistry: OFF -> EmptyState "results-vnext-okr-disabled", ON -> realny <ResultsOkrHub>), window.fetch stubbed for /api/vnext/results/okr*. Organization/My/Company tabs (real clicks, real fetch per tab), honest progress/confidence, lock badges, real ?setId= deep link. &state=ready|loading|empty|error &ff=off',
    render: () => <ResultsVNextOkrRegistryScreen />,
  },
  'results-vnext-search-registry': {
    label:
      'D.2 — REALNY <ResultsSearchRegistry> (the same component ResultsKpiRegistryPage mounts for ?resultsView=search), Api.get stubbed for /vnext/results/search. &state=ready|empty|error &q=<initial query>',
    render: () => <ResultsVNextSearchRegistryScreen />,
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
  'p7k-wyniki-prototype': {
    label: 'P7K — prototyp SSOT KPI/OKR/ROI. &view=kpi-l1|kpi-l2|kpi-l3|okr-l1|okr-l2|okr-l3|roi-l1|roi-l2',
    render: () => <P7kWynikiPrototypeScreen />,
  },
  'p7k-c-roi': {
    label:
      'P7K część C — REALNE ekrany ROI: &view=l1 (ResultsRoiRegistryPage, tabela analiz z kolumnami K4) | &view=l2 (RoiCaseCardPage, karta N: Założenia → Wyliczenia → Realizacja). &case=case-robotyzacja. Dane 1:1 z seeda DBR77.',
    render: () => <P7kCRoiScreen />,
  },
  'p7k-wyniki-kpi': {
    label:
      'P7K część A — REALNE ekrany produkcyjne Wyników → KPI (nie prototyp): <ResultsKpiRegistryPage> / <ResultsKpiScorecardDetailPage> / <KpiToolPage> z podstawioną WARSTWĄ SIECI, dane DBR77. &widok=l1|l2|l3 &podglad=1 &przewin=start',
    render: () => <P7kWynikiKpiScreen />,
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
  'podglad-pomyslu-sufit-stopki': {
    label:
      'PODGLĄD POMYSŁU — sufit stopki (kanon detailsMin=200): REALNY PreviewPaneShell + IdeaPreviewBody/Footer, ?sufit=0 pokazuje stan PRZED',
    render: () => <PodgladPomysluSufitStopkiScreen />,
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
      'PREZENTACJE — „Użyj wzorca" z Biblioteki (R11 deck slice): 2 stany blokujące + ładowanie. ?variant=orphaned (DOMYŚLNY)|forbidden|loading (spinner 20 s = timeout transportu, potem stan blokujący)',
    render: () => <PrezentacjeTemplateStatesScreen />,
  },
  'report-builder-library-template': {
    label:
      'REPORT BUILDER — „Użyj wzorca" z Biblioteki (report_template, R1 2026-07-26): sukces (modal, pole zablokowane) + stany blokujące. ?variant=success|orphaned|deprecated|forbidden',
    render: () => <ReportBuilderLibraryTemplateScreen />,
  },
  'materials-registry': {
    label:
      'MATERIAŁY — rejestr wspólny „Wszystkie" (materials-registry-fix, 2026-08-25): REALNY OutputsAggregateTabContent, trzy wiersze mieszane po naprawie projekcji Document/Sheet/Presentation.',
    render: () => <MaterialsRegistryScreen />,
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
      'AUDYTY — zakładka „Raporty": REALNY <AuditsMethodHub ?tab=reports> (/audit-programs) + REALNY DRDAuditReportView (?variant=report, ff_drd_report). Do 2026-09-02 wariant listowy montował niezamontowany w produkcie AuditsHub.',
    render: () => <AudytyDrdReportScreen />,
  },
  'assessment-quality-review-panel': {
    label:
      'ASSESSMENT — ASM-005/006/007: Outputs → evidence/scoring + accept/return + niezmienny output. ?variant=mixed|accepted|empty',
    render: () => <AssessmentQualityReviewPanelScreen />,
  },
  'assessment-presentation-view': {
    label:
      'ASSESSMENT — Widok prezentacji (9 slajdów z zamrożonego Outputu, tryb pełnoekranowy, zero recompute). ?variant=full|risksOnly|allMet|unknowns|empty|noOutput|notFound|forbidden|offline|badShape &narrative=1',
    render: () => <AssessmentPresentationViewScreen />,
  },
  'prawy-pas-jedna-formula': {
    label:
      'GRAFIKA — Prawy pas jako JEDNA FORMUŁA (szyna 56px: Artefakt · narzędzie zależne od typu). Bez czatu w pasie — decyzja 2026-09-01 „jedna Teresa, w swoim oknie". Interaktywny — przełącznik notatka/idea.',
    render: () => <PrawyPasJednaFormulaScreen />,
  },
  'prawy-pas-jedna-formula-notatka-artefakt': {
    label:
      'GRAFIKA — jw., wariant do zrzutu: Notatka · tryb Artefakt (7 sekcji akordeonu, Akcje+Właściwości rozwinięte).',
    render: () => (
      <PrawyPasJednaFormulaScreen
        initialObjectType="notatka"
        initialRailMode="artefakt"
        interactive={false}
      />
    ),
  },
  'prawy-pas-jedna-formula-notatka-teresa': {
    label:
      'GRAFIKA — jw., Notatka. Dawny „tryb Teresa" ODRZUCONY 2026-09-01 („jedna Teresa, w swoim oknie") — adres zostaje, renderuje panel artefaktu z przyciskiem „Zapytaj Teresę o tę notatkę".',
    render: () => (
      <PrawyPasJednaFormulaScreen
        initialObjectType="notatka"
        initialRailMode="teresa"
        interactive={false}
      />
    ),
  },
  'prawy-pas-jedna-formula-idea-artefakt': {
    label:
      'GRAFIKA — jw., wariant do zrzutu: Idea · tryb Artefakt (7 sekcji akordeonu, Akcje+Właściwości rozwinięte).',
    render: () => (
      <PrawyPasJednaFormulaScreen
        initialObjectType="idea"
        initialRailMode="artefakt"
        interactive={false}
      />
    ),
  },
  'prawy-pas-jedna-formula-idea-teresa': {
    label:
      'GRAFIKA — jw., Idea. Dawny „tryb Teresa" ODRZUCONY 2026-09-01 („jedna Teresa, w swoim oknie") — adres zostaje, renderuje panel artefaktu z przyciskiem „Zapytaj Teresę o tę ideę".',
    render: () => (
      <PrawyPasJednaFormulaScreen
        initialObjectType="idea"
        initialRailMode="teresa"
        interactive={false}
      />
    ),
  },
  'menu-canon-sidebar-check': {
    label:
      'SIDEBAR — potwierdzenie braku osobnej pozycji "Excel" po feat/materials-menu-canon-5-tabs.',
    render: () => <MenuCanonSidebarCheckScreen />,
  },
//  'initiatives-portfolio-analysis': {
//    label:
//      'Inicjatywy → analiza portfela — 5 podwidoków po wycięciu atrap AI (&sub=…, &ai=ok|fail|empty)',
//    render: () => <InitiativesPortfolioAnalysisScreen />,
//  },
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
    label:
      'IDEE Table — RecordTemplateManager (RISK-06 dead-mount wiring). ?stan=lista|pusty|blad — 2026-08-12',
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
  'initiative-record': {
    label:
      'FORMULA-20 — REALNY <InitiativeDocumentView> (archetyp C·Rekord, SPEC-A), showcase fixture init-showcase-margin-leakage-recovery',
    render: () => <InitiativeRecordScreen />,
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
  'interview-progressbar-153': {
    label:
      '153-crimson-naprawa — InterviewWorkspace dedicated_question_workspace (progress bar bg-c-accent -> bg-c-success)',
    render: () => <InterviewProgressbar153Screen />,
  },
  'interview-preview-canon': {
    label:
      'DEC-2026-08-25-53 — Interview Sesje/Inicjatywy PREVIEW rebuilt onto TABLE_AND_PREVIEW_CANON §7 (REALNE TableWithPreviewLayout + Interview{Session,Initiative}PreviewBody/Footer). &variant=session|initiative &kebab=1 (otwiera kebab Details na starcie)',
    render: () => <InterviewPreviewCanonScreen />,
  },
  'interview-creator-shell': {
    label: 'DEC-2026-08-25-67 — Interview Creator Shell (&step=1|2|3 &scene=default|off|empty)',
    render: () => <InterviewCreatorShellScreen />,
  },
  'interview-sessions-status': {
    label:
      'UI-latki-20260828 — REALNY <InterviewHub /> zakładka Sesje, kolumna status: 5 wierszy (assigned/in_progress/submitted/approved/completed) — weryfikacja etykiety "Przydzielony" i neutralnego tonu dla assigned.',
    render: () => <InterviewSessionsStatusScreen />,
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
  'karta-dzialania': {
    label: 'P9 — wspólna karta działania (DEC-397)',
    render: () => <KartaDzialaniaScreen />,
  },
  'karta-miernik': {
    label:
      'KARTY N — Miernik KPI (DEC-422): REALNY <KpiToolPage> z Menu 5 (Sekcje · Edycja|Podgląd · Pracuj z AI), paskiem modułu z pigułką otwartej karty i przyklejonym stosem Menu 4/5',
    render: () => <KartaMiernikScreen />,
  },
  'karta-cel-okr': {
    label:
      'KARTY N — Cel OKR (DEC-422): REALNY <OkrObjectiveCardPage> z Menu 5 i Pracuj z AI; zestaw w statusie draft, więc prawo edycji jest realne',
    render: () => <KartaCelOkrScreen />,
  },
  'karta-analiza-roi': {
    label:
      'KARTY N — Analiza ROI (DEC-422): REALNY <RoiCaseCardPage> z Menu 5 i Pracuj z AI; PIR w statusie draft, więc Uzupełnij ma gdzie zapisać',
    render: () => <KartaAnalizaRoiScreen />,
  },
  'karta-task-pelna': {
    label:
      '02-moja-praca — Task pełny rekord (double-click, N-mode) — re-eksport karta-task, 145-nowe-ekrany 2026-08-31',
    render: () => <KartaTaskPelnaScreen />,
  },
  'mywork-inbox': {
    label: '02-moja-praca — Skrzynka (zakładka domyślna) — 145-nowe-ekrany 2026-08-31',
    render: () => <MyWorkInboxScreen />,
  },
  'mywork-calendar': {
    label: '02-moja-praca — Kalendarz (widok bazowy) — 145-nowe-ekrany 2026-08-31',
    render: () => <MyWorkCalendarScreen />,
  },
  'mywork-calendar-disconnected': {
    label:
      'ZLECENIE 1.1-K (06.09) — Kalendarz, Google/Outlook rozłączone: dowód usunięcia zdublowanego komunikatu "Niepołączone" pod listą ŹRÓDŁA',
    render: () => <MyWorkCalendarDisconnectedScreen />,
  },
  'mywork-decisions': {
    label:
      '02-moja-praca — Decyzje (DecisionsPanelContent, następca 12 wycofanych kolejek decyzyjnych) — dyżur "ekrany bez wpisu" 2026-09-03',
    render: () => <MyWorkDecisionsScreen />,
  },
  'mywork-tasks': {
    label:
      '02-moja-praca — Zadania, widok LISTY (MyTasksListContent, różny od pojedynczej karty karta-task.tsx) — dyżur "ekrany bez wpisu" 2026-09-03',
    render: () => <MyWorkTasksScreen />,
  },
  'reports-hub-management': {
    label:
      'Wyniki — Raporty zarządcze PMO (ReportsHub: Team Meeting/Steering Committee/Portfolio Health/RAID) — dyżur "ekrany bez wpisu" 2026-09-03',
    render: () => <ReportsHubManagementScreen />,
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
  'admin-ai-control-center-panel': {
    label: 'Day 218 — AI policy honest full/empty/unavailable states (&state=)',
    render: () => <AdminAIControlCenterPanelScreen />,
  },
  'finance-hub': {
    label:
      'GRAFIKA 17 — REALNY <FinanceHub> (ekran wejściowy Finansów, brakująca „pierwsza karta" — sześć analizowanych spółek, PLN/EUR/USD/GBP). &tab=statements|analysis|models|prediction|valuation',
    render: () => <FinanceHubScreen />,
  },
  'day233-finanse-rejestry': {
    label:
      'Day233 — realny FinanceHub, pięć rejestrów z fixture owner-review; &tab=statements|analysis|models|prediction|valuation',
    render: () => <Day233FinanseRejestryScreen />,
  },
  'day233-finanse-panele': {
    label:
      'Day233 — 21 realnych paneli Finansów; &panel=monte-carlo|real-options|frontier|sensitivity|scenarios|banking|cash-forecast|driver|driver-tree|extended-ratios|headcount|investment-appraisal|rolling-forecast|valuation-visuals|value|value-attribution|value-capture|value-ledger|variance-bridge|variance-narration|ev-basket',
    render: () => <Day233FinansePaneleScreen />,
  },
  'admin-sso-self-service-card': {
    label: 'HP-24 SSO self-service — SAML skonfigurowany (2 domeny) + panel wyniku testu',
    render: () => <AdminSsoSelfServiceCardScreen />,
  },
  // admin-security (runda pełna) — odbiór grafiki 146-admin-security (2026-08-31),
  // domena "Bezpieczeństwo i tożsamość" (adminNavigation.ts), 10 ekranów,
  // mapowanie 1:1 z AdminSettingsModule.tsx case 'security'. security-policy
  // i sso są ALIASEM tej samej zakładki `policy` w AdminSecurityIdentityPanel
  // (WIRE_ONLY, nie błąd harnessu) — patrz nagłówek dev-render/screens/admin-security.tsx.
  'admin-security-security-policy': {
    label: 'Admin security — Polityka bezpieczeństwa (AdminSecurityIdentityPanel tab=policy)',
    render: () => <AdminSecurityScreen adminScreen="security-policy" />,
  },
  'admin-security-sso': {
    label: 'Admin security — SSO (ALIAS Polityki bezpieczeństwa, ta sama zakładka policy)',
    render: () => <AdminSecurityScreen adminScreen="sso" />,
  },
  'admin-security-scim-lifecycle': {
    label: 'Admin security — SCIM i cykl życia (AdminSecurityIdentityPanel tab=scim)',
    render: () => <AdminSecurityScreen adminScreen="scim-lifecycle" />,
  },
  'admin-security-sessions': {
    label: 'Admin security — Sesje (AdminSessionsPanel, StandardTable)',
    render: () => <AdminSecurityScreen adminScreen="sessions" />,
  },
  'admin-security-api-access': {
    label: 'Admin security — Dostęp API (AdminSecurityIdentityPanel tab=api-access, ApiKeysManagementView)',
    render: () => <AdminSecurityScreen adminScreen="api-access" />,
  },
  'admin-security-domains': {
    label: 'Admin security — Domeny (AdminDomainsPanel, StandardTable)',
    render: () => <AdminSecurityScreen adminScreen="domains" />,
  },
  'admin-security-service-accounts': {
    label: 'Admin security — Konta usługowe (AdminServiceAccountsPanel, StandardTable)',
    render: () => <AdminSecurityScreen adminScreen="service-accounts" />,
  },
  'admin-security-security-alerts': {
    label: 'Admin security — Alerty bezpieczeństwa (AdminSecurityAlertsPanel, StandardTable)',
    render: () => <AdminSecurityScreen adminScreen="security-alerts" />,
  },
  'admin-security-break-glass': {
    label: 'Admin security — Break-glass (AdminBreakGlassPanel, StandardTable)',
    render: () => <AdminSecurityScreen adminScreen="break-glass" />,
  },
  'admin-security-risk-summary': {
    label: 'Admin security — Podsumowanie ryzyka (AdminSecurityIdentityPanel tab=risk)',
    render: () => <AdminSecurityScreen adminScreen="risk-summary" />,
  },
  // admin-billing (runda pełna) — odbiór grafiki 146-admin-billing (2026-08-31),
  // domena "Rozliczenia i plany" (adminNavigation.ts), 9 ekranów, mapowanie
  // 1:1 z AdminSettingsModule.tsx case 'billing'. Dwie pary są aliasami tej
  // samej zakładki w produkcie (usage-costs≡overview, billing-details≡budgets-alerts)
  // — patrz nagłówek dev-render/screens/admin-billing.tsx.
  'admin-billing-overview': {
    label: 'Admin billing — Przegląd (AdminBillingFinOpsPanel screen=summary)',
    render: () => <AdminBillingScreen adminScreen="overview" />,
  },
  'admin-billing-plan-limits': {
    label: 'Admin billing — Plan i limity (AdminBillingFinOpsPanel screen=plan)',
    render: () => <AdminBillingScreen adminScreen="plan-limits" />,
  },
  'admin-billing-usage-costs': {
    label:
      'Admin billing — Wykorzystanie i koszty (ALIAS Przeglądu, ta sama zakładka summary)',
    render: () => <AdminBillingScreen adminScreen="usage-costs" />,
  },
  'admin-billing-payment-methods': {
    label: 'Admin billing — Metody płatności (AdminBillingFinOpsPanel screen=payments)',
    render: () => <AdminBillingScreen adminScreen="payment-methods" />,
  },
  'admin-billing-invoices': {
    label: 'Admin billing — Faktury (AdminBillingFinOpsPanel screen=invoices)',
    render: () => <AdminBillingScreen adminScreen="invoices" />,
  },
  'admin-billing-seats-licences': {
    label: 'Admin billing — Miejsca i licencje (AdminSeatsLicencesPanel, StandardTable)',
    render: () => <AdminBillingScreen adminScreen="seats-licences" />,
  },
  'admin-billing-billing-details': {
    label:
      'Admin billing — Dane rozliczeniowe (ALIAS Budżetów i alertów, ta sama zakładka controls)',
    render: () => <AdminBillingScreen adminScreen="billing-details" />,
  },
  'admin-billing-budgets-alerts': {
    label: 'Admin billing — Budżety i alerty (AdminBillingFinOpsPanel screen=controls)',
    render: () => <AdminBillingScreen adminScreen="budgets-alerts" />,
  },
  'admin-billing-plan-history': {
    label: 'Admin billing — Historia zmian planu (AdminPlanHistoryPanel, StandardTable)',
    render: () => <AdminBillingScreen adminScreen="plan-history" />,
  },
  // admin-team (runda pełna) — odbiór grafiki 146-admin-team (2026-08-31),
  // domena "Zespół i dostęp" (adminNavigation.ts), 8 ekranów, mapowanie 1:1
  // z AdminSettingsModule.tsx case 'team'. Patrz nagłówek
  // dev-render/screens/admin-team.tsx dla mapowania komponentów i endpointów.
  'admin-team-members': {
    label: 'Admin team — Użytkownicy (AdminMembersRolesPanel screen=members)',
    render: () => <AdminTeamScreen adminScreen="members" />,
  },
  'admin-team-invitations': {
    label: 'Admin team — Zaproszenia (AdminMembersRolesPanel screen=invitations, StandardTable)',
    render: () => <AdminTeamScreen adminScreen="invitations" />,
  },
  'admin-team-roles-permissions': {
    label: 'Admin team — Role i uprawnienia (AdminRolesPermissionsPanel, StandardTable)',
    render: () => <AdminTeamScreen adminScreen="roles-permissions" />,
  },
  'admin-team-teams': {
    label: 'Admin team — Zespoły (AdminTeamsPanel, StandardTable + panel członków po kliknięciu)',
    render: () => <AdminTeamScreen adminScreen="teams" />,
  },
  'admin-team-guests-external': {
    label: 'Admin team — Goście i dostęp zewnętrzny (AdminGuestsPanel, StandardTable)',
    render: () => <AdminTeamScreen adminScreen="guests-external" />,
  },
  'admin-team-access-requests': {
    label: 'Admin team — Wnioski o dostęp (AdminAccessRequestsPanel — STATYCZNY placeholder, brak API)',
    render: () => <AdminTeamScreen adminScreen="access-requests" />,
  },
  'admin-team-access-reviews': {
    label: 'Admin team — Przeglądy dostępów (AdminAccessReviewsPanel, StandardTable)',
    render: () => <AdminTeamScreen adminScreen="access-reviews" />,
  },
  'admin-team-ownership': {
    label: 'Admin team — Własność (AdminMembersRolesPanel screen=ownership → OwnershipManagementView)',
    render: () => <AdminTeamScreen adminScreen="ownership" />,
  },
  // admin-ai (runda pełna) — odbiór grafiki 146-admin-ai (2026-08-31), domena
  // "Sterowanie AI" (adminNavigation.ts), 10 ekranów, mapowanie 1:1 z
  // AdminSettingsModule.tsx case 'ai' + AI_MODULE_TAB_BY_SCREEN. Pięć z nich
  // (models-providers/ai-limits-budgets/data-privacy/ai-operations/ai-audit)
  // dzielą tę samą powłokę AdminAIControlCenterPanel→AIModule z podwójnym
  // wewnętrznym pill-tabs — patrz nagłówek dev-render/screens/admin-ai.tsx.
  'admin-ai-policy-autonomy': {
    label: 'Admin ai — Polityka i autonomia (AdminAIControlCenterPanel tab=settings → OrgAISettingsView, tab policy)',
    render: () => <AdminAiScreen adminScreen="policy-autonomy" />,
  },
  'admin-ai-personas': {
    label: 'Admin ai — Persony (PersonasPanel)',
    render: () => <AdminAiScreen adminScreen="personas" />,
  },
  'admin-ai-models-providers': {
    label: 'Admin ai — Modele i dostawcy (AIModule tab=models-providers → ModelsProvidersTab, tabela HTML surowa, bez StandardTable)',
    render: () => <AdminAiScreen adminScreen="models-providers" />,
  },
  'admin-ai-ai-limits-budgets': {
    label: 'Admin ai — Limity i budżety (AIModule tab=access-limits → AccessLimitsTab, tabela HTML surowa, bez StandardTable)',
    render: () => <AdminAiScreen adminScreen="ai-limits-budgets" />,
  },
  'admin-ai-data-privacy': {
    label: 'Admin ai — Dane i prywatność (AIModule tab=features-privacy → FeaturesPrivacyTab)',
    render: () => <AdminAiScreen adminScreen="data-privacy" />,
  },
  'admin-ai-quality-evaluations': {
    label: 'Admin ai — Ewaluacje jakości (AdminAiQualityPanel, StandardTable ×2)',
    render: () => <AdminAiScreen adminScreen="quality-evaluations" />,
  },
  'admin-ai-ai-incidents': {
    label: 'Admin ai — Incydenty AI (AdminAiIncidentsPanel, StandardTable)',
    render: () => <AdminAiScreen adminScreen="ai-incidents" />,
  },
  'admin-ai-configuration-versions': {
    label: 'Admin ai — Wersje konfiguracji (AdminConfigurationVersionsPanel, StandardTable, V8 prompt-os)',
    render: () => <AdminAiScreen adminScreen="configuration-versions" />,
  },
  'admin-ai-ai-operations': {
    label: 'Admin ai — Operacje AI (AIModule tab=ai-health → AIMissionControl)',
    render: () => <AdminAiScreen adminScreen="ai-operations" />,
  },
  'admin-ai-ai-audit': {
    label: 'Admin ai — Audyt AI (AIModule tab=audit-compliance → AuditComplianceTab, tabela HTML surowa, bez StandardTable)',
    render: () => <AdminAiScreen adminScreen="ai-audit" />,
  },
  // admin-audit-health (runda pełna) — odbiór grafiki 146-admin-audit-health
  // (2026-08-31), domeny "Dziennik audytu" (audit) i "Stan systemu" (health)
  // z adminNavigation.ts, mapowanie 1:1 z AdminSettingsModule.tsx case
  // 'audit' / case 'health'. Trzy pary aliasów tej samej zakładki w
  // produkcie (high-risk-changes≡events, retention-export≡events,
  // diagnostics≡service-status) i osobny gate UNAUTHORIZED dla
  // platform-operations (CAN_ACCESS_PLATFORM_OPERATIONS na sztywno false)
  // — patrz nagłówki dev-render/screens/admin-audit.tsx i admin-health.tsx.
  'admin-audit-events': {
    label: 'Admin audit — Zdarzenia (AdminAuditLogPanel, FilterableTable)',
    render: () => <AdminAuditScreen adminScreen="events" />,
  },
  'admin-audit-high-risk-changes': {
    label: 'Admin audit — Zmiany wysokiego ryzyka (ALIAS Zdarzeń, ten sam AdminAuditLogPanel)',
    render: () => <AdminAuditScreen adminScreen="high-risk-changes" />,
  },
  'admin-audit-compliance-evidence': {
    label:
      'Admin audit — Dowody zgodności (AdminComplianceEvidencePanel, StandardTable — kolumny Zdarzenie/Aktor/Ryzyko PUSTE, patrz nagłówek pliku)',
    render: () => <AdminAuditScreen adminScreen="compliance-evidence" />,
  },
  'admin-audit-retention-export': {
    label: 'Admin audit — Retencja i eksport (ALIAS Zdarzeń, ten sam AdminAuditLogPanel)',
    render: () => <AdminAuditScreen adminScreen="retention-export" />,
  },
  'admin-audit-integrity': {
    label: 'Admin audit — Integralność (AdminAuditIntegrityPanel, karty, bez tabeli)',
    render: () => <AdminAuditScreen adminScreen="integrity" />,
  },
  'admin-audit-legal-hold': {
    label: 'Admin audit — Legal hold (AdminLegalHoldPanel, karta statusu, bez tabeli)',
    render: () => <AdminAuditScreen adminScreen="legal-hold" />,
  },
  'admin-audit-export-history': {
    label: 'Admin audit — Historia eksportów (AdminAuditExportHistoryPanel, StandardTable)',
    render: () => <AdminAuditScreen adminScreen="export-history" />,
  },
  'admin-health-service-status': {
    label:
      'Admin health — Stan usług (AdminHealthPanel canRunDiagnostics=false → statyczna karta UNKNOWN, patrz nagłówek pliku)',
    render: () => <AdminHealthScreen adminScreen="service-status" />,
  },
  'admin-health-diagnostics': {
    label: 'Admin health — Diagnostyka (ALIAS Stanu usług, ten sam AdminHealthPanel)',
    render: () => <AdminHealthScreen adminScreen="diagnostics" />,
  },
  'admin-health-dependencies': {
    label: 'Admin health — Zależności (AdminDependenciesPanel, karty <details>, bez tabeli)',
    render: () => <AdminHealthScreen adminScreen="dependencies" />,
  },
  'admin-health-incident-history': {
    label: 'Admin health — Historia incydentów (AdminIncidentHistoryPanel, karty, bez tabeli)',
    render: () => <AdminHealthScreen adminScreen="incident-history" />,
  },
  'admin-health-queues-jobs': {
    label: 'Admin health — Kolejki i zadania (AdminJobsPanel, StandardTable)',
    render: () => <AdminHealthScreen adminScreen="queues-jobs" />,
  },
  'admin-health-sla-slo': {
    label: 'Admin health — SLA / SLO (AdminSlaSloPanel, karty, bez tabeli)',
    render: () => <AdminHealthScreen adminScreen="sla-slo" />,
  },
  'admin-health-platform-operations': {
    label:
      'Admin health — Operacje platformowe (gate UNAUTHORIZED, odfiltrowane z menu — brak dostępu z nawigacji)',
    render: () => <AdminHealthScreen adminScreen="platform-operations" />,
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
  'admin-command-overview': {
    label: 'Admin command — Przegląd (AdminCommandCenterPanel aggregationOnly, kafle+podsumowania)',
    render: () => <AdminCommandScreen adminScreen="overview" />,
  },
  'admin-command-attention-queue': {
    label:
      'Admin command — Kolejka uwagi (CommandCenterAttentionQueue; ZNALEZISKO: sygnał ryzyka zawsze info/0, patrz nagłówek admin-command.tsx)',
    render: () => <AdminCommandScreen adminScreen="attention-queue" />,
  },
  'admin-command-cost-capacity': {
    label: 'Admin command — Koszt i pojemność (CommandCenterCostCapacity, StandardTable)',
    render: () => <AdminCommandScreen adminScreen="cost-capacity" />,
  },
  'admin-command-organization-defaults': {
    label:
      'Admin command — Ustawienia domyślne organizacji (AdminOrganizationDefaultsPanel, formularz surowy <label>/<input>)',
    render: () => <AdminCommandScreen adminScreen="organization-defaults" />,
  },
  'admin-command-agent-trace': {
    label: 'Admin command — Ślad agentów (CommandCenterAgentTraceTab, StandardTable)',
    render: () => <AdminCommandScreen adminScreen="agent-trace" />,
  },
  'admin-command-audit': {
    label: 'Admin command — Audyt SOC2 (CommandCenterAuditTab, StandardTable)',
    render: () => <AdminCommandScreen adminScreen="audit" />,
  },
  'admin-command-dlp': {
    label: 'Admin command — DLP (CommandCenterDlpTab, StandardTable+kebab)',
    render: () => <AdminCommandScreen adminScreen="dlp" />,
  },
  'admin-command-residency': {
    label: 'Admin command — Rezydencja danych (CommandCenterResidencyTab, formularz)',
    render: () => <AdminCommandScreen adminScreen="residency" />,
  },
  'admin-command-retention': {
    label: 'Admin command — Retencja (CommandCenterRetentionTab, StandardTable, inline edit)',
    render: () => <AdminCommandScreen adminScreen="retention" />,
  },
  'admin-command-ai-policy': {
    label: 'Admin command — Polityka AI (CommandCenterAiPolicyTab, formularz)',
    render: () => <AdminCommandScreen adminScreen="ai-policy" />,
  },
  'admin-command-benchmark': {
    label: 'Admin command — Benchmark konsultingowy (CommandCenterBenchmarkTab, karty statyczne)',
    render: () => <AdminCommandScreen adminScreen="benchmark" />,
  },
  'superadmin-platform-operations-day15': {
    label: 'Day 15 — REALNY <PlatformOperationsView>, katalogi fixture; &scene=ready|empty|error',
    render: () => <SuperadminPlatformOperationsDay15Screen />,
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
  'day207-write-proposal': {
    label: 'Day207 — real ExecutionProposalMessage for a same-turn pending WRITE proposal',
    render: () => <Day207WriteProposalScreen />,
  },
  'day221-audyty-warsztat': {
    label: 'Day221 — Audyty D-5: prototyp warsztatu, SPEC-A Rekord L, 18 ogniw / 4 fazy / prawy panel',
    render: () => <Day221AudytyWarsztatScreen />,
  },
  'day220-audyty-rejestr': {
    label: 'Day220 — Audyty: Sesje/Raporty/Ustalenia, pełne polskie wartości; &view=processes|reports|findings',
    render: () => <Day220AudytyRejestrScreen />,
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
  'mywork-idea-inspector-lekki': {
    label:
      'DEC-68 — LEKKI inspektor elementu Idea (360px, accordion, bez obwódek) wg mywork-inspektor-prototyp.html',
    render: () => <PrototypeHarness context="idea" legacy={<MyWorkIdeaInspectorLekkiScreen />} />,
  },
  'mywork-notebook-rail-speca': {
    label:
      'DEC-69 — prawa szyna Notatnika w kanonie SPEC-A (5 sekcji accordion, nie tabs) wg mywork-notatnik-szyna-prototyp.html. ' +
      'NAPRAWA (2026-08-30): flaga ff_notebookSpecAShell jest domyślnie OFF i harness jej nie ustawiał — ten wpis teraz FORSUJE ją ON ' +
      '(localStorage), więc ekran pokazuje SPEC-A, nie stary panel. Porównanie ze STARYM: mywork-notebook-rail-speca-stary.',
    render: () => <PrototypeHarness context="notebook" legacy={<MyWorkNotebookRailSpecAScreen specA />} />,
  },
  'mywork-notebook-rail-speca-stary': {
    label:
      'DEC-69 — jw., ale STARA szyna Notatnika (ff_notebookSpecAShell wymuszona OFF) — do porównania PRZED/PO z mywork-notebook-rail-speca.',
    render: () => <MyWorkNotebookRailSpecAScreen specA={false} />,
  },
  'prawy-pas-notatnik-artefakt': {
    label:
      'PRAWY PAS (system) — Notatnik, tryb ARTEFAKT (akordeon kanonu). Wymaga ?ff_artifact_right_rail=1',
    render: () => <PrawyPasNotatnikSystemScreen tryb="artefakt" />,
  },
  'prawy-pas-notatnik-teresa': {
    label:
      'PRAWY PAS (system) — Notatnik, tryb TERESA (pełna wysokość, własne pole pisania). Wymaga ?ff_artifact_right_rail=1',
    render: () => <PrawyPasNotatnikSystemScreen tryb="teresa" />,
  },
  'prawy-pas-notatnik-struktura': {
    label:
      'PRAWY PAS (system) — Notatnik, tryb zależny od typu: STRUKTURA NOTATKI. Wymaga ?ff_artifact_right_rail=1',
    render: () => <PrawyPasNotatnikSystemScreen tryb="struktura" />,
  },
  'prawy-pas-idea-artefakt': {
    label:
      'PRAWY PAS (system) — Idea, tryb ARTEFAKT (akordeon kanonu, bez „Historia" — bez zastosowania). Wymaga ?ff_artifact_right_rail=1',
    render: () => <PrawyPasIdeaSystemScreen tryb="artefakt" />,
  },
  'prawy-pas-idea-teresa': {
    label:
      'PRAWY PAS (system) — Idea, tryb TERESA (4 komendy + CTA „Rozmawiaj z Teresą", wyjęte z akordeonu). Wymaga ?ff_artifact_right_rail=1',
    render: () => <PrawyPasIdeaSystemScreen tryb="teresa" />,
  },
  'prawy-pas-idea-sugestie': {
    label:
      'PRAWY PAS (system) — Idea, tryb zależny od typu: SUGESTIE (IdeaAISuggestionsPanel, własna ikona szyny). Wymaga ?ff_artifact_right_rail=1',
    render: () => <PrawyPasIdeaSystemScreen tryb="sugestie" />,
  },
  // Trzeci krok rozwożenia (2026-08-30, ANALIZA_PRAWY_PANEL.md §7 krok 4):
  // Tabele — powierzchnia TRUDNA (7 narzędzi „po artefakcie" bez ŻADNEJ
  // sekcji „o artefakcie" — dodajemy ósmy, pierwszy tool `'artefakt'`,
  // reszta 1:1). Wymaga TAKŻE `?ff_melsTabele=1` — `<TabeleView>` montuje
  // `TabeleMelsView` (jedyny konsument `TabeleRightRail.tsx`) tylko za tą
  // WCZEŚNIEJSZĄ, osobną flagą (domyślnie OFF, EPIC-T16); bez niej ten
  // harness renderowałby legacy `KimiWorkspaceShell`, który nie ma right
  // railu wcale (zła powierzchnia — patrz pułapka z arkuszem, CLAUDE.md).
  'prawy-pas-tabele-off': {
    label:
      'PRAWY PAS (system) — Tabele, STAN DZISIEJSZY, szyna ZAMKNIĘTA (bez propa activeRightRailToolId — dokładnie jak w produkcji). Wymaga ?ff_melsTabele=1 — sumy kontrolne z tym wpisem PRZED zmianą dowodzą OFF-identyczności niezależnie od harness-owego propa sterującego.',
    render: () => <PrawyPasTabeleSystemScreen tryb="closed" />,
  },
  'prawy-pas-tabele-search': {
    label:
      'PRAWY PAS (system) — Tabele, tryb SEARCH (pierwszy tool „po artefakcie", stan dzisiejszy z otwartym panelem). Wymaga ?ff_melsTabele=1',
    render: () => <PrawyPasTabeleSystemScreen tryb="search" />,
  },
  'prawy-pas-tabele-artefakt': {
    label:
      'PRAWY PAS (system) — Tabele, tryb ARTEFAKT (akordeon kanonu: Właściwości/Powiązania/Komentarze — jedyne z realnymi danymi). Wymaga ?ff_melsTabele=1&ff_artifact_right_rail=1',
    render: () => <PrawyPasTabeleSystemScreen tryb="artefakt" />,
  },
  // Czwarty/piąty krok rozwożenia (2026-08-31, tor grafiki, dwie „trudne"
  // szyny): Prezentacje (generator) — dziś JEDEN identyfikator `activity`
  // bez akordeonu. Baseline OFF renderuje się bez `?ff_artifact_right_rail`.
  'prawy-pas-prezentacje-off': {
    label:
      'PRAWY PAS (system) — Prezentacje (generator), STAN DZISIEJSZY (ikona „Activity", bez akordeonu) — sumy kontrolne z tym wpisem PRZED zmianą dowodzą OFF-identyczności.',
    render: () => <PrawyPasPrezentacjeSystemScreen />,
  },
  'prawy-pas-prezentacje-artefakt': {
    label:
      'PRAWY PAS (system) — Prezentacje (generator), tryb ARTEFAKT (akordeon kanonu, jedyna zastosowana sekcja: Historia). Wymaga ?ff_artifact_right_rail=1',
    render: () => <PrawyPasPrezentacjeSystemScreen />,
  },
  // Deck Builder — dziś SZEŚĆ płaskich identyfikatorów (blocks/media/
  // evidence/relations/comments/activity) na jednej szynie. ON: Blocks
  // (po artefakcie, osobna ikona) → Artefakt (Powiązania/Źródła/Komentarze/
  // Historia scalone w akordeon).
  'prawy-pas-deck-builder-off': {
    label:
      'PRAWY PAS (system) — Deck Builder, STAN DZISIEJSZY (5 płaskich ikon: Blocks/Comments/Activity/Relations/Evidence) — sumy kontrolne z tym wpisem PRZED zmianą dowodzą OFF-identyczności.',
    render: () => <PrawyPasDeckBuilderSystemScreen />,
  },
  'prawy-pas-deck-builder-blocks': {
    label:
      'PRAWY PAS (system) — Deck Builder, tryb PO ARTEFAKCIE: BLOCKS (osobna ikona, żywa edycja). Wymaga ?ff_artifact_right_rail=1',
    render: () => <PrawyPasDeckBuilderSystemScreen tryb="blocks" />,
  },
  'prawy-pas-deck-builder-artefakt': {
    label:
      'PRAWY PAS (system) — Deck Builder, tryb ARTEFAKT (akordeon kanonu: Powiązania/Źródła i założenia/Komentarze/Historia, scalone z 4 dawnych płaskich ikon). Wymaga ?ff_artifact_right_rail=1',
    render: () => <PrawyPasDeckBuilderSystemScreen tryb="artefakt" />,
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
  'notatnik-centrum-mysli': {
    label: 'Notatnik = CENTRUM MYŚLI (#16 auto-notatka · #21 przypomnij · #23 presence)',
    render: () => <PrototypeHarness context="notebook" legacy={<NotatnikCentrumMysliScreen />} />,
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
  'day200-finance-panels': {
    label:
      'Dyżur 200 — pozostałych 14/21 paneli finansów (&panel=banking|cash-forecast|driver-tree|extended-ratios|headcount|investment-appraisal|rolling-forecast|valuation-visuals|value-attribution|value-capture|value-ledger|variance-bridge|variance-narration|ev-basket)',
    render: () => <Day200FinancePanelsScreen />,
  },
  'finance-model-workspace': {
    label: 'Finance model workspace',
    render: () => <FinanceModelWorkspaceScreen />,
  },
  'finance-workspace-bar': {
    label: 'Finance workspace bar',
    render: () => <FinanceWorkspaceBarScreen />,
  },
  'finance-focus-mode': { label: 'Finance focus mode', render: () => <FinanceFocusModeScreen /> },
  'finance-statement-pack-workspace-v2': {
    label: 'Finance statement pack workspace',
    render: () => <FinanceStatementPackWorkspaceV2Screen />,
  },
  'finance-baseline-workspace': {
    label: 'Finance baseline workspace',
    render: () => <FinanceBaselineWorkspaceScreen />,
  },
  'finance-prediction-workspace': {
    label: 'Finance prediction workspace',
    render: () => <FinancePredictionWorkspaceScreen />,
  },
  'finance-id-bridge': { label: 'Finance ID bridge', render: () => <FinanceIdBridgeScreen /> },
  'finance-analysis-workspace': {
    label: 'Finance analysis workspace',
    render: () => <FinanceAnalysisWorkspaceScreen />,
  },
  'finance-valuation-workspace': {
    label: 'Finance valuation workspace',
    render: () => <FinanceValuationWorkspaceScreen />,
  },
  'finance-lineage-navigator': {
    label: 'Finance lineage navigator',
    render: () => <FinanceLineageNavigatorScreen />,
  },
  'finance-compare-panel': {
    label: 'Finance compare panel',
    render: () => <FinanceComparePanelScreen />,
  },
  'finance-comments-panel': {
    label: 'Finance comments panel',
    render: () => <FinanceCommentsPanelScreen />,
  },
  'finance-saved-views-panel': {
    label: 'Finance saved views panel',
    render: () => <FinanceSavedViewsPanelScreen />,
  },
  'finance-export-import-panel': {
    label: 'Finance export import panel',
    render: () => <FinanceExportImportPanelScreen />,
  },
//  'execution-change-signals': {
//    label:
//      'M14-wire — ExecutionChangeSignalsPanel (capacity signals · ADKAR readiness · champions), flaga changeSignals default OFF',
//    render: () => <ExecutionChangeSignalsScreen />,
//  },
  'execution-report-day11': {
    label: 'Execution Day 11 — reports intelligence and governed generator',
    render: () => <ExecutionReportDay11Screen />,
  },
  // 145-execution-taby — REALNY <ExecutionHub initialTab="..."> pełna powłoka
  // (Menu 1 StandardModuleBar + treść zakładki), 7 brakujących zakładek z 8
  // (rejestr grafiki pokrywał dotąd tylko "Raporty"). Dane: patrz nagłówek
  // dev-render/screens/execution-tab.tsx (demo-fallback/local-review, zero
  // ręcznego mockowania fetch — realne ścieżki degradacji produktu w DEV).
  'execution-tab-list': {
    label: 'Realizacja → zakładka "Realizacje" (Portfolio), REALNY <ExecutionHub initialTab="list">',
    render: () => <ExecutionTabScreen tab="list" />,
  },
  'execution-tab-work': {
    label: 'Realizacja → zakładka "Praca", REALNY <ExecutionHub initialTab="work"> (ExecutionWorkSurface)',
    render: () => <ExecutionTabScreen tab="work" />,
  },
  'execution-tab-resources': {
    label:
      'Realizacja → zakładka "Zasoby", REALNY <ExecutionHub initialTab="resources"> (ExecutionResourcesSurface)',
    render: () => <ExecutionTabScreen tab="resources" />,
  },
  'execution-tab-control': {
    label:
      'Realizacja → zakładka "Sterowanie", REALNY <ExecutionHub initialTab="control"> (ExecutionControlSurface)',
    render: () => <ExecutionTabScreen tab="control" />,
  },
  'execution-tab-rollout': {
    label:
      'Realizacja → zakładka "Rollout" (chromeless, /rollout deep-link), REALNY <ExecutionHub initialTab="rollout"> (RolloutTab: Plan/KPI/Ryzyka/Zmiany/Zamknięcie)',
    render: () => <ExecutionTabScreen tab="rollout" />,
  },
  'execution-tab-summary': {
    label:
      'Realizacja → zakładka "Summary one-look" (chromeless, za flagą summaryOneLook — domyślnie ON poza public-prod), REALNY <ExecutionHub initialTab="summary">',
    render: () => <ExecutionTabScreen tab="summary" />,
  },
  'execution-tab-people_change': {
    label:
      'Realizacja → zakładka "People & Change" (chromeless, osiągana z Action Center), REALNY <ExecutionHub initialTab="people_change"> (ExecutionManagementView)',
    render: () => <ExecutionTabScreen tab="people_change" />,
  },
//  'execution-export-prezentacja': {
//    label:
//      'Naprawa 2026-07-27 — Execution „Export as presentation" → PrezentacjeView konsumuje sourceType/sourceName/content (2 fazy: klik → auto-start Z AI)',
//    render: () => <ExecutionExportPrezentacjaScreen />,
//  },
  'tools-swot-live': {
    label: 'Narzędzia → Dynamic SWOT: sesja na żywo',
    render: () => <ToolsSwotLiveScreen />,
  },
  'tools-swot-library-detail': {
    label: 'Narzędzia → Dynamic SWOT: karta w bibliotece',
    render: () => <ToolsSwotLibraryDetailScreen />,
  },
  'tools-swot-session-workspace': {
    label: 'Narzędzia → Dynamic SWOT: warsztat sesji',
    render: () => <ToolsSwotSessionWorkspaceScreen />,
  },
  'tools-sesja-wyjscie': {
    label: 'Narzędzia → wyjście z sesji',
    render: () => <ToolsSesjaWyjscieScreen />,
  },
  'tool-outputs-panel': {
    label: 'Narzędzia → panel rezultatów',
    render: () => <ToolOutputsPanelScreen />,
  },
  'tools-outputs-insights-tab': {
    label: 'Narzędzia → zakładka wniosków',
    render: () => <ToolsOutputsInsightsTabScreen />,
  },
  'chat-signals-feed': {
    label: 'Czat → strumień sygnałów',
    render: () => <ChatSignalsFeedScreen />,
  },
  'exec-summary-onelook': {
    label: 'Realizacja → streszczenie na jeden rzut oka',
    render: () => <ExecSummaryOnelookScreen />,
  },
  'assessment-list': {
    label:
      'OCENA — lista ocen: REALNY <AssessmentHub initialTab="processes"> (/assessment?tab=processes). Do 2026-09-02 była to REPLIKA triady, nie produkt.',
    render: () => <AssessmentListScreen />,
  },
  'assessment-five-surfaces': {
    label: 'T22 final closeout — real AssessmentHub with five surfaces forced ON',
    render: () => <AssessmentFiveSurfacesScreen />,
  },
  'assessment-manage-panel': {
    label:
      'ASM-ID TRIADA — real <AssessmentManagePanel> (Workflow/Team/Reports/Initiatives tabs, crimson sweep verification) — &tab=workflow|team|reports|initiatives|logs',
    render: () => <AssessmentManagePanelScreen />,
  },
  'assessment-matryca': {
    label:
      'SPEC-A archetyp D — sesja Assessment jako Matryca: REALNY <DRDMatrixSession> w realnej powłoce <TopBar> (Menu 1) + <ArtifactRightPanel>. &lang=pl|en &theme=light|dark',
    render: () => <AssessmentMatrycaScreen />,
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
    label:
      'OCENA — zakładka „Inicjatywy": REALNY <AssessmentHub initialTab="initiatives">. Do 2026-09-02 montowany martwy InitiativesTable (zero wołaczy w src/).',
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
    label:
      'OCENA — zakładka „Raporty" (widok globalny): REALNY <AssessmentHub initialTab="reports">. Do 2026-09-02 montowany martwy ReportsTable (zero wołaczy w src/).',
    render: () => <AssessmentReportsTableScreen />,
  },
  'assessment-output-report': {
    label:
      'Assessment Report (SPEC-A Dokument) — renderer zamrożonego Outputu; ?variant=happy|edge|not-frozen',
    render: () => <AssessmentOutputReportScreen />,
  },
  'assessment-report-contract': {
    label:
      'Assessment Report Contract — 7 rozdziałów SPEC-A; ?scenario=pelny|sloty|pominiecia|blad',
    render: () => <AssessmentReportContractScreen />,
  },
  'canvas-new-doc': {
    label: '#87a Canvas "+" New — 3 opcje startu (Czysty/Z szablonu/Z canvasa) → Teresa',
    render: () => <CanvasNewDocScreen />,
  },
  'canvas-toolbar-md-history': {
    label:
      '#87c naprawa: Import Markdown + Historia przeniesiona do kebaba — REALNY <WorkCanvasDocumentPanel>, główny pasek (kebab: ?screen=canvas-kebab-restructure)',
    render: () => <CanvasToolbarMdHistoryScreen />,
  },
  'canvas-kebab-restructure': {
    label:
      '#87d: restrukturyzacja kebaba „⋯" w nazwane grupy — REALNY <WorkCanvasDocumentPanel>, harness sam klika trigger [data-testid="canvas-menu-root"]',
    render: () => <CanvasKebabRestructureScreen />,
  },
  'chat-blad-ai': {
    label: 'CHAT-OWN-016 — Czat w stanie błędu dostawcy AI (?stan=blad-ai&wariant=przed|po)',
    render: () => <ChatBladAiScreen />,
  },
  'chat-split-teresa-right': {
    label: 'D17 /chat split ODWRÓCONY — artefakt po LEWEJ, Teresa po PRAWEJ',
    render: () => <ChatSplitTeresaRightScreen />,
  },
  'chat-tool-steps-day206': {
    label: 'Day206 — realny komponent kroków narzędzi READ Teresy',
    render: () => <ChatToolStepsDay206Screen />,
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
  'standard-grid-card': {
    label: '#76a JEDEN kanon karty grid/kafelkowej (StandardGridCard)',
    render: () => <StandardGridCardScreen />,
  },
  'standard-kanban-card': {
    label: '#75b JEDEN kanon karty kanban (StandardKanbanCard)',
    render: () => <StandardKanbanCardScreen />,
  },
  'mindmap-i18n-smoke': {
    label:
      'Smoke i18n fala 2 — M06 Mind Map modale (ideas.mindmap.*). ?variant=assign|attach|evidence (domyślnie assign) — modale są fixed, jeden na raz',
    render: () => <MindmapI18nSmokeScreen />,
  },
  'mm-ppm-measure': {
    label:
      'MM-P2 (2026-08-10) — pomiar wysokości PPM węzła Mind Map (1280×800, do-usuniecia po odbiorze)',
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
    render: () => <PrototypeHarness context="idea" legacy={<IdeasTeresaPanelScreen />} />,
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
  'chat-crimson-search-research': {
    label: 'CHAT 315 — realne wyszukiwanie + MessageRenderer/ResearchProgress',
    render: () => <ChatCrimsonSearchResearchScreen />,
  },
  'chat-crimson-private-message': {
    label: 'CHAT 315 — realny tryb prywatny + opcje/deep-thinking/przerwanie/ostrzeżenie',
    render: () => <ChatCrimsonPrivateMessageScreen />,
  },
  'chat-crimson-project-members': {
    label: 'CHAT 315 — realny modal członków projektu, pola z kanonicznym fokusem',
    render: () => <ChatCrimsonProjectMembersScreen />,
  },
  'chat-v8-artifact-run-search': {
    label: 'CHAT 315 — realna rozwinięta kontrolka V8ArtifactRunControl + wyszukiwanie',
    render: () => <ChatV8ArtifactRunSearchScreen />,
  },
  'chat-message-required-surfaces': {
    label: 'CHAT 315 — realny MessageRenderer: research/opcje/deep-thinking/przerwanie/ostrzeżenie',
    render: () => <ChatMessageRequiredSurfacesScreen />,
  },
  'mvp-11e-ponow-odpowiedz': {
    label: 'MVP 1.1-E — krótka odpowiedź Teresy: "Ponów odpowiedź" w widocznym rzędzie akcji',
    render: () => <Mvp11ePonowOdpowiedzScreen />,
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
  'report-artifact': {
    label: 'DOKUMENTY — Report jako artefakt (GeneratedReportView, wariant „raport doradczy")',
    render: () => <ReportArtifactScreen />,
  },
  'insight-artifact': {
    label: 'DOKUMENTY — Insight jako artefakt (tryb demo komponentu)',
    render: () => <InsightArtifactScreen />,
  },
  'drd-embedded-matrix-axis-levels': {
    label:
      'DRD — EmbeddedMatrix dowód naprawy maxLevel (culture/cybersecurity=6, SSOT drdStructure.ts)',
    render: () => <DrdEmbeddedMatrixAxisLevelsScreen />,
  },
  'drd-macierz-oceny': {
    label:
      'DRD — MACIERZ OCENY, stan zastany do AUDYTU (realny DRDAssessmentEditor, żywy w produkcie), &os=1..7',
    render: () => <DrdMacierzOcenyScreen />,
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
  'day214-teresa-adopt-card': {
    label:
      'FIX-214 pkt 4 — REALNY <GovernedInitiativeHandoffCard> (karta adopcji szkicu z czatu Teresy, za ENABLE_TERESA_ADOPT_CHAT_DRAFT, domyślnie OFF), 4 stany (idle/blocked/ready/adopted) napędzone realnymi kliknięciami przeciw przechwyconemu fetch — dane z fixture w harnessie, NIE z realnego przebiegu (patrz komentarz w pliku ekranu).',
    render: () => <Day214TeresaAdoptCardScreen />,
  },
  'day228-image-style-field': {
    label:
      'FIX-228 pkt 3 — REALNY <PresentationTemplateArchitectView>, pole „Styl obrazu" za flagą presentationImageStyleUiV1 (domyślnie OFF). &scene=on|off.',
    render: () => <Day228ImageStyleFieldScreen />,
  },
  'day231-konspekt-z-wiedzy': {
    label:
      'Day231 — realny OutlineStep z widocznymi źródłami przy tezach; dane z propsów harnessu, nie z realnego przebiegu.',
    render: () => <Day231KonspektZWiedzyScreen />,
  },
  'day230-przepelnienie': {
    label:
      'Day230 — realny komponent ostrzeżenia przed eksportem; stan overflow/clean z propsów harnessu.',
    render: () => <Day230PrzepelnienieScreen />,
  },
  'day232-agent-decku': {
    label:
      'Day232 — agent decku: pending/applied/rejected oraz następne ruchy; dane z propsów harnessu, nie z realnego przebiegu.',
    render: () => <Day232AgentDeckuScreen />,
  },
  'day234-wyniki-rejestry': {
    label:
      'Dyżur 234 — trzy REALNE rejestry Wyników, izolowane per domena. &domain=kpi|roi|okr &ff=off (jawny dowód bramki OFF) &state=ready|loading|empty|error',
    render: () => <Day234WynikiRejestryScreen />,
  },
  'day234-wyniki-narzedzia': {
    label:
      'Dyżur 234 — reprezentatywne wycinki REALNYCH pełnych narzędzi KPI/OKR/ROI na ręcznych fixture harnessu. &domain=kpi|roi|okr + parametry domenowe',
    render: () => <Day234WynikiNarzedziaScreen />,
  },
  // aios (runda pełna) — 146-aios, Internal Tools / AI OS (8 pozycji submenu),
  // odbiór grafiki 2026-08-31. Realne komponenty z src/components/AIChat/,
  // przełącznik `&screen=` w dev-render/screens/aios.tsx.
  'aios-home': {
    label: 'AI OS — Home (AIOSHub, harness odbioru 2026-08-31)',
    render: () => <AiosScreen />,
  },
  'aios-actions': {
    label: 'AI OS — AI Actions (ActionCenter, harness odbioru 2026-08-31) &screen=actions',
    render: () => <AiosScreen />,
  },
  'aios-research': {
    label: 'AI OS — Research Sessions (ResearchSessionsDock, harness odbioru 2026-08-31) &screen=research',
    render: () => <AiosScreen />,
  },
  'aios-artifacts': {
    label: 'AI OS — Artifacts (Wave5ArtifactRuntimePanel, harness odbioru 2026-08-31) &screen=artifacts',
    render: () => <AiosScreen />,
  },
  'aios-memory': {
    label: 'AI OS — Memory & Scope (Wave6ContextLearningPanel, harness odbioru 2026-08-31) &screen=memory',
    render: () => <AiosScreen />,
  },
  'aios-connectors': {
    label: 'AI OS — Connectors (Wave7ConnectorAdminPanel, harness odbioru 2026-08-31) &screen=connectors',
    render: () => <AiosScreen />,
  },
  'aios-agents': {
    label: 'AI OS — Agents (Wave8AgentCatalogPanel, harness odbioru 2026-08-31) &screen=agents',
    render: () => <AiosScreen />,
  },
  'aios-outcomes': {
    label: 'AI OS — KPI/ROI & AI Ops (Wave9OutcomeAIOpsPanel, harness odbioru 2026-08-31) &screen=outcomes',
    render: () => <AiosScreen />,
  },
  // ustawienia-organizacja (runda pełna) — odbiór grafiki 150-ustawienia-organizacja
  // (2026-08-31). Ustawienia: REALNY <SettingsView>, 10 grup nawigacji
  // (SettingsSidebar.tsx). Patrz nagłówek dev-render/screens/ustawienia-grupy.tsx.
  'ustawienia-personalne': {
    label: 'Ustawienia — PERSONAL (REALNY <SettingsView>, grupa my-settings → profile)',
    render: () => <UstawieniaGrupyScreen grupa="personalne" />,
  },
  'ustawienia-workflow': {
    label: 'Ustawienia — WORKFLOW (REALNY <SettingsView>, grupa work-preferences → dashboard)',
    render: () => <UstawieniaGrupyScreen grupa="workflow" />,
  },
  'ustawienia-ai-automatyzacja': {
    label:
      'Ustawienia — MODULES: AI & AUTOMATION (REALNY <SettingsView>, grupa ai-automation-group → ai-behavior)',
    render: () => <UstawieniaGrupyScreen grupa="ai-automatyzacja" />,
  },
  'ustawienia-powiadomienia': {
    label:
      'Ustawienia — MODULES: NOTIFICATIONS (REALNY <SettingsView>, grupa notifications → notifications-overview)',
    render: () => <UstawieniaGrupyScreen grupa="powiadomienia" />,
  },
  'ustawienia-bezpieczenstwo': {
    label: 'Ustawienia — SECURITY (REALNY <SettingsView>, grupa security → security-dashboard)',
    render: () => <UstawieniaGrupyScreen grupa="bezpieczenstwo" />,
  },
  'ustawienia-integracje': {
    label:
      'Ustawienia — MODULES: INTEGRATIONS (REALNY <SettingsView>, grupa integrations → connected-apps, surowy fetch)',
    render: () => <UstawieniaGrupyScreen grupa="integracje" />,
  },
  'day377-governed-connect': {
    label: 'Dyżur 377 — uczciwa odmowa governed connect',
    render: () => <Day377GovernedConnectScreen />,
  },
  'ustawienia-dane-prywatnosc': {
    label: 'Ustawienia — DATA & PRIVACY (REALNY <SettingsView>, grupa data-privacy → data-controls)',
    render: () => <UstawieniaGrupyScreen grupa="dane-prywatnosc" />,
  },
  'ustawienia-billing': {
    label:
      'Ustawienia — BILLING (REALNY <SettingsView>, grupa billing → billing; renderContent() zwraca null — ZNALEZISKO, patrz nagłówek pliku)',
    render: () => <UstawieniaGrupyScreen grupa="billing" />,
  },
  'ustawienia-wyglad': {
    label: 'Ustawienia — APPEARANCE (REALNY <SettingsView>, grupa appearance → theme)',
    render: () => <UstawieniaGrupyScreen grupa="wyglad" />,
  },
  'ustawienia-zaawansowane': {
    label: 'Ustawienia — ADVANCED & HISTORY (REALNY <SettingsView>, grupa advanced → import-export)',
    render: () => <UstawieniaGrupyScreen grupa="zaawansowane" />,
  },
  // Organizacja: REALNY <OrganizationView>, wariant DOMYŚLNY (flaga orgRedesignV1
  // OFF), 20 ekranów brakujących w rejestrze. Patrz nagłówek
  // dev-render/screens/org-legacy.tsx. `org-identity-operating` (profile/identity-scale)
  // ma już wpis — pominięty tutaj (choć renderuje wariant ON, patrz ZGŁASZAM w raporcie).
  'org-operating-model': {
    label: 'Organizacja — Model działania (REALNY <OrganizationView>, domyślnie OFF, profile/operating-model)',
    render: () => <OrgLegacyScreen module="profile" screen="operating-model" />,
  },
  'org-position-direction': {
    label: 'Organizacja — Pozycja i kierunek (REALNY <OrganizationView>, domyślnie OFF, profile/position-direction)',
    render: () => <OrgLegacyScreen module="profile" screen="position-direction" />,
  },
  'org-technology-culture-constraints': {
    label:
      'Organizacja — Technologia, kultura i ograniczenia (REALNY <OrganizationView>, domyślnie OFF, profile/technology-culture-constraints)',
    render: () => <OrgLegacyScreen module="profile" screen="technology-culture-constraints" />,
  },
  'org-strategic-intent': {
    label: 'Organizacja — Intencja strategiczna (REALNY <OrganizationView>, domyślnie OFF, goals/strategic-intent)',
    render: () => <OrgLegacyScreen module="goals" screen="strategic-intent" />,
  },
  'org-success-metrics': {
    label: 'Organizacja — Mierniki sukcesu (REALNY <OrganizationView>, domyślnie OFF, goals/success-metrics)',
    render: () => <OrgLegacyScreen module="goals" screen="success-metrics" />,
  },
  'org-scope-boundaries': {
    label: 'Organizacja — Zakres i granice (REALNY <OrganizationView>, domyślnie OFF, goals/scope-boundaries)',
    render: () => <OrgLegacyScreen module="goals" screen="scope-boundaries" />,
  },
  'org-stakeholder-expectations': {
    label:
      'Organizacja — Oczekiwania interesariuszy (REALNY <OrganizationView>, domyślnie OFF, goals/stakeholder-expectations)',
    render: () => <OrgLegacyScreen module="goals" screen="stakeholder-expectations" />,
  },
  'org-declared-challenges': {
    label:
      'Organizacja — Zadeklarowane wyzwania (REALNY <OrganizationView>, domyślnie OFF, challenges/declared-challenges)',
    render: () => <OrgLegacyScreen module="challenges" screen="declared-challenges" />,
  },
  'org-root-causes': {
    label: 'Organizacja — Przyczyny źródłowe (REALNY <OrganizationView>, domyślnie OFF, challenges/root-causes)',
    render: () => <OrgLegacyScreen module="challenges" screen="root-causes" />,
  },
  'org-goal-blockers': {
    label: 'Organizacja — Blockery celów (REALNY <OrganizationView>, domyślnie OFF, challenges/goal-blockers)',
    render: () => <OrgLegacyScreen module="challenges" screen="goal-blockers" />,
  },
  'org-evidence': {
    label: 'Organizacja — Dowody (REALNY <OrganizationView>, domyślnie OFF, challenges/evidence)',
    render: () => <OrgLegacyScreen module="challenges" screen="evidence" />,
  },
  'org-risks-opportunities': {
    label: 'Organizacja — Ryzyka i szanse (REALNY <OrganizationView>, domyślnie OFF, strategy/risks-opportunities)',
    render: () => <OrgLegacyScreen module="strategy" screen="risks-opportunities" />,
  },
  'org-scenarios': {
    label: 'Organizacja — Scenariusze (REALNY <OrganizationView>, domyślnie OFF, strategy/scenarios)',
    render: () => <OrgLegacyScreen module="strategy" screen="scenarios" />,
  },
  'org-recommendation': {
    label: 'Organizacja — Rekomendacja (REALNY <OrganizationView>, domyślnie OFF, strategy/recommendation)',
    render: () => <OrgLegacyScreen module="strategy" screen="recommendation" />,
  },
  'org-executive-brief': {
    label: 'Organizacja — Executive brief (REALNY <OrganizationView>, domyślnie OFF, strategy/executive-brief)',
    render: () => <OrgLegacyScreen module="strategy" screen="executive-brief" />,
  },
  'org-files': {
    label:
      'Organizacja — Pliki (REALNY <OrganizationView>, domyślnie OFF, sources/files, statyczny komunikat NIEZWERYFIKOWANE)',
    render: () => <OrgLegacyScreen module="sources" screen="files" />,
  },
  'org-claims-sources': {
    label: 'Organizacja — Twierdzenia i źródła (REALNY <OrganizationView>, domyślnie OFF, sources/claims-sources)',
    render: () => <OrgLegacyScreen module="sources" screen="claims-sources" />,
  },
  'org-source-conflicts': {
    label: 'Organizacja — Konflikty źródeł (REALNY <OrganizationView>, domyślnie OFF, sources/source-conflicts)',
    render: () => <OrgLegacyScreen module="sources" screen="source-conflicts" />,
  },
  'org-knowledge-graph': {
    label: 'Organizacja — Graf wiedzy (REALNY <OrganizationView>, domyślnie OFF, sources/knowledge-graph)',
    render: () => <OrgLegacyScreen module="sources" screen="knowledge-graph" />,
  },
  'org-summary': {
    label: 'Organizacja — Gotowość organizacji (REALNY <OrganizationView>, domyślnie OFF, readiness/summary)',
    render: () => <OrgLegacyScreen module="readiness" screen="summary" />,
  },
  'day267-materialy-hub-zrzuty': {
    label:
      'Day267 — realny ReportsAndPresentationsHub; &tab=outputs_all|outputs_documents|presentations|outputs_sheets|templates &state=ready|empty|loading|error',
    render: () => <Day267MaterialyHubZrzutyScreen />,
  },
  'auth-login': {
    label:
      'LOGOWANIE — REALNY <AuthView initialStep=LOGIN> w <AuthLayout> (kompozycja /login z AppRoutes.tsx). &lang=pl|en &theme=light|dark',
    render: () => <AuthLoginScreen />,
  },
  'auth-register': {
    label:
      'REJESTRACJA — REALNY <AuthView initialStep=REGISTER> w <AuthLayout> (kompozycja /register). &lang=pl|en &theme=light|dark',
    render: () => <AuthRegisterScreen />,
  },
  'auth-code-entry': {
    label:
      'ZAPROSZENIE DO ORGANIZACJI — REALNY <AuthView initialStep=CODE_ENTRY> (krok "Wpisz kod dostępu" z /login lub /register). &lang=pl|en &theme=light|dark',
    render: () => <AuthCodeEntryScreen />,
  },
  'auth-forgot-password': {
    label:
      'ODZYSKIWANIE HASŁA — REALNY <ForgotPasswordView> w <AuthLayout> (kompozycja /forgot-password). &lang=pl|en &theme=light|dark',
    render: () => <AuthForgotPasswordScreen />,
  },
  'auth-reset-password': {
    label:
      'ZMIANA HASŁA Z LINKU — REALNY <ResetPasswordView> w <AuthLayout> (kompozycja /reset-password, ?token= obecny). &lang=pl|en &theme=light|dark',
    render: () => <AuthResetPasswordScreen />,
  },
  'auth-verify-email': {
    label:
      'WERYFIKACJA E-MAIL — REALNY <VerifyEmail> (UWAGA: martwy komponent, brak trasy w AppRoutes.tsx — patrz komentarz w pliku ekranu). &lang=pl|en &theme=light|dark',
    render: () => <AuthVerifyEmailScreen />,
  },
  // Moduł 16 „Partner" (Partner Portal) — pierwszy komplet zrzutów, 2026-09-02.
  // Realny <PartnerPortalViewNew /> spod /partner/* (AppRoutes.tsx:3494), dane
  // przez window.fetch stub. Patrz dev-render/screens/partner-portal.tsx.
  'partner-start-unconnected': {
    label: 'Partner — Start, profil NIEPODŁĄCZONY (stan pusty). &lang=pl|en &theme=light|dark',
    render: () => <PartnerPortalScreen wariant="start-unconnected" />,
  },
  'partner-start-active': {
    label: 'Partner — Start, partner AKTYWNY (kafle salda + następny krok). &lang=pl|en &theme=light|dark',
    render: () => <PartnerPortalScreen wariant="start-active" />,
  },
  'partner-start-error': {
    label: 'Partner — Start, błąd ustalenia statusu połączenia. &lang=pl|en &theme=light|dark',
    render: () => <PartnerPortalScreen wariant="start-error" />,
  },
  'partner-dashboard': {
    label: 'Partner — Dashboard (przegląd: klienci, przychód, certyfikacja). &lang=pl|en &theme=light|dark',
    render: () => <PartnerPortalScreen wariant="dashboard" />,
  },
  'partner-referral-tools-filled': {
    label: 'Partner — Polecenia / Moje linki i kody, tabela kampanii WYPEŁNIONA (kebab realny). &lang=pl|en &theme=light|dark',
    render: () => <PartnerPortalScreen wariant="referral-tools-filled" />,
  },
  'partner-referral-tools-empty': {
    label: 'Partner — Polecenia / Moje linki i kody, tabela kampanii PUSTA. &lang=pl|en &theme=light|dark',
    render: () => <PartnerPortalScreen wariant="referral-tools-empty" />,
  },
  'partner-organizations-filled': {
    label: 'Partner — Klienci / Organizacje, FilterableTable WYPEŁNIONA (hideRowActions — brak kebaba). &lang=pl|en &theme=light|dark',
    render: () => <PartnerPortalScreen wariant="organizations-filled" />,
  },
  'partner-organizations-empty': {
    label: 'Partner — Klienci / Organizacje, PUSTA lista. &lang=pl|en &theme=light|dark',
    render: () => <PartnerPortalScreen wariant="organizations-empty" />,
  },
  'partner-earnings-filled': {
    label: 'Partner — Prowizje (saldo + tabela transakcji, hideRowActions). &lang=pl|en &theme=light|dark',
    render: () => <PartnerPortalScreen wariant="earnings-filled" />,
  },
  'partner-academy-filled': {
    label: 'Partner — Akademia / Ścieżka nauki (karty certyfikacji). &lang=pl|en &theme=light|dark',
    render: () => <PartnerPortalScreen wariant="academy-filled" />,
  },
  'partner-resources-filled': {
    label: 'Partner — Materiały / Dokumentacja. &lang=pl|en &theme=light|dark',
    render: () => <PartnerPortalScreen wariant="resources-filled" />,
  },
  'partner-profile-filled': {
    label: 'Partner — Profil / Informacje o firmie. &lang=pl|en &theme=light|dark',
    render: () => <PartnerPortalScreen wariant="profile-filled" />,
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
      {/* Panel uwag właściciela — obecny na KAŻDYM ekranie odbioru (zapis: /__uwagi).
          `&uwagi=0` wycina go z kadru: pływające „← Lista"/„Uwagi" to kontrolki
          HARNESSU, a nie produkt — na zrzucie do akceptu nie mogą się pojawić
          („zrzut czysty", CLAUDE.md §7c). */}
      {params.get('uwagi') !== '0' && <PanelUwag ekran={screenKey} />}
      {/* Toasty (react-hot-toast). Do 2026-07-23 harness NIE montował <Toaster/>,
          więc każdy `toast.error(...)` z ekranu był NIEWIDOCZNY — a to właśnie
          toastem produkt mówi „AI niedostępne, oto powód". Bez tego nie dało się
          zweryfikować oczami ścieżki awaryjnej.
          GRAFIKA (2026-08-30): domyślny styl react-hot-toast jest NA SZTYWNO
          biały/czarny — w motywie dark dawał jasną kartę na ciemnym tle
          (odkryte na excele-reopen-verify__dark). Realny <Toaster/> produktu
          (src/providers/AppProviders.tsx) jest tokenowy (--c-surface-raised/
          --c-text/--c-border) i motyw śledzi poprawnie — kopiujemy DOKŁADNIE
          te same tokeny tutaj, żeby zrzut harnessu pokazywał to, co naprawdę
          zobaczy właściciel, nie domyślny styl biblioteki. */}
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 4000,
          style: {
            maxWidth: 'min(420px, calc(100vw - 2rem))',
            padding: '10px 14px',
            borderRadius: '12px',
            fontSize: '14px',
            lineHeight: '1.4',
            background: 'var(--c-surface-raised)',
            color: 'var(--c-text)',
            border: '1px solid var(--c-border)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.14)',
          },
          success: {
            iconTheme: { primary: 'var(--c-success)', secondary: 'var(--c-surface-raised)' },
          },
          error: {
            duration: 6000,
            iconTheme: { primary: 'var(--c-danger)', secondary: 'var(--c-surface-raised)' },
          },
        }}
      />
    </DebugBoundary>
  </React.StrictMode>
);
