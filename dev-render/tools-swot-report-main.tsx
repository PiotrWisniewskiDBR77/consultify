/**
 * DEDYKOWANE wejście harnessu dla Tools → Dynamic SWOT → Report/Presentation.
 *
 * Świadomie NIE korzysta z `dev-render/main.tsx`: ten plik na baseline
 * `origin/demo` importuje `./screens/tools-sesja-wyjscie`, którego w repo nie
 * ma (ani w worktree, ani w głównym drzewie — 137 ekranów, brak tego jednego).
 * Wywala to cały harness błędem 500 na etapie import-analysis. To defekt
 * ZASTANY, nie regresja tej gałęzi, a `main.tsx` jest plikiem współdzielonym
 * z innymi sesjami — dlatego go nie ruszam i wchodzę własnym wejściem.
 *
 * URL:
 *   /tools-swot-report.html?theme=light|dark&kind=report|presentation
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import ToolsSwotReportScreen from './screens/tools-swot-report';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';

// Strategia motywu jak w aplikacji: klasa `.dark` na <html>.
document.documentElement.classList.toggle('dark', theme === 'dark');
document.documentElement.setAttribute('data-theme', theme);

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <React.StrictMode>
      <ToolsSwotReportScreen />
    </React.StrictMode>
  );
}
