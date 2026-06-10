/**
 * Unit tests for the AI settings graceful-degradation fallback.
 *
 * When AISettingsService is unavailable, the user-tier AI settings routes fall
 * back to persisting/reading from user_preferences. These tests verify the
 * fallback merges onto defaults, persists only known keys, and never throws on
 * a read failure.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbGet = vi.fn();
const dbRun = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import {
  DEFAULT_USER_AI_SETTINGS,
  getUserSettingsFallback,
  updateUserSettingsFallback,
} from '../aiSettingsFallback.js';

beforeEach(() => {
  dbGet.mockReset();
  dbRun.mockReset();
  dbRun.mockResolvedValue({ success: true });
});

describe('aiSettingsFallback', () => {
  it('returns defaults merged with the user id when nothing is stored', async () => {
    dbGet.mockResolvedValue(null);
    const result = await getUserSettingsFallback('user-1');
    expect(result.user_id).toBe('user-1');
    expect(result.response_style).toBe(DEFAULT_USER_AI_SETTINGS.response_style);
    expect(result.model_temperature).toBe(DEFAULT_USER_AI_SETTINGS.model_temperature);
  });

  it('merges stored values over defaults', async () => {
    dbGet.mockResolvedValue({
      value: JSON.stringify({ response_style: 'concise', model_temperature: 0.2 }),
    });
    const result = await getUserSettingsFallback('user-1');
    expect(result.response_style).toBe('concise');
    expect(result.model_temperature).toBe(0.2);
    // Untouched keys still come from defaults.
    expect(result.writing_tone).toBe(DEFAULT_USER_AI_SETTINGS.writing_tone);
  });

  it('never throws on a read failure — returns defaults', async () => {
    dbGet.mockRejectedValue(new Error('db down'));
    const result = await getUserSettingsFallback('user-1');
    expect(result.user_id).toBe('user-1');
    expect(result.writing_tone).toBe(DEFAULT_USER_AI_SETTINGS.writing_tone);
  });

  it('persists only known keys and merges over current settings', async () => {
    dbGet.mockResolvedValue({ value: JSON.stringify({ response_style: 'concise' }) });
    const result = await updateUserSettingsFallback('user-1', {
      model_temperature: 0.9,
      // Unknown key must not be persisted.
      malicious: 'drop-tables',
    } as Record<string, unknown>);

    expect(result.model_temperature).toBe(0.9);
    expect(result.response_style).toBe('concise');

    // The persisted JSON (4th positional db param) excludes unknown keys.
    const persistedJson = dbRun.mock.calls.at(-1)?.[1]?.[3];
    const persisted = JSON.parse(persistedJson);
    expect(persisted.model_temperature).toBe(0.9);
    expect(persisted).not.toHaveProperty('malicious');
    expect(persisted.user_id).toBe('user-1');
  });
});
