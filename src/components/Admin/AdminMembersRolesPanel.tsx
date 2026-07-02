import { Copy, Crown, KeyRound, Loader2, Shield, Trash2, UserPlus, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { EntityStatusChip } from '../ui/primitives/chips';
import { FilterableTable } from '../shared/ModuleHub/FilterableTable';
import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import type { TableColumn } from '../shared/ModuleHub/FilterableTable';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../utils/cn';
import { OwnershipManagementView } from '../../views/admin/OwnershipManagementView';

type RoleOption = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

const ROLE_GUIDANCE: Array<{
  role: RoleOption;
  title: string;
  description: string;
  denial: string;
}> = [
  {
    role: 'OWNER',
    title: 'Owner',
    description: 'Full workspace control, ownership transfer, and owner-only safeguards.',
    denial: 'Only an owner can assign or remove another owner.',
  },
  {
    role: 'ADMIN',
    title: 'Admin',
    description: 'Can manage team members, member roles, and team invite codes.',
    denial: 'Cannot change owner membership or bypass owner protections.',
  },
  {
    role: 'MEMBER',
    title: 'Member',
    description: 'Standard workspace access without team administration permissions.',
    denial: 'Cannot open Team Admin or change membership.',
  },
  {
    role: 'GUEST',
    title: 'Guest',
    description: 'Restricted collaborator role with no admin access.',
    denial: 'Guests cannot access admin tools.',
  },
];

export const AdminMembersRolesPanel: React.FC = () => {
  const { currentOrganization, currentUser } = useAppStore();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<RoleOption>('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [generatedInviteCode, setGeneratedInviteCode] = useState<string | null>(null);
  const [generatedInviteRole, setGeneratedInviteRole] = useState<RoleOption>('MEMBER');
  const [generatedInviteMaxUses, setGeneratedInviteMaxUses] = useState(50);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [memberFilters, setMemberFilters] = useState<FilterChip[]>([]);

  const orgId = currentOrganization?.id;
  const viewerMembership = useMemo(
    () =>
      members.find(
        (member) =>
          String(member.user_id ?? member.id ?? '') === String(currentUser?.id ?? '')
      ),
    [members, currentUser?.id]
  );
  // Org membership role is authoritative when present. When the viewer's own
  // membership row is not in the loaded list yet (or the list is empty), fall
  // back to the platform role so a real admin/owner is never blocked with a
  // silent no-op. The server remains the final authority (requireRole + controller).
  const platformRole = String(currentUser?.role || '').toUpperCase();
  const platformCanManage = ['OWNER', 'ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'].includes(
    platformRole
  );
  const canManageTeam =
    ['OWNER', 'ADMIN'].includes(String(viewerMembership?.role || '').toUpperCase()) ||
    platformCanManage;

  const loadMembers = useCallback(async () => {
    if (!orgId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await Api.getOrganizationMembers(orgId);
      setMembers(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load members');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  // RFC-lite email check — mirrors the server-side z.string().email() so we fail
  // fast with a visible, field-level message instead of a silent round-trip.
  const isValidEmail = (value: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleInvite = async () => {
    setInviteNotice(null);
    setInviteError(null);

    if (!orgId) {
      setInviteError('No active organization — reload the page and try again.');
      return;
    }
    if (!canManageTeam) {
      const msg = 'Only a team owner or admin can add members.';
      setInviteError(msg);
      toast.error(msg);
      return;
    }
    if (inviteRole === 'OWNER') {
      const msg = 'Owner changes must use the ownership transfer flow.';
      setInviteError(msg);
      toast.error(msg);
      return;
    }

    const email = inviteEmail.trim();
    if (!email) {
      setInviteError('Enter an email address before adding a member.');
      return;
    }
    if (!isValidEmail(email)) {
      setInviteError('Enter a valid email address (e.g. member@company.com).');
      return;
    }

    try {
      setInviting(true);
      await Api.addOrganizationMember(orgId, email, inviteRole);
      const msg = `${email} added to the workspace.`;
      setInviteNotice(msg);
      toast.success('Member added to workspace');
      setInviteEmail('');
      setInviteRole('MEMBER');
      await loadMembers();
    } catch (error: any) {
      // Surface the concrete server reason (e.g. USER_NOT_FOUND, MEMBER_ALREADY_EXISTS)
      // both inline and as a toast so it is never a silent no-op.
      const raw = String(error?.message || '');
      const friendly = /not\s*found/i.test(raw)
        ? 'No account exists for that email yet. Use the Team Invite Code below so they can self-register, or create the account first.'
        : raw || 'Failed to add member.';
      setInviteError(friendly);
      toast.error(friendly);
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: RoleOption) => {
    if (!orgId) return;
    if (!canManageTeam) {
      toast.error('Only a team owner or admin can change member roles');
      return;
    }
    if (role === 'OWNER') {
      toast.error('Owner changes must use the ownership transfer flow');
      return;
    }
    try {
      setSavingMemberId(memberId);
      await Api.updateOrganizationMemberRole(orgId, memberId, role);
      toast.success('Member role updated');
      await loadMembers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update role');
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!orgId) return;
    try {
      setSavingMemberId(memberId);
      await Api.removeOrganizationMember(orgId, memberId);
      toast.success('Member removed');
      await loadMembers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove member');
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleGenerateInviteCode = async () => {
    if (!orgId) return;

    try {
      setIsGeneratingCode(true);
      const response = await Api.post('/access-codes/generate', {
        type: 'INVITE',
        organizationId: orgId,
        maxUses: generatedInviteMaxUses,
        expiresInDays: 7,
        metadata: { invitedRole: generatedInviteRole },
      });

      const code = response?.code?.code || response?.code;
      if (!code) {
        throw new Error('Code was not returned by the server');
      }

      setGeneratedInviteCode(code);
      toast.success('Access code generated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to generate access code');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const registrationLink = generatedInviteCode
    ? `${window.location.origin}/register?invite=${encodeURIComponent(generatedInviteCode)}`
    : '';

  const copyValue = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const memberColumns: TableColumn[] = [
    {
      id: 'name',
      label: 'Member',
      width: '200px',
      render: (row) => (
        <span className="font-medium text-slate-900 dark:text-white">{row.name}</span>
      ),
    },
    {
      id: 'email',
      label: 'Email',
      width: '220px',
      render: (row) => (
        <span className="text-slate-600 dark:text-slate-300">{row.email}</span>
      ),
    },
    {
      id: 'role',
      label: 'Role',
      width: '200px',
      filterable: true,
      filterOptions: [
        { value: 'OWNER', label: 'Owner' },
        { value: 'ADMIN', label: 'Admin' },
        { value: 'MEMBER', label: 'Member' },
        { value: 'GUEST', label: 'Guest' },
      ],
      render: (row) => {
        const isBusy = savingMemberId === row.memberId;
        const ownerProtected = row.role === 'OWNER';
        return (
          <select
            value={row.role}
            disabled={isBusy || ownerProtected}
            onClick={(e) => e.stopPropagation()}
            onChange={(event) =>
              void handleRoleChange(row.memberId, event.target.value as RoleOption)
            }
            className={cn(
              'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-navy-900 dark:text-white',
              (isBusy || ownerProtected) && 'opacity-60'
            )}
          >
            <option value="OWNER" disabled>Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
            <option value="GUEST">Guest</option>
          </select>
        );
      },
    },
    {
      id: 'memberStatus',
      label: 'Status',
      width: '120px',
      render: (row) => <EntityStatusChip status={String(row.memberStatus || 'active').toLowerCase()} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ROLE_GUIDANCE.map((item) => (
          <div
            key={item.role}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              {item.role === 'OWNER' ? (
                <Crown className="h-4 w-4 text-amber-500" />
              ) : item.role === 'ADMIN' ? (
                <Shield className="h-4 w-4 text-primary-500" />
              ) : (
                <Users className="h-4 w-4 text-slate-500" />
              )}
              {item.title}
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{item.denial}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Members & Roles
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Canonical P32 surface for membership, role changes, and ownership safeguards.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr),160px,auto]">
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => {
                setInviteEmail(event.target.value);
                if (inviteError) setInviteError(null);
                if (inviteNotice) setInviteNotice(null);
              }}
              placeholder="member@company.com"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-navy-900 dark:text-white"
            />
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as RoleOption)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-navy-900 dark:text-white"
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
              <option value="GUEST">Guest</option>
            </select>
            <button
              type="button"
              onClick={() => void handleInvite()}
              disabled={inviting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50"
            >
              {inviting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Add member
            </button>
          </div>
        </div>

        {inviteError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-c-danger/40 bg-c-danger/10 px-3 py-2 text-sm text-c-danger"
          >
            {inviteError}
          </div>
        )}
        {inviteNotice && (
          <div
            role="status"
            className="mt-4 rounded-lg border border-c-success/40 bg-c-success/10 px-3 py-2 text-sm text-c-success"
          >
            {inviteNotice}
          </div>
        )}

        {loading ? (
          <div className="mt-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading members...
          </div>
        ) : (
          <div className="mt-5">
            <FilterableTable
              columns={memberColumns}
              data={members.map((member) => ({
                id: member.user_id || member.id,
                memberId: member.user_id,
                name:
                  `${member.first_name || ''} ${member.last_name || ''}`.trim() ||
                  member.email?.split('@')[0] ||
                  'Unknown member',
                email: member.email,
                role: String(member.role || 'MEMBER').toUpperCase(),
                memberStatus: member.status || 'ACTIVE',
              }))}
              getRowActions={(row) => {
                const ownerProtected = row.role === 'OWNER';
                const selfProtected = row.memberId === currentUser?.id;
                const isBusy = savingMemberId === row.memberId;
                if (ownerProtected || selfProtected || isBusy) return [];
                return [
                  {
                    id: 'remove',
                    label: 'Remove',
                    icon: Trash2,
                    variant: 'danger' as const,
                    onClick: () => void handleRemove(row.memberId),
                  },
                ];
              }}
              activeFilters={memberFilters}
              onFilterChange={setMemberFilters}
              emptyMessage="No members found for this workspace."
              persistKey="admin-members-table"
              canvasClassName=""
            />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Team Invite Code
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Generate one shared code for team onboarding. The default limit is set to 50 members
              and you can copy the ready registration link below.
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Team members register with email and password after opening the invite link. Phone
              number remains optional.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[160px,120px,auto]">
            <select
              value={generatedInviteRole}
              onChange={(event) => setGeneratedInviteRole(event.target.value as RoleOption)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-navy-900 dark:text-white"
            >
              <option value="MEMBER">Member</option>
              <option value="GUEST">Guest</option>
              <option value="ADMIN">Admin</option>
            </select>
            <input
              type="number"
              min={1}
              max={500}
              value={generatedInviteMaxUses}
              aria-label="Maximum team registrations"
              onChange={(event) =>
                setGeneratedInviteMaxUses(
                  Math.min(500, Math.max(1, Number(event.target.value || 1)))
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-navy-900 dark:text-white"
            />
            <button
              onClick={() => void handleGenerateInviteCode()}
              disabled={isGeneratingCode}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50"
            >
              {isGeneratingCode ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Generate code
            </button>
          </div>
        </div>

        {generatedInviteCode && (
          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Ready for team onboarding
            </div>
            <div className="mt-2 flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Access code</div>
                  <div className="font-mono text-lg font-semibold text-slate-900 dark:text-white">
                    {generatedInviteCode}
                  </div>
                </div>
                <button
                  onClick={() => void copyValue(generatedInviteCode, 'Access code copied')}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-white/10 dark:bg-navy-900 dark:text-slate-300"
                >
                  <Copy className="h-4 w-4" />
                  Copy code
                </button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Registration link
                  </div>
                  <div className="truncate text-sm text-slate-900 dark:text-white">
                    {registrationLink}
                  </div>
                </div>
                <button
                  onClick={() => void copyValue(registrationLink, 'Registration link copied')}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-white/10 dark:bg-navy-900 dark:text-slate-300"
                >
                  <Copy className="h-4 w-4" />
                  Copy link
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <OwnershipManagementView />
    </div>
  );
};

export default AdminMembersRolesPanel;
