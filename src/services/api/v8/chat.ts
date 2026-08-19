/**
 * V8 Chat API
 * Domain module for Chat V8 endpoints: snapshots, handoffs, bindings.
 */

import { v8Get, v8Post } from './client';

export const V8ChatApi = {
  getSnapshotsByConversation: (conversationId: string) =>
    v8Get('/chat/snapshots', { conversationId }),

  getSnapshotsByRun: (runId: string) => v8Get('/chat/snapshots', { runId }),

  getSnapshot: (snapshotId: string) => v8Get(`/chat/snapshots/${snapshotId}`),

  captureSnapshot: (params: Record<string, unknown>) => v8Post('/chat/snapshots', params),

  getHandoffs: (conversationId: string) => v8Get('/chat/handoffs', { conversationId }),

  createHandoff: (params: Record<string, unknown>) => v8Post('/chat/handoffs', params),

  captureForChat: (params: Record<string, unknown>) => v8Post('/chat/bindings/chat', params),

  captureForExecution: (params: Record<string, unknown>) =>
    v8Post('/chat/bindings/execution', params),

  captureForRetrieval: (params: Record<string, unknown>) =>
    v8Post('/chat/bindings/retrieval', params),

  listGovernedHandoffProposals: (conversationId: string) =>
    v8Get<GovernedChatHandoffProposal[]>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/handoff-proposals`
    ),

  createGovernedDocumentProposal: (params: {
    conversationId: string;
    messageId: string;
    title: string;
    content: string;
    idempotencyKey: string;
    citations?: unknown[];
  }) =>
    v8Post<GovernedChatHandoffCreateResult>(
      `/chat/conversations/${encodeURIComponent(params.conversationId)}/handoff-proposals`,
      {
        messageId: params.messageId,
        targetKind: 'document',
        commandSchemaVersion: 'v1',
        targetCommand: {
          title: params.title,
          description: params.content,
        },
        suggestedTitle: params.title,
        idempotencyKey: params.idempotencyKey,
        clientCitations: params.citations || [],
      }
    ),

  approveGovernedHandoffProposal: (proposalId: string) =>
    v8Post<GovernedChatHandoffProposal>(
      `/chat/handoff-proposals/${encodeURIComponent(proposalId)}/approve`,
      { reason: 'Approved in mounted Chat UI' }
    ),

  rejectGovernedHandoffProposal: (proposalId: string) =>
    v8Post<GovernedChatHandoffProposal>(
      `/chat/handoff-proposals/${encodeURIComponent(proposalId)}/reject`,
      { reason: 'Rejected in mounted Chat UI' }
    ),

  deliverGovernedHandoffProposal: (proposalId: string) =>
    v8Post<GovernedChatOwnerIngress>(
      `/chat/handoff-proposals/${encodeURIComponent(proposalId)}/owner-ingress`,
      {}
    ),

  claimGovernedDocumentIngress: (ingressId: string) =>
    v8Post<GovernedChatOwnerClaim>(
      `/chat/handoff-owner-ingress/${encodeURIComponent(ingressId)}/claim`,
      {
        leaseSeconds: 120,
      }
    ),

  materializeGovernedDocument: (ingressId: string, claimToken: string) =>
    v8Post<GovernedChatMaterialization>(
      `/chat/handoff-owner-ingress/${encodeURIComponent(ingressId)}/materialize`,
      { claimToken },
      { timeoutMs: 60_000 }
    ),
};

export type GovernedChatHandoffState =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'materialized'
  | 'failed';

export interface GovernedChatHandoffProposal {
  proposalId: string;
  producerRecordId: string;
  sourceContentHash: string;
  sourceVersion: number;
  targetKind: 'document' | 'presentation' | 'workbook' | 'material';
  payload: {
    conversationId?: string;
    messageId?: string;
    suggestedTitle?: string | null;
    citations?: unknown[];
    citationStats?: { totalFound?: number; verified?: number; unverified?: number };
  } | null;
  state: GovernedChatHandoffState;
  decidedAt: string | null;
  updatedAt: string;
}

export interface GovernedChatHandoffCreateResult {
  proposal: GovernedChatHandoffProposal;
  replayed: boolean;
  citations: unknown[];
}

export interface GovernedChatOwnerIngress {
  ingress: { ingressId: string; proposalId: string };
  replayed: boolean;
}

export interface GovernedChatOwnerClaim {
  ingressId: string;
  proposalId: string;
  claimToken: string;
}

export interface GovernedChatMaterialization {
  targetRecordId: string;
  outputDigest: string;
  replayed: boolean;
}
