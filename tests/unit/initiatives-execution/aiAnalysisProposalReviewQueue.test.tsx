import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIAnalysisProposalReviewQueue } from '../../../src/components/MyWork/AIAnalysisProposalReviewQueue';
import {
  listMyAIAnalysisReviews,
  reviewAIAnalysisProposal,
} from '../../../src/services/initiatives-execution/runtimeApi';
vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class extends Error {
    status = 409;
  },
  listMyAIAnalysisReviews: vi.fn(),
  reviewAIAnalysisProposal: vi.fn(),
}));
const p = {
  version: 2,
  proposalId: 'ai-1',
  initiativeId: 'init-1',
  initiativeVersion: 7,
  cardKey: 'financial-analysis',
  cardVersion: 3,
  sourceRef: { aggregateType: 'analysis_run', aggregateId: 'run-1', version: 4 },
  model: { provider: 'openai', model: 'gpt', version: '1' },
  prompt: { promptId: 'prompt-1', version: 2 },
  template: { templateId: 'template-1', version: 3 },
  inputHash: 'hash-1',
  output: { npv: 42 },
  evidenceRefs: [{ ref: 'e-1', version: 2 }],
  counterEvidenceRefs: [{ ref: 'ce-1', version: 1 }],
  confidence: 'HIGH',
  requestedBy: 'owner',
  authorizedReviewerId: 'reviewer',
  status: 'PENDING_REVIEW',
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listMyAIAnalysisReviews).mockResolvedValue({ items: [p] });
  vi.mocked(reviewAIAnalysisProposal).mockResolvedValue({});
});
describe('AIAnalysisProposalReviewQueue', () => {
  it('reviews full provenance and publishes exact human edit with stable card lineage', async () => {
    render(<AIAnalysisProposalReviewQueue />);
    fireEvent.click((await screen.findByText(/init-1:financial-analysis v3/)).closest('tr')!);
    expect(screen.getAllByText(/analysis_run:run-1 v4/)).toHaveLength(2);
    expect(screen.getByText(/Counter-evidence ce-1 v1/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('AI review rationale'), {
      target: { value: 'Human correction' },
    });
    fireEvent.change(screen.getByLabelText('AI edited fragment'), {
      target: { value: '{"npv":40}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish human edit' }));
    await waitFor(() =>
      expect(reviewAIAnalysisProposal).toHaveBeenCalledWith(
        'ai-1',
        expect.objectContaining({
          expectedVersion: 2,
          outcome: 'EDIT',
          editedFragment: { npv: 40 },
        })
      )
    );
    expect(await screen.findByText(/Card v4; v3 retained with AI lineage/)).toBeInTheDocument();
  });
});
