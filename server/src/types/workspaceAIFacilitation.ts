/**
 * V8 Workspace AI Facilitation — Types & Schemas
 *
 * Type family for AI-driven session facilitation:
 * - AI suggestions (action items, decision prompts, risk flags, etc.)
 * - Session insights (info / warning / critical)
 * - Collaborative decisions with voting
 *
 * All entities are scoped to (sessionId, organizationId).
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const AISuggestionTypeValues = [
  'action_item',
  'decision_prompt',
  'context_enrichment',
  'summary',
  'next_step',
  'risk_flag',
  'dependency_alert',
] as const;
export type AISuggestionType = (typeof AISuggestionTypeValues)[number];

export const SuggestionStateValues = ['pending', 'accepted', 'dismissed', 'expired'] as const;
export type SuggestionState = (typeof SuggestionStateValues)[number];

export const InsightSeverityValues = ['info', 'warning', 'critical'] as const;
export type InsightSeverity = (typeof InsightSeverityValues)[number];

export const DecisionStatusValues = ['open', 'closed'] as const;
export type DecisionStatus = (typeof DecisionStatusValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface AISuggestion {
  suggestionId: string;
  sessionId: string;
  organizationId: string;
  suggestionType: AISuggestionType;
  state: SuggestionState;
  content: string;
  confidence: number;
  sourceSnapshotId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface SessionInsight {
  insightId: string;
  sessionId: string;
  organizationId: string;
  insightType: string;
  title: string;
  body: string;
  severity: InsightSeverity;
  createdAt: string;
}

export interface DecisionOption {
  optionId: string;
  label: string;
  votes: string[];
}

export interface CollaborativeDecision {
  decisionId: string;
  sessionId: string;
  organizationId: string;
  question: string;
  options: DecisionOption[];
  status: DecisionStatus;
  outcome: string | null;
  createdAt: string;
  closedAt: string | null;
}

// ==========================================
// ZOD SCHEMAS — ENTITIES
// ==========================================

export const AISuggestionSchema = z.object({
  suggestionId: z.string().uuid(),
  sessionId: z.string().min(1),
  organizationId: z.string().uuid(),
  suggestionType: z.enum(AISuggestionTypeValues),
  state: z.enum(SuggestionStateValues),
  content: z.string().min(1),
  confidence: z.number().min(0).max(1),
  sourceSnapshotId: z.string().nullable(),
  createdAt: z.string().min(1),
  resolvedAt: z.string().nullable(),
  resolvedBy: z.string().nullable(),
});

export const SessionInsightSchema = z.object({
  insightId: z.string().uuid(),
  sessionId: z.string().min(1),
  organizationId: z.string().uuid(),
  insightType: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  severity: z.enum(InsightSeverityValues),
  createdAt: z.string().min(1),
});

export const DecisionOptionSchema = z.object({
  optionId: z.string().min(1),
  label: z.string().min(1),
  votes: z.array(z.string()),
});

export const CollaborativeDecisionSchema = z.object({
  decisionId: z.string().uuid(),
  sessionId: z.string().min(1),
  organizationId: z.string().uuid(),
  question: z.string().min(1),
  options: z.array(DecisionOptionSchema),
  status: z.enum(DecisionStatusValues),
  outcome: z.string().nullable(),
  createdAt: z.string().min(1),
  closedAt: z.string().nullable(),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface GenerateSuggestionParams {
  sessionId: string;
  organizationId: string;
  suggestionType: AISuggestionType;
  content: string;
  confidence?: number;
  sourceSnapshotId?: string | null;
}

export const GenerateSuggestionParamsSchema = z.object({
  sessionId: z.string().min(1),
  organizationId: z.string().uuid(),
  suggestionType: z.enum(AISuggestionTypeValues),
  content: z.string().min(1),
  confidence: z.number().min(0).max(1).optional().default(0.5),
  sourceSnapshotId: z.string().nullable().optional().default(null),
});

export interface RecordInsightParams {
  sessionId: string;
  organizationId: string;
  insightType: string;
  title: string;
  body: string;
  severity?: InsightSeverity;
}

export const RecordInsightParamsSchema = z.object({
  sessionId: z.string().min(1),
  organizationId: z.string().uuid(),
  insightType: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  severity: z.enum(InsightSeverityValues).optional().default('info'),
});

export interface CreateDecisionParams {
  sessionId: string;
  organizationId: string;
  question: string;
  options: { optionId: string; label: string }[];
}

export const CreateDecisionParamsSchema = z.object({
  sessionId: z.string().min(1),
  organizationId: z.string().uuid(),
  question: z.string().min(1),
  options: z
    .array(
      z.object({
        optionId: z.string().min(1),
        label: z.string().min(1),
      }),
    )
    .min(2),
});

// ==========================================
// AGGREGATE TYPES
// ==========================================

export interface SessionAISummary {
  sessionId: string;
  organizationId: string;
  suggestions: Record<SuggestionState, number>;
  insights: Record<InsightSeverity, number>;
  openDecisions: number;
}
