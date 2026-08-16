import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

const dbMocks = vi.hoisted(() => ({
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
  processQueuedContextDocumentJobs: vi.fn(),
  getContextProcessingQueueSummary: vi.fn(),
  requeueDeadLetterContextProcessingJob: vi.fn(),
  recoverStaleContextProcessingLocksForAdmin: vi.fn(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: dbMocks.dbAll,
  get: dbMocks.dbGet,
  run: dbMocks.dbRun,
}));

vi.mock('../../../server/src/services/organizationContext/ContextDocumentService.js', () => ({
  default: {
    processQueuedContextDocumentJobs: dbMocks.processQueuedContextDocumentJobs,
    getContextProcessingQueueSummary: dbMocks.getContextProcessingQueueSummary,
    requeueDeadLetterContextProcessingJob: dbMocks.requeueDeadLetterContextProcessingJob,
    recoverStaleContextProcessingLocksForAdmin: dbMocks.recoverStaleContextProcessingLocksForAdmin,
  },
}));

vi.mock('../../../server/src/services/organizationService.js', () => ({
  normalizeOrganizationRole: (role: string) => String(role || '').toUpperCase(),
}));

describe('Audit log organization context read surfaces', () => {
  const prevEnv = { ...process.env };
  let router: any;

  const mount = () =>
    makeTestApp({
      mountPath: '/api/audit-logs',
      router,
      beforeMount: (app) => {
        app.use((req, _res, next) => {
          (req as any).user = {
            id: 'admin-1',
            organizationId: 'org-1',
            role: 'admin',
            isSuperAdmin: false,
          };
          (req as any).userId = 'admin-1';
          (req as any).organizationId = 'org-1';
          (req as any).userRole = 'admin';
          next();
        });
      },
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    vi.resetModules();
    router = (await import('../../../server/src/routes/auditLog.routes.ts')).default;
  });

  beforeEach(() => {
    dbMocks.dbAll.mockReset();
    dbMocks.dbRun.mockReset().mockResolvedValue({ success: true, changes: 1 });
    dbMocks.processQueuedContextDocumentJobs.mockReset().mockResolvedValue({
      processed: 0,
      retried: 0,
      deadLettered: 0,
      recoveredLocks: 0,
      errors: [],
    });
    dbMocks.getContextProcessingQueueSummary.mockReset().mockResolvedValue({
      adapter: 'db_ledger_v1',
      statusCounts: {},
      pendingCount: 0,
      blockedCount: 0,
      claimedCount: 0,
      staleClaimedCount: 0,
      deadLetterCount: 0,
      generatedAt: '2026-05-03T10:00:00.000Z',
    });
    dbMocks.requeueDeadLetterContextProcessingJob.mockReset().mockResolvedValue({
      requeued: true,
      jobId: 'job-dead',
      documentId: 'doc-dead',
      previousStatus: 'dead_letter',
      status: 'retry_scheduled',
    });
    dbMocks.recoverStaleContextProcessingLocksForAdmin.mockReset().mockResolvedValue({
      recoveredLocks: 1,
      staleBefore: '2026-05-03T09:45:00.000Z',
      staleLockMs: 900000,
    });
    dbMocks.dbGet.mockReset().mockResolvedValue({ role: 'ADMIN' });
  });

  afterAll(() => {
    process.env = prevEnv;
  });

  it('reads org-scoped context lineage events for admins', async () => {
    dbMocks.dbAll.mockResolvedValueOnce([
      {
        id: 'lineage-1',
        user_id: 'user-1',
        target_type: 'interview_insight',
        target_id: 'insight-1',
        workflow: 'interview_insight_creator',
        event_type: 'interview_insight_completed',
        requested_document_ids_json: JSON.stringify(['doc-1']),
        selected_document_ids_json: JSON.stringify(['doc-1']),
        used_chunks_json: JSON.stringify([{ documentId: 'doc-1', chunkId: 'chunk-1' }]),
        degraded: 0,
        degraded_reasons_json: JSON.stringify([]),
        metadata_json: JSON.stringify({ tokensUsed: 123 }),
        created_at: '2026-05-03T10:00:00.000Z',
      },
    ]);

    const res = await request(mount()).get(
      '/api/audit-logs/organization-context/lineage?targetId=insight-1&limit=10'
    );

    expect(res.status).toBe(200);
    expect(dbMocks.dbAll).toHaveBeenCalledWith(
      expect.stringContaining('organization_context_lineage_events'),
      ['test-org-id', 'insight-1', 10],
      expect.any(Object)
    );
    expect(res.body).toEqual(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            id: 'lineage-1',
            targetId: 'insight-1',
            selectedDocumentIds: ['doc-1'],
            usedChunks: [{ documentId: 'doc-1', chunkId: 'chunk-1' }],
            metadata: { tokensUsed: 123 },
          }),
        ],
        meta: expect.objectContaining({
          contract: 'organization_context_lineage_audit_read_v1',
        }),
      })
    );
  });

  it('filters organization context lineage by target type and workflow for queue outcomes', async () => {
    dbMocks.dbAll.mockResolvedValueOnce([
      {
        id: 'queue-lineage-1',
        user_id: null,
        target_type: 'organization_context_worker',
        target_id: 'organization-context',
        workflow: 'organization_context_external_queue',
        event_type: 'external_queue_outcome_attention',
        requested_document_ids_json: JSON.stringify(['doc-queue']),
        selected_document_ids_json: JSON.stringify(['doc-queue']),
        used_chunks_json: JSON.stringify([]),
        degraded: 1,
        degraded_reasons_json: JSON.stringify(['external_queue_ack_url_missing']),
        metadata_json: JSON.stringify({ pulledMessages: 1, ackedMessages: 0 }),
        created_at: '2026-05-03T10:00:00.000Z',
      },
    ]);

    const res = await request(mount()).get(
      '/api/audit-logs/organization-context/lineage?targetType=organization_context_worker&workflow=organization_context_external_queue&limit=5'
    );

    expect(res.status).toBe(200);
    expect(dbMocks.dbAll).toHaveBeenCalledWith(
      expect.stringContaining('target_type = ?'),
      [
        'test-org-id',
        'organization_context_worker',
        'organization_context_external_queue',
        5,
      ],
      expect.any(Object)
    );
    expect(res.body).toEqual(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            id: 'queue-lineage-1',
            targetType: 'organization_context_worker',
            workflow: 'organization_context_external_queue',
            degradedReasons: ['external_queue_ack_url_missing'],
            metadata: { pulledMessages: 1, ackedMessages: 0 },
          }),
        ],
        meta: expect.objectContaining({
          filters: expect.objectContaining({
            targetType: 'organization_context_worker',
            workflow: 'organization_context_external_queue',
          }),
        }),
      })
    );
  });

  it('reads org-scoped context storage events for admins', async () => {
    dbMocks.dbAll.mockResolvedValueOnce([
      {
        id: 'storage-1',
        user_id: 'user-1',
        document_id: 'doc-1',
        project_id: 'project-1',
        scope: 'project',
        bytes_delta: 2048,
        event_type: 'context_document_uploaded',
        source_upload: 'documents.library',
        metadata_json: JSON.stringify({ filename: 'strategy.pdf' }),
        created_at: '2026-05-03T10:00:00.000Z',
      },
    ]);

    const res = await request(mount()).get(
      '/api/audit-logs/organization-context/storage-events?documentId=doc-1&limit=10'
    );

    expect(res.status).toBe(200);
    expect(dbMocks.dbAll).toHaveBeenCalledWith(
      expect.stringContaining('organization_context_storage_events'),
      ['test-org-id', 'doc-1', 10],
      expect.any(Object)
    );
    expect(res.body).toEqual(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            id: 'storage-1',
            documentId: 'doc-1',
            projectId: 'project-1',
            bytesDelta: 2048,
            metadata: { filename: 'strategy.pdf' },
          }),
        ],
        meta: expect.objectContaining({
          contract: 'organization_context_storage_audit_read_v1',
        }),
      })
    );
  });

  it('reads org-scoped context processing jobs for admins', async () => {
    dbMocks.dbAll.mockResolvedValueOnce([
      {
        id: 'job-1',
        user_id: 'user-1',
        document_id: 'doc-1',
        project_id: 'project-1',
        scope: 'project',
        pipeline_type: 'document_text_extraction',
        status: 'retry_scheduled',
        attempt_count: 1,
        processor_version: 'context-document-pipeline-v1',
        source_upload: 'documents.library',
        error_code: 'source_file_unavailable',
        error_message_safe: 'source_file_unavailable',
        metadata_json: JSON.stringify({ retryPolicy: 'max_attempts_3' }),
        locked_at: '2026-05-03T10:00:00.000Z',
        locked_by: 'organization-context-worker',
        started_at: '2026-05-03T10:00:00.000Z',
        finished_at: null,
        created_at: '2026-05-03T10:00:00.000Z',
        updated_at: '2026-05-03T10:01:00.000Z',
      },
    ]);

    const res = await request(mount()).get(
      '/api/audit-logs/organization-context/processing-jobs?status=retry_scheduled&limit=10'
    );

    expect(res.status).toBe(200);
    expect(dbMocks.dbAll).toHaveBeenCalledWith(
      expect.stringContaining('organization_context_processing_jobs'),
      ['test-org-id', 'retry_scheduled', 10],
      expect.any(Object)
    );
    expect(res.body).toEqual(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            id: 'job-1',
            documentId: 'doc-1',
            status: 'retry_scheduled',
            attemptCount: 1,
            lockedBy: 'organization-context-worker',
            metadata: { retryPolicy: 'max_attempts_3' },
          }),
        ],
        meta: expect.objectContaining({
          contract: 'organization_context_processing_jobs_read_v1',
        }),
      })
    );
  });

  it('reads org-scoped context processing queue summary for admins', async () => {
    const summary = {
      adapter: 'db_ledger_v1',
      statusCounts: { queued: 2, retry_scheduled: 1, dead_letter: 1 },
      pendingCount: 3,
      blockedCount: 1,
      claimedCount: 0,
      staleClaimedCount: 0,
      deadLetterCount: 1,
      generatedAt: '2026-05-03T10:00:00.000Z',
    };
    dbMocks.getContextProcessingQueueSummary.mockResolvedValueOnce(summary);

    const res = await request(mount()).get(
      '/api/audit-logs/organization-context/processing-jobs/summary'
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        data: summary,
        meta: expect.objectContaining({
          contract: 'organization_context_processing_queue_summary_v1',
        }),
      })
    );
    expect(dbMocks.getContextProcessingQueueSummary).toHaveBeenCalledWith({
      organizationId: 'test-org-id',
    });
  });

  it('requires explicit confirmation before running context worker', async () => {
    const res = await request(mount())
      .post('/api/audit-logs/organization-context/processing-jobs/run-worker')
      .send({ limit: 2 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        code: 'CONFIRMATION_REQUIRED',
      })
    );
    expect(dbMocks.processQueuedContextDocumentJobs).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation before requeueing a dead-letter context job', async () => {
    const res = await request(mount())
      .post('/api/audit-logs/organization-context/processing-jobs/job-dead/requeue')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        code: 'CONFIRMATION_REQUIRED',
      })
    );
    expect(dbMocks.requeueDeadLetterContextProcessingJob).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation before recovering stale context locks', async () => {
    const res = await request(mount())
      .post('/api/audit-logs/organization-context/processing-jobs/recover-stale-locks')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        code: 'CONFIRMATION_REQUIRED',
      })
    );
    expect(dbMocks.recoverStaleContextProcessingLocksForAdmin).not.toHaveBeenCalled();
  });

  it('recovers stale context locks for confirmed admin action and audits it', async () => {
    const res = await request(mount())
      .post('/api/audit-logs/organization-context/processing-jobs/recover-stale-locks')
      .send({ confirmation: 'recover_context_stale_locks', staleLockMs: 900000 });

    expect(res.status).toBe(200);
    expect(dbMocks.recoverStaleContextProcessingLocksForAdmin).toHaveBeenCalledWith({
      organizationId: 'test-org-id',
      staleLockMs: 900000,
    });
    expect(dbMocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_log'),
      expect.arrayContaining([
        expect.any(String),
        'test-org-id',
        'test-user-id',
        'organization_context.stale_locks_recovered',
        'organization_context_processing_jobs',
        'stale-locks',
      ]),
      expect.any(Object)
    );
    expect(res.body).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          recoveredLocks: 1,
        }),
        meta: expect.objectContaining({
          contract: 'organization_context_stale_locks_recovery_v1',
          explicitAction: true,
        }),
      })
    );
  });

  it('requeues a dead-letter context job for confirmed admin action and audits it', async () => {
    const res = await request(mount())
      .post('/api/audit-logs/organization-context/processing-jobs/job-dead/requeue')
      .send({ confirmation: 'requeue_context_processing_job' });

    expect(res.status).toBe(200);
    expect(dbMocks.requeueDeadLetterContextProcessingJob).toHaveBeenCalledWith({
      organizationId: 'test-org-id',
      jobId: 'job-dead',
      userId: 'test-user-id',
    });
    expect(dbMocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_log'),
      expect.arrayContaining([
        expect.any(String),
        'test-org-id',
        'test-user-id',
        'organization_context.processing_job_requeued',
        'organization_context_processing_job',
        'job-dead',
      ]),
      expect.any(Object)
    );
    expect(res.body).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          requeued: true,
          status: 'retry_scheduled',
        }),
        meta: expect.objectContaining({
          contract: 'organization_context_processing_job_requeue_v1',
          explicitAction: true,
        }),
      })
    );
  });

  it('runs context worker once for confirmed admin action and audits it', async () => {
    dbMocks.processQueuedContextDocumentJobs.mockResolvedValueOnce({
      processed: 1,
      retried: 1,
      deadLettered: 0,
      recoveredLocks: 1,
      errors: [{ jobId: 'job-2', documentId: 'doc-2', errorCode: 'temporary_error' }],
    });

    const res = await request(mount())
      .post('/api/audit-logs/organization-context/processing-jobs/run-worker')
      .send({ confirmation: 'run_context_worker_once', limit: 2 });

    expect(res.status).toBe(200);
    expect(dbMocks.processQueuedContextDocumentJobs).toHaveBeenCalledWith({
      limit: 2,
      recoverStaleLocks: true,
      organizationId: 'test-org-id',
    });
    expect(dbMocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_log'),
      expect.arrayContaining([
        'test-org-id',
        'test-user-id',
        'organization_context.worker_run_requested',
        'organization_context_processing_jobs',
        expect.stringContaining('context-worker-run-'),
      ]),
      expect.any(Object)
    );
    expect(res.body).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          processed: 1,
          retried: 1,
          deadLettered: 0,
          runId: expect.stringContaining('context-worker-run-'),
          auditEventId: expect.stringContaining('audit-'),
          auditRecorded: true,
        }),
        meta: expect.objectContaining({
          contract: 'organization_context_worker_run_v1',
          explicitAction: true,
          confirmation: 'run_context_worker_once',
          runId: expect.stringContaining('context-worker-run-'),
          auditEventId: expect.stringContaining('audit-'),
        }),
      })
    );
  });
});
