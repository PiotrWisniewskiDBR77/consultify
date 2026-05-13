import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runMock, getMock } = vi.hoisted(() => ({
  runMock: vi.fn(),
  getMock: vi.fn(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  run: runMock,
  get: getMock,
}));

import {
  checkUserDemoPreference,
  getDemoStartedAt,
  getDemoStats,
  setUserDemoPreference,
} from '../../../../server/src/middleware/demoGuard.middleware.ts';

describe('demoGuard.middleware setUserDemoPreference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes demo:enabled and demo:started_at when enabling demo', async () => {
    runMock.mockResolvedValue({ success: true, changes: 1 });

    await setUserDemoPreference('user-1', true);

    // 2x requireUserPreferencesTable + delete/insert for each key
    expect(runMock).toHaveBeenCalledTimes(8);

    const callsSql = runMock.mock.calls.map((args) => String(args[0] || ''));
    const callsParams = runMock.mock.calls.map((args) => args[1] as unknown[]);

    expect(callsSql.some((sql) => sql.includes('DELETE FROM user_preferences'))).toBe(true);
    expect(callsSql.some((sql) => sql.includes('INSERT INTO user_preferences'))).toBe(true);
    expect(
      callsParams.some((params) => Array.isArray(params) && params[0] === 'user-1' && params[1] === 'demo:enabled')
    ).toBe(true);
    expect(
      callsParams.some(
        (params) => Array.isArray(params) && params[0] === 'user-1' && params[1] === 'demo:started_at'
      )
    ).toBe(true);
  });

  it('writes only demo:enabled when disabling demo', async () => {
    runMock.mockResolvedValue({ success: true, changes: 1 });

    await setUserDemoPreference('user-2', false);

    // 1x requireUserPreferencesTable + delete/insert for demo:enabled
    expect(runMock).toHaveBeenCalledTimes(4);

    const callsParams = runMock.mock.calls.map((args) => args[1] as unknown[]);
    expect(
      callsParams.some((params) => Array.isArray(params) && params[0] === 'user-2' && params[1] === 'demo:enabled')
    ).toBe(true);
    expect(
      callsParams.some(
        (params) => Array.isArray(params) && params[0] === 'user-2' && params[1] === 'demo:started_at'
      )
    ).toBe(false);
  });

  it('does not throw when dbRun resolves with success=false payload', async () => {
    runMock
      .mockResolvedValueOnce({ success: true, changes: 0 })
      .mockResolvedValueOnce({ success: true, changes: 0 })
      .mockResolvedValueOnce({ success: false, error: 'insert failed' })
      .mockResolvedValueOnce({ success: true, changes: 0 });

    await expect(setUserDemoPreference('user-3', false)).resolves.toBeUndefined();
  });

  it('coerces COUNT values to numeric stats safely', async () => {
    getMock
      .mockResolvedValueOnce({ c: '3' } as any)
      .mockResolvedValueOnce({ c: 4 } as any)
      .mockResolvedValueOnce({ c: 'not-a-number' } as any)
      .mockResolvedValueOnce({ c: null } as any)
      .mockResolvedValueOnce(undefined as any);

    const stats = await getDemoStats('org-1');

    expect(stats).toEqual({
      projects: 3,
      initiatives: 4,
      tasks: 0,
      decisions: 0,
      users: 0,
    });
  });

  it('returns false without DB access when user id is invalid in checkUserDemoPreference', async () => {
    const result = await checkUserDemoPreference('   ');

    expect(result).toBe(false);
    expect(runMock).not.toHaveBeenCalled();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('rejects setUserDemoPreference and skips DB calls when user id exceeds max length', async () => {
    await expect(setUserDemoPreference(`u${'x'.repeat(200)}`, true)).rejects.toThrow(
      'Invalid demo preference user id'
    );

    expect(runMock).not.toHaveBeenCalled();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('returns null when getDemoStartedAt user id is invalid without DB access', async () => {
    const startedAt = await getDemoStartedAt('   ');

    expect(startedAt).toBeNull();
    expect(runMock).not.toHaveBeenCalled();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('returns null from getDemoStartedAt when user_preferences table is missing', async () => {
    runMock.mockResolvedValueOnce({ success: true, changes: 0 }).mockResolvedValueOnce({ success: true, changes: 0 });
    getMock.mockRejectedValueOnce(new Error('no such table: user_preferences'));

    const startedAt = await getDemoStartedAt('user-1');

    expect(startedAt).toBeNull();
    expect(getMock).toHaveBeenCalledTimes(1);
  });
});
