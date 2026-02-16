/**
 * L1: Task validators (honest unit tests)
 *
 * This file used to be a "fake integration" (supertest + local express routes).
 * Now it validates our real Zod schemas from server/src.
 */

import { describe, expect, it } from 'vitest';

import {
  CreateTaskSchema,
  GetTasksQuerySchema,
  UpdateTaskSchema,
} from '../../../server/src/validators/task.validators.js';

describe('task.validators', () => {
  it('CreateTaskSchema: requires title', () => {
    const parsed = CreateTaskSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it('CreateTaskSchema: applies defaults for status/priority/taskType/source', () => {
    const parsed = CreateTaskSchema.parse({ title: 'T' });
    expect(parsed.status).toBe('todo');
    expect(parsed.priority).toBe('medium');
    expect(parsed.taskType).toBe('execution');
    expect(parsed.source).toBe('manual');
  });

  it('UpdateTaskSchema: strips organizationId (not updatable)', () => {
    const parsed = UpdateTaskSchema.parse({ organizationId: 'org-1', title: 'X' } as any);
    expect((parsed as any).organizationId).toBeUndefined();
    expect(parsed.title).toBe('X');
  });

  it('GetTasksQuerySchema: coerces page/limit and provides defaults', () => {
    const parsed = GetTasksQuerySchema.parse({ page: '2', limit: '10' } as any);
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
  });
});
