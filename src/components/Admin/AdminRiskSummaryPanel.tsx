import { AlertTriangle, FileText, ShieldAlert, Siren } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import i18n from '@/i18n';

import { Api } from '../../services/api';
import { DegradedState } from './AdminState';

type RiskSummary = {
  audit: {
    totalLogs: number;
    unresolvedCount: number;
    highRiskCount: number;
  };
  incidents: Array<{
    id: string;
    provider?: string;
    status?: string;
    severity?: string;
    started_at?: string;
    startedAt?: string;
  }>;
};

const emptySummary: RiskSummary = {
  audit: {
    totalLogs: 0,
    unresolvedCount: 0,
    highRiskCount: 0,
  },
  incidents: [],
};

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatIncidentStartedAt = (value?: string) => {
  if (!value) return i18n.t('admin.security.riskSummary.unknown', 'unknown');
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? i18n.t('admin.security.riskSummary.unknownTime', 'Unknown time')
    : date.toLocaleString();
};

const MetricCard: React.FC<{
  title: string;
  value: number;
  description: string;
  icon: React.ElementType;
}> = ({ title, value, description, icon: Icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm text-slate-500 dark:text-slate-400">{title}</div>
        <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</div>
      </div>
      <div className="rounded-xl bg-slate-100 p-3 text-slate-600 dark:bg-white/10 dark:text-slate-200">
        <Icon className="h-5 w-5" />
      </div>
    </div>
    <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">{description}</div>
  </div>
);

export const AdminRiskSummaryPanel: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await Api.getAdminRiskSummary();
      const next = response?.summary || emptySummary;
      setSummary({
        audit: {
          totalLogs: safeNumber(next.audit?.totalLogs),
          unresolvedCount: safeNumber(next.audit?.unresolvedCount),
          highRiskCount: safeNumber(next.audit?.highRiskCount),
        },
        incidents: Array.isArray(next.incidents) ? next.incidents : [],
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t('admin.security.riskSummary.errors.load', 'Failed to load risk summary');
      setSummary(null);
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
        {t('admin.security.riskSummary.loading', 'Loading risk summary...')}
      </div>
    );
  }

  if (loadError) {
    return (
      <DegradedState
        title={t('admin.security.riskSummary.unavailableTitle', 'Risk summary unavailable')}
        description={loadError}
        action={
          <button
            onClick={() => void loadSummary()}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
          >
            {t('admin.security.riskSummary.retry', 'Retry risk summary')}
          </button>
        }
      />
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title={t('admin.security.riskSummary.metrics.highRisk.title', 'High-risk audit events')}
          value={summary.audit.highRiskCount}
          description={t(
            'admin.security.riskSummary.metrics.highRisk.description',
            'Audit events with risk score at or above the tenant threshold.'
          )}
          icon={ShieldAlert}
        />
        <MetricCard
          title={t('admin.security.riskSummary.metrics.unresolved.title', 'Unresolved audit items')}
          value={summary.audit.unresolvedCount}
          description={t(
            'admin.security.riskSummary.metrics.unresolved.description',
            'Open audit items that still need administrative review.'
          )}
          icon={AlertTriangle}
        />
        <MetricCard
          title={t('admin.security.riskSummary.metrics.incidents.title', 'LLM incidents')}
          value={summary.incidents.length}
          description={t(
            'admin.security.riskSummary.metrics.incidents.description',
            'Recent LLM/provider incidents visible to tenant admins.'
          )}
          icon={Siren}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <FileText className="h-5 w-5 text-primary-500" />
          {t('admin.security.riskSummary.queue.title', 'Risk follow-up queue')}
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {t(
            'admin.security.riskSummary.queue.description',
            'Prioritize unresolved audit items and recent incidents before changing tenant security posture.'
          )}
        </p>
        {summary.incidents.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            {t(
              'admin.security.riskSummary.queue.empty',
              'No recent incidents returned by the risk service.'
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {summary.incidents.map((incident) => (
              <div
                key={incident.id}
                className="rounded-xl border border-slate-200 p-4 text-sm dark:border-white/10"
              >
                <div className="font-medium text-slate-900 dark:text-white">
                  {incident.provider ||
                    t('admin.security.riskSummary.queue.unknownProvider', 'Unknown provider')}{' '}
                  | {incident.severity || t('admin.security.riskSummary.unknown', 'unknown')}
                </div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">
                  {t('admin.security.riskSummary.queue.status', 'Status: {{status}}', {
                    status: incident.status || t('admin.security.riskSummary.unknown', 'unknown'),
                  })}{' '}
                  |{' '}
                  {t('admin.security.riskSummary.queue.started', 'Started: {{time}}', {
                    time: formatIncidentStartedAt(incident.startedAt || incident.started_at),
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRiskSummaryPanel;
