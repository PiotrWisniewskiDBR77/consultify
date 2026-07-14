/**
 * AI Budgets View
 *
 * Dashboard for managing AI spending budgets, alerts, and model permissions.
 * Enterprise-grade cost control for AI features.
 */
import {
  AlertTriangle,
  Bell,
  Bot,
  Check,
  Clock,
  DollarSign,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../components/Admin/AdminState';
import TeresaMark from '../../components/shared/TeresaMark';
import { LoadingState } from '../../components/ui/primitives';
import { api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';

interface Budget {
  id: string;
  organizationId: string;
  userId: string | null;
  userEmail: string | null;
  budgetType: 'tokens' | 'cost' | 'requests';
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total';
  budgetLimit: number;
  currentUsage: number;
  warningThreshold: number;
  hardLimit: boolean;
  isActive: boolean;
  createdAt: string;
}

interface Alert {
  id: string;
  alertType: 'warning' | 'exceeded' | 'anomaly' | 'spike';
  title: string;
  message: string;
  status: 'active' | 'acknowledged' | 'dismissed';
  currentValue: number;
  thresholdValue: number;
  percentage: number;
  createdAt: string;
}

interface ModelPermission {
  id: string;
  scopeType: string;
  scopeId: string;
  modelId: string;
  modelProvider: string;
  isAllowed: boolean;
  maxTokensPerRequest: number | null;
  dailyTokenLimit: number | null;
}

interface UsageStats {
  budgets: {
    id: string;
    type: string;
    period: string;
    limit: number;
    current: number;
    remaining: number;
    percentUsed: number;
  }[];
  alertCount: number;
}

interface AIBudgetSnapshot {
  budgets: Budget[];
  alerts: Alert[];
  modelPermissions: ModelPermission[];
  usageStats: UsageStats | null;
}

type TabType = 'overview' | 'budgets' | 'alerts' | 'models';

const MODEL_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3.5-sonnet'],
  },
  { id: 'google', name: 'Google', models: ['gemini-pro', 'gemini-pro-vision'] },
];

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const getListPayload = <T,>(value: unknown, keys: string[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const candidates = [value, data, nestedData].filter(isRecord);
  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as T[];
    }
  }
  return [];
};

const hasListShape = (value: unknown, keys: string[]) => {
  if (Array.isArray(value)) return true;
  if (!isRecord(value)) return false;
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;

  return (
    Array.isArray(value.data) ||
    keys.some((key) => Array.isArray(value[key])) ||
    Boolean(
      data &&
      (Array.isArray(data.data) ||
        keys.some((key) => Array.isArray(data[key])) ||
        Boolean(nestedData && keys.some((key) => Array.isArray(nestedData[key]))))
    )
  );
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
};

const getCreatedId = (result: unknown, key: string) => {
  if (!result || typeof result !== 'object') return '';
  const response = result as { data?: unknown };
  const data = response.data && typeof response.data === 'object' ? response.data : response;
  const payload = data as Record<string, unknown>;
  const nested = payload[key] && typeof payload[key] === 'object' ? payload[key] : null;
  const nestedData =
    payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : null;
  return String(
    payload.id ||
      (nested as Record<string, unknown> | null)?.id ||
      nestedData?.id ||
      (nestedData?.[key] as { id?: unknown } | undefined)?.id ||
      ''
  );
};

const normalizeUsageStats = (value: unknown): UsageStats | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<UsageStats>;
  return {
    budgets: asArray<UsageStats['budgets'][number]>(raw.budgets).map((budget) => ({
      ...budget,
      limit: safeNumber(budget.limit),
      current: safeNumber(budget.current),
      remaining: safeNumber(budget.remaining),
      percentUsed: safeNumber(budget.percentUsed),
    })),
    alertCount: safeNumber(raw.alertCount),
  };
};

const normalizeModelCosts = (value: unknown): Record<string, { input: number; output: number }> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, { input?: unknown; output?: unknown }>).map(
      ([model, costs]) => [
        model,
        { input: safeNumber(costs?.input), output: safeNumber(costs?.output) },
      ]
    )
  );
};

const AIBudgetsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(false);

  // Data state
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [modelPermissions, setModelPermissions] = useState<ModelPermission[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [modelCosts, setModelCosts] = useState<Record<string, { input: number; output: number }>>(
    {}
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // UI state
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [newBudget, setNewBudget] = useState<{
    budgetType: Budget['budgetType'];
    period: Exclude<Budget['period'], 'total'>;
    budgetLimit: number;
    warningThreshold: number;
    hardLimit: boolean;
  }>({
    budgetType: 'cost',
    period: 'monthly',
    budgetLimit: 100,
    warningThreshold: 0.8,
    hardLimit: true,
  });
  const [newModelPermission, setNewModelPermission] = useState({
    modelId: '',
    modelProvider: 'openai',
    scopeType: 'organization',
    scopeId: '',
    isAllowed: true,
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [budgetsRes, alertsRes, statsRes, costsRes, permissionsRes] = await Promise.all([
        api.get('/ai-budgets/budgets'),
        api.get('/ai-budgets/alerts?status=active'),
        api.get('/ai-budgets/stats'),
        api.get('/ai-budgets/model-costs'),
        api.get('/ai-budgets/model-permissions'),
      ]);

      const budgetsData = getListPayload<Budget>(budgetsRes, ['budgets']);
      const alertsData = getListPayload<Alert>(alertsRes, ['alerts']);
      const permissionsData = getListPayload<ModelPermission>(permissionsRes, [
        'permissions',
        'modelPermissions',
      ]);
      if (!hasListShape(budgetsRes, ['budgets'])) {
        throw new Error('AI budgets response was not a list');
      }
      if (!hasListShape(alertsRes, ['alerts'])) {
        throw new Error('AI budget alerts response was not a list');
      }
      if (!hasListShape(permissionsRes, ['permissions', 'modelPermissions'])) {
        throw new Error('Model permissions response was not a list');
      }
      const statsData = normalizeUsageStats(getObjectPayload(statsRes));
      setBudgets(budgetsData);
      setAlerts(alertsData);
      setUsageStats(statsData);
      setModelCosts(normalizeModelCosts(getObjectPayload(costsRes)));
      setModelPermissions(permissionsData);
      return {
        budgets: budgetsData,
        alerts: alertsData,
        modelPermissions: permissionsData,
        usageStats: statsData,
      } satisfies AIBudgetSnapshot;
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to load AI budgets');
      setLoadError(message);
      setBudgets([]);
      setAlerts([]);
      setUsageStats(null);
      setModelCosts({});
      setModelPermissions([]);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Budget CRUD
  const handleCreateBudget = async () => {
    if (!Number.isFinite(newBudget.budgetLimit) || newBudget.budgetLimit <= 0) {
      toast.error('Budget limit must be greater than zero');
      return;
    }
    if (
      !Number.isFinite(newBudget.warningThreshold) ||
      newBudget.warningThreshold < 0 ||
      newBudget.warningThreshold > 1
    ) {
      toast.error('Warning threshold must be between 0 and 100%');
      return;
    }
    setActionError(null);
    try {
      const expected = { ...newBudget };
      let createdId = '';
      if (editingBudget) {
        await api.put(`/ai-budgets/budgets/${editingBudget.id}`, newBudget);
      } else {
        const result = await api.post('/ai-budgets/budgets', newBudget);
        createdId = getCreatedId(result, 'budget');
        if (!createdId) {
          throw new Error('AI budget creation response was incomplete');
        }
      }
      const refreshed = await fetchData();
      const confirmed = editingBudget
        ? refreshed?.budgets.some(
            (budget) =>
              budget.id === editingBudget.id &&
              budget.budgetType === expected.budgetType &&
              budget.period === expected.period &&
              Number(budget.budgetLimit) === Number(expected.budgetLimit)
          )
        : refreshed?.budgets.some(
            (budget) =>
              budget.id === createdId &&
              budget.budgetType === expected.budgetType &&
              budget.period === expected.period &&
              Number(budget.budgetLimit) === Number(expected.budgetLimit)
          );
      if (!confirmed) {
        throw new Error(
          editingBudget
            ? 'AI budget update was not confirmed by the server'
            : 'AI budget creation was not confirmed by the server'
        );
      }
      toast.success(editingBudget ? 'Budget updated' : 'Budget created');
      setShowBudgetModal(false);
      setEditingBudget(null);
      setNewBudget({
        budgetType: 'cost',
        period: 'monthly',
        budgetLimit: 100,
        warningThreshold: 0.8,
        hardLimit: true,
      });
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to save budget');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!confirm('Delete this budget?')) return;
    setActionError(null);
    try {
      await api.delete(`/ai-budgets/budgets/${budgetId}`);
      const refreshed = await fetchData();
      if (!refreshed || refreshed.budgets.some((budget) => budget.id === budgetId)) {
        throw new Error('AI budget deletion was not confirmed by the server');
      }
      toast.success('Budget deleted');
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to delete budget');
      setActionError(message);
      toast.error(message);
    }
  };

  const openEditBudget = (budget: Budget) => {
    setEditingBudget(budget);
    setNewBudget({
      budgetType: budget.budgetType,
      period: budget.period === 'total' ? 'monthly' : budget.period,
      budgetLimit: Number(budget.budgetLimit) || 1,
      warningThreshold: Number(budget.warningThreshold) || 0.8,
      hardLimit: Boolean(budget.hardLimit),
    });
    setShowBudgetModal(true);
  };

  // Alert actions
  const handleAcknowledgeAlert = async (alertId: string) => {
    setActionError(null);
    try {
      await api.post(`/ai-budgets/alerts/${alertId}/acknowledge`, {});
      const refreshed = await fetchData();
      if (
        !refreshed ||
        refreshed.alerts.some((alert) => alert.id === alertId && alert.status !== 'acknowledged')
      ) {
        throw new Error('AI budget alert acknowledgement was not confirmed by the server');
      }
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to acknowledge alert');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    setActionError(null);
    try {
      await api.post(`/ai-budgets/alerts/${alertId}/dismiss`, {});
      const refreshed = await fetchData();
      if (!refreshed || refreshed.alerts.some((alert) => alert.id === alertId)) {
        throw new Error('AI budget alert dismissal was not confirmed by the server');
      }
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to dismiss alert');
      setActionError(message);
      toast.error(message);
    }
  };

  // Model permissions
  const handleSaveModelPermission = async () => {
    setActionError(null);
    try {
      const result = await api.post('/ai-budgets/model-permissions', newModelPermission);
      const createdId = getCreatedId(result, 'permission');
      if (!createdId) {
        throw new Error('Model permission creation response was incomplete');
      }
      const refreshed = await fetchData();
      if (
        !refreshed?.modelPermissions.some(
          (permission) =>
            permission.id === createdId &&
            permission.modelId === newModelPermission.modelId &&
            permission.modelProvider === newModelPermission.modelProvider &&
            permission.scopeType === newModelPermission.scopeType &&
            permission.isAllowed === newModelPermission.isAllowed
        )
      ) {
        throw new Error('Model permission creation was not confirmed by the server');
      }
      setShowModelModal(false);
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to save model permission');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleDeleteModelPermission = async (permissionId: string) => {
    if (!confirm('Remove this model restriction?')) return;
    setActionError(null);
    try {
      await api.delete(`/ai-budgets/model-permissions/${permissionId}`);
      const refreshed = await fetchData();
      if (
        !refreshed ||
        refreshed.modelPermissions.some((permission) => permission.id === permissionId)
      ) {
        throw new Error('Model permission deletion was not confirmed by the server');
      }
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to delete model permission');
      setActionError(message);
      toast.error(message);
    }
  };

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: TrendingUp },
    { id: 'budgets' as TabType, label: 'Budgets', icon: DollarSign },
    { id: 'alerts' as TabType, label: 'Alerts', icon: Bell },
    { id: 'models' as TabType, label: 'Model Access', icon: Bot },
  ];

  const formatCurrency = (value: number) => `$${safeNumber(value).toFixed(2)}`;
  const safePercent = (current: number, limit: number) => {
    const currentValue = Number(current);
    const limitValue = Number(limit);
    if (!Number.isFinite(currentValue) || !Number.isFinite(limitValue) || limitValue <= 0) return 0;
    return (currentValue / limitValue) * 100;
  };
  const formatTokens = (value: number) =>
    safeNumber(value) >= 1000000
      ? `${(safeNumber(value) / 1000000).toFixed(1)}M`
      : safeNumber(value) >= 1000
        ? `${(safeNumber(value) / 1000).toFixed(1)}K`
        : safeNumber(value);

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-primary-600/20 to-primary-700/10 border border-primary-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="text-primary-400" size={24} />
            <span className="text-xs text-primary-300 bg-primary-500/20 px-2 py-0.5 rounded">
              This Month
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(usageStats?.budgets.find((b) => b.type === 'cost')?.current || 0)}
          </div>
          <div className="text-sm text-primary-800 dark:text-primary-300">Total AI Spending</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/10 border border-emerald-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Zap className="text-emerald-400" size={24} />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatTokens(usageStats?.budgets.find((b) => b.type === 'tokens')?.current || 0)}
          </div>
          <div className="text-sm text-emerald-800 dark:text-emerald-300">Tokens Used</div>
        </div>

        <div className="bg-gradient-to-br from-amber-600/20 to-amber-700/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="text-amber-400" size={24} />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {usageStats?.alertCount || 0}
          </div>
          <div className="text-sm text-amber-300">Active Alerts</div>
        </div>

        <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Target className="text-blue-400" size={24} />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{budgets.length}</div>
          <div className="text-sm text-blue-300">Active Budgets</div>
        </div>
      </div>

      {/* Budget Progress */}
      <div className="bg-white dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Budget Utilization
        </h3>
        <div className="space-y-4">
          {usageStats?.budgets.map((budget) => (
            <div key={budget.id}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-700 dark:text-gray-200 capitalize">
                  {budget.type} ({budget.period})
                </span>
                <span className="text-slate-600 dark:text-gray-400">
                  {budget.type === 'cost'
                    ? formatCurrency(budget.current)
                    : formatTokens(budget.current)}{' '}
                  /
                  {budget.type === 'cost'
                    ? formatCurrency(budget.limit)
                    : formatTokens(budget.limit)}
                </span>
              </div>
              <div className="h-3 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    budget.percentUsed >= 100
                      ? 'bg-danger-500'
                      : budget.percentUsed >= 80
                        ? 'bg-amber-500'
                        : 'bg-c-surface'
                  }`}
                  style={{ width: `${Math.min(100, budget.percentUsed)}%` }}
                />
              </div>
            </div>
          )) || (
            <p className="text-slate-500 dark:text-gray-400 text-center py-4">
              No budgets configured
            </p>
          )}
        </div>
      </div>

      {/* Recent Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Recent Alerts
          </h3>
          <div className="space-y-3">
            {alerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  alert.alertType === 'exceeded'
                    ? 'bg-danger-500/10 border border-danger-500/30'
                    : alert.alertType === 'warning'
                      ? 'bg-amber-500/10 border border-amber-500/30'
                      : 'bg-blue-500/10 border border-blue-500/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle
                    className={
                      alert.alertType === 'exceeded'
                        ? 'text-danger-400'
                        : alert.alertType === 'warning'
                          ? 'text-amber-400'
                          : 'text-blue-400'
                    }
                    size={20}
                  />
                  <div>
                    <div className="text-slate-900 dark:text-white font-medium">{alert.title}</div>
                    <div className="text-sm text-slate-600 dark:text-gray-400">{alert.message}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleDismissAlert(alert.id)}
                  className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white p-1"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model Costs Reference */}
      <div className="bg-white dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Model Pricing (per 1K tokens)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(modelCosts)
            .slice(0, 8)
            .map(([model, costs]) => (
              <div
                key={model}
                className="bg-slate-50 dark:bg-gray-900/50 rounded-lg p-3 border border-slate-200/60 dark:border-transparent"
              >
                <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {model}
                </div>
                <div className="text-xs text-slate-600 dark:text-gray-400 mt-1">
                  In: ${costs.input.toFixed(4)} • Out: ${costs.output.toFixed(4)}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );

  const renderBudgets = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Spending Budgets</h3>
          <p className="text-sm text-slate-600 dark:text-gray-400">
            Set limits on AI usage by cost, tokens, or requests
          </p>
        </div>
        <button
          onClick={() => setShowBudgetModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
        >
          <Plus size={18} />
          Create Budget
        </button>
      </div>

      {loadError && (
        <div className="rounded-lg border border-danger-200 dark:border-danger-500/20 bg-danger-50 dark:bg-danger-500/10 p-4 text-sm text-danger-700 dark:text-danger-300">
          {loadError}
        </div>
      )}

      {budgets.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800/50 rounded-xl border border-slate-200 dark:border-gray-700">
          <DollarSign className="mx-auto text-slate-600 dark:text-gray-400 mb-4" size={48} />
          <p className="text-slate-700 dark:text-gray-300">No budgets configured</p>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Create a budget to control AI spending
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {budgets.map((budget) => {
            const percentUsed = safePercent(budget.currentUsage, budget.budgetLimit);
            return (
              <div
                key={budget.id}
                className="bg-white dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        budget.budgetType === 'cost'
                          ? 'bg-primary-500/20'
                          : budget.budgetType === 'tokens'
                            ? 'bg-emerald-500/20'
                            : 'bg-blue-500/20'
                      }`}
                    >
                      {budget.budgetType === 'cost' ? (
                        <DollarSign className="text-primary-400" size={20} />
                      ) : budget.budgetType === 'tokens' ? (
                        <Zap className="text-emerald-400" size={20} />
                      ) : (
                        <Clock className="text-blue-400" size={20} />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-white capitalize">
                        {budget.budgetType} Budget
                        {budget.userEmail && (
                          <span className="text-slate-600 dark:text-gray-400 ml-2">
                            ({budget.userEmail})
                          </span>
                        )}
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-gray-400 capitalize">
                        {budget.period}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {budget.hardLimit && (
                      <span className="text-xs text-danger-400 bg-danger-500/10 px-2 py-1 rounded">
                        Hard Limit
                      </span>
                    )}
                    <button
                      onClick={() => openEditBudget(budget)}
                      aria-label={`Edit budget ${budget.id}`}
                      className="p-2 text-slate-500 hover:text-primary-500 hover:bg-primary-500/10 rounded-lg transition-colors"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteBudget(budget.id)}
                      aria-label={`Delete budget ${budget.id}`}
                      className="p-2 text-danger-400 hover:text-danger-300 hover:bg-danger-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-gray-400">
                      {budget.budgetType === 'cost'
                        ? formatCurrency(budget.currentUsage)
                        : formatTokens(budget.currentUsage)}{' '}
                      used
                    </span>
                    <span className="text-slate-600 dark:text-gray-400">
                      Limit:{' '}
                      {budget.budgetType === 'cost'
                        ? formatCurrency(budget.budgetLimit)
                        : formatTokens(budget.budgetLimit)}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        percentUsed >= 100
                          ? 'bg-danger-500'
                          : percentUsed >= budget.warningThreshold * 100
                            ? 'bg-amber-500'
                            : 'bg-c-surface'
                      }`}
                      style={{ width: `${Math.min(100, percentUsed)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 dark:text-gray-400">
                    <span>{percentUsed.toFixed(1)}% used</span>
                    <span>Warning at {budget.warningThreshold * 100}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {editingBudget ? 'Edit Budget' : 'Create Budget'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-700 dark:text-gray-300 mb-1">
                  Budget Type
                </label>
                <select
                  value={newBudget.budgetType}
                  onChange={(e) =>
                    setNewBudget({
                      ...newBudget,
                      budgetType: e.target.value as Budget['budgetType'],
                    })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="cost">Cost ($)</option>
                  <option value="tokens">Tokens</option>
                  <option value="requests">Requests</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-700 dark:text-gray-300 mb-1">
                  Period
                </label>
                <select
                  value={newBudget.period}
                  onChange={(e) =>
                    setNewBudget({
                      ...newBudget,
                      period: e.target.value as Exclude<Budget['period'], 'total'>,
                    })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-700 dark:text-gray-300 mb-1">
                  Limit ({newBudget.budgetType === 'cost' ? '$' : newBudget.budgetType})
                </label>
                <input
                  type="number"
                  aria-label="Budget Limit"
                  value={newBudget.budgetLimit}
                  onChange={(e) =>
                    setNewBudget({ ...newBudget, budgetLimit: parseFloat(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 dark:text-gray-300 mb-1">
                  Warning Threshold (%)
                </label>
                <input
                  type="number"
                  aria-label="Warning Threshold"
                  value={newBudget.warningThreshold * 100}
                  onChange={(e) =>
                    setNewBudget({
                      ...newBudget,
                      warningThreshold: parseFloat(e.target.value) / 100,
                    })
                  }
                  min={0}
                  max={100}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newBudget.hardLimit}
                  onChange={(e) => setNewBudget({ ...newBudget, hardLimit: e.target.checked })}
                  className="rounded border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-primary-600"
                />
                <span className="text-sm text-slate-700 dark:text-gray-200">
                  Hard limit (block requests when exceeded)
                </span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowBudgetModal(false);
                  setEditingBudget(null);
                }}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBudget}
                className="flex-1 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
              >
                {editingBudget ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderAlerts = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Spending Alerts</h3>
          <p className="text-sm text-slate-600 dark:text-gray-400">
            Notifications about budget thresholds and anomalies
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded-lg transition-colors"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800/50 rounded-xl border border-slate-200 dark:border-gray-700">
          <Bell className="mx-auto text-slate-600 dark:text-gray-400 mb-4" size={48} />
          <p className="text-slate-700 dark:text-gray-300">No active alerts</p>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Alerts will appear when budgets are at risk
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white dark:bg-gray-800/50 border rounded-xl p-4 ${
                alert.alertType === 'exceeded'
                  ? 'border-danger-500/50'
                  : alert.alertType === 'warning'
                    ? 'border-amber-500/50'
                    : 'border-slate-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      alert.alertType === 'exceeded'
                        ? 'bg-danger-500/20'
                        : alert.alertType === 'warning'
                          ? 'bg-amber-500/20'
                          : 'bg-blue-500/20'
                    }`}
                  >
                    <AlertTriangle
                      className={
                        alert.alertType === 'exceeded'
                          ? 'text-danger-400'
                          : alert.alertType === 'warning'
                            ? 'text-amber-400'
                            : 'text-blue-400'
                      }
                      size={20}
                    />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-white">{alert.title}</h4>
                    <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-gray-400">
                      <span>{formatDateTime(alert.createdAt)}</span>
                      <span>{safeNumber(alert.percentage).toFixed(1)}% of limit</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {alert.status === 'active' && (
                    <button
                      onClick={() => handleAcknowledgeAlert(alert.id)}
                      aria-label={`Acknowledge alert ${alert.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded-lg transition-colors"
                    >
                      <Check size={14} />
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => handleDismissAlert(alert.id)}
                    aria-label={`Dismiss alert ${alert.id}`}
                    className="p-1.5 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderModels = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Model Access Control
          </h3>
          <p className="text-sm text-slate-600 dark:text-gray-400">
            Restrict which AI models users can access
          </p>
        </div>
        <button
          onClick={() => setShowModelModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
        >
          <Plus size={18} />
          Add Restriction
        </button>
      </div>

      {modelPermissions.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800/50 rounded-xl border border-slate-200 dark:border-gray-700">
          <TeresaMark className="mx-auto text-slate-600 dark:text-gray-400 mb-4" size={48} />
          <p className="text-slate-700 dark:text-gray-300">No model restrictions configured</p>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            All models are accessible by default
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <table
            /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full"
          >
            <thead className="bg-slate-50 dark:bg-gray-900/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-gray-300">
                  Model
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-gray-300">
                  Scope
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-gray-300">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-gray-300">
                  Limits
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-700 dark:text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
              {modelPermissions.map((perm) => (
                <tr key={perm.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-white">{perm.modelId}</div>
                    <div className="text-sm text-slate-500 dark:text-gray-400">
                      {perm.modelProvider}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-700 dark:text-gray-200 capitalize">
                      {perm.scopeType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        perm.isAllowed
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-danger-500/20 text-danger-300'
                      }`}
                    >
                      {perm.isAllowed ? 'Allowed' : 'Blocked'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-gray-400">
                    {perm.maxTokensPerRequest &&
                      `Max: ${formatTokens(perm.maxTokensPerRequest)}/req`}
                    {perm.dailyTokenLimit && `, ${formatTokens(perm.dailyTokenLimit)}/day`}
                    {!perm.maxTokensPerRequest && !perm.dailyTokenLimit && '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDeleteModelPermission(perm.id)}
                      aria-label={`Delete model permission ${perm.id}`}
                      className="p-2 text-danger-400 hover:text-danger-300 hover:bg-danger-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Model Permission Modal */}
      {showModelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Add Model Restriction
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-700 dark:text-gray-300 mb-1">
                  Provider
                </label>
                <select
                  value={newModelPermission.modelProvider}
                  onChange={(e) =>
                    setNewModelPermission({
                      ...newModelPermission,
                      modelProvider: e.target.value,
                      modelId: '',
                    })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white"
                >
                  {MODEL_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-700 dark:text-gray-300 mb-1">
                  Model
                </label>
                <select
                  value={newModelPermission.modelId}
                  onChange={(e) =>
                    setNewModelPermission({ ...newModelPermission, modelId: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">Select a model</option>
                  {MODEL_PROVIDERS.find(
                    (p) => p.id === newModelPermission.modelProvider
                  )?.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-700 dark:text-gray-300 mb-1">
                  Scope
                </label>
                <select
                  value={newModelPermission.scopeType}
                  onChange={(e) =>
                    setNewModelPermission({ ...newModelPermission, scopeType: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="organization">Organization</option>
                  <option value="role">Role</option>
                  <option value="user">User</option>
                </select>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newModelPermission.isAllowed}
                  onChange={(e) =>
                    setNewModelPermission({ ...newModelPermission, isAllowed: e.target.checked })
                  }
                  className="rounded border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-primary-600"
                />
                <span className="text-sm text-slate-700 dark:text-gray-200">
                  Allow access to this model
                </span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModelModal(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModelPermission}
                disabled={!newModelPermission.modelId}
                className="flex-1 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">AI Budget Controls</h2>
          <p className="text-slate-600 dark:text-gray-400 mt-1">
            Manage AI spending limits and model access
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-gray-700">
        <div className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon size={18} />
                {tab.label}
                {tab.id === 'alerts' && alerts.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-danger-500 text-white text-xs rounded-full">
                    {alerts.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-danger-600 dark:text-danger-300"
        >
          {actionError}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingState variant="spinner" className="py-12" />
      ) : loadError ? (
        <div className="bg-white dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 rounded-xl p-6">
          <DegradedState title="AI budget controls unavailable" description={loadError} />
        </div>
      ) : (
        <>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'budgets' && renderBudgets()}
          {activeTab === 'alerts' && renderAlerts()}
          {activeTab === 'models' && renderModels()}
        </>
      )}
    </div>
  );
};

export default AIBudgetsView;
