import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

const contextDocumentServiceMock = vi.hoisted(() => ({
  listAccessibleDocuments: vi.fn(),
  canAccessProject: vi.fn(),
  uploadAndIngest: vi.fn(),
}));
const permissionServiceMock = { hasPermission: vi.fn() };

vi.mock('../../../server/src/services/organizationContext/ContextDocumentService.js', () => ({
  default: contextDocumentServiceMock,
}));

describe('V8 interview context document routes', () => {
  const prevEnv = { ...process.env };
  let router: any;
  let permissionMiddleware: any;

  const mount = () =>
    makeTestApp({
      mountPath: '/api/v8/interview',
      router,
      beforeMount: (app) => {
        app.use((req, _res, next) => {
          (req as any).user = {
            id: 'user-1',
            organizationId: 'org-1',
            role: 'admin',
            isSuperAdmin: false,
          };
          (req as any).userId = 'user-1';
          (req as any).organizationId = 'org-1';
          (req as any).userRole = 'admin';
          (req as any).v8Context = {
            organizationId: 'org-1',
            userId: 'user-1',
            userRole: 'admin',
            isSuperAdmin: false,
          };
          next();
        });
      },
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    vi.resetModules();
    permissionMiddleware = await import('../../../server/src/middleware/permission.middleware.ts');
    router = (await import('../../../server/src/routes/v8/interview.routes.ts')).default;
  });

  beforeEach(() => {
    // ★ DAY211 — reinstall after the global beforeEach clears chained mock
    // implementations; the imported middleware remains the same instance.
    permissionMiddleware.setDependencies({
      PermissionService: {
        hasPermission: permissionServiceMock.hasPermission.mockReset().mockResolvedValue(true),
      },
    });
    contextDocumentServiceMock.listAccessibleDocuments.mockReset().mockResolvedValue([]);
    contextDocumentServiceMock.canAccessProject.mockReset().mockResolvedValue(true);
    contextDocumentServiceMock.uploadAndIngest.mockReset().mockResolvedValue({
      id: 'doc-v8-1',
      filename: 'context.txt',
      status: 'ready',
      scope: 'user',
      projectId: null,
      ownerId: 'user-1',
      sourceUpload: 'interview.insight_creator',
    });
  });

  afterAll(() => {
    process.env = prevEnv;
  });

  it('lists context documents through the V8 tenant-scoped service contract', async () => {
    contextDocumentServiceMock.listAccessibleDocuments.mockResolvedValueOnce([
      {
        id: 'doc-ready',
        filename: 'ready.txt',
        status: 'ready',
      },
    ]);

    const res = await request(mount()).get(
      '/api/v8/interview/context-documents?scope=user&statuses=ready'
    );

    expect(res.status).toBe(200);
    expect(contextDocumentServiceMock.listAccessibleDocuments).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'user-1',
      scope: 'user',
      projectId: undefined,
      statuses: ['ready'],
    });
    expect(res.body).toEqual(
      expect.objectContaining({
        data: {
          documents: [expect.objectContaining({ id: 'doc-ready', status: 'ready' })],
        },
        meta: expect.objectContaining({ contract: 'interview_insight_read_v1' }),
      })
    );
  });

  it('uploads context documents through backend ingestion with interview source attribution', async () => {
    const res = await request(mount())
      .post('/api/v8/interview/context-documents/upload')
      .field('scope', 'user')
      .attach('file', Buffer.from('hello context'), {
        filename: 'context.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(201);
    expect(contextDocumentServiceMock.uploadAndIngest).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        ownerId: 'user-1',
        scope: 'user',
        projectId: null,
        sourceUpload: 'interview.insight_creator',
        file: expect.objectContaining({
          originalname: 'context.txt',
          mimetype: 'text/plain',
        }),
      })
    );
    expect(res.body).toEqual(
      expect.objectContaining({
        data: {
          document: expect.objectContaining({
            id: 'doc-v8-1',
            sourceUpload: 'interview.insight_creator',
          }),
        },
        meta: expect.objectContaining({ contract: 'interview_insight_mutation_v1' }),
      })
    );
  });

  it('returns honest quota_blocked contract for V8 context upload quota failures', async () => {
    contextDocumentServiceMock.uploadAndIngest.mockRejectedValueOnce(
      Object.assign(new Error('Storage quota exceeded'), {
        code: 'CONTEXT_STORAGE_QUOTA_EXCEEDED',
        document: {
          id: 'doc-blocked',
          status: 'quota_blocked',
          processingError: 'CONTEXT_STORAGE_QUOTA_EXCEEDED',
        },
        quota: { bytesRequested: 42 },
      })
    );

    const res = await request(mount())
      .post('/api/v8/interview/context-documents/upload')
      .attach('file', Buffer.from('hello context'), {
        filename: 'quota.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(429);
    expect(res.body).toEqual(
      expect.objectContaining({
        code: 'CONTEXT_STORAGE_QUOTA_EXCEEDED',
        data: {
          document: expect.objectContaining({
            id: 'doc-blocked',
            status: 'quota_blocked',
          }),
          quota: { bytesRequested: 42 },
        },
        meta: expect.objectContaining({ contract: 'interview_insight_mutation_v1' }),
      })
    );
  });
});
