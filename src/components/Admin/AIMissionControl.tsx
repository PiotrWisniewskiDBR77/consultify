import i18n from 'i18next';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { localeListy } from '../../utils/listDateFormat';
import { Button } from '../ui/primitives/Button';
import { DegradedState } from './AdminState';

interface CapabilityResult {
  capability: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  latency: number;
  details: unknown;
  error?: string;
}

interface SystemStatus {
  providers: Array<{
    name: string;
    type: string;
    status: string;
    visibility: string;
  }>;
  metrics: {
    uptime50: number;
    avgLatencyMs: number;
    totalRequests: number;
  };
  timestamp: string;
}

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

const normalizeSystemStatus = (value: unknown): SystemStatus => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !Array.isArray(payload.providers) || !isRecord(payload.metrics)) {
    throw new Error(
      i18n.t(
        'admin.aiControlCenter.missionControl.errors.incompleteStatus',
        'AI mission status response was incomplete'
      )
    );
  }

  return {
    providers: payload.providers.filter(isRecord).map((provider) => ({
      name: asText(
        provider.name,
        i18n.t('admin.aiControlCenter.missionControl.unknownProvider', 'Unknown provider')
      ),
      type: asText(provider.type, ''),
      status: asText(provider.status, 'UNKNOWN'),
      visibility: asText(provider.visibility, ''),
    })),
    metrics: {
      uptime50: toNumber(payload.metrics.uptime50, 0),
      avgLatencyMs: toNumber(payload.metrics.avgLatencyMs, 0),
      totalRequests: toNumber(payload.metrics.totalRequests, 0),
    },
    timestamp: asText(payload.timestamp, new Date().toISOString()),
  };
};

const normalizeCapabilityResult = (
  value: unknown,
  capability: string,
  fallbackError?: string
): CapabilityResult => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload)) {
    return {
      capability,
      status: 'FAILED',
      latency: 0,
      details: null,
      error:
        fallbackError ||
        i18n.t(
          'admin.aiControlCenter.missionControl.errors.incompleteTest',
          'Capability test response was incomplete'
        ),
    };
  }

  const status =
    payload.status === 'SUCCESS' || payload.status === 'FAILED' || payload.status === 'PENDING'
      ? payload.status
      : 'FAILED';

  return {
    capability: asText(payload.capability, capability),
    status,
    latency: toNumber(payload.latency, 0),
    details: payload.details ?? null,
    error:
      status === 'FAILED'
        ? asText(
            payload.error,
            fallbackError ||
              i18n.t(
                'admin.aiControlCenter.missionControl.errors.notConfirmed',
                'Capability test did not confirm success'
              )
          )
        : undefined,
  };
};

export const AIMissionControl: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [results, setResults] = useState<Record<string, CapabilityResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [statusLoading, setStatusLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const capabilities = [
    {
      id: 'connection',
      name: t(
        'admin.aiControlCenter.missionControl.capabilities.connection',
        'AI Connection (Basic)'
      ),
      icon: '🔌',
    },
    {
      id: 'eyes',
      name: t('admin.aiControlCenter.missionControl.capabilities.eyes', 'AI Eyes (Visual Context)'),
      icon: '👁️',
    },
    {
      id: 'memory',
      name: t('admin.aiControlCenter.missionControl.capabilities.memory', 'AI Memory (RAG)'),
      icon: '🧠',
    },
    {
      id: 'hands',
      name: t('admin.aiControlCenter.missionControl.capabilities.hands', 'AI Hands (MCP Tools)'),
      icon: '🤝',
    },
    {
      id: 'reasoning',
      name: t(
        'admin.aiControlCenter.missionControl.capabilities.reasoning',
        'MAX Mode (Reasoning)'
      ),
      icon: '🚀',
    },
  ];

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setStatusLoading(true);
    setLoadError(null);
    try {
      const response = await Api.get('/api/llm/health/status');
      setStatus(normalizeSystemStatus(response));
    } catch (err: unknown) {
      setStatus(null);
      setLoadError(
        normalizeApiErrorMessage(
          err,
          t('admin.aiControlCenter.missionControl.errors.fetchStatus', 'Failed to fetch AI status')
        )
      );
    } finally {
      setStatusLoading(false);
    }
  };

  const testCapability = async (capId: string) => {
    setLoading((prev) => ({ ...prev, [capId]: true }));
    try {
      const response = await Api.post(`/api/llm/health/test/${capId}`, { context: {} });
      setResults((prev) => ({ ...prev, [capId]: normalizeCapabilityResult(response, capId) }));
    } catch (err: unknown) {
      setResults((prev) => ({
        ...prev,
        [capId]: normalizeCapabilityResult(
          null,
          capId,
          normalizeApiErrorMessage(
            err,
            t('admin.aiControlCenter.missionControl.errors.testFailed', 'Capability test failed')
          )
        ),
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [capId]: false }));
      await fetchStatus();
    }
  };

  return (
    <div className="p-6 space-y-8 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('admin.aiControlCenter.missionControl.title', 'AI Mission Control')}
        </h1>
        <Button onClick={fetchStatus} variant="ghost" size="sm">
          {t('admin.aiControlCenter.missionControl.refreshStatus', 'Refresh Status')}
        </Button>
      </div>

      {/* System Status Overview */}
      {loadError ? (
        <div className="bg-white dark:bg-navy-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/10">
          <DegradedState
            title={t(
              'admin.aiControlCenter.missionControl.unavailableTitle',
              'AI mission control unavailable'
            )}
            description={loadError}
          />
        </div>
      ) : statusLoading && !status ? (
        <div className="bg-white dark:bg-navy-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.aiControlCenter.missionControl.loading', 'Loading AI mission status...')}
        </div>
      ) : status ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-navy-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/10">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 uppercase">
              {t('admin.aiControlCenter.missionControl.successRate', 'Success Rate (Last 50)')}
            </h3>
            <div className="mt-2 flex items-baseline">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">
                {status.metrics.uptime50.toFixed(1)}%
              </span>
              <span
                className={`ml-2 text-sm font-medium ${status.metrics.uptime50 > 95 ? 'text-emerald-400' : 'text-amber-300'}`}
              >
                {status.metrics.uptime50 > 95
                  ? t('admin.aiControlCenter.missionControl.excellent', 'Excellent')
                  : t('admin.aiControlCenter.missionControl.degraded', 'Degraded')}
              </span>
            </div>
          </div>
          <div className="bg-white dark:bg-navy-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/10">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 uppercase">
              {t('admin.aiControlCenter.missionControl.avgLatency', 'Avg Latency')}
            </h3>
            <div className="mt-2 flex items-baseline">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">
                {status.metrics.avgLatencyMs}ms
              </span>
              <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">
                {t('admin.aiControlCenter.missionControl.perRequest', 'per request')}
              </span>
            </div>
          </div>
          <div className="bg-white dark:bg-navy-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/10">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 uppercase">
              {t('admin.aiControlCenter.missionControl.activeProviders', 'Active Providers')}
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {(() => {
                const activeProviders = status.providers.filter((p) => p.status === 'ACTIVE');
                if (activeProviders.length === 0) {
                  return (
                    <span className="text-slate-600 dark:text-slate-400 text-sm">
                      {t(
                        'admin.aiControlCenter.missionControl.noActiveProviders',
                        'No active providers'
                      )}
                    </span>
                  );
                }
                return activeProviders.map((p) => (
                  <span
                    key={p.name}
                    className="px-2 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 text-xs font-medium rounded-full border border-emerald-500/30"
                  >
                    {p.name}
                  </span>
                ));
              })()}
            </div>
          </div>
        </div>
      ) : null}

      {/* Capability Tests */}
      <div className="bg-white dark:bg-navy-900 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-800/60">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            {t(
              'admin.aiControlCenter.missionControl.diagnosticsTitle',
              'AI Capability Diagnostics'
            )}
          </h2>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-white/5">
          {capabilities.map((cap) => (
            <div
              key={cap.id}
              className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl">{cap.icon}</span>
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white">{cap.name}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t(
                      'admin.aiControlCenter.missionControl.testDescription',
                      'Test if {{capability}} is functioning correctly.',
                      {
                        capability: cap.id,
                      }
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {results[cap.id] && (
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      results[cap.id].status === 'SUCCESS'
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                        : 'bg-danger-500/20 text-danger-200 border border-danger-500/40'
                    }`}
                  >
                    {t(
                      'admin.aiControlCenter.missionControl.resultLatency',
                      '{{status}} ({{latency}}ms)',
                      {
                        status: results[cap.id].status,
                        latency: results[cap.id].latency,
                      }
                    )}
                  </div>
                )}
                <Button
                  onClick={() => testCapability(cap.id)}
                  loading={Boolean(loading[cap.id])}
                  disabled={Boolean(loadError)}
                  title={
                    loadError
                      ? t(
                          'admin.aiControlCenter.missionControl.statusUnavailable',
                          'AI mission control status is unavailable'
                        )
                      : undefined
                  }
                  variant={results[cap.id]?.status === 'FAILED' ? 'danger' : 'primary'}
                  size="sm"
                >
                  {t('admin.aiControlCenter.missionControl.runTest', 'Run Test')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Logs (Last Test) */}
      {Object.keys(results).length > 0 && (
        <div className="bg-c-surface dark:bg-black/60 rounded-xl shadow-lg p-6 font-mono text-xs text-emerald-200 overflow-auto max-h-96 border border-white/10">
          <h3 className="text-c-text-secondary mb-4 border-b border-white/5 pb-2 flex justify-between">
            <span>
              {t('admin.aiControlCenter.missionControl.latestLogs', 'LATEST DIAGNOSTIC LOGS')}
            </span>
            <button
              onClick={() => setResults({})}
              className="text-slate-600 hover:bg-white/[0.05] rounded px-2 py-1 transition-colors"
            >
              {t('admin.aiControlCenter.missionControl.clear', 'Clear')}
            </button>
          </h3>
          {Object.entries(results)
            .reverse()
            .map(([id, res]) => (
              <div key={id} className="mb-4">
                <div className="flex gap-2">
                  <span className="text-blue-300">[{new Date().toLocaleTimeString(localeListy())}]</span>
                  <span className="text-amber-300">{id.toUpperCase()}</span>
                  <span
                    className={res.status === 'SUCCESS' ? 'text-emerald-200' : 'text-danger-200'}
                  >
                    {t(
                      'admin.aiControlCenter.missionControl.resultLatency',
                      '{{status}} ({{latency}}ms)',
                      {
                        status: res.status,
                        latency: res.latency,
                      }
                    )}
                  </span>
                </div>
                {res.error && (
                  <div className="text-danger-200 ml-4">
                    {t('admin.aiControlCenter.missionControl.errorLabel', 'Error: {{error}}', {
                      error: res.error,
                    })}
                  </div>
                )}
                {res.details !== null && res.details !== undefined && (
                  <pre className="ml-4 mt-1 text-c-text-secondary whitespace-pre-wrap break-words">
                    {JSON.stringify(res.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
