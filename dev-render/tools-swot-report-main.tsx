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
 *
 * H1 (SPEC-A shell fala, 2026-08-13): `kind=presentation` teraz montuje
 * `ToolReportViewerShell`, który (przez `NModeHeader`) woła
 * `useTranslation()` — stąd `I18nextProvider` + czekanie na `i18n.init()`
 * (ten sam wzorzec co `tools-swot-session-workspace-main.tsx`, race z
 * HttpBackend). `kind=report` (bare `ToolReportView`) samo w sobie nie
 * używa i18n, ale prowadzenie jednego wejścia dla obu jest prostsze i
 * bezpieczniejsze niż rozjazd dwóch montaży.
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

import i18n from '../src/i18n';

import ToolsSwotReportScreen from './screens/tools-swot-report';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';

// Strategia motywu jak w aplikacji: klasa `.dark` na <html>.
document.documentElement.classList.toggle('dark', theme === 'dark');
document.documentElement.setAttribute('data-theme', theme);

const el = document.getElementById('root');
if (el) {
  const mount = () => {
    createRoot(el).render(
      <React.StrictMode>
        <I18nextProvider i18n={i18n}>
          <ToolsSwotReportScreen />
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
