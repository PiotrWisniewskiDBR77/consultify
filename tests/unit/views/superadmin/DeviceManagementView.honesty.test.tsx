import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';

const t = (_key: string, fallback?: string | { defaultValue?: string }) => (typeof fallback === 'string' ? fallback : fallback?.defaultValue) || _key;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
import { DeviceManagementView } from '@/views/superadmin/security/DeviceManagementView';

vi.mock('@/services/api', () => ({
  Api: {
    getSuperAdminUsers: vi.fn(),
    getUserDevices: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
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

describe('DeviceManagementView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed device loads as an empty inventory', async () => {
    vi.mocked(Api.getSuperAdminUsers).mockResolvedValue([{ id: 'user-1', email: 'a@example.com' }]);
    vi.mocked(Api.getUserDevices).mockRejectedValue(new Error('Devices API down'));

    render(<DeviceManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Device inventory unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Devices API down')).toBeInTheDocument();
    expect(screen.queryByText('No devices found')).not.toBeInTheDocument();
  });

  it('renders invalid device dates as Unknown date', async () => {
    vi.mocked(Api.getSuperAdminUsers).mockResolvedValue([{ id: 'user-1', email: 'a@example.com' }]);
    vi.mocked(Api.getUserDevices).mockResolvedValue([
      {
        id: 'device-1',
        device_id: 'deviceabcdef',
        last_seen_at: 'not-a-date',
      },
    ]);

    render(<DeviceManagementView />);

    expect(await screen.findByText('Unknown date')).toBeInTheDocument();
  });

  it('accepts wrapped device lists and renders malformed fields safely', async () => {
    vi.mocked(Api.getSuperAdminUsers).mockResolvedValue([{ id: 'user-1', email: null }]);
    vi.mocked(Api.getUserDevices).mockResolvedValue({
      devices: [
        {
          id: 'device-1',
          device_id: null,
          device_name: null,
          device_type: null,
          browser: null,
          os: null,
          ip_address: null,
          last_seen_at: 'not-a-date',
          is_blocked: false,
          is_trusted: false,
        },
      ],
    });

    render(<DeviceManagementView />);

    expect(await screen.findByText('Unknown device')).toBeInTheDocument();
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Row actions/i }));
    expect(screen.getByRole('menuitem', { name: /Block device/i })).toBeDisabled();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('accepts nested wrapped user and device payloads', async () => {
    vi.mocked(Api.getSuperAdminUsers).mockResolvedValue({
      data: { data: { users: [{ id: 'user-1', email: 'a@example.com' }] } },
    });
    vi.mocked(Api.getUserDevices).mockResolvedValue({
      data: {
        data: {
          devices: [
            {
              id: 'device-1',
              device_name: 'MacBook Pro',
              device_type: 'laptop',
              browser: 'Safari',
              os: 'macOS',
              ip_address: '10.0.0.1',
              last_seen_at: 'not-a-date',
              is_blocked: false,
              is_trusted: true,
            },
          ],
        },
      },
    });

    render(<DeviceManagementView />);

    expect(await screen.findByText('MacBook Pro')).toBeInTheDocument();
    expect(screen.getByText('a@example.com')).toBeInTheDocument();
    expect(screen.getByText('Trusted')).toBeInTheDocument();
    expect(screen.queryByText('Device inventory unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed device payloads as an empty inventory', async () => {
    vi.mocked(Api.getSuperAdminUsers).mockResolvedValue([{ id: 'user-1', email: 'a@example.com' }]);
    vi.mocked(Api.getUserDevices).mockResolvedValue({ unexpected: true });

    render(<DeviceManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Device inventory unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Devices response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No devices found')).not.toBeInTheDocument();
  });
});
