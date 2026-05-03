import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { OrganizationContextWorkerOperationsView } from '@/views/admin/OrganizationContextWorkerOperationsView';

vi.mock('@/services/api', () => ({
  Api: {
    getOrganizationContextProcessingJobsAudit: vi.fn(),
    getOrganizationContextProcessingQueueSummary: vi.fn(),
    requeueOrganizationContextProcessingJob: vi.fn(),
    runOrganizationContextWorkerOnce: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('OrganizationContextWorkerOperationsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getOrganizationContextProcessingJobsAudit).mockResolvedValue({
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
    vi.mocked(Api.getOrganizationContextProcessingQueueSummary).mockResolvedValue({
      data: {
        adapter: 'db_ledger_v1',
        configuredBackend: 'external_queue_v1',
        queueBackendReady: true,
        queueBackendReason: null,
        externalQueueName: 'context-documents',
        queueCanEnqueue: true,
        queueCanConsumeLocally: false,
        queueAdapterReason: 'external_queue_consumer_not_implemented',
        schedulerEnabled: true,
        pendingCount: 1,
        blockedCount: 2,
        claimedCount: 1,
        staleClaimedCount: 1,
        oldestClaimedAt: '2026-05-03T09:00:00.000Z',
        deadLetterCount: 1,
        latestDeadLetterAt: '2026-05-03T10:00:00.000Z',
        staleLockMs: 900000,
      },
    });
    vi.mocked(Api.runOrganizationContextWorkerOnce).mockResolvedValue({
      data: { processed: 0, retried: 0, deadLettered: 0, recoveredLocks: 0 },
    });
    vi.mocked(Api.requeueOrganizationContextProcessingJob).mockResolvedValue({
      data: { requeued: true, jobId: 'job-dead', status: 'retry_scheduled' },
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
    expect(screen.getByText('Claimed')).toBeInTheDocument();
    expect(screen.getByText('Stale locks')).toBeInTheDocument();
    expect(screen.getByText('Dead letters')).toBeInTheDocument();
    expect(screen.getByText(/Lease health:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Adapter note: external queue consumer not implemented/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/External queue: context-documents/i)).toBeInTheDocument();
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
    expect(Api.runOrganizationContextWorkerOnce).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation before requeueing a dead-letter job', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<OrganizationContextWorkerOperationsView />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Requeue dead letter/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Requeue dead letter/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(Api.requeueOrganizationContextProcessingJob).not.toHaveBeenCalled();
  });

  it('shows degraded state when worker operations cannot load', async () => {
    vi.mocked(Api.getOrganizationContextProcessingJobsAudit).mockRejectedValue(
      new Error('queue summary down')
    );

    render(<OrganizationContextWorkerOperationsView />);

    await waitFor(() => {
      expect(screen.getByText('Worker operations unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByText('No context processing jobs found.')).not.toBeInTheDocument();
  });
});
