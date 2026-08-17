import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { Button } from '../ui/primitives/Button';

type ProbeStatus = 'pass' | 'fail' | 'unknown';

interface ProbeResult {
  probeId: string;
  module: string;
  title: string;
  description: string;
  status: ProbeStatus;
  durationMs: number | null;
  errorMessage: string | null;
  ranAt: string | null;
}

interface Summary {
  total: number;
  passed: number;
  failed: number;
  unknown: number;
  overall: ProbeStatus;
}

const STATUS_META: Record<ProbeStatus, { icon: React.ElementType; dotVar: string; label: string }> =
  {
    pass: { icon: CheckCircle2, dotVar: 'var(--c-success)', label: 'Passing' },
    fail: { icon: XCircle, dotVar: 'var(--c-danger)', label: 'Failing' },
    unknown: { icon: HelpCircle, dotVar: 'var(--c-info)', label: 'Not run' },
  };

function StatusDot({ status }: { status: ProbeStatus }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: STATUS_META[status].dotVar }}
      aria-hidden
    />
  );
}

function formatRanAt(ranAt: string | null): string {
  if (!ranAt) return '—';
  const d = new Date(ranAt);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export const AdminHealthPanel: React.FC = () => {
  const { t } = useTranslation();
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [envAllowed, setEnvAllowed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [runningProbe, setRunningProbe] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await Api.getHealthPanelProbes();
      setResults(Array.isArray(data?.results) ? data.results : []);
      setSummary(data?.summary || null);
      setEnvAllowed(data?.envAllowed !== false);
      setHasLoaded(true);
    } catch (error: any) {
      const message = error?.message || 'Failed to load health probes';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAll = useCallback(async () => {
    try {
      setRunningAll(true);
      const data = await Api.runHealthPanelProbes();
      setResults(Array.isArray(data?.results) ? data.results : []);
      setSummary(data?.summary || null);
      const failed = Number(data?.summary?.failed || 0);
      if (failed > 0) toast.error(`${failed} probe(s) failing`);
      else toast.success('All probes passing');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to run probes');
    } finally {
      setRunningAll(false);
    }
  }, []);

  const runOne = useCallback(async (probeId: string) => {
    try {
      setRunningProbe(probeId);
      const data = await Api.runHealthPanelProbe(probeId);
      const updated: ProbeResult | undefined = data?.result;
      if (updated) {
        setResults((prev) => prev.map((r) => (r.probeId === probeId ? { ...r, ...updated } : r)));
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to run probe');
    } finally {
      setRunningProbe(null);
    }
  }, []);

  const overall = summary?.overall || 'unknown';
  const overallMeta = STATUS_META[overall];

  const stats = useMemo(
    () => [
      {
        key: 'passed',
        label: t('admin.health.passing', { defaultValue: 'Passing' }),
        value: summary?.passed ?? 0,
        dot: 'pass' as ProbeStatus,
      },
      {
        key: 'failed',
        label: t('admin.health.failing', { defaultValue: 'Failing' }),
        value: summary?.failed ?? 0,
        dot: 'fail' as ProbeStatus,
      },
      {
        key: 'unknown',
        label: t('admin.health.notRun', { defaultValue: 'Not run' }),
        value: summary?.unknown ?? 0,
        dot: 'unknown' as ProbeStatus,
      },
    ],
    [summary, t]
  );

  if (!hasLoaded && loadError && !loading) {
    return (
      <div
        className="rounded-2xl border border-red-300 bg-red-50 p-5 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
        role="alert"
      >
        <p>{loadError}</p>
        <Button variant="outline" className="mt-3" onClick={() => void load()}>
          {t('common.retry', { defaultValue: 'Retry' })}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loadError ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          role="alert"
        >
          <span>{loadError}</span>
          <button type="button" onClick={() => void load()} className="font-medium underline">
            {t('common.retry', { defaultValue: 'Retry' })}
          </button>
        </div>
      ) : null}
      {/* Header card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <overallMeta.icon
                className="h-5 w-5"
                style={{ color: overallMeta.dotVar }}
                aria-hidden
              />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('admin.health.title', { defaultValue: 'Health — dowody działania' })}
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t('admin.health.subtitle', {
                defaultValue:
                  'Round-trip probes against our own API and database. Each proves a critical flow still works end-to-end.',
              })}
            </p>
          </div>
          <Button onClick={runAll} disabled={runningAll || !envAllowed} className="shrink-0">
            {runningAll ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {t('admin.health.runAll', { defaultValue: 'Run all' })}
          </Button>
        </div>

        {!envAllowed && (
          <div
            className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--c-warning)', color: 'var(--c-warning)' }}
          >
            <AlertTriangle className="h-4 w-4" />
            {t('admin.health.envDisabled', {
              defaultValue: 'Probes are disabled in this environment (production-safe).',
            })}
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div
              key={s.key}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex items-center gap-2">
                <StatusDot status={s.dot} />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {s.label}
                </span>
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Probe list */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
            {t('admin.health.empty', { defaultValue: 'No probes registered.' })}
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-white/10">
            {results.map((probe) => {
              const meta = STATUS_META[probe.status];
              const Icon = meta.icon;
              const isRunning = runningProbe === probe.probeId || runningAll;
              return (
                <li key={probe.probeId} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <Icon
                        className="mt-0.5 h-5 w-5 shrink-0"
                        style={{ color: meta.dotVar }}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                            {probe.module}
                          </span>
                          <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                            {probe.title}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {probe.description}
                        </p>
                        {probe.status === 'fail' && probe.errorMessage && (
                          <p
                            className="mt-1.5 rounded-md px-2 py-1 text-xs"
                            style={{
                              color: 'var(--c-danger)',
                              backgroundColor:
                                'color-mix(in srgb, var(--c-danger) 8%, transparent)',
                            }}
                          >
                            {probe.errorMessage}
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-400">
                          <span>
                            {t('admin.health.lastRun', { defaultValue: 'Last run' })}:{' '}
                            {formatRanAt(probe.ranAt)}
                          </span>
                          {probe.durationMs != null && <span>{probe.durationMs} ms</span>}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => runOne(probe.probeId)}
                      disabled={isRunning || !envAllowed}
                      className="shrink-0"
                    >
                      {runningProbe === probe.probeId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-1.5 hidden sm:inline">
                        {t('admin.health.rerun', { defaultValue: 'Re-run' })}
                      </span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminHealthPanel;
