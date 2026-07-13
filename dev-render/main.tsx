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
import React from 'react';
import { createRoot } from 'react-dom/client';

// Real app stylesheet: Tailwind layers + the full c-* token system (light+dark).
import '../src/index.css';
// Real app i18n init (HttpBackend loads /locales/** served from repo `public/`).
import i18n from '../src/i18n';

import AssessmentListScreen from './screens/assessment-list';
import CanvasNewDocScreen from './screens/canvas-new-doc';
import EvFootballFieldScreen from './screens/ev-football-field';
import IdeasTeresaPanelScreen from './screens/ideas-teresa-panel';
import IdeaTemplatesCatalogScreen from './screens/idea-templates-catalog';
import StandardKanbanCardScreen from './screens/standard-kanban-card';
import ZwornikProjectsScreen from './screens/zwornik-projects';

// ── Screen registry (extensible) ──────────────────────────────────────────
const SCREENS: Record<string, { label: string; render: () => React.ReactElement }> = {
  'ev-football-field': {
    label: 'EV Basket Football Field (Finance)',
    render: () => <EvFootballFieldScreen />,
  },
  'assessment-list': {
    label: 'Assessment list (TRIADA: StandardModuleBar + StandardTable)',
    render: () => <AssessmentListScreen />,
  },
  'canvas-new-doc': {
    label: '#87a Canvas "+" New — 3 opcje startu (Czysty/Z szablonu/Z canvasa) → Teresa',
    render: () => <CanvasNewDocScreen />,
  },
  'standard-kanban-card': {
    label: '#75b JEDEN kanon karty kanban (StandardKanbanCard)',
    render: () => <StandardKanbanCardScreen />,
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

createRoot(mount).render(
  <React.StrictMode>{entry ? entry.render() : <Fallback />}</React.StrictMode>
);
