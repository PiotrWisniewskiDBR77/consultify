import { z } from 'zod';

import type { ApprovalMode } from '../../models/agent/ApprovalMode.js';
import { APPROVAL_MODES } from '../../models/agent/ApprovalMode.js';
import type {
  ArtifactType,
  ExportFormat,
} from '../../models/artifact/ArtifactTypeRegistry.js';
import {
  ARTIFACT_TYPES,
  EXPORT_FORMATS,
} from '../../models/artifact/ArtifactTypeRegistry.js';
import type {
  ReattachOutcome,
  TypedComment,
} from '../../models/artifact/CommentsAndAnnotations.js';
import type { DataClassification } from '../../models/artifact/DataClassification.js';
import { DATA_CLASSIFICATIONS } from '../../models/artifact/DataClassification.js';
import {
  EXPORT_DESTINATIONS,
  type ExportDestination,
} from '../../models/artifact/ExportManifest.js';
import {
  LIBRARY_FOLDER_TRANSITION_EVENTS,
  LIBRARY_FOLDERS,
  type LibraryFolder,
  type LibraryFolderTransitionEvent,
} from '../../models/artifact/LibraryFolders.js';
import {
  FOOTER_TARGETS,
  type FooterTarget,
} from '../../models/artifact/ProvenanceFooter.js';
import type { ReviewEvent } from '../../models/artifact/ReviewStateMachine.js';
import { REVIEW_EVENTS } from '../../models/artifact/ReviewStateMachine.js';
import {
  type ApprovalContext,
  type ApprovalRoutingRule,
  type ApprovalRoutingTable,
  LEGAL_CONTENT_TAG,
  REVIEWER_ROLES,
  type ReviewerRole,
  ROUTING_MATCH_KINDS,
  STANDARD_PERSONAS,
} from '../../models/artifact/RoleBasedApprovalGates.js';
import { SELECTION_SCOPE_KINDS } from '../../models/artifact/SelectionScope.js';

const reviewStates = [
  'draft',
  'ready_for_review',
  'rejected',
  'approved',
  'published',
  'archived',
] as const;

export type ArtifactRuntimeReviewState = (typeof reviewStates)[number];

export const artifactRuntimeScopeSchema = z.object({
  tenantId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  userRole: z.string().trim().min(1).nullable().default(null),
});

export type ArtifactRuntimeScope = z.infer<typeof artifactRuntimeScopeSchema>;

const evidenceRefSchema = z.object({
  trustBundleSha256: z.string().trim().min(1),
  sourceHint: z.string().trim().min(1).nullable(),
});

const typedArtifactOpSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('json_patch'),
    path: z.string().trim().min(1),
    before: z.unknown().optional(),
    after: z.unknown(),
  }),
  z.object({
    kind: z.literal('replace_text'),
    nodeId: z.string().trim().min(1),
    before: z.string(),
    after: z.string(),
  }),
  z.object({
    kind: z.literal('move_block'),
    nodeId: z.string().trim().min(1),
    parentId: z.string().trim().min(1),
    fromIndex: z.number().int(),
    toIndex: z.number().int(),
  }),
  z.object({
    kind: z.literal('update_cell_formula'),
    cellId: z.string().trim().min(1),
    before: z.string(),
    after: z.string(),
    dependencies: z.array(z.string().trim().min(1)),
  }),
  z.object({
    kind: z.literal('update_chart_binding'),
    chartId: z.string().trim().min(1),
    before: z.object({
      sheetId: z.string().trim().min(1),
      start: z.string().trim().min(1),
      end: z.string().trim().min(1),
    }),
    after: z.object({
      sheetId: z.string().trim().min(1),
      start: z.string().trim().min(1),
      end: z.string().trim().min(1),
    }),
  }),
]);

export type ArtifactRuntimeTypedOp = z.infer<typeof typedArtifactOpSchema>;

const artifactSchema = z.object({
  id: z.string().trim().min(1),
  tenantId: z.string().trim().min(1),
  type: z.enum(ARTIFACT_TYPES),
  ownerId: z.string().trim().min(1),
  permissionPolicyId: z.string().trim().min(1),
  dataClassification: z.enum(DATA_CLASSIFICATIONS),
  retentionPolicyId: z.string().trim().min(1),
  reviewState: z.enum(reviewStates),
  currentVersionId: z.string().trim().min(1),
  lineageRootId: z.string().trim().min(1).nullable(),
  parentArtifactId: z.string().trim().min(1).nullable(),
  derivedFromVersionId: z.string().trim().min(1).nullable(),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
  archivedAt: z.string().trim().min(1).nullable(),
  exportRecords: z.array(z.string().trim().min(1)),
  evidenceRefs: z.array(evidenceRefSchema),
  content: z.unknown(),
});

export type ArtifactRuntimeArtifactDto = z.infer<typeof artifactSchema>;

const mutationProposalSchema = z.object({
  id: z.string().trim().min(1),
  artifactId: z.string().trim().min(1),
  declaredArtifactType: z.enum(ARTIFACT_TYPES),
  baseVersionId: z.string().trim().min(1).nullable(),
  intent: z.enum(['create_artifact', 'update_artifact', 'derive_artifact', 'archive']),
  sourceSet: z.array(evidenceRefSchema),
  ops: z.array(typedArtifactOpSchema),
  rationale: z.string(),
  citations: z.array(
    z.object({
      trustBundleSha256: z.string().trim().min(1),
      sourceHint: z.string().trim().min(1).nullable().optional(),
      span: z
        .object({
          start: z.number().int().nonnegative(),
          end: z.number().int().nonnegative(),
        })
        .optional(),
    })
  ),
  trustBundleHash: z.string().trim().min(1),
  reversibleTxnId: z.string().trim().min(1),
  preview: z.unknown(),
  createdAt: z.string().trim().min(1),
  proposedBy: z.string().trim().min(1),
  approvalRequired: z.boolean(),
  approvalMode: z.enum(APPROVAL_MODES),
});

export type ArtifactRuntimeMutationProposalDto = z.infer<typeof mutationProposalSchema>;

const selectionScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('empty') }),
  z.object({
    kind: z.literal('nodes'),
    nodeIds: z.array(z.string().trim().min(1)).min(1),
  }),
  z.object({
    kind: z.literal('range'),
    nodeIds: z.array(z.string().trim().min(1)).min(1),
    startNodeId: z.string().trim(),
    endNodeId: z.string().trim(),
  }),
]);

export type ArtifactRuntimeSelectionScopeDto = z.infer<typeof selectionScopeSchema>;

const selectionContextSchema = z.object({
  artifactId: z.string().trim().min(1),
  selection: selectionScopeSchema,
});

export const artifactRuntimeMutationPlanRequestSchema = z.object({
  scope: artifactRuntimeScopeSchema,
  runId: z.string().trim().min(1).optional(),
  now: z.string().trim().min(1).optional(),
  command: z.string(),
  artifact: artifactSchema,
  proposal: mutationProposalSchema,
  selectionContext: selectionContextSchema,
  selectedOpIndices: z.array(z.number().int().nonnegative()),
  reviewEvent: z.enum(REVIEW_EVENTS).default('submit_for_review'),
});

export type ArtifactRuntimeMutationPlanRequest = z.infer<
  typeof artifactRuntimeMutationPlanRequestSchema
>;

export const artifactRuntimeMutationApplyRequestSchema = artifactRuntimeMutationPlanRequestSchema;

export type ArtifactRuntimeMutationApplyRequest = z.infer<
  typeof artifactRuntimeMutationApplyRequestSchema
>;

const lineageNodeSchema = z.object({
  id: z.string().trim().min(1),
  lineageRootId: z.string().trim().min(1).nullable(),
  parentArtifactId: z.string().trim().min(1).nullable(),
  derivedFromVersionId: z.string().trim().min(1).nullable(),
  currentVersionId: z.string().trim().min(1),
});

const exportEvidenceRefSchema = z.object({
  sourceId: z.string().trim().min(1),
  uri: z.string().trim().min(1),
  retrievedAt: z.string().trim().min(1),
  excerpt: z.string().optional(),
});

const watermarkSpecSchema = z.object({
  text: z.string(),
  label: z.string().optional(),
});

const tenantWatermarkPolicySchema = z.object({
  watermarkRequired: z.boolean(),
  defaultText: z.string().optional(),
});

export const artifactRuntimeExportPlanRequestSchema = z.object({
  scope: artifactRuntimeScopeSchema,
  runId: z.string().trim().min(1).optional(),
  now: z.string().trim().min(1).optional(),
  artifact: artifactSchema,
  lineageNodes: z.array(lineageNodeSchema).min(1),
  sha256: z.string().trim().min(1),
  format: z.enum(EXPORT_FORMATS),
  destination: z.enum(EXPORT_DESTINATIONS),
  sources: z.array(exportEvidenceRefSchema),
  confidentialityTags: z.array(z.string()),
  watermark: watermarkSpecSchema,
  tenantWatermarkPolicy: tenantWatermarkPolicySchema,
  footerTarget: z.enum(FOOTER_TARGETS),
});

export type ArtifactRuntimeExportPlanRequest = z.infer<
  typeof artifactRuntimeExportPlanRequestSchema
>;

const commentSchema = z.object({
  id: z.string().trim().min(1),
  anchor: z.object({
    nodeId: z.string().trim().min(1),
    range: z
      .object({
        startOffset: z.number().int(),
        endOffset: z.number().int(),
      })
      .nullable(),
  }),
  author: z.string().trim().min(1),
  body: z.string(),
  mentions: z.array(z.string().trim().min(1)),
  kind: z.enum(['question', 'suggestion', 'issue', 'approval_note']),
  state: z.enum(['unresolved', 'resolved']),
  orphaned: z.boolean(),
  createdAt: z.string().trim().min(1),
  resolvedAt: z.string().trim().min(1).nullable(),
});

const mentionNotificationIntentSchema = z.object({
  commentId: z.string().trim().min(1),
  recipient: z.string().trim().min(1),
  emittedAt: z.string().trim().min(1),
});

const anchorMutationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('node_deleted'),
    nodeId: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal('node_renamed'),
    nodeId: z.string().trim().min(1),
    newNodeId: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal('range_shifted'),
    nodeId: z.string().trim().min(1),
    shiftFromOffset: z.number().int(),
    shiftDelta: z.number().int(),
  }),
  z.object({
    kind: z.literal('range_deleted'),
    nodeId: z.string().trim().min(1),
    deletedStart: z.number().int(),
    deletedEnd: z.number().int(),
  }),
]);

export const artifactRuntimeCommentPlanRequestSchema = z.object({
  scope: artifactRuntimeScopeSchema,
  comment: commentSchema,
  notificationIntents: z.array(mentionNotificationIntentSchema),
  mutation: anchorMutationSchema.optional(),
});

export type ArtifactRuntimeCommentPlanRequest = z.infer<
  typeof artifactRuntimeCommentPlanRequestSchema
>;

const artifactSectionSchema: z.ZodType<{
  name: string;
  nodeKinds: string[];
  children?: Array<{
    name: string;
    nodeKinds: string[];
    children?: unknown[];
  }>;
}> = z.lazy(() =>
  z.object({
    name: z.string(),
    nodeKinds: z.array(z.string()),
    children: z.array(artifactSectionSchema).optional(),
  })
);

const artifactStructureSchema = z.object({
  artifactType: z.string().trim().min(1),
  sections: z.array(artifactSectionSchema),
});

const folderPlacementSchema = z.object({
  reviewState: z.enum(reviewStates),
  everExported: z.boolean(),
  isTemplate: z.boolean(),
  storedFolder: z.enum(LIBRARY_FOLDERS).optional(),
});

const folderTransitionSchema = z.object({
  prior: z.enum(LIBRARY_FOLDERS),
  next: z.enum(LIBRARY_FOLDERS),
  event: z.enum(LIBRARY_FOLDER_TRANSITION_EVENTS),
});

export const artifactRuntimeTemplateFingerprintRequestSchema = z.object({
  scope: artifactRuntimeScopeSchema,
  structure: artifactStructureSchema,
  libraryFingerprints: z.array(z.string().trim().min(1)).default([]),
  placement: folderPlacementSchema.optional(),
  transition: folderTransitionSchema.optional(),
});

export type ArtifactRuntimeTemplateFingerprintRequest = z.infer<
  typeof artifactRuntimeTemplateFingerprintRequestSchema
>;

const approvalRoutingMatchSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('artifact_type'),
    value: z.enum(ARTIFACT_TYPES),
  }),
  z.object({
    kind: z.literal('content_tag'),
    value: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal('classification'),
    value: z.enum(DATA_CLASSIFICATIONS),
  }),
  z.object({
    kind: z.literal('persona'),
    value: z.enum(STANDARD_PERSONAS),
  }),
]);

const approvalRoutingRuleSchema = z.object({
  id: z.string().trim().min(1),
  priority: z.number().finite(),
  match: approvalRoutingMatchSchema,
  requires: z.enum(REVIEWER_ROLES),
});

const approvalRoutingTableSchema = z.object({
  tenantId: z.string().trim().min(1),
  rules: z.array(approvalRoutingRuleSchema),
  defaultRoute: z.enum(REVIEWER_ROLES),
});

const approvalContextSchema = z.object({
  artifactType: z.enum(ARTIFACT_TYPES).optional(),
  contentTags: z.array(z.string().trim().min(1)).optional(),
  classification: z.enum(DATA_CLASSIFICATIONS).optional(),
  persona: z.enum(STANDARD_PERSONAS).optional(),
});

export const artifactRuntimeApprovalEvaluateRequestSchema = z.object({
  scope: artifactRuntimeScopeSchema,
  context: approvalContextSchema,
  routingTable: approvalRoutingTableSchema,
  baselineRoutingTable: approvalRoutingTableSchema.optional(),
});

export type ArtifactRuntimeApprovalEvaluateRequest = z.infer<
  typeof artifactRuntimeApprovalEvaluateRequestSchema
>;

export interface ArtifactRuntimeMutationPlanResponse {
  scope: ArtifactRuntimeScope;
  runId: string;
  status: 'ready' | 'apply_ready' | 'rejected';
  scopeVerdict:
    | { kind: 'whole_artifact' }
    | { kind: 'scoped_to_selection'; nodeIds: string[] }
    | {
        kind: 'rejected';
        reason: string;
        triggeringLexeme: string | null;
        clarificationSeed: string;
      };
  selectedOpIndices: number[];
  acceptedOpIndices: number[];
  rejectedOpIndices: number[];
  previousReviewState?: ArtifactRuntimeReviewState;
  nextReviewState?: ArtifactRuntimeReviewState;
  auditEvent?: Record<string, unknown>;
  proposalId?: string;
  callerTokenIssued?: boolean;
}

export interface ArtifactRuntimeMutationApplyResponse extends ArtifactRuntimeMutationPlanResponse {
  status: 'apply_ready' | 'rejected';
  acceptedOps: ArtifactRuntimeTypedOp[];
  reverseOps: ArtifactRuntimeTypedOp[];
}

export interface ArtifactRuntimeExportPlanResponse {
  scope: ArtifactRuntimeScope;
  runId: string;
  exportAllowed: boolean;
  manifest: Record<string, unknown>;
  provenanceFooter: Record<string, unknown>;
  lineageRootId: string;
}

export interface ArtifactRuntimeCommentPlanResponse {
  scope: ArtifactRuntimeScope;
  commentId: string;
  notificationsPlanned: number;
  mentionedUserIds: string[];
  reattachResult?: {
    outcome: ReattachOutcome;
    comment: TypedComment;
  };
}

export interface ArtifactRuntimeTemplateFingerprintResponse {
  scope: ArtifactRuntimeScope;
  fingerprint: string;
  matchesLibrary: boolean;
  matchingLibraryCount: number;
  placement?: {
    derivedFolder: LibraryFolder;
    storedFolderValidated: boolean;
  };
  transition?: {
    prior: LibraryFolder;
    next: LibraryFolder;
    event: LibraryFolderTransitionEvent;
    valid: true;
  };
}

export interface ArtifactRuntimeApprovalEvaluateResponse {
  scope: ArtifactRuntimeScope;
  requiredReviewer: ReviewerRole;
  resolvedByRuleId: string | null;
  matchedRuleIds: string[];
  defaultRouteUsed: boolean;
  invariants: {
    restrictedRequiresCiso: true;
    legalTagRequiresLegal: true;
    cfoArtifactRequiresFinance: true;
    defaultRoutesForStandardPersonas: true;
    routingCoverage: true;
    baselineNotWeakened: true | null;
  };
}

export interface ArtifactRuntimeServiceContract {
  planMutation(input: ArtifactRuntimeMutationPlanRequest): ArtifactRuntimeMutationPlanResponse;
  applyMutation(input: ArtifactRuntimeMutationApplyRequest): ArtifactRuntimeMutationApplyResponse;
  planExport(input: ArtifactRuntimeExportPlanRequest): ArtifactRuntimeExportPlanResponse;
  planComment(input: ArtifactRuntimeCommentPlanRequest): ArtifactRuntimeCommentPlanResponse;
  fingerprintTemplate(
    input: ArtifactRuntimeTemplateFingerprintRequest
  ): ArtifactRuntimeTemplateFingerprintResponse;
  evaluateApprovals(
    input: ArtifactRuntimeApprovalEvaluateRequest
  ): ArtifactRuntimeApprovalEvaluateResponse;
}

export type ArtifactRuntimeResolvedApprovalContext = ApprovalContext;
export type ArtifactRuntimeResolvedApprovalRule = ApprovalRoutingRule;
export type ArtifactRuntimeResolvedApprovalTable = ApprovalRoutingTable;
export type ArtifactRuntimeResolvedApprovalMode = ApprovalMode;
export type ArtifactRuntimeResolvedArtifactType = ArtifactType;
export type ArtifactRuntimeResolvedDataClassification = DataClassification;
export type ArtifactRuntimeResolvedReviewEvent = ReviewEvent;
export type ArtifactRuntimeResolvedExportFormat = ExportFormat;
export type ArtifactRuntimeResolvedExportDestination = ExportDestination;
export type ArtifactRuntimeResolvedFooterTarget = FooterTarget;
export const ARTIFACT_RUNTIME_SELECTION_SCOPE_KINDS = SELECTION_SCOPE_KINDS;
export const ARTIFACT_RUNTIME_ROUTING_MATCH_KINDS = ROUTING_MATCH_KINDS;
export const ARTIFACT_RUNTIME_STANDARD_PERSONAS = STANDARD_PERSONAS;
export const ARTIFACT_RUNTIME_LEGAL_CONTENT_TAG = LEGAL_CONTENT_TAG;
