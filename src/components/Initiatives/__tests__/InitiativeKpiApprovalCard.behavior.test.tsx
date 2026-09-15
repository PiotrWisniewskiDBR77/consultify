import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InitiativeKpiApprovalCard } from '../InitiativeKpiApprovalCard';

const readDefinitionApproval = vi.fn();
const readInitiativeCards = vi.fn();
const publishInitiativeCard = vi.fn();
const reviewInitiativeCard = vi.fn();

vi.mock('@/utils/initiativesPortfolioAnalysisFlag', () => ({
  isInitiativesPortfolioAnalysisEnabled: () => true,
}));
vi.mock('@/services/initiatives-execution/definitionApprovalApi', () => ({
  readDefinitionApproval: (...args: unknown[]) => readDefinitionApproval(...args),
}));
vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  readInitiativeCards: (...args: unknown[]) => readInitiativeCards(...args),
  publishInitiativeCard: (...args: unknown[]) => publishInitiativeCard(...args),
  reviewInitiativeCard: (...args: unknown[]) => reviewInitiativeCard(...args),
}));

const kpis = [
  {
    id: 'kpi-cycle-time',
    name: 'Cycle time',
    unit: 'days',
    baseline: '10',
    target: '6',
    current: '9',
    observationPhase: 'realization' as const,
    trackedInRealization: true,
    trackedPostImplementation: false,
    realizationTarget: '6',
    postImplementationTarget: '',
    cadence: 'WEEKLY',
  },
];

describe('InitiativeKpiApprovalCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publishInitiativeCard.mockResolvedValue({ status: 'APPLIED', aggregateVersion: 3, cardVersion: 1 });
    reviewInitiativeCard.mockResolvedValue({ status: 'APPLIED', aggregateVersion: 4, cardVersion: 2 });
  });

  it('keeps the approval action visible but disabled for an unauthorized viewer', async () => {
    readDefinitionApproval.mockResolvedValue({
      enabled: true,
      actorId: 'viewer',
      capabilities: { edit: false, review: false },
    });
    readInitiativeCards.mockResolvedValue({
      initiativeVersion: 2,
      cards: [{ cardKey: 'kpi', cardVersion: 1, reviewState: 'REQUESTED', publishedBy: 'author' }],
    });

    render(<InitiativeKpiApprovalCard initiativeId="initiative-1" kpis={kpis} />);

    const approve = await screen.findByRole('button', { name: 'Approve KPI set' });
    expect(approve).toBeDisabled();
    expect(approve).toHaveAttribute(
      'title',
      'You do not have permission to approve this KPI set.'
    );
  });

  it('publishes the current KPI set as a snapshot in the existing card engine', async () => {
    readDefinitionApproval.mockResolvedValue({
      enabled: true,
      actorId: 'author',
      capabilities: { edit: true, review: true },
    });
    readInitiativeCards
      .mockResolvedValueOnce({ initiativeVersion: 7, cards: [] })
      .mockResolvedValue({
        initiativeVersion: 8,
        cards: [{ cardKey: 'kpi', cardVersion: 1, reviewState: 'REQUESTED', publishedBy: 'author' }],
      });

    render(<InitiativeKpiApprovalCard initiativeId="initiative-1" kpis={kpis} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Submit KPI set for approval' }));

    await waitFor(() => expect(publishInitiativeCard).toHaveBeenCalledTimes(1));
    expect(publishInitiativeCard).toHaveBeenCalledWith(
      'initiative-1',
      'kpi',
      expect.objectContaining({
        expectedVersion: 7,
        expectedCardVersion: 0,
        reviewState: 'REQUESTED',
        content: expect.objectContaining({ kpiRefs: ['kpi-cycle-time'] }),
        evidenceRefs: ['initiative-kpi:kpi-cycle-time'],
      })
    );
  });
});
