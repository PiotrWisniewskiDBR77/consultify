import { beforeEach, describe, expect, it, vi } from 'vitest';

type GetCallback = (error: Error | null, row: unknown) => void;
type AllCallback = (error: Error | null, rows: unknown[]) => void;

const getDriver = vi.fn((_sql: string, _params: unknown[], callback: GetCallback) => {
  callback(null, null);
});
const allDriver = vi.fn((_sql: string, _params: unknown[], callback: AllCallback) => {
  callback(null, []);
});

vi.mock('../../database/Database.js', () => ({
  __esModule: true,
  default: {
    get: (...args: [string, unknown[], GetCallback]) => getDriver(...args),
    all: (...args: [string, unknown[], AllCallback]) => allDriver(...args),
  },
}));

vi.mock('../queryHelpers.js', () => ({
  getCurrentPgTransactionClient: () => undefined,
  recordQueryPerformance: vi.fn(),
}));

import { tableExists } from '../DbPromise.js';
import { clearFlagCache, getV8Flags } from '../../services/v8/featureFlagService.js';

describe('DbPromise.tableExists', () => {
  beforeEach(() => {
    getDriver.mockReset();
    allDriver.mockReset();
    clearFlagCache();
  });

  it('uses scalar v8 then public schema parameters and returns true for a matching row', async () => {
    getDriver.mockImplementationOnce((_sql, _params, callback) => {
      callback(null, { table_name: 'v8_feature_flags' });
    });

    await expect(tableExists('v8_feature_flags')).resolves.toBe(true);
    expect(getDriver).toHaveBeenCalledOnce();
    const [sql, params] = getDriver.mock.calls[0]!;
    expect(sql).toContain('table_schema IN ($1, $2)');
    expect(sql).toContain('table_name = $3');
    expect(params).toEqual(['v8', 'public', 'v8_feature_flags']);
    expect(params.some(Array.isArray)).toBe(false);
  });

  it('uses only the public schema for an ordinary table and returns false for no row', async () => {
    getDriver.mockImplementationOnce((_sql, _params, callback) => callback(null, null));

    await expect(tableExists('organizations')).resolves.toBe(false);
    const [sql, params] = getDriver.mock.calls[0]!;
    expect(sql).toContain('table_schema IN ($1)');
    expect(sql).toContain('table_name = $2');
    expect(params).toEqual(['public', 'organizations']);
  });

  it('rethrows adapter errors instead of converting them into a missing table', async () => {
    getDriver.mockImplementationOnce((_sql, _params, callback) => {
      callback(new Error('invalid array parameter adaptation'), undefined);
    });

    await expect(tableExists('v8_feature_flags')).rejects.toThrow(
      'invalid array parameter adaptation'
    );
  });

  it('lets the feature-flag service preserve a genuine missing-table result', async () => {
    getDriver.mockImplementationOnce((_sql, _params, callback) => callback(null, null));

    await expect(getV8Flags('org-missing')).resolves.toEqual({});
    expect(allDriver).not.toHaveBeenCalled();
  });

  it('lets the feature-flag service read rows after the table is found', async () => {
    getDriver.mockImplementationOnce((_sql, _params, callback) => {
      callback(null, { table_name: 'v8_feature_flags' });
    });
    allDriver.mockImplementationOnce((_sql, _params, callback) => {
      callback(null, [{ module: 'workspace', enabled: 1 }]);
    });

    await expect(getV8Flags('org-present')).resolves.toEqual({ workspace: true });
  });

  it('makes the feature-flag service fail loud on adapter or initialization errors', async () => {
    getDriver.mockImplementationOnce((_sql, _params, callback) => {
      callback(new Error('database adapter is not ready'), undefined);
    });

    await expect(getV8Flags('org-error')).rejects.toThrow('database adapter is not ready');
    expect(allDriver).not.toHaveBeenCalled();
  });
});
