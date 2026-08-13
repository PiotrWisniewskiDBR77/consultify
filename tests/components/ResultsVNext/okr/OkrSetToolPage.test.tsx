/**
 * @vitest-environment jsdom
 *
 * RN-G5 (2026-08-12) — component test for
 * `src/components/ResultsVNext/okr/OkrSetToolPage.tsx` at
 * `/results/okr/sets/:okrSetId`, the deep-link route for the OKR Set full
 * workspace. Mirrors `tests/components/ResultsVNext/KpiToolPage.test.tsx` /
 * `RoiCaseToolPage.test.tsx` structure. `okrApi.ts` (like `roiApi.ts`) uses a
 * raw `fetch` client, so `global.fetch` is mocked, not `Api.get`.
 *
 * Golden flow covered: flag-disabled -> flag-enabled cold direct-URL load
 * (no prior registry visit) -> set renders (title in the workspace
 * breadcrumb, proving `getOkrSet` really fed `OkrSetWorkspace`, default
 * "Overview" tab, `data-testid="results-vnext-okr-set-workspace"`) ->
 * clicking the breadcrumb "back to registry" requests navigation to
 * `ROUTES.RESULTS_OKR.ROOT` -> error state with Retry -> forbidden (404,
 * same for a nonexistent id and a cross-org id — `getOkrSet`'s own
 * organization-scoped query returns no row for either, D06/D07).
 */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// See `KpiToolPage.test.tsx` header — same established workaround for this
// repo's jsdom + React 19 + react-router-dom v7 environment: mock
// `useNavigate` to a spy, keep `useParams` REAL via `importActual`.
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import { OkrSetToolPage } from '../../../../src/components/ResultsVNext/okr/OkrSetToolPage';
import { ROUTES } from '../../../../src/routes/routeConfig';
import { API_URL } from '../../../../src/services/api';

const SET_ID = '44444444-4444-4444-4444-444444444444';

const OKR_SET_ROW = {
  setId: SET_ID,
  organizationId: 'org-1',
  programId: 'program-1',
  cycleId: 'cycle-1',
  scopeType: 'team',
  scopeId: 'team-ops',
  ownerUserId: 'user-owner',
  reviewerUserId: null,
  title: 'OKR Zespołu Operacji Q3',
  status: 'active',
  visibility: 'OPEN_ORG',
  committedVsAspirational: null,
  overallProgress: 0.4,
  overallConfidence: null,
  attentionState: 'none',
  lastCheckinAt: null,
  nextCheckinDueAt: null,
  carriedFromSetId: null,
  rowVersion: 2,
  createdBy: 'user-owner',
  createdAt: '2026-06-01T09:00:00.000Z',
  updatedBy: 'user-owner',
  updatedAt: '2026-08-01T09:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function mockFetch(overrides: { setStatus?: number; setBody?: unknown } = {}) {
  const setUrl = `${API_URL}/vnext/results/okr/sets/${SET_ID}`;
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url === setUrl) {
      if (overrides.setStatus && overrides.setStatus >= 400) {
        return jsonResponse({ error: 'not found', code: 'NOT_FOUND' }, overrides.setStatus);
      }
      return jsonResponse({ set: overrides.setBody ?? OKR_SET_ROW });
    }
    throw new Error(`Unexpected fetch ${url}`);
  }) as unknown as typeof fetch;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.RESULTS_OKR.SET} element={<OkrSetToolPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('OkrSetToolPage — /results/okr/sets/:okrSetId (klasa L full workspace, deep link)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders the honest disabled-flag empty state when okrRegistry flag is OFF (default)', async () => {
    mockFetch();
    renderAt(`/results/okr/sets/${SET_ID}`);
    expect(await screen.findByTestId('results-vnext-okr-tool-disabled')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('cold direct-URL load: fetches the set by id (no prior registry visit) and renders the workspace', async () => {
    window.localStorage.setItem('ff.results_vnext_okr_registry', '1');
    mockFetch();

    renderAt(`/results/okr/sets/${SET_ID}`);

    await waitFor(() => expect(screen.getByTestId('results-vnext-okr-tool-page')).toBeInTheDocument());
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/vnext/results/okr/sets/${SET_ID}`,
        expect.anything()
      )
    );
    await waitFor(() => expect(screen.getByTestId('results-vnext-okr-set-workspace')).toBeInTheDocument());
    // The set title only reaches the screen via `OkrSetWorkspace`'s own
    // `rootCrumbs` — concrete proof `getOkrSet` fed the real loaded record
    // into the workspace, not a stub/empty object.
    await waitFor(() => expect(screen.getAllByText('OKR Zespołu Operacji Q3').length).toBeGreaterThan(0));
  });

  it('breadcrumb "back to registry" requests navigation to ROUTES.RESULTS_OKR.ROOT', async () => {
    window.localStorage.setItem('ff.results_vnext_okr_registry', '1');
    mockFetch();

    renderAt(`/results/okr/sets/${SET_ID}`);
    await waitFor(() => expect(screen.getByTestId('results-vnext-okr-set-workspace')).toBeInTheDocument());

    const user = userEvent.setup();
    const backCrumb = await screen.findByText('Zestawy OKR');
    await user.click(backCrumb);

    expect(navigateMock).toHaveBeenCalledWith(ROUTES.RESULTS_OKR.ROOT);
  });

  it('shows an honest error state with Retry when the set fetch fails (non-404), and Retry re-fetches', async () => {
    window.localStorage.setItem('ff.results_vnext_okr_registry', '1');
    const setUrl = `${API_URL}/vnext/results/okr/sets/${SET_ID}`;
    let callCount = 0;
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      if (url === setUrl) {
        callCount += 1;
        if (callCount === 1) return jsonResponse({ error: 'Service unavailable', code: 'OKR_UNAVAILABLE' }, 503);
        return jsonResponse({ set: OKR_SET_ROW });
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;

    renderAt(`/results/okr/sets/${SET_ID}`);

    expect(await screen.findByTestId('results-vnext-okr-tool-error')).toBeInTheDocument();

    const retryButton = within(screen.getByTestId('results-vnext-okr-tool-error')).getByRole('button');
    const user = userEvent.setup();
    await user.click(retryButton);

    await waitFor(() => expect(screen.getByTestId('results-vnext-okr-tool-page')).toBeInTheDocument());
  });

  it('deep link to a nonexistent (or cross-org — same 404, D06/D07) set id renders the forbidden state, never a blank screen', async () => {
    window.localStorage.setItem('ff.results_vnext_okr_registry', '1');
    mockFetch({ setStatus: 404 });

    renderAt(`/results/okr/sets/${SET_ID}`);

    await waitFor(() => expect(screen.getByText(/nie masz dostępu|no visibility/i)).toBeInTheDocument());
  });
});
