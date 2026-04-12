import { Activity, Cpu, Shield, ShieldAlert, Workflow } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { Api } from '../../../../services/api';

type EnforcementRow = {
  id: string;
  domain: string;
  desiredState: string;
  appliedState: string;
  drift: boolean;
  note: string;
};

export const PolicyEnforcementTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EnforcementRow[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        setNotice(null);
        const enforcement = await Api.getSuperAdminPolicyEnforcement();

        if (cancelled) return;
        setRows(Array.isArray(enforcement?.rows) ? enforcement.rows : []);
        setHealth(enforcement?.health || null);
      } catch (error) {
        if (cancelled) return;
        console.error('[PolicyEnforcementTab] Failed to fetch policy enforcement state', error);
        setRows([]);
        setHealth(null);
        setNotice('Policy enforcement telemetry is temporarily unavailable.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const driftCount = useMemo(() => rows.filter((row) => row.drift).length, [rows]);

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {notice}
        </div>
      )}

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
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{driftCount}</div>
          <div className="mt-2 text-xs text-slate-500">Domains where desired and applied state diverge.</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Cpu className="h-4 w-4 text-emerald-500" />
            Provider readiness
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {rows.filter((row) => row.id.startsWith('provider:')).length}
          </div>
          <div className="mt-2 text-xs text-slate-500">Tracked model providers with runtime feedback.</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Workflow className="h-4 w-4 text-sky-500" />
            Connector coverage
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {rows.filter((row) => row.id.startsWith('connector:')).length}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Connector runtime controls visible from the same policy plane.
          </div>
        </div>
      </div>

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
          {loading && <div className="text-xs text-slate-500">Loading policy feedback...</div>}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-navy-700">
                <th className="px-3 py-2 font-medium">Domain</th>
                <th className="px-3 py-2 font-medium">Desired</th>
                <th className="px-3 py-2 font-medium">Applied</th>
                <th className="px-3 py-2 font-medium">Drift</th>
                <th className="px-3 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 dark:border-navy-800">
                  <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{row.domain}</td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{row.desiredState}</td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{row.appliedState}</td>
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
                  <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{row.note}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                    No enforcement data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
