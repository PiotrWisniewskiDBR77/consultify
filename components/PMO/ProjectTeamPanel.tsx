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

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  UserPlus,
  Users,
  Shield,
  Briefcase,
  ChevronDown,
  X,
  Check,
  AlertTriangle,
  Percent
} from 'lucide-react';
import { PMOProjectRole, ProjectMember } from '../../types';
import { api } from '../../services/api';

interface ProjectTeamPanelProps {
  projectId: string;
  canManageTeam?: boolean;
  onMemberChange?: () => void;
}

const ROLE_LABELS: Record<PMOProjectRole, { label: string; color: string; icon: React.ElementType }> = {
  [PMOProjectRole.SPONSOR]: { label: 'Sponsor', color: 'bg-purple-100 text-purple-800', icon: Shield },
  [PMOProjectRole.DECISION_OWNER]: { label: 'Decision Owner', color: 'bg-indigo-100 text-indigo-800', icon: Shield },
  [PMOProjectRole.PMO_LEAD]: { label: 'PMO Lead', color: 'bg-blue-100 text-blue-800', icon: Briefcase },
  [PMOProjectRole.WORKSTREAM_OWNER]: { label: 'Workstream Owner', color: 'bg-cyan-100 text-cyan-800', icon: Users },
  [PMOProjectRole.INITIATIVE_OWNER]: { label: 'Initiative Owner', color: 'bg-teal-100 text-teal-800', icon: Users },
  [PMOProjectRole.TASK_ASSIGNEE]: { label: 'Task Assignee', color: 'bg-green-100 text-green-800', icon: Users },
  [PMOProjectRole.SME]: { label: 'Subject Matter Expert', color: 'bg-yellow-100 text-yellow-800', icon: Users },
  [PMOProjectRole.REVIEWER]: { label: 'Reviewer', color: 'bg-orange-100 text-orange-800', icon: Users },
  [PMOProjectRole.OBSERVER]: { label: 'Observer', color: 'bg-gray-100 text-gray-800', icon: Users },
  [PMOProjectRole.CONSULTANT]: { label: 'Consultant', color: 'bg-pink-100 text-pink-800', icon: Users },
  [PMOProjectRole.STAKEHOLDER]: { label: 'Stakeholder', color: 'bg-slate-100 text-slate-800', icon: Users },
};

export const ProjectTeamPanel: React.FC<ProjectTeamPanelProps> = ({
  projectId,
  canManageTeam = false,
  onMemberChange
}) => {
  const { t } = useTranslation();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<PMOProjectRole | null>(null);

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

  const handleRoleChange = async (userId: string, newRole: PMOProjectRole) => {
    try {
      await api.patch(`/projects/${projectId}/members/${userId}`, {
        projectRole: newRole
      });
      await loadMembers();
      onMemberChange?.();
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    }
  };

  // Group members by role
  const groupedMembers = members.reduce((acc, member) => {
    const role = member.projectRole;
    if (!acc[role]) acc[role] = [];
    acc[role].push(member);
    return acc;
  }, {} as Record<PMOProjectRole, ProjectMember[]>);

  // Order roles by hierarchy
  const roleOrder: PMOProjectRole[] = [
    PMOProjectRole.SPONSOR,
    PMOProjectRole.DECISION_OWNER,
    PMOProjectRole.PMO_LEAD,
    PMOProjectRole.WORKSTREAM_OWNER,
    PMOProjectRole.INITIATIVE_OWNER,
    PMOProjectRole.TASK_ASSIGNEE,
    PMOProjectRole.SME,
    PMOProjectRole.REVIEWER,
    PMOProjectRole.CONSULTANT,
    PMOProjectRole.OBSERVER,
    PMOProjectRole.STAKEHOLDER,
  ];

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
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
        <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Members by role */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {roleOrder.map(role => {
          const roleMembers = groupedMembers[role];
          if (!roleMembers || roleMembers.length === 0) return null;

          const roleInfo = ROLE_LABELS[role];
          const RoleIcon = roleInfo.icon;

          return (
            <div key={role} className="px-6 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>
                  <RoleIcon className="w-3.5 h-3.5" />
                  {roleInfo.label}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({roleMembers.length})
                </span>
              </div>

              <div className="space-y-2">
                {roleMembers.map(member => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    canManage={canManageTeam}
                    onRemove={() => handleRemoveMember(member.userId)}
                    onRoleChange={(newRole) => handleRoleChange(member.userId, newRole)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {members.length === 0 && (
          <div className="px-6 py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
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
  member: ProjectMember;
  canManage: boolean;
  onRemove: () => void;
  onRoleChange: (newRole: PMOProjectRole) => void;
}

const MemberRow: React.FC<MemberRowProps> = ({
  member,
  canManage,
  onRemove,
  onRoleChange
}) => {
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        {member.avatarUrl ? (
          <img
            src={member.avatarUrl}
            alt=""
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-medium">
            {member.firstName?.[0]}{member.lastName?.[0]}
          </div>
        )}

        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {member.firstName} {member.lastName}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {member.email}
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
          <span className="text-xs bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 px-2 py-1 rounded">
            Workstream
          </span>
        )}

        {/* Role change dropdown */}
        {canManage && (
          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <ChevronDown className="w-4 h-4" />
            </button>

            {showRoleDropdown && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                {Object.values(PMOProjectRole).map(role => (
                  <button
                    key={role}
                    onClick={() => {
                      onRoleChange(role);
                      setShowRoleDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                      member.projectRole === role ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {member.projectRole === role && <Check className="w-3.5 h-3.5" />}
                    {ROLE_LABELS[role].label}
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
            className="p-1.5 text-gray-400 hover:text-red-500"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

interface AddMemberModalProps {
  projectId: string;
  onClose: () => void;
  onAdded: () => void;
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({
  projectId,
  onClose,
  onAdded
}) => {
  const { t } = useTranslation();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<PMOProjectRole>(PMOProjectRole.TASK_ASSIGNEE);
  const [allocation, setAllocation] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; firstName: string; lastName: string; email: string }>>([]);

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
        allocationPercent: allocation
      });
      onAdded();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('pmo.addTeamMember', 'Add Team Member')}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.email})
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
              onChange={(e) => setRole(e.target.value as PMOProjectRole)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {Object.values(PMOProjectRole).map(r => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r].label}
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
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
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

