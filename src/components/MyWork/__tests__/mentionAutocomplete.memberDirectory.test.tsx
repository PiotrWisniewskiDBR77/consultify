/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({ currentOrganization: { id: 'org-a', name: 'Org A' } }),
}));

import { useMentionAutocomplete } from '../mentionAutocomplete';

describe('mention autocomplete — DEC-583 minimal member directory', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            { id: 'member-1', displayName: 'Maria Member', avatar: null },
            { id: 'member-2', displayName: 'Alex Owner', avatar: null },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
  });

  it('normalizes the privacy-minimized wire payload and safely filters by name', async () => {
    const { result } = renderHook(() => useMentionAutocomplete(true));

    await waitFor(() =>
      expect(result.current.mentionPool).toEqual([
        { id: 'member-1', name: 'Maria Member' },
        { id: 'member-2', name: 'Alex Owner' },
      ])
    );

    act(() => result.current.handleMentionInput('@maria', 6));
    expect(result.current.mentionSuggestions).toEqual([{ id: 'member-1', name: 'Maria Member' }]);
  });
});
