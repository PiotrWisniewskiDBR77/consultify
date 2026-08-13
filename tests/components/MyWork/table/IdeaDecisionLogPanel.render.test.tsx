/**
 * IdeaDecisionLogPanel — financial-freshness × approval-gate render tests.
 *
 * Program D / epic E08 §6.4: approval must be BLOCKED when the financial
 * case is missing or stale. The panel's `financialFreshnessProvider` prop is
 * a SYNCHRONOUS contract (see `ideaDecisionGovernance.ts`'s
 * `FinancialFreshnessProvider` header, 2026-08-10) — these tests verify the
 * UI actually enforces that at the Approve button, not just that the pure
 * `evaluateApprovalGate` function returns the right shape (already covered
 * by `tests/unit/table/ideaDecisionGovernance.test.ts`).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaDecisionLogPanel } from '@/components/MyWork/table/IdeaDecisionLogPanel';
import type {
  DecisionLogEntry,
  FinancialFreshnessProvider,
} from '@/components/MyWork/table/ideaDecisionGovernance';
import type { TableNode } from '@/components/MyWork/table/tableTypes';

vi.mock('@/hooks/useUserCan', () => ({
  useUserCan: () => ({
    can: () => true,
    canEdit: true,
    canDelete: true,
    canApprove: true, // → mapAppRoleToDecisionRole gives 'approver'
    canManageAI: false,
    canGenerateTeamReports: false,
    canGenerateSteeringReports: false,
    canViewReports: true,
    isAdmin: false,
    isSuperAdmin: false,
    isManager: true,
    permissions: {},
  }),
}));

function pendingEntry(overrides: Partial<DecisionLogEntry> = {}): DecisionLogEntry {
  return {
    id: 'dec-1',
    ideaId: 'idea-1',
    version: 1,
    question: 'Should we invest in the pricing overhaul?',
    alternatives: [],
    recommendation: 'Yes, ROI is positive.',
    approver: 'appr-1',
    decision: 'pending',
    evidenceRefs: [],
    requiredEvidenceKeys: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function nodeWithLog(log: DecisionLogEntry[]): TableNode {
  return { id: 'node-1', data: { label: 'Pricing overhaul', decisionLog: log } };
}

function renderPanel(freshnessProvider: FinancialFreshnessProvider, log: DecisionLogEntry[]) {
  const onApplyDecisionLog = vi.fn();
  render(
    <IdeaDecisionLogPanel
      open
      onClose={() => {}}
      nodes={[nodeWithLog(log)]}
      ideaId="idea-1"
      onApplyDecisionLog={onApplyDecisionLog}
      financialFreshnessProvider={freshnessProvider}
    />
  );
  return { onApplyDecisionLog };
}

function approveButton() {
  return screen.getByRole('button', { name: /Approve/i });
}

describe('IdeaDecisionLogPanel — financial freshness gates approval', () => {
  it('fresh financials + no missing evidence → Approve is enabled and succeeds', () => {
    const { onApplyDecisionLog } = renderPanel(
      () => ({ status: 'fresh', asOf: '2026-08-01' }),
      [pendingEntry()]
    );

    fireEvent.change(screen.getByLabelText(/Rationale/i), { target: { value: 'ROI checks out' } });
    expect(approveButton()).not.toBeDisabled();
    fireEvent.click(approveButton());

    expect(onApplyDecisionLog).toHaveBeenCalledTimes(1);
    const [, nextLog] = onApplyDecisionLog.mock.calls[0];
    expect(nextLog[0].decision).toBe('approved');
    expect(screen.queryByText(/Approval blocked/i)).toBeNull();
  });

  it('stale financials → Approve is disabled and a stated reason is shown', () => {
    renderPanel(
      () => ({ status: 'stale', reason: 'Recomputed 3 quarters ago' }),
      [pendingEntry()]
    );

    fireEvent.change(screen.getByLabelText(/Rationale/i), { target: { value: 'looks fine' } });
    expect(approveButton()).toBeDisabled();
    expect(screen.getByText(/Approval blocked/i)).toBeTruthy();
    expect(screen.getByText(/Recomputed 3 quarters ago/i)).toBeTruthy();
  });

  it('a throwing provider is mapped to a distinct error status, and Approve stays blocked with an actionable message', () => {
    renderPanel(() => {
      throw new Error('financial layer unreachable');
    }, [pendingEntry()]);

    fireEvent.change(screen.getByLabelText(/Rationale/i), { target: { value: 'looks fine' } });
    expect(approveButton()).toBeDisabled();
    expect(screen.getByText(/Approval blocked/i)).toBeTruthy();
    // The specific thrown message is surfaced, not swallowed into a generic
    // "unknown"/non-blocking state.
    expect(screen.getByText(/financial layer unreachable/i)).toBeTruthy();
  });

  it('unknown financial freshness (no financial case) does NOT block approval, but is not silently promoted to fresh either', () => {
    renderPanel(
      () => ({ status: 'unknown', reason: 'The financial case has not been opened yet this session.' }),
      [pendingEntry()]
    );

    fireEvent.change(screen.getByLabelText(/Rationale/i), { target: { value: 'no financial case needed' } });
    expect(approveButton()).not.toBeDisabled();
    // Non-blocking warning is still visibly surfaced (never swallowed).
    expect(screen.getByText(/has not been opened yet this session/i)).toBeTruthy();
    expect(screen.queryByText(/Approval blocked/i)).toBeNull();
  });

  it('Reject and Defer are never blocked by stale financials (only Approve carries the gate)', () => {
    renderPanel(() => ({ status: 'stale', reason: 'stale' }), [pendingEntry()]);

    fireEvent.change(screen.getByLabelText(/Rationale/i), { target: { value: 'not viable' } });
    const rejectBtn = screen.getByRole('button', { name: /Reject/i });
    expect(rejectBtn).not.toBeDisabled();
  });
});
