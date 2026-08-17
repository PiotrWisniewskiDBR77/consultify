/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  enqueueOperationalAlertRepairIntent,
  reconstructTerminalOperationalAlertIntents,
  redriveOperationalAlertRepairIntent,
  runOperationalAlertRepairTick,
} from '../operationalAlertRepairService.js';

const url = process.env.DATABASE_URL ?? '';
const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
const prefix = `ops-repair-${randomUUID()}`,
  org = `${prefix}-org`;
const input = {
  organizationId: org,
  actorId: `${prefix}-actor`,
  correlationId: `${prefix}-corr`,
  sourceType: 'test_terminal',
  sourceTerminalId: `${prefix}-terminal`,
  kind: 'WRITE_FAILURE_RATE' as const,
  outcome: 'FAILURE' as const,
};

describe.skipIf(!enabled)('OPS durable missed-signal repair realPG', () => {
  beforeAll(() => {
    process.env.OPERATIONAL_ALERT_DURABLE_ENABLED = 'true';
    process.env.OPERATIONAL_ALERT_REPAIR_ENABLED = 'true';
  });
  afterAll(async () => {
    delete process.env.OPERATIONAL_ALERT_DURABLE_ENABLED;
    delete process.env.OPERATIONAL_ALERT_REPAIR_ENABLED;
    const db = new Client({ connectionString: url });
    await db.connect();
    await db.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id=$1)`,
      [org]
    );
    await db.query(`DELETE FROM rvn_platform_events WHERE organization_id=$1`, [org]);
    await db.query(
      `ALTER TABLE case_workspace_event_outbox DISABLE TRIGGER trg_case_workspace_event_outbox_guard`
    );
    await db.query(`DELETE FROM case_workspace_event_outbox WHERE organization_id=$1`, [org]);
    await db.query(
      `ALTER TABLE case_workspace_event_outbox ENABLE TRIGGER trg_case_workspace_event_outbox_guard`
    );
    await db.query(`DELETE FROM notification_outbox WHERE organization_id=$1`, [org]);
    await db.query(
      `ALTER TABLE operational_alert_delivery_receipts DISABLE TRIGGER trg_operational_alert_receipts_immutable`
    );
    await db.query(`DELETE FROM operational_alert_delivery_receipts WHERE organization_id=$1`, [
      org,
    ]);
    await db.query(
      `ALTER TABLE operational_alert_delivery_receipts ENABLE TRIGGER trg_operational_alert_receipts_immutable`
    );
    await db.query(`DELETE FROM operational_alert_delivery_outbox WHERE organization_id=$1`, [org]);
    await db.query(
      `ALTER TABLE operational_alert_repair_receipts DISABLE TRIGGER trg_operational_alert_repair_receipts_immutable`
    );
    await db.query(`DELETE FROM operational_alert_repair_receipts WHERE organization_id=$1`, [org]);
    await db.query(
      `ALTER TABLE operational_alert_repair_receipts ENABLE TRIGGER trg_operational_alert_repair_receipts_immutable`
    );
    await db.query(
      `ALTER TABLE operational_alert_repair_attempts DISABLE TRIGGER trg_operational_alert_repair_attempts_immutable`
    );
    await db.query(`DELETE FROM operational_alert_repair_attempts WHERE organization_id=$1`, [org]);
    await db.query(
      `ALTER TABLE operational_alert_repair_attempts ENABLE TRIGGER trg_operational_alert_repair_attempts_immutable`
    );
    await db.query(`DELETE FROM operational_alert_repair_intents WHERE organization_id=$1`, [org]);
    await db.query(
      `ALTER TABLE operational_alert_signals DISABLE TRIGGER trg_operational_alert_signals_immutable`
    );
    await db.query(`DELETE FROM operational_alert_signals WHERE organization_id=$1`, [org]);
    await db.query(
      `ALTER TABLE operational_alert_signals ENABLE TRIGGER trg_operational_alert_signals_immutable`
    );
    await db.query(`DELETE FROM operational_alert_repair_cursors`);
    await db.end();
  });
  it('collapses 8-way intent, rejects collision, repairs exactly one signal and cold-reads receipt', async () => {
    const intents = await Promise.all(
      Array.from({ length: 8 }, () => enqueueOperationalAlertRepairIntent(input))
    );
    expect(new Set(intents.map((i) => i.intent_id)).size).toBe(1);
    await expect(
      enqueueOperationalAlertRepairIntent({ ...input, actorId: 'different' })
    ).rejects.toThrow('OPS_ALERT_REPAIR_COLLISION');
    expect(await runOperationalAlertRepairTick({ workerId: `${prefix}-worker` })).toMatchObject({
      claimed: 1,
      completed: 1,
      failed: 0,
    });
    expect(await runOperationalAlertRepairTick({ workerId: `${prefix}-worker2` })).toMatchObject({
      claimed: 0,
      completed: 0,
    });
    const cold = new Client({ connectionString: url });
    await cold.connect();
    const rows = await cold.query(
      `SELECT i.status,r.signal_id,s.organization_id FROM operational_alert_repair_intents i JOIN operational_alert_repair_receipts r USING(intent_id) JOIN operational_alert_signals s ON s.signal_id=r.signal_id WHERE i.organization_id=$1`,
      [org]
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({ status: 'COMPLETED', organization_id: org });
    await cold.end();
  });
  it('reclaims a stale lease and reconstructs a terminal notification without replaying delivery', async () => {
    const stale = await enqueueOperationalAlertRepairIntent({
      ...input,
      sourceTerminalId: `${prefix}-stale`,
      correlationId: `${prefix}-stale`,
    });
    const db = new Client({ connectionString: url });
    await db.connect();
    await db.query(
      `UPDATE operational_alert_repair_intents SET status='PROCESSING',lease_owner='crashed',lease_token=$2,fencing_version=1,lease_expires_at=now()-interval '1 second' WHERE intent_id=$1`,
      [stale.intent_id, randomUUID()]
    );
    expect(await runOperationalAlertRepairTick({ workerId: `${prefix}-reclaim` })).toMatchObject({
      claimed: 1,
      completed: 1,
    });
    const id = `${prefix}-notification`;
    const lateId = `${prefix}-notification-late`;
    await db.query(
      `INSERT INTO notification_outbox(id,user_id,organization_id,type,payload_json,status,dedupe_key) VALUES($1,$2,$3,'test','{}','PENDING',$4)`,
      [lateId, `${prefix}-user`, org, lateId]
    );
    await db.query(
      `INSERT INTO notification_outbox(id,user_id,organization_id,type,payload_json,status,dedupe_key,updated_at) VALUES($1,$2,$3,'test','{}','SENT',$4,clock_timestamp())`,
      [id, `${prefix}-user`, org, id]
    );
    expect(await reconstructTerminalOperationalAlertIntents()).toBeGreaterThanOrEqual(1);
    expect(
      await runOperationalAlertRepairTick({ workerId: `${prefix}-reconstruct` })
    ).toMatchObject({ completed: 1 });
    const proof = await db.query(
      `SELECT n.status notification_status,i.status,r.signal_id FROM notification_outbox n JOIN operational_alert_repair_intents i ON i.source_terminal_id=n.id JOIN operational_alert_repair_receipts r USING(intent_id) WHERE n.id=$1`,
      [id]
    );
    expect(proof.rows).toHaveLength(1);
    expect(proof.rows[0]).toMatchObject({ notification_status: 'SENT', status: 'COMPLETED' });
    expect(
      (
        await db.query(
          `SELECT count(*)::int n FROM operational_alert_signals WHERE organization_id=$1 AND source_id=$2`,
          [org, id]
        )
      ).rows[0].n
    ).toBe(1);
    await db.query(
      `UPDATE notification_outbox SET status='SENT',updated_at=clock_timestamp() WHERE id=$1`,
      [lateId]
    );
    expect(await reconstructTerminalOperationalAlertIntents()).toBeGreaterThanOrEqual(1);
    expect(await runOperationalAlertRepairTick({ workerId: `${prefix}-late` })).toMatchObject({
      completed: 1,
    });
    expect(
      (
        await db.query(
          `SELECT count(*)::int n FROM operational_alert_repair_intents WHERE organization_id=$1 AND source_terminal_id=$2`,
          [org, lateId]
        )
      ).rows[0].n
    ).toBe(1);
    expect(
      (
        await db.query(
          `SELECT count(*)::int n FROM operational_alert_signals WHERE organization_id=$1 AND source_id=$2`,
          [org, lateId]
        )
      ).rows[0].n
    ).toBe(1);
    await reconstructTerminalOperationalAlertIntents();
    expect(
      (
        await db.query(
          `SELECT count(*)::int n FROM operational_alert_repair_intents WHERE organization_id=$1 AND source_terminal_id=$2`,
          [org, lateId]
        )
      ).rows[0].n
    ).toBe(1);
    await db.end();
  });
  it('repair OFF consumes nothing; an expired worker is fenced after a second worker reclaims', async () => {
    const off = await enqueueOperationalAlertRepairIntent({
      ...input,
      sourceTerminalId: `${prefix}-off`,
      correlationId: `${prefix}-off`,
    });
    process.env.OPERATIONAL_ALERT_REPAIR_ENABLED = 'false';
    expect(await runOperationalAlertRepairTick({ workerId: `${prefix}-off-worker` })).toMatchObject(
      { claimed: 0, completed: 0 }
    );
    const db = new Client({ connectionString: url });
    await db.connect();
    expect(
      (
        await db.query(`SELECT status FROM operational_alert_repair_intents WHERE intent_id=$1`, [
          off.intent_id,
        ])
      ).rows[0].status
    ).toBe('PENDING');
    expect(
      (
        await db.query(`SELECT count(*)::int n FROM operational_alert_signals WHERE source_id=$1`, [
          off.source_terminal_id,
        ])
      ).rows[0].n
    ).toBe(0);
    process.env.OPERATIONAL_ALERT_REPAIR_ENABLED = 'true';
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const old = runOperationalAlertRepairTick({
      workerId: `${prefix}-old`,
      leaseMs: 20,
      beforeFinalize: () => barrier,
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
    const winner = await runOperationalAlertRepairTick({ workerId: `${prefix}-new` });
    release();
    const loser = await old;
    expect(winner).toMatchObject({ completed: 1 });
    expect(loser).toMatchObject({ completed: 0, fenced: 1 });
    const row = (
      await db.query(
        `SELECT status,fencing_version FROM operational_alert_repair_intents WHERE intent_id=$1`,
        [off.intent_id]
      )
    ).rows[0];
    expect(row).toMatchObject({ status: 'COMPLETED', fencing_version: 2 });
    const attempts = await db.query(
      `SELECT event_type,worker_id FROM operational_alert_repair_attempts WHERE intent_id=$1 ORDER BY created_at`,
      [off.intent_id]
    );
    expect(attempts.rows.map((r) => r.event_type)).toEqual(
      expect.arrayContaining(['CLAIMED', 'RECLAIMED', 'SUCCEEDED', 'FENCED'])
    );
    expect(
      (
        await db.query(
          `SELECT count(*)::int n FROM operational_alert_repair_receipts WHERE intent_id=$1`,
          [off.intent_id]
        )
      ).rows[0].n
    ).toBe(1);
    await db.end();
  });
  it('reconstructs terminal Results and Case rows after the simulated crash without replaying business work', async () => {
    const db = new Client({ connectionString: url });
    await db.connect();
    const event = randomUUID(),
      command = randomUUID(),
      correlation = randomUUID(),
      caseEvent = `${prefix}-case-event`;
    await db.query(
      `INSERT INTO rvn_platform_events(event_id,event_type,aggregate_type,aggregate_id,organization_id,actor_user_id,actor_effective_role,command_id,correlation_id,policy_version,state_hash,source,idempotency_key,resulting_version) VALUES($1,'test.completed','test',$2,$3,$4,'SYSTEM',$5,$6,'v1','hash','test',$7,1)`,
      [event, `${prefix}-aggregate`, org, `${prefix}-actor`, command, correlation, `${prefix}-idem`]
    );
    const outbox = (
      await db.query(
        `INSERT INTO rvn_platform_outbox(event_id,consumer_group,status,dispatched_at) VALUES($1,'test','dispatched',now()) RETURNING outbox_id`,
        [event]
      )
    ).rows[0].outbox_id;
    await db.query(
      `INSERT INTO case_workspace_event_outbox(event_id,event_type,organization_id,aggregate_type,aggregate_id,actor_user_id,correlation_id,delivered_at) VALUES($1,'test.delivered',$2,'test',$3,$4,$5,now())`,
      [caseEvent, org, `${prefix}-case`, `${prefix}-actor`, `${prefix}-case-corr`]
    );
    expect(await reconstructTerminalOperationalAlertIntents()).toBeGreaterThanOrEqual(2);
    expect(await runOperationalAlertRepairTick({ workerId: `${prefix}-all3` })).toMatchObject({
      completed: 2,
    });
    const rows = await db.query(
      `SELECT source_type,source_terminal_id,status FROM operational_alert_repair_intents WHERE organization_id=$1 AND source_terminal_id=ANY($2) ORDER BY source_type`,
      [org, [outbox, caseEvent]]
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.every((r) => r.status === 'COMPLETED')).toBe(true);
    expect(
      (
        await db.query(
          `SELECT count(*)::int n FROM operational_alert_signals WHERE organization_id=$1 AND source_id=ANY($2)`,
          [org, [outbox, caseEvent]]
        )
      ).rows[0].n
    ).toBe(2);
    expect(
      (await db.query(`SELECT status FROM rvn_platform_outbox WHERE event_id=$1`, [event])).rows[0]
        .status
    ).toBe('dispatched');
    expect(
      (
        await db.query(
          `SELECT delivered_at IS NOT NULL delivered FROM case_workspace_event_outbox WHERE event_id=$1`,
          [caseEvent]
        )
      ).rows[0].delivered
    ).toBe(true);
    await db.end();
  });
  it('bounds retries, dead-letters and supports deliberate redrive', async () => {
    const intent = await enqueueOperationalAlertRepairIntent({
      ...input,
      sourceTerminalId: `${prefix}-dlq`,
      correlationId: `${prefix}-dlq`,
    });
    const db = new Client({ connectionString: url });
    await db.connect();
    await db.query(
      `UPDATE operational_alert_repair_intents SET max_attempts=2 WHERE intent_id=$1`,
      [intent.intent_id]
    );
    await db.query(
      `ALTER TABLE operational_alert_signals RENAME TO operational_alert_signals_unavailable`
    );
    try {
      expect(await runOperationalAlertRepairTick({ workerId: `${prefix}-fail1` })).toMatchObject({
        failed: 1,
        deadLettered: 0,
      });
      await db.query(
        `UPDATE operational_alert_repair_intents SET available_at=now() WHERE intent_id=$1`,
        [intent.intent_id]
      );
      expect(await runOperationalAlertRepairTick({ workerId: `${prefix}-fail2` })).toMatchObject({
        failed: 1,
        deadLettered: 1,
      });
    } finally {
      await db.query(
        `ALTER TABLE operational_alert_signals_unavailable RENAME TO operational_alert_signals`
      );
    }
    await expect(redriveOperationalAlertRepairIntent(intent.intent_id, '')).rejects.toThrow(
      'OPS_ALERT_REPAIR_OPERATOR_REQUIRED'
    );
    expect(
      await redriveOperationalAlertRepairIntent(intent.intent_id, `${prefix}-operator`)
    ).toMatchObject({
      status: 'PENDING',
      attempt_count: 0,
    });
    expect(
      (
        await db.query(
          `SELECT operator_actor_id FROM operational_alert_repair_attempts WHERE intent_id=$1 AND event_type='REDRIVEN'`,
          [intent.intent_id]
        )
      ).rows[0].operator_actor_id
    ).toBe(`${prefix}-operator`);
    expect(await runOperationalAlertRepairTick({ workerId: `${prefix}-redrive` })).toMatchObject({
      completed: 1,
    });
    await db.end();
  });
  it('enforces tenant-bound receipts, lease checks and immutable attempt/redrive history', async () => {
    const intent = await enqueueOperationalAlertRepairIntent({
      ...input,
      sourceTerminalId: `${prefix}-constraints`,
      correlationId: `${prefix}-constraints`,
    });
    expect(
      await runOperationalAlertRepairTick({ workerId: `${prefix}-constraints-worker` })
    ).toMatchObject({ completed: 1 });
    const db = new Client({ connectionString: url });
    await db.connect();
    const receipt = (
      await db.query(`SELECT signal_id FROM operational_alert_repair_receipts WHERE intent_id=$1`, [
        intent.intent_id,
      ])
    ).rows[0];
    await expect(
      db.query(
        `INSERT INTO operational_alert_repair_receipts(intent_id,organization_id,signal_id,fencing_version) VALUES($1,'foreign-org',$2,1)`,
        [intent.intent_id, receipt.signal_id]
      )
    ).rejects.toThrow();
    await expect(
      db.query(
        `UPDATE operational_alert_repair_receipts SET repaired_at=now() WHERE intent_id=$1`,
        [intent.intent_id]
      )
    ).rejects.toThrow();
    await expect(
      db.query(`DELETE FROM operational_alert_repair_attempts WHERE intent_id=$1`, [
        intent.intent_id,
      ])
    ).rejects.toThrow();
    await expect(
      db.query(
        `UPDATE operational_alert_repair_intents SET status='PROCESSING' WHERE intent_id=$1`,
        [intent.intent_id]
      )
    ).rejects.toThrow();
    await expect(
      db.query(`UPDATE operational_alert_repair_intents SET max_attempts=0 WHERE intent_id=$1`, [
        intent.intent_id,
      ])
    ).rejects.toThrow();
    await db.end();
  });
});
