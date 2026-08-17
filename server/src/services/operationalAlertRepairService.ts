import crypto from 'node:crypto';
import { withPgTransaction } from '../utils/queryHelpers.js';
import {
  durableOperationalAlertsEnabled,
  recordOperationalAlertSignal,
  type SignalOutcome,
} from './operationalAlertSignalDeliveryService.js';
import type { OperationalAlertKind } from './operationalAlertService.js';

export interface AlertRepairIntentInput {
  organizationId: string;
  actorId: string;
  correlationId: string;
  sourceType: string;
  sourceTerminalId: string;
  kind: OperationalAlertKind;
  outcome: SignalOutcome;
  observedValue?: number;
  effectiveAt?: Date | string;
}
const digest = (v: unknown) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');

export async function enqueueOperationalAlertRepairIntent(input: AlertRepairIntentInput) {
  const normalized = {
    ...input,
    effectiveAt: input.effectiveAt ? new Date(input.effectiveAt).toISOString() : undefined,
  };
  const fingerprint = digest(normalized);
  return withPgTransaction(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [
      `ops-repair:${input.organizationId}:${input.sourceType}:${input.sourceTerminalId}:${input.outcome}`,
    ]);
    const old = await tx.query<any>(
      `SELECT * FROM operational_alert_repair_intents WHERE organization_id=? AND source_type=? AND source_terminal_id=? AND outcome=?`,
      [input.organizationId, input.sourceType, input.sourceTerminalId, input.outcome]
    );
    if (old.rows[0]) {
      if (old.rows[0].input_fingerprint !== fingerprint)
        throw new Error('OPS_ALERT_REPAIR_COLLISION');
      return old.rows[0];
    }
    return (
      await tx.query<any>(
        `INSERT INTO operational_alert_repair_intents(organization_id,actor_id,correlation_id,source_type,source_terminal_id,effective_at,kind,outcome,observed_value,input_fingerprint) VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING *`,
        [
          input.organizationId,
          input.actorId,
          input.correlationId,
          input.sourceType,
          input.sourceTerminalId,
          input.effectiveAt ?? new Date(),
          input.kind,
          input.outcome,
          input.observedValue ?? 1,
          fingerprint,
        ]
      )
    ).rows[0];
  });
}

type Source = { name: string; sql: string };
const sources: Source[] = [
  {
    name: 'rvn_platform_outbox',
    sql: `SELECT e.organization_id,COALESCE(e.actor_user_id,'system') actor_id,e.event_id::text correlation_id,o.outbox_id::text terminal_id,COALESCE(o.dispatched_at,o.next_attempt_at,o.created_at) effective_at,CASE WHEN o.status='dispatched' THEN 'SUCCESS' ELSE 'FAILURE' END outcome FROM rvn_platform_outbox o JOIN rvn_platform_events e ON e.event_id=o.event_id WHERE o.status IN ('dispatched','dead_letter')`,
  },
  {
    name: 'notification_outbox',
    sql: `SELECT organization_id,user_id actor_id,id correlation_id,id terminal_id,COALESCE(updated_at,created_at) effective_at,CASE WHEN status='SENT' THEN 'SUCCESS' ELSE 'FAILURE' END outcome FROM notification_outbox WHERE status IN ('SENT','FAILED')`,
  },
  {
    name: 'case_workspace_event_outbox',
    sql: `SELECT organization_id,'system:case-workspace-outbox' actor_id,correlation_id,event_id terminal_id,COALESCE(delivered_at,next_retry_at,created_at) effective_at,CASE WHEN delivered_at IS NOT NULL THEN 'SUCCESS' ELSE 'FAILURE' END outcome FROM case_workspace_event_outbox WHERE delivered_at IS NOT NULL OR delivery_attempt_count>=8`,
  },
];

/** Bounded, indexed cursor scan. Terminal timestamps change when old source rows become terminal, so late terminals sort after the cursor. */
export async function reconstructTerminalOperationalAlertIntents(
  limitPerSource = 100
): Promise<number> {
  if (!durableOperationalAlertsEnabled() || process.env.OPERATIONAL_ALERT_REPAIR_ENABLED !== 'true')
    return 0;
  let total = 0;
  for (const source of sources)
    total += await withPgTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO operational_alert_repair_cursors(source_type) VALUES(?) ON CONFLICT DO NOTHING`,
        [source.name]
      );
      const cursor = (
        await tx.query<any>(
          `SELECT effective_at,terminal_id FROM operational_alert_repair_cursors WHERE source_type=? FOR UPDATE`,
          [source.name]
        )
      ).rows[0];
      const rows = (
        await tx.query<any>(
          `SELECT * FROM (${source.sql}) s WHERE (effective_at,terminal_id)>
            (SELECT effective_at,terminal_id FROM operational_alert_repair_cursors WHERE source_type=?)
            AND effective_at<=now() ORDER BY effective_at,terminal_id LIMIT ?`,
          [source.name, limitPerSource]
        )
      ).rows;
      for (const row of rows) {
        const input = {
          organizationId: row.organization_id,
          actorId: row.actor_id,
          correlationId: row.correlation_id,
          sourceType: source.name,
          sourceTerminalId: row.terminal_id,
          effectiveAt: row.effective_at,
          kind: 'WRITE_FAILURE_RATE',
          outcome: row.outcome,
          observedValue: 1,
        };
        const fp = digest({ ...input, effectiveAt: new Date(row.effective_at).toISOString() });
        await tx.query(
          `INSERT INTO operational_alert_repair_intents(organization_id,actor_id,correlation_id,source_type,source_terminal_id,effective_at,kind,outcome,observed_value,input_fingerprint) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,source_type,source_terminal_id,outcome) DO NOTHING`,
          [
            input.organizationId,
            input.actorId,
            input.correlationId,
            input.sourceType,
            input.sourceTerminalId,
            input.effectiveAt,
            input.kind,
            input.outcome,
            input.observedValue,
            fp,
          ]
        );
      }
      const last = rows.at(-1);
      if (last)
        await tx.query(
          `UPDATE operational_alert_repair_cursors SET effective_at=?,terminal_id=?,updated_at=now() WHERE source_type=?`,
          [last.effective_at, last.terminal_id, source.name]
        );
      return rows.length;
    });
  return total;
}

export async function runOperationalAlertRepairTick(params: {
  workerId: string;
  limit?: number;
  leaseMs?: number;
  beforeFinalize?: (row: any) => Promise<void>;
}): Promise<{
  claimed: number;
  completed: number;
  failed: number;
  deadLettered: number;
  fenced: number;
}> {
  if (!durableOperationalAlertsEnabled() || process.env.OPERATIONAL_ALERT_REPAIR_ENABLED !== 'true')
    return { claimed: 0, completed: 0, failed: 0, deadLettered: 0, fenced: 0 };
  await reconstructTerminalOperationalAlertIntents(params.limit ?? 100);
  const token = crypto.randomUUID();
  const rows = await withPgTransaction(
    async (tx) =>
      (
        await tx.query<any>(
          `WITH c AS (SELECT intent_id,status previous_status FROM operational_alert_repair_intents WHERE ((status IN ('PENDING','FAILED') AND available_at<=now()) OR (status='PROCESSING' AND lease_expires_at<now())) AND attempt_count<max_attempts ORDER BY effective_at,intent_id FOR UPDATE SKIP LOCKED LIMIT ?) UPDATE operational_alert_repair_intents i SET status='PROCESSING',lease_owner=?,lease_token=?,fencing_version=fencing_version+1,lease_expires_at=now()+(?*interval '1 millisecond') FROM c WHERE i.intent_id=c.intent_id RETURNING i.*,c.previous_status`,
          [params.limit ?? 50, params.workerId, token, params.leaseMs ?? 30000]
        )
      ).rows
  );
  await withPgTransaction(async (tx) => {
    for (const r of rows)
      await tx.query(
        `INSERT INTO operational_alert_repair_attempts(intent_id,organization_id,event_type,worker_id,lease_token,fencing_version) VALUES(?,?,?,?,?,?)`,
        [
          r.intent_id,
          r.organization_id,
          r.previous_status === 'PROCESSING' ? 'RECLAIMED' : 'CLAIMED',
          params.workerId,
          r.lease_token,
          r.fencing_version,
        ]
      );
  });
  let completed = 0,
    failed = 0,
    deadLettered = 0,
    fenced = 0;
  for (const row of rows)
    try {
      const signal = await recordOperationalAlertSignal({
        organizationId: row.organization_id,
        actorId: row.actor_id,
        correlationId: row.correlation_id,
        sourceType: row.source_type,
        sourceId: row.source_terminal_id,
        kind: row.kind,
        outcome: row.outcome,
        observedValue: Number(row.observed_value),
        occurredAt: new Date(row.effective_at).toISOString(),
        idempotencyKey: `repair:${row.intent_id}`,
      });
      await params.beforeFinalize?.(row);
      const won = await withPgTransaction(async (tx) => {
        const u = await tx.query<any>(
          `UPDATE operational_alert_repair_intents SET status='COMPLETED',completed_at=now(),lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL WHERE intent_id=? AND status='PROCESSING' AND lease_owner=? AND lease_token=? AND fencing_version=? RETURNING intent_id`,
          [row.intent_id, params.workerId, row.lease_token, row.fencing_version]
        );
        if (!u.rows[0]) return false;
        await tx.query(
          `INSERT INTO operational_alert_repair_receipts(intent_id,organization_id,signal_id,fencing_version) VALUES(?,?,?,?) ON CONFLICT(intent_id) DO NOTHING`,
          [row.intent_id, row.organization_id, signal.signal_id, row.fencing_version]
        );
        await tx.query(
          `INSERT INTO operational_alert_repair_attempts(intent_id,organization_id,event_type,worker_id,lease_token,fencing_version) VALUES(?,?,?,?,?,?)`,
          [
            row.intent_id,
            row.organization_id,
            'SUCCEEDED',
            params.workerId,
            row.lease_token,
            row.fencing_version,
          ]
        );
        return true;
      });
      if (won) completed++;
      else {
        fenced++;
        await withPgTransaction((tx) =>
          tx.query(
            `INSERT INTO operational_alert_repair_attempts(intent_id,organization_id,event_type,worker_id,lease_token,fencing_version) VALUES(?,?,?,?,?,?)`,
            [
              row.intent_id,
              row.organization_id,
              'FENCED',
              params.workerId,
              row.lease_token,
              row.fencing_version,
            ]
          )
        );
      }
    } catch (error) {
      const state = await withPgTransaction(async (tx) => {
        const u = await tx.query<any>(
          `UPDATE operational_alert_repair_intents SET attempt_count=attempt_count+1,status=CASE WHEN attempt_count+1>=max_attempts THEN 'DEAD_LETTER' ELSE 'FAILED' END,available_at=now()+(LEAST(300000,1000*power(2,attempt_count))*interval '1 millisecond'),lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,last_error=? WHERE intent_id=? AND status='PROCESSING' AND lease_owner=? AND lease_token=? AND fencing_version=? RETURNING status`,
          [
            String(error).slice(0, 240),
            row.intent_id,
            params.workerId,
            row.lease_token,
            row.fencing_version,
          ]
        );
        if (!u.rows[0]) return null;
        await tx.query(
          `INSERT INTO operational_alert_repair_attempts(intent_id,organization_id,event_type,worker_id,lease_token,fencing_version,detail_json) VALUES(?,?,?,?,?,?,?::jsonb)`,
          [
            row.intent_id,
            row.organization_id,
            u.rows[0].status === 'DEAD_LETTER' ? 'DEAD_LETTERED' : 'FAILED',
            params.workerId,
            row.lease_token,
            row.fencing_version,
            JSON.stringify({ error: String(error).slice(0, 240) }),
          ]
        );
        return u.rows[0].status;
      });
      if (!state) fenced++;
      else {
        failed++;
        if (state === 'DEAD_LETTER') deadLettered++;
      }
    }
  return { claimed: rows.length, completed, failed, deadLettered, fenced };
}

export async function listOperationalAlertRepairStatus(organizationId?: string) {
  return withPgTransaction(
    async (tx) =>
      (
        await tx.query<any>(
          `SELECT intent_id,organization_id,source_type,source_terminal_id,outcome,status,attempt_count,max_attempts,last_error,completed_at FROM operational_alert_repair_intents ${organizationId ? 'WHERE organization_id=?' : ''} ORDER BY created_at DESC LIMIT 500`,
          organizationId ? [organizationId] : []
        )
      ).rows
  );
}
export async function redriveOperationalAlertRepairIntent(
  intentId: string,
  operatorActorId: string
) {
  if (!operatorActorId.trim()) throw new Error('OPS_ALERT_REPAIR_OPERATOR_REQUIRED');
  return withPgTransaction(async (tx) => {
    const row = (
      await tx.query<any>(
        `UPDATE operational_alert_repair_intents SET status='PENDING',attempt_count=0,available_at=now(),last_error=NULL,lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL WHERE intent_id=? AND status='DEAD_LETTER' RETURNING *`,
        [intentId]
      )
    ).rows[0];
    if (row)
      await tx.query(
        `INSERT INTO operational_alert_repair_attempts(intent_id,organization_id,event_type,worker_id,operator_actor_id,fencing_version) VALUES(?,?,'REDRIVEN','operator',?,?)`,
        [row.intent_id, row.organization_id, operatorActorId, row.fencing_version]
      );
    return row ?? null;
  });
}
