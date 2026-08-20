import { withPgTransaction } from '../../../utils/queryHelpers.js';
import { randomUUID } from 'node:crypto';
import { createValuation, type ValuationSourceType } from '../../valuationService.js';
import { setValuationDepth, type ValuationDepth } from '../../valuationDepthProfileService.js';
import { createArtifact } from './artifactVersionService.js';
import { canonicalPayloadHash } from './contentHash.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';

export interface CreateRegisteredValuationParams {
  organizationId: string;
  userId: string;
  title: string;
  description?: string;
  projectId?: string;
  initiativeId?: string;
  sourceType: ValuationSourceType;
  sourceId?: string | null;
  horizonYears?: number;
  currency?: string;
  depth?: ValuationDepth;
  idempotencyKey: string;
  actor?: { userId?: string; userEmail?: string; ip?: string; userAgent?: string };
}

export interface CreateRegisteredValuationResult {
  id: string;
  artifactId: string;
  businessVersionId: string;
  workingRevisionId: string;
  replay: boolean;
}

export class ValuationRegistrationError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message);
  }
}

/**
 * Creates the legacy valuation and its canonical workspace identity in one
 * pinned transaction. DbPromise and createArtifact both inherit the ambient
 * transaction, so a failed alias/canonical write rolls the legacy row back too.
 */
export async function createRegisteredValuation(
  params: CreateRegisteredValuationParams
): Promise<CreateRegisteredValuationResult> {
  const idempotencyKey = params.idempotencyKey.trim();
  if (!idempotencyKey) {
    throw new ValuationRegistrationError('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key is required');
  }
  const command = {
    title: params.title.trim(),
    description: params.description?.trim() || null,
    projectId: params.projectId || null,
    initiativeId: params.initiativeId || null,
    sourceType: params.sourceType,
    sourceId: params.sourceId || null,
    horizonYears: params.horizonYears ?? 5,
    currency: (params.currency || 'PLN').trim().toUpperCase(),
    depth: params.depth || null,
  };
  const requestHash = canonicalPayloadHash(command);
  return withPgTransaction(async (tx) => {
    const membership = (await tx.query<{status:string;role:string}>(
      `SELECT status,role FROM organization_members
        WHERE organization_id=? AND user_id=? FOR UPDATE`,
      [params.organizationId,params.userId]
    )).rows[0];
    if (String(membership?.status || '').toUpperCase() !== 'ACTIVE') {
      throw new ValuationRegistrationError('ORG_MEMBERSHIP_REVOKED',403,'Active organization membership is required');
    }
    if (!hasFinanceEditRole(membership.role)) {
      throw new ValuationRegistrationError('FINANCE_EDIT_FORBIDDEN',403,'Finance editor role is required');
    }
    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?, 0))`, [
      `${params.organizationId}:${idempotencyKey}:VALUATION_REGISTRATION`,
    ]);
    const receipt = (await tx.query<any>(
      `SELECT request_hash,response_json
         FROM finance_valuation_registration_command_receipts
        WHERE organization_id=? AND idempotency_key=?`,
      [params.organizationId, idempotencyKey]
    )).rows[0];
    if (receipt) {
      if (receipt.request_hash !== requestHash) {
        throw new ValuationRegistrationError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key is already bound to another valuation registration'
        );
      }
      return { ...(receipt.response_json as Omit<CreateRegisteredValuationResult, 'replay'>), replay: true };
    }
    const legacy = await createValuation(
      params.organizationId,
      {
        title: command.title,
        description: command.description ?? undefined,
        projectId: command.projectId ?? undefined,
        initiativeId: command.initiativeId ?? undefined,
        sourceType: command.sourceType,
        sourceId: command.sourceId,
        horizonYears: command.horizonYears,
        currency: command.currency,
      },
      params.userId
    );
    if (params.depth) {
      await setValuationDepth(params.organizationId, legacy.id, params.depth, {
        actor: params.actor,
      });
    }

    const canonical = await createArtifact({
      organizationId: params.organizationId,
      artifactType: 'VALUATION_CASE',
      naturalKey: `valuations:${legacy.id}`,
      createdBy: params.userId,
    });

    const caseId = randomUUID();
    await tx.query(
      `INSERT INTO finance_valuation_cases
       (case_id, organization_id, name, description, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [caseId, params.organizationId, params.title, params.description ?? null, params.userId]
    );
    await tx.query(
      `INSERT INTO finance_valuation_variants
       (id, organization_id, business_version_id, case_id, name, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        params.organizationId,
        canonical.businessVersion.business_version_id,
        caseId,
        params.title,
        params.description ?? null,
        params.userId,
      ]
    );

    await tx.query(
      `INSERT INTO finance_artifact_aliases
       (legacy_table, legacy_id, legacy_version, artifact_id, organization_id,
        business_version_id, mapping_confidence, mapping_reason, created_by)
       VALUES ('valuations', ?, '', ?, ?, ?, 'AUTO_MIGRATE', ?, ?)`,
      [
        legacy.id,
        canonical.artifact.artifact_id,
        params.organizationId,
        canonical.businessVersion.business_version_id,
        'Registered atomically from valuation creation.',
        params.userId,
      ]
    );

    const response = {
      id: legacy.id,
      artifactId: canonical.artifact.artifact_id,
      businessVersionId: canonical.businessVersion.business_version_id,
      workingRevisionId: canonical.workingRevision.working_revision_id,
    };
    await tx.query(
      `INSERT INTO finance_valuation_registration_command_receipts
       (organization_id,idempotency_key,request_hash,legacy_valuation_id,artifact_id,
        business_version_id,working_revision_id,response_json,created_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [params.organizationId,idempotencyKey,requestHash,response.id,response.artifactId,
       response.businessVersionId,response.workingRevisionId,JSON.stringify(response),params.userId]
    );
    return { ...response, replay: false };
  });
}
