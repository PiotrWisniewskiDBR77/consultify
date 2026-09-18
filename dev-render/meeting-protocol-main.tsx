/**
 * DEDYKOWANE wejście harnessu dla MTG-2a (DEC-607) — wzorzec
 * `doc0-document-flow-main.tsx`: własny entry zamiast dopisku do wspólnego
 * `dev-render/main.tsx`. Motyw przez store aplikacji + klasę `.dark`
 * (nie `emulateMedia`) — reguła zrzutów stanowiska.
 *
 * URL: /meeting-protocol.html?lang=en&theme=light|dark&case=draft|approved
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import MeetingProtocolScreen from './screens/meeting-protocol';

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
      <MeetingProtocolScreen />
    </React.StrictMode>
  );
}

void boot();
