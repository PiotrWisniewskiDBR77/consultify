/**
 * DEDYKOWANE wejście harnessu dla Tools → Dynamic SWOT → Live Artifact (S2).
 *
 * Świadomie NIE korzysta z `dev-render/main.tsx` (plik współdzielony z innymi
 * sesjami, kruchy — patrz `dev-render/tools-swot-report-main.tsx` dla tego
 * samego uzasadnienia). Własne, izolowane wejście.
 *
 * URL: /tools-swot-live.html?theme=light|dark
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import ToolsSwotLiveScreen from './screens/tools-swot-live';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';

// Strategia motywu jak w aplikacji: klasa `.dark` na <html>.
document.documentElement.classList.toggle('dark', theme === 'dark');
document.documentElement.setAttribute('data-theme', theme);

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <React.StrictMode>
      <ToolsSwotLiveScreen />
    </React.StrictMode>
  );
}
