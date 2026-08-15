/**
 * @vitest-environment jsdom
 * AdminMembersRolesPanel — H2.11 regression coverage.
 *
 * Guards the full "Add member" chain that was reported as a silent no-op:
 *   click -> validation (visible message) -> POST -> member list refresh -> success.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { translate } = vi.hoisted(() => ({
  translate: (
    key: string,
    fallback?: string | Record<string, unknown>,
    values?: Record<string, unknown>
  ) => {
    const options = typeof fallback === 'object' ? fallback : (values ?? {});
    const template = typeof fallback === 'string' ? fallback : String(options.defaultValue ?? key);
    return template.replace(/{{(\w+)}}/g, (_match, name: string) => String(options[name] ?? ''));
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translate,
    i18n: { language: 'en' },
  }),
}));

// --- Mocks -----------------------------------------------------------------

const addOrganizationMember = vi.fn();
const getOrganizationMembers = vi.fn();

vi.mock('../../../src/services/api', () => ({
  Api: {
    getOrganizationMembers: (...a: any[]) => getOrganizationMembers(...a),
    addOrganizationMember: (...a: any[]) => addOrganizationMember(...a),
    updateOrganizationMemberRole: vi.fn(),
    removeOrganizationMember: vi.fn(),
    post: vi.fn(),
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
  default: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

// Heavy children are not under test here — stub to isolate the invite chain.
vi.mock('../../../src/components/shared/ModuleHub/FilterableTable', () => ({
  FilterableTable: ({ data }: any) => (
    <div data-testid="members-table">{`rows:${(data || []).length}`}</div>
  ),
}));
vi.mock('../../../src/views/admin/OwnershipManagementView', () => ({
  OwnershipManagementView: () => <div data-testid="ownership" />,
}));

const storeState: any = {
  currentOrganization: { id: 'org-1', name: 'Acme' },
  currentUser: { id: 'user-1', role: 'ADMIN' },
};
vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => storeState,
}));

import { AdminMembersRolesPanel } from '../../../src/components/Admin/AdminMembersRolesPanel';

describe('AdminMembersRolesPanel — Add member (H2.11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrganizationMembers.mockResolvedValue([
      { user_id: 'user-1', email: 'admin@acme.com', role: 'ADMIN', status: 'ACTIVE' },
    ]);
    addOrganizationMember.mockResolvedValue({ id: 'new-member' });
    storeState.currentUser = { id: 'user-1', role: 'ADMIN' };
  });

  it('blocks empty email with a visible inline error and does not POST', async () => {
    const user = userEvent.setup();
    render(<AdminMembersRolesPanel />);
    await waitFor(() => expect(getOrganizationMembers).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /add member/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/email address/i);
    expect(addOrganizationMember).not.toHaveBeenCalled();
  });

  it('blocks malformed email with a visible inline error and does not POST', async () => {
    const user = userEvent.setup();
    render(<AdminMembersRolesPanel />);
    await waitFor(() => expect(getOrganizationMembers).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText(/member@company.com/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /add member/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/valid email/i);
    expect(addOrganizationMember).not.toHaveBeenCalled();
  });

  it('POSTs a valid email, refreshes members, and shows a success notice', async () => {
    const user = userEvent.setup();
    render(<AdminMembersRolesPanel />);
    await waitFor(() => expect(getOrganizationMembers).toHaveBeenCalledTimes(1));

    await user.type(screen.getByPlaceholderText(/member@company.com/i), 'new.person@acme.com');
    await user.click(screen.getByRole('button', { name: /add member/i }));

    await waitFor(() =>
      expect(addOrganizationMember).toHaveBeenCalledWith('org-1', 'new.person@acme.com', 'MEMBER')
    );
    // list refreshed (initial load + post-add reload)
    await waitFor(() => expect(getOrganizationMembers).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('status')).toHaveTextContent(/added to the workspace/i);
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('surfaces a server USER_NOT_FOUND failure as a visible, actionable error', async () => {
    addOrganizationMember.mockRejectedValueOnce(new Error('User not found for the provided email'));
    const user = userEvent.setup();
    render(<AdminMembersRolesPanel />);
    await waitFor(() => expect(getOrganizationMembers).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText(/member@company.com/i), 'ghost@acme.com');
    await user.click(screen.getByRole('button', { name: /add member/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/invite code|self-register|create the account/i);
    expect(toastError).toHaveBeenCalled();
  });

  it('does not silently no-op for a non-manager: shows an explicit denial', async () => {
    // viewer not in member list + platform role USER => cannot manage
    storeState.currentUser = { id: 'nobody', role: 'USER' };
    getOrganizationMembers.mockResolvedValue([
      { user_id: 'user-1', email: 'admin@acme.com', role: 'ADMIN', status: 'ACTIVE' },
    ]);
    const user = userEvent.setup();
    render(<AdminMembersRolesPanel />);
    await waitFor(() => expect(getOrganizationMembers).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText(/member@company.com/i), 'x@acme.com');
    await user.click(screen.getByRole('button', { name: /add member/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/owner or admin/i);
    expect(addOrganizationMember).not.toHaveBeenCalled();
  });
});
