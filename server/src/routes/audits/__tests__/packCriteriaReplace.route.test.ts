/**
 * `PUT /api/audits/packs/:id/criteria` — kontrakt trasy, na którym stoi OP-2b
 * (Wpis 99, wiersz planu 65 / U-27): ekran obiektu pakietu zapisuje całą listę
 * kryteriów JEDNYM żądaniem.
 *
 * Test jest JEDYNIE odczytem kontraktu (frontend nie może go sobie dopowiedzieć):
 *  - body: goła tablica ALBO `{ criteria: [...] }` — cokolwiek innego to 400
 *    `AUDIT_CRITERIA_PAYLOAD_INVALID` BEZ wołania serwisu;
 *  - bramka: `requireAdmin` = `isPlatformAdmin(actor)`, więc rola spoza
 *    {admin, administrator, owner, superadmin} dostaje 403 `AUDIT_FORBIDDEN`;
 *  - pakiet `published`: serwis rzuca `AuditStateError` → 409
 *    `AUDIT_INVALID_STATE` (nie 500 i nie cichy sukces);
 *  - roundtrip PUT → GET: to, co `replaceCriteria` zapisało, wraca z
 *    `GET /packs/:id` w `data.criteria` (ekran renderuje PO ZAPISIE z
 *    odpowiedzi serwera, nie z lokalnego stanu).
 *
 * Wzorzec: `reportConclusion.route.test.ts` (realny router + supertest,
 * serwis jako atrapa — bez bazy). Dowód na realnym PostgreSQL niesie
 * istniejący `verticalSlice.http.test.ts` (ten sam `PUT` w łańcuchu P5).
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const replaceCriteria = vi.fn();
const getPack = vi.fn();

vi.mock('../../../services/audits/packService.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/audits/packService.js')>()),
  replaceCriteria: (...args: unknown[]) => replaceCriteria(...args),
  getPack: (...args: unknown[]) => getPack(...args),
}));

const CRITERIA = [
  {
    id: 'crit-1',
    parentId: null,
    ordinal: 0,
    refCode: 'ZAK-8.4.1',
    nodeKind: 'control',
    title: 'Supplier qualification',
    requirementText: 'Evaluate suppliers before contracting.',
    mandatory: true,
    weight: 2,
  },
  {
    id: 'new-1',
    parentId: null,
    ordinal: 1,
    refCode: null,
    nodeKind: 'criterion',
    title: 'Management review',
    mandatory: true,
    weight: null,
  },
];

const PACK_ID = 'apack-1';

/** `auditActor(req)` czyta `req.user` — tu wchodzi aktor o zadanej roli. */
async function buildApp(role: string) {
  const { default: router } = await import('../packs.routes.js');
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: 'user-1', organizationId: 'org-1', role };
    (req as any).userId = 'user-1';
    (req as any).organizationId = 'org-1';
    next();
  });
  app.use('/api/audits/packs', router);
  return app;
}

describe('PUT /api/audits/packs/:id/criteria — kontrakt replace dla OP-2b', () => {
  beforeEach(() => {
    replaceCriteria.mockReset().mockResolvedValue(CRITERIA);
    getPack.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('przyjmuje `{ criteria: [...] }` i oddaje zapisaną listę w `data`', async () => {
    const app = await buildApp('ADMIN');

    const res = await request(app)
      .put(`/api/audits/packs/${PACK_ID}/criteria`)
      .send({ criteria: CRITERIA });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(CRITERIA);
    // Serwis dostaje aktora, id pakietu i GOŁĄ tablicę (nie opakowanie).
    expect(replaceCriteria).toHaveBeenCalledTimes(1);
    const [actor, packId, criteria] = replaceCriteria.mock.calls[0];
    expect(actor).toMatchObject({ organizationId: 'org-1', userId: 'user-1' });
    expect(packId).toBe(PACK_ID);
    expect(criteria).toEqual(CRITERIA);
  });

  it('przyjmuje też gołą tablicę (drugi wariant walidatora trasy)', async () => {
    const app = await buildApp('owner');

    const res = await request(app)
      .put(`/api/audits/packs/${PACK_ID}/criteria`)
      .send(CRITERIA);

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(replaceCriteria.mock.calls[0][2]).toEqual(CRITERIA);
  });

  it('roundtrip PUT → GET: `GET /packs/:id` oddaje to, co zapisał replace', async () => {
    getPack.mockResolvedValue({ id: PACK_ID, publicationStatus: 'draft', criteria: CRITERIA });
    const app = await buildApp('ADMIN');

    const put = await request(app)
      .put(`/api/audits/packs/${PACK_ID}/criteria`)
      .send({ criteria: CRITERIA });
    expect(put.status, JSON.stringify(put.body)).toBe(200);

    const get = await request(app).get(`/api/audits/packs/${PACK_ID}`);
    expect(get.status, JSON.stringify(get.body)).toBe(200);
    expect(get.body.data.criteria).toEqual(CRITERIA);
    expect(get.body.data.criteria.map((c: { title: string }) => c.title)).toEqual([
      'Supplier qualification',
      'Management review',
    ]);
  });

  it('ciało, które nie jest listą → 400 AUDIT_CRITERIA_PAYLOAD_INVALID bez wołania serwisu', async () => {
    const app = await buildApp('ADMIN');

    const res = await request(app)
      .put(`/api/audits/packs/${PACK_ID}/criteria`)
      .send({ criteria: { title: 'nie-tablica' } });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('AUDIT_CRITERIA_PAYLOAD_INVALID');
    expect(replaceCriteria).not.toHaveBeenCalled();
  });

  it('rola spoza administratorów platformy → 403 AUDIT_FORBIDDEN (bramka trasy, nie serwisu)', async () => {
    const app = await buildApp('consultant');

    const res = await request(app)
      .put(`/api/audits/packs/${PACK_ID}/criteria`)
      .send({ criteria: CRITERIA });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUDIT_FORBIDDEN');
    expect(replaceCriteria).not.toHaveBeenCalled();
  });

  it('pakiet opublikowany odmawia → 409 AUDIT_INVALID_STATE, nie 500 i nie cichy sukces', async () => {
    const { AuditStateError } = await import('../../../services/audits/auditsDb.js');
    replaceCriteria.mockRejectedValue(
      new AuditStateError('Kryteriów opublikowanego pakietu nie można podmienić')
    );
    const app = await buildApp('ADMIN');

    const res = await request(app)
      .put(`/api/audits/packs/${PACK_ID}/criteria`)
      .send({ criteria: CRITERIA });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('AUDIT_INVALID_STATE');
  });

  it('pusty tytuł → 400 AUDIT_CRITERION_TITLE_MISSING z serwisu (jedyna walidacja pola)', async () => {
    const { AuditDomainError } = await import('../../../services/audits/auditsDb.js');
    replaceCriteria.mockRejectedValue(
      new AuditDomainError('Kryterium #0 nie ma tytułu', 400, 'AUDIT_CRITERION_TITLE_MISSING')
    );
    const app = await buildApp('ADMIN');

    const res = await request(app)
      .put(`/api/audits/packs/${PACK_ID}/criteria`)
      .send({ criteria: [{ title: '   ' }] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('AUDIT_CRITERION_TITLE_MISSING');
  });
});
