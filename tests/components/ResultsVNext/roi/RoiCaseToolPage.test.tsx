/**
 * @vitest-environment jsdom
 *
 * RN-G5 (2026-08-12) — component test for
 * `src/components/ResultsVNext/roi/RoiCaseToolPage.tsx` at
 * `/results/roi/cases/:roiCaseId`, the deep-link route for the ROI Case full
 * tool. Mirrors `tests/components/ResultsVNext/KpiToolPage.test.tsx`'s
 * structure/conventions (same flag-disabled / golden-load / error+retry /
 * forbidden(404) coverage), adapted to `roiApi.ts`'s raw-`fetch` client
 * (unlike `kpiApi.ts`, which goes through the `Api` facade — mocking
 * `global.fetch` here, not `Api.get`).
 *
 * Golden flow covered: flag-disabled -> flag-enabled cold direct-URL load
 * (no prior registry visit, no row click) -> case renders (title in the
 * workspace breadcrumb, proving `getRoiCase` really fed `RoiCaseFullTool`) ->
 * clicking the breadcrumb "back to registry" requests navigation to
 * `ROUTES.RESULTS_ROI.ROOT` -> error state with Retry -> forbidden (404,
 * same for a nonexistent id and — by construction, see file header of
 * `roiApi.ts`'s `getRoiCase` — a cross-org id, since the server collapses
 * both into the same 404).
 */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { flagEnabled } = vi.hoisted(() => ({ flagEnabled: { value: true } }));
vi.mock('@/components/ResultsVNext/resultsVNextFeatureFlags', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/ResultsVNext/resultsVNextFeatureFlags')
  >('@/components/ResultsVNext/resultsVNextFeatureFlags');
  return { ...actual, isResultsVNextFlagEnabled: () => flagEnabled.value };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// See `KpiToolPage.test.tsx` header for why `navigate()`-after-click
// cross-route DOM swap is unreliable in this repo's jsdom + React 19 +
// react-router-dom v7 test environment — same established workaround: mock
// `useNavigate` to a spy and assert the exact target path. `useParams` stays
// REAL via `importActual` so the initial mount routing (cold direct-URL
// entry) is still exercised honestly.
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import { RoiCaseToolPage } from '../../../../src/components/ResultsVNext/roi/RoiCaseToolPage';
import { ROUTES } from '../../../../src/routes/routeConfig';
import { API_URL } from '../../../../src/services/api';

const CASE_ID = '33333333-3333-3333-3333-333333333333';

const ROI_CASE_ROW = {
  caseId: CASE_ID,
  organizationId: 'org-1',
  initiativeId: 'init-1',
  title: 'Automatyzacja linii pakowania',
  ownerUserId: 'user-owner',
  status: 'modeling',
  currency: 'PLN',
  granularity: 'monthly',
  analysisStart: '2026-01-01',
  analysisEnd: '2026-12-31',
  nextActionType: 'complete_economic_model',
  nextActionDueAt: null,
  nextReviewAt: null,
  submittedAt: null,
  approvedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  changesRequestedAt: null,
  changesRequestedReason: null,
  archivedAt: null,
  rowVersion: 3,
  createdAt: '2026-07-01T09:00:00.000Z',
  updatedAt: '2026-08-07T10:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(overrides: { caseStatus?: number; caseBody?: unknown } = {}) {
  const caseUrl = `${API_URL}/vnext/results/roi/cases/${CASE_ID}`;
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    if (url === caseUrl) {
      if (overrides.caseStatus && overrides.caseStatus >= 400) {
        return jsonResponse(
          { error: 'ROI case not found', code: 'NOT_FOUND' },
          overrides.caseStatus
        );
      }
      return jsonResponse({ case: overrides.caseBody ?? ROI_CASE_ROW });
    }
    // Sub-resources the default "Build Case" phase's "settings" tab loads on
    // mount (`RoiCaseModelWorkspace`'s `loadSettings`) — honest empty
    // defaults, not asserted on by this test, just kept quiet.
    if (url.startsWith(`${API_URL}/vnext/results/roi/cases/${CASE_ID}/baseline`)) {
      return jsonResponse({ baseline: null });
    }
    if (url.startsWith(`${API_URL}/vnext/results/roi/cases/${CASE_ID}/calculation-policy`)) {
      return jsonResponse({ calculationPolicy: null });
    }
    throw new Error(`Unexpected fetch ${url}`);
  }) as unknown as typeof fetch;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.RESULTS_ROI.CASE} element={<RoiCaseToolPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RoiCaseToolPage — /results/roi/cases/:roiCaseId (klasa L full tool, deep link)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flagEnabled.value = true;
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders the honest disabled-flag empty state for the explicit build rollback', async () => {
    flagEnabled.value = false;
    mockFetch();
    renderAt(`/results/roi/cases/${CASE_ID}`);
    expect(await screen.findByTestId('results-vnext-roi-tool-disabled')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('cold direct-URL load: fetches the case by id (no prior registry visit) and renders it', async () => {
    window.localStorage.setItem('ff.results_vnext_roi_registry', '1');
    mockFetch();

    renderAt(`/results/roi/cases/${CASE_ID}`);

    await waitFor(() =>
      expect(screen.getByTestId('results-vnext-roi-tool-page')).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/vnext/results/roi/cases/${CASE_ID}`,
        expect.anything()
      )
    );
    // The case title only ever reaches the screen via `RoiCaseFullTool`'s
    // breadcrumb (`RoiCaseModelWorkspace.tsx`'s `breadcrumbs` array) — this
    // is the concrete proof `getRoiCase` actually fed the real loaded
    // record into the tool, not a stub/empty object.
    await waitFor(() =>
      expect(screen.getAllByText('Automatyzacja linii pakowania').length).toBeGreaterThan(0)
    );
  });

  it('breadcrumb "back to registry" requests navigation to ROUTES.RESULTS_ROI.ROOT', async () => {
    window.localStorage.setItem('ff.results_vnext_roi_registry', '1');
    mockFetch();

    renderAt(`/results/roi/cases/${CASE_ID}`);
    await waitFor(() =>
      expect(screen.getByTestId('results-vnext-roi-tool-page')).toBeInTheDocument()
    );

    const user = userEvent.setup();
    const backCrumb = await screen.findByText('Rejestr ROI');
    await user.click(backCrumb);

    expect(navigateMock).toHaveBeenCalledWith({
      pathname: ROUTES.RESULTS_ROI.ROOT,
      search: '',
    });
  });

  it('shows an honest error state with Retry when the case fetch fails (non-404), and Retry re-fetches', async () => {
    window.localStorage.setItem('ff.results_vnext_roi_registry', '1');
    const caseUrl = `${API_URL}/vnext/results/roi/cases/${CASE_ID}`;
    let callCount = 0;
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      if (url === caseUrl) {
        callCount += 1;
        if (callCount === 1)
          return jsonResponse({ error: 'Upstream ROI service returned a 503.' }, 503);
        return jsonResponse({ case: ROI_CASE_ROW });
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;

    renderAt(`/results/roi/cases/${CASE_ID}`);

    expect(await screen.findByTestId('results-vnext-roi-tool-error')).toBeInTheDocument();

    const retryButton = within(screen.getByTestId('results-vnext-roi-tool-error')).getByRole(
      'button'
    );
    const user = userEvent.setup();
    await user.click(retryButton);

    await waitFor(() =>
      expect(screen.getByTestId('results-vnext-roi-tool-page')).toBeInTheDocument()
    );
  });

  it('deep link to a nonexistent (or cross-org — same 404, D06/D07) case id renders the forbidden state, never a blank screen', async () => {
    window.localStorage.setItem('ff.results_vnext_roi_registry', '1');
    mockFetch({ caseStatus: 404 });

    renderAt(`/results/roi/cases/${CASE_ID}`);

    await waitFor(() =>
      expect(screen.getByText(/nie masz dostępu|no visibility/i)).toBeInTheDocument()
    );
  });
});
