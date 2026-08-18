import React, { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { usePMOContextAutoFetch, usePMOStore } from '../usePMOStore';

const initialStoreState = usePMOStore.getState();

describe('usePMOContextAutoFetch', () => {
  afterEach(() => {
    act(() => usePMOStore.setState(initialStoreState, true));
    vi.restoreAllMocks();
  });

  it('defers store writes until the effect and fetches once per project transition', () => {
    const fetchPMOContext = vi.fn().mockResolvedValue(undefined);
    const fetchTaskLabels = vi.fn().mockResolvedValue(undefined);
    act(() => {
      usePMOStore.setState({
        ...initialStoreState,
        projectId: null,
        lastFetched: null,
        fetchPMOContext,
        fetchTaskLabels,
      });
    });

    const renderPhaseCallCounts: number[] = [];
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );
    const { rerender } = renderHook(
      ({ projectId }) => {
        usePMOContextAutoFetch(projectId);
        renderPhaseCallCounts.push(fetchPMOContext.mock.calls.length);
      },
      { initialProps: { projectId: 'project-a' as string | null }, wrapper }
    );

    expect(renderPhaseCallCounts.slice(0, 2)).toEqual([0, 0]);
    expect(fetchPMOContext).toHaveBeenCalledTimes(1);
    expect(fetchTaskLabels).toHaveBeenCalledTimes(1);
    expect(fetchPMOContext).toHaveBeenLastCalledWith('project-a');

    rerender({ projectId: 'project-a' });
    expect(fetchPMOContext).toHaveBeenCalledTimes(1);
    expect(fetchTaskLabels).toHaveBeenCalledTimes(1);

    rerender({ projectId: 'project-b' });
    expect(fetchPMOContext).toHaveBeenCalledTimes(2);
    expect(fetchTaskLabels).toHaveBeenCalledTimes(2);
    expect(fetchPMOContext).toHaveBeenLastCalledWith('project-b');
  });
});
