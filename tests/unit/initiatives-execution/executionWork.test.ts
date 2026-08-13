import { describe, expect, it } from 'vitest';
import { deriveTaskStatus } from '../../../server/src/domain/initiatives-execution/executionWork';
describe('Execution Task status', () => {
  it('never hides unresolved Decision blockers', () => {
    expect(deriveTaskStatus(['decision-1'])).toBe('BLOCKED');
    expect(deriveTaskStatus([])).toBe('OPEN');
    expect(deriveTaskStatus([], true)).toBe('COMPLETED');
  });
});
