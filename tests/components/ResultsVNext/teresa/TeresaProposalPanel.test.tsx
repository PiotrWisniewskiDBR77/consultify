/**
 * @vitest-environment jsdom
 *
 * RN-G4 lane `teresa` (FALA 2, 2026-08-11) — component test for the REAL
 * production `TeresaProposalPanel`
 * (`src/components/ResultsVNext/teresa/TeresaProposalPanel.tsx`), the
 * shared Teresa governance surface wired into ROI's PIR "Ask Teresa" action
 * (`pir_lessons_draft`).
 *
 * D13 mandates negative controls, not just the happy path:
 *   - REJECTION before execute (propose -> reject -> no domain write, no
 *     `executeTeresaProposal` call).
 *   - A DENIAL at execute time (`execution.success === false`, the exact
 *     shape `executeProposal`'s truth-preserving-failure branch returns for
 *     a real domain guard like ROI's `DISPOSITION_ALREADY_RECORDED`) —
 *     asserted to render as a blocked state, never as success, and
 *     `onCompleted` never fires.
 *   - TRANSPORT failure (Teresa unreachable) renders
 *     `TeresaUnavailableBanner` with a working `onManualFallback`.
 * Plus the happy path (propose -> approve -> execute -> success ->
 * `onCompleted` fires with the real execution result).
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createTeresaProposal = vi.fn();
const approveTeresaProposal = vi.fn();
const rejectTeresaProposal = vi.fn();
const executeTeresaProposal = vi.fn();
const getTeresaAuditTrail = vi.fn();

// Mocked WITHOUT `importActual` — the real module statically imports
// `@/services/api` (the ~19k-line `Api` object), which every other
// ResultsVNext component test in this repo also avoids loading for real
// (see `KpiDeviationCaseSubview.test.tsx`'s own header). `TeresaProposalApiError`
// is re-declared verbatim (same shape as the source file) so
// `instanceof` checks inside `TeresaProposalPanel` still work against the
// SAME mocked class both this test and the component import.
vi.mock('../../../../src/components/ResultsVNext/teresa/teresaProposalApi', () => {
  class TeresaProposalApiError extends Error {
    status: number;
    code?: string;
    details?: Record<string, unknown>;
    constructor(message: string, status: number, code?: string, details?: Record<string, unknown>) {
      super(message);
      this.name = 'TeresaProposalApiError';
      this.status = status;
      this.code = code;
      this.details = details;
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

import { TeresaProposalPanel } from '../../../../src/components/ResultsVNext/teresa/TeresaProposalPanel';
import { TeresaProposalApiError } from '../../../../src/components/ResultsVNext/teresa/teresaProposalApi';
import type { TeresaHandoffContext } from '../../../../src/components/ResultsVNext/teresa/teresaHandoffTypes';

function baseHandoffContext(): TeresaHandoffContext {
  return {
    origin: 'teresa',
    user_intent: 'Draft PIR lessons for case "Test case" (PIR #1)',
    active_surface: 'results/roi/case/case-1/learn/pir/pir-1',
    org_context_ref: 'org-1',
    bounded_context_pack: [],
    constraints: [],
    assumptions: [],
    uncertainty_boundary: { missing_inputs: [], conflicts: [], what_would_change_next_action: [] },
    evidence_pointers: ['roi_pir:pir-1'],
    proposed_next_action: { target_module: 'roi', handoff_intent: 'append', requires_approval: true },
    audit_stub: { actor: 'teresa', timestamp: '2026-08-11T09:00:00Z' },
  };
}

const proposalEnvelope = (overrides: Record<string, unknown> = {}) => ({
  proposalId: 'tprop-1',
  contractId: 'teresa_copilot_v1',
  title: 'Draft PIR lessons',
  summary: 'append',
  state: 'proposal',
  approvalState: 'awaiting_review',
  allowedActions: ['approve', 'reject', 'navigate'],
  targetModule: 'roi',
  targetLabel: 'ROI',
  handoffIntent: 'append',
  previewLines: [],
  auditCount: 1,
  resultRef: null,
  degraded: null,
  ...overrides,
});

function renderPanel(overrides: Partial<React.ComponentProps<typeof TeresaProposalPanel>> = {}) {
  const onClose = vi.fn();
  const onCompleted = vi.fn();
  const onManualFallback = vi.fn();
  render(
    <TeresaProposalPanel
      open
      onClose={onClose}
      isPolish
      title="Poproś Teresę o szkic wniosków"
      targetModule="roi"
      sessionId="session-1"
      idempotencyKey="key-1"
      buildHandoffContext={baseHandoffContext}
      buildTargetPayload={() => ({ roi_handoff_context: {}, evidence_pointers: ['roi_pir:pir-1'] })}
      renderProposedChange={() => <p>Szkic Teresy do przeglądu</p>}
      evidenceBreakdown={{
        facts: ['PIR #1, status: draft.'],
        inference: [],
        missing_evidence: ['Brak jeszcze wypełnionego pola „Wynik".'],
        recommendation: 'Przejrzyj szkic przed akceptacją.',
      }}
      evidencePointers={['roi_pir:pir-1']}
      consequencePreview="Zostaną zapisane wyłącznie dwie kolumny PIR."
      onCompleted={onCompleted}
      onManualFallback={onManualFallback}
      {...overrides}
    />
  );
  return { onClose, onCompleted, onManualFallback };
}

describe('TeresaProposalPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-creates a proposal on open and renders evidence + consequence preview before any decision', async () => {
    createTeresaProposal.mockResolvedValue(proposalEnvelope());
    renderPanel();

    await waitFor(() => expect(createTeresaProposal).toHaveBeenCalledTimes(1));
    expect(createTeresaProposal).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-1', targetModule: 'roi', idempotencyKey: 'key-1' })
    );
    expect(await screen.findByText('Szkic Teresy do przeglądu')).toBeInTheDocument();
    expect(screen.getByTestId('teresa-evidence-breakdown')).toBeInTheDocument();
    expect(screen.getByText('Zostaną zapisane wyłącznie dwie kolumny PIR.')).toBeInTheDocument();
    expect(screen.getByTestId('teresa-approve')).toBeInTheDocument();
    expect(screen.getByTestId('teresa-reject-open')).toBeInTheDocument();
    // Negative control: nothing executes without an explicit approve.
    expect(executeTeresaProposal).not.toHaveBeenCalled();
  });

  it('rejects a proposal BEFORE execute — no execute call, no domain write, decision recorded', async () => {
    createTeresaProposal.mockResolvedValue(proposalEnvelope());
    rejectTeresaProposal.mockResolvedValue(proposalEnvelope({ state: 'rejected', approvalState: 'rejected', allowedActions: ['navigate'] }));
    const { onCompleted } = renderPanel();

    await waitFor(() => expect(createTeresaProposal).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('teresa-reject-open'));
    fireEvent.change(screen.getByTestId('teresa-reject-reason'), { target: { value: 'Za wcześnie, wynik jeszcze nieznany.' } });
    fireEvent.click(screen.getByTestId('teresa-reject-confirm'));

    await waitFor(() => expect(rejectTeresaProposal).toHaveBeenCalledWith('tprop-1', 'Za wcześnie, wynik jeszcze nieznany.'));
    expect(executeTeresaProposal).not.toHaveBeenCalled();
    expect(approveTeresaProposal).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
    expect(await screen.findByTestId('teresa-ask-again')).toBeInTheDocument();
  });

  it('DENIAL at execute time (e.g. DISPOSITION_ALREADY_RECORDED-shaped guard) renders as blocked, never as success', async () => {
    createTeresaProposal.mockResolvedValue(proposalEnvelope());
    approveTeresaProposal.mockResolvedValue(
      proposalEnvelope({ state: 'approved', approvalState: 'approved', allowedActions: ['execute', 'reject', 'navigate'] })
    );
    executeTeresaProposal.mockResolvedValue({
      execution: {
        success: false,
        proposal_id: 'tprop-1',
        target_module: 'roi',
        state: 'rejected',
        audit_entry_id: 'taudit-9',
        error:
          'PIR pir-2 already has a recorded Teresa draft disposition ("rejected") — regenerating would silently invalidate a human decision',
        degraded: 'tool_unavailable',
      },
      proposal: proposalEnvelope({ state: 'rejected', approvalState: 'rejected', allowedActions: ['navigate'] }),
    });
    const { onCompleted } = renderPanel();

    await waitFor(() => expect(createTeresaProposal).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('teresa-approve'));
    await waitFor(() => expect(approveTeresaProposal).toHaveBeenCalledWith('tprop-1'));
    fireEvent.click(await screen.findByTestId('teresa-execute'));

    await waitFor(() => expect(executeTeresaProposal).toHaveBeenCalledWith('tprop-1'));
    expect(await screen.findByTestId('teresa-denied-banner')).toHaveTextContent('already has a recorded Teresa draft disposition');
    expect(screen.queryByTestId('teresa-completed-banner')).not.toBeInTheDocument();
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('happy path: propose -> approve -> execute succeeds -> onCompleted fires with the real execution result', async () => {
    createTeresaProposal.mockResolvedValue(proposalEnvelope());
    approveTeresaProposal.mockResolvedValue(
      proposalEnvelope({ state: 'approved', approvalState: 'approved', allowedActions: ['execute', 'reject', 'navigate'] })
    );
    const completedProposal = proposalEnvelope({ state: 'completed', approvalState: 'completed', allowedActions: ['navigate'] });
    executeTeresaProposal.mockResolvedValue({
      execution: {
        success: true,
        proposal_id: 'tprop-1',
        target_module: 'roi',
        state: 'completed',
        audit_entry_id: 'taudit-5',
        handoff_result: { pir_id: 'pir-1', real_entity: true },
      },
      proposal: completedProposal,
    });
    getTeresaAuditTrail.mockResolvedValue([
      { id: 'taudit-1', proposal_id: 'tprop-1', action: 'proposal_created', actor: 'teresa', timestamp: '2026-08-11T09:00:00Z', from_state: null, to_state: 'proposal', detail: null },
      { id: 'taudit-5', proposal_id: 'tprop-1', action: 'execution_completed', actor: 'roi_service', timestamp: '2026-08-11T09:05:00Z', from_state: 'executing', to_state: 'completed', detail: null },
    ]);
    const { onCompleted } = renderPanel();

    await waitFor(() => expect(createTeresaProposal).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('teresa-approve'));
    await waitFor(() => expect(approveTeresaProposal).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('teresa-execute'));

    await waitFor(() => expect(executeTeresaProposal).toHaveBeenCalledWith('tprop-1'));
    expect(await screen.findByTestId('teresa-completed-banner')).toBeInTheDocument();
    expect(onCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, audit_entry_id: 'taudit-5' }),
      expect.objectContaining({ state: 'completed' })
    );

    // Audit/historia step of the D13 pipeline.
    fireEvent.click(screen.getByTestId('teresa-load-audit'));
    await waitFor(() => expect(getTeresaAuditTrail).toHaveBeenCalledWith('tprop-1'));
    expect(await screen.findByTestId('teresa-audit-trail')).toHaveTextContent('execution_completed');
  });

  it('Teresa unavailable (transport failure) shows the banner AND a working manual fallback — the hard requirement', async () => {
    createTeresaProposal.mockRejectedValue(
      new TeresaProposalApiError('Network error contacting /api/v8/teresa/proposal: fetch failed', 0, 'NETWORK_ERROR')
    );
    const { onManualFallback, onClose } = renderPanel();

    expect(await screen.findByTestId('teresa-unavailable-banner')).toBeInTheDocument();
    expect(screen.getByTestId('teresa-unavailable-manual')).toBeInTheDocument();
    // Negative control: no proposal/approve/execute ever happened.
    expect(approveTeresaProposal).not.toHaveBeenCalled();
    expect(executeTeresaProposal).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('teresa-unavailable-manual'));
    expect(onManualFallback).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
