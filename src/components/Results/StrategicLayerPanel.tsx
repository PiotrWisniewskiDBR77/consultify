/**
 * StrategicLayerPanel — M15/W5 tasks 5.1–5.8 + M15-close D2/D3/D4/D10.
 * Renders BSC (4 perspectives) + BDN stats + adoption (DICE/sentiment) + benefit profiles
 * + OKR cascade + sustainment.
 * Data from /api/results-strategic/:projectId/strategic + /okr,
 * /api/results-extended/:projectId/adoption + /benefit-profiles + /sustainment.
 * Behind flag resultsFeatureFlags('strategicLayer').
 */
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Layers,
  ListChecks,
  MessageSquare,
  Minus,
  Pencil,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import {
  closeOkrCycle,
  createOkrCycle,
  deleteOkrKeyResult,
  deleteOkrObjective,
  listOkrCycles,
  type OkrCycle,
} from '@/services/api/okrStrategic';

import { OkrCheckInModal } from './OkrCheckInModal';
import { OkrKeyResultModal, type OkrKeyResultModalKeyResult } from './OkrKeyResultModal';
import { OkrObjectiveModal, type OkrObjectiveModalObjective } from './OkrObjectiveModal';
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

// ── D10: OKR cascade (+ D7 CRUD passthrough fields) ──
interface KeyResult {
  id: string;
  label: string;
  baseline: number;
  target: number;
  current: number;
  weight: number;
  kpiId?: string | null;
  krType?: 'metric' | 'milestone';
  kind?: 'committed' | 'aspirational';
}

interface Objective {
  id: string;
  label: string;
  parentId: string | null;
  keyResults: KeyResult[];
  score: number; // 0-1
  rollupScore: number; // 0-1
  cycleId?: string | null;
  description?: string | null;
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

type OkrModalState =
  | { kind: 'objective'; mode: 'create' | 'edit'; objective?: OkrObjectiveModalObjective | null }
  | {
      kind: 'keyResult';
      mode: 'create' | 'edit';
      objectiveId: string;
      keyResult?: OkrKeyResultModalKeyResult | null;
    }
  | { kind: 'checkIn'; keyResultId: string; keyResultLabel: string; isManualMetric: boolean }
  | null;

/**
 * One Key Result row: progress bar + current/target + actions (check-in /
 * edit / delete). Shared between top-level and cascaded (child) objectives —
 * factored out to avoid duplicating the row markup twice.
 */
const OkrKeyResultRow: React.FC<{
  kr: KeyResult;
  objectiveId: string;
  setOkrModal: React.Dispatch<React.SetStateAction<OkrModalState>>;
  onDelete: (id: string, label: string) => void;
  t: (key: string, fallback: string, opts?: Record<string, unknown>) => string;
}> = ({ kr, objectiveId, setOkrModal, onDelete, t }) => {
  const denom = kr.target - kr.baseline || 1;
  const pct = Math.max(0, Math.min(100, Math.round(((kr.current - kr.baseline) / denom) * 100)));
  // D7 (manual-only): every metric-KR takes its "current" reading from
  // check-ins — `kpiId` (if set) is an informational reference only and no
  // longer suppresses the manual value field. Only milestone-KRs (scored via
  // explicit check-in `score`, not baseline/target/current) differ.
  const isManualMetric = kr.krType !== 'milestone';
  return (
    <div className="flex items-center gap-2 group">
      <span className="w-40 text-xs text-slate-500 dark:text-slate-400 truncate" title={kr.label}>
        {kr.label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
        {kr.current} / {kr.target}
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          title={t('results.okr.checkIn', 'Check-in')}
          onClick={() =>
            setOkrModal({
              kind: 'checkIn',
              keyResultId: kr.id,
              keyResultLabel: kr.label,
              isManualMetric,
            })
          }
          className="p-1 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <MessageSquare size={11} />
        </button>
        <button
          type="button"
          title={t('common.edit', 'Edit')}
          onClick={() =>
            setOkrModal({
              kind: 'keyResult',
              mode: 'edit',
              objectiveId,
              keyResult: {
                id: kr.id,
                label: kr.label,
                baseline: kr.baseline,
                target: kr.target,
                current: kr.current,
                weight: kr.weight,
                kpiId: kr.kpiId,
                krType: kr.krType,
                kind: kr.kind,
              },
            })
          }
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <Pencil size={11} />
        </button>
        <button
          type="button"
          title={t('common.delete', 'Delete')}
          onClick={() => onDelete(kr.id, kr.label)}
          className="p-1 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <Trash2 size={11} />
        </button>
      </span>
    </div>
  );
};

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
  const [okrCycles, setOkrCycles] = useState<OkrCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [okrModal, setOkrModal] = useState<OkrModalState>(null);
  const [creatingCycle, setCreatingCycle] = useState(false);
  const [closingCycleId, setClosingCycleId] = useState<string | null>(null);

  const reloadOkr = useCallback(() => {
    Promise.allSettled([
      Api.get(`/results-strategic/${projectId}/okr`),
      listOkrCycles(projectId),
    ]).then(([ok, cycles]) => {
      if (ok.status === 'fulfilled') setOkr((ok.value as any)?.data ?? ok.value);
      if (cycles.status === 'fulfilled') setOkrCycles(cycles.value);
    });
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      Api.get(`/results-strategic/${projectId}/strategic`),
      Api.get(`/results-extended/${projectId}/adoption`),
      Api.get(`/results-extended/${projectId}/sustainment`),
      Api.get(`/results-extended/${projectId}/benefit-profiles`),
      Api.get(`/results-strategic/${projectId}/okr`),
      listOkrCycles(projectId),
    ])
      .then(([s, a, su, bp, ok, cycles]) => {
        if (s.status === 'fulfilled') setStrategic((s.value as any)?.data ?? s.value);
        if (a.status === 'fulfilled') setAdoption((a.value as any)?.data ?? a.value);
        if (su.status === 'fulfilled') setSustainment((su.value as any)?.data ?? su.value);
        if (bp.status === 'fulfilled') setBenefitProfiles((bp.value as any)?.data ?? bp.value);
        if (ok.status === 'fulfilled') setOkr((ok.value as any)?.data ?? ok.value);
        if (cycles.status === 'fulfilled') setOkrCycles(cycles.value);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleDeleteObjective = useCallback(
    (objectiveId: string, label: string) => {
      if (
        !window.confirm(
          t(
            'results.okr.confirmDeleteObjective',
            'Delete objective "{{label}}" and all its key results?',
            { label }
          )
        )
      ) {
        return;
      }
      deleteOkrObjective(projectId, objectiveId)
        .then(() => {
          toast.success(t('results.okr.objectiveDeleted', 'Objective deleted'));
          reloadOkr();
        })
        .catch((error: any) =>
          toast.error(error?.message || t('results.okr.deleteFailed', 'Delete failed'))
        );
    },
    [projectId, reloadOkr, t]
  );

  const handleDeleteKeyResult = useCallback(
    (keyResultId: string, label: string) => {
      if (
        !window.confirm(
          t('results.okr.confirmDeleteKr', 'Delete key result "{{label}}"?', { label })
        )
      ) {
        return;
      }
      deleteOkrKeyResult(projectId, keyResultId)
        .then(() => {
          toast.success(t('results.okr.krDeleted', 'Key result deleted'));
          reloadOkr();
        })
        .catch((error: any) =>
          toast.error(error?.message || t('results.okr.deleteFailed', 'Delete failed'))
        );
    },
    [projectId, reloadOkr, t]
  );

  const handleCreateCycle = useCallback(() => {
    const name = window.prompt(t('results.okr.newCyclePrompt', 'Cycle name (e.g. Q3 2026):'));
    if (!name || !name.trim()) return;
    const yearMatch = name.match(/20\d{2}/);
    const quarterMatch = name.match(/Q([1-4])/i);
    setCreatingCycle(true);
    createOkrCycle(projectId, {
      name: name.trim(),
      periodYear: yearMatch ? Number(yearMatch[0]) : new Date().getFullYear(),
      periodQuarter: quarterMatch ? Number(quarterMatch[1]) : null,
    })
      .then(() => {
        toast.success(t('results.okr.cycleCreated', 'Cycle created'));
        reloadOkr();
      })
      .catch((error: any) =>
        toast.error(error?.message || t('results.okr.cycleSaveFailed', 'Failed to create cycle'))
      )
      .finally(() => setCreatingCycle(false));
  }, [projectId, reloadOkr, t]);

  const handleCloseCycle = useCallback(
    (cycleId: string, name: string) => {
      if (
        !window.confirm(
          t(
            'results.okr.confirmCloseCycle',
            'Close cycle "{{name}}"? This grades all its objectives.',
            { name }
          )
        )
      ) {
        return;
      }
      setClosingCycleId(cycleId);
      closeOkrCycle(projectId, cycleId)
        .then(() => {
          toast.success(t('results.okr.cycleClosed', 'Cycle closed'));
          reloadOkr();
        })
        .catch((error: any) =>
          toast.error(error?.message || t('results.okr.cycleCloseFailed', 'Failed to close cycle'))
        )
        .finally(() => setClosingCycleId(null));
    },
    [projectId, reloadOkr, t]
  );

  if (loading) {
    return (
      <div
        data-testid="strategic-layer-loading"
        className="flex items-center justify-center py-12 text-slate-400 text-sm"
      >
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
            <span
              className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
                strategic.bsc.overallHealthPct >= 0.7
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                  : strategic.bsc.overallHealthPct >= 0.4
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              }`}
            >
              {Math.round(strategic.bsc.overallHealthPct * 100)}%{' '}
              {t('results.strategic.bscHealth', 'health')}
            </span>
          )}
        </h3>

        {strategic?.bsc?.balanced === false && bscPerspectives && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle size={12} className="shrink-0" />
            {t(
              'results.strategic.bscUnbalanced',
              'Scorecard unbalanced — a KPI is missing in at least one perspective.'
            )}
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
              const healthColor =
                p && p.healthPct >= 0.7
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : p && p.healthPct >= 0.4
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400';
              return (
                <div
                  key={persp}
                  className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4"
                >
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
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.round(p.healthPct * 100)}%` }}
                        />
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
              {
                label: t('results.strategic.bdnBenefits', 'Benefits'),
                value: bdnStats.byType?.benefit ?? 0,
              },
              {
                label: t('results.strategic.bdnEnablers', 'Enablers'),
                value: bdnStats.byType?.enabler ?? 0,
              },
              { label: t('results.strategic.bdnLinks', 'Links'), value: bdnStats.edgeCount },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] px-4 py-2.5"
              >
                <div className="text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
                <div className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                  {s.value}
                </div>
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
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${
                adoption.dataSource === 'change-management'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300'
              }`}
            >
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
                <div
                  key={f.id}
                  className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate"
                      title={f.name ?? f.id}
                    >
                      {f.name ?? `ID ${f.id.slice(0, 8)}…`}
                    </span>
                    {f.diceZone && (
                      <span
                        className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${DICE_ZONE_PILL[f.diceZone]}`}
                      >
                        DICE {f.diceScore ?? '—'} ·{' '}
                        {t(`results.strategic.diceZone.${f.diceZone}`, f.diceZone)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {f.adoptionScore != null && (
                      <span>
                        {t('results.strategic.adoptionScore', 'Adoption')}:{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {Math.round(f.adoptionScore * 100)}%
                        </span>
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
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {Math.round(f.championCoveragePct)}%
                        </span>
                      </span>
                    )}
                    {f.risk && (
                      <RagPill
                        status={RISK_TO_RAG[f.risk]}
                        label={t(`results.strategic.risk.${f.risk}`, f.risk)}
                      />
                    )}
                  </div>
                  {f.riskReasons && f.riskReasons.length > 0 && (
                    <details className="mt-2 group">
                      <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 select-none">
                        {t('results.strategic.riskReasons', 'Risk reasons')} ({f.riskReasons.length}
                        )
                      </summary>
                      <ul className="mt-1 ml-3 list-disc space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {f.riskReasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
            {proxyAdoptionFlags.length > 0 && (
              <div className="mt-2 text-xs text-slate-400">
                {t(
                  'results.strategic.adoptionProxyMore',
                  '+{{count}} flagged from proxy data (no sentiment signal)',
                  { count: proxyAdoptionFlags.length }
                )}
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
                }
              )}
              {profileSummary.disBenefits > 0 && (
                <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                  {t('results.strategic.disBenefits', '{{count}} dis-benefit', {
                    count: profileSummary.disBenefits,
                  })}
                </span>
              )}
            </span>
          )}
        </h3>
        {profiles.length === 0 ? (
          <div className="text-sm text-slate-400 py-4 text-center">
            {t(
              'results.strategic.benefitProfilesNoData',
              'No benefit profiles — define KPIs with a type and target.'
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {profiles.map((p) => (
              <div
                key={p.kpiId}
                className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-3"
              >
                <div className="flex items-start gap-2">
                  <span
                    className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate"
                    title={p.name}
                  >
                    {p.name}
                  </span>
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
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${BENEFIT_TYPE_PILL[p.type]}`}
                  >
                    {t(`results.strategic.benefitType.${p.type}`, p.type)}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">
                    {t(`results.strategic.benefitCategory.${p.category}`, p.category)}
                  </span>
                  {!p.hasTarget && (
                    <span className="text-xs text-slate-400">
                      {t('results.strategic.benefitNoTarget', 'no target')}
                    </span>
                  )}
                  {p.businessOwner && (
                    <span className="ml-auto text-xs text-slate-400 truncate">
                      {p.businessOwner}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* OKR cascade — D10 read + D7 CRUD (objectives/key results/cycles/check-ins) */}
      <section data-testid="okr-crud-section">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
          <ListChecks size={14} />
          {t('results.strategic.okr', 'OKR — objective cascade')}
          {okrSummary && objectives.length > 0 && (
            <span className="flex items-center gap-2 text-xs font-normal text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {Math.round(okrSummary.avgScore * 100)}% {t('results.strategic.okrAvg', 'avg')}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400">
                {okrSummary.onTrack} {t('results.strategic.okrOnTrack', 'on track')}
              </span>
              <span className="text-amber-600 dark:text-amber-400">
                {okrSummary.atRisk} {t('results.strategic.okrAtRisk', 'at risk')}
              </span>
              <span className="text-red-600 dark:text-red-400">
                {okrSummary.offTrack} {t('results.strategic.okrOffTrack', 'off track')}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setOkrModal({ kind: 'objective', mode: 'create' })}
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-300 dark:border-navy-600 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <Plus size={12} />
            {t('results.okr.addObjective', 'Objective')}
          </button>
        </h3>

        {/* Cycles — quarterly OKR cadence (Doerr/Google): create + close-out */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {okrCycles.map((cycle) => (
            <span
              key={cycle.id}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                cycle.status === 'closed'
                  ? 'border-slate-200 dark:border-white/[0.08] text-slate-400'
                  : 'border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
              }`}
            >
              {cycle.name}
              <span className="text-slate-400">
                {cycle.status === 'closed'
                  ? t('results.okr.cycleClosedTag', 'closed')
                  : cycle.status}
              </span>
              {cycle.status !== 'closed' && (
                <button
                  type="button"
                  onClick={() => handleCloseCycle(cycle.id, cycle.name)}
                  disabled={closingCycleId === cycle.id}
                  className="ml-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  title={t('results.okr.closeCycle', 'Close cycle')}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          <button
            type="button"
            onClick={handleCreateCycle}
            disabled={creatingCycle}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 dark:border-navy-600 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <Plus size={10} />
            {t('results.okr.addCycle', 'Cycle')}
          </button>
        </div>

        {objectives.length === 0 ? (
          <div className="text-sm text-slate-400 py-4 text-center">
            {t('results.strategic.okrNoData', 'No OKRs defined')}
          </div>
        ) : (
          <div className="space-y-3">
            {okrParents.map((parent) => {
              const children = objectives.filter((o) => o.parentId === parent.id);
              return (
                <div
                  key={parent.id}
                  className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4"
                >
                  <div className="flex items-center gap-2">
                    <Target size={14} className="text-slate-400 shrink-0" />
                    <span
                      className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate"
                      title={parent.label}
                    >
                      {parent.label}
                    </span>
                    <span className="shrink-0">
                      <RagPill
                        status={okrStatus(parent.rollupScore)}
                        label={`${Math.round(parent.rollupScore * 100)}%`}
                      />
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        title={t('results.okr.addKeyResult', 'Add key result')}
                        onClick={() =>
                          setOkrModal({ kind: 'keyResult', mode: 'create', objectiveId: parent.id })
                        }
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      >
                        <Plus size={13} />
                      </button>
                      <button
                        type="button"
                        title={t('common.edit', 'Edit')}
                        onClick={() =>
                          setOkrModal({
                            kind: 'objective',
                            mode: 'edit',
                            objective: {
                              id: parent.id,
                              label: parent.label,
                              parentId: parent.parentId,
                              cycleId: parent.cycleId,
                              description: parent.description,
                            },
                          })
                        }
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        title={t('common.delete', 'Delete')}
                        onClick={() => handleDeleteObjective(parent.id, parent.label)}
                        className="p-1 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  </div>

                  {children.length > 0 && (
                    <div className="mt-3 space-y-2 border-l border-slate-200 dark:border-white/[0.08] pl-3">
                      {children.map((child) => (
                        <div key={child.id}>
                          <div className="flex items-center gap-2">
                            <ArrowRight size={12} className="text-slate-400 shrink-0" />
                            <span
                              className="text-sm text-slate-700 dark:text-slate-300 truncate"
                              title={child.label}
                            >
                              {child.label}
                            </span>
                            <span className="shrink-0">
                              <RagPill
                                status={okrStatus(child.score)}
                                label={`${Math.round(child.score * 100)}%`}
                              />
                            </span>
                            <span className="ml-auto flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                title={t('results.okr.addKeyResult', 'Add key result')}
                                onClick={() =>
                                  setOkrModal({
                                    kind: 'keyResult',
                                    mode: 'create',
                                    objectiveId: child.id,
                                  })
                                }
                                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                              >
                                <Plus size={12} />
                              </button>
                              <button
                                type="button"
                                title={t('common.edit', 'Edit')}
                                onClick={() =>
                                  setOkrModal({
                                    kind: 'objective',
                                    mode: 'edit',
                                    objective: {
                                      id: child.id,
                                      label: child.label,
                                      parentId: child.parentId,
                                      cycleId: child.cycleId,
                                      description: child.description,
                                    },
                                  })
                                }
                                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                type="button"
                                title={t('common.delete', 'Delete')}
                                onClick={() => handleDeleteObjective(child.id, child.label)}
                                className="p-1 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                              >
                                <Trash2 size={11} />
                              </button>
                            </span>
                          </div>
                          {child.keyResults.length > 0 && (
                            <div className="mt-1.5 ml-5 space-y-1.5">
                              {child.keyResults.map((kr) => (
                                <OkrKeyResultRow
                                  key={kr.id}
                                  kr={kr}
                                  objectiveId={child.id}
                                  setOkrModal={setOkrModal}
                                  onDelete={handleDeleteKeyResult}
                                  t={t}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {parent.keyResults.length > 0 && (
                    <div className="mt-2 ml-5 space-y-1.5">
                      {parent.keyResults.map((kr) => (
                        <OkrKeyResultRow
                          key={kr.id}
                          kr={kr}
                          objectiveId={parent.id}
                          setOkrModal={setOkrModal}
                          onDelete={handleDeleteKeyResult}
                          t={t}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {okrModal?.kind === 'objective' && (
        <OkrObjectiveModal
          projectId={projectId}
          objective={okrModal.objective}
          objectiveOptions={objectives.map((o) => ({ id: o.id, label: o.label }))}
          cycles={okrCycles}
          onClose={() => setOkrModal(null)}
          onSuccess={() => {
            setOkrModal(null);
            reloadOkr();
          }}
        />
      )}

      {okrModal?.kind === 'keyResult' && (
        <OkrKeyResultModal
          projectId={projectId}
          objectiveId={okrModal.objectiveId}
          keyResult={okrModal.keyResult}
          onClose={() => setOkrModal(null)}
          onSuccess={() => {
            setOkrModal(null);
            reloadOkr();
          }}
        />
      )}

      {okrModal?.kind === 'checkIn' && (
        <OkrCheckInModal
          projectId={projectId}
          keyResultId={okrModal.keyResultId}
          keyResultLabel={okrModal.keyResultLabel}
          isManualMetric={okrModal.isManualMetric}
          onClose={() => setOkrModal(null)}
          onSuccess={() => {
            setOkrModal(null);
            reloadOkr();
          }}
        />
      )}

      {/* Sustainment */}
      {sustainSummary && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <CheckCircle2 size={14} />
            {t('results.strategic.sustainment', 'Value sustainment')}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                key: 'total',
                label: 'Total',
                value: sustainSummary.total,
                color: 'text-slate-700 dark:text-slate-200',
              },
              {
                key: 'sustained',
                label: 'Sustained',
                value: sustainSummary.sustained,
                color: 'text-emerald-600 dark:text-emerald-400',
              },
              {
                key: 'atRisk',
                label: 'At risk',
                value: sustainSummary.atRisk,
                color: 'text-amber-600 dark:text-amber-400',
              },
              {
                key: 'unowned',
                label: 'Unowned',
                value: sustainSummary.unowned,
                color: 'text-red-600 dark:text-red-400',
              },
            ].map((s) => (
              <div
                key={s.key}
                className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4 text-center"
              >
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
                  <div
                    key={s.id}
                    className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-white/[0.03] px-3 py-2 text-sm"
                  >
                    <span
                      className={`font-medium shrink-0 ${STATUS_COLORS[s.status] ?? 'text-slate-500'}`}
                    >
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 truncate">{s.name}</span>
                    {s.reasons[0] && (
                      <span className="text-xs text-slate-400 ml-auto shrink-0">
                        {s.reasons[0]}
                      </span>
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
