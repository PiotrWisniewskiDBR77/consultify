/**
 * D-73 v3 (DEC-680) — dedicated harness entry for the LIVE Insights surface
 * reproduction. Mirrors tools-outputs-insights-tab-main.tsx: default lang 'pl',
 * theme via ?theme=, i18n applied explicitly before mount.
 *
 * URL: /d73v3-insights-width-details.html?theme=light|dark&lang=pl|en
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

import i18n from '../src/i18n';
import D73V3InsightsWidthDetailsScreen from './screens/d73v3-insights-width-details';

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
            <D73V3InsightsWidthDetailsScreen />
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
