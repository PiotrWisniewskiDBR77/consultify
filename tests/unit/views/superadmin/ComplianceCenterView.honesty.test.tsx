import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { ComplianceCenterView } from '@/views/superadmin/ComplianceCenterView';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    getOrganizations: vi.fn().mockResolvedValue([]),
  },
}));

const mockComplianceGet = () => {
  vi.mocked(Api.get).mockImplementation(async (path: string) => {
    if (path === '/superadmin/compliance/frameworks') {
      return { frameworks: [] };
    }
    if (path === '/superadmin/compliance/dsar') {
      throw new Error('DSAR backend down');
    }
    if (path === '/superadmin/compliance/audits') {
      throw new Error('Audit backend down');
    }
    if (path === '/superadmin/compliance/processing-records') {
      throw new Error('Processing records backend down');
    }
    return {};
  });
};

describe('ComplianceCenterView honest data states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getOrganizations).mockResolvedValue([]);
    mockComplianceGet();
  });

  it('does not render fetch failures as empty DSAR, audit, or processing-record states', async () => {
    render(<ComplianceCenterView />);

    await waitFor(() => {
      expect(screen.getByText('Compliance Center')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /DSAR/i }));
    expect(screen.getByText('DSAR requests unavailable')).toBeInTheDocument();
    expect(screen.getByText('DSAR backend down')).toBeInTheDocument();
    expect(screen.queryByText('No data subject requests')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Audits/i }));
    expect(screen.getByText('Compliance audits unavailable')).toBeInTheDocument();
    expect(screen.getByText('Audit backend down')).toBeInTheDocument();
    expect(screen.queryByText('No audits scheduled')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Processing Records/i }));
    expect(screen.getByText('Processing records unavailable')).toBeInTheDocument();
    expect(screen.getByText('Processing records backend down')).toBeInTheDocument();
    expect(screen.queryByText('No processing records')).not.toBeInTheDocument();
  });
});
