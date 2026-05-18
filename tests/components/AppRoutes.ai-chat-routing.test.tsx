/**
 * @vitest-environment jsdom
 */
import React, { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const appState: any = {
  currentView: 'AI_CHAT',
  currentUser: {
    isAuthenticated: true,
    role: 'ADMIN',
  },
  currentOrganization: null,
  currentProjectId: null,
  setCurrentView: vi.fn(),
  setCurrentUser: vi.fn(),
  setCurrentOrganization: vi.fn(),
  setCurrentProjectId: vi.fn(),
  setSessionMode: vi.fn(),
  setAuthInitialStep: vi.fn(),
  authInitialStep: 'LOGIN',
  sessionMode: 'FULL',
  logout: vi.fn(),
  fullSessionData: null,
  setFullSessionData: vi.fn(),
  theme: 'dark',
  toggleTheme: vi.fn(),
  setNavigateFn: vi.fn(),
  isAuthInitializing: false,
  setDemoMode: vi.fn(),
  resetDemoState: vi.fn(),
};

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback || _key,
    }),
  };
});

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: () => appState,
}));

vi.mock('../../src/hooks/useBreadcrumbs', () => ({
  useBreadcrumbs: () => null,
}));

vi.mock('../../src/utils/roleGuards', () => ({
  isSuperAdminRole: () => false,
  isPilotRestrictedRole: () => false,
  getDefaultAuthenticatedRoute: () => '/chat',
}));

vi.mock('../../src/utils/publicProduction', () => ({
  shouldHideNonCoreModulesInPublicProduction: () => false,
}));

vi.mock('../../src/layouts/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

vi.mock('../../src/components/RouteErrorBoundary', () => ({
  RouteErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../src/components/shared/AnimationWrapper', () => ({
  AnimationWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../src/components/AIChat/ConversationRouteSync', () => ({
  ConversationRouteSync: () => <div data-testid="conversation-route-sync" />,
}));

vi.mock('../../src/views/AIChatWelcomeView', () => ({
  AIChatWelcomeView: () => <div data-testid="ai-chat-welcome-view" />,
}));

vi.mock('../../src/components/AIChat/UnifiedChatPanel', () => ({
  UnifiedChatPanel: () => <div data-testid="unified-chat-panel-view" />,
}));

describe('AppRoutes AI chat routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appState.currentUser = {
      isAuthenticated: true,
      role: 'ADMIN',
    };
    appState.isAuthInitializing = false;
  });

  async function renderRoute(initialEntry: string) {
    const { AppRoutes } = await import('../../src/routes/AppRoutes');

    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Suspense fallback={<div data-testid="routes-loading" />}>
          <AppRoutes />
        </Suspense>
      </MemoryRouter>
    );
  }

  it('renders AIChatWelcomeView on /chat', async () => {
    await renderRoute('/chat');

    await waitFor(() => {
      expect(screen.getByTestId('ai-chat-welcome-view')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('unified-chat-panel-view')).not.toBeInTheDocument();
  });

  it('renders UnifiedChatPanel on /chat/:conversationId', async () => {
    await renderRoute('/chat/conv-123');

    await waitFor(() => {
      expect(screen.getByTestId('unified-chat-panel-view')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('ai-chat-welcome-view')).not.toBeInTheDocument();
  });
});
