import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { User } from '@/types';
import { PasswordSecuritySettings } from '@/components/settings/PasswordSecuritySettings';

vi.mock('@/components/Profile/MFASetup', () => ({
  MFASetup: () => <div>MFA setup</div>,
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getActiveSessions: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    changePassword: vi.fn(),
    revokeSession: vi.fn(),
    revokeAllSessions: vi.fn(),
  },
}));

const currentUser = {
  id: 'user-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  role: 'USER',
  mfaEnabled: false,
};

const recoveryOptions = {
  recoveryEmail: 'old@example.com',
  recoveryPhone: '+111111111',
  backupCodesCount: 0,
};

const asUser = (user: Partial<User>) => user as User;

describe('PasswordSecuritySettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getActiveSessions).mockResolvedValue({ sessions: [] });
    vi.mocked(Api.get).mockImplementation((path: string) => {
      if (path === '/api/settings/recovery') {
        return Promise.resolve(recoveryOptions);
      }
      return Promise.resolve({ events: [] });
    });
    vi.mocked(Api.put).mockResolvedValue({ success: true });
  });

  it('does not claim recovery options success when read-back returns stale values', async () => {
    render(<PasswordSecuritySettings currentUser={asUser(currentUser)} />);

    fireEvent.click(screen.getByRole('button', { name: /Recovery Options/i }));

    await waitFor(() => {
      expect(screen.getByText('old@example.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Edit Recovery Options/i }));
    fireEvent.change(screen.getByPlaceholderText('backup@example.com'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Recovery options were not confirmed by the server'
      );
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('backup@example.com')).toHaveValue('old@example.com');
  });
});
