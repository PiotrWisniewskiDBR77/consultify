/**
 * V8 Knowledge + Retrieval Integration — Core Primitives
 *
 * Integration layer connecting Knowledge/RAG with the governed retrieval system.
 * Working memory and governed retrieval operate as a unified pipeline.
 *
 * References:
 *  - WP-W2-AI-02_KNOWLEDGE_RETRIEVAL_INTEGRATION.md
 *  - DECISION_LOG_WAVE_2.md  (Decisions W2-4, W2-5, W2-6, W2-7)
 *
 * Upstream dependencies:
 *  - contextSnapshot.ts  (WP-W1-AI-01)
 *  - governedRetrieval.ts (WP-W1-AI-02)
 *  - trustAudit.ts        (WP-W1-TRUST-01)
 */

import { z } from 'zod';

import type { ScopeType } from './contextSnapshot.js';
import { ScopeTypeValues } from './contextSnapshot.js';
import type { RetrievalResult, BudgetHint } from './governedRetrieval.js';
import { RetrievalResultSchema, BudgetHintSchema } from './governedRetrieval.js';
import type { TrustClass } from './trustAudit.js';
import { TrustClassValues } from './trustAudit.js';

// ==========================================
// ENUMS / LITERALS
// ==========================================

/**
 * Memory type hierarchy (§3.1 of analysis packet).
 * Matches the five-layer model: ephemeral → session → user_private_durable → organization_durable.
 * 'archived' is excluded — it is not retrievable in normal operation.
 */
export const MemoryTypeValues = [
  'ephemeral',
  'session',
  'user_private_durable',
  'organization_durable',
] as const;
export type MemoryType = (typeof MemoryTypeValues)[number];

/** Promotion status for governed memory promotion (Decision W2-6). */
export const PromotionStatusValues = ['pending', 'approved', 'rejected'] as const;
export type PromotionStatus = (typeof PromotionStatusValues)[number];

/**
 * Freshness policy for internal memory stores (Decision W2-5).
 * Internal memory uses its own freshness checks, not connector ACL lag semantics.
 */
export const FreshnessPolicyValues = [
  'inherently_fresh',
  'check_on_read',
  'periodic_reindex',
] as const;
export type FreshnessPolicy = (typeof FreshnessPolicyValues)[number];

// ==========================================
// WORKING MEMORY ENTRY
// ==========================================

export interface WorkingMemoryEntry {
  entryId: string;
  conversationId: string;
  organizationId: string;
  memoryType: MemoryType;
  content: string;
  sourceRef: string | null;
  createdAt: string;
  expiresAt: string | null;
}

// ==========================================
// MEMORY PROMOTION REQUEST (Decision W2-6)
// ==========================================

/**
 * Governed promotion of compacted memory.
 * Not silent — requires provenance and promotion workflow.
 * Raw source material remains stronger evidence class.
 */
export interface MemoryPromotionRequest {
  requestId: string;
  organizationId: string;
  sourceEntryId: string;
  targetMemoryType: MemoryType;
  promotionStatus: PromotionStatus;
  provenanceRef: string;
  requestedBy: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

// ==========================================
// WORKING MEMORY ORCHESTRATION RESULT
// ==========================================

/**
 * Result of orchestrated retrieval combining governed retrieval + working memory.
 * The orchestrator calls the gateway; it does not bypass it (§1.3 invariant).
 */
export interface WorkingMemoryOrchestrationResult {
  requestId: string;
  organizationId: string;
  retrievalResults: RetrievalResult[];
  workingMemoryResults: WorkingMemoryEntry[];
  mergedTrustClass: TrustClass;
  budgetUsed: BudgetHint;
}

// ==========================================
// MEMORY FRESHNESS CHECK (Decision W2-5)
// ==========================================

/**
 * Internal memory freshness check.
 * ACL staleness windows (Decision 10) apply to connector-backed external sources only.
 * Internal memory stores use their own freshness/governance checks.
 */
export interface MemoryFreshnessCheck {
  memoryType: MemoryType;
  organizationId: string;
  freshnessPolicy: FreshnessPolicy;
  lastCheckedAt: string;
  isStale: boolean;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const WorkingMemoryEntrySchema = z.object({
  entryId: z.string().uuid(),
  conversationId: z.string().uuid(),
  organizationId: z.string().uuid(),
  memoryType: z.enum(MemoryTypeValues),
  content: z.string().min(1),
  sourceRef: z.string().nullable(),
  createdAt: z.string().min(1),
  expiresAt: z.string().nullable(),
});

export const MemoryPromotionRequestSchema = z.object({
  requestId: z.string().uuid(),
  organizationId: z.string().uuid(),
  sourceEntryId: z.string().uuid(),
  targetMemoryType: z.enum(MemoryTypeValues),
  promotionStatus: z.enum(PromotionStatusValues),
  provenanceRef: z.string().min(1),
  requestedBy: z.string().min(1),
  resolvedBy: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string().min(1),
});

export const WorkingMemoryOrchestrationResultSchema = z.object({
  requestId: z.string().uuid(),
  organizationId: z.string().uuid(),
  retrievalResults: z.array(RetrievalResultSchema),
  workingMemoryResults: z.array(WorkingMemoryEntrySchema),
  mergedTrustClass: z.enum(TrustClassValues),
  budgetUsed: BudgetHintSchema,
});

export const MemoryFreshnessCheckSchema = z.object({
  memoryType: z.enum(MemoryTypeValues),
  organizationId: z.string().uuid(),
  freshnessPolicy: z.enum(FreshnessPolicyValues),
  lastCheckedAt: z.string().min(1),
  isStale: z.boolean(),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface CreateWorkingMemoryEntryParams {
  conversationId: string;
  organizationId: string;
  memoryType: MemoryType;
  content: string;
  sourceRef?: string | null;
  expiresAt?: string | null;
}

export const CreateWorkingMemoryEntryParamsSchema = z.object({
  conversationId: z.string().uuid(),
  organizationId: z.string().uuid(),
  memoryType: z.enum(MemoryTypeValues),
  content: z.string().min(1),
  sourceRef: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

export interface RequestMemoryPromotionParams {
  organizationId: string;
  sourceEntryId: string;
  targetMemoryType: MemoryType;
  provenanceRef: string;
  requestedBy: string;
}

export const RequestMemoryPromotionParamsSchema = z.object({
  organizationId: z.string().uuid(),
  sourceEntryId: z.string().uuid(),
  targetMemoryType: z.enum(MemoryTypeValues),
  provenanceRef: z.string().min(1),
  requestedBy: z.string().min(1),
});

export interface OrchestrateRetrievalParams {
  organizationId: string;
  conversationId: string;
  contextSnapshotId: string;
  consumerClass: 'chat' | 'execution';
  query: string;
  searchPreset: 'workspace_broad' | 'project_focused' | 'artifact_deep' | 'cross_org_federated';
  budgetHint?: BudgetHint | null;
  workingMemoryContextRef?: string | null;
}

export const OrchestrateRetrievalParamsSchema = z.object({
  organizationId: z.string().uuid(),
  conversationId: z.string().uuid(),
  contextSnapshotId: z.string().uuid(),
  consumerClass: z.enum(['chat', 'execution']),
  query: z.string().min(1),
  searchPreset: z.enum(['workspace_broad', 'project_focused', 'artifact_deep', 'cross_org_federated']),
  budgetHint: BudgetHintSchema.nullable().optional(),
  workingMemoryContextRef: z.string().nullable().optional(),
});
