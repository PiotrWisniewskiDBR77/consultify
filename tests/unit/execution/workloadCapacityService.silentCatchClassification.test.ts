/**
 * DEC-120 A1-A3 (same disease as DEC-112/A5) — workloadCapacityService had
 * five bare `catch {}` blocks written as "the table may not exist yet"
 * fallbacks, with no check on the error message. That also silenced a real
 * bug (missing column, dropped connection) as if it were the benign
 * missing-table case. They now classify via
 * DbPromise.isSilenceableMissingRelationError before staying quiet.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAll, mockGet, mockLoggerError } = vi.hoisted(() => ({
  mockAll: vi.fn(),
  mockGet: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', async () => {
  const actual = await vi.importActual<typeof import('../../../server/src/utils/DbPromise.js')>(
    '../../../server/src/utils/DbPromise.js'
  );
  return {
    __esModule: true,
    isSilenceableMissingRelationError: actual.isSilenceableMissingRelationError,
    default: {
      all: (...args: unknown[]) => mockAll(...args),
      get: (...args: unknown[]) => mockGet(...args),
    },
  };
});

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: mockLoggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { getCapacityOverview } from '../../../server/src/services/workloadCapacityService';

const oneMember = [{ user_id: 'u1', name: 'Ann', email: 'a@x.test', allocation_percent: 100 }];
const oneAllocRow = [{ user_id: 'u1', window_hours: 10, backlog_hours: 2 }];

beforeEach(() => {
  mockAll.mockReset();
  mockGet.mockReset();
  mockLoggerError.mockReset();
});

describe('workloadCapacityService — silent-catch classification (DEC-120 A1-A3)', () => {
  it('stays quiet when time_entries relation is genuinely missing', async () => {
    mockAll
      .mockResolvedValueOnce(oneMember) // project_members
      .mockResolvedValueOnce(oneAllocRow) // tasks
      .mockRejectedValueOnce(new Error('relation "time_entries" does not exist')); // time_entries

    const result = await getCapacityOverview('org-1');

    expect(result.users).toHaveLength(1);
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('logs loudly with tenant context when the failure is a real column bug', async () => {
    mockAll
      .mockResolvedValueOnce(oneMember)
      .mockResolvedValueOnce(oneAllocRow)
      .mockRejectedValueOnce(new Error('column "hours" does not exist'));

    const result = await getCapacityOverview('org-42');

    // The endpoint still degrades gracefully (actualMap stays empty) ...
    expect(result.users).toHaveLength(1);
    // ... but the failure itself is no longer invisible.
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    const [message, meta] = mockLoggerError.mock.calls[0];
    expect(String(message)).toMatch(/time_entries lookup failed/);
    expect(meta).toMatchObject({ orgId: 'org-42' });
  });

  it('logs loudly on an unrelated connection failure too', async () => {
    mockAll
      .mockResolvedValueOnce(oneMember)
      .mockResolvedValueOnce(oneAllocRow)
      .mockRejectedValueOnce(new Error('connection terminated unexpectedly'));

    await getCapacityOverview('org-99');

    expect(mockLoggerError).toHaveBeenCalledTimes(1);
  });
});
