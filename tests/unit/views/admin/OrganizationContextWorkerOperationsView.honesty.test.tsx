import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationContextWorkerApi } from '@/services/api/organizationContextWorker.api';
import { OrganizationContextWorkerOperationsView } from '@/views/admin/OrganizationContextWorkerOperationsView';

vi.mock('@/services/api/organizationContextWorker.api', () => ({
  OrganizationContextWorkerApi: {
    getProcessingJobs: vi.fn(),
    getProcessingQueueSummary: vi.fn(),
    getQueueOutcomeLineage: vi.fn(),
    getWorkerRunHistory: vi.fn(),
    requeueProcessingJob: vi.fn(),
    recoverStaleLocks: vi.fn(),
    runWorkerOnce: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('OrganizationContextWorkerOperationsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(OrganizationContextWorkerApi.getProcessingJobs).mockResolvedValue({
      data: [
        {
          id: 'job-1',
          documentId: 'doc-1',
          status: 'queued',
          attemptCount: 0,
          createdAt: '2026-05-03T10:00:00.000Z',
        },
        {
          id: 'job-dead',
          documentId: 'doc-dead',
          status: 'dead_letter',
          attemptCount: 3,
          errorCode: 'source_file_unavailable',
          createdAt: '2026-05-03T10:05:00.000Z',
        },
      ],
    });
    vi.mocked(OrganizationContextWorkerApi.getProcessingQueueSummary).mockResolvedValue({
      data: {
        adapter: 'db_ledger_v1',
        configuredBackend: 'external_queue_v1',
        queueBackendReady: true,
        queueBackendReason: null,
        externalQueueName: 'context-documents',
        queueCanEnqueue: true,
        queueCanConsumeLocally: false,
        queueAdapterReason: 'external_queue_consumer_not_implemented',
        brokerDeploymentReady: false,
        brokerDeploymentMissing: ['pull_url', 'ack_url', 'backoff_url'],
        asyncCutoverReady: false,
        asyncCutoverBlockers: ['broker_deployment_incomplete', 'dead_letters_present'],
        uploadProcessingMode: 'inline_worker_boundary_v1',
        guardedAsyncUploadReady: false,
        guardedAsyncUploadBlockers: [
          'upload_async_mode_not_requested',
          'upload_async_cutover_flag_disabled',
        ],
        guardedAsyncUploadSwitchPlan: {
          defaultMode: 'inline_worker_boundary_v1',
          cutoverMode: 'async_worker_enqueued_v1',
          requiredEnv: [
            'ORG_CONTEXT_UPLOAD_PROCESSING_MODE=async_worker',
            'ORG_CONTEXT_UPLOAD_ASYNC_CUTOVER_ENABLED=true',
            'ORG_CONTEXT_WORKER_SCHEDULER_ENABLED=true',
          ],
          rollbackEnv: 'ORG_CONTEXT_UPLOAD_PROCESSING_MODE=inline',
        },
        asyncUploadReadBack: {
          processingDocumentCount: 2,
          oldestProcessingDocumentAt: '2026-05-03T09:30:00.000Z',
          queuedJobCount: 1,
          retryScheduledJobCount: 1,
          attentionRequired: false,
        },
        externalWorkerDeploymentVerified: false,
        externalWorkerDeploymentMissing: [
          'external_worker_health_url',
          'external_worker_deployment_verified',
        ],
        externalWorkerDeploymentVerification: {
          mode: 'manual_release_gate_v1',
          healthUrlConfigured: false,
          deploymentMarkerPresent: false,
        },
        externalWorkerHealthProbe: {
          status: 'not_configured',
          checkedAt: null,
          reason: 'external_worker_health_url_missing',
        },
        locatorUpgradePlan: {
          baselineReady: [
            'char_range_chunks',
            'line_range_text_locators',
            'sheet_range_spreadsheet_locators',
          ],
          remaining: ['pdf_page_locators', 'docx_paragraph_locators', 'pptx_slide_locators'],
        },
        schedulerEnabled: true,
        pendingCount: 1,
        blockedCount: 2,
        claimedCount: 1,
        staleClaimedCount: 1,
        oldestClaimedAt: '2026-05-03T09:00:00.000Z',
        deadLetterCount: 1,
        latestDeadLetterAt: '2026-05-03T10:00:00.000Z',
        staleLockMs: 900000,
        leaseDurationMs: 900000,
        generatedAt: '2026-05-03T10:11:00.000Z',
      },
    });
    vi.mocked(OrganizationContextWorkerApi.getQueueOutcomeLineage).mockResolvedValue({
      data: [
        {
          id: 'queue-outcome-1',
          targetType: 'organization_context_worker',
          targetId: 'organization-context',
          workflow: 'organization_context_external_queue',
          eventType: 'external_queue_outcome_attention',
          selectedDocumentIds: ['doc-queue'],
          degraded: true,
          degradedReasons: ['external_queue_ack_url_missing'],
          metadata: {
            pulledMessages: 1,
            ackedMessages: 0,
            backoffMessages: 1,
          },
          createdAt: '2026-05-03T10:10:00.000Z',
        },
      ],
    });
    vi.mocked(OrganizationContextWorkerApi.getWorkerRunHistory).mockResolvedValue({
      data: [
        {
          id: 'audit-run-1',
          runId: 'context-worker-run-history-1',
          auditEventId: 'audit-run-1',
          processed: 2,
          retried: 1,
          deadLettered: 0,
          recoveredLocks: 1,
          claimSkipped: 1,
          pulledMessages: 3,
          ackedMessages: 2,
          backoffMessages: 1,
          queueActionReason: 'external_queue_backoff_messages_present',
          createdAt: '2026-05-03T10:09:00.000Z',
        },
      ],
    });
    vi.mocked(OrganizationContextWorkerApi.runWorkerOnce).mockResolvedValue({
      data: {
        processed: 1,
        retried: 1,
        deadLettered: 0,
        recoveredLocks: 1,
        claimSkipped: 1,
        pulledMessages: 2,
        ackedMessages: 1,
        backoffMessages: 1,
        queueActionReason: 'external_queue_ack_url_missing',
        runId: 'context-worker-run-test',
        auditEventId: 'audit-test',
        auditRecorded: true,
        processedJobs: [{ jobId: 'job-processed', documentId: 'doc-processed' }],
        retriedJobs: [{ jobId: 'job-retried', documentId: 'doc-retried' }],
        deadLetteredJobs: [],
        claimSkippedJobs: [{ jobId: 'job-skipped', documentId: 'doc-skipped' }],
      },
    });
    vi.mocked(OrganizationContextWorkerApi.requeueProcessingJob).mockResolvedValue({
      data: { requeued: true, jobId: 'job-dead', status: 'retry_scheduled' },
    });
    vi.mocked(OrganizationContextWorkerApi.recoverStaleLocks).mockResolvedValue({
      data: { recoveredLocks: 1, staleLockMs: 900000 },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders standalone worker operations without hiding external queue limits', async () => {
    render(<OrganizationContextWorkerOperationsView />);

    await waitFor(() => {
      expect(screen.getByText('Organization Context Worker Operations')).toBeInTheDocument();
    });

    expect(screen.getByText('external_queue_v1')).toBeInTheDocument();
    expect(screen.getByText('Queue readiness')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Enqueue')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Local consume')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Broker deployment')).toBeInTheDocument();
    expect(screen.getByText('Needs setup')).toBeInTheDocument();
    expect(
      screen.getByText(/Broker deployment missing: pull url, ack url, backoff url/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Async cutover')).toBeInTheDocument();
    expect(screen.getByText('Not ready')).toBeInTheDocument();
    expect(
      screen.getByText(/Async cutover blockers: broker deployment incomplete, dead letters present/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Upload execution')).toBeInTheDocument();
    expect(screen.getByText('Inline guarded')).toBeInTheDocument();
    expect(
      screen.getByText(/Guarded upload switch blockers: upload async mode not requested/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Upload cutover plan: set ORG_CONTEXT_UPLOAD_PROCESSING_MODE=async_worker/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Async upload read-back')).toBeInTheDocument();
    expect(screen.getByText('2 processing')).toBeInTheDocument();
    expect(
      screen.getByText(/Async upload status: 2 processing documents, 1 queued jobs, 1 retry scheduled/i)
    ).toBeInTheDocument();
    expect(screen.getByText('External worker')).toBeInTheDocument();
    expect(screen.getByText('Needs verification')).toBeInTheDocument();
    expect(screen.getByText('Worker health')).toBeInTheDocument();
    expect(screen.getByText('not configured')).toBeInTheDocument();
    expect(
      screen.getByText(
        /External worker verification missing: external worker health url, external worker deployment verified/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/External worker verification: manual release gate v1, health URL missing/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/External worker health probe: not configured \(external worker health url missing\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Async upload refresh loop: active/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh async status/i })).toBeInTheDocument();
    expect(screen.getByText(/Locator upgrade: baseline ready char range chunks/i)).toBeInTheDocument();
    expect(screen.getByText(/remaining pdf page locators, docx paragraph locators/i)).toBeInTheDocument();
    expect(screen.getByText('Claimed')).toBeInTheDocument();
    expect(screen.getByText('Stale locks')).toBeInTheDocument();
    expect(screen.getByText('Dead letters')).toBeInTheDocument();
    expect(screen.getByText('Lease duration')).toBeInTheDocument();
    expect(screen.getByText('15 min')).toBeInTheDocument();
    expect(screen.getByText(/Queue summary generated:/i)).toBeInTheDocument();
    expect(screen.getByText(/Lease health:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recover stale locks/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Adapter note: external queue consumer not implemented/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/External queue: context-documents/i)).toBeInTheDocument();
    expect(screen.getByText('Queue outcome audit')).toBeInTheDocument();
    expect(screen.getByText('Worker run history')).toBeInTheDocument();
    expect(screen.getByText('context-worker-run-history-1')).toBeInTheDocument();
    expect(screen.getByText(/2 processed, 1 retried, 0 dead-lettered/i)).toBeInTheDocument();
    expect(screen.getByText(/Queue correlation: 3 pulled, 2 acknowledged, 1 backoff/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Correlation attention: external queue backoff messages present/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All runs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Attention runs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Backoff runs/i })).toBeInTheDocument();
    expect(screen.getByText(/Attention outcomes: 1; backoff messages: 1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^All$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Attention only/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh outcome audit/i })).toBeInTheDocument();
    expect(screen.getByText(/external queue outcome attention/i)).toBeInTheDocument();
    expect(screen.getByText(/1 pulled, 0 acknowledged, 1 backoff/i)).toBeInTheDocument();
    expect(screen.getByText(/Attention: external queue ack url missing/i)).toBeInTheDocument();
    expect(screen.getByText('queued')).toBeInTheDocument();
    expect(screen.getByText('dead letter')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Requeue dead letter/i })).toBeInTheDocument();
  });

  it('requires explicit confirmation before running the worker', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<OrganizationContextWorkerOperationsView />);

    await waitFor(() => {
      expect(screen.getByText('Organization Context Worker Operations')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Run worker once/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(OrganizationContextWorkerApi.runWorkerOnce).not.toHaveBeenCalled();
  });

  it('shows worker run audit and external queue read-back after confirmed execution', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<OrganizationContextWorkerOperationsView />);

    await waitFor(() => {
      expect(screen.getByText('Organization Context Worker Operations')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Run worker once/i }));

    await waitFor(() => {
      expect(screen.getByText(/Last run: 1 processed, 1 retried/i)).toBeInTheDocument();
    });
    expect(screen.getByText('context-worker-run-test')).toBeInTheDocument();
    expect(screen.getByText('audit-test')).toBeInTheDocument();
    expect(screen.getByText(/External queue: 2 pulled, 1 acknowledged, 1 sent to backoff/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Queue action requires attention: external queue ack url missing/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Job outcomes: 1 processed, 1 retried, 0 dead-lettered, 1 skipped/i)).toBeInTheDocument();
  });

  it('refreshes queue outcome audit without running the worker', async () => {
    render(<OrganizationContextWorkerOperationsView />);

    await waitFor(() => {
      expect(screen.getByText('Queue outcome audit')).toBeInTheDocument();
    });
    vi.mocked(OrganizationContextWorkerApi.getQueueOutcomeLineage).mockResolvedValueOnce({
      data: [],
    });
    fireEvent.click(screen.getByRole('button', { name: /Refresh outcome audit/i }));

    await waitFor(() => {
      expect(OrganizationContextWorkerApi.getQueueOutcomeLineage).toHaveBeenCalledTimes(2);
    });
    expect(OrganizationContextWorkerApi.runWorkerOnce).not.toHaveBeenCalled();
    expect(screen.getByText('No external queue outcome audit events found.')).toBeInTheDocument();
  });

  it('refreshes async upload status without running the worker', async () => {
    render(<OrganizationContextWorkerOperationsView />);

    await waitFor(() => {
      expect(screen.getByText('Async upload read-back')).toBeInTheDocument();
    });
    vi.mocked(OrganizationContextWorkerApi.getProcessingJobs).mockResolvedValueOnce({
      data: [],
    });
    vi.mocked(OrganizationContextWorkerApi.getProcessingQueueSummary).mockResolvedValueOnce({
      data: {
        adapter: 'db_ledger_v1',
        pendingCount: 0,
        blockedCount: 0,
        asyncUploadReadBack: {
          processingDocumentCount: 0,
          oldestProcessingDocumentAt: null,
          queuedJobCount: 0,
          retryScheduledJobCount: 0,
          attentionRequired: false,
        },
        externalWorkerHealthProbe: {
          status: 'healthy',
          checkedAt: '2026-05-03T10:12:00.000Z',
          reason: null,
        },
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Refresh async status/i }));

    await waitFor(() => {
      expect(OrganizationContextWorkerApi.getProcessingQueueSummary).toHaveBeenCalledTimes(2);
    });
    expect(OrganizationContextWorkerApi.runWorkerOnce).not.toHaveBeenCalled();
    expect(screen.getByText('0 processing')).toBeInTheDocument();
    expect(screen.getByText(/Async upload refresh loop: idle/i)).toBeInTheDocument();
  });

  it('filters queue outcome audit to attention events without running the worker', async () => {
    render(<OrganizationContextWorkerOperationsView />);

    await waitFor(() => {
      expect(screen.getByText('Queue outcome audit')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Attention only/i }));

    await waitFor(() => {
      expect(OrganizationContextWorkerApi.getQueueOutcomeLineage).toHaveBeenCalledWith({
        limit: 5,
        eventType: 'external_queue_outcome_attention',
      });
    });
    expect(OrganizationContextWorkerApi.runWorkerOnce).not.toHaveBeenCalled();
  });

  it('filters worker run history without running the worker', async () => {
    render(<OrganizationContextWorkerOperationsView />);

    await waitFor(() => {
      expect(screen.getByText('Worker run history')).toBeInTheDocument();
    });
    vi.mocked(OrganizationContextWorkerApi.getWorkerRunHistory).mockResolvedValueOnce({
      data: [],
    });
    fireEvent.click(screen.getByRole('button', { name: /Backoff runs/i }));

    await waitFor(() => {
      expect(OrganizationContextWorkerApi.getWorkerRunHistory).toHaveBeenCalledWith({
        limit: 5,
        outcome: 'backoff',
      });
    });
    expect(OrganizationContextWorkerApi.runWorkerOnce).not.toHaveBeenCalled();
    expect(screen.getByText('No worker runs found for this filter.')).toBeInTheDocument();
  });

  it('requires explicit confirmation before requeueing a dead-letter job', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<OrganizationContextWorkerOperationsView />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Requeue dead letter/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Requeue dead letter/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(OrganizationContextWorkerApi.requeueProcessingJob).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation before recovering stale locks', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<OrganizationContextWorkerOperationsView />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Recover stale locks/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Recover stale locks/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(OrganizationContextWorkerApi.recoverStaleLocks).not.toHaveBeenCalled();
  });

  it('shows degraded state when worker operations cannot load', async () => {
    vi.mocked(OrganizationContextWorkerApi.getProcessingJobs).mockRejectedValue(
      new Error('queue summary down')
    );

    render(<OrganizationContextWorkerOperationsView />);

    await waitFor(() => {
      expect(screen.getByText('Worker operations unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByText('No context processing jobs found.')).not.toBeInTheDocument();
  });
});
