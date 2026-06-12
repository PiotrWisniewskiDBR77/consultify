/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppView, UserRole } from '../../../src/types';

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, layout: _layout, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
  },
}));

const deviceState = {
  isTablet: false,
  isMobile: true,
  isTouchDevice: true,
};

vi.mock('../../../src/hooks/useDeviceType', () => ({
  useDeviceType: () => deviceState,
}));

vi.mock('../../../src/routes/routeConfig', () => ({
  getRouteFromAppView: (viewId: string) => `/route/${viewId}`,
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    getPersonalTasks: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../../../src/types/workspace', () => ({
  createWorkspaceContext: vi.fn(() => ({ mock: true })),
  getDefaultWorkspaceType: vi.fn(() => 'task'),
}));

const conversationState = {
  setDisplayMode: vi.fn(),
  setWorkspaceContext: vi.fn(),
  activeConversationId: null as string | null,
  isSidebarOpen: false,
  toggleSidebar: vi.fn(),
};

vi.mock('../../../src/store/useConversationStore', () => ({
  useConversationStore: (selector?: any) =>
    typeof selector === 'function' ? selector(conversationState) : conversationState,
}));

const appState: any = {
  currentView: AppView.MY_WORK,
  setCurrentViewState: vi.fn(),
  logout: vi.fn(),
  isSidebarOpen: true,
  setIsSidebarOpen: vi.fn(),
  currentUser: { role: UserRole.ADMIN, journeyState: undefined as any },
  freeSessionData: {},
  fullSessionData: {},
  theme: 'light',
  isSidebarCollapsed: false,
  toggleSidebarCollapse: vi.fn(),
  currentProjectId: 'project-1',
  navigateWithChatContext: vi.fn(),
};

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector(appState),
}));

vi.mock('../../../src/components/PMO/PhaseIndicator', () => ({
  PhaseIndicator: () => <div data-testid="phase-indicator" />,
}));

vi.mock('../../../src/components/Onboarding/OnboardingChecklist', () => ({
  OnboardingChecklist: () => <div data-testid="onboarding-checklist" />,
}));

vi.mock('../../../src/components/navigation/Sidebar/SidebarHeader', () => ({
  SidebarHeader: () => <div data-testid="sidebar-header" />,
}));

vi.mock('../../../src/components/navigation/Sidebar/SidebarFooter', () => ({
  SidebarFooter: ({ children }: any) => <div data-testid="sidebar-footer">{children}</div>,
}));

vi.mock('../../../src/components/navigation/Sidebar/FloatingSubmenu', () => ({
  FloatingSubmenu: () => <div data-testid="floating-submenu" />,
}));

vi.mock('../../../src/components/navigation/Sidebar/NavItem', () => ({
  NavItem: ({ item, onClick }: any) => (
    <button type="button" data-testid={`navitem-${item.id}`} onClick={() => onClick(item)}>
      {item.label ?? item.id}
    </button>
  ),
}));

vi.mock('../../../src/components/navigation/Sidebar/menuConfig', () => ({
  getMenuStructure: () => [{ id: 'MY_WORK', label: 'My Work', viewId: AppView.MY_WORK }],
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
  }),
  getSettingsMenuItem: () => ({
    id: 'SETTINGS',
    label: 'Settings',
    viewId: AppView.SETTINGS_PROFILE_MODULE,
  }),
  getInternalToolsMenuItem: () => ({
    id: 'INTERNAL_TOOLS',
    label: 'Internal Tools',
    viewId: AppView.AI_OS,
  }),
  getPartnerMenuItem: () => ({
    id: 'PARTNER',
    label: 'Partner',
    viewId: AppView.PARTNER_PORTAL,
  }),
  getViewName: () => 'view',
}));

import { Sidebar } from '../../../src/components/navigation/Sidebar/Sidebar';

describe('Sidebar mobile overlay continuity', () => {
  beforeEach(() => {
    deviceState.isMobile = true;
    deviceState.isTablet = false;
    appState.isSidebarOpen = true;
    appState.setIsSidebarOpen.mockReset();
    appState.setCurrentViewState.mockReset();
    conversationState.setDisplayMode.mockReset();
    conversationState.setWorkspaceContext.mockReset();
    navigateMock.mockReset();
  });

  it('closes the mobile overlay on background click', () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByTestId('mobile-sidebar-overlay'));

    expect(appState.setIsSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('closes the mobile overlay on Escape', () => {
    render(<Sidebar />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(appState.setIsSidebarOpen).toHaveBeenCalledWith(false);
  });
});
