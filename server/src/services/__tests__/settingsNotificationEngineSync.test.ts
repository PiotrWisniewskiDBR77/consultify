/** @vitest-environment node */

/**
 * DEC-2026-08-25-21 (N1): unit coverage for the Settings → engine mirror.
 *
 * The audit (notyfikacje-audyt.md §2.2b) found that the four Settings →
 * Notifications screens wrote to `user_preferences`, a table nothing
 * reads at send time — the engine (`notificationService.send`) only
 * checks `notification_preferences`. These tests pin down the merge
 * logic that closes that gap: it must derive the right
 * `notification_preferences.type_settings` / quiet-hours values from
 * each screen's save, without clobbering what the other screen already
 * set for the same underlying notification type.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetPreferences, mockUpdatePreferences } = vi.hoisted(() => ({
  mockGetPreferences: vi.fn(),
  mockUpdatePreferences: vi.fn(),
}));

vi.mock('../notificationService.js', () => ({
  getPreferences: (...args: unknown[]) => mockGetPreferences(...args),
  updatePreferences: (...args: unknown[]) => mockUpdatePreferences(...args),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  syncChannelCategoryPreferences,
  syncEmailOnlyCategoryPreferences,
  syncQuietHoursPreferences,
} from '../settingsNotificationEngineSync.js';

describe('settingsNotificationEngineSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPreferences.mockResolvedValue({ typeSettings: {} });
    mockUpdatePreferences.mockResolvedValue(undefined);
  });

  describe('syncChannelCategoryPreferences (NotificationSettings.tsx)', () => {
    it('maps taskAssignment to task_assigned with both channels', async () => {
      await syncChannelCategoryPreferences('user-1', {
        taskAssignment: { email: true, inApp: true },
      });

      expect(mockUpdatePreferences).toHaveBeenCalledWith('user-1', {
        typeSettings: { task_assigned: { enabled: true, channels: ['in_app', 'email'] } },
      });
    });

    it('maps taskUpdates to the full task-update type group', async () => {
      await syncChannelCategoryPreferences('user-1', {
        taskUpdates: { email: false, inApp: true },
      });

      const call = mockUpdatePreferences.mock.calls[0][1];
      expect(call.typeSettings).toEqual({
        task_completed: { enabled: true, channels: ['in_app'] },
        task_comment: { enabled: true, channels: ['in_app'] },
        task_overdue: { enabled: true, channels: ['in_app'] },
        task_due_soon: { enabled: true, channels: ['in_app'] },
      });
    });

    it('disables the type when both channels are off', async () => {
      await syncChannelCategoryPreferences('user-1', {
        taskAssignment: { email: false, inApp: false },
      });

      expect(mockUpdatePreferences).toHaveBeenCalledWith('user-1', {
        typeSettings: { task_assigned: { enabled: false, channels: [] } },
      });
    });

    it('preserves unrelated existing type_settings entries', async () => {
      mockGetPreferences.mockResolvedValue({
        typeSettings: { decision_needed: { enabled: true, channels: ['in_app', 'email'] } },
      });

      await syncChannelCategoryPreferences('user-1', {
        taskAssignment: { email: true, inApp: true },
      });

      const call = mockUpdatePreferences.mock.calls[0][1];
      expect(call.typeSettings.decision_needed).toEqual({
        enabled: true,
        channels: ['in_app', 'email'],
      });
      expect(call.typeSettings.task_assigned).toEqual({
        enabled: true,
        channels: ['in_app', 'email'],
      });
    });

    it('does nothing for categories not passed', async () => {
      await syncChannelCategoryPreferences('user-1', {});
      expect(mockUpdatePreferences).toHaveBeenCalledWith('user-1', { typeSettings: {} });
    });

    it('never throws when the engine read/write fails', async () => {
      mockGetPreferences.mockRejectedValue(new Error('db down'));
      await expect(
        syncChannelCategoryPreferences('user-1', { taskAssignment: { email: true, inApp: true } })
      ).resolves.toBeUndefined();
    });
  });

  describe('syncEmailOnlyCategoryPreferences (EmailDigestSettings.tsx)', () => {
    it('adds the email channel to task-update types on top of an existing in_app-only entry', async () => {
      mockGetPreferences.mockResolvedValue({
        typeSettings: { task_completed: { enabled: true, channels: ['in_app'] } },
      });

      await syncEmailOnlyCategoryPreferences('user-1', { taskUpdates: true });

      const call = mockUpdatePreferences.mock.calls[0][1];
      expect(call.typeSettings.task_completed).toEqual({
        enabled: true,
        channels: ['in_app', 'email'],
      });
      // Untouched sibling type in the same group still gets email added,
      // defaulting to in_app since no prior entry existed for it.
      expect(call.typeSettings.task_comment).toEqual({
        enabled: true,
        channels: ['in_app', 'email'],
      });
    });

    it('removes only the email channel when turned off, keeping in_app set by the other screen', async () => {
      mockGetPreferences.mockResolvedValue({
        typeSettings: { task_completed: { enabled: true, channels: ['in_app', 'email'] } },
      });

      await syncEmailOnlyCategoryPreferences('user-1', { taskUpdates: false });

      const call = mockUpdatePreferences.mock.calls[0][1];
      expect(call.typeSettings.task_completed).toEqual({ enabled: true, channels: ['in_app'] });
    });

    it('maps projectAlerts to the project type group', async () => {
      await syncEmailOnlyCategoryPreferences('user-1', { projectAlerts: true });

      const call = mockUpdatePreferences.mock.calls[0][1];
      expect(call.typeSettings).toEqual({
        project_member_added: { enabled: true, channels: ['in_app', 'email'] },
        project_archived: { enabled: true, channels: ['in_app', 'email'] },
      });
    });

    it('disables the type entirely if in_app was already off and email is turned off', async () => {
      mockGetPreferences.mockResolvedValue({
        typeSettings: { task_completed: { enabled: true, channels: ['email'] } },
      });

      await syncEmailOnlyCategoryPreferences('user-1', { taskUpdates: false });

      const call = mockUpdatePreferences.mock.calls[0][1];
      expect(call.typeSettings.task_completed).toEqual({ enabled: false, channels: [] });
    });
  });

  describe('syncQuietHoursPreferences (AvailabilitySettings.tsx)', () => {
    it('maps enabled/startTime/endTime onto the matching engine columns', async () => {
      await syncQuietHoursPreferences('user-1', {
        enabled: true,
        startTime: '22:00',
        endTime: '08:00',
      });

      expect(mockUpdatePreferences).toHaveBeenCalledWith('user-1', {
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      });
    });

    it('only sends the fields that were actually provided', async () => {
      await syncQuietHoursPreferences('user-1', { enabled: false });

      expect(mockUpdatePreferences).toHaveBeenCalledWith('user-1', { quietHoursEnabled: false });
    });

    it('is a no-op when nothing is provided', async () => {
      await syncQuietHoursPreferences('user-1', {});
      expect(mockUpdatePreferences).not.toHaveBeenCalled();
    });

    it('never throws when the engine write fails', async () => {
      mockUpdatePreferences.mockRejectedValue(new Error('db down'));
      await expect(
        syncQuietHoursPreferences('user-1', { enabled: true })
      ).resolves.toBeUndefined();
    });
  });
});
