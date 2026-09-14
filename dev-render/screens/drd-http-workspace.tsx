/**
 * T5 — dev-render harness for the REAL `DrdHttpMethodWorkspaceScreen`
 * (`src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx`, P0C
 * 2026-08-13) — the HTTP-source-of-truth DRD workspace (Live Matrix +
 * Interview Focus + save indicator), never localStorage-as-truth.
 *
 * This harness mounts the same server-authoritative component used in production
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
import { MemoryRouter } from 'react-router-dom';

import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';

import { DrdHttpMethodWorkspaceScreen } from '../../src/components/assessment/drd/DrdHttpMethodWorkspaceScreen';
import type { DrdHttpDebugForcedState } from '../../src/components/assessment/drd/DrdHttpMethodWorkspaceScreen';
import type { MethodWorkspaceViewMode } from '../../src/components/method-workspace/types';
import {
  forceNextSessionCreateError,
  installMethodCoreFakeServer,
  seedConfirmedLevels,
} from '../mocks/methodCoreFakeServer';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

/**
 * `&stage=pelna-jednostka` (P-P21, fala F2) — jednostka 1A z potwierdzonymi
 * poziomami 1-6, czyli ekran staje na OSTATNIM (7.) poziomie: dokładnie stan,
 * w którym Paweł kliknął „Next" i wracał na „Question 1 of 7". Zasiew idzie
 * przez atrapę serwera PRZED jej instalacją, bo `seedTo` komponentu umie
 * potwierdzić najwyżej dwa pierwsze poziomy.
 */
if ((new URLSearchParams(window.location.search).get('stage') || '') === 'pelna-jednostka') {
  seedConfirmedLevels('1A', [1, 2, 3, 4, 5, 6]);
}

installMethodCoreFakeServer();

/**
 * `?lag=<ms>` — sztuczne opoznienie odpowiedzi atrapy serwera. Staging ma
 * realne 200-500 ms na `/api/method/**`; atrapa odpowiada natychmiast, wiec
 * okno przejsciowego `status: 'loading'` po kazdym zapisie jest krotsze niz
 * klatka i defekt „ekran przeladowuje sesje" (P-P03) bylby niewidoczny.
 * Harness-only; produkcja nie zna tego parametru.
 */
const lagMs = Number(new URLSearchParams(window.location.search).get('lag') || 0);
if (lagMs > 0) {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/api/method')) await new Promise((r) => setTimeout(r, lagMs));
    return realFetch(input, init);
  };
}

const params = new URLSearchParams(window.location.search);
const stage = params.get('stage') || 'fresh';
const stateParam = params.get('state');
const view = (params.get('view') || 'interview') as MethodWorkspaceViewMode;

const SEED_BY_STAGE: Record<string, 'interview' | 'matrix' | 'approval' | 'frozen' | undefined> = {
  fresh: undefined,
  'pelna-jednostka': 'interview',
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
      {/* Ekran wola useNavigate() (useOpenChatWithContext) — harness musi dac Router. */}
      <FeatureFlagsProvider config={{ enableLocalOverrides: true }} showDevTools={false}>
      <MemoryRouter initialEntries={['/assessment/drd/harness']}>
      <DrdHttpMethodWorkspaceScreen
        seedTo={seedTo}
        initialViewMode={view}
        forceState={forceState}
        onExit={() => {
          // eslint-disable-next-line no-console -- harness-only visibility.
          console.log('[drd-http-workspace] onExit called');
        }}
      />
      </MemoryRouter>
      </FeatureFlagsProvider>
    </div>
  );
}

export default DrdHttpWorkspaceHarnessScreen;
