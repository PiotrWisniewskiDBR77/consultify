/**
 * useNotificationSnooze
 * Hook for managing notification snooze functionality
 * Offline-first with localStorage persistence and API sync
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'consultinity-snoozed-notifications';

export interface SnoozedNotification {
  notificationId: string;
  snoozedAt: string;
  snoozedUntil: string;
  reason?: string;
}

export type SnoozePreset = '1h' | '4h' | 'tomorrow' | 'next_week';

const getSnoozeUntilDate = (preset: SnoozePreset): Date => {
  const now = new Date();

  switch (preset) {
    case '1h':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case '4h':
      return new Date(now.getTime() + 4 * 60 * 60 * 1000);
    case 'tomorrow': {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // 9 AM next day
      return tomorrow;
    }
    case 'next_week': {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(9, 0, 0, 0); // 9 AM next week
      return nextWeek;
    }
    default:
      return new Date(now.getTime() + 60 * 60 * 1000);
  }
};

const getSnoozeHours = (preset: SnoozePreset): number => {
  switch (preset) {
    case '1h':
      return 1;
    case '4h':
      return 4;
    case 'tomorrow':
      return 24;
    case 'next_week':
      return 168;
    default:
      return 1;
  }
};

export const useNotificationSnooze = () => {
  const [snoozedNotifications, setSnoozedNotifications] = useState<SnoozedNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // Load snoozed notifications from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: SnoozedNotification[] = JSON.parse(stored);
        // Filter out expired snoozes
        const now = new Date();
        const active = parsed.filter((sn) => new Date(sn.snoozedUntil) > now);
        setSnoozedNotifications(active);
        // Update storage if we filtered out any
        if (active.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(active));
        }
      }
    } catch (error) {
      console.error('[useNotificationSnooze] Failed to load from localStorage', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Persist to localStorage whenever snoozedNotifications changes
  const persistToStorage = useCallback((notifications: SnoozedNotification[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('[useNotificationSnooze] Failed to persist to localStorage', error);
    }
  }, []);

  // Snooze a notification
  const snooze = useCallback(
    (notificationId: string, preset: SnoozePreset, reason?: string) => {
      const snoozedUntil = getSnoozeUntilDate(preset);
      const newSnooze: SnoozedNotification = {
        notificationId,
        snoozedAt: new Date().toISOString(),
        snoozedUntil: snoozedUntil.toISOString(),
        reason,
      };

      setSnoozedNotifications((prev) => {
        // Remove existing snooze for this notification if any
        const filtered = prev.filter((sn) => sn.notificationId !== notificationId);
        const updated = [...filtered, newSnooze];
        persistToStorage(updated);
        return updated;
      });

      // TODO: Sync with API when online
      // Api.snoozeNotification(notificationId, getSnoozeHours(preset));

      return snoozedUntil;
    },
    [persistToStorage]
  );

  // Snooze with custom hours
  const snoozeCustom = useCallback(
    (notificationId: string, hours: number, reason?: string) => {
      const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
      const newSnooze: SnoozedNotification = {
        notificationId,
        snoozedAt: new Date().toISOString(),
        snoozedUntil: snoozedUntil.toISOString(),
        reason,
      };

      setSnoozedNotifications((prev) => {
        const filtered = prev.filter((sn) => sn.notificationId !== notificationId);
        const updated = [...filtered, newSnooze];
        persistToStorage(updated);
        return updated;
      });

      return snoozedUntil;
    },
    [persistToStorage]
  );

  // Unsnooze a notification
  const unsnooze = useCallback(
    (notificationId: string) => {
      setSnoozedNotifications((prev) => {
        const updated = prev.filter((sn) => sn.notificationId !== notificationId);
        persistToStorage(updated);
        return updated;
      });

      // TODO: Sync with API when online
      // Api.unsnoozeNotification(notificationId);
    },
    [persistToStorage]
  );

  // Check if a notification is snoozed
  const isSnoozed = useCallback(
    (notificationId: string): boolean => {
      const snooze = snoozedNotifications.find((sn) => sn.notificationId === notificationId);
      if (!snooze) return false;
      return new Date(snooze.snoozedUntil) > new Date();
    },
    [snoozedNotifications]
  );

  // Get snooze end time for a notification
  const getSnoozedUntil = useCallback(
    (notificationId: string): Date | null => {
      const snooze = snoozedNotifications.find((sn) => sn.notificationId === notificationId);
      if (!snooze) return null;
      const until = new Date(snooze.snoozedUntil);
      return until > new Date() ? until : null;
    },
    [snoozedNotifications]
  );

  // Get snooze info for a notification
  const getSnoozeInfo = useCallback(
    (notificationId: string): SnoozedNotification | null => {
      const snooze = snoozedNotifications.find((sn) => sn.notificationId === notificationId);
      if (!snooze) return null;
      if (new Date(snooze.snoozedUntil) <= new Date()) return null;
      return snooze;
    },
    [snoozedNotifications]
  );

  // Get all currently snoozed notification IDs
  const getSnoozedIds = useCallback((): string[] => {
    const now = new Date();
    return snoozedNotifications
      .filter((sn) => new Date(sn.snoozedUntil) > now)
      .map((sn) => sn.notificationId);
  }, [snoozedNotifications]);

  // Clear all snoozes
  const clearAllSnoozes = useCallback(() => {
    setSnoozedNotifications([]);
    persistToStorage([]);
  }, [persistToStorage]);

  // Format remaining snooze time
  const formatRemainingTime = useCallback(
    (notificationId: string, isPolish: boolean): string | null => {
      const until = getSnoozedUntil(notificationId);
      if (!until) return null;

      const now = new Date();
      const diffMs = until.getTime() - now.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 60) {
        return isPolish ? `${diffMins} min` : `${diffMins}m`;
      }
      if (diffHours < 24) {
        return isPolish ? `${diffHours} godz.` : `${diffHours}h`;
      }
      return isPolish ? `${diffDays} dni` : `${diffDays}d`;
    },
    [getSnoozedUntil]
  );

  return {
    loading,
    snoozedNotifications,
    snooze,
    snoozeCustom,
    unsnooze,
    isSnoozed,
    getSnoozedUntil,
    getSnoozeInfo,
    getSnoozedIds,
    clearAllSnoozes,
    formatRemainingTime,
  };
};

export default useNotificationSnooze;
