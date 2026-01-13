/**
 * CustomerAutomationView - Customer Automation Rules
 * Connected to Backend API
 */

import { CheckCircle2, Clock, Loader2, Pause, Play, Plus, Settings, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Card } from '../../../components/Admin/shared/Card';
import { InfoButton } from '../../../components/ui/InfoButton';
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
            <h2 className="text-2xl font-bold text-white">Automation Rules</h2>
            <p className="text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">
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
        <Card className="bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Zap className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{rules.length}</p>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                Total Rules
              </span>
            </div>
          </div>
        </Card>
        <Card className="bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{activeRules}</p>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                Active Rules
              </span>
            </div>
          </div>
        </Card>
        <Card className="bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalExecutions}</p>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                Total Executions
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Rules Table */}
      <Card className="bg-gray-800 p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Automation Rules</h3>
        {rules.length === 0 ? (
          <div className="text-center py-8">
            <Zap className="w-12 h-12 text-gray-600 dark:text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 dark:text-gray-500 dark:text-gray-400">
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
                    ? 'bg-gray-700/50 border-gray-600'
                    : 'bg-gray-800/50 border-gray-700 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Zap
                        className={`w-4 h-4 ${rule.is_active ? 'text-yellow-400' : 'text-gray-500 dark:text-gray-400'}`}
                      />
                      <h4 className="text-white font-medium">{rule.name}</h4>
                      {rule.is_active && (
                        <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    {rule.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {rule.description}
                      </p>
                    )}
                    <p className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">
                      <span className="text-blue-400">Trigger:</span>{' '}
                      {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400">
                      <span className="text-purple-400">Action:</span>{' '}
                      {ACTION_LABELS[rule.action_type] || rule.action_type}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
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
                    <button className="p-2 bg-gray-600 hover:bg-gray-50 dark:bg-navy-8000 rounded-lg transition-colors">
                      <Settings className="w-4 h-4 text-gray-300" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default CustomerAutomationView;
