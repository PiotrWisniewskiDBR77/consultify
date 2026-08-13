import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaterialChangeQueue } from '../../../src/components/MyWork/MaterialChangeQueue';
import {
  listMyMaterialChangeWork,
  transitionMaterialChange,
} from '../../../src/services/initiatives-execution/runtimeApi';
vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class extends Error {
    status = 409;
  },
  listMyMaterialChangeWork: vi.fn(),
  transitionMaterialChange: vi.fn(),
}));
const impact = { knowledgeState: 'KNOWN', refs: [{ ref: 'init-1:summary-scope', version: 2 }] };
const proposal = {
  version: 3,
  proposalId: 'change-1',
  target: { kind: 'INITIATIVE_CARD', initiativeId: 'init-1', cardKey: 'summary-scope', version: 2 },
  oldSnapshot: { problem: 'old' },
  newSnapshot: { problem: 'new' },
  oldHash: 'old-hash',
  newHash: 'new-hash',
  diff: [{ path: 'problem', oldValue: 'old', newValue: 'new' }],
  classification: 'MATERIAL',
  tolerance: {
    policyRef: 'policy-1',
    policyVersion: 2,
    withinTolerance: false,
    rationale: 'material',
  },
  blastRadius: {
    tasks: impact,
    decisions: impact,
    milestones: impact,
    risks: impact,
    capacity: impact,
    approvals: impact,
    handoff: impact,
  },
  reversibility: 'REVERSIBLE',
  ownerId: 'owner',
  authorityId: 'authority',
  status: 'PENDING',
  conditions: [],
  publishedTargetVersion: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listMyMaterialChangeWork).mockResolvedValue({ items: [proposal] });
  vi.mocked(transitionMaterialChange).mockResolvedValue({});
});
describe('MaterialChangeQueue', () => {
  it('shows exact diff hashes and lets independent authority approve canonical proposal', async () => {
    render(<MaterialChangeQueue />);
    fireEvent.click((await screen.findByText(/INITIATIVE_CARD/)).closest('tr')!);
    expect(screen.getByText('old-hash')).toBeInTheDocument();
    expect(screen.getByText('new-hash')).toBeInTheDocument();
    expect(screen.getByText(/tasks: KNOWN/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Material change rationale'), {
      target: { value: 'Impact accepted' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect(transitionMaterialChange).toHaveBeenCalledWith(
        'change-1',
        expect.objectContaining({ expectedVersion: 3, action: 'DECIDE', outcome: 'APPROVE' })
      )
    );
  });
});
