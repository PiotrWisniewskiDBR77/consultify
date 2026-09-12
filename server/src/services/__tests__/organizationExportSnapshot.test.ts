import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ calls: [] as string[], policyError: null as Error | null }));
vi.mock('../OrgPoliciesService.js', () => ({
  requireNoLegalHoldInTransaction: vi.fn(async () => {
    state.calls.push('POLICY');
    if (state.policyError) throw state.policyError;
  }),
}));
import { withOrganizationExportSnapshot } from '../organizationExportSnapshot.js';

function fixture(
  options: {
    unlock?: boolean | Error;
    acquireError?: Error;
    rollbackError?: Error;
    beginError?: Error;
  } = {}
) {
  const release = vi.fn();
  const query = vi.fn(async (sql: string) => {
    state.calls.push(sql);
    if (sql.includes('pg_advisory_lock(') && options.acquireError) throw options.acquireError;
    if (sql.startsWith('BEGIN') && options.beginError) throw options.beginError;
    if (sql === 'ROLLBACK' && options.rollbackError) throw options.rollbackError;
    if (sql.includes('pg_advisory_unlock(')) {
      if (options.unlock instanceof Error) throw options.unlock;
      return { rows: [{ unlocked: options.unlock ?? true }] };
    }
    return { rows: [] };
  });
  return { client: { query, release } as unknown as PoolClient, query, release };
}

beforeEach(() => {
  state.calls = [];
  state.policyError = null;
});
describe('organization export pinned snapshot ownership', () => {
  it('takes session lock before RR snapshot and policy and releases after commit', async () => {
    const { client, query, release } = fixture();
    const read = vi.fn(async (pinned: PoolClient) => {
      expect(pinned).toBe(client);
      state.calls.push('EXPORT');
      return 'file';
    });
    expect(await withOrganizationExportSnapshot(client, 'org-a', read)).toBe('file');
    expect(state.calls).toEqual([
      'SELECT pg_advisory_lock(hashtextextended($1, 0))',
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      'POLICY',
      'EXPORT',
      'COMMIT',
      'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS unlocked',
    ]);
    expect(query.mock.calls[0]).toEqual([
      'SELECT pg_advisory_lock(hashtextextended($1, 0))',
      ['org-a'],
    ]);
    expect(release).toHaveBeenCalledExactlyOnceWith(undefined);
  });
  it.each([false, new Error('unlock socket error')])(
    'destroys client on unconfirmed unlock %s',
    async (unlock) => {
      const { client, release } = fixture({ unlock });
      await withOrganizationExportSnapshot(client, 'org-a', async () => 'file');
      expect(release).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
    }
  );
  it('destroys client when acquire acknowledgement is lost and does not begin a snapshot', async () => {
    const { client, release } = fixture({ acquireError: new Error('ACK lost') });
    const read = vi.fn();
    await expect(withOrganizationExportSnapshot(client, 'org-a', read)).rejects.toThrow('ACK lost');
    expect(state.calls).toEqual(['SELECT pg_advisory_lock(hashtextextended($1, 0))']);
    expect(read).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
  });
  it('rolls back before unlocking after export failure and preserves original error', async () => {
    const { client, release } = fixture();
    await expect(
      withOrganizationExportSnapshot(client, 'org-a', async () => {
        throw new Error('export failed');
      })
    ).rejects.toThrow('export failed');
    expect(state.calls.slice(-2)).toEqual([
      'ROLLBACK',
      'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS unlocked',
    ]);
    expect(release).toHaveBeenCalledExactlyOnceWith(undefined);
  });
  it('does not export held organization and releases snapshot and lock', async () => {
    state.policyError = new Error('LEGAL_HOLD');
    const { client, release } = fixture();
    const read = vi.fn();
    await expect(withOrganizationExportSnapshot(client, 'org-a', read)).rejects.toThrow(
      'LEGAL_HOLD'
    );
    expect(read).not.toHaveBeenCalled();
    expect(state.calls.slice(-2)).toEqual([
      'ROLLBACK',
      'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS unlocked',
    ]);
    expect(release).toHaveBeenCalledExactlyOnceWith(undefined);
  });
  it('destroys client if rollback itself fails even when unlock succeeds', async () => {
    const { client, release } = fixture({ rollbackError: new Error('rollback failed') });
    await expect(
      withOrganizationExportSnapshot(client, 'org-a', async () => {
        throw new Error('export failed');
      })
    ).rejects.toThrow('export failed');
    expect(release).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
  });
  it('rolls back an uncertain BEGIN acknowledgement before returning a healthy client', async () => {
    const { client, release } = fixture({ beginError: new Error('BEGIN ACK lost') });
    const read = vi.fn();
    await expect(withOrganizationExportSnapshot(client, 'org-a', read)).rejects.toThrow(
      'BEGIN ACK lost'
    );
    expect(read).not.toHaveBeenCalled();
    expect(state.calls.slice(-2)).toEqual([
      'ROLLBACK',
      'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS unlocked',
    ]);
    expect(release).toHaveBeenCalledExactlyOnceWith(undefined);
  });
  it('destroys an uncertain BEGIN connection when rollback acknowledgement also fails', async () => {
    const { client, release } = fixture({
      beginError: new Error('BEGIN ACK lost'),
      rollbackError: new Error('ROLLBACK ACK lost'),
    });
    await expect(
      withOrganizationExportSnapshot(client, 'org-a', async () => 'file')
    ).rejects.toThrow('BEGIN ACK lost');
    expect(release).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
  });
});
