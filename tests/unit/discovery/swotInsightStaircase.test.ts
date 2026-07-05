import { describe, expect, it } from 'vitest';

import {
  detectUmbrellaClaim,
  requiresDecomposition,
  validateInsightStaircase,
} from '@/config/swot/swotInsightStaircase';

const completeStaircase = {
  fact: 'Order handoff between CRM and ERP is manual; ~2 days lost per order (sig-3).',
  factRefs: ['sig-3'],
  interpretation:
    'At 400 orders/year this is ~800 buffer-days — the bottleneck is administrative, not production capacity.',
  implication: 'Any growth move multiplies the loss; integration precedes sales expansion.',
};

describe('swotInsightStaircase — umbrella claim detection (PL + EN)', () => {
  it('flags aggregate terms that hide several different problems', () => {
    expect(requiresDecomposition('Brak zwinności organizacyjnej')).toBe(true);
    expect(requiresDecomposition('Lack of agility in decision making')).toBe(true);
    expect(requiresDecomposition('Słaba komunikacja między działami')).toBe(true);
    expect(requiresDecomposition('Weak innovation culture')).toBe(true);
    expect(requiresDecomposition('Niska efektywność produkcji')).toBe(true);
  });

  it('does not flag concrete, localized findings', () => {
    expect(requiresDecomposition('Ręczne przepisywanie zamówień między CRM a ERP')).toBe(false);
    expect(requiresDecomposition('61% of revenue concentrated in one client')).toBe(false);
  });

  it('returns the matched umbrella label bilingually', () => {
    const match = detectUmbrellaClaim('lack of agility');
    expect(match?.labelEn).toBe('agility');
    expect(match?.labelPl).toBe('zwinność');
  });
});

describe('swotInsightStaircase — fact -> interpretation -> implication validation', () => {
  it('passes a complete staircase on a concrete item', () => {
    expect(
      validateInsightStaircase({
        text: 'Manual order rewriting between systems',
        staircase: completeStaircase,
        evidenceStatus: 'confirmed',
      })
    ).toEqual([]);
  });

  it('fails when any staircase step is missing', () => {
    const issues = validateInsightStaircase({ text: 'Some weakness' });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('missing-fact');
    expect(codes).toContain('missing-interpretation');
    expect(codes).toContain('missing-implication');
  });

  it('fails a confirmed item whose fact references no session evidence', () => {
    const issues = validateInsightStaircase({
      text: 'Concrete weakness',
      staircase: { ...completeStaircase, factRefs: [] },
      evidenceStatus: 'confirmed',
    });
    expect(issues.map((i) => i.code)).toContain('missing-fact-refs');
  });

  it('allows a declared item to carry zero factRefs (honest declaration)', () => {
    const issues = validateInsightStaircase({
      text: 'Concrete weakness',
      staircase: { ...completeStaircase, factRefs: [] },
      evidenceStatus: 'declared',
    });
    expect(issues.map((i) => i.code)).not.toContain('missing-fact-refs');
  });

  it('rejects an interpretation that merely restates the fact', () => {
    const issues = validateInsightStaircase({
      text: 'Concrete weakness',
      staircase: {
        ...completeStaircase,
        interpretation: completeStaircase.fact,
      },
      evidenceStatus: 'confirmed',
    });
    expect(issues.map((i) => i.code)).toContain('interpretation-is-restatement');
  });

  it('demands decomposition for umbrella claims ("lack of agility" = 4 different problems)', () => {
    const issues = validateInsightStaircase({
      text: 'Brak zwinności',
      staircase: completeStaircase,
      evidenceStatus: 'confirmed',
    });
    const decompositionIssue = issues.find((i) => i.code === 'needs-decomposition');
    expect(decompositionIssue).toBeDefined();
    expect(decompositionIssue?.messagePl).toContain('procesy / narzędzia / kompetencje / bodźce');
  });

  it('accepts an umbrella claim once decomposed into roots', () => {
    const issues = validateInsightStaircase({
      text: 'Brak zwinności',
      staircase: completeStaircase,
      evidenceStatus: 'confirmed',
      decomposition: [
        { dimension: 'process', finding: 'Decyzje cenowe wymagają 3 podpisów i 9 dni' },
      ],
    });
    expect(issues.map((i) => i.code)).not.toContain('needs-decomposition');
  });
});
