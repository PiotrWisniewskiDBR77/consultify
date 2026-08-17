import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const mocks = vi.hoisted(() => ({
  dbRun: vi.fn(),
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  checkQuota: vi.fn(),
  checkProjectQuota: vi.fn(),
  recordStorageUsage: vi.fn(),
  recordProjectStorageUsage: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  recordAttachmentExtraction: vi.fn(),
  generateEmbedding: vi.fn(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  run: mocks.dbRun,
  all: mocks.dbAll,
  get: mocks.dbGet,
}));

vi.mock('../../../../server/src/services/usageService.js', () => ({
  checkQuota: mocks.checkQuota,
  checkProjectQuota: mocks.checkProjectQuota,
  recordStorageUsage: mocks.recordStorageUsage,
  recordProjectStorageUsage: mocks.recordProjectStorageUsage,
}));

vi.mock('node:fs', () => ({
  default: {
    promises: {
      mkdir: mocks.mkdir,
      writeFile: mocks.writeFile,
      readFile: mocks.readFile,
    },
  },
  promises: {
    mkdir: mocks.mkdir,
    writeFile: mocks.writeFile,
    readFile: mocks.readFile,
  },
}));

vi.mock(
  '../../../../server/src/services/organizationContext/OrganizationContextService.js',
  () => ({
    default: {
      recordAttachmentExtraction: mocks.recordAttachmentExtraction,
    },
  })
);

vi.mock('../../../../server/src/services/ragService.js', () => ({
  default: {
    generateEmbedding: mocks.generateEmbedding,
  },
}));

const { default: contextDocumentService, recordContextStorageUsage } =
  await import('../../../../server/src/services/organizationContext/ContextDocumentService.js');

describe('ContextDocumentService storage accounting', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    mocks.dbRun.mockReset().mockResolvedValue({ success: true, changes: 1 });
    mocks.dbGet.mockReset().mockResolvedValue({
      id: 'doc-quota',
      organization_id: 'org-1',
      owner_id: 'user-1',
      project_id: null,
      scope: 'user',
      filename: 'large.pdf',
      original_name: 'large.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 4096,
      source_upload: 'documents.library',
      status: 'quota_blocked',
      processing_error: 'CONTEXT_STORAGE_QUOTA_EXCEEDED',
      chunk_count: 0,
      version: 1,
      created_at: '2026-05-03T10:00:00.000Z',
      updated_at: '2026-05-03T10:00:00.000Z',
    });
    mocks.checkQuota.mockReset().mockResolvedValue({
      allowed: true,
      used: 900,
      limit: 1000,
      remaining: 100,
      percentage: 90,
    });
    mocks.checkProjectQuota.mockReset().mockResolvedValue({
      allowed: true,
      used: 0,
      limit: null,
      remaining: Number.POSITIVE_INFINITY,
      percentage: 0,
    });
    mocks.recordStorageUsage.mockReset().mockResolvedValue({ id: 'usage-1', bytes: 2048 });
    mocks.recordProjectStorageUsage
      .mockReset()
      .mockResolvedValue({ projectId: 'project-1', bytes: 2048 });
    mocks.mkdir.mockReset().mockResolvedValue(undefined);
    mocks.writeFile.mockReset().mockResolvedValue(undefined);
    mocks.readFile
      .mockReset()
      .mockResolvedValue(Buffer.from('queued document text that can be processed'));
    mocks.recordAttachmentExtraction.mockReset().mockResolvedValue(undefined);
    mocks.generateEmbedding.mockReset().mockResolvedValue([0.1, 0.2]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it('records context storage event and forwards usage to existing usage service', async () => {
    await recordContextStorageUsage({
      organizationId: 'org-1',
      userId: 'user-1',
      documentId: 'doc-1',
      projectId: 'project-1',
      scope: 'project',
      bytes: 2048,
      filename: 'strategy.pdf',
      sourceUpload: 'interview.insight_creator',
    });

    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('organization_context_storage_events'),
      expect.arrayContaining(['org-1', 'user-1', 'doc-1', 'project-1', 'project', 2048]),
      expect.any(Object)
    );
    expect(mocks.recordStorageUsage).toHaveBeenCalledWith(
      'org-1',
      2048,
      'context_document_upload',
      expect.objectContaining({
        documentId: 'doc-1',
        projectId: 'project-1',
        scope: 'project',
      })
    );
    expect(mocks.recordProjectStorageUsage).toHaveBeenCalledWith(
      'project-1',
      2048,
      'context_document_upload'
    );
  });

  it('blocks uploads honestly when org storage quota cannot fit the file', async () => {
    await expect(
      contextDocumentService.uploadAndIngest({
        file: {
          originalname: 'large.pdf',
          mimetype: 'application/pdf',
          size: 4096,
          buffer: Buffer.from('%PDF-large'),
        } as Express.Multer.File,
        organizationId: 'org-1',
        ownerId: 'user-1',
        scope: 'user',
        sourceUpload: 'documents.library',
      })
    ).rejects.toMatchObject({
      status: 429,
      code: 'CONTEXT_STORAGE_QUOTA_EXCEEDED',
      document: expect.objectContaining({
        status: 'quota_blocked',
        processingError: 'CONTEXT_STORAGE_QUOTA_EXCEEDED',
      }),
    });

    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining("'quota_blocked'"),
      expect.arrayContaining(['org-1', null, 'user-1', 'user', 4096]),
      expect.any(Object)
    );
    expect(mocks.recordStorageUsage).not.toHaveBeenCalled();
    const quotaInsert = mocks.dbRun.mock.calls.find((call) =>
      String(call[0]).includes("'quota_blocked'")
    );
    expect(String(quotaInsert?.[0])).not.toContain('file_hash');
  });

  it('records processing job lifecycle for degraded extraction outcomes', async () => {
    mocks.dbGet.mockResolvedValue({
      id: 'doc-ppt',
      organization_id: 'org-1',
      owner_id: 'user-1',
      project_id: null,
      scope: 'user',
      filename: 'slides.pptx',
      original_name: 'slides.pptx',
      mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      file_size_bytes: 128,
      source_upload: 'documents.library',
      status: 'unreadable',
      processing_error: 'pptx_archive_unreadable',
      chunk_count: 0,
      version: 1,
      created_at: '2026-05-03T10:00:00.000Z',
      updated_at: '2026-05-03T10:00:00.000Z',
    });

    await contextDocumentService.uploadAndIngest({
      file: {
        originalname: 'slides.pptx',
        mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        size: 64,
        buffer: Buffer.from('pptx placeholder'),
      } as Express.Multer.File,
      organizationId: 'org-1',
      ownerId: 'user-1',
      scope: 'user',
      sourceUpload: 'documents.library',
    });

    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('organization_context_processing_jobs'),
      expect.arrayContaining([
        'org-1',
        'user-1',
        expect.any(String),
        null,
        'user',
        'document_text_extraction',
        'context-document-pipeline-v1',
        'documents.library',
        expect.stringContaining('inline_worker_boundary_v1'),
      ]),
      expect.any(Object)
    );
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'processing'"),
      expect.any(Array),
      expect.any(Object)
    );
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE organization_context_processing_jobs'),
      expect.arrayContaining(['degraded', 'pptx_archive_unreadable']),
      expect.any(Object)
    );
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('normalized_md = ?'),
      expect.arrayContaining([
        'unreadable',
        'pptx_archive_unreadable',
        expect.stringContaining('# slides.pptx'),
        expect.stringContaining('organization_context_normalized_v1'),
      ]),
      expect.any(Object)
    );
  });

  it('stores normalized package and source locator metadata for ready text documents', async () => {
    mocks.dbGet.mockResolvedValue({
      id: 'doc-ready',
      organization_id: 'org-1',
      owner_id: 'user-1',
      project_id: null,
      scope: 'user',
      filename: 'strategy.txt',
      original_name: 'strategy.txt',
      mime_type: 'text/plain',
      file_size_bytes: 96,
      source_upload: 'documents.library',
      status: 'ready',
      processing_error: null,
      chunk_count: 1,
      version: 1,
      created_at: '2026-05-03T10:00:00.000Z',
      updated_at: '2026-05-03T10:00:00.000Z',
    });

    const bytes = Buffer.from(
      'This is a sufficiently long strategy document with enough context for chunk creation.'
    );
    await contextDocumentService.uploadAndIngest({
      file: {
        originalname: 'strategy.txt',
        mimetype: 'text/plain',
        size: 96,
        buffer: bytes,
      } as Express.Multer.File,
      organizationId: 'org-1',
      ownerId: 'user-1',
      scope: 'user',
      sourceUpload: 'documents.library',
    });

    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO knowledge_docs[\s\S]*file_hash/),
      expect.arrayContaining([createHash('sha256').update(bytes).digest('hex')]),
      expect.any(Object)
    );

    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('normalized_md = ?'),
      expect.arrayContaining([
        1,
        expect.stringContaining('# strategy.txt'),
        expect.stringContaining('organization_context_normalized_v1'),
      ]),
      expect.any(Object)
    );
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO knowledge_chunks'),
      expect.arrayContaining([
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.stringContaining('# strategy.txt'),
        0,
        JSON.stringify([0.1, 0.2]),
        expect.stringContaining('line_range'),
      ]),
      expect.any(Object)
    );
  });

  it('uses guarded async enqueue instead of inline extraction only when upload cutover is explicitly enabled', async () => {
    process.env.ORG_CONTEXT_UPLOAD_PROCESSING_MODE = 'async_worker';
    process.env.ORG_CONTEXT_UPLOAD_ASYNC_CUTOVER_ENABLED = 'true';
    process.env.ORG_CONTEXT_WORKER_SCHEDULER_ENABLED = 'true';
    mocks.dbGet.mockResolvedValue({
      id: 'doc-async',
      organization_id: 'org-1',
      owner_id: 'user-1',
      project_id: null,
      scope: 'user',
      filename: 'async.txt',
      original_name: 'async.txt',
      mime_type: 'text/plain',
      file_size_bytes: 96,
      source_upload: 'documents.library',
      status: 'processing',
      processing_error: null,
      chunk_count: 0,
      version: 1,
      created_at: '2026-05-03T10:00:00.000Z',
      updated_at: '2026-05-03T10:00:00.000Z',
    });

    const result = await contextDocumentService.uploadAndIngest({
      file: {
        originalname: 'async.txt',
        mimetype: 'text/plain',
        size: 96,
        buffer: Buffer.from('This document should be queued instead of extracted inline.'),
      } as Express.Multer.File,
      organizationId: 'org-1',
      ownerId: 'user-1',
      scope: 'user',
      sourceUpload: 'documents.library',
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'doc-async',
        status: 'processing',
        processingError: null,
      })
    );
    expect(mocks.recordAttachmentExtraction).not.toHaveBeenCalled();
    expect(mocks.generateEmbedding).not.toHaveBeenCalled();
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE organization_context_processing_jobs'),
      expect.arrayContaining([
        expect.stringContaining('async_worker_enqueued_v1'),
        expect.any(String),
        expect.any(String),
      ]),
      expect.any(Object)
    );
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'processing'"),
      expect.arrayContaining([expect.any(String), expect.any(String)]),
      expect.any(Object)
    );
  });

  it('stores sheet range native locator metadata for spreadsheet documents', async () => {
    const xlsxMod = await import('xlsx');
    const xlsx = xlsxMod.default || xlsxMod;
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet([
      ['Theme', 'Evidence'],
      ['Growth', 'North region pipeline has enough signal for a focused initiative.'],
      ['Risk', 'Operational capacity needs weekly follow-up with accountable owners.'],
    ]);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Planning');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    mocks.dbGet.mockResolvedValue({
      id: 'doc-sheet',
      organization_id: 'org-1',
      owner_id: 'user-1',
      project_id: null,
      scope: 'user',
      filename: 'planning.xlsx',
      original_name: 'planning.xlsx',
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      file_size_bytes: 64,
      source_upload: 'documents.library',
      status: 'ready',
      processing_error: null,
      chunk_count: 1,
      version: 1,
      created_at: '2026-05-03T10:00:00.000Z',
      updated_at: '2026-05-03T10:00:00.000Z',
    });

    await contextDocumentService.uploadAndIngest({
      file: {
        originalname: 'planning.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 64,
        buffer,
      } as Express.Multer.File,
      organizationId: 'org-1',
      ownerId: 'user-1',
      scope: 'user',
      sourceUpload: 'documents.library',
    });

    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('normalized_md = ?'),
      expect.arrayContaining([
        1,
        expect.stringContaining('# Sheet: Planning'),
        expect.stringContaining('sheet_range'),
      ]),
      expect.any(Object)
    );
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO knowledge_chunks'),
      expect.arrayContaining([
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.stringContaining('# Sheet: Planning'),
        0,
        JSON.stringify([0.1, 0.2]),
        expect.stringContaining('"sheetName":"Planning"'),
      ]),
      expect.any(Object)
    );
  });

  it('schedules retry when queued worker cannot read the source file before max attempts', async () => {
    mocks.dbAll.mockResolvedValueOnce([{ id: 'job-stale' }]).mockResolvedValueOnce([
      {
        job_id: 'job-retry',
        document_id: 'doc-retry',
        attempt_count: 0,
        filepath: '/missing/context.txt',
        original_name: 'context.txt',
        filename: 'context.txt',
        mime_type: 'text/plain',
        file_size_bytes: 128,
      },
    ]);
    mocks.readFile.mockRejectedValueOnce(new Error('source file unavailable'));

    const result = await contextDocumentService.processQueuedContextDocumentJobs({ limit: 1 });

    expect(result).toEqual(
      expect.objectContaining({
        processed: 0,
        retried: 1,
        deadLettered: 0,
        recoveredLocks: 1,
      })
    );
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'retry_scheduled'"),
      expect.arrayContaining([expect.any(String), 'job-stale']),
      expect.any(Object)
    );
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'claimed'"),
      expect.arrayContaining(['organization-context-worker', expect.any(String), 'job-retry']),
      expect.any(Object)
    );
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'retry_scheduled'"),
      expect.arrayContaining([
        expect.stringContaining('source_file_unavailable'),
        expect.stringContaining('source_file_unavailable'),
      ]),
      expect.any(Object)
    );
  });

  it('dead-letters queued worker jobs after the final failed attempt', async () => {
    mocks.dbAll.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        job_id: 'job-dead',
        document_id: 'doc-dead',
        attempt_count: 2,
        filepath: '/missing/final.txt',
        original_name: 'final.txt',
        filename: 'final.txt',
        mime_type: 'text/plain',
        file_size_bytes: 128,
      },
    ]);
    mocks.readFile.mockRejectedValueOnce(new Error('source file unavailable'));

    const result = await contextDocumentService.processQueuedContextDocumentJobs({ limit: 1 });

    expect(result).toEqual(
      expect.objectContaining({
        processed: 0,
        retried: 0,
        deadLettered: 1,
      })
    );
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'dead_letter'"),
      expect.arrayContaining([
        expect.stringContaining('source_file_unavailable'),
        expect.stringContaining('source_file_unavailable'),
      ]),
      expect.any(Object)
    );
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'failed'"),
      expect.arrayContaining([
        expect.stringContaining('source_file_unavailable'),
        expect.any(String),
        'doc-dead',
      ]),
      expect.any(Object)
    );
  });

  it('summarizes queue adapter status counts for worker dashboards', async () => {
    mocks.dbAll.mockResolvedValueOnce([
      { status: 'queued', count: 2 },
      { status: 'retry_scheduled', count: 1 },
      { status: 'claimed', count: 1 },
      { status: 'dead_letter', count: 1 },
    ]);
    mocks.dbGet
      .mockResolvedValueOnce({
        claimed_count: 1,
        stale_claimed_count: 1,
        oldest_claimed_at: '2026-05-03T09:00:00.000Z',
      })
      .mockResolvedValueOnce({
        dead_letter_count: 1,
        latest_dead_letter_at: '2026-05-03T10:00:00.000Z',
      })
      .mockResolvedValueOnce({
        processing_document_count: 2,
        oldest_processing_document_at: '2026-05-03T08:45:00.000Z',
      });

    const summary = await contextDocumentService.getContextProcessingQueueSummary({
      organizationId: 'org-1',
      staleLockMs: 60_000,
    });

    expect(summary).toEqual(
      expect.objectContaining({
        adapter: 'db_ledger_v1',
        configuredBackend: 'db_ledger_v1',
        queueBackendReady: true,
        queueBackendReason: null,
        queueCanEnqueue: true,
        queueCanConsumeLocally: true,
        queueAdapterReason: null,
        brokerDeploymentReady: true,
        brokerDeploymentMissing: [],
        asyncCutoverReady: false,
        asyncCutoverBlockers: [
          'scheduler_disabled',
          'stale_worker_locks_present',
          'dead_letters_present',
        ],
        locatorUpgradePlan: {
          baselineReady: [
            'char_range_chunks',
            'line_range_text_locators',
            'sheet_range_spreadsheet_locators',
            'pdf_page_locators',
            'docx_paragraph_locators',
            'pptx_slide_locators',
          ],
          remaining: ['image_region_locators', 'audio_timestamp_locators'],
        },
        schedulerEnabled: false,
        pendingCount: 3,
        blockedCount: 2,
        claimedCount: 1,
        staleClaimedCount: 1,
        oldestClaimedAt: '2026-05-03T09:00:00.000Z',
        deadLetterCount: 1,
        latestDeadLetterAt: '2026-05-03T10:00:00.000Z',
        staleLockMs: 60_000,
        leaseDurationMs: 900_000,
        statusCounts: expect.objectContaining({
          queued: 2,
          retry_scheduled: 1,
          claimed: 1,
          dead_letter: 1,
        }),
        uploadProcessingMode: 'inline_worker_boundary_v1',
        guardedAsyncUploadReady: false,
        guardedAsyncUploadBlockers: expect.arrayContaining([
          'upload_async_mode_not_requested',
          'upload_async_cutover_flag_disabled',
          'scheduler_disabled',
        ]),
        guardedAsyncUploadSwitchPlan: expect.objectContaining({
          defaultMode: 'inline_worker_boundary_v1',
          cutoverMode: 'async_worker_enqueued_v1',
          rollbackEnv: 'ORG_CONTEXT_UPLOAD_PROCESSING_MODE=inline',
        }),
        asyncUploadReadBack: {
          processingDocumentCount: 2,
          oldestProcessingDocumentAt: '2026-05-03T08:45:00.000Z',
          queuedJobCount: 2,
          retryScheduledJobCount: 1,
          attentionRequired: false,
        },
        externalWorkerDeploymentVerified: true,
        externalWorkerDeploymentMissing: [],
        externalWorkerDeploymentVerification: {
          mode: 'not_required',
          healthUrlConfigured: false,
          deploymentMarkerPresent: false,
        },
      })
    );
    expect(mocks.dbAll).toHaveBeenCalledWith(
      expect.stringContaining('WHERE organization_id = ?'),
      ['org-1'],
      expect.any(Object)
    );
  });

  it('does not run scheduled worker tick unless explicitly enabled', async () => {
    const result = await contextDocumentService.processScheduledContextDocumentWorkerTick({
      enabled: false,
      limit: 1,
    });

    expect(result).toEqual(
      expect.objectContaining({
        schedulerMode: 'disabled',
        skipped: true,
        reason: 'scheduler_disabled',
        processed: 0,
      })
    );
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it('keeps configured cron worker disabled unless scheduler env is enabled', async () => {
    process.env.ORG_CONTEXT_WORKER_SCHEDULER_ENABLED = 'false';

    const result = await contextDocumentService.processConfiguredContextDocumentWorkerTick({
      limit: 1,
    });

    expect(result).toEqual(
      expect.objectContaining({
        schedulerMode: 'disabled',
        skipped: true,
        reason: 'scheduler_disabled',
      })
    );
  });

  it('reports external queue backend as unconfigured instead of processing jobs silently', async () => {
    process.env.ORG_CONTEXT_QUEUE_BACKEND = 'external';
    process.env.ORG_CONTEXT_WORKER_SCHEDULER_ENABLED = 'true';

    const result = await contextDocumentService.processConfiguredContextDocumentWorkerTick({
      limit: 1,
    });

    expect(result).toEqual(
      expect.objectContaining({
        schedulerMode: 'disabled',
        skipped: true,
        reason: 'external_queue_url_missing',
      })
    );
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it('reports configured external queue as ready but not executable by local worker', async () => {
    process.env.ORG_CONTEXT_QUEUE_BACKEND = 'external';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_URL = 'https://queue.example.test/context';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_NAME = 'context-documents';
    process.env.ORG_CONTEXT_WORKER_SCHEDULER_ENABLED = 'true';
    mocks.dbAll.mockResolvedValueOnce([]);
    mocks.dbGet
      .mockResolvedValueOnce({ claimed_count: 0, stale_claimed_count: 0, oldest_claimed_at: null })
      .mockResolvedValueOnce({ dead_letter_count: 0, latest_dead_letter_at: null })
      .mockResolvedValueOnce({
        processing_document_count: 0,
        oldest_processing_document_at: null,
      });

    const summary = await contextDocumentService.getContextProcessingQueueSummary();
    const result = await contextDocumentService.processConfiguredContextDocumentWorkerTick({
      limit: 1,
    });

    expect(summary).toEqual(
      expect.objectContaining({
        configuredBackend: 'external_queue_v1',
        queueBackendReady: true,
        queueCanEnqueue: true,
        queueCanConsumeLocally: false,
        queueAdapterReason: 'external_queue_consumer_not_implemented',
        brokerDeploymentReady: false,
        brokerDeploymentMissing: ['pull_url', 'ack_url', 'backoff_url'],
        externalWorkerDeploymentVerified: false,
        externalWorkerDeploymentMissing: [
          'external_worker_health_url',
          'external_worker_deployment_verified',
        ],
        externalQueueName: 'context-documents',
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        schedulerMode: 'disabled',
        skipped: true,
        reason: 'external_queue_consumer_not_implemented',
      })
    );
  });

  it('reports production broker deployment readiness when all external queue URLs are configured', async () => {
    process.env.ORG_CONTEXT_QUEUE_BACKEND = 'external';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_URL = 'https://queue.example.test/enqueue';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_PULL_URL = 'https://queue.example.test/pull';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_ACK_URL = 'https://queue.example.test/ack';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_BACKOFF_URL = 'https://queue.example.test/backoff';
    process.env.ORG_CONTEXT_WORKER_SCHEDULER_ENABLED = 'true';
    mocks.dbAll.mockResolvedValueOnce([]);
    mocks.dbGet
      .mockResolvedValueOnce({ claimed_count: 0, stale_claimed_count: 0, oldest_claimed_at: null })
      .mockResolvedValueOnce({ dead_letter_count: 0, latest_dead_letter_at: null })
      .mockResolvedValueOnce({
        processing_document_count: 0,
        oldest_processing_document_at: null,
      });

    const summary = await contextDocumentService.getContextProcessingQueueSummary();

    expect(summary).toEqual(
      expect.objectContaining({
        configuredBackend: 'external_queue_v1',
        queueCanEnqueue: true,
        queueCanConsumeLocally: false,
        brokerDeploymentReady: true,
        brokerDeploymentMissing: [],
        asyncCutoverReady: true,
        asyncCutoverBlockers: [],
        uploadProcessingMode: 'inline_worker_boundary_v1',
        guardedAsyncUploadReady: false,
        guardedAsyncUploadBlockers: expect.arrayContaining([
          'upload_async_mode_not_requested',
          'upload_async_cutover_flag_disabled',
        ]),
        asyncUploadReadBack: {
          processingDocumentCount: 0,
          oldestProcessingDocumentAt: null,
          queuedJobCount: 0,
          retryScheduledJobCount: 0,
          attentionRequired: false,
        },
        externalWorkerDeploymentVerified: false,
        externalWorkerDeploymentMissing: [
          'external_worker_health_url',
          'external_worker_deployment_verified',
        ],
      })
    );
  });

  it('reports guarded async upload switch as ready only after explicit cutover flags', async () => {
    process.env.ORG_CONTEXT_QUEUE_BACKEND = 'external';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_URL = 'https://queue.example.test/enqueue';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_PULL_URL = 'https://queue.example.test/pull';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_ACK_URL = 'https://queue.example.test/ack';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_BACKOFF_URL = 'https://queue.example.test/backoff';
    process.env.ORG_CONTEXT_WORKER_SCHEDULER_ENABLED = 'true';
    process.env.ORG_CONTEXT_UPLOAD_PROCESSING_MODE = 'async_worker';
    process.env.ORG_CONTEXT_UPLOAD_ASYNC_CUTOVER_ENABLED = 'true';
    process.env.ORG_CONTEXT_EXTERNAL_WORKER_HEALTH_URL = 'https://worker.example.test/health';
    process.env.ORG_CONTEXT_EXTERNAL_WORKER_DEPLOYMENT_VERIFIED = 'true';
    mocks.dbAll.mockResolvedValueOnce([]);
    mocks.dbGet
      .mockResolvedValueOnce({ claimed_count: 0, stale_claimed_count: 0, oldest_claimed_at: null })
      .mockResolvedValueOnce({ dead_letter_count: 0, latest_dead_letter_at: null })
      .mockResolvedValueOnce({
        processing_document_count: 1,
        oldest_processing_document_at: '2026-05-03T11:00:00.000Z',
      });

    const summary = await contextDocumentService.getContextProcessingQueueSummary();

    expect(summary).toEqual(
      expect.objectContaining({
        asyncCutoverReady: true,
        uploadProcessingMode: 'async_worker_enqueued_v1',
        guardedAsyncUploadReady: true,
        guardedAsyncUploadBlockers: [],
        guardedAsyncUploadSwitchPlan: expect.objectContaining({
          requiredEnv: expect.arrayContaining([
            'ORG_CONTEXT_UPLOAD_PROCESSING_MODE=async_worker',
            'ORG_CONTEXT_UPLOAD_ASYNC_CUTOVER_ENABLED=true',
            'ORG_CONTEXT_WORKER_SCHEDULER_ENABLED=true',
          ]),
        }),
        asyncUploadReadBack: {
          processingDocumentCount: 1,
          oldestProcessingDocumentAt: '2026-05-03T11:00:00.000Z',
          queuedJobCount: 0,
          retryScheduledJobCount: 0,
          attentionRequired: true,
        },
        externalWorkerDeploymentVerified: true,
        externalWorkerDeploymentMissing: [],
        externalWorkerDeploymentVerification: {
          mode: 'manual_release_gate_v1',
          healthUrlConfigured: true,
          deploymentMarkerPresent: true,
        },
      })
    );
  });

  it('checks external worker health only when the health probe is explicitly enabled', async () => {
    process.env.ORG_CONTEXT_QUEUE_BACKEND = 'external';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_URL = 'https://queue.example.test/enqueue';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_PULL_URL = 'https://queue.example.test/pull';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_ACK_URL = 'https://queue.example.test/ack';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_BACKOFF_URL = 'https://queue.example.test/backoff';
    process.env.ORG_CONTEXT_EXTERNAL_WORKER_HEALTH_URL = 'https://worker.example.test/health';
    process.env.ORG_CONTEXT_EXTERNAL_WORKER_DEPLOYMENT_VERIFIED = 'true';
    process.env.ORG_CONTEXT_EXTERNAL_WORKER_HEALTH_PROBE_ENABLED = 'true';
    mocks.dbAll.mockResolvedValueOnce([]);
    mocks.dbGet
      .mockResolvedValueOnce({ claimed_count: 0, stale_claimed_count: 0, oldest_claimed_at: null })
      .mockResolvedValueOnce({ dead_letter_count: 0, latest_dead_letter_at: null })
      .mockResolvedValueOnce({
        processing_document_count: 0,
        oldest_processing_document_at: null,
      });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    const summary = await contextDocumentService.getContextProcessingQueueSummary();

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://worker.example.test/health',
      expect.objectContaining({
        method: 'GET',
      })
    );
    expect(summary).toEqual(
      expect.objectContaining({
        externalWorkerDeploymentVerified: true,
        externalWorkerHealthProbe: expect.objectContaining({
          status: 'healthy',
          reason: null,
        }),
      })
    );
  });

  it('requeues dead-letter processing jobs as an explicit retry-scheduled proposal', async () => {
    mocks.dbGet.mockResolvedValueOnce({
      id: 'job-dead',
      document_id: 'doc-dead',
      status: 'dead_letter',
    });

    const result = await contextDocumentService.requeueDeadLetterContextProcessingJob({
      organizationId: 'org-1',
      jobId: 'job-dead',
      userId: 'admin-1',
    });

    expect(result).toEqual(
      expect.objectContaining({
        requeued: true,
        jobId: 'job-dead',
        documentId: 'doc-dead',
        previousStatus: 'dead_letter',
        status: 'retry_scheduled',
      })
    );
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'retry_scheduled'"),
      expect.arrayContaining([
        expect.stringContaining('requeuedFrom'),
        expect.any(String),
        'job-dead',
        'org-1',
      ]),
      expect.any(Object)
    );
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'uploaded'"),
      expect.arrayContaining([expect.any(String), 'doc-dead', 'org-1']),
      expect.any(Object)
    );
  });

  it('recovers stale locks through org-scoped admin action', async () => {
    mocks.dbAll.mockResolvedValueOnce([{ id: 'job-stale' }]);

    const result = await contextDocumentService.recoverStaleContextProcessingLocksForAdmin({
      organizationId: 'org-1',
      staleLockMs: 60_000,
    });

    expect(result).toEqual(
      expect.objectContaining({
        recoveredLocks: 1,
        staleLockMs: 60_000,
      })
    );
    expect(mocks.dbAll).toHaveBeenCalledWith(
      expect.stringContaining('AND organization_id = ?'),
      expect.arrayContaining(['org-1']),
      expect.any(Object)
    );
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'retry_scheduled'"),
      expect.arrayContaining([expect.any(String), 'job-stale']),
      expect.any(Object)
    );
  });

  it('claims worker jobs with explicit lease expiry', async () => {
    mocks.dbAll.mockResolvedValueOnce([
      {
        job_id: 'job-lease',
        document_id: 'doc-lease',
        attempt_count: 0,
        filepath: '/tmp/context-doc.txt',
        original_name: 'context-doc.txt',
        mime_type: 'text/plain',
      },
    ]);

    await contextDocumentService.processQueuedContextDocumentJobs({
      limit: 1,
      recoverStaleLocks: false,
    });

    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('COALESCE(lease_expires_at, locked_at) < ?'),
      expect.arrayContaining(['organization-context-worker']),
      expect.any(Object)
    );
  });

  it('renews worker lease during accepted document processing', async () => {
    mocks.dbAll.mockResolvedValueOnce([
      {
        job_id: 'job-heartbeat',
        document_id: 'doc-heartbeat',
        attempt_count: 0,
        filepath: '/tmp/context-doc.txt',
        original_name: 'context-doc.txt',
        mime_type: 'text/plain',
      },
    ]);

    await contextDocumentService.processQueuedContextDocumentJobs({
      limit: 1,
      recoverStaleLocks: false,
    });

    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('SET lease_expires_at = ?'),
      expect.arrayContaining(['job-heartbeat', 'organization-context-worker']),
      expect.any(Object)
    );
  });

  it('skips queued worker jobs when compare-and-swap claim loses the race', async () => {
    mocks.dbRun.mockResolvedValue({ success: true, changes: 0 });
    mocks.dbAll.mockResolvedValueOnce([
      {
        job_id: 'job-raced',
        document_id: 'doc-raced',
        attempt_count: 0,
        filepath: '/tmp/context-doc.txt',
        original_name: 'context-doc.txt',
        mime_type: 'text/plain',
      },
    ]);

    const result = await contextDocumentService.processQueuedContextDocumentJobs({
      limit: 1,
      recoverStaleLocks: false,
    });

    expect(result).toEqual(expect.objectContaining({ claimSkipped: 1, processed: 0 }));
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it('enqueues configured external queue payload without consuming it locally', async () => {
    process.env.ORG_CONTEXT_QUEUE_BACKEND = 'external';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_URL = 'https://queue.example.test/enqueue';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_NAME = 'context-documents';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_TOKEN = 'queue-token';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 202,
    } as Response);

    const result = await contextDocumentService.enqueueContextProcessingJobToConfiguredBackend({
      organizationId: 'org-1',
      jobId: 'job-1',
      documentId: 'doc-1',
    });

    expect(result).toEqual(
      expect.objectContaining({
        enqueued: true,
        adapter: 'external_queue_v1',
        jobId: 'job-1',
      })
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://queue.example.test/enqueue',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer queue-token',
        }),
        body: expect.stringContaining('organization_context_external_queue_enqueue_v1'),
      })
    );
  });

  it('pulls external queue messages and processes them through the DB ledger', async () => {
    process.env.ORG_CONTEXT_QUEUE_BACKEND = 'external';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_URL = 'https://queue.example.test/enqueue';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_PULL_URL = 'https://queue.example.test/pull';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_ACK_URL = 'https://queue.example.test/ack';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_TOKEN = 'queue-token';
    mocks.dbAll.mockResolvedValueOnce([
      {
        id: 'job-pulled',
      },
    ]);
    mocks.dbAll.mockResolvedValueOnce([
      {
        job_id: 'job-pulled',
        document_id: 'doc-pulled',
        organization_id: 'org-1',
        attempt_count: 0,
        filepath: '/tmp/context-doc.txt',
        original_name: 'context-doc.txt',
        mime_type: 'text/plain',
      },
    ]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        messages: [
          {
            receiptHandle: 'receipt-1',
            body: {
              organizationId: 'org-1',
              jobId: 'job-pulled',
              documentId: 'doc-pulled',
            },
          },
        ],
      }),
    } as Response);

    const disabled = await contextDocumentService.processExternalContextQueueConsumerTick({
      enabled: false,
      limit: 1,
    });
    const withPulledMessage = await contextDocumentService.processExternalContextQueueConsumerTick({
      enabled: true,
      limit: 1,
    });

    expect(disabled).toEqual(
      expect.objectContaining({
        consumerMode: 'disabled',
        skipped: true,
        reason: 'external_consumer_disabled',
      })
    );
    expect(withPulledMessage).toEqual(
      expect.objectContaining({
        consumerMode: 'external_queue_v1',
        skipped: false,
        pulledMessages: 1,
        ackedMessages: 1,
        processed: 1,
      })
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://queue.example.test/pull',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer queue-token',
        }),
        body: expect.stringContaining('organization_context_external_queue_pull_v1'),
      })
    );
    const pullCall = fetchSpy.mock.calls.find(([url]) => url === 'https://queue.example.test/pull');
    const pullBody = JSON.parse(String((pullCall?.[1] as RequestInit)?.body || '{}'));
    expect(pullBody).toEqual({
      contract: 'organization_context_external_queue_pull_v1',
      queueName: 'organization-context',
      limit: 1,
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://queue.example.test/ack',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('organization_context_external_queue_ack_v1'),
      })
    );
    const ackCall = fetchSpy.mock.calls.find(([url]) => url === 'https://queue.example.test/ack');
    const ackBody = JSON.parse(String((ackCall?.[1] as RequestInit)?.body || '{}'));
    expect(ackBody).toEqual({
      contract: 'organization_context_external_queue_ack_v1',
      queueName: 'organization-context',
      messages: [
        {
          organizationId: 'org-1',
          jobId: 'job-pulled',
          documentId: 'doc-pulled',
          receiptHandle: 'receipt-1',
          reason: null,
        },
      ],
    });
    expect(JSON.stringify(ackBody)).not.toContain('body');
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO organization_context_lineage_events'),
      expect.arrayContaining([
        'org-1',
        null,
        'organization_context_worker',
        'organization-context',
        'organization_context_external_queue',
        'external_queue_outcome_recorded',
      ]),
      expect.any(Object)
    );
  });

  it('reports missing ack URL instead of pretending external queue acknowledgement succeeded', async () => {
    process.env.ORG_CONTEXT_QUEUE_BACKEND = 'external';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_URL = 'https://queue.example.test/enqueue';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_PULL_URL = 'https://queue.example.test/pull';
    mocks.dbAll.mockResolvedValueOnce([{ id: 'job-no-ack' }]);
    mocks.dbAll.mockResolvedValueOnce([
      {
        job_id: 'job-no-ack',
        document_id: 'doc-no-ack',
        organization_id: 'org-1',
        attempt_count: 0,
        filepath: '/tmp/context-doc.txt',
        original_name: 'context-doc.txt',
        mime_type: 'text/plain',
      },
    ]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        messages: [
          {
            body: {
              organizationId: 'org-1',
              jobId: 'job-no-ack',
              documentId: 'doc-no-ack',
            },
          },
        ],
      }),
    } as Response);

    const result = await contextDocumentService.processExternalContextQueueConsumerTick({
      enabled: true,
      limit: 1,
    });

    expect(result).toEqual(
      expect.objectContaining({
        processed: 1,
        pulledMessages: 1,
        ackedMessages: 0,
        queueActionReason: 'external_queue_ack_url_missing',
      })
    );
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO organization_context_lineage_events'),
      expect.arrayContaining(['external_queue_outcome_attention']),
      expect.any(Object)
    );
  });

  it('keeps external queue consumer honest when pull URL is missing', async () => {
    process.env.ORG_CONTEXT_QUEUE_BACKEND = 'external';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_URL = 'https://queue.example.test/enqueue';

    const withoutPullUrl = await contextDocumentService.processExternalContextQueueConsumerTick({
      enabled: true,
      limit: 1,
    });

    expect(withoutPullUrl).toEqual(
      expect.objectContaining({
        consumerMode: 'external_queue_v1',
        skipped: true,
        reason: 'external_queue_pull_url_missing',
        pulledMessages: 0,
      })
    );
  });

  it('rejects external queue messages that do not match the DB ledger identity', async () => {
    process.env.ORG_CONTEXT_QUEUE_BACKEND = 'external';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_URL = 'https://queue.example.test/enqueue';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_PULL_URL = 'https://queue.example.test/pull';
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_BACKOFF_URL = 'https://queue.example.test/backoff';
    mocks.dbAll.mockResolvedValueOnce([{ id: 'job-mismatch' }]);
    mocks.dbAll.mockResolvedValueOnce([
      {
        job_id: 'job-mismatch',
        document_id: 'doc-real',
        organization_id: 'org-real',
        attempt_count: 0,
        filepath: '/tmp/context-doc.txt',
        original_name: 'context-doc.txt',
        mime_type: 'text/plain',
      },
    ]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        messages: [
          {
            receiptHandle: 'receipt-mismatch',
            body: {
              organizationId: 'org-spoofed',
              jobId: 'job-mismatch',
              documentId: 'doc-spoofed',
            },
          },
        ],
      }),
    } as Response);

    const result = await contextDocumentService.processExternalContextQueueConsumerTick({
      enabled: true,
      limit: 1,
    });

    expect(result).toEqual(
      expect.objectContaining({
        processed: 0,
        pulledMessages: 1,
        ackedMessages: 0,
        backoffMessages: 1,
      })
    );
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        jobId: 'job-mismatch',
        documentId: 'doc-spoofed',
        errorCode: 'external_queue_message_identity_mismatch',
      })
    );
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://queue.example.test/backoff',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('external_queue_message_identity_mismatch'),
      })
    );
    const backoffCall = fetchSpy.mock.calls.find(
      ([url]) => url === 'https://queue.example.test/backoff'
    );
    const backoffBody = JSON.parse(String((backoffCall?.[1] as RequestInit)?.body || '{}'));
    expect(backoffBody).toEqual({
      contract: 'organization_context_external_queue_backoff_v1',
      queueName: 'organization-context',
      messages: [
        {
          organizationId: 'org-spoofed',
          jobId: 'job-mismatch',
          documentId: 'doc-spoofed',
          receiptHandle: 'receipt-mismatch',
          reason: 'external_queue_message_identity_mismatch',
        },
      ],
    });
    expect(JSON.stringify(backoffBody)).not.toContain('doc-real');
    expect(JSON.stringify(backoffBody)).not.toContain('/tmp/context-doc.txt');
  });
});
