/**
 * NotificationSettings - User notification preferences
 * Part of My Work Module PMO Upgrade
 *
 * Features:
 * - Email notification settings
 * - In-app notification settings
 * - Quiet hours configuration
 * - Per-category toggles
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MessageSquare,
  Moon,
  Save,
  Shield,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';

interface NotificationPreferences {
  // Email settings
  emailDailyDigest: boolean;
  emailTaskAssigned: boolean;
  emailDecisions: boolean;
  emailMentions: boolean;
  emailDeadlines: boolean;
  emailWeeklyReport: boolean;

  // In-app settings
  inAppOverdue: boolean;
  inAppAISuggestions: boolean;
  inAppGateReviews: boolean;
  inAppTeamUpdates: boolean;
  inAppComments: boolean;

  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursWeekends: boolean;
}

const defaultSettings: NotificationPreferences = {
  emailDailyDigest: true,
  emailTaskAssigned: true,
  emailDecisions: true,
  emailMentions: true,
  emailDeadlines: true,
  emailWeeklyReport: false,
  inAppOverdue: true,
  inAppAISuggestions: true,
  inAppGateReviews: true,
  inAppTeamUpdates: true,
  inAppComments: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  quietHoursWeekends: true,
};

/**
 * Toggle Component
 */
const SettingToggle: React.FC<{
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon?: React.ReactNode;
}> = ({ label, description, value, onChange, icon }) => {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-200 dark:border-navy-700 last:border-0">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="p-1.5 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-500 dark:text-slate-400 shrink-0">
            {icon}
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-navy-900 dark:text-white">{label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          value ? 'bg-navy-900' : 'bg-slate-200 dark:bg-white/10'
        }`}
      >
        <motion.div
          animate={{ x: value ? 20 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-1 w-4 h-4 bg-white dark:bg-navy-900 rounded-full shadow-sm"
        />
      </button>
    </div>
  );
};

/**
 * Section Component
 */
const SettingsSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  description?: string;
}> = ({ title, icon, children, description }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden"
    >
      <div className="p-4 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary-500 to-crimson-600 text-white rounded-lg shadow-sm">
            {icon}
          </div>
          <div>
            <h4 className="font-semibold text-navy-900 dark:text-white">{title}</h4>
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </motion.div>
  );
};

/**
 * Time Select Component
 */
const TimeSelect: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => {
  const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  return (
    <div className="flex-1">
      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-navy-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        {hours.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>
    </div>
  );
};

/**
 * NotificationSettings Component - Main Export
 */
export const NotificationSettings: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationPreferences>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await Api.get('/notification-settings');
      if (response) {
        setSettings({ ...defaultSettings, ...response });
      }
    } catch (error) {
      console.error('Failed to fetch notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await Api.put('/notification-settings', settings);
      toast.success(t('notifications.saved', 'Settings saved successfully'));
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error(t('notifications.saveError', 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" className="p-8" />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Save Button (Sticky) */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-10 flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/30 rounded-lg"
        >
          <span className="text-sm text-primary-700 dark:text-primary-300">
            {t('notifications.unsavedChanges', 'You have unsaved changes')}
          </span>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {t('notifications.save', 'Save Changes')}
          </button>
        </motion.div>
      )}

      {/* Email Notifications */}
      <SettingsSection
        title={t('notifications.email.title', 'Email Notifications')}
        icon={<Mail size={18} />}
        description={t('notifications.email.description', 'Configure which emails you receive')}
      >
        <SettingToggle
          icon={<Calendar size={14} />}
          label={t('notifications.email.dailyDigest', 'Daily Digest')}
          description={t(
            'notifications.email.dailyDigestDesc',
            'Summary of your tasks and updates every morning'
          )}
          value={settings.emailDailyDigest}
          onChange={(v) => updateSetting('emailDailyDigest', v)}
        />
        <SettingToggle
          icon={<Target size={14} />}
          label={t('notifications.email.taskAssigned', 'Task Assignments')}
          description={t(
            'notifications.email.taskAssignedDesc',
            'When someone assigns a task to you'
          )}
          value={settings.emailTaskAssigned}
          onChange={(v) => updateSetting('emailTaskAssigned', v)}
        />
        <SettingToggle
          icon={<Shield size={14} />}
          label={t('notifications.email.decisions', 'Decision Requests')}
          description={t(
            'notifications.email.decisionsDesc',
            'When a decision needs your approval'
          )}
          value={settings.emailDecisions}
          onChange={(v) => updateSetting('emailDecisions', v)}
        />
        <SettingToggle
          icon={<MessageSquare size={14} />}
          label={t('notifications.email.mentions', 'Mentions')}
          description={t(
            'notifications.email.mentionsDesc',
            'When someone mentions you in comments'
          )}
          value={settings.emailMentions}
          onChange={(v) => updateSetting('emailMentions', v)}
        />
        <SettingToggle
          icon={<AlertTriangle size={14} />}
          label={t('notifications.email.deadlines', 'Deadline Reminders')}
          description={t(
            'notifications.email.deadlinesDesc',
            'Reminders for upcoming task deadlines'
          )}
          value={settings.emailDeadlines}
          onChange={(v) => updateSetting('emailDeadlines', v)}
        />
        <SettingToggle
          icon={<Calendar size={14} />}
          label={t('notifications.email.weeklyReport', 'Weekly Report')}
          description={t(
            'notifications.email.weeklyReportDesc',
            'Weekly progress summary every Monday'
          )}
          value={settings.emailWeeklyReport}
          onChange={(v) => updateSetting('emailWeeklyReport', v)}
        />
      </SettingsSection>

      {/* In-App Notifications */}
      <SettingsSection
        title={t('notifications.inApp.title', 'In-App Notifications')}
        icon={<Bell size={18} />}
        description={t('notifications.inApp.description', 'Notifications that appear in the app')}
      >
        <SettingToggle
          icon={<AlertTriangle size={14} />}
          label={t('notifications.inApp.overdue', 'Overdue Task Alerts')}
          description={t('notifications.inApp.overdueDesc', 'Alert when tasks are past due')}
          value={settings.inAppOverdue}
          onChange={(v) => updateSetting('inAppOverdue', v)}
        />
        <SettingToggle
          icon={<Sparkles size={14} />}
          label={t('notifications.inApp.aiSuggestions', 'AI Suggestions')}
          description={t(
            'notifications.inApp.aiSuggestionsDesc',
            'Recommendations from AI assistant'
          )}
          value={settings.inAppAISuggestions}
          onChange={(v) => updateSetting('inAppAISuggestions', v)}
        />
        <SettingToggle
          icon={<CheckCircle2 size={14} />}
          label={t('notifications.inApp.gateReviews', 'Gate Reviews')}
          description={t('notifications.inApp.gateReviewsDesc', 'Phase transition notifications')}
          value={settings.inAppGateReviews}
          onChange={(v) => updateSetting('inAppGateReviews', v)}
        />
        <SettingToggle
          icon={<Users size={14} />}
          label={t('notifications.inApp.teamUpdates', 'Team Updates')}
          description={t('notifications.inApp.teamUpdatesDesc', 'Updates from your team members')}
          value={settings.inAppTeamUpdates}
          onChange={(v) => updateSetting('inAppTeamUpdates', v)}
        />
        <SettingToggle
          icon={<MessageSquare size={14} />}
          label={t('notifications.inApp.comments', 'Comments')}
          description={t('notifications.inApp.commentsDesc', 'New comments on your tasks')}
          value={settings.inAppComments}
          onChange={(v) => updateSetting('inAppComments', v)}
        />
      </SettingsSection>

      {/* Quiet Hours */}
      <SettingsSection
        title={t('notifications.quietHours.title', 'Quiet Hours')}
        icon={<Moon size={18} />}
        description={t(
          'notifications.quietHours.description',
          'Pause notifications during specific times'
        )}
      >
        <SettingToggle
          icon={<Clock size={14} />}
          label={t('notifications.quietHours.enable', 'Enable Quiet Hours')}
          description={t(
            'notifications.quietHours.enableDesc',
            'Pause notifications during specific times'
          )}
          value={settings.quietHoursEnabled}
          onChange={(v) => updateSetting('quietHoursEnabled', v)}
        />

        {settings.quietHoursEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-4 space-y-4"
          >
            <div className="flex gap-4">
              <TimeSelect
                label={t('notifications.quietHours.from', 'From')}
                value={settings.quietHoursStart}
                onChange={(v) => updateSetting('quietHoursStart', v)}
              />
              <TimeSelect
                label={t('notifications.quietHours.to', 'To')}
                value={settings.quietHoursEnd}
                onChange={(v) => updateSetting('quietHoursEnd', v)}
              />
            </div>

            <SettingToggle
              icon={<Calendar size={14} />}
              label={t('notifications.quietHours.weekends', 'Include Weekends')}
              description={t(
                'notifications.quietHours.weekendsDesc',
                'Also apply quiet hours on weekends'
              )}
              value={settings.quietHoursWeekends}
              onChange={(v) => updateSetting('quietHoursWeekends', v)}
            />

            <div className="p-3 bg-slate-50 dark:bg-navy-800 rounded-lg text-xs text-slate-500 dark:text-slate-400">
              <p>
                {t(
                  'notifications.quietHours.info',
                  'During quiet hours, you will not receive any push notifications. You can still see them in your notification center.'
                )}
              </p>
            </div>
          </motion.div>
        )}
      </SettingsSection>

      {/* Save Button (Bottom) */}
      <div className="flex justify-end pt-4">
        <button
          onClick={saveSettings}
          disabled={saving || !hasChanges}
          className="flex items-center gap-2 px-6 py-2.5 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {t('notifications.saveSettings', 'Save Settings')}
        </button>
      </div>
    </div>
  );
};

export default NotificationSettings;
