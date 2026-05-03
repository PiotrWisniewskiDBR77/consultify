/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    post: (...args: any[]) => apiPostMock(...args),
  },
}));

import { ArtifactActionPanel } from '@/components/shared/artifact-actions/ArtifactActionPanel';

const source = {
  type: 'interview_insight' as const,
  id: 'insight-1',
  title: 'Onboarding friction',
  status: 'completed',
  content: 'Employees struggle with onboarding handoffs.',
  confidence: 'high',
  limits: 'Only three source sessions.',
  evidenceCount: 2,
  sourceSessionCount: 3,
  sourcePack: {
    entries: [
      {
        answerId: 'answer-1',
        capturedPointers: [{ pointerId: 'ptr-1' }],
      },
    ],
  },
};

describe('ArtifactActionPanel governance confirmation', () => {
  beforeEach(() => {
    apiPostMock.mockReset();
    navigateMock.mockReset();
    apiPostMock.mockImplementation(async (path: string) => {
      if (path === '/artifact-conversions/record') return { id: 'conversion-1' };
      return { id: 'idea-1' };
    });
  });

  it('requires proposal confirmation before creating app action artifacts with lineage', async () => {
    render(<ArtifactActionPanel source={source} isPolish={false} />);

    const ideaCard = screen.getByText('Create idea').closest('div.rounded-2xl');
    const createButton = ideaCard?.querySelector('button');
    expect(createButton).toBeTruthy();

    fireEvent.click(createButton!);

    expect(screen.getByText('Action confirmation')).toBeInTheDocument();
    expect(screen.getByText(/I confirm creating "Create idea"/)).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();

    const confirmButton = screen.getByRole('button', { name: 'Confirm and create' });
    expect(confirmButton).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/my-work/my-ideas',
        expect.objectContaining({
          sourceType: 'interview_insight',
          sourcePack: source.sourcePack,
          evidenceRefs: ['answer-1', 'ptr-1'],
          actionContract: expect.objectContaining({
            contract: 'interview_insight_downstream_action_v1',
            target: 'idea',
            governance: expect.objectContaining({
              proposalRequired: true,
              confirmationRequired: true,
              proposal: expect.objectContaining({ target: 'idea' }),
            }),
          }),
        })
      );
    });

    expect(apiPostMock).toHaveBeenCalledWith(
      '/artifact-conversions/record',
      expect.objectContaining({
        evidenceRefs: ['answer-1', 'ptr-1'],
        sourcePack: source.sourcePack,
        payload: expect.objectContaining({
          actionContract: expect.objectContaining({ target: 'idea' }),
        }),
      })
    );
  });
});
