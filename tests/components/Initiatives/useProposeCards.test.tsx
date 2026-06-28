/**
 * @vitest-environment jsdom
 *
 * useProposeCards (R6) — pure data hook unit test.
 *
 * Mocks `@/services/api` so no network is touched, then drives `fetchProposal`
 * and asserts:
 *   - core/proposed/type populate from the response,
 *   - loading toggles around the call,
 *   - a rejected request sets `error` and never throws to the caller.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// `@/services/api` → mocked Api.post (see ProblemDefinitionSection mock idiom).
const postMock = vi.fn();
vi.mock('@/services/api', () => ({
  Api: { post: (...args: any[]) => postMock(...args) },
}));

import { useProposeCards } from '@/components/Initiatives/Wizard/useProposeCards';

describe('useProposeCards', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('populates core/proposed/type and toggles loading on success', async () => {
    postMock.mockResolvedValue({
      data: {
        core: ['problemDefinition', 'scope'],
        proposed: ['raid', 'pilot'],
        type: 'generic',
      },
    });

    const { result } = renderHook(() => useProposeCards());

    // Initial state is empty + not loading.
    expect(result.current.core).toEqual([]);
    expect(result.current.proposed).toEqual([]);
    expect(result.current.loading).toBe(false);

    await act(async () => {
      await result.current.fetchProposal({ type: 'x' });
    });

    expect(postMock).toHaveBeenCalledWith('/initiatives/propose-cards', { type: 'x' });
    expect(result.current.core).toEqual(['problemDefinition', 'scope']);
    expect(result.current.proposed).toEqual(['raid', 'pilot']);
    expect(result.current.type).toBe('generic');
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('flips loading true while the request is in flight', async () => {
    let resolveFn: (v: any) => void = () => {};
    postMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFn = resolve;
      })
    );

    const { result } = renderHook(() => useProposeCards());

    let pending: Promise<void>;
    act(() => {
      pending = result.current.fetchProposal({ type: 'pilot' });
    });

    // While the promise is unresolved, loading must be true.
    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => {
      resolveFn({ data: { core: ['scope'], proposed: [], type: 'pilot' } });
      await pending;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.core).toEqual(['scope']);
  });

  it('tolerates missing fields by defaulting to empty arrays', async () => {
    postMock.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useProposeCards());

    await act(async () => {
      await result.current.fetchProposal({ type: 'whatever' });
    });

    expect(result.current.core).toEqual([]);
    expect(result.current.proposed).toEqual([]);
    expect(result.current.type).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('sets error and does not throw when the request rejects', async () => {
    postMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useProposeCards());

    // Must NOT throw out of fetchProposal.
    await act(async () => {
      await expect(result.current.fetchProposal({ type: 'x' })).resolves.toBeUndefined();
    });

    expect(result.current.error).toBe('boom');
    expect(result.current.loading).toBe(false);
    expect(result.current.core).toEqual([]);
  });
});
