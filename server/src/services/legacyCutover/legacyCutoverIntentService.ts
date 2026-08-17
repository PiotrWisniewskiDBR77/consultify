import crypto from 'node:crypto';

import { withPgTransaction } from '../../utils/queryHelpers.js';
import type { RecordUsageInput } from './legacyCutoverKernel.js';

export type LegacyIntentTerminalResult =
  | 'passed'
  | 'rollback_passed'
  | 'refused_gone'
  | 'refused_identity_unmapped'
  | 'aborted_unknown';

export interface RegisteredLegacyIntent { intentId: string; fingerprint: string }

function fingerprint(input: RecordUsageInput): string {
  return crypto.createHash('sha256').update(JSON.stringify({
    domain: input.domain, writerId: input.writerId, organizationId: input.organizationId,
    userId: input.userId, method: input.method, routePath: input.routePath,
    accessKind: input.accessKind, legacyTable: input.legacyTable, legacyId: input.legacyId,
  })).digest('hex');
}

export async function registerLegacyCutoverIntent(
  input: RecordUsageInput,
  idempotencyKey: string | null
): Promise<RegisteredLegacyIntent> {
  const fp = fingerprint(input);
  return withPgTransaction(async (tx) => {
    if (input.requestId) {
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [
        `legacy-intent:${input.domain}:${input.organizationId || ''}:${input.requestId}`,
      ]);
      const prior = (await tx.query<any>(
        `SELECT intent_id,signal_fingerprint FROM legacy_cutover_signal_intents
          WHERE domain=? AND COALESCE(organization_id,'')=COALESCE(?,'') AND request_id=? FOR UPDATE`,
        [input.domain, input.organizationId, input.requestId]
      )).rows[0];
      if (prior) {
        if (prior.signal_fingerprint !== fp) throw new Error('LEGACY_CUTOVER_INTENT_COLLISION');
        return { intentId: prior.intent_id, fingerprint: fp };
      }
    }
    const row = (await tx.query<any>(
      `INSERT INTO legacy_cutover_signal_intents
       (domain,writer_id,organization_id,user_id,request_id,idempotency_key,signal_fingerprint,
        method,route_path,access_kind,successor_path,legacy_table,legacy_id,identity_status)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING intent_id`,
      [input.domain,input.writerId,input.organizationId,input.userId,input.requestId,idempotencyKey,fp,
       input.method,input.routePath,input.accessKind,input.successorPath,input.legacyTable,input.legacyId,
       input.identityStatus]
    )).rows[0];
    return { intentId: row.intent_id, fingerprint: fp };
  });
}

export async function completeLegacyCutoverIntent(input: {
  intentId: string; terminalStatus: number | null; terminalResult: LegacyIntentTerminalResult;
  source: 'finish' | 'close' | 'guard';
}): Promise<boolean> {
  return withPgTransaction(async (tx) => {
    const row = (await tx.query<any>(
      `UPDATE legacy_cutover_signal_intents SET status=?,terminal_status=?,terminal_result=?,
       completion_source=?,completed_at=now(),updated_at=now(),fencing_version=fencing_version+1
       WHERE intent_id=? AND status='REGISTERED' RETURNING intent_id`,
      [input.terminalResult === 'aborted_unknown' ? 'ABORTED_UNKNOWN' : 'COMPLETED',
       input.terminalStatus,input.terminalResult,input.source,input.intentId]
    )).rows[0];
    return Boolean(row);
  });
}

/** Conservatively closes abandoned intents. It never converts an unknown outcome to passed. */
export async function repairAbandonedLegacyCutoverIntents(
  olderThanSeconds = 60,
  limit = 100
): Promise<number> {
  return withPgTransaction(async (tx) => {
    const rows = (await tx.query<any>(
      `WITH candidates AS (
         SELECT intent_id FROM legacy_cutover_signal_intents
          WHERE status='REGISTERED' AND created_at < now()-(?*interval '1 second')
          ORDER BY created_at,intent_id FOR UPDATE SKIP LOCKED LIMIT ?
       ) UPDATE legacy_cutover_signal_intents i SET status='ABORTED_UNKNOWN',
          terminal_result='aborted_unknown',completion_source='repair',completed_at=now(),
          updated_at=now(),fencing_version=fencing_version+1
         FROM candidates c WHERE i.intent_id=c.intent_id AND i.status='REGISTERED'
       RETURNING i.intent_id`,
      [olderThanSeconds, limit]
    )).rows;
    return rows.length;
  });
}
