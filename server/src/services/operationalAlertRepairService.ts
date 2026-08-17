import crypto from 'node:crypto';
import { withPgTransaction } from '../utils/queryHelpers.js';
import { durableOperationalAlertsEnabled, recordOperationalAlertSignal, type SignalOutcome } from './operationalAlertSignalDeliveryService.js';
import type { OperationalAlertKind } from './operationalAlertService.js';

export interface AlertRepairIntentInput { organizationId:string; actorId:string; correlationId:string; sourceType:string; sourceTerminalId:string; kind:OperationalAlertKind; outcome:SignalOutcome; observedValue?:number }
const digest = (v:unknown) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');

export async function enqueueOperationalAlertRepairIntent(input: AlertRepairIntentInput) {
  const fingerprint = digest(input);
  return withPgTransaction(async tx => {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [`ops-repair:${input.organizationId}:${input.sourceType}:${input.sourceTerminalId}:${input.outcome}`]);
    const old = await tx.query<any>(`SELECT * FROM operational_alert_repair_intents WHERE organization_id=? AND source_type=? AND source_terminal_id=? AND outcome=?`, [input.organizationId,input.sourceType,input.sourceTerminalId,input.outcome]);
    if (old.rows[0]) { if (old.rows[0].input_fingerprint !== fingerprint) throw new Error('OPS_ALERT_REPAIR_COLLISION'); return old.rows[0]; }
    return (await tx.query<any>(`INSERT INTO operational_alert_repair_intents(organization_id,actor_id,correlation_id,source_type,source_terminal_id,kind,outcome,observed_value,input_fingerprint) VALUES(?,?,?,?,?,?,?,?,?) RETURNING *`, [input.organizationId,input.actorId,input.correlationId,input.sourceType,input.sourceTerminalId,input.kind,input.outcome,input.observedValue??1,fingerprint])).rows[0];
  });
}

export async function reconstructTerminalOperationalAlertIntents(): Promise<number> {
  if (!durableOperationalAlertsEnabled()) return 0;
  return withPgTransaction(async tx => {
    const inserted = await tx.query<any>(`WITH candidates AS (
      SELECT e.organization_id,e.actor_user_id AS actor_id,e.event_id::text correlation_id,'rvn_platform_outbox' source_type,o.outbox_id::text source_terminal_id,
        CASE WHEN o.status='dispatched' THEN 'SUCCESS' ELSE 'FAILURE' END outcome
      FROM rvn_platform_outbox o JOIN rvn_platform_events e ON e.event_id=o.event_id WHERE o.status IN ('dispatched','dead_letter')
      UNION ALL
      SELECT organization_id,user_id,id,'notification_outbox',id,CASE WHEN status='SENT' THEN 'SUCCESS' ELSE 'FAILURE' END FROM notification_outbox WHERE status IN ('SENT','FAILED')
      UNION ALL
      SELECT organization_id,'system:case-workspace-outbox',event_id,'case_workspace_event_outbox',event_id,CASE WHEN delivered_at IS NOT NULL THEN 'SUCCESS' ELSE 'FAILURE' END FROM case_workspace_event_outbox WHERE delivered_at IS NOT NULL OR delivery_attempt_count>=8
    ) INSERT INTO operational_alert_repair_intents(organization_id,actor_id,correlation_id,source_type,source_terminal_id,kind,outcome,input_fingerprint)
      SELECT organization_id,COALESCE(actor_id,'system'),correlation_id,source_type,source_terminal_id,'WRITE_FAILURE_RATE',outcome,
        encode(digest(concat_ws('|',organization_id,COALESCE(actor_id,'system'),correlation_id,source_type,source_terminal_id,outcome),'sha256'),'hex') FROM candidates
      ON CONFLICT(organization_id,source_type,source_terminal_id,outcome) DO NOTHING RETURNING intent_id`);
    return inserted.rows.length;
  });
}

export async function runOperationalAlertRepairTick(params:{workerId:string;limit?:number;leaseMs?:number}):Promise<{claimed:number;completed:number;failed:number;deadLettered:number}> {
  if (!durableOperationalAlertsEnabled() || process.env.OPERATIONAL_ALERT_REPAIR_ENABLED !== 'true') return {claimed:0,completed:0,failed:0,deadLettered:0};
  await reconstructTerminalOperationalAlertIntents();
  const rows = await withPgTransaction(async tx => (await tx.query<any>(`WITH c AS (SELECT intent_id FROM operational_alert_repair_intents WHERE ((status IN ('PENDING','FAILED') AND available_at<=now()) OR (status='PROCESSING' AND lease_expires_at<now())) AND attempt_count<max_attempts ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT ?) UPDATE operational_alert_repair_intents i SET status='PROCESSING',lease_owner=?,lease_expires_at=now()+(?*interval '1 millisecond') FROM c WHERE i.intent_id=c.intent_id RETURNING i.*`, [params.limit??50,params.workerId,params.leaseMs??30000])).rows);
  let completed=0,failed=0,deadLettered=0;
  for (const row of rows) {
    try {
      const signal = await recordOperationalAlertSignal({organizationId:row.organization_id,actorId:row.actor_id,correlationId:row.correlation_id,sourceType:row.source_type,sourceId:row.source_terminal_id,kind:row.kind,outcome:row.outcome,observedValue:Number(row.observed_value),idempotencyKey:`repair:${row.intent_id}`});
      await withPgTransaction(async tx => { await tx.query(`INSERT INTO operational_alert_repair_receipts(intent_id,organization_id,signal_id) VALUES(?,?,?) ON CONFLICT(intent_id) DO NOTHING`, [row.intent_id,row.organization_id,signal.signal_id]); await tx.query(`UPDATE operational_alert_repair_intents SET status='COMPLETED',completed_at=now(),lease_owner=NULL,lease_expires_at=NULL WHERE intent_id=?`,[row.intent_id]); }); completed++;
    } catch (error) {
      await withPgTransaction(async tx => { const updated=await tx.query<any>(`UPDATE operational_alert_repair_intents SET attempt_count=attempt_count+1,status=CASE WHEN attempt_count+1>=max_attempts THEN 'DEAD_LETTER' ELSE 'FAILED' END,available_at=now()+(LEAST(300000,1000*power(2,attempt_count))*interval '1 millisecond'),lease_owner=NULL,lease_expires_at=NULL,last_error=? WHERE intent_id=? RETURNING status`,[String(error).slice(0,240),row.intent_id]); if(updated.rows[0]?.status==='DEAD_LETTER') deadLettered++; }); failed++;
    }
  }
  return {claimed:rows.length,completed,failed,deadLettered};
}

export async function listOperationalAlertRepairStatus(organizationId?:string) { return withPgTransaction(async tx => (await tx.query<any>(`SELECT intent_id,organization_id,source_type,source_terminal_id,outcome,status,attempt_count,max_attempts,last_error,completed_at FROM operational_alert_repair_intents ${organizationId?'WHERE organization_id=?':''} ORDER BY created_at DESC LIMIT 500`,organizationId?[organizationId]:[])).rows); }

export async function redriveOperationalAlertRepairIntent(intentId:string) { return withPgTransaction(async tx => (await tx.query<any>(`UPDATE operational_alert_repair_intents SET status='PENDING',attempt_count=0,available_at=now(),last_error=NULL WHERE intent_id=? AND status='DEAD_LETTER' RETURNING *`,[intentId])).rows[0]??null); }
