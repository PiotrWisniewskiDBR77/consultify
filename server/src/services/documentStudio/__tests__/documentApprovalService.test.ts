/**
 * Document Studio — Approval Workflow Service tests (Epic E10, Slice 10.1).
 *
 * Covers the multi-reviewer approval data plane:
 *
 *   - request → pending state, single open per (org, artifact),
 *     duplicate-open guard, participant normalization,
 *     required-participant invariant;
 *   - record decision → audit trail + auto-resolution under all three
 *     quorum policies (unanimous / majority / single_approval);
 *   - rejection / changes_requested precedence over quorum approval;
 *   - reviewer-not-participant + decision-already-recorded guards;
 *   - cancel by author only; forbidden for non-requester;
 *   - tenant isolation (cross-tenant reads return null/[]);
 *   - hydration loads persisted approvals on cold start;
 *   - audit trail records every transition with stable action codes.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { persistApproval } from '../documentApprovalRegistryDao.js';
import {
  __loadApprovalByIdForTests,
  __resetApprovalServiceAndPersistenceForTests,
  cancelApproval,
  DocumentApprovalError,
  ensureApprovalRegistryHydrated,
  evaluateApprovalResolution,
  getActiveApprovalForArtifact,
  getApproval,
  isTerminalApprovalStatus,
  listDocumentApprovalAuditEntries,
  listDocumentApprovals,
  recordApprovalDecision,
  requestDocumentApproval,
} from '../documentApprovalService.js';
import type {
  DocumentApprovalDecision,
  DocumentApprovalParticipant,
} from '../documentStudioTypes.js';

const ORG_A = 'org-A';
const ORG_B = 'org-B';
const ART_1 = 'artifact-1';
const ART_2 = 'artifact-2';
const AUTHOR = 'user-author';
const REVIEWER_1 = 'user-rev1';
const REVIEWER_2 = 'user-rev2';
const REVIEWER_3 = 'user-rev3';
const OPTIONAL = 'user-fyi';

beforeEach(async () => {
  await __resetApprovalServiceAndPersistenceForTests();
});

afterEach(async () => {
  await __resetApprovalServiceAndPersistenceForTests();
});

describe('isTerminalApprovalStatus', () => {
  it('marks the resolved + cancelled states as terminal and pending as live', () => {
    expect(isTerminalApprovalStatus('pending')).toBe(false);
    expect(isTerminalApprovalStatus('approved')).toBe(true);
    expect(isTerminalApprovalStatus('rejected')).toBe(true);
    expect(isTerminalApprovalStatus('changes_requested')).toBe(true);
    expect(isTerminalApprovalStatus('cancelled')).toBe(true);
  });
});

describe('evaluateApprovalResolution — quorum policies', () => {
  function makeParticipants(): DocumentApprovalParticipant[] {
    return [
      { userId: REVIEWER_1, required: true },
      { userId: REVIEWER_2, required: true },
      { userId: REVIEWER_3, required: true },
      { userId: OPTIONAL, required: false },
    ];
  }
  function makeDecision(
    reviewerId: string,
    kind: DocumentApprovalDecision['kind']
  ): DocumentApprovalDecision {
    return {
      decisionId: `dec-${reviewerId}`,
      approvalId: 'a-1',
      reviewerId,
      kind,
      occurredAt: '2026-05-08T00:00:00.000Z',
    };
  }

  it('unanimous: pending until every required reviewer approves', () => {
    const ps = makeParticipants();
    expect(evaluateApprovalResolution(ps, [], 'unanimous')).toBe('pending');
    expect(evaluateApprovalResolution(ps, [makeDecision(REVIEWER_1, 'approve')], 'unanimous')).toBe(
      'pending'
    );
    expect(
      evaluateApprovalResolution(
        ps,
        [
          makeDecision(REVIEWER_1, 'approve'),
          makeDecision(REVIEWER_2, 'approve'),
          makeDecision(REVIEWER_3, 'approve'),
        ],
        'unanimous'
      )
    ).toBe('approved');
  });

  it('majority: approves once strictly more than half of required reviewers approve', () => {
    const ps = makeParticipants();
    expect(
      evaluateApprovalResolution(
        ps,
        [makeDecision(REVIEWER_1, 'approve'), makeDecision(REVIEWER_2, 'approve')],
        'majority'
      )
    ).toBe('approved');
    expect(evaluateApprovalResolution(ps, [makeDecision(REVIEWER_1, 'approve')], 'majority')).toBe(
      'pending'
    );
  });

  it('single_approval: approves on the first required-reviewer approve', () => {
    const ps = makeParticipants();
    expect(
      evaluateApprovalResolution(ps, [makeDecision(REVIEWER_1, 'approve')], 'single_approval')
    ).toBe('approved');
  });

  it('any required-reviewer reject flips to rejected (policy-independent)', () => {
    const ps = makeParticipants();
    expect(
      evaluateApprovalResolution(
        ps,
        [makeDecision(REVIEWER_1, 'approve'), makeDecision(REVIEWER_2, 'reject')],
        'unanimous'
      )
    ).toBe('rejected');
  });

  it('any reviewer (required or optional) request_changes flips to changes_requested', () => {
    const ps = makeParticipants();
    expect(
      evaluateApprovalResolution(ps, [makeDecision(OPTIONAL, 'request_changes')], 'majority')
    ).toBe('changes_requested');
  });

  it('optional reviewer reject does NOT flip to rejected', () => {
    const ps = makeParticipants();
    expect(
      evaluateApprovalResolution(
        ps,
        [
          makeDecision(REVIEWER_1, 'approve'),
          makeDecision(REVIEWER_2, 'approve'),
          makeDecision(REVIEWER_3, 'approve'),
          makeDecision(OPTIONAL, 'reject'),
        ],
        'unanimous'
      )
    ).toBe('approved');
  });

  it('zero required reviewers resolves to approved immediately', () => {
    const ps: DocumentApprovalParticipant[] = [{ userId: OPTIONAL, required: false }];
    expect(evaluateApprovalResolution(ps, [], 'unanimous')).toBe('approved');
  });
});

describe('requestDocumentApproval', () => {
  it('opens a pending approval with normalized participants', () => {
    const approval = requestDocumentApproval({
      organizationId: ORG_A,
      artifactId: ART_1,
      userId: AUTHOR,
      participants: [
        { userId: ' rev1 ', required: true, role: ' Director ' },
        { userId: 'rev1', required: true },
        { userId: 'rev2', required: false },
        { userId: '', required: true },
      ],
    });

    expect(approval.approvalId).toMatch(/^approval-/);
    expect(approval.status).toBe('pending');
    expect(approval.quorumPolicy).toBe('unanimous');
    expect(approval.participants.map((p) => p.userId)).toEqual(['rev1', 'rev2']);
    expect(approval.participants[0]!.role).toBe('Director');
  });

  it('rejects an empty participant list', () => {
    expect(() =>
      requestDocumentApproval({
        organizationId: ORG_A,
        artifactId: ART_1,
        userId: AUTHOR,
        participants: [],
      })
    ).toThrow(DocumentApprovalError);
  });

  it('rejects when no required participant is provided', () => {
    expect(() =>
      requestDocumentApproval({
        organizationId: ORG_A,
        artifactId: ART_1,
        userId: AUTHOR,
        participants: [{ userId: 'rev1', required: false }],
      })
    ).toThrow(/required/);
  });

  it('rejects a second open approval for the same artifact with approval_already_open', () => {
    requestDocumentApproval({
      organizationId: ORG_A,
      artifactId: ART_1,
      userId: AUTHOR,
      participants: [{ userId: REVIEWER_1, required: true }],
    });
    expect(() =>
      requestDocumentApproval({
        organizationId: ORG_A,
        artifactId: ART_1,
        userId: AUTHOR,
        participants: [{ userId: REVIEWER_2, required: true }],
      })
    ).toThrow(/approval_already_open|already exists/i);
  });

  it('allows a new request after the previous one is resolved', () => {
    const first = requestDocumentApproval({
      organizationId: ORG_A,
      artifactId: ART_1,
      userId: AUTHOR,
      participants: [{ userId: REVIEWER_1, required: true }],
      quorumPolicy: 'single_approval',
    });
    recordApprovalDecision({
      organizationId: ORG_A,
      approvalId: first.approvalId,
      reviewerId: REVIEWER_1,
      kind: 'approve',
    });
    const second = requestDocumentApproval({
      organizationId: ORG_A,
      artifactId: ART_1,
      userId: AUTHOR,
      participants: [{ userId: REVIEWER_2, required: true }],
    });
    expect(second.status).toBe('pending');
  });

  it('allows parallel approvals for distinct artifacts within the same tenant', () => {
    const a1 = requestDocumentApproval({
      organizationId: ORG_A,
      artifactId: ART_1,
      userId: AUTHOR,
      participants: [{ userId: REVIEWER_1, required: true }],
    });
    const a2 = requestDocumentApproval({
      organizationId: ORG_A,
      artifactId: ART_2,
      userId: AUTHOR,
      participants: [{ userId: REVIEWER_2, required: true }],
    });
    expect(a1.approvalId).not.toBe(a2.approvalId);
  });

  it('persists the request via the DAO', async () => {
    const approval = requestDocumentApproval({
      organizationId: ORG_A,
      artifactId: ART_1,
      userId: AUTHOR,
      participants: [{ userId: REVIEWER_1, required: true }],
    });
    const persisted = await __loadApprovalByIdForTests(approval.approvalId, ORG_A);
    expect(persisted).not.toBeNull();
    expect(persisted!.artifactId).toBe(ART_1);
  });
});

describe('recordApprovalDecision', () => {
  function open(quorum: 'unanimous' | 'majority' | 'single_approval' = 'unanimous') {
    return requestDocumentApproval({
      organizationId: ORG_A,
      artifactId: ART_1,
      userId: AUTHOR,
      quorumPolicy: quorum,
      participants: [
        { userId: REVIEWER_1, required: true },
        { userId: REVIEWER_2, required: true },
        { userId: OPTIONAL, required: false },
      ],
    });
  }

  it('appends a decision and keeps the request pending under unanimous quorum', () => {
    const approval = open('unanimous');
    const next = recordApprovalDecision({
      organizationId: ORG_A,
      approvalId: approval.approvalId,
      reviewerId: REVIEWER_1,
      kind: 'approve',
    });
    expect(next.status).toBe('pending');
    expect(next.decisions).toHaveLength(1);
  });

  it('auto-resolves to approved once unanimous quorum is reached', () => {
    const approval = open('unanimous');
    recordApprovalDecision({
      organizationId: ORG_A,
      approvalId: approval.approvalId,
      reviewerId: REVIEWER_1,
      kind: 'approve',
    });
    const final = recordApprovalDecision({
      organizationId: ORG_A,
      approvalId: approval.approvalId,
      reviewerId: REVIEWER_2,
      kind: 'approve',
    });
    expect(final.status).toBe('approved');
    expect(final.resolvedAt).toBeDefined();
    expect(final.resolvedBy).toBe(REVIEWER_2);
    expect(final.resolutionReason).toBe('approved');
  });

  it('auto-resolves to approved on the first approve under single_approval', () => {
    const approval = open('single_approval');
    const final = recordApprovalDecision({
      organizationId: ORG_A,
      approvalId: approval.approvalId,
      reviewerId: REVIEWER_1,
      kind: 'approve',
    });
    expect(final.status).toBe('approved');
  });

  it('auto-resolves to rejected on a required-reviewer reject', () => {
    const approval = open('majority');
    const final = recordApprovalDecision({
      organizationId: ORG_A,
      approvalId: approval.approvalId,
      reviewerId: REVIEWER_1,
      kind: 'reject',
    });
    expect(final.status).toBe('rejected');
  });

  it('auto-resolves to changes_requested on any request_changes (even optional reviewer)', () => {
    const approval = open('unanimous');
    const final = recordApprovalDecision({
      organizationId: ORG_A,
      approvalId: approval.approvalId,
      reviewerId: OPTIONAL,
      kind: 'request_changes',
      comment: ' please clarify section 3 ',
    });
    expect(final.status).toBe('changes_requested');
    expect(final.decisions[0]!.comment).toBe('please clarify section 3');
  });

  it('rejects a decision from a non-participant with reviewer_not_participant', () => {
    const approval = open();
    expect(() =>
      recordApprovalDecision({
        organizationId: ORG_A,
        approvalId: approval.approvalId,
        reviewerId: 'stranger',
        kind: 'approve',
      })
    ).toThrow(/not_participant|not a participant/i);
  });

  it('rejects a duplicate decision from the same reviewer with decision_already_recorded', () => {
    const approval = open();
    recordApprovalDecision({
      organizationId: ORG_A,
      approvalId: approval.approvalId,
      reviewerId: REVIEWER_1,
      kind: 'approve',
    });
    expect(() =>
      recordApprovalDecision({
        organizationId: ORG_A,
        approvalId: approval.approvalId,
        reviewerId: REVIEWER_1,
        kind: 'reject',
      })
    ).toThrow(/already_recorded|already submitted/i);
  });

  it('rejects decisions on a resolved approval with approval_already_resolved', () => {
    const approval = open('single_approval');
    recordApprovalDecision({
      organizationId: ORG_A,
      approvalId: approval.approvalId,
      reviewerId: REVIEWER_1,
      kind: 'approve',
    });
    expect(() =>
      recordApprovalDecision({
        organizationId: ORG_A,
        approvalId: approval.approvalId,
        reviewerId: REVIEWER_2,
        kind: 'approve',
      })
    ).toThrow(/already_resolved|terminal/i);
  });

  it('rejects unknown decision kinds', () => {
    const approval = open();
    expect(() =>
      recordApprovalDecision({
        organizationId: ORG_A,
        approvalId: approval.approvalId,
        reviewerId: REVIEWER_1,
        kind: 'whatever' as never,
      })
    ).toThrow(DocumentApprovalError);
  });
});

describe('cancelApproval', () => {
  it('moves the approval to cancelled by the original requester', () => {
    const approval = requestDocumentApproval({
      organizationId: ORG_A,
      artifactId: ART_1,
      userId: AUTHOR,
      participants: [{ userId: REVIEWER_1, required: true }],
    });
    const cancelled = cancelApproval({
      organizationId: ORG_A,
      approvalId: approval.approvalId,
      userId: AUTHOR,
      reason: 'withdrawn',
    });
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelledBy).toBe(AUTHOR);
    expect(cancelled.cancelledAt).toBeDefined();
  });

  it('forbids non-requesters from cancelling', () => {
    const approval = requestDocumentApproval({
      organizationId: ORG_A,
      artifactId: ART_1,
      userId: AUTHOR,
      participants: [{ userId: REVIEWER_1, required: true }],
    });
    expect(() =>
      cancelApproval({
        organizationId: ORG_A,
        approvalId: approval.approvalId,
        userId: REVIEWER_1,
      })
    ).toThrow(/forbidden|requester/i);
  });

  it('rejects cancelling an already-resolved approval', () => {
    const approval = requestDocumentApproval({
      organizationId: ORG_A,
      artifactId: ART_1,
      userId: AUTHOR,
      participants: [{ userId: REVIEWER_1, required: true }],
      quorumPolicy: 'single_approval',
    });
    recordApprovalDecision({
      organizationId: ORG_A,
      approvalId: approval.approvalId,
      reviewerId: REVIEWER_1,
      kind: 'approve',
    });
    expect(() =>
      cancelApproval({
        organizationId: ORG_A,
        approvalId: approval.approvalId,
        userId: AUTHOR,
      })
    ).toThrow(/already_resolved|terminal/i);
  });
});

describe('reads + tenant isolation', () => {
  it('cross-tenant reads return null', () => {
    const approval = requestDocumentApproval({
      organizationId: ORG_A,
      artifactId: ART_1,
      userId: AUTHOR,
      participants: [{ userId: REVIEWER_1, required: true }],
    });
    expect(getApproval(approval.approvalId, ORG_B)).toBeNull();
  });

  it('lists approvals filtered by status and artifact', () => {
    const a1 = requestDocumentApproval({
      organizationId: ORG_A,
      artifactId: ART_1,
      userId: AUTHOR,
      participants: [{ userId: REVIEWER_1, required: true }],
      quorumPolicy: 'single_approval',
    });
    requestDocumentApproval({
      organizationId: ORG_A,
      artifactId: ART_2,
      userId: AUTHOR,
      participants: [{ userId: REVIEWER_2, required: true }],
    });
    recordApprovalDecision({
      organizationId: ORG_A,
      approvalId: a1.approvalId,
      reviewerId: REVIEWER_1,
      kind: 'approve',
    });

    const all = listDocumentApprovals(ORG_A);
    expect(all).toHaveLength(2);
    const pending = listDocumentApprovals(ORG_A, { status: 'pending' });
    expect(pending).toHaveLength(1);
    expect(pending[0]!.artifactId).toBe(ART_2);
    const onlyArt1 = listDocumentApprovals(ORG_A, { artifactId: ART_1 });
    expect(onlyArt1).toHaveLength(1);
    expect(onlyArt1[0]!.status).toBe('approved');
  });

  it('getActiveApprovalForArtifact returns the single open approval', () => {
    const a = requestDocumentApproval({
      organizationId: ORG_A,
      artifactId: ART_1,
      userId: AUTHOR,
      participants: [{ userId: REVIEWER_1, required: true }],
    });
    expect(getActiveApprovalForArtifact(ORG_A, ART_1)?.approvalId).toBe(a.approvalId);
    cancelApproval({
      organizationId: ORG_A,
      approvalId: a.approvalId,
      userId: AUTHOR,
    });
    expect(getActiveApprovalForArtifact(ORG_A, ART_1)).toBeNull();
  });
});

describe('hydration', () => {
  it('loads persisted approvals on cold start', async () => {
    await persistApproval({
      approvalId: 'pre-existing-approval',
      organizationId: ORG_A,
      artifactId: ART_1,
      requestedBy: AUTHOR,
      participants: [{ userId: REVIEWER_1, required: true }],
      quorumPolicy: 'majority',
      status: 'pending',
      decisions: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await ensureApprovalRegistryHydrated(ORG_A, ART_1);
    const approval = getApproval('pre-existing-approval', ORG_A);
    expect(approval).not.toBeNull();
    expect(approval!.quorumPolicy).toBe('majority');
  });
});

describe('audit trail', () => {
  it('records request, decision, resolved, and cancelled actions in order', () => {
    const a1 = requestDocumentApproval({
      organizationId: ORG_A,
      artifactId: ART_1,
      userId: AUTHOR,
      participants: [
        { userId: REVIEWER_1, required: true },
        { userId: REVIEWER_2, required: true },
      ],
      quorumPolicy: 'unanimous',
    });
    recordApprovalDecision({
      organizationId: ORG_A,
      approvalId: a1.approvalId,
      reviewerId: REVIEWER_1,
      kind: 'approve',
    });
    recordApprovalDecision({
      organizationId: ORG_A,
      approvalId: a1.approvalId,
      reviewerId: REVIEWER_2,
      kind: 'approve',
    });

    const audit = listDocumentApprovalAuditEntries(a1.approvalId, ORG_A);
    expect(audit.map((e) => e.action)).toEqual([
      'approval_requested',
      'approval_decision_recorded',
      'approval_decision_recorded',
      'approval_resolved',
    ]);
  });

  it('records cancelled action on cancellation', () => {
    const a1 = requestDocumentApproval({
      organizationId: ORG_A,
      artifactId: ART_2,
      userId: AUTHOR,
      participants: [{ userId: REVIEWER_1, required: true }],
    });
    cancelApproval({
      organizationId: ORG_A,
      approvalId: a1.approvalId,
      userId: AUTHOR,
      reason: 'withdrawn',
    });
    const audit = listDocumentApprovalAuditEntries(a1.approvalId, ORG_A);
    expect(audit.map((e) => e.action)).toEqual(['approval_requested', 'approval_cancelled']);
    expect(audit[1]!.details).toMatchObject({ reason: 'withdrawn' });
  });
});
