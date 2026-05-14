import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getReportMock = vi.fn();
const createExportRecordMock = vi.fn();
const getArtifactByOriginMock = vi.fn();
const recordCompletedExportMock = vi.fn();
const recordFailedExportMock = vi.fn();
const checkQualityGatesMock = vi.fn();
const dbGetMock = vi.fn();
const dbAllMock = vi.fn();
const uploadCloudFileMock = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'u-1', organizationId: 'org-1' };
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
  uploadCloudFile: (...args: any[]) => uploadCloudFileMock(...args),
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

describe('report-builder export trace failure parity', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/report-builder', reportBuilderRouter);

  beforeEach(() => {
    vi.clearAllMocks();
    checkQualityGatesMock.mockResolvedValue({ canExport: true });
    getArtifactByOriginMock.mockResolvedValue({ artifactId: 'artifact-report-1' });
    getReportMock.mockResolvedValue({
      report: {
        id: 'r-1',
        title: 'Report One',
        status: 'APPROVED',
      },
      sections: [],
    });
    createExportRecordMock.mockResolvedValue(undefined);
    recordCompletedExportMock.mockResolvedValue(undefined);
    recordFailedExportMock.mockResolvedValue(undefined);
    dbGetMock.mockResolvedValue(null);
    dbAllMock.mockResolvedValue([]);
    generatePresentationMock.mockRejectedValue(new Error('pptx generation failed'));
    uploadCloudFileMock.mockResolvedValue({
      provider: 'google_drive',
      fileId: 'cloud-file-1',
      url: 'https://example.com/cloud-file-1',
    });
  });

  it('records failed canonical export trace when pptx export generation throws', async () => {
    const res = await request(app).get('/api/report-builder/r-1/export/pptx');

    expect(res.status).toBe(500);
    expect(recordFailedExportMock).toHaveBeenCalledWith(
      'artifact-report-1',
      'org-1',
      'pptx',
      'u-1'
    );
    expect(recordCompletedExportMock).not.toHaveBeenCalled();
  });

  it('records failed canonical export trace when docx export persistence throws', async () => {
    createExportRecordMock.mockRejectedValueOnce(new Error('persist boom'));

    const res = await request(app).get('/api/report-builder/r-1/export/docx');

    expect(res.status).toBe(500);
    expect(recordFailedExportMock).toHaveBeenCalledWith(
      'artifact-report-1',
      'org-1',
      'docx',
      'u-1'
    );
  });

  it('records completed canonical export trace for cloud publish success', async () => {
    const res = await request(app)
      .post('/api/report-builder/r-1/publish/cloud/source-1')
      .send({ format: 'pdf' });

    expect(res.status).toBe(200);
    expect(recordCompletedExportMock).toHaveBeenCalledWith(
      'artifact-report-1',
      'org-1',
      'pdf',
      'u-1'
    );
  });

  it('records failed canonical export trace for cloud publish failure', async () => {
    uploadCloudFileMock.mockRejectedValueOnce(new Error('upload failed'));

    const res = await request(app)
      .post('/api/report-builder/r-1/publish/cloud/source-1')
      .send({ format: 'pdf' });

    expect(res.status).toBe(500);
    expect(recordFailedExportMock).toHaveBeenCalledWith(
      'artifact-report-1',
      'org-1',
      'pdf',
      'u-1'
    );
  });

  it('returns quality gate error for cloud publish when report is not export-ready', async () => {
    checkQualityGatesMock.mockResolvedValueOnce({ canExport: false, blocked: ['qa'] });

    const res = await request(app)
      .post('/api/report-builder/r-1/publish/cloud/source-1')
      .send({ format: 'pdf' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: 'REPORT_NOT_READY_FOR_EXPORT',
      })
    );
    expect(uploadCloudFileMock).not.toHaveBeenCalled();
  });
});
