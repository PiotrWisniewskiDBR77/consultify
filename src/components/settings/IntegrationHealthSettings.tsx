/**
 * IntegrationHealthSettings - Health Monitoring Dashboard
 *
 * Features:
 * - Status dashboard per integration
 * - Health check history
 * - Alert configuration
 * - Automatic reconnection settings
 */

import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  Loader2,
  RefreshCw,
  Settings,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/composed';

import { Api } from '../../services/api';

interface IntegrationHealthSettingsProps {
  className?: string;
  currentUser?: any;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  latency_ms?: number;
  error_message?: string;
  check_type?: string;
  checked_at?: string;
}

interface HealthCheckHistory {
  id: string;
  status: string;
  latency_ms?: number;
  error_message?: string;
  check_type: string;
  checked_at: string;
}

interface Integration {
  id: string;
  provider: string;
  name?: string;
  is_active: boolean;
}

export const IntegrationHealthSettings: React.FC<IntegrationHealthSettingsProps> = ({
  className = '',
  currentUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [healthStatuses, setHealthStatuses] = useState<Record<string, HealthStatus>>({});
  const [healthHistory, setHealthHistory] = useState<Record<string, HealthCheckHistory[]>>({});
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [autoReconnect, setAutoReconnect] = useState<Record<string, boolean>>({});
  const [alertEnabled, setAlertEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchIntegrations();
  }, []);

  useEffect(() => {
    if (integrations.length > 0) {
      fetchAllHealthStatuses();
      if (!selectedIntegration) {
        setSelectedIntegration(integrations[0].id);
      }
    }
  }, [integrations]);

  useEffect(() => {
    if (selectedIntegration) {
      fetchHealthHistory(selectedIntegration);
    }
  }, [selectedIntegration]);

  const fetchIntegrations = async () => {
    try {
      if (!currentUser?.organizationId) return;

      const data = await Api.get(
        `/api/settings/integrations?organizationId=${currentUser.organizationId}`
      );
      setIntegrations(data || []);
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
      toast.error(t('settings.health.fetchError', 'Failed to load integrations'));
    } finally {
      setLoading(false);
    }
  };

  const fetchAllHealthStatuses = async () => {
    const statuses: Record<string, HealthStatus> = {};

    for (const integration of integrations) {
      try {
        const data = await Api.get(`/api/settings/integrations/${integration.id}/health`);
        if (data?.status) {
          statuses[integration.id] = data.status;
        }
      } catch (error) {
        console.error(`Failed to fetch health for ${integration.id}:`, error);
        statuses[integration.id] = { status: 'unknown' };
      }
    }

    setHealthStatuses(statuses);
  };

  const fetchHealthHistory = async (integrationId: string) => {
    try {
      const data = await Api.get(`/api/settings/integrations/${integrationId}/health`);
      if (data?.history) {
        setHealthHistory((prev) => ({
          ...prev,
          [integrationId]: data.history,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch health history:', error);
    }
  };

  const runHealthCheck = async (integrationId: string) => {
    try {
      await Api.post(`/api/settings/integrations/${integrationId}/health-check`, {
        checkType: 'manual',
      });
      toast.success(t('settings.health.checkStarted', 'Health check started'));
      setTimeout(() => {
        fetchAllHealthStatuses();
        fetchHealthHistory(integrationId);
      }, 2000);
    } catch (error) {
      toast.error(t('settings.health.checkError', 'Failed to run health check'));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'degraded':
        return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30';
      case 'down':
        return 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30';
      default:
        return 'text-c-text-secondary bg-c-surface-raised';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'degraded':
        return <AlertTriangle size={16} className="text-amber-500" />;
      case 'down':
        return <XCircle size={16} className="text-rose-500" />;
      default:
        return <Clock size={16} className="text-c-text-muted" />;
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-48 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-c-text flex items-center gap-2">
            <Activity size={20} />
            {t('settings.health.title', 'Integration Health')}
          </h3>
          <p className="text-sm text-c-text-muted mt-1">
            {t('settings.health.description', 'Monitor connection health and configure alerts')}
          </p>
        </div>
        <button
          onClick={fetchAllHealthStatuses}
          className="p-2 text-c-text-secondary hover:text-brand rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-700 transition-colors"
          title={t('common.refresh', 'Refresh')}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {integrations.length === 0 ? (
        <EmptyState
          icon={<Activity />}
          title={t(
            'settings.health.noIntegrations',
            'No integrations available. Connect an integration to monitor health.'
          )}
        />
      ) : (
        <>
          {/* Health Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((integration) => {
              const status = healthStatuses[integration.id] || { status: 'unknown' };
              const isHealthy = status.status === 'healthy';

              return (
                <div
                  key={integration.id}
                  className={`p-4 rounded-lg border transition-all ${
                    isHealthy
                      ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30'
                      : status.status === 'degraded'
                        ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30'
                        : 'bg-rose-50/50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-900/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status.status)}
                      <div>
                        <p className="font-semibold text-c-text text-sm">
                          {integration.provider}
                        </p>
                        {integration.name && (
                          <p className="text-xs text-c-text-muted">
                            {integration.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(status.status)}`}
                    >
                      {t(`settings.health.status.${status.status}`, status.status)}
                    </span>
                  </div>

                  {status.latency_ms !== undefined && (
                    <div className="flex items-center gap-2 text-xs text-c-text-secondary mb-2">
                      <Zap size={12} />
                      <span>
                        {status.latency_ms}ms {t('settings.health.latency', 'latency')}
                      </span>
                    </div>
                  )}

                  {status.error_message && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mb-2 truncate">
                      {status.error_message}
                    </p>
                  )}

                  {status.checked_at && (
                    <p className="text-xs text-c-text-muted mb-3">
                      {t('settings.health.lastChecked', 'Last checked')}:{' '}
                      {new Date(status.checked_at).toLocaleString()}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => runHealthCheck(integration.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-c-text-secondary hover:text-brand border border-c-border-subtle dark:border-navy-700 rounded hover:bg-c-surface-raised dark:hover:bg-navy-700 transition-colors"
                    >
                      <RefreshCw size={12} />
                      {t('settings.health.checkNow', 'Check Now')}
                    </button>
                    <button
                      onClick={() => setSelectedIntegration(integration.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-c-text-secondary hover:text-brand border border-c-border-subtle dark:border-navy-700 rounded hover:bg-c-surface-raised dark:hover:bg-navy-700 transition-colors"
                    >
                      <Settings size={12} />
                      {t('common.details', 'Details')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Health History & Settings */}
          {selectedIntegration && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Health History */}
              <div className="lg:col-span-2 bg-c-surface rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700">
                <div className="p-4 border-b border-c-border-subtle dark:border-navy-700">
                  <h4 className="text-sm font-semibold text-c-text">
                    {t('settings.health.history', 'Health Check History')}
                  </h4>
                </div>
                <div className="p-4">
                  {healthHistory[selectedIntegration]?.length > 0 ? (
                    <div className="space-y-2">
                      {healthHistory[selectedIntegration].slice(0, 20).map((check) => (
                        <div
                          key={check.id}
                          className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {getStatusIcon(check.status)}
                            <div>
                              <p className="text-sm font-medium text-c-text">
                                {t(`settings.health.status.${check.status}`, check.status)}
                              </p>
                              <p className="text-xs text-c-text-muted">
                                {check.check_type} •{' '}
                                {check.latency_ms ? `${check.latency_ms}ms` : 'N/A'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-c-text-muted">
                              {new Date(check.checked_at).toLocaleString()}
                            </p>
                            {check.error_message && (
                              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 truncate max-w-xs">
                                {check.error_message}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      compact
                      preset="noData"
                      title={t('settings.health.noHistory', 'No health check history available')}
                    />
                  )}
                </div>
              </div>

              {/* Alert & Reconnection Settings */}
              <div className="space-y-4">
                {/* Auto Reconnection */}
                <div className="p-4 bg-c-surface rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-c-text flex items-center gap-2">
                      <Zap size={14} />
                      {t('settings.health.autoReconnect', 'Auto Reconnect')}
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoReconnect[selectedIntegration] || false}
                        onChange={(e) =>
                          setAutoReconnect((prev) => ({
                            ...prev,
                            [selectedIntegration]: e.target.checked,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-c-surface-raised peer-focus:ring-2 peer-focus:ring-[color:var(--c-focus)] rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-c-surface after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>
                  <p className="text-xs text-c-text-muted">
                    {t(
                      'settings.health.autoReconnectDesc',
                      'Automatically attempt to reconnect when connection fails'
                    )}
                  </p>
                </div>

                {/* Alert Configuration */}
                <div className="p-4 bg-c-surface rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-c-text flex items-center gap-2">
                      <Bell size={14} />
                      {t('settings.health.alerts', 'Alerts')}
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alertEnabled[selectedIntegration] || false}
                        onChange={(e) =>
                          setAlertEnabled((prev) => ({
                            ...prev,
                            [selectedIntegration]: e.target.checked,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-c-surface-raised peer-focus:ring-2 peer-focus:ring-[color:var(--c-focus)] rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-c-surface after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>
                  <p className="text-xs text-c-text-muted">
                    {t(
                      'settings.health.alertsDesc',
                      'Receive notifications when integration health degrades'
                    )}
                  </p>
                </div>

                {/* Health Check Schedule */}
                <div className="p-4 bg-c-surface rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700">
                  <h5 className="text-sm font-medium text-c-text mb-3">
                    {t('settings.health.checkSchedule', 'Check Schedule')}
                  </h5>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs">
                      <input type="radio" name="schedule" defaultChecked className="text-brand" />
                      <span className="text-c-text-secondary">
                        {t('settings.health.every5min', 'Every 5 minutes')}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <input type="radio" name="schedule" className="text-brand" />
                      <span className="text-c-text-secondary">
                        {t('settings.health.every15min', 'Every 15 minutes')}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <input type="radio" name="schedule" className="text-brand" />
                      <span className="text-c-text-secondary">
                        {t('settings.health.everyHour', 'Every hour')}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default IntegrationHealthSettings;
