/**
 * RN-G3 lane `okr` full-tool task (2026-08-11) — unit tests for the pure
 * lifecycle-action gate functions in
 * `src/components/ResultsVNext/okr/okrWorkspaceMappers.ts`. These are
 * CLIENT-SIDE UX gates only (the real security boundary is the server
 * command layer, already covered by realDB tests server-side — this lane
 * is a client of that server, see the task's allowlist). Each assertion
 * below traces 1:1 to a cited `plik:linia` fact in the source file's own
 * header, re-verified against the server source during this task (not
 * copied from a doc without checking).
 *
 * No backend/DB required — every function under test is pure (`OkrSetDto`
 * in, `OkrActionGate | null` out).
 */
import { describe, expect, it } from 'vitest';

import type { OkrSetDto, OkrSetStatus } from '@/components/ResultsVNext/okr/okrApi';
import {
  gateActivate,
  gateApprove,
  gateCancel,
  gateCarryForward,
  gateClose,
  gateManagerReviewSubmit,
  gateOpenReview,
  gateRequestChanges,
  gateSelfReview,
  gateSubmit,
} from '@/components/ResultsVNext/okr/okrWorkspaceMappers';

function makeSet(overrides: Partial<OkrSetDto> = {}): OkrSetDto {
  return {
    setId: 'set-1',
    organizationId: 'org-1',
    programId: 'program-1',
    cycleId: 'cycle-1',
    scopeType: 'individual',
    scopeId: 'user-owner',
    ownerUserId: 'user-owner',
    reviewerUserId: 'user-reviewer',
    title: 'Test set',
    status: 'draft',
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: null,
    latestApprovedSnapshotId: null,
    overallProgress: null,
    overallConfidence: null,
    attentionState: 'none',
    lastCheckinAt: null,
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 1,
    createdBy: 'user-owner',
    createdAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const ALL_STATUSES: OkrSetStatus[] = [
  'not_required',
  'required',
  'draft',
  'submitted',
  'changes_requested',
  'approved',
  'active',
  'review',
  'closed',
  'cancelled',
];

describe('gateSubmit — okrSetCommands.ts:761,799 (fromStatuses draft|changes_requested)', () => {
  it('allows from draft and changes_requested only', () => {
    const allowed: OkrSetStatus[] = ['draft', 'changes_requested'];
    for (const status of ALL_STATUSES) {
      const gate = gateSubmit(makeSet({ status }));
      if (allowed.includes(status)) {
        expect(gate, `status ${status} should be submittable`).toBeNull();
      } else {
        expect(gate, `status ${status} should NOT be submittable`).not.toBeNull();
      }
    }
  });
});

describe('gateApprove — okrSetCommands.ts:955-960 (status===submitted) + :948-953 (self-approval denial)', () => {
  it('requires status submitted', () => {
    expect(gateApprove(makeSet({ status: 'submitted' }), 'user-approver')).toBeNull();
    for (const status of ALL_STATUSES.filter((s) => s !== 'submitted')) {
      expect(gateApprove(makeSet({ status }), 'user-approver'), `status ${status}`).not.toBeNull();
    }
  });

  it('denies self-approval when the approver submitted the set', () => {
    const set = makeSet({ status: 'submitted', submittedBy: 'user-x' });
    expect(gateApprove(set, 'user-x')).not.toBeNull();
    expect(gateApprove(set, 'user-y')).toBeNull();
  });

  it('denies self-approval when the approver created the set', () => {
    const set = makeSet({ status: 'submitted', createdBy: 'user-x', submittedBy: 'user-other' });
    expect(gateApprove(set, 'user-x')).not.toBeNull();
  });

  it('allows when currentUserId is unknown (null) — client cannot assert self-approval it cannot see', () => {
    expect(gateApprove(makeSet({ status: 'submitted' }), null)).toBeNull();
  });
});

describe('gateRequestChanges — okrSetCommands.ts:1083-1088 (status===submitted)', () => {
  it('requires status submitted', () => {
    expect(gateRequestChanges(makeSet({ status: 'submitted' }))).toBeNull();
    for (const status of ALL_STATUSES.filter((s) => s !== 'submitted')) {
      expect(gateRequestChanges(makeSet({ status })), `status ${status}`).not.toBeNull();
    }
  });
});

describe('gateActivate — OKR_SET_ACTIVATE_SPEC okrSetCommands.ts:1255-1259 (fromStatuses approved)', () => {
  it('requires status approved', () => {
    expect(gateActivate(makeSet({ status: 'approved' }))).toBeNull();
    for (const status of ALL_STATUSES.filter((s) => s !== 'approved')) {
      expect(gateActivate(makeSet({ status })), `status ${status}`).not.toBeNull();
    }
  });
});

describe('gateOpenReview — OKR_SET_OPEN_REVIEW_SPEC okrSetCommands.ts:1278-1282 (fromStatuses active)', () => {
  it('requires status active', () => {
    expect(gateOpenReview(makeSet({ status: 'active' }))).toBeNull();
    for (const status of ALL_STATUSES.filter((s) => s !== 'active')) {
      expect(gateOpenReview(makeSet({ status })), `status ${status}`).not.toBeNull();
    }
  });
});

describe('gateCancel — OKR_SET_CANCEL_SPEC okrSetCommands.ts:1266-1270', () => {
  it('allows draft/submitted/changes_requested/approved/active, blocks the rest', () => {
    const allowed: OkrSetStatus[] = ['draft', 'submitted', 'changes_requested', 'approved', 'active'];
    for (const status of ALL_STATUSES) {
      const gate = gateCancel(makeSet({ status }));
      if (allowed.includes(status)) {
        expect(gate, `status ${status} should be cancellable`).toBeNull();
      } else {
        expect(gate, `status ${status} should NOT be cancellable`).not.toBeNull();
      }
    }
  });
});

describe('gateClose — okrSetCommands.ts:1366-1372 (status===review)', () => {
  it('requires status review', () => {
    expect(gateClose(makeSet({ status: 'review' }))).toBeNull();
    for (const status of ALL_STATUSES.filter((s) => s !== 'review')) {
      expect(gateClose(makeSet({ status })), `status ${status}`).not.toBeNull();
    }
  });
});

describe('gateCarryForward — okrCarryForwardCommands.ts:89-95 (source status===closed)', () => {
  it('requires status closed', () => {
    expect(gateCarryForward(makeSet({ status: 'closed' }))).toBeNull();
    for (const status of ALL_STATUSES.filter((s) => s !== 'closed')) {
      expect(gateCarryForward(makeSet({ status })), `status ${status}`).not.toBeNull();
    }
  });
});

describe('gateSelfReview — okrReviewCommands.ts:269-276 (only the Set owner may submit)', () => {
  it('allows the owner, blocks anyone else', () => {
    const set = makeSet({ ownerUserId: 'user-owner' });
    expect(gateSelfReview(set, 'user-owner')).toBeNull();
    expect(gateSelfReview(set, 'user-someone-else')).not.toBeNull();
  });

  it('allows when currentUserId is unknown (null) — client cannot assert ownership it cannot see', () => {
    expect(gateSelfReview(makeSet(), null)).toBeNull();
  });
});

describe('gateManagerReviewSubmit — okrReviewCommands.ts:422-429 (requires reviewer_user_id assigned)', () => {
  it('blocks when no reviewer is assigned', () => {
    expect(gateManagerReviewSubmit(makeSet({ reviewerUserId: null }))).not.toBeNull();
  });
  it('allows when a reviewer is assigned', () => {
    expect(gateManagerReviewSubmit(makeSet({ reviewerUserId: 'user-reviewer' }))).toBeNull();
  });
});
