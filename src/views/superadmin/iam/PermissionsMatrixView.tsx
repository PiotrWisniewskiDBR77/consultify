/**
 * Permissions Matrix View
 *
 * Displays and manages granular permissions across roles.
 */

import {
  AlertTriangle,
  BarChart3,
  Check,
  Copy,
  Edit2,
  Key,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { Card, CardWithHeader } from '../../../components/Admin/shared/Card';
import { Api } from '../../../services/api';

interface Permission {
  key: string;
  description: string;
  category: string;
}

interface PermissionMatrix {
  categories: Record<string, Permission[]>;
  roles: (string | { name: string })[];
  matrix: Record<string, Record<string, boolean>>;
}

interface PermissionsStats {
  totalPermissions: number;
  systemPermissions: number;
  customPermissions: number;
  roleAssignments: Record<string, number>;
  categoryBreakdown: Record<string, number>;
}

const PermissionsMatrixView: React.FC = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [stats, setStats] = useState<PermissionsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [formData, setFormData] = useState({ key: '', description: '', category: 'general' });
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyFormData, setCopyFormData] = useState({ sourceRole: '', targetRole: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setError(null);
      const [permsData, matrixData, statsData] = await Promise.all([
        Api.getAdminPermissions(),
        Api.getPermissionsMatrix(),
        Api.getPermissionsStats(),
      ]);
      setPermissions(permsData);
      setMatrix(matrixData as any);
      setStats(statsData as any);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load permissions');
      setPermissions([]);
      setMatrix(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = async (
    role: string,
    permissionKey: string,
    currentValue: boolean
  ) => {
    const toggleKey = `${role}-${permissionKey}`;
    try {
      setToggling(toggleKey);
      await Api.toggleRolePermission(role, permissionKey, !currentValue);

      // Update local state
      setMatrix((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          matrix: {
            ...prev.matrix,
            [role]: {
              ...prev.matrix[role],
              [permissionKey]: !currentValue,
            },
          },
        };
      });

      toast.success(`Permission ${!currentValue ? 'granted' : 'revoked'} for ${role}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle permission');
    } finally {
      setToggling(null);
    }
  };

  const handleCopyPermissions = async () => {
    try {
      setSaving(true);
      await Api.copyRolePermissions(copyFormData.sourceRole, copyFormData.targetRole);
      await loadData();
      setShowCopyModal(false);
      setCopyFormData({ sourceRole: '', targetRole: '' });
      toast.success(
        `Permissions copied from ${copyFormData.sourceRole} to ${copyFormData.targetRole}`
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to copy permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    try {
      setSaving(true);
      await Api.createAdminPermission(formData);
      await loadData();
      setShowCreateModal(false);
      setFormData({ key: '', description: '', category: 'general' });
    } catch (err: any) {
      setError(err.message || 'Failed to create permission');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingPermission) return;
    try {
      setSaving(true);
      await Api.updateAdminPermission(editingPermission.key, {
        description: formData.description,
        category: formData.category,
      });
      await loadData();
      setEditingPermission(null);
      setFormData({ key: '', description: '', category: 'general' });
    } catch (err: any) {
      setError(err.message || 'Failed to update permission');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm('Are you sure you want to delete this permission?')) return;
    try {
      await Api.deleteAdminPermission(key);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete permission');
    }
  };

  const openEditModal = (permission: Permission) => {
    setEditingPermission(permission);
    setFormData({
      key: permission.key,
      description: permission.description,
      category: permission.category,
    });
  };

  const categories = ['general', 'users', 'organizations', 'billing', 'security', 'ai', 'content'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {loadError ? (
        <Card variant="bordered" className="p-6">
          <DegradedState title="Permissions unavailable" description={loadError} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Key className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Permissions</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {stats?.totalPermissions || permissions.length}
                </p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/10 rounded-lg">
                <Key className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">System Permissions</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {stats?.systemPermissions || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <BarChart3 className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Categories</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {Object.keys(stats?.categoryBreakdown || matrix?.categories || {}).length}
                </p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Key className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Roles</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {matrix?.roles?.length || 0}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Card variant="bordered" className="p-4 border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span>
              {typeof error === 'string' ? error : (error as any)?.message || 'An error occurred'}
            </span>
            <button onClick={() => setError(null)} className="ml-auto text-sm hover:text-red-300">
              Dismiss
            </button>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Permissions</h2>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCopyModal(true)}
            disabled={!!loadError}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy Permissions
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!!loadError}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Permission
          </button>
        </div>
      </div>

      {/* Permissions Matrix */}
      {loadError ? (
        <Card variant="bordered" className="p-6">
          <DegradedState title="Permissions matrix unavailable" description={loadError} />
        </Card>
      ) : (
        matrix &&
        matrix.categories &&
        Object.keys(matrix.categories).length > 0 && (
          <CardWithHeader title="Permissions Matrix" subtitle="Role-based permissions overview">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      Permission
                    </th>
                    {(matrix.roles || []).map((role) => {
                      const roleName = typeof role === 'string' ? role : role.name;
                      return (
                        <th
                          key={roleName}
                          className="text-center py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400"
                        >
                          <div>
                            <span>{roleName}</span>
                            {stats?.roleAssignments?.[roleName] !== undefined && (
                              <span className="block text-xs text-slate-500 dark:text-slate-400">
                                ({stats.roleAssignments[roleName]} perms)
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(matrix.categories || {}).map(([category, perms]) => (
                    <React.Fragment key={category}>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <td
                          colSpan={matrix.roles.length + 1}
                          className="py-2 px-4 text-sm font-medium text-indigo-700 dark:text-indigo-300 uppercase"
                        >
                          {category}
                        </td>
                      </tr>
                      {perms.map((perm) => (
                        <tr
                          key={perm.key}
                          className="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                        >
                          <td className="py-2 px-4">
                            <div>
                              <p className="text-sm font-mono">{perm.key}</p>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {perm.description}
                              </p>
                            </div>
                          </td>
                          {matrix.roles.map((role) => {
                            const roleName = typeof role === 'string' ? role : role.name;
                            const isEnabled = matrix.matrix[roleName]?.[perm.key];
                            const toggleKey = `${roleName}-${perm.key}`;
                            return (
                              <td key={toggleKey} className="text-center py-2 px-4">
                                <button
                                  onClick={() =>
                                    handleTogglePermission(roleName, perm.key, isEnabled)
                                  }
                                  disabled={toggling === toggleKey}
                                  className={`p-1 rounded-lg transition-all ${
                                    isEnabled
                                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30'
                                      : 'bg-slate-700/50 hover:bg-slate-700'
                                  }`}
                                  title={`${isEnabled ? 'Revoke' : 'Grant'} ${perm.key} for ${roleName}`}
                                >
                                  {toggling === toggleKey ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-slate-500 dark:text-slate-400 mx-auto" />
                                  ) : isEnabled ? (
                                    <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                                  ) : (
                                    <X className="w-4 h-4 text-slate-600 dark:text-slate-400 mx-auto" />
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </CardWithHeader>
        )
      )}

      {/* Permissions List */}
      <CardWithHeader
        title="All Permissions"
        subtitle={`${permissions.length} permissions defined`}
      >
        {loadError ? (
          <div className="p-6">
            <DegradedState title="Permission definitions unavailable" description={loadError} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    Key
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    Description
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    Category
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {permissions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-600 dark:text-slate-400">
                      No permissions defined
                    </td>
                  </tr>
                ) : (
                  permissions.map((perm) => (
                    <tr
                      key={perm.key}
                      className="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 px-2 py-1 rounded">
                          {perm.key}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-300">
                        {perm.description}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded text-xs">
                          {perm.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(perm)}
                            className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(perm.key)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardWithHeader>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingPermission) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card variant="elevated" className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingPermission ? 'Edit Permission' : 'Create Permission'}
            </h3>
            <div className="space-y-4">
              {!editingPermission && (
                <div>
                  <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                    Key
                  </label>
                  <input
                    type="text"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    placeholder="e.g., users:read"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Permission description"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingPermission(null);
                  setFormData({ key: '', description: '', category: 'general' });
                }}
                className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={editingPermission ? handleUpdate : handleCreate}
                disabled={saving || (!editingPermission && !formData.key)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 rounded-lg disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editingPermission ? 'Update' : 'Create'}
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Copy Permissions Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card variant="elevated" className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Copy Permissions Between Roles</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Copy all permissions from one role to another. This will replace the target role's
              permissions.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                  Source Role
                </label>
                <select
                  value={copyFormData.sourceRole}
                  onChange={(e) => setCopyFormData({ ...copyFormData, sourceRole: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select source role...</option>
                  {matrix?.roles?.map((role) => {
                    const roleName = typeof role === 'string' ? role : role.name;
                    return (
                      <option key={roleName} value={roleName}>
                        {roleName}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                  Target Role
                </label>
                <select
                  value={copyFormData.targetRole}
                  onChange={(e) => setCopyFormData({ ...copyFormData, targetRole: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select target role...</option>
                  {matrix?.roles?.map((role) => {
                    const roleName = typeof role === 'string' ? role : role.name;
                    return (
                      <option
                        key={roleName}
                        value={roleName}
                        disabled={roleName === copyFormData.sourceRole}
                      >
                        {roleName}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCopyModal(false);
                  setCopyFormData({ sourceRole: '', targetRole: '' });
                }}
                className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCopyPermissions}
                disabled={saving || !copyFormData.sourceRole || !copyFormData.targetRole}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-violet-500 hover:bg-violet-600 rounded-lg disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                Copy Permissions
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PermissionsMatrixView;
