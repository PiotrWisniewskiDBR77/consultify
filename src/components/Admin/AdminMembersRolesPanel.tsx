import { Copy, Crown, KeyRound, Shield, Trash2, UserPlus, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { OwnershipManagementView } from '../../views/admin/OwnershipManagementView';
import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import type { TableColumn } from '../shared/ModuleHub/FilterableTable';
import { FilterableTable } from '../shared/ModuleHub/FilterableTable';
import { Button, Input, SelectField } from '../ui/primitives';
import { EntityStatusChip } from '../ui/primitives/chips';

type RoleOption = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

const ROLE_GUIDANCE: Array<{ role: RoleOption; description: string; denial: string }> = [
  {
    role: 'OWNER',
    description: 'Full workspace control, ownership transfer, and owner-only safeguards.',
    denial: 'Only an owner can assign or remove another owner.',
  },
  {
    role: 'ADMIN',
    description: 'Can manage team members, member roles, and team invite codes.',
    denial: 'Cannot change owner membership or bypass owner protections.',
  },
  {
    role: 'MEMBER',
    description: 'Standard workspace access without team administration permissions.',
    denial: 'Cannot open Team Admin or change membership.',
  },
  {
    role: 'GUEST',
    description: 'Restricted collaborator role with no admin access.',
    denial: 'Guests cannot access admin tools.',
  },
];

export const AdminMembersRolesPanel: React.FC = () => {
  const { t } = useTranslation();
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
  // M15-H03: błąd wczytywania MUSI zostać jawnym stanem błędu. Toast znika po
  // kilku sekundach, a pusta tabela z komunikatem „brak członków" kłamie —
  // administrator widział organizację bez ludzi zamiast informacji o awarii.
  const [loadError, setLoadError] = useState<string | null>(null);

  const orgId = currentOrganization?.id;
  const viewerMembership = useMemo(
    () =>
      members.find(
        (member) => String(member.user_id ?? member.id ?? '') === String(currentUser?.id ?? '')
      ),
    [members, currentUser?.id]
  );
  // Org membership role is authoritative when present. When the viewer's own
  // membership row is not in the loaded list yet (or the list is empty), fall
  // back to the platform role so a real admin/owner is never blocked with a
  // silent no-op. The server remains the final authority (requireRole + controller).
  const platformRole = String(currentUser?.role || '').toUpperCase();
  const platformCanManage = ['OWNER', 'ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'].includes(platformRole);
  const canManageTeam =
    ['OWNER', 'ADMIN'].includes(String(viewerMembership?.role || '').toUpperCase()) ||
    platformCanManage;

  const loadMembers = useCallback(async () => {
    if (!orgId) {
      setMembers([]);
      setLoadError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);
      const data = await Api.getOrganizationMembers(orgId);
      setMembers(Array.isArray(data) ? data : []);
    } catch (error: any) {
      const message =
        error?.message || t('admin.membersRoles.loadFailed', 'Failed to load members');
      toast.error(message);
      // Świadomie NIE czyścimy listy do pustej — brak danych z powodu awarii to
      // stan degraded, nie „zero członków".
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [orgId, t]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  // RFC-lite email check — mirrors the server-side z.string().email() so we fail
  // fast with a visible, field-level message instead of a silent round-trip.
  const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleInvite = async () => {
    setInviteNotice(null);
    setInviteError(null);

    if (!orgId) {
      setInviteError(
        t(
          'admin.membersRoles.invite.noOrg',
          'No active organization — reload the page and try again.'
        )
      );
      return;
    }
    if (!canManageTeam) {
      const msg = t(
        'admin.membersRoles.invite.denied',
        'Only a team owner or admin can add members.'
      );
      setInviteError(msg);
      toast.error(msg);
      return;
    }
    if (inviteRole === 'OWNER') {
      const msg = t(
        'admin.membersRoles.invite.ownerFlow',
        'Owner changes must use the ownership transfer flow.'
      );
      setInviteError(msg);
      toast.error(msg);
      return;
    }

    const email = inviteEmail.trim();
    if (!email) {
      setInviteError(
        t('admin.membersRoles.invite.emptyEmail', 'Enter an email address before adding a member.')
      );
      return;
    }
    if (!isValidEmail(email)) {
      setInviteError(
        t(
          'admin.membersRoles.invite.invalidEmail',
          'Enter a valid email address (e.g. member@company.com).'
        )
      );
      return;
    }

    try {
      setInviting(true);
      await Api.addOrganizationMember(orgId, email, inviteRole);
      const msg = t('admin.membersRoles.invite.added', '{{email}} added to the workspace.', {
        email,
      });
      setInviteNotice(msg);
      toast.success(t('admin.membersRoles.invite.addedToast', 'Member added to workspace'));
      setInviteEmail('');
      setInviteRole('MEMBER');
      await loadMembers();
    } catch (error: any) {
      // Surface the concrete server reason (e.g. USER_NOT_FOUND, MEMBER_ALREADY_EXISTS)
      // both inline and as a toast so it is never a silent no-op.
      const raw = String(error?.message || '');
      const friendly = /not\s*found/i.test(raw)
        ? t(
            'admin.membersRoles.invite.notFound',
            'No account exists for that email yet. Use the Team Invite Code below so they can self-register, or create the account first.'
          )
        : raw || t('admin.membersRoles.invite.failed', 'Failed to add member.');
      setInviteError(friendly);
      toast.error(friendly);
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: RoleOption) => {
    if (!orgId) return;
    if (!canManageTeam) {
      toast.error(
        t('admin.membersRoles.role.denied', 'Only a team owner or admin can change member roles')
      );
      return;
    }
    if (role === 'OWNER') {
      toast.error(
        t('admin.membersRoles.role.ownerFlow', 'Owner changes must use the ownership transfer flow')
      );
      return;
    }
    try {
      setSavingMemberId(memberId);
      await Api.updateOrganizationMemberRole(orgId, memberId, role);
      toast.success(t('admin.membersRoles.role.updated', 'Member role updated'));
      await loadMembers();
    } catch (error: any) {
      toast.error(
        error?.message || t('admin.membersRoles.role.updateFailed', 'Failed to update role')
      );
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!orgId) return;
    if (!canManageTeam) {
      toast.error(
        t('admin.membersRoles.remove.denied', 'Only a team owner or admin can remove members')
      );
      return;
    }
    try {
      setSavingMemberId(memberId);
      await Api.removeOrganizationMember(orgId, memberId);
      toast.success(t('admin.membersRoles.remove.removed', 'Member removed'));
      await loadMembers();
    } catch (error: any) {
      toast.error(
        error?.message || t('admin.membersRoles.remove.failed', 'Failed to remove member')
      );
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleGenerateInviteCode = async () => {
    if (!orgId) return;
    if (!canManageTeam) {
      toast.error(
        t('admin.membersRoles.code.denied', 'Only a team owner or admin can generate invite codes')
      );
      return;
    }

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
        throw new Error(t('admin.membersRoles.code.noCode', 'Code was not returned by the server'));
      }

      setGeneratedInviteCode(code);
      toast.success(t('admin.membersRoles.code.generated', 'Access code generated'));
    } catch (error: any) {
      toast.error(
        error?.message ||
          t('admin.membersRoles.code.generateFailed', 'Failed to generate access code')
      );
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
      toast.error(t('admin.membersRoles.code.copyFailed', 'Failed to copy to clipboard'));
    }
  };

  const roleLabels: Record<RoleOption, string> = {
    OWNER: t('admin.membersRoles.roles.owner', 'Owner'),
    ADMIN: t('admin.membersRoles.roles.admin', 'Admin'),
    MEMBER: t('admin.membersRoles.roles.member', 'Member'),
    GUEST: t('admin.membersRoles.roles.guest', 'Guest'),
  };

  const memberColumns: TableColumn[] = [
    {
      id: 'name',
      label: t('admin.membersRoles.columns.member', 'Member'),
      width: '200px',
      render: (row) => <span className="font-medium text-c-text">{row.name}</span>,
    },
    {
      id: 'email',
      label: t('admin.membersRoles.columns.email', 'Email'),
      width: '220px',
      render: (row) => <span className="text-c-text-secondary">{row.email}</span>,
    },
    {
      id: 'role',
      label: t('admin.membersRoles.columns.role', 'Role'),
      width: '200px',
      filterable: true,
      filterOptions: [
        { value: 'OWNER', label: roleLabels.OWNER },
        { value: 'ADMIN', label: roleLabels.ADMIN },
        { value: 'MEMBER', label: roleLabels.MEMBER },
        { value: 'GUEST', label: roleLabels.GUEST },
      ],
      render: (row) => {
        const isBusy = savingMemberId === row.memberId;
        const ownerProtected = row.role === 'OWNER';
        if (!canManageTeam) {
          return <span className="text-sm text-c-text-secondary">{roleLabels[row.role as RoleOption]}</span>;
        }
        return (
          <div onClick={(e) => e.stopPropagation()} className="max-w-[160px]">
            <SelectField
              value={row.role}
              disabled={isBusy || ownerProtected}
              onChange={(value) => void handleRoleChange(row.memberId, value as RoleOption)}
              placeholder=""
              options={[
                { value: 'OWNER', label: roleLabels.OWNER, disabled: true },
                { value: 'ADMIN', label: roleLabels.ADMIN },
                { value: 'MEMBER', label: roleLabels.MEMBER },
                { value: 'GUEST', label: roleLabels.GUEST },
              ]}
            />
          </div>
        );
      },
    },
    {
      id: 'memberStatus',
      label: t('admin.membersRoles.columns.status', 'Status'),
      width: '120px',
      render: (row) => (
        <EntityStatusChip status={String(row.memberStatus || 'active').toLowerCase()} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Role guidance cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ROLE_GUIDANCE.map((item) => (
          <div
            key={item.role}
            className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-4"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-c-text">
              {item.role === 'OWNER' ? (
                <Crown className="h-4 w-4 text-c-warning" />
              ) : item.role === 'ADMIN' ? (
                <Shield className="h-4 w-4 text-c-accent" />
              ) : (
                <Users className="h-4 w-4 text-c-text-muted" />
              )}
              {roleLabels[item.role]}
            </div>
            <p className="mt-2 text-sm text-c-text-secondary">
              {t(
                `admin.membersRoles.guidance.${item.role.toLowerCase()}.description`,
                item.description
              )}
            </p>
            <p className="mt-2 text-xs text-c-text-muted">
              {t(`admin.membersRoles.guidance.${item.role.toLowerCase()}.denial`, item.denial)}
            </p>
          </div>
        ))}
      </div>

      {/* Members table + invite */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-c-text">
              {t('admin.membersRoles.title', 'Members & Roles')}
            </h3>
            <p className="text-sm text-c-text-muted">
              {t(
                'admin.membersRoles.subtitle',
                'Canonical P32 surface for membership, role changes, and ownership safeguards.'
              )}
            </p>
          </div>
          {canManageTeam ? <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr),160px,auto] sm:items-end">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(event) => {
                setInviteEmail(event.target.value);
                if (inviteError) setInviteError(null);
                if (inviteNotice) setInviteNotice(null);
              }}
              placeholder={t('admin.membersRoles.invite.placeholder', 'member@company.com')}
              aria-label={t('admin.membersRoles.invite.emailLabel', 'Member email')}
            />
            <SelectField
              value={inviteRole}
              onChange={(value) => setInviteRole(value as RoleOption)}
              placeholder=""
              options={[
                { value: 'MEMBER', label: roleLabels.MEMBER },
                { value: 'ADMIN', label: roleLabels.ADMIN },
                { value: 'GUEST', label: roleLabels.GUEST },
              ]}
            />
            <Button
              variant="primary"
              onClick={() => void handleInvite()}
              loading={inviting}
              icon={<UserPlus className="h-4 w-4" />}
            >
              {t('admin.membersRoles.invite.cta', 'Add member')}
            </Button>
          </div> : (
            <p role="status" className="text-sm text-c-text-muted">
              {t('admin.membersRoles.readOnly', 'Read-only access. Management controls are available only to workspace owners and admins.')}
            </p>
          )}
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
          <div className="mt-5 py-8 text-center text-sm text-c-text-muted">
            {t('admin.membersRoles.loading', 'Loading members…')}
          </div>
        ) : loadError ? (
          /* M15-H03 — stan błędu/degraded zamiast fałszywej pustki. */
          <div
            role="alert"
            data-testid="members-load-error"
            className="mt-5 rounded-xl border border-c-danger/40 bg-c-danger/10 p-5 text-center"
          >
            <div className="text-sm font-semibold text-c-danger">
              {t(
                'admin.membersRoles.loadErrorTitle',
                'Nie udało się wczytać listy członków tej organizacji.'
              )}
            </div>
            <p className="mt-1 text-sm text-c-text-secondary">
              {t('admin.membersRoles.loadErrorBody', {
                defaultValue:
                  'To awaria odczytu, a nie informacja, że organizacja nie ma członków. Szczegóły: {{reason}}',
                reason: loadError,
              })}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void loadMembers()}
            >
              {t('admin.membersRoles.loadErrorRetry', 'Spróbuj ponownie')}
            </Button>
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
                  t('admin.membersRoles.unknownMember', 'Unknown member'),
                email: member.email,
                role: String(member.role || 'MEMBER').toUpperCase(),
                memberStatus: member.status || 'ACTIVE',
              }))}
              getRowActions={(row) => {
                const ownerProtected = row.role === 'OWNER';
                const selfProtected = row.memberId === currentUser?.id;
                const isBusy = savingMemberId === row.memberId;
                if (!canManageTeam || ownerProtected || selfProtected || isBusy) return [];
                return [
                  {
                    id: 'remove',
                    label: t('admin.membersRoles.remove.action', 'Remove'),
                    icon: Trash2,
                    variant: 'danger' as const,
                    onClick: () => void handleRemove(row.memberId),
                  },
                ];
              }}
              activeFilters={memberFilters}
              onFilterChange={setMemberFilters}
              emptyMessage={t('admin.membersRoles.empty', 'No members found for this workspace.')}
              persistKey="admin-members-table"
              canvasClassName=""
            />
          </div>
        )}
      </div>

      {/* Forbidden controls are not rendered for non-managing personas. */}
      {canManageTeam && <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-c-text">
              {t('admin.membersRoles.code.title', 'Team Invite Code')}
            </h3>
            <p className="text-sm text-c-text-muted">
              {t(
                'admin.membersRoles.code.subtitle',
                'Generate one shared code for team onboarding. The default limit is set to 50 members and you can copy the ready registration link below.'
              )}
            </p>
            <p className="mt-2 text-xs text-c-text-muted">
              {t(
                'admin.membersRoles.code.note',
                'Team members register with email and password after opening the invite link. Phone number remains optional.'
              )}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[160px,120px,auto] sm:items-end">
            <SelectField
              value={generatedInviteRole}
              onChange={(value) => setGeneratedInviteRole(value as RoleOption)}
              placeholder=""
              options={[
                { value: 'MEMBER', label: roleLabels.MEMBER },
                { value: 'GUEST', label: roleLabels.GUEST },
                { value: 'ADMIN', label: roleLabels.ADMIN },
              ]}
            />
            <Input
              type="number"
              min={1}
              max={500}
              value={generatedInviteMaxUses}
              aria-label={t('admin.membersRoles.code.maxUsesLabel', 'Maximum team registrations')}
              onChange={(event) =>
                setGeneratedInviteMaxUses(
                  Math.min(500, Math.max(1, Number(event.target.value || 1)))
                )
              }
            />
            <Button
              variant="primary"
              onClick={() => void handleGenerateInviteCode()}
              loading={isGeneratingCode}
              icon={<KeyRound className="h-4 w-4" />}
            >
              {t('admin.membersRoles.code.cta', 'Generate code')}
            </Button>
          </div>
        </div>

        {generatedInviteCode && (
          <div className="mt-5 rounded-xl border border-c-info/30 bg-c-info/10 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-c-info">
              {t('admin.membersRoles.code.ready', 'Ready for team onboarding')}
            </div>
            <div className="mt-2 flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs text-c-text-muted">
                    {t('admin.membersRoles.code.accessCode', 'Access code')}
                  </div>
                  <div className="font-mono text-lg font-semibold text-c-text">
                    {generatedInviteCode}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void copyValue(
                      generatedInviteCode,
                      t('admin.membersRoles.code.codeCopied', 'Access code copied')
                    )
                  }
                  icon={<Copy className="h-4 w-4" />}
                >
                  {t('admin.membersRoles.code.copyCode', 'Copy code')}
                </Button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs text-c-text-muted">
                    {t('admin.membersRoles.code.regLink', 'Registration link')}
                  </div>
                  <div className="truncate text-sm text-c-text">{registrationLink}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void copyValue(
                      registrationLink,
                      t('admin.membersRoles.code.linkCopied', 'Registration link copied')
                    )
                  }
                  icon={<Copy className="h-4 w-4" />}
                >
                  {t('admin.membersRoles.code.copyLink', 'Copy link')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>}

      {canManageTeam && <OwnershipManagementView />}
    </div>
  );
};

export default AdminMembersRolesPanel;
