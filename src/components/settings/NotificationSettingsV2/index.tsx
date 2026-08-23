/**
 * NotificationSettingsV2
 *
 * Comprehensive notification settings component with tabs for:
 * - Overview (summary of all settings)
 * - Channels (which channels are enabled)
 * - Categories (notification types matrix)
 * - Schedule (quiet hours, DND)
 * - Watching (watched objects)
 * - Digests (daily/weekly summary)
 *
 * Part of: User-Level Notifications & Integrations System
 */

import {
  AlertCircle,
  Bell,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Eye,
  Mail,
  Settings,
  Smartphone,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/composed';
import { ErrorState, LoadingState } from '@/components/ui/primitives';

import { useUserIntegrations } from '../../../hooks/useUserIntegrations';
import { useUserNotificationPreferences } from '../../../hooks/useUserNotificationPreferences';
import CategoriesTab from './CategoriesTab';
import ChannelsTab from './ChannelsTab';
import DigestsTab from './DigestsTab';
// Tab components
import OverviewTab from './OverviewTab';
import ScheduleTab from './ScheduleTab';
import WatchingTab from './WatchingTab';

interface NotificationSettingsV2Props {
  className?: string;
}

type TabId = 'overview' | 'channels' | 'categories' | 'schedule' | 'watching' | 'digests';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  description: string;
}

const TABS: Tab[] = [
  {
    id: 'overview',
    label: 'All',
    icon: Bell,
    description: 'Overview of notification settings',
  },
  {
    id: 'channels',
    label: 'Email',
    icon: Mail,
    description: 'Email notification preferences',
  },
  {
    id: 'categories',
    label: 'Push',
    icon: Smartphone,
    description: 'Push notification preferences',
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: Clock,
    description: 'Quiet hours and schedule',
  },
];

export const NotificationSettingsV2: React.FC<NotificationSettingsV2Props> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const {
    preferences,
    watchers,
    categories,
    loading,
    error,
    setGlobalEnabled,
    updateSchedule,
    toggleCategory,
    toggleChannel,
    toggleNotificationType,
    updateDueReminders,
    updateDigests,
    addWatcher,
    removeWatcher,
    isWatching,
    updatePreferences,
    refresh,
  } = useUserNotificationPreferences();

  const { integrations, providers, isConnected } = useUserIntegrations();

  // Handle save success/error messages
  const showSaveSuccess = () => {
    setSaveMessage({
      type: 'success',
      text: t('settings.notifications.saved', 'Preferences saved successfully'),
    });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const showSaveError = (msg?: string) => {
    setSaveMessage({
      type: 'error',
      text: msg || t('settings.notifications.saveError', 'Failed to save preferences'),
    });
    setTimeout(() => setSaveMessage(null), 5000);
  };

  // Render active tab content
  const renderTabContent = () => {
    if (loading) {
      return <LoadingState variant="spinner" />;
    }

    if (error) {
      return <ErrorState message={error} />;
    }

    if (!preferences) {
      return (
        <EmptyState
          preset="noData"
          title={t('settings.notifications.noPreferences', 'No preferences found')}
        />
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <OverviewTab
            preferences={preferences}
            integrations={integrations}
            onToggleGlobal={async (enabled) => {
              try {
                await setGlobalEnabled(enabled);
                showSaveSuccess();
              } catch {
                showSaveError();
              }
            }}
            onToggleChannel={async (category, channel, enabled) => {
              try {
                await toggleChannel(category as any, channel as any, enabled);
                showSaveSuccess();
              } catch {
                showSaveError();
              }
            }}
          />
        );
      case 'channels':
        return (
          <ChannelsTab
            preferences={preferences}
            integrations={integrations}
            providers={providers}
            onUpdatePreferences={async (updates) => {
              try {
                await updatePreferences(updates);
                showSaveSuccess();
              } catch {
                showSaveError();
              }
            }}
          />
        );
      case 'categories':
        return (
          <CategoriesTab
            preferences={preferences}
            categoryDefinitions={categories}
            integrations={integrations}
            onToggleCategory={async (category, enabled) => {
              try {
                await toggleCategory(category as any, enabled);
                showSaveSuccess();
              } catch {
                showSaveError();
              }
            }}
            onToggleChannel={async (category, channel, enabled) => {
              try {
                await toggleChannel(category as any, channel as any, enabled);
                showSaveSuccess();
              } catch {
                showSaveError();
              }
            }}
            onToggleType={async (category, type, enabled) => {
              try {
                await toggleNotificationType(category as any, type, enabled);
                showSaveSuccess();
              } catch {
                showSaveError();
              }
            }}
          />
        );
      case 'schedule':
        return (
          <ScheduleTab
            preferences={preferences}
            onUpdateSchedule={async (schedule) => {
              try {
                await updateSchedule(schedule);
                showSaveSuccess();
              } catch {
                showSaveError();
              }
            }}
          />
        );
      case 'watching':
        return (
          <WatchingTab
            watchers={watchers}
            onAddWatcher={async (type, id, notifyOn) => {
              try {
                await addWatcher(type, id, notifyOn);
                showSaveSuccess();
              } catch {
                showSaveError();
              }
            }}
            onRemoveWatcher={async (type, id) => {
              try {
                await removeWatcher(type, id);
                showSaveSuccess();
              } catch {
                showSaveError();
              }
            }}
          />
        );
      case 'digests':
        return (
          <DigestsTab
            preferences={preferences}
            onUpdateDigests={async (digests) => {
              try {
                await updateDigests(digests);
                showSaveSuccess();
              } catch {
                showSaveError();
              }
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="relative">
        <h2 className="text-2xl font-bold text-c-text">
          {t('settings.notifications.title', 'Notifications')}
        </h2>
        <p className="text-c-text-muted mt-1">
          {t(
            'settings.notifications.description',
            'Control how and when you receive notifications'
          )}
        </p>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div
          className={`p-3 rounded-lg flex items-center gap-2 ${
            saveMessage.type === 'success'
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-danger-50 text-danger-700 dark:bg-danger-900/20 dark:text-danger-400'
          }`}
        >
          {saveMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          {saveMessage.text}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-c-border-subtle dark:border-navy-700 pb-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-navy-900 text-white'
                  : 'text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-800'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">{renderTabContent()}</div>
    </div>
  );
};

export default NotificationSettingsV2;
