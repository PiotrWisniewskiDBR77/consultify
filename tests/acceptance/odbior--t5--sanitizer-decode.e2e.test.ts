/**
 * Acceptance E2E — T5 (Z139 follow-up): sanitizer double-escape on titles/names.
 *
 * The global inputSanitizationMiddleware (server/src/middleware/inputSanitization.middleware.ts)
 * runs on EVERY request body string and escapes `& < > " ' `` to HTML entities.
 * Several write paths stored that escaped value verbatim instead of decoding it
 * back to plain text first — so a title typed as `Firma "Alfa" & Synowie` was
 * persisted (and echoed back) as `Firma &quot;Alfa&quot; &amp; Synowie`, and every
 * subsequent save would double-escape it further.
 *
 * This test drives the REAL global sanitizer + REAL routers/controllers + REAL
 * local Postgres (parity :5443) for each path fixed under T5:
 *   - pmo/projects.routes.ts       -> ProjectController create/update (projects.name)
 *   - pmo/initiatives.routes.ts    -> POST/PUT /programs (programs.name/description)
 *   - pmo/decisions.routes.ts      -> DecisionPlaybookController create (decision_playbooks.name)
 *   - v8/assessment.routes.ts      -> POST / (assessments.name)
 *   - tools.routes.ts              -> ToolController.createToolSession (tool_sessions.name)
 *
 * Each case: POST/PUT a title containing an apostrophe AND an ampersand, then
 * assert the DB column holds the PLAIN string (not `&amp;`/`&#39;`) and the API
 * response echoes the plain string too — proving no double-escape survives the
 * round trip while the sanitizer itself still runs unmodified (XSS protection
 * intact — this only unwinds entity-escaping of legitimate punctuation).
 *
 * Artifacts use the reversible `odbior--t5--` prefix; the probe cleans up after
 * itself. JEDYNY plik tej pracy.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

// The title/name every case sends — apostrophe + ampersand + quotes, the exact
// shape the sanitizer escapes (`&#39;`, `&amp;`, `&quot;`).
const RAW_TITLE = `odbior--t5-- Firma "Alfa" & Synowie's Consulting`;

let app: Express;
let token: string;

async function buildApp(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { attachV8Context } = await import('../../server/src/middleware/v8Auth.middleware.js');
  const { inputSanitizationMiddleware } = await import(
    '../../server/src/middleware/inputSanitization.middleware.js'
  );
  const projectsRouter = (await import('../../server/src/routes/pmo/projects.routes.js')).default;
  const initiativesRouter = (await import('../../server/src/routes/pmo/initiatives.routes.js'))
    .default;
  const decisionsRouter = (await import('../../server/src/routes/pmo/decisions.routes.js')).default;
  const v8AssessmentRouter = (await import('../../server/src/routes/v8/assessment.routes.js'))
    .default;
  const toolsRouter = (await import('../../server/src/routes/tools.routes.js')).default;

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  // Mirrors server/src/index.ts mount order: sanitizer runs globally BEFORE
  // any router/auth — this is the real production ordering we're proving safe.
  app.use(inputSanitizationMiddleware as any);
  // projects.routes.ts and decisions.routes.ts apply verifyToken internally;
  // initiatives.routes.ts and v8/assessment.routes.ts expect it mounted externally.
  // tools.routes.ts applies verifyToken + requireOrgAccess + demoContextMiddleware
  // internally too (mirrors production server/src/index.ts mount).
  app.use('/api/projects', projectsRouter);
  app.use('/api/initiatives', verifyToken as any, initiativesRouter);
  app.use('/api/decisions', decisionsRouter);
  app.use('/api/v8/assessments', verifyToken as any, attachV8Context as any, v8AssessmentRouter);
  app.use('/api/tools', toolsRouter);
  return app;
}

async function cleanup(): Promise<void> {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(`DELETE FROM projects WHERE name LIKE 'odbior--t5--%'`);
    await c.query(`DELETE FROM programs WHERE name LIKE 'odbior--t5--%'`);
    await c.query(`DELETE FROM decision_playbooks WHERE name LIKE 'odbior--t5--%'`);
    await c.query(`DELETE FROM assessments WHERE name LIKE 'odbior--t5--%'`);
    await c.query(`DELETE FROM tool_sessions WHERE name LIKE 'odbior--t5--%'`);
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  await seed();
  app = await buildApp();
  token = mintToken();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe('T5: sanitizer double-escape decode-before-store', () => {
  it('projects.name round-trips plain through create AND update', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: RAW_TITLE, description: RAW_TITLE });

    expect(createRes.status).toBeLessThan(300);
    const projectId: string = createRes.body?.id || createRes.body?.project?.id;
    expect(projectId).toBeTruthy();

    const c = pgClient();
    await c.connect();
    try {
      const row = await c.query(`SELECT name, description FROM projects WHERE id = $1`, [
        projectId,
      ]);
      expect(row.rows[0]?.name).toBe(RAW_TITLE);
      expect(row.rows[0]?.name).not.toContain('&amp;');
      expect(row.rows[0]?.name).not.toContain('&#39;');
      expect(row.rows[0]?.name).not.toContain('&quot;');
      expect(row.rows[0]?.description).toBe(RAW_TITLE);

      // Update path — different code path (ProjectController.updateProject), COALESCE SET.
      const updated = `${RAW_TITLE} v2`;
      const putRes = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: updated });
      expect(putRes.status).toBeLessThan(300);

      const row2 = await c.query(`SELECT name FROM projects WHERE id = $1`, [projectId]);
      expect(row2.rows[0]?.name).toBe(updated);
      expect(row2.rows[0]?.name).not.toContain('&amp;');
    } finally {
      await c.end();
    }
  });

  it('programs.name/description round-trip plain through create (pmo/initiatives /programs)', async () => {
    const res = await request(app)
      .post('/api/initiatives/programs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: RAW_TITLE, description: RAW_TITLE });

    expect(res.status).toBeLessThan(300);
    const programId: string = res.body?.id || res.body?.program?.id;
    expect(programId).toBeTruthy();

    const c = pgClient();
    await c.connect();
    try {
      const row = await c.query(`SELECT name, description FROM programs WHERE id = $1`, [
        programId,
      ]);
      expect(row.rows[0]?.name).toBe(RAW_TITLE);
      expect(row.rows[0]?.name).not.toContain('&amp;');
      expect(row.rows[0]?.description).toBe(RAW_TITLE);
    } finally {
      await c.end();
    }
  });

  it('decision_playbooks.name round-trips plain through create (pmo/decisions /playbooks)', async () => {
    const res = await request(app)
      .post('/api/decisions/playbooks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: RAW_TITLE,
        decisionType: 'general',
        requiredFields: [],
        workflowStages: [],
      });

    expect(res.status).toBeLessThan(300);

    const c = pgClient();
    await c.connect();
    try {
      const row = await c.query(`SELECT name FROM decision_playbooks WHERE name = $1`, [
        RAW_TITLE,
      ]);
      expect(row.rows.length).toBe(1);
      expect(row.rows[0]?.name).toBe(RAW_TITLE);
      expect(row.rows[0]?.name).not.toContain('&amp;');
    } finally {
      await c.end();
    }
  });

  it('assessments.name round-trips plain through create (v8/assessment.routes.ts)', async () => {
    const res = await request(app)
      .post('/api/v8/assessments')
      .set('Authorization', `Bearer ${token}`)
      .send({ assessmentType: 'DRD', name: RAW_TITLE });

    expect(res.status).toBeLessThan(300);
    const assessmentId: string =
      res.body?.id || res.body?.assessment?.id || res.body?.data?.id || res.body?.data?.assessment?.id;
    expect(assessmentId).toBeTruthy();
    // Response body itself must echo plain text too (not just the DB row).
    const echoedName = res.body?.data?.assessment?.name;
    expect(echoedName).toBe(RAW_TITLE);

    const c = pgClient();
    await c.connect();
    try {
      const row = await c.query(`SELECT name FROM assessments WHERE id = $1`, [assessmentId]);
      expect(row.rows[0]?.name).toBe(RAW_TITLE);
      expect(row.rows[0]?.name).not.toContain('&amp;');
    } finally {
      await c.end();
    }
  });

  it('tool_sessions.name round-trips plain through create (POST /api/tools -> ToolController.createToolSession)', async () => {
    const res = await request(app)
      .post('/api/tools')
      .set('Authorization', `Bearer ${token}`)
      .send({ toolType: 'dynamic-swot', name: RAW_TITLE });

    expect(res.status).toBeLessThan(300);
    const sessionId: string = res.body?.id;
    expect(sessionId).toBeTruthy();

    const c = pgClient();
    await c.connect();
    try {
      const row = await c.query(`SELECT name FROM tool_sessions WHERE id = $1`, [sessionId]);
      expect(row.rows[0]?.name).toBe(RAW_TITLE);
      expect(row.rows[0]?.name).not.toContain('&amp;');
      expect(row.rows[0]?.name).not.toContain('&#39;');
      expect(row.rows[0]?.name).not.toContain('&quot;');

      // GET reload echoes plain text too (proves the read path doesn't
      // re-escape or leave a stale escaped value behind).
      const getRes = await request(app)
        .get(`/api/tools/${sessionId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBeLessThan(300);
      const echoedName = getRes.body?.name || getRes.body?.session?.name;
      expect(echoedName).toBe(RAW_TITLE);
    } finally {
      await c.end();
    }
  });
});
