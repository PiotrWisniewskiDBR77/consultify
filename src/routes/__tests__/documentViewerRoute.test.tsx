// @vitest-environment jsdom

/**
 * DOC-0 etap 2a (DEC-593, Wpis 106 pkt Q1 / Wpis 117) — standalone document
 * screen `/documents/:artifactId`.
 *
 * Block 1 renders the REAL exported route component (`DocumentViewerRoute`,
 * defined in `src/routes/AppRoutes.tsx`), so the flag branch under test is the
 * production one, not a mirror of it. Two things it must get right:
 *
 *   - flag ON  → mounts `DocumentViewerPage` with the `artifactId` taken from
 *     the URL (a bare deep link from chat/e-mail carries nothing else),
 *   - flag OFF → today's behaviour byte-for-byte, i.e. the Materials list with
 *     the row still selected (`/presentations?tab=documents&artifactId=…`).
 *     OFF convention measured on the flagged object routes in `AppRoutes.tsx`
 *     (`AuditPackObjectRoute`, `AssessmentOutputReportRoute`): a flagged route
 *     that is OFF ALWAYS redirects to the list, never 404s.
 *
 * Block 2 pins the REGISTRATION itself (`readFileSync`, pattern 1:1 from
 * `executionCanonicalRoute.test.ts` / `assessmentOutputArtifactsRoute.test.tsx`
 * in this directory). Without it, deleting `<Route path="/documents/:artifactId">`
 * from `AppRoutes.tsx` would leave every test above green — the registration is
 * the actual deliverable of the order.
 *
 * MUTACJE (see the ready report, Wpis 106):
 *  (a) zerwij trasę — change `path="/documents/:artifactId"` to `/documents2/:artifactId`
 *      in AppRoutes → block 2 RED;
 *  (b) usuń gałąź flagi — drop the `isDocumentViewerEnabled()` check in
 *      `DocumentViewerRoute` → the two OFF tests go RED (screen mounts when it
 *      must redirect);
 *  (c) stary cel przy OFF — replace `buildDocumentViewerListPath(artifactId)`
 *      with `'/presentations'` → the OFF target assertion goes RED.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/documents/DocumentViewerPage', () => ({
  DocumentViewerPage: ({ artifactId }: { artifactId: string }) => (
    <div data-testid="document-viewer-page">viewer:{artifactId}</div>
  ),
  default: ({ artifactId }: { artifactId: string }) => (
    <div data-testid="document-viewer-page">viewer:{artifactId}</div>
  ),
}));

import { DOCUMENT_VIEWER_FLAG_KEYS } from '@/components/documents/documentViewerFlag';
import { DocumentViewerRoute } from '../AppRoutes';

const FLAG_LOCAL_STORAGE_KEY = DOCUMENT_VIEWER_FLAG_KEYS.localStorage;
const VIEWER_PATH = '/documents/art-doc0-7';
const LIST_TARGET = '/presentations?tab=documents&artifactId=art-doc0-7';

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return (
    <div data-testid="location-probe">
      {location.pathname}
      {location.search}
    </div>
  );
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <React.Suspense fallback={<div>loading</div>}>
        <Routes>
          <Route path="/documents/:artifactId" element={<DocumentViewerRoute />} />
          <Route path="/presentations" element={<LocationProbe />} />
        </Routes>
      </React.Suspense>
    </MemoryRouter>
  );
}

describe('DocumentViewerRoute — deep link (Wpis 106 pkt Q1)', () => {
  /**
   * `tests/setup.ts:34` swaps `window.location` for a plain snapshot object, so
   * `history.pushState` moves jsdom's URL but NOT the object the flag reads.
   * Write the snapshot instead — same helper as `documentViewerFlag.test.ts`.
   */
  const setSearch = (search: string) => Object.assign(window.location, { search });

  beforeEach(() => {
    window.localStorage.clear();
    setSearch('');
  });
  afterEach(() => {
    window.localStorage.clear();
    setSearch('');
  });

  it('flag ON: mounts DocumentViewerPage with the artifactId from the URL', async () => {
    window.localStorage.setItem(FLAG_LOCAL_STORAGE_KEY, '1');
    renderAt(VIEWER_PATH);
    const page = await screen.findByTestId('document-viewer-page');
    expect(page).toHaveTextContent('viewer:art-doc0-7');
  });

  it('flag OFF: redirects to the Materials list with the row selected', async () => {
    window.localStorage.setItem(FLAG_LOCAL_STORAGE_KEY, '0');
    renderAt(VIEWER_PATH);
    const probe = await screen.findByTestId('location-probe');
    expect(probe).toHaveTextContent(LIST_TARGET);
    expect(screen.queryByTestId('document-viewer-page')).not.toBeInTheDocument();
  });

  it('no flag at all (fail-closed, DEC default OFF): same redirect as OFF', async () => {
    renderAt(VIEWER_PATH);
    const probe = await screen.findByTestId('location-probe');
    expect(probe).toHaveTextContent(LIST_TARGET);
    expect(screen.queryByTestId('document-viewer-page')).not.toBeInTheDocument();
  });

  it('flag ON via the URL query override (dev-render harness)', async () => {
    setSearch(`?${DOCUMENT_VIEWER_FLAG_KEYS.query}=1`);
    renderAt(VIEWER_PATH);
    expect(await screen.findByTestId('document-viewer-page')).toHaveTextContent(
      'viewer:art-doc0-7'
    );
  });
});

describe('DocumentViewerRoute — rejestracja trasy (pin na źródle)', () => {
  const appRoutes = readFileSync(resolve(process.cwd(), 'src/routes/AppRoutes.tsx'), 'utf8');

  it('registers /documents/:artifactId mounting the real route component', () => {
    expect(appRoutes).toContain('path="/documents/:artifactId"');
    expect(appRoutes).toContain('<DocumentViewerRoute />');
  });

  it('the route is exported and mounts DocumentViewerPage from the URL param', () => {
    expect(appRoutes).toContain('export const DocumentViewerRoute');
    expect(appRoutes).toContain('useParams<{ artifactId: string }>()');
    expect(appRoutes).toContain('<DocumentViewerPage artifactId={artifactId} />');
  });

  it('keeps the SAME guard stack as the Materials list next door', () => {
    const start = appRoutes.indexOf('path="/documents/:artifactId"');
    expect(start).toBeGreaterThan(-1);
    const block = appRoutes.slice(start, start + 1400);
    expect(block).toContain('<ProtectedRoute requireAuth={true}>');
    expect(block).toContain('BetaGate moduleId="MODULE_PRESENTATIONS"');
    expect(block).toContain('moduleName="Outputs"');
    expect(block).toContain('<RouteErrorBoundary>');
  });

  it('OFF means redirect (never 404) — measured convention of the flagged routes', () => {
    const fnStart = appRoutes.indexOf('export const DocumentViewerRoute');
    expect(fnStart).toBeGreaterThan(-1);
    const fn = appRoutes.slice(fnStart, fnStart + 900);
    expect(fn).toContain('if (!isDocumentViewerEnabled())');
    expect(fn).toContain('<Navigate to={buildDocumentViewerListPath(artifactId)} replace />');
  });
});
