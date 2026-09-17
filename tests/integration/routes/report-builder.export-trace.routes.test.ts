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
const getPublicLinkByTokenMock = vi.fn();

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

vi.mock('../../../server/src/utils/pdfFonts.js', () => ({
  registerPdfFonts: vi.fn(),
}));

vi.mock('../../../server/src/services/export/docx/ReportBuilderDocxExportService.js', () => ({
  exportReportBuilderDocx: vi.fn().mockResolvedValue(Buffer.from('private-docx')),
}));

vi.mock('../../../server/src/services/reportBuilderService.js', () => ({
  default: {
    getReport: (...args: any[]) => getReportMock(...args),
    createExportRecord: (...args: any[]) => createExportRecordMock(...args),
    getPublicLinkByToken: (...args: any[]) => getPublicLinkByTokenMock(...args),
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

const generatePipelinePresentationMock = vi.fn();
vi.mock('../../../server/src/services/report/pptx/PptxPipelineService.js', () => ({
  PptxPipelineService: class {
    generateFromLegacyReport(...args: any[]) {
      return generatePipelinePresentationMock(...args);
    }
  },
}));

import reportBuilderRouter from '../../../server/src/routes/report-builder.routes.js';
import publicReportRouter from '../../../server/src/routes/report-builder-public.routes.js';

function parseBinary(
  res: NodeJS.ReadableStream,
  callback: (error: Error | null, body?: Buffer) => void
) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('report-builder export trace failure parity', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/report-builder', reportBuilderRouter);
  app.use('/api/public/report', publicReportRouter);

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
    generatePipelinePresentationMock.mockResolvedValue({
      buffer: Buffer.from('public-pptx'),
      slideCount: 1,
      warnings: [],
      validation: { valid: true },
    });
    getPublicLinkByTokenMock.mockResolvedValue({
      link: {
        passwordHash: null,
        showCompanyLogo: false,
        showConsultifyBranding: true,
        customMessage: '',
      },
      report: {
        id: 'r-1',
        title: 'Northwind — Review',
        config: { language: 'en' },
      },
      sections: [],
    });
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
    expect(recordFailedExportMock).toHaveBeenCalledWith('artifact-report-1', 'org-1', 'pdf', 'u-1');
  });

  it('exports with advisory quality warnings when report is not export-ready', async () => {
    checkQualityGatesMock.mockResolvedValueOnce({
      canExport: false,
      gates: [{ id: 'qa', severity: 'error', message: 'Review required' }],
    });

    const res = await request(app)
      .post('/api/report-builder/r-1/publish/cloud/source-1')
      .send({ format: 'pdf' });

    expect(res.status).toBe(200);
    expect(res.headers['x-report-quality-result']).toBe('BLOCKED_P1');
    expect(res.headers['x-report-quality-warning-count']).toBe('1');
    expect(uploadCloudFileMock).toHaveBeenCalledTimes(1);
  });

  it('rejects cross-organization downloads and cloud publish before quality or audit writes', async () => {
    getReportMock.mockResolvedValue(null);

    const responses = [
      await request(app).get('/api/report-builder/report-from-other-org/export/pdf'),
      await request(app).get('/api/report-builder/report-from-other-org/export/docx'),
      await request(app).get('/api/report-builder/report-from-other-org/export/pptx'),
      await request(app)
        .post('/api/report-builder/report-from-other-org/publish/cloud/source-1')
        .send({ format: 'pdf' }),
    ];

    expect(responses.map((response) => response.status)).toEqual([403, 403, 403, 403]);
    for (const response of responses) {
      expect(response.body).toEqual(
        expect.objectContaining({
          code: 'REPORT_EXPORT_FORBIDDEN',
        })
      );
    }
    expect(checkQualityGatesMock).not.toHaveBeenCalled();
    expect(recordCompletedExportMock).not.toHaveBeenCalled();
    expect(recordFailedExportMock).not.toHaveBeenCalled();
  });

  it.each([
    ['pdf', '/api/report-builder/r-1/export/pdf'],
    ['docx', '/api/report-builder/r-1/export/docx'],
    ['pptx', '/api/report-builder/r-1/export/pptx'],
  ])('returns a safe UTF-8 attachment header for private %s export', async (extension, url) => {
    getReportMock.mockResolvedValueOnce({
      report: {
        id: 'r-1',
        title: 'Northwind — Review',
        status: 'APPROVED',
        createdAt: '2026-09-17T00:00:00.000Z',
      },
      sections: [],
    });
    if (extension === 'pptx') {
      generatePresentationMock.mockResolvedValueOnce(Buffer.from('private-pptx'));
    }

    const res = await request(app).get(url).buffer(true).parse(parseBinary);

    expect(res.status).toBe(200);
    const disposition = String(res.headers['content-disposition'] || '');
    expect(disposition).not.toContain('—');
    expect(disposition).toContain(`filename*=UTF-8''Northwind%20%E2%80%94%20Review.${extension}`);
    expect(recordCompletedExportMock).toHaveBeenCalledTimes(1);
    expect(recordFailedExportMock).not.toHaveBeenCalled();
  });

  it.each([
    ['pdf', '/api/public/report/share-token/pdf', false],
    ['docx', '/api/public/report/share-token/docx', true],
    ['pptx', '/api/public/report/share-token/pptx', true],
  ])(
    'returns a safe UTF-8 attachment header for public %s export',
    async (extension, url, auth) => {
      let pending = request(app).get(url).buffer(true).parse(parseBinary);
      if (auth) pending = pending.set('Authorization', 'Bearer test-token');

      const res = await pending;

      expect(res.status).toBe(200);
      const disposition = String(res.headers['content-disposition'] || '');
      expect(disposition).not.toContain('—');
      expect(disposition).toContain(`filename*=UTF-8''Northwind%20%E2%80%94%20Review.${extension}`);
    }
  );
});
