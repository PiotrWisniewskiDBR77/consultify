import { createHash, randomUUID } from 'node:crypto';

import { withPgTransaction } from '../../../utils/queryHelpers.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';

export class DigitizationAnalysisRegistrationError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export interface DigitizationAnalysisRegistrationResult {
  id: string;
  name: string;
  description: string | null;
  status: 'DRAFT';
  projectId: string | null;
  initiativeId: string | null;
  analysisType: string;
  version: 1;
  receiptId: string;
  replay: boolean;
}

function requiredText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new DigitizationAnalysisRegistrationError(
      'INVALID_REGISTRATION',
      400,
      `${field} must be 1..${max} characters`
    );
  }
  return value.trim();
}

function optionalText(value: unknown, field: string, max: number): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max) {
    throw new DigitizationAnalysisRegistrationError(
      'INVALID_REGISTRATION',
      400,
      `${field} must be at most ${max} characters`
    );
  }
  return value.trim();
}

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function registerDigitizationAnalysis(input: {
  organizationId: string;
  userId: string;
  idempotencyKey: string;
  body: unknown;
}): Promise<DigitizationAnalysisRegistrationResult> {
  const key = input.idempotencyKey.trim();
  if (!key || key.length > 200) {
    throw new DigitizationAnalysisRegistrationError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  }
  if (!input.body || typeof input.body !== 'object' || Array.isArray(input.body)) {
    throw new DigitizationAnalysisRegistrationError(
      'INVALID_REGISTRATION',
      400,
      'Registration body must be an object'
    );
  }
  const body = input.body as Record<string, unknown>;
  const allowed = new Set([
    'name',
    'description',
    'projectId',
    'initiativeId',
    'analysisType',
    'sourceType',
    'sourceId',
  ]);
  if (Object.keys(body).some((field) => !allowed.has(field))) {
    throw new DigitizationAnalysisRegistrationError(
      'INVALID_REGISTRATION',
      400,
      'Unknown registration field'
    );
  }
  const normalized = {
    name: requiredText(body.name, 'name', 300),
    description: optionalText(body.description, 'description', 10_000),
    projectId: optionalText(body.projectId, 'projectId', 200),
    initiativeId: optionalText(body.initiativeId, 'initiativeId', 200),
    analysisType: optionalText(body.analysisType, 'analysisType', 100) || 'financial',
    sourceType: optionalText(body.sourceType, 'sourceType', 100),
    sourceId: optionalText(body.sourceId, 'sourceId', 300),
  };
  if ((normalized.sourceType == null) !== (normalized.sourceId == null)) {
    throw new DigitizationAnalysisRegistrationError(
      'INVALID_SOURCE_LINEAGE',
      400,
      'sourceType and sourceId must be supplied together'
    );
  }
  const requestSha256 = hash(normalized);

  return withPgTransaction(async (tx) => {
    const membership = (
      await tx.query<{ status: string; role: string }>(
        `SELECT status,role FROM organization_members
         WHERE organization_id=? AND user_id=? FOR UPDATE`,
        [input.organizationId, input.userId]
      )
    ).rows[0];
    if (String(membership?.status || '').toUpperCase() !== 'ACTIVE') {
      throw new DigitizationAnalysisRegistrationError(
        'ORG_MEMBERSHIP_REVOKED',
        403,
        'Active organization membership is required'
      );
    }
    if (!hasFinanceEditRole(membership.role)) {
      throw new DigitizationAnalysisRegistrationError(
        'FINANCE_EDIT_FORBIDDEN',
        403,
        'Finance edit role is required'
      );
    }
    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${input.organizationId}:${normalized.sourceType || 'KEY'}:${normalized.sourceId || key}:DIGITIZATION_ANALYSIS_REGISTRATION`,
    ]);
    const prior = (
      await tx.query<{
        request_sha256: string;
        response_json: DigitizationAnalysisRegistrationResult;
      }>(
        `SELECT request_sha256,response_json
         FROM finance_digitization_analysis_registration_receipts
         WHERE organization_id=? AND idempotency_key=?`,
        [input.organizationId, key]
      )
    ).rows[0];
    if (prior) {
      if (prior.request_sha256 !== requestSha256) {
        throw new DigitizationAnalysisRegistrationError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key is bound to another registration'
        );
      }
      return { ...prior.response_json, replay: true };
    }
    if (normalized.sourceType && normalized.sourceId) {
      const priorSource = (
        await tx.query<{
          request_sha256: string;
          response_json: DigitizationAnalysisRegistrationResult;
        }>(
          `SELECT request_sha256,response_json
           FROM finance_digitization_analysis_registration_receipts
           WHERE organization_id=? AND source_type=? AND source_id=?`,
          [input.organizationId, normalized.sourceType, normalized.sourceId]
        )
      ).rows[0];
      if (priorSource) {
        if (priorSource.request_sha256 !== requestSha256) {
          throw new DigitizationAnalysisRegistrationError(
            'SOURCE_ALREADY_REGISTERED',
            409,
            'Source lineage is already bound to another registration payload'
          );
        }
        return { ...priorSource.response_json, replay: true };
      }
    }

    let projectId = normalized.projectId;
    if (normalized.initiativeId) {
      const initiative = (
        await tx.query<{ project_id: string | null }>(
          `SELECT project_id FROM initiatives WHERE id=? AND organization_id=?`,
          [normalized.initiativeId, input.organizationId]
        )
      ).rows[0];
      if (!initiative) {
        throw new DigitizationAnalysisRegistrationError(
          'INITIATIVE_NOT_FOUND',
          404,
          'Initiative not found in tenant'
        );
      }
      projectId = initiative.project_id;
    } else if (projectId) {
      const project = await tx.query(`SELECT id FROM projects WHERE id=? AND organization_id=?`, [
        projectId,
        input.organizationId,
      ]);
      if (!project.rows[0]) {
        throw new DigitizationAnalysisRegistrationError(
          'PROJECT_NOT_FOUND',
          404,
          'Project not found in tenant'
        );
      }
    }

    const analysisId = randomUUID();
    const receiptId = randomUUID();
    const result: DigitizationAnalysisRegistrationResult = {
      id: analysisId,
      name: normalized.name,
      description: normalized.description,
      status: 'DRAFT',
      projectId,
      initiativeId: normalized.initiativeId,
      analysisType: normalized.analysisType,
      version: 1,
      receiptId,
      replay: false,
    };
    await tx.query(
      `INSERT INTO digitization_analyses
       (id,name,description,status,project_id,initiative_id,analysis_type,organization_id,
        created_by,overall_score,completion_percent,axis_scores,archive_version,created_at,updated_at)
       VALUES(?,?,?,'draft',?,?,?,?,?,NULL,0,'{}',1,NOW(),NOW())`,
      [
        analysisId,
        normalized.name,
        normalized.description,
        projectId,
        normalized.initiativeId,
        normalized.analysisType,
        input.organizationId,
        input.userId,
      ]
    );
    await tx.query(
      `INSERT INTO finance_digitization_analysis_registration_receipts
       (receipt_id,organization_id,analysis_id,idempotency_key,request_sha256,
        source_type,source_id,response_json,created_by)
       VALUES(?,?,?,?,?,?,?,?,?)`,
      [
        receiptId,
        input.organizationId,
        analysisId,
        key,
        requestSha256,
        normalized.sourceType,
        normalized.sourceId,
        JSON.stringify(result),
        input.userId,
      ]
    );
    return result;
  });
}
