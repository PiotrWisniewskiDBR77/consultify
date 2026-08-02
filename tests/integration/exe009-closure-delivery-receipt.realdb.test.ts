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
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
}

import { executeInitiativeTransition } from '../../server/src/services/initiative/initiativeTransitionService.js';
import {
  attemptDelivery,
  getReceiptById,
  getReceiptForInitiative,
  manualRetryReceipt,
  runReconciliationSweep,
} from '../../server/src/services/closureDeliveryReceiptService.js';

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
    return { connectionString: databaseUrl, connectionTimeoutMillis: PROBE_TIMEOUT_MS, statement_timeout: 5_000 };
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
  'closure_finance_actuals',
] as const;

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface Harness {
  client: Client;
  orgAId: string;
  orgBId: string;
  userAId: string;
  projectAId: string;
  // Fresh EXECUTING initiative per scenario — created via a factory so each
  // `it()` gets its own isolated row (no shared mutable fixture races).
  makeInitiative: (
    label: string,
    opts?: { budgetCurrency?: string | null; kpiTargetValue?: number | null; kpiUnit?: string; expectedRoi?: number | null }
  ) => Promise<string>;
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
    opts?: { budgetCurrency?: string | null; kpiTargetValue?: number | null; kpiUnit?: string; expectedRoi?: number | null }
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
    throw new Error(`Schema check itself failed: ${err instanceof Error ? err.message : String(err)}`);
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
        opts.expectedRoi === undefined || opts.expectedRoi === null ? null : String(opts.expectedRoi),
      ]
    );
    if (opts.kpiTargetValue !== undefined && opts.kpiTargetValue !== null) {
      await client.query(
        `INSERT INTO initiative_kpis (id, initiative_id, name, target_value, unit)
         VALUES ($1, $2, 'Realized value', $3, $4)`,
        [`kpi_${id}`, id, opts.kpiTargetValue, opts.kpiUnit ?? budgetCurrency ?? 'PLN']
      );
    }
    return id;
  };

  const seedClosedInitiativeWithReceipt: Harness['seedClosedInitiativeWithReceipt'] = async (label, opts = {}) => {
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
      [correlationId, orgAId, initiativeId, correlationId, userAId, 'system:exe-009-closure-receipt']
    );
    return { initiativeId, correlationId };
  };

  const cleanup = async () => {
    for (const id of initiativeIds) {
      await client.query(`DELETE FROM closure_finance_actuals WHERE initiative_id = $1`, [id]).catch(() => {});
      await client.query(`DELETE FROM closure_delivery_receipts WHERE initiative_id = $1`, [id]).catch(() => {});
      await client.query(`DELETE FROM initiative_benefits WHERE initiative_id = $1`, [id]).catch(() => {});
      await client.query(`DELETE FROM initiative_kpis WHERE initiative_id = $1`, [id]).catch(() => {});
      await client.query(`DELETE FROM initiative_status_history WHERE initiative_id = $1`, [id]).catch(() => {});
      await client.query(`DELETE FROM initiative_history WHERE initiative_id = $1`, [id]).catch(() => {});
      await client.query(`DELETE FROM initiatives WHERE id = $1`, [id]).catch(() => {});
    }
    await client.query(`DELETE FROM projects WHERE id = $1`, [projectAId]).catch(() => {});
    await client.query(`DELETE FROM users WHERE id = $1`, [userAId]).catch(() => {});
    await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgAId, orgBId]]).catch(() => {});
    await client.end().catch(() => {});
  };

  return {
    client,
    orgAId,
    orgBId,
    userAId,
    projectAId,
    makeInitiative,
    seedClosedInitiativeWithReceipt,
    cleanup,
  };
}

async function closeInitiative(h: Harness, initiativeId: string): Promise<string> {
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

  itDB('golden flow: closure creates exactly one receipt, delivers Results & Finance independently, IDs shared with the audit trail', async (h) => {
    const initiativeId = await h.makeInitiative('golden', { budgetCurrency: 'PLN', kpiTargetValue: 15000 });

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

    // Deliver deterministically (not relying on the fire-and-forget
    // best-effort trigger's timing — same principle as the sibling suite's
    // own "no premature success" contract, applied to the test itself).
    const delivered = await attemptDelivery(correlationId);
    expect(delivered.resultsStatus).toBe('DELIVERED');
    expect(delivered.financeStatus).toBe('DELIVERED');
    expect(delivered.resultsPayload?.benefitIds).toBeInstanceOf(Array);
    expect((delivered.resultsPayload!.benefitIds as string[]).length).toBeGreaterThan(0);

    const financeActual = await h.client.query(
      `SELECT amount, currency, value_source FROM closure_finance_actuals WHERE closure_receipt_id = $1`,
      [correlationId]
    );
    expect(financeActual.rows).toHaveLength(1);
    expect(Number(financeActual.rows[0].amount)).toBe(15000);
    expect(financeActual.rows[0].currency).toBe('PLN');

    const benefitRow = await h.client.query(
      `SELECT id, source_tag FROM initiative_benefits WHERE initiative_id = $1`,
      [initiativeId]
    );
    expect(benefitRow.rows).toHaveLength(1);
    expect(benefitRow.rows[0].source_tag).toBe('M14_CLOSURE_HANDOFF');
  });

  itDB('identical retry produces the SAME downstream ids, never a duplicate row', async (h) => {
    const initiativeId = await h.makeInitiative('retry', { budgetCurrency: 'PLN', kpiTargetValue: 5000 });
    const correlationId = await closeInitiative(h, initiativeId);

    const first = await attemptDelivery(correlationId);
    const second = await attemptDelivery(correlationId);
    const third = await manualRetryReceipt(correlationId, h.orgAId);

    expect(first.resultsPayload?.benefitIds).toEqual(second.resultsPayload?.benefitIds);
    expect(second.resultsPayload?.benefitIds).toEqual(third.resultsPayload?.benefitIds);
    expect(first.financePayload?.financeActualId).toBe(second.financePayload?.financeActualId);
    expect(second.financePayload?.financeActualId).toBe(third.financePayload?.financeActualId);

    const benefitCount = await h.client.query(
      `SELECT COUNT(*)::int AS n FROM initiative_benefits WHERE initiative_id = $1`,
      [initiativeId]
    );
    expect(benefitCount.rows[0].n).toBe(1);
    const actualCount = await h.client.query(
      `SELECT COUNT(*)::int AS n FROM closure_finance_actuals WHERE closure_receipt_id = $1`,
      [correlationId]
    );
    expect(actualCount.rows[0].n).toBe(1);
  });

  itDB(
    'TWO CONCURRENT attemptDelivery calls on the SAME receipt never double-write, even on the ' +
      'no-DB-backstop expected_roi fallback path (adversarial-review regression test for the ' +
      'claimLeg race fix)',
    async (h) => {
      // Deliberately kpiTargetValue: null — this forces
      // executionResultsBridge.handoffFromInitiativeFallback's path, the one
      // Results-leg branch whose own dedup is application-level only
      // (SELECT-then-INSERT, no unique index prior to migration 936). Before
      // the claimLeg fix, two concurrent attemptDelivery calls could both
      // pass that SELECT and both INSERT a duplicate benefit row.
      const { initiativeId, correlationId } = await h.seedClosedInitiativeWithReceipt('race', {
        budgetCurrency: 'PLN',
        kpiTargetValue: null,
        expectedRoi: 12000,
      });

      // Both promises are awaited together, but each one's OWN returned
      // snapshot reflects whatever the row looked like at the moment THAT
      // specific call finished — the loser can finish (having done no real
      // work) before the winner commits its terminal UPDATE, so asserting on
      // `a`/`b` directly would be racy. Wait for both, then re-read fresh —
      // by the time `Promise.all` resolves, every write from BOTH calls has
      // already committed.
      await Promise.all([attemptDelivery(correlationId), attemptDelivery(correlationId)]);
      const final = await getReceiptById(correlationId, h.orgAId);

      expect(final!.resultsStatus).toBe('DELIVERED');
      expect(final!.financeStatus).toBe('DELIVERED');

      const benefitRows = await h.client.query(
        `SELECT id FROM initiative_benefits WHERE initiative_id = $1`,
        [initiativeId]
      );
      expect(benefitRows.rows).toHaveLength(1);

      const actualRows = await h.client.query(
        `SELECT id FROM closure_finance_actuals WHERE closure_receipt_id = $1`,
        [correlationId]
      );
      expect(actualRows.rows).toHaveLength(1);
    }
  );

  itDB('two concurrent closure attempts on the same initiative: exactly one succeeds, exactly one receipt exists', async (h) => {
    const initiativeId = await h.makeInitiative('concurrent', { budgetCurrency: 'PLN', kpiTargetValue: 1000 });

    const results = await Promise.allSettled([closeInitiative(h, initiativeId), closeInitiative(h, initiativeId)]);
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
  });

  itDB('Results leg fails while Finance leg still delivers independently', async (h) => {
    const { initiativeId, correlationId } = await h.seedClosedInitiativeWithReceipt('results-fail', {
      budgetCurrency: 'PLN',
      kpiTargetValue: 2500,
    });

    const outcome = await attemptDelivery(correlationId, {
      __testForceResultsError: new Error('injected Results failure'),
    });

    expect(outcome.resultsStatus).toBe('FAILED');
    expect(outcome.resultsLastError).toContain('injected Results failure');
    expect(outcome.financeStatus).toBe('DELIVERED');

    // Retrying without the injected fault heals only the failed leg — the
    // already-delivered Finance leg is untouched (idempotent no-op).
    const healed = await attemptDelivery(correlationId);
    expect(healed.resultsStatus).toBe('DELIVERED');
    expect(healed.financeStatus).toBe('DELIVERED');
    const actualCount = await h.client.query(
      `SELECT COUNT(*)::int AS n FROM closure_finance_actuals WHERE closure_receipt_id = $1`,
      [correlationId]
    );
    expect(actualCount.rows[0].n).toBe(1);
  });

  itDB('Finance leg fails while Results leg still delivers independently', async (h) => {
    const { initiativeId, correlationId } = await h.seedClosedInitiativeWithReceipt('finance-fail', {
      budgetCurrency: 'PLN',
      kpiTargetValue: 3500,
    });

    const outcome = await attemptDelivery(correlationId, {
      __testForceFinanceError: new Error('injected Finance failure'),
    });

    expect(outcome.financeStatus).toBe('FAILED');
    expect(outcome.financeLastError).toContain('injected Finance failure');
    expect(outcome.resultsStatus).toBe('DELIVERED');

    const healed = await attemptDelivery(correlationId);
    expect(healed.financeStatus).toBe('DELIVERED');
    const benefitCount = await h.client.query(
      `SELECT COUNT(*)::int AS n FROM initiative_benefits WHERE initiative_id = $1`,
      [initiativeId]
    );
    expect(benefitCount.rows[0].n).toBe(1);
  });

  itDB('restart simulation: a receipt left PENDING (no immediate-delivery attempt ever ran) is recovered by the reconciliation sweep alone', async (h) => {
    // seedClosedInitiativeWithReceipt (unlike closeInitiative) never invokes
    // triggerImmediateDeliveryBestEffort at all — this IS the "process
    // crashed between closure-commit and first delivery attempt" state,
    // durable and PENDING, with nothing having touched it yet.
    const { correlationId } = await h.seedClosedInitiativeWithReceipt('restart', {
      budgetCurrency: 'PLN',
      kpiTargetValue: 4200,
    });

    const beforeSweep = await getReceiptById(correlationId, h.orgAId);
    expect(beforeSweep!.resultsStatus).toBe('PENDING');
    expect(beforeSweep!.financeStatus).toBe('PENDING');

    const sweepResult = await runReconciliationSweep(50);
    expect(sweepResult.claimed).toBeGreaterThanOrEqual(1);

    const afterSweep = await getReceiptById(correlationId, h.orgAId);
    expect(afterSweep!.resultsStatus).toBe('DELIVERED');
    expect(afterSweep!.financeStatus).toBe('DELIVERED');
  });

  itDB('cross-tenant read: a receipt is invisible under the wrong organization id', async (h) => {
    const initiativeId = await h.makeInitiative('xtenant', { budgetCurrency: 'PLN', kpiTargetValue: 900 });
    const correlationId = await closeInitiative(h, initiativeId);

    expect(await getReceiptById(correlationId, h.orgAId)).not.toBeNull();
    expect(await getReceiptById(correlationId, h.orgBId)).toBeNull();
    expect(await getReceiptForInitiative(initiativeId, h.orgBId)).toBeNull();
  });

  itDB('missing mapping: no budget_currency on the initiative -> Finance leg is NEEDS_DECISION, no fabricated value, no closure_finance_actuals row', async (h) => {
    const initiativeId = await h.makeInitiative('no-currency', { budgetCurrency: null, kpiTargetValue: 8000 });
    const correlationId = await closeInitiative(h, initiativeId);

    const outcome = await attemptDelivery(correlationId);
    expect(outcome.resultsStatus).toBe('DELIVERED');
    expect(outcome.financeStatus).toBe('NEEDS_DECISION');
    expect(outcome.financeLastError).toMatch(/budget_currency|product decision/i);

    const actualCount = await h.client.query(
      `SELECT COUNT(*)::int AS n FROM closure_finance_actuals WHERE closure_receipt_id = $1`,
      [correlationId]
    );
    expect(actualCount.rows[0].n).toBe(0);
  });

  itDB('missing mapping: no planned KPI target and no expected_roi -> Finance leg is NEEDS_DECISION even with a currency set', async (h) => {
    const initiativeId = await h.makeInitiative('no-target', { budgetCurrency: 'EUR', kpiTargetValue: null });
    const correlationId = await closeInitiative(h, initiativeId);

    const outcome = await attemptDelivery(correlationId);
    expect(outcome.financeStatus).toBe('NEEDS_DECISION');
  });
});
