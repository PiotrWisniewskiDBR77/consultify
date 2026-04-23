import { z } from 'zod';

import {
  artifactRuntimeMutationPlanRequestSchema,
  type ArtifactRuntimeMutationPlanRequest,
  type ArtifactRuntimeMutationPlanResponse,
} from './artifact-runtime.js';

export const artifactPipelinePreflightRequestSchema = artifactRuntimeMutationPlanRequestSchema;
export type ArtifactPipelinePreflightRequest = ArtifactRuntimeMutationPlanRequest;

export const artifactPipelinePreflightCheckSchema = z.object({
  id: z.string().trim().min(1),
  status: z.enum(['pass', 'warn', 'fail']),
  message: z.string().trim().min(1).nullable().default(null),
});

export type ArtifactPipelinePreflightCheck = z.infer<typeof artifactPipelinePreflightCheckSchema>;

export const artifactPipelinePreflightResponseSchema = z.object({
  scope: z.object({
    tenantId: z.string(),
    userId: z.string(),
    userRole: z.string().nullable(),
  }),
  runId: z.string().trim().min(1),
  now: z.string().trim().min(1),
  ok: z.boolean(),
  checks: z.array(artifactPipelinePreflightCheckSchema),
});

export type ArtifactPipelinePreflightResponse = z.infer<typeof artifactPipelinePreflightResponseSchema>;

export const artifactPipelineRunRequestSchema = artifactRuntimeMutationPlanRequestSchema.extend({
  materialize: z.boolean().optional().default(true),
});

export type ArtifactPipelineRunRequest = z.infer<typeof artifactPipelineRunRequestSchema>;

export const artifactPipelineTimelineStepSchema = z.object({
  at: z.string().trim().min(1),
  kind: z.enum([
    'preflight_passed',
    'preflight_failed',
    'mutation_planned',
    'materialized_preview_applied',
  ]),
  detail: z.string().trim().min(1).nullable().default(null),
});

export type ArtifactPipelineTimelineStep = z.infer<typeof artifactPipelineTimelineStepSchema>;

export const artifactPipelineRunResponseSchema = z.object({
  scope: z.object({
    tenantId: z.string(),
    userId: z.string(),
    userRole: z.string().nullable(),
  }),
  runId: z.string().trim().min(1),
  now: z.string().trim().min(1),
  timeline: z.array(artifactPipelineTimelineStepSchema),
  plan: z.unknown(), // ArtifactRuntimeMutationPlanResponse (kept loose for MVP stability)
  materialized: z.boolean(),
  artifact: z.unknown(),
  summary: z.object({
    artifactId: z.string().trim().min(1),
    fromVersionId: z.string().trim().min(1),
    toVersionId: z.string().trim().min(1).nullable(),
    reviewState: z.string().trim().min(1),
  }),
});

export type ArtifactPipelineRunResponse = z.infer<typeof artifactPipelineRunResponseSchema> & {
  plan: ArtifactRuntimeMutationPlanResponse;
};

