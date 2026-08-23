import { createHash } from 'node:crypto';

import { withPgTransaction } from '../../../utils/queryHelpers.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';

export interface StatementPackArchiveResult {
  packId: string;
  status: 'archived';
  version: number;
  archivedBy: string;
  archivedAt: string;
  replay: boolean;
}

export class StatementPackArchiveCommandError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function archiveStatementPackCommand(params: {
  organizationId: string;
  userId: string;
  packId: string;
  expectedVersion: number;
  reason: string;
  idempotencyKey: string;
}): Promise<StatementPackArchiveResult> {
  const key = params.idempotencyKey.trim();
  const reason = params.reason.trim();
  if (!key || key.length > 200)
    throw new StatementPackArchiveCommandError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  if (!reason || reason.length > 500)
    throw new StatementPackArchiveCommandError(
      'INVALID_REASON',
      400,
      'reason must be 1..500 characters'
    );
  if (!Number.isInteger(params.expectedVersion) || params.expectedVersion < 1)
    throw new StatementPackArchiveCommandError(
      'INVALID_EXPECTED_VERSION',
      400,
      'expectedVersion must be a positive integer'
    );

  const requestSha256 = hash({
    packId: params.packId,
    expectedVersion: params.expectedVersion,
    reason,
  });
  return withPgTransaction(async (tx) => {
    const membership = (
      await tx.query<{ status: string; role: string }>(
        `SELECT status,role FROM organization_members WHERE organization_id=? AND user_id=? FOR UPDATE`,
        [params.organizationId, params.userId]
      )
    ).rows[0];
    if (String(membership?.status || '').toUpperCase() !== 'ACTIVE')
      throw new StatementPackArchiveCommandError(
        'ORG_MEMBERSHIP_REVOKED',
        403,
        'Active organization membership is required'
      );
    if (!hasFinanceEditRole(membership.role))
      throw new StatementPackArchiveCommandError(
        'FINANCE_EDIT_FORBIDDEN',
        403,
        'Finance edit role is required'
      );

    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${params.organizationId}:${params.packId}:STATEMENT_PACK_ARCHIVE`,
    ]);
    const pack = (
      await tx.query<{ pack_status: string; version: number }>(
        `SELECT pack_status,version FROM financial_statement_packs WHERE id=? AND organization_id=? FOR UPDATE`,
        [params.packId, params.organizationId]
      )
    ).rows[0];
    if (!pack)
      throw new StatementPackArchiveCommandError('PACK_NOT_FOUND', 404, 'Statement pack not found');

    const prior = (
      await tx.query<{ request_sha256: string; response_json: StatementPackArchiveResult }>(
        `SELECT request_sha256,response_json FROM finance_statement_pack_archive_command_receipts WHERE organization_id=? AND pack_id=? AND idempotency_key=?`,
        [params.organizationId, params.packId, key]
      )
    ).rows[0];
    if (prior) {
      if (prior.request_sha256 !== requestSha256)
        throw new StatementPackArchiveCommandError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key is bound to another archive command'
        );
      return { ...prior.response_json, replay: true };
    }
    if (pack.pack_status === 'archived')
      throw new StatementPackArchiveCommandError(
        'PACK_ARCHIVED',
        409,
        'Statement pack is archived'
      );
    if (pack.pack_status === 'confirmed')
      throw new StatementPackArchiveCommandError(
        'CONFIRMED_PACK_ARCHIVE_FORBIDDEN',
        409,
        'Confirmed statement pack cannot be archived'
      );
    if (Number(pack.version) !== params.expectedVersion)
      throw new StatementPackArchiveCommandError(
        'PACK_VERSION_CONFLICT',
        409,
        'Pack version changed',
        {
          currentVersion: Number(pack.version),
        }
      );

    const archivedAt = new Date().toISOString();
    const archivedVersion = params.expectedVersion + 1;
    const result: StatementPackArchiveResult = {
      packId: params.packId,
      status: 'archived',
      version: archivedVersion,
      archivedBy: params.userId,
      archivedAt,
      replay: false,
    };
    const updated = await tx.query(
      `UPDATE financial_statement_packs SET pack_status='archived',version=?,updated_at=? WHERE id=? AND organization_id=? AND version=? AND pack_status<>'archived'`,
      [archivedVersion, archivedAt, params.packId, params.organizationId, params.expectedVersion]
    );
    if (updated.rowCount !== 1)
      throw new StatementPackArchiveCommandError(
        'PACK_VERSION_CONFLICT',
        409,
        'Pack changed before archive'
      );
    await tx.query(
      `INSERT INTO finance_statement_pack_archive_command_receipts(organization_id,pack_id,idempotency_key,request_sha256,expected_version,archived_version,reason,response_json,archived_by,archived_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [
        params.organizationId,
        params.packId,
        key,
        requestSha256,
        params.expectedVersion,
        archivedVersion,
        reason,
        JSON.stringify(result),
        params.userId,
        archivedAt,
      ]
    );
    return result;
  });
}
