import {
  AlertCircle,
  CheckCircle,
  Edit,
  GitBranch,
  Lock,
  Plus,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { User, UserRole } from '../../types';
import { UserAssignmentsPanel } from '../Admin/UserAssignmentsPanel';

export interface UserManagementCoreProps {
  mode: 'org-admin' | 'platform';
  organizationId?: string;
  organizations?: Array<{ id: string; name: string; status: string }>;
  showInvite?: boolean;
  showMove?: boolean;
  showImpersonate?: boolean;
  showBlock?: boolean;
  showRoleManagement?: boolean;
  showLicenseManagement?: boolean;
  className?: string;
}

interface ManagedUser extends User {
  organizationName?: string;
}

// User Table Row Component
export const UserTableRow: React.FC<{
  user: ManagedUser;
  userPlans: any[];
  onEdit?: (user: ManagedUser) => void;
  onDelete?: (userId: string) => void;
  onMove?: (user: ManagedUser) => void;
  onBlock?: (userId: string, currentStatus: string) => void;
  onImpersonate?: (userId: string) => void;
  onResetPassword?: (userId: string) => void;
  onAssignments?: (user: ManagedUser) => void;
  showMove?: boolean;
  showImpersonate?: boolean;
  showBlock?: boolean;
  showAssignments?: boolean;
  mode: 'org-admin' | 'platform';
}> = ({
  user,
  userPlans,
  onEdit,
  onDelete,
  onMove,
  onBlock,
  onImpersonate,
  onResetPassword,
  onAssignments,
  showMove,
  showImpersonate,
  showBlock,
  showAssignments,
  mode,
}) => {
  const getRoleBadgeColor = (role?: string) => {
    if (role === 'SUPERADMIN') return 'bg-red-500/20 text-red-400';
    if (role === UserRole.ADMIN) return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
  };

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-medium">
            {user.firstName?.[0] || '?'}
          </div>
          <div>
            <div className="text-slate-900 dark:text-white font-medium">
              {user.firstName} {user.lastName}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500">{user.email}</div>
          </div>
        </div>
      </td>
      {mode === 'platform' && (
        <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
          {user.organizationName || (
            <span className="text-slate-600 dark:text-slate-400 italic">None</span>
          )}
        </td>
      )}
      <td className="px-6 py-4">
        <span className={`px-2 py-1 rounded-full text-xs border ${getRoleBadgeColor(user.role)}`}>
          {user.role || 'USER'}
        </span>
      </td>
      <td className="px-6 py-4">
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {userPlans.find((p) => p.id === user.licensePlanId)?.name || 'Standard'}
        </span>
      </td>
      <td className="px-6 py-4">
        <span
          className={`flex items-center gap-1.5 ${user.status === 'active' ? 'text-green-400' : 'text-red-400'}`}
        >
          {user.status === 'active' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {user.status || 'active'}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {onResetPassword && (
            <button
              onClick={() => onResetPassword(user.id)}
              className="p-2 hover:bg-yellow-500/20 rounded-lg text-slate-400 dark:text-slate-500 hover:text-yellow-400"
              title="Reset Password"
            >
              <Lock size={16} />
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(user)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white"
              title="Edit"
            >
              <Edit size={16} />
            </button>
          )}
          {showAssignments && onAssignments && (
            <button
              onClick={() => onAssignments(user)}
              className="p-2 hover:bg-green-500/20 rounded-lg text-slate-400 dark:text-slate-500 hover:text-green-400"
              title="Manage Assignments"
            >
              <GitBranch size={16} />
            </button>
          )}
          {showMove && onMove && (
            <button
              onClick={() => onMove(user)}
              className="p-2 hover:bg-blue-500/20 rounded-lg text-slate-400 dark:text-slate-500 hover:text-blue-400 text-xs font-medium"
              title="Move to Organization"
            >
              Move
            </button>
          )}
          {showImpersonate && onImpersonate && user.role !== 'SUPERADMIN' && (
            <button
              onClick={() => onImpersonate(user.id)}
              className="p-2 hover:bg-purple-500/20 rounded-lg text-slate-400 dark:text-slate-500 hover:text-purple-400 text-xs font-medium"
              title="Impersonate"
            >
              Impersonate
            </button>
          )}
          {showBlock && onBlock && user.role !== 'SUPERADMIN' && (
            <button
              onClick={() => onBlock(user.id, user.status || 'active')}
              className={`p-2 rounded-lg text-xs font-medium ${
                user.status === 'active'
                  ? 'hover:bg-red-500/20 text-slate-400 dark:text-slate-500 hover:text-red-400'
                  : 'hover:bg-green-500/20 text-red-400 hover:text-green-400'
              }`}
              title={user.status === 'active' ? 'Block' : 'Unblock'}
            >
              {user.status === 'active' ? 'Block' : 'Unblock'}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(user.id)}
              className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-400"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

// Add/Edit User Modal Component
export const UserFormModal: React.FC<{
  isOpen: boolean;
  editingUser: ManagedUser | null;
  userPlans: any[];
  onClose: () => void;
  onSave: (formData: any) => void;
}> = ({ isOpen, editingUser, userPlans, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: UserRole.OTHER,
    status: 'active',
    licensePlanId: '',
  });

  useEffect(() => {
    if (editingUser) {
      setFormData({
        firstName: editingUser.firstName || '',
        lastName: editingUser.lastName || '',
        email: editingUser.email || '',
        role: (editingUser.role as UserRole) || UserRole.OTHER,
        status: editingUser.status || 'active',
        licensePlanId: editingUser.licensePlanId || '',
      });
    } else {
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        role: UserRole.OTHER,
        status: 'active',
        licensePlanId: '',
      });
    }
  }, [editingUser]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {editingUser ? 'Edit User' : 'Add New User'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            required
            placeholder="First Name"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded p-2 text-slate-900 dark:text-white"
          />
          <input
            required
            placeholder="Last Name"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded p-2 text-slate-900 dark:text-white"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded p-2 text-slate-900 dark:text-white"
          />
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
            className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded p-2 text-slate-900 dark:text-white"
          >
            <option value="USER">User</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </select>
          <select
            value={formData.licensePlanId}
            onChange={(e) => setFormData({ ...formData, licensePlanId: e.target.value })}
            className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded p-2 text-slate-900 dark:text-white"
          >
            <option value="">Select License...</option>
            {userPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (${p.price_monthly})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold mt-4"
          >
            Save
          </button>
        </form>
      </div>
    </div>
  );
};

// Invite User Modal
export const InviteUserModal: React.FC<{
  isOpen: boolean;
  organizations: Array<{ id: string; name: string }>;
  onClose: () => void;
  onInvite: (email: string, role: string, organizationId: string) => void;
}> = ({ isOpen, organizations, onClose, onInvite }) => {
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'USER', organizationId: '' });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onInvite(inviteForm.email, inviteForm.role, inviteForm.organizationId);
    setInviteForm({ email: '', role: 'USER', organizationId: '' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Invite New User</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded text-slate-900 dark:text-white focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">
              Role
            </label>
            <select
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded text-slate-900 dark:text-white focus:border-blue-500 outline-none"
            >
              <option value="USER">User (Standard)</option>
              <option value="ADMIN">Admin (Organization)</option>
              <option value="MANAGER">Manager</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">
              Organization
            </label>
            <select
              value={inviteForm.organizationId}
              onChange={(e) => setInviteForm({ ...inviteForm, organizationId: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded text-slate-900 dark:text-white focus:border-blue-500 outline-none"
            >
              <option value="">Select Organization...</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-transparent border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-navy-800/20 rounded text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium"
            >
              Send Invitation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Move User Modal
export const MoveUserModal: React.FC<{
  user: ManagedUser | null;
  organizations: Array<{ id: string; name: string; status: string }>;
  onClose: () => void;
  onMove: (userId: string, targetOrgId: string) => void;
}> = ({ user, organizations, onClose, onMove }) => {
  const [targetOrgId, setTargetOrgId] = useState('');

  if (!user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetOrgId) {
      onMove(user.id, targetOrgId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">
          Move User to Organization
        </h3>
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
          Select the new organization for{' '}
          <span className="text-slate-900 dark:text-white font-medium">
            {user.firstName} {user.lastName}
          </span>{' '}
          ({user.email}).
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">
              Target Organization
            </label>
            <select
              value={targetOrgId}
              onChange={(e) => setTargetOrgId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded text-slate-900 dark:text-white focus:border-blue-500 outline-none"
              required
            >
              <option value="">Select Organization...</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.status})
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-transparent border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-navy-800/20 rounded text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium"
            >
              Move User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main UserManagementCore Component
export const UserManagementCore: React.FC<UserManagementCoreProps> = ({
  mode,
  organizationId,
  organizations = [],
  showInvite = true,
  showMove = false,
  showImpersonate = false,
  showBlock = false,
  showRoleManagement = true,
  showLicenseManagement = true,
  className = '',
}) => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [userPlans, setUserPlans] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [movingUser, setMovingUser] = useState<ManagedUser | null>(null);
  const [assignmentsUser, setAssignmentsUser] = useState<ManagedUser | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedUsers =
        mode === 'platform' ? await Api.getSuperAdminUsers() : await Api.getUsers();
      setUsers(fetchedUsers);
    } catch (e) {
      console.error('Failed to load users', e);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    const loadData = async () => {
      await loadUsers();
      try {
        const plans = await Api.getUserPlans();
        setUserPlans(plans);
      } catch (e) {
        console.error('Failed to load user plans', e);
      }
    };
    loadData();
  }, [loadUsers]);

  const filteredUsers = users.filter(
    (u) =>
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.lastName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveUser = async (formData: any) => {
    try {
      if (editingUser) {
        if (mode === 'platform') {
          await Api.updateSuperAdminUser(editingUser.id, formData);
        } else {
          await Api.updateUser(editingUser.id, formData);
        }
        toast.success('User updated');
      } else {
        if (mode === 'platform') {
          await Api.createSuperAdminUser(formData);
          toast.success('User created');
        } else {
          // Org-admin user creation endpoint is not guaranteed in every deployment.
          // Prefer invitation flow where available.
          toast.error('User creation is not available here. Use Invite User instead.');
          return;
        }
      }
      setShowUserModal(false);
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Error saving user');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await Api.deleteUser(id);
      toast.success('User deleted');
      loadUsers();
    } catch (e) {
      toast.error('Failed to delete user');
    }
  };

  const handleBlockUser = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    const action = newStatus === 'blocked' ? 'Block' : 'Unblock';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      await Api.updateSuperAdminUser(userId, { status: newStatus });
      toast.success(`User ${newStatus === 'blocked' ? 'blocked' : 'unblocked'} successfully`);
      loadUsers();
    } catch {
      toast.error(`Failed to ${action.toLowerCase()} user`);
    }
  };

  const handleMoveUser = async (userId: string, targetOrgId: string) => {
    try {
      await Api.updateSuperAdminUser(userId, { organizationId: targetOrgId });
      toast.success('User moved successfully');
      setMovingUser(null);
      loadUsers();
    } catch {
      toast.error('Failed to move user');
    }
  };

  const handleInviteUser = async (email: string, role: string, orgId: string) => {
    try {
      await Api.inviteUser(email, role, orgId);
      toast.success('Invitation sent successfully');
      setShowInviteModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    }
  };

  const handleImpersonate = async (userId: string) => {
    if (!confirm('Are you sure you want to impersonate this user? You will be logged in as them.'))
      return;
    try {
      const { token } = await Api.impersonateUser(userId);
      localStorage.setItem('token', token);
      window.location.href = '/';
    } catch (err: any) {
      toast.error(err.message || 'Failed to impersonate user');
    }
  };

  const openEditModal = (user: ManagedUser) => {
    setEditingUser(user);
    setShowUserModal(true);
  };

  const openAddModal = () => {
    setEditingUser(null);
    setShowUserModal(true);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
            size={18}
          />
          <input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:border-purple-500 outline-none w-64"
          />
        </div>
        <div className="flex gap-3">
          {showInvite && mode === 'platform' && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <UserPlus size={16} /> Invite User
            </button>
          )}
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-purple-900/20"
          >
            <Plus size={16} /> Add User
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm text-slate-400 dark:text-slate-500">
          <thead className="bg-slate-50 dark:bg-navy-950 text-slate-600 dark:text-slate-200 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">User</th>
              {mode === 'platform' && <th className="px-6 py-4">Organization</th>}
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">License</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={mode === 'platform' ? 6 : 5} className="px-6 py-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={mode === 'platform' ? 6 : 5}
                  className="px-6 py-12 text-center text-slate-500 dark:text-slate-400"
                >
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <UserTableRow
                  key={user.id}
                  user={user}
                  userPlans={userPlans}
                  mode={mode}
                  onEdit={openEditModal}
                  onDelete={handleDeleteUser}
                  onMove={(u) => setMovingUser(u)}
                  onBlock={handleBlockUser}
                  onImpersonate={handleImpersonate}
                  onAssignments={(u) => setAssignmentsUser(u)}
                  showMove={showMove}
                  showImpersonate={showImpersonate}
                  showBlock={showBlock}
                  showAssignments={mode === 'org-admin'}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      <UserFormModal
        isOpen={showUserModal}
        editingUser={editingUser}
        userPlans={userPlans}
        onClose={() => {
          setShowUserModal(false);
          setEditingUser(null);
        }}
        onSave={handleSaveUser}
      />

      {showInvite && (
        <InviteUserModal
          isOpen={showInviteModal}
          organizations={organizations}
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInviteUser}
        />
      )}

      {showMove && (
        <MoveUserModal
          user={movingUser}
          organizations={organizations}
          onClose={() => setMovingUser(null)}
          onMove={handleMoveUser}
        />
      )}

      {/* User Assignments Panel */}
      {assignmentsUser && (
        <UserAssignmentsPanel
          userId={assignmentsUser.id}
          userName={`${assignmentsUser.firstName} ${assignmentsUser.lastName}`}
          onClose={() => setAssignmentsUser(null)}
          onSave={() => {
            setAssignmentsUser(null);
            loadUsers();
          }}
        />
      )}
    </div>
  );
};

export default UserManagementCore;
