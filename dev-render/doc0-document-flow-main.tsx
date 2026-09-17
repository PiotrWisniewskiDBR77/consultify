/**
 * DEDYKOWANE wejście harnessu dla DOC-0 etap 1 (b) (DEC-593) — wzorzec
 * `materials-registry-main.tsx`: własny entry zamiast dopisku do
 * `dev-render/main.tsx` (współdzielony plik, dwa tory dopisują równolegle).
 *
 * Motyw przez store aplikacji + klasę `.dark` (nie `emulateMedia`) — reguła
 * zrzutów stanowiska C.
 *
 * URL: /doc0-document-flow.html?lang=en&theme=light|dark&ff_doc0_document_viewer=1&case=list|open
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import Doc0DocumentFlowScreen from './screens/doc0-document-flow';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
const lang = params.get('lang') === 'pl' ? 'pl' : 'en';

const root = document.documentElement;
root.classList.toggle('dark', theme === 'dark');
root.setAttribute('data-theme', theme);
useAppStore.setState({ theme });

new MutationObserver(() => {
  const shouldBeDark = theme === 'dark';
  if (root.classList.contains('dark') !== shouldBeDark) {
    root.classList.toggle('dark', shouldBeDark);
  }
}).observe(root, { attributes: true, attributeFilter: ['class'] });
document.body.style.background = 'var(--c-bg)';

const el = document.getElementById('root');

async function boot() {
  await i18n.changeLanguage(lang);
  if (!el) return;
  createRoot(el).render(
    <React.StrictMode>
      <Doc0DocumentFlowScreen />
    </React.StrictMode>
  );
}

void boot();
