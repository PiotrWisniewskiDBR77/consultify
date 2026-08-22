import { createHash } from 'node:crypto';

import { withPgTransaction } from '../../../utils/queryHelpers.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';

export interface ArchiveDigitizationAnalysisParams {
  organizationId: string;
  userId: string;
  analysisId: string;
  expectedVersion: number;
  idempotencyKey: string;
  reason: string;
}

export interface DigitizationAnalysisArchiveResult {
  analysisId: string;
  status: 'ARCHIVED';
  version: number;
  archivedBy: string;
  archivedAt: string;
  replay: boolean;
}

export class DigitizationAnalysisArchiveError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

let faultInjector: null | (() => void | Promise<void>) = null;
export function setDigitizationAnalysisArchiveFaultInjectorForTests(
  injector: null | (() => void | Promise<void>)
): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test fault injector is test-only');
  faultInjector = injector;
}

export async function archiveDigitizationAnalysisCommand(
  params: ArchiveDigitizationAnalysisParams
): Promise<DigitizationAnalysisArchiveResult> {
  const idempotencyKey = params.idempotencyKey.trim();
  const reason = params.reason.trim();
  if (!idempotencyKey || idempotencyKey.length > 200) {
    throw new DigitizationAnalysisArchiveError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  }
  if (!reason || reason.length > 500) {
    throw new DigitizationAnalysisArchiveError(
      'INVALID_REASON',
      400,
      'reason must be 1..500 characters'
    );
  }
  if (!Number.isInteger(params.expectedVersion) || params.expectedVersion < 1) {
    throw new DigitizationAnalysisArchiveError(
      'INVALID_EXPECTED_VERSION',
      400,
      'expectedVersion must be a positive integer'
    );
  }

  const requestSha256 = sha256({
    analysisId: params.analysisId,
    expectedVersion: params.expectedVersion,
    reason,
  });

  return withPgTransaction(async (tx) => {
    const membership = (
      await tx.query<{ status: string; role: string }>(
        `SELECT status, role FROM organization_members
         WHERE organization_id=? AND user_id=? FOR UPDATE`,
        [params.organizationId, params.userId]
      )
    ).rows[0];
    if (String(membership?.status || '').toUpperCase() !== 'ACTIVE') {
      throw new DigitizationAnalysisArchiveError(
        'ORG_MEMBERSHIP_REVOKED',
        403,
        'Active organization membership is required'
      );
    }
    if (!hasFinanceEditRole(membership.role)) {
      throw new DigitizationAnalysisArchiveError(
        'FINANCE_EDIT_FORBIDDEN',
        403,
        'Finance edit role is required'
      );
    }

    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${params.organizationId}:${params.analysisId}:DIGITIZATION_ANALYSIS_ARCHIVE`,
    ]);

    const prior = (
      await tx.query<{ request_sha256: string; response_json: DigitizationAnalysisArchiveResult }>(
        `SELECT request_sha256, response_json
         FROM finance_digitization_analysis_archive_receipts
         WHERE organization_id=? AND analysis_id=? AND idempotency_key=?`,
        [params.organizationId, params.analysisId, idempotencyKey]
      )
    ).rows[0];
    if (prior) {
      if (prior.request_sha256 !== requestSha256) {
        throw new DigitizationAnalysisArchiveError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key is bound to another archive command'
        );
      }
      return { ...prior.response_json, replay: true };
    }

    const analysis = (
      await tx.query<{ archive_version: number; archived_at: string | null }>(
        `SELECT archive_version, archived_at FROM digitization_analyses
         WHERE id=? AND organization_id=? FOR UPDATE`,
        [params.analysisId, params.organizationId]
      )
    ).rows[0];
    if (!analysis) {
      throw new DigitizationAnalysisArchiveError(
        'DIGITIZATION_ANALYSIS_NOT_FOUND',
        404,
        'Digitization analysis not found'
      );
    }
    if (analysis.archived_at) {
      throw new DigitizationAnalysisArchiveError(
        'DIGITIZATION_ANALYSIS_ALREADY_ARCHIVED',
        409,
        'Digitization analysis is already archived'
      );
    }
    if (Number(analysis.archive_version) !== params.expectedVersion) {
      throw new DigitizationAnalysisArchiveError(
        'DIGITIZATION_ANALYSIS_VERSION_CONFLICT',
        409,
        'Digitization analysis version changed',
        { currentVersion: Number(analysis.archive_version) }
      );
    }

    const archivedAt = new Date().toISOString();
    const archivedVersion = params.expectedVersion + 1;
    const result: DigitizationAnalysisArchiveResult = {
      analysisId: params.analysisId,
      status: 'ARCHIVED',
      version: archivedVersion,
      archivedBy: params.userId,
      archivedAt,
      replay: false,
    };
    const updated = await tx.query(
      `UPDATE digitization_analyses
       SET archived_at=?, archived_by=?, archive_version=?, updated_at=?
       WHERE id=? AND organization_id=? AND archived_at IS NULL AND archive_version=?`,
      [
        archivedAt,
        params.userId,
        archivedVersion,
        archivedAt,
        params.analysisId,
        params.organizationId,
        params.expectedVersion,
      ]
    );
    if (updated.rowCount !== 1) {
      throw new DigitizationAnalysisArchiveError(
        'DIGITIZATION_ANALYSIS_VERSION_CONFLICT',
        409,
        'Digitization analysis changed before archive'
      );
    }
    await faultInjector?.();
    await tx.query(
      `INSERT INTO finance_digitization_analysis_archive_receipts
       (organization_id,analysis_id,idempotency_key,request_sha256,expected_version,
        archived_version,reason,response_json,archived_by,archived_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        params.organizationId,
        params.analysisId,
        idempotencyKey,
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
