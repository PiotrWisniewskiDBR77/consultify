/**
 * OverviewTab - Notification preferences overview
 * Shows summary and quick toggles for main notification settings
 */

import { Bell, Mail, Settings, Smartphone } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { UserIntegration } from '../../../hooks/useUserIntegrations';
import type { NotificationPreferences } from '../../../hooks/useUserNotificationPreferences';

interface OverviewTabProps {
  preferences: NotificationPreferences;
  integrations: UserIntegration[];
  onToggleGlobal: (enabled: boolean) => Promise<void>;
  onToggleChannel: (category: string, channel: string, enabled: boolean) => Promise<void>;
}

// Toggle component
const Toggle: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean }> = ({
  checked,
  onChange,
  disabled,
}) => (
  <button
    onClick={onChange}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
      checked ? 'bg-navy-900' : 'bg-slate-200 dark:bg-navy-700'
    }`}
  >
    <span
      className={`${checked ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition-transform`}
    />
  </button>
);

const OverviewTab: React.FC<OverviewTabProps> = ({
  preferences,
  integrations,
  onToggleGlobal,
  onToggleChannel,
}) => {
  const { t } = useTranslation();

  // Count active channels
  const activeChannels = Object.values(preferences.categories).reduce((acc, cat) => {
    Object.entries(cat.channels).forEach(([channel, enabled]) => {
      if (enabled && !acc.includes(channel)) {
        acc.push(channel);
      }
    });
    return acc;
  }, [] as string[]);

  // Notification type rows
  const notificationRows = [
    {
      key: 'taskAssignment',
      title: t('settings.notifications.taskAssignments', 'Task Assignments'),
      description: t(
        'settings.notifications.taskAssignmentsDesc',
        'When a new task is assigned to you'
      ),
      category: 'tasks',
    },
    {
      key: 'taskUpdates',
      title: t('settings.notifications.taskUpdates', 'Task Updates'),
      description: t(
        'settings.notifications.taskUpdatesDesc',
        'When status changes or comments are added'
      ),
      category: 'tasks',
    },
    {
      key: 'mentions',
      title: t('settings.notifications.mentions', 'Mentions'),
      description: t(
        'settings.notifications.mentionsDesc',
        'When someone mentions you in a comment'
      ),
      category: 'collaboration',
    },
    {
      key: 'milestones',
      title: t('settings.notifications.milestones', 'Project Milestones'),
      description: t(
        'settings.notifications.milestonesDesc',
        'Major project updates and completions'
      ),
      category: 'tasks',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Notification Preferences Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings size={20} />
            {t('settings.notifications.preferencesTitle', 'Notification Preferences')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'settings.notifications.preferencesDesc',
              'Manage how and when you receive notifications across all channels.'
            )}
          </p>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-200 dark:border-navy-700 text-sm font-medium text-slate-500 dark:text-slate-400">
          <div className="col-span-4">{t('settings.notifications.activity', 'Activity')}</div>
          <div className="col-span-8 grid grid-cols-2 gap-4">
            <div className="text-center flex flex-col items-center gap-1">
              <Bell size={16} />
              <span>{t('settings.notifications.inApp', 'In-App')}</span>
            </div>
            <div className="text-center flex flex-col items-center gap-1">
              <Mail size={16} />
              <span>{t('settings.notifications.email', 'Email')}</span>
            </div>
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-200 dark:divide-white/5">
          {notificationRows.map((row) => {
            const categoryPrefs =
              preferences.categories[row.category as keyof typeof preferences.categories];

            return (
              <div
                key={row.key}
                className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50 dark:hover:bg-navy-700/50 transition-colors"
              >
                <div className="col-span-4">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {row.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{row.description}</p>
                </div>
                <div className="col-span-8 grid grid-cols-2 gap-4">
                  <div className="flex justify-center">
                    <Toggle
                      checked={categoryPrefs?.channels?.in_app ?? true}
                      onChange={() =>
                        onToggleChannel(row.category, 'in_app', !categoryPrefs?.channels?.in_app)
                      }
                    />
                  </div>
                  <div className="flex justify-center">
                    <Toggle
                      checked={categoryPrefs?.channels?.email ?? false}
                      onChange={() =>
                        onToggleChannel(row.category, 'email', !categoryPrefs?.channels?.email)
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-navy-900/50 border-t border-slate-200 dark:border-navy-700 flex justify-end">
          <button className="px-4 py-2 bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] dark:hover:bg-[#DDE5EF] text-white dark:text-navy-950 rounded-lg text-sm font-medium transition-colors">
            {t('settings.notifications.savePreferences', 'Save Preferences')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
