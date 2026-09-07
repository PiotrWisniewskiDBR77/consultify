import { describe, expect, it } from 'vitest';

import { REJESTR_KART_N } from '../registry';

const P14_B = [
  'presentation',
  'report-builder',
  'template-architect-doc',
  'template-architect-deck',
  'finance-statement-pack',
] as const;

describe('P14-B card registry', () => {
  it.each(P14_B)('%s is registered as migrated', (cardType) => {
    expect(REJESTR_KART_N[cardType].statusMigracji).toBe('zmigrowana');
  });

  it('keeps the retired financial model outside the card registry', () => {
    expect(Object.keys(REJESTR_KART_N)).not.toContain('finance-model');
  });
});
