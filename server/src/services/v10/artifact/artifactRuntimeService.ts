import { ZodError } from 'zod';

import { unsafeActorId } from '../../../models/agent/ExecutionProposalV1.js';
import {
  type Artifact,
  unsafeArtifactId,
  unsafeArtifactVersionId,
  unsafePolicyId,
  unsafeRetentionPolicyId,
  unsafeTenantId,
  unsafeUserId,
} from '../../../models/artifact/Artifact.js';
import type { ArtifactCanonicalContent } from '../../../models/artifact/ArtifactCanonicalContent.js';
import { unsafeNodeId } from '../../../models/artifact/ArtifactCanonicalContent.js';
import type { ArtifactOp } from '../../../models/artifact/ArtifactOp.js';
import {
  assertArtifactOp,
  reverseArtifactOps,
  unsafeCellId,
  unsafeChartId,
} from '../../../models/artifact/ArtifactOp.js';
import type { LineageNode } from '../../../models/artifact/ArtifactVersionLineage.js';
import {
  assertLineageInvariant,
  buildLineageGraph,
} from '../../../models/artifact/ArtifactVersionLineage.js';
import type {
  AnchorMutation,
  MentionNotificationIntent,
  TypedComment,
} from '../../../models/artifact/CommentsAndAnnotations.js';
import {
  assertAnchorSurvivesMutation,
  assertMentionNotifications,
  assertTypedComment,
  reattachCommentToMutation,
} from '../../../models/artifact/CommentsAndAnnotations.js';
import { canExportToFormat } from '../../../models/artifact/DataClassification.js';
import type {
  EvidenceRef as ExportEvidenceRef,
  ExportDestination,
} from '../../../models/artifact/ExportManifest.js';
import {
  assertFolderTransitionSound,
  assertLibraryFolderPlacement,
  placeArtifactInFolder,
} from '../../../models/artifact/LibraryFolders.js';
import type { MutationProposal } from '../../../models/artifact/MutationProposal.js';
import {
  assertMutationProposal,
  unsafeMutationProposalId,
  unsafeTrustBundleHash,
  unsafeTxnId,
} from '../../../models/artifact/MutationProposal.js';
import type {
  FooterTarget,
  TenantWatermarkPolicy,
  WatermarkSpec,
} from '../../../models/artifact/ProvenanceFooter.js';
import type { ReviewEvent } from '../../../models/artifact/ReviewStateMachine.js';
import type {
  ApprovalContext,
  ApprovalRoutingRule,
  ApprovalRoutingTable,
} from '../../../models/artifact/RoleBasedApprovalGates.js';
import {
  assertApprovalRoutingTable,
  assertCfoArtifactRequiresFinance,
  assertDefaultRoutesForStandardPersonas,
  assertLegalTagRequiresLegal,
  assertRestrictedRequiresCiso,
  assertRoutingCoverage,
  assertTenantOverrideDoesNotWeakenBaseline,
  resolveRequiredReviewer,
} from '../../../models/artifact/RoleBasedApprovalGates.js';
import type {
  ScopeVerdict,
  SelectionContext,
} from '../../../models/artifact/SelectionScope.js';
import {
  assertOpsWithinSelection,
  resolveOpScope,
} from '../../../models/artifact/SelectionScope.js';
import type { ArtifactStructure } from '../../../models/artifact/TemplateFingerprint.js';
import {
  assertFingerprintDeterministic,
  computeTemplateFingerprint,
} from '../../../models/artifact/TemplateFingerprint.js';
import {
  runArtifactExportPipeline,
  unsafeArtifactExportRunId,
} from '../../../models/v10/pipelines/ArtifactExportPipeline.js';
import {
  runArtifactMutationPipeline,
  unsafeArtifactMutationRunId,
} from '../../../models/v10/pipelines/ArtifactMutationPipeline.js';
import {
  type ArtifactRuntimeApprovalEvaluateRequest,
  artifactRuntimeApprovalEvaluateRequestSchema,
  type ArtifactRuntimeApprovalEvaluateResponse,
  type ArtifactRuntimeArtifactDto,
  type ArtifactRuntimeCommentPlanRequest,
  artifactRuntimeCommentPlanRequestSchema,
  type ArtifactRuntimeCommentPlanResponse,
  type ArtifactRuntimeExportPlanRequest,
  artifactRuntimeExportPlanRequestSchema,
  type ArtifactRuntimeExportPlanResponse,
  type ArtifactRuntimeMutationApplyRequest,
  artifactRuntimeMutationApplyRequestSchema,
  type ArtifactRuntimeMutationApplyResponse,
  type ArtifactRuntimeMutationPlanRequest,
  artifactRuntimeMutationPlanRequestSchema,
  type ArtifactRuntimeMutationPlanResponse,
  type ArtifactRuntimeMutationProposalDto,
  type ArtifactRuntimeScope,
  type ArtifactRuntimeServiceContract,
  type ArtifactRuntimeTemplateFingerprintRequest,
  artifactRuntimeTemplateFingerprintRequestSchema,
  type ArtifactRuntimeTemplateFingerprintResponse,
  type ArtifactRuntimeTypedOp,
} from '../../../types/v10/artifact-runtime.js';

class ArtifactRuntimeInputError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 422) {
    super(message);
    this.name = 'ArtifactRuntimeInputError';
    this.code = code;
    this.status = status;
  }
}

function resolveRunId(provided?: string): string {
  return provided?.trim() || crypto.randomUUID();
}

function resolveNow(provided?: string): string {
  return provided?.trim() || new Date().toISOString();
}

function toTypedOps(ops: ArtifactRuntimeTypedOp[]): ArtifactOp[] {
  return ops.map((op) => {
    assertArtifactOp(op as ArtifactOp);
    if (op.kind === 'update_cell_formula') {
      return {
        ...op,
        cellId: unsafeCellId(op.cellId),
        dependencies: op.dependencies.map((dependency) => unsafeCellId(dependency)),
      };
    }
    if (op.kind === 'update_chart_binding') {
      return {
        ...op,
        chartId: unsafeChartId(op.chartId),
      };
    }
    return op;
  });
}

function toArtifact(dto: ArtifactRuntimeArtifactDto): Artifact {
  return {
    id: unsafeArtifactId(dto.id),
    tenantId: unsafeTenantId(dto.tenantId),
    type: dto.type,
    ownerId: unsafeUserId(dto.ownerId),
    permissionPolicyId: unsafePolicyId(dto.permissionPolicyId),
    dataClassification: dto.dataClassification,
    retentionPolicyId: unsafeRetentionPolicyId(dto.retentionPolicyId),
    reviewState: dto.reviewState,
    currentVersionId: unsafeArtifactVersionId(dto.currentVersionId),
    lineageRootId: dto.lineageRootId ? unsafeArtifactId(dto.lineageRootId) : null,
    parentArtifactId: dto.parentArtifactId ? unsafeArtifactId(dto.parentArtifactId) : null,
    derivedFromVersionId: dto.derivedFromVersionId
      ? unsafeArtifactVersionId(dto.derivedFromVersionId)
      : null,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    archivedAt: dto.archivedAt,
    exportRecords: dto.exportRecords,
    evidenceRefs: dto.evidenceRefs as Artifact['evidenceRefs'],
    content: dto.content as Artifact['content'],
  };
}

function toMutationProposal(dto: ArtifactRuntimeMutationProposalDto): MutationProposal {
  return {
    id: unsafeMutationProposalId(dto.id),
    artifactId: unsafeArtifactId(dto.artifactId),
    declaredArtifactType: dto.declaredArtifactType,
    baseVersionId: dto.baseVersionId ? unsafeArtifactVersionId(dto.baseVersionId) : null,
    intent: dto.intent,
    sourceSet: dto.sourceSet as MutationProposal['sourceSet'],
    ops: toTypedOps(dto.ops),
    rationale: dto.rationale,
    citations: dto.citations as MutationProposal['citations'],
    trustBundleHash: unsafeTrustBundleHash(dto.trustBundleHash),
    reversibleTxnId: unsafeTxnId(dto.reversibleTxnId),
    preview: dto.preview as ArtifactCanonicalContent,
    createdAt: dto.createdAt,
    proposedBy: unsafeActorId(dto.proposedBy),
    approvalRequired: dto.approvalRequired,
    approvalMode: dto.approvalMode,
  };
}

function toSelectionContext(input: ArtifactRuntimeMutationPlanRequest): SelectionContext {
  return {
    artifactId: unsafeArtifactId(input.selectionContext.artifactId),
    selection:
      input.selectionContext.selection.kind === 'empty'
        ? { kind: 'empty' }
        : input.selectionContext.selection.kind === 'nodes'
          ? {
              kind: 'nodes',
              nodeIds: input.selectionContext.selection.nodeIds.map((nodeId) =>
                unsafeNodeId(nodeId)
              ),
            }
          : {
              kind: 'range',
              nodeIds: input.selectionContext.selection.nodeIds.map((nodeId) =>
                unsafeNodeId(nodeId)
              ),
              startNodeId: unsafeNodeId(input.selectionContext.selection.startNodeId),
              endNodeId: unsafeNodeId(input.selectionContext.selection.endNodeId),
            },
  };
}

function normalizeScopeVerdict(
  verdict: ScopeVerdict
): ArtifactRuntimeMutationPlanResponse['scopeVerdict'] {
  if (verdict.kind === 'scoped_to_selection') {
    return { kind: verdict.kind, nodeIds: [...verdict.nodeIds] };
  }
  if (verdict.kind === 'whole_artifact') {
    return { kind: verdict.kind };
  }
  return {
    kind: verdict.kind,
    reason: verdict.reason,
    triggeringLexeme: verdict.triggeringLexeme,
    clarificationSeed: verdict.clarificationSeed,
  };
}

function selectedOpsFromIndices(
  ops: ArtifactRuntimeTypedOp[],
  indices: number[]
): ArtifactRuntimeTypedOp[] {
  const selected = indices
    .map((index) => ops[index])
    .filter((op): op is ArtifactRuntimeTypedOp => Boolean(op));

  if (selected.length !== indices.length) {
    throw new ArtifactRuntimeInputError(
      'ARTIFACT_RUNTIME_INVALID_SELECTION_INDICES',
      'selectedOpIndices contains an index outside the proposal op list'
    );
  }

  return selected;
}

function assertScopedToArtifact(params: {
  scope: ArtifactRuntimeScope;
  artifact: ArtifactRuntimeArtifactDto;
  selectionArtifactId: string;
  proposalArtifactId: string;
}): void {
  if (params.scope.tenantId !== params.artifact.tenantId) {
    throw new ArtifactRuntimeInputError(
      'ARTIFACT_RUNTIME_TENANT_MISMATCH',
      `scope tenant '${params.scope.tenantId}' does not match artifact tenant '${params.artifact.tenantId}'`
    );
  }
  if (params.selectionArtifactId !== params.artifact.id) {
    throw new ArtifactRuntimeInputError(
      'ARTIFACT_RUNTIME_SELECTION_ARTIFACT_MISMATCH',
      `selectionContext.artifactId '${params.selectionArtifactId}' does not match artifact.id '${params.artifact.id}'`
    );
  }
  if (params.proposalArtifactId !== params.artifact.id) {
    throw new ArtifactRuntimeInputError(
      'ARTIFACT_RUNTIME_PROPOSAL_ARTIFACT_MISMATCH',
      `proposal.artifactId '${params.proposalArtifactId}' does not match artifact.id '${params.artifact.id}'`
    );
  }
}

function prepareMutation(input: ArtifactRuntimeMutationPlanRequest) {
  const parsed = artifactRuntimeMutationPlanRequestSchema.parse(input);
  assertScopedToArtifact({
    scope: parsed.scope,
    artifact: parsed.artifact,
    selectionArtifactId: parsed.selectionContext.artifactId,
    proposalArtifactId: parsed.proposal.artifactId,
  });

  const artifact = toArtifact(parsed.artifact);
  const proposal = toMutationProposal(parsed.proposal);
  assertMutationProposal(proposal);

  const typedOps = parsed.proposal.ops;
  const selectionContext = toSelectionContext(parsed);
  const scopeVerdict = resolveOpScope(parsed.command, selectionContext.selection);

  if (scopeVerdict.kind === 'scoped_to_selection') {
    assertOpsWithinSelection(toTypedOps(typedOps), selectionContext.selection);
  }

  const runId = resolveRunId(parsed.runId);
  const now = resolveNow(parsed.now);

  if (scopeVerdict.kind === 'rejected') {
    return {
      parsed,
      typedOps,
      runId,
      now,
      scopeVerdict,
      pipelineOutput: null,
    };
  }

  const pipelineOutput = runArtifactMutationPipeline({
    runId: unsafeArtifactMutationRunId(runId),
    artifact,
    proposal,
    selectedOpIndices: parsed.selectedOpIndices,
    reviewEvent: parsed.reviewEvent as ReviewEvent,
    actorId: parsed.scope.userId,
    now,
  });

  return {
    parsed,
    typedOps,
    runId,
    now,
    scopeVerdict,
    pipelineOutput,
  };
}

function normalizeMutationPlan(
  prepared: ReturnType<typeof prepareMutation>
): ArtifactRuntimeMutationPlanResponse {
  if (!prepared.pipelineOutput) {
    return {
      scope: prepared.parsed.scope,
      runId: prepared.runId,
      status: 'rejected',
      scopeVerdict: normalizeScopeVerdict(prepared.scopeVerdict),
      selectedOpIndices: prepared.parsed.selectedOpIndices,
      acceptedOpIndices: [],
      rejectedOpIndices: [],
    };
  }

  const acceptedOpIndices = [...prepared.pipelineOutput.partialAcceptance.selectedOpIndices];
  const rejectedOpIndices = prepared.pipelineOutput.rejectedOps.map((entry) => entry.opIndex);

  return {
    scope: prepared.parsed.scope,
    runId: prepared.runId,
    status: 'ready',
    scopeVerdict: normalizeScopeVerdict(prepared.scopeVerdict),
    selectedOpIndices: [...prepared.parsed.selectedOpIndices],
    acceptedOpIndices,
    rejectedOpIndices,
    previousReviewState: prepared.pipelineOutput.previousReviewState,
    nextReviewState: prepared.pipelineOutput.nextReviewState,
    auditEvent: prepared.pipelineOutput.auditEvent as unknown as Record<string, unknown>,
    proposalId: prepared.pipelineOutput.proposalId,
    callerTokenIssued: Boolean(prepared.pipelineOutput.callerToken),
  };
}

function toLineageNodes(nodes: ArtifactRuntimeExportPlanRequest['lineageNodes']): LineageNode[] {
  return nodes.map((node) => ({
    id: unsafeArtifactId(node.id),
    lineageRootId: node.lineageRootId ? unsafeArtifactId(node.lineageRootId) : null,
    parentArtifactId: node.parentArtifactId ? unsafeArtifactId(node.parentArtifactId) : null,
    derivedFromVersionId: node.derivedFromVersionId
      ? unsafeArtifactVersionId(node.derivedFromVersionId)
      : null,
    currentVersionId: unsafeArtifactVersionId(node.currentVersionId),
  }));
}

function toComment(input: ArtifactRuntimeCommentPlanRequest['comment']): TypedComment {
  return {
    ...input,
    anchor: {
      nodeId: unsafeNodeId(input.anchor.nodeId),
      range: input.anchor.range,
    },
    author: unsafeUserId(input.author),
    mentions: input.mentions.map((mention) => unsafeUserId(mention)),
  };
}

function toNotificationIntents(
  intents: ArtifactRuntimeCommentPlanRequest['notificationIntents']
): MentionNotificationIntent[] {
  return intents.map((intent) => ({
    ...intent,
    recipient: unsafeUserId(intent.recipient),
  }));
}

function toAnchorMutation(
  mutation: ArtifactRuntimeCommentPlanRequest['mutation']
): AnchorMutation | undefined {
  if (!mutation) return undefined;
  if (mutation.kind === 'node_deleted') {
    return { kind: mutation.kind, nodeId: unsafeNodeId(mutation.nodeId) };
  }
  if (mutation.kind === 'node_renamed') {
    return {
      kind: mutation.kind,
      nodeId: unsafeNodeId(mutation.nodeId),
      newNodeId: unsafeNodeId(mutation.newNodeId),
    };
  }
  if (mutation.kind === 'range_shifted') {
    return {
      kind: mutation.kind,
      nodeId: unsafeNodeId(mutation.nodeId),
      shiftFromOffset: mutation.shiftFromOffset,
      shiftDelta: mutation.shiftDelta,
    };
  }
  return {
    kind: mutation.kind,
    nodeId: unsafeNodeId(mutation.nodeId),
    deletedStart: mutation.deletedStart,
    deletedEnd: mutation.deletedEnd,
  };
}

function matchesApprovalRule(rule: ApprovalRoutingRule, context: ApprovalContext): boolean {
  switch (rule.match.kind) {
    case 'artifact_type':
      return context.artifactType === rule.match.value;
    case 'classification':
      return context.classification === rule.match.value;
    case 'persona':
      return context.persona === rule.match.value;
    case 'content_tag':
      return (context.contentTags ?? []).includes(rule.match.value);
    default:
      return false;
  }
}

function sortMatchedRules(
  context: ApprovalContext,
  routingTable: ApprovalRoutingTable
): ApprovalRoutingRule[] {
  return routingTable.rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => matchesApprovalRule(rule, context))
    .sort((left, right) => right.rule.priority - left.rule.priority || left.index - right.index)
    .map(({ rule }) => rule);
}

export function mapArtifactRuntimeError(error: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (error instanceof ZodError) {
    return {
      status: 422,
      body: {
        error: 'Invalid artifact runtime request',
        code: 'ARTIFACT_RUNTIME_INVALID_REQUEST',
        issues: error.issues,
      },
    };
  }

  if (error instanceof ArtifactRuntimeInputError) {
    return {
      status: error.status,
      body: {
        error: error.message,
        code: error.code,
      },
    };
  }

  if (error instanceof Error) {
    return {
      status: 422,
      body: {
        error: error.message,
        code: error.name,
      },
    };
  }

  return {
    status: 500,
    body: {
      error: 'Unknown artifact runtime failure',
      code: 'ARTIFACT_RUNTIME_UNKNOWN_ERROR',
    },
  };
}

const artifactRuntimeService: ArtifactRuntimeServiceContract = {
  planMutation(input: ArtifactRuntimeMutationPlanRequest): ArtifactRuntimeMutationPlanResponse {
    return normalizeMutationPlan(prepareMutation(input));
  },

  applyMutation(input: ArtifactRuntimeMutationApplyRequest): ArtifactRuntimeMutationApplyResponse {
    const prepared = prepareMutation(artifactRuntimeMutationApplyRequestSchema.parse(input));

    if (!prepared.pipelineOutput) {
      return {
        ...normalizeMutationPlan(prepared),
        status: 'rejected',
        acceptedOps: [],
        reverseOps: [],
      };
    }

    const acceptedOps = selectedOpsFromIndices(prepared.typedOps, [
      ...prepared.pipelineOutput.partialAcceptance.selectedOpIndices,
    ]);

    return {
      ...normalizeMutationPlan(prepared),
      status: 'apply_ready',
      acceptedOps,
      reverseOps: reverseArtifactOps(toTypedOps(acceptedOps)) as ArtifactRuntimeTypedOp[],
    };
  },

  planExport(input: ArtifactRuntimeExportPlanRequest): ArtifactRuntimeExportPlanResponse {
    const parsed = artifactRuntimeExportPlanRequestSchema.parse(input);
    const artifact = toArtifact(parsed.artifact);

    if (parsed.scope.tenantId !== parsed.artifact.tenantId) {
      throw new ArtifactRuntimeInputError(
        'ARTIFACT_RUNTIME_TENANT_MISMATCH',
        `scope tenant '${parsed.scope.tenantId}' does not match artifact tenant '${parsed.artifact.tenantId}'`
      );
    }

    if (!canExportToFormat(artifact.dataClassification, parsed.format)) {
      throw new ArtifactRuntimeInputError(
        'ARTIFACT_RUNTIME_EXPORT_FORMAT_BLOCKED',
        `classification '${artifact.dataClassification}' cannot export as '${parsed.format}'`
      );
    }

    const lineageNodes = toLineageNodes(parsed.lineageNodes);
    assertLineageInvariant(buildLineageGraph(lineageNodes));

    const output = runArtifactExportPipeline({
      runId: unsafeArtifactExportRunId(resolveRunId(parsed.runId)),
      artifact,
      lineageNodes,
      sha256: parsed.sha256,
      format: parsed.format,
      destination: parsed.destination as ExportDestination,
      exportedBy: unsafeUserId(parsed.scope.userId),
      sources: parsed.sources as readonly ExportEvidenceRef[],
      confidentialityTags: parsed.confidentialityTags,
      watermark: parsed.watermark as WatermarkSpec,
      tenantWatermarkPolicy: parsed.tenantWatermarkPolicy as TenantWatermarkPolicy,
      footerTarget: parsed.footerTarget as FooterTarget,
      now: resolveNow(parsed.now),
    });

    return {
      scope: parsed.scope,
      runId: String(output.runId),
      exportAllowed: true,
      manifest: output.manifest as unknown as Record<string, unknown>,
      provenanceFooter: output.provenanceFooter as unknown as Record<string, unknown>,
      lineageRootId: String(output.lineageRootId),
    };
  },

  planComment(input: ArtifactRuntimeCommentPlanRequest): ArtifactRuntimeCommentPlanResponse {
    const parsed = artifactRuntimeCommentPlanRequestSchema.parse(input);
    const comment = toComment(parsed.comment);
    const intents = toNotificationIntents(parsed.notificationIntents);

    assertTypedComment(comment);
    assertMentionNotifications(comment, intents);

    const mutation = toAnchorMutation(parsed.mutation);
    const reattachResult = mutation ? reattachCommentToMutation(comment, mutation) : undefined;

    if (mutation && reattachResult) {
      assertAnchorSurvivesMutation(comment, mutation, reattachResult);
    }

    return {
      scope: parsed.scope,
      commentId: comment.id,
      notificationsPlanned: intents.length,
      mentionedUserIds: [...comment.mentions],
      reattachResult: reattachResult
        ? {
            outcome: reattachResult.outcome,
            comment: reattachResult.next,
          }
        : undefined,
    };
  },

  fingerprintTemplate(
    input: ArtifactRuntimeTemplateFingerprintRequest
  ): ArtifactRuntimeTemplateFingerprintResponse {
    const parsed = artifactRuntimeTemplateFingerprintRequestSchema.parse(input);
    const structure = parsed.structure as ArtifactStructure;

    assertFingerprintDeterministic(structure);
    const fingerprint = computeTemplateFingerprint(structure);
    const matchesLibrary = parsed.libraryFingerprints.includes(fingerprint);

    const placement = parsed.placement
      ? (() => {
          const derivedFolder = placeArtifactInFolder(
            parsed.placement.reviewState,
            parsed.placement.everExported,
            parsed.placement.isTemplate
          );

          if (parsed.placement.storedFolder) {
            assertLibraryFolderPlacement(
              parsed.placement.reviewState,
              parsed.placement.everExported,
              parsed.placement.isTemplate,
              parsed.placement.storedFolder
            );
          }

          return {
            derivedFolder,
            storedFolderValidated: Boolean(parsed.placement.storedFolder),
          };
        })()
      : undefined;

    const transition = parsed.transition
      ? (() => {
          assertFolderTransitionSound(
            parsed.transition.prior,
            parsed.transition.next,
            parsed.transition.event
          );
          return {
            prior: parsed.transition.prior,
            next: parsed.transition.next,
            event: parsed.transition.event,
            valid: true as const,
          };
        })()
      : undefined;

    return {
      scope: parsed.scope,
      fingerprint,
      matchesLibrary,
      matchingLibraryCount: parsed.libraryFingerprints.filter((value) => value === fingerprint)
        .length,
      placement,
      transition,
    };
  },

  evaluateApprovals(
    input: ArtifactRuntimeApprovalEvaluateRequest
  ): ArtifactRuntimeApprovalEvaluateResponse {
    const parsed = artifactRuntimeApprovalEvaluateRequestSchema.parse(input);
    const routingTable = parsed.routingTable as ApprovalRoutingTable;

    assertApprovalRoutingTable(routingTable);
    assertRestrictedRequiresCiso(routingTable);
    assertLegalTagRequiresLegal(routingTable);
    assertCfoArtifactRequiresFinance(routingTable);
    assertDefaultRoutesForStandardPersonas(routingTable);
    assertRoutingCoverage(routingTable);

    if (parsed.baselineRoutingTable) {
      assertApprovalRoutingTable(parsed.baselineRoutingTable as ApprovalRoutingTable);
      assertTenantOverrideDoesNotWeakenBaseline(
        parsed.baselineRoutingTable as ApprovalRoutingTable,
        routingTable
      );
    }

    const context = parsed.context as ApprovalContext;
    const matchedRules = sortMatchedRules(context, routingTable);
    const requiredReviewer = resolveRequiredReviewer(context, routingTable);

    return {
      scope: parsed.scope,
      requiredReviewer,
      resolvedByRuleId: matchedRules[0]?.id ?? null,
      matchedRuleIds: matchedRules.map((rule) => rule.id),
      defaultRouteUsed: matchedRules.length === 0,
      invariants: {
        restrictedRequiresCiso: true,
        legalTagRequiresLegal: true,
        cfoArtifactRequiresFinance: true,
        defaultRoutesForStandardPersonas: true,
        routingCoverage: true,
        baselineNotWeakened: parsed.baselineRoutingTable ? true : null,
      },
    };
  },
};

export { ArtifactRuntimeInputError };
export default artifactRuntimeService;
