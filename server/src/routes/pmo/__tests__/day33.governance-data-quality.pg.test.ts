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
const REAL_PG = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';

describe.skipIf(!REAL_PG)('Day 33 governance and data-quality layer', () => {
  const tag = randomUUID();
  const orgA = `day33-quality-a-${tag}`;
  const orgB = `day33-quality-b-${tag}`;
  const ownerA = `owner-a-${tag}`;
  const ownerB = `owner-b-${tag}`;
  let client: Client;
  let app: express.Express;
  let tokenA: string;
  let tokenB: string;

  const read = (token: string) =>
    request(app)
      .get('/api/initiatives/runtime-v1/control-kpis?weekStart=2026-08-24')
      .set({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,$1),($2,$2)`, [orgA, orgB]);
    await client.query(
      `INSERT INTO users(id,organization_id,email,role,status) VALUES($1,$2,$3,'OWNER','active'),($4,$5,$6,'OWNER','active')`,
      [ownerA, orgA, `${ownerA}@test`, ownerB, orgB, `${ownerB}@test`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE'),($4,$5,$6,'OWNER','ACTIVE')`,
      [`m-${ownerA}`, orgA, ownerA, `m-${ownerB}`, orgB, ownerB]
    );
    tokenA = jwt.sign({ id: ownerA, organizationId: orgA, role: 'OWNER' }, config.JWT_SECRET);
    tokenB = jwt.sign({ id: ownerB, organizationId: orgB, role: 'OWNER' }, config.JWT_SECRET);
    app = express();
    app.use(express.json());
    app.use('/api/initiatives', initiativesRoutes);
  });

  afterAll(async () => {
    if (!client) return;
    await client.query(`DELETE FROM ie_aggregate_state WHERE organization_id=ANY($1)`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM organization_members WHERE organization_id=ANY($1)`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM users WHERE organization_id=ANY($1)`, [[orgA, orgB]]);
    await client.query(`DELETE FROM organizations WHERE id=ANY($1)`, [[orgA, orgB]]);
    await client.end();
  });

  const insert = async (org: string, type: string, id: string, payload: object) =>
    client.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES($1,$2,$3,1,$4::jsonb)`,
      [org, type, id, JSON.stringify(payload)]
    );

  it('returns an honest 0/0 for an organization without commitments', async () => {
    const response = await read(tokenA);
    expect(response.body.governanceDataQuality.dimensions.missingOwner).toMatchObject({
      knowledgeState: 'KNOWN',
      numerator: 0,
      denominator: 0,
      ids: [],
    });
  });

  it('returns the complete exact drill-down set for missing owners and dates', async () => {
    await insert(orgA, 'execution_task', `task-missing-${tag}`, {
      ownerId: '',
      dueAt: '',
      evidenceRefs: [],
    });
    await insert(orgA, 'execution_task', `task-complete-${tag}`, {
      ownerId: ownerA,
      dueAt: '2026-09-01',
      evidenceRefs: ['proof'],
    });
    const response = await read(tokenA);
    expect(response.body.governanceDataQuality.dimensions.missingOwner.ids).toEqual([
      `task-missing-${tag}`,
    ]);
    expect(response.body.governanceDataQuality.dimensions.missingDueDate.ids).toEqual([
      `task-missing-${tag}`,
    ]);
  });

  it('uses the evidence-required task population as its own denominator', async () => {
    await insert(orgA, 'execution_decision', `decision-${tag}`, {
      authorityId: ownerA,
      dueAt: '2026-09-02',
    });
    const response = await read(tokenA);
    const quality = response.body.governanceDataQuality;
    expect(quality.commitmentCount).toBe(3);
    expect(quality.dimensions.missingEvidence.tasks).toMatchObject({
      numerator: 1,
      denominator: 2,
    });
  });

  it('reports decision evidence as UNKNOWN because no carrier exists', async () => {
    const response = await read(tokenA);
    expect(response.body.governanceDataQuality.dimensions.missingEvidence.decisions).toEqual({
      knowledgeState: 'UNKNOWN',
      numerator: null,
      denominator: null,
      ids: null,
      reason: 'DECISION_EVIDENCE_CARRIER_UNAVAILABLE',
    });
  });

  it('isolates the exact population by token organization', async () => {
    await insert(orgB, 'execution_task', `foreign-${tag}`, {
      ownerId: '',
      dueAt: '',
      evidenceRefs: [],
    });
    const a = await read(tokenA);
    const b = await read(tokenB);
    expect(a.body.governanceDataQuality.dimensions.missingOwner.ids).not.toContain(
      `foreign-${tag}`
    );
    expect(b.body.governanceDataQuality.dimensions.missingOwner.ids).toEqual([`foreign-${tag}`]);
  });

  it('reconciles the HTTP denominator with an independent database count', async () => {
    const response = await read(tokenA);
    const independent = new Client({ connectionString: DATABASE_URL });
    await independent.connect();
    const count = await independent.query(
      `SELECT COUNT(*)::int count FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type IN ('execution_task','execution_decision')`,
      [orgA]
    );
    await independent.end();
    expect(response.body.governanceDataQuality.commitmentCount).toBe(count.rows[0].count);
  });
});
