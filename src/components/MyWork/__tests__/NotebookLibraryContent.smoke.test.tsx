/**
 * @vitest-environment jsdom
 *
 * NotebookLibraryContent — smoke (WS-02 notebook L1 layer).
 *
 * Pins the new list-of-notebooks (Notatniki) surface that was uncommitted WIP:
 *   - loading → empty state when no notebooks;
 *   - renders rows from Api.getNotebooks and reports scope counts;
 *   - clicking a row opens the notebook (L1 → L2 handoff);
 *   - load failure shows the retry affordance.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Notebook } from '@/types/myWork';

const getNotebooks = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    getNotebooks: (...a: unknown[]) => getNotebooks(...a),
    getTeams: vi.fn().mockResolvedValue([]),
    createNotebook: vi.fn(),
    updateNotebook: vi.fn(),
    deleteNotebook: vi.fn(),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (s: unknown) => unknown) => selector({ currentUser: { id: 'user-1' } }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Support both t(key, 'default') and t(key, { defaultValue }) — the shared
    // EmptyState (canonical states) uses the options-object form.
    t: (_k: string, d?: string | { defaultValue?: string }) => {
      if (_k === 'common.retry') return 'Retry';
      return typeof d === 'string' ? d : (d?.defaultValue ?? _k);
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { NotebookLibraryContent } from '../NotebookLibraryContent';

const makeNotebook = (over: Partial<Notebook> = {}): Notebook => ({
  id: 'nb-1',
  ownerUserId: 'user-1',
  organizationId: 'org-1',
  title: 'Atelier Project Notes',
  icon: '📓',
  scope: 'personal',
  teamId: null,
  contextSharing: 'private',
  pageCount: 3,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:00.000Z',
  ...over,
});

describe('NotebookLibraryContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an empty state when there are no notebooks', async () => {
    getNotebooks.mockResolvedValue([]);
    render(<NotebookLibraryContent onOpenNotebook={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('No notebooks yet')).toBeTruthy());
  });

  it('renders notebook rows and reports scope counts', async () => {
    getNotebooks.mockResolvedValue([
      makeNotebook({ id: 'nb-1', title: 'Personal Notes', scope: 'personal' }),
      makeNotebook({ id: 'nb-2', title: 'Team Notes', scope: 'team', teamId: 't1' }),
    ]);
    const onScopeCountsChange = vi.fn();
    render(
      <NotebookLibraryContent onOpenNotebook={vi.fn()} onScopeCountsChange={onScopeCountsChange} />
    );
    await waitFor(() => expect(screen.getByText('Personal Notes')).toBeTruthy());
    expect(screen.getByText('Team Notes')).toBeTruthy();
    await waitFor(() =>
      expect(onScopeCountsChange).toHaveBeenCalledWith({ all: 2, personal: 1, team: 1 })
    );
  });

  it('opens a notebook when its row is clicked', async () => {
    getNotebooks.mockResolvedValue([makeNotebook({ id: 'nb-1', title: 'Clickable' })]);
    const onOpenNotebook = vi.fn();
    render(<NotebookLibraryContent onOpenNotebook={onOpenNotebook} />);
    await waitFor(() => expect(screen.getByText('Clickable')).toBeTruthy());
    fireEvent.click(screen.getByText('Clickable'));
    expect(onOpenNotebook).toHaveBeenCalledTimes(1);
    expect(onOpenNotebook.mock.calls[0][0].id).toBe('nb-1');
  });

  it('shows a retry affordance when loading fails', async () => {
    getNotebooks.mockRejectedValue(new Error('boom'));
    render(<NotebookLibraryContent onOpenNotebook={vi.fn()} />);
    // kanon TRIADA §27 — StandardTable's built-in error state hardcodes the
    // "Retry" label itself (src/components/standard/StandardTable.tsx), unlike
    // the bespoke SharedEmptyState this screen used before ("Try again").
    await waitFor(() => expect(screen.getByText('Retry')).toBeTruthy());
  });
});
