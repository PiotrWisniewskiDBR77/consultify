import { useCallback, useEffect, useState } from 'react';

import type {
  ChannelSettings,
  MyWorkNotificationPreferences,
  NotificationCategory,
} from '../types/myWork';

const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'task_assigned',
  'task_due_soon',
  'task_overdue',
  'decision_required',
  'mention',
  'comment',
  'status_change',
  'ai_insight',
  'phase_transition',
  'blocking_alert',
];

const buildDefaultCategories = (): Record<NotificationCategory, ChannelSettings> => {
  return NOTIFICATION_CATEGORIES.reduce((acc, category) => {
    acc[category] = { inapp: true, push: false, email: false };
    return acc;
  }, {} as Record<NotificationCategory, ChannelSettings>);
};

const defaultPreferences: MyWorkNotificationPreferences = {
  userId: 'current',
  categories: buildDefaultCategories(),
  quietHours: {
    enabled: false,
    start: '20:00',
    end: '08:00',
    timezone: 'UTC',
  },
  weekendSettings: {
    criticalOnly: false,
    digestOnly: false,
  },
  dailyDigest: {
    enabled: false,
    time: '09:00',
  },
  weeklyDigest: {
    enabled: false,
    day: 'monday',
    time: '09:00',
  },
};

export const useNotificationPreferences = () => {
  const [preferences, setPreferences] = useState<MyWorkNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPreferences(defaultPreferences);
    setLoading(false);
  }, []);

  const simulateSave = useCallback(() => {
    setSaving(true);
    setTimeout(() => setSaving(false), 400);
  }, []);

  const updateCategoryChannel = useCallback(
    (category: NotificationCategory, channel: keyof ChannelSettings, enabled: boolean) => {
      setPreferences((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          categories: {
            ...prev.categories,
            [category]: {
              ...prev.categories[category],
              [channel]: enabled,
            },
          },
        };
      });
      simulateSave();
    },
    [simulateSave]
  );

  const updateQuietHours = useCallback(
    (enabled: boolean, start?: string, end?: string) => {
      setPreferences((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          quietHours: {
            ...prev.quietHours,
            enabled,
            start: start ?? prev.quietHours.start,
            end: end ?? prev.quietHours.end,
          },
        };
      });
      simulateSave();
    },
    [simulateSave]
  );

  const updateDigestSettings = useCallback(
    (
      type: 'daily' | 'weekly',
      updates:
        | Partial<MyWorkNotificationPreferences['dailyDigest']>
        | Partial<MyWorkNotificationPreferences['weeklyDigest']>
    ) => {
      setPreferences((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          dailyDigest: type === 'daily' ? { ...prev.dailyDigest, ...updates } : prev.dailyDigest,
          weeklyDigest: type === 'weekly' ? { ...prev.weeklyDigest, ...updates } : prev.weeklyDigest,
        };
      });
      simulateSave();
    },
    [simulateSave]
  );

  return {
    preferences,
    loading,
    saving,
    updateCategoryChannel,
    updateQuietHours,
    updateDigestSettings,
  };
};

export default useNotificationPreferences;
