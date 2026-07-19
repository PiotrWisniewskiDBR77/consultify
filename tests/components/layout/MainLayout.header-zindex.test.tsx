/**
 * @vitest-environment jsdom
 *
 * H2.15 regression — MainLayout header stacking context (M06-UI3).
 *
 * Bug (pre-`24327c288d`): the top header bar (`<div className="h-12 border-b
 * ... flex items-center justify-between ...">` wrapping the breadcrumb + the
 * user profile dropdown trigger) had no explicit stacking context, so on My
 * Work hub screens the profile dropdown painted BEHIND the hub's own tab
 * chrome — visually clipped/unclickable.
 *
 * Fix: the header div gained `relative z-50`, giving it its own stacking
 * context above ordinary in-flow content (hub tab chrome has no explicit
 * z-index, so it stacks at the default `auto` level underneath).
 *
 * This test mounts the real `MainLayout` (mocking only its heavy child
 * components/stores, same pattern as `MainLayout.breadcrumb-a11y.test.tsx`)
 * and asserts the header bar — identified via the breadcrumb `nav` it
 * contains, exactly like the existing a11y test locates it — still carries
 * `relative` + `z-50`. A revert back to the plain `h-12 border-b ...` class
 * string (no `relative`/`z-50`) makes this RED.
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

describe('H2.15 — MainLayout header stacking context (profile dropdown above hub tab chrome)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('the header bar wrapping the breadcrumb (and profile dropdown trigger) has its own stacking context: relative + z-50', () => {
    render(
      <MemoryRouter>
        <MainLayout breadcrumbs={['My Work']}>
          <div>content</div>
        </MainLayout>
      </MemoryRouter>
    );

    const breadcrumbNav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    // Header bar is the breadcrumb nav's immediate containing row
    // (`<div className="relative z-50 h-12 border-b ...">`), one level up
    // from the flex row that directly wraps the nav.
    const headerBar = breadcrumbNav.parentElement?.parentElement;
    expect(headerBar).toBeTruthy();
    expect(headerBar!.className).toContain('relative');
    expect(headerBar!.className).toContain('z-50');
    // Sanity: still the right element (h-12 header row, not some ancestor
    // further up the tree that happens to also have those classes).
    expect(headerBar!.className).toContain('h-12');
  });
});
