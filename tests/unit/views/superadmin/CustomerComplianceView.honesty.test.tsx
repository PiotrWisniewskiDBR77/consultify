import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Api from '@/services/api';
import CustomerComplianceView from '@/views/superadmin/customers/CustomerComplianceView';

vi.mock('@/services/api', () => ({
  default: {
    getComplianceSummary: vi.fn(),
  },
}));

vi.mock('@/components/Admin/AdminState', () => ({
  DegradedState: ({ title, description }: { title: string; description: string }) => (
    <div role="alert">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => <span data-testid="info-button" />,
}));

describe('CustomerComplianceView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed compliance loads as an empty table', async () => {
    vi.mocked(Api.getComplianceSummary).mockRejectedValue(new Error('Compliance API down'));

    render(<CustomerComplianceView />);

    await waitFor(() => {
      expect(screen.getByText('Customer compliance unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Compliance API down')).toBeInTheDocument();
    expect(screen.queryByText('superadmin.customers.compliance.table.empty')).not.toBeInTheDocument();
  });

  it('accepts deeply wrapped compliance summary payloads and safe booleans', async () => {
    vi.mocked(Api.getComplianceSummary).mockResolvedValue({
      data: {
        data: {
          items: [
            {
              org_id: 'org-1',
              org_name: 'Acme',
              gdpr_compliant: 'false',
              dpa_signed: 'true',
              data_retention_policy: 1,
              security_audit_passed: true,
              last_audit_date: 'not-a-date',
            },
          ],
        },
      },
    });

    render(<CustomerComplianceView />);

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
    expect(screen.queryByText('Customer compliance unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed compliance payloads as an empty compliance table', async () => {
    vi.mocked(Api.getComplianceSummary).mockResolvedValue({ unexpected: true });

    render(<CustomerComplianceView />);

    await waitFor(() => {
      expect(screen.getByText('Customer compliance unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Compliance summary response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('superadmin.customers.compliance.table.empty')).not.toBeInTheDocument();
  });
});
