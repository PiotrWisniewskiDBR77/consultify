import fs from 'node:fs';
import path from 'node:path';
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
      retiredLegacyMutationDoors: 16,
      openLegacyMutationDoors: 36,
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

  it('routes every mounted valuation PPTX export caller through the canonical successor', () => {
    const files = [
      'src/components/Benefits/ValuationWorkspace.tsx',
      'src/components/Economics/FinancePreviewPanel.tsx',
      'src/components/Economics/hooks/useFinanceRowActions.ts',
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      expect(source).toContain('exportCanonicalLegacyValuationPptx');
      expect(source).not.toMatch(/Api\.post\([^\n]*\/api\/economics\/valuations\/.*export\/pptx/);
    }
  });
});
