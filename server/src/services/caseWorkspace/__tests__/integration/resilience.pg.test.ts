/**
 * Case Workspace — STREAM E RESILIENCE GATE, proved against a REAL PostgreSQL.
 *
 * This suite does NOT re-prove what eventOutboxService.pg.test.ts,
 * eventInboxService.pg.test.ts, waitSubscriptionService.pg.test.ts,
 * integration/outboxWorker.pg.test.ts and integration/appendOnlyGuards.pg.test.ts
 * already prove (atomicity of a single publishEvent, dedup-by-eventId,
 * FOR UPDATE SKIP LOCKED concurrency, dead-letter after N attempts, restart
 * recovery of the production interval worker, database-level append-only
 * triggers, TENANT_MISMATCH/CORRELATION_AMBIGUOUS/WAIT_NOT_ACTIVE rejection,
 * lease claim/reclaim/heartbeat). Those suites are read first; this one closes
 * the specific gaps a fresh audit of this packet's own allowlist found that no
 * existing suite covers:
 *
 *   1. A DUAL-WRITE NEGATIVE CONTROL. Every existing atomicity test exercises
 *      the REAL (single-transaction) implementation and shows it behaves
 *      correctly. None of them build a deliberately WRONG two-transaction
 *      implementation and prove a reconciliation check actually flags it —
 *      i.e. proves the test methodology DISCRIMINATES rather than merely
 *      "passing because nothing was wrong to catch". Section 1 does that.
 *   2. A FIELD-NAME PII-REDACTION COLLISION AUDIT for the exact keys this
 *      packet's three services put in `redact({...})` calls. The known
 *      incident ("caseName -> [REDACTED] killed intake") happened because
 *      PiiRedactor.isPiiField() matches by SUBSTRING
 *      (server/src/utils/piiRedactor.ts:71-74) — a field is blanked if its
 *      lower-cased name merely CONTAINS a PII keyword, not only if it equals
 *      one. waitSubscriptionService.ts already dodged this once on purpose
 *      (`claimFencingCounter`, never `fencingToken` — see that file's own
 *      comment). Section 2 makes the audit executable instead of tribal
 *      knowledge, so a future field addition that reintroduces a collision
 *      turns this test red immediately.
 *   3. `eventInboxService.recordInboxProcessingFailure` HAD zero test coverage
 *      of its OWN retry/dead-letter transition logic anywhere in the repo, AND
 *      zero production caller — grepping `server/src` found none, because
 *      `receiveExternalEvent` always leaves a row at a TERMINAL status
 *      (APPLIED or REJECTED) inside the SAME transaction that inserted it, or
 *      rolls the INSERT back entirely on an uncaught exception, so no row it
 *      writes is ever durably left at RECEIVED for a later transient-failure
 *      handler to find. Section 3 proves the primitive itself is correct in
 *      isolation. Section 3b (added by the D3 packet) closes the "zero
 *      caller" half: `eventInboxService.runInboxReconciliationSweep()` — a
 *      REAL caller, wired into `outboxWorker.ts`'s periodic reconciliation
 *      cadence right alongside the pre-existing outbox dead-letter sweep —
 *      detects a row that violates the "always terminal, never durably
 *      RECEIVED" invariant above and calls `recordInboxProcessingFailure` on
 *      it for real, proved end-to-end including a fault-injection run that
 *      drives a manufactured stuck row all the way to DEAD_LETTER through
 *      repeated sweeps.
 *   4. A tampered-replay attack: an attacker who observed a genuine signed
 *      delivery mutates the payload and resends it under the SAME eventId.
 *      Existing tests cover "duplicate delivery" (identical payload) and
 *      "invalid signature" (garbage payload, garbage signature) separately;
 *      neither proves that a MODIFIED payload under a REUSED id is caught by
 *      signature verification rather than by dedup.
 *   5. An "operator sees the failure and sees the recovery" dashboard-shaped
 *      read: outbox backlog + inbox backlog + dead-letter counts + worker
 *      metrics all agree, BEFORE and AFTER recovery, in one story — the
 *      individual primitives are each tested elsewhere, but not asserted to
 *      cohere as the single read surface an operator would actually load.
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test \
 *   npx vitest run \
 *   src/services/caseWorkspace/__tests__/integration/resilience.pg.test.ts \
 *   --environment node
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import PiiRedactor from '../../../../utils/piiRedactor.js';
import { withPgTransaction } from '../../../../utils/queryHelpers.js';
import * as caseCoreService from '../../caseCoreService.js';
import * as casePlanVersionService from '../../casePlanVersionService.js';
import type { CanonicalGraph } from '../../casePlanVersionService.js';
import * as eventInboxService from '../../eventInboxService.js';
import * as eventOutboxService from '../../eventOutboxService.js';
import * as outboxWorker from '../../outboxWorker.js';
import * as runBindingService from '../../runBindingService.js';
import * as waitSubscriptionService from '../../waitSubscriptionService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const outbox = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_event_outbox'
          AND column_name IN ('event_id', 'causation_id', 'delivered_at')`
    );
    const inbox = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_event_inbox'
          AND column_name IN ('inbox_record_id', 'status', 'process_attempt_count')`
    );
    const history = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_history_events'
          AND column_name IN ('event_id', 'organization_id', 'case_id')`
    );
    return (
      Number(outbox.rows[0]?.present ?? 0) === 3 &&
      Number(inbox.rows[0]?.present ?? 0) === 3 &&
      Number(history.rows[0]?.present ?? 0) === 3
    );
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[resilience pg suite SKIPPED — clean skip, not a failure] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `case_workspace_event_outbox/inbox/history_events migrations applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;
const CHANNEL_SECRET = 'resilience-test-channel-secret-do-not-reuse';

suite('Stream E resilience gate — dual-write control, redaction audit, dead-letter, tamper-replay, operator view', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  afterEach(() => {
    eventOutboxService.clearOutboxDeliverySubscribers();
    eventInboxService.clearInboxChannels();
    outboxWorker._resetOutboxWorkerForTests();
  });

  // ===========================================================================
  // SECTION 1 — DUAL-WRITE NEGATIVE CONTROL
  // ===========================================================================
  describe('1. dual-write negative control', () => {
    function scope(label: string): { orgId: string; caseId: string } {
      const suffix = randomUUID();
      return {
        orgId: `cwres-org-${label}-${suffix}`,
        caseId: `cwres-case-${label}-${suffix}`,
      };
    }

    async function teardown(orgId: string, caseId: string): Promise<void> {
      await control
        .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM case_workspace_history_events WHERE organization_id = $1`, [orgId])
        .catch(() => undefined);
      void caseId;
    }

    /**
     * The reconciliation predicate a real operator/monitor would run: "every
     * committed domain-mutation (history) row must have a matching outbox
     * event whose causation_id names it". Returns the history event_ids that
     * have NO such match — i.e. a committed mutation nobody can prove emitted
     * a fact. This is deliberately independent of both code paths under test
     * below: it is a pure read, so it cannot be fooled by either
     * implementation's own bookkeeping.
     */
    async function findUnexplainedMutations(orgId: string): Promise<string[]> {
      const result = await control.query<{ event_id: string }>(
        `SELECT he.event_id
           FROM case_workspace_history_events he
          WHERE he.organization_id = $1
            AND NOT EXISTS (
              SELECT 1 FROM case_workspace_event_outbox eo
               WHERE eo.causation_id = he.event_id
            )`,
        [orgId]
      );
      return result.rows.map((r) => r.event_id);
    }

    async function insertHistoryRow(
      client: { query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }> },
      orgId: string,
      caseId: string,
      historyEventId: string
    ): Promise<void> {
      await client.query(
        `INSERT INTO case_workspace_history_events
           (event_id, organization_id, case_id, event_type, actor_id, occurred_at, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          historyEventId,
          orgId,
          caseId,
          'CASE_STATUS_CHANGED',
          'cwres-actor-dualwrite',
          new Date().toISOString(),
          'dual-write control write',
        ]
      );
    }

    it(
      'SIMULATED TWO-TRANSACTION implementation (domain commit, then a crash BEFORE the ' +
        'second transaction publishes the event) leaves a committed mutation with no matching ' +
        'outbox event — findUnexplainedMutations() DETECTS it (this is the negative control)',
      async () => {
        const { orgId, caseId } = scope('twotxn');
        const historyEventId = `cwhist-${randomUUID()}`;
        try {
          // ---- THE DELIBERATELY WRONG IMPLEMENTATION --------------------------
          // Transaction 1: the domain mutation. COMMITS on its own, exactly what
          // a two-transaction ("save the aggregate, then separately emit the
          // event") implementation would do.
          await withPgTransaction((client) => insertHistoryRow(client, orgId, caseId, historyEventId));

          // "Then the worker is killed before transaction 2 runs" — modelled by
          // simply never calling publishEvent for this mutation. This is
          // exactly docs/product/case-workspace/06_SECURITY_EVENTS_OBSERVABILITY.md
          // §12's own named negative test ("kill worker … after domain commit
          // before outbox publication"), reproduced here as an EXPLICIT
          // simulated-bad-implementation rather than an implicit crash.

          // ---- THE DETECTOR -----------------------------------------------------
          const gaps = await findUnexplainedMutations(orgId);
          expect(gaps).toContain(historyEventId);
          expect(gaps.length).toBeGreaterThan(0);
        } finally {
          await teardown(orgId, caseId);
        }
      },
      30_000
    );

    it(
      'the REAL production path (domain mutation + publishEvent in ONE withPgTransaction) leaves ' +
        'no reconciliation gap for the SAME shape of mutation — proving the detector above is ' +
        'discriminating, not a tautology that always finds something',
      async () => {
        const { orgId, caseId } = scope('onetxn');
        const historyEventId = `cwhist-${randomUUID()}`;
        try {
          await withPgTransaction(async (client) => {
            await insertHistoryRow(client, orgId, caseId, historyEventId);
            await eventOutboxService.publishEvent(client, {
              eventType: 'case.status_changed',
              organizationId: orgId,
              aggregateType: 'CASE',
              aggregateId: caseId,
              caseId,
              actorUserId: 'cwres-actor-dualwrite',
              causationId: historyEventId,
              redactedSummary: { caseStatus: 'ACTIVE' },
            });
          });

          const gaps = await findUnexplainedMutations(orgId);
          expect(gaps).toEqual([]);
        } finally {
          await teardown(orgId, caseId);
        }
      },
      30_000
    );

    it(
      'a two-transaction implementation where transaction 2 (event publish) commits but ' +
        'transaction 1 (domain mutation) then rolls back is likewise detected — an outbox ' +
        'event with no committed mutation is the MIRROR-IMAGE dual-write hole (a fact asserted ' +
        'about something that never actually happened)',
      async () => {
        const { orgId, caseId } = scope('mirror');
        const eventId = `cwevt-${randomUUID()}`;
        try {
          // Transaction 2 (the event) commits on its own, exactly what a
          // two-transaction implementation would do if the EVENT write ran
          // first (or the domain write's own transaction later rolled back
          // for an unrelated reason after the event was already durable).
          await withPgTransaction((client) =>
            eventOutboxService.publishEvent(client, {
              eventId,
              eventType: 'case.status_changed',
              organizationId: orgId,
              aggregateType: 'CASE',
              aggregateId: caseId,
              caseId,
              actorUserId: 'cwres-actor-dualwrite',
              redactedSummary: { caseStatus: 'ACTIVE' },
            })
          );
          // Transaction 1 (the domain mutation) never committed at all.

          const orphanEvent = await control.query<{ event_id: string }>(
            `SELECT eo.event_id
               FROM case_workspace_event_outbox eo
              WHERE eo.organization_id = $1
                AND NOT EXISTS (
                  SELECT 1 FROM case_workspace_history_events he
                   WHERE he.case_id = eo.case_id AND he.organization_id = eo.organization_id
                )`,
            [orgId]
          );
          expect(orphanEvent.rows.map((r) => r.event_id)).toContain(eventId);
        } finally {
          await teardown(orgId, caseId);
        }
      },
      30_000
    );
  });

  // ===========================================================================
  // SECTION 2 — PII-REDACTION FIELD-NAME COLLISION AUDIT (pure, no DB)
  // ===========================================================================
  describe('2. PII redaction field-name collision audit', () => {
    /**
     * Every key this packet's THREE in-scope services (eventOutboxService.ts,
     * eventInboxService.ts, waitSubscriptionService.ts) pass as a KEY inside a
     * `redact({...})` call, gathered by reading every such call site as of this
     * packet. Grouped by source file/function so a reviewer can find where a
     * failing key actually comes from.
     */
    const FIELD_NAMES_BY_SITE: Record<string, string[]> = {
      'eventInboxService.reject()': [
        'source',
        'externalEventType',
        'rejectionCode',
        'correlationKey',
        'disallowedEventType',
        'ambiguousCandidates',
        'caseIdSupplied',
        'expectedEventType',
        'waitStatus',
      ],
      'eventInboxService applied/dead-letter events': [
        'source',
        'externalEventType',
        'correlationKey',
        'satisfiedWaitId',
        'waitType',
        'attempts',
      ],
      'waitSubscriptionService.createWait()': [
        'waitType',
        'status',
        'correlationKey',
        'expectedEventType',
        'dueAt',
        'timeoutAt',
        'actionProposalId',
      ],
      'waitSubscriptionService claim/renew/reclaim': [
        'waitType',
        'claimFencingCounter',
        'leaseMs',
        'leaseExpiresAt',
        'dueAt',
        'previousLeaseExpired',
        'reconciliation',
      ],
      'waitSubscriptionService.satisfyWaitOnClient()/applySimpleWaitTransition()': [
        'waitType',
        'from',
        'to',
        'correlationKey',
        'dueAt',
        'timeoutAt',
        'satisfiedByEventId',
        'satisfiedByEventLedger',
        'satisfiedByBinding',
        'satisfiedBySource',
        'satisfiedByInboxRecordId',
        'reasonClass',
        'reasonDigest',
      ],
    };

    it('none of this packet\'s redacted-summary field names are themselves treated as PII by PiiRedactor (the "caseName -> [REDACTED]" class of bug)', () => {
      const collisions: string[] = [];

      for (const [site, keys] of Object.entries(FIELD_NAMES_BY_SITE)) {
        // A distinct, recognizable sentinel value per key so a false match is
        // unambiguous in the failure output.
        const sample: Record<string, unknown> = {};
        for (const key of keys) sample[key] = `SENTINEL_VALUE_${key}`;

        const redacted = PiiRedactor.redact(sample) as Record<string, unknown>;

        for (const key of keys) {
          if (redacted[key] === PiiRedactor.REDACTION_PLACEHOLDER) {
            collisions.push(`${site}: "${key}"`);
          }
        }
      }

      expect(collisions).toEqual([]);
    });

    it('documents the ONE known deliberate near-miss (claimFencingCounter, not fencingToken) still resolves correctly and its rejected sibling name would in fact collide', () => {
      const safe = PiiRedactor.redact({ claimFencingCounter: 7 }) as Record<string, unknown>;
      expect(safe.claimFencingCounter).toBe(7);

      // Proves the audit's OWN methodology is not vacuous: a field genuinely
      // named with the substring "token" IS caught, which is why
      // waitSubscriptionService.ts deliberately never uses this name.
      const wouldHaveCollided = PiiRedactor.redact({ fencingToken: 7 }) as Record<string, unknown>;
      expect(wouldHaveCollided.fencingToken).toBe(PiiRedactor.REDACTION_PLACEHOLDER);
    });

    it('flags the residual risk: reconcile()-supplied verdict.detail (waitSubscriptionService reclaimExpiredTimerWaitClaim) is CALLER-CONTROLLED and not covered by the audit above', () => {
      // Not a bug in this packet — verdict.detail is deliberately opaque
      // caller data (§8 reconciliation detail) and IS still run through
      // redact() before it reaches the outbox (see reclaimExpiredTimerWaitClaim's
      // `redactedSummary: redact({ ..., reconciliation: verdict.detail ?? {} })`).
      // This test only documents that a future caller whose reconcile()
      // returns e.g. `{ customerName: 'Acme Corp' }` WILL see that key
      // redacted — which is over-redaction, the safe failure direction, not
      // under-redaction.
      const callerSupplied = { customerName: 'Acme Corp', effectRef: 'stripe_charge_123' };
      const redacted = PiiRedactor.redact({ reconciliation: callerSupplied }) as {
        reconciliation: Record<string, unknown>;
      };
      expect(redacted.reconciliation.customerName).toBe(PiiRedactor.REDACTION_PLACEHOLDER);
      expect(redacted.reconciliation.effectRef).toBe('stripe_charge_123');
    });
  });

  // ===========================================================================
  // SECTION 3 — recordInboxProcessingFailure: the unit-level proof the
  // primitive is correct. See Section 3b below for the REAL production
  // caller (runInboxReconciliationSweep, wired into outboxWorker.ts's
  // periodic cadence) — this section is retained as-is because it still
  // proves the primitive's OWN transition logic in isolation, which 3b does
  // not re-prove.
  // ===========================================================================
  describe('3. recordInboxProcessingFailure — retry + dead-letter transition (unit-level proof of the primitive)', () => {
    async function insertReceivedInboxRow(suffix: string, orgId: string): Promise<string> {
      const inboxRecordId = `cwinbox-res-${suffix}`;
      await control.query(
        `INSERT INTO case_workspace_event_inbox
           (inbox_record_id, event_id, source, event_type, organization_id, correlation_key, payload_digest)
         VALUES ($1, $2, 'cwres-webhook', 'signature.completed', $3, $4, 'sha256:cwres')`,
        [inboxRecordId, `ext-evt-${suffix}`, orgId, `corrkey-${suffix}`]
      );
      return inboxRecordId;
    }

    async function teardown(orgId: string): Promise<void> {
      await control
        .query(`DELETE FROM case_workspace_event_inbox WHERE organization_id = $1`, [orgId])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
        .catch(() => undefined);
    }

    it('increments process_attempt_count and records last_process_error on a transient failure, leaving status RECEIVED below the threshold', async () => {
      const suffix = randomUUID();
      const orgId = `cwres-inbox-org-${suffix}`;
      try {
        const inboxRecordId = await insertReceivedInboxRow(suffix, orgId);

        const updated = await eventInboxService.recordInboxProcessingFailure(
          inboxRecordId,
          new Error('downstream projection unavailable')
        );

        expect(updated?.status).toBe('RECEIVED');
        expect(updated?.processAttemptCount).toBe(1);
        expect(updated?.lastProcessError).toBe('downstream projection unavailable');

        const row = await eventInboxService.getInboxRecord(inboxRecordId);
        expect(row?.processAttemptCount).toBe(1);
      } finally {
        await teardown(orgId);
      }
    });

    it('crosses INBOX_DEAD_LETTER_ATTEMPT_THRESHOLD, flips to DEAD_LETTER, sets processed_at, and emits ONE inbox.event_dead_lettered outbox event on the transition attempt (never before, never twice)', async () => {
      const suffix = randomUUID();
      const orgId = `cwres-inbox-org-${suffix}`;
      try {
        const inboxRecordId = await insertReceivedInboxRow(suffix, orgId);

        let last: Awaited<ReturnType<typeof eventInboxService.recordInboxProcessingFailure>> = null;
        for (let attempt = 1; attempt <= eventInboxService.INBOX_DEAD_LETTER_ATTEMPT_THRESHOLD; attempt += 1) {
          last = await eventInboxService.recordInboxProcessingFailure(
            inboxRecordId,
            new Error(`attempt ${attempt} failed`)
          );
          if (attempt < eventInboxService.INBOX_DEAD_LETTER_ATTEMPT_THRESHOLD) {
            expect(last?.status).toBe('RECEIVED');
          }
        }

        expect(last?.status).toBe('DEAD_LETTER');
        expect(last?.processAttemptCount).toBe(eventInboxService.INBOX_DEAD_LETTER_ATTEMPT_THRESHOLD);
        expect(last?.processedAt).not.toBeNull();

        const dlEvents = await control.query<{ event_id: string; redacted_summary: Record<string, unknown> }>(
          `SELECT event_id, redacted_summary FROM case_workspace_event_outbox
            WHERE organization_id = $1 AND event_type = 'inbox.event_dead_lettered'`,
          [orgId]
        );
        expect(dlEvents.rows).toHaveLength(1);
        expect(dlEvents.rows[0]?.redacted_summary).toMatchObject({
          attempts: eventInboxService.INBOX_DEAD_LETTER_ATTEMPT_THRESHOLD,
        });

        // A further call must be a no-op: a REJECTED-equivalent terminal row
        // (DEAD_LETTER is terminal too) must never be touched again — the
        // function's own WHERE clause requires status = 'RECEIVED'.
        const noop = await eventInboxService.recordInboxProcessingFailure(
          inboxRecordId,
          new Error('post-dead-letter call must be a no-op')
        );
        expect(noop).toBeNull();
        const stillOne = await control.query<{ n: string }>(
          `SELECT count(*) AS n FROM case_workspace_event_outbox
            WHERE organization_id = $1 AND event_type = 'inbox.event_dead_lettered'`,
          [orgId]
        );
        expect(Number(stillOne.rows[0]?.n)).toBe(1);
      } finally {
        await teardown(orgId);
      }
    }, 30_000);

    it('is a no-op (returns null, mutates nothing) against a REJECTED row — a rejection is a decision, never a retry candidate', async () => {
      const suffix = randomUUID();
      const orgId = `cwres-inbox-org-${suffix}`;
      try {
        const inboxRecordId = await insertReceivedInboxRow(suffix, orgId);
        await control.query(
          `UPDATE case_workspace_event_inbox SET status = 'REJECTED', rejection_code = 'PAYLOAD_INVALID', processed_at = now() WHERE inbox_record_id = $1`,
          [inboxRecordId]
        );

        const result = await eventInboxService.recordInboxProcessingFailure(
          inboxRecordId,
          new Error('must not touch a rejected row')
        );
        expect(result).toBeNull();

        const row = await eventInboxService.getInboxRecord(inboxRecordId);
        expect(row?.status).toBe('REJECTED');
        expect(row?.processAttemptCount).toBe(0);
      } finally {
        await teardown(orgId);
      }
    });
  });

  // ===========================================================================
  // SECTION 3b (D3 packet) — runInboxReconciliationSweep: the REAL production
  // caller of recordInboxProcessingFailure, and the fault-injection proof that
  // wiring is real, not merely present in the source file.
  //
  // WHY A "STUCK RECEIVED ROW" HAS TO BE MANUFACTURED, NOT PRODUCED
  // -----------------------------------------------------------------------
  // eventInboxService.runInboxReconciliationSweep()'s own header proves
  // receiveExternalEvent() is atomic (one withPgTransaction, rolled back
  // whole on any failure), so under NORMAL operation NO row is EVER durably
  // observable at status='RECEIVED' — the sweep's whole reason to exist is to
  // detect the invariant being violated, which by construction cannot happen
  // through the real ingress path. This section manufactures the violation
  // directly via raw SQL (the same technique Section 3 above already uses),
  // which is the ONLY way to exercise this code at all — precisely mirroring
  // how a real stuck row could arise (a future two-phase caller with a bug,
  // an operator backfill, a compromised credential), not a synthetic
  // shortcut around a real scenario.
  // ===========================================================================
  describe('3b. runInboxReconciliationSweep — the real wired caller of recordInboxProcessingFailure', () => {
    async function insertReceivedInboxRowWithAge(
      suffix: string,
      orgId: string,
      ageMs: number
    ): Promise<string> {
      const inboxRecordId = `cwinbox-sweep-${suffix}`;
      await control.query(
        `INSERT INTO case_workspace_event_inbox
           (inbox_record_id, event_id, source, event_type, organization_id, correlation_key, payload_digest, received_at)
         VALUES ($1, $2, 'cwres-sweep-webhook', 'signature.completed', $3, $4, 'sha256:cwressweep', now() - ($5 || ' milliseconds')::interval)`,
        [inboxRecordId, `ext-evt-sweep-${suffix}`, orgId, `corrkey-sweep-${suffix}`, String(ageMs)]
      );
      return inboxRecordId;
    }

    async function teardown(orgId: string): Promise<void> {
      await control
        .query(`DELETE FROM case_workspace_event_inbox WHERE organization_id = $1`, [orgId])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
        .catch(() => undefined);
    }

    it('ignores a RECEIVED row younger than staleAfterMs — a merely-in-flight row must never be touched', async () => {
      const suffix = randomUUID();
      const orgId = `cwres-sweep-org-${suffix}`;
      try {
        const inboxRecordId = await insertReceivedInboxRowWithAge(suffix, orgId, 1_000); // 1s old

        const sweep = await eventInboxService.runInboxReconciliationSweep({
          organizationId: orgId,
          staleAfterMs: 5 * 60 * 1000,
        });

        expect(sweep).toEqual({ staleCount: 0, sample: [] });
        const row = await eventInboxService.getInboxRecord(inboxRecordId);
        expect(row?.status).toBe('RECEIVED');
        expect(row?.processAttemptCount).toBe(0);
      } finally {
        await teardown(orgId);
      }
    });

    it('finds a row manufactured stuck at RECEIVED past staleAfterMs, calls the REAL recordInboxProcessingFailure through the sweep (not a direct unit call), and reports it in the sample', async () => {
      const suffix = randomUUID();
      const orgId = `cwres-sweep-org-${suffix}`;
      try {
        const staleInboxRecordId = await insertReceivedInboxRowWithAge(suffix, orgId, 10 * 60 * 1000); // 10 min old
        const freshSuffix = `${suffix}-fresh`;
        const freshInboxRecordId = await insertReceivedInboxRowWithAge(freshSuffix, orgId, 1_000); // 1s old — control

        const sweep = await eventInboxService.runInboxReconciliationSweep({
          organizationId: orgId,
          staleAfterMs: 5 * 60 * 1000,
        });

        expect(sweep.staleCount).toBe(1);
        expect(sweep.sample).toEqual([
          expect.objectContaining({
            inboxRecordId: staleInboxRecordId,
            source: 'cwres-sweep-webhook',
            eventType: 'signature.completed',
            organizationId: orgId,
          }),
        ]);
        expect(sweep.sample[0]!.ageMs).toBeGreaterThanOrEqual(10 * 60 * 1000 - 2_000);

        // THE DECISIVE PROOF: the stale row was actually processed by
        // recordInboxProcessingFailure (process_attempt_count incremented,
        // last_process_error set to the sweep's own diagnostic message) —
        // reached through runInboxReconciliationSweep, never called directly
        // in this test.
        const processedRow = await eventInboxService.getInboxRecord(staleInboxRecordId);
        expect(processedRow?.status).toBe('RECEIVED'); // one attempt, below INBOX_DEAD_LETTER_ATTEMPT_THRESHOLD
        expect(processedRow?.processAttemptCount).toBe(1);
        expect(processedRow?.lastProcessError).toContain('inbox_reconciliation_stale_received');

        // The young control row is UNTOUCHED — the sweep is not a blunt
        // "touch everything RECEIVED" operation.
        const untouchedRow = await eventInboxService.getInboxRecord(freshInboxRecordId);
        expect(untouchedRow?.status).toBe('RECEIVED');
        expect(untouchedRow?.processAttemptCount).toBe(0);
      } finally {
        await teardown(orgId);
      }
    });

    it('FAULT INJECTION: repeated sweeps drive a genuinely stuck row through retry to DEAD_LETTER, exactly like a real stuck-inbox incident would resolve — never silently stuck forever', async () => {
      const suffix = randomUUID();
      const orgId = `cwres-sweep-org-${suffix}`;
      try {
        const inboxRecordId = await insertReceivedInboxRowWithAge(
          suffix,
          orgId,
          eventInboxService.RECEIVED_STALE_AFTER_MS + 60_000
        );

        let lastSweep: Awaited<ReturnType<typeof eventInboxService.runInboxReconciliationSweep>> | null = null;
        for (let attempt = 1; attempt <= eventInboxService.INBOX_DEAD_LETTER_ATTEMPT_THRESHOLD; attempt += 1) {
          lastSweep = await eventInboxService.runInboxReconciliationSweep({ organizationId: orgId });
          const row = await eventInboxService.getInboxRecord(inboxRecordId);
          if (attempt < eventInboxService.INBOX_DEAD_LETTER_ATTEMPT_THRESHOLD) {
            // Still RECEIVED and therefore still "stale" by the sweep's own
            // criteria (received_at does not move) — it keeps being found and
            // retried on every sweep, exactly as an ops-facing reconciliation
            // loop is supposed to behave.
            expect(row?.status).toBe('RECEIVED');
            expect(row?.processAttemptCount).toBe(attempt);
            expect(lastSweep!.staleCount).toBe(1);
          }
        }

        const finalRow = await eventInboxService.getInboxRecord(inboxRecordId);
        expect(finalRow?.status).toBe('DEAD_LETTER');
        expect(finalRow?.processAttemptCount).toBe(eventInboxService.INBOX_DEAD_LETTER_ATTEMPT_THRESHOLD);

        // Dead-lettered => no longer "RECEIVED", so a further sweep finds
        // nothing left to do for this row — it stops being reconciliation
        // work and becomes a durably readable historical fact instead.
        const sweepAfterDeadLetter = await eventInboxService.runInboxReconciliationSweep({
          organizationId: orgId,
        });
        expect(sweepAfterDeadLetter).toEqual({ staleCount: 0, sample: [] });

        // The dead-letter transition itself durably emitted the real event
        // (recordInboxProcessingFailure's own behavior, reached here through
        // the sweep, not a direct call).
        const dlEvents = await control.query<{ n: string }>(
          `SELECT count(*) AS n FROM case_workspace_event_outbox
            WHERE organization_id = $1 AND event_type = 'inbox.event_dead_lettered'`,
          [orgId]
        );
        expect(Number(dlEvents.rows[0]?.n)).toBe(1);
      } finally {
        await teardown(orgId);
      }
    }, 90_000); // 10 sequential sweeps, each a real DB round trip — generous budget under a loaded shared Postgres.

    it('outboxWorker.runCaseWorkspaceInboxReconciliationSweep mirrors the sweep result onto getOutboxWorkerMetrics(), same as the outbox dead-letter sample', async () => {
      const suffix = randomUUID();
      const orgId = `cwres-sweep-org-${suffix}`;
      try {
        const inboxRecordId = await insertReceivedInboxRowWithAge(suffix, orgId, 10 * 60 * 1000);

        expect(outboxWorker.getOutboxWorkerMetrics().lastInboxStaleSample).toEqual([]);

        const sweep = await outboxWorker.runCaseWorkspaceInboxReconciliationSweep({
          organizationId: orgId,
          staleAfterMs: 5 * 60 * 1000,
        });
        expect(sweep.staleCount).toBe(1);

        const metrics = outboxWorker.getOutboxWorkerMetrics();
        expect(metrics.lastInboxStaleSample).toEqual(sweep.sample);
        expect(metrics.lastInboxReconciliationAt).not.toBeNull();

        const row = await eventInboxService.getInboxRecord(inboxRecordId);
        expect(row?.processAttemptCount).toBe(1);
      } finally {
        await teardown(orgId);
      }
    });
  });

  // ===========================================================================
  // SECTION 4 — TAMPERED REPLAY: a real signed delivery, then the SAME eventId
  // resent with a MODIFIED payload (not merely an invalid signature on garbage,
  // and not merely an identical duplicate).
  // ===========================================================================
  describe('4. tampered replay (reused eventId, modified payload)', () => {
    async function seedMemberedUser(orgId: string, label: string): Promise<string> {
      const userId = `cwres-user-${label}-${randomUUID()}`;
      await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
        userId,
        orgId,
        `${userId}@example.test`,
      ]);
      await control.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
           VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE')`,
        [`cwres-member-${randomUUID()}`, orgId, userId]
      );
      return userId;
    }

    async function seedBoundRun(label: string): Promise<{
      orgId: string;
      projectId: string;
      caseId: string;
      runId: string;
      actorId: string;
    }> {
      const suffix = randomUUID();
      const orgId = `cwres-org-${label}-${suffix}`;
      const projectId = `cwres-project-${label}-${suffix}`;
      await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
        orgId,
        `Resilience test org (${label})`,
      ]);
      await control.query(
        `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
        [projectId, orgId, `Resilience test project (${label})`]
      );
      const actorId = await seedMemberedUser(orgId, label);
      const created = await caseCoreService.createCase({
        projectId,
        organizationId: orgId,
        caseName: `Resilience test case (${label})`,
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

      const runId = `run-res-${label}-${suffix}`;
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

    async function teardown(fixture: {
      orgId: string;
      projectId: string;
      runId: string;
    }): Promise<void> {
      await control
        .query(`DELETE FROM case_workspace_event_inbox WHERE organization_id = $1`, [fixture.orgId])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM case_workspace_waits WHERE run_id = $1`, [fixture.runId])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM case_workspace_run_bindings WHERE run_id = $1`, [fixture.runId])
        .catch(() => undefined);
      await control.query(`DELETE FROM v8_execution_runs WHERE run_id = $1`, [fixture.runId]).catch(() => undefined);
      await control
        .query(`DELETE FROM case_core WHERE project_id = $1`, [fixture.projectId])
        .catch(() => undefined);
      await control.query(`DELETE FROM projects WHERE id = $1`, [fixture.projectId]).catch(() => undefined);
      await control
        .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [fixture.orgId])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM organization_members WHERE organization_id = $1`, [fixture.orgId])
        .catch(() => undefined);
      await control.query(`DELETE FROM users WHERE organization_id = $1`, [fixture.orgId]).catch(() => undefined);
      await control.query(`DELETE FROM organizations WHERE id = $1`, [fixture.orgId]).catch(() => undefined);
    }

    it('a genuine signed delivery applies, then the SAME eventId resent with a TAMPERED payload and a signature copied from the original is rejected as SIGNATURE_INVALID — not silently treated as the harmless duplicate it would look like by eventId alone', async () => {
      const fixture = await seedBoundRun('tamper');
      try {
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

        eventInboxService.registerInboxChannel({
          source: 'cwres-tamper-webhook',
          secret: CHANNEL_SECRET,
          principal: 'cwres-tamper-principal',
        });

        const eventId = `ext-evt-${randomUUID()}`;
        const originalPayload = { correlationKey, documentId: 'doc-original-123' };
        const originalSignature = eventInboxService.computeInboxSignature(CHANNEL_SECRET, originalPayload);

        const first = await eventInboxService.receiveExternalEvent({
          eventId,
          source: 'cwres-tamper-webhook',
          eventType: 'vendor.signature.completed',
          organizationId: fixture.orgId,
          correlationKey,
          caseId: fixture.caseId,
          runId: fixture.runId,
          payload: originalPayload,
          signature: originalSignature,
        });
        expect(first.outcome).toBe('applied');

        // Attacker (or a corrupted retry) replays the SAME eventId with a
        // DIFFERENT payload but presents the ORIGINAL signature — the only
        // one it ever observed. computeInboxSignature is over the payload, so
        // this signature does not match the tampered payload's own HMAC.
        const tamperedPayload = { correlationKey, documentId: 'doc-SUBSTITUTED-attacker-controlled' };
        const replay = await eventInboxService.receiveExternalEvent({
          eventId,
          source: 'cwres-tamper-webhook',
          eventType: 'vendor.signature.completed',
          organizationId: fixture.orgId,
          correlationKey,
          caseId: fixture.caseId,
          runId: fixture.runId,
          payload: tamperedPayload,
          signature: originalSignature,
        });

        // Caught by signature verification (recomputed over the tampered body),
        // NOT by the (source, eventId) dedup index — the two are different
        // defences and this proves signature verification runs first and
        // independently of dedup, exactly as GATE 1 precedes GATE 2.
        expect(replay.outcome).toBe('unauthenticated');
        if (replay.outcome === 'unauthenticated') {
          expect(replay.rejectionCode).toBe('SIGNATURE_INVALID');
        }

        // The original applied record is untouched (append-only guard) and no
        // second inbox row (rejected or otherwise) was written for the
        // unauthenticated attempt — GATE 1 failures write nothing at all.
        const rows = await control.query<{ status: string }>(
          `SELECT status FROM case_workspace_event_inbox WHERE source = $1 AND event_id = $2`,
          ['cwres-tamper-webhook', eventId]
        );
        expect(rows.rows).toHaveLength(1);
        expect(rows.rows[0]?.status).toBe('APPLIED');

        const waitAfter = await waitSubscriptionService.getWait(wait.waitId, fixture.actorId);
        expect(waitAfter?.status).toBe('SATISFIED');
      } finally {
        await teardown(fixture);
      }
    }, 60_000); // D3 packet: heavier fixture (Case+Plan+Run) observed timing out at 30s under a loaded shared Postgres — widened, no assertion changed.
  });

  // ===========================================================================
  // SECTION 5 — OPERATOR VIEW: outbox backlog, inbox backlog, dead-letter and
  // worker metrics read together, before and after recovery, as one story.
  // ===========================================================================
  describe('5. operator dashboard view coheres across a failure-and-recovery episode', () => {
    it('backlog, dead-letter count and worker metrics all agree at each stage of publish -> partial failure -> dead-letter -> recovery', async () => {
      const suffix = randomUUID();
      const orgId = `cwres-dash-org-${suffix}`;
      const caseId = `cwres-dash-case-${suffix}`;
      try {
        const publish = (eventId: string) =>
          withPgTransaction((client) =>
            eventOutboxService.publishEvent(client, {
              eventId,
              eventType: 'case.status_changed',
              organizationId: orgId,
              aggregateType: 'CASE',
              aggregateId: caseId,
              caseId,
              actorUserId: 'cwres-dash-actor',
              redactedSummary: { caseStatus: 'ACTIVE' },
            })
          );

        const goodEventId = `cwevt-good-${randomUUID()}`;
        const badEventId = `cwevt-bad-${randomUUID()}`;
        await publish(goodEventId);
        await publish(badEventId);

        // A durable consumer that fails ONLY the bad event, every time.
        const unsub = eventOutboxService.subscribeToOutboxDelivery(async (event) => {
          if (event.eventId === badEventId) throw new Error('simulated durable-consumer failure');
        });

        try {
          // Drive the bad event to dead-letter; the good one delivers on the
          // very first tick and must never be reprocessed on later ticks.
          // §8 PER-ROW backoff (server/migrations/
          // 20260812a_case_workspace_outbox_next_retry_at.sql) means the bad
          // event is not reclaimable on the very next tick anymore — fast-
          // forward its next_retry_at between iterations, same "ops retry
          // now" shape outboxWorker.pg.test.ts's own suite uses.
          for (let i = 0; i < eventOutboxService.DEAD_LETTER_ATTEMPT_THRESHOLD; i += 1) {
            if (i > 0) {
              await control.query(
                `UPDATE case_workspace_event_outbox
                    SET next_retry_at = now() - interval '1 second'
                  WHERE organization_id = $1 AND delivered_at IS NULL`,
                [orgId]
              );
            }
            await outboxWorker.runOutboxWorkerTick({ organizationId: orgId });
          }

          const midBacklog = await eventOutboxService.getOutboxBacklog({ organizationId: orgId });
          const midDeadLetter = await eventOutboxService.countDeadLetterEvents({ organizationId: orgId });
          const midMetrics = outboxWorker.getOutboxWorkerMetrics();

          expect(midDeadLetter).toBe(1);
          // Only the dead-lettered row remains "pending" by the backlog's own
          // definition (delivered_at IS NULL) — the good one delivered.
          expect(midBacklog.pending).toBe(1);
          expect(midMetrics.totalDelivered).toBeGreaterThanOrEqual(1);
          expect(midMetrics.totalFailed).toBeGreaterThanOrEqual(eventOutboxService.DEAD_LETTER_ATTEMPT_THRESHOLD);

          const deadLettered = await eventOutboxService.listDeadLetterEvents({ organizationId: orgId });
          expect(deadLettered.map((e) => e.eventId)).toEqual([badEventId]);

          // The good event must NOT be redelivered by further ticks (no
          // duplicate-effect regression) once the consumer stops failing.
        } finally {
          unsub();
        }

        // "Recovery": the operator fixes the consumer (here: unsubscribing the
        // failing one) — but a dead-lettered row is INTENTIONALLY not
        // auto-retried past the threshold (§8 "reconciliation", a human
        // decision), so it must STILL show up as dead-letter, not silently
        // clear itself.
        await outboxWorker.runOutboxWorkerTick({ organizationId: orgId });
        const afterBacklog = await eventOutboxService.getOutboxBacklog({ organizationId: orgId });
        const afterDeadLetter = await eventOutboxService.countDeadLetterEvents({ organizationId: orgId });
        expect(afterDeadLetter).toBe(1);
        expect(afterBacklog.pending).toBe(1);

        // The delivered event was delivered exactly once across the whole
        // episode — read straight from Postgres, not from the worker's own
        // bookkeeping, which could not be trusted to catch its own bug.
        const goodRow = await control.query<{ delivery_attempt_count: number }>(
          `SELECT delivery_attempt_count FROM case_workspace_event_outbox WHERE event_id = $1`,
          [goodEventId]
        );
        expect(Number(goodRow.rows[0]?.delivery_attempt_count)).toBe(0);
      } finally {
        await control
          .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
          .catch(() => undefined);
      }
    }, 60_000);
  });
});
