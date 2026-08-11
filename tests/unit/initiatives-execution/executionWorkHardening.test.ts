import { describe, expect, it } from 'vitest';
import { workSlaState } from '../../../server/src/domain/initiatives-execution/executionWorkHardening';
describe('Canonical work SLA', () => {
  it('derives overdue without changing identity or status', () => {
    const item = {
      status: 'OPEN',
      dueAt: '2026-01-02T00:00:00.000Z',
      slaAt: '2026-01-01T00:00:00.000Z',
    };
    expect(workSlaState(item, Date.parse('2026-01-03T00:00:00.000Z'))).toBe('OVERDUE');
    expect(item.status).toBe('OPEN');
  });
});
