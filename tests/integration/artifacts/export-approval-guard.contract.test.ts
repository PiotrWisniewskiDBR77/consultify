/**
 * Contract test: M17/L-01 — server-side 403 guard on artifact export endpoints.
 *
 * Verified contracts:
 *  - draft artifact   → 403 EXPORT_NOT_APPROVED (both endpoints)
 *  - approved artifact → 200 (proceeds to service call)
 *  - published artifact → 200 (proceeds to service call)
 *  - artifact not found → 404
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any `import` of the module under test
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  getArtifactForUser: vi.fn(),
  buildWave5ExportManifest: vi.fn(),
  markWave5ArtifactExported: vi.fn(),
  verifyTokenImpl: vi.fn((req: any, _res: any, next: any) => {
    req.user = { id: 'u1', organizationId: 'org1', role: 'admin' };
    next();
  }),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: any) => mocks.verifyTokenImpl(req, res, next),
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

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  getArtifactForUser: (...args: any[]) => mocks.getArtifactForUser(...args),
  // stubs for other route handlers that import from this service
  listArtifactsForUser: vi.fn().mockResolvedValue([]),
  createArtifactAccessGrant: vi.fn(),
  getArtifactOriginLinks: vi.fn().mockResolvedValue([]),
  getArtifactAccessGrantsForArtifact: vi.fn().mockResolvedValue([]),
  startArtifactReview: vi.fn(),
  deriveArtifactValidationSnapshot: vi.fn().mockReturnValue({ state: 'validated', checks: [] }),
}));

vi.mock('../../../server/src/services/wave5ArtifactRuntimeService.js', () => ({
  buildWave5ExportManifest: (...args: any[]) => mocks.buildWave5ExportManifest(...args),
  markWave5ArtifactExported: (...args: any[]) => mocks.markWave5ArtifactExported(...args),
  // stubs for other exports used elsewhere in the router
  approveAndCommitWave5Mutation: vi.fn(),
  approveWave5Mutation: vi.fn(),
  commitWave5Mutation: vi.fn(),
  createWave5Artifact: vi.fn(),
  fillWave5DocumentTemplate: vi.fn(),
  generateWave5StructuredArtifact: vi.fn(),
  getWave5Artifact: vi.fn(),
  listWave5Artifacts: vi.fn().mockResolvedValue([]),
  listWave5ArtifactVersions: vi.fn().mockResolvedValue([]),
  listWave5Mutations: vi.fn().mockResolvedValue([]),
  proposeWave5Mutation: vi.fn(),
  rejectWave5Mutation: vi.fn(),
  WAVE5_ARTIFACT_LIFECYCLE: [],
  WAVE5_ARTIFACT_TYPES: [],
}));

vi.mock('../../../server/src/services/v8/executionSpineService.js', () => ({
  getRun: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../server/src/services/v8/reportsPresModelService.js', () => ({
  getExportHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../server/src/services/v8/publishReviewService.js', () => ({
  getPublishRecord: vi.fn().mockResolvedValue(null),
  transitionPublishState: vi.fn(),
  submitReviewGate: vi.fn(),
}));

vi.mock('../../../server/src/services/organizationService.js', () => ({
  getMembers: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../server/src/services/ActivityService.js', () => ({
  default: { log: vi.fn() },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: vi.fn().mockResolvedValue(null),
  run: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import the router AFTER all vi.mock() calls
// ---------------------------------------------------------------------------
import artifactsRouter from '../../../server/src/routes/artifacts.routes.js';

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use('/api/artifacts', artifactsRouter);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ARTIFACT_ID = 'art-export-1';
const MANIFEST_PATH = `/api/artifacts/wave5/${ARTIFACT_ID}/export-manifest`;
const EXPORTED_PATH = `/api/artifacts/wave5/${ARTIFACT_ID}/exported`;

function makeArtifact(publishState: string) {
  return {
    artifactId: ARTIFACT_ID,
    publishState,
    ownerUserId: 'u1',
    organizationId: 'org1',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('artifact export approval guard (M17/L-01)', () => {
  beforeEach(() => {
    mocks.getArtifactForUser.mockReset();
    mocks.buildWave5ExportManifest.mockReset();
    mocks.markWave5ArtifactExported.mockReset();
  });

  // -----------------------------------------------------------------------
  // GET /wave5/:artifactId/export-manifest
  // -----------------------------------------------------------------------
  describe('GET /wave5/:artifactId/export-manifest', () => {
    it('returns 403 EXPORT_NOT_APPROVED when artifact is in draft state', async () => {
      mocks.getArtifactForUser.mockResolvedValue(makeArtifact('draft'));

      const res = await request(app).get(MANIFEST_PATH);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: 'EXPORT_NOT_APPROVED',
        publishState: 'draft',
      });
      expect(mocks.buildWave5ExportManifest).not.toHaveBeenCalled();
    });

    it('returns 403 EXPORT_NOT_APPROVED when artifact is in review state', async () => {
      mocks.getArtifactForUser.mockResolvedValue(makeArtifact('review'));

      const res = await request(app).get(MANIFEST_PATH);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('EXPORT_NOT_APPROVED');
      expect(mocks.buildWave5ExportManifest).not.toHaveBeenCalled();
    });

    it('returns 404 when artifact not found', async () => {
      mocks.getArtifactForUser.mockResolvedValue(null);

      const res = await request(app).get(MANIFEST_PATH);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false, error: 'Artifact not found' });
      expect(mocks.buildWave5ExportManifest).not.toHaveBeenCalled();
    });

    it('proceeds and returns manifest when artifact is approved', async () => {
      mocks.getArtifactForUser.mockResolvedValue(makeArtifact('approved'));
      const fakeManifest = { files: ['deck.pptx'], checksum: 'abc123' };
      mocks.buildWave5ExportManifest.mockResolvedValue(fakeManifest);

      const res = await request(app).get(MANIFEST_PATH);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, manifest: fakeManifest });
      expect(mocks.buildWave5ExportManifest).toHaveBeenCalledWith(ARTIFACT_ID, 'org1');
    });

    it('proceeds and returns manifest when artifact is published', async () => {
      mocks.getArtifactForUser.mockResolvedValue(makeArtifact('published'));
      const fakeManifest = { files: ['deck.pptx'], checksum: 'xyz789' };
      mocks.buildWave5ExportManifest.mockResolvedValue(fakeManifest);

      const res = await request(app).get(MANIFEST_PATH);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, manifest: fakeManifest });
    });
  });

  // -----------------------------------------------------------------------
  // POST /wave5/:artifactId/exported
  // -----------------------------------------------------------------------
  describe('POST /wave5/:artifactId/exported', () => {
    it('returns 403 EXPORT_NOT_APPROVED when artifact is in draft state', async () => {
      mocks.getArtifactForUser.mockResolvedValue(makeArtifact('draft'));

      const res = await request(app).post(EXPORTED_PATH).send({});

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: 'EXPORT_NOT_APPROVED',
        publishState: 'draft',
      });
      expect(mocks.markWave5ArtifactExported).not.toHaveBeenCalled();
    });

    it('returns 404 when artifact not found', async () => {
      mocks.getArtifactForUser.mockResolvedValue(null);

      const res = await request(app).post(EXPORTED_PATH).send({});

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false, error: 'Artifact not found' });
      expect(mocks.markWave5ArtifactExported).not.toHaveBeenCalled();
    });

    it('proceeds and marks exported when artifact is approved', async () => {
      mocks.getArtifactForUser.mockResolvedValue(makeArtifact('approved'));
      const updatedArtifact = { artifactId: ARTIFACT_ID, publishState: 'approved', exported: true };
      mocks.markWave5ArtifactExported.mockResolvedValue(updatedArtifact);

      const res = await request(app).post(EXPORTED_PATH).send({});

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, artifact: updatedArtifact });
      expect(mocks.markWave5ArtifactExported).toHaveBeenCalledWith(ARTIFACT_ID, 'org1');
    });

    it('proceeds and marks exported when artifact is published', async () => {
      mocks.getArtifactForUser.mockResolvedValue(makeArtifact('published'));
      const updatedArtifact = { artifactId: ARTIFACT_ID, publishState: 'published', exported: true };
      mocks.markWave5ArtifactExported.mockResolvedValue(updatedArtifact);

      const res = await request(app).post(EXPORTED_PATH).send({});

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, artifact: updatedArtifact });
    });
  });
});
