import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AcceptanceRequesterPanel } from '../../../src/components/Execution/AcceptanceRequesterPanel';
import {
  requestDeliveryAcceptance,
  requestResultsAcceptance,
} from '../../../src/services/initiatives-execution/runtimeApi';

vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class extends Error {
    status = 409;
  },
  requestDeliveryAcceptance: vi.fn(),
  requestResultsAcceptance: vi.fn(),
}));

const delivery = {
  initiativeId: 'init-1',
  executionCaseId: 'case-1',
  initiativeVersion: 8,
  executionCaseVersion: 4,
  authorityId: 'delivery-authority',
  ownerId: 'owner-1',
  baselineRef: { ref: 'baseline-1', version: 2 },
  scopeRef: { ref: 'scope-1', version: 1 },
  deliverableRefs: [{ ref: 'deliverable-1', version: 1 }],
  milestoneRefs: [{ ref: 'milestone-1', version: 1 }],
  openTaskRefs: [],
  openDecisionRefs: [],
  riskResiduals: [],
  financeActualRefs: [{ ref: 'finance-1', version: 3 }],
  operationalHandoverRef: { ref: 'ops-1', version: 1 },
  benefitOwnerId: 'benefit-owner',
  kpiMeasurementContractRefs: [{ ref: 'kpi-1', version: 2 }],
};

beforeEach(() => vi.resetAllMocks());

describe('AcceptanceRequesterPanel', () => {
  it('requests Delivery Acceptance only with exact evidence versions', async () => {
    render(
      <AcceptanceRequesterPanel
        executionCaseId="case-1"
        executionCaseVersion={4}
        initiativeId="init-1"
      />
    );
    fireEvent.change(screen.getByLabelText(/Canonical decision ID/), {
      target: { value: 'delivery-1' },
    });
    fireEvent.change(screen.getByLabelText(/Exact request contract/), {
      target: { value: JSON.stringify(delivery) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request Delivery Acceptance' }));
    await waitFor(() =>
      expect(requestDeliveryAcceptance).toHaveBeenCalledWith(
        'delivery-1',
        expect.objectContaining({
          executionCaseVersion: 4,
          baselineRef: delivery.baselineRef,
          clientRequestId: expect.any(String),
        })
      )
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'DELIVERY_ACCEPTANCE_REQUESTED · delivery-1'
    );
  });

  it('fails closed for missing evidence and requests Results only from exact pack', async () => {
    render(
      <AcceptanceRequesterPanel
        executionCaseId="case-1"
        executionCaseVersion={4}
        initiativeId="init-1"
      />
    );
    fireEvent.change(screen.getByLabelText(/Canonical decision ID/), {
      target: { value: 'delivery-bad' },
    });
    fireEvent.change(screen.getByLabelText(/Exact request contract/), {
      target: { value: JSON.stringify({ ...delivery, financeActualRefs: [] }) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request Delivery Acceptance' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('EVIDENCE_MISSING');
    expect(requestDeliveryAcceptance).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Results request' }));
    fireEvent.change(screen.getByLabelText(/Canonical Results Case ID/), {
      target: { value: 'results-1' },
    });
    fireEvent.change(screen.getByLabelText(/Exact request contract/), {
      target: {
        value: JSON.stringify({
          initiativeId: 'init-1',
          packId: 'pack-1',
          packVersion: 1,
          authorityId: 'results-authority',
          ownerId: 'benefit-owner',
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request Results Acceptance' }));
    await waitFor(() =>
      expect(requestResultsAcceptance).toHaveBeenCalledWith(
        'results-1',
        expect.objectContaining({ packId: 'pack-1', packVersion: 1 })
      )
    );
  });
});
