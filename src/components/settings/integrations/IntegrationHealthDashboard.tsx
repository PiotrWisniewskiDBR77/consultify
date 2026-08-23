/**
 * IntegrationHealthDashboard - Integration Monitoring & Management
 *
 * Features:
 * - Integration health status
 * - Integration usage statistics
 * - Integration error logs
 * - Integration sync status
 * - Bulk disconnect integrations
 */

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';
import { EmptyState } from '@/components/ui/composed';
import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../../services/api';
import { shouldFallbackToLegacySync, V8SyncApi } from '../../../services/api/v8/sync';
import { User } from '../../../types';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState } from '../../Admin/AdminState';

interface IntegrationHealthDashboardProps {
  currentUser: User;
}

interface IntegrationHealth {
  id: string;
  name: string;
  icon: string;
  status: 'healthy' | 'warning' | 'error' | 'disconnected';
  lastSync: string;
  nextSync: string;
  syncFrequency: string;
  errorCount: number;
  lastError?: string;
  usageStats: {
    requestsToday: number;
    requestsThisMonth: number;
    dataTransferred: string;
  };
  enabled: boolean;
}

interface IntegrationHealthRow {
  integrationId?: string;
  id?: string;
  connectorId?: string;
  name?: string;
  icon?: string;
  status?: string;
  enabled?: boolean;
  lastRunAt?: string;
  syncFrequency?: string;
  unresolvedErrorCount?: number;
  errorCount?: number;
  lastError?: string;
  requestsToday?: number;
  requestsThisMonth?: number;
  dataTransferred?: string;
}

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
};

export const IntegrationHealthDashboard: React.FC<IntegrationHealthDashboardProps> = ({
  currentUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationHealth[]>([]);
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);
  const [showErrorLogs, setShowErrorLogs] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const mapToHealth = useCallback(
    (h: IntegrationHealthRow): IntegrationHealth => ({
      id: h.integrationId || h.id || h.connectorId || 'unknown-integration',
      name: h.connectorId || h.name || 'Integration',
      icon: h.icon || '🔗',
      status:
        h.status === 'healthy'
          ? 'healthy'
          : h.status === 'degraded'
            ? 'warning'
            : h.status === 'unhealthy'
              ? 'error'
              : 'disconnected',
      lastSync: h.lastRunAt || '',
      nextSync: '',
      syncFrequency: h.syncFrequency || 'On demand',
      errorCount: h.unresolvedErrorCount || h.errorCount || 0,
      lastError: h.lastError,
      usageStats: {
        requestsToday: h.requestsToday || 0,
        requestsThisMonth: h.requestsThisMonth || 0,
        dataTransferred: h.dataTransferred || '—',
      },
      enabled: typeof h.enabled === 'boolean' ? h.enabled : h.status !== 'disconnected',
    }),
    []
  );

  const loadHealthData = useCallback(async (): Promise<IntegrationHealth[] | null> => {
    try {
      setLoading(true);
      setLoadError(null);

      // Try V8 API first
      try {
        const v8Data = await V8SyncApi.getHubHealth();
        if (v8Data?.summary) {
          // V8 health returns a summary; fall through to legacy for per-integration detail
          throw new Error('V8 summary only — need per-integration data');
        }
      } catch (v8Err: unknown) {
        if (!shouldFallbackToLegacySync(v8Err)) {
          // V8 available but no per-integration health; proceed to legacy
        }
      }

      // Legacy fallback
      const response = await Api.get('/api/sync-hub/health');
      let nextIntegrations: IntegrationHealth[] = [];
      if (response.integrations && Array.isArray(response.integrations)) {
        nextIntegrations = response.integrations.map(mapToHealth);
      } else if (response.success && response.data) {
        nextIntegrations = Array.isArray(response.data) ? response.data.map(mapToHealth) : [];
      }
      setIntegrations(nextIntegrations);
      return nextIntegrations;
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('integrations.health.loadError', 'Failed to load health data. Please try again.')
      );
      setLoadError(message);
      setIntegrations([]);
      return null;
    } finally {
      setLoading(false);
    }
  }, [mapToHealth, t]);

  useEffect(() => {
    void loadHealthData();
  }, [currentUser.id, loadHealthData]);

  const syncIntegration = async (integrationId: string) => {
    setSyncing(integrationId);
    try {
      setActionError(null);
      await Api.post(`/api/integrations/${integrationId}/sync`, {});
      const refreshed = await loadHealthData();
      if (!refreshed?.some((integration) => integration.id === integrationId)) {
        throw new Error('Integration sync was not confirmed by the server');
      }
      toast.success(t('integrations.health.syncInitiated', 'Sync initiated'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('integrations.health.syncFailed', 'Failed to sync integration')
      );
      setActionError(message);
      toast.error(message);
    } finally {
      setSyncing(null);
    }
  };

  const toggleIntegration = async (integrationId: string) => {
    const integration = integrations.find((i) => i.id === integrationId);
    if (!integration) return;

    try {
      setActionError(null);
      const expectedEnabled = !integration.enabled;
      await Api.put(`/api/integrations/${integrationId}/toggle`, { enabled: !integration.enabled });
      const refreshed = await loadHealthData();
      const persisted = refreshed?.find((item) => item.id === integrationId);
      if (!persisted || persisted.enabled !== expectedEnabled) {
        throw new Error('Integration toggle was not confirmed by the server');
      }
      toast.success(
        integration.enabled
          ? t('integrations.health.paused', 'Integration paused')
          : t('integrations.health.enabled', 'Integration enabled')
      );
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('integrations.health.updateFailed', 'Failed to update integration')
      );
      setActionError(message);
      toast.error(message);
    }
  };

  const bulkDisconnect = async () => {
    if (selectedIntegrations.length === 0) return;

    if (
      !window.confirm(
        t(
          'integrations.health.bulkDisconnectConfirm',
          `Disconnect ${selectedIntegrations.length} integration(s)?`
        )
      )
    )
      return;

    try {
      setActionError(null);
      const expectedDisconnected = [...selectedIntegrations];
      await Promise.all(
        expectedDisconnected.map((id) => Api.post(`/api/integrations/${id}/disconnect`, {}))
      );
      const refreshed = await loadHealthData();
      if (
        !refreshed ||
        refreshed.some(
          (integration) => expectedDisconnected.includes(integration.id) && integration.enabled
        )
      ) {
        throw new Error('Integration disconnect was not confirmed by the server');
      }
      setSelectedIntegrations([]);
      toast.success(t('integrations.health.disconnected', 'Integrations disconnected'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('integrations.health.disconnectFailed', 'Failed to disconnect some integrations')
      );
      setActionError(message);
      toast.error(message);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle size={18} className="text-green-500" />;
      case 'warning':
        return <AlertTriangle size={18} className="text-amber-500" />;
      case 'error':
        return <XCircle size={18} className="text-danger-500" />;
      default:
        return <AlertCircle size={18} className="text-c-text-secondary" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'border-green-500/50 bg-green-50 dark:bg-green-500/5';
      case 'warning':
        return 'border-amber-500/50 bg-amber-50 dark:bg-amber-500/5';
      case 'error':
        return 'border-danger-500/50 bg-danger-50 dark:bg-danger-500/5';
      default:
        return 'border-c-border-subtle dark:border-navy-700 bg-c-surface-raised';
    }
  };

  const totalStats = {
    requestsToday: integrations.reduce((sum, i) => sum + i.usageStats.requestsToday, 0),
    requestsThisMonth: integrations.reduce((sum, i) => sum + i.usageStats.requestsThisMonth, 0),
    healthy: integrations.filter((i) => i.status === 'healthy').length,
    warnings: integrations.filter((i) => i.status === 'warning').length,
    errors: integrations.filter((i) => i.status === 'error').length,
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Error banner */}
      {loadError && (
        <DegradedState title="Integration health unavailable" description={loadError} />
      )}

      {actionError && <Banner variant="danger" title={actionError} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Activity size={28} className="text-brand" />
            {t('settings.integrations.health.title', 'Integration Health')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t(
              'settings.integrations.health.subtitle',
              'Monitor and manage your connected integrations'
            )}
          </p>
        </div>
        {selectedIntegrations.length > 0 && !loadError && (
          <button
            onClick={bulkDisconnect}
            className="flex items-center gap-2 px-4 py-2 bg-danger-600 hover:bg-danger-500 text-white rounded-lg transition-colors"
          >
            <Trash2 size={16} />
            {t('integrations.health.bulkDisconnect', 'Disconnect')} ({selectedIntegrations.length})
          </button>
        )}
      </div>

      {/* Overview Stats */}
      {!loadError && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-c-text">{integrations.length}</p>
            <p className="text-sm text-c-text-muted">
              {t('integrations.health.statConnected', 'Connected')}
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{totalStats.healthy}</p>
            <p className="text-sm text-green-600">
              {t('integrations.health.statHealthy', 'Healthy')}
            </p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{totalStats.warnings}</p>
            <p className="text-sm text-amber-600">
              {t('integrations.health.statWarnings', 'Warnings')}
            </p>
          </div>
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-c-text">{totalStats.requestsToday}</p>
            <p className="text-sm text-c-text-muted">
              {t('integrations.health.statRequestsToday', 'Requests Today')}
            </p>
          </div>
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-c-text">
              {totalStats.requestsThisMonth.toLocaleString()}
            </p>
            <p className="text-sm text-c-text-muted">
              {t('integrations.health.statThisMonth', 'This Month')}
            </p>
          </div>
        </div>
      )}

      {/* Integration List */}
      {!loadError && (
        <div className="space-y-4">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className={`rounded-xl border-2 transition-all ${getStatusColor(integration.status)}`}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedIntegrations.includes(integration.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIntegrations([...selectedIntegrations, integration.id]);
                        } else {
                          setSelectedIntegrations(
                            selectedIntegrations.filter((id) => id !== integration.id)
                          );
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-2xl">{integration.icon}</span>
                    <div>
                      <h4 className="font-semibold text-c-text flex items-center gap-2">
                        {integration.name}
                        {getStatusIcon(integration.status)}
                      </h4>
                      <p className="text-sm text-c-text-muted">
                        {t('integrations.health.lastSync', 'Last sync')}:{' '}
                        {integration.lastSync
                          ? new Date(integration.lastSync).toLocaleString()
                          : '—'}
                        {integration.errorCount > 0 && (
                          <span className="ml-2 text-danger-500 font-medium">
                            ({integration.errorCount} {t('integrations.health.errors', 'errors')})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleIntegration(integration.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        integration.enabled
                          ? 'text-green-600 hover:bg-green-100 dark:hover:bg-green-500/20'
                          : 'text-c-text-secondary hover:bg-c-surface-raised'
                      }`}
                      title={
                        integration.enabled
                          ? t('integrations.health.pause', 'Pause')
                          : t('integrations.health.enable', 'Enable')
                      }
                    >
                      {integration.enabled ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <button
                      onClick={() => syncIntegration(integration.id)}
                      disabled={syncing === integration.id}
                      className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-colors disabled:opacity-50"
                      title={t('integrations.health.syncNow', 'Sync now')}
                    >
                      <RefreshCw
                        size={18}
                        className={syncing === integration.id ? 'animate-spin' : ''}
                      />
                    </button>
                    <button
                      onClick={() =>
                        setShowErrorLogs(showErrorLogs === integration.id ? null : integration.id)
                      }
                      className="p-2 text-c-text-muted hover:bg-c-surface-raised rounded-lg transition-colors"
                      title={t('integrations.health.viewLogs', 'View logs')}
                    >
                      <BarChart3 size={18} />
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-c-text-muted">
                      {t('integrations.health.syncFrequency', 'Sync Frequency')}
                    </p>
                    <p className="font-medium text-c-text">{integration.syncFrequency}</p>
                  </div>
                  <div>
                    <p className="text-c-text-muted">
                      {t('integrations.health.requestsToday', 'Requests Today')}
                    </p>
                    <p className="font-medium text-c-text">
                      {integration.usageStats.requestsToday}
                    </p>
                  </div>
                  <div>
                    <p className="text-c-text-muted">
                      {t('integrations.health.thisMonth', 'This Month')}
                    </p>
                    <p className="font-medium text-c-text">
                      {integration.usageStats.requestsThisMonth}
                    </p>
                  </div>
                  <div>
                    <p className="text-c-text-muted">
                      {t('integrations.health.dataTransferred', 'Data Transferred')}
                    </p>
                    <p className="font-medium text-c-text">
                      {integration.usageStats.dataTransferred}
                    </p>
                  </div>
                </div>

                {/* Error message */}
                {integration.lastError && (
                  <div className="mt-4 p-3 bg-danger-100 dark:bg-danger-500/20 rounded-lg">
                    <p className="text-sm text-danger-700 dark:text-danger-300 flex items-center gap-2">
                      <AlertTriangle size={16} />
                      {integration.lastError}
                    </p>
                  </div>
                )}

                {/* Expanded Logs — loaded from sync-runs API */}
                {showErrorLogs === integration.id && (
                  <RecentActivityPanel integrationId={integration.id} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {integrations.length === 0 && !loadError && (
        <EmptyState
          icon={<Activity />}
          title={t('integrations.health.noIntegrations', 'No integrations connected')}
        />
      )}
    </div>
  );
};

function RecentActivityPanel({ integrationId }: { integrationId: string }) {
  const { t } = useTranslation();
  const [runs, setRuns] = React.useState<
    Array<{
      id: string;
      status: string;
      items_processed?: number;
      started_at: string;
      error_summary?: string;
    }>
  >([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await Api.get(`/api/sync-hub/sync-runs/${integrationId}?limit=5`);
        if (!cancelled && resp.runs) setRuns(resp.runs);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [integrationId]);

  if (loading) {
    return (
      <div className="mt-4 p-4 bg-c-surface-raised rounded-lg flex items-center gap-2 text-sm text-c-text-muted">
        <Loader2 size={14} className="animate-spin" />{' '}
        {t('integrations.health.loadingActivity', 'Loading activity…')}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="mt-4 p-4 bg-c-surface-raised rounded-lg text-sm text-c-text-muted">
        {t('integrations.health.noRuns', 'No sync runs recorded yet.')}
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-c-surface-raised rounded-lg">
      <h5 className="font-medium text-c-text mb-2">
        {t('integrations.health.recentActivity', 'Recent Activity')}
      </h5>
      <div className="space-y-2 text-sm">
        {runs.map((run) => (
          <div
            key={run.id}
            className={`flex items-center gap-2 ${
              run.status === 'completed'
                ? 'text-green-600'
                : run.status === 'failed'
                  ? 'text-danger-500'
                  : 'text-amber-600'
            }`}
          >
            {run.status === 'completed' ? (
              <CheckCircle size={14} />
            ) : run.status === 'failed' ? (
              <XCircle size={14} />
            ) : (
              <Clock size={14} />
            )}
            <span>
              {run.status === 'completed'
                ? t('integrations.health.syncedItems', 'Synced {{count}} items', {
                    count: run.items_processed ?? 0,
                  })
                : run.status === 'failed'
                  ? run.error_summary || t('integrations.health.syncFailed', 'Sync failed')
                  : t('integrations.health.syncInProgress', 'Sync in progress')}
            </span>
            <span className="text-c-text-secondary ml-auto">{formatTimestamp(run.started_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default IntegrationHealthDashboard;
