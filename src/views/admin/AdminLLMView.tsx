import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Box,
  Brain,
  Check,
  CheckCircle,
  Clock,
  Coins,
  Edit,
  Edit2,
  Eye,
  EyeOff,
  Globe,
  Info,
  Play,
  Plus,
  RefreshCw,
  Save,
  Server,
  Settings,
  Shield,
  Terminal,
  Trash2,
  Wifi,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState, ReadOnlyState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import { LoadingState } from '../../components/ui/primitives';
import { EntityStatusChip } from '../../components/ui/primitives/chips/EntityStatusChip';
import { Api } from '../../services/api';
import type { LLMProviderConfig } from '../../types';

// Health Status Types
interface ProviderStatus {
  id: string;
  provider: string;
  name: string;
  model: string;
  endpoint: string;
  isConfigured: boolean;
  isActive: boolean;
  isDefault: boolean;
  tier: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastHealthCheck: string | null;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsTools: boolean;
  priority: number;
  costPer1k: number;
}

interface HealthSummary {
  total: number;
  configured: number;
  active: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
}

interface LLMStatus {
  success: boolean;
  timestamp: string;
  providers: ProviderStatus[];
  defaultProvider: { provider: string; model: string; name: string } | null;
  fallbackChains: Record<string, string[]>;
  circuitBreakers: Record<
    string,
    { state: string; failures: number; lastFailure?: number; lastSuccess?: number }
  >;
  summary: HealthSummary;
  startupValidation: {
    timestamp: string;
    duration: number;
    healthy: number;
    criticalErrors: string[];
  } | null;
}

export const AdminLLMView: React.FC = () => {
  // Providers State
  const [providers, setProviders] = useState<LLMProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerLoadError, setProviderLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Health Status State (new)
  const [llmStatus, setLLMStatus] = useState<LLMStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusLoadError, setStatusLoadError] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [refreshingHealth, setRefreshingHealth] = useState(false);

  // Prompts State
  const [activeTab, setActiveTab] = useState<'providers' | 'prompts' | 'health'>('providers');
  const [prompts, setPrompts] = useState<any[]>([]);
  const [promptsLoadError, setPromptsLoadError] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<any | null>(null);

  const [form, setForm] = useState<Partial<LLMProviderConfig>>({
    name: '',
    provider: 'openai',
    api_key: '',
    endpoint: '',
    model_id: '',
    is_active: true,
    visibility: 'admin',
    cost_per_1k: 0,
  });
  const [logs, setLogs] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoadError, setAnalyticsLoadError] = useState<string | null>(null);

  // Load LLM status (new)
  const loadLLMStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      setStatusLoadError(null);
      const response = await Api.get('/api/llm/status');
      const data = response?.data ?? response;
      if (!data.success) {
        throw new Error(data.error || 'LLM status unavailable');
      }
      setLLMStatus(data);
    } catch (e) {
      console.error('Failed to load LLM status:', e);
      setLLMStatus(null);
      setStatusLoadError(e instanceof Error ? e.message : 'Failed to load LLM status');
    }
    setLoadingStatus(false);
  }, []);

  useEffect(() => {
    const initLLMData = async () => {
      try {
        setProviderLoadError(null);
        const data = await Api.getLLMProviders(true);
        setProviders(data as any);
        setLoading(false);
      } catch (err) {
        toast.error('Failed to load providers');
        setProviders([]);
        setProviderLoadError(err instanceof Error ? err.message : 'Failed to load providers');
        setLoading(false);
      }
      try {
        setPromptsLoadError(null);
        const promptsData = await Api.aiGetSystemPrompts();
        setPrompts(promptsData);
      } catch (e) {
        console.error(e);
        setPrompts([]);
        setPromptsLoadError(e instanceof Error ? e.message : 'Failed to load prompts');
      }
      // Load LLM status
      loadLLMStatus();
    };
    initLLMData();
  }, [loadLLMStatus]);

  const loadAnalytics = useCallback(async () => {
    try {
      setAnalyticsLoadError(null);
      const [stats, recentLogs] = await Promise.all([Api.getLLMAnalytics(7), Api.getLLMLogs(50)]);
      setAnalytics(stats);
      setLogs(recentLogs.logs || []);
    } catch (error) {
      console.error('Failed to load analytics', error);
      toast.error('Failed to load analytics data');
      setAnalytics(null);
      setLogs([]);
      setAnalyticsLoadError(error instanceof Error ? error.message : 'Failed to load analytics');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'health') {
      loadAnalytics();
    }
  }, [activeTab, loadAnalytics]);

  const loadProviders = async () => {
    try {
      setProviderLoadError(null);
      const data = await Api.getLLMProviders(true);
      setProviders(data as any);
      setLoading(false);
    } catch (err) {
      toast.error('Failed to load providers');
      setProviders([]);
      setProviderLoadError(err instanceof Error ? err.message : 'Failed to load providers');
      setLoading(false);
    }
  };

  const loadPrompts = async () => {
    try {
      setPromptsLoadError(null);
      const data = await Api.aiGetSystemPrompts();
      setPrompts(data);
    } catch (e) {
      console.error(e);
      setPrompts([]);
      setPromptsLoadError(e instanceof Error ? e.message : 'Failed to load prompts');
    }
  };

  // Refresh all provider health
  const refreshAllHealth = async () => {
    setRefreshingHealth(true);
    try {
      const response = await Api.post('/api/llm/status/refresh', {});
      const data = response?.data ?? response;
      if (data.success) {
        toast.success(`Health check complete: ${data.summary?.healthy || 0} healthy providers`);
        await loadLLMStatus();
      } else {
        toast.error(data.error || 'Health check failed');
      }
    } catch (e) {
      toast.error('Failed to refresh health');
    }
    setRefreshingHealth(false);
  };

  // Test single provider
  const testSingleProvider = async (provider: string) => {
    setTestingProvider(provider);
    try {
      const response = await Api.post(`/api/llm/status/test/${provider}`, {});
      const data = response?.data ?? response;
      if (data.success && data.reachable) {
        toast.success(`${provider} is healthy (${data.latency}ms)`);
      } else {
        toast.error(`${provider}: ${data.error || 'Connection failed'}`);
      }
      await loadLLMStatus();
    } catch (e) {
      toast.error(`Test failed for ${provider}`);
    }
    setTestingProvider(null);
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle size={16} className="text-green-400" />;
      case 'degraded':
        return <AlertTriangle size={16} className="text-yellow-400" />;
      case 'unhealthy':
        return <XCircle size={16} className="text-danger-400" />;
      default:
        return <Activity size={16} className="text-c-text-secondary" />;
    }
  };

  // Get status color class
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'degraded':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'unhealthy':
        return 'text-danger-400 bg-danger-500/10 border-danger-500/20';
      default:
        return 'text-c-text-secondary bg-c-surface-raised border-slate-500/20';
    }
  };

  const [testingConnection, setTestingConnection] = useState(false);

  const handleTestConnection = async (config: Partial<LLMProviderConfig>) => {
    setTestingConnection(true);
    try {
      const result = await Api.testLLMConnection(config);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(`Connection Failed: ${result.message}`);
      }
    } catch (err) {
      toast.error('Test failed to execute');
    }
    setTestingConnection(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await Api.updateLLMProvider(editingId, form);
        toast.success('Provider updated');
      } else {
        await Api.addLLMProvider(form as any);
        toast.success('Provider added');
      }
      setShowModal(false);
      setEditingId(null);
      setForm({
        name: '',
        provider: 'openai',
        api_key: '',
        endpoint: '',
        model_id: '',
        is_active: true,
        visibility: 'admin',
      });
      loadProviders();
    } catch (err) {
      toast.error('Operation failed');
    }
  };

  const handleUpdatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrompt) return;
    try {
      await Api.aiUpdateSystemPrompt(editingPrompt.key, {
        content: editingPrompt.content,
        description: editingPrompt.description,
        context_config: editingPrompt.context_config as any,
        updatedBy: 'SuperAdmin', // In real app, use currentUser.email
      });
      toast.success('System Prompt Updated');
      setEditingPrompt(null);
      loadPrompts();
    } catch (e) {
      toast.error('Failed to update prompt');
    }
  };

  const handleEdit = (p: LLMProviderConfig) => {
    setEditingId(p.id);
    setForm(p);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    // if (!confirm('Are you sure?')) return; // Native alerts are not premium
    try {
      await Api.deleteLLMProvider(id);
      toast.success('Provider deleted');
      loadProviders();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="space-y-6 relative">
      <InfoButton cardId="admin-llm" position="top-right" />
      {/* TABS */}
      <div className="flex gap-4 border-b border-white/5 pb-1">
        <button
          onClick={() => setActiveTab('providers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'providers' ? 'border-white/80 text-c-text' : 'border-transparent text-c-text-secondary hover:text-white'}`}
        >
          LLM Providers
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'health' ? 'border-white/80 text-c-text' : 'border-transparent text-c-text-secondary hover:text-white'}`}
        >
          <Activity size={14} />
          Health Dashboard
          {llmStatus && (
            <span
              className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                llmStatus.summary.healthy > 0
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-danger-500/20 text-danger-400'
              }`}
            >
              {llmStatus.summary.healthy}/{llmStatus.summary.configured}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('prompts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'prompts' ? 'border-white/80 text-c-text' : 'border-transparent text-c-text-secondary hover:text-white'}`}
        >
          System Personas (Prompts)
        </button>
      </div>

      {activeTab === 'providers' && (
        <div className="space-y-4">
          {providerLoadError ? (
            <DegradedState title="LLM providers unavailable" description={providerLoadError} />
          ) : loading ? (
            <LoadingState variant="spinner" className="py-12" />
          ) : (
            <>
              <ReadOnlyState
                title="LLM provider configuration is read-only"
                description="Provider management actions are not shown until the persistence and audit workflow is fully connected."
              />
              <div className="rounded-xl border border-white/10 bg-c-surface/50 p-4">
                <p className="text-sm text-c-text-secondary">
                  Loaded providers:{' '}
                  <span className="font-semibold text-c-text">{providers.length}</span>
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'prompts' && (
        <div className="space-y-4">
          {promptsLoadError ? (
            <DegradedState title="System prompts unavailable" description={promptsLoadError} />
          ) : (
            <>
              <ReadOnlyState
                title="System prompts are read-only"
                description="Prompt editing is hidden until user attribution, persistence, and audit metadata are wired."
              />
              <div className="rounded-xl border border-white/10 bg-c-surface/50 p-4">
                <p className="text-sm text-c-text-secondary">
                  Loaded prompts:{' '}
                  <span className="font-semibold text-c-text">{prompts.length}</span>
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: HEALTH DASHBOARD */}
      {activeTab === 'health' && (
        <div className="animate-in fade-in duration-300 space-y-6">
          {/* KPI Cards */}
          {analyticsLoadError ? (
            <DegradedState title="LLM analytics unavailable" description={analyticsLoadError} />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-c-surface/50 border border-white/10 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Activity size={20} className="text-blue-400" />
                    </div>
                    <span className="text-xs font-mono text-c-text-muted">LAST 7 DAYS</span>
                  </div>
                  <div className="text-2xl font-bold text-c-text mb-1">
                    {analytics?.total_requests?.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-c-text-secondary">Total Requests</div>
                </div>

                <div className="p-4 bg-c-surface/50 border border-white/10 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <Zap size={20} className="text-emerald-400" />
                    </div>
                    <span className="text-xs font-mono text-c-text-muted">AVG LATENCY</span>
                  </div>
                  <div className="text-2xl font-bold text-c-text mb-1">
                    {analytics?.avg_latency || 0}ms
                  </div>
                  <div className="text-xs text-c-text-secondary">Response Time</div>
                </div>

                <div className="p-4 bg-c-surface/50 border border-white/10 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                      <Coins size={20} className="text-amber-400" />
                    </div>
                    <span className="text-xs font-mono text-c-text-muted">EST. COST</span>
                  </div>
                  <div className="text-2xl font-bold text-c-text mb-1">
                    ${(analytics?.total_cost || 0).toFixed(4)}
                  </div>
                  <div className="text-xs text-c-text-secondary">Total Spend</div>
                </div>

                <div className="p-4 bg-c-surface/50 border border-white/10 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <div
                      className={`p-2 rounded-lg ${analytics?.error_rate > 0.05 ? 'bg-danger-500/20' : 'bg-primary-500/20'}`}
                    >
                      <AlertTriangle
                        size={20}
                        className={
                          analytics?.error_rate > 0.05 ? 'text-danger-400' : 'text-primary-400'
                        }
                      />
                    </div>
                    <span className="text-xs font-mono text-c-text-muted">ERROR RATE</span>
                  </div>
                  <div className="text-2xl font-bold text-c-text mb-1">
                    {(analytics?.error_rate * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-c-text-secondary">
                    {analytics?.error_count} Failed Requests
                  </div>
                </div>
              </div>

              {/* Logs Table */}
              <div className="bg-c-surface/50 border border-white/10 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                  <h3 className="font-semibold text-c-text flex items-center gap-2">
                    <Terminal size={18} className="text-c-text-secondary" />
                    Recent Interactions
                  </h3>
                  <button className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                    View All Logs
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table
                    /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full text-left border-collapse"
                  >
                    <thead>
                      <tr className="bg-black/20 text-xs uppercase tracking-wider text-c-text-muted">
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Provider / Model</th>
                        <th className="px-4 py-3">Latency</th>
                        <th className="px-4 py-3">Cost</th>
                        <th className="px-4 py-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {logs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-c-surface/5 transition-colors text-sm">
                          <td className="px-4 py-3">
                            <EntityStatusChip status={log.status} />
                          </td>
                          <td className="px-4 py-3 text-c-text-secondary font-mono text-xs">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-c-text font-medium">{log.provider}</span>
                              <span className="text-xs text-c-text-muted">{log.model}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-c-text-secondary font-mono text-xs">
                            {log.latency_ms}ms
                          </td>
                          <td className="px-4 py-3 text-c-text-secondary font-mono text-xs">
                            ${(log.cost || 0).toFixed(6)}
                          </td>
                          <td className="px-4 py-3">
                            {log.error_message ? (
                              <span
                                className="text-danger-400 text-xs truncate max-w-[200px] block"
                                title={log.error_message}
                              >
                                {log.error_message}
                              </span>
                            ) : (
                              <span className="text-c-text-secondary text-xs italic">Success</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {logs.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-8 text-center text-c-text-muted italic"
                          >
                            No logs found in the last 7 days.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {activeTab === 'health' &&
        (statusLoadError ? (
          <DegradedState title="LLM health status unavailable" description={statusLoadError} />
        ) : (
          <div className="space-y-6">
            {/* Health Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-900/30 to-navy-900 border border-green-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={18} className="text-green-400" />
                  <span className="text-xs uppercase tracking-wider text-green-400">Healthy</span>
                </div>
                <p className="text-3xl font-bold text-c-text">{llmStatus?.summary.healthy || 0}</p>
              </div>
              <div className="bg-gradient-to-br from-yellow-900/30 to-navy-900 border border-yellow-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={18} className="text-yellow-400" />
                  <span className="text-xs uppercase tracking-wider text-yellow-400">Degraded</span>
                </div>
                <p className="text-3xl font-bold text-c-text">{llmStatus?.summary.degraded || 0}</p>
              </div>
              <div className="bg-gradient-to-br from-danger-900/30 to-navy-900 border border-danger-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle size={18} className="text-danger-400" />
                  <span className="text-xs uppercase tracking-wider text-danger-400">
                    Unhealthy
                  </span>
                </div>
                <p className="text-3xl font-bold text-c-text">
                  {llmStatus?.summary.unhealthy || 0}
                </p>
              </div>
              <div className="bg-gradient-to-br from-slate-800/50 to-navy-900 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Server size={18} className="text-c-text-secondary" />
                  <span className="text-xs uppercase tracking-wider text-c-text-secondary">
                    Total
                  </span>
                </div>
                <p className="text-3xl font-bold text-c-text">
                  {llmStatus?.summary.configured || 0}
                  <span className="text-sm text-c-text-muted">
                    /{llmStatus?.summary.total || 0}
                  </span>
                </p>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                {llmStatus?.defaultProvider && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-c-text-secondary">Default:</span>
                    <span className="text-c-text font-medium">
                      {llmStatus.defaultProvider.name}
                    </span>
                    <span className="text-c-text-muted">({llmStatus.defaultProvider.model})</span>
                  </div>
                )}
                {llmStatus?.startupValidation && (
                  <div className="flex items-center gap-2 text-xs text-c-text-secondary">
                    <Clock size={12} />
                    Last check:{' '}
                    {new Date(llmStatus.startupValidation.timestamp).toLocaleTimeString()}(
                    {llmStatus.startupValidation.duration}ms)
                  </div>
                )}
              </div>
              <button
                onClick={refreshAllHealth}
                disabled={refreshingHealth}
                className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <RefreshCw size={16} className={refreshingHealth ? 'animate-spin' : ''} />
                {refreshingHealth ? 'Refreshing...' : 'Refresh All'}
              </button>
            </div>

            {/* Critical Errors */}
            {llmStatus?.startupValidation?.criticalErrors &&
              llmStatus.startupValidation.criticalErrors.length > 0 && (
                <div className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-4">
                  <h3 className="text-danger-400 font-semibold flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} />
                    Critical Errors
                  </h3>
                  <ul className="space-y-1">
                    {llmStatus.startupValidation.criticalErrors.map((err, i) => (
                      <li key={i} className="text-danger-300 text-sm">
                        • {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Provider Health Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {llmStatus?.providers.map((p) => (
                <div
                  key={p.id || p.provider}
                  className={`border rounded-xl p-4 transition-all ${getStatusClass(p.healthStatus)}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-c-text">{p.name || p.provider}</h4>
                      <p className="text-xs text-c-text-secondary font-mono">{p.model}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(p.healthStatus)}
                      <span className="text-xs capitalize">{p.healthStatus}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${p.isDefault ? 'bg-c-accent/20 text-c-accent' : 'bg-c-surface-raised/50 text-c-text-secondary'}`}
                    >
                      {p.isDefault ? '★ Default' : p.tier}
                    </span>
                    {p.supportsVision && (
                      <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-300">
                        Vision
                      </span>
                    )}
                    {p.supportsTools && (
                      <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-300">
                        Tools
                      </span>
                    )}
                    {!p.isConfigured && (
                      <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300">
                        No API Key
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-c-text-muted">
                      Priority: {p.priority} | ${p.costPer1k}/1k
                    </span>
                    <button
                      onClick={() => testSingleProvider(p.provider)}
                      disabled={testingProvider === p.provider || !p.isConfigured}
                      className="text-xs px-2 py-1 bg-c-bg/30 dark:bg-navy-950/20 hover:bg-c-surface-raised/40 disabled:opacity-50 rounded flex items-center gap-1 transition-colors"
                    >
                      {testingProvider === p.provider ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <Wifi size={12} />
                      )}
                      Test
                    </button>
                  </div>

                  {/* Circuit Breaker Status */}
                  {llmStatus.circuitBreakers[p.provider] && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-2 text-xs">
                        <Zap
                          size={10}
                          className={
                            llmStatus.circuitBreakers[p.provider].state === 'CLOSED'
                              ? 'text-green-400'
                              : llmStatus.circuitBreakers[p.provider].state === 'OPEN'
                                ? 'text-danger-400'
                                : 'text-yellow-400'
                          }
                        />
                        <span className="text-c-text-secondary">
                          Circuit: {llmStatus.circuitBreakers[p.provider].state}
                        </span>
                        {llmStatus.circuitBreakers[p.provider].failures > 0 && (
                          <span className="text-danger-400">
                            ({llmStatus.circuitBreakers[p.provider].failures} failures)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Fallback Chains */}
            {llmStatus?.fallbackChains && (
              <div className="bg-c-surface border border-white/5 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
                  <ArrowRight size={18} className="text-primary-400" />
                  Fallback Chains
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(llmStatus.fallbackChains).map(([tier, chain]) => (
                    <div key={tier} className="bg-c-bg/50 rounded-lg p-3">
                      <span className="text-xs uppercase tracking-wider text-primary-400 mb-2 block">
                        {tier}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {(chain as string[]).map((provider, idx) => (
                          <React.Fragment key={provider}>
                            {idx > 0 && <ArrowRight size={12} className="text-c-text-secondary" />}
                            <span
                              className={`text-sm px-2 py-0.5 rounded ${
                                llmStatus.providers.find((p) => p.provider === provider)
                                  ?.healthStatus === 'healthy'
                                  ? 'bg-green-500/20 text-green-300'
                                  : 'bg-c-surface-raised/50 text-c-text-secondary'
                              }`}
                            >
                              {provider}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
    </div>
  );
};

export default AdminLLMView;
