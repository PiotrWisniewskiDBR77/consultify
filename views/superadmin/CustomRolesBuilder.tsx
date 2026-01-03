/**
 * Custom Roles Builder
 * 
 * Visual role builder for creating and managing custom RBAC roles.
 * Supports permission assignment, role templates, and user assignment.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Shield,
    Users,
    Plus,
    Trash2,
    Edit2,
    Save,
    X,
    Check,
    RefreshCw,
    Copy,
    Settings,
    ChevronRight,
    Lock,
    Unlock,
    Search,
    AlertTriangle,
} from 'lucide-react';
import { api } from '../../services/api';

interface Permission {
    id: string;
    name: string;
    displayName: string;
    description: string;
    category: string;
    resource: string;
    action: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface Role {
    id: string;
    name: string;
    displayName: string;
    description: string | null;
    color: string;
    icon: string;
    baseRole: string | null;
    roleType: 'system' | 'custom' | 'template';
    scope: string;
    priority: number;
    isActive: boolean;
    isDefault: boolean;
    userCount: number;
    isSystem?: boolean;
    permissions?: RolePermission[];
}

interface RolePermission {
    id: string;
    permissionId: string;
    permissionName: string;
    displayName: string;
    category: string;
    grantType: 'allow' | 'deny';
    riskLevel: string;
}

interface RoleTemplate {
    name: string;
    displayName: string;
    description: string;
    color: string;
    icon: string;
    permissions: string[];
}

type TabType = 'roles' | 'permissions' | 'templates';

const ROLE_COLORS = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#ef4444', '#f97316',
    '#eab308', '#84cc16', '#22c55e', '#10b981',
    '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
];

const CustomRolesBuilder: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabType>('roles');
    const [loading, setLoading] = useState(false);

    // Data state
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [templates, setTemplates] = useState<RoleTemplate[]>([]);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);

    // UI state
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [newRole, setNewRole] = useState({
        name: '',
        displayName: '',
        description: '',
        color: '#6366f1',
        baseRole: '',
        isDefault: false,
    });

    // Fetch data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [rolesRes, permsRes, templatesRes] = await Promise.all([
                api.get('/rbac/roles').catch(() => ({ data: { data: [] } })),
                api.get('/rbac/permissions').catch(() => ({ data: { data: [] } })),
                api.get('/rbac/templates').catch(() => ({ data: { data: [] } })),
            ]);

            setRoles(rolesRes.data.data || []);
            setPermissions(permsRes.data.data || []);
            setTemplates(templatesRes.data.data || []);
        } catch (error) {
            console.error('[RBAC] Fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Fetch role permissions when selected
    useEffect(() => {
        if (selectedRole && !selectedRole.isSystem) {
            api.get(`/rbac/roles/${selectedRole.id}/permissions`)
                .then(res => setRolePermissions(res.data.data || []))
                .catch(() => setRolePermissions([]));
        } else {
            setRolePermissions([]);
        }
    }, [selectedRole]);

    // Create role
    const handleCreateRole = async () => {
        if (!newRole.name || !newRole.displayName) return;

        try {
            const response = await api.post('/rbac/roles', {
                name: newRole.name.toLowerCase().replace(/\s+/g, '_'),
                displayName: newRole.displayName,
                description: newRole.description,
                color: newRole.color,
                baseRole: newRole.baseRole || null,
                isDefault: newRole.isDefault,
            });

            setShowRoleModal(false);
            setNewRole({ name: '', displayName: '', description: '', color: '#6366f1', baseRole: '', isDefault: false });
            fetchData();
        } catch (error) {
            console.error('[RBAC] Create role error:', error);
        }
    };

    // Delete role
    const handleDeleteRole = async (roleId: string) => {
        if (!confirm('Delete this role? Users with this role will need to be reassigned.')) return;

        try {
            await api.delete(`/rbac/roles/${roleId}`);
            if (selectedRole?.id === roleId) setSelectedRole(null);
            fetchData();
        } catch (error: any) {
            alert(error.response?.data?.error || 'Failed to delete role');
        }
    };

    // Create role from template
    const handleCreateFromTemplate = async (templateName: string) => {
        try {
            await api.post('/rbac/roles/from-template', { templateName });
            fetchData();
        } catch (error: any) {
            alert(error.response?.data?.error || 'Failed to create role from template');
        }
    };

    // Toggle permission on role
    const handleTogglePermission = async (permissionId: string, currentlyAssigned: boolean) => {
        if (!selectedRole || selectedRole.isSystem) return;

        try {
            if (currentlyAssigned) {
                await api.delete(`/rbac/roles/${selectedRole.id}/permissions/${permissionId}`);
            } else {
                await api.post(`/rbac/roles/${selectedRole.id}/permissions`, {
                    permissionId,
                    grantType: 'allow',
                });
            }

            // Refresh permissions
            const res = await api.get(`/rbac/roles/${selectedRole.id}/permissions`);
            setRolePermissions(res.data.data || []);
        } catch (error) {
            console.error('[RBAC] Toggle permission error:', error);
        }
    };

    // Group permissions by category
    const permissionsByCategory = permissions.reduce((acc, perm) => {
        if (!acc[perm.category]) acc[perm.category] = [];
        acc[perm.category].push(perm);
        return acc;
    }, {} as Record<string, Permission[]>);

    const categories = Object.keys(permissionsByCategory).sort();

    // Filter permissions
    const filteredPermissions = permissions.filter(perm => {
        if (selectedCategory && perm.category !== selectedCategory) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return perm.name.toLowerCase().includes(q) ||
                   perm.displayName.toLowerCase().includes(q) ||
                   perm.description?.toLowerCase().includes(q);
        }
        return true;
    });

    const tabs = [
        { id: 'roles' as TabType, label: 'Roles', icon: Shield },
        { id: 'permissions' as TabType, label: 'Permissions', icon: Lock },
        { id: 'templates' as TabType, label: 'Templates', icon: Copy },
    ];

    const renderRoles = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Roles List */}
            <div className="lg:col-span-1 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Roles</h3>
                    <button
                        onClick={() => setShowRoleModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition-colors"
                    >
                        <Plus size={16} />
                        New Role
                    </button>
                </div>

                <div className="space-y-2">
                    {roles.map((role) => (
                        <div
                            key={role.id}
                            onClick={() => setSelectedRole(role)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                selectedRole?.id === role.id
                                    ? 'bg-violet-500/10 border-violet-500/50'
                                    : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: `${role.color}20` }}
                                    >
                                        <Shield style={{ color: role.color }} size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-white">{role.displayName || role.display_name}</h4>
                                        <div className="flex items-center gap-2">
                                            {role.isSystem || role.roleType === 'system' ? (
                                                <span className="text-xs text-gray-500">System</span>
                                            ) : (
                                                <span className="text-xs text-violet-400">Custom</span>
                                            )}
                                            {role.userCount > 0 && (
                                                <span className="text-xs text-gray-400">
                                                    {role.userCount} users
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {!(role.isSystem || role.roleType === 'system') && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRole(role.id);
                                        }}
                                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Role Details / Permission Editor */}
            <div className="lg:col-span-2">
                {selectedRole ? (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: `${selectedRole.color}20` }}
                                >
                                    <Shield style={{ color: selectedRole.color }} size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-white">
                                        {selectedRole.displayName || selectedRole.display_name}
                                    </h3>
                                    {selectedRole.description && (
                                        <p className="text-sm text-gray-400">{selectedRole.description}</p>
                                    )}
                                </div>
                            </div>
                            {(selectedRole.isSystem || selectedRole.roleType === 'system') && (
                                <span className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded-lg">
                                    System Role (Read-only)
                                </span>
                            )}
                        </div>

                        {(selectedRole.isSystem || selectedRole.roleType === 'system') ? (
                            <div className="text-center py-8">
                                <Lock className="mx-auto text-gray-500 mb-4" size={48} />
                                <p className="text-gray-400">System roles cannot be modified</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    Create a custom role to customize permissions
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Permission Search */}
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search permissions..."
                                            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                                        />
                                    </div>
                                    <select
                                        value={selectedCategory || ''}
                                        onChange={(e) => setSelectedCategory(e.target.value || null)}
                                        className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                                    >
                                        <option value="">All Categories</option>
                                        {categories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Permissions Grid */}
                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                    {(selectedCategory ? [selectedCategory] : categories).map(category => {
                                        const categoryPerms = filteredPermissions.filter(p => p.category === category);
                                        if (categoryPerms.length === 0) return null;

                                        return (
                                            <div key={category}>
                                                <h4 className="text-sm font-medium text-gray-400 mb-2">{category}</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {categoryPerms.map(perm => {
                                                        const isAssigned = rolePermissions.some(rp => rp.permissionName === perm.name);
                                                        return (
                                                            <label
                                                                key={perm.id}
                                                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                                                                    isAssigned
                                                                        ? 'bg-violet-500/10 border border-violet-500/30'
                                                                        : 'bg-gray-900/50 border border-gray-700 hover:border-gray-600'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isAssigned}
                                                                    onChange={() => handleTogglePermission(perm.id, isAssigned)}
                                                                    className="rounded border-gray-600 bg-gray-900 text-violet-500"
                                                                />
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-white text-sm font-medium truncate">
                                                                            {perm.displayName}
                                                                        </span>
                                                                        {perm.riskLevel === 'critical' && (
                                                                            <AlertTriangle className="text-red-400 flex-shrink-0" size={14} />
                                                                        )}
                                                                        {perm.riskLevel === 'high' && (
                                                                            <AlertTriangle className="text-amber-400 flex-shrink-0" size={14} />
                                                                        )}
                                                                    </div>
                                                                    {perm.description && (
                                                                        <p className="text-xs text-gray-500 truncate">{perm.description}</p>
                                                                    )}
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Summary */}
                                <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between">
                                    <span className="text-sm text-gray-400">
                                        {rolePermissions.length} permissions assigned
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {rolePermissions.some(p => p.riskLevel === 'critical') && (
                                            <span className="flex items-center gap-1 text-xs text-red-400">
                                                <AlertTriangle size={12} />
                                                Critical permissions enabled
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
                        <Shield className="mx-auto text-gray-500 mb-4" size={48} />
                        <p className="text-gray-400">Select a role to view and edit permissions</p>
                        <p className="text-sm text-gray-500 mt-1">
                            Or create a new custom role
                        </p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderPermissions = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">Permission Definitions</h3>
                    <p className="text-sm text-gray-400">All available permissions in the system</p>
                </div>
                <div className="flex items-center gap-2">
                    {['low', 'medium', 'high', 'critical'].map(level => (
                        <span key={level} className={`px-2 py-1 text-xs rounded ${
                            level === 'critical' ? 'bg-red-500/20 text-red-300' :
                            level === 'high' ? 'bg-amber-500/20 text-amber-300' :
                            level === 'medium' ? 'bg-blue-500/20 text-blue-300' :
                            'bg-green-500/20 text-green-300'
                        }`}>
                            {level}
                        </span>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(category => (
                    <div key={category} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                        <h4 className="font-medium text-white mb-3">{category}</h4>
                        <div className="space-y-2">
                            {permissionsByCategory[category].map(perm => (
                                <div key={perm.id} className="flex items-center justify-between py-1">
                                    <span className="text-sm text-gray-300">{perm.displayName}</span>
                                    <span className={`w-2 h-2 rounded-full ${
                                        perm.riskLevel === 'critical' ? 'bg-red-400' :
                                        perm.riskLevel === 'high' ? 'bg-amber-400' :
                                        perm.riskLevel === 'medium' ? 'bg-blue-400' :
                                        'bg-green-400'
                                    }`} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderTemplates = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-white">Role Templates</h3>
                <p className="text-sm text-gray-400">Pre-configured roles for common use cases</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                    <div key={template.name} className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: `${template.color}20` }}
                                >
                                    <Shield style={{ color: template.color }} size={20} />
                                </div>
                                <div>
                                    <h4 className="font-medium text-white">{template.displayName}</h4>
                                    <p className="text-sm text-gray-400">{template.description}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-4">
                            {template.permissions.slice(0, 6).map(perm => (
                                <span key={perm} className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                                    {perm}
                                </span>
                            ))}
                            {template.permissions.length > 6 && (
                                <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                                    +{template.permissions.length - 6} more
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => handleCreateFromTemplate(template.name)}
                            className="w-full py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors text-sm"
                        >
                            Create Role from Template
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Custom Roles</h2>
                    <p className="text-gray-400 mt-1">Create and manage role-based access control</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-700">
                <div className="flex gap-6">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-violet-500 text-white'
                                        : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                            >
                                <Icon size={18} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="animate-spin text-violet-500" size={32} />
                </div>
            ) : (
                <>
                    {activeTab === 'roles' && renderRoles()}
                    {activeTab === 'permissions' && renderPermissions()}
                    {activeTab === 'templates' && renderTemplates()}
                </>
            )}

            {/* Create Role Modal */}
            {showRoleModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full">
                        <h3 className="text-lg font-semibold text-white mb-4">Create Custom Role</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Display Name *</label>
                                <input
                                    type="text"
                                    value={newRole.displayName}
                                    onChange={(e) => setNewRole({ 
                                        ...newRole, 
                                        displayName: e.target.value,
                                        name: e.target.value.toLowerCase().replace(/\s+/g, '_')
                                    })}
                                    placeholder="e.g., Project Lead"
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Description</label>
                                <input
                                    type="text"
                                    value={newRole.description}
                                    onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                                    placeholder="What can this role do?"
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Base Role (inherit permissions)</label>
                                <select
                                    value={newRole.baseRole}
                                    onChange={(e) => setNewRole({ ...newRole, baseRole: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                                >
                                    <option value="">None</option>
                                    <option value="viewer">Viewer</option>
                                    <option value="member">Member</option>
                                    <option value="project_manager">Project Manager</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {ROLE_COLORS.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setNewRole({ ...newRole, color })}
                                            className={`w-8 h-8 rounded-lg transition-all ${
                                                newRole.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800' : ''
                                            }`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={newRole.isDefault}
                                    onChange={(e) => setNewRole({ ...newRole, isDefault: e.target.checked })}
                                    className="rounded border-gray-600 bg-gray-900 text-violet-500"
                                />
                                <span className="text-sm text-gray-300">Set as default role for new users</span>
                            </label>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowRoleModal(false)}
                                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateRole}
                                disabled={!newRole.displayName}
                                className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                            >
                                Create Role
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomRolesBuilder;

