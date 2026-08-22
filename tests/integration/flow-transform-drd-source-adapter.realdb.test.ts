import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL || '';
const runRealDb = process.env.RUN_DB_TESTS === '1' && DATABASE_URL.startsWith('postgres');
const describeRealDb = runRealDb ? describe : describe.skip;
const fixture = `flow-drd-${Date.now()}`;
const orgA = `${fixture}-org-a`;
const orgB = `${fixture}-org-b`;
const actor = `${fixture}-actor`;

async function db(): Promise<Client> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

async function seedAcceptedDrd(
  client: Client,
  suffix: string,
  snapshotJson = JSON.stringify({ axis: 'strategy', score: 3 })
) {
  const assessmentId = `${fixture}-assessment-${suffix}`;
  const snapshotId = `${fixture}-snapshot-${suffix}`;
  await client.query(
    `INSERT INTO assessments(id, organization_id, status, name, assessment_type)
     VALUES ($1, $2, 'APPROVED', $3, 'DRD')`,
    [assessmentId, orgA, `DRD ${suffix}`]
  );
  await client.query(
    `INSERT INTO assessment_accepted_snapshots
       (id, organization_id, assessment_id, review_id, snapshot_json, provenance_json, accepted_by, is_current)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
    [
      snapshotId,
      orgA,
      assessmentId,
      `${fixture}-review-${suffix}`,
      snapshotJson,
      JSON.stringify({ source: 'owner-approved-drd' }),
      actor,
    ]
  );
  return { assessmentId, snapshotId };
}

beforeAll(async () => {
  if (!runRealDb) return;
  const client = await db();
  try {
    await client.query(`INSERT INTO organizations(id, name) VALUES ($1, 'DRD A'), ($2, 'DRD B')`, [
      orgA,
      orgB,
    ]);
  } finally {
    await client.end();
  }
});

afterAll(async () => {
  if (!runRealDb) return;
  const parsed = new URL(DATABASE_URL);
  const databaseName = parsed.pathname.slice(1);
  const cleanupAllowed =
    process.env.FLOW_ALLOW_IMMUTABLE_FIXTURE_CLEANUP === '1' &&
    databaseName.startsWith(process.env.FLOW_DISPOSABLE_DB_PREFIX || 'never-match');
  if (!cleanupAllowed) {
    throw new Error('DRD source-adapter cleanup requires an explicitly guarded flow_* database');
  }
  const client = await db();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL session_replication_role = 'replica'`);
    await client.query(`DELETE FROM assessment_candidate_handoffs WHERE organization_id = $1`, [
      orgA,
    ]);
    await client.query(
      `DELETE FROM initiative_candidates WHERE organization_id = $1 AND source_type = 'assessment_accepted_output'`,
      [orgA]
    );
    await client.query(`DELETE FROM assessment_accepted_snapshots WHERE organization_id = $1`, [
      orgA,
    ]);
    await client.query(`DELETE FROM assessments WHERE organization_id = $1`, [orgA]);
    await client.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [[orgA, orgB]]);
    await client.query('COMMIT');
    const readback = await client.query<{ residue: string; disabled: string }>(
      `SELECT
         ((SELECT count(*) FROM organizations WHERE id = ANY($1::text[])) +
          (SELECT count(*) FROM assessments WHERE organization_id = $2) +
          (SELECT count(*) FROM assessment_accepted_snapshots WHERE organization_id = $2) +
          (SELECT count(*) FROM assessment_candidate_handoffs WHERE organization_id = $2) +
          (SELECT count(*) FROM initiative_candidates WHERE organization_id = $2))::text AS residue,
         (SELECT count(*)::text FROM pg_trigger WHERE NOT tgisinternal AND tgenabled <> 'O') AS disabled`,
      [[orgA, orgB], orgA]
    );
    expect(readback.rows[0]).toEqual({ residue: '0', disabled: '0' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
});

describeRealDb('FLOW DRD accepted-output source adapter (real PostgreSQL)', () => {
  it('creates one immutable Candidate receipt and cold-replays the same identity', async () => {
    const client = await db();
    const source = await seedAcceptedDrd(client, 'canonical');
    await client.end();
    const service = await import('../../server/src/services/assessment/drdCandidateHandoff.js');

    const first = await service.handoffAssessmentToCandidate({
      organizationId: orgA,
      assessmentId: source.assessmentId,
      actorId: actor,
    });
    const replay = await service.handoffAssessmentToCandidate({
      organizationId: orgA,
      assessmentId: source.assessmentId,
      actorId: actor,
    });

    expect(first.created).toBe(true);
    expect(replay.created).toBe(false);
    expect(replay.candidate.id).toBe(first.candidate.id);
    expect(replay.handoff).toMatchObject({
      assessmentId: source.assessmentId,
      outputId: source.snapshotId,
      candidateId: first.candidate.id,
      sourceVersion: source.snapshotId,
    });
    expect(replay.handoff.snapshotContentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('serializes concurrent handoff attempts to one Candidate and one receipt', async () => {
    const client = await db();
    const source = await seedAcceptedDrd(client, 'concurrent');
    await client.end();
    const service = await import('../../server/src/services/assessment/drdCandidateHandoff.js');

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        service.handoffAssessmentToCandidate({
          organizationId: orgA,
          assessmentId: source.assessmentId,
          actorId: actor,
        })
      )
    );
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.candidate.id)).size).toBe(1);
  });

  it('denies foreign tenant access and rejects replay after accepted-output drift', async () => {
    const client = await db();
    const source = await seedAcceptedDrd(client, 'drift');
    await client.end();
    const service = await import('../../server/src/services/assessment/drdCandidateHandoff.js');
    await service.handoffAssessmentToCandidate({
      organizationId: orgA,
      assessmentId: source.assessmentId,
      actorId: actor,
    });
    await expect(
      service.handoffAssessmentToCandidate({
        organizationId: orgB,
        assessmentId: source.assessmentId,
        actorId: actor,
      })
    ).rejects.toMatchObject({ code: 'ASSESSMENT_NOT_FOUND' });

    const drift = await db();
    await drift.query(`UPDATE assessment_accepted_snapshots SET is_current = false WHERE id = $1`, [
      source.snapshotId,
    ]);
    await drift.query(
      `INSERT INTO assessment_accepted_snapshots
         (id, organization_id, assessment_id, review_id, snapshot_json, provenance_json, accepted_by, is_current)
       VALUES ($1, $2, $3, $4, $5, '{}', $6, true)`,
      [randomUUID(), orgA, source.assessmentId, randomUUID(), '{"score":4}', actor]
    );
    await drift.end();
    await expect(
      service.handoffAssessmentToCandidate({
        organizationId: orgA,
        assessmentId: source.assessmentId,
        actorId: actor,
      })
    ).rejects.toMatchObject({ code: 'CANDIDATE_HANDOFF_OUTPUT_MISMATCH' });
  });

  it('rolls Candidate back on injected receipt failure and protects committed receipts', async () => {
    const client = await db();
    const source = await seedAcceptedDrd(client, 'rollback');
    await client.end();
    const service = await import('../../server/src/services/assessment/drdCandidateHandoff.js');
    service.setCandidateHandoffFaultInjectorForTests((stage) => {
      if (stage === 'candidate-created') throw new Error('forced-drd-receipt-failure');
    });
    await expect(
      service.handoffAssessmentToCandidate({
        organizationId: orgA,
        assessmentId: source.assessmentId,
        actorId: actor,
      })
    ).rejects.toThrow('forced-drd-receipt-failure');
    service.setCandidateHandoffFaultInjectorForTests(null);

    const verify = await db();
    const counts = await verify.query<{ candidates: number; receipts: number }>(
      `SELECT
         (SELECT count(*)::int FROM initiative_candidates WHERE organization_id = $1 AND source_id = $2) candidates,
         (SELECT count(*)::int FROM assessment_candidate_handoffs WHERE organization_id = $1 AND assessment_id = $2) receipts`,
      [orgA, source.assessmentId]
    );
    expect(counts.rows[0]).toEqual({ candidates: 0, receipts: 0 });
    await expect(
      verify.query(
        `UPDATE assessment_candidate_handoffs SET candidate_id = $1 WHERE organization_id = $2`,
        ['forged', orgA]
      )
    ).rejects.toMatchObject({ code: '23514' });
    await verify.end();
  });
});
