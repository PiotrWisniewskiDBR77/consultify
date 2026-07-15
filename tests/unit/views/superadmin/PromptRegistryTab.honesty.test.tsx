import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { PromptRegistryTab } from '@/views/superadmin/AIPlatformModule/Development/PromptRegistryTab';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const promptOk = {
  id: 'persona-core',
  module: 'persona',
  version: '3.2.0',
  owner: 'content-quality',
  path: 'server/src/ai/persona.ts',
  exportName: 'PERSONA_CORE',
  description: "Teresa's core identity.",
  languages: ['pl', 'en'],
  lastReviewed: '2026-06-20',
  managed: true,
  checksumStatus: 'ok',
};

const promptDrifted = {
  id: 'persona-challenge-mode',
  module: 'persona',
  version: '1.4.0',
  owner: 'content-quality',
  path: 'server/src/ai/persona.ts',
  exportName: 'CHALLENGE_MODE_ADDENDUM',
  description: 'Adversarial pushback tone.',
  languages: ['pl', 'en'],
  lastReviewed: '2026-05-02',
  managed: true,
  checksumStatus: 'drifted',
};

const registryPayload = (prompts: unknown[]) => ({
  count: prompts.length,
  managedCount: prompts.filter((p) => (p as { managed?: boolean }).managed).length,
  drifted: prompts
    .filter((p) => (p as { checksumStatus?: string }).checksumStatus === 'drifted')
    .map((p) => (p as { id: string }).id),
  prompts,
});

describe('PromptRegistryTab honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders registry rows from GET /api/admin/prompts/registry', async () => {
    vi.mocked(Api.get).mockResolvedValue(registryPayload([promptOk, promptDrifted]));

    render(<PromptRegistryTab />);

    await waitFor(() => {
      expect(screen.getByText('persona-core')).toBeInTheDocument();
    });
    expect(screen.getByText('persona-challenge-mode')).toBeInTheDocument();
    expect(Api.get).toHaveBeenCalledWith('/api/admin/prompts/registry');
  });

  it('does not render a load failure as an empty registry', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('ai_ops capability denied'));

    render(<PromptRegistryTab />);

    await waitFor(() => {
      expect(screen.getByText('Prompt registry unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('ai_ops capability denied')).toBeInTheDocument();
    expect(screen.queryByText('No prompt assets match this filter')).not.toBeInTheDocument();
  });

  it('does not render a malformed payload as an empty registry', async () => {
    vi.mocked(Api.get).mockResolvedValue({ prompts: { unexpected: true } });

    render(<PromptRegistryTab />);

    await waitFor(() => {
      expect(screen.getByText('Prompt registry unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Prompt registry response was not a list')).toBeInTheDocument();
  });

  it('accepts axios-like wrapped payloads (response.data.data)', async () => {
    vi.mocked(Api.get).mockResolvedValue({
      data: { data: registryPayload([promptOk]) },
    });

    render(<PromptRegistryTab />);

    await waitFor(() => {
      expect(screen.getByText('persona-core')).toBeInTheDocument();
    });
    expect(screen.queryByText('Prompt registry unavailable')).not.toBeInTheDocument();
  });

  it('filters rows via the Drifted checksum chip (Menu 3)', async () => {
    vi.mocked(Api.get).mockResolvedValue(registryPayload([promptOk, promptDrifted]));

    render(<PromptRegistryTab />);

    await waitFor(() => {
      expect(screen.getByText('persona-core')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Drifted/ }));

    await waitFor(() => {
      expect(screen.queryByText('persona-core')).not.toBeInTheDocument();
    });
    expect(screen.getByText('persona-challenge-mode')).toBeInTheDocument();
  });

  it('opens the preview panel with prompt metadata on row click, never the prompt body', async () => {
    vi.mocked(Api.get).mockResolvedValue(registryPayload([promptOk]));

    render(<PromptRegistryTab />);

    await waitFor(() => {
      expect(screen.getByText('persona-core')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('persona-core'));

    await waitFor(() => {
      expect(screen.getByText(/Teresa's core identity\./)).toBeInTheDocument();
    });
    expect(screen.getByText(/server\/src\/ai\/persona\.ts#PERSONA_CORE/)).toBeInTheDocument();
  });
});
