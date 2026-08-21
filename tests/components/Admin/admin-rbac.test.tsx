/**
 * @vitest-environment jsdom
 *
 * admin-rbac.test.tsx — M24 L-09
 *
 * Behavioral RBAC tests for the admin shell and its membership panel.
 * Covers four scenarios:
 *   1. Non-admin (USER role) is blocked from AdminSettingsModule via ProtectedRoute.
 *   2. ADMIN can access the Team & Access panel and sees the "Add member" CTA.
 *   3. OWNER can trigger a role change that reaches the API with correct arguments.
 *   4. Anti-escalation: MemberRoleEnum / UI dropdowns do NOT expose SUPERADMIN role.
 *
 * Tests operate at the component level using React Testing Library + vi.mock.
 * API calls are stubbed so no network is required.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mutable state — shared across vi.mock factories
// ---------------------------------------------------------------------------
const authState = vi.hoisted(() => ({
  currentUser: null as {
    id: string;
    email: string;
    role: string;
    isAuthenticated: boolean;
    isSuperAdmin?: boolean;
  } | null,
  isAuthInitializing: false,
  currentOrganization: { id: 'org-test-1' } as { id: string } | null,
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    currentUser: authState.currentUser,
    isAuthInitializing: authState.isAuthInitializing,
    currentOrganization: authState.currentOrganization,
    setCurrentView: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      (typeof fallback === 'string' ? fallback : fallback?.defaultValue) || _key,
    i18n: { language: 'en' },
  }),
}));

// Stub heavy admin sub-panels so we focus on the shell routing + RBAC behaviour.
vi.mock('../../../src/components/Admin/AdminAIControlCenterPanel', () => ({
  AdminAIControlCenterPanel: () => <div data-testid="panel-ai">AI Controls</div>,
}));
vi.mock('../../../src/components/Admin/AdminAuditLogPanel', () => ({
  AdminAuditLogPanel: () => <div data-testid="panel-audit">Audit Log</div>,
}));
vi.mock('../../../src/components/Admin/AdminBillingFinOpsPanel', () => ({
  AdminBillingFinOpsPanel: () => <div data-testid="panel-billing">Billing</div>,
}));
vi.mock('../../../src/components/Admin/AdminSecurityIdentityPanel', () => ({
  AdminSecurityIdentityPanel: () => <div data-testid="panel-security">Security</div>,
}));

// AdminMembersRolesPanel is NOT stubbed — its real implementation is rendered
// in tests 2, 3, and 4 to verify RBAC and anti-escalation behaviour.
vi.mock('../../../src/views/admin/OwnershipManagementView', () => ({
  OwnershipManagementView: () => <div data-testid="ownership-view" />,
}));

vi.mock('../../../src/components/Admin/AdminSettingsSidebar', () => ({
  AdminSettingsSidebar: ({
    activeSection,
    onSectionChange,
  }: {
    activeSection: string;
    onSectionChange: (s: string) => void;
    onBack: () => void;
  }) => (
    <nav data-testid="admin-sidebar" data-active={activeSection}>
      <button onClick={() => onSectionChange('people')}>Team nav</button>
    </nav>
  ),
  // type re-export so TS doesn't complain
  AdminSettingsSection: undefined,
}));

vi.mock('../../../src/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../src/components/ui/primitives/Button', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler;
  }) => <button onClick={onClick}>{children}</button>,
}));

// DesktopOnlyGuard — always passes through children in test environment.
vi.mock('../../../src/components/shared/DesktopOnlyGuard', () => ({
  DesktopOnlyGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// betaAccess utilities — admin is never in closed-beta for this test suite.
vi.mock('../../../src/utils/betaAccess', () => ({
  isBetaClosed: () => false,
  isBetaLockedForRole: () => false,
  dispatchBetaAccessBlocked: vi.fn(),
}));

// Stub the Api singleton for membership calls.
vi.mock('../../../src/services/api', () => ({
  Api: {
    getOrganizationMembers: vi.fn(),
    addOrganizationMember: vi.fn(),
    updateOrganizationMemberRole: vi.fn(),
    changeAdminOrganizationMemberRole: vi.fn(),
    removeOrganizationMember: vi.fn(),
    post: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Lazy imports AFTER mocks are installed
// ---------------------------------------------------------------------------
import { Api } from '../../../src/services/api';
import { ProtectedRoute } from '../../../src/components/ProtectedRoute';
import AdminSettingsModule from '../../../src/views/admin/AdminSettingsModule';
import { AdminMembersRolesPanel } from '../../../src/components/Admin/AdminMembersRolesPanel';

// Typed shorthand for the mocked API.
const mockedApi = Api as unknown as Record<string, ReturnType<typeof vi.fn>>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeUser = (
  role: string,
  opts: { authenticated?: boolean } = {}
) => ({
  id: `user-${role.toLowerCase()}`,
  email: `${role.toLowerCase()}@test.example`,
  role,
  isAuthenticated: opts.authenticated ?? true,
  isSuperAdmin: role === 'SUPERADMIN',
});

const MEMBERS_FIXTURE = [
  {
    user_id: 'owner-id',
    email: 'owner@acme.test',
    role: 'OWNER',
    first_name: 'Alice',
    last_name: 'Owner',
  },
  {
    user_id: 'member-id',
    email: 'member@acme.test',
    role: 'MEMBER',
    first_name: 'Bob',
    last_name: 'Member',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Renders ProtectedRoute wrapping AdminSettingsModule inside a MemoryRouter
 * that has stub routes for /login and /chat (redirect destinations).
 */
function renderAdminWithProtectedRoute(userRole: string, path = '/admin/people') {
  authState.currentUser = makeUser(userRole);
  authState.isAuthInitializing = false;

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Login Screen</div>} />
        <Route path="/chat" element={<div>Chat Screen</div>} />
        <Route path="/superadmin" element={<div>Superadmin Screen</div>} />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminSettingsModule
                currentUser={authState.currentUser as any}
              />
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Suite 1 — Route-level RBAC via ProtectedRoute
// ---------------------------------------------------------------------------

describe('RBAC: ProtectedRoute blocks non-admin users from /admin/*', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getOrganizationMembers.mockResolvedValue([]);
  });

  it('redirects a USER-role account away from /admin to /chat', () => {
    renderAdminWithProtectedRoute('USER');
    // ProtectedRoute should redirect to ROUTES.DASHBOARD (/chat).
    expect(screen.getByText('Chat Screen')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-sidebar')).not.toBeInTheDocument();
  });

  it('redirects an unauthenticated session away from /admin to /login', () => {
    authState.currentUser = { ...makeUser('USER'), isAuthenticated: false };
    authState.isAuthInitializing = false;

    render(
      <MemoryRouter initialEntries={['/admin/people']}>
        <Routes>
          <Route path="/login" element={<div>Login Screen</div>} />
          <Route path="/chat" element={<div>Chat Screen</div>} />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminSettingsModule currentUser={authState.currentUser as any} />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Screen')).toBeInTheDocument();
  });

  it('redirects SUPERADMIN away from /admin/* to /superadmin (ADM-RAW-P0-001)', () => {
    renderAdminWithProtectedRoute('SUPERADMIN');
    // SUPERADMIN must NOT silently inherit tenant ADMIN access.
    expect(screen.getByText('Superadmin Screen')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-sidebar')).not.toBeInTheDocument();
  });

  it('admits ADMIN-role user into the admin shell', async () => {
    renderAdminWithProtectedRoute('ADMIN');
    // The sidebar is rendered — the shell is accessible.
    expect(await screen.findByTestId('admin-sidebar')).toBeInTheDocument();
    expect(screen.queryByText('Chat Screen')).not.toBeInTheDocument();
  });

  it('admits OWNER-role user into the admin shell', async () => {
    renderAdminWithProtectedRoute('OWNER');
    expect(await screen.findByTestId('admin-sidebar')).toBeInTheDocument();
    expect(screen.queryByText('Chat Screen')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Team & Access panel visible for ADMIN
// ---------------------------------------------------------------------------

describe('RBAC: ADMIN sees Team & Access panel with invite CTA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getOrganizationMembers.mockResolvedValue(MEMBERS_FIXTURE);
    authState.currentUser = makeUser('ADMIN', { authenticated: true });
    // Override user_id so the viewer is the ADMIN member in the fixture.
    authState.currentUser!.id = 'viewer-admin';
  });

  it('renders the "Team & Access" section heading', async () => {
    // The mocked useAppStore exposes the ADMIN viewer as currentUser.
    render(
      <MemoryRouter initialEntries={['/admin/people']}>
        <AdminSettingsModule currentUser={authState.currentUser as any} />
      </MemoryRouter>
    );

    expect(await screen.findByText('Team & Access')).toBeInTheDocument();
  });

  it('renders the "Add member" invite CTA when viewer is ADMIN in the members list', async () => {
    // Seed the members list with the ADMIN viewer so canManageTeam evaluates true.
    mockedApi.getOrganizationMembers.mockResolvedValue([
      {
        user_id: 'viewer-admin',
        email: 'admin@acme.test',
        role: 'ADMIN',
        first_name: 'Admin',
        last_name: 'User',
      },
      ...MEMBERS_FIXTURE.filter((m) => m.role !== 'OWNER'),
    ]);

    render(
      <MemoryRouter initialEntries={['/admin/people']}>
        <AdminSettingsModule currentUser={authState.currentUser as any} />
      </MemoryRouter>
    );

    // "Add member" button is the invite CTA.
    expect(await screen.findByText('Add member')).toBeInTheDocument();
    // Email input for invite is present.
    expect(screen.getByPlaceholderText('member@company.com')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — OWNER can trigger role changes via the API
// ---------------------------------------------------------------------------

describe('RBAC: OWNER can change member roles via the governed admin IAM command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getOrganizationMembers.mockResolvedValue([
      {
        user_id: 'owner-viewer',
        email: 'owner@acme.test',
        role: 'OWNER',
        first_name: 'Alice',
        last_name: 'Owner',
      },
      {
        user_id: 'target-member',
        email: 'member@acme.test',
        role: 'MEMBER',
        first_name: 'Bob',
        last_name: 'Member',
      },
    ]);
    mockedApi.changeAdminOrganizationMemberRole.mockResolvedValue({ success: true });

    // The OWNER is the viewer.
    authState.currentUser = { ...makeUser('OWNER'), id: 'owner-viewer' };
    authState.currentOrganization = { id: 'org-test-1' };
  });

  it('calls the governed role command with org/member/role/stale-state identity', async () => {
    render(<AdminMembersRolesPanel />);

    // Scope to the desktop table. The component intentionally renders a
    // separate CSS-hidden mobile card tree, which jsdom also exposes.
    const memberEmail = (await screen.findAllByText('member@acme.test')).find((node) =>
      node.closest('tr')
    );
    expect(memberEmail).toBeTruthy();
    const row = memberEmail!.closest('tr');
    expect(row).toBeTruthy();

    // The role <select> for Bob the Member sits in the same row.
    const roleSelect = row!.querySelector('select') as HTMLSelectElement;
    expect(roleSelect).toBeTruthy();
    expect(roleSelect.value).toBe('MEMBER');

    // Change Bob's role to ADMIN.
    fireEvent.change(roleSelect, { target: { value: 'ADMIN' } });

    await waitFor(() =>
      expect(mockedApi.changeAdminOrganizationMemberRole).toHaveBeenCalledWith(
        'org-test-1',
        'target-member',
        'ADMIN',
        'MEMBER',
        expect.any(String)
      )
    );
  });

  it('blocks role escalation to OWNER via the inline select (option is disabled)', async () => {
    render(<AdminMembersRolesPanel />);

    const memberEmail = (await screen.findAllByText('member@acme.test')).find((node) =>
      node.closest('tr')
    );
    expect(memberEmail).toBeTruthy();
    const row = memberEmail!.closest('tr');
    const roleSelect = row!.querySelector('select') as HTMLSelectElement;

    // The OWNER option must exist in the DOM but be disabled — the UI must not
    // allow direct escalation to OWNER through the inline role selector.
    const ownerOption = roleSelect.querySelector('option[value="OWNER"]') as HTMLOptionElement;
    expect(ownerOption).toBeTruthy();
    expect(ownerOption.disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Anti-escalation: SUPERADMIN not offered in UI or schema
// ---------------------------------------------------------------------------

describe('Anti-escalation: SUPERADMIN role is absent from invite/role-change UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getOrganizationMembers.mockResolvedValue([
      {
        user_id: 'owner-viewer',
        email: 'owner@acme.test',
        role: 'OWNER',
        first_name: 'Alice',
        last_name: 'Owner',
      },
      {
        user_id: 'target-member',
        email: 'member@acme.test',
        role: 'MEMBER',
        first_name: 'Bob',
        last_name: 'Member',
      },
    ]);
    authState.currentUser = { ...makeUser('OWNER'), id: 'owner-viewer' };
    authState.currentOrganization = { id: 'org-test-1' };
  });

  it('does not expose a SUPERADMIN option in the "Add member" invite role select', async () => {
    render(<AdminMembersRolesPanel />);

    // Wait for the invite section to be rendered (has "Add member" button).
    await screen.findByText('Add member');

    // All <select> elements on the panel.
    const selects = document.querySelectorAll('select');
    for (const select of selects) {
      const optionValues = Array.from(select.querySelectorAll('option')).map(
        (o) => (o as HTMLOptionElement).value
      );
      expect(optionValues).not.toContain('SUPERADMIN');
    }
  });

  it('does not expose a SUPERADMIN option in the member role-change select', async () => {
    render(<AdminMembersRolesPanel />);

    const memberEmail = (await screen.findAllByText('member@acme.test')).find((node) =>
      node.closest('tr')
    );
    expect(memberEmail).toBeTruthy();
    const row = memberEmail!.closest('tr');
    const roleSelect = row!.querySelector('select') as HTMLSelectElement;

    const optionValues = Array.from(roleSelect.querySelectorAll('option')).map(
      (o) => (o as HTMLOptionElement).value
    );
    expect(optionValues).not.toContain('SUPERADMIN');
  });

  it('MemberRoleEnum Zod schema rejects SUPERADMIN (server-side validator)', async () => {
    // Import the actual Zod schema from the server validators.
    // This is a pure function — no network, no DOM.
    const { UpdateMemberRoleSchema } = await import(
      '../../../server/src/validators/organization.validators'
    );

    const result = UpdateMemberRoleSchema.safeParse({ role: 'SUPERADMIN' });
    expect(result.success).toBe(false);
  });

  it('MemberRoleEnum Zod schema accepts the legitimate org roles', async () => {
    const { UpdateMemberRoleSchema } = await import(
      '../../../server/src/validators/organization.validators'
    );

    for (const role of ['OWNER', 'ADMIN', 'MEMBER', 'GUEST', 'USER', 'VIEWER', 'CONSULTANT']) {
      const result = UpdateMemberRoleSchema.safeParse({ role });
      expect(result.success, `Expected ${role} to be accepted`).toBe(true);
    }
  });
});
