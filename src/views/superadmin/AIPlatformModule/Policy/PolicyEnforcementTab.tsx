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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [contextPolicy, governancePolicy, governanceHealth, providers, connectors] =
          await Promise.all([
            Api.getAIGovernanceContextPolicy(),
            Api.getAIGovernancePolicy(),
            Api.getAIGovernanceHealth(),
            Api.getMissionControlProviders(),
            Api.get('/superadmin/connectors'),
          ]);

        if (cancelled) return;

        const providerList = Array.isArray(providers?.providers)
          ? providers.providers
          : Array.isArray(providers)
            ? providers
            : [];
        const connectorList = Array.isArray(connectors?.connectors)
          ? connectors.connectors
          : Array.isArray(connectors)
            ? connectors
            : [];

        const providerRows = providerList
          .map((provider: any) => {
              const desiredState = provider?.enabled === false ? 'disabled' : 'enabled';
              const appliedState = provider?.healthStatus || provider?.status || 'unknown';
              return {
                id: `provider:${provider.id || provider.provider}`,
                domain: `Model provider: ${provider.name || provider.provider || provider.id}`,
                desiredState,
                appliedState,
                drift:
                  desiredState === 'enabled'
                    ? appliedState !== 'healthy' && appliedState !== 'enabled'
                    : appliedState !== 'disabled',
                note: 'Provider health and allow-state should remain aligned with platform policy.',
              };
            });

        const connectorRows = connectorList.slice(0, 8).map((connector: any) => {
              const desiredState = connector?.status === 'disabled' ? 'disabled' : 'enabled';
              const appliedState = connector?.status || 'unknown';
              return {
                id: `connector:${connector.id || connector.connector_type}`,
                domain: `Connector: ${connector.name || connector.connector_type || connector.id}`,
                desiredState,
                appliedState,
                drift: desiredState !== appliedState,
                note: 'Connector kill-switches must propagate into tenant runtime state.',
              };
            });

        const policyRows: EnforcementRow[] = [
          {
            id: 'policy:context',
            domain: 'Context policy',
            desiredState: contextPolicy?.retention || 'standard',
            appliedState: governanceHealth?.contextPolicyStatus || 'unknown',
            drift:
              Boolean(governanceHealth?.contextPolicyStatus) &&
              String(governanceHealth.contextPolicyStatus).toLowerCase() !== 'healthy',
            note: 'Tracks whether runtime context controls match configured retention and minimization.',
          },
          {
            id: 'policy:governance',
            domain: 'Approval / override policy',
            desiredState: governancePolicy?.approvalMode || governancePolicy?.approvalClass || 'managed',
            appliedState: governanceHealth?.policyStatus || 'unknown',
            drift:
              Boolean(governanceHealth?.policyStatus) &&
              String(governanceHealth.policyStatus).toLowerCase() !== 'healthy',
            note: 'Desired governance settings should be reflected in actual platform enforcement.',
          },
          {
            id: 'policy:workers',
            domain: 'Virtual workers',
            desiredState: governancePolicy?.workersEnabled === false ? 'restricted' : 'managed',
            appliedState: governanceHealth?.workerStatus || 'unknown',
            drift:
              Boolean(governanceHealth?.workerStatus) &&
              String(governanceHealth.workerStatus).toLowerCase() !== 'healthy',
            note: 'Worker suspensions should show up as applied runtime state, not just config toggles.',
          },
        ];

        setRows([...policyRows, ...providerRows, ...connectorRows]);
        setHealth(governanceHealth || null);
      } catch {
        if (cancelled) return;
        setRows([]);
        setHealth(null);
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
