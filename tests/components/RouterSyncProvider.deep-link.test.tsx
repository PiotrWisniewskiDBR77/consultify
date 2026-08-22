/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RouterSyncProvider } from '../../src/providers/RouterSyncProvider';
import { AppView } from '../../src/types';

const navigateMock = vi.fn();
const setCurrentViewMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useLocation: () => ({
    pathname: '/finance',
    search: '?ff_wave3FinanceOwnerReview=1',
  }),
  useNavigate: () => navigateMock,
}));

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    currentView: AppView.AI_CHAT,
    setCurrentView: setCurrentViewMock,
  }),
}));

describe('RouterSyncProvider direct Finance entry', () => {
  it('lets the URL replace stale view state without bouncing the deep link to chat', async () => {
    render(
      <React.StrictMode>
        <RouterSyncProvider>
          <div>Finance route</div>
        </RouterSyncProvider>
      </React.StrictMode>
    );

    await waitFor(() => {
      expect(setCurrentViewMock).toHaveBeenCalledWith(AppView.ECONOMICS);
    });
    expect(navigateMock).not.toHaveBeenCalledWith('/chat', { replace: true });
  });
});
