import { describe, expect, it } from 'vitest';

import {
  getAllowedTaskTransitions,
  normalizeTaskStatus,
  validateTaskStatusTransition,
} from '../../../../server/src/services/taskWorkflowService.js';

describe('taskWorkflowService', () => {
  it('normalizes aliases and invalid statuses', () => {
    expect(normalizeTaskStatus('completed')).toBe('done');
    expect(normalizeTaskStatus('In-Progress')).toBe('in_progress');
    expect(normalizeTaskStatus('hold')).toBe('on_hold');
    expect(normalizeTaskStatus('unknown-status')).toBe('todo');
  });

  it('allows no-op and valid transitions', () => {
    expect(validateTaskStatusTransition('todo', 'todo')).toEqual({ allowed: true });
    expect(validateTaskStatusTransition('todo', 'in_progress')).toEqual({ allowed: true });
    expect(validateTaskStatusTransition('done', 'todo')).toEqual({ allowed: true });
    expect(validateTaskStatusTransition('cancelled', 'todo')).toEqual({ allowed: true });
  });

  it('rejects invalid transitions with canonical rule and message', () => {
    const result = validateTaskStatusTransition('done', 'review');
    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.rule).toBe('INVALID_TRANSITION');
    expect(result.message).toContain('Cannot transition from done to review');
    expect(result.message).toContain('Allowed:');
  });

  it('returns transition graph for blocked status', () => {
    expect(getAllowedTaskTransitions('blocked')).toEqual([
      'todo',
      'in_progress',
      'review',
      'on_hold',
      'cancelled',
    ]);
  });
});
