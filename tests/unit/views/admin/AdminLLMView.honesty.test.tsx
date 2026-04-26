import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import AdminLLMView from '@/views/admin/AdminLLMView';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    getLLMProviders: vi.fn(),
    aiGetSystemPrompts: vi.fn(),
    getLLMAnalytics: vi.fn(),
    getLLMLogs: vi.fn(),
    testLLMConnection: vi.fn(),
    updateLLMProvider: vi.fn(),
    addLLMProvider: vi.fn(),
    aiUpdateSystemPrompt: vi.fn(),
    deleteLLMProvider: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('AdminLLMView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getLLMProviders).mockResolvedValue([]);
    vi.mocked(Api.aiGetSystemPrompts).mockResolvedValue([]);
    vi.mocked(Api.get).mockRejectedValue(new Error('Status down'));
    vi.mocked(Api.getLLMAnalytics).mockRejectedValue(new Error('Analytics down'));
    vi.mocked(Api.getLLMLogs).mockResolvedValue({ logs: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render failed LLM health and analytics loads as zero metrics or empty logs', async () => {
    render(<AdminLLMView />);

    await waitFor(() => {
      expect(screen.getByText('LLM provider configuration is read-only')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Health Dashboard/i }));

    await waitFor(() => {
      expect(screen.getByText('LLM health status unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('LLM analytics unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No logs found in the last 7 days.')).not.toBeInTheDocument();
    expect(screen.queryByText('NaN%')).not.toBeInTheDocument();
    expect(screen.queryByText('Healthy')).not.toBeInTheDocument();
  });
});
