/**
 * Acceptance E2E — H1.4 / S6.2: Tools → Initiatives session handoff.
 *
 * Closes chain gap #4. A Discovery tool session concludes with recommendations
 * but the "materialize into the Initiatives backbone" callback had NO server
 * handler (the SWOT SummaryStep's develop/defer/idea marking evaporated in local
 * UI state). This proves the NEW canonical handler:
 *
 *   POST /api/initiatives/from-tool-session
 *
 * against the REAL pmo/initiatives router behind REAL verifyToken + REAL SQL
 * (local Postgres parity). No business-logic mocks.
 *
 * Proven here:
 *   1. session + 2 recommendations (body)  → 2 DRAFT initiatives, each with a
 *      real back-reference (source_type='tool_session', source_id=<sessionId>).
 *   2. REPEAT the exact same call            → 0 created, both skipped
 *      `already_materialized`; DB still holds exactly 2 (dedup przy powtórce).
 *   3. session whose recommendations live in its OWN output_json, called WITHOUT
 *      a body list → handler derives them and creates 2 (server-only path).
 *   4. unknown session id                    → 404 (tenant guard).
 *
 * Artifacts use the reversible `odbior--h14--` prefix and the probe cleans up
 * after itself (demo data hygiene). JEDYNY plik tej pracy.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const SESSION_A = 'odbior--h14--sess-a';
const SESSION_B = 'odbior--h14--sess-b';
const TITLE_1 = 'odbior--h14 Wdrożenie MES na linii montażu';
const TITLE_2 = 'odbior--h14 Reorganizacja przepływu materiałów';
const DERIVED_1 = 'odbior--h14 Standaryzacja procedur jakości';
const DERIVED_2 = 'odbior--h14 Automatyzacja raportowania OEE';

async function buildApp(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const initiativesRouter = (await import('../../server/src/routes/pmo/initiatives.routes.js'))
    .default;

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/initiatives', verifyToken as any, initiativesRouter);
  return app;
}

let app: Express;
let token: string;

async function insertSession(id: string, outputJson: string | null): Promise<void> {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(
      `INSERT INTO tool_sessions (id, organization_id, tool_type, name, status, created_by, output_json)
       VALUES ($1, $2, 'DynamicSWOT', $3, 'GENERATED', $4, $5)
       ON CONFLICT (id) DO UPDATE SET output_json = EXCLUDED.output_json`,
      [id, SEED.ORG_ID, `odbior--h14 session ${id}`, SEED.USER_ID, outputJson]
    );
  } finally {
    await c.end();
  }
}

async function countBackrefs(sessionId: string): Promise<number> {
  const c = pgClient();
  await c.connect();
  try {
    const r = await c.query(
      `SELECT COUNT(*)::int AS n FROM initiatives
        WHERE organization_id = $1 AND source_type = 'tool_session' AND source_id = $2`,
      [SEED.ORG_ID, sessionId]
    );
    return r.rows[0]?.n ?? 0;
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  await seed();
  app = await buildApp();
  token = mintToken();
  await insertSession(SESSION_A, null);
  await insertSession(
    SESSION_B,
    JSON.stringify({
      recommendedInitiatives: [
        { title: DERIVED_1, description: 'From session output', type: 'operational' },
        { title: DERIVED_2, rationale: 'Derived rationale', type: 'strategic' },
      ],
    })
  );
});

afterAll(async () => {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(
      `DELETE FROM initiatives WHERE organization_id = $1 AND source_type = 'tool_session'
        AND source_id IN ($2, $3)`,
      [SEED.ORG_ID, SESSION_A, SESSION_B]
    );
    await c.query(`DELETE FROM tool_sessions WHERE id IN ($1, $2)`, [SESSION_A, SESSION_B]);
  } finally {
    await c.end();
  }
});

describe('H1.4 / S6.2 — POST /api/initiatives/from-tool-session', () => {
  it('materializes 2 recommendations (body) into 2 DRAFT initiatives with tool_session back-ref', async () => {
    const res = await request(app)
      .post('/api/initiatives/from-tool-session')
      .set('Authorization', `Bearer ${token}`)
      .send({
        toolSessionId: SESSION_A,
        recommendations: [
          { title: TITLE_1, description: 'MES desc', impact: 'high', effort: 'medium' },
          { title: TITLE_2, rationale: 'Flow rationale', impact: 'medium', effort: 'low' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBe(SESSION_A);
    expect(res.body.created).toHaveLength(2);
    for (const c of res.body.created) {
      expect(c.id).toBeTruthy();
      expect(c.status).toBe('DRAFT');
    }
    // Real back-reference persisted in the canonical table.
    expect(await countBackrefs(SESSION_A)).toBe(2);
  });

  it('is idempotent on repeat — dedup przy powtórce (0 created, both skipped, DB still 2)', async () => {
    const res = await request(app)
      .post('/api/initiatives/from-tool-session')
      .set('Authorization', `Bearer ${token}`)
      .send({
        toolSessionId: SESSION_A,
        recommendations: [
          { title: TITLE_1, description: 'MES desc', impact: 'high', effort: 'medium' },
          { title: TITLE_2, rationale: 'Flow rationale', impact: 'medium', effort: 'low' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.created).toHaveLength(0);
    expect(res.body.skipped).toHaveLength(2);
    for (const s of res.body.skipped) {
      expect(s.reason).toBe('already_materialized');
    }
    // No duplicates were created.
    expect(await countBackrefs(SESSION_A)).toBe(2);
  });

  it('derives recommendations from the session output_json when the body omits them', async () => {
    const res = await request(app)
      .post('/api/initiatives/from-tool-session')
      .set('Authorization', `Bearer ${token}`)
      .send({ toolSessionId: SESSION_B });

    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(2);
    const titles = res.body.created.map((c: { title: string }) => c.title).sort();
    expect(titles).toEqual([DERIVED_1, DERIVED_2].sort());
    expect(await countBackrefs(SESSION_B)).toBe(2);
  });

  it('returns 404 for a session id outside the caller org (tenant guard)', async () => {
    const res = await request(app)
      .post('/api/initiatives/from-tool-session')
      .set('Authorization', `Bearer ${token}`)
      .send({
        toolSessionId: 'odbior--h14--does-not-exist',
        recommendations: [{ title: 'ghost' }],
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TOOL_SESSION_NOT_FOUND');
  });
});
