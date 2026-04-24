import { z } from 'zod';

export const OnboardingPersonaConfidenceSchema = z.enum(['low', 'medium', 'high']);
export type OnboardingPersonaConfidence = z.infer<typeof OnboardingPersonaConfidenceSchema>;

export const OnboardingRuntimeEventNameSchema = z.enum([
  'onboard.started',
  'onboard.persona_inferred',
  'onboard.persona_confirmed',
  'onboard.admin_console_seen',
  'onboard.trust_banner_viewed',
  'onboard.connector_offer_rendered',
  'onboard.connector_oauth_started',
  'onboard.connector_oauth_succeeded',
  'onboard.connector_oauth_failed',
  'onboard.fallback_upload_used',
  'onboard.artifact_seeded',
  'onboard.artifact_first_draft_rendered',
  'onboard.provenance_panel_opened',
  'onboard.approval_gate_opened',
  'onboard.artifact_approved',
  'onboard.artifact_saved',
  'onboard.activation_reached',
  'onboard.export_manifest_viewed',
  'onboard.export_completed',
  'onboard.memory_opt_in',
  'onboard.team_invite_sent',
  'onboard.resume_reentered',
  'onboard.abandoned',
  'onboard.artifact_blocked',
]);
export type OnboardingRuntimeEventName = z.infer<typeof OnboardingRuntimeEventNameSchema>;

export const OnboardingTelemetryPropsSchema = z.object({
  persona: z.string().trim().min(1),
  sourceType: z.string().trim().min(1),
  dataClassification: z.string().trim().min(1),
  trustMode: z.string().trim().min(1),
  residencyRegion: z.string().trim().min(1),
  secondsSinceStart: z.number().finite().min(0),
  artifactType: z.string().trim().min(1),
  citationCount: z.number().finite().min(0),
  validationStatus: z.string().trim().min(1),
  approvalRequired: z.boolean(),
  ahaReached: z.boolean(),
});
export type OnboardingTelemetryProps = z.infer<typeof OnboardingTelemetryPropsSchema>;

export const OnboardingApprovalHistoryItemSchema = z.object({
  at: z.string().trim().min(1),
  decision: z.string().trim().min(1),
  actorId: z.string().trim().min(1).nullable().optional(),
  note: z.string().trim().min(1).nullable().optional(),
});
export type OnboardingApprovalHistoryItem = z.infer<typeof OnboardingApprovalHistoryItemSchema>;

export const OnboardingUploadedFileSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  hash: z.string().trim().min(1),
  storedAt: z.string().trim().min(1).nullable().optional(),
});
export type OnboardingUploadedFile = z.infer<typeof OnboardingUploadedFileSchema>;

export const OnboardingOverrideHistoryItemSchema = z.object({
  fromPersona: z.string().trim().min(1).nullable().optional(),
  toPersona: z.string().trim().min(1),
  at: z.string().trim().min(1),
  reason: z.string().trim().min(1).nullable().optional(),
});
export type OnboardingOverrideHistoryItem = z.infer<typeof OnboardingOverrideHistoryItemSchema>;

export const OnboardingSessionSnapshotSchema = z.object({
  persona: z.string().trim().min(1).nullable(),
  personaConfidence: OnboardingPersonaConfidenceSchema.nullable().optional(),
  overrideHistory: z.array(OnboardingOverrideHistoryItemSchema).default([]),
  connectorTarget: z.string().trim().min(1).nullable(),
  connectorScopes: z.array(z.string().trim().min(1)).default([]),
  uploadedFiles: z.array(OnboardingUploadedFileSchema).default([]),
  currentDraft: z.string().nullable(),
  approvalHistory: z.array(OnboardingApprovalHistoryItemSchema).default([]),
  trustBanner: z.object({
    viewedAt: z.string().trim().min(1).nullable(),
    acknowledged: z.boolean().default(false),
  }),
  unresolvedValidationBlockers: z.array(z.string().trim().min(1)).default([]),
  currentStep: z.string().trim().min(1),
  deltaHint: z.string().trim().min(1).nullable().optional(),
});
export type OnboardingSessionSnapshot = z.infer<typeof OnboardingSessionSnapshotSchema>;

const OnboardingScopeSchema = z.object({
  tenantId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  userRole: z.string().trim().min(1).nullable().optional(),
});
export type OnboardingScope = z.infer<typeof OnboardingScopeSchema>;

export const OnboardingPersonaRequestSchema = z.object({
  onboardingId: z.string().trim().min(1).optional(),
  persona: z.string().trim().min(1),
  personaConfidence: OnboardingPersonaConfidenceSchema.optional(),
  sourceType: z.string().trim().min(1).optional(),
  trustMode: z.string().trim().min(1).optional(),
  residencyRegion: z.string().trim().min(1).optional(),
  approvalRequired: z.boolean().optional(),
  now: z.string().trim().min(1).optional(),
  scope: OnboardingScopeSchema.optional(),
});
export type OnboardingPersonaRequest = z.infer<typeof OnboardingPersonaRequestSchema>;

export interface OnboardingPersonaResponse {
  readonly onboardingId: string;
  readonly resumeToken: string;
  readonly resumeExpiresAt: string;
  readonly now: string;
  readonly accepted: true;
}

export const OnboardingSnapshotSaveRequestSchema = z.object({
  onboardingId: z.string().trim().min(1),
  snapshot: OnboardingSessionSnapshotSchema,
  status: z.enum(['in_progress', 'paused', 'abandoned', 'completed']).optional(),
  reason: z.string().trim().min(1).optional(),
  now: z.string().trim().min(1).optional(),
  scope: OnboardingScopeSchema.optional(),
});
export type OnboardingSnapshotSaveRequest = z.infer<typeof OnboardingSnapshotSaveRequestSchema>;

export interface OnboardingSnapshotSaveResponse {
  readonly onboardingId: string;
  readonly resumeToken: string;
  readonly resumeExpiresAt: string;
  readonly savedAt: string;
  readonly status: 'in_progress' | 'paused' | 'abandoned' | 'completed';
}

export const OnboardingResumeRequestSchema = z
  .object({
    onboardingId: z.string().trim().min(1).optional(),
    resumeToken: z.string().trim().min(1).optional(),
    currentSourceHashes: z.record(z.string(), z.string()).optional(),
    now: z.string().trim().min(1).optional(),
    scope: OnboardingScopeSchema.optional(),
  })
  .refine((value) => Boolean(value.onboardingId || value.resumeToken), {
    message: 'Either onboardingId or resumeToken is required',
    path: ['onboardingId'],
  });
export type OnboardingResumeRequest = z.infer<typeof OnboardingResumeRequestSchema>;

export interface OnboardingResumeResponse {
  readonly outcome: 'resumed' | 'expired' | 'not_found';
  readonly onboardingId: string | null;
  readonly resumeToken: string | null;
  readonly resumeExpiresAt: string | null;
  readonly resumedAt: string;
  readonly snapshot: OnboardingSessionSnapshot | null;
  readonly currentStep: string | null;
  readonly deltaBanner: string | null;
  readonly changedSourceIds: string[];
}

export const OnboardingTelemetryEventRequestSchema = z.object({
  onboardingId: z.string().trim().min(1),
  eventName: OnboardingRuntimeEventNameSchema,
  props: OnboardingTelemetryPropsSchema,
  now: z.string().trim().min(1).optional(),
  scope: OnboardingScopeSchema.optional(),
});
export type OnboardingTelemetryEventRequest = z.infer<typeof OnboardingTelemetryEventRequestSchema>;

export interface OnboardingTelemetryEventResponse {
  readonly onboardingId: string;
  readonly eventId: string;
  readonly recordedAt: string;
}

export type OnboardingKpiMetricKey =
  | 'activation_rate'
  | 'median_time_to_first_artifact'
  | 'connector_attach_rate_at_aha'
  | 'first_artifact_approved_rate';

export interface OnboardingKpiMetricValue {
  readonly actual: number;
  readonly target: number;
  readonly status: 'green' | 'amber' | 'red';
}

export interface OnboardingKpiRow {
  readonly persona: string;
  readonly startedSessions: number;
  readonly activatedSessions: number;
  readonly resumedSessions: number;
  readonly abandonedSessions: number;
  readonly metrics: Record<OnboardingKpiMetricKey, OnboardingKpiMetricValue>;
}

export interface OnboardingKpiSummaryResponse {
  readonly generatedAt: string;
  readonly totals: OnboardingKpiRow;
  readonly personas: OnboardingKpiRow[];
  readonly last24hEventCount: number;
}
