/**
 * Case Workspace — durable INBOUND EVENT INBOX, proved against a REAL
 * PostgreSQL. Exercises server/src/services/caseWorkspace/eventInboxService.ts
 * against server/migrations/20260810_case_workspace_node_run_and_inbox.sql
 * (doc 06 §8).
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * `NODE_ENV=test` ALONE is a trap (Database.ts returns an in-memory MOCK unless
 * RUN_DB_TESTS=1 and MOCK_DB=false, silently turning every write into a no-op).
 * Same gate and same loud skip as every other `*.pg.test.ts` here.
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/eventInboxService.pg.test.ts \
 *   --environment node
 *
 * ===========================================================================
 * WHAT THESE TESTS TRY TO DISPROVE
 * ===========================================================================
 * 1. That "duplicate delivery produces one effect" is real — proved BOTH
 *    sequentially and with two genuinely concurrent deliveries racing through
 *    Promise.all, and measured on the WAIT (version, satisfied_by_event_id) and
 *    on the OUTBOX (exactly one `wait.satisfied`), not merely on the inbox row
 *    count. A service that inserted once but applied twice would pass a
 *    row-count-only test.
 * 2. That a cross-tenant callback influences NOTHING — and is still RECORDED,
 *    because a silently dropped cross-tenant attempt is an invisible attack.
 * 3. That authentication precedes persistence — a bad signature must leave NO
 *    row at all, or an unauthenticated caller has a free write primitive.
 * 4. That a late callback cannot revive a finished wait (§8: "duplicate or late
 *    events are audited but do not reactivate completed/cancelled Runs").
 *
 * Every assertion reads rows back through a dedicated out-of-band `pg.Pool`.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../caseCoreService.js';
import * as casePlanVersionService from '../casePlanVersionService.js';
import type { CanonicalGraph } from '../casePlanVersionService.js';
import * as eventInboxService from '../eventInboxService.js';
import * as runBindingService from '../runBindingService.js';
import * as waitSubscriptionService from '../waitSubscriptionService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const inbox = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_event_inbox'
          AND column_name IN ('inbox_record_id', 'event_id', 'source', 'organization_id',
                              'correlation_key', 'wait_id', 'status', 'rejection_code',
                              'payload_digest', 'redacted_payload', 'received_at',
                              'processed_at', 'applied_effect_ref', 'process_attempt_count')`
    );
    const dedup = await probe.query(
      `SELECT count(*)::int AS present FROM pg_constraint
        WHERE conname = 'case_workspace_event_inbox_dedup_unique'`
    );
    return Number(inbox.rows[0]?.present ?? 0) === 14 && Number(dedup.rows[0]?.present ?? 0) === 1;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[eventInboxService pg suite SKIPPED — clean skip, not a failure] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `20260810_case_workspace_node_run_and_inbox.sql migration applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

const CHANNEL_SECRET = 'test-channel-secret-do-not-reuse';

interface InboxDbRow {
  inbox_record_id: string;
  event_id: string;
  source: string;
  organization_id: string;
  correlation_key: string;
  wait_id: string | null;
  status: string;
  rejection_code: string | null;
  auth_principal: string | null;
  signature_digest: string | null;
  payload_digest: string;
  redacted_payload: Record<string, unknown>;
  applied_effect_ref: string | null;
}

interface WaitDbRow {
  wait_id: string;
  status: string;
  version: number;
  satisfied_by_event_id: string | null;
  satisfied_at: string | null;
}

suite('eventInboxService — durable inbound event boundary against a real PostgreSQL (doc 06 §8)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  afterEach(() => {
    // A leaked channel registration would let a later test authenticate by accident.
    eventInboxService.clearInboxChannels();
  });

  // -------------------------------------------------------------------------
  // Fixtures
  // -------------------------------------------------------------------------

  async function seedMemberedUser(orgId: string, label: string): Promise<string> {
    const userId = `case-inbox-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE')`,
      [`case-inbox-member-${randomUUID()}`, orgId, userId]
    );
    return userId;
  }

  /**
   * Org + project + Case + published plan version + v8 run + run binding. The
   * wait below targets `runId` (rather than an ActionProposal) so this suite
   * never touches proposalApprovalService.
   */
  async function seedBoundRun(label: string): Promise<{
    orgId: string;
    projectId: string;
    caseId: string;
    runId: string;
    actorId: string;
  }> {
    const suffix = randomUUID();
    const orgId = `case-inbox-org-${label}-${suffix}`;
    const projectId = `case-inbox-project-${label}-${suffix}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [orgId, `Inbox test org (${label})`]
    );
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Inbox test project (${label})`]
    );
    const actorId = await seedMemberedUser(orgId, label);
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      caseName: `Inbox test case (${label})`,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: actorId,
    });

    const graph: CanonicalGraph = {
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
    const draft = await casePlanVersionService.createPlanDraft({
      caseId: created.caseId,
      semanticGraph: graph,
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

    const runId = `run-inbox-${label}-${suffix}`;
    await control.query(
      `INSERT INTO v8_execution_runs (run_id, organization_id, context_snapshot_id, initiator_user_id, goal)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (run_id) DO NOTHING`,
      [runId, orgId, `ctx-${runId}`, actorId, `goal ${label}`]
    );
    await runBindingService.bindRunToPlanVersion({
      runId,
      casePlanVersionId: published.casePlanVersionId,
      boundByActorId: actorId,
    });

    return { orgId, projectId, caseId: created.caseId, runId, actorId };
  }

  async function seedExternalCallbackWait(fixture: {
    caseId: string;
    runId: string;
    actorId: string;
  }): Promise<{ waitId: string; correlationKey: string }> {
    const correlationKey = `corrkey-${randomUUID()}`;
    const wait = await waitSubscriptionService.createWait(
      {
        caseId: fixture.caseId,
        runId: fixture.runId,
        waitType: 'EXTERNAL_CALLBACK',
        correlationKey,
        expectedEventType: 'vendor.signature.completed',
      },
      fixture.actorId
    );
    return { waitId: wait.waitId, correlationKey };
  }

  /**
   * A SECOND Case (with its own plan, run and binding) inside an EXISTING
   * organization.
   *
   * Needed because `case_workspace_waits` is UNIQUE (case_id, correlation_key):
   * one key can only collide with itself across DIFFERENT Cases. `seedBoundRun`
   * always mints a fresh org, so it cannot produce the collision the AMBIGUOUS
   * path is about.
   *
   * The second Case gets its OWN project inside the SAME org, because
   * `caseCoreService.createCase` enforces one Case per project
   * (`case_already_exists_for_project`, caseCoreService.ts:334). The
   * organization is what must be shared — that is the scope the correlation
   * lookup searches.
   */
  async function seedSecondBoundRunInSameOrg(
    fixture: { orgId: string; actorId: string },
    label: string
  ): Promise<{ caseId: string; runId: string; projectId: string }> {
    const suffix = randomUUID();
    const projectId = `case-inbox-project-${label}-${suffix}`;
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
      [projectId, fixture.orgId, `Inbox test project (${label})`]
    );
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: fixture.orgId,
      caseName: `Inbox test case (${label})`,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: fixture.actorId,
    });

    const graph: CanonicalGraph = {
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
    const draft = await casePlanVersionService.createPlanDraft({
      caseId: created.caseId,
      semanticGraph: graph,
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

    const runId = `run-inbox-${label}-${suffix}`;
    await control.query(
      `INSERT INTO v8_execution_runs (run_id, organization_id, context_snapshot_id, initiator_user_id, goal)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (run_id) DO NOTHING`,
      [runId, fixture.orgId, `ctx-${runId}`, fixture.actorId, `goal ${label}`]
    );
    await runBindingService.bindRunToPlanVersion({
      runId,
      casePlanVersionId: published.casePlanVersionId,
      boundByActorId: fixture.actorId,
    });

    return { caseId: created.caseId, runId, projectId };
  }

  /** A wait carrying a CALLER-CHOSEN correlation key (the collision material). */
  async function seedWaitWithKey(
    fixture: { caseId: string; runId: string; actorId: string },
    correlationKey: string
  ): Promise<string> {
    const wait = await waitSubscriptionService.createWait(
      {
        caseId: fixture.caseId,
        runId: fixture.runId,
        waitType: 'EXTERNAL_CALLBACK',
        correlationKey,
        expectedEventType: 'vendor.signature.completed',
      },
      fixture.actorId
    );
    return wait.waitId;
  }

  function registerChannel(source: string): void {
    eventInboxService.registerInboxChannel({
      source,
      secret: CHANNEL_SECRET,
      principal: `principal:${source}`,
      allowedWaitTypes: ['EXTERNAL_CALLBACK'],
    });
  }

  /** A correctly signed delivery, signed through the service's OWN signer so
   *  the test cannot drift from the verifier it is exercising. */
  function signedDelivery(params: {
    source: string;
    eventId: string;
    organizationId: string;
    correlationKey: string;
    payload?: Record<string, unknown>;
    eventType?: string;
  }) {
    const payload = params.payload ?? { status: 'completed', vendorRef: 'V-1' };
    return {
      eventId: params.eventId,
      source: params.source,
      eventType: params.eventType ?? 'vendor.signature.completed',
      organizationId: params.organizationId,
      correlationKey: params.correlationKey,
      payload,
      signature: eventInboxService.computeInboxSignature(CHANNEL_SECRET, payload),
    };
  }

  async function readInboxRows(source: string): Promise<InboxDbRow[]> {
    const result = await control.query<InboxDbRow>(
      `SELECT * FROM case_workspace_event_inbox WHERE source = $1 ORDER BY received_at ASC`,
      [source]
    );
    return result.rows;
  }

  async function readWait(waitId: string): Promise<WaitDbRow | null> {
    const result = await control.query<WaitDbRow>(
      `SELECT wait_id, status, version, satisfied_by_event_id, satisfied_at
         FROM case_workspace_waits WHERE wait_id = $1`,
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

  async function teardown(params: {
    orgId: string;
    projectId: string;
    runId: string;
    source?: string;
  }): Promise<void> {
    if (params.source) {
      await control
        .query(`DELETE FROM case_workspace_event_inbox WHERE source = $1`, [params.source])
        .catch(() => undefined);
    }
    await control
      .query(`DELETE FROM case_workspace_event_inbox WHERE organization_id = $1`, [params.orgId])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM case_workspace_waits WHERE run_id = $1`, [params.runId])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM case_workspace_run_bindings WHERE run_id = $1`, [params.runId])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM v8_execution_runs WHERE run_id = $1`, [params.runId])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM case_core WHERE project_id = $1`, [params.projectId])
      .catch(() => undefined);
    await control.query(`DELETE FROM projects WHERE id = $1`, [params.projectId]).catch(() => undefined);
    await control
      .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [params.orgId])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM organization_members WHERE organization_id = $1`, [params.orgId])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM users WHERE organization_id = $1`, [params.orgId])
      .catch(() => undefined);
    await control.query(`DELETE FROM organizations WHERE id = $1`, [params.orgId]).catch(() => undefined);
  }

  // =========================================================================
  // 1. The same eventId delivered TWICE, sequentially -> ONE effect.
  // =========================================================================
  it('applies the first delivery and suppresses an identical redelivery, producing exactly one wait satisfaction', async () => {
    const fixture = await seedBoundRun('dup-seq');
    const source = `vendor-seq-${randomUUID()}`;
    try {
      const { waitId, correlationKey } = await seedExternalCallbackWait(fixture);
      registerChannel(source);
      const eventId = `evt-${randomUUID()}`;
      const delivery = signedDelivery({
        source,
        eventId,
        organizationId: fixture.orgId,
        correlationKey,
      });

      const first = await eventInboxService.receiveExternalEvent(delivery);
      expect(first.outcome).toBe('applied');

      const waitAfterFirst = await readWait(waitId);
      expect(waitAfterFirst?.status).toBe('SATISFIED');
      expect(waitAfterFirst?.satisfied_by_event_id).toBe(`${source}:${eventId}`);
      const versionAfterFirst = waitAfterFirst?.version;

      // The exact same delivery again.
      const second = await eventInboxService.receiveExternalEvent(delivery);
      expect(second.outcome).toBe('duplicate');
      if (second.outcome !== 'duplicate') throw new Error('unreachable');
      if (first.outcome !== 'applied') throw new Error('unreachable');
      expect(second.inboxRecordId).toBe(first.inboxRecordId);
      expect(second.appliedEffectRef).toBe(waitId);

      // ONE inbox row.
      const rows = await readInboxRows(source);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('APPLIED');
      expect(rows[0].wait_id).toBe(waitId);
      // The raw signature is never durable — only a digest.
      expect(rows[0].signature_digest).toMatch(/^sha256:[0-9a-f]{32}$/);
      expect(rows[0].payload_digest).toMatch(/^sha256:[0-9a-f]{64}$/);

      // And, decisively, ONE effect: the wait did not move again...
      const waitAfterSecond = await readWait(waitId);
      expect(waitAfterSecond?.version).toBe(versionAfterFirst);
      expect(waitAfterSecond).toEqual(waitAfterFirst);
      // ...and exactly one satisfaction event exists.
      expect(await countOutbox(waitId, 'wait.satisfied')).toBe(1);
    } finally {
      await teardown({ ...fixture, source });
    }
  }, 90_000);

  // =========================================================================
  // 2. The same eventId delivered CONCURRENTLY -> still ONE effect.
  // =========================================================================
  it('lets exactly one of two concurrent identical deliveries apply, and the other observe a duplicate', async () => {
    const fixture = await seedBoundRun('dup-par');
    const source = `vendor-par-${randomUUID()}`;
    try {
      const { waitId, correlationKey } = await seedExternalCallbackWait(fixture);
      registerChannel(source);
      const eventId = `evt-${randomUUID()}`;
      const delivery = signedDelivery({
        source,
        eventId,
        organizationId: fixture.orgId,
        correlationKey,
      });

      const results = await Promise.all([
        eventInboxService.receiveExternalEvent(delivery),
        eventInboxService.receiveExternalEvent(delivery),
      ]);

      const applied = results.filter((r) => r.outcome === 'applied');
      const duplicates = results.filter((r) => r.outcome === 'duplicate');
      expect(applied).toHaveLength(1);
      expect(duplicates).toHaveLength(1);

      const rows = await readInboxRows(source);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('APPLIED');

      const wait = await readWait(waitId);
      expect(wait?.status).toBe('SATISFIED');
      // The wait moved exactly once: created at version 1, satisfied to 2.
      expect(wait?.version).toBe(2);
      // The load-bearing assertion — one effect, not two.
      expect(await countOutbox(waitId, 'wait.satisfied')).toBe(1);
      expect(await countOutbox(rows[0].inbox_record_id, 'inbox.event_applied')).toBe(1);
    } finally {
      await teardown({ ...fixture, source });
    }
  }, 90_000);

  // =========================================================================
  // 3. A foreign tenant's claim is REJECTED and influences nothing.
  // =========================================================================
  it('rejects an event whose claimed organization differs from the wait\'s, leaving the wait untouched and recording the attempt', async () => {
    const fixture = await seedBoundRun('tenant');
    const foreign = await seedBoundRun('tenant-foreign');
    const source = `vendor-tenant-${randomUUID()}`;
    try {
      const { waitId, correlationKey } = await seedExternalCallbackWait(fixture);
      registerChannel(source);

      const waitBefore = await readWait(waitId);

      // Correctly SIGNED — the attacker holds the channel secret. Only the
      // tenancy check stands between them and another tenant's wait.
      const result = await eventInboxService.receiveExternalEvent(
        signedDelivery({
          source,
          eventId: `evt-${randomUUID()}`,
          organizationId: foreign.orgId,
          correlationKey,
        })
      );

      expect(result.outcome).toBe('rejected');
      if (result.outcome !== 'rejected') throw new Error('unreachable');
      // The rejection must name the REAL reason; disguising it as
      // CORRELATION_UNKNOWN would erase the attack signal.
      expect(result.rejectionCode).toBe('TENANT_MISMATCH');

      // ZERO effect on the wait.
      const waitAfter = await readWait(waitId);
      expect(waitAfter).toEqual(waitBefore);
      expect(waitAfter?.status).toBe('ACTIVE');
      expect(await countOutbox(waitId, 'wait.satisfied')).toBe(0);

      // But the attempt IS durable and auditable.
      const rows = await readInboxRows(source);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('REJECTED');
      expect(rows[0].rejection_code).toBe('TENANT_MISMATCH');
      expect(rows[0].wait_id).toBeNull();
      expect(rows[0].organization_id).toBe(foreign.orgId);
      expect(await countOutbox(rows[0].inbox_record_id, 'inbox.event_rejected')).toBe(1);

      // A rejected event id is consumed: a retry cannot re-run the gate.
      const retry = await eventInboxService.receiveExternalEvent(
        signedDelivery({
          source,
          eventId: rows[0].event_id,
          organizationId: fixture.orgId,
          correlationKey,
        })
      );
      expect(retry.outcome).toBe('duplicate');
      expect((await readWait(waitId))?.status).toBe('ACTIVE');
    } finally {
      await teardown({ ...fixture, source });
      await teardown(foreign);
    }
  }, 120_000);

  // =========================================================================
  // 4. Authentication precedes persistence.
  // =========================================================================
  it('refuses an unsigned/mis-signed delivery and an unknown channel WITHOUT writing any row', async () => {
    const fixture = await seedBoundRun('auth');
    const source = `vendor-auth-${randomUUID()}`;
    try {
      const { waitId, correlationKey } = await seedExternalCallbackWait(fixture);
      registerChannel(source);

      const bad = await eventInboxService.receiveExternalEvent({
        ...signedDelivery({
          source,
          eventId: `evt-${randomUUID()}`,
          organizationId: fixture.orgId,
          correlationKey,
        }),
        signature: 'f'.repeat(64),
      });
      expect(bad.outcome).toBe('unauthenticated');
      if (bad.outcome !== 'unauthenticated') throw new Error('unreachable');
      expect(bad.rejectionCode).toBe('SIGNATURE_INVALID');

      const unknownChannel = await eventInboxService.receiveExternalEvent(
        signedDelivery({
          source: `never-registered-${randomUUID()}`,
          eventId: `evt-${randomUUID()}`,
          organizationId: fixture.orgId,
          correlationKey,
        })
      );
      expect(unknownChannel.outcome).toBe('unauthenticated');

      // An unauthenticated caller must NOT be able to write. Otherwise it could
      // squat legitimate senders' event ids and suppress real callbacks.
      expect(await readInboxRows(source)).toHaveLength(0);
      expect((await readWait(waitId))?.status).toBe('ACTIVE');

      // A tampered payload under a signature computed for the ORIGINAL payload
      // must also fail — the signature covers the body, not just the ids.
      const original = { status: 'completed', amount: 100 };
      const tampered = await eventInboxService.receiveExternalEvent({
        eventId: `evt-${randomUUID()}`,
        source,
        eventType: 'vendor.signature.completed',
        organizationId: fixture.orgId,
        correlationKey,
        payload: { status: 'completed', amount: 999_999 },
        signature: eventInboxService.computeInboxSignature(CHANNEL_SECRET, original),
      });
      expect(tampered.outcome).toBe('unauthenticated');
      expect(await readInboxRows(source)).toHaveLength(0);
    } finally {
      await teardown({ ...fixture, source });
    }
  }, 90_000);

  // =========================================================================
  // 5. A late event does not reactivate a finished wait (§8).
  // =========================================================================
  it('records but does not apply a late callback for a wait that is no longer ACTIVE', async () => {
    const fixture = await seedBoundRun('late');
    const source = `vendor-late-${randomUUID()}`;
    try {
      const { waitId, correlationKey } = await seedExternalCallbackWait(fixture);
      registerChannel(source);

      await waitSubscriptionService.cancelWait(
        waitId,
        { actorUserId: fixture.actorId },
        'superseded-by-replan',
        1
      );
      const waitBefore = await readWait(waitId);
      expect(waitBefore?.status).toBe('CANCELLED');

      const late = await eventInboxService.receiveExternalEvent(
        signedDelivery({
          source,
          eventId: `evt-${randomUUID()}`,
          organizationId: fixture.orgId,
          correlationKey,
        })
      );
      expect(late.outcome).toBe('rejected');
      if (late.outcome !== 'rejected') throw new Error('unreachable');
      expect(late.rejectionCode).toBe('WAIT_NOT_ACTIVE');

      // "audited but do not reactivate" — both halves.
      expect(await readWait(waitId)).toEqual(waitBefore);
      const rows = await readInboxRows(source);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('REJECTED');
      expect(rows[0].rejection_code).toBe('WAIT_NOT_ACTIVE');
    } finally {
      await teardown({ ...fixture, source });
    }
  }, 90_000);

  // =========================================================================
  // 6. Unknown correlation, wrong event type, and the reconciliation surface.
  // =========================================================================
  it('rejects an unknown correlation key and an unexpected event type, and surfaces both in the reconciliation backlog', async () => {
    const fixture = await seedBoundRun('corr');
    const source = `vendor-corr-${randomUUID()}`;
    try {
      const { correlationKey } = await seedExternalCallbackWait(fixture);
      registerChannel(source);

      const unknown = await eventInboxService.receiveExternalEvent(
        signedDelivery({
          source,
          eventId: `evt-${randomUUID()}`,
          organizationId: fixture.orgId,
          correlationKey: `no-such-key-${randomUUID()}`,
        })
      );
      expect(unknown.outcome).toBe('rejected');
      if (unknown.outcome !== 'rejected') throw new Error('unreachable');
      expect(unknown.rejectionCode).toBe('CORRELATION_UNKNOWN');

      const wrongType = await eventInboxService.receiveExternalEvent(
        signedDelivery({
          source,
          eventId: `evt-${randomUUID()}`,
          organizationId: fixture.orgId,
          correlationKey,
          eventType: 'vendor.something.else',
        })
      );
      expect(wrongType.outcome).toBe('rejected');
      if (wrongType.outcome !== 'rejected') throw new Error('unreachable');
      expect(wrongType.rejectionCode).toBe('PAYLOAD_INVALID');

      const backlog = await eventInboxService.listInboxReconciliationBacklog({
        organizationId: fixture.orgId,
      });
      expect(backlog).toHaveLength(2);
      expect(backlog.map((b) => b.rejectionCode).sort()).toEqual([
        'CORRELATION_UNKNOWN',
        'PAYLOAD_INVALID',
      ]);
      // Rejections are terminal decisions — they must never sit in the pending
      // (retryable) backlog.
      const pending = await eventInboxService.getInboxBacklog({ organizationId: fixture.orgId });
      expect(pending.pending).toBe(0);
    } finally {
      await teardown({ ...fixture, source });
    }
  }, 90_000);

  // =========================================================================
  // 7. The redacted payload really is redacted, and dedup is per (source, id).
  // =========================================================================
  it('redacts the stored payload and scopes deduplication to (source, eventId) rather than eventId alone', async () => {
    const fixture = await seedBoundRun('redact');
    const sourceA = `vendor-a-${randomUUID()}`;
    const sourceB = `vendor-b-${randomUUID()}`;
    try {
      const first = await seedExternalCallbackWait(fixture);
      const second = await seedExternalCallbackWait(fixture);
      registerChannel(sourceA);
      registerChannel(sourceB);

      const sharedEventId = 'shared-provider-counter-12345';

      const a = await eventInboxService.receiveExternalEvent(
        signedDelivery({
          source: sourceA,
          eventId: sharedEventId,
          organizationId: fixture.orgId,
          correlationKey: first.correlationKey,
          payload: { status: 'completed', email: 'client@example.com', token: 'secret-bearer' },
        })
      );
      expect(a.outcome).toBe('applied');

      // The SAME event id from a DIFFERENT sender is a different event —
      // provider counters are only unique within a provider.
      const b = await eventInboxService.receiveExternalEvent(
        signedDelivery({
          source: sourceB,
          eventId: sharedEventId,
          organizationId: fixture.orgId,
          correlationKey: second.correlationKey,
        })
      );
      expect(b.outcome).toBe('applied');

      const rowsA = await readInboxRows(sourceA);
      expect(rowsA).toHaveLength(1);
      const stored = JSON.stringify(rowsA[0].redacted_payload);
      expect(stored).not.toContain('client@example.com');
      expect(stored).not.toContain('secret-bearer');
      // Non-sensitive facts survive — redaction, not deletion.
      expect(rowsA[0].redacted_payload.status).toBe('completed');
    } finally {
      await control
        .query(`DELETE FROM case_workspace_event_inbox WHERE source = ANY($1)`, [[sourceA, sourceB]])
        .catch(() => undefined);
      await teardown(fixture);
    }
  }, 90_000);

  // =========================================================================
  // 8. An AMBIGUOUS delivery leaves a DURABLE, DISTINGUISHABLE audit trail.
  //
  // WHAT THIS TRIES TO DISPROVE
  // ---------------------------
  // Until migration 20260810c the service folded AMBIGUOUS onto
  // CORRELATION_UNKNOWN, because `rejection_code` is a CHECK-constrained
  // vocabulary and an unknown value would have produced a 500 with NO audit
  // row. The two situations demand OPPOSITE operator actions:
  //
  //   CORRELATION_UNKNOWN    nobody registered this key   -> fix the SENDER
  //   CORRELATION_AMBIGUOUS  key registered several times -> fix the PAYLOAD
  //                          and the delivery named no Case   (send caseId)
  //
  // So "it got rejected" is NOT the property under test — a test asserting only
  // `outcome === 'rejected'` passed BEFORE the fix too. What must hold is that
  // the two rejections are TELLABLE APART in the durable record, specifically
  // in the reconciliation query the index
  // `idx_case_workspace_event_inbox_rejections (status, rejection_code,
  // received_at)` exists to serve. This test therefore runs BOTH kinds of bad
  // delivery and asserts the operator's GROUP BY separates them.
  // =========================================================================
  it('records an ambiguous correlation key under its OWN durable code, tellable apart from CORRELATION_UNKNOWN, and satisfies nothing', async () => {
    const fixture = await seedBoundRun('ambiguous');
    const second = await seedSecondBoundRunInSameOrg(fixture, 'ambiguous-2');
    const source = `vendor-ambiguous-${randomUUID()}`;
    try {
      registerChannel(source);

      // ONE key, TWO Cases in the SAME organization — the exact shape the
      // service calls AMBIGUOUS.
      const sharedKey = `corrkey-shared-${randomUUID()}`;
      const waitA = await seedWaitWithKey(fixture, sharedKey);
      const waitB = await seedWaitWithKey(
        { caseId: second.caseId, runId: second.runId, actorId: fixture.actorId },
        sharedKey
      );

      // The delivery names NO caseId, so nothing can disambiguate it.
      const ambiguous = await eventInboxService.receiveExternalEvent(
        signedDelivery({
          source,
          eventId: `evt-ambiguous-${randomUUID()}`,
          organizationId: fixture.orgId,
          correlationKey: sharedKey,
        })
      );

      expect(ambiguous.outcome).toBe('rejected');
      expect(ambiguous.rejectionCode).toBe('CORRELATION_AMBIGUOUS');

      // DURABLE — not just a return value. A code that only exists in the
      // response teaches an operator nothing.
      const rows = await readInboxRows(source);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('REJECTED');
      expect(rows[0].rejection_code).toBe('CORRELATION_AMBIGUOUS');
      // No wait may be attributed to a delivery whose target was never
      // established.
      expect(rows[0].wait_id).toBeNull();

      // The audit event carries HOW BAD (candidate count) next to WHAT.
      const audit = await control.query<{ redacted_summary: Record<string, unknown> }>(
        `SELECT redacted_summary FROM case_workspace_event_outbox
          WHERE aggregate_id = $1 AND event_type = 'inbox.event_rejected'`,
        [rows[0].inbox_record_id]
      );
      expect(audit.rows).toHaveLength(1);
      expect(audit.rows[0].redacted_summary.rejectionCode).toBe('CORRELATION_AMBIGUOUS');
      expect(audit.rows[0].redacted_summary.ambiguousCandidates).toBe(2);
      expect(audit.rows[0].redacted_summary.caseIdSupplied).toBe(false);

      // §9: an unestablished fact is neither yes nor no — BOTH waits are
      // untouched, and neither was silently picked as "close enough".
      for (const waitId of [waitA, waitB]) {
        const wait = await readWait(waitId);
        expect(wait?.status).toBe('ACTIVE');
        expect(wait?.satisfied_by_event_id).toBeNull();
        expect(wait?.satisfied_at).toBeNull();
      }

      // ── THE POINT OF THE MIGRATION ────────────────────────────────────────
      // A second bad delivery, this time with a key NOBODY registered.
      const unknown = await eventInboxService.receiveExternalEvent(
        signedDelivery({
          source,
          eventId: `evt-unknown-${randomUUID()}`,
          organizationId: fixture.orgId,
          correlationKey: `corrkey-never-registered-${randomUUID()}`,
        })
      );
      expect(unknown.outcome).toBe('rejected');
      expect(unknown.rejectionCode).toBe('CORRELATION_UNKNOWN');

      // The reconciliation view an operator actually runs. Before the fix this
      // returned ONE row (CORRELATION_UNKNOWN = 2) and the ambiguous delivery
      // was invisible inside it; it must now return TWO distinct groups.
      const grouped = await control.query<{ rejection_code: string; n: number }>(
        `SELECT rejection_code, count(*)::int AS n
           FROM case_workspace_event_inbox
          WHERE status = 'REJECTED' AND organization_id = $1
          GROUP BY rejection_code
          ORDER BY rejection_code`,
        [fixture.orgId]
      );
      expect(grouped.rows).toEqual([
        { rejection_code: 'CORRELATION_AMBIGUOUS', n: 1 },
        { rejection_code: 'CORRELATION_UNKNOWN', n: 1 },
      ]);

      // Rejections are terminal — neither may sit in the retryable backlog.
      const backlog = await eventInboxService.getInboxBacklog({
        organizationId: fixture.orgId,
      });
      expect(backlog.pending).toBe(0);
    } finally {
      await control
        .query(`DELETE FROM case_workspace_waits WHERE run_id = $1`, [second.runId])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM case_workspace_run_bindings WHERE run_id = $1`, [second.runId])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM v8_execution_runs WHERE run_id = $1`, [second.runId])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM case_core WHERE project_id = $1`, [second.projectId])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM projects WHERE id = $1`, [second.projectId])
        .catch(() => undefined);
      await teardown({ ...fixture, source });
    }
  }, 90_000);

  // =========================================================================
  // CW-T-B additions: channel-wide eventType allowlist + delivery-timestamp
  // tolerance, both exercised at the SERVICE layer (the HTTP layer is
  // exercised end-to-end in integration/inboxIngress.pg.test.ts).
  // =========================================================================

  it('rejects a channel-disallowed eventType as PAYLOAD_INVALID with a durable row, and admits an allowed one', async () => {
    const fixture = await seedBoundRun('evttype-allowlist');
    const source = `vendor-evttype-${randomUUID()}`;
    try {
      const { waitId, correlationKey } = await seedExternalCallbackWait(fixture);
      eventInboxService.registerInboxChannel({
        source,
        secret: CHANNEL_SECRET,
        principal: `principal:${source}`,
        allowedWaitTypes: ['EXTERNAL_CALLBACK'],
        allowedEventTypes: ['vendor.signature.completed'],
      });

      const disallowed = await eventInboxService.receiveExternalEvent(
        signedDelivery({
          source,
          eventId: `evt-${randomUUID()}`,
          organizationId: fixture.orgId,
          correlationKey,
          eventType: 'vendor.something.unexpected',
        })
      );
      expect(disallowed.outcome).toBe('rejected');
      if (disallowed.outcome !== 'rejected') throw new Error('unreachable');
      expect(disallowed.rejectionCode).toBe('PAYLOAD_INVALID');
      expect((await readWait(waitId))?.status).toBe('ACTIVE');

      const rows = await readInboxRows(source);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('REJECTED');
      expect(rows[0].rejection_code).toBe('PAYLOAD_INVALID');

      const allowed = await eventInboxService.receiveExternalEvent(
        signedDelivery({
          source,
          eventId: `evt-${randomUUID()}`,
          organizationId: fixture.orgId,
          correlationKey,
        })
      );
      expect(allowed.outcome).toBe('applied');
    } finally {
      await teardown({ ...fixture, source });
    }
  }, 90_000);

  it('isDeliveredAtWithinTolerance: fresh timestamps pass, stale and future-skewed ones fail, malformed input fails closed', () => {
    const now = Date.parse('2026-08-10T12:00:00.000Z');
    expect(
      eventInboxService.isDeliveredAtWithinTolerance('2026-08-10T11:58:00.000Z', { nowMs: now })
    ).toBe(true); // 2 min old, within the 5 min default
    expect(
      eventInboxService.isDeliveredAtWithinTolerance('2026-08-10T11:54:00.000Z', { nowMs: now })
    ).toBe(false); // 6 min old, past the 5 min default
    expect(
      eventInboxService.isDeliveredAtWithinTolerance('2026-08-10T12:00:30.000Z', { nowMs: now })
    ).toBe(true); // 30s in the future, within the 60s default skew
    expect(
      eventInboxService.isDeliveredAtWithinTolerance('2026-08-10T12:05:00.000Z', { nowMs: now })
    ).toBe(false); // 5 min in the future, beyond the 60s default skew
    expect(eventInboxService.isDeliveredAtWithinTolerance(undefined)).toBe(false);
    expect(eventInboxService.isDeliveredAtWithinTolerance('not-a-date')).toBe(false);
    expect(eventInboxService.isDeliveredAtWithinTolerance('')).toBe(false);
  });

  it('a channel wired to isDeliveredAtWithinTolerance rejects a stale payload.deliveredAt as PAYLOAD_INVALID (durable) and admits a fresh one', async () => {
    const fixture = await seedBoundRun('ts-tolerance');
    const source = `vendor-ts-${randomUUID()}`;
    try {
      const { waitId, correlationKey } = await seedExternalCallbackWait(fixture);
      eventInboxService.registerInboxChannel({
        source,
        secret: CHANNEL_SECRET,
        principal: `principal:${source}`,
        allowedWaitTypes: ['EXTERNAL_CALLBACK'],
        validatePayload: (payload) =>
          eventInboxService.isDeliveredAtWithinTolerance((payload as Record<string, unknown>).deliveredAt),
      });

      const stalePayload = {
        status: 'completed',
        deliveredAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h old
      };
      const stale = await eventInboxService.receiveExternalEvent({
        eventId: `evt-${randomUUID()}`,
        source,
        eventType: 'vendor.signature.completed',
        organizationId: fixture.orgId,
        correlationKey,
        payload: stalePayload,
        signature: eventInboxService.computeInboxSignature(CHANNEL_SECRET, stalePayload),
      });
      expect(stale.outcome).toBe('rejected');
      if (stale.outcome !== 'rejected') throw new Error('unreachable');
      expect(stale.rejectionCode).toBe('PAYLOAD_INVALID');
      expect((await readWait(waitId))?.status).toBe('ACTIVE');

      const freshPayload = { status: 'completed', deliveredAt: new Date().toISOString() };
      const fresh = await eventInboxService.receiveExternalEvent({
        eventId: `evt-${randomUUID()}`,
        source,
        eventType: 'vendor.signature.completed',
        organizationId: fixture.orgId,
        correlationKey,
        payload: freshPayload,
        signature: eventInboxService.computeInboxSignature(CHANNEL_SECRET, freshPayload),
      });
      expect(fresh.outcome).toBe('applied');
      expect((await readWait(waitId))?.status).toBe('SATISFIED');

      const rows = await readInboxRows(source);
      expect(rows.map((r) => r.status).sort()).toEqual(['APPLIED', 'REJECTED']);
    } finally {
      await teardown({ ...fixture, source });
    }
  }, 90_000);
});
