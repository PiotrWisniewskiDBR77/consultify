/**
 * DEDYKOWANE wejście harnessu dla Tools → Outputs/Insights (DEC-118 #1).
 *
 * URL: /tools-outputs-insights-tab.html?theme=light|dark
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

import i18n from '../src/i18n';

import ToolsOutputsInsightsTabScreen from './screens/tools-outputs-insights-tab';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';

document.documentElement.classList.toggle('dark', theme === 'dark');
document.documentElement.setAttribute('data-theme', theme);

const el = document.getElementById('root');
if (el) {
  const mount = () => {
    createRoot(el).render(
      <React.StrictMode>
        <I18nextProvider i18n={i18n}>
          <ToolsOutputsInsightsTabScreen />
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
