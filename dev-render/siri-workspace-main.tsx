/**
 * S5 ISOLATED TEST HARNESS entry — see `siri-workspace.html` header.
 *
 * Mounts the REAL `SiriHttpMethodWorkspaceScreen`
 * (src/components/assessment/siri/) making genuine fetch calls to
 * `/api/method/...` against whatever server this harness's origin is
 * proxied/served against. Start the real server first (see
 * `SiriHttpMethodWorkspaceScreen.tsx`'s header / the S5 mission report for
 * the exact command) with `ENABLE_TEST_AUTH_BYPASS=true` so the browser
 * needs no login.
 *
 * URL params: &screen=matrix|leapfrog|evidence|frozen|tier
 *             &view=interview|split|matrix (default: split for matrix/leapfrog/
 *                    evidence, matrix for frozen/tier — override any time)
 *             &theme=light|dark (default light)
 *             &demoSessionId=<id>
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import type { MethodWorkspaceViewMode } from '../src/components/method-workspace/types';
import { SiriHttpMethodWorkspaceScreen, type SiriSeedTo } from '../src/components/assessment/siri/SiriHttpMethodWorkspaceScreen';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') || 'light';
const screen = params.get('screen') || 'matrix';
const demoSessionIdParam = params.get('demoSessionId') || undefined;
const viewParam = params.get('view') as MethodWorkspaceViewMode | null;

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

// Deterministic per-load: wipe any prior demo session state so every FRESH
// (seeded) screenshot starts from the same seed instead of accumulating
// events. Skipped when resuming an EXISTING session via `demoSessionId` —
// that path exists specifically to demonstrate reopening/restarting reading
// from the server, and must not also erase this profile's own
// `outputIdCacheKey` pointer (see `siriHttpSessionRuntime.ts` — the server
// has no "list outputs by session" endpoint, so the frozen Output pointer
// only survives in localStorage; wiping it here would make every reopen
// look like the documented output-pointer gap even when it isn't one).
if (!demoSessionIdParam) {
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith('siri-method-core:') || key.startsWith('method-workspace:')) {
      window.localStorage.removeItem(key);
    }
  }
}

const SEED_BY_SCREEN: Record<string, SiriSeedTo> = {
  matrix: 'matrix',
  leapfrog: 'leapfrog',
  evidence: 'evidence',
  frozen: 'frozen',
  tier: 'tier',
};

const DEFAULT_VIEW_BY_SCREEN: Record<string, MethodWorkspaceViewMode> = {
  matrix: 'split',
  leapfrog: 'matrix',
  evidence: 'split',
  frozen: 'matrix',
  tier: 'matrix',
};

const mount = document.getElementById('dev-render-root')!;

function Root(): React.ReactElement {
  return (
    <SiriHttpMethodWorkspaceScreen
      demoSessionId={demoSessionIdParam}
      // ★ Only seed a FRESH session. `seedHttpSession()` unconditionally
      // opens with `transition('prepared')` + `transition('active')` — if a
      // `seedTo` were also supplied while RESUMING an existing session via
      // `demoSessionId` (e.g. this URL simply omitted `&screen=`), those
      // transitions would re-fire against an already-active/frozen session,
      // corrupting its optimistic-concurrency version and producing
      // spurious 409s. Confirmed the hard way: this exact bug made the
      // `07-output-after-restart.png` reopen capture flaky/stuck.
      seedTo={demoSessionIdParam ? undefined : (SEED_BY_SCREEN[screen] ?? 'matrix')}
      initialViewMode={viewParam ?? DEFAULT_VIEW_BY_SCREEN[screen] ?? 'split'}
    />
  );
}

createRoot(mount).render(
  <React.StrictMode>
    <React.Suspense fallback={<div style={{ padding: 24, color: '#64748b' }}>Ładowanie…</div>}>
      <Root />
    </React.Suspense>
    <Toaster position="bottom-center" />
  </React.StrictMode>
);
