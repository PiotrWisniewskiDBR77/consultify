import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('../../../../server/src/services/organizationContext/OrganizationContextService.js', () => ({
  default: {
    recordAttachmentExtraction: mocks.recordAttachmentExtraction,
  },
}));

vi.mock('../../../../server/src/services/ragService.js', () => ({
  default: {
    generateEmbedding: mocks.generateEmbedding,
  },
}));

const { default: contextDocumentService, recordContextStorageUsage } = await import(
  '../../../../server/src/services/organizationContext/ContextDocumentService.js'
);

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
    mocks.recordProjectStorageUsage.mockReset().mockResolvedValue({ projectId: 'project-1', bytes: 2048 });
    mocks.mkdir.mockReset().mockResolvedValue(undefined);
    mocks.writeFile.mockReset().mockResolvedValue(undefined);
    mocks.readFile.mockReset().mockResolvedValue(Buffer.from('queued document text that can be processed'));
    mocks.recordAttachmentExtraction.mockReset().mockResolvedValue(undefined);
    mocks.generateEmbedding.mockReset().mockResolvedValue([0.1, 0.2]);
  });

  afterEach(() => {
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
      processing_error: 'ppt_extraction_not_supported',
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
      expect.arrayContaining(['degraded', 'ppt_extraction_not_supported']),
      expect.any(Object)
    );
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining('normalized_md = ?'),
      expect.arrayContaining([
        'unreadable',
        'ppt_extraction_not_supported',
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

    await contextDocumentService.uploadAndIngest({
      file: {
        originalname: 'strategy.txt',
        mimetype: 'text/plain',
        size: 96,
        buffer: Buffer.from(
          'This is a sufficiently long strategy document with enough context for chunk creation.'
        ),
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
    mocks.dbAll
      .mockResolvedValueOnce([{ id: 'job-stale' }])
      .mockResolvedValueOnce([
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
    mocks.dbAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
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
      expect.arrayContaining([expect.stringContaining('source_file_unavailable'), expect.any(String), 'doc-dead']),
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
        schedulerEnabled: false,
        pendingCount: 3,
        blockedCount: 2,
        claimedCount: 1,
        staleClaimedCount: 1,
        oldestClaimedAt: '2026-05-03T09:00:00.000Z',
        deadLetterCount: 1,
        latestDeadLetterAt: '2026-05-03T10:00:00.000Z',
        staleLockMs: 60_000,
        statusCounts: expect.objectContaining({
          queued: 2,
          retry_scheduled: 1,
          claimed: 1,
          dead_letter: 1,
        }),
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
      .mockResolvedValueOnce({ dead_letter_count: 0, latest_dead_letter_at: null });

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
      expect.arrayContaining([expect.stringContaining('requeuedFrom'), expect.any(String), 'job-dead', 'org-1']),
      expect.any(Object)
    );
    expect(mocks.dbRun).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'uploaded'"),
      expect.arrayContaining([expect.any(String), 'doc-dead', 'org-1']),
      expect.any(Object)
    );
  });
});
