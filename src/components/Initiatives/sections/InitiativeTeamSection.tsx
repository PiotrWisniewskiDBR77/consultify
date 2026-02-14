/**
 * InitiativeTeamSection
 *
 * Team management for initiatives.
 * Layout & functions: from Assessment TeamManagementPanel (roles, add member modal,
 *   permissions badges, role stats, inline role editing, member row).
 * Visual style: N-mode RACI pattern (rounded-2xl, backdrop-blur-xl, navy,
 *   collapsible header, nested rounded-xl cards).
 *
 * No DRD-specific Area Assignments — initiative-focused.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  Crown,
  Edit3,
  Eye,
  Loader2,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import React, { ElementType, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

// ==========================================
// TYPES (mirrored from Assessment TeamManagementPanel)
// ==========================================

type TeamRole = 'admin' | 'manager' | 'editor' | 'viewer';

interface TeamMember {
  id: string;
  userId: string;
  role: TeamRole;
  canEdit: boolean;
  canApprove: boolean;
  canManageTeam: boolean;
  canChangeStatus: boolean;
  canGenerateReport: boolean;
  canGenerateInitiatives: boolean;
  assignedAreas?: string[] | null;
  assignedAt?: string;
  userName?: string;
  userEmail?: string;
}

interface OrgUser {
  id: string;
  email: string;
  name: string;
}

// ==========================================
// ROLE CONFIG (from Assessment TeamManagementPanel)
// ==========================================

const ROLE_CONFIG: Record<
  TeamRole,
  {
    label: { en: string; pl: string };
    icon: ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    description: { en: string; pl: string };
    permissions: string[];
  }
> = {
  admin: {
    label: { en: 'Admin', pl: 'Admin' },
    icon: Crown,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-500/10',
    borderColor: 'border-amber-200 dark:border-amber-500/30',
    description: { en: 'Full access', pl: 'Pełny dostęp' },
    permissions: ['Edit', 'Approve', 'Manage', 'Status'],
  },
  manager: {
    label: { en: 'Manager', pl: 'Manager' },
    icon: ShieldCheck,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-500/10',
    borderColor: 'border-purple-200 dark:border-purple-500/30',
    description: { en: 'Team & approvals', pl: 'Zespół i zatwierdzenia' },
    permissions: ['Edit', 'Approve', 'Manage', 'Status'],
  },
  editor: {
    label: { en: 'Editor', pl: 'Edytor' },
    icon: Edit3,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    description: { en: 'Edit content', pl: 'Edytuj treści' },
    permissions: ['Edit'],
  },
  viewer: {
    label: { en: 'Viewer', pl: 'Obserwator' },
    icon: Eye,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-500/10',
    borderColor: 'border-slate-200 dark:border-slate-500/30',
    description: { en: 'Read only', pl: 'Tylko odczyt' },
    permissions: [],
  },
};

// Derive permissions from role
function getPermissionsForRole(
  role: TeamRole
): Omit<TeamMember, 'id' | 'userId' | 'role' | 'assignedAt' | 'userName' | 'userEmail'> {
  switch (role) {
    case 'admin':
      return {
        canEdit: true,
        canApprove: true,
        canManageTeam: true,
        canChangeStatus: true,
        canGenerateReport: true,
        canGenerateInitiatives: true,
      };
    case 'manager':
      return {
        canEdit: true,
        canApprove: true,
        canManageTeam: true,
        canChangeStatus: true,
        canGenerateReport: false,
        canGenerateInitiatives: false,
      };
    case 'editor':
      return {
        canEdit: true,
        canApprove: false,
        canManageTeam: false,
        canChangeStatus: false,
        canGenerateReport: false,
        canGenerateInitiatives: false,
      };
    case 'viewer':
    default:
      return {
        canEdit: false,
        canApprove: false,
        canManageTeam: false,
        canChangeStatus: false,
        canGenerateReport: false,
        canGenerateInitiatives: false,
      };
  }
}

function getActivePermissions(member: TeamMember): string[] {
  const perms: string[] = [];
  if (member.canEdit) perms.push('Edit');
  if (member.canApprove) perms.push('Approve');
  if (member.canManageTeam) perms.push('Manage');
  if (member.canChangeStatus) perms.push('Status');
  if (member.canGenerateReport) perms.push('Report');
  if (member.canGenerateInitiatives) perms.push('Initiatives');
  return perms;
}

function makeDemoMembers(isPolish: boolean): TeamMember[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'demo-admin-1',
      userId: 'demo-admin-1',
      role: 'admin',
      ...getPermissionsForRole('admin'),
      assignedAreas: null,
      assignedAt: now,
      userName: 'Super Admin',
      userEmail: 'admin@dbr77.com',
    },
    {
      id: 'demo-manager-1',
      userId: 'demo-manager-1',
      role: 'manager',
      ...getPermissionsForRole('manager'),
      assignedAreas: null,
      assignedAt: now,
      userName: 'Justyna Laskowska',
      userEmail: 'justyna.laskowska@dbr77.com',
    },
    {
      id: 'demo-editor-1',
      userId: 'demo-editor-1',
      role: 'editor',
      ...getPermissionsForRole('editor'),
      assignedAreas: null,
      assignedAt: now,
      userName: 'Piotr Wisniewski',
      userEmail: 'piotr.wisniewski@dbr77.com',
    },
    {
      id: 'demo-viewer-1',
      userId: 'demo-viewer-1',
      role: 'viewer',
      ...getPermissionsForRole('viewer'),
      assignedAreas: null,
      assignedAt: now,
      userName: isPolish ? 'Użytkownik podglądu' : 'Read-only Viewer',
      userEmail: 'viewer@dbr77.com',
    },
  ];
}

// ==========================================
// ADD MEMBER MODAL (from Assessment TeamManagementPanel)
// ==========================================

const AddMemberModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (userId: string, role: TeamRole) => void;
  onSearchUsers: (query: string) => Promise<OrgUser[]>;
  existingMemberIds: Set<string>;
  isPolish: boolean;
}> = ({ isOpen, onClose, onAdd, onSearchUsers, existingMemberIds, isPolish }) => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<TeamRole>('editor');
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setUsers([]);
      setSelectedUser(null);
      setSelectedRole('editor');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const search = async () => {
      setSearching(true);
      try {
        const results = await onSearchUsers(query);
        setUsers(results.filter((u) => !existingMemberIds.has(u.id)));
      } catch {
        setUsers([]);
      } finally {
        setSearching(false);
      }
    };
    if (String(query || '').trim().length === 0) {
      void search();
      return;
    }
    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [isOpen, query, onSearchUsers, existingMemberIds]);

  const handleAdd = async () => {
    if (!selectedUser) return;
    setAdding(true);
    try {
      onAdd(selectedUser.id, selectedRole);
      onClose();
    } catch {
      toast.error(isPolish ? 'Nie udało się dodać' : 'Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg mx-4 bg-white dark:bg-navy-900 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 text-white rounded-lg">
                <UserPlus size={18} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {isPolish ? 'Dodaj członka zespołu' : 'Add Team Member'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {isPolish
                    ? 'Wyszukaj i dodaj do zespołu inicjatywy'
                    : 'Search and add to the initiative team'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {isPolish ? 'Szukaj użytkowników' : 'Search Users'}
            </label>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  isPolish ? 'Szukaj po nazwisku lub email...' : 'Search by name or email...'
                }
                autoComplete="off"
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors"
              />
              {searching && (
                <Loader2
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 animate-spin"
                />
              )}
            </div>

            {users.length > 0 && (
              <div className="mt-2 max-h-48 overflow-auto rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${selectedUser?.id === user.id ? 'bg-purple-50 dark:bg-purple-500/10' : ''}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-sm font-semibold text-white">
                      {(user.name || user.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {user.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                    </div>
                    {selectedUser?.id === user.id && (
                      <CheckCircle2 size={18} className="text-purple-500" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {String(query || '').trim().length >= 2 && users.length === 0 && !searching && (
              <div className="mt-2 p-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {isPolish ? `Nie znaleziono "${query}"` : `No users found matching "${query}"`}
                </p>
              </div>
            )}
          </div>

          {/* Selected User */}
          {selectedUser && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl border-2 border-purple-200 dark:border-purple-500/30 bg-purple-50/50 dark:bg-purple-500/5"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-lg font-semibold text-white">
                  {(selectedUser.name || selectedUser.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {selectedUser.name}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {selectedUser.email}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-1.5 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors"
                >
                  <X size={16} className="text-purple-600 dark:text-purple-400" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Role Selection (2x2 grid) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {isPolish ? 'Wybierz rolę' : 'Select Role'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(ROLE_CONFIG) as [TeamRole, (typeof ROLE_CONFIG)[TeamRole]][]).map(
                ([role, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={role}
                      onClick={() => setSelectedRole(role)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${selectedRole === role ? `${config.borderColor} ${config.bgColor}` : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={16} className={config.color} />
                        <span
                          className={`text-sm font-semibold ${selectedRole === role ? config.color : 'text-slate-700 dark:text-slate-300'}`}
                        >
                          {isPolish ? config.label.pl : config.label.en}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {isPolish ? config.description.pl : config.description.en}
                      </p>
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
          >
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedUser || adding}
            className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 dark:disabled:bg-purple-500/30 text-white text-sm font-semibold transition-colors flex items-center gap-2"
          >
            {adding ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {isPolish ? 'Dodawanie...' : 'Adding...'}
              </>
            ) : (
              <>
                <UserPlus size={16} />
                {isPolish ? 'Dodaj' : 'Add Member'}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

// ==========================================
// MEMBER ROW (Assessment layout + RACI visual style)
// ==========================================

const TeamMemberRow: React.FC<{
  member: TeamMember;
  isPolish: boolean;
  onUpdateRole: (userId: string, role: TeamRole) => void;
  onRemove: (userId: string) => void;
}> = ({ member, isPolish, onUpdateRole, onRemove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<TeamRole>(member.role);
  const [busy, setBusy] = useState(false);

  const roleConfig = ROLE_CONFIG[member.role];
  const RoleIcon = roleConfig.icon;
  const activePermissions = getActivePermissions(member);

  const handleSaveRole = () => {
    if (selectedRole === member.role) {
      setIsEditing(false);
      return;
    }
    setBusy(true);
    onUpdateRole(member.userId, selectedRole);
    setBusy(false);
    setIsEditing(false);
  };

  const handleRemove = () => {
    if (
      !confirm(
        isPolish
          ? `Usunąć ${member.userName || member.userEmail}?`
          : `Remove ${member.userName || member.userEmail}?`
      )
    )
      return;
    onRemove(member.userId);
  };

  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="group border-b border-slate-200/50 dark:border-navy-700/30 hover:bg-slate-50/50 dark:hover:bg-navy-800/30 transition-colors"
    >
      {/* MEMBER: avatar + name + email */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
            {(member.userName || member.userEmail || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {member.userName || member.userEmail || 'Unknown'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
              <Mail size={10} />
              {member.userEmail || '—'}
            </div>
          </div>
        </div>
      </td>

      {/* ROLE */}
      <td className="px-4 py-3">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as TeamRole)}
              className="h-8 px-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs text-slate-900 dark:text-white"
            >
              {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                <option key={role} value={role}>
                  {isPolish ? config.label.pl : config.label.en}
                </option>
              ))}
            </select>
            <button
              onClick={handleSaveRole}
              disabled={busy}
              className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-emerald-300 transition-colors"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            </button>
            <button
              onClick={() => {
                setSelectedRole(member.role);
                setIsEditing(false);
              }}
              className="p-1.5 rounded-lg bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-navy-600 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${roleConfig.bgColor} ${roleConfig.color} ${roleConfig.borderColor} border`}
          >
            <RoleIcon size={12} />
            {isPolish ? roleConfig.label.pl : roleConfig.label.en}
          </div>
        )}
      </td>

      {/* PERMISSIONS */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {activePermissions.length > 0 ? (
            activePermissions.slice(0, 4).map((perm) => (
              <span
                key={perm}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              >
                {perm}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {isPolish ? 'Tylko odczyt' : 'View only'}
            </span>
          )}
          {activePermissions.length > 4 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400">
              +{activePermissions.length - 4}
            </span>
          )}
        </div>
      </td>

      {/* AREAS */}
      <td className="px-4 py-3">
        {member.assignedAreas && member.assignedAreas.length > 0 ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
            {member.assignedAreas.length} {isPolish ? 'obszarów' : 'areas'}
          </span>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {isPolish ? 'Wszystkie obszary' : 'All areas'}
          </span>
        )}
      </td>

      {/* ADDED */}
      <td className="px-4 py-3">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {member.assignedAt
            ? new Date(member.assignedAt).toLocaleDateString('pl-PL', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : '—'}
        </span>
      </td>

      {/* ACTIONS */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setIsEditing(true)}
            disabled={isEditing || busy}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors disabled:opacity-50"
            title={isPolish ? 'Edytuj rolę' : 'Edit role'}
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={handleRemove}
            disabled={busy}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
            title={isPolish ? 'Usuń' : 'Remove'}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </motion.tr>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const InitiativeTeamSection: React.FC<InitiativeSectionProps> = () => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const { users } = useInitiativeContext();

  // State
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Seed demo members so Team table is immediately visible/testable.
  useEffect(() => {
    setMembers((prev) => {
      if (prev.length > 0) return prev;
      return makeDemoMembers(isPolish);
    });
  }, [isPolish]);

  const existingMemberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);

  // Role stats
  const roleStats = useMemo(() => {
    const stats: Record<TeamRole, number> = { admin: 0, manager: 0, editor: 0, viewer: 0 };
    members.forEach((m) => {
      if (stats[m.role] !== undefined) stats[m.role]++;
    });
    return stats;
  }, [members]);

  // Search users (uses org users list)
  const handleSearchUsers = useCallback(
    async (query: string): Promise<OrgUser[]> => {
      // Use locally available users from context as primary source
      const q = query.toLowerCase();
      const mapped = users.map((u) => ({
        id: u.id,
        email: u.email || '',
        name: `${u.firstName} ${u.lastName}`.trim(),
      }));
      if (!q) return mapped;
      return mapped.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    },
    [users]
  );

  // Add member
  const handleAddMember = useCallback(
    (userId: string, role: TeamRole) => {
      const user = users.find((u) => u.id === userId);
      if (!user) return;
      const perms = getPermissionsForRole(role);
      const newMember: TeamMember = {
        id: `tm-${Date.now()}-${userId}`,
        userId,
        role,
        ...perms,
        assignedAreas: null,
        assignedAt: new Date().toISOString(),
        userName: `${user.firstName} ${user.lastName}`.trim(),
        userEmail: user.email,
      };
      setMembers((prev) => [...prev, newMember]);
      toast.success(isPolish ? 'Dodano członka zespołu' : 'Team member added');
    },
    [users, isPolish]
  );

  // Update role
  const handleUpdateRole = useCallback(
    (userId: string, newRole: TeamRole) => {
      const perms = getPermissionsForRole(newRole);
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role: newRole, ...perms } : m))
      );
      toast.success(isPolish ? 'Rola zaktualizowana' : 'Role updated');
    },
    [isPolish]
  );

  // Remove member
  const handleRemoveMember = useCallback(
    (userId: string) => {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      toast.success(isPolish ? 'Usunięto z zespołu' : 'Removed from team');
    },
    [isPolish]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-navy-700/50 shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
    >
      {/* Static Header (aligned with RACI section style) */}
      <div className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-3">
          <div className="text-left">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {isPolish ? 'Zarządzanie zespołem' : 'Team Management'}
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {members.length} {isPolish ? 'członków' : 'members'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <Plus size={12} />
            {isPolish ? 'Dodaj członka' : 'Add Member'}
          </button>
          {members.length > 0 && (
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
              {members.length}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div>
        {/* Role Stats Bar */}
        {members.length > 0 && (
          <div className="px-4 py-3 border-b border-slate-200/50 dark:border-navy-700/30 bg-slate-50/30 dark:bg-navy-800/20">
            <div className="flex items-center gap-3 overflow-x-auto">
              {(Object.entries(ROLE_CONFIG) as [TeamRole, (typeof ROLE_CONFIG)[TeamRole]][]).map(
                ([role, config]) => {
                  const Icon = config.icon;
                  const count = roleStats[role];
                  if (count === 0) return null;
                  return (
                    <div
                      key={role}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${config.bgColor} ${config.borderColor} border`}
                    >
                      <Icon size={12} className={config.color} />
                      <span className={`text-xs font-medium ${config.color}`}>
                        {count} {isPolish ? config.label.pl : config.label.en}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

        {/* Members Table */}
        {members.length === 0 ? (
          <div className="text-center py-10">
            <div className="p-4 rounded-full bg-slate-100 dark:bg-navy-800 inline-block mb-3">
              <Users size={24} className="text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isPolish ? 'Brak członków zespołu' : 'No team members yet'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {isPolish
                ? 'Dodaj członków, aby rozpocząć współpracę'
                : 'Add members to start collaborating'}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold transition-colors mx-auto"
            >
              <Plus size={16} />
              {isPolish ? 'Dodaj pierwszego członka' : 'Add First Member'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 600 }}>
              <thead>
                <tr className="border-b border-slate-200/50 dark:border-navy-700/30 bg-slate-50/50 dark:bg-navy-800/30">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'CZŁONEK' : 'MEMBER'}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'ROLA' : 'ROLE'}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'UPRAWNIENIA' : 'PERMISSIONS'}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'OBSZARY' : 'AREAS'}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'DODANO' : 'ADDED'}
                  </th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'AKCJE' : 'ACTIONS'}
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {members.map((member) => (
                    <TeamMemberRow
                      key={member.id}
                      member={member}
                      isPolish={isPolish}
                      onUpdateRole={handleUpdateRole}
                      onRemove={handleRemoveMember}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* Footer: Role legend */}
        {members.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200/50 dark:border-navy-700/30 bg-slate-50/30 dark:bg-navy-800/20">
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400">
              {(Object.entries(ROLE_CONFIG) as [TeamRole, (typeof ROLE_CONFIG)[TeamRole]][]).map(
                ([role, config]) => {
                  const Icon = config.icon;
                  return (
                    <span key={role} className="flex items-center gap-1">
                      <Icon size={10} className={config.color} />
                      {isPolish ? config.label.pl : config.label.en} —{' '}
                      {isPolish ? config.description.pl : config.description.en}
                    </span>
                  );
                }
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddMemberModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            onAdd={handleAddMember}
            onSearchUsers={handleSearchUsers}
            existingMemberIds={existingMemberIds}
            isPolish={isPolish}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
