/**
 * PushNotificationsSettings - Push notification preferences
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

interface PushNotificationsSettingsProps {
  className?: string;
}

export const PushNotificationsSettings: React.FC<PushNotificationsSettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [desktopEnabled, setDesktopEnabled] = useState(true);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushEnabled(true);
        toast.success(t('settings.notifications.pushEnabled', 'Push notifications enabled'));
      } else {
        toast.error(t('settings.notifications.pushDenied', 'Permission denied'));
      }
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
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
          <Smartphone size={20} className="text-slate-400" />
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
            onChange={(e) => setDesktopEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand rounded-full peer dark:bg-navy-700 peer-checked:after:translate-x-full peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
        </label>
      </div>

      {!pushEnabled && 'Notification' in window && Notification.permission !== 'granted' && (
        <button
          onClick={requestPermission}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors"
        >
          <Bell size={16} />
          {t('settings.notifications.enablePush', 'Enable Push Notifications')}
        </button>
      )}
    </div>
  );
};

export default PushNotificationsSettings;







