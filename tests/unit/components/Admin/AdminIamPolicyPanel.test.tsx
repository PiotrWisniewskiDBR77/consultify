import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminIamPolicyPanel } from '@/components/Admin/AdminIamPolicyPanel';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getAdminIAMPolicy: vi.fn(),
    getAdminIAMAssignments: vi.fn(),
    updateAdminIAMPolicy: vi.fn(),
    createAdminIAMAssignment: vi.fn(),
    deleteAdminIAMAssignment: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const policy = {
  delegatedRoles: [],
  accessReviewsEnabled: true,
  accessReviewCadenceDays: 30,
  contextAwareAccessEnabled: false,
  privilegedSessionReauthMinutes: 15,
  breakGlassEnabled: false,
  breakGlassApprovers: [],
  alertOnPrivilegedChange: true,
};

describe('AdminIamPolicyPanel fail-closed states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getAdminIAMPolicy).mockResolvedValue({ policy });
    vi.mocked(Api.getAdminIAMAssignments).mockResolvedValue({ assignments: [] });
    vi.mocked(Api.updateAdminIAMPolicy).mockResolvedValue({ policy });
  });

  it('does not expose editable defaults when the authoritative load fails and retries explicitly', async () => {
    vi.mocked(Api.getAdminIAMPolicy)
      .mockRejectedValueOnce(new Error('IAM unavailable'))
      .mockResolvedValueOnce({ policy });

    render(<AdminIamPolicyPanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent('IAM unavailable');
    expect(screen.queryByRole('button', { name: /Save IAM policy/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(await screen.findByRole('button', { name: /Save IAM policy/i })).toBeInTheDocument();
  });

  it('reloads authoritative IAM state after a stale update conflict', async () => {
    const stale = Object.assign(new Error('stale'), { status: 409 });
    vi.mocked(Api.updateAdminIAMPolicy).mockRejectedValueOnce(stale);
    render(<AdminIamPolicyPanel />);

    fireEvent.click(await screen.findByRole('button', { name: /Save IAM policy/i }));
    await waitFor(() => expect(Api.getAdminIAMPolicy).toHaveBeenCalledTimes(2));
    expect(Api.updateAdminIAMPolicy).toHaveBeenCalledTimes(1);
  });
});
