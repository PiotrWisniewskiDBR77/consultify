/** @vitest-environment node */

/**
 * D-47 — `GET /api/report-builder/:id/export/docx` hands the DOCX exporter the
 * name of the organization the report belongs to.
 *
 * WHY THIS SUITE EXISTS: `ReportBuilderService.getReport` selects the report row
 * only, so the exporter never saw a tenant name and the client-final cover fell
 * back to the literal "Client" — which the running header then repeated on every
 * page of a document delivered to Northwind. A unit test of the exporter cannot
 * catch a route that never asks for the name, so this drives the REAL router and
 * asserts the ARGUMENT reaching `exportReportBuilderDocx`.
 *
 * What the exporter does with that argument is covered by
 * `../../services/export/docx/__tests__/clientFinalCoverOrganization.test.ts` and
 * `reportBuilderDocxLogoHydration.test.ts`.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbGet = vi.fn();
const mockDbRun = vi.fn();
const mockDbAll = vi.fn();
const mockGetReport = vi.fn();
const mockCreateExportRecord = vi.fn();
const mockGetArtifactByOrigin = vi.fn();
const mockRecordCompletedExport = vi.fn();
const mockExportReportBuilderDocx = vi.fn();

let mockUser: { id: string; role: string; organizationId: string } | null = null;
let exportDir = '';

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

vi.mock('../../services/reportBuilderService.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    default: {
      ...actual.default,
      getReport: (...a: unknown[]) => mockGetReport(...a),
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

vi.mock('../../services/export/docx/ReportBuilderDocxExportService.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, exportReportBuilderDocx: (...a: unknown[]) => mockExportReportBuilderDocx(...a) };
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
const ORG_NAME = 'Northwind Manufacturing Ltd.';

describe('GET /api/report-builder/:id/export/docx — tenant name on the cover (D-47)', () => {
  beforeAll(async () => {
    exportDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'rb-export-docx-'));
  });

  beforeEach(() => {
    mockUser = { id: USER, role: 'ADMIN', organizationId: ORG };
    for (const mock of [
      mockDbGet,
      mockDbRun,
      mockGetReport,
      mockCreateExportRecord,
      mockGetArtifactByOrigin,
      mockRecordCompletedExport,
      mockExportReportBuilderDocx,
    ]) {
      mock.mockReset();
    }
    mockDbAll.mockReset();
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue({ name: ORG_NAME });
    mockGetReport.mockResolvedValue({
      report: { id: REPORT_ID, title: 'Operational maturity review', createdAt: '2026-09-16' },
      sections: [{ sectionKey: 'summary', title: 'Executive summary', orderIndex: 0 }],
    });
    mockGetArtifactByOrigin.mockResolvedValue({ artifactId: 'art-1', publishState: 'PUBLISHED' });
    mockCreateExportRecord.mockResolvedValue(undefined);
    mockRecordCompletedExport.mockResolvedValue(undefined);
    mockExportReportBuilderDocx.mockResolvedValue(Buffer.from('docx-bytes'));
  });

  it('★ passes the tenant organization name to the DOCX exporter', async () => {
    const app = await createApp();
    const res = await request(app).get(`/api/report-builder/${REPORT_ID}/export/docx`);

    expect(res.status).toBe(200);
    expect(mockExportReportBuilderDocx).toHaveBeenCalledTimes(1);
    expect(mockExportReportBuilderDocx.mock.calls[0][0]).toMatchObject({
      organizationId: ORG,
      organizationName: ORG_NAME,
    });
  });

  it('★ reads that name from the organizations table of the auth-context tenant', async () => {
    const app = await createApp();
    await request(app).get(`/api/report-builder/${REPORT_ID}/export/docx`);

    const orgCall = mockDbGet.mock.calls.find(([sql]) => /FROM organizations/i.test(String(sql)));
    expect(orgCall).toBeTruthy();
    expect(orgCall![1]).toEqual([ORG]);
  });

  it('still exports when the tenant row carries no name', async () => {
    mockDbGet.mockResolvedValue(undefined);

    const app = await createApp();
    const res = await request(app).get(`/api/report-builder/${REPORT_ID}/export/docx`);

    expect(res.status).toBe(200);
    expect(mockExportReportBuilderDocx.mock.calls[0][0]).toMatchObject({
      organizationId: ORG,
      organizationName: undefined,
    });
  });
});
