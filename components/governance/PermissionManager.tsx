import React, { useState, useEffect } from 'react';
import {
    Shield, Users, Key, Check, X,
    ChevronDown, ChevronRight, Search, Save
} from 'lucide-react';

interface Permission {
    key: string;
    description: string;
    category: string;
}

interface UserPermissions {
    userId: string;
    role: string;
    rolePermissions: string[];
    overrides: {
        granted: string[];
        revoked: string[];
    };
    effective: string[];
}

interface PermissionManagerProps {
    userId?: string;
    organizationId?: string;
    onSave?: () => void;
}

export const PermissionManager: React.FC<PermissionManagerProps> = ({
    userId,
    organizationId,
    onSave
}) => {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['POLICY', 'PLAYBOOK', 'GOVERNANCE']));
    const [pendingChanges, setPendingChanges] = useState<Map<string, 'grant' | 'revoke' | 'reset'>>(new Map());

    useEffect(() => {
        fetchPermissions();
        if (userId) {
            fetchUserPermissions();
        }
    }, [userId]);

    const fetchPermissions = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/governance/permissions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch permissions');
            const data = await response.json();
            setPermissions(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load permissions');
        }
    };

    const fetchUserPermissions = async () => {
        if (!userId) return;

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/governance/users/${userId}/permissions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch user permissions');
            const data = await response.json();
            setUserPermissions(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load user permissions');
        } finally {
            setLoading(false);
        }
    };

    const toggleCategory = (category: string) => {
        const updated = new Set(expandedCategories);
        if (updated.has(category)) {
            updated.delete(category);
        } else {
            updated.add(category);
        }
        setExpandedCategories(updated);
    };

    const getPermissionStatus = (key: string): 'granted' | 'revoked' | 'default' => {
        if (!userPermissions) return 'default';

        const pending = pendingChanges.get(key);
        if (pending === 'grant') return 'granted';
        if (pending === 'revoke') return 'revoked';
        if (pending === 'reset') return userPermissions.rolePermissions.includes(key) ? 'granted' : 'revoked';

        if (userPermissions.overrides.granted.includes(key)) return 'granted';
        if (userPermissions.overrides.revoked.includes(key)) return 'revoked';
        return userPermissions.rolePermissions.includes(key) ? 'granted' : 'revoked';
    };

    const hasOverride = (key: string): boolean => {
        if (!userPermissions) return false;
        return userPermissions.overrides.granted.includes(key) ||
            userPermissions.overrides.revoked.includes(key) ||
            pendingChanges.has(key);
    };

    const cyclePermission = (key: string) => {
        const current = getPermissionStatus(key);
        const isRoleDefault = userPermissions?.rolePermissions.includes(key);

        let next: 'grant' | 'revoke' | 'reset';
        if (current === 'granted') {
            next = 'revoke';
        } else if (current === 'revoked') {
            next = isRoleDefault ? 'reset' : 'grant';
        } else {
            next = isRoleDefault ? 'revoke' : 'grant';
        }

        const updated = new Map(pendingChanges);
        if (next === 'reset' && !hasOverride(key)) {
            updated.delete(key);
        } else {
            updated.set(key, next);
        }
        setPendingChanges(updated);
    };

    const saveChanges = async () => {
        if (!userId || pendingChanges.size === 0) return;

        setSaving(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');

            for (const [permissionKey, action] of pendingChanges.entries()) {
                await fetch(`/api/governance/users/${userId}/permissions`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ permissionKey, action })
                });
            }

            setPendingChanges(new Map());
            await fetchUserPermissions();
            onSave?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    const groupedPermissions = permissions.reduce((acc, perm) => {
        if (!acc[perm.category]) acc[perm.category] = [];
        acc[perm.category].push(perm);
        return acc;
    }, {} as Record<string, Permission[]>);

    const filteredCategories = Object.entries(groupedPermissions).filter(([category, perms]) => {
        if (!searchTerm) return true;
        return perms.some(p =>
            p.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
    });

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-purple-500" />
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Permission Manager
                        </h2>
                        {userPermissions && (
                            <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded">
                                {userPermissions.role}
                            </span>
                        )}
                    </div>

                    {pendingChanges.size > 0 && (
                        <button
                            onClick={saveChanges}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            Save {pendingChanges.size} Change{pendingChanges.size > 1 ? 's' : ''}
                        </button>
                    )}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search permissions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Permissions List */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCategories.map(([category, categoryPerms]) => (
                    <div key={category}>
                        <button
                            onClick={() => toggleCategory(category)}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                        >
                            <div className="flex items-center gap-2">
                                {expandedCategories.has(category) ? (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                )}
                                <Key className="w-4 h-4 text-gray-500" />
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {category}
                                </span>
                                <span className="text-sm text-gray-500">
                                    ({categoryPerms.length})
                                </span>
                            </div>

                            {userPermissions && (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <span className="text-green-600">
                                        {categoryPerms.filter(p => getPermissionStatus(p.key) === 'granted').length} granted
                                    </span>
                                </div>
                            )}
                        </button>

                        {expandedCategories.has(category) && (
                            <div className="bg-gray-50 dark:bg-gray-700/20">
                                {categoryPerms
                                    .filter(p => !searchTerm ||
                                        p.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        p.description.toLowerCase().includes(searchTerm.toLowerCase())
                                    )
                                    .map((perm) => {
                                        const status = getPermissionStatus(perm.key);
                                        const override = hasOverride(perm.key);

                                        return (
                                            <div
                                                key={perm.key}
                                                className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700"
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <code className="text-sm font-mono text-gray-600 dark:text-gray-300">
                                                            {perm.key}
                                                        </code>
                                                        {override && (
                                                            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                                                                override
                                                            </span>
                                                        )}
                                                        {pendingChanges.has(perm.key) && (
                                                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                                                pending
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-500 mt-0.5">
                                                        {perm.description}
                                                    </p>
                                                </div>

                                                {userId && (
                                                    <button
                                                        onClick={() => cyclePermission(perm.key)}
                                                        className={`p-2 rounded-lg transition-colors ${status === 'granted'
                                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 hover:bg-green-200'
                                                                : 'bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200'
                                                            }`}
                                                        title={status === 'granted' ? 'Click to revoke' : 'Click to grant'}
                                                    >
                                                        {status === 'granted' ? (
                                                            <Check className="w-4 h-4" />
                                                        ) : (
                                                            <X className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                <div className="flex items-center gap-6 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-100 dark:bg-green-900/30 rounded flex items-center justify-center">
                            <Check className="w-3 h-3 text-green-600" />
                        </div>
                        <span>Granted</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center">
                            <X className="w-3 h-3 text-red-600" />
                        </div>
                        <span>Revoked</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">override</span>
                        <span>User-specific</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PermissionManager;
