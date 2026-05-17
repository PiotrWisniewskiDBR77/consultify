import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { OrgAIPolicyTab } from '@/views/superadmin/AIPlatformModule/Configuration/OrgAIPolicyTab';
import { toast } from 'react-hot-toast';

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getOrganizations: vi.fn(),
    getOrgLLMPolicy: vi.fn(),
    updateOrgLLMPolicy: vi.fn(),
    getOrgLLMPolicyHistory: vi.fn(),
    rollbackOrgLLMPolicy: vi.fn(),
  },
}));

const organization = {
  id: 'org-1',
  name: 'Acme',
};

const policyResponse = {
  success: true,
  policy: {
    organization_id: 'org-1',
    policy: {
      allowed_regions: ['EU'],
      allow_provider_types: ['direct'],
      operating_mode: 'standard',
    },
    updated_at: '2026-04-26T10:00:00.000Z',
  },
  latestDraft: null,
};

const historyResponse = {
  success: true,
  versions: [
    {
      id: 'version-1',
      status: 'published',
      change_summary: 'Initial policy',
      changed_by: 'admin',
      created_at: 'not-a-date',
    },
  ],
};

const waitForOrganizationSelection = async () => {
  await waitFor(() => {
    expect(screen.getByDisplayValue('org-1')).toBeInTheDocument();
  });
};

describe('OrgAIPolicyTab honest workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getOrganizations).mockResolvedValue([organization]);
    vi.mocked(Api.getOrgLLMPolicy).mockResolvedValue(policyResponse);
    vi.mocked(Api.getOrgLLMPolicyHistory).mockResolvedValue(historyResponse);
    vi.mocked(Api.updateOrgLLMPolicy).mockResolvedValue({ success: true });
    vi.mocked(Api.rollbackOrgLLMPolicy).mockResolvedValue({ success: true });
  });

  it('requires a successful policy load before editing or saving', async () => {
    render(<OrgAIPolicyTab />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save draft/i })).toBeDisabled();
    });

    expect(screen.getByPlaceholderText('EU, US')).toBeDisabled();

    await waitForOrganizationSelection();
    fireEvent.click(screen.getByRole('button', { name: /Load/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save draft/i })).not.toBeDisabled();
    });

    expect(screen.getByPlaceholderText('EU, US')).not.toBeDisabled();
  });

  it('does not render policy load failures as editable empty JSON', async () => {
    vi.mocked(Api.getOrgLLMPolicy).mockRejectedValue(new Error('Policy API down'));

    render(<OrgAIPolicyTab />);

    await waitForOrganizationSelection();

    fireEvent.click(screen.getByRole('button', { name: /Load/i }));

    await waitFor(() => {
      expect(screen.getByText('Org AI policy unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Policy API down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save draft/i })).toBeDisabled();
    expect(screen.getByPlaceholderText('EU, US')).toBeDisabled();
  });

  it('does not render history load failures as no revisions', async () => {
    vi.mocked(Api.getOrgLLMPolicyHistory).mockRejectedValue(new Error('History API down'));

    render(<OrgAIPolicyTab />);

    await waitForOrganizationSelection();

    fireEvent.click(screen.getByRole('button', { name: /Load/i }));

    await waitFor(() => {
      expect(screen.getByText('Policy history unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('History API down')).toBeInTheDocument();
    expect(screen.queryByText('No policy revisions yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save draft/i })).not.toBeDisabled();
  });

  it('refetches policy after save and rollback workflows', async () => {
    render(<OrgAIPolicyTab />);

    await waitForOrganizationSelection();

    fireEvent.click(screen.getByRole('button', { name: /Load/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Rollback/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('EU, US'), { target: { value: 'EU, US' } });
    fireEvent.click(screen.getByRole('button', { name: /Save draft/i }));

    await waitFor(() => {
      expect(Api.updateOrgLLMPolicy).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ allowed_regions: ['EU', 'US'] }),
        expect.objectContaining({ mode: 'draft' })
      );
    });
    expect(vi.mocked(Api.getOrgLLMPolicy).mock.calls.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: /Rollback/i }));

    await waitFor(() => {
      expect(Api.rollbackOrgLLMPolicy).toHaveBeenCalledWith('org-1', 'version-1');
    });
    expect(vi.mocked(Api.getOrgLLMPolicy).mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('accepts deep wrapped organization, policy, and history payloads', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue({
      data: { data: { organizations: [organization] } },
    } as unknown as Awaited<ReturnType<typeof Api.getOrganizations>>);
    vi.mocked(Api.getOrgLLMPolicy).mockResolvedValue({
      data: { data: policyResponse },
    });
    vi.mocked(Api.getOrgLLMPolicyHistory).mockResolvedValue({
      data: { data: historyResponse },
    });

    render(<OrgAIPolicyTab />);

    await waitForOrganizationSelection();
    fireEvent.click(screen.getByRole('button', { name: /Load/i }));

    expect(await screen.findByDisplayValue('EU')).toBeInTheDocument();
    expect(screen.getAllByText('published').length).toBeGreaterThan(0);
    expect(screen.queryByText('Org AI policy unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed organization payloads as an empty selector silently', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue({
      data: { data: { unexpected: true } },
    } as unknown as Awaited<ReturnType<typeof Api.getOrganizations>>);

    render(<OrgAIPolicyTab />);

    await waitFor(() => {
      expect(screen.getByText(/Organization list unavailable/i)).toBeInTheDocument();
    });
    expect(screen.getAllByDisplayValue('').length).toBeGreaterThan(0);
  });

  it('does not render malformed policy history as no revisions', async () => {
    vi.mocked(Api.getOrgLLMPolicyHistory).mockResolvedValue({
      data: { data: { unexpected: true } },
    });

    render(<OrgAIPolicyTab />);

    await waitForOrganizationSelection();
    fireEvent.click(screen.getByRole('button', { name: /Load/i }));

    await waitFor(() => {
      expect(screen.getByText('Policy history unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Policy history response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No policy revisions yet.')).not.toBeInTheDocument();
  });

  it('does not claim save success when policy read-back is stale', async () => {
    render(<OrgAIPolicyTab />);

    await waitForOrganizationSelection();
    fireEvent.click(screen.getByRole('button', { name: /Load/i }));
    await screen.findByRole('button', { name: /Rollback/i });

    fireEvent.change(screen.getByPlaceholderText('EU, US'), { target: { value: 'EU, US' } });
    fireEvent.click(screen.getByRole('button', { name: /Save draft/i }));

    await waitFor(() => {
      expect(screen.getByText('Org AI policy save was not confirmed by the server')).toBeInTheDocument();
    });
    expect(toast.success).not.toHaveBeenCalledWith('Draft saved');
  });
});
