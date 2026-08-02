/**
 * Tool Validators
 * Zod schemas for tool workflow endpoints
 */

import { z } from 'zod';

const MyWorkDerivedSourceSchema = z.object({
  type: z.enum(['idea', 'notebook', 'task', 'decision']),
  id: z.string().min(1),
  title: z.string(),
});

export const CreateToolSessionSchema = z.object({
  toolType: z.string().min(1),
  name: z.string().min(1),
  projectId: z.string().optional().nullable(),
  // V3-C03: MYWORK materialization — optional for toolType=MYWORK
  derivedFrom: z.array(MyWorkDerivedSourceSchema).optional(),
  snapshotJson: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateToolSessionSchema = z.object({
  answers: z.record(z.string(), z.unknown()).optional(),
  completionPercent: z.number().min(0).max(100).optional(),
  confidenceAvg: z.number().min(1).max(5).optional(),
  contextSnapshot: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'REVIEW', 'FINALIZED', 'FAILED']).optional(),
  wizardState: z.record(z.string(), z.unknown()).optional(),
  missingItems: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        severity: z.enum(['blocker', 'warning', 'info']).optional(),
        stepId: z.string().optional(),
        resolved: z.boolean().optional(),
      })
    )
    .optional(),
  failureReason: z.string().optional(),
});

export const ToolDecisionSchema = z.object({
  decisionOwnerId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

export const GenerateInitiativesSchema = ToolDecisionSchema.extend({
  methodologyId: z.string().min(1),
  count: z.number().min(1).max(7),
  includeChatContext: z.boolean().optional(),
});

export const SendBackSchema = z.object({
  comment: z.string().min(2),
});

export const RequestReviewSchema = ToolDecisionSchema;
export const ApproveToolSchema = ToolDecisionSchema;

// #64: AI picker — "which tool do I pick?" (POST /api/tools/suggest)
export const SuggestToolSchema = z.object({
  problemDescription: z.string().min(3).max(500),
  lang: z.enum(['en', 'pl']).optional(),
});

// TLS-04 — Teresa-assisted SWOT: proposal generation + accept/reject.
export const CreateSwotProposalsSchema = z.object({
  quadrantFocus: z.enum(['strengths', 'weaknesses', 'opportunities', 'threats']).optional(),
});

// TLS-04 fix (Codex BLOCKER 3): editedAfter is the ONLY user-owned field the
// UI actually edits (a plain text box). `.strict()` rejects ANY other key
// (including `id`/`quadrant`/`source`/`confidence`/`proposalStatus`/
// `__proto__`/`constructor`/anything else) with a 400 at the validation
// layer, before the request ever reaches the controller -- a client can
// never use this field to overwrite provenance/system fields the server
// itself owns.
const EditedAfterSchema = z
  .object({
    text: z.string().trim().min(1).max(2000),
  })
  .strict();

export const AcceptSwotProposalSchema = z.object({
  // Optional, client-side assertion ONLY (Codex BLOCKER 2) -- the real CAS
  // check always uses swot_proposals.expected_version server-side, never
  // this value.
  expectedVersion: z.number().int().nonnegative().optional(),
  editedAfter: EditedAfterSchema.optional(),
});

export const RejectSwotProposalSchema = z.object({}).passthrough();

export type CreateToolSessionRequest = z.infer<typeof CreateToolSessionSchema>;
export type UpdateToolSessionRequest = z.infer<typeof UpdateToolSessionSchema>;
export type GenerateInitiativesRequest = z.infer<typeof GenerateInitiativesSchema>;
export type SendBackRequest = z.infer<typeof SendBackSchema>;
export type RequestReviewRequest = z.infer<typeof RequestReviewSchema>;
export type ApproveToolRequest = z.infer<typeof ApproveToolSchema>;
export type SuggestToolRequest = z.infer<typeof SuggestToolSchema>;
export type CreateSwotProposalsRequest = z.infer<typeof CreateSwotProposalsSchema>;
export type AcceptSwotProposalRequest = z.infer<typeof AcceptSwotProposalSchema>;
export type RejectSwotProposalRequest = z.infer<typeof RejectSwotProposalSchema>;
