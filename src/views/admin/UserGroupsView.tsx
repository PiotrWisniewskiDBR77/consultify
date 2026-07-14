/**
 * UserGroupsView - Reusable Teams Management
 *
 * Teams are reusable groups of users that can be assigned to projects.
 * Instead of adding users one by one to each project, you can:
 * 1. Create teams here (e.g., "Frontend Team", "PMO Office", "QA Team")
 * 2. When creating/editing a project, assign entire teams or individual users
 *
 * Features:
 * - Create, edit, delete teams
 * - Assign members to teams
 * - Set default project role for team members
 * - Team leader designation
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Crown,
  Edit,
  FolderKanban,
  Info,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  UsersRound,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { DegradedState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { GroupPermission, User, UserGroup } from '../../types';

// Group colors
const GROUP_COLORS = [
  {
    id: 'violet',
    bg: 'bg-c-accent',
    text: 'text-primary-500',
    light: 'bg-primary-100 dark:bg-primary-900/30',
  },
  {
    id: 'blue',
    bg: 'bg-blue-500',
    text: 'text-blue-500',
    light: 'bg-blue-100 dark:bg-blue-900/30',
  },
  {
    id: 'green',
    bg: 'bg-green-500',
    text: 'text-green-500',
    light: 'bg-green-100 dark:bg-green-900/30',
  },
  {
    id: 'amber',
    bg: 'bg-amber-500',
    text: 'text-amber-500',
    light: 'bg-amber-100 dark:bg-amber-900/30',
  },
  {
    id: 'rose',
    bg: 'bg-danger-500',
    text: 'text-danger-500',
    light: 'bg-danger-100 dark:bg-danger-900/30',
  },
  {
    id: 'cyan',
    bg: 'bg-blue-500',
    text: 'text-blue-500',
    light: 'bg-blue-100 dark:bg-blue-900/30',
  },
  {
    id: 'orange',
    bg: 'bg-amber-500',
    text: 'text-amber-500',
    light: 'bg-amber-100 dark:bg-amber-900/30',
  },
  {
    id: 'indigo',
    bg: 'bg-indigo-500',
    text: 'text-indigo-500',
    light: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
];

// Permission resources
const PERMISSION_RESOURCES = [
  { id: 'projects', label: 'Projects', description: 'Access to project data' },
  { id: 'initiatives', label: 'Initiatives', description: 'Access to initiatives' },
  { id: 'tasks', label: 'Tasks', description: 'Access to tasks' },
  { id: 'decisions', label: 'Decisions', description: 'Access to decisions' },
  { id: 'knowledge', label: 'Knowledge Base', description: 'Access to documents' },
  { id: 'analytics', label: 'Analytics', description: 'Access to reports' },
  { id: 'ai', label: 'AI Features', description: 'Access to AI capabilities' },
];

const PERMISSION_ACTIONS = ['read', 'create', 'update', 'delete', 'manage'];

interface UserGroupsViewProps {
  className?: string;
}

export const UserGroupsView: React.FC<UserGroupsViewProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { currentOrganization } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<UserGroup | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: 'violet',
    leaderId: '',
    defaultProjectRole: 'TEAM_MEMBER', // Default role when team is added to project
    permissions: [] as GroupPermission[],
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentOrganization?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      setLoadError(null);
      // Load teams from correct endpoint
      const teamsRes = await fetch('/api/teams', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!teamsRes.ok) {
        throw new Error(`HTTP ${teamsRes.status}`);
      }
      const data = await teamsRes.json();
      // Transform teams data to groups format
      const transformedGroups = data.map((team: any) => ({
        id: team.id,
        name: team.name,
        description: team.description,
        color: team.color || 'violet',
        leaderId: team.leadId,
        memberIds: team.members?.map((m: any) => m.userId || m.user?.id) || [],
        permissions: team.permissions || [],
        createdAt: team.createdAt,
      }));
      setGroups(transformedGroups);

      // Load users for member selection
      const usersData = await Api.getUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load teams');
      // Set empty state instead of mock data
      setGroups([]);
      setUsers([]);
      setLoadError(error instanceof Error ? error.message : 'Failed to load teams');
    }
    setLoading(false);
  };

  const openCreateModal = () => {
    setEditingGroup(null);
    setFormData({
      name: '',
      description: '',
      color: 'violet',
      leaderId: '',
      defaultProjectRole: 'TEAM_MEMBER',
      permissions: [],
    });
    setShowCreateModal(true);
  };

  const openEditModal = (group: UserGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      color: group.color || 'violet',
      leaderId: group.leaderId || '',
      defaultProjectRole: (group as any).defaultProjectRole || 'TEAM_MEMBER',
      permissions: group.permissions || [],
    });
    setShowCreateModal(true);
  };

  const handleSaveGroup = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a team name');
      return;
    }

    setSaving(true);
    try {
      const url = editingGroup ? `/api/teams/${editingGroup.id}` : '/api/teams';

      // Transform data to match backend expectations
      const payload = {
        name: formData.name,
        description: formData.description,
        leadId: formData.leaderId || null,
        color: formData.color,
        defaultProjectRole: formData.defaultProjectRole,
      };

      const res = await fetch(url, {
        method: editingGroup ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingGroup ? 'Team updated' : 'Team created');
        setShowCreateModal(false);
        loadData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save team');
      }
    } catch (error: any) {
      console.error('Failed to save team:', error);
      toast.error(error.message || 'Failed to save team');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this team? Members will not be deleted.')) {
      return;
    }

    try {
      const res = await fetch(`/api/teams/${groupId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (res.ok) {
        toast.success('Team deleted');
        setGroups((prev: any) => prev.filter((g: any) => g.id !== groupId));
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete team');
      }
    } catch (error: any) {
      console.error('Failed to delete team:', error);
      toast.error(error.message || 'Failed to delete team');
    }
  };

  const openMembersModal = (group: UserGroup) => {
    setSelectedGroupForMembers(group);
    setShowMembersModal(true);
  };

  const toggleMember = async (userId: string) => {
    if (!selectedGroupForMembers) return;

    const isMember = selectedGroupForMembers.memberIds.includes(userId);
    const newMemberIds = isMember
      ? selectedGroupForMembers.memberIds.filter((id: string) => id !== userId)
      : [...selectedGroupForMembers.memberIds, userId];

    try {
      if (isMember) {
        // Remove member
        const res = await fetch(`/api/teams/${selectedGroupForMembers.id}/members/${userId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        // Add member
        const res = await fetch(`/api/teams/${selectedGroupForMembers.id}/members`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ userId, role: 'member' }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
    } catch (error) {
      console.error('Failed to update team member:', error);
      toast.error('Failed to update team member');
      return;
    }

    // Update local state
    setGroups((prev: any) =>
      prev.map((g: any) =>
        g.id === selectedGroupForMembers.id ? { ...g, memberIds: newMemberIds } : g
      )
    );
    setSelectedGroupForMembers((prev: any) => (prev ? { ...prev, memberIds: newMemberIds } : null));
  };

  const togglePermission = (resource: string, action: string) => {
    setFormData((prev: any) => {
      const existingPerm = prev.permissions.find((p: any) => p.resource === resource);

      if (existingPerm) {
        const hasAction = existingPerm.actions.includes(action as any);
        const newActions = hasAction
          ? existingPerm.actions.filter((a: any) => a !== action)
          : [...existingPerm.actions, action as any];

        if (newActions.length === 0) {
          return {
            ...prev,
            permissions: prev.permissions.filter((p: any) => p.resource !== resource),
          };
        }

        return {
          ...prev,
          permissions: prev.permissions.map((p: any) =>
            p.resource === resource ? { ...p, actions: newActions } : p
          ),
        };
      } else {
        return {
          ...prev,
          permissions: [
            ...prev.permissions,
            { resource: resource as any, actions: [action as any], scope: 'group' },
          ],
        };
      }
    });
  };

  const hasPermission = (resource: string, action: string) => {
    const perm = formData.permissions.find((p: any) => p.resource === resource);
    return perm?.actions.includes(action as any) || false;
  };

  const getColorClasses = (colorId: string) => {
    return GROUP_COLORS.find((c) => c.id === colorId) || GROUP_COLORS[0];
  };

  const filteredGroups = groups.filter(
    (g: any) =>
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <InfoButton cardId="admin-user-groups" position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-c-text flex items-center gap-2">
            <UsersRound size={24} />
            {t('admin.groups.title', 'Teams')}
          </h2>
          <p className="text-sm text-c-text-muted mt-1">
            {t('admin.groups.desc', 'Create reusable teams to quickly assign to projects')}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          disabled={!!loadError}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium"
        >
          <Plus size={18} />
          Create Team
        </button>
      </div>

      {loadError && <DegradedState title="Teams unavailable" description={loadError} />}

      {/* Info Banner - How teams work */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
        <Info className="text-blue-500 mt-0.5 flex-shrink-0" size={18} />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium flex items-center gap-2">
            <FolderKanban size={16} />
            Teams connect to Projects
          </p>
          <p className="mt-1 text-blue-600 dark:text-blue-400">
            Create teams here (e.g., "Frontend Team", "PMO Office", "QA"). When adding members to a
            project, you can select entire teams instead of individual users. All team members are
            added with their default project role.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-muted" size={18} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search teams..."
          disabled={!!loadError}
          className="w-full pl-10 pr-4 py-2 bg-c-surface border border-c-border-subtle rounded-lg text-c-text"
        />
      </div>

      {/* Teams List */}
      {loadError ? (
        <div className="p-6 bg-c-surface rounded-xl border border-c-border-subtle">
          <DegradedState title="Team list unavailable" description={loadError} />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="p-12 text-center bg-c-surface rounded-xl border border-c-border-subtle">
          <UsersRound className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-c-text">No Teams</h3>
          <p className="text-c-text-muted mt-1 mb-4">
            Create your first team to quickly assign groups of users to projects
          </p>
          <button
            onClick={openCreateModal}
            disabled={!!loadError}
            className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium"
          >
            Create Team
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const colors = getColorClasses(group.color || 'violet');
            const isExpanded = expandedGroup === group.id;

            return (
              <div
                key={group.id}
                className="bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden"
              >
                {/* Group Header */}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl ${colors.light} flex items-center justify-center`}
                      >
                        <UsersRound className={colors.text} size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-c-text">{group.name}</h3>
                          {group.isDefault && (
                            <span className="px-2 py-0.5 bg-c-surface-raised text-c-text-muted text-xs rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                        {group.description && (
                          <p className="text-sm text-c-text-muted mt-0.5">{group.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-c-text-muted">
                          <span className="flex items-center gap-1">
                            <Users size={12} />
                            {group.memberIds.length} members
                          </span>
                          <span className="flex items-center gap-1">
                            <FolderKanban size={12} />
                            Default:{' '}
                            {(group as any).defaultProjectRole?.replace('_', ' ') || 'Team Member'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openMembersModal(group)}
                        className="p-2 hover:bg-c-surface-raised rounded-lg text-c-text-muted hover:text-c-text-secondary"
                        title="Manage members"
                      >
                        <Users size={18} />
                      </button>
                      <button
                        onClick={() => openEditModal(group)}
                        className="p-2 hover:bg-c-surface-raised rounded-lg text-c-text-muted hover:text-c-text-secondary"
                        title="Edit group"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-2 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded-lg text-c-text-muted hover:text-danger-600"
                        title="Delete group"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button
                        onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                        className="p-2 hover:bg-c-surface-raised rounded-lg text-c-text-muted"
                      >
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-c-border-subtle"
                    >
                      <div className="p-4 space-y-4">
                        {/* Members */}
                        <div>
                          <h4 className="text-sm font-medium text-c-text-secondary mb-2">
                            Members
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {group.memberIds.length === 0 ? (
                              <span className="text-sm text-c-text-muted">No members yet</span>
                            ) : (
                              group.memberIds.map((memberId) => {
                                const user = users.find((u) => u.id === memberId);
                                const isLeader = group.leaderId === memberId;
                                return (
                                  <div
                                    key={memberId}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                                      isLeader
                                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                                        : 'bg-c-surface-raised text-c-text-secondary'
                                    }`}
                                  >
                                    {isLeader && <Crown size={12} />}
                                    <span className="text-sm">
                                      {user ? `${user.firstName} ${user.lastName}` : 'Unknown'}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Permissions */}
                        <div>
                          <h4 className="text-sm font-medium text-c-text-secondary mb-2">
                            Permissions
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {group.permissions?.length === 0 ? (
                              <span className="text-sm text-c-text-muted">No permissions set</span>
                            ) : (
                              group.permissions?.map((perm, idx: number) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded"
                                >
                                  {perm.resource}: {perm.actions.join(', ')}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-c-surface rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden"
            >
              <div className="p-6 border-b border-c-border-subtle">
                <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
                  <UsersRound size={20} />
                  {editingGroup ? 'Edit Team' : 'Create Team'}
                </h3>
              </div>
              <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      Group Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Project Managers"
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of this group"
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      Color
                    </label>
                    <div className="flex gap-2">
                      {GROUP_COLORS.map((color) => (
                        <button
                          key={color.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, color: color.id })}
                          className={`w-8 h-8 rounded-lg ${color.bg} ${
                            formData.color === color.id ? 'ring-2 ring-offset-2 ring-slate-400' : ''
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      Team Leader
                    </label>
                    <select
                      value={formData.leaderId}
                      onChange={(e) => setFormData({ ...formData, leaderId: e.target.value })}
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text"
                    >
                      <option value="">No leader</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Default Project Role */}
                <div className="p-4 bg-c-surface-raised rounded-lg border border-c-border-subtle">
                  <label className="block text-sm font-medium text-c-text-secondary mb-1 flex items-center gap-2">
                    <FolderKanban size={16} />
                    Default Project Role
                  </label>
                  <p className="text-xs text-c-text-muted mb-2">
                    When this team is added to a project, members will be assigned this role by
                    default.
                  </p>
                  <select
                    value={formData.defaultProjectRole}
                    onChange={(e) =>
                      setFormData({ ...formData, defaultProjectRole: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-c-surface border border-c-border-subtle rounded-lg text-c-text"
                  >
                    <option value="PROJECT_EXECUTIVE">Project Executive / Sponsor (Level 0)</option>
                    <option value="PROJECT_MANAGER">Project Manager (Level 1)</option>
                    <option value="TEAM_LEAD">Team Lead (Level 2)</option>
                    <option value="TEAM_MEMBER">Team Member (Level 3)</option>
                    <option value="STAKEHOLDER">Stakeholder / Viewer (Level 4)</option>
                  </select>
                </div>

                {/* Permissions Matrix */}
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-3">
                    Permissions
                  </label>
                  <div className="border border-c-border-subtle rounded-lg overflow-hidden">
                    <table
                      /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full text-sm"
                    >
                      <thead className="bg-c-surface-raised">
                        <tr>
                          <th className="px-4 py-2 text-left text-c-text-secondary font-medium">
                            Resource
                          </th>
                          {PERMISSION_ACTIONS.map((action) => (
                            <th
                              key={action}
                              className="px-2 py-2 text-center text-c-text-secondary font-medium capitalize"
                            >
                              {action}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-navy-600">
                        {PERMISSION_RESOURCES.map((resource) => (
                          <tr key={resource.id}>
                            <td className="px-4 py-2">
                              <div className="font-medium text-c-text">{resource.label}</div>
                              <div className="text-xs text-c-text-muted">
                                {resource.description}
                              </div>
                            </td>
                            {PERMISSION_ACTIONS.map((action) => (
                              <td key={action} className="px-2 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => togglePermission(resource.id, action)}
                                  className={`w-6 h-6 rounded ${
                                    hasPermission(resource.id, action)
                                      ? 'bg-c-text text-c-bg'
                                      : 'bg-slate-200 dark:bg-navy-700 text-c-text-muted'
                                  }`}
                                >
                                  {hasPermission(resource.id, action) && (
                                    <Check size={14} className="mx-auto" />
                                  )}
                                </button>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-c-border-subtle flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-c-text-secondary hover:text-c-text dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveGroup}
                  disabled={saving || !formData.name}
                  className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium disabled:opacity-50"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {editingGroup ? 'Save Changes' : 'Create Team'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Members Modal */}
      <AnimatePresence>
        {showMembersModal && selectedGroupForMembers && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-c-surface rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden"
            >
              <div className="p-6 border-b border-c-border-subtle">
                <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
                  <Users size={20} />
                  Manage Members - {selectedGroupForMembers.name}
                </h3>
              </div>
              <div className="p-4 max-h-[50vh] overflow-y-auto">
                <div className="space-y-2">
                  {users.map((user) => {
                    const isMember = selectedGroupForMembers.memberIds.includes(user.id);
                    const isLeader = selectedGroupForMembers.leaderId === user.id;

                    return (
                      <div
                        key={user.id}
                        onClick={() => toggleMember(user.id)}
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                          isMember
                            ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                            : 'bg-c-surface-raised border border-c-border-subtle hover:border-c-border'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-sm font-medium">
                            {user.firstName?.[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-c-text">
                                {user.firstName} {user.lastName}
                              </span>
                              {isLeader && <Crown size={14} className="text-amber-500" />}
                            </div>
                            <span className="text-xs text-c-text-muted">{user.email}</span>
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isMember ? 'bg-primary-600 border-primary-600' : 'border-c-border'
                          }`}
                        >
                          {isMember && <Check size={14} className="text-c-text" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="p-6 border-t border-c-border-subtle flex justify-end">
                <button
                  onClick={() => setShowMembersModal(false)}
                  className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserGroupsView;
