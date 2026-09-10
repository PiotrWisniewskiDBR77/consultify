/**
 * @vitest-environment jsdom
 *
 * F4c (znalezisko E1a N5, [ODMROZENIE 07_MY_WORK_AGENT DEC-453]).
 *
 * `LinkedItemsSection` declares `isAddingLink`/`isAddingExternal` state and
 * fully implements both panels (search-and-attach, manual external link) —
 * but nothing in the component ever calls `setIsAddingLink(true)` or
 * `setIsAddingExternal(true)`. The panels exist and are wired to
 * `onAdd`/`searchItems`, yet are permanently unreachable: no button opens
 * them. Rodzina defektu "wołacz istnieje ≠ podłączony".
 *
 * RED (before F4c): clicking anywhere in the expanded, non-read-only section
 * never reveals the search input — there is no trigger.
 * GREEN (after F4c): an "Add Link" button opens the search panel, and an
 * "Add External Link" button opens the manual-URL panel; both panels also
 * expose their own close affordance.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue || _k,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { LinkedItemsSection } from '../LinkedItemsSection';

describe('LinkedItemsSection — Add Link trigger button (F4c)', () => {
  it('RED before the fix / GREEN after: renders a button that opens the search panel', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue({ ok: true });
    const searchItems = vi.fn().mockResolvedValue([]);

    render(
      <LinkedItemsSection
        items={[]}
        onAdd={onAdd}
        onRemove={vi.fn().mockResolvedValue({ ok: true })}
        searchItems={searchItems}
        expanded
        onToggleExpand={vi.fn()}
      />
    );

    // Before F4c there was no way to reach the search input at all.
    expect(screen.queryByPlaceholderText('Search items...')).not.toBeInTheDocument();

    const addLinkButton = screen.getByRole('button', { name: 'Add Link' });
    await user.click(addLinkButton);

    // GREEN: the search panel (with its input) is now visible.
    expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument();

    // It can also be closed again without adding anything.
    const closeButton = screen.getByTitle('Cancel');
    await user.click(closeButton);
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Search items...')).not.toBeInTheDocument()
    );
  });

  it('RED before the fix / GREEN after: renders a second button that opens the external-link panel', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue({ ok: true });

    render(
      <LinkedItemsSection
        items={[]}
        onAdd={onAdd}
        onRemove={vi.fn().mockResolvedValue({ ok: true })}
        expanded
        onToggleExpand={vi.fn()}
      />
    );

    expect(screen.queryByPlaceholderText('https://example.com')).not.toBeInTheDocument();

    const addExternalButton = screen.getByRole('button', { name: 'Add External Link' });
    await user.click(addExternalButton);

    expect(screen.getByPlaceholderText('https://example.com')).toBeInTheDocument();
  });

  it('does not render either trigger button when readOnly', () => {
    render(
      <LinkedItemsSection
        items={[]}
        onRemove={vi.fn().mockResolvedValue({ ok: true })}
        readOnly
        expanded
        onToggleExpand={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'Add Link' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add External Link' })).not.toBeInTheDocument();
  });
});
