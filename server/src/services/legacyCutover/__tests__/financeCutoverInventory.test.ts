import { describe, expect, it } from 'vitest';

import {
  summarizeLegacyCutoverInventory,
  type LegacyCutoverDomainConfig,
} from '../legacyCutoverKernel.js';
import { FINANCE_CUTOVER, FINANCE_MODELING_CUTOVER } from '../registry.js';
import { ECONOMICS_CUTOVER } from '../registry/economics.js';
import { FINANCE_STATEMENTS_CUTOVER } from '../registry/financeStatements.js';

const CONFIGS: LegacyCutoverDomainConfig[] = [
  FINANCE_CUTOVER,
  FINANCE_MODELING_CUTOVER,
  ECONOMICS_CUTOVER,
  FINANCE_STATEMENTS_CUTOVER,
];

describe('FIN-MVP-CUTOVER exact mounted-route denominator', () => {
  it('separates actual legacy mutations from POST-shaped reads, refusals and canonical handoffs', () => {
    expect(summarizeLegacyCutoverInventory(CONFIGS)).toEqual({
      totalRules: 59,
      legacyMutationDoors: 52,
      canonicalMutationDoors: 1,
      nonMutationDoors: 6,
      retiredLegacyMutationDoors: 12,
      openLegacyMutationDoors: 40,
    });
  });

  it('requires every non-legacy classification to carry a literal reason that names its effect', () => {
    const classified = CONFIGS.flatMap((config) => config.writers).filter(
      (rule) => rule.effect && rule.effect !== 'legacy-write'
    );

    expect(classified.map((rule) => rule.writerId).sort()).toEqual([
      'ECO-W08',
      'ECO-W09',
      'ECO-W18',
      'ECO-W19',
      'ECO-W20',
      'ECO-W30',
      'FS-W14',
    ]);
    for (const rule of classified) {
      if (rule.effect === 'read-only') expect(rule.reason).toContain('NO database write');
      if (rule.effect === 'refusal') expect(rule.reason).toMatch(/410|501/);
      if (rule.effect === 'canonical-write') expect(rule.reason).toContain('canonical');
    }
  });
});
