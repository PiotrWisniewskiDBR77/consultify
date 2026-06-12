/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MainLayout } from '../../../src/layouts/MainLayout';
import { AppView } from '../../../src/types';

const appState: any = {
  currentView: AppView.MY_WORK,
  currentUser: { firstName: 'Piotr', role: 'ADMIN' },
  currentOrganization: null,
  setCurrentView: vi.fn(),
  setIsSidebarOpen: vi.fn(),
  isSidebarOpen: false,
  isChatCollapsed: false,
  toggleChatCollapse: vi.fn(),
};

const conversationState = {
  isSidebarOpen: false,
  toggleSidebar: vi.fn(),
  activeConversationId: null,
  setDisplayMode: vi.fn(),
  setWorkspaceContext: vi.fn(),
  expandToFullScreen: vi.fn(),
  workspaceContext: null,
};

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback ?? _key,
      i18n: { language: 'en', resolvedLanguage: 'en' },
    }),
  };
});

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: (selector?: any) => (typeof selector === 'function' ? selector(appState) : appState),
}));

vi.mock('../../../src/store/useConversationStore', () => ({
  useConversationStore: Object.assign(
    (selector?: any) =>
      typeof selector === 'function' ? selector(conversationState) : conversationState,
    { getState: () => conversationState }
  ),
}));

vi.mock('../../../src/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ isMobile: false }),
}));

vi.mock('../../../src/components/AIChat/UnifiedChatPanel', () => ({
  UnifiedChatPanel: () => <div data-testid="chat-panel" />,
}));

vi.mock('../../../src/components/layout/NotificationDropdown', () => ({
  NotificationDropdown: () => <div data-testid="notifications" />,
}));

vi.mock('../../../src/components/layout/UserProfileMenu', () => ({
  UserProfileMenu: () => <div data-testid="user-menu" />,
}));

vi.mock('../../../src/components/TaskDropdown', () => ({
  TaskDropdown: () => <div data-testid="task-dropdown" />,
}));

vi.mock('../../../src/components/LLMSelector', () => ({
  LLMSelector: () => <div data-testid="llm-selector" />,
}));

vi.mock('../../../src/components/SystemHealth', () => ({
  SystemHealth: () => <div data-testid="system-health" />,
}));

vi.mock('../../../src/components/layout/GlobalAccessBanners', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('../../../src/components/AIFreezeBanner', () => ({
  AIFreezeBanner: () => null,
}));

vi.mock('../../../src/components/demo/DemoSessionManager', () => ({
  DemoSessionManager: () => null,
}));

vi.mock('../../../src/components/Help/HelpDeepLinkListener', () => ({
  HelpDeepLinkListener: () => null,
}));

vi.mock('../../../src/components/Help/HelpSidePanel', () => ({
  HelpSidePanel: () => null,
}));

vi.mock('../../../src/components/Help/HelpToggleButton', () => ({
  HelpToggleButton: () => null,
}));

vi.mock('../../../src/components/layout/DemoModeBanner', () => ({
  DemoModeBanner: () => null,
}));

vi.mock('../../../src/components/TrialExpiredGate', () => ({
  TrialExpiredGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../../src/components/navigation/Sidebar/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));

vi.mock('../../../src/components/Onboarding/OnboardingFirstLoginCTA', () => ({
  OnboardingFirstLoginCTA: () => null,
}));

describe('MainLayout breadcrumb accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders breadcrumb navigation with current page marker on final segment', () => {
    render(
      <MemoryRouter>
        <MainLayout breadcrumbs={['Tools', 'Strategic Analysis']}>
          <div>content</div>
        </MainLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByText('Strategic Analysis')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Tools')).not.toHaveAttribute('aria-current');
  });

  it('marks single breadcrumb segment as current page', () => {
    render(
      <MemoryRouter>
        <MainLayout breadcrumbs={['My Work']}>
          <div>content</div>
        </MainLayout>
      </MemoryRouter>
    );

    expect(screen.getByText('My Work')).toHaveAttribute('aria-current', 'page');
  });
});
