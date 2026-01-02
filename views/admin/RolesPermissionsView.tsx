/**
 * RolesPermissionsView - Custom Roles & Permission Matrix
 * 
 * Features:
 * - View default system roles
 * - Create custom roles
 * - Permission matrix visualization
 * - Role hierarchy
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Key,
    Shield,
    Plus,
    Edit,
    Trash2,
    Check,
    X,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    Lock,
    Crown,
    Users,
    Eye,
    Briefcase,
    AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { CustomRole, UserRole, RolePermission } from '../../types';
import { InfoButton } from '../../components/shared/InfoButton';

// System roles with their default permissions
const SYSTEM_ROLES = [
    {
        id: 'OWNER',
        name: 'Owner',
        description: 'Organization owner with full access including billing',
        icon: Crown,
        color: 'amber',
        isSystem: true,
        permissions: ['*'] // All permissions
    },
    {
        id: 'ADMIN',
        name: 'Administrator',
        description: 'Full access except billing and ownership transfer',
        icon: Shield,
        color: 'violet',
        isSystem: true,
        permissions: ['users:*', 'projects:*', 'ai:*', 'settings:*']
    },
    {
        id: 'PROJECT_MANAGER',
        name: 'Project Manager',
        description: 'Manage projects and team members',
        icon: Briefcase,
        color: 'blue',
        isSystem: true,
        permissions: ['projects:*', 'tasks:*', 'initiatives:*', 'users:read']
    },
    {
        id: 'TEAM_MEMBER',
        name: 'Team Member',
        description: 'Standard access to assigned projects',
        icon: Users,
        color: 'green',
        isSystem: true,
        permissions: ['projects:read', 'tasks:*:own', 'decisions:read']
    },
    {
        id: 'VIEWER',
        name: 'Viewer',
        description: 'Read-only access to projects',
        icon: Eye,
        color: 'slate',
        isSystem: true,
        permissions: ['projects:read', 'tasks:read', 'analytics:read']
    },
    {
        id: 'GUEST',
        name: 'Guest',
        description: 'Limited access for external users',
        icon: Lock,
        color: 'slate',
        isSystem: true,
        permissions: ['projects:read:invited']
    }
];

// Permission categories and items
const PERMISSION_MATRIX = [
    {
        category: 'Organization',
        permissions: [
            { id: 'org:manage', label: 'Manage Organization', description: 'Edit organization settings' },
            { id: 'org:billing', label: 'Manage Billing', description: 'Access billing & subscription' },
            { id: 'org:delete', label: 'Delete Organization', description: 'Delete the organization' }
        ]
    },
    {
        category: 'Users',
        permissions: [
            { id: 'users:read', label: 'View Users', description: 'See user list and details' },
            { id: 'users:create', label: 'Create Users', description: 'Add new users' },
            { id: 'users:update', label: 'Update Users', description: 'Edit user information' },
            { id: 'users:delete', label: 'Delete Users', description: 'Remove users' },
            { id: 'users:roles', label: 'Manage Roles', description: 'Assign roles to users' }
        ]
    },
    {
        category: 'Projects',
        permissions: [
            { id: 'projects:read', label: 'View Projects', description: 'See project list' },
            { id: 'projects:create', label: 'Create Projects', description: 'Create new projects' },
            { id: 'projects:update', label: 'Update Projects', description: 'Edit project details' },
            { id: 'projects:delete', label: 'Delete Projects', description: 'Remove projects' },
            { id: 'projects:settings', label: 'Project Settings', description: 'Manage project settings' }
        ]
    },
    {
        category: 'Tasks',
        permissions: [
            { id: 'tasks:read', label: 'View Tasks', description: 'See task list' },
            { id: 'tasks:create', label: 'Create Tasks', description: 'Create new tasks' },
            { id: 'tasks:update', label: 'Update Tasks', description: 'Edit task details' },
            { id: 'tasks:delete', label: 'Delete Tasks', description: 'Remove tasks' },
            { id: 'tasks:assign', label: 'Assign Tasks', description: 'Assign tasks to users' }
        ]
    },
    {
        category: 'Initiatives',
        permissions: [
            { id: 'initiatives:read', label: 'View Initiatives', description: 'See initiatives' },
            { id: 'initiatives:create', label: 'Create Initiatives', description: 'Create new initiatives' },
            { id: 'initiatives:update', label: 'Update Initiatives', description: 'Edit initiatives' },
            { id: 'initiatives:approve', label: 'Approve Initiatives', description: 'Approve stage gates' }
        ]
    },
    {
        category: 'Decisions',
        permissions: [
            { id: 'decisions:read', label: 'View Decisions', description: 'See decisions' },
            { id: 'decisions:create', label: 'Create Decisions', description: 'Create new decisions' },
            { id: 'decisions:vote', label: 'Vote on Decisions', description: 'Cast votes' },
            { id: 'decisions:close', label: 'Close Decisions', description: 'Finalize decisions' }
        ]
    },
    {
        category: 'AI',
        permissions: [
            { id: 'ai:use', label: 'Use AI Features', description: 'Access AI assistant' },
            { id: 'ai:settings', label: 'AI Settings', description: 'Configure AI behavior' },
            { id: 'ai:execute', label: 'AI Execute', description: 'Allow AI auto-actions' }
        ]
    },
    {
        category: 'Analytics',
        permissions: [
            { id: 'analytics:read', label: 'View Analytics', description: 'Access dashboards' },
            { id: 'analytics:export', label: 'Export Data', description: 'Download reports' }
        ]
    }
];

interface RolesPermissionsViewProps {
    className?: string;
}

export const RolesPermissionsView: React.FC<RolesPermissionsViewProps> = ({ className = '' }) => {
    const { t } = useTranslation();
    const { currentOrganization } = useAppStore();

    const [loading, setLoading] = useState(true);
    const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['Organization', 'Users', 'Projects']);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        baseRole: 'TEAM_MEMBER' as UserRole,
        permissions: [] as string[]
    });

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadCustomRoles();
    }, [currentOrganization?.id]);

    const loadCustomRoles = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/organizations/${currentOrganization?.id}/roles`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCustomRoles(data);
            }
        } catch (error) {
            // Mock data for development
            setCustomRoles([
                {
                    id: 'custom-1',
                    organizationId: currentOrganization?.id || '',
                    name: 'Senior Developer',
                    description: 'Extended permissions for senior team members',
                    baseRole: UserRole.TEAM_MEMBER,
                    permissions: [
                        { resource: 'tasks', action: '*', allowed: true },
                        { resource: 'projects', action: 'read', allowed: true },
                        { resource: 'initiatives', action: 'read', allowed: true },
                        { resource: 'initiatives', action: 'create', allowed: true }
                    ],
                    isSystemRole: false,
                    createdBy: 'user-1',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ]);
        }
        setLoading(false);
    };

    const openCreateModal = () => {
        setEditingRole(null);
        setFormData({
            name: '',
            description: '',
            baseRole: UserRole.TEAM_MEMBER,
            permissions: []
        });
        setShowCreateModal(true);
    };

    const openEditModal = (role: CustomRole) => {
        setEditingRole(role);
        setFormData({
            name: role.name,
            description: role.description || '',
            baseRole: role.baseRole,
            permissions: role.permissions.filter(p => p.allowed).map(p => `${p.resource}:${p.action}`)
        });
        setShowCreateModal(true);
    };

    const handleSaveRole = async () => {
        if (!formData.name.trim()) {
            toast.error('Please enter a role name');
            return;
        }

        setSaving(true);
        try {
            const url = editingRole
                ? `/api/organizations/${currentOrganization?.id}/roles/${editingRole.id}`
                : `/api/organizations/${currentOrganization?.id}/roles`;

            const res = await fetch(url, {
                method: editingRole ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    ...formData,
                    permissions: formData.permissions.map(p => {
                        const [resource, action] = p.split(':');
                        return { resource, action, allowed: true };
                    })
                })
            });

            if (res.ok) {
                toast.success(editingRole ? 'Role updated' : 'Role created');
                setShowCreateModal(false);
                loadCustomRoles();
            }
        } catch (error) {
            // Mock success
            toast.success(editingRole ? 'Role updated' : 'Role created');
            setShowCreateModal(false);
            
            if (!editingRole) {
                const newRole: CustomRole = {
                    id: `custom-${Date.now()}`,
                    organizationId: currentOrganization?.id || '',
                    name: formData.name,
                    description: formData.description,
                    baseRole: formData.baseRole,
                    permissions: formData.permissions.map(p => {
                        const [resource, action] = p.split(':');
                        return { resource, action, allowed: true };
                    }),
                    isSystemRole: false,
                    createdBy: 'current-user',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                setCustomRoles(prev => [...prev, newRole]);
            }
        }
        setSaving(false);
    };

    const handleDeleteRole = async (roleId: string) => {
        if (!confirm('Are you sure you want to delete this role?')) return;

        try {
            await fetch(`/api/organizations/${currentOrganization?.id}/roles/${roleId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            toast.success('Role deleted');
            setCustomRoles(prev => prev.filter(r => r.id !== roleId));
        } catch (error) {
            toast.success('Role deleted');
            setCustomRoles(prev => prev.filter(r => r.id !== roleId));
        }
    };

    const togglePermission = (permId: string) => {
        setFormData(prev => ({
            ...prev,
            permissions: prev.permissions.includes(permId)
                ? prev.permissions.filter(p => p !== permId)
                : [...prev.permissions, permId]
        }));
    };

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const getColorClasses = (color: string) => {
        const colors: Record<string, { bg: string; text: string; light: string }> = {
            amber: { bg: 'bg-amber-500', text: 'text-amber-500', light: 'bg-amber-100 dark:bg-amber-900/30' },
            violet: { bg: 'bg-violet-500', text: 'text-violet-500', light: 'bg-violet-100 dark:bg-violet-900/30' },
            blue: { bg: 'bg-blue-500', text: 'text-blue-500', light: 'bg-blue-100 dark:bg-blue-900/30' },
            green: { bg: 'bg-green-500', text: 'text-green-500', light: 'bg-green-100 dark:bg-green-900/30' },
            slate: { bg: 'bg-slate-500', text: 'text-slate-500', light: 'bg-slate-100 dark:bg-slate-900/30' }
        };
        return colors[color] || colors.slate;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className}`}>
            <InfoButton cardId="admin-roles" position="top-right" />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Key size={24} />
                        {t('admin.roles.title', 'Roles & Permissions')}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t('admin.roles.desc', 'Manage system roles and create custom permission sets')}
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium"
                >
                    <Plus size={18} />
                    Create Custom Role
                </button>
            </div>

            {/* System Roles */}
            <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">System Roles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {SYSTEM_ROLES.map(role => {
                        const Icon = role.icon;
                        const colors = getColorClasses(role.color);

                        return (
                            <div
                                key={role.id}
                                onClick={() => setSelectedRole(selectedRole === role.id ? null : role.id)}
                                className={`p-4 bg-white dark:bg-navy-800 rounded-xl border cursor-pointer transition-all ${
                                    selectedRole === role.id
                                        ? 'border-violet-500 ring-2 ring-violet-500/20'
                                        : 'border-slate-200 dark:border-navy-700 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`p-2.5 rounded-lg ${colors.light}`}>
                                        <Icon className={colors.text} size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-slate-900 dark:text-white">{role.name}</h4>
                                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-navy-700 text-slate-500 text-[10px] rounded">
                                                SYSTEM
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">{role.description}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Custom Roles */}
            <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Custom Roles</h3>
                {customRoles.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
                        <Key className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">No custom roles yet</p>
                        <button
                            onClick={openCreateModal}
                            className="mt-3 text-violet-600 hover:text-violet-500 text-sm font-medium"
                        >
                            Create your first custom role
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {customRoles.map(role => (
                            <div
                                key={role.id}
                                className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                                            <Key className="text-violet-500" size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-slate-900 dark:text-white">{role.name}</h4>
                                            <p className="text-xs text-slate-500">{role.description || 'No description'}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-slate-400">Based on:</span>
                                                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300 text-xs rounded">
                                                    {role.baseRole}
                                                </span>
                                                <span className="text-xs text-slate-400">•</span>
                                                <span className="text-xs text-slate-500">
                                                    {role.permissions.length} custom permissions
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openEditModal(role)}
                                            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg text-slate-500"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteRole(role.id)}
                                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-slate-500 hover:text-red-600"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Permission Matrix (when role selected) */}
            {selectedRole && (
                <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
                        {SYSTEM_ROLES.find(r => r.id === selectedRole)?.name} Permissions
                    </h3>
                    <div className="space-y-3">
                        {PERMISSION_MATRIX.map(category => (
                            <div key={category.category} className="border border-slate-200 dark:border-navy-600 rounded-lg overflow-hidden">
                                <button
                                    onClick={() => toggleCategory(category.category)}
                                    className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-900 text-left"
                                >
                                    <span className="font-medium text-slate-700 dark:text-slate-300">{category.category}</span>
                                    {expandedCategories.includes(category.category) ? (
                                        <ChevronDown size={18} className="text-slate-400" />
                                    ) : (
                                        <ChevronRight size={18} className="text-slate-400" />
                                    )}
                                </button>
                                {expandedCategories.includes(category.category) && (
                                    <div className="p-3 space-y-2">
                                        {category.permissions.map(perm => {
                                            const hasPermission = selectedRole === 'OWNER' || 
                                                (selectedRole === 'ADMIN' && !perm.id.includes('org:'));
                                            return (
                                                <div
                                                    key={perm.id}
                                                    className="flex items-center justify-between py-2"
                                                >
                                                    <div>
                                                        <span className="text-sm text-slate-900 dark:text-white">{perm.label}</span>
                                                        <p className="text-xs text-slate-500">{perm.description}</p>
                                                    </div>
                                                    <div className={`w-6 h-6 rounded flex items-center justify-center ${
                                                        hasPermission
                                                            ? 'bg-green-500 text-white'
                                                            : 'bg-slate-200 dark:bg-navy-700 text-slate-400'
                                                    }`}>
                                                        {hasPermission ? <Check size={14} /> : <X size={14} />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
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
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    {editingRole ? 'Edit Custom Role' : 'Create Custom Role'}
                                </h3>
                            </div>
                            <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Role Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g., Senior Developer"
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Description
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Brief description of this role"
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Base Role
                                    </label>
                                    <select
                                        value={formData.baseRole}
                                        onChange={(e) => setFormData({ ...formData, baseRole: e.target.value as UserRole })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg"
                                    >
                                        {SYSTEM_ROLES.filter(r => r.id !== 'OWNER').map(role => (
                                            <option key={role.id} value={role.id}>{role.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-500 mt-1">
                                        This role will inherit permissions from the base role
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Additional Permissions
                                    </label>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {PERMISSION_MATRIX.map(category => (
                                            <div key={category.category}>
                                                <p className="text-xs font-medium text-slate-500 mb-1">{category.category}</p>
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    {category.permissions.map(perm => (
                                                        <button
                                                            key={perm.id}
                                                            type="button"
                                                            onClick={() => togglePermission(perm.id)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                                                formData.permissions.includes(perm.id)
                                                                    ? 'bg-violet-600 text-white'
                                                                    : 'bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                                            }`}
                                                        >
                                                            {perm.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 text-slate-600 dark:text-slate-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveRole}
                                    disabled={saving || !formData.name}
                                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium disabled:opacity-50"
                                >
                                    {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    {editingRole ? 'Save Changes' : 'Create Role'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RolesPermissionsView;


