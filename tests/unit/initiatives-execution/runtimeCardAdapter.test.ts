import { describe, expect, it } from 'vitest';

import {
  buildRuntimeCardCoverageReport,
  LEGACY_SECTION_COMPONENT_KEYS,
  resolveLegacySection,
} from '@/contracts/initiatives-execution/runtimeCardAdapter';

describe('runtime Initiative section adapter', () => {
  it('gives every current section component an explicit disposition', () => {
    expect(LEGACY_SECTION_COMPONENT_KEYS).toHaveLength(29);
    const report = buildRuntimeCardCoverageReport(LEGACY_SECTION_COMPONENT_KEYS);
    expect(report.resolutions).toHaveLength(29);
    expect(report.invalidComponentKeys).toEqual([]);
    expect(report.resolutions.every((resolution) => resolution.disposition.length > 0)).toBe(true);
  });

  it('splits combined legacy sections without silently selecting one target card', () => {
    expect(resolveLegacySection('tasks')).toMatchObject({
      disposition: 'SPLIT',
      cardKeys: ['milestones', 'tasks'],
    });
    expect(resolveLegacySection('targetState')).toMatchObject({
      disposition: 'SPLIT',
      cardKeys: ['success-criteria', 'outcomes-benefits'],
    });
  });

  it('moves pilot to the Execution Case and keeps workspace utilities outside the catalog', () => {
    expect(resolveLegacySection('pilot')).toMatchObject({
      disposition: 'MOVE_TO_EXECUTION_PHASE',
      cardKeys: [],
    });
    expect(resolveLegacySection('watchers')).toMatchObject({
      disposition: 'UTILITY',
      cardKeys: [],
    });
  });

  it('reports target cards that have no current runtime implementation', () => {
    const report = buildRuntimeCardCoverageReport(LEGACY_SECTION_COMPONENT_KEYS);
    expect(report.targetOnlyCardKeys).toEqual([
      'strategic-fit',
      'options',
      'change-adoption',
      'communication-engagement',
      'technical-specification',
    ]);
  });

  it('fails visibly on an unknown DB/frontend component key', () => {
    const report = buildRuntimeCardCoverageReport([...LEGACY_SECTION_COMPONENT_KEYS, 'mysteryCard']);
    expect(report.invalidComponentKeys).toEqual(['mysteryCard']);
  });
});
