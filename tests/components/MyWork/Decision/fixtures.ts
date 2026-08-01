/**
 * MW-DEC-001 — shared, pure test fixtures for the Decision workspace test
 * suite. Not a test file itself (no `.test.ts` suffix, so vitest's `include`
 * globs never collect it directly) — just data builders reused by the real
 * `.test.tsx` files in this directory.
 */
import type {
  DecideResultDTO,
  DecisionAlternativeDTO,
  DecisionCommentDTO,
  DecisionDetailDTO,
  DecisionRiskDTO,
  WorkspaceUserRef,
} from '@/components/MyWork/Decision/types';

export function makeDetail(overrides: Partial<DecisionDetailDTO> = {}): DecisionDetailDTO {
  return {
    id: 'dec-1',
    title: 'Adopt Vendor X for billing',
    description: 'Should we migrate billing to Vendor X?',
    decisionType: 'Vendor',
    status: 'PENDING',
    priority: 'HIGH',
    decisionOwnerId: 'user-1',
    ownerName: 'Ada Owner',
    requestedById: 'user-2',
    requestedByName: 'Rita Requester',
    createdAt: '2026-07-01T10:00:00Z',
    dueDate: '2026-09-01T00:00:00Z',
    version: 3,
    impacts: [],
    auditTrail: [],
    comments: [],
    dossierAlternatives: [],
    dossierRisks: [],
    links: [],
    ...overrides,
  };
}

export function makeComment(overrides: Partial<DecisionCommentDTO> = {}): DecisionCommentDTO {
  return {
    id: 'comment-1',
    decisionId: 'dec-1',
    authorId: 'user-1',
    body: 'This looks good to me.',
    createdAt: '2026-07-02T10:00:00Z',
    updatedAt: '2026-07-02T10:00:00Z',
    ...overrides,
  };
}

export function makeAlternative(
  overrides: Partial<DecisionAlternativeDTO> = {}
): DecisionAlternativeDTO {
  return {
    id: 'alt-1',
    decisionId: 'dec-1',
    title: 'Stay with current vendor',
    description: null,
    benefits: null,
    drawbacks: null,
    costOrFeasibility: null,
    isRecommended: false,
    createdBy: 'user-1',
    createdAt: '2026-07-02T10:00:00Z',
    updatedAt: '2026-07-02T10:00:00Z',
    ...overrides,
  };
}

export function makeRisk(overrides: Partial<DecisionRiskDTO> = {}): DecisionRiskDTO {
  return {
    id: 'risk-1',
    decisionId: 'dec-1',
    description: 'Migration could cause a billing outage.',
    severity: 'MEDIUM',
    likelihood: 'MEDIUM',
    mitigation: null,
    ownerId: null,
    createdBy: 'user-1',
    createdAt: '2026-07-02T10:00:00Z',
    updatedAt: '2026-07-02T10:00:00Z',
    ...overrides,
  };
}

export function makeDecideResult(overrides: Partial<DecideResultDTO> = {}): DecideResultDTO {
  return {
    id: 'dec-1',
    status: 'APPROVED',
    decidedBy: 'user-1',
    decidedAt: '2026-07-05T12:00:00Z',
    version: 4,
    ...overrides,
  };
}

export function makeUsers(): WorkspaceUserRef[] {
  return [
    { id: 'user-1', name: 'Ada Owner', email: 'ada@example.com' },
    { id: 'user-2', name: 'Rita Requester', email: 'rita@example.com' },
  ];
}

/** Shape `Api.get/post/put/delete` throw on failure (src/services/api.ts `handleResponse`). */
export function apiError(status: number, data?: Record<string, unknown>, message?: string): Error {
  const err = new Error(message || `Request failed with status ${status}`) as Error & {
    status?: number;
    data?: Record<string, unknown>;
  };
  err.status = status;
  err.data = data;
  return err;
}
