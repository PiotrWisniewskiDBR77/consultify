import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Admin/shared/Button';
import { Card } from '@/components/Admin/shared/Card';
import { MetricCard } from '@/components/Admin/shared/MetricCard';
import { Api } from '@/services/api';

type UseCasePurpose = {
  purpose: string;
  assignmentCount: number;
  eligibleAssignmentCount?: number;
  status: 'healthy' | 'degraded' | 'critical' | 'missing' | 'unknown';
  policyAllowed?: boolean;
  enabledForOrg?: boolean;
  residencyStatus?: 'allowed' | 'review' | 'restricted' | string;
  primary: null | {
    provider: string;
    name: string;
    modelId: string;
    healthStatus: string;
  };
  fallbacks: Array<{
    provider: string;
    name: string;
    modelId: string;
    healthStatus: string;
  }>;
  usage: {
    requests30d: number;
    costUsd30d: number;
    avgLatencyMs30d: number;
  };
};

type UseCaseCard = {
  key: string;
  label: string;
  description: string;
  businessOwner: string;
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  coveragePct: number;
  healthyPurposes: number;
  degradedPurposes: number;
  criticalPurposes: number;
  costUsd30d: number;
  requests30d: number;
  purposes: UseCasePurpose[];
};

const STATUS_STYLES: Record<string, string> = {
  healthy: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  degraded: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  critical: 'bg-red-500/10 text-red-700 dark:text-red-300',
  missing: 'bg-red-500/10 text-red-700 dark:text-red-300',
  unknown: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
};

const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(Number(value || 0));

export const AIUseCaseControlPlane: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<{
    useCases: UseCaseCard[];
    summary: any;
    riskFeed?: Array<{
      severity: string;
      title: string;
      blastRadius: string;
      recommendation: string;
    }>;
    vendorScorecards?: Array<{
      provider: string;
      costUsd: number;
      requests: number;
      avgLatencyMs: number;
      sharePct: number;
    }>;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await Api.getLLMUseCaseOverview();
      setOverview(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = overview?.summary || {};
  const useCases = overview?.useCases || [];

  const deliveryRisk = useMemo(
    () => useCases.filter((useCase) => useCase.status === 'critical').length,
    [useCases]
  );

  return (
    <div className="p-6 overflow-y-auto h-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('aiPlatform.controlPlane.title', 'AI Operating System')}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {t(
              'aiPlatform.controlPlane.subtitle',
              'Business control plane for chat, documents, reports, presentations, visuals, and delivery risk.'
            )}
          </p>
        </div>
        <Button onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {t('common.refresh', 'Refresh')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t('aiPlatform.controlPlane.kpi.useCases', 'Use cases')}
          value={String(summary.total || 0)}
          icon={CheckCircle2}
        />
        <MetricCard
          label={t('aiPlatform.controlPlane.kpi.healthy', 'Healthy')}
          value={String(summary.healthy || 0)}
          icon={CheckCircle2}
        />
        <MetricCard
          label={t('aiPlatform.controlPlane.kpi.degraded', 'Degraded')}
          value={String(summary.degraded || 0)}
          icon={AlertTriangle}
        />
        <MetricCard
          label={t('aiPlatform.controlPlane.kpi.deliveryRisk', 'Delivery risk')}
          value={String(deliveryRisk)}
          icon={ShieldAlert}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard
          label={t('aiPlatform.controlPlane.kpi.mtdSpend', 'MTD spend')}
          value={formatUsd(Number(summary.mtdSpendUsd || 0))}
          icon={DollarSign}
        />
        <MetricCard
          label={t('aiPlatform.controlPlane.kpi.monthEndForecast', 'Month-end forecast')}
          value={formatUsd(Number(summary.projectedMonthEndSpendUsd || 0))}
          icon={AlertTriangle}
        />
        <MetricCard
          label={t('aiPlatform.controlPlane.kpi.impactedOrgs', 'Impacted orgs')}
          value={String(summary.impactedOrganizations || 0)}
          icon={Users}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {t('aiPlatform.controlPlane.risks', 'Top risks')}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {overview?.riskFeed?.length || 0}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {(overview?.riskFeed || []).slice(0, 5).map((risk, index) => (
              <div
                key={`${risk.title}-${index}`}
                className="rounded-xl bg-slate-100/70 px-4 py-3 dark:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {risk.title}
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-medium ${STATUS_STYLES[risk.severity] || STATUS_STYLES.unknown}`}
                  >
                    {risk.severity}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {risk.blastRadius}
                </div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {risk.recommendation}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {t('aiPlatform.controlPlane.vendors', 'Vendor scorecards')}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {summary.topVendor
                ? `${summary.topVendor} ${summary.vendorConcentrationPct || 0}%`
                : 'n/a'}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {(overview?.vendorScorecards || []).slice(0, 5).map((vendor) => (
              <div
                key={vendor.provider}
                className="rounded-xl bg-slate-100/70 px-4 py-3 dark:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {vendor.provider}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {vendor.sharePct}% share
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{formatUsd(vendor.costUsd)}</span>
                  <span>{vendor.requests} requests</span>
                  <span>{Math.round(vendor.avgLatencyMs || 0)} ms avg latency</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {useCases.map((useCase) => (
          <Card key={useCase.key} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {useCase.label}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[useCase.status] || STATUS_STYLES.unknown}`}
                  >
                    {useCase.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {useCase.description}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {t('aiPlatform.controlPlane.owner', 'Owner')}: {useCase.businessOwner}
                </p>
              </div>
              <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                <div>
                  {t('aiPlatform.controlPlane.coverage', 'Coverage')}: {useCase.coveragePct}%
                </div>
                <div>
                  {t('aiPlatform.controlPlane.requests30d', 'Requests 30d')}: {useCase.requests30d}
                </div>
                <div>
                  {t('aiPlatform.controlPlane.cost30d', 'Cost 30d')}:{' '}
                  {formatUsd(useCase.costUsd30d)}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-slate-100/70 p-3 dark:bg-white/[0.04]">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t('aiPlatform.controlPlane.healthyPurposes', 'Healthy')}
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                  {useCase.healthyPurposes}
                </div>
              </div>
              <div className="rounded-xl bg-slate-100/70 p-3 dark:bg-white/[0.04]">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t('aiPlatform.controlPlane.degradedPurposes', 'Degraded')}
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                  {useCase.degradedPurposes}
                </div>
              </div>
              <div className="rounded-xl bg-slate-100/70 p-3 dark:bg-white/[0.04]">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t('aiPlatform.controlPlane.criticalPurposes', 'Critical')}
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                  {useCase.criticalPurposes}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {useCase.purposes.map((purpose) => (
                <div
                  key={purpose.purpose}
                  className="rounded-xl bg-slate-100/70 px-4 py-3 dark:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-mono text-xs text-slate-800 dark:text-slate-200">
                        {purpose.purpose}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {purpose.primary
                          ? `${purpose.primary.provider} / ${purpose.primary.modelId}`
                          : t('aiPlatform.controlPlane.noPrimary', 'No primary model')}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-medium ${STATUS_STYLES[purpose.status] || STATUS_STYLES.unknown}`}
                    >
                      {purpose.status}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>
                      {t('aiPlatform.controlPlane.assignments', 'Assignments')}:{' '}
                      {purpose.assignmentCount}
                    </span>
                    <span>
                      {t('aiPlatform.controlPlane.eligibleAssignments', 'Eligible')}:{' '}
                      {purpose.eligibleAssignmentCount ?? purpose.assignmentCount}
                    </span>
                    <span>
                      {t('aiPlatform.controlPlane.requests', 'Requests')}:{' '}
                      {purpose.usage.requests30d}
                    </span>
                    <span>
                      {t('aiPlatform.controlPlane.avgLatency', 'Avg latency')}:{' '}
                      {Math.round(purpose.usage.avgLatencyMs30d || 0)} ms
                    </span>
                    <span>
                      {t('aiPlatform.controlPlane.cost', 'Cost')}:{' '}
                      {formatUsd(purpose.usage.costUsd30d || 0)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                        purpose.policyAllowed === false
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                      }`}
                    >
                      {purpose.policyAllowed === false
                        ? t('aiPlatform.controlPlane.policyBlocked', 'Policy blocked')
                        : t('aiPlatform.controlPlane.policyAllowed', 'Policy allowed')}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                        purpose.enabledForOrg === false
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                      }`}
                    >
                      {purpose.enabledForOrg === false
                        ? t('aiPlatform.controlPlane.disabledForOrg', 'Disabled for org')
                        : t('aiPlatform.controlPlane.enabledForOrg', 'Enabled for org')}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
                      {t('aiPlatform.controlPlane.residency', 'Residency')}:{' '}
                      {purpose.residencyStatus || 'allowed'}
                    </span>
                  </div>

                  {purpose.fallbacks.length > 0 ? (
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {t('aiPlatform.controlPlane.fallbacks', 'Fallbacks')}:{' '}
                      {purpose.fallbacks.map((fallback) => fallback.modelId).join(' -> ')}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AIUseCaseControlPlane;
