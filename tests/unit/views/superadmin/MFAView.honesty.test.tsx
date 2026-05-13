import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { MFAView } from '@/views/superadmin/security/MFAView';

vi.mock('@/services/api', () => ({
  Api: {
    getMFAMethods: vi.fn(),
    getSuperAdminUsers: vi.fn(),
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

describe('MFAView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed MFA method loads as an empty method list', async () => {
    vi.mocked(Api.getSuperAdminUsers).mockResolvedValue([{ id: 'user-1', email: 'a@example.com' }]);
    vi.mocked(Api.getMFAMethods).mockRejectedValue(new Error('MFA API down'));

    render(<MFAView />);

    await waitFor(() => {
      expect(screen.getByText('MFA methods unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('MFA API down')).toBeInTheDocument();
    expect(screen.queryByText('No MFA methods configured')).not.toBeInTheDocument();
  });

  it('renders invalid MFA dates as Unknown date', async () => {
    vi.mocked(Api.getSuperAdminUsers).mockResolvedValue([{ id: 'user-1', email: 'a@example.com' }]);
    vi.mocked(Api.getMFAMethods).mockResolvedValue({
      methods: [
        {
          id: 'mfa-1',
          method_type: 'totp',
          is_enabled: true,
          last_used_at: 'not-a-date',
        },
      ],
    });

    render(<MFAView />);

    expect(await screen.findByText(/Last used: Unknown date/i)).toBeInTheDocument();
  });

  it('renders malformed MFA method text without crashing', async () => {
    vi.mocked(Api.getSuperAdminUsers).mockResolvedValue([
      { id: 'user-1', email: null },
    ] as unknown as Awaited<ReturnType<typeof Api.getSuperAdminUsers>>);
    vi.mocked(Api.getMFAMethods).mockResolvedValue({
      methods: [
        {
          id: 'mfa-1',
          method_type: null,
          is_enabled: true,
          is_primary: true,
          last_used_at: null,
        },
      ],
    });

    render(<MFAView />);

    expect(await screen.findByText('UNKNOWN')).toBeInTheDocument();
    expect(screen.getByText('Enabled • Primary')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('accepts wrapped user and MFA method payloads', async () => {
    vi.mocked(Api.getSuperAdminUsers).mockResolvedValue({
      data: { data: { users: [{ id: 'user-1', email: 'a@example.com' }] } },
    });
    vi.mocked(Api.getMFAMethods).mockResolvedValue({
      data: {
        data: {
          methods: [
            {
              id: 'mfa-1',
              method_type: 'webauthn',
              is_enabled: true,
              is_primary: false,
              last_used_at: null,
            },
          ],
        },
      },
    });

    render(<MFAView />);

    expect(await screen.findByText('WEBAUTHN')).toBeInTheDocument();
    expect(screen.getByText('a@example.com')).toBeInTheDocument();
    expect(screen.queryByText('MFA methods unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed MFA payloads as an empty method list', async () => {
    vi.mocked(Api.getSuperAdminUsers).mockResolvedValue([{ id: 'user-1', email: 'a@example.com' }]);
    vi.mocked(Api.getMFAMethods).mockResolvedValue({ unexpected: true });

    render(<MFAView />);

    await waitFor(() => {
      expect(screen.getByText('MFA methods unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('MFA methods response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No MFA methods configured')).not.toBeInTheDocument();
  });
});
