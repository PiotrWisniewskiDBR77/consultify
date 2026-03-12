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
    // Calls order (enabled=true triggers setDemoStartedAt internally):
    // 0: requireUserPreferencesTable (for demo:enabled)
    // 1: UPDATE demo:enabled  → changes:1 (success, no insert needed)
    // 2: requireUserPreferencesTable (for demo:started_at inside setDemoStartedAt)
    // 3: UPDATE demo:started_at → changes:1 or 0 (doesn't matter for this test)
    runMock
      .mockResolvedValueOnce({ success: true, changes: 0 })  // CREATE TABLE (demo:enabled)
      .mockResolvedValueOnce({ success: true, changes: 1 })  // UPDATE demo:enabled
      .mockResolvedValueOnce({ success: true, changes: 0 })  // CREATE TABLE (demo:started_at)
      .mockResolvedValueOnce({ success: true, changes: 1 }); // UPDATE demo:started_at

    await setUserDemoPreference('user-1', true);

    // Check that the UPDATE for demo:enabled was the second call
    expect(String(runMock.mock.calls[1]?.[0] || '')).toContain('UPDATE user_preferences');
    // No INSERT for demo:enabled
    const demoEnabledCalls = runMock.mock.calls.filter(
      (args) => String(args[1]?.[1] || '').includes('demo:enabled') || String(args[0] || '').includes('demo:enabled')
    );
    expect(demoEnabledCalls.some((args) => String(args[0] || '').includes('INSERT INTO user_preferences'))).toBe(false);
  });

  it('falls back to insert when update does not match row', async () => {
    // enabled=false so setDemoStartedAt is NOT called
    // Calls order:
    // 0: requireUserPreferencesTable (for demo:enabled)
    // 1: UPDATE demo:enabled → changes:0 (no row, need insert)
    // 2: INSERT demo:enabled → changes:1
    runMock
      .mockResolvedValueOnce({ success: true, changes: 0 })  // CREATE TABLE
      .mockResolvedValueOnce({ success: true, changes: 0 })  // UPDATE → no match
      .mockResolvedValueOnce({ success: true, changes: 1 }); // INSERT

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
    // enabled=true but we'll fail at INSERT before reaching setDemoStartedAt
    // Calls order:
    // 0: requireUserPreferencesTable
    // 1: UPDATE → changes:0 (no row)
    // 2: INSERT → fails
    runMock
      .mockResolvedValueOnce({ success: true, changes: 0 })          // CREATE TABLE
      .mockResolvedValueOnce({ success: true, changes: 0 })          // UPDATE → no match
      .mockResolvedValueOnce({ success: false, error: 'insert failed' }); // INSERT → fail

    await expect(setUserDemoPreference('user-3', true)).rejects.toThrow('insert failed');
  });
});
