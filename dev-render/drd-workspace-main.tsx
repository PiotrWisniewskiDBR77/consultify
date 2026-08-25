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
 *                      http-server|http-loading|http-conflict|http-offline|
 *                      http-recovery|http-frozen
 *             &theme=light|dark (default light)
 *             &demoSessionId=<id>  (http-* screens only — resume a session
 *                                   pre-created + role-seeded out-of-band,
 *                                   e.g. for http-frozen which needs the
 *                                   'approver' role the HTTP surface itself
 *                                   has no endpoint to grant — see
 *                                   DrdHttpMethodWorkspaceScreen.tsx header)
 *
 * The `http-*` screens are P0C (2026-08-13): they mount
 * `DrdMethodWorkspaceScreen` with `forceHttpSourceOfTruth`, so
 * `DrdHttpSessionRuntime` makes REAL fetch calls to `/api/method/...` on
 * whatever server this harness's origin is proxied/served against — start
 * the real server first (see that component's own header for the exact
 * command) and run this harness with `NODE_ENV=test`-style auth bypass so
 * the browser needs no login (see server/src/middleware/auth.middleware.ts's
 * `ENABLE_TEST_AUTH_BYPASS` — ONLY active outside production, requires an
 * explicit operator flag AND a request with no token at all, matching what
 * this harness already sends).
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import i18n from '../src/i18n';
import { FeatureFlagsProvider } from '../src/contexts/FeatureFlagsContext';
import { createDrdDemoSession } from '../src/method-core/methods/drd/drdSessionRuntime';
import { useAppStore } from '../src/store/useAppStore';
import { DrdLibraryEntryHarness } from './screens/drd-library-entry';
import { DrdMethodWorkspaceScreen } from '../src/components/assessment/drd/DrdMethodWorkspaceScreen';

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

// -- P0C (2026-08-13): HTTP source-of-truth screens ------------------------
const HTTP_SEED_BY_SCREEN: Record<string, Parameters<typeof DrdMethodWorkspaceScreen>[0]['seedTo']> = {
  'http-server': 'interview',
  'http-frozen': 'frozen',
};
const HTTP_FORCE_STATE_BY_SCREEN: Record<string, 'offline' | 'conflict' | 'recovery' | 'loading'> = {
  'http-loading': 'loading',
  'http-conflict': 'conflict',
  'http-offline': 'offline',
  'http-recovery': 'recovery',
};

// Computed once at module scope (not inside `Root`, which React.StrictMode
// intentionally double-invokes) so this doesn't silently create two
// orphaned draft sessions per load.
const draftDemoSessionId =
  screen === 'draft'
    ? (() => {
        const runtime = createDrdDemoSession({
          organizationId: 'org-demo',
          projectId: 'project-demo',
          ownerUserId: 'demo-owner-anna',
        });
        runtime.assignRole('demo-owner-anna', 'owner');
        runtime.assignRole('demo-owner-anna', 'lead_assessor');
        return runtime.sessionId;
      })()
    : null;

const mount = document.getElementById('dev-render-root')!;

// night-fixes-a (2026-08-26): this isolated harness entry (see
// drd-workspace.html's header for why it exists standalone) mounted
// `DrdMethodWorkspaceScreen` with no `FeatureFlagsProvider` in the tree —
// the screen's own `useFeatureFlagsContext()` call then throws
// "must be used within FeatureFlagsProvider" and the harness renders a
// blank page. Same fix every OTHER dev-render screen that needs flags
// already applies (see e.g. assessment-five-surfaces.tsx) — harness-only,
// never ships.
function Root(): React.ReactElement {
  if (screen === 'library') {
    return <DrdLibraryEntryHarness />;
  }
  // 2026-08-26 night-fixes-a P0 #5 verification screen: `seedSession` (used
  // by every other &screen= value) unconditionally transitions the session
  // to 'active', so none of them can reproduce the 'draft'-state screenshot
  // the night-sweep report captured (header pill "Szkic" + a duplicate
  // "⚠ Status: draft" banner). This bypasses seeding entirely, keeping the
  // session in its real freshly-created 'draft' state.
  if (screen === 'draft' && draftDemoSessionId) {
    return (
      <DrdMethodWorkspaceScreen
        demoSessionId={draftDemoSessionId}
        initialActorUserId="demo-owner-anna"
      />
    );
  }
  if (isHttpScreen) {
    return (
      <DrdMethodWorkspaceScreen
        forceHttpSourceOfTruth
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
    <FeatureFlagsProvider config={{ enableLocalOverrides: true }} showDevTools={false}>
      <React.Suspense fallback={<div style={{ padding: 24, color: '#64748b' }}>Ładowanie…</div>}>
        <Root />
      </React.Suspense>
      <Toaster position="bottom-center" />
    </FeatureFlagsProvider>
  </React.StrictMode>
);
