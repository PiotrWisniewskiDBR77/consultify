import {
  AlertTriangle,
  Clock3,
  Fingerprint,
  KeyRound,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { DegradedState } from '../../components/Admin/AdminState';
import { Api } from '../../services/api';

const postureTone = (value: number, warningThreshold: number, criticalThreshold: number) => {
  if (value >= criticalThreshold) return 'text-danger-600 dark:text-danger-400';
  if (value >= warningThreshold) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
};

export const GlobalSecurityPostureView: React.FC = () => {
  const [data, setData] = useState<{
    systemHealth: any;
    operatorOverview: any;
  }>({
    systemHealth: null,
    operatorOverview: null,
  });
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadError(null);
        const [systemHealth, operatorOverview] = await Promise.all([
          Api.getSystemHealth(),
          Api.getSuperAdminOperatorOverview(),
        ]);
        if (cancelled) return;
        setData({
          systemHealth,
          operatorOverview,
        });
      } catch (error) {
        if (cancelled) return;
        console.error('[GlobalSecurityPostureView] Failed to load posture data', error);
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Global security posture data is temporarily unavailable.'
        );
        setData({ systemHealth: null, operatorOverview: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const posture = useMemo(() => {
    const unresolvedAudit = Number(data.operatorOverview?.audit?.unresolved || 0);
    const criticalIncidents =
      Number(data.operatorOverview?.incidents?.critical || 0) +
      Number(data.operatorOverview?.incidents?.high || 0);
    const activePrivilegedSessions = Number(data.operatorOverview?.sessions?.active || 0);
    const jitActive = Number(data.operatorOverview?.sessions?.jitActive || 0);
    const breakGlassActive = Number(data.operatorOverview?.sessions?.breakGlassActive || 0);
    const mfaRequired = String(data.operatorOverview?.overrides?.mfa || 'disabled') === 'enforced';
    const ssoRequired = String(data.operatorOverview?.overrides?.sso || 'disabled') === 'enforced';
    return {
      unresolvedAudit,
      criticalIncidents,
      activePrivilegedSessions,
      jitActive,
      breakGlassActive,
      mfaRequired,
      ssoRequired,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Global Security Posture
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Enterprise evidence for privileged sessions, approval debt, incidents, MFA/SSO posture,
          and operator blast radius.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-navy-700 dark:bg-navy-900">
          <DegradedState title="Global security posture unavailable" description={loadError} />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <UserCog className="h-4 w-4 text-indigo-500" />
                Privileged sessions
              </div>
              <div
                className={`mt-2 text-2xl font-semibold ${postureTone(posture.activePrivilegedSessions, 10, 20)}`}
              >
                {posture.activePrivilegedSessions}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Active admin sessions that can reach P33.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <ShieldAlert className="h-4 w-4 text-danger-500" />
                Audit debt
              </div>
              <div
                className={`mt-2 text-2xl font-semibold ${postureTone(posture.unresolvedAudit, 5, 15)}`}
              >
                {posture.unresolvedAudit}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Unresolved privileged actions awaiting review.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Critical incidents
              </div>
              <div
                className={`mt-2 text-2xl font-semibold ${postureTone(posture.criticalIncidents, 1, 3)}`}
              >
                {posture.criticalIncidents}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Open high-severity or critical security incidents.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <Shield className="h-4 w-4 text-emerald-500" />
                Platform health
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {data.systemHealth?.status || 'unknown'}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Overall control plane status from the system health monitor.
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-navy-700 dark:bg-navy-900">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Security controls
              </h3>
              <div className="mt-4 grid gap-3">
                {[
                  {
                    icon: <Fingerprint className="h-4 w-4 text-sky-500" />,
                    label: 'MFA posture',
                    value: posture.mfaRequired
                      ? 'Platform policy enforced'
                      : 'Review policy coverage',
                  },
                  {
                    icon: <KeyRound className="h-4 w-4 text-primary-500" />,
                    label: 'SSO posture',
                    value: posture.ssoRequired
                      ? 'Platform policy enforced'
                      : 'Review policy coverage',
                  },
                  {
                    icon: <ShieldCheck className="h-4 w-4 text-emerald-500" />,
                    label: 'Security event volume',
                    value: `${Number(data.operatorOverview?.events?.today || 0)} today`,
                  },
                  {
                    icon: <Clock3 className="h-4 w-4 text-amber-500" />,
                    label: 'Break-glass readiness',
                    value: `${posture.breakGlassActive} break-glass / ${posture.jitActive} JIT sessions active.`,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-navy-700 dark:bg-navy-950/40"
                  >
                    {item.icon}
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {item.label}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-navy-700 dark:bg-navy-900">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Evidence checklist
              </h3>
              <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="rounded-lg bg-slate-50 px-3 py-3 dark:bg-navy-950/40">
                  Privileged activity is visible through admin session stats, audit counts, and
                  incident views.
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-3 dark:bg-navy-950/40">
                  MFA and SSO controls are separated from billing and support operations through
                  capability-based auth.
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-3 dark:bg-navy-950/40">
                  Security failures remain fail-closed: unresolved audit debt and critical incidents
                  stay visible in the operator shell.
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GlobalSecurityPostureView;
