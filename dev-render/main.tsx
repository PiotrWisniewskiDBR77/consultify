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

// Real app i18n init (HttpBackend loads /locales/** served from repo `public/`).
import i18n from '../src/i18n';
import AccentSoftTokenFixScreen from './screens/accent-soft-token-fix';
import AdminCommandCenterPanelScreen from './screens/admin-command-center-panel';
import AdminSsoSelfServiceCardScreen from './screens/admin-sso-self-service-card';
import AgentPlanCanvasScreen from './screens/agent-plan-canvas';
import AgentPlanViewScreen from './screens/agent-plan-view';
import AssessmentInitiativesPanelScreen from './screens/assessment-initiatives-panel';
import AssessmentInitiativesTableScreen from './screens/assessment-initiatives-table';
import AssessmentListScreen from './screens/assessment-list';
import AssessmentMenu3StatusChipsScreen from './screens/assessment-menu3-status-chips';
import AssessmentReportsPanelScreen from './screens/assessment-reports-panel';
import AssessmentReportsTableScreen from './screens/assessment-reports-table';
import CanvasKebabRestructureScreen from './screens/canvas-kebab-restructure';
import CanvasNewDocScreen from './screens/canvas-new-doc';
import CanvasToolbarMdHistoryScreen from './screens/canvas-toolbar-md-history';
import CapabilityGateDemoScreen from './screens/capability-gate-demo';
import ChatSplitTeresaRightScreen from './screens/chat-split-teresa-right';
import CrimsonMyWorkWave2Screen from './screens/crimson-mywork-wave2';
import DecisionRecordScreen from './screens/decision-record';
import DocumentStudioBlocksI18nScreen from './screens/document-studio-blocks-i18n';
import ExceleEngineRevealScreen from './screens/excele-engine-reveal';
import WordIntakeUseLlmDefaultScreen from './screens/word-intake-uselm-default';
import DocumentStudioM1SharePrimaryScreen from './screens/document-studio-m1-share-primary';
import EvFootballFieldScreen from './screens/ev-football-field';
import ExecutionChangeSignalsScreen from './screens/execution-change-signals';
import FinanceValuePanelsScreen from './screens/finance-value-panels';
import GenDeckContentHintsScreen from './screens/gen-deck-content-hints';
import GenExcelTemplatesTabScreen from './screens/gen-excel-templates-tab';
import GenWordContentHintsScreen from './screens/gen-word-content-hints';
import OdbiorScreen from './screens/odbior';
import DeckQualityBadgeScreen from './screens/deck-quality-badge';
import WordQualityBadgeScreen from './screens/word-quality-badge';
import I18nFala1SmokeScreen from './screens/i18n-fala1-smoke';
import IdeaTemplatesCatalogScreen from './screens/idea-templates-catalog';
import IdeasTeresaPanelScreen from './screens/ideas-teresa-panel';
import MelsCanvasWorkspaceScreen from './screens/melscanvas-workspace';
import ProcessFlowCanvasScreen from './screens/processflow-canvas';
import WhiteboardCanvasScreen from './screens/whiteboard-canvas';
import MindmapCanvasScreen from './screens/mindmap-canvas';
import MindmapI18nSmokeScreen from './screens/mindmap-i18n-smoke';
import ModelCatalogTableScreen from './screens/model-catalog-table';
import NavDeclutterSidebarScreen from './screens/navdeclutter-sidebar';
import NotatnikCentrumMysliScreen from './screens/notatnik-centrum-mysli';
import NotatnikOsieroconeGrafScreen from './screens/notatnik-osierocone-graf';
import PartnerSettlementsViewScreen from './screens/partner-settlements-view';
import PromptRegistryTabScreen from './screens/prompt-registry-tab';
import PublicBookingWidgetScreen from './screens/public-booking-widget';
import ReportBuilderBlockTypesScreen from './screens/report-builder-block-types';
import ReportBuilderTemplatesScreen from './screens/report-builder-templates';
import ResultsThreePairsScreen from './screens/results-three-pairs';
import RoseDangerTokenParityScreen from './screens/rose-danger-token-parity';
import SettingsCrimsonNeutralizedScreen from './screens/settings-crimson-neutralized';
import StandardKanbanCardScreen from './screens/standard-kanban-card';
import TemplateBuilderDeckScreen from './screens/template-builder-deck';
import TemplateBuilderDocScreen from './screens/template-builder-doc';
import TemplateBuilderTableScreen from './screens/template-builder-table';
import TemplateCreateWizardScreen from './screens/template-create-wizard';
import TemplateLibraryNewEntryScreen from './screens/template-library-new-entry';
import UnifiedCreateLauncherScreen from './screens/unified-create-launcher';
import Wave3CreatorsCrimsonScreen from './screens/wave3-creators-crimson';
import Wave4ChoicesCrimsonScreen from './screens/wave4-choices-crimson';
import Wave5InternalCrimsonScreen from './screens/wave5-internal-crimson';
import ZwornikProjectsScreen from './screens/zwornik-projects';
import KartaToolScreen from './screens/karta-tool';
import KartaInitiativeScreen from './screens/karta-initiative';
import KartaInsightScreen from './screens/karta-insight';
import KartaInterviewScreen from './screens/karta-interview';
import KartaDecisionScreen from './screens/karta-decision';
import KartaNotificationScreen from './screens/karta-notification';
import KartaTaskScreen from './screens/karta-task';
import PreviewZakladkiScreen from './screens/preview-4-zakladki';
import IdeaTableToolKebabScreen from './screens/idea-table-tool-kebab';
import IdeaTableToolEmptyFilterScreen from './screens/idea-table-tool-empty-filter';
import IdeaTableToolPasteScreen from './screens/idea-table-tool-paste';
import IdeaTableToolSortFilterScreen from './screens/idea-table-tool-sortfilter';
import IdeaTableToolGroupingScreen from './screens/idea-table-tool-grouping';
// VLT-003 — importem MUSI być ostatnia: każdy dev-render screen instaluje swój
// window.fetch stub jako top-level side effect przy imporcie (niezależnie od
// tego, który ?screen= jest renderowany — statyczne importy main.tsx odpalają
// WSZYSTKIE moduły). Import na końcu = mój stub owija wszystkie poprzednie
// jako fallback i jego warunki są sprawdzane PIERWSZE (patrz DZIENNIK VLT-003).
import VaultScopeSelectorScreen from './screens/vault-scope-selector';

// ── Screen registry (extensible) ──────────────────────────────────────────
const SCREENS: Record<string, { label: string; render: () => React.ReactElement }> = {
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
    label: 'DOKUMENTY — Deck W4: badge jakości (critic/M19) na kroku wyniku kreatora (&clean=1 dla 0 uwag)',
    render: () => <DeckQualityBadgeScreen />,
  },
  'word-quality-badge': {
    label: 'DOKUMENTY — Word W4: badge fabrykacji w panelu QA Document Studio (&clean=1 dla zweryfikowane)',
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
  'idea-table-tool-kebab': {
    label:
      'IDEE Table — K1 kebab wiersza (PlatformGridView, prawy-klik) — audyt-idee 2026-07-22',
    render: () => <IdeaTableToolKebabScreen />,
  },
  'idea-table-tool-paste': {
    label:
      'IDEE Table — Ctrl/Cmd+V wklejanie (PlatformGridView, Z16b domknięcie) — 2026-07-22',
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
    label: 'J23 — bg-c-accent-soft opacity bug fix (cTok): odznaka REKOMENDACJA tint vs pełny crimson',
    render: () => <AccentSoftTokenFixScreen />,
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
  'execution-change-signals': {
    label:
      'M14-wire — ExecutionChangeSignalsPanel (capacity signals · ADKAR readiness · champions), flaga changeSignals default OFF',
    render: () => <ExecutionChangeSignalsScreen />,
  },
  'assessment-list': {
    label: 'Assessment list (TRIADA: StandardModuleBar + StandardTable)',
    render: () => <AssessmentListScreen />,
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
  'navdeclutter-sidebar': {
    label:
      'ODB O5 — REALNY <Sidebar> (navDeclutterFlag, default OFF); &ff_navDeclutter=1 dla ON',
    render: () => <NavDeclutterSidebarScreen />,
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
  'mindmap-canvas': {
    label: 'IDEE — Mind Map: pełne płótno (Menu 1 + rail + kebab)',
    render: () => <MindmapCanvasScreen />,
  },
  'whiteboard-canvas': {
    label: 'Fala 8 — Whiteboard: łączniki (4-str uchwyty magnetyczne)',
    render: () => <WhiteboardCanvasScreen />,
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
};

const params = new URLSearchParams(window.location.search);
const screenKey = params.get('screen') || 'assessment-list';
const lang = params.get('lang') || 'pl';
const theme = params.get('theme') || 'light';

// Apply theme via the app's `.dark` class strategy (tailwind darkMode:'class').
const root = document.documentElement;
root.classList.toggle('dark', theme === 'dark');
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
    <DebugBoundary>{entry ? entry.render() : <Fallback />}</DebugBoundary>
  </React.StrictMode>
);
