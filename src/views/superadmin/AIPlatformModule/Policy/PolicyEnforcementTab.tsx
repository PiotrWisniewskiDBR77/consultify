import {
  Activity,
  Cpu,
  ExternalLink,
  RefreshCw,
  Shield,
  ShieldAlert,
  Workflow,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { DegradedState } from '@/components/Admin/AdminState';
import { normalizeApiErrorMessage } from '@/utils/apiError';

import { Api } from '../../../../services/api';

type EnforcementRow = {
  id: string;
  domain: string;
  desiredState: string;
  appliedState: string;
  drift: boolean;
  note: string;
  updatedAt?: string | null;
};

type EnforcementSummary = {
  total?: number;
  drift?: number;
  providers?: number;
  connectors?: number;
  workers?: number;
};

type EnforcementHealth = {
  status?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : fallback;

const toBool = (value: unknown, fallback = false) =>
  typeof value === 'boolean'
    ? value
    : value === undefined || value === null
      ? fallback
      : value === 1 || value === '1' || value === 'true';

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const hasRowsShape = (value: unknown) => {
  const payload = getObjectPayload(value);
  return isRecord(payload) && Array.isArray(payload.rows);
};

const normalizeRows = (value: unknown): EnforcementRow[] => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !Array.isArray(payload.rows)) {
    throw new Error('Policy enforcement rows response was not a list');
  }
  return payload.rows.map((row, index) => {
    const record = isRecord(row) ? row : {};
    return {
      id: asText(record.id, `policy-row-${index + 1}`),
      domain: asText(record.domain, 'Unknown domain'),
      desiredState: asText(record.desiredState, 'unknown'),
      appliedState: asText(record.appliedState, 'unknown'),
      drift: toBool(record.drift, false),
      note: asText(record.note, 'No note provided'),
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
    };
  });
};

function formatDateTime(value?: string | null): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return date.toLocaleString();
}

function getDriftSeverity(row: EnforcementRow): 'critical' | 'high' | 'medium' | 'none' {
  if (!row.drift) return 'none';
  if (row.id.startsWith('provider:') && row.desiredState === 'enabled') return 'critical';
  if (row.id.startsWith('connector:') && row.appliedState === 'partial') return 'high';
  return 'medium';
}

function getRepairTarget(row: EnforcementRow): { label: string; href: string } {
  if (row.id.startsWith('provider:')) {
    return {
      label: 'Open LLM Providers',
      href: '/superadmin/ai-platform?tab=configuration&subTab=llm-providers',
    };
  }
  if (row.id.startsWith('connector:')) {
    return {
      label: 'Open Connector Ops',
      href: '/superadmin/system?tab=integrations',
    };
  }
  if (row.id.startsWith('worker:')) {
    return {
      label: 'Open Mission Control',
      href: '/superadmin/ai-platform?tab=operations&subTab=mission-control',
    };
  }
  return {
    label: 'Open AI Governance',
    href: '/superadmin/ai-platform?tab=configuration&subTab=ai-governance',
  };
}

export const PolicyEnforcementTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EnforcementRow[]>([]);
  const [health, setHealth] = useState<EnforcementHealth | null>(null);
  const [summary, setSummary] = useState<EnforcementSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const enforcement = await Api.getSuperAdminPolicyEnforcement();
      if (!hasRowsShape(enforcement)) {
        throw new Error('Policy enforcement rows response was not a list');
      }
      const payload = getObjectPayload(enforcement);
      const payloadRecord = isRecord(payload) ? payload : {};

      setRows(normalizeRows(payloadRecord));
      setHealth(isRecord(payloadRecord.health) ? payloadRecord.health : null);
      setSummary(isRecord(payloadRecord.summary) ? payloadRecord.summary : null);
    } catch (error: unknown) {
      setRows([]);
      setHealth(null);
      setSummary(null);
      setLoadError(
        normalizeApiErrorMessage(error, 'Policy enforcement telemetry is temporarily unavailable.')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const driftRows = useMemo(() => rows.filter((row) => row.drift), [rows]);
  const driftCount = summary?.drift ?? driftRows.length;
  const providerCount =
    summary?.providers ?? rows.filter((row) => row.id.startsWith('provider:')).length;
  const connectorCount =
    summary?.connectors ?? rows.filter((row) => row.id.startsWith('connector:')).length;
  const criticalDriftCount = useMemo(
    () => driftRows.filter((row) => getDriftSeverity(row) === 'critical').length,
    [driftRows]
  );
  const initialLoading = loading && rows.length === 0 && !health;

  return (
    <div className="space-y-6">
      {loadError && (
        <DegradedState title="Policy enforcement unavailable" description={loadError} />
      )}

      {initialLoading && !loadError && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-400">
          Loading policy feedback...
        </div>
      )}

      {!loadError && !initialLoading && criticalDriftCount > 0 && (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800 dark:border-danger-900/60 dark:bg-danger-900/30 dark:text-danger-300">
          High-risk rollout blocked: {criticalDriftCount} enabled provider
          {criticalDriftCount === 1 ? ' has' : 's have'} unresolved runtime drift.
        </div>
      )}

      {!loadError && !initialLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              <Shield className="h-4 w-4 text-indigo-500" />
              Enforcement state
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {health?.status || 'unknown'}
            </div>
            <div className="mt-2 text-xs text-slate-500">AI governance control plane health.</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Drift detection
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {driftCount}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Domains where desired and applied state diverge.
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              <Cpu className="h-4 w-4 text-emerald-500" />
              Provider readiness
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {providerCount}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Tracked model providers with runtime feedback.
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              <Workflow className="h-4 w-4 text-sky-500" />
              Connector coverage
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {connectorCount}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Connector runtime controls visible from the same policy plane.
            </div>
          </div>
        </div>
      )}

      {!loadError && !initialLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-navy-700 dark:bg-navy-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Desired vs applied state
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Policy changes must be observable as runtime state, not just saved configuration.
              </p>
            </div>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200 dark:hover:bg-navy-800"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table
              /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="min-w-full text-sm"
            >
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-navy-700">
                  <th className="px-3 py-2 font-medium">Domain</th>
                  <th className="px-3 py-2 font-medium">Desired</th>
                  <th className="px-3 py-2 font-medium">Applied</th>
                  <th className="px-3 py-2 font-medium">Drift</th>
                  <th className="px-3 py-2 font-medium">Severity</th>
                  <th className="px-3 py-2 font-medium">Detected</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                  <th className="px-3 py-2 font-medium">Repair path</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const severity = getDriftSeverity(row);
                  const target = getRepairTarget(row);
                  return (
                    <tr key={row.id} className="border-b border-slate-200 dark:border-navy-800">
                      <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">
                        {row.domain}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                        {row.desiredState}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                        {row.appliedState}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            row.drift
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                          }`}
                        >
                          {row.drift ? 'Drift detected' : 'Aligned'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${
                            severity === 'critical'
                              ? 'bg-danger-100 text-danger-700 dark:bg-danger-500/10 dark:text-danger-300'
                              : severity === 'high'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                                : severity === 'medium'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300'
                          }`}
                        >
                          {severity}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-500 dark:text-slate-400">
                        {formatDateTime(row.updatedAt)}
                      </td>
                      <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{row.note}</td>
                      <td className="px-3 py-3">
                        <a
                          href={target.href}
                          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-300"
                        >
                          {target.label}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                      No enforcement data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-navy-700 dark:bg-navy-950/40 dark:text-slate-300">
        <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
          <Activity className="h-4 w-4 text-primary-500" />
          Operator guidance
        </div>
        <p className="mt-2">
          Use this view to confirm that model suspensions, worker kill-switches, and connector
          restrictions have propagated to the actual runtime. Any drift here should block high-risk
          rollout decisions until resolved.
        </p>
      </div>
    </div>
  );
};

export default PolicyEnforcementTab;
