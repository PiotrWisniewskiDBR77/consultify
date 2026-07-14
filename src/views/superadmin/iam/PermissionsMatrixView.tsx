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
import { LoadingState } from '../../../components/ui/primitives';
import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { Card, CardWithHeader } from '../components/shared/Card';

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

interface PermissionsSnapshot {
  permissions: Permission[];
  matrix: PermissionMatrix;
  stats: PermissionsStats;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const groupPermissionsByCategory = (permissions: Permission[]) =>
  permissions.reduce<Record<string, Permission[]>>((acc, permission) => {
    const category = permission.category || 'general';
    acc[category] = [...(acc[category] || []), permission];
    return acc;
  }, {});

const getListPayload = <T,>(value: unknown, keys: string[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const candidates = [value, data, nestedData].filter(isRecord);
  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as T[];
    }
  }
  return [];
};

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const normalizePermissions = (value: unknown): Permission[] => {
  const list = getListPayload<Permission>(value, ['permissions', 'items']);
  const data = isRecord(value) && isRecord(value.data) ? value.data : null;
  const hasListShape =
    Array.isArray(value) ||
    (isRecord(value) &&
      ('data' in value ||
        'permissions' in value ||
        'items' in value ||
        (data && ('permissions' in data || 'items' in data))));
  if (!hasListShape) {
    throw new Error('Permissions response was not a list');
  }
  return list.filter(
    (permission): permission is Permission =>
      isRecord(permission) &&
      typeof permission.key === 'string' &&
      typeof permission.description === 'string' &&
      typeof permission.category === 'string'
  );
};

const normalizeMatrix = (value: unknown, permissions: Permission[]): PermissionMatrix => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload)) {
    throw new Error('Permissions matrix response was not an object');
  }
  return {
    categories: isRecord(payload.categories)
      ? (payload.categories as Record<string, Permission[]>)
      : groupPermissionsByCategory(permissions),
    roles: Array.isArray(payload.roles) ? (payload.roles as PermissionMatrix['roles']) : [],
    matrix: isRecord(payload.matrix)
      ? (payload.matrix as Record<string, Record<string, boolean>>)
      : {},
  };
};

const getRoleName = (role: string | { name: string }) =>
  typeof role === 'string' ? role : role.name;

const rolePermissionsMatch = (
  snapshot: PermissionsSnapshot,
  sourceRole: string,
  targetRole: string
) =>
  snapshot.permissions.every(
    (permission) =>
      Boolean(snapshot.matrix.matrix[sourceRole]?.[permission.key]) ===
      Boolean(snapshot.matrix.matrix[targetRole]?.[permission.key])
  );

const normalizeStats = (value: unknown, permissions: Permission[]): PermissionsStats => {
  const payload = getObjectPayload(value);
  if (isRecord(payload) && 'totalPermissions' in payload) {
    return {
      totalPermissions:
        typeof payload.totalPermissions === 'number'
          ? payload.totalPermissions
          : permissions.length,
      systemPermissions:
        typeof payload.systemPermissions === 'number' ? payload.systemPermissions : 0,
      customPermissions:
        typeof payload.customPermissions === 'number' ? payload.customPermissions : 0,
      roleAssignments: isRecord(payload.roleAssignments)
        ? (payload.roleAssignments as Record<string, number>)
        : {},
      categoryBreakdown: isRecord(payload.categoryBreakdown)
        ? (payload.categoryBreakdown as Record<string, number>)
        : {},
    };
  }
  const categoryBreakdown = permissions.reduce<Record<string, number>>((acc, permission) => {
    acc[permission.category] = (acc[permission.category] || 0) + 1;
    return acc;
  }, {});
  return {
    totalPermissions: permissions.length,
    systemPermissions: 0,
    customPermissions: permissions.length,
    roleAssignments: {},
    categoryBreakdown,
  };
};

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

  const loadData = async (): Promise<PermissionsSnapshot | null> => {
    try {
      setLoading(true);
      setLoadError(null);
      setError(null);
      const [permsData, matrixData, statsData] = await Promise.all([
        Api.getAdminPermissions(),
        Api.getPermissionsMatrix(),
        Api.getPermissionsStats(),
      ]);
      const permissions = normalizePermissions(permsData);
      const snapshot = {
        permissions,
        matrix: normalizeMatrix(matrixData, permissions),
        stats: normalizeStats(statsData, permissions),
      };
      setPermissions(snapshot.permissions);
      setMatrix(snapshot.matrix);
      setStats(snapshot.stats);
      return snapshot;
    } catch (err: unknown) {
      setLoadError(normalizeApiErrorMessage(err, 'Failed to load permissions'));
      setPermissions([]);
      setMatrix(null);
      setStats(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const findPermission = (snapshot: PermissionsSnapshot, permissionKey: string) =>
    snapshot.permissions.find((permission) => permission.key === permissionKey);

  const hasPermissionState = (
    snapshot: PermissionsSnapshot,
    role: string,
    permissionKey: string,
    expectedValue: boolean
  ) => snapshot.matrix?.matrix?.[role]?.[permissionKey] === expectedValue;

  const handleTogglePermission = async (
    role: string,
    permissionKey: string,
    currentValue: boolean
  ) => {
    const toggleKey = `${role}-${permissionKey}`;
    const expectedValue = !currentValue;
    try {
      setToggling(toggleKey);
      setError(null);
      const result = await Api.toggleRolePermission(role, permissionKey, expectedValue);
      if (result?.success === false) {
        throw new Error('Permission toggle was rejected by the server');
      }
      const refreshed = await loadData();
      if (!refreshed || !hasPermissionState(refreshed, role, permissionKey, expectedValue)) {
        throw new Error('Permission toggle was not confirmed by the server');
      }

      toast.success(`Permission ${expectedValue ? 'granted' : 'revoked'} for ${role}`);
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to toggle permission');
      setError(message);
      toast.error(message);
    } finally {
      setToggling(null);
    }
  };

  const handleCopyPermissions = async () => {
    try {
      setSaving(true);
      setError(null);
      await Api.copyRolePermissions(copyFormData.sourceRole, copyFormData.targetRole);
      const refreshed = await loadData();
      if (
        !refreshed ||
        !rolePermissionsMatch(refreshed, copyFormData.sourceRole, copyFormData.targetRole)
      ) {
        throw new Error('Permission copy was not confirmed by the server');
      }
      setShowCopyModal(false);
      setCopyFormData({ sourceRole: '', targetRole: '' });
      toast.success(
        `Permissions copied from ${copyFormData.sourceRole} to ${copyFormData.targetRole}`
      );
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to copy permissions');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    try {
      setSaving(true);
      await Api.createAdminPermission(formData);
      const refreshed = await loadData();
      if (!refreshed || !findPermission(refreshed, formData.key)) {
        throw new Error('Permission creation was not confirmed by the server');
      }
      setShowCreateModal(false);
      setFormData({ key: '', description: '', category: 'general' });
    } catch (err: unknown) {
      setError(normalizeApiErrorMessage(err, 'Failed to create permission'));
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
      const refreshed = await loadData();
      const refreshedPermission = refreshed && findPermission(refreshed, editingPermission.key);
      if (
        !refreshedPermission ||
        refreshedPermission.description !== formData.description ||
        refreshedPermission.category !== formData.category
      ) {
        throw new Error('Permission update was not confirmed by the server');
      }
      setEditingPermission(null);
      setFormData({ key: '', description: '', category: 'general' });
    } catch (err: unknown) {
      setError(normalizeApiErrorMessage(err, 'Failed to update permission'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm('Are you sure you want to delete this permission?')) return;
    try {
      await Api.deleteAdminPermission(key);
      const refreshed = await loadData();
      if (!refreshed || findPermission(refreshed, key)) {
        throw new Error('Permission deletion was not confirmed by the server');
      }
    } catch (err: unknown) {
      setError(normalizeApiErrorMessage(err, 'Failed to delete permission'));
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
    return <LoadingState variant="spinner" className="h-64" />;
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
              <div className="p-2 bg-primary-500/10 rounded-lg">
                <Key className="w-5 h-5 text-primary-500" />
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
        <Card variant="bordered" className="p-4 border-danger-500/30 bg-danger-500/5">
          <div role="alert" className="flex items-center gap-2 text-danger-400">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-sm hover:text-danger-300"
            >
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
            className="flex items-center gap-2 px-3 py-2 text-sm bg-c-surface-raised hover:bg-slate-600 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCopyModal(true)}
            disabled={!!loadError}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
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
              <table
                /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full"
              >
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      Permission
                    </th>
                    {(matrix.roles || []).map((role) => {
                      const roleName = getRoleName(role);
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
                            const roleName = getRoleName(role);
                            const isEnabled = matrix.matrix[roleName]?.[perm.key];
                            const toggleKey = `${roleName}-${perm.key}`;
                            return (
                              <td key={toggleKey} className="text-center py-2 px-4">
                                <button
                                  onClick={() =>
                                    handleTogglePermission(roleName, perm.key, isEnabled)
                                  }
                                  disabled={toggling === toggleKey}
                                  aria-label={`${isEnabled ? 'Revoke' : 'Grant'} ${perm.key} for ${roleName}`}
                                  className={`p-1 rounded-lg transition-all ${
                                    isEnabled
                                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30'
                                      : 'bg-c-surface-raised/50 hover:bg-c-surface-raised'
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
                            aria-label={`Edit permission ${perm.key}`}
                            className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(perm.key)}
                            aria-label={`Delete permission ${perm.key}`}
                            className="p-2 text-danger-400 hover:bg-danger-500/10 rounded-lg transition-colors"
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
                className="px-4 py-2 text-sm bg-c-surface-raised hover:bg-slate-600 rounded-lg"
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
                    const roleName = getRoleName(role);
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
                    const roleName = getRoleName(role);
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
                className="px-4 py-2 text-sm bg-c-surface-raised hover:bg-slate-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCopyPermissions}
                disabled={saving || !copyFormData.sourceRole || !copyFormData.targetRole}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-500 hover:bg-primary-600 rounded-lg disabled:opacity-50"
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
