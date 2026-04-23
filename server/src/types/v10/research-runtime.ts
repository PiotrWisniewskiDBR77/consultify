import { z } from 'zod';

export const ResearchRuntimeScopeSchema = z.object({
  tenantId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  userRole: z.string().trim().min(1).nullable().optional(),
});

export type ResearchRuntimeScope = z.infer<typeof ResearchRuntimeScopeSchema>;

export const ResearchMissionRequestSchema = z.object({
  missionId: z.string().trim().min(1).optional(),
  query: z.string().trim().min(1),
  now: z.string().trim().min(1).optional(),
  scope: ResearchRuntimeScopeSchema.optional(),
});

export type ResearchMissionRequest = z.infer<typeof ResearchMissionRequestSchema>;

export interface ResearchMissionResponse {
  readonly missionId: string;
  readonly now: string;
  readonly summary: string;
}

// ---------------------------------------------------------------------------
// Wave B (research runtime 2): mission planning + watch delta + summary
// ---------------------------------------------------------------------------

export const ResearchMissionPlanRequestSchema = z.object({
  query: z.string().trim().min(1),
  now: z.string().trim().min(1).optional(),
  depth: z.enum(['quick', 'standard', 'deep']).default('standard'),
  maxSources: z.number().int().min(1).max(50).default(8),
  scope: ResearchRuntimeScopeSchema.optional(),
});

export type ResearchMissionPlanRequest = z.infer<typeof ResearchMissionPlanRequestSchema>;

export type ResearchMissionPlanStepKind =
  | 'scope'
  | 'sources'
  | 'extract'
  | 'synthesize'
  | 'qa'
  | 'deliver';

export interface ResearchMissionPlanStep {
  readonly kind: ResearchMissionPlanStepKind;
  readonly label: string;
}

export interface ResearchMissionPlanResponse {
  readonly missionId: string;
  readonly now: string;
  readonly plan: readonly ResearchMissionPlanStep[];
  readonly missionSummary: string;
}

export type ResearchMissionEventKind =
  | 'mission_planned'
  | 'mission_started'
  | 'delta'
  | 'mission_completed';

export interface ResearchMissionEvent {
  readonly seq: number;
  readonly at: string;
  readonly kind: ResearchMissionEventKind;
  readonly message: string;
}

export const ResearchMissionWatchRequestSchema = z.object({
  missionId: z.string().trim().min(1),
  cursor: z.number().int().min(0).optional().default(0),
  now: z.string().trim().min(1).optional(),
  scope: ResearchRuntimeScopeSchema.optional(),
});

export type ResearchMissionWatchRequest = z.infer<typeof ResearchMissionWatchRequestSchema>;

export interface ResearchMissionWatchResponse {
  readonly missionId: string;
  readonly now: string;
  readonly nextCursor: number;
  readonly events: readonly ResearchMissionEvent[];
  readonly completed: boolean;
}

export const ResearchMissionSummaryRequestSchema = z.object({
  missionId: z.string().trim().min(1),
  scope: ResearchRuntimeScopeSchema.optional(),
});

export type ResearchMissionSummaryRequest = z.infer<typeof ResearchMissionSummaryRequestSchema>;

export interface ResearchMissionSummaryResponse {
  readonly missionId: string;
  readonly now: string;
  readonly summary: string;
  readonly status: 'planned' | 'running' | 'completed' | 'unknown';
}

