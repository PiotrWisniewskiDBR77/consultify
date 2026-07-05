/**
 * StrategicLayerPanel — M15/W5 tasks 5.1–5.8 + M15-close D2/D3/D4/D10.
 * Renders BSC (4 perspectives) + BDN stats + adoption (DICE/sentiment) + benefit profiles
 * + OKR cascade + sustainment.
 * Data from /api/results-strategic/:projectId/strategic + /okr,
 * /api/results-extended/:projectId/adoption + /benefit-profiles + /sustainment.
 * Behind flag resultsFeatureFlags('strategicLayer').
 */
import {
  AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2,
  Layers, ListChecks, Minus, Target, TrendingUp,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { RagPill, type RagStatus } from './ResultsUIPrimitives';

interface BscPerspective {
  count: number;
  onTarget: number;
  below: number;
  noData: number;
  healthPct: number;
}

interface BdnStats {
  nodeCount: number;
  edgeCount: number;
  byType?: { benefit?: number; enabler?: number; change?: number; objective?: number };
}

type DiceZone = 'win' | 'worry' | 'woe';
type SentimentTrend = 'improving' | 'flat' | 'declining' | null;
type RiskLevel = 'low' | 'medium' | 'high';

interface AdoptionFlag {
  id: string;
  name?: string;
  adoptionScore?: number; // 0-1
  diceScore?: number; // 7-28
  diceZone?: DiceZone;
  sentimentTrend?: SentimentTrend;
  championCoveragePct?: number;
  risk?: RiskLevel;
  riskReasons?: string[];
  atRiskByAdoption?: boolean;
  atRisk: boolean;
  reason?: string;
}

interface SustainmentStatus {
  id: string;
  name: string;
  status: 'sustained' | 'at-risk' | 'unowned' | 'overdue-review';
  reasons: string[];
}

interface SustainmentSummary {
  total: number;
  sustained: number;
  atRisk: number;
  unowned: number;
}

interface StrategicData {
  bsc: {
    perspectives: Record<string, BscPerspective>;
    overallHealthPct: number;
    balanced: boolean;
  };
  bdn: {
    stats: BdnStats;
  };
  narrative: {
    executiveSummary?: string;
  };
}

interface AdoptionData {
  flags: AdoptionFlag[];
  total: number;
  atRiskCount: number;
  dataSource?: 'change-management' | 'realization-proxy';
}

// ── D2: benefit profiles ──
type BenefitType = 'financial' | 'non-financial' | 'strategic';
type BenefitCategory = 'revenue' | 'cost' | 'risk' | 'efficiency' | 'customer' | 'unknown';

interface BenefitProfile {
  kpiId: string;
  name: string;
  type: BenefitType;
  category: BenefitCategory;
  isDisBenefit: boolean;
  businessOwner: string | null;
  hasTarget: boolean;
  realizationPct: number | null; // 0-2
}

interface BenefitProfileSummary {
  total: number;
  financial: number;
  nonFinancial: number;
  strategic: number;
  withTarget: number;
  disBenefits: number;
  byCategory?: Record<string, number>;
}

interface BenefitProfileData {
  profiles: BenefitProfile[];
  summary: BenefitProfileSummary;
}

// ── D10: OKR cascade ──
interface KeyResult {
  id: string;
  label: string;
  baseline: number;
  target: number;
  current: number;
  weight: number;
}

interface Objective {
  id: string;
  label: string;
  parentId: string | null;
  keyResults: KeyResult[];
  score: number; // 0-1
  rollupScore: number; // 0-1
}

interface OkrSummary {
  total: number;
  onTrack: number;
  atRisk: number;
  offTrack: number;
  avgScore: number;
}

interface OkrData {
  objectives: Objective[];
  summary: OkrSummary;
}

interface SustainmentData {
  statuses: SustainmentStatus[];
  summary: SustainmentSummary;
}

const PERSPECTIVE_LABELS: Record<string, string> = {
  financial: 'Finance',
  customer: 'Customer',
  process: 'Processes',
  learning: 'Growth',
};

const STATUS_COLORS: Record<string, string> = {
  sustained: 'text-emerald-600 dark:text-emerald-400',
  'at-risk': 'text-amber-600 dark:text-amber-400',
  unowned: 'text-slate-500',
  'overdue-review': 'text-red-600 dark:text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  sustained: 'Sustained',
  'at-risk': 'At risk',
  unowned: 'Unowned',
  'overdue-review': 'Review overdue',
};

const DICE_ZONE_PILL: Record<DiceZone, string> = {
  win: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  worry: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  woe: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

const RISK_TO_RAG: Record<RiskLevel, RagStatus> = {
  low: 'green',
  medium: 'amber',
  high: 'red',
};

const BENEFIT_TYPE_PILL: Record<BenefitType, string> = {
  financial: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  'non-financial': 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300',
  strategic: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
};

function okrStatus(score: number): RagStatus {
  return score >= 0.7 ? 'green' : score >= 0.4 ? 'amber' : 'red';
}

interface Props {
  projectId?: string;
}

const StrategicLayerPanel: React.FC<Props> = ({ projectId = 'all' }) => {
  const { t } = useTranslation();
  const [strategic, setStrategic] = useState<StrategicData | null>(null);
  const [adoption, setAdoption] = useState<AdoptionData | null>(null);
  const [sustainment, setSustainment] = useState<SustainmentData | null>(null);
  const [benefitProfiles, setBenefitProfiles] = useState<BenefitProfileData | null>(null);
  const [okr, setOkr] = useState<OkrData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      Api.get(`/results-strategic/${projectId}/strategic`),
      Api.get(`/results-extended/${projectId}/adoption`),
      Api.get(`/results-extended/${projectId}/sustainment`),
      Api.get(`/results-extended/${projectId}/benefit-profiles`),
      Api.get(`/results-strategic/${projectId}/okr`),
    ]).then(([s, a, su, bp, ok]) => {
      if (s.status === 'fulfilled') setStrategic((s.value as any)?.data ?? s.value);
      if (a.status === 'fulfilled') setAdoption((a.value as any)?.data ?? a.value);
      if (su.status === 'fulfilled') setSustainment((su.value as any)?.data ?? su.value);
      if (bp.status === 'fulfilled') setBenefitProfiles((bp.value as any)?.data ?? bp.value);
      if (ok.status === 'fulfilled') setOkr((ok.value as any)?.data ?? ok.value);
    }).finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div data-testid="strategic-layer-loading" className="flex items-center justify-center py-12 text-slate-400 text-sm">
        <Layers size={16} className="mr-2 animate-pulse" />
        {t('common.loading', 'Loading...')}
      </div>
    );
  }

  const bscPerspectives = strategic?.bsc?.perspectives ?? null;
  const bdnStats = strategic?.bdn?.stats;
  const adoptionFlags = adoption?.flags ?? [];
  const sustainStatuses = sustainment?.statuses ?? [];
  const sustainSummary = sustainment?.summary;
  const profiles = benefitProfiles?.profiles ?? [];
  const profileSummary = benefitProfiles?.summary;
  const objectives = okr?.objectives ?? [];
  const okrSummary = okr?.summary;
  const okrParents = objectives.filter((o) => o.parentId == null);

  // D3/D4: flags with real change-management data first (sentimentTrend != null)
  const richAdoptionFlags = adoptionFlags.filter((f) => f.sentimentTrend != null);
  const proxyAdoptionFlags = adoptionFlags.filter((f) => f.sentimentTrend == null);

  return (
    <div data-testid="strategic-layer-panel" className="space-y-6">

      {/* BSC — 4 perspectives */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
          <Target size={14} />
          {t('results.strategic.bsc', 'Balanced Scorecard')}
          {bscPerspectives != null && (
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              ({Object.values(bscPerspectives).reduce((s, p) => s + p.count, 0)} KPI)
            </span>
          )}
          {strategic?.bsc?.overallHealthPct != null && (
            <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
              strategic.bsc.overallHealthPct >= 0.7
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                : strategic.bsc.overallHealthPct >= 0.4
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}>
              {Math.round(strategic.bsc.overallHealthPct * 100)}% {t('results.strategic.bscHealth', 'health')}
            </span>
          )}
        </h3>

        {strategic?.bsc?.balanced === false && bscPerspectives && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle size={12} className="shrink-0" />
            {t('results.strategic.bscUnbalanced', 'Scorecard unbalanced — a KPI is missing in at least one perspective.')}
          </div>
        )}

        {!bscPerspectives ? (
          <div className="text-sm text-slate-400 py-4 text-center">
            {t('results.strategic.bscNoData', 'No KPIs — add KPIs and link them to initiatives.')}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['financial', 'customer', 'process', 'learning'] as const).map((persp) => {
              const p = bscPerspectives[persp] ?? null;
              const healthColor = p && p.healthPct >= 0.7 ? 'text-emerald-600 dark:text-emerald-400'
                : p && p.healthPct >= 0.4 ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400';
              return (
                <div key={persp} className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                    {t(`results.strategic.perspective.${persp}`, PERSPECTIVE_LABELS[persp])}
                  </div>
                  {p == null || p.count === 0 ? (
                    <div className="text-sm text-slate-400 italic py-2">
                      {t('results.strategic.perspectiveNoKpi', 'No KPIs')}
                    </div>
                  ) : (
                    <>
                      <div className={`text-2xl font-bold ${healthColor}`}>
                        {Math.round(p.healthPct * 100)}%
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {p.onTarget} OK / {p.below} below / {p.noData} none
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(p.healthPct * 100)}%` }} />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* BDN Stats */}
      {bdnStats && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <TrendingUp size={14} />
            {t('results.strategic.bdn', 'Benefits Dependency Network')}
          </h3>
          <div className="flex flex-wrap gap-3">
            {[
              { label: t('results.strategic.bdnBenefits', 'Benefits'), value: bdnStats.byType?.benefit ?? 0 },
              { label: t('results.strategic.bdnEnablers', 'Enablers'), value: bdnStats.byType?.enabler ?? 0 },
              { label: t('results.strategic.bdnLinks', 'Links'), value: bdnStats.edgeCount },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] px-4 py-2.5">
                <div className="text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
                <div className="text-xl font-semibold text-slate-800 dark:text-slate-100">{s.value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Adoption risk — D3/D4 (DICE + sentiment + champion coverage) */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
          <AlertTriangle size={14} />
          {t('results.strategic.adoption', 'Adoption → benefit risk')}
          {adoption && (
            <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              {adoption.atRiskCount} / {adoption.total}
            </span>
          )}
          {adoption?.dataSource && (
            <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${
              adoption.dataSource === 'change-management'
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300'
            }`}>
              {adoption.dataSource === 'change-management'
                ? t('results.strategic.adoptionSourceCm', 'Source: change management (ADKAR)')
                : t('results.strategic.adoptionSourceProxy', 'Source: delivery proxy (v1)')}
            </span>
          )}
        </h3>
        {adoptionFlags.length === 0 ? (
          <div className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 size={14} />
            {t('results.strategic.adoptionOk', 'No initiatives at risk from weak adoption.')}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {richAdoptionFlags.map((f) => (
                <div key={f.id} className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" title={f.name ?? f.id}>
                      {f.name ?? `ID ${f.id.slice(0, 8)}…`}
                    </span>
                    {f.diceZone && (
                      <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${DICE_ZONE_PILL[f.diceZone]}`}>
                        DICE {f.diceScore ?? '—'} · {t(`results.strategic.diceZone.${f.diceZone}`, f.diceZone)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {f.adoptionScore != null && (
                      <span>
                        {t('results.strategic.adoptionScore', 'Adoption')}:{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{Math.round(f.adoptionScore * 100)}%</span>
                      </span>
                    )}
                    {f.sentimentTrend && (
                      <span className="inline-flex items-center gap-1">
                        {t('results.strategic.sentiment', 'Sentiment')}:
                        {f.sentimentTrend === 'improving' ? (
                          <ArrowUpRight size={13} className="text-emerald-500" />
                        ) : f.sentimentTrend === 'declining' ? (
                          <ArrowDownRight size={13} className="text-red-500" />
                        ) : (
                          <Minus size={13} className="text-slate-400" />
                        )}
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {t(`results.strategic.trend.${f.sentimentTrend}`, f.sentimentTrend)}
                        </span>
                      </span>
                    )}
                    {f.championCoveragePct != null && (
                      <span>
                        {t('results.strategic.championCoverage', 'Change champions')}:{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{Math.round(f.championCoveragePct)}%</span>
                      </span>
                    )}
                    {f.risk && <RagPill status={RISK_TO_RAG[f.risk]} label={t(`results.strategic.risk.${f.risk}`, f.risk)} />}
                  </div>
                  {f.riskReasons && f.riskReasons.length > 0 && (
                    <details className="mt-2 group">
                      <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 select-none">
                        {t('results.strategic.riskReasons', 'Risk reasons')} ({f.riskReasons.length})
                      </summary>
                      <ul className="mt-1 ml-3 list-disc space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {f.riskReasons.map((r, i) => (<li key={i}>{r}</li>))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
            {proxyAdoptionFlags.length > 0 && (
              <div className="mt-2 text-xs text-slate-400">
                {t('results.strategic.adoptionProxyMore', '+{{count}} flagged from proxy data (no sentiment signal)', { count: proxyAdoptionFlags.length })}
              </div>
            )}
          </>
        )}
      </section>

      {/* Benefit profiles — D2 */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
          <Layers size={14} />
          {t('results.strategic.benefitProfiles', 'Benefit profile')}
          {profileSummary && (
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              {t(
                'results.strategic.benefitProfilesSummary',
                '{{total}} benefits · {{financial}} financial · {{withTarget}} with target',
                {
                  total: profileSummary.total,
                  financial: profileSummary.financial,
                  withTarget: profileSummary.withTarget,
                },
              )}
              {profileSummary.disBenefits > 0 && (
                <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                  {t('results.strategic.disBenefits', '{{count}} dis-benefit', { count: profileSummary.disBenefits })}
                </span>
              )}
            </span>
          )}
        </h3>
        {profiles.length === 0 ? (
          <div className="text-sm text-slate-400 py-4 text-center">
            {t('results.strategic.benefitProfilesNoData', 'No benefit profiles — define KPIs with a type and target.')}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {profiles.map((p) => (
              <div key={p.kpiId} className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-3">
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" title={p.name}>{p.name}</span>
                  {p.isDisBenefit && (
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                      {t('results.strategic.disBenefitTag', 'dis-benefit')}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {p.realizationPct != null ? `${Math.round(p.realizationPct * 100)}%` : '—'}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BENEFIT_TYPE_PILL[p.type]}`}>
                    {t(`results.strategic.benefitType.${p.type}`, p.type)}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">
                    {t(`results.strategic.benefitCategory.${p.category}`, p.category)}
                  </span>
                  {!p.hasTarget && (
                    <span className="text-xs text-slate-400">{t('results.strategic.benefitNoTarget', 'no target')}</span>
                  )}
                  {p.businessOwner && (
                    <span className="ml-auto text-xs text-slate-400 truncate">{p.businessOwner}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* OKR cascade — D10 */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
          <ListChecks size={14} />
          {t('results.strategic.okr', 'OKR — objective cascade')}
          {okrSummary && objectives.length > 0 && (
            <span className="ml-auto flex items-center gap-2 text-xs font-normal text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {Math.round(okrSummary.avgScore * 100)}% {t('results.strategic.okrAvg', 'avg')}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400">{okrSummary.onTrack} {t('results.strategic.okrOnTrack', 'on track')}</span>
              <span className="text-amber-600 dark:text-amber-400">{okrSummary.atRisk} {t('results.strategic.okrAtRisk', 'at risk')}</span>
              <span className="text-red-600 dark:text-red-400">{okrSummary.offTrack} {t('results.strategic.okrOffTrack', 'off track')}</span>
            </span>
          )}
        </h3>
        {objectives.length === 0 ? (
          <div className="text-sm text-slate-400 py-4 text-center">
            {t('results.strategic.okrNoData', 'No OKRs defined')}
          </div>
        ) : (
          <div className="space-y-3">
            {okrParents.map((parent) => {
              const children = objectives.filter((o) => o.parentId === parent.id);
              return (
                <div key={parent.id} className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4">
                  <div className="flex items-center gap-2">
                    <Target size={14} className="text-slate-400 shrink-0" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate" title={parent.label}>{parent.label}</span>
                    <span className="ml-auto shrink-0">
                      <RagPill
                        status={okrStatus(parent.rollupScore)}
                        label={`${Math.round(parent.rollupScore * 100)}%`}
                      />
                    </span>
                  </div>

                  {children.length > 0 && (
                    <div className="mt-3 space-y-2 border-l border-slate-200 dark:border-white/[0.08] pl-3">
                      {children.map((child) => (
                        <div key={child.id}>
                          <div className="flex items-center gap-2">
                            <ArrowRight size={12} className="text-slate-400 shrink-0" />
                            <span className="text-sm text-slate-700 dark:text-slate-300 truncate" title={child.label}>{child.label}</span>
                            <span className="ml-auto shrink-0">
                              <RagPill
                                status={okrStatus(child.score)}
                                label={`${Math.round(child.score * 100)}%`}
                              />
                            </span>
                          </div>
                          {child.keyResults.length > 0 && (
                            <div className="mt-1.5 ml-5 space-y-1.5">
                              {child.keyResults.map((kr) => {
                                const denom = (kr.target - kr.baseline) || 1;
                                const pct = Math.max(0, Math.min(100, Math.round(((kr.current - kr.baseline) / denom) * 100)));
                                return (
                                  <div key={kr.id} className="flex items-center gap-2">
                                    <span className="w-40 text-xs text-slate-500 dark:text-slate-400 truncate" title={kr.label}>{kr.label}</span>
                                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                                      <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="w-20 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                                      {kr.current} / {kr.target}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {parent.keyResults.length > 0 && (
                    <div className="mt-2 ml-5 space-y-1.5">
                      {parent.keyResults.map((kr) => {
                        const denom = (kr.target - kr.baseline) || 1;
                        const pct = Math.max(0, Math.min(100, Math.round(((kr.current - kr.baseline) / denom) * 100)));
                        return (
                          <div key={kr.id} className="flex items-center gap-2">
                            <span className="w-40 text-xs text-slate-500 dark:text-slate-400 truncate" title={kr.label}>{kr.label}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                              <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-20 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                              {kr.current} / {kr.target}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Sustainment */}
      {sustainSummary && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <CheckCircle2 size={14} />
            {t('results.strategic.sustainment', 'Value sustainment')}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { key: 'total', label: 'Total', value: sustainSummary.total, color: 'text-slate-700 dark:text-slate-200' },
              { key: 'sustained', label: 'Sustained', value: sustainSummary.sustained, color: 'text-emerald-600 dark:text-emerald-400' },
              { key: 'atRisk', label: 'At risk', value: sustainSummary.atRisk, color: 'text-amber-600 dark:text-amber-400' },
              { key: 'unowned', label: 'Unowned', value: sustainSummary.unowned, color: 'text-red-600 dark:text-red-400' },
            ].map((s) => (
              <div key={s.key} className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {sustainStatuses.slice(0, 5).some((s) => s.status !== 'sustained') && (
            <div className="mt-3 space-y-1.5">
              {sustainStatuses
                .filter((s) => s.status !== 'sustained')
                .slice(0, 5)
                .map((s) => (
                  <div key={s.id} className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-white/[0.03] px-3 py-2 text-sm">
                    <span className={`font-medium shrink-0 ${STATUS_COLORS[s.status] ?? 'text-slate-500'}`}>
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 truncate">{s.name}</span>
                    {s.reasons[0] && (
                      <span className="text-xs text-slate-400 ml-auto shrink-0">{s.reasons[0]}</span>
                    )}
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      {/* Executive narrative */}
      {strategic?.narrative?.executiveSummary && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
            {t('results.strategic.narrative', 'Management narrative')}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4">
            {strategic.narrative.executiveSummary}
          </p>
        </section>
      )}
    </div>
  );
};

export default StrategicLayerPanel;
