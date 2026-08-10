/**
 * Acceptance E2E — RN-G3: outbox dispatcher + `mywork_projection` consumer.
 *
 * Design: docs/product/results-vnext/RN_G3_OUTBOX_DISPATCHER_DESIGN.md §10
 * (the eight acceptance proofs are the definition of done for this slice).
 *
 * The gap this closes: all three Results vNext domains (KPI/ROI/OKR) write
 * `rvn_platform_events` + `rvn_platform_outbox` rows atomically
 * (`atomicWrite.ts`), but until this slice NOTHING ever consumed them —
 * confirmed by grep before this task: `outboxDrain.ts` was a set of pure
 * claim/reclaim/markDispatched/markFailed functions with zero callers, no
 * cron, no consumer registry. This suite drives the REAL dispatcher
 * (`runOutboxDispatchTick`) and the REAL consumer (`dispatchMyWorkProjection`)
 * against the LOCAL parity Postgres (no mocks except the outbound Slack/
 * WhatsApp alert channel, see the `systemAlertNotifier.js` mock below) —
 * fixtures call REAL domain commands (`recordMeasurement` ->
 * `openOrEscalateDeviationCase`, `acknowledgeDeviationCase`,
 * `submitRootCause`, `addCorrectiveAction`, `submitPlan`, `approvePlan`,
 * `updateCorrectiveAction`, `submitEffectivenessVerification`,
 * `closeDeviationCase`), never hand-inserted event rows (proof 8 is the one
 * deliberate, documented exception — see that section).
 *
 * Pattern precedent: tests/acceptance/outbox-drain.e2e.test.ts (real local
 * Postgres via `requireLocalDbUrl()`, raw `pg.Client`, marker-prefixed
 * fixtures, hard DB-state assertions, `afterAll` cleanup) and
 * tests/resultsVnext/kpi/deviationCaseIdempotency.realdb.test.ts (the
 * `insertFixtureKpi` / real-command-chain fixture shape for
 * `rvn_kpi_deviation_cases`).
 *
 * Fixture hygiene: every org/user/kpi id carries a `${MARKER}` prefix;
 * `afterAll` deletes everything this suite created, in FK-safe order.
 * Nothing is written to demo/prod — `requireLocalDbUrl()` below throws
 * immediately if `DATABASE_URL` is not local.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { pgClient, requireLocalDbUrl } from './harness.js';

requireLocalDbUrl();

// The one deliberate mock in this suite: the OUTBOUND alert channel
// (Slack/WhatsApp webhooks) — proof 6 asserts the DISPATCHER's own call
// shape (severity/throttleKey), not that a real Slack message was
// delivered, which would require live webhook credentials this environment
// does not have. Everything else (Postgres, the real command layer, the
// real dispatcher/consumer) is untouched.
vi.mock('../../server/src/services/systemAlertNotifier.js', () => ({
  sendSystemAlert: vi.fn().mockResolvedValue(undefined),
}));

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const MARKER = `odbior--rn-g3--${tag}`;

const ORG_A = `${MARKER}--org-a`;
const ORG_B = `${MARKER}--org-b`;
const OWNER_A = `${MARKER}--owner-a`;
const OWNER_B = `${MARKER}--owner-b`;
const APPROVER_A = `${MARKER}--approver-a`;

type CommandsKpiMeasurement = typeof import('../../server/src/services/resultsVnext/kpi/kpiMeasurementCommands.js');
type CommandsKpiDeviation = typeof import('../../server/src/services/resultsVnext/kpi/kpiDeviationCommands.js');
type CommandsKpiCorrectiveAction = typeof import('../../server/src/services/resultsVnext/kpi/kpiCorrectiveActionCommands.js');
type AtomicWriteModule = typeof import('../../server/src/services/resultsVnext/platform/atomicWrite.js');
type OutboxDrainModule = typeof import('../../server/src/services/resultsVnext/platform/outboxDrain.js');
type ConsumerRegistryModule = typeof import('../../server/src/services/resultsVnext/platform/consumerRegistry.js');
type MyWorkProjectionModule = typeof import('../../server/src/services/resultsVnext/platform/myworkProjectionConsumer.js');
type PlatformCronModule = typeof import('../../server/src/services/resultsVnext/platform/platformOutboxDrainCron.js');
type InboxServiceModule = typeof import('../../server/src/services/inboxService.js');
type SystemAlertModule = typeof import('../../server/src/services/systemAlertNotifier.js');
type PgModule = typeof import('../../server/src/database/PostgresDatabase.js');

let recordMeasurement: CommandsKpiMeasurement['recordMeasurement'];
let openOrEscalateDeviationCase: CommandsKpiDeviation['openOrEscalateDeviationCase'];
let acknowledgeDeviationCase: CommandsKpiDeviation['acknowledgeDeviationCase'];
let submitRootCause: CommandsKpiDeviation['submitRootCause'];
let submitPlan: CommandsKpiDeviation['submitPlan'];
let approvePlan: CommandsKpiDeviation['approvePlan'];
let submitEffectivenessVerification: CommandsKpiDeviation['submitEffectivenessVerification'];
let closeDeviationCase: CommandsKpiDeviation['closeDeviationCase'];
let addCorrectiveAction: CommandsKpiCorrectiveAction['addCorrectiveAction'];
let updateCorrectiveAction: CommandsKpiCorrectiveAction['updateCorrectiveAction'];
let executeAtomicCreate: AtomicWriteModule['executeAtomicCreate'];
let EVENT_INSERT_SQL: AtomicWriteModule['EVENT_INSERT_SQL'];
let resolveConsumerGroups: AtomicWriteModule['resolveConsumerGroups'];
let claimOutboxBatch: OutboxDrainModule['claimOutboxBatch'];
let markFailed: OutboxDrainModule['markFailed'];
let CONSUMER_REGISTRY: ConsumerRegistryModule['CONSUMER_REGISTRY'];
let UNBUILT_CONSUMER_GROUPS: ConsumerRegistryModule['UNBUILT_CONSUMER_GROUPS'];
let dispatchMyWorkProjection: MyWorkProjectionModule['dispatchMyWorkProjection'];
let RVN_CANONICAL_STATES: MyWorkProjectionModule['RVN_CANONICAL_STATES'];
let runOutboxDispatchTick: PlatformCronModule['runOutboxDispatchTick'];
let materializeInboxItems: InboxServiceModule['materializeInboxItems'];
let getInboxItems: InboxServiceModule['getInboxItems'];
let sendSystemAlertMock: SystemAlertModule['sendSystemAlert'];
let acquirePgClient: PgModule['acquirePgClient'];
let closePgPool: (() => Promise<void>) | undefined;

/**
 * Runs `fn` inside its own BEGIN/COMMIT on a freshly acquired pinned
 * client, ROLLBACK-ing on any error before releasing. Manually driving
 * BEGIN/COMMIT around a pool client WITHOUT a matching ROLLBACK-on-error
 * leaves that pooled connection's session in Postgres's "current
 * transaction is aborted" state when `fn` throws — `client.release()`
 * alone does NOT reset that; the poisoned connection goes back into the
 * pool and silently breaks the NEXT, unrelated test that happens to be
 * handed the same connection. Every ad hoc manual-transaction block in this
 * suite goes through this helper for exactly that reason.
 */
async function withTransaction<T>(
  acquire: () => Promise<import('pg').PoolClient>,
  fn: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  const client = await acquire();
  let released = false;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Rollback-after-error itself failing is non-fatal here — the
      // connection gets destroyed via release(err) below regardless.
    }
    released = true;
    client.release(err instanceof Error ? err : new Error(String(err)));
    throw err;
  } finally {
    if (!released) client.release();
  }
}

async function insertOrgAndUser(orgId: string, userId: string, email: string): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())
       ON CONFLICT (id) DO NOTHING`,
      [orgId, `RN-G3 fixture org ${orgId}`]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'RNG3', 'Fixture', now())
       ON CONFLICT (id) DO NOTHING`,
      [userId, orgId, email]
    );
  } finally {
    await client.end();
  }
}

async function insertFixtureKpi(
  orgId: string,
  ownerUserId: string,
  kpiId: string,
  versionId: string
): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, status, owner_user_id, created_by)
       VALUES ($1, $2, $3, 'active', $4, $4)`,
      [kpiId, orgId, `KPI-${kpiId.slice(0, 8)}`, ownerUserId]
    );
    await client.query(
      `INSERT INTO rvn_kpi_definition_versions
         (definition_version_id, kpi_id, organization_id, version_number, name, target_geometry,
          target_min, approval_status, created_by, effective_from)
       VALUES ($1, $2, $3, 1, 'RN-G3 fixture KPI', 'threshold_min', 100, 'approved', $4, now())`,
      [versionId, kpiId, orgId, ownerUserId]
    );
    await client.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`,
      [versionId, kpiId]
    );
  } finally {
    await client.end();
  }
}

/** Opens a deviation case via the REAL command chain (recordMeasurement ->
 * openOrEscalateDeviationCase, same transaction, decision #3) and returns
 * the resulting case_id. */
async function openRealDeviationCase(params: {
  orgId: string;
  ownerUserId: string;
  kpiId: string;
  versionId: string;
  idempotencyKey: string;
}): Promise<string> {
  const outcome = await recordMeasurement({
    kpiId: params.kpiId,
    definitionVersionId: params.versionId,
    organizationId: params.orgId,
    periodStart: '2026-01-01T00:00:00.000Z',
    periodEnd: '2026-01-31T00:00:00.000Z',
    actualValue: 10,
    performanceStatus: 'critical',
    source: 'manual',
    recordedBy: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: params.idempotencyKey,
  });
  expect(outcome.outcome).toBe('applied');

  const client = pgClient();
  await client.connect();
  try {
    const row = await client.query<{ case_id: string }>(
      `SELECT case_id FROM rvn_kpi_deviation_cases WHERE organization_id = $1 AND kpi_id = $2 AND status <> 'closed'`,
      [params.orgId, params.kpiId]
    );
    const caseId = row.rows[0]?.case_id;
    if (!caseId) throw new Error('[openRealDeviationCase] no case row found after recordMeasurement');
    return caseId;
  } finally {
    await client.end();
  }
}

/** Drives an already-open deviation case through the ENTIRE real state
 * machine to 'closed' — acknowledgeDeviationCase -> submitRootCause
 * (complete) -> addCorrectiveAction -> submitPlan -> approvePlan (different
 * approver) -> updateCorrectiveAction(active, auto-transitions
 * approved->executing) -> submitEffectivenessVerification(effective) ->
 * closeDeviationCase. Every step is a real, exported domain command — no
 * hand-inserted event rows anywhere in this path. */
async function closeRealDeviationCase(params: {
  orgId: string;
  caseId: string;
  ownerUserId: string;
  approverUserId: string;
  idemPrefix: string;
}): Promise<void> {
  const ack = await acknowledgeDeviationCase({
    caseId: params.caseId,
    organizationId: params.orgId,
    expectedVersion: 1,
    actorUserId: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${params.idemPrefix}--ack`,
  });
  expect(ack.outcome).toBe('applied');

  const rootCause = await submitRootCause({
    caseId: params.caseId,
    organizationId: params.orgId,
    expectedVersion: 2,
    actorUserId: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${params.idemPrefix}--rootcause`,
    rootCauseSummary: 'RN-G3 fixture root cause',
    rootCauseCategory: 'process',
  });
  expect(rootCause.outcome).toBe('applied');
  expect(rootCause.result.status).toBe('plan_required');

  const action = await addCorrectiveAction({
    deviationCaseId: params.caseId,
    organizationId: params.orgId,
    title: 'RN-G3 fixture corrective action',
    ownerUserId: params.ownerUserId,
    actorUserId: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${params.idemPrefix}--action`,
  });
  expect(action.outcome).toBe('applied');

  const plan = await submitPlan({
    caseId: params.caseId,
    organizationId: params.orgId,
    expectedVersion: 3,
    actorUserId: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${params.idemPrefix}--plan`,
  });
  expect(plan.outcome).toBe('applied');

  const approved = await approvePlan({
    caseId: params.caseId,
    organizationId: params.orgId,
    expectedVersion: 4,
    approverId: params.approverUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${params.idemPrefix}--approve`,
  });
  expect(approved.outcome).toBe('applied');

  const activated = await updateCorrectiveAction({
    actionId: action.result.actionId,
    organizationId: params.orgId,
    expectedVersion: 1,
    status: 'active',
    actorUserId: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${params.idemPrefix}--action-active`,
  });
  expect(activated.outcome).toBe('applied');
  expect(activated.result.caseAutoTransitionedToExecuting).toBe(true);

  const verification = await submitEffectivenessVerification({
    caseId: params.caseId,
    organizationId: params.orgId,
    expectedVersion: 5,
    actorUserId: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${params.idemPrefix}--verify`,
    verificationWindowStart: '2026-02-01T00:00:00.000Z',
    verificationWindowEnd: '2026-02-07T00:00:00.000Z',
    outcome: 'effective',
  });
  expect(verification.outcome).toBe('applied');
  expect(verification.result.case.status).toBe('verification');

  const closed = await closeDeviationCase({
    caseId: params.caseId,
    organizationId: params.orgId,
    expectedVersion: 6,
    actorUserId: params.ownerUserId,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `${params.idemPrefix}--close`,
  });
  expect(closed.outcome).toBe('applied');
  expect(closed.result.status).toBe('closed');
}

describe('RN-G3 · outbox dispatcher + mywork_projection consumer (8 acceptance proofs)', () => {
  beforeAll(async () => {
    await insertOrgAndUser(ORG_A, OWNER_A, `${OWNER_A}@acceptance.local`);
    await insertOrgAndUser(ORG_B, OWNER_B, `${OWNER_B}@acceptance.local`);
    // Approver has no notifications/canonical-state writes targeting it in
    // this suite — no users row required (plan_approved_by is a plain TEXT
    // column, no FK) — kept as a plain id constant for readability.
    void APPROVER_A;

    const measurementCommands: CommandsKpiMeasurement = await import(
      '../../server/src/services/resultsVnext/kpi/kpiMeasurementCommands.js'
    );
    recordMeasurement = measurementCommands.recordMeasurement;

    const deviationCommands: CommandsKpiDeviation = await import(
      '../../server/src/services/resultsVnext/kpi/kpiDeviationCommands.js'
    );
    ({
      openOrEscalateDeviationCase,
      acknowledgeDeviationCase,
      submitRootCause,
      submitPlan,
      approvePlan,
      submitEffectivenessVerification,
      closeDeviationCase,
    } = deviationCommands);

    const correctiveActionCommands: CommandsKpiCorrectiveAction = await import(
      '../../server/src/services/resultsVnext/kpi/kpiCorrectiveActionCommands.js'
    );
    ({ addCorrectiveAction, updateCorrectiveAction } = correctiveActionCommands);

    const atomicWrite: AtomicWriteModule = await import(
      '../../server/src/services/resultsVnext/platform/atomicWrite.js'
    );
    ({ executeAtomicCreate, EVENT_INSERT_SQL, resolveConsumerGroups } = atomicWrite);

    const outboxDrain: OutboxDrainModule = await import(
      '../../server/src/services/resultsVnext/platform/outboxDrain.js'
    );
    ({ claimOutboxBatch, markFailed } = outboxDrain);

    const consumerRegistry: ConsumerRegistryModule = await import(
      '../../server/src/services/resultsVnext/platform/consumerRegistry.js'
    );
    ({ CONSUMER_REGISTRY, UNBUILT_CONSUMER_GROUPS } = consumerRegistry);

    const myworkProjection: MyWorkProjectionModule = await import(
      '../../server/src/services/resultsVnext/platform/myworkProjectionConsumer.js'
    );
    ({ dispatchMyWorkProjection, RVN_CANONICAL_STATES } = myworkProjection);

    const platformCron: PlatformCronModule = await import(
      '../../server/src/services/resultsVnext/platform/platformOutboxDrainCron.js'
    );
    ({ runOutboxDispatchTick } = platformCron);

    const inboxService: InboxServiceModule = await import('../../server/src/services/inboxService.js');
    ({ materializeInboxItems, getInboxItems } = inboxService);

    const systemAlert: SystemAlertModule = await import(
      '../../server/src/services/systemAlertNotifier.js'
    );
    sendSystemAlertMock = systemAlert.sendSystemAlert;

    const pgModule: PgModule = await import('../../server/src/database/PostgresDatabase.js');
    acquirePgClient = pgModule.acquirePgClient;
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
  }, 30_000);

  afterAll(async () => {
    const client = pgClient();
    await client.connect();
    try {
      await client.query(
        `DELETE FROM notifications WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
      await client.query(
        `DELETE FROM canonical_inbox_items WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
      await client.query(
        `DELETE FROM v8_canonical_object_states WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
      await client.query(
        `DELETE FROM rvn_platform_projection_checkpoints WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
      await client.query(
        `DELETE FROM rvn_platform_consumer_processed WHERE event_id IN (
           SELECT event_id FROM rvn_platform_events WHERE organization_id = ANY($1::text[])
         )`,
        [[ORG_A, ORG_B]]
      );
      // MUST run before the rvn_platform_events delete below —
      // rvn_platform_obligations.source_event_id FK-references
      // rvn_platform_events, and this suite's proof 8 (and the real
      // openOrEscalateDeviationCase path in every other proof) writes
      // obligations whose source_event_id points at events this cleanup
      // is about to delete.
      await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(
        `DELETE FROM rvn_platform_outbox WHERE event_id IN (
           SELECT event_id FROM rvn_platform_events WHERE organization_id = ANY($1::text[])
         ) OR consumer_group LIKE $2`,
        [[ORG_A, ORG_B], `${MARKER}%`]
      );
      await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(
        `DELETE FROM rvn_kpi_effectiveness_verification_measurements WHERE verification_id IN (
           SELECT verification_id FROM rvn_kpi_effectiveness_verifications WHERE organization_id = ANY($1::text[])
         )`,
        [[ORG_A, ORG_B]]
      );
      // MUST run before the verifications delete below —
      // rvn_kpi_deviation_cases.close_effectiveness_verification_id FK-
      // references rvn_kpi_effectiveness_verifications (closeDeviationCase,
      // driven for real in proof 7, sets this column).
      await client.query(
        `UPDATE rvn_kpi_deviation_cases SET close_effectiveness_verification_id = NULL
          WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
      await client.query(
        `DELETE FROM rvn_kpi_effectiveness_verifications WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
      await client.query(`DELETE FROM rvn_kpi_corrective_actions WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_kpi_deviation_cases WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(
        `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
      await client.query(
        `DELETE FROM rvn_kpi_definition_versions WHERE organization_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]]
      );
      await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1::text[])`, [[ORG_A, ORG_B]]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [[ORG_A, ORG_B]]);
    } finally {
      await client.end();
    }
    if (closePgPool) await closePgPool();
  }, 60_000);

  // ==========================================
  // Proof 1 — atomic event + outbox write, + negative control
  // ==========================================
  describe('Proof 1 — atomic event + outbox write', () => {
    it('a real command (openOrEscalateDeviationCase via recordMeasurement) writes exactly one event row and exactly one outbox row', async () => {
      const kpiId = randomUUID();
      const versionId = randomUUID();
      await insertFixtureKpi(ORG_A, OWNER_A, kpiId, versionId);

      const caseId = await openRealDeviationCase({
        orgId: ORG_A,
        ownerUserId: OWNER_A,
        kpiId,
        versionId,
        idempotencyKey: `${MARKER}--proof1--measure`,
      });

      const client = pgClient();
      await client.connect();
      try {
        const events = await client.query(
          `SELECT event_id FROM rvn_platform_events
            WHERE organization_id = $1 AND aggregate_id = $2 AND event_type = 'kpi.deviation_opened'`,
          [ORG_A, caseId]
        );
        expect(events.rows).toHaveLength(1);
        const eventId = events.rows[0].event_id;

        const outbox = await client.query(
          `SELECT outbox_id, status, consumer_group FROM rvn_platform_outbox WHERE event_id = $1`,
          [eventId]
        );
        expect(outbox.rows).toHaveLength(1);
        expect(outbox.rows[0]).toMatchObject({ status: 'pending', consumer_group: 'mywork_projection' });
      } finally {
        await client.end();
      }
    });

    it('NEGATIVE CONTROL: applyMutation throws -> neither the aggregate write nor the event/outbox rows exist (no torn write)', async () => {
      const kpiId = randomUUID();
      const versionId = randomUUID();
      await insertFixtureKpi(ORG_A, OWNER_A, kpiId, versionId);

      const idempotencyKey = `${MARKER}--proof1--negctl`;
      const measurementMarkerPeriodStart = '2099-01-01T00:00:00.000Z';

      // Exercises the SAME generic platform primitive every real domain
      // command is built on (executeAtomicCreate) — a real INSERT into a
      // real domain table (rvn_kpi_measurements), then a deliberate throw,
      // to prove the whole BEGIN..COMMIT unit (aggregate write + event +
      // outbox fan-out) rolls back together. There is no way to force a
      // REAL command's internal applyMutation to throw without editing
      // production code, so this drives the identical underlying helper
      // directly instead.
      await expect(
        executeAtomicCreate<{ measurementId: string }>({
          organizationId: ORG_A,
          applyMutation: async (client) => {
            const insertResult = await client.query<{ measurement_id: string }>(
              `INSERT INTO rvn_kpi_measurements
                 (kpi_id, definition_version_id, organization_id, period_start, period_end,
                  actual_value, performance_status, source, recorded_by)
               VALUES ($1, $2, $3, $4, '2099-01-31T00:00:00.000Z', 1, 'critical', 'manual', $5)
               RETURNING measurement_id`,
              [kpiId, versionId, ORG_A, measurementMarkerPeriodStart, OWNER_A]
            );
            void insertResult;
            throw new Error('RN-G3 proof 1 negative control: injected applyMutation failure');
          },
          buildEvent: () => ({
            schemaVersion: 1,
            eventType: `${MARKER}--negctl-event-type`,
            aggregateType: 'kpi',
            aggregateId: kpiId,
            organizationId: ORG_A,
            actorUserId: OWNER_A,
            actorEffectiveRole: 'consultant',
            commandId: randomUUID(),
            correlationId: randomUUID(),
            causationId: null,
            occurredAt: new Date().toISOString(),
            policyVersion: '',
            beforeState: null,
            afterState: {},
            stateHash: 'unreachable',
            reason: null,
            evidenceRefs: [],
            source: 'test',
            idempotencyKey,
            expectedVersion: null,
            resultingVersion: 1,
            payload: {},
          }),
        })
      ).rejects.toThrow('injected applyMutation failure');

      const client = pgClient();
      await client.connect();
      try {
        const measurement = await client.query(
          `SELECT measurement_id FROM rvn_kpi_measurements WHERE kpi_id = $1 AND period_start = $2`,
          [kpiId, measurementMarkerPeriodStart]
        );
        expect(measurement.rows).toHaveLength(0);

        const events = await client.query(
          `SELECT event_id FROM rvn_platform_events WHERE organization_id = $1 AND idempotency_key = $2`,
          [ORG_A, idempotencyKey]
        );
        expect(events.rows).toHaveLength(0);

        const outbox = await client.query(
          `SELECT o.outbox_id FROM rvn_platform_outbox o
             JOIN rvn_platform_events e ON e.event_id = o.event_id
            WHERE e.idempotency_key = $1`,
          [idempotencyKey]
        );
        expect(outbox.rows).toHaveLength(0);
      } finally {
        await client.end();
      }
    });
  });

  // ==========================================
  // Proof 2 — exactly-once claim under concurrency
  // ==========================================
  it('Proof 2 — 5 concurrent claimOutboxBatch calls never claim the same outbox row twice, and cover all seeded rows', async () => {
    const kpiId = randomUUID();
    const versionId = randomUUID();
    await insertFixtureKpi(ORG_A, OWNER_A, kpiId, versionId);
    const caseId = await openRealDeviationCase({
      orgId: ORG_A,
      ownerUserId: OWNER_A,
      kpiId,
      versionId,
      idempotencyKey: `${MARKER}--proof2--measure`,
    });

    const client = pgClient();
    await client.connect();
    let eventId: string;
    const seededOutboxIds: string[] = [];
    try {
      const eventRow = await client.query<{ event_id: string }>(
        `SELECT event_id FROM rvn_platform_events
          WHERE organization_id = $1 AND aggregate_id = $2 AND event_type = 'kpi.deviation_opened'`,
        [ORG_A, caseId]
      );
      eventId = eventRow.rows[0].event_id;

      // Seed 12 PENDING outbox rows, all referencing the SAME real event
      // (rvn_platform_outbox.event_id has a NOT NULL FK to
      // rvn_platform_events — not a hand-inserted EVENT row, just extra
      // outbox fan-out for a real one), each with its own synthetic
      // consumer_group so the UNIQUE(event_id, consumer_group) constraint
      // allows all 12 to coexist.
      for (let i = 0; i < 12; i++) {
        const inserted = await client.query<{ outbox_id: string }>(
          `INSERT INTO rvn_platform_outbox (event_id, consumer_group, status)
           VALUES ($1, $2, 'pending') RETURNING outbox_id`,
          [eventId, `${MARKER}--proof2--group-${i}`]
        );
        seededOutboxIds.push(inserted.rows[0].outbox_id);
      }
    } finally {
      await client.end();
    }

    // 5 genuinely separate connections, each its own BEGIN/claim/COMMIT,
    // racing via Promise.all — exactly what FOR UPDATE SKIP LOCKED exists
    // to make safe. Batch size per worker (25) deliberately exceeds the 12
    // seeded rows by a wide margin so per-worker LIMIT never becomes an
    // artificial bottleneck on top of the concurrency question actually
    // under test (no duplicate claims, full coverage) — total requested
    // capacity across 5 workers (125) comfortably covers every pending row
    // in the table at seed time, including any leftover from earlier proofs
    // in this same suite (the coverage assertion below is scoped to just
    // OUR seeded ids regardless).
    const workerCount = 5;
    const perWorkerBatchSize = 25;
    const workers = await Promise.all(
      Array.from({ length: workerCount }, (_, i) =>
        withTransaction(acquirePgClient, async (workerClient) => {
          const rows = await claimOutboxBatch(workerClient, `${MARKER}--worker-${i}`, perWorkerBatchSize);
          return rows.map((r) => r.outbox_id);
        })
      )
    );

    const claimedIds = workers.flat().filter((id) => seededOutboxIds.includes(id));
    const uniqueClaimedIds = new Set(claimedIds);
    expect(claimedIds.length).toBe(uniqueClaimedIds.size); // no duplicate claim across the union
    expect(uniqueClaimedIds.size).toBe(seededOutboxIds.length); // every seeded row was claimed exactly once
  });

  // ==========================================
  // Proof 3 — real mutation via one dispatch tick
  // ==========================================
  it('Proof 3 — one dispatch tick against kpi.deviation_opened writes canonical state + a notification for the obligation assignee', async () => {
    const kpiId = randomUUID();
    const versionId = randomUUID();
    await insertFixtureKpi(ORG_A, OWNER_A, kpiId, versionId);
    const caseId = await openRealDeviationCase({
      orgId: ORG_A,
      ownerUserId: OWNER_A,
      kpiId,
      versionId,
      idempotencyKey: `${MARKER}--proof3--measure`,
    });

    const tickResult = await runOutboxDispatchTick();
    expect(tickResult.dispatched).toBeGreaterThanOrEqual(1);

    const client = pgClient();
    await client.connect();
    try {
      const canonicalState = await client.query(
        `SELECT canonical_state, object_type FROM v8_canonical_object_states
          WHERE object_id = $1 AND organization_id = $2`,
        [caseId, ORG_A]
      );
      expect(canonicalState.rows).toHaveLength(1);
      expect(canonicalState.rows[0].canonical_state).toBe(RVN_CANONICAL_STATES.NEEDS_ATTENTION);
      expect(canonicalState.rows[0].object_type).toBe('deviation_case');

      const notification = await client.query(
        `SELECT user_id, read, entity_type, entity_id FROM notifications
          WHERE organization_id = $1 AND entity_type = 'deviation_case' AND entity_id = $2`,
        [ORG_A, caseId]
      );
      expect(notification.rows).toHaveLength(1);
      expect(notification.rows[0]).toMatchObject({ user_id: OWNER_A, entity_id: caseId });
      expect(Number(notification.rows[0].read)).toBe(0);
    } finally {
      await client.end();
    }
  });

  // ==========================================
  // Proof 4 — no duplicate on redelivery
  // ==========================================
  it('Proof 4 — calling dispatchMyWorkProjection twice against the same claimed row produces exactly one notification/canonical-state/processed row', async () => {
    const kpiId = randomUUID();
    const versionId = randomUUID();
    await insertFixtureKpi(ORG_A, OWNER_A, kpiId, versionId);
    const caseId = await openRealDeviationCase({
      orgId: ORG_A,
      ownerUserId: OWNER_A,
      kpiId,
      versionId,
      idempotencyKey: `${MARKER}--proof4--measure`,
    });

    const readClient = pgClient();
    await readClient.connect();
    let event: {
      event_id: string;
      sequence: string;
      event_type: string;
      aggregate_type: string;
      aggregate_id: string;
      organization_id: string;
      actor_user_id: string | null;
      actor_effective_role: string;
      occurred_at: string;
      payload: Record<string, unknown>;
    };
    let outboxRow: { outbox_id: string; event_id: string; consumer_group: string };
    try {
      const eventResult = await readClient.query(
        `SELECT event_id, sequence::text AS sequence, event_type, aggregate_type, aggregate_id,
                organization_id, actor_user_id, actor_effective_role, occurred_at, payload
           FROM rvn_platform_events
          WHERE organization_id = $1 AND aggregate_id = $2 AND event_type = 'kpi.deviation_opened'`,
        [ORG_A, caseId]
      );
      event = eventResult.rows[0];

      const outboxResult = await readClient.query(
        `SELECT outbox_id, event_id, consumer_group FROM rvn_platform_outbox
          WHERE event_id = $1 AND consumer_group = 'mywork_projection'`,
        [event.event_id]
      );
      outboxRow = outboxResult.rows[0];
    } finally {
      await readClient.end();
    }

    // First delivery.
    await withTransaction(acquirePgClient, (client) =>
      dispatchMyWorkProjection(client, event as any, outboxRow as any)
    );

    // Second delivery of the SAME row — the exact at-least-once redelivery
    // scenario rvn_platform_consumer_processed exists to make a safe no-op.
    await withTransaction(acquirePgClient, (client) =>
      dispatchMyWorkProjection(client, event as any, outboxRow as any)
    );

    const client = pgClient();
    await client.connect();
    try {
      const notifications = await client.query(
        `SELECT id FROM notifications WHERE organization_id = $1 AND entity_type = 'deviation_case' AND entity_id = $2`,
        [ORG_A, caseId]
      );
      expect(notifications.rows).toHaveLength(1);

      const canonicalStates = await client.query(
        `SELECT object_id FROM v8_canonical_object_states WHERE object_id = $1 AND organization_id = $2`,
        [caseId, ORG_A]
      );
      expect(canonicalStates.rows).toHaveLength(1);

      const processed = await client.query(
        `SELECT consumer_group FROM rvn_platform_consumer_processed WHERE event_id = $1`,
        [event.event_id]
      );
      expect(processed.rows).toHaveLength(1);
    } finally {
      await client.end();
    }
  });

  // ==========================================
  // Proof 5 — retry with backoff
  // ==========================================
  it('Proof 5 — a failed dispatch (no consumer registered for the group) backs off next_attempt_at and stays "failed", not "dead_letter"', async () => {
    const kpiId = randomUUID();
    const versionId = randomUUID();
    await insertFixtureKpi(ORG_A, OWNER_A, kpiId, versionId);
    const caseId = await openRealDeviationCase({
      orgId: ORG_A,
      ownerUserId: OWNER_A,
      kpiId,
      versionId,
      idempotencyKey: `${MARKER}--proof5--measure`,
    });

    const client = pgClient();
    await client.connect();
    let outboxId: string;
    let beforeNextAttemptAt: string;
    try {
      const eventRow = await client.query<{ event_id: string }>(
        `SELECT event_id FROM rvn_platform_events
          WHERE organization_id = $1 AND aggregate_id = $2 AND event_type = 'kpi.deviation_opened'`,
        [ORG_A, caseId]
      );
      const eventId = eventRow.rows[0].event_id;

      // A group that is genuinely unregistered AND not in
      // UNBUILT_CONSUMER_GROUPS — IO-C: this still hard-fails as designed.
      const groupName = `${MARKER}--proof5--unregistered-group`;
      expect(CONSUMER_REGISTRY[groupName]).toBeUndefined();
      expect(UNBUILT_CONSUMER_GROUPS.has(groupName)).toBe(false);

      const inserted = await client.query<{ outbox_id: string; next_attempt_at: string }>(
        `INSERT INTO rvn_platform_outbox (event_id, consumer_group, status)
         VALUES ($1, $2, 'pending') RETURNING outbox_id, next_attempt_at`,
        [eventId, groupName]
      );
      outboxId = inserted.rows[0].outbox_id;
      beforeNextAttemptAt = inserted.rows[0].next_attempt_at;
    } finally {
      await client.end();
    }

    await runOutboxDispatchTick();

    const readClient = pgClient();
    await readClient.connect();
    try {
      const row = await readClient.query<{
        status: string;
        attempts: number;
        next_attempt_at: string;
        last_error: string;
      }>(
        `SELECT status, attempts, next_attempt_at, last_error FROM rvn_platform_outbox WHERE outbox_id = $1`,
        [outboxId]
      );
      expect(row.rows[0].status).toBe('failed');
      expect(row.rows[0].attempts).toBe(1);
      expect(row.rows[0].last_error).toBe('NO_CONSUMER_REGISTERED');

      // Design: delay = backoffSeconds * 2^attemptsBeforeIncrement (0 here)
      // = backoffSeconds * 1. The cron uses backoffSeconds=30 — allow a
      // generous window (20-45s) to absorb test/DB clock skew without
      // hand-coding the exact constant twice.
      const deltaMs =
        new Date(row.rows[0].next_attempt_at).getTime() - new Date(beforeNextAttemptAt).getTime();
      expect(deltaMs).toBeGreaterThan(20_000);
      expect(deltaMs).toBeLessThan(45_000);
    } finally {
      await readClient.end();
    }
  });

  // ==========================================
  // Proof 6 — dead letter + real alert, and IO-C parking
  // ==========================================
  describe('Proof 6 — dead letter + alert, and IO-C parking', () => {
    it('markFailed driven to max_attempts -> status=dead_letter and the dispatcher fires exactly one CRITICAL sendSystemAlert for that group', async () => {
      const kpiId = randomUUID();
      const versionId = randomUUID();
      await insertFixtureKpi(ORG_A, OWNER_A, kpiId, versionId);
      const caseId = await openRealDeviationCase({
        orgId: ORG_A,
        ownerUserId: OWNER_A,
        kpiId,
        versionId,
        idempotencyKey: `${MARKER}--proof6--measure`,
      });

      const groupName = `${MARKER}--proof6--dead-letter-group`;
      const client = pgClient();
      await client.connect();
      let outboxId: string;
      let maxAttempts: number;
      try {
        const eventRow = await client.query<{ event_id: string }>(
          `SELECT event_id FROM rvn_platform_events
            WHERE organization_id = $1 AND aggregate_id = $2 AND event_type = 'kpi.deviation_opened'`,
          [ORG_A, caseId]
        );
        const inserted = await client.query<{ outbox_id: string; max_attempts: number }>(
          `INSERT INTO rvn_platform_outbox (event_id, consumer_group, status)
           VALUES ($1, $2, 'pending') RETURNING outbox_id, max_attempts`,
          [eventRow.rows[0].event_id, groupName]
        );
        outboxId = inserted.rows[0].outbox_id;
        maxAttempts = inserted.rows[0].max_attempts;
      } finally {
        await client.end();
      }

      // Drive markFailed directly up to (but not including) max_attempts,
      // each call simulating one prior failed dispatch attempt — proves the
      // exhausted-retries transition without waiting on real backoff
      // timers.
      const dedicatedClient = await acquirePgClient();
      let lastResult: { status: string; attempts: number };
      try {
        for (let i = 0; i < maxAttempts; i++) {
          lastResult = await markFailed(dedicatedClient, outboxId, 'RN-G3 proof 6 injected failure', 0);
        }
      } finally {
        dedicatedClient.release();
      }
      expect(lastResult!.status).toBe('dead_letter');
      expect(lastResult!.attempts).toBe(maxAttempts);

      // Now run a real tick. The row is already 'dead_letter' — NOT
      // 'pending'/'failed' — so claimOutboxBatch will NOT re-claim it; this
      // directly asserts the terminal DB state set by markFailed itself
      // (the tick call below is only to prove the CRITICAL alert path for
      // a row THIS tick drives to dead_letter, in the second half below).
      const readClient = pgClient();
      await readClient.connect();
      try {
        const row = await readClient.query(`SELECT status FROM rvn_platform_outbox WHERE outbox_id = $1`, [
          outboxId,
        ]);
        expect(row.rows[0].status).toBe('dead_letter');
      } finally {
        await readClient.end();
      }

      // Second row: let the REAL dispatcher tick drive the FINAL
      // NO_CONSUMER_REGISTERED failure to dead_letter and assert IT fires
      // the CRITICAL alert (platformOutboxDrainCron.ts's own tick body, not
      // a direct markFailed call) — pre-seed attempts = maxAttempts2 - 1 via
      // direct markFailed calls (backoffSeconds=0 keeps next_attempt_at at
      // "now", so the row stays immediately claimable — no timer/sleep
      // needed), so the tick's OWN markFailed call is the one that crosses
      // the max_attempts threshold.
      const groupName2 = `${MARKER}--proof6--dead-letter-group-2`;
      const client2 = pgClient();
      await client2.connect();
      let outboxId2: string;
      let maxAttempts2: number;
      try {
        const eventRow2 = await client2.query<{ event_id: string }>(
          `SELECT event_id FROM rvn_platform_events
            WHERE organization_id = $1 AND aggregate_id = $2 AND event_type = 'kpi.deviation_opened'`,
          [ORG_A, caseId]
        );
        const inserted2 = await client2.query<{ outbox_id: string; max_attempts: number }>(
          `INSERT INTO rvn_platform_outbox (event_id, consumer_group, status)
           VALUES ($1, $2, 'pending') RETURNING outbox_id, max_attempts`,
          [eventRow2.rows[0].event_id, groupName2]
        );
        outboxId2 = inserted2.rows[0].outbox_id;
        maxAttempts2 = inserted2.rows[0].max_attempts;
      } finally {
        await client2.end();
      }

      const preSeedClient = await acquirePgClient();
      try {
        for (let i = 0; i < maxAttempts2 - 1; i++) {
          await markFailed(preSeedClient, outboxId2, 'RN-G3 proof 6 pre-seeded failure', 0);
        }
      } finally {
        preSeedClient.release();
      }

      const preTickRow = await (async () => {
        const c = pgClient();
        await c.connect();
        try {
          const r = await c.query(`SELECT status, attempts FROM rvn_platform_outbox WHERE outbox_id = $1`, [
            outboxId2,
          ]);
          return r.rows[0];
        } finally {
          await c.end();
        }
      })();
      expect(preTickRow.status).toBe('failed');
      expect(preTickRow.attempts).toBe(maxAttempts2 - 1);

      (sendSystemAlertMock as ReturnType<typeof vi.fn>).mockClear();
      await runOutboxDispatchTick();

      const finalReadClient = pgClient();
      await finalReadClient.connect();
      try {
        const r = await finalReadClient.query(
          `SELECT status, attempts FROM rvn_platform_outbox WHERE outbox_id = $1`,
          [outboxId2]
        );
        expect(r.rows[0].status).toBe('dead_letter');
        expect(r.rows[0].attempts).toBe(maxAttempts2);
      } finally {
        await finalReadClient.end();
      }

      const criticalCalls = (sendSystemAlertMock as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([arg]: [any]) => arg.severity === 'CRITICAL' && arg.throttleKey === `outbox_dead_letter:${groupName2}`
      );
      expect(criticalCalls.length).toBe(1);
    }, 30_000);

    it('IO-C: a row for an UNBUILT_CONSUMER_GROUPS member parks (status=parked) with an INFO notice, never a CRITICAL dead-letter alert', async () => {
      // UPDATED by RN-G6 (2026-08-10, docs/product/results-vnext/RN_G6_
      // FINANCE_PROJECTION_DESIGN.md): 'finance_projection' — this test's
      // ORIGINAL example group — graduated to a real, registered consumer;
      // UNBUILT_CONSUMER_GROUPS is now empty. The IO-C PARKING MECHANISM
      // itself (outboxDrain.ts's markParked, platformOutboxDrainCron.ts's
      // dispatch-loop branch) is untouched by RN-G6 and still real,
      // load-bearing code — this test now exercises it against a synthetic
      // group name added to the (runtime-mutable, only TS-level-readonly)
      // UNBUILT_CONSUMER_GROUPS Set for the duration of the test, removed
      // in a `finally` so no other test observes the mutation.
      const syntheticUnbuiltGroup = `${MARKER}--proof6b--synthetic-unbuilt-group`;
      const mutableUnbuilt = UNBUILT_CONSUMER_GROUPS as unknown as Set<string>;
      mutableUnbuilt.add(syntheticUnbuiltGroup);
      try {
        const kpiId = randomUUID();
        const versionId = randomUUID();
        await insertFixtureKpi(ORG_A, OWNER_A, kpiId, versionId);
        const caseId = await openRealDeviationCase({
          orgId: ORG_A,
          ownerUserId: OWNER_A,
          kpiId,
          versionId,
          idempotencyKey: `${MARKER}--proof6b--measure`,
        });

        expect(UNBUILT_CONSUMER_GROUPS.has(syntheticUnbuiltGroup)).toBe(true);
        expect(CONSUMER_REGISTRY[syntheticUnbuiltGroup]).toBeUndefined();

        const client = pgClient();
        await client.connect();
        let outboxId: string;
        try {
          const eventRow = await client.query<{ event_id: string }>(
            `SELECT event_id FROM rvn_platform_events
              WHERE organization_id = $1 AND aggregate_id = $2 AND event_type = 'kpi.deviation_opened'`,
            [ORG_A, caseId]
          );
          const inserted = await client.query<{ outbox_id: string }>(
            `INSERT INTO rvn_platform_outbox (event_id, consumer_group, status)
             VALUES ($1, $2, 'pending') RETURNING outbox_id`,
            [eventRow.rows[0].event_id, syntheticUnbuiltGroup]
          );
          outboxId = inserted.rows[0].outbox_id;
        } finally {
          await client.end();
        }

        (sendSystemAlertMock as ReturnType<typeof vi.fn>).mockClear();
        await runOutboxDispatchTick();

        const readClient = pgClient();
        await readClient.connect();
        try {
          const row = await readClient.query(
            `SELECT status, attempts, last_error FROM rvn_platform_outbox WHERE outbox_id = $1`,
            [outboxId]
          );
          expect(row.rows[0].status).toBe('parked');
          expect(row.rows[0].attempts).toBe(0); // parking never counts as an attempt
          expect(row.rows[0].last_error).toBe('CONSUMER_NOT_BUILT');
        } finally {
          await readClient.end();
        }

        const calls = (sendSystemAlertMock as ReturnType<typeof vi.fn>).mock.calls;
        const criticalCalls = calls.filter(([arg]: [any]) => arg.severity === 'CRITICAL');
        const infoParkedCalls = calls.filter(
          ([arg]: [any]) =>
            arg.severity === 'INFO' && arg.throttleKey === `outbox_parked:${syntheticUnbuiltGroup}`
        );
        expect(criticalCalls.length).toBe(0);
        expect(infoParkedCalls.length).toBe(1);
      } finally {
        mutableUnbuilt.delete(syntheticUnbuiltGroup);
      }
    });
  });

  // ==========================================
  // Proof 7 — cold reopen (materializeInboxItems + IO-E resolution)
  // ==========================================
  it('Proof 7 — materializeInboxItems surfaces the projected notification; kpi.deviation_closed resolves it (IO-E) and re-materialization no longer surfaces it as unread', async () => {
    const kpiId = randomUUID();
    const versionId = randomUUID();
    await insertFixtureKpi(ORG_A, OWNER_A, kpiId, versionId);
    const caseId = await openRealDeviationCase({
      orgId: ORG_A,
      ownerUserId: OWNER_A,
      kpiId,
      versionId,
      idempotencyKey: `${MARKER}--proof7--measure`,
    });

    await runOutboxDispatchTick();

    // OWNER_A/ORG_A are shared across every proof in this file, so OWNER_A's
    // Inbox may already contain unresolved notification-sourced items from
    // OTHER proofs' own (never-closed) deviation cases by the time this one
    // runs — a plain "first notification-type item" filter would match the
    // WRONG one. Resolve THIS test's own notification id from SQL first
    // (scoped by entity_id = caseId) and match on that exact
    // sourceEntityId, never on array position/first-match.
    const notifLookupClient = pgClient();
    await notifLookupClient.connect();
    let ownNotificationId: string;
    try {
      const notifRow = await notifLookupClient.query<{ id: string }>(
        `SELECT id FROM notifications
          WHERE organization_id = $1 AND entity_type = 'deviation_case' AND entity_id = $2`,
        [ORG_A, caseId]
      );
      ownNotificationId = notifRow.rows[0]?.id;
      expect(ownNotificationId).toBeTruthy();
    } finally {
      await notifLookupClient.end();
    }

    // Cold reopen: a FRESH materialization call (no prior Inbox state
    // assumed) picks up the notification this consumer wrote.
    await materializeInboxItems(OWNER_A, ORG_A);
    const itemsAfterOpen = await getInboxItems(OWNER_A, ORG_A, {});
    const deviationItem = itemsAfterOpen.find(
      (item) => item.sourceEntityType === 'notification' && item.sourceEntityId === ownNotificationId
    );
    expect(deviationItem).toBeTruthy();
    expect(deviationItem!.status).not.toBe('resolved');

    // Drive the case to closed via the REAL state machine.
    await closeRealDeviationCase({
      orgId: ORG_A,
      caseId,
      ownerUserId: OWNER_A,
      approverUserId: APPROVER_A,
      idemPrefix: `${MARKER}--proof7`,
    });

    await runOutboxDispatchTick();

    const client = pgClient();
    await client.connect();
    try {
      const canonicalState = await client.query(
        `SELECT canonical_state FROM v8_canonical_object_states WHERE object_id = $1 AND organization_id = $2`,
        [caseId, ORG_A]
      );
      expect(canonicalState.rows[0].canonical_state).toBe(RVN_CANONICAL_STATES.RESOLVED);

      const notification = await client.query(
        `SELECT read, is_read FROM notifications
          WHERE organization_id = $1 AND entity_type = 'deviation_case' AND entity_id = $2`,
        [ORG_A, caseId]
      );
      expect(Number(notification.rows[0].read)).toBe(1);
      expect(Number(notification.rows[0].is_read)).toBe(1);
    } finally {
      await client.end();
    }

    // Re-materialize: the notification no longer matches materializeInboxItems'
    // own `COALESCE(read,0)=0` source query, and the lifecycle trigger
    // (20260805_m02p03_inbox_projection_lifecycle.sql, AFTER UPDATE OF read)
    // already retired its canonical_inbox_items projection to 'resolved'
    // the moment this consumer's IO-E UPDATE landed.
    await materializeInboxItems(OWNER_A, ORG_A);
    const itemsAfterClose = await getInboxItems(OWNER_A, ORG_A, {});
    const stillUnresolved = itemsAfterClose.find(
      (item) => item.sourceEntityType === 'notification' && item.id === deviationItem!.id && item.status !== 'resolved'
    );
    expect(stillUnresolved).toBeUndefined();

    const resolvedItem = itemsAfterClose.find((item) => item.id === deviationItem!.id);
    expect(resolvedItem?.status).toBe('resolved');
  }, 30_000);

  // ==========================================
  // Proof 8 — foreign-org isolation (same literal aggregate_id, two orgs)
  // ==========================================
  it('Proof 8 — two orgs whose deviation cases share the same literal aggregate_id: the dispatcher never leaks one org\'s state/notification into the other', async () => {
    const kpiIdA = randomUUID();
    const versionIdA = randomUUID();
    await insertFixtureKpi(ORG_A, OWNER_A, kpiIdA, versionIdA);
    const caseIdA = await openRealDeviationCase({
      orgId: ORG_A,
      ownerUserId: OWNER_A,
      kpiId: kpiIdA,
      versionId: versionIdA,
      idempotencyKey: `${MARKER}--proof8--measure-a`,
    });

    // Org B gets its OWN real KPI + measurement + real (auto-generated,
    // distinct) case first, via the exact same real command path as org A —
    // this proves the normal path works for org B too, independent of the
    // deliberate collision constructed below.
    const kpiIdB = randomUUID();
    const versionIdB = randomUUID();
    await insertFixtureKpi(ORG_B, OWNER_B, kpiIdB, versionIdB);
    const naturalCaseIdB = await openRealDeviationCase({
      orgId: ORG_B,
      ownerUserId: OWNER_B,
      kpiId: kpiIdB,
      versionId: versionIdB,
      idempotencyKey: `${MARKER}--proof8--measure-b-natural`,
    });
    expect(naturalCaseIdB).not.toBe(caseIdA); // case_id is a UUID PK — never collides naturally

    // DELIBERATE COLLISION (documented deviation — see design §10 proof 8):
    // `rvn_platform_events.aggregate_id` is TEXT with NO uniqueness
    // constraint of its own (only `(organization_id, idempotency_key)` is
    // unique) — the design explicitly requires proving isolation against
    // two orgs' events sharing the same LITERAL `aggregate_id`. The
    // UNDERLYING domain aggregate (`rvn_kpi_deviation_cases.case_id`) is a
    // single-column, globally-unique UUID PRIMARY KEY, so — unlike
    // `aggregate_id` on the platform event itself — it can NEVER hold two
    // rows sharing the same id regardless of organization_id; a second
    // `rvn_kpi_deviation_cases` row for org B using org A's case_id is
    // therefore not just hard to arrange via real commands, it violates the
    // domain table's own primary key and is not attempted here. What CAN
    // and does collide — and is exactly what `dispatchMyWorkProjection`
    // must isolate correctly — is the (event, outbox, obligation) triple
    // this consumer actually reads: an `rvn_platform_events` row for org B
    // whose `aggregate_id` equals org A's real case_id, its outbox fan-out,
    // and an `rvn_platform_obligations` row (also un-uniqued on
    // `reference_id` alone) for org B pointing at that same id. This is
    // constructed using the SAME primitives `openOrEscalateDeviationCase`
    // itself is built from (`EVENT_INSERT_SQL` + `resolveConsumerGroups`,
    // both exported from atomicWrite.ts specifically for this kind of
    // manual-but-correct event write — see kpiDeviationCommands.ts's own
    // header) — not a fabricated ad hoc INSERT, the exact same building
    // blocks in production use for this exact event type.
    const collidingCaseId = caseIdA;
    const dedicatedClient = await acquirePgClient();
    let collidingEventId: string;
    try {
      await dedicatedClient.query('BEGIN');

      const afterState = { caseId: collidingCaseId, kpiId: kpiIdB, severity: 'critical' as const };
      const eventInsert = await dedicatedClient.query<{ event_id: string }>(EVENT_INSERT_SQL, [
        1,
        'kpi.deviation_opened',
        'deviation_case',
        collidingCaseId,
        ORG_B,
        OWNER_B,
        'consultant',
        randomUUID(),
        randomUUID(),
        null,
        new Date().toISOString(),
        '',
        null,
        JSON.stringify(afterState),
        'rn-g3-proof8-state-hash',
        null,
        JSON.stringify([]),
        'rn-g3-proof8-test',
        `${MARKER}--proof8--colliding-event`,
        null,
        1,
        JSON.stringify({ caseId: collidingCaseId, kpiId: kpiIdB }),
      ]);
      collidingEventId = eventInsert.rows[0].event_id;

      const consumerGroups = resolveConsumerGroups('kpi.deviation_opened');
      await dedicatedClient.query(
        `INSERT INTO rvn_platform_outbox (event_id, consumer_group, status)
           SELECT $1, cg, 'pending' FROM unnest($2::text[]) AS cg`,
        [collidingEventId, consumerGroups]
      );

      // Real obligation for org B's colliding case — same
      // (organization_id, reference_type, reference_id) shape
      // openOrEscalateDeviationCase itself creates, assignee = org B's owner.
      await dedicatedClient.query(
        `INSERT INTO rvn_platform_obligations
           (organization_id, assignee_user_id, reference_type, reference_id,
            aggregate_version_at_creation, obligation_type, deduplication_key)
         VALUES ($1, $2, 'deviation_case', $3, 1, 'explain_warning_critical_deviation', $4)`,
        [ORG_B, OWNER_B, collidingCaseId, `${MARKER}--proof8--colliding-obligation`]
      );
      await dedicatedClient.query('COMMIT');
    } catch (err) {
      await dedicatedClient.query('ROLLBACK');
      throw err;
    } finally {
      dedicatedClient.release();
    }

    // Sanity: both orgs now have a `kpi.deviation_opened` rvn_platform_events
    // row sharing the SAME literal aggregate_id (org A's real one, org B's
    // manufactured collision) — the exact plausible-collision precondition
    // proof 8 requires.
    const preCheckClient = pgClient();
    await preCheckClient.connect();
    try {
      const events = await preCheckClient.query(
        `SELECT organization_id FROM rvn_platform_events
          WHERE aggregate_id = $1 AND event_type = 'kpi.deviation_opened'
          ORDER BY organization_id`,
        [collidingCaseId]
      );
      expect(events.rows.map((r) => r.organization_id).sort()).toEqual([ORG_A, ORG_B].sort());
    } finally {
      await preCheckClient.end();
    }

    await runOutboxDispatchTick();

    const client = pgClient();
    await client.connect();
    try {
      // v8_canonical_object_states is keyed (object_id, organization_id) —
      // both rows legitimately exist (that IS correct multi-tenant
      // behavior), but each must carry ONLY its own org's data.
      const states = await client.query(
        `SELECT organization_id, canonical_state FROM v8_canonical_object_states
          WHERE object_id = $1 ORDER BY organization_id`,
        [collidingCaseId]
      );
      expect(states.rows).toHaveLength(2);
      for (const row of states.rows) {
        expect(row.canonical_state).toBe(RVN_CANONICAL_STATES.NEEDS_ATTENTION);
      }

      // The org-B-scoped query must return ONLY org B's row.
      const orgBOnly = await client.query(
        `SELECT organization_id FROM v8_canonical_object_states WHERE object_id = $1 AND organization_id = $2`,
        [collidingCaseId, ORG_B]
      );
      expect(orgBOnly.rows).toHaveLength(1);
      expect(orgBOnly.rows[0].organization_id).toBe(ORG_B);

      // Notifications: org A's notification (from the real caseIdA event,
      // dispatched earlier in THIS test run if any prior proof already
      // ticked it — scope strictly by org) must never appear when querying
      // for org B, and vice versa. Each notification row belongs to exactly
      // one (user_id, organization_id) pair — the critical assertion is
      // that org B's notification targets OWNER_B, never OWNER_A, and
      // querying by organization_id=ORG_B never returns an org-A user.
      const notificationsForCase = await client.query(
        `SELECT organization_id, user_id FROM notifications
          WHERE entity_type = 'deviation_case' AND entity_id = $1 ORDER BY organization_id`,
        [collidingCaseId]
      );
      expect(notificationsForCase.rows.length).toBeGreaterThanOrEqual(1);
      for (const row of notificationsForCase.rows) {
        if (row.organization_id === ORG_A) {
          expect(row.user_id).toBe(OWNER_A);
        } else if (row.organization_id === ORG_B) {
          expect(row.user_id).toBe(OWNER_B);
        } else {
          throw new Error(`Unexpected organization_id on notification: ${row.organization_id}`);
        }
      }
      // A query scoped to org B never returns org A's owner, and vice versa
      // — this is the exact predicate a consumer missing an
      // organization_id filter would get wrong.
      const orgBNotification = notificationsForCase.rows.find((r) => r.organization_id === ORG_B);
      expect(orgBNotification?.user_id).not.toBe(OWNER_A);
    } finally {
      await client.end();
    }
  }, 30_000);
});
