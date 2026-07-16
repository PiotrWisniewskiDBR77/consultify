/**
 * M16 value suite (wire-d) — Banking the Value panel.
 *
 * Consumes POST /api/v8/finance/value-tracking/banking/{bank,status,portfolio}
 * (server: bankingValueService — see finance-value.routes.ts §6). Only HARD +
 * RUN-RATE benefits are bankable — wired into the next period's budget line.
 * A benefit is "banked" once actuals confirm the plan; if actuals fall short,
 * it has "leaked". The panel lets the user bank a single benefit, check its
 * status against an actual, and roll a small portfolio into banked/pending/
 * leaked totals.
 *
 * Fail-soft: a request error degrades to a quiet inline notice, never throws.
 * Behind flag `m16ValueSuite` (default OFF) — see financeFeatureFlags.ts.
 */
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type BankBenefitResult,
  type BankingStatusResult,
  type BankingStatusValue,
  type Benefit,
  type BenefitType,
  postBankBenefit,
  postBankingStatus,
  postPortfolioBanked,
  type PortfolioBankedResult,
  type PortfolioBenefitItem,
} from '@/services/api/v8/financeValue';

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
};

const fmtPct = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(0)}%`;
};

const STATUS_TONE: Record<BankingStatusValue, string> = {
  banked: 'border-c-success/30 bg-c-success/10 text-c-success',
  pending: 'border-c-warning/30 bg-c-warning/10 text-c-warning',
  leaked: 'border-c-danger/30 bg-c-danger/10 text-c-danger',
};

interface PortfolioRow {
  id: string;
  value: string;
  type: BenefitType;
  isHard: boolean;
  isRunRate: boolean;
  mappedBudgetLine: string;
  actual: string;
}

let rowSeq = 0;
const nextRowId = (): string => `benefit-${Date.now().toString(36)}-${rowSeq++}`;

const DEFAULT_PORTFOLIO: PortfolioRow[] = [
  {
    id: nextRowId(),
    value: '400000',
    type: 'cost_out',
    isHard: true,
    isRunRate: true,
    mappedBudgetLine: 'OPEX-IT',
    actual: '420000',
  },
  {
    id: nextRowId(),
    value: '250000',
    type: 'revenue_up',
    isHard: true,
    isRunRate: true,
    mappedBudgetLine: 'REV-SaaS',
    actual: '180000',
  },
  {
    id: nextRowId(),
    value: '150000',
    type: 'cost_out',
    isHard: true,
    isRunRate: true,
    mappedBudgetLine: 'OPEX-Facilities',
    actual: '',
  },
];

export interface BankingValuePanelProps {
  fetcher?: {
    bank?: typeof postBankBenefit;
    status?: typeof postBankingStatus;
    portfolio?: typeof postPortfolioBanked;
  };
}

export const BankingValuePanel: React.FC<BankingValuePanelProps> = ({ fetcher }) => {
  const { t } = useTranslation();

  // Single-benefit form
  const [value, setValue] = useState('400000');
  const [type, setType] = useState<BenefitType>('cost_out');
  const [isHard, setIsHard] = useState(true);
  const [isRunRate, setIsRunRate] = useState(true);
  const [mappedBudgetLine, setMappedBudgetLine] = useState('OPEX-IT');
  const [targetBudgetPeriod, setTargetBudgetPeriod] = useState('2027-Q1');
  const [actual, setActual] = useState('420000');

  const [bankResult, setBankResult] = useState<BankBenefitResult | null>(null);
  const [statusResult, setStatusResult] = useState<BankingStatusResult | null>(null);

  // Portfolio
  const [rows, setRows] = useState<PortfolioRow[]>(DEFAULT_PORTFOLIO);
  const [portfolioResult, setPortfolioResult] = useState<PortfolioBankedResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentBenefit = useCallback(
    (): Benefit => ({
      value: Number(value) || 0,
      type,
      isHard,
      isRunRate,
      mappedBudgetLine: mappedBudgetLine.trim() || 'UNMAPPED',
    }),
    [value, type, isHard, isRunRate, mappedBudgetLine]
  );

  const bank = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fn = fetcher?.bank ?? postBankBenefit;
      const res = await fn(currentBenefit(), targetBudgetPeriod.trim() || 'unassigned');
      setBankResult(res ?? null);
    } catch (err: any) {
      setBankResult(null);
      setError(
        err?.message
          ? String(err.message)
          : t('finance.m16d.banking.errorGeneric', 'Banking the value failed.')
      );
    } finally {
      setLoading(false);
    }
  }, [currentBenefit, targetBudgetPeriod, fetcher, t]);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fn = fetcher?.status ?? postBankingStatus;
      const res = await fn(currentBenefit(), actual.trim() ? Number(actual) || 0 : undefined);
      setStatusResult(res ?? null);
    } catch (err: any) {
      setStatusResult(null);
      setError(
        err?.message
          ? String(err.message)
          : t('finance.m16d.banking.errorGeneric', 'Banking the value failed.')
      );
    } finally {
      setLoading(false);
    }
  }, [currentBenefit, actual, fetcher, t]);

  const updateRow = useCallback((id: string, patch: Partial<PortfolioRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      {
        id: nextRowId(),
        value: '100000',
        type: 'cost_out',
        isHard: true,
        isRunRate: true,
        mappedBudgetLine: 'OPEX-Other',
        actual: '',
      },
    ]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }, []);

  const runPortfolio = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items: PortfolioBenefitItem[] = rows.map((r) => ({
        benefit: {
          value: Number(r.value) || 0,
          type: r.type,
          isHard: r.isHard,
          isRunRate: r.isRunRate,
          mappedBudgetLine: r.mappedBudgetLine,
        },
        ...(r.actual.trim() ? { actual: Number(r.actual) || 0 } : {}),
      }));
      const fn = fetcher?.portfolio ?? postPortfolioBanked;
      const res = await fn(items);
      setPortfolioResult(res ?? null);
    } catch (err: any) {
      setPortfolioResult(null);
      setError(
        err?.message
          ? String(err.message)
          : t('finance.m16d.banking.errorGeneric', 'Banking the value failed.')
      );
    } finally {
      setLoading(false);
    }
  }, [rows, fetcher, t]);

  return (
    <div
      className="rounded-xl border border-c-border bg-c-surface p-4"
      data-testid="banking-value-panel"
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-c-text">
          {t('finance.m16d.banking.title', 'Banking the value — plan vs. actual')}
        </h3>
        <p className="mt-0.5 text-xs text-c-text-secondary">
          {t(
            'finance.m16d.banking.subtitle',
            'Only hard, run-rate benefits can be wired into a budget line.'
          )}
        </p>
      </div>

      {/* Single benefit form */}
      <div
        className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-c-border-subtle p-2"
        data-testid="banking-benefit-form"
      >
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">{t('finance.m16d.banking.value', 'Benefit value')}</span>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">{t('finance.m16d.banking.type', 'Type')}</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as BenefitType)}
            className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            <option value="cost_out">{t('finance.m16d.banking.typeCostOut', 'Cost out')}</option>
            <option value="revenue_up">
              {t('finance.m16d.banking.typeRevenueUp', 'Revenue up')}
            </option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-c-text-muted">
          <input type="checkbox" checked={isHard} onChange={(e) => setIsHard(e.target.checked)} />
          {t('finance.m16d.banking.isHard', 'Hard')}
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-c-text-muted">
          <input
            type="checkbox"
            checked={isRunRate}
            onChange={(e) => setIsRunRate(e.target.checked)}
          />
          {t('finance.m16d.banking.isRunRate', 'Run-rate')}
        </label>
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">{t('finance.m16d.banking.budgetLine', 'Budget line')}</span>
          <input
            type="text"
            value={mappedBudgetLine}
            onChange={(e) => setMappedBudgetLine(e.target.value)}
            className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">{t('finance.m16d.banking.period', 'Target period')}</span>
          <input
            type="text"
            value={targetBudgetPeriod}
            onChange={(e) => setTargetBudgetPeriod(e.target.value)}
            className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">{t('finance.m16d.banking.actual', 'Actual')}</span>
          <input
            type="number"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
        <button
          type="button"
          onClick={() => void bank()}
          disabled={loading}
          data-testid="banking-bank"
          className="rounded-lg border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
        >
          {t('finance.m16d.banking.bank', 'Bank benefit')}
        </button>
        <button
          type="button"
          onClick={() => void checkStatus()}
          disabled={loading}
          data-testid="banking-check-status"
          className="rounded-lg border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
        >
          {t('finance.m16d.banking.checkStatus', 'Check status')}
        </button>
      </div>

      {error && (
        <div
          className="mb-4 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-sm text-c-danger"
          data-testid="banking-error"
        >
          {error}
        </div>
      )}

      {(bankResult || statusResult) && (
        <div className="mb-4 flex flex-wrap items-center gap-4" data-testid="banking-single-result">
          {bankResult && (
            <>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {t('finance.m16d.banking.bankedAmount', 'Banked amount')}
                </p>
                <p className="text-sm font-semibold text-c-text">{fmt(bankResult.bankedAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {t('finance.m16d.banking.budgetImpact', 'Budget line delta')}
                </p>
                <p className="text-sm font-semibold text-c-text">
                  {bankResult.budgetLineImpact.lineCode}: {fmt(bankResult.budgetLineImpact.deltaValue)}
                </p>
              </div>
            </>
          )}
          {statusResult && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                {t('finance.m16d.banking.status', 'Status')}
              </p>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[statusResult.status]}`}
                data-testid="banking-status-badge"
              >
                {statusResult.status} ({fmt(statusResult.variance)})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Portfolio */}
      <div className="mt-4 border-t border-c-border-subtle pt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
            {t('finance.m16d.banking.portfolioTitle', 'Portfolio banked')}
          </h4>
          <button
            type="button"
            onClick={() => void runPortfolio()}
            disabled={loading}
            data-testid="banking-portfolio-run"
            className="shrink-0 rounded-lg border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
          >
            {t('finance.m16d.banking.portfolioRun', 'Compute portfolio')}
          </button>
        </div>

        <div className="mb-3 space-y-2" data-testid="banking-portfolio-rows">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-end gap-2 rounded-lg border border-c-border-subtle p-2"
              data-testid={`banking-portfolio-row-${row.id}`}
            >
              <input
                type="number"
                value={row.value}
                onChange={(e) => updateRow(row.id, { value: e.target.value })}
                className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
              <select
                value={row.type}
                onChange={(e) => updateRow(row.id, { type: e.target.value as BenefitType })}
                className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              >
                <option value="cost_out">
                  {t('finance.m16d.banking.typeCostOut', 'Cost out')}
                </option>
                <option value="revenue_up">
                  {t('finance.m16d.banking.typeRevenueUp', 'Revenue up')}
                </option>
              </select>
              <input
                type="text"
                value={row.mappedBudgetLine}
                onChange={(e) => updateRow(row.id, { mappedBudgetLine: e.target.value })}
                className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
              <input
                type="number"
                placeholder={String(t('finance.m16d.banking.actual', 'Actual'))}
                value={row.actual}
                onChange={(e) => updateRow(row.id, { actual: e.target.value })}
                className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="text-c-text-muted hover:text-c-danger"
                  aria-label={`Remove benefit ${row.id}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="rounded border border-dashed border-c-border px-2 py-1 text-xs text-c-text-secondary hover:border-c-focus hover:text-c-text"
          >
            {t('finance.m16d.banking.addBenefit', '+ benefit')}
          </button>
        </div>

        {portfolioResult && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="banking-portfolio-stats">
            <div className="rounded-lg border border-c-success/30 bg-c-success/10 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-c-success">
                {t('finance.m16d.banking.totalBanked', 'Banked')}
              </p>
              <p className="text-sm font-semibold text-c-text">{fmt(portfolioResult.totalBanked)}</p>
            </div>
            <div className="rounded-lg border border-c-warning/30 bg-c-warning/10 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-c-warning">
                {t('finance.m16d.banking.totalPending', 'Pending')}
              </p>
              <p className="text-sm font-semibold text-c-text">
                {fmt(portfolioResult.totalPending)}
              </p>
            </div>
            <div className="rounded-lg border border-c-danger/30 bg-c-danger/10 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-c-danger">
                {t('finance.m16d.banking.totalLeaked', 'Leaked')}
              </p>
              <p className="text-sm font-semibold text-c-text">
                {fmt(portfolioResult.totalLeaked)}
              </p>
            </div>
            <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                {t('finance.m16d.banking.bankedPct', 'Banked %')}
              </p>
              <p className="text-sm font-semibold text-c-text">{fmtPct(portfolioResult.bankedPct)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankingValuePanel;
