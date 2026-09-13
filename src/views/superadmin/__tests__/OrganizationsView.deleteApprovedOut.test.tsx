/** @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  deleteOrganization: vi.fn(),
  exportOrganizationData: vi.fn(),
  getAccessCodes: vi.fn(),
  getAccessRequests: vi.fn(),
  getOrganizations: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    ...api,
    approveAccessRequest: vi.fn(),
    deactivateAccessCode: vi.fn(),
    generateAccessCode: vi.fn(),
    rejectAccessRequest: vi.fn(),
    updateOrganization: vi.fn(),
  },
}));
vi.mock('react-hot-toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/components/Admin/AdminState', () => ({
  DegradedState: ({ title }: { title: string }) => <div role="alert">{title}</div>,
}));
vi.mock('@/components/MyWork/shared/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
vi.mock('@/components/shared/InfoButton', () => ({ InfoButton: () => null }));
vi.mock('@/views/superadmin/SuperAdminOrgDetailsModal', () => ({
  SuperAdminOrgDetailsModal: () => null,
}));
vi.mock('@/components/standard/StandardTable', () => ({
  StandardTable: ({ columns, data, rowMenu }: any) => (
    <div data-testid="organization-table">
      {data.map((row: any) => {
        const actions = columns.find((column: any) => column.id === 'actions');
        const menu = rowMenu?.(row);
        return (
          <div key={row.id}>
            <span>{row.name}</span>
            {actions?.render?.(row)}
            {menu?.primary?.map((item: any) => (
              <button key={item.id} type="button" onClick={item.onClick} disabled={item.disabled}>
                {item.label}
              </button>
            ))}
            {menu?.destructive?.onClick ? (
              <button type="button" onClick={menu.destructive.onClick}>
                {menu.destructive.label}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  ),
}));

import { OrganizationsView } from '../OrganizationsView';

describe('OrganizationsView destructive execution approved-out boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getOrganizations.mockResolvedValue({
      organizations: [
        {
          id: 'org-a',
          name: 'Organization A',
          plan: 'enterprise',
          status: 'active',
          user_count: 1,
          created_at: '2026-09-01T00:00:00.000Z',
        },
      ],
    });
    api.getAccessRequests.mockResolvedValue({ requests: [] });
    api.getAccessCodes.mockResolvedValue({ codes: [] });
  });

  it('renders the approved policy-pending explanation, no delete action, and keeps Export Data available', async () => {
    render(<OrganizationsView />);

    await screen.findByText('Organization A');
    expect(
      screen.getByText(
        'Automated deletion is disabled until retention and legal-hold rules are approved.'
      )
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export Data' })).toBeEnabled();
    await waitFor(() => expect(api.deleteOrganization).not.toHaveBeenCalled());
  });
});
