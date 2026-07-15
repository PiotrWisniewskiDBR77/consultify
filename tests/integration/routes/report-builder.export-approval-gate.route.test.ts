/**
 * M17 integrity fix (07-15 audit) — route-level contract for the export
 * approval gate on the MAIN report-builder export paths (pdf/docx/pptx).
 *
 * Prior to this fix, `assertArtifactExportable()` (403 EXPORT_NOT_APPROVED)
 * was wired ONLY to the wave5 export-manifest/exported routes; the main
 * pdf/docx/pptx endpoints tested here ignored the artifact's publish-approval
 * state entirely. This file drives the real HTTP routes (mirrors
 * `report-builder.export-trace.routes.test.ts`'s mocking strategy) to prove:
 *   (a) a gated (non-null, non-approved) publishState does NOT block by
 *       default (shadow mode — EXPORT_APPROVAL_ENFORCE unset)
 *   (b) the same gated state DOES 403 EXPORT_NOT_APPROVED once
 *       EXPORT_APPROVAL_ENFORCE=true
 *   (c) an approved/published state always succeeds
 *   (d) a NULL publishState (artifact never entered the review workflow —
 *       the common case on live data today) always succeeds, even enforced
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getReportMock = vi.fn();
const createExportRecordMock = vi.fn();
const getArtifactByOriginMock = vi.fn();
const recordCompletedExportMock = vi.fn();
const recordFailedExportMock = vi.fn();
const checkQualityGatesMock = vi.fn();
const dbGetMock = vi.fn();
const dbAllMock = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'u-1', organizationId: 'org-1', role: 'USER' };
    req.userId = 'u-1';
    req.organizationId = 'org-1';
    next();
  },
}));

vi.mock('../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  default: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/services/reportBuilderService.js', () => ({
  default: {
    getReport: (...args: any[]) => getReportMock(...args),
    createExportRecord: (...args: any[]) => createExportRecordMock(...args),
    listBlockTypes: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  getArtifactByOrigin: (...args: any[]) => getArtifactByOriginMock(...args),
}));

vi.mock('../../../server/src/services/v8/reportsPresModelService.js', () => ({
  recordCompletedExport: (...args: any[]) => recordCompletedExportMock(...args),
  recordFailedExport: (...args: any[]) => recordFailedExportMock(...args),
}));

vi.mock('../../../server/src/services/reportQualityGatesService.js', () => ({
  checkQualityGates: (...args: any[]) => checkQualityGatesMock(...args),
}));

vi.mock('../../../server/src/utils/sqliteSafe.js', () => ({
  dbGet: (...args: any[]) => dbGetMock(...args),
  dbAll: (...args: any[]) => dbAllMock(...args),
}));

vi.mock('../../../server/src/services/reportBuilder/sqlite.js', () => ({
  getReportBuilderDb: () => ({
    prepare: () => ({
      get: () => null,
      all: () => [],
    }),
  }),
}));

vi.mock('../../../server/src/services/cloudDataService.js', () => ({
  uploadCloudFile: vi.fn(),
}));

const generatePresentationMock = vi.fn();
vi.mock('../../../server/src/services/report/PptxExportService.js', () => ({
  PptxExportService: class {
    generatePresentation(...args: any[]) {
      return generatePresentationMock(...args);
    }
  },
}));

import reportBuilderRouter from '../../../server/src/routes/report-builder.routes.js';

describe('M17 — report-builder export-approval gate (pdf/docx/pptx)', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/report-builder', reportBuilderRouter);

  const ORIGINAL_ENFORCE = process.env.EXPORT_APPROVAL_ENFORCE;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.EXPORT_APPROVAL_ENFORCE;
    checkQualityGatesMock.mockResolvedValue({ canExport: true });
    getReportMock.mockResolvedValue({
      report: { id: 'r-1', title: 'Report One', status: 'APPROVED' },
      sections: [],
    });
    createExportRecordMock.mockResolvedValue(undefined);
    recordCompletedExportMock.mockResolvedValue(undefined);
    recordFailedExportMock.mockResolvedValue(undefined);
    dbGetMock.mockResolvedValue(null);
    dbAllMock.mockResolvedValue([]);
    generatePresentationMock.mockResolvedValue(Buffer.from('fake-pptx'));
  });

  afterEach(() => {
    if (ORIGINAL_ENFORCE === undefined) delete process.env.EXPORT_APPROVAL_ENFORCE;
    else process.env.EXPORT_APPROVAL_ENFORCE = ORIGINAL_ENFORCE;
  });

  describe('GET /:id/export/pdf', () => {
    it('(a) shadow mode (default): gated publishState does not block', async () => {
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: 'changes_requested',
      });

      const res = await request(app).get('/api/report-builder/r-1/export/pdf');

      expect(res.status).not.toBe(403);
    });

    it('(b) enforce mode: gated publishState -> 403 EXPORT_NOT_APPROVED', async () => {
      process.env.EXPORT_APPROVAL_ENFORCE = 'true';
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: 'changes_requested',
      });

      const res = await request(app).get('/api/report-builder/r-1/export/pdf');

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'EXPORT_NOT_APPROVED' });
    });

    it('(c) enforce mode: approved publishState -> succeeds', async () => {
      process.env.EXPORT_APPROVAL_ENFORCE = 'true';
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: 'approved',
      });

      const res = await request(app).get('/api/report-builder/r-1/export/pdf');

      expect(res.status).not.toBe(403);
    });

    it('(d) enforce mode: NULL publishState (never reviewed) -> always succeeds, never 403', async () => {
      process.env.EXPORT_APPROVAL_ENFORCE = 'true';
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: null,
      });

      const res = await request(app).get('/api/report-builder/r-1/export/pdf');

      expect(res.status).not.toBe(403);
    });

    it('fail-open: no artifact registry link at all -> never 403s on approval (existence is a separate concern)', async () => {
      process.env.EXPORT_APPROVAL_ENFORCE = 'true';
      getArtifactByOriginMock.mockResolvedValue(null);

      const res = await request(app).get('/api/report-builder/r-1/export/pdf');

      expect(res.status).not.toBe(403);
    });
  });

  describe('GET /:id/export/docx', () => {
    it('enforce mode: gated publishState -> 403 EXPORT_NOT_APPROVED', async () => {
      process.env.EXPORT_APPROVAL_ENFORCE = 'true';
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: 'reviewable_share',
      });

      const res = await request(app).get('/api/report-builder/r-1/export/docx');

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'EXPORT_NOT_APPROVED' });
    });

    it('shadow mode: gated publishState does not block', async () => {
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: 'reviewable_share',
      });

      const res = await request(app).get('/api/report-builder/r-1/export/docx');

      expect(res.status).not.toBe(403);
    });
  });

  describe('GET /:id/export/pptx', () => {
    it('enforce mode: gated publishState -> 403 EXPORT_NOT_APPROVED (before quality gate / generation run)', async () => {
      process.env.EXPORT_APPROVAL_ENFORCE = 'true';
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: 'private_draft',
      });

      const res = await request(app).get('/api/report-builder/r-1/export/pptx');

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'EXPORT_NOT_APPROVED' });
      expect(generatePresentationMock).not.toHaveBeenCalled();
    });

    it('enforce mode: approved publishState -> proceeds past the approval gate', async () => {
      process.env.EXPORT_APPROVAL_ENFORCE = 'true';
      getArtifactByOriginMock.mockResolvedValue({
        artifactId: 'artifact-1',
        publishState: 'published',
      });

      const res = await request(app).get('/api/report-builder/r-1/export/pptx');

      expect(res.status).not.toBe(403);
    });
  });
});
