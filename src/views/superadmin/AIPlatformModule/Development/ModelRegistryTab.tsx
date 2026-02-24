/**
 * ModelRegistryTab - Development > Model Registry
 * NEW: Model management, versioning, and comparison
 */

import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  Check,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  DollarSign,
  Edit,
  Eye,
  Filter,
  Info,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

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

export const ModelRegistryTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<Model[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProvider, setFilterProvider] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const [providersRes, healthRes, usageRes] = await Promise.all([
        fetch('/api/llm/providers', { headers }),
        fetch('/api/llm/health/detailed', { headers }),
        fetch('/api/llm/control/usage', { headers }),
      ]);

      const providersPayload = await providersRes.json().catch(() => []);
      const healthPayload = await healthRes.json().catch(() => ({}));
      const usagePayload = await usageRes.json().catch(() => ({}));

      const providers: any[] = Array.isArray(providersPayload) ? providersPayload : [];
      const healthProviders: any[] = Array.isArray(healthPayload?.providers) ? healthPayload.providers : [];
      const usageByProvider: Array<{ provider?: string; calls?: number }> = Array.isArray(usagePayload?.byProvider)
        ? usagePayload.byProvider
        : [];

      const callsByProvider = new Map(
        usageByProvider
          .map((r) => ({ key: String(r?.provider || '').toLowerCase(), calls: Number(r?.calls || 0) }))
          .filter((r) => !!r.key)
          .map((r) => [r.key, r.calls] as const)
      );

      const healthById = new Map(
        healthProviders.map((p) => [String(p?.id || ''), p] as const)
      );

      const normalizeTier = (tier: any): Model['tier'] => {
        const t = String(tier || 'standard').toLowerCase();
        if (t === 'budget') return 'budget';
        if (t === 'premium') return 'premium';
        if (t === 'reasoning') return 'reasoning';
        return 'standard';
      };

      const statusFromProvider = (p: any): Model['status'] => {
        if (!p) return 'archived';
        const isActive = p.is_active === 1 || p.is_active === true;
        return isActive ? 'active' : 'archived';
      };

      const nextModels: Model[] = providers.map((p) => {
        const id = String(p?.id || p?.model_id || p?.name || '');
        const health = healthById.get(String(p?.id || ''));
        const respMs = Number(health?.responseTime || health?.latency || 0);
        const status = statusFromProvider(p);
        const isUp =
          String(health?.status || '').toLowerCase() === 'healthy' ||
          String(health?.status || '').toLowerCase() === 'degraded';
        const providerKey = String(p?.provider || '').toLowerCase();
        return {
          id,
          name: String(p?.name || p?.model_id || p?.provider || 'Unknown'),
          provider: String(p?.provider || 'Unknown'),
          modelId: String(p?.model_id || ''),
          version: String(p?.updated_at || p?.created_at || ''),
          status,
          tier: normalizeTier(p?.tier),
          capabilities: [],
          contextWindow: Number(p?.context_window || 0),
          maxOutputTokens: undefined,
          costPer1k: Number(p?.cost_per_1k || 0),
          avgLatency: respMs,
          successRate: isUp ? 100 : 0,
          lastUsed: String(p?.updated_at || p?.created_at || ''),
          totalRequests: callsByProvider.get(providerKey) || 0,
          createdAt: String(p?.created_at || ''),
        };
      });

      setModels(nextModels);
    } catch (err) {
      toast.error('Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: Model['status']) => {
    const styles = {
      active: 'bg-emerald-500/10 text-emerald-500',
      deprecated: 'bg-amber-500/10 text-amber-500',
      beta: 'bg-purple-500/10 text-purple-500',
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
      standard: 'bg-slate-500/10 text-slate-400',
      premium: 'bg-amber-500/10 text-amber-500',
      reasoning: 'bg-purple-500/10 text-purple-500',
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
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

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Database size={16} className="text-indigo-500" />
            <span className="text-sm text-slate-500 dark:text-slate-400">Total Models</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{models.length}</div>
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
            <Cpu size={16} className="text-purple-500" />
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
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-navy-700">
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Model
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Provider
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Tier
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Status
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Cost
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Latency
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Success
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Requests
              </th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
            {filteredModels.map((model) => (
              <tr
                key={model.id}
                className="hover:bg-slate-50 dark:hover:bg-navy-900/50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">{model.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {model.modelId}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {model.provider}
                  </span>
                </td>
                <td className="px-6 py-4">{getTierBadge(model.tier)}</td>
                <td className="px-6 py-4">{getStatusBadge(model.status)}</td>
                <td className="px-6 py-4">
                  <div className="text-xs">
                    <div className="text-slate-700 dark:text-slate-300">
                      {formatCostPer1k(model.costPer1k)}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {model.avgLatency < 1000
                      ? `${model.avgLatency}ms`
                      : `${(model.avgLatency / 1000).toFixed(1)}s`}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`text-sm ${model.successRate >= 99 ? 'text-emerald-500' : model.successRate >= 95 ? 'text-amber-500' : 'text-red-500'}`}
                  >
                    {model.successRate.toFixed(1)}%
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {formatNumber(model.totalRequests)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setSelectedModel(model)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye size={16} className="text-slate-400" />
                    </button>
                    <button
                      className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit size={16} className="text-slate-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
