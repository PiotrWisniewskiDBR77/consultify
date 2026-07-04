/**
 * WorkspaceDefaultsPanel - Workspace Default Settings
 *
 * Features:
 * - Default project settings
 * - Default task priorities
 * - Default workflow states
 * - Time zone settings for workspace
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  FolderOpen,
  Globe,
  GripVertical,
  ListTodo,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { InfoButton } from '../shared/InfoButton';

// Types
interface WorkflowState {
  id: string;
  name: string;
  color: string;
  type: 'todo' | 'in_progress' | 'done' | 'blocked';
  isDefault: boolean;
}

interface TaskPriority {
  id: string;
  name: string;
  color: string;
  value: number;
  icon: string;
}

interface DefaultSettings {
  projectDefaults: {
    defaultViewMode: 'kanban' | 'list' | 'timeline' | 'calendar';
    autoAssignCreator: boolean;
    defaultPrivacy: 'public' | 'private' | 'team';
    enableTimeTracking: boolean;
    enableDependencies: boolean;
    defaultEstimationUnit: 'hours' | 'days' | 'points';
  };
  taskDefaults: {
    defaultPriority: string;
    defaultDueOffset: number; // days from creation
    defaultAssignee: 'creator' | 'unassigned' | 'manager';
    autoAddToMyWork: boolean;
  };
  workflowStates: WorkflowState[];
  priorities: TaskPriority[];
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  weekStart: 'sunday' | 'monday';
  workingDays: number[];
  workingHours: {
    start: string;
    end: string;
  };
}

// Default workflow states
const DEFAULT_WORKFLOW_STATES: WorkflowState[] = [
  { id: 'backlog', name: 'Backlog', color: 'slate', type: 'todo', isDefault: true },
  { id: 'todo', name: 'To Do', color: 'blue', type: 'todo', isDefault: false },
  { id: 'in_progress', name: 'In Progress', color: 'amber', type: 'in_progress', isDefault: false },
  { id: 'review', name: 'Review', color: 'violet', type: 'in_progress', isDefault: false },
  { id: 'done', name: 'Done', color: 'green', type: 'done', isDefault: false },
  { id: 'blocked', name: 'Blocked', color: 'red', type: 'blocked', isDefault: false },
];

// Default priorities
const DEFAULT_PRIORITIES: TaskPriority[] = [
  { id: 'urgent', name: 'Urgent', color: 'red', value: 4, icon: '🔴' },
  { id: 'high', name: 'High', color: 'orange', value: 3, icon: '🟠' },
  { id: 'medium', name: 'Medium', color: 'amber', value: 2, icon: '🟡' },
  { id: 'low', name: 'Low', color: 'green', value: 1, icon: '🟢' },
];

// Color options
const COLOR_OPTIONS = [
  { id: 'slate', bg: 'bg-slate-500', light: 'bg-slate-100' },
  { id: 'red', bg: 'bg-danger-500', light: 'bg-danger-100' },
  { id: 'orange', bg: 'bg-amber-500', light: 'bg-amber-100' },
  { id: 'amber', bg: 'bg-amber-500', light: 'bg-amber-100' },
  { id: 'green', bg: 'bg-green-500', light: 'bg-green-100' },
  { id: 'blue', bg: 'bg-blue-500', light: 'bg-blue-100' },
  { id: 'violet', bg: 'bg-c-accent', light: 'bg-c-accent/10' },
  { id: 'pink', bg: 'bg-pink-500', light: 'bg-pink-100' },
];

// Timezone options (simplified)
const TIMEZONE_OPTIONS = [
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Warsaw',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

interface WorkspaceDefaultsPanelProps {
  className?: string;
}

export const WorkspaceDefaultsPanel: React.FC<WorkspaceDefaultsPanelProps> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const { currentOrganization } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [settings, setSettings] = useState<DefaultSettings>({
    projectDefaults: {
      defaultViewMode: 'kanban',
      autoAssignCreator: true,
      defaultPrivacy: 'team',
      enableTimeTracking: true,
      enableDependencies: true,
      defaultEstimationUnit: 'hours',
    },
    taskDefaults: {
      defaultPriority: 'medium',
      defaultDueOffset: 7,
      defaultAssignee: 'creator',
      autoAddToMyWork: true,
    },
    workflowStates: DEFAULT_WORKFLOW_STATES,
    priorities: DEFAULT_PRIORITIES,
    timezone: 'Europe/Warsaw',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    weekStart: 'monday',
    workingDays: [1, 2, 3, 4, 5],
    workingHours: {
      start: '09:00',
      end: '17:00',
    },
  });

  // Load settings
  const loadSettings = useCallback(async () => {
    if (!currentOrganization?.id) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/workspace-defaults/${currentOrganization.id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.exists && data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error(t('admin.defaults.loadError', 'Failed to load settings'));
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, t]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Update settings
  const updateSettings = (path: string, value: any) => {
    setSettings((prev) => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let current: any = newSettings;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;

      return newSettings;
    });
    setHasChanges(true);
  };

  // Save settings
  const saveSettings = async () => {
    if (!currentOrganization?.id) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/workspace-defaults/${currentOrganization.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success(t('admin.defaults.saved', 'Settings saved successfully'));
        setHasChanges(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Save failed');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(t('admin.defaults.saveError', 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  // Add workflow state
  const addWorkflowState = () => {
    const newState: WorkflowState = {
      id: `state_${Date.now()}`,
      name: 'New State',
      color: 'blue',
      type: 'in_progress',
      isDefault: false,
    };
    setSettings((prev) => ({
      ...prev,
      workflowStates: [...prev.workflowStates, newState],
    }));
    setHasChanges(true);
  };

  // Remove workflow state
  const removeWorkflowState = (stateId: string) => {
    setSettings((prev) => ({
      ...prev,
      workflowStates: prev.workflowStates.filter((s) => s.id !== stateId),
    }));
    setHasChanges(true);
  };

  // Update workflow state
  const updateWorkflowState = (stateId: string, field: keyof WorkflowState, value: any) => {
    setSettings((prev) => ({
      ...prev,
      workflowStates: prev.workflowStates.map((s) =>
        s.id === stateId ? { ...s, [field]: value } : s
      ),
    }));
    setHasChanges(true);
  };

  // Toggle working day
  const toggleWorkingDay = (day: number) => {
    setSettings((prev) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day].sort(),
    }));
    setHasChanges(true);
  };

  const DAYS_OF_WEEK = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('admin.defaults.title', 'Workspace Defaults')}
            </h2>
            <InfoButton cardId="admin-defaults" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('admin.defaults.subtitle', 'Configure default settings for projects and tasks')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSettings}
            disabled={loading}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50"
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={saveSettings}
            disabled={!hasChanges || saving}
            className="px-4 py-2 bg-c-text text-c-bg hover:bg-c-text-secondary disabled:bg-slate-300 dark:disabled:bg-slate-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Save size={18} className={saving ? 'animate-spin' : ''} />
            {t('common.save', 'Save Changes')}
          </button>
        </div>
      </div>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2"
        >
          <AlertTriangle className="text-amber-500" size={16} />
          <span className="text-sm text-amber-800 dark:text-amber-300">
            {t('admin.defaults.unsavedChanges', 'You have unsaved changes')}
          </span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Defaults */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <FolderOpen className="text-primary-500" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {t('admin.defaults.projectDefaults', 'Project Defaults')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('admin.defaults.projectDefaultsDesc', 'Settings for new projects')}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Default View Mode */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('admin.defaults.defaultView', 'Default View')}
              </label>
              <select
                value={settings.projectDefaults.defaultViewMode}
                onChange={(e) => updateSettings('projectDefaults.defaultViewMode', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="kanban">Kanban Board</option>
                <option value="list">List View</option>
                <option value="timeline">Timeline / Gantt</option>
                <option value="calendar">Calendar</option>
              </select>
            </div>

            {/* Default Privacy */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('admin.defaults.defaultPrivacy', 'Default Privacy')}
              </label>
              <select
                value={settings.projectDefaults.defaultPrivacy}
                onChange={(e) => updateSettings('projectDefaults.defaultPrivacy', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="public">
                  {t('admin.defaults.public', 'Public (visible to all)')}
                </option>
                <option value="team">
                  {t('admin.defaults.team', 'Team (visible to team members)')}
                </option>
                <option value="private">
                  {t('admin.defaults.private', 'Private (invite only)')}
                </option>
              </select>
            </div>

            {/* Estimation Unit */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('admin.defaults.estimationUnit', 'Estimation Unit')}
              </label>
              <select
                value={settings.projectDefaults.defaultEstimationUnit}
                onChange={(e) =>
                  updateSettings('projectDefaults.defaultEstimationUnit', e.target.value)
                }
                className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="hours">{t('admin.defaults.hours', 'Hours')}</option>
                <option value="days">{t('admin.defaults.days', 'Days')}</option>
                <option value="points">{t('admin.defaults.points', 'Story Points')}</option>
              </select>
            </div>

            {/* Toggle Options */}
            <div className="space-y-3 pt-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {t('admin.defaults.autoAssignCreator', 'Auto-assign project creator')}
                </span>
                <input
                  type="checkbox"
                  checked={settings.projectDefaults.autoAssignCreator}
                  onChange={(e) =>
                    updateSettings('projectDefaults.autoAssignCreator', e.target.checked)
                  }
                  className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-500 focus:ring-c-focus"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {t('admin.defaults.enableTimeTracking', 'Enable time tracking')}
                </span>
                <input
                  type="checkbox"
                  checked={settings.projectDefaults.enableTimeTracking}
                  onChange={(e) =>
                    updateSettings('projectDefaults.enableTimeTracking', e.target.checked)
                  }
                  className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-500 focus:ring-c-focus"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {t('admin.defaults.enableDependencies', 'Enable task dependencies')}
                </span>
                <input
                  type="checkbox"
                  checked={settings.projectDefaults.enableDependencies}
                  onChange={(e) =>
                    updateSettings('projectDefaults.enableDependencies', e.target.checked)
                  }
                  className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-500 focus:ring-c-focus"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Task Defaults */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <ListTodo className="text-blue-500" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {t('admin.defaults.taskDefaults', 'Task Defaults')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('admin.defaults.taskDefaultsDesc', 'Settings for new tasks')}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Default Priority */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('admin.defaults.defaultPriority', 'Default Priority')}
              </label>
              <select
                value={settings.taskDefaults.defaultPriority}
                onChange={(e) => updateSettings('taskDefaults.defaultPriority', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
              >
                {settings.priorities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Default Due Offset */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('admin.defaults.defaultDueOffset', 'Default Due Date Offset')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.taskDefaults.defaultDueOffset}
                  onChange={(e) =>
                    updateSettings('taskDefaults.defaultDueOffset', parseInt(e.target.value) || 0)
                  }
                  className="w-24 px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                  min={0}
                />
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('admin.defaults.daysFromCreation', 'days from creation')}
                </span>
              </div>
            </div>

            {/* Default Assignee */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('admin.defaults.defaultAssignee', 'Default Assignee')}
              </label>
              <select
                value={settings.taskDefaults.defaultAssignee}
                onChange={(e) => updateSettings('taskDefaults.defaultAssignee', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="creator">{t('admin.defaults.taskCreator', 'Task Creator')}</option>
                <option value="manager">
                  {t('admin.defaults.projectManager', 'Project Manager')}
                </option>
                <option value="unassigned">{t('admin.defaults.unassigned', 'Unassigned')}</option>
              </select>
            </div>

            <label className="flex items-center justify-between cursor-pointer pt-2">
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {t('admin.defaults.autoAddToMyWork', 'Auto-add to My Work when assigned')}
              </span>
              <input
                type="checkbox"
                checked={settings.taskDefaults.autoAddToMyWork}
                onChange={(e) => updateSettings('taskDefaults.autoAddToMyWork', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-500 focus:ring-c-focus"
              />
            </label>
          </div>
        </div>

        {/* Workflow States */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Tag className="text-green-500" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {t('admin.defaults.workflowStates', 'Workflow States')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('admin.defaults.workflowStatesDesc', 'Default task statuses')}
                </p>
              </div>
            </div>
            <button
              onClick={addWorkflowState}
              className="p-2 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="space-y-2">
            {settings.workflowStates.map((state, index) => (
              <div
                key={state.id}
                className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-navy-700 rounded-lg group"
              >
                <GripVertical
                  className="text-slate-400 dark:text-slate-500 cursor-move"
                  size={16}
                />

                {/* Color picker */}
                <div className="relative">
                  <button
                    className={`w-4 h-4 rounded-full ${COLOR_OPTIONS.find((c) => c.id === state.color)?.bg || 'bg-slate-400'}`}
                  />
                  <select
                    value={state.color}
                    onChange={(e) => updateWorkflowState(state.id, 'color', e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  >
                    {COLOR_OPTIONS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="text"
                  value={state.name}
                  onChange={(e) => updateWorkflowState(state.id, 'name', e.target.value)}
                  className="flex-1 px-2 py-1 bg-transparent border-0 text-sm text-slate-900 dark:text-white focus:ring-0"
                />

                <select
                  value={state.type}
                  onChange={(e) => updateWorkflowState(state.id, 'type', e.target.value)}
                  className="px-2 py-1 text-xs bg-transparent border border-slate-200 dark:border-navy-600 rounded text-slate-600 dark:text-slate-400"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                  <option value="blocked">Blocked</option>
                </select>

                <button
                  onClick={() => removeWorkflowState(state.id)}
                  className="p-1 text-slate-400 dark:text-slate-500 hover:text-danger-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Time & Date Settings */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Clock className="text-amber-500" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {t('admin.defaults.timeDateSettings', 'Time & Date')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('admin.defaults.timeDateSettingsDesc', 'Regional preferences')}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('admin.defaults.timezone', 'Timezone')}
              </label>
              <select
                value={settings.timezone}
                onChange={(e) => updateSettings('timezone', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Format */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('admin.defaults.dateFormat', 'Date Format')}
              </label>
              <select
                value={settings.dateFormat}
                onChange={(e) => updateSettings('dateFormat', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>

            {/* Time Format */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('admin.defaults.timeFormat', 'Time Format')}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => updateSettings('timeFormat', '24h')}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                    settings.timeFormat === '24h'
                      ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  24h (14:30)
                </button>
                <button
                  onClick={() => updateSettings('timeFormat', '12h')}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                    settings.timeFormat === '12h'
                      ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  12h (2:30 PM)
                </button>
              </div>
            </div>

            {/* Week Start */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('admin.defaults.weekStart', 'Week Starts On')}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => updateSettings('weekStart', 'monday')}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                    settings.weekStart === 'monday'
                      ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Monday
                </button>
                <button
                  onClick={() => updateSettings('weekStart', 'sunday')}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                    settings.weekStart === 'sunday'
                      ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Sunday
                </button>
              </div>
            </div>

            {/* Working Days */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('admin.defaults.workingDays', 'Working Days')}
              </label>
              <div className="flex gap-1">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => toggleWorkingDay(day.value)}
                    className={`w-10 h-10 text-xs font-medium rounded-lg transition-colors ${
                      settings.workingDays.includes(day.value)
                        ? 'bg-c-text text-c-bg'
                        : 'bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-600'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Working Hours */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('admin.defaults.workingHours', 'Working Hours')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={settings.workingHours.start}
                  onChange={(e) => updateSettings('workingHours.start', e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                />
                <span className="text-slate-500 dark:text-slate-400">to</span>
                <input
                  type="time"
                  value={settings.workingHours.end}
                  onChange={(e) => updateSettings('workingHours.end', e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceDefaultsPanel;
