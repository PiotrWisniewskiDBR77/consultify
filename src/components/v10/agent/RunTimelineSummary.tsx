import { Activity, AlertTriangle, CheckCircle2, Clock3, PauseCircle, Timer } from 'lucide-react';

import {
  type AgentRunTimelineSummary as AgentRunTimelineSummaryModel,
  formatRunStatusLabel,
  isLongRunningRunStatus,
} from '@/models/agent/AgentScheduleSurfaceV1';

interface RunTimelineSummaryProps {
  readonly timeline: AgentRunTimelineSummaryModel | null | undefined;
  readonly isLoading?: boolean;
}

function StatusIcon({ status }: { status: AgentRunTimelineSummaryModel['latestStatus'] }) {
  if (status === 'failed' || status === 'cancelled') {
    return <AlertTriangle size={15} className="text-rose-500" />;
  }

  if (status === 'succeeded') {
    return <CheckCircle2 size={15} className="text-emerald-500" />;
  }

  if (status === 'paused') {
    return <PauseCircle size={15} className="text-amber-500" />;
  }

  if (status === 'pending' || status === 'running') {
    return <Timer size={15} className="text-sky-500" />;
  }

  return <Activity size={15} className="text-slate-400" />;
}

export function RunTimelineSummary({ timeline, isLoading = false }: RunTimelineSummaryProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        Loading run timeline...
      </div>
    );
  }

  if (!timeline) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        No run timeline available yet.
      </div>
    );
  }

  const latestEntry = timeline.entries[0];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
          <StatusIcon status={timeline.latestStatus} />
          <span>{formatRunStatusLabel(timeline.latestStatus)}</span>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          queued {timeline.queuedCount}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-slate-50 px-2.5 py-2 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          <div className="opacity-70">Active</div>
          <div className="mt-1 text-sm font-semibold">
            {timeline.totals.running + timeline.totals.pending + timeline.totals.paused}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 px-2.5 py-2 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          <div className="opacity-70">Succeeded</div>
          <div className="mt-1 text-sm font-semibold">{timeline.totals.succeeded}</div>
        </div>
        <div className="rounded-xl bg-slate-50 px-2.5 py-2 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          <div className="opacity-70">Failed</div>
          <div className="mt-1 text-sm font-semibold">{timeline.totals.failed}</div>
        </div>
      </div>

      {latestEntry && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
            <Clock3 size={13} />
            {latestEntry.note}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Started {new Date(latestEntry.startedAt).toLocaleString()}
            {latestEntry.durationMs !== null ? ` · ${latestEntry.durationMs} ms` : ''}
          </div>
          {isLongRunningRunStatus(latestEntry.status) && (
            <div className="mt-1 text-[11px] text-sky-600 dark:text-sky-300">
              Operator attention: this run is still active.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RunTimelineSummary;
