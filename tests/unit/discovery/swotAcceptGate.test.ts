/**
 * swotAcceptGate — STREAM G1 (2026-08-13).
 *
 * The ONE canonical accept decision for a Dynamic SWOT item
 * (src/config/swot/swotAcceptGate.ts). Pure, framework-free — the same
 * module `useToolStore.ts`'s `acceptCard`, `SWOTBuildPhase.tsx`'s
 * `acceptProposal`, and the server's `acceptSwotProposal`
 * (server/src/controllers/ToolController.ts) all import.
 *
 * Negative cases matter most here: they prove an item WITHOUT what the
 * engine requires does NOT get stamped 'accepted'-clean.
 */
import { describe, expect, it } from 'vitest';

import { evaluateSwotAcceptGate, stampAcceptedSwotItem } from '@/config/swot/swotAcceptGate';

describe('evaluateSwotAcceptGate — structural blocks', () => {
  it('blocks an item with empty text', () => {
    const result = evaluateSwotAcceptGate({ text: '   ', quadrant: 'strengths' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('EMPTY_TEXT');
      expect(result.message.pl).toBeTruthy();
      expect(result.message.en).toBeTruthy();
    }
  });

  it('blocks an item with an unknown quadrant', () => {
    const result = evaluateSwotAcceptGate({ text: 'Strong brand', quadrant: 'nonsense' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('INVALID_QUADRANT');
  });
});

describe('evaluateSwotAcceptGate — unvalidated classification (grounded in classifyStrengthFromAnswers)', () => {
  it('blocks core-competency with zero evidence', () => {
    const result = evaluateSwotAcceptGate({
      text: 'We are the best in the market',
      quadrant: 'strengths',
      classification: 'core-competency',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('UNVALIDATED_CLASSIFICATION');
  });

  it('blocks niche-strength with zero evidence', () => {
    const result = evaluateSwotAcceptGate({
      text: 'We dominate the SMB segment',
      quadrant: 'strengths',
      classification: 'niche-strength',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('UNVALIDATED_CLASSIFICATION');
  });

  it('does NOT block claimed-strength with zero evidence (honest by definition)', () => {
    const result = evaluateSwotAcceptGate({
      text: 'We believe our onboarding is faster',
      quadrant: 'strengths',
      classification: 'claimed-strength',
    });
    expect(result.ok).toBe(true);
  });

  it('does NOT block table-stakes with zero evidence (honest by definition)', () => {
    const result = evaluateSwotAcceptGate({
      text: 'We offer 24/7 support like everyone else',
      quadrant: 'strengths',
      classification: 'table-stakes',
    });
    expect(result.ok).toBe(true);
  });

  it('allows core-competency once a signal is linked', () => {
    const result = evaluateSwotAcceptGate({
      text: 'We are the best in the market',
      quadrant: 'strengths',
      classification: 'core-competency',
      linkedSignalIds: ['signal-1'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.evidenceStatus).toBe('confirmed');
  });

  it('allows core-competency once an evidence note is present', () => {
    const result = evaluateSwotAcceptGate({
      text: 'We are the best in the market',
      quadrant: 'strengths',
      classification: 'core-competency',
      evidenceNote: '3 client references confirm this in the last renewal cycle.',
    });
    expect(result.ok).toBe(true);
  });

  it('allows core-competency once K1 staircase factRefs are present', () => {
    const result = evaluateSwotAcceptGate({
      text: 'We are the best in the market',
      quadrant: 'strengths',
      classification: 'core-competency',
      staircase: { factRefs: ['fact-1'] },
    });
    expect(result.ok).toBe(true);
  });
});

describe('evaluateSwotAcceptGate — evidenceStatus is ALWAYS recomputed, never trusted', () => {
  it('an item with no evidence is stamped "declared", regardless of any upstream claim', () => {
    const result = evaluateSwotAcceptGate({
      text: 'Model-authored claim with no real backing',
      quadrant: 'opportunities',
      // Note: this input shape has no `evidenceStatus` field at all — the
      // gate takes NO evidenceStatus input, by design, so an AI cannot pass
      // one through. This test documents that contract.
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.evidenceStatus).toBe('declared');
      expect(result.evidenceLabel?.pl).toBe('Deklaracja — niepotwierdzone');
    }
  });

  it('an item with a linked signal is stamped "confirmed"', () => {
    const result = evaluateSwotAcceptGate({
      text: 'Client-confirmed pricing advantage',
      quadrant: 'strengths',
      linkedSignalIds: ['sig-1'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.evidenceStatus).toBe('confirmed');
  });

  it('an evidence note of only whitespace does NOT count as evidence', () => {
    const result = evaluateSwotAcceptGate({
      text: 'Vague claim',
      quadrant: 'threats',
      evidenceNote: '   ',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.evidenceStatus).toBe('declared');
  });
});

describe('stampAcceptedSwotItem — idempotent, additive stamping', () => {
  it('sets status, proposalStatus, and evidenceStatus without losing other fields', () => {
    const item = {
      id: 'item-1',
      text: 'Fast onboarding',
      quadrant: 'strengths' as const,
      impact: 'high' as const,
      confidence: 4,
    };
    const gate = evaluateSwotAcceptGate(item);
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    const stamped = stampAcceptedSwotItem(item, gate);
    expect(stamped).toMatchObject({
      id: 'item-1',
      text: 'Fast onboarding',
      quadrant: 'strengths',
      impact: 'high',
      confidence: 4,
      status: 'accepted',
      proposalStatus: 'accepted',
      evidenceStatus: 'declared',
    });
  });

  it('stamping the same already-accepted item twice yields the same result (idempotent)', () => {
    const item = {
      id: 'item-2',
      text: 'Repeat customers renew at 95%',
      quadrant: 'strengths' as const,
      linkedSignalIds: ['sig-9'],
    };
    const gate1 = evaluateSwotAcceptGate(item);
    expect(gate1.ok).toBe(true);
    if (!gate1.ok) return;
    const first = stampAcceptedSwotItem(item, gate1);

    const gate2 = evaluateSwotAcceptGate(first);
    expect(gate2.ok).toBe(true);
    if (!gate2.ok) return;
    const second = stampAcceptedSwotItem(first, gate2);

    expect(second).toEqual(first);
  });
});
