/**
 * CustomerAutomationView - Customer Automation Rules
 * Connected to Backend API
 */

import { CheckCircle2, Clock, Loader2, Pause, Play, Plus, Settings, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Card } from '../../../components/Admin/shared/Card';
import { InfoButton } from '../../../components/shared/InfoButton';
import Api from '../../../services/api';

interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  trigger_type: string;
  trigger_config: string;
  action_type: string;
  action_config: string;
  is_active: boolean;
  executions_count: number;
  last_executed_at: string | null;
  created_at: string;
}

interface AutomationExecution {
  id?: string;
  rule_id?: string;
  organization_id?: string;
  organization_name?: string;
  user_id?: string;
  user_email?: string;
  status?: string;
  message?: string;
  executed_at?: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  org_created: 'Organization created with trial plan',
  trial_ending: 'Trial ends in X days',
  no_activity: 'No logins in X days',
  subscription_ending: 'Subscription renews in X days',
  health_drop: 'Customer health score drops',
};

const ACTION_LABELS: Record<string, string> = {
  send_email: 'Send email template',
  notify_csm: 'Notify CSM',
  create_task: 'Create follow-up task',
  update_health: 'Update health score',
};

const CustomerAutomationView: React.FC = () => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleExecutions, setRuleExecutions] = useState<AutomationExecution[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [ruleError, setRuleError] = useState<string | null>(null);

  const [newRule, setNewRule] = useState<{
    name: string;
    description: string;
    trigger_type: string;
    trigger_config_json: string;
    action_type: string;
    action_config_json: string;
  }>({
    name: '',
    description: '',
    trigger_type: 'org_created',
    trigger_config_json: '{}',
    action_type: 'send_email',
    action_config_json: '{}',
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const data = await Api.getAutomationRules();
      setRules(data || []);
    } catch (err) {
      console.error('Failed to fetch automation rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = async (ruleId: string, currentState: boolean) => {
    try {
      await Api.toggleAutomationRule(ruleId, !currentState);
      fetchRules();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const safeParseJson = (value: string): { ok: true; value: any } | { ok: false; error: string } => {
    if (!value?.trim()) return { ok: true, value: {} };
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') return { ok: true, value: parsed };
      return { ok: false, error: 'JSON must be an object' };
    } catch {
      return { ok: false, error: 'Invalid JSON' };
    }
  };

  const openRuleDetails = async (rule: AutomationRule) => {
    setSelectedRule(rule);
    setShowRuleModal(true);
    setRuleError(null);
    setRuleExecutions([]);
    setExecutionsLoading(true);
    try {
      const data = await Api.getRuleExecutions(rule.id);
      setRuleExecutions(data || []);
    } catch (err: any) {
      console.error('Failed to fetch rule executions:', err);
      setRuleError(err?.message || 'Failed to load rule executions');
    } finally {
      setExecutionsLoading(false);
    }
  };

  const handleCreateRule = async () => {
    setCreateError(null);
    if (!newRule.name.trim()) {
      setCreateError('Name is required');
      return;
    }

    const triggerParsed = safeParseJson(newRule.trigger_config_json);
    if (!triggerParsed.ok) {
      setCreateError(`Trigger config: ${triggerParsed.error}`);
      return;
    }

    const actionParsed = safeParseJson(newRule.action_config_json);
    if (!actionParsed.ok) {
      setCreateError(`Action config: ${actionParsed.error}`);
      return;
    }

    setCreateSubmitting(true);
    try {
      const result = await Api.createAutomationRule({
        name: newRule.name.trim(),
        description: newRule.description?.trim() || null,
        trigger_type: newRule.trigger_type,
        trigger_config: triggerParsed.value,
        action_type: newRule.action_type,
        action_config: actionParsed.value,
      });

      if (!result?.success) {
        setCreateError('Failed to create rule');
        return;
      }

      setShowCreateModal(false);
      setNewRule({
        name: '',
        description: '',
        trigger_type: 'org_created',
        trigger_config_json: '{}',
        action_type: 'send_email',
        action_config_json: '{}',
      });
      fetchRules();
    } catch (err: any) {
      console.error('Failed to create automation rule:', err);
      setCreateError(err?.message || 'Failed to create rule');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Delete this rule? This cannot be undone.')) return;
    setDeleteSubmitting(true);
    try {
      const result = await Api.deleteAutomationRule(ruleId);
      if (!result?.success) throw new Error('Failed to delete rule');
      setShowRuleModal(false);
      setSelectedRule(null);
      fetchRules();
    } catch (err: any) {
      console.error('Failed to delete automation rule:', err);
      setRuleError(err?.message || 'Failed to delete rule');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const activeRules = rules.filter((r) => r.is_active).length;
  const totalExecutions = rules.reduce((acc, r) => acc + (r.executions_count || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Automation Rules</h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Configure automated customer workflows
            </p>
          </div>
          <InfoButton cardId="superadmin-automation" />
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Zap className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{rules.length}</p>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Total Rules
              </span>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{activeRules}</p>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Active Rules
              </span>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalExecutions}</p>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Total Executions
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Rules Table */}
      <Card padding="sm">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Automation Rules
        </h3>
        {rules.length === 0 ? (
          <div className="text-center py-8">
            <Zap className="w-12 h-12 text-gray-600 dark:text-gray-400 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">
              No automation rules configured
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-blue-400 hover:text-blue-300"
            >
              Create your first rule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`p-4 rounded-lg border ${
                  rule.is_active
                    ? 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'
                    : 'bg-slate-50/60 dark:bg-white/5 border-slate-200 dark:border-white/10 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Zap
                        className={`w-4 h-4 ${rule.is_active ? 'text-yellow-500' : 'text-slate-400 dark:text-slate-400'}`}
                      />
                      <h4 className="text-slate-900 dark:text-white font-medium">{rule.name}</h4>
                      {rule.is_active && (
                        <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    {rule.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {rule.description}
                      </p>
                    )}
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                      <span className="text-blue-400">Trigger:</span>{' '}
                      {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      <span className="text-purple-400">Action:</span>{' '}
                      {ACTION_LABELS[rule.action_type] || rule.action_type}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{rule.executions_count || 0} executions</span>
                      {rule.last_executed_at && (
                        <span>Last: {new Date(rule.last_executed_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleRule(rule.id, rule.is_active)}
                      className={`p-2 rounded-lg transition-colors ${
                        rule.is_active
                          ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      }`}
                    >
                      {rule.is_active ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => openRuleDetails(rule)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-navy-900 dark:hover:bg-navy-700 rounded-lg transition-colors"
                    >
                      <Settings className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-2xl border border-slate-200 dark:border-navy-700">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
              Create automation rule
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Define a trigger and an action. Config fields accept JSON objects.
            </p>

            {createError && (
              <div className="mb-4 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300 rounded-lg px-3 py-2">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name
                </label>
                <input
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                  placeholder="e.g. Trial ending reminder"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description (optional)
                </label>
                <input
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                  placeholder="What does this rule do?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Trigger type
                </label>
                <select
                  value={newRule.trigger_type}
                  onChange={(e) => setNewRule({ ...newRule, trigger_type: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                >
                  {Object.keys(TRIGGER_LABELS).map((k) => (
                    <option key={k} value={k}>
                      {TRIGGER_LABELS[k] || k}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Action type
                </label>
                <select
                  value={newRule.action_type}
                  onChange={(e) => setNewRule({ ...newRule, action_type: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                >
                  {Object.keys(ACTION_LABELS).map((k) => (
                    <option key={k} value={k}>
                      {ACTION_LABELS[k] || k}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Trigger config (JSON)
                </label>
                <textarea
                  value={newRule.trigger_config_json}
                  onChange={(e) => setNewRule({ ...newRule, trigger_config_json: e.target.value })}
                  rows={6}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono text-xs"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Action config (JSON)
                </label>
                <textarea
                  value={newRule.action_config_json}
                  onChange={(e) => setNewRule({ ...newRule, action_config_json: e.target.value })}
                  rows={6}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError(null);
                }}
                className="px-4 py-2 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRule}
                disabled={createSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {createSubmitting ? 'Creating…' : 'Create rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rule Details Modal */}
      {showRuleModal && selectedRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-3xl border border-slate-200 dark:border-navy-700">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedRule.name}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {TRIGGER_LABELS[selectedRule.trigger_type] || selectedRule.trigger_type} →{' '}
                  {ACTION_LABELS[selectedRule.action_type] || selectedRule.action_type}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDeleteRule(selectedRule.id)}
                  disabled={deleteSubmitting}
                  className="px-3 py-2 text-sm rounded-lg border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                >
                  {deleteSubmitting ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  onClick={() => {
                    setShowRuleModal(false);
                    setSelectedRule(null);
                    setRuleError(null);
                  }}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  Close
                </button>
              </div>
            </div>

            {ruleError && (
              <div className="mt-4 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300 rounded-lg px-3 py-2">
                {ruleError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="border border-slate-200 dark:border-white/10 rounded-lg p-3 bg-slate-50 dark:bg-white/5">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Trigger config
                </div>
                <pre className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                  {(() => {
                    const parsed = safeParseJson(selectedRule.trigger_config || '{}');
                    return parsed.ok ? JSON.stringify(parsed.value, null, 2) : selectedRule.trigger_config;
                  })()}
                </pre>
              </div>
              <div className="border border-slate-200 dark:border-white/10 rounded-lg p-3 bg-slate-50 dark:bg-white/5">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Action config
                </div>
                <pre className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                  {(() => {
                    const parsed = safeParseJson(selectedRule.action_config || '{}');
                    return parsed.ok ? JSON.stringify(parsed.value, null, 2) : selectedRule.action_config;
                  })()}
                </pre>
              </div>
            </div>

            <div className="mt-5">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                Recent executions
              </h4>
              {executionsLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : ruleExecutions.length === 0 ? (
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  No executions yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {ruleExecutions.map((ex, idx) => (
                    <div
                      key={(ex as any)?.id || idx}
                      className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-slate-900 dark:text-white truncate">
                          {ex.organization_name || ex.organization_id || '—'}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                          {ex.user_email || ex.user_id || '—'}
                        </div>
                        {ex.message && (
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 whitespace-pre-wrap">
                            {ex.message}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {ex.status || 'unknown'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {ex.executed_at ? new Date(ex.executed_at).toLocaleString() : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerAutomationView;
