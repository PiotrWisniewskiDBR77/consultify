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
const listArtifactsForUserMock = vi.fn();
const createArtifactAccessGrantMock = vi.fn();
const getArtifactOriginLinksMock = vi.fn();
const getArtifactAccessGrantsForArtifactMock = vi.fn();
const startArtifactReviewMock = vi.fn();
const deriveArtifactValidationSnapshotMock = vi.fn();
const getExecutionRunMock = vi.fn();
const getExportHistoryMock = vi.fn();

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  getArtifactForUser: (...args: any[]) => getArtifactForUserMock(...args),
  listArtifactsForUser: (...args: any[]) => listArtifactsForUserMock(...args),
  createArtifactAccessGrant: (...args: any[]) => createArtifactAccessGrantMock(...args),
  getArtifactOriginLinks: (...args: any[]) => getArtifactOriginLinksMock(...args),
  getArtifactAccessGrantsForArtifact: (...args: any[]) => getArtifactAccessGrantsForArtifactMock(...args),
  startArtifactReview: (...args: any[]) => startArtifactReviewMock(...args),
  deriveArtifactValidationSnapshot: (...args: any[]) => deriveArtifactValidationSnapshotMock(...args),
}));

vi.mock('../../../server/src/services/v8/executionSpineService.js', () => ({
  getRun: (...args: any[]) => getExecutionRunMock(...args),
}));

vi.mock('../../../server/src/services/v8/reportsPresModelService.js', () => ({
  getExportHistory: (...args: any[]) => getExportHistoryMock(...args),
}));

const dbGetMock = vi.fn();
const dbRunMock = vi.fn();
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGetMock(...args),
  run: (...args: any[]) => dbRunMock(...args),
}));

vi.mock('../../../server/src/services/organizationService.js', () => ({
  getMembers: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../server/src/services/v8/publishReviewService.js', () => ({
  PublishReviewError: class PublishReviewError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
  getPublishRecord: vi.fn().mockResolvedValue(null),
  transitionPublishState: vi.fn(),
  submitReviewGate: vi.fn(),
}));

import artifactsRouter from '../../../server/src/routes/artifacts.routes.js';
import * as publishReviewService from '../../../server/src/services/v8/publishReviewService.js';

describe('artifacts access routes (HTTP contract; artifactRegistryService mocked)', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/artifacts', artifactsRouter);

  beforeEach(() => {
    delete process.env.V8_TEMPLATES_REVIEW_ENABLED;
    delete process.env.V8_TEMPLATES_PUBLISH_ENABLED;
    delete process.env.V8_PROVENANCE_STAMP_ENABLED;
    verifyTokenMock.mockReset();
    getArtifactForUserMock.mockReset();
    listArtifactsForUserMock.mockReset();
    createArtifactAccessGrantMock.mockReset();
    getArtifactOriginLinksMock.mockReset();
    getArtifactAccessGrantsForArtifactMock.mockReset();
    startArtifactReviewMock.mockReset();
    deriveArtifactValidationSnapshotMock.mockReset();
    getExecutionRunMock.mockReset();
    getExportHistoryMock.mockReset();
    dbGetMock.mockReset();
    dbRunMock.mockReset();
    dbRunMock.mockResolvedValue(undefined);
    deriveArtifactValidationSnapshotMock.mockReturnValue({
      state: 'validated',
      checks: [],
    });
    getExportHistoryMock.mockResolvedValue([]);
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

  it('passes mine queue filter when view=mine', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
    });
    listArtifactsForUserMock.mockResolvedValue([]);

    const res = await request(app).get('/api/artifacts?view=mine&limit=80');

    expect(res.status).toBe(200);
    expect(listArtifactsForUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        filters: expect.objectContaining({
          onlyMine: true,
          limit: 80,
        }),
      })
    );
  });

  it('passes needs-review queue filter when view=review', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'reviewer-42', organizationId: 'org-1', role: 'USER' };
    });
    listArtifactsForUserMock.mockResolvedValue([]);

    const res = await request(app).get('/api/artifacts?view=review&limit=200');

    expect(res.status).toBe(200);
    expect(listArtifactsForUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'reviewer-42',
        filters: expect.objectContaining({
          reviewSharedForUserId: 'reviewer-42',
          limit: 200,
        }),
      })
    );
  });

  // ── S6.3: M17 junk filter — draft visibility + dedupe param forwarding ──
  it('defaults to excluding drafts and enabling dedupe (M17 junk filter)', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
    });
    listArtifactsForUserMock.mockResolvedValue([]);

    const res = await request(app).get('/api/artifacts?limit=80');

    expect(res.status).toBe(200);
    expect(listArtifactsForUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ drafts: 'exclude', dedupe: true }),
      })
    );
  });

  it('forwards drafts=include for ?include=drafts (Robocze mixed view)', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
    });
    listArtifactsForUserMock.mockResolvedValue([]);

    const res = await request(app).get('/api/artifacts?include=drafts');

    expect(res.status).toBe(200);
    expect(listArtifactsForUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ drafts: 'include' }),
      })
    );
  });

  it('forwards drafts=only for ?view=drafts and ?drafts=only', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
    });
    listArtifactsForUserMock.mockResolvedValue([]);

    await request(app).get('/api/artifacts?view=drafts');
    expect(listArtifactsForUserMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: expect.objectContaining({ drafts: 'only' }) })
    );

    await request(app).get('/api/artifacts?drafts=only');
    expect(listArtifactsForUserMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: expect.objectContaining({ drafts: 'only' }) })
    );
  });

  it('forwards dedupe=false to disable presentational dedup', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
    });
    listArtifactsForUserMock.mockResolvedValue([]);

    const res = await request(app).get('/api/artifacts?dedupe=false');

    expect(res.status).toBe(200);
    expect(listArtifactsForUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ dedupe: false }),
      })
    );
  });

  it('returns action metadata on canonical list rows', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
    });
    listArtifactsForUserMock.mockResolvedValue([
      {
        artifactId: 'art-1',
        originRuntime: 'report',
        originRecordId: 'report-77',
        outputType: 'report',
        canonicalHome: 'outputs_library',
        resolvedTitle: 'Report 77',
      },
    ]);

    const res = await request(app).get('/api/artifacts?limit=25');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [
        expect.objectContaining({
          artifactId: 'art-1',
          originRuntime: 'report',
          originRecordId: 'report-77',
          openPath: '/reports/builder/report-77',
          exportPath: '/api/report-builder/report-77/export/pdf',
          authority: 'report_builder',
        }),
      ],
      total: 1,
      canonicalHome: 'outputs_library',
    });
    expect(listArtifactsForUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        roleKey: 'USER',
        filters: expect.objectContaining({
          limit: 25,
        }),
      })
    );
  });

  // P0.2 (2026-07-26): Document Studio documents register with
  // originRuntime='native_artifact' — a DIFFERENT runtime from 'report'
  // (report_builder). Before buildActionTargetPayload had a case for it,
  // native_artifact fell to the generic branch (openPath: null), which meant
  // the client fell back to /wordy?artifactId=... — the wrong engine. This
  // pins the server contract both endpoints (action-target and the canonical
  // list) rely on.
  it('returns canonical action-target metadata for native_artifact (Document Studio) documents', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
    });
    getArtifactForUserMock.mockResolvedValue({
      artifactId: 'art-doc-1',
      originRuntime: 'native_artifact',
      originRecordId: 'doc-studio-42',
      ownerUserId: 'owner-1',
    });

    const res = await request(app).get('/api/artifacts/art-doc-1/action-target');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        artifactId: 'art-doc-1',
        originRuntime: 'native_artifact',
        originRecordId: 'doc-studio-42',
        openPath: '/document-studio/doc-studio-42',
        exportPath: '/api/document-studio/doc-studio-42/export/pdf',
        deletePath: null,
        reviewPath: '/api/artifacts/art-doc-1/start-review',
        authority: 'document_studio',
      },
    });
  });

  it('includes native_artifact (Document Studio) documents in the canonical list with a document-studio openPath', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
    });
    listArtifactsForUserMock.mockResolvedValue([
      {
        artifactId: 'art-doc-1',
        originRuntime: 'native_artifact',
        originRecordId: 'doc-studio-42',
        outputType: 'report',
        artifactFamily: 'document',
        canonicalHome: 'outputs_library',
        resolvedTitle: 'Notatka z warsztatu',
      },
    ]);

    const res = await request(app).get('/api/artifacts?limit=25');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        artifactId: 'art-doc-1',
        originRuntime: 'native_artifact',
        originRecordId: 'doc-studio-42',
        openPath: '/document-studio/doc-studio-42',
        authority: 'document_studio',
      }),
    ]);
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

  it('blocks template start-review when V8_TEMPLATES_REVIEW_ENABLED=false (rollback posture)', async () => {
    process.env.V8_TEMPLATES_REVIEW_ENABLED = 'false';
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
    });
    getArtifactForUserMock.mockResolvedValue({
      artifactId: 'tmpl-1',
      artifactFamily: 'template',
      originSummary: { template: { scope: 'org' } },
    });

    const res = await request(app).post('/api/artifacts/tmpl-1/start-review').send({ reviewers: [] });
    expect(res.status).toBe(503);
    expect(startArtifactReviewMock).not.toHaveBeenCalled();
  });

  it('blocks template publish when V8_TEMPLATES_PUBLISH_ENABLED=false (rollback posture)', async () => {
    process.env.V8_TEMPLATES_PUBLISH_ENABLED = 'false';
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'admin-1', organizationId: 'org-1', role: 'ADMIN' };
    });
    getArtifactForUserMock.mockResolvedValue({
      artifactId: 'tmpl-2',
      artifactFamily: 'template',
      originSummary: { template: { scope: 'org' } },
    });

    const res = await request(app).post('/api/artifacts/tmpl-2/publish').send({ reviewType: 'peer_review' });
    expect(res.status).toBe(503);
  });

  it('fails closed when provenance stamp is unavailable for org template publish', async () => {
    process.env.V8_PROVENANCE_STAMP_ENABLED = 'false';
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'admin-1', organizationId: 'org-1', role: 'ADMIN' };
    });
    getArtifactForUserMock.mockResolvedValue({
      artifactId: 'tmpl-3',
      artifactFamily: 'template',
      originSummary: { template: { scope: 'org' } },
    });

    const res = await request(app).post('/api/artifacts/tmpl-3/publish').send({ reviewType: 'peer_review' });
    expect(res.status).toBe(503);
    expect(String(res.body?.error || '')).toContain('Provenance stamp unavailable');
  });

  it('returns a stable quorum error when not every assigned reviewer has approved', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'admin-2', organizationId: 'org-1', role: 'ADMIN' };
    });
    getArtifactForUserMock.mockResolvedValue({
      artifactId: 'tmpl-quorum',
      artifactFamily: 'template',
      originSummary: { template: { scope: 'org' } },
    });
    vi.mocked(publishReviewService.getPublishRecord).mockResolvedValueOnce({
      recordId: 'record-1',
      artifactId: 'tmpl-quorum',
      artifactType: 'report',
      organizationId: 'org-1',
      currentState: 'in_review',
      publishedBy: 'admin-1',
      publishedAt: null,
      reviewers: ['admin-2', 'admin-3'],
      approvedBy: null,
      approvedAt: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
    vi.mocked(publishReviewService.submitReviewGate).mockResolvedValueOnce({
      gateId: 'gate-1',
      artifactId: 'tmpl-quorum',
      organizationId: 'org-1',
      reviewType: 'peer_review',
      reviewerId: 'admin-2',
      result: 'approved',
      comments: null,
      createdAt: '2026-08-01T00:00:00.000Z',
    });
    vi.mocked(publishReviewService.transitionPublishState).mockRejectedValueOnce(
      new publishReviewService.PublishReviewError(
        'REVIEW_QUORUM_REQUIRED',
        'All assigned reviewers must have a latest approved decision'
      )
    );

    const res = await request(app)
      .post('/api/artifacts/tmpl-quorum/publish')
      .send({ reviewType: 'peer_review' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REVIEW_QUORUM_REQUIRED');
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

  it('returns trust-state payload with explicit execution and review separation', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
    });
    getArtifactForUserMock.mockResolvedValue({
      artifactId: 'art-9',
      outputType: 'report',
      titleSnapshot: 'Trust state report',
      canonicalHome: 'outputs_library',
      visibilityScope: 'review_shared',
      projectId: 'proj-1',
      publishState: 'in_review',
      publishReviewers: ['reviewer-1'],
      reviewGateCount: 2,
      executionRunId: 'exec-9',
      contextSnapshotId: 'ctx-9',
      lastTransitionAt: '2026-03-29T08:00:00.000Z',
      sourceRefs: [{ id: 'source-1' }],
      originSummary: { nativeStatus: 'draft' },
      originRuntime: 'report',
      originRecordId: 'report-9',
    });
    getArtifactOriginLinksMock.mockResolvedValue([{ linkId: 'link-1' }]);
    getArtifactAccessGrantsForArtifactMock.mockResolvedValue([{ grantId: 'grant-1' }]);
    getExecutionRunMock.mockResolvedValue({ state: 'completed' });
    getExportHistoryMock.mockResolvedValue([
      {
        exportId: 'export-1',
        artifactId: 'art-9',
        organizationId: 'org-1',
        format: 'pdf',
        requestedBy: 'user-1',
        status: 'completed',
        createdAt: '2026-03-29T08:10:00.000Z',
        completedAt: '2026-03-29T08:10:01.000Z',
      },
    ]);

    const res = await request(app).get('/api/artifacts/art-9/trust-state');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        artifactId: 'art-9',
        visibilityScope: 'review_shared',
        publishState: 'in_review',
        validationState: 'validated',
        reviewGateCount: 2,
        executionRunId: 'exec-9',
        executionState: 'completed',
        lineagePaths: {
          runPath: '/v8/execution/runs/exec-9',
          toolUsagePath: '/v8/execution/runs/exec-9/tool-usage',
          outputsPath: '/v8/execution/runs/exec-9/outputs',
        },
        canManageAccess: false,
        manageAccessPath: '/api/artifacts/art-9/access',
        exportHistory: [
          expect.objectContaining({
            exportId: 'export-1',
            format: 'pdf',
            status: 'completed',
          }),
        ],
        reviewAuthority: 'artifact_review',
        executionAuthority: 'execution_spine',
        exportPath: '/api/report-builder/report-9/export/pdf',
        authority: 'report_builder',
      })
    );
  });

  it('returns 409 when review is requested before execution approval is completed', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
    });
    getArtifactForUserMock.mockResolvedValue({
      artifactId: 'art-5',
      ownerUserId: 'user-1',
    });
    startArtifactReviewMock.mockRejectedValue(
      new Error('Artifact art-5 cannot enter review before artifact validation passes')
    );

    const res = await request(app).post('/api/artifacts/art-5/start-review').send({});

    expect(res.status).toBe(409);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: 'Cannot enter review before artifact validation passes',
      })
    );
  });

  it('POST /api/artifacts/:id/deprecate — deprecates a template artifact with reason + migrationHint (P24-D)', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'admin-1', organizationId: 'org-1', role: 'ADMIN' };
    });
    getArtifactForUserMock.mockResolvedValue({
      artifactId: 'tmpl-1',
      artifactFamily: 'template',
      ownerUserId: 'admin-1',
    });
    dbGetMock.mockResolvedValue({
      origin_summary_json: JSON.stringify({
        template: {
          scope: 'org',
          status: 'active',
          description: 'Old template',
          metadata: { createdBy: 'admin-1' },
        },
      }),
    });

    const res = await request(app).post('/api/artifacts/tmpl-1/deprecate').send({
      reason: 'Replaced by updated version',
      migrationHint: 'Use tmpl-2 instead',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        artifactId: 'tmpl-1',
        status: 'deprecated',
        deprecationReason: 'Replaced by updated version',
        migrationHint: 'Use tmpl-2 instead',
      })
    );
    expect(dbRunMock).toHaveBeenCalledOnce();
    const updateArgs = dbRunMock.mock.calls[0];
    const updatedSummary = JSON.parse(updateArgs[1][0]);
    expect(updatedSummary.template.status).toBe('deprecated');
    expect(updatedSummary.template.deprecationReason).toBe('Replaced by updated version');
    expect(updatedSummary.template.migrationHint).toBe('Use tmpl-2 instead');
  });

  it('POST /api/artifacts/:id/deprecate — returns 403 for non-admin users', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
    });

    const res = await request(app).post('/api/artifacts/tmpl-1/deprecate').send({
      reason: 'test',
    });

    expect(res.status).toBe(403);
  });

  it('POST /api/artifacts/:id/deprecate — returns 409 when artifact is not a template', async () => {
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'admin-1', organizationId: 'org-1', role: 'ADMIN' };
    });
    getArtifactForUserMock.mockResolvedValue({
      artifactId: 'doc-1',
      artifactFamily: 'document',
      ownerUserId: 'admin-1',
    });

    const res = await request(app).post('/api/artifacts/doc-1/deprecate').send({
      reason: 'test',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Only template artifacts');
  });
});
