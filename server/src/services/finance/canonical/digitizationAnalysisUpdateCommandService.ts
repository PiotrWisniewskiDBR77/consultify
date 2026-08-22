import { createHash, randomUUID } from 'node:crypto';

import { withPgTransaction } from '../../../utils/queryHelpers.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';

export class DigitizationAnalysisUpdateError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export interface DigitizationAnalysisUpdateResult {
  analysisId: string;
  version: number;
  receiptId: string;
  replay: boolean;
}

const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function optionalText(value: unknown, field: string, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new DigitizationAnalysisUpdateError('INVALID_UPDATE', 400, `${field} is invalid`);
  }
  return value.trim();
}

function optionalNumber(
  value: unknown,
  field: string,
  min: number,
  max: number
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new DigitizationAnalysisUpdateError('INVALID_UPDATE', 400, `${field} is invalid`);
  }
  return value;
}

function normalizeStatus(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const upper = String(value).trim().toUpperCase();
  if (upper === 'REVIEW' || upper === 'IN_PROGRESS') return 'in_progress';
  if (upper === 'APPROVED' || upper === 'COMPLETED') return 'completed';
  if (upper === 'DRAFT') return 'draft';
  throw new DigitizationAnalysisUpdateError('INVALID_UPDATE', 400, 'status is invalid');
}

export async function updateDigitizationAnalysisCommand(input: {
  organizationId: string;
  userId: string;
  analysisId: string;
  idempotencyKey: string;
  body: unknown;
}): Promise<DigitizationAnalysisUpdateResult> {
  const key = input.idempotencyKey.trim();
  if (!key || key.length > 200) {
    throw new DigitizationAnalysisUpdateError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  }
  if (!input.body || typeof input.body !== 'object' || Array.isArray(input.body)) {
    throw new DigitizationAnalysisUpdateError(
      'INVALID_UPDATE',
      400,
      'Update body must be an object'
    );
  }
  const body = input.body as Record<string, unknown>;
  const allowed = new Set([
    'expectedVersion',
    'name',
    'description',
    'status',
    'projectId',
    'initiativeId',
    'analysisType',
    'axisScores',
    'overallScore',
    'completionPercent',
  ]);
  if (Object.keys(body).some((field) => !allowed.has(field))) {
    throw new DigitizationAnalysisUpdateError('INVALID_UPDATE', 400, 'Unknown update field');
  }
  const expectedVersion = Number(body.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new DigitizationAnalysisUpdateError(
      'INVALID_EXPECTED_VERSION',
      400,
      'expectedVersion must be a positive integer'
    );
  }
  const patch = {
    name: optionalText(body.name, 'name', 300),
    description: optionalText(body.description, 'description', 10_000),
    status: normalizeStatus(body.status),
    projectId: optionalText(body.projectId, 'projectId', 200),
    initiativeId: optionalText(body.initiativeId, 'initiativeId', 200),
    analysisType: optionalText(body.analysisType, 'analysisType', 100),
    axisScores: body.axisScores,
    overallScore: optionalNumber(body.overallScore, 'overallScore', 0, 100),
    completionPercent: optionalNumber(body.completionPercent, 'completionPercent', 0, 100),
  };
  if (
    patch.axisScores !== undefined &&
    (patch.axisScores === null ||
      typeof patch.axisScores !== 'object' ||
      Array.isArray(patch.axisScores))
  ) {
    throw new DigitizationAnalysisUpdateError(
      'INVALID_UPDATE',
      400,
      'axisScores must be an object'
    );
  }
  if (Object.values(patch).every((value) => value === undefined)) {
    throw new DigitizationAnalysisUpdateError(
      'EMPTY_UPDATE',
      400,
      'At least one update field is required'
    );
  }
  const requestSha256 = sha256({ expectedVersion, patch });

  return withPgTransaction(async (tx) => {
    const membership = (
      await tx.query<{ status: string; role: string }>(
        `SELECT status,role FROM organization_members WHERE organization_id=? AND user_id=? FOR UPDATE`,
        [input.organizationId, input.userId]
      )
    ).rows[0];
    if (String(membership?.status || '').toUpperCase() !== 'ACTIVE') {
      throw new DigitizationAnalysisUpdateError(
        'ORG_MEMBERSHIP_REVOKED',
        403,
        'Active organization membership is required'
      );
    }
    if (!hasFinanceEditRole(membership.role)) {
      throw new DigitizationAnalysisUpdateError(
        'FINANCE_EDIT_FORBIDDEN',
        403,
        'Finance edit role is required'
      );
    }
    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${input.organizationId}:${input.analysisId}:DIGITIZATION_ANALYSIS_UPDATE`,
    ]);
    const prior = (
      await tx.query<{ request_sha256: string; response_json: DigitizationAnalysisUpdateResult }>(
        `SELECT request_sha256,response_json FROM finance_digitization_analysis_update_receipts
       WHERE organization_id=? AND analysis_id=? AND idempotency_key=?`,
        [input.organizationId, input.analysisId, key]
      )
    ).rows[0];
    if (prior) {
      if (prior.request_sha256 !== requestSha256) {
        throw new DigitizationAnalysisUpdateError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key is bound to another update'
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
      throw new DigitizationAnalysisUpdateError(
        'DIGITIZATION_ANALYSIS_NOT_FOUND',
        404,
        'Active digitization analysis not found'
      );
    }
    if (Number(analysis.command_version) !== expectedVersion) {
      throw new DigitizationAnalysisUpdateError(
        'DIGITIZATION_ANALYSIS_VERSION_CONFLICT',
        409,
        'Digitization analysis version changed',
        { currentVersion: Number(analysis.command_version) }
      );
    }
    let projectId = patch.projectId;
    if (patch.initiativeId) {
      const initiative = (
        await tx.query<{ project_id: string | null }>(
          `SELECT project_id FROM initiatives WHERE id=? AND organization_id=?`,
          [patch.initiativeId, input.organizationId]
        )
      ).rows[0];
      if (!initiative)
        throw new DigitizationAnalysisUpdateError(
          'INITIATIVE_NOT_FOUND',
          404,
          'Initiative not found in tenant'
        );
      projectId = initiative.project_id;
    } else if (projectId) {
      const project = await tx.query(`SELECT id FROM projects WHERE id=? AND organization_id=?`, [
        projectId,
        input.organizationId,
      ]);
      if (!project.rows[0])
        throw new DigitizationAnalysisUpdateError(
          'PROJECT_NOT_FOUND',
          404,
          'Project not found in tenant'
        );
    }
    const columns: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      if (value !== undefined) {
        columns.push(`${column}=?`);
        values.push(value);
      }
    };
    add('name', patch.name);
    add('description', patch.description);
    add('status', patch.status);
    add('project_id', projectId);
    add('initiative_id', patch.initiativeId);
    add('analysis_type', patch.analysisType);
    add(
      'axis_scores',
      patch.axisScores === undefined ? undefined : JSON.stringify(patch.axisScores)
    );
    add('overall_score', patch.overallScore);
    add('completion_percent', patch.completionPercent);
    const resultingVersion = expectedVersion + 1;
    columns.push('command_version=?', 'updated_at=NOW()');
    values.push(resultingVersion, input.analysisId, input.organizationId, expectedVersion);
    const updated = await tx.query(
      `UPDATE digitization_analyses SET ${columns.join(',')} WHERE id=? AND organization_id=? AND command_version=?`,
      values
    );
    if (updated.rowCount !== 1)
      throw new DigitizationAnalysisUpdateError(
        'DIGITIZATION_ANALYSIS_VERSION_CONFLICT',
        409,
        'Digitization analysis changed before update'
      );
    const result: DigitizationAnalysisUpdateResult = {
      analysisId: input.analysisId,
      version: resultingVersion,
      receiptId: randomUUID(),
      replay: false,
    };
    await tx.query(
      `INSERT INTO finance_digitization_analysis_update_receipts
       (receipt_id,organization_id,analysis_id,idempotency_key,request_sha256,expected_version,resulting_version,response_json,updated_by)
       VALUES(?,?,?,?,?,?,?,?,?)`,
      [
        result.receiptId,
        input.organizationId,
        input.analysisId,
        key,
        requestSha256,
        expectedVersion,
        resultingVersion,
        JSON.stringify(result),
        input.userId,
      ]
    );
    return result;
  });
}
