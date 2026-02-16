import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

const { studioService } = vi.hoisted(() => ({
  studioService: {
    getDocuments: vi.fn(),
    getDocument: vi.fn(),
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
    getSnapshots: vi.fn(),
    createSnapshot: vi.fn(),
    restoreSnapshot: vi.fn(),
  },
}));

vi.mock('../../server/src/services/StudioService.js', () => ({
  studioService,
}));

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));

async function loadStudioRouter() {
  return (await import('../../server/src/routes/studio.routes.ts')).default;
}

async function makeStudioApp(opts?: { user?: { id: string; organizationId?: string } }) {
  const router = await loadStudioRouter();
  return makeTestApp({
    mountPath: '/api/studio',
    router,
    beforeMount: (app) => {
      if (!opts?.user) return;
      app.use((req, _res, next) => {
        (req as any).user = opts.user;
        next();
      });
    },
  });
}

describe('Studio flow routes - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    studioService.getDocuments.mockResolvedValue([]);
    studioService.getDocument.mockResolvedValue(null);
    studioService.createDocument.mockResolvedValue({ id: 'd1' });
    studioService.updateDocument.mockResolvedValue(null);
    studioService.deleteDocument.mockResolvedValue(false);
  });

  it('GET /documents returns 401 when user is missing', async () => {
    const app = await makeStudioApp();
    const res = await request(app).get('/api/studio/documents');
    expect(res.status).toBe(401);
  });

  it('GET /documents returns documents and calls service with org + user', async () => {
    studioService.getDocuments.mockResolvedValueOnce([{ id: 'd1' }]);
    const app = await makeStudioApp({ user: { id: 'u1', organizationId: 'org1' } });
    const res = await request(app).get('/api/studio/documents');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'd1' }]);
    expect(studioService.getDocuments).toHaveBeenCalledWith('org1', 'u1');
  });

  it('GET /documents/:id returns 404 when document is missing', async () => {
    studioService.getDocument.mockResolvedValueOnce(null);
    const app = await makeStudioApp({ user: { id: 'u1', organizationId: 'org1' } });
    const res = await request(app).get('/api/studio/documents/d404');
    expect(res.status).toBe(404);
  });

  it('POST /documents returns 201 and passes payload to service', async () => {
    studioService.createDocument.mockResolvedValueOnce({ id: 'd2', name: 'N' });
    const app = await makeStudioApp({ user: { id: 'u1', organizationId: 'org1' } });
    const res = await request(app).post('/api/studio/documents').send({ name: 'N', nodes: [] });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({ id: 'd2' }));
    expect(studioService.createDocument).toHaveBeenCalledWith('org1', 'u1', expect.any(Object));
  });

  it('DELETE /documents/:id returns 404 when service returns false', async () => {
    studioService.deleteDocument.mockResolvedValueOnce(false);
    const app = await makeStudioApp({ user: { id: 'u1', organizationId: 'org1' } });
    const res = await request(app).delete('/api/studio/documents/dx');
    expect(res.status).toBe(404);
  });
});
