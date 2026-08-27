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
// FIX-5 (odbior dyzuru 33): Z25/Z26 — bramka MUSI sprawdzac takze DATABASE_URL, a hooki
// MUSZA miec wlasny zamek: vitest 4.1.8 uruchamia beforeAll/afterAll skipnietej suity.
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

// FIX-6 / P.9 — wariant C `E-O4`: zatwierdzony wklad liczbowy z `rvn_kpi_initiative_impacts`
// jest UDOSTEPNIONY w kopercie Realizacji addytywnie, bez zmiany modulu Results.
describe.skipIf(!REAL_PG)('Day 33 committed numeric contribution (E-O4 variant C)', () => {
  const tag = randomUUID();
  const orgA = `day33-numc-a-${tag}`;
  const orgB = `day33-numc-b-${tag}`;
  const ownerA = `owner-a-${tag}`;
  const ownerB = `owner-b-${tag}`;
  const goalA = `goal-a-${tag}`;
  // initiativeWithImpact ma zatwierdzony wklad liczbowy, initiativeClassOnly tylko klase.
  const initiativeWithImpact = `init-num-${tag}`;
  const initiativeClassOnly = `init-class-${tag}`;
  let client: Client;
  let app: express.Express;
  let tokenA: string;
  let tokenB: string;
  let kpiId: string;
  let impactId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const envelope = (token: string) =>
    request(app)
      .get('/api/initiatives/runtime-v1/control-kpis?weekStart=2026-08-24')
      .set(auth(token));

  beforeAll(async () => {
    if (!REAL_PG) return;
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    for (const [org, user] of [
      [orgA, ownerA],
      [orgB, ownerB],
    ]) {
      await client.query(`INSERT INTO organizations(id,name) VALUES($1,$1)`, [org]);
      await client.query(
        `INSERT INTO users(id,organization_id,email,role,status) VALUES($1,$2,$3,'OWNER','active')`,
        [user, org, `${user}@test`]
      );
      await client.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')`,
        [`m-${user}`, org, user]
      );
    }
    await client.query(`INSERT INTO goals(id,organization_id,title,owner_id) VALUES($1,$2,$1,$3)`, [
      goalA,
      orgA,
      ownerA,
    ]);
    for (const initiative of [initiativeWithImpact, initiativeClassOnly]) {
      await client.query(
        `INSERT INTO initiatives(id,organization_id,name,progress) VALUES($1,$2,$1,10)`,
        [initiative, orgA]
      );
      await client.query(
        `INSERT INTO goal_initiative_links(id,goal_id,initiative_id,organization_id,contribution_class)
         VALUES($1,$2,$3,$4,'IMPORTANT')`,
        [`link-${initiative}`, goalA, initiative, orgA]
      );
    }
    kpiId = (
      await client.query<{ kpi_id: string }>(
        `INSERT INTO rvn_kpi_definitions(organization_id,kpi_code,status,created_by)
         VALUES($1,$2,'active',$3) RETURNING kpi_id::text kpi_id`,
        [orgA, `KPI-${tag}`, ownerA]
      )
    ).rows[0].kpi_id;
    impactId = (
      await client.query<{ impact_id: string }>(
        `INSERT INTO rvn_kpi_initiative_impacts
           (organization_id,kpi_id,initiative_id,status,
            expected_contribution_value,expected_contribution_direction,
            baseline_value_at_commitment,committed_by,committed_at,proposed_by,created_by)
         VALUES($1,$2,$3,'committed',$4,'increase',$5,$6,now(),$6,$6)
         RETURNING impact_id::text impact_id`,
        [orgA, kpiId, initiativeWithImpact, '12.5', '4.0', ownerA]
      )
    ).rows[0].impact_id;
    tokenA = jwt.sign({ id: ownerA, organizationId: orgA, role: 'OWNER' }, config.JWT_SECRET);
    tokenB = jwt.sign({ id: ownerB, organizationId: orgB, role: 'OWNER' }, config.JWT_SECRET);
    app = express();
    app.use(express.json());
    app.use('/api/initiatives', initiativesRoutes);
  });

  afterAll(async () => {
    if (!REAL_PG || !client) return;
    await client.query(`DELETE FROM rvn_kpi_initiative_impacts WHERE organization_id=ANY($1)`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id=ANY($1)`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM goal_initiative_links WHERE organization_id=ANY($1)`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM goals WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
    await client.query(`DELETE FROM initiatives WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
    await client.query(`DELETE FROM organization_members WHERE organization_id=ANY($1)`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM users WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
    await client.query(`DELETE FROM organizations WHERE id=ANY($1)`, [[orgA, orgB]]);
    await client.end();
  });

  it('exposes a committed numeric contribution with a reference to its carrier', async () => {
    const response = await envelope(tokenA);
    expect(response.status).toBe(200);
    const pair = response.body.goalInitiativeContributions.find(
      (item: { initiativeId: string }) => item.initiativeId === initiativeWithImpact
    );
    expect(pair).toMatchObject({
      goalId: goalA,
      initiativeId: initiativeWithImpact,
      contributionClass: 'IMPORTANT',
      numericContributionState: 'COMMITTED',
      presentationPrecedence: 'NUMERIC_CONTRIBUTION',
    });
    expect(pair.numericContributions).toEqual([
      {
        impactId,
        kpiId,
        expectedContributionValue: '12.5',
        expectedContributionDirection: 'increase',
        rowVersion: 1,
        sourceRef: `rvn_kpi_initiative_impacts:${impactId}`,
      },
    ]);
  });

  it('reports the honest absence of a committed contribution — never a zero', async () => {
    const response = await envelope(tokenA);
    const pair = response.body.goalInitiativeContributions.find(
      (item: { initiativeId: string }) => item.initiativeId === initiativeClassOnly
    );
    expect(pair).toMatchObject({
      contributionClass: 'IMPORTANT',
      numericContributionState: 'NONE',
      presentationPrecedence: 'CONTRIBUTION_CLASS',
    });
    expect(pair.numericContributions).toEqual([]);
    // ★ brak deklaracji NIE jest liczba
    expect(JSON.stringify(pair)).not.toContain('"expectedContributionValue":0');
    expect(JSON.stringify(pair)).not.toContain('"expectedContributionValue":"0"');
  });

  it('does not classify a proposed (not yet committed) contribution as committed', async () => {
    await client.query(`UPDATE rvn_kpi_initiative_impacts SET status='cancelled' WHERE impact_id=$1`, [
      impactId,
    ]);
    const response = await envelope(tokenA);
    const pair = response.body.goalInitiativeContributions.find(
      (item: { initiativeId: string }) => item.initiativeId === initiativeWithImpact
    );
    expect(pair.numericContributionState).toBe('NONE');
    expect(pair.presentationPrecedence).toBe('CONTRIBUTION_CLASS');
    await client.query(`UPDATE rvn_kpi_initiative_impacts SET status='committed' WHERE impact_id=$1`, [
      impactId,
    ]);
  });

  it('NEGATYW TENANTA — another organization sees none of it', async () => {
    const response = await envelope(tokenB);
    expect(response.status).toBe(200);
    expect(response.body.goalInitiativeContributions).toEqual([]);
    expect(JSON.stringify(response.body)).not.toContain(impactId);
    expect(JSON.stringify(response.body)).not.toContain(initiativeWithImpact);
  });
});
