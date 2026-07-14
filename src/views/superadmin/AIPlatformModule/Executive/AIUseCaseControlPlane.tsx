import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DegradedState } from '@/components/Admin/AdminState';
import { Api } from '@/services/api';
import { normalizeApiErrorMessage } from '@/utils/apiError';
import { Button } from '@/views/superadmin/components/shared/Button';
import { Card } from '@/views/superadmin/components/shared/Card';
import { MetricCard } from '@/views/superadmin/components/shared/MetricCard';

type UseCasePurpose = {
  purpose: string;
  entrypoint?: string;
  assignmentCount: number;
  eligibleAssignmentCount?: number;
  status: 'healthy' | 'degraded' | 'critical' | 'missing' | 'unknown';
  policyAllowed?: boolean;
  enabledForOrg?: boolean;
  residencyStatus?: 'allowed' | 'review' | 'restricted' | string;
  releaseBundleId?: string | null;
  releaseStatus?: 'published' | 'ready' | 'blocked' | 'draft' | 'missing' | string;
  promptKey?: string | null;
  promptVersion?: string | null;
  policyVersion?: string | null;
  completenessStatus?: 'ready' | 'partial' | 'blocked' | string;
  completenessScore?: number;
  blockers?: string[];
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
  entrypoint?: string;
  uxStatus?: 'ready' | 'partial' | 'blocked' | string;
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  completenessStatus?: 'ready' | 'partial' | 'blocked' | string;
  completenessScore?: number;
  releaseCoveragePct?: number;
  coveragePct: number;
  healthyPurposes: number;
  degradedPurposes: number;
  criticalPurposes: number;
  costUsd30d: number;
  requests30d: number;
  purposes: UseCasePurpose[];
};

type UseCaseOverview = {
  useCases: UseCaseCard[];
  summary: Record<string, unknown>;
  riskFeed: Array<{
    severity: string;
    title: string;
    blastRadius: string;
    recommendation: string;
  }>;
  vendorScorecards: Array<{
    provider: string;
    costUsd: number;
    requests: number;
    avgLatencyMs: number;
    sharePct: number;
  }>;
};

type OperatorOps = {
  readinessScore: number;
  autonomyScore: number;
  guardrails: {
    releaseCoveragePct: number;
    promptTracePct: number;
    policyTracePct: number;
  };
  workstreams: Array<{
    key: string;
    label: string;
    status: string;
    coveragePct: number;
  }>;
};

const STATUS_STYLES: Record<string, string> = {
  healthy: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  degraded: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  critical: 'bg-danger-500/10 text-danger-700 dark:text-danger-300',
  missing: 'bg-danger-500/10 text-danger-700 dark:text-danger-300',
  unknown: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
};

const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(Number(value || 0));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getObjectPayload = (value: unknown): unknown => {
  let current = value;

  for (let depth = 0; depth < 4; depth += 1) {
    if (!isRecord(current) || !('data' in current)) break;
    current = current.data;
  }

  return current;
};

const asText = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const toBool = (value: unknown): boolean => value === true || value === 'true' || value === 1;

const normalizeModelRef = (value: unknown): UseCasePurpose['primary'] => {
  if (!isRecord(value)) return null;

  return {
    provider: asText(value.provider, 'unknown'),
    name: asText(value.name, 'Unknown model'),
    modelId: asText(value.modelId, 'unknown'),
    healthStatus: asText(value.healthStatus, 'unknown'),
  };
};

const normalizePurpose = (value: unknown): UseCasePurpose => {
  if (!isRecord(value)) {
    throw new Error('Use case purpose row was not an object');
  }

  const purpose = asText(value.purpose).trim();
  if (!purpose) {
    throw new Error('Use case purpose row was missing a purpose');
  }

  const usage = isRecord(value.usage) ? value.usage : {};

  return {
    purpose,
    entrypoint: asText(value.entrypoint) || undefined,
    assignmentCount: toNumber(value.assignmentCount),
    eligibleAssignmentCount: toNumber(
      value.eligibleAssignmentCount,
      toNumber(value.assignmentCount)
    ),
    status: asText(value.status, 'unknown') as UseCasePurpose['status'],
    policyAllowed: value.policyAllowed === undefined ? undefined : toBool(value.policyAllowed),
    enabledForOrg: value.enabledForOrg === undefined ? undefined : toBool(value.enabledForOrg),
    residencyStatus: asText(value.residencyStatus, 'allowed'),
    releaseBundleId: asText(value.releaseBundleId) || null,
    releaseStatus: asText(value.releaseStatus, 'missing'),
    promptKey: asText(value.promptKey) || null,
    promptVersion: asText(value.promptVersion) || null,
    policyVersion: asText(value.policyVersion) || null,
    completenessStatus: asText(value.completenessStatus, 'unknown'),
    completenessScore: toNumber(value.completenessScore),
    blockers: Array.isArray(value.blockers)
      ? value.blockers.map((item) => asText(item).trim()).filter(Boolean)
      : [],
    primary: normalizeModelRef(value.primary),
    fallbacks: Array.isArray(value.fallbacks)
      ? value.fallbacks
          .map(normalizeModelRef)
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      : [],
    usage: {
      requests30d: toNumber(usage.requests30d),
      costUsd30d: toNumber(usage.costUsd30d),
      avgLatencyMs30d: toNumber(usage.avgLatencyMs30d),
    },
  };
};

const normalizeUseCase = (value: unknown): UseCaseCard => {
  if (!isRecord(value)) {
    throw new Error('Use case row was not an object');
  }

  const key = asText(value.key).trim();
  if (!key) {
    throw new Error('Use case row was missing a key');
  }

  return {
    key,
    label: asText(value.label, key),
    description: asText(value.description),
    businessOwner: asText(value.businessOwner, 'Unassigned'),
    entrypoint: asText(value.entrypoint) || undefined,
    uxStatus: asText(value.uxStatus, 'unknown'),
    status: asText(value.status, 'unknown') as UseCaseCard['status'],
    completenessStatus: asText(value.completenessStatus, 'unknown'),
    completenessScore: toNumber(value.completenessScore),
    releaseCoveragePct: toNumber(value.releaseCoveragePct),
    coveragePct: toNumber(value.coveragePct),
    healthyPurposes: toNumber(value.healthyPurposes),
    degradedPurposes: toNumber(value.degradedPurposes),
    criticalPurposes: toNumber(value.criticalPurposes),
    costUsd30d: toNumber(value.costUsd30d),
    requests30d: toNumber(value.requests30d),
    purposes: Array.isArray(value.purposes) ? value.purposes.map(normalizePurpose) : [],
  };
};

const normalizeOverview = (value: unknown): UseCaseOverview => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload)) {
    throw new Error('Use case overview response was not an object');
  }

  if (!Array.isArray(payload.useCases)) {
    throw new Error('Use case overview response was missing useCases');
  }

  if (!isRecord(payload.summary)) {
    throw new Error('Use case overview response was missing summary');
  }

  return {
    useCases: payload.useCases.map(normalizeUseCase),
    summary: payload.summary,
    riskFeed: Array.isArray(payload.riskFeed)
      ? payload.riskFeed.map((risk) => ({
          severity: isRecord(risk) ? asText(risk.severity, 'unknown') : 'unknown',
          title: isRecord(risk) ? asText(risk.title, 'Untitled risk') : 'Untitled risk',
          blastRadius: isRecord(risk) ? asText(risk.blastRadius) : '',
          recommendation: isRecord(risk) ? asText(risk.recommendation) : '',
        }))
      : [],
    vendorScorecards: Array.isArray(payload.vendorScorecards)
      ? payload.vendorScorecards.filter(isRecord).map((vendor) => ({
          provider: asText(vendor.provider, 'unknown'),
          costUsd: toNumber(vendor.costUsd),
          requests: toNumber(vendor.requests),
          avgLatencyMs: toNumber(vendor.avgLatencyMs),
          sharePct: toNumber(vendor.sharePct),
        }))
      : [],
  };
};

const normalizeOperatorOps = (value: unknown): OperatorOps | null => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload)) return null;

  const guardrails = isRecord(payload.guardrails) ? payload.guardrails : {};

  return {
    readinessScore: toNumber(payload.readinessScore),
    autonomyScore: toNumber(payload.autonomyScore),
    guardrails: {
      releaseCoveragePct: toNumber(guardrails.releaseCoveragePct),
      promptTracePct: toNumber(guardrails.promptTracePct),
      policyTracePct: toNumber(guardrails.policyTracePct),
    },
    workstreams: Array.isArray(payload.workstreams)
      ? payload.workstreams.filter(isRecord).map((item) => ({
          key: asText(item.key, asText(item.label, 'workstream')),
          label: asText(item.label, 'Workstream'),
          status: asText(item.status, 'unknown'),
          coveragePct: toNumber(item.coveragePct),
        }))
      : [],
  };
};

export const AIUseCaseControlPlane: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overview, setOverview] = useState<UseCaseOverview | null>(null);
  const [operatorOps, setOperatorOps] = useState<OperatorOps | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [result, operator] = await Promise.all([
        Api.getLLMUseCaseOverview(),
        Api.getAIOperatorOps().catch(() => null),
      ]);
      setOverview(normalizeOverview(result));
      setOperatorOps(normalizeOperatorOps(operator));
    } catch (err: unknown) {
      setOverview(null);
      setOperatorOps(null);
      setLoadError(normalizeApiErrorMessage(err, 'Failed to load AI use case control plane'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = overview?.summary || {};
  const useCases = overview?.useCases || [];

  const deliveryRisk = useCases.filter((useCase) => useCase.status === 'critical').length;

  const renderHeader = () => (
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
  );

  if (loadError) {
    return (
      <div className="p-6 overflow-y-auto h-full space-y-6">
        {renderHeader()}
        <Card className="p-6">
          <DegradedState title="AI use case control plane unavailable" description={loadError} />
        </Card>
      </div>
    );
  }

  if (loading && !overview) {
    return (
      <div className="p-6 overflow-y-auto h-full space-y-6">
        {renderHeader()}
        <Card className="flex items-center justify-center p-10 text-sm text-slate-500 dark:text-slate-400">
          {t('common.loading', 'Loading...')}
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full space-y-6">
      {renderHeader()}

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard
          label={t('aiPlatform.controlPlane.kpi.ready', 'Ready')}
          value={String(summary.readinessReady || 0)}
          icon={CheckCircle2}
        />
        <MetricCard
          label={t('aiPlatform.controlPlane.kpi.partial', 'Partial')}
          value={String(summary.readinessPartial || 0)}
          icon={AlertTriangle}
        />
        <MetricCard
          label={t('aiPlatform.controlPlane.kpi.blocked', 'Blocked')}
          value={String(summary.readinessBlocked || 0)}
          icon={ShieldAlert}
        />
      </div>

      {operatorOps ? (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {t('aiPlatform.controlPlane.operator.title', 'AI Operator readiness')}
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {t(
                  'aiPlatform.controlPlane.operator.subtitle',
                  'Cross-workstream readiness for relationship, execution, communication, and value.'
                )}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                {operatorOps.readinessScore || 0}%
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('aiPlatform.controlPlane.operator.autonomy', 'Autonomy')}{' '}
                {operatorOps.autonomyScore || 0}%
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard
              label={t('aiPlatform.controlPlane.operator.release', 'Release trace')}
              value={`${operatorOps.guardrails?.releaseCoveragePct || 0}%`}
              icon={CheckCircle2}
            />
            <MetricCard
              label={t('aiPlatform.controlPlane.operator.prompt', 'Prompt trace')}
              value={`${operatorOps.guardrails?.promptTracePct || 0}%`}
              icon={AlertTriangle}
            />
            <MetricCard
              label={t('aiPlatform.controlPlane.operator.policy', 'Policy trace')}
              value={`${operatorOps.guardrails?.policyTracePct || 0}%`}
              icon={ShieldAlert}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {operatorOps.workstreams.map((item) => (
              <span
                key={item.key}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                  item.status === 'ready'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : item.status === 'partial'
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      : 'bg-danger-500/10 text-danger-700 dark:text-danger-300'
                }`}
              >
                <span>{item.label}</span>
                <span>{item.coveragePct}%</span>
              </span>
            ))}
          </div>
        </Card>
      ) : null}

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
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t('aiPlatform.controlPlane.entrypoint', 'Entrypoint')}:{' '}
                  {useCase.entrypoint || 'n/a'}
                </p>
              </div>
              <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                <div>
                  {t('aiPlatform.controlPlane.coverage', 'Coverage')}: {useCase.coveragePct}%
                </div>
                <div>
                  {t('aiPlatform.controlPlane.releaseCoverage', 'Release')}:{' '}
                  {useCase.releaseCoveragePct || 0}%
                </div>
                <div>
                  {t('aiPlatform.controlPlane.completeness', 'Completeness')}:{' '}
                  {useCase.completenessScore || 0}%
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

            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-medium ${STATUS_STYLES[useCase.completenessStatus || 'unknown'] || STATUS_STYLES.unknown}`}
              >
                {t('aiPlatform.controlPlane.readiness', 'Readiness')}:{' '}
                {useCase.completenessStatus || 'unknown'}
              </span>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-medium ${STATUS_STYLES[useCase.uxStatus || 'unknown'] || STATUS_STYLES.unknown}`}
              >
                {t('aiPlatform.controlPlane.uxStatus', 'UX')}: {useCase.uxStatus || 'unknown'}
              </span>
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
                    <span>
                      {t('aiPlatform.controlPlane.release', 'Release')}:{' '}
                      {purpose.releaseStatus || 'missing'}
                    </span>
                    <span>
                      {t('aiPlatform.controlPlane.trace', 'Trace')}:{' '}
                      {purpose.promptKey
                        ? `${purpose.promptKey}@${purpose.promptVersion || 'latest'}`
                        : 'missing'}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                        purpose.policyAllowed === false
                          ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/20 dark:text-danger-300'
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
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-medium ${STATUS_STYLES[purpose.completenessStatus || 'unknown'] || STATUS_STYLES.unknown}`}
                    >
                      {t('aiPlatform.controlPlane.readiness', 'Readiness')}:{' '}
                      {purpose.completenessStatus || 'unknown'}
                    </span>
                  </div>

                  {purpose.fallbacks.length > 0 ? (
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {t('aiPlatform.controlPlane.fallbacks', 'Fallbacks')}:{' '}
                      {purpose.fallbacks.map((fallback) => fallback.modelId).join(' -> ')}
                    </div>
                  ) : null}
                  {purpose.blockers && purpose.blockers.length > 0 ? (
                    <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                      {t('aiPlatform.controlPlane.blockers', 'Blockers')}:{' '}
                      {purpose.blockers.join(', ')}
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
