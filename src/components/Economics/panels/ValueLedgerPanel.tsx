/**
 * M16 value suite (wire-d) — Value Ledger panel.
 *
 * Consumes POST /api/v8/finance/value-tracking/ledger/{baselines,entries} and
 * GET /api/v8/finance/value-tracking/ledger/current-value (server:
 * valueLedgerService — see finance-value.routes.ts §1).
 *
 * A KPI's tracked value is split into a frozen baseline (the "starting
 * point") plus an append-only, auditable correction ledger on top of it:
 * current = baseline.frozen_value + Σ ledger.value_delta. The user freezes a
 * baseline, appends correction entries, and sees the full audit trail —
 * every step with its running total, so nothing about "what changed the
 * number" is opaque.
 *
 * Fail-soft: a request error degrades to a quiet inline notice, never throws.
 * Behind flag `m16ValueSuite` (default OFF) — see financeFeatureFlags.ts.
 */
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type CurrentValueResult,
  getCurrentValue,
  postFreezeBaseline,
  postLedgerEntry,
} from '@/services/api/v8/financeValue';

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
};

const fmtDate = (v: string | null | undefined): string => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString();
};

export interface ValueLedgerPanelProps {
  fetcher?: {
    freezeBaseline?: typeof postFreezeBaseline;
    appendEntry?: typeof postLedgerEntry;
    currentValue?: typeof getCurrentValue;
  };
}

export const ValueLedgerPanel: React.FC<ValueLedgerPanelProps> = ({ fetcher }) => {
  const { t } = useTranslation();

  const [initiativeId, setInitiativeId] = useState('init-001');
  const [kpiId, setKpiId] = useState('kpi-margin');
  const [freezeValue, setFreezeValue] = useState('1000000');
  const [entryType, setEntryType] = useState('correction');
  const [valueDelta, setValueDelta] = useState('0');
  const [reason, setReason] = useState('');

  const [result, setResult] = useState<CurrentValueResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!initiativeId.trim() || !kpiId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const fn = fetcher?.currentValue ?? getCurrentValue;
      const res = await fn(initiativeId.trim(), kpiId.trim());
      setResult(res ?? null);
      if (!res) {
        setError(t('finance.m16d.ledger.errorGeneric', 'Value ledger is unavailable right now.'));
      }
    } catch (err: any) {
      setResult(null);
      setError(
        err?.message
          ? String(err.message)
          : t('finance.m16d.ledger.errorGeneric', 'Value ledger is unavailable right now.')
      );
    } finally {
      setLoading(false);
    }
  }, [initiativeId, kpiId, fetcher, t]);

  const freeze = useCallback(async () => {
    if (!initiativeId.trim() || !kpiId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const fn = fetcher?.freezeBaseline ?? postFreezeBaseline;
      await fn({
        initiativeId: initiativeId.trim(),
        kpiId: kpiId.trim(),
        value: Number(freezeValue) || 0,
      });
      await refresh();
    } catch (err: any) {
      setError(
        err?.message
          ? String(err.message)
          : t('finance.m16d.ledger.errorGeneric', 'Value ledger is unavailable right now.')
      );
      setLoading(false);
    }
  }, [initiativeId, kpiId, freezeValue, fetcher, refresh, t]);

  const appendEntry = useCallback(async () => {
    if (!initiativeId.trim() || !entryType.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const fn = fetcher?.appendEntry ?? postLedgerEntry;
      await fn({
        initiativeId: initiativeId.trim(),
        entryType: entryType.trim(),
        valueDelta: Number(valueDelta) || 0,
        reason: reason.trim() || null,
      });
      setValueDelta('0');
      setReason('');
      await refresh();
    } catch (err: any) {
      setError(
        err?.message
          ? String(err.message)
          : t('finance.m16d.ledger.errorGeneric', 'Value ledger is unavailable right now.')
      );
      setLoading(false);
    }
  }, [initiativeId, entryType, valueDelta, reason, fetcher, refresh, t]);

  return (
    <div
      className="rounded-xl border border-c-border bg-c-surface p-4"
      data-testid="value-ledger-panel"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t('finance.m16d.ledger.title', 'Value ledger — frozen baseline + audit trail')}
          </h3>
          <p className="mt-0.5 text-xs text-c-text-secondary">
            {t(
              'finance.m16d.ledger.subtitle',
              'Current value = frozen baseline + every auditable correction, in order.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          data-testid="ledger-refresh"
          className="shrink-0 rounded-xl border border-c-border bg-c-surface-raised px-3.5 py-2 text-sm font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
        >
          {loading
            ? t('finance.m16d.ledger.loading', 'Loading…')
            : t('finance.m16d.ledger.load', 'Load current value')}
        </button>
      </div>

      {/* Identity */}
      <div className="mb-3 flex flex-wrap items-end gap-3" data-testid="ledger-identity">
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">{t('finance.m16d.ledger.initiativeId', 'Initiative')}</span>
          <input
            type="text"
            value={initiativeId}
            onChange={(e) => setInitiativeId(e.target.value)}
            className="w-32 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">{t('finance.m16d.ledger.kpiId', 'KPI')}</span>
          <input
            type="text"
            value={kpiId}
            onChange={(e) => setKpiId(e.target.value)}
            className="w-32 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
      </div>

      {/* Freeze baseline */}
      <div
        className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-c-border-subtle p-2"
        data-testid="ledger-freeze-form"
      >
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">{t('finance.m16d.ledger.freezeValue', 'Baseline value')}</span>
          <input
            type="number"
            value={freezeValue}
            onChange={(e) => setFreezeValue(e.target.value)}
            className="w-32 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
        <button
          type="button"
          onClick={() => void freeze()}
          disabled={loading}
          data-testid="ledger-freeze"
          className="rounded-lg border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
        >
          {t('finance.m16d.ledger.freeze', 'Freeze baseline')}
        </button>
      </div>

      {/* Append correction entry */}
      <div
        className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-c-border-subtle p-2"
        data-testid="ledger-entry-form"
      >
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">{t('finance.m16d.ledger.entryType', 'Entry type')}</span>
          <input
            type="text"
            value={entryType}
            onChange={(e) => setEntryType(e.target.value)}
            className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">{t('finance.m16d.ledger.valueDelta', 'Delta')}</span>
          <input
            type="number"
            value={valueDelta}
            onChange={(e) => setValueDelta(e.target.value)}
            className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">{t('finance.m16d.ledger.reason', 'Reason')}</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-40 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
        <button
          type="button"
          onClick={() => void appendEntry()}
          disabled={loading}
          data-testid="ledger-append"
          className="rounded-lg border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
        >
          {t('finance.m16d.ledger.append', '+ append entry')}
        </button>
      </div>

      {error && (
        <div
          className="mb-4 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-sm text-c-danger"
          data-testid="ledger-error"
        >
          {error}
        </div>
      )}

      {!error && !result && !loading && (
        <p className="text-sm text-c-text-secondary" data-testid="ledger-empty">
          {t('finance.m16d.ledger.empty', 'Load a KPI to see its current value and audit trail.')}
        </p>
      )}

      {!error && result && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="ledger-stats">
            <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                {t('finance.m16d.ledger.baselineValue', 'Baseline value')}
              </p>
              <p className="text-sm font-semibold text-c-text">{fmt(result.baselineValue)}</p>
            </div>
            <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                {t('finance.m16d.ledger.currentValue', 'Current value')}
              </p>
              <p className="text-sm font-semibold text-c-text">{fmt(result.current)}</p>
            </div>
            <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                {t('finance.m16d.ledger.entriesCount', 'Ledger entries')}
              </p>
              <p className="text-sm font-semibold text-c-text">
                {Math.max(0, result.auditTrail.length - 1)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto" data-testid="ledger-audit-trail">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-c-border-subtle text-c-text-muted">
                  <th className="py-1.5 pr-3 font-medium">
                    {t('finance.m16d.ledger.colKind', 'Kind')}
                  </th>
                  <th className="py-1.5 pr-3 text-right font-medium">
                    {t('finance.m16d.ledger.colDelta', 'Delta')}
                  </th>
                  <th className="py-1.5 pr-3 text-right font-medium">
                    {t('finance.m16d.ledger.colRunningTotal', 'Running total')}
                  </th>
                  <th className="py-1.5 pr-3 font-medium">
                    {t('finance.m16d.ledger.colReason', 'Reason')}
                  </th>
                  <th className="py-1.5 font-medium">
                    {t('finance.m16d.ledger.colAt', 'At')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.auditTrail.map((step, idx) => (
                  <tr
                    key={`${step.id ?? 'baseline'}-${idx}`}
                    className="border-b border-c-border-subtle/60 text-c-text"
                    data-testid={`ledger-audit-row-${idx}`}
                  >
                    <td className="py-1.5 pr-3 capitalize">{step.kind}</td>
                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums">
                      {fmt(step.delta)}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums">
                      {fmt(step.runningTotal)}
                    </td>
                    <td className="py-1.5 pr-3 text-c-text-secondary">{step.reason ?? '—'}</td>
                    <td className="py-1.5 text-c-text-secondary">{fmtDate(step.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default ValueLedgerPanel;
