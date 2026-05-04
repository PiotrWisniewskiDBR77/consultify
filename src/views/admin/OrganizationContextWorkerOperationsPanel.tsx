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
  brokerDeploymentReady?: boolean;
  brokerDeploymentMissing?: string[];
  schedulerEnabled?: boolean;
  pendingCount: number;
  blockedCount: number;
  claimedCount?: number;
  staleClaimedCount?: number;
  oldestClaimedAt?: string | null;
  deadLetterCount?: number;
  latestDeadLetterAt?: string | null;
  staleLockMs?: number;
  leaseDurationMs?: number;
  asyncCutoverReady?: boolean;
  asyncCutoverBlockers?: string[];
  uploadProcessingMode?: 'inline_worker_boundary_v1' | 'async_worker_enqueued_v1';
  guardedAsyncUploadReady?: boolean;
  guardedAsyncUploadBlockers?: string[];
  guardedAsyncUploadSwitchPlan?: {
    defaultMode: 'inline_worker_boundary_v1';
    cutoverMode: 'async_worker_enqueued_v1';
    requiredEnv: string[];
    rollbackEnv: string;
  };
  asyncUploadReadBack?: {
    processingDocumentCount: number;
    oldestProcessingDocumentAt: string | null;
    queuedJobCount: number;
    retryScheduledJobCount: number;
    attentionRequired: boolean;
  };
  externalWorkerDeploymentVerified?: boolean;
  externalWorkerDeploymentMissing?: string[];
  externalWorkerDeploymentVerification?: {
    mode: 'not_required' | 'manual_release_gate_v1';
    healthUrlConfigured: boolean;
    deploymentMarkerPresent: boolean;
  };
  externalWorkerHealthProbe?: {
    status: 'not_required' | 'not_configured' | 'not_checked' | 'healthy' | 'unhealthy';
    checkedAt: string | null;
    reason: string | null;
  };
  locatorUpgradePlan?: {
    baselineReady: string[];
    remaining: string[];
  };
  generatedAt?: string;
};

type ContextWorkerRunResult = {
  processed?: number;
  retried?: number;
  deadLettered?: number;
  recoveredLocks?: number;
  claimSkipped?: number;
  pulledMessages?: number;
  ackedMessages?: number;
  backoffMessages?: number;
  queueActionReason?: string | null;
  runId?: string | null;
  auditEventId?: string | null;
  auditRecorded?: boolean;
  processedJobs?: Array<{ jobId: string; documentId: string }>;
  retriedJobs?: Array<{ jobId: string; documentId: string }>;
  deadLetteredJobs?: Array<{ jobId: string; documentId: string }>;
  claimSkippedJobs?: Array<{ jobId: string; documentId: string }>;
};

type ContextQueueOutcomeEvent = {
  id: string;
  targetId: string;
  eventType: string;
  degraded: boolean;
  degradedReasons: string[];
  metadata: {
    pulledMessages?: number;
    ackedMessages?: number;
    backoffMessages?: number;
    queueActionReason?: string | null;
    processed?: number;
    retried?: number;
    deadLettered?: number;
    claimSkipped?: number;
    [key: string]: unknown;
  };
  createdAt: string;
};

type ContextWorkerRunHistoryEvent = {
  id: string;
  runId: string;
  auditEventId: string;
  processed: number;
  retried: number;
  deadLettered: number;
  recoveredLocks: number;
  claimSkipped: number;
  pulledMessages?: number;
  ackedMessages?: number;
  backoffMessages?: number;
  queueActionReason?: string | null;
  createdAt: string;
};

type QueueOutcomeFilter = 'all' | 'attention';
type WorkerRunHistoryFilter = 'all' | 'attention' | 'backoff';

interface OrganizationContextWorkerOperationsPanelProps {
  jobs: ContextProcessingJob[];
  summary: ContextProcessingQueueSummary | null;
  lastRunResult: ContextWorkerRunResult | null;
  queueOutcomeEvents?: ContextQueueOutcomeEvent[];
  workerRunHistory?: ContextWorkerRunHistoryEvent[];
  formatTimestamp: (timestamp: string) => string;
  requeueingJobId?: string | null;
  onRequeueJob?: (job: ContextProcessingJob) => void;
  recoveringStaleLocks?: boolean;
  onRecoverStaleLocks?: () => void;
  refreshingQueueOutcomeEvents?: boolean;
  refreshingAsyncUploadStatus?: boolean;
  asyncUploadStatusLastRefreshedAt?: string | null;
  queueOutcomeLastLoadedAt?: string | null;
  queueOutcomeFilter?: QueueOutcomeFilter;
  onQueueOutcomeFilterChange?: (filter: QueueOutcomeFilter) => void;
  onRefreshQueueOutcomeEvents?: () => void;
  onRefreshAsyncUploadStatus?: () => void;
  workerRunHistoryFilter?: WorkerRunHistoryFilter;
  onWorkerRunHistoryFilterChange?: (filter: WorkerRunHistoryFilter) => void;
}

export function OrganizationContextWorkerOperationsPanel({
  jobs,
  summary,
  lastRunResult,
  queueOutcomeEvents = [],
  workerRunHistory = [],
  formatTimestamp,
  requeueingJobId,
  onRequeueJob,
  recoveringStaleLocks,
  onRecoverStaleLocks,
  refreshingQueueOutcomeEvents,
  refreshingAsyncUploadStatus,
  asyncUploadStatusLastRefreshedAt,
  queueOutcomeLastLoadedAt,
  queueOutcomeFilter = 'all',
  onQueueOutcomeFilterChange,
  onRefreshQueueOutcomeEvents,
  onRefreshAsyncUploadStatus,
  workerRunHistoryFilter = 'all',
  onWorkerRunHistoryFilterChange,
}: OrganizationContextWorkerOperationsPanelProps) {
  const configuredBackend = summary?.configuredBackend || summary?.adapter || 'unknown';
  const queueReady = summary?.queueBackendReady !== false;
  const attentionOutcomeCount = queueOutcomeEvents.filter(
    (event) =>
      event.degraded ||
      event.eventType.includes('attention') ||
      event.degradedReasons.length > 0 ||
      Number(event.metadata?.backoffMessages || 0) > 0
  ).length;
  const attentionBackoffCount = queueOutcomeEvents.reduce(
    (total, event) => total + Number(event.metadata?.backoffMessages || 0),
    0
  );

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
                  ? 'text-lg font-semibold text-rose-700'
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
            <p className="text-slate-500 dark:text-slate-400">Lease duration</p>
            <p className="font-semibold text-slate-900 dark:text-white">
              {Math.round(Number(summary.leaseDurationMs || 0) / 60000) || 0} min
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
          <div className="rounded bg-slate-50 dark:bg-navy-900 p-2">
            <p className="text-slate-500 dark:text-slate-400">Broker deployment</p>
            <p
              className={
                summary.brokerDeploymentReady === false
                  ? 'font-semibold text-amber-700'
                  : 'font-semibold text-green-700'
              }
            >
              {summary.brokerDeploymentReady === false ? 'Needs setup' : 'Ready'}
            </p>
          </div>
          <div className="rounded bg-slate-50 dark:bg-navy-900 p-2">
            <p className="text-slate-500 dark:text-slate-400">Async cutover</p>
            <p
              className={
                summary.asyncCutoverReady
                  ? 'font-semibold text-green-700'
                  : 'font-semibold text-amber-700'
              }
            >
              {summary.asyncCutoverReady ? 'Ready' : 'Not ready'}
            </p>
          </div>
          <div className="rounded bg-slate-50 dark:bg-navy-900 p-2">
            <p className="text-slate-500 dark:text-slate-400">Upload execution</p>
            <p
              className={
                summary.guardedAsyncUploadReady
                  ? 'font-semibold text-green-700'
                  : 'font-semibold text-slate-900 dark:text-white'
              }
            >
              {summary.uploadProcessingMode === 'async_worker_enqueued_v1'
                ? 'Async guarded'
                : 'Inline guarded'}
            </p>
          </div>
          <div className="rounded bg-slate-50 dark:bg-navy-900 p-2">
            <p className="text-slate-500 dark:text-slate-400">Async upload read-back</p>
            <p
              className={
                summary.asyncUploadReadBack?.attentionRequired
                  ? 'font-semibold text-amber-700'
                  : 'font-semibold text-slate-900 dark:text-white'
              }
            >
              {Number(summary.asyncUploadReadBack?.processingDocumentCount || 0)} processing
            </p>
          </div>
          <div className="rounded bg-slate-50 dark:bg-navy-900 p-2">
            <p className="text-slate-500 dark:text-slate-400">External worker</p>
            <p
              className={
                summary.externalWorkerDeploymentVerified === false
                  ? 'font-semibold text-amber-700'
                  : 'font-semibold text-green-700'
              }
            >
              {summary.externalWorkerDeploymentVerified === false
                ? 'Needs verification'
                : 'Verified'}
            </p>
          </div>
          <div className="rounded bg-slate-50 dark:bg-navy-900 p-2">
            <p className="text-slate-500 dark:text-slate-400">Worker health</p>
            <p
              className={
                summary.externalWorkerHealthProbe?.status === 'healthy'
                  ? 'font-semibold text-green-700'
                  : summary.externalWorkerHealthProbe?.status === 'unhealthy'
                    ? 'font-semibold text-rose-700'
                    : 'font-semibold text-amber-700'
              }
            >
              {(summary.externalWorkerHealthProbe?.status || 'not_checked').replaceAll('_', ' ')}
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
          {summary.brokerDeploymentMissing && summary.brokerDeploymentMissing.length > 0 && (
            <p className="col-span-2 rounded bg-amber-50 p-2 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              Broker deployment missing:{' '}
              {summary.brokerDeploymentMissing.map((item) => item.replaceAll('_', ' ')).join(', ')}.
            </p>
          )}
          {summary.asyncCutoverBlockers && summary.asyncCutoverBlockers.length > 0 && (
            <p className="col-span-2 rounded bg-amber-50 p-2 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              Async cutover blockers:{' '}
              {summary.asyncCutoverBlockers.map((item) => item.replaceAll('_', ' ')).join(', ')}.
            </p>
          )}
          {summary.guardedAsyncUploadBlockers && summary.guardedAsyncUploadBlockers.length > 0 && (
            <p className="col-span-2 rounded bg-slate-50 p-2 text-slate-600 dark:bg-navy-900 dark:text-slate-300">
              Guarded upload switch blockers:{' '}
              {summary.guardedAsyncUploadBlockers
                .map((item) => item.replaceAll('_', ' '))
                .join(', ')}
              .
            </p>
          )}
          {summary.guardedAsyncUploadSwitchPlan && (
            <p className="col-span-2 rounded bg-slate-50 p-2 text-slate-600 dark:bg-navy-900 dark:text-slate-300">
              Upload cutover plan: set {summary.guardedAsyncUploadSwitchPlan.requiredEnv.join(', ')}
              ; rollback with {summary.guardedAsyncUploadSwitchPlan.rollbackEnv}.
            </p>
          )}
          {summary.asyncUploadReadBack && (
            <p
              className={
                summary.asyncUploadReadBack.attentionRequired
                  ? 'col-span-2 rounded bg-amber-50 p-2 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200'
                  : 'col-span-2 rounded bg-slate-50 p-2 text-slate-600 dark:bg-navy-900 dark:text-slate-300'
              }
            >
              Async upload status: {summary.asyncUploadReadBack.processingDocumentCount} processing
              documents, {summary.asyncUploadReadBack.queuedJobCount} queued jobs,{' '}
              {summary.asyncUploadReadBack.retryScheduledJobCount} retry scheduled
              {summary.asyncUploadReadBack.oldestProcessingDocumentAt
                ? `, oldest processing ${formatTimestamp(
                    summary.asyncUploadReadBack.oldestProcessingDocumentAt
                  )}`
                : ''}
              .
            </p>
          )}
          {summary.asyncUploadReadBack && onRefreshAsyncUploadStatus && (
            <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 p-2 text-slate-600 dark:bg-navy-900 dark:text-slate-300">
              <span>
                Async upload refresh loop:{' '}
                {summary.asyncUploadReadBack.processingDocumentCount > 0 ? 'active' : 'idle'}
                {asyncUploadStatusLastRefreshedAt
                  ? ` · refreshed ${formatTimestamp(asyncUploadStatusLastRefreshedAt)}`
                  : ''}
              </span>
              <button
                type="button"
                onClick={onRefreshAsyncUploadStatus}
                disabled={refreshingAsyncUploadStatus}
                className="rounded-lg border border-slate-200 px-2 py-1 font-medium text-slate-600 hover:bg-white disabled:opacity-50 dark:border-navy-600 dark:text-slate-300 dark:hover:bg-navy-700"
              >
                {refreshingAsyncUploadStatus ? 'Refreshing status...' : 'Refresh async status'}
              </button>
            </div>
          )}
          {summary.externalWorkerDeploymentMissing &&
            summary.externalWorkerDeploymentMissing.length > 0 && (
              <p className="col-span-2 rounded bg-amber-50 p-2 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                External worker verification missing:{' '}
                {summary.externalWorkerDeploymentMissing
                  .map((item) => item.replaceAll('_', ' '))
                  .join(', ')}
                .
              </p>
            )}
          {summary.externalWorkerDeploymentVerification && (
            <p className="col-span-2 rounded bg-slate-50 p-2 text-slate-600 dark:bg-navy-900 dark:text-slate-300">
              External worker verification:{' '}
              {summary.externalWorkerDeploymentVerification.mode.replaceAll('_', ' ')}, health URL{' '}
              {summary.externalWorkerDeploymentVerification.healthUrlConfigured
                ? 'configured'
                : 'missing'}
              , deployment marker{' '}
              {summary.externalWorkerDeploymentVerification.deploymentMarkerPresent
                ? 'present'
                : 'missing'}
              .
            </p>
          )}
          {summary.externalWorkerHealthProbe && (
            <p
              className={
                summary.externalWorkerHealthProbe.status === 'unhealthy'
                  ? 'col-span-2 rounded bg-rose-50 p-2 text-rose-800 dark:bg-rose-900/20 dark:text-rose-200'
                  : 'col-span-2 rounded bg-slate-50 p-2 text-slate-600 dark:bg-navy-900 dark:text-slate-300'
              }
            >
              External worker health probe:{' '}
              {summary.externalWorkerHealthProbe.status.replaceAll('_', ' ')}
              {summary.externalWorkerHealthProbe.checkedAt
                ? ` at ${formatTimestamp(summary.externalWorkerHealthProbe.checkedAt)}`
                : ''}
              {summary.externalWorkerHealthProbe.reason
                ? ` (${summary.externalWorkerHealthProbe.reason.replaceAll('_', ' ')})`
                : ''}
              .
            </p>
          )}
          {summary.locatorUpgradePlan && (
            <p className="col-span-2 rounded bg-slate-50 p-2 text-slate-600 dark:bg-navy-900 dark:text-slate-300">
              Locator upgrade: baseline ready{' '}
              {summary.locatorUpgradePlan.baselineReady
                .map((item) => item.replaceAll('_', ' '))
                .join(', ')}
              ; remaining{' '}
              {summary.locatorUpgradePlan.remaining
                .map((item) => item.replaceAll('_', ' '))
                .join(', ')}
              .
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
          {summary.generatedAt && (
            <p className="col-span-2 text-slate-500 dark:text-slate-400">
              Queue summary generated: {formatTimestamp(summary.generatedAt)}
            </p>
          )}
          {Number(summary.staleClaimedCount || 0) > 0 && onRecoverStaleLocks && (
            <button
              type="button"
              onClick={onRecoverStaleLocks}
              disabled={recoveringStaleLocks}
              className="col-span-2 rounded-lg border border-amber-200 px-3 py-2 text-left text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-500/30 dark:text-amber-200 dark:hover:bg-amber-900/20"
            >
              {recoveringStaleLocks ? 'Recovering stale locks...' : 'Recover stale locks'}
            </button>
          )}
        </div>
      )}

      {lastRunResult && (
        <div className="space-y-2 border-b border-slate-200 p-3 text-xs text-slate-600 dark:border-navy-700 dark:text-slate-300">
          <p>
            Last run: {Number(lastRunResult.processed || 0)} processed,{' '}
            {Number(lastRunResult.retried || 0)} retried, {Number(lastRunResult.deadLettered || 0)}{' '}
            dead-lettered, {Number(lastRunResult.recoveredLocks || 0)} recovered locks,{' '}
            {Number(lastRunResult.claimSkipped || 0)} skipped claims.
          </p>
          {(lastRunResult.runId || lastRunResult.auditEventId) && (
            <p>
              Run evidence:{' '}
              {lastRunResult.runId ? (
                <span className="font-mono">{lastRunResult.runId}</span>
              ) : null}
              {lastRunResult.auditEventId ? (
                <>
                  {' '}
                  · Audit event <span className="font-mono">{lastRunResult.auditEventId}</span>
                </>
              ) : null}
              {lastRunResult.auditRecorded === false ? ' · audit event not recorded' : ''}
            </p>
          )}
          {(lastRunResult.pulledMessages !== undefined ||
            lastRunResult.ackedMessages !== undefined ||
            lastRunResult.backoffMessages !== undefined) && (
            <p>
              External queue: {Number(lastRunResult.pulledMessages || 0)} pulled,{' '}
              {Number(lastRunResult.ackedMessages || 0)} acknowledged,{' '}
              {Number(lastRunResult.backoffMessages || 0)} sent to backoff.
            </p>
          )}
          {lastRunResult.queueActionReason && (
            <p className="rounded bg-amber-50 p-2 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              Queue action requires attention:{' '}
              {lastRunResult.queueActionReason.replaceAll('_', ' ')}.
            </p>
          )}
          {(lastRunResult.processedJobs?.length ||
            lastRunResult.retriedJobs?.length ||
            lastRunResult.deadLetteredJobs?.length ||
            lastRunResult.claimSkippedJobs?.length) && (
            <p>
              Job outcomes: {lastRunResult.processedJobs?.length || 0} processed,{' '}
              {lastRunResult.retriedJobs?.length || 0} retried,{' '}
              {lastRunResult.deadLetteredJobs?.length || 0} dead-lettered,{' '}
              {lastRunResult.claimSkippedJobs?.length || 0} skipped.
            </p>
          )}
        </div>
      )}

      {(workerRunHistory.length > 0 || onWorkerRunHistoryFilterChange) && (
        <div className="border-b border-slate-200 p-3 text-xs dark:border-navy-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-slate-700 dark:text-slate-200">Worker run history</p>
            {onWorkerRunHistoryFilterChange && (
              <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-navy-600">
                {(['all', 'attention', 'backoff'] as WorkerRunHistoryFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => onWorkerRunHistoryFilterChange(filter)}
                    className={
                      workerRunHistoryFilter === filter
                        ? 'rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-800 dark:bg-navy-700 dark:text-slate-100'
                        : 'rounded-md px-2 py-1 text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-navy-700'
                    }
                  >
                    {filter === 'all'
                      ? 'All runs'
                      : filter === 'attention'
                        ? 'Attention runs'
                        : 'Backoff runs'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-2 space-y-2">
            {workerRunHistory.length === 0 ? (
              <p className="rounded bg-slate-50 p-2 text-slate-500 dark:bg-navy-900 dark:text-slate-400">
                No worker runs found for this filter.
              </p>
            ) : (
              workerRunHistory.map((run) => (
                <div
                  key={run.id}
                  className="rounded bg-slate-50 p-2 text-slate-600 dark:bg-navy-900 dark:text-slate-300"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono">{run.runId}</span>
                    <span>{formatTimestamp(run.createdAt)}</span>
                  </div>
                  <p className="mt-1">
                    {Number(run.processed || 0)} processed, {Number(run.retried || 0)} retried,{' '}
                    {Number(run.deadLettered || 0)} dead-lettered, {Number(run.recoveredLocks || 0)}{' '}
                    recovered locks, {Number(run.claimSkipped || 0)} skipped claims.
                  </p>
                  {run.auditEventId && (
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      Audit event: <span className="font-mono">{run.auditEventId}</span>
                    </p>
                  )}
                  {(run.pulledMessages !== undefined ||
                    run.ackedMessages !== undefined ||
                    run.backoffMessages !== undefined) && (
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      Queue correlation: {Number(run.pulledMessages || 0)} pulled,{' '}
                      {Number(run.ackedMessages || 0)} acknowledged,{' '}
                      {Number(run.backoffMessages || 0)} backoff.
                    </p>
                  )}
                  {run.queueActionReason && (
                    <p className="mt-1 rounded bg-amber-50 p-2 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                      Correlation attention: {run.queueActionReason.replaceAll('_', ' ')}.
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {(queueOutcomeEvents.length > 0 || onRefreshQueueOutcomeEvents) && (
        <div className="border-b border-slate-200 p-3 text-xs dark:border-navy-700">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-200">Queue outcome audit</p>
              <p
                className={
                  attentionOutcomeCount > 0
                    ? 'text-amber-700 dark:text-amber-200'
                    : 'text-slate-500 dark:text-slate-400'
                }
              >
                Attention outcomes: {attentionOutcomeCount}; backoff messages:{' '}
                {attentionBackoffCount}
              </p>
              {queueOutcomeLastLoadedAt && (
                <p className="text-slate-500 dark:text-slate-400">
                  Refreshed {formatTimestamp(queueOutcomeLastLoadedAt)}
                </p>
              )}
            </div>
            {onRefreshQueueOutcomeEvents && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {onQueueOutcomeFilterChange && (
                  <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-navy-600">
                    <button
                      type="button"
                      onClick={() => onQueueOutcomeFilterChange('all')}
                      disabled={refreshingQueueOutcomeEvents}
                      className={
                        queueOutcomeFilter === 'all'
                          ? 'rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-800 disabled:opacity-50 dark:bg-navy-700 dark:text-slate-100'
                          : 'rounded-md px-2 py-1 text-slate-500 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-navy-700'
                      }
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => onQueueOutcomeFilterChange('attention')}
                      disabled={refreshingQueueOutcomeEvents}
                      className={
                        queueOutcomeFilter === 'attention'
                          ? 'rounded-md bg-amber-100 px-2 py-1 font-medium text-amber-800 disabled:opacity-50 dark:bg-amber-900/30 dark:text-amber-100'
                          : 'rounded-md px-2 py-1 text-slate-500 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-navy-700'
                      }
                    >
                      Attention only
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={onRefreshQueueOutcomeEvents}
                  disabled={refreshingQueueOutcomeEvents}
                  className="rounded-lg border border-slate-200 px-2 py-1 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-navy-600 dark:text-slate-300 dark:hover:bg-navy-700"
                >
                  {refreshingQueueOutcomeEvents ? 'Refreshing audit...' : 'Refresh outcome audit'}
                </button>
              </div>
            )}
          </div>
          <div className="mt-2 space-y-2">
            {queueOutcomeEvents.length === 0 ? (
              <p className="rounded bg-slate-50 p-2 text-slate-500 dark:bg-navy-900 dark:text-slate-400">
                No external queue outcome audit events found.
              </p>
            ) : (
              queueOutcomeEvents.map((event) => (
                <div
                  key={event.id}
                  className={
                    event.degraded
                      ? 'rounded bg-amber-50 p-2 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200'
                      : 'rounded bg-slate-50 p-2 text-slate-600 dark:bg-navy-900 dark:text-slate-300'
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{event.eventType.replaceAll('_', ' ')}</span>
                    <span>{formatTimestamp(event.createdAt)}</span>
                  </div>
                  <p className="mt-1">
                    Queue: <span className="font-mono">{event.targetId}</span>
                  </p>
                  <p className="mt-1">
                    {Number(event.metadata?.pulledMessages || 0)} pulled,{' '}
                    {Number(event.metadata?.ackedMessages || 0)} acknowledged,{' '}
                    {Number(event.metadata?.backoffMessages || 0)} backoff.
                  </p>
                  {event.degradedReasons.length > 0 && (
                    <p className="mt-1">
                      Attention:{' '}
                      {event.degradedReasons
                        .map((reason) => reason.replaceAll('_', ' '))
                        .join(', ')}
                      .
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
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
