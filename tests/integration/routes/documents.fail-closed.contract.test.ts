// @vitest-environment node

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listAccessibleDocumentsMock = vi.fn();
const uploadAndIngestMock = vi.fn();

// The global test setup replaces multer with a raw-body compatibility stub.
// This contract exercises the real multipart boundary and must use multer's
// memory storage, otherwise the entire multipart envelope becomes `file.buffer`.
vi.unmock('multer');

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    if (req.get('x-test-auth') === 'none') {
      req.user = undefined;
    } else {
      req.user = { id: 'u-docs-1', organizationId: 'org-docs-1', role: 'ADMIN' };
    }
    next();
  },
}));

vi.mock('../../../server/src/services/organizationContext/ContextDocumentService.js', () => ({
  default: {
    listAccessibleDocuments: (...args: unknown[]) => listAccessibleDocumentsMock(...args),
    uploadAndIngest: (...args: unknown[]) => uploadAndIngestMock(...args),
    canAccessProject: vi.fn(async () => true),
  },
}));

import documentsRoutes from '../../../server/src/routes/documents.routes.ts';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';
import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';

describe('documents fail-closed contract', () => {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.use('/api/documents', documentsRoutes);
  app.use(errorHandlerMiddleware);

  beforeEach(() => {
    vi.clearAllMocks();
    listAccessibleDocumentsMock.mockResolvedValue([]);
    uploadAndIngestMock.mockResolvedValue({ documentId: 'doc-1' });
  });

  it('returns coded 500 when accessible document read fails without leaking internals', async () => {
    listAccessibleDocumentsMock.mockRejectedValueOnce(new Error('DOCUMENTS_INTERNAL_SECRET_READ'));

    const res = await request(app)
      .get('/api/documents/all')
      .set('X-Correlation-ID', 'pack10s3-documents-read-fail-1');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('DOCUMENTS_ACCESSIBLE_READ_FAILED');
    expect(res.body.error.message).toBe('Failed to load documents.');
    expect(res.body.correlationId).toBe('pack10s3-documents-read-fail-1');
    expect(JSON.stringify(res.body)).not.toContain('DOCUMENTS_INTERNAL_SECRET_READ');
  });

  it('returns coded 400 when upload is missing file', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('X-Correlation-ID', 'pack10s3-documents-upload-missing-file-1');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('DOCUMENTS_UPLOAD_FILE_REQUIRED');
    expect(res.body.error.message).toBe('File is required for upload.');
    expect(res.body.correlationId).toBe('pack10s3-documents-upload-missing-file-1');
  });

  it('returns coded 401 when upload auth context is missing', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('x-test-auth', 'none')
      .set('X-Correlation-ID', 'pack10s3-documents-unauthorized-1')
      .attach('file', Buffer.from('hello'), {
        filename: 'hello.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(401);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('DOCUMENTS_UNAUTHORIZED');
    expect(res.body.error.message).toBe('Authentication is required to upload documents.');
    expect(res.body.correlationId).toBe('pack10s3-documents-unauthorized-1');
  });

  it('accepts a real multipart upload at the positive boundary', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('X-Correlation-ID', 'pack10s3-documents-upload-ok-1')
      .attach('file', Buffer.from('hello'), {
        filename: 'hello.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      message: 'Document uploaded successfully',
      document: { documentId: 'doc-1' },
    });
    expect(uploadAndIngestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-docs-1',
        ownerId: 'u-docs-1',
        scope: 'user',
        sourceUpload: 'documents.library',
        file: expect.objectContaining({
          originalname: 'hello.txt',
          mimetype: 'text/plain',
          size: 5,
        }),
      })
    );
  });

  it('returns coded 500 when upload fails without leaking internals', async () => {
    uploadAndIngestMock.mockRejectedValueOnce(new Error('DOCUMENTS_INTERNAL_SECRET_UPLOAD'));

    const res = await request(app)
      .post('/api/documents/upload')
      .set('X-Correlation-ID', 'pack10s3-documents-upload-fail-1')
      .attach('file', Buffer.from('hello'), {
        filename: 'hello.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('DOCUMENTS_UPLOAD_FAILED');
    expect(res.body.error.message).toBe('Failed to upload document.');
    expect(res.body.correlationId).toBe('pack10s3-documents-upload-fail-1');
    expect(JSON.stringify(res.body)).not.toContain('DOCUMENTS_INTERNAL_SECRET_UPLOAD');
  });
});
