import { describe, expect, it } from 'vitest';

import {
  getAllowedTaskTransitions,
  normalizeTaskStatus,
  parseTaskStatus,
  validateTaskStatusTransition,
} from '../../../../server/src/services/taskWorkflowService.js';

describe('taskWorkflowService', () => {
  it('normalizes aliases and invalid statuses', () => {
    expect(normalizeTaskStatus('completed')).toBe('done');
    expect(normalizeTaskStatus('In-Progress')).toBe('in_progress');
    expect(normalizeTaskStatus('hold')).toBe('on_hold');
    expect(normalizeTaskStatus('unknown-status')).toBe('todo');
  });

  it('strict parser rejects blank and unknown targets while preserving documented aliases', () => {
    expect(parseTaskStatus('')).toBeNull();
    expect(parseTaskStatus('unknown-status')).toBeNull();
    expect(parseTaskStatus('active')).toBe('in_progress');
    expect(parseTaskStatus('in_review')).toBe('review');
    expect(parseTaskStatus('waiting')).toBe('on_hold');
    expect(parseTaskStatus('validated')).toBe('done');
  });

  it('never validates an unknown target through the todo fallback', () => {
    expect(validateTaskStatusTransition('done', 'unknown-status')).toMatchObject({
      allowed: false,
      rule: 'INVALID_STATUS',
    });
    expect(validateTaskStatusTransition('done', '')).toMatchObject({
      allowed: false,
      rule: 'INVALID_STATUS',
    });
  });

  it('fails closed for an unknown current status', () => {
    expect(getAllowedTaskTransitions('archived')).toEqual([]);
    expect(validateTaskStatusTransition('archived', 'in_progress')).toMatchObject({
      allowed: false,
      rule: 'INVALID_CURRENT_STATUS',
    });
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
