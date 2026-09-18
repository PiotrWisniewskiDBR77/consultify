/**
 * OP-2a evidence harness entry — separate entry point (like
 * `method-workspace-main.tsx`) so it never touches the shared `main.tsx`
 * screen registry, which statically references screens that do not exist at
 * this worktree's base commit.
 *
 * Bootstrap: theme via the app store + `<html class="dark">` MutationObserver
 * (NOT `emulateMedia` — the app is not media-driven), EN locale, ADMIN session
 * from `seedRealisticSession()`, and the audits fake server installed BEFORE
 * the first render so the hub's mount-time fetches are answered.
 *
 * URL params: &lang=en (default en), &theme=light|dark (default light),
 * &view=list|object, &pack=pack-draft-1|pack-published-1.
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import { installOp2aFakeServer } from './mocks/qoderOp2aFakeServer';
import { seedRealisticSession } from './mocks/seedStore';
import QoderOp2aPackObjectScreen from './screens/qoder-op2a-pack-object';

const params = new URLSearchParams(window.location.search);
const lang = params.get('lang') || 'en';
const theme = params.get('theme') || 'light';

installOp2aFakeServer();

const root = document.documentElement;
root.classList.toggle('dark', theme === 'dark');
useAppStore.setState({ theme: theme === 'dark' ? 'dark' : 'light', language: lang } as any);
new MutationObserver(() => {
  const powinnaByc = theme === 'dark';
  if (root.classList.contains('dark') !== powinnaByc) {
    root.classList.toggle('dark', powinnaByc);
  }
}).observe(root, { attributes: true, attributeFilter: ['class'] });
document.body.style.background = 'var(--c-bg)';

// The OP-2a screen is flag-gated and default OFF; the harness turns it ON so
// the owner sees the gated screen (acceptance material), exactly like the
// `?ff_x=1` convention used by other gated dev-render screens.
localStorage.setItem('ff.audit_package_viewer', '1');

// `seedRealisticSession` seeds currentUser (ADMIN) + organization; the hub and
// the object page both gate their actions on that role.
seedRealisticSession();
// The seed writes its own theme/language defaults — re-apply the harness params
// AFTER it so `&theme=dark` / `&lang=en` win.
useAppStore.setState({ theme: theme === 'dark' ? 'dark' : 'light', language: lang } as any);

void i18n.changeLanguage(lang).then(() => {
  const mount = document.getElementById('dev-render-root')!;
  createRoot(mount).render(
    <React.StrictMode>
      <React.Suspense fallback={<div style={{ padding: 24, color: '#64748b' }}>Loading…</div>}>
        <QoderOp2aPackObjectScreen />
      </React.Suspense>
      <Toaster position="bottom-center" />
    </React.StrictMode>
  );
});
