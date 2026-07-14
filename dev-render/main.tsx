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
import AssessmentInitiativesPanelScreen from './screens/assessment-initiatives-panel';
import AssessmentInitiativesTableScreen from './screens/assessment-initiatives-table';
import AssessmentListScreen from './screens/assessment-list';
import AssessmentReportsPanelScreen from './screens/assessment-reports-panel';
import AssessmentReportsTableScreen from './screens/assessment-reports-table';
import CanvasKebabRestructureScreen from './screens/canvas-kebab-restructure';
import CanvasNewDocScreen from './screens/canvas-new-doc';
import CanvasToolbarMdHistoryScreen from './screens/canvas-toolbar-md-history';
import CapabilityGateDemoScreen from './screens/capability-gate-demo';
import ChatSplitTeresaRightScreen from './screens/chat-split-teresa-right';
import CrimsonMyWorkWave2Screen from './screens/crimson-mywork-wave2';
import DocumentStudioBlocksI18nScreen from './screens/document-studio-blocks-i18n';
import DocumentStudioM1SharePrimaryScreen from './screens/document-studio-m1-share-primary';
import EvFootballFieldScreen from './screens/ev-football-field';
import I18nFala1SmokeScreen from './screens/i18n-fala1-smoke';
import IdeaTemplatesCatalogScreen from './screens/idea-templates-catalog';
import IdeasTeresaPanelScreen from './screens/ideas-teresa-panel';
import NotatnikCentrumMysliScreen from './screens/notatnik-centrum-mysli';
import NotatnikOsieroconeGrafScreen from './screens/notatnik-osierocone-graf';
import PublicBookingWidgetScreen from './screens/public-booking-widget';
import ResultsThreePairsScreen from './screens/results-three-pairs';
import SettingsCrimsonNeutralizedScreen from './screens/settings-crimson-neutralized';
import StandardKanbanCardScreen from './screens/standard-kanban-card';
import TemplateBuilderDeckScreen from './screens/template-builder-deck';
import TemplateBuilderDocScreen from './screens/template-builder-doc';
import TemplateBuilderTableScreen from './screens/template-builder-table';
import TemplateCreateWizardScreen from './screens/template-create-wizard';
import TemplateLibraryNewEntryScreen from './screens/template-library-new-entry';
import Wave3CreatorsCrimsonScreen from './screens/wave3-creators-crimson';
import Wave4ChoicesCrimsonScreen from './screens/wave4-choices-crimson';
import Wave5InternalCrimsonScreen from './screens/wave5-internal-crimson';
import ZwornikProjectsScreen from './screens/zwornik-projects';

// ── Screen registry (extensible) ──────────────────────────────────────────
const SCREENS: Record<string, { label: string; render: () => React.ReactElement }> = {
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
  'assessment-list': {
    label: 'Assessment list (TRIADA: StandardModuleBar + StandardTable)',
    render: () => <AssessmentListScreen />,
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
  'standard-kanban-card': {
    label: '#75b JEDEN kanon karty kanban (StandardKanbanCard)',
    render: () => <StandardKanbanCardScreen />,
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
