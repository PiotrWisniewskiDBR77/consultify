/**
 * @vitest-environment jsdom
 *
 * RN-G5 lane `teresa` (2026-08-12) — orchestrator-mandated follow-up on the
 * SHARED `TeresaProposalPanel` (`src/components/ResultsVNext/teresa/
 * TeresaProposalPanel.tsx`), the one component every domain (KPI/ROI/OKR)
 * reuses. Two properties D13 requires that the domain-specific test files
 * (ROI/KPI) do not exercise on their own, because both are properties of
 * the SHARED panel's own code, not of any one domain's wiring:
 *
 *  1. "Retry doesn't duplicate the command" (D13 point 7) — a UI-level
 *     property: does a rapid double-click, or a click-after-error retry,
 *     ever cause the panel to fire `executeTeresaProposal`/
 *     `createTeresaProposal` more times than the human actually clicked?
 *     This is provably a CLIENT bug if it happens (the server cannot fix a
 *     client that fires two HTTP requests for one gesture) — hence "to jest
 *     test UI, nie serwera" per the orchestrator's own framing.
 *  2. "Restricted outsider / cross-tenant actor gets nothing — not even
 *     crumbs" (D13 point 5) — a UI-level property: when the Teresa REST
 *     surface denies a request (403) or returns an empty/malformed body
 *     (the ABAC-safe "don't confirm the object exists" pattern), does the
 *     shared panel ever render anything from the error's `details`/`code`
 *     payload, or fabricate content from an empty response? The panel must
 *     structurally be unable to leak more than the literal `message`
 *     string the server chose to send — this is testable without a real
 *     403 body shape from the server, by mocking a WORST-CASE verbose
 *     error (as if a future regression on the server accidentally attached
 *     sensitive `details`) and proving the client never surfaces it.
 *
 * Both properties are tested here structurally (mocking
 * `teresaProposalApi.ts`, same isolation convention as
 * `TeresaProposalPanel.test.tsx`) rather than against a live server —
 * server-side ABAC/capability enforcement itself is out of this lane's
 * allowlist (`server/**` frozen) and NOT what these tests claim to prove.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createTeresaProposal = vi.fn();
const approveTeresaProposal = vi.fn();
const rejectTeresaProposal = vi.fn();
const executeTeresaProposal = vi.fn();
const getTeresaAuditTrail = vi.fn();

vi.mock('../../src/components/ResultsVNext/teresa/teresaProposalApi', () => {
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

import { TeresaProposalPanel } from '../../src/components/ResultsVNext/teresa/TeresaProposalPanel';
import { TeresaProposalApiError } from '../../src/components/ResultsVNext/teresa/teresaProposalApi';
import type { TeresaHandoffContext } from '../../src/components/ResultsVNext/teresa/teresaHandoffTypes';

function baseHandoffContext(): TeresaHandoffContext {
  return {
    origin: 'teresa',
    user_intent: 'Record root cause analysis for deviation case case-1',
    active_surface: 'results/kpi/kpi-1/deviation-cases/case-1',
    org_context_ref: 'org-1',
    bounded_context_pack: [],
    constraints: [],
    assumptions: [],
    uncertainty_boundary: { missing_inputs: [], conflicts: [], what_would_change_next_action: [] },
    evidence_pointers: ['deviation_case:case-1'],
    proposed_next_action: { target_module: 'kpi', handoff_intent: 'append', requires_approval: true },
    audit_stub: { actor: 'teresa', timestamp: '2026-08-12T09:00:00Z' },
  };
}

const proposalEnvelope = (overrides: Record<string, unknown> = {}) => ({
  proposalId: 'tprop-1',
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

function renderPanel(overrides: Partial<React.ComponentProps<typeof TeresaProposalPanel>> = {}) {
  const onClose = vi.fn();
  const onCompleted = vi.fn();
  const onManualFallback = vi.fn();
  render(
    <TeresaProposalPanel
      open
      onClose={onClose}
      isPolish
      title="Poproś Teresę o zapis analizy przyczyny"
      targetModule="kpi"
      sessionId="session-1"
      idempotencyKey="key-1"
      buildHandoffContext={baseHandoffContext}
      buildTargetPayload={() => ({ kpi_handoff_context: {}, evidence_pointers: ['deviation_case:case-1'] })}
      renderProposedChange={() => <p>Przyczyna: awaria czujnika</p>}
      evidenceBreakdown={{
        facts: ['Sprawa case-1, dotkliwość: critical.'],
        inference: [],
        missing_evidence: [],
        recommendation: 'Zatwierdź, aby zapisać.',
      }}
      evidencePointers={['deviation_case:case-1']}
      consequencePreview="Zostaną zapisane trzy pola sprawy odchylenia."
      onCompleted={onCompleted}
      onManualFallback={onManualFallback}
      {...overrides}
    />
  );
  return { onClose, onCompleted, onManualFallback };
}

/** A promise the test controls the resolution timing of — needed to
 * simulate "user double-clicks before the network round-trip returns". */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('TeresaProposalPanel — D13 point 7: retry does not duplicate the command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rapid double-click on "Wykonaj" (before the first request settles) fires executeTeresaProposal exactly once', async () => {
    createTeresaProposal.mockResolvedValue(proposalEnvelope());
    approveTeresaProposal.mockResolvedValue(
      proposalEnvelope({ state: 'approved', approvalState: 'approved', allowedActions: ['execute', 'reject', 'navigate'] })
    );
    const exec = deferred<{ execution: unknown; proposal: unknown }>();
    executeTeresaProposal.mockReturnValue(exec.promise);
    renderPanel();

    await waitFor(() => expect(createTeresaProposal).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('teresa-approve'));
    await waitFor(() => expect(approveTeresaProposal).toHaveBeenCalled());
    const executeBtn = await screen.findByTestId('teresa-execute');

    // First click starts the (still-pending) execute call.
    fireEvent.click(executeBtn);
    expect(executeTeresaProposal).toHaveBeenCalledTimes(1);
    // MEASURED, not assumed: the "Wykonaj" button does not merely become
    // `disabled` while executing — `phase` leaves 'approved' entirely
    // (-> 'executing'), and the button block is gated on
    // `phase === 'proposal' || phase === 'approved'`, so the button is
    // UNMOUNTED, not just disabled. This is a stronger guarantee than a
    // disabled-attribute race: there is no element left to double-click.
    expect(screen.queryByTestId('teresa-execute')).not.toBeInTheDocument();
    // A second `fireEvent.click` has nothing to click — simulate the
    // pathological case of a stale DOM reference (e.g. a queued double
    // native click event) by re-dispatching on the ORIGINAL button
    // reference, which React has since detached from the document.
    fireEvent.click(executeBtn);
    expect(executeTeresaProposal).toHaveBeenCalledTimes(1);

    // Let the deferred call resolve so the test doesn't leak a pending timer.
    exec.resolve({
      execution: { success: true, proposal_id: 'tprop-1', target_module: 'kpi', state: 'completed', audit_entry_id: 'taudit-1' },
      proposal: proposalEnvelope({ state: 'completed', approvalState: 'completed', allowedActions: ['navigate'] }),
    });
    await waitFor(() => expect(screen.getByTestId('teresa-proposal-panel')).toHaveAttribute('data-phase', 'completed'));
    // Final count after settling — still exactly one call for two clicks.
    expect(executeTeresaProposal).toHaveBeenCalledTimes(1);
  });

  it('a non-transport execute error re-enables "Wykonaj"; clicking retry re-issues the SAME proposal id exactly once — no new proposal, no double-fire', async () => {
    createTeresaProposal.mockResolvedValue(proposalEnvelope());
    approveTeresaProposal.mockResolvedValue(
      proposalEnvelope({ state: 'approved', approvalState: 'approved', allowedActions: ['execute', 'reject', 'navigate'] })
    );
    // A malformed-response-shaped failure (status 500, NOT status 0 — i.e.
    // NOT a transport/network failure) — `executeTeresaProposal`'s own
    // client throws this when a non-2xx body doesn't even carry
    // `data.execution` (see that function's header comment). This is the
    // one failure mode `handleExecute`'s catch routes back to
    // `phase:'approved'` (retryable), not `phase:'unavailable'`.
    executeTeresaProposal
      .mockRejectedValueOnce(new TeresaProposalApiError('Unexpected server error', 500, 'INTERNAL'))
      .mockResolvedValueOnce({
        execution: { success: true, proposal_id: 'tprop-1', target_module: 'kpi', state: 'completed', audit_entry_id: 'taudit-2' },
        proposal: proposalEnvelope({ state: 'completed', approvalState: 'completed', allowedActions: ['navigate'] }),
      });
    renderPanel();

    await waitFor(() => expect(createTeresaProposal).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByTestId('teresa-approve'));
    await waitFor(() => expect(approveTeresaProposal).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('teresa-execute'));
    await waitFor(() => expect(executeTeresaProposal).toHaveBeenCalledTimes(1));

    // Panel must fall back to the retryable 'approved' phase, NOT silently
    // stay 'executing' or jump to 'completed'.
    await waitFor(() => expect(screen.getByTestId('teresa-proposal-panel')).toHaveAttribute('data-phase', 'approved'));
    // Retry click — same proposal id, one more call, no new proposal ever
    // created (still exactly 1 createTeresaProposal call total).
    fireEvent.click(await screen.findByTestId('teresa-execute'));
    await waitFor(() => expect(executeTeresaProposal).toHaveBeenCalledTimes(2));
    expect(executeTeresaProposal).toHaveBeenNthCalledWith(1, 'tprop-1');
    expect(executeTeresaProposal).toHaveBeenNthCalledWith(2, 'tprop-1');
    expect(createTeresaProposal).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('teresa-proposal-panel')).toHaveAttribute('data-phase', 'completed'));
  });

  it('a TRANSPORT failure during execute abandons the approved proposal instead of blindly re-firing execute on it — retry creates a fresh proposal, the old one is never executed', async () => {
    createTeresaProposal
      .mockResolvedValueOnce(proposalEnvelope({ proposalId: 'tprop-old' }))
      .mockResolvedValueOnce(proposalEnvelope({ proposalId: 'tprop-new' }));
    // Echoes back whichever id it was actually called with — a static
    // `mockResolvedValue` would silently paper over the component sending
    // the wrong id (as an earlier draft of this test did, and caught
    // itself: it asserted 'tprop-new' but a stale static mock made the
    // component appear to send 'tprop-old' — that was a TEST bug, not a
    // component bug, exactly the kind of self-inflicted false positive
    // this program's own memory warns about).
    approveTeresaProposal.mockImplementation(async (proposalId: string) =>
      proposalEnvelope({ proposalId, state: 'approved', approvalState: 'approved', allowedActions: ['execute', 'reject', 'navigate'] })
    );
    executeTeresaProposal
      // First attempt (on tprop-old): genuine transport failure.
      .mockRejectedValueOnce(new TeresaProposalApiError('Network error contacting execute', 0, 'NETWORK_ERROR'))
      // Second attempt (after retry creates tprop-new and it gets approved+executed): succeeds.
      .mockResolvedValueOnce({
        execution: { success: true, proposal_id: 'tprop-new', target_module: 'kpi', state: 'completed', audit_entry_id: 'taudit-3' },
        proposal: proposalEnvelope({ proposalId: 'tprop-new', state: 'completed', approvalState: 'completed', allowedActions: ['navigate'] }),
      });
    renderPanel({ idempotencyKey: 'key-1' });

    await waitFor(() => expect(createTeresaProposal).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByTestId('teresa-approve'));
    await waitFor(() => expect(approveTeresaProposal).toHaveBeenCalledWith('tprop-old'));
    fireEvent.click(await screen.findByTestId('teresa-execute'));
    await waitFor(() => expect(executeTeresaProposal).toHaveBeenCalledWith('tprop-old'));

    // Transport failure routes to 'unavailable', NOT 'approved' — the old
    // proposal's fate (did the server actually receive/execute it?) is
    // genuinely unknown, so the panel does not offer a bare "retry execute"
    // on it.
    expect(await screen.findByTestId('teresa-unavailable-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('teresa-unavailable-retry'));

    await waitFor(() => expect(createTeresaProposal).toHaveBeenCalledTimes(2));
    fireEvent.click(await screen.findByTestId('teresa-approve'));
    await waitFor(() => expect(approveTeresaProposal).toHaveBeenCalledWith('tprop-new'));
    fireEvent.click(await screen.findByTestId('teresa-execute'));

    await waitFor(() => expect(executeTeresaProposal).toHaveBeenCalledTimes(2));
    // The OLD proposal id is never executed a second time — only the NEW
    // one is. Total distinct proposal ids ever passed to
    // executeTeresaProposal: {'tprop-old', 'tprop-new'}, each exactly once.
    expect(executeTeresaProposal).toHaveBeenNthCalledWith(1, 'tprop-old');
    expect(executeTeresaProposal).toHaveBeenNthCalledWith(2, 'tprop-new');
  });
});

describe('TeresaProposalPanel — D13 point 5: restricted/cross-tenant actor gets nothing, not even crumbs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('a 403 denial at proposal-creation time renders only a generic banner — no detail/code payload ever reaches the DOM', async () => {
    createTeresaProposal.mockRejectedValue(
      new TeresaProposalApiError('Forbidden', 403, 'P08_CAPABILITY_DENIED', {
        // Worst-case, deliberately leaky server body — as if a future
        // server regression attached crumbs. This test's job is to prove
        // the CLIENT structurally cannot surface `details`, regardless of
        // what the server puts there.
        organizationId: 'org-acme-secret',
        organizationName: 'Acme Corp Sp. z o.o.',
        existingProposalCount: 14,
        relatedCaseIds: ['case-9', 'case-10'],
      })
    );
    renderPanel();

    // The panel resolves to SOME visible state (not stuck on "thinking").
    await waitFor(() => expect(createTeresaProposal).toHaveBeenCalledTimes(1));
    const panel = await screen.findByTestId('teresa-proposal-panel');
    await waitFor(() => expect(panel).not.toHaveAttribute('data-phase', 'thinking'));

    const fullText = document.body.textContent ?? '';
    for (const crumb of ['org-acme-secret', 'Acme Corp', 'existingProposalCount', '14', 'case-9', 'case-10', 'P08_CAPABILITY_DENIED']) {
      expect(fullText).not.toContain(crumb);
    }
    // The proposed-change/evidence/consequence-preview block (built from
    // the CALLER's already-visible domain data) must not render either —
    // the panel does not know the actor is allowed to see the outcome of
    // this attempt, so it shows nothing beyond a generic denial.
    expect(screen.queryByTestId('teresa-evidence-breakdown')).not.toBeInTheDocument();
    expect(screen.queryByText('Przyczyna: awaria czujnika')).not.toBeInTheDocument();
    // Nothing was ever approved/executed.
    expect(approveTeresaProposal).not.toHaveBeenCalled();
    expect(executeTeresaProposal).not.toHaveBeenCalled();
  });

  it('an empty/malformed success body (ABAC "return nothing" pattern) does not crash and does not fabricate content', async () => {
    // Simulates a server that, instead of a 403, answers a restricted
    // actor's proposal-creation call with an empty `data` — the "don't
    // even confirm whether the object exists" ABAC pattern. The client
    // function's own contract (`teresaProposalApi.ts`) returns
    // `body.data as TeresaChatProposalEnvelope`, so an empty body resolves
    // to `undefined` rather than throwing.
    createTeresaProposal.mockResolvedValue(undefined as never);
    renderPanel();

    await waitFor(() => expect(createTeresaProposal).toHaveBeenCalledTimes(1));
    // Must not crash (render completes without throwing) and must not print
    // "undefined" anywhere in the DOM.
    const panel = await screen.findByTestId('teresa-proposal-panel');
    expect(panel).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(/undefined/i);
    // Approve/Reject controls may render (phase moved to 'proposal'), but
    // clicking Approve on a missing proposal must be a safe no-op, not a
    // crash and not a call with an undefined id.
    const approveBtn = screen.queryByTestId('teresa-approve');
    if (approveBtn) {
      fireEvent.click(approveBtn);
    }
    expect(approveTeresaProposal).not.toHaveBeenCalled();
  });

  it('a 403 denial at EXECUTE time never renders execution.error verbatim beyond what the server literally sent, and never surfaces details/code', async () => {
    createTeresaProposal.mockResolvedValue(proposalEnvelope());
    approveTeresaProposal.mockResolvedValue(
      proposalEnvelope({ state: 'approved', approvalState: 'approved', allowedActions: ['execute', 'reject', 'navigate'] })
    );
    executeTeresaProposal.mockRejectedValue(
      new TeresaProposalApiError('Forbidden', 403, 'P08_CAPABILITY_DENIED', {
        organizationName: 'Other Tenant Sp. z o.o.',
        actorRole: 'restricted_external',
      })
    );
    renderPanel();

    await waitFor(() => expect(createTeresaProposal).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('teresa-approve'));
    await waitFor(() => expect(approveTeresaProposal).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('teresa-execute'));
    await waitFor(() => expect(executeTeresaProposal).toHaveBeenCalled());

    const fullText = document.body.textContent ?? '';
    expect(fullText).not.toContain('Other Tenant');
    expect(fullText).not.toContain('restricted_external');
    expect(fullText).not.toContain('P08_CAPABILITY_DENIED');
  });
});
