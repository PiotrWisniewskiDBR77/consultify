import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

import pg, { type PoolClient } from 'pg';

import type { PgTransactionClient } from '../utils/queryHelpers.js';
import {
  assertCurrentApprovedInitiativeLifecycleGateDecision,
  recordInitiativeLifecycleGateDecision,
  type RecordInitiativeLifecycleGateDecisionInput,
} from '../services/initiative/initiativeLifecycleGateDecisionService.js';

const databaseUrl = process.env.DATABASE_URL;
const databaseHost = databaseUrl ? new URL(databaseUrl).hostname : '';
if (!databaseUrl || !['localhost', '127.0.0.1', 'db'].includes(databaseHost)) {
  throw new Error('A local or private test-container DATABASE_URL is required for this proof');
}

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 't01-gate-owner-native-proof-secret-at-least-32-characters';

const schema = `gate_owner_${randomUUID().replaceAll('-', '')}`;
const quotedSchema = `"${schema}"`;
const pool = new pg.Pool({ connectionString: databaseUrl });
const migration = process.env.GATE_OWNER_MIGRATION_PATH
  ? fs.readFileSync(process.env.GATE_OWNER_MIGRATION_PATH, 'utf8')
  : fs.readFileSync(
      new URL(
        '../../migrations/20260810_t01_initiative_lifecycle_gate_decisions.sql',
        import.meta.url
      ),
      'utf8'
    );

const digest = (char: string) => char.repeat(64);
const future = '2099-01-01T00:00:00.000Z';

function adaptPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function withSchemaClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${quotedSchema}, public`);
    return await fn(client);
  } finally {
    client.release();
  }
}

async function transaction<T>(fn: (client: PgTransactionClient) => Promise<T>): Promise<T> {
  return withSchemaClient(async (client) => {
    await client.query('BEGIN');
    const pinned: PgTransactionClient = {
      query: async <R = unknown>(sql: string, params: unknown[] = []) => {
        const result = await client.query(adaptPlaceholders(sql), params);
        return { rows: result.rows as unknown as R[], rowCount: result.rowCount ?? 0 };
      },
    };
    try {
      const result = await fn(pinned);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

async function scalar(sql: string, params: unknown[] = []): Promise<number> {
  return withSchemaClient(async (client) => {
    const result = await client.query(sql, params);
    return Number(result.rows[0]?.value ?? 0);
  });
}

const baseInput = (
  overrides: Partial<RecordInitiativeLifecycleGateDecisionInput> = {}
): RecordInitiativeLifecycleGateDecisionInput => ({
  organizationId: 'org-gate',
  initiativeId: 'initiative-gate',
  transformationCaseId: 'case-gate',
  pmoDomain: 'SCHEDULE_MILESTONES',
  decisionStatus: 'approved',
  sourceDigest: digest('a'),
  sourceCaseVersion: 17,
  baselineRefs: ['milestone:m-1', 'dates:2026-08-10:2026-12-20'],
  a05ProposalVersionId: 'proposal-v1',
  a05ApprovalReceiptRef: 'review-v1',
  humanActorUserId: 'human-gate',
  humanAuthorityRef: 'schedule_lock',
  rationale: 'Human reviewed the exact schedule and milestone baseline.',
  deadlineAt: future,
  idempotencyKey: 'schedule:case-gate:initiative-gate:proposal-v1',
  ...overrides,
});

async function setup(): Promise<void> {
  await pool.query(`CREATE SCHEMA ${quotedSchema}`);
  await withSchemaClient(async (client) => {
    await client.query(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE initiatives (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL
      );
      CREATE TABLE transformation_cases (
        transformation_case_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        version INTEGER NOT NULL
      );
      CREATE TABLE transformation_case_artifact_links (
        transformation_case_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        artifact_type TEXT NOT NULL,
        artifact_id TEXT NOT NULL
      );
      CREATE TABLE v8_agent_proposal_versions (
        proposal_version_id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        canonical_run_id TEXT NOT NULL,
        status TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE v8_agent_proposal_scope_reviews (
        review_id TEXT PRIMARY KEY,
        proposal_version_id TEXT NOT NULL,
        scope_key TEXT NOT NULL,
        decision TEXT NOT NULL,
        reviewed_by_user_id TEXT NOT NULL
      );
      CREATE TABLE v8_agent_run_identities (
        canonical_run_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        transformation_case_id TEXT NOT NULL
      );
      CREATE TABLE decisions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        initiative_id TEXT NOT NULL,
        pmo_domain TEXT NOT NULL,
        status TEXT NOT NULL,
        decision_maker_id TEXT,
        deadline TIMESTAMPTZ
      );
    `);
    await client.query(migration);
    await client.query(
      `INSERT INTO users VALUES ('human-gate','org-gate','active');
       INSERT INTO initiatives VALUES
         ('initiative-gate','org-gate'),
         ('initiative-generic','org-gate');
       INSERT INTO transformation_cases VALUES ('case-gate','org-gate',17);
       INSERT INTO transformation_case_artifact_links VALUES
         ('case-gate','org-gate','initiative','initiative-gate');
       INSERT INTO v8_agent_run_identities VALUES ('run-gate','org-gate','case-gate');
       INSERT INTO v8_agent_proposal_versions VALUES
         ('proposal-v1','proposal','org-gate','run-gate','approved','2099-01-01T00:00:00.000Z');
       INSERT INTO v8_agent_proposal_scope_reviews VALUES
         ('review-v1','proposal-v1','schedule_lock','approved','human-gate'),
         ('review-closure','proposal-v1','closure','approved','human-gate');
       INSERT INTO decisions VALUES
         ('legacy-approved','org-gate','initiative-generic','GOVERNANCE_DECISION_MAKING',
          'approved','human-gate','2099-01-01T00:00:00.000Z')`
    );
  });
}

async function main(): Promise<void> {
  await setup();

  const concurrentReplay = await Promise.all([
    transaction((client) => recordInitiativeLifecycleGateDecision(client, baseInput())),
    transaction((client) => recordInitiativeLifecycleGateDecision(client, baseInput())),
  ]);
  assert.equal(new Set(concurrentReplay.map((item) => item.decision.decisionId)).size, 1);
  assert.equal(concurrentReplay.filter((item) => item.idempotentReplay).length, 1);
  assert.equal(
    await scalar(
      `SELECT COUNT(*) AS value FROM ${quotedSchema}.initiative_lifecycle_gate_decisions`
    ),
    1
  );

  const first = concurrentReplay[0].decision;
  assert.equal(first.version, 1);

  const rejected = await transaction((client) =>
    recordInitiativeLifecycleGateDecision(
      client,
      baseInput({
        decisionStatus: 'rejected',
        sourceDigest: digest('b'),
        rationale: 'Capacity evidence no longer supports the proposed schedule.',
        idempotencyKey: 'schedule:case-gate:initiative-gate:reject-v2',
      })
    )
  );
  assert.equal(rejected.decision.version, 2);
  assert.equal(rejected.decision.supersedesDecisionId, first.decisionId);
  await assert.rejects(
    () =>
      transaction((client) =>
        assertCurrentApprovedInitiativeLifecycleGateDecision(client, {
          organizationId: 'org-gate',
          initiativeId: 'initiative-gate',
          pmoDomain: 'SCHEDULE_MILESTONES',
        })
      ),
    (error: unknown) =>
      (error as { code?: string }).code === 'INITIATIVE_GATE_DECISION_NOT_APPROVED'
  );

  const reapproved = await transaction((client) =>
    recordInitiativeLifecycleGateDecision(
      client,
      baseInput({
        sourceDigest: digest('c'),
        rationale: 'Revised capacity evidence supports the rebaselined schedule.',
        baselineRefs: ['milestone:m-1-v2', 'dates:2026-08-17:2027-01-10'],
        idempotencyKey: 'schedule:case-gate:initiative-gate:approved-v3',
      })
    )
  );
  assert.equal(reapproved.decision.version, 3);
  assert.equal(reapproved.decision.supersedesDecisionId, rejected.decision.decisionId);

  await assert.rejects(
    () =>
      transaction((client) =>
        assertCurrentApprovedInitiativeLifecycleGateDecision(client, {
          organizationId: 'org-gate',
          initiativeId: 'initiative-gate',
          pmoDomain: 'SCHEDULE_MILESTONES',
          expectedSourceDigest: digest('a'),
        })
      ),
    (error: unknown) =>
      (error as { code?: string }).code === 'INITIATIVE_GATE_DECISION_SOURCE_DRIFT'
  );
  await assert.rejects(
    () =>
      transaction((client) =>
        assertCurrentApprovedInitiativeLifecycleGateDecision(client, {
          organizationId: 'org-gate',
          initiativeId: 'initiative-gate',
          pmoDomain: 'SCHEDULE_MILESTONES',
          now: new Date('2100-01-01T00:00:00.000Z'),
        })
      ),
    (error: unknown) => (error as { code?: string }).code === 'INITIATIVE_GATE_DECISION_EXPIRED'
  );
  await assert.rejects(
    () =>
      transaction((client) =>
        assertCurrentApprovedInitiativeLifecycleGateDecision(client, {
          organizationId: 'foreign-org',
          initiativeId: 'initiative-gate',
          pmoDomain: 'SCHEDULE_MILESTONES',
        })
      ),
    (error: unknown) => (error as { code?: string }).code === 'INITIATIVE_GATE_DECISION_NOT_FOUND'
  );

  await assert.rejects(
    () =>
      transaction((client) =>
        assertCurrentApprovedInitiativeLifecycleGateDecision(client, {
          organizationId: 'org-gate',
          initiativeId: 'initiative-generic',
          pmoDomain: 'GOVERNANCE_DECISION_MAKING',
        })
      ),
    (error: unknown) => (error as { code?: string }).code === 'INITIATIVE_GATE_DECISION_NOT_FOUND'
  );

  const closure = await transaction((client) =>
    recordInitiativeLifecycleGateDecision(
      client,
      baseInput({
        pmoDomain: 'CLOSURE',
        sourceDigest: digest('f'),
        baselineRefs: ['closure-request:closure-1', 'delivery-evidence:digest-f'],
        a05ApprovalReceiptRef: 'review-closure',
        humanAuthorityRef: 'closure',
        rationale: 'The accountable human accepted delivery closure with pinned evidence.',
        idempotencyKey: 'closure:case-gate:initiative-gate:closure-1',
      })
    )
  );
  const transitionClosureRead = await transaction((client) =>
    assertCurrentApprovedInitiativeLifecycleGateDecision(client, {
      organizationId: 'org-gate',
      initiativeId: 'initiative-gate',
      pmoDomain: 'CLOSURE',
    })
  );
  assert.equal(transitionClosureRead.decisionId, closure.decision.decisionId);

  await assert.rejects(
    () =>
      withSchemaClient((client) =>
        client.query(
          `UPDATE initiative_lifecycle_gate_decisions SET rationale='mutated' WHERE decision_id=$1`,
          [first.decisionId]
        )
      ),
    (error: unknown) => (error as { code?: string }).code === '55000'
  );
  await assert.rejects(
    () =>
      withSchemaClient((client) =>
        client.query(`DELETE FROM initiative_lifecycle_gate_decisions WHERE decision_id=$1`, [
          first.decisionId,
        ])
      ),
    (error: unknown) => (error as { code?: string }).code === '55000'
  );

  const distinctConcurrency = await Promise.all([
    transaction((client) =>
      recordInitiativeLifecycleGateDecision(
        client,
        baseInput({
          sourceDigest: digest('d'),
          rationale: 'Concurrent rebaseline D approved by the human owner.',
          baselineRefs: ['baseline:d'],
          idempotencyKey: 'schedule:case-gate:initiative-gate:distinct-d',
        })
      )
    ),
    transaction((client) =>
      recordInitiativeLifecycleGateDecision(
        client,
        baseInput({
          sourceDigest: digest('e'),
          rationale: 'Concurrent rebaseline E approved by the human owner.',
          baselineRefs: ['baseline:e'],
          idempotencyKey: 'schedule:case-gate:initiative-gate:distinct-e',
        })
      )
    ),
  ]);
  assert.deepEqual(
    distinctConcurrency.map((item) => item.decision.version).sort((a, b) => a - b),
    [4, 5]
  );

  const versions = await withSchemaClient((client) =>
    client.query(
      `SELECT version,decision_status,supersedes_decision_id
         FROM initiative_lifecycle_gate_decisions
        WHERE organization_id='org-gate' AND initiative_id='initiative-gate'
        ORDER BY version`
    )
  );
  assert.deepEqual(
    versions.rows.map((item) => Number(item.version)),
    [1, 1, 2, 3, 4, 5]
  );

  console.log(
    JSON.stringify({
      proof: 'T01_INITIATIVE_GATE_OWNER_REALDB_GREEN',
      immutableUpdateBlocked: true,
      immutableDeleteBlocked: true,
      sameKeyConcurrencyExactlyOne: true,
      sameKeyReplayCount: 1,
      distinctConcurrentVersions: [4, 5],
      scheduleVersionChain: [1, 2, 3, 4, 5],
      closureVersionChain: [1],
      rejectedLatestBlocked: true,
      supersededSourceBlocked: true,
      expiredApprovalBlocked: true,
      tenantDriftBlocked: true,
      genericApprovedDecisionIgnoredByTransition: true,
      canonicalClosureApprovedForTransition: true,
      sharedAdvisoryLockSerializedWrites: true,
    })
  );
}

main()
  .finally(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
    await pool.end();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
