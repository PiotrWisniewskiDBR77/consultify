/**
 * RolesPermissionsView - Account Types & Project Roles Management
 *
 * Structure:
 * 1. Account Types (Organization Level) - OWNER, ADMIN, USER - System defined, not editable
 * 2. Project Roles (Project Level) - PM, Team Lead, Member, Consultant, Viewer - Editable permissions
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Briefcase,
  Building2,
  Check,
  Crown,
  Edit,
  Eye,
  FolderKanban,
  Info,
  Key,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { ReadOnlyState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import { useAppStore } from '../../store/useAppStore';

// ============================================
// ACCOUNT TYPES (Organization Level)
// These determine what users can do at organization level
// ============================================
const ACCOUNT_TYPES = [
  {
    id: 'OWNER',
    name: 'Owner',
    description:
      'Organization owner with full access including billing, ownership transfer, and deletion',
    icon: Crown,
    color: 'amber',
    capabilities: [
      'Full access to all organization features',
      'Manage billing and subscription',
      'Transfer organization ownership',
      'Delete organization',
      'Access all projects',
    ],
  },
  {
    id: 'ADMIN',
    name: 'Admin',
    description: 'Administrator with full access except billing and ownership management',
    icon: Shield,
    color: 'violet',
    capabilities: [
      'Manage users and invitations',
      'Create and manage all projects',
      'Configure organization settings',
      'Manage AI settings and policies',
      'Cannot access billing or transfer ownership',
    ],
  },
  {
    id: 'USER',
    name: 'User',
    description: 'Standard user with access to assigned projects only',
    icon: Users,
    color: 'blue',
    capabilities: [
      'Access assigned projects',
      'Work on tasks and initiatives',
      'Use AI features (per project settings)',
      'Cannot manage organization settings',
      'Cannot invite other users',
    ],
  },
];

// ============================================
// PROJECT ROLES (Project Level) - PRINCE2/PMBOK aligned
// These determine what users can do within specific projects
// ============================================
const PROJECT_ROLES = [
  {
    id: 'PROJECT_EXECUTIVE',
    name: 'Project Executive / Sponsor',
    level: 0,
    description: 'Ultimate decision authority, budget approval, strategic direction',
    icon: Crown,
    color: 'amber',
    isSystem: true,
    defaultPermissions: [
      'approve_budget',
      'approve_gates',
      'strategic_decisions',
      'view_all',
      'escalation_authority',
    ],
  },
  {
    id: 'PROJECT_MANAGER',
    name: 'Project Manager',
    level: 1,
    description: 'Day-to-day project management, team coordination, reporting',
    icon: Briefcase,
    color: 'blue',
    isSystem: true,
    defaultPermissions: [
      'manage_tasks',
      'assign_work',
      'manage_team',
      'approve_changes',
      'view_all',
      'use_ai',
      'manage_risks',
    ],
  },
  {
    id: 'TEAM_LEAD',
    name: 'Team Lead / Technical Lead',
    level: 2,
    description: 'Lead functional team, technical decisions, work package management',
    icon: UserCog,
    color: 'indigo',
    isSystem: true,
    defaultPermissions: [
      'manage_tasks',
      'assign_work',
      'view_all',
      'use_ai',
      'technical_decisions',
    ],
  },
  {
    id: 'TEAM_MEMBER',
    name: 'Team Member',
    level: 3,
    description: 'Execute assigned tasks, collaborate with team, report progress',
    icon: Users,
    color: 'green',
    isSystem: true,
    defaultPermissions: ['view_assigned', 'update_own_tasks', 'add_comments', 'use_ai'],
  },
  {
    id: 'CONSULTANT',
    name: 'Consultant',
    level: 3,
    description: 'External advisor with project-specific access, free seat with access code',
    icon: UserCog,
    color: 'purple',
    isSystem: true,
    defaultPermissions: [], // Initially no permissions - configured per invite
  },
  {
    id: 'STAKEHOLDER',
    name: 'Stakeholder / Viewer',
    level: 4,
    description: 'View project status, receive updates, provide input when requested',
    icon: Eye,
    color: 'slate',
    isSystem: true,
    defaultPermissions: ['view_summary', 'add_comments'],
  },
];

// Project-level permission definitions
const PROJECT_PERMISSIONS = [
  {
    category: 'View Access',
    permissions: [
      { id: 'view_all', label: 'View All', description: 'See all project data' },
      { id: 'view_assigned', label: 'View Assigned', description: 'See only assigned items' },
      { id: 'view_summary', label: 'View Summary', description: 'See high-level status only' },
    ],
  },
  {
    category: 'Tasks & Work',
    permissions: [
      { id: 'manage_tasks', label: 'Manage Tasks', description: 'Create, edit, delete tasks' },
      { id: 'assign_work', label: 'Assign Work', description: 'Assign tasks to team members' },
      {
        id: 'update_own_tasks',
        label: 'Update Own Tasks',
        description: 'Update assigned task status',
      },
    ],
  },
  {
    category: 'Approvals & Decisions',
    permissions: [
      {
        id: 'approve_gates',
        label: 'Approve Stage Gates',
        description: 'Approve phase transitions',
      },
      { id: 'approve_changes', label: 'Approve Changes', description: 'Approve change requests' },
      { id: 'approve_budget', label: 'Approve Budget', description: 'Approve budget changes' },
      {
        id: 'strategic_decisions',
        label: 'Strategic Decisions',
        description: 'Make strategic project decisions',
      },
      {
        id: 'technical_decisions',
        label: 'Technical Decisions',
        description: 'Make technical decisions',
      },
    ],
  },
  {
    category: 'Team & Collaboration',
    permissions: [
      { id: 'manage_team', label: 'Manage Team', description: 'Add/remove project team members' },
      { id: 'add_comments', label: 'Add Comments', description: 'Comment on tasks and items' },
      {
        id: 'escalation_authority',
        label: 'Escalation Authority',
        description: 'Receive and handle escalations',
      },
    ],
  },
  {
    category: 'Risk & AI',
    permissions: [
      { id: 'manage_risks', label: 'Manage Risks', description: 'Create and manage risk register' },
      { id: 'use_ai', label: 'Use AI Features', description: 'Access AI assistant for project' },
    ],
  },
];

interface RolesPermissionsViewProps {
  className?: string;
}

export const RolesPermissionsView: React.FC<RolesPermissionsViewProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { currentOrganization } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'account' | 'project'>('project');
  const [customProjectRoles] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);

  // Form state for custom project roles
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    level: 3,
    permissions: [] as string[],
  });

  const saving = false;

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [currentOrganization?.id]);

  const openCreateModal = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      level: 3,
      permissions: [],
    });
    setShowCreateModal(true);
  };

  const openEditModal = (role: any) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      level: role.level || 3,
      permissions: role.defaultPermissions || [],
    });
    setShowCreateModal(true);
  };

  const handleSaveRole = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a role name');
      return;
    }

    toast.error('Custom project roles are read-only until persistence is connected');
  };

  const handleDeleteRole = (_roleId: string) => {
    toast.error('Custom project roles are read-only until persistence is connected');
  };

  const togglePermission = (permId: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter((p) => p !== permId)
        : [...prev.permissions, permId],
    }));
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; light: string }> = {
      amber: {
        bg: 'bg-amber-500',
        text: 'text-amber-500',
        light: 'bg-amber-100 dark:bg-amber-900/30',
      },
      violet: {
        bg: 'bg-navy-900',
        text: 'text-primary-500',
        light: 'bg-primary-100 dark:bg-primary-900/30',
      },
      blue: { bg: 'bg-blue-500', text: 'text-blue-500', light: 'bg-blue-100 dark:bg-blue-900/30' },
      indigo: {
        bg: 'bg-indigo-500',
        text: 'text-indigo-500',
        light: 'bg-indigo-100 dark:bg-indigo-900/30',
      },
      green: {
        bg: 'bg-green-500',
        text: 'text-green-500',
        light: 'bg-green-100 dark:bg-green-900/30',
      },
      purple: {
        bg: 'bg-navy-900',
        text: 'text-primary-500',
        light: 'bg-primary-100 dark:bg-primary-900/30',
      },
      slate: {
        bg: 'bg-slate-500',
        text: 'text-c-text-muted',
        light: 'bg-c-surface-raised/30',
      },
      cyan: { bg: 'bg-blue-500', text: 'text-blue-500', light: 'bg-blue-100 dark:bg-blue-900/30' },
    };
    return colors[color] || colors.slate;
  };

  const getLevelLabel = (level: number) => {
    const labels: Record<number, string> = {
      0: 'Executive',
      1: 'Manager',
      2: 'Lead',
      3: 'Member',
      4: 'Observer',
    };
    return labels[level] || 'Custom';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  const allProjectRoles = [...PROJECT_ROLES, ...customProjectRoles];

  return (
    <div className={`space-y-6 ${className}`}>
      <InfoButton cardId="admin-roles" position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-c-text flex items-center gap-2">
            <Key size={24} />
            {t('admin.roles.title', 'Roles & Permissions')}
          </h2>
          <p className="text-sm text-c-text-muted mt-1">
            Manage account types and project role permissions
          </p>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 border-b border-c-border-subtle">
        <button
          onClick={() => setActiveSection('account')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeSection === 'account'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-c-text-muted hover:text-c-text-secondary dark:hover:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Building2 size={16} />
            Account Types
          </div>
        </button>
        <button
          onClick={() => setActiveSection('project')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeSection === 'project'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-c-text-muted hover:text-c-text-secondary dark:hover:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <FolderKanban size={16} />
            Project Roles
          </div>
        </button>
      </div>

      {/* Account Types Section */}
      {activeSection === 'account' && (
        <div className="space-y-4">
          {/* Info Banner */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
            <Info className="text-blue-500 mt-0.5 flex-shrink-0" size={18} />
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <p className="font-medium">Account Types are organization-level permissions</p>
              <p className="mt-1 text-blue-600 dark:text-blue-400">
                These determine what users can do across the entire organization. Account types are
                system-defined and cannot be modified. You can assign account types to users in the
                "Users" tab.
              </p>
            </div>
          </div>

          {/* Account Types Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ACCOUNT_TYPES.map((type) => {
              const Icon = type.icon;
              const colors = getColorClasses(type.color);

              return (
                <div
                  key={type.id}
                  className="p-5 bg-c-surface rounded-xl border border-c-border-subtle"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`p-2.5 rounded-lg ${colors.light}`}>
                      <Icon className={colors.text} size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-c-text">
                          {type.name}
                        </h4>
                        <span className="px-1.5 py-0.5 bg-c-surface-raised text-c-text-muted text-[10px] rounded">
                          SYSTEM
                        </span>
                      </div>
                      <p className="text-xs text-c-text-muted mt-1">
                        {type.description}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-c-text-muted uppercase tracking-wider">
                      Capabilities
                    </p>
                    <ul className="space-y-1.5">
                      {type.capabilities.map((cap, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-c-text-secondary"
                        >
                          <Check size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
                          {cap}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Project Roles Section */}
      {activeSection === 'project' && (
        <div className="space-y-4">
          {/* Info Banner + Create Button */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg flex items-start gap-3">
              <Info className="text-primary-500 mt-0.5 flex-shrink-0" size={18} />
              <div className="text-sm text-primary-800 dark:text-primary-300">
                <p className="font-medium">
                  Project Roles define permissions within specific projects
                </p>
                <p className="mt-1 text-primary-600 dark:text-primary-400">
                  Based on PRINCE2 & PMBOK standards. You can customize permissions for each role or
                  create custom roles.
                </p>
              </div>
            </div>
            <button
              onClick={openCreateModal}
              disabled
              className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={18} />
              Create Custom Role
            </button>
          </div>

          <ReadOnlyState
            title="Custom project roles are read-only"
            description="Standard project roles are available for reference, but custom role persistence is not connected yet."
          />

          {/* Project Roles by Level */}
          {[0, 1, 2, 3, 4].map((level) => {
            const rolesAtLevel = allProjectRoles.filter((r) => r.level === level);
            if (rolesAtLevel.length === 0) return null;

            return (
              <div key={level} className="space-y-3">
                <h3 className="text-xs font-semibold text-c-text-muted uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-[10px] font-bold">
                    {level}
                  </span>
                  Level {level} - {getLevelLabel(level)}
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {rolesAtLevel.map((role) => {
                    const Icon = role.icon || UserCog;
                    const colors = getColorClasses(role.color);
                    const isSelected = selectedRole === role.id;

                    return (
                      <div
                        key={role.id}
                        onClick={() => setSelectedRole(isSelected ? null : role.id)}
                        className={`p-4 bg-c-surface rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary-500 ring-2 ring-primary-500/20'
                            : 'border-c-border-subtle hover:border-c-border'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${colors.light}`}>
                              <Icon className={colors.text} size={18} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-c-text text-sm">
                                  {role.name}
                                </h4>
                                {role.isSystem ? (
                                  <span className="px-1.5 py-0.5 bg-c-surface-raised text-c-text-muted text-[10px] rounded">
                                    STANDARD
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] rounded">
                                    CUSTOM
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-c-text-muted mt-0.5">
                                {role.description}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] text-c-text-muted">
                                  {role.defaultPermissions?.length || 0} permissions
                                </span>
                              </div>
                            </div>
                          </div>
                          {!role.isSystem && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(role);
                                }}
                                disabled
                                className="p-1.5 hover:bg-c-surface-raised rounded text-c-text-muted hover:text-c-text-secondary"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRole(role.id);
                                }}
                                disabled
                                className="p-1.5 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded text-c-text-muted hover:text-danger-600"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Permission Matrix when role selected */}
          {selectedRole && (
            <div className="p-5 bg-c-surface rounded-xl border border-c-border-subtle">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-c-text">
                  {allProjectRoles.find((r) => r.id === selectedRole)?.name} - Permissions
                </h3>
                {!allProjectRoles.find((r) => r.id === selectedRole)?.isSystem && (
                  <button
                    onClick={() =>
                      openEditModal(allProjectRoles.find((r) => r.id === selectedRole))
                    }
                    disabled
                    className="text-xs text-primary-600 hover:text-primary-500 font-medium"
                  >
                    Edit Permissions
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {PROJECT_PERMISSIONS.map((category) => (
                  <div key={category.category}>
                    <p className="text-xs font-medium text-c-text-muted uppercase tracking-wider mb-2">
                      {category.category}
                    </p>
                    <div className="space-y-1.5">
                      {category.permissions.map((perm) => {
                        const role = allProjectRoles.find((r) => r.id === selectedRole);
                        const hasPermission = role?.defaultPermissions?.includes(perm.id);
                        return (
                          <div key={perm.id} className="flex items-center gap-2 text-sm">
                            <div
                              className={`w-5 h-5 rounded flex items-center justify-center ${
                                hasPermission
                                  ? 'bg-green-500 text-white'
                                  : 'bg-slate-200 dark:bg-navy-700 text-c-text-muted'
                              }`}
                            >
                              {hasPermission ? <Check size={12} /> : <X size={12} />}
                            </div>
                            <span
                              className={
                                hasPermission
                                  ? 'text-c-text'
                                  : 'text-c-text-muted'
                              }
                            >
                              {perm.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Custom Project Role Modal */}
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
              className="bg-c-surface rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden"
            >
              <div className="p-6 border-b border-c-border-subtle">
                <h3 className="text-lg font-semibold text-c-text">
                  {editingRole ? 'Edit Project Role' : 'Create Custom Project Role'}
                </h3>
                <p className="text-sm text-c-text-muted mt-1">
                  Define a custom role with specific permissions for project team members
                </p>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      Role Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Senior Developer"
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      Level
                    </label>
                    <select
                      value={formData.level}
                      onChange={(e) =>
                        setFormData({ ...formData, level: parseInt(e.target.value) })
                      }
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text"
                    >
                      <option value={1}>Level 1 - Manager</option>
                      <option value={2}>Level 2 - Lead</option>
                      <option value={3}>Level 3 - Member</option>
                      <option value={4}>Level 4 - Observer</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this role's responsibilities"
                    className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-2">
                    Permissions
                  </label>
                  <div className="space-y-4 max-h-64 overflow-y-auto p-3 bg-c-surface-raised rounded-lg">
                    {PROJECT_PERMISSIONS.map((category) => (
                      <div key={category.category}>
                        <p className="text-xs font-semibold text-c-text-muted mb-2 uppercase tracking-wider">
                          {category.category}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {category.permissions.map((perm) => (
                            <button
                              key={perm.id}
                              type="button"
                              onClick={() => togglePermission(perm.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                formData.permissions.includes(perm.id)
                                  ? 'bg-navy-900 text-white'
                                  : 'bg-c-surface text-c-text-secondary border border-c-border-subtle hover:border-primary-300'
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
              <div className="p-6 border-t border-c-border-subtle flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRole}
                  disabled={saving || !formData.name}
                  className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium disabled:opacity-50"
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
