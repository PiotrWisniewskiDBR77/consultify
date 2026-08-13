import { describe, expect, it } from 'vitest';
import { managementSignalFingerprint } from '../../../server/src/domain/initiatives-execution/managementIntervention';
describe('Management Signal identity', () => {
  it('is deterministic by rule and stable source identity', () => {
    const input = { ruleId: 'delay-critical', sourceType: 'execution_case', sourceId: 'case-1' };
    expect(managementSignalFingerprint(input)).toBe(managementSignalFingerprint({ ...input }));
    expect(managementSignalFingerprint(input)).not.toBe(
      managementSignalFingerprint({ ...input, sourceId: 'case-2' })
    );
  });
});
