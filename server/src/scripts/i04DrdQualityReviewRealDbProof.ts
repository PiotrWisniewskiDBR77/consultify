import assert from 'node:assert/strict';

import { Pool } from 'pg';

import { adaptQuery } from '../database/PostgresDatabase.js';
import { DRD_STRUCTURE } from '../data/drdStructure.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
process.env.NODE_ENV = 'test';

const pool = new Pool({ connectionString: databaseUrl });
const db = {
  all(sql: string, params: unknown[], cb: (error: Error | null, rows: unknown[]) => void) {
    void pool.query(adaptQuery(sql), params).then((result) => cb(null, result.rows), (error) => cb(error as Error, []));
  },
  get(sql: string, params: unknown[], cb: (error: Error | null, row: unknown) => void) {
    void pool.query(adaptQuery(sql), params).then((result) => cb(null, result.rows[0] ?? null), (error) => cb(error as Error, null));
  },
  run(sql: string, params: unknown[], cb: (error: Error | null) => void) {
    void pool.query(adaptQuery(sql), params).then(
      (result) => cb.call({ changes: result.rowCount ?? 0 }, null),
      (error) => cb.call({ changes: 0 }, error)
    );
  },
  serialize(cb: () => void) {
    cb();
  },
};
(globalThis as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = db;
(process as unknown as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = db;

const ids = {
  organization: 'org-i04-quality',
  foreignOrganization: 'org-i04-foreign',
  assessment: 'assessment-i04-quality',
  owner: 'reviewer-i04-owner',
  unauthorized: 'reviewer-i04-unauthorized',
};

async function counts() {
  return (
    await pool.query<{
      reviews: number;
      snapshots: number;
      current_snapshots: number;
      approved: number;
    }>(
      `SELECT
        (SELECT COUNT(*)::int FROM assessment_quality_reviews) reviews,
        (SELECT COUNT(*)::int FROM assessment_accepted_snapshots) snapshots,
        (SELECT COUNT(*)::int FROM assessment_accepted_snapshots WHERE is_current) current_snapshots,
        (SELECT COUNT(*)::int FROM assessments WHERE status='APPROVED') approved`
    )
  ).rows[0];
}

async function main() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(`
    CREATE TABLE assessments (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, assessment_type TEXT NOT NULL,
      status TEXT, answers_json TEXT, assessment_definition_id TEXT,
      assessment_definition_version TEXT, created_by TEXT, updated_by TEXT,
      updated_at TIMESTAMPTZ, approved_at TIMESTAMPTZ
    );
    CREATE TABLE assessment_roles (
      id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL, user_id TEXT NOT NULL,
      organization_id TEXT NOT NULL, role TEXT NOT NULL, can_edit INTEGER DEFAULT 0,
      can_approve INTEGER DEFAULT 0, can_manage_team INTEGER DEFAULT 0,
      can_change_status INTEGER DEFAULT 0, can_generate_report INTEGER DEFAULT 0,
      can_generate_initiatives INTEGER DEFAULT 0, assigned_areas TEXT, assigned_by TEXT NOT NULL,
      assigned_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE (assessment_id,user_id,organization_id)
    );
    CREATE TABLE assessment_axis_evidence (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, assessment_id TEXT NOT NULL,
      axis_id TEXT NOT NULL, area_id TEXT NOT NULL, evidence_type TEXT NOT NULL,
      title TEXT NOT NULL, description TEXT, url TEXT, created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE assessment_quality_reviews (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, assessment_id TEXT NOT NULL,
      action TEXT NOT NULL, actor_id TEXT NOT NULL, actor_role TEXT, rationale TEXT NOT NULL,
      previous_status TEXT, new_status TEXT, created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE assessment_accepted_snapshots (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, assessment_id TEXT NOT NULL,
      review_id TEXT NOT NULL, snapshot_json TEXT NOT NULL, provenance_json TEXT NOT NULL,
      accepted_by TEXT NOT NULL, accepted_at TIMESTAMPTZ NOT NULL, is_current BOOLEAN NOT NULL
    );
    CREATE UNIQUE INDEX idx_accepted_snapshots_current
      ON assessment_accepted_snapshots(assessment_id) WHERE is_current;
  `);

  const areas = Object.fromEntries(
    DRD_STRUCTURE.flatMap((axis) =>
      axis.areas.map((area) => [area.id, { achievedLevel: 1, targetLevel: 2 }])
    )
  );
  assert.equal(Object.keys(areas).length, 39);
  await pool.query(
    `INSERT INTO assessments
      (id,organization_id,assessment_type,status,answers_json,assessment_definition_id,
       assessment_definition_version,created_by,updated_by,updated_at)
     VALUES ($1,$2,'DRD','DRAFT',$3,'drd-canon','1',$4,$4,NOW())`,
    [ids.assessment, ids.organization, JSON.stringify({ drd: { areas } }), ids.owner]
  );

  const permissions = await import('../services/assessmentPermissionService.js');
  const scoring = await import('../services/assessment/drdEvidenceScoring.js');
  const review = await import('../services/assessment/drdQualityReview.js');
  const snapshots = await import('../services/assessment/drdAcceptedSnapshot.js');

  await permissions.assignRole({
    assessmentId: ids.assessment,
    organizationId: ids.organization,
    userId: ids.owner,
    role: 'admin',
    assignedBy: ids.owner,
  });
  assert.equal(
    await permissions.hasPermission(
      ids.assessment,
      ids.unauthorized,
      ids.organization,
      'canApprove'
    ),
    false
  );
  assert.deepEqual(await counts(), { reviews: 0, snapshots: 0, current_snapshots: 0, approved: 0 });

  for (const axis of DRD_STRUCTURE.slice(0, 6)) {
    await scoring.addEvidence({
      organizationId: ids.organization,
      assessmentId: ids.assessment,
      axisId: String(axis.id),
      areaId: axis.areas[0].id,
      evidenceType: 'note',
      title: `Evidence for axis ${axis.id}`,
      createdBy: ids.owner,
    });
  }
  await assert.rejects(
    () =>
      review.reviewAssessment({
        organizationId: ids.organization,
        assessmentId: ids.assessment,
        actorId: ids.owner,
        actorRole: 'admin',
        action: 'accept',
        rationale: 'Six-axis evidence must not pass',
      }),
    (error: unknown) => (error as { code?: string }).code === 'MISSING_EVIDENCE'
  );
  assert.deepEqual(await counts(), { reviews: 0, snapshots: 0, current_snapshots: 0, approved: 0 });

  const seventh = DRD_STRUCTURE[6];
  await scoring.addEvidence({
    organizationId: ids.organization,
    assessmentId: ids.assessment,
    axisId: String(seventh.id),
    areaId: seventh.areas[0].id,
    evidenceType: 'note',
    title: `Evidence for axis ${seventh.id}`,
    createdBy: ids.owner,
  });
  const derived = scoring.computeDrdScoring(
    areas,
    await scoring.listEvidence({ organizationId: ids.organization, assessmentId: ids.assessment })
  );
  assert.equal(derived.completionPercent, 100);
  assert.equal(derived.axes.length, 7);
  assert.equal(
    derived.axes.reduce((sum, axis) => sum + axis.areaCount, 0),
    39
  );
  assert.equal(derived.axesMissingEvidence.length, 0);

  review.setQualityReviewFaultInjectorForTests((stage) => {
    if (stage === 'snapshot-inserted') throw new Error('forced-i04-review-failure');
  });
  await assert.rejects(
    () =>
      review.reviewAssessment({
        organizationId: ids.organization,
        assessmentId: ids.assessment,
        actorId: ids.owner,
        actorRole: 'admin',
        action: 'accept',
        rationale: 'Force atomic rollback',
      }),
    /forced-i04-review-failure/
  );
  review.setQualityReviewFaultInjectorForTests(null);
  assert.deepEqual(await counts(), { reviews: 0, snapshots: 0, current_snapshots: 0, approved: 0 });

  const accepted = await review.reviewAssessment({
    organizationId: ids.organization,
    assessmentId: ids.assessment,
    actorId: ids.owner,
    actorRole: 'admin',
    action: 'accept',
    rationale: 'All canonical axes and areas reviewed',
  });
  assert.equal(accepted.snapshot?.isCurrent, true);
  const acceptedPayload = accepted.snapshot?.snapshot as { scoring: typeof derived };
  assert.equal(acceptedPayload.scoring.axes.length, 7);
  assert.equal(
    acceptedPayload.scoring.axes.reduce((sum, axis) => sum + axis.areaCount, 0),
    39
  );
  assert.equal(
    (
      await review.listReviewHistory({
        organizationId: ids.organization,
        assessmentId: ids.assessment,
      })
    ).length,
    1
  );
  assert.equal(
    (
      await snapshots.getCurrentAcceptedSnapshot({
        organizationId: ids.organization,
        assessmentId: ids.assessment,
      })
    )?.reviewId,
    accepted.review.id
  );
  assert.equal(
    (
      await review.listReviewHistory({
        organizationId: ids.foreignOrganization,
        assessmentId: ids.assessment,
      })
    ).length,
    0
  );
  assert.equal(
    await snapshots.getCurrentAcceptedSnapshot({
      organizationId: ids.foreignOrganization,
      assessmentId: ids.assessment,
    }),
    null
  );

  const replay = await review.reviewAssessment({
    organizationId: ids.organization,
    assessmentId: ids.assessment,
    actorId: ids.owner,
    actorRole: 'admin',
    action: 'accept',
    rationale: 'Versioned re-accept under existing contract',
  });
  assert.notEqual(replay.review.id, accepted.review.id);
  const afterReplay = await counts();
  assert.deepEqual(afterReplay, { reviews: 2, snapshots: 2, current_snapshots: 1, approved: 1 });
  const immutable = await pool.query<{ id: string; is_current: boolean }>(
    `SELECT id,is_current FROM assessment_accepted_snapshots ORDER BY accepted_at,id`
  );
  assert.equal(immutable.rows.length, 2);
  assert.equal(immutable.rows.filter((row) => row.is_current).length, 1);

  console.log(
    JSON.stringify(
      {
        proof: 'I04_DRD_QUALITY_REVIEW_REALDB_GREEN',
        answeredAreas: 39,
        evidenceAxes: 7,
        missingEvidenceRejectedWithZeroWrites: true,
        unauthorizedCanApprove: false,
        unauthorizedZeroWrites: true,
        forcedFailureRollback: true,
        acceptedSnapshotAxes: acceptedPayload.scoring.axes.length,
        acceptedSnapshotAreas: acceptedPayload.scoring.axes.reduce(
          (sum, axis) => sum + axis.areaCount,
          0
        ),
        tenantReadbackNull: true,
        reviewHistoryReadback: 2,
        replayContract: 'new immutable snapshot; exactly one current',
        ...afterReplay,
      },
      null,
      2
    )
  );
}

async function run(): Promise<void> {
  try {
    await main();
    await pool.end();
    // The canonical review service leaves its module-level pool open. Its
    // public close path can lazy-initialize schema work during teardown, so
    // after every assertion and fixture cleanup succeeds, terminate the idle
    // handle without calling product lifecycle APIs.
    process.exit(0);
  } catch (error) {
    try {
      await pool.end();
    } catch (cleanupError) {
      console.error('I04 proof cleanup failure:', cleanupError);
    }
    console.error(error);
    process.exit(1);
  }
}

void run();
