/**
 * @vitest-environment jsdom
 *
 * RN-G3 lane (KPI full tool, klasa L) — component test for
 * `src/components/ResultsVNext/kpiTool/KpiDeviationCaseSubview.tsx` at
 * `/results/kpi/:kpiId/deviation-cases/:caseId` (D05 subview).
 *
 * GOLDEN FLOW covered end-to-end, each step asserting the REAL POST body and
 * the REAL resulting UI state (never a mocked component standing in for this
 * one — this IS the production component):
 *   open -> acknowledge -> analysis_required -> submit root cause ->
 *   plan_required -> add corrective action -> submit plan -> plan_submitted
 *   -> approve plan -> approved -> (corrective action reaches active,
 *   auto-transitions to executing) -> record recovery observation ->
 *   recovery_observed -> submit effectiveness verification -> verification
 *   -> close case -> closed.
 * Plus: self-approval denial surfaced verbatim (maker-checker), and the
 * honest "no GET for corrective actions" gap banner is always visible.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import { Api } from '../../../src/services/api';
import { KpiDeviationCaseSubview } from '../../../src/components/ResultsVNext/kpiTool/KpiDeviationCaseSubview';
import { ROUTES } from '../../../src/routes/routeConfig';

const KPI_ID = '11111111-1111-1111-1111-111111111111';
const CASE_ID = '22222222-2222-2222-2222-222222222222';
const ACTION_ID = '33333333-3333-3333-3333-333333333333';
const VERIFICATION_ID = '44444444-4444-4444-4444-444444444444';

function baseCase(overrides: Record<string, unknown> = {}) {
  return {
    caseId: CASE_ID,
    organizationId: 'org-1',
    kpiId: KPI_ID,
    triggerMeasurementId: 'm-1',
    severity: 'critical',
    status: 'open',
    escalated: false,
    escalatedAt: null,
    escalatedReason: null,
    escalatedBy: null,
    ownerUserId: 'user-owner',
    managerUserId: null,
    detectedAt: '2026-08-01T00:00:00.000Z',
    responseDueAt: '2026-08-03T00:00:00.000Z',
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
    ...overrides,
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.RESULTS_KPI.DEVIATION_CASE} element={<KpiDeviationCaseSubview />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('KpiDeviationCaseSubview — /results/kpi/:kpiId/deviation-cases/:caseId (D05 subview)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders the honest disabled-flag empty state when kpiRegistry flag is OFF (default)', async () => {
    renderAt(`/results/kpi/${KPI_ID}/deviation-cases/${CASE_ID}`);
    expect(await screen.findByTestId('kpi-deviation-case-disabled')).toBeInTheDocument();
    expect(Api.get).not.toHaveBeenCalled();
  });

  it('deep link to a case the caller cannot see (404) renders the forbidden state', async () => {
    window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
    const notFound = Object.assign(new Error('Not found'), { status: 404, data: { code: 'NOT_FOUND' } });
    vi.mocked(Api.get).mockImplementation(async () => {
      throw notFound;
    });

    renderAt(`/results/kpi/${KPI_ID}/deviation-cases/${CASE_ID}`);

    await waitFor(() => expect(screen.getByText(/nie masz dostępu/i)).toBeInTheDocument());
  });

  it('GOLDEN FLOW: open -> acknowledge -> root cause -> plan -> approve -> recovery -> verification -> close, real POST bodies at every step', async () => {
    window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
    let currentCase = baseCase();

    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === `/vnext/results/kpi/deviation-cases/${CASE_ID}`) return { case: currentCase };
      if (url.startsWith(`/vnext/results/kpi/${KPI_ID}/measurements`)) {
        return { measurements: [{ measurementId: 'm-1', periodEnd: '2026-07-31', actualValue: 42 }] };
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    const user = userEvent.setup();
    renderAt(`/results/kpi/${KPI_ID}/deviation-cases/${CASE_ID}`);

    await screen.findByTestId('results-vnext-kpi-deviation-case-subview');
    await screen.findByTestId('kpi-deviation-phase-1');

    // Honest gap banner always visible (no GET for corrective actions).
    expect(screen.getByText(/brak endpointu odczytu listy działań korygujących/i)).toBeInTheDocument();

    // ── Step 1: acknowledge (open -> analysis_required) ──
    vi.mocked(Api.post).mockImplementationOnce(async (url: string, body: any) => {
      expect(url).toBe(`/vnext/results/kpi/deviation-cases/${CASE_ID}/acknowledge`);
      expect(body).toEqual({ expectedVersion: 1 });
      currentCase = { ...currentCase, status: 'analysis_required', rowVersion: 2 };
      return { outcome: 'applied', eventId: 'evt-1', resultingVersion: 2, case: currentCase };
    });
    await user.click(screen.getByText('Potwierdź'));
    await waitFor(() => expect(screen.getByTestId('kpi-deviation-root-cause-summary')).not.toBeDisabled());

    // ── Step 2: submit root cause (analysis_required -> plan_required) ──
    fireEvent.change(screen.getByTestId('kpi-deviation-root-cause-summary'), {
      target: { value: 'Supplier delay' },
    });
    fireEvent.change(screen.getByTestId('kpi-deviation-root-cause-category'), {
      target: { value: 'supply_chain' },
    });
    vi.mocked(Api.put).mockImplementationOnce(async (url: string, body: any) => {
      expect(url).toBe(`/vnext/results/kpi/deviation-cases/${CASE_ID}/root-cause`);
      expect(body).toMatchObject({
        expectedVersion: 2,
        rootCauseSummary: 'Supplier delay',
        rootCauseCategory: 'supply_chain',
      });
      currentCase = {
        ...currentCase,
        status: 'plan_required',
        rowVersion: 3,
        rootCauseSummary: 'Supplier delay',
        rootCauseCategory: 'supply_chain',
      };
      return { outcome: 'applied', eventId: 'evt-2', resultingVersion: 3, case: currentCase };
    });
    await user.click(screen.getByTestId('kpi-deviation-submit-root-cause'));
    await waitFor(() => expect(screen.getByTestId('kpi-deviation-action-title')).not.toBeDisabled());

    // ── Step 3: add a corrective action (session-local list) ──
    fireEvent.change(screen.getByTestId('kpi-deviation-action-title'), { target: { value: 'Switch supplier' } });
    fireEvent.change(screen.getByTestId('kpi-deviation-action-owner'), { target: { value: 'user-owner' } });
    vi.mocked(Api.post).mockImplementationOnce(async (url: string, body: any) => {
      expect(url).toBe(`/vnext/results/kpi/deviation-cases/${CASE_ID}/corrective-actions`);
      expect(body).toMatchObject({ title: 'Switch supplier', ownerUserId: 'user-owner' });
      return {
        outcome: 'applied',
        eventId: 'evt-3',
        resultingVersion: 1,
        action: {
          actionId: ACTION_ID,
          deviationCaseId: CASE_ID,
          organizationId: 'org-1',
          title: 'Switch supplier',
          description: null,
          ownerUserId: 'user-owner',
          dueDate: null,
          status: 'planned',
          expectedEffect: null,
          actualEffect: null,
          rowVersion: 1,
          createdBy: 'user-owner',
          createdAt: '2026-08-02T00:00:00.000Z',
          updatedAt: '2026-08-02T00:00:00.000Z',
        },
      };
    });
    await user.click(screen.getByTestId('kpi-deviation-add-action'));
    await screen.findByText('Switch supplier');

    // ── Step 4: submit plan (plan_required -> plan_submitted) ──
    vi.mocked(Api.post).mockImplementationOnce(async (url: string, body: any) => {
      expect(url).toBe(`/vnext/results/kpi/deviation-cases/${CASE_ID}/plan/submit`);
      expect(body).toEqual({ expectedVersion: 3 });
      currentCase = { ...currentCase, status: 'plan_submitted', rowVersion: 4, planSubmittedBy: 'user-a' };
      return { outcome: 'applied', eventId: 'evt-4', resultingVersion: 4, case: currentCase };
    });
    await user.click(screen.getByTestId('kpi-deviation-submit-plan'));
    await waitFor(() => expect(screen.getByTestId('kpi-deviation-approve-plan')).not.toBeDisabled());

    // ── Step 4b: approve plan REJECTED by self-approval (maker-checker, D06 —
    // not a security-existence denial, the exact server message is shown) ──
    const selfApprovalError = Object.assign(new Error('Cannot approve your own plan'), {
      status: 403,
      data: { code: 'SELF_APPROVAL_DENIED', error: 'Cannot approve your own plan' },
    });
    vi.mocked(Api.post).mockImplementationOnce(async () => {
      throw selfApprovalError;
    });
    await user.click(screen.getByTestId('kpi-deviation-approve-plan'));
    await screen.findByTestId('kpi-deviation-error');
    expect(screen.getByTestId('kpi-deviation-error')).toHaveTextContent('Cannot approve your own plan');

    // ── Step 5: approve plan succeeds (second, authorized attempt) ──
    vi.mocked(Api.post).mockImplementationOnce(async (url: string, body: any) => {
      expect(url).toBe(`/vnext/results/kpi/deviation-cases/${CASE_ID}/plan/approve`);
      expect(body).toEqual({ expectedVersion: 4 });
      currentCase = { ...currentCase, status: 'approved', rowVersion: 5, planApprovedBy: 'user-b' };
      return { outcome: 'applied', eventId: 'evt-5', resultingVersion: 5, case: currentCase };
    });
    await user.click(screen.getByTestId('kpi-deviation-approve-plan'));
    // Case is now 'approved' — the approve button is no longer actionable
    // (phase 4 is no longer current) and the recovery-observation control in
    // phase 5 becomes reachable once 'executing' — approved gates it off
    // still (only executing/recovery_observed enable it), so assert via the
    // action-status select becoming available instead (isApproved gate).
    await waitFor(() => expect(screen.getByTestId('kpi-deviation-approve-plan')).toBeDisabled());

    // ── Step 6: move the corrective action to 'active' -> case auto-transitions to 'executing' ──
    vi.mocked(Api.patch).mockImplementationOnce(async (url: string, body: any) => {
      expect(url).toBe(`/vnext/results/kpi/deviation-cases/${CASE_ID}/corrective-actions/${ACTION_ID}`);
      expect(body).toMatchObject({ expectedVersion: 1, status: 'active' });
      return {
        outcome: 'applied',
        eventId: 'evt-6',
        resultingVersion: 2,
        action: { actionId: ACTION_ID, status: 'active', rowVersion: 2 },
        caseAutoTransitionedToExecuting: true,
      };
    });
    currentCase = { ...currentCase, status: 'executing', rowVersion: 6 };
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === `/vnext/results/kpi/deviation-cases/${CASE_ID}`) return { case: currentCase };
      return { measurements: [{ measurementId: 'm-1', periodEnd: '2026-07-31', actualValue: 42 }] };
    });
    const statusSelect = await screen.findByTestId(`kpi-deviation-action-status-${ACTION_ID}`);
    fireEvent.change(statusSelect, { target: { value: 'active' } });
    await waitFor(() => expect(Api.patch).toHaveBeenCalled());

    // ── Step 7: record recovery observation (executing -> recovery_observed) ──
    await waitFor(() => expect(screen.getByTestId('kpi-deviation-recovery-measurement')).not.toBeDisabled());
    fireEvent.change(screen.getByTestId('kpi-deviation-recovery-measurement'), { target: { value: 'm-1' } });
    vi.mocked(Api.post).mockImplementationOnce(async (url: string, body: any) => {
      expect(url).toBe(`/vnext/results/kpi/deviation-cases/${CASE_ID}/recovery-observation`);
      expect(body).toEqual({ expectedVersion: 6, recoveryObservationMeasurementId: 'm-1' });
      currentCase = { ...currentCase, status: 'recovery_observed', rowVersion: 7 };
      return { outcome: 'applied', eventId: 'evt-7', resultingVersion: 7, case: currentCase };
    });
    await user.click(screen.getByText('Zapisz obserwację odbudowy'));
    await waitFor(() => expect(Api.post).toHaveBeenCalledWith(
      `/vnext/results/kpi/deviation-cases/${CASE_ID}/recovery-observation`,
      expect.anything()
    ));

    // ── Step 8: submit effectiveness verification (-> verification) ──
    // Window start/end date inputs — identify by proximity to the outcome select.
    const startInput = screen.getByTestId('kpi-deviation-verification-outcome').parentElement!.querySelectorAll('input[type="date"]')[0] as HTMLInputElement;
    const endInput = screen.getByTestId('kpi-deviation-verification-outcome').parentElement!.querySelectorAll('input[type="date"]')[1] as HTMLInputElement;
    fireEvent.change(startInput, { target: { value: '2026-08-05' } });
    fireEvent.change(endInput, { target: { value: '2026-08-10' } });
    fireEvent.change(screen.getByTestId('kpi-deviation-verification-outcome'), { target: { value: 'effective' } });
    vi.mocked(Api.post).mockImplementationOnce(async (url: string, body: any) => {
      expect(url).toBe(`/vnext/results/kpi/deviation-cases/${CASE_ID}/effectiveness-verifications`);
      expect(body).toMatchObject({
        expectedVersion: 7,
        verificationWindowStart: '2026-08-05',
        verificationWindowEnd: '2026-08-10',
        outcome: 'effective',
      });
      currentCase = { ...currentCase, status: 'verification', rowVersion: 8 };
      return {
        outcome: 'applied',
        eventId: 'evt-8',
        resultingVersion: 8,
        case: currentCase,
        verification: {
          verificationId: VERIFICATION_ID,
          deviationCaseId: CASE_ID,
          verificationWindowStart: '2026-08-05',
          verificationWindowEnd: '2026-08-10',
          status: 'effective',
          rationale: null,
          verifiedBy: null,
          verifiedAt: null,
        },
      };
    });
    await user.click(screen.getByTestId('kpi-deviation-submit-verification'));
    await waitFor(() => expect(screen.getByTestId('kpi-deviation-close-case')).not.toBeDisabled());

    // ── Step 9: close case (verification -> closed) ──
    vi.mocked(Api.post).mockImplementationOnce(async (url: string, body: any) => {
      expect(url).toBe(`/vnext/results/kpi/deviation-cases/${CASE_ID}/close`);
      expect(body).toEqual({ expectedVersion: 8 });
      currentCase = { ...currentCase, status: 'closed', rowVersion: 9, closedAt: '2026-08-11T00:00:00.000Z', closedBy: 'user-a' };
      return { outcome: 'applied', eventId: 'evt-9', resultingVersion: 9, case: currentCase };
    });
    await user.click(screen.getByTestId('kpi-deviation-close-case'));

    await waitFor(() => expect(screen.getByText('Zamknięta')).toBeInTheDocument());
    // Reopen affordance appears only once truly closed.
    expect(await screen.findByText('Wznów sprawę')).toBeInTheDocument();
  });
});
