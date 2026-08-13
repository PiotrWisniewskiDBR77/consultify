/**
 * A7 ISOLATED TEST HARNESS entry for the SIRI TIER screen. See
 * `siri-tier.html` header. Mounts `./screens/siri-tier` — a standalone view,
 * deliberately NOT `MethodWorkspaceShell` (ASSESSMENT_KB_SIRI.md §4).
 *
 * URL params: &lang=pl|en (default pl), &theme=light|dark (default light),
 * &frozen=1|0, &flag=1|0, &horizon=strategic|tactical|operational.
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import SiriTierScreen from './screens/siri-tier';

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
      <SiriTierScreen />
    </React.Suspense>
  </React.StrictMode>
);
