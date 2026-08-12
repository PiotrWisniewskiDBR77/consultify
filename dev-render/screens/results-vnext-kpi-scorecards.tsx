/**
 * RN-G2 P1 #8 — dev-render host for the REAL
 * `/results/kpi/scorecards/:scorecardId` route
 * (`../../src/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage.tsx`).
 *
 * RN-G2 UI OQ-UI-I FIX (`docs/product/results-vnext/RN_G2_OPEN_QUESTIONS_UI.md`):
 * this screen previously reassembled BOTH the "Scorecards" Menu 2 tab on
 * `/results/kpi` AND the detail route from `ResultsVNextRegistryShell` +
 * `kpiScorecardPresenters.tsx` builder functions fed by hand-built props —
 * a second implementation, not the shipped ones. The LIST half of that is
 * now redundant, not converted: `results-vnext-kpi-registry.tsx` already
 * mounts the REAL `ResultsKpiRegistryPage`, whose own "Karty wyników" pill
 * (RN-G2 P1 #8) IS this scorecard registry — a second harness screen for the
 * same production component would prove nothing new. This screen now
 * mounts the REAL `ResultsKpiScorecardDetailPage` — the ONE piece of this
 * package `results-vnext-kpi-registry.tsx` cannot reach (that screen has no
 * route to a specific `:scorecardId`) — inside a `MemoryRouter` with the
 * real route pattern (`ROUTES.RESULTS_KPI.SCORECARD`), `Api.get`/`Api.post`
 * stubbed for `/vnext/results/kpi/scorecards*` (same `Api` client
 * `kpiScorecardApi.ts` uses, see that file's header — NOT `window.fetch`,
 * mirrors `results-vnext-kpi-registry.tsx`'s own pattern). `onClose`
 * throughout (item/snapshot preview, back-from-forbidden) is the REAL one
 * the page wires via `setSelectedItemId(null)`/`setSelectedSnapshotId(null)`
 * etc. — nothing here overrides it with a no-op (OQ-UI-I finding — closed
 * for this screen).
 *
 * URL params:
 *   ?scorecardId=sc-1|sc-2|sc-3|sc-4   which mock record to route to
 *                                       (default sc-2) — sc-1 = draft, 0
 *                                       members (demonstrates the real
 *                                       NO_MEMBERS activation lock); sc-2 =
 *                                       active, 3 items, 3 snapshots (all
 *                                       lifecycle snapshot states); sc-3 =
 *                                       suspended; sc-4 = archived (terminal
 *                                       lock); anything else -> 404 ->
 *                                       forbidden NO_VISIBILITY_RECORD
 *   &ff=off                            force the flag OFF (disabled panel)
 *
 * Menu 2 tab defaults to "Pozycje" (Items), same as the real page — no prop
 * exists to override it (state is internal to `ResultsKpiScorecardDetailPage`),
 * so switching to "Migawki przeglądu" is a click, not a URL param.
 *
 * Golden-flow click chain (see acceptance report for the actual run):
 *   1. Menu2 tab "Pozycje" -> row click -> preview -> Esc closes it
 *   2. Menu2 tab "Migawki przeglądu" -> chip "Opublikowane" -> row click
 *   3. kebab on an item -> "Otwórz KPI" (navigates to /results/kpi?kpiId=)
 *   4. record-overview preview (no row selected) -> lifecycle action
 *   5. RN-G5 §G #8 additions: Menu1 primaryCta "Dodaj KPI" -> AddKpiScorecardItemModal
 *      -> submit -> real POST .../items -> list refreshes
 *   6. item kebab -> "Przenieś w górę/dół" -> real PATCH .../items/reorder
 *   7. item kebab -> "Usuń pozycję" -> RemoveKpiScorecardItemDialog -> submit
 *      -> real DELETE .../items/:itemId (window.fetch, NOT Api.delete — see
 *      kpiScorecardApi.ts's `deleteWithBody` doc comment)
 *   8. Menu2 tab "Migawki przeglądu" -> Menu1 primaryCta "Nowa migawka" ->
 *      CreateKpiScorecardReviewSnapshotModal -> submit -> real POST
 *      .../review-snapshots
 *   9. draft snapshot row kebab -> "Opublikuj" -> PublishKpiScorecardReviewSnapshotDialog
 *      -> submit -> real POST .../review-snapshots/:id/publish
 *
 * RN-G5 §G #8 NOTE: `Api.get`/`Api.post`/`Api.patch` are stubbed below (same
 * convention as the pre-existing lifecycle stub) — `Api.delete` is NOT used
 * by `removeKpiScorecardItem` (it never sends a body; the real DELETE
 * .../items/:itemId endpoint requires one) so a `window.fetch` stub is
 * ADDED alongside the `Api.*` ones, scoped to exactly that one URL pattern.
 */
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ResultsKpiScorecardDetailPage } from '../../src/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage';
import { Api } from '../../src/services/api';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const params = new URLSearchParams(window.location.search);
const mockScorecardId = params.get('scorecardId') || 'sc-2';
const flagOff = params.get('ff') === 'off';

if (!flagOff) {
  try {
    window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
  } catch {
    // no-op — dev-render only
  }
}

// ==========================================================================
// Mock scorecards — one per lifecycle status, sc-1 deliberately has ZERO
// items (demonstrates the real NO_MEMBERS activation lock).
// ==========================================================================

const MOCK_SCORECARDS: Record<string, any> = {
  'sc-1': {
    scorecardId: 'sc-1', organizationId: 'org-dbr77-demo', name: 'Karta wyników — Produkcja (szkic)',
    description: 'Szkic karty wyników linii produkcyjnej, jeszcze bez pozycji.', scopeType: 'process',
    scopeId: 'proc-produkcja-1', ownerUserId: 'user-piotr-demo', reviewFrequency: 'monthly',
    lifecycleStatus: 'draft', rowVersion: 1, createdBy: 'user-piotr-demo',
    createdAt: '2026-08-01T08:00:00Z', updatedAt: '2026-08-01T08:00:00Z',
  },
  'sc-2': {
    scorecardId: 'sc-2', organizationId: 'org-dbr77-demo', name: 'Karta wyników — Jakość Q3',
    description: 'Kwartalny przegląd jakości dla linii pakowania.', scopeType: 'business_unit',
    scopeId: 'bu-jakosc', ownerUserId: 'user-anna', reviewFrequency: 'quarterly',
    lifecycleStatus: 'active', rowVersion: 6, createdBy: 'user-anna',
    createdAt: '2026-05-01T08:00:00Z', updatedAt: '2026-08-09T09:30:00Z',
  },
  'sc-3': {
    scorecardId: 'sc-3', organizationId: 'org-dbr77-demo', name: 'Karta wyników — HR Redukcja Kosztów',
    description: null, scopeType: 'team', scopeId: 'team-hr', ownerUserId: 'user-marek',
    reviewFrequency: 'monthly', lifecycleStatus: 'suspended', rowVersion: 4, createdBy: 'user-marek',
    createdAt: '2026-04-12T08:00:00Z', updatedAt: '2026-07-20T09:30:00Z',
  },
  'sc-4': {
    scorecardId: 'sc-4', organizationId: 'org-dbr77-demo', name: 'Karta wyników — Zamknięcie miesiąca (archiwalna)',
    description: 'Zastąpiona nowym procesem zamknięcia.', scopeType: 'organization', scopeId: null,
    ownerUserId: 'user-piotr-demo', reviewFrequency: 'monthly', lifecycleStatus: 'archived',
    rowVersion: 11, createdBy: 'user-piotr-demo', createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-06-30T08:00:00Z',
  },
};

const MOCK_ITEMS: Record<string, any[]> = {
  'sc-1': [],
  'sc-2': [
    { itemId: 'item-1', scorecardId: 'sc-2', kpiId: 'kpi-oee-linia-pakowania-001', organizationId: 'org-dbr77-demo', role: 'primary', sortOrder: 1, displayConfig: null, addedBy: 'user-anna', addedAt: '2026-05-02T08:00:00Z' },
    { itemId: 'item-2', scorecardId: 'sc-2', kpiId: 'kpi-defekty-na-milion-002', organizationId: 'org-dbr77-demo', role: 'primary', sortOrder: 2, displayConfig: null, addedBy: 'user-anna', addedAt: '2026-05-02T08:05:00Z' },
    { itemId: 'item-3', scorecardId: 'sc-2', kpiId: 'kpi-czas-przestoju-003', organizationId: 'org-dbr77-demo', role: 'supporting', sortOrder: 3, displayConfig: null, addedBy: 'user-piotr-demo', addedAt: '2026-06-10T11:00:00Z' },
  ],
  'sc-3': [
    { itemId: 'item-4', scorecardId: 'sc-3', kpiId: 'kpi-koszt-pracy-004', organizationId: 'org-dbr77-demo', role: 'primary', sortOrder: 1, displayConfig: null, addedBy: 'user-marek', addedAt: '2026-04-12T09:00:00Z' },
  ],
  'sc-4': [
    { itemId: 'item-5', scorecardId: 'sc-4', kpiId: 'kpi-cykl-zamkniecia-005', organizationId: 'org-dbr77-demo', role: 'primary', sortOrder: 1, displayConfig: null, addedBy: 'user-piotr-demo', addedAt: '2026-01-10T09:00:00Z' },
  ],
};

const MOCK_SNAPSHOTS: Record<string, any[]> = {
  'sc-1': [],
  'sc-2': [
    { snapshotId: 'snap-1', scorecardId: 'sc-2', organizationId: 'org-dbr77-demo', reviewPeriodStart: '2026-07-01T00:00:00Z', reviewPeriodEnd: '2026-07-31T23:59:59Z', snapshotPayload: null, status: 'superseded', contentHash: 'hash-abc123def456', publishedBy: 'user-anna', publishedAt: '2026-08-01T10:00:00Z', supersededBySnapshotId: 'snap-2', supersededAt: '2026-08-05T10:00:00Z', rowVersion: 3, createdBy: 'user-anna', createdAt: '2026-07-31T18:00:00Z', updatedAt: '2026-08-05T10:00:00Z' },
    { snapshotId: 'snap-2', scorecardId: 'sc-2', organizationId: 'org-dbr77-demo', reviewPeriodStart: '2026-08-01T00:00:00Z', reviewPeriodEnd: '2026-08-07T23:59:59Z', snapshotPayload: null, status: 'published', contentHash: 'hash-fed654cba321', publishedBy: 'user-anna', publishedAt: '2026-08-08T09:00:00Z', supersededBySnapshotId: null, supersededAt: null, rowVersion: 2, createdBy: 'user-anna', createdAt: '2026-08-07T18:00:00Z', updatedAt: '2026-08-08T09:00:00Z' },
    { snapshotId: 'snap-3', scorecardId: 'sc-2', organizationId: 'org-dbr77-demo', reviewPeriodStart: '2026-08-08T00:00:00Z', reviewPeriodEnd: '2026-08-14T23:59:59Z', snapshotPayload: null, status: 'draft', contentHash: null, publishedBy: null, publishedAt: null, supersededBySnapshotId: null, supersededAt: null, rowVersion: 1, createdBy: 'user-piotr-demo', createdAt: '2026-08-09T09:00:00Z', updatedAt: '2026-08-09T09:00:00Z' },
  ],
  'sc-3': [],
  'sc-4': [],
};

const MOCK_DISTRIBUTION: Record<string, any> = {
  'sc-1': { safe: 0, warning: 0, critical: 0, missing: 0, totalVisible: 0 },
  'sc-2': { safe: 1, warning: 1, critical: 0, missing: 1, totalVisible: 3 },
  'sc-3': { safe: 0, warning: 0, critical: 1, missing: 0, totalVisible: 1 },
  'sc-4': { safe: 0, warning: 0, critical: 0, missing: 1, totalVisible: 1 },
};

let itemSeq = 100;
let snapshotSeq = 100;

const realGet = Api.get.bind(Api);
const realPost = Api.post.bind(Api);
const realPatch = Api.patch.bind(Api);

Api.get = (async (url: string) => {
  const m = url.match(/^\/vnext\/results\/kpi\/scorecards\/([^/?]+)(\/.*)?$/);
  if (m) {
    const [, scorecardId, rest] = m;
    const record = MOCK_SCORECARDS[decodeURIComponent(scorecardId)];
    if (!rest) {
      if (!record) {
        const err: any = new Error('KPI scorecard not found');
        err.status = 404;
        throw err;
      }
      return { scorecard: record };
    }
    if (rest.startsWith('/items')) return { items: MOCK_ITEMS[scorecardId] ?? [] };
    if (rest.startsWith('/status')) return { distribution: MOCK_DISTRIBUTION[scorecardId] ?? { safe: 0, warning: 0, critical: 0, missing: 0, totalVisible: 0 } };
    if (rest.startsWith('/review-snapshots/published')) {
      const published = (MOCK_SNAPSHOTS[scorecardId] ?? []).find((s) => s.status === 'published') ?? null;
      if (!published) {
        const err: any = new Error('No published review snapshot');
        err.status = 404;
        throw err;
      }
      return { snapshot: published };
    }
    if (rest.startsWith('/review-snapshots')) return { snapshots: MOCK_SNAPSHOTS[scorecardId] ?? [] };
  }
  if (url.startsWith('/vnext/results/kpi/scorecards')) return { scorecards: Object.values(MOCK_SCORECARDS) };
  return realGet(url);
}) as typeof Api.get;

function checkExpectedVersion(record: any, data: any): void {
  if (record && typeof data?.expectedVersion === 'number' && data.expectedVersion !== record.rowVersion) {
    const err: any = new Error(
      `Scorecard was changed by someone else in the meantime (expected v${data.expectedVersion}, currently v${record.rowVersion}).`
    );
    err.status = 409;
    err.data = { code: 'STALE_VERSION', currentVersion: record.rowVersion, expectedVersion: data.expectedVersion };
    throw err;
  }
}

Api.post = (async (url: string, data: any) => {
  const lifecycleMatch = url.match(/^\/vnext\/results\/kpi\/scorecards\/([^/]+)\/(activate|suspend|archive)$/);
  if (lifecycleMatch) {
    const [, scorecardId, action] = lifecycleMatch;
    const record = MOCK_SCORECARDS[scorecardId];
    if (record) {
      if (action === 'activate' && (MOCK_ITEMS[scorecardId] ?? []).length === 0) {
        const err: any = new Error('Scorecard has no members — add at least one KPI before activating.');
        err.status = 409;
        err.data = { code: 'NO_MEMBERS' };
        throw err;
      }
      record.lifecycleStatus = action === 'activate' ? 'active' : action === 'suspend' ? 'suspended' : 'archived';
      record.rowVersion += 1;
      record.updatedAt = new Date().toISOString();
    }
    return { outcome: 'applied', scorecard: record };
  }

  // RN-G5 §G #8 — POST .../items (addScorecardItem)
  const addItemMatch = url.match(/^\/vnext\/results\/kpi\/scorecards\/([^/]+)\/items$/);
  if (addItemMatch) {
    const [, scorecardId] = addItemMatch;
    const record = MOCK_SCORECARDS[scorecardId];
    checkExpectedVersion(record, data);
    const items = MOCK_ITEMS[scorecardId] ?? (MOCK_ITEMS[scorecardId] = []);
    const maxSort = items.reduce((m, i) => Math.max(m, i.sortOrder), 0);
    const item = {
      itemId: `item-${(itemSeq += 1)}`,
      scorecardId,
      kpiId: data.kpiId,
      organizationId: 'org-dbr77-demo',
      role: data.role || 'primary',
      sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : maxSort + 1,
      displayConfig: null,
      addedBy: 'user-piotr-demo',
      addedAt: new Date().toISOString(),
    };
    items.push(item);
    if (record) {
      record.rowVersion += 1;
      record.updatedAt = new Date().toISOString();
    }
    return { outcome: 'applied', eventId: `evt-${itemSeq}`, resultingVersion: record?.rowVersion, scorecard: record, item };
  }

  // RN-G5 §G #8 — POST .../review-snapshots (createReviewSnapshot)
  const createSnapshotMatch = url.match(/^\/vnext\/results\/kpi\/scorecards\/([^/]+)\/review-snapshots$/);
  if (createSnapshotMatch) {
    const [, scorecardId] = createSnapshotMatch;
    const record = MOCK_SCORECARDS[scorecardId];
    const snapshots = MOCK_SNAPSHOTS[scorecardId] ?? (MOCK_SNAPSHOTS[scorecardId] = []);
    const snapshot = {
      snapshotId: `snap-${(snapshotSeq += 1)}`,
      scorecardId,
      organizationId: 'org-dbr77-demo',
      reviewPeriodStart: data.reviewPeriodStart,
      reviewPeriodEnd: data.reviewPeriodEnd,
      snapshotPayload: null,
      status: 'draft',
      contentHash: null,
      publishedBy: null,
      publishedAt: null,
      supersededBySnapshotId: null,
      supersededAt: null,
      rowVersion: 1,
      createdBy: 'user-piotr-demo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    snapshots.push(snapshot);
    if (record) {
      record.rowVersion += 1;
      record.updatedAt = new Date().toISOString();
    }
    return { outcome: 'applied', eventId: `evt-snap-${snapshotSeq}`, resultingVersion: record?.rowVersion, snapshot };
  }

  // RN-G5 §G #8 — POST .../review-snapshots/:snapshotId/publish (publishReviewSnapshot)
  // Response carries a POPULATED snapshotPayload (decision #6a, publisher-time
  // filtered) — same real shape `publishKpiScorecardReviewSnapshot`'s own doc
  // comment documents. Included here to exercise the D07 non-leak assertion
  // against a REAL harness response, not just the unit test's hand-built mock.
  const publishMatch = url.match(
    /^\/vnext\/results\/kpi\/scorecards\/([^/]+)\/review-snapshots\/([^/]+)\/publish$/
  );
  if (publishMatch) {
    const [, scorecardId, snapshotId] = publishMatch;
    const record = MOCK_SCORECARDS[scorecardId];
    const snapshots = MOCK_SNAPSHOTS[scorecardId] ?? [];
    const snapshot = snapshots.find((s) => s.snapshotId === snapshotId);
    if (!snapshot) {
      const err: any = new Error('Snapshot not found');
      err.status = 404;
      throw err;
    }
    if (snapshot.status !== 'draft') {
      const err: any = new Error('Snapshot is no longer a draft — publishing is unavailable.');
      err.status = 409;
      err.data = { code: 'SNAPSHOT_NOT_DRAFT' };
      throw err;
    }
    // Supersede whatever was previously published, mirroring the real command.
    const previouslyPublished = snapshots.find((s) => s.status === 'published');
    if (previouslyPublished) {
      previouslyPublished.status = 'superseded';
      previouslyPublished.supersededBySnapshotId = snapshotId;
      previouslyPublished.supersededAt = new Date().toISOString();
    }
    snapshot.status = 'published';
    snapshot.publishedBy = 'user-piotr-demo';
    snapshot.publishedAt = new Date().toISOString();
    snapshot.contentHash = `hash-${snapshotId}`;
    snapshot.snapshotPayload = {
      items: (MOCK_ITEMS[scorecardId] ?? []).map((i: any) => ({
        kpiId: i.kpiId,
        definitionVersionId: 'defver-mock',
        itemRole: i.role,
        measurementId: 'meas-mock',
        actualValue: 42.5,
        unit: '%',
        performanceStatus: 'on_target',
        dataQualityStatus: 'verified',
        periodStart: snapshot.reviewPeriodStart,
        periodEnd: snapshot.reviewPeriodEnd,
      })),
      statusCounts: { safe: (MOCK_ITEMS[scorecardId] ?? []).length, warning: 0, critical: 0, missing: 0 },
    };
    if (record) {
      record.rowVersion += 1;
      record.updatedAt = new Date().toISOString();
    }
    return { outcome: 'applied', eventId: `evt-pub-${snapshotId}`, resultingVersion: record?.rowVersion, snapshot };
  }

  return realPost(url, data);
}) as typeof Api.post;

// RN-G5 §G #8 — PATCH .../items/reorder (reorderScorecardItems)
Api.patch = (async (url: string, data: any) => {
  const reorderMatch = url.match(/^\/vnext\/results\/kpi\/scorecards\/([^/]+)\/items\/reorder$/);
  if (reorderMatch) {
    const [, scorecardId] = reorderMatch;
    const record = MOCK_SCORECARDS[scorecardId];
    checkExpectedVersion(record, data);
    const items = MOCK_ITEMS[scorecardId] ?? [];
    for (const spec of data.items ?? []) {
      const item = items.find((i) => i.itemId === spec.itemId);
      if (item) {
        item.sortOrder = spec.sortOrder;
        if (spec.role) item.role = spec.role;
      }
    }
    if (record) {
      record.rowVersion += 1;
      record.updatedAt = new Date().toISOString();
    }
    return { outcome: 'applied', eventId: `evt-reorder-${scorecardId}`, resultingVersion: record?.rowVersion, scorecard: record, items };
  }
  return realPatch(url, data);
}) as typeof Api.patch;

// RN-G5 §G #8 — DELETE .../items/:itemId (removeScorecardItem). NOT stubbed
// via `Api.delete` — `removeKpiScorecardItem` uses a raw `window.fetch`
// (`kpiScorecardApi.ts`'s `deleteWithBody` helper), the same gap
// `roiApi.ts`'s own `mutateJson` header comment documents for its sibling
// ROI DELETE-with-body endpoints. Scoped to exactly this one URL pattern —
// every other request (fonts, `/locales/`, anything else) passes through.
const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const removeItemMatch = rawUrl.match(
    /\/vnext\/results\/kpi\/scorecards\/([^/]+)\/items\/([^/?]+)$/
  );
  if (removeItemMatch && (init?.method ?? 'GET').toUpperCase() === 'DELETE') {
    const [, scorecardId, itemId] = removeItemMatch;
    const record = MOCK_SCORECARDS[scorecardId];
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    try {
      checkExpectedVersion(record, body);
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message, code: e.data?.code }), {
        status: e.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const items = MOCK_ITEMS[scorecardId] ?? [];
    const idx = items.findIndex((i: any) => i.itemId === itemId);
    if (idx === -1) {
      return new Response(JSON.stringify({ error: 'Item not found', code: 'NOT_FOUND' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    items.splice(idx, 1);
    if (record) {
      record.rowVersion += 1;
      record.updatedAt = new Date().toISOString();
    }
    return new Response(
      JSON.stringify({
        outcome: 'applied',
        eventId: `evt-remove-${itemId}`,
        resultingVersion: record?.rowVersion,
        scorecard: record,
        removedItemId: itemId,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return realFetch(input as RequestInfo, init);
}) as typeof window.fetch;

const initialPath = `/results/kpi/scorecards/${encodeURIComponent(mockScorecardId)}`;

const ResultsVNextKpiScorecardsScreen: React.FC = () => (
  <div className="h-screen bg-c-bg text-c-text">
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/results/kpi/scorecards/:scorecardId" element={<ResultsKpiScorecardDetailPage />} />
      </Routes>
    </MemoryRouter>
  </div>
);

export default ResultsVNextKpiScorecardsScreen;
