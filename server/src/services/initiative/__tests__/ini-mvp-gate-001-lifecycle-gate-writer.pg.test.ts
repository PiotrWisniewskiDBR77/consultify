/**
 * INI-MVP-GATE-001 — real-PostgreSQL proof for the Initiative lifecycle
 * gate-decision writer newly exposed at
 * `POST /api/pmo/initiatives/:id/lifecycle-gate-decisions`
 * (`server/src/routes/pmo/initiatives.routes.ts`), which now calls the
 * existing `recordInitiativeLifecycleGateDecision()`
 * (`server/src/services/initiative/initiativeLifecycleGateDecisionService.ts`).
 *
 * BACKGROUND (verified before this route existed): the ONLY callers of
 * `recordInitiativeLifecycleGateDecision` were a manual proof script
 * (`server/src/scripts/t01InitiativeGateDecisionRealDbProof.ts`) and
 * `transformationInitiativeTransitionAdapterService.ts`, itself only called
 * by another manual script (`t01InterviewRealDbProof.ts`). No mounted HTTP
 * route reached the writer, while `hasApprovedGateDecision()`
 * (`initiativeTransitionService.ts`) IS wired into 6 live enforcement points
 * gating SCHEDULE_MILESTONES / GOVERNANCE_DECISION_MAKING / CLOSURE
 * transitions — a hard-blocked lifecycle. This file proves the writer path
 * (now reachable through the route) against a REAL Postgres, exercising the
 * exact properties the table's design promises: idempotent replay, advisory
 * -lock-serialized concurrency, append-only immutability, and tenant scoping.
 *
 * ISOLATION STRATEGY (borrowed from `t01InitiativeGateDecisionRealDbProof.ts`,
 * a previously-hardened real-DB proof of this exact table): rather than
 * writing into the shared `public.initiative_lifecycle_gate_decisions` —
 * which the table's own BEFORE UPDATE/DELETE trigger makes impossible to
 * clean up with a plain DELETE — this suite creates a throwaway Postgres
 * SCHEMA, defines minimal LOCAL stub tables for every FK dependency
 * (`users`, `initiatives`, `transformation_cases`,
 * `transformation_case_artifact_links`, `v8_agent_proposal_versions`,
 * `v8_agent_proposal_scope_reviews`, `v8_agent_run_identities`), replays the
 * REAL migration DDL inside that schema (so `initiative_lifecycle_gate_
 * decisions` — including its immutability trigger — is byte-for-byte the
 * production table, just FK-bound to the local stubs via `search_path`
 * resolution), and drops the whole schema in `afterAll`. Dropping a schema
 * does not fire row-level DELETE triggers, so cleanup succeeds even though
 * the table itself permanently forbids DELETE. Nothing in `public` is ever
 * touched — the `claude_b_` prefix on every fixture id is defense in depth,
 * not the primary isolation mechanism.
 *
 * ENV-VAR CONTRACT (same trap as the FIN-005 packet, see project memory):
 * `NODE_ENV=test` alone silently mocks the DB. This suite requires
 * `RUN_DB_TESTS=1`, `MOCK_DB=false`, and a `postgres://` `DATABASE_URL`, or
 * it SKIPS (never silently passes).
 *
 * HOW TO RUN
 * ----------
 *   DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:55811/consultinity" \
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   npx vitest run \
 *     src/services/initiative/__tests__/ini-mvp-gate-001-lifecycle-gate-writer.pg.test.ts \
 *     --retry=0 --no-file-parallelism --maxWorkers=1
 */
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';

import pg, { type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

// See `initiativeCapabilityMatrix.pg.test.ts`: `server/vitest.config.ts` forces
// `DB_TYPE: 'sqlite'` via `test.env`, which wins over the shell/operator value.
// This suite's own DB access never goes through the app's `getDatabase()`
// layer (it drives `pg` directly, same as the proof script it's adapted
// from), so this line is defensive rather than load-bearing — corrected here,
// before any app module is imported, in case that ever changes.
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)(
  'INI-MVP-GATE-001 — Initiative lifecycle gate-decision writer (real PostgreSQL)',
  () => {
    type PgTransactionClient = import('../../../utils/queryHelpers.js').PgTransactionClient;
    type RecordInput =
      import('../initiativeLifecycleGateDecisionService.js').RecordInitiativeLifecycleGateDecisionInput;

    let recordInitiativeLifecycleGateDecision: typeof import('../initiativeLifecycleGateDecisionService.js').recordInitiativeLifecycleGateDecision;
    let assertCurrentApprovedInitiativeLifecycleGateDecision: typeof import('../initiativeLifecycleGateDecisionService.js').assertCurrentApprovedInitiativeLifecycleGateDecision;
    let InitiativeLifecycleGateDecisionError: typeof import('../initiativeLifecycleGateDecisionService.js').InitiativeLifecycleGateDecisionError;
    let hasApprovedGateDecision: typeof import('../initiativeTransitionService.js').hasApprovedGateDecision;

    const schema = `claude_b_gate_${randomUUID().replaceAll('-', '')}`;
    const quotedSchema = `"${schema}"`;
    let pool: InstanceType<typeof pg.Pool>;

    const digest = (seed: string) => createHash('sha256').update(seed).digest('hex');
    const future = '2099-01-01T00:00:00.000Z';

    const ORG_A = 'claude_b_org_a';
    const ORG_B = 'claude_b_org_b';
    const INITIATIVE_A = 'claude_b_initiative_a';
    const CASE_A = 'claude_b_case_a';
    const USER_A = 'claude_b_user_a';
    const USER_B = 'claude_b_user_b';
    const RUN_A = 'claude_b_run_a';
    const PROPOSAL_A = 'claude_b_proposal_a';
    const REVIEW_SCHEDULE = 'claude_b_review_schedule';
    const REVIEW_GOVERNANCE = 'claude_b_review_governance';
    const REVIEW_CLOSURE = 'claude_b_review_closure';
    const CASE_VERSION = 9;

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

    async function tx<T>(fn: (client: PgTransactionClient) => Promise<T>): Promise<T> {
      return withSchemaClient(async (client) => {
        await client.query('BEGIN');
        const pinned: PgTransactionClient = {
          query: async <R = unknown>(sql: string, params: unknown[] = []) => {
            const result = await client.query(adaptPlaceholders(sql), params as unknown[]);
            return { rows: (result.rows as R[]) || [], rowCount: result.rowCount ?? 0 };
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

    async function scalar(sql: string): Promise<number> {
      return withSchemaClient(async (client) => {
        const result = await client.query(sql);
        return Number(result.rows[0]?.value ?? 0);
      });
    }

    const baseInput = (overrides: Partial<RecordInput> = {}): RecordInput => ({
      organizationId: ORG_A,
      initiativeId: INITIATIVE_A,
      transformationCaseId: CASE_A,
      pmoDomain: 'SCHEDULE_MILESTONES',
      decisionStatus: 'approved',
      sourceDigest: digest('claude-b-schedule-go'),
      sourceCaseVersion: CASE_VERSION,
      baselineRefs: ['milestone:claude-b-m-1'],
      a05ProposalVersionId: PROPOSAL_A,
      a05ApprovalReceiptRef: REVIEW_SCHEDULE,
      humanActorUserId: USER_A,
      humanAuthorityRef: 'schedule_lock',
      rationale: 'Claude B real-DB proof: human reviewed the exact schedule baseline.',
      deadlineAt: future,
      idempotencyKey: 'claude_b:schedule:go-1',
      ...overrides,
    });

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: CONNECTION_STRING });
      await pool.query(`CREATE SCHEMA ${quotedSchema}`);

      const migrationPath = new URL(
        '../../../../migrations/20260810_t01_initiative_lifecycle_gate_decisions.sql',
        import.meta.url
      );
      const migration = fs.readFileSync(migrationPath, 'utf8');

      await withSchemaClient(async (client) => {
        // Minimal LOCAL stub tables for every FK dependency the migration
        // references — deliberately NOT the real `public` schema's versions,
        // so this suite never has to satisfy the real schema's full
        // constraint surface (organizations FK, initiatives.status CHECK,
        // etc.). `search_path = <schema>, public` makes unqualified names in
        // the migration's REFERENCES clauses resolve to these stubs.
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
        `);
        // Replays the REAL migration — `initiative_lifecycle_gate_decisions`
        // (with its immutability trigger) is production-identical, just
        // FK-bound to the local stubs above via search_path.
        await client.query(migration);

        await client.query(`
          INSERT INTO users (id, organization_id, status) VALUES
            ('${USER_A}', '${ORG_A}', 'active'),
            ('${USER_B}', '${ORG_B}', 'active');
          INSERT INTO initiatives (id, organization_id) VALUES
            ('${INITIATIVE_A}', '${ORG_A}');
          INSERT INTO transformation_cases (transformation_case_id, organization_id, version) VALUES
            ('${CASE_A}', '${ORG_A}', ${CASE_VERSION});
          INSERT INTO transformation_case_artifact_links
            (transformation_case_id, organization_id, artifact_type, artifact_id) VALUES
            ('${CASE_A}', '${ORG_A}', 'initiative', '${INITIATIVE_A}');
          INSERT INTO v8_agent_run_identities (canonical_run_id, organization_id, transformation_case_id) VALUES
            ('${RUN_A}', '${ORG_A}', '${CASE_A}');
          INSERT INTO v8_agent_proposal_versions
            (proposal_version_id, proposal_id, organization_id, canonical_run_id, status, expires_at) VALUES
            ('${PROPOSAL_A}', 'claude_b_proposal', '${ORG_A}', '${RUN_A}', 'approved', '${future}');
          INSERT INTO v8_agent_proposal_scope_reviews
            (review_id, proposal_version_id, scope_key, decision, reviewed_by_user_id) VALUES
            ('${REVIEW_SCHEDULE}', '${PROPOSAL_A}', 'schedule_lock', 'approved', '${USER_A}'),
            ('${REVIEW_GOVERNANCE}', '${PROPOSAL_A}', 'governance_lock', 'approved', '${USER_A}'),
            ('${REVIEW_CLOSURE}', '${PROPOSAL_A}', 'closure_lock', 'approved', '${USER_A}');
        `);
      });

      ({
        recordInitiativeLifecycleGateDecision,
        assertCurrentApprovedInitiativeLifecycleGateDecision,
        InitiativeLifecycleGateDecisionError,
      } = await import('../initiativeLifecycleGateDecisionService.js'));
      ({ hasApprovedGateDecision } = await import('../initiativeTransitionService.js'));
    }, 30000);

    afterAll(async () => {
      if (pool) {
        // Dropping the schema removes `initiative_lifecycle_gate_decisions`
        // (and every row in it) WITHOUT ever issuing a row-level DELETE —
        // the only way to clean up an append-only table whose own trigger
        // forbids DELETE. Nothing in `public` was touched by this suite.
        await pool.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
        await pool.end();
      }
    });

    it('records a GO (approved) decision that persists and is visible to hasApprovedGateDecision', async () => {
      const result = await tx((client) => recordInitiativeLifecycleGateDecision(client, baseInput()));
      expect(result.idempotentReplay).toBe(false);
      expect(result.decision.version).toBe(1);
      expect(result.decision.decisionStatus).toBe('approved');
      expect(result.decision.baselineRefs).toEqual(['milestone:claude-b-m-1']);

      // Read back in a SEPARATE transaction/connection — proves persistence,
      // not just same-transaction visibility.
      const check = await tx((client) =>
        hasApprovedGateDecision(ORG_A, INITIATIVE_A, 'SCHEDULE_MILESTONES', client)
      );
      expect(check.ok).toBe(true);
      expect(check.decisionId).toBe(result.decision.decisionId);
    });

    it('records a NO-GO (rejected) decision as a new append-only version that supersedes the GO, flipping hasApprovedGateDecision to false', async () => {
      const current = await tx((client) =>
        assertCurrentApprovedInitiativeLifecycleGateDecision(client, {
          organizationId: ORG_A,
          initiativeId: INITIATIVE_A,
          pmoDomain: 'SCHEDULE_MILESTONES',
        })
      );

      const rejected = await tx((client) =>
        recordInitiativeLifecycleGateDecision(
          client,
          baseInput({
            decisionStatus: 'rejected',
            sourceDigest: digest('claude-b-schedule-nogo'),
            rationale: 'Claude B real-DB proof: capacity evidence no longer supports the schedule.',
            idempotencyKey: 'claude_b:schedule:nogo-2',
          })
        )
      );
      expect(rejected.decision.version).toBe(2);
      // Append-only reversal: a NEW row, chained via supersedes_decision_id —
      // never an UPDATE of the GO row.
      expect(rejected.decision.supersedesDecisionId).toBe(current.decisionId);

      const check = await tx((client) =>
        hasApprovedGateDecision(ORG_A, INITIATIVE_A, 'SCHEDULE_MILESTONES', client)
      );
      expect(check.ok).toBe(false);
      expect(check.decisionId).toBeNull();
    });

    it('replays a retry with the same idempotency key as the SAME decision, never a second row', async () => {
      const idempotencyKey = 'claude_b:governance:retry-1';
      const input = baseInput({
        pmoDomain: 'GOVERNANCE_DECISION_MAKING',
        sourceDigest: digest('claude-b-governance-retry'),
        a05ApprovalReceiptRef: REVIEW_GOVERNANCE,
        humanAuthorityRef: 'governance_lock',
        baselineRefs: ['schedule-baseline:claude-b:v1'],
        idempotencyKey,
      });

      const first = await tx((client) => recordInitiativeLifecycleGateDecision(client, input));
      expect(first.idempotentReplay).toBe(false);

      const retry = await tx((client) => recordInitiativeLifecycleGateDecision(client, input));
      expect(retry.idempotentReplay).toBe(true);
      expect(retry.decision.decisionId).toBe(first.decision.decisionId);
      expect(retry.decision.version).toBe(first.decision.version);

      const count = await scalar(
        `SELECT COUNT(*) AS value FROM initiative_lifecycle_gate_decisions
          WHERE organization_id = '${ORG_A}' AND idempotency_key = '${idempotencyKey}'`
      );
      expect(count).toBe(1);
    });

    it('two CONCURRENT submissions with the same idempotency key produce exactly one row (advisory-lock serialized)', async () => {
      const idempotencyKey = 'claude_b:closure:concurrent-1';
      const input = baseInput({
        pmoDomain: 'CLOSURE',
        sourceDigest: digest('claude-b-closure-concurrent'),
        a05ApprovalReceiptRef: REVIEW_CLOSURE,
        humanAuthorityRef: 'closure_lock',
        baselineRefs: ['closure-request:claude-b-1'],
        idempotencyKey,
      });

      const [a, b] = await Promise.all([
        tx((client) => recordInitiativeLifecycleGateDecision(client, input)),
        tx((client) => recordInitiativeLifecycleGateDecision(client, input)),
      ]);

      expect(new Set([a.decision.decisionId, b.decision.decisionId]).size).toBe(1);
      expect([a.idempotentReplay, b.idempotentReplay].filter(Boolean).length).toBe(1);

      const count = await scalar(
        `SELECT COUNT(*) AS value FROM initiative_lifecycle_gate_decisions
          WHERE organization_id = '${ORG_A}' AND idempotency_key = '${idempotencyKey}'`
      );
      expect(count).toBe(1);
    });

    it('denies a cross-tenant WRITE: a different org cannot record a decision against another org\'s case/initiative', async () => {
      await expect(
        tx((client) =>
          recordInitiativeLifecycleGateDecision(
            client,
            baseInput({
              organizationId: ORG_B,
              humanActorUserId: USER_B,
              pmoDomain: 'GOVERNANCE_DECISION_MAKING',
              sourceDigest: digest('claude-b-cross-tenant-write'),
              idempotencyKey: 'claude_b:cross-tenant:write-1',
            })
          )
        )
      ).rejects.toMatchObject({
        code: 'INITIATIVE_GATE_DECISION_CASE_LINEAGE_INVALID',
      });

      // Nothing was written under the foreign org's idempotency key.
      const count = await scalar(
        `SELECT COUNT(*) AS value FROM initiative_lifecycle_gate_decisions
          WHERE idempotency_key = 'claude_b:cross-tenant:write-1'`
      );
      expect(count).toBe(0);
    });

    it('denies a cross-tenant READ: hasApprovedGateDecision under a different org sees nothing, even for a matching initiative id + domain', async () => {
      const check = await tx((client) =>
        hasApprovedGateDecision(ORG_B, INITIATIVE_A, 'GOVERNANCE_DECISION_MAKING', client)
      );
      expect(check.ok).toBe(false);
      expect(check.decisionId).toBeNull();
    });

    it('rejects UPDATE and DELETE on an existing decision — the append-only trigger fires (SQLSTATE 55000)', async () => {
      const current = await tx((client) =>
        assertCurrentApprovedInitiativeLifecycleGateDecision(client, {
          organizationId: ORG_A,
          initiativeId: INITIATIVE_A,
          pmoDomain: 'GOVERNANCE_DECISION_MAKING',
        })
      );

      await expect(
        withSchemaClient((client) =>
          client.query(
            `UPDATE initiative_lifecycle_gate_decisions SET rationale='mutated' WHERE decision_id=$1`,
            [current.decisionId]
          )
        )
      ).rejects.toMatchObject({ code: '55000' });

      await expect(
        withSchemaClient((client) =>
          client.query(`DELETE FROM initiative_lifecycle_gate_decisions WHERE decision_id=$1`, [
            current.decisionId,
          ])
        )
      ).rejects.toMatchObject({ code: '55000' });
    });

    it('survives a COLD reconnect: a brand-new, independent Client (not the pool used to write) reads back the same decision', async () => {
      const written = await tx((client) =>
        assertCurrentApprovedInitiativeLifecycleGateDecision(client, {
          organizationId: ORG_A,
          initiativeId: INITIATIVE_A,
          pmoDomain: 'CLOSURE',
        })
      );

      // A dedicated connection, entirely separate from `pool` — connect,
      // read, disconnect. Not a pool checkout: a genuinely fresh session.
      const coldClient = new pg.Client({ connectionString: CONNECTION_STRING });
      await coldClient.connect();
      let coldRow: { decision_id: string; version: string; decision_status: string } | undefined;
      try {
        await coldClient.query(`SET search_path TO ${quotedSchema}, public`);
        const result = await coldClient.query(
          `SELECT decision_id, version, decision_status
             FROM initiative_lifecycle_gate_decisions
            WHERE organization_id = $1 AND initiative_id = $2 AND pmo_domain = $3
            ORDER BY version DESC LIMIT 1`,
          [ORG_A, INITIATIVE_A, 'CLOSURE']
        );
        coldRow = result.rows[0];
      } finally {
        await coldClient.end();
      }

      expect(coldRow?.decision_id).toBe(written.decisionId);
      expect(Number(coldRow?.version)).toBe(written.version);
      expect(coldRow?.decision_status).toBe('approved');
    });

    it('sanity: InitiativeLifecycleGateDecisionError is the exported error class the route maps to HTTP status codes', async () => {
      await expect(
        tx((client) =>
          recordInitiativeLifecycleGateDecision(
            client,
            baseInput({
              pmoDomain: 'GOVERNANCE_DECISION_MAKING',
              sourceDigest: digest('claude-b-bad-idempotency-conflict'),
              // Reuses an idempotency key already bound to different input
              // (from the retry test) — must 409, never silently overwrite.
              idempotencyKey: 'claude_b:governance:retry-1',
            })
          )
        )
      ).rejects.toBeInstanceOf(InitiativeLifecycleGateDecisionError);
    });
  }
);
