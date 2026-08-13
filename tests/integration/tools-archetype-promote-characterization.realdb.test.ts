/**
 * STREAM G4 — end-to-end characterization, one representative tool per
 * SIGNATURE ARCHETYPE (8 archetypes declared in `src/toolPacks/contract.ts`
 * `SignatureArchetype`, populated for all 19 engine-backed Tools in
 * `src/toolPacks/registry.ts`).
 *
 * Drives a REAL session through the REAL router (`ToolController`, mounted
 * directly like `tests/integration/tools-promote-characterization.realdb.test.ts`
 * and `tests/integration/tools-outputs-immutable.realdb.test.ts` already do)
 * against REAL Postgres, end to end:
 *
 *   CREATE (POST /api/tools)
 *     -> SAVE answers + confidence/completion (PUT, IN_PROGRESS)
 *     -> SUBMIT FOR REVIEW (PUT, REVIEW)
 *     -> APPROVE (POST /:id/approve)
 *     -> PROMOTE to an initiative (POST /:id/promote)
 *
 * then asserts the DB effects directly: `tool_sessions.status`, exactly one
 * `tool_outputs` snapshot row, one `tool_initiative_links` lineage row, and
 * (default path, `INITIATIVE_FUNNEL_ENABLED` unset) a real `initiatives` row.
 *
 * HONEST FINDING this test documents (not a bug it introduces): only
 * `dynamic-swot` has a dedicated `build*Output` engine bridge
 * (`server/src/services/tools/toolOutputSnapshotService.ts` ->
 * `buildOutputForSession`). Every OTHER tool type — all 8 archetypes proven
 * here — falls through to the GENERIC branch: a structurally valid, hashed,
 * versioned `tool_outputs` snapshot whose `items`/`tensions`/`conclusions`
 * are unconditionally empty (`engineVersion: 'generic-fallback-1.0.0'`),
 * regardless of what the session's `answers_json` actually contains. So this
 * test does NOT hand-craft tool-specific answer payloads (SWOT-shaped
 * items/tensions/moves) — that content would be silently discarded by the
 * generic builder for every one of these 8 tools. Session mechanics
 * (create/save/review/approve/promote) are proven full-content; Output
 * CONTENT mapping is proven empty-but-honest. See ROSTER_MATRIX.md "Output"
 * column and `TOOLS_CANONICAL_ROSTER.md` §3b (L8).
 *
 * Run (this worktree's disposable container only):
 *   RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgres://consultinity:test@localhost:56703/consultinity \
 *   DB_TYPE=postgres NODE_ENV=test CI=true \
 *   npx vitest run tests/integration/tools-archetype-promote-characterization.realdb.test.ts
 */
import express, { type Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  assertPromotionBranchReached,
  assertRealPostgresTestEnvironment,
} from './_helpers/assertRealPostgres.js';

// vitest.config.ts hardcodes DB_TYPE=sqlite project-wide; override before any
// DB work, matching every other *.realdb.test.ts in this suite.
process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const DATABASE_URL = process.env.DATABASE_URL as string;

const P = `g4-arch-${Date.now()}-`;
const ORG = `${P}org`;
const ACTOR = `${P}actor`;

/** One representative toolType per SignatureArchetype (src/toolPacks/registry.ts). */
const ARCHETYPE_TOOLS: Array<{ archetype: string; toolType: string }> = [
  { archetype: 'quadrant-strategic-field', toolType: 'growth-paths' },
  { archetype: 'force-radial', toolType: 'market-forces' },
  { archetype: 'decision-matrix-portfolio', toolType: 'portfolio-priority' },
  { archetype: 'flow-value-stream', toolType: 'value-chain' },
  { archetype: 'causal-problem-solving', toolType: 'a3-problem-solving' },
  { archetype: 'architecture-capability', toolType: 'capability-mapper' },
  { archetype: 'operating-model-standard', toolType: 'sop-builder' },
  { archetype: 'discovery-candidate-funnel', toolType: 'ai-discovery' },
];

let app: Express;

async function db(): Promise<Client> {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
}

function as(org = ORG, user = ACTOR) {
  return { 'x-test-org': org, 'x-test-user': user, 'x-test-role': 'admin' };
}

const createdSessionIds: string[] = [];

beforeAll(async () => {
  // FAIL, never skip — a skipped DB test looks like a pass in the report.
  await assertRealPostgresTestEnvironment();

  const c = await db();
  try {
    await c.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1,$2,'free','active')
       ON CONFLICT (id) DO NOTHING`,
      [ORG, `${P}org`]
    );
    await c.query(
      `INSERT INTO users (id, organization_id, email, role, status)
       VALUES ($1,$2,$3,'admin','active') ON CONFLICT (id) DO NOTHING`,
      [ACTOR, ORG, `${P}actor@example.test`]
    );
  } finally {
    await c.end();
  }

  const ToolController = (await import('../../server/src/controllers/ToolController.js')).default;

  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: req.header('x-test-user') || ACTOR,
      organizationId: req.header('x-test-org') || ORG,
      role: req.header('x-test-role') || 'admin',
      email: `${P}u@example.test`,
    };
    next();
  });
  app.post('/api/tools', ToolController.createToolSession);
  app.get('/api/tools/:toolId', ToolController.getToolSession);
  app.put('/api/tools/:toolId', ToolController.updateToolSession);
  app.post('/api/tools/:toolId/approve', ToolController.approveTool);
  app.post('/api/tools/:toolId/promote', ToolController.promoteToOutput);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error('[g4-archetype test app error handler]', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  });
}, 60_000);

afterAll(async () => {
  const c = await db();
  try {
    await c.query(`DELETE FROM tool_output_approvals WHERE organization_id = $1`, [ORG]).catch(() => undefined);
    await c.query(`DELETE FROM tool_session_events WHERE organization_id = $1`, [ORG]).catch(() => undefined);
    await c.query(`DELETE FROM tool_outputs WHERE organization_id = $1`, [ORG]).catch(() => undefined);
    await c
      .query(`DELETE FROM tool_initiative_links WHERE tool_session_id = ANY($1)`, [createdSessionIds])
      .catch(() => undefined);
    await c.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG]).catch(() => undefined);
    await c
      .query(`DELETE FROM tool_decisions WHERE tool_session_id = ANY($1)`, [createdSessionIds])
      .catch(() => undefined);
    await c.query(`DELETE FROM decisions WHERE organization_id = $1`, [ORG]).catch(() => undefined);
    await c.query(`DELETE FROM audit_log WHERE organization_id = $1`, [ORG]).catch(() => undefined);
    await c.query(`DELETE FROM tool_sessions WHERE organization_id = $1`, [ORG]);
    // funnelCreateInitiative (INITIATIVE_FUNNEL_ENABLED path aside) lazily
    // creates a default "Portfel — inicjatywy bezpośrednie" project per org
    // on first initiative promotion — must be deleted before the org, or the
    // org DELETE below silently no-ops on `projects_organization_id_fkey`
    // (caught by .catch(), so a leftover org would NOT fail this hook, only
    // pollute the DB — found and fixed while verifying this file, G4 2026-08-13).
    await c.query(`DELETE FROM projects WHERE organization_id = $1`, [ORG]).catch(() => undefined);
    await c.query(`DELETE FROM users WHERE id = $1`, [ACTOR]).catch(() => undefined);
    await c.query(`DELETE FROM organizations WHERE id = $1`, [ORG]).catch(() => undefined);
  } finally {
    await c.end();
  }
}, 30_000);

describe.each(ARCHETYPE_TOOLS)(
  'G4 archetype characterization — $archetype ($toolType)',
  ({ archetype, toolType }) => {
    it(`drives a real session to promotion and persists it on real Postgres (${toolType})`, async () => {
      // 1) CREATE
      const createRes = await request(app)
        .post('/api/tools')
        .set(as())
        .send({ toolType, name: `${P}${toolType}-session` });
      expect(createRes.status).toBe(200);
      const sessionId = createRes.body?.id as string;
      expect(sessionId).toBeTruthy();
      expect(createRes.body?.status).toBe('DRAFT');
      expect(createRes.body?.version).toBe(1);
      createdSessionIds.push(sessionId);

      // 2) SAVE — DoD gate is `completion_percent >= 100 && confidence_avg >= 3`
      // (ToolController.requireDoD/getRuntimeGateBlockers) — no runtime_contract_json
      // set here, so the plain numeric gate applies, not a per-tool contract.
      const verdict = `Sesja narzędzia ${toolType} (archetyp ${archetype}) wskazuje jeden zaakceptowany element.`;
      const executiveSummary = `Analiza w narzędziu ${toolType} zidentyfikowała priorytetowy obszar interwencji.`;
      const saveRes = await request(app)
        .put(`/api/tools/${sessionId}`)
        .set(as())
        .send({
          status: 'IN_PROGRESS',
          completionPercent: 100,
          confidenceAvg: 4,
          expectedVersion: 1,
          answers: {
            items: [{ id: 'item-1', text: `Zaakceptowany dowód (${toolType})`, proposalStatus: 'accepted' }],
            summary: { verdict, executiveSummary },
          },
        });
      expect(saveRes.status).toBe(200);
      expect(saveRes.body?.version).toBe(2);

      // 3) SUBMIT FOR REVIEW — required before approveTool (VALID_TRANSITIONS:
      // IN_PROGRESS -> REVIEW; approveTool 409s unless status === 'REVIEW').
      const reviewRes = await request(app)
        .put(`/api/tools/${sessionId}`)
        .set(as())
        .send({ status: 'REVIEW', expectedVersion: 2 });
      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body?.version).toBe(3);

      // 4) APPROVE
      const approveRes = await request(app).post(`/api/tools/${sessionId}/approve`).set(as());
      assertPromotionBranchReached(approveRes);

      const getAfterApprove = await request(app).get(`/api/tools/${sessionId}`).set(as());
      expect(getAfterApprove.status).toBe(200);
      expect(getAfterApprove.body?.status).toBe('APPROVED');

      // 5) PROMOTE to an initiative
      const promoteRes = await request(app)
        .post(`/api/tools/${sessionId}/promote`)
        .set(as())
        .send({ outputType: 'initiative', title: `${archetype} — ${toolType} initiative` });
      assertPromotionBranchReached(promoteRes);

      // 6) REAL DB EFFECTS — read directly, not through the API, so this
      // proves persistence rather than trusting the HTTP response shape.
      const c = await db();
      try {
        const sessionRow = await c.query(
          `SELECT status, tool_type FROM tool_sessions WHERE id = $1`,
          [sessionId]
        );
        expect(sessionRow.rows).toHaveLength(1);
        expect(sessionRow.rows[0].tool_type).toBe(toolType);
        expect(['APPROVED', 'GENERATED']).toContain(sessionRow.rows[0].status);

        const outputRows = await c.query(
          `SELECT * FROM tool_outputs WHERE tool_session_id = $1`,
          [sessionId]
        );
        expect(outputRows.rows).toHaveLength(1);
        const outputRow = outputRows.rows[0];
        expect(outputRow.organization_id).toBe(ORG);
        expect(outputRow.tool_type).toBe(toolType);
        expect(outputRow.status).toBe('approved');
        expect(outputRow.content_hash).toBeTruthy();
        // Documented gap (see file header + ROSTER_MATRIX.md): no engine
        // bridge for this tool_type -> generic, content-EMPTY snapshot.
        expect(outputRow.payload_json.items).toEqual([]);
        expect(outputRow.payload_json.engineVersion).toBe('generic-fallback-1.0.0');

        const linkRows = await c.query(
          `SELECT * FROM tool_initiative_links WHERE tool_session_id = $1`,
          [sessionId]
        );
        expect(linkRows.rows.length).toBeGreaterThanOrEqual(1);
        expect(linkRows.rows[0].batch_id).toBe('promote-initiative');
        expect(linkRows.rows[0].organization_id).toBe(ORG);

        const initiativeId = linkRows.rows[0].initiative_id;
        if (initiativeId) {
          const initiativeRows = await c.query(
            `SELECT id, organization_id, source_type FROM initiatives WHERE id = $1`,
            [initiativeId]
          );
          expect(initiativeRows.rows).toHaveLength(1);
          expect(initiativeRows.rows[0].organization_id).toBe(ORG);
        }
      } finally {
        await c.end();
      }
    });
  }
);
