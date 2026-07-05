/**
 * ScheduleTab - Notification schedule and quiet hours
 */

import { Clock, Moon } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  NotificationPreferences,
  ScheduleSettings,
} from '../../../hooks/useUserNotificationPreferences';

interface ScheduleTabProps {
  preferences: NotificationPreferences;
  onUpdateSchedule: (schedule: Partial<ScheduleSettings>) => Promise<void>;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

const ScheduleTab: React.FC<ScheduleTabProps> = ({ preferences, onUpdateSchedule }) => {
  const { t } = useTranslation();
  const [localSchedule, setLocalSchedule] = useState(preferences.schedule);
  const prevScheduleRef = React.useRef(preferences.schedule);

  useEffect(() => {
    // Only sync if preferences actually changed from parent
    if (prevScheduleRef.current !== preferences.schedule) {
      prevScheduleRef.current = preferences.schedule;
      queueMicrotask(() => setLocalSchedule(preferences.schedule));
    }
  }, [preferences.schedule]);

  const handleQuietHoursToggle = async () => {
    const newValue = !localSchedule.quietHoursEnabled;
    setLocalSchedule((prev) => ({ ...prev, quietHoursEnabled: newValue }));
    await onUpdateSchedule({ quietHoursEnabled: newValue });
  };

  const handleTimeChange = async (field: 'quietHoursStart' | 'quietHoursEnd', value: string) => {
    setLocalSchedule((prev) => ({ ...prev, [field]: value }));
    await onUpdateSchedule({ [field]: value });
  };

  const handleDayToggle = async (day: string) => {
    const currentDays = localSchedule.quietDays || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day];

    setLocalSchedule((prev) => ({ ...prev, quietDays: newDays }));
    await onUpdateSchedule({ quietDays: newDays });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-c-text flex items-center gap-2">
          <Clock size={20} />
          {t('settings.notifications.scheduleTitle', 'Notification Schedule')}
        </h3>
        <p className="text-sm text-c-text-muted mt-1">
          {t(
            'settings.notifications.scheduleDesc',
            "Set quiet hours when you don't want to be disturbed."
          )}
        </p>
      </div>

      {/* Quiet Hours Toggle */}
      <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
        <div className="flex items-center gap-3">
          <Moon size={20} className="text-c-text-secondary" />
          <div>
            <p className="font-medium text-c-text">
              {t('settings.notifications.quietHours', 'Quiet Hours')}
            </p>
            <p className="text-sm text-c-text-muted">
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
            checked={localSchedule.quietHoursEnabled}
            onChange={handleQuietHoursToggle}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-c-surface-raised peer-focus:ring-2 peer-focus:ring-[color:var(--c-focus)] rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-navy-900 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-c-surface after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
        </label>
      </div>

      {localSchedule.quietHoursEnabled && (
        <>
          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-2">
                {t('settings.notifications.startTime', 'Start Time')}
              </label>
              <input
                type="time"
                value={localSchedule.quietHoursStart}
                onChange={(e) => handleTimeChange('quietHoursStart', e.target.value)}
                className="w-full px-3 py-2 border border-c-border dark:border-navy-600 rounded-lg bg-c-surface text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-2">
                {t('settings.notifications.endTime', 'End Time')}
              </label>
              <input
                type="time"
                value={localSchedule.quietHoursEnd}
                onChange={(e) => handleTimeChange('quietHoursEnd', e.target.value)}
                className="w-full px-3 py-2 border border-c-border dark:border-navy-600 rounded-lg bg-c-surface text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent"
              />
            </div>
          </div>

          {/* Quiet Days */}
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-3">
              {t('settings.notifications.quietDays', 'Quiet Days')}
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map(({ key, label }) => {
                const isSelected = localSchedule.quietDays?.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => handleDayToggle(key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-navy-900 text-white'
                        : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-600'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Critical Override */}
          <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                {t('settings.notifications.criticalOverride', 'Critical Notifications Override')}
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {t(
                  'settings.notifications.criticalOverrideDesc',
                  'Critical notifications will still be delivered during quiet hours'
                )}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.urgency?.criticalOverridesQuietHours ?? true}
                onChange={async (e) => {
                  // This would need an update urgency function
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-amber-200 peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer dark:bg-amber-800 peer-checked:after:translate-x-full peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-c-surface after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>
        </>
      )}
    </div>
  );
};

export default ScheduleTab;
