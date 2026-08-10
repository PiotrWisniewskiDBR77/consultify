/**
 * Golden Case harness — end-to-end scenarios over the REAL HTTP routes, the
 * REAL domain services and a REAL PostgreSQL.
 *
 * ===========================================================================
 * WHAT A GOLDEN CASE IS HERE, AND WHY IT IS DRIVEN OVER HTTP
 * ===========================================================================
 * The 17 `*.pg.test.ts` suites next door prove each service in isolation. A
 * Golden Case proves the CHAIN: Case → Plan → Run → approval/wait → Results,
 * with every step taken the way a client actually takes it, and with the
 * assertion made against Postgres and the event outbox rather than against the
 * previous call's return value.
 *
 * These go over HTTP on purpose. CW-RT-064 asks that "UI, API and real
 * database readback expose the same state and identifiers"; a scenario that
 * called the services directly would prove the services agree with themselves
 * and say nothing about the API surface a client sees. The one exception is
 * `expireWait`, which has NO route by design (scheduler-only — see
 * waitSubscriptions.routes.ts's header) and is therefore invoked as the
 * scheduler invokes it, directly.
 *
 * ---------------------------------------------------------------------------
 * The correlation chain is real
 * ---------------------------------------------------------------------------
 * `createGoldenCaseApp()` mounts `correlationMiddleware`
 * (server/src/utils/RequestStore.ts, applied globally in production at
 * server/src/index.ts:993) ahead of the router. That is what puts the
 * request's `X-Correlation-ID` into the AsyncLocalStorage that
 * `eventOutboxService.publishEvent` reads when a caller does not pass one
 * explicitly (eventOutboxService.ts:402). So sending one id for a whole
 * scenario and then finding it on every outbox row is a genuine end-to-end
 * operator-trace assertion, not a value the test wrote itself.
 *
 * ---------------------------------------------------------------------------
 * GATE
 * ---------------------------------------------------------------------------
 * Same as the contract suites — `NODE_ENV=test` alone yields a MOCK database
 * and a green suite that touched nothing. Reachability is probed and the
 * scenarios SKIP LOUDLY when the gate is not satisfied.
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://... \
 *   npx vitest run src/services/caseWorkspace/__tests__/goldenCases --environment node
 */

import express, { type Express } from 'express';
import { Pool } from 'pg';

import caseWorkspaceRoutes from '../../../../routes/caseWorkspace/index.js';
import { errorHandlerMiddleware } from '../../../../utils/ErrorHandler.js';
import { correlationMiddleware } from '../../../../utils/RequestStore.js';
import type { ContractActor } from '../../../../routes/caseWorkspace/__tests__/contract/contractHarness.js';

export {
  CONNECTION_STRING,
  ContractFixtures as GoldenCaseFixtures,
  isContractDbReachable as isGoldenCaseDbReachable,
  minimalGraph,
  warnSkipped,
  type ContractActor,
  type Fixture,
} from '../../../../routes/caseWorkspace/__tests__/contract/contractHarness.js';

export const BASE = '/api/v8/case-workspace';

/**
 * The production middleware chain that matters for these scenarios, in
 * production order: correlation context → authenticated v8 context → the real
 * case-workspace router → the real error mapper. Only the credential is
 * substituted (see contractHarness.ts's header).
 */
export function createGoldenCaseApp(actor: ContractActor): Express {
  const app = express();
  app.use(express.json());
  app.use(correlationMiddleware);
  app.use((req: any, _res, next) => {
    req.v8Context = { ...actor };
    next();
  });
  app.use(BASE, caseWorkspaceRoutes);
  app.use(errorHandlerMiddleware);
  return app;
}

/** One `case_workspace_event_outbox` row, as stored. */
export interface OutboxRow {
  event_id: string;
  event_type: string;
  schema_version: number;
  organization_id: string;
  project_id: string | null;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: number | null;
  case_id: string | null;
  run_id: string | null;
  node_run_id: string | null;
  attempt_id: string | null;
  actor_user_id: string;
  correlation_id: string;
  causation_id: string | null;
  occurred_at: string;
  redacted_summary: Record<string, unknown>;
  payload_ref: string | null;
  delivered_at: string | null;
}

/**
 * Every outbox row this organization produced, in write order, read OUT OF
 * BAND. Reading through a separate connection is load-bearing: a row read on
 * the service's own connection would be visible even if that transaction later
 * rolled back, so only an out-of-band read proves the event actually committed
 * alongside the mutation.
 */
export async function readOutboxForOrg(control: Pool, organizationId: string): Promise<OutboxRow[]> {
  const result = await control.query<OutboxRow>(
    `SELECT * FROM case_workspace_event_outbox
      WHERE organization_id = $1
      ORDER BY created_at ASC, event_id ASC`,
    [organizationId]
  );
  return result.rows;
}

export function eventTypes(rows: OutboxRow[]): string[] {
  return rows.map((r) => r.event_type);
}

/** Asserts `expected` appears in `actual` in that relative order (gaps allowed). */
export function containsInOrder(actual: string[], expected: string[]): boolean {
  let cursor = 0;
  for (const want of expected) {
    const found = actual.indexOf(want, cursor);
    if (found === -1) return false;
    cursor = found + 1;
  }
  return true;
}
