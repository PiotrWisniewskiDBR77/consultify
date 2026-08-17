/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

import {
  acknowledgeOperationalIncident,
  persistOperationalAlertSnapshot,
  readOpenOperationalIncidents,
} from '../operationalAlertIncidentService.js';
import type { OperationalAlert } from '../operationalAlertService.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const fixtureIncidentIds = new Set<string>();

function alert(active: boolean): OperationalAlert {
  return {
    kind: 'WRITE_FAILURE_RATE',
    active,
    value: active ? 0.02 : 0,
    threshold: 0.01,
    runbookId: 'OPS-OBS-001',
    detectedAt: active ? '2026-08-17T01:00:00.000Z' : null,
    recoveredAt: active ? null : '2026-08-17T01:05:01.000Z',
    acknowledgedAt: null,
    correlationId: active ? `ops-${randomUUID()}` : null,
  };
}

describe.skipIf(!REAL_PG)('OPS-OBS-001 durable incident ledger (real PostgreSQL)', () => {
  afterAll(async () => {
    if (fixtureIncidentIds.size === 0) return;
    const cleanup = new Client({ connectionString: DATABASE_URL });
    await cleanup.connect();
    const ids = [...fixtureIncidentIds];
    try {
      await cleanup.query('BEGIN');
      await cleanup.query('ALTER TABLE operational_alert_incident_events DISABLE TRIGGER trg_operational_alert_events_append_only');
      await cleanup.query('DELETE FROM operational_alert_incident_events WHERE incident_id = ANY($1::uuid[])', [ids]);
      await cleanup.query('ALTER TABLE operational_alert_incident_events ENABLE TRIGGER trg_operational_alert_events_append_only');
      await cleanup.query('DELETE FROM operational_alert_incidents WHERE incident_id = ANY($1::uuid[])', [ids]);
      await cleanup.query('COMMIT');
    } catch (error) {
      await cleanup.query('ROLLBACK').catch(() => undefined);
      // DDL is transactional in PostgreSQL, but force the production guard back on even if
      // the cleanup transaction failed after disabling it.
      await cleanup.query('ALTER TABLE operational_alert_incident_events ENABLE TRIGGER trg_operational_alert_events_append_only').catch(() => undefined);
      throw error;
    } finally {
      await cleanup.end();
    }
  });

  it('serializes concurrent detection, survives cold read, recovers, acknowledges and denies event mutation', async () => {
    const detections = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        persistOperationalAlertSnapshot({
          alerts: [alert(true)],
          evaluatorId: `ops-evaluator-${index}`,
        })
      )
    );
    const incidentIds = detections.flat().map((incident) => incident.incidentId);
    expect(new Set(incidentIds).size).toBe(1);
    const incidentId = incidentIds[0];
    fixtureIncidentIds.add(incidentId);

    const cold = new Client({ connectionString: DATABASE_URL });
    await cold.connect();
    const active = await cold.query(
      `SELECT status,runbook_id,count(*) OVER()::int AS open_count
         FROM operational_alert_incidents
        WHERE kind='WRITE_FAILURE_RATE' AND status IN ('ACTIVE','RECOVERED')`
    );
    const detectedEvents = await cold.query(
      `SELECT event_id,event_type FROM operational_alert_incident_events
        WHERE incident_id=$1 ORDER BY occurred_at,event_id`,
      [incidentId]
    );
    expect(active.rows).toHaveLength(1);
    expect(active.rows[0]).toMatchObject({
      status: 'ACTIVE',
      runbook_id: 'OPS-OBS-001',
      open_count: 1,
    });
    expect(detectedEvents.rows).toHaveLength(1);
    expect(detectedEvents.rows[0].event_type).toBe('DETECTED');

    const restartSafe = await persistOperationalAlertSnapshot({
      alerts: [alert(false)],
      evaluatorId: 'ops-fresh-replica-without-samples',
    });
    expect(restartSafe[0]).toMatchObject({ incidentId, status: 'ACTIVE' });

    const recovered = await persistOperationalAlertSnapshot({
      alerts: [alert(false)],
      evaluatorId: 'ops-recovery',
      recoveryGraceMs: { WRITE_FAILURE_RATE: 0 },
    });
    expect(recovered[0]).toMatchObject({ incidentId, status: 'RECOVERED' });

    const acknowledged = await acknowledgeOperationalIncident({
      incidentId,
      evaluatorId: 'ops-human-ack',
    });
    expect(acknowledged.status).toBe('ACKNOWLEDGED');
    expect(acknowledged.acknowledgedAt).not.toBeNull();
    expect(await readOpenOperationalIncidents()).toEqual([]);

    const events = await cold.query(
      `SELECT event_id,event_type FROM operational_alert_incident_events
        WHERE incident_id=$1 ORDER BY occurred_at,event_id`,
      [incidentId]
    );
    expect(events.rows.map((row) => row.event_type)).toEqual([
      'DETECTED',
      'RECOVERED',
      'ACKNOWLEDGED',
    ]);
    await expect(
      cold.query(
        `UPDATE operational_alert_incident_events SET event_type='DETECTED' WHERE event_id=$1`,
        [events.rows[0].event_id]
      )
    ).rejects.toThrow(/append-only/);
    await expect(
      cold.query(`DELETE FROM operational_alert_incident_events WHERE event_id=$1`, [
        events.rows[0].event_id,
      ])
    ).rejects.toThrow(/append-only/);
    await cold.end();
  });

  it('fails closed for invalid evaluator identity and active acknowledgment', async () => {
    await expect(
      persistOperationalAlertSnapshot({ alerts: [alert(true)], evaluatorId: 'contains secret' })
    ).rejects.toThrow('OPS_ALERT_EVALUATOR_ID_INVALID');

    const created = await persistOperationalAlertSnapshot({
      alerts: [
        {
          ...alert(true),
          kind: 'OUTBOX_OLDEST_AGE',
          value: 360_000,
          threshold: 300_000,
        },
      ],
      evaluatorId: 'ops-active-control',
    });
    fixtureIncidentIds.add(created[0].incidentId);
    await expect(
      acknowledgeOperationalIncident({
        incidentId: created[0].incidentId,
        evaluatorId: 'ops-human-ack',
      })
    ).rejects.toThrow('OPS_ALERT_INCIDENT_STILL_ACTIVE');
  });
});
