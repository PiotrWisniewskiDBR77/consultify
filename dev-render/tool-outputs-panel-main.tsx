/**
 * DEDYKOWANE wejście harnessu dla ToolOutputsPanel (S4 read/list/reopen).
 * Ten sam powód co tools-swot-report-main.tsx: NIE korzysta z dev-render/main.tsx
 * (współdzielony plik z zastanym, niezwiązanym defektem importu) — własne
 * wejście, żeby zrzut powstał ZANIM Piotr zobaczy ekran (CLAUDE.md #7).
 *
 * URL: /tool-outputs-panel.html?theme=light|dark
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

import i18n from '../src/i18n';

import ToolOutputsPanelScreen from './screens/tool-outputs-panel';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';

document.documentElement.classList.toggle('dark', theme === 'dark');
document.documentElement.setAttribute('data-theme', theme);

const el = document.getElementById('root');
if (el) {
  // H1 (SPEC-A shell fala): `ToolOutputsView` renders `NModeHeader`
  // (useTranslation) — wait for init like the session-workspace harness to
  // avoid a raw-key flash if HttpBackend hasn't resolved yet on first paint.
  const mount = () => {
    createRoot(el).render(
      <React.StrictMode>
        <I18nextProvider i18n={i18n}>
          <ToolOutputsPanelScreen />
        </I18nextProvider>
      </React.StrictMode>
    );
  };
  if (i18n.isInitialized) {
    mount();
  } else {
    i18n.on('initialized', mount);
  }
}
