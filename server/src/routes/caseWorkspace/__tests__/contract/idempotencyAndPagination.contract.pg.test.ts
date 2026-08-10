/**
 * CONTRACT (real PostgreSQL) — idempotency, pagination and the two-step intake
 * contract behave as docs/product/case-workspace/api/openapi.yaml declares.
 *
 * Each command in this API has a DIFFERENT idempotency primitive (proposals:
 * `idempotencyKey`; waits: `correlationKey`; history/measurements/links:
 * `dedupeKey`; capability registration: the natural `(capabilityId,
 * capabilityVersion)` pair). The spec documents that per operation; this suite
 * proves each one by replaying the same request and counting ROWS in Postgres,
 * not by trusting the second response body.
 *
 * Counting rows is the point. A service can answer `201` twice and still have
 * written once, or answer `201` twice and have written twice; only the row
 * count distinguishes "idempotent" from "looks idempotent".
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Express } from 'express';

import {
  CONNECTION_STRING,
  ContractFixtures,
  createContractApp,
  type Fixture,
  isContractDbReachable,
  minimalGraph,
  warnSkipped,
} from './contractHarness.js';

const BASE = '/api/v8/case-workspace';

/**
 * Publishes a plan version for `caseId` and binds a fresh run to it, returning
 * the runId. `waitSubscriptionService.createWait` requires at least one of
 * `runId`/`actionProposalId` (`wait_target_required`), and a supplied runId
 * must already have a `case_workspace_run_bindings` row for the SAME Case
 * (`wait_run_binding_not_found` / `wait_run_binding_case_mismatch`) — so a
 * wait cannot be created against an invented run.
 */
async function bindRun(
  app: Express,
  control: Pool,
  fx: ContractFixtures,
  f: Fixture,
  caseId: string,
  label: string
): Promise<string> {
  const draft = await request(app)
    .post(`${BASE}/cases/${caseId}/plan-versions`)
    .send({ semanticGraph: minimalGraph() });
  const planId = draft.body.data.casePlanVersionId;
  const proposed = await request(app)
    .post(`${BASE}/plan-versions/${planId}/propose`)
    .send({ expectedVersion: draft.body.data.version });
  await request(app)
    .post(`${BASE}/plan-versions/${planId}/publish`)
    .send({ expectedVersion: proposed.body.data.version });
  const runId = await fx.seedExecutionRun(f.orgId, f.memberUserId, label);
  const bound = await request(app).post(`${BASE}/run-bindings`).send({ runId, casePlanVersionId: planId });
  if (bound.status !== 201) {
    throw new Error(`bindRun fixture failed: ${bound.status} ${JSON.stringify(bound.body)}`);
  }
  return runId;
}

const REACHABLE = await isContractDbReachable();
warnSkipped('caseWorkspace idempotency/pagination contract', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('CONTRACT — idempotency, pagination and intake over real Postgres', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  it('a replayed history-event append with the same Idempotency-Key writes exactly one row', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('hist-idem');
      const app = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const created = await request(app)
        .post(`${BASE}/cases`)
        .send({ projectId: f.projectId, contractedClosureType: 'DELIVERY_COMPLETED' });
      const caseId = created.body.data.caseId;

      const dedupeKey = `hist-${randomUUID()}`;
      const body = {
        eventType: 'case.contract_test',
        occurredAt: new Date().toISOString(),
        summary: 'contract test append',
      };

      const first = await request(app)
        .post(`${BASE}/cases/${caseId}/history-events`)
        .set('Idempotency-Key', dedupeKey)
        .send(body);
      const second = await request(app)
        .post(`${BASE}/cases/${caseId}/history-events`)
        .set('Idempotency-Key', dedupeKey)
        .send(body);

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      // The replay must resolve to the SAME event, not a new one.
      expect(second.body.data.eventId).toBe(first.body.data.eventId);

      const rows = await control.query(
        `SELECT event_id FROM case_workspace_history_events WHERE case_id = $1 AND dedupe_key = $2`,
        [caseId, dedupeKey]
      );
      expect(rows.rowCount).toBe(1);

      await control.query(`DELETE FROM case_workspace_history_events WHERE case_id = $1`, [caseId]);
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('a wait needs a target: neither runId nor actionProposalId is 400 WAIT_TARGET_REQUIRED', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('wait-target');
      const app = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const created = await request(app)
        .post(`${BASE}/cases`)
        .send({ projectId: f.projectId, contractedClosureType: 'DELIVERY_COMPLETED' });
      const caseId = created.body.data.caseId;

      // zod accepts this body (waitType + correlationKey is all it requires);
      // the SERVICE rejects it. Documented in the spec's CreateWaitBody note —
      // a route-schema-only reading of this endpoint would get it wrong.
      const res = await request(app)
        .post(`${BASE}/cases/${caseId}/waits`)
        .send({ waitType: 'HUMAN', correlationKey: `wait-${randomUUID()}` });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('WAIT_TARGET_REQUIRED');

      const rows = await control.query(`SELECT wait_id FROM case_workspace_waits WHERE case_id = $1`, [caseId]);
      expect(rows.rowCount).toBe(0);
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('a replayed createWait is idempotent on (caseId, correlationKey); only a waitType mismatch is 409', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('wait-idem');
      const app = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const created = await request(app)
        .post(`${BASE}/cases`)
        .send({ projectId: f.projectId, contractedClosureType: 'DELIVERY_COMPLETED' });
      const caseId = created.body.data.caseId;
      const runId = await bindRun(app, control, fx, f, caseId, 'wait-idem');

      const correlationKey = `wait-${randomUUID()}`;
      const first = await request(app)
        .post(`${BASE}/cases/${caseId}/waits`)
        .send({ waitType: 'HUMAN', correlationKey, runId });
      expect(first.status).toBe(201);
      expect(first.body.data.status).toBe('ACTIVE');

      // Replaying the SAME (correlationKey, waitType) resolves to the existing
      // wait — `INSERT ... ON CONFLICT (case_id, correlation_key) DO NOTHING`
      // followed by a re-SELECT and a wait_type compare
      // (waitSubscriptionService.ts:515-518). It is NOT a 409.
      const second = await request(app)
        .post(`${BASE}/cases/${caseId}/waits`)
        .send({ waitType: 'HUMAN', correlationKey, runId });
      expect(second.status).toBe(201);
      expect(second.body.data.waitId).toBe(first.body.data.waitId);

      // The compare-fallback fails CLOSED when the replay disagrees about type.
      const mismatched = await request(app)
        .post(`${BASE}/cases/${caseId}/waits`)
        .send({ waitType: 'TIMER', correlationKey, runId, timeoutAt: new Date(Date.now() + 60_000).toISOString() });
      expect(mismatched.status).toBe(409);
      expect(mismatched.body.error.code).toBe('WAIT_CORRELATION_KEY_CONFLICT');

      // Three requests, one row.
      const rows = await control.query(
        `SELECT wait_id, wait_type FROM case_workspace_waits WHERE case_id = $1 AND correlation_key = $2`,
        [caseId, correlationKey]
      );
      expect(rows.rowCount).toBe(1);
      expect(rows.rows[0].wait_type).toBe('HUMAN');
    } finally {
      await fx.teardown();
    }
  }, 45_000);

  it('the Idempotency-Key HEADER is honoured as a wait correlationKey when the body omits it', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('wait-header');
      const app = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const created = await request(app)
        .post(`${BASE}/cases`)
        .send({ projectId: f.projectId, contractedClosureType: 'DELIVERY_COMPLETED' });
      const caseId = created.body.data.caseId;
      const runId = await bindRun(app, control, fx, f, caseId, 'wait-header');

      const headerKey = `hdr-${randomUUID()}`;
      const res = await request(app)
        .post(`${BASE}/cases/${caseId}/waits`)
        .set('Idempotency-Key', headerKey)
        .send({ waitType: 'DOMAIN_EVENT', expectedEventType: 'finance.statement.ingested', runId });

      expect(res.status).toBe(201);
      expect(res.body.data.correlationKey).toBe(headerKey);

      const row = await control.query(
        `SELECT correlation_key FROM case_workspace_waits WHERE wait_id = $1`,
        [res.body.data.waitId]
      );
      expect(row.rows[0].correlation_key).toBe(headerKey);
    } finally {
      await fx.teardown();
    }
  }, 45_000);

  /**
   * ===========================================================================
   * KNOWN DEFECT — CW-API-CAP-ENUM-01 (characterization test, pins the BUG)
   * ===========================================================================
   * `POST /capabilities` is UNREACHABLE: no value of `approvalRecommendation`
   * can get through both layers.
   *
   *   capabilities.routes.ts:44  approvalClassEnum =
   *       z.enum(['AUTO', 'NOTIFY_ONLY', 'REQUIRE_APPROVAL'])
   *   types/executionSpine.ts:43 ApprovalClassValues =
   *       ['requires_human_approval', 'policy_approvable', 'auto_executable']
   *
   * capabilityRegistryService validates against the SECOND list. The two sets
   * are disjoint, so:
   *   - an uppercase value passes zod and dies in the service with
   *     `400 CAPABILITY_APPROVAL_RECOMMENDATION_INVALID`;
   *   - a snake_case value dies in zod with `400 VALIDATION_ERROR`.
   *
   * Consequence: the Capability Registry has NO working write path over HTTP,
   * so CW-DOD-C1 ("Capability Registry is server-driven and versioned") cannot
   * be satisfied through this API today, and every downstream check that
   * resolves a proposal's `capabilityRegistryId` has nothing to resolve
   * against unless rows are inserted out of band.
   *
   * Why the 11 sibling route suites missed it: they mock
   * `capabilityRegistryService`, so only the zod half of the contract is
   * exercised and the uppercase enum looks fine.
   *
   * FIX (owner: the capabilities-route / executionSpine stream, NOT this test):
   * make `approvalClassEnum` `z.enum(ApprovalClassValues)` — importing the same
   * constant the service validates against, so the two can never drift again.
   * When that lands, both halves below start returning 201 and this test
   * becomes the happy-path registration test it was originally written as.
   */
  it('KNOWN DEFECT CW-API-CAP-ENUM-01 — POST /capabilities is unreachable (route enum ≠ service enum)', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('cap-enum');
      const adminApp = createContractApp({
        organizationId: f.orgId,
        userId: f.adminUserId,
        userRole: 'ADMIN',
        isSuperAdmin: false,
      });

      const base = {
        capabilityId: `cw.contract.${randomUUID()}`,
        capabilityVersion: '1.0.0',
        ownerModule: 'contract-test',
        providerType: 'INTERNAL',
        operation: 'contractTest',
        owningCommandRef: 'contractTest',
        inputSchemaRef: 'schema://in',
        outputSchemaRef: 'schema://out',
        operationClass: 'READ',
        effectClass: 'SAFE_ADDITIVE',
        dataClassification: 'INTERNAL',
        idempotencyStrategy: 'NATURAL_KEY',
        reversibility: 'NOT_APPLICABLE',
      };

      // Half 1: the value the ROUTE's zod enum allows — rejected by the service.
      const routeShaped = await request(adminApp)
        .post(`${BASE}/capabilities`)
        .send({ ...base, approvalRecommendation: 'AUTO' });
      expect(routeShaped.status).toBe(400);
      expect(routeShaped.body.error.code).toBe('CAPABILITY_APPROVAL_RECOMMENDATION_INVALID');

      // Half 2: the value the SERVICE accepts — rejected by the route's zod.
      const serviceShaped = await request(adminApp)
        .post(`${BASE}/capabilities`)
        .send({ ...base, approvalRecommendation: 'auto_executable' });
      expect(serviceShaped.status).toBe(400);
      expect(serviceShaped.body.error.code).toBe('VALIDATION_ERROR');

      // Nothing was registered by either attempt.
      const rows = await control.query(
        `SELECT capability_registry_id FROM case_workspace_capabilities WHERE capability_id = $1`,
        [base.capabilityId]
      );
      expect(rows.rowCount).toBe(0);
    } finally {
      await fx.teardown();
    }
  }, 45_000);

  it('GET /process-definitions is cursor-paginated, tenant-scoped, and never repeats a row across pages', async () => {
    const fx = new ContractFixtures(control);
    const definitionIds: string[] = [];
    try {
      const f = await fx.seedFixture('pagination');
      const app = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });

      for (let i = 0; i < 5; i += 1) {
        const created = await request(app)
          .post(`${BASE}/process-definitions`)
          .send({ name: `Contract play ${i} ${randomUUID()}` });
        expect(created.status).toBe(201);
        definitionIds.push(created.body.data.processDefinitionId);
      }

      const page1 = await request(app).get(`${BASE}/process-definitions?limit=2`);
      expect(page1.status).toBe(200);
      // This is the ONE list with the {data, nextCursor} envelope.
      expect(Object.keys(page1.body).sort()).toEqual(['data', 'nextCursor']);
      expect(page1.body.data.length).toBe(2);
      expect(typeof page1.body.nextCursor).toBe('string');

      const page2 = await request(app).get(
        `${BASE}/process-definitions?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`
      );
      expect(page2.status).toBe(200);
      expect(page2.body.data.length).toBe(2);

      const page3 = await request(app).get(
        `${BASE}/process-definitions?limit=2&cursor=${encodeURIComponent(page2.body.nextCursor)}`
      );
      expect(page3.status).toBe(200);
      expect(page3.body.data.length).toBe(1);
      expect(page3.body.nextCursor).toBeNull();

      const seen = [...page1.body.data, ...page2.body.data, ...page3.body.data].map(
        (d: { processDefinitionId: string }) => d.processDefinitionId
      );
      // No row appears twice, and every seeded row appears exactly once.
      expect(new Set(seen).size).toBe(5);
      expect(seen.sort()).toEqual([...definitionIds].sort());
      // Tenant scoping: nothing from any other org leaked in.
      for (const d of [...page1.body.data, ...page2.body.data, ...page3.body.data]) {
        expect(d.organizationId).toBe(f.orgId);
      }
    } finally {
      for (const id of definitionIds) {
        await control
          .query(`DELETE FROM process_definitions WHERE process_definition_id = $1`, [id])
          .catch(() => undefined);
      }
      await fx.teardown();
    }
  }, 60_000);

  it('INTAKE — propose creates nothing; confirm creates exactly one Case; replay reuses it', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('intake');
      const app = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const workOrder = {
        projectId: f.projectId,
        goal: 'Reduce close-cycle time',
        scope: ['Finance close process', 'Month-end reconciliation'],
        expectedOutcome: 'A signed-off recommendation with a costed option set',
        contractedClosureType: 'DECISION_COMPLETED',
      };

      const proposed = await request(app)
        .post(`${BASE}/case-intake/work-orders/propose`)
        .send({ workOrder });
      // 200, not 201 — CW-CANON-01: proposing creates nothing.
      expect(proposed.status).toBe(200);
      expect(proposed.body.data.caseCreated).toBe(false);
      expect(proposed.body.data.runCreated).toBe(false);
      expect(proposed.body.data.workOrderDigest).toMatch(/^sha256:[0-9a-f]{64}$/);

      const noCaseYet = await control.query(`SELECT case_id FROM case_core WHERE project_id = $1`, [
        f.projectId,
      ]);
      expect(noCaseYet.rowCount).toBe(0);

      // A digest that does not match the work order is refused.
      const badDigest = await request(app)
        .post(`${BASE}/case-intake/work-orders/confirm`)
        .send({ workOrder, confirmedDigest: `sha256:${'0'.repeat(64)}` });
      expect(badDigest.status).toBe(422);
      const stillNoCase = await control.query(`SELECT case_id FROM case_core WHERE project_id = $1`, [
        f.projectId,
      ]);
      expect(stillNoCase.rowCount).toBe(0);

      const confirmed = await request(app)
        .post(`${BASE}/case-intake/work-orders/confirm`)
        .send({ workOrder, confirmedDigest: proposed.body.data.workOrderDigest });
      // 201 = THIS call created the Case.
      expect(confirmed.status).toBe(201);
      expect(confirmed.body.data.caseCreated).toBe(true);
      expect(confirmed.body.data.reused).toBe(false);
      expect(confirmed.body.data.runCreated).toBe(false);

      // Replay: 200, reused, and STILL exactly one Case row (CW-CANON-03).
      const replay = await request(app)
        .post(`${BASE}/case-intake/work-orders/confirm`)
        .send({ workOrder, confirmedDigest: proposed.body.data.workOrderDigest });
      expect(replay.status).toBe(200);
      expect(replay.body.data.caseCreated).toBe(false);
      expect(replay.body.data.reused).toBe(true);
      expect(replay.body.data.caseId).toBe(confirmed.body.data.caseId);

      const rows = await control.query(`SELECT case_id FROM case_core WHERE project_id = $1`, [f.projectId]);
      expect(rows.rowCount).toBe(1);

      await control.query(`DELETE FROM case_workspace_history_events WHERE case_id = $1`, [
        confirmed.body.data.caseId,
      ]);
    } finally {
      await fx.teardown();
    }
  }, 45_000);
});
