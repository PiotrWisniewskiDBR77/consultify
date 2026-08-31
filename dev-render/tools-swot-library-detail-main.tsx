/**
 * DEDYKOWANE wejście harnessu dla Tools → Dynamic SWOT → Library detail.
 *
 * Świadomie NIE korzysta z `dev-render/main.tsx` (plik współdzielony,
 * kruchy — patrz `dev-render/tools-swot-live-main.tsx` dla tego samego
 * uzasadnienia). Własne, izolowane wejście.
 *
 * URL: /tools-swot-library-detail.html?theme=light|dark&state=ready|loading|error
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

import i18n from '../src/i18n';
import ToolsSwotLibraryDetailScreen from './screens/tools-swot-library-detail';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';

document.documentElement.classList.toggle('dark', theme === 'dark');
document.documentElement.setAttribute('data-theme', theme);

const lang = params.get('lang') === 'en' ? 'en' : 'pl';

const el = document.getElementById('root');
if (el) {
  // KnownToolDetailView calls `.map()` directly on several
  // `t(key, { returnObjects: true })` results without an Array.isArray guard
  // (e.g. lines ~1261/1295/1366/1395) — if i18next hasn't finished loading
  // the `translation` namespace yet, t() returns the key path (a string) and
  // `.map` throws, blanking the screen. The real app has the identical race
  // (src/index.tsx mounts <App/> immediately after importing './i18n' with
  // no await), so this harness waits for `i18n.init` to resolve first —
  // that reproduces the STEADY STATE a real user sees once translations are
  // cached, not the cold-load race. See MANUAL_ACCEPTANCE_MPQ.md defect list
  // for the underlying gap, which is out of scope to fix broadly here.
  const mount = () => {
    createRoot(el).render(
      <React.StrictMode>
        <I18nextProvider i18n={i18n}>
          <ToolsSwotLibraryDetailScreen />
        </I18nextProvider>
      </React.StrictMode>
    );
  };
  // i18n (2026-08-31, Z-21): język ustawiamy PO 'initialized' i montujemy w .finally —
  // wzorzec z tools-outputs-insights-tab-main.tsx (naprawa 2026-08-27); changeLanguage
  // przed montażem rozstraja sekwencję czekania na init (biały ekran).
  const start = () => {
    void i18n.changeLanguage(lang).finally(mount);
  };
  if (i18n.isInitialized) {
    start();
  } else {
    i18n.on('initialized', start);
  }
}
