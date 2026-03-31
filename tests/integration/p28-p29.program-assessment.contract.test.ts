/**
 * P28 Assessment workbench + P29 Partner program ledger — contract tests (real services).
 */
import { describe, it, expect } from 'vitest';

import {
  assertPromotionPayloadShape,
  buildBoundedPromotionPayload,
  buildWhatNextGuidance,
  createInitialWorkbench,
  P28_METHODOLOGY_PRESETS,
  P28_WORKBENCH_CONTRACT_VERSION,
} from '../../server/src/services/assessment/AssessmentWorkbenchService.js';
import {
  buildPartnerWhatNextGuidance,
  deriveBalancesFromEntries,
} from '../../server/src/services/partnerProgramLedgerService.js';

describe('P28 Assessment workbench (FINAL 28)', () => {
  it('uses frozen contract version constant', () => {
    expect(P28_WORKBENCH_CONTRACT_VERSION).toBe('p28_workbench_v1');
  });

  it('createInitialWorkbench starts in draft with methodology ref', () => {
    const s = createInitialWorkbench({
      assessmentId: 'asmt-1',
      orgId: 'org-1',
      methodologyId: 'ADMA',
      startedBy: 'user-1',
      methodologyVersion: '2.1',
    });
    expect(s.runState).toBe('draft');
    expect(s.assessmentDefinitionRef).toEqual({ methodologyId: 'ADMA', version: '2.1' });
    expect(s.scoreProposal).toBeNull();
    expect(s.evidencePointers).toEqual([]);
  });

  it('completed run passes promotion shape and bounded payload includes trace fields', () => {
    const s = createInitialWorkbench({
      assessmentId: 'asmt-2',
      orgId: 'org-2',
      methodologyId: 'DRD',
      startedBy: 'user-2',
    });
    s.runState = 'completed';
    s.completedAt = new Date().toISOString();
    s.scoreProposal = {
      id: 'sp-1',
      status: 'proposal',
      scoreValues: { readiness: 0.7 },
      scoringRationale: 'Evidence-linked rationale',
      evidencePointerIds: ['ev-1'],
      assumptions: ['bounded'],
      confidence: 0.6,
      proposedAt: new Date().toISOString(),
      proposedBy: 'user-2',
    };
    s.scoreReview = { status: 'accepted', decidedAt: new Date().toISOString(), decidedBy: 'user-2' };
    s.interpretationProposal = {
      id: 'ip-1',
      status: 'proposal',
      summary: 'Summary',
      keyFindings: ['f1'],
      limits: 'Not exhaustive',
      nextActions: ['a1'],
      linksToScoreProposalId: 'sp-1',
      proposedAt: new Date().toISOString(),
      proposedBy: 'user-2',
    };
    s.interpretationReview = {
      status: 'accepted',
      decidedAt: new Date().toISOString(),
      decidedBy: 'user-2',
    };
    s.evidencePointers = [
      {
        id: 'ev-1',
        kind: 'document',
        ref: 'outputs:doc:123',
        availability: 'ok',
      },
    ];
    const shape = assertPromotionPayloadShape(s);
    expect(shape.ok).toBe(true);
    expect(shape.errors).toEqual([]);
    const payload = buildBoundedPromotionPayload(s);
    expect(payload.assessment_run_id).toBe('asmt-2');
    expect(payload.assessment_definition_id).toBe('DRD');
    expect(Array.isArray(payload.evidence_pointers)).toBe(true);
    expect(payload.promotion_traces).toEqual([]);
    expect(payload.limits).toBe('Not exhaustive');
  });

  it('buildWhatNextGuidance lists actionable steps for awaiting_evidence', () => {
    const s = createInitialWorkbench({
      assessmentId: 'x',
      orgId: 'o',
      methodologyId: 'DRD',
      startedBy: 'u',
    });
    s.runState = 'awaiting_evidence';
    s.degraded = {
      code: 'missing_required_evidence',
      message: 'Add evidence',
      missingEvidenceKinds: ['document'],
    };
    const next = buildWhatNextGuidance(s);
    expect(next.some((l) => l.includes('missing') || l.includes('document') || l.includes('evidence'))).toBe(
      true
    );
  });

  it('P28_METHODOLOGY_PRESETS defines DRD required evidence kinds', () => {
    expect(P28_METHODOLOGY_PRESETS.DRD.requiredEvidenceKinds).toContain('document');
    expect(P28_METHODOLOGY_PRESETS.DRD.requiredEvidenceKinds).toContain('interview_note');
  });

  it('rejects promotion payload when run is not completed', () => {
    const s = createInitialWorkbench({
      assessmentId: 'asmt-3',
      orgId: 'org-3',
      methodologyId: 'SIRI',
      startedBy: 'u',
    });
    s.runState = 'score_reviewed';
    const shape = assertPromotionPayloadShape(s);
    expect(shape.ok).toBe(false);
    expect(shape.errors.some((e) => e.includes('completed'))).toBe(true);
  });
});

describe('P29 Partner program ledger (FINAL 29)', () => {
  it('deriveBalancesFromEntries matches gross, hold, and payout semantics', () => {
    const b = deriveBalancesFromEntries(
      [
        { entry_type: 'accrual.posted', amount: 100 },
        { entry_type: 'accrual.adjustment', amount: -10 },
        { entry_type: 'hold.placed', amount: 20 },
        { entry_type: 'hold.released', amount: 5 },
        { entry_type: 'payout.executed', amount: 30 },
      ],
      'EUR'
    );
    expect(b.currency).toBe('EUR');
    expect(b.grossEarned).toBe(90);
    expect(b.heldAmount).toBe(15);
    expect(b.paidOut).toBe(30);
    expect(b.availableToPayout).toBe(45);
  });

  it('buildPartnerWhatNextGuidance: partner in earn with balance suggests payout CTA when no hold', () => {
    const next = buildPartnerWhatNextGuidance({
      lifecyclePhase: 'earn',
      balances: {
        grossEarned: 100,
        heldAmount: 0,
        paidOut: 0,
        availableToPayout: 40,
        currency: 'EUR',
      },
      audience: 'partner',
    });
    expect(next.some((l) => l.includes('request-payout-phase'))).toBe(true);
  });

  it('buildPartnerWhatNextGuidance: partner in earn with active hold suppresses payout CTA', () => {
    const next = buildPartnerWhatNextGuidance({
      lifecyclePhase: 'earn',
      balances: {
        grossEarned: 100,
        heldAmount: 20,
        paidOut: 0,
        availableToPayout: 30,
        currency: 'EUR',
      },
      audience: 'partner',
      activeHold: { reasonCode: 'review', note: 'internal', amount: 20 },
    });
    expect(next.some((l) => l.toLowerCase().includes('hold'))).toBe(true);
    expect(next.some((l) => l.includes('request-payout-phase'))).toBe(false);
  });

  it('buildPartnerWhatNextGuidance: operator in earn mentions ledger alignment', () => {
    const next = buildPartnerWhatNextGuidance({
      lifecyclePhase: 'earn',
      balances: deriveBalancesFromEntries([{ entry_type: 'accrual.posted', amount: 10 }], 'EUR'),
      audience: 'operator',
    });
    expect(next.some((l) => l.toLowerCase().includes('ledger'))).toBe(true);
  });
});
