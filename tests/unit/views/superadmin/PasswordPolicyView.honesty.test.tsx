import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { PasswordPolicyView } from '@/views/superadmin/security/PasswordPolicyView';

vi.mock('@/services/api', () => ({
  Api: {
    getOrganizations: vi.fn(),
    getPasswordPolicy: vi.fn(),
    updatePasswordPolicy: vi.fn(),
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

const serverPolicy = {
  min_length: 8,
  require_uppercase: 1,
  require_lowercase: 1,
  require_numbers: 1,
  require_special_chars: 1,
  max_age_days: null,
  prevent_reuse_count: 5,
  lockout_attempts: 5,
  lockout_duration_minutes: 30,
  require_mfa: 0,
};

describe('PasswordPolicyView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render editable default policy when policy load fails', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getPasswordPolicy).mockRejectedValue(new Error('Policy API down'));

    render(<PasswordPolicyView />);

    await waitFor(() => {
      expect(screen.getByText('Password policy unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Policy API down')).toBeInTheDocument();
    expect(screen.queryByLabelText('Minimum Length')).not.toBeInTheDocument();
  });

  it('does not claim save success when read-back returns stale policy', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getPasswordPolicy).mockResolvedValue(serverPolicy);
    vi.mocked(Api.updatePasswordPolicy).mockResolvedValue({ success: true });

    render(<PasswordPolicyView />);

    const minLengthInput = await screen.findByDisplayValue('8');
    fireEvent.change(minLengthInput, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Policy/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Password policy update was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('normalizes malformed numeric policy fields to safe defaults', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Org One' }]);
    vi.mocked(Api.getPasswordPolicy).mockResolvedValue({
      min_length: 'bad-min',
      require_uppercase: 'true',
      require_lowercase: 'bad-bool',
      require_numbers: 1,
      require_special_chars: null,
      max_age_days: 'bad-age',
      prevent_reuse_count: 'bad-reuse',
      lockout_attempts: 'bad-lockout',
      lockout_duration_minutes: 'bad-duration',
      require_mfa: '1',
    });

    render(<PasswordPolicyView />);

    expect(await screen.findByDisplayValue('8')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('No expiration')).toHaveDisplayValue('');
    expect(screen.queryByDisplayValue(/bad-|NaN/i)).not.toBeInTheDocument();
  });

  it('accepts wrapped organizations and password policy payloads', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue({
      data: { organizations: [{ id: 'org-1', name: 'Org One' }] },
    });
    vi.mocked(Api.getPasswordPolicy).mockResolvedValue({
      data: { policy: { ...serverPolicy, min_length: 12, require_mfa: true } },
    });

    render(<PasswordPolicyView />);

    expect(await screen.findByDisplayValue('12')).toBeInTheDocument();
    expect(screen.getByText('Org One')).toBeInTheDocument();
    expect(screen.queryByText('Password policy unavailable')).not.toBeInTheDocument();
  });

  it('accepts deeply wrapped policy read-back after save', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue({
      data: { data: { organizations: [{ id: 'org-1', name: 'Org One' }] } },
    });
    vi.mocked(Api.getPasswordPolicy)
      .mockResolvedValueOnce({ data: { data: { policy: serverPolicy } } })
      .mockResolvedValueOnce({
        data: {
          data: {
            policy: {
              ...serverPolicy,
              min_length: 12,
            },
          },
        },
      });
    vi.mocked(Api.updatePasswordPolicy).mockResolvedValue({ success: true });

    render(<PasswordPolicyView />);

    const minLengthInput = await screen.findByDisplayValue('8');
    fireEvent.change(minLengthInput, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Policy/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Password policy updated');
    });
    expect(screen.queryByText('Password policy update was not confirmed by the server')).not.toBeInTheDocument();
  });

  it('does not render malformed policy payloads as editable defaults', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: null }]);
    vi.mocked(Api.getPasswordPolicy).mockResolvedValue({ unexpected: true });

    render(<PasswordPolicyView />);

    await waitFor(() => {
      expect(screen.getByText('Password policy unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Password policy response was missing policy data')).toBeInTheDocument();
    expect(screen.getByText('Unknown organization')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('8')).not.toBeInTheDocument();
  });
});
