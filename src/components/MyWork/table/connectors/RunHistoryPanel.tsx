import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Connector, ConnectorRun } from './useConnectors';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface RunHistoryPanelProps {
  connector: Connector;
  onBack: () => void;
  /** Query options returned by useConnectors().useRunHistory(id) */
  runHistoryQueryOpts: {
    queryKey: readonly unknown[];
    queryFn: () => Promise<ConnectorRun[]>;
    enabled: boolean;
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const RunHistoryPanel: React.FC<RunHistoryPanelProps> = ({
  connector,
  onBack,
  runHistoryQueryOpts,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const { data: runs = [], isLoading } = useQuery<ConnectorRun[]>(runHistoryQueryOpts);

  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  /* ---- Stats ---- */
  const stats = useMemo(() => {
    const total = runs.length;
    const successes = runs.filter((r) => r.status === 'success').length;
    const totalImported = runs.reduce((sum, r) => sum + (r.recordsImported ?? 0), 0);
    const successRate = total > 0 ? Math.round((successes / total) * 100) : 0;
    return { total, successes, totalImported, successRate };
  }, [runs]);

  const formatDuration = (ms?: number) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const formatTime = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(isPl ? 'pl-PL' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const statusIcon = (status: ConnectorRun['status']) => {
    switch (status) {
      case 'success':
        return <Check size={14} className="text-c-success" />;
      case 'failed':
        return <AlertTriangle size={14} className="text-danger-500" />;
      case 'running':
        return <Loader2 size={14} className="animate-spin text-c-info" />;
    }
  };

  const statusLabel = (status: ConnectorRun['status']) => {
    const labels: Record<string, [string, string]> = {
      success: ['Sukces', 'Success'],
      failed: ['Błąd', 'Failed'],
      running: ['W toku', 'Running'],
    };
    const [pl, en] = labels[status] ?? ['—', '—'];
    return isPl ? pl : en;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-c-text-secondary hover:text-c-text-muted hover:bg-c-surface-raised transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {isPl ? 'Historia uruchomień' : 'Run History'}
          </h3>
          <p className="text-xs text-c-text-muted">{connector.name}</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label={isPl ? 'Uruchomienia' : 'Total runs'} value={String(stats.total)} />
        <StatCard
          label={isPl ? 'Sukces' : 'Success rate'}
          value={`${stats.successRate}%`}
          accent={stats.successRate >= 80 ? 'green' : stats.successRate >= 50 ? 'yellow' : 'red'}
        />
        <StatCard
          label={isPl ? 'Zaimportowane' : 'Imported'}
          value={stats.totalImported.toLocaleString()}
        />
        <StatCard label={isPl ? 'Udane' : 'Successes'} value={String(stats.successes)} />
      </div>

      {/* Run list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-c-text-secondary" />
        </div>
      ) : runs.length === 0 ? (
        <p className="text-center text-sm text-c-text-muted py-8">
          {isPl ? 'Brak uruchomień' : 'No runs yet'}
        </p>
      ) : (
        <div className="rounded-xl border border-c-border-subtle overflow-hidden divide-y divide-c-border-subtle">
          {runs.map((run) => {
            const isExpanded = expandedRun === run.id;
            return (
              <div key={run.id}>
                <button
                  onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                  className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-c-surface-raised transition-colors"
                >
                  {statusIcon(run.status)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-c-text-muted">
                        {statusLabel(run.status)}
                      </span>
                      <span className="text-[11px] text-c-text-muted">
                        {formatTime(run.startedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-c-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={10} />
                        {formatDuration(run.durationMs)}
                      </span>
                      <span>
                        {run.recordsImported}/{run.recordsFetched}{' '}
                        {isPl ? 'zaimportowanych' : 'imported'}
                      </span>
                      {run.recordsSkipped > 0 && (
                        <span className="text-c-warning">
                          {run.recordsSkipped} {isPl ? 'pominiętych' : 'skipped'}
                        </span>
                      )}
                      {run.recordsFailed > 0 && (
                        <span className="text-danger-500">
                          {run.recordsFailed} {isPl ? 'błędnych' : 'failed'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Running progress */}
                  {run.status === 'running' && (
                    <div className="w-20">
                      <div className="h-1.5 rounded-full bg-c-surface-raised overflow-hidden">
                        <div
                          className="h-full rounded-full bg-c-info animate-pulse"
                          style={{
                            width: run.recordsFetched
                              ? `${Math.min(100, Math.round((run.recordsImported / run.recordsFetched) * 100))}%`
                              : '30%',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {run.error &&
                    (isExpanded ? (
                      <ChevronDown size={14} className="text-c-text-secondary" />
                    ) : (
                      <ChevronRight size={14} className="text-c-text-secondary" />
                    ))}
                </button>

                {/* Expanded error details */}
                {isExpanded && run.error && (
                  <div className="px-4 pb-3">
                    <div className="rounded-lg bg-danger-50 dark:bg-danger-500/10 border border-danger-200 dark:border-danger-500/20 p-3">
                      <p className="text-xs font-medium text-danger-700 dark:text-danger-400 mb-1">
                        {isPl ? 'Szczegóły błędu' : 'Error details'}
                      </p>
                      <pre className="text-[11px] text-danger-600 dark:text-danger-300 whitespace-pre-wrap font-mono leading-relaxed">
                        {run.error}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Stat card                                                          */
/* ------------------------------------------------------------------ */

const StatCard: React.FC<{
  label: string;
  value: string;
  accent?: 'green' | 'yellow' | 'red';
}> = ({ label, value, accent }) => {
  const accentCls =
    accent === 'green'
      ? 'text-c-success'
      : accent === 'yellow'
        ? 'text-c-warning'
        : accent === 'red'
          ? 'text-danger-600 dark:text-danger-400'
          : 'text-c-text';

  return (
    <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-2.5 text-center">
      <p className="text-[10px] font-medium text-c-text-muted uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className={`text-lg font-bold ${accentCls}`}>{value}</p>
    </div>
  );
};

export default RunHistoryPanel;
