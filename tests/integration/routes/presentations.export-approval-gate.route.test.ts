/**
 * M17 integrity fix (07-15 audit) — route-level contract for the export
 * approval gate on the presentation deck export paths
 * (`/decks/:id/download` pptx, `/decks/:deckId/export/pdf`).
 *
 * Mirrors `presentations.export-gate.route.test.ts`'s mocking strategy
 * (quality-gate contract) but drives the NEW approval gate instead: a
 * gated (non-null, non-approved) `publishState` on the artifact returned by
 * `artifactRegistryService.getArtifactByOrigin` must not block by default
 * (shadow mode) but must 403 EXPORT_NOT_APPROVED once
 * `EXPORT_APPROVAL_ENFORCE=true`.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mockUser: any = {
  id: 'user-1',
  role: 'OWNER',
  organizationId: 'org-A',
};

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = mockUser;
    req.userId = mockUser?.id;
    req.userRole = mockUser?.role;
    req.organizationId = mockUser?.organizationId;
    next();
  },
}));

vi.mock('../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../server/src/services/notificationService.js', () => ({
  send: vi.fn(),
}));

vi.mock('../../../server/src/services/OrgPoliciesService.js', () => ({
  requireNoLegalHold: vi.fn().mockResolvedValue(undefined),
  OrgPoliciesError: class OrgPoliciesError extends Error {},
}));

vi.mock('../../../server/src/services/presentationGeneratorService.js', () => ({
  generateDeck: vi.fn(),
  generateOutline: vi.fn(),
}));

const getArtifactByOriginMock = vi.fn();
const getArtifactApprovalStatusMock = vi.fn();
const submitForReviewMock = vi.fn();
const approveArtifactMock = vi.fn();
const rejectArtifactMock = vi.fn();

vi.mock('../../../server/src/services/artifactApprovalService.js', () => ({
  default: {
    getArtifactApprovalStatus: (...args: any[]) => getArtifactApprovalStatusMock(...args),
    submitForReview: (...args: any[]) => submitForReviewMock(...args),
    approveArtifact: (...args: any[]) => approveArtifactMock(...args),
    rejectArtifact: (...args: any[]) => rejectArtifactMock(...args),
  },
}));

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  getArtifactByOrigin: (...args: any[]) => getArtifactByOriginMock(...args),
  getArtifactByOriginUnscoped: vi.fn(),
  registerArtifactOrigin: vi.fn(),
  mapPresentationStatusToDeliveryState: vi.fn(() => 'delivered'),
  deriveArtifactVisibilityScope: vi.fn(() => 'private'),
}));

vi.mock('../../../server/src/services/v8/reportsPresModelService.js', () => ({
  recordCompletedExport: vi.fn().mockResolvedValue(undefined),
}));

const { mockCheckGates } = vi.hoisted(() => ({ mockCheckGates: vi.fn() }));
vi.mock('../../../server/src/services/presentationQualityGatesService.js', () => ({
  checkDeckQualityGates: mockCheckGates,
}));

const DECK_ROW = {
  id: 'deck-1',
  organization_id: 'org-A',
  title: 'Q3 Steering Deck',
  theme: 'corporate',
  deck_json: JSON.stringify({
    schemaVersion: 1,
    cards: [
      { card_id: 'c1', intent: 'cover', title: 'Cover', blocks: [] },
      { card_id: 'c2', intent: 'executive_summary', title: 'Summary', blocks: [] },
    ],
  }),
  export_path: '/tmp/export-does-not-exist.pptx',
  version: 2,
  updated_at: '2026-08-09T01:00:00.000Z',
  confidentiality: 'internal',
};

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(DECK_ROW),
  run: vi.fn().mockResolvedValue(undefined),
}));

function passingGateReport() {
  return {
    canExport: true,
    canShare: true,
    result: 'PASS',
    scorecard: { p0: 0, p1: 0, p2: 0, passVocabulary: 'PASS' },
    gates: [],
  };
}

async function buildApp() {
  vi.resetModules();
  const { default: router } = await import('../../../server/src/routes/presentations.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/presentations', router);
  return app;
}

describe('M17 — presentation deck export-approval gate', () => {
  const ORIGINAL_ENFORCE = process.env.EXPORT_APPROVAL_ENFORCE;

  beforeEach(() => {
    mockCheckGates.mockReset();
    mockCheckGates.mockResolvedValue(passingGateReport());
    getArtifactByOriginMock.mockReset();
    getArtifactApprovalStatusMock.mockReset();
    getArtifactApprovalStatusMock.mockResolvedValue({ state: 'draft', assignment: null });
    submitForReviewMock.mockReset();
    submitForReviewMock.mockResolvedValue({ id: 'review-1', status: 'PENDING' });
    approveArtifactMock.mockReset();
    approveArtifactMock.mockResolvedValue({ id: 'review-1', status: 'APPROVED' });
    rejectArtifactMock.mockReset();
    rejectArtifactMock.mockResolvedValue({ id: 'review-1', status: 'REJECTED' });
    mockUser = { id: 'user-1', role: 'OWNER', organizationId: 'org-A' };
    delete process.env.EXPORT_APPROVAL_ENFORCE;
  });

  afterEach(() => {
    if (ORIGINAL_ENFORCE === undefined) delete process.env.EXPORT_APPROVAL_ENFORCE;
    else process.env.EXPORT_APPROVAL_ENFORCE = ORIGINAL_ENFORCE;
  });

  describe('version-pinned approval workflow', () => {
    it('submits the current immutable deck version for review', async () => {
      const app = await buildApp();

      const res = await request(app)
        .post('/presentations/decks/deck-1/approval/submit')
        .send({ assignedToUserId: 'reviewer-2' });

      expect(res.status).toBe(201);
      expect(submitForReviewMock).toHaveBeenCalledWith({
        orgId: 'org-A',
        artifactType: 'presentation_version',
        artifactId: 'deck-1@2',
        assignedToUserId: 'reviewer-2',
        submittedBy: 'user-1',
      });
      expect(res.body.data).toMatchObject({
        versionId: '2',
        currentForVersion: false,
      });
    });

    it('approves and rejects only the current deck version', async () => {
      const app = await buildApp();

      const approved = await request(app).post('/presentations/decks/deck-1/approval/approve');
      const rejected = await request(app)
        .post('/presentations/decks/deck-1/approval/reject')
        .send({ reason: 'Missing approved source' });

      expect(approved.status).toBe(200);
      expect(approveArtifactMock).toHaveBeenCalledWith(
        expect.objectContaining({
          artifactType: 'presentation_version',
          artifactId: 'deck-1@2',
          approvedByUserId: 'user-1',
        })
      );
      expect(rejected.status).toBe(200);
      expect(rejectArtifactMock).toHaveBeenCalledWith(
        expect.objectContaining({
          artifactType: 'presentation_version',
          artifactId: 'deck-1@2',
          rejectedByUserId: 'user-1',
          reason: 'Missing approved source',
        })
      );
    });

    it('treats approval for an older version as stale after a material edit', async () => {
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: 'approved',
      });
      getArtifactApprovalStatusMock.mockImplementation(
        async (_orgId: string, _type: string, artifactId: string) =>
          artifactId === 'deck-1@1'
            ? { state: 'approved', assignment: { id: 'old-review' } }
            : { state: 'draft', assignment: null }
      );
      const app = await buildApp();

      const res = await request(app).get('/presentations/decks/deck-1/download?mode=final');

      expect(res.status).toBe(409);
      expect(res.body.blocks).toContain('CURRENT_APPROVAL_REQUIRED');
      expect(getArtifactApprovalStatusMock).toHaveBeenCalledWith(
        'org-A',
        'presentation_version',
        'deck-1@2'
      );
    });
  });

  describe('GET /decks/:id/download (pptx)', () => {
    it('explicit final mode fails closed when no current approval exists', async () => {
      getArtifactByOriginMock.mockResolvedValue({ artifactId: 'artifact-1', publishState: null });
      const app = await buildApp();

      const res = await request(app).get('/presentations/decks/deck-1/download?mode=final');

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        success: false,
        code: 'ARTIFACT_EXPORT_BLOCKED',
        mode: 'final',
        blocks: ['CURRENT_APPROVAL_REQUIRED'],
      });
    });

    it('explicit draft mode bypasses approval and quality gates and is labelled as draft', async () => {
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: 'changes_requested',
      });
      mockCheckGates.mockResolvedValue({
        ...passingGateReport(),
        canExport: false,
        result: 'BLOCKED_P0',
      });
      const app = await buildApp();

      const res = await request(app).get('/presentations/decks/deck-1/download?mode=draft');

      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(422);
    });

    it('explicit final override requires a non-empty reason', async () => {
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: 'approved',
      });
      getArtifactApprovalStatusMock.mockResolvedValue({ state: 'approved', assignment: {} });
      const app = await buildApp();

      const res = await request(app).get(
        '/presentations/decks/deck-1/download?mode=final&overrideQualityGate=true'
      );

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        code: 'ARTIFACT_EXPORT_BLOCKED',
        blocks: ['OVERRIDE_REASON_REQUIRED'],
      });
    });

    it('shadow mode (default): gated publishState does not block with 403', async () => {
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: 'changes_requested',
      });
      const app = await buildApp();

      const res = await request(app).get('/presentations/decks/deck-1/download');

      expect(res.status).not.toBe(403);
    });

    it('enforce mode: gated publishState -> 403 EXPORT_NOT_APPROVED', async () => {
      process.env.EXPORT_APPROVAL_ENFORCE = 'true';
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: 'changes_requested',
      });
      const app = await buildApp();

      const res = await request(app).get('/presentations/decks/deck-1/download');

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ success: false, code: 'EXPORT_NOT_APPROVED' });
    });

    it('enforce mode: approved publishState -> not blocked by the approval gate', async () => {
      process.env.EXPORT_APPROVAL_ENFORCE = 'true';
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: 'approved',
      });
      const app = await buildApp();

      const res = await request(app).get('/presentations/decks/deck-1/download');

      expect(res.status).not.toBe(403);
    });

    it('enforce mode: NULL publishState (never reviewed, the live-data common case) -> not blocked', async () => {
      process.env.EXPORT_APPROVAL_ENFORCE = 'true';
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: null,
      });
      const app = await buildApp();

      const res = await request(app).get('/presentations/decks/deck-1/download');

      expect(res.status).not.toBe(403);
    });
  });

  describe('GET /decks/:deckId/export/pdf', () => {
    it('explicit final PDF fails closed when approval is stale', async () => {
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: 'changes_requested',
      });
      const app = await buildApp();

      const res = await request(app).get('/presentations/decks/deck-1/export/pdf?mode=final');

      expect(res.status).toBe(409);
      expect(res.body.blocks).toContain('CURRENT_APPROVAL_REQUIRED');
    });

    it('enforce mode: gated publishState -> 403 EXPORT_NOT_APPROVED', async () => {
      process.env.EXPORT_APPROVAL_ENFORCE = 'true';
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: 'reviewable_share',
      });
      const app = await buildApp();

      const res = await request(app).get('/presentations/decks/deck-1/export/pdf');

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ success: false, code: 'EXPORT_NOT_APPROVED' });
    });

    it('shadow mode: gated publishState does not 403', async () => {
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: 'reviewable_share',
      });
      const app = await buildApp();

      const res = await request(app).get('/presentations/decks/deck-1/export/pdf');

      expect(res.status).not.toBe(403);
    });
  });
});
