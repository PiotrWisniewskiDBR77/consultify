/**
 * MW-10 ISOLATED TEST HARNESS entry — see `mw010-vault.html` header for why
 * this is a SEPARATE entry point from `dev-render/main.tsx`'s shared screen
 * registry (that registry statically references an unrelated, currently
 * missing screen file; this entry never touches it).
 *
 * Mounts ONLY `./screens/vault-sejf-wnetrze` — the same production
 * components (`VaultDocumentsView` / `VaultDocumentPanel`) with the same
 * mocked-but-stateful `Api.*` methods that screen already installs. Minimal
 * bootstrap mirrors `dev-render/main.tsx`'s essentials (real Tailwind CSS,
 * real i18n, `.dark` class + store theme sync, `<Toaster/>` so
 * `toast.success(...)` calls are visible) without any of the unrelated
 * SCREENS registry.
 *
 * URL params: &lang=pl|en (default pl), &theme=light|dark (default light).
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import VaultSejfWnetrzeScreen from './screens/vault-sejf-wnetrze';

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
      <VaultSejfWnetrzeScreen />
    </React.Suspense>
    <Toaster position="bottom-center" />
  </React.StrictMode>
);
