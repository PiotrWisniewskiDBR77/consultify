import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Api } from '../../../services/api';
import { PersonasPanel } from '../AI/PersonasPanel';
vi.mock('../../../services/api', () => ({
  Api: { aiGetSystemPrompts: vi.fn(), aiUpdateSystemPrompt: vi.fn() },
}));
describe('PersonasPanel', () => {
  it('loads, saves and reads personas back', async () => {
    vi.mocked(Api.aiGetSystemPrompts).mockResolvedValue([
      { key: 'advisor', description: 'Old', content: 'Prompt', context_config: {} },
    ]);
    vi.mocked(Api.aiUpdateSystemPrompt).mockResolvedValue(undefined);
    render(<PersonasPanel />);
    fireEvent.click(await screen.findByText('advisor'));
    fireEvent.change(screen.getByLabelText('Opis persony'), { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz personę' }));
    expect(Api.aiUpdateSystemPrompt).toHaveBeenCalledWith(
      'advisor',
      expect.objectContaining({ description: 'New' })
    );
    await waitFor(() => expect(Api.aiGetSystemPrompts).toHaveBeenCalledTimes(2));
  });

  it('renders an honest empty state when there are no personas', async () => {
    vi.mocked(Api.aiGetSystemPrompts).mockResolvedValue([]);
    render(<PersonasPanel />);
    expect(await screen.findByText('Nie skonfigurowano żadnych person.')).toBeInTheDocument();
  });

  it('renders an API error', async () => {
    vi.mocked(Api.aiGetSystemPrompts).mockRejectedValue(new Error('personas service down'));
    render(<PersonasPanel />);
    expect(await screen.findByText('personas service down')).toBeInTheDocument();
  });
});
