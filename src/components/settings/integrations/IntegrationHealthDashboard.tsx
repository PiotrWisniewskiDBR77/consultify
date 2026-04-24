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
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { shouldFallbackToLegacySync, V8SyncApi } from '../../../services/api/v8/sync';
import { User } from '../../../types';
import { InfoButton } from '../../shared/InfoButton';

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

  useEffect(() => {
    loadHealthData();
  }, [currentUser.id]);

  const mapToHealth = (h: any): IntegrationHealth => ({
    id: h.integrationId || h.id,
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
    enabled: h.status !== 'disconnected',
  });

  const loadHealthData = async () => {
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
      } catch (v8Err: any) {
        if (!shouldFallbackToLegacySync(v8Err)) {
          // V8 available but no per-integration health; proceed to legacy
        }
      }

      // Legacy fallback
      const response = await Api.get('/api/sync-hub/health');
      if (response.integrations && Array.isArray(response.integrations)) {
        setIntegrations(response.integrations.map(mapToHealth));
      } else if (response.success && response.data) {
        setIntegrations(Array.isArray(response.data) ? response.data.map(mapToHealth) : []);
      }
    } catch (error: any) {
      console.error('Error loading integration health:', error);
      setLoadError(
        t('integrations.health.loadError', 'Failed to load health data. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const syncIntegration = async (integrationId: string) => {
    setSyncing(integrationId);
    try {
      await Api.post(`/api/integrations/${integrationId}/sync`, {});
      toast.success(t('integrations.health.syncInitiated', 'Sync initiated'));
      loadHealthData();
    } catch (error) {
      toast.error(t('integrations.health.syncFailed', 'Failed to sync integration'));
    } finally {
      setSyncing(null);
    }
  };

  const toggleIntegration = async (integrationId: string) => {
    const integration = integrations.find((i) => i.id === integrationId);
    if (!integration) return;

    try {
      await Api.put(`/api/integrations/${integrationId}/toggle`, { enabled: !integration.enabled });
      setIntegrations(
        integrations.map((i) => (i.id === integrationId ? { ...i, enabled: !i.enabled } : i))
      );
      toast.success(
        integration.enabled
          ? t('integrations.health.paused', 'Integration paused')
          : t('integrations.health.enabled', 'Integration enabled')
      );
    } catch (error) {
      toast.error(t('integrations.health.updateFailed', 'Failed to update integration'));
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
      await Promise.all(
        selectedIntegrations.map((id) => Api.post(`/api/integrations/${id}/disconnect`, {}))
      );
      setIntegrations(integrations.filter((i) => !selectedIntegrations.includes(i.id)));
      setSelectedIntegrations([]);
      toast.success(t('integrations.health.disconnected', 'Integrations disconnected'));
    } catch (error) {
      toast.error(
        t('integrations.health.disconnectFailed', 'Failed to disconnect some integrations')
      );
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle size={18} className="text-green-500" />;
      case 'warning':
        return <AlertTriangle size={18} className="text-amber-500" />;
      case 'error':
        return <XCircle size={18} className="text-red-500" />;
      default:
        return <AlertCircle size={18} className="text-slate-400 dark:text-slate-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'border-green-500/50 bg-green-50 dark:bg-green-500/5';
      case 'warning':
        return 'border-amber-500/50 bg-amber-50 dark:bg-amber-500/5';
      case 'error':
        return 'border-red-500/50 bg-red-50 dark:bg-red-500/5';
      default:
        return 'border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950';
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
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <InfoButton cardId="settings-integration-health" position="top-right" />

      {/* Error banner */}
      {loadError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle size={16} />
          {loadError}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Activity size={28} className="text-brand" />
            {t('settings.integrations.health.title', 'Integration Health')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {t(
              'settings.integrations.health.subtitle',
              'Monitor and manage your connected integrations'
            )}
          </p>
        </div>
        {selectedIntegrations.length > 0 && (
          <button
            onClick={bulkDisconnect}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
          >
            <Trash2 size={16} />
            {t('integrations.health.bulkDisconnect', 'Disconnect')} ({selectedIntegrations.length})
          </button>
        )}
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{integrations.length}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
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
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {totalStats.requestsToday}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('integrations.health.statRequestsToday', 'Requests Today')}
          </p>
        </div>
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {totalStats.requestsThisMonth.toLocaleString()}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('integrations.health.statThisMonth', 'This Month')}
          </p>
        </div>
      </div>

      {/* Integration List */}
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
                    <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      {integration.name}
                      {getStatusIcon(integration.status)}
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t('integrations.health.lastSync', 'Last sync')}:{' '}
                      {integration.lastSync ? new Date(integration.lastSync).toLocaleString() : '—'}
                      {integration.errorCount > 0 && (
                        <span className="ml-2 text-red-500 font-medium">
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
                        : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
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
                    className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    title={t('integrations.health.viewLogs', 'View logs')}
                  >
                    <BarChart3 size={18} />
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">
                    {t('integrations.health.syncFrequency', 'Sync Frequency')}
                  </p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {integration.syncFrequency}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">
                    {t('integrations.health.requestsToday', 'Requests Today')}
                  </p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {integration.usageStats.requestsToday}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">
                    {t('integrations.health.thisMonth', 'This Month')}
                  </p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {integration.usageStats.requestsThisMonth}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">
                    {t('integrations.health.dataTransferred', 'Data Transferred')}
                  </p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {integration.usageStats.dataTransferred}
                  </p>
                </div>
              </div>

              {/* Error message */}
              {integration.lastError && (
                <div className="mt-4 p-3 bg-red-100 dark:bg-red-500/20 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
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

      {integrations.length === 0 && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <Activity size={48} className="mx-auto mb-4 opacity-30" />
          <p>{t('integrations.health.noIntegrations', 'No integrations connected')}</p>
        </div>
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
      <div className="mt-4 p-4 bg-slate-100 dark:bg-navy-950 rounded-lg flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={14} className="animate-spin" />{' '}
        {t('integrations.health.loadingActivity', 'Loading activity…')}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="mt-4 p-4 bg-slate-100 dark:bg-navy-950 rounded-lg text-sm text-slate-500 dark:text-slate-400">
        {t('integrations.health.noRuns', 'No sync runs recorded yet.')}
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-slate-100 dark:bg-navy-950 rounded-lg">
      <h5 className="font-medium text-slate-900 dark:text-white mb-2">
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
                  ? 'text-red-500'
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
            <span className="text-slate-400 dark:text-slate-500 ml-auto">
              {new Date(run.started_at).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default IntegrationHealthDashboard;
