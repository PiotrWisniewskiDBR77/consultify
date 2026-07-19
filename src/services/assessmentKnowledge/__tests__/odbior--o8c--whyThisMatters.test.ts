/**
 * ODBIÓR O8.1 — "Dlaczego to pytanie" hinty edukacyjne
 *
 * REJESTR claim was 🟡 "JA J20 (→SIRI/ADMA/tools)" — this test proves the REAL
 * runtime state: curated (non-generic) why-hints exist for every DRD axis (1-7),
 * every SIRI building block, and every ADMA pillar, bilingually (PL/EN), and the
 * getters used by the three assessment editors resolve to that curated content
 * (not the generic fallback) for every real dimension key used in the live
 * DRD/SIRI/ADMA structures.
 */
import { describe, expect, it } from 'vitest';

import { DRD_STRUCTURE } from '@/services/drdStructure';
import { ADMA_PILLARS } from '@/services/admaStructure';
import { SIRI_BUILDING_BLOCKS } from '@/services/siriStructure';
import {
  DRD_AXIS_WHY_HINTS,
  ADMA_PILLAR_WHY_HINTS,
  SIRI_BLOCK_WHY_HINTS,
  GENERIC_WHY_HINT,
  getDRDAxisWhyHint,
  getWhyThisMattersHint,
} from '../whyThisMatters';

describe('O8.1 — why-this-matters hints: real coverage against live structures', () => {
  it('DRD: every real axis id (1-7) has a curated, non-generic PL+EN hint', () => {
    const axisIds = DRD_STRUCTURE.map((axis) => axis.id);
    expect(axisIds.length).toBeGreaterThanOrEqual(7);

    for (const axisId of axisIds) {
      const hint = getDRDAxisWhyHint(axisId);
      expect(hint).not.toBe(GENERIC_WHY_HINT);
      expect(DRD_AXIS_WHY_HINTS[axisId]).toBeDefined();
      expect(hint.en.length).toBeGreaterThan(60);
      expect(hint.pl.length).toBeGreaterThan(60);
      // getWhyThisMattersHint('drd', <n or "n-slug">) must resolve the same curated entry
      expect(getWhyThisMattersHint('drd', String(axisId))).toEqual(hint);
    }
  });

  it('SIRI: every real building block has a curated, non-generic PL+EN hint', () => {
    const blockIds = Object.keys(SIRI_BUILDING_BLOCKS);
    expect(blockIds.length).toBeGreaterThanOrEqual(3);

    for (const blockId of blockIds) {
      const hint = getWhyThisMattersHint('siri', blockId);
      expect(hint).not.toBe(GENERIC_WHY_HINT);
      expect(SIRI_BLOCK_WHY_HINTS[blockId.toUpperCase()]).toBeDefined();
      expect(hint.en.length).toBeGreaterThan(60);
      expect(hint.pl.length).toBeGreaterThan(60);
    }
  });

  it('ADMA: every real pillar has a curated, non-generic PL+EN hint', () => {
    const pillarIds = Object.keys(ADMA_PILLARS);
    expect(pillarIds.length).toBeGreaterThanOrEqual(5);

    for (const pillarId of pillarIds) {
      const hint = getWhyThisMattersHint('adma', pillarId);
      expect(hint).not.toBe(GENERIC_WHY_HINT);
      expect(ADMA_PILLAR_WHY_HINTS[pillarId.toLowerCase()]).toBeDefined();
      expect(hint.en.length).toBeGreaterThan(60);
      expect(hint.pl.length).toBeGreaterThan(60);
    }
  });

  it('unknown framework/dimension falls back to the generic (not empty/undefined) hint', () => {
    expect(getWhyThisMattersHint('lean', 'unknown-dimension')).toEqual(GENERIC_WHY_HINT);
    expect(getWhyThisMattersHint('drd', '999')).toEqual(GENERIC_WHY_HINT);
  });
});
