/**
 * DEDYKOWANE wejście harnessu dla Tools → Dynamic SWOT → Initiative Proposal.
 *
 * Świadomie NIE korzysta z `dev-render/main.tsx` (plik współdzielony,
 * kruchy). Własne, izolowane wejście — patrz `tools-swot-live-main.tsx` dla
 * tego samego uzasadnienia. Czeka na `i18n.init()` przed montażem (patrz
 * `tools-swot-library-detail-main.tsx` dla wyjaśnienia race'u z HttpBackend).
 *
 * URL: /tools-swot-initiative-proposal.html?theme=light|dark
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

import i18n from '../src/i18n';

import ToolsSwotInitiativeProposalScreen from './screens/tools-swot-initiative-proposal';

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
          <ToolsSwotInitiativeProposalScreen />
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
