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
    post: vi.fn(),
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

  it('does not render framework load failures as zero compliance or no-frameworks state', async () => {
    vi.mocked(Api.get).mockImplementation(async (path: string) => {
      if (path === '/superadmin/compliance/frameworks') {
        throw new Error('Framework backend down');
      }
      if (path === '/superadmin/compliance/dsar') {
        return { requests: [] };
      }
      if (path === '/superadmin/compliance/audits') {
        return { audits: [] };
      }
      if (path === '/superadmin/compliance/processing-records') {
        return { records: [] };
      }
      return {};
    });

    render(<ComplianceCenterView />);

    await waitFor(() => {
      expect(screen.getAllByText('Framework source unavailable').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('Compliance frameworks unavailable')).toBeInTheDocument();
    expect(screen.getAllByText('Framework backend down').length).toBeGreaterThan(0);
    expect(screen.queryByText('No compliance frameworks')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Frameworks/i }));
    expect(screen.getByText('Compliance frameworks unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No compliance frameworks')).not.toBeInTheDocument();
  });

  it('refetches DSAR, audit, and processing records after successful creates', async () => {
    let dsarLoads = 0;
    let auditLoads = 0;
    let recordLoads = 0;

    vi.mocked(Api.get).mockImplementation(async (path: string) => {
      if (path === '/superadmin/compliance/frameworks') {
        return { frameworks: [] };
      }
      if (path === '/superadmin/compliance/dsar') {
        dsarLoads += 1;
        return dsarLoads > 1
          ? {
              requests: [
                {
                  id: 'dsar-1',
                  requesterEmail: 'privacy@example.com',
                  requestType: 'access',
                  status: 'pending',
                  receivedAt: '2026-04-26T10:00:00.000Z',
                  dueDate: '2026-05-26T10:00:00.000Z',
                },
              ],
            }
          : { requests: [] };
      }
      if (path === '/superadmin/compliance/audits') {
        auditLoads += 1;
        return auditLoads > 1
          ? {
              audits: [
                {
                  id: 'audit-1',
                  name: 'SOC 2 readiness',
                  frameworkId: 'soc2',
                  auditType: 'internal',
                  status: 'planned',
                  plannedStart: '2026-05-01T00:00:00.000Z',
                  plannedEnd: '2026-05-15T00:00:00.000Z',
                  findingsCount: 0,
                },
              ],
            }
          : { audits: [] };
      }
      if (path === '/superadmin/compliance/processing-records') {
        recordLoads += 1;
        return recordLoads > 1
          ? {
              records: [
                {
                  id: 'record-1',
                  name: 'Customer support data',
                  purpose: 'Support',
                  data_categories: 'Contact data',
                  legal_basis: 'legitimate_interest',
                  retention_period: '24 months',
                  status: 'active',
                  created_at: '2026-04-26T10:00:00.000Z',
                },
              ],
            }
          : { records: [] };
      }
      return {};
    });
    vi.mocked(Api.post).mockImplementation(async (path: string) => {
      if (path === '/superadmin/compliance/dsar') {
        return { request: { id: 'dsar-1' } };
      }
      if (path === '/superadmin/compliance/audits') {
        return { audit: { id: 'audit-1' } };
      }
      if (path === '/superadmin/compliance/processing-records') {
        return { record: { id: 'record-1' } };
      }
      return { success: true };
    });

    render(<ComplianceCenterView />);

    await waitFor(() => {
      expect(screen.getByText('Compliance Center')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /DSAR/i }));
    fireEvent.click(screen.getByRole('button', { name: /New Request/i }));
    fireEvent.change(screen.getByPlaceholderText('requester@example.com'), {
      target: { value: 'privacy@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Request/i }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/superadmin/compliance/dsar', expect.any(Object));
      expect(screen.getByText('privacy@example.com')).toBeInTheDocument();
    });
    expect(dsarLoads).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: /Audits/i }));
    fireEvent.click(screen.getByRole('button', { name: /Schedule Audit/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Q1 2026 SOC 2 Audit'), {
      target: { value: 'SOC 2 readiness' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Schedule$/i }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/superadmin/compliance/audits', expect.any(Object));
      expect(screen.getByText('SOC 2 readiness')).toBeInTheDocument();
    });
    expect(auditLoads).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: /Processing Records/i }));
    fireEvent.click(screen.getByRole('button', { name: /Add Processing Record/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Customer Data Processing'), {
      target: { value: 'Customer support data' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Add Record$/i }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith(
        '/superadmin/compliance/processing-records',
        expect.any(Object)
      );
      expect(screen.getByText('Customer support data')).toBeInTheDocument();
    });
    expect(recordLoads).toBeGreaterThanOrEqual(2);
  });

  it('keeps DSAR create modal open when read-back does not confirm the new request', async () => {
    vi.mocked(Api.get).mockImplementation(async (path: string) => {
      if (path === '/superadmin/compliance/frameworks') {
        return { frameworks: [] };
      }
      if (path === '/superadmin/compliance/dsar') {
        return { requests: [] };
      }
      if (path === '/superadmin/compliance/audits') {
        return { audits: [] };
      }
      if (path === '/superadmin/compliance/processing-records') {
        return { records: [] };
      }
      return {};
    });
    vi.mocked(Api.post).mockResolvedValue({ request: { id: 'dsar-1' } });

    render(<ComplianceCenterView />);

    await screen.findByText('Compliance Center');
    fireEvent.click(screen.getByRole('button', { name: /DSAR/i }));
    fireEvent.click(screen.getByRole('button', { name: /New Request/i }));
    fireEvent.change(screen.getByPlaceholderText('requester@example.com'), {
      target: { value: 'privacy@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Request/i }));

    await waitFor(() => {
      expect(screen.getByText('DSAR creation was not confirmed by the server')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('requester@example.com')).toBeInTheDocument();
    expect(screen.queryByText('DSAR request created successfully')).not.toBeInTheDocument();
  });

  it('accepts wrapped compliance payloads and nested create responses', async () => {
    let dsarLoads = 0;
    vi.mocked(Api.getOrganizations).mockResolvedValue({
      data: { data: { organizations: [{ id: 'org-1', name: 'Acme' }] } },
    } as unknown as Awaited<ReturnType<typeof Api.getOrganizations>>);
    vi.mocked(Api.get).mockImplementation(async (path: string) => {
      if (path === '/superadmin/compliance/frameworks') {
        return {
          data: {
            data: {
              frameworks: [
                {
                  id: 'gdpr',
                  name: 'GDPR',
                  displayName: 'GDPR',
                  description: 'Privacy',
                  version: '1',
                  requirements: [],
                },
              ],
            },
          },
        };
      }
      if (path === '/superadmin/compliance/status/gdpr') {
        return {
          data: {
            data: { status: { frameworkId: 'gdpr', frameworkName: 'GDPR', total: 1, compliant: 1 } },
          },
        };
      }
      if (path === '/superadmin/compliance/dsar') {
        dsarLoads += 1;
        return {
          data: {
            data: {
              requests:
                dsarLoads > 1
                  ? [
                      {
                        id: 'dsar-1',
                        requesterEmail: 'privacy@example.com',
                        requestType: 'access',
                        status: 'pending',
                        receivedAt: 'not-a-date',
                        dueDate: 'not-a-date',
                      },
                    ]
                  : [],
            },
          },
        };
      }
      if (path === '/superadmin/compliance/audits') {
        return {
          data: { data: { audits: [{ id: 'audit-1', name: 'Wrapped Audit', status: 'planned' }] } },
        };
      }
      if (path === '/superadmin/compliance/processing-records') {
        return {
          data: {
            data: {
              records: [
                {
                  id: 'record-1',
                  name: 'Wrapped Record',
                  purpose: 'Support',
                  status: 'active',
                  created_at: 'not-a-date',
                },
              ],
            },
          },
        };
      }
      return {};
    });
    vi.mocked(Api.post).mockResolvedValue({ data: { data: { request: { id: 'dsar-1' } } } });

    render(<ComplianceCenterView />);

    await screen.findByText('Compliance Center');
    fireEvent.click(screen.getByRole('button', { name: /Frameworks/i }));
    expect(await screen.findByText('GDPR')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Audits/i }));
    expect(await screen.findByText('Wrapped Audit')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Processing Records/i }));
    expect(await screen.findByText('Wrapped Record')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /DSAR/i }));
    fireEvent.click(screen.getByRole('button', { name: /New Request/i }));
    fireEvent.change(screen.getByPlaceholderText('requester@example.com'), {
      target: { value: 'privacy@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Request/i }));

    await waitFor(() => {
      expect(screen.getByText('privacy@example.com')).toBeInTheDocument();
    });
    expect(screen.queryByText('DSAR creation was not confirmed by the server')).not.toBeInTheDocument();
  });

  it('does not render malformed compliance payloads as empty healthy states', async () => {
    vi.mocked(Api.get).mockImplementation(async (path: string) => {
      if (path === '/superadmin/compliance/frameworks') {
        return { data: { data: { unexpected: true } } };
      }
      if (path === '/superadmin/compliance/dsar') {
        return { data: { data: { unexpected: true } } };
      }
      if (path === '/superadmin/compliance/audits') {
        return { data: { data: { unexpected: true } } };
      }
      if (path === '/superadmin/compliance/processing-records') {
        return { data: { data: { unexpected: true } } };
      }
      return {};
    });

    render(<ComplianceCenterView />);

    await waitFor(() => {
      expect(screen.getAllByText('Compliance frameworks response was not a list').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('No compliance frameworks')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /DSAR/i }));
    expect(screen.getByText('DSAR response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No data subject requests')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Audits/i }));
    expect(screen.getByText('Compliance audits response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No audits scheduled')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Processing Records/i }));
    expect(screen.getByText('Processing records response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No processing records')).not.toBeInTheDocument();
  });
});
