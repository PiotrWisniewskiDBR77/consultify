/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppView } from '../../../src/types';

const deviceState = {
  isMobile: true,
  safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
};

const llmSelectorMock = vi.fn(({ compact }: { compact?: boolean }) => (
  <div data-testid="llm-selector-prop">{compact ? 'compact' : 'regular'}</div>
));

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
};

const conversationState = {
  setDisplayMode: vi.fn(),
  setWorkspaceContext: vi.fn(),
  expandToFullScreen: vi.fn(),
  workspaceContext: null,
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../src/hooks/useDeviceType', () => ({
  useDeviceType: () => deviceState,
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: (selector: (state: typeof appState) => unknown) => selector(appState),
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

vi.mock('../../../src/components/access/AccessBlockedModal', () => ({
  AccessBlockedModal: () => <div data-testid="access-blocked-modal" />,
}));
vi.mock('../../../src/components/AIChat/UnifiedChatPanel', () => ({
  UnifiedChatPanel: () => <div data-testid="unified-chat-panel" />,
}));
vi.mock('../../../src/components/AIFreezeBanner', () => ({
  AIFreezeBanner: () => <div data-testid="ai-freeze-banner" />,
}));
vi.mock('../../../src/components/demo/DemoSessionManager', () => ({
  DemoSessionManager: () => <div data-testid="demo-session-manager" />,
}));
vi.mock('../../../src/components/documents/DocumentSidePanel', () => ({
  DocumentSidePanel: () => <div data-testid="document-side-panel" />,
}));
vi.mock('../../../src/components/documents/DocumentToggleButton', () => ({
  DocumentToggleButton: () => <button type="button">docs</button>,
}));
vi.mock('../../../src/components/Feedback/FeedbackSidePanel', () => ({
  FeedbackSidePanel: () => <div data-testid="feedback-side-panel" />,
}));
vi.mock('../../../src/components/Feedback/FeedbackToggleButton', () => ({
  FeedbackToggleButton: () => <button type="button">feedback</button>,
}));
vi.mock('../../../src/components/Help/HelpSidePanel', () => ({
  HelpSidePanel: () => <div data-testid="help-side-panel" />,
}));
vi.mock('../../../src/components/Help/HelpDeepLinkListener', () => ({
  HelpDeepLinkListener: () => null,
}));
vi.mock('../../../src/components/Help/HelpToggleButton', () => ({
  HelpToggleButton: () => <button type="button">help</button>,
}));
vi.mock('../../../src/components/Help/MicroVideoHelpTrigger', () => ({
  MicroVideoHelpTrigger: () => <div data-testid="micro-video-help-trigger" />,
}));
vi.mock('../../../src/components/layout/DemoModeBanner', () => ({
  DemoModeBanner: () => <div data-testid="demo-mode-banner" />,
}));
vi.mock('../../../src/components/layout/GlobalAccessBanners', () => ({
  default: () => <div data-testid="global-access-banners" />,
}));
vi.mock('../../../src/components/layout/NotificationDropdown', () => ({
  NotificationDropdown: () => <div data-testid="notification-dropdown" />,
}));
vi.mock('../../../src/components/layout/UserProfileMenu', () => ({
  UserProfileMenu: () => <div data-testid="user-profile-menu" />,
}));
vi.mock('../../../src/components/LLMSelector', () => ({
  LLMSelector: (props: { compact?: boolean }) => llmSelectorMock(props),
}));
vi.mock('../../../src/components/navigation/BottomNavigation', () => ({
  BottomNavigation: () => <div data-testid="bottom-navigation" />,
}));
vi.mock('../../../src/components/navigation/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));
vi.mock('../../../src/components/Onboarding/OnboardingFirstLoginCTA', () => ({
  OnboardingFirstLoginCTA: () => <div data-testid="onboarding-cta" />,
}));
vi.mock('../../../src/components/SystemHealth', () => ({
  SystemHealth: () => <div data-testid="system-health" />,
}));
vi.mock('../../../src/components/TaskDropdown', () => ({
  TaskDropdown: () => <div data-testid="task-dropdown" />,
}));
vi.mock('../../../src/components/Trial/TrialExpiredGate', () => ({
  TrialExpiredGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { MainLayout } from '../../../src/layouts/MainLayout';

function renderMainLayout() {
  return render(
    <MemoryRouter>
      <MainLayout breadcrumbs={['Home']}>
        <div>content</div>
      </MainLayout>
    </MemoryRouter>
  );
}

describe('MainLayout mobile LLM selector compact continuity', () => {
  beforeEach(() => {
    deviceState.isMobile = true;
    deviceState.safeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 };
    llmSelectorMock.mockClear();
    appState.setIsSidebarOpen.mockReset();
    appState.toggleChatCollapse.mockReset();
    appState.clearChatKickoffMessage.mockReset();
    appState.setChatPanelWidth.mockReset();
    conversationState.setDisplayMode.mockReset();
    conversationState.setWorkspaceContext.mockReset();
    conversationState.expandToFullScreen.mockReset();
  });

  it('passes compact mode to the shared LLM selector on mobile', () => {
    renderMainLayout();

    expect(screen.getByTestId('llm-selector-prop')).toHaveTextContent('compact');
  });

  it('keeps the shared LLM selector in regular mode outside mobile breakpoints', () => {
    deviceState.isMobile = false;

    renderMainLayout();

    expect(screen.getByTestId('llm-selector-prop')).toHaveTextContent('regular');
  });

  it('anchors the global action rail above the mobile bottom navigation strip', () => {
    renderMainLayout();

    expect(screen.getByTestId('global-fab-rail')).toHaveStyle({ bottom: '76px' });
  });

  it('does not expose the deprecated A/B toggle in the global action rail', () => {
    renderMainLayout();

    expect(screen.queryByText('flags')).not.toBeInTheDocument();
  });

  it('includes safe-area inset in the mobile global action rail offset', () => {
    deviceState.safeAreaInsets = { top: 0, bottom: 10, left: 0, right: 0 };

    renderMainLayout();

    expect(screen.getByTestId('global-fab-rail')).toHaveStyle({ bottom: '86px' });
  });

  it('keeps desktop global action rail positioning outside mobile breakpoints', () => {
    deviceState.isMobile = false;

    renderMainLayout();

    expect(screen.getByTestId('global-fab-rail').style.bottom).toBe('');
  });
});
