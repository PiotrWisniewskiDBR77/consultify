/**
 * @vitest-environment jsdom
 *
 * FIN-06 — direct coverage of the shared `FinanceCandidateHandoffModal`
 * (Preview → Confirm → pending/progress → durable Candidate → fresh
 * read-back → deep link/reopen), independent of either call site.
 * ExportToOutputDialog.v8-proposals.test.tsx and
 * ValuationWorkspace.candidateHandoff.test.tsx already exercise this
 * component through its two real callers end-to-end; this file targets
 * behavior that's awkward to isolate through a full workspace render:
 *   - the `variant="standalone"` vs `variant="embedded"` chrome difference;
 *   - the `sourceSnapshot` summary (honest `'unknown'` → dash, never 0/blank);
 *   - `fetchHandoff`'s best-effort fresh read-back (a failed read-back never
 *     turns a real success into an error);
 *   - `keepOpenOnSuccess` keeping the modal open with a reopen link instead
 *     of auto-closing.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FinanceCandidateHandoffModal,
  type FinanceCandidateConfirmResult,
  type FinanceCandidatePreviewResult,
} from '../FinanceCandidateHandoffModal';

const eligiblePreview: FinanceCandidatePreviewResult = {
  eligible: true,
  preview: {
    title: 'Statement pack — FY2026 Q2',
    rationale: 'Readiness score 92/100; statements on file: P&L x1, BS x1, CF x1.',
    fitScore: 0.74,
    sourceType: 'finance_statement_pack',
    sourceId: 'pack-1',
    sourceSnapshot: {
      currency: 'PLN',
      capex: 'unknown',
      opex: 125000,
      npv: 'unknown',
      irr: 'unknown',
      roi: 'unknown',
      payback: 'unknown',
      baselineOrScenario: 'unknown',
      assumptions: ['12% discount rate', 'flat headcount'],
      risks: [],
      sourceVersion: 'v3',
      sourceFingerprint: 'abc123def4567890',
    },
  },
};

function renderModal(overrides: Partial<React.ComponentProps<typeof FinanceCandidateHandoffModal>> = {}) {
  const onClose = vi.fn();
  const onConfirmed = vi.fn();
  const preview = vi.fn().mockResolvedValue(eligiblePreview);
  const confirm = vi.fn().mockResolvedValue({ created: true, candidateId: 'cand-1' });

  const utils = render(
    <FinanceCandidateHandoffModal
      open
      onClose={onClose}
      sourceType="finance_statement_pack"
      sourceId="pack-1"
      preview={preview}
      confirm={confirm}
      title="Statement Pack → Candidate"
      noticeText="This sends the Statement Pack to the Candidate inbox for review."
      confirmLabel="Send as Candidate"
      onConfirmed={onConfirmed}
      {...overrides}
    />
  );

  return { ...utils, onClose, onConfirmed, preview, confirm };
}

describe('FinanceCandidateHandoffModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('standalone variant renders its own overlay chrome (title + X + Cancel)', async () => {
    renderModal();

    expect(await screen.findByText('Statement Pack → Candidate')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Statement pack — FY2026 Q2')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('embedded variant renders no overlay chrome (no title heading, no Cancel button)', async () => {
    renderModal({ variant: 'embedded' });

    await waitFor(() => expect(screen.getByText('Statement pack — FY2026 Q2')).toBeInTheDocument());
    expect(screen.queryByText('Statement Pack → Candidate')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    // The Confirm action itself is still present in embedded mode.
    expect(screen.getByRole('button', { name: 'Send as Candidate' })).toBeInTheDocument();
  });

  it('renders the sourceSnapshot summary, showing an honest dash for "unknown" — never 0 or blank', async () => {
    renderModal();

    await waitFor(() => expect(screen.getByText('Statement pack — FY2026 Q2')).toBeInTheDocument());

    // currency + numeric figure render as-is.
    expect(screen.getByText('PLN')).toBeInTheDocument();
    expect(screen.getByText('125000')).toBeInTheDocument();
    // A populated array field renders its real values, comma-joined.
    expect(screen.getByText('12% discount rate, flat headcount')).toBeInTheDocument();
    // A genuinely empty array ([]) is real data, not "missing" — it must
    // read as "None", never collapse into the same dash 'unknown' uses.
    expect(screen.getByText('None')).toBeInTheDocument();
    // 'unknown' must never be coerced into a fabricated 0 — it renders as a
    // plain dash instead (capex/npv/irr/roi/payback/baselineOrScenario are
    // all 'unknown' in this fixture).
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(6);
    // Lineage/integrity identifiers are not "key figures" — they're kept off
    // the human-facing summary grid even though they're present in the data.
    expect(screen.queryByText('v3')).not.toBeInTheDocument();
    expect(screen.queryByText('abc123def4567890')).not.toBeInTheDocument();
  });

  it('shows the real backend ineligible reason and never renders a Confirm action', async () => {
    const preview = vi.fn().mockResolvedValue({ eligible: false, reason: 'NOT_READY' });
    renderModal({
      preview,
      describeIneligibleReason: (reason) =>
        reason === 'NOT_READY' ? 'This pack is not ready yet.' : reason,
    });

    expect(await screen.findByText('This pack is not ready yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send as Candidate' })).not.toBeInTheDocument();
  });

  it('shows a real error on confirm rejection, never a false success', async () => {
    const confirm = vi.fn().mockRejectedValue({ status: 409, data: { error: 'Already claimed' } });
    const { onConfirmed, onClose } = renderModal({ confirm });

    const confirmButton = await screen.findByRole('button', { name: 'Send as Candidate' });
    fireEvent.click(confirmButton);

    expect(await screen.findByText('Already claimed')).toBeInTheDocument();
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onConfirmed with backend-persisted data and auto-closes by default', async () => {
    const { onConfirmed, onClose } = renderModal();

    const confirmButton = await screen.findByRole('button', { name: 'Send as Candidate' });
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(onConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({ created: true, candidateId: 'cand-1', reopenLink: null })
      )
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('best-effort fresh read-back: a failed fetchHandoff never turns a real success into an error', async () => {
    const fetchHandoff = vi.fn().mockRejectedValue(new Error('lineage GET failed'));
    const { onConfirmed, onClose } = renderModal({ fetchHandoff });

    const confirmButton = await screen.findByRole('button', { name: 'Send as Candidate' });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(fetchHandoff).toHaveBeenCalled());
    // Still a real success — confirm()'s own persisted response is used as
    // the fallback source of truth.
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledWith(expect.objectContaining({ created: true })));
    expect(onClose).toHaveBeenCalled();
  });

  it('fresh read-back prefers the lineage receipt sourceSnapshot when available', async () => {
    const fetchHandoff = vi.fn().mockResolvedValue({
      id: 'handoff-1',
      organizationId: 'org-1',
      sourceType: 'finance_statement_pack',
      sourceId: 'pack-1',
      candidateId: 'cand-1',
      createdBy: 'user-1',
      createdAt: '2026-08-01T00:00:00.000Z',
      sourceSnapshot: { currency: 'EUR' },
    });
    const { onConfirmed } = renderModal({ fetchHandoff });

    const confirmButton = await screen.findByRole('button', { name: 'Send as Candidate' });
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(onConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({ sourceSnapshot: { currency: 'EUR' } })
      )
    );
  });

  it('keepOpenOnSuccess keeps the modal open and renders a reopen link when getReopenLink resolves one', async () => {
    const getReopenLink = vi.fn().mockReturnValue('/initiatives');
    const { onClose } = renderModal({
      keepOpenOnSuccess: true,
      getReopenLink,
      createdMessage: 'Candidate created: {{title}}',
      reopenLabel: 'Open',
    });

    const confirmButton = await screen.findByRole('button', { name: 'Send as Candidate' });
    fireEvent.click(confirmButton);

    expect(await screen.findByText('Candidate created: Statement pack — FY2026 Q2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open/ })).toHaveAttribute('href', '/initiatives');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('never calls confirm() before a real eligible preview is in hand', async () => {
    let resolvePreview: (v: FinanceCandidatePreviewResult) => void = () => {};
    const preview = vi.fn(
      () =>
        new Promise<FinanceCandidatePreviewResult>((resolve) => {
          resolvePreview = resolve;
        })
    );
    const confirm = vi.fn<() => Promise<FinanceCandidateConfirmResult>>();
    renderModal({ preview, confirm });

    // While still previewing, there is no Confirm button to click at all.
    expect(screen.queryByRole('button', { name: 'Send as Candidate' })).not.toBeInTheDocument();
    expect(screen.getByText(/Checking eligibility/i)).toBeInTheDocument();

    resolvePreview(eligiblePreview);
    await screen.findByRole('button', { name: 'Send as Candidate' });
    expect(confirm).not.toHaveBeenCalled();
  });
});
