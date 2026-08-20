/** @vitest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn();
let authState: Record<string, any>;

vi.mock('../../src/services/api', () => ({ Api: { get: (...args: unknown[]) => apiGet(...args) } }));
vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (selector: (state: Record<string, any>) => unknown) => selector(authState),
}));

import { useV10TeresaRuntime } from '../../src/hooks/v10/useV10TeresaRuntime';

describe('useV10TeresaRuntime auth boundary', () => {
  beforeEach(() => {
    apiGet.mockReset();
    authState = { isAuthInitializing: false, currentUser: null };
  });

  it('makes zero voice-config calls before authentication', () => {
    const { result } = renderHook(() => useV10TeresaRuntime());
    expect(apiGet).not.toHaveBeenCalled();
    expect(result.current.status).toBe('unavailable');
  });

  it('loads voice config only after a hydrated signed-in user exists', async () => {
    authState = { isAuthInitializing: false, currentUser: { isAuthenticated: true } };
    apiGet.mockResolvedValue({ data: { enabled: false, unavailableReason: 'disabled' } });
    renderHook(() => useV10TeresaRuntime());
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
    expect(apiGet).toHaveBeenCalledWith('/api/v10/teresa/voice-config');
  });
});

