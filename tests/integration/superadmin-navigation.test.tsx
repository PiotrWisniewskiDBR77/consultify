/**
 * L2: SuperAdminSidebar interaction (honest jsdom integration)
 */

/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: vi.fn(() => ({
    isSidebarCollapsed: false,
    toggleSidebarCollapse: vi.fn(),
    currentView: 'SUPERADMIN_OVERVIEW',
    setCurrentView: vi.fn(),
  })),
}));

vi.mock('../../src/services/api', () => ({
  Api: {
    getAccessRequests: vi.fn().mockResolvedValue([]),
  },
}));

import { SuperAdminSidebar } from '../../src/components/layout/SuperAdminSidebar';

describe('SuperAdminSidebar', () => {
  const onSectionChange = vi.fn();
  const onLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders main navigation items', () => {
    render(
      <SuperAdminSidebar
        activeSection="overview"
        onSectionChange={onSectionChange}
        onLogout={onLogout}
        currentUserEmail="admin@test.com"
      />
    );

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('AI Platform')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Configuration')).toBeInTheDocument();
  });

  it('calls onSectionChange on click', () => {
    render(
      <SuperAdminSidebar
        activeSection="customers"
        onSectionChange={onSectionChange}
        onLogout={onLogout}
        currentUserEmail="admin@test.com"
      />
    );

    fireEvent.click(screen.getByText('Overview'));
    expect(onSectionChange).toHaveBeenCalledWith('overview');

    fireEvent.click(screen.getByText('AI Platform'));
    expect(onSectionChange).toHaveBeenCalledWith('ai-platform');
  });
});
