/**
 * M16 advanced suite (wire-c) — Headcount Planner panel.
 *
 * Consumes POST /api/v8/finance-planning/headcount/{opex,summary} (server:
 * headcountPlannerService — see finance-planning.routes.ts §3). The user
 * edits a small roster of roles (base salary, benefits load, start period,
 * ramp) plus an ordered period list, hits "Plan headcount", and the panel:
 *   1. calls /headcount/opex for the per-period headcount + OPEX rows
 *      (bar chart: total loaded cost, headcount overlay), then
 *   2. calls /headcount/summary for the roster-level cost-per-hire summary
 *      (total roles + average fully-loaded annual cost).
 *
 * Fail-soft: a request error degrades to a quiet inline notice, never throws.
 * Behind flag `m16AdvancedSuite` (default OFF) — see financeFeatureFlags.ts.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useFinanceChartColors } from '@/components/Economics/financeChartTokens';
import {
  type HeadcountOpexRow,
  type HeadcountRoleInput,
  type HeadcountSummary,
  postHeadcountOpex,
  postHeadcountSummary,
} from '@/services/api/v8/financePlanning';

interface RoleRow {
  id: string;
  title: string;
  baseSalary: string;
  benefitsLoadPct: string;
  startPeriod: string;
  rampMonths: string;
}

const DEFAULT_ROLES: RoleRow[] = [
  {
    id: 'r1',
    title: 'AE',
    baseSalary: '8000',
    benefitsLoadPct: '0.25',
    startPeriod: '0',
    rampMonths: '2',
  },
  {
    id: 'r2',
    title: 'SDR',
    baseSalary: '5000',
    benefitsLoadPct: '0.22',
    startPeriod: '1',
    rampMonths: '1',
  },
];

const DEFAULT_PERIODS = 'M1,M2,M3,M4,M5,M6';

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return Math.round(v).toString();
};

export interface HeadcountPlannerPanelProps {
  fetcher?: {
    opex?: typeof postHeadcountOpex;
    summary?: typeof postHeadcountSummary;
  };
}

export const HeadcountPlannerPanel: React.FC<HeadcountPlannerPanelProps> = ({ fetcher }) => {
  const { t } = useTranslation();
  const colors = useFinanceChartColors();
  const [roles, setRoles] = useState<RoleRow[]>(DEFAULT_ROLES);
  const [periodsRaw, setPeriodsRaw] = useState(DEFAULT_PERIODS);

  const [rows, setRows] = useState<HeadcountOpexRow[] | null>(null);
  const [summary, setSummary] = useState<HeadcountSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRole = useCallback((id: string, patch: Partial<RoleRow>) => {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addRole = useCallback(() => {
    setRoles((prev) => [
      ...prev,
      {
        id: `r${prev.length + 1}`,
        title: `Role ${prev.length + 1}`,
        baseSalary: '5000',
        benefitsLoadPct: '0.25',
        startPeriod: '0',
        rampMonths: '0',
      },
    ]);
  }, []);

  const removeRole = useCallback((id: string) => {
    setRoles((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }, []);

  const run = useCallback(async () => {
    const periods = periodsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (roles.length === 0 || periods.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const roleInputs: HeadcountRoleInput[] = roles.map((r) => ({
        id: r.id,
        title: r.title,
        baseSalary: Number(r.baseSalary) || 0,
        benefitsLoadPct: Number(r.benefitsLoadPct) || 0,
        startPeriod: Math.max(0, Math.floor(Number(r.startPeriod) || 0)),
        rampMonths: Math.max(0, Math.floor(Number(r.rampMonths) || 0)),
      }));

      const opex = fetcher?.opex ?? postHeadcountOpex;
      const summaryFn = fetcher?.summary ?? postHeadcountSummary;

      const [opexRes, summaryRes] = await Promise.all([
        opex(roleInputs, periods),
        summaryFn(roleInputs),
      ]);
      setRows(opexRes.rows);
      setSummary(summaryRes.summary);
    } catch (err: any) {
      setRows(null);
      setSummary(null);
      setError(
        err?.message
          ? String(err.message)
          : t('finance.m16c.headcount.errorGeneric', 'Headcount planning failed.')
      );
    } finally {
      setLoading(false);
    }
  }, [roles, periodsRaw, fetcher, t]);

  const chartData = useMemo(
    () =>
      (rows ?? []).map((r) => ({
        period: r.period,
        totalLoaded: r.totalLoaded,
        headcount: r.headcount,
      })),
    [rows]
  );

  return (
    <div
      className="rounded-xl border border-c-border bg-c-surface p-4"
      data-testid="headcount-planner-panel"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t('finance.m16c.headcount.title', 'Headcount planner — workforce OPEX')}
          </h3>
          <p className="mt-0.5 text-xs text-c-text-secondary">
            {t(
              'finance.m16c.headcount.subtitle',
              'Fully-loaded personnel cost and headcount per period, with ramp.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading || roles.length === 0}
          data-testid="headcount-run"
          className="shrink-0 rounded-xl border border-c-border bg-c-surface-raised px-3.5 py-2 text-sm font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
        >
          {loading
            ? t('finance.m16c.headcount.running', 'Planning…')
            : t('finance.m16c.headcount.run', 'Plan headcount')}
        </button>
      </div>

      {/* Role rows */}
      <div className="mb-3 space-y-2" data-testid="headcount-roles">
        {roles.map((role) => (
          <div
            key={role.id}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-c-border-subtle p-2"
            data-testid={`headcount-role-${role.id}`}
          >
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16c.headcount.roleTitle', 'Role')}</span>
              <input
                type="text"
                value={role.title}
                onChange={(e) => updateRole(role.id, { title: e.target.value })}
                className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">
                {t('finance.m16c.headcount.baseSalary', 'Base salary')}
              </span>
              <input
                type="number"
                value={role.baseSalary}
                onChange={(e) => updateRole(role.id, { baseSalary: e.target.value })}
                className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">
                {t('finance.m16c.headcount.benefitsLoad', 'Benefits load')}
              </span>
              <input
                type="number"
                step={0.01}
                value={role.benefitsLoadPct}
                onChange={(e) => updateRole(role.id, { benefitsLoadPct: e.target.value })}
                className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">
                {t('finance.m16c.headcount.startPeriod', 'Start period (0-based)')}
              </span>
              <input
                type="number"
                min={0}
                value={role.startPeriod}
                onChange={(e) => updateRole(role.id, { startPeriod: e.target.value })}
                className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">
                {t('finance.m16c.headcount.rampMonths', 'Ramp (periods)')}
              </span>
              <input
                type="number"
                min={0}
                value={role.rampMonths}
                onChange={(e) => updateRole(role.id, { rampMonths: e.target.value })}
                className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            {roles.length > 1 && (
              <button
                type="button"
                onClick={() => removeRole(role.id)}
                className="text-c-text-muted hover:text-c-danger"
                aria-label={`Remove ${role.title}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={addRole}
            className="rounded border border-dashed border-c-border px-2 py-1 text-xs text-c-text-secondary hover:border-c-focus hover:text-c-text"
          >
            {t('finance.m16c.headcount.addRole', '+ role')}
          </button>
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">
              {t('finance.m16c.headcount.periods', 'Periods (comma-separated)')}
            </span>
            <input
              type="text"
              value={periodsRaw}
              onChange={(e) => setPeriodsRaw(e.target.value)}
              className="w-52 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
        </div>
      </div>

      {error && (
        <div
          className="mb-4 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-sm text-c-danger"
          data-testid="headcount-error"
        >
          {error}
        </div>
      )}

      {!error && !rows && !loading && (
        <p className="text-sm text-c-text-secondary" data-testid="headcount-empty">
          {t('finance.m16c.headcount.empty', 'Set the roster and periods, then plan headcount.')}
        </p>
      )}

      {!error && rows && summary && (
        <>
          <div
            className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-2"
            data-testid="headcount-summary"
          >
            <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                {t('finance.m16c.headcount.totalRoles', 'Total roles')}
              </p>
              <p className="text-sm font-semibold text-c-text">{summary.totalRoles}</p>
            </div>
            <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                {t('finance.m16c.headcount.avgLoadedAnnual', 'Avg. loaded annual cost')}
              </p>
              <p className="text-sm font-semibold text-c-text">{fmt(summary.avgLoadedAnnual)}</p>
            </div>
          </div>

          <div className="h-[240px] w-full" data-testid="headcount-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" stroke={colors.axis} tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="cost"
                  stroke={colors.axis}
                  tick={{ fontSize: 11 }}
                  tickFormatter={fmt}
                />
                <YAxis
                  yAxisId="headcount"
                  orientation="right"
                  stroke={colors.axis}
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === 'headcount' ? value : fmt(value)
                  }
                />
                <Bar yAxisId="cost" dataKey="totalLoaded" fill={colors.net} radius={[3, 3, 0, 0]} />
                <Line
                  yAxisId="headcount"
                  type="monotone"
                  dataKey="headcount"
                  stroke={colors.warning}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-c-text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors.net }} />
                {t('finance.m16c.headcount.legendCost', 'Loaded cost')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4" style={{ backgroundColor: colors.warning }} />
                {t('finance.m16c.headcount.legendHeadcount', 'Headcount')}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HeadcountPlannerPanel;
