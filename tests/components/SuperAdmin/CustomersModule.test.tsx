/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { CustomersModule } from '../../../src/views/superadmin/CustomersModule';
import { Api } from '../../../src/services/api';

vi.mock('../../../src/services/api', () => ({
  Api: {
    getOrganizations: vi.fn(),
    getFeedback: vi.fn(),
  },
}));

vi.mock('../../../src/contexts/HelpContext', () => ({
  useHelpSidePanel: () => ({
    setHelpDocumentIdOverride: vi.fn(),
  }),
}));

vi.mock('../../../src/views/superadmin/OrganizationsView', () => ({
  OrganizationsView: () => <div>Organizations View</div>,
}));

vi.mock('../../../src/views/superadmin/SuperAdminUserManagement', () => ({
  SuperAdminUserManagement: () => <div>Users View</div>,
}));

vi.mock('../../../src/views/superadmin/customers', () => ({
  CustomerLifecycleView: () => <div>Lifecycle View</div>,
  CustomerSuccessPlaybooksView: () => <div>Playbooks View</div>,
  ContractManagementView: () => <div>Contracts View</div>,
  CustomerAnalyticsView: () => <div>Analytics View</div>,
  CustomerAutomationView: () => <div>Automation View</div>,
  CustomerCommunicationView: () => <div>Communication Center View</div>,
  CustomerComplianceView: () => <div>Compliance View</div>,
}));

vi.mock('../../../src/views/superadmin/security/SecurityModuleView', () => ({
  SecurityModuleView: () => <div>Security View</div>,
}));

vi.mock('../../../src/views/superadmin/support/SupportModuleView', () => ({
  SupportModuleView: () => <div>Support View</div>,
}));

vi.mock('../../../src/views/superadmin/SuperAdminFeedbackView', () => ({
  SuperAdminFeedbackView: () => <div>Feedback View</div>,
}));

vi.mock('../../../src/views/superadmin/SuperAdminFeedbackBacklogView', () => ({
  SuperAdminFeedbackBacklogView: () => <div>Feedback Backlog View</div>,
}));

vi.mock('../../../src/views/superadmin/components/BulkOperationsView', () => ({
  BulkOperationsView: () => <div>Bulk Operations View</div>,
}));

describe('CustomersModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getOrganizations).mockResolvedValue([]);
    vi.mocked(Api.getFeedback).mockResolvedValue([]);
  });

  it('renders the communication center when opened through the communication initial tab', async () => {
    render(
      <MemoryRouter>
        <CustomersModule initialTab="communication" />
      </MemoryRouter>
    );

    expect(await screen.findByText('Communication Center View')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Communication' })).toBeInTheDocument();
  });
});
