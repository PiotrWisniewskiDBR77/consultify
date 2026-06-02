import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LLMManagementView } from '@/views/superadmin/LLMManagementView';
import { Api } from '@/services/api';

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
    getLLMProviders: vi.fn(),
    getLLMControlUsage: vi.fn(),
    getLLMCosts: vi.fn(),
    diagnoseLLM: vi.fn(),
    addLLMProvider: vi.fn(),
    cloneLLMProviderModel: vi.fn(),
    updateLLMProvider: vi.fn(),
    updateProviderTier: vi.fn(),
    deleteLLMProvider: vi.fn(),
    testLLMConnection: vi.fn(),
  },
}));

const provider = {
  id: 'provider-1',
  name: 'OpenRouter GPT-4o',
  provider: 'openrouter',
  model_id: 'openai/gpt-4o',
  tier: 'STANDARD',
  visibility: 'admin',
  is_active: true,
  is_configured: true,
};

describe('LLMManagementView honest provider workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getLLMProviders).mockResolvedValue([provider]);
    vi.mocked(Api.getLLMControlUsage).mockResolvedValue({});
    vi.mocked(Api.getLLMCosts).mockResolvedValue({});
    vi.mocked(Api.diagnoseLLM).mockResolvedValue({ status: 'OK', checks: [] });
    vi.mocked(Api.addLLMProvider).mockResolvedValue(undefined);
    vi.mocked(Api.cloneLLMProviderModel).mockResolvedValue({ id: 'provider-2' });
    vi.mocked(Api.updateProviderTier).mockResolvedValue({});
    vi.mocked(Api.deleteLLMProvider).mockResolvedValue(undefined);
  });

  it('does not render provider load failures as an empty provider list with active actions', async () => {
    vi.mocked(Api.getLLMProviders).mockRejectedValue(new Error('Provider registry down'));

    render(<LLMManagementView />);

    await waitFor(() => {
      expect(screen.getByText('LLM providers unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Provider registry down')).toBeInTheDocument();
    expect(screen.queryByText('No providers configured')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Provider/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Test All/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Apply v3 recommended preset/i })).toBeDisabled();
  });

  it('refetches providers after create, clone, tier update, and delete workflows', async () => {
    const createdProvider = {
      ...provider,
      id: 'provider-2',
      name: 'Created Provider',
      model_id: 'openai/gpt-4o-mini',
    };
    const clonedProvider = {
      ...provider,
      id: 'provider-3',
      name: 'OpenRouter GPT-4o — new model',
      model_id: 'anthropic/claude-sonnet-4-6',
    };
    let currentProviders = [provider];
    vi.mocked(Api.getLLMProviders).mockImplementation(async () => currentProviders);
    vi.mocked(Api.addLLMProvider).mockImplementation(async () => {
      currentProviders = [provider, createdProvider];
      return { id: 'provider-2' } as never;
    });
    vi.mocked(Api.cloneLLMProviderModel).mockImplementation(async () => {
      currentProviders = [provider, createdProvider, clonedProvider];
      return { id: 'provider-3' };
    });
    vi.mocked(Api.updateProviderTier).mockImplementation(async () => {
      currentProviders = currentProviders.map((item) =>
        item.id === 'provider-1' ? { ...item, tier: 'PREMIUM' } : item
      );
      return {};
    });
    vi.mocked(Api.deleteLLMProvider).mockImplementation(async () => {
      currentProviders = currentProviders.filter((item) => item.id !== 'provider-1');
      return undefined;
    });

    const { container } = render(<LLMManagementView />);

    await waitFor(() => {
      expect(screen.getByText('OpenRouter GPT-4o')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Provider/i }));
    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'Created Provider' },
    });
    fireEvent.change(container.querySelector('input[type="password"]') as HTMLInputElement, {
      target: { value: 'sk-created' },
    });
    fireEvent.change(screen.getByPlaceholderText(/własne ID modelu/i), {
      target: { value: 'openai/gpt-4o-mini' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Provider/i }));

    await waitFor(() => {
      expect(Api.addLLMProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Created Provider',
          api_key: 'sk-created',
          model_id: 'openai/gpt-4o-mini',
        })
      );
    });

    expect(vi.mocked(Api.getLLMProviders).mock.calls.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getAllByLabelText('Clone Model')[0]);
    fireEvent.change(screen.getByPlaceholderText(/własne ID modelu/i), {
      target: { value: 'anthropic/claude-sonnet-4-6' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Provider/i }));

    await waitFor(() => {
      expect(Api.cloneLLMProviderModel).toHaveBeenCalledWith(
        'provider-1',
        expect.objectContaining({ model_id: 'anthropic/claude-sonnet-4-6' })
      );
    });

    const tierSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(tierSelect, { target: { value: 'PREMIUM' } });

    await waitFor(() => {
      expect(Api.updateProviderTier).toHaveBeenCalledWith('provider-1', 'PREMIUM');
    });

    vi.stubGlobal('confirm', vi.fn(() => true));
    fireEvent.click(screen.getAllByLabelText('Delete')[0]);

    await waitFor(() => {
      expect(Api.deleteLLMProvider).toHaveBeenCalledWith('provider-1');
    });

    expect(vi.mocked(Api.getLLMProviders).mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  it('keeps provider modal open when create read-back does not confirm the provider', async () => {
    vi.mocked(Api.getLLMProviders).mockResolvedValue([provider]);
    vi.mocked(Api.addLLMProvider).mockResolvedValue({ id: 'provider-2' } as never);

    const { container } = render(<LLMManagementView />);

    await screen.findByText('OpenRouter GPT-4o');
    fireEvent.click(screen.getByRole('button', { name: /Add Provider/i }));
    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'Created Provider' },
    });
    fireEvent.change(container.querySelector('input[type="password"]') as HTMLInputElement, {
      target: { value: 'sk-created' },
    });
    fireEvent.change(screen.getByPlaceholderText(/własne ID modelu/i), {
      target: { value: 'openai/gpt-4o-mini' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Provider/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'LLM provider operation was not confirmed by the server'
      );
    });
    expect(screen.getByRole('button', { name: /Save Provider/i })).toBeInTheDocument();
    expect(screen.queryByText('Provider added')).not.toBeInTheDocument();
  });

  it('accepts wrapped provider, usage, cost, and health payloads', async () => {
    vi.mocked(Api.getLLMProviders).mockResolvedValue({
      data: { data: { providers: [provider] } },
    } as never);
    vi.mocked(Api.getLLMControlUsage).mockResolvedValue({
      data: { data: { totalRequests: 10 } },
    } as never);
    vi.mocked(Api.getLLMCosts).mockResolvedValue({ data: { data: { totalCost: 12 } } } as never);
    vi.mocked(Api.diagnoseLLM).mockResolvedValue({
      data: { data: { status: 'OK', checks: [] } },
    } as never);

    render(<LLMManagementView />);

    expect(await screen.findByText('OpenRouter GPT-4o')).toBeInTheDocument();
    expect(screen.queryByText('LLM providers unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed provider payloads as an empty provider list', async () => {
    vi.mocked(Api.getLLMProviders).mockResolvedValue({ data: { data: { unexpected: true } } } as never);

    render(<LLMManagementView />);

    await waitFor(() => {
      expect(screen.getByText('LLM providers unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('LLM providers response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No providers configured')).not.toBeInTheDocument();
  });

  it('does not claim delete success when read-back still contains provider', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.mocked(Api.getLLMProviders).mockResolvedValue([provider]);

    render(<LLMManagementView />);

    await screen.findByText('OpenRouter GPT-4o');
    fireEvent.click(screen.getByLabelText('Delete'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'LLM provider deletion was not confirmed by the server'
      );
    });
    expect(screen.getByText('OpenRouter GPT-4o')).toBeInTheDocument();
  });
});
