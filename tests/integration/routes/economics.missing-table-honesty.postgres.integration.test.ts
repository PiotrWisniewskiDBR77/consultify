/** @vitest-environment node */

/**
 * M08-H01/H02/H03 — Finance nie może meldować sukcesu nad nieistniejącą tabelą.
 *
 * Baza dowodowa odwzorowuje LUKĘ Z DEMO: `digitization_analyses` istnieje, a trzy
 * tabele Finance — `analysis_financial_scenarios`, `benefit_tracking`,
 * `analysis_financials` — NIE istnieją. Dokładnie ten stan zmierzyłem read-only
 * na `trolley:28146`.
 *
 * Przed pakietem `economics.routes.ts` miał ZERO wystąpień `fallback: false`,
 * więc `DbPromise` (fallback domyślnie `true` także dla `run()`) połykał 42P01:
 *   - zapis scenariuszy kończył się `res.json({ success: true })`,
 *   - zapis benefitów kończył się `res.json({ success: true })`,
 *   - lista analiz zwracała `[]` — awaria nieodróżnialna od pustej organizacji.
 *
 * Wymaga `NODE_ENV=test RUN_DB_TESTS=1` i `DATABASE_URL` na realny Postgres.
 * Bez `RUN_DB_TESTS=1` zestaw rzuca (ochrona przed cichym mockiem bazy).
 */
import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const ORG = 'atelier';
const USER = `user-m08-${uuidv4().slice(0, 8)}`;

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    const orgId = req.headers['x-test-org-id'];
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = { id: USER, organizationId: orgId, role: 'OWNER' };
    req.userId = USER;
    req.organizationId = orgId;
    next();
  },
}));
vi.mock('../../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_r: unknown, _s: unknown, next: () => void) => next(),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const H = { 'x-test-org-id': ORG };

describe('M08 — brak tabeli nie może dawać fałszywego sukcesu (real Postgres)', () => {
  let app: express.Express;

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || process.env.RUN_DB_TESTS !== '1') {
      throw new Error('Wymaga NODE_ENV=test RUN_DB_TESTS=1 i realnego DATABASE_URL.');
    }
    const { default: economicsRoutes } =
      await import('../../../server/src/routes/economics.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/economics', economicsRoutes);
  });

  it('M08-H03 — lista analiz DEGRADUJE się zamiast udawać pustą organizację', async () => {
    const res = await request(app).get('/api/economics/analyses').set(H);

    expect(res.status).toBe(200);
    // Regresja, którą zamykamy: przed pakietem było `analyses: []`.
    expect(Array.isArray(res.body.analyses)).toBe(true);
    expect(res.body.analyses.length).toBeGreaterThan(0);
    // ...i klient dowiaduje się, że wzbogacenie finansowe zostało odcięte.
    expect(res.body.financialsDegraded).toBe(true);
    // Kolumny finansowe są puste, ale wiersz istnieje — nie zmyślamy wartości.
    expect(res.body.analyses[0].id).toBe('an-1');
  });

  it('M08-H01 — zapis scenariuszy NIE melduje sukcesu (fail closed 503)', async () => {
    const res = await request(app).put('/api/economics/analyses/an-1/financials').set(H).send({
      capexTotal: 100000,
      opexAnnual: 20000,
      benefitsAnnual: 60000,
      discountRate: 0.1,
      horizonYears: 5,
    });

    expect(res.body.success).not.toBe(true);
    expect(res.status).toBeGreaterThanOrEqual(500);
    if (res.status === 503) {
      expect(res.body.error).toBe('FINANCE_STORAGE_UNAVAILABLE');
      expect(res.body.table).toBe('analysis_financial_scenarios');
    }
  });

  it('M08-H02 — zapis benefitów NIE melduje sukcesu (fail closed 503)', async () => {
    const res = await request(app)
      .put('/api/economics/analyses/an-1/benefits')
      .set(H)
      .send({ trackingPeriod: '2026-Q1', plannedBenefits: 100, actualBenefits: 80 });

    expect(res.body.success).not.toBe(true);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('FINANCE_STORAGE_UNAVAILABLE');
    expect(res.body.table).toBe('benefit_tracking');
  });
});
