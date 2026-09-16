import { describe, expect, it } from 'vitest';

import type { InboxItem } from '../InboxContent';
import {
  acceptanceDecisionInboxItems,
  actorScopedDecisionInboxItem,
  actorScopedDecisionList,
  analysisDecisionInboxItem,
  inboxPmoQueue,
  transitionProposalInboxItem,
} from '../inboxPmoQueues';

const item = (overrides: Partial<InboxItem> = {}) =>
  ({
    id: 'inbox-1',
    title: 'Review initiative stage',
    type: 'project_update',
    section: 'other',
    status: 'unread',
    urgency: 'normal',
    receivedAt: '2026-09-16T12:00:00Z',
    isActionable: true,
    sourceEntityType: 'initiative_stage',
    initiativeId: 'initiative-1',
    _key: 'notification:inbox-1',
    ...overrides,
  }) as InboxItem;

describe('PMO-1a personal inbox queues', () => {
  const now = new Date('2026-09-16T12:00:00Z');

  it('uses the same exclusive priority: overdue, blocked, approve, discuss, review', () => {
    expect(
      inboxPmoQueue(item({ section: 'blocked_escalations', dueDate: '2026-09-15T12:00:00Z' }), now)
    ).toBe('overdue');
    expect(inboxPmoQueue(item({ section: 'blocked_escalations' }), now)).toBe('blocked');
    expect(inboxPmoQueue(item({ section: 'approvals_gates' }), now)).toBe('approve');
    expect(inboxPmoQueue(item({ section: 'decisions_required' }), now)).toBe('discuss');
    expect(inboxPmoQueue(item(), now)).toBe('review');
  });

  it('never classifies generic Inbox items as PMO work', () => {
    expect(inboxPmoQueue(item({ sourceEntityType: 'task' }), now)).toBeNull();
    expect(inboxPmoQueue(item({ initiativeId: undefined }), now)).toBeNull();
  });

  it('maps actor-scoped proposal and analysis decision sources to initiative-stage items', () => {
    expect(
      transitionProposalInboxItem({
        proposalVersionId: 'proposal-1',
        initiativeId: 'initiative-1',
        initiativeName: 'Northwind',
        fromStatus: 'PROMOTED',
        toStatus: 'PLANNING',
        reason: 'Plan ready',
        createdAt: '2026-09-16T12:00:00Z',
        expiresAt: '2026-09-18T12:00:00Z',
        viewerIsReviewer: true,
      } as never).sourceEntityType
    ).toBe('initiative_stage');
    const analysisItem = analysisDecisionInboxItem({
      version: 1,
      decisionId: 'analysis-1',
      initiativeId: 'initiative-1',
      gate: 'ANALYSIS',
      status: 'PENDING',
      requesterId: 'requester-1',
      authorityId: 'reviewer-1',
      dueAt: '2026-09-18T12:00:00Z',
      requestedAt: '2026-09-16T12:00:00Z',
      cardVersions: {},
    });
    expect(analysisItem.initiativeId).toBe('initiative-1');
    expect(inboxPmoQueue(analysisItem, now)).toBe('review');
  });

  it('normalizes the existing portfolio, schedule, handoff and acceptance queues', () => {
    const decisions = actorScopedDecisionList({
      decisions: [
        {
          decisionId: 'schedule-1',
          initiativeId: 'initiative-1',
          dueAt: '2026-09-18T12:00:00Z',
        },
        { decisionId: '', initiativeId: 'must-be-rejected' },
      ],
    });
    expect(decisions).toHaveLength(1);
    expect(actorScopedDecisionInboxItem(decisions[0], 'Schedule')).toMatchObject({
      id: 'schedule-1',
      sourceEntityType: 'initiative_stage',
      initiativeId: 'initiative-1',
    });
    expect(
      acceptanceDecisionInboxItems({
        delivery: [{ decisionId: 'delivery-1', initiativeId: 'initiative-2' }],
        results: [{ resultsCaseId: 'results-1', initiativeId: 'initiative-3' }],
      }).map((entry) => entry.id)
    ).toEqual(['delivery-1', 'results-1']);
  });
});
