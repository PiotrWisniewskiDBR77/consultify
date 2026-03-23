/**
 * V8 Workspace Cross-Module Integration — Session ↔ module links, cross-module
 * activity, workspace/session analytics (Wave 16).
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const ModuleLinkTypeValues = [
  'initiative',
  'execution_run',
  'retrieval_request',
  'report',
  'presentation',
  'kpi_scorecard',
  'finance_model',
] as const;
export type ModuleLinkType = (typeof ModuleLinkTypeValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface SessionModuleLink {
  linkId: string;
  sessionId: string;
  organizationId: string;
  moduleType: ModuleLinkType;
  moduleResourceId: string;
  linkedBy: string;
  linkedAt: string;
  unlinkedAt: string | null;
}

export interface CrossModuleActivity {
  activityId: string;
  sessionId: string;
  organizationId: string;
  moduleType: ModuleLinkType;
  moduleResourceId: string;
  activityType: string;
  actorId: string;
  summary: string;
  createdAt: string;
}

export interface SessionAnalytics {
  sessionId: string;
  totalParticipants: number;
  totalActivities: number;
  totalSuggestions: number;
  totalDecisions: number;
  totalModuleLinks: number;
  durationMs: number | null;
  engagementScore: number;
}

export interface WorkspaceAnalytics {
  workspaceId: string;
  organizationId: string;
  sessionCount: number;
  totalParticipants: number;
  totalActivities: number;
  totalSuggestions: number;
  totalDecisions: number;
  totalModuleLinks: number;
  avgEngagementScore: number;
  cumulativeDurationMs: number | null;
}

export interface ModuleImpactSummary {
  moduleType: ModuleLinkType;
  moduleResourceId: string;
  organizationId: string;
  linkedSessionCount: number;
  crossModuleActivityCount: number;
  referencedDecisionsCount: number;
}

// ==========================================
// ZOD — ENTITIES
// ==========================================

export const SessionModuleLinkSchema = z.object({
  linkId: z.string().uuid(),
  sessionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  moduleType: z.enum(ModuleLinkTypeValues),
  moduleResourceId: z.string().min(1),
  linkedBy: z.string().min(1),
  linkedAt: z.string().min(1),
  unlinkedAt: z.string().min(1).nullable(),
});

export const CrossModuleActivitySchema = z.object({
  activityId: z.string().uuid(),
  sessionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  moduleType: z.enum(ModuleLinkTypeValues),
  moduleResourceId: z.string().min(1),
  activityType: z.string().min(1),
  actorId: z.string().min(1),
  summary: z.string().min(1),
  createdAt: z.string().min(1),
});

export const SessionAnalyticsSchema = z.object({
  sessionId: z.string().uuid(),
  totalParticipants: z.number().int().nonnegative(),
  totalActivities: z.number().int().nonnegative(),
  totalSuggestions: z.number().int().nonnegative(),
  totalDecisions: z.number().int().nonnegative(),
  totalModuleLinks: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative().nullable(),
  engagementScore: z.number().min(0).max(100),
});

export const WorkspaceAnalyticsSchema = z.object({
  workspaceId: z.string().min(1),
  organizationId: z.string().uuid(),
  sessionCount: z.number().int().nonnegative(),
  totalParticipants: z.number().int().nonnegative(),
  totalActivities: z.number().int().nonnegative(),
  totalSuggestions: z.number().int().nonnegative(),
  totalDecisions: z.number().int().nonnegative(),
  totalModuleLinks: z.number().int().nonnegative(),
  avgEngagementScore: z.number().min(0).max(100),
  cumulativeDurationMs: z.number().int().nonnegative().nullable(),
});

export const ModuleImpactSummarySchema = z.object({
  moduleType: z.enum(ModuleLinkTypeValues),
  moduleResourceId: z.string().min(1),
  organizationId: z.string().uuid(),
  linkedSessionCount: z.number().int().nonnegative(),
  crossModuleActivityCount: z.number().int().nonnegative(),
  referencedDecisionsCount: z.number().int().nonnegative(),
});

// ==========================================
// INPUT PARAMS (service layer)
// ==========================================

export interface LinkModuleParams {
  sessionId: string;
  organizationId: string;
  moduleType: ModuleLinkType;
  moduleResourceId: string;
  linkedBy: string;
}

export const LinkModuleParamsSchema = z.object({
  sessionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  moduleType: z.enum(ModuleLinkTypeValues),
  moduleResourceId: z.string().min(1),
  linkedBy: z.string().min(1),
});

export interface RecordCrossModuleActivityParams {
  sessionId: string;
  organizationId: string;
  moduleType: ModuleLinkType;
  moduleResourceId: string;
  activityType: string;
  actorId: string;
  summary: string;
}

export const RecordCrossModuleActivityParamsSchema = z.object({
  sessionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  moduleType: z.enum(ModuleLinkTypeValues),
  moduleResourceId: z.string().min(1),
  activityType: z.string().min(1),
  actorId: z.string().min(1),
  summary: z.string().min(1),
});
