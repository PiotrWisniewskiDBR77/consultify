import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runMock, getMock } = vi.hoisted(() => ({
  runMock: vi.fn(),
  getMock: vi.fn(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  run: runMock,
  get: getMock,
}));

import { setUserDemoPreference } from '../../../../server/src/middleware/demoGuard.middleware.ts';

describe('demoGuard.middleware setUserDemoPreference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates existing preference without insert', async () => {
    runMock
      .mockResolvedValueOnce({ success: true, changes: 0 })
      .mockResolvedValueOnce({ success: true, changes: 1 });

    await setUserDemoPreference('user-1', true);

    expect(runMock).toHaveBeenCalledTimes(2);
    expect(String(runMock.mock.calls[1]?.[0] || '')).toContain('UPDATE user_preferences');
    expect(runMock.mock.calls.some((args) => String(args[0] || '').includes('INSERT INTO user_preferences'))).toBe(
      false
    );
    expect(runMock.mock.calls.some((args) => String(args[0] || '').includes('ON CONFLICT'))).toBe(false);
  });

  it('falls back to insert when update does not match row', async () => {
    runMock
      .mockResolvedValueOnce({ success: true, changes: 0 })
      .mockResolvedValueOnce({ success: true, changes: 0 })
      .mockResolvedValueOnce({ success: true, changes: 1 });

    await setUserDemoPreference('user-2', false);

    expect(runMock).toHaveBeenCalledTimes(3);
    expect(String(runMock.mock.calls[1]?.[0] || '')).toContain('UPDATE user_preferences');
    expect(String(runMock.mock.calls[2]?.[0] || '')).toContain('INSERT INTO user_preferences');

    const insertParams = runMock.mock.calls[2]?.[1] as unknown[];
    expect(insertParams[0]).toBe('user-2');
    expect(insertParams[1]).toBe('demo:enabled');
    expect(insertParams[2]).toBe('false');
    expect(typeof insertParams[3]).toBe('string');
  });

  it('throws when insert fallback fails', async () => {
    runMock
      .mockResolvedValueOnce({ success: true, changes: 0 })
      .mockResolvedValueOnce({ success: true, changes: 0 })
      .mockResolvedValueOnce({ success: false, error: 'insert failed' });

    await expect(setUserDemoPreference('user-3', true)).rejects.toThrow('insert failed');
  });
});
