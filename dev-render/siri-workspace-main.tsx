/**
 * A7 ISOLATED TEST HARNESS entry — see `siri-workspace.html` header. Mirrors
 * `method-workspace-main.tsx` (A5) and `mw010-vault-main.tsx`'s minimal
 * bootstrap.
 *
 * Mounts `./screens/siri-workspace` — MethodWorkspaceShell wired with real
 * SIRI data (16 dimensions, no-leapfrog, factory-observation evidence,
 * honest EVIDENCE_MISSING) via `src/method-core/methods/siri/siriWorkspaceView.ts`.
 *
 * URL params: &lang=pl|en (default pl), &theme=light|dark (default light),
 * &view=interview|split|matrix, &case=default|leapfrog.
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import SiriWorkspaceScreen from './screens/siri-workspace';

const params = new URLSearchParams(window.location.search);
const lang = params.get('lang') || 'pl';
const theme = params.get('theme') || 'light';

const root = document.documentElement;
root.classList.toggle('dark', theme === 'dark');
useAppStore.setState({ theme: theme === 'dark' ? 'dark' : 'light' } as any);
new MutationObserver(() => {
  const powinnaByc = theme === 'dark';
  if (root.classList.contains('dark') !== powinnaByc) {
    root.classList.toggle('dark', powinnaByc);
  }
}).observe(root, { attributes: true, attributeFilter: ['class'] });
document.body.style.background = 'var(--c-bg)';

void i18n.changeLanguage(lang);

const mount = document.getElementById('dev-render-root')!;

createRoot(mount).render(
  <React.StrictMode>
    <React.Suspense fallback={<div style={{ padding: 24, color: '#64748b' }}>Ładowanie…</div>}>
      <SiriWorkspaceScreen />
    </React.Suspense>
    <Toaster position="bottom-center" />
  </React.StrictMode>
);
