import { Copy, Crown, KeyRound, Loader2, Shield, Trash2, UserPlus, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
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
    description: 'Can manage members, security, collaboration, integrations, and audit.',
    denial: 'Cannot change owner membership or bypass owner protections.',
  },
  {
    role: 'MEMBER',
    title: 'Member',
    description: 'Standard workspace access without admin cockpit permissions.',
    denial: 'Cannot open Admin cockpit or change tenant-wide policy.',
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
  const [generatedInviteCode, setGeneratedInviteCode] = useState<string | null>(null);
  const [generatedInviteRole, setGeneratedInviteRole] = useState<RoleOption>('MEMBER');
  const [generatedInviteMaxUses, setGeneratedInviteMaxUses] = useState(50);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const orgId = currentOrganization?.id;
  const viewerMembership = useMemo(
    () => members.find((member) => member.user_id === currentUser?.id),
    [members, currentUser?.id]
  );
  const isOwner = String(viewerMembership?.role || '').toUpperCase() === 'OWNER';

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

  const handleInvite = async () => {
    if (!orgId || !inviteEmail.trim()) return;
    try {
      setInviting(true);
      await Api.addOrganizationMember(orgId, inviteEmail.trim(), inviteRole);
      toast.success('Member added to workspace');
      setInviteEmail('');
      setInviteRole('MEMBER');
      await loadMembers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add member');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: RoleOption) => {
    if (!orgId) return;
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
      const response = await Api.post('/access-control/codes', {
        organizationId: orgId,
        role: generatedInviteRole,
        maxUses: generatedInviteMaxUses,
        expiresInDays: 7,
      });

      const code = response?.code?.code;
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
                <Shield className="h-4 w-4 text-violet-500" />
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
              onChange={(event) => setInviteEmail(event.target.value)}
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
              <option value="OWNER" disabled={!isOwner}>
                Owner
              </option>
            </select>
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Add member
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/10">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-4">Member</th>
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-4">Role</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Loading members...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No members found for this workspace.
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const memberRole = String(member.role || 'MEMBER').toUpperCase() as RoleOption;
                  const memberName =
                    `${member.first_name || ''} ${member.last_name || ''}`.trim() ||
                    member.email?.split('@')[0] ||
                    'Unknown member';
                  const isBusy = savingMemberId === member.user_id;
                  const ownerProtected = memberRole === 'OWNER' && !isOwner;
                  const selfProtected = member.user_id === currentUser?.id;

                  return (
                    <tr key={member.user_id || member.id}>
                      <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">
                        {memberName}
                      </td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                        {member.email}
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          value={memberRole}
                          disabled={isBusy || ownerProtected}
                          onChange={(event) =>
                            void handleRoleChange(member.user_id, event.target.value as RoleOption)
                          }
                          className={cn(
                            'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-navy-900 dark:text-white',
                            (isBusy || ownerProtected) && 'opacity-60'
                          )}
                        >
                          <option value="OWNER" disabled={!isOwner}>
                            Owner
                          </option>
                          <option value="ADMIN">Admin</option>
                          <option value="MEMBER">Member</option>
                          <option value="GUEST">Guest</option>
                        </select>
                      </td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                        {member.status || 'ACTIVE'}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => void handleRemove(member.user_id)}
                          disabled={isBusy || ownerProtected || selfProtected}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50 dark:border-white/10 dark:text-slate-300"
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Pilot Access Code
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Generate one shared code for tomorrow's VTS onboarding. The default limit is set to
              50 participants and you can copy the ready registration link below.
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Participants register with email and password after opening the invite link. Phone
              number is optional.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[160px,120px,auto]">
            <select
              value={generatedInviteRole}
              onChange={(event) => setGeneratedInviteRole(event.target.value as RoleOption)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-navy-900 dark:text-white"
            >
              <option value="MEMBER">Participant</option>
              <option value="GUEST">Guest</option>
              <option value="ADMIN">Admin</option>
            </select>
            <input
              type="number"
              min={1}
              max={500}
              value={generatedInviteMaxUses}
              aria-label="Maximum participant registrations"
              onChange={(event) =>
                setGeneratedInviteMaxUses(Math.min(500, Math.max(1, Number(event.target.value || 1))))
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-navy-900 dark:text-white"
            />
            <button
              onClick={() => void handleGenerateInviteCode()}
              disabled={isGeneratingCode}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
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
              Ready for tomorrow
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
