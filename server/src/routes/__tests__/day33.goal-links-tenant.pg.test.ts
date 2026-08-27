/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../config/Config.js';
import initiativeGovernanceRoutes from '../initiative-governance.routes.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
// FIX-5 (odbior dyzuru 33): Z25/Z26 — bramka MUSI sprawdzac takze DATABASE_URL.
// Bez tego warunku `new Client({ connectionString: '' })` schodzi do domyslnych libpq
// i na maszynie deweloperskiej trafia w gniazdo /private/tmp/.s.PGSQL.5432 — czyli w CUDZA
// baze — a `afterAll` tej suity robi DELETE na goal_initiative_links / goals / users /
// organizations. Ten sam ksztalt bramki co w poprawnym pliku tego samego dyzuru:
// server/src/services/executionControl/__tests__/goalPerspectiveMigration.pg.test.ts:12.
// ★ TRZECI ZAMEK, dzialajacy NIEZALEZNIE od tests/setup.ts (Z20 — tego pliku nie dotykamy
// z tej pozycji). tests/setup.ts:386-388 PODMIENIA brak/pusty DATABASE_URL na ten adres,
// wiec warunek `startsWith('postgres')` sam z siebie jest ZAWSZE prawdziwy i niczego nie
// chroni. Odrzucamy wiec wstrzyknieta wartosc wartownicza wprost: port 5432 na tej maszynie
// nasluchuje i NIE jest baza tego dyzuru.
const SETUP_INJECTED_FALLBACK_URL = 'postgresql://iris:iris_test@localhost:5432/iris_test';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres') &&
  DATABASE_URL !== SETUP_INJECTED_FALLBACK_URL;

describe.skipIf(!REAL_PG)('Day 33 goal-initiative tenant carrier', () => {
  const tag = randomUUID();
  const orgA = `day33-links-a-${tag}`;
  const orgB = `day33-links-b-${tag}`;
  const userA = `owner-a-${tag}`;
  const userB = `owner-b-${tag}`;
  const goalA = `goal-a-${tag}`;
  const initiativeA = `initiative-a-${tag}`;
  let client: Client;
  let app: express.Express;
  let tokenA: string;
  let tokenB: string;

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
      `INSERT INTO users(id,organization_id,email,role,status) VALUES($1,$2,$3,'OWNER','active'),($4,$5,$6,'OWNER','active')`,
      [userA, orgA, `${userA}@test`, userB, orgB, `${userB}@test`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE'),($4,$5,$6,'OWNER','ACTIVE')`,
      [`m-${userA}`, orgA, userA, `m-${userB}`, orgB, userB]
    );
    await client.query(`INSERT INTO goals(id,organization_id,title,owner_id) VALUES($1,$2,$1,$3)`, [
      goalA,
      orgA,
      userA,
    ]);
    await client.query(
      `INSERT INTO initiatives(id,organization_id,name,progress) VALUES($1,$2,$1,50)`,
      [initiativeA, orgA]
    );
    await client.query(
      `INSERT INTO goal_initiative_links(id,goal_id,initiative_id,organization_id) VALUES($1,$2,$3,$4)`,
      [`link-${tag}`, goalA, initiativeA, orgA]
    );
    tokenA = jwt.sign({ id: userA, organizationId: orgA, role: 'OWNER' }, config.JWT_SECRET);
    tokenB = jwt.sign({ id: userB, organizationId: orgB, role: 'OWNER' }, config.JWT_SECRET);
    app = express();
    app.use(express.json());
    app.use('/api/initiatives-v4', initiativeGovernanceRoutes);
  });

  afterAll(async () => {
    // FIX-5: patrz komentarz w beforeAll — hooki skipnietej suity i tak sie wykonuja,
    // a ponizej sa DELETE-y. Bez tego zamka sprzatanie leci w cudza baze.
    if (!REAL_PG || !client) return;
    await client.query(`DELETE FROM goal_initiative_links WHERE organization_id=$1`, [orgA]);
    await client.query(`DELETE FROM execution_control_kpi_policies WHERE organization_id=$1`, [
      orgA,
    ]);
    await client.query(`DELETE FROM goals WHERE organization_id=$1`, [orgA]);
    await client.query(`DELETE FROM initiatives WHERE organization_id=$1`, [orgA]);
    await client.query(`DELETE FROM organization_members WHERE organization_id=ANY($1)`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM users WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
    await client.query(`DELETE FROM organizations WHERE id=ANY($1)`, [[orgA, orgB]]);
    await client.end();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('returns 404 and no links when another tenant asks for the goal initiatives', async () => {
    const response = await request(app)
      .get(`/api/initiatives-v4/goals/${goalA}/initiatives`)
      .set(auth(tokenB));
    expect(response.status).toBe(404);
    expect(JSON.stringify(response.body)).not.toContain(initiativeA);
  });

  it('returns 404 and no numbers when another tenant asks for the rollup', async () => {
    const response = await request(app)
      .get(`/api/initiatives-v4/goals/${goalA}/rollup`)
      .set(auth(tokenB));
    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty('linkedInitiatives');
  });

  it('keeps same-tenant read working through both organization filters', async () => {
    const response = await request(app)
      .get(`/api/initiatives-v4/goals/${goalA}/rollup`)
      .set(auth(tokenA));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ linkedInitiatives: 1, initiativeProgressCount: 1 });
  });

  it('stores a declared class without changing the frozen weight when policy is missing', async () => {
    const before = (
      await client.query(
        `SELECT contribution_weight FROM goal_initiative_links WHERE organization_id=$1 AND goal_id=$2`,
        [orgA, goalA]
      )
    ).rows[0].contribution_weight;
    const response = await request(app)
      .post(`/api/initiatives-v4/goals/${goalA}/initiatives`)
      .set(auth(tokenA))
      .send({ initiativeId: initiativeA, contributionClass: 'CRITICAL' });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      contributionClass: 'CRITICAL',
      valueReason: 'DECISION_REQUIRED',
      missingParameters: ['impactWeights'],
    });
    const stored = (
      await client.query(
        `SELECT contribution_class,contribution_weight FROM goal_initiative_links WHERE organization_id=$1 AND goal_id=$2`,
        [orgA, goalA]
      )
    ).rows[0];
    expect(stored).toEqual({ contribution_class: 'CRITICAL', contribution_weight: before });
  });

  it('derives and freezes the weight from the named policy version', async () => {
    const policyId = `policy-${tag}`;
    await client.query(
      `INSERT INTO execution_control_kpi_policies(organization_id,policy_id,name,parameters,row_version)
       VALUES($1,$2,$2,$3::jsonb,1)`,
      [
        orgA,
        policyId,
        JSON.stringify({ impactWeights: { CRITICAL: 4, IMPORTANT: 2, SUPPORTING: 1 } }),
      ]
    );
    const response = await request(app)
      .post(`/api/initiatives-v4/goals/${goalA}/initiatives`)
      .set(auth(tokenA))
      .send({ initiativeId: initiativeA, contributionClass: 'IMPORTANT', policyId });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      contributionClass: 'IMPORTANT',
      contributionWeight: 2,
      contributionPolicy: { policyId, rowVersion: 1 },
      valueReason: null,
    });
    await client.query(
      `UPDATE execution_control_kpi_policies SET parameters=$1::jsonb,row_version=2
        WHERE organization_id=$2 AND policy_id=$3`,
      [
        JSON.stringify({ impactWeights: { CRITICAL: 8, IMPORTANT: 6, SUPPORTING: 3 } }),
        orgA,
        policyId,
      ]
    );
    const stored = (
      await client.query(
        `SELECT contribution_class,contribution_weight,contribution_policy_row_version
           FROM goal_initiative_links WHERE organization_id=$1 AND goal_id=$2`,
        [orgA, goalA]
      )
    ).rows[0];
    expect(stored).toEqual({
      contribution_class: 'IMPORTANT',
      contribution_weight: 2,
      contribution_policy_row_version: 1,
    });
  });

  it('rejects an undeclared contribution class without mutation', async () => {
    const response = await request(app)
      .post(`/api/initiatives-v4/goals/${goalA}/initiatives`)
      .set(auth(tokenA))
      .send({ initiativeId: initiativeA, contributionClass: 'URGENT' });
    expect(response.status).toBe(400);
  });

  it('rejects conflicting class and numeric weight instead of choosing silently', async () => {
    const response = await request(app)
      .post(`/api/initiatives-v4/goals/${goalA}/initiatives`)
      .set(auth(tokenA))
      .send({
        initiativeId: initiativeA,
        contributionClass: 'IMPORTANT',
        contributionWeight: 999,
        policyId: `policy-${tag}`,
      });
    expect(response.status).toBe(400);
  });

  // FIX-2 (odbior dyzuru 33): sciezka INSERT byla NIEPRZETESTOWANA. Wszystkie testy wyzej
  // trafiaja w wiersz zaseedowany w beforeAll, wiec ida przez ON CONFLICT. Ten test tworzy
  // NOWY link z klasa i BEZ polityki — czyli dokladnie ta sciezke, ktora zapisywala NULL,
  // a `getGoalRollup` zamieniala go po cichu na pelny wklad 1.0.
  it('creates a NEW class link without writing any contribution weight at all', async () => {
    const goal = `fresh-goal-${tag}`;
    const initiative = `fresh-init-${tag}`;
    await client.query(`INSERT INTO goals(id,organization_id,title,owner_id) VALUES($1,$2,$1,$3)`, [
      goal,
      orgA,
      userA,
    ]);
    await client.query(
      `INSERT INTO initiatives(id,organization_id,name,progress) VALUES($1,$2,$1,40)`,
      [initiative, orgA]
    );

    const response = await request(app)
      .post(`/api/initiatives-v4/goals/${goal}/initiatives`)
      .set(auth(tokenA))
      .send({ initiativeId: initiative, contributionClass: 'SUPPORTING' });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      contributionClass: 'SUPPORTING',
      contributionWeight: null,
      valueReason: 'DECISION_REQUIRED',
      missingParameters: ['impactWeights'],
    });

    const stored = (
      await client.query(
        `SELECT contribution_class,contribution_weight,contribution_policy_id
           FROM goal_initiative_links WHERE organization_id=$1 AND goal_id=$2`,
        [orgA, goal]
      )
    ).rows[0];
    // Ani 1.0 (§P.8.d pkt 3), ani ciche 1.0 z DEFAULT-u schematu (migracja 20261222
    // zdjela DEFAULT). Kolumna jest po prostu nieustalona.
    expect(stored.contribution_weight).toBeNull();
    expect(stored.contribution_class).toBe('SUPPORTING');
    expect(stored.contribution_policy_id).toBeNull();

    // I najwazniejsze: rollup NIE udaje, ze ta waga wynosi 1 — mowi to wprost.
    const rollup = await request(app)
      .get(`/api/initiatives-v4/goals/${goal}/rollup`)
      .set(auth(tokenA));
    expect(rollup.status).toBe(200);
    expect(rollup.body).toMatchObject({
      linkedInitiatives: 1,
      unsetContributionWeights: 1,
      contributionWeightValueReason: 'DECISION_REQUIRED',
    });
  });

  // FIX-3 (odbior dyzuru 33): stempel polityki nie moze klamac. Poprzednio ten test
  // wysylal liczbe na link, ktory NIOSL juz klase 'IMPORTANT' i stempel polityki
  // (policy-${tag}, rowVersion 1), dostawal 201, a asercja sprawdzala WYLACZNIE liczbe.
  // Wiersz zostawal z odmrozona, reczna waga 7 i nietknietym stemplem — odczyt
  // „z ktorej polityki wyliczono te wage" stawal sie nieprawda.
  it('refuses a legacy numeric weight on a governed link and leaves the policy stamp intact', async () => {
    const before = (
      await client.query(
        `SELECT contribution_class,contribution_weight,contribution_policy_id,contribution_policy_row_version
           FROM goal_initiative_links WHERE organization_id=$1 AND goal_id=$2`,
        [orgA, goalA]
      )
    ).rows[0];
    expect(before.contribution_class).toBe('IMPORTANT');
    expect(before.contribution_policy_id).toBe(`policy-${tag}`);

    const response = await request(app)
      .post(`/api/initiatives-v4/goals/${goalA}/initiatives`)
      .set(auth(tokenA))
      .send({ initiativeId: initiativeA, contributionWeight: 7 });
    expect(response.status).toBe(400);

    const after = (
      await client.query(
        `SELECT contribution_class,contribution_weight,contribution_policy_id,contribution_policy_row_version
           FROM goal_initiative_links WHERE organization_id=$1 AND goal_id=$2`,
        [orgA, goalA]
      )
    ).rows[0];
    expect(after).toEqual(before);
  });

  it('keeps the legacy contributionWeight-only request compatible on an ungoverned link', async () => {
    const goal = `legacy-goal-${tag}`;
    const initiative = `legacy-init-${tag}`;
    await client.query(`INSERT INTO goals(id,organization_id,title,owner_id) VALUES($1,$2,$1,$3)`, [
      goal,
      orgA,
      userA,
    ]);
    await client.query(
      `INSERT INTO initiatives(id,organization_id,name,progress) VALUES($1,$2,$1,30)`,
      [initiative, orgA]
    );
    const response = await request(app)
      .post(`/api/initiatives-v4/goals/${goal}/initiatives`)
      .set(auth(tokenA))
      .send({ initiativeId: initiative, contributionWeight: 7 });
    expect(response.status).toBe(201);
    const stored = (
      await client.query(
        `SELECT contribution_weight,contribution_class,contribution_policy_id
           FROM goal_initiative_links WHERE organization_id=$1 AND goal_id=$2`,
        [orgA, goal]
      )
    ).rows[0];
    expect(stored.contribution_weight).toBe(7);
    expect(stored.contribution_class).toBeNull();
    expect(stored.contribution_policy_id).toBeNull();
  });

  it('requires the goal owner to approve a contribution class', async () => {
    const goal = `unowned-${tag}`;
    await client.query(`INSERT INTO goals(id,organization_id,title,owner_id) VALUES($1,$2,$1,$3)`, [
      goal,
      orgA,
      `someone-else-${tag}`,
    ]);
    const response = await request(app)
      .post(`/api/initiatives-v4/goals/${goal}/initiatives`)
      .set(auth(tokenA))
      .send({ initiativeId: initiativeA, contributionClass: 'SUPPORTING' });
    expect(response.status).toBe(403);
    expect(
      (
        await client.query(
          `SELECT COUNT(*)::int count FROM goal_initiative_links WHERE organization_id=$1 AND goal_id=$2`,
          [orgA, goal]
        )
      ).rows[0].count
    ).toBe(0);
  });
});
