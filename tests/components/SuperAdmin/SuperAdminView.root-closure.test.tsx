/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SuperAdminView } from '../../../src/views/superadmin/SuperAdminView';

const h = vi.hoisted(() => ({
  setCurrentView: vi.fn(),
  logout: vi.fn(),
  overviewView: 'SUPERADMIN_OVERVIEW',
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    isSidebarCollapsed: false,
    currentView: h.overviewView,
    setCurrentView: h.setCurrentView,
    logout: h.logout,
  }),
}));

vi.mock('../../../src/components/documents/DocumentSidePanel', () => ({
  DocumentSidePanel: () => <div>DocumentSidePanel</div>,
}));
vi.mock('../../../src/components/documents/DocumentToggleButton', () => ({
  DocumentToggleButton: () => <button type="button">DocumentToggleButton</button>,
}));
vi.mock('../../../src/components/Feedback/FeedbackSidePanel', () => ({
  FeedbackSidePanel: () => <div>FeedbackSidePanel</div>,
}));
vi.mock('../../../src/components/Feedback/FeedbackToggleButton', () => ({
  FeedbackToggleButton: () => <button type="button">FeedbackToggleButton</button>,
}));
vi.mock('../../../src/components/Help/HelpSidePanel', () => ({
  HelpSidePanel: () => <div>HelpSidePanel</div>,
}));
vi.mock('../../../src/components/Help/HelpToggleButton', () => ({
  HelpToggleButton: () => <button type="button">HelpToggleButton</button>,
}));
vi.mock('../../../src/components/layout/SuperAdminSidebar', () => ({
  SuperAdminSidebar: () => <div>SuperAdminSidebar</div>,
  appViewToSection: { [h.overviewView]: 'overview' },
  sectionToAppView: { overview: h.overviewView },
}));
vi.mock('../../../src/components/layout/UserProfileMenu', () => ({
  UserProfileMenu: () => <div>UserProfileMenu</div>,
}));
vi.mock('../../../src/components/settings/FeatureFlagsDevToolsToggleButton', () => ({
  FeatureFlagsDevToolsToggleButton: () => <button type="button">FeatureFlagsDevToolsToggleButton</button>,
}));
vi.mock('../../../src/components/SuperAdmin/SuperAdminSignalCenter', () => ({
  SuperAdminSignalCenter: () => <div>SuperAdminSignalCenter</div>,
}));
vi.mock('../../../src/components/SuperAdmin/SuperAdminStatusIndicators', () => ({
  SuperAdminStatusIndicators: () => <div>SuperAdminStatusIndicators</div>,
}));

vi.mock('../../../src/views/superadmin/OverviewModule', () => ({
  OverviewModule: () => <div>OverviewModule</div>,
}));
vi.mock('../../../src/views/superadmin/CustomersModule', () => ({
  CustomersModule: () => <div>CustomersModule</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/AIPlatformModule', () => ({
  AIPlatformModule: () => <div>AIPlatformModule</div>,
}));
vi.mock('../../../src/views/superadmin/AnalyticsModuleView', () => ({
  AnalyticsModuleView: () => <div>AnalyticsModuleView</div>,
}));
vi.mock('../../../src/views/superadmin/ConfigurationModule', () => ({
  ConfigurationModule: () => <div>ConfigurationModule</div>,
}));
vi.mock('../../../src/views/superadmin/ContentModule', () => ({
  ContentModule: () => <div>ContentModule</div>,
}));
vi.mock('../../../src/views/superadmin/RevenueModule', () => ({
  RevenueModule: () => <div>RevenueModule</div>,
}));
vi.mock('../../../src/views/superadmin/SecurityModule', () => ({
  SecurityModule: () => <div>SecurityModule</div>,
}));
vi.mock('../../../src/views/superadmin/SystemModule', () => ({
  SystemModule: () => <div>SystemModule</div>,
}));
vi.mock('../../../src/views/superadmin/VirtualWorkersModule', () => ({
  VirtualWorkersModule: () => <div>VirtualWorkersModule</div>,
}));

describe('SuperAdminView root closure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the visible platform control plane canon in the shell', async () => {
    render(
      <SuperAdminView
        currentUser={{ id: 'user-1', email: 'root@example.com' } as any}
        onNavigate={vi.fn()}
      />
    );

    expect(await screen.findByText('One visible platform control plane')).toBeInTheDocument();
    expect(screen.getByText('Super Admin Console')).toBeInTheDocument();
    expect(screen.getByText('OverviewModule')).toBeInTheDocument();
  });
});
