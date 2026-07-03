/**
 * CategoriesTab - Push notification preferences
 * Configure desktop and mobile push notifications
 */

import { Bell, Smartphone } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { UserIntegration } from '../../../hooks/useUserIntegrations';
import type {
  NotificationCategory,
  NotificationPreferences,
} from '../../../hooks/useUserNotificationPreferences';

interface CategoriesTabProps {
  preferences: NotificationPreferences;
  categoryDefinitions: Record<string, NotificationCategory>;
  integrations: UserIntegration[];
  onToggleCategory: (category: string, enabled: boolean) => Promise<void>;
  onToggleChannel: (category: string, channel: string, enabled: boolean) => Promise<void>;
  onToggleType: (category: string, type: string, enabled: boolean) => Promise<void>;
}

const CategoriesTab: React.FC<CategoriesTabProps> = ({
  preferences,
  categoryDefinitions,
  integrations,
  onToggleCategory,
  onToggleChannel,
  onToggleType,
}) => {
  const { t } = useTranslation();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [desktopEnabled, setDesktopEnabled] = useState(
    preferences.categories.tasks?.channels?.push ?? true
  );

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushEnabled(true);
        toast.success(t('settings.notifications.pushEnabled', 'Push notifications enabled'));

        // Update all categories to enable push
        for (const category of Object.keys(preferences.categories)) {
          await onToggleChannel(category, 'push', true);
        }
      } else {
        toast.error(t('settings.notifications.pushDenied', 'Permission denied'));
      }
    }
  };

  const toggleDesktop = async () => {
    const newValue = !desktopEnabled;
    setDesktopEnabled(newValue);

    // Update all categories
    for (const category of Object.keys(preferences.categories)) {
      await onToggleChannel(category, 'push', newValue);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
          <Bell size={20} />
          {t('settings.notifications.pushTitle', 'Push Notifications')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('settings.notifications.pushDesc', 'Get notified about important updates.')}
        </p>
      </div>

      {/* Desktop notifications */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
        <div className="flex items-center gap-3">
          <Smartphone size={20} className="text-slate-600 dark:text-slate-500" />
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              {t('settings.notifications.desktop', 'Desktop Notifications')}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('settings.notifications.desktopDesc', 'Show notifications in your browser')}
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={desktopEnabled}
            onChange={toggleDesktop}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-[color:var(--c-focus)] rounded-full peer dark:bg-navy-700 peer-checked:after:translate-x-full peer-checked:bg-navy-900 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
        </label>
      </div>

      {!pushEnabled && 'Notification' in window && Notification.permission !== 'granted' && (
        <button
          onClick={requestPermission}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 rounded-lg hover:bg-navy-800 dark:hover:bg-[#DDE5EF] dark:hover:bg-[#DDE5EF] transition-colors"
        >
          <Bell size={16} />
          {t('settings.notifications.enablePush', 'Enable Push Notifications')}
        </button>
      )}
    </div>
  );
};

export default CategoriesTab;
