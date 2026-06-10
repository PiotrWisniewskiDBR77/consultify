/**
 * AI Settings Fallback
 *
 * Graceful degradation layer for the personal (user-tier) AI settings routes.
 *
 * The primary path is `AISettingsService` (backed by the `user_ai_settings`
 * table). If that service fails to import at server startup — or throws at
 * runtime — the user-facing AI Behavior / Model / Parameters / Personality /
 * Privacy pages must still load and save, rather than returning a hard 503 that
 * blanks every AI settings page.
 *
 * This module persists the same user-tier settings shape to `user_preferences`
 * (key `settings:ai-user`) using the shared upsert/select primitives, merged on
 * top of static defaults. It intentionally only covers the *user* tier; the
 * org / superadmin control planes have no safe local fallback and continue to
 * surface a service-unavailable error.
 */

import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export const AI_USER_FALLBACK_KEY = 'settings:ai-user';

/** Default personal AI settings — mirrors DEFAULT_USER in aiSettingsService. */
export const DEFAULT_USER_AI_SETTINGS = {
  response_style: 'balanced',
  writing_tone: 'professional',
  preferred_language: 'auto',
  code_explanations: true,
  show_sources: true,
  proactivity_mode: 'BALANCED',
  model_temperature: 0.7,
  max_tokens: 4096,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  system_instructions: '',
  visible_model_ids: [] as string[],
  preferred_model_id: null as string | null,
  enable_pii_redaction: false,
  data_retention_policy: 'standard',
  share_usage_analytics: true,
  context_retention: 'session',
  auto_suggestions: true,
};

export type UserAISettings = typeof DEFAULT_USER_AI_SETTINGS & {
  user_id?: string;
  [key: string]: unknown;
};

const ensureTable = async (): Promise<void> => {
  await dbRun(
    `CREATE TABLE IF NOT EXISTS user_preferences (
       id TEXT PRIMARY KEY,
       user_id TEXT NOT NULL,
       key TEXT NOT NULL,
       value TEXT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       UNIQUE(user_id, key)
     )`
  );
};

/**
 * Read the user's personal AI settings from `user_preferences`, merged onto
 * defaults. Never throws — returns defaults on any failure.
 */
export const getUserSettingsFallback = async (userId: string): Promise<UserAISettings> => {
  try {
    await ensureTable();
    const row = await dbGet<{ value: string }>(
      `SELECT value FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, AI_USER_FALLBACK_KEY],
      { fallback: false }
    );
    let stored: Record<string, unknown> = {};
    if (row?.value) {
      try {
        const parsed = JSON.parse(row.value);
        if (parsed && typeof parsed === 'object') stored = parsed as Record<string, unknown>;
      } catch {
        // ignore malformed stored value, fall back to defaults
      }
    }
    return { ...DEFAULT_USER_AI_SETTINGS, ...stored, user_id: userId };
  } catch (err) {
    logger.warn(`[AI Settings Fallback] getUserSettingsFallback failed: ${err}`);
    return { ...DEFAULT_USER_AI_SETTINGS, user_id: userId };
  }
};

/**
 * Merge + persist the user's personal AI settings to `user_preferences`.
 * Returns the merged result. Throws only if the write itself fails.
 */
export const updateUserSettingsFallback = async (
  userId: string,
  settings: Record<string, unknown>
): Promise<UserAISettings> => {
  await ensureTable();
  const current = await getUserSettingsFallback(userId);
  const merged: UserAISettings = { ...current, ...settings, user_id: userId };
  // Only persist known keys to avoid storing arbitrary payloads.
  const persistable: Record<string, unknown> = { user_id: userId };
  for (const key of Object.keys(DEFAULT_USER_AI_SETTINGS)) {
    persistable[key] = (merged as Record<string, unknown>)[key];
  }

  const { v4: uuidv4 } = await import('uuid');
  await dbRun(
    `INSERT INTO user_preferences (id, user_id, key, value, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    [uuidv4(), userId, AI_USER_FALLBACK_KEY, JSON.stringify(persistable)]
  );
  return merged;
};

/** Effective settings fallback: just the user defaults flattened (no org merge). */
export const getEffectiveSettingsFallback = async (userId: string): Promise<UserAISettings> => {
  return getUserSettingsFallback(userId);
};
