/**
 * DEV-RENDER HARNESS entry.
 *
 * Mounts a REAL screen component with mock data + the app's real CSS
 * (Tailwind + c-* tokens) + working i18n, so the supervisor can screenshot it
 * BEFORE the owner sees it (CLAUDE.md #7). Dev-only; never ships to demo.
 *
 * URL params:
 *   ?screen=drd-light   which screen to mount (see SCREENS registry)
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
import CanvasToolbarScreen from './screens/canvas-toolbar';
import ChatLandingScreen from './screens/chat-landing';
import DrdLightScreen from './screens/drd-light';
import EvFootballFieldScreen from './screens/ev-football-field';
import ExecutionLightScreen from './screens/execution-light';
import FinanceLightScreen from './screens/finance-light';
import InsightLightScreen from './screens/insight-light';
import InterviewLightScreen from './screens/interview-light';
import InitiativesLightScreen from './screens/initiatives-light';
import MaterialsLightScreen from './screens/materials-light';
import NotebookLightScreen from './screens/notebook-light';
import ResultsLightScreen from './screens/results-light';
import StandardQuestionScreen from './screens/standard-question';
import ToolsLightScreen from './screens/tools-light';

// ── Screen registry (extensible) ──────────────────────────────────────────
const SCREENS: Record<string, { label: string; render: () => React.ReactElement }> = {
  'drd-light': { label: 'DRD Light Shell', render: () => <DrdLightScreen /> },
  'finance-light': { label: 'Finance Light Shell', render: () => <FinanceLightScreen /> },
  'insight-light': { label: 'Insight Light Shell', render: () => <InsightLightScreen /> },
  'interview-light': { label: 'Interview Light Shell', render: () => <InterviewLightScreen /> },
  'materials-light': { label: 'Materials Light Shell', render: () => <MaterialsLightScreen /> },
  'tools-light': { label: 'Tools Light Shell (Biblioteka · Sesje · Raporty)', render: () => <ToolsLightScreen /> },
  'notebook-light': { label: 'Notebook Light Shell', render: () => <NotebookLightScreen /> },
  'ev-football-field': {
    label: 'EV Basket Football Field (Finance)',
    render: () => <EvFootballFieldScreen />,
  },
  'assessment-list': {
    label: 'Assessment list (TRIADA: StandardModuleBar + StandardTable)',
    render: () => <AssessmentListScreen />,
  },
  'results-light': { label: 'Results Light Shell (KPI · ROI · OKR)', render: () => <ResultsLightScreen /> },
  'execution-light': {
    label: 'Execution Light Shell (Summary · Alerty · Reporting · Management)',
    render: () => <ExecutionLightScreen />,
  },
  'initiatives-light': {
    label: 'Initiatives Light Shell (Lista · Kanban · Kręgosłup)',
    render: () => <InitiativesLightScreen />,
  },
  'canvas-toolbar': {
    label: 'Canvas toolbar V2 (lightweight, spec #87-#87d)',
    render: () => <CanvasToolbarScreen />,
  },
  'chat-landing': {
    label: 'Chat Landing Light Shell (/chat empty state, #86/#1)',
    render: () => <ChatLandingScreen />,
  },
  'standard-question': {
    label: 'StandardQuestion (SPEC-Q · 4. format: Q-Text + Q-Level drabinka)',
    render: () => <StandardQuestionScreen />,
  },
};

const params = new URLSearchParams(window.location.search);
const screenKey = params.get('screen') || 'drd-light';
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
