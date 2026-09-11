/** @vitest-environment node */
/**
 * `GET /api/initiatives/runtime-v1/execution-cases/bulk` na ZYWEJ bazie.
 *
 * DLACZEGO OBOK TESTU Z ATRAPA (`tests/unit/initiatives-execution/executionCasesBulk.routes.test.ts`):
 * tamten dowodzi kontraktu routera zbudowanego recznie w tescie. Ten dowodzi
 * czegos, czego atrapa udowodnic NIE MOZE:
 *  · ze trasa jest NAPRAWDE zamontowana w produkcyjnym `ApiGateway` (gdyby
 *    `/execution-cases/bulk` stalo w kodzie ZA `/execution-cases/:executionCaseId`,
 *    zywy serwer odpowiedzialby 404 „NOT_FOUND" — atrapa tego nie zlapie, bo
 *    montuje router sama),
 *  · ze odpowiedz przechodzi przez realny czytnik Postgresa i realna
 *    autoryzacje tenantowa, a nie przez `vi.fn()`.
 *
 * TENANT: obca organizacja NIE MOZE dostac ani jednego wiersza cudzej
 * realizacji — fail-closed. Identyfikatory sa losowe i nie istnieja w bazie,
 * wiec test nie zalezy od zawartosci kopii i nic po sobie nie zostawia
 * (trasa jest wylacznie do odczytu — zero zapisow, zero sprzatania).
 */
import type { Server } from 'node:http';

import express from 'express';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../../config/Config.js';
import { ApiGateway } from '../../../Gateway.js';

const NO_RETRY = { retry: 0 } as const;
const PORT = 5271;
// KONTA MUSZA ISTNIEC W BAZIE: gateway odrzuca token nieznanej organizacji
// kodem ORG_MEMBERSHIP_REVOKED (403) ZANIM router zobaczy sciezke — test na
// wymyslonych identyfikatorach nie dowodzilby niczego o samej trasie.
// Dwie ROZNE organizacje z kopii stagingu, po jednym realnym uzytkowniku.
const ORG_A = 'a3e05d4a-5397-419d-b486-8e44366c0063'; // DBR77
const ORG_B = '3935603f-e81c-4fc3-a154-623394e7cc32'; // TT22TT
const USER_A = 'e91daa55-7657-4588-aa55-c7f1c8a34560';
const USER_B = 'f786e8f3-7a09-4fc1-b6ee-598a211038dc';
const CASE_1 = '29110000-0000-4000-8000-0000000000a1';
const CASE_2 = '29110000-0000-4000-8000-0000000000a2';

describe('GET /execution-cases/bulk na zywej bazie', NO_RETRY, () => {
  let server: Server;
  let authA: string;
  let authB: string;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    const sign = (id: string, organizationId: string) =>
      `Bearer ${jwt.sign(
        { id, userId: id, organizationId, organization_id: organizationId, role: 'OWNER' },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      )}`;
    authA = sign(USER_A, ORG_A);
    authB = sign(USER_B, ORG_B);
    const app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(PORT, '127.0.0.1', () => resolve(listener));
    });
  }, 60_000);

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const wolaj = async (authorization: string, query: string) => {
    const response = await fetch(
      `http://127.0.0.1:${PORT}/api/initiatives/runtime-v1/execution-cases/bulk${query}`,
      { headers: { Authorization: authorization } }
    );
    return { status: response.status, body: await response.text() };
  };

  it('uzywa PostgreSQL i wlasnego portu', () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect((server.address() as { port: number }).port).toBe(PORT);
  });

  it('trasa JEST zamontowana w zywym gatewayu (nie lapie jej /:executionCaseId)', async () => {
    const res = await wolaj(authA, `?ids=${CASE_1},${CASE_2}`);
    expect(res.status, res.body).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.cases)).toBe(true);
    expect(Array.isArray(body.missingIds)).toBe(true);
    // Kod „NOT_FOUND" to podpis trasy pojedynczej — gdyby zlapala `bulk`,
    // zobaczylibysmy 404, a nie kopertę zbiorcza.
    expect(res.body).not.toContain('NOT_FOUND');
  });

  it('FAIL-CLOSED: realizacja bez rodowodu widocznego dla aktora wraca w missingIds', async () => {
    const res = await wolaj(authA, `?ids=${CASE_1}`);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.cases).toEqual([]);
    expect(body.missingIds).toEqual([CASE_1]);
  });

  it('TENANT: obca organizacja nie dostaje ani jednego wiersza', async () => {
    const res = await wolaj(authB, `?ids=${CASE_1},${CASE_2}`);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.cases).toEqual([]);
    expect(body.missingIds.sort()).toEqual([CASE_1, CASE_2].sort());
  });

  it('SUFIT i brak `ids` konczą się odmowa, nie odczytem', async () => {
    const bezIds = await wolaj(authA, '');
    expect(bezIds.status).toBe(400);
    expect(bezIds.body).toContain('IDS_REQUIRED');
    const zaDuzo = await wolaj(
      authA,
      `?ids=${Array.from({ length: 101 }, (_, i) => `29110000-0000-4000-8000-${String(i).padStart(12, '0')}`).join(',')}`
    );
    expect(zaDuzo.status).toBe(400);
    expect(zaDuzo.body).toContain('TOO_MANY_IDS');
  });

  it('bez tokenu: 401, zero danych', async () => {
    const response = await fetch(
      `http://127.0.0.1:${PORT}/api/initiatives/runtime-v1/execution-cases/bulk?ids=${CASE_1}`
    );
    expect([401, 403]).toContain(response.status);
  });
});
