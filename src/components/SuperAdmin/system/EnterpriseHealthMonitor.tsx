/**
 * EnterpriseHealthMonitor - Comprehensive System Health Monitoring
 *
 * Features:
 * - Real-time service status with dependency visualization
 * - Performance metrics with historical trends
 * - Alert configuration and management
 * - Resource utilization monitoring
 * - Database performance metrics
 * - AI service health and token usage
 */

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  CheckCircle,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  Globe,
  HardDrive,
  Loader2,
  MemoryStick,
  RefreshCw,
  Server,
  Settings,
  Shield,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  latency: number;
  lastCheck: string;
  dependencies: string[];
  metrics?: {
    requestsPerMinute?: number;
    errorRate?: number;
    avgResponseTime?: number;
  };
}

interface SystemMetrics {
  cpu: { usage: number; cores: number };
  memory: { used: number; total: number; percent: number };
  disk?: { used: number; total: number; percent: number } | null;
  network?: { bytesIn: number; bytesOut: number } | null;
}

interface AlertConfig {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq';
  enabled: boolean;
  channels: string[];
}

interface HealthData {
  api: { status: string; responseTime: number; version: string };
  database: { status: string; responseTime: number; type: string; connections?: number };
  ai: { status: string; providers: { openai: boolean; anthropic: boolean; groq: boolean } };
  system: {
    nodeVersion: string;
    environment: string;
    uptime: { seconds: number; formatted: string };
    memory: { used: number; total: number; percent?: number };
    loadAvg?: number[];
    cpus?: number;
  };
  timestamp: string;
}

type HealthServicesPayload = {
  api?: { status: string; responseTime: number };
  database?: { status: string; latency: number };
  ai?: { status: string; providers: { openai: boolean; anthropic: boolean; groq: boolean } };
  storage?: { status: string };
};

type HealthMetricsPayload = {
  database?: { total_queries: number; queries_last_hour: number };
  api?: { total_requests: number; requests_last_hour: number };
  ai?: {
    total_requests: number;
    total_input_tokens: number;
    total_output_tokens: number;
    avg_latency: number;
  };
  timestamp?: string;
};

const STATUS_CONFIG = {
  healthy: { color: 'bg-emerald-500', text: 'text-emerald-400', icon: CheckCircle },
  degraded: { color: 'bg-amber-500', text: 'text-amber-400', icon: AlertTriangle },
  down: { color: 'bg-red-500', text: 'text-red-400', icon: XCircle },
  unknown: { color: 'bg-slate-500', text: 'text-slate-400 dark:text-slate-500', icon: Activity },
};

export const EnterpriseHealthMonitor: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [appMetrics, setAppMetrics] = useState<HealthMetricsPayload | null>(null);
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [newAlert, setNewAlert] = useState({ name: '', metric: 'cpu_usage', threshold: 90, operator: 'gt' as 'gt' | 'lt' | 'eq', channels: [] as string[] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'services' | 'metrics' | 'alerts'>(
    'overview'
  );
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      const [data, servicesPayload, metricsPayload] = await Promise.all([
        Api.getSystemHealth(),
        Api.get('/system-health/services'),
        Api.get('/system-health/metrics'),
      ]);

      setHealth(data as any);
      const servicesData: HealthServicesPayload = (servicesPayload as any)?.data ?? (servicesPayload as any);
      const metricsData: HealthMetricsPayload = (metricsPayload as any)?.data ?? (metricsPayload as any);
      setAppMetrics(metricsData);

      const ts = (data as any)?.timestamp || new Date().toISOString();
      const serviceList: ServiceHealth[] = [
        {
          name: 'API Server',
          status:
            servicesData?.api?.status === 'up'
              ? 'healthy'
              : servicesData?.api?.status === 'down'
                ? 'down'
                : 'unknown',
          latency: servicesData?.api?.responseTime ?? (data as any)?.api?.responseTime ?? 0,
          lastCheck: ts,
          dependencies: ['Database'],
        },
        {
          name: 'Database',
          status:
            servicesData?.database?.status === 'up'
              ? 'healthy'
              : servicesData?.database?.status === 'down'
                ? 'down'
                : 'unknown',
          latency: servicesData?.database?.latency ?? (data as any)?.database?.responseTime ?? 0,
          lastCheck: ts,
          dependencies: [],
        },
        {
          name: 'AI Services',
          status:
            servicesData?.ai?.status === 'up'
              ? 'healthy'
              : servicesData?.ai?.status === 'down'
                ? 'degraded'
                : 'unknown',
          latency: 0,
          lastCheck: ts,
          dependencies: ['API Server'],
        },
        {
          name: 'Storage',
          status:
            servicesData?.storage?.status === 'up'
              ? 'healthy'
              : servicesData?.storage?.status === 'down'
                ? 'down'
                : 'unknown',
          latency: 0,
          lastCheck: ts,
          dependencies: [],
        },
      ];
      setServices(serviceList);

      // System metrics
      if (data.system) {
        const cpuCores = Number((data as any)?.system?.cpus || 0) || 0;
        const load1 = Number((data as any)?.system?.loadAvg?.[0] || 0) || 0;
        const cpuUsageApprox =
          cpuCores > 0 ? Math.min(100, Math.max(0, (load1 / cpuCores) * 100)) : Math.min(100, load1 * 10);
        setMetrics({
          cpu: {
            usage: Math.round(cpuUsageApprox * 100) / 100,
            cores: cpuCores,
          },
          memory: {
            used: data.system.memory.used,
            total: data.system.memory.total,
            percent:
              data.system.memory.percent ||
              (data.system.memory.used / data.system.memory.total) * 100,
          },
          disk: null,
          network: null,
        });
      }
    } catch (error) {
      console.error('Failed to fetch health:', error);
      toast.error('Failed to fetch system health');
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const resp = await Api.get('/superadmin/system-health/alerts');
      const data = resp?.data ?? resp;
      setAlerts(Array.isArray(data) ? data : []);
    } catch {
      setAlerts([]);
    }
  }, []);

  const handleCreateAlert = async () => {
    if (!newAlert.name.trim()) { toast.error('Alert name is required'); return; }
    try {
      await Api.post('/superadmin/system-health/alerts', newAlert);
      toast.success('Alert created');
      setShowCreateAlert(false);
      setNewAlert({ name: '', metric: 'cpu_usage', threshold: 90, operator: 'gt', channels: [] });
      fetchAlerts();
    } catch { toast.error('Failed to create alert'); }
  };

  const handleToggleAlert = async (alert: AlertConfig) => {
    try {
      await Api.put(`/superadmin/system-health/alerts/${alert.id}/toggle`, {});
      fetchAlerts();
    } catch { toast.error('Failed to toggle alert'); }
  };

  const handleDeleteAlert = async (id: string) => {
    if (!confirm('Delete this alert?')) return;
    try {
      await Api.delete(`/superadmin/system-health/alerts/${id}`);
      toast.success('Alert deleted');
      fetchAlerts();
    } catch { toast.error('Failed to delete alert'); }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.allSettled([fetchHealth(), fetchAlerts()]);
      setLoading(false);
    };

    loadData();

    // Auto-refresh every 30 seconds
    let interval: ReturnType<typeof setInterval> | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchHealth();
        fetchAlerts();
      }, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, fetchHealth, fetchAlerts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHealth();
    setRefreshing(false);
    toast.success('Health data refreshed');
  };

  const getOverallStatus = (): 'healthy' | 'degraded' | 'down' => {
    if (!services.length) return 'unknown' as any;
    if (services.some((s) => s.status === 'down')) return 'down';
    if (services.some((s) => s.status === 'degraded')) return 'degraded';
    return 'healthy';
  };

  const overallStatus = getOverallStatus();
  const StatusIcon = STATUS_CONFIG[overallStatus].icon;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-96">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${STATUS_CONFIG[overallStatus].color}/20`}>
            <StatusIcon className={`w-6 h-6 ${STATUS_CONFIG[overallStatus].text}`} />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              System Health
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              {overallStatus === 'healthy' && 'All systems operational'}
              {overallStatus === 'degraded' && 'Some services experiencing issues'}
              {overallStatus === 'down' && 'Critical services are down'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-300 bg-white text-purple-600 dark:border-slate-600 dark:bg-slate-800 dark:text-purple-500"
            />
            Auto-refresh
          </label>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-navy-950/20 hover:bg-slate-50 dark:hover:bg-navy-800/40 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-1">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'services', label: 'Services', icon: Server },
          { id: 'metrics', label: 'Metrics', icon: BarChart3 },
          { id: 'alerts', label: 'Alerts', icon: Bell },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveView(id as any)}
            className={`flex items-center gap-2 px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeView === id
                ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-slate-100 border-b-2 border-primary-500'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800/20'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Overview View */}
      {activeView === 'overview' && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl border border-emerald-500/20">
              <div className="flex items-center gap-3 mb-3">
                <Server className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  API Server
                </span>
              </div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {health?.api?.responseTime || 0}ms
              </div>
              <div className="text-xs text-emerald-400 mt-1">Response time</div>
            </div>

            <div className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl border border-blue-500/20">
              <div className="flex items-center gap-3 mb-3">
                <Database className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Database</span>
              </div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {health?.database?.responseTime || 0}ms
              </div>
              <div className="text-xs text-blue-400 mt-1">{health?.database?.type || 'SQLite'}</div>
            </div>

            <div className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl border border-purple-500/20">
              <div className="flex items-center gap-3 mb-3">
                <Brain className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">AI Services</span>
              </div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {Object.values(health?.ai?.providers || {}).filter(Boolean).length}
              </div>
              <div className="text-xs text-purple-400 mt-1">Active providers</div>
            </div>

            <div className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-xl border border-amber-500/20">
              <div className="flex items-center gap-3 mb-3">
                <Clock className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Uptime</span>
              </div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {health?.system?.uptime?.formatted || '0m'}
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">{health?.system?.environment}</div>
            </div>
          </div>

          {/* Resource Usage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10">
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <MemoryStick className="w-4 h-4 text-cyan-400" />
                Memory Usage
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400 dark:text-slate-500">Used</span>
                  <span className="text-slate-900 dark:text-slate-100 font-medium">
                    {metrics?.memory.used || health?.system?.memory?.used || 0} MB
                  </span>
                </div>
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, metrics?.memory.percent || 0)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>0 MB</span>
                  <span>{metrics?.memory.total || health?.system?.memory?.total || 0} MB</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10">
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-orange-400" />
                System Load
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400 dark:text-slate-500">Load Average (1m)</span>
                  <span className="text-slate-900 dark:text-slate-100 font-medium">
                    {(health?.system?.loadAvg?.[0] || 0).toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {['1m', '5m', '15m'].map((label, i) => (
                    <div key={label} className="p-2 bg-slate-100 dark:bg-slate-800/50 rounded-lg text-center">
                      <div className="text-slate-500 dark:text-slate-400">{label}</div>
                      <div className="text-slate-900 dark:text-slate-100 font-medium mt-1">
                        {(health?.system?.loadAvg?.[i] || 0).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
                  {health?.system?.cpus || metrics?.cpu.cores || 0} CPU cores available
                </div>
              </div>
            </div>
          </div>

          {/* AI Providers Status */}
          <div className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" />
              AI Provider Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { name: 'OpenAI', key: 'openai', color: 'emerald' },
                { name: 'Anthropic', key: 'anthropic', color: 'amber' },
                { name: 'Groq', key: 'groq', color: 'blue' },
              ].map(({ name, key, color }) => {
                const isActive = health?.ai?.providers?.[key as keyof typeof health.ai.providers];
                return (
                  <div
                    key={key}
                    className={`p-3 rounded-lg border transition-colors ${
                      isActive
                        ? `bg-${color}-500/10 border-${color}-500/30`
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-medium ${isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-400'}`}
                      >
                        {name}
                      </span>
                      {isActive ? (
                        <CheckCircle className={`w-4 h-4 text-${color}-400`} />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      )}
                    </div>
                    <div
                      className={`text-xs mt-1 ${isActive ? `text-${color}-600 dark:text-${color}-400` : 'text-slate-600 dark:text-slate-400'}`}
                    >
                      {isActive ? 'Connected' : 'Not configured'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Services View */}
      {activeView === 'services' && (
        <div className="space-y-4">
          {services.map((service) => {
            const statusConfig = STATUS_CONFIG[service.status];
            const Icon = statusConfig.icon;
            return (
              <div
                key={service.name}
                className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${statusConfig.color}/20`}>
                      <Icon className={`w-5 h-5 ${statusConfig.text}`} />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-slate-100">{service.name}</h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>Latency: {service.latency}ms</span>
                        <span>•</span>
                        <span>Last check: {new Date(service.lastCheck).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full ${statusConfig.color}/20 ${statusConfig.text}`}
                    >
                      {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </div>
                </div>
                {service.dependencies.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/5">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Dependencies:{' '}
                    </span>
                    {service.dependencies.map((dep, i) => (
                      <span key={dep} className="text-xs text-slate-400 dark:text-slate-500">
                        {dep}
                        {i < service.dependencies.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Metrics View */}
      {activeView === 'metrics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Requests/min',
                value:
                  typeof appMetrics?.api?.requests_last_hour === 'number'
                    ? String(Math.round(appMetrics.api.requests_last_hour / 60))
                    : '—',
                trend: 'stable',
                icon: Zap,
              },
              {
                label: 'Avg Response',
                value: `${health?.api?.responseTime || 0}ms`,
                trend: 'stable',
                icon: Clock,
              },
              {
                label: 'Error Rate',
                value:
                  typeof (health as any)?.api?.errorRatePercent === 'number'
                    ? `${Number((health as any).api.errorRatePercent).toFixed(2)}%`
                    : '—',
                trend: 'stable',
                icon: AlertTriangle,
              },
              { label: 'Active Sessions', value: '—', trend: 'stable', icon: Globe },
            ].map(({ label, value, trend, icon: Icon }) => (
              <div
                key={label}
                className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10"
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  {trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                  {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-400" />}
                  {trend === 'stable' && (
                    <Activity className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  )}
                </div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</div>
              </div>
            ))}
          </div>

          <div className="p-6 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">System Information</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Node.js Version', value: health?.system?.nodeVersion || 'Unknown' },
                { label: 'Environment', value: health?.system?.environment || 'Unknown' },
                { label: 'API Version', value: health?.api?.version || 'Unknown' },
                { label: 'Database Type', value: health?.database?.type || 'Unknown' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
                  <div className="text-sm text-slate-900 dark:text-slate-100 font-medium mt-1 capitalize">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Alerts View */}
      {activeView === 'alerts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Alert Configuration</h3>
            <button
              onClick={() => setShowCreateAlert(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
            >
              <Bell className="w-4 h-4" />
              Add Alert
            </button>
          </div>

          {showCreateAlert && (
            <div className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-purple-500/30 space-y-3">
              <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">New Alert</h4>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Alert name"
                  value={newAlert.name}
                  onChange={(e) => setNewAlert({ ...newAlert, name: e.target.value })}
                  className="px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                />
                <select
                  value={newAlert.metric}
                  onChange={(e) => setNewAlert({ ...newAlert, metric: e.target.value })}
                  className="px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white"
                >
                  <option value="cpu_usage">CPU Usage (%)</option>
                  <option value="memory_usage">Memory Usage (%)</option>
                  <option value="disk_usage">Disk Usage (%)</option>
                  <option value="error_rate">Error Rate (%)</option>
                  <option value="response_time">Response Time (ms)</option>
                  <option value="active_connections">Active Connections</option>
                </select>
                <div className="flex gap-2">
                  <select
                    value={newAlert.operator}
                    onChange={(e) => setNewAlert({ ...newAlert, operator: e.target.value as 'gt' | 'lt' | 'eq' })}
                    className="px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white w-20"
                  >
                    <option value="gt">&gt;</option>
                    <option value="lt">&lt;</option>
                    <option value="eq">=</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Threshold"
                    value={newAlert.threshold}
                    onChange={(e) => setNewAlert({ ...newAlert, threshold: Number(e.target.value) })}
                    className="flex-1 px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => { setShowCreateAlert(false); setNewAlert({ name: '', metric: 'cpu_usage', threshold: 90, operator: 'gt', channels: [] }); }}
                    className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateAlert}
                    disabled={!newAlert.name.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}

          {alerts.length === 0 && !showCreateAlert ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No alerts configured</p>
              <p className="text-sm">Set up alerts to monitor critical metrics</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">{alert.name}</h4>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                      {alert.metric}{' '}
                      {alert.operator === 'gt' ? '>' : alert.operator === 'lt' ? '<' : '='}{' '}
                      {alert.threshold}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleAlert(alert)}
                      className={`px-3 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors ${
                        alert.enabled
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-600'
                      }`}
                    >
                      {alert.enabled ? 'Active' : 'Disabled'}
                    </button>
                    <button
                      onClick={() => handleDeleteAlert(alert.id)}
                      className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                      title="Delete alert"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-400">Alert Channels</h4>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  Configure notification channels (Email, Slack, PagerDuty) in the Organization
                  settings to receive alerts.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-4 border-t border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span>
          Last updated: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'Never'}
        </span>
        <span>Data retention: 30 days</span>
      </div>
    </div>
  );
};

export default EnterpriseHealthMonitor;
