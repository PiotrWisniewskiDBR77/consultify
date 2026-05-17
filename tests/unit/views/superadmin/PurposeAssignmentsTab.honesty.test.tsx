import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PurposeAssignmentsTab } from '@/views/superadmin/AIPlatformModule/Configuration/PurposeAssignmentsTab';
import { Api } from '@/services/api';
import { toast } from 'react-hot-toast';

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getLLMPurposes: vi.fn(),
    getLLMProviders: vi.fn(),
    getLLMPurposeAssignments: vi.fn(),
    upsertLLMPurpose: vi.fn(),
    addLLMPurposeAssignment: vi.fn(),
    deleteLLMPurposeAssignment: vi.fn(),
  },
}));

const purpose = {
  purpose: 'chat_simple',
  kind: 'TEXT_LLM',
  default_tier: 'STANDARD',
  description: 'Simple chat',
  is_active: true,
};

const provider = {
  id: 'provider-1',
  name: 'OpenRouter GPT-4o',
  provider: 'openrouter',
  model_id: 'openai/gpt-4o',
  kind: 'TEXT_LLM',
  is_active: true,
};

const assignment = {
  id: 'assignment-1',
  purpose: 'chat_simple',
  provider_id: 'provider-1',
  provider_name: 'OpenRouter GPT-4o',
  provider: 'openrouter',
  provider_model_id: 'openai/gpt-4o',
  priority: 0,
  is_active: true,
};

describe('PurposeAssignmentsTab honest workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getLLMPurposes).mockResolvedValue({ purposes: [purpose] });
    vi.mocked(Api.getLLMProviders).mockResolvedValue([provider]);
    vi.mocked(Api.getLLMPurposeAssignments).mockResolvedValue({ assignments: [assignment] });
    vi.mocked(Api.upsertLLMPurpose).mockResolvedValue({ purpose });
    vi.mocked(Api.addLLMPurposeAssignment).mockResolvedValue({ assignment });
    vi.mocked(Api.deleteLLMPurposeAssignment).mockResolvedValue({ success: true });
  });

  it('does not render purpose/provider load failures as empty assignments', async () => {
    vi.mocked(Api.getLLMPurposes).mockRejectedValue(new Error('Purpose catalog down'));

    render(<PurposeAssignmentsTab />);

    await waitFor(() => {
      expect(screen.getByText('Purpose assignments unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Purpose catalog down')).toBeInTheDocument();
    expect(screen.queryByText('No assignments. Add one above.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add$/i })).not.toBeInTheDocument();
  });

  it('does not render assignment load failures as a clean empty assignment list', async () => {
    vi.mocked(Api.getLLMPurposeAssignments).mockRejectedValue(new Error('Assignments down'));

    render(<PurposeAssignmentsTab />);

    await waitFor(() => {
      expect(screen.getByText('Purpose assignment list unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Assignments down')).toBeInTheDocument();
    expect(screen.queryByText('No assignments. Add one above.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Add$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /TEXT chain/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /IMAGE chain/i })).toBeDisabled();
  });

  it('refetches purposes and assignments after save, add, preset, and remove workflows', async () => {
    render(<PurposeAssignmentsTab />);

    await waitFor(() => {
      expect(screen.getByText('OpenRouter GPT-4o')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('purpose (e.g. report_section)'), {
      target: { value: 'report_section' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(Api.upsertLLMPurpose).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: 'report_section', kind: 'TEXT_LLM' })
      );
    });
    expect(vi.mocked(Api.getLLMPurposes).mock.calls.length).toBeGreaterThanOrEqual(2);

    fireEvent.change(screen.getAllByRole('combobox')[2], {
      target: { value: 'provider-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Add$/i }));

    await waitFor(() => {
      expect(Api.addLLMPurposeAssignment).toHaveBeenCalledWith(
        'chat_simple',
        expect.objectContaining({ providerId: 'provider-1' })
      );
    });
    expect(vi.mocked(Api.getLLMPurposeAssignments).mock.calls.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: /TEXT chain/i }));
    await waitFor(() => {
      expect(Api.addLLMPurposeAssignment).toHaveBeenCalledWith(
        'chat_simple',
        expect.objectContaining({ providerId: 'provider-1', priority: 70 })
      );
    });
    expect(vi.mocked(Api.getLLMPurposeAssignments).mock.calls.length).toBeGreaterThanOrEqual(3);

    fireEvent.click(screen.getByTitle('Remove'));
    await waitFor(() => {
      expect(Api.deleteLLMPurposeAssignment).toHaveBeenCalledWith(
        'chat_simple',
        expect.objectContaining({ providerId: 'provider-1' })
      );
    });
    expect(vi.mocked(Api.getLLMPurposeAssignments).mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('accepts deep wrapped purposes, providers, and assignments payloads', async () => {
    vi.mocked(Api.getLLMPurposes).mockResolvedValue({
      data: { data: { purposes: [purpose] } },
    });
    vi.mocked(Api.getLLMProviders).mockResolvedValue({
      data: { data: { providers: [provider] } },
    });
    vi.mocked(Api.getLLMPurposeAssignments).mockResolvedValue({
      data: { data: { assignments: [assignment] } },
    });

    render(<PurposeAssignmentsTab />);

    expect(await screen.findByText('OpenRouter GPT-4o')).toBeInTheDocument();
    expect(screen.queryByText('Purpose assignments unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText('Purpose assignment list unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed purpose payloads as empty assignment UI', async () => {
    vi.mocked(Api.getLLMPurposes).mockResolvedValue({
      data: { data: { unexpected: true } },
    });

    render(<PurposeAssignmentsTab />);

    await waitFor(() => {
      expect(screen.getByText('Purpose assignments unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('LLM purposes response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No assignments. Add one above.')).not.toBeInTheDocument();
  });

  it('does not render malformed assignments payloads as an empty assignment list', async () => {
    vi.mocked(Api.getLLMPurposeAssignments).mockResolvedValue({
      data: { data: { unexpected: true } },
    });

    render(<PurposeAssignmentsTab />);

    await waitFor(() => {
      expect(screen.getByText('Purpose assignment list unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('LLM purpose assignments response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No assignments. Add one above.')).not.toBeInTheDocument();
  });

  it('does not claim assignment removal success when read-back remains stale', async () => {
    render(<PurposeAssignmentsTab />);

    await waitFor(() => {
      expect(screen.getByText('OpenRouter GPT-4o')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('Remove'));

    await waitFor(() => {
      expect(screen.getByText('Assignment removal was not confirmed by the server')).toBeInTheDocument();
    });
    expect(toast.success).not.toHaveBeenCalledWith('Assignment removed');
  });
});
