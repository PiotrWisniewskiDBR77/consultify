import { z } from 'zod';

export const LearningLoopScopeSchema = z.object({
  tenantId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  userRole: z.string().trim().min(1).nullable().default(null),
});

export type LearningLoopScope = z.infer<typeof LearningLoopScopeSchema>;

export const LearningFeedbackTargetTypeSchema = z.enum(['chat', 'artifact', 'tool', 'unknown']);
export type LearningFeedbackTargetType = z.infer<typeof LearningFeedbackTargetTypeSchema>;

export const LearningFeedbackSubmitRequestSchema = z.object({
  scope: LearningLoopScopeSchema,
  now: z.string().trim().min(1).optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(2000).optional(),
  targetType: LearningFeedbackTargetTypeSchema.default('unknown'),
  targetId: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().min(1).max(64)).default([]),
});

export type LearningFeedbackSubmitRequest = z.infer<typeof LearningFeedbackSubmitRequestSchema>;

export const LearningFeedbackSubmitResponseSchema = z.object({
  feedbackId: z.string().trim().min(1),
  now: z.string().trim().min(1),
  queuedForStewardship: z.boolean(),
});

export type LearningFeedbackSubmitResponse = z.infer<typeof LearningFeedbackSubmitResponseSchema>;

export const LearningRetentionPreviewRequestSchema = z.object({
  scope: LearningLoopScopeSchema,
  now: z.string().trim().min(1).optional(),
  text: z.string().trim().min(1).max(10000),
  contextHint: z.string().trim().min(1).max(256).optional(),
});

export type LearningRetentionPreviewRequest = z.infer<typeof LearningRetentionPreviewRequestSchema>;

export const LearningRetentionPreviewResponseSchema = z.object({
  now: z.string().trim().min(1),
  retain: z.boolean(),
  ttlDays: z.number().int().nonnegative(),
  reasons: z.array(z.string().trim().min(1)),
  redactedSample: z.string().trim().min(1).nullable().default(null),
});

export type LearningRetentionPreviewResponse = z.infer<typeof LearningRetentionPreviewResponseSchema>;

export const LearningStewardshipQueueItemSchema = z.object({
  itemId: z.string().trim().min(1),
  createdAt: z.string().trim().min(1),
  kind: z.enum(['low_rating_feedback', 'retention_blocked', 'incident_reported', 'drift_detected']),
  summary: z.string().trim().min(1),
  status: z.enum(['open', 'resolved']),
  resolvedAt: z.string().trim().min(1).nullable().default(null),
});

export type LearningStewardshipQueueItem = z.infer<typeof LearningStewardshipQueueItemSchema>;

export const LearningStewardshipListResponseSchema = z.object({
  now: z.string().trim().min(1),
  items: z.array(LearningStewardshipQueueItemSchema),
});

export type LearningStewardshipListResponse = z.infer<typeof LearningStewardshipListResponseSchema>;

export const LearningStewardshipResolveRequestSchema = z.object({
  scope: LearningLoopScopeSchema,
  now: z.string().trim().min(1).optional(),
  note: z.string().trim().min(1).max(2000).optional(),
});

export type LearningStewardshipResolveRequest = z.infer<
  typeof LearningStewardshipResolveRequestSchema
>;

export const LearningStewardshipResolveResponseSchema = z.object({
  now: z.string().trim().min(1),
  itemId: z.string().trim().min(1),
  status: z.literal('resolved'),
});

export type LearningStewardshipResolveResponse = z.infer<
  typeof LearningStewardshipResolveResponseSchema
>;

export const LearningIncidentSeveritySchema = z.enum(['low', 'medium', 'high']);
export type LearningIncidentSeverity = z.infer<typeof LearningIncidentSeveritySchema>;

export const LearningIncidentReportRequestSchema = z.object({
  scope: LearningLoopScopeSchema,
  now: z.string().trim().min(1).optional(),
  kind: z.enum(['drift', 'incident']),
  severity: LearningIncidentSeveritySchema,
  summary: z.string().trim().min(1).max(500),
  detail: z.string().trim().min(1).max(5000).optional(),
  tags: z.array(z.string().trim().min(1).max(64)).default([]),
});

export type LearningIncidentReportRequest = z.infer<typeof LearningIncidentReportRequestSchema>;

export const LearningIncidentRecordSchema = z.object({
  incidentId: z.string().trim().min(1),
  createdAt: z.string().trim().min(1),
  kind: z.enum(['drift', 'incident']),
  severity: LearningIncidentSeveritySchema,
  summary: z.string().trim().min(1),
  status: z.enum(['open', 'resolved']),
});

export type LearningIncidentRecord = z.infer<typeof LearningIncidentRecordSchema>;

export const LearningIncidentReportResponseSchema = z.object({
  now: z.string().trim().min(1),
  incidentId: z.string().trim().min(1),
  status: z.literal('open'),
});

export type LearningIncidentReportResponse = z.infer<typeof LearningIncidentReportResponseSchema>;

export const LearningIncidentsListResponseSchema = z.object({
  now: z.string().trim().min(1),
  incidents: z.array(LearningIncidentRecordSchema),
});

export type LearningIncidentsListResponse = z.infer<typeof LearningIncidentsListResponseSchema>;

export const LearningAdaptiveCoverageSummarySchema = z.object({
  now: z.string().trim().min(1),
  byTargetType: z.record(LearningFeedbackTargetTypeSchema, z.number().int().nonnegative()),
  tagsTop: z.array(z.object({ tag: z.string(), count: z.number().int().nonnegative() })),
  gaps: z.array(z.string().trim().min(1)),
});

export type LearningAdaptiveCoverageSummary = z.infer<typeof LearningAdaptiveCoverageSummarySchema>;

export const LearningQualityDashboardSchema = z.object({
  now: z.string().trim().min(1),
  feedback: z.object({
    total: z.number().int().nonnegative(),
    avgRating: z.number().nonnegative(),
    lowRatingRate: z.number().min(0).max(1),
  }),
  retention: z.object({
    previewTotal: z.number().int().nonnegative(),
    deniedRate: z.number().min(0).max(1),
  }),
  stewardship: z.object({
    openItems: z.number().int().nonnegative(),
  }),
  incidents: z.object({
    open: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
});

export type LearningQualityDashboard = z.infer<typeof LearningQualityDashboardSchema>;

// ---------------------------------------------------------------------------
// Body-only schemas (scope is attached server-side from auth context)
// ---------------------------------------------------------------------------

export const LearningFeedbackSubmitBodySchema = LearningFeedbackSubmitRequestSchema.omit({
  scope: true,
});
export type LearningFeedbackSubmitBody = z.infer<typeof LearningFeedbackSubmitBodySchema>;

export const LearningRetentionPreviewBodySchema = LearningRetentionPreviewRequestSchema.omit({
  scope: true,
});
export type LearningRetentionPreviewBody = z.infer<typeof LearningRetentionPreviewBodySchema>;

export const LearningStewardshipResolveBodySchema = LearningStewardshipResolveRequestSchema.omit({
  scope: true,
});
export type LearningStewardshipResolveBody = z.infer<typeof LearningStewardshipResolveBodySchema>;

export const LearningIncidentReportBodySchema = LearningIncidentReportRequestSchema.omit({
  scope: true,
});
export type LearningIncidentReportBody = z.infer<typeof LearningIncidentReportBodySchema>;

