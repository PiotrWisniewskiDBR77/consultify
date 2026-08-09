import { z } from 'zod';

import type { OperationContract } from './operationContract.js';

export const ArtifactFamilyValues = ['document', 'presentation', 'sheet', 'template'] as const;
export type ArtifactFamily = (typeof ArtifactFamilyValues)[number];

export const ArtifactVisibilityScopeValues = [
  'private',
  'project',
  'organization',
  'review_shared',
  'demo',
] as const;
export type ArtifactVisibilityScope = (typeof ArtifactVisibilityScopeValues)[number];

export const ArtifactOriginRuntimeValues = [
  'report',
  'presentation',
  'sheet',
  'native_artifact',
  'report_template',
  'presentation_template',
  // Fala B (2026-07-22): DB CHECK constraint already extended for this value
  // (server/migrations/20260412_seed_business_templates.sql, seeded bt-sheet-*
  // rows) — the TS enum just hadn't caught up. Mirrors report_template /
  // presentation_template for sheet (Excel/arkusz) templates.
  'sheet_template',
  // R11 (doc slice, 2026-07-24): canonical Document Studio templates
  // (`document_studio_templates`). DB CHECK extended by
  // server/migrations/20260724_origin_runtime_document_template.sql.
  'document_template',
  // T22-DATA-PREREQ (2026-08-07): the DB CHECK is brought back into parity
  // with this already-supported runtime by the assessment_report migration.
  'work_canvas',
  // T22-DATA-PREREQ (2026-08-07): AssessmentWorkbenchService.recordPromotion
  // (server/src/services/assessment/AssessmentWorkbenchService.ts) has always
  // called registerArtifactOrigin with this value for the P28 "promote to
  // Outputs Library" handoff, but it was never in this enum (nor in the DB
  // CHECK it mirrors), so every assessment promotion failed Zod validation
  // before reaching the database and silently degraded. DB CHECK extended by
  // server/migrations/20260807_origin_runtime_assessment_report.sql.
  'assessment_report',
] as const;
export type ArtifactOriginRuntime = (typeof ArtifactOriginRuntimeValues)[number];

export const ArtifactCanonicalHomeValues = ['outputs_library'] as const;
export type ArtifactCanonicalHome = (typeof ArtifactCanonicalHomeValues)[number];

export const ArtifactPlanOutputTypeValues = ['report', 'presentation', 'sheet'] as const;
export type ArtifactPlanOutputType = (typeof ArtifactPlanOutputTypeValues)[number];

export const ArtifactRunTriggerTypeValues = [
  'chat',
  'module_action',
  'template',
  'refresh',
] as const;
export type ArtifactRunTriggerType = (typeof ArtifactRunTriggerTypeValues)[number];

export const ArtifactRunStatusValues = [
  'planned',
  'proposal_created',
  'awaiting_review',
  'approved_for_apply',
  'applying',
  'rejected',
  'retry_requested',
  'completed',
  'failed',
  'cancelled',
] as const;
export type ArtifactRunStatus = (typeof ArtifactRunStatusValues)[number];

export type ArtifactRunPreflightState = 'passed' | 'pending' | 'attention_required';

export interface ArtifactRunPreflight {
  state: ArtifactRunPreflightState;
  computedAt: string;
  checks: Array<{
    id:
      | 'execution_run_resolvable'
      | 'plan_supported'
      | 'materialization_inputs'
      | 'materialization_target';
    status: 'passed' | 'pending' | 'failed';
    message: string;
  }>;
}

export interface ArtifactRunFailurePackage {
  stage: 'preflight' | 'materialize' | 'retry';
  message: string;
  occurredAt: string;
  ghostArtifactsCleanedUp?: boolean;
  cleanupNotes?: string | null;
}

export const ArtifactRunReportSourceTypeValues = [
  'ASSESSMENT',
  'INTERVIEW',
  'TOOL',
  'INITIATIVE',
  'UPLOAD_BUNDLE',
  'FINANCIAL_ANALYSIS',
  'VALUATION',
  'RESULTS_KPI_REPORT',
] as const;
export type ArtifactRunReportSourceType = (typeof ArtifactRunReportSourceTypeValues)[number];

export interface ArtifactRecord {
  artifactId: string;
  organizationId: string;
  outputType: 'report' | 'presentation' | 'sheet';
  artifactFamily: ArtifactFamily;
  deliveryState: string;
  titleSnapshot: string | null;
  ownerUserId: string | null;
  canonicalHome: ArtifactCanonicalHome;
  visibilityScope: ArtifactVisibilityScope;
  projectId: string | null;
  contextSnapshotId: string | null;
  executionRunId: string | null;
  templateFamilyRef: string | null;
  sourceInitiativeId: string | null;
  aiGovernancePresetRef: string | null;
  originSummary: Record<string, unknown> | null;
  /** Presentational draft/junk flag. true = throwaway/test/draft, hidden from default listings. */
  isDraft: boolean;
  createdBy: string;
  createdAt: string;
  lastTransitionAt: string;
}

export interface ArtifactOriginLink {
  linkId: string;
  artifactId: string;
  organizationId: string;
  originRuntime: ArtifactOriginRuntime;
  originRecordId: string;
  isPrimaryOrigin: boolean;
  createdAt: string;
}

export interface ArtifactAccessGrant {
  grantId: string;
  artifactId: string;
  organizationId: string;
  grantKind: 'user' | 'role';
  userId: string | null;
  roleKey: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ArtifactListItem extends ArtifactRecord {
  originRuntime: ArtifactOriginRuntime | null;
  originRecordId: string | null;
  resolvedTitle: string;
  originTitle: string | null;
  originStatus: string | null;
  reportType: string | null;
  presentationMode: string | null;
  slideCount: number | null;
  exportFormat: string | null;
  sourceRefs: unknown[];
  publishState: string | null;
  publishReviewers: string[];
  reviewGateCount: number;
  ownerName: string | null;
  /**
   * Presentational dedup metadata. When identical name+type+origin artifacts
   * collapse into one list row, the newest is kept and this reports how many
   * older versions it stands in for (1 = unique, no duplicates hidden).
   */
  duplicateCount: number;
  /** Artifact IDs of the older duplicates collapsed under this row (newest→oldest). */
  duplicateArtifactIds: string[];
}

export interface ArtifactListFilters {
  outputType?: 'report' | 'presentation' | 'sheet';
  artifactFamily?: ArtifactFamily;
  visibilityScope?: ArtifactVisibilityScope;
  ownerUserId?: string;
  sourceInitiativeId?: string;
  search?: string;
  limit?: number;
  onlyMine?: boolean;
  reviewSharedForUserId?: string;
  /**
   * Draft handling for the M17 junk filter (S6.3):
   *   - undefined / 'exclude' → only real/final artifacts (default listing).
   *   - 'include'             → real + drafts (for the "Robocze" view).
   *   - 'only'                → drafts only.
   */
  drafts?: 'exclude' | 'include' | 'only';
  /**
   * Collapse identical name+type+origin duplicates into a single newest row
   * with a version count. Presentational only — no data is mutated. Defaults on.
   */
  dedupe?: boolean;
}

export interface RegisterArtifactOriginParams {
  organizationId: string;
  outputType: 'report' | 'presentation' | 'sheet';
  artifactFamily: ArtifactFamily;
  originRuntime: ArtifactOriginRuntime;
  originRecordId: string;
  titleSnapshot?: string | null;
  ownerUserId?: string | null;
  createdBy: string;
  deliveryState?: string;
  visibilityScope?: ArtifactVisibilityScope;
  projectId?: string | null;
  contextSnapshotId?: string | null;
  executionRunId?: string | null;
  templateFamilyRef?: string | null;
  sourceInitiativeId?: string | null;
  aiGovernancePresetRef?: string | null;
  originSummary?: Record<string, unknown> | null;
}

export interface CreateArtifactAccessGrantParams {
  organizationId: string;
  artifactId: string;
  grantKind: 'user' | 'role';
  userId?: string | null;
  roleKey?: string | null;
  createdBy: string;
}

export interface ArtifactPlanningRequest {
  organizationId: string;
  userId: string;
  conversationId: string;
  contextSnapshotId: string;
  goal: string;
  requestedArtifactFamily?: ArtifactFamily;
  requestedOutputType?: ArtifactPlanOutputType;
}

export interface ArtifactPlanningResult {
  artifactRunId: string;
  executionRunId: string;
  artifactPlan: {
    artifactFamily: ArtifactFamily;
    outputType: ArtifactPlanOutputType;
    titleHint: string;
    governancePath: 'execution_spine';
    visibilityScope: ArtifactVisibilityScope;
  };
}

export interface ArtifactRunRecord {
  runId: string;
  artifactId: string | null;
  organizationId: string;
  executionRunId: string;
  contextSnapshotId: string;
  triggerType: ArtifactRunTriggerType;
  sourceContextType: string | null;
  sourceContextId: string | null;
  requestedByUserId: string;
  plan: ArtifactPlanningResult['artifactPlan'];
  persistedRunStatus: ArtifactRunStatus;
  effectiveRunStatus: ArtifactRunStatus;
  /** Backward-compatible alias of effectiveRunStatus. */
  runStatus: ArtifactRunStatus;
  proposalId: string | null;
  retryOfRunId: string | null;
  failureReason: string | null;
  preflight: ArtifactRunPreflight | null;
  failurePackage: ArtifactRunFailurePackage | null;
  materializationOrigin: {
    originRuntime: ArtifactOriginRuntime;
    originRecordId: string;
  } | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  operationContract?: OperationContract;
}

export interface MaterializeArtifactRunParams {
  organizationId: string;
  runId: string;
  actorUserId: string;
  title?: string;
  description?: string;
  sourceType?: string;
  sourceId?: string;
  sourceName?: string;
  templateId?: string;
  config?: Record<string, unknown>;
}

export const ArtifactRecordSchema = z.object({
  artifactId: z.string().min(1),
  organizationId: z.string().min(1),
  outputType: z.enum(['report', 'presentation', 'sheet']),
  artifactFamily: z.enum(ArtifactFamilyValues),
  deliveryState: z.string().min(1),
  titleSnapshot: z.string().nullable(),
  ownerUserId: z.string().nullable(),
  canonicalHome: z.enum(ArtifactCanonicalHomeValues),
  visibilityScope: z.enum(ArtifactVisibilityScopeValues),
  projectId: z.string().nullable(),
  contextSnapshotId: z.string().nullable(),
  executionRunId: z.string().nullable(),
  templateFamilyRef: z.string().nullable(),
  sourceInitiativeId: z.string().nullable(),
  aiGovernancePresetRef: z.string().nullable(),
  originSummary: z.record(z.string(), z.unknown()).nullable(),
  isDraft: z.boolean().optional().default(false),
  createdBy: z.string().min(1),
  createdAt: z.string().min(1),
  lastTransitionAt: z.string().min(1),
});

export const RegisterArtifactOriginParamsSchema = z.object({
  organizationId: z.string().min(1),
  outputType: z.enum(['report', 'presentation', 'sheet']),
  artifactFamily: z.enum(ArtifactFamilyValues),
  originRuntime: z.enum(ArtifactOriginRuntimeValues),
  originRecordId: z.string().min(1),
  titleSnapshot: z.string().nullable().optional().default(null),
  ownerUserId: z.string().nullable().optional().default(null),
  createdBy: z.string().min(1),
  deliveryState: z.string().optional().default('draft'),
  visibilityScope: z.enum(ArtifactVisibilityScopeValues).optional().default('organization'),
  projectId: z.string().nullable().optional().default(null),
  contextSnapshotId: z.string().nullable().optional().default(null),
  executionRunId: z.string().nullable().optional().default(null),
  templateFamilyRef: z.string().nullable().optional().default(null),
  sourceInitiativeId: z.string().nullable().optional().default(null),
  aiGovernancePresetRef: z.string().nullable().optional().default(null),
  originSummary: z.record(z.string(), z.unknown()).nullable().optional().default(null),
});

export const CreateArtifactAccessGrantParamsSchema = z.object({
  organizationId: z.string().min(1),
  artifactId: z.string().min(1),
  grantKind: z.enum(['user', 'role']),
  userId: z.string().nullable().optional().default(null),
  roleKey: z.string().nullable().optional().default(null),
  createdBy: z.string().min(1),
});

export const ArtifactPlanningRequestSchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1),
  conversationId: z.string().min(1),
  contextSnapshotId: z.string().min(1),
  goal: z.string().min(1),
  requestedArtifactFamily: z.enum(ArtifactFamilyValues).optional(),
  requestedOutputType: z.enum(ArtifactPlanOutputTypeValues).optional(),
});

export const MaterializeArtifactRunParamsSchema = z.object({
  organizationId: z.string().min(1),
  runId: z.string().min(1),
  actorUserId: z.string().min(1),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  sourceType: z.string().trim().min(1).optional(),
  sourceId: z.string().trim().min(1).optional(),
  sourceName: z.string().trim().min(1).optional(),
  templateId: z.string().trim().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});
