/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Sidebar } from '../../../src/components/navigation/Sidebar/Sidebar';
import { AppView } from '../../../src/types';

const appState: any = {
  currentView: AppView.MY_WORK,
  setCurrentView: vi.fn(),
  returnToFullChat: vi.fn(),
  logout: vi.fn(),
  isSidebarOpen: true,
  setIsSidebarOpen: vi.fn(),
  currentUser: { role: 'ADMIN', journeyState: null },
  freeSessionData: {},
  fullSessionData: {},
  theme: 'dark',
  isSidebarCollapsed: false,
  toggleSidebarCollapse: vi.fn(),
  currentProjectId: null,
};

const settingsMenuItem = {
  id: 'SETTINGS',
  label: 'Settings',
  icon: null,
  color: 'slate',
};

const emptyMenuItem = {
  id: 'EMPTY',
  label: 'Empty',
  icon: null,
  color: 'slate',
};

const conversationState: any = {
  setDisplayMode: vi.fn(),
  setWorkspaceContext: vi.fn(),
  activeConversationId: null,
  isSidebarOpen: false,
  toggleSidebar: vi.fn(),
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../src/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ isTablet: false, isMobile: false, isTouchDevice: false }),
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector(appState),
}));

vi.mock('../../../src/store/useConversationStore', () => ({
  useConversationStore: () => conversationState,
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    prefetchRoute: vi.fn(),
  },
}));

vi.mock('../../../src/utils/pilotAccess', () => ({
  dispatchPilotAccessBlocked: vi.fn(),
  getPilotLockedAreaDetail: () => null,
  isPilotAllowedMenuId: () => true,
}));

vi.mock('../../../src/utils/publicProduction', () => ({
  lockMainMenuForPublicProduction: (items: any) => items,
  shouldLockNonCoreModulesInPublicProduction: () => false,
}));

vi.mock('../../../src/utils/roleGuards', () => ({
  isAdminOwnerOrSuperAdminRole: () => true,
  isPilotRestrictedRole: () => false,
  isSuperAdminRole: () => false,
}));

vi.mock('../../../src/components/navigation/Sidebar/menuConfig', () => ({
  getMenuStructure: () => [
    {
      id: 'AI_CHAT',
      label: 'AI Chat',
      icon: null,
      color: 'indigo',
    },
  ],
  getAdminMenuItem: () => emptyMenuItem,
  getInternalToolsMenuItem: () => emptyMenuItem,
  getOrganizationMenuItem: () => emptyMenuItem,
  getSettingsMenuItem: () => settingsMenuItem,
  getSuperAdminMenuItem: () => emptyMenuItem,
  getViewName: () => 'AI Chat',
}));

vi.mock('../../../src/components/navigation/Sidebar/NavItem', () => ({
  NavItem: ({ item, onClick }: any) => (
    <button type="button" data-testid={`nav-item-${item.id}`} onClick={() => onClick(item)}>
      {item.label}
    </button>
  ),
}));

vi.mock('../../../src/components/navigation/Sidebar/FloatingSubmenu', () => ({
  FloatingSubmenu: () => null,
}));

vi.mock('../../../src/components/navigation/Sidebar/SidebarFooter', () => ({
  SidebarFooter: () => null,
}));

vi.mock('../../../src/components/navigation/Sidebar/SidebarHeader', () => ({
  SidebarHeader: () => null,
}));

vi.mock('../../../src/components/PMO/PhaseIndicator', () => ({
  PhaseIndicator: () => null,
}));

describe('Sidebar full chat routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appState.currentView = AppView.MY_WORK;
  });

  it('uses returnToFullChat for AI chat entry', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByTestId('nav-item-AI_CHAT'));

    expect(conversationState.setDisplayMode).toHaveBeenCalledWith('full');
    expect(appState.returnToFullChat).toHaveBeenCalledTimes(1);
  });
});
