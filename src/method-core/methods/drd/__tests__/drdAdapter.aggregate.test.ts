import { describe, expect, it } from 'vitest';

import { DRD_AGGREGATION_VERSION } from '../compileDrdPack';
import { drdAdapter } from '../drdAdapter';

describe('drdAdapter.aggregate — explicit, versioned area→axis rule', () => {
  it('averages non-null unit levels within an axis and rounds to 1 decimal', () => {
    const result = drdAdapter.aggregate({
      mappingVersion: DRD_AGGREGATION_VERSION,
      unitLevels: {
        '1A': 3,
        '1B': 4,
        '1C': 5,
      },
    });
    expect(result.byGroup['axis-1']).toBe(4); // (3+4+5)/3 = 4
    expect(result.mappingVersion).toBe(DRD_AGGREGATION_VERSION);
    expect(result.rule.length).toBeGreaterThan(0);
  });

  it('a single N/A (null) unit level is EXCLUDED from the axis mean, not imputed as zero', () => {
    const result = drdAdapter.aggregate({
      mappingVersion: DRD_AGGREGATION_VERSION,
      unitLevels: {
        '1A': 6,
        '1B': null,
        '1C': 4,
      },
    });
    // Mean of {6,4} = 5, NOT (6+0+4)/3 = 3.33
    expect(result.byGroup['axis-1']).toBe(5);
    expect(result.excluded['1B']).toBeDefined();
    expect(result.excluded['1A']).toBeUndefined();
  });

  it('an axis with zero non-null unit levels reported yields null (excluded), not zero', () => {
    const result = drdAdapter.aggregate({
      mappingVersion: DRD_AGGREGATION_VERSION,
      unitLevels: {},
    });
    // No units reported at all for axis-1 -> byGroup null, nothing to exclude per-unit
    expect(result.byGroup['axis-1']).toBeNull();
  });

  it('an unknown unit id is excluded with a reason instead of silently dropped or averaged in', () => {
    const result = drdAdapter.aggregate({
      mappingVersion: DRD_AGGREGATION_VERSION,
      unitLevels: { ZZ: 5 },
    });
    expect(result.excluded.ZZ).toBe('unknown_unit_id');
  });

  it('rejects an unsupported mappingVersion instead of silently applying the wrong rule', () => {
    expect(() =>
      drdAdapter.aggregate({ mappingVersion: 'some-other-version', unitLevels: { '1A': 3 } })
    ).toThrow();
  });

  it('is deterministic — same input aggregated twice yields identical output', () => {
    const input = { mappingVersion: DRD_AGGREGATION_VERSION, unitLevels: { '1A': 3, '1B': null, '1C': 5 } };
    const a = drdAdapter.aggregate(input);
    const b = drdAdapter.aggregate(input);
    expect(a).toEqual(b);
  });
});
