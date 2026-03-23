/**
 * V8 Execution Visibility and Handoff — Core Type Family
 *
 * WP-W3-LIFECYCLE-03: Execution signals, hierarchical aggregation,
 * results handoff events, rebaseline proposals, and forecast confidence.
 *
 * Decision W3-8:  Hierarchical signal aggregation — summary up, traceability down.
 * Decision W3-9:  Canonical results handoff event family.
 * Decision W3-10: Rebaseline uses shared proposal/approval spine.
 * Decision W3-11: Forecast confidence auto-capped on weak critical-path data.
 */

import { z } from 'zod';

import type { ProposalStatus } from './executionSpine.js';
import { ProposalStatusValues } from './executionSpine.js';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const ExecutionSignalTypeValues = [
  'overdue_tasks_count',
  'blocked_tasks_count',
  'blocked_initiatives_count',
  'pending_blocking_decisions_count',
  'critical_risks_count',
  'owners_over_capacity_count',
  'milestones_at_risk_count',
  'stale_items_count',
  'missing_baseline_count',
  'missing_estimate_count',
  'critical_path_slip_count',
  'forecast_low_confidence_count',
  'rollover_pressure_count',
] as const;
export type ExecutionSignalType = (typeof ExecutionSignalTypeValues)[number];

export const SourceObjectTypeValues = [
  'task',
  'decision',
  'initiative',
  'project',
  'program',
] as const;
export type SourceObjectType = (typeof SourceObjectTypeValues)[number];

export const SignalSeverityValues = ['info', 'warning', 'critical', 'blocker'] as const;
export type SignalSeverity = (typeof SignalSeverityValues)[number];

export const AggregationLevelValues = ['task', 'initiative', 'project', 'pmo'] as const;
export type AggregationLevel = (typeof AggregationLevelValues)[number];

export const ResultsHandoffEventTypeValues = [
  'initiative_baseline_confirmed',
  'execution_progress_updated',
  'milestone_completed',
  'delivery_risk_changed',
  'rebaseline_approved',
  'handover_completed',
  'realization_tracking_started',
] as const;
export type ResultsHandoffEventType = (typeof ResultsHandoffEventTypeValues)[number];

export const RebaselineStatusValues = ProposalStatusValues;
export type RebaselineStatus = ProposalStatus;

export const ForecastConfidenceLevelValues = [
  'high_confidence',
  'medium_confidence',
  'low_confidence',
  'insufficient_data',
] as const;
export type ForecastConfidenceLevel = (typeof ForecastConfidenceLevelValues)[number];

export const ConfidenceCapReasonValues = [
  'data_reliability',
  'capacity_gap',
  'critical_path_unknown',
] as const;
export type ConfidenceCapReason = (typeof ConfidenceCapReasonValues)[number];

// ==========================================
// SEVERITY RANKING (for aggregation)
// ==========================================

export const SIGNAL_SEVERITY_RANK: Record<SignalSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
  blocker: 3,
} as const;

// ==========================================
// INTERFACES
// ==========================================

export interface ExecutionSignal {
  signalId: string;
  signalType: ExecutionSignalType;
  sourceObjectType: SourceObjectType;
  sourceObjectId: string;
  organizationId: string;
  severity: SignalSeverity;
  payload: Record<string, unknown>;
  timestamp: string;
}

/** Decision W3-8: hierarchical aggregation — summary up, traceability down. */
export interface SignalAggregation {
  aggregationId: string;
  level: AggregationLevel;
  sourceObjectId: string;
  organizationId: string;
  sourceSignals: string[];
  aggregatedSeverity: SignalSeverity;
  preservesLineage: boolean;
  timestamp: string;
}

/** Decision W3-9: canonical results handoff event family. */
export interface ResultsHandoffEvent {
  eventId: string;
  eventType: ResultsHandoffEventType;
  initiativeId: string;
  organizationId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

/** Decision W3-10: rebaseline uses shared proposal/approval spine. */
export interface RebaselineProposal {
  proposalId: string;
  initiativeId: string;
  organizationId: string;
  executionRunId: string;
  reason: string;
  baselineBefore: Record<string, unknown>;
  baselineAfter: Record<string, unknown>;
  status: RebaselineStatus;
  createdAt: string;
  resolvedAt: string | null;
}

/** Decision W3-11: forecast confidence auto-capped on weak data. */
export interface ForecastConfidence {
  confidenceLevel: ForecastConfidenceLevel;
  cappedBy: ConfidenceCapReason | null;
  dataReliabilityScore: number;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const ExecutionSignalSchema = z.object({
  signalId: z.string().uuid(),
  signalType: z.enum(ExecutionSignalTypeValues),
  sourceObjectType: z.enum(SourceObjectTypeValues),
  sourceObjectId: z.string().min(1),
  organizationId: z.string().uuid(),
  severity: z.enum(SignalSeverityValues),
  payload: z.record(z.string(), z.unknown()),
  timestamp: z.string().min(1),
});

export const SignalAggregationSchema = z.object({
  aggregationId: z.string().uuid(),
  level: z.enum(AggregationLevelValues),
  sourceObjectId: z.string().min(1),
  organizationId: z.string().uuid(),
  sourceSignals: z.array(z.string()),
  aggregatedSeverity: z.enum(SignalSeverityValues),
  preservesLineage: z.boolean(),
  timestamp: z.string().min(1),
});

export const ResultsHandoffEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.enum(ResultsHandoffEventTypeValues),
  initiativeId: z.string().min(1),
  organizationId: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()),
  timestamp: z.string().min(1),
});

export const RebaselineProposalSchema = z.object({
  proposalId: z.string().uuid(),
  initiativeId: z.string().min(1),
  organizationId: z.string().uuid(),
  executionRunId: z.string().uuid(),
  reason: z.string().min(1),
  baselineBefore: z.record(z.string(), z.unknown()),
  baselineAfter: z.record(z.string(), z.unknown()),
  status: z.enum(ProposalStatusValues),
  createdAt: z.string().min(1),
  resolvedAt: z.string().nullable(),
});

export const ForecastConfidenceSchema = z.object({
  confidenceLevel: z.enum(ForecastConfidenceLevelValues),
  cappedBy: z.enum(ConfidenceCapReasonValues).nullable(),
  dataReliabilityScore: z.number().min(0).max(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface EmitSignalParams {
  signalType: ExecutionSignalType;
  sourceObjectType: SourceObjectType;
  sourceObjectId: string;
  organizationId: string;
  severity: SignalSeverity;
  payload?: Record<string, unknown>;
}

export const EmitSignalParamsSchema = z.object({
  signalType: z.enum(ExecutionSignalTypeValues),
  sourceObjectType: z.enum(SourceObjectTypeValues),
  sourceObjectId: z.string().min(1),
  organizationId: z.string().uuid(),
  severity: z.enum(SignalSeverityValues),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

export interface EmitResultsHandoffEventParams {
  eventType: ResultsHandoffEventType;
  initiativeId: string;
  organizationId: string;
  payload?: Record<string, unknown>;
}

export const EmitResultsHandoffEventParamsSchema = z.object({
  eventType: z.enum(ResultsHandoffEventTypeValues),
  initiativeId: z.string().min(1),
  organizationId: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

export interface CreateRebaselineProposalParams {
  initiativeId: string;
  organizationId: string;
  executionRunId: string;
  reason: string;
  baselineBefore: Record<string, unknown>;
  baselineAfter: Record<string, unknown>;
}

export const CreateRebaselineProposalParamsSchema = z.object({
  initiativeId: z.string().min(1),
  organizationId: z.string().uuid(),
  executionRunId: z.string().uuid(),
  reason: z.string().min(1),
  baselineBefore: z.record(z.string(), z.unknown()),
  baselineAfter: z.record(z.string(), z.unknown()),
});

export interface AssessForecastConfidenceParams {
  dataReliabilityScore: number;
  hasCapacityGap: boolean;
  criticalPathKnown: boolean;
}

export const AssessForecastConfidenceParamsSchema = z.object({
  dataReliabilityScore: z.number().min(0).max(1),
  hasCapacityGap: z.boolean(),
  criticalPathKnown: z.boolean(),
});
