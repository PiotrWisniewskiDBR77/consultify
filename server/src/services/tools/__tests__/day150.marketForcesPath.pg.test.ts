/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const suffix = randomUUID().slice(0, 8);
const organizationId = `day150-org-${suffix}`;
const userId = `day150-user-${suffix}`;
const sessionId = `day150-session-${suffix}`;

let app: Express;
let token = '';

async function db(): Promise<Client> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

function auth() {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  expect(process.env.DB_TYPE).toBe('postgres');
  expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
  await assertRealPostgresTestEnvironment();

  const client = await db();
  try {
    await client.query(
      `INSERT INTO organizations (id,name,plan,status) VALUES ($1,$2,'enterprise','active')`,
      [organizationId, `Day150 ${suffix}`]
    );
    await client.query(
      `INSERT INTO users (id,organization_id,email,password,role,status)
       VALUES ($1,$2,$3,'unused','ADMIN','active')`,
      [userId, organizationId, `${userId}@example.test`]
    );
    await client.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'ADMIN','ACTIVE')`,
      [`day150-member-${suffix}`, organizationId, userId]
    );
  } finally {
    await client.end();
  }

  const [{ default: config }, { ApiGateway }] = await Promise.all([
    import('../../../config/Config.js'),
    import('../../../Gateway.js'),
  ]);
  token = jwt.sign(
    { id: userId, userId, organizationId, role: 'ADMIN', email: `${userId}@example.test` },
    config.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '10m' }
  );
  app = express();
  app.use(express.json());
  ApiGateway.getInstance().initializeRoutes(app);
}, 60_000);

afterAll(async () => {
  const client = await db();
  try {
    await client.query(`DELETE FROM tool_output_approvals WHERE organization_id=$1`, [organizationId]);
    await client.query(`DELETE FROM tool_outputs WHERE organization_id=$1`, [organizationId]);
    await client.query(`DELETE FROM tool_initiative_links WHERE organization_id=$1`, [organizationId]);
    await client.query(`DELETE FROM initiatives WHERE organization_id=$1`, [organizationId]);
    await client.query(`DELETE FROM my_ideas WHERE organization_id=$1`, [organizationId]);
    await client.query(`DELETE FROM tool_sessions WHERE organization_id=$1`, [organizationId]);
    await client.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await client.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await client.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
  } finally {
    await client.end();
  }
});

describe('Day150 market-forces path behind the inactive catalog gate (real Gateway + real PG)', () => {
  it('the normal product entry refuses a new market-forces session', async () => {
    const response = await request(app)
      .post('/api/tools')
      .set(auth())
      .send({ toolType: 'market-forces', name: 'Day150 normal entry' });

    expect(response.status).toBe(409);
  });

  it('a directly seeded session remains reachable and writable through the real Gateway', async () => {
    const answers = {
      context: { industry: 'industrial automation', geographicScope: 'Poland' },
      signals: [{ id: 'signal-1', forceId: 'competitive-rivalry', text: 'Price pressure' }],
      recommendedMoves: [{ id: 'move-1', title: 'Move sales online' }],
    };
    const client = await db();
    try {
      await client.query(
        `INSERT INTO tool_sessions
          (id,organization_id,project_id,tool_type,name,status,completion_percent,
           confidence_avg,answers_json,version,created_by,updated_by,created_at,updated_at)
         VALUES ($1,$2,NULL,'market-forces',$3,'DRAFT',0,0,'{}',1,$4,$4,NOW(),NOW())`,
        [sessionId, organizationId, 'Day150 seeded Porter', userId]
      );
    } finally {
      await client.end();
    }

    const opened = await request(app).get(`/api/tools/${sessionId}`).set(auth());
    expect(opened.status, JSON.stringify(opened.body)).toBe(200);
    expect(opened.body.toolType).toBe('market-forces');

    const saved = await request(app).put(`/api/tools/${sessionId}`).set(auth()).send({
      answers,
      contextSnapshot: { measurement: 'day150' },
      completionPercent: 100,
      confidenceAvg: 4.5,
      missingItems: [],
      expectedVersion: 1,
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body.version).toBe(2);

    const readback = await request(app).get(`/api/tools/${sessionId}`).set(auth());
    expect(readback.status).toBe(200);
    expect(readback.body.answers.signals).toHaveLength(1);
  });

  it('promotion succeeds but freezes honestly-empty lineage and renders a degenerate report', async () => {
    const client = await db();
    try {
      await client.query(`UPDATE tool_sessions SET status='APPROVED' WHERE id=$1`, [sessionId]);
    } finally {
      await client.end();
    }

    const promoted = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(auth())
      .send({ outputType: 'idea', title: 'Day150 Porter output' });
    expect(promoted.status, JSON.stringify(promoted.body)).toBe(200);

    const cold = await db();
    try {
      const result = await cold.query(
        `SELECT id,status,payload_json FROM tool_outputs WHERE tool_session_id=$1`,
        [sessionId]
      );
      expect(result.rows).toHaveLength(1);
      const payload = result.rows[0].payload_json;
      expect(payload.items).toEqual([]);
      expect(payload.tensions).toEqual([]);
      expect(payload.conclusions).toEqual([]);

      const { renderToolReport } = await import('../../../../../src/toolOutputs/renderReport.js');
      const report = renderToolReport(
        [{
          id: result.rows[0].id,
          organizationId,
          toolSessionId: sessionId,
          toolType: 'market-forces',
          methodPackVersion: '1.0.0',
          version: 1,
          title: 'Day150 Porter output',
          status: 'approved',
          items: payload.items,
          tensions: payload.tensions,
          conclusions: payload.conclusions,
          createdAt: new Date(0).toISOString(),
          createdBy: userId,
          contentHash: 'day150-measurement',
        }],
        { id: 'day150-report', organizationId, kind: 'report', title: 'Day150 report' }
      );
      expect(report.sections).toHaveLength(1);
      expect(report.sections[0].blocks).toHaveLength(1);
      expect(report.sections[0].blocks[0]).toMatchObject({
        kind: 'signature-visual',
        payload: { items: [], tensions: [] },
      });
    } finally {
      await cold.end();
    }
  });
});
