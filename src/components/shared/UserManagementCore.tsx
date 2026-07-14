import {
  AlertCircle,
  CheckCircle,
  Edit,
  GitBranch,
  Lock,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { User, UserRole } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { isSuperAdminRole } from '../../utils/roleGuards';
import { UserAssignmentsPanel } from '../../views/superadmin/components/UserAssignmentsPanel';
import { DegradedState, UnavailableState } from '../Admin/AdminState';

export interface UserManagementCoreProps {
  mode: 'org-admin' | 'platform';
  organizationId?: string;
  selectedOrganizationId?: string;
  onSelectedOrganizationChange?: (organizationId: string) => void;
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

const DEFAULT_PROJECT_ROLE_OPTIONS = [
  'PROJECT_EXECUTIVE',
  'PROJECT_MANAGER',
  'TEAM_LEAD',
  'TEAM_MEMBER',
  'CONSULTANT',
  'STAKEHOLDER',
];

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
    if (isSuperAdminRole(role)) return 'bg-danger-500/20 text-danger-400';
    if (role === UserRole.ADMIN) return 'bg-primary-500/20 text-primary-400 border-primary-500/50';
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
            <div className="text-xs text-slate-600 dark:text-slate-500">{user.email}</div>
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
        <span className="text-xs text-slate-700 dark:text-slate-300">
          {user.projectRole || (
            <span className="text-slate-500 dark:text-slate-500 italic">Not set</span>
          )}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <span className="text-xs text-slate-700 dark:text-slate-300">
            {user.department || (
              <span className="text-slate-500 dark:text-slate-500 italic">Department not set</span>
            )}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-500">
            {user.jobTitle || 'Position not set'}
          </span>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className="text-xs text-slate-600 dark:text-slate-500">
          {userPlans.find((p) => p.id === user.licensePlanId)?.name || 'Standard'}
        </span>
      </td>
      <td className="px-6 py-4">
        <span
          className={`flex items-center gap-1.5 ${user.status === 'active' ? 'text-green-400' : 'text-danger-400'}`}
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
              className="p-2 hover:bg-yellow-500/20 rounded-lg text-slate-600 dark:text-slate-500 hover:text-yellow-400"
              title="Reset Password"
            >
              <Lock size={16} />
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(user)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white"
              title="Edit"
            >
              <Edit size={16} />
            </button>
          )}
          {showAssignments && onAssignments && (
            <button
              onClick={() => onAssignments(user)}
              className="p-2 hover:bg-green-500/20 rounded-lg text-slate-600 dark:text-slate-500 hover:text-green-400"
              title="Manage Assignments"
            >
              <GitBranch size={16} />
            </button>
          )}
          {showMove && onMove && (
            <button
              onClick={() => onMove(user)}
              className="p-2 hover:bg-blue-500/20 rounded-lg text-slate-600 dark:text-slate-500 hover:text-blue-400 text-xs font-medium"
              title="Move to Organization"
            >
              Move
            </button>
          )}
          {showImpersonate && onImpersonate && !isSuperAdminRole(user.role) && (
            <button
              onClick={() => onImpersonate(user.id)}
              className="p-2 hover:bg-primary-500/20 rounded-lg text-slate-600 dark:text-slate-500 hover:text-primary-400 text-xs font-medium"
              title="Impersonate"
            >
              Impersonate
            </button>
          )}
          {showBlock && onBlock && !isSuperAdminRole(user.role) && (
            <button
              onClick={() => onBlock(user.id, user.status || 'active')}
              className={`p-2 rounded-lg text-xs font-medium ${
                user.status === 'active'
                  ? 'hover:bg-danger-500/20 text-slate-600 dark:text-slate-500 hover:text-danger-400'
                  : 'hover:bg-green-500/20 text-danger-400 hover:text-green-400'
              }`}
              title={user.status === 'active' ? 'Block' : 'Unblock'}
            >
              {user.status === 'active' ? 'Block' : 'Unblock'}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(user.id)}
              className="p-2 hover:bg-danger-500/20 rounded-lg text-slate-600 dark:text-slate-500 hover:text-danger-400"
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
  onSave: (formData: any) => void | Promise<void>;
  isSaving?: boolean;
}> = ({ isOpen, editingUser, userPlans, onClose, onSave, isSaving = false }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: UserRole.USER,
    projectRole: '',
    department: '',
    jobTitle: '',
    status: 'active',
    licensePlanId: '',
    password: '',
  });

  useEffect(() => {
    if (editingUser) {
      setFormData({
        firstName: editingUser.firstName || '',
        lastName: editingUser.lastName || '',
        email: editingUser.email || '',
        role: (editingUser.role as UserRole) || UserRole.USER,
        projectRole: editingUser.projectRole || '',
        department: editingUser.department || '',
        jobTitle: editingUser.jobTitle || '',
        status: editingUser.status || 'active',
        licensePlanId: editingUser.licensePlanId || '',
        password: '',
      });
    } else {
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        role: UserRole.USER,
        projectRole: '',
        department: '',
        jobTitle: '',
        status: 'active',
        licensePlanId: '',
        password: '',
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
            disabled={isSaving}
            className="text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white"
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
          {!editingUser && (
            <input
              required
              type="password"
              minLength={8}
              placeholder="Initial Password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded p-2 text-slate-900 dark:text-white"
            />
          )}
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
            value={formData.projectRole}
            onChange={(e) => setFormData({ ...formData, projectRole: e.target.value })}
            className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded p-2 text-slate-900 dark:text-white"
          >
            <option value="">Project Role (optional)</option>
            {DEFAULT_PROJECT_ROLE_OPTIONS.map((projectRole) => (
              <option key={projectRole} value={projectRole}>
                {projectRole}
              </option>
            ))}
          </select>
          <input
            placeholder="Department (optional)"
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded p-2 text-slate-900 dark:text-white"
          />
          <input
            placeholder="Position / Job Title (optional)"
            value={formData.jobTitle}
            onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
            className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded p-2 text-slate-900 dark:text-white"
          />
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
            disabled={isSaving}
            className="w-full py-3 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-semibold mt-4 disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save'}
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
  defaultOrganizationId?: string;
  onClose: () => void;
  onInvite: (email: string, role: string, organizationId: string) => void | Promise<void>;
  isInviting?: boolean;
}> = ({
  isOpen,
  organizations,
  defaultOrganizationId = '',
  onClose,
  onInvite,
  isInviting = false,
}) => {
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'USER', organizationId: '' });

  useEffect(() => {
    if (!isOpen) return;
    setInviteForm((current) => ({
      ...current,
      organizationId: current.organizationId || defaultOrganizationId,
    }));
  }, [defaultOrganizationId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onInvite(inviteForm.email, inviteForm.role, inviteForm.organizationId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Invite New User</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
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
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
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
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
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
              disabled={isInviting}
              className="flex-1 py-2 bg-transparent border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-navy-800/20 rounded text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isInviting}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium disabled:opacity-60"
            >
              {isInviting ? 'Sending...' : 'Send Invitation'}
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
  onMove: (userId: string, targetOrgId: string) => void | Promise<void>;
  isMoving?: boolean;
}> = ({ user, organizations, onClose, onMove, isMoving = false }) => {
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
        <p className="text-sm text-slate-600 dark:text-slate-500 mb-4">
          Select the new organization for{' '}
          <span className="text-slate-900 dark:text-white font-medium">
            {user.firstName} {user.lastName}
          </span>{' '}
          ({user.email}).
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
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
              disabled={isMoving}
              className="flex-1 py-2 bg-transparent border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-navy-800/20 rounded text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isMoving}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium disabled:opacity-60"
            >
              {isMoving ? 'Moving...' : 'Move User'}
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
  selectedOrganizationId = '',
  onSelectedOrganizationChange,
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
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedProjectRole, setSelectedProjectRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [invitingUser, setInvitingUser] = useState(false);
  const [movingUserId, setMovingUserId] = useState<string | null>(null);

  // Modal states
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [movingUser, setMovingUser] = useState<ManagedUser | null>(null);
  const [assignmentsUser, setAssignmentsUser] = useState<ManagedUser | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const fetchedUsers =
        mode === 'platform'
          ? await Api.getSuperAdminUsers({
              organizationId: selectedOrganizationId || undefined,
              role: selectedRole || undefined,
              status: selectedStatus || undefined,
            })
          : await Api.getUsers();
      setUsers(fetchedUsers);
    } catch (e) {
      console.error('Failed to load users', e);
      const message = normalizeApiErrorMessage(e, 'Failed to load users');
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [mode, selectedOrganizationId, selectedRole, selectedStatus]);

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

  const filteredUsers = users.filter((u) => {
    const normalizedSearch = searchTerm.toLowerCase();
    const matchesSearch =
      (u.email || '').toLowerCase().includes(normalizedSearch) ||
      (u.firstName || '').toLowerCase().includes(normalizedSearch) ||
      (u.lastName || '').toLowerCase().includes(normalizedSearch) ||
      (u.department || '').toLowerCase().includes(normalizedSearch) ||
      (u.jobTitle || '').toLowerCase().includes(normalizedSearch) ||
      (u.projectRole || '').toLowerCase().includes(normalizedSearch);

    const matchesProjectRole = !selectedProjectRole || u.projectRole === selectedProjectRole;
    return matchesSearch && matchesProjectRole;
  });
  const selectedOrganizationName =
    mode === 'platform'
      ? organizations.find((org) => org.id === selectedOrganizationId)?.name || ''
      : '';
  const roleOptions =
    mode === 'platform'
      ? Array.from(
          new Set(
            (
              [
                UserRole.OWNER,
                UserRole.ADMIN,
                UserRole.USER,
                UserRole.MANAGER,
                UserRole.SUPERADMIN,
              ] as string[]
            )
              .concat(users.map((user) => String(user.role || '').trim()))
              .filter(Boolean)
          )
        )
      : [];
  const statusOptions =
    mode === 'platform'
      ? Array.from(
          new Set(['active', 'blocked', 'pending'].concat(users.map((user) => user.status || '')))
        ).filter(Boolean)
      : [];
  const projectRoleOptions =
    mode === 'platform'
      ? Array.from(
          new Set(
            DEFAULT_PROJECT_ROLE_OPTIONS.concat(
              users.map((user) => String(user.projectRole || '').trim()).filter(Boolean)
            )
          )
        )
      : [];

  const handleSaveUser = async (formData: any) => {
    setSavingUser(true);
    try {
      if (editingUser) {
        const { password: _password, ...updates } = formData;
        if (mode === 'platform') {
          await Api.updateSuperAdminUser(editingUser.id, updates);
        } else {
          await Api.updateUser(editingUser.id, updates);
        }
        toast.success('User updated');
      } else {
        if (mode === 'platform') {
          await Api.createSuperAdminUser({
            ...formData,
            organizationId: selectedOrganizationId || undefined,
          });
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
      await loadUsers();
    } catch (err: any) {
      toast.error(normalizeApiErrorMessage(err, 'Error saving user'));
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      if (mode === 'platform') {
        await Api.deleteSuperAdminUser(id);
      } else {
        await Api.deleteUser(id);
      }
      toast.success('User deleted');
      await loadUsers();
    } catch (e: any) {
      // Feedback #406b042a — surface actual backend reason (e.g. owner
      // protection, unauthorized) instead of masking every failure with a
      // generic "Failed to delete user" toast.
      toast.error(normalizeApiErrorMessage(e, 'Failed to delete user'));
    }
  };

  const handleBlockUser = async (userId: string, currentStatus: string) => {
    const normalizedCurrent = (currentStatus || '').toLowerCase();
    const newStatus = normalizedCurrent === 'active' ? 'blocked' : 'active';
    const action = newStatus === 'blocked' ? 'Block' : 'Unblock';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      await Api.updateSuperAdminUser(userId, { status: newStatus });
      toast.success(`User ${newStatus === 'blocked' ? 'blocked' : 'unblocked'} successfully`);
      await loadUsers();
    } catch (e: any) {
      // Feedback #682d4134 — surface the actual backend reason (e.g. Zod
      // validation detail, 404, 403) instead of always showing a generic
      // "Failed to block user".
      toast.error(normalizeApiErrorMessage(e, `Failed to ${action.toLowerCase()} user`));
    }
  };

  const handleMoveUser = async (userId: string, targetOrgId: string) => {
    setMovingUserId(userId);
    try {
      await Api.updateSuperAdminUser(userId, { organizationId: targetOrgId });
      toast.success('User moved successfully');
      setMovingUser(null);
      await loadUsers();
    } catch (e: any) {
      // Feedback #76ef6831 — surface e.g. "Target organization not found" so
      // the admin understands why the move didn't go through.
      toast.error(normalizeApiErrorMessage(e, 'Failed to move user'));
    } finally {
      setMovingUserId(null);
    }
  };

  const handleInviteUser = async (email: string, role: string, orgId: string) => {
    setInvitingUser(true);
    try {
      await Api.inviteUser(email, role, orgId);
      toast.success('Invitation sent successfully');
      setShowInviteModal(false);
      await loadUsers();
    } catch (err: any) {
      toast.error(normalizeApiErrorMessage(err, 'Failed to send invitation'));
    } finally {
      setInvitingUser(false);
    }
  };

  const handleImpersonate = async (userId: string) => {
    if (
      !confirm(
        'Start a read-only impersonation session for up to 30 minutes? All session start/end events are audit logged.'
      )
    )
      return;
    // Feedback #b8bf4422 — backend middleware requires a reason (>= 3 chars)
    // together with the confirmation flag. We ask the admin for a short
    // justification so the audit trail is meaningful; fall back to a generic
    // note if they skip the prompt (the API layer enforces the minimum).
    const reasonInput = window.prompt(
      'Reason for impersonation (min 3 chars, written to audit log):',
      'Superadmin support session'
    );
    if (reasonInput === null) return;
    try {
      const { token } = await Api.impersonateUser(userId, reasonInput);
      localStorage.setItem('token', token);
      window.location.href = '/';
    } catch (err: any) {
      toast.error(normalizeApiErrorMessage(err, 'Failed to impersonate user'));
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

  const clearPlatformFilters = () => {
    onSelectedOrganizationChange?.('');
    setSelectedRole('');
    setSelectedProjectRole('');
    setSelectedStatus('');
    setSearchTerm('');
  };
  const canCreateUsersDirectly = mode === 'platform';

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
              size={16}
            />
            <input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={!!loadError}
              className="pl-10 pr-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:border-primary-500 outline-none w-full md:w-64"
            />
          </div>
          {mode === 'platform' && (
            <>
              <select
                value={selectedOrganizationId}
                onChange={(e) => onSelectedOrganizationChange?.(e.target.value)}
                disabled={!!loadError}
                className="px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:border-primary-500 outline-none min-w-[220px]"
              >
                <option value="">All organizations</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                disabled={!!loadError}
                className="px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:border-primary-500 outline-none min-w-[160px]"
              >
                <option value="">All roles</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <select
                value={selectedProjectRole}
                onChange={(e) => setSelectedProjectRole(e.target.value)}
                disabled={!!loadError}
                className="px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:border-primary-500 outline-none min-w-[180px]"
              >
                <option value="">All project roles</option>
                {projectRoleOptions.map((projectRole) => (
                  <option key={projectRole} value={projectRole}>
                    {projectRole}
                  </option>
                ))}
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                disabled={!!loadError}
                className="px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:border-primary-500 outline-none min-w-[160px]"
              >
                <option value="">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              {(selectedOrganizationId ||
                selectedRole ||
                selectedProjectRole ||
                selectedStatus ||
                searchTerm) && (
                <button
                  onClick={clearPlatformFilters}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800/40 transition-colors"
                >
                  Clear all
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex gap-3">
          {showInvite && mode === 'platform' && (
            <button
              onClick={() => setShowInviteModal(true)}
              disabled={!!loadError}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <UserPlus size={16} /> Invite User
            </button>
          )}
          <button
            onClick={openAddModal}
            disabled={!canCreateUsersDirectly || !!loadError}
            className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors text-sm font-medium shadow-lg shadow-primary-900/20"
          >
            <Plus size={16} /> Add User
          </button>
        </div>
      </div>

      {!canCreateUsersDirectly && (
        <UnavailableState
          compact
          title="Direct user creation unavailable"
          description="This admin surface can edit existing users, but direct creation is not backed by a reliable tenant-admin endpoint. Use the platform invite flow."
        />
      )}

      {loadError && (
        <div className="rounded-lg border border-danger-200 dark:border-danger-500/20 bg-danger-50 dark:bg-danger-500/10 p-4 text-sm text-danger-700 dark:text-danger-300">
          {loadError}
        </div>
      )}

      {mode === 'platform' && (
        <div className="text-sm text-slate-600 dark:text-slate-400">
          Showing {filteredUsers.length} users
          {selectedOrganizationName ? (
            <>
              {' '}
              for{' '}
              <span className="font-medium text-slate-900 dark:text-white">
                {selectedOrganizationName}
              </span>
            </>
          ) : null}
          {selectedRole ? ` with role ${selectedRole}` : ''}
          {selectedProjectRole ? ` in project role ${selectedProjectRole}` : ''}
          {selectedStatus ? ` and status ${selectedStatus}` : ''}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
        <table
          /* §27-exempt: panel konfiguracyjny/billingowy, mala tabela ustawien poza zakresem listowym */ className="w-full text-left text-sm text-slate-600 dark:text-slate-500"
        >
          <thead className="bg-slate-50 dark:bg-navy-950 text-slate-600 dark:text-slate-200 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">User</th>
              {mode === 'platform' && <th className="px-6 py-4">Organization</th>}
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Project role</th>
              <th className="px-6 py-4">Department / Position</th>
              <th className="px-6 py-4">License</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={mode === 'platform' ? 8 : 7} className="px-6 py-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={mode === 'platform' ? 8 : 7} className="px-6 py-6">
                  <DegradedState title="Users unavailable" description={loadError} />
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={mode === 'platform' ? 8 : 7}
                  className="px-6 py-12 text-center text-slate-500 dark:text-slate-400"
                >
                  {selectedOrganizationName
                    ? `No users found for ${selectedOrganizationName}`
                    : 'No users found'}
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
          if (savingUser) return;
          setShowUserModal(false);
          setEditingUser(null);
        }}
        onSave={handleSaveUser}
        isSaving={savingUser}
      />

      {showInvite && (
        <InviteUserModal
          isOpen={showInviteModal}
          organizations={organizations}
          defaultOrganizationId={selectedOrganizationId}
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInviteUser}
          isInviting={invitingUser}
        />
      )}

      {showMove && (
        <MoveUserModal
          user={movingUser}
          organizations={organizations}
          onClose={() => setMovingUser(null)}
          onMove={handleMoveUser}
          isMoving={movingUserId === movingUser?.id}
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
