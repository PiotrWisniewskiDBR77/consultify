import {
  Activity,
  AlertTriangle,
  BarChart2,
  Clock3,
  Cpu,
  RefreshCw,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { DegradedState } from '@/components/Admin/AdminState';
import { Api } from '@/services/api';
import { normalizeApiErrorMessage } from '@/utils/apiError';

type TimeRange = '24h' | '7d' | '30d' | '90d';

interface ObservatorySummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  errorRate: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCost: number;
  providersUsed: number;
  modelsUsed: number;
  incidents: number;
  activeIncidents: number;
}

interface ObservatoryTimelinePoint {
  bucket: string;
  requests: number;
  successful: number;
  failed: number;
  successRate: number;
  avgLatencyMs: number;
  tokens: number;
  cost: number;
}

interface ObservatoryProvider {
  provider: string;
  name: string;
  active: boolean;
  currentStatus: string;
  lastHealthCheck: string | null;
  requestCount: number;
  successRate: number | null;
  errorRate: number | null;
  avgLatencyMs: number;
  totalTokens: number;
  totalCost: number;
  uptimePct: number | null;
  healthSamples: number;
  unavailableSamples: number;
  modelId: string | null;
}

interface ObservatoryModel {
  provider: string;
  model: string;
  requests: number;
  tokens: number;
  cost: number;
  avgLatencyMs: number;
}

interface ObservatoryError {
  provider: string;
  error: string;
  occurrences: number;
}

interface ObservatoryIncident {
  provider: string;
  start: string;
  end: string | null;
  durationMs: number;
  samples: number;
  lastError: string | null;
}

interface ObservatoryPayload {
  period: TimeRange;
  summary: ObservatorySummary;
  timeline: ObservatoryTimelinePoint[];
  providers: ObservatoryProvider[];
  models: ObservatoryModel[];
  errorCategories: ObservatoryError[];
  incidents: ObservatoryIncident[];
}

const RANGE_OPTIONS: Array<{ id: TimeRange; label: string }> = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
];

const cardClass =
  'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const asText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : fallback;

const toNumber = (value: unknown, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const toBool = (value: unknown, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
};

const normalizeSummary = (value: unknown): ObservatorySummary => {
  const requiredKeys = [
    'totalRequests',
    'successfulRequests',
    'failedRequests',
    'successRate',
    'errorRate',
    'avgLatencyMs',
    'totalTokens',
    'totalCost',
    'providersUsed',
    'modelsUsed',
    'incidents',
    'activeIncidents',
  ];
  if (!isRecord(value) || requiredKeys.some((key) => !(key in value))) {
    throw new Error('LLM observatory summary response was incomplete');
  }

  return {
    totalRequests: toNumber(value.totalRequests, 0),
    successfulRequests: toNumber(value.successfulRequests, 0),
    failedRequests: toNumber(value.failedRequests, 0),
    successRate: toNumber(value.successRate, 0),
    errorRate: toNumber(value.errorRate, 0),
    avgLatencyMs: toNumber(value.avgLatencyMs, 0),
    totalTokens: toNumber(value.totalTokens, 0),
    totalCost: toNumber(value.totalCost, 0),
    providersUsed: toNumber(value.providersUsed, 0),
    modelsUsed: toNumber(value.modelsUsed, 0),
    incidents: toNumber(value.incidents, 0),
    activeIncidents: toNumber(value.activeIncidents, 0),
  };
};

const normalizeObservatoryPayload = (value: unknown): ObservatoryPayload => {
  const payload = getObjectPayload(value);
  if (
    !isRecord(payload) ||
    !isRecord(payload.summary) ||
    !Array.isArray(payload.timeline) ||
    !Array.isArray(payload.providers) ||
    !Array.isArray(payload.models) ||
    !Array.isArray(payload.errorCategories) ||
    !Array.isArray(payload.incidents)
  ) {
    throw new Error('LLM observatory response was incomplete');
  }

  const period =
    payload.period === '24h' ||
    payload.period === '7d' ||
    payload.period === '30d' ||
    payload.period === '90d'
      ? payload.period
      : '30d';

  return {
    period,
    summary: normalizeSummary(payload.summary),
    timeline: payload.timeline.filter(isRecord).map((point) => ({
      bucket: asText(point.bucket, ''),
      requests: toNumber(point.requests, 0),
      successful: toNumber(point.successful, 0),
      failed: toNumber(point.failed, 0),
      successRate: toNumber(point.successRate, 0),
      avgLatencyMs: toNumber(point.avgLatencyMs, 0),
      tokens: toNumber(point.tokens, 0),
      cost: toNumber(point.cost, 0),
    })),
    providers: payload.providers.filter(isRecord).map((provider) => ({
      provider: asText(provider.provider, 'unknown'),
      name: asText(provider.name, asText(provider.provider, 'Unknown provider')),
      active: toBool(provider.active, false),
      currentStatus: asText(provider.currentStatus, 'unknown'),
      lastHealthCheck:
        provider.lastHealthCheck === null || provider.lastHealthCheck === undefined
          ? null
          : asText(provider.lastHealthCheck, ''),
      requestCount: toNumber(provider.requestCount, 0),
      successRate:
        provider.successRate === null || provider.successRate === undefined
          ? null
          : toNumber(provider.successRate, 0),
      errorRate:
        provider.errorRate === null || provider.errorRate === undefined
          ? null
          : toNumber(provider.errorRate, 0),
      avgLatencyMs: toNumber(provider.avgLatencyMs, 0),
      totalTokens: toNumber(provider.totalTokens, 0),
      totalCost: toNumber(provider.totalCost, 0),
      uptimePct:
        provider.uptimePct === null || provider.uptimePct === undefined
          ? null
          : toNumber(provider.uptimePct, 0),
      healthSamples: toNumber(provider.healthSamples, 0),
      unavailableSamples: toNumber(provider.unavailableSamples, 0),
      modelId:
        provider.modelId === null || provider.modelId === undefined
          ? null
          : asText(provider.modelId, ''),
    })),
    models: payload.models.filter(isRecord).map((model) => ({
      provider: asText(model.provider, 'unknown'),
      model: asText(model.model, 'unknown'),
      requests: toNumber(model.requests, 0),
      tokens: toNumber(model.tokens, 0),
      cost: toNumber(model.cost, 0),
      avgLatencyMs: toNumber(model.avgLatencyMs, 0),
    })),
    errorCategories: payload.errorCategories.filter(isRecord).map((error) => ({
      provider: asText(error.provider, 'unknown'),
      error: asText(error.error, 'unknown'),
      occurrences: toNumber(error.occurrences, 0),
    })),
    incidents: payload.incidents.filter(isRecord).map((incident) => ({
      provider: asText(incident.provider, 'unknown'),
      start: asText(incident.start, ''),
      end: incident.end === null || incident.end === undefined ? null : asText(incident.end, ''),
      durationMs: toNumber(incident.durationMs, 0),
      samples: toNumber(incident.samples, 0),
      lastError:
        incident.lastError === null || incident.lastError === undefined
          ? null
          : asText(incident.lastError, ''),
    })),
  };
};

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatUsd(value: number): string {
  return `$${Number(value || 0).toFixed(value >= 100 ? 0 : value >= 10 ? 2 : 4)}`;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}

function formatRelativeDate(value: string | null): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return date.toLocaleString();
}

function statusTone(status: string): string {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'healthy') return 'text-emerald-600 dark:text-emerald-400';
  if (normalized === 'degraded') return 'text-amber-600 dark:text-amber-400';
  if (normalized === 'unhealthy') return 'text-danger-600 dark:text-danger-400';
  return 'text-slate-500 dark:text-slate-400';
}

export const LLMObservatoryTab: React.FC = () => {
  const { t } = useTranslation();
  const [range, setRange] = useState<TimeRange>('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [payload, setPayload] = useState<ObservatoryPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(
    async (nextRange: TimeRange = range) => {
      try {
        setRefreshing(true);
        setLoadError(null);
        const response = await Api.getAIOperationsLLMObservatory(nextRange);
        const data = normalizeObservatoryPayload(response);
        setPayload(data);

        setSelectedProvider((current) =>
          current !== 'all' &&
          !(data?.providers || []).some((provider) => provider.provider === current)
            ? 'all'
            : current
        );
      } catch (error: unknown) {
        const message = normalizeApiErrorMessage(
          error,
          t('superadmin.ai.observatory.loadError', 'Failed to load historical LLM analytics')
        );
        setPayload(null);
        setSelectedProvider('all');
        setLoadError(message);
        toast.error(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [range, t]
  );

  useEffect(() => {
    void loadData(range);
  }, [loadData, range]);

  const filteredIncidents = useMemo(() => {
    const incidents = payload?.incidents || [];
    if (selectedProvider === 'all') return incidents;
    return incidents.filter((incident) => incident.provider === selectedProvider);
  }, [payload, selectedProvider]);

  const filteredModels = useMemo(() => {
    const models = payload?.models || [];
    if (selectedProvider === 'all') return models;
    return models.filter((model) => model.provider === selectedProvider);
  }, [payload, selectedProvider]);

  const filteredErrors = useMemo(() => {
    const errors = payload?.errorCategories || [];
    if (selectedProvider === 'all') return errors;
    return errors.filter((error) => error.provider === selectedProvider);
  }, [payload, selectedProvider]);

  const maxTimelineRequests = useMemo(
    () => Math.max(...(payload?.timeline || []).map((point) => point.requests), 1),
    [payload]
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-600" />
      </div>
    );
  }

  const summary = payload?.summary;
  const providers = payload?.providers || [];
  const timeline = payload?.timeline || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart2 size={20} className="text-indigo-500" />
            {t('superadmin.ai.observatory.title', 'LLM Observatory')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'superadmin.ai.observatory.subtitle',
              'Historical reliability, usage, cost, and incident visibility for your model layer'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedProvider}
            onChange={(event) => setSelectedProvider(event.target.value)}
            disabled={!!loadError}
            title={loadError || undefined}
            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900 text-sm text-slate-700 dark:text-slate-200"
          >
            <option value="all">
              {t('superadmin.ai.observatory.allProviders', 'All providers')}
            </option>
            {providers.map((provider) => (
              <option key={provider.provider} value={provider.provider}>
                {provider.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900 p-1">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setRange(option.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  range === option.id
                    ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadData(range)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {t('superadmin.ai.observatory.refresh', 'Refresh')}
          </button>
        </div>
      </div>

      {loadError ? (
        <div className={`${cardClass} p-6`}>
          <DegradedState title="LLM observatory unavailable" description={loadError} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            <div className={`${cardClass} p-4`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t('superadmin.ai.observatory.requests', 'Requests')}
                </span>
                <Activity size={16} className="text-indigo-500" />
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
                {formatCompact(summary?.totalRequests || 0)}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('superadmin.ai.observatory.successRate', 'Success rate')}:{' '}
                {summary?.successRate ?? 0}%
              </div>
            </div>

            <div className={`${cardClass} p-4`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t('superadmin.ai.observatory.avgLatency', 'Avg latency')}
                </span>
                <Clock3 size={16} className="text-blue-500" />
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
                {summary?.avgLatencyMs ?? 0}ms
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('superadmin.ai.observatory.errorRate', 'Error rate')}: {summary?.errorRate ?? 0}%
              </div>
            </div>

            <div className={`${cardClass} p-4`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t('superadmin.ai.observatory.tokens', 'Tokens')}
                </span>
                <Zap size={16} className="text-amber-500" />
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
                {formatCompact(summary?.totalTokens || 0)}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('superadmin.ai.observatory.models', 'Models')}: {summary?.modelsUsed ?? 0}
              </div>
            </div>

            <div className={`${cardClass} p-4`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t('superadmin.ai.observatory.cost', 'Cost')}
                </span>
                <Cpu size={16} className="text-emerald-500" />
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
                {formatUsd(summary?.totalCost || 0)}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('superadmin.ai.observatory.providers', 'Providers')}:{' '}
                {summary?.providersUsed ?? 0}
              </div>
            </div>

            <div className={`${cardClass} p-4`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t('superadmin.ai.observatory.incidents', 'Incidents')}
                </span>
                <ShieldAlert size={16} className="text-danger-500" />
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
                {summary?.incidents ?? 0}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('superadmin.ai.observatory.activeIncidents', 'Active')}:{' '}
                {summary?.activeIncidents ?? 0}
              </div>
            </div>

            <div className={`${cardClass} p-4`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t('superadmin.ai.observatory.providerScope', 'Scope')}
                </span>
                <AlertTriangle size={16} className="text-primary-500" />
              </div>
              <div className="mt-3 text-lg font-semibold text-slate-900 dark:text-white capitalize">
                {selectedProvider === 'all'
                  ? t('superadmin.ai.observatory.global', 'Global')
                  : selectedProvider}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('superadmin.ai.observatory.period', 'Period')}: {payload?.period || range}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6">
            <div className={`${cardClass} p-5`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t('superadmin.ai.observatory.timelineTitle', 'Traffic & quality timeline')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t(
                      'superadmin.ai.observatory.timelineSubtitle',
                      'Historical request volume with success and latency context'
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {timeline.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
                    {t(
                      'superadmin.ai.observatory.noTimeline',
                      'No historical request data for this period'
                    )}
                  </div>
                ) : (
                  timeline.map((point) => (
                    <div
                      key={point.bucket}
                      className="grid grid-cols-[120px_1fr_140px] gap-3 items-center"
                    >
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {point.bucket}
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500/80"
                          style={{
                            width: `${Math.max(4, (point.requests / maxTimelineRequests) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="text-right text-xs text-slate-600 dark:text-slate-300">
                        {formatCompact(point.requests)} req · {point.successRate}% ·{' '}
                        {point.avgLatencyMs}ms
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className={`${cardClass} p-5`}>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('superadmin.ai.observatory.incidentFeed', 'Incident feed')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t(
                    'superadmin.ai.observatory.incidentSubtitle',
                    'Downtime windows inferred from historical provider health checks'
                  )}
                </p>
              </div>

              <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto">
                {filteredIncidents.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
                    {t(
                      'superadmin.ai.observatory.noIncidents',
                      'No incidents recorded in this period'
                    )}
                  </div>
                ) : (
                  filteredIncidents.map((incident, index) => (
                    <div
                      key={`${incident.provider}-${incident.start}-${index}`}
                      className="rounded-lg border border-slate-200 dark:border-white/10 p-3 bg-slate-50/60 dark:bg-white/[0.03]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                          {incident.provider}
                        </div>
                        <span
                          className={`text-[11px] font-medium ${
                            incident.end === null
                              ? 'text-danger-600 dark:text-danger-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {incident.end === null
                            ? t('superadmin.ai.observatory.ongoing', 'Ongoing')
                            : formatDuration(incident.durationMs)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {formatRelativeDate(incident.start)}
                        {' -> '}
                        {incident.end
                          ? formatRelativeDate(incident.end)
                          : t('superadmin.ai.observatory.now', 'now')}
                      </div>
                      <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                        {t('superadmin.ai.observatory.samples', 'Samples')}: {incident.samples}
                      </div>
                      {incident.lastError ? (
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                          {incident.lastError}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-6">
            <div className={`${cardClass} overflow-hidden`}>
              <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('superadmin.ai.observatory.providersTable', 'Provider historical health')}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table /* §27-exempt: data-viz/render analityczny read-only, nie lista encji */ className="w-full text-sm"
                >
                  <thead>
                    <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                      <th className="px-5 py-3">
                        {t('superadmin.ai.observatory.provider', 'Provider')}
                      </th>
                      <th className="px-5 py-3">
                        {t('superadmin.ai.observatory.status', 'Status')}
                      </th>
                      <th className="px-5 py-3">
                        {t('superadmin.ai.observatory.uptime', 'Uptime')}
                      </th>
                      <th className="px-5 py-3">
                        {t('superadmin.ai.observatory.requestsShort', 'Req')}
                      </th>
                      <th className="px-5 py-3">
                        {t('superadmin.ai.observatory.latencyShort', 'Latency')}
                      </th>
                      <th className="px-5 py-3">
                        {t('superadmin.ai.observatory.errorsShort', 'Errors')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {providers.map((provider) => (
                      <tr
                        key={provider.provider}
                        className={`border-b border-slate-200 dark:border-white/5 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03] ${
                          selectedProvider === provider.provider
                            ? 'bg-indigo-50/60 dark:bg-indigo-500/10'
                            : ''
                        }`}
                        onClick={() =>
                          setSelectedProvider((current) =>
                            current === provider.provider ? 'all' : provider.provider
                          )
                        }
                      >
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {provider.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                            {provider.provider}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div
                            className={`text-xs font-medium capitalize ${statusTone(provider.currentStatus)}`}
                          >
                            {provider.currentStatus || 'unknown'}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-500">
                            {formatRelativeDate(provider.lastHealthCheck)}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                          {provider.uptimePct == null ? 'n/a' : `${provider.uptimePct}%`}
                        </td>
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                          {formatCompact(provider.requestCount)}
                        </td>
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                          {provider.avgLatencyMs}ms
                        </td>
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                          {provider.errorRate == null ? 'n/a' : `${provider.errorRate}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-6">
              <div className={`${cardClass} p-5`}>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('superadmin.ai.observatory.topModels', 'Top models')}
                </h3>
                <div className="mt-4 space-y-3">
                  {filteredModels.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {t('superadmin.ai.observatory.noModels', 'No model activity in this period')}
                    </div>
                  ) : (
                    filteredModels.slice(0, 8).map((model) => (
                      <div
                        key={`${model.provider}-${model.model}`}
                        className="flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {model.model}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                            {model.provider}
                          </div>
                        </div>
                        <div className="text-right text-xs text-slate-600 dark:text-slate-300 shrink-0">
                          <div>{formatCompact(model.requests)} req</div>
                          <div>{model.avgLatencyMs}ms</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={`${cardClass} p-5`}>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('superadmin.ai.observatory.errorHotspots', 'Error hotspots')}
                </h3>
                <div className="mt-4 space-y-3">
                  {filteredErrors.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {t(
                        'superadmin.ai.observatory.noErrors',
                        'No error categories recorded in this period'
                      )}
                    </div>
                  ) : (
                    filteredErrors.slice(0, 8).map((entry, index) => (
                      <div
                        key={`${entry.provider}-${index}`}
                        className="flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-900 dark:text-white capitalize">
                            {entry.provider}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                            {entry.error}
                          </div>
                        </div>
                        <div className="text-xs font-medium text-danger-600 dark:text-danger-400 shrink-0">
                          {entry.occurrences}x
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LLMObservatoryTab;
