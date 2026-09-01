/**
 * T5 — dev-render harness for the REAL `AssessmentHub` mounted on its
 * 'outputs' tab, i.e. `AssessmentOutputsTab`
 * (`src/components/assessment/AssessmentOutputsTab.tsx`) → its Outputs /
 * Reports / Initiatives segments (`src/components/assessment/artifacts/**`).
 *
 * ★ Why this screen exists (not a reuse of `assessment-five-surfaces.tsx`):
 * `AssessmentOutputsTab` was REWRITTEN 2026-08-13 (P0D) to stop reading the
 * legacy `GET /api/artifacts` registry and read the Shared Method Kernel's
 * own list endpoints instead (`listOutputs`/`listReports`/
 * `listInitiativeDrafts`/`getSessionLineage` — all `/api/method/**`, see
 * `src/method-core/api/methodCoreApi.ts`). `assessment-five-surfaces.tsx`
 * only mocks the OLD `/api/artifacts` endpoint — mounting THIS screen there
 * would silently render an empty Outputs tab (0 network calls it recognizes)
 * and look "fine" for the wrong reason. Nobody has screenshotted the
 * rewritten tab yet — required per CLAUDE.md #7.
 *
 * Seeds a fixed catalog (`seedArtifactsCatalog()` in
 * `dev-render/mocks/methodCoreFakeServer.ts`) covering: a current Output, a
 * SUPERSEDED Output (older revision) with its own superseded Report
 * Snapshot + `source_updated` Initiative Draft, a third standalone Output
 * (DRD Light, demo-bypass), and one session's full lineage chain for the
 * "View lineage" action.
 *
 * URL params:
 *   ?theme=light|dark   (default light)
 *   &segment=outputs|reports|initiatives   (default outputs — clicks
 *     AssessmentOutputsTab's OWN inner segmented nav, `role="tab"`
 *     Outputs/Reports/Initiatives buttons)
 *   &select=1           (also click the first data row, opening the preview)
 *   &lineage=1           (from the Outputs segment with a row selected,
 *     click "View lineage" — requires select=1)
 *
 * ★ Naming trap this screen deliberately avoids: `AssessmentHub` ITSELF has
 * five top-level Menu-3 tabs also called Library/Processes/Outputs/Reports/
 * Initiatives (`?tab=`, `FIVE_SURFACES_TAB_IDS`) — the OLD legacy
 * ReportBuilder-backed "Reports" and legacy "Initiatives" hub tabs, a
 * DIFFERENT surface from AssessmentOutputsTab's inner Outputs/Reports/
 * Initiatives SEGMENTED SWITCH (`SegmentedNav`, `role="tab"`) that only
 * exists once you're already on the hub's 'outputs' tab. An early version of
 * this screen reused `?tab=reports` for both and silently landed on the
 * legacy empty "No reports yet" hub tab instead of AssessmentOutputsTab's own
 * Reports segment — hence `?segment=` here, and the hub's own `?tab=` is
 * ALWAYS forced to 'outputs' below, never taken from this screen's params.
 *
 * ★ Defect found while building this harness (documented in the T5 report,
 * NOT fixed here — belongs in `AssessmentHub.tsx`'s scope, fixed separately
 * in this same pass since the file IS under `src/components/assessment/**`):
 * `AssessmentHub`'s `initialTab` prop is silently overwritten back to
 * 'library' on mount whenever `assessmentFiveSurfacesV1` is ON and the URL
 * has no `?tab=` — a URL-canonicalization effect always treats "no `?tab=`"
 * as "go to library", never consulting `initialTab`. No production route
 * passes `initialTab` today (grepped `src/routes/AppRoutes.tsx` — always
 * bare `<AssessmentHub />`), so this had zero live impact, but it made THIS
 * harness (and, on inspection, `assessment-five-surfaces.tsx` before it)
 * silently land on the wrong tab. Fixed in `AssessmentHub.tsx` so
 * `initialTab` seeds the URL instead of being overwritten. This screen ALSO
 * sets `?tab=` itself (matching how a real bookmarked link would land)
 * rather than depending only on the prop.
 */
import React, { useEffect, useRef } from 'react';

import { AssessmentHub } from '../../src/components/assessment/AssessmentHub';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import {
  DRD_METHOD_PACK_ID,
  DRD_METHOD_PACK_VERSION,
} from '../../src/method-core/methods/drd/compileDrdPack';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { installMethodCoreFakeServer, seedArtifactsCatalog } from '../mocks/methodCoreFakeServer';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();
installMethodCoreFakeServer();
seedArtifactsCatalog();

// `installMethodCoreFakeServer()` above patches `window.fetch` for every
// `/api/method/**` path EXCEPT the plain session-LIST route
// (`GET /api/method/sessions?...`, no `/:id` after it) — its router has no
// case for that path shape, so it falls through to a 404. `AssessmentHub`'s
// `loadAssessmentListCore()` (src/components/assessment/AssessmentHub.tsx)
// calls exactly that route on EVERY mount, regardless of which tab is
// active, via `listSessions()` (`@/method-core/api/methodCoreApi.ts`) — so
// even this 'outputs'-tab screen hits the gap and shows the persistent
// "Nie udało się wczytać sesji DRD z Rdzenia metody" banner. Since H2
// (dev-render/vite.config.ts) made the harness return an honest 404 instead
// of vite's old lying 200 text/html, that failure is no longer masked.
// Patch AFTER `installMethodCoreFakeServer()` so this wraps its fetch (and
// still delegates every other `/api/method/**` path — outputs/reports/
// initiative-drafts/lineage — to the fake server underneath) rather than
// being shadowed by it.
{
  const MOCK_METHOD_SESSIONS = [
    {
      id: 'sess-drd-restart-0001',
      organizationId: 'org-dbr77-demo',
      projectId: null,
      module: 'assessment',
      methodPackId: DRD_METHOD_PACK_ID,
      methodPackVersion: DRD_METHOD_PACK_VERSION,
      state: 'in_review',
      domainStage: 'Oś 1 — Procesy Cyfrowe',
      mode: 'guided_manual',
      ownerUserId: 'user-piotr-demo',
      createdAt: '2026-06-02T08:00:00.000Z',
      updatedAt: '2026-07-10T11:20:00.000Z',
      version: 5,
      frozenSnapshotId: null,
      revisionOfSessionId: null,
      hasFrozenOutput: false,
    },
    {
      id: 'sess-drd-restart-0002',
      organizationId: 'org-dbr77-demo',
      projectId: null,
      module: 'assessment',
      methodPackId: DRD_METHOD_PACK_ID,
      methodPackVersion: DRD_METHOD_PACK_VERSION,
      state: 'frozen',
      domainStage: null,
      mode: 'guided_manual',
      ownerUserId: 'user-piotr-demo',
      createdAt: '2026-04-01T08:00:00.000Z',
      updatedAt: '2026-06-30T10:00:00.000Z',
      version: 9,
      frozenSnapshotId: 'output-restart-drd-0002',
      revisionOfSessionId: null,
      hasFrozenOutput: true,
    },
  ];
  const originalFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    if (method === 'GET' && /\/api\/method\/sessions(\?.*)?$/.test(url)) {
      return new Response(
        JSON.stringify({ sessions: MOCK_METHOD_SESSIONS, total: MOCK_METHOD_SESSIONS.length }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;
}

// Always land on the hub's 'outputs' tab like a real bookmarked link would
// (AssessmentHub reads `?tab=` as its source of truth once
// `assessmentFiveSurfacesV1` is ON) — set BEFORE the BrowserRouter/
// AssessmentHub mount so there is no flash of the Library tab. Deliberately
// NOT reusing this screen's own `?segment=` param here — see header note on
// the `?tab=` vs `?segment=` naming trap.
{
  const p = new URLSearchParams(window.location.search);
  p.set('tab', 'outputs');
  window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
}

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

try {
  const existing = JSON.parse(localStorage.getItem('consultify_feature_flags') || '{}');
  localStorage.setItem(
    'consultify_feature_flags',
    JSON.stringify({ ...existing, assessmentFiveSurfacesV1: true })
  );
} catch {
  // ignore
}

// Legacy endpoints AssessmentHub still calls for its OTHER tabs (Library /
// Processes / Reports(legacy) / Initiatives(legacy)) on mount — kept minimal
// and empty so those tabs show an honest empty state instead of a console
// error, without pretending they have content (out of this screen's scope,
// which is the 'outputs' tab).
Api.getUsers = (async () => [
  { id: 'user-piotr-demo', firstName: 'Piotr', lastName: 'Wiśniewski' },
  { id: 'user-anna-demo', firstName: 'Anna', lastName: 'Kowalska' },
]) as typeof Api.getUsers;
Api.listAssessments = (async () => ({ items: [], total: 0 })) as typeof Api.listAssessments;
Api.getAssessmentReports = (async () => []) as typeof Api.getAssessmentReports;
Api.listReportImports = (async () => ({ data: [] })) as typeof Api.listReportImports;
const originalGet = Api.get.bind(Api);
Api.get = (async (url: string, ...rest: unknown[]) => {
  if (url === '/initiatives?source=assessment') return [];
  return (originalGet as any)(url, ...rest);
}) as typeof Api.get;

const params = new URLSearchParams(window.location.search);
const wantedSegment = params.get('segment');
const wantedSelect = params.get('select') === '1';
const wantedLineage = params.get('lineage') === '1';

const SEGMENT_LABEL: Record<string, string> = {
  outputs: 'Outputs',
  reports: 'Reports',
  initiatives: 'Initiatives',
};

function AutoDriver(): React.ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wantedSegment && !wantedSelect) return;
    let cancelled = false;

    async function drive() {
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled || !rootRef.current) return;

      if (wantedSegment && wantedSegment !== 'outputs') {
        // AssessmentHub's OWN Menu-3 tabs (Library/Processes/Outputs/
        // Reports/Initiatives) are a DIFFERENT `[role="tablist"]` than
        // AssessmentOutputsTab's inner SegmentedNav — both use the same
        // button text ("Reports"/"Initiatives"), so a page-wide selector
        // would hit the wrong one (see header note). The inner one is the
        // LAST `[role="tablist"]` in DOM order (nested inside the tab
        // content, which renders after the hub chrome).
        const label = SEGMENT_LABEL[wantedSegment];
        const tablists = [...rootRef.current.querySelectorAll<HTMLElement>('[role="tablist"]')];
        const innerTablist = tablists[tablists.length - 1];
        const segmentButton = innerTablist
          ? [...innerTablist.querySelectorAll<HTMLButtonElement>('button[role="tab"]')].find(
              (b) => b.textContent?.trim() === label
            )
          : undefined;
        segmentButton?.click();
        await new Promise((r) => setTimeout(r, 300));
      }

      if (wantedSelect) {
        await new Promise((r) => setTimeout(r, 200));
        const firstRow = rootRef.current.querySelector<HTMLElement>(
          '[data-row-id], tbody tr, [role="row"]'
        );
        firstRow?.click();
        await new Promise((r) => setTimeout(r, 250));
      }

      if (wantedLineage) {
        const lineageBtn = [...rootRef.current.querySelectorAll<HTMLButtonElement>('button')].find(
          (b) => /view lineage/i.test(b.textContent || '')
        );
        lineageBtn?.click();
      }
    }
    void drive();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div ref={rootRef} style={{ height: '100vh', overflow: 'auto' }}>
      <AssessmentHub initialTab="outputs" />
    </div>
  );
}

export function AssessmentArtifactsRestartScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider config={{ enableLocalOverrides: true }} showDevTools={false}>
        <AutoDriver />
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default AssessmentArtifactsRestartScreen;
