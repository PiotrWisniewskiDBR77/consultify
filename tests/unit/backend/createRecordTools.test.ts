/**
 * Teresa routing-N (naprawa-rN-routing) — create_task / create_decision create a
 * REAL N-object (a tasks / decisions row) and emit a deliverable event, instead
 * of the model falling back to generate_deliverable(type:'document').
 *
 * Contract asserted:
 *  - flag OFF → feature_disabled (no row, no emit),
 *  - flag ON  + no org → missing_context,
 *  - flag ON  + no title → missing_title,
 *  - flag ON  + happy path → persists via the live INSERT path and emits
 *    onDeliverable({ kind:'task'|'decision', ... }).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { taskExecMock, queryRunMock, getTableColumnsMock, flags } = vi.hoisted(() => ({
  taskExecMock: vi.fn(),
  queryRunMock: vi.fn(),
  getTableColumnsMock: vi.fn(),
  flags: {
    ENABLE_TERESA_RECORD_CREATE: true,
  },
}));

vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  featureFlags: flags,
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/ai/actionExecutors/taskExecutor.js', () => ({
  default: { execute: (...args: unknown[]) => taskExecMock(...args) },
}));

vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: (...args: unknown[]) => getTableColumnsMock(...args),
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: (...args: unknown[]) => queryRunMock(...args),
}));

import { createTask } from '../../../server/src/services/ai/tools/createTask.js';
import { createDecision } from '../../../server/src/services/ai/tools/createDecision.js';

const baseCtx = {
  organizationId: 'org-1',
  userId: 'user-1',
  language: 'pl' as const,
  role: 'ADMIN',
};

beforeEach(() => {
  vi.clearAllMocks();
  flags.ENABLE_TERESA_RECORD_CREATE = true;
  taskExecMock.mockResolvedValue({ success: true, result: { taskId: 'task-123', title: 'X' } });
  getTableColumnsMock.mockResolvedValue(
    new Set(['id', 'organization_id', 'title', 'description', 'status', 'created_by', 'decision_maker_id'])
  );
  queryRunMock.mockResolvedValue({ rowCount: 1 });
});

describe('create_task', () => {
  it('feature OFF → feature_disabled, no persist, no emit', async () => {
    flags.ENABLE_TERESA_RECORD_CREATE = false;
    const emit = vi.fn();
    const r = await createTask({ title: 'Do the thing' }, { ...baseCtx, onDeliverable: emit });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('feature_disabled');
    expect(taskExecMock).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('missing org → missing_context', async () => {
    const r = await createTask({ title: 'X' }, { language: 'pl' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('missing_context');
  });

  it('missing title → missing_title', async () => {
    const r = await createTask({ title: '   ' }, baseCtx);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('missing_title');
  });

  it('happy path → persists task and emits kind:task', async () => {
    const emit = vi.fn();
    const r = await createTask(
      { title: 'Przygotuj listę', priority: 'high' },
      { ...baseCtx, onDeliverable: emit }
    );
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('task');
    expect(r.id).toBe('task-123');
    expect(taskExecMock).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0]).toMatchObject({ kind: 'task', taskId: 'task-123' });
  });

  it('executor failure → creation_failed, no emit', async () => {
    taskExecMock.mockResolvedValue({ success: false, error: 'boom' });
    const emit = vi.fn();
    const r = await createTask({ title: 'X' }, { ...baseCtx, onDeliverable: emit });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('creation_failed');
    expect(emit).not.toHaveBeenCalled();
  });
});

describe('create_decision', () => {
  it('feature OFF → feature_disabled, no persist, no emit', async () => {
    flags.ENABLE_TERESA_RECORD_CREATE = false;
    const emit = vi.fn();
    const r = await createDecision({ title: 'Pick a vendor' }, { ...baseCtx, onDeliverable: emit });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('feature_disabled');
    expect(queryRunMock).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('missing title → missing_title', async () => {
    const r = await createDecision({ title: '' }, baseCtx);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('missing_title');
  });

  it('happy path → INSERT into decisions and emits kind:decision', async () => {
    const emit = vi.fn();
    const r = await createDecision(
      { title: 'Wybór dostawcy', description: 'A vs B' },
      { ...baseCtx, onDeliverable: emit }
    );
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('decision');
    expect(queryRunMock).toHaveBeenCalledTimes(1);
    const sql = String(queryRunMock.mock.calls[0][0]);
    expect(sql).toMatch(/INSERT INTO decisions/i);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0]).toMatchObject({ kind: 'decision' });
  });
});
