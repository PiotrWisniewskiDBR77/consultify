import { RefreshCw } from 'lucide-react';

type ContextProcessingJob = {
  id: string;
  documentId: string;
  status: string;
  attemptCount: number;
  errorCode?: string | null;
  lockedBy?: string | null;
  createdAt: string;
};

type ContextProcessingQueueSummary = {
  adapter: string;
  configuredBackend?: string;
  queueBackendReady?: boolean;
  queueBackendReason?: string | null;
  externalQueueName?: string | null;
  queueCanEnqueue?: boolean;
  queueCanConsumeLocally?: boolean;
  queueAdapterReason?: string | null;
  schedulerEnabled?: boolean;
  pendingCount: number;
  blockedCount: number;
  claimedCount?: number;
  staleClaimedCount?: number;
  oldestClaimedAt?: string | null;
  deadLetterCount?: number;
  latestDeadLetterAt?: string | null;
  staleLockMs?: number;
};

type ContextWorkerRunResult = {
  processed?: number;
  retried?: number;
  deadLettered?: number;
  recoveredLocks?: number;
};

interface OrganizationContextWorkerOperationsPanelProps {
  jobs: ContextProcessingJob[];
  summary: ContextProcessingQueueSummary | null;
  lastRunResult: ContextWorkerRunResult | null;
  formatTimestamp: (timestamp: string) => string;
  requeueingJobId?: string | null;
  onRequeueJob?: (job: ContextProcessingJob) => void;
}

export function OrganizationContextWorkerOperationsPanel({
  jobs,
  summary,
  lastRunResult,
  formatTimestamp,
  requeueingJobId,
  onRequeueJob,
}: OrganizationContextWorkerOperationsPanelProps) {
  const configuredBackend = summary?.configuredBackend || summary?.adapter || 'unknown';
  const queueReady = summary?.queueBackendReady !== false;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-navy-700 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <RefreshCw size={14} />
            Processing Jobs
          </p>
          {summary && (
            <span className="text-xs text-slate-500 dark:text-slate-400">{configuredBackend}</span>
          )}
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 dark:border-navy-700 p-3 text-xs">
          <div className="rounded bg-slate-50 dark:bg-navy-900 p-2">
            <p className="text-slate-500 dark:text-slate-400">Pending</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {summary.pendingCount}
            </p>
          </div>
          <div className="rounded bg-slate-50 dark:bg-navy-900 p-2">
            <p className="text-slate-500 dark:text-slate-400">Needs attention</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {summary.blockedCount}
            </p>
          </div>
          <div className="rounded bg-slate-50 dark:bg-navy-900 p-2">
            <p className="text-slate-500 dark:text-slate-400">Claimed</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {Number(summary.claimedCount || 0)}
            </p>
          </div>
          <div className="rounded bg-slate-50 dark:bg-navy-900 p-2">
            <p className="text-slate-500 dark:text-slate-400">Stale locks</p>
            <p
              className={
                Number(summary.staleClaimedCount || 0) > 0
                  ? 'text-lg font-semibold text-amber-700'
                  : 'text-lg font-semibold text-slate-900 dark:text-white'
              }
            >
              {Number(summary.staleClaimedCount || 0)}
            </p>
          </div>
          <div className="rounded bg-slate-50 dark:bg-navy-900 p-2">
            <p className="text-slate-500 dark:text-slate-400">Dead letters</p>
            <p
              className={
                Number(summary.deadLetterCount || 0) > 0
                  ? 'text-lg font-semibold text-red-700'
                  : 'text-lg font-semibold text-slate-900 dark:text-white'
              }
            >
              {Number(summary.deadLetterCount || 0)}
            </p>
          </div>
          <div className="rounded bg-slate-50 dark:bg-navy-900 p-2">
            <p className="text-slate-500 dark:text-slate-400">Scheduler</p>
            <p className="font-semibold text-slate-900 dark:text-white">
              {summary.schedulerEnabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
          <div className="rounded bg-slate-50 dark:bg-navy-900 p-2">
            <p className="text-slate-500 dark:text-slate-400">Queue readiness</p>
            <p
              className={
                queueReady ? 'font-semibold text-green-700' : 'font-semibold text-amber-700'
              }
            >
              {queueReady ? 'Ready' : 'Configuration needed'}
            </p>
          </div>
          <div className="rounded bg-slate-50 dark:bg-navy-900 p-2">
            <p className="text-slate-500 dark:text-slate-400">Enqueue</p>
            <p className="font-semibold text-slate-900 dark:text-white">
              {summary.queueCanEnqueue === false ? 'Unavailable' : 'Available'}
            </p>
          </div>
          <div className="rounded bg-slate-50 dark:bg-navy-900 p-2">
            <p className="text-slate-500 dark:text-slate-400">Local consume</p>
            <p className="font-semibold text-slate-900 dark:text-white">
              {summary.queueCanConsumeLocally === false ? 'Unavailable' : 'Available'}
            </p>
          </div>
          {!queueReady && summary.queueBackendReason && (
            <p className="col-span-2 rounded bg-amber-50 dark:bg-amber-900/20 p-2 text-amber-800 dark:text-amber-200">
              Queue backend is not ready: {summary.queueBackendReason.replaceAll('_', ' ')}.
            </p>
          )}
          {summary.queueAdapterReason && (
            <p className="col-span-2 rounded bg-slate-50 dark:bg-navy-900 p-2 text-slate-600 dark:text-slate-300">
              Adapter note: {summary.queueAdapterReason.replaceAll('_', ' ')}.
            </p>
          )}
          {(summary.oldestClaimedAt || summary.latestDeadLetterAt) && (
            <p className="col-span-2 rounded bg-slate-50 dark:bg-navy-900 p-2 text-slate-600 dark:text-slate-300">
              Lease health:{' '}
              {summary.oldestClaimedAt
                ? `oldest claim ${formatTimestamp(summary.oldestClaimedAt)}`
                : 'no claimed jobs'}
              {summary.latestDeadLetterAt
                ? ` · latest dead letter ${formatTimestamp(summary.latestDeadLetterAt)}`
                : ''}
            </p>
          )}
          {summary.externalQueueName && (
            <p className="col-span-2 text-slate-500 dark:text-slate-400">
              External queue: {summary.externalQueueName}
            </p>
          )}
        </div>
      )}

      {lastRunResult && (
        <p className="border-b border-slate-200 dark:border-navy-700 p-3 text-xs text-slate-600 dark:text-slate-300">
          Last run: {Number(lastRunResult.processed || 0)} processed,{' '}
          {Number(lastRunResult.retried || 0)} retried, {Number(lastRunResult.deadLettered || 0)}{' '}
          dead-lettered, {Number(lastRunResult.recoveredLocks || 0)} recovered locks.
        </p>
      )}

      {jobs.length === 0 ? (
        <p className="p-3 text-sm text-slate-500 dark:text-slate-400">
          No context processing jobs found.
        </p>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-navy-700">
          {jobs.map((job) => (
            <div key={job.id} className="p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-900 dark:text-white">
                  {job.status.replaceAll('_', ' ')}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatTimestamp(job.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-slate-600 dark:text-slate-300">
                Document: <span className="font-mono">{job.documentId}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Attempts: {job.attemptCount}
                {job.lockedBy ? ` · Locked by ${job.lockedBy}` : ''}
                {job.errorCode ? ` · ${job.errorCode}` : ''}
              </p>
              {job.status === 'dead_letter' && onRequeueJob && (
                <button
                  type="button"
                  onClick={() => onRequeueJob(job)}
                  disabled={requeueingJobId === job.id}
                  className="mt-2 rounded-lg border border-amber-200 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-500/30 dark:text-amber-200 dark:hover:bg-amber-900/20"
                >
                  {requeueingJobId === job.id ? 'Requeueing...' : 'Requeue dead letter'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
