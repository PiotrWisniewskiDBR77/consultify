/**
 * `POST /api/audits/reports/:id/conclusion` — przewód raport audytu → wniosek
 * (DEC-417e, 1.1-A4).
 *
 * Test pilnuje kontraktu, na którym stoi CTA „Nowy wniosek":
 *  - ten sam strażnik uprawnień, co przy powstaniu raportu (`report.draft`) —
 *    brak roli daje 403, a nie cichy zapis,
 *  - brak raportu = 404, raport bez treści wniosku = 422 (nie 500),
 *  - sukces zwraca `conclusionId` odczytany PO RODOWODZIE; gdy rodowodu nie ma,
 *    trasa woli 500 z jawnym kodem niż udawany sukces.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getReport = vi.fn();
const requireCapability = vi.fn();
const createConclusion = vi.fn();
const queryOne = vi.fn();

vi.mock('../../../services/audits/reportService.js', () => ({
  getReport: (...args: unknown[]) => getReport(...args),
}));

vi.mock('../../../services/audits/permissions.js', () => ({
  requireCapability: (...args: unknown[]) => requireCapability(...args),
}));

vi.mock('../../../services/conclusions/ConclusionService.js', () => ({
  conclusionService: { createConclusion: (...args: unknown[]) => createConclusion(...args) },
}));

// Mock CZĘŚCIOWY: podmieniamy wyłącznie odczyt wniosku po rodowodzie, reszta
// helperów zostaje prawdziwa (DbPromise sięga po nie w locie).
vi.mock('../../../utils/queryHelpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/queryHelpers.js')>()),
  queryOne: (...args: unknown[]) => queryOne(...args),
}));

// Kontekst raportu (nazwa programu/organizacji) czyta bazę audytową — w teście
// jednostkowym trasy nie ma bazy, a brak nazwy jest legalnym stanem produktu.
vi.mock('../../../services/audits/auditsDb.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/audits/auditsDb.js')>()),
  auditGet: vi.fn().mockResolvedValue(null),
}));

const RAPORT = {
  id: 'arep-1',
  programId: 'prog-1',
  title: 'Raport poaudytowy — Q3',
  status: 'published',
  version: 2,
  payload: {
    reportKind: 'audit_report',
    sections: [
      {
        id: 'overall_conclusion',
        title: 'Wniosek ogólny',
        kind: 'text',
        content: 'System spełnia wymagania z zastrzeżeniami.',
      },
    ],
  },
};

async function buildApp() {
  const { default: router } = await import('../reports.routes.js');
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: 'user-1', organizationId: 'org-1', role: 'CONSULTANT' };
    (req as any).userId = 'user-1';
    (req as any).organizationId = 'org-1';
    next();
  });
  app.use('/api/audits/reports', router);
  return app;
}

describe('POST /api/audits/reports/:id/conclusion', () => {
  beforeEach(() => {
    getReport.mockReset();
    requireCapability.mockReset().mockResolvedValue({});
    createConclusion.mockReset().mockResolvedValue(undefined);
    queryOne.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('zapisuje wniosek i zwraca conclusionId odczytany po rodowodzie', async () => {
    getReport.mockResolvedValue(RAPORT);
    queryOne.mockResolvedValue({ id: 'concl-1', status: 'candidate' });

    const app = await buildApp();
    const res = await request(app).post('/api/audits/reports/arep-1/conclusion').send({});

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.data.conclusionId).toBe('concl-1');
    expect(res.body.data.sourceRefs[0]).toMatchObject({ type: 'audit_report', id: 'arep-1' });

    // Zapis poszedł do warstwy Wniosków z rodowodem i źródłem audytu.
    const zapis = createConclusion.mock.calls[0][0];
    expect(zapis.sourceModule).toBe('audit');
    expect(zapis.sourceRefs[0].id).toBe('arep-1');

    // Odczyt po rodowodzie, nie po tytule.
    const [, parametry] = queryOne.mock.calls[0];
    expect(parametry[1]).toBe('audit');
    expect(String(parametry[2])).toContain('audit_report');
  });

  it('pyta o TO SAMO uprawnienie, co powstanie raportu (report.draft na programie)', async () => {
    getReport.mockResolvedValue(RAPORT);
    queryOne.mockResolvedValue({ id: 'concl-1', status: 'candidate' });

    const app = await buildApp();
    await request(app).post('/api/audits/reports/arep-1/conclusion').send({});

    expect(requireCapability).toHaveBeenCalledTimes(1);
    const [, programId, capability] = requireCapability.mock.calls[0];
    expect(programId).toBe('prog-1');
    expect(capability).toBe('report.draft');
  });

  it('odmawia (403) bez roli audytowej i NIE zapisuje wniosku', async () => {
    getReport.mockResolvedValue(RAPORT);
    const { AuditDomainError } = await import('../../../services/audits/auditsDb.js');
    requireCapability.mockRejectedValue(
      new AuditDomainError('Brak uprawnienia', 403, 'AUDIT_FORBIDDEN')
    );

    const app = await buildApp();
    const res = await request(app).post('/api/audits/reports/arep-1/conclusion').send({});

    expect(res.status).toBe(403);
    expect(createConclusion).not.toHaveBeenCalled();
  });

  it('zwraca 404 dla nieistniejącego raportu', async () => {
    getReport.mockResolvedValue(null);
    const app = await buildApp();
    const res = await request(app).post('/api/audits/reports/nie-ma/conclusion').send({});
    expect(res.status).toBe(404);
    expect(createConclusion).not.toHaveBeenCalled();
  });

  it('zwraca 422 (nie 500) dla raportu bez treści wniosku', async () => {
    getReport.mockResolvedValue({ ...RAPORT, payload: { sections: [] } });
    const app = await buildApp();
    const res = await request(app).post('/api/audits/reports/arep-1/conclusion').send({});
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('AUDIT_CONCLUSION_NO_SUMMARY');
    expect(createConclusion).not.toHaveBeenCalled();
  });

  it('woli 500 z jawnym kodem niż udawany sukces, gdy zapis nie ma rodowodu', async () => {
    getReport.mockResolvedValue(RAPORT);
    queryOne.mockResolvedValue(null);

    const app = await buildApp();
    const res = await request(app).post('/api/audits/reports/arep-1/conclusion').send({});

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('AUDIT_CONCLUSION_LINEAGE_MISSING');
  });
});
