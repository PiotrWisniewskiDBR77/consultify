import { describe, expect, it } from 'vitest';
import { materialSnapshotHash } from '../../../server/src/domain/initiatives-execution/materialChange';
import { governedPlanTruthHash } from '../../../server/src/domain/initiatives-execution/managementIntervention';

describe('governed Plan resequence readback', () => {
  it('verifies business truth independently of MaterialChange lineage metadata', () => {
    const truth = { status: 'PUBLISHED', order: ['b', 'a'] };
    expect(governedPlanTruthHash({ ...truth, rebaseline: { materialChangeId: 'mc-1' } })).toBe(
      materialSnapshotHash(truth)
    );
    expect(governedPlanTruthHash({ ...truth, order: ['a', 'b'] })).not.toBe(
      materialSnapshotHash(truth)
    );
  });
});
