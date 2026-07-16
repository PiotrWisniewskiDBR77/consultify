/**
 * M16 value suite (wire-d) — Value Capture Pipeline panel.
 *
 * Consumes GET/POST /api/v8/finance/value-tracking/capture/* (server:
 * valueCapturePipelineService — see finance-value.routes.ts §3). Initiatives
 * advance through value-capture stage-gates G0..G5; a gate only advances when
 * its exit criteria are met AND a sign-off is recorded. The panel shows the
 * pipeline funnel (count + value + conversion per gate) and lets the user
 * create a gate record or advance an existing one.
 *
 * Fail-soft: a request error degrades to a quiet inline notice, never throws.
 * Behind flag `m16ValueSuite` (default OFF) — see financeFeatureFlags.ts.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useFinanceChartColors } from '@/components/Economics/financeChartTokens';
import {
  type FunnelStage,
  getFunnel,
  getGates,
  postAdvanceGate,
  postCreateGate,
  type ValueCaptureGate,
  type ValueCaptureGateStage,
} from '@/services/api/v8/financeValue';

const GATES: ValueCaptureGateStage[] = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5'];

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
};

const fmtPct = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(0)}%`;
};

const STATUS_TONE: Record<ValueCaptureGate['status'], string> = {
  passed: 'border-c-success/30 bg-c-success/10 text-c-success',
  pending: 'border-c-warning/30 bg-c-warning/10 text-c-warning',
  blocked: 'border-c-danger/30 bg-c-danger/10 text-c-danger',
};

export interface ValueCapturePipelinePanelProps {
  fetcher?: {
    funnel?: typeof getFunnel;
    gates?: typeof getGates;
    createGate?: typeof postCreateGate;
    advanceGate?: typeof postAdvanceGate;
  };
}

export const ValueCapturePipelinePanel: React.FC<ValueCapturePipelinePanelProps> = ({
  fetcher,
}) => {
  const { t } = useTranslation();
  const colors = useFinanceChartColors();

  const [funnel, setFunnel] = useState<FunnelStage[] | null>(null);
  const [gates, setGates] = useState<ValueCaptureGate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newInitiativeId, setNewInitiativeId] = useState('init-001');
  const [newGate, setNewGate] = useState<ValueCaptureGateStage>('G0');
  const [newCriteria, setNewCriteria] = useState('');
  const [newValueEvidence, setNewValueEvidence] = useState('0');
  const [signOffById, setSignOffById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const funnelFn = fetcher?.funnel ?? getFunnel;
      const gatesFn = fetcher?.gates ?? getGates;
      const [funnelRes, gatesRes] = await Promise.all([funnelFn(), gatesFn()]);
      setFunnel(funnelRes ?? null);
      setGates(Array.isArray(gatesRes) ? gatesRes : []);
      if (!funnelRes) {
        setError(t('finance.m16d.capture.errorGeneric', 'Value capture pipeline unavailable.'));
      }
    } catch (err: any) {
      setFunnel(null);
      setGates([]);
      setError(
        err?.message
          ? String(err.message)
          : t('finance.m16d.capture.errorGeneric', 'Value capture pipeline unavailable.')
      );
    } finally {
      setLoading(false);
    }
  }, [fetcher, t]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createGate = useCallback(async () => {
    if (!newInitiativeId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const fn = fetcher?.createGate ?? postCreateGate;
      await fn({
        initiativeId: newInitiativeId.trim(),
        gate: newGate,
        criteria: newCriteria.trim() || null,
        valueEvidence: newValueEvidence.trim() ? Number(newValueEvidence) || 0 : null,
      });
      setNewCriteria('');
      setNewValueEvidence('0');
      await load();
    } catch (err: any) {
      setError(
        err?.message
          ? String(err.message)
          : t('finance.m16d.capture.errorGeneric', 'Value capture pipeline unavailable.')
      );
      setLoading(false);
    }
  }, [newInitiativeId, newGate, newCriteria, newValueEvidence, fetcher, load, t]);

  const advance = useCallback(
    async (id: string) => {
      const signedOffBy = (signOffById[id] ?? '').trim();
      if (!signedOffBy) return;
      setLoading(true);
      setError(null);
      try {
        const fn = fetcher?.advanceGate ?? postAdvanceGate;
        await fn(id, signedOffBy);
        await load();
      } catch (err: any) {
        setError(
          err?.message
            ? String(err.message)
            : t('finance.m16d.capture.errorAdvance', 'Could not advance this gate.')
        );
        setLoading(false);
      }
    },
    [signOffById, fetcher, load, t]
  );

  return (
    <div
      className="rounded-xl border border-c-border bg-c-surface p-4"
      data-testid="value-capture-pipeline-panel"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t('finance.m16d.capture.title', 'Value capture pipeline — gates G0…G5')}
          </h3>
          <p className="mt-0.5 text-xs text-c-text-secondary">
            {t(
              'finance.m16d.capture.subtitle',
              'A gate advances only when exit criteria are met AND signed off.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          data-testid="capture-refresh"
          className="shrink-0 rounded-xl border border-c-border bg-c-surface-raised px-3.5 py-2 text-sm font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
        >
          {loading
            ? t('finance.m16d.capture.loading', 'Loading…')
            : t('finance.m16d.capture.refresh', 'Refresh')}
        </button>
      </div>

      {error && (
        <div
          className="mb-4 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-sm text-c-danger"
          data-testid="capture-error"
        >
          {error}
        </div>
      )}

      {!error && funnel && (
        <div className="mb-4 h-[220px] w-full" data-testid="capture-funnel-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnel} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="gate" stroke={colors.axis} tick={{ fontSize: 11 }} />
              <YAxis stroke={colors.axis} tick={{ fontSize: 11 }} tickFormatter={fmt} />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === 'conversionFromPrev' ? fmtPct(value) : fmt(value)
                }
              />
              <Bar
                dataKey="count"
                name={String(t('finance.m16d.capture.legendCount', 'Initiatives'))}
                fill={colors.net}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {!error && funnel && (
        <div className="mb-4 overflow-x-auto" data-testid="capture-funnel-table">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-c-border-subtle text-c-text-muted">
                <th className="py-1.5 pr-3 font-medium">
                  {t('finance.m16d.capture.colGate', 'Gate')}
                </th>
                <th className="py-1.5 pr-3 text-right font-medium">
                  {t('finance.m16d.capture.colCount', 'Count')}
                </th>
                <th className="py-1.5 pr-3 text-right font-medium">
                  {t('finance.m16d.capture.colValue', 'Value evidence')}
                </th>
                <th className="py-1.5 text-right font-medium">
                  {t('finance.m16d.capture.colConversion', 'Conversion')}
                </th>
              </tr>
            </thead>
            <tbody>
              {funnel.map((stage) => (
                <tr
                  key={stage.gate}
                  className="border-b border-c-border-subtle/60 text-c-text"
                  data-testid={`capture-funnel-row-${stage.gate}`}
                >
                  <td className="py-1.5 pr-3 font-medium">{stage.gate}</td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{stage.count}</td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums">
                    {fmt(stage.totalValue)}
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums">
                    {fmtPct(stage.conversionFromPrev)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create gate */}
      <div
        className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-c-border-subtle p-2"
        data-testid="capture-create-form"
      >
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">{t('finance.m16d.capture.initiativeId', 'Initiative')}</span>
          <input
            type="text"
            value={newInitiativeId}
            onChange={(e) => setNewInitiativeId(e.target.value)}
            className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">{t('finance.m16d.capture.gate', 'Gate')}</span>
          <select
            value={newGate}
            onChange={(e) => setNewGate(e.target.value as ValueCaptureGateStage)}
            className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            {GATES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">{t('finance.m16d.capture.criteria', 'Exit criteria')}</span>
          <input
            type="text"
            value={newCriteria}
            onChange={(e) => setNewCriteria(e.target.value)}
            className="w-40 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">
            {t('finance.m16d.capture.valueEvidence', 'Value evidence')}
          </span>
          <input
            type="number"
            value={newValueEvidence}
            onChange={(e) => setNewValueEvidence(e.target.value)}
            className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
        <button
          type="button"
          onClick={() => void createGate()}
          disabled={loading}
          data-testid="capture-create"
          className="rounded-lg border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
        >
          {t('finance.m16d.capture.create', '+ create gate')}
        </button>
      </div>

      {!error && gates.length === 0 && !loading && (
        <p className="text-sm text-c-text-secondary" data-testid="capture-gates-empty">
          {t('finance.m16d.capture.gatesEmpty', 'No gates recorded yet.')}
        </p>
      )}

      {gates.length > 0 && (
        <div className="overflow-x-auto" data-testid="capture-gates-list">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-c-border-subtle text-c-text-muted">
                <th className="py-1.5 pr-3 font-medium">
                  {t('finance.m16d.capture.colInitiative', 'Initiative')}
                </th>
                <th className="py-1.5 pr-3 font-medium">
                  {t('finance.m16d.capture.colGate', 'Gate')}
                </th>
                <th className="py-1.5 pr-3 font-medium">
                  {t('finance.m16d.capture.colStatus', 'Status')}
                </th>
                <th className="py-1.5 font-medium">
                  {t('finance.m16d.capture.colAdvance', 'Advance')}
                </th>
              </tr>
            </thead>
            <tbody>
              {gates.map((gate) => (
                <tr
                  key={gate.id}
                  className="border-b border-c-border-subtle/60 text-c-text"
                  data-testid={`capture-gate-row-${gate.id}`}
                >
                  <td className="py-1.5 pr-3">{gate.initiativeId}</td>
                  <td className="py-1.5 pr-3 font-medium">{gate.gate}</td>
                  <td className="py-1.5 pr-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[gate.status]}`}
                      data-testid={`capture-gate-status-${gate.id}`}
                    >
                      {gate.status}
                    </span>
                  </td>
                  <td className="py-1.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder={String(
                          t('finance.m16d.capture.signedOffByPlaceholder', 'Signed off by')
                        )}
                        value={signOffById[gate.id] ?? ''}
                        onChange={(e) =>
                          setSignOffById((prev) => ({ ...prev, [gate.id]: e.target.value }))
                        }
                        className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-[11px] text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
                      />
                      <button
                        type="button"
                        onClick={() => void advance(gate.id)}
                        disabled={loading || gate.status === 'passed'}
                        data-testid={`capture-advance-${gate.id}`}
                        className="rounded border border-c-border px-2 py-1 text-[11px] font-medium text-c-text transition hover:border-c-focus disabled:opacity-40"
                      >
                        {t('finance.m16d.capture.advance', 'Advance')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ValueCapturePipelinePanel;
