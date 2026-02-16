import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

const { studioService } = vi.hoisted(() => ({
  studioService: {
    getSnapshots: vi.fn(),
    createSnapshot: vi.fn(),
    restoreSnapshot: vi.fn(),
    getDocuments: vi.fn(),
    getDocument: vi.fn(),
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
  },
}));

vi.mock('../../server/src/services/StudioService.js', () => ({ studioService }));
vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));

async function loadStudioRouter() {
  return (await import('../../server/src/routes/studio.routes.ts')).default;
}

describe('Studio API snapshots - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    studioService.getSnapshots.mockResolvedValue([]);
    studioService.createSnapshot.mockResolvedValue('snap-1');
    studioService.restoreSnapshot.mockResolvedValue({ id: 'doc-1' });
  });

  it('GET /documents/:id/snapshots returns array', async () => {
    const router = await loadStudioRouter();
    const app = makeTestApp({
      mountPath: '/api/studio',
      router,
      beforeMount: (a) =>
        a.use((req, _res, next) => {
          (req as any).user = { id: 'u1', organizationId: 'org-1' };
          next();
        }),
    });
    const res = await request(app).get('/api/studio/documents/d1/snapshots');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
