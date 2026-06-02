import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { AIIntelligenceView } from '@/views/superadmin/AIIntelligenceView';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getPromptAssistantStats: vi.fn(),
    getPromptAssistantTemplates: vi.fn(),
  },
}));

describe('AIIntelligenceView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getPromptAssistantStats).mockResolvedValue({
      totalPrompts: 4,
      activeBlocks: 12,
      feedbackItems: 3,
      avgRating: 4.5,
      languagesCovered: 6,
    });
    vi.mocked(Api.getPromptAssistantTemplates).mockResolvedValue({
      templates: [
        {
          code: 'consultant.analysis',
          name: 'Consultant Analysis',
          category: 'analysis',
          description: 'Structured strategic analysis prompt',
        },
      ],
    });
  });

  it('does not render failed intelligence stats as zero KPI cards', async () => {
    vi.mocked(Api.getPromptAssistantStats).mockRejectedValue(new Error('Stats API down'));

    render(<AIIntelligenceView />);

    await waitFor(() => {
      expect(screen.getByText('AI intelligence stats unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Stats API down')).toBeInTheDocument();
    expect(screen.queryByText('Feedback Items')).not.toBeInTheDocument();
    expect(screen.queryByText('Avg Rating')).not.toBeInTheDocument();
  });

  it('does not render template load failures as an empty prompt list', async () => {
    vi.mocked(Api.getPromptAssistantTemplates).mockRejectedValue(new Error('Templates API down'));

    render(<AIIntelligenceView />);

    fireEvent.click(screen.getByRole('button', { name: /Prompt Templates/i }));

    await waitFor(() => {
      expect(screen.getByText('Prompt templates unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Templates API down')).toBeInTheDocument();
    expect(screen.queryByText('No templates found')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Template/i })).toBeDisabled();
    expect(screen.getByPlaceholderText('Search templates...')).toBeDisabled();
  });

  it('marks prompt template create, edit, and test as read-only in builder view', async () => {
    render(<AIIntelligenceView />);

    fireEvent.click(screen.getByRole('button', { name: /Prompt Templates/i }));

    await waitFor(() => {
      expect(screen.getByText('Consultant Analysis')).toBeInTheDocument();
    });

    expect(screen.getByText('Prompt template mutations use Prompts Library')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Template/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Edit$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Test$/i })).toBeDisabled();
  });
});
