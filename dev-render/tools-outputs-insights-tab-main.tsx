/**
 * DEDYKOWANE wejście harnessu dla Tools → Outputs/Insights (DEC-118 #1).
 *
 * URL: /tools-outputs-insights-tab.html?theme=light|dark&lang=pl|en
 *
 * i18n (2026-08-27 fix): default 'pl' — this harness previously never called
 * `i18n.changeLanguage()`, so the mounted screen rendered whatever language
 * i18next's browser detector resolved (navigator/htmlTag), which in a fresh
 * headless render is 'en' even though the component itself is already fully
 * wired for Polish (`isPolish`/`t()`). Same `?lang=` convention as
 * `dev-render/main.tsx` (default 'pl' there too) — apply it explicitly here
 * instead of relying on browser-locale detection, which produced the
 * all-English screenshot this fix addresses.
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

import i18n from '../src/i18n';

import ToolsOutputsInsightsTabScreen from './screens/tools-outputs-insights-tab';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
const lang = params.get('lang') === 'en' ? 'en' : 'pl';

document.documentElement.classList.toggle('dark', theme === 'dark');
document.documentElement.setAttribute('data-theme', theme);
document.documentElement.setAttribute('lang', lang);

const el = document.getElementById('root');
if (el) {
  const mount = () => {
    void i18n.changeLanguage(lang).finally(() => {
      createRoot(el).render(
        <React.StrictMode>
          <I18nextProvider i18n={i18n}>
            <ToolsOutputsInsightsTabScreen />
          </I18nextProvider>
        </React.StrictMode>
      );
    });
  };
  if (i18n.isInitialized) {
    mount();
  } else {
    i18n.on('initialized', mount);
  }
}
