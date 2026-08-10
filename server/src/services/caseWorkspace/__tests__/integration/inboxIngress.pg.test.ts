/**
 * CW-T-B — AUTHENTICATED INGRESS, over REAL HTTP, against a REAL PostgreSQL.
 *
 * Backs server/src/routes/caseWorkspace/eventInbox.routes.ts. Unlike
 * `../eventInboxService.pg.test.ts` (which calls `receiveExternalEvent`
 * directly, proving the SERVICE's trust boundary), every assertion in this
 * file goes through `supertest` against a mounted Express router — proving
 * the thing that did NOT exist before this packet: a real HTTP path an
 * external sender can use to deliver a signed event. The task brief this
 * packet answers to says it explicitly: "Nie uznawaj bezposredniego wywolania
 * funkcji serwisowej w tescie za produkcyjny ingress."
 *
 * ===========================================================================
 * GATE — real database, never a mock; same schema probe as the sibling suite
 * ===========================================================================
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://... \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/integration/inboxIngress.pg.test.ts \
 *   --environment node
 *
 * ===========================================================================
 * SCENARIOS (mirrors the task brief's literal list)
 * ===========================================================================
 *   valid signature            -> applied.valid.signature
 *   invalid signature          -> unauthenticated.invalid.signature
 *   replay (same delivery)     -> replay.duplicate.single.effect (+ concurrency)
 *   expired timestamp          -> timestamp.expired
 *   foreign tenant             -> tenant.mismatch.foreign.org
 *   wrong Case                 -> tenant.mismatch.wrong.case
 *   unknown event type         -> event.type.not.allowlisted
 *   ambiguous                  -> correlation.ambiguous
 *   duplicate delivery         -> replay.duplicate.single.effect
 *   restart                    -> survives.process.restart
 *
 * REQUIRED PROPERTIES asserted explicitly, not just implied by status codes:
 *   - retry of the SAME delivery does not repeat the effect (readback: one
 *     wait.satisfied outbox row, wait flips ACTIVE->SATISFIED exactly once)
 *   - two GENUINELY CONCURRENT deliveries (Promise.all) produce ONE effect
 *   - a callback still works after the channel registry is torn down and
 *     rebuilt the way a process restart's env bootstrap would (state lives in
 *     Postgres, not in the route's memory)
 *   - a wait is resumed ONLY by a correctly authenticated + correlated event
 *     (every rejection path leaves the wait untouched, verified via readback)
 */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../../caseCoreService.js';
import * as casePlanVersionService from '../../casePlanVersionService.js';
import type { CanonicalGraph } from '../../casePlanVersionService.js';
import * as eventInboxService from '../../eventInboxService.js';
import * as runBindingService from '../../runBindingService.js';
import * as waitSubscriptionService from '../../waitSubscriptionService.js';
import eventInboxRoutes from '../../../../routes/caseWorkspace/eventInbox.routes.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const inbox = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_event_inbox'
          AND column_name IN ('inbox_record_id', 'event_id', 'source', 'organization_id',
                              'correlation_key', 'wait_id', 'status', 'rejection_code')`
    );
    const waits = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_waits'
          AND column_name IN ('wait_id', 'status', 'correlation_key')`
    );
    return Number(inbox.rows[0]?.present ?? 0) === 8 && Number(waits.rows[0]?.present ?? 0) === 3;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[inboxIngress HTTP suite SKIPPED — clean skip, not a failure] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `case-workspace inbox + wait migrations applied. requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

const CHANNEL_SECRET = 'inbox-ingress-http-secret-do-not-reuse';
const BASE = '/api/webhooks/case-workspace';

function createInboxApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(BASE, eventInboxRoutes);
  return app;
}

interface InboxDbRow {
  inbox_record_id: string;
  event_id: string;
  source: string;
  organization_id: string;
  status: string;
  rejection_code: string | null;
  applied_effect_ref: string | null;
}

interface WaitDbRow {
  wait_id: string;
  status: string;
  version: number;
  satisfied_by_event_id: string | null;
}

suite('CW-T-B — authenticated event inbox ingress, over real HTTP (routes/caseWorkspace/eventInbox.routes.ts)', () => {
  let control: Pool;
  let app: Express;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    app = createInboxApp();
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  afterEach(() => {
    // Same isolation discipline as the sibling suite: a leaked channel
    // registration would let a later test authenticate by accident.
    eventInboxService.clearInboxChannels();
  });

  // -------------------------------------------------------------------------
  // Fixtures — same shape as eventInboxService.pg.test.ts's own (duplicated
  // rather than imported: that file exports nothing, by design — every
  // *.pg.test.ts suite in this directory owns its fixtures independently).
  // -------------------------------------------------------------------------

  async function seedMemberedUser(orgId: string, label: string): Promise<string> {
    const userId = `case-inbox-http-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE')`,
      [`case-inbox-http-member-${randomUUID()}`, orgId, userId]
    );
    return userId;
  }

  function graphFor(label: string, suffix: string): CanonicalGraph {
    return {
      schemaVersion: '1',
      graphId: `graph-${label}-${suffix}`,
      entryNodeIds: ['n1'],
      terminalNodeIds: ['n2'],
      nodes: [
        { nodeId: 'n1', type: 'TASK' },
        { nodeId: 'n2', type: 'TASK' },
      ],
      edges: [{ edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', edgeType: 'SEQUENCE' }],
    };
  }

  async function seedBoundRun(label: string): Promise<{
    orgId: string;
    projectId: string;
    caseId: string;
    runId: string;
    actorId: string;
  }> {
    const suffix = randomUUID();
    const orgId = `case-inbox-http-org-${label}-${suffix}`;
    const projectId = `case-inbox-http-project-${label}-${suffix}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      orgId,
      `Inbox HTTP test org (${label})`,
    ]);
    await control.query(`INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)`, [
      projectId,
      orgId,
      `Inbox HTTP test project (${label})`,
    ]);
    const actorId = await seedMemberedUser(orgId, label);
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      caseName: `Inbox HTTP test case (${label})`,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: actorId,
    });

    const draft = await casePlanVersionService.createPlanDraft({
      caseId: created.caseId,
      semanticGraph: graphFor(label, suffix),
      createdByActorId: actorId,
    });
    const proposed = await casePlanVersionService.proposePlanVersion(
      draft.casePlanVersionId,
      { actorUserId: actorId },
      draft.version
    );
    const published = await casePlanVersionService.publishPlanVersion(
      draft.casePlanVersionId,
      { actorUserId: actorId },
      proposed.version
    );

    const runId = `run-inbox-http-${label}-${suffix}`;
    await control.query(
      `INSERT INTO v8_execution_runs (run_id, organization_id, context_snapshot_id, initiator_user_id, goal)
       VALUES ($1, $2, $3, $4, $5)`,
      [runId, orgId, `ctx-${runId}`, actorId, `goal ${label}`]
    );
    await runBindingService.bindRunToPlanVersion({
      runId,
      casePlanVersionId: published.casePlanVersionId,
      boundByActorId: actorId,
    });

    return { orgId, projectId, caseId: created.caseId, runId, actorId };
  }

  async function seedSecondBoundRunInSameOrg(
    fixture: { orgId: string; actorId: string },
    label: string
  ): Promise<{ caseId: string; runId: string; projectId: string }> {
    const suffix = randomUUID();
    const projectId = `case-inbox-http-project-${label}-${suffix}`;
    await control.query(`INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)`, [
      projectId,
      fixture.orgId,
      `Inbox HTTP test project (${label})`,
    ]);
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: fixture.orgId,
      caseName: `Inbox HTTP test case (${label})`,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: fixture.actorId,
    });

    const draft = await casePlanVersionService.createPlanDraft({
      caseId: created.caseId,
      semanticGraph: graphFor(label, suffix),
      createdByActorId: fixture.actorId,
    });
    const proposed = await casePlanVersionService.proposePlanVersion(
      draft.casePlanVersionId,
      { actorUserId: fixture.actorId },
      draft.version
    );
    const published = await casePlanVersionService.publishPlanVersion(
      draft.casePlanVersionId,
      { actorUserId: fixture.actorId },
      proposed.version
    );

    const runId = `run-inbox-http-${label}-${suffix}`;
    await control.query(
      `INSERT INTO v8_execution_runs (run_id, organization_id, context_snapshot_id, initiator_user_id, goal)
       VALUES ($1, $2, $3, $4, $5)`,
      [runId, fixture.orgId, `ctx-${runId}`, fixture.actorId, `goal ${label}`]
    );
    await runBindingService.bindRunToPlanVersion({
      runId,
      casePlanVersionId: published.casePlanVersionId,
      boundByActorId: fixture.actorId,
    });

    return { caseId: created.caseId, runId, projectId };
  }

  async function seedWaitWithKey(
    fixture: { caseId: string; runId: string; actorId: string },
    correlationKey: string,
    eventType: string | null = 'vendor.signature.completed'
  ): Promise<string> {
    const wait = await waitSubscriptionService.createWait(
      {
        caseId: fixture.caseId,
        runId: fixture.runId,
        waitType: 'EXTERNAL_CALLBACK',
        correlationKey,
        expectedEventType: eventType,
      },
      fixture.actorId
    );
    return wait.waitId;
  }

  async function seedExternalCallbackWait(fixture: {
    caseId: string;
    runId: string;
    actorId: string;
  }): Promise<{ waitId: string; correlationKey: string }> {
    const correlationKey = `corrkey-http-${randomUUID()}`;
    const waitId = await seedWaitWithKey(fixture, correlationKey);
    return { waitId, correlationKey };
  }

  function registerChannel(source: string, opts: { allowedEventTypes?: string[] } = {}): void {
    eventInboxService.registerInboxChannel({
      source,
      secret: CHANNEL_SECRET,
      principal: `principal:${source}`,
      allowedWaitTypes: ['EXTERNAL_CALLBACK'],
      allowedEventTypes: opts.allowedEventTypes,
      validatePayload: (payload) =>
        eventInboxService.isDeliveredAtWithinTolerance((payload as Record<string, unknown>).deliveredAt),
    });
  }

  function freshDeliveredAt(): string {
    return new Date().toISOString();
  }

  function staleDeliveredAt(): string {
    return new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h old
  }

  function buildBody(params: {
    source: string;
    eventId: string;
    organizationId: string;
    correlationKey: string;
    caseId?: string;
    eventType?: string;
    payload?: Record<string, unknown>;
    signatureOverride?: string;
  }) {
    const payload = params.payload ?? { status: 'completed', vendorRef: 'V-1', deliveredAt: freshDeliveredAt() };
    return {
      eventId: params.eventId,
      eventType: params.eventType ?? 'vendor.signature.completed',
      organizationId: params.organizationId,
      correlationKey: params.correlationKey,
      caseId: params.caseId,
      payload,
      signature: params.signatureOverride ?? eventInboxService.computeInboxSignature(CHANNEL_SECRET, payload),
    };
  }

  async function readInboxRows(source: string): Promise<InboxDbRow[]> {
    const result = await control.query<InboxDbRow>(
      `SELECT inbox_record_id, event_id, source, organization_id, status, rejection_code, applied_effect_ref
         FROM case_workspace_event_inbox WHERE source = $1 ORDER BY received_at ASC`,
      [source]
    );
    return result.rows;
  }

  async function readWait(waitId: string): Promise<WaitDbRow | null> {
    const result = await control.query<WaitDbRow>(
      `SELECT wait_id, status, version, satisfied_by_event_id FROM case_workspace_waits WHERE wait_id = $1`,
      [waitId]
    );
    return result.rows[0] ?? null;
  }

  async function countOutbox(aggregateId: string, eventType: string): Promise<number> {
    const result = await control.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM case_workspace_event_outbox
        WHERE aggregate_id = $1 AND event_type = $2`,
      [aggregateId, eventType]
    );
    return Number(result.rows[0].n);
  }

  async function teardown(params: { orgId: string; projectId: string; runId: string; source?: string }): Promise<void> {
    if (params.source) {
      await control.query(`DELETE FROM case_workspace_event_inbox WHERE source = $1`, [params.source]).catch(() => undefined);
    }
    await control.query(`DELETE FROM case_workspace_event_inbox WHERE organization_id = $1`, [params.orgId]).catch(() => undefined);
    await control.query(`DELETE FROM case_workspace_waits WHERE run_id = $1`, [params.runId]).catch(() => undefined);
    await control.query(`DELETE FROM case_workspace_run_bindings WHERE run_id = $1`, [params.runId]).catch(() => undefined);
    await control.query(`DELETE FROM v8_execution_runs WHERE run_id = $1`, [params.runId]).catch(() => undefined);
    await control.query(`DELETE FROM case_core WHERE project_id = $1`, [params.projectId]).catch(() => undefined);
    await control.query(`DELETE FROM projects WHERE id = $1`, [params.projectId]).catch(() => undefined);
    await control.query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [params.orgId]).catch(() => undefined);
    await control.query(`DELETE FROM organization_members WHERE organization_id = $1`, [params.orgId]).catch(() => undefined);
    await control.query(`DELETE FROM users WHERE organization_id = $1`, [params.orgId]).catch(() => undefined);
    await control.query(`DELETE FROM organizations WHERE id = $1`, [params.orgId]).catch(() => undefined);
  }

  // =========================================================================
  // 1. VALID signature -> applied, over real HTTP.
  // =========================================================================
  it('valid signature: 200 applied, wait flips ACTIVE->SATISFIED, exactly one wait.satisfied outbox row', async () => {
    const fixture = await seedBoundRun('valid');
    const source = `http-valid-${randomUUID()}`;
    try {
      const { waitId, correlationKey } = await seedExternalCallbackWait(fixture);
      registerChannel(source);

      const res = await request(app)
        .post(`${BASE}/${source}/deliveries`)
        .send(buildBody({ source, eventId: `evt-${randomUUID()}`, organizationId: fixture.orgId, correlationKey }));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ received: true, outcome: 'applied', waitId });

      const wait = await readWait(waitId);
      expect(wait?.status).toBe('SATISFIED');
      expect(await countOutbox(waitId, 'wait.satisfied')).toBe(1);

      const rows = await readInboxRows(source);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('APPLIED');
    } finally {
      await teardown({ ...fixture, source });
    }
  }, 90_000);

  // =========================================================================
  // 2. INVALID signature -> 401, generic body, NO row written.
  // =========================================================================
  it('invalid signature: 401 with a generic UNAUTHENTICATED body, no inbox row, wait untouched', async () => {
    const fixture = await seedBoundRun('badsig');
    const source = `http-badsig-${randomUUID()}`;
    try {
      const { waitId, correlationKey } = await seedExternalCallbackWait(fixture);
      registerChannel(source);

      const res = await request(app)
        .post(`${BASE}/${source}/deliveries`)
        .send(
          buildBody({
            source,
            eventId: `evt-${randomUUID()}`,
            organizationId: fixture.orgId,
            correlationKey,
            signatureOverride: 'f'.repeat(64),
          })
        );

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ received: false, error: { code: 'UNAUTHENTICATED' } });

      // An unregistered channel gets the SAME generic 401 body (no channel
      // enumeration oracle).
      const unknownRes = await request(app)
        .post(`${BASE}/never-registered-${randomUUID()}/deliveries`)
        .send(buildBody({ source, eventId: `evt-${randomUUID()}`, organizationId: fixture.orgId, correlationKey }));
      expect(unknownRes.status).toBe(401);
      expect(unknownRes.body).toEqual({ received: false, error: { code: 'UNAUTHENTICATED' } });

      expect(await readInboxRows(source)).toHaveLength(0);
      expect((await readWait(waitId))?.status).toBe('ACTIVE');
    } finally {
      await teardown({ ...fixture, source });
    }
  }, 90_000);

  // =========================================================================
  // 3. EXPIRED timestamp -> 422 PAYLOAD_INVALID, DURABLE rejected row, no effect.
  // =========================================================================
  it('expired payload.deliveredAt: 422 PAYLOAD_INVALID with a durable rejected row, wait stays ACTIVE', async () => {
    const fixture = await seedBoundRun('staletime');
    const source = `http-staletime-${randomUUID()}`;
    try {
      const { waitId, correlationKey } = await seedExternalCallbackWait(fixture);
      registerChannel(source);

      const res = await request(app)
        .post(`${BASE}/${source}/deliveries`)
        .send(
          buildBody({
            source,
            eventId: `evt-${randomUUID()}`,
            organizationId: fixture.orgId,
            correlationKey,
            payload: { status: 'completed', deliveredAt: staleDeliveredAt() },
          })
        );

      expect(res.status).toBe(422);
      expect(res.body.error).toEqual({ code: 'PAYLOAD_INVALID' });

      expect((await readWait(waitId))?.status).toBe('ACTIVE');
      const rows = await readInboxRows(source);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('REJECTED');
      expect(rows[0].rejection_code).toBe('PAYLOAD_INVALID');
    } finally {
      await teardown({ ...fixture, source });
    }
  }, 90_000);

  // =========================================================================
  // 4. FOREIGN tenant -> 422 TENANT_MISMATCH, durable row, no effect.
  // =========================================================================
  it('foreign tenant: claiming a correlationKey that belongs to a DIFFERENT organization -> 422 TENANT_MISMATCH', async () => {
    const owner = await seedBoundRun('tenant-owner');
    const foreign = await seedBoundRun('tenant-foreign');
    const source = `http-tenant-${randomUUID()}`;
    try {
      const { waitId, correlationKey } = await seedExternalCallbackWait(owner);
      registerChannel(source);

      const res = await request(app)
        .post(`${BASE}/${source}/deliveries`)
        // The delivery CLAIMS the foreign org, not the owner's.
        .send(buildBody({ source, eventId: `evt-${randomUUID()}`, organizationId: foreign.orgId, correlationKey }));

      expect(res.status).toBe(422);
      expect(res.body.error).toEqual({ code: 'TENANT_MISMATCH' });
      expect((await readWait(waitId))?.status).toBe('ACTIVE');

      const rows = await readInboxRows(source);
      expect(rows).toHaveLength(1);
      expect(rows[0].rejection_code).toBe('TENANT_MISMATCH');
      expect(rows[0].organization_id).toBe(foreign.orgId); // the CLAIM is what got recorded
    } finally {
      await teardown({ ...owner, source });
      await teardown(foreign);
    }
  }, 90_000);

  // =========================================================================
  // 5. WRONG Case -> 422 TENANT_MISMATCH (correlation key resolves in-org but
  //    outside the CLAIMED case's scope), no effect.
  // =========================================================================
  it('wrong Case: correlationKey belongs to a DIFFERENT Case in the SAME org -> 422 TENANT_MISMATCH', async () => {
    const fixture = await seedBoundRun('wrongcase');
    const source = `http-wrongcase-${randomUUID()}`;
    let otherCase: { caseId: string; runId: string; projectId: string } | undefined;
    try {
      const { waitId, correlationKey } = await seedExternalCallbackWait(fixture);
      otherCase = await seedSecondBoundRunInSameOrg(fixture, 'wrongcase-other');
      registerChannel(source);

      const res = await request(app)
        .post(`${BASE}/${source}/deliveries`)
        // Right org, right key — but names the OTHER Case.
        .send(
          buildBody({
            source,
            eventId: `evt-${randomUUID()}`,
            organizationId: fixture.orgId,
            correlationKey,
            caseId: otherCase.caseId,
          })
        );

      expect(res.status).toBe(422);
      expect(res.body.error).toEqual({ code: 'TENANT_MISMATCH' });
      expect((await readWait(waitId))?.status).toBe('ACTIVE');
    } finally {
      if (otherCase) {
        await control.query(`DELETE FROM case_workspace_waits WHERE run_id = $1`, [otherCase.runId]).catch(() => undefined);
        await control.query(`DELETE FROM case_workspace_run_bindings WHERE run_id = $1`, [otherCase.runId]).catch(() => undefined);
        await control.query(`DELETE FROM v8_execution_runs WHERE run_id = $1`, [otherCase.runId]).catch(() => undefined);
        await control.query(`DELETE FROM case_core WHERE project_id = $1`, [otherCase.projectId]).catch(() => undefined);
        await control.query(`DELETE FROM projects WHERE id = $1`, [otherCase.projectId]).catch(() => undefined);
      }
      await teardown({ ...fixture, source });
    }
  }, 90_000);

  // =========================================================================
  // 6. UNKNOWN event type -> channel-wide allowlist, 422 PAYLOAD_INVALID.
  // =========================================================================
  it('event type not on the channel allowlist: 422 PAYLOAD_INVALID with a durable row, no effect — isolated from the per-wait expectedEventType gate', async () => {
    const fixture = await seedBoundRun('evttype');
    const source = `http-evttype-${randomUUID()}`;
    try {
      // The wait deliberately carries NO expectedEventType (null): if it did,
      // a mismatched eventType would ALSO be rejected as PAYLOAD_INVALID by
      // that pre-existing, DIFFERENT gate further down in receiveExternalEvent
      // (see eventInboxService.ts's own "distinct from the per-wait
      // expectedEventType check" comment on allowedEventTypes), and this test
      // would pass for the wrong reason — proving nothing about the NEW
      // channel-wide allowlist this packet adds. Confirmed by negative
      // control: with the per-wait gate left as the only one active, this
      // exact scenario still rejected — see this packet's report.
      const correlationKey = `corrkey-http-${randomUUID()}`;
      const waitId = await seedWaitWithKey(fixture, correlationKey, null);
      registerChannel(source, { allowedEventTypes: ['vendor.signature.completed'] });

      const disallowed = await request(app)
        .post(`${BASE}/${source}/deliveries`)
        .send(
          buildBody({
            source,
            eventId: `evt-${randomUUID()}`,
            organizationId: fixture.orgId,
            correlationKey,
            eventType: 'vendor.totally.unexpected',
          })
        );

      expect(disallowed.status).toBe(422);
      expect(disallowed.body.error).toEqual({ code: 'PAYLOAD_INVALID' });
      expect((await readWait(waitId))?.status).toBe('ACTIVE');
      const rows = await readInboxRows(source);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('REJECTED');

      // Discriminates, doesn't blanket-reject: the SAME channel admits an
      // eventType that IS on its allowlist.
      const allowed = await request(app)
        .post(`${BASE}/${source}/deliveries`)
        .send(
          buildBody({
            source,
            eventId: `evt-${randomUUID()}`,
            organizationId: fixture.orgId,
            correlationKey,
          })
        );
      expect(allowed.status).toBe(200);
      expect(allowed.body.outcome).toBe('applied');
      expect((await readWait(waitId))?.status).toBe('SATISFIED');
    } finally {
      await teardown({ ...fixture, source });
    }
  }, 90_000);

  // =========================================================================
  // 7. AMBIGUOUS correlation key -> 422 CORRELATION_AMBIGUOUS, no effect on
  //    EITHER candidate wait.
  // =========================================================================
  it('ambiguous correlation key (two waits, same org, no caseId to disambiguate): 422 CORRELATION_AMBIGUOUS', async () => {
    const fixture = await seedBoundRun('ambiguous');
    const source = `http-ambiguous-${randomUUID()}`;
    let second: { caseId: string; runId: string; projectId: string } | null = null;
    try {
      const sharedKey = `corrkey-http-collision-${randomUUID()}`;
      const waitA = await seedWaitWithKey(fixture, sharedKey);
      second = await seedSecondBoundRunInSameOrg(fixture, 'ambiguous-second');
      const waitB = await seedWaitWithKey({ ...fixture, caseId: second.caseId, runId: second.runId }, sharedKey);
      registerChannel(source);

      const res = await request(app)
        .post(`${BASE}/${source}/deliveries`)
        .send(buildBody({ source, eventId: `evt-${randomUUID()}`, organizationId: fixture.orgId, correlationKey: sharedKey }));

      expect(res.status).toBe(422);
      expect(res.body.error).toEqual({ code: 'CORRELATION_AMBIGUOUS' });
      expect((await readWait(waitA))?.status).toBe('ACTIVE');
      expect((await readWait(waitB))?.status).toBe('ACTIVE');
    } finally {
      if (second) {
        await control.query(`DELETE FROM case_workspace_waits WHERE run_id = $1`, [second.runId]).catch(() => undefined);
        await control.query(`DELETE FROM case_workspace_run_bindings WHERE run_id = $1`, [second.runId]).catch(() => undefined);
        await control.query(`DELETE FROM v8_execution_runs WHERE run_id = $1`, [second.runId]).catch(() => undefined);
        await control.query(`DELETE FROM case_core WHERE project_id = $1`, [second.projectId]).catch(() => undefined);
        await control.query(`DELETE FROM projects WHERE id = $1`, [second.projectId]).catch(() => undefined);
      }
      await teardown({ ...fixture, source });
    }
  }, 90_000);

  // =========================================================================
  // 8. DUPLICATE delivery (literal replay) -> 200 duplicate, single effect,
  //    proved BOTH sequentially and under genuine concurrency.
  // =========================================================================
  it('replay: an identical redelivery is 200 duplicate and produces NO second effect (sequential)', async () => {
    const fixture = await seedBoundRun('replay-seq');
    const source = `http-replay-seq-${randomUUID()}`;
    try {
      const { waitId, correlationKey } = await seedExternalCallbackWait(fixture);
      registerChannel(source);
      const body = buildBody({ source, eventId: `evt-${randomUUID()}`, organizationId: fixture.orgId, correlationKey });

      const first = await request(app).post(`${BASE}/${source}/deliveries`).send(body);
      expect(first.status).toBe(200);
      expect(first.body.outcome).toBe('applied');

      const replay = await request(app).post(`${BASE}/${source}/deliveries`).send(body);
      expect(replay.status).toBe(200);
      expect(replay.body).toMatchObject({ received: true, outcome: 'duplicate', inboxRecordId: first.body.inboxRecordId });

      const wait = await readWait(waitId);
      expect(wait?.status).toBe('SATISFIED');
      expect(await countOutbox(waitId, 'wait.satisfied')).toBe(1); // NOT 2
      expect(await readInboxRows(source)).toHaveLength(1); // NOT 2 — ON CONFLICT DO NOTHING
    } finally {
      await teardown({ ...fixture, source });
    }
  }, 90_000);

  it('replay under genuine concurrency: two parallel identical deliveries produce exactly ONE effect', async () => {
    const fixture = await seedBoundRun('replay-conc');
    const source = `http-replay-conc-${randomUUID()}`;
    try {
      const { waitId, correlationKey } = await seedExternalCallbackWait(fixture);
      registerChannel(source);
      const body = buildBody({ source, eventId: `evt-${randomUUID()}`, organizationId: fixture.orgId, correlationKey });

      const [a, b] = await Promise.all([
        request(app).post(`${BASE}/${source}/deliveries`).send(body),
        request(app).post(`${BASE}/${source}/deliveries`).send(body),
      ]);

      const outcomes = [a.body.outcome, b.body.outcome].sort();
      expect(outcomes).toEqual(['applied', 'duplicate']);
      expect([a.status, b.status]).toEqual([200, 200]);

      const wait = await readWait(waitId);
      expect(wait?.status).toBe('SATISFIED');
      expect(await countOutbox(waitId, 'wait.satisfied')).toBe(1);
      expect(await readInboxRows(source)).toHaveLength(1);
    } finally {
      await teardown({ ...fixture, source });
    }
  }, 90_000);

  // =========================================================================
  // 9. RESTART. The channel registry is process-local memory (by design, see
  //    eventInboxService.ts's own comment on why a secret is never a DB row);
  //    a real restart wipes it and a real boot re-populates it from env. This
  //    reproduces exactly that sequence and proves the callback still resolves
  //    the SAME wait afterward — because the wait/correlation state it needs
  //    was never in that memory, only in Postgres.
  // =========================================================================
  it('survives a simulated process restart: callback still resolves the pre-restart wait', async () => {
    const fixture = await seedBoundRun('restart');
    const source = `http-restart-${randomUUID()}`;
    try {
      const { waitId, correlationKey } = await seedExternalCallbackWait(fixture);
      registerChannel(source);

      // "Restart": the in-memory registry goes away entirely...
      eventInboxService.clearInboxChannels();
      // ...and a fresh boot re-registers it from (simulated) config — the
      // exact sequence eventInbox.routes.ts's bootstrapChannelsFromEnv runs
      // at import time in production.
      registerChannel(source);

      const res = await request(app)
        .post(`${BASE}/${source}/deliveries`)
        .send(buildBody({ source, eventId: `evt-${randomUUID()}`, organizationId: fixture.orgId, correlationKey }));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ outcome: 'applied', waitId });
      expect((await readWait(waitId))?.status).toBe('SATISFIED');
    } finally {
      await teardown({ ...fixture, source });
    }
  }, 90_000);

  // =========================================================================
  // 10. Malformed request shape -> 400, never 500.
  // =========================================================================
  it('malformed request body: 400 VALIDATION_ERROR, never 500', async () => {
    const res = await request(app).post(`${BASE}/some-source/deliveries`).send({ nonsense: true });
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('VALIDATION_ERROR');
  });
});
