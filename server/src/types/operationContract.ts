/**
 * Unified Teresa operation contract.
 *
 * This is a thin identity layer spanning Teresa proposal envelopes,
 * governed execution runs, tool invocations, and artifact runtime.
 * It does not replace P08/V8 contracts; it links them into one
 * user-visible operation chain.
 */

import { z } from 'zod';

import type { V8ArtifactRef } from './contextSnapshot.js';
import { V8ArtifactRefSchema } from './contextSnapshot.js';

export const OperationContractStageValues = [
  'draft',
  'proposal_ready',
  'pending_review',
  'approved',
  'executing',
  'completed',
  'rejected',
  'failed',
] as const;
export type OperationContractStage = (typeof OperationContractStageValues)[number];

export const OperationContractKindValues = [
  'teresa_handoff',
  'governed_execution',
  'artifact_runtime',
  'tool_invocation',
] as const;
export type OperationContractKind = (typeof OperationContractKindValues)[number];

export interface OperationContractLinks {
  organizationId: string;
  userId: string | null;
  conversationId: string | null;
  sessionId: string | null;
  contextSnapshotId: string | null;
  executionRunId: string | null;
  teresaProposalId: string | null;
  governedProposalId: string | null;
  chatProposalId: string | null;
  artifactRunId: string | null;
  artifactId: string | null;
  toolInvocationId: string | null;
  targetModule: string | null;
  targetRef: V8ArtifactRef | null;
}

export interface OperationContractPreview {
  title: string;
  summary: string;
  intent: string;
  previewLines: string[];
  riskLabel: string | null;
}

export interface OperationContract {
  contractId: string;
  version: 'v1';
  kind: OperationContractKind;
  stage: OperationContractStage;
  links: OperationContractLinks;
  preview: OperationContractPreview;
  createdAt: string;
  updatedAt: string;
}

export const OperationContractLinksSchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().nullable(),
  conversationId: z.string().nullable(),
  sessionId: z.string().nullable(),
  contextSnapshotId: z.string().nullable(),
  executionRunId: z.string().nullable(),
  teresaProposalId: z.string().nullable(),
  governedProposalId: z.string().nullable(),
  chatProposalId: z.string().nullable(),
  artifactRunId: z.string().nullable(),
  artifactId: z.string().nullable(),
  toolInvocationId: z.string().nullable(),
  targetModule: z.string().nullable(),
  targetRef: V8ArtifactRefSchema.nullable(),
});

export const OperationContractPreviewSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  intent: z.string().min(1),
  previewLines: z.array(z.string()),
  riskLabel: z.string().nullable(),
});

export const OperationContractSchema = z.object({
  contractId: z.string().min(1),
  version: z.literal('v1'),
  kind: z.enum(OperationContractKindValues),
  stage: z.enum(OperationContractStageValues),
  links: OperationContractLinksSchema,
  preview: OperationContractPreviewSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export interface CreateOperationContractParams {
  contractId?: string;
  kind: OperationContractKind;
  stage: OperationContractStage;
  links: OperationContractLinks;
  preview: OperationContractPreview;
  createdAt?: string;
  updatedAt?: string;
}

export const CreateOperationContractParamsSchema = z.object({
  contractId: z.string().min(1).optional(),
  kind: z.enum(OperationContractKindValues),
  stage: z.enum(OperationContractStageValues),
  links: OperationContractLinksSchema,
  preview: OperationContractPreviewSchema,
  createdAt: z.string().min(1).optional(),
  updatedAt: z.string().min(1).optional(),
});
