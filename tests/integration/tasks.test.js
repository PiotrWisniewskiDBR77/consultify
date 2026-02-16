/**
 * L1: Task validators (query/enums) — JS variant
 */

import { describe, expect, it } from 'vitest';

import {
  GetTasksQuerySchema,
  PriorityEnum,
  TaskStatusEnum,
  TaskTypeEnum,
} from '../../server/src/validators/task.validators.js';

describe('task.validators (query)', () => {
  it('GetTasksQuerySchema: defaults page=1 and limit=100', () => {
    const parsed = GetTasksQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(100);
  });

  it('GetTasksQuerySchema: coerces numeric strings', () => {
    const parsed = GetTasksQuerySchema.parse({ page: '3', limit: '5' });
    expect(parsed.page).toBe(3);
    expect(parsed.limit).toBe(5);
  });

  it('enums: include expected values', () => {
    expect(TaskStatusEnum.options).toContain('todo');
    expect(PriorityEnum.options).toContain('critical');
    expect(TaskTypeEnum.options).toContain('execution');
  });
});
