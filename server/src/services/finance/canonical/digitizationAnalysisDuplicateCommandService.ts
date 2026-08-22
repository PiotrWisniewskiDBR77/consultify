import { createHash, randomUUID } from 'node:crypto';

import { withPgTransaction } from '../../../utils/queryHelpers.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';

export class DigitizationAnalysisDuplicateError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}
export interface DigitizationAnalysisDuplicateResult {
  sourceAnalysisId: string;
  analysisId: string;
  name: string;
  status: 'DRAFT';
  version: 1;
  axisScoreCount: number;
  financialsCopied: boolean;
  scenarioCount: number;
  receiptId: string;
  replay: boolean;
}
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

export async function duplicateDigitizationAnalysisCommand(input: {
  organizationId: string;
  userId: string;
  sourceAnalysisId: string;
  idempotencyKey: string;
  expectedSourceVersion: number;
  name?: string;
}): Promise<DigitizationAnalysisDuplicateResult> {
  const key = input.idempotencyKey.trim();
  if (!key || key.length > 200)
    throw new DigitizationAnalysisDuplicateError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  if (!Number.isInteger(input.expectedSourceVersion) || input.expectedSourceVersion < 1)
    throw new DigitizationAnalysisDuplicateError(
      'INVALID_EXPECTED_VERSION',
      400,
      'expectedSourceVersion must be a positive integer'
    );
  if (input.name !== undefined && (!input.name.trim() || input.name.trim().length > 300))
    throw new DigitizationAnalysisDuplicateError(
      'INVALID_NAME',
      400,
      'name must be 1..300 characters'
    );
  const normalizedName = input.name?.trim() || null,
    requestSha256 = hash({
      expectedSourceVersion: input.expectedSourceVersion,
      name: normalizedName,
    });
  return withPgTransaction(async (tx) => {
    const member = (
      await tx.query<{ status: string; role: string }>(
        `SELECT status,role FROM organization_members WHERE organization_id=? AND user_id=? FOR UPDATE`,
        [input.organizationId, input.userId]
      )
    ).rows[0];
    if (String(member?.status || '').toUpperCase() !== 'ACTIVE')
      throw new DigitizationAnalysisDuplicateError(
        'ORG_MEMBERSHIP_REVOKED',
        403,
        'Active organization membership is required'
      );
    if (!hasFinanceEditRole(member.role))
      throw new DigitizationAnalysisDuplicateError(
        'FINANCE_EDIT_FORBIDDEN',
        403,
        'Finance edit role is required'
      );
    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${input.organizationId}:${input.sourceAnalysisId}:DUPLICATE`,
    ]);
    const prior = (
      await tx.query<{
        request_sha256: string;
        response_json: DigitizationAnalysisDuplicateResult;
      }>(
        `SELECT request_sha256,response_json FROM finance_digitization_analysis_duplicate_command_receipts WHERE organization_id=? AND source_analysis_id=? AND idempotency_key=?`,
        [input.organizationId, input.sourceAnalysisId, key]
      )
    ).rows[0];
    if (prior) {
      if (prior.request_sha256 !== requestSha256)
        throw new DigitizationAnalysisDuplicateError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key is bound to another duplicate payload'
        );
      return { ...prior.response_json, replay: true };
    }
    const source = (
      await tx.query<any>(
        `SELECT * FROM digitization_analyses WHERE id=? AND organization_id=? AND archived_at IS NULL FOR UPDATE`,
        [input.sourceAnalysisId, input.organizationId]
      )
    ).rows[0];
    if (!source)
      throw new DigitizationAnalysisDuplicateError(
        'DIGITIZATION_ANALYSIS_NOT_FOUND',
        404,
        'Active source analysis not found'
      );
    if (Number(source.command_version) !== input.expectedSourceVersion)
      throw new DigitizationAnalysisDuplicateError(
        'DIGITIZATION_ANALYSIS_VERSION_CONFLICT',
        409,
        'Source analysis version changed',
        { currentVersion: Number(source.command_version) }
      );
    const analysisId = randomUUID(),
      name = normalizedName || `${source.name} (Copy)`;
    await tx.query(
      `INSERT INTO digitization_analyses(id,name,description,status,project_id,initiative_id,analysis_type,organization_id,created_by,overall_score,completion_percent,axis_scores,archive_version,command_version,created_at,updated_at) VALUES(?,?,?,'draft',?,NULL,?,?,?, ?,?,?,1,1,NOW(),NOW())`,
      [
        analysisId,
        name,
        source.description,
        source.project_id,
        source.analysis_type || 'financial',
        input.organizationId,
        input.userId,
        source.overall_score,
        source.completion_percent,
        source.axis_scores || '{}',
      ]
    );
    const scores = await tx.query<any>(
      `SELECT axis_id,area_id,area_code,current_level,target_level,notes,evidence,justification FROM digitization_axis_scores WHERE analysis_id=? ORDER BY axis_id,area_id`,
      [input.sourceAnalysisId]
    );
    for (const score of scores.rows)
      await tx.query(
        `INSERT INTO digitization_axis_scores(id,analysis_id,axis_id,area_id,area_code,current_level,target_level,notes,evidence,justification,assessed_by,assessed_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
        [
          randomUUID(),
          analysisId,
          score.axis_id,
          score.area_id,
          score.area_code,
          score.current_level,
          score.target_level,
          score.notes,
          score.evidence,
          score.justification,
          input.userId,
        ]
      );
    const financial = (
      await tx.query<any>(
        `SELECT * FROM analysis_financials WHERE analysis_id=? AND organization_id=?`,
        [input.sourceAnalysisId, input.organizationId]
      )
    ).rows[0];
    let financialsCopied = false;
    if (financial) {
      financialsCopied = true;
      await tx.query(
        `INSERT INTO analysis_financials(id,analysis_id,initiative_id,organization_id,initial_investment,implementation_cost,annual_operating_cost,training_cost,contingency_percent,annual_cost_savings,annual_revenue_increase,productivity_gains_percent,risk_reduction_value,implementation_months,benefit_realization_months,analysis_horizon_years,discount_rate,npv,irr,payback_months,roi_percent,currency,assumptions,cash_flow_projections,created_by,created_at,updated_at,last_calculated_at) VALUES(?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW(),?)`,
        [
          randomUUID(),
          analysisId,
          input.organizationId,
          financial.initial_investment,
          financial.implementation_cost,
          financial.annual_operating_cost,
          financial.training_cost,
          financial.contingency_percent,
          financial.annual_cost_savings,
          financial.annual_revenue_increase,
          financial.productivity_gains_percent,
          financial.risk_reduction_value,
          financial.implementation_months,
          financial.benefit_realization_months,
          financial.analysis_horizon_years,
          financial.discount_rate,
          financial.npv,
          financial.irr,
          financial.payback_months,
          financial.roi_percent,
          financial.currency,
          financial.assumptions,
          financial.cash_flow_projections,
          input.userId,
          financial.last_calculated_at,
        ]
      );
    }
    const scenarios = await tx.query<any>(
      `SELECT scenario_type,name,assumptions,financial_data,metrics,is_active FROM analysis_financial_scenarios WHERE analysis_id=? AND organization_id=? ORDER BY scenario_type`,
      [input.sourceAnalysisId, input.organizationId]
    );
    for (const scenario of scenarios.rows)
      await tx.query(
        `INSERT INTO analysis_financial_scenarios(id,analysis_id,organization_id,scenario_type,name,assumptions,financial_data,metrics,is_active,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
        [
          randomUUID(),
          analysisId,
          input.organizationId,
          scenario.scenario_type,
          scenario.name,
          scenario.assumptions,
          scenario.financial_data,
          scenario.metrics,
          scenario.is_active,
          input.userId,
        ]
      );
    const result: DigitizationAnalysisDuplicateResult = {
      sourceAnalysisId: input.sourceAnalysisId,
      analysisId,
      name,
      status: 'DRAFT',
      version: 1,
      axisScoreCount: scores.rowCount,
      financialsCopied,
      scenarioCount: scenarios.rowCount,
      receiptId: randomUUID(),
      replay: false,
    };
    await tx.query(
      `INSERT INTO finance_digitization_analysis_duplicate_command_receipts(receipt_id,organization_id,source_analysis_id,duplicate_analysis_id,idempotency_key,request_sha256,source_version,response_json,commanded_by) VALUES(?,?,?,?,?,?,?,?,?)`,
      [
        result.receiptId,
        input.organizationId,
        input.sourceAnalysisId,
        analysisId,
        key,
        requestSha256,
        input.expectedSourceVersion,
        JSON.stringify(result),
        input.userId,
      ]
    );
    return result;
  });
}
