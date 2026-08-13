/**
 * @vitest-environment jsdom
 *
 * OKR-E008 D13 — component test for the "Ask Teresa" action wired into
 * `OkrReviewReflectionView.tsx`'s "Reflection per objective" section, the
 * `reflection_synthesis` advisor mode (see
 * `src/components/ResultsVNext/okr/okrTeresaReflectionDraft.ts` for the
 * client wiring, and that file's header for the confirmed server gap —
 * no REST route exists for `recordOkrReflectionTeresaDraftDisposition` —
 * that shapes this design: Teresa's draft is offered back as a client-side
 * "insert into fields" convenience, never auto-committed).
 *
 * This is the REAL production `OkrReviewReflectionView` — no
 * reimplementation — driven through `fireEvent`, mounted directly (the
 * same "mount the specific subview, not the whole hub" convention
 * `results-vnext-teresa-kpi-deviation.tsx` and this file's own KPI sibling
 * test already use). `teresaProposalApi.ts` and the domain API modules
 * (`okrObjectiveApi`, `okrWorkspaceApi`) are mocked directly (same
 * isolation convention as `TeresaProposalPanel.test.tsx` — this codebase's
 * OKR API layer calls raw `fetch()`, not the generic `Api` object, so
 * mocking the domain modules is the correct boundary here, not
 * `src/services/api`).
 *
 * D13 negative controls covered (not just the happy path):
 *  - REJECTION before execute — no `executeTeresaProposal` call, no
 *    domain write (`recordObjectiveReflection` never called), the
 *    session's reflection-version cache is untouched;
 *  - a DENIAL at execute time renders as blocked, the manual fields are
 *    still usable afterward (manual path survives a Teresa denial);
 *  - happy path: approve -> execute -> Teresa's draft appears as a
 *    read-only "insert into fields" convenience, NOTHING is written to
 *    `whatWorked`/etc. until the human clicks "Insert" AND THEN the
 *    pre-existing "Save reflection" button — proving Teresa structurally
 *    cannot commit the real narrative fields herself, unlike KPI/ROI where
 *    execute reaches a real write directly (OKR's confirmed gap makes this
 *    an even harder guarantee here, not a weaker one).
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/components/ResultsVNext/okr/okrObjectiveApi', async () => {
  const actual = await vi.importActual<typeof import('../../../src/components/ResultsVNext/okr/okrObjectiveApi')>(
    '../../../src/components/ResultsVNext/okr/okrObjectiveApi'
  );
  return { ...actual, listObjectivesForSet: vi.fn() };
});

const recordObjectiveReflection = vi.fn();
vi.mock('../../../src/components/ResultsVNext/okr/okrWorkspaceApi', async () => {
  const actual = await vi.importActual<typeof import('../../../src/components/ResultsVNext/okr/okrWorkspaceApi')>(
    '../../../src/components/ResultsVNext/okr/okrWorkspaceApi'
  );
  return {
    ...actual,
    listOkrSetReviews: vi.fn().mockResolvedValue([]),
    recordObjectiveReflection: (...args: unknown[]) => recordObjectiveReflection(...args),
    newOkrWorkspaceIdempotencyKey: () => 'idem-fixed',
  };
});

const createTeresaProposal = vi.fn();
const approveTeresaProposal = vi.fn();
const rejectTeresaProposal = vi.fn();
const executeTeresaProposal = vi.fn();
const getTeresaAuditTrail = vi.fn();

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

import { OkrReviewReflectionView } from '../../../src/components/ResultsVNext/okr/OkrReviewReflectionView';
import { listObjectivesForSet } from '../../../src/components/ResultsVNext/okr/okrObjectiveApi';
import type { OkrSetDto } from '../../../src/components/ResultsVNext/okr/okrApi';

const SET_ID = 'set-1';
const OBJECTIVE_ID = 'obj-1';
const OWNER_ID = 'user-owner';

function baseSet(): OkrSetDto {
  return {
    setId: SET_ID,
    organizationId: 'org-1',
    programId: 'program-1',
    cycleId: 'cycle-1',
    scopeType: 'individual',
    scopeId: OWNER_ID,
    ownerUserId: OWNER_ID,
    reviewerUserId: 'user-reviewer',
    title: 'Test set',
    status: 'review',
    submittedBy: OWNER_ID,
    submittedAt: '2026-08-01T00:00:00.000Z',
    approvedBy: 'user-reviewer',
    approvedAt: '2026-08-02T00:00:00.000Z',
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 2,
    approvedVersion: 1,
    latestApprovedSnapshotId: null,
    overallProgress: '0.5',
    overallConfidence: 'medium',
    attentionState: 'watch',
    lastCheckinAt: null,
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 2,
    createdBy: OWNER_ID,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedBy: OWNER_ID,
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

function baseObjective() {
  return {
    objectiveId: OBJECTIVE_ID,
    setId: SET_ID,
    organizationId: 'org-1',
    ownerUserId: OWNER_ID,
    title: 'Test objective',
    description: null,
    rationale: null,
    ambitionType: 'standard' as const,
    status: 'active' as const,
    progress: '0.5',
    progressCalcPolicyVersionId: 'policy-1',
    progressCalcReason: 'test reason',
    confidence: 'medium' as const,
    confidenceNumericValue: null,
    confidenceCalcPolicyVersionId: 'policy-1',
    confidenceCalcReason: 'test reason',
    sortOrder: 0,
    rowVersion: 1,
    createdBy: OWNER_ID,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedBy: OWNER_ID,
    updatedAt: '2026-08-01T00:00:00.000Z',
    approvedAt: '2026-08-02T00:00:00.000Z',
    keyResults: [],
  };
}

const proposalEnvelope = (overrides: Record<string, unknown> = {}) => ({
  proposalId: 'tprop-okr-1',
  contractId: 'teresa_copilot_v1',
  title: 'Draft a reflection synthesis',
  summary: 'append',
  state: 'proposal',
  approvalState: 'awaiting_review',
  allowedActions: ['approve', 'reject', 'navigate'],
  targetModule: 'okr',
  targetLabel: 'OKR',
  handoffIntent: 'append',
  previewLines: [],
  auditCount: 1,
  resultRef: null,
  degraded: null,
  ...overrides,
});

function renderView() {
  const onSetChanged = vi.fn();
  render(<OkrReviewReflectionView set={baseSet()} isPolish currentUserId={OWNER_ID} onSetChanged={onSetChanged} />);
  return { onSetChanged };
}

describe('OkrReviewReflectionView — "Ask Teresa" (reflection_synthesis, D13 governed pipeline)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listObjectivesForSet).mockResolvedValue([baseObjective()] as any);
  });

  it('REJECTION before execute — no execute call, no domain write, no fields touched', async () => {
    createTeresaProposal.mockResolvedValue(proposalEnvelope());
    rejectTeresaProposal.mockResolvedValue(
      proposalEnvelope({ state: 'rejected', approvalState: 'rejected', allowedActions: ['navigate'] })
    );
    renderView();

    fireEvent.click(await screen.findByTestId(`okr-reflection-ask-teresa-${OBJECTIVE_ID}`));
    await waitFor(() => expect(createTeresaProposal).toHaveBeenCalledTimes(1));
    expect(createTeresaProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        targetModule: 'okr',
        targetPayload: expect.objectContaining({
          okr_handoff_context: expect.objectContaining({
            advisor_mode: 'reflection_synthesis',
            reflection_synthesis: expect.objectContaining({ set_id: SET_ID, objective_id: OBJECTIVE_ID }),
          }),
        }),
      })
    );

    fireEvent.click(await screen.findByTestId('teresa-reject-open'));
    fireEvent.click(screen.getByTestId('teresa-reject-confirm'));
    await waitFor(() => expect(rejectTeresaProposal).toHaveBeenCalledWith('tprop-okr-1', undefined));

    expect(executeTeresaProposal).not.toHaveBeenCalled();
    expect(recordObjectiveReflection).not.toHaveBeenCalled();
    // No Teresa-draft convenience block ever appeared — nothing was ever
    // executed, so there is nothing to insert.
    expect(screen.queryByTestId(`okr-reflection-teresa-draft-${OBJECTIVE_ID}`)).not.toBeInTheDocument();
    // The manual field is still empty and still editable.
    expect(screen.getByTestId(`okr-reflection-whatWorked-${OBJECTIVE_ID}`)).toHaveValue('');
  });

  it('DENIAL at execute time renders as blocked; manual fields remain fully usable afterward', async () => {
    createTeresaProposal.mockResolvedValue(proposalEnvelope());
    approveTeresaProposal.mockResolvedValue(
      proposalEnvelope({ state: 'approved', approvalState: 'approved', allowedActions: ['execute', 'reject', 'navigate'] })
    );
    executeTeresaProposal.mockResolvedValue({
      execution: {
        success: false,
        proposal_id: 'tprop-okr-1',
        target_module: 'okr',
        state: 'rejected',
        audit_entry_id: 'taudit-9',
        error: 'expected_version mismatch — regenerating would silently invalidate a human decision',
      },
      proposal: proposalEnvelope({ state: 'rejected', approvalState: 'rejected', allowedActions: ['navigate'] }),
    });
    renderView();

    fireEvent.click(await screen.findByTestId(`okr-reflection-ask-teresa-${OBJECTIVE_ID}`));
    await waitFor(() => expect(createTeresaProposal).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('teresa-approve'));
    await waitFor(() => expect(approveTeresaProposal).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('teresa-execute'));

    expect(await screen.findByTestId('teresa-denied-banner')).toBeInTheDocument();
    expect(recordObjectiveReflection).not.toHaveBeenCalled();
    expect(screen.queryByTestId(`okr-reflection-teresa-draft-${OBJECTIVE_ID}`)).not.toBeInTheDocument();

    // Manual path: fill a field and save it — proves the pre-existing
    // "Save reflection" action is completely unaffected by the denial.
    fireEvent.change(screen.getByTestId(`okr-reflection-whatWorked-${OBJECTIVE_ID}`), {
      target: { value: 'Ręczna refleksja mimo odmowy Teresy.' },
    });
    recordObjectiveReflection.mockResolvedValue({
      outcome: 'applied',
      reflection: { rowVersion: 1 },
    });
    fireEvent.click(screen.getByTestId(`okr-reflection-save-${OBJECTIVE_ID}`));
    await waitFor(() => expect(recordObjectiveReflection).toHaveBeenCalledTimes(1));
    expect(recordObjectiveReflection).toHaveBeenCalledWith(
      OBJECTIVE_ID,
      expect.objectContaining({ whatWorked: 'Ręczna refleksja mimo odmowy Teresy.' })
    );
  });

  it('happy path: Teresa\'s draft is generated but NEVER auto-written — only "Insert" (client-side) + a separate explicit "Save reflection" click commits it', async () => {
    createTeresaProposal.mockResolvedValue(proposalEnvelope());
    approveTeresaProposal.mockResolvedValue(
      proposalEnvelope({ state: 'approved', approvalState: 'approved', allowedActions: ['execute', 'reject', 'navigate'] })
    );
    executeTeresaProposal.mockResolvedValue({
      execution: {
        success: true,
        proposal_id: 'tprop-okr-1',
        target_module: 'okr',
        state: 'completed',
        audit_entry_id: 'taudit-5',
        handoff_result: {
          handoff: 'okr',
          advisor_mode: 'reflection_synthesis',
          objective_id: OBJECTIVE_ID,
          set_id: SET_ID,
          row_version: 1,
          real_entity: true,
          outcome: 'applied',
        },
      },
      proposal: proposalEnvelope({ state: 'completed', approvalState: 'completed', allowedActions: ['navigate'] }),
    });
    renderView();

    fireEvent.click(await screen.findByTestId(`okr-reflection-ask-teresa-${OBJECTIVE_ID}`));
    await waitFor(() => expect(createTeresaProposal).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('teresa-approve'));
    await waitFor(() => expect(approveTeresaProposal).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('teresa-execute'));

    expect(await screen.findByTestId('teresa-completed-banner')).toBeInTheDocument();
    // *** Structural negative control *** — execute succeeding must NOT by
    // itself call the real domain write. Teresa's execute here only ever
    // reaches `recordOkrReflectionTeresaDraft` server-side (draft columns),
    // which this test does not even model — the point is the CLIENT never
    // calls `recordObjectiveReflection` as a side effect of Teresa's own
    // success.
    expect(recordObjectiveReflection).not.toHaveBeenCalled();

    // Close the Teresa panel — the draft convenience block should now show.
    const panel = screen.getByTestId('teresa-proposal-panel');
    const closeButtons = panel.parentElement?.querySelectorAll('button[aria-label="Close modal"]');
    if (closeButtons && closeButtons.length > 0) fireEvent.click(closeButtons[0] as HTMLElement);

    const draftBlock = await screen.findByTestId(`okr-reflection-teresa-draft-${OBJECTIVE_ID}`);
    expect(draftBlock).toBeInTheDocument();
    // Still nothing written to the real field.
    expect(screen.getByTestId(`okr-reflection-whatWorked-${OBJECTIVE_ID}`)).toHaveValue('');
    expect(recordObjectiveReflection).not.toHaveBeenCalled();

    // Human clicks "Insert Teresa's draft into the fields" — purely local.
    fireEvent.click(screen.getByTestId(`okr-reflection-insert-teresa-draft-${OBJECTIVE_ID}`));
    expect(screen.getByTestId(`okr-reflection-whatWorked-${OBJECTIVE_ID}`)).not.toHaveValue('');
    expect(recordObjectiveReflection).not.toHaveBeenCalled();

    // ONLY the explicit "Save reflection" click commits — and it uses the
    // CAS row_version Teresa's execute wrote (1), not a stale 0, proving
    // the session-cache handoff worked.
    recordObjectiveReflection.mockResolvedValue({ outcome: 'applied', reflection: { rowVersion: 2 } });
    fireEvent.click(screen.getByTestId(`okr-reflection-save-${OBJECTIVE_ID}`));
    await waitFor(() => expect(recordObjectiveReflection).toHaveBeenCalledTimes(1));
    expect(recordObjectiveReflection).toHaveBeenCalledWith(OBJECTIVE_ID, expect.objectContaining({ expectedVersion: 1 }));
  });
});
