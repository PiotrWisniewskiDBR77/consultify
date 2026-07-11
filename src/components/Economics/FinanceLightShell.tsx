/**
 * FinanceLightShell — lightweight, dense redesign of the Finance module
 * surface (companion to `DRDLightShell` — same doctrine, same shell shape).
 * NEW component; `FinanceHub.tsx` is untouched. Gated OFF by default behind
 * `financeLightFlag.ts` (`?ff_financeLight=1`) — real wiring into FinanceHub
 * happens in a later step, only after Piotr signs off on the harness
 * screenshot (CLAUDE.md rule #7: no flag-flip as a first look).
 *
 * Composition mirrors DRDLightShell:
 *   1. Compact header strip (breadcrumb · company · period/currency chips · CTA).
 *   2. Left rail: 4 sections — Sprawozdania · Wskaźniki · Wycena · Prognoza.
 *      "Investment Analysis" is intentionally absent (owner note #82a: NPV/IRR
 *      belongs in Results, not Finance) — this shell has 4 tabs, not 6.
 *   3. Center: real engine OUTPUT SHAPES rendered densely, no empty panels:
 *      - Sprawozdania: key P&L/BS/CF lines + Reconcile R1–R8 status list
 *        (`reconciliationService.ts` check codes/severities, shadow mode).
 *      - Wskaźniki: 5-family ratio catalog (`financeRatioFamilyCatalog.ts`) —
 *        liquidity/profitability/leverage/efficiency/value, one dense list
 *        per family, formula shown inline (no separate "what is this" screen).
 *      - Wycena: the REAL `<EvBasketFootballField>` component (import, not
 *        reimplementation) — 4-method EV basket, convergence zone, flag.
 *      - Prognoza: compact forecast rows (period · revenue · EBITDA · confidence).
 *   4. Right rail: lineage/sources (statement pack, model, ratio + valuation
 *      engine versions) + last-activity line — mirrors DRDLightShell's
 *      "Źródła i założenia" / "Aktywność" pattern.
 *
 * COLOR DOCTRINE (hard, identical to DRDLightShell):
 *   - `c-accent` (Harvard Crimson) is reserved for critical semantics only —
 *     NOT used here. Active tab / primary numbers = the blue focus token
 *     (`--c-focus-solid`). Reconcile pass = `c-success`, warning = `c-warning`,
 *     fail = `c-danger`, skipped = muted text. Primary CTA is neutral
 *     (`bg-c-text text-c-surface`).
 *   - All colors via c-* tokens (Tailwind classes or `var(--c-*)` /
 *     `rgb(var(--c-*-rgb) / a)`), never raw hex — both themes adapt.
 *
 * This component is presentational only (props in, JSX out) — no store, no
 * API calls, no context — exactly like `EvBasketFootballField`. Mock data for
 * the dev-render harness lives in `dev-render/screens/finance-light.tsx`, not
 * here (same split as `drd-light.tsx` vs `DRDLightShell.tsx`).
 */
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  FolderOpen,
  Layers,
  LineChart,
  ListChecks,
  MessageSquare,
  MinusCircle,
  PieChart,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import EvBasketFootballField, {
  type EvBasketResult,
} from './panels/EvBasketFootballField';

// ---------------------------------------------------------------------------
// Types — lightweight mirrors of the server engine output shapes
// (financeRatioFamilyCatalog.ts / reconciliationService.ts). Kept local to
// the frontend bundle (src/ never imports server/ directly in this codebase).
// ---------------------------------------------------------------------------

export type FinanceRatioFamily = 'liquidity' | 'profitability' | 'leverage' | 'efficiency' | 'value';
export type FinanceRatioUnit = 'x' | '%' | 'days' | 'currency' | 'pp';
export type FinanceRatioDirection = 'higher_better' | 'lower_better';

export interface FinanceRatioLite {
  code: string;
  family: FinanceRatioFamily;
  labelPl: string;
  formula: string;
  value: number | null;
  unit: FinanceRatioUnit;
  direction: FinanceRatioDirection;
  status: 'computed' | 'skipped';
}

export type ReconcileStatusLite = 'pass' | 'warning' | 'fail' | 'skipped';

export interface ReconcileCheckLite {
  checkCode: string;
  checkName: string;
  status: ReconcileStatusLite;
  severity: 'error' | 'warning';
  message: string;
}

export interface ReconcileSummaryLite {
  passed: number;
  warnings: number;
  failed: number;
  skipped: number;
  overallStatus: 'pass' | 'warning' | 'fail';
}

export interface StatementLineLite {
  label: string;
  value: number;
}

export interface PredictionPointLite {
  periodLabel: string;
  revenue: number;
  ebitda: number;
  confidencePct: number;
}

export interface FinanceLineageSourceLite {
  label: string;
  detail: string;
}

interface FinanceLightShellProps {
  companyName?: string;
  periodLabel?: string;
  currency?: string;
  statementLines?: StatementLineLite[];
  reconcile?: { checks: ReconcileCheckLite[]; summary: ReconcileSummaryLite };
  ratios?: FinanceRatioLite[];
  evBasket?: EvBasketResult | null;
  prediction?: PredictionPointLite[];
  lineageSources?: FinanceLineageSourceLite[];
  lastUpdatedLabel?: string;
  onExportReport?: () => void;
  onOpenChat?: () => void;
}

type LightTab = 'statements' | 'ratios' | 'valuation' | 'prediction';

const BLUE = 'rgb(var(--c-focus-solid-rgb))';
const BLUE_SOFT = 'rgb(var(--c-focus-solid-rgb) / 0.10)';

const TAB_ICON: Record<LightTab, React.ReactNode> = {
  statements: <FileText className="h-[13px] w-[13px]" />,
  ratios: <ListChecks className="h-[13px] w-[13px]" />,
  valuation: <PieChart className="h-[13px] w-[13px]" />,
  prediction: <LineChart className="h-[13px] w-[13px]" />,
};

const FAMILY_LABEL_PL: Record<FinanceRatioFamily, string> = {
  liquidity: 'Płynność',
  profitability: 'Rentowność',
  leverage: 'Zadłużenie',
  efficiency: 'Efektywność',
  value: 'Wartość',
};

const FAMILY_ORDER: FinanceRatioFamily[] = ['liquidity', 'profitability', 'leverage', 'efficiency', 'value'];

function formatRatioValue(value: number | null, unit: FinanceRatioUnit): string {
  if (value === null) return '—';
  switch (unit) {
    case '%':
    case 'pp':
      return `${value.toFixed(1)}%`;
    case 'days':
      return `${Math.round(value)} dni`;
    case 'x':
      return `${value.toFixed(2)}x`;
    default:
      return value.toLocaleString('pl-PL', { maximumFractionDigits: 0 });
  }
}

function formatCurrencyValue(value: number, currency: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M ${currency}`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}k ${currency}`;
  return `${sign}${abs.toFixed(0)} ${currency}`;
}

const RECONCILE_STATUS_META: Record<
  ReconcileStatusLite,
  { icon: React.ReactNode; colorClass: string; labelPl: string }
> = {
  pass: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, colorClass: 'text-c-success', labelPl: 'zgodne' },
  warning: { icon: <AlertTriangle className="h-3.5 w-3.5" />, colorClass: 'text-c-warning', labelPl: 'ostrzeżenie' },
  fail: { icon: <XCircle className="h-3.5 w-3.5" />, colorClass: 'text-c-danger', labelPl: 'niezgodne' },
  skipped: { icon: <MinusCircle className="h-3.5 w-3.5" />, colorClass: 'text-c-text-muted', labelPl: 'pominięte' },
};

export const FinanceLightShell: React.FC<FinanceLightShellProps> = ({
  companyName,
  periodLabel,
  currency = 'PLN',
  statementLines = [],
  reconcile,
  ratios = [],
  evBasket,
  prediction = [],
  lineageSources = [],
  lastUpdatedLabel,
  onExportReport,
  onOpenChat,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const t = (pl: string, en: string) => (isPolish ? pl : en);

  const [activeTab, setActiveTab] = useState<LightTab>('statements');

  const ratiosByFamily = useMemo(() => {
    const map: Record<FinanceRatioFamily, FinanceRatioLite[]> = {
      liquidity: [],
      profitability: [],
      leverage: [],
      efficiency: [],
      value: [],
    };
    for (const r of ratios) map[r.family].push(r);
    return map;
  }, [ratios]);

  const computedRatioCount = ratios.filter((r) => r.status === 'computed').length;

  const TAB_LABEL: Record<LightTab, string> = {
    statements: t('Sprawozdania', 'Statements'),
    ratios: t('Wskaźniki', 'Ratios'),
    valuation: t('Wycena', 'Valuation'),
    prediction: t('Prognoza', 'Prediction'),
  };
  const TAB_META: Record<LightTab, string> = {
    statements: `${statementLines.length} ${t('pozycji', 'lines')} · R1–R8`,
    ratios: `${computedRatioCount} / ${ratios.length} ${t('wyliczone', 'computed')}`,
    valuation: evBasket ? `${evBasket.methods.length} ${t('metod', 'methods')}` : t('brak koszyka', 'no basket'),
    prediction: `${prediction.length} ${t('okresów', 'periods')}`,
  };

  const reconcileSummary = reconcile?.summary;

  return (
    <div className="flex h-full flex-col bg-c-bg text-c-text">
      {/* ─── Compact header strip ─── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-c-border bg-c-surface px-5 py-3">
        <span className="text-[12px] text-c-text-muted">
          Finance <span className="mx-1 text-c-text-secondary">›</span> {TAB_LABEL[activeTab]}
        </span>
        <h1 className="m-0 text-[15px] font-semibold tracking-tight text-c-text">
          {companyName || 'DBR77 Sp. z o.o.'}
        </h1>
        {periodLabel && (
          <span className="rounded-full border border-c-border bg-c-surface-raised px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-c-text-secondary">
            {periodLabel}
          </span>
        )}
        <span className="rounded-full border border-c-border bg-c-surface-raised px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-c-text-secondary">
          {currency}
        </span>

        {reconcileSummary && (
          <span className="ml-1 flex items-center gap-1.5 text-[12px]">
            <span className="text-c-text-muted">{t('uzgodnienie', 'reconcile')}</span>
            <span
              className={`font-semibold tabular-nums ${
                reconcileSummary.overallStatus === 'fail'
                  ? 'text-c-danger'
                  : reconcileSummary.overallStatus === 'warning'
                    ? 'text-c-warning'
                    : 'text-c-success'
              }`}
            >
              {reconcileSummary.passed}/
              {reconcileSummary.passed + reconcileSummary.warnings + reconcileSummary.failed + reconcileSummary.skipped}
            </span>
          </span>
        )}

        <span className="flex-1" />

        {onOpenChat && (
          <button
            type="button"
            onClick={onOpenChat}
            className="inline-flex items-center gap-2 rounded-lg border border-transparent px-3 py-1.5 text-[13px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised"
          >
            <MessageSquare className="h-4 w-4" />
            {t('Zapytaj Teresę', 'Ask Teresa')}
          </button>
        )}
        <button
          type="button"
          onClick={onExportReport}
          disabled={!onExportReport}
          className="inline-flex items-center gap-2 rounded-lg bg-c-text px-3.5 py-1.5 text-[13px] font-semibold text-c-surface transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <FileText className="h-4 w-4" />
          {t('Eksportuj raport', 'Export report')}
        </button>
      </div>

      {/* ─── 3-column work area ─── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[212px_1fr] lg:grid-cols-[212px_1fr_296px]">
        {/* NAV RAIL */}
        <nav className="hidden overflow-y-auto border-r border-c-border bg-c-surface px-3 py-4 md:block">
          <p className="mx-1.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
            {t('Finanse', 'Finance')}
          </p>
          <div className="flex flex-col gap-0.5">
            {(['statements', 'ratios', 'valuation', 'prediction'] as LightTab[]).map((tab) => {
              const on = tab === activeTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    on ? '' : 'hover:bg-c-surface-raised'
                  }`}
                  style={on ? { backgroundColor: BLUE_SOFT } : undefined}
                >
                  <span
                    className="grid h-[26px] w-[26px] flex-shrink-0 place-items-center rounded-full"
                    style={{ backgroundColor: 'var(--c-surface)', border: `1px solid ${on ? BLUE : 'var(--c-border)'}` }}
                  >
                    <span className="text-c-text-secondary" style={on ? { color: BLUE } : undefined}>
                      {TAB_ICON[tab]}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[13px] leading-tight tracking-tight ${
                        on ? 'font-semibold' : 'text-c-text'
                      }`}
                      style={on ? { color: BLUE } : undefined}
                    >
                      {TAB_LABEL[tab]}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-c-text-muted tabular-nums">
                      {TAB_META[tab]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* CENTER */}
        <main className="min-w-0 overflow-y-auto px-6 py-5">
          {activeTab === 'statements' && (
            <StatementsTab
              statementLines={statementLines}
              currency={currency}
              reconcile={reconcile}
              t={t}
            />
          )}
          {activeTab === 'ratios' && (
            <RatiosTab ratiosByFamily={ratiosByFamily} t={t} />
          )}
          {activeTab === 'valuation' && (
            <div className="mx-auto max-w-[820px]">
              <EvBasketFootballField
                basket={evBasket}
                unitLabel={`mln ${currency}`}
                subjectLabel={`${companyName || 'DBR77 Sp. z o.o.'} — ${periodLabel || t('Wycena', 'Valuation')}`}
              />
            </div>
          )}
          {activeTab === 'prediction' && (
            <PredictionTab prediction={prediction} currency={currency} t={t} />
          )}
        </main>

        {/* ASIDE */}
        <aside className="hidden overflow-y-auto border-l border-c-border bg-c-surface px-4 py-4 lg:block">
          <p className="mx-0.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
            {t('Wsparcie', 'Support')}
          </p>

          <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
            <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
              <FolderOpen className="h-[15px] w-[15px] text-c-text-muted" />
              {t('Źródła danych', 'Data sources')}
              <span
                className="ml-auto rounded-full px-1.5 py-px text-[10.5px] font-semibold"
                style={{ backgroundColor: BLUE_SOFT, color: BLUE }}
              >
                {lineageSources.length}
              </span>
            </div>
            <div className="flex flex-col gap-2.5 px-3.5 pb-3.5">
              {lineageSources.length === 0 && (
                <p className="m-0 text-[12.5px] leading-snug text-c-text-muted">
                  {t('Brak podpiętych źródeł.', 'No sources attached.')}
                </p>
              )}
              {lineageSources.map((src) => (
                <div key={src.label} className="flex items-start gap-2 text-[12.5px] leading-snug">
                  <Layers className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-c-text-muted" />
                  <span>
                    <span className="font-semibold text-c-text">{src.label}</span>{' '}
                    <span className="text-c-text-secondary">{src.detail}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
            <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
              <Clock className="h-[15px] w-[15px] text-c-text-muted" />
              {t('Aktywność', 'Activity')}
            </div>
            <div className="px-3.5 pb-3.5 text-[12.5px] leading-snug text-c-text-secondary">
              {lastUpdatedLabel || t('Zaktualizowano dziś.', 'Updated today.')}
            </div>
          </div>

          <div className="mt-2.5 border-t border-c-border pt-2.5 text-[11.5px] text-c-text-muted">
            {t(
              'Wskaźniki i uzgodnienie liczy silnik deterministycznie — czat tylko opisuje wynik, nie zmienia liczb.',
              'Ratios and reconcile are computed deterministically by the engine — chat only narrates the result, never changes the numbers.'
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-sections (kept in-file — presentational only, not reused elsewhere yet)
// ---------------------------------------------------------------------------

function StatementsTab({
  statementLines,
  currency,
  reconcile,
  t,
}: {
  statementLines: StatementLineLite[];
  currency: string;
  reconcile?: { checks: ReconcileCheckLite[]; summary: ReconcileSummaryLite };
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  return (
    <>
      <div className="mb-1 flex items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">
            {t('Sprawozdania finansowe', 'Financial statements')}
          </h2>
          <div className="mt-0.5 text-[12.5px] text-c-text-muted">
            {t('Kluczowe pozycje P&L / bilansu / cash flow', 'Key P&L / balance sheet / cash flow lines')}
          </div>
        </div>
      </div>

      {/* dense metric row — key statement lines */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {statementLines.map((line) => (
          <div key={line.label} className="rounded-xl border border-c-border bg-c-surface px-3.5 py-3">
            <div className="text-[11px] uppercase tracking-wide text-c-text-muted">{line.label}</div>
            <div className="mt-1 text-[17px] font-semibold tabular-nums tracking-tight text-c-text">
              {formatCurrencyValue(line.value, currency)}
            </div>
          </div>
        ))}
        {statementLines.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-c-border px-4 py-6 text-center text-[12.5px] text-c-text-muted">
            {t('Brak podpiętego pakietu sprawozdań.', 'No statement pack attached.')}
          </div>
        )}
      </div>

      {/* Reconcile R1-R8 */}
      <div className="mt-6">
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-c-text-muted">
            {t('Uzgodnienie R1–R8', 'Reconcile R1–R8')}
          </h3>
          {reconcile?.summary && (
            <div className="flex items-center gap-3 text-[11.5px]">
              <span className="flex items-center gap-1 text-c-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> {reconcile.summary.passed}
              </span>
              <span className="flex items-center gap-1 text-c-warning">
                <AlertTriangle className="h-3.5 w-3.5" /> {reconcile.summary.warnings}
              </span>
              <span className="flex items-center gap-1 text-c-danger">
                <XCircle className="h-3.5 w-3.5" /> {reconcile.summary.failed}
              </span>
              <span className="flex items-center gap-1 text-c-text-muted">
                <MinusCircle className="h-3.5 w-3.5" /> {reconcile.summary.skipped}
              </span>
            </div>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-c-border">
          {(reconcile?.checks || []).map((check, idx) => {
            const meta = RECONCILE_STATUS_META[check.status];
            return (
              <div
                key={check.checkCode}
                className={`grid grid-cols-[22px_120px_1fr_auto] items-center gap-3 px-4 py-2.5 text-[12.5px] ${
                  idx > 0 ? 'border-t border-c-border' : ''
                }`}
              >
                <span className={meta.colorClass}>{meta.icon}</span>
                <span className="truncate font-mono text-[11px] font-semibold text-c-text-muted">
                  {check.checkCode}
                </span>
                <span className="truncate text-c-text-secondary">{check.message}</span>
                <span className={`text-[11px] font-semibold uppercase tracking-wide ${meta.colorClass}`}>
                  {meta.labelPl}
                </span>
              </div>
            );
          })}
          {(!reconcile || reconcile.checks.length === 0) && (
            <div className="px-4 py-6 text-center text-[12.5px] text-c-text-muted">
              {t('Brak wyników uzgodnienia dla tego okresu.', 'No reconcile results for this period.')}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function RatiosTab({
  ratiosByFamily,
  t,
}: {
  ratiosByFamily: Record<FinanceRatioFamily, FinanceRatioLite[]>;
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  return (
    <>
      <div className="mb-1 flex items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">
            {t('Wskaźniki finansowe', 'Financial ratios')}
          </h2>
          <div className="mt-0.5 text-[12.5px] text-c-text-muted">
            {t('5 rodzin wskaźników — silnik liczy, brakująca linia = pominięte, nigdy 0', '5 ratio families — engine-computed, a missing line is skipped, never guessed as 0')}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {FAMILY_ORDER.map((family) => {
          const items = ratiosByFamily[family];
          if (!items || items.length === 0) return null;
          return (
            <div key={family} className="overflow-hidden rounded-xl border border-c-border">
              <div className="flex items-center gap-2 border-b border-c-border bg-c-surface-raised px-4 py-2.5">
                <span className="text-[12.5px] font-semibold text-c-text">{FAMILY_LABEL_PL[family]}</span>
                <span className="text-[11px] text-c-text-muted">
                  {items.filter((r) => r.status === 'computed').length}/{items.length}
                </span>
              </div>
              <div>
                {items.map((ratio, idx) => {
                  const DirIcon = ratio.direction === 'higher_better' ? TrendingUp : TrendingDown;
                  return (
                    <div
                      key={ratio.code}
                      className={`grid grid-cols-[1fr_auto_18px] items-center gap-3 px-4 py-2.5 ${
                        idx > 0 ? 'border-t border-c-border' : ''
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-c-text">{ratio.labelPl}</span>
                        <span className="block truncate font-mono text-[10.5px] text-c-text-muted">{ratio.formula}</span>
                      </span>
                      <span
                        className={`text-[14px] font-semibold tabular-nums ${
                          ratio.status === 'skipped' ? 'text-c-text-muted' : 'text-c-text'
                        }`}
                      >
                        {formatRatioValue(ratio.value, ratio.unit)}
                      </span>
                      <DirIcon className="h-3.5 w-3.5 text-c-text-muted" />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function PredictionTab({
  prediction,
  currency,
  t,
}: {
  prediction: PredictionPointLite[];
  currency: string;
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  return (
    <>
      <div className="mb-1 flex items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">
            {t('Prognoza', 'Prediction')}
          </h2>
          <div className="mt-0.5 text-[12.5px] text-c-text-muted">
            {t('Przychód i EBITDA na kolejne okresy, z poziomem pewności modelu', 'Revenue and EBITDA for upcoming periods, with model confidence')}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-c-border">
        {prediction.map((p, idx) => (
          <div
            key={p.periodLabel}
            className={`grid grid-cols-[100px_1fr_1fr_140px] items-center gap-4 px-4 py-3 ${
              idx > 0 ? 'border-t border-c-border' : ''
            }`}
          >
            <span className="text-[13px] font-semibold text-c-text">{p.periodLabel}</span>
            <span className="text-[13px] tabular-nums text-c-text-secondary">
              {t('Przychód', 'Revenue')}{' '}
              <span className="font-semibold text-c-text">{formatCurrencyValue(p.revenue, currency)}</span>
            </span>
            <span className="text-[13px] tabular-nums text-c-text-secondary">
              EBITDA <span className="font-semibold text-c-text">{formatCurrencyValue(p.ebitda, currency)}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-c-surface-raised">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${Math.round(p.confidencePct)}%`, backgroundColor: BLUE }}
                />
              </span>
              <span className="w-9 text-right text-[11px] font-semibold tabular-nums text-c-text-muted">
                {Math.round(p.confidencePct)}%
              </span>
            </span>
          </div>
        ))}
        {prediction.length === 0 && (
          <div className="px-4 py-6 text-center text-[12.5px] text-c-text-muted">
            {t('Brak prognozy dla tego modelu.', 'No forecast for this model.')}
          </div>
        )}
      </div>
    </>
  );
}

export default FinanceLightShell;
