import { PlayCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { DegradedState } from '../../components/Admin/AdminState';
import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { OrganizationContextWorkerOperationsPanel } from './OrganizationContextWorkerOperationsPanel';

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

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString();
}

export function OrganizationContextWorkerOperationsView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ContextProcessingJob[]>([]);
  const [summary, setSummary] = useState<ContextProcessingQueueSummary | null>(null);
  const [lastRunResult, setLastRunResult] = useState<ContextWorkerRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [requeueingJobId, setRequeueingJobId] = useState<string | null>(null);

  const loadWorkerOperations = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const [jobsResponse, summaryResponse] = await Promise.all([
        Api.getOrganizationContextProcessingJobsAudit({ limit: 25 }),
        Api.getOrganizationContextProcessingQueueSummary(),
      ]);
      setJobs(Array.isArray(jobsResponse?.data) ? jobsResponse.data : []);
      setSummary(summaryResponse?.data || null);
    } catch (loadError: unknown) {
      const message = normalizeApiErrorMessage(
        loadError,
        'Organization context worker operations unavailable'
      );
      setError(message);
      setJobs([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkerOperations();
  }, [loadWorkerOperations]);

  const handleRunWorkerOnce = async () => {
    const confirmed = window.confirm(
      'Run the organization context worker once? This will claim queued document processing jobs and write an audit event.'
    );
    if (!confirmed) return;

    setRunning(true);
    try {
      const response = await Api.runOrganizationContextWorkerOnce({ limit: 5 });
      const result = response?.data || {};
      setLastRunResult(result);
      toast.success(
        `Context worker completed: ${Number(result.processed || 0)} processed, ${Number(
          result.retried || 0
        )} retried, ${Number(result.deadLettered || 0)} dead-lettered.`
      );
      await loadWorkerOperations();
    } catch (runError: unknown) {
      toast.error(normalizeApiErrorMessage(runError, 'Context worker run failed'));
    } finally {
      setRunning(false);
    }
  };

  const handleRequeueJob = async (job: ContextProcessingJob) => {
    const confirmed = window.confirm(
      `Requeue dead-letter context processing job ${job.id}? This only schedules another attempt and writes an audit event.`
    );
    if (!confirmed) return;

    setRequeueingJobId(job.id);
    try {
      await Api.requeueOrganizationContextProcessingJob(job.id);
      toast.success('Context processing job requeued.');
      await loadWorkerOperations();
    } catch (requeueError: unknown) {
      toast.error(normalizeApiErrorMessage(requeueError, 'Context processing job requeue failed'));
    } finally {
      setRequeueingJobId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Organization Context Worker Operations
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Monitor document processing jobs, queue readiness, and explicit worker runs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRunWorkerOnce}
            disabled={loading || running}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {running ? <RefreshCw size={14} className="animate-spin" /> : <PlayCircle size={14} />}
            Run worker once
          </button>
          <button
            type="button"
            onClick={loadWorkerOperations}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-navy-600 dark:hover:bg-navy-700"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <DegradedState title="Worker operations unavailable" description={error} />
      ) : loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          <RefreshCw size={16} className="animate-spin" />
          Loading worker operations...
        </div>
      ) : (
        <OrganizationContextWorkerOperationsPanel
          jobs={jobs}
          summary={summary}
          lastRunResult={lastRunResult}
          formatTimestamp={formatTimestamp}
          requeueingJobId={requeueingJobId}
          onRequeueJob={handleRequeueJob}
        />
      )}
    </div>
  );
}

export default OrganizationContextWorkerOperationsView;
