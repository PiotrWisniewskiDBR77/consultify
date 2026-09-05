/**
 * Trend KPI (Realizacja → Rollout): seria musi zaczynać się przy ZAŁOŻENIU KPI.
 *
 * ZMIERZONY DEFEKT (odbiór na żywo 05.09, `execution-tab-rollout`): kolumna
 * Trend pokazywała „No history yet" dla KAŻDEGO KPI. Przyczyna nie była w
 * komponencie — wiersz w `rollout_kpi_history` powstawał WYŁĄCZNIE w PATCH
 * („Record a history point whenever current value moves"), więc wartość, z
 * którą KPI zakładano, nie trafiała do serii nigdy. Wykres (`KpiSparkline`)
 * wymaga DWÓCH punktów, więc trend mógł się pojawić najwcześniej po DRUGIEJ
 * edycji wartości — czyli praktycznie nigdy.
 *
 * DOWÓD MUTACYJNY (wykonany 2026-09-05): usunięcie wstawki historii z POST
 * /kpis → pierwszy test pada („oczekiwano INSERT INTO rollout_kpi_history,
 * nie było żadnego"). Test celuje w SAM ZAPIS punktu początkowego.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...a: unknown[]) => dbAll(...a),
  get: (...a: unknown[]) => dbGet(...a),
  run: (...a: unknown[]) => dbRun(...a),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: unknown, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'ADMIN' };
    next();
  },
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/permissionMiddleware.js', () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const rolloutRouter = (await import('../../../server/src/routes/rollout.routes.js')).default;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/rollout', rolloutRouter);
  return app;
}

const historyInserts = () =>
  dbRun.mock.calls.filter((call) => String(call[0]).includes('INSERT INTO rollout_kpi_history'));

describe('POST /api/rollout/kpis — punkt startowy serii', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([
      { id: 'kpi-1', organization_id: 'org-1', name: 'OEE', current_value: 62 },
    ]);
    dbRun.mockResolvedValue({ changes: 1 });
  });

  it('zapisuje wartość początkową do rollout_kpi_history', async () => {
    const res = await request(createApp())
      .post('/api/rollout/kpis')
      .send({ name: 'OEE', baseline: 55, target: 85, currentValue: 62, unit: '%' });

    expect(res.status).toBe(201);
    const inserts = historyInserts();
    expect(inserts).toHaveLength(1);
    expect(inserts[0][1]).toEqual(['kpi-1', 62]);
  });

  it('nie wywraca tworzenia KPI, gdy zapis punktu historii się nie uda', async () => {
    dbRun.mockRejectedValueOnce(new Error('history table locked'));

    const res = await request(createApp())
      .post('/api/rollout/kpis')
      .send({ name: 'OEE', baseline: 55, target: 85, currentValue: 62, unit: '%' });

    expect(res.status).toBe(201);
    expect(res.body.kpi.id).toBe('kpi-1');
  });
});
