import { Copy, Crown, KeyRound, RotateCw, Shield, Trash2, UserPlus, Users, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { OwnershipManagementView } from '../../views/admin/OwnershipManagementView';
import { StandardTable } from '../standard/StandardTable';
import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import type { TableColumn } from '../shared/ModuleHub/FilterableTable';
import { FilterableTable } from '../shared/ModuleHub/FilterableTable';
import { Button, Input, SelectField } from '../ui/primitives';
import { EntityStatusChip } from '../ui/primitives/chips';

type RoleOption = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

type InvitationRow = {
  id: string;
  email: string;
  role?: string;
  role_to_assign?: string;
  status: string;
  expires_at?: string;
  resend_count?: number;
  last_resent_at?: string;
  expiresAt?: string;
  resendCount?: number;
  lastResentAt?: string;
  delivery?: 'SENT' | 'NOT_SENT' | 'UNKNOWN';
};

const inviteCommandStorageKey = (orgId: string, email: string, role: string) =>
  `consultify:admin-invite-command:${orgId}:${email.trim().toLowerCase()}:${role}`;

const getOrCreateInviteCommandId = (orgId: string, email: string, role: string): string => {
  const key = inviteCommandStorageKey(orgId, email, role);
  const stored = sessionStorage.getItem(key);
  if (stored) return stored;
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  sessionStorage.setItem(key, value);
  return value;
};

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
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
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
  const [invitationLoadError, setInvitationLoadError] = useState<string | null>(null);
  const [savingInvitationId, setSavingInvitationId] = useState<string | null>(null);

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
      const message = error?.message || 'Failed to load members';
      toast.error(message);
      // Świadomie NIE czyścimy listy do pustej — brak danych z powodu awarii to
      // stan degraded, nie „zero członków".
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const loadInvitations = useCallback(async (): Promise<InvitationRow[]> => {
    if (!orgId) {
      setInvitations([]);
      setInvitationLoadError(null);
      return [];
    }
    try {
      setInvitationLoadError(null);
      const data = await Api.getInvitations(orgId);
      const rows = Array.isArray(data) ? data : [];
      setInvitations(rows);
      return rows;
    } catch (error: any) {
      setInvitationLoadError(
        error?.message || 'Failed to load invitations'
      );
      return [];
    }
  }, [orgId]);

  useEffect(() => {
    void loadMembers();
    void loadInvitations();
  }, [loadInvitations, loadMembers]);

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
      const commandId = getOrCreateInviteCommandId(orgId, email, inviteRole);
      const response = await Api.createAdminOrganizationInvitation(orgId, email, inviteRole, commandId);
      const receiptId = String(response?.invitation?.id || response?.id || '');
      const fresh = await loadInvitations();
      const readback = fresh.find((row) => row.id === receiptId);
      if (!receiptId || !readback) {
        throw new Error(
          t('admin.membersRoles.invite.readbackFailed', 'Invitation was submitted but exact read-back is not available. Retry with the same command.')
        );
      }
      sessionStorage.removeItem(inviteCommandStorageKey(orgId, email, inviteRole));
      const msg = t('admin.membersRoles.invite.added', 'Invitation for {{email}} is pending acceptance. Delivery: {{delivery}}.', {
        email,
        delivery: readback.delivery || 'NOT_ATTEMPTED',
      });
      setInviteNotice(msg);
      if (readback.delivery === 'SENT') toast.success(t('admin.membersRoles.invite.addedToast', 'Invitation sent'));
      else toast.error(t('admin.membersRoles.invite.deliveryFailed', 'Invitation recorded, but email delivery failed or is unverified.'));
      setInviteEmail('');
      setInviteRole('MEMBER');
    } catch (error: any) {
      // Surface the concrete server reason (e.g. USER_NOT_FOUND, MEMBER_ALREADY_EXISTS)
      // both inline and as a toast so it is never a silent no-op.
      const raw = String(error?.message || '');
      const fresh = await loadInvitations();
      const recovered = fresh.find(
        (row) =>
          row.email?.toLowerCase() === email.toLowerCase() &&
          String(row.role_to_assign || row.role || '').toUpperCase() === inviteRole &&
          String(row.status).toLowerCase() === 'pending'
      );
      const friendly = recovered
        ? t('admin.membersRoles.invite.recovered', 'A pending invitation exists. Delivery cannot be repeated until the server resend window opens.')
        : raw || t('admin.membersRoles.invite.failed', 'Failed to create invitation. Retry uses the same command identity.');
      setInviteError(friendly);
      toast.error(friendly);
    } finally {
      setInviting(false);
    }
  };

  const handleInvitationAction = async (invitation: InvitationRow, action: 'resend' | 'revoke') => {
    if (!canManageTeam) return;
    try {
      setSavingInvitationId(invitation.id);
      const storageKey = `consultify:admin-invite-${action}:${orgId}:${invitation.id}`;
      let commandId = sessionStorage.getItem(storageKey);
      if (!commandId) {
        commandId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
        sessionStorage.setItem(storageKey, commandId);
      }
      if (action === 'resend') await Api.resendOrganizationInvitation(orgId!, invitation.id, commandId);
      else await Api.revokeOrganizationInvitation(orgId!, invitation.id, commandId);
      const fresh = await loadInvitations();
      const exact = fresh.find((row) => row.id === invitation.id);
      const expected = action === 'revoke' ? 'revoked' : 'pending';
      if (!exact || String(exact.status).toLowerCase() !== expected) {
        throw new Error('Command completed without exact invitation read-back.');
      }
      sessionStorage.removeItem(storageKey);
      toast.success(action === 'resend' ? 'Invitation resent' : 'Invitation revoked');
    } catch (error: any) {
      toast.error(error?.message || `Failed to ${action} invitation`);
    } finally {
      setSavingInvitationId(null);
    }
  };

  const handleRoleChange = async (memberId: string, role: RoleOption, expectedRole: string) => {
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
      const key = `consultify:admin-role:${orgId}:${memberId}:${expectedRole}:${role}`;
      let commandId = sessionStorage.getItem(key) || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      sessionStorage.setItem(key, commandId);
      await Api.changeAdminOrganizationMemberRole(orgId, memberId, role, expectedRole, commandId);
      toast.success(t('admin.membersRoles.role.updated', 'Member role updated'));
      await loadMembers();
      sessionStorage.removeItem(key);
    } catch (error: any) {
      toast.error(
        error?.message || t('admin.membersRoles.role.updateFailed', 'Failed to update role')
      );
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleRemove = async (memberId: string, expectedRole: string) => {
    if (!orgId) return;
    if (!canManageTeam) {
      toast.error(
        t('admin.membersRoles.remove.denied', 'Only a team owner or admin can remove members')
      );
      return;
    }
    try {
      setSavingMemberId(memberId);
      const key = `consultify:admin-revoke-member:${orgId}:${memberId}:${expectedRole}`;
      let commandId = sessionStorage.getItem(key) || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      sessionStorage.setItem(key, commandId);
      await Api.revokeAdminOrganizationMember(orgId, memberId, expectedRole, commandId);
      toast.success(t('admin.membersRoles.remove.removed', 'Member removed'));
      await loadMembers();
      sessionStorage.removeItem(key);
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
            <label
              htmlFor={`admin-member-role-select-${row.memberId}`}
              className="sr-only"
            >
              {t('admin.membersRoles.roleSelectLabel', 'Role for {{name}}', { name: row.name })}
            </label>
            <SelectField
              id={`admin-member-role-select-${row.memberId}`}
              value={row.role}
              disabled={isBusy || ownerProtected}
              onChange={(value) => void handleRoleChange(row.memberId, value as RoleOption, row.role)}
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

  const invitationColumns: TableColumn[] = [
    {
      id: 'email',
      label: t('admin.membersRoles.columns.email', 'Email'),
      width: '220px',
      render: (row) => <span className="font-medium text-c-text">{row.email}</span>,
    },
    {
      id: 'role',
      label: t('admin.membersRoles.columns.role', 'Role'),
      width: '120px',
      render: (row) => (
        <span className="text-c-text-secondary">
          {roleLabels[String(row.role_to_assign || row.role || 'MEMBER').toUpperCase() as RoleOption] || row.role_to_assign || row.role}
        </span>
      ),
    },
    {
      id: 'status',
      label: t('admin.membersRoles.columns.status', 'Status'),
      width: '120px',
      render: (row) => <EntityStatusChip status={String(row.status || 'unknown').toLowerCase()} />,
    },
    {
      id: 'delivery',
      label: t('admin.membersRoles.invitations.delivery', 'Delivery'),
      width: '130px',
      render: (row) => <EntityStatusChip status={String(row.delivery || 'NOT_ATTEMPTED').toLowerCase()} />,
    },
    {
      id: 'expiresAt',
      label: t('admin.membersRoles.invitations.expiry', 'Expires'),
      width: '190px',
      render: (row) => (
        <span className="text-c-text-secondary">
          {row.expires_at || row.expiresAt
            ? new Date(row.expires_at || row.expiresAt).toLocaleString()
            : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      label: t('admin.membersRoles.invitations.actions', 'Actions'),
      width: '230px',
      render: (row) => {
        const pending = String(row.status || '').toLowerCase() === 'pending';
        const busy = savingInvitationId === row.id;
        if (!canManageTeam || !pending) return null;
        return (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={busy} icon={<RotateCw className="h-4 w-4" />} onClick={() => void handleInvitationAction(row as InvitationRow, 'resend')}>
              {t('admin.membersRoles.invitations.resend', 'Resend')}
            </Button>
            <Button variant="outline" size="sm" disabled={busy} icon={<XCircle className="h-4 w-4" />} onClick={() => void handleInvitationAction(row as InvitationRow, 'revoke')}>
              {t('admin.membersRoles.invitations.revoke', 'Revoke')}
            </Button>
          </div>
        );
      },
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
            <div>
              <label htmlFor="admin-invite-role-select" className="sr-only">
                {t('admin.membersRoles.invite.roleLabel', 'Invite role')}
              </label>
              <SelectField
                id="admin-invite-role-select"
                value={inviteRole}
                onChange={(value) => setInviteRole(value as RoleOption)}
                placeholder=""
                options={[
                  { value: 'MEMBER', label: roleLabels.MEMBER },
                  { value: 'ADMIN', label: roleLabels.ADMIN },
                  { value: 'GUEST', label: roleLabels.GUEST },
                ]}
              />
            </div>
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
                    onClick: () => void handleRemove(row.memberId, row.role),
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

      <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-c-text">
              {t('admin.membersRoles.invitations.title', 'Invitations')}
            </h3>
            <p className="text-sm text-c-text-muted">
              {t(
                'admin.membersRoles.invitations.subtitle',
                'Server read-back of invitation delivery, acceptance, expiry, and revocation.'
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadInvitations()}>
            {t('admin.membersRoles.invitations.refresh', 'Refresh')}
          </Button>
        </div>

        {invitationLoadError ? (
          <div role="alert" data-testid="invitations-load-error" className="mt-4 rounded-lg border border-c-danger/40 bg-c-danger/10 p-3 text-sm text-c-danger">
            {invitationLoadError}
          </div>
        ) : invitations.length === 0 ? (
          <p className="mt-4 text-sm text-c-text-muted">
            {t('admin.membersRoles.invitations.empty', 'No invitation records for this workspace.')}
          </p>
        ) : (
          <div className="mt-4">
            <StandardTable
              columns={invitationColumns}
              data={invitations}
              persistKey="admin-invitations-table"
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
            <div>
              <label htmlFor="admin-generated-invite-role-select" className="sr-only">
                {t('admin.membersRoles.code.roleLabel', 'Invite code role')}
              </label>
              <SelectField
                id="admin-generated-invite-role-select"
                value={generatedInviteRole}
                onChange={(value) => setGeneratedInviteRole(value as RoleOption)}
                placeholder=""
                options={[
                  { value: 'MEMBER', label: roleLabels.MEMBER },
                  { value: 'GUEST', label: roleLabels.GUEST },
                  { value: 'ADMIN', label: roleLabels.ADMIN },
                ]}
              />
            </div>
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
