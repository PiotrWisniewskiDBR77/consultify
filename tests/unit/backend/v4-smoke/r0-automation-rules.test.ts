/**
 * R0 Smoke: V4-TASK-03 — Automation Rules Service
 * Verifies: evaluateConditions(), dryRunRule()
 */

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  queryRun: vi.fn(),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../../server/src/services/AuditEventsService.js', () => ({
  default: { log: vi.fn().mockResolvedValue('ae-mock') },
  auditEventsService: { log: vi.fn().mockResolvedValue('ae-mock') },
}));

import {
  evaluateConditions,
  dryRunRule,
} from '../../../../server/src/services/automationRulesService.js';

describe('V4-TASK-03: Automation Rules Service', () => {
  it('evaluateConditions() returns true when all conditions match', () => {
    const conditions = [
      { field: 'status', operator: 'equals', value: 'done' },
    ];
    const context = { status: 'done', priority: 'high' };
    expect(evaluateConditions(conditions as any, context)).toBe(true);
  });

  it('evaluateConditions() returns false when condition does not match', () => {
    const conditions = [
      { field: 'status', operator: 'equals', value: 'done' },
    ];
    const context = { status: 'open' };
    expect(evaluateConditions(conditions as any, context)).toBe(false);
  });

  it('evaluateConditions() handles empty conditions as true', () => {
    expect(evaluateConditions([], {})).toBe(true);
  });

  it('dryRunRule() returns wouldMatch and conditionResults', () => {
    const rule = {
      id: 'rule-1',
      name: 'Test Rule',
      trigger_type: 'task.updated',
      conditions: [{ field: 'status', operator: 'equals', value: 'done' }],
      actions: [{ type: 'notify', config: { channel: 'email' } }],
    };
    const context = { status: 'done' };
    const result = dryRunRule(rule as any, context);
    expect(result).toHaveProperty('wouldMatch');
    expect(typeof result.wouldMatch).toBe('boolean');
    expect(result).toHaveProperty('actions');
  });
});
