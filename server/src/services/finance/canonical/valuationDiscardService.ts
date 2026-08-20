import { createHash } from 'node:crypto';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import { assertFinanceEditor } from './valuationLegacySuccessorService.js';

type Expected = {
  artifactId: string;
  businessVersionId: string;
  workingRevisionId: string;
  workingRevisionVersion: number;
};

const fail = (code: string, message: string) => Object.assign(new Error(message), { code });
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function response(row: any, replay: boolean) {
  return {
    legacyValuationId: row.legacy_valuation_id,
    artifactId: row.artifact_id,
    businessVersionId: row.business_version_id,
    workingRevisionId: row.working_revision_id,
    workingRevisionVersion: Number(row.working_revision_version),
    status: 'ARCHIVED' as const,
    replay,
  };
}

export async function discardCanonicalLegacyValuation(params: {
  organizationId: string;
  userId: string;
  legacyId: string;
  expected: Expected;
  idempotencyKey: string;
  reason: string;
}) {
  const key = params.idempotencyKey.trim();
  const reason = params.reason.trim();
  if (!key) throw fail('IDEMPOTENCY_KEY_REQUIRED', 'x-idempotency-key is required');
  if (!reason || reason.length > 500)
    throw fail('INVALID_REASON', 'reason must be 1..500 characters');
  const requestSha256 = hash({
    legacyValuationId: params.legacyId,
    expected: params.expected,
    reason,
  });
  return withPinnedPostgresTransaction(async (tx) => {
    await assertFinanceEditor(tx, params.organizationId, params.userId);
    await tx.queryOne(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${params.organizationId}:${params.legacyId}:VALUATION_DISCARD`,
    ]);
    const current = await tx.queryOne<any>(
      `SELECT v.id AS legacy_valuation_id,v.status,a.artifact_id,a.archived_at,
        bv.business_version_id,wr.working_revision_id,wr.version AS working_revision_version
       FROM valuations v
       JOIN finance_artifact_aliases aa ON aa.organization_id=v.organization_id
        AND aa.legacy_table='valuations' AND aa.legacy_id=v.id
       JOIN finance_artifacts a ON a.organization_id=aa.organization_id AND a.artifact_id=aa.artifact_id
       JOIN finance_business_versions bv ON bv.organization_id=aa.organization_id
        AND bv.business_version_id=aa.business_version_id AND bv.artifact_id=a.artifact_id
       JOIN finance_working_revisions wr ON wr.organization_id=aa.organization_id
        AND wr.working_revision_id=bv.source_working_revision_id AND wr.is_current=true
       WHERE v.organization_id=? AND v.id=? AND a.artifact_type='VALUATION_CASE'
        AND a.current_business_version_id=bv.business_version_id
       ORDER BY aa.created_at DESC LIMIT 1 FOR UPDATE OF v,a,bv,wr`,
      [params.organizationId, params.legacyId]
    );
    if (!current) throw fail('NOT_FOUND', 'Valuation not found');
    if (
      current.artifact_id !== params.expected.artifactId ||
      current.business_version_id !== params.expected.businessVersionId ||
      current.working_revision_id !== params.expected.workingRevisionId ||
      Number(current.working_revision_version) !== params.expected.workingRevisionVersion
    )
      throw fail('CANONICAL_IDENTITY_CAS_CONFLICT', 'Canonical valuation identity changed');
    const prior = await tx.queryOne<any>(
      `SELECT * FROM finance_valuation_discard_receipts
        WHERE organization_id=? AND idempotency_key=?`,
      [params.organizationId, key]
    );
    if (prior) {
      if (prior.request_sha256 !== requestSha256)
        throw fail('IDEMPOTENCY_KEY_REUSED', 'Discard key is bound to another command');
      return response(prior, true);
    }
    if (current.status === 'ARCHIVED')
      throw fail('VALUATION_ALREADY_ARCHIVED', 'Valuation was already archived');
    if (current.status === 'APPROVED')
      throw fail(
        'VALUATION_APPROVED_ARCHIVE_REQUIRED',
        'Approved valuation requires lifecycle archive'
      );
    if (!['DRAFT', 'REVIEW'].includes(current.status))
      throw fail('VALUATION_STATE_CONFLICT', 'Valuation cannot be discarded from this state');
    const result = response(current, false);
    const valuationUpdate = await tx.queryRun(
      `UPDATE valuations SET status='ARCHIVED',updated_at=now()
        WHERE organization_id=? AND id=? AND status=?`,
      [params.organizationId, params.legacyId, current.status]
    );
    if (valuationUpdate.changes !== 1)
      throw fail('VALUATION_STATE_CONFLICT', 'Valuation changed before discard');
    const artifactUpdate = await tx.queryRun(
      `UPDATE finance_artifacts SET archived_at=now(),archived_reason=?
        WHERE organization_id=? AND artifact_id=? AND archived_at IS NULL`,
      [reason, params.organizationId, current.artifact_id]
    );
    if (artifactUpdate.changes !== 1)
      throw fail('VALUATION_STATE_CONFLICT', 'Canonical artifact changed before discard');
    await tx.queryRun(
      `INSERT INTO finance_valuation_discard_receipts
        (organization_id,idempotency_key,request_sha256,legacy_valuation_id,artifact_id,
         business_version_id,working_revision_id,working_revision_version,prior_status,
         reason,response_json,created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?::jsonb,?)`,
      [
        params.organizationId,
        key,
        requestSha256,
        params.legacyId,
        current.artifact_id,
        current.business_version_id,
        current.working_revision_id,
        Number(current.working_revision_version),
        current.status,
        reason,
        JSON.stringify(result),
        params.userId,
      ]
    );
    return result;
  });
}
