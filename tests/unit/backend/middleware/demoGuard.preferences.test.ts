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

  it('writes demo:enabled and demo:started_at via delete+insert when enabled=true', async () => {
    runMock.mockResolvedValue({ success: true, changes: 1 });

    await setUserDemoPreference('user-1', true);

    const sqls = runMock.mock.calls.map((c) => String(c[0] || ''));
    expect(sqls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS user_preferences'))).toBe(true);
    expect(sqls.some((s) => s.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_prefs_user_key'))).toBe(true);
    expect(sqls.some((s) => s.includes('DELETE FROM user_preferences'))).toBe(true);
    expect(sqls.some((s) => s.includes('INSERT INTO user_preferences'))).toBe(true);

    const inserts = runMock.mock.calls.filter((c) => String(c[0] || '').includes('INSERT INTO user_preferences'));
    const keys = inserts.map((c) => String((c[1] as any[])?.[1] || ''));
    expect(keys).toContain('demo:enabled');
    expect(keys).toContain('demo:started_at');
  });

  it('writes only demo:enabled when enabled=false', async () => {
    runMock.mockResolvedValue({ success: true, changes: 1 });

    await setUserDemoPreference('user-2', false);

    const inserts = runMock.mock.calls.filter((c) => String(c[0] || '').includes('INSERT INTO user_preferences'));
    const keys = inserts.map((c) => String((c[1] as any[])?.[1] || ''));
    expect(keys).toContain('demo:enabled');
    expect(keys).not.toContain('demo:started_at');
  });

  it('throws when demo:enabled insert fails', async () => {
    runMock
      .mockResolvedValueOnce({ success: true, changes: 0 }) // CREATE TABLE
      .mockResolvedValueOnce({ success: true, changes: 0 }) // CREATE INDEX
      .mockResolvedValueOnce({ success: true, changes: 1 }) // DELETE demo:enabled
      .mockRejectedValueOnce(new Error('insert failed')); // INSERT demo:enabled

    await expect(setUserDemoPreference('user-3', true)).rejects.toThrow('insert failed');
  });
});
