import { createHash, randomUUID } from 'node:crypto';

import { withPgTransaction } from '../../../utils/queryHelpers.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';

export class DigitizationAnalysisInitiativeLinkError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export interface DigitizationAnalysisInitiativeLinkResult {
  analysisId: string;
  initiativeId: string;
  projectId: string | null;
  financialsId: string;
  version: number;
  receiptId: string;
  replay: boolean;
}

const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function linkDigitizationAnalysisInitiativeCommand(input: {
  organizationId: string;
  userId: string;
  analysisId: string;
  initiativeId: string;
  expectedVersion: number;
  idempotencyKey: string;
}): Promise<DigitizationAnalysisInitiativeLinkResult> {
  const key = input.idempotencyKey.trim();
  if (!key || key.length > 200) {
    throw new DigitizationAnalysisInitiativeLinkError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  }
  if (!input.analysisId || !input.initiativeId) {
    throw new DigitizationAnalysisInitiativeLinkError(
      'INVALID_LINK',
      400,
      'analysisId and initiativeId are required'
    );
  }
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new DigitizationAnalysisInitiativeLinkError(
      'INVALID_EXPECTED_VERSION',
      400,
      'expectedVersion must be a positive integer'
    );
  }
  const requestSha256 = sha256({
    initiativeId: input.initiativeId,
    expectedVersion: input.expectedVersion,
  });

  return withPgTransaction(async (tx) => {
    const membership = (
      await tx.query<{ status: string; role: string }>(
        `SELECT status,role FROM organization_members WHERE organization_id=? AND user_id=? FOR UPDATE`,
        [input.organizationId, input.userId]
      )
    ).rows[0];
    if (String(membership?.status || '').toUpperCase() !== 'ACTIVE') {
      throw new DigitizationAnalysisInitiativeLinkError(
        'ORG_MEMBERSHIP_REVOKED',
        403,
        'Active organization membership is required'
      );
    }
    if (!hasFinanceEditRole(membership.role)) {
      throw new DigitizationAnalysisInitiativeLinkError(
        'FINANCE_EDIT_FORBIDDEN',
        403,
        'Finance edit role is required'
      );
    }
    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${input.organizationId}:${input.analysisId}:DIGITIZATION_ANALYSIS_INITIATIVE_LINK`,
    ]);
    const prior = (
      await tx.query<{
        request_sha256: string;
        response_json: DigitizationAnalysisInitiativeLinkResult;
      }>(
        `SELECT request_sha256,response_json FROM finance_digitization_analysis_initiative_link_receipts
       WHERE organization_id=? AND analysis_id=? AND idempotency_key=?`,
        [input.organizationId, input.analysisId, key]
      )
    ).rows[0];
    if (prior) {
      if (prior.request_sha256 !== requestSha256) {
        throw new DigitizationAnalysisInitiativeLinkError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key is bound to another initiative link'
        );
      }
      return { ...prior.response_json, replay: true };
    }
    const analysis = (
      await tx.query<{ command_version: number; archived_at: string | null }>(
        `SELECT command_version,archived_at FROM digitization_analyses WHERE id=? AND organization_id=? FOR UPDATE`,
        [input.analysisId, input.organizationId]
      )
    ).rows[0];
    if (!analysis || analysis.archived_at) {
      throw new DigitizationAnalysisInitiativeLinkError(
        'DIGITIZATION_ANALYSIS_NOT_FOUND',
        404,
        'Active digitization analysis not found'
      );
    }
    if (Number(analysis.command_version) !== input.expectedVersion) {
      throw new DigitizationAnalysisInitiativeLinkError(
        'DIGITIZATION_ANALYSIS_VERSION_CONFLICT',
        409,
        'Digitization analysis version changed',
        { currentVersion: Number(analysis.command_version) }
      );
    }
    const initiative = (
      await tx.query<{ project_id: string | null }>(
        `SELECT project_id FROM initiatives WHERE id=? AND organization_id=?`,
        [input.initiativeId, input.organizationId]
      )
    ).rows[0];
    if (!initiative) {
      throw new DigitizationAnalysisInitiativeLinkError(
        'INITIATIVE_NOT_FOUND',
        404,
        'Initiative not found in tenant'
      );
    }
    const resultingVersion = input.expectedVersion + 1;
    const updated = await tx.query(
      `UPDATE digitization_analyses SET initiative_id=?,project_id=?,command_version=?,updated_at=NOW()
       WHERE id=? AND organization_id=? AND command_version=? AND archived_at IS NULL`,
      [
        input.initiativeId,
        initiative.project_id,
        resultingVersion,
        input.analysisId,
        input.organizationId,
        input.expectedVersion,
      ]
    );
    if (updated.rowCount !== 1) {
      throw new DigitizationAnalysisInitiativeLinkError(
        'DIGITIZATION_ANALYSIS_VERSION_CONFLICT',
        409,
        'Digitization analysis changed before link'
      );
    }
    const existingFinancials = (
      await tx.query<{ id: string }>(
        `SELECT id FROM analysis_financials WHERE analysis_id=? AND organization_id=? FOR UPDATE`,
        [input.analysisId, input.organizationId]
      )
    ).rows[0];
    const financialsId = existingFinancials?.id || randomUUID();
    if (existingFinancials) {
      await tx.query(
        `UPDATE analysis_financials SET initiative_id=?,updated_at=NOW() WHERE id=? AND organization_id=?`,
        [input.initiativeId, financialsId, input.organizationId]
      );
    } else {
      await tx.query(
        `INSERT INTO analysis_financials(id,analysis_id,initiative_id,organization_id,created_by,created_at,updated_at)
         VALUES(?,?,?,?,?,NOW(),NOW())`,
        [financialsId, input.analysisId, input.initiativeId, input.organizationId, input.userId]
      );
    }
    const result: DigitizationAnalysisInitiativeLinkResult = {
      analysisId: input.analysisId,
      initiativeId: input.initiativeId,
      projectId: initiative.project_id,
      financialsId,
      version: resultingVersion,
      receiptId: randomUUID(),
      replay: false,
    };
    await tx.query(
      `INSERT INTO finance_digitization_analysis_initiative_link_receipts
       (receipt_id,organization_id,analysis_id,initiative_id,idempotency_key,request_sha256,expected_version,resulting_version,response_json,linked_by)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [
        result.receiptId,
        input.organizationId,
        input.analysisId,
        input.initiativeId,
        key,
        requestSha256,
        input.expectedVersion,
        resultingVersion,
        JSON.stringify(result),
        input.userId,
      ]
    );
    return result;
  });
}
