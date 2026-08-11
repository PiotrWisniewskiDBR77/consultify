import { describe, expect, it } from 'vitest';

import {
  cardsForLegacySection,
  INITIATIVE_CARD_KEYS,
  INITIATIVE_CARD_REGISTRY,
  INITIATIVE_WORKSPACE_UTILITY_KEYS,
  isInitiativeCardKey,
  validateCardSelection,
} from '@/contracts/initiatives-execution/cardRegistry';

describe('Initiative canonical 26-card registry', () => {
  it('contains exactly 26 unique, internally consistent business cards', () => {
    expect(INITIATIVE_CARD_KEYS).toHaveLength(26);
    expect(new Set(INITIATIVE_CARD_KEYS).size).toBe(26);
    expect(Object.keys(INITIATIVE_CARD_REGISTRY).sort()).toEqual([...INITIATIVE_CARD_KEYS].sort());

    for (const key of INITIATIVE_CARD_KEYS) {
      expect(INITIATIVE_CARD_REGISTRY[key].key).toBe(key);
      expect(INITIATIVE_CARD_REGISTRY[key].label.length).toBeGreaterThan(0);
    }
  });

  it('does not treat workspace utilities as peer business cards', () => {
    for (const utility of INITIATIVE_WORKSPACE_UTILITY_KEYS) {
      expect(isInitiativeCardKey(utility)).toBe(false);
    }
  });

  it('maps combined legacy sections to all relevant canonical cards without choosing silently', () => {
    expect(cardsForLegacySection('tasks').map((card) => card.key)).toEqual([
      'milestones',
      'tasks',
    ]);
    expect(cardsForLegacySection('targetState').map((card) => card.key)).toEqual([
      'success-criteria',
      'outcomes-benefits',
    ]);
    expect(cardsForLegacySection('unknown-section')).toEqual([]);
  });

  it('accepts include/omit/reorder only when every catalog card is preserved exactly once', () => {
    const included = INITIATIVE_CARD_KEYS.slice(0, 20);
    const omitted = INITIATIVE_CARD_KEYS.slice(20);

    expect(
      validateCardSelection({ included, omitted, order: [...INITIATIVE_CARD_KEYS].reverse() })
    ).toEqual([]);
  });

  it('rejects lost, duplicated or ambiguous card membership', () => {
    const missing = INITIATIVE_CARD_KEYS.slice(1);
    const errors = validateCardSelection({
      included: missing,
      omitted: ['summary-scope'],
      order: [...missing, 'tasks'],
    });

    expect(errors).toContain('order contains duplicates');
    expect(errors).toContain('summary-scope is missing from order');
    expect(errors).toContain('order must contain exactly 26 canonical cards');
  });
});
