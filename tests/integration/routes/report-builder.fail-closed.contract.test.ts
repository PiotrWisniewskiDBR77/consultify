// @vitest-environment node

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createBlockTypeMock = vi.fn();
const getReportMock = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'u-rb-1', organizationId: 'org-rb-1' };
    req.userId = 'u-rb-1';
    req.organizationId = 'org-rb-1';
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
    listBlockTypes: vi.fn(async () => []),
    createBlockType: (...args: any[]) => createBlockTypeMock(...args),
    getReport: (...args: any[]) => getReportMock(...args),
    createExportRecord: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../server/src/services/reportBuilder/sqlite.js', () => ({
  getReportBuilderDb: () => ({
    prepare: () => ({ get: () => null, all: () => [] }),
  }),
}));

vi.mock('../../../server/src/services/reportQualityGatesService.js', () => ({
  checkQualityGates: vi.fn(async () => ({ canExport: true })),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: vi.fn(async () => null),
  all: vi.fn(async () => []),
  run: vi.fn(async () => ({ changes: 1 })),
}));

vi.mock('../../../server/src/services/assessmentReportBuilderLinkService.js', () => ({
  upsertAssessmentReportForBuilder: vi.fn(async () => ({})),
}));

vi.mock('../../../server/src/services/brandVoiceProfileService.js', () => ({
  getOrCreateBrandVoice: vi.fn(async () => ({})),
  updateBrandVoice: vi.fn(async () => ({})),
}));

vi.mock('../../../server/src/services/knowledgeMapService.js', () => ({
  buildKnowledgeMap: vi.fn(async () => ({})),
}));

vi.mock('../../../server/src/services/ragLogicService.js', () => ({
  computeRagForReport: vi.fn(async () => ({})),
}));

vi.mock('../../../server/src/services/reportAgentService.js', () => ({
  processAgentMessage: vi.fn(async () => ({})),
  getAgentMessages: vi.fn(async () => []),
  applyAgentAction: vi.fn(async () => ({})),
}));

vi.mock('../../../server/src/services/reportBuilderCommentsService.js', () => ({
  default: {},
}));

vi.mock('../../../server/src/services/reportCanonicalTemplatesService.js', () => ({
  getCanonicalTemplate: vi.fn(async () => null),
  proposeOutline: vi.fn(async () => []),
}));

vi.mock('../../../server/src/services/reportGenerationService.js', () => ({
  default: {},
}));

vi.mock('../../../server/src/services/notificationService.js', () => ({
  default: { send: vi.fn(async () => undefined) },
}));

vi.mock('../../../server/src/services/ai/integrationHubService.js', () => ({
  exportReportToNotion: vi.fn(async () => ({ success: true, url: 'https://notion.so/example' })),
}));

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: vi.fn(async () => ({ artifactId: 'artifact-1' })),
  addSecondaryOriginLink: vi.fn(async () => undefined),
  mapReportStatusToDeliveryState: vi.fn(() => 'draft'),
  getArtifactByOrigin: vi.fn(async () => ({ artifactId: 'artifact-1' })),
}));

vi.mock('../../../server/src/services/v8/reportsPresModelService.js', () => ({
  recordCompletedExport: vi.fn(async () => undefined),
  recordFailedExport: vi.fn(async () => undefined),
}));

vi.mock('../../../server/src/services/report/PptxExportService.js', () => ({
  PptxExportService: class {
    async generatePresentation() {
      return '/tmp/presentation.pptx';
    }
  },
}));

vi.mock('../../../server/src/services/cloudDataService.js', () => ({
  uploadCloudFile: vi.fn(async () => ({ url: 'https://cloud.example/file' })),
}));

import reportBuilderRouter from '../../../server/src/routes/report-builder.routes.js';
import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

describe('report-builder fail-closed contract', () => {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.use('/api/report-builder', reportBuilderRouter);
  app.use(errorHandlerMiddleware);

  beforeEach(() => {
    vi.clearAllMocks();
    getReportMock.mockResolvedValue({
      report: { id: 'r-1', title: 'Report', status: 'APPROVED' },
      sections: [],
    });
  });

  it('returns coded 500 for block type create failures without internals leak', async () => {
    createBlockTypeMock.mockRejectedValueOnce(new Error('RB_INTERNAL_SECRET_DB_CONN'));
    const res = await request(app)
      .post('/api/report-builder/block-types')
      .send({ name: 'Block A', renderKind: 'text' })
      .set('X-Correlation-ID', 'pack10s5-report-builder-block-create-fail-1');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('REPORT_BUILDER_BLOCK_TYPE_CREATE_FAILED');
    expect(res.body.error.message).toBe('Failed to create report block type.');
    expect(res.body.correlationId).toBe('pack10s5-report-builder-block-create-fail-1');
    expect(JSON.stringify(res.body)).not.toContain('RB_INTERNAL_SECRET_DB_CONN');
  });

  it('returns coded 500 for notion export failures without internals leak', async () => {
    getReportMock.mockRejectedValueOnce(new Error('NOTION_EXPORT_INTERNAL_PAYLOAD'));
    const res = await request(app)
      .post('/api/report-builder/r-1/export/notion')
      .set('X-Correlation-ID', 'pack10s5-report-builder-notion-export-fail-1');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('REPORT_BUILDER_EXPORT_NOTION_FAILED');
    expect(res.body.error.message).toBe('Failed to export report to Notion.');
    expect(res.body.correlationId).toBe('pack10s5-report-builder-notion-export-fail-1');
    expect(JSON.stringify(res.body)).not.toContain('NOTION_EXPORT_INTERNAL_PAYLOAD');
  });
});
