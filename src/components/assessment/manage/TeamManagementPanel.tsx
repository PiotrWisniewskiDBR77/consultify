/**
 * TeamManagementPanel - Professional team management for assessments
 * Displays team members, roles, permissions, and area assignments
 * Design follows WorkflowStagesTable patterns (ClickUp-style)
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Crown,
  Edit3,
  Eye,
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { ElementType, FC, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

// ============================================
// Types
// ============================================

export type TeamRole = 'admin' | 'manager' | 'editor' | 'viewer';

export interface TeamMember {
  id: string;
  assessmentId: string;
  userId: string;
  organizationId: string;
  role: TeamRole;
  canEdit: boolean;
  canApprove: boolean;
  canManageTeam: boolean;
  canChangeStatus: boolean;
  canGenerateReport: boolean;
  canGenerateInitiatives: boolean;
  assignedAreas: string[] | null;
  assignedBy: string;
  assignedAt: string;
  updatedAt: string;
  userName?: string;
  userEmail?: string;
}

export interface AreaAssignment {
  id: string;
  assessmentId: string;
  areaId: string;
  areaName?: string;
  assignedUserId: string;
  assignedUserName?: string;
  assignedUserEmail?: string;
  assignedBy: string;
  assignedAt: string;
  dueAt?: string | null;
  status: string;
}

export interface OrgUser {
  id: string;
  email: string;
  name: string;
}

export interface TeamManagementPanelProps {
  assessmentId: string;
  assessmentType: string;
  members: TeamMember[];
  assignments: AreaAssignment[];
  canManageTeam: boolean;
  onRefresh: () => Promise<void>;
  onSearchUsers: (query: string) => Promise<OrgUser[]>;
  onAddMember: (userId: string, role: TeamRole) => Promise<void>;
  onUpdateMember: (userId: string, role: TeamRole) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onAssignArea: (areaId: string, userId: string, dueAt?: string) => Promise<void>;
  onRemoveAssignment: (assignmentId: string) => Promise<void>;
  drdStructure?: Array<{
    id: number;
    name: string;
    areas: Array<{ id: string; name: string }>;
  }>;
}

// ============================================
// Constants
// ============================================

const ROLE_CONFIG: Record<
  TeamRole,
  {
    label: string;
    icon: ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
    permissions: string[];
  }
> = {
  admin: {
    label: 'Admin',
    icon: Crown,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-500/10',
    borderColor: 'border-amber-200 dark:border-amber-500/30',
    description: 'Full access to all features',
    permissions: [
      'Edit',
      'Approve',
      'Manage Team',
      'Change Status',
      'Generate Report',
      'Generate Initiatives',
    ],
  },
  manager: {
    label: 'Manager',
    icon: ShieldCheck,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-500/10',
    borderColor: 'border-purple-200 dark:border-purple-500/30',
    description: 'Can manage team and approve',
    permissions: ['Edit', 'Approve', 'Manage Team', 'Change Status'],
  },
  editor: {
    label: 'Editor',
    icon: Edit3,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    description: 'Can edit assessment content',
    permissions: ['Edit'],
  },
  viewer: {
    label: 'Viewer',
    icon: Eye,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-500/10',
    borderColor: 'border-slate-200 dark:border-slate-500/30',
    description: 'Read-only access',
    permissions: ['View'],
  },
};

// ============================================
// Add Member Modal Component
// ============================================

const AddMemberModal: FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (userId: string, role: TeamRole) => Promise<void>;
  onSearchUsers: (query: string) => Promise<OrgUser[]>;
  existingMemberIds: Set<string>;
}> = ({ isOpen, onClose, onAdd, onSearchUsers, existingMemberIds }) => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<TeamRole>('editor');
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setUsers([]);
      setSelectedUser(null);
      setSelectedRole('editor');
    }
  }, [isOpen]);

  useEffect(() => {
    const search = async () => {
      if (query.length < 2) {
        setUsers([]);
        return;
      }
      setSearching(true);
      try {
        const results = await onSearchUsers(query);
        setUsers(results.filter((u) => !existingMemberIds.has(u.id)));
      } catch {
        setUsers([]);
      } finally {
        setSearching(false);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query, onSearchUsers, existingMemberIds]);

  const handleAdd = async () => {
    if (!selectedUser) return;
    setAdding(true);
    try {
      await onAdd(selectedUser.id, selectedRole);
      onClose();
    } catch (err) {
      const error = err as Error;
      toast.error(error?.message || 'Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg mx-4 bg-white dark:bg-navy-900 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 text-white rounded-lg">
                <UserPlus size={18} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Add Team Member
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Search and add users to the assessment team
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Search Users
            </label>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors"
              />
              {searching && (
                <Loader2
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin"
                />
              )}
            </div>

            {/* Search Results */}
            {users.length > 0 && (
              <div className="mt-2 max-h-48 overflow-auto rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
                      selectedUser?.id === user.id ? 'bg-purple-50 dark:bg-purple-500/10' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-sm font-semibold text-white">
                      {(user.name || user.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {user.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                    </div>
                    {selectedUser?.id === user.id && (
                      <CheckCircle2 size={18} className="text-purple-500" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {query.length >= 2 && users.length === 0 && !searching && (
              <div className="mt-2 p-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No users found matching "{query}"
                </p>
              </div>
            )}
          </div>

          {/* Selected User */}
          {selectedUser && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl border-2 border-purple-200 dark:border-purple-500/30 bg-purple-50/50 dark:bg-purple-500/5"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-lg font-semibold text-white">
                  {(selectedUser.name || selectedUser.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {selectedUser.name}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {selectedUser.email}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-1.5 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors"
                >
                  <X size={16} className="text-purple-600 dark:text-purple-400" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Select Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(ROLE_CONFIG) as [TeamRole, (typeof ROLE_CONFIG)[TeamRole]][]).map(
                ([role, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={role}
                      onClick={() => setSelectedRole(role)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        selectedRole === role
                          ? `${config.borderColor} ${config.bgColor}`
                          : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={16} className={config.color} />
                        <span
                          className={`text-sm font-semibold ${
                            selectedRole === role
                              ? config.color
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {config.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {config.description}
                      </p>
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedUser || adding}
            className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white text-sm font-semibold transition-colors flex items-center gap-2"
          >
            {adding ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus size={16} />
                Add Member
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================
// Team Member Row Component
// ============================================

const TeamMemberRow: FC<{
  member: TeamMember;
  canManageTeam: boolean;
  onUpdateRole: (userId: string, role: TeamRole) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
}> = ({ member, canManageTeam, onUpdateRole, onRemove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<TeamRole>(member.role);
  const [busy, setBusy] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const roleConfig = ROLE_CONFIG[member.role];
  const RoleIcon = roleConfig.icon;

  const handleSaveRole = async () => {
    if (selectedRole === member.role) {
      setIsEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onUpdateRole(member.userId, selectedRole);
      setIsEditing(false);
    } catch (err) {
      const error = err as Error;
      toast.error(error?.message || 'Failed to update role');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Remove ${member.userName || member.userEmail} from the team?`)) return;
    setBusy(true);
    try {
      await onRemove(member.userId);
    } catch (err) {
      const error = err as Error;
      toast.error(error?.message || 'Failed to remove member');
    } finally {
      setBusy(false);
    }
  };

  // Get active permissions
  const activePermissions = useMemo(() => {
    const perms: string[] = [];
    if (member.canEdit) perms.push('Edit');
    if (member.canApprove) perms.push('Approve');
    if (member.canManageTeam) perms.push('Manage');
    if (member.canChangeStatus) perms.push('Status');
    if (member.canGenerateReport) perms.push('Report');
    if (member.canGenerateInitiatives) perms.push('Initiatives');
    return perms;
  }, [member]);

  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="group border-b border-slate-200 dark:border-navy-700/50 hover:bg-slate-50/50 dark:hover:bg-navy-800/30 transition-colors"
    >
      {/* User Info */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
            {(member.userName || member.userEmail || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {member.userName || member.userEmail || 'Unknown'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
              <Mail size={10} />
              {member.userEmail || '—'}
            </div>
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="px-4 py-3">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as TeamRole)}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
            >
              {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                <option key={role} value={role}>
                  {config.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleSaveRole}
              disabled={busy}
              className="p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-emerald-300 transition-colors"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
            <button
              onClick={() => {
                setSelectedRole(member.role);
                setIsEditing(false);
              }}
              className="p-2 rounded-lg bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-navy-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${roleConfig.bgColor} ${roleConfig.color} ${roleConfig.borderColor} border`}
          >
            <RoleIcon size={12} />
            {roleConfig.label}
          </div>
        )}
      </td>

      {/* Permissions */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {activePermissions.length > 0 ? (
            activePermissions.slice(0, 4).map((perm) => (
              <span
                key={perm}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              >
                {perm}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">View only</span>
          )}
          {activePermissions.length > 4 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400">
              +{activePermissions.length - 4}
            </span>
          )}
        </div>
      </td>

      {/* Assigned Areas */}
      <td className="px-4 py-3">
        {member.assignedAreas && member.assignedAreas.length > 0 ? (
          <div className="flex items-center gap-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
              {member.assignedAreas.length} areas
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">All areas</span>
        )}
      </td>

      {/* Added Date */}
      <td className="px-4 py-3">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {member.assignedAt
            ? new Date(member.assignedAt).toLocaleDateString('pl-PL', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : '—'}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        {canManageTeam && (
          <div className="relative flex items-center justify-end gap-1">
            <button
              onClick={() => setIsEditing(true)}
              disabled={isEditing || busy}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-navy-700 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
              title="Edit role"
            >
              <Edit3 size={14} />
            </button>
            <button
              onClick={handleRemove}
              disabled={busy}
              className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
              title="Remove member"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </td>
    </motion.tr>
  );
};

// ============================================
// Main Component
// ============================================

export const TeamManagementPanel: FC<TeamManagementPanelProps> = ({
  assessmentId,
  assessmentType,
  members,
  assignments,
  canManageTeam,
  onRefresh,
  onSearchUsers,
  onAddMember,
  onUpdateMember,
  onRemoveMember,
  onAssignArea,
  onRemoveAssignment,
  drdStructure,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'assignments'>('members');

  const existingMemberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const isDRD = assessmentType?.toUpperCase() === 'DRD';

  // Role distribution stats
  const roleStats = useMemo(() => {
    const stats: Record<TeamRole, number> = { admin: 0, manager: 0, editor: 0, viewer: 0 };
    members.forEach((m) => {
      if (stats[m.role] !== undefined) stats[m.role]++;
    });
    return stats;
  }, [members]);

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 text-white rounded-lg">
                <Users size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Team Management
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {members.length} member{members.length !== 1 ? 's' : ''} • {assignments.length}{' '}
                  area assignment{assignments.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 dark:text-slate-400 transition-colors"
              >
                <Loader2 size={16} className={refreshing ? 'animate-spin' : ''} />
              </button>
              {canManageTeam && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold transition-colors"
                >
                  <Plus size={16} />
                  Add Member
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Role Stats */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900">
          <div className="flex items-center gap-4 overflow-x-auto">
            {(Object.entries(ROLE_CONFIG) as [TeamRole, (typeof ROLE_CONFIG)[TeamRole]][]).map(
              ([role, config]) => {
                const Icon = config.icon;
                const count = roleStats[role];
                return (
                  <div
                    key={role}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bgColor} ${config.borderColor} border`}
                  >
                    <Icon size={14} className={config.color} />
                    <span className={`text-sm font-medium ${config.color}`}>
                      {count} {config.label}
                      {count !== 1 ? 's' : ''}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-3 border-b border-slate-200 dark:border-navy-800">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('members')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'members'
                  ? 'bg-white dark:bg-navy-800 text-purple-600 dark:text-purple-400 border-t border-x border-slate-200 dark:border-navy-700 -mb-px'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users size={14} />
                Members ({members.length})
              </div>
            </button>
            {isDRD && (
              <button
                onClick={() => setActiveTab('assignments')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === 'assignments'
                    ? 'bg-white dark:bg-navy-800 text-purple-600 dark:text-purple-400 border-t border-x border-slate-200 dark:border-navy-700 -mb-px'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ClipboardList size={14} />
                  Area Assignments ({assignments.length})
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Members Table */}
        {activeTab === 'members' && (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 700 }}>
              <thead>
                <tr className="border-b border-slate-200 dark:border-navy-700/50 bg-slate-50 dark:bg-navy-900/50">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[200px]">
                    Member
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[120px]">
                    Role
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[180px]">
                    Permissions
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[100px]">
                    Areas
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[100px]">
                    Added
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[100px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="p-4 rounded-full bg-slate-100 dark:bg-navy-800">
                            <Users size={24} className="text-slate-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              No team members yet
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Add members to start collaborating on this assessment
                            </p>
                          </div>
                          {canManageTeam && (
                            <button
                              onClick={() => setShowAddModal(true)}
                              className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold transition-colors"
                            >
                              <Plus size={16} />
                              Add First Member
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    members.map((member) => (
                      <TeamMemberRow
                        key={member.id}
                        member={member}
                        canManageTeam={canManageTeam}
                        onUpdateRole={onUpdateMember}
                        onRemove={onRemoveMember}
                      />
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* Assignments Tab (DRD only) */}
        {activeTab === 'assignments' && isDRD && (
          <div className="p-4">
            {assignments.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="p-4 rounded-full bg-slate-100 dark:bg-navy-800">
                  <ClipboardList size={24} className="text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    No area assignments
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Assign team members to specific DRD areas
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                {assignments.map((assignment) => (
                  <motion.div
                    key={assignment.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50/50 dark:bg-navy-800/50 hover:bg-slate-100/50 dark:hover:bg-navy-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                        <ClipboardList size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {assignment.areaId} — {assignment.areaName || 'Area'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          Assigned to:{' '}
                          {assignment.assignedUserName ||
                            assignment.assignedUserEmail ||
                            assignment.assignedUserId}
                          {assignment.dueAt && (
                            <span className="ml-2">
                              • Due: {new Date(assignment.dueAt).toLocaleDateString('pl-PL')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          assignment.status === 'COMPLETED'
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : assignment.status === 'IN_PROGRESS'
                              ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                              : 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {assignment.status || 'ACTIVE'}
                      </span>
                      {canManageTeam && (
                        <button
                          onClick={() => onRemoveAssignment(assignment.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/50">
          <div className="flex items-center gap-6 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Crown size={12} className="text-amber-500" />
              <span>Admin - Full access</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-purple-500" />
              <span>Manager - Team & approvals</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Edit3 size={12} className="text-blue-500" />
              <span>Editor - Edit content</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye size={12} className="text-slate-400" />
              <span>Viewer - Read only</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddMemberModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            onAdd={onAddMember}
            onSearchUsers={onSearchUsers}
            existingMemberIds={existingMemberIds}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeamManagementPanel;
