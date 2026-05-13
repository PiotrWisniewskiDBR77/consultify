import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
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

    expect(screen.getByRole('button', { name: /Risk summary/i })).toBeInTheDocument();
    expect(screen.getByText('Risk summary mocked')).toBeInTheDocument();
  });
});
