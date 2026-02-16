import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAuditLog, dbGetRow } = vi.hoisted(() => ({
  getAuditLog: vi.fn(),
  dbGetRow: { current: null as any },
}));

vi.mock('../../server/src/ai/actionDecisionService.js', () => ({
  default: {
    getAuditLog: (...args: any[]) => getAuditLog(...args),
  },
}));

vi.mock('../../server/src/utils/auditLogger.js', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../server/src/database/index.js', () => ({
  getDatabase: () => ({
    get: (_sql: any, _params: any, cb: any) => cb(null, dbGetRow.current),
  }),
}));

vi.mock('uuid', () => ({ v4: () => 'u1' }));

describe('ActionExecutionAdapter.executeDecision - REAL_CODE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbGetRow.current = null;
  });

  it('returns NOT_FOUND when decision id is not in audit log', async () => {
    getAuditLog.mockResolvedValueOnce([]);
    const { default: adapter } = await import('../../server/src/ai/actionExecutionAdapter.ts');
    const res = await adapter.executeDecision('d-missing', 'SYSTEM');
    expect(res.success).toBe(false);
    expect(res.error_code).toBeDefined();
  });

  it('returns VALIDATION_ERROR when decision is not executable (REJECTED)', async () => {
    getAuditLog.mockResolvedValueOnce([
      { id: 'd1', decision: 'REJECTED', correlation_id: 'c1', organization_id: 'org-1' },
    ]);
    const { default: adapter } = await import('../../server/src/ai/actionExecutionAdapter.ts');
    const res = await adapter.executeDecision('d1', 'SYSTEM');
    expect(res.success).toBe(false);
    expect(res.error).toContain('only APPROVED / MODIFIED');
  });

  it('returns VALIDATION_ERROR when proposal_snapshot is missing', async () => {
    getAuditLog.mockResolvedValueOnce([
      {
        id: 'd2',
        decision: 'APPROVED',
        correlation_id: 'c2',
        organization_id: 'org-1',
        proposal_snapshot: null,
      },
    ]);
    const { default: adapter } = await import('../../server/src/ai/actionExecutionAdapter.ts');
    const res = await adapter.executeDecision('d2', 'SYSTEM');
    expect(res.success).toBe(false);
    expect(res.error).toContain('No proposal_snapshot');
  });

  it('returns idempotent replay result when SUCCESS execution already exists', async () => {
    getAuditLog.mockResolvedValueOnce([
      {
        id: 'd3',
        decision: 'APPROVED',
        correlation_id: 'c3',
        organization_id: 'org-1',
        proposal_snapshot: { proposal_id: 'p1', action_type: 'TASK_CREATE' },
      },
    ]);
    dbGetRow.current = {
      id: 'ex-1',
      decision_id: 'd3',
      proposal_id: 'p1',
      action_type: 'TASK_CREATE',
      status: 'SUCCESS',
      result: JSON.stringify({ ok: true }),
      created_at: '2026-01-01T00:00:00.000Z',
    };
    const { default: adapter } = await import('../../server/src/ai/actionExecutionAdapter.ts');
    const res = await adapter.executeDecision('d3', 'SYSTEM');
    expect(res.success).toBe(true);
    expect(res.idempotent_replay).toBe(true);
    expect(res.result).toEqual({ ok: true });
  });

  it('supports dry_run even when there is no existing execution row', async () => {
    getAuditLog.mockResolvedValueOnce([
      {
        id: 'd4',
        decision: 'APPROVED',
        correlation_id: 'c4',
        organization_id: 'org-1',
        decided_by_user_id: 'u-1',
        proposal_snapshot: { proposal_id: 'p1', action_type: 'TASK_CREATE' },
      },
    ]);
    const { default: adapter } = await import('../../server/src/ai/actionExecutionAdapter.ts');
    const res = await adapter.executeDecision('d4', 'SYSTEM', { dry_run: true });
    expect(res.dry_run).toBe(true);
    expect(res.action_type).toBe('TASK_CREATE');
  });
});
