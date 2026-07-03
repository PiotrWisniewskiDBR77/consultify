import { describe, expect, it } from 'vitest';

import {
  buildValueChainStaircasePromptRules,
  detectVagueDriver,
  mentionsCost,
  mentionsValue,
  validateValueChainStaircase,
  type ValueChainInsightStaircase,
} from '@/config/valuechain/valueChainInsightStaircase';

const completeStaircase: ValueChainInsightStaircase = {
  surface: 'Inbound receiving is logged by hand into a spreadsheet by two warehouse clerks per shift.',
  costValueProof:
    'It drives ~18% of operating cost (sig-2) yet customers never see it — no willingness-to-pay attached.',
  proofRefs: ['sig-2'],
  benchmark: 'Best-in-class peers run barcode + ERP auto-receipt; we are manual, ~2 maturity levels behind.',
  potential: 'Automating receipt would cut clerk time ~60% with no customer-value loss.',
};

describe('valueChainInsightStaircase — vague driver detection (PL + EN)', () => {
  it('flags rating words that assert without evidence', () => {
    expect(detectVagueDriver('Operacje są nieefektywne')).not.toBeNull();
    expect(detectVagueDriver('This activity is expensive')).not.toBeNull();
    expect(detectVagueDriver('Mostly manual process')).not.toBeNull();
    expect(detectVagueDriver('World-class logistics')).not.toBeNull();
  });

  it('does not flag concrete descriptions', () => {
    expect(detectVagueDriver('Receiving logged into ERP within 4 hours')).toBeNull();
  });
});

describe('valueChainInsightStaircase — cost/value side detection', () => {
  it('detects cost mentions in PL and EN', () => {
    expect(mentionsCost('drives 18% of total cost')).toBe(true);
    expect(mentionsCost('generuje wysoki koszt')).toBe(true);
    expect(mentionsCost('customers love it')).toBe(false);
  });

  it('detects value mentions in PL and EN', () => {
    expect(mentionsValue('customers pay a premium for it')).toBe(true);
    expect(mentionsValue('tworzy wartość dla klienta')).toBe(true);
    expect(mentionsValue('it is a fixed overhead')).toBe(false);
  });
});

describe('valueChainInsightStaircase — validation', () => {
  it('passes a complete, both-sided, evidenced staircase', () => {
    const issues = validateValueChainStaircase({
      text: 'Inbound logistics',
      staircase: completeStaircase,
      evidenceStatus: 'confirmed',
    });
    expect(issues).toEqual([]);
  });

  it('flags every missing rung', () => {
    const issues = validateValueChainStaircase({ text: 'Operations', staircase: undefined });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('missing-surface');
    expect(codes).toContain('missing-cost-value-proof');
    expect(codes).toContain('missing-benchmark');
    expect(codes).toContain('missing-potential');
  });

  it('requires proofRefs when the activity is marked confirmed', () => {
    const issues = validateValueChainStaircase({
      text: 'Operations',
      staircase: { ...completeStaircase, proofRefs: [] },
      evidenceStatus: 'confirmed',
    });
    expect(issues.map((i) => i.code)).toContain('missing-proof-refs');
  });

  it('allows empty proofRefs for a declared activity', () => {
    const issues = validateValueChainStaircase({
      text: 'Operations',
      staircase: { ...completeStaircase, proofRefs: [] },
      evidenceStatus: 'declared',
    });
    expect(issues.map((i) => i.code)).not.toContain('missing-proof-refs');
  });

  it('flags a proof that addresses only cost or only value', () => {
    const costOnly = validateValueChainStaircase({
      text: 'Operations',
      staircase: { ...completeStaircase, costValueProof: 'It is 40% of total spend, full stop.' },
    });
    expect(costOnly.map((i) => i.code)).toContain('needs-cost-value-split');
  });

  it('flags a proof that merely restates the surface', () => {
    const restate = 'Inbound receiving is logged by hand into a spreadsheet by two warehouse clerks per shift.';
    const issues = validateValueChainStaircase({
      text: 'Inbound',
      staircase: { ...completeStaircase, surface: restate, costValueProof: restate },
    });
    expect(issues.map((i) => i.code)).toContain('proof-restates-surface');
  });

  it('flags a vague driver with no cost-value proof', () => {
    const issues = validateValueChainStaircase({
      text: 'Operations are inefficient and expensive',
      staircase: undefined,
    });
    expect(issues.map((i) => i.code)).toContain('vague-driver');
  });
});

describe('valueChainInsightStaircase — prompt rules', () => {
  it('emits PL and EN rule blocks naming both cost and value', () => {
    const pl = buildValueChainStaircasePromptRules('pl');
    const en = buildValueChainStaircasePromptRules('en');
    expect(pl).toMatch(/kosztowo-wartościowy/);
    expect(pl).toMatch(/proofRefs/);
    expect(en).toMatch(/cost-value proof/);
    expect(en).toMatch(/benchmark/);
  });
});
