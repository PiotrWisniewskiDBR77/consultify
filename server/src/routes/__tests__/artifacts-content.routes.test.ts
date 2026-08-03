import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const resolved = vi.hoisted(() => ({
  resolve: vi.fn(),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-a', role: 'CONSULTANT' };
    next();
  },
}));
vi.mock('../../middleware/v8Auth.middleware.js', () => ({
  requireV8OrgContext: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/v8FeatureGate.middleware.js', () => ({
  v8OutputsGate: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../services/artifacts/artifactContentResolverService.js', () => ({
  resolveArtifactContent: (...args: unknown[]) => resolved.resolve(...args),
}));
vi.mock('../../services/wave5ArtifactRuntimeService.js', () => ({
  WAVE5_ARTIFACT_TYPES: ['document'],
  WAVE5_ARTIFACT_LIFECYCLE: [],
  approveAndCommitWave5Mutation: vi.fn(),
  approveWave5Mutation: vi.fn(),
  buildWave5ExportManifest: vi.fn(),
  commitWave5Mutation: vi.fn(),
  createWave5Artifact: vi.fn(),
  fillWave5DocumentTemplate: vi.fn(),
  generateWave5StructuredArtifact: vi.fn(),
  getWave5Artifact: vi.fn(),
  listWave5Artifacts: vi.fn(),
  listWave5ArtifactVersions: vi.fn(),
  listWave5Mutations: vi.fn(),
  markWave5ArtifactExported: vi.fn(),
  proposeWave5Mutation: vi.fn(),
  rejectWave5Mutation: vi.fn(),
}));

import artifactRoutes from '../artifacts.routes.js';

const payload = {
  artifactId: 'artifact-1',
  origin: { originRuntime: 'test_runtime', originRecordId: 'origin-1' },
  originRevision: 'rev-1',
  contentHash: 'a'.repeat(64),
  resolvedAt: '2026-07-31T12:00:00.000Z',
  etag: `"${'b'.repeat(64)}"`,
  envelope: {
    envelopeVersion: 'artifact-content/v1',
    canonicalFormat: 'markdown',
    canonicalKind: 'document',
    contentSchemaVersion: 'document/v1',
    contentMd: '# Content',
    projection: {
      status: 'synced',
      projectedAt: '2026-07-31T12:00:00.000Z',
      error: null,
      completeness: 'full',
      projectedFromRevision: 'rev-1',
      projectedFromHash: null,
    },
    provenance: {
      originRuntime: 'test_runtime',
      originRecordId: 'origin-1',
      originRevision: 'rev-1',
    },
    artifactType: 'document',
    markdownProjectionStatus: 'synced',
  },
};

describe('GET /api/artifacts/:id/content', () => {
  const app = express();
  app.use('/api/artifacts', artifactRoutes);

  it('returns read-back metadata, V1 envelope and ETag', async () => {
    resolved.resolve.mockResolvedValueOnce(payload);
    const response = await request(app).get('/api/artifacts/artifact-1/content');
    expect(response.status).toBe(200);
    expect(response.headers.etag).toBe(payload.etag);
    const { etag: _etag, ...expectedPayload } = payload;
    expect(response.body.data).toEqual(expectedPayload);
    expect(response.body.data).not.toHaveProperty('etag');
    expect(resolved.resolve).toHaveBeenCalledWith({
      artifactId: 'artifact-1',
      organizationId: 'org-a',
    });
  });

  it('returns 304 for a matching If-None-Match ETag', async () => {
    resolved.resolve.mockResolvedValueOnce(payload);
    const response = await request(app)
      .get('/api/artifacts/artifact-1/content')
      .set('If-None-Match', payload.etag);
    expect(response.status).toBe(304);
    expect(response.text).toBe('');
    expect(response.headers.etag).toBe(payload.etag);
  });
});
