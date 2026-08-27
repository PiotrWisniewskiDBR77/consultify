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

describe.skipIf(!REAL_PG)('Day 33 operational versus strategic report classification', () => {
  const tag = randomUUID();
  const organizations = ['empty', 'unassigned', 'partial', 'full'].map(
    (kind) => `day33-class-${kind}-${tag}`
  );
  const tokens = new Map<string, string>();
  let client: Client;
  let app: express.Express;

  beforeAll(async () => {
    // FIX-5 (odbior dyzuru 33) — DRUGI ZAMEK, niezbedny: vitest 4.1.8 URUCHAMIA hooki
    // beforeAll/afterAll suity oznaczonej `describe.skipIf(true)`. Sam warunek przy `describe`
    // NIE chroni polaczenia ani sprzatania. Zweryfikowane empirycznie na tej gałęzi:
    // z pustym DATABASE_URL hooki laczyly sie przez domyslne libpq do CUDZEJ bazy
    // (/private/tmp/.s.PGSQL.5432) i wykonywaly tam DELETE.
    if (!REAL_PG) return;
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    for (const org of organizations) {
      const user = `owner-${org}`;
      await client.query(`INSERT INTO organizations(id,name) VALUES($1,$1)`, [org]);
      await client.query(
        `INSERT INTO users(id,organization_id,email,role,status) VALUES($1,$2,$3,'OWNER','active')`,
        [user, org, `${user}@test`]
      );
      await client.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')`,
        [`m-${user}`, org, user]
      );
      tokens.set(
        org,
        jwt.sign({ id: user, organizationId: org, role: 'OWNER' }, config.JWT_SECRET)
      );
    }
    for (const org of organizations.slice(1)) {
      const initiative = `initiative-${org}`;
      const goal = `goal-${org}`;
      const perspective = org.includes('unassigned') ? null : 'financial';
      await client.query(`INSERT INTO initiatives(id,organization_id,name) VALUES($1,$2,$1)`, [
        initiative,
        org,
      ]);
      await client.query(
        `INSERT INTO goals(id,organization_id,title,perspective) VALUES($1,$2,$1,$3)`,
        [goal, org, perspective]
      );
      await client.query(
        `INSERT INTO goal_initiative_links(id,organization_id,goal_id,initiative_id) VALUES($1,$2,$3,$4)`,
        [`link-${org}`, org, goal, initiative]
      );
      await client.query(
        `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES($1,'execution_task',$2,1,$3::jsonb)`,
        [org, `task-${org}`, JSON.stringify({ initiativeId: initiative })]
      );
    }
    const partial = organizations[2];
    await client.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES($1,'execution_decision',$2,1,$3::jsonb)`,
      [partial, `unmapped-${partial}`, JSON.stringify({ initiativeId: `missing-${partial}` })]
    );
    app = express();
    app.use(express.json());
    app.use('/api/initiatives', initiativesRoutes);
  });

  afterAll(async () => {
    // FIX-5: patrz komentarz w beforeAll — hooki skipnietej suity i tak sie wykonuja,
    // a ponizej sa DELETE-y. Bez tego zamka sprzatanie leci w cudza baze.
    if (!REAL_PG || !client) return;
    await client.query(`DELETE FROM ie_aggregate_state WHERE organization_id=ANY($1)`, [
      organizations,
    ]);
    await client.query(`DELETE FROM goal_initiative_links WHERE id LIKE $1`, [`link-%-${tag}`]);
    await client.query(`DELETE FROM goals WHERE organization_id=ANY($1)`, [organizations]);
    await client.query(`DELETE FROM initiatives WHERE organization_id=ANY($1)`, [organizations]);
    await client.query(`DELETE FROM organization_members WHERE organization_id=ANY($1)`, [
      organizations,
    ]);
    await client.query(`DELETE FROM users WHERE organization_id=ANY($1)`, [organizations]);
    await client.query(`DELETE FROM organizations WHERE id=ANY($1)`, [organizations]);
    await client.end();
  });

  const read = (org: string) =>
    request(app)
      .get('/api/initiatives/runtime-v1/control-kpis?weekStart=2026-08-24')
      .set({ Authorization: `Bearer ${tokens.get(org)}` });

  it('keeps an empty organization operational', async () => {
    const result = (await read(organizations[0])).body.reportClassification;
    expect(result).toMatchObject({
      reportClass: 'OPERATIONAL',
      reason: { commitmentCount: 0, assignedGoalCount: 0 },
    });
  });

  it('keeps zero human declarations operational', async () => {
    const result = (await read(organizations[1])).body.reportClassification;
    expect(result).toMatchObject({
      reportClass: 'OPERATIONAL',
      reason: { commitmentCount: 1, mappedToDeclaredPerspectiveCount: 0 },
    });
  });

  it('keeps partial commitment coverage operational and reports both counts', async () => {
    const result = (await read(organizations[2])).body.reportClassification;
    expect(result).toMatchObject({
      reportClass: 'OPERATIONAL',
      reason: { commitmentCount: 2, mappedToDeclaredPerspectiveCount: 1 },
    });
  });

  it('classifies only complete real coverage as strategic', async () => {
    const result = (await read(organizations[3])).body.reportClassification;
    expect(result).toMatchObject({
      reportClass: 'STRATEGIC',
      reason: { commitmentCount: 1, mappedCommitmentCount: 1, mappedToDeclaredPerspectiveCount: 1 },
    });
  });
});
