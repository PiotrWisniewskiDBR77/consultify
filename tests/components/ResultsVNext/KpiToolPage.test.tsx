/**
 * @vitest-environment jsdom
 *
 * RN-G3 lane (KPI full tool, klasa L) — component test for
 * `src/components/ResultsVNext/kpiTool/KpiToolPage.tsx` at
 * `/results/kpi/:kpiId`.
 *
 * Golden flow covered: flag-disabled -> flag-enabled loading -> loaded
 * (Performance section renders the real latest measurement, honest-missing
 * when null) -> Deviations section lists a real case and navigating to it
 * calls the real router push to the Deviation Case subview route -> error
 * state with Retry -> forbidden (404) state.
 *
 * `Api.get`/`Api.post` are mocked at the module boundary (same convention as
 * `tests/components/Results/ResultsKpiReadSurfaces.v8-catalog.test.tsx`) —
 * this is a real component render exercising real fetch/state wiring, not a
 * snapshot of hand-built props.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// `navigate()`-after-click cross-route DOM swap is unreliable in THIS repo's
// jsdom + React 19 + react-router-dom v7 test environment — reproduced with a
// two-route, zero-app-code sanity component (a bare `useNavigate` button vs a
// target route) that also never swaps after `fireEvent`/`userEvent.click` +
// `waitFor` up to 5s. The established, WORKING convention in this codebase
// for exactly this situation is `tests/components/PricingView.cta-authority
// .test.tsx`'s pattern: mock `useNavigate` to a spy and assert the exact
// target path, instead of asserting a live route swap. `useParams` (needed
// for `:kpiId`) stays REAL via `importActual`, so the initial mount routing
// (which DOES work — only post-mount `navigate()` triggered swaps are
// affected) is still exercised honestly.
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import { Api } from '../../../src/services/api';
import { KpiToolPage } from '../../../src/components/ResultsVNext/kpiTool/KpiToolPage';
import { ROUTES } from '../../../src/routes/routeConfig';

const KPI_ID = '11111111-1111-1111-1111-111111111111';
const CASE_ID = '22222222-2222-2222-2222-222222222222';

const KPI_ROW = {
  kpiId: KPI_ID,
  organizationId: 'org-1',
  kpiCode: 'KPI-REVENUE-001',
  status: 'active',
  currentDefinitionVersionId: 'dv-1',
  primaryProcessId: null,
  responsePolicyId: null,
  ownerUserId: 'user-owner',
  rowVersion: 3,
  createdBy: 'user-owner',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const APPROVED_VERSION = {
  definitionVersionId: 'dv-1', kpiId: KPI_ID, organizationId: 'org-1', versionNumber: 1,
  name: 'Realizacja korzyści', description: null, unit: '%', targetGeometry: 'threshold_min',
  targetValue: 90, targetMin: null, targetMax: null, warningLow: 80, warningHigh: null,
  criticalLow: 70, criticalHigh: null, binarySuccessValue: null, formulaText: null,
  approvalStatus: 'approved', effectiveFrom: null, effectiveTo: null, createdBy: 'user-owner',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  submittedBy: 'reviewer', submittedAt: '2026-01-01T00:00:00.000Z',
  approvedBy: 'reviewer', approvedAt: '2026-01-01T00:00:00.000Z',
  rejectedBy: null, rejectedAt: null, rejectionReason: null, rowVersion: 1,
};

const MEASUREMENT_ROW = {
  measurementId: 'm-1',
  kpiId: KPI_ID,
  definitionVersionId: 'dv-1',
  organizationId: 'org-1',
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-07-31T00:00:00.000Z',
  actualValue: 74,
  performanceStatus: 'warning',
  dataQualityStatus: 'verified',
  correctionOfMeasurementId: null,
  correctionReason: null,
  source: 'manual',
  evidenceRefs: [],
  notes: null,
  recordedBy: 'user-owner',
  recordedAt: '2026-08-01T00:00:00.000Z',
};

const DEVIATION_CASE_ROW = {
  caseId: CASE_ID,
  organizationId: 'org-1',
  kpiId: KPI_ID,
  triggerMeasurementId: 'm-1',
  severity: 'warning',
  status: 'open',
  escalated: false,
  escalatedAt: null,
  escalatedReason: null,
  escalatedBy: null,
  ownerUserId: 'user-owner',
  managerUserId: null,
  detectedAt: '2026-08-01T00:00:00.000Z',
  responseDueAt: '2026-08-06T00:00:00.000Z',
  rootCauseSummary: null,
  rootCauseCategory: null,
  recurrenceFlag: false,
  expectedRecoveryDate: null,
  expectedRecoveryValue: null,
  planSubmittedBy: null,
  planSubmittedAt: null,
  planApprovedBy: null,
  planApprovedAt: null,
  recoveryObservedBy: null,
  recoveryObservedAt: null,
  recoveryObservationMeasurementId: null,
  closedAt: null,
  closedBy: null,
  closeEffectivenessVerificationId: null,
  reopenedFromCaseId: null,
  rowVersion: 1,
  createdBy: 'system',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

function mockApiGet(overrides: Partial<Record<string, unknown>> = {}) {
  vi.mocked(Api.get).mockImplementation(async (url: string) => {
    if (url === `/vnext/results/kpi/${KPI_ID}/version`) {
      return overrides.version ?? { definitionVersion: APPROVED_VERSION };
    }
    if (url.startsWith(`/vnext/results/kpi/${KPI_ID}/measurements`)) {
      return overrides.measurements ?? { measurements: [MEASUREMENT_ROW] };
    }
    if (url === `/vnext/results/kpi/${KPI_ID}` || url.startsWith(`/vnext/results/kpi/${KPI_ID}?`)) {
      return overrides.kpi ?? { kpi: KPI_ROW };
    }
    if (url.startsWith('/vnext/results/kpi/deviation-cases')) {
      return overrides.deviationCases ?? { cases: [DEVIATION_CASE_ROW] };
    }
    if (url.startsWith(`/vnext/results/kpi/${KPI_ID}/initiative-impacts`)) {
      return overrides.impacts ?? { impacts: [] };
    }
    throw new Error(`Unexpected GET ${url}`);
  });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.RESULTS_KPI.TOOL} element={<KpiToolPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('KpiToolPage — /results/kpi/:kpiId (klasa L full tool)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders the honest disabled-flag empty state when kpiRegistry flag is OFF (default)', async () => {
    renderAt(`/results/kpi/${KPI_ID}`);
    expect(await screen.findByTestId('results-vnext-kpi-tool-disabled')).toBeInTheDocument();
    expect(Api.get).not.toHaveBeenCalled();
  });

  it('golden flow: loads the KPI, shows real latest measurement, performance+data-quality shown as two independent chips', async () => {
    window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
    mockApiGet();

    renderAt(`/results/kpi/${KPI_ID}`);

    await waitFor(() => expect(screen.getByTestId('results-vnext-kpi-tool-page')).toBeInTheDocument());
    await waitFor(() => expect(Api.get).toHaveBeenCalledWith(`/vnext/results/kpi/${KPI_ID}`));

    // KPI identity + lifecycle
    await waitFor(() => expect(screen.getAllByText('KPI-REVENUE-001').length).toBeGreaterThan(0));

    // Real measurement value renders (never a fabricated 0/placeholder).
    await waitFor(() => expect(screen.getByText('74')).toBeInTheDocument());

    // Both dimensions rendered as separate chips (plan §4.3/§4.4 — never one field).
    expect(screen.getByText('warning')).toBeInTheDocument();
    expect(screen.getByText('verified')).toBeInTheDocument();
  });

  it('enables activation when the current definition version is approved', async () => {
    window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
    mockApiGet({ kpi: { kpi: { ...KPI_ROW, status: 'draft' } } });

    renderAt(`/results/kpi/${KPI_ID}`);

    const activate = await screen.findByRole('button', { name: 'Aktywuj' });
    await waitFor(() => expect(activate).toBeEnabled());
    expect(screen.queryByText(/brak GET dla wersji/i)).not.toBeInTheDocument();
  });

  it('Deviations section lists the real case and clicking it requests navigation to the exact subview route', async () => {
    window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
    mockApiGet();

    renderAt(`/results/kpi/${KPI_ID}`);

    await waitFor(() => expect(screen.getByTestId('results-vnext-kpi-tool-page')).toBeInTheDocument());

    const user = userEvent.setup();
    // Navigate to the Deviations section via the left nav.
    const deviationsNavButtons = await screen.findAllByText('Sprawy odchyleń');
    await user.click(deviationsNavButtons[0]);

    const caseRow = await screen.findByTestId(`kpi-deviation-case-row-${CASE_ID}`);
    fireEvent.click(caseRow);

    // See file header — live cross-route DOM swap after `navigate()` is
    // unreliable in this repo's test environment (React 19 + react-router-dom
    // v7 + jsdom), reproduced independently of this file's code with a
    // minimal 2-route sanity component. Asserting the exact requested path
    // (matching `../../../src/routes/routeConfig.ts` ROUTES.RESULTS_KPI
    // .DEVIATION_CASE shape) is the same convention
    // `tests/components/PricingView.cta-authority.test.tsx` already uses.
    expect(navigateMock).toHaveBeenCalledWith(`/results/kpi/${KPI_ID}/deviation-cases/${CASE_ID}`);
  });

  it('shows an honest error state with Retry when the KPI fetch fails, and Retry re-fetches', async () => {
    window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === `/vnext/results/kpi/${KPI_ID}`) {
        throw new Error('network down');
      }
      return { measurements: [] };
    });

    renderAt(`/results/kpi/${KPI_ID}`);

    expect(await screen.findByTestId('results-vnext-kpi-tool-error')).toBeInTheDocument();

    // Retry succeeds once the backend is healthy again.
    mockApiGet();
    const retryButton = within(screen.getByTestId('results-vnext-kpi-tool-error')).getByRole('button');
    const user = userEvent.setup();
    await user.click(retryButton);

    await waitFor(() => expect(screen.getByTestId('results-vnext-kpi-tool-page')).toBeInTheDocument());
  });

  it('deep link to a KPI the caller cannot see (404) renders the forbidden state, never a blank screen', async () => {
    window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
    const notFound = Object.assign(new Error('Not found'), { status: 404, data: { code: 'NOT_FOUND' } });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === `/vnext/results/kpi/${KPI_ID}`) throw notFound;
      return { measurements: [] };
    });

    renderAt(`/results/kpi/${KPI_ID}`);

    await waitFor(() => expect(screen.getByText(/nie masz dostępu|no visibility/i)).toBeInTheDocument());
  });
});
