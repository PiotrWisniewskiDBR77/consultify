import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExecutionDeliveryClosurePanel } from '../../../src/components/Execution/ExecutionDeliveryClosurePanel';

const api = vi.hoisted(() => ({
  read: vi.fn(), link: vi.fn(), recordSpine: vi.fn(), submitEvidence: vi.fn(), approveEvidence: vi.fn(), close: vi.fn(),
}));
vi.mock('../../../src/services/api/v8/executionBvp', () => ({ ExecutionBvpApi: api }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_k: string, fallback: string) => fallback }) }));

const active = {
  link: { link_id: 'link-1', initiative_id: 'init-1', case_id: 'case-1', work_ref: 'work', resource_ref: 'resources', control_ref: 'control', report_ref: 'report', status: 'ACTIVE', version: 2 },
  evidence: [{ evidence_id: 'evidence-1', execution_link_id: 'link-1', artifact_link_id: 'artifact-1', content_digest: 'sha256:a', approval_status: 'SUBMITTED', submitted_by: 'member-1', approved_by: null, version: 1 }],
  resultsReceipt: null,
};

describe('ExecutionDeliveryClosurePanel', () => {
  beforeEach(() => { vi.clearAllMocks(); api.read.mockResolvedValue(active); });

  it('cold-loads a link and exposes independent approval without false success', async () => {
    api.approveEvidence.mockRejectedValueOnce(new Error('execution_evidence_stale_forbidden_or_not_found'));
    render(<ExecutionDeliveryClosurePanel initialLinkId="link-1" />);
    expect(await screen.findByText('SUBMITTED')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve as independent reviewer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('execution_evidence_stale_forbidden_or_not_found');
    expect(screen.queryByText('Results receipt persisted')).not.toBeInTheDocument();
  });

  it('settles a double close into one request and shows the cold receipt', async () => {
    const approved = { ...active, evidence: [{ ...active.evidence[0], approval_status: 'APPROVED', approved_by: 'admin-2', version: 2 }] };
    const closed = { ...approved, link: { ...approved.link, status: 'CLOSED', version: 3 }, resultsReceipt: { signalId: 'signal-1', deliveryStatus: 'DELIVERED', attemptCount: 1, payload: {}, receiptId: 'receipt-1', observationPayload: {} } };
    api.read.mockResolvedValueOnce(approved).mockResolvedValueOnce(closed);
    api.close.mockResolvedValue({ link: closed.link, signalId: 'signal-1', replay: false });
    render(<ExecutionDeliveryClosurePanel initialLinkId="link-1" />);
    const button = await screen.findByRole('button', { name: 'Close execution and emit Results signal' });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(api.close).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Results receipt persisted')).toBeInTheDocument();
    expect(screen.getByText('receipt-1')).toBeInTheDocument();
  });

  it('announces a cold-read failure and retries deterministically', async () => {
    api.read.mockRejectedValueOnce(new Error('execution_link_not_found')).mockResolvedValueOnce(active);
    render(<ExecutionDeliveryClosurePanel initialLinkId="link-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('execution_link_not_found');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('SUBMITTED')).toBeInTheDocument();
    expect(api.read).toHaveBeenCalledTimes(2);
  });
});
