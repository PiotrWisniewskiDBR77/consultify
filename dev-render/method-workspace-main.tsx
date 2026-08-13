/**
 * A5 ISOLATED TEST HARNESS entry — see `method-workspace.html` header for why
 * this is a SEPARATE entry point from `dev-render/main.tsx`'s shared screen
 * registry (that registry statically references an unrelated, currently
 * missing screen file at this worktree's base commit; this entry never
 * touches it). Mirrors `mw010-vault-main.tsx`'s minimal bootstrap.
 *
 * Mounts ONLY `./screens/method-workspace` — the same MethodWorkspaceShell
 * used by the shared registry entry, once that gap is fixed elsewhere.
 *
 * URL params: &lang=pl|en (default pl), &theme=light|dark (default light),
 * &view=interview|split|matrix, &state=default|resolution|savefailed|teresaRich.
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import MethodWorkspaceScreen from './screens/method-workspace';

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
      <MethodWorkspaceScreen />
    </React.Suspense>
    <Toaster position="bottom-center" />
  </React.StrictMode>
);
