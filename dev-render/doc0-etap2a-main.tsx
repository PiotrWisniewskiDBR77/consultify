/**
 * DOC-0 etap 2a (DEC-593) — dedicated harness entry (pattern:
 * `doc0-document-flow-main.tsx`, `qoder-op2a-pack-object-main.tsx`): its own
 * entry instead of an append to the shared `dev-render/main.tsx`.
 *
 * Theme through the app store + `<html class="dark">` (NOT `emulateMedia`),
 * EN locale, session seeded, transport stubbed inside the screen module.
 *
 * The visible path is rewritten BEFORE React mounts so the real
 * `BrowserRouter` inside `AppProviders` starts on the entry's own address
 * (technique from `mywork-projects-tab-main.tsx`); the harness query string is
 * preserved, so `?ff_doc0_document_viewer=1|0` keeps its top precedence in
 * `documentViewerFlag`.
 *
 * URL: /doc0-etap2a.html?lang=en&theme=light|dark&ff_doc0_document_viewer=1&entry=url|initiative|notebook|rezultaty
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import i18n from '../src/i18n';
import { DOCUMENT_VIEWER_FLAG_KEYS } from '../src/components/documents/documentViewerFlag';
import { useAppStore } from '../src/store/useAppStore';
import Doc0Etap2aDeepLinkScreen, {
  DOC0_ETAP2A_TARGETS,
} from './screens/doc0-etap2a-deep-link';
import { seedRealisticSession } from './mocks/seedStore';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
const lang = params.get('lang') === 'pl' ? 'pl' : 'en';
const entry = params.get('entry') || 'url';

// A query-only flag does NOT survive programmatic navigation: every caller does
// `navigate('/documents/<id>')` without the harness query, so the route's own
// flag read would fall to the env default OFF and redirect to the list. The
// query is mirrored into localStorage (precedence 2, the key production reads)
// so one harness URL decides ON/OFF for the whole click chain.
const flagQuery = params.get(DOCUMENT_VIEWER_FLAG_KEYS.query);
if (flagQuery === '1' || flagQuery === '0') {
  localStorage.setItem(DOCUMENT_VIEWER_FLAG_KEYS.localStorage, flagQuery);
}

const START_PATH: Record<string, string> = {
  url: `/documents/${DOC0_ETAP2A_TARGETS.ARTIFACT_ID}`,
  initiative: `/initiatives/${'ini-doc0-1'}`,
  notebook: '/my-work',
  rezultaty: `/cases/${'case-doc0-1'}`,
};

seedRealisticSession();

const root = document.documentElement;
root.classList.toggle('dark', theme === 'dark');
root.setAttribute('data-theme', theme);
useAppStore.setState({ theme, language: lang } as never);
new MutationObserver(() => {
  const shouldBeDark = theme === 'dark';
  if (root.classList.contains('dark') !== shouldBeDark) {
    root.classList.toggle('dark', shouldBeDark);
  }
}).observe(root, { attributes: true, attributeFilter: ['class'] });
document.body.style.background = 'var(--c-bg)';

window.history.replaceState({}, '', (START_PATH[entry] || START_PATH.url) + window.location.search);

const mount = document.getElementById('dev-render-root')!;

void i18n.changeLanguage(lang).then(() => {
  createRoot(mount).render(
    <React.StrictMode>
      <React.Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
        <Doc0Etap2aDeepLinkScreen />
      </React.Suspense>
      <Toaster position="bottom-center" />
    </React.StrictMode>
  );
});
