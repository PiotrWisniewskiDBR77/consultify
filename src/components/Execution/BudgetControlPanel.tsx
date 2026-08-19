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
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  shouldFallbackToLegacyExecutionControl,
  V8ExecutionControlApi,
} from '@/services/api/v8/execution-control';

import { trackFunnelEvent } from '../../services/funnelAnalytics';
import { isBetaClosed } from '../../utils/betaAccess';

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
  overspendSignals?: OverspendSignal[];
  loading?: boolean;
  onSaved?: () => void;
}

interface BudgetEntry {
  id: string;
  entryType: 'ACTUAL' | 'FORECAST' | 'ADJUSTMENT';
  costType: 'CAPEX' | 'OPEX';
  category: string;
  amount: number;
  currency: string;
  description: string | null;
  periodMonth: number | null;
  periodYear: number | null;
  version: number;
}

// ── Config ─────────────────────────────────────────────────────

const STATUS_STYLES = {
  GREEN: { bg: 'bg-green-500/15', text: 'text-green-400', label: 'On Track' },
  AMBER: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Warning' },
  RED: { bg: 'bg-danger-500/15', text: 'text-danger-400', label: 'Over Budget' },
};

// ── Component ──────────────────────────────────────────────────

export const BudgetControlPanel: React.FC<BudgetControlPanelProps> = ({
  projectId,
  initiativeId,
  onInitiativeClick,
  overspendSignals: controlledOverspendSignals,
  loading: controlledLoading,
  onSaved,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<PortfolioBudgetSummary | null>(null);
  const [initSummary, setInitSummary] = useState<InitiativeBudgetSummary | null>(null);
  const [overspendSignals, setOverspendSignals] = useState<OverspendSignal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [budgetEntries, setBudgetEntries] = useState<BudgetEntry[]>([]);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const deleteRequestIdsRef = useRef<Map<string, string>>(new Map());
  const [expandedInit, setExpandedInit] = useState<string | null>(null);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryForm, setEntryForm] = useState({
    costType: 'CAPEX' as 'CAPEX' | 'OPEX',
    amount: '',
    category: '',
    description: '',
  });
  // M14 → M15 feed-forward: record a human-entered realized benefit value that
  // Results (M15) reads back via its ROI portfolio rollup.
  const [showRealization, setShowRealization] = useState(false);
  const [isSavingRealization, setIsSavingRealization] = useState(false);
  const [realizationForm, setRealizationForm] = useState({
    valueType: 'SAVINGS' as 'SAVINGS' | 'REVENUE' | 'COST',
    amount: '',
    period: new Date().toISOString().slice(0, 7), // YYYY-MM
    notes: '',
  });
  const effectiveOverspendSignals = controlledOverspendSignals ?? overspendSignals;
  const effectiveLoading = controlledLoading ?? isLoading;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (initiativeId) {
        const token = localStorage.getItem('token');
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };
        try {
          const data = await V8ExecutionControlApi.getBudgetInitiativeSummary(initiativeId).catch(
            async (error) => {
              if (!shouldFallbackToLegacyExecutionControl(error)) {
                throw error;
              }
              const res = await fetch(`/api/execution-control/budget/initiative/${initiativeId}`, {
                headers,
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(
                  (err as any)?.error ||
                    (err as any)?.message ||
                    t('execution.toast.budgetLoadFailed', 'Failed to load budget')
                );
              }
              const summary = await res.json();
              return { summary };
            }
          );
          setInitSummary(data.summary);
          const entriesRes = await fetch(
            `/api/execution-control/budget/entries/${encodeURIComponent(initiativeId)}`,
            { headers }
          );
          if (!entriesRes.ok) {
            const failure = await entriesRes.json().catch(() => ({}));
            throw new Error(
              (failure as any)?.error ||
                (failure as any)?.message ||
                'Failed to load budget entries'
            );
          }
          const entriesBody = await entriesRes.json();
          setBudgetEntries(Array.isArray(entriesBody?.entries) ? entriesBody.entries : []);
        } catch (error: any) {
          toast.error(
            error?.message || t('execution.toast.budgetLoadFailed', 'Failed to load budget')
          );
        }
      } else {
        const [portfolioData, signalsData] = await Promise.all([
          V8ExecutionControlApi.getBudgetPortfolio(projectId),
          V8ExecutionControlApi.getOverspendSignals(projectId),
        ]);
        setPortfolio(portfolioData.summary);
        setOverspendSignals(signalsData.signals || []);
      }
    } catch {
      // non-blocking
    } finally {
      setIsLoading(false);
    }
  }, [projectId, initiativeId]);

  const handleDeleteEntry = useCallback(
    async (entry: BudgetEntry) => {
      if (!initiativeId || deletingEntryId) return;
      if (
        !window.confirm(
          t('execution.budget.deleteConfirm', 'Delete this budget entry? This cannot be undone.')
        )
      )
        return;
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error(t('execution.toast.notAuthenticated', 'Not authenticated'));
        return;
      }
      setDeletingEntryId(entry.id);
      try {
        const storageKey = `consultify.execution.budget.delete.${initiativeId}.${entry.id}`;
        const requestId =
          deleteRequestIdsRef.current.get(entry.id) ||
          sessionStorage.getItem(storageKey) ||
          crypto.randomUUID();
        deleteRequestIdsRef.current.set(entry.id, requestId);
        sessionStorage.setItem(storageKey, requestId);
        const response = await fetch(
          `/api/execution-control/budget/entries/${encodeURIComponent(entry.id)}?initiativeId=${encodeURIComponent(initiativeId)}&expectedVersion=${entry.version}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}`, 'X-Idempotency-Key': requestId },
          }
        );
        if (!response.ok) {
          const failure = await response.json().catch(() => ({}));
          throw new Error(
            (failure as any)?.error ||
              (failure as any)?.message ||
              `Delete failed (${response.status})`
          );
        }
        const receiptReadback = await fetch(
          `/api/execution-control/budget/entries/${encodeURIComponent(entry.id)}/delete-receipts/${encodeURIComponent(requestId)}?initiativeId=${encodeURIComponent(initiativeId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!receiptReadback.ok) {
          throw new Error(
            'Delete was accepted, but its command receipt is not readable. Refresh and verify.'
          );
        }
        const receiptBody = await receiptReadback.json();
        if (
          receiptBody?.receipt?.outcome !== 'SUCCEEDED' ||
          receiptBody?.receipt?.entryId !== entry.id ||
          receiptBody?.receipt?.expectedVersion !== entry.version
        ) {
          throw new Error('Delete receipt does not match this command. Refresh and verify.');
        }
        const readback = await fetch(
          `/api/execution-control/budget/entries/${encodeURIComponent(initiativeId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!readback.ok)
          throw new Error(
            'Delete was accepted, but canonical readback failed. Refresh and verify.'
          );
        const body = await readback.json();
        const nextEntries: BudgetEntry[] = Array.isArray(body?.entries) ? body.entries : [];
        if (nextEntries.some((candidate) => candidate.id === entry.id)) {
          throw new Error('Delete was not confirmed by canonical readback. Refresh and retry.');
        }
        setBudgetEntries(nextEntries);
        deleteRequestIdsRef.current.delete(entry.id);
        sessionStorage.removeItem(storageKey);
        await loadData();
        onSaved?.();
        toast.success(t('execution.budget.entryDeleted', 'Budget entry deleted'));
      } catch (error: any) {
        toast.error(
          error?.message || t('execution.budget.deleteFailed', 'Failed to delete budget entry')
        );
      } finally {
        setDeletingEntryId(null);
      }
    },
    [initiativeId, deletingEntryId, loadData, onSaved, t]
  );

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
      const payload = {
        initiativeId,
        entryType: 'ACTUAL' as const,
        costType: entryForm.costType,
        amount: parseFloat(entryForm.amount),
        category: entryForm.category || 'General',
        description: entryForm.description || undefined,
        periodMonth: new Date().getMonth() + 1,
        periodYear: new Date().getFullYear(),
      };
      const res = await V8ExecutionControlApi.createBudgetEntry(payload)
        .then(() => ({ ok: true, json: async () => ({}) }))
        .catch((error) => {
          if (!shouldFallbackToLegacyExecutionControl(error)) {
            throw error;
          }
          return fetch('/api/execution-control/budget/entries', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        });
      if (res.ok) {
        setShowAddEntry(false);
        setEntryForm({ costType: 'CAPEX', amount: '', category: '', description: '' });
        loadData();
        onSaved?.();
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
  }, [initiativeId, entryForm, loadData, onSaved]);

  const handleRecordRealization = useCallback(async () => {
    if (!initiativeId || !realizationForm.amount) return;
    const parsedAmount = parseFloat(realizationForm.amount);
    if (!Number.isFinite(parsedAmount)) {
      toast.error(t('execution.realization.invalidAmount', 'Enter a valid amount'));
      return;
    }
    setIsSavingRealization(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error(t('execution.toast.notAuthenticated', 'Not authenticated'));
        return;
      }
      // period is an input[type=month] (YYYY-MM); roi_realized_values.period_month
      // is a DATE → normalize to the first day of the month.
      const periodMonth = `${realizationForm.period}-01`;
      const payload = {
        initiativeId,
        periodMonth,
        realizedRevenueDelta: realizationForm.valueType === 'REVENUE' ? parsedAmount : null,
        realizedCostDelta: realizationForm.valueType === 'COST' ? parsedAmount : null,
        realizedSavings: realizationForm.valueType === 'SAVINGS' ? parsedAmount : null,
        varianceNotes: realizationForm.notes || undefined,
      };
      const res = await V8ExecutionControlApi.recordRealization(payload)
        .then(() => ({ ok: true, json: async () => ({}) }))
        .catch((error) => {
          if (!shouldFallbackToLegacyExecutionControl(error)) {
            throw error;
          }
          return fetch('/api/execution-control/realizations', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        });
      if (res.ok) {
        setShowRealization(false);
        setRealizationForm({
          valueType: 'SAVINGS',
          amount: '',
          period: new Date().toISOString().slice(0, 7),
          notes: '',
        });
        loadData();
        onSaved?.();
        trackFunnelEvent('roi_realized_value_updated', { initiativeId, source: 'execution' });
        toast.success(t('execution.realization.recorded', 'Realization recorded'));
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(
          (err as any)?.error ||
            (err as any)?.message ||
            t('execution.realization.recordFailed', 'Failed to record realization')
        );
      }
    } catch (error: any) {
      toast.error(
        error?.message || t('execution.realization.recordFailed', 'Failed to record realization')
      );
    } finally {
      setIsSavingRealization(false);
    }
  }, [initiativeId, realizationForm, loadData, onSaved, t]);

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
          <div className="flex items-center gap-2">
            {!isBetaClosed('MODULE_BENEFITS') && (
              <button
                type="button"
                onClick={() =>
                  navigate(`/benefits?initiativeId=${encodeURIComponent(initiativeId)}`)
                }
                className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors"
                title={t('execution.budget.viewInResults', 'View in Results')}
              >
                {t('execution.budget.viewInResults', 'View in Results')}
                <ArrowUpRight size={12} />
              </button>
            )}
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${style.bg} ${style.text}`}
            >
              {t(`execution.budget.status.${initSummary.status.toLowerCase()}`)}
            </span>
          </div>
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
            <div className="flex gap-3 mt-1 text-xs text-slate-600">
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
            <div className="flex gap-3 mt-1 text-xs text-slate-600">
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
                  ? 'bg-danger-500'
                  : initSummary.burnRate >= 80
                    ? 'bg-amber-500'
                    : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(initSummary.burnRate, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-slate-600">
            <span>0%</span>
            <span className="text-amber-400">80%</span>
            <span className="text-danger-400">100%</span>
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

        {budgetEntries.length > 0 && (
          <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 divide-y divide-slate-200 dark:divide-navy-700">
            <div className="px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white">
              {t('execution.budget.entries', 'Budget entries')}
            </div>
            {budgetEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                    {entry.category || entry.entryType} · {entry.costType}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {formatCurrency(entry.amount, entry.currency)}
                    {entry.periodMonth && entry.periodYear
                      ? ` · ${entry.periodMonth}/${entry.periodYear}`
                      : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteEntry(entry)}
                  disabled={deletingEntryId !== null}
                  aria-label={t('execution.budget.deleteEntry', 'Delete budget entry')}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-danger-500 hover:bg-danger-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={13} aria-hidden="true" />
                  {deletingEntryId === entry.id
                    ? t('common.deleting', 'Deleting…')
                    : t('common.delete', 'Delete')}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Entry */}
        {!showAddEntry ? (
          <button
            type="button"
            onClick={() => setShowAddEntry(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-400 border border-dashed border-blue-500/30 rounded-lg hover:bg-blue-500/10 transition-colors"
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
                className="text-slate-600 hover:text-slate-300"
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
              className="w-full py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t('execution.budget.save')}
            </button>
          </div>
        )}

        {/* Record Realization (M14 → M15 feed-forward) */}
        <div className="pt-2 border-t border-slate-200 dark:border-navy-700/50">
          {!showRealization ? (
            <button
              type="button"
              onClick={() => setShowRealization(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-green-500 border border-dashed border-green-500/30 rounded-lg hover:bg-green-500/10 transition-colors"
            >
              <TrendingUp size={14} />
              {t('execution.realization.record', 'Record realization')}
            </button>
          ) : (
            <div className="rounded-lg border border-slate-200 dark:border-navy-700 p-3 bg-white dark:bg-navy-900 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  {t('execution.realization.title', 'Record realized value')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowRealization(false)}
                  className="text-slate-600 hover:text-slate-300"
                  aria-label={t('common.close', 'Close')}
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                {t(
                  'execution.realization.helper',
                  'Manually recorded value flows into Results (ROI). Never derived from task %.'
                )}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={realizationForm.valueType}
                  onChange={(e) =>
                    setRealizationForm((p) => ({
                      ...p,
                      valueType: e.target.value as 'SAVINGS' | 'REVENUE' | 'COST',
                    }))
                  }
                  className="text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded px-2 py-1.5 text-slate-700 dark:text-slate-300"
                  aria-label={t('execution.realization.valueType', 'Value type')}
                >
                  <option value="SAVINGS">{t('execution.realization.savings', 'Savings')}</option>
                  <option value="REVENUE">
                    {t('execution.realization.revenueDelta', 'Revenue Δ')}
                  </option>
                  <option value="COST">{t('execution.realization.costDelta', 'Cost Δ')}</option>
                </select>
                <input
                  type="number"
                  value={realizationForm.amount}
                  onChange={(e) => setRealizationForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder={t('execution.realization.amountPlaceholder', 'Realized value')}
                  className="text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded px-2 py-1.5 text-slate-700 dark:text-slate-300"
                  aria-label={t('execution.realization.amount', 'Realized value')}
                />
              </div>
              <input
                type="month"
                value={realizationForm.period}
                onChange={(e) => setRealizationForm((p) => ({ ...p, period: e.target.value }))}
                className="w-full text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded px-2 py-1.5 text-slate-700 dark:text-slate-300"
                aria-label={t('execution.realization.period', 'Period')}
              />
              <input
                type="text"
                value={realizationForm.notes}
                onChange={(e) => setRealizationForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder={t('execution.realization.notesPlaceholder', 'Note (optional)')}
                className="w-full text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded px-2 py-1.5 text-slate-700 dark:text-slate-300"
                aria-label={t('execution.realization.notes', 'Note')}
              />
              <button
                type="button"
                onClick={handleRecordRealization}
                disabled={!realizationForm.amount || !realizationForm.period || isSavingRealization}
                className="w-full py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isSavingRealization
                  ? t('execution.realization.saving', 'Saving…')
                  : t('execution.realization.save', 'Record')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Portfolio-Level View ──

  if (effectiveLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
        {t('execution.budget.loading')}
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-600">
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
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-danger-500/20 text-danger-400">
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
            className={`text-base font-bold ${portfolio.variancePercent >= 90 ? 'text-danger-400' : portfolio.variancePercent >= 80 ? 'text-amber-400' : 'text-green-400'}`}
          >
            {formatCurrency(portfolio.totalActual, portfolio.currency)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-navy-700 p-3 bg-white dark:bg-navy-900">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            {t('execution.budget.variance')}
          </div>
          <div
            className={`text-base font-bold flex items-center gap-1 ${portfolio.totalVariance > 0 ? 'text-danger-400' : 'text-green-400'}`}
          >
            {portfolio.totalVariance > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {formatCurrency(Math.abs(portfolio.totalVariance), portfolio.currency)}
          </div>
        </div>
      </div>

      {/* Overspend Signals */}
      {effectiveOverspendSignals.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t('execution.budget.overspendSignals')}
          </span>
          {effectiveOverspendSignals.slice(0, 5).map((sig) => (
            <div
              key={sig.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                sig.severity === 'CRITICAL'
                  ? 'bg-danger-500/10 border-danger-500/30'
                  : sig.severity === 'HIGH'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              <AlertTriangle
                size={14}
                className={
                  sig.severity === 'CRITICAL'
                    ? 'text-danger-400'
                    : sig.severity === 'HIGH'
                      ? 'text-amber-400'
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
                  className="text-blue-400 hover:text-blue-300 shrink-0"
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
                          ? 'bg-danger-500'
                          : summary.burnRate >= 80
                            ? 'bg-amber-500'
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(summary.burnRate, 100)}%` }}
                    />
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={12} className="text-slate-600" />
                  ) : (
                    <ChevronDown size={12} className="text-slate-600" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-slate-200 dark:border-navy-700/50 pt-2 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
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
                        className="col-span-2 inline-flex items-center justify-center gap-1 text-xs text-blue-400 hover:text-blue-300 pt-1"
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
