/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  applyExecutionSpineBackfill,
  planExecutionSpineBackfill,
} from '../execution/executionSpineBackfillService.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_PG)('EXE-MVP-SPINE-001 explicit legacy identity disposition', () => {
  const tag = randomUUID();
  const org = `exe-spine-org-${tag}`;
  const actor = `exe-spine-actor-${tag}`;
  const project = `exe-spine-project-${tag}`;
  const legacyInitiativeMapped = `exe-spine-legacy-mapped-${tag}`;
  const legacyInitiativeQuarantined = `exe-spine-legacy-quarantine-${tag}`;
  const legacyCaseMapped = `exe-spine-case-mapped-${tag}`;
  const legacyCaseQuarantined = `exe-spine-case-quarantine-${tag}`;
  const legacyLinkMapped = randomUUID();
  const legacyLinkQuarantined = randomUUID();
  const runtimeLink = randomUUID();
  const sourceSha = 'a'.repeat(40);
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,$1)`, [org]);
    await client.query(
      `INSERT INTO users(id,organization_id,email,role,status) VALUES($1,$2,$3,'OWNER','active')`,
      [actor, org, `${actor}@example.test`],
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [`membership-${actor}`, org, actor],
    );
    await client.query(`INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$1)`, [
      project,
      org,
    ]);
    await client.query(
      `INSERT INTO initiatives(id,organization_id,project_id,name,status)
       VALUES($1,$3,$4,$1,'EXECUTING'),($2,$3,$4,$2,'EXECUTING')`,
      [legacyInitiativeMapped, legacyInitiativeQuarantined, org, project],
    );
    await client.query(
      `INSERT INTO case_core(case_id,organization_id,project_id,contracted_closure_type,created_by_actor_id,case_name)
       VALUES($1,$3,$4,'OUTCOME_VALIDATED',$5,$1),($2,$3,$4,'OUTCOME_VALIDATED',$5,$2)`,
      [legacyCaseMapped, legacyCaseQuarantined, org, project, actor],
    );
    await client.query(
      `INSERT INTO execution_case_links
        (link_id,organization_id,initiative_id,case_id,project_id,intake_idempotency_key,created_by)
       VALUES($1,$3,$4,$5,$6,$7,$8),($2,$3,$9,$10,$6,$11,$8)`,
      [
        legacyLinkMapped,
        legacyLinkQuarantined,
        org,
        legacyInitiativeMapped,
        legacyCaseMapped,
        project,
        `mapped-${tag}`,
        actor,
        legacyInitiativeQuarantined,
        legacyCaseQuarantined,
        `quarantine-${tag}`,
      ],
    );
    await client.query(
      `INSERT INTO execution_case_links
        (link_id,organization_id,initiative_id,case_id,project_id,intake_idempotency_key,created_by,
         source_kind,runtime_initiative_id,runtime_execution_case_id,source_version,source_project_id)
       VALUES($1,$2,NULL,NULL,NULL,$3,$4,'RUNTIME_V1',$5,$6,1,$7)`,
      [runtimeLink, org, `runtime-${tag}`, actor, `runtime-initiative-${tag}`, `runtime-case-${tag}`, project],
    );
    await client.query(
      `INSERT INTO execution_identity_aliases
        (organization_id,execution_link_id,legacy_initiative_id,legacy_case_id,created_by)
       VALUES($1,$2,$3,$4,$5)`,
      [org, runtimeLink, legacyInitiativeMapped, legacyCaseMapped, actor],
    );
  });

  afterAll(async () => {
    if (!client) return;
    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL session_replication_role='replica'`);
      for (const table of [
        'execution_spine_backfill_receipts',
        'execution_spine_identity_quarantine',
        'execution_spine_backfill_runs',
      ]) {
        await client.query(`DELETE FROM ${table} WHERE organization_id=$1`, [org]);
      }
      await client.query(`SET LOCAL session_replication_role='origin'`);
      await client.query(`DELETE FROM execution_identity_aliases WHERE organization_id=$1`, [org]);
      await client.query(`DELETE FROM execution_case_links WHERE organization_id=$1`, [org]);
      await client.query(`DELETE FROM case_core WHERE organization_id=$1`, [org]);
      await client.query(`DELETE FROM initiatives WHERE organization_id=$1`, [org]);
      await client.query(`DELETE FROM projects WHERE organization_id=$1`, [org]);
      await client.query(`DELETE FROM organization_members WHERE organization_id=$1`, [org]);
      await client.query(`DELETE FROM users WHERE organization_id=$1`, [org]);
      await client.query(`DELETE FROM organizations WHERE id=$1`, [org]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.end();
    }
  });

  it('plans with zero writes, then atomically records exactly one mapping and one quarantine', async () => {
    const plan = await planExecutionSpineBackfill({ organizationId: org, sourceSha });
    expect(plan).toMatchObject({ mappedCount: 1, quarantinedCount: 1 });
    expect(plan.dispositions).toEqual(expect.arrayContaining([
      expect.objectContaining({ outcome: 'MAPPED', canonicalExecutionLinkId: runtimeLink }),
      expect.objectContaining({ outcome: 'QUARANTINED', reasonCode: 'NO_RUNTIME_V1_IDENTITY' }),
    ]));
    const before = await client.query(
      `SELECT
        (SELECT count(*)::int FROM execution_spine_backfill_runs WHERE organization_id=$1) AS runs,
        (SELECT count(*)::int FROM execution_spine_backfill_receipts WHERE organization_id=$1) AS receipts,
        (SELECT count(*)::int FROM execution_spine_identity_quarantine WHERE organization_id=$1) AS quarantines`,
      [org],
    );
    expect(before.rows[0]).toEqual({ runs: 0, receipts: 0, quarantines: 0 });

    const applied = await applyExecutionSpineBackfill({
      organizationId: org,
      sourceSha,
      expectedPlanChecksum: plan.checksum,
      actorId: actor,
    });
    expect(applied.replay).toBe(false);
    const after = await client.query(
      `SELECT
        (SELECT count(*)::int FROM execution_spine_backfill_runs WHERE organization_id=$1) AS runs,
        (SELECT count(*)::int FROM execution_spine_backfill_receipts WHERE organization_id=$1) AS receipts,
        (SELECT count(*)::int FROM execution_spine_identity_quarantine WHERE organization_id=$1) AS quarantines`,
      [org],
    );
    expect(after.rows[0]).toEqual({ runs: 1, receipts: 1, quarantines: 1 });

    const replay = await applyExecutionSpineBackfill({
      organizationId: org,
      sourceSha,
      expectedPlanChecksum: plan.checksum,
      actorId: actor,
    });
    expect(replay).toMatchObject({ runId: applied.runId, replay: true });
  });

  it('rejects stale operator approval and keeps immutable evidence unchanged', async () => {
    const plan = await planExecutionSpineBackfill({ organizationId: org, sourceSha });
    await expect(
      applyExecutionSpineBackfill({
        organizationId: org,
        sourceSha,
        expectedPlanChecksum: 'b'.repeat(64),
        actorId: actor,
      }),
    ).rejects.toThrow('execution_backfill_plan_changed');
    await expect(
      client.query(
        `UPDATE execution_spine_backfill_runs SET mapped_count=mapped_count+1 WHERE organization_id=$1`,
        [org],
      ),
    ).rejects.toThrow(/immutable/);
    await expect(
      client.query(`DELETE FROM execution_spine_identity_quarantine WHERE organization_id=$1`, [org]),
    ).rejects.toThrow(/immutable/);
    expect(plan.checksum).toMatch(/^[0-9a-f]{64}$/);
  });
});
