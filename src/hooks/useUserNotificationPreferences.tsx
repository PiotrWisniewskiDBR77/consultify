/**
 * useUserNotificationPreferences Hook
 *
 * React hook for managing user notification preferences.
 * Handles categories, channels, schedule, digests, and watchers.
 *
 * Part of: User-Level Notifications & Integrations System
 */

import { useCallback, useEffect, useState } from 'react';

// Channel configuration
export interface ChannelSettings {
  in_app: boolean;
  email: boolean;
  push: boolean;
  slack?: boolean;
  teams?: boolean;
}

// Category configuration
export interface CategorySettings {
  enabled: boolean;
  channels: ChannelSettings;
  types: Record<string, boolean>;
  dueReminders?: {
    '1_week': boolean;
    '3_days': boolean;
    '1_day': boolean;
    '1_hour': boolean;
  };
}

// Schedule settings
export interface ScheduleSettings {
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "HH:MM"
  quietHoursEnd: string; // "HH:MM"
  quietDays: string[]; // ['saturday', 'sunday']
  timezone: string;
  respectUserStatus: boolean;
}

// Urgency settings
export interface UrgencySettings {
  criticalOverridesQuietHours: boolean;
  escalationDelayMinutes: number;
}

// Digest settings
export interface DigestSettings {
  dailyEnabled: boolean;
  dailyTime: string;
  weeklyEnabled: boolean;
  weeklyDay: string;
  weeklyTime: string;
  includeOverdue: boolean;
  includeUpcoming: boolean;
  includeAIInsights: boolean;
}

// Categories configuration
export interface CategoriesSettings {
  tasks: CategorySettings;
  governance: CategorySettings;
  collaboration: CategorySettings;
  ai: CategorySettings;
  system: CategorySettings;
}

// Full preferences
export interface NotificationPreferences {
  globalEnabled: boolean;
  schedule: ScheduleSettings;
  urgency: UrgencySettings;
  categories: CategoriesSettings;
  digests: DigestSettings;
}

// Watcher entry
export interface Watcher {
  id: string;
  objectType: 'task' | 'initiative' | 'project';
  objectId: string;
  notifyOn: 'all' | 'mentions' | 'status_changes';
  createdAt: string;
}

// Notification category definition
export interface NotificationCategory {
  label: string;
  types: string[];
}

interface UseUserNotificationPreferencesReturn {
  // Data
  preferences: NotificationPreferences | null;
  watchers: Watcher[];
  categories: Record<string, NotificationCategory>;
  loading: boolean;
  error: string | null;

  // Global
  setGlobalEnabled: (enabled: boolean) => Promise<void>;

  // Schedule
  updateSchedule: (schedule: Partial<ScheduleSettings>) => Promise<void>;
  isInQuietHours: () => Promise<boolean>;

  // Categories & Channels
  toggleCategory: (category: keyof CategoriesSettings, enabled: boolean) => Promise<void>;
  toggleChannel: (
    category: keyof CategoriesSettings,
    channel: keyof ChannelSettings,
    enabled: boolean
  ) => Promise<void>;
  toggleNotificationType: (
    category: keyof CategoriesSettings,
    type: string,
    enabled: boolean
  ) => Promise<void>;
  updateDueReminders: (reminders: CategorySettings['dueReminders']) => Promise<void>;

  // Digests
  updateDigests: (digests: Partial<DigestSettings>) => Promise<void>;

  // Watchers
  addWatcher: (objectType: string, objectId: string, notifyOn?: string) => Promise<void>;
  removeWatcher: (objectType: string, objectId: string) => Promise<void>;
  isWatching: (objectType: string, objectId: string) => boolean;
  refreshWatchers: () => Promise<void>;

  // Full update
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>;

  // Utilities
  refresh: () => Promise<void>;
}

export const useUserNotificationPreferences = (): UseUserNotificationPreferencesReturn => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [watchers, setWatchers] = useState<Watcher[]>([]);
  const [categories, setCategories] = useState<Record<string, NotificationCategory>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/settings/preferences/notifications', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch preferences');
      }

      const data = await response.json();
      setPreferences(data.preferences);
    } catch (err) {
      console.error('[useUserNotificationPreferences] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch categories definition
  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/notifications/categories', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || {});
      }
    } catch (err) {
      console.error('[useUserNotificationPreferences] Categories fetch error:', err);
    }
  }, []);

  // Fetch watchers
  const fetchWatchers = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/watchers', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setWatchers(data.watchers || []);
      }
    } catch (err) {
      console.error('[useUserNotificationPreferences] Watchers fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
    fetchCategories();
    fetchWatchers();
  }, [fetchPreferences, fetchCategories, fetchWatchers]);

  // Update preferences API call
  const updatePreferencesApi = useCallback(async (updates: Partial<NotificationPreferences>) => {
    const response = await fetch('/api/settings/preferences/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update preferences');
    }

    const data = await response.json();
    setPreferences(data.preferences);
    return data.preferences;
  }, []);

  // Set global enabled
  const setGlobalEnabled = useCallback(
    async (enabled: boolean) => {
      try {
        setError(null);
        await updatePreferencesApi({ globalEnabled: enabled });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update');
        throw err;
      }
    },
    [updatePreferencesApi]
  );

  // Update schedule
  const updateSchedule = useCallback(
    async (schedule: Partial<ScheduleSettings>) => {
      try {
        setError(null);

        const response = await fetch('/api/settings/notifications/schedule', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(schedule),
        });

        if (!response.ok) {
          throw new Error('Failed to update schedule');
        }

        await fetchPreferences();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update');
        throw err;
      }
    },
    [fetchPreferences]
  );

  // Check if in quiet hours
  const isInQuietHoursCheck = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/settings/notifications/quiet-hours/status', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        return data.isInQuietHours;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Toggle category
  const toggleCategory = useCallback(
    async (category: keyof CategoriesSettings, enabled: boolean) => {
      if (!preferences) return;

      try {
        setError(null);
        const updatedCategories = {
          ...preferences.categories,
          [category]: {
            ...preferences.categories[category],
            enabled,
          },
        };
        await updatePreferencesApi({ categories: updatedCategories });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update');
        throw err;
      }
    },
    [preferences, updatePreferencesApi]
  );

  // Toggle channel
  const toggleChannel = useCallback(
    async (
      category: keyof CategoriesSettings,
      channel: keyof ChannelSettings,
      enabled: boolean
    ) => {
      if (!preferences) return;

      try {
        setError(null);
        const updatedCategories = {
          ...preferences.categories,
          [category]: {
            ...preferences.categories[category],
            channels: {
              ...preferences.categories[category].channels,
              [channel]: enabled,
            },
          },
        };
        await updatePreferencesApi({ categories: updatedCategories });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update');
        throw err;
      }
    },
    [preferences, updatePreferencesApi]
  );

  // Toggle notification type
  const toggleNotificationType = useCallback(
    async (category: keyof CategoriesSettings, type: string, enabled: boolean) => {
      if (!preferences) return;

      try {
        setError(null);
        const updatedCategories = {
          ...preferences.categories,
          [category]: {
            ...preferences.categories[category],
            types: {
              ...preferences.categories[category].types,
              [type]: enabled,
            },
          },
        };
        await updatePreferencesApi({ categories: updatedCategories });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update');
        throw err;
      }
    },
    [preferences, updatePreferencesApi]
  );

  // Update due reminders
  const updateDueReminders = useCallback(
    async (reminders: CategorySettings['dueReminders']) => {
      if (!preferences) return;

      try {
        setError(null);
        const updatedCategories = {
          ...preferences.categories,
          tasks: {
            ...preferences.categories.tasks,
            dueReminders: reminders,
          },
        };
        await updatePreferencesApi({ categories: updatedCategories });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update');
        throw err;
      }
    },
    [preferences, updatePreferencesApi]
  );

  // Update digests
  const updateDigests = useCallback(
    async (digests: Partial<DigestSettings>) => {
      try {
        setError(null);

        const response = await fetch('/api/settings/notifications/digests', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(digests),
        });

        if (!response.ok) {
          throw new Error('Failed to update digests');
        }

        await fetchPreferences();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update');
        throw err;
      }
    },
    [fetchPreferences]
  );

  // Add watcher
  const addWatcher = useCallback(
    async (objectType: string, objectId: string, notifyOn: string = 'all') => {
      try {
        setError(null);

        const response = await fetch('/api/settings/watchers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ objectType, objectId, notifyOn }),
        });

        if (!response.ok) {
          throw new Error('Failed to add watcher');
        }

        await fetchWatchers();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add watcher');
        throw err;
      }
    },
    [fetchWatchers]
  );

  // Remove watcher
  const removeWatcher = useCallback(
    async (objectType: string, objectId: string) => {
      try {
        setError(null);

        const response = await fetch(`/api/settings/watchers/${objectType}/${objectId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to remove watcher');
        }

        await fetchWatchers();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove watcher');
        throw err;
      }
    },
    [fetchWatchers]
  );

  // Check if watching
  const isWatching = useCallback(
    (objectType: string, objectId: string): boolean => {
      return watchers.some((w) => w.objectType === objectType && w.objectId === objectId);
    },
    [watchers]
  );

  // Full update
  const updatePreferences = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      try {
        setError(null);
        await updatePreferencesApi(updates);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update');
        throw err;
      }
    },
    [updatePreferencesApi]
  );

  // Refresh all
  const refresh = useCallback(async () => {
    await Promise.all([fetchPreferences(), fetchWatchers()]);
  }, [fetchPreferences, fetchWatchers]);

  return {
    // Data
    preferences,
    watchers,
    categories,
    loading,
    error,

    // Global
    setGlobalEnabled,

    // Schedule
    updateSchedule,
    isInQuietHours: isInQuietHoursCheck,

    // Categories & Channels
    toggleCategory,
    toggleChannel,
    toggleNotificationType,
    updateDueReminders,

    // Digests
    updateDigests,

    // Watchers
    addWatcher,
    removeWatcher,
    isWatching,
    refreshWatchers: fetchWatchers,

    // Full update
    updatePreferences,

    // Utilities
    refresh,
  };
};

export default useUserNotificationPreferences;
