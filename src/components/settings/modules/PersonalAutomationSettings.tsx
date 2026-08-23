/**
 * PersonalAutomationSettings - Personal Automation Rules
 *
 * Features:
 * - Personal automation rules
 * - Automation templates
 * - Automation history/logs
 * - Automation triggers
 */

import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock,
  Copy,
  Edit2,
  Filter,
  Pause,
  Play,
  Plus,
  Save,
  Trash2,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../../services/api';
import { User } from '../../../types';
import { DegradedState, ReadOnlyState } from '../../Admin/AdminState';

interface PersonalAutomationSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: {
    type: string;
    conditions: any;
  };
  actions: {
    type: string;
    params: any;
  }[];
  lastRun?: string;
  runCount: number;
}

interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  trigger: any;
  actions: any[];
}

interface AutomationLog {
  id: string;
  ruleId: string;
  ruleName: string;
  status: 'success' | 'failed';
  timestamp: string;
  details: string;
}

const templates: AutomationTemplate[] = [
  {
    id: 't1',
    name: 'Auto-assign tasks',
    description: 'Assign new tasks based on keywords',
    category: 'Tasks',
    trigger: { type: 'task_created' },
    actions: [{ type: 'assign_user' }],
  },
  {
    id: 't2',
    name: 'Due date reminder',
    description: 'Send reminder before due date',
    category: 'Tasks',
    trigger: { type: 'due_date_approaching' },
    actions: [{ type: 'send_notification' }],
  },
  {
    id: 't3',
    name: 'Archive completed',
    description: 'Auto-archive completed tasks',
    category: 'Tasks',
    trigger: { type: 'task_completed' },
    actions: [{ type: 'archive_task' }],
  },
  {
    id: 't4',
    name: 'Daily standup',
    description: 'Generate daily standup report',
    category: 'Reports',
    trigger: { type: 'schedule', time: '09:00' },
    actions: [{ type: 'generate_report' }],
  },
  {
    id: 't5',
    name: 'Welcome new members',
    description: 'Send welcome message to new team members',
    category: 'Team',
    trigger: { type: 'member_joined' },
    actions: [{ type: 'send_message' }],
  },
];

const triggerTypes = [
  { id: 'task_created', label: 'When a task is created' },
  { id: 'task_completed', label: 'When a task is completed' },
  { id: 'task_assigned', label: 'When a task is assigned' },
  { id: 'due_date_approaching', label: 'When due date is approaching' },
  { id: 'project_created', label: 'When a project is created' },
  { id: 'comment_added', label: 'When a comment is added' },
  { id: 'schedule', label: 'On a schedule' },
];

const actionTypes = [
  { id: 'send_notification', label: 'Send notification' },
  { id: 'assign_user', label: 'Assign to user' },
  { id: 'change_status', label: 'Change status' },
  { id: 'add_tag', label: 'Add tag' },
  { id: 'move_to_project', label: 'Move to project' },
  { id: 'archive_task', label: 'Archive item' },
  { id: 'send_email', label: 'Send email' },
  { id: 'create_task', label: 'Create task' },
];

export const PersonalAutomationSettings: React.FC<PersonalAutomationSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [activeTab, setActiveTab] = useState<'rules' | 'templates' | 'logs'>('rules');
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [rulesLoadError, setRulesLoadError] = useState<string | null>(null);
  const [logsLoadError, setLogsLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  const getTemplateName = (template: AutomationTemplate) =>
    t(`settings.personalAutomation.templates.${template.id}.name`, template.name);

  const getTemplateDescription = (template: AutomationTemplate) =>
    t(`settings.personalAutomation.templates.${template.id}.description`, template.description);

  const getTemplateCategory = (category: string) =>
    t(`settings.personalAutomation.categories.${category.toLowerCase()}`, category);

  const getTriggerLabel = (triggerId: string) =>
    t(
      `settings.personalAutomation.triggers.${triggerId}`,
      triggerTypes.find((trigger) => trigger.id === triggerId)?.label || triggerId
    );

  const getActionLabel = (actionId?: string) =>
    t(
      `settings.personalAutomation.actions.${actionId || 'unknown'}`,
      actionTypes.find((action) => action.id === actionId)?.label || actionId || ''
    );

  const loadData = async () => {
    try {
      setLoading(true);
      setRulesLoadError(null);
      setLogsLoadError(null);
      const [rulesRes, logsRes] = await Promise.allSettled([
        Api.get('/api/user/automations'),
        Api.get('/api/user/automations/logs'),
      ]);

      if (rulesRes.status === 'fulfilled') {
        const rulesData = Array.isArray(rulesRes.value?.data)
          ? rulesRes.value.data
          : rulesRes.value;
        setRules(Array.isArray(rulesData) ? rulesData : []);
      } else {
        setRules([]);
        setRulesLoadError('Failed to load automations');
      }

      if (logsRes.status === 'fulfilled') {
        const logsData = Array.isArray(logsRes.value?.data) ? logsRes.value.data : logsRes.value;
        setLogs(Array.isArray(logsData) ? logsData : []);
      } else {
        setLogs([]);
        setLogsLoadError('Failed to load automation history');
      }
    } catch (error) {
      console.error('Error loading automations:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = async (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    try {
      await Api.put(`/api/user/automations/${ruleId}`, { enabled: !rule.enabled });
      setRules(rules.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)));
      toast.success(
        rule.enabled
          ? t('settings.personalAutomation.paused', 'Automation paused')
          : t('settings.personalAutomation.enabled', 'Automation enabled')
      );
    } catch (error) {
      toast.error(t('settings.personalAutomation.updateError', 'Failed to update automation'));
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!window.confirm(t('settings.personalAutomation.deleteConfirm', 'Delete this automation?')))
      return;

    try {
      await Api.delete(`/api/user/automations/${ruleId}`);
      setRules(rules.filter((r) => r.id !== ruleId));
      toast.success(t('settings.personalAutomation.deleted', 'Automation deleted'));
    } catch (error) {
      toast.error(t('settings.personalAutomation.deleteError', 'Failed to delete automation'));
    }
  };

  const createFromTemplate = (template: AutomationTemplate) => {
    toast.error(
      t(
        'settings.personalAutomation.templateReadOnly',
        'Automation template creation is read-only until persistence is connected'
      )
    );
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Zap size={28} className="text-amber-500" />
            {t('settings.personalAutomation.title', 'Personal Automations')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t('settings.personalAutomation.subtitle', 'Automate repetitive tasks and workflows')}
          </p>
        </div>
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
          {t('settings.personalAutomation.createAutomation', 'Create Automation')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-c-text">{rulesLoadError ? '--' : rules.length}</p>
          <p className="text-sm text-c-text-muted">
            {t('settings.personalAutomation.stats.active', 'Active Automations')}
          </p>
        </div>
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-c-text">
            {rulesLoadError ? '--' : rules.reduce((sum, r) => sum + r.runCount, 0)}
          </p>
          <p className="text-sm text-c-text-muted">
            {t('settings.personalAutomation.stats.totalRuns', 'Total Runs')}
          </p>
        </div>
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {logsLoadError
              ? '--'
              : logs.filter(
                  (l) =>
                    l.status === 'success' &&
                    Date.now() - new Date(l.timestamp).getTime() < 24 * 60 * 60 * 1000
                ).length}
          </p>
          <p className="text-sm text-c-text-muted">
            {t('settings.personalAutomation.stats.successful24h', 'Successful (24h)')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-c-border-subtle dark:border-navy-700 pb-4">
        {[
          {
            id: 'rules',
            label: t('settings.personalAutomation.tabs.rules', 'My Automations'),
            icon: Zap,
          },
          {
            id: 'templates',
            label: t('settings.personalAutomation.tabs.templates', 'Templates'),
            icon: Copy,
          },
          { id: 'logs', label: t('settings.personalAutomation.tabs.logs', 'History'), icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-amber-600 text-white'
                  : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-700'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {rulesLoadError && (
            <DegradedState title="Automations unavailable" description={rulesLoadError} />
          )}
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`p-4 rounded-xl border-2 transition-all ${
                rule.enabled
                  ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-500/5'
                  : 'border-c-border-subtle dark:border-navy-700 bg-c-surface opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-c-text">{rule.name}</h4>
                  <p className="text-sm text-c-text-muted">{rule.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      rule.enabled
                        ? 'text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-500/20'
                        : 'text-c-text-secondary hover:bg-c-surface-raised'
                    }`}
                  >
                    {rule.enabled ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button
                    onClick={() => setEditingRule(rule)}
                    className="p-2 text-c-text-muted hover:bg-c-surface-raised rounded-lg"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-1 bg-c-surface-raised rounded text-c-text-secondary">
                  {getTriggerLabel(rule.trigger.type)}
                </span>
                <ArrowRight size={14} className="text-c-text-secondary" />
                <span className="px-2 py-1 bg-c-surface-raised rounded text-c-text-secondary">
                  {getActionLabel(rule.actions[0]?.type)}
                </span>
              </div>

              {rule.lastRun && (
                <p className="text-xs text-c-text-secondary mt-3">
                  {t('settings.personalAutomation.lastRun', {
                    defaultValue: 'Last run: {{date}} • {{count}} total runs',
                    date: new Date(rule.lastRun).toLocaleString(),
                    count: rule.runCount,
                  })}
                </p>
              )}
            </div>
          ))}

          {!rulesLoadError && rules.length === 0 && (
            <div className="text-center py-12 text-c-text-muted">
              <Zap size={48} className="mx-auto mb-4 opacity-30" />
              <p>{t('settings.personalAutomation.empty', 'No automations yet')}</p>
              <button disabled className="mt-2 text-amber-600 hover:underline">
                {t('settings.personalAutomation.createFirst', 'Create your first automation')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <ReadOnlyState
            title="Automation templates are read-only"
            description="Templates are static examples until automation creation is connected to backend persistence."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="p-4 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-xs bg-c-surface-raised text-c-text-secondary px-2 py-0.5 rounded">
                      {getTemplateCategory(template.category)}
                    </span>
                    <h4 className="font-semibold text-c-text mt-2">{getTemplateName(template)}</h4>
                    <p className="text-sm text-c-text-muted">{getTemplateDescription(template)}</p>
                  </div>
                </div>
                <button
                  onClick={() => createFromTemplate(template)}
                  disabled
                  className="w-full mt-3 py-2 px-4 border border-amber-500 text-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('settings.personalAutomation.useTemplate', 'Use Template')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl overflow-hidden">
          {logsLoadError && (
            <div className="p-4">
              <DegradedState title="Automation history unavailable" description={logsLoadError} />
            </div>
          )}
          <div className="divide-y divide-c-border-subtle dark:divide-white/5">
            {!logsLoadError &&
              logs.map((log) => (
                <div key={log.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {log.status === 'success' ? (
                      <CheckCircle size={18} className="text-green-500" />
                    ) : (
                      <AlertCircle size={18} className="text-danger-500" />
                    )}
                    <div>
                      <p className="font-medium text-c-text">{log.ruleName}</p>
                      <p className="text-sm text-c-text-muted">{log.details}</p>
                    </div>
                  </div>
                  <span className="text-sm text-c-text-secondary">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalAutomationSettings;
