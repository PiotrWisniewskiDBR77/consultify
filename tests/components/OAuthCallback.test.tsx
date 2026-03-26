/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const setCurrentUserMock = vi.fn();
const setCurrentViewMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useSearchParams: () => [
    new URLSearchParams({
      token: 'token-1',
      user: encodeURIComponent(
        JSON.stringify({
          id: 'u-1',
          email: 'admin@example.com',
          role: 'SUPER_ADMIN',
        }),
      ),
    }),
  ],
}));

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    setCurrentUser: setCurrentUserMock,
    setCurrentView: setCurrentViewMock,
  }),
}));

import OAuthCallback from '../../src/views/OAuthCallback';

describe('OAuthCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('routes SUPER_ADMIN users to superadmin after auth success', async () => {
    render(<OAuthCallback />);

    await waitFor(() => {
      expect(setCurrentUserMock).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'SUPER_ADMIN',
          isAuthenticated: true,
        }),
      );
    });

    vi.advanceTimersByTime(1000);

    expect(navigateMock).toHaveBeenCalledWith('/superadmin');
  });
});
