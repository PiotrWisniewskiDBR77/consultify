import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getPrimaryPoolSaturationPercent } from '../../../../database/PostgresDatabase.js';
import { operationalAlerts } from '../../../operationalAlertService.js';
import {
  getMissedResultsDurableAlertSignals,
  runOutboxDispatchTick,
} from '../platformOutboxDrainCron.js';

const databaseUrl = process.env.DATABASE_URL || '';
const marker = `ops_obs_${Date.now()}_${randomUUID().slice(0, 8)}`;
const eventId = randomUUID();
const outboxId = randomUUID();
let client: Client;

describe('OPS-OBS-001 production signal wiring (real PostgreSQL)', () => {
  beforeAll(async () => {
    if (process.env.RUN_DB_TESTS !== '1' || !databaseUrl) {
      throw new Error('RUN_DB_TESTS=1 and DATABASE_URL are required; refusing a vacuous pass');
    }
    operationalAlerts.resetForTests();
    process.env.OPERATIONAL_ALERT_DURABLE_ENABLED = 'true';
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(
      `INSERT INTO rvn_platform_events (
         event_id, schema_version, event_type, aggregate_type, aggregate_id,
         organization_id, actor_user_id, actor_effective_role, command_id,
         correlation_id, policy_version, state_hash, source, idempotency_key,
         resulting_version, payload
       ) VALUES ($1, 1, 'ops.positive_control', 'initiative', $2, $3, $4,
                 'ADMIN', $5, $6, 'ops-v1', $7, 'ops-observability-test', $8, 1, '{}')`,
      [
        eventId,
        `${marker}:aggregate`,
        `${marker}:tenant`,
        `${marker}:actor`,
        randomUUID(),
        randomUUID(),
        `${marker}:hash`,
        `${marker}:idempotency`,
      ]
    );
    await client.query(
      `INSERT INTO rvn_platform_outbox (
         outbox_id, event_id, consumer_group, status, attempts, max_attempts,
         next_attempt_at, created_at
       ) VALUES ($1, $2, $3, 'pending', 0, 1, now(), now() - interval '6 minutes')`,
      [outboxId, eventId, `${marker}:unregistered`]
    );
  });

  afterAll(async () => {
    if (!client) return;
    delete process.env.OPERATIONAL_ALERT_DURABLE_ENABLED;
    await client.query(
      'ALTER TABLE operational_alert_repair_receipts DISABLE TRIGGER trg_operational_alert_repair_receipts_immutable'
    );
    await client.query('DELETE FROM operational_alert_repair_receipts WHERE organization_id = $1', [
      `${marker}:tenant`,
    ]);
    await client.query(
      'ALTER TABLE operational_alert_repair_receipts ENABLE TRIGGER trg_operational_alert_repair_receipts_immutable'
    );
    await client.query(
      'ALTER TABLE operational_alert_repair_attempts DISABLE TRIGGER trg_operational_alert_repair_attempts_immutable'
    );
    await client.query('DELETE FROM operational_alert_repair_attempts WHERE organization_id = $1', [
      `${marker}:tenant`,
    ]);
    await client.query(
      'ALTER TABLE operational_alert_repair_attempts ENABLE TRIGGER trg_operational_alert_repair_attempts_immutable'
    );
    await client.query('DELETE FROM operational_alert_repair_intents WHERE organization_id = $1', [
      `${marker}:tenant`,
    ]);
    await client.query(
      'ALTER TABLE operational_alert_signals DISABLE TRIGGER trg_operational_alert_signals_immutable'
    );
    await client.query('DELETE FROM operational_alert_signals WHERE organization_id = $1', [
      `${marker}:tenant`,
    ]);
    await client.query(
      'ALTER TABLE operational_alert_signals ENABLE TRIGGER trg_operational_alert_signals_immutable'
    );
    await client.query('DELETE FROM rvn_platform_outbox WHERE outbox_id = $1', [outboxId]);
    await client.query('DELETE FROM rvn_platform_events WHERE event_id = $1', [eventId]);
    await client.end();
  });

  it('records oldest outbox age and a terminal dispatcher failure from the real tick', async () => {
    const result = await runOutboxDispatchTick(10);
    expect(result).toMatchObject({ claimed: 1, failed: 1, deadLettered: 1 });

    const alerts = Object.fromEntries(
      operationalAlerts.evaluate().map((alert) => [alert.kind, alert])
    );
    expect(alerts.OUTBOX_OLDEST_AGE).toMatchObject({ active: true, threshold: 300_000 });
    expect(alerts.WRITE_FAILURE_RATE).toMatchObject({ active: true, value: 1, threshold: 0.01 });
    expect(alerts.WRITE_FAILURE_RATE.correlationId).toBe(eventId);

    const persisted = await client.query<{ status: string; attempts: number }>(
      'SELECT status, attempts FROM rvn_platform_outbox WHERE outbox_id = $1',
      [outboxId]
    );
    expect(persisted.rows[0]).toMatchObject({ status: 'dead_letter', attempts: 1 });
    const durable = await client.query(
      `SELECT organization_id,actor_id,correlation_id,outcome,status,source_terminal_id FROM operational_alert_repair_intents WHERE organization_id=$1`,
      [`${marker}:tenant`]
    );
    expect(durable.rows).toEqual([
      {
        organization_id: `${marker}:tenant`,
        actor_id: `${marker}:actor`,
        correlation_id: eventId,
        outcome: 'FAILURE',
        status: 'PENDING',
        source_terminal_id: outboxId,
      },
    ]);
  });

  it('exposes a finite primary-pool saturation sample without payload or tenant labels', () => {
    const saturation = getPrimaryPoolSaturationPercent();
    expect(Number.isFinite(saturation)).toBe(true);
    expect(saturation).toBeGreaterThanOrEqual(0);
    expect(saturation).toBeLessThanOrEqual(100);
  });

  it('preserves the primary terminal marker when the secondary signal store fails', async () => {
    await client.query(
      `UPDATE rvn_platform_outbox SET status='pending',attempts=0,next_attempt_at=now() WHERE outbox_id=$1`,
      [outboxId]
    );
    await client.query(
      `ALTER TABLE operational_alert_repair_intents RENAME TO operational_alert_repair_intents_forced_down`
    );
    const before = getMissedResultsDurableAlertSignals();
    try {
      const result = await runOutboxDispatchTick(10);
      expect(result).toMatchObject({ claimed: 1, failed: 1, deadLettered: 1 });
      expect(getMissedResultsDurableAlertSignals()).toBe(before + 1);
      expect(
        (
          await client.query(`SELECT status,attempts FROM rvn_platform_outbox WHERE outbox_id=$1`, [
            outboxId,
          ])
        ).rows[0]
      ).toMatchObject({ status: 'dead_letter', attempts: 1 });
    } finally {
      await client.query(
        `ALTER TABLE operational_alert_repair_intents_forced_down RENAME TO operational_alert_repair_intents`
      );
    }
  });
});
