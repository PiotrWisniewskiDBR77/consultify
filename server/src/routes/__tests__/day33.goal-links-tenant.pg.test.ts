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
const REAL_PG = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';

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
    await client.query(`INSERT INTO goals(id,organization_id,title) VALUES($1,$2,$1)`, [
      goalA,
      orgA,
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
    if (!client) return;
    await client.query(`DELETE FROM goal_initiative_links WHERE organization_id=$1`, [orgA]);
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
});
