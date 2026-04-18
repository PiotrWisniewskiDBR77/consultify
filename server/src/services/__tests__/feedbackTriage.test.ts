import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbAllMock, getTableColumnsMock } = vi.hoisted(() => ({
  dbAllMock: vi.fn(),
  getTableColumnsMock: vi.fn(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: dbAllMock,
}));

vi.mock('../../utils/dbSchema.js', () => ({
  getTableColumns: getTableColumnsMock,
}));

import {
  findDuplicateCandidates,
  inferCluster,
  inferPriorityForPipeline,
} from '../feedbackTriage.js';

describe('feedbackTriage.inferCluster', () => {
  it('maps /superadmin/users to "Superadmin Users"', () => {
    expect(inferCluster('/superadmin/users')).toBe('Superadmin Users');
  });

  it('maps nested superadmin routes to "Superadmin"', () => {
    expect(inferCluster('/superadmin/revenue/partners')).toBe('Superadmin');
  });

  it('maps /auth routes to "Auth"', () => {
    expect(inferCluster('/login')).toBe('Auth');
    expect(inferCluster('/auth/reset')).toBe('Auth');
  });

  it('strips query string and hash before matching', () => {
    expect(inferCluster('/admin/billing?tab=overview#section')).toBe('Admin Billing');
  });

  it('returns null for unknown paths', () => {
    expect(inferCluster('/this/does/not/exist')).toBeNull();
    expect(inferCluster(null)).toBeNull();
    expect(inferCluster('')).toBeNull();
  });
});

describe('feedbackTriage.inferPriorityForPipeline', () => {
  it('bumps priority on production BUG', () => {
    expect(
      inferPriorityForPipeline({
        basePriority: 'medium',
        appEnv: 'production',
        type: 'BUG',
        severity: null,
        hasUncaughtError: false,
        duplicateCount: 0,
      })
    ).toBe('high');
  });

  it('forces critical when severity=CRITICAL regardless of env', () => {
    expect(
      inferPriorityForPipeline({
        basePriority: 'low',
        appEnv: 'staging',
        type: 'IDEA',
        severity: 'CRITICAL',
        hasUncaughtError: false,
        duplicateCount: 0,
      })
    ).toBe('critical');
  });

  it('bumps on uncaught error', () => {
    expect(
      inferPriorityForPipeline({
        basePriority: 'low',
        appEnv: 'staging',
        type: 'BUG',
        severity: 'LOW',
        hasUncaughtError: true,
        duplicateCount: 0,
      })
    ).toBe('medium');
  });

  it('bumps when duplicate storm >= 3', () => {
    expect(
      inferPriorityForPipeline({
        basePriority: 'low',
        appEnv: 'staging',
        type: 'BUG',
        severity: 'LOW',
        hasUncaughtError: false,
        duplicateCount: 4,
      })
    ).toBe('medium');
  });

  it('combines prod + uncaught + duplicates up to critical', () => {
    expect(
      inferPriorityForPipeline({
        basePriority: 'medium',
        appEnv: 'prod',
        type: 'BUG',
        severity: 'MEDIUM',
        hasUncaughtError: true,
        duplicateCount: 5,
      })
    ).toBe('critical');
  });
});

describe('feedbackTriage.findDuplicateCandidates', () => {
  beforeEach(() => {
    dbAllMock.mockReset();
    getTableColumnsMock.mockReset();
  });

  it('returns [] when signatureHash is empty or invalid', async () => {
    expect(await findDuplicateCandidates('', 5)).toEqual([]);
    expect(await findDuplicateCandidates(undefined as unknown as string, 5)).toEqual([]);
  });

  it('returns [] when metadata_json column is missing', async () => {
    getTableColumnsMock.mockResolvedValueOnce(new Set<string>(['id', 'title']));
    const res = await findDuplicateCandidates('abc123', 5);
    expect(res).toEqual([]);
    expect(dbAllMock).not.toHaveBeenCalled();
  });

  it('returns mapped rows when matches exist', async () => {
    getTableColumnsMock.mockResolvedValueOnce(
      new Set<string>(['id', 'title', 'metadata_json', 'status', 'created_at'])
    );
    dbAllMock.mockResolvedValueOnce([
      {
        id: 'f-1',
        title: 'Users list empty',
        status: 'NEW',
        created_at: '2026-04-16T09:00:00Z',
        metadata_json: '{"signatureHash":"abc123"}',
      },
      {
        id: 'f-2',
        title: null,
        status: 'RESOLVED',
        created_at: '2026-04-14T08:00:00Z',
        metadata_json: '{"signatureHash":"abc123"}',
      },
    ]);
    const res = await findDuplicateCandidates('abc123', 5);
    expect(res).toEqual([
      {
        id: 'f-1',
        title: 'Users list empty',
        status: 'NEW',
        createdAt: '2026-04-16T09:00:00Z',
      },
      {
        id: 'f-2',
        title: null,
        status: 'RESOLVED',
        createdAt: '2026-04-14T08:00:00Z',
      },
    ]);
  });

  it('returns [] when DB query throws', async () => {
    getTableColumnsMock.mockResolvedValueOnce(new Set<string>(['metadata_json']));
    dbAllMock.mockRejectedValueOnce(new Error('db gone'));
    expect(await findDuplicateCandidates('abc', 5)).toEqual([]);
  });
});
