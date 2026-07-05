/**
 * DigestsTab - Configure digest email settings
 */

import { Calendar, Check, Clock } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  DigestSettings,
  NotificationPreferences,
} from '../../../hooks/useUserNotificationPreferences';

interface DigestsTabProps {
  preferences: NotificationPreferences;
  onUpdateDigests: (digests: Partial<DigestSettings>) => Promise<void>;
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const DigestsTab: React.FC<DigestsTabProps> = ({ preferences, onUpdateDigests }) => {
  const { t } = useTranslation();
  const [localDigests, setLocalDigests] = useState(preferences.digests);
  const prevDigestsRef = React.useRef(preferences.digests);

  useEffect(() => {
    // Only sync if preferences actually changed from parent
    if (prevDigestsRef.current !== preferences.digests) {
      prevDigestsRef.current = preferences.digests;
      queueMicrotask(() => setLocalDigests(preferences.digests));
    }
  }, [preferences.digests]);

  const handleToggle = async (field: keyof DigestSettings, value: boolean) => {
    setLocalDigests((prev) => ({ ...prev, [field]: value }));
    await onUpdateDigests({ [field]: value });
  };

  const handleChange = async (field: keyof DigestSettings, value: string) => {
    setLocalDigests((prev) => ({ ...prev, [field]: value }));
    await onUpdateDigests({ [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-c-text flex items-center gap-2">
          <Calendar size={20} />
          {t('settings.notifications.digestsTitle', 'Email Digests')}
        </h3>
        <p className="text-sm text-c-text-muted mt-1">
          {t(
            'settings.notifications.digestsDesc',
            'Receive summary emails instead of individual notifications.'
          )}
        </p>
      </div>

      {/* Daily Digest */}
      <div className="bg-c-surface-raised rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-c-text">
              {t('settings.notifications.dailyDigest', 'Daily Digest')}
            </p>
            <p className="text-sm text-c-text-muted">
              {t('settings.notifications.dailyDigestDesc', 'Get a daily summary of your activity')}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={localDigests.dailyEnabled}
              onChange={(e) => handleToggle('dailyEnabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-c-surface-raised peer-focus:ring-2 peer-focus:ring-[color:var(--c-focus)] rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-navy-900 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-c-surface after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>

        {localDigests.dailyEnabled && (
          <div className="flex items-center gap-3 pt-2 border-t border-c-border-subtle dark:border-navy-600">
            <Clock size={16} className="text-c-text-secondary" />
            <span className="text-sm text-c-text-secondary">
              {t('settings.notifications.deliveryTime', 'Delivery time:')}
            </span>
            <input
              type="time"
              value={localDigests.dailyTime}
              onChange={(e) => handleChange('dailyTime', e.target.value)}
              className="px-2 py-1 border border-c-border dark:border-navy-600 rounded bg-c-surface text-sm"
            />
          </div>
        )}
      </div>

      {/* Weekly Digest */}
      <div className="bg-c-surface-raised rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-c-text">
              {t('settings.notifications.weeklyDigest', 'Weekly Digest')}
            </p>
            <p className="text-sm text-c-text-muted">
              {t('settings.notifications.weeklyDigestDesc', 'Get a weekly summary every week')}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={localDigests.weeklyEnabled}
              onChange={(e) => handleToggle('weeklyEnabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-c-surface-raised peer-focus:ring-2 peer-focus:ring-[color:var(--c-focus)] rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-navy-900 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-c-surface after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>

        {localDigests.weeklyEnabled && (
          <div className="flex items-center gap-4 pt-2 border-t border-c-border-subtle dark:border-navy-600">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-c-text-secondary" />
              <select
                value={localDigests.weeklyDay}
                onChange={(e) => handleChange('weeklyDay', e.target.value)}
                className="px-2 py-1 border border-c-border dark:border-navy-600 rounded bg-c-surface text-sm"
              >
                {DAYS_OF_WEEK.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-c-text-secondary" />
              <input
                type="time"
                value={localDigests.weeklyTime}
                onChange={(e) => handleChange('weeklyTime', e.target.value)}
                className="px-2 py-1 border border-c-border dark:border-navy-600 rounded bg-c-surface text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Digest Content Options */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-c-text-secondary">
          {t('settings.notifications.digestContent', 'Include in digests:')}
        </h4>

        {[
          { key: 'includeOverdue', label: 'Overdue tasks', desc: 'Tasks past their due date' },
          {
            key: 'includeUpcoming',
            label: 'Upcoming deadlines',
            desc: 'Tasks due in the next 7 days',
          },
          {
            key: 'includeAIInsights',
            label: 'AI Insights',
            desc: 'Recommendations and risk alerts',
          },
        ].map(({ key, label, desc }) => (
          <div
            key={key}
            className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg"
          >
            <div>
              <p className="text-sm font-medium text-c-text">
                {t(`settings.notifications.${key}`, label)}
              </p>
              <p className="text-xs text-c-text-muted">
                {t(`settings.notifications.${key}Desc`, desc)}
              </p>
            </div>
            <button
              onClick={() =>
                handleToggle(
                  key as keyof DigestSettings,
                  !localDigests[key as keyof DigestSettings]
                )
              }
              className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                localDigests[key as keyof DigestSettings]
                  ? 'bg-navy-900 border-brand text-white'
                  : 'border-c-border dark:border-navy-600'
              }`}
            >
              {localDigests[key as keyof DigestSettings] && <Check size={14} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DigestsTab;
