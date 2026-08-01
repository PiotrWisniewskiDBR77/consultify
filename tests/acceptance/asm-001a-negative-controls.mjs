#!/usr/bin/env tsx
/**
 * ASM-001A Fala 3 (VERIFY) — additional negative controls NOT covered by
 * tests/acceptance/asm-001a-drd-roundtrip.mjs (Fala 2's own test). Runs
 * against the REAL v8 assessment router + REAL auth middleware + REAL local
 * Postgres, mirroring the harness pattern in asm-001a-drd-roundtrip.mjs.
 *
 * Covers (see Fala 3 VERIFY brief):
 *   T2.1 — concurrent PUT /:id with different answers.drd.areas: confirms
 *          last-write-wins, NO 409, NO merge (known/accepted behavior, not a
 *          bug for this slice — documented, not fixed here).
 *   T2.3 — create with a definitionId belonging to... note: definitions are
 *          GLOBAL (no organization_id column on assessment_definitions —
 *          confirmed by reading AssessmentDefinitionService.getDefinitionById,
 *          which queries by id only). So "other org's definitionId" is not a
 *          meaningful adversarial case — folded into T3.2 below instead,
 *          which proves org B CAN legitimately reuse org A's published
 *          definition (expected behavior, not a gap).
 *   T2.4 — idempotent GET read-back: completion_percent is deterministic,
 *          re-derived independently by hand here, and identical across two
 *          consecutive GETs.
 *   T3.1 — org B token + org A assessmentId against /user-state (GET+PUT)
 *          and /assignments (GET+PUT) -> expect 404 (org-scoping extended
 *          beyond the GET/PUT-answers endpoints Fala 2 tested).
 *   T3.2 — org B token + org A's published DRD definitionId in create
 *          payload -> expect 201 (definitions are shared/global by design).
 *
 * Writes ONLY to the LOCAL Postgres (guarded by harness.requireLocalDbUrl),
 * under the reversible `asm001aneg--` id prefix, cleaned up in `finally`.
 */
import assert from 'node:assert/strict';

import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';

import { mintToken, pgClient, requireLocalDbUrl } from './harness.js';

requireLocalDbUrl();

const PREFIX = 'asm001aneg--';
const ORG_A = `${PREFIX}org-a`;
const ORG_B = `${PREFIX}org-b`;
const USER_A = `${PREFIX}user-a`;
const USER_B = `${PREFIX}user-b`;
const DEFINITION_PUBLISHED_ID = `${PREFIX}def-published`;
const HARNESS_PASSWORD = 'Asm001aNeg!Harness123';

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
    [orgId, `ASM-001A Neg Harness ${orgId}`, now]
  );

  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1, $2, $3, $4, 'ADMIN', 'active', 'Asm001aNeg', 'Harness', $5)
     ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, email, passwordHash, now]
  );

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
      `ASM-001A Neg harness definition ${version}`,
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
    await client.query(`DELETE FROM assessment_area_assignments WHERE assessment_id = ANY($1)`, [
      createdAssessmentIds,
    ]);
    await client.query(`DELETE FROM assessment_user_state WHERE assessment_id = ANY($1)`, [
      createdAssessmentIds,
    ]);
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
  console.log('[asm-001a-negative-controls] connecting to local Postgres...');
  const client = pgClient();
  await client.connect();

  const createdAssessmentIds = [];
  let app;

  try {
    await seedOrgAndUser(client, ORG_A, USER_A, 'asm001aneg-a@acceptance.local');
    await seedOrgAndUser(client, ORG_B, USER_B, 'asm001aneg-b@acceptance.local');
    await seedDefinition(client, DEFINITION_PUBLISHED_ID, 'DRD', 'asm001aneg-1.0', 'published');

    const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
    const { attachV8Context } = await import('../../server/src/middleware/v8Auth.middleware.js');
    const assessmentRouter = (
      await import('../../server/src/routes/v8/assessment.routes.js')
    ).default;
    const { DRD_STRUCTURE } = await import('../../server/src/data/drdStructure.js');
    const { computeDrdCompletion: _unusedImportedForReferenceOnly } = await import(
      '../../server/src/services/assessment/drdCompletion.js'
    );

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

    await step('setup: create a DRD assessment in org A bound to the published definition', async () => {
      const res = await request(app)
        .post('/api/v8/assessment')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          assessmentType: 'DRD',
          name: 'ASM-001A neg-controls base',
          definitionId: DEFINITION_PUBLISHED_ID,
          definitionVersion: 'asm001aneg-1.0',
        });
      assert.equal(res.status, 201);
      assessmentId = res.body?.data?.id;
      assert.ok(assessmentId);
      createdAssessmentIds.push(assessmentId);
    });

    // ---------------------------------------------------------------------
    // T2.1 — Concurrency: two parallel PUTs with different answers.drd.areas.
    // Known/accepted behavior per Fala 1 discovery: no optimistic locking,
    // no 409, last-write-wins (whichever UPDATE commits last in Postgres's
    // internal ordering wins, silently discarding the other's payload).
    // ---------------------------------------------------------------------
    await step(
      'T2.1 concurrency: two parallel PUT with different answers.drd.areas -> no 409, last-write-wins (documented, not a bug)',
      async () => {
        const areaAlpha = DRD_STRUCTURE[0].areas[0].id;
        const areaBeta = DRD_STRUCTURE[2].areas[0].id; // distinct axis, distinct id

        const payloadRacerOne = {
          answers: { drd: { areas: { [areaAlpha]: { achievedLevel: 2, targetLevel: 3 } } } },
        };
        const payloadRacerTwo = {
          answers: { drd: { areas: { [areaBeta]: { achievedLevel: 5, targetLevel: 6 } } } },
        };

        const [resOne, resTwo] = await Promise.all([
          request(app)
            .put(`/api/v8/assessment/${assessmentId}`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send(payloadRacerOne),
          request(app)
            .put(`/api/v8/assessment/${assessmentId}`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send(payloadRacerTwo),
        ]);

        // Neither request is rejected — this IS the documented gap (no
        // optimistic locking / no 409 on conflicting concurrent writers).
        assert.equal(resOne.status, 200, 'racer one must not be rejected (no locking implemented)');
        assert.equal(resTwo.status, 200, 'racer two must not be rejected (no locking implemented)');

        const getRes = await request(app)
          .get(`/api/v8/assessment/${assessmentId}`)
          .set('Authorization', `Bearer ${tokenA}`);
        assert.equal(getRes.status, 200);
        const finalAreas = getRes.body.data.assessment.answers?.drd?.areas || {};

        const hasAlpha = Object.prototype.hasOwnProperty.call(finalAreas, areaAlpha);
        const hasBeta = Object.prototype.hasOwnProperty.call(finalAreas, areaBeta);

        console.log(
          `    [T2.1] final answers.drd.areas keys after race: ${Object.keys(finalAreas).join(', ')}`
        );
        console.log(
          `    [T2.1] racer-one area (${areaAlpha}) survived: ${hasAlpha} | racer-two area (${areaBeta}) survived: ${hasBeta}`
        );

        // The route does `nextAnswers = req.body.answers` (FULL REPLACE, not
        // a deep merge with the existing answers_json) — so whichever PUT's
        // UPDATE statement lands last in Postgres wins WHOLESALE: the other
        // racer's area is silently gone, not merged. Assert that behavior
        // explicitly: exactly one of the two racer areas survives, never
        // both (that would mean an undocumented merge appeared) and never
        // neither (that would mean something else entirely broke).
        assert.notEqual(
          hasAlpha,
          hasBeta,
          'expected exactly ONE racer area to survive (full-replace last-write-wins) — both surviving would mean a merge exists (undocumented improvement), neither surviving would be an unrelated bug'
        );
      }
    );

    // ---------------------------------------------------------------------
    // T2.4 — Idempotent GET read-back + independently re-derived completion.
    // ---------------------------------------------------------------------
    await step(
      'T2.4 idempotency: completion_percent is deterministic across two GETs and matches an independent by-hand re-derivation',
      async () => {
        // Overwrite with a known, fully-specified answers.drd.areas map so we
        // can hand-compute the exact expected percent without relying on the
        // implementation under test.
        const knownAreas = {};
        const answeredIds = [];
        // Mark the first 5 areas (across however many axes needed) as answered.
        let count = 0;
        outer: for (const axis of DRD_STRUCTURE) {
          for (const area of axis.areas) {
            if (count >= 5) break outer;
            knownAreas[area.id] = { achievedLevel: 3 };
            answeredIds.push(area.id);
            count += 1;
          }
        }
        const totalAreas = DRD_STRUCTURE.reduce((acc, axis) => acc + axis.areas.length, 0);
        const expectedPercent = Math.round((answeredIds.length / totalAreas) * 100);

        const putRes = await request(app)
          .put(`/api/v8/assessment/${assessmentId}`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ answers: { drd: { areas: knownAreas } } });
        assert.equal(putRes.status, 200);
        assert.equal(putRes.body.data.completionPercent, expectedPercent);

        const getResOne = await request(app)
          .get(`/api/v8/assessment/${assessmentId}`)
          .set('Authorization', `Bearer ${tokenA}`);
        const getResTwo = await request(app)
          .get(`/api/v8/assessment/${assessmentId}`)
          .set('Authorization', `Bearer ${tokenA}`);

        assert.equal(getResOne.status, 200);
        assert.equal(getResTwo.status, 200);
        assert.equal(getResOne.body.data.assessment.completion_percent, expectedPercent);
        assert.equal(getResTwo.body.data.assessment.completion_percent, expectedPercent);
        assert.equal(
          getResOne.body.data.assessment.completion_percent,
          getResTwo.body.data.assessment.completion_percent,
          'two consecutive GETs (no writes in between) must return byte-identical completion_percent'
        );
      }
    );

    // ---------------------------------------------------------------------
    // T3.1 — org B token + org A assessmentId against user-state and
    // assignments endpoints -> expect 404 on all four.
    // ---------------------------------------------------------------------
    await step(
      'T3.1 org isolation: org B token + org A assessmentId -> GET /user-state 404',
      async () => {
        const res = await request(app)
          .get(`/api/v8/assessment/${assessmentId}/user-state`)
          .set('Authorization', `Bearer ${tokenB}`);
        assert.equal(res.status, 404);
        assert.equal(res.body.code, 'ASSESSMENT_NOT_FOUND');
      }
    );

    await step(
      'T3.1 org isolation: org B token + org A assessmentId -> PUT /user-state 404',
      async () => {
        const res = await request(app)
          .put(`/api/v8/assessment/${assessmentId}/user-state`)
          .set('Authorization', `Bearer ${tokenB}`)
          .send({ navigation: { step: 'malicious-cross-org-write' } });
        assert.equal(res.status, 404);
        assert.equal(res.body.code, 'ASSESSMENT_NOT_FOUND');
      }
    );

    await step(
      'T3.1 org isolation: org B token + org A assessmentId -> GET /assignments 404',
      async () => {
        const res = await request(app)
          .get(`/api/v8/assessment/${assessmentId}/assignments`)
          .set('Authorization', `Bearer ${tokenB}`);
        assert.equal(res.status, 404);
        assert.equal(res.body.code, 'ASSESSMENT_NOT_FOUND');
      }
    );

    await step(
      'T3.1 org isolation: org B token + org A assessmentId -> PUT /assignments 404',
      async () => {
        const res = await request(app)
          .put(`/api/v8/assessment/${assessmentId}/assignments`)
          .set('Authorization', `Bearer ${tokenB}`)
          .send({ areaId: DRD_STRUCTURE[0].areas[0].id, assignedUserId: USER_B });
        assert.equal(res.status, 404);
        assert.equal(res.body.code, 'ASSESSMENT_NOT_FOUND');
      }
    );

    // Confirm no assignment was actually written by the rejected PUT above.
    await step(
      'T3.1 verify: the rejected cross-org PUT /assignments wrote nothing to the DB',
      async () => {
        const { rows } = await client.query(
          `SELECT id FROM assessment_area_assignments WHERE assessment_id = $1`,
          [assessmentId]
        );
        assert.equal(rows.length, 0, 'no assignment row should exist after the 404-rejected cross-org PUT');
      }
    );

    // ---------------------------------------------------------------------
    // T3.2 — org B token + org A's published definitionId in create payload.
    // Definitions are GLOBAL (confirmed by reading
    // AssessmentDefinitionService.getDefinitionById — no organization_id
    // filter, and assessment_definitions has no organization_id column at
    // all). Expected: 201, org B legitimately shares the methodology.
    // ---------------------------------------------------------------------
    let orgBAssessmentId;
    await step(
      'T3.2 cross-org definition reuse is EXPECTED: org B can create against org A-authored published DRD definitionId -> 201',
      async () => {
        const res = await request(app)
          .post('/api/v8/assessment')
          .set('Authorization', `Bearer ${tokenB}`)
          .send({
            assessmentType: 'DRD',
            name: 'ASM-001A org B reusing org A definition',
            definitionId: DEFINITION_PUBLISHED_ID,
            definitionVersion: 'asm001aneg-1.0',
          });
        assert.equal(res.status, 201);
        orgBAssessmentId = res.body?.data?.id;
        assert.ok(orgBAssessmentId);
        createdAssessmentIds.push(orgBAssessmentId);
        assert.equal(res.body.data.assessment.assessmentDefinitionId, DEFINITION_PUBLISHED_ID);

        const { rows } = await client.query(
          `SELECT organization_id, assessment_definition_id FROM assessments WHERE id = $1`,
          [orgBAssessmentId]
        );
        assert.equal(rows[0].organization_id, ORG_B, 'the ASSESSMENT INSTANCE stays org-scoped to org B');
        assert.equal(
          rows[0].assessment_definition_id,
          DEFINITION_PUBLISHED_ID,
          'while the DEFINITION it points to is the shared/global one authored under org A context'
        );
      }
    );

    await step(
      'T3.2 verify: org A still cannot see org B\'s new assessment instance (instance-level isolation intact even though definition is shared)',
      async () => {
        const res = await request(app)
          .get(`/api/v8/assessment/${orgBAssessmentId}`)
          .set('Authorization', `Bearer ${tokenA}`);
        assert.equal(res.status, 404);
        assert.equal(res.body.code, 'ASSESSMENT_NOT_FOUND');
      }
    );
  } finally {
    try {
      await cleanup(client, createdAssessmentIds);
      console.log('[asm-001a-negative-controls] cleanup OK (asm001aneg-- rows removed)');
    } finally {
      await client.end();
    }
  }

  console.log(`\n[asm-001a-negative-controls] ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[asm-001a-negative-controls] FATAL', err);
  process.exitCode = 1;
});
