import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IPWhitelistView } from '@/views/superadmin/security/IPWhitelistView';
import { Api } from '@/services/api';

const t = (_key: string, fallback?: string | { defaultValue?: string }) => (typeof fallback === 'string' ? fallback : fallback?.defaultValue) || _key;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));

vi.mock('@/services/api', () => ({
  Api: {
    addIPWhitelist: vi.fn(),
    getIPWhitelist: vi.fn(),
    getOrganizations: vi.fn(),
    removeIPWhitelist: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
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

describe('IPWhitelistView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('does not render failed whitelist loads as an empty IP list', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getIPWhitelist).mockRejectedValue(new Error('IP whitelist API down'));

    render(<IPWhitelistView />);

    await waitFor(() => {
      expect(screen.getByText('IP whitelist unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('IP whitelist API down')).toBeInTheDocument();
    expect(screen.queryByText('No IP addresses whitelisted')).not.toBeInTheDocument();
  });

  it('does not claim add success when read-back does not include the new IP', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getIPWhitelist).mockResolvedValue([]);
    vi.mocked(Api.addIPWhitelist).mockResolvedValue({ id: 'ip-1' });

    render(<IPWhitelistView />);

    await screen.findByText('No IP addresses whitelisted');
    fireEvent.click(screen.getAllByRole('button', { name: /Add IP/i })[0]);
    fireEvent.change(screen.getByPlaceholderText('192.168.1.1'), {
      target: { value: '10.0.0.1' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Add IP/i })[1]);

    await waitFor(() => {
      expect(
        screen.getByText('IP whitelist addition was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('keeps add modal open when add response does not include an id', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getIPWhitelist).mockResolvedValue([]);
    vi.mocked(Api.addIPWhitelist).mockResolvedValue({ success: true });

    render(<IPWhitelistView />);

    await screen.findByText('No IP addresses whitelisted');
    fireEvent.click(screen.getAllByRole('button', { name: /Add IP/i })[0]);
    fireEvent.change(screen.getByPlaceholderText('192.168.1.1'), {
      target: { value: '10.0.0.1' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Add IP/i })[1]);

    await waitFor(() => {
      expect(
        screen.getByText('IP whitelist addition response was incomplete')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Add IP to Whitelist')).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('does not claim remove success when read-back is unavailable', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getIPWhitelist)
      .mockResolvedValueOnce([
        {
          id: 'ip-1',
          ip_address: '10.0.0.1',
          ip_range: null,
          description: 'Office',
          is_active: true,
        },
      ])
      .mockRejectedValueOnce(new Error('Read-back failed'));
    vi.mocked(Api.removeIPWhitelist).mockResolvedValue({ success: true });

    render(<IPWhitelistView />);

    await screen.findByText('10.0.0.1');
    fireEvent.click(screen.getByRole('button', { name: /Row actions/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/i }));

    await waitFor(() => {
      expect(
        screen.getByText('IP whitelist removal was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalledWith('IP removed from whitelist');
  });

  it('accepts wrapped organization and whitelist payloads', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue({
      data: { data: { organizations: [{ id: 'org-1', name: 'Org One' }] } },
    });
    vi.mocked(Api.getIPWhitelist).mockResolvedValue({
      data: {
        data: {
          whitelist: [
            {
              id: 'ip-1',
              ip_address: '10.0.0.1',
              ip_range: null,
              description: 'Office',
              is_active: true,
            },
          ],
        },
      },
    });

    render(<IPWhitelistView />);

    expect(await screen.findByText('10.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('Org One')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Row actions/i }));
    expect(screen.getByRole('menuitem', { name: /Delete/i })).toBeInTheDocument();
  });

  it('does not claim remove success when read-back still contains the IP', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getIPWhitelist).mockResolvedValue([
      {
        id: 'ip-1',
        ip_address: '10.0.0.1',
        ip_range: null,
        description: 'Office',
        is_active: true,
      },
    ]);
    vi.mocked(Api.removeIPWhitelist).mockResolvedValue({ success: true });

    render(<IPWhitelistView />);

    await screen.findByText('10.0.0.1');
    fireEvent.click(screen.getByRole('button', { name: /Row actions/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/i }));

    await waitFor(() => {
      expect(
        screen.getByText('IP whitelist removal was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalledWith('IP removed from whitelist');
  });

  it('accepts a deeply wrapped add response when read-back confirms it', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getIPWhitelist)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'ip-1', ip_address: '10.0.0.1', is_active: true }]);
    vi.mocked(Api.addIPWhitelist).mockResolvedValue({
      data: { data: { ipWhitelist: { id: 'ip-1' } } },
    });

    render(<IPWhitelistView />);

    await screen.findByText('No IP addresses whitelisted');
    fireEvent.click(screen.getAllByRole('button', { name: /Add IP/i })[0]);
    fireEvent.change(screen.getByPlaceholderText('192.168.1.1'), {
      target: { value: '10.0.0.1' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Add IP/i })[1]);

    await waitFor(() => {
      expect(screen.queryByText('Add IP to Whitelist')).not.toBeInTheDocument();
    });
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
  });

  it('does not render malformed whitelist payloads as an empty IP list', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getIPWhitelist).mockResolvedValue({ unexpected: true });

    render(<IPWhitelistView />);

    await waitFor(() => {
      expect(screen.getByText('IP whitelist unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('IP whitelist response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No IP addresses whitelisted')).not.toBeInTheDocument();
  });
});
