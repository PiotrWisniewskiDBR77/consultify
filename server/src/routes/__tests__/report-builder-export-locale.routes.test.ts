/** @vitest-environment node */

/**
 * D-46 — `GET /api/report-builder/:id/export/pptx` (and its cloud-publish
 * sibling) hand the deck renderer the locale of the REPORT, not a hardcoded
 * Polish default.
 *
 * WHY THIS SUITE EXISTS: the route used to pass `(language as any) || 'pl'`, so
 * every caller that did not append `?language=` — the whole product UI, all
 * three of its call sites — got a Polish title slide on an English report, while
 * the DOCX export of the same report wrote the English date. A unit test of the
 * resolver would not catch a route that keeps its own `|| 'pl'`, so this suite
 * drives the REAL router over HTTP and asserts the ARGUMENT that reaches
 * `PptxExportService.generatePresentation` / `PptxPipelineService
 * .generateFromLegacyReport` / `createExportRecord`.
 *
 * The resolver's own decision order lives in
 * `../../services/report/__tests__/exportLocale.test.ts`; that the argument
 * changes the bytes the client sees lives in
 * `../../services/report/__tests__/pptxTitleSlideLocale.test.ts`.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Top-level mock fns (declared before vi.mock factories) ───────────────────

const mockDbGet = vi.fn();
const mockDbRun = vi.fn();
const mockDbAll = vi.fn();
const mockGetReport = vi.fn();
const mockListBlockTypes = vi.fn();
const mockCreateExportRecord = vi.fn();
const mockGetArtifactByOrigin = vi.fn();
const mockRecordCompletedExport = vi.fn();
const mockGeneratePresentation = vi.fn();
const mockGenerateFromLegacyReport = vi.fn();
const mockUploadCloudFile = vi.fn();
const mockResolveLocale = vi.fn();

let mockUser: { id: string; role: string; organizationId: string; language?: string } | null =
  null;
let exportDir = '';

// ── Auth / RBAC / infra middleware mocks (same baseline as
//    report-builder-template-resolve.routes.test.ts) ──────────────────────────

vi.mock('../../middleware/auth.middleware.js', () => {
  const apply = (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token' });
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  };
  return { default: apply, verifyToken: apply };
});

vi.mock('../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  default: (_req: any, _res: any, next: () => void) => next(),
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...a: unknown[]) => mockDbAll(...a),
  get: (...a: unknown[]) => mockDbGet(...a),
  run: (...a: unknown[]) => mockDbRun(...a),
}));

vi.mock('../../utils/storagePaths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/storagePaths.js')>();
  return { ...actual, exportsDir: () => exportDir, uploadsDir: () => exportDir };
});

// ── Product services: real modules, only the boundary calls mocked ───────────

vi.mock('../../services/reportBuilderService.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    default: {
      ...actual.default,
      getReport: (...a: unknown[]) => mockGetReport(...a),
      listBlockTypes: (...a: unknown[]) => mockListBlockTypes(...a),
      createExportRecord: (...a: unknown[]) => mockCreateExportRecord(...a),
    },
  };
});

vi.mock('../../services/v8/artifactRegistryService.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, getArtifactByOrigin: (...a: unknown[]) => mockGetArtifactByOrigin(...a) };
});

vi.mock('../../services/v8/exportApprovalGate.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, applyExportApprovalGate: () => true };
});

vi.mock('../../services/v8/reportsPresModelService.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    recordCompletedExport: (...a: unknown[]) => mockRecordCompletedExport(...a),
    recordFailedExport: vi.fn(),
  };
});

vi.mock('../../services/reportQualityGatesService.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, checkQualityGates: async () => ({ canExport: true, gates: [] }) };
});

vi.mock('../../services/report/PptxExportService.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    PptxExportService: class {
      generatePresentation = (...a: unknown[]) => mockGeneratePresentation(...a);
    },
  };
});

vi.mock('../../services/report/pptx/PptxPipelineService.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    PptxPipelineService: class {
      generateFromLegacyReport = (...a: unknown[]) => mockGenerateFromLegacyReport(...a);
    },
  };
});

vi.mock('../../services/cloudDataService.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, uploadCloudFile: (...a: unknown[]) => mockUploadCloudFile(...a) };
});

vi.mock('../../services/ai/languagePolicy.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/ai/languagePolicy.js')>();
  return { ...actual, resolveLocale: (...a: unknown[]) => mockResolveLocale(...a) };
});

async function createApp(): Promise<Express> {
  const mod = await import('../report-builder.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/report-builder', mod.default);
  return app;
}

const ORG = '468b234c-66c4-54e1-b626-5e0fb3a92f6a';
const USER = 'user-1';
const REPORT_ID = 'rb-report-1';

function reportFixture(overrides: Record<string, unknown> = {}) {
  return {
    report: {
      id: REPORT_ID,
      title: 'Operational maturity review',
      sourceType: 'ASSESSMENT',
      createdAt: '2026-09-16T12:00:00.000Z',
      ...overrides,
    },
    sections: [
      { sectionKey: 'summary', title: 'Executive summary', sectionType: 'text', orderIndex: 0 },
    ],
  };
}

describe('GET /api/report-builder/:id/export/pptx — export locale (D-46)', () => {
  beforeAll(async () => {
    exportDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'rb-export-locale-'));
  });

  beforeEach(() => {
    mockUser = { id: USER, role: 'ADMIN', organizationId: ORG };
    for (const mock of [
      mockDbGet,
      mockDbRun,
      mockGetReport,
      mockListBlockTypes,
      mockCreateExportRecord,
      mockGetArtifactByOrigin,
      mockRecordCompletedExport,
      mockGeneratePresentation,
      mockGenerateFromLegacyReport,
      mockUploadCloudFile,
      mockResolveLocale,
    ]) {
      mock.mockReset();
    }
    mockDbAll.mockReset();
    mockDbAll.mockResolvedValue([]);
    mockGetReport.mockResolvedValue(reportFixture());
    mockListBlockTypes.mockResolvedValue([]);
    mockGetArtifactByOrigin.mockResolvedValue({ artifactId: 'art-1', publishState: 'PUBLISHED' });
    mockCreateExportRecord.mockResolvedValue(undefined);
    mockRecordCompletedExport.mockResolvedValue(undefined);
    mockGeneratePresentation.mockResolvedValue(Buffer.from('pptx-bytes'));
    mockGenerateFromLegacyReport.mockResolvedValue({
      buffer: Buffer.from('pptx-v2-bytes'),
      slideCount: 1,
      warnings: [],
      validation: { valid: true },
    });
    mockUploadCloudFile.mockResolvedValue({ provider: 'sharepoint', fileId: 'f-1', url: 'u-1' });
    mockResolveLocale.mockResolvedValue('en');
  });

  it('★ sends the report language to the v1 renderer when the caller sends no ?language=', async () => {
    mockGetReport.mockResolvedValue(reportFixture({ language: 'en' }));

    const app = await createApp();
    const res = await request(app).get(`/api/report-builder/${REPORT_ID}/export/pptx`);

    expect(res.status).toBe(200);
    expect(mockGeneratePresentation).toHaveBeenCalledTimes(1);
    const [, options] = mockGeneratePresentation.mock.calls[0];
    expect(options.language).toBe('en');
  });

  it('★ sends the report language to the v2 pipeline when the caller sends no ?language=', async () => {
    mockGetReport.mockResolvedValue(reportFixture({ language: 'en' }));

    const app = await createApp();
    const res = await request(app).get(`/api/report-builder/${REPORT_ID}/export/pptx?version=2`);

    expect(res.status).toBe(200);
    expect(mockGenerateFromLegacyReport).toHaveBeenCalledTimes(1);
    const [, options] = mockGenerateFromLegacyReport.mock.calls[0];
    expect(options.language).toBe('en');
  });

  it('records the locale the deck was actually rendered in', async () => {
    mockGetReport.mockResolvedValue(reportFixture({ language: 'en' }));

    const app = await createApp();
    await request(app).get(`/api/report-builder/${REPORT_ID}/export/pptx`);

    expect(mockCreateExportRecord).toHaveBeenCalledTimes(1);
    expect(mockCreateExportRecord.mock.calls[0][0]).toMatchObject({
      format: 'pptx',
      language: 'en',
    });
  });

  it('keeps Polish for a Polish report (no regression the other way)', async () => {
    mockGetReport.mockResolvedValue(reportFixture({ language: 'pl-PL' }));

    const app = await createApp();
    await request(app).get(`/api/report-builder/${REPORT_ID}/export/pptx`);

    expect(mockGeneratePresentation.mock.calls[0][1].language).toBe('pl');
    expect(mockCreateExportRecord.mock.calls[0][0].language).toBe('pl');
  });

  it('honours an explicit ?language= over the report language', async () => {
    mockGetReport.mockResolvedValue(reportFixture({ language: 'en' }));

    const app = await createApp();
    await request(app).get(`/api/report-builder/${REPORT_ID}/export/pptx?language=pl`);

    expect(mockGeneratePresentation.mock.calls[0][1].language).toBe('pl');
  });

  it('falls back to the section language when the report carries none', async () => {
    mockGetReport.mockResolvedValue({
      report: { id: REPORT_ID, title: 'Review', createdAt: '2026-09-16T12:00:00.000Z' },
      sections: [{ sectionKey: 'summary', title: 'Summary', language: 'pl', orderIndex: 0 }],
    });

    const app = await createApp();
    await request(app).get(`/api/report-builder/${REPORT_ID}/export/pptx`);

    expect(mockGeneratePresentation.mock.calls[0][1].language).toBe('pl');
  });

  it('★ falls back to the DEC-510 identity chain — never to Polish — when nothing else speaks', async () => {
    mockGetReport.mockResolvedValue(reportFixture());
    mockResolveLocale.mockResolvedValue('en');

    const app = await createApp();
    await request(app).get(`/api/report-builder/${REPORT_ID}/export/pptx`);

    expect(mockResolveLocale).toHaveBeenCalledTimes(1);
    expect(mockGeneratePresentation.mock.calls[0][1].language).toBe('en');
    expect(mockGeneratePresentation.mock.calls[0][1].language).not.toBe('pl');
  });
});

describe('POST /api/report-builder/:id/publish/cloud/:cloudSourceId — pptx locale (D-46)', () => {
  beforeAll(async () => {
    if (!exportDir) {
      exportDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'rb-export-locale-'));
    }
  });

  beforeEach(() => {
    mockUser = { id: USER, role: 'ADMIN', organizationId: ORG };
    for (const mock of [
      mockDbGet,
      mockDbRun,
      mockGetReport,
      mockListBlockTypes,
      mockCreateExportRecord,
      mockGetArtifactByOrigin,
      mockRecordCompletedExport,
      mockGeneratePresentation,
      mockGenerateFromLegacyReport,
      mockUploadCloudFile,
      mockResolveLocale,
    ]) {
      mock.mockReset();
    }
    mockDbAll.mockReset();
    mockDbAll.mockResolvedValue([]);
    mockGetReport.mockResolvedValue(reportFixture({ language: 'en' }));
    mockListBlockTypes.mockResolvedValue([]);
    mockGetArtifactByOrigin.mockResolvedValue({ artifactId: 'art-1', publishState: 'PUBLISHED' });
    mockCreateExportRecord.mockResolvedValue(undefined);
    mockRecordCompletedExport.mockResolvedValue(undefined);
    mockGeneratePresentation.mockResolvedValue(Buffer.from('pptx-bytes'));
    mockGenerateFromLegacyReport.mockResolvedValue({
      buffer: Buffer.from('pptx-v2-bytes'),
      slideCount: 1,
      warnings: [],
      validation: { valid: true },
    });
    mockUploadCloudFile.mockResolvedValue({ provider: 'sharepoint', fileId: 'f-1', url: 'u-1' });
    mockResolveLocale.mockResolvedValue('en');
  });

  it('★ resolves the locale instead of leaving the renderer on its Polish default', async () => {
    const app = await createApp();
    const res = await request(app)
      .post(`/api/report-builder/${REPORT_ID}/publish/cloud/src-1`)
      .send({ format: 'pptx' });

    expect(res.status).toBe(200);
    expect(mockGeneratePresentation).toHaveBeenCalledTimes(1);
    expect(mockGeneratePresentation.mock.calls[0][1].language).toBe('en');
  });

  it('resolves the locale for the v2 cloud publish too', async () => {
    const app = await createApp();
    const res = await request(app)
      .post(`/api/report-builder/${REPORT_ID}/publish/cloud/src-1`)
      .send({ format: 'pptx', version: '2' });

    expect(res.status).toBe(200);
    expect(mockGenerateFromLegacyReport.mock.calls[0][1].language).toBe('en');
  });
});
