import { describe, expect, it } from 'vitest';
import { reportContentHash } from '../../../server/src/domain/initiatives-execution/reportRun';
describe('Report Run content hash', () => {
  it('is deterministic independent of object key order', () => {
    expect(reportContentHash({ b: 2, a: { y: 2, x: 1 } })).toBe(
      reportContentHash({ a: { x: 1, y: 2 }, b: 2 })
    );
  });
});
