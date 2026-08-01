/**
 * MW-DEC-001 — types for the canonical Decision workspace (frontend).
 *
 * Mirrors the REAL response shapes emitted by:
 *   - GET  /api/decisions/:id/detail        (DecisionController.getDecisionDetail)
 *   - POST /api/decisions/:id/comments      (decisionCollaborationService.createDecisionComment)
 *   - POST /api/decisions/:id/alternatives  (…createDecisionAlternative)
 *   - POST /api/decisions/:id/risks         (…createDecisionRisk)
 *   - PUT  /api/decisions/:id/decide        (DecisionController.decide)
 *
 * These are NOT the same shapes DecisionDetailView.tsx's local component
 * state uses (that view fakes comments/alternatives/risks in localStorage —
 * see MW-CORE-001_CURRENT_RUNTIME_MAP.md §4). Everything here is exactly
 * what the server returns; the workspace never invents fields the backend
 * did not send.
 */

export type DecisionOutcomeStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ESCALATED'
  | 'CANCELLED'
  | 'RETURNED_FOR_CLARIFICATION';

/** Target statuses the PUT/PATCH /:id/decide endpoint actually accepts. */
export type DecideTargetStatus = 'APPROVED' | 'REJECTED' | 'RETURNED_FOR_CLARIFICATION' | 'PENDING';

export interface DecisionImpactDTO {
  id: string;
  impactedType: string;
  impactedId: string;
  impactDescription?: string | null;
  isBlocker: boolean;
}

export interface DecisionHistoryEntryDTO {
  id: string;
  action: string;
  by: string;
  userName?: string;
  oldStatus?: string;
  newStatus?: string;
  at: string;
  notes?: string;
  details?: Record<string, unknown>;
}

export interface DecisionCommentDTO {
  id: string;
  decisionId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionAlternativeDTO {
  id: string;
  decisionId: string;
  title: string;
  description: string | null;
  benefits: string | null;
  drawbacks: string | null;
  costOrFeasibility: string | null;
  isRecommended: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionRiskDTO {
  id: string;
  decisionId: string;
  description: string;
  severity: string;
  likelihood: string;
  mitigation: string | null;
  ownerId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionLinkDTO {
  id: string;
  relation: string;
  targetType: string;
  targetId: string;
  createdBy: string;
  createdAt: string;
}

/** GET /api/decisions/:id/detail — single aggregate read. */
export interface DecisionDetailDTO {
  id: string;
  title: string;
  description?: string;
  decisionType?: string;
  pmoDomain?: string;
  status: DecisionOutcomeStatus;
  priority?: string;
  impact?: string;
  escalationLevel?: number;
  escalationLevelName?: string;
  decisionOwnerId?: string;
  ownerName?: string;
  ownerAvatarUrl?: string;
  requestedById?: string;
  requestedByName?: string;
  createdAt: string;
  dueDate?: string;
  /** Rationale for the FINAL outcome (only set once decided). */
  rationale?: string;
  decidedAt?: string;
  decidedBy?: string;
  /** Optimistic-concurrency token — echo back as `expectedVersion` on decide(). */
  version: number;
  workflowStatus?: string;
  relatedObjectType?: string;
  relatedObjectId?: string;
  /** Legacy prose anatomy (migration 902) — read-only here, no CRUD endpoint. */
  alternatives?: unknown[] | null;
  risks?: unknown[] | null;
  consequencesOfInaction?: string | null;
  recommendation?: string | null;
  assumptions?: unknown[] | null;
  impacts: DecisionImpactDTO[];
  auditTrail: DecisionHistoryEntryDTO[];
  /** MW-DEC-001 real, persisted dossier objects. */
  comments: DecisionCommentDTO[];
  dossierAlternatives: DecisionAlternativeDTO[];
  dossierRisks: DecisionRiskDTO[];
  links: DecisionLinkDTO[];
}

/** Response of PUT/PATCH /api/decisions/:id/decide. */
export interface DecideResultDTO {
  id: string;
  status: DecisionOutcomeStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  version: number;
}

/** Minimal org-user directory entry used to resolve comment/alternative/risk author names. */
export interface WorkspaceUserRef {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}
