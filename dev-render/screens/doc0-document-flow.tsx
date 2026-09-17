/**
 * DOC-0 etap 1 (b) v2 (DEC-593, Wpis 87 P2) — harness host for the REAL
 * open-flow `list → open → ONE DocumentViewer`, rendered inside the REAL
 * Materials Hub shell (left rail + Menu 1/2/3), not an isolated table.
 *
 * Why v2 (Wpis 87 P2): the (b) list screenshots showed a bare `StandardTable`
 * with a hand-written header on an empty background — no Hub shell — which the
 * owner judges as a mockup, not the product (CLAUDE.md #7). This revision mounts
 * the SAME `ReportsAndPresentationsHub` the production app renders (the day267
 * owner-verdict pattern), so the rail, the Menu 1/2/3 tabs and the Outputs "All"
 * registry chrome are all real. Only transport is stubbed.
 *
 * What is real here:
 *  - `<ReportsAndPresentationsHub />` — the production Materials hub (rail,
 *    Menu 1/2/3, Outputs "All" registry), mounted exactly as day267 does,
 *  - its Outputs list (`useArtifactOutputsList` → `GET /api/artifacts?limit=200`
 *    → `mapRegistryItemToUnified`) — the canonical server registry read-model,
 *  - the `openRow` fork (`artifactNavigation.resolveArtifactOpenTarget`) — at
 *    flag ON an APPROVED document row opens the read-only `DocumentViewer`
 *    overlay instead of routing to Report Builder; a DRAFT keeps the old path,
 *  - `DocumentViewer` + `documentContentResolver` (`GET /api/artifacts/:id/content`),
 *  - the document body itself — the REAL staging row
 *    `4d6600e3-6ddd-52df-b0aa-85afa4c86c1c` "Digital Roadmap 2026–2028"
 *    (org 468b234c, delivery_state `ready`, owner Daniel Osei), captured by
 *    running the PRODUCTION resolver read-only against the local dump copy.
 *
 * What is stubbed: transport only. The harness has no backend
 * (`apiNoBackendPlugin` answers every `/api/*` with an honest 404), so
 * `window.fetch` returns (1) the captured envelope byte-for-byte for the one
 * content URL the adapter calls, and (2) the two registry rows below for the
 * list call. Everything else keeps its real behaviour.
 *
 * Flag: ON via URL `?ff_doc0_document_viewer=1` (highest precedence in
 * `documentViewerFlag`). Drop it (or `=0`) to see the byte-identical OFF parity.
 *
 * URL: /doc0-document-flow.html?lang=en&theme=light|dark&ff_doc0_document_viewer=1&tab=all&case=list|open
 *   case=list → the Outputs "All" registry inside the Hub shell (before the click)
 *   case=open → the DocumentViewer overlay (after a real dblclick on the approved row)
 */
import React, { useEffect, useRef } from 'react';

import { ReportsAndPresentationsHub } from '../../src/components/ReportsAndPresentations/ReportsAndPresentationsHub';
import { doneKey } from '../../src/components/Onboarding/useFirstRunOnboarding';
import { STORY_RAIL_DISMISSED_KEY } from '../../src/components/demo/storyRailStops';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { MainLayout } from '../../src/layouts/MainLayout';
import { AppProviders } from '../../src/providers/AppProviders';

import ENVELOPE from '../mocks/doc0-digital-roadmap-envelope.json';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

// MainLayout mounts FirstRunOnboarding, which opens the "Meet Teresa" modal for
// any user with no local onboarding-done record (the harness has no server
// preference row). Setting the production instant-guard key makes the shell
// behave like a RETURNING user instead of blocking the Hub behind step 1 of 3.
localStorage.setItem(doneKey('user-piotr-demo'), 'true');
// Same idea for the demo StoryRail coach-mark: dismiss it permanently through
// the production key so it never overlays the bottom of the Hub in a screenshot.
localStorage.setItem(STORY_RAIL_DISMISSED_KEY, 'true');

const APPROVED_ID = '4d6600e3-6ddd-52df-b0aa-85afa4c86c1c';
const CONTENT_URL = `/api/artifacts/${APPROVED_ID}/content`;

// Real `v8_output_artifacts` rows (dump copy, org 468b234c) in the canonical
// registry shape `mapRegistryItemToUnified` consumes. Row 1 is the APPROVED
// document (originStatus `ready`) that opens the viewer at flag ON; row 2 is a
// DRAFT document that must keep the OLD path (Report Builder) even at flag ON —
// the fork is fail-closed on non-approved statuses.
const ROWS = [
  {
    artifactId: APPROVED_ID,
    artifactFamily: 'document',
    outputType: 'report',
    originRuntime: 'native_artifact',
    originRecordId: 'cd81551c-5c33-52b4-abb4-878fde387949',
    resolvedTitle: 'Digital Roadmap 2026–2028',
    originStatus: 'ready',
    deliveryState: 'ready',
    ownerName: 'Daniel Osei',
    createdAt: '2026-09-08T14:58:06.124Z',
    updatedAt: '2026-09-08T14:58:06.124Z',
    lastTransitionAt: '2026-09-08T14:58:06.124Z',
    publishState: 'approved',
    validationState: 'validated',
    visibilityScope: 'organization',
    exportFormat: 'docx',
    reportType: 'strategic_roadmap',
    authority: 'report_builder',
    originSummary: { sourceType: 'report_builder' },
  },
  {
    artifactId: 'art-doc0-draft-2',
    artifactFamily: 'document',
    outputType: 'report',
    originRuntime: 'native_artifact',
    originRecordId: 'cd81551c-0000-4000-8000-000000000002',
    resolvedTitle: 'Draft — Q4 operating notes',
    originStatus: 'draft',
    deliveryState: 'draft',
    ownerName: 'Daniel Osei',
    createdAt: '2026-09-10T09:12:00.000Z',
    updatedAt: '2026-09-10T09:12:00.000Z',
    lastTransitionAt: '2026-09-10T09:12:00.000Z',
    publishState: 'draft',
    validationState: null,
    visibilityScope: 'organization',
    exportFormat: 'docx',
    reportType: 'executive_memo',
    authority: 'report_builder',
    originSummary: { sourceType: 'report_builder' },
  },
];

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Transport stub. Order matters: the content URL also contains `/api/artifacts`,
// so it is matched FIRST. The list call returns the two registry rows (filtered
// by `outputType` when the caller asks for one family). Every OTHER request keeps
// its real behaviour — `/locales/**` must reach vite's publicDir or i18n renders
// raw keys, and any other `/api/**` gets the same honest 404 the harness
// middleware (`apiNoBackendPlugin`) would return.
const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes(CONTENT_URL)) return jsonResponse(ENVELOPE, 200);
  if (url.includes('/api/artifacts')) {
    const query = new URL(url, window.location.origin).searchParams;
    const outputType = query.get('outputType');
    const data = outputType
      ? ROWS.filter((row) => row.outputType === outputType)
      : ROWS;
    return jsonResponse({ data }, 200);
  }
  // Benign catch-all (Wpis 87 P2, pattern from rg1-audits-generate-owner.tsx):
  // OrgContext (`/api/organizations/current`) and the shell (`/api/v8/admin/flags`)
  // reach for raw `window.fetch`, not the `Api` singleton. Without this they fall
  // through to `apiNoBackendPlugin`'s honest 404 and the browser auto-logs
  // "Failed to load resource: 404" (bledyKonsoli≠0) even though both consumers
  // degrade gracefully. Answer 200 with an empty envelope so the Hub mounts clean.
  if (url.includes('/api/')) {
    return jsonResponse({ data: [], items: [], organizations: [] }, 200);
  }
  return realFetch(input as RequestInfo | URL, init);
}) as typeof window.fetch;

const params = new URLSearchParams(window.location.search);
const openCase = params.get('case') === 'open';

/**
 * `case=open` reproduces the owner's real 2-click on the approved row without a
 * human. The Hub fetches the registry asynchronously, so poll until the row's
 * `<tr>` is in the DOM, then dispatch the native bubbling `dblclick` React listens
 * for → `FilterableTable.onRowDoubleClick` → the SAME `openRow` fork production
 * uses (no shortcut, no direct `setViewerRow`). The row is located by its title
 * text (no invented data attribute).
 */
function useOpenApprovedRow(enabled: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!enabled || done.current) return;
    let elapsed = 0;
    const interval = window.setInterval(() => {
      elapsed += 200;
      const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('tbody tr'));
      const row = rows.find((tr) => (tr.textContent || '').includes('Digital Roadmap 2026'));
      if (row) {
        done.current = true;
        window.clearInterval(interval);
        row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      } else if (elapsed >= 12000) {
        window.clearInterval(interval);
      }
    }, 200);
    return () => window.clearInterval(interval);
  }, [enabled]);
}

export default function Doc0DocumentFlowScreen() {
  useOpenApprovedRow(openCase);
  return (
    <FeatureFlagsProvider showDevTools={false}>
      <AppProviders>
        <div className="h-screen min-h-0 bg-c-canvas text-c-text">
          {/* No harness chrome on purpose: MainLayout + the Hub ARE the shell
              (left rail + top bar + Menu 1/2/3 + chat dock), mounted exactly as
              AppRoutes does for ROUTES.PRESENTATIONS. A caption on an
              owner-facing screenshot is exactly what the parity PODPIS rule
              discourages. Harness context lives in
              evidence/qoder-doc0-flow-20260917/README.md. */}
          <MainLayout breadcrumbs={['Materials']} noPadding>
            <ReportsAndPresentationsHub />
          </MainLayout>
        </div>
      </AppProviders>
    </FeatureFlagsProvider>
  );
}
