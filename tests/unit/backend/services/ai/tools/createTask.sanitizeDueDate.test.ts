/**
 * sanitizeDueDate — Teresa `create_task` chat tool (sędzia BCG #1)
 *
 * Reproduces the reported defect: a task created via Teresa chat could get a
 * `dueDate` in the PAST relative to its own `createdAt` (e.g. dueDate=
 * 2026-02-10 for a task created 2026-07-07) because the LLM tool schema gave
 * the model zero grounding for "today" and TaskExecutor's INSERT trusts
 * whatever `due_date` string it receives. This test locks in the server-side
 * clamp added in createTask.ts: dueDate must never resolve to <= now.
 *
 * @module tests/unit/backend/services/ai/tools/createTask.sanitizeDueDate.test.ts
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { sanitizeDueDate } from '../../../../../../../server/src/services/ai/tools/createTask.js';

describe('sanitizeDueDate (create_task chat tool)', () => {
  it('rejects a due_date in the past and returns a future ISO date instead', () => {
    const now = Date.now();
    // Reproduces the exact reported defect shape: createdAt=today, dueDate=months ago.
    const result = sanitizeDueDate('2026-02-10', 'medium');

    expect(result).toBeDefined();
    const resultMs = new Date(result as string).getTime();
    expect(Number.isNaN(resultMs)).toBe(false);
    expect(resultMs).toBeGreaterThan(now);
  });

  it('never returns a date <= createdAt (now), regardless of priority', () => {
    const now = Date.now();
    for (const priority of ['low', 'medium', 'high', 'unknown-priority']) {
      const result = sanitizeDueDate(undefined, priority);
      const resultMs = new Date(result as string).getTime();
      expect(resultMs).toBeGreaterThan(now);
    }
  });

  it('rejects an invalid (unparseable) due_date string', () => {
    const now = Date.now();
    const result = sanitizeDueDate('not-a-date', 'high');
    const resultMs = new Date(result as string).getTime();
    expect(Number.isNaN(resultMs)).toBe(false);
    expect(resultMs).toBeGreaterThan(now);
  });

  it('accepts a genuinely future due_date unchanged', () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = sanitizeDueDate(future, 'low');
    expect(result).toBe(future);
  });

  it('rejects a due_date exactly at "now" (not strictly in the future)', () => {
    const nowIso = new Date(Date.now() - 1).toISOString(); // guard against clock tick
    const result = sanitizeDueDate(nowIso, 'medium');
    const resultMs = new Date(result as string).getTime();
    expect(resultMs).toBeGreaterThan(Date.now() - 1);
  });

  it('high priority gets a sooner default than low priority', () => {
    const high = new Date(sanitizeDueDate(undefined, 'high') as string).getTime();
    const low = new Date(sanitizeDueDate(undefined, 'low') as string).getTime();
    expect(high).toBeLessThan(low);
  });
});
