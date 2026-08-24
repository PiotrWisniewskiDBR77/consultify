import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdminSecurityIdentityPanel } from '@/components/Admin/AdminSecurityIdentityPanel';

vi.mock('@/views/admin/ApiKeysManagementView', () => ({
  ApiKeysManagementView: () => <div>API access mocked</div>,
}));

vi.mock('@/components/Admin/AdminSecurityPolicyPanel', () => ({
  AdminSecurityPolicyPanel: () => <div>Security policy mocked</div>,
}));

vi.mock('@/components/Admin/AdminCollaborationControlsPanel', () => ({
  AdminCollaborationControlsPanel: () => <div>Collaboration mocked</div>,
}));

vi.mock('@/components/Admin/AdminIamPolicyPanel', () => ({
  AdminIamPolicyPanel: () => <div>IAM mocked</div>,
}));

vi.mock('@/components/Admin/AdminScimLifecyclePanel', () => ({
  AdminScimLifecyclePanel: () => <div>SCIM mocked</div>,
}));

vi.mock('@/components/Admin/AdminRiskSummaryPanel', () => ({
  AdminRiskSummaryPanel: () => <div>Risk summary mocked</div>,
}));

describe('AdminSecurityIdentityPanel', () => {
  it('exposes tenant risk summary as a security hub tab', () => {
    render(
      <MemoryRouter initialEntries={['/admin/security?tab=risk']}>
        <AdminSecurityIdentityPanel />
      </MemoryRouter>
    );

    expect(screen.getByRole('tab', { name: /Risk summary/i })).toBeInTheDocument();
    expect(screen.getByText('Risk summary mocked')).toBeInTheDocument();
  });

  it('implements an accessible keyboard-navigable tab contract', () => {
    render(
      <MemoryRouter initialEntries={['/admin/security']}>
        <AdminSecurityIdentityPanel />
      </MemoryRouter>
    );

    const tablist = screen.getByRole('tablist', { name: /Security and identity sections/i });
    const tabs = screen.getAllByRole('tab');
    expect(tablist).toContainElement(tabs[0]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');

    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', tabs[1].id);

    fireEvent.keyDown(tabs[1], { key: 'End' });
    expect(tabs[tabs.length - 1]).toHaveFocus();
  });

  describe('initialTab prop (Admin komplet 55, Fala 1)', () => {
    it('opens on the tab requested by the caller when no ?tab= is present', () => {
      render(
        <MemoryRouter initialEntries={['/admin/security/scim-lifecycle']}>
          <AdminSecurityIdentityPanel initialTab="scim" />
        </MemoryRouter>
      );

      expect(screen.getByRole('tab', { name: /SCIM & lifecycle/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByText('SCIM mocked')).toBeInTheDocument();
    });

    it('lets an explicit ?tab= query param win over initialTab', () => {
      render(
        <MemoryRouter initialEntries={['/admin/security/scim-lifecycle?tab=risk']}>
          <AdminSecurityIdentityPanel initialTab="scim" />
        </MemoryRouter>
      );

      expect(screen.getByRole('tab', { name: /Risk summary/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByText('Risk summary mocked')).toBeInTheDocument();
    });
  });
});
