import { v4 as uuidv4 } from 'uuid';

import type {
  ArtifactAccessGrant,
  ArtifactFamily,
  ArtifactListFilters,
  ArtifactListItem,
  ArtifactOriginLink,
  ArtifactOriginRuntime,
  ArtifactPlanningRequest,
  ArtifactPlanningResult,
  ArtifactRecord,
  ArtifactRunFailurePackage,
  ArtifactRunPreflight,
  ArtifactRunRecord,
  ArtifactRunReportSourceType,
  ArtifactRunStatus,
  ArtifactVisibilityScope,
  CreateArtifactAccessGrantParams,
  MaterializeArtifactRunParams,
  RegisterArtifactOriginParams,
} from '../../types/artifactRegistry.js';
import {
  ArtifactPlanningRequestSchema,
  ArtifactRunReportSourceTypeValues,
  CreateArtifactAccessGrantParamsSchema,
  MaterializeArtifactRunParamsSchema,
  RegisterArtifactOriginParamsSchema,
} from '../../types/artifactRegistry.js';
import type { RunState } from '../../types/executionSpine.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { AppError } from '../../utils/ErrorHandler.js';
import logger from '../../utils/Logger.js';
import type {
  TemplateOriginRuntime,
  TemplateOriginSummaryFields,
  TemplateScope,
  TemplateStatus,
} from '../materials/templateContract.js';
import {
  deriveTemplateScope,
  isTemplateOriginRuntime,
  normalizeTemplateScope,
  normalizeTemplateStatus,
  SYSTEM_TEMPLATE_ORG_ID as DOC_STUDIO_SYSTEM_ORG_ID,
  TEMPLATE_ORIGIN_RUNTIMES,
  templateSourceForRuntime,
  toBool,
} from '../materials/templateContract.js';
import { resolveDeckContentCoherence } from '../presentationDeckDocumentService.js';
import {
  buildWave5LineDiffForPreview,
  mirrorLegacyArtifactIntoWave5,
} from '../wave5ArtifactRuntimeService.js';
import { mapCanonicalArtifactType, mapExplicitArtifactRunType } from './artifactTypeMapper.js';
import * as chatExecutionService from './chatExecutionService.js';
import * as contextSnapshotService from './contextSnapshotService.js';
import * as executionSpineService from './executionSpineService.js';
import { isV8Enabled } from './featureFlagService.js';
import {
  buildProposalOperationContract,
  updateOperationContractLinks,
} from './operationContractService.js';
import * as publishReviewService from './publishReviewService.js';

const LOG_PREFIX = '[V8:ArtifactRegistry]';
const FALLBACK_ACTOR = 'system';
const BACKFILL_TTL_MS = 30_000;
const ARTIFACT_RUN_RETRY_NOT_ALLOWED = 'ARTIFACT_RUN_RETRY_NOT_ALLOWED';
const RETRYABLE_ARTIFACT_RUN_STATUSES = new Set<ArtifactRunStatus>([
  'failed',
  'rejected',
  'cancelled',
]);

// Retry does not have a database uniqueness constraint yet. Serialize attempts in this
// process and re-read lineage inside the critical section so concurrent requests are
// idempotent without changing the schema.
const artifactRunRetryLocks = new Map<string, Promise<void>>();

async function withArtifactRunRetryLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = artifactRunRetryLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  artifactRunRetryLocks.set(key, tail);

  await previous;
  try {
    return await work();
  } finally {
    release();
    if (artifactRunRetryLocks.get(key) === tail) {
      artifactRunRetryLocks.delete(key);
    }
  }
}

type StarterTableField = {
  name: string;
  fieldType: string;
  options?: Record<string, unknown>;
};

type StarterTableSeed = {
  fields: StarterTableField[];
  records: Array<Record<string, unknown>>;
};

type AuditAction =
  | 'created'
  | 'preflight'
  | 'plan_accepted'
  | 'materialized'
  | 'failed'
  | 'cancelled'
  | 'retry_requested'
  | 'status_changed';

async function emitRunAudit(params: {
  runId: string;
  organizationId: string;
  action: AuditAction;
  actorUserId: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  detail?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO v8_artifact_run_audit_log (
        audit_id, run_id, organization_id, action, from_status, to_status,
        actor_user_id, detail_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.runId,
        params.organizationId,
        params.action,
        params.fromStatus ?? null,
        params.toStatus ?? null,
        params.actorUserId,
        params.detail ? JSON.stringify(params.detail) : null,
        new Date().toISOString(),
      ]
    );
  } catch (err) {
    logger.warn(`${LOG_PREFIX} Audit emit failed (non-blocking)`, {
      runId: params.runId,
      action: params.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface ArtifactRunAuditEntry {
  auditId: string;
  runId: string;
  organizationId: string;
  action: AuditAction;
  fromStatus: string | null;
  toStatus: string | null;
  actorUserId: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export async function getArtifactRunAuditLog(
  runId: string,
  organizationId: string
): Promise<ArtifactRunAuditEntry[]> {
  const rows = await dbAll<{
    audit_id: string;
    run_id: string;
    organization_id: string;
    action: string;
    from_status: string | null;
    to_status: string | null;
    actor_user_id: string;
    detail_json: string | null;
    created_at: string;
  }>(
    `SELECT * FROM v8_artifact_run_audit_log
     WHERE run_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [runId, organizationId]
  );
  return rows.map((r) => ({
    auditId: r.audit_id,
    runId: r.run_id,
    organizationId: r.organization_id,
    action: r.action as AuditAction,
    fromStatus: r.from_status,
    toStatus: r.to_status,
    actorUserId: r.actor_user_id,
    detail: r.detail_json ? JSON.parse(r.detail_json) : null,
    createdAt: r.created_at,
  }));
}
const SNAPSHOT_SOURCE_KIND_TO_REPORT_SOURCE_TYPE: Record<string, ArtifactRunReportSourceType> = {
  assessment: 'ASSESSMENT',
  interview: 'INTERVIEW',
  tool: 'TOOL',
  initiative: 'INITIATIVE',
  upload_bundle: 'UPLOAD_BUNDLE',
  financial_analysis: 'FINANCIAL_ANALYSIS',
  valuation: 'VALUATION',
  results_kpi_report: 'RESULTS_KPI_REPORT',
};
const VALID_REPORT_SOURCE_TYPES = new Set<string>(ArtifactRunReportSourceTypeValues);
const SNAPSHOT_SOURCE_KIND_TO_PRESENTATION_SOURCE_ARTIFACT_TYPE: Record<string, string> = {
  assessment: 'assessment',
  interview: 'custom',
  insight: 'custom',
  tool: 'tool_session',
  tool_session: 'tool_session',
  initiative: 'initiative_portfolio',
  initiative_portfolio: 'initiative_portfolio',
  financial_analysis: 'financial_analysis',
  valuation: 'valuation',
  report: 'report',
  results_kpi_report: 'report',
};

const backfillWatermark = new Map<string, number>();

interface ArtifactRow {
  artifact_id: string;
  organization_id: string;
  output_type: 'report' | 'presentation' | 'sheet';
  artifact_family: ArtifactFamily | null;
  delivery_state: string;
  title_snapshot: string | null;
  owner_user_id: string | null;
  canonical_home: string | null;
  visibility_scope: ArtifactVisibilityScope | null;
  project_id: string | null;
  context_snapshot_id: string | null;
  execution_run_id: string | null;
  template_family_ref: string | null;
  source_initiative_id: string | null;
  ai_governance_preset_ref: string | null;
  origin_summary_json: string | null;
  is_draft: number | null;
  created_by: string;
  created_at: string;
  last_transition_at: string;
}

interface ArtifactListRow extends ArtifactRow {
  origin_runtime:
    | 'report'
    | 'presentation'
    | 'sheet'
    | 'native_artifact'
    | 'report_template'
    | 'presentation_template'
    | 'sheet_template'
    | 'document_template'
    | null;
  origin_record_id: string | null;
  report_title: string | null;
  report_status: string | null;
  report_type: string | null;
  report_source_refs_json: string | null;
  presentation_title: string | null;
  presentation_status: string | null;
  presentation_mode: string | null;
  presentation_slide_count: number | null;
  /**
   * MAT-006B — raw `presentation_decks.deck_json` (TEXT). Read ONLY to derive
   * the card count through `resolveDeckContentCoherence`; never returned to a
   * client (`rowToListItem` builds an explicit item, it does not spread the row).
   */
  presentation_deck_json: string | null;
  /**
   * 1 when the deck row holds a non-empty `unified_json`. Cheap flag so the list
   * query does not haul a second ~40 KB TEXT column for every deck — the column
   * itself is fetched in a second pass only for rows whose `deck_json` yielded
   * zero cards (see `topUpPresentationUnifiedJson`).
   */
  presentation_has_unified_json: number | null;
  /** Populated only by the second pass, or selected directly on single-row reads. */
  presentation_unified_json: string | null;
  presentation_export_format: string | null;
  presentation_source_refs_json: string | null;
  publish_state: string | null;
  publish_reviewers: string | null;
  review_gate_count: number | null;
  owner_name: string | null;
}

interface OriginLinkRow {
  link_id: string;
  artifact_id: string;
  organization_id: string;
  origin_runtime:
    | 'report'
    | 'presentation'
    | 'sheet'
    | 'native_artifact'
    | 'report_template'
    | 'presentation_template'
    | 'sheet_template'
    | 'document_template';
  origin_record_id: string;
  is_primary_origin: number;
  created_at: string;
}

interface AccessGrantRow {
  grant_id: string;
  artifact_id: string;
  organization_id: string;
  grant_kind: 'user' | 'role';
  user_id: string | null;
  role_key: string | null;
  created_by: string;
  created_at: string;
}

interface ArtifactRunRow {
  run_id: string;
  artifact_id: string | null;
  organization_id: string;
  execution_run_id: string;
  context_snapshot_id: string;
  trigger_type: 'chat' | 'module_action' | 'template' | 'refresh';
  source_context_type: string | null;
  source_context_id: string | null;
  requested_by_user_id: string;
  plan_json: string;
  run_status: ArtifactRunStatus;
  proposal_id: string | null;
  retry_of_run_id: string | null;
  failure_reason: string | null;
  preflight_state: string | null;
  preflight_json: string | null;
  materialization_origin_runtime: string | null;
  materialization_origin_record_id: string | null;
  failure_package_json: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ReportBackfillRow {
  id: string;
  title: string | null;
  status: string | null;
  report_type: string | null;
  project_id: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  source_id: string | null;
  source_refs_json: string | null;
}

interface PresentationBackfillRow {
  id: string;
  title: string | null;
  status: string | null;
  deck_type: string | null;
  presentation_mode: string | null;
  slide_count: number | null;
  export_format: string | null;
  generated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  source_id: string | null;
  source_refs_json: string | null;
}

interface NativeArtifactBackfillRow {
  artifact_id: string;
  title: string | null;
  status: string | null;
  project_id: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  provenance_json: string | null;
}

interface ReportTemplateBackfillRow {
  id: string;
  organization_id: string | null;
  name: string | null;
  description: string | null;
  report_type: string | null;
  sections_json: string | null;
  is_system: number | null;
  is_active: number | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface PresentationTemplateBackfillRow {
  id: string;
  organization_id: string | null;
  name: string | null;
  description: string | null;
  deck_type: string | null;
  outline_json: string | null;
  is_system: number | null;
  is_active: number | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * R11 (doc slice) — canonical Document Studio template registry
 * (`document_studio_templates`, migration 769). Column names mirror the table
 * exactly; `template_id` is the PK (NOT `id`).
 */
interface DocStudioTemplateBackfillRow {
  template_id: string;
  organization_id: string | null;
  name: string | null;
  purpose: string | null;
  category: string | null;
  document_type: string | null;
  section_blueprint: unknown;
  status: string | null;
  version: string | null;
  is_system: unknown;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapArtifactRow(row: ArtifactRow): ArtifactRecord {
  const inferredFamily =
    row.output_type === 'presentation'
      ? 'presentation'
      : row.output_type === 'sheet'
        ? 'sheet'
        : 'document';
  return {
    artifactId: row.artifact_id,
    organizationId: row.organization_id,
    outputType: row.output_type,
    artifactFamily: row.artifact_family ?? inferredFamily,
    deliveryState: row.delivery_state,
    titleSnapshot: row.title_snapshot,
    ownerUserId: row.owner_user_id,
    canonicalHome: 'outputs_library',
    visibilityScope: row.visibility_scope ?? 'organization',
    projectId: row.project_id,
    contextSnapshotId: row.context_snapshot_id,
    executionRunId: row.execution_run_id,
    templateFamilyRef: row.template_family_ref,
    sourceInitiativeId: row.source_initiative_id,
    aiGovernancePresetRef: row.ai_governance_preset_ref,
    originSummary: safeJsonParse<Record<string, unknown> | null>(row.origin_summary_json, null),
    isDraft: Number(row.is_draft ?? 0) === 1,
    createdBy: row.created_by,
    createdAt: row.created_at,
    lastTransitionAt: row.last_transition_at,
  };
}

function mapOriginLinkRow(row: OriginLinkRow): ArtifactOriginLink {
  return {
    linkId: row.link_id,
    artifactId: row.artifact_id,
    organizationId: row.organization_id,
    originRuntime: row.origin_runtime,
    originRecordId: row.origin_record_id,
    isPrimaryOrigin: row.is_primary_origin === 1,
    createdAt: row.created_at,
  };
}

function mapAccessGrantRow(row: AccessGrantRow): ArtifactAccessGrant {
  return {
    grantId: row.grant_id,
    artifactId: row.artifact_id,
    organizationId: row.organization_id,
    grantKind: row.grant_kind,
    userId: row.user_id,
    roleKey: row.role_key,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapArtifactRunRow(row: ArtifactRunRow): ArtifactRunRecord {
  const parsedPlan = safeJsonParse<ArtifactPlanningResult['artifactPlan']>(row.plan_json, {
    artifactFamily: 'document',
    outputType: 'report',
    titleHint: 'Output draft',
    governancePath: 'execution_spine',
    visibilityScope: 'private',
  });

  const preflight = safeJsonParse<ArtifactRunPreflight | null>(row.preflight_json, null);
  const failurePackage = safeJsonParse<ArtifactRunFailurePackage | null>(
    row.failure_package_json,
    null
  );
  const originRuntimeRaw = String(row.materialization_origin_runtime || '').trim();
  const originRecordIdRaw = String(row.materialization_origin_record_id || '').trim();
  const materializationOrigin =
    originRuntimeRaw && originRecordIdRaw
      ? ({
          originRuntime: originRuntimeRaw as ArtifactOriginRuntime,
          originRecordId: originRecordIdRaw,
        } as const)
      : null;

  const operationStage =
    row.run_status === 'planned' || row.run_status === 'proposal_created'
      ? 'proposal_ready'
      : row.run_status === 'awaiting_review'
        ? 'pending_review'
        : row.run_status === 'approved_for_apply'
          ? 'approved'
          : row.run_status === 'applying'
            ? 'executing'
            : row.run_status === 'completed'
              ? 'completed'
              : row.run_status === 'rejected' || row.run_status === 'cancelled'
                ? 'rejected'
                : 'failed';

  return {
    runId: row.run_id,
    artifactId: row.artifact_id,
    organizationId: row.organization_id,
    executionRunId: row.execution_run_id,
    contextSnapshotId: row.context_snapshot_id,
    triggerType: row.trigger_type,
    sourceContextType: row.source_context_type,
    sourceContextId: row.source_context_id,
    requestedByUserId: row.requested_by_user_id,
    plan: parsedPlan,
    persistedRunStatus: row.run_status,
    effectiveRunStatus: row.run_status,
    runStatus: row.run_status,
    proposalId: row.proposal_id,
    retryOfRunId: row.retry_of_run_id,
    failureReason: row.failure_reason,
    preflight,
    failurePackage,
    materializationOrigin,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    operationContract: buildProposalOperationContract({
      kind: 'artifact_runtime',
      contractId: row.run_id,
      stage: operationStage,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      organizationId: row.organization_id,
      userId: row.requested_by_user_id,
      conversationId: row.source_context_type === 'conversation' ? row.source_context_id : null,
      contextSnapshotId: row.context_snapshot_id,
      executionRunId: row.execution_run_id,
      governedProposalId: row.proposal_id,
      artifactRunId: row.run_id,
      artifactId: row.artifact_id,
      targetModule: 'artifact_runtime',
      title: parsedPlan.titleHint,
      summary: `Prepare ${parsedPlan.outputType} via governed artifact runtime`,
      intent: parsedPlan.titleHint,
      previewLines: [
        `Output: ${parsedPlan.outputType}`,
        `Family: ${parsedPlan.artifactFamily}`,
        `Visibility: ${parsedPlan.visibilityScope}`,
      ],
      riskLabel: row.proposal_id ? 'safe_update' : 'safe_additive',
    }),
  };
}

export function deriveArtifactRunStatusFromExecutionState(params: {
  persistedStatus: ArtifactRunStatus;
  executionState?: RunState | null;
}): ArtifactRunStatus {
  const { persistedStatus, executionState } = params;

  if (
    persistedStatus === 'completed' ||
    persistedStatus === 'failed' ||
    persistedStatus === 'cancelled' ||
    persistedStatus === 'retry_requested'
  ) {
    return persistedStatus;
  }

  if (persistedStatus === 'planned') {
    return 'planned';
  }

  switch (executionState) {
    case 'drafting':
    case 'planning':
      return 'planned';
    case 'proposals_ready':
      return 'proposal_created';
    case 'waiting_for_review':
      return 'awaiting_review';
    case 'approved_for_apply':
      return 'approved_for_apply';
    case 'applying':
      return 'applying';
    case 'rejected':
      return 'rejected';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    default:
      return persistedStatus;
  }
}

export function deriveArtifactValidationSnapshot(params: {
  artifact: Pick<
    ArtifactRecord,
    | 'titleSnapshot'
    | 'contextSnapshotId'
    | 'executionRunId'
    | 'sourceInitiativeId'
    | 'originSummary'
  >;
  executionState?: RunState | null;
  sourceRefs?: unknown[];
}): {
  state: 'validated' | 'pending' | 'attention_required';
  checks: Array<{
    id: 'title_present' | 'source_grounded' | 'execution_complete';
    status: 'passed' | 'pending' | 'failed';
    message: string;
  }>;
} {
  const artifactFamily = String((params.artifact as any)?.artifactFamily || '')
    .trim()
    .toLowerCase();

  const sourceRefs =
    params.sourceRefs && Array.isArray(params.sourceRefs)
      ? params.sourceRefs
      : sourceRefsFromOriginSummary(params.artifact.originSummary);

  if (artifactFamily === 'template') {
    const checks: Array<{
      id: 'title_present' | 'source_grounded' | 'execution_complete';
      status: 'passed' | 'pending' | 'failed';
      message: string;
    }> = [
      {
        id: 'title_present',
        status: String(params.artifact.titleSnapshot || '').trim() ? 'passed' : 'failed',
        message: 'Template title snapshot is present',
      },
      {
        id: 'source_grounded',
        status: 'passed',
        message: 'Templates validate via contract payload (no source grounding required)',
      },
      {
        id: 'execution_complete',
        status: 'passed',
        message: 'Templates do not require execution approval before review',
      },
    ];

    if (checks.some((check) => check.status === 'failed')) {
      return { state: 'attention_required', checks };
    }
    return { state: 'validated', checks };
  }

  const checks: Array<{
    id: 'title_present' | 'source_grounded' | 'execution_complete';
    status: 'passed' | 'pending' | 'failed';
    message: string;
  }> = [
    {
      id: 'title_present',
      status: String(params.artifact.titleSnapshot || '').trim() ? 'passed' : 'failed',
      message: 'Artifact title snapshot is present',
    },
    {
      id: 'source_grounded',
      status:
        sourceRefs.length > 0 ||
        Boolean(params.artifact.sourceInitiativeId) ||
        Boolean(params.artifact.contextSnapshotId)
          ? 'passed'
          : 'failed',
      message: 'Artifact keeps source grounding or context lineage',
    },
    {
      id: 'execution_complete',
      status: !params.artifact.executionRunId
        ? 'passed'
        : params.executionState === 'completed'
          ? 'passed'
          : params.executionState === 'failed' ||
              params.executionState === 'cancelled' ||
              params.executionState === 'expired' ||
              params.executionState === 'rejected'
            ? 'failed'
            : 'pending',
      message: 'Execution approval is completed before review or delivery',
    },
  ];

  if (checks.some((check) => check.status === 'pending')) {
    return { state: 'pending', checks };
  }
  if (checks.some((check) => check.status === 'failed')) {
    return { state: 'attention_required', checks };
  }
  return { state: 'validated', checks };
}

export function mapReportStatusToDeliveryState(status: string | null | undefined): string {
  const normalized = String(status || 'draft')
    .trim()
    .toLowerCase();
  if (!normalized || normalized === 'draft') return 'draft';
  if (normalized.includes('configur')) return 'draft';
  if (normalized.includes('archive')) return 'archived';
  if (normalized.includes('review')) return 'in_review';
  if (normalized.includes('sent') || normalized.includes('shared')) return 'shared';
  if (normalized.includes('export')) return 'ready';
  if (normalized.includes('approved') || normalized.includes('final')) return 'ready';
  if (normalized.includes('ready')) return 'ready';
  if (normalized.includes('generat')) return 'generated';
  if (normalized.includes('generate')) return 'generated';
  return 'editing';
}

export function mapPresentationStatusToDeliveryState(status: string | null | undefined): string {
  const normalized = String(status || 'draft')
    .trim()
    .toLowerCase();
  if (!normalized || normalized === 'draft') return 'draft';
  if (normalized === 'generated') return 'generated';
  if (normalized === 'failed') return 'editing';
  if (normalized === 'editing') return 'editing';
  if (normalized === 'ready') return 'ready';
  if (normalized === 'shared') return 'shared';
  if (normalized === 'archived') return 'archived';
  if (normalized.includes('review')) return 'in_review';
  return 'editing';
}

export function deriveArtifactVisibilityScope(params: {
  outputType: 'report' | 'presentation' | 'sheet';
  projectId?: string | null;
  ownerUserId?: string | null;
  isBackfill?: boolean;
}): ArtifactVisibilityScope {
  if (params.projectId) return 'project';
  if (params.ownerUserId) return 'private';
  if (params.isBackfill) return 'private';
  if (params.outputType === 'presentation') return 'private';
  if (params.outputType === 'sheet') return 'organization';
  return 'organization';
}

/**
 * Registers (or refreshes) a canonical sheet artifact for a governed table-platform table.
 * Origin runtime is `sheet`; origin record id is the `tp_tables.id`.
 */
export async function registerGovernedTableSheetArtifact(params: {
  organizationId: string;
  userId: string;
  tableId: string;
  tableName: string;
  contextSnapshotId?: string;
  executionRunId?: string;
}): Promise<ArtifactRecord> {
  const artifact = await registerArtifactOrigin({
    organizationId: params.organizationId,
    outputType: 'sheet',
    artifactFamily: 'sheet',
    originRuntime: 'sheet',
    originRecordId: params.tableId,
    titleSnapshot: params.tableName || 'Untitled table',
    ownerUserId: params.userId,
    createdBy: params.userId,
    deliveryState: 'ready',
    visibilityScope: 'organization',
    contextSnapshotId: params.contextSnapshotId,
    executionRunId: params.executionRunId,
    originSummary: {
      sourceTable: 'tp_tables',
      exportFormat: 'xlsx',
      governanceMode: 'governed',
    },
  });
  if (!artifact) {
    throw new Error('Failed to register governed table sheet artifact');
  }
  return artifact;
}

function buildStarterTableSeed(params: {
  goal?: string | null;
  title?: string | null;
  explicitColumns?: unknown;
  explicitRows?: unknown;
}): StarterTableSeed {
  const explicitFields = Array.isArray(params.explicitColumns)
    ? params.explicitColumns
        .map((column) => {
          if (typeof column === 'string') {
            const name = column.trim();
            return name ? { name, fieldType: 'singleLineText' } : null;
          }
          if (!column || typeof column !== 'object') return null;
          const raw = column as Record<string, unknown>;
          const name = String(raw.name || raw.label || '').trim();
          if (!name || name.toLowerCase() === 'name') return null;
          return {
            name,
            fieldType:
              String(raw.fieldType || raw.type || 'singleLineText').trim() || 'singleLineText',
            options:
              raw.options && typeof raw.options === 'object'
                ? (raw.options as Record<string, unknown>)
                : undefined,
          };
        })
        .filter((field): field is StarterTableField => Boolean(field))
    : [];

  if (explicitFields.length > 0) {
    return {
      fields: explicitFields,
      records: Array.isArray(params.explicitRows)
        ? params.explicitRows
            .filter((row): row is Record<string, unknown> =>
              Boolean(row && typeof row === 'object')
            )
            .slice(0, 10)
        : [],
    };
  }

  const goal = `${params.goal || ''} ${params.title || ''}`.toLowerCase();
  if (
    goal.includes('crm') ||
    goal.includes('lead') ||
    goal.includes('klient') ||
    goal.includes('customer') ||
    goal.includes('sprzeda')
  ) {
    return {
      fields: [
        { name: 'Company', fieldType: 'singleLineText' },
        { name: 'Contact', fieldType: 'singleLineText' },
        { name: 'Email', fieldType: 'email' },
        {
          name: 'Status',
          fieldType: 'singleSelect',
          options: { options: [{ value: 'New' }, { value: 'Qualified' }, { value: 'Won' }] },
        },
        { name: 'Deal Value', fieldType: 'number' },
        { name: 'Next Step', fieldType: 'longText' },
      ],
      records: [
        {
          Name: 'Acme pilot',
          Company: 'Acme Manufacturing',
          Contact: 'Anna Nowak',
          Email: 'anna.nowak@example.com',
          Status: 'New',
          'Deal Value': 45000,
          'Next Step': 'Schedule discovery call',
        },
        {
          Name: 'Beta rollout',
          Company: 'Beta Logistics',
          Contact: 'Jan Kowalski',
          Email: 'jan.kowalski@example.com',
          Status: 'Qualified',
          'Deal Value': 82000,
          'Next Step': 'Prepare ROI estimate',
        },
      ],
    };
  }

  return {
    fields: [
      { name: 'Owner', fieldType: 'singleLineText' },
      {
        name: 'Status',
        fieldType: 'singleSelect',
        options: { options: [{ value: 'New' }, { value: 'In Progress' }, { value: 'Done' }] },
      },
      {
        name: 'Priority',
        fieldType: 'singleSelect',
        options: { options: [{ value: 'Low' }, { value: 'Medium' }, { value: 'High' }] },
      },
      { name: 'Due Date', fieldType: 'date' },
      { name: 'Notes', fieldType: 'longText' },
    ],
    records: [
      {
        Name: 'Initial item',
        Owner: 'Team',
        Status: 'New',
        Priority: 'Medium',
        'Due Date': new Date().toISOString().slice(0, 10),
        Notes: 'Generated starter record for Table Studio validation.',
      },
    ],
  };
}

async function ensureStarterTableData(params: {
  tableId: string;
  seed: StarterTableSeed;
  actorUserId: string;
}): Promise<void> {
  const metadataService = (await import('../tablePlatform/MetadataService.js')).default;
  const recordsService = (await import('../tablePlatform/RecordsService.js')).default;

  const table = await metadataService.getTable(params.tableId);
  if (!table) {
    throw new Error(`Table Studio materialization table ${params.tableId} was not persisted`);
  }

  const existingFields = Array.isArray((table as any).fields) ? (table as any).fields : [];
  const fieldNames = new Set(
    existingFields
      .map((field: any) =>
        String(field?.name || '')
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
  );

  for (const field of params.seed.fields) {
    const name = field.name.trim();
    if (!name || fieldNames.has(name.toLowerCase())) continue;
    const created = await metadataService.createField(
      params.tableId,
      name,
      field.fieldType || 'singleLineText',
      field.options || {},
      params.actorUserId
    );
    if (created) fieldNames.add(name.toLowerCase());
  }

  for (const record of params.seed.records) {
    await recordsService.createRecord(params.tableId, { ...record }, params.actorUserId);
  }
}

async function assertMaterializedTableReady(params: {
  tableId: string;
  organizationId: string;
}): Promise<void> {
  const ready = await dbGet<{ table_id: string; field_count: number }>(
    `SELECT t.id AS table_id, COUNT(f.id) AS field_count
       FROM tp_tables t
       JOIN tp_bases b ON b.id = t.base_id
       LEFT JOIN tp_fields f ON f.table_id = t.id
      WHERE t.id = ? AND b.organization_id = ?
      GROUP BY t.id
      LIMIT 1`,
    [params.tableId, params.organizationId],
    { fallback: false }
  );
  if (!ready?.table_id) {
    throw new Error(`Table Studio materialization failed: table ${params.tableId} does not exist`);
  }
  if (Number(ready.field_count || 0) < 2) {
    throw new Error(
      `Table Studio materialization failed: table ${params.tableId} has no usable schema`
    );
  }
}

async function getOriginLinkByOrigin(
  organizationId: string,
  originRuntime: string,
  originRecordId: string
): Promise<ArtifactOriginLink | null> {
  const row = await dbGet<OriginLinkRow>(
    `SELECT * FROM v8_artifact_origin_links
     WHERE organization_id = ? AND origin_runtime = ? AND origin_record_id = ?`,
    [organizationId, originRuntime, originRecordId],
    { fallback: true }
  );
  return row ? mapOriginLinkRow(row) : null;
}

export async function hasArtifactOriginLink(params: {
  organizationId: string;
  originRuntime:
    | 'report'
    | 'presentation'
    | 'sheet'
    | 'native_artifact'
    | 'report_template'
    | 'presentation_template';
  originRecordId: string;
}): Promise<boolean> {
  const link = await getOriginLinkByOrigin(
    params.organizationId,
    params.originRuntime,
    params.originRecordId
  );
  return !!link;
}

async function getArtifactRow(
  artifactId: string,
  organizationId: string
): Promise<ArtifactRow | null> {
  return dbGet<ArtifactRow>(
    `SELECT * FROM v8_output_artifacts WHERE artifact_id = ? AND organization_id = ?`,
    [artifactId, organizationId],
    { fallback: true }
  );
}

async function getArtifactRunRow(
  runId: string,
  organizationId: string
): Promise<ArtifactRunRow | null> {
  return dbGet<ArtifactRunRow>(
    `SELECT * FROM v8_artifact_runs WHERE run_id = ? AND organization_id = ?`,
    [runId, organizationId],
    { fallback: true }
  );
}

async function getArtifactRunChildRows(
  runId: string,
  organizationId: string
): Promise<ArtifactRunRow[]> {
  return dbAll<ArtifactRunRow>(
    `SELECT *
     FROM v8_artifact_runs
     WHERE retry_of_run_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [runId, organizationId],
    { fallback: true }
  );
}

async function persistMaterializationOrigin(params: {
  runId: string;
  organizationId: string;
  originRuntime: string;
  originRecordId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await dbRun(
    `UPDATE v8_artifact_runs
     SET materialization_origin_runtime = ?,
         materialization_origin_record_id = ?,
         updated_at = ?
     WHERE run_id = ? AND organization_id = ?`,
    [params.originRuntime, params.originRecordId, now, params.runId, params.organizationId]
  );
}

async function cleanupGhostOutputsByOrigin(params: {
  organizationId: string;
  originRuntime: string;
  originRecordId: string;
}): Promise<{ cleanedUp: boolean; notes: string | null }> {
  const link = await dbGet<OriginLinkRow>(
    `SELECT * FROM v8_artifact_origin_links
     WHERE organization_id = ? AND origin_runtime = ? AND origin_record_id = ?`,
    [params.organizationId, params.originRuntime, params.originRecordId],
    { fallback: true }
  );
  if (!link) return { cleanedUp: false, notes: 'No origin link found to clean up' };

  const artifactId = String(link.artifact_id || '').trim();
  if (!artifactId) return { cleanedUp: false, notes: 'Origin link missing artifact id' };

  // Best-effort cleanup: remove the canonical Outputs artifact envelope so failed runs
  // don't leave "ghost artifacts" in Outputs Library. Underlying runtime records
  // (report/presentation) are not deleted by this bounded guard.
  await dbRun(
    `DELETE FROM v8_artifact_access_grants WHERE organization_id = ? AND artifact_id = ?`,
    [params.organizationId, artifactId]
  );
  await dbRun(`DELETE FROM v8_review_gates WHERE organization_id = ? AND artifact_id = ?`, [
    params.organizationId,
    artifactId,
  ]);
  await dbRun(`DELETE FROM v8_publish_records WHERE organization_id = ? AND artifact_id = ?`, [
    params.organizationId,
    artifactId,
  ]);
  await dbRun(
    `DELETE FROM v8_artifact_origin_links WHERE organization_id = ? AND artifact_id = ?`,
    [params.organizationId, artifactId]
  );
  await dbRun(`DELETE FROM v8_output_artifacts WHERE organization_id = ? AND artifact_id = ?`, [
    params.organizationId,
    artifactId,
  ]);

  return { cleanedUp: true, notes: null };
}

async function mapArtifactRunRowWithEffectiveStatus(
  row: ArtifactRunRow
): Promise<ArtifactRunRecord> {
  const mapped = mapArtifactRunRow(row);
  const spineRun = await executionSpineService.getRun(mapped.executionRunId, mapped.organizationId);
  const effectiveStatus = deriveArtifactRunStatusFromExecutionState({
    persistedStatus: mapped.persistedRunStatus,
    executionState: spineRun?.state,
  });
  return {
    ...mapped,
    effectiveRunStatus: effectiveStatus,
    runStatus: effectiveStatus,
    operationContract: mapped.operationContract
      ? updateOperationContractLinks(
          mapped.operationContract,
          {},
          effectiveStatus === 'awaiting_review'
            ? 'pending_review'
            : effectiveStatus === 'approved_for_apply'
              ? 'approved'
              : effectiveStatus === 'applying'
                ? 'executing'
                : effectiveStatus === 'completed'
                  ? 'completed'
                  : effectiveStatus === 'rejected' || effectiveStatus === 'cancelled'
                    ? 'rejected'
                    : effectiveStatus === 'failed'
                      ? 'failed'
                      : 'proposal_ready'
        )
      : undefined,
  };
}

async function updateArtifactMetadata(
  artifactId: string,
  organizationId: string,
  patch: Partial<RegisterArtifactOriginParams>
): Promise<void> {
  const now = new Date().toISOString();
  await dbRun(
    `UPDATE v8_output_artifacts
     SET artifact_family = COALESCE(?, artifact_family),
         title_snapshot = COALESCE(?, title_snapshot),
         owner_user_id = COALESCE(?, owner_user_id),
         visibility_scope = COALESCE(?, visibility_scope),
         project_id = COALESCE(?, project_id),
         context_snapshot_id = COALESCE(?, context_snapshot_id),
         execution_run_id = COALESCE(?, execution_run_id),
         template_family_ref = COALESCE(?, template_family_ref),
         source_initiative_id = COALESCE(?, source_initiative_id),
         ai_governance_preset_ref = COALESCE(?, ai_governance_preset_ref),
         origin_summary_json = COALESCE(?, origin_summary_json),
         last_transition_at = COALESCE(?, last_transition_at)
     WHERE artifact_id = ? AND organization_id = ?`,
    [
      patch.artifactFamily ?? null,
      patch.titleSnapshot ?? null,
      patch.ownerUserId ?? null,
      patch.visibilityScope ?? null,
      patch.projectId ?? null,
      patch.contextSnapshotId ?? null,
      patch.executionRunId ?? null,
      patch.templateFamilyRef ?? null,
      patch.sourceInitiativeId ?? null,
      patch.aiGovernancePresetRef ?? null,
      patch.originSummary ? JSON.stringify(patch.originSummary) : null,
      now,
      artifactId,
      organizationId,
    ]
  );
}

/**
 * Fetch (and metadata-refresh) the artifact already registered for an origin
 * link. Shared by the fast-path (link found before we ever write) and the
 * race-recovery path in `registerArtifactOrigin` (link found AFTER we lost a
 * concurrent insert race — see the big comment below).
 */
async function adoptExistingArtifactForLink(
  link: ArtifactOriginLink,
  validated: RegisterArtifactOriginParams
): Promise<ArtifactRecord> {
  await updateArtifactMetadata(link.artifactId, validated.organizationId, validated);
  const row = await getArtifactRow(link.artifactId, validated.organizationId);
  if (!row) {
    throw new Error(`Artifact ${link.artifactId} disappeared during origin registration`);
  }
  return mapArtifactRow(row);
}

export async function registerArtifactOrigin(
  params: RegisterArtifactOriginParams
): Promise<ArtifactRecord | null> {
  const validated = RegisterArtifactOriginParamsSchema.parse(params);

  const existingLink = await getOriginLinkByOrigin(
    validated.organizationId,
    validated.originRuntime,
    validated.originRecordId
  );

  if (existingLink) {
    return adoptExistingArtifactForLink(existingLink, validated);
  }

  const artifactId = uuidv4();
  const linkId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_output_artifacts (
      artifact_id, organization_id, output_type, artifact_family, delivery_state,
      title_snapshot, owner_user_id, canonical_home, visibility_scope, project_id,
      context_snapshot_id, execution_run_id, template_family_ref, source_initiative_id,
      ai_governance_preset_ref, origin_summary_json, created_by, created_at, last_transition_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      artifactId,
      validated.organizationId,
      validated.outputType,
      validated.artifactFamily,
      validated.deliveryState,
      validated.titleSnapshot,
      validated.ownerUserId,
      'outputs_library',
      validated.visibilityScope,
      validated.projectId,
      validated.contextSnapshotId,
      validated.executionRunId,
      validated.templateFamilyRef,
      validated.sourceInitiativeId,
      validated.aiGovernancePresetRef,
      validated.originSummary ? JSON.stringify(validated.originSummary) : null,
      validated.createdBy,
      now,
      now,
    ]
  );

  const linkInsertResult = await dbRun(
    `INSERT INTO v8_artifact_origin_links (
      link_id, artifact_id, organization_id, origin_runtime, origin_record_id, is_primary_origin, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      linkId,
      artifactId,
      validated.organizationId,
      validated.originRuntime,
      validated.originRecordId,
      1,
      now,
    ]
  );

  // ── Race-recovery (root-cause fix, 2026-07-26) ──────────────────────────
  // The two inserts above are NOT transactional, and the existence check at
  // the top of this function is a classic TOCTOU: under concurrent calls for
  // the SAME origin key (e.g. two overlapping `backfill*ForOrg` passes, or
  // two horizontally-scaled server replicas handling the same org's Library
  // load at once), several callers can all see "no existing link" before any
  // of them commits, and each proceeds to insert its OWN `v8_output_artifacts`
  // row — which always succeeds, since nothing ties it to the origin key.
  // Only the origin-link insert is protected, by the real DB's
  // `idx_v81_origin_unique (organization_id, origin_runtime, origin_record_id)`
  // constraint — but `DbPromise.run()` defaults to `fallback: true`, which
  // SILENTLY swallows a constraint-violation error (`{success:false}`,
  // no throw, no log) instead of surfacing it. The result, confirmed live on
  // the demo DB (trolley): 180 orphaned `artifact_family='template'` rows
  // (52% of all template artifacts) sharing a title with a correctly-linked
  // sibling but carrying `origin_runtime = NULL` — exactly the duplicate rows
  // in the Template Library described in
  // docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md §7.
  //
  // Fix: after attempting our own insert, re-read whichever origin link is
  // now canonical for this key. If it isn't ours, we lost the race — delete
  // our own now-orphaned rows (safe: this artifact was never returned to any
  // caller) and adopt the winner instead of returning a phantom duplicate.
  const canonicalLink = await getOriginLinkByOrigin(
    validated.organizationId,
    validated.originRuntime,
    validated.originRecordId
  );

  if (canonicalLink && canonicalLink.artifactId !== artifactId) {
    logger.warn(
      `${LOG_PREFIX} Lost registration race for ${validated.originRuntime}:${validated.originRecordId} ` +
        `(ours=${artifactId}, winner=${canonicalLink.artifactId}) — cleaning up our orphan and adopting the winner`
    );
    // Best-effort cleanup of our own losing rows. Never touches the winner's data.
    await dbRun(`DELETE FROM v8_artifact_origin_links WHERE artifact_id = ?`, [artifactId]);
    await dbRun(`DELETE FROM v8_output_artifacts WHERE artifact_id = ? AND organization_id = ?`, [
      artifactId,
      validated.organizationId,
    ]);
    return adoptExistingArtifactForLink(canonicalLink, validated);
  }

  if (!canonicalLink) {
    logger.warn(
      `${LOG_PREFIX} Origin link for ${validated.originRuntime}:${validated.originRecordId} ` +
        `missing after insert (result=${JSON.stringify(linkInsertResult)}) — artifact ${artifactId} ` +
        `may be orphaned; leaving in place for the next reconciliation pass rather than guessing`
    );
  }

  logger.info(
    `${LOG_PREFIX} Registered ${validated.originRuntime}:${validated.originRecordId} as artifact ${artifactId}`
  );

  const row = await getArtifactRow(artifactId, validated.organizationId);
  if (!row) {
    logger.warn(
      `${LOG_PREFIX} Artifact ${artifactId} was not found after registration — DB constraint may have rejected the insert`
    );
    return null;
  }
  const record = mapArtifactRow(row);

  // Fire-and-forget context notification (feature-flagged)
  notifyContextOfNewArtifact(record).catch((err) =>
    logger.warn(`${LOG_PREFIX} notifyContextOfNewArtifact failed: ${err}`)
  );

  return record;
}

/**
 * P-2 (split-brain fix, excele lane): adopt an existing artifact-run's canonical
 * artifact onto a freshly generated real .xlsx workbook, instead of registering a
 * SECOND Outputs card.
 *
 * Background: for the `excele` lane the pipeline first materializes a governed
 * `tp_tables` sheet artifact (so the run can complete), then the frontend calls
 * `POST /api/workbook` which produces the real .xlsx in `generated_workbooks`.
 * Previously the workbook route registered a NEW artifact (origin `sheet:workbookId`),
 * so one click produced two Outputs cards — the tp_tables one being an orphan.
 *
 * This helper re-points the run's existing primary origin link
 * (`sheet:tableId`) to `sheet:workbookId` and refreshes the artifact metadata,
 * yielding exactly ONE canonical Outputs card whose download is the real .xlsx.
 *
 * Returns the adopted artifactId when successful, or `null` when the run has no
 * usable artifact (caller should then fall back to registering a fresh one).
 * Fail-soft: never throws — the workbook itself is already persisted.
 */
export async function adoptRunArtifactForWorkbook(params: {
  runId: string;
  organizationId: string;
  workbookId: string;
  title: string;
  originSummary?: Record<string, unknown>;
}): Promise<string | null> {
  try {
    const run = await getArtifactRun(params.runId, params.organizationId);
    if (!run) {
      logger.warn(
        `${LOG_PREFIX} adoptRunArtifactForWorkbook: run ${params.runId} not found (org ${params.organizationId})`
      );
      return null;
    }
    // Only sheet runs are adoptable by the workbook route.
    if (run.plan.outputType !== 'sheet') {
      logger.warn(
        `${LOG_PREFIX} adoptRunArtifactForWorkbook: run ${params.runId} is ${run.plan.outputType}, not sheet — skipping adoption`
      );
      return null;
    }
    const artifactId = run.artifactId;
    if (!artifactId) {
      // Run not yet materialized / no artifact — caller registers fresh.
      return null;
    }

    // If a workbook origin link already exists on this artifact, we're idempotent.
    const links = await getArtifactOriginLinks(artifactId, params.organizationId);
    const alreadyWorkbook = links.some(
      (l) => l.originRuntime === 'sheet' && l.originRecordId === params.workbookId
    );

    if (!alreadyWorkbook) {
      const now = new Date().toISOString();
      // Re-point the primary origin link to the real workbook.
      const primary = links.find((l) => l.isPrimaryOrigin) || links[0] || null;
      if (primary) {
        await dbRun(
          `UPDATE v8_artifact_origin_links
             SET origin_runtime = 'sheet',
                 origin_record_id = ?
           WHERE link_id = ? AND organization_id = ?`,
          [params.workbookId, primary.linkId, params.organizationId]
        );
      } else {
        // Defensive: artifact row exists but has no origin link — create the primary.
        await dbRun(
          `INSERT INTO v8_artifact_origin_links (
            link_id, artifact_id, organization_id, origin_runtime, origin_record_id, is_primary_origin, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), artifactId, params.organizationId, 'sheet', params.workbookId, 1, now]
        );
      }
    }

    // Refresh title + summary so the single Outputs card reflects the real workbook.
    await updateArtifactMetadata(artifactId, params.organizationId, {
      titleSnapshot: params.title || run.plan.titleHint,
      originSummary: params.originSummary,
    });

    logger.info(
      `${LOG_PREFIX} adoptRunArtifactForWorkbook: artifact ${artifactId} adopted workbook ${params.workbookId} for run ${params.runId} (no second card)`
    );
    return artifactId;
  } catch (err) {
    logger.warn(
      `${LOG_PREFIX} adoptRunArtifactForWorkbook failed for run ${params.runId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return null;
  }
}

/**
 * Notify the organization context that a new artifact was produced.
 * Gated behind the 'outputs' feature flag to allow incremental rollout.
 * On success, logs the action; on failure, swallows and logs (non-critical path).
 */
export async function notifyContextOfNewArtifact(artifact: ArtifactRecord): Promise<void> {
  try {
    const enabled = await isV8Enabled(artifact.organizationId, 'outputs');
    if (!enabled) return;

    logger.info(
      `${LOG_PREFIX} Context notification: artifact ${artifact.artifactId} ` +
        `(${artifact.artifactFamily}/${artifact.outputType}) registered for org ${artifact.organizationId}`
    );
  } catch (err) {
    logger.warn(`${LOG_PREFIX} notifyContextOfNewArtifact error: ${err}`);
  }
}

/**
 * Return the most recent artifact refs for an organization, suitable for
 * auto-suggesting artifactRefs in chat snapshots.
 * Feature-flagged behind 'outputs' module.
 */
export async function getRecentArtifactRefsForOrg(
  organizationId: string,
  limit = 10
): Promise<Array<{ artifactId: string; outputType: string; title: string; createdAt: string }>> {
  const enabled = await isV8Enabled(organizationId, 'outputs');
  if (!enabled) return [];

  const rows = await dbAll(
    `SELECT artifact_id, output_type, title_snapshot, created_at
     FROM v8_output_artifacts
     WHERE organization_id = ?
       AND delivery_state NOT IN ('cancelled', 'archived')
     ORDER BY created_at DESC
     LIMIT ?`,
    [organizationId, limit]
  );

  return (rows as any[]).map((r) => ({
    artifactId: r.artifact_id,
    outputType: r.output_type,
    title: r.title_snapshot ?? '',
    createdAt: r.created_at,
  }));
}

export async function createArtifactAccessGrant(
  params: CreateArtifactAccessGrantParams
): Promise<ArtifactAccessGrant> {
  const validated = CreateArtifactAccessGrantParamsSchema.parse(params);
  const grantId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_artifact_access_grants (
      grant_id, artifact_id, organization_id, grant_kind, user_id, role_key, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      grantId,
      validated.artifactId,
      validated.organizationId,
      validated.grantKind,
      validated.userId,
      validated.roleKey,
      validated.createdBy,
      now,
    ]
  );

  const row = await dbGet<AccessGrantRow>(
    `SELECT * FROM v8_artifact_access_grants WHERE grant_id = ?`,
    [grantId],
    { fallback: true }
  );
  if (!row) throw new Error(`Access grant ${grantId} not found after creation`);
  return mapAccessGrantRow(row);
}

export async function startArtifactReview(params: {
  artifactId: string;
  organizationId: string;
  actorUserId: string;
  reviewers?: string[];
}): Promise<{
  artifactId: string;
  visibilityScope: ArtifactVisibilityScope;
  publishState: string;
  reviewers: string[];
}> {
  const artifact = await getArtifactRow(params.artifactId, params.organizationId);
  if (!artifact) {
    throw new Error(
      `Artifact ${params.artifactId} not found in organization ${params.organizationId}`
    );
  }

  const executionRun = artifact.execution_run_id
    ? await executionSpineService.getRun(artifact.execution_run_id, params.organizationId)
    : null;
  const validation = deriveArtifactValidationSnapshot({
    artifact: mapArtifactRow(artifact),
    executionState: executionRun?.state,
  });
  if (validation.state !== 'validated') {
    throw new Error(
      `Artifact ${params.artifactId} cannot enter review before artifact validation passes`
    );
  }

  let record = await publishReviewService.getPublishRecord(
    params.artifactId,
    params.organizationId
  );
  if (!record) {
    const typeMapping = mapCanonicalArtifactType({
      artifactFamily:
        artifact.artifact_family ||
        (artifact.output_type === 'report' ? 'document' : artifact.output_type),
      outputType: artifact.output_type,
    });
    record = await publishReviewService.createPublishRecord({
      artifactId: params.artifactId,
      artifactType: typeMapping.publishArtifactType,
      organizationId: params.organizationId,
      publishedBy: params.actorUserId,
      reviewers: params.reviewers || [],
    });
  }

  if (record.currentState === 'private_draft') {
    record = await publishReviewService.transitionPublishState({
      recordId: record.recordId,
      organizationId: params.organizationId,
      newState: 'reviewable_share',
      actor: params.actorUserId,
    });
  }

  await updateArtifactMetadata(params.artifactId, params.organizationId, {
    visibilityScope: 'review_shared',
  });

  logger.info(
    `${LOG_PREFIX} Started review for artifact ${params.artifactId} (state=${record.currentState})`
  );

  return {
    artifactId: params.artifactId,
    visibilityScope: 'review_shared',
    publishState: record.currentState,
    reviewers: record.reviewers,
  };
}

export async function getArtifactOriginLinks(
  artifactId: string,
  organizationId: string
): Promise<ArtifactOriginLink[]> {
  const rows = await dbAll<OriginLinkRow>(
    `SELECT * FROM v8_artifact_origin_links
     WHERE artifact_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [artifactId, organizationId],
    { fallback: true }
  );
  return (rows || []).map(mapOriginLinkRow);
}

/**
 * Adds a secondary (non-primary) origin link from an artifact to a related artifact.
 * Used to create back-links (e.g. report → source template artifact).
 */
export async function addSecondaryOriginLink(params: {
  artifactId: string;
  organizationId: string;
  originRuntime: string;
  originRecordId: string;
}): Promise<void> {
  const existing = await dbGet<OriginLinkRow>(
    `SELECT link_id FROM v8_artifact_origin_links
     WHERE artifact_id = ? AND organization_id = ? AND origin_runtime = ? AND origin_record_id = ?`,
    [params.artifactId, params.organizationId, params.originRuntime, params.originRecordId],
    { fallback: true }
  );
  if (existing) return;

  const linkId = crypto.randomUUID();
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO v8_artifact_origin_links (
      link_id, artifact_id, organization_id, origin_runtime, origin_record_id, is_primary_origin, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      linkId,
      params.artifactId,
      params.organizationId,
      params.originRuntime,
      params.originRecordId,
      0,
      now,
    ]
  );
}

/**
 * Counts outputs (reports/presentations) that were derived from a given template artifact.
 * Uses the secondary origin link (source_template) created during generation.
 */
export async function countTemplateUsage(
  templateArtifactId: string,
  organizationId: string
): Promise<number> {
  const row = await dbGet<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM v8_artifact_origin_links
     WHERE organization_id = ? AND origin_runtime = 'source_template' AND origin_record_id = ?`,
    [organizationId, templateArtifactId],
    { fallback: true }
  );
  return row?.cnt || 0;
}

export async function getArtifactAccessGrantsForArtifact(
  artifactId: string,
  organizationId: string
): Promise<ArtifactAccessGrant[]> {
  const rows = await dbAll<AccessGrantRow>(
    `SELECT * FROM v8_artifact_access_grants
     WHERE artifact_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [artifactId, organizationId],
    { fallback: true }
  );
  return (rows || []).map(mapAccessGrantRow);
}

async function backfillReportsForOrg(organizationId: string): Promise<number> {
  const rows = await dbAll<ReportBackfillRow>(
    `SELECT r.id, r.title, r.status, r.report_type, r.project_id, r.created_by, r.created_at, r.updated_at,
            r.source_id, r.source_refs_json
     FROM report_builder_reports r
     LEFT JOIN v8_artifact_origin_links l
       ON l.organization_id = r.organization_id
      AND l.origin_runtime = 'report'
      AND l.origin_record_id = r.id
     WHERE r.organization_id = ?
       AND l.link_id IS NULL`,
    [organizationId],
    { fallback: true }
  );

  let inserted = 0;
  for (const row of rows || []) {
    try {
      const result = await registerArtifactOrigin({
        organizationId,
        outputType: 'report',
        artifactFamily: 'document',
        originRuntime: 'report',
        originRecordId: row.id,
        titleSnapshot: row.title || 'Untitled report',
        ownerUserId: row.created_by || null,
        createdBy: row.created_by || FALLBACK_ACTOR,
        deliveryState: mapReportStatusToDeliveryState(row.status),
        visibilityScope: deriveArtifactVisibilityScope({
          outputType: 'report',
          projectId: row.project_id,
          ownerUserId: row.created_by || null,
          isBackfill: true,
        }),
        projectId: row.project_id || null,
        originSummary: {
          reportType: row.report_type,
          sourceId: row.source_id,
          sourceRefs: safeJsonParse(row.source_refs_json, [] as unknown[]),
          nativeStatus: row.status,
          sourceTable: 'report_builder_reports',
        },
      });
      if (result) inserted++;
    } catch (err: any) {
      logger.warn(`${LOG_PREFIX} Failed to backfill report ${row.id}: ${err?.message}`);
    }
  }
  return inserted;
}

async function backfillPresentationsForOrg(organizationId: string): Promise<number> {
  const rows = await dbAll<PresentationBackfillRow>(
    `SELECT d.id, d.title, d.status, d.deck_type, d.presentation_mode, d.slide_count,
            d.export_format, d.generated_by, d.created_at, d.updated_at, d.source_id,
            COALESCE(d.source_artifacts, '[]') AS source_refs_json
     FROM presentation_decks d
     LEFT JOIN v8_artifact_origin_links l
       ON l.organization_id = d.organization_id
      AND l.origin_runtime = 'presentation'
      AND l.origin_record_id = d.id
     WHERE d.organization_id = ?
       AND l.link_id IS NULL`,
    [organizationId],
    { fallback: true }
  );

  let inserted = 0;
  for (const row of rows || []) {
    try {
      const ownerUserId = row.generated_by || null;
      const result = await registerArtifactOrigin({
        organizationId,
        outputType: 'presentation',
        artifactFamily: 'presentation',
        originRuntime: 'presentation',
        originRecordId: row.id,
        titleSnapshot: row.title || 'Untitled presentation',
        ownerUserId,
        createdBy: ownerUserId || FALLBACK_ACTOR,
        deliveryState: mapPresentationStatusToDeliveryState(row.status),
        // Backfill must never create inaccessible private artifacts without an owner.
        visibilityScope: ownerUserId ? 'private' : 'organization',
        originSummary: {
          deckType: row.deck_type,
          presentationMode: row.presentation_mode,
          slideCount: row.slide_count,
          exportFormat: row.export_format,
          sourceId: row.source_id,
          sourceRefs: safeJsonParse(row.source_refs_json, [] as unknown[]),
          nativeStatus: row.status,
          sourceTable: 'presentation_decks',
        },
      });
      if (result) inserted++;
    } catch (err: any) {
      logger.warn(`${LOG_PREFIX} Failed to backfill presentation ${row.id}: ${err?.message}`);
    }
  }
  return inserted;
}

/**
 * Index Document Studio native artifacts — actual generated DOCUMENTS
 * (`wave5_artifacts`, `materializeDocumentArtifact` /
 * `documentStudioService.ts`), as opposed to `backfillDocStudioTemplatesForOrg`
 * above which indexes the reusable TEMPLATES.
 *
 * Gap closed (rejestr, fala sprzątania 1b, 2026-07-27): unlike
 * `report_builder_reports` (backfillReportsForOrg) and `presentation_decks`
 * (backfillPresentationsForOrg), documents materialized via Document Studio
 * had NO reconciliation safety net — `registerGeneratedDocumentOrigin`
 * (server/src/routes/document-studio.routes.ts) registers them at creation
 * time, but that registration is fire-and-forget/best-effort (now retried,
 * see `retryWithBackoff` there); if it still failed after retries, the
 * document existed durably in `wave5_artifacts` but had no way to ever
 * surface in the Outputs Library. This closes that gap the same way the
 * report/presentation/template backfills already do.
 *
 * `wave5_artifacts` is a SHARED table (also used by `researchSessionService.ts`
 * and the generic `POST /api/artifacts/wave5` route with an
 * arbitrary/client-supplied `artifact_type`), so this can't just filter on
 * `artifact_type = 'report'` — that value is not unique to Document Studio.
 * Document Studio stamps every artifact's `provenance_json.metadata` with a
 * `documentStudioSchema` key (`SCHEMA_METADATA_KEY` in
 * `documentStudio/documentStudioService.ts`) that no other wave5 producer
 * sets; the substring match below is the same distinguishing signal, kept
 * portable (the column is plain TEXT, not jsonb) rather than a JSON operator.
 *
 * Idempotent: the LEFT JOIN + `l.link_id IS NULL` guard means an already
 * indexed artifact is skipped, so repeated runs insert nothing. Never deletes.
 */
async function backfillNativeArtifactsForOrg(organizationId: string): Promise<number> {
  const rows = await dbAll<NativeArtifactBackfillRow>(
    `SELECT a.artifact_id, a.title, a.status, a.project_id, a.created_by, a.created_at, a.updated_at,
            a.provenance_json
     FROM wave5_artifacts a
     LEFT JOIN v8_artifact_origin_links l
       ON l.organization_id = a.organization_id
      AND l.origin_runtime = 'native_artifact'
      AND l.origin_record_id = a.artifact_id
     WHERE a.organization_id = ?
       AND a.artifact_type = 'report'
       AND a.provenance_json LIKE '%"documentStudioSchema"%'
       AND l.link_id IS NULL`,
    [organizationId],
    { fallback: true }
  );

  let inserted = 0;
  for (const row of rows || []) {
    try {
      let templateId: string | null = null;
      try {
        const provenance = row.provenance_json ? JSON.parse(row.provenance_json) : null;
        const meta = provenance && typeof provenance === 'object' ? provenance.metadata : null;
        const rawTemplateId =
          meta && typeof meta === 'object' ? meta.documentStudioTemplateId : null;
        templateId = typeof rawTemplateId === 'string' && rawTemplateId ? rawTemplateId : null;
      } catch {
        templateId = null;
      }

      const result = await registerArtifactOrigin({
        organizationId,
        outputType: 'report',
        artifactFamily: 'document',
        originRuntime: 'native_artifact',
        originRecordId: row.artifact_id,
        titleSnapshot: row.title || 'Untitled document',
        ownerUserId: row.created_by || null,
        createdBy: row.created_by || FALLBACK_ACTOR,
        deliveryState: mapReportStatusToDeliveryState(row.status),
        visibilityScope: deriveArtifactVisibilityScope({
          outputType: 'report',
          projectId: row.project_id,
          ownerUserId: row.created_by || null,
          isBackfill: true,
        }),
        projectId: row.project_id || null,
        originSummary: {
          sourceType: 'document_studio',
          templateId,
          sourceTable: 'wave5_artifacts',
          nativeStatus: row.status,
        },
      });
      if (result) inserted++;
    } catch (err: any) {
      logger.warn(
        `${LOG_PREFIX} Failed to backfill native document artifact ${row.artifact_id}: ${err?.message}`
      );
    }
  }
  return inserted;
}

async function backfillReportTemplatesForOrg(organizationId: string): Promise<number> {
  const rows = await dbAll<ReportTemplateBackfillRow>(
    `SELECT t.id, t.organization_id, t.name, t.description, t.report_type, t.sections_json,
            t.is_system, t.is_active, t.created_by, t.created_at, t.updated_at
     FROM report_builder_templates t
     LEFT JOIN v8_artifact_origin_links l
       ON l.organization_id = ?
      AND l.origin_runtime = 'report_template'
      AND l.origin_record_id = t.id
     WHERE (t.organization_id IS NULL OR t.organization_id = ?)
       AND (t.is_active IS NULL OR t.is_active = TRUE)
       AND l.link_id IS NULL`,
    [organizationId, organizationId],
    { fallback: true }
  );

  let inserted = 0;
  for (const row of rows || []) {
    try {
      const sections = safeJsonParse(row.sections_json, [] as any[]);
      const result = await registerArtifactOrigin({
        organizationId,
        outputType: 'report',
        artifactFamily: 'template',
        originRuntime: 'report_template',
        originRecordId: row.id,
        titleSnapshot: row.name || 'Untitled report template',
        ownerUserId: null,
        createdBy: row.created_by || FALLBACK_ACTOR,
        deliveryState: 'ready',
        visibilityScope: 'organization',
        originSummary: {
          template: {
            // R11: locked identity block (canonicalTemplateId / originRuntime /
            // source / legacy / orphaned / scope / status). `report_template`
            // has no status column — `is_active` is the only lifecycle signal.
            ...buildTemplateOriginSummaryFields({
              canonicalTemplateId: row.id,
              originRuntime: 'report_template',
              orphaned: false,
              scope: deriveTemplateScope(row),
              status: toBool(row.is_active) === false ? 'deprecated' : 'published',
            }),
            description: row.description || '',
            reportType: row.report_type || 'custom',
            structureBlueprint: {
              sections: Array.isArray(sections)
                ? sections.map((s: any) => ({
                    key: s?.key || s?.sectionKey || s?.section_key || s?.id || '',
                    title: s?.title || s?.name || '',
                  }))
                : [],
            },
            metadata: {
              createdBy: row.created_by || FALLBACK_ACTOR,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              legacyTemplateId: row.id,
            },
          },
        },
      });
      if (result) inserted++;
    } catch (err: any) {
      logger.warn(`${LOG_PREFIX} Failed to backfill report template ${row.id}: ${err?.message}`);
    }
  }
  return inserted;
}

async function backfillPresentationTemplatesForOrg(organizationId: string): Promise<number> {
  const rows = await dbAll<PresentationTemplateBackfillRow>(
    `SELECT t.id, t.organization_id, t.name, t.description, t.deck_type, t.outline_json,
            t.is_system, t.is_active, t.created_by, t.created_at, t.updated_at
     FROM presentation_templates t
     LEFT JOIN v8_artifact_origin_links l
       ON l.organization_id = ?
      AND l.origin_runtime = 'presentation_template'
      AND l.origin_record_id = t.id
     WHERE (t.organization_id IS NULL OR t.organization_id = ?)
       AND (t.is_active IS NULL OR t.is_active = TRUE)
       AND l.link_id IS NULL`,
    [organizationId, organizationId],
    { fallback: true }
  );

  let inserted = 0;
  for (const row of rows || []) {
    try {
      const outline = safeJsonParse(row.outline_json, [] as any[]);
      const result = await registerArtifactOrigin({
        organizationId,
        outputType: 'presentation',
        artifactFamily: 'template',
        originRuntime: 'presentation_template',
        originRecordId: row.id,
        titleSnapshot: row.name || 'Untitled presentation template',
        ownerUserId: null,
        createdBy: row.created_by || FALLBACK_ACTOR,
        deliveryState: 'ready',
        visibilityScope: 'organization',
        originSummary: {
          template: {
            // R11: locked identity block. `presentation_templates` likewise has
            // no status column — `is_active` is the lifecycle signal.
            ...buildTemplateOriginSummaryFields({
              canonicalTemplateId: row.id,
              originRuntime: 'presentation_template',
              orphaned: false,
              scope: deriveTemplateScope(row),
              status: toBool(row.is_active) === false ? 'deprecated' : 'published',
            }),
            description: row.description || '',
            deckType: row.deck_type || 'custom',
            structureBlueprint: {
              outline: Array.isArray(outline) ? outline : [],
            },
            metadata: {
              createdBy: row.created_by || FALLBACK_ACTOR,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              legacyTemplateId: row.id,
            },
          },
        },
      });
      if (result) inserted++;
    } catch (err: any) {
      logger.warn(
        `${LOG_PREFIX} Failed to backfill presentation template ${row.id}: ${err?.message}`
      );
    }
  }
  return inserted;
}

// =============================================================================
// R11 (doc slice) — Document Studio templates in the Template Library index
// =============================================================================

/**
 * JSONB columns come back as a parsed object/array under Postgres and as TEXT
 * under SQLite. `safeJsonParse` only handles the string case.
 */
function parseMaybeJsonArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw === null || raw === undefined) return [];
  if (typeof raw === 'string') return safeJsonParse<unknown[]>(raw, []);
  return [];
}

/**
 * Build the locked `originSummary.template` identity block. Every field is
 * REAL: `scope` / `status` come from the source row, `orphaned` from an
 * existence check against the canonical registry. Missing signal → `'unknown'`,
 * never a flattering default.
 */
export function buildTemplateOriginSummaryFields(params: {
  canonicalTemplateId: string;
  originRuntime: TemplateOriginRuntime;
  orphaned: boolean;
  scope: TemplateScope;
  status: TemplateStatus;
}): TemplateOriginSummaryFields {
  const source = templateSourceForRuntime(params.originRuntime);
  return {
    canonicalTemplateId: params.canonicalTemplateId,
    originRuntime: params.originRuntime,
    source,
    legacy: source === 'legacy',
    orphaned: params.orphaned,
    scope: params.scope,
    status: params.status,
  };
}

/**
 * Index the Document Studio templates that are visible to `organizationId`.
 *
 * Visibility mirrors `documentTemplateRegistryDao.loadTemplatesForOrg`: the org's
 * own rows (ANY lifecycle status) plus the system catalogue seeded under the
 * `__system__` sentinel org with `is_system = TRUE`.
 *
 * ★ Fix 2026-07-28 (owner report: "New template" never surfaces what I already
 * prepared): this query used to additionally require `t.status = 'approved'`,
 * which does NOT mirror `loadTemplatesForOrg` (that DAO returns every status).
 * Every freshly-drafted document template starts life as `draft` — excluding
 * drafts here meant a user's own in-progress template NEVER appeared in the
 * Materiały → Szablony library, and the row-level "Submit for review" action
 * (which promotes draft → approved) only renders for rows already visible in
 * that same list — a dead end with no UI path out. Presentation templates
 * (`backfillPresentationTemplatesForOrg` above) never had this restriction —
 * their drafts show up with a working "Submit for review" today. Dropping the
 * status filter here makes Word/document templates behave the same way.
 *
 * Idempotent: the LEFT JOIN + `l.link_id IS NULL` guard means an already indexed
 * template is skipped, so repeated runs insert nothing. Never deletes.
 */
async function backfillDocStudioTemplatesForOrg(organizationId: string): Promise<number> {
  const rows = await dbAll<DocStudioTemplateBackfillRow>(
    `SELECT t.template_id, t.organization_id, t.name, t.purpose, t.category, t.document_type,
            t.section_blueprint, t.status, t.version, t.is_system, t.created_by,
            t.created_at, t.updated_at
     FROM document_studio_templates t
     LEFT JOIN v8_artifact_origin_links l
       ON l.organization_id = ?
      AND l.origin_runtime = 'document_template'
      AND l.origin_record_id = t.template_id
     WHERE (t.organization_id = ? OR (t.organization_id = ? AND t.is_system = TRUE))
       AND l.link_id IS NULL`,
    [organizationId, organizationId, DOC_STUDIO_SYSTEM_ORG_ID],
    { fallback: true }
  );

  let inserted = 0;
  for (const row of rows || []) {
    try {
      const blueprint = parseMaybeJsonArray(row.section_blueprint);
      const scope = deriveTemplateScope(row);
      const status = normalizeTemplateStatus(row.status);
      const result = await registerArtifactOrigin({
        organizationId,
        // Documents live under the `report` output type (see mapArtifactRow:
        // anything that is not presentation/sheet infers the `document` family).
        outputType: 'report',
        artifactFamily: 'template',
        originRuntime: 'document_template',
        originRecordId: row.template_id,
        titleSnapshot: row.name || 'Untitled document template',
        ownerUserId: null,
        createdBy: row.created_by || FALLBACK_ACTOR,
        deliveryState: 'ready',
        visibilityScope: 'organization',
        originSummary: {
          template: {
            ...buildTemplateOriginSummaryFields({
              canonicalTemplateId: row.template_id,
              originRuntime: 'document_template',
              orphaned: false,
              scope,
              status,
            }),
            description: row.purpose || '',
            documentType: row.document_type || 'custom',
            category: row.category || 'custom',
            structureBlueprint: {
              sections: blueprint.map((section: any) => ({
                key:
                  section?.key || section?.sectionKey || section?.section_key || section?.id || '',
                title: section?.title || section?.name || '',
              })),
            },
            metadata: {
              createdBy: row.created_by || FALLBACK_ACTOR,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              version: row.version || null,
              canonicalTemplateId: row.template_id,
            },
          },
        },
      });
      if (result) inserted++;
    } catch (err: any) {
      logger.warn(
        `${LOG_PREFIX} Failed to backfill document template ${row.template_id}: ${err?.message}`
      );
    }
  }
  return inserted;
}

/**
 * Per-runtime description of the canonical registry a template link points at.
 * `null` = no canonical registry exists for that runtime (the seeded
 * `sheet_template` cards are artifact-native), so orphan state is NOT decidable
 * and we must not guess.
 */
const TEMPLATE_CANONICAL_REGISTRY: Record<
  TemplateOriginRuntime,
  {
    table: string;
    idColumn: string;
    statusColumn: string | null;
    activeColumn: string | null;
  } | null
> = {
  document_template: {
    table: 'document_studio_templates',
    idColumn: 'template_id',
    statusColumn: 'status',
    activeColumn: null,
  },
  report_template: {
    table: 'report_builder_templates',
    idColumn: 'id',
    statusColumn: null,
    activeColumn: 'is_active',
  },
  presentation_template: {
    table: 'presentation_templates',
    idColumn: 'id',
    statusColumn: null,
    activeColumn: 'is_active',
  },
  sheet_template: null,
};

interface CanonicalTemplateRow {
  canonical_id: string;
  organization_id: string | null;
  is_system: unknown;
  status_value: string | null;
  active_value: unknown;
}

/**
 * Bulk-load the canonical rows behind a set of template ids. Read-only.
 * Returns a map keyed by canonical id; ids absent from the map are ORPHANED.
 * `null` means the runtime has no canonical registry to check against.
 */
async function loadCanonicalTemplateRows(
  originRuntime: TemplateOriginRuntime,
  ids: string[]
): Promise<Map<string, CanonicalTemplateRow> | null> {
  const registry = TEMPLATE_CANONICAL_REGISTRY[originRuntime];
  if (!registry) return null;
  const unique = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.length > 0)));
  if (unique.length === 0) return new Map();

  const placeholders = unique.map(() => '?').join(', ');
  const statusSelect = registry.statusColumn ? `t.${registry.statusColumn}` : 'NULL';
  const activeSelect = registry.activeColumn ? `t.${registry.activeColumn}` : 'NULL';

  const rows = await dbAll<CanonicalTemplateRow>(
    `SELECT t.${registry.idColumn} AS canonical_id,
            t.organization_id AS organization_id,
            t.is_system AS is_system,
            ${statusSelect} AS status_value,
            ${activeSelect} AS active_value
     FROM ${registry.table} t
     WHERE t.${registry.idColumn} IN (${placeholders})`,
    unique,
    { fallback: true }
  );

  const map = new Map<string, CanonicalTemplateRow>();
  for (const row of rows || []) {
    if (row?.canonical_id) map.set(String(row.canonical_id), row);
  }
  return map;
}

/** Lifecycle status of a canonical row, honouring the per-registry signal. */
function statusFromCanonicalRow(
  originRuntime: TemplateOriginRuntime,
  row: CanonicalTemplateRow
): TemplateStatus {
  const registry = TEMPLATE_CANONICAL_REGISTRY[originRuntime];
  if (registry?.statusColumn) return normalizeTemplateStatus(row.status_value);
  if (registry?.activeColumn) {
    const active = toBool(row.active_value);
    if (active === false) return 'deprecated';
    if (active === true) return 'published';
  }
  return 'unknown';
}

/**
 * READ-TIME enrichment of `originSummary.template` for template list items.
 *
 * Two things the write-time snapshot cannot know: (a) whether the canonical
 * record still exists (orphan detection), (b) whether scope/status drifted
 * since indexing. Both are recomputed here from the canonical registries.
 *
 * ★ Strictly read-only: NOTHING is deleted or updated in the database, and the
 * input items are not mutated (fresh objects are returned).
 */
export async function enrichTemplateOriginSummaries(
  organizationId: string,
  items: ArtifactListItem[]
): Promise<ArtifactListItem[]> {
  const byRuntime = new Map<TemplateOriginRuntime, string[]>();
  for (const item of items) {
    if (item.artifactFamily !== 'template') continue;
    if (!isTemplateOriginRuntime(item.originRuntime)) continue;
    if (!item.originRecordId) continue;
    const bucket = byRuntime.get(item.originRuntime) ?? [];
    bucket.push(item.originRecordId);
    byRuntime.set(item.originRuntime, bucket);
  }
  if (byRuntime.size === 0) return items;

  const loaded = new Map<TemplateOriginRuntime, Map<string, CanonicalTemplateRow> | null>();
  await Promise.all(
    Array.from(byRuntime.entries()).map(async ([runtime, ids]) => {
      try {
        loaded.set(runtime, await loadCanonicalTemplateRows(runtime, ids));
      } catch (err: any) {
        // Unknown orphan state is better than a false "orphaned" badge.
        logger.warn(
          `${LOG_PREFIX} Orphan probe failed for ${runtime} in org ${organizationId}: ${err?.message}`
        );
        loaded.set(runtime, null);
      }
    })
  );

  return items.map((item) => {
    if (item.artifactFamily !== 'template') return item;
    if (!isTemplateOriginRuntime(item.originRuntime) || !item.originRecordId) return item;

    const canonicalRows = loaded.get(item.originRuntime);
    const canonicalRow = canonicalRows ? canonicalRows.get(item.originRecordId) : undefined;
    // No registry to check against (sheet_template) or the probe failed →
    // orphan state is unknown, so we do NOT flag it.
    const orphaned = canonicalRows ? !canonicalRow : false;

    const snapshot = (item.originSummary?.template ?? {}) as Record<string, unknown>;
    const scope = canonicalRow
      ? deriveTemplateScope(canonicalRow)
      : normalizeTemplateScope(snapshot.scope);
    const status = canonicalRow
      ? statusFromCanonicalRow(item.originRuntime, canonicalRow)
      : normalizeTemplateStatus(snapshot.status);

    return {
      ...item,
      originSummary: {
        ...(item.originSummary ?? {}),
        template: {
          ...snapshot,
          ...buildTemplateOriginSummaryFields({
            canonicalTemplateId: item.originRecordId,
            originRuntime: item.originRuntime,
            orphaned,
            scope,
            status,
          }),
        },
      },
    };
  });
}

export interface OrphanedTemplateLinkCounts {
  total: number;
  byRuntime: Record<TemplateOriginRuntime, number>;
  /** Runtimes with no canonical registry to verify against (not counted). */
  unverifiable: TemplateOriginRuntime[];
}

/**
 * MEASURE orphaned template origin links for an organization — telemetry only.
 *
 * ★ Read-only by design: this function performs SELECTs exclusively. It never
 * issues DELETE or UPDATE against `v8_artifact_origin_links` (or anything else).
 * Cleaning up orphans is a separate, deliberate decision — measuring first.
 */
export async function countOrphanedTemplateLinks(
  organizationId: string
): Promise<OrphanedTemplateLinkCounts> {
  const byRuntime: Record<TemplateOriginRuntime, number> = {
    document_template: 0,
    report_template: 0,
    presentation_template: 0,
    sheet_template: 0,
  };
  const unverifiable: TemplateOriginRuntime[] = [];

  const runtimePlaceholders = TEMPLATE_ORIGIN_RUNTIMES.map(() => '?').join(', ');
  const links = await dbAll<{ origin_runtime: string; origin_record_id: string }>(
    `SELECT origin_runtime, origin_record_id
       FROM v8_artifact_origin_links
      WHERE organization_id = ?
        AND origin_runtime IN (${runtimePlaceholders})`,
    [organizationId, ...TEMPLATE_ORIGIN_RUNTIMES],
    { fallback: true }
  );

  const grouped = new Map<TemplateOriginRuntime, string[]>();
  for (const link of links || []) {
    if (!isTemplateOriginRuntime(link.origin_runtime) || !link.origin_record_id) continue;
    const bucket = grouped.get(link.origin_runtime) ?? [];
    bucket.push(String(link.origin_record_id));
    grouped.set(link.origin_runtime, bucket);
  }

  for (const [runtime, ids] of grouped.entries()) {
    const canonicalRows = await loadCanonicalTemplateRows(runtime, ids);
    if (!canonicalRows) {
      unverifiable.push(runtime);
      continue;
    }
    byRuntime[runtime] = ids.filter((id) => !canonicalRows.has(id)).length;
  }

  const total = TEMPLATE_ORIGIN_RUNTIMES.reduce((sum, runtime) => sum + byRuntime[runtime], 0);
  return { total, byRuntime, unverifiable };
}

/**
 * S6.3 — M17 junk filter. A title matches the draft heuristic when it carries a
 * marker of test/throwaway scaffolding. Used by both the SQL backfill (migration)
 * and the runtime guard below so the two stay in lockstep. Pure, side-effect free.
 */
const DRAFT_TITLE_MARKERS = ['e2e', 'throwaway', 'probe', 'smoke', 'toreport-'] as const;

export function isDraftHeuristicTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const lower = String(title).toLowerCase();
  if (DRAFT_TITLE_MARKERS.some((marker) => lower.includes(marker))) return true;
  // Whole-word "test" (avoid false positives like "attestation" / "latest").
  return /\btest\b/.test(lower);
}

// Guards the one-time (per-process) DDL ensure so we don't hammer ALTER TABLE.
let draftColumnEnsured = false;

/**
 * Defensive runtime guard: ensure the `is_draft` column exists and (re)apply the
 * heuristic backfill for this org. This makes the M17 junk filter work even on a
 * DB where migration 20260702_v81_artifact_draft_flag.sql has not been applied
 * yet (e.g. live demo/staging between deploys). All statements are idempotent and
 * NEVER delete data — they only flip the presentational is_draft flag.
 */
async function ensureDraftFlagForOrg(organizationId: string): Promise<void> {
  if (!draftColumnEnsured) {
    try {
      await dbRun(
        `ALTER TABLE v8_output_artifacts ADD COLUMN IF NOT EXISTS is_draft INTEGER NOT NULL DEFAULT 0`,
        []
      );
      draftColumnEnsured = true;
    } catch (err: any) {
      // "duplicate column" on engines without IF NOT EXISTS support → treat as present.
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('duplicate column') || msg.includes('already exists')) {
        draftColumnEnsured = true;
      } else {
        logger.warn(`${LOG_PREFIX} ensureDraftFlag ADD COLUMN failed: ${err?.message}`);
        return; // column may be missing; skip backfill this pass, retry next TTL window
      }
    }
  }

  // Heuristic backfill for THIS org. Joins report/deck titles so junk whose
  // artifact title_snapshot is generic (e.g. "Executive presentation draft")
  // but whose origin title is a test name still gets flagged.
  try {
    await dbRun(
      `UPDATE v8_output_artifacts
          SET is_draft = 1
        WHERE organization_id = ?
          AND is_draft = 0
          AND (
               title_snapshot LIKE '%E2E%'
            OR title_snapshot LIKE '%THROWAWAY%'
            OR title_snapshot LIKE '%PROBE%'
            OR LOWER(title_snapshot) LIKE '%smoke%'
            OR LOWER(title_snapshot) LIKE '%toreport-%'
            OR LOWER(COALESCE(title_snapshot, '')) LIKE '% test %'
            OR LOWER(COALESCE(title_snapshot, '')) LIKE 'test %'
            OR LOWER(COALESCE(title_snapshot, '')) LIKE '% test'
          )`,
      [organizationId]
    );
  } catch (err: any) {
    logger.warn(`${LOG_PREFIX} ensureDraftFlag backfill failed: ${err?.message}`);
  }
}

export async function ensureBackfilledOutputsForOrg(organizationId: string): Promise<void> {
  const last = backfillWatermark.get(organizationId) || 0;
  const now = Date.now();
  if (now - last < BACKFILL_TTL_MS) return;

  await ensureDraftFlagForOrg(organizationId);

  const [
    reportsInserted,
    presentationsInserted,
    nativeArtifactsInserted,
    reportTemplatesInserted,
    presentationTemplatesInserted,
    docStudioTemplatesInserted,
  ] = await Promise.all([
    backfillReportsForOrg(organizationId),
    backfillPresentationsForOrg(organizationId),
    backfillNativeArtifactsForOrg(organizationId),
    backfillReportTemplatesForOrg(organizationId),
    backfillPresentationTemplatesForOrg(organizationId),
    backfillDocStudioTemplatesForOrg(organizationId),
  ]);

  backfillWatermark.set(organizationId, now);
  if (
    reportsInserted ||
    presentationsInserted ||
    nativeArtifactsInserted ||
    reportTemplatesInserted ||
    presentationTemplatesInserted ||
    docStudioTemplatesInserted
  ) {
    logger.info(
      `${LOG_PREFIX} Backfilled ${reportsInserted} reports, ${presentationsInserted} presentations, ` +
        `${nativeArtifactsInserted} native documents, ${reportTemplatesInserted} report templates, ` +
        `${presentationTemplatesInserted} presentation templates, and ${docStudioTemplatesInserted} document templates ` +
        `for org ${organizationId}`
    );
  }

  // R1 correction #5 — orphaned links are DETECTED and MEASURED, never deleted.
  // The measurement has to actually run somewhere or the requirement is only
  // met on paper, so it rides this already-throttled block (same
  // `BACKFILL_TTL_MS` watermark) rather than every list request. Read-only:
  // `countOrphanedTemplateLinks` issues SELECTs exclusively.
  // Failure here must never break listing — orphan telemetry is diagnostic.
  try {
    const orphans = await countOrphanedTemplateLinks(organizationId);
    if (orphans.total > 0) {
      logger.warn(
        `${LOG_PREFIX} Orphaned template links for org ${organizationId}: ${orphans.total} ` +
          `(${TEMPLATE_ORIGIN_RUNTIMES.map((rt) => `${rt}=${orphans.byRuntime[rt]}`).join(', ')})` +
          (orphans.unverifiable.length ? ` · unverifiable: ${orphans.unverifiable.join(', ')}` : '')
      );
    }
  } catch (err) {
    logger.warn(`${LOG_PREFIX} Orphan measurement skipped for org ${organizationId}: ${err}`);
  }
}

async function getProjectMembershipSet(
  organizationId: string,
  userId: string
): Promise<Set<string>> {
  const rows = await dbAll<{ project_id: string }>(
    `SELECT pm.project_id
     FROM project_members pm
     INNER JOIN projects p
       ON p.id = pm.project_id
     WHERE pm.user_id = ?
       AND pm.project_id IS NOT NULL
       AND p.organization_id = ?`,
    [userId, organizationId],
    { fallback: true }
  );
  return new Set((rows || []).map((row) => String(row.project_id)));
}

async function getArtifactAccessGrants(
  organizationId: string,
  artifactIds: string[]
): Promise<Map<string, ArtifactAccessGrant[]>> {
  if (artifactIds.length === 0) return new Map();
  const placeholders = artifactIds.map(() => '?').join(', ');
  const rows = await dbAll<AccessGrantRow>(
    `SELECT *
     FROM v8_artifact_access_grants
     WHERE organization_id = ?
       AND artifact_id IN (${placeholders})`,
    [organizationId, ...artifactIds],
    { fallback: true }
  );

  const map = new Map<string, ArtifactAccessGrant[]>();
  for (const row of rows || []) {
    const item = mapAccessGrantRow(row);
    const arr = map.get(item.artifactId) || [];
    arr.push(item);
    map.set(item.artifactId, arr);
  }
  return map;
}

function sourceRefsFromOriginSummary(summary: Record<string, unknown> | null): unknown[] {
  if (!summary || !Array.isArray(summary.sourceRefs)) return [];
  return summary.sourceRefs as unknown[];
}

/**
 * MAT-006B — the Materials / Reports-and-Presentations list is fed by
 * `GET /api/artifacts` → `listArtifactsForUser`, NOT by `GET /presentations/decks`.
 * Both canonical deck routes were already gated, but this one still selected
 * `d.slide_count AS presentation_slide_count` and surfaced the RAW column, so
 * the very screen that showed "Ready · 11" over a deck with zero renderable
 * cards could still show a phantom count.
 *
 * The registry now derives the number through the SAME owner the deck routes
 * use — `resolveDeckContentCoherence` — so the two surfaces cannot diverge
 * again. Verified shapes on the Railway `demo` store this must survive:
 *   - 10 rows with `slide_count > 0` and NO content in either column;
 *   - `deck_json` holding invalid JSON, `'{}'`, or `{"schemaVersion":1,"cards":[]}`;
 *   - 40+ rows where `slide_count = cards + 1` (the PPTX pipeline counts its
 *     appended closing slide).
 * Every one of those resolves to the derived count, never the declared column.
 *
 * Non-presentation rows are untouched: `slideCount` stays `null` for them, as
 * before (the LEFT JOIN leaves every `d.*` column NULL).
 */
function presentationCoherenceForRow(row: ArtifactListRow) {
  return resolveDeckContentCoherence({
    id: row.origin_record_id,
    organization_id: row.organization_id,
    title: row.presentation_title,
    status: row.presentation_status,
    slide_count: row.presentation_slide_count,
    deck_json: row.presentation_deck_json,
    unified_json: row.presentation_unified_json,
  });
}
function rowToListItem(row: ArtifactListRow): ArtifactListItem {
  const base = mapArtifactRow(row);
  const sourceRefs =
    row.origin_runtime === 'report'
      ? safeJsonParse(row.report_source_refs_json, [] as unknown[])
      : row.origin_runtime === 'presentation'
        ? safeJsonParse(row.presentation_source_refs_json, [] as unknown[])
        : row.origin_runtime === 'sheet'
          ? sourceRefsFromOriginSummary(base.originSummary)
          : [];

  const originTitle =
    row.origin_runtime === 'report'
      ? row.report_title
      : row.origin_runtime === 'presentation'
        ? row.presentation_title
        : row.origin_runtime === 'sheet'
          ? base.titleSnapshot
          : null;

  const originStatus =
    row.origin_runtime === 'report'
      ? row.report_status
      : row.origin_runtime === 'presentation'
        ? row.presentation_status
        : row.origin_runtime === 'sheet'
          ? typeof base.originSummary?.nativeStatus === 'string'
            ? (base.originSummary.nativeStatus as string)
            : null
          : null;

  const resolvedTitle = originTitle || base.titleSnapshot || 'Untitled artifact';

  const coherence = row.origin_runtime === 'presentation' ? presentationCoherenceForRow(row) : null;

  return {
    ...base,
    // Belt-and-suspenders: honor the persisted flag, but also flag on the fly if
    // the resolved (origin) title looks like test scaffolding and the DB flag has
    // not been backfilled yet. Never un-flags a persisted draft.
    isDraft: base.isDraft || isDraftHeuristicTitle(resolvedTitle),
    originRuntime: row.origin_runtime,
    originRecordId: row.origin_record_id,
    resolvedTitle,
    originTitle,
    originStatus,
    reportType: row.report_type,
    presentationMode: row.presentation_mode,
    // DERIVED, never the declared column. `contentState === 'missing'` always
    // travels with `slideCount === 0` — identical contract to `GET /decks`.
    slideCount: coherence ? coherence.cardCount : null,
    declaredSlideCount: coherence ? coherence.declaredSlideCount : null,
    contentState: coherence ? (coherence.hasCanonicalContent ? 'canonical' : 'missing') : null,
    exportFormat: row.origin_runtime === 'sheet' ? 'xlsx' : row.presentation_export_format,
    sourceRefs,
    publishState: row.publish_state,
    publishReviewers: safeJsonParse(row.publish_reviewers, [] as string[]),
    reviewGateCount: Number(row.review_gate_count || 0),
    ownerName: row.owner_name || null,
    duplicateCount: 1,
    duplicateArtifactIds: [],
  };
}

function matchesSearch(item: ArtifactListItem, search?: string): boolean {
  if (!search) return true;
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return [
    item.resolvedTitle,
    item.originTitle,
    item.reportType,
    item.presentationMode,
    item.originRuntime,
    item.originStatus,
    item.exportFormat,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

export function matchesViewFilters(
  item: ArtifactListItem,
  filters: ArtifactListFilters,
  currentUserId: string
): boolean {
  // Template Library duplicate fix (2026-07-26, canon §7): a `template`-family
  // artifact with NO origin link is structural index corruption, not a real
  // template — every legitimate template row is created by `registerArtifactOrigin`
  // together with a matching `v8_artifact_origin_links` row (report_template /
  // presentation_template / document_template / sheet_template). Rows with
  // `originRuntime` missing are orphans left behind by a since-fixed race
  // condition in `registerArtifactOrigin` (confirmed: 180 such rows on the demo
  // DB, each a phantom duplicate of a correctly-linked sibling — e.g. two
  // "KPI Review Report" cards, only one of which can ever open). They can never
  // resolve to a real template, so they must never surface as Library cards.
  // Doctrine: don't delete the data, just stop indexing/showing the duplicate.
  if (item.artifactFamily === 'template' && !item.originRuntime) return false;

  // Templates are included when explicitly requested via artifactFamily filter,
  // in review lanes, or in recent/mixed lanes via includeTemplates flag.
  if (
    !filters.artifactFamily &&
    !filters.reviewSharedForUserId &&
    !(filters as any).includeTemplates &&
    item.artifactFamily === 'template'
  )
    return false;
  if (filters.outputType && item.outputType !== filters.outputType) return false;
  if (filters.artifactFamily && item.artifactFamily !== filters.artifactFamily) return false;
  if (filters.visibilityScope && item.visibilityScope !== filters.visibilityScope) return false;
  if (filters.ownerUserId && item.ownerUserId !== filters.ownerUserId) return false;
  if (filters.sourceInitiativeId && item.sourceInitiativeId !== filters.sourceInitiativeId)
    return false;
  if (filters.onlyMine && item.ownerUserId !== currentUserId) return false;
  if (filters.reviewSharedForUserId) {
    const isReviewer = item.publishReviewers.includes(filters.reviewSharedForUserId);
    if (!isReviewer && item.visibilityScope !== 'review_shared') return false;
  }
  // M17 junk filter (S6.3): default listing hides drafts; 'only' shows the
  // Robocze view; 'include' shows everything.
  const draftMode = filters.drafts ?? 'exclude';
  if (draftMode === 'exclude' && item.isDraft) return false;
  if (draftMode === 'only' && !item.isDraft) return false;
  return matchesSearch(item, filters.search);
}

/**
 * Presentational dedup (S6.3): collapse artifacts that share the same resolved
 * name + output type + origin runtime into a single newest row, recording how
 * many older versions it stands in for. Input MUST already be sorted newest→oldest
 * (the list query orders by last_transition_at/created_at DESC). NO data is mutated.
 */
export function dedupeArtifacts(items: ArtifactListItem[]): ArtifactListItem[] {
  const seen = new Map<string, ArtifactListItem>();
  const order: string[] = [];
  for (const item of items) {
    const key = [
      (item.resolvedTitle || '').trim().toLowerCase(),
      item.outputType,
      item.originRuntime || 'none',
    ].join('::');
    const existing = seen.get(key);
    if (!existing) {
      // First (newest) wins. Clone so we can safely accumulate version metadata.
      seen.set(key, { ...item, duplicateCount: 1, duplicateArtifactIds: [] });
      order.push(key);
    } else {
      existing.duplicateCount += 1;
      existing.duplicateArtifactIds.push(item.artifactId);
    }
  }
  return order.map((key) => seen.get(key)!);
}

function hasArtifactAccess(
  item: ArtifactListItem,
  grants: ArtifactAccessGrant[],
  projectMemberships: Set<string>,
  userId: string,
  roleKey: string | null,
  allowDemo: boolean
): boolean {
  if (item.ownerUserId && item.ownerUserId === userId) return true;

  switch (item.visibilityScope) {
    case 'organization':
      return true;
    case 'private':
      return item.ownerUserId === userId;
    case 'project':
      return !!item.projectId && projectMemberships.has(item.projectId);
    case 'review_shared':
      return (
        item.publishReviewers.includes(userId) ||
        grants.some((grant) => grant.userId === userId) ||
        (roleKey ? grants.some((grant) => grant.roleKey === roleKey) : false)
      );
    case 'demo':
      return allowDemo;
    default:
      return false;
  }
}

async function getArtifactListItemRow(
  artifactId: string,
  organizationId: string
): Promise<ArtifactListRow | null> {
  return dbGet<ArtifactListRow>(
    `SELECT a.*,
            l.origin_runtime,
            l.origin_record_id,
            r.title AS report_title,
            r.status AS report_status,
            r.report_type AS report_type,
            r.source_refs_json AS report_source_refs_json,
            d.title AS presentation_title,
            d.status AS presentation_status,
            d.presentation_mode AS presentation_mode,
            d.slide_count AS presentation_slide_count,
            -- MAT-006B: single row, so both content columns come along directly;
            -- there is nothing to amortize and no second pass to justify.
            d.deck_json AS presentation_deck_json,
            d.unified_json AS presentation_unified_json,
            d.export_format AS presentation_export_format,
            COALESCE(d.source_artifacts, '[]') AS presentation_source_refs_json,
            p.current_state AS publish_state,
            p.reviewers AS publish_reviewers,
            (
              SELECT COUNT(*) FROM v8_review_gates g
              WHERE g.artifact_id = a.artifact_id AND g.organization_id = a.organization_id
            ) AS review_gate_count
     FROM v8_output_artifacts a
     LEFT JOIN v8_artifact_origin_links l
       ON l.artifact_id = a.artifact_id
      AND l.organization_id = a.organization_id
      AND l.is_primary_origin = 1
     LEFT JOIN report_builder_reports r
       ON l.origin_runtime = 'report'
      AND r.id = l.origin_record_id
      AND r.organization_id = a.organization_id
     LEFT JOIN presentation_decks d
       ON l.origin_runtime = 'presentation'
      AND d.id = l.origin_record_id
      AND d.organization_id = a.organization_id
     LEFT JOIN v8_publish_records p
       ON p.artifact_id = a.artifact_id
      AND p.organization_id = a.organization_id
     WHERE a.organization_id = ?
       AND a.artifact_id = ?`,
    [organizationId, artifactId],
    { fallback: true }
  );
}

/**
 * MAT-006B second pass — mirrors `GET /presentations/decks` exactly, so the two
 * surfaces cannot drift apart.
 *
 * COST, and why it is shaped this way. The list query already returns EVERY
 * artifact row for the org (filters run in JS afterwards), so a content column
 * on it is paid per artifact. Two things keep that bounded:
 *   1. `deck_json` is NULL for every non-presentation row — the LEFT JOIN only
 *      matches when `origin_runtime = 'presentation'`. The extra bytes are
 *      bounded by the org's deck count (74 on `demo`), not its artifact count.
 *   2. `unified_json` is NOT selected up front. Every writer that stores content
 *      stores `deck_json` (presentationGeneratorService.ts writes both in one
 *      UPDATE), so for effectively every row the second column is dead weight.
 *      It is fetched only for rows whose `deck_json` yielded ZERO cards AND that
 *      hold a non-empty `unified_json` — the legacy shape. Omitting it can only
 *      ever UNDERSTATE a count (`normalizeDeckDocument` falls back to
 *      `unified_json` only when `deck_json` produced no cards), never overstate
 *      it, so this pass is a correctness top-up, not a guess.
 * If this listing ever becomes hot, the fix is a persisted derived count (a
 * generated column or a write-path invariant), not a SQL predicate — a
 * non-empty JSON string is not proof of renderable cards, which is exactly how
 * the first attempt at this gate on the deck route let `'{}'`, invalid JSON,
 * `cards: []` and the cards+1 drift through.
 *
 * Mutates `rows` in place; failure is non-fatal (a missed top-up can only leave
 * a legacy row reading 0, never inflate a count).
 */
async function topUpPresentationUnifiedJson(
  organizationId: string,
  rows: ArtifactListRow[]
): Promise<void> {
  const needsUnifiedJson = rows.filter(
    (row) =>
      row.origin_runtime === 'presentation' &&
      Number(row.presentation_has_unified_json ?? 0) === 1 &&
      presentationCoherenceForRow(row).cardCount === 0
  );
  if (needsUnifiedJson.length === 0) return;

  const deckIds = needsUnifiedJson.map((row) => String(row.origin_record_id));
  const placeholders = deckIds.map(() => '?').join(', ');
  const unifiedRows = await dbAll<{ id: string; unified_json: string | null }>(
    `SELECT id, unified_json FROM presentation_decks
     WHERE organization_id = ? AND id IN (${placeholders})`,
    [organizationId, ...deckIds],
    { fallback: true }
  );
  const unifiedById = new Map(
    (unifiedRows || []).map((row) => [String(row.id), row.unified_json ?? null])
  );
  for (const row of needsUnifiedJson) {
    const unified = unifiedById.get(String(row.origin_record_id));
    if (unified !== undefined) row.presentation_unified_json = unified;
  }
}

export async function listArtifactsForUser(params: {
  organizationId: string;
  userId: string;
  roleKey?: string | null;
  allowDemo?: boolean;
  filters?: ArtifactListFilters;
}): Promise<ArtifactListItem[]> {
  const { organizationId, userId, roleKey = null, allowDemo = false, filters = {} } = params;
  await ensureBackfilledOutputsForOrg(organizationId);

  const rows = await dbAll<ArtifactListRow>(
    `SELECT a.*,
            l.origin_runtime,
            l.origin_record_id,
            r.title AS report_title,
            r.status AS report_status,
            r.report_type AS report_type,
            r.source_refs_json AS report_source_refs_json,
            d.title AS presentation_title,
            d.status AS presentation_status,
            d.presentation_mode AS presentation_mode,
            d.slide_count AS presentation_slide_count,
            -- MAT-006B: deck_json is read to DERIVE the count; it is never
            -- returned to a client. unified_json is deliberately NOT hauled
            -- here - see topUpPresentationUnifiedJson().
            d.deck_json AS presentation_deck_json,
            (CASE WHEN COALESCE(d.unified_json, '') <> '' THEN 1 ELSE 0 END) AS presentation_has_unified_json,
            d.export_format AS presentation_export_format,
            COALESCE(d.source_artifacts, '[]') AS presentation_source_refs_json,
            p.current_state AS publish_state,
            p.reviewers AS publish_reviewers,
            (
              SELECT COUNT(*) FROM v8_review_gates g
              WHERE g.artifact_id = a.artifact_id AND g.organization_id = a.organization_id
            ) AS review_gate_count,
            NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') AS owner_name
     FROM v8_output_artifacts a
     LEFT JOIN v8_artifact_origin_links l
       ON l.artifact_id = a.artifact_id
      AND l.organization_id = a.organization_id
      AND l.is_primary_origin = 1
     LEFT JOIN report_builder_reports r
       ON l.origin_runtime = 'report'
      AND r.id = l.origin_record_id
      AND r.organization_id = a.organization_id
     LEFT JOIN presentation_decks d
       ON l.origin_runtime = 'presentation'
      AND d.id = l.origin_record_id
      AND d.organization_id = a.organization_id
     LEFT JOIN v8_publish_records p
       ON p.artifact_id = a.artifact_id
      AND p.organization_id = a.organization_id
     LEFT JOIN users u ON u.id = a.owner_user_id
     WHERE a.organization_id = ?
     ORDER BY COALESCE(a.last_transition_at, a.created_at) DESC`,
    [organizationId],
    { fallback: true }
  );

  // MAT-006B: resolve the legacy `unified_json`-only decks before mapping, so
  // every row's `slideCount` is derived from the best content available.
  const listRows = rows || [];
  await topUpPresentationUnifiedJson(organizationId, listRows);

  // R11 (doc slice): template cards carry a REAL identity block — canonical id,
  // runtime, source/legacy, live scope/status and an orphan flag recomputed from
  // the canonical registries. Read-only; nothing is deleted or rewritten.
  const items = await enrichTemplateOriginSummaries(organizationId, listRows.map(rowToListItem));
  const accessMap = await getArtifactAccessGrants(
    organizationId,
    items.map((item) => item.artifactId)
  );
  const projectMemberships = await getProjectMembershipSet(organizationId, userId);

  const filtered = items
    .filter((item) =>
      hasArtifactAccess(
        item,
        accessMap.get(item.artifactId) || [],
        projectMemberships,
        userId,
        roleKey,
        allowDemo
      )
    )
    .filter((item) => matchesViewFilters(item, filters, userId));

  // Presentational dedup runs before the limit slice so the cap counts distinct
  // artifacts, not duplicate versions. Defaults on; opt out with dedupe:false.
  const deduped = filters.dedupe === false ? filtered : dedupeArtifacts(filtered);

  return deduped.slice(0, Math.max(1, Math.min(filters.limit || 100, 200)));
}

export async function listArtifactsForUserByExecutionRunId(params: {
  organizationId: string;
  executionRunId: string;
  userId: string;
  roleKey?: string | null;
  allowDemo?: boolean;
  limit?: number;
}): Promise<ArtifactListItem[]> {
  await ensureBackfilledOutputsForOrg(params.organizationId);

  const limit = Math.max(1, Math.min(params.limit ?? 50, 200));
  const allowDemo = Boolean(params.allowDemo);

  const rows = await dbAll<ArtifactListRow>(
    `SELECT a.*,
            l.origin_runtime,
            l.origin_record_id,
            r.report_type,
            COALESCE(r.title, a.title_snapshot) AS report_title,
            r.status AS report_status,
            COALESCE(r.source_refs_json, '[]') AS report_source_refs_json,
            d.presentation_mode,
            COALESCE(d.title, a.title_snapshot) AS presentation_title,
            d.status AS presentation_status,
            -- MAT-006B alias fix: these two were selected WITHOUT the aliases
            -- rowToListItem actually reads (presentation_slide_count /
            -- presentation_export_format), so slideCount and exportFormat were
            -- permanently undefined on the execution-run artifact list.
            d.slide_count AS presentation_slide_count,
            d.export_format AS presentation_export_format,
            d.deck_json AS presentation_deck_json,
            (CASE WHEN COALESCE(d.unified_json, '') <> '' THEN 1 ELSE 0 END) AS presentation_has_unified_json,
            COALESCE(d.source_artifacts, '[]') AS presentation_source_refs_json,
            p.current_state AS publish_state,
            p.reviewers AS publish_reviewers,
            (
              SELECT COUNT(*) FROM v8_review_gates g
              WHERE g.artifact_id = a.artifact_id AND g.organization_id = a.organization_id
            ) AS review_gate_count
     FROM v8_output_artifacts a
     LEFT JOIN v8_artifact_origin_links l
       ON l.artifact_id = a.artifact_id
      AND l.organization_id = a.organization_id
      AND l.is_primary_origin = 1
     LEFT JOIN report_builder_reports r
       ON l.origin_runtime = 'report'
      AND r.id = l.origin_record_id
      AND r.organization_id = a.organization_id
     LEFT JOIN presentation_decks d
       ON l.origin_runtime = 'presentation'
      AND d.id = l.origin_record_id
      AND d.organization_id = a.organization_id
     LEFT JOIN v8_publish_records p
       ON p.artifact_id = a.artifact_id
      AND p.organization_id = a.organization_id
     WHERE a.organization_id = ?
       AND a.execution_run_id = ?
     ORDER BY COALESCE(a.last_transition_at, a.created_at) DESC`,
    [params.organizationId, params.executionRunId],
    { fallback: true }
  );

  const runRows = rows || [];
  await topUpPresentationUnifiedJson(params.organizationId, runRows);
  const items = runRows.map(rowToListItem);
  const accessMap = await getArtifactAccessGrants(
    params.organizationId,
    items.map((item) => item.artifactId)
  );
  const projectMemberships = await getProjectMembershipSet(params.organizationId, params.userId);

  return items
    .filter((item) =>
      hasArtifactAccess(
        item,
        accessMap.get(item.artifactId) || [],
        projectMemberships,
        params.userId,
        params.roleKey || null,
        allowDemo
      )
    )
    .slice(0, limit);
}

export async function getArtifactForUser(params: {
  organizationId: string;
  artifactId: string;
  userId: string;
  roleKey?: string | null;
  allowDemo?: boolean;
}): Promise<ArtifactListItem | null> {
  await ensureBackfilledOutputsForOrg(params.organizationId);
  const row = await getArtifactListItemRow(params.artifactId, params.organizationId);
  if (!row) return null;

  const item = rowToListItem(row);
  const [grants, projectMemberships] = await Promise.all([
    getArtifactAccessGrants(params.organizationId, [item.artifactId]),
    getProjectMembershipSet(params.organizationId, params.userId),
  ]);

  return hasArtifactAccess(
    item,
    grants.get(item.artifactId) || [],
    projectMemberships,
    params.userId,
    params.roleKey || null,
    params.allowDemo || false
  )
    ? item
    : null;
}

export async function getArtifactByOrigin(params: {
  organizationId: string;
  originRuntime:
    | 'report'
    | 'presentation'
    | 'sheet'
    | 'native_artifact'
    | 'report_template'
    | 'presentation_template'
    | 'sheet_template';
  originRecordId: string;
  userId: string;
  roleKey?: string | null;
  allowDemo?: boolean;
}): Promise<ArtifactListItem | null> {
  await ensureBackfilledOutputsForOrg(params.organizationId);
  const link = await getOriginLinkByOrigin(
    params.organizationId,
    params.originRuntime,
    params.originRecordId
  );
  if (!link) return null;
  return getArtifactForUser({
    organizationId: params.organizationId,
    artifactId: link.artifactId,
    userId: params.userId,
    roleKey: params.roleKey,
    allowDemo: params.allowDemo,
  });
}

export async function getArtifactByOriginUnscoped(params: {
  organizationId: string;
  originRuntime:
    | 'report'
    | 'presentation'
    | 'sheet'
    | 'native_artifact'
    | 'report_template'
    | 'presentation_template';
  originRecordId: string;
}): Promise<ArtifactListItem | null> {
  await ensureBackfilledOutputsForOrg(params.organizationId);
  const link = await getOriginLinkByOrigin(
    params.organizationId,
    params.originRuntime,
    params.originRecordId
  );
  if (!link) return null;
  const row = await getArtifactListItemRow(link.artifactId, params.organizationId);
  return row ? rowToListItem(row) : null;
}

export async function listMyWorkArtifacts(params: {
  organizationId: string;
  userId: string;
  roleKey?: string | null;
  allowDemo?: boolean;
  limit?: number;
}): Promise<{
  mine: ArtifactListItem[];
  review: ArtifactListItem[];
  recent: ArtifactListItem[];
}> {
  const laneLimit = Math.max(1, params.limit || 8);

  const [mine, review, recent] = await Promise.all([
    listArtifactsForUser({
      organizationId: params.organizationId,
      userId: params.userId,
      roleKey: params.roleKey,
      allowDemo: params.allowDemo,
      filters: { onlyMine: true, limit: laneLimit },
    }),
    listArtifactsForUser({
      organizationId: params.organizationId,
      userId: params.userId,
      roleKey: params.roleKey,
      allowDemo: params.allowDemo,
      filters: { reviewSharedForUserId: params.userId, limit: laneLimit },
    }),
    listArtifactsForUser({
      organizationId: params.organizationId,
      userId: params.userId,
      roleKey: params.roleKey,
      allowDemo: params.allowDemo,
      filters: { limit: laneLimit, includeTemplates: true } as any,
    }),
  ]);

  return { mine, review, recent };
}

/**
 * Derive a clean, human title from a free-text goal. A raw brief dumped as the
 * artifact title ("Rejestr 8 inicjatyw… Dodaj przykładowe dane") or a generic
 * "Executive presentation draft" both read badly — and ugly things don't get
 * read. Take the first clause, strip the leading format label and trailing
 * instruction tail, cap length, capitalize.
 */
export function deriveArtifactTitle(goalRaw: string, fallback: string): string {
  let t = String(goalRaw || '').trim();
  if (!t) return fallback;
  t = t.split(/[\n.!?]/)[0]; // first sentence/clause
  t = t.replace(
    /^(tabela|raport|prezentacja|deck|report|table|presentation|dokument|document)\s*[:\-–—]\s*/i,
    ''
  );
  // Naprawa 2026-07-28 ("tytułem dokumentu jest surowy prompt użytkownika"):
  // a schema-spec prompt like "Rejestr 8 inicjatyw transformacji AI: nazwa,
  // właściciel, priorytet (select), status (select)…" has no period and no
  // "dodaj/add" trigger word, so the two rules below never fired — the "first
  // clause" WAS the whole prompt, just cut off mid-field-list at 70 chars.
  // When there's a short lead-in before a colon and what follows it reads
  // like an enumerated field list (has a comma), the lead-in IS the name of
  // the thing — use only that, not the field list.
  const colonIdx = t.indexOf(':');
  if (colonIdx > 0 && colonIdx <= 60) {
    const head = t.slice(0, colonIdx).trim();
    const tail = t.slice(colonIdx + 1);
    if (head && /,/.test(tail)) {
      t = head;
    }
  }
  // strip trailing instruction phrases ("…, dodaj przykładowe dane", "…include sample data")
  t = t.replace(
    /[,;]?\s*(dodaj|add|uwzgl[ęe]dnij|include|wygeneruj|generate|przygotuj|prepare|zbuduj|build)\b.*$/i,
    ''
  );
  t = t.trim().replace(/\s+/g, ' ');
  if (t.length > 70) t = `${t.slice(0, 67).trimEnd()}…`;
  if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
  return t || fallback;
}

function inferArtifactPlan(
  request: ArtifactPlanningRequest
): ArtifactPlanningResult['artifactPlan'] {
  const goal = request.goal.toLowerCase();
  const explicit = mapExplicitArtifactRunType({
    artifactFamily: request.requestedArtifactFamily,
    outputType: request.requestedOutputType,
  });

  if (explicit) {
    return {
      artifactFamily: explicit.artifactFamily,
      outputType: explicit.outputType,
      titleHint: deriveArtifactTitle(request.goal, 'Output draft'),
      governancePath: 'execution_spine',
      visibilityScope:
        explicit.artifactFamily === 'presentation'
          ? 'private'
          : explicit.artifactFamily === 'document'
            ? 'private'
            : 'organization',
    };
  }

  if (goal.includes('sheet') || goal.includes('spreadsheet') || goal.includes('excel')) {
    const inferred = mapCanonicalArtifactType({ artifactFamily: 'sheet', outputType: 'sheet' });
    return {
      artifactFamily: inferred.artifactFamily,
      outputType: inferred.outputType,
      titleHint: deriveArtifactTitle(request.goal, 'Tabela operacyjna'),
      governancePath: 'execution_spine',
      visibilityScope: 'organization',
    };
  }

  if (goal.includes('deck') || goal.includes('presentation')) {
    const inferred = mapCanonicalArtifactType({
      artifactFamily: 'presentation',
      outputType: 'presentation',
    });
    return {
      artifactFamily: inferred.artifactFamily,
      outputType: inferred.outputType,
      titleHint: deriveArtifactTitle(request.goal, 'Prezentacja'),
      governancePath: 'execution_spine',
      visibilityScope: 'private',
    };
  }

  const inferred = mapCanonicalArtifactType({ artifactFamily: 'document', outputType: 'report' });
  return {
    artifactFamily: inferred.artifactFamily,
    outputType: inferred.outputType,
    titleHint: deriveArtifactTitle(
      request.goal,
      goal.includes('brief') ? 'Working brief' : 'Raport'
    ),
    governancePath: 'execution_spine',
    visibilityScope: 'private',
  };
}

function mapSnapshotSourceKindToReportSourceType(
  sourceKind: string | null | undefined
): ArtifactRunReportSourceType | null {
  const normalized = String(sourceKind || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return SNAPSHOT_SOURCE_KIND_TO_REPORT_SOURCE_TYPE[normalized] || null;
}

function normalizePresentationSourceArtifactType(sourceKind: string | null | undefined): string {
  const normalized = String(sourceKind || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return SNAPSHOT_SOURCE_KIND_TO_PRESENTATION_SOURCE_ARTIFACT_TYPE[normalized] || 'custom';
}

async function resolveMaterializedReportParams(
  current: ArtifactRunRecord,
  params: MaterializeArtifactRunParams
): Promise<{
  sourceType: ArtifactRunReportSourceType;
  sourceId: string;
  sourceName?: string;
  title: string;
  description?: string;
  templateId?: string;
  config?: Record<string, unknown>;
}> {
  const title = String(params.title || current.plan.titleHint || 'Output draft').trim();
  const description = params.description?.trim() || undefined;
  const normalizedSourceType = params.sourceType?.trim().toUpperCase();
  const sourceType =
    normalizedSourceType && VALID_REPORT_SOURCE_TYPES.has(normalizedSourceType)
      ? (normalizedSourceType as ArtifactRunReportSourceType)
      : undefined;
  const sourceId = params.sourceId?.trim();

  if ((params.sourceType && !sourceId) || (!params.sourceType && sourceId)) {
    throw new Error('ArtifactRun report materialization requires both sourceType and sourceId');
  }

  if (params.sourceType && !sourceType) {
    throw new Error('ArtifactRun report materialization received an invalid sourceType');
  }

  if (sourceType && sourceId) {
    return {
      sourceType,
      sourceId,
      sourceName: params.sourceName?.trim() || undefined,
      title,
      description,
      templateId: params.templateId?.trim() || undefined,
      config: params.config,
    };
  }

  const snapshot = await contextSnapshotService.getSnapshot(
    current.contextSnapshotId,
    params.organizationId
  );
  const derivedSource = (snapshot?.sourceContextRefs || []).find(
    (ref) =>
      mapSnapshotSourceKindToReportSourceType(ref.sourceKind) && String(ref.sourceId || '').trim()
  );
  if (!derivedSource) {
    throw new Error(
      'ArtifactRun report materialization requires sourceType/sourceId or a resolvable snapshot source context'
    );
  }

  return {
    sourceType: mapSnapshotSourceKindToReportSourceType(derivedSource.sourceKind)!,
    sourceId: String(derivedSource.sourceId).trim(),
    sourceName: params.sourceName?.trim() || undefined,
    title,
    description,
    templateId: params.templateId?.trim() || undefined,
    config: params.config,
  };
}

async function resolveMaterializedPresentationParams(
  current: ArtifactRunRecord,
  params: MaterializeArtifactRunParams
): Promise<{
  title: string;
  setup: {
    title: string;
    templateId?: string;
    audience: 'sponsor' | 'executive' | 'investor' | 'internal';
    goal: 'inform' | 'decide' | 'sell' | 'align';
    language: 'en' | 'pl';
    theme: 'corporate' | 'minimal' | 'modern';
    confidentiality: 'confidential' | 'internal' | 'public';
    sourceArtifacts: Array<{ type: string; id?: string; label: string }>;
    sourceType?: string;
    sourceId?: string;
    visuals?: {
      enabled?: boolean;
      priority?: 'quality' | 'cost';
      imageDensity?: 'low' | 'medium' | 'high';
    };
  };
  originSummary: Record<string, unknown>;
}> {
  const title = String(
    params.title || current.plan.titleHint || 'Executive presentation draft'
  ).trim();
  const cfg = params.config || {};
  const audience =
    cfg.audience === 'sponsor' || cfg.audience === 'executive' || cfg.audience === 'investor'
      ? cfg.audience
      : 'internal';
  const goal =
    cfg.goal === 'decide' || cfg.goal === 'sell' || cfg.goal === 'align' ? cfg.goal : 'inform';
  const language = cfg.language === 'pl' ? 'pl' : 'en';
  const theme = cfg.theme === 'corporate' || cfg.theme === 'minimal' ? cfg.theme : 'modern';
  const confidentiality =
    cfg.confidentiality === 'confidential' || cfg.confidentiality === 'public'
      ? cfg.confidentiality
      : 'internal';

  const directSourceType = params.sourceType?.trim() || undefined;
  const directSourceId = params.sourceId?.trim() || undefined;
  const directSourceName = params.sourceName?.trim() || undefined;
  if ((directSourceType && !directSourceId) || (!directSourceType && directSourceId)) {
    throw new Error(
      'ArtifactRun presentation materialization requires both sourceType and sourceId'
    );
  }

  let sourceArtifacts: Array<{ type: string; id?: string; label: string }> = [];
  let resolvedSourceType = directSourceType;
  let resolvedSourceId = directSourceId;

  if (directSourceType && directSourceId) {
    sourceArtifacts = [
      {
        type: normalizePresentationSourceArtifactType(directSourceType),
        id: directSourceId,
        label: directSourceName || title,
      },
    ];
  } else {
    const snapshot = await contextSnapshotService.getSnapshot(
      current.contextSnapshotId,
      params.organizationId
    );
    const derivedSource = (snapshot?.sourceContextRefs || []).find((ref) =>
      String(ref.sourceId || '').trim()
    );
    if (derivedSource) {
      resolvedSourceType = String(derivedSource.sourceKind || '').trim() || undefined;
      resolvedSourceId = String(derivedSource.sourceId || '').trim() || undefined;
      sourceArtifacts = [
        {
          type: normalizePresentationSourceArtifactType(derivedSource.sourceKind),
          id: resolvedSourceId,
          label:
            String((derivedSource as { title?: string | null }).title || '').trim() ||
            directSourceName ||
            title,
        },
      ];
    }
  }

  if (!sourceArtifacts.length) {
    sourceArtifacts = [{ type: 'custom', label: directSourceName || title }];
  }

  const visuals =
    cfg.visuals && typeof cfg.visuals === 'object'
      ? {
          enabled:
            typeof (cfg.visuals as Record<string, unknown>).enabled === 'boolean'
              ? Boolean((cfg.visuals as Record<string, unknown>).enabled)
              : undefined,
          priority:
            (cfg.visuals as Record<string, unknown>).priority === 'cost' ? 'cost' : 'quality',
          imageDensity:
            (cfg.visuals as Record<string, unknown>).imageDensity === 'low' ||
            (cfg.visuals as Record<string, unknown>).imageDensity === 'high'
              ? ((cfg.visuals as Record<string, unknown>).imageDensity as 'low' | 'high')
              : 'medium',
        }
      : undefined;

  return {
    title,
    setup: {
      title,
      templateId: params.templateId?.trim() || undefined,
      audience,
      goal,
      language,
      theme,
      confidentiality,
      sourceArtifacts,
      sourceType: resolvedSourceType,
      sourceId: resolvedSourceId,
      visuals:
        visuals && typeof visuals === 'object'
          ? {
              enabled: visuals.enabled,
              priority:
                visuals.priority === 'cost' || visuals.priority === 'quality'
                  ? visuals.priority
                  : undefined,
              imageDensity:
                visuals.imageDensity === 'low' ||
                visuals.imageDensity === 'medium' ||
                visuals.imageDensity === 'high'
                  ? visuals.imageDensity
                  : undefined,
            }
          : undefined,
    },
    originSummary: {
      sourceType: resolvedSourceType || null,
      sourceId: resolvedSourceId || null,
      sourceArtifacts,
      materializedVia: 'artifact_run',
      nativeStatus: 'draft',
      description: params.description?.trim() || null,
    },
  };
}

async function createArtifactRunRecord(params: {
  organizationId: string;
  executionRunId: string;
  contextSnapshotId: string;
  requestedByUserId: string;
  plan: ArtifactPlanningResult['artifactPlan'];
  retryOfRunId?: string | null;
  sourceContextType?: string | null;
  sourceContextId?: string | null;
}): Promise<ArtifactRunRecord> {
  const runId = uuidv4();
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO v8_artifact_runs (
      run_id, artifact_id, organization_id, execution_run_id, context_snapshot_id,
      trigger_type, source_context_type, source_context_id, requested_by_user_id,
      plan_json, run_status, proposal_id, retry_of_run_id, failure_reason,
      started_at, completed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      runId,
      null,
      params.organizationId,
      params.executionRunId,
      params.contextSnapshotId,
      'chat',
      params.sourceContextType || 'conversation',
      params.sourceContextId || null,
      params.requestedByUserId,
      JSON.stringify(params.plan),
      'planned',
      null,
      params.retryOfRunId || null,
      null,
      now,
      null,
      now,
      now,
    ]
  );
  const row = await getArtifactRunRow(runId, params.organizationId);
  if (!row) throw new Error(`ArtifactRun ${runId} was not persisted`);
  return mapArtifactRunRow(row);
}

export async function createArtifactRunFromChat(
  request: ArtifactPlanningRequest
): Promise<ArtifactPlanningResult & { run: ArtifactRunRecord }> {
  const validated = ArtifactPlanningRequestSchema.parse(request);
  const artifactPlan = inferArtifactPlan(validated);
  const handoff = await chatExecutionService.initiateHandoff({
    conversationId: validated.conversationId,
    contextSnapshotId: validated.contextSnapshotId,
    organizationId: validated.organizationId,
    userId: validated.userId,
    goal: validated.goal,
  });

  await executionSpineService.transitionRunState(
    handoff.executionRunId,
    validated.organizationId,
    'planning',
    validated.userId,
    'ArtifactRun planning started from chat'
  );

  const run = await createArtifactRunRecord({
    organizationId: validated.organizationId,
    executionRunId: handoff.executionRunId,
    contextSnapshotId: validated.contextSnapshotId,
    requestedByUserId: validated.userId,
    plan: artifactPlan,
    sourceContextType: 'conversation',
    sourceContextId: validated.conversationId,
  });

  await emitRunAudit({
    runId: run.runId,
    organizationId: validated.organizationId,
    action: 'created',
    actorUserId: validated.userId,
    toStatus: 'planned',
    detail: { goal: validated.goal, outputType: artifactPlan.outputType },
  });

  return {
    artifactRunId: run.runId,
    executionRunId: handoff.executionRunId,
    artifactPlan,
    run,
  };
}

export async function planArtifactFromChat(
  request: ArtifactPlanningRequest
): Promise<ArtifactPlanningResult> {
  const planned = await createArtifactRunFromChat(request);
  return {
    artifactRunId: planned.artifactRunId,
    executionRunId: planned.executionRunId,
    artifactPlan: planned.artifactPlan,
  };
}

export async function getArtifactRun(
  runId: string,
  organizationId: string
): Promise<ArtifactRunRecord | null> {
  const row = await getArtifactRunRow(runId, organizationId);
  return row ? mapArtifactRunRowWithEffectiveStatus(row) : null;
}

export async function listArtifactRunHistory(params: {
  runId: string;
  organizationId: string;
}): Promise<ArtifactRunRecord[]> {
  const current = await getArtifactRunRow(params.runId, params.organizationId);
  if (!current) return [];

  let root = current;
  while (root.retry_of_run_id) {
    const parent = await getArtifactRunRow(root.retry_of_run_id, params.organizationId);
    if (!parent) break;
    root = parent;
  }

  const queue: ArtifactRunRow[] = [root];
  const collected = new Map<string, ArtifactRunRow>();

  while (queue.length > 0) {
    const next = queue.shift()!;
    if (collected.has(next.run_id)) continue;
    collected.set(next.run_id, next);
    const children = await getArtifactRunChildRows(next.run_id, params.organizationId);
    for (const child of children) queue.push(child);
  }

  const ordered = Array.from(collected.values()).sort((a, b) =>
    String(a.created_at || '').localeCompare(String(b.created_at || ''))
  );

  return Promise.all(ordered.map((row) => mapArtifactRunRowWithEffectiveStatus(row)));
}

export async function computeArtifactRunPreflight(params: {
  run: ArtifactRunRecord;
  executionRunExists: boolean;
  materializationParams?: MaterializeArtifactRunParams;
}): Promise<ArtifactRunPreflight> {
  const now = new Date().toISOString();
  const checks: ArtifactRunPreflight['checks'] = [];

  const supported =
    params.run.plan.outputType === 'report' ||
    params.run.plan.outputType === 'presentation' ||
    params.run.plan.outputType === 'sheet';
  checks.push({
    id: 'plan_supported',
    status: supported ? 'passed' : 'failed',
    message: supported
      ? `Plan output type ${params.run.plan.outputType} is supported`
      : `Plan output type ${params.run.plan.outputType} is not supported for ArtifactRun materialization`,
  });

  checks.push({
    id: 'execution_run_resolvable',
    status: params.executionRunExists ? 'passed' : 'failed',
    message: params.executionRunExists
      ? 'Governed execution run is resolvable'
      : 'Governed execution run could not be resolved (cannot proceed safely)',
  });

  if (params.run.plan.outputType === 'sheet') {
    const tableId =
      typeof params.materializationParams?.config?.tableId === 'string'
        ? params.materializationParams.config.tableId.trim()
        : '';
    const table = tableId
      ? await dbGet<{ table_id: string; field_count: number }>(
          `SELECT t.id AS table_id, COUNT(f.id) AS field_count
             FROM tp_tables t
             JOIN tp_bases b ON b.id = t.base_id
             LEFT JOIN tp_fields f ON f.table_id = t.id
            WHERE t.id = ? AND b.organization_id = ?
            GROUP BY t.id
            LIMIT 1`,
          [tableId, params.run.organizationId],
          { fallback: true }
        )
      : null;
    const targetPassed = Boolean(table?.table_id && Number(table.field_count || 0) >= 2);
    checks.push({
      id: 'materialization_target',
      status: params.materializationParams ? (targetPassed ? 'passed' : 'failed') : 'pending',
      message: !params.materializationParams
        ? 'Sheet materialization requires a governed table target (tableId) at materialize time'
        : !tableId
          ? 'Sheet materialization requires config.tableId'
          : !table?.table_id
            ? 'Sheet materialization target was not found in the current organization'
            : Number(table.field_count || 0) < 2
              ? 'Sheet materialization target has no usable schema'
              : 'Sheet materialization target is governed by the current organization',
    });
  } else if (params.run.plan.outputType === 'report') {
    const hasGroundedSource = Boolean(params.run.contextSnapshotId);
    checks.push({
      id: 'materialization_inputs',
      status: hasGroundedSource ? 'passed' : 'pending',
      message: hasGroundedSource
        ? 'Report materialization inputs are grounded by context snapshot'
        : 'Report materialization may require explicit sourceType/sourceId unless snapshot grounding is available',
    });
  } else if (params.run.plan.outputType === 'presentation') {
    const hasGroundedSource = Boolean(params.run.contextSnapshotId);
    checks.push({
      id: 'materialization_inputs',
      status: hasGroundedSource ? 'passed' : 'pending',
      message: hasGroundedSource
        ? 'Presentation materialization inputs are grounded by context snapshot'
        : 'Presentation materialization may require explicit sourceType/sourceId unless snapshot grounding is available',
    });
  }

  const state: ArtifactRunPreflight['state'] = checks.some((c) => c.status === 'failed')
    ? 'attention_required'
    : checks.some((c) => c.status === 'pending')
      ? 'pending'
      : 'passed';

  return { state, computedAt: now, checks };
}

async function persistArtifactRunPreflight(params: {
  runId: string;
  organizationId: string;
  actorUserId: string;
  preflight: ArtifactRunPreflight;
}): Promise<void> {
  await dbRun(
    `UPDATE v8_artifact_runs
     SET preflight_state = ?,
         preflight_json = ?,
         updated_at = ?
     WHERE run_id = ? AND organization_id = ?`,
    [
      params.preflight.state,
      JSON.stringify(params.preflight),
      new Date().toISOString(),
      params.runId,
      params.organizationId,
    ]
  );

  await emitRunAudit({
    runId: params.runId,
    organizationId: params.organizationId,
    action: 'preflight',
    actorUserId: params.actorUserId,
    detail: {
      preflightState: params.preflight.state,
      checksCount: params.preflight.checks.length,
    },
  });
}

export async function preflightArtifactRun(params: {
  runId: string;
  organizationId: string;
  actorUserId: string;
}): Promise<ArtifactRunRecord> {
  const row = await getArtifactRunRow(params.runId, params.organizationId);
  if (!row) {
    throw new Error(`ArtifactRun ${params.runId} not found`);
  }

  const mapped = mapArtifactRunRow(row);
  const spineRun = await executionSpineService.getRun(mapped.executionRunId, mapped.organizationId);
  const preflight = await computeArtifactRunPreflight({
    run: mapped,
    executionRunExists: Boolean(spineRun && typeof (spineRun as any).state === 'string'),
  });
  await persistArtifactRunPreflight({
    runId: params.runId,
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    preflight,
  });

  const updated = await getArtifactRun(params.runId, params.organizationId);
  if (!updated) throw new Error(`ArtifactRun ${params.runId} not found after preflight`);
  return updated;
}

export async function acceptArtifactRunPlan(params: {
  runId: string;
  organizationId: string;
  actorUserId: string;
}): Promise<ArtifactRunRecord> {
  const currentRow = await getArtifactRunRow(params.runId, params.organizationId);
  if (!currentRow) {
    throw new Error(`ArtifactRun ${params.runId} not found`);
  }
  const current = mapArtifactRunRow(currentRow);
  if (
    current.persistedRunStatus !== 'planned' &&
    current.persistedRunStatus !== 'retry_requested'
  ) {
    return current;
  }

  const proposal = await executionSpineService.createProposal({
    executionRunId: current.executionRunId,
    contextSnapshotRef: current.contextSnapshotId,
    proposalType: current.artifactId ? 'update_artifact' : 'create_artifact',
    targetRef: {
      artifactId: current.artifactId || current.runId,
      artifactType: current.plan.outputType,
      artifactModule: 'outputs_library',
      relationship: 'target',
    },
    summary: `Generate ${current.plan.outputType}: ${current.plan.titleHint}`,
    reason: 'ArtifactRun plan accepted from governed chat flow',
    mutationDescription: {
      operation: current.artifactId ? 'update' : 'create',
      targetFields: ['artifact', 'output'],
      payloadSummary: {
        artifactFamily: current.plan.artifactFamily,
        outputType: current.plan.outputType,
        visibilityScope: current.plan.visibilityScope,
      },
      reversibility: 'reversible',
      estimatedImpact: 'Creates or refreshes a governed output artifact',
    },
    riskClass: current.artifactId ? 'safe_update' : 'safe_additive',
    approvalClass: 'requires_human_approval',
    previewPayload: {
      diff: {
        lineDiff: buildWave5LineDiffForPreview(
          current.artifactId
            ? `Existing artifact ${current.artifactId} will be updated by ArtifactRun ${current.runId}.`
            : '',
          [
            `ArtifactRun ${current.runId} will create ${current.plan.outputType}.`,
            `Family: ${current.plan.artifactFamily}`,
            `Title: ${current.plan.titleHint}`,
            `Visibility: ${current.plan.visibilityScope}`,
          ].join('\n')
        ),
      },
      beforeState: current.artifactId
        ? {
            artifactId: current.artifactId,
            governance: 'existing_artifact_update_requires_review',
          }
        : null,
      afterState: {
        artifactFamily: current.plan.artifactFamily,
        outputType: current.plan.outputType,
        titleHint: current.plan.titleHint,
      },
      createdObjects: current.artifactId ? [] : ['artifact'],
      updatedFields: ['output'],
      destructiveImpact: null,
      followupEffects: ['execution_spine_review'],
    },
    dependsOn: [],
  });

  await executionSpineService.transitionRunState(
    current.executionRunId,
    params.organizationId,
    'proposals_ready',
    params.actorUserId,
    'ArtifactRun proposal created'
  );

  const now = new Date().toISOString();
  await dbRun(
    `UPDATE v8_artifact_runs
     SET proposal_id = ?, run_status = ?, updated_at = ?
     WHERE run_id = ? AND organization_id = ?`,
    [proposal.proposalId, 'proposal_created', now, params.runId, params.organizationId]
  );

  await emitRunAudit({
    runId: params.runId,
    organizationId: params.organizationId,
    action: 'plan_accepted',
    actorUserId: params.actorUserId,
    fromStatus: current.persistedRunStatus,
    toStatus: 'proposal_created',
    detail: { proposalId: proposal.proposalId },
  });

  const updated = await getArtifactRun(params.runId, params.organizationId);
  if (!updated) throw new Error(`ArtifactRun ${params.runId} not found after accept-plan`);
  return updated;
}

export async function retryArtifactRun(params: {
  runId: string;
  organizationId: string;
  actorUserId: string;
}): Promise<ArtifactRunRecord> {
  const currentRow = await getArtifactRunRow(params.runId, params.organizationId);
  if (!currentRow) {
    throw new Error(`ArtifactRun ${params.runId} not found`);
  }
  const current = mapArtifactRunRow(currentRow);
  if (!RETRYABLE_ARTIFACT_RUN_STATUSES.has(current.persistedRunStatus)) {
    throw new AppError(
      `ArtifactRun ${params.runId} cannot be retried from status ${current.persistedRunStatus}`,
      409,
      ARTIFACT_RUN_RETRY_NOT_ALLOWED,
      { runId: params.runId, runStatus: current.persistedRunStatus }
    );
  }

  const lockKey = `${params.organizationId}:${params.runId}`;
  return withArtifactRunRetryLock(lockKey, async () => {
    const lockedCurrentRow = await getArtifactRunRow(params.runId, params.organizationId);
    if (!lockedCurrentRow) {
      throw new Error(`ArtifactRun ${params.runId} not found`);
    }
    const lockedCurrent = mapArtifactRunRow(lockedCurrentRow);
    if (!RETRYABLE_ARTIFACT_RUN_STATUSES.has(lockedCurrent.persistedRunStatus)) {
      throw new AppError(
        `ArtifactRun ${params.runId} cannot be retried from status ${lockedCurrent.persistedRunStatus}`,
        409,
        ARTIFACT_RUN_RETRY_NOT_ALLOWED,
        { runId: params.runId, runStatus: lockedCurrent.persistedRunStatus }
      );
    }

    const existingChildren = await getArtifactRunChildRows(params.runId, params.organizationId);
    if (existingChildren.length > 0) {
      const existingChild = mapArtifactRunRow(existingChildren[0]);
      await emitRunAudit({
        runId: params.runId,
        organizationId: params.organizationId,
        action: 'retry_requested',
        actorUserId: params.actorUserId,
        fromStatus: lockedCurrent.persistedRunStatus,
        toStatus: lockedCurrent.persistedRunStatus,
        detail: { childRunId: existingChild.runId, reusedExistingChild: true },
      });
      return existingChild;
    }

    if (lockedCurrent.persistedRunStatus === 'failed' && lockedCurrent.materializationOrigin) {
      await cleanupGhostOutputsByOrigin({
        organizationId: params.organizationId,
        originRuntime: lockedCurrent.materializationOrigin.originRuntime,
        originRecordId: lockedCurrent.materializationOrigin.originRecordId,
      }).catch((error) => {
        logger.warn(`${LOG_PREFIX} Ghost artifact cleanup failed during retry`, {
          runId: params.runId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    const handoff = await chatExecutionService.initiateHandoff({
      conversationId: lockedCurrent.sourceContextId || lockedCurrent.runId,
      contextSnapshotId: lockedCurrent.contextSnapshotId,
      organizationId: params.organizationId,
      userId: params.actorUserId,
      goal: lockedCurrent.plan.titleHint,
    });

    await executionSpineService.transitionRunState(
      handoff.executionRunId,
      params.organizationId,
      'planning',
      params.actorUserId,
      'ArtifactRun retry requested'
    );

    const child = await createArtifactRunRecord({
      organizationId: params.organizationId,
      executionRunId: handoff.executionRunId,
      contextSnapshotId: lockedCurrent.contextSnapshotId,
      requestedByUserId: params.actorUserId,
      plan: lockedCurrent.plan,
      retryOfRunId: lockedCurrent.runId,
      sourceContextType: lockedCurrent.sourceContextType,
      sourceContextId: lockedCurrent.sourceContextId,
    });

    await emitRunAudit({
      runId: params.runId,
      organizationId: params.organizationId,
      action: 'retry_requested',
      actorUserId: params.actorUserId,
      fromStatus: lockedCurrent.persistedRunStatus,
      toStatus: lockedCurrent.persistedRunStatus,
      detail: { childRunId: child.runId, newExecutionRunId: handoff.executionRunId },
    });

    return child;
  });
}

export async function materializeArtifactRun(
  params: MaterializeArtifactRunParams
): Promise<ArtifactRunRecord> {
  const validated = MaterializeArtifactRunParamsSchema.parse(params);
  const currentRow = await getArtifactRunRow(validated.runId, validated.organizationId);
  if (!currentRow) {
    throw new Error(`ArtifactRun ${validated.runId} not found`);
  }
  const current = mapArtifactRunRow(currentRow);
  let materializationOrigin: { originRuntime: string; originRecordId: string } | null = null;
  if (
    current.plan.outputType !== 'report' &&
    current.plan.outputType !== 'presentation' &&
    current.plan.outputType !== 'sheet'
  ) {
    throw new Error(
      `ArtifactRun ${validated.runId} only supports report, presentation, or sheet materialization currently`
    );
  }
  if (
    current.persistedRunStatus === 'planned' ||
    current.persistedRunStatus === 'retry_requested' ||
    current.persistedRunStatus === 'rejected' ||
    current.persistedRunStatus === 'failed' ||
    current.persistedRunStatus === 'completed' ||
    current.persistedRunStatus === 'cancelled'
  ) {
    throw new Error(
      `ArtifactRun ${validated.runId} must have an accepted lifecycle before materialization`
    );
  }

  try {
    const spineRun = await executionSpineService.getRun(
      current.executionRunId,
      validated.organizationId
    );
    if (!spineRun) {
      throw new Error(
        `Execution run ${current.executionRunId} not found for ArtifactRun ${validated.runId}`
      );
    }

    const preflight = await computeArtifactRunPreflight({
      run: current,
      executionRunExists: true,
      materializationParams: validated,
    });
    await persistArtifactRunPreflight({
      runId: validated.runId,
      organizationId: validated.organizationId,
      actorUserId: validated.actorUserId,
      preflight,
    });
    if (preflight.state !== 'passed') {
      const unmetChecks = preflight.checks.filter((check) => check.status !== 'passed');
      throw new AppError(
        `ArtifactRun ${validated.runId} preflight blocked materialization`,
        409,
        'ARTIFACT_RUN_PREFLIGHT_BLOCKED',
        { runId: validated.runId, preflightState: preflight.state, unmetChecks }
      );
    }

    if (spineRun.state === 'proposals_ready') {
      throw new Error(
        `ArtifactRun ${validated.runId} must be submitted for review before materialization`
      );
    } else if (spineRun.state === 'waiting_for_review') {
      throw new Error(
        `ArtifactRun ${validated.runId} must be approved for apply before materialization`
      );
    } else if (spineRun.state === 'approved_for_apply') {
      await executionSpineService.applyRun(
        current.executionRunId,
        validated.organizationId,
        validated.actorUserId
      );
    } else if (spineRun.state !== 'applying') {
      throw new Error(
        `Execution run ${current.executionRunId} must be proposals_ready, waiting_for_review, approved_for_apply or applying before materialization`
      );
    }

    let resolvedArtifactId: string | null = null;
    if (current.plan.outputType === 'report') {
      const reportParams = await resolveMaterializedReportParams(current, validated);
      const reportBuilderService = await import('../reportBuilderService.js');
      const created = await reportBuilderService.createReport({
        organizationId: validated.organizationId,
        sourceType: reportParams.sourceType,
        sourceId: reportParams.sourceId,
        sourceName: reportParams.sourceName,
        title: reportParams.title,
        description: reportParams.description,
        templateId: reportParams.templateId,
        config: reportParams.config,
        createdBy: validated.actorUserId,
      });
      materializationOrigin = { originRuntime: 'report', originRecordId: created.report.id };
      await persistMaterializationOrigin({
        runId: validated.runId,
        organizationId: validated.organizationId,
        originRuntime: materializationOrigin.originRuntime,
        originRecordId: materializationOrigin.originRecordId,
      });

      const artifact = await getArtifactByOrigin({
        organizationId: validated.organizationId,
        originRuntime: 'report',
        originRecordId: created.report.id,
        userId: validated.actorUserId,
      });
      resolvedArtifactId = artifact?.artifactId || null;

      // Report creation registers the canonical artifact inside the same request path.
      // If the access-gated lookup races and returns null, fall back to the origin link
      // that was just persisted instead of failing the whole materialization.
      if (!resolvedArtifactId) {
        const link = await getOriginLinkByOrigin(
          validated.organizationId,
          'report',
          created.report.id
        );
        resolvedArtifactId = link?.artifactId || null;
      }

      // Backfill contextSnapshotId + executionRunId on the artifact row
      // (reportBuilderService.createReport does not pass these; match presentation branch)
      if (resolvedArtifactId && (current.contextSnapshotId || current.executionRunId)) {
        await dbRun(
          `UPDATE v8_output_artifacts
           SET context_snapshot_id = COALESCE(?, context_snapshot_id),
               execution_run_id = COALESCE(?, execution_run_id),
               last_transition_at = ?
           WHERE artifact_id = ? AND organization_id = ?`,
          [
            current.contextSnapshotId || null,
            current.executionRunId || null,
            new Date().toISOString(),
            resolvedArtifactId,
            validated.organizationId,
          ]
        );
      }
    } else if (current.plan.outputType === 'presentation') {
      const presentationParams = await resolveMaterializedPresentationParams(current, validated);
      const presentationGeneratorService = await import('../presentationGeneratorService.js');
      const outlined = await presentationGeneratorService.generateOutline(
        presentationParams.setup as any,
        validated.organizationId,
        validated.actorUserId
      );
      await presentationGeneratorService.generateDeck(
        outlined.deckId,
        outlined.outline,
        presentationParams.setup as any,
        validated.organizationId,
        validated.actorUserId
      );
      await registerArtifactOrigin({
        organizationId: validated.organizationId,
        outputType: 'presentation',
        artifactFamily: 'presentation',
        originRuntime: 'presentation',
        originRecordId: outlined.deckId,
        titleSnapshot: presentationParams.title,
        ownerUserId: validated.actorUserId,
        createdBy: validated.actorUserId,
        deliveryState: mapPresentationStatusToDeliveryState('ready'),
        visibilityScope: current.plan.visibilityScope,
        contextSnapshotId: current.contextSnapshotId,
        executionRunId: current.executionRunId,
        originSummary: presentationParams.originSummary,
      });
      materializationOrigin = { originRuntime: 'presentation', originRecordId: outlined.deckId };
      await persistMaterializationOrigin({
        runId: validated.runId,
        organizationId: validated.organizationId,
        originRuntime: materializationOrigin.originRuntime,
        originRecordId: materializationOrigin.originRecordId,
      });

      const artifact = await getArtifactByOrigin({
        organizationId: validated.organizationId,
        originRuntime: 'presentation',
        originRecordId: outlined.deckId,
        userId: validated.actorUserId,
      });
      resolvedArtifactId = artifact?.artifactId || null;
      if (!resolvedArtifactId) {
        const link = await getOriginLinkByOrigin(
          validated.organizationId,
          'presentation',
          outlined.deckId
        );
        resolvedArtifactId = link?.artifactId || null;
      }
    } else {
      const tableId =
        typeof validated.config?.tableId === 'string' ? validated.config.tableId.trim() : '';
      const tableName =
        typeof validated.config?.tableName === 'string' ? validated.config.tableName.trim() : '';
      await assertMaterializedTableReady({
        tableId,
        organizationId: validated.organizationId,
      });

      const artifact = await registerGovernedTableSheetArtifact({
        organizationId: validated.organizationId,
        userId: validated.actorUserId,
        tableId,
        tableName: tableName || validated.title || current.plan.titleHint,
        contextSnapshotId: current.contextSnapshotId,
        executionRunId: current.executionRunId,
      });
      materializationOrigin = { originRuntime: 'sheet', originRecordId: tableId };
      await persistMaterializationOrigin({
        runId: validated.runId,
        organizationId: validated.organizationId,
        originRuntime: materializationOrigin.originRuntime,
        originRecordId: materializationOrigin.originRecordId,
      });
      resolvedArtifactId = artifact.artifactId;
    }
    if (!resolvedArtifactId) {
      throw new Error(
        `Canonical artifact missing for ${current.plan.outputType} materialization ${validated.runId}`
      );
    }

    await executionSpineService.completeRun(
      current.executionRunId,
      validated.organizationId,
      validated.actorUserId
    );

    const now = new Date().toISOString();
    await dbRun(
      `UPDATE v8_artifact_runs
       SET artifact_id = ?,
           run_status = ?,
           failure_reason = NULL,
           failure_package_json = NULL,
           materialization_origin_runtime = COALESCE(?, materialization_origin_runtime),
           materialization_origin_record_id = COALESCE(?, materialization_origin_record_id),
           completed_at = ?,
           updated_at = ?
       WHERE run_id = ? AND organization_id = ?`,
      [
        resolvedArtifactId,
        'completed',
        materializationOrigin?.originRuntime ?? null,
        materializationOrigin?.originRecordId ?? null,
        now,
        now,
        validated.runId,
        validated.organizationId,
      ]
    );

    await emitRunAudit({
      runId: validated.runId,
      organizationId: validated.organizationId,
      action: 'materialized',
      actorUserId: validated.actorUserId,
      fromStatus: current.persistedRunStatus,
      toStatus: 'completed',
      detail: {
        artifactId: resolvedArtifactId,
        outputType: current.plan.outputType,
        originRuntime: materializationOrigin?.originRuntime,
      },
    });

    if (resolvedArtifactId) {
      await mirrorLegacyArtifactIntoWave5({
        organizationId: validated.organizationId,
        userId: validated.actorUserId,
        legacyArtifactId: resolvedArtifactId,
        outputType: current.plan.outputType,
        title: current.plan.titleHint,
        originRuntime: materializationOrigin?.originRuntime || null,
        originRecordId: materializationOrigin?.originRecordId || null,
        executionRunId: current.executionRunId,
        contextSnapshotId: current.contextSnapshotId,
      }).catch((err) => {
        logger.warn(`${LOG_PREFIX} Wave 5 mirror failed after materialization`, {
          runId: validated.runId,
          artifactId: resolvedArtifactId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    const completed = await getArtifactRun(validated.runId, validated.organizationId);
    if (!completed) {
      throw new Error(`ArtifactRun ${validated.runId} not found after materialization`);
    }
    return completed;
  } catch (error) {
    const operationalError = error instanceof AppError ? error : null;
    const failureStage: ArtifactRunFailurePackage['stage'] =
      operationalError?.code === 'ARTIFACT_RUN_PREFLIGHT_BLOCKED' ? 'preflight' : 'materialize';
    const failureReason =
      error instanceof Error ? error.message : 'ArtifactRun materialization failed';
    const now = new Date().toISOString();
    let ghostArtifactsCleanedUp = false;
    let cleanupNotes: string | null = null;

    if (materializationOrigin) {
      try {
        const cleanup = await cleanupGhostOutputsByOrigin({
          organizationId: validated.organizationId,
          originRuntime: materializationOrigin.originRuntime,
          originRecordId: materializationOrigin.originRecordId,
        });
        ghostArtifactsCleanedUp = cleanup.cleanedUp;
        cleanupNotes = cleanup.notes;
      } catch (cleanupError) {
        ghostArtifactsCleanedUp = false;
        cleanupNotes = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
    }

    const failurePackage: ArtifactRunFailurePackage = {
      stage: failureStage,
      message: failureReason,
      occurredAt: now,
      ghostArtifactsCleanedUp,
      cleanupNotes,
    };

    try {
      await executionSpineService.transitionRunState(
        current.executionRunId,
        validated.organizationId,
        'failed',
        validated.actorUserId,
        failureReason
      );
    } catch (spineError) {
      logger.warn(`${LOG_PREFIX} Failed to mark execution run as failed after ArtifactRun error`, {
        runId: validated.runId,
        executionRunId: current.executionRunId,
        error: spineError instanceof Error ? spineError.message : String(spineError),
      });
    }

    await dbRun(
      `UPDATE v8_artifact_runs
       SET run_status = ?,
           failure_reason = ?,
           failure_package_json = ?,
           materialization_origin_runtime = COALESCE(?, materialization_origin_runtime),
           materialization_origin_record_id = COALESCE(?, materialization_origin_record_id),
           completed_at = ?,
           updated_at = ?
       WHERE run_id = ? AND organization_id = ?`,
      [
        'failed',
        failureReason,
        JSON.stringify(failurePackage),
        materializationOrigin?.originRuntime ?? null,
        materializationOrigin?.originRecordId ?? null,
        now,
        now,
        validated.runId,
        validated.organizationId,
      ]
    );

    await emitRunAudit({
      runId: validated.runId,
      organizationId: validated.organizationId,
      action: 'failed',
      actorUserId: validated.actorUserId,
      fromStatus: current.persistedRunStatus,
      toStatus: 'failed',
      detail: { failureReason, stage: failureStage, ghostArtifactsCleanedUp },
    });

    // Surface a controlled operational error to the API layer so the UI
    // gets a meaningful materialization message instead of a generic 500.
    throw new AppError(
      failureReason,
      operationalError?.statusCode || 409,
      operationalError?.code || 'ARTIFACT_MATERIALIZE_FAILED',
      {
        runId: validated.runId,
        outputType: current.plan.outputType,
        executionRunId: current.executionRunId,
        stage: failureStage,
        ghostArtifactsCleanedUp,
        cleanupNotes,
        ...(operationalError?.details || {}),
      }
    );
  }
}
