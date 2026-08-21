/**
 * WorkPreferencesSettings Component
 *
 * User preferences for work-related settings:
 * - Default project view (Kanban/List/Timeline)
 * - Task sort order
 * - Week start day
 * - Completed tasks visibility
 * - Auto-archive settings
 * - Time tracking preferences
 * - Default task priority
 * - Default reminder settings
 * - Snooze preferences
 */

import {
  AlarmClock,
  Archive,
  ArrowUpDown,
  Bell,
  Calendar,
  CheckSquare,
  Clock,
  Flag,
  GanttChart,
  LayoutGrid,
  List,
  Loader2,
  Save,
  Target,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { User } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import { InfoButton } from '../shared/InfoButton';
import { SettingsHeaderActionPortal } from './SettingsHeaderActions';

interface WorkPreferencesSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface WorkPreferences {
  // View & Display
  defaultProjectView: 'kanban' | 'list' | 'timeline' | 'calendar';
  defaultTaskSort: 'priority' | 'dueDate' | 'created' | 'alphabetical';
  weekStartDay: 'monday' | 'sunday';
  showCompletedTasks: boolean;
  showSubtasks: boolean;

  // Automation
  autoArchiveDays: number;
  taskDefaultDueDays: number;
  defaultTimeTracking: 'none' | 'manual' | 'automatic';

  // Task Defaults (NEW)
  defaultTaskPriority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  defaultReminderBefore: 'none' | '15min' | '30min' | '1hour' | '3hours' | '1day' | '3days';

  // Snooze Settings (NEW)
  defaultSnoozeDuration: '15min' | '30min' | '1hour' | '3hours' | 'tomorrow' | 'nextWeek';
  autoSnoozeOverdue: boolean;

  // Focus Mode (NEW)
  enableFocusMode: boolean;
  focusModeBlocksNotifications: boolean;
  defaultFocusDuration: number; // minutes
}

interface WorkPreferencesResponse {
  preferences?: WorkPreferences;
}

const DEFAULT_PREFERENCES: WorkPreferences = {
  defaultProjectView: 'kanban',
  defaultTaskSort: 'priority',
  weekStartDay: 'monday',
  showCompletedTasks: false,
  showSubtasks: true,
  autoArchiveDays: 30,
  taskDefaultDueDays: 7,
  defaultTimeTracking: 'none',
  defaultTaskPriority: 'medium',
  defaultReminderBefore: '1day',
  defaultSnoozeDuration: '1hour',
  autoSnoozeOverdue: false,
  enableFocusMode: true,
  focusModeBlocksNotifications: true,
  defaultFocusDuration: 25,
};

const preferencesMatch = (left: WorkPreferences, right: WorkPreferences) =>
  JSON.stringify(left) === JSON.stringify(right);

// Priority options with colors
const PRIORITY_OPTIONS = [
  { value: 'none', label: 'No Priority', color: 'slate' },
  { value: 'low', label: 'Low', color: 'blue' },
  { value: 'medium', label: 'Medium', color: 'yellow' },
  { value: 'high', label: 'High', color: 'orange' },
  { value: 'urgent', label: 'Urgent', color: 'red' },
];

// Reminder options
const REMINDER_OPTIONS = [
  { value: 'none', label: 'No reminder' },
  { value: '15min', label: '15 minutes before' },
  { value: '30min', label: '30 minutes before' },
  { value: '1hour', label: '1 hour before' },
  { value: '3hours', label: '3 hours before' },
  { value: '1day', label: '1 day before' },
  { value: '3days', label: '3 days before' },
];

// Snooze options
const SNOOZE_OPTIONS = [
  { value: '15min', label: '15 minutes' },
  { value: '30min', label: '30 minutes' },
  { value: '1hour', label: '1 hour' },
  { value: '3hours', label: '3 hours' },
  { value: 'tomorrow', label: 'Tomorrow morning' },
  { value: 'nextWeek', label: 'Next week' },
];

// Focus duration options
const FOCUS_DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 25, label: '25 minutes (Pomodoro)' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '90 minutes' },
];

export const WorkPreferencesSettings: React.FC<WorkPreferencesSettingsProps> = ({
  currentUser,
}) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<WorkPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences();
  }, [currentUser.id]);

  const loadPreferences = async () => {
    try {
      setLoadError(null);
      const data = (await Api.get('/settings/preferences/work')) as WorkPreferencesResponse;
      if (!data?.preferences) {
        throw new Error('Work preferences were not returned by the server');
      }
      setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
    } catch (error: unknown) {
      setLoadError(normalizeApiErrorMessage(error, 'Failed to load work preferences'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Api.put('/settings/preferences/work', { preferences });
      const data = (await Api.get('/settings/preferences/work')) as WorkPreferencesResponse;
      if (!data?.preferences) {
        throw new Error('Work preferences save was not confirmed by the server');
      }
      const persisted = { ...DEFAULT_PREFERENCES, ...data.preferences };
      if (!preferencesMatch(persisted, preferences)) {
        throw new Error('Work preferences were not confirmed by the server');
      }
      setPreferences(persisted);
      toast.success(t('settings.work.saved', 'Work preferences saved successfully'));
    } catch (error: unknown) {
      toast.error(
        normalizeApiErrorMessage(error, t('settings.work.error', 'Failed to save preferences'))
      );
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = <K extends keyof WorkPreferences>(key: K, value: WorkPreferences[K]) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
        <InfoButton cardId="settings-work" position="top-right" />
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Target size={28} className="text-c-accent" />
            {t('settings.work.title', 'Work Preferences')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t(
              'settings.work.description',
              'Customize how you view and manage your tasks and projects'
            )}
          </p>
        </div>
        <DegradedState title="Work preferences unavailable" description={loadError} />
      </div>
    );
  }

  const viewOptions = [
    {
      value: 'kanban',
      label: t('settings.work.views.kanban', 'Kanban Board'),
      icon: LayoutGrid,
      description: t('settings.work.views.kanbanDesc', 'Drag and drop cards'),
    },
    {
      value: 'list',
      label: t('settings.work.views.list', 'List View'),
      icon: List,
      description: t('settings.work.views.listDesc', 'Traditional table format'),
    },
    {
      value: 'timeline',
      label: t('settings.work.views.timeline', 'Timeline'),
      icon: GanttChart,
      description: t('settings.work.views.timelineDesc', 'Gantt-style view'),
    },
    {
      value: 'calendar',
      label: t('settings.work.views.calendar', 'Calendar'),
      icon: Calendar,
      description: t('settings.work.views.calendarDesc', 'Calendar layout'),
    },
  ];

  const sortOptions = [
    { value: 'priority', label: t('settings.work.sort.priority', 'Priority') },
    { value: 'dueDate', label: t('settings.work.sort.dueDate', 'Due Date') },
    { value: 'created', label: t('settings.work.sort.created', 'Created Date') },
    { value: 'alphabetical', label: t('settings.work.sort.alphabetical', 'Alphabetical') },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'bg-blue-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'high':
        return 'bg-amber-500';
      case 'urgent':
        return 'bg-danger-500';
      default:
        return 'bg-c-text-muted';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <InfoButton cardId="settings-work" position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Target size={28} className="text-c-accent" />
            {t('settings.work.title', 'Work Preferences')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t(
              'settings.work.description',
              'Customize how you view and manage your tasks and projects'
            )}
          </p>
        </div>
        <SettingsHeaderActionPortal>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="type-control flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-white transition-colors hover:bg-navy-800 disabled:opacity-50 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? t('settings.saving', 'Saving...') : t('settings.save', 'Save Changes')}
          </button>
        </SettingsHeaderActionPortal>
      </div>

      {/* Honest disclosure: these preferences are persisted to your account but
          are not yet applied automatically across project/task/calendar views. */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
        <Bell size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-800 dark:text-amber-200">
          {t(
            'settings.work.notAppliedNote',
            'These preferences are saved to your account. They are not yet applied automatically across all task, project and calendar views — that rollout is in progress.'
          )}
        </p>
      </div>

      {/* Default Project View */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <LayoutGrid size={20} className="text-c-accent" />
          {t('settings.work.defaultView', 'Default Project View')}
        </h3>
        <p className="text-sm text-c-text-muted mb-4">
          {t(
            'settings.work.defaultViewDescription',
            'Choose how projects are displayed by default when you open them'
          )}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {viewOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = preferences.defaultProjectView === option.value;
            return (
              <button
                key={option.value}
                onClick={() =>
                  updatePreference(
                    'defaultProjectView',
                    option.value as WorkPreferences['defaultProjectView']
                  )
                }
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? 'border-[var(--c-info)] bg-c-surface-raised'
                    : 'border-c-border-subtle dark:border-navy-700 hover:border-c-info/50 dark:hover:border-c-info/30'
                }`}
              >
                <Icon
                  size={24}
                  className={isSelected ? 'text-[var(--c-info)]' : 'text-c-text-secondary'}
                />
                <div
                  className={`mt-2 font-medium ${isSelected ? 'text-[var(--c-info)]' : 'text-c-text-secondary'}`}
                >
                  {option.label}
                </div>
                <div className="text-xs text-c-text-muted mt-1">{option.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task Defaults - NEW SECTION */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Flag size={20} className="text-amber-500" />
          {t('settings.work.taskDefaults', 'Task Defaults')}
        </h3>
        <p className="text-sm text-c-text-muted mb-4">
          {t('settings.work.taskDefaultsDescription', 'Set default values for new tasks')}
        </p>

        <div className="space-y-6">
          {/* Default Priority */}
          <div>
            <label className="block font-medium text-c-text-secondary mb-3">
              {t('settings.work.defaultPriority', 'Default Task Priority')}
            </label>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((option) => {
                const isSelected = preferences.defaultTaskPriority === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() =>
                      updatePreference(
                        'defaultTaskPriority',
                        option.value as WorkPreferences['defaultTaskPriority']
                      )
                    }
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-[var(--c-info)] bg-c-surface-raised'
                        : 'border-c-border-subtle dark:border-navy-700 hover:border-c-info/50'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full ${getPriorityColor(option.value)}`} />
                    <span
                      className={`text-sm font-medium ${isSelected ? 'text-[var(--c-info)]' : 'text-c-text-secondary'}`}
                    >
                      {t(`settings.work.priority.${option.value}`, option.label)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Default Reminder */}
          <div className="pt-4 border-t border-c-border-subtle dark:border-navy-700">
            <div className="flex items-center justify-between">
              <div>
                <label className="block font-medium text-c-text-secondary flex items-center gap-2">
                  <Bell size={16} className="text-blue-500" />
                  {t('settings.work.defaultReminder', 'Default Reminder')}
                </label>
                <p className="text-sm text-c-text-muted">
                  {t(
                    'settings.work.defaultReminderDescription',
                    'When to remind you before task due date'
                  )}
                </p>
              </div>
              <select
                value={preferences.defaultReminderBefore}
                onChange={(e) =>
                  updatePreference(
                    'defaultReminderBefore',
                    e.target.value as WorkPreferences['defaultReminderBefore']
                  )
                }
                className="px-4 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text"
              >
                {REMINDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(`settings.work.reminder.${option.value}`, option.label)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Snooze & Focus Settings - NEW SECTION */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <AlarmClock size={20} className="text-indigo-500" />
          {t('settings.work.snoozeAndFocus', 'Snooze & Focus')}
        </h3>

        <div className="space-y-6">
          {/* Default Snooze Duration */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.work.defaultSnooze', 'Default Snooze Duration')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.work.defaultSnoozeDescription',
                  'How long to snooze notifications by default'
                )}
              </p>
            </div>
            <select
              value={preferences.defaultSnoozeDuration}
              onChange={(e) =>
                updatePreference(
                  'defaultSnoozeDuration',
                  e.target.value as WorkPreferences['defaultSnoozeDuration']
                )
              }
              className="px-4 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text"
            >
              {SNOOZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`settings.work.snooze.${option.value}`, option.label)}
                </option>
              ))}
            </select>
          </div>

          {/* Auto-Snooze Overdue */}
          <div className="flex items-center justify-between pt-4 border-t border-c-border-subtle dark:border-navy-700">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.work.autoSnoozeOverdue', 'Auto-Snooze Overdue Tasks')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.work.autoSnoozeOverdueDescription',
                  'Automatically snooze notifications for overdue tasks'
                )}
              </p>
            </div>
            <button
              onClick={() => updatePreference('autoSnoozeOverdue', !preferences.autoSnoozeOverdue)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.autoSnoozeOverdue ? 'bg-indigo-600' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`${preferences.autoSnoozeOverdue ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
              />
            </button>
          </div>

          {/* Focus Mode */}
          <div className="flex items-center justify-between pt-4 border-t border-c-border-subtle dark:border-navy-700">
            <div>
              <label className="block font-medium text-c-text-secondary flex items-center gap-2">
                <Zap size={16} className="text-yellow-500" />
                {t('settings.work.enableFocusMode', 'Enable Focus Mode')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.work.enableFocusModeDescription',
                  'Allow activating focus mode for distraction-free work'
                )}
              </p>
            </div>
            <button
              onClick={() => updatePreference('enableFocusMode', !preferences.enableFocusMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.enableFocusMode ? 'bg-yellow-500' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`${preferences.enableFocusMode ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
              />
            </button>
          </div>

          {preferences.enableFocusMode && (
            <>
              {/* Focus Mode Blocks Notifications */}
              <div className="flex items-center justify-between pl-6">
                <div>
                  <label className="block font-medium text-c-text-secondary">
                    {t(
                      'settings.work.focusBlocksNotifications',
                      'Block Notifications During Focus'
                    )}
                  </label>
                  <p className="text-sm text-c-text-muted">
                    {t(
                      'settings.work.focusBlocksNotificationsDescription',
                      'Pause all notifications when focus mode is active'
                    )}
                  </p>
                </div>
                <button
                  onClick={() =>
                    updatePreference(
                      'focusModeBlocksNotifications',
                      !preferences.focusModeBlocksNotifications
                    )
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.focusModeBlocksNotifications
                      ? 'bg-yellow-500'
                      : 'bg-c-surface-raised'
                  }`}
                >
                  <span
                    className={`${preferences.focusModeBlocksNotifications ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
                  />
                </button>
              </div>

              {/* Default Focus Duration */}
              <div className="flex items-center justify-between pl-6">
                <div>
                  <label className="block font-medium text-c-text-secondary">
                    {t('settings.work.defaultFocusDuration', 'Default Focus Duration')}
                  </label>
                  <p className="text-sm text-c-text-muted">
                    {t(
                      'settings.work.defaultFocusDurationDescription',
                      'Default timer length for focus sessions'
                    )}
                  </p>
                </div>
                <select
                  value={preferences.defaultFocusDuration}
                  onChange={(e) =>
                    updatePreference('defaultFocusDuration', parseInt(e.target.value))
                  }
                  className="px-4 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text"
                >
                  {FOCUS_DURATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(`settings.work.focus.${option.value}min`, option.label)}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Task Sorting & Display */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <ArrowUpDown size={20} className="text-blue-500" />
          {t('settings.work.taskDisplay', 'Task Display & Sorting')}
        </h3>

        <div className="space-y-6">
          {/* Default Sort Order */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.work.defaultSort', 'Default Sort Order')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.work.defaultSortDescription',
                  'How tasks are sorted by default in lists'
                )}
              </p>
            </div>
            <select
              value={preferences.defaultTaskSort}
              onChange={(e) =>
                updatePreference(
                  'defaultTaskSort',
                  e.target.value as WorkPreferences['defaultTaskSort']
                )
              }
              className="px-4 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Week Start Day */}
          <div className="flex items-center justify-between pt-4 border-t border-c-border-subtle dark:border-navy-700">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.work.weekStart', 'Week Start Day')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t('settings.work.weekStartDescription', 'For calendar views and weekly reports')}
              </p>
            </div>
            <div className="flex bg-c-surface-raised p-1 rounded-lg">
              <button
                onClick={() => updatePreference('weekStartDay', 'monday')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  preferences.weekStartDay === 'monday'
                    ? 'bg-c-surface shadow text-c-text'
                    : 'text-c-text-muted hover:text-c-text-secondary'
                }`}
              >
                {t('settings.work.monday', 'Monday')}
              </button>
              <button
                onClick={() => updatePreference('weekStartDay', 'sunday')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  preferences.weekStartDay === 'sunday'
                    ? 'bg-c-surface shadow text-c-text'
                    : 'text-c-text-muted hover:text-c-text-secondary'
                }`}
              >
                {t('settings.work.sunday', 'Sunday')}
              </button>
            </div>
          </div>

          {/* Show Completed Tasks */}
          <div className="flex items-center justify-between pt-4 border-t border-c-border-subtle dark:border-navy-700">
            <div>
              <label className="block font-medium text-c-text-secondary flex items-center gap-2">
                <CheckSquare size={16} className="text-green-500" />
                {t('settings.work.showCompleted', 'Show Completed Tasks')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.work.showCompletedDescription',
                  'Display completed tasks in project views by default'
                )}
              </p>
            </div>
            <button
              onClick={() =>
                updatePreference('showCompletedTasks', !preferences.showCompletedTasks)
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.showCompletedTasks ? 'bg-navy-900' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`${preferences.showCompletedTasks ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
              />
            </button>
          </div>

          {/* Show Subtasks */}
          <div className="flex items-center justify-between pt-4 border-t border-c-border-subtle dark:border-navy-700">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.work.showSubtasks', 'Show Subtasks by Default')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.work.showSubtasksDescription',
                  'Automatically expand subtasks in task lists'
                )}
              </p>
            </div>
            <button
              onClick={() => updatePreference('showSubtasks', !preferences.showSubtasks)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.showSubtasks ? 'bg-navy-900' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`${preferences.showSubtasks ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Automation Settings */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Archive size={20} className="text-amber-500" />
          {t('settings.work.automation', 'Automation & Defaults')}
        </h3>

        <div className="space-y-6">
          {/* Auto Archive */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.work.autoArchive', 'Auto-Archive Completed Tasks')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.work.autoArchiveDescription',
                  'Automatically archive tasks after completion'
                )}
              </p>
            </div>
            <select
              value={preferences.autoArchiveDays}
              onChange={(e) => updatePreference('autoArchiveDays', parseInt(e.target.value))}
              className="px-4 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text"
            >
              <option value="0">{t('settings.work.never', 'Never')}</option>
              <option value="7">{t('settings.work.days', '{{count}} days', { count: 7 })}</option>
              <option value="14">{t('settings.work.days', '{{count}} days', { count: 14 })}</option>
              <option value="30">{t('settings.work.days', '{{count}} days', { count: 30 })}</option>
              <option value="60">{t('settings.work.days', '{{count}} days', { count: 60 })}</option>
              <option value="90">{t('settings.work.days', '{{count}} days', { count: 90 })}</option>
            </select>
          </div>

          {/* Default Due Days */}
          <div className="flex items-center justify-between pt-4 border-t border-c-border-subtle dark:border-navy-700">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.work.defaultDue', 'Default Task Due Date')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t('settings.work.defaultDueDescription', 'Days from creation for new tasks')}
              </p>
            </div>
            <select
              value={preferences.taskDefaultDueDays}
              onChange={(e) => updatePreference('taskDefaultDueDays', parseInt(e.target.value))}
              className="px-4 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text"
            >
              <option value="0">{t('settings.work.noDueDate', 'No default')}</option>
              <option value="1">{t('settings.work.tomorrow', 'Tomorrow')}</option>
              <option value="3">{t('settings.work.days', '{{count}} days', { count: 3 })}</option>
              <option value="7">{t('settings.work.days', '{{count}} days', { count: 7 })}</option>
              <option value="14">{t('settings.work.days', '{{count}} days', { count: 14 })}</option>
            </select>
          </div>

          {/* Time Tracking Mode */}
          <div className="flex items-center justify-between pt-4 border-t border-c-border-subtle dark:border-navy-700">
            <div>
              <label className="block font-medium text-c-text-secondary flex items-center gap-2">
                <Clock size={16} className="text-blue-500" />
                {t('settings.work.timeTracking', 'Time Tracking Mode')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t('settings.work.timeTrackingDescription', 'Default time tracking behavior')}
              </p>
            </div>
            <select
              value={preferences.defaultTimeTracking}
              onChange={(e) =>
                updatePreference(
                  'defaultTimeTracking',
                  e.target.value as WorkPreferences['defaultTimeTracking']
                )
              }
              className="px-4 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text"
            >
              <option value="none">{t('settings.work.timeNone', 'Disabled')}</option>
              <option value="manual">{t('settings.work.timeManual', 'Manual Entry')}</option>
              <option value="automatic">{t('settings.work.timeAuto', 'Automatic Timer')}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkPreferencesSettings;
