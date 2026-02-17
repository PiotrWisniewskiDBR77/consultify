import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockDb = {
  all: (sql: string, params: unknown[], cb: (err: Error | null, rows: any[]) => void) => void;
};

let mockDb: MockDb;

vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: () => mockDb,
}));

async function importFresh() {
  vi.resetModules();
  return await import('../../../../server/src/utils/orgColumn.js');
}

describe('server utils/orgColumn', () => {
  beforeEach(() => {
    process.env.DB_TYPE = 'sqlite';
    delete process.env.DATABASE_URL;

    mockDb = {
      all: vi.fn(),
    };
  });

  it('getOrgColumn resolves organization_id when present', async () => {
    (mockDb.all as any).mockImplementation((sql: string, _params: unknown[], cb: any) => {
      expect(sql).toContain('PRAGMA table_info(users)');
      cb(null, [{ name: 'id' }, { name: 'organization_id' }]);
    });

    const mod = await importFresh();
    await expect(mod.getOrgColumn('users')).resolves.toBe('organization_id');
  });

  it('getOrgColumn resolves org_id when organization_id is absent', async () => {
    (mockDb.all as any).mockImplementation((_sql: string, _params: unknown[], cb: any) => {
      cb(null, [{ name: 'id' }, { name: 'org_id' }]);
    });

    const mod = await importFresh();
    await expect(mod.getOrgColumn('tasks')).resolves.toBe('org_id');
  });

  it('getOrgColumn rejects when neither column exists', async () => {
    (mockDb.all as any).mockImplementation((_sql: string, _params: unknown[], cb: any) => {
      cb(null, [{ name: 'id' }, { name: 'created_at' }]);
    });

    const mod = await importFresh();
    await expect(mod.getOrgColumn('unknown_table')).rejects.toThrow('has no organization column');
  });

  it('getOrgColumnCached caches per tableName', async () => {
    (mockDb.all as any).mockImplementation((_sql: string, _params: unknown[], cb: any) => {
      cb(null, [{ name: 'organization_id' }]);
    });

    const mod = await importFresh();
    await expect(mod.getOrgColumnCached('users')).resolves.toBe('organization_id');
    await expect(mod.getOrgColumnCached('users')).resolves.toBe('organization_id');
    expect(mockDb.all).toHaveBeenCalledTimes(1);
  });

  it('orgWhereClause returns parameterized clause and value', async () => {
    (mockDb.all as any).mockImplementation((_sql: string, _params: unknown[], cb: any) => {
      cb(null, [{ name: 'org_id' }]);
    });

    const mod = await importFresh();
    await expect(mod.orgWhereClause('t', 'org-123')).resolves.toEqual({
      clause: 't.org_id = ?',
      value: 'org-123',
    });
  });
});
