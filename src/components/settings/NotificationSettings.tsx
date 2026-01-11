/**
 * NotificationSettings - Notification preferences management
 *
 * Uses unified SettingsSection pattern for consistent UI
 *
 * @version 2.0
 */

import {
  AlertCircle,
  Bell,
  Check,
  CheckCircle,
  Database,
  Hash,
  Mail,
  MessageCircle,
  Slack,
  Trello,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils';
import { Api } from '../../services/api';
import { User } from '../../types';
import { SettingsDivider, SettingsSection, SettingsToggle } from './shared';

interface NotificationSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

// Map provider IDs to Icons
const PROVIDER_ICONS: Record<string, any> = {
  slack: Slack,
  teams: MessageCircle,
  whatsapp: MessageCircle,
  trello: Trello,
  jira: Database,
  clickup: CheckCircle,
};

interface Integration {
  id: string;
  provider: string;
  config: any;
  status: 'active' | 'error' | 'disabled';
}

interface ChannelPreferences {
  email: boolean;
  inApp: boolean;
  [key: string]: boolean;
}

interface NotificationPreferences {
  taskAssignment: ChannelPreferences;
  taskUpdates: ChannelPreferences;
  milestones: ChannelPreferences;
  mentions: ChannelPreferences;
}

const defaultPreferences: NotificationPreferences = {
  taskAssignment: { email: true, inApp: true },
  taskUpdates: { email: false, inApp: true },
  milestones: { email: true, inApp: true },
  mentions: { email: true, inApp: true },
};

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [originalPreferences, setOriginalPreferences] =
    useState<NotificationPreferences>(defaultPreferences);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isDirty = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);

  // Fetch existing preferences
  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const data = await Api.getNotificationPreferences(currentUser.id);
        if (data && Object.keys(data).length > 0) {
          setPreferences(data);
          setOriginalPreferences(data);
        }
      } catch (err) {
        console.error('Failed to fetch notification preferences', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, [currentUser.id]);

  // Fetch active integrations
  useEffect(() => {
    const fetchIntegrations = async () => {
      if (!currentUser.organizationId) return;
      try {
        const data: Integration[] = await Api.getIntegrations(currentUser.organizationId);
        setIntegrations(data.filter((i) => i.status === 'active' || !i.status));
      } catch (err) {
        console.error('Failed to fetch integrations', err);
      }
    };
    fetchIntegrations();
  }, [currentUser.organizationId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await Api.saveNotificationPreferences(currentUser.id, preferences);
      setOriginalPreferences(preferences);
      toast.success(t('settings.notifications.saved', 'Notification preferences saved'));
      onUpdateUser({
        ...currentUser,
        notification_preferences: JSON.stringify(preferences),
      } as any);
    } catch (err) {
      toast.error(t('settings.notifications.error', 'Failed to save preferences'));
    } finally {
      setSaving(false);
    }
  }, [currentUser, preferences, t, onUpdateUser]);

  const toggle = useCallback((category: keyof NotificationPreferences, channel: string) => {
    setPreferences((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [channel]: !prev[category][channel],
      },
    }));
  }, []);

  // Notification categories configuration
  const categories = [
    {
      key: 'taskAssignment' as const,
      title: t('settings.notifications.taskAssignment', 'Task Assignments'),
      description: t(
        'settings.notifications.taskAssignmentDesc',
        'When a new task is assigned to you'
      ),
      icon: CheckCircle,
    },
    {
      key: 'taskUpdates' as const,
      title: t('settings.notifications.taskUpdates', 'Task Updates'),
      description: t(
        'settings.notifications.taskUpdatesDesc',
        'When status changes or comments are added'
      ),
      icon: Bell,
    },
    {
      key: 'mentions' as const,
      title: t('settings.notifications.mentions', 'Mentions'),
      description: t(
        'settings.notifications.mentionsDesc',
        'When someone mentions you in a comment'
      ),
      icon: MessageCircle,
    },
    {
      key: 'milestones' as const,
      title: t('settings.notifications.milestones', 'Project Milestones'),
      description: t(
        'settings.notifications.milestonesDesc',
        'Major project updates and completions'
      ),
      icon: Database,
    },
  ];

  return (
    <SettingsSection
      icon={Bell}
      title={t('settings.notifications.title', 'Notification Preferences')}
      description={t(
        'settings.notifications.description',
        'Manage how and when you receive notifications across all channels'
      )}
      cardId="settings-notifications"
      isDirty={isDirty}
      onSave={handleSave}
      saving={saving}
      loading={loading}
    >
      <div className="space-y-6">
        {/* Channel Headers */}
        <div className="grid grid-cols-12 gap-4 pb-4 border-b border-white/10">
          <div className="col-span-5 text-sm font-medium text-slate-400 dark:text-slate-500">
            {t('settings.notifications.activity', 'Activity')}
          </div>
          <div
            className="col-span-7 grid gap-4"
            style={{ gridTemplateColumns: `repeat(${2 + integrations.length}, 1fr)` }}
          >
            <ChannelHeader icon={Bell} label={t('settings.notifications.inApp', 'In-App')} />
            <ChannelHeader icon={Mail} label={t('settings.notifications.email', 'Email')} />
            {integrations.map((int) => {
              const Icon = PROVIDER_ICONS[int.provider] || Hash;
              return (
                <ChannelHeader
                  key={int.id}
                  icon={Icon}
                  label={int.provider.charAt(0).toUpperCase() + int.provider.slice(1)}
                />
              );
            })}
          </div>
        </div>

        {/* Category Rows */}
        <div className="space-y-1">
          {categories.map((category, index) => (
            <NotificationRow
              key={category.key}
              icon={category.icon}
              title={category.title}
              description={category.description}
              preferences={preferences[category.key]}
              integrations={integrations}
              onToggle={(channel) => toggle(category.key, channel)}
              isLast={index === categories.length - 1}
            />
          ))}
        </div>

        <SettingsDivider />

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              const all: NotificationPreferences = {
                taskAssignment: { email: true, inApp: true },
                taskUpdates: { email: true, inApp: true },
                milestones: { email: true, inApp: true },
                mentions: { email: true, inApp: true },
              };
              integrations.forEach((int) => {
                Object.keys(all).forEach((key) => {
                  (all[key as keyof NotificationPreferences] as any)[int.provider] = true;
                });
              });
              setPreferences(all);
            }}
            className="px-3 py-1.5 text-sm text-emerald-400 hover:text-emerald-300 
                                 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors"
          >
            <Check size={14} className="inline mr-1.5" />
            {t('settings.notifications.enableAll', 'Enable All')}
          </button>
          <button
            onClick={() => {
              const minimal: NotificationPreferences = {
                taskAssignment: { email: false, inApp: true },
                taskUpdates: { email: false, inApp: false },
                milestones: { email: false, inApp: true },
                mentions: { email: true, inApp: true },
              };
              setPreferences(minimal);
            }}
            className="px-3 py-1.5 text-sm text-amber-400 hover:text-amber-300 
                                 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors"
          >
            <AlertCircle size={14} className="inline mr-1.5" />
            {t('settings.notifications.minimal', 'Minimal')}
          </button>
        </div>

        {/* Info Box */}
        {integrations.length > 0 && (
          <div className="p-4 bg-violet-600/5 border border-violet-500/20 rounded-lg">
            <p className="text-sm text-slate-400 dark:text-slate-500">
              <Bell size={14} className="inline mr-2 text-violet-400" />
              {t(
                'settings.notifications.integrationNote',
                `You have ${integrations.length} connected integration(s). Notifications can be sent to these channels as well.`
              )}
            </p>
          </div>
        )}
      </div>
    </SettingsSection>
  );
};

// Channel Header Component
const ChannelHeader: React.FC<{ icon: React.ElementType; label: string }> = ({
  icon: Icon,
  label,
}) => (
  <div className="text-center">
    <div className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500">
      <Icon size={16} />
      <span className="text-xs font-medium">{label}</span>
    </div>
  </div>
);

// Notification Row Component
interface NotificationRowProps {
  icon: React.ElementType;
  title: string;
  description: string;
  preferences: ChannelPreferences;
  integrations: Integration[];
  onToggle: (channel: string) => void;
  isLast: boolean;
}

const NotificationRow: React.FC<NotificationRowProps> = ({
  icon: Icon,
  title,
  description,
  preferences,
  integrations,
  onToggle,
  isLast,
}) => (
  <div
    className={cn(
      'grid grid-cols-12 gap-4 items-center py-4',
      !isLast && 'border-b border-white/5'
    )}
  >
    <div className="col-span-5 flex items-start gap-3">
      <div className="p-2 bg-navy-700/50 rounded-lg flex-shrink-0">
        <Icon size={16} className="text-slate-400 dark:text-slate-500" />
      </div>
      <div>
        <h4 className="text-sm font-medium text-white">{title}</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
      </div>
    </div>
    <div
      className="col-span-7 grid gap-4"
      style={{ gridTemplateColumns: `repeat(${2 + integrations.length}, 1fr)` }}
    >
      <div className="flex justify-center">
        <NotificationToggle
          checked={preferences.inApp ?? false}
          onChange={() => onToggle('inApp')}
        />
      </div>
      <div className="flex justify-center">
        <NotificationToggle
          checked={preferences.email ?? false}
          onChange={() => onToggle('email')}
        />
      </div>
      {integrations.map((int) => (
        <div key={int.id} className="flex justify-center">
          <NotificationToggle
            checked={preferences[int.provider] ?? false}
            onChange={() => onToggle(int.provider)}
          />
        </div>
      ))}
    </div>
  </div>
);

// Toggle Component
const NotificationToggle: React.FC<{ checked: boolean; onChange: () => void }> = ({
  checked,
  onChange,
}) => (
  <button
    onClick={onChange}
    role="switch"
    aria-checked={checked}
    className={cn(
      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200',
      'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-navy-900',
      checked ? 'bg-violet-600' : 'bg-white/10'
    )}
  >
    <span
      className={cn(
        'inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition-transform duration-200',
        checked ? 'translate-x-6' : 'translate-x-1'
      )}
    />
  </button>
);

export default NotificationSettings;
