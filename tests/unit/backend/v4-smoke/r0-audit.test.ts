/**
 * R0 Smoke: V4-ENT-03 — Audit Events Service
 * Verifies: log() writes event, query() retrieves with filters
 */

const mockDb = vi.hoisted(() => ({
  run: vi.fn().mockResolvedValue({ changes: 1 }),
  all: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue({ count: 0 }),
}));

vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import auditEventsService from '../../../../server/src/services/AuditEventsService.js';

describe('V4-ENT-03: AuditEventsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('log() inserts an audit event and returns an ID', async () => {
    const id = await auditEventsService.log({
      actorId: 'user-1',
      actorType: 'USER',
      action: 'CREATE',
      resourceType: 'initiative',
      resourceId: 'init-1',
      organizationId: 'org-1',
    });

    expect(id).toMatch(/^ae-/);
    expect(mockDb.run).toHaveBeenCalledTimes(1);
    const sql = mockDb.run.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO audit_events');
    const params = mockDb.run.mock.calls[0][1] as any[];
    expect(params).toContain('user-1');
    expect(params).toContain('USER');
    expect(params).toContain('CREATE');
    expect(params).toContain('initiative');
    expect(params).toContain('init-1');
  });

  it('log() serializes before/after as JSON', async () => {
    await auditEventsService.log({
      actorType: 'SYSTEM',
      action: 'UPDATE',
      resourceType: 'task',
      before: { status: 'open' },
      after: { status: 'done' },
    });

    const params = mockDb.run.mock.calls[0][1] as any[];
    expect(params).toContain(JSON.stringify({ status: 'open' }));
    expect(params).toContain(JSON.stringify({ status: 'done' }));
  });

  it('query() builds WHERE clause from filters', async () => {
    mockDb.get.mockResolvedValue({ count: 3 });
    mockDb.all.mockResolvedValue([
      { id: 'ae-1', actorId: 'u1', action: 'CREATE', resourceType: 'task' },
    ]);

    const result = await auditEventsService.query({
      resourceType: 'task',
      actorId: 'u1',
      limit: 10,
      offset: 0,
    });

    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(1);
    const countSql = mockDb.get.mock.calls[0][0] as string;
    expect(countSql).toContain('resource_type = ?');
    expect(countSql).toContain('actor_id = ?');
  });

  it('query() respects date range filters', async () => {
    mockDb.get.mockResolvedValue({ count: 0 });
    mockDb.all.mockResolvedValue([]);

    await auditEventsService.query({
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
    });

    const sql = mockDb.get.mock.calls[0][0] as string;
    expect(sql).toContain('ts >= ?');
    expect(sql).toContain('ts <= ?');
  });

  it('query() limits to 1000 max', async () => {
    mockDb.get.mockResolvedValue({ count: 0 });
    mockDb.all.mockResolvedValue([]);

    await auditEventsService.query({ limit: 5000 });

    const params = mockDb.all.mock.calls[0][1] as any[];
    expect(params[params.length - 2]).toBe(1000);
  });
});
