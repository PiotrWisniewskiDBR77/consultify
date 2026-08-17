import { withPgTransaction } from '../../../utils/queryHelpers.js';

const SUPPORTED_PAYLOAD_VERSION = 1;
const STALE_LEASE_MINUTES = 5;

export type ExecutionSignalIngressOutcome = {
  signalId: string;
  receiptId: string;
  replay: boolean;
};

type ClaimedSignal = {
  signal_id: string;
  organization_id: string;
  execution_link_id: string;
  initiative_id: string;
  case_id: string;
  signal_type: string;
  payload_version: number;
  payload_json: Record<string, unknown>;
};

/**
 * Claims and records one immutable Results ingress observation. The receipt
 * and DELIVERED transition commit atomically, so a process crash can only
 * leave a reclaimable PROCESSING lease or no effect at all.
 */
export async function consumeNextExecutionSignal(
  input: {
    organizationId?: string;
    __testForceFailure?: Error;
  } = {}
): Promise<ExecutionSignalIngressOutcome | null> {
  return withPgTransaction(async (tx) => {
    const claimed = await tx.query<ClaimedSignal>(
      `WITH candidate AS (
         SELECT signal_id
           FROM execution_results_signal_outbox
          WHERE (?::text IS NULL OR organization_id = ?)
            AND attempt_count < max_attempts
            AND (delivery_status = 'PENDING'
              OR (delivery_status = 'FAILED'
                AND (claimed_at IS NULL OR claimed_at < now() - (? * interval '1 minute')))
              OR (delivery_status = 'PROCESSING'
                AND claimed_at < now() - (? * interval '1 minute')))
          ORDER BY created_at,signal_id
          FOR UPDATE SKIP LOCKED
          LIMIT 1
       )
       UPDATE execution_results_signal_outbox s
          SET delivery_status = 'PROCESSING',claimed_at = now(),
              attempt_count = attempt_count + 1,last_error = NULL
         FROM candidate c WHERE s.signal_id = c.signal_id
       RETURNING s.signal_id,s.organization_id,s.execution_link_id,s.initiative_id,
                 s.case_id,s.signal_type,s.payload_version,s.payload_json`,
      [
        input.organizationId ?? null,
        input.organizationId ?? null,
        STALE_LEASE_MINUTES,
        STALE_LEASE_MINUTES,
      ]
    );
    const signal = claimed.rows[0];
    if (!signal) return null;
    if (signal.payload_version !== SUPPORTED_PAYLOAD_VERSION) {
      await tx.query(
        `UPDATE execution_results_signal_outbox
            SET delivery_status='DEAD_LETTER',last_error=?,claimed_at=NULL,dead_lettered_at=now()
          WHERE signal_id=? AND organization_id=? AND delivery_status='PROCESSING'`,
        [
          `unsupported_execution_signal_payload_version:${signal.payload_version}`,
          signal.signal_id,
          signal.organization_id,
        ]
      );
      return null;
    }

    try {
      if (input.__testForceFailure) throw input.__testForceFailure;
      const inserted = await tx.query<{ receipt_id: string }>(
      `INSERT INTO rvn_execution_signal_receipts
         (organization_id,source_signal_id,source_execution_link_id,
          source_initiative_id,source_case_id,signal_type,payload_version,observation_payload)
       VALUES (?,?,?,?,?,?,?,?::jsonb)
       ON CONFLICT (organization_id,source_signal_id) DO NOTHING
       RETURNING receipt_id`,
      [
        signal.organization_id,
        signal.signal_id,
        signal.execution_link_id,
        signal.initiative_id,
        signal.case_id,
        signal.signal_type,
        signal.payload_version,
        JSON.stringify(signal.payload_json),
      ]
    );
      const existing = inserted.rows[0]
      ? null
      : await tx.query<{ receipt_id: string }>(
          `SELECT receipt_id FROM rvn_execution_signal_receipts
            WHERE organization_id = ? AND source_signal_id = ?`,
          [signal.organization_id, signal.signal_id]
        );
      const receiptId = inserted.rows[0]?.receipt_id ?? existing?.rows[0]?.receipt_id;
      if (!receiptId) throw new Error('execution_signal_receipt_missing_after_upsert');

      await tx.query(
      `UPDATE execution_results_signal_outbox
          SET delivery_status = 'DELIVERED',delivered_at = COALESCE(delivered_at,now()),
              claimed_at = NULL,last_error = NULL
        WHERE signal_id = ? AND organization_id = ? AND delivery_status = 'PROCESSING'`,
      [signal.signal_id, signal.organization_id]
    );
      return { signalId: signal.signal_id, receiptId, replay: !inserted.rows[0] };
    } catch (error) {
      const message=error instanceof Error?error.message:String(error);
      await tx.query(
        `UPDATE execution_results_signal_outbox
          SET delivery_status=CASE WHEN attempt_count>=max_attempts THEN 'DEAD_LETTER' ELSE 'FAILED' END,
              last_error=?,claimed_at=NULL,
              dead_lettered_at=CASE WHEN attempt_count>=max_attempts THEN now() ELSE dead_lettered_at END
         WHERE signal_id=? AND organization_id=? AND delivery_status='PROCESSING'`,
        [message,signal.signal_id,signal.organization_id]
      );
      return null;
    }
  });
}

export async function redriveExecutionSignalDeadLetter(
  organizationId:string,signalId:string
):Promise<boolean>{
  return withPgTransaction(async(tx)=>{
    const result=await tx.query(
      `UPDATE execution_results_signal_outbox SET delivery_status='PENDING',attempt_count=0,
        claimed_at=NULL,last_error=NULL,dead_lettered_at=NULL
       WHERE signal_id=? AND organization_id=? AND delivery_status='DEAD_LETTER'`,
      [signalId,organizationId]
    );
    return result.rowCount===1;
  });
}

export async function drainExecutionSignalIngress(batchSize = 50): Promise<number> {
  let delivered = 0;
  const boundedSize = Math.max(0, Math.min(batchSize, 500));
  while (delivered < boundedSize) {
    const outcome = await consumeNextExecutionSignal();
    if (!outcome) break;
    delivered += 1;
  }
  return delivered;
}
