/**
 * T5 — dev-render harness for the REAL `DrdHttpMethodWorkspaceScreen`
 * (`src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx`, P0C
 * 2026-08-13) — the HTTP-source-of-truth DRD workspace (Live Matrix +
 * Interview Focus + save indicator), never localStorage-as-truth.
 *
 * Required per CLAUDE.md #7: nobody has screenshotted this component since
 * it was written — it is NOT YET wired into production
 * (`DrdMethodWorkspaceScreen.tsx` defaults to the legacy runtime, gated
 * behind `drdHttpSourceOfTruthV1`, default OFF). This harness mounts the
 * REAL component against an in-memory fake HTTP server for `/api/method/**`
 * (`dev-render/mocks/methodCoreFakeServer.ts`) — real request/response
 * shapes, no backend.
 *
 * URL params:
 *   ?theme=light|dark               (default light — see dev-render/main.tsx)
 *   &stage=fresh|inprogress|blocked|frozen   (default fresh)
 *     fresh      — session freshly created, literal 'draft' state, never
 *                  opened (seedTo=undefined — the REAL runtime always does
 *                  `prepared`+`active` as part of ANY seeding, so there is
 *                  no seedTo value that reaches 'active' with zero answers;
 *                  'draft' is the honest zero-progress state to show)
 *     inprogress — 1A fully scored + 1B partial (seedTo='matrix')
 *     blocked    — in_review with a pending Teresa proposal blocking freeze
 *                  (seedTo='approval')
 *     frozen     — frozen session with Output + Report Snapshot + Initiative
 *                  Proposal Draft (seedTo='frozen')
 *   &state=loading|error|offline|conflict    (optional — overlays a debug
 *     state on top of `stage` via the component's own `forceState` prop /
 *     a one-shot fake-server 500 for `error`; omit for the plain `stage`)
 *   &view=interview|split|matrix    (initial MethodWorkspaceShell view mode)
 */
import React from 'react';

import { DrdHttpMethodWorkspaceScreen } from '../../src/components/assessment/drd/DrdHttpMethodWorkspaceScreen';
import type { DrdHttpDebugForcedState } from '../../src/components/assessment/drd/DrdHttpMethodWorkspaceScreen';
import type { MethodWorkspaceViewMode } from '../../src/components/method-workspace/types';
import { forceNextSessionCreateError, installMethodCoreFakeServer } from '../mocks/methodCoreFakeServer';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();
installMethodCoreFakeServer();

const params = new URLSearchParams(window.location.search);
const stage = params.get('stage') || 'fresh';
const stateParam = params.get('state');
const view = (params.get('view') || 'interview') as MethodWorkspaceViewMode;

const SEED_BY_STAGE: Record<string, 'interview' | 'matrix' | 'approval' | 'frozen' | undefined> = {
  fresh: undefined,
  inprogress: 'matrix',
  blocked: 'approval',
  frozen: 'frozen',
};
const seedTo = SEED_BY_STAGE[stage];

if (stateParam === 'error') {
  // Boot itself must fail — the real bootError/ErrorRetryView path, not a
  // debugForceState overlay (which requires a session to already exist).
  forceNextSessionCreateError();
}

const FORCE_STATE_BY_PARAM: Record<string, DrdHttpDebugForcedState | undefined> = {
  loading: 'loading',
  offline: 'offline',
  conflict: 'conflict',
};
const forceState = stateParam ? FORCE_STATE_BY_PARAM[stateParam] : undefined;

export function DrdHttpWorkspaceHarnessScreen(): React.ReactElement {
  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <DrdHttpMethodWorkspaceScreen
        seedTo={seedTo}
        initialViewMode={view}
        forceState={forceState}
        onExit={() => {
          // eslint-disable-next-line no-console -- harness-only visibility.
          console.log('[drd-http-workspace] onExit called');
        }}
      />
    </div>
  );
}

export default DrdHttpWorkspaceHarnessScreen;
