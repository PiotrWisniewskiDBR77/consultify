import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockDb = {
  all: (sql: string, params: unknown[], cb: (err: Error | null, rows: unknown[]) => void) => void;
  get: (sql: string, params: unknown[], cb: (err: Error | null, row: unknown) => void) => void;
  run: (
    sql: string,
    params: unknown[],
    cb: (this: { lastID?: number; changes: number }, err: Error | null) => void
  ) => void;
  serialize: (cb: () => void) => void;
};

let mockDb: MockDb;
const logger = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };

vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: () => mockDb,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: logger,
}));

async function importFresh() {
  vi.resetModules();
  logger.error.mockClear();
  logger.info.mockClear();
  logger.warn.mockClear();
  return await import('../../../../server/src/utils/queryHelpers.js');
}

describe('server utils/queryHelpers', () => {
  beforeEach(() => {
    mockDb = {
      all: vi.fn(),
      get: vi.fn(),
      run: vi.fn(),
      serialize: vi.fn((cb) => cb()),
    };
  });

  it('queryAll resolves rows', async () => {
    (mockDb.all as any).mockImplementation((_sql: string, _params: unknown[], cb: any) =>
      cb(null, [{ id: 1 }])
    );
    const { queryAll } = await importFresh();
    await expect(queryAll('SELECT 1')).resolves.toEqual([{ id: 1 }]);
  });

  it('queryAll rejects and logs on error', async () => {
    (mockDb.all as any).mockImplementation((_sql: string, _params: unknown[], cb: any) =>
      cb(new Error('boom'), [])
    );
    const { queryAll } = await importFresh();
    await expect(queryAll('SELECT 1')).rejects.toThrow('boom');
    expect(logger.error).toHaveBeenCalled();
  });

  it('queryOne resolves row and returns null when row is falsy', async () => {
    (mockDb.get as any).mockImplementationOnce((_sql: string, _params: unknown[], cb: any) =>
      cb(null, { id: 1 })
    );
    (mockDb.get as any).mockImplementationOnce((_sql: string, _params: unknown[], cb: any) =>
      cb(null, null)
    );
    const { queryOne } = await importFresh();
    await expect(queryOne('SELECT 1')).resolves.toEqual({ id: 1 });
    await expect(queryOne('SELECT 2')).resolves.toBeNull();
  });

  it('queryOne rejects and logs on error', async () => {
    (mockDb.get as any).mockImplementation((_sql: string, _params: unknown[], cb: any) =>
      cb(new Error('nope'), null)
    );
    const { queryOne } = await importFresh();
    await expect(queryOne('SELECT 1')).rejects.toThrow('nope');
    expect(logger.error).toHaveBeenCalled();
  });

  it('queryRun resolves QueryResult from sqlite callback this', async () => {
    (mockDb.run as any).mockImplementation((_sql: string, _params: unknown[], cb: any) =>
      cb.call({ lastID: 7, changes: 2 }, null)
    );
    const { queryRun } = await importFresh();
    await expect(queryRun('UPDATE x')).resolves.toEqual({ lastID: 7, changes: 2 });
  });

  it('queryRun rejects and logs on error', async () => {
    (mockDb.run as any).mockImplementation((_sql: string, _params: unknown[], cb: any) =>
      cb.call({ changes: 0 }, new Error('fail'))
    );
    const { queryRun } = await importFresh();
    await expect(queryRun('UPDATE x')).rejects.toThrow('fail');
    expect(logger.error).toHaveBeenCalled();
  });

  it('queryParallel executes mix of all/one/run', async () => {
    (mockDb.all as any).mockImplementation((_sql: string, _params: unknown[], cb: any) =>
      cb(null, [{ a: 1 }])
    );
    (mockDb.get as any).mockImplementation((_sql: string, _params: unknown[], cb: any) =>
      cb(null, { b: 2 })
    );
    (mockDb.run as any).mockImplementation((_sql: string, _params: unknown[], cb: any) =>
      cb.call({ lastID: 3, changes: 1 }, null)
    );

    const { queryParallel } = await importFresh();
    const out = await queryParallel([
      { type: 'all', sql: 'SELECT a' },
      { type: 'one', sql: 'SELECT b' },
      { type: 'run', sql: 'UPDATE c' },
    ]);
    expect(out).toEqual([[{ a: 1 }], { b: 2 }, { lastID: 3, changes: 1 }]);
  });

  it('buildInPlaceholders returns a comma-separated placeholder list', async () => {
    const { buildInPlaceholders } = await importFresh();
    expect(buildInPlaceholders([])).toBe('');
    expect(buildInPlaceholders([1, 2, 3])).toBe('?, ?, ?');
  });

  it('parseJsonFields parses JSON strings and warns+defaults on invalid JSON', async () => {
    const { parseJsonFields } = await importFresh();
    expect(parseJsonFields({ tags: '["a","b"]' } as any).tags).toEqual(['a', 'b']);

    const out = parseJsonFields({ data: '{bad' } as any);
    expect(out.data).toEqual({});
    expect(logger.warn).toHaveBeenCalled();

    const rowWithArrayField: any = {};
    rowWithArrayField['items[]'] = '{bad';
    const outArrayDefault = parseJsonFields(rowWithArrayField, ['items[]']);
    expect(outArrayDefault['items[]']).toEqual([]);
  });

  it('transaction commits on success and rolls back on failures', async () => {
    const runs: Array<{ sql: string; err?: string }> = [];
    (mockDb.run as any).mockImplementation((sql: string, _params: unknown[], cb: any) => {
      runs.push({ sql });
      if (sql === 'BEGIN TRANSACTION') return cb(null);
      if (sql === 'COMMIT') return cb(null);
      if (sql === 'ROLLBACK') return cb(null);
      cb(null);
    });

    const { transaction } = await importFresh();
    await expect(
      transaction(async () => {
        return { ok: true };
      })
    ).resolves.toEqual({ ok: true });
    expect(runs.map((r) => r.sql)).toEqual(['BEGIN TRANSACTION', 'COMMIT']);

    runs.length = 0;
    await expect(
      transaction(async () => {
        throw new Error('bad');
      })
    ).rejects.toThrow('bad');
    expect(runs.map((r) => r.sql)).toEqual(['BEGIN TRANSACTION', 'ROLLBACK']);
  });
});
