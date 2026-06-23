/**
 * M14/F3 — action queue Cost-of-Delay ranking (WSJF numerator).
 */
import { describe, expect, it } from 'vitest';

import { actionQueueCodScore } from '../../../server/src/controllers/ExecutionController.js';

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

describe('actionQueueCodScore — CoD ranking', () => {
  it('a critical overdue decision outranks a minor overdue task (same lateness)', () => {
    const dec = actionQueueCodScore({ type: 'decision_overdue', priority: 'CRITICAL', dueDate: daysAgo(2), initiativeId: 'i' });
    const task = actionQueueCodScore({ type: 'task_overdue', dueDate: daysAgo(2), initiativeId: 'i' });
    expect(dec).toBeGreaterThan(task);
  });

  it('a RED risk (score 12) outranks an AMBER risk (score 6)', () => {
    const red = actionQueueCodScore({ type: 'risk_high', score: 12, initiativeId: 'i' });
    const amber = actionQueueCodScore({ type: 'risk_high', score: 6, initiativeId: 'i' });
    expect(red).toBeGreaterThan(amber);
  });

  it('urgency rises with lateness (older overdue ranks higher)', () => {
    const old = actionQueueCodScore({ type: 'task_overdue', dueDate: daysAgo(20), initiativeId: 'i' });
    const recent = actionQueueCodScore({ type: 'task_overdue', dueDate: daysAgo(1), initiativeId: 'i' });
    expect(old).toBeGreaterThan(recent);
  });

  it('blast radius: an initiative-linked item outranks an identical unlinked one', () => {
    const linked = actionQueueCodScore({ type: 'task_overdue', dueDate: daysAgo(5), initiativeId: 'i' });
    const unlinked = actionQueueCodScore({ type: 'task_overdue', dueDate: daysAgo(5), initiativeId: null });
    expect(linked).toBeGreaterThan(unlinked);
  });
});
