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
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import { SettingsDivider, SettingsSection } from './shared';

interface NotificationSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

// Map provider IDs to Icons
const PROVIDER_ICONS: Record<string, React.ElementType> = {
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
  config: unknown;
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

type NotificationPreferencesUpdate = Partial<User> & {
  notification_preferences?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeChannelPreferences = (
  defaults: ChannelPreferences,
  input: unknown
): ChannelPreferences => {
  const next: ChannelPreferences = { ...defaults };
  if (!isRecord(input)) return next;

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'boolean') {
      next[key] = value;
    }
  }

  return next;
};

const normalizeNotificationPreferences = (input: unknown): NotificationPreferences => {
  const source = isRecord(input) ? input : {};
  return {
    taskAssignment: normalizeChannelPreferences(
      defaultPreferences.taskAssignment,
      source.taskAssignment
    ),
    taskUpdates: normalizeChannelPreferences(defaultPreferences.taskUpdates, source.taskUpdates),
    milestones: normalizeChannelPreferences(defaultPreferences.milestones, source.milestones),
    mentions: normalizeChannelPreferences(defaultPreferences.mentions, source.mentions),
  };
};

const channelPreferencesMatch = (actual: ChannelPreferences, expected: ChannelPreferences) => {
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  return Array.from(keys).every((key) => Boolean(actual[key]) === Boolean(expected[key]));
};

const preferencesMatch = (actual: NotificationPreferences, expected: NotificationPreferences) =>
  channelPreferencesMatch(actual.taskAssignment, expected.taskAssignment) &&
  channelPreferencesMatch(actual.taskUpdates, expected.taskUpdates) &&
  channelPreferencesMatch(actual.milestones, expected.milestones) &&
  channelPreferencesMatch(actual.mentions, expected.mentions);

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isDirty = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);

  // Fetch existing preferences
  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        setLoadError(null);
        const data = await Api.getNotificationPreferences(currentUser.id);
        const loaded = normalizeNotificationPreferences(data);
        setPreferences(loaded);
        setOriginalPreferences(loaded);
      } catch (err: unknown) {
        setLoadError(normalizeApiErrorMessage(err, 'Failed to load notification preferences'));
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
        const response = await Api.getIntegrations(currentUser.organizationId);
        const data: Integration[] = Array.isArray(response)
          ? response
          : response.integrations || [];
        setIntegrations(data.filter((i) => i.status === 'active' || !i.status));
      } catch {
        setIntegrations([]);
      }
    };
    fetchIntegrations();
  }, [currentUser.organizationId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await Api.saveNotificationPreferences(currentUser.id, preferences);
      const persisted = await Api.getNotificationPreferences(currentUser.id);
      const next = normalizeNotificationPreferences(persisted);
      if (!preferencesMatch(next, preferences)) {
        throw new Error('Notification preferences were not confirmed by the server');
      }
      setPreferences(next);
      setOriginalPreferences(next);
      toast.success(t('settings.notifications.saved', 'Notification preferences saved'));
      onUpdateUser({
        ...currentUser,
        notification_preferences: JSON.stringify(next),
      } as NotificationPreferencesUpdate);
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(
        err,
        t('settings.notifications.error', 'Failed to save preferences')
      );
      setSaveError(message);
      toast.error(message);
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
      onSave={loadError ? undefined : handleSave}
      saving={saving}
      loading={loading}
    >
      <div className="space-y-6">
        {loadError && (
          <DegradedState title="Notification preferences unavailable" description={loadError} />
        )}

        {saveError && (
          <div
            role="alert"
            className="p-4 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400"
          >
            {saveError}
          </div>
        )}

        {!loadError && (
          <>
            {/* Channel Headers */}
            <div className="grid grid-cols-12 gap-4 pb-4 border-b border-c-border-subtle">
              <div className="col-span-5 text-sm font-medium text-c-text-secondary">
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
                      label={t(
                        `settings.notifications.provider.${int.provider}`,
                        int.provider.charAt(0).toUpperCase() + int.provider.slice(1)
                      )}
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
                      all[key as keyof NotificationPreferences][int.provider] = true;
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
              <div className="p-4 bg-c-accent-soft border border-c-accent rounded-lg">
                <p className="text-sm text-c-text-secondary">
                  <Bell size={14} className="inline mr-2 text-c-accent" />
                  {t(
                    'settings.notifications.integrationNote',
                    `You have ${integrations.length} connected integration(s). Notifications can be sent to these channels as well.`
                  )}
                </p>
              </div>
            )}
          </>
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
    <div className="flex flex-col items-center gap-1 text-c-text-secondary">
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
      !isLast && 'border-b border-c-border-subtle'
    )}
  >
    <div className="col-span-5 flex items-start gap-3">
      <div className="p-2 bg-c-surface-raised rounded-lg flex-shrink-0">
        <Icon size={16} className="text-c-text-secondary" />
      </div>
      <div>
        <h4 className="text-sm font-medium text-c-text">{title}</h4>
        <p className="text-xs text-c-text-muted mt-0.5">{description}</p>
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
      'focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)] focus:ring-offset-2 focus:ring-offset-c-surface',
      checked ? 'bg-c-focus-solid' : 'bg-c-border'
    )}
  >
    <span
      className={cn(
        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
        checked ? 'translate-x-6' : 'translate-x-1'
      )}
    />
  </button>
);

export default NotificationSettings;
