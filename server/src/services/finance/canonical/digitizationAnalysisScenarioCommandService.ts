import { createHash, randomUUID } from 'node:crypto';

import { withPgTransaction } from '../../../utils/queryHelpers.js';
import { calculateFinancialMetrics, normalizeFinancialData } from '../../economicsFinancials.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';

export class DigitizationAnalysisScenarioCommandError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export interface DigitizationAnalysisScenarioCommandResult {
  analysisId: string;
  scenarioId: string;
  scenarioType: 'base' | 'optimistic' | 'conservative';
  isActive: boolean;
  version: number;
  receiptId: string;
  replay: boolean;
}

const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const scenarioTypes = new Set(['base', 'optimistic', 'conservative']);

async function command(input: {
  organizationId: string;
  userId: string;
  analysisId: string;
  idempotencyKey: string;
  expectedVersion: number;
  kind: 'UPSERT' | 'ACTIVATE';
  scenarioId?: string;
  scenarioType?: string;
  name?: string;
  financialData?: Record<string, unknown>;
}): Promise<DigitizationAnalysisScenarioCommandResult> {
  const key = input.idempotencyKey.trim();
  if (!key || key.length > 200)
    throw new DigitizationAnalysisScenarioCommandError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1)
    throw new DigitizationAnalysisScenarioCommandError(
      'INVALID_EXPECTED_VERSION',
      400,
      'expectedVersion must be a positive integer'
    );
  if (input.kind === 'UPSERT' && !scenarioTypes.has(String(input.scenarioType)))
    throw new DigitizationAnalysisScenarioCommandError(
      'INVALID_SCENARIO_TYPE',
      400,
      'scenarioType must be base, optimistic or conservative'
    );
  if (
    input.kind === 'UPSERT' &&
    input.name !== undefined &&
    (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 200)
  )
    throw new DigitizationAnalysisScenarioCommandError(
      'INVALID_SCENARIO',
      400,
      'name must be 1..200 characters'
    );
  if (
    input.kind === 'UPSERT' &&
    input.financialData !== undefined &&
    (!input.financialData ||
      typeof input.financialData !== 'object' ||
      Array.isArray(input.financialData))
  )
    throw new DigitizationAnalysisScenarioCommandError(
      'INVALID_SCENARIO',
      400,
      'financialData must be an object'
    );
  if (input.kind === 'ACTIVATE' && !input.scenarioId)
    throw new DigitizationAnalysisScenarioCommandError(
      'INVALID_SCENARIO',
      400,
      'scenarioId is required'
    );
  const normalizedData =
    input.kind === 'UPSERT' ? normalizeFinancialData(input.financialData || {}) : null;
  const request = {
    kind: input.kind,
    expectedVersion: input.expectedVersion,
    scenarioId: input.scenarioId || null,
    scenarioType: input.scenarioType || null,
    name: input.name?.trim() || null,
    financialData: normalizedData,
  };
  const requestSha256 = sha256(request);

  return withPgTransaction(async (tx) => {
    const membership = (
      await tx.query<{ status: string; role: string }>(
        `SELECT status,role FROM organization_members WHERE organization_id=? AND user_id=? FOR UPDATE`,
        [input.organizationId, input.userId]
      )
    ).rows[0];
    if (String(membership?.status || '').toUpperCase() !== 'ACTIVE')
      throw new DigitizationAnalysisScenarioCommandError(
        'ORG_MEMBERSHIP_REVOKED',
        403,
        'Active organization membership is required'
      );
    if (!hasFinanceEditRole(membership.role))
      throw new DigitizationAnalysisScenarioCommandError(
        'FINANCE_EDIT_FORBIDDEN',
        403,
        'Finance edit role is required'
      );
    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${input.organizationId}:${input.analysisId}:DIGITIZATION_ANALYSIS_SCENARIO`,
    ]);
    const prior = (
      await tx.query<{
        request_sha256: string;
        response_json: DigitizationAnalysisScenarioCommandResult;
      }>(
        `SELECT request_sha256,response_json FROM finance_digitization_analysis_scenario_command_receipts WHERE organization_id=? AND analysis_id=? AND idempotency_key=?`,
        [input.organizationId, input.analysisId, key]
      )
    ).rows[0];
    if (prior) {
      if (prior.request_sha256 !== requestSha256)
        throw new DigitizationAnalysisScenarioCommandError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key is bound to another scenario command'
        );
      return { ...prior.response_json, replay: true };
    }
    const analysis = (
      await tx.query<{ command_version: number; archived_at: string | null }>(
        `SELECT command_version,archived_at FROM digitization_analyses WHERE id=? AND organization_id=? FOR UPDATE`,
        [input.analysisId, input.organizationId]
      )
    ).rows[0];
    if (!analysis || analysis.archived_at)
      throw new DigitizationAnalysisScenarioCommandError(
        'DIGITIZATION_ANALYSIS_NOT_FOUND',
        404,
        'Active digitization analysis not found'
      );
    if (Number(analysis.command_version) !== input.expectedVersion)
      throw new DigitizationAnalysisScenarioCommandError(
        'DIGITIZATION_ANALYSIS_VERSION_CONFLICT',
        409,
        'Digitization analysis version changed',
        { currentVersion: Number(analysis.command_version) }
      );

    let scenarioId = input.scenarioId || '';
    let scenarioType: DigitizationAnalysisScenarioCommandResult['scenarioType'];
    let isActive = false;
    if (input.kind === 'UPSERT') {
      scenarioType =
        input.scenarioType as DigitizationAnalysisScenarioCommandResult['scenarioType'];
      const existing = (
        await tx.query<{ id: string; is_active: boolean }>(
          `SELECT id,is_active FROM analysis_financial_scenarios WHERE analysis_id=? AND scenario_type=? AND organization_id=? FOR UPDATE`,
          [input.analysisId, scenarioType, input.organizationId]
        )
      ).rows[0];
      scenarioId = existing?.id || randomUUID();
      isActive = Boolean(existing?.is_active);
      const metrics = calculateFinancialMetrics(normalizedData!);
      const values = [
        input.name?.trim() || scenarioType,
        JSON.stringify(normalizedData!.assumptions || []),
        JSON.stringify(normalizedData),
        JSON.stringify({
          npv: metrics.npv,
          irr: metrics.irr,
          roi: metrics.roi,
          paybackPeriod: metrics.paybackPeriod,
          cashFlows: metrics.cashFlows,
        }),
      ];
      if (existing)
        await tx.query(
          `UPDATE analysis_financial_scenarios SET name=?,assumptions=?,financial_data=?,metrics=?,updated_at=NOW() WHERE id=? AND organization_id=?`,
          [...values, scenarioId, input.organizationId]
        );
      else
        await tx.query(
          `INSERT INTO analysis_financial_scenarios(id,analysis_id,organization_id,scenario_type,name,assumptions,financial_data,metrics,is_active,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,FALSE,?,NOW(),NOW())`,
          [
            scenarioId,
            input.analysisId,
            input.organizationId,
            scenarioType,
            ...values,
            input.userId,
          ]
        );
    } else {
      const target = (
        await tx.query<{
          scenario_type: DigitizationAnalysisScenarioCommandResult['scenarioType'];
        }>(
          `SELECT scenario_type FROM analysis_financial_scenarios WHERE id=? AND analysis_id=? AND organization_id=? FOR UPDATE`,
          [scenarioId, input.analysisId, input.organizationId]
        )
      ).rows[0];
      if (!target)
        throw new DigitizationAnalysisScenarioCommandError(
          'SCENARIO_NOT_FOUND',
          404,
          'Scenario not found in analysis tenant'
        );
      scenarioType = target.scenario_type;
      await tx.query(
        `UPDATE analysis_financial_scenarios SET is_active=FALSE WHERE analysis_id=? AND organization_id=?`,
        [input.analysisId, input.organizationId]
      );
      const activated = await tx.query(
        `UPDATE analysis_financial_scenarios SET is_active=TRUE,updated_at=NOW() WHERE id=? AND analysis_id=? AND organization_id=?`,
        [scenarioId, input.analysisId, input.organizationId]
      );
      if (activated.rowCount !== 1)
        throw new DigitizationAnalysisScenarioCommandError(
          'SCENARIO_NOT_FOUND',
          404,
          'Scenario disappeared before activation'
        );
      isActive = true;
    }
    const resultingVersion = input.expectedVersion + 1;
    const updated = await tx.query(
      `UPDATE digitization_analyses SET command_version=?,updated_at=NOW() WHERE id=? AND organization_id=? AND command_version=? AND archived_at IS NULL`,
      [resultingVersion, input.analysisId, input.organizationId, input.expectedVersion]
    );
    if (updated.rowCount !== 1)
      throw new DigitizationAnalysisScenarioCommandError(
        'DIGITIZATION_ANALYSIS_VERSION_CONFLICT',
        409,
        'Digitization analysis changed before scenario commit'
      );
    const result: DigitizationAnalysisScenarioCommandResult = {
      analysisId: input.analysisId,
      scenarioId,
      scenarioType,
      isActive,
      version: resultingVersion,
      receiptId: randomUUID(),
      replay: false,
    };
    await tx.query(
      `INSERT INTO finance_digitization_analysis_scenario_command_receipts(receipt_id,organization_id,analysis_id,scenario_id,command_kind,idempotency_key,request_sha256,expected_version,resulting_version,response_json,commanded_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      [
        result.receiptId,
        input.organizationId,
        input.analysisId,
        scenarioId,
        input.kind,
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

export function upsertDigitizationAnalysisScenario(
  input: Omit<Parameters<typeof command>[0], 'kind' | 'scenarioId'>
) {
  return command({ ...input, kind: 'UPSERT' });
}

export function activateDigitizationAnalysisScenario(
  input: Omit<Parameters<typeof command>[0], 'kind' | 'scenarioType' | 'name' | 'financialData'>
) {
  return command({ ...input, kind: 'ACTIVATE' });
}
