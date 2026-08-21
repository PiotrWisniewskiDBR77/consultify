import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { AppView, UserRole } from '../../../../src/types';

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('react-dom', async () => {
  const actual: any = await vi.importActual('react-dom');
  return { ...actual, createPortal: (node: any) => node };
});

vi.mock('framer-motion', () => {
  const React = require('react');

  const stripMotionProps = (props: any) => {
    const {
      layout,
      layoutId,
      variants,
      initial,
      animate,
      exit,
      transition,
      whileTap,
      whileHover,
      ...rest
    } = props || {};
    return rest;
  };

  return {
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: {
      div: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <div ref={ref} {...stripMotionProps(props)}>
          {children}
        </div>
      )),
      button: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <button ref={ref} {...stripMotionProps(props)}>
          {children}
        </button>
      )),
      span: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <span ref={ref} {...stripMotionProps(props)}>
          {children}
        </span>
      )),
    },
  };
});

const deviceState = { isTablet: false, isMobile: false, isTouchDevice: false };
vi.mock('../../../../src/hooks/useDeviceType', () => ({
  useDeviceType: () => deviceState,
}));

vi.mock('../../../../src/routes/routeConfig', () => ({
  getRouteFromAppView: (viewId: any) => `/route/${String(viewId)}`,
}));

vi.mock('../../../../src/types/workspace', () => ({
  createWorkspaceContext: () => ({ mock: true }),
  getDefaultWorkspaceType: () => 'default',
}));

const conversationState: any = {
  setDisplayMode: vi.fn(),
  setWorkspaceContext: vi.fn(),
  activeConversationId: null,
  isSidebarOpen: false,
  toggleSidebar: vi.fn(),
};
vi.mock('../../../../src/store/useConversationStore', () => ({
  useConversationStore: (selector?: any) =>
    typeof selector === 'function' ? selector(conversationState) : conversationState,
}));

const appState: any = {
  currentView: AppView.MY_WORK,
  setCurrentView: vi.fn(),
  setCurrentViewState: vi.fn(),
  logout: vi.fn(),
  isSidebarOpen: true,
  setIsSidebarOpen: vi.fn(),
  currentUser: { role: UserRole.ADMIN, journeyState: undefined },
  freeSessionData: {},
  fullSessionData: {},
  theme: 'light',
  isSidebarCollapsed: false,
  toggleSidebarCollapse: vi.fn(),
  isChatSlidingPanelOpen: false,
  toggleChatSlidingPanel: vi.fn(),
  currentProjectId: 'project-1',
  navigateWithChatContext: vi.fn(),
};
vi.mock('../../../../src/store/useAppStore', () => ({
  useAppStore: (selector?: any) => (typeof selector === 'function' ? selector(appState) : appState),
}));

vi.mock('../../../../src/components/PMO/PhaseIndicator', () => ({
  PhaseIndicator: () => <div data-testid="phase-indicator" />,
}));
vi.mock('../../../../src/components/Onboarding/OnboardingChecklist', () => ({
  OnboardingChecklist: () => <div data-testid="onboarding-checklist" />,
}));

vi.mock('../../../../src/components/navigation/Sidebar/menuConfig', () => ({
  getMenuStructure: () => [
    { id: 'AI_CHAT', label: 'Chat', viewId: AppView.AI_CHAT },
    {
      id: 'LOCKED',
      label: 'Locked',
      viewId: AppView.FULL_STEP3_ROADMAP,
      requiresView: AppView.FULL_STEP1_ASSESSMENT,
    },
  ],
  getOrganizationMenuItem: () => ({
    id: 'ORGANIZATION',
    label: 'Organization',
    viewId: AppView.ORGANIZATION_PROFILE,
  }),
  getAdminMenuItem: () => ({ id: 'ADMIN', label: 'Admin', viewId: AppView.ADMIN_DASHBOARD }),
  getSuperAdminMenuItem: () => ({
    id: 'SUPERADMIN',
    label: 'SuperAdmin',
    viewId: AppView.SUPERADMIN_OVERVIEW,
    subItems: [{ id: 'SA1', label: 'SA1', viewId: AppView.SUPERADMIN_OVERVIEW }],
  }),
  getSettingsMenuItem: () => ({
    id: 'SETTINGS',
    label: 'Settings',
    viewId: AppView.SETTINGS_PROFILE_MODULE,
  }),
  getInternalToolsMenuItem: () => ({
    id: 'INTERNAL_TOOLS',
    label: 'Internal Tools',
    viewId: AppView.AI_CHAT,
  }),
  getViewName: () => 'view',
}));

import { Sidebar } from '../../../../src/components/navigation/Sidebar/Sidebar';

describe('Sidebar (L2, real subcomponents)', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    conversationState.setDisplayMode.mockClear();
    conversationState.setWorkspaceContext.mockClear();
    conversationState.toggleSidebar.mockClear();
    appState.setCurrentView.mockClear();
    appState.setCurrentViewState.mockClear();
    appState.setIsSidebarOpen.mockClear();
    appState.toggleChatSlidingPanel.mockClear();
    appState.isSidebarCollapsed = false;
    appState.isSidebarOpen = true;
    appState.currentUser = { role: UserRole.ADMIN, journeyState: undefined };
    appState.currentView = AppView.MY_WORK;
    appState.freeSessionData = {};
    appState.fullSessionData = {};
    deviceState.isMobile = false;
    deviceState.isTablet = false;
  });

  it('renders footer actions + Partners for every authenticated role and hides Internal Tools', () => {
    appState.currentUser = { role: 'SUPERADMIN', journeyState: undefined };
    render(<Sidebar />);

    // Footer children are real NavItem buttons (label rendered in expanded mode)
    fireEvent.click(screen.getByRole('button', { name: /Organization/i }));
    expect(conversationState.setDisplayMode).toHaveBeenCalledWith('split');
    expect(appState.navigateWithChatContext).toHaveBeenCalledWith(
      AppView.ORGANIZATION_PROFILE,
      expect.objectContaining({ preserveChat: true })
    );
    fireEvent.click(screen.getByRole('button', { name: /Partners/i }));
    expect(appState.navigateWithChatContext).toHaveBeenCalledWith(
      AppView.PARTNER_LANDING,
      expect.objectContaining({ preserveChat: true })
    );
    expect(screen.queryByText(/Internal Tools/i)).not.toBeInTheDocument();
  });

  it('AI_CHAT toggles panel when already on chat (no navigation)', () => {
    appState.currentView = AppView.AI_CHAT;
    render(<Sidebar />);

    fireEvent.click(screen.getByRole('button', { name: /Chat/i }));
    expect(conversationState.toggleSidebar).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('locked menu item does not navigate for non-admin users', () => {
    appState.currentUser = { role: UserRole.USER, journeyState: undefined };
    render(<Sidebar />);

    const locked = screen.getByRole('button', { name: /Locked/i });
    fireEvent.click(locked);
    expect(appState.setCurrentView).not.toHaveBeenCalled();
  });
});
