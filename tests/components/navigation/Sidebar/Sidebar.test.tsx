import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { AppView, UserRole } from '../../../../src/types';

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

const deviceState = {
  isTablet: false,
  isMobile: false,
  isTouchDevice: false,
};
vi.mock('../../../../src/hooks/useDeviceType', () => ({
  useDeviceType: () => deviceState,
}));

const routeFromViewMock = vi.fn((viewId: any) => `/route/${String(viewId)}`);
vi.mock('../../../../src/routes/routeConfig', () => ({
  getRouteFromAppView: (viewId: any) => routeFromViewMock(viewId),
}));

const createWorkspaceContextMock = vi.fn(() => ({ mock: true }));
const getDefaultWorkspaceTypeMock = vi.fn(() => 'default');
vi.mock('../../../../src/types/workspace', () => ({
  createWorkspaceContext: (...args: any[]) => createWorkspaceContextMock(...args),
  getDefaultWorkspaceType: (...args: any[]) => getDefaultWorkspaceTypeMock(...args),
}));

const conversationState = {
  setDisplayMode: vi.fn(),
  setWorkspaceContext: vi.fn(),
  activeConversationId: null as string | null,
  isSidebarOpen: false,
  toggleSidebar: vi.fn(),
};
vi.mock('../../../../src/store/useConversationStore', () => ({
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
  isChatSlidingPanelOpen: false,
  toggleChatSlidingPanel: vi.fn(),
  currentProjectId: 'project-1',
};
vi.mock('../../../../src/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector(appState),
}));

vi.mock('../../../../src/components/PMO/PhaseIndicator', () => ({
  PhaseIndicator: () => <div data-testid="phase-indicator" />,
}));
vi.mock('../../../../src/components/Onboarding/OnboardingChecklist', () => ({
  OnboardingChecklist: () => <div data-testid="onboarding-checklist" />,
}));

vi.mock('../../../../src/components/navigation/Sidebar/SidebarHeader', () => ({
  SidebarHeader: () => <div data-testid="sidebar-header" />,
}));

vi.mock('../../../../src/components/navigation/Sidebar/SidebarFooter', () => ({
  SidebarFooter: ({ children, onNavigate }: any) => (
    <div data-testid="sidebar-footer">
      <button
        type="button"
        data-testid="sidebarfooter-nav"
        onClick={() => onNavigate(AppView.MY_WORK)}
      >
        footer-nav
      </button>
      {children}
    </div>
  ),
}));

vi.mock('../../../../src/components/navigation/Sidebar/FloatingSubmenu', () => ({
  FloatingSubmenu: ({ title, onNavigate, onClose, onMouseEnter, onMouseLeave }: any) => (
    <div data-testid="floating-submenu" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div>{title}</div>
      <button type="button" onClick={() => onNavigate(AppView.MY_WORK)}>
        flyout-nav
      </button>
      <button type="button" onClick={() => onClose()}>
        flyout-close
      </button>
    </div>
  ),
}));

vi.mock('../../../../src/components/navigation/Sidebar/NavItem', () => ({
  NavItem: ({ item, onClick, onMouseEnter, onMouseLeave, getViewName }: any) => (
    <button
      type="button"
      data-testid={`navitem-${item.id}`}
      onClick={() => {
        if (typeof getViewName === 'function') getViewName(item.viewId ?? AppView.MY_WORK);
        onClick(item);
      }}
      onMouseEnter={(e) => onMouseEnter?.(e, item)}
      onMouseLeave={() => onMouseLeave?.()}
    >
      {item.label ?? item.id}
    </button>
  ),
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
    { id: 'NO_VIEW', label: 'NoView' },
    {
      id: 'HAS_SUB',
      label: 'HasSub',
      subItems: [{ id: 'SUB1', label: 'Sub1', viewId: AppView.MY_WORK }],
      viewId: AppView.MY_WORK,
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
  }),
  getSettingsMenuItem: () => ({
    id: 'SETTINGS',
    label: 'Settings',
    viewId: AppView.SETTINGS_PROFILE_MODULE,
  }),
  getViewName: (_view: any, _t: any) => 'view',
}));

import { Sidebar } from '../../../../src/components/navigation/Sidebar/Sidebar';

describe('Sidebar (L2)', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    routeFromViewMock.mockClear();
    createWorkspaceContextMock.mockClear();
    getDefaultWorkspaceTypeMock.mockClear();
    conversationState.setDisplayMode.mockClear();
    conversationState.setWorkspaceContext.mockClear();
    conversationState.toggleSidebar.mockClear();
    appState.setCurrentViewState.mockClear();
    appState.setIsSidebarOpen.mockClear();
    appState.toggleChatSlidingPanel.mockClear();
    deviceState.isMobile = false;
    deviceState.isTablet = false;
    appState.isSidebarCollapsed = false;
    appState.isSidebarOpen = true;
    appState.currentUser = { role: UserRole.ADMIN, journeyState: undefined };
    appState.currentView = AppView.MY_WORK;
    appState.freeSessionData = {
      step1Completed: false,
      step2Completed: false,
      step3Completed: false,
    };
    appState.fullSessionData = {
      step1Completed: false,
      step2Completed: false,
      step3Completed: false,
      step4Completed: false,
      step5Completed: false,
    };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.log as any).mockRestore?.();
    (console.warn as any).mockRestore?.();
    (console.error as any).mockRestore?.();
  });

  it('renders footer items for ADMIN and navigates on click', () => {
    render(<Sidebar />);

    expect(screen.getByTestId('navitem-ORGANIZATION')).toBeInTheDocument();
    expect(screen.getByTestId('navitem-ADMIN')).toBeInTheDocument();
    expect(screen.getByTestId('navitem-SETTINGS')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('navitem-ORGANIZATION'));

    expect(conversationState.setDisplayMode).toHaveBeenCalledWith('split');
    expect(appState.setCurrentViewState).toHaveBeenCalledWith(AppView.ORGANIZATION_PROFILE);
    expect(navigateMock).toHaveBeenCalledWith(`/route/${String(AppView.ORGANIZATION_PROFILE)}`);
  });

  it('AI_CHAT click navigates to full chat when not already on chat', () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByTestId('navitem-AI_CHAT'));

    expect(conversationState.setDisplayMode).toHaveBeenCalledWith('full');
    expect(appState.setCurrentViewState).toHaveBeenCalledWith(AppView.AI_CHAT);
    expect(navigateMock).toHaveBeenCalledWith(`/route/${String(AppView.AI_CHAT)}`);
    expect(conversationState.toggleSidebar).not.toHaveBeenCalled();
  });

  it('AI_CHAT click toggles panel when already on chat (no navigation)', () => {
    appState.currentView = AppView.AI_CHAT;
    render(<Sidebar />);

    fireEvent.click(screen.getByTestId('navitem-AI_CHAT'));

    expect(conversationState.toggleSidebar).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('blocks navigation for locked items when requiresView not completed and user is not privileged', () => {
    appState.currentUser = { role: UserRole.USER, journeyState: undefined };
    render(<Sidebar />);

    fireEvent.click(screen.getByTestId('navitem-LOCKED'));

    expect(navigateMock).not.toHaveBeenCalled();
    expect(appState.setCurrentViewState).not.toHaveBeenCalled();
  });

  it('closes sidebar on mobile after navigating to a view', () => {
    deviceState.isMobile = true;
    render(<Sidebar />);

    fireEvent.click(screen.getByTestId('navitem-SETTINGS'));
    expect(appState.setIsSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('mobile overlay click closes sidebar', () => {
    deviceState.isMobile = true;
    appState.isSidebarOpen = true;
    render(<Sidebar />);

    const overlay = document.querySelector('div[class*="bg-navy-950/80"]') as HTMLElement | null;
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay!);

    expect(appState.setIsSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('shows floating submenu when collapsed and item has subItems, and flyout navigation works', () => {
    appState.isSidebarCollapsed = true; // showFull=false
    (window as any).innerWidth = 800;
    render(<Sidebar />);

    fireEvent.mouseEnter(screen.getByTestId('navitem-HAS_SUB'));
    expect(screen.getByTestId('floating-submenu')).toBeInTheDocument();

    fireEvent.click(screen.getByText('flyout-nav'));

    expect(conversationState.setDisplayMode).toHaveBeenCalledWith('split');
    expect(appState.setIsSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('floating submenu can be closed', () => {
    appState.isSidebarCollapsed = true;
    render(<Sidebar />);

    fireEvent.mouseEnter(screen.getByTestId('navitem-HAS_SUB'));
    expect(screen.getByTestId('floating-submenu')).toBeInTheDocument();

    fireEvent.click(screen.getByText('flyout-close'));
    expect(screen.queryByTestId('floating-submenu')).not.toBeInTheDocument();
  });

  it('computes completed views when steps are completed', () => {
    appState.freeSessionData = { step1Completed: true, step2Completed: true, step3Completed: true };
    appState.fullSessionData = {
      step1Completed: true,
      step2Completed: true,
      step3Completed: true,
      step4Completed: true,
      step5Completed: true,
    };
    render(<Sidebar />);
    expect(screen.getByTestId('navitem-AI_CHAT')).toBeInTheDocument();
  });

  it('handles navigation errors gracefully', () => {
    navigateMock.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    render(<Sidebar />);
    fireEvent.click(screen.getByTestId('navitem-SETTINGS'));
    expect(navigateMock).toHaveBeenCalled();
  });

  it('logs invalid items (no viewId) instead of navigating', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByTestId('navitem-NO_VIEW'));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('clears floating submenu when hovering item without submenu in expanded mode', () => {
    appState.isSidebarCollapsed = false; // showFull=true
    render(<Sidebar />);

    fireEvent.mouseEnter(screen.getByTestId('navitem-HAS_SUB'));
    expect(screen.getByTestId('floating-submenu')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('navitem-AI_CHAT'));
    expect(screen.queryByTestId('floating-submenu')).not.toBeInTheDocument();
  });

  it('footer navigation callback triggers navigateToView', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByTestId('sidebarfooter-nav'));
    expect(conversationState.setDisplayMode).toHaveBeenCalledWith('split');
    expect(navigateMock).toHaveBeenCalledWith(`/route/${String(AppView.MY_WORK)}`);
  });

  it('auto-closes floating submenu on mouse leave timeout', async () => {
    vi.useFakeTimers();
    appState.isSidebarCollapsed = true;
    render(<Sidebar />);

    fireEvent.mouseEnter(screen.getByTestId('navitem-HAS_SUB'));
    expect(screen.getByTestId('floating-submenu')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByTestId('navitem-HAS_SUB'));
    await vi.advanceTimersByTimeAsync(200);

    await waitFor(() => {
      expect(screen.queryByTestId('floating-submenu')).not.toBeInTheDocument();
    });
    vi.useRealTimers();
  });

  it('keeps floating submenu open when flyout is hovered', async () => {
    vi.useFakeTimers();
    appState.isSidebarCollapsed = true;
    render(<Sidebar />);

    fireEvent.mouseEnter(screen.getByTestId('navitem-HAS_SUB'));
    expect(screen.getByTestId('floating-submenu')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByTestId('navitem-HAS_SUB'));
    fireEvent.mouseEnter(screen.getByTestId('floating-submenu'));
    await vi.advanceTimersByTimeAsync(200);
    expect(screen.getByTestId('floating-submenu')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByTestId('floating-submenu'));
    await vi.advanceTimersByTimeAsync(200);
    await waitFor(() => {
      expect(screen.queryByTestId('floating-submenu')).not.toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('applies correct translate class when sidebar is closed on mobile vs tablet', () => {
    // Mobile closed -> off-canvas
    deviceState.isMobile = true;
    deviceState.isTablet = false;
    appState.isSidebarOpen = false;
    const { unmount } = render(<Sidebar />);
    const sidebar = document.querySelector('[data-tour="sidebar-nav"]') as HTMLElement;
    expect(sidebar.className).toContain('-translate-x-full');
    unmount();

    // Tablet closed -> stays visible
    deviceState.isMobile = false;
    deviceState.isTablet = true;
    appState.isSidebarOpen = false;
    render(<Sidebar />);
    const sidebarTablet = document.querySelector('[data-tour="sidebar-nav"]') as HTMLElement;
    expect(sidebarTablet.className).toContain('translate-x-0');
  });

  it('shows floating submenu even for items without subItems when sidebar is collapsed', () => {
    appState.isSidebarCollapsed = true; // showFull=false => shouldShow=true even if no subItems
    render(<Sidebar />);

    fireEvent.mouseEnter(screen.getByTestId('navitem-NO_VIEW'));
    expect(screen.getByTestId('floating-submenu')).toBeInTheDocument();
    expect(within(screen.getByTestId('floating-submenu')).getByText('NoView')).toBeInTheDocument();
  });

  it('does not close sidebar on flyout navigation when window is wide', () => {
    appState.isSidebarCollapsed = true; // showFull=false
    (window as any).innerWidth = 1200;
    render(<Sidebar />);

    fireEvent.mouseEnter(screen.getByTestId('navitem-HAS_SUB'));
    expect(screen.getByTestId('floating-submenu')).toBeInTheDocument();

    fireEvent.click(screen.getByText('flyout-nav'));
    expect(appState.setIsSidebarOpen).not.toHaveBeenCalled();
  });
});
