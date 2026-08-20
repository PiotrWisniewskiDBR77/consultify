import { createArtifact } from './artifactVersionService.js';
import {
  confirmStatement,
  getLatestStatementIngestRun,
  recordStatementQualityRun,
  recordStatementSourceArtifact,
  snapshotCanonicalStatementVersion,
  startStatementIngestRun,
  updateStatementIngestRun,
  type StatementReadinessEvaluation,
} from '../../financialStatementService.js';
import {
  recomputeStatementPack,
  runStatementPackShadowReconcile,
  syncStatementToPack,
} from '../../financialStatementPackService.js';
import logger from '../../../utils/Logger.js';
import { withPgTransaction } from '../../../utils/queryHelpers.js';

export interface ConfirmAndRegisterStatementPackParams {
  statementId: string;
  organizationId: string;
  userId: string;
  statement: {
    source_file_name?: string | null;
    source_file_path?: string | null;
    parse_method?: string | null;
    document_class?: string | null;
    extraction_strategy?: string | null;
    template_family?: string | null;
  };
  values: unknown[];
  validations: unknown[];
  readiness: StatementReadinessEvaluation;
  beforeLegacyMutation?: () => Promise<void>;
  beforeCanonicalRegistration?: () => Promise<void>;
  afterCommitShadowRunner?: (packId: string) => Promise<void>;
}

export interface ConfirmAndRegisterStatementPackResult {
  statementPackId: string;
  ingestRunId: string | null;
  artifactId: string;
  businessVersionId: string;
  workingRevisionId: string;
  replayed: boolean;
}

async function ensureIngestRun(
  params: ConfirmAndRegisterStatementPackParams
): Promise<string | null> {
  const existing = await getLatestStatementIngestRun(params.statementId);
  if (existing) return existing;
  return startStatementIngestRun({
    statementId: params.statementId,
    organizationId: params.organizationId,
    sourceFileName: params.statement.source_file_name,
    sourceFilePath: params.statement.source_file_path,
    parseMethod: params.statement.parse_method,
    documentClass: params.statement.document_class,
    extractionStrategy: params.statement.extraction_strategy,
    templateFamily: params.statement.template_family,
    createdBy: params.userId,
  });
}

/**
 * Confirms a legacy statement and registers its pack in the canonical workspace
 * as one pinned unit of work. Shadow reconciliation is intentionally run only
 * after commit: it is observational and cannot change the atomic core outcome.
 */
export async function confirmAndRegisterStatementPack(
  params: ConfirmAndRegisterStatementPackParams
): Promise<ConfirmAndRegisterStatementPackResult> {
  const result = await withPgTransaction(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))`, [
      params.organizationId,
      `financial_statement:${params.statementId}`,
    ]);
    const owned = await tx.query<{ id: string; statement_pack_id: string | null; status: string }>(
      `SELECT id, statement_pack_id, status FROM financial_statements WHERE id = ? AND organization_id = ? FOR UPDATE`,
      [params.statementId, params.organizationId]
    );
    if (!owned.rows[0]) throw new Error('Financial statement not found for organization');
    await params.beforeLegacyMutation?.();

    const existingPackId = owned.rows[0].statement_pack_id;
    // An existing canonical alias proves registration identity only. It does
    // not prove that the current statement values_version has been terminally
    // confirmed: a confirmed statement can be reopened by a later values save.
    // Only an already-confirmed owner may take the early replay branch.
    if (existingPackId && String(owned.rows[0].status || '').toLowerCase() === 'confirmed') {
      const existingAlias = await tx.query<{
        artifact_id: string;
        business_version_id: string;
        organization_id: string;
      }>(
        `SELECT artifact_id, business_version_id, organization_id
         FROM finance_artifact_aliases
         WHERE legacy_table = 'financial_statement_packs' AND legacy_id = ? AND legacy_version = ''`,
        [existingPackId]
      );
      const alias = existingAlias.rows[0];
      if (alias) {
        if (alias.organization_id !== params.organizationId) {
          throw new Error('Canonical statement pack alias belongs to another organization');
        }
        const revision = await tx.query<{ working_revision_id: string }>(
          `SELECT working_revision_id FROM finance_working_revisions
           WHERE business_version_id = ? AND organization_id = ? AND is_current = TRUE`,
          [alias.business_version_id, params.organizationId]
        );
        if (!revision.rows[0]) throw new Error('Canonical statement pack has no current revision');
        return {
          statementPackId: existingPackId,
          ingestRunId: await getLatestStatementIngestRun(params.statementId),
          artifactId: alias.artifact_id,
          businessVersionId: alias.business_version_id,
          workingRevisionId: revision.rows[0].working_revision_id,
          replayed: true,
        };
      }
    }

    const ingestRunId = await ensureIngestRun(params);
    await confirmStatement(params.statementId, params.userId, params.readiness);
    await snapshotCanonicalStatementVersion({
      statementId: params.statementId,
      versionKind: 'confirmed',
      readinessStatus: params.readiness.readinessStatus,
      values: params.values,
      validations: params.validations,
      createdBy: params.userId,
      summary: 'Confirmed statement-ready snapshot.',
    });
    // Multi-section imports bind all comparative siblings to one tenant-owned
    // pack before review. Confirmation must preserve that durable identity;
    // re-syncing by the individual statement period fragments the six-sibling
    // document into period-specific packs and breaks cold/deep-link recovery.
    const statementPackId =
      existingPackId ||
      (await syncStatementToPack(params.statementId, { deferShadow: true }));
    if (!statementPackId) throw new Error('Statement pack registration produced no pack');

    await recordStatementSourceArtifact({
      statementId: params.statementId,
      ingestRunId,
      artifactType: 'confirmation',
      stage: 'confirm',
      contentJson: params.readiness,
      createdBy: params.userId,
    });
    await updateStatementIngestRun({
      ingestRunId,
      currentStage: 'confirm',
      runStatus: 'completed',
      reasonCodes: params.readiness.reasonCodes,
      summary: { readinessStatus: params.readiness.readinessStatus },
    });
    await recordStatementQualityRun({
      statementId: params.statementId,
      organizationId: params.organizationId,
      stage: 'confirm',
      resultStatus: 'pass',
      readinessStatus: params.readiness.readinessStatus,
      strategy: params.statement.extraction_strategy || 'confirmation_gate',
      summary: 'Statement confirmed as statement-ready.',
      reasonCodes: params.readiness.reasonCodes,
      payload: params.readiness,
      createdBy: params.userId,
    });

    await params.beforeCanonicalRegistration?.();

    const aliasForPack = await tx.query<{
      artifact_id: string;
      business_version_id: string;
      organization_id: string;
    }>(
      `SELECT artifact_id, business_version_id, organization_id
       FROM finance_artifact_aliases
       WHERE legacy_table = 'financial_statement_packs' AND legacy_id = ? AND legacy_version = ''`,
      [statementPackId]
    );
    const alias = aliasForPack.rows[0];
    if (alias) {
      if (alias.organization_id !== params.organizationId) {
        throw new Error('Canonical statement pack alias belongs to another organization');
      }
      const revision = await tx.query<{ working_revision_id: string }>(
        `SELECT working_revision_id FROM finance_working_revisions
         WHERE business_version_id = ? AND organization_id = ? AND is_current = TRUE`,
        [alias.business_version_id, params.organizationId]
      );
      if (!revision.rows[0]) throw new Error('Canonical statement pack has no current revision');
      return {
        statementPackId,
        ingestRunId,
        artifactId: alias.artifact_id,
        businessVersionId: alias.business_version_id,
        workingRevisionId: revision.rows[0].working_revision_id,
        replayed: true,
      };
    }

    const canonical = await createArtifact({
      organizationId: params.organizationId,
      artifactType: 'STATEMENT_PACK',
      naturalKey: `financial_statement_packs:${statementPackId}`,
      createdBy: params.userId,
    });
    await tx.query(
      `INSERT INTO finance_artifact_aliases
       (legacy_table, legacy_id, legacy_version, artifact_id, organization_id,
        business_version_id, mapping_confidence, mapping_reason, created_by)
       VALUES ('financial_statement_packs', ?, '', ?, ?, ?, 'AUTO_MIGRATE', ?, ?)`,
      [
        statementPackId,
        canonical.artifact.artifact_id,
        params.organizationId,
        canonical.businessVersion.business_version_id,
        'Registered atomically from confirmed financial statement pack.',
        params.userId,
      ]
    );
    return {
      statementPackId,
      ingestRunId,
      artifactId: canonical.artifact.artifact_id,
      businessVersionId: canonical.businessVersion.business_version_id,
      workingRevisionId: canonical.workingRevision.working_revision_id,
      replayed: false,
    };
  });

  // Refresh from the current transaction state after the owner statement was
  // confirmed. Skipping re-sync for an existing comparative pack must not
  // leave the aggregate with the pre-confirm pending snapshot.
  await recomputeStatementPack(result.statementPackId, { deferShadow: true });
  const shadowRunner = params.afterCommitShadowRunner || runStatementPackShadowReconcile;
  await shadowRunner(result.statementPackId).catch((error) => {
    logger.warn('[FinanceStatements] post-commit pack shadow reconcile failed', {
      statementPackId: result.statementPackId,
      error: (error as Error)?.message || String(error),
    });
  });
  return result;
}
