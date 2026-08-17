/**
 * EXE-09 — durable closure→Results/Finance delivery receipt, against a REAL
 * Postgres database (no mocks).
 *
 * Scope: `server/src/services/closureDeliveryReceiptService.ts` (new) and its
 * wiring into the FROZEN, unmodified-in-logic canonical transition engine
 * (`initiativeTransitionService.ts::executeInitiativeTransition` — only the
 * two call sites at the DONE-transition branch are touched, see that file's
 * diff). This suite drives REAL closures through the real engine (same
 * RBAC/gate/readiness checks a real HTTP caller would hit), not a mock — it
 * deliberately calls the engine directly rather than going through
 * `initiativeClosureService`'s closure-request/evidence workflow, because
 * that workflow's own gates are EXE-08's frozen, separately-tested concern
 * (see execution-closure-evidence-gate.golden-flow.realdb.test.ts); this
 * file is the single writer for its own new files only.
 *
 * Engine preconditions relied on here (established by the sibling EXE-08
 * suite's own investigation, re-verified against this same schema):
 *   - `getBlockingReadinessItems` requires, for EXECUTING (a
 *     SCHEDULED_ONWARD status): non-empty name, an owner
 *     (owner_business_id/owner_execution_id), planned_start_date AND
 *     planned_end_date.
 *   - `hasPendingExecutionGateDecisions` blocks EXECUTING/BLOCKED->DONE only
 *     if a `decisions` row with status pending/escalated of a specific type
 *     is linked — trivially satisfied by not creating one.
 *   - The engine's OWN RBAC check (`isAdmin || requiredRoles.includes(...)`)
 *     is satisfied by `actorRole: 'ADMIN'` passed directly to
 *     `executeInitiativeTransition` — this is calling the SERVICE function
 *     directly (not HTTP), so there is no JWT/session layer to mint; a real
 *     HTTP caller's `req.user.role` plays the identical role and is
 *     out-of-scope here (already covered by the sibling EXE-08 realdb
 *     suite's route-level tests).
 *
 * HOW TO RUN LOCALLY (Postgres already up + migrated with
 * server/scripts/migrate.postgres.ts --safe, plus --only
 * 293_initiative_milestones.sql,247_initiative_enhancements.sql,
 * 063_raid_items.sql for the same known pre-existing fresh-install gap the
 * sibling EXE-08 suite documents):
 *   DATABASE_URL="postgresql://iris:iris_test@localhost:5452/iris_test" \
 *     NODE_ENV=test npx vitest run \
 *     tests/integration/exe009-closure-delivery-receipt.realdb.test.ts \
 *     --no-file-parallelism
 */

import { randomBytes, randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';

import { deleteLedgerRows } from '../support/disposableLedgerCleanup.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
}

import { executeInitiativeTransition } from '../../server/src/services/initiative/initiativeTransitionService.js';
import {
  attemptDeliveryInternal,
  getReceiptById,
  getReceiptForInitiative,
  retryDeliveryForOrg,
  runReconciliationSweep,
} from '../../server/src/services/closureDeliveryReceiptService.js';
import initiativeClosureRoutes from '../../server/src/routes/pmo/initiativeClosure.routes.js';
// The canonical Benefits/ROI read model (server/src/routes/benefits.routes.ts,
// mounted at /api/benefits in Gateway.ts) — used to prove the Finance leg's
// output is visible through the REAL read path, not just a raw SQL peek.
import benefitsRoutes from '../../server/src/routes/benefits.routes.js';

// ---------------------------------------------------------------------------
// Route-level RBAC test app (Codex review round 2, BLOCKER3) — same E2E JWT
// bypass convention as the sibling EXE-08 golden-flow suite.
// ---------------------------------------------------------------------------

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeE2EToken(userId: string, organizationId: string, role: string): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'EXE-09 RealDB Test User',
    role,
    userRole: role,
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/initiatives', initiativeClosureRoutes);
  app.use('/api/benefits', benefitsRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Connection probe — same contract as the sibling EXE-08 realdb suite.
// ---------------------------------------------------------------------------

const PROBE_TIMEOUT_MS = 2_000;

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

function buildClientConfig(): ClientConfig | null {
  const databaseUrl = readDatabaseUrl();
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      connectionTimeoutMillis: PROBE_TIMEOUT_MS,
      statement_timeout: 5_000,
    };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    statement_timeout: 5_000,
  };
}

async function pgReachable(): Promise<boolean> {
  const config = buildClientConfig();
  if (!config) return false;
  const probe = new Client(config);
  try {
    await probe.connect();
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => {});
  }
}

async function findMissingTables(client: Client, names: readonly string[]): Promise<string[]> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [names as unknown as string[]]
  );
  const found = new Set(result.rows.map((r) => r.table_name));
  return names.filter((n) => !found.has(n));
}

const REQUIRED_TABLES = [
  'organizations',
  'users',
  'projects',
  'initiatives',
  'initiative_history',
  'initiative_status_history',
  'initiative_kpis',
  'initiative_benefits',
  'closure_delivery_receipts',
  'roi_realized_values',
  'kpi_time_series',
  'roi_assumptions',
] as const;

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/**
 * Codex review round 3: `kpiTargetValue` (a PLAN) and `monetaryMeasurement`
 * (an OBSERVED `kpi_time_series` fact) are deliberately SEPARATE knobs now —
 * the whole point of this round's fix is that a target must NEVER be usable
 * as a stand-in for an actual. Tests that want Finance to actually deliver
 * must set `monetaryMeasurement` explicitly; setting only `kpiTargetValue`
 * (Results-leg-only) must always resolve Finance to NEEDS_DECISION.
 */
interface MakeInitiativeOpts {
  budgetCurrency?: string | null;
  kpiTargetValue?: number | null;
  kpiUnit?: string;
  expectedRoi?: number | null;
  monetaryMeasurement?: {
    value: number;
    /** Defaults to `budgetCurrency` — set differently to test a unit MISMATCH. */
    unit?: string;
    /** Age of the measurement's period_end, in days before "now". Defaults to 1 (fresh). */
    ageDays?: number;
    /** Defaults to orgAId — set to orgBId to simulate a cross-tenant data-integrity probe. */
    organizationId?: string;
  };
}

interface Harness {
  client: Client;
  orgAId: string;
  orgBId: string;
  userAId: string;
  /** role='MEMBER', org A, NOT an owner of any test initiative — for the 403 RBAC case. */
  userMemberId: string;
  /** role='ADMIN', org B — for the cross-tenant 404 RBAC case. */
  userBId: string;
  projectAId: string;
  // Fresh EXECUTING initiative per scenario — created via a factory so each
  // `it()` gets its own isolated row (no shared mutable fixture races).
  makeInitiative: (label: string, opts?: MakeInitiativeOpts) => Promise<string>;
  /**
   * For tests that exercise `attemptDelivery`/`runReconciliationSweep`
   * directly (fault injection, restart simulation): seeds an initiative
   * ALREADY at DONE (bypassing the transition engine, since these tests are
   * not about closure mechanics — that's the golden-flow/concurrency tests'
   * job) plus a receipt row in the exact PENDING shape
   * `createReceiptOnClosure` would have written. Deliberately does NOT go
   * through `executeInitiativeTransition`, because that call's own
   * post-commit `triggerImmediateDeliveryBestEffort` is a real,
   * fire-and-forget background delivery — it reliably WINS the race against
   * a test's own next line (confirmed empirically: by the time control
   * returns to the caller, several more `await`s inside the transition
   * function have already given it enough event-loop turns to finish),
   * making these specific tests' fault-injection pointless (the leg is
   * already DELIVERED before the injected-fault call ever runs). Seeding
   * directly removes that race without touching production code.
   */
  seedClosedInitiativeWithReceipt: (
    label: string,
    opts?: MakeInitiativeOpts
  ) => Promise<{ initiativeId: string; correlationId: string }>;
  cleanup: () => Promise<void>;
}

async function setupHarness(): Promise<Harness | null> {
  const config = buildClientConfig();
  if (!config) return null;
  if (!(await pgReachable())) return null;

  const client = new Client(config);
  try {
    await client.connect();
  } catch {
    return null;
  }

  const missing = await findMissingTables(client, REQUIRED_TABLES).catch(async (err) => {
    await client.end().catch(() => {});
    throw new Error(
      `Schema check itself failed: ${err instanceof Error ? err.message : String(err)}`
    );
  });
  if (missing.length > 0) {
    await client.end().catch(() => {});
    throw new Error(
      `DATABASE_URL is configured and reachable, but the schema is incomplete — missing table(s): ` +
        `${missing.join(', ')}. Run server/scripts/migrate.postgres.ts --safe (NODE_ENV=test) against ` +
        `this database, plus --only 293_initiative_milestones.sql,247_initiative_enhancements.sql,` +
        `063_raid_items.sql for a known pre-existing fresh-install gap, before re-running this suite.`
    );
  }

  const tag = suffix();
  const orgAId = `org_exe09_a_${tag}`;
  const orgBId = `org_exe09_b_${tag}`;
  const userAId = `user_exe09_a_${tag}`;
  const userMemberId = `user_exe09_member_${tag}`;
  const userBId = `user_exe09_b_${tag}`;
  const projectAId = `proj_exe09_a_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'EXE-09 RealDB Org A', 'enterprise', 'active') ON CONFLICT (id) DO NOTHING`,
    [orgAId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'EXE-09 RealDB Org B', 'enterprise', 'active') ON CONFLICT (id) DO NOTHING`,
    [orgBId]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'ADMIN', 'active', 'EXE09', 'UserA') ON CONFLICT (id) DO NOTHING`,
    [userAId, orgAId, `${userAId}@local.test`]
  );
  // Deliberately role='MEMBER' and never made an owner of any test
  // initiative below — proves the REAL DB-driven authorization path (see
  // initiativeAccessResolver.ts), not a JWT-role bypass.
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'MEMBER', 'active', 'EXE09', 'UserMember') ON CONFLICT (id) DO NOTHING`,
    [userMemberId, orgAId, `${userMemberId}@local.test`]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'ADMIN', 'active', 'EXE09', 'UserB') ON CONFLICT (id) DO NOTHING`,
    [userBId, orgBId, `${userBId}@local.test`]
  );
  await client.query(
    `INSERT INTO projects (id, organization_id, name, status, owner_id) VALUES ($1, $2, 'EXE-09 RealDB Project A', 'active', $3)`,
    [projectAId, orgAId, userAId]
  );

  const initiativeIds: string[] = [];

  const makeInitiative: Harness['makeInitiative'] = async (label, opts = {}) => {
    const id = `init_exe09_${label}_${suffix()}`;
    initiativeIds.push(id);
    const budgetCurrency = opts.budgetCurrency === undefined ? 'PLN' : opts.budgetCurrency;
    await client.query(
      `INSERT INTO initiatives
         (id, organization_id, project_id, name, status, progress, owner_business_id,
          planned_start_date, planned_end_date, budget_currency, expected_roi)
       VALUES ($1, $2, $3, $4, 'EXECUTING', 0, $5, '2026-01-01', '2026-12-31', $6, $7)`,
      [
        id,
        orgAId,
        projectAId,
        `EXE-09 ${label}`,
        userAId,
        budgetCurrency,
        opts.expectedRoi === undefined || opts.expectedRoi === null
          ? null
          : String(opts.expectedRoi),
      ]
    );
    if (opts.kpiTargetValue !== undefined && opts.kpiTargetValue !== null) {
      await client.query(
        `INSERT INTO initiative_kpis (id, initiative_id, name, target_value, unit)
         VALUES ($1, $2, 'Realized value', $3, $4)`,
        [`kpi_${id}`, id, opts.kpiTargetValue, opts.kpiUnit ?? budgetCurrency ?? 'PLN']
      );
    }
    if (opts.monetaryMeasurement) {
      // A measurement needs its OWN kpi_id (kpi_time_series.kpi_id is a real
      // FK) — reuse the target's KPI if one was already created above
      // (deliberately allowed, so a test can have BOTH a plan and an actual
      // on the same KPI), otherwise mint a dedicated measurement-only KPI.
      const measurementKpiId =
        opts.kpiTargetValue !== undefined && opts.kpiTargetValue !== null
          ? `kpi_${id}`
          : `kpi_meas_${id}`;
      if (measurementKpiId === `kpi_meas_${id}`) {
        await client.query(
          `INSERT INTO initiative_kpis (id, initiative_id, name, unit)
           VALUES ($1, $2, 'Measured value', $3)`,
          [measurementKpiId, id, opts.monetaryMeasurement.unit ?? budgetCurrency ?? 'PLN']
        );
      }
      const ageDays = opts.monetaryMeasurement.ageDays ?? 1;
      const measurementOrgId = opts.monetaryMeasurement.organizationId ?? orgAId;
      await client.query(
        `INSERT INTO kpi_time_series (id, kpi_id, initiative_id, organization_id, value, period_start, period_end, source)
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE - ($6 * INTERVAL '1 day'), CURRENT_DATE - ($6 * INTERVAL '1 day'), 'test-measurement')`,
        [
          `kts_${id}`,
          measurementKpiId,
          id,
          measurementOrgId,
          opts.monetaryMeasurement.value,
          ageDays,
        ]
      );
    }
    return id;
  };

  const seedClosedInitiativeWithReceipt: Harness['seedClosedInitiativeWithReceipt'] = async (
    label,
    opts = {}
  ) => {
    const initiativeId = await makeInitiative(label, opts);
    await client.query(`UPDATE initiatives SET status = 'DONE' WHERE id = $1`, [initiativeId]);
    const correlationId = randomUUID();
    await client.query(
      `INSERT INTO initiative_status_history (id, initiative_id, organization_id, from_status, to_status)
       VALUES ($1, $2, $3, 'EXECUTING', 'DONE')`,
      [correlationId, initiativeId, orgAId]
    );
    // Same shape/values as closureDeliveryReceiptService.createReceiptOnClosure.
    await client.query(
      `INSERT INTO closure_delivery_receipts (
         id, organization_id, initiative_id, transition_audit_ref, actor_id, actor_label
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        correlationId,
        orgAId,
        initiativeId,
        correlationId,
        userAId,
        'system:exe-009-closure-receipt',
      ]
    );
    return { initiativeId, correlationId };
  };

  const cleanup = async () => {
    /**
     * The append-only ledgers come first, because everything below depends on
     * them being gone.
     *
     * Each closure this suite drives writes an
     * `initiative_lifecycle_gate_decisions` row; that table is immutable by
     * trigger and its foreign key to `initiatives` has no ON DELETE action, so
     * `DELETE FROM initiatives` below could never succeed — and every one of
     * those deletes is `.catch(() => {})`, so it failed in silence. A green run
     * of this suite stranded 25 initiatives.
     *
     * Bounded to this run's two organization ids, and the helper refuses to run
     * anywhere but a disposable database.
     */
    try {
      await deleteLedgerRows(client, [
        {
          ledger: 'initiative_closure_evidence',
          column: 'organization_id',
          values: [orgAId, orgBId],
        },
        {
          ledger: 'initiative_lifecycle_gate_decisions',
          column: 'organization_id',
          values: [orgAId, orgBId],
        },
      ]);
    } catch (error) {
      console.error('[exe09 cleanup] could not clear the append-only ledgers:', error);
    }

    for (const id of initiativeIds) {
      await client
        .query(`DELETE FROM roi_assumptions WHERE initiative_id = $1`, [id])
        .catch(() => {});
      await client
        .query(`DELETE FROM roi_realized_values WHERE initiative_id = $1`, [id])
        .catch(() => {});
      await client
        .query(`DELETE FROM closure_delivery_receipts WHERE initiative_id = $1`, [id])
        .catch(() => {});
      await client
        .query(`DELETE FROM initiative_benefits WHERE initiative_id = $1`, [id])
        .catch(() => {});
      await client
        .query(`DELETE FROM kpi_time_series WHERE initiative_id = $1`, [id])
        .catch(() => {});
      await client
        .query(`DELETE FROM initiative_kpis WHERE initiative_id = $1`, [id])
        .catch(() => {});
      await client
        .query(`DELETE FROM initiative_status_history WHERE initiative_id = $1`, [id])
        .catch(() => {});
      await client
        .query(`DELETE FROM initiative_history WHERE initiative_id = $1`, [id])
        .catch(() => {});
      await client
        .query(`DELETE FROM initiative_closure_requests WHERE initiative_id = $1`, [id])
        .catch(() => {});
      // NOT swallowed: this is the delete the stranded rows came from, and a
      // silent failure here is exactly what hid them.
      await client.query(`DELETE FROM initiatives WHERE id = $1`, [id]);
    }
    await client.query(
      `DELETE FROM v8_agent_proposal_scope_reviews
        WHERE proposal_version_id IN (
          SELECT proposal_version_id FROM v8_agent_proposal_versions
           WHERE organization_id = ANY($1)
        )`,
      [[orgAId, orgBId]]
    );
    await client.query(`DELETE FROM v8_agent_proposal_versions WHERE organization_id = ANY($1)`, [
      [orgAId, orgBId],
    ]);
    // No FK to organizations, so nothing else was ever going to remove these.
    await client.query(`DELETE FROM transformation_cases WHERE organization_id = ANY($1)`, [
      [orgAId, orgBId],
    ]);
    await client.query(`DELETE FROM projects WHERE id = $1`, [projectAId]).catch(() => {});
    await client
      .query(`DELETE FROM users WHERE id = ANY($1)`, [[userAId, userMemberId, userBId]])
      .catch(() => {});
    await client
      .query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgAId, orgBId]])
      .catch(() => {});
    await client.end().catch(() => {});
  };

  return {
    client,
    orgAId,
    orgBId,
    userMemberId,
    userBId,
    userAId,
    projectAId,
    makeInitiative,
    seedClosedInitiativeWithReceipt,
    cleanup,
  };
}

async function closeInitiative(h: Harness, initiativeId: string): Promise<string> {
  // The canonical transition owner now requires an immutable, human-approved
  // CLOSURE decision.  EXE-09 is not a gate-writer test, so seed the smallest
  // valid upstream fixture instead of bypassing the production guard.
  const caseId = `case_${initiativeId}`;
  const proposalVersionId = `proposal_version_${initiativeId}`;
  const reviewId = `review_${initiativeId}`;
  const decisionId = `closure_decision_${initiativeId}`;
  const digest = randomBytes(32).toString('hex');
  await h.client.query(
    `INSERT INTO transformation_cases
       (transformation_case_id, organization_id, initiated_by_user_id, mandate,
        lineage_id, idempotency_key, version)
     VALUES ($1,$2,$3,$4,$5,$6,1)`,
    [
      caseId,
      h.orgAId,
      h.userAId,
      'EXE-09 governed closure fixture',
      `lineage_${initiativeId}`,
      `case_${initiativeId}`,
    ]
  );
  await h.client.query(
    `INSERT INTO v8_agent_proposal_versions
       (proposal_version_id, proposal_id, organization_id, canonical_run_id,
        proposal_version, plan_version, context_digest, before_json, after_json,
        approval_scopes_json, reviewer_authority_json, expires_at, status,
        created_by_user_id)
     VALUES ($1,$2,$3,$4,1,1,$5,'{}'::jsonb,'{}'::jsonb,$6::jsonb,$7::jsonb,
             NOW() + INTERVAL '1 day','approved',$8)`,
    [
      proposalVersionId,
      `proposal_${initiativeId}`,
      h.orgAId,
      `run_${initiativeId}`,
      digest,
      JSON.stringify(['closure_lock']),
      JSON.stringify({ userId: h.userAId, authority: 'closure_lock' }),
      h.userAId,
    ]
  );
  await h.client.query(
    `INSERT INTO v8_agent_proposal_scope_reviews
       (review_id, proposal_version_id, scope_key, decision, reason, reviewed_by_user_id)
     VALUES ($1,$2,'closure_lock','approved','EXE-09 governed fixture',$3)`,
    [reviewId, proposalVersionId, h.userAId]
  );
  await h.client.query(
    `INSERT INTO initiative_lifecycle_gate_decisions
       (decision_id, organization_id, initiative_id, transformation_case_id,
        pmo_domain, version, decision_status, source_digest, source_case_version,
        baseline_refs_json, a05_proposal_version_id, a05_approval_receipt_ref,
        human_actor_user_id, human_authority_ref, rationale, deadline_at,
        idempotency_key, input_digest)
     VALUES ($1,$2,$3,$4,'CLOSURE',1,'approved',$5,1,$6::jsonb,$7,$8,$9,
             'closure_lock','EXE-09 human-approved closure fixture',
             NOW() + INTERVAL '1 day',$10,$11)`,
    [
      decisionId,
      h.orgAId,
      initiativeId,
      caseId,
      digest,
      JSON.stringify([`initiative:${initiativeId}:execution-evidence`]),
      proposalVersionId,
      reviewId,
      h.userAId,
      `closure_${initiativeId}`,
      randomBytes(32).toString('hex'),
    ]
  );
  const result = await executeInitiativeTransition({
    orgId: h.orgAId,
    initiativeId,
    actorId: h.userAId,
    actorRole: 'ADMIN',
    nextStatusInput: 'DONE',
  });
  // Success shape is FLAT: { ok: true, id, status, previousStatus, gate,
  // correlationId } — NOT { ok: true, body: {...} } (that nested shape is
  // only used on the error path, { ok: false, statusCode, body }).
  if (!result.ok) {
    throw new Error(`closeInitiative failed: ${JSON.stringify(result)}`);
  }
  const correlationId = (result as { correlationId?: string }).correlationId;
  if (!correlationId) throw new Error('closeInitiative: no correlationId in response');
  return correlationId;
}

/**
 * `closeInitiative` (via the real `executeInitiativeTransition`) ALWAYS
 * fires `triggerImmediateDeliveryBestEffort` as an un-awaited background
 * call. A test that also calls `attemptDeliveryInternal` explicitly right
 * after is therefore unknowingly racing that background call for the SAME
 * receipt — `claimLeg` correctly guarantees only one of them does real work
 * (no double-delivery either way), but if the test's OWN call happens to be
 * the one that loses the claim, its raw return value reflects a snapshot
 * from BEFORE the real winner (the background trigger) finishes, not the
 * final state. Calling `attemptDeliveryInternal` once (to guarantee at
 * least one attempt happens deterministically) and then polling
 * `getReceiptById` until both legs reach a terminal status sidesteps this
 * regardless of which of the two racers actually wins.
 */
async function deliverAndFetch(
  h: Harness,
  correlationId: string,
  opts?: Parameters<typeof attemptDeliveryInternal>[1]
): Promise<NonNullable<Awaited<ReturnType<typeof getReceiptById>>>> {
  await attemptDeliveryInternal(correlationId, opts);
  const TERMINAL_RESULTS = new Set(['DELIVERED', 'FAILED']);
  const TERMINAL_FINANCE = new Set(['DELIVERED', 'FAILED', 'NEEDS_DECISION']);
  for (let attempt = 0; attempt < 20; attempt++) {
    const receipt = await getReceiptById(correlationId, h.orgAId);
    if (
      receipt &&
      TERMINAL_RESULTS.has(receipt.resultsStatus) &&
      TERMINAL_FINANCE.has(receipt.financeStatus)
    ) {
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`deliverAndFetch: receipt ${correlationId} never reached a terminal state`);
}

describe('EXE-09 closure delivery receipt (real Postgres)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — exe009-closure-delivery-receipt ' +
        'realdb tests skipped. Set DATABASE_URL / PGHOST to a migrated Postgres to exercise this suite.'
    );
  }

  beforeAll(async () => {
    harness = await setupHarness();
    if (!harness) emitSkipOnce();
  }, 30_000);

  afterAll(async () => {
    if (harness) {
      await harness.cleanup();
      harness = null;
    }
  });

  // Mirrors the `itDB` convention in the sibling EXE-08 realdb golden-flow
  // file: when the harness is unavailable, report a clean vacuous pass
  // instead of failing a run on a machine with no Postgres configured.
  const itDB = (name: string, fn: (h: Harness) => Promise<void>, timeoutMs = 20_000) =>
    it(
      name,
      async () => {
        if (!harness) {
          expect(true).toBe(true);
          return;
        }
        await fn(harness);
      },
      timeoutMs
    );

  itDB(
    'golden flow: closure creates exactly one receipt; Results delivers a real benefit row; Finance ALWAYS resolves NEEDS_DECISION (Codex round 4 — no approval process exists, so an observed measurement is never auto-booked)',
    async (h) => {
      // Deliberately DIFFERENT numbers for the planned target (Results leg,
      // 15000) vs. the observed candidate measurement (Finance leg, 12500) —
      // proves the two never collapse into the same figure, and proves the
      // measurement's mere existence never becomes an automatic realization.
      const initiativeId = await h.makeInitiative('golden', {
        budgetCurrency: 'PLN',
        kpiTargetValue: 15000,
        monetaryMeasurement: { value: 12500 },
      });

      const correlationId = await closeInitiative(h, initiativeId);

      // Causation/audit consistency (contract point 9 + test item 13): the
      // receipt's PK IS the same correlationId as initiative_status_history's
      // row for this exact transition.
      const historyRow = await h.client.query(
        `SELECT id, initiative_id, from_status, to_status FROM initiative_status_history WHERE id = $1`,
        [correlationId]
      );
      expect(historyRow.rows).toHaveLength(1);
      expect(historyRow.rows[0].initiative_id).toBe(initiativeId);
      expect(historyRow.rows[0].to_status).toBe('DONE');

      const countBefore = await h.client.query(
        `SELECT COUNT(*)::int AS n FROM closure_delivery_receipts WHERE initiative_id = $1`,
        [initiativeId]
      );
      expect(countBefore.rows[0].n).toBe(1);

      const receipt = await getReceiptById(correlationId, h.orgAId);
      expect(receipt).not.toBeNull();
      expect(receipt!.id).toBe(correlationId);
      expect(receipt!.initiativeId).toBe(initiativeId);
      expect(receipt!.organizationId).toBe(h.orgAId);

      // Deliver deterministically — closeInitiative's real transition ALSO
      // fires a background best-effort trigger for this same receipt, racing
      // this explicit call; deliverAndFetch polls to a terminal state
      // regardless of which of the two racers actually does the work.
      const delivered = await deliverAndFetch(h, correlationId);
      expect(delivered.resultsStatus).toBe('DELIVERED');
      expect(delivered.resultsPayload?.benefitIds).toBeInstanceOf(Array);
      expect((delivered.resultsPayload!.benefitIds as string[]).length).toBeGreaterThan(0);

      // Finance: NEVER auto-realized, no matter how clean the measurement
      // looks. This codebase has no approval/sign-off process for a
      // measurement — the candidate is surfaced for transparency only.
      expect(delivered.financeStatus).toBe('NEEDS_DECISION');
      expect(delivered.financePayload?.reason).toBe('MEASUREMENT_REQUIRES_APPROVAL');
      expect(delivered.financePayload?.candidateAmount).toBe(12500);
      expect(delivered.financePayload?.candidateCurrency).toBe('PLN');
      expect(delivered.financeLastError).toMatch(/approval|decision/i);

      // Canonical downstream: roi_realized_values, read by the REAL Benefits/
      // ROI UI (src/components/Benefits/ROITrackingPanel.tsx via
      // GET /benefits/roi/portfolio/summary) — zero rows, always, from this
      // automatic path.
      const realization = await h.client.query(
        `SELECT id FROM roi_realized_values WHERE closure_receipt_id = $1`,
        [correlationId]
      );
      expect(realization.rows).toHaveLength(0);

      // The candidate genuinely correlates to a real kpi_time_series row — a
      // human deciding to approve it later has a real id to look up, not a
      // fabricated one.
      const measurementRow = await h.client.query(
        `SELECT id FROM kpi_time_series WHERE initiative_id = $1`,
        [initiativeId]
      );
      expect(delivered.financePayload?.candidateMeasurementId).toBe(measurementRow.rows[0].id);

      const benefitRow = await h.client.query(
        `SELECT id, source_tag, kpi_id, source_initiative_kpi_id FROM initiative_benefits WHERE initiative_id = $1`,
        [initiativeId]
      );
      expect(benefitRow.rows).toHaveLength(1);
      expect(benefitRow.rows[0].source_tag).toBe('M14_CLOSURE_HANDOFF');
      expect(benefitRow.rows[0].kpi_id).toBeNull();
      expect(benefitRow.rows[0].source_initiative_kpi_id).toBeTruthy();
    }
  );

  itDB(
    'identical retry produces the SAME downstream ids, never a duplicate row; Finance stays NEEDS_DECISION with the same candidate every time',
    async (h) => {
      const initiativeId = await h.makeInitiative('retry', {
        budgetCurrency: 'PLN',
        kpiTargetValue: 5000,
        monetaryMeasurement: { value: 4200 },
      });
      const correlationId = await closeInitiative(h, initiativeId);

      // First call resolves the race against closeInitiative's own background
      // trigger deterministically; by the time it returns terminal, the
      // second/third calls are genuine no-op retries (no more race exists).
      const first = await deliverAndFetch(h, correlationId);
      const second = await attemptDeliveryInternal(correlationId);
      const third = await retryDeliveryForOrg(correlationId, h.orgAId);

      expect(first.resultsPayload?.benefitIds).toEqual(second.resultsPayload?.benefitIds);
      expect(second.resultsPayload?.benefitIds).toEqual(third.resultsPayload?.benefitIds);
      expect(first.financeStatus).toBe('NEEDS_DECISION');
      expect(second.financeStatus).toBe('NEEDS_DECISION');
      expect(third.financeStatus).toBe('NEEDS_DECISION');
      expect(first.financePayload?.candidateMeasurementId).toBe(
        second.financePayload?.candidateMeasurementId
      );
      expect(second.financePayload?.candidateMeasurementId).toBe(
        third.financePayload?.candidateMeasurementId
      );

      const benefitCount = await h.client.query(
        `SELECT COUNT(*)::int AS n FROM initiative_benefits WHERE initiative_id = $1`,
        [initiativeId]
      );
      expect(benefitCount.rows[0].n).toBe(1);
      const realizationCount = await h.client.query(
        `SELECT COUNT(*)::int AS n FROM roi_realized_values WHERE closure_receipt_id = $1`,
        [correlationId]
      );
      expect(realizationCount.rows[0].n).toBe(0);
    }
  );

  itDB(
    'multiple planned Initiative KPIs create one durable Results benefit each and remain idempotent',
    async (h) => {
      const initiativeId = await h.makeInitiative('multi-kpi', {
        budgetCurrency: 'PLN',
        kpiTargetValue: 5000,
      });
      const secondKpiId = `kpi_second_${initiativeId}`;
      await h.client.query(
        `INSERT INTO initiative_kpis (id, initiative_id, name, target_value, unit)
       VALUES ($1, $2, 'Second realized value', 2500, 'PLN')`,
        [secondKpiId, initiativeId]
      );

      const correlationId = await closeInitiative(h, initiativeId);
      const first = await deliverAndFetch(h, correlationId);
      const retry = await attemptDeliveryInternal(correlationId);

      expect(first.resultsStatus).toBe('DELIVERED');
      expect(retry.resultsPayload?.benefitIds).toEqual(first.resultsPayload?.benefitIds);
      const rows = await h.client.query(
        `SELECT kpi_id, source_initiative_kpi_id
         FROM initiative_benefits
        WHERE initiative_id = $1
        ORDER BY source_initiative_kpi_id`,
        [initiativeId]
      );
      expect(rows.rows).toHaveLength(2);
      expect(rows.rows.every((row) => row.kpi_id === null)).toBe(true);
      expect(rows.rows.map((row) => row.source_initiative_kpi_id)).toEqual(
        [`kpi_${initiativeId}`, secondKpiId].sort()
      );
    }
  );

  itDB(
    'TWO CONCURRENT attemptDeliveryInternal calls on the SAME receipt never double-write ' +
      '(adversarial-review regression test for the claimLeg race fix). No currency-matched ' +
      'measurement on this receipt, so the Finance leg correctly resolves to NEEDS_DECISION, ' +
      'not a fabricated value — this test is about claimLeg atomicity, not the Finance fix.',
    async (h) => {
      // NOTE (Codex review round 3 — discovered while re-testing, out of
      // THIS round's scope): the original version of this test used
      // `kpiTargetValue: null` + `expectedRoi` to force
      // `executionResultsBridge.handoffFromInitiativeFallback`'s no-KPI path
      // — the one Results-leg branch with no DB unique-index backstop
      // (pre-migration-936). That path's OWN query
      // (`SELECT COALESCE(title, name) AS name, expected_roi FROM
      // initiatives...`) references a `title` column that does not exist in
      // this schema — a genuine, PRE-EXISTING bug in frozen
      // executionResultsBridge.ts (confirmed via `git diff` that EXE-09 has
      // never touched this file), silently swallowed by `dbGet`'s
      // `fallback: true` default, making the fallback path a permanent
      // silent no-op in this environment. Not fixed here — out of scope for
      // this round (Finance target-vs-actual) and out of scope for
      // single-writer discipline on a frozen file; flagged in the
      // completion report as a NEEDS_FOLLOWUP for a future M14→M15 fix.
      // This test now uses a real `initiative_kpis` target instead (still
      // exercises claimLeg's atomicity for the Results leg; the DB-backstop
      // -less code path is separately proven safe by the standalone repro
      // documented in the round-1/round-2 adversarial review).
      const { initiativeId, correlationId } = await h.seedClosedInitiativeWithReceipt('race', {
        budgetCurrency: 'PLN',
        kpiTargetValue: 12000,
        kpiUnit: 'count', // non-monetary unit — Finance must stay NEEDS_DECISION regardless.
      });

      // Both promises are awaited together, but each one's OWN returned
      // snapshot reflects whatever the row looked like at the moment THAT
      // specific call finished — the loser can finish (having done no real
      // work) before the winner commits its terminal UPDATE, so asserting on
      // `a`/`b` directly would be racy. Wait for both, then re-read fresh —
      // by the time `Promise.all` resolves, every write from BOTH calls has
      // already committed.
      await Promise.all([
        attemptDeliveryInternal(correlationId),
        attemptDeliveryInternal(correlationId),
      ]);
      const final = await getReceiptById(correlationId, h.orgAId);

      expect(final!.resultsStatus).toBe('DELIVERED');
      // No currency-matched KPI on this initiative (no KPI at all) — Finance
      // correctly resolves to NEEDS_DECISION. expected_roi is NOT used for
      // Finance (BLOCKER2); it's only relevant to the Results leg's own
      // pre-existing fallback (executionResultsBridge.ts), exercised below.
      expect(final!.financeStatus).toBe('NEEDS_DECISION');

      const benefitRows = await h.client.query(
        `SELECT id FROM initiative_benefits WHERE initiative_id = $1`,
        [initiativeId]
      );
      expect(benefitRows.rows).toHaveLength(1);

      const realizationRows = await h.client.query(
        `SELECT id FROM roi_realized_values WHERE closure_receipt_id = $1`,
        [correlationId]
      );
      expect(realizationRows.rows).toHaveLength(0);
    }
  );

  itDB(
    'two concurrent closure attempts on the same initiative: exactly one succeeds, exactly one receipt exists',
    async (h) => {
      const initiativeId = await h.makeInitiative('concurrent', {
        budgetCurrency: 'PLN',
        kpiTargetValue: 1000,
      });

      const results = await Promise.allSettled([
        closeInitiative(h, initiativeId),
        closeInitiative(h, initiativeId),
      ]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      // The engine's own row-lock + currentStatus check (frozen, not this
      // packet's code) is what guarantees this — EXE-09 only needs to confirm
      // its OWN receipt table never ends up with two rows regardless.
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const receiptCount = await h.client.query(
        `SELECT COUNT(*)::int AS n FROM closure_delivery_receipts WHERE initiative_id = $1`,
        [initiativeId]
      );
      expect(receiptCount.rows[0].n).toBe(1);
    }
  );

  itDB(
    'Results leg fails while Finance leg still resolves independently (to NEEDS_DECISION — a leg failure never blocks the other leg)',
    async (h) => {
      const { initiativeId, correlationId } = await h.seedClosedInitiativeWithReceipt(
        'results-fail',
        {
          budgetCurrency: 'PLN',
          kpiTargetValue: 2500,
          monetaryMeasurement: { value: 2100 },
        }
      );

      const outcome = await attemptDeliveryInternal(correlationId, {
        __testForceResultsError: new Error('injected Results failure'),
      });

      expect(outcome.resultsStatus).toBe('FAILED');
      expect(outcome.resultsLastError).toContain('injected Results failure');
      expect(outcome.financeStatus).toBe('NEEDS_DECISION');
      expect(outcome.financePayload?.candidateAmount).toBe(2100);

      // Retrying without the injected fault heals only the failed leg — the
      // already-terminal Finance leg is untouched (claimLeg won't re-claim a
      // NEEDS_DECISION leg; it is terminal, same as DELIVERED).
      const healed = await attemptDeliveryInternal(correlationId);
      expect(healed.resultsStatus).toBe('DELIVERED');
      expect(healed.financeStatus).toBe('NEEDS_DECISION');
      const actualCount = await h.client.query(
        `SELECT COUNT(*)::int AS n FROM roi_realized_values WHERE closure_receipt_id = $1`,
        [correlationId]
      );
      expect(actualCount.rows[0].n).toBe(0);
    }
  );

  itDB(
    'Finance leg fails (transient downstream error while looking up a candidate) while Results leg still delivers independently; the failure remains retryable',
    async (h) => {
      const { initiativeId, correlationId } = await h.seedClosedInitiativeWithReceipt(
        'finance-fail',
        {
          budgetCurrency: 'PLN',
          kpiTargetValue: 3500,
          monetaryMeasurement: { value: 3100 },
        }
      );

      const outcome = await attemptDeliveryInternal(correlationId, {
        __testForceFinanceError: new Error('injected Finance failure'),
      });

      expect(outcome.financeStatus).toBe('FAILED');
      expect(outcome.financeLastError).toContain('injected Finance failure');
      expect(outcome.resultsStatus).toBe('DELIVERED');

      // A FAILED leg is retryable (claimLeg's own WHERE clause includes
      // 'FAILED') — retrying without the fault now resolves it to its real
      // terminal state, NEEDS_DECISION, never a fabricated DELIVERED.
      const healed = await attemptDeliveryInternal(correlationId);
      expect(healed.financeStatus).toBe('NEEDS_DECISION');
      expect(healed.financePayload?.candidateAmount).toBe(3100);
      const benefitCount = await h.client.query(
        `SELECT COUNT(*)::int AS n FROM initiative_benefits WHERE initiative_id = $1`,
        [initiativeId]
      );
      expect(benefitCount.rows[0].n).toBe(1);
      const realizationCount = await h.client.query(
        `SELECT COUNT(*)::int AS n FROM roi_realized_values WHERE closure_receipt_id = $1`,
        [correlationId]
      );
      expect(realizationCount.rows[0].n).toBe(0);
    }
  );

  itDB(
    'restart simulation: a receipt left PENDING (no immediate-delivery attempt ever ran) is recovered by the reconciliation sweep alone',
    async (h) => {
      // seedClosedInitiativeWithReceipt (unlike closeInitiative) never invokes
      // triggerImmediateDeliveryBestEffort at all — this IS the "process
      // crashed between closure-commit and first delivery attempt" state,
      // durable and PENDING, with nothing having touched it yet.
      const { correlationId } = await h.seedClosedInitiativeWithReceipt('restart', {
        budgetCurrency: 'PLN',
        kpiTargetValue: 4200,
        monetaryMeasurement: { value: 3900 },
      });

      const beforeSweep = await getReceiptById(correlationId, h.orgAId);
      expect(beforeSweep!.resultsStatus).toBe('PENDING');
      expect(beforeSweep!.financeStatus).toBe('PENDING');

      const sweepResult = await runReconciliationSweep(50);
      expect(sweepResult.claimed).toBeGreaterThanOrEqual(1);

      const afterSweep = await getReceiptById(correlationId, h.orgAId);
      expect(afterSweep!.resultsStatus).toBe('DELIVERED');
      expect(afterSweep!.financeStatus).toBe('NEEDS_DECISION');
    }
  );

  itDB('cross-tenant read: a receipt is invisible under the wrong organization id', async (h) => {
    const initiativeId = await h.makeInitiative('xtenant', {
      budgetCurrency: 'PLN',
      kpiTargetValue: 900,
    });
    const correlationId = await closeInitiative(h, initiativeId);

    expect(await getReceiptById(correlationId, h.orgAId)).not.toBeNull();
    expect(await getReceiptById(correlationId, h.orgBId)).toBeNull();
    expect(await getReceiptForInitiative(initiativeId, h.orgBId)).toBeNull();
  });

  itDB(
    'missing mapping: no budget_currency on the initiative -> Finance leg is NEEDS_DECISION, no fabricated value, no roi_realized_values row',
    async (h) => {
      const initiativeId = await h.makeInitiative('no-currency', {
        budgetCurrency: null,
        kpiTargetValue: 8000,
      });
      const correlationId = await closeInitiative(h, initiativeId);

      const outcome = await deliverAndFetch(h, correlationId);
      expect(outcome.resultsStatus).toBe('DELIVERED');
      expect(outcome.financeStatus).toBe('NEEDS_DECISION');
      expect(outcome.financeLastError).toMatch(/budget_currency|product decision/i);

      const actualCount = await h.client.query(
        `SELECT COUNT(*)::int AS n FROM roi_realized_values WHERE closure_receipt_id = $1`,
        [correlationId]
      );
      expect(actualCount.rows[0].n).toBe(0);
    }
  );

  itDB(
    'missing mapping: no planned KPI target and no expected_roi -> Finance leg is NEEDS_DECISION even with a currency set',
    async (h) => {
      const initiativeId = await h.makeInitiative('no-target', {
        budgetCurrency: 'EUR',
        kpiTargetValue: null,
      });
      const correlationId = await closeInitiative(h, initiativeId);

      const outcome = await deliverAndFetch(h, correlationId);
      expect(outcome.financeStatus).toBe('NEEDS_DECISION');
    }
  );

  // ---------------------------------------------------------------------
  // BLOCKER2 negative controls (Codex review round 2) — expected_roi must
  // NEVER become a monetary amount, in any of its real-world shapes.
  // ---------------------------------------------------------------------

  itDB('BLOCKER2: expected_roi="20%" never creates a Finance actual', async (h) => {
    const initiativeId = await h.makeInitiative('roi-percent-string', {
      budgetCurrency: 'PLN',
      kpiTargetValue: null,
      // expectedRoi is stored via String(...) by the harness — passing the
      // real-world shape this field actually holds in production
      // (903_expected_roi_to_text.sql: "ROI 200%" style strings), not a
      // bare number, by writing directly.
    });
    await h.client.query(`UPDATE initiatives SET expected_roi = '20%' WHERE id = $1`, [
      initiativeId,
    ]);
    const correlationId = await closeInitiative(h, initiativeId);

    const outcome = await deliverAndFetch(h, correlationId);
    expect(outcome.financeStatus).toBe('NEEDS_DECISION');
    const rows = await h.client.query(
      `SELECT id FROM roi_realized_values WHERE closure_receipt_id = $1`,
      [correlationId]
    );
    expect(rows.rows).toHaveLength(0);
  });

  itDB(
    'BLOCKER2: expected_roi="20" (bare numeric string) never creates a Finance actual — expected_roi is never read by the Finance leg at all. Codex round 4, Results-fallback regression coverage: this exact scenario (no planned KPI, a numeric expected_roi) drives executionResultsBridge.ts\'s no-KPI fallback path, previously a permanent silent no-op due to a query referencing the non-existent `initiatives.title` column — now fixed, this MUST produce a real initiative_benefits row (kpi_id IS NULL) and resultsStatus DELIVERED, never a false DELIVERED with zero rows',
    async (h) => {
      const initiativeId = await h.makeInitiative('roi-bare-number', {
        budgetCurrency: 'PLN',
        kpiTargetValue: null,
      });
      await h.client.query(`UPDATE initiatives SET expected_roi = '20' WHERE id = $1`, [
        initiativeId,
      ]);
      const correlationId = await closeInitiative(h, initiativeId);

      const outcome = await deliverAndFetch(h, correlationId);
      expect(outcome.financeStatus).toBe('NEEDS_DECISION');
      const rows = await h.client.query(
        `SELECT id FROM roi_realized_values WHERE closure_receipt_id = $1`,
        [correlationId]
      );
      expect(rows.rows).toHaveLength(0);

      // The Results-leg fallback (no KPI, numeric expected_roi) must produce a
      // REAL downstream record, never a silent no-op reported as DELIVERED.
      expect(outcome.resultsStatus).toBe('DELIVERED');
      const benefitRows = await h.client.query(
        `SELECT id, kpi_id, source_tag FROM initiative_benefits WHERE initiative_id = $1`,
        [initiativeId]
      );
      expect(benefitRows.rows).toHaveLength(1);
      expect(benefitRows.rows[0].kpi_id).toBeNull();
      expect(benefitRows.rows[0].source_tag).toBe('M14_CLOSURE_HANDOFF');
      expect(outcome.resultsPayload?.benefitIds).toEqual([benefitRows.rows[0].id]);
    }
  );

  itDB(
    'Results fallback, genuinely empty case: no planned KPI target AND no expected_roi at all -> resultsStatus DELIVERED with genuinely ZERO benefit rows (a legitimate "nothing to hand off" empty state, correctly distinguished from the silent-no-op bug class this round fixed)',
    async (h) => {
      const initiativeId = await h.makeInitiative('no-signal-at-all', {
        budgetCurrency: 'PLN',
        kpiTargetValue: null,
        expectedRoi: null,
      });
      const correlationId = await closeInitiative(h, initiativeId);

      const outcome = await deliverAndFetch(h, correlationId);
      expect(outcome.resultsStatus).toBe('DELIVERED');
      expect(outcome.resultsPayload?.benefitIds).toEqual([]);
      const benefitRows = await h.client.query(
        `SELECT id FROM initiative_benefits WHERE initiative_id = $1`,
        [initiativeId]
      );
      expect(benefitRows.rows).toHaveLength(0);
    }
  );

  itDB(
    'BLOCKER2: default/unset budget_currency alone, with no explicit monetary KPI, never creates a Finance actual',
    async (h) => {
      // budget_currency defaults to 'PLN' at the DB column-default level, but
      // that default is not a user confirmation of currency — with NOTHING
      // else (no KPI at all), Finance must stay NEEDS_DECISION.
      const initiativeId = await h.makeInitiative('default-currency-only', {
        budgetCurrency: undefined,
        kpiTargetValue: null,
      });
      const correlationId = await closeInitiative(h, initiativeId);

      const outcome = await deliverAndFetch(h, correlationId);
      expect(outcome.financeStatus).toBe('NEEDS_DECISION');
    }
  );

  itDB(
    'BLOCKER2: KPI in %, days, and count units never create a Finance actual, even with a real currency on the initiative',
    async (h) => {
      for (const unit of ['%', 'days', 'count']) {
        const initiativeId = await h.makeInitiative(`nonmonetary-${unit.replace(/[^a-z]/gi, '')}`, {
          budgetCurrency: 'PLN',
          kpiTargetValue: 50,
          kpiUnit: unit,
        });
        const correlationId = await closeInitiative(h, initiativeId);
        const outcome = await deliverAndFetch(h, correlationId);
        expect(outcome.financeStatus).toBe('NEEDS_DECISION');
        const rows = await h.client.query(
          `SELECT id FROM roi_realized_values WHERE closure_receipt_id = $1`,
          [correlationId]
        );
        expect(rows.rows).toHaveLength(0);
      }
    }
  );

  // ---------------------------------------------------------------------
  // Codex review round 3 — target-vs-actual negative controls. A round-2
  // test HERE incorrectly asserted "explicit monetary KPI TARGET creates a
  // canonical actual" (unit==budget_currency alone was treated as proof of
  // realization). That was the core semantic bug this round fixes: a target
  // is a plan, not evidence anything was achieved, and DONE status is not
  // evidence either. Replaced with Codex's required negative control #1.
  // ---------------------------------------------------------------------

  itDB(
    'TARGET-VS-ACTUAL #1: a planned monetary KPI target (unit == budget_currency) at closure, with NO measurement, creates ZERO roi_realized_values and resolves NEEDS_DECISION',
    async (h) => {
      const initiativeId = await h.makeInitiative('planned-target-only', {
        budgetCurrency: 'PLN',
        kpiTargetValue: 15000,
        kpiUnit: 'PLN',
        // Deliberately NO monetaryMeasurement — this is exactly the round-2
        // bug's trigger condition (currency-matched target, nothing else).
      });
      const correlationId = await closeInitiative(h, initiativeId);
      const outcome = await deliverAndFetch(h, correlationId);

      expect(outcome.financeStatus).toBe('NEEDS_DECISION');
      const rows = await h.client.query(
        `SELECT id FROM roi_realized_values WHERE closure_receipt_id = $1`,
        [correlationId]
      );
      expect(rows.rows).toHaveLength(0);
    }
  );

  itDB(
    'TARGET-VS-ACTUAL #3: a budget figure (initiatives.budget_currency + planned_budget/actual_budget) alone never creates a Finance actual',
    async (h) => {
      const initiativeId = await h.makeInitiative('budget-only', {
        budgetCurrency: 'PLN',
        kpiTargetValue: null,
      });
      await h.client.query(
        `UPDATE initiatives SET planned_budget_total = 100000, actual_budget_total = 100000 WHERE id = $1`,
        [initiativeId]
      );
      const correlationId = await closeInitiative(h, initiativeId);
      const outcome = await deliverAndFetch(h, correlationId);

      expect(outcome.financeStatus).toBe('NEEDS_DECISION');
      const rows = await h.client.query(
        `SELECT id FROM roi_realized_values WHERE closure_receipt_id = $1`,
        [correlationId]
      );
      expect(rows.rows).toHaveLength(0);
    }
  );

  itDB(
    'TARGET-VS-ACTUAL #4: a monetary-unit KPI with a target but explicitly NO kpi_time_series measurement never creates a Finance actual',
    async (h) => {
      const initiativeId = await h.makeInitiative('monetary-kpi-no-measurement', {
        budgetCurrency: 'PLN',
        kpiTargetValue: 8800,
        kpiUnit: 'PLN',
      });
      // Confirm no measurement exists at all for this initiative (belt and
      // braces — makeInitiative without `monetaryMeasurement` shouldn't create
      // one, but this test's whole point is that absence, so verify it).
      const preCheck = await h.client.query(
        `SELECT id FROM kpi_time_series WHERE initiative_id = $1`,
        [initiativeId]
      );
      expect(preCheck.rows).toHaveLength(0);

      const correlationId = await closeInitiative(h, initiativeId);
      const outcome = await deliverAndFetch(h, correlationId);
      expect(outcome.financeStatus).toBe('NEEDS_DECISION');
    }
  );

  itDB(
    'TARGET-VS-ACTUAL #5: even a real, currency-matched, freshly OBSERVED monetary measurement (kpi_time_series, not a target) is NEVER auto-realized — Codex round 4: no approval process exists, so it only ever surfaces as a NEEDS_DECISION candidate',
    async (h) => {
      const initiativeId = await h.makeInitiative('real-measurement', {
        budgetCurrency: 'EUR',
        kpiTargetValue: 42000, // a DIFFERENT number — proves the target is NOT what gets used.
        kpiUnit: 'EUR',
        monetaryMeasurement: { value: 12500, unit: 'EUR' },
      });
      const correlationId = await closeInitiative(h, initiativeId);
      const outcome = await deliverAndFetch(h, correlationId);
      expect(outcome.financeStatus).toBe('NEEDS_DECISION');
      expect(outcome.financePayload?.reason).toBe('MEASUREMENT_REQUIRES_APPROVAL');

      const rows = await h.client.query(
        `SELECT id FROM roi_realized_values WHERE closure_receipt_id = $1`,
        [correlationId]
      );
      expect(rows.rows).toHaveLength(0);

      // Transparency, not realization: the candidate carries the MEASUREMENT's
      // amount (12500), never the target (42000), and genuinely correlates to
      // a real kpi_time_series row — an auditor/approver can trace it.
      expect(outcome.financePayload?.candidateAmount).toBe(12500);
      expect(outcome.financePayload?.candidateCurrency).toBe('EUR');
      const measurementRow = await h.client.query(
        `SELECT id FROM kpi_time_series WHERE initiative_id = $1`,
        [initiativeId]
      );
      expect(outcome.financePayload?.candidateMeasurementId).toBe(measurementRow.rows[0].id);

      // Read-back through the SAME query the real Benefits/ROI UI uses
      // (server/src/routes/benefits.routes.ts GET /roi/portfolio/summary) —
      // zero rows for this initiative; nothing was ever booked automatically.
      const summary = await h.client.query(
        `SELECT initiative_id FROM roi_realized_values WHERE organization_id = $1 AND initiative_id = $2`,
        [h.orgAId, initiativeId]
      );
      expect(summary.rows).toHaveLength(0);
    }
  );

  itDB(
    "TARGET-VS-ACTUAL #6: a measurement's age is purely informational, NEVER a gate (Codex round 4 removed the old 180-day recency window entirely) — a very old measurement still surfaces as a NEEDS_DECISION candidate, with its real age reported, and is NEVER auto-realized either way",
    async (h) => {
      const initiativeId = await h.makeInitiative('stale-measurement', {
        budgetCurrency: 'PLN',
        kpiTargetValue: null,
        monetaryMeasurement: { value: 9000, ageDays: 400 }, // used to be past the old 180-day gate.
      });
      const correlationId = await closeInitiative(h, initiativeId);
      const outcome = await deliverAndFetch(h, correlationId);

      expect(outcome.financeStatus).toBe('NEEDS_DECISION');
      expect(outcome.financePayload?.reason).toBe('MEASUREMENT_REQUIRES_APPROVAL');
      expect(outcome.financePayload?.candidateAmount).toBe(9000);
      // ageDays is real/informational — a stale measurement is not hidden,
      // just never auto-booked (same terminal outcome as a fresh one).
      expect(Number(outcome.financePayload?.candidateAgeDays)).toBeGreaterThanOrEqual(399);
      const rows = await h.client.query(
        `SELECT id FROM roi_realized_values WHERE closure_receipt_id = $1`,
        [correlationId]
      );
      expect(rows.rows).toHaveLength(0);
    }
  );

  itDB(
    'TARGET-VS-ACTUAL #7: a measurement recorded under a DIFFERENT organization is never picked up cross-tenant (zero leak)',
    async (h) => {
      const initiativeId = await h.makeInitiative('foreign-tenant-measurement', {
        budgetCurrency: 'PLN',
        kpiTargetValue: null,
        // The measurement row itself claims org B, even though the KPI/
        // initiative genuinely belong to org A — a deliberate data-integrity
        // probe: the query's own organization_id filter, not just the
        // initiative_id join, must be what keeps this from leaking.
        monetaryMeasurement: { value: 5000, organizationId: h.orgBId },
      });
      const correlationId = await closeInitiative(h, initiativeId);
      const outcome = await deliverAndFetch(h, correlationId);

      expect(outcome.financeStatus).toBe('NEEDS_DECISION');
      expect(outcome.financePayload?.reason).toBe('NO_MONETARY_MEASUREMENT');
      expect(outcome.financePayload?.candidateMeasurementId).toBeUndefined();
      const rows = await h.client.query(
        `SELECT id FROM roi_realized_values WHERE closure_receipt_id = $1`,
        [correlationId]
      );
      expect(rows.rows).toHaveLength(0);
    }
  );

  // ---------------------------------------------------------------------
  // BLOCKER4 — tenant-safe split: the ORG-CHECKED entry point must reject a
  // wrong organization id, not just the read-only getters.
  // ---------------------------------------------------------------------

  itDB(
    'BLOCKER4: retryDeliveryForOrg rejects a receipt under the wrong organization id (service layer)',
    async (h) => {
      const initiativeId = await h.makeInitiative('retry-xtenant', {
        budgetCurrency: 'PLN',
        kpiTargetValue: 700,
      });
      const correlationId = await closeInitiative(h, initiativeId);

      await expect(retryDeliveryForOrg(correlationId, h.orgBId)).rejects.toThrow();
      // Confirm it's genuinely a no-op for the foreign org — the real owner's
      // view of the receipt is untouched by the rejected attempt.
      const stillThere = await getReceiptById(correlationId, h.orgAId);
      expect(stillThere).not.toBeNull();
    }
  );

  // ---------------------------------------------------------------------
  // BLOCKER3 — route-level RBAC for POST /closure-receipt/retry, reusing
  // the exact CLOSURE_APPROVER_ROLES gate `/approve` uses. Real HTTP
  // requests through the actual Express router (supertest), not a service
  // -level unit test — this is what a real client experiences.
  // ---------------------------------------------------------------------

  itDB('BLOCKER3: a plain MEMBER (not an initiative owner) gets 403 on retry', async (h) => {
    const initiativeId = await h.makeInitiative('rbac-member', {
      budgetCurrency: 'PLN',
      kpiTargetValue: 300,
    });
    await closeInitiative(h, initiativeId);
    const app = buildApp();

    const res = await request(app)
      .post(`/api/initiatives/${initiativeId}/closure-receipt/retry`)
      .set('Authorization', `Bearer ${makeE2EToken(h.userMemberId, h.orgAId, 'MEMBER')}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CLOSURE_APPROVER_ROLE_REQUIRED');
  });

  itDB('BLOCKER3: an ADMIN (closure-approver role) can retry successfully', async (h) => {
    const initiativeId = await h.makeInitiative('rbac-admin', {
      budgetCurrency: 'PLN',
      kpiTargetValue: 300,
    });
    await closeInitiative(h, initiativeId);
    const app = buildApp();

    const res = await request(app)
      .post(`/api/initiatives/${initiativeId}/closure-receipt/retry`)
      .set('Authorization', `Bearer ${makeE2EToken(h.userAId, h.orgAId, 'ADMIN')}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.receipt).toBeTruthy();
  });

  itDB(
    'BLOCKER3/4: an initiative in a DIFFERENT organization 404s on retry, never a leaky 403',
    async (h) => {
      const initiativeId = await h.makeInitiative('rbac-xtenant', {
        budgetCurrency: 'PLN',
        kpiTargetValue: 300,
      });
      await closeInitiative(h, initiativeId);
      const app = buildApp();

      // userBId is a real ADMIN — but in orgB, and this initiative is in orgA.
      const res = await request(app)
        .post(`/api/initiatives/${initiativeId}/closure-receipt/retry`)
        .set('Authorization', `Bearer ${makeE2EToken(h.userBId, h.orgBId, 'ADMIN')}`)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('INITIATIVE_NOT_FOUND');
    }
  );

  // ---------------------------------------------------------------------
  // Codex review round 3 canonical read-back test — its ORIGINAL premise
  // (a closure-triggered candidate measurement automatically becomes a
  // realized actual, visible through the real Benefits/ROI route) is
  // INVALID under round 4's fix: the Finance leg never auto-realizes
  // anything anymore. Rewritten (round 4) to prove the honest inverse of
  // that claim through the SAME real route: a closure with a clean
  // candidate measurement must NOT appear as a realized benefit through the
  // real GET /api/benefits/roi/portfolio/summary route — no false actual
  // ever reaches the real Finance/Benefits UI via this automatic path.
  // ---------------------------------------------------------------------

  itDB(
    'canonical NON-read-back: a closure with a real candidate measurement does NOT appear as a realized benefit through the REAL GET /api/benefits/roi/portfolio/summary route — Finance never auto-realizes, confirmed via the real read model, not just SQL',
    async (h) => {
      const initiativeId = await h.makeInitiative('read-back', {
        budgetCurrency: 'PLN',
        kpiTargetValue: 99999, // a different number — proves the route never echoes the target either.
        kpiUnit: 'PLN',
        monetaryMeasurement: { value: 7300 },
      });
      // `GET /roi/portfolio/summary` derives its item list from `roi_assumptions`
      // (real route behavior, confirmed by reading benefits.routes.ts) — a
      // minimal row is required for THIS initiative to appear in the response
      // at all; this is the route's own real precondition, not a test fixture
      // shortcut around it.
      await h.client.query(
        `INSERT INTO roi_assumptions (id, initiative_id, organization_id) VALUES ($1, $2, $3)`,
        [`roiassum_${initiativeId}`, initiativeId, h.orgAId]
      );

      const correlationId = await closeInitiative(h, initiativeId);
      const delivered = await deliverAndFetch(h, correlationId);
      expect(delivered.financeStatus).toBe('NEEDS_DECISION');
      expect(delivered.financePayload?.reason).toBe('MEASUREMENT_REQUIRES_APPROVAL');

      // Zero rows via SQL...
      const realizationRow = await h.client.query(
        `SELECT id FROM roi_realized_values WHERE closure_receipt_id = $1`,
        [correlationId]
      );
      expect(realizationRow.rows).toHaveLength(0);

      // ...and confirmed through the REAL route a human/UI actually uses: no
      // realized benefit shown for this initiative, even though a clean,
      // currency-matched, freshly observed candidate measurement exists.
      const app = buildApp();
      const res = await request(app)
        .get('/api/benefits/roi/portfolio/summary')
        .set('Authorization', `Bearer ${makeE2EToken(h.userAId, h.orgAId, 'ADMIN')}`);

      expect(res.status).toBe(200);
      const item = res.body?.data?.items?.find(
        (i: { initiativeId: string }) => i.initiativeId === initiativeId
      );
      // Either the initiative doesn't appear as having a realized benefit at
      // all, or it appears with hasRealized=false / zero — either shape is
      // acceptable, but a truthy realized amount is not.
      if (item) {
        expect(item.hasRealized).toBeFalsy();
        expect(item.realizedBenefit || 0).toBe(0);
      }

      // The candidate itself IS genuinely traceable, for whenever a human
      // reviews and approves it through the existing manual Record
      // Realization flow.
      const measurementRow = await h.client.query(
        `SELECT id FROM kpi_time_series WHERE initiative_id = $1`,
        [initiativeId]
      );
      expect(delivered.financePayload?.candidateMeasurementId).toBe(measurementRow.rows[0].id);
      expect(delivered.financePayload?.candidateAmount).toBe(7300);
    }
  );
});
