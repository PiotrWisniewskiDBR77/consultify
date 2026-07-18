/**
 * H1 · Data-chain acceptance E2E — REAL runtime (local Postgres :5443, real
 * routers/services, real auth, zero business-logic mocks).
 *
 * Proves the three data-chain back-references actually persist, not just "the
 * code exists":
 *
 *  H1.3  Assessment → Initiatives (automatic on completion).
 *        Completing a workbench with recommendations auto-materializes DRAFT
 *        initiatives (source_type='assessment', created_from='assessment') and
 *        links them (assessment_initiative_links). Idempotent on re-completion.
 *
 *  H1.5  Ideas → Initiative convert carries an origin back-reference.
 *        Converting an idea sets initiatives.created_from='idea' (the queryable
 *        origin label InitiativeController's source filter recognises) while the
 *        source_type/source_id tool-session lineage stays intact.
 *
 *  H1.11 Deliverable → M17 back-reference (S6.1).
 *        Registering a chat deliverable lands it in the M17 Outputs library
 *        (v8_output_artifacts + v8_artifact_origin_links) WITH the source
 *        conversation recorded in origin_summary_json, read back through the API.
 *
 * Prefix for every incidental row: `odbior--h1--`. Probe cleans up after itself.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

let token: string;

beforeAll(async () => {
  await seed(); // idempotent
  token = mintToken();
}, 60_000);

// ---------------------------------------------------------------------------
// H1.3 — Assessment → Initiatives (automatic on completion).
// Exercises the REAL AssessmentWorkbenchService.transition against the real DB.
// ---------------------------------------------------------------------------
describe('H1.3 — Assessment completion auto-creates DRAFT initiatives (real runtime)', () => {
  const assessmentId = `odbior--h1--assess-${Date.now()}`;
  const createdInitiativeIds: string[] = [];

  afterAll(async () => {
    const client = pgClient();
    await client.connect();
    try {
      await client.query(
        `DELETE FROM assessment_initiative_links WHERE assessment_id = $1`,
        [assessmentId]
      );
      await client.query(
        `DELETE FROM assessment_initiative_batches WHERE assessment_id = $1`,
        [assessmentId]
      );
      if (createdInitiativeIds.length) {
        await client.query(`DELETE FROM initiatives WHERE id = ANY($1)`, [createdInitiativeIds]);
      }
      await client.query(`DELETE FROM assessments WHERE id = $1`, [assessmentId]);
    } finally {
      await client.end();
    }
  });

  it('materializes DRAFT initiatives from recommendations, linked + back-referenced', async () => {
    // Seed a completed-ready workbench: interpretation_reviewed with two concrete
    // recommendations (nextActions). The state shape mirrors P28WorkbenchState.
    const rec1 = `odbior--h1-- Renegocjuj cennik z kluczowym klientem ${Date.now()}`;
    const rec2 = `odbior--h1-- Wdroż przegląd kosztów bezpośrednich ${Date.now()}`;
    const workbench = {
      contractVersion: 'p28_workbench_v1',
      assessmentDefinitionRef: {
        definitionId: 'odbior--h1--def',
        methodologyId: 'DRD',
        version: '1',
        status: 'published',
        readOnly: true,
      },
      assessmentRunId: assessmentId,
      orgId: SEED.ORG_ID,
      runState: 'interpretation_reviewed',
      startedBy: SEED.USER_ID,
      startedAt: new Date().toISOString(),
      evidencePointers: [],
      scoreProposal: null,
      scoreReview: null,
      interpretationProposal: {
        id: 'odbior--h1--interp',
        status: 'proposal',
        summary: 'Marża brutto poniżej progu; koncentracja przychodu podnosi ryzyko.',
        keyFindings: ['Marża 12% vs próg 20%'],
        limits: 'Bounded — assessment proposal, wymaga przeglądu przed wdrożeniem.',
        nextActions: [rec1, rec2],
        linksToScoreProposalId: 'odbior--h1--score',
        proposedAt: new Date().toISOString(),
        proposedBy: SEED.USER_ID,
      },
      interpretationReview: { status: 'accepted', decidedAt: new Date().toISOString(), decidedBy: SEED.USER_ID },
      promotionTraces: [],
      audit: [],
    };

    const client = pgClient();
    await client.connect();
    try {
      await client.query(
        `INSERT INTO assessments (id, organization_id, assessment_type, name, created_by, p28_workbench_v1)
         VALUES ($1, $2, 'DRD', 'odbior--h1-- Assessment', $3, $4)
         ON CONFLICT (id) DO UPDATE SET p28_workbench_v1 = EXCLUDED.p28_workbench_v1`,
        [assessmentId, SEED.ORG_ID, SEED.USER_ID, JSON.stringify(workbench)]
      );
    } finally {
      await client.end();
    }

    // ACT — drive the REAL service completion (the approval gate).
    const { default: AssessmentWorkbenchService } = await import(
      '../../server/src/services/assessment/AssessmentWorkbenchService.js'
    );
    const state = await AssessmentWorkbenchService.transition(
      assessmentId,
      SEED.ORG_ID,
      SEED.USER_ID,
      'completed'
    );
    expect(state.runState).toBe('completed');
    expect(state.audit.some((a: { action: string }) => a.action === 'initiatives_auto_created')).toBe(
      true
    );

    // ASSERT — initiatives persisted with the assessment back-reference.
    const verify = pgClient();
    await verify.connect();
    try {
      const { rows } = await verify.query(
        `SELECT i.id, i.name, i.status, i.source_type, i.source_id, i.created_from
         FROM initiatives i
         JOIN assessment_initiative_links l ON l.initiative_id = i.id
         WHERE l.assessment_id = $1
         ORDER BY i.created_at ASC`,
        [assessmentId]
      );
      for (const r of rows) createdInitiativeIds.push(r.id);

      expect(rows.length).toBe(2);
      for (const r of rows) {
        expect(String(r.status).toUpperCase()).toBe('DRAFT');
        expect(r.source_type).toBe('assessment');
        expect(r.source_id).toBe(assessmentId);
        expect(r.created_from).toBe('assessment');
      }
      const titles = rows.map((r) => r.name);
      expect(titles).toContain(rec1.slice(0, 200));
      expect(titles).toContain(rec2.slice(0, 200));

      // Batch recorded the count.
      const { rows: batchRows } = await verify.query(
        `SELECT initiatives_count FROM assessment_initiative_batches WHERE assessment_id = $1`,
        [assessmentId]
      );
      expect(batchRows).toHaveLength(1);
      expect(Number(batchRows[0].initiatives_count)).toBe(2);
    } finally {
      await verify.end();
    }
  }, 45_000);

  it('is idempotent — re-completing does not double-create', async () => {
    // The run is already 'completed' (read-only). Calling transition again throws
    // RUN_READ_ONLY, and even if it did not, the auto-batch guard prevents a
    // second set. Assert the initiative count is still exactly 2.
    const { default: AssessmentWorkbenchService } = await import(
      '../../server/src/services/assessment/AssessmentWorkbenchService.js'
    );
    await expect(
      AssessmentWorkbenchService.transition(assessmentId, SEED.ORG_ID, SEED.USER_ID, 'completed')
    ).rejects.toBeTruthy();

    const verify = pgClient();
    await verify.connect();
    try {
      const { rows } = await verify.query(
        `SELECT COUNT(*)::int AS n FROM assessment_initiative_links WHERE assessment_id = $1`,
        [assessmentId]
      );
      expect(rows[0].n).toBe(2);
    } finally {
      await verify.end();
    }
  }, 30_000);
});

// ---------------------------------------------------------------------------
// H1.5 — Ideas → Initiative convert back-reference.
// ---------------------------------------------------------------------------
describe('H1.5 — Idea→Initiative convert records origin back-reference (real runtime)', () => {
  let app: Express;
  const ideaId = `odbior--h1--idea-${Date.now()}`;
  const createdInitiativeIds: string[] = [];
  let sourceSessionId: string | null = null;
  const prevFunnelFlag = process.env.INITIATIVE_FUNNEL_ENABLED;

  beforeAll(async () => {
    // Drive the canonical F1.5 funnel path (INITIATIVE_FUNNEL_ENABLED) — the raw
    // fallback path is gated by a schema-dependent status default and is the
    // non-canonical branch. Both branches carry the H1.5 created_from='idea'
    // back-reference; the funnel branch is the one demo standardises on.
    process.env.INITIATIVE_FUNNEL_ENABLED = 'true';
    const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
    const myWorkRouter = (await import('../../server/src/routes/my-work.routes.js')).default;
    app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use('/api/my-work', verifyToken as any, myWorkRouter);

    const client = pgClient();
    await client.connect();
    try {
      await client.query(
        `INSERT INTO my_ideas (id, organization_id, user_id, title, body, stage)
         VALUES ($1, $2, $3, $4, $5, 'draft')
         ON CONFLICT (id) DO NOTHING`,
        [
          ideaId,
          SEED.ORG_ID,
          SEED.USER_ID,
          'odbior--h1-- Idea to convert',
          'A concrete opportunity worth an initiative.',
        ]
      );
    } finally {
      await client.end();
    }
  }, 60_000);

  afterAll(async () => {
    if (prevFunnelFlag === undefined) delete process.env.INITIATIVE_FUNNEL_ENABLED;
    else process.env.INITIATIVE_FUNNEL_ENABLED = prevFunnelFlag;
    const client = pgClient();
    await client.connect();
    try {
      if (createdInitiativeIds.length) {
        await client.query(`DELETE FROM initiatives WHERE id = ANY($1)`, [createdInitiativeIds]);
      }
      await client.query(`DELETE FROM link_graph_edges WHERE target_id = $1`, [ideaId]);
      if (sourceSessionId) {
        await client.query(`DELETE FROM tool_sessions WHERE id = $1`, [sourceSessionId]);
      }
      await client.query(`DELETE FROM my_ideas WHERE id = $1`, [ideaId]);
    } finally {
      await client.end();
    }
  });

  it('converts an idea and sets created_from=idea on the initiative', async () => {
    const res = await request(app)
      .post(`/api/my-work/my-ideas/${ideaId}/convert`)
      .set('Authorization', `Bearer ${token}`)
      .send({ target: 'initiative' });

    expect(res.status).toBe(200);
    const initiativeId: string = res.body?.created?.initiativeId || res.body?.promotedEntityId;
    expect(initiativeId).toBeTruthy();
    createdInitiativeIds.push(initiativeId);
    sourceSessionId = res.body?.sourceSessionId || null;

    // PERSISTENCE — the origin back-reference is recorded on the initiative row.
    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, created_from, source_type, source_id, organization_id
         FROM initiatives WHERE id = $1`,
        [initiativeId]
      );
      expect(rows).toHaveLength(1);
      // H1.5 back-reference: origin label = idea.
      expect(rows[0].created_from).toBe('idea');
      // Tool-session lineage (traceability) preserved — NOT clobbered.
      expect(rows[0].source_type).toBe('tool');
      expect(rows[0].source_id).toBeTruthy();
      expect(rows[0].organization_id).toBe(SEED.ORG_ID);

      // The idea is reachable directly via the link-graph edge (initiative→idea).
      const { rows: edges } = await client.query(
        `SELECT target_id FROM link_graph_edges
         WHERE source_id = $1 AND target_type = 'idea'`,
        [initiativeId]
      );
      expect(edges.some((e) => e.target_id === ideaId)).toBe(true);

      // Forward-reference: the idea records what it was promoted to.
      const { rows: ideaRows } = await client.query(
        `SELECT promoted_to, promoted_entity_id FROM my_ideas WHERE id = $1`,
        [ideaId]
      );
      expect(ideaRows[0].promoted_to).toBe('initiative');
      expect(ideaRows[0].promoted_entity_id).toBe(initiativeId);
    } finally {
      await client.end();
    }
  }, 45_000);
});

// ---------------------------------------------------------------------------
// H1.11 — Deliverable → M17 back-reference (S6.1).
// ---------------------------------------------------------------------------
describe('H1.11 — Chat deliverable lands in M17 with source back-reference (real runtime)', () => {
  let app: Express;
  const generationId = `odbior--h1--gen-${Date.now()}`;
  const conversationId = `odbior--h1--conv-${Date.now()}`;
  const artifactIds: string[] = [];

  beforeAll(async () => {
    const artifactsRouter = (await import('../../server/src/routes/artifacts.routes.js')).default;
    app = express();
    app.use(express.json({ limit: '5mb' }));
    // artifacts.routes self-mounts verifyToken + requireV8OrgContext + v8OutputsGate.
    app.use('/api/artifacts', artifactsRouter);
  }, 60_000);

  afterAll(async () => {
    const client = pgClient();
    await client.connect();
    try {
      if (artifactIds.length) {
        await client.query(
          `DELETE FROM v8_artifact_origin_links WHERE artifact_id = ANY($1)`,
          [artifactIds]
        );
        await client.query(`DELETE FROM v8_output_artifacts WHERE artifact_id = ANY($1)`, [
          artifactIds,
        ]);
      }
    } finally {
      await client.end();
    }
  });

  it('registers a doc deliverable in M17 with sourceType=chat + sourceId=conversationId', async () => {
    const res = await request(app)
      .post('/api/artifacts/register-chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        kind: 'doc',
        generationId,
        title: 'odbior--h1-- Chat deliverable',
        conversationId,
      });

    expect(res.status).toBe(200);
    const artifactId: string = res.body?.data?.artifactId;
    expect(artifactId).toBeTruthy();
    artifactIds.push(artifactId);
    expect(res.body?.readBack?.sourceType).toBe('chat');
    expect(res.body?.readBack?.sourceId).toBe(conversationId);

    // PERSISTENCE — v8_output_artifacts row + queryable origin link + JSON back-ref.
    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT artifact_id, output_type, canonical_home, origin_summary_json
         FROM v8_output_artifacts WHERE artifact_id = $1`,
        [artifactId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].output_type).toBe('report');
      expect(rows[0].canonical_home).toBe('outputs_library');
      const summary = JSON.parse(rows[0].origin_summary_json);
      expect(summary.sourceType).toBe('chat');
      expect(summary.sourceId).toBe(conversationId);

      const { rows: links } = await client.query(
        `SELECT origin_runtime, origin_record_id FROM v8_artifact_origin_links
         WHERE artifact_id = $1`,
        [artifactId]
      );
      expect(links).toHaveLength(1);
      expect(links[0].origin_runtime).toBe('native_artifact');
      expect(links[0].origin_record_id).toBe(generationId);
    } finally {
      await client.end();
    }
  }, 45_000);

  it('is idempotent per (org, runtime, generationId) — re-registering updates, not duplicates', async () => {
    const res = await request(app)
      .post('/api/artifacts/register-chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        kind: 'doc',
        generationId,
        title: 'odbior--h1-- Chat deliverable (retitled)',
        conversationId,
      });
    expect(res.status).toBe(200);

    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS n FROM v8_artifact_origin_links WHERE origin_record_id = $1`,
        [generationId]
      );
      expect(rows[0].n).toBe(1);
    } finally {
      await client.end();
    }
  }, 30_000);
});
