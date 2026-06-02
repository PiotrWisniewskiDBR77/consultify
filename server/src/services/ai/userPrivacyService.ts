/**
 * User Privacy & Private Mode (T120)
 * Controls what AI remembers about users, private mode, memory export/delete.
 */
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export class UserPrivacyMemoryStoreError extends Error {
  code = 'AI_GOVERNANCE_MEMORY_INVALID_STORE' as const;
  constructor(message = 'Memory store is invalid') {
    super(message);
    this.name = 'UserPrivacyMemoryStoreError';
  }
}

export class UserPrivacyMemoryDeleteError extends Error {
  code = 'AI_GOVERNANCE_MEMORY_DELETE_FAILED' as const;
  constructor(message = 'Memory could not be deleted') {
    super(message);
    this.name = 'UserPrivacyMemoryDeleteError';
  }
}

export interface UserPrivacySettings {
  memoryEnabled: boolean;
  memoryWriteEnabled: boolean;
  privateModeDefault: boolean;
  retentionMode: 'session' | 'extended' | 'none';
}

const DEFAULT_PRIVACY: UserPrivacySettings = {
  memoryEnabled: true,
  memoryWriteEnabled: true,
  privateModeDefault: false,
  retentionMode: 'session',
};

export async function getUserPrivacySettings(userId: string): Promise<UserPrivacySettings> {
  try {
    const row = (await dbGet(
      `SELECT memory_enabled, memory_write_enabled, private_mode_default, retention_mode FROM ai_user_preferences WHERE user_id = ? LIMIT 1`,
      [userId]
    )) as
      | {
          memory_enabled?: number;
          memory_write_enabled?: number;
          private_mode_default?: number;
          retention_mode?: string;
        }
      | undefined;
    if (row) {
      return {
        memoryEnabled: row.memory_enabled !== 0,
        memoryWriteEnabled: row.memory_write_enabled !== 0,
        privateModeDefault: row.private_mode_default === 1,
        retentionMode:
          (row.retention_mode as UserPrivacySettings['retentionMode']) ||
          DEFAULT_PRIVACY.retentionMode,
      };
    }
  } catch {
    // Table may not have these columns yet
  }
  return { ...DEFAULT_PRIVACY };
}

export async function updateUserPrivacySettings(
  userId: string,
  settings: Partial<UserPrivacySettings>
): Promise<void> {
  const current = await getUserPrivacySettings(userId);
  const merged = { ...current, ...settings };
  try {
    await dbRun(
      `UPDATE ai_user_preferences SET memory_enabled = ?, memory_write_enabled = ?, private_mode_default = ?, retention_mode = ?, updated_at = datetime('now') WHERE user_id = ?`,
      [
        merged.memoryEnabled ? 1 : 0,
        merged.memoryWriteEnabled ? 1 : 0,
        merged.privateModeDefault ? 1 : 0,
        merged.retentionMode,
        userId,
      ]
    );
  } catch {
    try {
      await dbRun(
        `INSERT INTO ai_user_preferences (user_id, memory_enabled, memory_write_enabled, private_mode_default, retention_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          userId,
          merged.memoryEnabled ? 1 : 0,
          merged.memoryWriteEnabled ? 1 : 0,
          merged.privateModeDefault ? 1 : 0,
          merged.retentionMode,
        ]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[UserPrivacy] Failed to save settings: ${msg}`);
    }
  }
}

export function canWriteMemory(settings: UserPrivacySettings, isPrivateMode: boolean): boolean {
  if (isPrivateMode) return false;
  if (!settings.memoryEnabled) return false;
  if (!settings.memoryWriteEnabled) return false;
  if (settings.retentionMode === 'none') return false;
  return true;
}

export function canReadMemory(settings: UserPrivacySettings, isPrivateMode: boolean): boolean {
  if (isPrivateMode) return false;
  if (!settings.memoryEnabled) return false;
  return true;
}

export async function previewMemory(userId: string): Promise<Record<string, unknown>> {
  try {
    const memory = (await dbGet(
      `SELECT preferences, expertise, recent_topics, interaction_count, last_interaction_at FROM ai_user_memory WHERE user_id = ? LIMIT 1`,
      [userId]
    )) as
      | {
          preferences?: string;
          expertise?: string;
          recent_topics?: string;
          interaction_count?: number;
          last_interaction_at?: string;
        }
      | undefined;
    if (!memory) return { empty: true };
    try {
      return {
        preferences: memory.preferences ? JSON.parse(memory.preferences) : null,
        expertise: memory.expertise ? JSON.parse(memory.expertise) : null,
        recentTopics: memory.recent_topics ? JSON.parse(memory.recent_topics) : null,
        interactionCount: memory.interaction_count || 0,
        lastInteractionAt: memory.last_interaction_at,
      };
    } catch {
      throw new UserPrivacyMemoryStoreError('Memory store is invalid');
    }
  } catch (error) {
    if (error instanceof UserPrivacyMemoryStoreError) {
      throw error;
    }
    return { empty: true };
  }
}

export async function exportMemory(userId: string): Promise<Record<string, unknown>> {
  return previewMemory(userId);
}

export async function deleteMemory(userId: string): Promise<{ success: boolean }> {
  try {
    await dbRun(`DELETE FROM ai_user_memory WHERE user_id = ?`, [userId]);
    logger.info(`[UserPrivacy] Memory deleted for user ${userId}`);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[UserPrivacy] Failed to delete memory: ${msg}`);
    throw new UserPrivacyMemoryDeleteError('Memory could not be deleted');
  }
}

export default {
  getUserPrivacySettings,
  updateUserPrivacySettings,
  canWriteMemory,
  canReadMemory,
  previewMemory,
  exportMemory,
  deleteMemory,
};
