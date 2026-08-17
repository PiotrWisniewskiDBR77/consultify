import logger from '../utils/Logger.js';
import { withPgTransaction } from '../utils/queryHelpers.js';

const SUPPORTED_PAYLOAD_VERSION = 1;
const STALE_LEASE_MINUTES = 5;

type EventRow = {
  id: string;
  organization_id: string;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: number;
  event_type: string;
  correlation_id: string;
  causation_id: string;
  payload_version: number;
  payload_json: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
};

export type InitiativeExecutionOutboxOutcome = {
  eventId: string;
  receiptId: string | null;
  status: 'DELIVERED' | 'RETRY' | 'DEAD_LETTER';
  replay: boolean;
};

/**
 * Neutral owner-free consumer for the material-command outbox. It records the
 * exact immutable envelope; mapping an event to another product aggregate is
 * deliberately outside this adapter and cannot be invented here.
 */
export async function consumeNextInitiativeExecutionEvent(
  input: { organizationId?: string; __testForceFailure?: Error } = {}
): Promise<InitiativeExecutionOutboxOutcome | null> {
  return withPgTransaction(async (tx) => {
    const claimed = await tx.query<EventRow>(
      `WITH candidate AS (
         SELECT id FROM ie_outbox_events
          WHERE processed_at IS NULL AND dead_lettered_at IS NULL
            AND (?::text IS NULL OR organization_id = ?)
            AND available_at <= now()
            AND (processing_started_at IS NULL
              OR processing_started_at < now() - (? * interval '1 minute'))
          ORDER BY available_at,id
          FOR UPDATE SKIP LOCKED LIMIT 1
       )
       UPDATE ie_outbox_events e
          SET processing_started_at=now(),attempt_count=attempt_count+1,last_error=NULL
         FROM candidate c WHERE e.id=c.id
       RETURNING e.id::text,e.organization_id,e.aggregate_type,e.aggregate_id,
                 e.aggregate_version,e.event_type,e.correlation_id,e.causation_id,
                 e.payload_version,e.payload_json,e.attempt_count,e.max_attempts`,
      [input.organizationId ?? null, input.organizationId ?? null, STALE_LEASE_MINUTES]
    );
    const event = claimed.rows[0];
    if (!event) return null;

    if (event.payload_version !== SUPPORTED_PAYLOAD_VERSION) {
      await tx.query(
        `UPDATE ie_outbox_events SET dead_lettered_at=now(),processing_started_at=NULL,
           last_error=? WHERE id=? AND organization_id=?`,
        [`unsupported_ie_outbox_payload_version:${event.payload_version}`, event.id, event.organization_id]
      );
      return { eventId: event.id, receiptId: null, status: 'DEAD_LETTER', replay: false };
    }

    try {
      if (input.__testForceFailure) throw input.__testForceFailure;
      const inserted = await tx.query<{ receipt_id: string }>(
        `INSERT INTO ie_outbox_delivery_receipts
          (organization_id,source_event_id,aggregate_type,aggregate_id,aggregate_version,
           event_type,payload_version,payload_json,correlation_id,causation_id)
         VALUES (?,?,?,?,?,?,?,?::jsonb,?,?)
         ON CONFLICT (organization_id,source_event_id) DO NOTHING RETURNING receipt_id`,
        [event.organization_id,event.id,event.aggregate_type,event.aggregate_id,event.aggregate_version,
         event.event_type,event.payload_version,JSON.stringify(event.payload_json),event.correlation_id,event.causation_id]
      );
      const existing = inserted.rows[0] ? null : await tx.query<{ receipt_id: string }>(
        `SELECT receipt_id FROM ie_outbox_delivery_receipts
          WHERE organization_id=? AND source_event_id=?`, [event.organization_id,event.id]
      );
      const receiptId=inserted.rows[0]?.receipt_id ?? existing?.rows[0]?.receipt_id;
      if (!receiptId) throw new Error('ie_outbox_receipt_missing_after_upsert');
      await tx.query(
        `UPDATE ie_outbox_events SET processed_at=COALESCE(processed_at,now()),
          processing_started_at=NULL,last_error=NULL WHERE id=? AND organization_id=?`,
        [event.id,event.organization_id]
      );
      return {eventId:event.id,receiptId,status:'DELIVERED',replay:!inserted.rows[0]};
    } catch (error) {
      const message=error instanceof Error ? error.message : String(error);
      const deadLetter=Number(event.attempt_count) >= Number(event.max_attempts);
      await tx.query(
        `UPDATE ie_outbox_events SET processing_started_at=NULL,last_error=?,
          dead_lettered_at=CASE WHEN ? THEN now() ELSE NULL END,
          available_at=CASE WHEN ? THEN available_at ELSE now()+interval '30 seconds' END
          WHERE id=? AND organization_id=?`,
        [message,deadLetter,deadLetter,event.id,event.organization_id]
      );
      return {eventId:event.id,receiptId:null,status:deadLetter?'DEAD_LETTER':'RETRY',replay:false};
    }
  });
}

export async function redriveInitiativeExecutionDeadLetter(
  organizationId: string,eventId: string
): Promise<boolean> {
  return withPgTransaction(async (tx) => {
    const result=await tx.query(
      `UPDATE ie_outbox_events SET dead_lettered_at=NULL,processing_started_at=NULL,
        attempt_count=0,last_error=NULL,available_at=now()
       WHERE id=? AND organization_id=? AND dead_lettered_at IS NOT NULL`,
      [eventId,organizationId]
    );
    return result.rowCount === 1;
  });
}

export async function drainInitiativeExecutionOutbox(batchSize=50):Promise<number>{
  let delivered=0;
  for(let i=0;i<Math.max(0,Math.min(batchSize,500));i+=1){
    const result=await consumeNextInitiativeExecutionEvent();
    if(!result) break;
    if(result.status==='DELIVERED') delivered+=1;
  }
  return delivered;
}

let cronHandle:ReturnType<typeof setInterval>|null=null;
export function startInitiativeExecutionOutboxConsumer(intervalMs=30_000):void{
  if(cronHandle) return;
  cronHandle=setInterval(()=>{void drainInitiativeExecutionOutbox().catch((error)=>
    logger.error(`[InitiativeExecutionOutbox] tick failed: ${error instanceof Error?error.message:String(error)}`));},intervalMs);
  if(typeof cronHandle.unref==='function') cronHandle.unref();
}
export function stopInitiativeExecutionOutboxConsumer():void{
  if(cronHandle){clearInterval(cronHandle);cronHandle=null;}
}
