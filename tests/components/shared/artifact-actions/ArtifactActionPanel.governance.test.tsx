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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string; targetLabel?: string }) => {
      const labels: Record<string, string> = {
        'sharedComponents.artifactActionPanel.targetMeta.idea.label': 'Create idea',
        'sharedComponents.artifactActionPanel.targetMeta.report.label': 'Create report',
        'sharedComponents.artifactActionPanel.actionConfirmation': 'Action confirmation',
        'sharedComponents.artifactActionPanel.confirmAndCreate': 'Confirm and create',
        'sharedComponents.artifactActionPanel.documentGenerator': 'Document generator',
        'sharedComponents.artifactActionPanel.downstreamLimits': 'Downstream limits',
        'sharedComponents.artifactActionPanel.runGenerator': 'Run generator',
      };
      if (
        key === 'sharedComponents.artifactActionPanel.readBackText' &&
        typeof fallback === 'object'
      ) {
        return `I confirm creating "${fallback.targetLabel}" from this insight.`;
      }
      return labels[key] || (typeof fallback === 'string' ? fallback : fallback?.defaultValue) || key;
    },
    i18n: { language: 'en' },
  }),
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
  reportPack: {
    id: 'irp-insight-1',
    status: 'draft',
    readinessStatus: 'ready_with_warnings',
    completenessScore: 82,
    degraded: true,
    degradedReasons: ['Material quality requires review.'],
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
        reportPack: source.reportPack,
        payload: expect.objectContaining({
          actionContract: expect.objectContaining({
            target: 'idea',
            lineage: expect.objectContaining({ reportPack: source.reportPack }),
          }),
        }),
      })
    );
  });

  it('requires explicit confirmation before document generators create artifacts', async () => {
    render(<ArtifactActionPanel source={source} isPolish={false} />);

    const reportCard = screen.getByText('Create report').closest('div.rounded-2xl');
    const openGeneratorButton = reportCard?.querySelector('button');
    expect(openGeneratorButton).toBeTruthy();

    fireEvent.click(openGeneratorButton!);

    expect(screen.getByText('Document generator')).toBeInTheDocument();
    expect(screen.getByText('Downstream limits')).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();

    const runButton = screen.getByRole('button', { name: 'Run generator' });
    expect(runButton).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/report-builder',
        expect.objectContaining({
          config: expect.objectContaining({
            reportPack: source.reportPack,
            actionContract: expect.objectContaining({
              target: 'report',
              governance: expect.objectContaining({
                proposalRequired: true,
                confirmationRequired: true,
              }),
              lineage: expect.objectContaining({ reportPack: source.reportPack }),
            }),
          }),
        })
      );
    });
  });
});
