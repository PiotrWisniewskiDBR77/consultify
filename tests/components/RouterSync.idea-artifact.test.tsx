/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RouterSync } from '../../src/components/RouterSync';
import { AppView } from '../../src/types';

const navigateMock = vi.fn();
const setCurrentViewStateMock = vi.fn();
const setMyWorkIntentMock = vi.fn();
const setSessionModeMock = vi.fn();
const setAuthInitialStepMock = vi.fn();

const routerState = {
  pathname: '/my-work',
  searchParams: new URLSearchParams('artifact=idea:idea-42'),
};

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: routerState.pathname }),
  useNavigate: () => navigateMock,
  useSearchParams: () => [routerState.searchParams],
}));

vi.mock('../../src/routes/routeConfig', () => ({
  getAppViewFromPath: () => AppView.MY_WORK,
}));

vi.mock('../../src/utils/roleGuards', () => ({
  isSuperAdminRole: () => false,
}));

const appState = {
  setCurrentViewState: setCurrentViewStateMock,
  setMyWorkIntent: setMyWorkIntentMock,
  setSessionMode: setSessionModeMock,
  setAuthInitialStep: setAuthInitialStepMock,
  currentView: AppView.MY_WORK,
  currentUser: {
    isAuthenticated: true,
    role: 'ADMIN',
  },
};

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (selector: (state: typeof appState) => unknown) => selector(appState),
}));

describe('RouterSync idea artifact deep links', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setCurrentViewStateMock.mockReset();
    setMyWorkIntentMock.mockReset();
    setSessionModeMock.mockReset();
    setAuthInitialStepMock.mockReset();
    routerState.pathname = '/my-work';
    routerState.searchParams = new URLSearchParams('artifact=idea:idea-42');
    appState.currentUser = {
      isAuthenticated: true,
      role: 'ADMIN',
    };
  });

  it('routes artifact=idea:* into the canonical My Work ideas intent', async () => {
    render(<RouterSync />);

    await waitFor(() => {
      expect(setMyWorkIntentMock).toHaveBeenCalledWith({
        tab: 'ideas',
        open: {
          type: 'idea',
          id: 'idea-42',
        },
      });
    });

    expect(navigateMock).toHaveBeenCalledWith('/my-work?ideaId=idea-42', { replace: true });
  });

  it('protects /implementation and /rollout routes for unauthenticated users', async () => {
    appState.currentUser = null as any;
    routerState.searchParams = new URLSearchParams();

    routerState.pathname = '/implementation';
    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
    });

    navigateMock.mockReset();

    routerState.pathname = '/rollout';
    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
    });

    navigateMock.mockReset();

    routerState.pathname = '/kpi-okr';
    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
    });

    navigateMock.mockReset();

    routerState.pathname = '/finance';
    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
    });
  });
});
