import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyTokenMock = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    verifyTokenMock(req);
    next();
  },
}));

vi.mock('../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/v8Auth.middleware.js', () => ({
  requireV8OrgContext: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/v8FeatureGate.middleware.js', () => ({
  v8OutputsGate: (_req: any, _res: any, next: any) => next(),
}));

const getArtifactForUserMock = vi.fn();
const createArtifactAccessGrantMock = vi.fn();

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  getArtifactForUser: (...args: any[]) => getArtifactForUserMock(...args),
  createArtifactAccessGrant: (...args: any[]) => createArtifactAccessGrantMock(...args),
}));

import artifactsRouter from '../../../server/src/routes/artifacts.routes.js';

describe('artifacts access routes (HTTP contract; artifactRegistryService mocked)', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/artifacts', artifactsRouter);

  beforeEach(() => {
    verifyTokenMock.mockReset();
    getArtifactForUserMock.mockReset();
    createArtifactAccessGrantMock.mockReset();
  });

  it('rejects access grant mutation for non-owner non-admin users', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'user-2', organizationId: 'org-1', role: 'USER' };
    });
    getArtifactForUserMock.mockResolvedValue({
      artifactId: 'art-1',
      ownerUserId: 'owner-1',
    });

    const res = await request(app)
      .post('/api/artifacts/art-1/access')
      .send({ grantKind: 'user', userId: 'user-3' });

    expect(res.status).toBe(403);
    expect(createArtifactAccessGrantMock).not.toHaveBeenCalled();
  });

  it('returns canonical action-target metadata for report artifacts', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
    });
    getArtifactForUserMock.mockResolvedValue({
      artifactId: 'art-1',
      originRuntime: 'report',
      originRecordId: 'report-77',
      ownerUserId: 'owner-1',
    });

    const res = await request(app).get('/api/artifacts/art-1/action-target');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        artifactId: 'art-1',
        originRuntime: 'report',
        originRecordId: 'report-77',
        openPath: '/reports/builder/report-77',
        exportPath: '/api/report-builder/report-77/export/pdf',
        deletePath: '/api/report-builder/report-77',
        reviewPath: '/api/artifacts/art-1/start-review',
        authority: 'report_builder',
      },
    });
  });

  it('returns canonical action-target metadata for presentation artifacts', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
    });
    getArtifactForUserMock.mockResolvedValue({
      artifactId: 'art-2',
      originRuntime: 'presentation',
      originRecordId: 'deck-77',
      ownerUserId: 'owner-1',
    });

    const res = await request(app).get('/api/artifacts/art-2/action-target');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        artifactId: 'art-2',
        originRuntime: 'presentation',
        originRecordId: 'deck-77',
        openPath: '/presentations/builder/deck-77',
        exportPath: '/api/presentations/decks/deck-77/download',
        deletePath: '/api/presentations/decks/deck-77',
        reviewPath: '/api/artifacts/art-2/start-review',
        authority: 'presentations_runtime',
      },
    });
  });

  it('allows access grant mutation for artifact owners', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'owner-1', organizationId: 'org-1', role: 'USER' };
    });
    getArtifactForUserMock.mockResolvedValue({
      artifactId: 'art-1',
      ownerUserId: 'owner-1',
    });
    createArtifactAccessGrantMock.mockResolvedValue({
      grantId: 'grant-1',
      artifactId: 'art-1',
      grantKind: 'user',
      userId: 'user-3',
      roleKey: null,
      organizationId: 'org-1',
      createdBy: 'owner-1',
      createdAt: '2026-03-24T00:00:00.000Z',
    });

    const res = await request(app)
      .post('/api/artifacts/art-1/access')
      .send({ grantKind: 'user', userId: 'user-3' });

    expect(res.status).toBe(201);
    expect(createArtifactAccessGrantMock).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactId: 'art-1',
        createdBy: 'owner-1',
        userId: 'user-3',
      }),
    );
  });
});
