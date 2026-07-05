/**
 * NotificationsModule - Notification Preferences
 *
 * Tabs: Email | Push | In-App | Schedule
 */

import { Bell, Clock, Filter, Mail, Smartphone } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { NotificationRulesBuilder } from '../../components/settings/NotificationRulesBuilder';
import { NotificationSettings } from '../../components/settings/NotificationSettings';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { User } from '../../types';

interface NotificationsModuleProps {
  initialTab?: string;
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

// Schedule Settings Component
const ScheduleSettings: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const { t } = useTranslation();
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [startTime, setStartTime] = useState('22:00');
  const [endTime, setEndTime] = useState('08:00');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-c-text mb-4">
          {t('settings.schedule.title', 'Notification Schedule')}
        </h3>
        <p className="text-sm text-c-text-muted mb-6">
          {t(
            'settings.schedule.description',
            "Set quiet hours when you don't want to be disturbed"
          )}
        </p>
      </div>

      {/* Quiet Hours Toggle */}
      <div className="p-4 bg-c-surface rounded-lg border border-c-border-subtle dark:border-navy-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-c-text">
              {t('settings.schedule.quietHours', 'Quiet Hours')}
            </p>
            <p className="text-sm text-c-text-muted">
              {t(
                'settings.schedule.quietHoursDesc',
                'Pause non-urgent notifications during set hours'
              )}
            </p>
          </div>
          <button
            onClick={() => setQuietHoursEnabled(!quietHoursEnabled)}
            className={`w-12 h-6 rounded-full transition-colors ${
              quietHoursEnabled ? 'bg-c-accent' : 'bg-c-surface-raised'
            }`}
          >
            <div
              className={`w-5 h-5 bg-c-surface rounded-full transform transition-transform ${
                quietHoursEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Time Range */}
      {quietHoursEnabled && (
        <div className="p-4 bg-c-surface-raised rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">
                {t('settings.schedule.startTime', 'Start Time')}
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-c-border-subtle dark:border-navy-700 bg-c-surface text-c-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">
                {t('settings.schedule.endTime', 'End Time')}
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-c-border-subtle dark:border-navy-700 bg-c-surface text-c-text"
              />
            </div>
          </div>
        </div>
      )}

      {/* Weekend Settings */}
      <div className="p-4 bg-c-surface rounded-lg border border-c-border-subtle dark:border-navy-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-c-text">
              {t('settings.schedule.weekends', 'Weekend Notifications')}
            </p>
            <p className="text-sm text-c-text-muted">
              {t('settings.schedule.weekendsDesc', 'Receive notifications on weekends')}
            </p>
          </div>
          <button className={`w-12 h-6 rounded-full transition-colors bg-c-accent`}>
            <div
              className={`w-5 h-5 bg-c-surface rounded-full transform transition-transform translate-x-6`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export const NotificationsModule: React.FC<NotificationsModuleProps> = ({
  initialTab,
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(initialTab || 'all');

  const tabs: Tab[] = [
    {
      id: 'all',
      label: t('settings.tabs.allNotifications', 'All'),
      icon: <Bell size={16} />,
    },
    {
      id: 'email',
      label: t('settings.tabs.email', 'Email'),
      icon: <Mail size={16} />,
    },
    {
      id: 'push',
      label: t('settings.tabs.push', 'Push'),
      icon: <Smartphone size={16} />,
    },
    {
      id: 'rules',
      label: t('settings.tabs.rules', 'Rules'),
      icon: <Filter size={16} />,
    },
    {
      id: 'schedule',
      label: t('settings.tabs.schedule', 'Schedule'),
      icon: <Clock size={16} />,
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'all':
      case 'email':
      case 'push':
        return <NotificationSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
      case 'rules':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <NotificationRulesBuilder currentUser={currentUser} />
          </div>
        );
      case 'schedule':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <ScheduleSettings currentUser={currentUser} />
          </div>
        );
      default:
        return <NotificationSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
    }
  };

  return (
    <TabLayout
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title={t('settings.modules.notifications', 'Notifications')}
      subtitle={t(
        'settings.modules.notificationsDesc',
        'Manage how and when you receive notifications'
      )}
    >
      {renderContent()}
    </TabLayout>
  );
};

export default NotificationsModule;
