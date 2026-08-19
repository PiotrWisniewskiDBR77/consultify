import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentMaterializationPanel } from '@/components/AIChat/AgentMaterializationPanel';
import * as api from '@/services/api/agentMaterialization.api';

vi.mock('@/services/api/agentMaterialization.api');
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) => selector({ currentUser: { id: 'reviewer' } }),
}));

const pending = {
  proposal_id: 'proposal-1', requester_id: 'requester', source_plan_id: 'plan-1', source_version: 1,
  source_hash: 'a'.repeat(64), target_kind: 'task' as const, content: { title: 'Canonical task' },
  state: 'PENDING' as const, state_version: 1, expires_at: new Date(Date.now() + 60_000).toISOString(),
};

describe('AgentMaterializationPanel', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates a proposal with one stable command identity and waits for independent approval', async () => {
    vi.mocked(api.listAgentMaterializationProposals).mockResolvedValue({ proposals: [], canReview: false });
    vi.mocked(api.getAgentMaterializationSource).mockResolvedValue({ sourceVersion: 7, sourceHash: 'b'.repeat(64) });
    vi.mocked(api.createAgentMaterializationProposal).mockResolvedValue({ proposal: pending, replayed: false });
    render(<AgentMaterializationPanel planId="plan-1" isPolish={false} />);
    await screen.findByText('No proposals');
    fireEvent.change(screen.getByLabelText('Proposal title'), { target: { value: 'Canonical task' } });
    fireEvent.click(screen.getByText('Send for independent approval'));
    await waitFor(() => expect(api.createAgentMaterializationProposal).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.createAgentMaterializationProposal).mock.calls[0][0].idempotencyKey).toMatch(/^myw-ui:plan-1:/);
    expect(await screen.findByText('Proposal awaits another person’s decision.')).toBeInTheDocument();
  });

  it('announces success only after receipt and target canonical readback', async () => {
    vi.mocked(api.listAgentMaterializationProposals)
      .mockResolvedValueOnce({ proposals: [pending], canReview: true })
      .mockResolvedValueOnce({ proposals: [{ ...pending, state: 'MATERIALIZED', state_version: 3, receipt_status: 'SUCCEEDED', target_id: 'task-1', output_digest: 'c'.repeat(64) }], canReview: true });
    vi.mocked(api.decideAgentMaterializationProposal).mockResolvedValue({ proposal: { ...pending, state: 'APPROVED', state_version: 2 } });
    vi.mocked(api.materializeAgentMaterializationProposal).mockResolvedValue({ receipt: { status: 'SUCCEEDED', target_id: 'task-1', output_digest: 'c'.repeat(64) }, replayed: false });
    render(<AgentMaterializationPanel isPolish={false} />);
    fireEvent.click(await screen.findByText('Approve and create'));
    expect(await screen.findByText('Canonical record created: task-1')).toBeInTheDocument();
    expect(api.materializeAgentMaterializationProposal).toHaveBeenCalledTimes(1);
  });
});
