import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PromptManagementUI } from '@/views/superadmin/components/PromptManagementUI';
import api from '@/services/api';

vi.mock('@/views/superadmin/components/PromptAssistantPanel', () => ({
  PromptAssistantPanel: () => <div data-testid="prompt-assistant-panel" />,
}));

vi.mock('@/views/superadmin/components/PromptBlockBuilder', () => ({
  PromptBlockBuilder: () => <div data-testid="prompt-block-builder" />,
}));

vi.mock('@/views/superadmin/components/PromptTestBench', () => ({
  PromptTestBench: () => <div data-testid="prompt-test-bench" />,
}));

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const prompt = {
  id: 'prompt-1',
  name: 'Chat Trust Prompt',
  category: 'chat',
  description: 'Grounded assistant prompt',
  system_prompt: 'Be accurate.',
  user_prompt_template: 'Answer {{question}}',
  variables: ['question'],
  version: 2,
  is_active: true,
  created_at: '2026-04-26T10:00:00.000Z',
  updated_at: '2026-04-26T10:00:00.000Z',
  created_by: 'admin',
};

describe('PromptManagementUI honest workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.endsWith('/versions')) {
        return Promise.resolve({ data: { success: true, versions: [] } });
      }

      return Promise.resolve({ data: { success: true, prompts: [prompt] } });
    });
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, result: 'ok' } });
  });

  it('does not render prompt load failures as an empty prompt list', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Prompt API down'));

    render(<PromptManagementUI />);

    await waitFor(() => {
      expect(screen.getByText('Prompts unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Prompt API down')).toBeInTheDocument();
    expect(screen.queryByText('No prompts found')).not.toBeInTheDocument();
  });

  it('accepts deep wrapped prompt list payloads', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.endsWith('/versions')) {
        return Promise.resolve({ data: { data: { versions: [] } } });
      }

      return Promise.resolve({ data: { data: { prompts: [prompt] } } });
    });

    render(<PromptManagementUI />);

    await waitFor(() => {
      expect(screen.getByText('Chat Trust Prompt')).toBeInTheDocument();
    });
    expect(screen.queryByText('Prompts unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed prompt payloads as an empty prompt list', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { unexpected: true } } });

    render(<PromptManagementUI />);

    await waitFor(() => {
      expect(screen.getByText('Prompts unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Prompts response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No prompts found')).not.toBeInTheDocument();
  });

  it('keeps save honest when read-back returns stale prompt data', async () => {
    render(<PromptManagementUI />);

    await waitFor(() => {
      expect(screen.getByText('Chat Trust Prompt')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Chat Trust Prompt'));
    await waitFor(() => {
      expect(screen.getByText('System Prompt')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit'));
    fireEvent.change(screen.getByDisplayValue('Chat Trust Prompt'), {
      target: { value: 'Updated Prompt' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Prompt save refresh returned stale prompt data'
      );
    });
  });

  it('surfaces unavailable create workflow instead of opening a no-op form', async () => {
    render(<PromptManagementUI />);

    await waitFor(() => {
      expect(screen.getByText('Chat Trust Prompt')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('New Prompt'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Creating prompts is not connected to a confirmed backend workflow yet.'
    );
    expect(screen.queryByText('New Prompt')).not.toBeInTheDocument();
  });
});
