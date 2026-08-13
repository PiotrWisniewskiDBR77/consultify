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
  useLocation: () => ({ pathname: routerState.pathname, search: '' }),
  useNavigate: () => navigateMock,
  useSearchParams: () => [routerState.searchParams],
}));

vi.mock('../../src/routes/routeConfig', () => ({
  getAppViewFromPath: () => AppView.MY_WORK,
}));

vi.mock('../../src/utils/roleGuards', () => ({
  isSuperAdminRole: (role: string | null | undefined) => role === 'SUPERADMIN',
  getDefaultAuthenticatedRoute: (role: string | null | undefined) =>
    role === 'MEMBER' ? '/interview' : '/chat',
  isPilotRestrictedRole: (role: string | null | undefined) =>
    role === 'MEMBER' || role === 'USER' || role === 'GUEST',
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

  it('blocks idea artifact deep links for pilot participants', async () => {
    appState.currentUser = {
      isAuthenticated: true,
      role: 'MEMBER',
    };

    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/interview', { replace: true });
    });

    expect(setMyWorkIntentMock).not.toHaveBeenCalled();
  });

  it('protects /implementation and /rollout routes for unauthenticated users', async () => {
    appState.currentUser = null as any;
    routerState.searchParams = new URLSearchParams();

    routerState.pathname = '/implementation';
    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login?redirect=%2Fimplementation', {
        replace: true,
      });
    });

    navigateMock.mockReset();

    routerState.pathname = '/rollout';
    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login?redirect=%2Frollout', { replace: true });
    });

    navigateMock.mockReset();

    routerState.pathname = '/kpi-okr';
    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login?redirect=%2Fkpi-okr', { replace: true });
    });

    navigateMock.mockReset();

    routerState.pathname = '/finance';
    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login?redirect=%2Ffinance', { replace: true });
    });

    navigateMock.mockReset();

    routerState.pathname = '/portfolio';
    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login?redirect=%2Fportfolio', { replace: true });
    });
  });

  it('protects AI OS routes for unauthenticated users', async () => {
    appState.currentUser = null as any;
    routerState.searchParams = new URLSearchParams();
    routerState.pathname = '/ai/actions';

    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login?redirect=%2Fai%2Factions', {
        replace: true,
      });
    });
  });

  it('maps /trial and /trial/start to the correct auth steps', async () => {
    appState.currentUser = null as any;
    routerState.searchParams = new URLSearchParams();

    routerState.pathname = '/trial';
    render(<RouterSync />);

    await waitFor(() => {
      expect(setSessionModeMock).toHaveBeenCalledWith('FULL');
      expect(setAuthInitialStepMock).toHaveBeenCalledWith('CODE_ENTRY');
    });

    setSessionModeMock.mockReset();
    setAuthInitialStepMock.mockReset();

    routerState.pathname = '/trial/start';
    render(<RouterSync />);

    await waitFor(() => {
      expect(setSessionModeMock).toHaveBeenCalledWith('FULL');
      expect(setAuthInitialStepMock).toHaveBeenCalledWith('REGISTER');
    });
  });

  it('redirects pilot participants away from blocked modules', async () => {
    appState.currentUser = {
      isAuthenticated: true,
      role: 'MEMBER',
    };
    routerState.searchParams = new URLSearchParams();
    routerState.pathname = '/finance';

    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/interview', { replace: true });
    });
  });

  it('keeps chat available for pilot participants', async () => {
    appState.currentUser = {
      isAuthenticated: true,
      role: 'MEMBER',
    };
    routerState.searchParams = new URLSearchParams();
    routerState.pathname = '/chat';

    render(<RouterSync />);

    expect(navigateMock).not.toHaveBeenCalledWith('/interview', { replace: true });
  });
});
