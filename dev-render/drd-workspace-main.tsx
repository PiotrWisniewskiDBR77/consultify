/**
 * A6 ISOLATED TEST HARNESS entry — see `drd-workspace.html` header.
 *
 * Mounts the REAL `DrdMethodWorkspaceScreen` / `DrdLibraryEntryHarness`
 * (src/components/assessment/drd/) with a freshly-seeded, deterministic
 * `DrdSessionRuntime` per load — no login, no backend, no mocked fetch
 * (the runtime is genuinely localStorage-backed, not a fetch stub).
 *
 * URL params: &screen=library|interview|matrix|teresa|approval|output|
 *                      report|initiative|reopen
 *             &theme=light|dark (default light)
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import { DrdLibraryEntryHarness } from './screens/drd-library-entry';
import { DrdMethodWorkspaceScreen } from '../src/components/assessment/drd/DrdMethodWorkspaceScreen';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') || 'light';
const screen = params.get('screen') || 'interview';

const root = document.documentElement;
root.classList.toggle('dark', theme === 'dark');
useAppStore.setState({ theme: theme === 'dark' ? 'dark' : 'light' } as any);
new MutationObserver(() => {
  const shouldBeDark = theme === 'dark';
  if (root.classList.contains('dark') !== shouldBeDark) {
    root.classList.toggle('dark', shouldBeDark);
  }
}).observe(root, { attributes: true, attributeFilter: ['class'] });
document.body.style.background = 'var(--c-bg)';

void i18n.changeLanguage('pl');

// Deterministic per-load: wipe any prior demo session state so every
// screenshot starts from the same seed instead of accumulating events
// across repeated harness reloads.
for (const key of Object.keys(window.localStorage)) {
  if (key.startsWith('drd-method-workspace:')) window.localStorage.removeItem(key);
}

const SEED_BY_SCREEN: Record<string, Parameters<typeof DrdMethodWorkspaceScreen>[0]['seedTo']> = {
  interview: 'interview',
  matrix: 'matrix',
  teresa: 'teresa',
  approval: 'approval',
  output: 'frozen',
  report: 'frozen',
  initiative: 'frozen',
  reopen: 'reopened',
};

const mount = document.getElementById('dev-render-root')!;

function Root(): React.ReactElement {
  if (screen === 'library') {
    return <DrdLibraryEntryHarness />;
  }
  return <DrdMethodWorkspaceScreen seedTo={SEED_BY_SCREEN[screen] ?? 'interview'} />;
}

createRoot(mount).render(
  <React.StrictMode>
    <React.Suspense fallback={<div style={{ padding: 24, color: '#64748b' }}>Ładowanie…</div>}>
      <Root />
    </React.Suspense>
    <Toaster position="bottom-center" />
  </React.StrictMode>
);
