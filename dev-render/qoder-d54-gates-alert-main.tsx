/**
 * D-54 evidence harness entry — isolated entry point (pattern:
 * `qoder-op2a-pack-object-main.tsx`) so it never touches the shared `main.tsx`
 * screen registry, which statically references screens that do not exist at
 * this worktree's base commit.
 *
 * Mounts the REAL `AuditsMethodHub` through `screens/audyty-piec-powierzchni`
 * with `?gates=fail`, i.e. only `/audits/programs/:id/lifecycle` rejects, so
 * the real `AuditProcessesTab` renders its "Could not load next-stage gates."
 * alert inside the real shell — the node whose contrast D-54 measures.
 *
 * URL params: &lang=en|pl, &theme=light|dark, &tab=processes, &gates=fail.
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import { seedRealisticSession } from './mocks/seedStore';
import AudytyPiecPowierzchniScreen from './screens/audyty-piec-powierzchni';

const params = new URLSearchParams(window.location.search);
const lang = params.get('lang') || 'en';
const theme = params.get('theme') || 'light';

const root = document.documentElement;
root.classList.toggle('dark', theme === 'dark');
useAppStore.setState({ theme: theme === 'dark' ? 'dark' : 'light', language: lang } as any);
new MutationObserver(() => {
  const shouldBeDark = theme === 'dark';
  if (root.classList.contains('dark') !== shouldBeDark) {
    root.classList.toggle('dark', shouldBeDark);
  }
}).observe(root, { attributes: true, attributeFilter: ['class'] });
document.body.style.background = 'var(--c-bg)';

seedRealisticSession();
// The seed writes its own theme/language defaults — re-apply the harness params
// AFTER it so `&theme=dark` / `&lang=en` win.
useAppStore.setState({ theme: theme === 'dark' ? 'dark' : 'light', language: lang } as any);

void i18n.changeLanguage(lang).then(() => {
  const mount = document.getElementById('dev-render-root')!;
  createRoot(mount).render(
    <React.StrictMode>
      <React.Suspense fallback={<div style={{ padding: 24, color: '#64748b' }}>Loading…</div>}>
        <AudytyPiecPowierzchniScreen />
      </React.Suspense>
      <Toaster position="bottom-center" />
    </React.StrictMode>
  );
});
