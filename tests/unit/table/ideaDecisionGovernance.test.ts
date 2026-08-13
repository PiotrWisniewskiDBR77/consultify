/**
 * ideaDecisionGovernance — Program D / E08 §6.4 (Decision governance).
 *
 * Guards the governance properties the master program requires that the
 * PRE-EXISTING "Log decyzji" table column (open/made/deferred/rejected,
 * `buildDecisionColumnSeedPlan` in `ViewSetupEmptyState.tsx`) does not
 * provide: four distinct outcomes (not a boolean), mandatory-evidence /
 * stale-financials approval gating, reopen-creates-a-new-version semantics,
 * and explicit role permissions.
 */
import { describe, expect, it } from 'vitest';

import {
  canReopenDecision,
  canRecordOutcome,
  CannotReopenError,
  createDecisionEntry,
  DecisionGateBlockedError,
  DECISION_OUTCOMES,
  evaluateApprovalGate,
  ForbiddenOutcomeError,
  getActiveDecisions,
  getVersionChain,
  MissingRationaleError,
  recordDecisionOutcome,
  reopenDecision,
  UNWIRED_FINANCIAL_FRESHNESS_PROVIDER,
  validateDecisionEntry,
} from '@/components/MyWork/table/ideaDecisionGovernance';

function baseEntry(overrides: Partial<Parameters<typeof createDecisionEntry>[0]> = {}) {
  return createDecisionEntry({
    id: 'dec-1',
    ideaId: 'idea-1',
    question: 'Should we build the self-serve onboarding flow?',
    alternatives: [{ label: 'Build now' }, { label: 'Defer to Q3' }],
    recommendation: 'Build now — payback under 4 months.',
    approver: 'sponsor-1',
    now: '2026-08-01T00:00:00.000Z',
    ...overrides,
  });
}

describe('four distinct outcomes', () => {
  it('exposes exactly the four outcomes from §6.4, not a boolean', () => {
    expect([...DECISION_OUTCOMES].sort()).toEqual(
      ['approved', 'deferred', 'rejected', 'returned_for_evidence'].sort()
    );
  });

  it('a fresh entry starts pending, distinct from every real outcome', () => {
    const entry = baseEntry();
    expect(entry.decision).toBe('pending');
    expect(DECISION_OUTCOMES as readonly string[]).not.toContain('pending');
  });
});

describe('validateDecisionEntry', () => {
  it('requires question/recommendation/approver', () => {
    const entry = baseEntry({ question: '', recommendation: '', approver: '' });
    const errors = validateDecisionEntry(entry);
    expect(errors.map((e) => e.field).sort()).toEqual(['approver', 'question', 'recommendation']);
  });

  it('requires a rationale once a decision has been ruled on', () => {
    const entry = { ...baseEntry(), decision: 'approved' as const, rationale: undefined };
    const errors = validateDecisionEntry(entry);
    expect(errors.some((e) => e.field === 'rationale')).toBe(true);
  });
});

describe('role permissions', () => {
  it('viewer may record no outcome', () => {
    for (const outcome of DECISION_OUTCOMES) {
      expect(canRecordOutcome('viewer', outcome)).toBe(false);
    }
  });

  it('contributor may return-for-evidence or defer, not approve/reject', () => {
    expect(canRecordOutcome('contributor', 'returned_for_evidence')).toBe(true);
    expect(canRecordOutcome('contributor', 'deferred')).toBe(true);
    expect(canRecordOutcome('contributor', 'approved')).toBe(false);
    expect(canRecordOutcome('contributor', 'rejected')).toBe(false);
  });

  it('approver/admin may record all four outcomes and reopen', () => {
    for (const role of ['approver', 'admin'] as const) {
      for (const outcome of DECISION_OUTCOMES) {
        expect(canRecordOutcome(role, outcome)).toBe(true);
      }
      expect(canReopenDecision(role)).toBe(true);
    }
    expect(canReopenDecision('contributor')).toBe(false);
    expect(canReopenDecision('viewer')).toBe(false);
  });
});

describe('recordDecisionOutcome', () => {
  it('rejects outcomes the role is not permitted to record', () => {
    expect(() =>
      recordDecisionOutcome(baseEntry(), {
        outcome: 'approved',
        rationale: 'looks fine',
        decidedBy: 'contrib-1',
        role: 'contributor',
        financialFreshness: UNWIRED_FINANCIAL_FRESHNESS_PROVIDER('idea-1'),
      })
    ).toThrow(ForbiddenOutcomeError);
  });

  it('requires a non-empty rationale for every outcome', () => {
    expect(() =>
      recordDecisionOutcome(baseEntry(), {
        outcome: 'deferred',
        rationale: '   ',
        decidedBy: 'appr-1',
        role: 'approver',
        financialFreshness: { status: 'unknown' },
      })
    ).toThrow(MissingRationaleError);
  });

  it('returned_for_evidence and deferred are never blocked by evidence/financial state', () => {
    const entry = baseEntry({ requiredEvidenceKeys: ['pricing-model'] });
    const result = recordDecisionOutcome(entry, {
      outcome: 'returned_for_evidence',
      rationale: 'need pricing sign-off first',
      decidedBy: 'appr-1',
      role: 'approver',
      financialFreshness: { status: 'stale', reason: 'ROI recalculated last quarter' },
    });
    expect(result.decision).toBe('returned_for_evidence');
    expect(result.rationale).toBe('need pricing sign-off first');
    expect(result.decidedAt).toBeTruthy();
  });

  it('blocks approval on missing mandatory evidence', () => {
    const entry = baseEntry({ requiredEvidenceKeys: ['pricing-model', 'security-review'] });
    try {
      recordDecisionOutcome(entry, {
        outcome: 'approved',
        rationale: 'ready to go',
        decidedBy: 'appr-1',
        role: 'approver',
        financialFreshness: { status: 'fresh' },
      });
      throw new Error('expected DecisionGateBlockedError');
    } catch (err) {
      expect(err).toBeInstanceOf(DecisionGateBlockedError);
      expect((err as InstanceType<typeof DecisionGateBlockedError>).blockers).toEqual([
        { type: 'missing-evidence', missingKeys: ['pricing-model', 'security-review'] },
      ]);
    }
  });

  it('blocks approval on stale financial calculations', () => {
    const entry = baseEntry({ evidenceRefs: ['pricing-model'], requiredEvidenceKeys: ['pricing-model'] });
    try {
      recordDecisionOutcome(entry, {
        outcome: 'approved',
        rationale: 'ready to go',
        decidedBy: 'appr-1',
        role: 'approver',
        financialFreshness: { status: 'stale', asOf: '2026-01-01', reason: 'input changed since calc' },
      });
      throw new Error('expected DecisionGateBlockedError');
    } catch (err) {
      expect(err).toBeInstanceOf(DecisionGateBlockedError);
      expect((err as InstanceType<typeof DecisionGateBlockedError>).blockers[0]).toMatchObject({
        type: 'stale-financials',
        reason: 'input changed since calc',
      });
    }
  });

  it('blocks approval when the freshness check itself errored (never read as non-blocking)', () => {
    const entry = baseEntry(); // no required evidence — proves the block is from the error, not evidence
    const gate = evaluateApprovalGate(entry, {
      financialFreshness: { status: 'error', reason: 'financial layer threw: timeout' },
    });
    expect(gate.blocked).toBe(true);
    expect(gate.blockers).toEqual([
      { type: 'financial-freshness-error', reason: 'financial layer threw: timeout' },
    ]);

    try {
      recordDecisionOutcome(entry, {
        outcome: 'approved',
        rationale: 'looks ready',
        decidedBy: 'appr-1',
        role: 'approver',
        financialFreshness: { status: 'error', reason: 'financial layer threw: timeout' },
      });
      throw new Error('expected DecisionGateBlockedError');
    } catch (err) {
      expect(err).toBeInstanceOf(DecisionGateBlockedError);
      expect((err as InstanceType<typeof DecisionGateBlockedError>).blockers).toEqual([
        { type: 'financial-freshness-error', reason: 'financial layer threw: timeout' },
      ]);
    }
  });

  it('unknown financial freshness does NOT block, but is surfaced as a warning', () => {
    const entry = baseEntry(); // no required evidence
    const gate = evaluateApprovalGate(entry, {
      financialFreshness: UNWIRED_FINANCIAL_FRESHNESS_PROVIDER('idea-1'),
    });
    expect(gate.blocked).toBe(false);
    expect(gate.warnings.length).toBeGreaterThan(0);

    const result = recordDecisionOutcome(entry, {
      outcome: 'approved',
      rationale: 'no financial case needed for this compliance fix',
      decidedBy: 'appr-1',
      role: 'approver',
      financialFreshness: { status: 'unknown', reason: 'not wired' },
    });
    expect(result.decision).toBe('approved');
  });

  it('approving with fresh financials and satisfied evidence succeeds', () => {
    const entry = baseEntry({ evidenceRefs: ['pricing-model'], requiredEvidenceKeys: ['pricing-model'] });
    const result = recordDecisionOutcome(entry, {
      outcome: 'approved',
      rationale: 'evidence complete, ROI positive',
      decidedBy: 'appr-1',
      role: 'approver',
      financialFreshness: { status: 'fresh', asOf: '2026-08-01' },
    });
    expect(result.decision).toBe('approved');
    expect(result.id).toBe(entry.id);
    expect(result.version).toBe(entry.version);
  });
});

describe('reopenDecision — versions, does not erase', () => {
  it('creates a new version and preserves the original ruled entry untouched (besides the link)', () => {
    const entry = baseEntry();
    const approved = recordDecisionOutcome(entry, {
      outcome: 'approved',
      rationale: 'go',
      decidedBy: 'appr-1',
      role: 'approver',
      financialFreshness: { status: 'fresh' },
    });

    const { previous, next } = reopenDecision(approved, {
      role: 'approver',
      nextId: 'dec-1-v2',
      now: '2026-09-01T00:00:00.000Z',
    });

    // The original decision/rationale/decidedAt/decidedBy are preserved.
    expect(previous.decision).toBe('approved');
    expect(previous.rationale).toBe('go');
    expect(previous.decidedBy).toBe('appr-1');
    expect(previous.supersededById).toBe('dec-1-v2');

    // The new version is a fresh, pending decision line.
    expect(next.id).toBe('dec-1-v2');
    expect(next.version).toBe(2);
    expect(next.supersedesId).toBe('dec-1');
    expect(next.decision).toBe('pending');
    expect(next.rationale).toBeUndefined();
    expect(next.decidedAt).toBeUndefined();

    const chain = getVersionChain(next, [previous, next]);
    expect(chain.map((e) => e.id)).toEqual(['dec-1', 'dec-1-v2']);

    const active = getActiveDecisions([previous, next]);
    expect(active.map((e) => e.id)).toEqual(['dec-1-v2']);
  });

  it('cannot reopen a decision that was never ruled on', () => {
    expect(() => reopenDecision(baseEntry(), { role: 'approver', nextId: 'x' })).toThrow(
      CannotReopenError
    );
  });

  it('cannot reopen a decision twice without going through the newer version', () => {
    const entry = baseEntry();
    const approved = recordDecisionOutcome(entry, {
      outcome: 'approved',
      rationale: 'go',
      decidedBy: 'appr-1',
      role: 'approver',
      financialFreshness: { status: 'fresh' },
    });
    const { previous } = reopenDecision(approved, { role: 'approver', nextId: 'v2' });
    expect(() => reopenDecision(previous, { role: 'approver', nextId: 'v3' })).toThrow(CannotReopenError);
  });

  it('only approver/admin may reopen', () => {
    const entry = baseEntry();
    const approved = recordDecisionOutcome(entry, {
      outcome: 'rejected',
      rationale: 'not now',
      decidedBy: 'appr-1',
      role: 'approver',
      financialFreshness: { status: 'unknown' },
    });
    expect(() => reopenDecision(approved, { role: 'contributor', nextId: 'v2' })).toThrow(
      ForbiddenOutcomeError
    );
  });
});
