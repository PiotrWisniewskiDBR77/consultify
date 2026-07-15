/**
 * Project Team Panel
 *
 * PMO Standards Compliant Team Management UI
 *
 * Standards:
 * - ISO 21500:2021 - Project Team (Clause 4.6.2)
 * - PMI PMBOK 7th Edition - Team Performance Domain
 * - PRINCE2 - Organization Theme (Project Roles)
 *
 * Features:
 * - View project team members with roles
 * - Add/remove members
 * - Change member roles
 * - View workstream assignments
 */

import {
  AlertTriangle,
  Briefcase,
  Check,
  ChevronDown,
  Crown,
  Eye,
  Percent,
  Shield,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../services/api';
import type { ProjectMember } from '../../types';

interface ProjectTeamPanelProps {
  projectId: string;
  canManageTeam?: boolean;
  onMemberChange?: () => void;
}

type CanonicalProjectRole =
  | 'SPONSOR'
  | 'PROJECT_LEADER'
  | 'INITIATIVE_OWNER'
  | 'TEAM_MEMBER'
  | 'PMO'
  | 'PORTFOLIO_OWNER'
  | 'BUSINESS_OWNER'
  | 'STEERING_COMMITTEE';

type CanonicalRoleKey = CanonicalProjectRole | 'OTHER';

type ExtendedProjectMember = ProjectMember & {
  accountRole?: string | null;
  consultantProfile?: string | null;
  engagementType?: string | null;
  isInvoked?: boolean;
  projectRole?: string; // allow backend payload that doesn't match PMOProjectRole enum
};

const CANONICAL_ROLE_DEFS: Record<
  CanonicalProjectRole,
  { labelEn: string; labelPl: string; color: string; icon: React.ElementType; invokable?: boolean }
> = {
  SPONSOR: {
    labelEn: 'Sponsor (Business Owner)',
    labelPl: 'Sponsor (Właściciel biznesowy)',
    color: 'bg-amber-100 text-amber-800',
    icon: Crown,
  },
  PROJECT_LEADER: {
    labelEn: 'Project Leader',
    labelPl: 'Project Leader',
    color: 'bg-blue-100 text-blue-800',
    icon: Briefcase,
  },
  INITIATIVE_OWNER: {
    labelEn: 'Initiative Owner',
    labelPl: 'Właściciel inicjatywy',
    color: 'bg-blue-100 text-blue-800',
    icon: Users,
  },
  TEAM_MEMBER: {
    labelEn: 'Team Member',
    labelPl: 'Członek zespołu',
    color: 'bg-green-100 text-green-800',
    icon: Users,
  },
  PMO: {
    labelEn: 'Project Office (PMO)',
    labelPl: 'Project Office (PMO)',
    color: 'bg-primary-100 text-primary-800',
    icon: Shield,
    invokable: true,
  },
  PORTFOLIO_OWNER: {
    labelEn: 'Portfolio Owner',
    labelPl: 'Właściciel portfela',
    color: 'bg-primary-100 text-primary-800',
    icon: Shield,
    invokable: true,
  },
  BUSINESS_OWNER: {
    labelEn: 'Business Owner (Benefits)',
    labelPl: 'Business Owner (Korzyści)',
    color: 'bg-indigo-100 text-indigo-800',
    icon: Shield,
  },
  STEERING_COMMITTEE: {
    labelEn: 'Steering Committee',
    labelPl: 'Komitet sterujący',
    color: 'bg-slate-100 text-slate-800 dark:text-slate-200',
    icon: Eye,
  },
};

const CANONICAL_ROLE_ORDER: CanonicalRoleKey[] = [
  'SPONSOR',
  'PROJECT_LEADER',
  'INITIATIVE_OWNER',
  'TEAM_MEMBER',
  'PMO',
  'PORTFOLIO_OWNER',
  'BUSINESS_OWNER',
  'STEERING_COMMITTEE',
  'OTHER',
];

const normalizeUpper = (v: unknown) =>
  String(v || '')
    .trim()
    .toUpperCase();

const toCanonicalRoleKey = (rawRole: unknown): CanonicalRoleKey => {
  const r = normalizeUpper(rawRole);
  if (!r) return 'OTHER';
  if ((Object.keys(CANONICAL_ROLE_DEFS) as string[]).includes(r)) return r as CanonicalProjectRole;
  if (['PROJECT_EXECUTIVE', 'PROJECT_SPONSOR', 'SPONSOR'].includes(r)) return 'SPONSOR';
  if (['PROJECT_MANAGER', 'PROJECT_LEAD', 'TEAM_LEAD', 'PMO_LEAD', 'MANAGER'].includes(r))
    return 'PROJECT_LEADER';
  if (r === 'INITIATIVE_OWNER') return 'INITIATIVE_OWNER';
  if (['TASK_ASSIGNEE', 'TEAM_MEMBER', 'DEVELOPER', 'ANALYST', 'SME', 'REVIEWER'].includes(r))
    return 'TEAM_MEMBER';
  if (r === 'CONSULTANT') return 'TEAM_MEMBER'; // consultant is overlay, not project role in canon
  if (['OBSERVER', 'STAKEHOLDER', 'VIEWER'].includes(r)) return 'OTHER';
  return 'OTHER';
};

export const ProjectTeamPanel: React.FC<ProjectTeamPanelProps> = ({
  projectId,
  canManageTeam = false,
  onMemberChange,
}) => {
  const { t, i18n } = useTranslation();
  const [members, setMembers] = useState<ExtendedProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [projectId]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/projects/${projectId}/members`);
      setMembers(response.data.members || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm(t('pmo.confirmRemoveMember', 'Are you sure you want to remove this member?'))) {
      return;
    }

    try {
      await api.delete(`/projects/${projectId}/members/${userId}`);
      await loadMembers();
      onMemberChange?.();
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    }
  };

  const handleRoleChange = async (userId: string, newRole: CanonicalProjectRole) => {
    try {
      await api.patch(`/projects/${projectId}/members/${userId}`, {
        projectRole: newRole,
      });
      await loadMembers();
      onMemberChange?.();
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    }
  };

  const handleInvokedChange = async (userId: string, isInvoked: boolean) => {
    try {
      await api.patch(`/projects/${projectId}/members/${userId}`, { isInvoked });
      await loadMembers();
      onMemberChange?.();
    } catch (err: any) {
      alert(err.message || 'Failed to update invoked flag');
    }
  };

  // Group members by role
  const groupedMembers = members.reduce(
    (acc, member) => {
      const roleKey = toCanonicalRoleKey((member as any).projectRole);
      if (!acc[roleKey]) acc[roleKey] = [];
      acc[roleKey].push(member);
      return acc;
    },
    {} as Record<CanonicalRoleKey, ExtendedProjectMember[]>
  );

  const roleOrder = CANONICAL_ROLE_ORDER;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t('pmo.projectTeam', 'Project Team')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {members.length} {t('pmo.members', 'members')} • ISO 21500 / PMBOK 7 / PRINCE2
          </p>
        </div>

        {canManageTeam && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            {t('pmo.addMember', 'Add Member')}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-6 py-3 bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Members by role */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {roleOrder.map((role) => {
          const roleMembers = groupedMembers[role];
          if (!roleMembers || roleMembers.length === 0) return null;

          const roleInfo =
            role === 'OTHER' ? null : CANONICAL_ROLE_DEFS[role as CanonicalProjectRole] || null;
          const RoleIcon = roleInfo?.icon || Users;
          const roleLabel =
            role === 'OTHER'
              ? t('pmo.roles.other', 'Other / legacy roles')
              : t(`pmo.roles.${role}`, {
                  defaultValue:
                    (i18n.language === 'pl' ? roleInfo?.labelPl : roleInfo?.labelEn) ||
                    (roleInfo ? roleInfo.labelEn : role),
                });
          const roleColor =
            role === 'OTHER' ? 'bg-gray-100 dark:bg-navy-800 text-gray-800' : roleInfo?.color;

          return (
            <div key={role} className="px-6 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleColor}`}
                >
                  <RoleIcon className="w-3.5 h-3.5" />
                  {roleLabel}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({roleMembers.length})
                </span>
              </div>

              <div className="space-y-2">
                {roleMembers.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    canManage={canManageTeam}
                    onRemove={() => handleRemoveMember(member.userId)}
                    onRoleChange={(newRole) => handleRoleChange(member.userId, newRole)}
                    onInvokedChange={(newValue) => handleInvokedChange(member.userId, newValue)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {members.length === 0 && (
          <div className="px-6 py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-600 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {t('pmo.noMembers', 'No team members yet')}
            </p>
            {canManageTeam && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                {t('pmo.addFirstMember', 'Add the first member')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Steering Board (optional) */}
      <div className="border-t border-gray-200 dark:border-gray-700">
        <SteeringBoardPanel projectId={projectId} canManage={canManageTeam} />
      </div>

      {/* Add Member Modal would go here */}
      {showAddModal && (
        <AddMemberModal
          projectId={projectId}
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false);
            loadMembers();
            onMemberChange?.();
          }}
        />
      )}
    </div>
  );
};

interface MemberRowProps {
  member: ExtendedProjectMember;
  canManage: boolean;
  onRemove: () => void;
  onRoleChange: (newRole: CanonicalProjectRole) => void;
  onInvokedChange: (newValue: boolean) => void;
}

const MemberRow: React.FC<MemberRowProps> = ({
  member,
  canManage,
  onRemove,
  onRoleChange,
  onInvokedChange,
}) => {
  const { i18n, t } = useTranslation();
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const roleKey = toCanonicalRoleKey((member as any).projectRole);
  const roleLabel =
    roleKey === 'OTHER'
      ? normalizeUpper((member as any).projectRole) || t('pmo.roles.other', 'Other')
      : t(`pmo.roles.${roleKey}`, {
          defaultValue:
            (i18n.language === 'pl'
              ? CANONICAL_ROLE_DEFS[roleKey].labelPl
              : CANONICAL_ROLE_DEFS[roleKey].labelEn) || roleKey,
        });
  const isInvokable = roleKey !== 'OTHER' && !!CANONICAL_ROLE_DEFS[roleKey].invokable;
  const invoked = !!(member as any).isInvoked;
  const consultantProfile = normalizeUpper((member as any).consultantProfile);
  const isConsultant = consultantProfile && consultantProfile !== 'NONE';

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        {member.avatarUrl ? (
          <img src={member.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-medium">
            {member.firstName?.[0]}
            {member.lastName?.[0]}
          </div>
        )}

        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {member.firstName} {member.lastName}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{member.email}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {(member as any).accountRole && (
              <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-navy-800 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                {normalizeUpper((member as any).accountRole)}
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-white/70 dark:bg-navy-900/60 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-navy-700/60">
              {roleLabel}
            </span>
            {isInvokable && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  invoked
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                {invoked ? t('pmo.invoked', 'Invoked') : t('pmo.notInvoked', 'Not invoked')}
              </span>
            )}
            {isConsultant && (
              <span className="inline-flex items-center rounded-full bg-pink-100 text-pink-800 px-2 py-0.5 text-[10px] font-semibold">
                {t('pmo.consultant', 'Consultant')}: {consultantProfile}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Allocation */}
        <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
          <Percent className="w-3.5 h-3.5" />
          {member.allocationPercent}%
        </div>

        {/* Workstream */}
        {member.workstreamId && (
          <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
            Workstream
          </span>
        )}

        {/* Invoked toggle for invokable roles */}
        {canManage && isInvokable && (
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 select-none">
            <input
              type="checkbox"
              checked={invoked}
              onChange={(e) => onInvokedChange(e.target.checked)}
            />
            {t('pmo.invokedShort', 'Invoked')}
          </label>
        )}

        {/* Role change dropdown */}
        {canManage && (
          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="p-1.5 text-gray-600 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <ChevronDown className="w-4 h-4" />
            </button>

            {showRoleDropdown && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                {(Object.keys(CANONICAL_ROLE_DEFS) as CanonicalProjectRole[]).map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      onRoleChange(role);
                      setShowRoleDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:bg-navy-800 dark:hover:bg-gray-700 flex items-center gap-2 ${
                      normalizeUpper((member as any).projectRole) === role
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {normalizeUpper((member as any).projectRole) === role && (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    {t(`pmo.roles.${role}`, {
                      defaultValue:
                        i18n.language === 'pl'
                          ? CANONICAL_ROLE_DEFS[role].labelPl
                          : CANONICAL_ROLE_DEFS[role].labelEn,
                    })}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Remove button */}
        {canManage && (
          <button
            onClick={onRemove}
            className="p-1.5 text-gray-600 dark:text-gray-500 dark:text-gray-400 hover:text-danger-500"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

interface SteeringBoardApiResponse {
  board: { projectId: string; enabled: number | boolean; quorumRule?: string; slaHours?: number };
  members: Array<{
    userId: string;
    memberType: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  }>;
}

const SteeringBoardPanel: React.FC<{ projectId: string; canManage: boolean }> = ({
  projectId,
  canManage,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language === 'pl';

  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [members, setMembers] = useState<SteeringBoardApiResponse['members']>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [newUserId, setNewUserId] = useState('');
  const [newMemberType, setNewMemberType] = useState<'CHAIR' | 'BOARD_MEMBER' | 'OBSERVER'>(
    'BOARD_MEMBER'
  );

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/projects/${projectId}/steering-board`);
      const data = res.data as SteeringBoardApiResponse;
      setEnabled(!!(data?.board?.enabled as any));
      setMembers(data?.members || []);
    } catch {
      setEnabled(false);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Load org users for add-member modal (best-effort)
    (async () => {
      try {
        const response = await api.get('/users');
        setAvailableUsers(
          Array.isArray(response.data) ? response.data : response.data?.users || []
        );
      } catch {
        setAvailableUsers([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const toggleEnabled = async () => {
    const next = !enabled;
    setEnabled(next);
    try {
      await api.put(`/projects/${projectId}/steering-board`, { enabled: next });
      await load();
    } catch {
      setEnabled(!next);
    }
  };

  const addMember = async () => {
    if (!newUserId) return;
    try {
      await api.post(`/projects/${projectId}/steering-board/members`, {
        userId: newUserId,
        memberType: newMemberType,
      });
      setShowAdd(false);
      setNewUserId('');
      setNewMemberType('BOARD_MEMBER');
      await load();
    } catch {
      // best-effort
    }
  };

  const removeMember = async (userId: string) => {
    try {
      await api.delete(`/projects/${projectId}/steering-board/members/${userId}`);
      await load();
    } catch {
      // best-effort
    }
  };

  return (
    <div className="px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            {t('pmo.steeringBoard', 'Steering Board')}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {t('pmo.steeringBoardHint', 'Optional governance body for approvals and escalations.')}
          </div>
        </div>

        {canManage && (
          <button
            onClick={toggleEnabled}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              enabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-navy-800 dark:text-slate-200 dark:border-navy-700'
            }`}
          >
            {enabled ? t('common.enabled', 'Enabled') : t('common.disabled', 'Disabled')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {t('common.loading', 'Loading...')}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {members.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('pmo.steeringBoardEmpty', 'No Steering Board members yet.')}
            </div>
          ) : (
            members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center justify-between p-2 rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/60 dark:border-navy-700/60"
              >
                <div className="text-sm text-slate-800 dark:text-slate-200">
                  {(m.firstName || '') + ' ' + (m.lastName || '')}{' '}
                  <span className="text-xs text-slate-500 dark:text-slate-400">({m.email})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200">
                    {normalizeUpper(m.memberType)}
                  </span>
                  {canManage && (
                    <button
                      onClick={() => removeMember(m.userId)}
                      className="p-1.5 text-slate-600 hover:text-danger-500"
                      title={t('common.remove', 'Remove')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {canManage && (
            <div className="pt-2">
              <button
                onClick={() => setShowAdd(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                {t('pmo.addSteeringBoardMember', 'Add Steering Board member')}
              </button>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('pmo.addSteeringBoardMember', 'Add Steering Board member')}
              </h3>
              <button
                onClick={() => setShowAdd(false)}
                className="text-gray-600 hover:text-gray-600 dark:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pmo.selectUser', 'Select User')}
                </label>
                <select
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">{t('pmo.chooseUser', 'Choose a user...')}</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {(u.firstName || u.first_name || '') +
                        ' ' +
                        (u.lastName || u.last_name || '')}{' '}
                      ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pmo.memberType', 'Member type')}
                </label>
                <select
                  value={newMemberType}
                  onChange={(e) =>
                    setNewMemberType(e.target.value as 'CHAIR' | 'BOARD_MEMBER' | 'OBSERVER')
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="CHAIR">{isPl ? 'Przewodniczący' : 'Chair'}</option>
                  <option value="BOARD_MEMBER">{isPl ? 'Członek' : 'Board member'}</option>
                  <option value="OBSERVER">{isPl ? 'Obserwator' : 'Observer'}</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:bg-navy-800 dark:hover:bg-gray-700"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={addMember}
                  disabled={!newUserId}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {t('common.add', 'Add')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface AddMemberModalProps {
  projectId: string;
  onClose: () => void;
  onAdded: () => void;
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({ projectId, onClose, onAdded }) => {
  const { t, i18n } = useTranslation();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<CanonicalProjectRole>('TEAM_MEMBER');
  const [allocation, setAllocation] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    // Load available users from organization
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError('Please select a user');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.post(`/projects/${projectId}/members`, {
        userId,
        projectRole: role,
        allocationPercent: allocation,
      });
      onAdded();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-overlay">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('pmo.addTeamMember', 'Add Team Member')}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-600 dark:text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pmo.selectUser', 'Select User')}
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">{t('pmo.chooseUser', 'Choose a user...')}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {(user.firstName || user.first_name) ?? ''}{' '}
                  {(user.lastName || user.last_name) ?? ''} ({user.email})
                </option>
              ))}
            </select>
          </div>

          {/* Role select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pmo.projectRole', 'Project Role')}
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as CanonicalProjectRole)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {(Object.keys(CANONICAL_ROLE_DEFS) as CanonicalProjectRole[]).map((r) => (
                <option key={r} value={r}>
                  {t(`pmo.roles.${r}`, {
                    defaultValue:
                      i18n.language === 'pl'
                        ? CANONICAL_ROLE_DEFS[r].labelPl
                        : CANONICAL_ROLE_DEFS[r].labelEn,
                  })}
                </option>
              ))}
            </select>
          </div>

          {/* Allocation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pmo.allocation', 'Allocation')} (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={allocation}
              onChange={(e) => setAllocation(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {error && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:bg-navy-800 dark:hover:bg-gray-700"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? t('common.adding', 'Adding...') : t('pmo.addMember', 'Add Member')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectTeamPanel;
