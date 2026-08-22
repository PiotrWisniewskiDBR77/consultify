import { createHash, randomUUID } from 'node:crypto';

import { withPgTransaction } from '../../../utils/queryHelpers.js';
import {
  applyScenarioAdjustments,
  calculateFinancialMetrics,
  normalizeFinancialData,
  validateFinancialData,
} from '../../economicsFinancials.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';

export class DigitizationAnalysisFinancialsError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export interface DigitizationAnalysisFinancialsResult {
  analysisId: string;
  financialsId: string;
  version: number;
  metrics: ReturnType<typeof calculateFinancialMetrics>;
  warnings: string[];
  recommendations: string[];
  scenarioRecommendation: { scenarioType: string; reason: string } | null;
  receiptId: string;
  replay: boolean;
}

const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function normalizeBody(raw: unknown): {
  expectedVersion: number;
  financialData: ReturnType<typeof normalizeFinancialData>;
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new DigitizationAnalysisFinancialsError(
      'INVALID_FINANCIALS',
      400,
      'Financials body must be an object'
    );
  }
  const body = raw as Record<string, any>;
  const allowed = new Set([
    'expectedVersion',
    'financialData',
    'costs',
    'benefits',
    'discountRate',
    'investmentHorizon',
  ]);
  if (Object.keys(body).some((field) => !allowed.has(field))) {
    throw new DigitizationAnalysisFinancialsError(
      'INVALID_FINANCIALS',
      400,
      'Unknown financials field'
    );
  }
  const expectedVersion = Number(body.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new DigitizationAnalysisFinancialsError(
      'INVALID_EXPECTED_VERSION',
      400,
      'expectedVersion must be a positive integer'
    );
  }
  if (
    body.financialData !== undefined &&
    (!body.financialData ||
      typeof body.financialData !== 'object' ||
      Array.isArray(body.financialData))
  ) {
    throw new DigitizationAnalysisFinancialsError(
      'INVALID_FINANCIALS',
      400,
      'financialData must be an object'
    );
  }
  if (body.costs !== undefined && !Array.isArray(body.costs))
    throw new DigitizationAnalysisFinancialsError(
      'INVALID_FINANCIALS',
      400,
      'costs must be an array'
    );
  if (body.benefits !== undefined && !Array.isArray(body.benefits))
    throw new DigitizationAnalysisFinancialsError(
      'INVALID_FINANCIALS',
      400,
      'benefits must be an array'
    );

  let financialData = normalizeFinancialData(body.financialData || {});
  if (!body.financialData) {
    const costs = body.costs || [];
    const benefits = body.benefits || [];
    const findCost = (pattern: RegExp, fallbackYear?: number) =>
      costs.find((item: any) => pattern.test(String(item?.description || ''))) ||
      (fallbackYear === undefined
        ? undefined
        : costs.find((item: any) => item?.year === fallbackYear));
    const initial = findCost(/inwestycja|capex|initial/i, 0);
    const implementation = findCost(/wdroż|implement/i);
    const training = findCost(/szkol|training/i);
    const operating = findCost(/opex|operac|operating/i, 1);
    const savings = benefits.find((item: any) =>
      /oszcz|savings/i.test(String(item?.description || ''))
    );
    const revenue = benefits.find((item: any) =>
      /przych|revenue/i.test(String(item?.description || ''))
    );
    financialData = {
      ...financialData,
      initialInvestment: initial?.amount ?? financialData.initialInvestment,
      implementationCost: implementation?.amount ?? financialData.implementationCost,
      trainingCost: training?.amount ?? financialData.trainingCost,
      annualOperatingCost: operating?.amount ?? financialData.annualOperatingCost,
      annualCostSavings: savings?.amount ?? financialData.annualCostSavings,
      annualRevenueIncrease: revenue?.amount ?? financialData.annualRevenueIncrease,
      discountRate: body.discountRate ?? financialData.discountRate,
      analysisHorizonYears: body.investmentHorizon ?? financialData.analysisHorizonYears,
    };
  }
  return { expectedVersion, financialData };
}

export async function persistDigitizationAnalysisFinancialsCommand(input: {
  organizationId: string;
  userId: string;
  analysisId: string;
  idempotencyKey: string;
  body: unknown;
}): Promise<DigitizationAnalysisFinancialsResult> {
  const key = input.idempotencyKey.trim();
  if (!key || key.length > 200)
    throw new DigitizationAnalysisFinancialsError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  const normalized = normalizeBody(input.body);
  const insights = validateFinancialData(normalized.financialData);
  if (insights.errors.length) {
    throw new DigitizationAnalysisFinancialsError(
      'INVALID_FINANCIAL_DATA',
      400,
      'Invalid financial data',
      { errors: insights.errors, warnings: insights.warnings }
    );
  }
  const metrics = calculateFinancialMetrics(normalized.financialData);
  const warnings = [...insights.warnings];
  if (metrics.paybackPeriod === null)
    warnings.push('Payback period not achieved within analysis horizon.');
  if (metrics.cashFlows.some((flow) => flow.year > 0 && flow.netCashFlow < 0))
    warnings.push('Negative net cashflow detected after year 0.');
  const requestSha256 = sha256({
    expectedVersion: normalized.expectedVersion,
    financialData: normalized.financialData,
  });

  return withPgTransaction(async (tx) => {
    const membership = (
      await tx.query<{ status: string; role: string }>(
        `SELECT status,role FROM organization_members WHERE organization_id=? AND user_id=? FOR UPDATE`,
        [input.organizationId, input.userId]
      )
    ).rows[0];
    if (String(membership?.status || '').toUpperCase() !== 'ACTIVE')
      throw new DigitizationAnalysisFinancialsError(
        'ORG_MEMBERSHIP_REVOKED',
        403,
        'Active organization membership is required'
      );
    if (!hasFinanceEditRole(membership.role))
      throw new DigitizationAnalysisFinancialsError(
        'FINANCE_EDIT_FORBIDDEN',
        403,
        'Finance edit role is required'
      );
    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${input.organizationId}:${input.analysisId}:DIGITIZATION_ANALYSIS_FINANCIALS`,
    ]);
    const prior = (
      await tx.query<{
        request_sha256: string;
        response_json: DigitizationAnalysisFinancialsResult;
      }>(
        `SELECT request_sha256,response_json FROM finance_digitization_analysis_financials_receipts WHERE organization_id=? AND analysis_id=? AND idempotency_key=?`,
        [input.organizationId, input.analysisId, key]
      )
    ).rows[0];
    if (prior) {
      if (prior.request_sha256 !== requestSha256)
        throw new DigitizationAnalysisFinancialsError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key is bound to another financials command'
        );
      return { ...prior.response_json, replay: true };
    }
    const analysis = (
      await tx.query<{
        command_version: number;
        archived_at: string | null;
        initiative_id: string | null;
      }>(
        `SELECT command_version,archived_at,initiative_id FROM digitization_analyses WHERE id=? AND organization_id=? FOR UPDATE`,
        [input.analysisId, input.organizationId]
      )
    ).rows[0];
    if (!analysis || analysis.archived_at)
      throw new DigitizationAnalysisFinancialsError(
        'DIGITIZATION_ANALYSIS_NOT_FOUND',
        404,
        'Active digitization analysis not found'
      );
    if (Number(analysis.command_version) !== normalized.expectedVersion)
      throw new DigitizationAnalysisFinancialsError(
        'DIGITIZATION_ANALYSIS_VERSION_CONFLICT',
        409,
        'Digitization analysis version changed',
        { currentVersion: Number(analysis.command_version) }
      );

    const existing = (
      await tx.query<{ id: string }>(
        `SELECT id FROM analysis_financials WHERE analysis_id=? AND organization_id=? FOR UPDATE`,
        [input.analysisId, input.organizationId]
      )
    ).rows[0];
    const financialsId = existing?.id || randomUUID();
    const data = normalized.financialData;
    const values = [
      analysis.initiative_id,
      data.initialInvestment,
      data.implementationCost,
      data.annualOperatingCost,
      data.trainingCost,
      data.contingencyPercent,
      data.annualCostSavings,
      data.annualRevenueIncrease,
      data.productivityGainsPercent,
      data.riskReductionValue,
      data.implementationMonths,
      data.benefitRealizationMonths,
      data.analysisHorizonYears,
      data.discountRate,
      data.currency,
      JSON.stringify(data.assumptions || []),
      JSON.stringify(metrics.cashFlows || []),
      metrics.npv,
      metrics.irr,
      metrics.paybackPeriod,
      metrics.roi,
    ];
    if (existing) {
      await tx.query(
        `UPDATE analysis_financials SET initiative_id=?,initial_investment=?,implementation_cost=?,annual_operating_cost=?,training_cost=?,contingency_percent=?,annual_cost_savings=?,annual_revenue_increase=?,productivity_gains_percent=?,risk_reduction_value=?,implementation_months=?,benefit_realization_months=?,analysis_horizon_years=?,discount_rate=?,currency=?,assumptions=?,cash_flow_projections=?,npv=?,irr=?,payback_months=?,roi_percent=?,last_calculated_at=NOW(),updated_at=NOW() WHERE id=? AND organization_id=?`,
        [...values, financialsId, input.organizationId]
      );
    } else {
      await tx.query(
        `INSERT INTO analysis_financials(id,analysis_id,organization_id,created_by,created_at,updated_at,last_calculated_at,initiative_id,initial_investment,implementation_cost,annual_operating_cost,training_cost,contingency_percent,annual_cost_savings,annual_revenue_increase,productivity_gains_percent,risk_reduction_value,implementation_months,benefit_realization_months,analysis_horizon_years,discount_rate,currency,assumptions,cash_flow_projections,npv,irr,payback_months,roi_percent) VALUES(?,?,?,?,NOW(),NOW(),NOW(),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [financialsId, input.analysisId, input.organizationId, input.userId, ...values]
      );
    }

    const scenarioSummaries: Array<{
      scenarioType: string;
      npv: number | null;
      roi: number | null;
    }> = [];
    for (const scenarioType of ['base', 'optimistic', 'conservative'] as const) {
      const scenarioData =
        scenarioType === 'base' ? data : applyScenarioAdjustments(data, scenarioType);
      const scenarioMetrics = calculateFinancialMetrics(scenarioData);
      scenarioSummaries.push({
        scenarioType,
        npv: scenarioMetrics.npv ?? null,
        roi: scenarioMetrics.roi ?? null,
      });
      await tx.query(
        `INSERT INTO analysis_financial_scenarios(id,analysis_id,organization_id,scenario_type,name,assumptions,financial_data,metrics,is_active,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,NOW(),NOW()) ON CONFLICT(analysis_id,scenario_type) DO UPDATE SET organization_id=EXCLUDED.organization_id,name=EXCLUDED.name,assumptions=EXCLUDED.assumptions,financial_data=EXCLUDED.financial_data,metrics=EXCLUDED.metrics,updated_at=NOW()`,
        [
          randomUUID(),
          input.analysisId,
          input.organizationId,
          scenarioType,
          scenarioType === 'base'
            ? 'Base'
            : scenarioType === 'optimistic'
              ? 'Optimistic'
              : 'Conservative',
          JSON.stringify(scenarioData.assumptions || []),
          JSON.stringify(scenarioData),
          JSON.stringify({
            npv: scenarioMetrics.npv,
            irr: scenarioMetrics.irr,
            roi: scenarioMetrics.roi,
            paybackPeriod: scenarioMetrics.paybackPeriod,
            cashFlows: scenarioMetrics.cashFlows,
          }),
          scenarioType === 'base',
          input.userId,
        ]
      );
    }
    const resultingVersion = normalized.expectedVersion + 1;
    const updated = await tx.query(
      `UPDATE digitization_analyses SET command_version=?,updated_at=NOW() WHERE id=? AND organization_id=? AND command_version=? AND archived_at IS NULL`,
      [resultingVersion, input.analysisId, input.organizationId, normalized.expectedVersion]
    );
    if (updated.rowCount !== 1)
      throw new DigitizationAnalysisFinancialsError(
        'DIGITIZATION_ANALYSIS_VERSION_CONFLICT',
        409,
        'Digitization analysis changed before financials commit'
      );
    const recommended = scenarioSummaries.reduce(
      (best, current) =>
        !best || (current.npv ?? -Infinity) > (best.npv ?? -Infinity) ? current : best,
      null as (typeof scenarioSummaries)[number] | null
    );
    const result: DigitizationAnalysisFinancialsResult = {
      analysisId: input.analysisId,
      financialsId,
      version: resultingVersion,
      metrics,
      warnings,
      recommendations: insights.recommendations,
      scenarioRecommendation: recommended
        ? { scenarioType: recommended.scenarioType, reason: 'Highest NPV across scenarios' }
        : null,
      receiptId: randomUUID(),
      replay: false,
    };
    await tx.query(
      `INSERT INTO finance_digitization_analysis_financials_receipts(receipt_id,organization_id,analysis_id,idempotency_key,request_sha256,expected_version,resulting_version,financials_id,response_json,persisted_by) VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [
        result.receiptId,
        input.organizationId,
        input.analysisId,
        key,
        requestSha256,
        normalized.expectedVersion,
        resultingVersion,
        financialsId,
        JSON.stringify(result),
        input.userId,
      ]
    );
    return result;
  });
}
