/**
 * @vitest-environment jsdom
 *
 * KPI-E006 D13 — component test for the "Ask Teresa" action wired into
 * `KpiDeviationCaseSubview.tsx`'s Phase 2 (root cause analysis), the
 * `reflection_rca` advisor mode (see
 * `src/components/ResultsVNext/kpiTool/kpiTeresaRcaDraft.ts` for the client
 * wiring, and `tests/resultsVnext/teresa-kpi-e2e-no-silent-approval.test.ts`
 * for the real-Postgres proof that `executeProposal` really commits this
 * write via `submitRootCause` with the APPROVING HUMAN as actor).
 *
 * This is the REAL production `KpiDeviationCaseSubview` — no reimplementation
 * — driven through `userEvent`/`fireEvent`, mounted at its real route.
 * `teresaProposalApi.ts` is mocked (same convention as
 * `tests/components/ResultsVNext/teresa/TeresaProposalPanel.test.tsx`) so
 * this file can drive the P08 propose/approve/reject/execute state machine
 * deterministically without a live server.
 *
 * D13 negative controls covered (not just the happy path):
 *  - the "Ask Teresa" action stays disabled until the human has actually
 *    typed both root-cause fields — Teresa cannot be asked to carry empty
 *    content through the pipeline;
 *  - REJECTION before execute — no `executeTeresaProposal` call, the case's
 *    own state (still `analysis_required`, root cause fields still empty)
 *    is UNCHANGED, proving Teresa's mere involvement writes nothing on its
 *    own;
 *  - a DENIAL at execute time renders as blocked, `loadCase` is never
 *    triggered (no optimistic success), and the manual form is still
 *    usable afterward (manual path survives a Teresa denial);
 *  - happy path: approve -> execute -> the panel's `onCompleted` re-fetches
 *    the case from the server (`Api.get` called again) rather than
 *    approximating the state transition locally.
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
  Api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  API_URL: '/api',
  getHeaders: () => ({}),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const createTeresaProposal = vi.fn();
const approveTeresaProposal = vi.fn();
const rejectTeresaProposal = vi.fn();
const executeTeresaProposal = vi.fn();
const getTeresaAuditTrail = vi.fn();

// Same isolation convention as `TeresaProposalPanel.test.tsx` — mock the
// hand-written fetch client directly rather than trying to intercept
// `window.fetch`, so this file exercises the REAL `TeresaProposalPanel` /
// `kpiTeresaRcaDraft.ts` call sites (what gets sent) without a live server.
vi.mock('../../../src/components/ResultsVNext/teresa/teresaProposalApi', () => {
  class TeresaProposalApiError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string) {
      super(message);
      this.name = 'TeresaProposalApiError';
      this.status = status;
      this.code = code;
    }
  }
  return {
    TeresaProposalApiError,
    createTeresaProposal: (...args: unknown[]) => createTeresaProposal(...args),
    approveTeresaProposal: (...args: unknown[]) => approveTeresaProposal(...args),
    rejectTeresaProposal: (...args: unknown[]) => rejectTeresaProposal(...args),
    executeTeresaProposal: (...args: unknown[]) => executeTeresaProposal(...args),
    getTeresaAuditTrail: (...args: unknown[]) => getTeresaAuditTrail(...args),
  };
});

import { Api } from '../../../src/services/api';
import { KpiDeviationCaseSubview } from '../../../src/components/ResultsVNext/kpiTool/KpiDeviationCaseSubview';
import { ROUTES } from '../../../src/routes/routeConfig';

const KPI_ID = '11111111-1111-1111-1111-111111111111';
const CASE_ID = '22222222-2222-2222-2222-222222222222';

function baseCase(overrides: Record<string, unknown> = {}) {
  return {
    caseId: CASE_ID,
    organizationId: 'org-1',
    kpiId: KPI_ID,
    triggerMeasurementId: 'm-1',
    severity: 'critical',
    status: 'analysis_required',
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
    rowVersion: 2,
    createdBy: 'system',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

const proposalEnvelope = (overrides: Record<string, unknown> = {}) => ({
  proposalId: 'tprop-kpi-1',
  contractId: 'teresa_copilot_v1',
  title: 'Record root cause analysis',
  summary: 'append',
  state: 'proposal',
  approvalState: 'awaiting_review',
  allowedActions: ['approve', 'reject', 'navigate'],
  targetModule: 'kpi',
  targetLabel: 'KPI',
  handoffIntent: 'append',
  previewLines: [],
  auditCount: 1,
  resultRef: null,
  degraded: null,
  ...overrides,
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.RESULTS_KPI.DEVIATION_CASE} element={<KpiDeviationCaseSubview />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('KpiDeviationCaseSubview — "Ask Teresa" (reflection_rca, D13 governed pipeline)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
  });

  it('the "Ask Teresa" action is disabled until both root-cause fields are filled — Teresa cannot carry empty content', async () => {
    let currentCase = baseCase();
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === `/vnext/results/kpi/deviation-cases/${CASE_ID}`) return { case: currentCase };
      if (url.startsWith(`/vnext/results/kpi/${KPI_ID}/measurements`)) return { measurements: [] };
      throw new Error(`Unexpected GET ${url}`);
    });

    renderAt(`/results/kpi/${KPI_ID}/deviation-cases/${CASE_ID}`);
    const askTeresaBtn = await screen.findByTestId('kpi-deviation-ask-teresa-rca');
    expect(askTeresaBtn).toBeDisabled();

    fireEvent.change(screen.getByTestId('kpi-deviation-root-cause-summary'), {
      target: { value: 'Vendor SLA breach caused the miss' },
    });
    expect(askTeresaBtn).toBeDisabled();
    fireEvent.change(screen.getByTestId('kpi-deviation-root-cause-category'), {
      target: { value: 'external_dependency' },
    });
    expect(askTeresaBtn).not.toBeDisabled();
    expect(createTeresaProposal).not.toHaveBeenCalled();
  });

  it('REJECTION before execute — no execute call, no domain write, case state and form untouched', async () => {
    let currentCase = baseCase();
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === `/vnext/results/kpi/deviation-cases/${CASE_ID}`) return { case: currentCase };
      if (url.startsWith(`/vnext/results/kpi/${KPI_ID}/measurements`)) return { measurements: [] };
      throw new Error(`Unexpected GET ${url}`);
    });
    createTeresaProposal.mockResolvedValue(proposalEnvelope());
    rejectTeresaProposal.mockResolvedValue(
      proposalEnvelope({ state: 'rejected', approvalState: 'rejected', allowedActions: ['navigate'] })
    );

    renderAt(`/results/kpi/${KPI_ID}/deviation-cases/${CASE_ID}`);
    fireEvent.change(await screen.findByTestId('kpi-deviation-root-cause-summary'), {
      target: { value: 'Vendor SLA breach caused the miss' },
    });
    fireEvent.change(screen.getByTestId('kpi-deviation-root-cause-category'), {
      target: { value: 'external_dependency' },
    });
    fireEvent.click(screen.getByTestId('kpi-deviation-ask-teresa-rca'));

    await waitFor(() => expect(createTeresaProposal).toHaveBeenCalledTimes(1));
    expect(createTeresaProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: `kpi-deviation-teresa-${CASE_ID}`,
        targetModule: 'kpi',
        targetPayload: expect.objectContaining({
          kpi_handoff_context: expect.objectContaining({
            advisor_mode: 'reflection_rca',
            reflection_rca: expect.objectContaining({
              case_id: CASE_ID,
              proposed_root_cause_summary: 'Vendor SLA breach caused the miss',
              proposed_root_cause_category: 'external_dependency',
            }),
          }),
        }),
      })
    );

    fireEvent.click(await screen.findByTestId('teresa-reject-open'));
    fireEvent.click(screen.getByTestId('teresa-reject-confirm'));
    await waitFor(() => expect(rejectTeresaProposal).toHaveBeenCalledWith('tprop-kpi-1', undefined));

    expect(executeTeresaProposal).not.toHaveBeenCalled();
    // Negative control: the case was never re-fetched (no onCompleted call),
    // so it is still in analysis_required — no silent write happened.
    expect(Api.get).toHaveBeenCalledTimes(2); // initial case load + measurements load, no third
  });

  it('DENIAL at execute time renders as blocked and does not refetch the case', async () => {
    let currentCase = baseCase();
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === `/vnext/results/kpi/deviation-cases/${CASE_ID}`) return { case: currentCase };
      if (url.startsWith(`/vnext/results/kpi/${KPI_ID}/measurements`)) return { measurements: [] };
      throw new Error(`Unexpected GET ${url}`);
    });
    createTeresaProposal.mockResolvedValue(proposalEnvelope());
    approveTeresaProposal.mockResolvedValue(
      proposalEnvelope({ state: 'approved', approvalState: 'approved', allowedActions: ['execute', 'reject', 'navigate'] })
    );
    executeTeresaProposal.mockResolvedValue({
      execution: {
        success: false,
        proposal_id: 'tprop-kpi-1',
        target_module: 'kpi',
        state: 'rejected',
        audit_entry_id: 'taudit-9',
        error: 'DeviationSelfApprovalDeniedError-shaped guard fired downstream',
      },
      proposal: proposalEnvelope({ state: 'rejected', approvalState: 'rejected', allowedActions: ['navigate'] }),
    });

    renderAt(`/results/kpi/${KPI_ID}/deviation-cases/${CASE_ID}`);
    fireEvent.change(await screen.findByTestId('kpi-deviation-root-cause-summary'), {
      target: { value: 'Vendor SLA breach caused the miss' },
    });
    fireEvent.change(screen.getByTestId('kpi-deviation-root-cause-category'), {
      target: { value: 'external_dependency' },
    });
    fireEvent.click(screen.getByTestId('kpi-deviation-ask-teresa-rca'));
    await waitFor(() => expect(createTeresaProposal).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('teresa-approve'));
    await waitFor(() => expect(approveTeresaProposal).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('teresa-execute'));

    await waitFor(() => expect(executeTeresaProposal).toHaveBeenCalledWith('tprop-kpi-1'));
    expect(await screen.findByTestId('teresa-denied-banner')).toHaveTextContent('DeviationSelfApprovalDeniedError');
    // No refetch happened — the initial case load + measurements load only.
    expect(Api.get).toHaveBeenCalledTimes(2);
    // Manual form is still there and still usable after a Teresa denial.
    expect(screen.getByTestId('kpi-deviation-root-cause-summary')).toHaveValue('Vendor SLA breach caused the miss');
  });

  it('happy path: approve -> execute succeeds -> panel closes and the case is RE-FETCHED (not approximated locally)', async () => {
    let currentCase = baseCase();
    let getCallCount = 0;
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === `/vnext/results/kpi/deviation-cases/${CASE_ID}`) {
        getCallCount += 1;
        if (getCallCount > 1) {
          currentCase = {
            ...currentCase,
            status: 'plan_required',
            rootCauseSummary: 'Vendor SLA breach caused the miss',
            rootCauseCategory: 'external_dependency',
            rowVersion: 3,
          };
        }
        return { case: currentCase };
      }
      if (url.startsWith(`/vnext/results/kpi/${KPI_ID}/measurements`)) return { measurements: [] };
      throw new Error(`Unexpected GET ${url}`);
    });
    createTeresaProposal.mockResolvedValue(proposalEnvelope());
    approveTeresaProposal.mockResolvedValue(
      proposalEnvelope({ state: 'approved', approvalState: 'approved', allowedActions: ['execute', 'reject', 'navigate'] })
    );
    executeTeresaProposal.mockResolvedValue({
      execution: {
        success: true,
        proposal_id: 'tprop-kpi-1',
        target_module: 'kpi',
        state: 'completed',
        audit_entry_id: 'taudit-5',
        handoff_result: { case_id: CASE_ID, case_status: 'plan_required', real_entity: true },
      },
      proposal: proposalEnvelope({ state: 'completed', approvalState: 'completed', allowedActions: ['navigate'] }),
    });

    renderAt(`/results/kpi/${KPI_ID}/deviation-cases/${CASE_ID}`);
    fireEvent.change(await screen.findByTestId('kpi-deviation-root-cause-summary'), {
      target: { value: 'Vendor SLA breach caused the miss' },
    });
    fireEvent.change(screen.getByTestId('kpi-deviation-root-cause-category'), {
      target: { value: 'external_dependency' },
    });
    fireEvent.click(screen.getByTestId('kpi-deviation-ask-teresa-rca'));
    await waitFor(() => expect(createTeresaProposal).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('teresa-approve'));
    await waitFor(() => expect(approveTeresaProposal).toHaveBeenCalled());
    // *** "Teresa nie zatwierdza sama" negative control *** — approving is
    // NOT the same as executing. Between approve and the human's own
    // separate, explicit "Wykonaj" click, execute must never have fired.
    expect(executeTeresaProposal).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('teresa-execute'));

    await waitFor(() => expect(executeTeresaProposal).toHaveBeenCalledWith('tprop-kpi-1'));
    expect(await screen.findByTestId('teresa-completed-banner')).toBeInTheDocument();

    // The case was RE-FETCHED (getCallCount now 2) — server truth, not a
    // locally-approximated write.
    await waitFor(() => expect(getCallCount).toBeGreaterThan(1));
  });
});
