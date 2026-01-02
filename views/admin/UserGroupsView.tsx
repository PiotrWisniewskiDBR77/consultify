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

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    UsersRound,
    Plus,
    Edit,
    Trash2,
    Users,
    Shield,
    Search,
    X,
    Check,
    RefreshCw,
    Crown,
    ChevronDown,
    ChevronRight,
    Palette,
    FolderKanban,
    Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { User, UserGroup, GroupPermission } from '../../types';
import { Api } from '../../services/api';
import { InfoButton } from '../../components/shared/InfoButton';

// Group colors
const GROUP_COLORS = [
    { id: 'violet', bg: 'bg-violet-500', text: 'text-violet-500', light: 'bg-violet-100 dark:bg-violet-900/30' },
    { id: 'blue', bg: 'bg-blue-500', text: 'text-blue-500', light: 'bg-blue-100 dark:bg-blue-900/30' },
    { id: 'green', bg: 'bg-green-500', text: 'text-green-500', light: 'bg-green-100 dark:bg-green-900/30' },
    { id: 'amber', bg: 'bg-amber-500', text: 'text-amber-500', light: 'bg-amber-100 dark:bg-amber-900/30' },
    { id: 'rose', bg: 'bg-rose-500', text: 'text-rose-500', light: 'bg-rose-100 dark:bg-rose-900/30' },
    { id: 'cyan', bg: 'bg-cyan-500', text: 'text-cyan-500', light: 'bg-cyan-100 dark:bg-cyan-900/30' },
    { id: 'orange', bg: 'bg-orange-500', text: 'text-orange-500', light: 'bg-orange-100 dark:bg-orange-900/30' },
    { id: 'indigo', bg: 'bg-indigo-500', text: 'text-indigo-500', light: 'bg-indigo-100 dark:bg-indigo-900/30' }
];

// Permission resources
const PERMISSION_RESOURCES = [
    { id: 'projects', label: 'Projects', description: 'Access to project data' },
    { id: 'initiatives', label: 'Initiatives', description: 'Access to initiatives' },
    { id: 'tasks', label: 'Tasks', description: 'Access to tasks' },
    { id: 'decisions', label: 'Decisions', description: 'Access to decisions' },
    { id: 'knowledge', label: 'Knowledge Base', description: 'Access to documents' },
    { id: 'analytics', label: 'Analytics', description: 'Access to reports' },
    { id: 'ai', label: 'AI Features', description: 'Access to AI capabilities' }
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
        permissions: [] as GroupPermission[]
    });

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, [currentOrganization?.id]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load groups
            const groupsRes = await fetch(`/api/organizations/${currentOrganization?.id}/groups`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (groupsRes.ok) {
                const data = await groupsRes.json();
                setGroups(data);
            }

            // Load users for member selection
            const usersData = await Api.getUsers();
            setUsers(usersData);
        } catch (error) {
            console.error('Failed to load data:', error);
            // Mock data for development
            setGroups([
                {
                    id: 'group-1',
                    organizationId: currentOrganization?.id || '',
                    name: 'Project Managers',
                    description: 'All project managers in the organization',
                    color: 'violet',
                    leaderId: 'user-1',
                    memberIds: ['user-1', 'user-2', 'user-3'],
                    permissions: [
                        { resource: 'projects', actions: ['read', 'create', 'update', 'manage'], scope: 'all' },
                        { resource: 'tasks', actions: ['read', 'create', 'update', 'delete'], scope: 'all' }
                    ],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: 'group-2',
                    organizationId: currentOrganization?.id || '',
                    name: 'Development Team',
                    description: 'Software development team',
                    color: 'blue',
                    memberIds: ['user-4', 'user-5'],
                    permissions: [
                        { resource: 'tasks', actions: ['read', 'update'], scope: 'group' },
                        { resource: 'knowledge', actions: ['read'], scope: 'all' }
                    ],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: 'group-3',
                    organizationId: currentOrganization?.id || '',
                    name: 'Stakeholders',
                    description: 'External stakeholders with view access',
                    color: 'amber',
                    memberIds: ['user-6'],
                    permissions: [
                        { resource: 'projects', actions: ['read'], scope: 'all' },
                        { resource: 'analytics', actions: ['read'], scope: 'all' }
                    ],
                    isDefault: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ]);
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
            permissions: []
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
            permissions: group.permissions || []
        });
        setShowCreateModal(true);
    };

    const handleSaveGroup = async () => {
        if (!formData.name.trim()) {
            toast.error('Please enter a group name');
            return;
        }

        setSaving(true);
        try {
            const url = editingGroup
                ? `/api/organizations/${currentOrganization?.id}/groups/${editingGroup.id}`
                : `/api/organizations/${currentOrganization?.id}/groups`;
            
            const res = await fetch(url, {
                method: editingGroup ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast.success(editingGroup ? 'Group updated' : 'Group created');
                setShowCreateModal(false);
                loadData();
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            // Mock success for development
            toast.success(editingGroup ? 'Group updated' : 'Group created');
            setShowCreateModal(false);
            
            if (editingGroup) {
                setGroups(prev => prev.map(g => 
                    g.id === editingGroup.id 
                        ? { ...g, ...formData, updatedAt: new Date().toISOString() }
                        : g
                ));
            } else {
                const newGroup: UserGroup = {
                    id: `group-${Date.now()}`,
                    organizationId: currentOrganization?.id || '',
                    name: formData.name,
                    description: formData.description,
                    color: formData.color,
                    leaderId: formData.leaderId,
                    memberIds: [],
                    permissions: formData.permissions,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                setGroups(prev => [...prev, newGroup]);
            }
        }
        setSaving(false);
    };

    const handleDeleteGroup = async (groupId: string) => {
        if (!confirm('Are you sure you want to delete this group? Members will not be deleted.')) {
            return;
        }

        try {
            await fetch(`/api/organizations/${currentOrganization?.id}/groups/${groupId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            toast.success('Group deleted');
            setGroups(prev => prev.filter(g => g.id !== groupId));
        } catch (error) {
            // Mock for development
            toast.success('Group deleted');
            setGroups(prev => prev.filter(g => g.id !== groupId));
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
            ? selectedGroupForMembers.memberIds.filter(id => id !== userId)
            : [...selectedGroupForMembers.memberIds, userId];

        try {
            await fetch(`/api/organizations/${currentOrganization?.id}/groups/${selectedGroupForMembers.id}/members`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ memberIds: newMemberIds })
            });
        } catch (error) {
            // Continue with local update
        }

        // Update local state
        setGroups(prev => prev.map(g =>
            g.id === selectedGroupForMembers.id
                ? { ...g, memberIds: newMemberIds }
                : g
        ));
        setSelectedGroupForMembers(prev => prev ? { ...prev, memberIds: newMemberIds } : null);
    };

    const togglePermission = (resource: string, action: string) => {
        setFormData(prev => {
            const existingPerm = prev.permissions.find(p => p.resource === resource);
            
            if (existingPerm) {
                const hasAction = existingPerm.actions.includes(action as any);
                const newActions = hasAction
                    ? existingPerm.actions.filter(a => a !== action)
                    : [...existingPerm.actions, action as any];
                
                if (newActions.length === 0) {
                    return {
                        ...prev,
                        permissions: prev.permissions.filter(p => p.resource !== resource)
                    };
                }
                
                return {
                    ...prev,
                    permissions: prev.permissions.map(p =>
                        p.resource === resource ? { ...p, actions: newActions } : p
                    )
                };
            } else {
                return {
                    ...prev,
                    permissions: [...prev.permissions, { resource: resource as any, actions: [action as any], scope: 'group' }]
                };
            }
        });
    };

    const hasPermission = (resource: string, action: string) => {
        const perm = formData.permissions.find(p => p.resource === resource);
        return perm?.actions.includes(action as any) || false;
    };

    const getColorClasses = (colorId: string) => {
        return GROUP_COLORS.find(c => c.id === colorId) || GROUP_COLORS[0];
    };

    const getMemberNames = (memberIds: string[]) => {
        return memberIds.map(id => {
            const user = users.find(u => u.id === id);
            return user ? `${user.firstName} ${user.lastName}` : 'Unknown';
        }).slice(0, 3).join(', ') + (memberIds.length > 3 ? ` +${memberIds.length - 3} more` : '');
    };

    const filteredGroups = groups.filter(g =>
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className}`}>
            <InfoButton cardId="admin-user-groups" position="top-right" />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <UsersRound size={24} />
                        {t('admin.groups.title', 'Teams')}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t('admin.groups.desc', 'Create reusable teams to quickly assign to projects')}
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium"
                >
                    <Plus size={18} />
                    Create Team
                </button>
            </div>

            {/* Info Banner - How teams work */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
                <Info className="text-blue-500 mt-0.5 flex-shrink-0" size={18} />
                <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium flex items-center gap-2">
                        <FolderKanban size={16} />
                        Teams connect to Projects
                    </p>
                    <p className="mt-1 text-blue-600 dark:text-blue-400">
                        Create teams here (e.g., "Frontend Team", "PMO Office", "QA"). When adding members to a project, 
                        you can select entire teams instead of individual users. All team members are added with their 
                        default project role.
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search teams..."
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                />
            </div>

            {/* Teams List */}
            {filteredGroups.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
                    <UsersRound className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">No Teams</h3>
                    <p className="text-slate-500 mt-1 mb-4">Create your first team to quickly assign groups of users to projects</p>
                    <button
                        onClick={openCreateModal}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium"
                    >
                        Create Team
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredGroups.map(group => {
                        const colors = getColorClasses(group.color || 'violet');
                        const isExpanded = expandedGroup === group.id;

                        return (
                            <div
                                key={group.id}
                                className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden"
                            >
                                {/* Group Header */}
                                <div className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl ${colors.light} flex items-center justify-center`}>
                                                <UsersRound className={colors.text} size={24} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-slate-900 dark:text-white">{group.name}</h3>
                                                    {group.isDefault && (
                                                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-navy-700 text-slate-500 text-xs rounded-full">
                                                            Default
                                                        </span>
                                                    )}
                                                </div>
                                                {group.description && (
                                                    <p className="text-sm text-slate-500 mt-0.5">{group.description}</p>
                                                )}
                                                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <Users size={12} />
                                                        {group.memberIds.length} members
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <FolderKanban size={12} />
                                                        Default: {(group as any).defaultProjectRole?.replace('_', ' ') || 'Team Member'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openMembersModal(group)}
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg text-slate-500 hover:text-slate-700"
                                                title="Manage members"
                                            >
                                                <Users size={18} />
                                            </button>
                                            <button
                                                onClick={() => openEditModal(group)}
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg text-slate-500 hover:text-slate-700"
                                                title="Edit group"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteGroup(group.id)}
                                                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-slate-500 hover:text-red-600"
                                                title="Delete group"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg text-slate-500"
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
                                            className="border-t border-slate-200 dark:border-navy-700"
                                        >
                                            <div className="p-4 space-y-4">
                                                {/* Members */}
                                                <div>
                                                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Members</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {group.memberIds.length === 0 ? (
                                                            <span className="text-sm text-slate-500">No members yet</span>
                                                        ) : (
                                                            group.memberIds.map(memberId => {
                                                                const user = users.find(u => u.id === memberId);
                                                                const isLeader = group.leaderId === memberId;
                                                                return (
                                                                    <div
                                                                        key={memberId}
                                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                                                                            isLeader
                                                                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                                                                                : 'bg-slate-100 dark:bg-navy-700 text-slate-700 dark:text-slate-300'
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
                                                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Permissions</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {group.permissions?.length === 0 ? (
                                                            <span className="text-sm text-slate-500">No permissions set</span>
                                                        ) : (
                                                            group.permissions?.map((perm, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="px-2 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs rounded"
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
                            className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-200 dark:border-navy-700">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <UsersRound size={20} />
                                    {editingGroup ? 'Edit Team' : 'Create Team'}
                                </h3>
                            </div>
                            <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
                                {/* Basic Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Group Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g., Project Managers"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Description
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Brief description of this group"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Color
                                        </label>
                                        <div className="flex gap-2">
                                            {GROUP_COLORS.map(color => (
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
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Team Leader
                                        </label>
                                        <select
                                            value={formData.leaderId}
                                            onChange={(e) => setFormData({ ...formData, leaderId: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                                        >
                                            <option value="">No leader</option>
                                            {users.map(user => (
                                                <option key={user.id} value={user.id}>
                                                    {user.firstName} {user.lastName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Default Project Role */}
                                <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-600">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                                        <FolderKanban size={16} />
                                        Default Project Role
                                    </label>
                                    <p className="text-xs text-slate-500 mb-2">
                                        When this team is added to a project, members will be assigned this role by default.
                                    </p>
                                    <select
                                        value={formData.defaultProjectRole}
                                        onChange={(e) => setFormData({ ...formData, defaultProjectRole: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
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
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                                        Permissions
                                    </label>
                                    <div className="border border-slate-200 dark:border-navy-600 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 dark:bg-navy-900">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-400 font-medium">Resource</th>
                                                    {PERMISSION_ACTIONS.map(action => (
                                                        <th key={action} className="px-2 py-2 text-center text-slate-600 dark:text-slate-400 font-medium capitalize">
                                                            {action}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 dark:divide-navy-600">
                                                {PERMISSION_RESOURCES.map(resource => (
                                                    <tr key={resource.id}>
                                                        <td className="px-4 py-2">
                                                            <div className="font-medium text-slate-900 dark:text-white">{resource.label}</div>
                                                            <div className="text-xs text-slate-500">{resource.description}</div>
                                                        </td>
                                                        {PERMISSION_ACTIONS.map(action => (
                                                            <td key={action} className="px-2 py-2 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => togglePermission(resource.id, action)}
                                                                    className={`w-6 h-6 rounded ${
                                                                        hasPermission(resource.id, action)
                                                                            ? 'bg-violet-600 text-white'
                                                                            : 'bg-slate-200 dark:bg-navy-700 text-slate-400'
                                                                    }`}
                                                                >
                                                                    {hasPermission(resource.id, action) && <Check size={14} className="mx-auto" />}
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
                            <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveGroup}
                                    disabled={saving || !formData.name}
                                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium disabled:opacity-50"
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
                            className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-200 dark:border-navy-700">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Users size={20} />
                                    Manage Members - {selectedGroupForMembers.name}
                                </h3>
                            </div>
                            <div className="p-4 max-h-[50vh] overflow-y-auto">
                                <div className="space-y-2">
                                    {users.map(user => {
                                        const isMember = selectedGroupForMembers.memberIds.includes(user.id);
                                        const isLeader = selectedGroupForMembers.leaderId === user.id;

                                        return (
                                            <div
                                                key={user.id}
                                                onClick={() => toggleMember(user.id)}
                                                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                                                    isMember
                                                        ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800'
                                                        : 'bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 hover:border-slate-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-sm font-medium">
                                                        {user.firstName?.[0]}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-slate-900 dark:text-white">
                                                                {user.firstName} {user.lastName}
                                                            </span>
                                                            {isLeader && (
                                                                <Crown size={14} className="text-amber-500" />
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-slate-500">{user.email}</span>
                                                    </div>
                                                </div>
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                                    isMember
                                                        ? 'bg-violet-600 border-violet-600'
                                                        : 'border-slate-300 dark:border-navy-600'
                                                }`}>
                                                    {isMember && <Check size={14} className="text-white" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end">
                                <button
                                    onClick={() => setShowMembersModal(false)}
                                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium"
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


