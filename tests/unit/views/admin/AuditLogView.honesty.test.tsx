import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { AuditLogView } from '@/views/admin/AuditLogView';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    getTenantAdminAuditLogs: vi.fn(),
    getOrganizationContextLineageAudit: vi.fn(),
    getOrganizationContextStorageAudit: vi.fn(),
    getOrganizationContextProcessingJobsAudit: vi.fn(),
    getOrganizationContextProcessingQueueSummary: vi.fn(),
    runOrganizationContextWorkerOnce: vi.fn(),
    exportTenantAdminAuditLogs: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('AuditLogView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getTenantAdminAuditLogs).mockRejectedValue(new Error('Audit API down'));
    vi.mocked(Api.getOrganizationContextLineageAudit).mockResolvedValue({ data: [] });
    vi.mocked(Api.getOrganizationContextStorageAudit).mockResolvedValue({ data: [] });
    vi.mocked(Api.getOrganizationContextProcessingJobsAudit).mockResolvedValue({ data: [] });
    vi.mocked(Api.getOrganizationContextProcessingQueueSummary).mockResolvedValue({
      data: {
        adapter: 'db_ledger_v1',
        configuredBackend: 'db_ledger_v1',
        queueBackendReady: true,
        queueBackendReason: null,
        queueCanEnqueue: true,
        queueCanConsumeLocally: true,
        queueAdapterReason: null,
        schedulerEnabled: false,
        statusCounts: {},
        pendingCount: 0,
        blockedCount: 0,
        generatedAt: '2026-05-03T10:00:00.000Z',
      },
    });
    vi.mocked(Api.runOrganizationContextWorkerOnce).mockResolvedValue({
      data: { processed: 0, retried: 0, deadLettered: 0, recoveredLocks: 0, errors: [] },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render failed audit log loads as no activity found or exportable data', async () => {
    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Audit logs unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Audit activity unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No Activity Found')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeDisabled();
    expect(screen.getByPlaceholderText('Search logs...')).toBeDisabled();
    screen.getAllByRole('combobox').forEach((combobox) => {
      expect(combobox).toBeDisabled();
    });
  });

  it('loads tenant admin audit logs through the P32 audit endpoint', async () => {
    vi.mocked(Api.getTenantAdminAuditLogs).mockResolvedValue({
      logs: [
        {
          id: 'log-1',
          admin_id: 'admin-1',
          action_type: 'update_security_policy',
          metadata_json: JSON.stringify({
            orgId: 'org-1',
            adminName: 'Admin User',
            adminEmail: 'admin@example.com',
            resource: 'Security',
            resourceName: 'MFA policy',
          }),
          ip_address: '127.0.0.1',
          created_at: '2026-04-26T10:00:00.000Z',
        },
      ],
      total: 1,
    });

    render(<AuditLogView />);

    await waitFor(() => {
      expect(Api.getTenantAdminAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100, offset: 0 })
      );
    });
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('SECURITY')).toBeInTheDocument();
    expect(screen.getByText(/MFA policy/)).toBeInTheDocument();
    expect(screen.queryByText('Audit logs unavailable')).not.toBeInTheDocument();
  });

  it('renders organization context lineage and storage audit surfaces', async () => {
    vi.mocked(Api.getTenantAdminAuditLogs).mockResolvedValue({ logs: [], total: 0 });
    vi.mocked(Api.getOrganizationContextLineageAudit).mockResolvedValue({
      data: [
        {
          id: 'lineage-1',
          targetId: 'insight-1',
          eventType: 'interview_insight_completed',
          selectedDocumentIds: ['doc-1'],
          usedChunks: [{ chunkId: 'chunk-1' }],
          degraded: false,
          createdAt: '2026-05-03T10:00:00.000Z',
        },
      ],
    });
    vi.mocked(Api.getOrganizationContextStorageAudit).mockResolvedValue({
      data: [
        {
          id: 'storage-1',
          documentId: 'doc-1',
          bytesDelta: 2048,
          eventType: 'context_document_uploaded',
          sourceUpload: 'documents.library',
          createdAt: '2026-05-03T10:00:00.000Z',
        },
      ],
    });
    vi.mocked(Api.getOrganizationContextProcessingJobsAudit).mockResolvedValue({
      data: [
        {
          id: 'job-1',
          documentId: 'doc-1',
          status: 'retry_scheduled',
          attemptCount: 1,
          lockedBy: 'organization-context-worker',
          errorCode: 'source_file_unavailable',
          createdAt: '2026-05-03T10:00:00.000Z',
        },
      ],
    });
    vi.mocked(Api.getOrganizationContextProcessingQueueSummary).mockResolvedValue({
      data: {
        adapter: 'db_ledger_v1',
        configuredBackend: 'db_ledger_v1',
        queueBackendReady: true,
        queueBackendReason: null,
        queueCanEnqueue: true,
        queueCanConsumeLocally: true,
        queueAdapterReason: null,
        schedulerEnabled: false,
        statusCounts: { queued: 2, dead_letter: 1 },
        pendingCount: 2,
        blockedCount: 1,
        generatedAt: '2026-05-03T10:00:00.000Z',
      },
    });

    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Organization Context Audit')).toBeInTheDocument();
    });
    expect(screen.getByText('AI Lineage Events')).toBeInTheDocument();
    expect(screen.getByText('Storage Events')).toBeInTheDocument();
    expect(screen.getByText('Processing Jobs')).toBeInTheDocument();
    expect(screen.getByText('db_ledger_v1')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
    expect(screen.getByText('Scheduler')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
    expect(screen.getByText('Queue readiness')).toBeInTheDocument();
    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0);
    expect(screen.getByText('Enqueue')).toBeInTheDocument();
    expect(screen.getByText('Local consume')).toBeInTheDocument();
    expect(screen.getByText('interview insight completed')).toBeInTheDocument();
    expect(screen.getByText(/Insight:/)).toBeInTheDocument();
    expect(screen.getByText('context document uploaded')).toBeInTheDocument();
    expect(screen.getByText(/2.0 KB/)).toBeInTheDocument();
    expect(screen.getByText('retry scheduled')).toBeInTheDocument();
    expect(screen.getByText(/Locked by organization-context-worker/)).toBeInTheDocument();
  });

  it('requires browser confirmation before running organization context worker once', async () => {
    vi.mocked(Api.getTenantAdminAuditLogs).mockResolvedValue({ logs: [], total: 0 });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Organization Context Audit')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Run worker once/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(Api.runOrganizationContextWorkerOnce).not.toHaveBeenCalled();
  });

  it('runs organization context worker after explicit confirmation and refreshes audit data', async () => {
    vi.mocked(Api.getTenantAdminAuditLogs).mockResolvedValue({ logs: [], total: 0 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(Api.runOrganizationContextWorkerOnce).mockResolvedValue({
      data: { processed: 1, retried: 0, deadLettered: 0, recoveredLocks: 1, errors: [] },
    });

    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Organization Context Audit')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Run worker once/i }));

    await waitFor(() => {
      expect(Api.runOrganizationContextWorkerOnce).toHaveBeenCalledWith({ limit: 5 });
    });
    expect(Api.getOrganizationContextProcessingJobsAudit).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Last run: 1 processed/)).toBeInTheDocument();
  });

  it('shows degraded state when organization context audit cannot load', async () => {
    vi.mocked(Api.getTenantAdminAuditLogs).mockResolvedValue({ logs: [], total: 0 });
    vi.mocked(Api.getOrganizationContextLineageAudit).mockRejectedValue(
      new Error('Context audit API down')
    );

    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Organization context audit unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByText('No context lineage events found.')).not.toBeInTheDocument();
  });

  it('shows external queue configuration gaps without fake readiness', async () => {
    vi.mocked(Api.getTenantAdminAuditLogs).mockResolvedValue({ logs: [], total: 0 });
    vi.mocked(Api.getOrganizationContextProcessingQueueSummary).mockResolvedValue({
      data: {
        adapter: 'db_ledger_v1',
        configuredBackend: 'external_queue_unconfigured',
        queueBackendReady: false,
        queueBackendReason: 'external_queue_url_missing',
        externalQueueName: 'organization-context',
        queueCanEnqueue: false,
        queueCanConsumeLocally: false,
        queueAdapterReason: 'external_queue_url_missing',
        schedulerEnabled: true,
        statusCounts: {},
        pendingCount: 0,
        blockedCount: 0,
        generatedAt: '2026-05-03T10:00:00.000Z',
      },
    });

    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Configuration needed')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Queue backend is not ready: external queue url missing/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/External queue: organization-context/i)).toBeInTheDocument();
  });

  it('renders invalid audit timestamps as unknown dates instead of Invalid Date', async () => {
    vi.mocked(Api.getTenantAdminAuditLogs).mockResolvedValue({
      logs: [
        {
          id: 'log-invalid-date',
          admin_id: 'admin-1',
          action_type: 'export_audit_logs',
          metadata_json: JSON.stringify({
            adminName: 'Admin User',
            adminEmail: 'admin@example.com',
            resource: 'Audit',
            resourceName: 'CSV export',
          }),
          ip_address: '127.0.0.1',
          created_at: 'not-a-date',
        },
      ],
      total: 1,
    });

    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Unknown date')).toBeInTheDocument();
    });

    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
  });
});
