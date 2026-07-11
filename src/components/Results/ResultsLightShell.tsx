/**
 * ResultsLightShell — lightweight, dense redesign of the Results/Rezultaty
 * module surface. NEW component (zero edits to `<ResultsHub>`), same visual
 * doctrine as `<DRDLightShell>` (assessment/drd): one compact header strip,
 * a narrow left nav, a dense center, a thin right rail. No tabs beyond the
 * three panes below.
 *
 * Per owner feedback #81 (2026-07-11): redesign = PARY KPI/ROI/OKR only.
 * `results_initiatives` and `results_ai` ("AI + Portfolio") tabs from the
 * legacy `<ResultsHub>` are DROPPED here — they duplicate data owned by
 * Initiatives/Execution (see MEMORY `project_initiative_backbone`) and the
 * gated experimental AI/portfolio surface. This shell is presentational —
 * it takes fully-formed data via props (same pattern as DRDLightShell's
 * `data`/`onChange` contract) and reuses the REAL engines already shipped:
 *   - KPI: shape mirrors `kpiDomain.ts` (`ResultsKPI`, `KPIStatus`,
 *     `KPITrend`) — derive/filter helpers stay the single source of truth,
 *     this shell only renders what's computed there.
 *   - ROI: shape mirrors `ROITrackingView.tsx`'s `ROIInitiativeItem` +
 *     portfolio summary (`/api/results*`), extended with `opexAnnual` (see
 *     `ROIAssumptionEditor.tsx`) so the net-of-opex figure the portfolio
 *     already computes internally is visible here, not re-derived.
 *   - OKR: shape mirrors `StrategicLayerPanel.tsx`'s `Objective`/`KeyResult`
 *     /`OkrSummary` (from `/api/results-strategic/:projectId/okr`, backed by
 *     `server/src/services/results/okrService.ts` — real CRUD/cycles/
 *     check-ins engine), plus `cycleLabel`/`lastCheckIn` to surface the
 *     cadence the engine already tracks.
 *
 * COLOR DOCTRINE (hard, same as DRDLightShell):
 *   - `c-accent` is Harvard Crimson — reserved for critical semantics only,
 *     NOT used here. Accent = `--c-focus-solid` (blue). Status semantics
 *     (on-target/above = emerald, below/at-risk = amber, critical/off-track
 *     = red) use the same emerald/amber/red utility classes already used
 *     across `src/components/Results/*` (ResultsUIPrimitives, ROITrackingView,
 *     StrategicLayerPanel) — never `primary-*` (that token is crimson).
 *   - No inline hex; all accent colors reference CSS-var tokens so light/dark
 *     both adapt.
 */

import {
  Activity,
  ChevronRight,
  Clock,
  DollarSign,
  ListChecks,
  MessageSquare,
  Minus,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ─── Local shapes (mirror the real engines; see file header) ──────────────

export type ResultsLightKpiStatus = 'on-target' | 'below' | 'no-data';
export type ResultsLightKpiTrend = 'up' | 'down' | 'stable';

export interface ResultsLightKpi {
  id: string;
  name: string;
  initiativeName?: string;
  ownerName?: string;
  actualValue: number | null;
  targetValue: number | null;
  unit?: string;
  status: ResultsLightKpiStatus;
  trend: ResultsLightKpiTrend;
  needsEntry?: boolean;
  measurementFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  baselineValue?: number | null;
}

export type ResultsLightRoiStatus = 'on-track' | 'below' | 'above';

export interface ResultsLightRoiItem {
  initiativeId: string;
  initiativeName: string;
  ownerName?: string;
  projectedBenefit: number;
  realizedBenefit: number;
  opexAnnual?: number;
  hasRealized: boolean;
}

export interface ResultsLightRoiSummary {
  totalProjected: number;
  totalRealized: number;
  totalOpex: number;
  totalCapex: number;
  coveragePercent: number;
}

export interface ResultsLightKeyResult {
  id: string;
  label: string;
  baseline: number;
  target: number;
  current: number;
}

export interface ResultsLightObjective {
  id: string;
  label: string;
  parentId: string | null;
  keyResults: ResultsLightKeyResult[];
  rollupScore: number; // 0-1
  cycleLabel?: string;
  lastCheckIn?: string; // ISO date
}

export interface ResultsLightOkrSummary {
  onTrack: number;
  atRisk: number;
  offTrack: number;
  avgScore: number;
}

interface ResultsLightShellProps {
  projectName?: string;
  status?: string;
  periodLabel?: string;
  updatedLabel?: string;
  kpis: ResultsLightKpi[];
  roiItems: ResultsLightRoiItem[];
  roiSummary: ResultsLightRoiSummary;
  objectives: ResultsLightObjective[];
  okrSummary: ResultsLightOkrSummary;
  onOpenChat?: () => void;
  onOpenKpi?: (kpiId: string) => void;
  onOpenRoiItem?: (initiativeId: string) => void;
}

type Section = 'kpi' | 'roi' | 'okr';

const BLUE = 'rgb(var(--c-focus-solid-rgb))';
const BLUE_SOFT = 'rgb(var(--c-focus-solid-rgb) / 0.10)';

const KPI_STATUS_COLOR: Record<ResultsLightKpiStatus, string> = {
  'on-target': 'text-emerald-600 dark:text-emerald-400',
  below: 'text-amber-600 dark:text-amber-400',
  'no-data': 'text-c-text-muted',
};

const KPI_STATUS_DOT: Record<ResultsLightKpiStatus, string> = {
  'on-target': 'bg-emerald-500',
  below: 'bg-amber-500',
  'no-data': 'bg-c-border-strong',
};

// rgb(...) not a tailwind class: the health bar fill needs an inline color so
// it can share the same c-* token ramp as the rest of the shell (BLUE) while
// still switching to status semantics (emerald/amber) — tailwind utility
// classes can't be conditionally interpolated into an inline `width` style.
const KPI_STATUS_BAR_COLOR: Record<ResultsLightKpiStatus, string> = {
  'on-target': 'rgb(16 185 129)', // emerald-500
  below: 'rgb(245 158 11)', // amber-500
  'no-data': 'rgb(var(--c-border-strong-rgb))',
};

const ROI_STATUS_COLOR: Record<ResultsLightRoiStatus, string> = {
  'on-track': 'text-c-text-secondary',
  above: 'text-emerald-600 dark:text-emerald-400',
  below: 'text-red-600 dark:text-red-400',
};

function deriveRoiStatus(item: ResultsLightRoiItem): ResultsLightRoiStatus {
  if (!item.hasRealized || item.projectedBenefit === 0) return 'on-track';
  const pct = ((item.realizedBenefit - item.projectedBenefit) / Math.abs(item.projectedBenefit)) * 100;
  if (pct > 10) return 'above';
  if (pct < -10) return 'below';
  return 'on-track';
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtCompact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return v.toFixed(0);
}

function okrRag(score: number): 'green' | 'amber' | 'red' {
  return score >= 0.7 ? 'green' : score >= 0.4 ? 'amber' : 'red';
}

const RAG_TEXT: Record<'green' | 'amber' | 'red', string> = {
  green: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
};

export const ResultsLightShell: React.FC<ResultsLightShellProps> = ({
  projectName,
  status,
  periodLabel,
  updatedLabel,
  kpis,
  roiItems,
  roiSummary,
  objectives,
  okrSummary,
  onOpenChat,
  onOpenKpi,
  onOpenRoiItem,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const t = (pl: string, en: string) => (isPolish ? pl : en);

  const [section, setSection] = useState<Section>('kpi');
  const [openKpiId, setOpenKpiId] = useState<string | null>(null);

  const kpiCounts = useMemo(() => {
    const onTarget = kpis.filter((k) => k.status === 'on-target').length;
    const below = kpis.filter((k) => k.status === 'below').length;
    const noData = kpis.filter((k) => k.status === 'no-data').length;
    return { onTarget, below, noData, total: kpis.length };
  }, [kpis]);

  const netRealized = roiSummary.totalRealized - roiSummary.totalOpex;
  const netProjected = roiSummary.totalProjected - roiSummary.totalOpex;
  const netVariancePct =
    netProjected !== 0 ? Math.round(((netRealized - netProjected) / Math.abs(netProjected)) * 1000) / 10 : 0;

  const okrParents = objectives.filter((o) => o.parentId == null);
  const childrenOf = (id: string) => objectives.filter((o) => o.parentId === id);

  const statusLabel = (status || 'IN_REALIZATION').toUpperCase();
  const statusPill = isPolish
    ? statusLabel.includes('DONE') || statusLabel.includes('COMPLETE')
      ? 'Zamknięty'
      : statusLabel.includes('REALIZ')
        ? 'W realizacji'
        : 'Szkic'
    : statusLabel;

  const NAV_ITEMS: Array<{ id: Section; label: string; icon: React.ReactNode; meta: string }> = [
    {
      id: 'kpi',
      label: t('KPI', 'KPI'),
      icon: <Target className="h-[13px] w-[13px]" />,
      meta: `${kpiCounts.onTarget} / ${kpiCounts.total} ${t('w celu', 'on target')}`,
    },
    {
      id: 'roi',
      label: t('ROI', 'ROI'),
      icon: <DollarSign className="h-[13px] w-[13px]" />,
      meta: `${roiItems.filter((r) => r.hasRealized).length} / ${roiItems.length} ${t('zmierzone', 'measured')}`,
    },
    {
      id: 'okr',
      label: t('OKR', 'OKR'),
      icon: <ListChecks className="h-[13px] w-[13px]" />,
      meta: `${Math.round(okrSummary.avgScore * 100)}% ${t('śr. wynik', 'avg score')}`,
    },
  ];

  return (
    <div className="flex h-full flex-col bg-c-bg text-c-text">
      {/* ─── Compact status strip ─── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-c-border bg-c-surface px-5 py-3">
        <span className="text-[12px] text-c-text-muted">
          Results <span className="mx-1 text-c-text-secondary">›</span> {t('Rezultaty', 'Results')}
        </span>
        <h1 className="m-0 text-[15px] font-semibold tracking-tight text-c-text">
          {projectName || 'DBR77 Scale-Up'}
        </h1>
        <span className="rounded-full border border-c-border bg-c-surface-raised px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-c-text-secondary">
          {statusPill}
        </span>
        <div className="ml-1 flex items-center gap-4 text-[12px]">
          {periodLabel && (
            <span className="text-c-text-muted">
              {t('okres', 'period')}{' '}
              <span className="font-semibold text-c-text-secondary">{periodLabel}</span>
            </span>
          )}
          {updatedLabel && (
            <span className="text-c-text-muted">
              {t('aktualizacja', 'updated')}{' '}
              <span className="font-semibold text-c-text-secondary">{updatedLabel}</span>
            </span>
          )}
        </div>

        <span className="flex-1" />

        {onOpenChat && (
          <button
            type="button"
            onClick={onOpenChat}
            className="inline-flex items-center gap-2 rounded-lg border border-transparent px-3 py-1.5 text-[13px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised"
          >
            <MessageSquare className="h-4 w-4" />
            Teresa
          </button>
        )}
      </div>

      {/* ─── 3-column work area ─── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[200px_1fr] lg:grid-cols-[200px_1fr_280px]">
        {/* NAV */}
        <nav className="hidden overflow-y-auto border-r border-c-border bg-c-surface px-3 py-4 md:block">
          <p className="mx-1.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
            {t('Wyniki', 'Results')}
          </p>
          <div className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const on = item.id === section;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    on ? '' : 'hover:bg-c-surface-raised'
                  }`}
                  style={on ? { backgroundColor: BLUE_SOFT } : undefined}
                >
                  <span
                    className="grid h-[26px] w-[26px] flex-shrink-0 place-items-center rounded-full"
                    style={{ backgroundColor: on ? BLUE_SOFT : 'var(--c-surface-raised)' }}
                  >
                    <span style={on ? { color: BLUE } : undefined} className="text-c-text-secondary">
                      {item.icon}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[13px] leading-tight tracking-tight ${
                        on ? 'font-semibold' : 'text-c-text'
                      }`}
                      style={on ? { color: BLUE } : undefined}
                    >
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-c-text-muted tabular-nums">{item.meta}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* CENTER */}
        <main className="min-w-0 overflow-y-auto px-6 py-5">
          {section === 'kpi' && (
            <>
              <div className="mb-1 flex items-end justify-between gap-4">
                <div>
                  <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">KPI</h2>
                  <div className="mt-0.5 text-[12.5px] text-c-text-muted">
                    {kpiCounts.total} {t('wskaźników', 'KPIs')}
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <div className="text-[20px] font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                      {kpiCounts.onTarget}
                    </div>
                    <div className="text-[10.5px] uppercase tracking-wide text-c-text-muted">
                      {t('w celu', 'on target')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[20px] font-bold tracking-tight tabular-nums text-amber-600 dark:text-amber-400">
                      {kpiCounts.below}
                    </div>
                    <div className="text-[10.5px] uppercase tracking-wide text-c-text-muted">
                      {t('poniżej', 'below')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[20px] font-bold tracking-tight tabular-nums text-c-text-secondary">
                      {kpiCounts.noData}
                    </div>
                    <div className="text-[10.5px] uppercase tracking-wide text-c-text-muted">
                      {t('brak danych', 'no data')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-1.5">
                {kpis.map((kpi) => {
                  const open = openKpiId === kpi.id;
                  // Direction-agnostic health bar: `status` (from kpiDomain.ts'
                  // deriveStatus, which already knows if higher/lower-is-better
                  // via isOnTarget) is the source of truth, not a raw ratio —
                  // actual/target alone would show a false 100% bar for an
                  // over-target "lower is better" KPI like CAC.
                  const pct =
                    kpi.status === 'on-target'
                      ? 100
                      : kpi.status === 'no-data' || kpi.actualValue == null || !kpi.targetValue
                        ? 0
                        : Math.max(
                            0,
                            Math.min(
                              100,
                              Math.round(
                                (Math.min(kpi.actualValue, kpi.targetValue) /
                                  Math.max(kpi.actualValue, kpi.targetValue)) *
                                  100
                              )
                            )
                          );
                  return (
                    <div
                      key={kpi.id}
                      className={`overflow-hidden rounded-xl border bg-c-surface transition-colors ${
                        open ? 'border-c-border-strong shadow-sm' : 'border-c-border hover:border-c-border-strong'
                      }`}
                      style={open ? { borderColor: BLUE } : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenKpiId(open ? null : kpi.id)}
                        className="grid w-full grid-cols-[16px_1fr_120px_auto] items-center gap-3.5 px-4 py-3 text-left"
                      >
                        <span className={`h-2 w-2 rounded-full ${KPI_STATUS_DOT[kpi.status]}`} />
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium text-c-text">{kpi.name}</span>
                          {kpi.initiativeName && (
                            <span className="block truncate text-[11.5px] text-c-text-muted">
                              {kpi.initiativeName}
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-[70px] overflow-hidden rounded-full bg-c-surface-raised">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: KPI_STATUS_BAR_COLOR[kpi.status] }}
                            />
                          </span>
                          <span className="w-9 text-right text-[11px] font-semibold text-c-text-secondary tabular-nums">
                            {pct}%
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className={`min-w-[76px] whitespace-nowrap text-right text-[12px] ${KPI_STATUS_COLOR[kpi.status]}`}>
                            {kpi.actualValue ?? '—'} → {kpi.targetValue ?? '—'} {kpi.unit || ''}
                          </span>
                          {kpi.trend === 'up' ? (
                            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                          ) : kpi.trend === 'down' ? (
                            <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                          ) : (
                            <Minus className="h-3.5 w-3.5 text-c-text-muted" />
                          )}
                          <ChevronRight
                            className="h-4 w-4 text-c-text-muted transition-transform"
                            style={open ? { transform: 'rotate(90deg)' } : undefined}
                          />
                        </span>
                      </button>

                      {open && (
                        <div className="border-t border-c-border bg-c-surface-raised px-4 py-3.5">
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px] text-c-text-secondary">
                            {kpi.baselineValue != null && (
                              <span>
                                {t('baza', 'baseline')}:{' '}
                                <span className="font-semibold text-c-text tabular-nums">{kpi.baselineValue}</span>
                              </span>
                            )}
                            {kpi.ownerName && (
                              <span>
                                {t('właściciel', 'owner')}:{' '}
                                <span className="font-semibold text-c-text">{kpi.ownerName}</span>
                              </span>
                            )}
                            {kpi.measurementFrequency && (
                              <span>
                                {t('pomiar', 'measurement')}:{' '}
                                <span className="font-semibold text-c-text">{kpi.measurementFrequency}</span>
                              </span>
                            )}
                            {kpi.needsEntry && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                {t('brak nowego wpisu', 'needs entry')}
                              </span>
                            )}
                          </div>
                          {onOpenKpi && (
                            <button
                              type="button"
                              onClick={() => onOpenKpi(kpi.id)}
                              className="mt-3 text-[12.5px] font-semibold transition-opacity hover:opacity-80"
                              style={{ color: BLUE }}
                            >
                              {t('Otwórz rekord →', 'Open record →')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {kpis.length === 0 && (
                  <div className="py-8 text-center text-[13px] text-c-text-muted">
                    {t('Brak zdefiniowanych KPI.', 'No KPIs defined yet.')}
                  </div>
                )}
              </div>
            </>
          )}

          {section === 'roi' && (
            <>
              <div className="mb-1 flex items-end justify-between gap-4">
                <div>
                  <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">ROI</h2>
                  <div className="mt-0.5 text-[12.5px] text-c-text-muted">
                    {roiItems.length} {t('inicjatyw z ROI', 'initiatives with ROI')} ·{' '}
                    {roiSummary.coveragePercent}% {t('pokrycia', 'coverage')}
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <div className="text-[20px] font-bold tracking-tight tabular-nums text-c-text-secondary">
                      {fmtCompact(roiSummary.totalProjected)}
                    </div>
                    <div className="text-[10.5px] uppercase tracking-wide text-c-text-muted">
                      {t('plan', 'projected')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-[20px] font-bold tracking-tight tabular-nums"
                      style={{ color: BLUE }}
                    >
                      {fmtCompact(netRealized)}
                    </div>
                    <div className="text-[10.5px] uppercase tracking-wide text-c-text-muted">
                      {t('zrealizowano netto (po opex)', 'net realized (post-opex)')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-[20px] font-bold tracking-tight tabular-nums ${
                        netVariancePct >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {netVariancePct >= 0 ? '+' : ''}
                      {netVariancePct}%
                    </div>
                    <div className="text-[10.5px] uppercase tracking-wide text-c-text-muted">
                      {t('odchylenie netto', 'net variance')}
                    </div>
                  </div>
                </div>
              </div>

              {/* one compact meta strip — capex/opex, not separate cards */}
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-c-border bg-c-surface px-3.5 py-2 text-[12px] text-c-text-muted">
                <span>
                  CAPEX: <span className="font-semibold text-c-text-secondary">{fmtCurrency(roiSummary.totalCapex)}</span>
                </span>
                <span>
                  OPEX ({t('roczny', 'annual')}):{' '}
                  <span className="font-semibold text-c-text-secondary">{fmtCurrency(roiSummary.totalOpex)}</span>
                </span>
                <span>
                  {t('brutto zrealizowano', 'gross realized')}:{' '}
                  <span className="font-semibold text-c-text-secondary">
                    {fmtCurrency(roiSummary.totalRealized)}
                  </span>
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-1.5">
                {roiItems.map((item) => {
                  const rStatus = deriveRoiStatus(item);
                  const net = item.realizedBenefit - (item.opexAnnual || 0);
                  return (
                    <button
                      key={item.initiativeId}
                      type="button"
                      onClick={() => onOpenRoiItem?.(item.initiativeId)}
                      className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3.5 rounded-xl border border-c-border bg-c-surface px-4 py-3 text-left transition-colors hover:border-c-border-strong"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium text-c-text">
                          {item.initiativeName}
                        </span>
                        {item.ownerName && (
                          <span className="block truncate text-[11.5px] text-c-text-muted">{item.ownerName}</span>
                        )}
                      </span>
                      <span className="whitespace-nowrap text-right text-[12px] text-c-text-muted">
                        {fmtCompact(item.projectedBenefit)} → {item.hasRealized ? fmtCompact(net) : '—'}{' '}
                        <span className="text-[10.5px]">{t('(netto)', '(net)')}</span>
                      </span>
                      <span className={`whitespace-nowrap text-[12px] font-semibold ${ROI_STATUS_COLOR[rStatus]}`}>
                        {rStatus === 'above' ? t('powyżej planu', 'above plan') : rStatus === 'below' ? t('poniżej planu', 'below plan') : t('wg planu', 'on track')}
                      </span>
                    </button>
                  );
                })}
                {roiItems.length === 0 && (
                  <div className="py-8 text-center text-[13px] text-c-text-muted">
                    {t('Brak inicjatyw z danymi ROI.', 'No initiatives with ROI data yet.')}
                  </div>
                )}
              </div>
            </>
          )}

          {section === 'okr' && (
            <>
              <div className="mb-1 flex items-end justify-between gap-4">
                <div>
                  <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">OKR</h2>
                  <div className="mt-0.5 text-[12.5px] text-c-text-muted">
                    {objectives.length} {t('celów', 'objectives')}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[12px]">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {okrSummary.onTrack} {t('na torze', 'on track')}
                  </span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    {okrSummary.atRisk} {t('zagrożone', 'at risk')}
                  </span>
                  <span className="text-red-600 dark:text-red-400 font-semibold">
                    {okrSummary.offTrack} {t('poza torem', 'off track')}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2.5">
                {okrParents.map((parent) => {
                  const children = childrenOf(parent.id);
                  const rag = okrRag(parent.rollupScore);
                  return (
                    <div key={parent.id} className="rounded-xl border border-c-border bg-c-surface p-4">
                      <div className="flex items-center gap-2.5">
                        <Target className="h-3.5 w-3.5 shrink-0 text-c-text-muted" />
                        <span className="truncate text-[14px] font-semibold text-c-text" title={parent.label}>
                          {parent.label}
                        </span>
                        {parent.cycleLabel && (
                          <span className="shrink-0 rounded-full border border-c-border px-2 py-0.5 text-[10.5px] text-c-text-muted">
                            {parent.cycleLabel}
                          </span>
                        )}
                        <span className={`ml-auto shrink-0 text-[13px] font-bold tabular-nums ${RAG_TEXT[rag]}`}>
                          {Math.round(parent.rollupScore * 100)}%
                        </span>
                      </div>

                      {children.length > 0 && (
                        <div className="mt-3 space-y-2.5 border-l border-c-border pl-3.5">
                          {children.map((child) => {
                            const cRag = okrRag(child.rollupScore);
                            return (
                              <div key={child.id}>
                                <div className="flex items-center gap-2">
                                  <ChevronRight className="h-3 w-3 shrink-0 text-c-text-muted" />
                                  <span className="truncate text-[13px] text-c-text" title={child.label}>
                                    {child.label}
                                  </span>
                                  <span className={`ml-auto shrink-0 text-[12px] font-semibold tabular-nums ${RAG_TEXT[cRag]}`}>
                                    {Math.round(child.rollupScore * 100)}%
                                  </span>
                                </div>
                                {child.keyResults.length > 0 && (
                                  <div className="mt-1.5 ml-5 space-y-1.5">
                                    {child.keyResults.map((kr) => {
                                      const denom = kr.target - kr.baseline || 1;
                                      const pct = Math.max(0, Math.min(100, Math.round(((kr.current - kr.baseline) / denom) * 100)));
                                      return (
                                        <div key={kr.id} className="flex items-center gap-2">
                                          <span className="w-40 shrink-0 truncate text-[11.5px] text-c-text-muted" title={kr.label}>
                                            {kr.label}
                                          </span>
                                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-c-surface-raised">
                                            <span
                                              className="block h-full rounded-full"
                                              style={{ width: `${pct}%`, backgroundColor: BLUE }}
                                            />
                                          </span>
                                          <span className="w-16 shrink-0 text-right text-[11px] font-medium text-c-text-secondary tabular-nums">
                                            {kr.current}/{kr.target}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                {child.lastCheckIn && (
                                  <div className="ml-5 mt-1 text-[10.5px] text-c-text-muted">
                                    {t('ostatni check-in', 'last check-in')}: {child.lastCheckIn}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {parent.keyResults.length > 0 && children.length === 0 && (
                        <div className="mt-2.5 ml-6 space-y-1.5">
                          {parent.keyResults.map((kr) => {
                            const denom = kr.target - kr.baseline || 1;
                            const pct = Math.max(0, Math.min(100, Math.round(((kr.current - kr.baseline) / denom) * 100)));
                            return (
                              <div key={kr.id} className="flex items-center gap-2">
                                <span className="w-40 shrink-0 truncate text-[11.5px] text-c-text-muted" title={kr.label}>
                                  {kr.label}
                                </span>
                                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-c-surface-raised">
                                  <span
                                    className="block h-full rounded-full"
                                    style={{ width: `${pct}%`, backgroundColor: BLUE }}
                                  />
                                </span>
                                <span className="w-16 shrink-0 text-right text-[11px] font-medium text-c-text-secondary tabular-nums">
                                  {kr.current}/{kr.target}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {parent.lastCheckIn && children.length === 0 && (
                        <div className="ml-6 mt-1 text-[10.5px] text-c-text-muted">
                          {t('ostatni check-in', 'last check-in')}: {parent.lastCheckIn}
                        </div>
                      )}
                    </div>
                  );
                })}
                {objectives.length === 0 && (
                  <div className="py-8 text-center text-[13px] text-c-text-muted">
                    {t('Brak zdefiniowanych OKR.', 'No OKRs defined yet.')}
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {/* ASIDE */}
        <aside className="hidden overflow-y-auto border-l border-c-border bg-c-surface px-4 py-4 lg:block">
          <p className="mx-0.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
            {t('Wsparcie', 'Support')}
          </p>

          {/* Teresa */}
          <div className="mb-3 rounded-xl p-3.5" style={{ backgroundColor: BLUE_SOFT }}>
            <div className="mb-1.5 flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: BLUE }}>
              <MessageSquare className="h-4 w-4" />
              {t('Teresa · asystent wyników', 'Teresa · results assistant')}
            </div>
            <p className="m-0 mb-2.5 text-[12.5px] leading-snug text-c-text-secondary">
              {t(
                'Zapytaj o odchylenia KPI, status ROI netto lub który OKR wymaga check-inu.',
                'Ask about KPI deviations, net ROI status, or which OKR needs a check-in.'
              )}
            </p>
            {onOpenChat && (
              <button
                type="button"
                onClick={onOpenChat}
                className="text-[12.5px] font-semibold transition-opacity hover:opacity-80"
                style={{ color: BLUE }}
              >
                {t('Zacznij rozmowę →', 'Start a conversation →')}
              </button>
            )}
          </div>

          {/* Cykl OKR */}
          <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
            <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
              <Clock className="h-[15px] w-[15px] text-c-text-muted" />
              {t('Cykl OKR', 'OKR cycle')}
              <span
                className="ml-auto rounded-full px-1.5 py-px text-[10.5px] font-semibold"
                style={{ backgroundColor: BLUE_SOFT, color: BLUE }}
              >
                {okrParents[0]?.cycleLabel || '—'}
              </span>
            </div>
            <div className="px-3.5 pb-3.5 text-[12.5px] leading-snug text-c-text-secondary">
              {t(
                'Check-iny cykliczne per key result. Silnik pilnuje historii i domknięcia cyklu.',
                'Recurring check-ins per key result. The engine tracks history and cycle close-out.'
              )}
            </div>
          </div>

          {/* Aktywność */}
          <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
            <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
              <Activity className="h-[15px] w-[15px] text-c-text-muted" />
              {t('Aktywność', 'Activity')}
            </div>
            <div className="px-3.5 pb-3.5 text-[12.5px] leading-snug text-c-text-secondary">
              {kpiCounts.below > 0 || okrSummary.offTrack > 0 ? (
                <>
                  {kpiCounts.below > 0 && (
                    <div>
                      {kpiCounts.below} {t('KPI poniżej celu', 'KPI below target')}
                    </div>
                  )}
                  {okrSummary.offTrack > 0 && (
                    <div>
                      {okrSummary.offTrack} {t('OKR poza torem', 'OKR off track')}
                    </div>
                  )}
                </>
              ) : (
                t('Wszystko w normie.', 'Everything is on track.')
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ResultsLightShell;
