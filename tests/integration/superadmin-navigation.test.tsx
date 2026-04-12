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
        activeSection="customers"
        onSectionChange={onSectionChange}
        onLogout={onLogout}
        currentUserEmail="admin@test.com"
      />
    );

    expect(screen.getByText('Tenant & User Ops')).toBeInTheDocument();
    expect(screen.getByText('AI Operations')).toBeInTheDocument();
    expect(screen.getByText('Connector Ops')).toBeInTheDocument();
    expect(screen.getByText('Governance & Compliance')).toBeInTheDocument();
    expect(screen.getByText('Platform Security')).toBeInTheDocument();
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

    fireEvent.click(screen.getByText('Tenant & User Ops'));
    expect(onSectionChange).toHaveBeenCalledWith('customers');

    fireEvent.click(screen.getByText('AI Operations'));
    expect(onSectionChange).toHaveBeenCalledWith('ai-platform');
  });
});
