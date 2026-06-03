/**
 * NotificationScheduleSettings - Notification schedule/quiet hours
 */

import { Clock, Moon } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface NotificationScheduleSettingsProps {
  className?: string;
}

export const NotificationScheduleSettings: React.FC<NotificationScheduleSettingsProps> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [startTime, setStartTime] = useState('22:00');
  const [endTime, setEndTime] = useState('08:00');

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
          <Clock size={20} />
          {t('settings.notifications.scheduleTitle', 'Notification Schedule')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t(
            'settings.notifications.scheduleDesc',
            "Set quiet hours when you don't want to be disturbed."
          )}
        </p>
      </div>

      {/* Quiet Hours Toggle */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
        <div className="flex items-center gap-3">
          <Moon size={20} className="text-slate-600 dark:text-slate-500" />
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              {t('settings.notifications.quietHours', 'Quiet Hours')}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t(
                'settings.notifications.quietHoursDesc',
                'Pause notifications during specific hours'
              )}
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={quietHoursEnabled}
            onChange={(e) => setQuietHoursEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand rounded-full peer dark:bg-navy-700 peer-checked:after:translate-x-full peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
        </label>
      </div>

      {quietHoursEnabled && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('settings.notifications.startTime', 'Start Time')}
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('settings.notifications.endTime', 'End Time')}
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationScheduleSettings;
