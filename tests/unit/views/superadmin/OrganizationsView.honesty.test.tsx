import { Blob as NodeBlob } from 'node:buffer';
import { toast } from 'react-hot-toast';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { OrganizationsView } from '@/views/superadmin/OrganizationsView';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/views/superadmin/SuperAdminOrgDetailsModal', () => ({
  SuperAdminOrgDetailsModal: () => null,
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    exportOrganizationData: vi.fn(),
    getOrganizations: vi.fn(),
    getAccessRequests: vi.fn(),
    getAccessCodes: vi.fn(),
    approveAccessRequest: vi.fn(),
    rejectAccessRequest: vi.fn(),
    generateAccessCode: vi.fn(),
    deactivateAccessCode: vi.fn(),
    deleteOrganization: vi.fn(),
    updateOrganization: vi.fn(),
  },
}));

describe('OrganizationsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render organization load failures as an empty organization table', async () => {
    vi.mocked(Api.getOrganizations).mockRejectedValue(new Error('Organization backend down'));
    vi.mocked(Api.getAccessRequests).mockResolvedValue([]);
    vi.mocked(Api.getAccessCodes).mockResolvedValue([]);

    render(<OrganizationsView />);

    await waitFor(() => {
      expect(screen.getByText('Organizations unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No organizations found')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search organizations...')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Pending Requests/i }));
    expect(screen.getByText('Access requests unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No access requests found.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Access Codes/i }));
    expect(screen.getByText('Access codes unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No access codes generated yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate New Code/i })).toBeDisabled();
  });

  it('keeps organizations visible while degraded access requests and codes are unavailable', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([
      {
        id: 'org-1',
        name: 'Acme',
        plan: 'pro',
        status: 'active',
        user_count: 3,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    vi.mocked(Api.getAccessRequests).mockRejectedValue(new Error('Requests down'));
    vi.mocked(Api.getAccessCodes).mockRejectedValue(new Error('Codes down'));

    render(<OrganizationsView />);

    await waitFor(() => {
      expect(screen.getByText('Acme')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Pending Requests/i }));
    expect(screen.getByText('Access requests unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No access requests found.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Access Codes/i }));
    expect(screen.getByText('Access codes unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No access codes generated yet.')).not.toBeInTheDocument();
  });

  it('refetches access requests and codes after decisions and code mutations', async () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'Not eligible')
    );
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    let requestLoads = 0;
    let codeLoads = 0;
    vi.mocked(Api.getOrganizations).mockResolvedValue([]);
    vi.mocked(Api.getAccessRequests).mockImplementation(async () => {
      requestLoads += 1;
      if (requestLoads === 1) {
        return [
          {
            id: 'req-1',
            organization_name: 'Acme',
            first_name: 'Ada',
            last_name: 'Admin',
            email: 'ada@example.com',
            status: 'pending',
            requested_at: 'not-a-date',
          },
          {
            id: 'req-2',
            organization_name: 'Beta',
            first_name: 'Bob',
            last_name: 'Builder',
            email: 'bob@example.com',
            status: 'pending',
            requested_at: '2026-04-26T10:00:00.000Z',
          },
        ];
      }
      if (requestLoads === 2) {
        return [
          {
            id: 'req-2',
            organization_name: 'Beta',
            first_name: 'Bob',
            last_name: 'Builder',
            email: 'bob@example.com',
            status: 'pending',
            requested_at: '2026-04-26T10:00:00.000Z',
          },
        ];
      }
      return [];
    });
    vi.mocked(Api.getAccessCodes).mockImplementation(async () => {
      codeLoads += 1;
      if (codeLoads === 1) {
        return [
          {
            id: 'code-1',
            code: 'WELCOME',
            role: 'USER',
            max_uses: 10,
            current_uses: 0,
            expires_at: 'not-a-date',
            created_by_email: 'admin@example.com',
          },
        ];
      }
      if (codeLoads === 2) {
        return [
          {
            id: 'code-2',
            code: 'NEWCODE',
            role: 'ADMIN',
            max_uses: 5,
            current_uses: 0,
            expires_at: null,
            created_by_email: 'admin@example.com',
          },
        ];
      }
      return [];
    });
    vi.mocked(Api.approveAccessRequest).mockResolvedValue({ success: true });
    vi.mocked(Api.rejectAccessRequest).mockResolvedValue({ success: true });
    vi.mocked(Api.generateAccessCode).mockResolvedValue({ code: 'NEWCODE' });
    vi.mocked(Api.deactivateAccessCode).mockResolvedValue({ success: true });

    render(<OrganizationsView />);

    fireEvent.click(await screen.findByRole('button', { name: /Pending Requests/i }));
    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByTitle('Approve')[0]);
    await waitFor(() => {
      expect(Api.approveAccessRequest).toHaveBeenCalledWith('req-1');
      expect(screen.queryByText('Acme')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTitle('Reject')[0]);
    await waitFor(() => {
      expect(Api.rejectAccessRequest).toHaveBeenCalledWith('req-2', 'Not eligible');
      expect(screen.queryByText('Beta')).not.toBeInTheDocument();
    });
    expect(requestLoads).toBeGreaterThanOrEqual(3);

    fireEvent.click(screen.getByRole('button', { name: /Access Codes/i }));
    expect(await screen.findByText('WELCOME')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Generate New Code/i }));
    fireEvent.change(screen.getByPlaceholderText('Leave empty for random'), {
      target: { value: 'newcode' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Generate Code$/i }));
    await waitFor(() => {
      expect(Api.generateAccessCode).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NEWCODE' })
      );
      expect(screen.getByText('NEWCODE')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Deactivate code'));
    await waitFor(() => {
      expect(Api.deactivateAccessCode).toHaveBeenCalledWith('code-2');
      expect(screen.queryByText('NEWCODE')).not.toBeInTheDocument();
    });
    expect(codeLoads).toBeGreaterThanOrEqual(3);
  });

  it('does not claim access code generation success when read-back is stale', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([]);
    vi.mocked(Api.getAccessRequests).mockResolvedValue([]);
    vi.mocked(Api.getAccessCodes).mockResolvedValue([]);
    vi.mocked(Api.generateAccessCode).mockResolvedValue(undefined);

    render(<OrganizationsView />);

    fireEvent.click(await screen.findByRole('button', { name: /Access Codes/i }));
    fireEvent.click(screen.getByRole('button', { name: /Generate New Code/i }));
    fireEvent.change(screen.getByPlaceholderText('Leave empty for random'), {
      target: { value: 'stale' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Generate Code$/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Access code generation was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Generate Access Code')).toBeInTheDocument();
  });

  it('does not claim organization update success when read-back is stale', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([
      {
        id: 'org-1',
        name: 'Acme',
        plan: 'free',
        status: 'active',
        user_count: 3,
        discount_percent: 0,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    vi.mocked(Api.getAccessRequests).mockResolvedValue([]);
    vi.mocked(Api.getAccessCodes).mockResolvedValue([]);
    vi.mocked(Api.updateOrganization).mockResolvedValue({ success: true });

    render(<OrganizationsView />);

    await screen.findByText('Acme');
    fireEvent.click(screen.getByTitle('Quick Edit'));
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'pro' } });
    fireEvent.click(screen.getByTitle('Save'));

    await waitFor(() => {
      expect(
        screen.getByText('Organization update was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(screen.queryByText('Organization updated')).not.toBeInTheDocument();
  });

  it('accepts wrapped organization, request, and access code payloads', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue({
      data: {
        data: {
          organizations: [
            {
              id: 'org-1',
              name: 'Wrapped Org',
              plan: 'pro',
              status: 'active',
              user_count: 3,
              discount_percent: 0,
              created_at: 'not-a-date',
            },
          ],
        },
      },
    } as unknown as Awaited<ReturnType<typeof Api.getOrganizations>>);
    vi.mocked(Api.getAccessRequests).mockResolvedValue({
      data: {
        data: {
          requests: [
            {
              id: 'req-1',
              organization_name: 'Wrapped Pending',
              first_name: 'Ada',
              last_name: 'Admin',
              email: 'ada@example.com',
              status: 'PENDING',
              requested_at: 'not-a-date',
            },
          ],
        },
      },
    } as unknown as Awaited<ReturnType<typeof Api.getAccessRequests>>);
    vi.mocked(Api.getAccessCodes).mockResolvedValue({
      data: {
        data: {
          codes: [
            {
              id: 'code-1',
              code: 'WRAPPED',
              role: 'USER',
              max_uses: 10,
              current_uses: 0,
              expires_at: 'not-a-date',
              created_by_email: 'admin@example.com',
            },
          ],
        },
      },
    } as unknown as Awaited<ReturnType<typeof Api.getAccessCodes>>);

    render(<OrganizationsView />);

    expect(await screen.findByText('Wrapped Org')).toBeInTheDocument();
    expect(screen.queryByText('Organizations unavailable')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Pending Requests/i }));
    expect(await screen.findByText('Wrapped Pending')).toBeInTheDocument();
    expect(screen.queryByText('Access requests unavailable')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Access Codes/i }));
    expect(await screen.findByText('WRAPPED')).toBeInTheDocument();
    expect(screen.queryByText('Access codes unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('does not render malformed organization payloads as an empty organization table', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue({
      data: { data: { unexpected: true } },
    } as unknown as Awaited<ReturnType<typeof Api.getOrganizations>>);
    vi.mocked(Api.getAccessRequests).mockResolvedValue([]);
    vi.mocked(Api.getAccessCodes).mockResolvedValue([]);

    render(<OrganizationsView />);

    await waitFor(() => {
      expect(screen.getByText('Organizations unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Organizations response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No organizations found')).not.toBeInTheDocument();
  });

  it('keeps the critical status confirmation button visibly disabled until a reason is typed', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([
      {
        id: 'org-1',
        name: 'Acme',
        plan: 'pro',
        status: 'active',
        user_count: 3,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    vi.mocked(Api.getAccessRequests).mockResolvedValue([]);
    vi.mocked(Api.getAccessCodes).mockResolvedValue([]);

    render(<OrganizationsView />);

    await waitFor(() => {
      expect(screen.getByText('Acme')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Quick Edit' }));
    const [, statusSelect] = screen.getAllByRole('combobox');
    fireEvent.change(statusSelect, { target: { value: 'blocked' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const confirmBtn = await screen.findByRole('button', { name: 'Confirm status change' });
    expect(confirmBtn).toBeDisabled();
    expect(confirmBtn.className).toMatch(/disabled:opacity-50/);

    fireEvent.change(screen.getByRole('textbox', { name: /Reason/i }), {
      target: { value: 'ab' },
    });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox', { name: /Reason/i }), {
      target: { value: 'Security incident' },
    });
    expect(confirmBtn).not.toBeDisabled();
  });
});

describe('Organization export disclosure through the row action', () => {
  const fixture = () => ({
    organization: { id: 'org-1', name: 'Acme' },
    tables: {},
    rowCounts: {},
    totalRows: 0,
    exportedAt: '2026-09-12T00:00:00Z',
    skipped: [],
    securityManifest: {
      policyVersion: 'tenant-export-contract-v5-20260912',
      tableIdentityVersion: 'schema-qualified-v1',
      scope: 'declared',
      includedSchemas: ['public'],
      complete: true,
      truncated: false,
      unresolvedTables: [],
      excludedTables: [],
      excludedColumns: [],
    },
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getOrganizations).mockResolvedValue([
      {
        id: 'org-1',
        name: 'Acme',
        plan: 'pro',
        status: 'active',
        user_count: 1,
        created_at: '2026-01-01',
      },
    ]);
    vi.mocked(Api.getAccessRequests).mockResolvedValue([]);
    vi.mocked(Api.getAccessCodes).mockResolvedValue([]);
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() })
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  async function clickExport() {
    await screen.findByText('Acme');
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    fireEvent.click(await screen.findByText('Export Data'));
  }
  it.each(['complete', 'partial', 'unknown', 'contradictory'] as const)(
    'downloads original bytes and discloses %s scope',
    async (state) => {
      const payload: any = fixture();
      if (state === 'partial') payload.securityManifest.complete = false;
      if (state === 'unknown') delete payload.securityManifest;
      if (state === 'contradictory')
        payload.securityManifest.unresolvedTables = [{ table: 'missing', reason: 'unknown' }];
      const blob = new NodeBlob([JSON.stringify(payload, null, 2)]) as unknown as Blob;
      vi.mocked(Api.exportOrganizationData).mockResolvedValue(blob);
      render(<OrganizationsView />);
      await clickExport();
      const notice = await screen.findByRole('status');
      expect(notice.textContent).toContain(
        state === 'complete'
          ? 'complete under its declared scope'
          : state === 'unknown'
            ? 'Completeness could not be verified'
            : 'Partial export downloaded'
      );
      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
      if (state !== 'complete') expect(toast.success).not.toHaveBeenCalled();
    }
  );
  it.each([
    'missing-id',
    'invalid-date',
    'broken-table',
    'wrong-count',
    'wrong-total',
    'unknown-policy',
  ] as const)('does not claim complete for %s', async (caseName) => {
    const payload: any = fixture();
    if (caseName === 'missing-id') delete payload.organization.id;
    if (caseName === 'invalid-date') payload.exportedAt = 'not a date';
    if (caseName === 'broken-table') {
      payload.tables.projects = 'broken';
      payload.rowCounts.projects = -1;
    }
    if (caseName === 'wrong-count') {
      payload.tables.projects = [];
      payload.rowCounts.projects = 2;
    }
    if (caseName === 'wrong-total') payload.totalRows = 99;
    if (caseName === 'unknown-policy') payload.securityManifest.policyVersion = 'future';
    vi.mocked(Api.exportOrganizationData).mockResolvedValue(
      new NodeBlob([JSON.stringify(payload)]) as unknown as Blob
    );
    render(<OrganizationsView />);
    await clickExport();
    expect((await screen.findByRole('status')).textContent).toContain(
      'Completeness could not be verified'
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
  it('does not download a response for a different organization', async () => {
    const payload = fixture();
    payload.organization.id = 'foreign';
    vi.mocked(Api.exportOrganizationData).mockResolvedValue(
      new NodeBlob([JSON.stringify(payload)]) as unknown as Blob
    );
    render(<OrganizationsView />);
    await clickExport();
    expect((await screen.findByRole('alert')).textContent).toContain('does not match');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('starts only one download while the row export request is pending', async () => {
    let resolveExport!: (value: Blob) => void;
    vi.mocked(Api.exportOrganizationData).mockReturnValue(
      new Promise((resolve) => {
        resolveExport = resolve;
      })
    );
    vi.mocked(Api.getOrganizations).mockResolvedValue([
      {
        id: 'org-1',
        name: 'Acme',
        plan: 'pro',
        status: 'active',
        user_count: 1,
        created_at: '2026-01-01',
      },
      {
        id: 'org-2',
        name: 'Beta',
        plan: 'pro',
        status: 'active',
        user_count: 1,
        created_at: '2026-01-01',
      },
    ]);
    render(<OrganizationsView />);
    await screen.findByText('Acme');
    fireEvent.click(screen.getAllByRole('button', { name: 'Row actions' })[0]);
    fireEvent.click(await screen.findByText('Export Data'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Row actions' })[1]);
    const secondAction = await screen.findByText('Export Data');
    expect(secondAction.isConnected).toBe(true);
    fireEvent.click(secondAction);
    expect(Api.exportOrganizationData).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    await act(async () => {
      resolveExport(new NodeBlob([JSON.stringify(fixture())]) as unknown as Blob);
    });
    await screen.findByRole('status');
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });
  it.each(['malformed', 'denied'] as const)(
    'does not download a %s response and permits retry',
    async (state) => {
      if (state === 'denied')
        vi.mocked(Api.exportOrganizationData).mockRejectedValue(new Error('Export denied'));
      else
        vi.mocked(Api.exportOrganizationData).mockResolvedValue(
          new NodeBlob(['not JSON']) as unknown as Blob
        );
      render(<OrganizationsView />);
      await clickExport();
      await screen.findByRole('alert');
      expect(URL.createObjectURL).not.toHaveBeenCalled();
      expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      vi.mocked(Api.exportOrganizationData).mockResolvedValue(
        new NodeBlob([JSON.stringify(fixture())]) as unknown as Blob
      );
      await clickExport();
      await screen.findByRole('status');
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    }
  );
});
