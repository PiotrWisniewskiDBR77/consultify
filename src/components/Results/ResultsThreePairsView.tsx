/**
 * ResultsThreePairsView — spójny redesign modułu Results wg wizji #81:
 * REZULTATY NIEFINANSOWE inicjatyw pokazane jako 3 PARY (byt + jego para
 * plan↔wynik), każda w jednej sekcji:
 *
 *   1. KPI       — cel (target) ↔ wynik (current)         → StandardTable
 *   2. ROI       — oczekiwany (projected) ↔ zrealizowany netto (realized)
 *   3. OKR       — cel strategiczny (objective) ↔ kluczowe rezultaty (KR)
 *
 * KANON: to NIE jest light-shell ani alternate-surface za flagą. Listy renderuje
 * <StandardTable> (fasada src/components/standard/, reguła #1) 1:1 — zero
 * własnych <table>. Karty-pary u góry sekcji to podsumowania (jak strip nagłówka
 * w KpiOverviewView), nie tabele. Kolory = tokeny c-* (semantyka: c-success/
 * c-warning/c-danger). CTA/stany aktywne = neutralne, focus = c-focus (nigdy
 * crimson `primary-*`). Dane i handlery wstrzykuje rodzic (ResultsHub) lub host
 * dev-render; lokalny stan wybiera tylko jedną z trzech równorzędnych tabel.
 */
import React, { useMemo, useState } from 'react';

import type { TableColumn, TableRow } from '../standard/StandardTable';
import StandardTable from '../standard/StandardTable';

// ── Modele danych (kształty 1:1 z istniejącymi silnikami) ───────────────────
export type ThreePairKpiStatus = 'on-target' | 'below' | 'no-data';

export interface ThreePairKpi {
  id: string;
  name: string;
  initiativeName?: string | null;
  unit?: string | null;
  baseline: number | null;
  target: number | null;
  current: number | null;
  status: ThreePairKpiStatus;
  trend?: 'up' | 'down' | 'stable';
}

export interface ThreePairRoi {
  initiativeId: string;
  initiativeName: string;
  projectedBenefit: number; // oczekiwany (netto)
  realizedBenefit: number; // zrealizowany (netto)
  hasRealized: boolean;
  ownerName?: string | null;
}

export interface ThreePairKeyResult {
  id: string;
  label: string;
  baseline: number;
  target: number;
  current: number;
}

export interface ThreePairObjective {
  id: string;
  label: string;
  rollupScore: number; // 0..1
  keyResults: ThreePairKeyResult[];
}

export interface ResultsThreePairsViewProps {
  kpis: ThreePairKpi[];
  roi: ThreePairRoi[];
  objectives: ThreePairObjective[];
  currency?: string;
  isPolish?: boolean;
  onAddKpi?: () => void;
  onNewRoi?: () => void;
  onManageOkr?: () => void;
  onOpenKpi?: (id: string) => void;
  onOpenRoi?: (initiativeId: string) => void;
  onOpenObjective?: (id: string) => void;
  /**
   * RV-023 (CB-02): which pair (KPI/ROI/OKR) is shown. Optional and
   * uncontrolled by default (falls back to internal state, `'kpi'`) so any
   * other caller of this view keeps working unchanged. `ResultsHub` passes
   * this so the selection gets a canonical route identity (`?pair=`) and
   * survives direct entry, refresh, and back/forward instead of always
   * resetting to KPI.
   */
  activePair?: ResultsPair;
  onActivePairChange?: (pair: ResultsPair) => void;
}

export type ResultsPair = 'kpi' | 'roi' | 'okr';

// ── Formatery ───────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toLocaleString();
}

function fmtCurrency(v: number, currency: string): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)} mln ${currency}`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)} tys ${currency}`;
  return `${sign}${abs.toLocaleString()} ${currency}`;
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// KPI attainment — status-driven (jak pctForKpi w usuniętym shellu): dla „mniej
// = lepiej" surowe current/target dałoby fałszywe 100%.
function kpiPct(k: ThreePairKpi): number {
  if (k.status === 'on-target') return 100;
  if (k.status === 'no-data' || k.current == null || !k.target) return 0;
  const ratio = Math.min(k.current, k.target) / Math.max(k.current, k.target);
  return clampPct(ratio * 100);
}

// ── Wspólne prymitywy wizualne (nie-tabelowe) ───────────────────────────────
const STATUS_META: Record<
  ThreePairKpiStatus,
  { dot: string; text: string; pl: string; en: string }
> = {
  'on-target': { dot: 'bg-c-success', text: 'text-c-success', pl: 'W celu', en: 'On target' },
  below: { dot: 'bg-c-danger', text: 'text-c-danger', pl: 'Poniżej celu', en: 'Below target' },
  'no-data': {
    dot: 'bg-c-text-muted',
    text: 'text-c-text-muted',
    pl: 'Brak danych',
    en: 'No data',
  },
};

const ragColor = (pct: number): string =>
  pct >= 80 ? 'bg-c-success' : pct >= 50 ? 'bg-c-warning' : 'bg-c-danger';

const ProgressBar: React.FC<{ pct: number; barClass?: string }> = ({ pct, barClass }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-c-surface-raised">
    <div
      className={`h-full rounded-full ${barClass ?? ragColor(pct)}`}
      style={{ width: `${clampPct(pct)}%` }}
    />
  </div>
);

// Karta-para: etykieta „plan" po lewej, „wynik" po prawej + pasek pokrycia.
const PairSummary: React.FC<{
  planLabel: string;
  planValue: string;
  actualLabel: string;
  actualValue: string;
  actualClass?: string;
  pct: number;
  note?: string;
}> = ({ planLabel, planValue, actualLabel, actualValue, actualClass, pct, note }) => (
  <div className="rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3">
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
          {planLabel}
        </div>
        <div className="mt-0.5 text-lg font-semibold text-c-text">{planValue}</div>
      </div>
      <div className="text-c-text-muted">→</div>
      <div className="text-right">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
          {actualLabel}
        </div>
        <div className={`mt-0.5 text-lg font-semibold ${actualClass ?? 'text-c-text'}`}>
          {actualValue}
        </div>
      </div>
    </div>
    <div className="mt-2.5">
      <ProgressBar pct={pct} />
    </div>
    {note && <div className="mt-1.5 text-xs text-c-text-secondary">{note}</div>}
  </div>
);

// Neutralny CTA (kanon: aktywne = neutralne, focus = c-focus; NIGDY crimson).
const NeutralCta: React.FC<{ label: string; onClick?: () => void }> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1.5 rounded-full border border-c-border-subtle bg-c-surface-raised px-3.5 py-1.5 text-sm font-medium text-c-text transition-colors hover:bg-c-surface focus:outline-none focus:ring-2 focus:ring-c-focus"
  >
    {label}
  </button>
);

const Section: React.FC<{
  step: number;
  title: string;
  subtitle: string;
  cta: React.ReactNode;
  children: React.ReactNode;
}> = ({ step, title, subtitle, cta, children }) => (
  <section className="rounded-2xl border border-c-border-subtle bg-c-surface/60 p-4 sm:p-5">
    <div className="mb-3 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-c-surface-raised text-sm font-semibold text-c-text-secondary">
          {step}
        </div>
        <div>
          <h2 className="text-base font-semibold text-c-text">{title}</h2>
          <p className="mt-0.5 text-sm text-c-text-secondary">{subtitle}</p>
        </div>
      </div>
      <div className="shrink-0">{cta}</div>
    </div>
    {children}
  </section>
);

// ── Widok ───────────────────────────────────────────────────────────────────
export const ResultsThreePairsView: React.FC<ResultsThreePairsViewProps> = ({
  kpis,
  roi,
  objectives,
  currency = 'PLN',
  isPolish = true,
  onAddKpi,
  onNewRoi,
  onManageOkr,
  onOpenKpi,
  onOpenRoi,
  onOpenObjective,
  activePair: activePairProp,
  onActivePairChange,
}) => {
  const tr = (pl: string, en: string) => (isPolish ? pl : en);
  const [internalActivePair, setInternalActivePair] = useState<ResultsPair>(
    activePairProp ?? 'kpi'
  );
  // RV-023: controlled when the caller passes `activePair` (ResultsHub does,
  // for route identity); otherwise falls back to the old uncontrolled
  // behavior so no other caller of this view breaks.
  const activePair = activePairProp ?? internalActivePair;
  const setActivePair = (pair: ResultsPair) => {
    onActivePairChange?.(pair);
    if (activePairProp === undefined) setInternalActivePair(pair);
  };

  // ── Para 1: KPI ───────────────────────────────────────────────────────────
  const kpiAgg = useMemo(() => {
    const total = kpis.length;
    const onTarget = kpis.filter((k) => k.status === 'on-target').length;
    const scored = kpis.filter((k) => k.status !== 'no-data');
    const avg = scored.length
      ? Math.round(scored.reduce((s, k) => s + kpiPct(k), 0) / scored.length)
      : 0;
    return { total, onTarget, avg };
  }, [kpis]);

  const kpiColumns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'name',
        label: 'KPI',
        width: '260px',
        render: (row: any) => {
          const k = row._kpi as ThreePairKpi;
          const meta = STATUS_META[k.status];
          return (
            <div className="flex items-center gap-2.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-c-text">{k.name}</div>
                {k.initiativeName && (
                  <div className="truncate text-xs text-c-text-muted">{k.initiativeName}</div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: 'target',
        label: tr('Cel', 'Target'),
        width: '110px',
        align: 'right',
        render: (row: any) => {
          const k = row._kpi as ThreePairKpi;
          return (
            <span className="text-sm text-c-text-secondary">
              {fmtNum(k.target)}
              {k.unit && <span className="ml-0.5 text-xs text-c-text-muted">{k.unit}</span>}
            </span>
          );
        },
      },
      {
        id: 'current',
        label: tr('Wynik', 'Actual'),
        width: '110px',
        align: 'right',
        render: (row: any) => {
          const k = row._kpi as ThreePairKpi;
          return (
            <span className={`text-sm font-semibold ${STATUS_META[k.status].text}`}>
              {fmtNum(k.current)}
              {k.unit && <span className="ml-0.5 text-xs text-c-text-muted">{k.unit}</span>}
            </span>
          );
        },
      },
      {
        id: 'progress',
        label: tr('Postęp', 'Progress'),
        width: '160px',
        render: (row: any) => {
          const k = row._kpi as ThreePairKpi;
          const pct = kpiPct(k);
          return (
            <div className="flex items-center gap-2">
              <div className="w-24">
                <ProgressBar pct={pct} />
              </div>
              <span className="w-9 text-right text-xs tabular-nums text-c-text-secondary">
                {pct}%
              </span>
            </div>
          );
        },
      },
      {
        id: 'status',
        label: 'Status',
        width: '130px',
        render: (row: any) => {
          const meta = STATUS_META[(row._kpi as ThreePairKpi).status];
          return <span className={`text-sm ${meta.text}`}>{tr(meta.pl, meta.en)}</span>;
        },
      },
    ],
    [isPolish]
  );

  const kpiRows = useMemo<TableRow[]>(
    () => kpis.map((k) => ({ id: k.id, _kpi: k }) as unknown as TableRow),
    [kpis]
  );

  // ── Para 2: ROI ───────────────────────────────────────────────────────────
  const roiAgg = useMemo(() => {
    const projected = roi.reduce((s, r) => s + r.projectedBenefit, 0);
    const realized = roi.reduce((s, r) => s + r.realizedBenefit, 0);
    const pct = projected > 0 ? clampPct((realized / projected) * 100) : 0;
    return { projected, realized, pct, variance: realized - projected };
  }, [roi]);

  const roiColumns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'initiative',
        label: tr('Inicjatywa', 'Initiative'),
        width: '260px',
        render: (row: any) => {
          const r = row._roi as ThreePairRoi;
          return (
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-c-text">{r.initiativeName}</div>
              {r.ownerName && (
                <div className="truncate text-xs text-c-text-muted">{r.ownerName}</div>
              )}
            </div>
          );
        },
      },
      {
        id: 'projected',
        label: tr('Oczekiwany', 'Expected'),
        width: '140px',
        align: 'right',
        render: (row: any) => (
          <span className="text-sm text-c-text-secondary">
            {fmtCurrency((row._roi as ThreePairRoi).projectedBenefit, currency)}
          </span>
        ),
      },
      {
        id: 'realized',
        label: tr('Zrealizowany (netto)', 'Realized (net)'),
        width: '160px',
        align: 'right',
        render: (row: any) => {
          const r = row._roi as ThreePairRoi;
          if (!r.hasRealized) return <span className="text-sm text-c-text-muted">—</span>;
          const color =
            r.realizedBenefit >= r.projectedBenefit ? 'text-c-success' : 'text-c-warning';
          return (
            <span className={`text-sm font-semibold ${color}`}>
              {fmtCurrency(r.realizedBenefit, currency)}
            </span>
          );
        },
      },
      {
        id: 'variance',
        label: tr('Odchylenie', 'Variance'),
        width: '130px',
        align: 'right',
        render: (row: any) => {
          const r = row._roi as ThreePairRoi;
          if (!r.hasRealized) return <span className="text-sm text-c-text-muted">—</span>;
          const delta = r.realizedBenefit - r.projectedBenefit;
          const color = delta >= 0 ? 'text-c-success' : 'text-c-danger';
          return (
            <span className={`text-sm ${color}`}>
              {delta >= 0 ? '+' : ''}
              {fmtCurrency(delta, currency)}
            </span>
          );
        },
      },
    ],
    [isPolish, currency]
  );

  const roiRows = useMemo<TableRow[]>(
    () => roi.map((r) => ({ id: r.initiativeId, _roi: r }) as unknown as TableRow),
    [roi]
  );

  // ── Para 3: OKR ───────────────────────────────────────────────────────────
  const okrAgg = useMemo(() => {
    const total = objectives.length;
    const krCount = objectives.reduce((s, o) => s + o.keyResults.length, 0);
    const avg = total
      ? Math.round((objectives.reduce((s, o) => s + o.rollupScore, 0) / total) * 100)
      : 0;
    return { total, krCount, avg };
  }, [objectives]);

  const okrColumns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'objective',
        label: tr('Cel strategiczny', 'Objective'),
        width: '240px',
        render: (row: any) => (
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-c-text">{row._objectiveLabel}</div>
            <div className="truncate text-xs text-c-text-muted">{row._krLabel}</div>
          </div>
        ),
      },
      {
        id: 'target',
        label: tr('Cel', 'Target'),
        width: '100px',
        align: 'right',
        render: (row: any) => (
          <span className="text-sm text-c-text-secondary">{fmtNum(row._target)}</span>
        ),
      },
      {
        id: 'current',
        label: tr('Wynik', 'Actual'),
        width: '100px',
        align: 'right',
        render: (row: any) => (
          <span className="text-sm font-semibold text-c-text">{fmtNum(row._current)}</span>
        ),
      },
      {
        id: 'progress',
        label: tr('Postęp', 'Progress'),
        width: '180px',
        render: (row: any) => (
          <div className="flex items-center gap-2">
            <div className="w-28">
              <ProgressBar pct={row._pct} />
            </div>
            <span className="w-9 text-right text-xs tabular-nums text-c-text-secondary">
              {row._pct}%
            </span>
          </div>
        ),
      },
    ],
    [isPolish]
  );

  const okrRows = useMemo<TableRow[]>(
    () =>
      objectives.flatMap((o) =>
        o.keyResults.map((kr) => {
          const denom = kr.target - kr.baseline || 1;
          const pct = clampPct(((kr.current - kr.baseline) / denom) * 100);
          return {
            id: kr.id,
            _objectiveId: o.id,
            _objectiveLabel: o.label,
            _krLabel: kr.label,
            _target: kr.target,
            _current: kr.current,
            _pct: pct,
          } as unknown as TableRow;
        })
      ),
    [objectives]
  );

  // M07 MVP (2026-08-05): kontener był `max-w-5xl` (1024px). Na referencyjnym
  // desktopie 1440 tabele KPI i ROI potrzebują 980px, a scroller dawał 900px
  // → 80px przepełnienia: ostatnia kolumna ucinała się w połowie słowa
  // („Poniżej cel", „Brak danyc", ODCHYLENIE → „OD" z nieczytelnymi +3/−8),
  // przy ~370px pustki po każdej stronie. `max-w-7xl` mieści wszystkie trzy
  // tabele bez poziomego przewijania. Zmierzone, nie oszacowane.
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 sm:p-6">
      <header className="px-1">
        <h1 className="text-xl font-semibold text-c-text">{tr('Rezultaty', 'Results')}</h1>
        <p className="mt-1 text-sm text-c-text-secondary">
          {tr(
            'Niefinansowe rezultaty inicjatyw w trzech parach: obietnica ↔ realizacja.',
            'Non-financial initiative results in three pairs: promise ↔ delivery.'
          )}
        </p>
      </header>

      <nav
        aria-label={tr('Tabele rezultatów', 'Results tables')}
        className="flex flex-wrap items-center gap-2 border-b border-c-border-subtle pb-3"
      >
        {(
          [
            ['kpi', tr('KPI', 'KPI'), `${kpiAgg.total}`],
            ['roi', tr('ROI', 'ROI'), `${roi.length}`],
            ['okr', tr('OKR', 'OKR'), `${objectives.length}`],
          ] as const
        ).map(([id, label, count]) => {
          const active = activePair === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              data-testid={`results-pair-tab-${id}`}
              onClick={() => setActivePair(id)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-c-focus ${
                active
                  ? 'border-c-border bg-c-surface-raised text-c-text'
                  : 'border-c-border-subtle bg-transparent text-c-text-secondary hover:bg-c-surface'
              }`}
            >
              <span>{label}</span>
              <span className="rounded-full bg-c-surface px-2 py-0.5 text-xs text-c-text-muted">
                {count}
              </span>
            </button>
          );
        })}
      </nav>

      {/* PARA 1 — KPI (cel ↔ wynik) */}
      {activePair === 'kpi' && (
        <Section
          step={1}
          title={tr('KPI — cel ↔ wynik', 'KPI — target ↔ actual')}
          subtitle={tr(
            'Mierzalne wskaźniki inicjatyw: gdzie jesteśmy względem celu.',
            'Measurable initiative indicators: where we are vs the target.'
          )}
          cta={<NeutralCta label={tr('+ Dodaj KPI', '+ Add KPI')} onClick={onAddKpi} />}
        >
          <div className="mb-3">
            <PairSummary
              planLabel={tr('Monitorowane', 'Tracked')}
              planValue={`${kpiAgg.total} KPI`}
              actualLabel={tr('W celu', 'On target')}
              actualValue={`${kpiAgg.onTarget}/${kpiAgg.total}`}
              actualClass={kpiAgg.onTarget === kpiAgg.total ? 'text-c-success' : 'text-c-text'}
              pct={kpiAgg.avg}
              note={tr(
                `Średnia realizacja celu: ${kpiAgg.avg}%`,
                `Average target attainment: ${kpiAgg.avg}%`
              )}
            />
          </div>
          <StandardTable
            columns={kpiColumns}
            data={kpiRows}
            onRowClick={onOpenKpi ? (row) => onOpenKpi(String(row.id)) : undefined}
            empty={{
              title: tr('Brak KPI', 'No KPIs'),
              description: tr(
                'Dodaj pierwszy wskaźnik inicjatywy.',
                'Add the first initiative KPI.'
              ),
            }}
          />
        </Section>
      )}

      {/* PARA 2 — ROI (oczekiwany ↔ zrealizowany netto) */}
      {activePair === 'roi' && (
        <Section
          step={2}
          title={tr('ROI — oczekiwany ↔ zrealizowany', 'ROI — expected ↔ realized')}
          subtitle={tr(
            'Korzyści netto inicjatyw: prognoza względem realizacji.',
            'Net initiative benefits: forecast vs realization.'
          )}
          cta={
            <NeutralCta label={tr('+ Nowa analiza ROI', '+ New ROI analysis')} onClick={onNewRoi} />
          }
        >
          <div className="mb-3">
            <PairSummary
              planLabel={tr('Oczekiwany (netto)', 'Expected (net)')}
              planValue={fmtCurrency(roiAgg.projected, currency)}
              actualLabel={tr('Zrealizowany (netto)', 'Realized (net)')}
              actualValue={fmtCurrency(roiAgg.realized, currency)}
              actualClass={roiAgg.variance >= 0 ? 'text-c-success' : 'text-c-warning'}
              pct={roiAgg.pct}
              note={tr(
                `Pokrycie realizacji: ${roiAgg.pct}%`,
                `Realization coverage: ${roiAgg.pct}%`
              )}
            />
          </div>
          <StandardTable
            columns={roiColumns}
            data={roiRows}
            onRowClick={onOpenRoi ? (row) => onOpenRoi(String(row.id)) : undefined}
            empty={{
              title: tr('Brak analiz ROI', 'No ROI analyses'),
              description: tr(
                'Uruchom pierwszą analizę ROI per inicjatywa.',
                'Run the first per-initiative ROI analysis.'
              ),
            }}
          />
        </Section>
      )}

      {/* PARA 3 — OKR (cel strategiczny ↔ kluczowe rezultaty) */}
      {activePair === 'okr' && (
        <Section
          step={3}
          title={tr('OKR — cel ↔ kluczowe rezultaty', 'OKR — objective ↔ key results')}
          subtitle={tr(
            'Strategiczne cele i ich mierzalne kluczowe rezultaty (KR).',
            'Strategic objectives and their measurable key results (KR).'
          )}
          cta={<NeutralCta label={tr('Zarządzaj OKR', 'Manage OKR')} onClick={onManageOkr} />}
        >
          <div className="mb-3">
            <PairSummary
              planLabel={tr('Cele strategiczne', 'Objectives')}
              planValue={`${okrAgg.total}`}
              actualLabel={tr('Kluczowe rezultaty', 'Key results')}
              actualValue={`${okrAgg.krCount}`}
              pct={okrAgg.avg}
              note={tr(
                `Średni wynik OKR (rollup): ${okrAgg.avg}%`,
                `Average OKR score (rollup): ${okrAgg.avg}%`
              )}
            />
          </div>
          <StandardTable
            columns={okrColumns}
            data={okrRows}
            onRowClick={
              onOpenObjective ? (row: any) => onOpenObjective(String(row._objectiveId)) : undefined
            }
            empty={{
              title: tr('Brak OKR', 'No OKRs'),
              description: tr(
                'Zdefiniuj pierwszy cel strategiczny i jego KR.',
                'Define the first strategic objective and its KRs.'
              ),
            }}
          />
        </Section>
      )}
    </div>
  );
};

export default ResultsThreePairsView;
