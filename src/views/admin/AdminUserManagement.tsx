import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle,
  Crown,
  Edit,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserX,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import { useUserCan } from '../../hooks/useUserCan';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { User, UserRole } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { isSuperAdminRole } from '../../utils/roleGuards';

interface ExtendedUser extends User {
  isOwner?: boolean;
  licensePlanId?: string;
}

interface UsersResponse {
  users?: ExtendedUser[];
}

interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: string;
  licensePlanId: string;
}

interface UserPlan {
  id: string;
  name: string;
  price_monthly?: number;
  ai_budget?: number;
}

const normalizeUsers = (data: unknown): ExtendedUser[] => {
  if (Array.isArray(data)) return data as ExtendedUser[];
  if (Array.isArray((data as UsersResponse)?.users)) return (data as UsersResponse).users || [];
  return [];
};

const userMatchesForm = (user: ExtendedUser, formData: UserFormData) =>
  user.firstName === formData.firstName &&
  user.lastName === formData.lastName &&
  user.email === formData.email &&
  user.role === formData.role &&
  user.status === formData.status;

interface AdminUserManagementProps {
  initialUsers?: User[];
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ initialUsers }) => {
  const { canDelete, canEdit } = useUserCan();
  const { currentUser } = useAppStore();
  const [users, setUsers] = useState<ExtendedUser[]>(initialUsers || []);
  const [userPlans, setUserPlans] = useState<UserPlan[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filter States
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal States
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<ExtendedUser | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string>('');
  const [transferReason, setTransferReason] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: UserRole.OTHER,
    status: 'active',
    licensePlanId: '',
  });

  // Check if current user is the owner
  const currentUserIsOwner = users.find((u) => u.id === currentUser?.id)?.isOwner || false;

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await Api.getUsers();
      const nextUsers = normalizeUsers(data);
      setUsers(nextUsers);
      return nextUsers;
    } catch (e) {
      setUsers([]);
      const message = normalizeApiErrorMessage(e, 'Failed to load users');
      setLoadError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync state with props when parent finishes loading
  useEffect(() => {
    if (initialUsers && initialUsers.length > 0) {
      setUsers(initialUsers);
    }
  }, [initialUsers]);

  useEffect(() => {
    const init = async () => {
      // Only load if not provided by parent or parent provided empty array
      if (!initialUsers || initialUsers.length === 0) {
        await loadUsers();
      }
      try {
        const plans = await Api.getUserPlans();
        setUserPlans(Array.isArray(plans) ? plans : []);
      } catch {
        setUserPlans([]);
      }
    };
    init();
  }, [initialUsers, loadUsers]);

  const handleDeleteUser = async (user: ExtendedUser) => {
    // Block deletion of Owner
    if (user.isOwner || user.role === 'OWNER') {
      toast.error('Cannot delete Account Owner. Transfer ownership first.');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${user.firstName} ${user.lastName}?`)) return;

    try {
      setActionError(null);
      await Api.deleteUser(user.id);
      const refreshedUsers = await loadUsers();
      if (!refreshedUsers || refreshedUsers.some((nextUser) => nextUser.id === user.id)) {
        throw new Error('User deletion was not confirmed by the server');
      }
      toast.success('User deleted');
    } catch (e: unknown) {
      if (
        typeof e === 'object' &&
        e !== null &&
        (e as { code?: string }).code === 'OWNER_PROTECTED'
      ) {
        toast.error('Cannot delete Account Owner. Transfer ownership first.');
      } else {
        const message = normalizeApiErrorMessage(e, 'Failed to delete user');
        setActionError(message);
        toast.error(message);
      }
    }
  };

  const handleDeactivateUser = async (user: ExtendedUser) => {
    if (user.isOwner || user.role === 'OWNER') {
      toast.error('Cannot deactivate Account Owner. Transfer ownership first.');
      return;
    }

    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'inactive' ? 'Deactivate' : 'Reactivate';

    if (
      !confirm(
        `Are you sure you want to ${action.toLowerCase()} ${user.firstName} ${user.lastName}?`
      )
    )
      return;

    try {
      setActionError(null);
      await Api.updateUser(user.id, { status: newStatus as User['status'] });
      const refreshedUsers = await loadUsers();
      if (
        !refreshedUsers ||
        refreshedUsers.find((nextUser) => nextUser.id === user.id)?.status !== newStatus
      ) {
        throw new Error('User status update was not confirmed by the server');
      }
      toast.success(`User status updated to ${newStatus}`);
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Failed to update user status');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleTransferOwnership = async () => {
    if (!transferTarget) {
      toast.error('Please select a new owner');
      return;
    }

    setTransferring(true);
    try {
      setActionError(null);
      const response = await fetch('/api/organizations/transfer-ownership', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          newOwnerId: transferTarget,
          reason: transferReason || 'Ownership transfer',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transfer failed');
      }

      const refreshedUsers = await loadUsers();
      if (!refreshedUsers?.some((user) => user.id === transferTarget && user.isOwner)) {
        throw new Error('Ownership transfer was not confirmed by the server');
      }
      toast.success(
        `Ownership transferred to ${data.newOwner.firstName} ${data.newOwner.lastName}`
      );
      setShowTransferModal(false);
      setTransferTarget('');
      setTransferReason('');
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Failed to transfer ownership');
      setActionError(message);
      toast.error(message);
    } finally {
      setTransferring(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFormError(null);
      if (editingUser) {
        await Api.updateUser(editingUser.id, formData);
        const refreshedUsers = await loadUsers();
        const persistedUser = refreshedUsers?.find((user) => user.id === editingUser.id);
        if (!persistedUser || !userMatchesForm(persistedUser, formData)) {
          throw new Error('User update was not confirmed by the server');
        }
        toast.success('User updated');
      } else {
        await Api.addUser({ ...formData, password: 'welcome123' });
        const refreshedUsers = await loadUsers();
        if (!refreshedUsers?.some((user) => user.email === formData.email)) {
          throw new Error('User creation was not confirmed by the server');
        }
        toast.success('User created');
      }
      setShowAddUserModal(false);
      setEditingUser(null);
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Error saving user');
      setFormError(message);
      toast.error(message);
    }
  };

  const openEditModal = (user: ExtendedUser) => {
    setEditingUser(user);
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: (user.role as UserRole) || UserRole.OTHER,
      status: user.status || 'active',
      licensePlanId: user.licensePlanId || '',
    });
    setShowAddUserModal(true);
  };

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      role: UserRole.OTHER,
      status: 'active',
      licensePlanId: '',
    });
    setShowAddUserModal(true);
  };

  const filteredUsers = users.filter((u) => {
    // Search filter
    const matchesSearch =
      searchTerm === '' ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.firstName || '').toLowerCase().includes(searchTerm.toLowerCase());

    // Role filter
    const matchesRole =
      roleFilter === 'all' || u.role === roleFilter || (roleFilter === 'OWNER' && u.isOwner);

    // Status filter
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Get eligible users for ownership transfer (Admins only)
  const eligibleOwnerCandidates = users.filter(
    (u) => u.role === 'ADMIN' && !u.isOwner && u.id !== currentUser?.id
  );

  const getRoleBadgeColor = (role?: string, isOwner?: boolean) => {
    // Light mode compatible - visible badges with backgrounds
    if (isOwner || role === 'OWNER')
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
    if (isSuperAdminRole(role))
      return 'bg-primary-500/10 text-primary-700 dark:text-primary-400 border-primary-500/30';
    if (role === UserRole.ADMIN)
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
    if (role === 'PROJECT_MANAGER')
      return 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30';
    if (role === 'MANAGER')
      return 'bg-slate-500/10 text-c-text-secondary border-slate-500/30';
    return 'bg-c-surface-raised dark:bg-c-surface/5 text-c-text-secondary border-c-border';
  };

  return (
    <div className="space-y-4 relative">
      <InfoButton cardId="admin-users" position="top-right" />

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-muted"
              size={18}
            />
            <input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={!!loadError}
              className="pl-10 pr-4 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-navy-900 dark:text-white focus:border-primary-500 outline-none w-64"
            />
          </div>

          {/* Account Type Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            disabled={!!loadError}
            className="px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-navy-900 dark:text-white text-sm focus:border-primary-500 outline-none"
          >
            <option value="all">All Account Types</option>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="USER">User</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            disabled={!!loadError}
            className="px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-navy-900 dark:text-white text-sm focus:border-primary-500 outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          {currentUserIsOwner && (
            <button
              onClick={() => setShowTransferModal(true)}
              disabled={!!loadError}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 rounded-lg transition-colors text-sm font-medium"
            >
              <ArrowRightLeft size={16} /> Transfer Ownership
            </button>
          )}
          <button
            onClick={openAddModal}
            disabled={!!loadError}
            className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors text-sm font-medium shadow-lg shadow-primary-900/20"
          >
            <Plus size={16} /> Add User
          </button>
        </div>
      </div>

      {/* Users Table - Clean minimal */}
      <div className="admin-card overflow-hidden">
        {actionError && (
          <div
            role="alert"
            className="m-4 p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm"
          >
            {actionError}
          </div>
        )}
        <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */  className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Account Type</th>
              <th>License</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary-500 mx-auto" />
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={5} className="px-6 py-6">
                  <DegradedState title="Users unavailable" description={loadError} />
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-c-text-muted"
                >
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-c-bg dark:hover:bg-c-surface/5 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-medium">
                          {user.firstName?.[0] || '?'}
                        </div>
                        {/* Owner Crown Badge */}
                        {(user.isOwner || user.role === 'OWNER') && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                            <Crown size={12} className="text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-navy-900 dark:text-white font-medium flex items-center gap-2">
                          {user.firstName} {user.lastName}
                          {(user.isOwner || user.role === 'OWNER') && (
                            <span className="text-xs text-amber-400 font-normal">(Owner)</span>
                          )}
                        </div>
                        <div className="text-xs">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs border ${getRoleBadgeColor(user.role, user.isOwner)}`}
                    >
                      {user.isOwner ? 'Owner' : user.role || 'USER'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-navy-900 dark:text-white text-sm">
                        {userPlans.find((p) => p.id === user.licensePlanId)?.name || 'Standard'}
                      </span>
                      {user.licensePlanId && userPlans.find((p) => p.id === user.licensePlanId) && (
                        <span className="text-[10px] text-c-text-muted">
                          ${userPlans.find((p) => p.id === user.licensePlanId)?.price_monthly}
                          /mo • Budget: $
                          {userPlans.find((p) => p.id === user.licensePlanId)?.ai_budget || 0}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        user.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : user.status === 'suspended'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                            : 'bg-slate-500/10 text-c-text-secondary border-slate-500/30'
                      }`}
                    >
                      {user.status === 'active' ? (
                        <CheckCircle size={12} />
                      ) : (
                        <AlertCircle size={12} />
                      )}
                      {user.status === 'active'
                        ? 'Active'
                        : user.status === 'suspended'
                          ? 'Suspended'
                          : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {canEdit && (
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-2 hover:bg-c-surface-raised/40 rounded-lg text-c-text-muted hover:text-white"
                          title="Edit user"
                        >
                          <Edit size={16} />
                        </button>
                      )}

                      {/* Deactivate Button */}
                      {canEdit && !(user.isOwner || user.role === 'OWNER') && (
                        <button
                          onClick={() => handleDeactivateUser(user)}
                          className={`p-2 rounded-lg ${
                            user.status === 'active'
                              ? 'hover:bg-yellow-500/20 text-c-text-muted hover:text-yellow-400'
                              : 'hover:bg-green-500/20 text-c-text-muted hover:text-green-400'
                          }`}
                          title={user.status === 'active' ? 'Deactivate user' : 'Reactivate user'}
                        >
                          <UserX size={16} />
                        </button>
                      )}

                      {/* Delete Button - disabled for Owner */}
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteUser(user)}
                          disabled={user.isOwner || user.role === 'OWNER'}
                          className={`p-2 rounded-lg ${
                            user.isOwner || user.role === 'OWNER'
                              ? 'text-c-text-secondary cursor-not-allowed'
                              : 'hover:bg-danger-500/20 text-c-text-muted hover:text-danger-400'
                          }`}
                          title={
                            user.isOwner || user.role === 'OWNER'
                              ? 'Cannot delete Account Owner. Transfer ownership first.'
                              : 'Delete user'
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      )}

                      {/* Protected indicator for Owner */}
                      {(user.isOwner || user.role === 'OWNER') && (
                        <div className="p-2 text-amber-400" title="Protected: Account Owner">
                          <Shield size={16} />
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-c-surface border border-c-border-subtle rounded-xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-navy-900 dark:text-white">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-c-text-muted hover:text-navy-900 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Warning for editing Owner */}
            {editingUser?.isOwner && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-amber-400 text-sm">
                <Shield size={16} />
                <span>
                  This user is the Account Owner. Account Type and status cannot be changed.
                </span>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm"
                >
                  {formError}
                </div>
              )}
              <input
                required
                placeholder="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full bg-c-surface-raised border border-c-border-subtle rounded p-2 text-navy-900 dark:text-white"
              />
              <input
                required
                placeholder="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full bg-c-surface-raised border border-c-border-subtle rounded p-2 text-navy-900 dark:text-white"
              />
              <input
                required
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-c-surface-raised border border-c-border-subtle rounded p-2 text-navy-900 dark:text-white"
              />
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full bg-c-surface-raised border border-c-border-subtle rounded p-2 text-navy-900 dark:text-white"
                disabled={editingUser?.isOwner}
              >
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-c-surface-raised border border-c-border-subtle rounded p-2 text-navy-900 dark:text-white"
                disabled={editingUser?.isOwner}
              >
                <option value="active">Status: Active</option>
                <option value="inactive">Status: Inactive</option>
                <option value="suspended">Status: Suspended</option>
              </select>
              <select
                value={formData.licensePlanId}
                onChange={(e) => setFormData({ ...formData, licensePlanId: e.target.value })}
                className="w-full bg-c-surface-raised border border-c-border-subtle rounded p-2 text-navy-900 dark:text-white"
              >
                <option value="">Select License (Budget)...</option>
                {userPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} - ${p.price_monthly}/mo (Budget: ${p.ai_budget || 0})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="w-full py-3 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-semibold mt-4"
              >
                Save
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-c-surface border border-c-border-subtle rounded-xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
                <Crown className="text-amber-400" size={24} />
                Transfer Ownership
              </h2>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-c-text-muted hover:text-navy-900 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-amber-400 text-sm">
                <strong>Warning:</strong> Transferring ownership will give another user full control
                over this organization, including billing and the ability to delete the
                organization. This action cannot be undone by you.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select New Owner
                </label>
                <select
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  className="w-full bg-c-surface-raised border border-c-border-subtle rounded p-3 text-navy-900 dark:text-white"
                >
                  <option value="">Select an Admin...</option>
                  {eligibleOwnerCandidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.email})
                    </option>
                  ))}
                </select>
                {eligibleOwnerCandidates.length === 0 && (
                  <p className="mt-2 text-xs text-c-text-muted">
                    No eligible candidates. The new owner must be an Admin.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Reason (optional)
                </label>
                <textarea
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="e.g., Leaving the company, Account Type change..."
                  className="w-full bg-c-surface-raised border border-c-border-subtle rounded p-3 text-navy-900 dark:text-white h-24 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransferOwnership}
                  disabled={!transferTarget || transferring}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 disabled:cursor-not-allowed text-white rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                  {transferring ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Transferring...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft size={16} />
                      Transfer Ownership
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagement;
