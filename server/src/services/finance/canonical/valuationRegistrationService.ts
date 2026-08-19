import { withPgTransaction } from '../../../utils/queryHelpers.js';
import { randomUUID } from 'node:crypto';
import { createValuation, type ValuationSourceType } from '../../valuationService.js';
import { setValuationDepth, type ValuationDepth } from '../../valuationDepthProfileService.js';
import { createArtifact } from './artifactVersionService.js';

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
  actor?: { userId?: string; userEmail?: string; ip?: string; userAgent?: string };
}

export interface CreateRegisteredValuationResult {
  id: string;
  artifactId: string;
  businessVersionId: string;
  workingRevisionId: string;
}

/**
 * Creates the legacy valuation and its canonical workspace identity in one
 * pinned transaction. DbPromise and createArtifact both inherit the ambient
 * transaction, so a failed alias/canonical write rolls the legacy row back too.
 */
export async function createRegisteredValuation(
  params: CreateRegisteredValuationParams
): Promise<CreateRegisteredValuationResult> {
  return withPgTransaction(async (tx) => {
    const legacy = await createValuation(
      params.organizationId,
      {
        title: params.title,
        description: params.description,
        projectId: params.projectId,
        initiativeId: params.initiativeId,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        horizonYears: params.horizonYears,
        currency: params.currency,
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

    return {
      id: legacy.id,
      artifactId: canonical.artifact.artifact_id,
      businessVersionId: canonical.businessVersion.business_version_id,
      workingRevisionId: canonical.workingRevision.working_revision_id,
    };
  });
}
