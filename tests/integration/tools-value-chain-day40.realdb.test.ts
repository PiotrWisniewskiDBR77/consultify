import express, { type Express } from 'express';
import { writeFile } from 'node:fs/promises';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres.js';

process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const DATABASE_URL = process.env.DATABASE_URL as string;
const P = `day40-${Date.now()}-`;
const ORG_A = `${P}org-a`;
const ORG_B = `${P}org-b`;
const ACTOR_A = `${P}actor-a`;
const ACTOR_B = `${P}actor-b`;
let app: Express;
let swotOutputId = '';
let genericOutputId = '';
let sessionSequence = 0;

async function db(): Promise<Client> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

const as = (org: string, user: string) => ({
  'x-test-org': org,
  'x-test-user': user,
  'x-test-role': 'admin',
});

/**
 * day54 FIX-D note (2026-08-28): `POST /api/tools` now 404s
 * (UNKNOWN_TOOL_TYPE) for any toolType absent from the KnownToolsService
 * catalog — 'day40-generic' below is a synthetic, never-cataloged label used
 * ONLY to exercise the honest-empty-snapshot fallback of the OUTPUT
 * PIPELINE (`buildOutputForSession` / `promoteToOutput`), not a real
 * discoverable tool. It was never reachable through the public creation
 * endpoint on its own merits — the pre-FIX-D permissiveness that let it
 * through was exactly the gap FIX-D closes. To keep exercising the
 * downstream pipeline this scenario targets, this helper seeds the
 * `tool_sessions` row directly (bypassing ONLY the creation gate) and then
 * drives IN_PROGRESS -> REVIEW -> approve -> promote through the same real
 * HTTP handlers as every other case — those handlers are untouched by
 * FIX-D.
 */
async function seedSessionDirectly(toolType: string): Promise<string> {
  const client = await db();
  const id = (await import('node:crypto')).randomUUID();
  const now = new Date().toISOString();
  try {
    await client.query(
      `INSERT INTO tool_sessions (
        id, organization_id, project_id, tool_type, name, status,
        completion_percent, confidence_avg, answers_json, context_snapshot,
        created_by, updated_by, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,'DRAFT',0,0,'{}','{}',$6,$6,$7,$7)`,
      [id, ORG_A, null, toolType, `${P}${toolType}-${++sessionSequence}`, ACTOR_A, now]
    );
  } finally {
    await client.end();
  }
  return id;
}

async function driveAnswersApprovePromote(sessionId: string, toolType: string): Promise<void> {
  const answers =
    toolType === 'dynamic-swot'
      ? {
          items: [
            {
              id: 's1',
              text: 'Silny zespół',
              quadrant: 'strengths',
              impact: 'high',
              proposalStatus: 'accepted',
              evidenceStatus: 'confirmed',
            },
            {
              id: 'o1',
              text: 'Popyt DACH',
              quadrant: 'opportunities',
              impact: 'high',
              proposalStatus: 'accepted',
              evidenceStatus: 'confirmed',
            },
          ],
          tensions: [
            {
              id: 't1',
              title: 'Wzrost',
              type: 'attack',
              linkedItemIds: ['s1', 'o1'],
              linkedCorrelationIds: [],
              insight: 'Działać',
            },
          ],
          recommendedMoves: [
            {
              id: 'm1',
              title: 'Uruchomić pilota',
              category: 'quick-win',
              rationale: 'Popyt',
              linkedTensionIds: ['t1'],
              linkedItemIds: ['s1'],
              expectedImpact: 'high',
              estimatedEffort: 'medium',
              firstStep: 'Klient',
              ownerRole: 'Sprzedaż',
              tradeoff: { chosen: 'Pilot', deferred: 'Produkt', cost: 'Czas' },
              rejectedAlternative: { option: 'Partner', reason: 'Kontrola' },
            },
          ],
        }
      : { summary: { verdict: 'Zaakceptowany wynik', executiveSummary: 'Podsumowanie sesji' } };
  expect(
    (
      await request(app).put(`/api/tools/${sessionId}`).set(as(ORG_A, ACTOR_A)).send({
        status: 'IN_PROGRESS',
        completionPercent: 100,
        confidenceAvg: 4,
        expectedVersion: 1,
        answers,
      })
    ).status
  ).toBe(200);
  expect(
    (
      await request(app).put(`/api/tools/${sessionId}`).set(as(ORG_A, ACTOR_A)).send({
        status: 'REVIEW',
        expectedVersion: 2,
      })
    ).status
  ).toBe(200);
  expect(
    (await request(app).post(`/api/tools/${sessionId}/approve`).set(as(ORG_A, ACTOR_A))).status
  ).toBe(200);
  const promoted = await request(app)
    .post(`/api/tools/${sessionId}/promote`)
    .set(as(ORG_A, ACTOR_A))
    .send({ outputType: 'report', title: `${toolType} report` });
  expect(promoted.status).toBe(200);
}

async function driveSession(toolType: string): Promise<string> {
  const created = await request(app)
    .post('/api/tools')
    .set(as(ORG_A, ACTOR_A))
    .send({ toolType, name: `${P}${toolType}-${++sessionSequence}` });
  expect(created.status).toBe(200);
  const sessionId = created.body.id as string;
  await driveAnswersApprovePromote(sessionId, toolType);
  return sessionId;
}

beforeAll(async () => {
  await assertRealPostgresTestEnvironment();
  const client = await db();
  try {
    for (const [org, actor] of [
      [ORG_A, ACTOR_A],
      [ORG_B, ACTOR_B],
    ] as const) {
      await client.query(
        `INSERT INTO organizations (id,name,plan,status) VALUES ($1,$2,'free','active')`,
        [org, org]
      );
      await client.query(
        `INSERT INTO users (id,organization_id,email,role,status) VALUES ($1,$2,$3,'admin','active')`,
        [actor, org, `${actor}@example.test`]
      );
    }
  } finally {
    await client.end();
  }
  const ToolController = (await import('../../server/src/controllers/ToolController.js')).default;
  const ToolOutputsController = (
    await import('../../server/src/controllers/ToolOutputsController.js')
  ).default;
  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: req.header('x-test-user'),
      organizationId: req.header('x-test-org'),
      role: 'admin',
    };
    next();
  });
  app.post('/api/tools', ToolController.createToolSession);
  app.put('/api/tools/:toolId', ToolController.updateToolSession);
  app.post('/api/tools/:toolId/approve', ToolController.approveTool);
  app.post('/api/tools/:toolId/promote', ToolController.promoteToOutput);
  app.get('/api/tool-outputs', ToolOutputsController.listOutputs);
  app.get('/api/tool-outputs/:outputId/report.docx', ToolOutputsController.exportReportDocx);
  app.get('/api/tool-outputs/:outputId', ToolOutputsController.getOutput);
  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) =>
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  );
}, 60_000);

afterAll(async () => {
  const client = await db();
  try {
    await client.query(`DELETE FROM tool_report_sources WHERE organization_id IN ($1,$2)`, [
      ORG_A,
      ORG_B,
    ]);
    await client.query(`DELETE FROM tool_reports WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await client.query(`DELETE FROM tool_output_approvals WHERE organization_id IN ($1,$2)`, [
      ORG_A,
      ORG_B,
    ]);
    await client.query(`DELETE FROM tool_session_events WHERE organization_id IN ($1,$2)`, [
      ORG_A,
      ORG_B,
    ]);
    await client.query(`DELETE FROM tool_outputs WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await client.query(
      `DELETE FROM report_builder_sections WHERE report_id IN
      (SELECT id FROM report_builder_reports WHERE organization_id IN ($1,$2))`,
      [ORG_A, ORG_B]
    );
    await client.query(`DELETE FROM report_builder_reports WHERE organization_id IN ($1,$2)`, [
      ORG_A,
      ORG_B,
    ]);
    await client.query(`DELETE FROM tool_sessions WHERE organization_id IN ($1,$2)`, [
      ORG_A,
      ORG_B,
    ]);
    await client.query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await client.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [ORG_A, ORG_B]);
  } finally {
    await client.end();
  }
});

describe.sequential('Day 40 tool value chain (real Postgres)', () => {
  it('dynamic-swot promotes through HTTP to a persisted non-empty snapshot', async () => {
    const sessionId = await driveSession('dynamic-swot');
    const client = await db();
    const result = await client.query(
      `SELECT id,payload_json FROM tool_outputs WHERE tool_session_id=$1`,
      [sessionId]
    );
    await client.end();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].payload_json.conclusions.length).toBeGreaterThan(0);
    swotOutputId = result.rows[0].id;
  });

  it('a generic tool promotes through HTTP to an honestly empty snapshot', async () => {
    // day54 FIX-D: 'day40-generic' is not a cataloged tool type, so it can no
    // longer be CREATED through the public HTTP endpoint (that gap is what
    // FIX-D closes). Seed the session row directly to keep exercising the
    // downstream update/approve/promote HTTP pipeline this test targets.
    const sessionId = await seedSessionDirectly('day40-generic');
    await driveAnswersApprovePromote(sessionId, 'day40-generic');
    const client = await db();
    const result = await client.query(
      `SELECT id,payload_json FROM tool_outputs WHERE tool_session_id=$1`,
      [sessionId]
    );
    await client.end();
    expect(result.rows[0].payload_json.items).toEqual([]);
    expect(result.rows[0].payload_json.engineVersion).toBe('generic-fallback-1.0.0');
    genericOutputId = result.rows[0].id;
  });

  it('lists both outputs for their owner organization', async () => {
    const res = await request(app).get('/api/tool-outputs').set(as(ORG_A, ACTOR_A));
    expect(res.status).toBe(200);
    expect(res.body.outputs.map((output: { id: string }) => output.id)).toEqual(
      expect.arrayContaining([swotOutputId, genericOutputId])
    );
  });

  it('does not list either output for another organization', async () => {
    const res = await request(app).get('/api/tool-outputs').set(as(ORG_B, ACTOR_B));
    expect(res.status).toBe(200);
    expect(res.body.outputs).toEqual([]);
  });

  it('refuses promotion when tool_outputs is unavailable instead of returning 200', async () => {
    const sessionId = `${P}missing-table`;
    const client = await db();
    await client.query(
      `INSERT INTO tool_sessions
         (id, organization_id, tool_type, name, status, completion_percent,
          confidence_avg, answers_json, created_by, updated_by, version, created_at, updated_at)
       VALUES ($1,$2,'dynamic-swot',$3,'APPROVED',100,4,$4,$5,$5,1,NOW(),NOW())`,
      [
        sessionId,
        ORG_A,
        `${P}missing-table`,
        JSON.stringify({
          items: [
            {
              id: 's1',
              text: 'Silny zespół',
              quadrant: 'strengths',
              impact: 'high',
              proposalStatus: 'accepted',
              evidenceStatus: 'confirmed',
            },
            {
              id: 'o1',
              text: 'Popyt DACH',
              quadrant: 'opportunities',
              impact: 'high',
              proposalStatus: 'accepted',
              evidenceStatus: 'confirmed',
            },
          ],
          tensions: [
            {
              id: 't1',
              title: 'Wzrost',
              type: 'attack',
              linkedItemIds: ['s1', 'o1'],
              linkedCorrelationIds: [],
              insight: 'Działać',
            },
          ],
          recommendedMoves: [
            {
              id: 'm1',
              title: 'Uruchomić pilota',
              category: 'quick-win',
              rationale: 'Popyt',
              linkedTensionIds: ['t1'],
              linkedItemIds: ['s1'],
              expectedImpact: 'high',
              estimatedEffort: 'medium',
              firstStep: 'Klient',
              ownerRole: 'Sprzedaż',
              tradeoff: { chosen: 'Pilot', deferred: 'Produkt', cost: 'Czas' },
              rejectedAlternative: { option: 'Partner', reason: 'Kontrola' },
            },
          ],
        }),
        ACTOR_A,
      ]
    );

    try {
      await client.query(`ALTER TABLE tool_outputs RENAME TO tool_outputs_day54_missing`);
      const promoted = await request(app)
        .post(`/api/tools/${sessionId}/promote`)
        .set(as(ORG_A, ACTOR_A))
        .send({ outputType: 'report', title: 'must fail closed' });
      expect(promoted.status).toBe(503);
      expect(promoted.body.code).toBe('TOOL_OUTPUT_PERSISTENCE_UNAVAILABLE');

      const ledger = await client.query(
        `SELECT COUNT(*)::int AS count FROM tool_initiative_links WHERE tool_session_id=$1`,
        [sessionId]
      );
      expect(ledger.rows[0].count).toBe(0);
    } finally {
      await client.query(`ALTER TABLE tool_outputs_day54_missing RENAME TO tool_outputs`);
      await client.end();
    }
  });

  it('exports the approved SWOT output as real OOXML', async () => {
    const res = await request(app)
      .get(`/api/tool-outputs/${swotOutputId}/report.docx`)
      .set(as(ORG_A, ACTOR_A))
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(Number(res.headers['content-length'])).toBeGreaterThan(0);
    expect(res.body.subarray(0, 2).toString()).toBe('PK');
    await writeFile(
      '/private/tmp/consultify-tools-day54-artefakty/dynamic-swot-output-report.docx',
      res.body
    );
  });

  it('404s the DOCX route for another organization', async () => {
    const res = await request(app)
      .get(`/api/tool-outputs/${swotOutputId}/report.docx`)
      .set(as(ORG_B, ACTOR_B));
    expect(res.status).toBe(404);
  });
});
