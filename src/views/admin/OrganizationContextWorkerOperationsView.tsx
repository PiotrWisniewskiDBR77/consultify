import { PlayCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { DegradedState } from '../../components/Admin/AdminState';
import {
  OrganizationContextProcessingJob,
  OrganizationContextProcessingQueueSummary,
  OrganizationContextQueueOutcomeEvent,
  OrganizationContextWorkerApi,
  OrganizationContextWorkerRunHistoryEvent,
  OrganizationContextWorkerRunHistoryFilter,
  OrganizationContextWorkerRunResult,
} from '../../services/api/organizationContextWorker.api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { OrganizationContextWorkerOperationsPanel } from './OrganizationContextWorkerOperationsPanel';

type QueueOutcomeFilter = 'all' | 'attention';

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString();
}

export function OrganizationContextWorkerOperationsView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<OrganizationContextProcessingJob[]>([]);
  const [summary, setSummary] = useState<OrganizationContextProcessingQueueSummary | null>(null);
  const [lastRunResult, setLastRunResult] = useState<OrganizationContextWorkerRunResult | null>(
    null
  );
  const [queueOutcomeEvents, setQueueOutcomeEvents] = useState<
    OrganizationContextQueueOutcomeEvent[]
  >([]);
  const [workerRunHistory, setWorkerRunHistory] = useState<
    OrganizationContextWorkerRunHistoryEvent[]
  >([]);
  const [queueOutcomeLastLoadedAt, setQueueOutcomeLastLoadedAt] = useState<string | null>(null);
  const [queueOutcomeFilter, setQueueOutcomeFilter] = useState<QueueOutcomeFilter>('all');
  const [workerRunHistoryFilter, setWorkerRunHistoryFilter] =
    useState<OrganizationContextWorkerRunHistoryFilter>('all');
  const [refreshingQueueOutcomeEvents, setRefreshingQueueOutcomeEvents] = useState(false);
  const [refreshingAsyncUploadStatus, setRefreshingAsyncUploadStatus] = useState(false);
  const [asyncUploadStatusLastRefreshedAt, setAsyncUploadStatusLastRefreshedAt] = useState<
    string | null
  >(null);
  const [running, setRunning] = useState(false);
  const [requeueingJobId, setRequeueingJobId] = useState<string | null>(null);
  const [recoveringStaleLocks, setRecoveringStaleLocks] = useState(false);

  const loadWorkerOperations = useCallback(
    async (
      filter: QueueOutcomeFilter = 'all',
      runFilter: OrganizationContextWorkerRunHistoryFilter = 'all'
    ) => {
      setLoading(true);
      try {
        setError(null);
        const [jobsResponse, summaryResponse, queueOutcomeResponse, runHistoryResponse] =
          await Promise.all([
            OrganizationContextWorkerApi.getProcessingJobs({ limit: 25 }),
            OrganizationContextWorkerApi.getProcessingQueueSummary(),
            OrganizationContextWorkerApi.getQueueOutcomeLineage({
              limit: 5,
              eventType: filter === 'attention' ? 'external_queue_outcome_attention' : undefined,
            }),
            OrganizationContextWorkerApi.getWorkerRunHistory({ limit: 5, outcome: runFilter }),
          ]);
        setJobs(Array.isArray(jobsResponse?.data) ? jobsResponse.data : []);
        setSummary(summaryResponse?.data || null);
        setQueueOutcomeEvents(
          Array.isArray(queueOutcomeResponse?.data) ? queueOutcomeResponse.data : []
        );
        setWorkerRunHistory(Array.isArray(runHistoryResponse?.data) ? runHistoryResponse.data : []);
        setQueueOutcomeLastLoadedAt(new Date().toISOString());
      } catch (loadError: unknown) {
        const message = normalizeApiErrorMessage(
          loadError,
          'Organization context worker operations unavailable'
        );
        setError(message);
        setJobs([]);
        setSummary(null);
        setQueueOutcomeEvents([]);
        setWorkerRunHistory([]);
        setQueueOutcomeLastLoadedAt(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const refreshQueueOutcomeEvents = useCallback(
    async (filter: QueueOutcomeFilter = queueOutcomeFilter) => {
      setRefreshingQueueOutcomeEvents(true);
      try {
        const response = await OrganizationContextWorkerApi.getQueueOutcomeLineage({
          limit: 5,
          eventType: filter === 'attention' ? 'external_queue_outcome_attention' : undefined,
        });
        setQueueOutcomeEvents(Array.isArray(response?.data) ? response.data : []);
        setQueueOutcomeLastLoadedAt(new Date().toISOString());
      } catch (refreshError: unknown) {
        toast.error(normalizeApiErrorMessage(refreshError, 'Queue outcome audit refresh failed'));
      } finally {
        setRefreshingQueueOutcomeEvents(false);
      }
    },
    [queueOutcomeFilter]
  );

  const handleQueueOutcomeFilterChange = useCallback(
    async (filter: QueueOutcomeFilter) => {
      setQueueOutcomeFilter(filter);
      await refreshQueueOutcomeEvents(filter);
    },
    [refreshQueueOutcomeEvents]
  );

  const handleWorkerRunHistoryFilterChange = useCallback(
    async (filter: OrganizationContextWorkerRunHistoryFilter) => {
      setWorkerRunHistoryFilter(filter);
      try {
        const response = await OrganizationContextWorkerApi.getWorkerRunHistory({
          limit: 5,
          outcome: filter,
        });
        setWorkerRunHistory(Array.isArray(response?.data) ? response.data : []);
      } catch (historyError: unknown) {
        toast.error(normalizeApiErrorMessage(historyError, 'Worker run history refresh failed'));
      }
    },
    []
  );

  const refreshAsyncUploadStatus = useCallback(async () => {
    setRefreshingAsyncUploadStatus(true);
    try {
      const [jobsResponse, summaryResponse] = await Promise.all([
        OrganizationContextWorkerApi.getProcessingJobs({ limit: 25 }),
        OrganizationContextWorkerApi.getProcessingQueueSummary(),
      ]);
      setJobs(Array.isArray(jobsResponse?.data) ? jobsResponse.data : []);
      setSummary(summaryResponse?.data || null);
      setAsyncUploadStatusLastRefreshedAt(new Date().toISOString());
    } catch (refreshError: unknown) {
      toast.error(normalizeApiErrorMessage(refreshError, 'Async upload status refresh failed'));
    } finally {
      setRefreshingAsyncUploadStatus(false);
    }
  }, []);

  useEffect(() => {
    loadWorkerOperations('all');
  }, [loadWorkerOperations]);

  useEffect(() => {
    const processingCount = Number(summary?.asyncUploadReadBack?.processingDocumentCount || 0);
    if (processingCount <= 0) return undefined;
    const intervalId = window.setInterval(() => {
      void refreshAsyncUploadStatus();
    }, 15_000);
    return () => window.clearInterval(intervalId);
  }, [refreshAsyncUploadStatus, summary?.asyncUploadReadBack?.processingDocumentCount]);

  const handleRunWorkerOnce = async () => {
    const confirmed = window.confirm(
      'Run the organization context worker once? This will claim queued document processing jobs and write an audit event.'
    );
    if (!confirmed) return;

    setRunning(true);
    try {
      const response = await OrganizationContextWorkerApi.runWorkerOnce({ limit: 5 });
      const result = response?.data || {};
      setLastRunResult(result);
      toast.success(
        `Context worker completed: ${Number(result.processed || 0)} processed, ${Number(
          result.retried || 0
        )} retried, ${Number(result.deadLettered || 0)} dead-lettered.`
      );
      await loadWorkerOperations(queueOutcomeFilter, workerRunHistoryFilter);
    } catch (runError: unknown) {
      toast.error(normalizeApiErrorMessage(runError, 'Context worker run failed'));
    } finally {
      setRunning(false);
    }
  };

  const handleRequeueJob = async (job: OrganizationContextProcessingJob) => {
    const confirmed = window.confirm(
      `Requeue dead-letter context processing job ${job.id}? This only schedules another attempt and writes an audit event.`
    );
    if (!confirmed) return;

    setRequeueingJobId(job.id);
    try {
      await OrganizationContextWorkerApi.requeueProcessingJob(job.id);
      toast.success('Context processing job requeued.');
      await loadWorkerOperations(queueOutcomeFilter, workerRunHistoryFilter);
    } catch (requeueError: unknown) {
      toast.error(normalizeApiErrorMessage(requeueError, 'Context processing job requeue failed'));
    } finally {
      setRequeueingJobId(null);
    }
  };

  const handleRecoverStaleLocks = async () => {
    const confirmed = window.confirm(
      'Recover stale organization context worker locks? This moves stale claimed jobs back to retry scheduled and writes an audit event.'
    );
    if (!confirmed) return;

    setRecoveringStaleLocks(true);
    try {
      const response = await OrganizationContextWorkerApi.recoverStaleLocks({
        staleLockMs: summary?.staleLockMs,
      });
      const recoveredLocks = Number(response?.data?.recoveredLocks || 0);
      toast.success(`Recovered ${recoveredLocks} stale context worker locks.`);
      await loadWorkerOperations(queueOutcomeFilter, workerRunHistoryFilter);
    } catch (recoverError: unknown) {
      toast.error(normalizeApiErrorMessage(recoverError, 'Stale lock recovery failed'));
    } finally {
      setRecoveringStaleLocks(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-c-border-subtle dark:bg-white/5">
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
            className="flex items-center gap-2 rounded-lg bg-c-text text-c-bg px-3 py-2 text-sm font-medium hover:bg-c-text-secondary disabled:opacity-50"
          >
            {running ? <RefreshCw size={14} className="animate-spin" /> : <PlayCircle size={14} />}
            Run worker once
          </button>
          <button
            type="button"
            onClick={() => loadWorkerOperations(queueOutcomeFilter, workerRunHistoryFilter)}
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
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-4 text-sm text-slate-500 dark:border-c-border-subtle dark:text-slate-400">
          <RefreshCw size={16} className="animate-spin" />
          Loading worker operations...
        </div>
      ) : (
        <OrganizationContextWorkerOperationsPanel
          jobs={jobs}
          summary={summary}
          lastRunResult={lastRunResult}
          queueOutcomeEvents={queueOutcomeEvents}
          workerRunHistory={workerRunHistory}
          queueOutcomeLastLoadedAt={queueOutcomeLastLoadedAt}
          refreshingQueueOutcomeEvents={refreshingQueueOutcomeEvents}
          refreshingAsyncUploadStatus={refreshingAsyncUploadStatus}
          asyncUploadStatusLastRefreshedAt={asyncUploadStatusLastRefreshedAt}
          queueOutcomeFilter={queueOutcomeFilter}
          onQueueOutcomeFilterChange={handleQueueOutcomeFilterChange}
          onRefreshQueueOutcomeEvents={refreshQueueOutcomeEvents}
          onRefreshAsyncUploadStatus={refreshAsyncUploadStatus}
          workerRunHistoryFilter={workerRunHistoryFilter}
          onWorkerRunHistoryFilterChange={handleWorkerRunHistoryFilterChange}
          formatTimestamp={formatTimestamp}
          requeueingJobId={requeueingJobId}
          onRequeueJob={handleRequeueJob}
          recoveringStaleLocks={recoveringStaleLocks}
          onRecoverStaleLocks={handleRecoverStaleLocks}
        />
      )}
    </div>
  );
}

export default OrganizationContextWorkerOperationsView;
