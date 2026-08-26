import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import type {
  PlannedWindow,
  PlanScenario,
} from '../../../server/src/domain/initiatives-execution/planScenario';
import { solvePlanScenario } from '../../../server/src/domain/initiatives-execution/planSolver';
import defaultRuntimeRouter, {
  createInitiativesExecutionRuntimeRouter,
} from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';

const databaseUrl = process.env.DATABASE_URL?.trim();
// FIX-2 (day 21 fixes): this file shares `ie_aggregate_state` and friends
// with every other `*.realdb.test.ts` file. Several neighbors run an
// unscoped `TRUNCATE ie_aggregate_state, ...` in their own beforeEach (e.g.
// materialCommand.realdb.test.ts) with no WHERE clause — Postgres TRUNCATE
// can't be scoped by organization_id. Under the workspace vitest config
// (`pool: 'forks'`, `fileParallelism: true`), those files execute
// concurrently with this one in separate processes against the SAME live
// database, so a neighbor's TRUNCATE can (a) collide with an in-flight
// INSERT/SELECT here and raise a Postgres deadlock (40P01) / serialization
// failure (40001), or (b) silently wipe the rows `seed()` just wrote right
// before this file reads them back, failing an assertion with no Postgres
// error at all. In isolation (this file alone) neither happens, so 5/5
// passes; under the full suite it flakes.
//
// Two ways to make this file immune: (a) run it against its own dedicated
// Postgres schema (own `search_path`, own migration run, zero shared
// tables) — fully isolates it from any neighbor's TRUNCATE, at the cost of
// running the full migration set an extra time per test run; or (b) accept
// the shared schema and make the flake self-heal via retry. We picked (b):
// it's materially cheaper (no extra migration run, no schema
// provisioning/teardown) and is sufficient here because every DB-touching
// test in this file is deterministic and idempotent — `seed()` is an
// upsert, and the HTTP call + readback have no side effects that change
// across attempts. `describe.sequential` pins this file's own tests to run
// in-order (defends against a global `sequence.concurrent` override ever
// being flipped on for this suite).
//
// For the retry itself we deliberately do NOT use vitest's native
// `{ retry }` test option: it re-runs immediately with no delay, and a
// first pass showed that back-to-back immediate attempts can all land
// inside the same "hot" burst of a neighbor's TRUNCATE calls (several
// other realdb files TRUNCATE once per test, and with a handful of files
// racing concurrently that adds up to a TRUNCATE every ~100-200ms for
// much of the run) — 4 of 5 immediate retries still failed with a 404
// because `seed()`'s freshly-committed `ie_aggregate_state` row for our
// `plan_scenario` aggregate got wiped by a neighbor's TRUNCATE before the
// route's own read of it. `withDbFlakeRetry` below instead re-runs the
// full test body (re-seed included) with a small randomized backoff
// between attempts, so consecutive attempts land at different points on
// the timeline instead of clustering in the same short window. A genuine
// logic bug still stays red on every attempt, since seed()+request+assert
// are deterministic — retry only masks *transient* neighbor interference,
// which differs attempt to attempt, never a repeatable assertion mismatch.
const describeRealDb = databaseUrl ? describe.sequential : describe.skip;
const organizationId = 'day21-solver-org';

/**
 * Re-runs `fn` up to `attempts` times with randomized backoff between
 * tries, swallowing any thrown error (Postgres deadlock/serialization
 * errors as well as assertion failures) until the final attempt, which
 * re-throws so the test still fails loudly if every attempt fails.
 */
async function withDbFlakeRetry<T>(fn: () => Promise<T>, attempts = 10): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const backoffMs = 120 * attempt + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw lastError;
}
const portfolioId = 'day21-portfolio';
const planId = 'day21-plan-50x4';

const periods = [1, 2, 3, 4].map((quarter) => ({
  periodId: `Q${quarter}`,
  start: `2026-${String((quarter - 1) * 3 + 1).padStart(2, '0')}-01T00:00:00.000Z`,
  end: `2026-${String(quarter * 3).padStart(2, '0')}-28T23:59:59.999Z`,
}));

const windows: PlannedWindow[] = Array.from({ length: 50 }, (_, index) => {
  const period = periods[index % periods.length];
  const day = String((index % 20) + 1).padStart(2, '0');
  return {
    initiativeId: `initiative-${String(index + 1).padStart(2, '0')}`,
    initiativeVersion: 1,
    earliest: null,
    target: `${period.start.slice(0, 8)}${day}T12:00:00.000Z`,
    latest: null,
    confidence: 'HIGH',
    rationale: `Target backed by source ${index + 1}.`,
    dependencySnapshot: [],
    constraintSnapshot: [],
  };
});

const plan: PlanScenario = {
  scenarioId: planId,
  scenarioVersion: 1,
  status: 'DRAFT',
  portfolioScenarioId: portfolioId,
  portfolioScenarioVersion: 1,
  windowUnit: 'FTE',
  timezone: 'UTC',
  periods,
  windows,
  assumptions: ['Targets supplied by portfolio owners.'],
  createdBy: 'day21-user',
  updatedBy: 'day21-user',
  publishedBy: null,
  publishedAt: null,
};

const legacyDistribution = (scenario: PlanScenario) =>
  scenario.windows.reduce<Record<string, number>>((counts, _window, index) => {
    const period = scenario.periods[Math.min(index, scenario.periods.length - 1)];
    if (period) counts[period.periodId] = (counts[period.periodId] ?? 0) + 1;
    return counts;
  }, {});

describeRealDb('Day 21 deterministic solver 50 initiatives x 4 periods', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 4 });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: req.header('x-test-user') ?? 'day21-user',
      organizationId: req.header('x-test-org') ?? organizationId,
      role: req.header('x-test-role') ?? 'USER',
    };
    next();
  });
  app.use(
    '/runtime-v1',
    createInitiativesExecutionRuntimeRouter({
      unitOfWork: new PostgresMaterialCommandUnitOfWork(pool),
      reader: new PostgresInitiativeReader(pool),
      authorize: async (actor, projectId) =>
        actor.organizationId === organizationId && projectId === 'day21-project',
      resolvePolicy: async () => ({
        policyId: 'day21-policy',
        version: 1,
        baseline: 'STANDARD',
        strictness: 3,
        source: 'PROJECT',
        config: { selfApproval: false },
      }),
    })
  );
  app.use('/default-runtime-v1', defaultRuntimeRouter);

  afterAll(async () => {
    for (const table of [
      'ie_outbox_delivery_receipts',
      'ie_outbox_events',
      'ie_audit_events',
      'ie_command_receipts',
      'ie_aggregate_relations',
      'ie_aggregate_state',
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [organizationId]);
    }
    await pool.end();
  });

  const seed = async (scenario = plan) => {
    await pool.query(
      `INSERT INTO ie_aggregate_state
         (organization_id, aggregate_type, aggregate_id, version, payload_json)
       VALUES ($1, 'portfolio_scenario', $2, 1, $3::jsonb),
              ($1, 'plan_scenario', $4, 1, $5::jsonb)
       ON CONFLICT (organization_id, aggregate_type, aggregate_id)
       DO UPDATE SET version=EXCLUDED.version, payload_json=EXCLUDED.payload_json`,
      [
        organizationId,
        portfolioId,
        JSON.stringify({
          scenarioId: portfolioId,
          scenarioVersion: 1,
          status: 'PUBLISHED',
          scope: { portfolioId: 'day21-project' },
        }),
        scenario.scenarioId,
        JSON.stringify(scenario),
      ]
    );
  };

  it('proves 47/50 collapsed before and only 12/50 occupy Q4 after', () => {
    const before = legacyDistribution(plan);
    const first = solvePlanScenario(plan);
    const second = solvePlanScenario(plan);
    const after = first.assignments.reduce<Record<string, number>>((counts, item) => {
      counts[item.periodId] = (counts[item.periodId] ?? 0) + 1;
      return counts;
    }, {});

    expect(before).toEqual({ Q1: 1, Q2: 1, Q3: 1, Q4: 47 });
    expect(after).toEqual({ Q1: 13, Q2: 13, Q3: 12, Q4: 12 });
    expect(after.Q4).toBeLessThan(25);
    expect(Object.keys(after)).toHaveLength(4);
    expect(first).toEqual(second);
  });

  it('persists the HTTP proposal and proves its readback with an independent pool', async () => {
    await withDbFlakeRetry(async () => {
      await seed();
      const response = await request(app)
        .post(`/runtime-v1/plan-scenarios/${planId}/analysis-proposals/day21-proposal-50x4`)
        .send({
          expectedVersion: 0,
          clientRequestId: 'day21-proposal-request-50x4',
          scenarioId: planId,
          inputAggregateVersion: 1,
        });
      expect(response.status).toBe(201);

      const readbackPool = new Pool({ connectionString: databaseUrl, max: 1 });
      const readback = await readbackPool.query<{ payload_json: { changes: unknown[] } }>(
        `SELECT payload_json FROM ie_aggregate_state
         WHERE organization_id=$1 AND aggregate_type='plan_analysis_proposal' AND aggregate_id=$2`,
        [organizationId, 'day21-proposal-50x4']
      );
      await readbackPool.end();
      expect(readback.rows[0]?.payload_json.changes).toHaveLength(50);
    });
  });

  it('returns 400 for an invalid command envelope', async () => {
    const response = await request(app)
      .post(`/runtime-v1/plan-scenarios/${planId}/analysis-proposals/invalid`)
      .send({ scenarioId: planId, inputAggregateVersion: 1 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns 404 for a foreign tenant even when the body names the real scenario', async () => {
    // Deterministic regardless of shared-table contamination: the router
    // short-circuits on `!authorize(...)` for the foreign org before it
    // matters whether `found`/`portfolio` were readable, so this doesn't
    // need withDbFlakeRetry.
    await seed();
    const response = await request(app)
      .post(`/runtime-v1/plan-scenarios/${planId}/analysis-proposals/foreign-proposal`)
      .set('x-test-org', 'foreign-day21-org')
      .send({
        expectedVersion: 0,
        clientRequestId: 'foreign-day21-request',
        scenarioId: planId,
        inputAggregateVersion: 1,
        organizationId,
      });
    expect(response.status).toBe(404);
  });

  it('reaches the same write through the default production dependencies', async () => {
    await withDbFlakeRetry(async () => {
      await seed();
      const response = await request(app)
        .post(
          `/default-runtime-v1/plan-scenarios/${planId}/analysis-proposals/day21-default-proposal`
        )
        .set('x-test-role', 'SUPERADMIN')
        .send({
          expectedVersion: 0,
          clientRequestId: 'day21-default-proposal-request',
          scenarioId: planId,
          inputAggregateVersion: 1,
        });
      expect(response.status).toBe(201);
      const readback = await pool.query(
        `SELECT 1 FROM ie_aggregate_state
         WHERE organization_id=$1 AND aggregate_type='plan_analysis_proposal' AND aggregate_id=$2`,
        [organizationId, 'day21-default-proposal']
      );
      expect(readback.rowCount).toBe(1);
    });
  });
});
