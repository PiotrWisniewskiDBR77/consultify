/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../config/Config.js';
import initiativesRoutes from '../initiatives.routes.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
// FIX-5 (odbior dyzuru 33): Z25/Z26 — bramka MUSI sprawdzac takze DATABASE_URL.
// Bez tego warunku `new Client({ connectionString: '' })` schodzi do domyslnych libpq
// i na maszynie deweloperskiej trafia w gniazdo /private/tmp/.s.PGSQL.5432 — czyli w CUDZA
// baze — a `afterAll` tej suity robi DELETE na goal_initiative_links / goals / users /
// organizations. Ten sam ksztalt bramki co w poprawnym pliku tego samego dyzuru:
// server/src/services/executionControl/__tests__/goalPerspectiveMigration.pg.test.ts:12.
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_PG)('Day 33 human-declared goal perspective', () => {
  const tag = randomUUID();
  const orgA = `day33-persp-a-${tag}`;
  const orgB = `day33-persp-b-${tag}`;
  const ownerA = `owner-a-${tag}`;
  const ownerB = `owner-b-${tag}`;
  const viewerA = `viewer-a-${tag}`;
  const goalA = `goal-a-${tag}`;
  const goalB = `goal-b-${tag}`;
  const tokens: Record<string, string> = {};
  let client: Client;
  let app: express.Express;

  const auth = (key: string) => ({ Authorization: `Bearer ${tokens[key]}` });
  const path = (goalId: string) => `/api/initiatives/runtime-v1/goals/${goalId}/perspective`;
  const body = (requestId: string, expectedVersion: number, perspective: string | null) => ({
    clientRequestId: requestId,
    expectedVersion,
    perspective,
  });

  beforeAll(async () => {
    // FIX-5 (odbior dyzuru 33) — DRUGI ZAMEK, niezbedny: vitest 4.1.8 URUCHAMIA hooki
    // beforeAll/afterAll suity oznaczonej `describe.skipIf(true)`. Sam warunek przy `describe`
    // NIE chroni polaczenia ani sprzatania. Zweryfikowane empirycznie na tej gałęzi:
    // z pustym DATABASE_URL hooki laczyly sie przez domyslne libpq do CUDZEJ bazy
    // (/private/tmp/.s.PGSQL.5432) i wykonywaly tam DELETE.
    if (!REAL_PG) return;
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,$1),($2,$2)`, [orgA, orgB]);
    await client.query(
      `INSERT INTO users(id,organization_id,email,role,status)
       VALUES($1,$2,$3,'OWNER','active'),($4,$5,$6,'OWNER','active'),($7,$2,$8,'USER','active')`,
      [ownerA, orgA, `${ownerA}@test`, ownerB, orgB, `${ownerB}@test`, viewerA, `${viewerA}@test`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE'),($4,$5,$6,'OWNER','ACTIVE'),($7,$2,$8,'USER','ACTIVE')`,
      [`m-${ownerA}`, orgA, ownerA, `m-${ownerB}`, orgB, ownerB, `m-${viewerA}`, viewerA]
    );
    await client.query(`INSERT INTO goals(id,organization_id,title) VALUES($1,$2,$1),($3,$4,$3)`, [
      goalA,
      orgA,
      goalB,
      orgB,
    ]);
    for (const [key, id, organizationId, role] of [
      ['ownerA', ownerA, orgA, 'OWNER'],
      ['ownerB', ownerB, orgB, 'OWNER'],
      ['viewerA', viewerA, orgA, 'USER'],
    ]) {
      tokens[key] = jwt.sign({ id, organizationId, role }, config.JWT_SECRET, { expiresIn: '10m' });
    }
    app = express();
    app.use(express.json());
    app.use('/api/initiatives', initiativesRoutes);
  });

  afterAll(async () => {
    // FIX-5: patrz komentarz w beforeAll — hooki skipnietej suity i tak sie wykonuja,
    // a ponizej sa DELETE-y. Bez tego zamka sprzatanie leci w cudza baze.
    if (!REAL_PG || !client) return;
    for (const table of [
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ]) {
      await client.query(`DELETE FROM ${table} WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
    }
    await client.query(`DELETE FROM goals WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
    await client.query(`DELETE FROM organization_members WHERE organization_id=ANY($1)`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM users WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
    await client.query(`DELETE FROM organizations WHERE id=ANY($1)`, [[orgA, orgB]]);
    await client.end();
  });

  it('assigns a human declaration and exposes it through the read model', async () => {
    const response = await request(app)
      .post(path(goalA))
      .set(auth('ownerA'))
      .send(body(`happy-${tag}`, 0, 'financial'));
    expect(response.status).toBe(201);
    const independent = new Client({ connectionString: DATABASE_URL });
    await independent.connect();
    expect(
      (await independent.query(`SELECT perspective FROM goals WHERE id=$1`, [goalA])).rows[0]
    ).toEqual({ perspective: 'financial' });
    await independent.end();
    const read = await request(app)
      .get('/api/initiatives/runtime-v1/control-kpis?weekStart=2026-08-24')
      .set(auth('ownerA'));
    expect(read.body.goalPerspectives).toContainEqual({
      goalId: goalA,
      perspective: 'financial',
      sourceClass: 'FACT',
    });
  });

  it('allows a human to clear the declaration back to UNASSIGNED', async () => {
    const response = await request(app)
      .post(path(goalA))
      .set(auth('ownerA'))
      .send(body(`clear-${tag}`, 1, null));
    expect(response.status).toBe(201);
    const read = await request(app)
      .get('/api/initiatives/runtime-v1/control-kpis?weekStart=2026-08-24')
      .set(auth('ownerA'));
    expect(read.body.goalPerspectives).toContainEqual({
      goalId: goalA,
      perspective: 'UNASSIGNED',
      sourceClass: null,
    });
  });

  it('rejects an undeclared value without mutation', async () => {
    const response = await request(app)
      .post(path(goalA))
      .set(auth('ownerA'))
      .send(body(`bad-${tag}`, 2, 'guessed'));
    expect(response.status).toBe(400);
    expect(
      (await client.query(`SELECT perspective FROM goals WHERE id=$1`, [goalA])).rows[0].perspective
    ).toBeNull();
  });

  it('enforces CAS when two writers use the same expected version', async () => {
    const [first, second] = await Promise.all([
      request(app)
        .post(path(goalA))
        .set(auth('ownerA'))
        .send(body(`cas-a-${tag}`, 2, 'customer')),
      request(app)
        .post(path(goalA))
        .set(auth('ownerA'))
        .send(body(`cas-b-${tag}`, 2, 'learning')),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
  });

  it('replays one request as one mutation and one audit event', async () => {
    const replayGoal = `goal-replay-${tag}`;
    await client.query(`INSERT INTO goals(id,organization_id,title) VALUES($1,$2,$1)`, [
      replayGoal,
      orgA,
    ]);
    const payload = body(`replay-${tag}`, 0, 'process');
    expect(
      (await request(app).post(path(replayGoal)).set(auth('ownerA')).send(payload)).status
    ).toBe(201);
    expect(
      (await request(app).post(path(replayGoal)).set(auth('ownerA')).send(payload)).status
    ).toBe(200);
    const audits = await client.query(
      `SELECT COUNT(*)::int count FROM ie_audit_events WHERE organization_id=$1 AND aggregate_id=$2`,
      [orgA, replayGoal]
    );
    expect(audits.rows[0].count).toBe(1);
  });

  it('fails closed for a foreign goal and claimed organization', async () => {
    const response = await request(app)
      .post(path(goalA))
      .set({ ...auth('ownerB'), 'X-Organization-Id': orgA })
      .send({ ...body(`foreign-${tag}`, 0, 'financial'), organizationId: orgA });
    expect(response.status).toBe(404);
  });

  // FIX-4 (odbior dyzuru 33): powyzszy test wysyla naglowek X-Organization-Id, wiec trafia
  // w INNA bramke (odrzucenie deklarowanej, obcej organizacji) i nigdy nie dochodzi do
  // UPDATE goals ... WHERE organization_id=... . Realna sciezka tenantowa — obcy cel, ZERO
  // naglowka, organizacja brana wylacznie z tokenu — byla nieprzetestowana i zwracala
  // 400 COMMAND_VALIDATION_FAILED zamiast wymaganego przez DoD 404.
  it('answers 404, not 400, for a foreign goal without any organization header', async () => {
    const before = await client.query(`SELECT perspective FROM goals WHERE id=$1`, [goalA]);
    const response = await request(app)
      .post(path(goalA))
      .set(auth('ownerB'))
      .send(body(`foreign-noheader-${tag}`, 0, 'financial'));
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: 'GOAL_NOT_FOUND' } });
    // i zaden zapis nie doszedl do skutku
    const after = await client.query(`SELECT perspective FROM goals WHERE id=$1`, [goalA]);
    expect(after.rows[0]).toEqual(before.rows[0]);
    const audits = await client.query(
      `SELECT COUNT(*)::int count FROM ie_audit_events WHERE organization_id=$1 AND aggregate_id=$2`,
      [orgB, goalA]
    );
    expect(audits.rows[0].count).toBe(0);
  });

  it('rejects an actor without capability and leaves no audit or mutation', async () => {
    const before = await client.query(`SELECT perspective FROM goals WHERE id=$1`, [goalA]);
    const response = await request(app)
      .post(path(goalA))
      .set(auth('viewerA'))
      .send(body(`viewer-${tag}`, 3, 'financial'));
    expect(response.status).toBe(404);
    expect(
      (await client.query(`SELECT perspective FROM goals WHERE id=$1`, [goalA])).rows[0]
    ).toEqual(before.rows[0]);
    expect(
      (
        await client.query(
          `SELECT COUNT(*)::int count FROM ie_audit_events WHERE client_request_id=$1`,
          [`viewer-${tag}`]
        )
      ).rows[0].count
    ).toBe(0);
  });
});
