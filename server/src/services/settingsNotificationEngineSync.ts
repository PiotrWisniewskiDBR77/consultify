/**
 * Bridges the Settings → Notifications screens to the table the delivery
 * engine actually reads (`notification_preferences`).
 *
 * Context: DEC-2026-08-25-21 (N1), grounded in notyfikacje-audyt.md.
 * The audit found that `notificationService.send()` gates delivery on
 * `notification_preferences` (§2.2b), while all four mounted Settings →
 * Notifications screens persist to `user_preferences` — a table nothing
 * reads at send time. Result: every toggle was placebo.
 *
 * Fix shape chosen (option (a) in the DEC): the screens keep writing
 * their full, UI-shaped state to `user_preferences` — that stays the
 * source of truth for what's *displayed*, including fields the engine
 * has no column for (integration channels, quiet-hours exceptions,
 * auto-reply, DND "until"). This module additionally derives the subset
 * of that state which the engine *can* enforce and merges it into
 * `notification_preferences` on every read and write, so the last save
 * a user made is always what gets enforced at send time.
 *
 * Only categories with an unambiguous, audit-verified match to a real
 * `notification_types` registry entry (server/migrations/257_notification_system.sql)
 * are wired here:
 *   - "Task Assignments" (NotificationSettings.tsx)      → task_assigned
 *   - "Task Updates" (both screens, merged)               → task_completed,
 *                                                            task_comment,
 *                                                            task_overdue,
 *                                                            task_due_soon
 *   - "Project Alerts" (EmailDigestSettings.tsx)          → project_member_added,
 *                                                            project_archived
 *   - Quiet Hours enabled/start/end (AvailabilitySettings) → quiet_hours_* columns
 *
 * Categories with no registry match — "Project Milestones", "Mentions",
 * "Weekly Digest" (superseded by the digest atrapa, hidden per N3),
 * "Marketing" — are deliberately left unwired rather than guessed at.
 * See notyfikacje-audyt.md §1E / §2.1 for the full gap list; closing it
 * requires the "Event Preferences" screen tracked as M3, not this pass.
 *
 * All sync calls are best-effort: a failure here must never break the
 * user-facing settings save (the primary `user_preferences` write already
 * succeeded), but IS logged at `error` level because a silent failure
 * here reproduces exactly the "awaria bez sygnału" the audit warns about.
 */
import { getPreferences, updatePreferences } from './notificationService.js';
import logger from '../utils/Logger.js';

export type ChannelToggle = { email?: boolean; inApp?: boolean };

export const TASK_ASSIGNMENT_TYPES = ['task_assigned'];
export const TASK_UPDATE_TYPES = ['task_completed', 'task_comment', 'task_overdue', 'task_due_soon'];
export const PROJECT_ALERT_TYPES = ['project_member_added', 'project_archived'];

function channelsFromToggle(toggle: ChannelToggle): string[] {
  const channels: string[] = [];
  if (toggle.inApp) channels.push('in_app');
  if (toggle.email) channels.push('email');
  return channels;
}

/**
 * NotificationSettings.tsx ("Channels & Categories") save/load path.
 * Has both an in-app and an email axis per category, so it is the
 * authoritative writer for BOTH channels on the types it maps to.
 */
export async function syncChannelCategoryPreferences(
  userId: string,
  categories: { taskAssignment?: ChannelToggle; taskUpdates?: ChannelToggle }
): Promise<void> {
  try {
    const current = await getPreferences(userId);
    const typeSettings = { ...(current?.typeSettings || {}) };

    const applyGroup = (types: string[], toggle?: ChannelToggle) => {
      if (!toggle) return;
      const channels = channelsFromToggle(toggle);
      for (const type of types) {
        typeSettings[type] = { enabled: channels.length > 0, channels };
      }
    };

    applyGroup(TASK_ASSIGNMENT_TYPES, categories.taskAssignment);
    applyGroup(TASK_UPDATE_TYPES, categories.taskUpdates);

    await updatePreferences(userId, { typeSettings });
  } catch (error) {
    logger.error('[settingsNotificationEngineSync] syncChannelCategoryPreferences failed', {
      error,
      userId,
    });
  }
}

/**
 * EmailDigestSettings.tsx ("Email & Digest") save/load path. Only has an
 * email axis per category — must preserve whatever in-app channel state
 * the Channels & Categories screen already established for the same
 * types instead of clobbering it.
 */
export async function syncEmailOnlyCategoryPreferences(
  userId: string,
  categories: { taskUpdates?: boolean; projectAlerts?: boolean }
): Promise<void> {
  try {
    const current = await getPreferences(userId);
    const typeSettings = { ...(current?.typeSettings || {}) };

    const applyGroup = (types: string[], emailOn?: boolean) => {
      if (emailOn === undefined) return;
      for (const type of types) {
        const existing = typeSettings[type];
        const nonEmailChannels = (existing?.channels || ['in_app']).filter((c) => c !== 'email');
        const channels = emailOn ? [...nonEmailChannels, 'email'] : nonEmailChannels;
        typeSettings[type] = { enabled: channels.length > 0, channels };
      }
    };

    applyGroup(TASK_UPDATE_TYPES, categories.taskUpdates);
    applyGroup(PROJECT_ALERT_TYPES, categories.projectAlerts);

    await updatePreferences(userId, { typeSettings });
  } catch (error) {
    logger.error('[settingsNotificationEngineSync] syncEmailOnlyCategoryPreferences failed', {
      error,
      userId,
    });
  }
}

/**
 * AvailabilitySettings.tsx ("Scheduled Quiet Hours") save/load path —
 * direct 1:1 mapping onto real engine columns. The screen's extra
 * fields (days of week, exceptions, auto-reply, DND "until") have no
 * engine column and are intentionally not synced here — the engine's
 * own quiet-hours check only ever reads start/end
 * (notificationService.ts:1518-1531).
 */
export async function syncQuietHoursPreferences(
  userId: string,
  quietHours: { enabled?: boolean; startTime?: string; endTime?: string }
): Promise<void> {
  try {
    const updates: Record<string, unknown> = {};
    if (quietHours.enabled !== undefined) updates.quietHoursEnabled = quietHours.enabled;
    if (quietHours.startTime) updates.quietHoursStart = quietHours.startTime;
    if (quietHours.endTime) updates.quietHoursEnd = quietHours.endTime;
    if (Object.keys(updates).length === 0) return;
    await updatePreferences(userId, updates);
  } catch (error) {
    logger.error('[settingsNotificationEngineSync] syncQuietHoursPreferences failed', {
      error,
      userId,
    });
  }
}
