import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Api from '@/services/api';
import CustomerAnalyticsView from '@/views/superadmin/customers/CustomerAnalyticsView';
import CustomerComplianceView from '@/views/superadmin/customers/CustomerComplianceView';

vi.mock('@/services/api', () => ({
  default: {
    getComplianceSummary: vi.fn(),
    getUsageByOrganization: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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

describe('Customer analytics and compliance honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render analytics load failures as zero summary metrics', async () => {
    vi.mocked(Api.getUsageByOrganization).mockRejectedValue(new Error('Analytics API down'));

    render(<CustomerAnalyticsView />);

    await waitFor(() => {
      expect(screen.getByText('Customer analytics unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Analytics API down')).toBeInTheDocument();
    expect(screen.queryByText('No analytics data available yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('Organizations')).not.toBeInTheDocument();
  });

  it('does not render compliance load failures as an empty compliance table', async () => {
    vi.mocked(Api.getComplianceSummary).mockRejectedValue(new Error('Compliance API down'));

    render(<CustomerComplianceView />);

    await waitFor(() => {
      expect(screen.getByText('Customer compliance unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Compliance API down')).toBeInTheDocument();
    expect(
      screen.queryByText('superadmin.customers.compliance.table.empty')
    ).not.toBeInTheDocument();
  });

  it('does not render invalid analytics numbers as NaN', async () => {
    vi.mocked(Api.getUsageByOrganization).mockResolvedValue([
      {
        id: 'org-1',
        name: 'Org One',
        ai_calls_30d: 'not-a-number',
        user_count: 'not-a-number',
        health_score: 'not-a-number',
      },
    ]);

    render(<CustomerAnalyticsView />);

    expect(await screen.findByText('Org One')).toBeInTheDocument();
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
    expect(screen.queryByText('NaN%')).not.toBeInTheDocument();
  });

  it('renders invalid compliance audit dates as Unknown date', async () => {
    vi.mocked(Api.getComplianceSummary).mockResolvedValue([
      {
        org_id: 'org-1',
        org_name: 'Org One',
        gdpr_compliant: true,
        dpa_signed: true,
        data_retention_policy: true,
        security_audit_passed: true,
        last_audit_date: 'not-a-date',
      },
    ]);

    render(<CustomerComplianceView />);

    expect(await screen.findByText('Unknown date')).toBeInTheDocument();
  });
});
