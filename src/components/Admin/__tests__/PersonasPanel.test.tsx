import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';

import { Api } from '../../../services/api';
import { PersonasPanel } from '../AI/PersonasPanel';

// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

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
