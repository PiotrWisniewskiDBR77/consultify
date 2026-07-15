/**
 * ModelRegistryTab - Development > Model Registry
 * NEW: Model management, versioning, and comparison
 */

import { Activity, Check, Cpu, Database, Edit, Eye, Plus, RefreshCw, Search } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '@/components/Admin/AdminState';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { normalizeApiErrorMessage } from '@/utils/apiError';

import { LoadingState } from '../../../../components/ui/primitives';

interface Model {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  version: string;
  status: 'active' | 'deprecated' | 'beta' | 'archived';
  tier: 'budget' | 'standard' | 'premium' | 'reasoning';
  capabilities: string[];
  contextWindow: number;
  maxOutputTokens?: number;
  costPer1k: number;
  avgLatency: number;
  successRate: number;
  lastUsed: string;
  totalRequests: number;
  createdAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && (isRecord(data.data) || Array.isArray(data.data)) ? data.data : data || value;
};

const asText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : fallback;

const toNumber = (value: unknown, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const normalizeProviders = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (!Array.isArray(payload)) {
    throw new Error('Model registry providers response was not a list');
  }
  return payload.filter(isRecord);
};

const normalizeHealthProviders = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !Array.isArray(payload.providers)) {
    throw new Error('Model registry health response was incomplete');
  }
  return payload.providers.filter(isRecord);
};

const normalizeUsageByProvider = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !Array.isArray(payload.byProvider)) {
    throw new Error('Model registry usage response was incomplete');
  }
  return payload.byProvider.filter(isRecord).map((row) => ({
    provider: asText(row.provider, ''),
    calls: toNumber(row.calls, 0),
  }));
};

export const ModelRegistryTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<Model[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProvider, setFilterProvider] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [providersPayload, healthPayload, usagePayload] = await Promise.all([
        Api.getLLMProviders(),
        Api.getLLMHealthDetailed(),
        Api.getLLMControlUsage(),
      ]);

      const providers = normalizeProviders(providersPayload);
      const healthProviders = normalizeHealthProviders(healthPayload);
      const usageByProvider = normalizeUsageByProvider(usagePayload);

      const callsByProvider = new Map(
        usageByProvider
          .map((r) => ({
            key: r.provider.toLowerCase(),
            calls: r.calls,
          }))
          .filter((r) => !!r.key)
          .map((r) => [r.key, r.calls] as const)
      );

      const healthById = new Map(healthProviders.map((p) => [asText(p.id, ''), p] as const));

      const normalizeTier = (tier: unknown): Model['tier'] => {
        const t = String(tier || 'standard').toLowerCase();
        if (t === 'budget') return 'budget';
        if (t === 'premium') return 'premium';
        if (t === 'reasoning') return 'reasoning';
        return 'standard';
      };

      const statusFromProvider = (p: Record<string, unknown>): Model['status'] => {
        if (!p) return 'archived';
        const isActive = p.is_active === 1 || p.is_active === true;
        return isActive ? 'active' : 'archived';
      };

      const nextModels: Model[] = providers.map((p) => {
        const id = asText(p.id, asText(p.model_id, asText(p.name, 'unknown-model')));
        const health = healthById.get(asText(p.id, ''));
        const respMs = toNumber(health?.responseTime ?? health?.latency, 0);
        const status = statusFromProvider(p);
        const isUp =
          asText(health?.status, '').toLowerCase() === 'healthy' ||
          asText(health?.status, '').toLowerCase() === 'degraded';
        const providerKey = asText(p.provider, '').toLowerCase();
        return {
          id,
          name: asText(p.name, asText(p.model_id, asText(p.provider, 'Unknown'))),
          provider: asText(p.provider, 'Unknown'),
          modelId: asText(p.model_id, ''),
          version: asText(p.updated_at, asText(p.created_at, '')),
          status,
          tier: normalizeTier(p.tier),
          capabilities: [],
          contextWindow: toNumber(p.context_window, 0),
          maxOutputTokens: undefined,
          costPer1k: toNumber(p.cost_per_1k, 0),
          avgLatency: respMs,
          successRate: isUp ? 100 : 0,
          lastUsed: asText(p.updated_at, asText(p.created_at, '')),
          totalRequests: callsByProvider.get(providerKey) || 0,
          createdAt: asText(p.created_at, ''),
        };
      });

      setModels(nextModels);
      trackFunnelEvent('model_registry_viewed', {
        source: 'superadmin_ai_platform',
        count: nextModels.length,
      });
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to load models');
      setModels([]);
      setSelectedModel(null);
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: Model['status']) => {
    const styles = {
      active: 'bg-emerald-500/10 text-emerald-500',
      deprecated: 'bg-amber-500/10 text-amber-500',
      beta: 'bg-primary-500/10 text-primary-500',
      archived: 'bg-slate-500/10 text-slate-500',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getTierBadge = (tier: Model['tier']) => {
    const styles = {
      budget: 'bg-blue-500/10 text-blue-500',
      standard: 'bg-slate-500/10 text-slate-600',
      premium: 'bg-amber-500/10 text-amber-500',
      reasoning: 'bg-primary-500/10 text-primary-500',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[tier]}`}>
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </span>
    );
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '—';
    if (!Number.isFinite(num)) return '—';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCostPer1k = (costPer1k: number) => {
    return `$${Number(costPer1k || 0).toFixed(4)}/1k`;
  };

  const filteredModels = models.filter((model) => {
    const matchesSearch =
      model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.modelId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.provider.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProvider = !filterProvider || model.provider === filterProvider;
    const matchesStatus = !filterStatus || model.status === filterStatus;
    return matchesSearch && matchesProvider && matchesStatus;
  });

  const providers = [...new Set(models.map((m) => m.provider))];

  const modelColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'model',
        label: 'Model',
        render: (row: TableRow) => {
          const model = row.__model as Model;
          return (
            <div>
              <div className="font-medium text-slate-900 dark:text-white">{model.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {model.modelId}
              </div>
            </div>
          );
        },
      },
      {
        id: 'provider',
        label: 'Provider',
        render: (row: TableRow) => (
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {(row.__model as Model).provider}
          </span>
        ),
      },
      {
        id: 'tier',
        label: 'Tier',
        render: (row: TableRow) => getTierBadge((row.__model as Model).tier),
      },
      {
        id: 'status',
        label: 'Status',
        render: (row: TableRow) => getStatusBadge((row.__model as Model).status),
      },
      {
        id: 'cost',
        label: 'Cost',
        render: (row: TableRow) => (
          <div className="text-xs">
            <div className="text-slate-700 dark:text-slate-300">
              {formatCostPer1k((row.__model as Model).costPer1k)}
            </div>
          </div>
        ),
      },
      {
        id: 'latency',
        label: 'Latency',
        render: (row: TableRow) => {
          const model = row.__model as Model;
          return (
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {model.avgLatency < 1000
                ? `${model.avgLatency}ms`
                : `${(model.avgLatency / 1000).toFixed(1)}s`}
            </span>
          );
        },
      },
      {
        id: 'success',
        label: 'Success',
        render: (row: TableRow) => {
          const model = row.__model as Model;
          return (
            <span
              className={`text-sm ${model.successRate >= 99 ? 'text-emerald-500' : model.successRate >= 95 ? 'text-amber-500' : 'text-danger-500'}`}
            >
              {model.successRate.toFixed(1)}%
            </span>
          );
        },
      },
      {
        id: 'requests',
        label: 'Requests',
        render: (row: TableRow) => (
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {formatNumber((row.__model as Model).totalRequests)}
          </span>
        ),
      },
      {
        id: 'actions',
        label: 'Actions',
        align: 'right',
        render: (row: TableRow) => {
          const model = row.__model as Model;
          return (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedModel(model)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
                title="View Details"
              >
                <Eye size={16} className="text-slate-600" />
              </button>
              <button
                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
                title="Edit"
              >
                <Edit size={16} className="text-slate-600" />
              </button>
            </div>
          );
        },
      },
    ],
    []
  );

  const modelRows: TableRow[] = useMemo(
    () =>
      filteredModels.map((model) => ({
        id: model.id,
        name: model.name,
        __model: model,
      })),
    [filteredModels]
  );

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database size={24} className="text-indigo-500" />
            Model Registry
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage, compare, and track all AI models across providers
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors">
          <Plus size={16} />
          Register Model
        </button>
      </div>

      {loadError ? (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <DegradedState title="Model registry unavailable" description={loadError} />
        </div>
      ) : null}

      {!loadError ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Database size={16} className="text-indigo-500" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Total Models</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {models.length}
              </div>
            </div>
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check size={16} className="text-emerald-500" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Active</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {models.filter((m) => m.status === 'active').length}
              </div>
            </div>
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Cpu size={16} className="text-primary-500" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Providers</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {providers.length}
              </div>
            </div>
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={16} className="text-blue-500" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Total Requests</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatNumber(models.reduce((sum, m) => sum + m.totalRequests, 0))}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search models..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>
            <select
              value={filterProvider}
              onChange={(e) => setFilterProvider(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
            >
              <option value="">All Providers</option>
              {providers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="beta">Beta</option>
              <option value="deprecated">Deprecated</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Models Table */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
            <StandardTable
              columns={modelColumns}
              data={modelRows}
              empty={{ title: 'No models found.' }}
              persistKey="superadmin.aiPlatform.modelRegistry"
              canvasClassName="p-0"
            />
          </div>
        </>
      ) : null}

      {/* Model Detail Modal */}
      {selectedModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-navy-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {selectedModel.name}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                    {selectedModel.modelId}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedModel(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Provider</div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {selectedModel.provider}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Version</div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {selectedModel.version}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Status</div>
                  {getStatusBadge(selectedModel.status)}
                </div>
                <div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Tier</div>
                  {getTierBadge(selectedModel.tier)}
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">Capabilities</div>
                <div className="flex flex-wrap gap-2">
                  {selectedModel.capabilities.length === 0 ? (
                    <span className="text-xs text-slate-500 dark:text-slate-400">—</span>
                  ) : (
                    selectedModel.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded text-xs"
                      >
                        {cap}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Context Window</div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {formatNumber(selectedModel.contextWindow)} tokens
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Max Output</div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {formatNumber(selectedModel.maxOutputTokens)} tokens
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 dark:bg-navy-900 rounded-lg p-4">
                  <div className="text-sm text-slate-500 dark:text-slate-400">Avg Latency</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {selectedModel.avgLatency < 1000
                      ? `${selectedModel.avgLatency}ms`
                      : `${(selectedModel.avgLatency / 1000).toFixed(1)}s`}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-navy-900 rounded-lg p-4">
                  <div className="text-sm text-slate-500 dark:text-slate-400">Success Rate</div>
                  <div className="text-xl font-bold text-emerald-500">
                    {selectedModel.successRate.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-navy-900 rounded-lg p-4">
                  <div className="text-sm text-slate-500 dark:text-slate-400">Total Requests</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {formatNumber(selectedModel.totalRequests)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelRegistryTab;
