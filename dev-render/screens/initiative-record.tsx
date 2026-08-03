/**
 * FORMULA-20 — dev-render host for the REAL Initiative artefakt (archetyp
 * C·Rekord, SPEC-A). Renders `<InitiativeDocumentView>`
 * (src/components/Initiatives/InitiativeDocumentView.tsx) — the CANONICAL
 * full initiative view (see src/components/Initiatives/index.ts: "P11
 * contract §2.7 — InitiativeDocumentView is the canonical full view").
 * It already implements the SPEC-A shell inline (NModeHeader = Menu 1,
 * InitiativeContext.Provider, N-mode canvas + right accordion panel) —
 * no extra wrapper needed, mount it directly like any real screen.
 *
 * MOCK STRATEGY — no per-endpoint Api patching required:
 * `InitiativeDocumentView.fetchAll()` special-cases initiative ids that
 * start with `init-showcase-` (see `isShowcaseInitiativeId` /
 * `initiativesDemoData.ts`): for those ids it short-circuits straight to a
 * fully-populated, in-memory "showcase" fixture (title, problem/target/scope
 * narrative, KPIs, RAID log, decisions, tasks, resources, budget/financial
 * fields, milestones/timeline, watchers, history, gate readiness — the exact
 * "bogaty mock" this screen needs) and `return`s before making ANY network
 * call. Zero Api/V8PlanningApi mocking needed for the primary payload — we
 * only seed `currentUser` (via `seedRealisticSession`, same as
 * melscanvas-workspace.tsx) so the dataset builder can stamp "current user"
 * into owner/sponsor slots, and pick a rich blueprint key:
 * `init-showcase-margin-leakage-recovery` (budget 95k, expectedRoi 240%,
 * 2 KPIs, financial narrative) — see initiativesDemoData.ts:334-378/800-932.
 *
 * A FEW incidental effects in the component fire unconditionally regardless
 * of showcase status (section-types, link-graph backlinks) — both already
 * have `.catch()` fallbacks to `[]` in the component itself, so a generic
 * `window.fetch` safety net for `/api/**` (pattern from melscanvas-workspace
 * / assessment-initiatives-panel) is enough to keep the console clean;
 * `/locales/**` still passes through to the real i18n backend.
 */
import React from 'react';

import { InitiativeDocumentView } from '../../src/components/Initiatives/InitiativeDocumentView';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

// Rich, financial-flavoured showcase fixture — see initiativesDemoData.ts.
const INITIATIVE_ID = 'init-showcase-margin-leakage-recovery';

// Safety net: any residual `/api/**` call (section-types, link-graph
// backlinks, and — importantly — the autosave path's `refreshInitiativeWriteTruth`,
// which fires ~3s after mount via InitiativeDocumentView's autosaveTimerRef even
// though nothing changed) resolves to an empty/neutral payload instead of hitting
// the dev-render vite server and throwing an HTML-body JSON-parse console error.
// `/locales/**` still passes through to the real fetch (i18n).
//
// V8 endpoints (`/api/v8/**`) need a DIFFERENT envelope shape than plain REST
// endpoints: `v8Get()` (src/services/api/v8/client.ts) already unwraps the
// outer `{ data: T }` envelope, and each `V8PlanningApi.getX()` then reads a
// NAMED key off that inner `T` (e.g. `getHistory` does
// `v8Get<{events:[]}>(...).then(data => data.events)` — see
// src/services/api/v8/planning.ts:379-419). A flat `{data:[],events:[]}` body
// satisfies `Array.isArray` checks on plain `Api.get()` calls but fails V8
// calls silently: `json.data` resolves to `[]`, then `[].events` is
// `undefined` — NOT an empty array — because `events` needs to live INSIDE
// `data`, not beside it. That undefined then flows, unthrown, all the way
// into `InitiativeDocumentView`'s `history` state (via
// `refreshInitiativeWriteTruth` → `getInitiativeHistoryTruth`, whose
// `.catch(() => [])` never fires since nothing rejected) and crashes the
// `initiativeNSections` useMemo's dependency array (`history.length` on
// undefined) the moment autosave completes. Confirmed via a temporary
// `console.log` in InitiativeDocumentView.tsx (reverted) that traced the
// exact undefined variable before writing this fix.
const V8_EMPTY_ENVELOPE = {
  initiative: null,
  dependencies: [],
  watchers: [],
  stakeholders: [],
  roles: [],
  history: [],
  events: [],
  comments: [],
  readiness: null,
  resources: [],
  kpis: [],
  budgetItems: [],
  tools: [],
  intangibleAssets: [],
  items: [],
};

const g = window as unknown as { __INITIATIVE_RECORD_FETCH__?: boolean };
if (!g.__INITIATIVE_RECORD_FETCH__) {
  g.__INITIATIVE_RECORD_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
    if (url.includes('/api/v8/')) {
      return new Response(JSON.stringify({ data: V8_EMPTY_ENVELOPE }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/api/')) {
      // `organizations: []` covers OrgContext's `/api/organizations/current`
      // fetch (src/contexts/OrgContext.tsx:92 does
      // `data.organizations || data || []` then calls `.find()` on the
      // result — without this key it falls through to the envelope object
      // itself, which has no `.find`, throwing inside OrgContext's own catch
      // (non-fatal, but noisy in the console).
      return new Response(JSON.stringify({ data: [], items: [], events: [], organizations: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input as RequestInfo, init);
  };
}

export function InitiativeRecordScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }} className="bg-c-bg">
          <InitiativeDocumentView
            key={`initiative-record-${INITIATIVE_ID}`}
            initiativeId={INITIATIVE_ID}
            sourceModule="initiatives"
            onBack={() => {}}
            onStatusChange={() => {}}
          />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default InitiativeRecordScreen;
