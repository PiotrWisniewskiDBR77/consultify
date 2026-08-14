import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

const authState = vi.hoisted(() => ({
  user: {
    id: 'u-docs-1',
    organizationId: 'o-docs-1',
    role: 'admin',
  } as Record<string, unknown>,
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = authState.user;
    req.userId = authState.user.id;
    req.organizationId = authState.user.organizationId;
    req.userRole = authState.user.role;
    next();
  },
}));

// The global unit-test multer double only extracts the file and deliberately
// ignores multipart text fields. This integration contract exercises project
// scope/projectId, so use multer's real memory parser in this file.
vi.mock('multer', async () => await vi.importActual<typeof import('multer')>('multer'));

const usageMocks = vi.hoisted(() => ({
  checkQuota: vi.fn(),
  checkProjectQuota: vi.fn(),
  recordStorageUsage: vi.fn(),
  recordProjectStorageUsage: vi.fn(),
}));

vi.mock('../../../server/src/services/usageService.js', () => ({
  checkQuota: usageMocks.checkQuota,
  checkProjectQuota: usageMocks.checkProjectQuota,
  recordStorageUsage: usageMocks.recordStorageUsage,
  recordProjectStorageUsage: usageMocks.recordProjectStorageUsage,
}));

describe('Documents routes (context document service)', () => {
  const prevEnv = { ...process.env };
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = path.join(
    os.tmpdir(),
    `consultify-documents-${process.pid}-${workerId}-${Date.now()}.db`
  );
  const basePath = '/api/documents';

  let resetConnection: (() => Promise<void>) | null = null;
  let router: any;
  const readDocumentsArray = (body: any): unknown[] | null => {
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.documents)) return body.documents;
    if (Array.isArray(body?.data?.documents)) return body.data.documents;
    return null;
  };

  const mount = () => makeTestApp({ mountPath: basePath, router });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'true';
    process.env.DB_TYPE = 'sqlite';
    process.env.SQLITE_PATH = sqlitePath;
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

    vi.resetModules();
    const dbMod = await import('../../../server/src/database/Database.js');
    resetConnection = dbMod.resetConnection;
    await resetConnection();
    const db = await import('../../../server/src/utils/DbPromise.js');
    await db.run(
      `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, organization_id TEXT, name TEXT, created_at TEXT)`,
      []
    );
    await db.run(
      `CREATE TABLE IF NOT EXISTS project_members (project_id TEXT, user_id TEXT, role TEXT)`,
      []
    );
    await db.run(
      `INSERT INTO projects (id, organization_id, name, created_at) VALUES (?, ?, ?, ?)`,
      ['p-allowed', 'o-docs-1', 'Allowed Project', new Date().toISOString()]
    );
    await db.run(
      `INSERT INTO projects (id, organization_id, name, created_at) VALUES (?, ?, ?, ?)`,
      ['p-other-org', 'o-other', 'Other Project', new Date().toISOString()]
    );
    await db.run(`INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`, [
      'p-allowed',
      'u-docs-1',
      'member',
    ]);

    router = (await import('../../../server/src/routes/documents.routes.ts')).default;
  });

  afterAll(async () => {
    try {
      await resetConnection?.();
    } finally {
      try {
        const fs = await import('node:fs');
        fs.rmSync(sqlitePath, { force: true });
      } catch {
        // Best-effort cleanup; the unique run path prevents cross-run reuse.
      }
      process.env = prevEnv;
    }
  });

  beforeEach(() => {
    authState.user = {
      id: 'u-docs-1',
      organizationId: 'o-docs-1',
      role: 'admin',
    };
    usageMocks.checkQuota.mockReset().mockResolvedValue({
      allowed: true,
      used: 0,
      limit: 1024 * 1024 * 1024,
      remaining: 1024 * 1024 * 1024,
      percentage: 0,
    });
    usageMocks.checkProjectQuota.mockReset().mockResolvedValue({
      allowed: true,
      used: 0,
      limit: null,
      remaining: Number.POSITIVE_INFINITY,
      percentage: 0,
    });
    usageMocks.recordStorageUsage.mockReset().mockResolvedValue({ id: 'usage-1', bytes: 5 });
    usageMocks.recordProjectStorageUsage.mockReset().mockResolvedValue({
      projectId: 'p-allowed',
      bytes: 5,
    });
  });

  it('GET /api/documents returns real list response (no fake 503)', async () => {
    const res = await request(mount()).get(basePath);
    expect(res.status).toBe(200);
    expect(Array.isArray(readDocumentsArray(res.body))).toBe(true);
  });

  it('GET /api/documents/all returns real list response (no fake 503)', async () => {
    const res = await request(mount()).get(`${basePath}/all`);
    expect(res.status).toBe(200);
    expect(Array.isArray(readDocumentsArray(res.body))).toBe(true);
  });

  it('GET /api/documents/user returns real list response (no fake 503)', async () => {
    const res = await request(mount()).get(`${basePath}/user`);
    expect(res.status).toBe(200);
    expect(Array.isArray(readDocumentsArray(res.body))).toBe(true);
  });

  it('GET /api/documents/project/p-1 returns real list response (no fake 503)', async () => {
    const res = await request(mount()).get(`${basePath}/project/p-1`);
    expect(res.status).toBe(200);
    expect(Array.isArray(readDocumentsArray(res.body))).toBe(true);
  });

  it('POST /api/documents/upload returns 400 when file missing', async () => {
    const res = await request(mount()).post(`${basePath}/upload`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'fail',
        error: expect.objectContaining({
          code: 'DOCUMENTS_UPLOAD_FILE_REQUIRED',
          message: expect.any(String),
        }),
      })
    );
  });

  it('POST /api/documents/upload never returns fake 503 fallback', async () => {
    const res = await request(mount())
      .post(`${basePath}/upload`)
      .attach('file', Buffer.from('hello'), { filename: 'hello.txt', contentType: 'text/plain' });
    expect(res.status).not.toBe(503);
    if (res.status === 201) {
      expect(res.body).toEqual(
        expect.objectContaining({
          document: expect.objectContaining({
            id: expect.any(String),
            status: expect.any(String),
          }),
        })
      );
      return;
    }
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('POST /api/documents/upload records processing job lifecycle for ready documents', async () => {
    const res = await request(mount())
      .post(`${basePath}/upload`)
      .attach('file', Buffer.from('This is a sufficiently long context document for chunking and processing.'), {
        filename: 'job-ready.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(201);
    const documentId = res.body.document.id;
    const db = await import('../../../server/src/utils/DbPromise.js');
    const jobRows = await db.all(
      `SELECT * FROM organization_context_processing_jobs WHERE document_id = ?`,
      [documentId],
      { fallback: false } as any
    );
    const jobs = (jobRows as any[]).filter((job) => job.document_id === documentId);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toEqual(
      expect.objectContaining({
        organization_id: 'o-docs-1',
        user_id: 'u-docs-1',
        document_id: documentId,
        pipeline_type: 'document_text_extraction',
        processor_version: 'context-document-pipeline-v1',
        source_upload: 'documents.library',
      })
    );

    const chunks = await db.all(`SELECT metadata FROM knowledge_chunks WHERE doc_id = ?`, [
      documentId,
    ]);
    const chunkMetadata = JSON.parse(String((chunks as any[])?.[0]?.metadata || '{}'));
    expect(chunkMetadata).toEqual(
      expect.objectContaining({
        schemaVersion: 'organization_context_chunk_v1',
        documentId,
        filename: 'job-ready.txt',
        sourceLocator: expect.objectContaining({
          type: 'char_range',
          startChar: expect.any(Number),
          endChar: expect.any(Number),
        }),
      })
    );
  });

  it('POST /api/documents/upload returns honest quota_blocked when storage quota is exceeded', async () => {
    usageMocks.checkQuota.mockResolvedValueOnce({
      allowed: true,
      used: 1000,
      limit: 1001,
      remaining: 1,
      percentage: 99,
    });

    const res = await request(mount())
      .post(`${basePath}/upload`)
      .attach('file', Buffer.from('hello quota'), {
        filename: 'quota.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(429);
    expect(res.body).toEqual(
      expect.objectContaining({
        code: 'CONTEXT_STORAGE_QUOTA_EXCEEDED',
        document: expect.objectContaining({
          status: 'quota_blocked',
          processingError: 'CONTEXT_STORAGE_QUOTA_EXCEEDED',
        }),
        quota: expect.objectContaining({
          bytesRequested: expect.any(Number),
        }),
      })
    );
  });

  it('POST /api/documents/upload blocks project scope when user is not a project member', async () => {
    authState.user = {
      id: 'u-docs-outsider',
      organizationId: 'o-docs-1',
      role: 'team_member',
    };
    const res = await request(mount())
      .post(`${basePath}/upload`)
      .attach('file', Buffer.from('hello'), { filename: 'hello.txt', contentType: 'text/plain' })
      .field('scope', 'project')
      .field('projectId', 'p-allowed');

    expect(res.status).toBe(403);
    expect(res.body).toEqual(
      expect.objectContaining({ code: 'PROJECT_CONTEXT_ACCESS_DENIED' })
    );
  });

  it('GET /api/documents/all enforces organization filters while keeping honest degraded statuses', async () => {
    await request(mount()).get(basePath);
    const db = await import('../../../server/src/utils/DbPromise.js');
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO knowledge_docs
       (id, filename, filepath, status, organization_id, owner_id, scope, file_size_bytes,
        original_name, source_upload, chunk_count, version, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'doc-ready-visible',
        'ready.txt',
        '/tmp/ready.txt',
        'ready',
        'o-docs-1',
        'u-docs-1',
        'user',
        12,
        'ready.txt',
        'documents.library',
        1,
        1,
        now,
        now,
        null,
      ]
    );
    await db.run(
      `INSERT INTO knowledge_docs
       (id, filename, filepath, status, organization_id, owner_id, scope, file_size_bytes,
        original_name, source_upload, chunk_count, version, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'doc-deleted-hidden',
        'deleted.txt',
        '/tmp/deleted.txt',
        'ready',
        'o-docs-1',
        'u-docs-1',
        'user',
        12,
        'deleted.txt',
        'documents.library',
        1,
        1,
        now,
        now,
        now,
      ]
    );
    await db.run(
      `INSERT INTO knowledge_docs
       (id, filename, filepath, status, organization_id, owner_id, scope, file_size_bytes,
        original_name, source_upload, processing_error, chunk_count, version, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'doc-ocr-visible',
        'scan.pdf',
        '/tmp/scan.pdf',
        'ocr_required',
        'o-docs-1',
        'u-docs-1',
        'user',
        12,
        'scan.pdf',
        'documents.library',
        'pdf_ocr_required_or_empty',
        0,
        1,
        now,
        now,
        null,
      ]
    );
    await db.run(
      `INSERT INTO knowledge_docs
       (id, filename, filepath, status, organization_id, owner_id, scope, file_size_bytes,
        original_name, source_upload, chunk_count, version, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'doc-other-org',
        'other.txt',
        '/tmp/other.txt',
        'ready',
        'o-other',
        'u-docs-1',
        'user',
        12,
        'other.txt',
        'documents.library',
        1,
        1,
        now,
        now,
        null,
      ]
    );
    const res = await request(mount()).get(`${basePath}/all`);
    expect(res.status).toBe(200);
    const documents = readDocumentsArray(res.body) as Array<any>;
    const ids = documents.map((doc) => doc.id);
    expect(ids).toContain('doc-ready-visible');
    expect(ids).toContain('doc-ocr-visible');
    expect(ids).not.toContain('doc-other-org');
    expect(ids).not.toContain('doc-deleted-hidden');
    expect(documents.find((doc) => doc.id === 'doc-ocr-visible')).toEqual(
      expect.objectContaining({
        status: 'ocr_required',
        processingError: 'pdf_ocr_required_or_empty',
      })
    );
  });

  it('GET /api/documents exposes stale processing attention without running the worker', async () => {
    await request(mount()).get(basePath);
    const db = await import('../../../server/src/utils/DbPromise.js');
    const oldProcessingAt = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO knowledge_docs
       (id, filename, filepath, status, organization_id, owner_id, scope, file_size_bytes,
        original_name, source_upload, processing_error, chunk_count, version, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'doc-stale-processing-visible',
        'stale-processing.txt',
        '/tmp/stale-processing.txt',
        'processing',
        'o-docs-1',
        'u-docs-1',
        'user',
        12,
        'stale-processing.txt',
        'documents.library',
        null,
        0,
        1,
        oldProcessingAt,
        oldProcessingAt,
        null,
      ]
    );
    await db.run(
      `INSERT INTO organization_context_processing_jobs
       (id, organization_id, user_id, document_id, scope, pipeline_type, status, attempt_count,
        processor_version, source_upload, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'job-stale-processing-visible',
        'o-docs-1',
        'u-docs-1',
        'doc-stale-processing-visible',
        'user',
        'document_text_extraction',
        'processing',
        1,
        'context-document-pipeline-v1',
        'documents.library',
        oldProcessingAt,
        oldProcessingAt,
      ]
    );
    await db.run(
      `INSERT INTO audit_log
       (id, organization_id, user_id, action_type, resource_type, resource_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'audit-stale-processing-recovery',
        'o-docs-1',
        'u-docs-1',
        'organization_context.worker_run_requested',
        'organization_context_processing_jobs',
        'run-stale-processing',
        JSON.stringify({
          result: {
            processedJobs: [],
            retriedJobs: [{ jobId: 'job-stale-processing-visible', documentId: 'doc-stale-processing-visible' }],
          },
        }),
        now,
      ]
    );
    await db.run(
      `INSERT INTO knowledge_docs
       (id, filename, filepath, status, organization_id, owner_id, scope, file_size_bytes,
        original_name, source_upload, processing_error, chunk_count, version, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'doc-queued-processing-visible',
        'queued-processing.txt',
        '/tmp/queued-processing.txt',
        'processing',
        'o-docs-1',
        'u-docs-1',
        'user',
        12,
        'queued-processing.txt',
        'documents.library',
        null,
        0,
        1,
        now,
        now,
        null,
      ]
    );
    await db.run(
      `INSERT INTO organization_context_processing_jobs
       (id, organization_id, user_id, document_id, scope, pipeline_type, status, attempt_count,
        processor_version, source_upload, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'job-queued-processing-visible',
        'o-docs-1',
        'u-docs-1',
        'doc-queued-processing-visible',
        'user',
        'document_text_extraction',
        'queued',
        0,
        'context-document-pipeline-v1',
        'documents.library',
        now,
        now,
      ]
    );

    const res = await request(mount()).get(`${basePath}/user`);
    expect(res.status).toBe(200);
    const documents = readDocumentsArray(res.body) as Array<any>;

    expect(documents.find((doc) => doc.id === 'doc-stale-processing-visible')).toEqual(
      expect.objectContaining({
        status: 'processing',
        processingState: expect.objectContaining({
          status: 'stale_processing',
          attentionRequired: true,
          reason: 'processing_document_stale',
          jobId: 'job-stale-processing-visible',
          jobStatus: 'processing',
          attentionReadBack: expect.objectContaining({
            status: 'visible_to_user',
            observedAt: expect.any(String),
          }),
          recoveryAuditReadBack: expect.objectContaining({
            status: 'found',
            actionType: 'organization_context.worker_run_requested',
            recordedAt: now,
          }),
        }),
      })
    );
    expect(documents.find((doc) => doc.id === 'doc-queued-processing-visible')).toEqual(
      expect.objectContaining({
        status: 'processing',
        processingState: expect.objectContaining({
          status: 'queued',
          attentionRequired: false,
          jobId: 'job-queued-processing-visible',
          jobStatus: 'queued',
          attentionReadBack: expect.objectContaining({
            status: 'not_required',
            observedAt: null,
          }),
        }),
      })
    );

    const ackRes = await request(mount()).post(
      `${basePath}/doc-stale-processing-visible/processing-attention/ack`
    );
    expect(ackRes.status).toBe(200);
    expect(ackRes.body).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          acknowledged: true,
          reason: 'attention_acknowledged',
          document: expect.objectContaining({
            id: 'doc-stale-processing-visible',
            processingState: expect.objectContaining({
              acknowledgement: expect.objectContaining({
                status: 'acknowledged',
                acknowledgedAt: expect.any(String),
                acknowledgedByCurrentUser: true,
              }),
            }),
          }),
        }),
      })
    );
  });

});
