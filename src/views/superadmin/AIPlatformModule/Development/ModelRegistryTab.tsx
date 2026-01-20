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
  maxOutputTokens: number;
  costPerInputToken: number;
  costPerOutputToken: number;
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
      // Mock data - replace with API call
      const mockModels: Model[] = [
        {
          id: '1',
          name: 'GPT-4o',
          provider: 'OpenAI',
          modelId: 'gpt-4o',
          version: '2024-08-06',
          status: 'active',
          tier: 'premium',
          capabilities: ['text', 'vision', 'function_calling', 'json_mode'],
          contextWindow: 128000,
          maxOutputTokens: 16384,
          costPerInputToken: 0.000005,
          costPerOutputToken: 0.000015,
          avgLatency: 1200,
          successRate: 99.8,
          lastUsed: new Date().toISOString(),
          totalRequests: 1250000,
          createdAt: '2024-05-13',
        },
        {
          id: '2',
          name: 'GPT-4o Mini',
          provider: 'OpenAI',
          modelId: 'gpt-4o-mini',
          version: '2024-07-18',
          status: 'active',
          tier: 'budget',
          capabilities: ['text', 'vision', 'function_calling'],
          contextWindow: 128000,
          maxOutputTokens: 16384,
          costPerInputToken: 0.00000015,
          costPerOutputToken: 0.0000006,
          avgLatency: 800,
          successRate: 99.9,
          lastUsed: new Date().toISOString(),
          totalRequests: 3500000,
          createdAt: '2024-07-18',
        },
        {
          id: '3',
          name: 'Claude 3.5 Sonnet',
          provider: 'Anthropic',
          modelId: 'claude-3-5-sonnet-20241022',
          version: '20241022',
          status: 'active',
          tier: 'premium',
          capabilities: ['text', 'vision', 'function_calling', 'computer_use'],
          contextWindow: 200000,
          maxOutputTokens: 8192,
          costPerInputToken: 0.000003,
          costPerOutputToken: 0.000015,
          avgLatency: 1100,
          successRate: 99.7,
          lastUsed: new Date().toISOString(),
          totalRequests: 890000,
          createdAt: '2024-10-22',
        },
        {
          id: '4',
          name: 'o1-preview',
          provider: 'OpenAI',
          modelId: 'o1-preview',
          version: '2024-09-12',
          status: 'beta',
          tier: 'reasoning',
          capabilities: ['text', 'reasoning', 'chain_of_thought'],
          contextWindow: 128000,
          maxOutputTokens: 32768,
          costPerInputToken: 0.000015,
          costPerOutputToken: 0.00006,
          avgLatency: 15000,
          successRate: 98.5,
          lastUsed: new Date().toISOString(),
          totalRequests: 45000,
          createdAt: '2024-09-12',
        },
        {
          id: '5',
          name: 'Claude 3 Haiku',
          provider: 'Anthropic',
          modelId: 'claude-3-haiku-20240307',
          version: '20240307',
          status: 'active',
          tier: 'budget',
          capabilities: ['text', 'vision'],
          contextWindow: 200000,
          maxOutputTokens: 4096,
          costPerInputToken: 0.00000025,
          costPerOutputToken: 0.00000125,
          avgLatency: 400,
          successRate: 99.9,
          lastUsed: new Date().toISOString(),
          totalRequests: 2100000,
          createdAt: '2024-03-07',
        },
        {
          id: '6',
          name: 'Llama 3.1 70B',
          provider: 'Groq',
          modelId: 'llama-3.1-70b-versatile',
          version: '3.1',
          status: 'active',
          tier: 'standard',
          capabilities: ['text', 'function_calling'],
          contextWindow: 131072,
          maxOutputTokens: 8192,
          costPerInputToken: 0.00000059,
          costPerOutputToken: 0.00000079,
          avgLatency: 200,
          successRate: 99.5,
          lastUsed: new Date().toISOString(),
          totalRequests: 560000,
          createdAt: '2024-07-23',
        },
        {
          id: '7',
          name: 'GPT-4 Turbo',
          provider: 'OpenAI',
          modelId: 'gpt-4-turbo-preview',
          version: '2024-04-09',
          status: 'deprecated',
          tier: 'premium',
          capabilities: ['text', 'vision', 'function_calling'],
          contextWindow: 128000,
          maxOutputTokens: 4096,
          costPerInputToken: 0.00001,
          costPerOutputToken: 0.00003,
          avgLatency: 2000,
          successRate: 99.5,
          lastUsed: '2024-10-15T00:00:00Z',
          totalRequests: 5600000,
          createdAt: '2024-01-25',
        },
      ];
      setModels(mockModels);
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

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCost = (cost: number) => {
    return `$${(cost * 1000000).toFixed(2)}/1M`;
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
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{providers.length}</div>
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
                Cost (In/Out)
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
                  <span className="text-sm text-slate-700 dark:text-slate-300">{model.provider}</span>
                </td>
                <td className="px-6 py-4">{getTierBadge(model.tier)}</td>
                <td className="px-6 py-4">{getStatusBadge(model.status)}</td>
                <td className="px-6 py-4">
                  <div className="text-xs">
                    <div className="text-slate-700 dark:text-slate-300">
                      {formatCost(model.costPerInputToken)}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {formatCost(model.costPerOutputToken)}
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
                  {selectedModel.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded text-xs"
                    >
                      {cap}
                    </span>
                  ))}
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
