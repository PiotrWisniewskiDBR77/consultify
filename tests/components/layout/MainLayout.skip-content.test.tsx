/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppView } from '../../../src/types';
import { MainLayout } from '../../../src/layouts/MainLayout';

const appState = {
  isSidebarCollapsed: false,
  setIsSidebarOpen: vi.fn(),
  isChatCollapsed: true,
  toggleChatCollapse: vi.fn(),
  chatKickoffMessage: null,
  clearChatKickoffMessage: vi.fn(),
  currentUser: { isDemo: false },
  currentView: AppView.MY_WORK,
  currentProjectId: 'project-1',
  chatPanelWidth: 360,
  setChatPanelWidth: vi.fn(),
  chatSystemPrompt: null,
  chatQuickPrompts: [],
};

const conversationState = {
  setDisplayMode: vi.fn(),
  setWorkspaceContext: vi.fn(),
  expandToFullScreen: vi.fn(),
  workspaceContext: null,
};

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

vi.mock('../../../src/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ isMobile: false, safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 } }),
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: (selector?: (state: typeof appState) => unknown) =>
    typeof selector === 'function' ? selector(appState) : appState,
}));

vi.mock('../../../src/store/useConversationStore', () => ({
  useConversationStore: Object.assign(
    (selector?: (state: typeof conversationState) => unknown) =>
      typeof selector === 'function' ? selector(conversationState) : conversationState,
    { getState: () => conversationState }
  ),
}));

vi.mock('../../../src/types/workspace', () => ({
  createWorkspaceContext: vi.fn(() => ({ mock: true })),
  getDefaultWorkspaceType: vi.fn(() => 'task'),
}));

vi.mock('../../../src/components/access/AccessBlockedModal', () => ({ AccessBlockedModal: () => null }));
vi.mock('../../../src/components/AIChat/UnifiedChatPanel', () => ({ UnifiedChatPanel: () => null }));
vi.mock('../../../src/components/AIFreezeBanner', () => ({ AIFreezeBanner: () => null }));
vi.mock('../../../src/components/demo/DemoSessionManager', () => ({ DemoSessionManager: () => null }));
vi.mock('../../../src/components/documents/DocumentSidePanel', () => ({ DocumentSidePanel: () => null }));
vi.mock('../../../src/components/documents/DocumentToggleButton', () => ({ DocumentToggleButton: () => null }));
vi.mock('../../../src/components/Feedback/FeedbackSidePanel', () => ({ FeedbackSidePanel: () => null }));
vi.mock('../../../src/components/Feedback/FeedbackToggleButton', () => ({ FeedbackToggleButton: () => null }));
vi.mock('../../../src/components/Feedback/FeedbackFloatingButton', () => ({ FeedbackFloatingButton: () => null }));
vi.mock('../../../src/components/Help/HelpSidePanel', () => ({ HelpSidePanel: () => null }));
vi.mock('../../../src/components/Help/HelpDeepLinkListener', () => ({ HelpDeepLinkListener: () => null }));
vi.mock('../../../src/components/Help/HelpToggleButton', () => ({ HelpToggleButton: () => null }));
vi.mock('../../../src/components/layout/DemoModeBanner', () => ({ DemoModeBanner: () => null }));
vi.mock('../../../src/components/layout/GlobalAccessBanners', () => ({ default: () => null }));
vi.mock('../../../src/components/layout/NotificationDropdown', () => ({ NotificationDropdown: () => null }));
vi.mock('../../../src/components/layout/UserProfileMenu', () => ({ UserProfileMenu: () => null }));
vi.mock('../../../src/components/LLMSelector', () => ({ LLMSelector: () => null }));
vi.mock('../../../src/components/navigation/BottomNavigation', () => ({ BottomNavigation: () => null }));
vi.mock('../../../src/components/navigation/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('../../../src/components/Onboarding/OnboardingFirstLoginCTA', () => ({ OnboardingFirstLoginCTA: () => null }));
vi.mock('../../../src/components/SystemHealth', () => ({ SystemHealth: () => null }));
vi.mock('../../../src/components/TaskDropdown', () => ({ TaskDropdown: () => null }));
vi.mock('../../../src/components/Trial/TrialExpiredGate', () => ({
  TrialExpiredGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('MainLayout skip link', () => {
  beforeEach(() => {
    appState.isChatCollapsed = true;
    appState.toggleChatCollapse.mockReset();
  });

  it('renders skip link and anchors to main content region', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MainLayout breadcrumbs={['Home']}>
          <div>content</div>
        </MainLayout>
      </MemoryRouter>
    );

    const skipLink = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skipLink).toHaveAttribute('href', '#app-main-content');
    const mainContent = document.getElementById('app-main-content');
    expect(mainContent).toBeInTheDocument();

    await user.click(skipLink);
    expect(mainContent).toHaveAttribute('tabindex', '-1');
  });
});
