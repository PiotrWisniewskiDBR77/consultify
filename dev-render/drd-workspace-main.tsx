/**
 * A6 ISOLATED TEST HARNESS entry — see `drd-workspace.html` header.
 *
 * Mounts the REAL `DrdMethodWorkspaceScreen` / `DrdLibraryEntryHarness`
 * (src/components/assessment/drd/) with a freshly-seeded, deterministic
 * `DrdSessionRuntime` per load — no login, no backend, no mocked fetch
 * (the runtime is genuinely localStorage-backed, not a fetch stub).
 *
 * URL params: &screen=library|interview|matrix|teresa|approval|output|
 *                      report|initiative|reopen|
 *                      http-server|http-saving|http-saved|http-offline|
 *                      http-recovery-draft|http-conflict|http-reconnecting|
 *                      http-recovered|
 *                      http-loading|http-recovery|http-frozen (retained,
 *                      pre-CEL-4 aliases — see HTTP_FORCE_STATE_BY_SCREEN)
 *             &theme=light|dark (default light)
 *             &demoSessionId=<id>  (http-* screens only — resume a session
 *                                   pre-created + role-seeded out-of-band,
 *                                   e.g. for http-frozen which needs the
 *                                   'approver' role the HTTP surface itself
 *                                   has no endpoint to grant — see
 *                                   DrdHttpMethodWorkspaceScreen.tsx header)
 *
 * The `http-*` screens are P0C (2026-08-13; extended to the full eight-state
 * offline/recovery model by S3, CEL 4, 2026-08-13). They mount
 * `DrdHttpMethodWorkspaceScreen` DIRECTLY (not through the
 * `DrdMethodWorkspaceScreen` flag gate) for two reasons: (1) that gate's own
 * `forceState` prop type is intentionally narrower (out of this agent's
 * scope — see that component's header) and would not admit the CEL 4
 * states (`saving`/`saved`/`recovery_draft`/`reconnecting`/`recovered`)
 * without editing a file this agent must not touch; (2) it removes one
 * layer of indirection for a harness whose entire job is determinism.
 * `DrdHttpSessionRuntime` still makes REAL fetch calls to `/api/method/...`
 * on whatever server this harness's origin is proxied/served against —
 * start the real server first (see that component's own header for the
 * exact command) and run this harness with `NODE_ENV=test`-style auth
 * bypass so the browser needs no login (see
 * server/src/middleware/auth.middleware.ts's `ENABLE_TEST_AUTH_BYPASS` —
 * ONLY active outside production, requires an explicit operator flag AND a
 * request with no token at all, matching what this harness already sends).
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import { DrdLibraryEntryHarness } from './screens/drd-library-entry';
import { DrdMethodWorkspaceScreen } from '../src/components/assessment/drd/DrdMethodWorkspaceScreen';
import {
  DrdHttpMethodWorkspaceScreen,
  type DrdHttpDebugForcedState,
} from '../src/components/assessment/drd/DrdHttpMethodWorkspaceScreen';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') || 'light';
const screen = params.get('screen') || 'interview';
const isHttpScreen = screen.startsWith('http-');
const demoSessionIdParam = params.get('demoSessionId') || undefined;

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
  if (key.startsWith('drd-method-workspace:') || key.startsWith('method-core:')) {
    window.localStorage.removeItem(key);
  }
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

const VIEW_MODE_BY_SCREEN: Record<string, Parameters<typeof DrdMethodWorkspaceScreen>[0]['initialViewMode']> = {
  matrix: 'matrix',
};

// Approval screenshot must show the ACTOR who is allowed to freeze —
// switching to the approver identity is the whole point of that screenshot.
const ACTOR_BY_SCREEN: Record<string, string> = {
  approval: 'demo-approver-anna',
};

// -- P0C (2026-08-13) / CEL 4 (S3, 2026-08-13): HTTP source-of-truth screens
//
// `http-server` seeds through the interview lifecycle for real (proves a
// genuinely fresh, non-forced SERVER state — none of the other seven need a
// real seed, they overlay `forceState` on top of a freshly created session).
const HTTP_SEED_BY_SCREEN: Record<string, Parameters<typeof DrdMethodWorkspaceScreen>[0]['seedTo']> = {
  'http-server': 'interview',
  'http-frozen': 'frozen',
};

// The eight CEL 4 screenshot names (01..08) plus the pre-CEL-4 aliases this
// harness already had (`http-loading`/`http-recovery`/`http-offline` map to
// the SAME underlying `forceState` values as their CEL 4 equivalents, kept
// so any existing reference to the old names still resolves).
const HTTP_FORCE_STATE_BY_SCREEN: Record<string, DrdHttpDebugForcedState> = {
  // 01-server.png: no forceState — a real, freshly-seeded 'ready' session IS
  // the SERVER state; forcing it would defeat the point of that screenshot.
  'http-saving': 'saving',
  'http-saved': 'saved',
  'http-offline': 'offline',
  'http-recovery-draft': 'recovery_draft',
  'http-conflict': 'conflict',
  'http-reconnecting': 'reconnecting',
  'http-recovered': 'recovered',
  // Retained pre-CEL-4 aliases.
  'http-loading': 'loading',
  'http-recovery': 'recovery',
};

const mount = document.getElementById('dev-render-root')!;

function Root(): React.ReactElement {
  if (screen === 'library') {
    return <DrdLibraryEntryHarness />;
  }
  if (isHttpScreen) {
    return (
      <DrdHttpMethodWorkspaceScreen
        demoSessionId={demoSessionIdParam}
        seedTo={HTTP_SEED_BY_SCREEN[screen]}
        forceState={HTTP_FORCE_STATE_BY_SCREEN[screen]}
      />
    );
  }
  return (
    <DrdMethodWorkspaceScreen
      seedTo={SEED_BY_SCREEN[screen] ?? 'interview'}
      initialViewMode={VIEW_MODE_BY_SCREEN[screen]}
      initialActorUserId={ACTOR_BY_SCREEN[screen]}
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
