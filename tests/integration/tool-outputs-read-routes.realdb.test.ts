/**
 * Proves the S4 gap-close: READ/LIST/REOPEN routes for the canonical
 * `tool_outputs` snapshot (server/src/controllers/ToolOutputsController.ts,
 * server/src/routes/toolOutputs.routes.ts) against REAL Postgres.
 *
 * `tests/integration/tools-outputs-immutable.realdb.test.ts` already proves
 * freeze/idempotency/lineage/correction at the SERVICE layer (and the
 * existing `promote` HTTP route). This file proves the NEW HTTP surface on
 * top of that: list/get/reopen actually work over HTTP, and — the property
 * that matters most for a read surface — cross-org requests return nothing,
 * never another org's row.
 *
 * Run (this worktree's disposable container only):
 *   RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgres://consultinity:test@localhost:56503/consultinity \
 *   npx vitest run tests/integration/tool-outputs-read-routes.realdb.test.ts
 */
import express, { type Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  assertPromotionBranchReached,
  assertRealPostgresTestEnvironment,
} from './_helpers/assertRealPostgres.js';

process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
// Same routing-around-a-pre-existing-unrelated-bug as tools-outputs-immutable
// (247_initiative_enhancements.sql / initiatives.priority_order — see that
// file's header for the full explanation). Needed here too because P9-style
// "initiative" promotion is used to seed an initiative_proposals row.
process.env.INITIATIVE_FUNNEL_ENABLED = 'true';

const DATABASE_URL = process.env.DATABASE_URL as string;

const P = `rr-${Date.now()}-`;
const ORG_A = `${P}org-a`;
const ORG_B = `${P}org-b`;
const ACTOR_A = `${P}actor-a`;
const ACTOR_B = `${P}actor-b`;

let app: Express;
let proposeInitiatives: (typeof import('../../src/toolOutputs/outputLifecycle'))['proposeInitiatives'];
let getToolOutputById: (typeof import('../../server/src/services/tools/toolOutputSnapshotService.js'))['getToolOutputById'];

async function db(): Promise<Client> {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
}

function as(org: string, user: string) {
  return { 'x-test-org': org, 'x-test-user': user, 'x-test-role': 'admin' };
}

/** Same fixture shape as tools-outputs-immutable.realdb.test.ts's seedApprovedSwotSession. */
async function seedApprovedSwotSession(org: string, id: string): Promise<void> {
  const answers = {
    items: [
      {
        id: 'i1',
        text: 'Silny zespół wdrożeniowy',
        quadrant: 'strengths',
        impact: 'high',
        proposalStatus: 'accepted',
        evidenceStatus: 'confirmed',
      },
      {
        id: 'i2',
        text: 'Rosnący popyt w DACH',
        quadrant: 'opportunities',
        impact: 'high',
        proposalStatus: 'accepted',
        evidenceStatus: 'confirmed',
      },
    ],
    tensions: [
      {
        id: 't1',
        title: 'Napięcie i1/i2',
        type: 'attack',
        linkedItemIds: ['i1', 'i2'],
        linkedCorrelationIds: [],
        insight: 'insight',
      },
    ],
    recommendedMoves: [
      {
        id: 'm1',
        title: 'Uruchomić pilota w DACH',
        category: 'quick-win',
        rationale: 'Popyt rośnie, zespół wdrożeniowy jest niewykorzystany.',
        linkedTensionIds: ['t1'],
        linkedItemIds: ['i1'],
        expectedImpact: 'high',
        estimatedEffort: 'medium',
        firstStep: 'Wybrać klienta pilotażowego',
        ownerRole: 'Dyrektor sprzedaży',
        tradeoff: { chosen: 'Pilot w DACH', deferred: 'Rozwój produktu', cost: 'Dług produktowy +1Q' },
        rejectedAlternative: { option: 'Wejście przez partnera', reason: 'Utrata kontroli nad wdrożeniem' },
      },
    ],
  };

  const c = await db();
  try {
    await c.query(
      `INSERT INTO tool_sessions
         (id, organization_id, project_id, tool_type, name, status, completion_percent,
          confidence_avg, answers_json, version, created_by, updated_by, created_at, updated_at)
       VALUES ($1,$2,NULL,'dynamic-swot',$3,'APPROVED',100,4.5,$4,1,$5,$5,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET
         status = 'APPROVED', answers_json = EXCLUDED.answers_json`,
      [id, org, `rr session ${id}`, JSON.stringify(answers), org === ORG_A ? ACTOR_A : ACTOR_B]
    );
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  await assertRealPostgresTestEnvironment();

  const c = await db();
  try {
    for (const [org, actor] of [
      [ORG_A, ACTOR_A],
      [ORG_B, ACTOR_B],
    ] as const) {
      await c.query(
        `INSERT INTO organizations (id, name, plan, status) VALUES ($1,$2,'free','active')
         ON CONFLICT (id) DO NOTHING`,
        [org, org]
      );
      await c.query(
        `INSERT INTO users (id, organization_id, email, role, status)
         VALUES ($1,$2,$3,'admin','active') ON CONFLICT (id) DO NOTHING`,
        [actor, org, `${actor}@example.test`]
      );
    }
  } finally {
    await c.end();
  }

  const ToolController = (await import('../../server/src/controllers/ToolController.js')).default;
  const ToolOutputsController = (await import('../../server/src/controllers/ToolOutputsController.js'))
    .default;
  const lifecycle = await import('../../src/toolOutputs/outputLifecycle');
  proposeInitiatives = lifecycle.proposeInitiatives;
  const svc = await import('../../server/src/services/tools/toolOutputSnapshotService.js');
  getToolOutputById = svc.getToolOutputById;

  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: req.header('x-test-user') || ACTOR_A,
      organizationId: req.header('x-test-org') || ORG_A,
      role: req.header('x-test-role') || 'admin',
      email: `${P}u@example.test`,
    };
    next();
  });
  // Production write path — unmodified, reused only to seed real data.
  app.post('/api/tools/:toolId/promote', ToolController.promoteToOutput);
  // The NEW read/list/reopen surface, wired the same way this repo's own
  // realdb suites wire routes directly to controller statics (bypassing
  // verifyToken, which needs a real JWT the fake-auth middleware above
  // already substitutes for — same pattern as tools-outputs-immutable).
  app.get('/api/tool-outputs', ToolOutputsController.listOutputs);
  app.get('/api/tool-outputs/reports/:reportId', ToolOutputsController.getReport);
  app.get('/api/tool-outputs/:outputId', ToolOutputsController.getOutput);
  app.get('/api/tool-outputs/:outputId/reports', ToolOutputsController.listReportsForOutput);
  app.get(
    '/api/tool-outputs/:outputId/initiative-proposals',
    ToolOutputsController.listInitiativeProposalsForOutput
  );
  app.post('/api/tool-outputs/:outputId/reopen', ToolOutputsController.reopenOutput);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error('[test app error handler]', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  });
}, 30_000);

afterAll(async () => {
  const c = await db();
  try {
    for (const org of [ORG_A, ORG_B]) {
      await c.query(`DELETE FROM tool_output_initiative_proposals WHERE organization_id = $1`, [org]);
      await c.query(`DELETE FROM tool_report_sources WHERE organization_id = $1`, [org]);
      await c.query(`DELETE FROM tool_reports WHERE organization_id = $1`, [org]);
      await c.query(`DELETE FROM tool_output_approvals WHERE organization_id = $1`, [org]);
      await c.query(`DELETE FROM tool_session_events WHERE organization_id = $1`, [org]);
      await c.query(`DELETE FROM tool_outputs WHERE organization_id = $1`, [org]);
      await c.query(`DELETE FROM tool_initiative_links WHERE tool_session_id LIKE $1`, [`${P}%`]);
      await c.query(`DELETE FROM initiatives WHERE organization_id = $1`, [org]);
      await c.query(`DELETE FROM report_builder_sections WHERE report_id IN
        (SELECT id FROM report_builder_reports WHERE organization_id = $1)`, [org]);
      await c.query(`DELETE FROM report_builder_reports WHERE organization_id = $1`, [org]);
      await c.query(`DELETE FROM tool_sessions WHERE organization_id = $1`, [org]);
      await c.query(`DELETE FROM users WHERE organization_id = $1`, [org]).catch(() => undefined);
      await c.query(`DELETE FROM organizations WHERE id = $1`, [org]).catch(() => undefined);
    }
  } finally {
    await c.end();
  }
});

describe('tool-outputs read/list/reopen routes (real Postgres)', () => {
  it('R1: list outputs for a session (org-scoped) returns exactly the promoted snapshot', async () => {
    const sessionId = `${P}s1`;
    await seedApprovedSwotSession(ORG_A, sessionId);
    const promote = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as(ORG_A, ACTOR_A))
      .send({ outputType: 'report', title: 'R1 report' });
    assertPromotionBranchReached(promote);

    const res = await request(app)
      .get(`/api/tool-outputs?toolSessionId=${sessionId}`)
      .set(as(ORG_A, ACTOR_A));
    expect(res.status).toBe(200);
    expect(res.body.outputs).toHaveLength(1);
    expect(res.body.outputs[0].toolSessionId).toBe(sessionId);
    expect(res.body.outputs[0].status).toBe('approved');
    expect(res.body.outputs[0].isCurrent).toBe(true);
    expect(res.body.outputs[0].version).toBe(1);
  });

  it('R2: cross-org list returns an empty array, never another org\'s output', async () => {
    const sessionId = `${P}s2`;
    await seedApprovedSwotSession(ORG_A, sessionId);
    const promote = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as(ORG_A, ACTOR_A))
      .send({ outputType: 'report', title: 'R2 report' });
    assertPromotionBranchReached(promote);

    // Same sessionId, but authenticated as ORG_B.
    const res = await request(app)
      .get(`/api/tool-outputs?toolSessionId=${sessionId}`)
      .set(as(ORG_B, ACTOR_B));
    expect(res.status).toBe(200);
    expect(res.body.outputs).toEqual([]);
  });

  it('R3: org-wide list (no toolSessionId) never mixes orgs', async () => {
    const sA = `${P}s3a`;
    const sB = `${P}s3b`;
    await seedApprovedSwotSession(ORG_A, sA);
    await seedApprovedSwotSession(ORG_B, sB);
    assertPromotionBranchReached(
      await request(app)
        .post(`/api/tools/${sA}/promote`)
        .set(as(ORG_A, ACTOR_A))
        .send({ outputType: 'report', title: 'R3a report' })
    );
    assertPromotionBranchReached(
      await request(app)
        .post(`/api/tools/${sB}/promote`)
        .set(as(ORG_B, ACTOR_B))
        .send({ outputType: 'report', title: 'R3b report' })
    );

    const resA = await request(app).get('/api/tool-outputs').set(as(ORG_A, ACTOR_A));
    expect(resA.status).toBe(200);
    expect(resA.body.outputs.some((o: any) => o.toolSessionId === sA)).toBe(true);
    expect(resA.body.outputs.some((o: any) => o.toolSessionId === sB)).toBe(false);
  });

  it('R4: get one output by id (org-scoped) returns full detail; cross-org 404s', async () => {
    const sessionId = `${P}s4`;
    await seedApprovedSwotSession(ORG_A, sessionId);
    const promote = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as(ORG_A, ACTOR_A))
      .send({ outputType: 'report', title: 'R4 report' });
    assertPromotionBranchReached(promote);

    const list = await request(app)
      .get(`/api/tool-outputs?toolSessionId=${sessionId}`)
      .set(as(ORG_A, ACTOR_A));
    const outputId = list.body.outputs[0].id;

    const ok = await request(app).get(`/api/tool-outputs/${outputId}`).set(as(ORG_A, ACTOR_A));
    expect(ok.status).toBe(200);
    expect(ok.body.output.items).toHaveLength(2);
    expect(ok.body.output.conclusions).toHaveLength(1);

    const crossOrg = await request(app).get(`/api/tool-outputs/${outputId}`).set(as(ORG_B, ACTOR_B));
    expect(crossOrg.status).toBe(404);
    expect(JSON.stringify(crossOrg.body)).not.toMatch(/i1|i2|Silny zespół/); // no field leak in the 404 body either
  });

  it('R5: reports for an output are traceable via tool_report_sources; cross-org 404s', async () => {
    const sessionId = `${P}s5`;
    await seedApprovedSwotSession(ORG_A, sessionId);
    const promote = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as(ORG_A, ACTOR_A))
      .send({ outputType: 'report', title: 'R5 report' });
    assertPromotionBranchReached(promote);

    const list = await request(app)
      .get(`/api/tool-outputs?toolSessionId=${sessionId}`)
      .set(as(ORG_A, ACTOR_A));
    const outputId = list.body.outputs[0].id;

    const reports = await request(app)
      .get(`/api/tool-outputs/${outputId}/reports`)
      .set(as(ORG_A, ACTOR_A));
    expect(reports.status).toBe(200);
    expect(reports.body.reports).toHaveLength(1);
    expect(reports.body.reports[0].kind).toBe('report');

    const reportId = reports.body.reports[0].id;
    const full = await request(app)
      .get(`/api/tool-outputs/reports/${reportId}`)
      .set(as(ORG_A, ACTOR_A));
    expect(full.status).toBe(200);
    // The full ToolReportDocument, ready for <ToolReportView doc={...} />.
    expect(full.body.report.doc.sourceOutputIds).toContain(outputId);
    expect(Array.isArray(full.body.report.doc.sections)).toBe(true);

    const crossOrgReports = await request(app)
      .get(`/api/tool-outputs/${outputId}/reports`)
      .set(as(ORG_B, ACTOR_B));
    expect(crossOrgReports.status).toBe(404);

    const crossOrgReport = await request(app)
      .get(`/api/tool-outputs/reports/${reportId}`)
      .set(as(ORG_B, ACTOR_B));
    expect(crossOrgReport.status).toBe(404);
  });

  it('R6: initiative proposals for an output record source_conclusion_id lineage; cross-org 404s', async () => {
    const sessionId = `${P}s6`;
    await seedApprovedSwotSession(ORG_A, sessionId);
    const promote = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as(ORG_A, ACTOR_A))
      .send({ outputType: 'initiative', title: 'R6 initiative' });
    assertPromotionBranchReached(promote);

    const list = await request(app)
      .get(`/api/tool-outputs?toolSessionId=${sessionId}`)
      .set(as(ORG_A, ACTOR_A));
    const outputId = list.body.outputs[0].id;

    const proposals = await request(app)
      .get(`/api/tool-outputs/${outputId}/initiative-proposals`)
      .set(as(ORG_A, ACTOR_A));
    expect(proposals.status).toBe(200);
    expect(proposals.body.proposals).toHaveLength(1);
    expect(proposals.body.proposals[0].sourceConclusionId).toBe('m1');
    expect(proposals.body.proposals[0].initiativeId).toBe(promote.body.id);

    const crossOrg = await request(app)
      .get(`/api/tool-outputs/${outputId}/initiative-proposals`)
      .set(as(ORG_B, ACTOR_B));
    expect(crossOrg.status).toBe(404);
  });

  it('R7: reopen without edits produces a NEW revision with an IDENTICAL content hash (reopen = identical read)', async () => {
    const sessionId = `${P}s7`;
    await seedApprovedSwotSession(ORG_A, sessionId);
    const promote = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as(ORG_A, ACTOR_A))
      .send({ outputType: 'report', title: 'R7 report' });
    assertPromotionBranchReached(promote);

    const list = await request(app)
      .get(`/api/tool-outputs?toolSessionId=${sessionId}`)
      .set(as(ORG_A, ACTOR_A));
    const originalId = list.body.outputs[0].id;
    const originalHash = list.body.outputs[0].contentHash;

    const reopen = await request(app)
      .post(`/api/tool-outputs/${originalId}/reopen`)
      .set(as(ORG_A, ACTOR_A))
      .send({});
    expect(reopen.status).toBe(200);
    expect(reopen.body.superseded.id).toBe(originalId);
    expect(reopen.body.superseded.status).toBe('superseded');
    expect(reopen.body.revision.id).not.toBe(originalId);
    expect(reopen.body.revision.version).toBe(2);
    expect(reopen.body.revision.supersedesId).toBe(originalId);
    // No edits were sent — same conclusions in, same content hash out.
    expect(reopen.body.revision.contentHash).toBe(originalHash);

    // Current vs superseded is queryable via the list endpoint.
    const after = await request(app)
      .get(`/api/tool-outputs?toolSessionId=${sessionId}`)
      .set(as(ORG_A, ACTOR_A));
    expect(after.body.outputs).toHaveLength(2);
    const current = after.body.outputs.find((o: any) => o.isCurrent);
    const superseded = after.body.outputs.find((o: any) => !o.isCurrent);
    expect(current.id).toBe(reopen.body.revision.id);
    expect(current.status).toBe('approved');
    expect(superseded.id).toBe(originalId);
    expect(superseded.status).toBe('superseded');
    expect(superseded.contentHash).toBe(originalHash); // original row never mutated
  });

  it('R8: reopen WITH edited conclusions produces a NEW revision with a DIFFERENT content hash', async () => {
    const sessionId = `${P}s8`;
    await seedApprovedSwotSession(ORG_A, sessionId);
    const promote = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as(ORG_A, ACTOR_A))
      .send({ outputType: 'report', title: 'R8 report' });
    assertPromotionBranchReached(promote);

    const list = await request(app)
      .get(`/api/tool-outputs?toolSessionId=${sessionId}`)
      .set(as(ORG_A, ACTOR_A));
    const originalId = list.body.outputs[0].id;
    const originalHash = list.body.outputs[0].contentHash;

    const original = await getToolOutputById(originalId, ORG_A);
    const editedConclusion = { ...original!.conclusions[0], k2Meaning: 'SKORYGOWANE po przeglądzie.' };

    const reopen = await request(app)
      .post(`/api/tool-outputs/${originalId}/reopen`)
      .set(as(ORG_A, ACTOR_A))
      .send({ conclusions: [editedConclusion] });
    expect(reopen.status).toBe(200);
    expect(reopen.body.revision.contentHash).not.toBe(originalHash);

    const revisionDetail = await request(app)
      .get(`/api/tool-outputs/${reopen.body.revision.id}`)
      .set(as(ORG_A, ACTOR_A));
    expect(revisionDetail.body.output.conclusions[0].k2Meaning).toBe('SKORYGOWANE po przeglądzie.');
  });

  it('R9: reopen on a non-approved output is rejected (409), never silently reopened', async () => {
    // No promote route inserts a draft row on its own — insert one directly
    // to exercise the guard, org-scoped like everything else in this suite.
    const c = await db();
    const draftId = `${P}draft-1`;
    try {
      await c.query(
        `INSERT INTO tool_outputs
           (id, organization_id, tool_session_id, tool_type, method_pack_version, version,
            title, payload_json, content_hash, status, created_by, created_at)
         VALUES ($1,$2,$3,'dynamic-swot','1.0.0',1,'Draft output','{"items":[],"tensions":[],"conclusions":[]}','deadbeef','draft',$4,NOW())`,
        [draftId, ORG_A, `${P}s9`, ACTOR_A]
      );
    } finally {
      await c.end();
    }

    const res = await request(app)
      .post(`/api/tool-outputs/${draftId}/reopen`)
      .set(as(ORG_A, ACTOR_A))
      .send({});
    expect(res.status).toBe(409);
  });

  it('R10: reopen on a cross-org output 404s (never a 409 that would confirm it exists)', async () => {
    const sessionId = `${P}s10`;
    await seedApprovedSwotSession(ORG_A, sessionId);
    const promote = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as(ORG_A, ACTOR_A))
      .send({ outputType: 'report', title: 'R10 report' });
    assertPromotionBranchReached(promote);

    const list = await request(app)
      .get(`/api/tool-outputs?toolSessionId=${sessionId}`)
      .set(as(ORG_A, ACTOR_A));
    const outputId = list.body.outputs[0].id;

    const res = await request(app)
      .post(`/api/tool-outputs/${outputId}/reopen`)
      .set(as(ORG_B, ACTOR_B))
      .send({});
    expect(res.status).toBe(404);
  });

  it('R11: retrying reopen on an already-superseded id does not duplicate — it 409s (already-superseded is not approved)', async () => {
    const sessionId = `${P}s11`;
    await seedApprovedSwotSession(ORG_A, sessionId);
    const promote = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as(ORG_A, ACTOR_A))
      .send({ outputType: 'report', title: 'R11 report' });
    assertPromotionBranchReached(promote);

    const list = await request(app)
      .get(`/api/tool-outputs?toolSessionId=${sessionId}`)
      .set(as(ORG_A, ACTOR_A));
    const originalId = list.body.outputs[0].id;

    const first = await request(app)
      .post(`/api/tool-outputs/${originalId}/reopen`)
      .set(as(ORG_A, ACTOR_A))
      .send({});
    expect(first.status).toBe(200);

    // Retrying reopen on the NOW-superseded original must not silently
    // fabricate a second correction from a stale reference.
    const retry = await request(app)
      .post(`/api/tool-outputs/${originalId}/reopen`)
      .set(as(ORG_A, ACTOR_A))
      .send({});
    expect(retry.status).toBe(409);

    const c = await db();
    try {
      const rows = await c.query(
        `SELECT COUNT(*)::int n FROM tool_outputs WHERE tool_session_id = $1 AND status <> 'superseded'`,
        [sessionId]
      );
      expect(rows.rows[0].n).toBe(1); // exactly one active revision, no duplicate correction
    } finally {
      await c.end();
    }
  });

  it('R12: initiative proposals are derived ONLY from an approved output — proposeInitiatives rejects a non-approved one', () => {
    // Domain-layer proof (src/toolOutputs/outputLifecycle.ts) — the same rule
    // recordInitiativeProposal's callers rely on: promoteToOutput only ever
    // calls it with an output that just passed through approve(), never a
    // draft/in_review one.
    const draftOutput = {
      id: 'x',
      organizationId: ORG_A,
      toolSessionId: 's',
      toolType: 'dynamic-swot',
      methodPackVersion: '1.0.0',
      version: 1,
      title: 't',
      status: 'draft' as const,
      items: [],
      tensions: [],
      conclusions: [
        {
          id: 'c1',
          k1Fact: 'f',
          k2Meaning: 'm',
          k3Actions: ['a'],
          k4Effect: 'e',
          tradeoff: { chosen: 'c', rejected: 'r', why: 'w' },
          sourceTensionIds: [],
        },
      ],
      createdAt: new Date().toISOString(),
      contentHash: 'h',
    };
    expect(() => proposeInitiatives(draftOutput)).toThrow(/zatwierdzonego Outputu/);
  });
});
