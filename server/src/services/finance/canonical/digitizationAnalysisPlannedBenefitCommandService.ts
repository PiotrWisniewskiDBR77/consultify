import { createHash, randomUUID } from 'node:crypto';

import { withPgTransaction } from '../../../utils/queryHelpers.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';

export class DigitizationAnalysisPlannedBenefitError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}
export interface PlannedBenefitResult {
  analysisId: string;
  benefitTrackingId: string;
  trackingPeriod: string;
  plannedBenefits: number;
  version: number;
  receiptId: string;
  replay: boolean;
}
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

export async function persistDigitizationAnalysisPlannedBenefit(input: {
  organizationId: string;
  userId: string;
  analysisId: string;
  idempotencyKey: string;
  expectedVersion: number;
  trackingPeriod: string;
  plannedBenefits: number;
}): Promise<PlannedBenefitResult> {
  const key = input.idempotencyKey.trim(),
    period = input.trackingPeriod.trim();
  if (!key || key.length > 200)
    throw new DigitizationAnalysisPlannedBenefitError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1)
    throw new DigitizationAnalysisPlannedBenefitError(
      'INVALID_EXPECTED_VERSION',
      400,
      'expectedVersion must be a positive integer'
    );
  if (!period || period.length > 100)
    throw new DigitizationAnalysisPlannedBenefitError(
      'INVALID_TRACKING_PERIOD',
      400,
      'trackingPeriod must be 1..100 characters'
    );
  if (!Number.isFinite(input.plannedBenefits) || input.plannedBenefits < 0)
    throw new DigitizationAnalysisPlannedBenefitError(
      'INVALID_PLANNED_BENEFITS',
      400,
      'plannedBenefits must be a non-negative finite number'
    );
  const requestSha256 = hash({
    expectedVersion: input.expectedVersion,
    trackingPeriod: period,
    plannedBenefits: input.plannedBenefits,
  });
  return withPgTransaction(async (tx) => {
    const member = (
      await tx.query<{ status: string; role: string }>(
        `SELECT status,role FROM organization_members WHERE organization_id=? AND user_id=? FOR UPDATE`,
        [input.organizationId, input.userId]
      )
    ).rows[0];
    if (String(member?.status || '').toUpperCase() !== 'ACTIVE')
      throw new DigitizationAnalysisPlannedBenefitError(
        'ORG_MEMBERSHIP_REVOKED',
        403,
        'Active organization membership is required'
      );
    if (!hasFinanceEditRole(member.role))
      throw new DigitizationAnalysisPlannedBenefitError(
        'FINANCE_EDIT_FORBIDDEN',
        403,
        'Finance edit role is required'
      );
    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${input.organizationId}:${input.analysisId}:PLANNED_BENEFIT`,
    ]);
    const prior = (
      await tx.query<{ request_sha256: string; response_json: PlannedBenefitResult }>(
        `SELECT request_sha256,response_json FROM finance_digitization_analysis_planned_benefit_command_receipts WHERE organization_id=? AND analysis_id=? AND idempotency_key=?`,
        [input.organizationId, input.analysisId, key]
      )
    ).rows[0];
    if (prior) {
      if (prior.request_sha256 !== requestSha256)
        throw new DigitizationAnalysisPlannedBenefitError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key is bound to another planned-benefit command'
        );
      return { ...prior.response_json, replay: true };
    }
    const analysis = (
      await tx.query<{
        command_version: number;
        initiative_id: string | null;
        archived_at: string | null;
      }>(
        `SELECT command_version,initiative_id,archived_at FROM digitization_analyses WHERE id=? AND organization_id=? FOR UPDATE`,
        [input.analysisId, input.organizationId]
      )
    ).rows[0];
    if (!analysis || analysis.archived_at)
      throw new DigitizationAnalysisPlannedBenefitError(
        'DIGITIZATION_ANALYSIS_NOT_FOUND',
        404,
        'Active digitization analysis not found'
      );
    if (!analysis.initiative_id)
      throw new DigitizationAnalysisPlannedBenefitError(
        'INITIATIVE_LINK_REQUIRED',
        409,
        'Analysis must be linked to an initiative'
      );
    if (Number(analysis.command_version) !== input.expectedVersion)
      throw new DigitizationAnalysisPlannedBenefitError(
        'DIGITIZATION_ANALYSIS_VERSION_CONFLICT',
        409,
        'Digitization analysis version changed',
        { currentVersion: Number(analysis.command_version) }
      );
    const existing = (
      await tx.query<{ id: string; actual_cost_savings: number | null }>(
        `SELECT id,actual_cost_savings FROM benefit_tracking WHERE organization_id=? AND initiative_id=? AND tracking_period=? FOR UPDATE`,
        [input.organizationId, analysis.initiative_id, period]
      )
    ).rows[0];
    const benefitTrackingId = existing?.id || randomUUID();
    const actual = Number(existing?.actual_cost_savings ?? 0);
    const variance =
      input.plannedBenefits > 0
        ? ((actual - input.plannedBenefits) / input.plannedBenefits) * 100
        : 0;
    if (existing)
      await tx.query(
        `UPDATE benefit_tracking SET planned_cost_savings=?,overall_variance_percent=?,updated_at=NOW() WHERE id=? AND organization_id=?`,
        [input.plannedBenefits, variance, benefitTrackingId, input.organizationId]
      );
    else
      await tx.query(
        `INSERT INTO benefit_tracking(id,financial_id,initiative_id,organization_id,period_start,period_end,tracking_period,planned_cost_savings,actual_cost_savings,overall_variance_percent,created_by,created_at,updated_at) VALUES(?,NULL,?,?,NOW(),NOW(),?,?,0,?,?,NOW(),NOW())`,
        [
          benefitTrackingId,
          analysis.initiative_id,
          input.organizationId,
          period,
          input.plannedBenefits,
          variance,
          input.userId,
        ]
      );
    const version = input.expectedVersion + 1;
    const updated = await tx.query(
      `UPDATE digitization_analyses SET command_version=?,updated_at=NOW() WHERE id=? AND organization_id=? AND command_version=? AND archived_at IS NULL`,
      [version, input.analysisId, input.organizationId, input.expectedVersion]
    );
    if (updated.rowCount !== 1)
      throw new DigitizationAnalysisPlannedBenefitError(
        'DIGITIZATION_ANALYSIS_VERSION_CONFLICT',
        409,
        'Digitization analysis changed before planned-benefit commit'
      );
    const result: PlannedBenefitResult = {
      analysisId: input.analysisId,
      benefitTrackingId,
      trackingPeriod: period,
      plannedBenefits: input.plannedBenefits,
      version,
      receiptId: randomUUID(),
      replay: false,
    };
    await tx.query(
      `INSERT INTO finance_digitization_analysis_planned_benefit_command_receipts(receipt_id,organization_id,analysis_id,benefit_tracking_id,tracking_period,planned_benefits,idempotency_key,request_sha256,expected_version,resulting_version,response_json,commanded_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        result.receiptId,
        input.organizationId,
        input.analysisId,
        benefitTrackingId,
        period,
        input.plannedBenefits,
        key,
        requestSha256,
        input.expectedVersion,
        version,
        JSON.stringify(result),
        input.userId,
      ]
    );
    return result;
  });
}
