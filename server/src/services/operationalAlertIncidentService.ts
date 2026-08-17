import { type PgTransactionClient, withPgTransaction } from '../utils/queryHelpers.js';
import type { OperationalAlert, OperationalAlertKind } from './operationalAlertService.js';

const SAFE_EVALUATOR = /^[A-Za-z0-9._:-]{1,128}$/;

export interface DurableOperationalIncident {
  incidentId: string;
  kind: OperationalAlertKind;
  status: 'ACTIVE' | 'RECOVERED' | 'ACKNOWLEDGED';
  detectedAt: string;
  recoveredAt: string | null;
  acknowledgedAt: string | null;
  correlationId: string | null;
  detectedValue: number;
  latestValue: number;
  threshold: number;
  evaluatorId: string;
  version: number;
}

interface IncidentRow {
  incident_id: string;
  kind: OperationalAlertKind;
  status: DurableOperationalIncident['status'];
  detected_at: Date | string;
  recovered_at: Date | string | null;
  acknowledged_at: Date | string | null;
  correlation_id: string | null;
  detected_value: number | string;
  latest_value: number | string;
  threshold: number | string;
  last_breached_at: Date | string;
  evaluator_id: string;
  version: number;
}

const DEFAULT_RECOVERY_GRACE_MS: Record<OperationalAlertKind, number> = {
  WRITE_FAILURE_RATE: 5 * 60 * 1000,
  OUTBOX_OLDEST_AGE: 5 * 60 * 1000,
  DB_SATURATION: 10 * 60 * 1000,
  REPEATED_AUTH_DENIALS: 5 * 60 * 1000,
};

function requireEvaluatorId(value: string): string {
  const normalized = value.trim();
  if (!SAFE_EVALUATOR.test(normalized)) throw new Error('OPS_ALERT_EVALUATOR_ID_INVALID');
  return normalized;
}

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

function mapIncident(row: IncidentRow): DurableOperationalIncident {
  return {
    incidentId: row.incident_id,
    kind: row.kind,
    status: row.status,
    detectedAt: iso(row.detected_at)!,
    recoveredAt: iso(row.recovered_at),
    acknowledgedAt: iso(row.acknowledged_at),
    correlationId: row.correlation_id,
    detectedValue: Number(row.detected_value),
    latestValue: Number(row.latest_value),
    threshold: Number(row.threshold),
    evaluatorId: row.evaluator_id,
    version: Number(row.version),
  };
}

async function appendEvent(
  tx: PgTransactionClient,
  incident: IncidentRow,
  eventType: 'DETECTED' | 'RECOVERED' | 'ACKNOWLEDGED',
  value: number,
  evaluatorId: string,
  correlationId: string | null
): Promise<void> {
  await tx.query(
    `INSERT INTO operational_alert_incident_events
       (incident_id,kind,event_type,value,threshold,correlation_id,evaluator_id)
     VALUES(?,?,?,?,?,?,?)`,
    [
      incident.incident_id,
      incident.kind,
      eventType,
      value,
      Number(incident.threshold),
      correlationId,
      evaluatorId,
    ]
  );
}

async function reconcileOne(
  tx: PgTransactionClient,
  alert: OperationalAlert,
  evaluatorId: string,
  recoveryGraceMs: number
): Promise<DurableOperationalIncident | null> {
  await tx.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [`ops-alert:${alert.kind}`]);
  const open = await tx.query<IncidentRow>(
    `SELECT * FROM operational_alert_incidents
      WHERE kind=? AND status IN ('ACTIVE','RECOVERED')
      ORDER BY detected_at DESC LIMIT 1 FOR UPDATE`,
    [alert.kind]
  );
  let incident = open.rows[0] ?? null;

  if (alert.active) {
    if (!incident) {
      const inserted = await tx.query<IncidentRow>(
        `INSERT INTO operational_alert_incidents
           (kind,status,detected_at,correlation_id,detected_value,latest_value,threshold,
            last_breached_at,evaluator_id)
         VALUES(?,'ACTIVE',?,?,?,?,?,now(),?) RETURNING *`,
        [
          alert.kind,
          alert.detectedAt ?? new Date().toISOString(),
          alert.correlationId,
          alert.value,
          alert.value,
          alert.threshold,
          evaluatorId,
        ]
      );
      incident = inserted.rows[0];
      await appendEvent(tx, incident, 'DETECTED', alert.value, evaluatorId, alert.correlationId);
    } else if (incident.status === 'RECOVERED') {
      const reopened = await tx.query<IncidentRow>(
        `UPDATE operational_alert_incidents
            SET status='ACTIVE',recovered_at=NULL,acknowledged_at=NULL,
                correlation_id=?,latest_value=?,threshold=?,last_breached_at=now(),last_evaluated_at=now(),
                evaluator_id=?,version=version+1
          WHERE incident_id=? RETURNING *`,
        [alert.correlationId, alert.value, alert.threshold, evaluatorId, incident.incident_id]
      );
      incident = reopened.rows[0];
      await appendEvent(tx, incident, 'DETECTED', alert.value, evaluatorId, alert.correlationId);
    } else {
      const refreshed = await tx.query<IncidentRow>(
        `UPDATE operational_alert_incidents
            SET latest_value=?,threshold=?,last_breached_at=now(),last_evaluated_at=now(),evaluator_id=?,version=version+1
          WHERE incident_id=? RETURNING *`,
        [alert.value, alert.threshold, evaluatorId, incident.incident_id]
      );
      incident = refreshed.rows[0];
    }
  } else if (incident?.status === 'ACTIVE') {
    const recovered = await tx.query<IncidentRow>(
      `UPDATE operational_alert_incidents
          SET status='RECOVERED',recovered_at=?,latest_value=?,threshold=?,
              last_evaluated_at=now(),evaluator_id=?,version=version+1
        WHERE incident_id=?
          AND last_breached_at <= now() - (? * interval '1 millisecond')
        RETURNING *`,
      [
        alert.recoveredAt ?? new Date().toISOString(),
        alert.value,
        alert.threshold,
        evaluatorId,
        incident.incident_id,
        recoveryGraceMs,
      ]
    );
    if (recovered.rows[0]) {
      incident = recovered.rows[0];
      await appendEvent(tx, incident, 'RECOVERED', alert.value, evaluatorId, alert.correlationId);
    }
  } else if (incident) {
    const refreshed = await tx.query<IncidentRow>(
      `UPDATE operational_alert_incidents
          SET latest_value=?,threshold=?,last_evaluated_at=now(),evaluator_id=?,version=version+1
        WHERE incident_id=? RETURNING *`,
      [alert.value, alert.threshold, evaluatorId, incident.incident_id]
    );
    incident = refreshed.rows[0];
  }

  return incident ? mapIncident(incident) : null;
}

export async function persistOperationalAlertSnapshot(params: {
  alerts: OperationalAlert[];
  evaluatorId: string;
  recoveryGraceMs?: Partial<Record<OperationalAlertKind, number>>;
}): Promise<DurableOperationalIncident[]> {
  const evaluatorId = requireEvaluatorId(params.evaluatorId);
  return withPgTransaction(async (tx) => {
    const result: DurableOperationalIncident[] = [];
    for (const alert of params.alerts) {
      const configuredGrace = params.recoveryGraceMs?.[alert.kind];
      const recoveryGraceMs =
        typeof configuredGrace === 'number' && Number.isFinite(configuredGrace)
          ? Math.max(0, configuredGrace)
          : DEFAULT_RECOVERY_GRACE_MS[alert.kind];
      const incident = await reconcileOne(tx, alert, evaluatorId, recoveryGraceMs);
      if (incident) result.push(incident);
    }
    return result;
  });
}

export async function acknowledgeOperationalIncident(params: {
  incidentId: string;
  evaluatorId: string;
}): Promise<DurableOperationalIncident> {
  const evaluatorId = requireEvaluatorId(params.evaluatorId);
  if (!/^[0-9a-f-]{36}$/i.test(params.incidentId)) throw new Error('OPS_ALERT_INCIDENT_ID_INVALID');
  return withPgTransaction(async (tx) => {
    const selected = await tx.query<IncidentRow>(
      `SELECT * FROM operational_alert_incidents WHERE incident_id=? FOR UPDATE`,
      [params.incidentId]
    );
    const incident = selected.rows[0];
    if (!incident) throw new Error('OPS_ALERT_INCIDENT_NOT_FOUND');
    if (incident.status === 'ACTIVE') throw new Error('OPS_ALERT_INCIDENT_STILL_ACTIVE');
    if (incident.status === 'ACKNOWLEDGED') return mapIncident(incident);
    const updated = await tx.query<IncidentRow>(
      `UPDATE operational_alert_incidents
          SET status='ACKNOWLEDGED',acknowledged_at=now(),evaluator_id=?,version=version+1
        WHERE incident_id=? RETURNING *`,
      [evaluatorId, params.incidentId]
    );
    await appendEvent(
      tx,
      updated.rows[0],
      'ACKNOWLEDGED',
      Number(updated.rows[0].latest_value),
      evaluatorId,
      updated.rows[0].correlation_id
    );
    return mapIncident(updated.rows[0]);
  });
}

export async function readOpenOperationalIncidents(): Promise<DurableOperationalIncident[]> {
  return withPgTransaction(async (tx) => {
    const rows = await tx.query<IncidentRow>(
      `SELECT * FROM operational_alert_incidents
        WHERE status IN ('ACTIVE','RECOVERED') ORDER BY detected_at,incident_id`
    );
    return rows.rows.map(mapIncident);
  });
}
