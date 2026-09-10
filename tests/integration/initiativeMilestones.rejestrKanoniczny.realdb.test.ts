/**
 * „Could not load milestones" — czerwony blad w zakladce Zadania inicjatywy.
 *
 * POMIAR 10.09 na zywym stagingu (baza pgvector): 16 z 30 agregatow
 * `ie_aggregate_state/initiative` NIE ma wiersza w tabeli `initiatives`,
 * w tym `initiative-d29cc12d-…` w organizacji Northwind — czyli takze
 * w danych pokazowych. `GET /api/initiatives/:id/milestones` sprawdzalo
 * istnienie inicjatywy WYLACZNIE w tabeli `initiatives` i odpowiadalo
 * 404 `Initiative not found`, a ekran zamienial to na czerwony napis.
 *
 * To jest ta sama rodzina co blokada tworzenia: przycisk „Utworz" zapisuje
 * inicjatywe do rejestru kanonicznego pod identyfikatorem `initiative-<uuid>`
 * (`createInitiativeWriteTruth`), wiec KAZDA nowo utworzona inicjatywa
 * trafiala na to 404 od razu po utworzeniu.
 *
 * 404 bylo po prostu nieprawda: inicjatywa istnieje, tylko w drugiej tabeli.
 *
 * Uruchomienie:
 *   RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DB_TYPE=postgres \
 *   DATABASE_URL=... npx vitest run tests/integration/initiativeMilestones.rejestrKanoniczny.realdb.test.ts
 */
import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres.js';

process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const organizationId = randomUUID();
const obcaOrganizacjaId = randomUUID();
const inicjatywaTabelaId = randomUUID();
const inicjatywaKanonicznaId = `initiative-${randomUUID()}`;
const kamienId = randomUUID();

let klient: Client;
let getMilestones: (req: unknown, res: unknown, next: unknown) => Promise<void>;

/** Atrapa `res` — zapisuje status i cialo, niczego nie udaje poza tym. */
function odpowiedz() {
  const stan: { status: number; body: unknown } = { status: 200, body: null };
  const res = {
    status(kod: number) {
      stan.status = kod;
      return res;
    },
    json(cialo: unknown) {
      stan.body = cialo;
      return res;
    },
  };
  return { res, stan };
}

const wywolaj = async (initiativeId: string, orgId: string) => {
  const { res, stan } = odpowiedz();
  await getMilestones(
    { user: { organizationId: orgId, id: 'tester' }, params: { id: initiativeId } },
    res,
    (blad: unknown) => {
      if (blad) throw blad;
    }
  );
  return stan;
};

describe('kamienie milowe inicjatywy z rejestru kanonicznego — realny PostgreSQL', { retry: 0 }, () => {
  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    ({ InitiativeController: { getMilestones } } = (await import(
      '../../server/src/controllers/InitiativeController.js'
    )) as any);
    klient = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await klient.connect();
    for (const [id, nazwa] of [
      [organizationId, 'P14 kamienie'],
      [obcaOrganizacjaId, 'P14 obca'],
    ] as const) {
      await klient.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [id, nazwa]);
    }
    await klient.query(`INSERT INTO initiatives(id,organization_id,name) VALUES($1,$2,$3)`, [
      inicjatywaTabelaId,
      organizationId,
      'Inicjatywa w tabeli initiatives',
    ]);
    await klient.query(
      `INSERT INTO initiative_milestones(id,initiative_id,organization_id,name,order_index)
       VALUES($1,$2,$3,$4,0)`,
      [kamienId, inicjatywaTabelaId, organizationId, 'Kamien z tabeli']
    );
    // Inicjatywa utworzona przyciskiem „Utworz": istnieje TYLKO w rejestrze kanonicznym.
    await klient.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES($1,'initiative',$2,1,$3::jsonb)`,
      [
        organizationId,
        inicjatywaKanonicznaId,
        JSON.stringify({ initiativeId: inicjatywaKanonicznaId, title: 'Swiezo utworzona' }),
      ]
    );
  });

  afterAll(async () => {
    if (!klient) return;
    await klient.query(`DELETE FROM initiative_milestones WHERE organization_id=$1`, [organizationId]);
    await klient.query(`DELETE FROM initiatives WHERE organization_id=$1`, [organizationId]);
    await klient.query(`DELETE FROM ie_aggregate_state WHERE organization_id=$1`, [organizationId]);
    await klient.query(`DELETE FROM organizations WHERE id = ANY($1)`, [
      [organizationId, obcaOrganizacjaId],
    ]);
    await klient.end();
  });

  it('inicjatywa z rejestru kanonicznego odpowiada 200 z pusta lista, nie 404', async () => {
    const stan = await wywolaj(inicjatywaKanonicznaId, organizationId);
    expect(stan.status).toBe(200);
    expect(stan.body).toEqual({ milestones: [] });
  });

  it('inicjatywa z tabeli initiatives dalej zwraca swoje kamienie', async () => {
    const stan = await wywolaj(inicjatywaTabelaId, organizationId);
    expect(stan.status).toBe(200);
    expect((stan.body as { milestones: unknown[] }).milestones).toHaveLength(1);
  });

  it('cudza organizacja nadal dostaje 404 (granica tenanta bez zmian)', async () => {
    const zKanonicznej = await wywolaj(inicjatywaKanonicznaId, obcaOrganizacjaId);
    expect(zKanonicznej.status).toBe(404);
    const zTabeli = await wywolaj(inicjatywaTabelaId, obcaOrganizacjaId);
    expect(zTabeli.status).toBe(404);
  });

  it('nieistniejaca inicjatywa nadal zwraca 404', async () => {
    const stan = await wywolaj(`initiative-${randomUUID()}`, organizationId);
    expect(stan.status).toBe(404);
  });
});
