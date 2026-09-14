/** @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import { decidePortfolio } from '../portfolioDecision.js';

function harness() {
  const initiative = {
    initiativeId: 'initiative-a',
    lifecycleState: 'READY_FOR_DECISION',
    portfolioDecisionId: 'decision-a',
    cardRefs: { summary: { cardVersion: 4 } },
  };
  const decision = {
    decisionId: 'decision-a',
    initiativeId: 'initiative-a',
    status: 'PENDING',
    requesterId: 'requester',
    authorityId: 'authority',
    scenarioId: 'scenario-a',
    scenarioVersion: 2,
    initiativeVersion: 6,
    cardVersions: { summary: 4 },
    membershipSnapshot: { initiativeId: 'initiative-a', initiativeVersion: 6 },
    conditions: [],
    mergeTargetInitiativeId: null,
    rationale: null,
    requestedAt: '2026-09-13T10:00:00.000Z',
    dueAt: '2026-09-20T10:00:00.000Z',
    decidedAt: null,
    policy: { policyId: 'policy-a', policyVersion: 1 },
  };
  const transaction = {
    findReceipt: vi.fn().mockResolvedValue(null),
    getAggregateVersion: vi.fn().mockResolvedValue(7),
    getAggregatePayload: vi.fn().mockResolvedValue(initiative),
    getRelatedAggregateForUpdate: vi.fn(async (_org: string, type: string) => {
      if (type === 'decision') return { version: 1, payload: decision };
      if (type === 'portfolio_analysis')
        return {
          version: 3,
          payload: {
            status: 'PENDING_REVIEW',
            snapshot: {
              snapshotVersion: 2,
              portfolio: { scenarioId: 'scenario-a' },
              asOf: '2026-09-13T10:00:00.000Z',
              initiatives: [
                { initiativeId: 'initiative-a', initiativeVersion: 6, source: 'CANONICAL' },
              ],
            },
            items: [
              {
                itemId: 'decision-item-a',
                kind: 'DECISION',
                initiativeIds: ['initiative-a'],
                proposedDisposition: { kind: 'ARCHIVE' },
              },
            ],
          },
        };
      return {
        version: 2,
        payload: { status: 'PUBLISHED', scenarioVersion: 2 },
      };
    }),
    persistRelatedAggregate: vi.fn().mockResolvedValue(undefined),
    persistAggregate: vi.fn().mockResolvedValue(undefined),
    appendAudit: vi.fn().mockResolvedValue(undefined),
    appendOutbox: vi.fn().mockResolvedValue(undefined),
    saveReceipt: vi.fn().mockResolvedValue(undefined),
  };
  return {
    transaction,
    unitOfWork: {
      transaction: vi.fn(async (work: (tx: typeof transaction) => Promise<unknown>) =>
        work(transaction)
      ),
    },
  };
}

describe('E1b portfolio decision disposition', () => {
  it('records ARCHIVE separately from REJECTED and keeps lifecycle unchanged', async () => {
    const { transaction, unitOfWork } = harness();

    const result = await decidePortfolio(
      unitOfWork as any,
      {
        organizationId: 'org-a',
        actorId: 'authority',
        aggregateType: 'initiative',
        aggregateId: 'initiative-a',
        expectedVersion: 7,
        clientRequestId: 'decision-request-a',
        correlationId: 'decision-correlation-a',
        policyId: 'policy-a',
        policyVersion: 1,
        commandType: 'initiative.portfolio.decide',
        payload: {
          decisionId: 'decision-a',
          outcome: 'REJECTED',
          rationale: 'The portfolio does not cover this theme now.',
          conditions: [],
          mergeTargetInitiativeId: null,
          selfApprovalAllowed: true,
          disposition: {
            kind: 'ARCHIVE',
            reason: 'The portfolio does not cover this theme now.',
            returnCondition: 'Re-open when the approved strategy includes theme X.',
            inputSnapshot: {
              analysisId: 'analysis-a',
              analysisVersion: 3,
              itemId: 'decision-item-a',
              asOf: '2026-09-13T10:00:00.000Z',
            },
          },
        },
      } as any
    );

    expect(result.response).toMatchObject({
      status: 'REJECTED',
      disposition: {
        kind: 'ARCHIVE',
        reason: 'The portfolio does not cover this theme now.',
        returnCondition: 'Re-open when the approved strategy includes theme X.',
        actorId: 'authority',
        inputSnapshot: { analysisId: 'analysis-a', analysisVersion: 3 },
        frozenInput: {
          snapshotVersion: 2,
          asOf: '2026-09-13T10:00:00.000Z',
          initiative: { initiativeId: 'initiative-a', initiativeVersion: 6 },
          item: { itemId: 'decision-item-a', kind: 'DECISION' },
        },
      },
    });
    expect(transaction.persistAggregate).toHaveBeenCalledWith(
      'org-a',
      'initiative',
      'initiative-a',
      7,
      8,
      expect.objectContaining({
        lifecycleState: 'READY_FOR_DECISION',
        portfolioDisposition: expect.objectContaining({ kind: 'ARCHIVE', actorId: 'authority' }),
      })
    );
    expect(transaction.persistAggregate.mock.calls[0][5]).not.toHaveProperty(
      'disposition',
      'REJECTED'
    );
  });

  it('refuses a disposition that is not anchored to the exact persisted analysis item', async () => {
    const { transaction, unitOfWork } = harness();
    transaction.getRelatedAggregateForUpdate.mockImplementation(
      async (_org: string, type: string) => {
        if (type === 'decision')
          return {
            version: 1,
            payload: {
              decisionId: 'decision-a',
              initiativeId: 'initiative-a',
              status: 'PENDING',
              requesterId: 'requester',
              authorityId: 'authority',
              scenarioId: 'scenario-a',
              scenarioVersion: 2,
              initiativeVersion: 6,
              cardVersions: { summary: 4 },
            },
          };
        if (type === 'portfolio_analysis')
          return {
            version: 2,
            payload: {
              status: 'PENDING_REVIEW',
              snapshot: { asOf: '2026-09-13T10:00:00.000Z' },
              items: [],
            },
          };
        return { version: 2, payload: { status: 'PUBLISHED', scenarioVersion: 2 } };
      }
    );

    await expect(
      decidePortfolio(
        unitOfWork as any,
        {
          organizationId: 'org-a',
          actorId: 'authority',
          aggregateType: 'initiative',
          aggregateId: 'initiative-a',
          expectedVersion: 7,
          clientRequestId: 'request-stale',
          correlationId: 'correlation-stale',
          policyId: 'policy-a',
          policyVersion: 1,
          commandType: 'initiative.portfolio.decide',
          payload: {
            decisionId: 'decision-a',
            outcome: 'REJECTED',
            rationale: 'Archive for now.',
            conditions: [],
            mergeTargetInitiativeId: null,
            selfApprovalAllowed: true,
            disposition: {
              kind: 'ARCHIVE',
              reason: 'Archive for now.',
              returnCondition: 'Strategy changes.',
              inputSnapshot: {
                analysisId: 'analysis-a',
                analysisVersion: 3,
                itemId: 'decision-item-a',
                asOf: '2026-09-13T10:00:00.000Z',
              },
            },
          },
        } as any
      )
    ).rejects.toThrow('Exact Portfolio analysis Decision item required');
    expect(transaction.persistAggregate).not.toHaveBeenCalled();
  });
});
