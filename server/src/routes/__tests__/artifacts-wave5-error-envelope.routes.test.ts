/**
 * M17 — Wave5 artifact runtime error-envelope regression tests.
 *
 * Covers the INFO-DISCLOSURE / not-found→404 sweep:
 *   1. A runtime "Artifact not found" maps to HTTP 404 (not a generic 500),
 *      preserving the `{ success: false, error }` response shape.
 *   2. A runtime conflict ("Mutation is ...") maps to HTTP 409.
 *   3. An unexpected/raw error never leaks its raw message in the 5xx body —
 *      the client receives a stable generic message instead.
 *
 * Strategy: the auth + tenant + audit middlewares are mocked to pass-through
 * with a deterministic user, and the wave5 runtime service is mocked so each
 * handler can be forced down a specific throw path.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUser = { id: 'user-w5-1', organizationId: 'org-w5-A', role: 'CONSULTANT' };

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
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
  requireAudit: (req: any, _res: any, next: () => void) => {
    req.emitAuditEvent = async () => undefined;
    next();
  },
}));

// Mock the wave5 runtime service so each handler can be forced down a throw path.
const proposeWave5Mutation = vi.fn();
const getWave5Artifact = vi.fn();
const buildWave5ExportManifest = vi.fn();
const commitWave5Mutation = vi.fn();

vi.mock('../../services/wave5ArtifactRuntimeService.js', () => ({
  WAVE5_ARTIFACT_TYPES: ['document'],
  WAVE5_ARTIFACT_LIFECYCLE: [],
  proposeWave5Mutation: (...args: unknown[]) => proposeWave5Mutation(...args),
  getWave5Artifact: (...args: unknown[]) => getWave5Artifact(...args),
  buildWave5ExportManifest: (...args: unknown[]) => buildWave5ExportManifest(...args),
  commitWave5Mutation: (...args: unknown[]) => commitWave5Mutation(...args),
  // Unused-by-these-tests exports still need to exist for the router import.
  approveAndCommitWave5Mutation: vi.fn(),
  approveWave5Mutation: vi.fn(),
  createWave5Artifact: vi.fn(),
  fillWave5DocumentTemplate: vi.fn(),
  generateWave5StructuredArtifact: vi.fn(),
  listWave5Artifacts: vi.fn(),
  listWave5ArtifactVersions: vi.fn(),
  listWave5Mutations: vi.fn(),
  markWave5ArtifactExported: vi.fn(),
  rejectWave5Mutation: vi.fn(),
}));

import artifactRoutes from '../artifacts.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/artifacts', artifactRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('M17 wave5 error-envelope', () => {
  it('maps a runtime "Artifact not found" to HTTP 404 with the existing shape', async () => {
    buildWave5ExportManifest.mockRejectedValueOnce(new Error('Artifact not found'));
    const res = await request(createApp()).get(
      '/api/artifacts/wave5/missing-artifact/export-manifest'
    );
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'Artifact not found' });
  });

  it('maps a runtime "Mutation proposal not found" to HTTP 404', async () => {
    commitWave5Mutation.mockRejectedValueOnce(new Error('Mutation proposal not found'));
    const res = await request(createApp()).post(
      '/api/artifacts/wave5/mutations/missing-mut/commit'
    );
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'Mutation proposal not found' });
  });

  it('maps a runtime conflict ("Mutation is ...") to HTTP 409', async () => {
    commitWave5Mutation.mockRejectedValueOnce(new Error('Mutation is rejected, not approved'));
    const res = await request(createApp()).post('/api/artifacts/wave5/mutations/mut-1/commit');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: 'Mutation is rejected, not approved' });
  });

  it('never leaks a raw error message in a 5xx body', async () => {
    const rawSecret = 'pg: relation "wave5_artifacts" does not exist at /srv/app/db.ts:42';
    proposeWave5Mutation.mockRejectedValueOnce(new Error(rawSecret));
    const res = await request(createApp())
      .post('/api/artifacts/wave5/art-1/mutations')
      .send({ proposedContent: 'x' });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain('wave5_artifacts');
    expect(JSON.stringify(res.body)).not.toContain('/srv/app/db.ts');
    expect(res.body.error).toBe('An unexpected error occurred. Please try again later.');
  });
});
