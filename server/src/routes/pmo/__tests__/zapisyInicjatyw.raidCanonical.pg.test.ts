/** @vitest-environment node */

/**
 * ZAPISY INICJATYW — kontrakt kanonicznego writera RAID (26A).
 *
 * POWOD: wlasciciel produktu wycofal odbior Inicjatyw i Realizacji, bo
 * zarzadzanie pozycjami RAID nie dzialalo. Bramka
 * `requireCanonicalInitiativeExecutionWriter` odcina zapisy legacy
 * (`/api/initiatives/:id/raid*` -> 409), a front nadal je wolal. Ten plik
 * przybija kontrakt, na ktory front zostal przepiety:
 *
 *  1. legacy POST/PATCH/DELETE dalej zwraca 409 (26A nienaruszone),
 *  2. kanoniczne POST/PATCH/DELETE `raid-items` dzialaja i sa widoczne w tym
 *     samym modelu odczytu, ktory czyta UI (`raid_items`),
 *  3. pozycje zalozone PRZED 26A (bez wiersza w `ie_aggregate_state`) daja sie
 *     edytowac i usuwac kanonicznie (adopcja, `expectedVersion: 0`),
 *  4. konflikt wersji zwraca `currentVersion`, po ktorym klient ponawia.
 *
 * MUTACJA: przywroc `.catch` na trasie legacy albo usun `createIfMissing`
 * z trasy DELETE/PATCH — test staje sie czerwony.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL ?? '';

describe('Kanoniczny writer RAID inicjatywy (Runtime-v1) na realnym PostgreSQL', () => {
  const run = randomUUID();
  const organizationId = `zap-org-${run}`;
  const userId = `zap-user-${run}`;
  const initiativeId = `zap-ini-${run}`;
  const canonicalRaidId = `zap-raid-canon-${run}`;
  const legacyRaidId = `zap-raid-legacy-${run}`;
  let app: Express;
  let pool: Pool;
  let authorization = '';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment({ allowHost: '127.0.0.1' });
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query(`INSERT INTO organizations (id,name) VALUES ($1,'Zapisy')`, [organizationId]);
    await pool.query(
      `INSERT INTO users (id,organization_id,email,password,first_name,last_name,role,status)
       VALUES ($1,$2,$3,'unused','Zap','Isy','ADMIN','active')`,
      [userId, organizationId, `${userId}@example.test`]
    );
    await pool.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
      [`zap-member-${run}`, organizationId, userId]
    );
    await pool.query(
      `INSERT INTO initiatives (id,organization_id,name,status,created_by)
       VALUES ($1,$2,'Zapisy initiative','DRAFT',$3)`,
      [initiativeId, organizationId, userId]
    );

    const { default: config } = await import('../../../config/Config.js');
    authorization = `Bearer ${jwt.sign(
      { id: userId, organizationId, email: `${userId}@example.test`, role: 'ADMIN' },
      config.JWT_SECRET,
      { expiresIn: '10m' }
    )}`;
    const { ApiGateway } = await import('../../../Gateway.js');
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 180_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM raid_items WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM ie_aggregate_state WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM initiatives WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM users WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await pool.end();
  }, 60_000);

  const auth = () => ({ Authorization: authorization, 'x-organization-id': organizationId });
  const canonical = (raidItemId: string) =>
    `/api/initiatives/runtime-v1/initiatives/${initiativeId}/raid-items/${raidItemId}`;

  it('trzyma zapisy legacy RAID zamkniete na 409 (26A nienaruszone)', async () => {
    const surfaces = [
      { method: 'post' as const, path: `/api/initiatives/${initiativeId}/raid` },
      { method: 'patch' as const, path: `/api/initiatives/${initiativeId}/raid/${legacyRaidId}` },
      { method: 'delete' as const, path: `/api/initiatives/${initiativeId}/raid/${legacyRaidId}` },
    ];
    for (const surface of surfaces) {
      const response = await request(app)[surface.method](surface.path).set(auth()).send({});
      expect(response.status, `${surface.method} ${surface.path}`).toBe(409);
      expect(response.body.code).toBe('EXECUTION_RUNTIME_V1_WRITE_REQUIRED');
    }
  });

  it('kanonicznie zaklada, edytuje i usuwa pozycje RAID widoczna w modelu odczytu UI', async () => {
    const created = await request(app)
      .post(canonical(canonicalRaidId))
      .set(auth())
      .send({
        expectedVersion: 0,
        clientRequestId: `zap-create-${run}`,
        type: 'RISK',
        title: 'Ryzyko kanoniczne',
        severity: 'HIGH',
        probability: 'HIGH',
        status: 'OPEN',
      });
    expect(created.status, JSON.stringify(created.body)).toBe(201);

    // Parytet z legacy: UI koloruje po riskScore/scoreCategory.
    const afterCreate = await pool.query(
      `SELECT title,status,risk_score,score_category FROM raid_items WHERE id=$1`,
      [canonicalRaidId]
    );
    expect(afterCreate.rows[0].title).toBe('Ryzyko kanoniczne');
    expect(afterCreate.rows[0].risk_score).not.toBeNull();
    expect(afterCreate.rows[0].score_category).not.toBeNull();

    const updated = await request(app)
      .patch(canonical(canonicalRaidId))
      .set(auth())
      .send({
        expectedVersion: 1,
        clientRequestId: `zap-update-${run}`,
        title: 'Ryzyko po edycji',
        status: 'MITIGATED',
      });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);

    // Widoczne przez ten sam czytnik, ktorego uzywa UI.
    const read = await request(app)
      .get(`/api/initiatives/${initiativeId}/raid`)
      .set(auth());
    expect(read.status).toBe(200);
    const row = read.body.items.find((i: { id: string }) => i.id === canonicalRaidId);
    expect(row).toMatchObject({ title: 'Ryzyko po edycji', status: 'MITIGATED' });

    const deleted = await request(app)
      .delete(canonical(canonicalRaidId))
      .set(auth())
      .send({ expectedVersion: 2, clientRequestId: `zap-delete-${run}` });
    expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);
    expect(
      (await pool.query(`SELECT id FROM raid_items WHERE id=$1`, [canonicalRaidId])).rowCount
    ).toBe(0);
  });

  it('adoptuje pozycje sprzed 26A (brak wiersza w ie_aggregate_state) przy edycji i usunieciu', async () => {
    await pool.query(
      `INSERT INTO raid_items (id,organization_id,initiative_id,type,title,status,probability,impact)
       VALUES ($1,$2,$3,'RISK','Pozycja sprzed 26A','OPEN','LOW','LOW')`,
      [legacyRaidId, organizationId, initiativeId]
    );
    expect(
      (
        await pool.query(
          `SELECT 1 FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2`,
          [organizationId, legacyRaidId]
        )
      ).rowCount
    ).toBe(0);

    const updated = await request(app)
      .patch(canonical(legacyRaidId))
      .set(auth())
      .send({
        expectedVersion: 0,
        clientRequestId: `zap-adopt-update-${run}`,
        title: 'Pozycja sprzed 26A po edycji',
      });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(
      (await pool.query(`SELECT title FROM raid_items WHERE id=$1`, [legacyRaidId])).rows[0].title
    ).toBe('Pozycja sprzed 26A po edycji');

    // Nieaktualna wersja -> 409 z currentVersion, po ktorym klient ponawia.
    const stale = await request(app)
      .patch(canonical(legacyRaidId))
      .set(auth())
      .send({
        expectedVersion: 0,
        clientRequestId: `zap-adopt-stale-${run}`,
        title: 'Nie powinno przejsc',
      });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toMatchObject({
      code: 'VERSION_OR_IDEMPOTENCY_CONFLICT',
      currentVersion: 1,
    });

    const deleted = await request(app)
      .delete(canonical(legacyRaidId))
      .set(auth())
      .send({ expectedVersion: 1, clientRequestId: `zap-adopt-delete-${run}` });
    expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);
    expect(
      (await pool.query(`SELECT id FROM raid_items WHERE id=$1`, [legacyRaidId])).rowCount
    ).toBe(0);
  });
});
