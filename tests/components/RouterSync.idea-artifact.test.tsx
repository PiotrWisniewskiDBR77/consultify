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
    appState.currentView = AppView.MY_WORK;
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

  it('does not override artifact navigation when authenticated on an auth route', async () => {
    appState.currentUser = {
      isAuthenticated: true,
      role: 'ADMIN',
    };
    routerState.pathname = '/login';
    routerState.searchParams = new URLSearchParams('artifact=idea:idea-99');

    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/my-work?ideaId=idea-99', { replace: true });
    });

    expect(navigateMock).not.toHaveBeenCalledWith('/chat', { replace: true });
  });

  it('syncs currentView from pathname when URL target differs', async () => {
    routerState.pathname = '/my-work';
    routerState.searchParams = new URLSearchParams();
    appState.currentView = AppView.AI_CHAT;

    render(<RouterSync />);

    await waitFor(() => {
      expect(setCurrentViewStateMock).toHaveBeenCalledWith(AppView.MY_WORK);
    });
  });

  it('re-processes same artifact when pathname changes', async () => {
    routerState.pathname = '/my-work';
    routerState.searchParams = new URLSearchParams('artifact=idea:idea-42');
    const { rerender } = render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/my-work?ideaId=idea-42', { replace: true });
    });

    navigateMock.mockReset();
    setMyWorkIntentMock.mockReset();

    routerState.pathname = '/interview';
    routerState.searchParams = new URLSearchParams('artifact=idea:idea-42');
    rerender(<RouterSync />);

    await waitFor(() => {
      expect(setMyWorkIntentMock).toHaveBeenCalledWith({
        tab: 'ideas',
        open: {
          type: 'idea',
          id: 'idea-42',
        },
      });
      expect(navigateMock).toHaveBeenCalledWith('/my-work?ideaId=idea-42', { replace: true });
    });
  });

  it('routes notebook artifact without leaving trailing query delimiter', async () => {
    routerState.searchParams = new URLSearchParams('artifact=notebook:notebook-77');
    render(<RouterSync />);

    await waitFor(() => {
      expect(setMyWorkIntentMock).toHaveBeenCalledWith({
        tab: 'notebook',
        open: { type: 'notebook', id: 'notebook-77' },
      });
    });

    expect(navigateMock).toHaveBeenCalledWith('/my-work', { replace: true });
  });

  it('cleans unsupported artifact params and keeps current route', async () => {
    routerState.pathname = '/my-work';
    routerState.searchParams = new URLSearchParams('artifact=unknown:abc&code=tmp');

    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/my-work?code=tmp', { replace: true });
    });

    expect(setMyWorkIntentMock).not.toHaveBeenCalled();
  });

  it('preserves unrelated code param while rewriting artifact links', async () => {
    routerState.pathname = '/my-work';
    routerState.searchParams = new URLSearchParams('artifact=task:task-1&code=oauth-code');

    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/my-work?code=oauth-code&taskId=task-1', {
        replace: true,
      });
    });
  });

  it('removes only canonical artifact code for rewritten links', async () => {
    routerState.pathname = '/my-work';
    routerState.searchParams = new URLSearchParams('artifact=task:task-1&code=TASK-TASK-1');

    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/my-work?taskId=task-1', { replace: true });
    });
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

  it('blocks task artifact deep links for pilot participants', async () => {
    appState.currentUser = {
      isAuthenticated: true,
      role: 'MEMBER',
    };
    routerState.searchParams = new URLSearchParams('artifact=task:task-99');

    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/interview', { replace: true });
    });

    expect(setMyWorkIntentMock).not.toHaveBeenCalled();
  });

  it('protects /implementation, /rollout, and /discovery routes for unauthenticated users', async () => {
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

    navigateMock.mockReset();

    routerState.pathname = '/discovery';
    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
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

  it('does not apply demo/trial session entry updates when already authenticated', () => {
    appState.currentUser = {
      isAuthenticated: true,
      role: 'ADMIN',
    };
    routerState.searchParams = new URLSearchParams();

    for (const pathname of ['/trial', '/trial/start', '/demo'] as const) {
      setSessionModeMock.mockClear();
      setAuthInitialStepMock.mockClear();
      routerState.pathname = pathname;
      const { unmount } = render(<RouterSync />);
      expect(setSessionModeMock).not.toHaveBeenCalled();
      expect(setAuthInitialStepMock).not.toHaveBeenCalled();
      unmount();
    }
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
    appState.currentView = AppView.AI_CHAT;
    routerState.searchParams = new URLSearchParams();
    routerState.pathname = '/chat';

    render(<RouterSync />);

    await waitFor(() => {
      expect(setCurrentViewStateMock).toHaveBeenCalledWith(AppView.MY_WORK);
    });

    expect(navigateMock).not.toHaveBeenCalledWith('/interview', { replace: true });
  });

  it('preserves query string when redirecting SUPERADMIN from /chat to /superadmin', async () => {
    appState.currentUser = {
      isAuthenticated: true,
      role: 'SUPERADMIN',
    };
    appState.currentView = AppView.AI_CHAT;
    routerState.pathname = '/chat';
    routerState.searchParams = new URLSearchParams('from=admin&tab=threads');

    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/superadmin?from=admin&tab=threads', {
        replace: true,
      });
    });
  });

  it('does not crash when attribution storage write fails', async () => {
    appState.currentUser = null as any;
    routerState.pathname = '/implementation';
    routerState.searchParams = new URLSearchParams('ref=abc123');

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    try {
      expect(() => render(<RouterSync />)).not.toThrow();

      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
      });
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it('does not set my-work intent for unauthenticated artifact deep links', async () => {
    appState.currentUser = null as any;
    routerState.pathname = '/my-work';
    routerState.searchParams = new URLSearchParams('artifact=idea:idea-42');

    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login?artifact=idea%3Aidea-42', { replace: true });
    });

    expect(setMyWorkIntentMock).not.toHaveBeenCalled();
  });

  it('consumes artifact deep-link after auth flips to authenticated on same route', async () => {
    appState.currentUser = {
      isAuthenticated: false,
      role: 'ADMIN',
    } as any;
    routerState.pathname = '/login';
    routerState.searchParams = new URLSearchParams('artifact=idea:idea-42');

    const { rerender } = render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login?artifact=idea%3Aidea-42', { replace: true });
    });

    navigateMock.mockReset();
    setMyWorkIntentMock.mockReset();

    appState.currentUser = {
      isAuthenticated: true,
      role: 'ADMIN',
    };
    rerender(<RouterSync />);

    await waitFor(() => {
      expect(setMyWorkIntentMock).toHaveBeenCalledWith({
        tab: 'ideas',
        open: { type: 'idea', id: 'idea-42' },
      });
      expect(navigateMock).toHaveBeenCalledWith('/my-work?ideaId=idea-42', { replace: true });
    });
  });

  it('sets REGISTER step for invite when user exists but is not authenticated', async () => {
    appState.currentUser = {
      isAuthenticated: false,
      role: 'ADMIN',
    } as any;
    routerState.pathname = '/login';
    routerState.searchParams = new URLSearchParams('invite=abc123');

    render(<RouterSync />);

    await waitFor(() => {
      expect(setAuthInitialStepMock).toHaveBeenCalledWith('REGISTER');
    });
  });

  it('redirects unauthenticated non-my-work artifacts to login with artifact preserved', async () => {
    appState.currentUser = null as any;
    routerState.pathname = '/interview';
    routerState.searchParams = new URLSearchParams('artifact=report:rep-1');

    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login?artifact=report%3Arep-1', { replace: true });
    });
  });

  it('protects /app-intro and /internal routes for unauthenticated users', async () => {
    appState.currentUser = null as any;
    routerState.searchParams = new URLSearchParams();

    routerState.pathname = '/app-intro';
    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
    });

    navigateMock.mockReset();

    routerState.pathname = '/internal/v10-runtime';
    render(<RouterSync />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
    });
  });
});
