/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setSearchParamsMock = vi.fn();
const getToolSessionMock = vi.fn();
const searchState = {
  params: new URLSearchParams('artifact=nocolon&code=temp'),
};

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [searchState.params, setSearchParamsMock],
}));

vi.mock('@/components/DiscoveryTools', () => ({
  ToolDocumentView: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    getToolSession: (...args: unknown[]) => getToolSessionMock(...args),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    setCurrentView: vi.fn(),
  }),
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: vi.fn(),
  },
}));

import { StrategicToolsView } from '@/views/discovery-tools/StrategicToolsView';

describe('StrategicToolsView artifact query hygiene', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchState.params = new URLSearchParams('artifact=nocolon&code=temp');
    getToolSessionMock.mockResolvedValue({ toolType: 'dynamic-swot' });
  });

  it('clears malformed artifact and code params without fetching session', async () => {
    render(<StrategicToolsView />);

    await waitFor(() => {
      expect(setSearchParamsMock).toHaveBeenCalled();
    });
    const [params, options] = setSearchParamsMock.mock.calls.at(-1) ?? [];
    expect(String(params)).toBe('');
    expect(options).toEqual({ replace: true });
    expect(getToolSessionMock).not.toHaveBeenCalled();
  });

  it('clears unsupported artifact type and code params without fetching session', async () => {
    searchState.params = new URLSearchParams('artifact=initiative:init-1&code=tmp');
    render(<StrategicToolsView />);

    await waitFor(() => {
      expect(setSearchParamsMock).toHaveBeenCalled();
    });
    const [params, options] = setSearchParamsMock.mock.calls.at(-1) ?? [];
    expect(String(params)).toBe('');
    expect(options).toEqual({ replace: true });
    expect(getToolSessionMock).not.toHaveBeenCalled();
  });

  it('keeps happy-path behavior for supported tool artifact links', async () => {
    searchState.params = new URLSearchParams('artifact=tool:session-1&code=tmp');
    getToolSessionMock.mockResolvedValueOnce({ toolType: 'dynamic-swot' });

    render(<StrategicToolsView />);

    await waitFor(() => {
      expect(getToolSessionMock).toHaveBeenCalledWith('session-1');
      expect(setSearchParamsMock).toHaveBeenCalled();
    });

    const [params, options] = setSearchParamsMock.mock.calls.at(-1) ?? [];
    expect(String(params)).toBe('');
    expect(options).toEqual({ replace: true });
  });
});

