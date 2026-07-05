/**
 * Component test: composed CommandPalette global search wiring (HARVARD H6.12).
 *
 * Verifies the Cmd+K palette fetches GET /api/search, renders grouped entity
 * hits, and navigates to the entity's module view on select.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../../src/services/api', () => ({
  Api: {
    get: (url: string) => mockGet(url),
  },
}));

import {
  CommandPaletteProvider,
  useCommandPalette,
} from '../../src/components/ui/composed/CommandPalette';
import { AppView } from '../../src/types';

function Opener() {
  const { open } = useCommandPalette();
  return (
    <button type="button" onClick={open} data-testid="open-cmdk">
      open
    </button>
  );
}

describe('CommandPalette — global search (H6.12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches /api/search and renders entity hits grouped by type', async () => {
    mockGet.mockResolvedValue({
      data: {
        query: 'road',
        total: 2,
        groups: {
          initiative: [{ type: 'initiative', id: 'i1', title: 'Roadmap Q3', updatedAt: null }],
          task: [{ type: 'task', id: 't1', title: 'Road survey', updatedAt: null }],
        },
      },
    });

    const onNavigate = vi.fn();
    render(
      <CommandPaletteProvider onNavigate={onNavigate}>
        <Opener />
      </CommandPaletteProvider>
    );

    fireEvent.click(screen.getByTestId('open-cmdk'));
    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'road' } });

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/search?q=road'));
    expect(await screen.findByText('Roadmap Q3')).toBeInTheDocument();
    expect(screen.getByText('Road survey')).toBeInTheDocument();
  });

  it('navigates to the entity module view when a hit is selected', async () => {
    mockGet.mockResolvedValue({
      data: {
        query: 'deck',
        total: 1,
        groups: {
          artifact: [{ type: 'artifact', id: 'a1', title: 'Board Deck', updatedAt: null }],
        },
      },
    });

    const onNavigate = vi.fn();
    render(
      <CommandPaletteProvider onNavigate={onNavigate}>
        <Opener />
      </CommandPaletteProvider>
    );

    fireEvent.click(screen.getByTestId('open-cmdk'));
    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'deck' } });

    const hit = await screen.findByText('Board Deck');
    fireEvent.click(hit);

    // artifact -> PRESENTATIONS view
    expect(onNavigate).toHaveBeenCalledWith(AppView.PRESENTATIONS);
  });

  it('does not query for sub-2-char terms', async () => {
    render(
      <CommandPaletteProvider onNavigate={vi.fn()}>
        <Opener />
      </CommandPaletteProvider>
    );
    fireEvent.click(screen.getByTestId('open-cmdk'));
    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'a' } });
    // give the debounce a beat
    await new Promise((r) => setTimeout(r, 320));
    expect(mockGet).not.toHaveBeenCalled();
  });
});
