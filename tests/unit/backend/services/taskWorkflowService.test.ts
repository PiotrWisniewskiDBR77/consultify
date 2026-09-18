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
    expect(validateTaskStatusTransition('done', 'in_progress')).toEqual({ allowed: true });
    expect(validateTaskStatusTransition('cancelled', 'todo')).toEqual({ allowed: true });
  });

  it('blocks shortcut moves and requires a reason for blocked', () => {
    expect(validateTaskStatusTransition('todo', 'done')).toMatchObject({
      allowed: false,
      rule: 'INVALID_TRANSITION',
    });
    expect(validateTaskStatusTransition('done', 'todo')).toMatchObject({
      allowed: false,
      rule: 'INVALID_TRANSITION',
    });
    expect(validateTaskStatusTransition('todo', 'blocked')).toMatchObject({
      allowed: false,
      rule: 'BLOCKED_REASON_REQUIRED',
    });
    expect(
      validateTaskStatusTransition('todo', 'blocked', { blockedReason: 'Vendor wait' })
    ).toEqual({
      allowed: true,
    });
  });

  it('rejects invalid transitions with canonical rule and message', () => {
    const result = validateTaskStatusTransition('done', 'review');
    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.rule).toBe('INVALID_TRANSITION');
    expect(result.message).toContain('TASK_INVALID_TRANSITION:done->review');
    expect(result.message).toContain('allowed=in_progress');
  });

  it('returns transition graph for blocked status', () => {
    expect(getAllowedTaskTransitions('blocked')).toEqual([
      'todo',
      'in_progress',
      'on_hold',
      'cancelled',
    ]);
  });
});
