import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', organizationId: 'org-1' };
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    next();
  },
}));

vi.mock('../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: any) => next(),
}));

const generateManagementReportMock = vi.fn();
const getManagementReportMock = vi.fn();
const listTemplatesMock = vi.fn();

vi.mock('../../../server/src/services/managementReportsService.js', () => ({
  default: {
    generateReport: (...args: any[]) => generateManagementReportMock(...args),
    getReport: (...args: any[]) => getManagementReportMock(...args),
    listTemplates: (...args: any[]) => listTemplatesMock(...args),
  },
}));

const generateAuditReportMock = vi.fn();
const getAuditReportMock = vi.fn();
const listAuditReportsMock = vi.fn();

vi.mock('../../../server/src/services/audits/reportService.js', () => ({
  generateReport: (...args: any[]) => generateAuditReportMock(...args),
  getReport: (...args: any[]) => getAuditReportMock(...args),
  listReports: (...args: any[]) => listAuditReportsMock(...args),
}));

vi.mock('../../../server/src/services/audits/permissions.js', () => ({
  requireCapability: vi.fn(),
}));

vi.mock('../../../server/src/services/audits/auditsDb.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../server/src/services/audits/auditsDb.js')>();
  return {
    ...actual,
    auditGet: vi.fn(),
  };
});

import managementReportsRouter from '../../../server/src/routes/managementReports.routes.js';
import auditReportsRouter from '../../../server/src/routes/audits/reports.routes.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/management-reports', managementReportsRouter);
  app.use('/api/audits/reports', (req: any, _res, next) => {
    req.user = { id: 'user-1', organizationId: 'org-1' };
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    next();
  });
  app.use('/api/audits/reports', auditReportsRouter);
  return app;
}

const app = buildApp();

describe('Report Builder document adapters on legacy report routes', () => {
  beforeEach(() => {
    generateManagementReportMock.mockReset();
    getManagementReportMock.mockReset();
    listTemplatesMock.mockResolvedValue([]);
    generateAuditReportMock.mockReset();
    getAuditReportMock.mockReset();
    listAuditReportsMock.mockReset();
  });

  it('POST /api/management-reports/generate keeps the legacy report and adds sections', async () => {
    generateManagementReportMock.mockResolvedValue({
      id: 'mgr-1',
      organizationId: 'org-1',
      projectId: 'project-1',
      reportType: 'RAID',
      scope: 'PROJECT',
      title: 'RAID report',
      status: 'DRAFT',
      generatedBy: 'user-1',
      aiNarrative: 'Narrative from a real management report.',
      content: {
        statusSummary: { healthStatus: 'AMBER' },
        blockers: [{ id: 'b-1', title: 'Blocked dependency' }],
        pendingDecisions: [{ id: 'd-1', title: 'Sponsor decision' }],
      },
      createdAt: '2026-09-18T20:00:00.000Z',
      updatedAt: '2026-09-18T20:00:00.000Z',
    });

    const res = await request(app)
      .post('/api/management-reports/generate')
      .send({ reportType: 'RAID', scope: 'PROJECT', projectId: 'project-1' });

    expect(res.status).toBe(200);
    expect(res.body.report).toMatchObject({ id: 'mgr-1', content: expect.any(Object) });
    expect(res.body.reportBuilderDocument.report).toMatchObject({
      id: 'mgr-1',
      sourceType: 'MANAGEMENT_REPORT',
    });
    expect(res.body.sections.map((section: any) => section.sectionKey)).toEqual([
      'ai_narrative',
      'status_summary',
      'blockers',
      'pending_decisions',
    ]);
  });

  it('GET /api/audits/reports/:id keeps the audit envelope and adds the same sections shape', async () => {
    getAuditReportMock.mockResolvedValue({
      id: 'audit-1',
      organizationId: 'org-1',
      programId: 'program-1',
      outputId: 'output-1',
      version: 1,
      reportKind: 'audit_report',
      title: 'Audit report',
      status: 'draft',
      payload: {
        sections: [
          { id: 'executive_summary', title: 'Executive summary', kind: 'text', content: 'Summary' },
          { id: 'evidence', title: 'Evidence', kind: 'list', content: ['Invoice', 'Interview'] },
          { id: 'plan', title: 'Plan', kind: 'table', content: [{ title: 'Corrective action' }] },
        ],
      },
      createdAt: '2026-09-18T19:00:00.000Z',
      updatedAt: '2026-09-18T20:00:00.000Z',
    });

    const res = await request(app).get('/api/audits/reports/audit-1');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('audit-1');
    expect(res.body.reportBuilderDocument.report).toMatchObject({
      id: 'audit-1',
      sourceType: 'AUDIT_REPORT',
    });
    expect(res.body.sections.map((section: any) => section.sectionKey)).toEqual([
      'executive_summary',
      'evidence',
      'plan',
    ]);
  });
});
