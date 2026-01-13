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

import { Api } from '../../services/api';
import { User } from '../../types';
import { InfoButton } from '../shared/InfoButton';

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
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<WorkPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, [currentUser.id]);

  const loadPreferences = async () => {
    try {
      const data = (await Api.get('/settings/preferences/work')) as WorkPreferencesResponse;
      if (data?.preferences) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
      }
    } catch (error) {
      console.error('Failed to load work preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Api.put('/settings/preferences/work', { preferences });
      toast.success(t('settings.work.saved', 'Work preferences saved successfully'));
    } catch (error) {
      toast.error(t('settings.work.error', 'Failed to save preferences'));
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = <K extends keyof WorkPreferences>(key: K, value: WorkPreferences[K]) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-purple-600" />
      </div>
    );
  }

  const viewOptions = [
    {
      value: 'kanban',
      label: t('settings.work.views.kanban', 'Kanban Board'),
      icon: LayoutGrid,
      description: 'Drag and drop cards',
    },
    {
      value: 'list',
      label: t('settings.work.views.list', 'List View'),
      icon: List,
      description: 'Traditional table format',
    },
    {
      value: 'timeline',
      label: t('settings.work.views.timeline', 'Timeline'),
      icon: GanttChart,
      description: 'Gantt-style view',
    },
    {
      value: 'calendar',
      label: t('settings.work.views.calendar', 'Calendar'),
      icon: Calendar,
      description: 'Calendar layout',
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
        return 'bg-orange-500';
      case 'urgent':
        return 'bg-red-500';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <InfoButton cardId="settings-work" position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Target size={28} className="text-purple-500" />
            {t('settings.work.title', 'Work Preferences')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {t(
              'settings.work.description',
              'Customize how you view and manage your tasks and projects'
            )}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? t('settings.saving', 'Saving...') : t('settings.save', 'Save Changes')}
        </button>
      </div>

      {/* Default Project View */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <LayoutGrid size={20} className="text-purple-500" />
          {t('settings.work.defaultView', 'Default Project View')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
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
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                    : 'border-slate-200 dark:border-navy-700 hover:border-purple-300 dark:hover:border-purple-500/50'
                }`}
              >
                <Icon
                  size={24}
                  className={isSelected ? 'text-purple-600' : 'text-slate-400 dark:text-slate-500'}
                />
                <div
                  className={`mt-2 font-medium ${isSelected ? 'text-purple-700 dark:text-purple-400' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  {option.label}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {option.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task Defaults - NEW SECTION */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Flag size={20} className="text-orange-500" />
          {t('settings.work.taskDefaults', 'Task Defaults')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {t('settings.work.taskDefaultsDescription', 'Set default values for new tasks')}
        </p>

        <div className="space-y-6">
          {/* Default Priority */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-3">
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
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                        : 'border-slate-200 dark:border-navy-700 hover:border-purple-300'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full ${getPriorityColor(option.value)}`} />
                    <span
                      className={`text-sm font-medium ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-slate-700 dark:text-slate-300'}`}
                    >
                      {t(`settings.work.priority.${option.value}`, option.label)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Default Reminder */}
          <div className="pt-4 border-t border-slate-100 dark:border-navy-700">
            <div className="flex items-center justify-between">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Bell size={16} className="text-blue-500" />
                  {t('settings.work.defaultReminder', 'Default Reminder')}
                </label>
                <p className="text-sm text-slate-500 dark:text-slate-400">
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
                className="px-4 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
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
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <AlarmClock size={20} className="text-indigo-500" />
          {t('settings.work.snoozeAndFocus', 'Snooze & Focus')}
        </h3>

        <div className="space-y-6">
          {/* Default Snooze Duration */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                {t('settings.work.defaultSnooze', 'Default Snooze Duration')}
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
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
              className="px-4 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
            >
              {SNOOZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`settings.work.snooze.${option.value}`, option.label)}
                </option>
              ))}
            </select>
          </div>

          {/* Auto-Snooze Overdue */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-navy-700">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                {t('settings.work.autoSnoozeOverdue', 'Auto-Snooze Overdue Tasks')}
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t(
                  'settings.work.autoSnoozeOverdueDescription',
                  'Automatically snooze notifications for overdue tasks'
                )}
              </p>
            </div>
            <button
              onClick={() => updatePreference('autoSnoozeOverdue', !preferences.autoSnoozeOverdue)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.autoSnoozeOverdue ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span
                className={`${preferences.autoSnoozeOverdue ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition-transform`}
              />
            </button>
          </div>

          {/* Focus Mode */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-navy-700">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Zap size={16} className="text-yellow-500" />
                {t('settings.work.enableFocusMode', 'Enable Focus Mode')}
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t(
                  'settings.work.enableFocusModeDescription',
                  'Allow activating focus mode for distraction-free work'
                )}
              </p>
            </div>
            <button
              onClick={() => updatePreference('enableFocusMode', !preferences.enableFocusMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.enableFocusMode ? 'bg-yellow-500' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span
                className={`${preferences.enableFocusMode ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition-transform`}
              />
            </button>
          </div>

          {preferences.enableFocusMode && (
            <>
              {/* Focus Mode Blocks Notifications */}
              <div className="flex items-center justify-between pl-6">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    {t(
                      'settings.work.focusBlocksNotifications',
                      'Block Notifications During Focus'
                    )}
                  </label>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
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
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`${preferences.focusModeBlocksNotifications ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition-transform`}
                  />
                </button>
              </div>

              {/* Default Focus Duration */}
              <div className="flex items-center justify-between pl-6">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    {t('settings.work.defaultFocusDuration', 'Default Focus Duration')}
                  </label>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
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
                  className="px-4 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
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
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <ArrowUpDown size={20} className="text-blue-500" />
          {t('settings.work.taskDisplay', 'Task Display & Sorting')}
        </h3>

        <div className="space-y-6">
          {/* Default Sort Order */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                {t('settings.work.defaultSort', 'Default Sort Order')}
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
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
              className="px-4 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Week Start Day */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-navy-700">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                {t('settings.work.weekStart', 'Week Start Day')}
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('settings.work.weekStartDescription', 'For calendar views and weekly reports')}
              </p>
            </div>
            <div className="flex bg-slate-100 dark:bg-navy-950 p-1 rounded-lg">
              <button
                onClick={() => updatePreference('weekStartDay', 'monday')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  preferences.weekStartDay === 'monday'
                    ? 'bg-white dark:bg-navy-800 shadow text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-300'
                }`}
              >
                {t('settings.work.monday', 'Monday')}
              </button>
              <button
                onClick={() => updatePreference('weekStartDay', 'sunday')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  preferences.weekStartDay === 'sunday'
                    ? 'bg-white dark:bg-navy-800 shadow text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-300'
                }`}
              >
                {t('settings.work.sunday', 'Sunday')}
              </button>
            </div>
          </div>

          {/* Show Completed Tasks */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-navy-700">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <CheckSquare size={16} className="text-green-500" />
                {t('settings.work.showCompleted', 'Show Completed Tasks')}
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
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
                preferences.showCompletedTasks ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span
                className={`${preferences.showCompletedTasks ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition-transform`}
              />
            </button>
          </div>

          {/* Show Subtasks */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-navy-700">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                {t('settings.work.showSubtasks', 'Show Subtasks by Default')}
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t(
                  'settings.work.showSubtasksDescription',
                  'Automatically expand subtasks in task lists'
                )}
              </p>
            </div>
            <button
              onClick={() => updatePreference('showSubtasks', !preferences.showSubtasks)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.showSubtasks ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span
                className={`${preferences.showSubtasks ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition-transform`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Automation Settings */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Archive size={20} className="text-amber-500" />
          {t('settings.work.automation', 'Automation & Defaults')}
        </h3>

        <div className="space-y-6">
          {/* Auto Archive */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                {t('settings.work.autoArchive', 'Auto-Archive Completed Tasks')}
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t(
                  'settings.work.autoArchiveDescription',
                  'Automatically archive tasks after completion'
                )}
              </p>
            </div>
            <select
              value={preferences.autoArchiveDays}
              onChange={(e) => updatePreference('autoArchiveDays', parseInt(e.target.value))}
              className="px-4 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
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
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-navy-700">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                {t('settings.work.defaultDue', 'Default Task Due Date')}
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('settings.work.defaultDueDescription', 'Days from creation for new tasks')}
              </p>
            </div>
            <select
              value={preferences.taskDefaultDueDays}
              onChange={(e) => updatePreference('taskDefaultDueDays', parseInt(e.target.value))}
              className="px-4 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
            >
              <option value="0">{t('settings.work.noDueDate', 'No default')}</option>
              <option value="1">{t('settings.work.tomorrow', 'Tomorrow')}</option>
              <option value="3">{t('settings.work.days', '{{count}} days', { count: 3 })}</option>
              <option value="7">{t('settings.work.days', '{{count}} days', { count: 7 })}</option>
              <option value="14">{t('settings.work.days', '{{count}} days', { count: 14 })}</option>
            </select>
          </div>

          {/* Time Tracking Mode */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-navy-700">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Clock size={16} className="text-blue-500" />
                {t('settings.work.timeTracking', 'Time Tracking Mode')}
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
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
              className="px-4 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
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
