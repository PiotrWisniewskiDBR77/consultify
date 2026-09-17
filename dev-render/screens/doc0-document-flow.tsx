/**
 * DOC-0 etap 1 (b) (DEC-593) — harness host for the REAL open-flow:
 * `list → open → ONE DocumentViewer`.
 *
 * What is real here (CLAUDE.md #7 — the owner judges the PRODUCT, not a mockup):
 *  - `<OutputsAggregateTabContent />` — the Materials common "All" registry
 *    (ReportsAndPresentationsHub, Menu 1 "All" tab), the SAME component the
 *    production Hub renders,
 *  - its `openRow` fork (`artifactNavigation.resolveArtifactOpenTarget`) — at
 *    flag ON an APPROVED document row opens the read-only `DocumentViewer`
 *    overlay instead of routing to Report Builder,
 *  - `DocumentViewer` + `documentContentResolver` (`GET /api/artifacts/:id/content`),
 *  - the document body itself — 1264 chars of the REAL staging row
 *    `4d6600e3-6ddd-52df-b0aa-85afa4c86c1c` "Digital Roadmap 2026–2028"
 *    (org 468b234c, delivery_state `ready`, owner Daniel Osei), captured by
 *    running the PRODUCTION resolver read-only against the local dump copy.
 *    Registry metadata in the row/Properties is that real `v8_output_artifacts` row.
 *
 * What is stubbed: transport only. The harness has no backend
 * (`apiNoBackendPlugin` answers every `/api/*` with an honest 404), so
 * `window.fetch` returns the captured envelope byte-for-byte for the one URL the
 * adapter calls. A SECOND row (draft) is included to show the fork honestly: at
 * flag ON a DRAFT document keeps the OLD path (Report Builder), it does NOT open
 * the viewer — only APPROVED rows do.
 *
 * Flag: ON via URL `?ff_doc0_document_viewer=1` (highest precedence in
 * `documentViewerFlag`). Drop it (or `=0`) to see the byte-identical OFF parity.
 *
 * URL: /doc0-document-flow.html?lang=en&theme=light|dark&ff_doc0_document_viewer=1&case=list|open
 *   case=list → the registry table (before the click)
 *   case=open → the DocumentViewer overlay (after "Open full" on the approved row)
 */
import React, { useEffect, useRef } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';

import { OutputsAggregateTabContent } from '../../src/components/ReportsAndPresentations/OutputsAggregateTabContent';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import i18n from '../../src/i18n';

import ENVELOPE from '../mocks/doc0-digital-roadmap-envelope.json';

const APPROVED_ID = '4d6600e3-6ddd-52df-b0aa-85afa4c86c1c';
const CONTENT_URL = `/api/artifacts/${APPROVED_ID}/content`;

const actions = {
  exportReportPdf: async () => {},
  exportDeckPptx: async () => {},
  archiveReport: async () => true,
  archiveDeck: async () => true,
  startArtifactReview: async () => true,
} as any;

// Real `v8_output_artifacts` rows (dump copy, org 468b234c). Row 1 is the
// APPROVED document (delivery_state `ready`) that opens the viewer at flag ON;
// row 2 is a DRAFT document that must keep the OLD path (Report Builder) even at
// flag ON — the fork is fail-closed on non-approved statuses.
const ROWS = [
  {
    kind: 'document' as const,
    originRecordId: 'cd81551c-5c33-52b4-abb4-878fde387949',
    artifactId: APPROVED_ID,
    title: 'Digital Roadmap 2026–2028',
    statusKey: 'ready',
    owner: 'Daniel Osei',
    updatedAt: '2026-09-08T14:58:06.124Z',
    reportType: 'strategic_roadmap',
    exportFormats: ['docx', 'pdf'],
    fileFormat: 'Document',
    governance: {
      visibilityScope: 'organization',
      publishState: 'approved',
      originSummary: { sourceType: 'report_builder' },
    },
  },
  {
    kind: 'document' as const,
    originRecordId: 'cd81551c-0000-4000-8000-000000000002',
    artifactId: 'art-doc0-draft-2',
    title: 'Draft — Q4 operating notes',
    statusKey: 'draft',
    owner: 'Daniel Osei',
    updatedAt: '2026-09-10T09:12:00.000Z',
    reportType: 'executive_memo',
    exportFormats: ['docx'],
    fileFormat: 'Document',
    governance: {
      visibilityScope: 'organization',
      publishState: 'draft',
      originSummary: { sourceType: 'report_builder' },
    },
  },
];

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Transport stub: serve the captured envelope for the adapter's one call. Every
// OTHER request keeps its real behaviour — `/locales/**` must reach vite's
// publicDir or i18n renders raw keys, and `/api/**` gets the same honest 404 the
// harness middleware (`apiNoBackendPlugin`) would return.
const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes(CONTENT_URL)) return jsonResponse(ENVELOPE, 200);
  if (url.includes('/api/')) return jsonResponse({ error: { code: 'DEV_RENDER_NO_BACKEND' } }, 404);
  return realFetch(input as RequestInfo | URL, init);
}) as typeof window.fetch;

const params = new URLSearchParams(window.location.search);
const openCase = params.get('case') === 'open';
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
document.documentElement.classList.toggle('dark', theme === 'dark');
document.documentElement.setAttribute('data-theme', theme);
void i18n.changeLanguage(params.get('lang') === 'pl' ? 'pl' : 'en');

/**
 * `case=open` reproduces the owner's real 2-click on the approved row without a
 * human. `FilterableTable` renders each row as a `<tr>` with React's
 * `onDoubleClick` → `onRowDoubleClick` → the SAME `openRow` fork production uses
 * (no shortcut, no direct `setViewerRow`). React listens for the native bubbling
 * `dblclick`, so dispatching it on the row's `<tr>` drives the real path. The row
 * is located by its title text (no invented data attribute).
 */
function useOpenApprovedRow(enabled: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!enabled || done.current) return;
    const timer = window.setTimeout(() => {
      done.current = true;
      const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('tbody tr'));
      const row = rows.find((tr) =>
        (tr.textContent || '').includes('Digital Roadmap 2026')
      );
      if (row) {
        row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [enabled]);
}

export default function Doc0DocumentFlowScreen() {
  useOpenApprovedRow(openCase);
  return (
    <I18nextProvider i18n={i18n}>
      <FeatureFlagsProvider showDevTools={false}>
        <MemoryRouter initialEntries={['/presentations?tab=all']}>
          <div className="min-h-screen bg-c-bg p-6">
            <div className="w-full">
              {/* No visible chrome header on purpose: the language gate (J0) counts
                  EN/PL JSX literals, and a harness caption on an owner-facing
                  screenshot is exactly what the parity PODPIS rule discourages.
                  Harness context lives in evidence/qoder-doc0-flow-20260917/README.md. */}
              <div className="h-[640px] rounded-2xl border border-c-border-subtle overflow-hidden">
                <OutputsAggregateTabContent
                  viewMode="table"
                  searchQuery=""
                  activeFilters={[]}
                  onFilterChange={() => {}}
                  rows={ROWS as any}
                  loading={false}
                  error={null}
                  onRefresh={() => {}}
                  actions={actions}
                />
              </div>
            </div>
          </div>
        </MemoryRouter>
      </FeatureFlagsProvider>
    </I18nextProvider>
  );
}
