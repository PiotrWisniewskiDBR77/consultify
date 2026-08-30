/**
 * DEDYKOWANE wejście harnessu dla Tools → Dynamic SWOT → Session Workspace.
 *
 * Świadomie NIE korzysta z `dev-render/main.tsx` (plik współdzielony,
 * kruchy). Czeka na `i18n.init()` przed montażem — patrz
 * `tools-swot-library-detail-main.tsx` dla wyjaśnienia race'u z HttpBackend.
 *
 * URL: /tools-swot-session-workspace.html?theme=light|dark
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

import i18n from '../src/i18n';

import ToolsSwotSessionWorkspaceScreen from './screens/tools-swot-session-workspace';
import { useAppStore } from '../src/store/useAppStore';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';

document.documentElement.classList.toggle('dark', theme === 'dark');
document.documentElement.setAttribute('data-theme', theme);
// Naprawa 2026-08-30 (odbiór „prehistoryczna karta"): ekran montuje teraz
// REALNY `<AppProviders>` (patrz screens/tools-swot-session-workspace.tsx),
// który zawiera `ThemeSync` — komponent czytający `useAppStore.theme` i
// nadpisujący klasę `.dark` na <html> w `useLayoutEffect`. Bez tej linii
// ThemeSync wygrywa wyścig z powyższym `classList.toggle` i `?theme=dark`
// po cichu wraca do jasnego (ten sam wzorzec co `dev-render/main.tsx:1628`).
useAppStore.setState({ theme });

const el = document.getElementById('root');
if (el) {
  const mount = () => {
    createRoot(el).render(
      <React.StrictMode>
        <I18nextProvider i18n={i18n}>
          <ToolsSwotSessionWorkspaceScreen />
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
