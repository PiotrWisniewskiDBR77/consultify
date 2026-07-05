import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle,
  Clock,
  Database,
  DollarSign,
  Gauge,
  RefreshCw,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

interface AIStats {
  tokensToday: number;
  tokensThisMonth: number;
  topOrganizations: Array<{
    organizationId: string;
    tokensToday: number;
    tokensMonth: number;
  }>;
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    estimatedTokensSaved: number;
  };
  timestamp: string;
}

interface ProviderStatus {
  id: string;
  name: string;
  provider: string;
  is_active: number;
  visibility: string;
}

interface DiagnosticResult {
  version: string;
  status: string;
  checks: Array<{
    name: string;
    status?: string;
    value?: number;
    details?: string;
    provider?: string;
  }>;
}

export const SuperAdminAIAnalyticsView: React.FC = () => {
  const [stats, setStats] = useState<AIStats | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);

      const [statsRes, providersRes, diagRes] = await Promise.all([
        Api.getLLMAuditStats().catch(() => null),
        Api.getPublicLLMProviders().catch(() => []),
        Api.diagnoseLLM().catch(() => null),
      ]);

      if (statsRes) setStats(statsRes);
      if (providersRes) setProviders(providersRes);
      if (diagRes) setDiagnostics(diagRes);
    } catch (err) {
      console.error('Failed to fetch AI analytics', err);
      toast.error('Failed to load AI analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const estimateCost = (tokens: number): string => {
    // Rough estimate: $0.002 per 1k tokens (average across models)
    const cost = (tokens / 1000) * 0.002;
    return cost < 1 ? `$${cost.toFixed(3)}` : `$${cost.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Zap className="text-primary-500" />
            AI Analytics Dashboard
          </h1>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
            Monitor AI usage, costs, and system health across all organizations
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 dark:text-white dark:border-white/10 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* System Status Banner */}
      {diagnostics && (
        <div
          className={`rounded-xl p-4 flex items-center gap-4 ${
            diagnostics.status === 'OK'
              ? 'bg-green-500/10 border border-green-500/20'
              : diagnostics.status === 'NEEDS_CONFIG'
                ? 'bg-yellow-500/10 border border-yellow-500/20'
                : 'bg-danger-500/10 border border-danger-500/20'
          }`}
        >
          {diagnostics.status === 'OK' ? (
            <CheckCircle className="text-green-500 shrink-0" size={24} />
          ) : (
            <AlertCircle className="text-yellow-500 shrink-0" size={24} />
          )}
          <div className="flex-1">
            <p
              className={`font-medium ${
                diagnostics.status === 'OK'
                  ? 'text-emerald-700 dark:text-green-400'
                  : 'text-amber-800 dark:text-yellow-400'
              }`}
            >
              System Status:{' '}
              {diagnostics.status === 'OK' ? 'All Systems Operational' : diagnostics.status}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-500">
              Version: {diagnostics.version} •
              {diagnostics.checks.find((c) => c.name === 'api_connection')?.details && (
                <>
                  {' '}
                  LLM Connection: <span className="text-green-400">Connected</span>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tokens Today */}
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 dark:text-slate-500 text-sm">Tokens Today</span>
            <Activity className="text-blue-400" size={20} />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {formatNumber(stats?.tokensToday || 0)}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Est. cost: {estimateCost(stats?.tokensToday || 0)}
          </p>
        </div>

        {/* Tokens This Month */}
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 dark:text-slate-500 text-sm">Tokens This Month</span>
            <TrendingUp className="text-green-400" size={20} />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {formatNumber(stats?.tokensThisMonth || 0)}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Est. cost: {estimateCost(stats?.tokensThisMonth || 0)}
          </p>
        </div>

        {/* Cache Hit Rate */}
        <div className="bg-c-surface border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 dark:text-slate-500 text-sm">Cache Hit Rate</span>
            <Database className="text-primary-400" size={20} />
          </div>
          <p className="text-3xl font-bold text-c-text">
            {((stats?.cache?.hitRate || 0) * 100).toFixed(1)}%
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {formatNumber(stats?.cache?.hits || 0)} hits / {formatNumber(stats?.cache?.misses || 0)}{' '}
            misses
          </p>
        </div>

        {/* Tokens Saved */}
        <div className="bg-c-surface border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 dark:text-slate-500 text-sm">Tokens Saved (Cache)</span>
            <DollarSign className="text-blue-400" size={20} />
          </div>
          <p className="text-3xl font-bold text-c-text">
            {formatNumber(stats?.cache?.estimatedTokensSaved || 0)}
          </p>
          <p className="text-sm text-green-400 mt-1">
            💰 Saved: {estimateCost(stats?.cache?.estimatedTokensSaved || 0)}
          </p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Organizations */}
        <div className="bg-c-surface border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="text-blue-400" size={20} />
            Top Organizations by Token Usage
          </h3>
          {stats?.topOrganizations && stats.topOrganizations.length > 0 ? (
            <div className="space-y-3">
              {stats.topOrganizations.map((org, idx) => (
                <div key={org.organizationId} className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0
                        ? 'bg-yellow-500 text-black'
                        : idx === 1
                          ? 'bg-slate-400 text-black'
                          : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-c-surface-raised text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-c-text font-medium text-sm truncate max-w-[200px]">
                        {org.organizationId.slice(0, 8)}...
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 text-sm">
                        {formatNumber(org.tokensMonth)} tokens
                      </span>
                    </div>
                    <div className="w-full bg-c-surface-raised rounded-full h-2 mt-1">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-primary-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (org.tokensMonth / (stats.topOrganizations[0]?.tokensMonth || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-sm">No usage data yet</p>
          )}
        </div>

        {/* Active Providers */}
        <div className="bg-c-surface border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Gauge className="text-green-400" size={20} />
            Active LLM Providers
          </h3>
          <div className="space-y-3">
            {providers.length > 0 ? (
              providers.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        provider.is_active ? 'bg-green-500' : 'bg-danger-500'
                      }`}
                    />
                    <div>
                      <p className="text-c-text font-medium text-sm">{provider.name}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs">
                        {provider.provider}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      provider.visibility === 'public'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {provider.visibility}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-slate-500 dark:text-slate-400 text-sm">No providers configured</p>
            )}
          </div>
        </div>
      </div>

      {/* System Checks */}
      <div className="bg-c-surface border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="text-yellow-400" size={20} />
          System Health Checks
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {diagnostics?.checks?.map((check, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-c-surface-raised rounded-lg">
              {check.status === 'OK' ? (
                <CheckCircle className="text-green-500 shrink-0" size={18} />
              ) : check.status === 'FAILED' ? (
                <XCircle className="text-danger-500 shrink-0" size={18} />
              ) : check.status === 'NEEDS_CONFIGURATION' ? (
                <AlertCircle className="text-yellow-500 shrink-0" size={18} />
              ) : (
                <Activity className="text-blue-400 shrink-0" size={18} />
              )}
              <div>
                <p className="text-c-text text-sm font-medium">
                  {check.name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-xs">
                  {check.status || (check.value !== undefined ? `Value: ${check.value}` : 'OK')}
                  {check.provider && ` (${check.provider})`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-c-surface border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => (window.location.href = '/admin#llm')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
          >
            Manage LLM Providers
          </button>
          <button
            onClick={() => (window.location.href = '/admin#knowledge')}
            className="px-4 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium transition-colors"
          >
            Knowledge Base
          </button>
          <button
            onClick={async () => {
              try {
                const data = await Api.diagnoseLLM();
                setDiagnostics(data);
                toast.success('Diagnostics refreshed');
              } catch {
                toast.error('Failed to run diagnostics');
              }
            }}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors"
          >
            Run Diagnostics
          </button>
        </div>
      </div>

      {/* Last Updated */}
      <p className="text-center text-slate-600 dark:text-slate-400 text-xs">
        Last updated: {stats?.timestamp ? new Date(stats.timestamp).toLocaleString() : 'Unknown'}
      </p>
    </div>
  );
};

export default SuperAdminAIAnalyticsView;
