/**
 * BudgetControlPanel (T042)
 *
 * Plan vs actual budget dashboard with variance bars, burn rate,
 * overspend signals, and manual entry creation.
 */
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Plus,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '../../services/funnelAnalytics';

// ── Types ──────────────────────────────────────────────────────

interface InitiativeBudgetSummary {
  initiativeId: string;
  initiativeName: string;
  currency: string;
  planned: { total: number; capex: number; opex: number };
  actual: { total: number; capex: number; opex: number };
  variance: { total: number; percent: number };
  burnRate: number;
  forecast: { total: number; isOverBudget: boolean };
  status: 'GREEN' | 'AMBER' | 'RED';
}

interface PortfolioBudgetSummary {
  totalPlanned: number;
  totalActual: number;
  totalVariance: number;
  variancePercent: number;
  currency: string;
  initiativeSummaries: InitiativeBudgetSummary[];
  overspendCount: number;
  topOverspenders: { initiativeId: string; name: string; variancePercent: number }[];
}

interface OverspendSignal {
  id: string;
  initiativeId: string | null;
  initiativeName: string;
  signalType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  plannedAmount: number;
  actualAmount: number;
  variancePercent: number;
  message: string;
}

interface BudgetControlPanelProps {
  projectId?: string;
  initiativeId?: string;
  onInitiativeClick?: (initiativeId: string) => void;
}

// ── Config ─────────────────────────────────────────────────────

const STATUS_STYLES = {
  GREEN: { bg: 'bg-green-500/15', text: 'text-green-400', label: 'On Track' },
  AMBER: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Warning' },
  RED: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Over Budget' },
};

// ── Component ──────────────────────────────────────────────────

export const BudgetControlPanel: React.FC<BudgetControlPanelProps> = ({
  projectId,
  initiativeId,
  onInitiativeClick,
}) => {
  const { t } = useTranslation();
  const [portfolio, setPortfolio] = useState<PortfolioBudgetSummary | null>(null);
  const [initSummary, setInitSummary] = useState<InitiativeBudgetSummary | null>(null);
  const [overspendSignals, setOverspendSignals] = useState<OverspendSignal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedInit, setExpandedInit] = useState<string | null>(null);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryForm, setEntryForm] = useState({
    costType: 'CAPEX' as 'CAPEX' | 'OPEX',
    amount: '',
    category: '',
    description: '',
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };

      if (initiativeId) {
        const res = await fetch(`/api/execution-control/budget/initiative/${initiativeId}`, {
          headers,
        });
        if (res.ok) {
          setInitSummary(await res.json());
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(
            (err as any)?.error ||
              (err as any)?.message ||
              t('execution.toast.budgetLoadFailed', 'Failed to load budget')
          );
        }
      } else {
        const params = new URLSearchParams();
        if (projectId) params.set('projectId', projectId);
        const [portfolioRes, signalsRes] = await Promise.all([
          fetch(`/api/execution-control/budget/portfolio?${params}`, { headers }),
          fetch(`/api/execution-control/budget/overspend-signals?${params}`, { headers }),
        ]);
        if (portfolioRes.ok) setPortfolio(await portfolioRes.json());
        if (signalsRes.ok) {
          const data = await signalsRes.json();
          setOverspendSignals(data.signals || []);
        }
      }
    } catch {
      // non-blocking
    } finally {
      setIsLoading(false);
    }
  }, [projectId, initiativeId]);

  useEffect(() => {
    loadData();
    trackFunnelEvent('budget_dashboard_viewed', { projectId, initiativeId });
  }, [loadData, projectId, initiativeId]);

  const handleAddEntry = useCallback(async () => {
    if (!initiativeId || !entryForm.amount) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error(t('execution.toast.notAuthenticated', 'Not authenticated'));
        return;
      }
      const res = await fetch('/api/execution-control/budget/entries', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initiativeId,
          entryType: 'ACTUAL',
          costType: entryForm.costType,
          amount: parseFloat(entryForm.amount),
          category: entryForm.category || 'General',
          description: entryForm.description || undefined,
          periodMonth: new Date().getMonth() + 1,
          periodYear: new Date().getFullYear(),
        }),
      });
      if (res.ok) {
        setShowAddEntry(false);
        setEntryForm({ costType: 'CAPEX', amount: '', category: '', description: '' });
        loadData();
        trackFunnelEvent('budget_actual_updated', { initiativeId });
        toast.success(t('execution.toast.budgetEntryAdded', 'Budget entry added'));
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(
          (err as any)?.error ||
            (err as any)?.message ||
            t('execution.toast.budgetEntryAddFailed', 'Failed to add budget entry')
        );
      }
    } catch {
      toast.error(t('execution.toast.budgetEntryAddFailed', 'Failed to add budget entry'));
    }
  }, [initiativeId, entryForm, loadData]);

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // ── Initiative-Level View ──

  if (initiativeId && initSummary) {
    const style = STATUS_STYLES[initSummary.status];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t('execution.budget.title')}
          </h3>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full ${style.bg} ${style.text}`}
          >
            {t(`execution.budget.status.${initSummary.status.toLowerCase()}`)}
          </span>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 dark:border-navy-700 p-3 bg-white dark:bg-navy-900">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              {t('execution.budget.planned')}
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {formatCurrency(initSummary.planned.total, initSummary.currency)}
            </div>
            <div className="flex gap-3 mt-1 text-xs text-slate-400">
              <span>CAPEX: {formatCurrency(initSummary.planned.capex, initSummary.currency)}</span>
              <span>OPEX: {formatCurrency(initSummary.planned.opex, initSummary.currency)}</span>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-navy-700 p-3 bg-white dark:bg-navy-900">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              {t('execution.budget.actual')}
            </div>
            <div className={`text-lg font-bold ${style.text}`}>
              {formatCurrency(initSummary.actual.total, initSummary.currency)}
            </div>
            <div className="flex gap-3 mt-1 text-xs text-slate-400">
              <span>CAPEX: {formatCurrency(initSummary.actual.capex, initSummary.currency)}</span>
              <span>OPEX: {formatCurrency(initSummary.actual.opex, initSummary.currency)}</span>
            </div>
          </div>
        </div>

        {/* Burn Rate Bar */}
        <div className="rounded-lg border border-slate-200 dark:border-navy-700 p-3 bg-white dark:bg-navy-900">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('execution.budget.burnRate')}
            </span>
            <span className={`text-sm font-bold ${style.text}`}>{initSummary.burnRate}%</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                initSummary.burnRate >= 100
                  ? 'bg-red-500'
                  : initSummary.burnRate >= 80
                    ? 'bg-amber-500'
                    : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(initSummary.burnRate, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-slate-400">
            <span>0%</span>
            <span className="text-amber-400">80%</span>
            <span className="text-red-400">100%</span>
          </div>
        </div>

        {/* Forecast */}
        {initSummary.forecast.isOverBudget && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <TrendingUp size={14} className="text-amber-400 shrink-0" />
            <span className="text-xs text-amber-400">
              {t('execution.budget.forecastOverspend', {
                amount: formatCurrency(initSummary.forecast.total, initSummary.currency),
              })}
            </span>
          </div>
        )}

        {/* Add Entry */}
        {!showAddEntry ? (
          <button
            type="button"
            onClick={() => setShowAddEntry(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-cyan-400 border border-dashed border-cyan-500/30 rounded-lg hover:bg-cyan-500/10 transition-colors"
          >
            <Plus size={14} />
            {t('execution.budget.addEntry')}
          </button>
        ) : (
          <div className="rounded-lg border border-slate-200 dark:border-navy-700 p-3 bg-white dark:bg-navy-900 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                {t('execution.budget.newEntry')}
              </span>
              <button
                type="button"
                onClick={() => setShowAddEntry(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={entryForm.costType}
                onChange={(e) =>
                  setEntryForm((p) => ({ ...p, costType: e.target.value as 'CAPEX' | 'OPEX' }))
                }
                className="text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded px-2 py-1.5 text-slate-700 dark:text-slate-300"
              >
                <option value="CAPEX">CAPEX</option>
                <option value="OPEX">OPEX</option>
              </select>
              <input
                type="number"
                value={entryForm.amount}
                onChange={(e) => setEntryForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder={t('execution.budget.amountPlaceholder')}
                className="text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded px-2 py-1.5 text-slate-700 dark:text-slate-300"
              />
            </div>
            <input
              type="text"
              value={entryForm.category}
              onChange={(e) => setEntryForm((p) => ({ ...p, category: e.target.value }))}
              placeholder={t('execution.budget.categoryPlaceholder')}
              className="w-full text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded px-2 py-1.5 text-slate-700 dark:text-slate-300"
            />
            <input
              type="text"
              value={entryForm.description}
              onChange={(e) => setEntryForm((p) => ({ ...p, description: e.target.value }))}
              placeholder={t('execution.budget.descriptionPlaceholder')}
              className="w-full text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded px-2 py-1.5 text-slate-700 dark:text-slate-300"
            />
            <button
              type="button"
              onClick={handleAddEntry}
              disabled={!entryForm.amount}
              className="w-full py-1.5 text-xs font-medium bg-cyan-600 text-white rounded hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t('execution.budget.save')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Portfolio-Level View ──

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
        {t('execution.budget.loading')}
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400">
        <div className="text-center">
          <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('execution.budget.noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {t('execution.budget.portfolioTitle')}
        </h3>
        {portfolio.overspendCount > 0 && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-500/20 text-red-400">
            {portfolio.overspendCount} {t('execution.budget.overspendRisks')}
          </span>
        )}
      </div>

      {/* Portfolio Totals */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 dark:border-navy-700 p-3 bg-white dark:bg-navy-900">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            {t('execution.budget.planned')}
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white">
            {formatCurrency(portfolio.totalPlanned, portfolio.currency)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-navy-700 p-3 bg-white dark:bg-navy-900">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            {t('execution.budget.actual')}
          </div>
          <div
            className={`text-base font-bold ${portfolio.variancePercent >= 90 ? 'text-red-400' : portfolio.variancePercent >= 80 ? 'text-amber-400' : 'text-green-400'}`}
          >
            {formatCurrency(portfolio.totalActual, portfolio.currency)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-navy-700 p-3 bg-white dark:bg-navy-900">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            {t('execution.budget.variance')}
          </div>
          <div
            className={`text-base font-bold flex items-center gap-1 ${portfolio.totalVariance > 0 ? 'text-red-400' : 'text-green-400'}`}
          >
            {portfolio.totalVariance > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {formatCurrency(Math.abs(portfolio.totalVariance), portfolio.currency)}
          </div>
        </div>
      </div>

      {/* Overspend Signals */}
      {overspendSignals.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t('execution.budget.overspendSignals')}
          </span>
          {overspendSignals.slice(0, 5).map((sig) => (
            <div
              key={sig.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                sig.severity === 'CRITICAL'
                  ? 'bg-red-500/10 border-red-500/30'
                  : sig.severity === 'HIGH'
                    ? 'bg-orange-500/10 border-orange-500/30'
                    : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              <AlertTriangle
                size={14}
                className={
                  sig.severity === 'CRITICAL'
                    ? 'text-red-400'
                    : sig.severity === 'HIGH'
                      ? 'text-orange-400'
                      : 'text-amber-400'
                }
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                  {sig.initiativeName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {sig.message}
                </p>
              </div>
              {onInitiativeClick && sig.initiativeId && (
                <button
                  type="button"
                  onClick={() => onInitiativeClick(sig.initiativeId!)}
                  className="text-cyan-400 hover:text-cyan-300 shrink-0"
                >
                  <ArrowUpRight size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Initiative Breakdown */}
      <div className="space-y-1">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {t('execution.budget.initiativeBreakdown')}
        </span>
        {portfolio.initiativeSummaries
          .filter((s) => s.planned.total > 0 || s.actual.total > 0)
          .sort((a, b) => b.variance.percent - a.variance.percent)
          .map((summary) => {
            const style = STATUS_STYLES[summary.status];
            const isExpanded = expandedInit === summary.initiativeId;

            return (
              <div
                key={summary.initiativeId}
                className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900"
              >
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2 text-left"
                  onClick={() => setExpandedInit(isExpanded ? null : summary.initiativeId)}
                >
                  <div className={`w-2 h-2 rounded-full ${style.bg.replace('/15', '')}`} />
                  <span className="text-sm font-medium text-slate-900 dark:text-white flex-1 truncate">
                    {summary.initiativeName}
                  </span>
                  <span className={`text-xs font-bold tabular-nums ${style.text}`}>
                    {summary.burnRate}%
                  </span>
                  <div className="w-16 h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        summary.burnRate >= 100
                          ? 'bg-red-500'
                          : summary.burnRate >= 80
                            ? 'bg-amber-500'
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(summary.burnRate, 100)}%` }}
                    />
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={12} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={12} className="text-slate-400" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-slate-100 dark:border-navy-700/50 pt-2 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div>
                      <span className="block text-[10px] uppercase opacity-70">
                        {t('execution.budget.planned')}
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {formatCurrency(summary.planned.total, summary.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase opacity-70">
                        {t('execution.budget.actual')}
                      </span>
                      <span className={`font-medium ${style.text}`}>
                        {formatCurrency(summary.actual.total, summary.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase opacity-70">CAPEX</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {formatCurrency(summary.planned.capex, summary.currency)} /{' '}
                        {formatCurrency(summary.actual.capex, summary.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase opacity-70">OPEX</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {formatCurrency(summary.planned.opex, summary.currency)} /{' '}
                        {formatCurrency(summary.actual.opex, summary.currency)}
                      </span>
                    </div>
                    {onInitiativeClick && (
                      <button
                        type="button"
                        onClick={() => onInitiativeClick(summary.initiativeId)}
                        className="col-span-2 inline-flex items-center justify-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 pt-1"
                      >
                        <ArrowUpRight size={12} />
                        {t('execution.budget.viewDetails')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default BudgetControlPanel;
