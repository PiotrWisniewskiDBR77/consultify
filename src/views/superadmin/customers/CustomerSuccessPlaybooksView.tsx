import {
  Activity,
  Building2,
  CheckCircle2,
  Loader2,
  Play,
  Plus,
  Target,
  Trash2,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '../../../components/Admin/shared/Card';
import { InfoButton } from '../../../components/shared/InfoButton';
import Api from '../../../services/api';

interface Playbook {
  id: string;
  name: string;
  description?: string;
  trigger_conditions_json: string;
  actions_json: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PlaybookAction {
  id: string;
  playbook_id: string;
  playbook_name?: string;
  organization_id: string;
  organization_name?: string;
  action_type: string;
  status: string;
  executed_at: string;
}

interface PlaybookStats {
  total_playbooks: number;
  active_playbooks: number;
  total_actions: number;
  completed_actions: number;
}

const CustomerSuccessPlaybooksView: React.FC = () => {
  const { t } = useTranslation();
  const actionTypes = [
    { id: 'send_email', label: t('superadmin.customers.playbooks.actionTypes.sendEmail'), icon: '📧' },
    { id: 'create_task', label: t('superadmin.customers.playbooks.actionTypes.createTask'), icon: '✅' },
    { id: 'notify_csm', label: t('superadmin.customers.playbooks.actionTypes.notifyCsm'), icon: '👤' },
    { id: 'schedule_call', label: t('superadmin.customers.playbooks.actionTypes.scheduleCall'), icon: '📞' },
    { id: 'update_health', label: t('superadmin.customers.playbooks.actionTypes.updateHealth'), icon: '📊' },
    { id: 'custom', label: t('superadmin.customers.playbooks.actionTypes.custom'), icon: '⚙️' },
  ];
  const triggerTypes = [
    { id: 'onboarding_complete', label: t('superadmin.customers.playbooks.triggerTypes.onboardingComplete') },
    { id: 'trial_ending', label: t('superadmin.customers.playbooks.triggerTypes.trialEnding') },
    { id: 'low_engagement', label: t('superadmin.customers.playbooks.triggerTypes.lowEngagement') },
    { id: 'health_score_drop', label: t('superadmin.customers.playbooks.triggerTypes.healthScoreDrop') },
    { id: 'subscription_change', label: t('superadmin.customers.playbooks.triggerTypes.subscriptionChange') },
    { id: 'milestone_reached', label: t('superadmin.customers.playbooks.triggerTypes.milestoneReached') },
  ];
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [actions, setActions] = useState<PlaybookAction[]>([]);
  const [stats, setStats] = useState<PlaybookStats | null>(null);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExecuteModal, setShowExecuteModal] = useState(false);

  const [newPlaybook, setNewPlaybook] = useState({
    name: '',
    description: '',
    triggerConditions: { type: 'onboarding_complete', conditions: {} },
    actions: [] as { type: string; config: Record<string, any> }[],
  });

  const [executeOrgId, setExecuteOrgId] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [playbooksData, actionsData, statsData] = await Promise.all([
        Api.getSuccessPlaybooks(),
        Api.getSuccessActions(),
        Api.getPlaybookStats(),
      ]);
      setPlaybooks(playbooksData || []);
      setActions(actionsData || []);
      setStats(statsData as any);
    } catch (error) {
      console.error('Failed to fetch playbook data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlaybook = (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
  };

  const handleCreatePlaybook = async () => {
    if (!newPlaybook.name) return;

    try {
      await Api.createSuccessPlaybook(newPlaybook);
      setShowCreateModal(false);
      setNewPlaybook({
        name: '',
        description: '',
        triggerConditions: { type: 'onboarding_complete', conditions: {} },
        actions: [],
      });
      fetchData();
    } catch (error) {
      console.error('Failed to create playbook:', error);
    }
  };

  const handleDeletePlaybook = async (playbookId: string) => {
    if (!confirm(t('superadmin.customers.playbooks.confirmDelete'))) return;

    try {
      await Api.deleteSuccessPlaybook(playbookId);
      if (selectedPlaybook?.id === playbookId) {
        setSelectedPlaybook(null);
      }
      fetchData();
    } catch (error) {
      console.error('Failed to delete playbook:', error);
    }
  };

  const handleExecutePlaybook = async () => {
    if (!selectedPlaybook || !executeOrgId) return;

    setIsExecuting(true);
    try {
      await Api.executeSuccessPlaybook(selectedPlaybook.id, executeOrgId);
      setShowExecuteModal(false);
      setExecuteOrgId('');
      fetchData();
    } catch (error) {
      console.error('Failed to execute playbook:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const addActionToPlaybook = (actionType: string) => {
    setNewPlaybook({
      ...newPlaybook,
      actions: [...newPlaybook.actions, { type: actionType, config: {} }],
    });
  };

  const removeActionFromPlaybook = (index: number) => {
    const newActions = [...newPlaybook.actions];
    newActions.splice(index, 1);
    setNewPlaybook({ ...newPlaybook, actions: newActions });
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'send_email':
        return t('superadmin.customers.playbooks.actionTypes.sendEmail');
      case 'create_task':
        return t('superadmin.customers.playbooks.actionTypes.createTask');
      case 'notify_csm':
        return t('superadmin.customers.playbooks.actionTypes.notifyCsm');
      case 'schedule_call':
        return t('superadmin.customers.playbooks.actionTypes.scheduleCall');
      case 'update_health':
        return t('superadmin.customers.playbooks.actionTypes.updateHealth');
      case 'custom':
        return t('superadmin.customers.playbooks.actionTypes.custom');
      default:
        return type;
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'send_email':
        return '📧';
      case 'create_task':
        return '✅';
      case 'notify_csm':
        return '👤';
      case 'schedule_call':
        return '📞';
      case 'update_health':
        return '📊';
      case 'custom':
        return '⚙️';
      default:
        return '⚡';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('superadmin.customers.playbooks.title')}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {t('superadmin.customers.playbooks.subtitle')}
            </p>
          </div>
          <InfoButton cardId="superadmin-playbooks" />
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('superadmin.customers.playbooks.newPlaybook')}
        </button>
      </div>

      {/* Overview Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats.total_playbooks}
                </p>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {t('superadmin.customers.playbooks.stats.totalPlaybooks')}
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
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats.active_playbooks}
                </p>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {t('superadmin.customers.playbooks.stats.active')}
                </span>
              </div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Activity className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats.total_actions}
                </p>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {t('superadmin.customers.playbooks.stats.totalActions')}
                </span>
              </div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Target className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats.completed_actions}
                </p>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {t('superadmin.customers.playbooks.stats.completedActions')}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Playbooks List */}
        <div className="col-span-4">
          <Card padding="sm">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {t('superadmin.customers.playbooks.playbooks')} ({playbooks.length})
            </h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {playbooks.length === 0 ? (
                <div className="text-center py-8">
                  <Zap className="w-12 h-12 text-gray-600 dark:text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    {t('superadmin.customers.playbooks.empty.noPlaybooks')}
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="text-blue-400 hover:text-blue-300 text-sm mt-2"
                  >
                    {t('superadmin.customers.playbooks.empty.createFirst')}
                  </button>
                </div>
              ) : (
                playbooks.map((playbook) => {
                  let actionsCount = 0;
                  try {
                    actionsCount = JSON.parse(playbook.actions_json || '[]').length;
                  } catch {}

                  return (
                    <div
                      key={playbook.id}
                      onClick={() => handleSelectPlaybook(playbook)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedPlaybook?.id === playbook.id
                          ? 'bg-blue-600/20 border border-blue-500'
                          : 'bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Zap
                            className={`w-4 h-4 ${
                              playbook.is_active
                                ? 'text-green-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          />
                          <span className="text-slate-900 dark:text-white font-medium">
                            {playbook.name}
                          </span>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            playbook.is_active
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {playbook.is_active
                            ? t('superadmin.customers.playbooks.status.active')
                            : t('superadmin.customers.playbooks.status.inactive')}
                        </span>
                      </div>
                      {playbook.description && (
                        <p className="text-slate-600 dark:text-slate-400 text-xs mt-1 truncate">
                          {playbook.description}
                        </p>
                      )}
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">
                        {t('superadmin.customers.playbooks.actionsCount', { count: actionsCount })}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Playbook Details */}
        <div className="col-span-8">
          {selectedPlaybook ? (
            <div className="space-y-4">
              {/* Playbook Header */}
              <Card padding="sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                        {selectedPlaybook.name}
                      </h3>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          selectedPlaybook.is_active
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {selectedPlaybook.is_active
                          ? t('superadmin.customers.playbooks.status.active')
                          : t('superadmin.customers.playbooks.status.inactive')}
                      </span>
                    </div>
                    {selectedPlaybook.description && (
                      <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                        {selectedPlaybook.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowExecuteModal(true)}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      {t('superadmin.customers.playbooks.execute')}
                    </button>
                    <button
                      onClick={() => handleDeletePlaybook(selectedPlaybook.id)}
                      className="p-2 text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Trigger Conditions */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Trigger Conditions
                  </h4>
                  <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-3">
                    <pre className="text-xs text-slate-800 dark:text-slate-200 overflow-x-auto">
                      {JSON.stringify(
                        JSON.parse(selectedPlaybook.trigger_conditions_json || '{}'),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </div>

                {/* Actions */}
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Actions
                  </h4>
                  <div className="space-y-2">
                    {(() => {
                      try {
                        const actions = JSON.parse(selectedPlaybook.actions_json || '[]');
                        return actions.length === 0 ? (
                          <p className="text-slate-600 dark:text-slate-400 text-sm">
                            No actions defined
                          </p>
                        ) : (
                          actions.map((action: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg"
                            >
                              <span className="text-xl">{getActionIcon(action.type)}</span>
                              <div>
                                <p className="text-slate-900 dark:text-white font-medium">
                                  {getActionLabel(action.type)}
                                </p>
                                {action.config && Object.keys(action.config).length > 0 && (
                                  <p className="text-xs text-slate-600 dark:text-slate-400">
                                    {JSON.stringify(action.config)}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))
                        );
                      } catch {
                        return (
                          <p className="text-slate-600 dark:text-slate-400 text-sm">
                            Invalid actions data
                          </p>
                        );
                      }
                    })()}
                  </div>
                </div>
              </Card>

              {/* Recent Executions */}
              <Card padding="sm">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Recent Executions
                </h4>
                {actions.filter((a) => a.playbook_id === selectedPlaybook.id).length === 0 ? (
                  <p className="text-slate-600 dark:text-slate-400 text-sm text-center py-4">
                    No executions yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {actions
                      .filter((a) => a.playbook_id === selectedPlaybook.id)
                      .slice(0, 10)
                      .map((action) => (
                        <div
                          key={action.id}
                          className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Building2 className="w-4 h-4 text-blue-400" />
                            <div>
                              <p className="text-slate-900 dark:text-white text-sm">
                                {action.organization_name || action.organization_id}
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {action.action_type}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                action.status === 'completed'
                                  ? 'bg-green-500/20 text-green-400'
                                  : action.status === 'failed'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-yellow-500/20 text-yellow-400'
                              }`}
                            >
                              {action.status}
                            </span>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              {formatDate(action.executed_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <Card padding="lg">
              <div className="flex flex-col items-center justify-center h-64">
                <Zap className="w-16 h-16 text-gray-600 dark:text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                  {t('superadmin.customers.playbooks.empty.selectTitle')}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-center">
                  {t('superadmin.customers.playbooks.empty.selectSubtitle')}
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Create Playbook Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-navy-700">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {t('superadmin.customers.playbooks.modals.createTitle')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('superadmin.customers.playbooks.fields.name')}
                </label>
                <input
                  type="text"
                  value={newPlaybook.name}
                  onChange={(e) => setNewPlaybook({ ...newPlaybook, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                  placeholder={t('superadmin.customers.playbooks.placeholders.name')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('superadmin.customers.playbooks.fields.description')}
                </label>
                <textarea
                  value={newPlaybook.description}
                  onChange={(e) => setNewPlaybook({ ...newPlaybook, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('superadmin.customers.playbooks.fields.trigger')}
                </label>
                <select
                  value={newPlaybook.triggerConditions.type}
                  onChange={(e) =>
                    setNewPlaybook({
                      ...newPlaybook,
                      triggerConditions: {
                        ...newPlaybook.triggerConditions,
                        type: e.target.value,
                      },
                    })
                  }
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                >
                  {triggerTypes.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('superadmin.customers.playbooks.fields.actions')}
                </label>
                <div className="space-y-2 mb-2">
                  {newPlaybook.actions.map((action, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span>{getActionIcon(action.type)}</span>
                        <span className="text-slate-900 dark:text-white">
                          {getActionLabel(action.type)}
                        </span>
                      </div>
                      <button
                        onClick={() => removeActionFromPlaybook(idx)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {actionTypes.map((at) => (
                    <button
                      key={at.id}
                      onClick={() => addActionToPlaybook(at.id)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-navy-900 dark:hover:bg-navy-700 rounded-lg text-sm text-slate-900 dark:text-white transition-colors"
                    >
                      {at.icon} {at.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreatePlaybook}
                disabled={!newPlaybook.name || newPlaybook.actions.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {t('superadmin.customers.playbooks.modals.createCta')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execute Modal */}
      {showExecuteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-md border border-slate-200 dark:border-navy-700">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {t('superadmin.customers.playbooks.modals.executeTitle')}
            </h3>
            <div className="space-y-4">
              <p className="text-slate-600 dark:text-slate-400">
                {t('superadmin.customers.playbooks.modals.executeSubtitle', {
                  name: selectedPlaybook?.name || '',
                })}
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('superadmin.customers.playbooks.fields.organizationId')}
                </label>
                <input
                  type="text"
                  value={executeOrgId}
                  onChange={(e) => setExecuteOrgId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                  placeholder={t('superadmin.customers.playbooks.placeholders.organizationId')}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowExecuteModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleExecutePlaybook}
                disabled={!executeOrgId || isExecuting}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isExecuting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t('superadmin.customers.playbooks.modals.executeCta')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSuccessPlaybooksView;
