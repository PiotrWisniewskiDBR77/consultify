import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryResultsAcceptanceQueue } from '../../../src/components/MyWork/DeliveryResultsAcceptanceQueue';
import {
  decideDeliveryAcceptance,
  decideResultsAcceptance,
  getBenefitsHandoffPack,
  listMyAcceptanceWork,
} from '../../../src/services/initiatives-execution/runtimeApi';

vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class extends Error {
    status = 409;
  },
  decideDeliveryAcceptance: vi.fn(),
  decideResultsAcceptance: vi.fn(),
  getBenefitsHandoffPack: vi.fn(),
  listMyAcceptanceWork: vi.fn(),
}));
const delivery = {
  version: 2,
  decisionId: 'delivery-1',
  initiativeId: 'init-1',
  executionCaseId: 'case-1',
  initiativeVersion: 8,
  executionCaseVersion: 4,
  status: 'PENDING',
  baselineRef: { ref: 'base-1', version: 3 },
  scopeRef: { ref: 'scope-1', version: 2 },
  deliverableRefs: [{ ref: 'deliverable-1', version: 5 }],
  milestoneRefs: [{ ref: 'milestone-1', version: 2 }],
  openTaskRefs: [],
  openDecisionRefs: [],
  riskResiduals: [],
  financeActualRefs: [{ ref: 'finance-1', version: 4 }],
  operationalHandoverRef: { ref: 'ops-1', version: 2 },
  benefitOwnerId: 'benefit-owner',
  kpiMeasurementContractRefs: [{ ref: 'kpi-1', version: 1 }],
};
const results = {
  version: 1,
  resultsCaseId: 'results-1',
  packId: 'pack-1',
  packVersion: 1,
  initiativeId: 'init-2',
  status: 'PENDING',
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listMyAcceptanceWork).mockResolvedValue({ delivery: [delivery], results: [results] });
  vi.mocked(decideDeliveryAcceptance).mockResolvedValue({});
  vi.mocked(decideResultsAcceptance).mockResolvedValue({});
  vi.mocked(getBenefitsHandoffPack).mockResolvedValue({
    packId: 'benefits-delivery-1',
    version: 1,
    initiativeId: 'init-1',
  });
});
describe('DeliveryResultsAcceptanceQueue', () => {
  it('decides exact Delivery Acceptance and reads immutable handoff pack', async () => {
    render(<DeliveryResultsAcceptanceQueue />);
    const row = (await screen.findByText('Delivery Acceptance')).closest('tr')!;
    fireEvent.click(row);
    fireEvent.keyDown(row.closest('div[tabindex="0"]')!, { key: 'Enter' });
    expect(screen.getByText(/Baseline base-1 v3/)).toBeInTheDocument();
    expect(screen.getByText(/KPI contracts: kpi-1 v1/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Acceptance rationale'), {
      target: { value: 'Evidence accepted' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accept delivery' }));
    await waitFor(() =>
      expect(decideDeliveryAcceptance).toHaveBeenCalledWith(
        'delivery-1',
        expect.objectContaining({
          expectedVersion: 2,
          outcome: 'ACCEPT',
          packId: 'benefits-delivery-1',
        })
      )
    );
    expect(
      await screen.findByText(/Immutable Benefits Handoff Pack benefits-delivery-1 v1/)
    ).toBeInTheDocument();
  });
  it('keeps rejected Results at DELIVERED and uses stable Results Case ID', async () => {
    render(<DeliveryResultsAcceptanceQueue />);
    fireEvent.click((await screen.findByText('Results Acceptance')).closest('tr')!);
    fireEvent.change(screen.getByLabelText('Acceptance rationale'), {
      target: { value: 'Blocked outcome' },
    });
    fireEvent.change(screen.getByLabelText('Results description'), {
      target: { value: 'Missing evidence' },
    });
    fireEvent.change(screen.getByLabelText('Results ownerId'), { target: { value: 'owner-1' } });
    fireEvent.change(screen.getByLabelText('Results dueAt'), {
      target: { value: '2026-09-01T10:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reject with blockers' }));
    await waitFor(() =>
      expect(decideResultsAcceptance).toHaveBeenCalledWith(
        'results-1',
        expect.objectContaining({
          expectedVersion: 1,
          outcome: 'REJECT_WITH_BLOCKERS',
          blockers: [expect.objectContaining({ ownerId: 'owner-1' })],
        })
      )
    );
    expect(await screen.findByText(/RESULTS receipt · DELIVERED/)).toBeInTheDocument();
    expect(screen.getByText(/Results Case results-1/)).toBeInTheDocument();
  });
});
