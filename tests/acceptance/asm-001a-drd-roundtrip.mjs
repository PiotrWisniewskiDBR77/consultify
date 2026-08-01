#!/usr/bin/env tsx
/**
 * ASM-001A acceptance — DRD Library -> Form -> Matrix roundtrip, REAL Postgres.
 *
 * Run:
 *   node tests/acceptance/run.mjs                          # full stack (docker pg + schema + seed + this)
 *   npx tsx tests/acceptance/asm-001a-drd-roundtrip.mjs     # standalone, against an already-running local pg
 *
 * Proves, against the REAL v8 assessment router + REAL auth middleware +
 * REAL Postgres (zero business-logic mocks) — the two contract gaps closed
 * by this slice:
 *
 *   1) POST /api/v8/assessment rejects a definitionId that does not exist,
 *      and one that exists but is not `published` — no assessment is created.
 *   2) POST with a published definitionId binds assessment_definition_id/
 *      assessment_definition_version ON THE ROW (previously always null).
 *   3) PUT partial answers.drd.areas -> GET returns a completion_percent that
 *      is DERIVED SERVER-SIDE (computed by hand here with the exact same
 *      formula, independently, and compared) — a deliberately wrong client
 *      completionPercent is proven to be ignored for DRD.
 *   4) Org scope: a foreign org gets 404 on the same assessment id (assessment
 *      definitions are global, but assessments themselves stay org-scoped).
 *
 * Writes ONLY to the LOCAL Postgres (guarded by harness.requireLocalDbUrl),
 * under the reversible `asm001a--` id prefix, and cleans up its own rows in a
 * `finally` block regardless of pass/fail — never leaves demo-data litter.
 *
 * Mirrors the app-mounting pattern already used by
 * tests/acceptance/mf-assessments.e2e.test.ts (real router + real
 * verifyToken behind a bare express() instance, no full server boot — avoids
 * the ~46 self-resolving lazy-service boot hang documented in harness.ts).
 * Does NOT touch tests/acceptance/schema.mjs.
 */
import assert from 'node:assert/strict';

import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';

import { mintToken, pgClient, requireLocalDbUrl } from './harness.js';

requireLocalDbUrl();

const PREFIX = 'asm001a--';
const ORG_A = `${PREFIX}org-a`;
const ORG_B = `${PREFIX}org-b`;
const USER_A = `${PREFIX}user-a`;
const USER_B = `${PREFIX}user-b`;
const DEFINITION_PUBLISHED_ID = `${PREFIX}def-published`;
const DEFINITION_DRAFT_ID = `${PREFIX}def-draft`;
const HARNESS_PASSWORD = 'Asm001a!Harness123';

let passCount = 0;
let failCount = 0;

async function step(name, fn) {
  try {
    await fn();
    passCount += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failCount += 1;
    console.error(`  ✗ ${name}`);
    console.error(err instanceof Error ? err.stack || err.message : err);
  }
}

async function seedOrgAndUser(client, orgId, userId, email) {
  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(HARNESS_PASSWORD, 10);

  await client.query(
    `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
     VALUES ($1, $2, 'enterprise', 'active', 1, $3)
     ON CONFLICT (id) DO NOTHING`,
    [orgId, `ASM-001A Harness ${orgId}`, now]
  );

  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1, $2, $3, $4, 'ADMIN', 'active', 'Asm001a', 'Harness', $5)
     ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, email, passwordHash, now]
  );

  // Membership must be ACTIVE — auth.middleware resolves org via organization_members
  // (same requirement documented in tests/acceptance/seed.mjs).
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     SELECT $5, $1, $2, $3, 'ACTIVE', $4
     WHERE NOT EXISTS (
       SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2
     )`,
    [orgId, userId, 'OWNER', now, `${PREFIX}mem-${userId}`]
  );
}

async function seedDefinition(client, id, methodologyId, version, status) {
  const now = new Date().toISOString();
  await client.query(
    `INSERT INTO assessment_definitions
      (id, methodology_id, version, title, status, is_read_only, definition_json, created_by, created_at, updated_at, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       is_read_only = EXCLUDED.is_read_only,
       published_at = EXCLUDED.published_at,
       updated_at = EXCLUDED.updated_at`,
    [
      id,
      methodologyId,
      version,
      `ASM-001A harness definition ${version}`,
      status,
      status === 'published' ? 1 : 0,
      JSON.stringify({ methodologyId, harness: true }),
      USER_A,
      now,
      status === 'published' ? now : null,
    ]
  );
}

async function cleanup(client, createdAssessmentIds) {
  if (createdAssessmentIds.length > 0) {
    await client.query(`DELETE FROM assessment_sessions WHERE assessment_id = ANY($1)`, [
      createdAssessmentIds,
    ]);
    await client.query(`DELETE FROM assessments WHERE id = ANY($1)`, [createdAssessmentIds]);
  }
  await client.query(`DELETE FROM assessment_definitions WHERE id LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
    [ORG_A, ORG_B],
  ]);
  await client.query(`DELETE FROM users WHERE id = ANY($1)`, [[USER_A, USER_B]]);
  await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[ORG_A, ORG_B]]);
}

async function main() {
  console.log('[asm-001a-drd-roundtrip] connecting to local Postgres...');
  const client = pgClient();
  await client.connect();

  const createdAssessmentIds = [];

  let app;

  try {
    await seedOrgAndUser(client, ORG_A, USER_A, 'asm001a-a@acceptance.local');
    await seedOrgAndUser(client, ORG_B, USER_B, 'asm001a-b@acceptance.local');
    await seedDefinition(client, DEFINITION_PUBLISHED_ID, 'DRD', 'asm001a-1.0', 'published');
    await seedDefinition(client, DEFINITION_DRAFT_ID, 'DRD', 'asm001a-2.0', 'draft');

    const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
    // attachV8Context is normally applied by server/src/routes/v8/index.ts
    // ahead of every v8 sub-router (alongside ~40 unrelated route modules we
    // deliberately do NOT import here — see harness.ts's note on the
    // self-resolving lazy-service boot hang). It lives in the same
    // lightweight v8Auth.middleware.ts that assessment.routes.ts already
    // imports for getV8Context, so mounting it directly here is safe and
    // exercises the real context-resolution code path.
    const { attachV8Context } = await import('../../server/src/middleware/v8Auth.middleware.js');
    const assessmentRouter = (
      await import('../../server/src/routes/v8/assessment.routes.js')
    ).default;
    // Real DRD structure, imported directly, used ONLY to build a
    // deterministic partial-answers fixture (area ids) — the expected
    // completion percent below is computed independently, not via the
    // service under test.
    const { DRD_STRUCTURE } = await import('../../server/src/data/drdStructure.js');

    app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/v8/assessment', verifyToken, attachV8Context, assessmentRouter);

    const tokenA = mintToken({
      id: USER_A,
      organizationId: ORG_A,
      organization_id: ORG_A,
      role: 'OWNER',
    });
    const tokenB = mintToken({
      id: USER_B,
      organizationId: ORG_B,
      organization_id: ORG_B,
      role: 'OWNER',
    });
    let assessmentId;

    await step('POST rejects a nonexistent definitionId -> 400 DEFINITION_NOT_FOUND', async () => {
      const res = await request(app)
        .post('/api/v8/assessment')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          assessmentType: 'DRD',
          name: 'ASM-001A missing def',
          definitionId: `${PREFIX}does-not-exist`,
        });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'DEFINITION_NOT_FOUND');
    });

    await step(
      'POST rejects a draft (unpublished) definitionId -> 422 DEFINITION_NOT_PUBLISHED',
      async () => {
        const res = await request(app)
          .post('/api/v8/assessment')
          .set('Authorization', `Bearer ${tokenA}`)
          .send({
            assessmentType: 'DRD',
            name: 'ASM-001A draft def',
            definitionId: DEFINITION_DRAFT_ID,
          });
        assert.equal(res.status, 422);
        assert.equal(res.body.code, 'DEFINITION_NOT_PUBLISHED');
      }
    );

    await step(
      'POST with a published definitionId creates + binds assessment_definition_id/version on the row',
      async () => {
        const res = await request(app)
          .post('/api/v8/assessment')
          .set('Authorization', `Bearer ${tokenA}`)
          .send({
            assessmentType: 'DRD',
            name: 'ASM-001A roundtrip',
            definitionId: DEFINITION_PUBLISHED_ID,
            definitionVersion: 'asm001a-1.0',
          });
        assert.equal(res.status, 201);
        assessmentId = res.body?.data?.id;
        assert.ok(assessmentId, 'expected assessment id in response');
        createdAssessmentIds.push(assessmentId);
        assert.equal(res.body.data.assessment.assessmentDefinitionId, DEFINITION_PUBLISHED_ID);
        assert.equal(res.body.data.assessment.assessmentDefinitionVersion, 'asm001a-1.0');

        const { rows } = await client.query(
          `SELECT assessment_definition_id, assessment_definition_version, organization_id
             FROM assessments WHERE id = $1`,
          [assessmentId]
        );
        assert.equal(rows.length, 1);
        assert.equal(rows[0].assessment_definition_id, DEFINITION_PUBLISHED_ID);
        assert.equal(rows[0].assessment_definition_version, 'asm001a-1.0');
        assert.equal(rows[0].organization_id, ORG_A);
      }
    );

    await step(
      'PUT partial answers.drd.areas -> GET returns a deterministic, server-derived completion_percent (client value ignored)',
      async () => {
        assert.ok(assessmentId, 'assessment must exist from the previous step');

        const firstAreaId = DRD_STRUCTURE[0].areas[0].id;
        const secondAreaId = DRD_STRUCTURE[0].areas[1]?.id || DRD_STRUCTURE[1].areas[0].id;
        const areas = {
          [firstAreaId]: { achievedLevel: 3, targetLevel: 4 },
          [secondAreaId]: { levelNotes: { 1: 'partial evidence noted' } },
        };

        // Expected value computed BY HAND here (independent re-derivation of
        // the "answered area" rule), not by calling computeDrdCompletion —
        // this is what makes the probe an actual check on the contract
        // rather than a tautology against the implementation.
        const totalAreas = DRD_STRUCTURE.reduce((acc, axis) => acc + axis.areas.length, 0);
        const answeredCount = 2; // firstAreaId (achievedLevel) + secondAreaId (levelNotes)
        const expectedPercent = Math.round((answeredCount / totalAreas) * 100);

        const putRes = await request(app)
          .put(`/api/v8/assessment/${assessmentId}`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({
            answers: { drd: { areas } },
            completionPercent: 1, // deliberately wrong — server must ignore this for DRD
          });
        assert.equal(putRes.status, 200);
        assert.equal(putRes.body.data.completionPercent, expectedPercent);
        assert.notEqual(expectedPercent, 1);

        const getRes = await request(app)
          .get(`/api/v8/assessment/${assessmentId}`)
          .set('Authorization', `Bearer ${tokenA}`);
        assert.equal(getRes.status, 200);
        assert.equal(getRes.body.data.assessment.completion_percent, expectedPercent);
        assert.equal(getRes.body.data.assessment.answers.drd.areas[firstAreaId].achievedLevel, 3);
        assert.equal(getRes.body.data.assessment.assessmentDefinitionId, DEFINITION_PUBLISHED_ID);
        assert.equal(getRes.body.data.assessment.assessmentDefinitionVersion, 'asm001a-1.0');

        const { rows } = await client.query(
          `SELECT completion_percent FROM assessments WHERE id = $1`,
          [assessmentId]
        );
        assert.equal(Number(rows[0].completion_percent), expectedPercent);
      }
    );

    await step("org scope: a foreign org (org B) gets 404 for org A's assessment", async () => {
      assert.ok(assessmentId, 'assessment must exist from the previous step');
      const res = await request(app)
        .get(`/api/v8/assessment/${assessmentId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      assert.equal(res.status, 404);
      assert.equal(res.body.code, 'ASSESSMENT_NOT_FOUND');
    });
  } finally {
    try {
      await cleanup(client, createdAssessmentIds);
      console.log('[asm-001a-drd-roundtrip] cleanup OK (asm001a-- rows removed)');
    } finally {
      await client.end();
    }
  }

  console.log(`\n[asm-001a-drd-roundtrip] ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[asm-001a-drd-roundtrip] FATAL', err);
  process.exitCode = 1;
});
