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
  MemoryStick,
  RefreshCw,
  Server,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState } from '../../Admin/AdminState';
import { EmptyState, LoadingState } from '../../shared/states';

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
  api: { status: string; responseTime: number; version: string; errorRatePercent?: number };
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

type ViewId = 'overview' | 'services' | 'metrics' | 'alerts';

const STATUS_CONFIG = {
  healthy: { color: 'bg-c-success', text: 'text-c-success', icon: CheckCircle },
  degraded: { color: 'bg-c-warning', text: 'text-c-warning', icon: AlertTriangle },
  down: { color: 'bg-c-danger', text: 'text-c-danger', icon: XCircle },
  unknown: { color: 'bg-c-text-muted', text: 'text-c-text-secondary', icon: Activity },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const unwrapRecord = (value: unknown) => {
  if (isRecord(value) && isRecord(value.data)) return value.data;
  return isRecord(value) ? value : {};
};

const asText = (value: unknown, fallback = 'Unknown') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleTimeString();
};

const formatDateTime = (value?: string) => {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
};

const normalizeOperator = (value: unknown): AlertConfig['operator'] => {
  if (value === 'lt' || value === 'eq') return value;
  return 'gt';
};

type AlertDraft = {
  name: string;
  metric: string;
  threshold: number;
  operator: AlertConfig['operator'];
  channels: string[];
};

const initialAlertState: AlertDraft = {
  name: '',
  metric: 'cpu_usage',
  threshold: 90,
  operator: 'gt',
  channels: [],
};

const normalizeAlerts = (payload: unknown): AlertConfig[] => {
  const candidate = isRecord(payload) && 'data' in payload ? payload.data : payload;
  const list = Array.isArray(candidate)
    ? candidate
    : isRecord(candidate)
      ? candidate.alerts || candidate.items || candidate.data
      : null;
  if (!Array.isArray(list)) {
    throw new Error('Alert configuration response was not a list');
  }
  return list.filter(isRecord).map((alert) => ({
    id: asText(alert.id, ''),
    name: asText(alert.name),
    metric: asText(alert.metric),
    threshold: safeNumber(alert.threshold),
    operator: normalizeOperator(alert.operator),
    enabled: alert.enabled === true || alert.enabled === 'true' || alert.enabled === 1,
    channels: Array.isArray(alert.channels) ? alert.channels.map((channel) => String(channel)) : [],
  }));
};

const getCreatedAlertId = (result: unknown) => {
  if (!isRecord(result)) return '';
  const data = isRecord(result.data) ? result.data : null;
  const alert = isRecord(result.alert) ? result.alert : null;
  return String(
    result.id || alert?.id || data?.id || (isRecord(data?.alert) ? data.alert.id : '') || ''
  );
};

const alertMatchesCreate = (alert: AlertConfig, expected: AlertDraft, expectedId: string) =>
  alert.id === expectedId &&
  alert.name === expected.name &&
  alert.metric === expected.metric &&
  alert.operator === expected.operator &&
  alert.threshold === expected.threshold;

const healthTabs: {
  id: ViewId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'services', label: 'Services', icon: Server },
  { id: 'metrics', label: 'Metrics', icon: BarChart3 },
  { id: 'alerts', label: 'Alerts', icon: Bell },
];

export const EnterpriseHealthMonitor: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [appMetrics, setAppMetrics] = useState<HealthMetricsPayload | null>(null);
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);
  const [healthLoadError, setHealthLoadError] = useState<string | null>(null);
  const [alertsLoadError, setAlertsLoadError] = useState<string | null>(null);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [newAlert, setNewAlert] = useState(initialAlertState);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      setHealthLoadError(null);
      const [data, servicesPayload, metricsPayload] = await Promise.all([
        Api.getSystemHealth(),
        Api.get('/system-health/services'),
        Api.get('/system-health/metrics'),
      ]);

      const healthData = isRecord(data) ? data : {};
      setHealth(data as HealthData);
      const servicesData = unwrapRecord(servicesPayload) as unknown as HealthServicesPayload;
      const metricsData = unwrapRecord(metricsPayload) as unknown as HealthMetricsPayload;
      setAppMetrics(metricsData);
      const apiHealth = isRecord(healthData.api) ? healthData.api : {};
      const databaseHealth = isRecord(healthData.database) ? healthData.database : {};
      const systemHealth = isRecord(healthData.system) ? healthData.system : null;
      const systemMemory = systemHealth && isRecord(systemHealth.memory) ? systemHealth.memory : {};

      const ts = asText(healthData.timestamp, new Date().toISOString());
      const serviceList: ServiceHealth[] = [
        {
          name: 'API Server',
          status:
            servicesData?.api?.status === 'up'
              ? 'healthy'
              : servicesData?.api?.status === 'down'
                ? 'down'
                : 'unknown',
          latency: safeNumber(servicesData?.api?.responseTime ?? apiHealth.responseTime),
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
          latency: safeNumber(servicesData?.database?.latency ?? databaseHealth.responseTime),
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
      if (systemHealth) {
        const loadAvg = Array.isArray(systemHealth.loadAvg) ? systemHealth.loadAvg : [];
        const cpuCores = safeNumber(systemHealth.cpus);
        const load1 = safeNumber(loadAvg[0]);
        const cpuUsageApprox =
          cpuCores > 0
            ? Math.min(100, Math.max(0, (load1 / cpuCores) * 100))
            : Math.min(100, load1 * 10);
        setMetrics({
          cpu: {
            usage: Math.round(cpuUsageApprox * 100) / 100,
            cores: cpuCores,
          },
          memory: {
            used: safeNumber(systemMemory.used),
            total: safeNumber(systemMemory.total),
            percent:
              safeNumber(systemMemory.percent) ||
              (safeNumber(systemMemory.used) / safeNumber(systemMemory.total, 1)) * 100,
          },
          disk: null,
          network: null,
        });
      }
      return true;
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to fetch system health');
      setHealthLoadError(message);
      setHealth(null);
      setServices([]);
      setMetrics(null);
      setAppMetrics(null);
      toast.error(message);
      return false;
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      setAlertsLoadError(null);
      const resp = await Api.get('/superadmin/system-health/alerts');
      const normalized = normalizeAlerts(resp);
      setAlerts(normalized);
      return normalized;
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to load alert settings');
      setAlertsLoadError(message);
      setAlerts([]);
      return null;
    }
  }, []);

  const handleCreateAlert = async () => {
    if (!newAlert.name.trim()) {
      toast.error('Alert name is required');
      return;
    }
    try {
      setActionError(null);
      const expected = { ...newAlert };
      const result = await Api.post('/superadmin/system-health/alerts', expected);
      const createdId = getCreatedAlertId(result);
      if (!createdId) {
        throw new Error('Alert creation response was incomplete');
      }
      const refreshed = await fetchAlerts();
      if (!refreshed?.some((alert) => alertMatchesCreate(alert, expected, createdId))) {
        throw new Error('Alert creation was not confirmed by the server');
      }
      toast.success('Alert created');
      setShowCreateAlert(false);
      setNewAlert(initialAlertState);
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to create alert');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleToggleAlert = async (alert: AlertConfig) => {
    try {
      setActionError(null);
      const expectedEnabled = !alert.enabled;
      await Api.put(`/superadmin/system-health/alerts/${alert.id}/toggle`, {});
      const refreshed = await fetchAlerts();
      if (!refreshed?.some((item) => item.id === alert.id && item.enabled === expectedEnabled)) {
        throw new Error('Alert toggle was not confirmed by the server');
      }
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to toggle alert');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    if (!confirm('Delete this alert?')) return;
    try {
      setActionError(null);
      await Api.delete(`/superadmin/system-health/alerts/${id}`);
      const refreshed = await fetchAlerts();
      if (!refreshed || refreshed.some((alert) => alert.id === id)) {
        throw new Error('Alert deletion was not confirmed by the server');
      }
      toast.success('Alert deleted');
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to delete alert');
      setActionError(message);
      toast.error(message);
    }
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
    const ok = await fetchHealth();
    setRefreshing(false);
    if (ok) {
      toast.success('Health data refreshed');
    }
  };

  const getOverallStatus = (): 'healthy' | 'degraded' | 'down' | 'unknown' => {
    if (healthLoadError || !services.length) return 'unknown';
    if (services.some((s) => s.status === 'down')) return 'down';
    if (services.some((s) => s.status === 'degraded')) return 'degraded';
    return 'healthy';
  };

  const overallStatus = getOverallStatus();
  const StatusIcon = STATUS_CONFIG[overallStatus].icon;

  if (loading) {
    return (
      <div className="p-8">
        <LoadingState template="panel" />
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
            <h2 className="text-2xl font-semibold text-c-text">
              System Health
            </h2>
            <p className="text-c-text-secondary text-sm">
              {overallStatus === 'healthy' && 'All systems operational'}
              {overallStatus === 'degraded' && 'Some services experiencing issues'}
              {overallStatus === 'down' && 'Critical services are down'}
              {overallStatus === 'unknown' && 'System health unavailable'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-c-text-secondary">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-c-border-strong bg-c-surface text-c-accent"
            />
            Auto-refresh
          </label>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-c-surface hover:bg-c-surface-raised border border-c-border rounded-lg text-c-text transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-c-border-subtle pb-1">
        {healthTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveView(id)}
            className={`flex items-center gap-2 px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeView === id
                ? 'bg-c-surface-raised text-c-text border-b-2 border-c-accent'
                : 'text-c-text-secondary hover:bg-c-surface-raised'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-c-danger/30 bg-c-danger/5 p-4 text-sm text-c-danger"
        >
          {actionError}
        </div>
      )}

      {/* Overview View */}
      {activeView === 'overview' && (
        <div className="space-y-6">
          {healthLoadError ? (
            <div className="rounded-xl border border-c-border bg-c-surface p-6">
              <DegradedState
                title="System health overview unavailable"
                description={healthLoadError}
              />
            </div>
          ) : (
            <>
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gradient-to-br from-c-success/10 to-c-success/5 rounded-xl border border-c-success/20">
                  <div className="flex items-center gap-3 mb-3">
                    <Server className="w-5 h-5 text-c-success" />
                    <span className="text-sm font-medium text-c-text">
                      API Server
                    </span>
                  </div>
                  <div className="text-2xl font-semibold text-c-text">
                    {health?.api?.responseTime || 0}ms
                  </div>
                  <div className="text-xs text-c-success mt-1">Response time</div>
                </div>

                <div className="p-4 bg-gradient-to-br from-c-info/10 to-c-info/5 rounded-xl border border-c-info/20">
                  <div className="flex items-center gap-3 mb-3">
                    <Database className="w-5 h-5 text-c-info" />
                    <span className="text-sm font-medium text-c-text">
                      Database
                    </span>
                  </div>
                  <div className="text-2xl font-semibold text-c-text">
                    {health?.database?.responseTime || 0}ms
                  </div>
                  <div className="text-xs text-c-info mt-1">
                    {health?.database?.type || 'SQLite'}
                  </div>
                </div>

                <div className="p-4 bg-c-accent-soft rounded-xl border border-c-accent/20">
                  <div className="flex items-center gap-3 mb-3">
                    <Brain className="w-5 h-5 text-c-accent" />
                    <span className="text-sm font-medium text-c-text">
                      AI Services
                    </span>
                  </div>
                  <div className="text-2xl font-semibold text-c-text">
                    {Object.values(health?.ai?.providers || {}).filter(Boolean).length}
                  </div>
                  <div className="text-xs text-c-accent mt-1">Active providers</div>
                </div>

                <div className="p-4 bg-gradient-to-br from-c-warning/10 to-c-warning/5 rounded-xl border border-c-warning/20">
                  <div className="flex items-center gap-3 mb-3">
                    <Clock className="w-5 h-5 text-c-warning" />
                    <span className="text-sm font-medium text-c-text">
                      Uptime
                    </span>
                  </div>
                  <div className="text-2xl font-semibold text-c-text">
                    {health?.system?.uptime?.formatted || '0m'}
                  </div>
                  <div className="text-xs text-c-warning mt-1">
                    {health?.system?.environment}
                  </div>
                </div>
              </div>

              {/* Resource Usage */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-c-surface rounded-xl border border-c-border">
                  <h3 className="text-sm font-medium text-c-text mb-4 flex items-center gap-2">
                    <MemoryStick className="w-4 h-4 text-c-info" />
                    Memory Usage
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-c-text-secondary">Used</span>
                      <span className="text-c-text font-medium">
                        {metrics?.memory.used || health?.system?.memory?.used || 0} MB
                      </span>
                    </div>
                    <div className="h-3 bg-c-surface-raised rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-c-info to-c-info rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, metrics?.memory.percent || 0)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-c-text-muted">
                      <span>0 MB</span>
                      <span>{metrics?.memory.total || health?.system?.memory?.total || 0} MB</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-c-surface rounded-xl border border-c-border">
                  <h3 className="text-sm font-medium text-c-text mb-4 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-c-warning" />
                    System Load
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-c-text-secondary">Load Average (1m)</span>
                      <span className="text-c-text font-medium">
                        {safeNumber(health?.system?.loadAvg?.[0]).toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {['1m', '5m', '15m'].map((label, i) => (
                        <div
                          key={label}
                          className="p-2 bg-c-surface-raised rounded-lg text-center"
                        >
                          <div className="text-c-text-muted">{label}</div>
                          <div className="text-c-text font-medium mt-1">
                            {safeNumber(health?.system?.loadAvg?.[i]).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-c-text-muted text-right">
                      {health?.system?.cpus || metrics?.cpu.cores || 0} CPU cores available
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Providers Status */}
              <div className="p-4 bg-c-surface rounded-xl border border-c-border">
                <h3 className="text-sm font-medium text-c-text mb-4 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-c-accent" />
                  AI Provider Status
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { name: 'OpenAI', key: 'openai' },
                    { name: 'Anthropic', key: 'anthropic' },
                    { name: 'Groq', key: 'groq' },
                  ].map(({ name, key }) => {
                    const isActive =
                      health?.ai?.providers?.[key as keyof typeof health.ai.providers];
                    return (
                      <div
                        key={key}
                        className={`p-3 rounded-lg border transition-colors ${
                          isActive
                            ? 'bg-c-success/10 border-c-success/30'
                            : 'bg-c-surface-raised border-c-border'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-medium ${isActive ? 'text-c-text' : 'text-c-text-secondary'}`}
                          >
                            {name}
                          </span>
                          {isActive ? (
                            <CheckCircle className="w-4 h-4 text-c-success" />
                          ) : (
                            <XCircle className="w-4 h-4 text-c-text-secondary" />
                          )}
                        </div>
                        <div
                          className={`text-xs mt-1 ${isActive ? 'text-c-success' : 'text-c-text-secondary'}`}
                        >
                          {isActive ? 'Connected' : 'Not configured'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Services View */}
      {activeView === 'services' && (
        <div className="space-y-4">
          {healthLoadError ? (
            <div className="rounded-xl border border-c-border bg-c-surface p-6">
              <DegradedState title="Service health unavailable" description={healthLoadError} />
            </div>
          ) : (
            <>
              {services.map((service) => {
                const statusConfig = STATUS_CONFIG[service.status];
                const Icon = statusConfig.icon;
                return (
                  <div
                    key={service.name}
                    className="p-4 bg-c-surface rounded-xl border border-c-border hover:border-c-border-strong transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${statusConfig.color}/20`}>
                          <Icon className={`w-5 h-5 ${statusConfig.text}`} />
                        </div>
                        <div>
                          <h4 className="font-medium text-c-text">
                            {service.name}
                          </h4>
                          <div className="flex items-center gap-3 text-xs text-c-text-muted mt-1">
                            <span>Latency: {service.latency}ms</span>
                            <span>•</span>
                            <span>Last check: {formatTime(service.lastCheck)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span
                          className={`px-3 py-1 text-xs font-medium rounded-full ${statusConfig.color}/20 ${statusConfig.text}`}
                        >
                          {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-c-text-secondary" />
                      </div>
                    </div>
                    {service.dependencies.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-c-border-subtle">
                        <span className="text-xs text-c-text-muted">
                          Dependencies:{' '}
                        </span>
                        {service.dependencies.map((dep, i) => (
                          <span key={dep} className="text-xs text-c-text-secondary">
                            {dep}
                            {i < service.dependencies.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Metrics View */}
      {activeView === 'metrics' && (
        <div className="space-y-6">
          {healthLoadError ? (
            <div className="rounded-xl border border-c-border bg-c-surface p-6">
              <DegradedState title="Health metrics unavailable" description={healthLoadError} />
            </div>
          ) : (
            <>
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
                    value: Number.isFinite(Number(health?.api?.errorRatePercent))
                      ? `${Number(health?.api?.errorRatePercent).toFixed(2)}%`
                      : '—',
                    trend: 'stable',
                    icon: AlertTriangle,
                  },
                  { label: 'Active Sessions', value: '—', trend: 'stable', icon: Globe },
                ].map(({ label, value, trend, icon: Icon }) => (
                  <div
                    key={label}
                    className="p-4 bg-c-surface rounded-xl border border-c-border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon className="w-4 h-4 text-c-text-secondary" />
                      {trend === 'up' && <TrendingUp className="w-4 h-4 text-c-success" />}
                      {trend === 'down' && <TrendingDown className="w-4 h-4 text-c-danger" />}
                      {trend === 'stable' && (
                        <Activity className="w-4 h-4 text-c-text-secondary" />
                      )}
                    </div>
                    <div className="text-2xl font-semibold text-c-text">
                      {value}
                    </div>
                    <div className="text-xs text-c-text-muted mt-1">{label}</div>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-c-surface rounded-xl border border-c-border">
                <h3 className="text-sm font-medium text-c-text mb-4">
                  System Information
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Node.js Version', value: health?.system?.nodeVersion || 'Unknown' },
                    { label: 'Environment', value: health?.system?.environment || 'Unknown' },
                    { label: 'API Version', value: health?.api?.version || 'Unknown' },
                    { label: 'Database Type', value: health?.database?.type || 'Unknown' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="text-xs text-c-text-muted">{label}</div>
                      <div className="text-sm text-c-text font-medium mt-1 capitalize">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Alerts View */}
      {activeView === 'alerts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-c-text">
              Alert Configuration
            </h3>
            <button
              onClick={() => setShowCreateAlert(true)}
              disabled={!!alertsLoadError}
              className="flex items-center gap-2 px-3 py-1.5 bg-c-surface hover:bg-c-surface text-white dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] text-sm rounded-lg transition-colors"
            >
              <Bell className="w-4 h-4" />
              Add Alert
            </button>
          </div>

          {showCreateAlert && (
            <div className="p-4 bg-c-surface rounded-xl border border-c-accent/30 space-y-3">
              <h4 className="text-sm font-medium text-c-text">New Alert</h4>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Alert name"
                  value={newAlert.name}
                  onChange={(e) => setNewAlert({ ...newAlert, name: e.target.value })}
                  className="px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm text-c-text placeholder:text-c-text-muted"
                />
                <select
                  value={newAlert.metric}
                  onChange={(e) => setNewAlert({ ...newAlert, metric: e.target.value })}
                  className="px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm text-c-text"
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
                    onChange={(e) =>
                      setNewAlert({ ...newAlert, operator: e.target.value as 'gt' | 'lt' | 'eq' })
                    }
                    className="px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm text-c-text w-20"
                  >
                    <option value="gt">&gt;</option>
                    <option value="lt">&lt;</option>
                    <option value="eq">=</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Threshold"
                    value={newAlert.threshold}
                    onChange={(e) =>
                      setNewAlert({ ...newAlert, threshold: Number(e.target.value) })
                    }
                    className="flex-1 px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm text-c-text"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => {
                      setShowCreateAlert(false);
                      setNewAlert({
                        name: '',
                        metric: 'cpu_usage',
                        threshold: 90,
                        operator: 'gt',
                        channels: [],
                      });
                    }}
                    className="px-3 py-2 text-sm text-c-text-muted hover:text-c-text"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateAlert}
                    disabled={!newAlert.name.trim()}
                    className="px-4 py-2 bg-c-surface hover:bg-c-surface text-white dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}

          {alertsLoadError ? (
            <div className="rounded-xl border border-c-border bg-c-surface p-6">
              <DegradedState
                title="Alert configuration unavailable"
                description={alertsLoadError}
              />
            </div>
          ) : alerts.length === 0 && !showCreateAlert ? (
            <EmptyState
              variant="new"
              icon={Bell}
              title="No alerts configured"
              description="Set up alerts to monitor critical metrics."
            />
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 bg-c-surface rounded-xl border border-c-border"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-c-text">{alert.name}</h4>
                    <p className="text-sm text-c-text-secondary mt-1">
                      {alert.metric}{' '}
                      {alert.operator === 'gt' ? '>' : alert.operator === 'lt' ? '<' : '='}{' '}
                      {alert.threshold}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleAlert(alert)}
                      aria-label={`${alert.enabled ? 'Disable' : 'Enable'} alert ${alert.name}`}
                      className={`px-3 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors ${
                        alert.enabled
                          ? 'bg-c-success/20 text-c-success hover:bg-c-success/30'
                          : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface'
                      }`}
                    >
                      {alert.enabled ? 'Active' : 'Disabled'}
                    </button>
                    <button
                      onClick={() => handleDeleteAlert(alert.id)}
                      aria-label={`Delete alert ${alert.name}`}
                      className="p-1 text-c-text-secondary hover:text-c-danger transition-colors"
                      title="Delete alert"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          <div className="p-4 bg-c-warning/10 border border-c-warning/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-c-warning mt-0.5" />
              <div>
                <h4 className="font-medium text-c-warning">Alert Channels</h4>
                <p className="text-sm text-c-text-secondary mt-1">
                  Configure notification channels (Email, Slack, PagerDuty) in the Organization
                  settings to receive alerts.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-4 border-t border-c-border-subtle text-xs text-c-text-muted flex items-center justify-between">
        <span>Last updated: {formatDateTime(health?.timestamp)}</span>
        <span>Data retention: 30 days</span>
      </div>
    </div>
  );
};

export default EnterpriseHealthMonitor;
