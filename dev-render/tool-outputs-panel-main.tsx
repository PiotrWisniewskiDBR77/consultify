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

// i18n (2026-08-31, Z-21): ten bootstrap nigdy nie wołał i18n.changeLanguage(),
// więc detektor przeglądarki dawał 'en' w świeżym headless renderze — dokładnie
// ta sama pułapka co naprawiona 2026-08-27 w tools-outputs-insights-tab-main.tsx
// (naprawa per wywołanie odrosła w bliźniakach). Konwencja ?lang= jak w main.tsx.
const lang = params.get('lang') === 'en' ? 'en' : 'pl';
void i18n.changeLanguage(lang);

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <React.StrictMode>
      <I18nextProvider i18n={i18n}>
        <ToolOutputsPanelScreen />
      </I18nextProvider>
    </React.StrictMode>
  );
}
