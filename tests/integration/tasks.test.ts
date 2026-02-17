/**
 * L1: Task validators (assignment/escalation)
 */

import { describe, expect, it } from 'vitest';

import {
  AssignTaskSchema,
  EscalateTaskSchema,
  ReassignTaskSchema,
  ResolveEscalationSchema,
} from '../../server/src/validators/task.validators.js';

describe('task.validators (assignment)', () => {
  it('AssignTaskSchema: defaults notify=true', () => {
    const parsed = AssignTaskSchema.parse({ assigneeId: 'u-1' });
    expect(parsed.notify).toBe(true);
  });

  it('ReassignTaskSchema: requires from/to assignee ids', () => {
    const parsed = ReassignTaskSchema.safeParse({ toAssigneeId: 'u-2' });
    expect(parsed.success).toBe(false);
  });

  it('EscalateTaskSchema: requires non-empty reason', () => {
    const parsed = EscalateTaskSchema.safeParse({ reason: '' });
    expect(parsed.success).toBe(false);
  });

  it('ResolveEscalationSchema: requires non-empty resolution', () => {
    const parsed = ResolveEscalationSchema.safeParse({ resolution: '' });
    expect(parsed.success).toBe(false);
  });
});
