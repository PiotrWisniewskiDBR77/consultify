import { describe, expect, it } from 'vitest';
import { aiInputHash } from '../../../server/src/domain/initiatives-execution/aiEvidenceGovernance';
describe('AI evidence provenance', () => {
  it('binds proposal to exact input', () => {
    expect(aiInputHash({ source: 1 })).toBe(aiInputHash({ source: 1 }));
    expect(aiInputHash({ source: 1 })).not.toBe(aiInputHash({ source: 2 }));
  });
});
