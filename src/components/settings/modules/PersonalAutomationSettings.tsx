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
  Loader2,
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

import { Api } from '../../../services/api';
import { User } from '../../../types';
import { InfoButton } from '../../shared/InfoButton';

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

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rulesRes, logsRes] = await Promise.all([
        Api.get('/api/user/automations').catch(() => ({ data: [] })),
        Api.get('/api/user/automations/logs').catch(() => ({ data: [] })),
      ]);

      // Set empty state if API fails
      if (rulesRes.data && rulesRes.data.length > 0) {
        setRules(rulesRes.data);
      } else {
        setRules([]);
      }

      if (logsRes.data && logsRes.data.length > 0) {
        setLogs(logsRes.data);
      } else {
        setLogs([]);
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
      toast.success(rule.enabled ? 'Automation paused' : 'Automation enabled');
    } catch (error) {
      toast.error('Failed to update automation');
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!window.confirm('Delete this automation?')) return;

    try {
      await Api.delete(`/api/user/automations/${ruleId}`);
      setRules(rules.filter((r) => r.id !== ruleId));
      toast.success('Automation deleted');
    } catch (error) {
      toast.error('Failed to delete automation');
    }
  };

  const createFromTemplate = (template: AutomationTemplate) => {
    const newRule: AutomationRule = {
      id: `rule_${Date.now()}`,
      name: template.name,
      description: template.description,
      enabled: false,
      trigger: template.trigger,
      actions: template.actions,
      runCount: 0,
    };
    setEditingRule(newRule);
    setShowCreateModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <InfoButton cardId="settings-personal-automation" position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Zap size={28} className="text-amber-500" />
            Personal Automations
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Automate repetitive tasks and workflows
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
        >
          <Plus size={16} />
          Create Automation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{rules.length}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Active Automations</p>
        </div>
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {rules.reduce((sum, r) => sum + r.runCount, 0)}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Runs</p>
        </div>
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {logs.filter((l) => l.status === 'success').length}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Successful (24h)</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-navy-700 pb-4">
        {[
          { id: 'rules', label: 'My Automations', icon: Zap },
          { id: 'templates', label: 'Templates', icon: Copy },
          { id: 'logs', label: 'History', icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
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
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`p-4 rounded-xl border-2 transition-all ${
                rule.enabled
                  ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-500/5'
                  : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white">{rule.name}</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{rule.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      rule.enabled
                        ? 'text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-500/20'
                        : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {rule.enabled ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button
                    onClick={() => setEditingRule(rule)}
                    className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-1 bg-slate-100 dark:bg-navy-800 rounded text-slate-600 dark:text-slate-400">
                  {triggerTypes.find((t) => t.id === rule.trigger.type)?.label || rule.trigger.type}
                </span>
                <ArrowRight size={14} className="text-slate-400 dark:text-slate-500" />
                <span className="px-2 py-1 bg-slate-100 dark:bg-navy-800 rounded text-slate-600 dark:text-slate-400">
                  {actionTypes.find((a) => a.id === rule.actions[0]?.type)?.label ||
                    rule.actions[0]?.type}
                </span>
              </div>

              {rule.lastRun && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
                  Last run: {new Date(rule.lastRun).toLocaleString()} • {rule.runCount} total runs
                </p>
              )}
            </div>
          ))}

          {rules.length === 0 && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <Zap size={48} className="mx-auto mb-4 opacity-30" />
              <p>No automations yet</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-2 text-amber-600 hover:underline"
              >
                Create your first automation
              </button>
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="p-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-xs bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
                    {template.category}
                  </span>
                  <h4 className="font-semibold text-slate-900 dark:text-white mt-2">
                    {template.name}
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {template.description}
                  </p>
                </div>
              </div>
              <button
                onClick={() => createFromTemplate(template)}
                className="w-full mt-3 py-2 px-4 border border-amber-500 text-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10 text-sm font-medium transition-colors"
              >
                Use Template
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {logs.map((log) => (
              <div key={log.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {log.status === 'success' ? (
                    <CheckCircle size={18} className="text-green-500" />
                  ) : (
                    <AlertCircle size={18} className="text-red-500" />
                  )}
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{log.ruleName}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{log.details}</p>
                  </div>
                </div>
                <span className="text-sm text-slate-400 dark:text-slate-500">
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
