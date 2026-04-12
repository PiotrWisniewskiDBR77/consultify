import { randomUUID } from 'node:crypto';

import type { ActionPreview, ProposalStatus } from '../../types/executionSpine.js';
import type {
  CreateOperationContractParams,
  OperationContract,
  OperationContractKind,
  OperationContractLinks,
  OperationContractPreview,
  OperationContractStage,
} from '../../types/operationContract.js';
import { CreateOperationContractParamsSchema } from '../../types/operationContract.js';

function compactLines(lines: Array<string | null | undefined>): string[] {
  return lines
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .slice(0, 4);
}

function trimPreview(value: string | null | undefined, max = 160): string {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 1)}...`;
}

export function createOperationContract(params: CreateOperationContractParams): OperationContract {
  const validated = CreateOperationContractParamsSchema.parse(params);
  const now = new Date().toISOString();
  return {
    contractId: validated.contractId || randomUUID(),
    version: 'v1',
    kind: validated.kind,
    stage: validated.stage,
    links: validated.links,
    preview: validated.preview,
    createdAt: validated.createdAt || now,
    updatedAt: validated.updatedAt || validated.createdAt || now,
  };
}

export function updateOperationContractLinks(
  contract: OperationContract,
  patch: Partial<OperationContractLinks>,
  stage?: OperationContractStage
): OperationContract {
  return {
    ...contract,
    stage: stage || contract.stage,
    links: {
      ...contract.links,
      ...patch,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function buildActionPreviewLines(preview: ActionPreview | null | undefined): string[] {
  if (!preview) return [];
  const created = preview.createdObjects.length
    ? `Create: ${preview.createdObjects.join(', ')}`
    : null;
  const updated = preview.updatedFields.length
    ? `Update: ${preview.updatedFields.join(', ')}`
    : null;
  return compactLines([created, updated, preview.destructiveImpact, ...preview.followupEffects]);
}

export function mapProposalStatusToOperationStage(status: ProposalStatus): OperationContractStage {
  switch (status) {
    case 'draft':
      return 'draft';
    case 'pending_review':
      return 'pending_review';
    case 'approved':
    case 'policy_allowed':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'expired':
      return 'failed';
    default:
      return 'proposal_ready';
  }
}

export function buildProposalOperationContract(params: {
  kind?: OperationContractKind;
  contractId?: string;
  stage?: OperationContractStage;
  createdAt?: string;
  updatedAt?: string;
  organizationId: string;
  userId?: string | null;
  conversationId?: string | null;
  sessionId?: string | null;
  contextSnapshotId?: string | null;
  executionRunId?: string | null;
  teresaProposalId?: string | null;
  governedProposalId?: string | null;
  chatProposalId?: string | null;
  artifactRunId?: string | null;
  artifactId?: string | null;
  toolInvocationId?: string | null;
  targetModule?: string | null;
  targetRef?: OperationContractLinks['targetRef'];
  title: string;
  summary: string;
  intent: string;
  previewLines?: string[];
  riskLabel?: string | null;
}): OperationContract {
  const preview: OperationContractPreview = {
    title: trimPreview(params.title, 120) || 'Teresa operation',
    summary: trimPreview(params.summary, 180) || trimPreview(params.intent, 180) || 'Proposed work',
    intent: trimPreview(params.intent, 180) || 'Proposed work',
    previewLines: compactLines(params.previewLines || []),
    riskLabel: params.riskLabel || null,
  };

  return createOperationContract({
    contractId: params.contractId,
    kind: params.kind || 'teresa_handoff',
    stage: params.stage || 'proposal_ready',
    links: {
      organizationId: params.organizationId,
      userId: params.userId ?? null,
      conversationId: params.conversationId ?? null,
      sessionId: params.sessionId ?? null,
      contextSnapshotId: params.contextSnapshotId ?? null,
      executionRunId: params.executionRunId ?? null,
      teresaProposalId: params.teresaProposalId ?? null,
      governedProposalId: params.governedProposalId ?? null,
      chatProposalId: params.chatProposalId ?? null,
      artifactRunId: params.artifactRunId ?? null,
      artifactId: params.artifactId ?? null,
      toolInvocationId: params.toolInvocationId ?? null,
      targetModule: params.targetModule ?? null,
      targetRef: params.targetRef ?? null,
    },
    preview,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
  });
}
