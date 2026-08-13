import { describe, expect, it } from 'vitest';
import { criticalCapacityReady } from '../../../server/src/domain/initiatives-execution/scheduleDecision';
const capacity = (state: 'KNOWN' | 'UNKNOWN', base: number | null) =>
  ({ periods: [{ periodId: 'w1', supply: { knowledgeState: state, base } }] }) as any;
describe('Schedule gate critical capacity', () => {
  it('accepts an explicit known base for every critical period', () =>
    expect(criticalCapacityReady(capacity('KNOWN', 2), ['w1'])).toBe(true));
  it('fails closed for UNKNOWN, null, or missing periods', () => {
    expect(criticalCapacityReady(capacity('UNKNOWN', null), ['w1'])).toBe(false);
    expect(criticalCapacityReady(capacity('KNOWN', null), ['w1'])).toBe(false);
    expect(criticalCapacityReady(capacity('KNOWN', 2), ['w2'])).toBe(false);
  });
});
