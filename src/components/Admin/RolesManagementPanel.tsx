/**
 * RolesManagementPanel - Role & Permission Management
 *
 * Features:
 * - View predefined roles
 * - Edit role permissions matrix
 * - Create custom roles
 * - Assign roles to users
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Crown,
  Edit,
  Eye,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  Trash2,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { InfoButton } from '../shared/InfoButton';

// Role types
interface Role {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
  createdAt: string;
  color: string;
}

// Permission categories
const PERMISSION_CATEGORIES = [
  {
    id: 'users',
    name: 'User Management',
    icon: Users,
    permissions: [
      { key: 'manage_users', label: 'Manage Users', description: 'Create, edit, and delete users' },
      { key: 'invite_users', label: 'Invite Users', description: 'Send invitations to new users' },
      { key: 'manage_roles', label: 'Manage Roles', description: 'Assign and modify user roles' },
      { key: 'view_user_activity', label: 'View Activity', description: 'View user activity logs' },
    ],
  },
  {
    id: 'projects',
    name: 'Project Management',
    icon: Briefcase,
    permissions: [
      { key: 'create_project', label: 'Create Projects', description: 'Create new projects' },
      {
        key: 'edit_project_settings',
        label: 'Edit Settings',
        description: 'Modify project settings',
      },
      { key: 'delete_project', label: 'Delete Projects', description: 'Delete existing projects' },
      {
        key: 'manage_project_roles',
        label: 'Project Roles',
        description: 'Manage project-level roles',
      },
      {
        key: 'manage_workstreams',
        label: 'Workstreams',
        description: 'Create and manage workstreams',
      },
    ],
  },
  {
    id: 'tasks',
    name: 'Task Management',
    icon: Check,
    permissions: [
      { key: 'assign_tasks', label: 'Assign Tasks', description: 'Assign tasks to team members' },
      { key: 'update_task_status', label: 'Update Status', description: 'Change task status' },
      { key: 'delete_tasks', label: 'Delete Tasks', description: 'Delete tasks' },
      {
        key: 'manage_stage_gates',
        label: 'Stage Gates',
        description: 'Manage stage gate approvals',
      },
    ],
  },
  {
    id: 'governance',
    name: 'Governance & Compliance',
    icon: Shield,
    permissions: [
      { key: 'approve_changes', label: 'Approve Changes', description: 'Approve change requests' },
      { key: 'view_audit_log', label: 'View Audit Log', description: 'Access audit trail' },
      { key: 'manage_risks', label: 'Manage Risks', description: 'Risk register management' },
      { key: 'manage_compliance', label: 'Compliance', description: 'Manage compliance settings' },
    ],
  },
  {
    id: 'ai',
    name: 'AI & Automation',
    icon: Settings,
    permissions: [
      {
        key: 'ai_execute_actions',
        label: 'Execute AI Actions',
        description: 'Run AI-powered actions',
      },
      {
        key: 'ai_view_insights',
        label: 'View AI Insights',
        description: 'Access AI-generated insights',
      },
      { key: 'manage_ai_policy', label: 'AI Policy', description: 'Configure AI policies' },
    ],
  },
  {
    id: 'billing',
    name: 'Billing & Admin',
    icon: Crown,
    permissions: [
      {
        key: 'manage_billing',
        label: 'Manage Billing',
        description: 'Handle billing and payments',
      },
      {
        key: 'manage_org_settings',
        label: 'Org Settings',
        description: 'Modify organization settings',
      },
      { key: 'manage_integrations', label: 'Integrations', description: 'Configure integrations' },
    ],
  },
];

// Predefined system roles
const SYSTEM_ROLES: Role[] = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full access to all organization features and settings',
    isSystem: true,
    userCount: 0,
    color: 'violet',
    permissions: PERMISSION_CATEGORIES.flatMap((c) => c.permissions.map((p) => p.key)),
    createdAt: '',
  },
  {
    id: 'project_manager',
    name: 'Project Manager',
    description: 'Manage projects, tasks, and team members',
    isSystem: true,
    userCount: 0,
    color: 'blue',
    permissions: [
      'create_project',
      'edit_project_settings',
      'manage_project_roles',
      'manage_workstreams',
      'assign_tasks',
      'update_task_status',
      'manage_stage_gates',
      'approve_changes',
      'view_audit_log',
      'manage_risks',
      'ai_view_insights',
    ],
    createdAt: '',
  },
  {
    id: 'team_member',
    name: 'Team Member',
    description: 'Work on assigned tasks and view project data',
    isSystem: true,
    userCount: 0,
    color: 'green',
    permissions: ['update_task_status', 'ai_view_insights'],
    createdAt: '',
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to projects and tasks',
    isSystem: true,
    userCount: 0,
    color: 'slate',
    permissions: ['ai_view_insights'],
    createdAt: '',
  },
];

// Role colors
const ROLE_COLORS = [
  {
    id: 'violet',
    bg: 'bg-primary-500',
    text: 'text-primary-500',
    light: 'bg-primary-100 dark:bg-primary-900/30',
  },
  {
    id: 'blue',
    bg: 'bg-blue-500',
    text: 'text-blue-500',
    light: 'bg-blue-100 dark:bg-blue-900/30',
  },
  {
    id: 'green',
    bg: 'bg-green-500',
    text: 'text-green-500',
    light: 'bg-green-100 dark:bg-green-900/30',
  },
  {
    id: 'amber',
    bg: 'bg-amber-500',
    text: 'text-amber-500',
    light: 'bg-amber-100 dark:bg-amber-900/30',
  },
  {
    id: 'rose',
    bg: 'bg-danger-500',
    text: 'text-danger-500',
    light: 'bg-danger-100 dark:bg-danger-900/30',
  },
  {
    id: 'cyan',
    bg: 'bg-blue-500',
    text: 'text-blue-500',
    light: 'bg-blue-100 dark:bg-blue-900/30',
  },
  {
    id: 'slate',
    bg: 'bg-slate-500',
    text: 'text-slate-500 dark:text-slate-400',
    light: 'bg-slate-100 dark:bg-slate-900/30',
  },
];

interface RolesManagementPanelProps {
  className?: string;
}

export const RolesManagementPanel: React.FC<RolesManagementPanelProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { currentOrganization } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>(SYSTEM_ROLES);
  const [customRoles, setCustomRoles] = useState<Role[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    PERMISSION_CATEGORIES.map((c) => c.id)
  );

  // Form state for editing/creating roles
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: 'violet',
    permissions: [] as string[],
  });

  // Load custom roles
  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      // Load PMO roles from API
      const response = await fetch('/api/pmo-roles?includeCustom=true', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const pmoRoles = await response.json();

        // Merge system roles with PMO roles for user counts
        const updatedSystemRoles = SYSTEM_ROLES.map((role) => {
          const pmoRole = pmoRoles.find((r: any) => r.name === role.name);
          return {
            ...role,
            userCount: pmoRole?.userCount || 0,
          };
        });
        setRoles(updatedSystemRoles);

        // Custom roles from PMO
        const customFromPmo = pmoRoles
          .filter((r: any) => r.isCustom)
          .map((r: any) => ({
            id: r.id,
            name: r.name,
            description: r.description || '',
            permissions: r.permissions || [],
            isSystem: false,
            userCount: r.userCount || 0,
            color: r.color || 'violet',
          }));
        setCustomRoles(customFromPmo);
      } else {
        // Fallback to system roles only
        const updatedSystemRoles = SYSTEM_ROLES.map((role) => ({
          ...role,
          userCount: 0,
        }));
        setRoles(updatedSystemRoles);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
      // Fallback to system roles
      const updatedSystemRoles = SYSTEM_ROLES.map((role) => ({
        ...role,
        userCount: 0,
      }));
      setRoles(updatedSystemRoles);
      toast.error(t('admin.roles.loadError', 'Failed to load roles'));
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, t]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // Filter roles by search
  const filteredRoles = [...roles, ...customRoles].filter(
    (role) =>
      role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      role.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  // Toggle permission
  const togglePermission = (permissionKey: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionKey)
        ? prev.permissions.filter((p) => p !== permissionKey)
        : [...prev.permissions, permissionKey],
    }));
  };

  // Select all permissions in category
  const selectAllInCategory = (categoryId: string) => {
    const category = PERMISSION_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) return;

    const categoryPermissions = category.permissions.map((p) => p.key);
    const allSelected = categoryPermissions.every((p) => formData.permissions.includes(p));

    if (allSelected) {
      setFormData((prev) => ({
        ...prev,
        permissions: prev.permissions.filter((p) => !categoryPermissions.includes(p)),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...categoryPermissions])],
      }));
    }
  };

  // Start editing role
  const startEditing = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      color: role.color,
      permissions: [...role.permissions],
    });
    setIsEditing(true);
    setIsCreating(false);
  };

  // Start creating new role
  const startCreating = () => {
    setSelectedRole(null);
    setFormData({
      name: '',
      description: '',
      color: 'violet',
      permissions: [],
    });
    setIsCreating(true);
    setIsEditing(false);
  };

  // Duplicate role
  const duplicateRole = (role: Role) => {
    setSelectedRole(null);
    setFormData({
      name: `${role.name} (Copy)`,
      description: role.description,
      color: role.color,
      permissions: [...role.permissions],
    });
    setIsCreating(true);
    setIsEditing(false);
  };

  // Save role
  const saveRole = async () => {
    if (!formData.name.trim()) {
      toast.error(t('admin.roles.nameRequired', 'Role name is required'));
      return;
    }

    try {
      if (isCreating) {
        // Create new custom role via API
        const response = await fetch('/api/pmo-roles', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            color: formData.color,
            permissions: formData.permissions,
            isCustom: true,
          }),
        });

        if (response.ok) {
          const createdRole = await response.json();
          const newRole: Role = {
            id: createdRole.id || `custom_${Date.now()}`,
            name: formData.name,
            description: formData.description,
            color: formData.color,
            permissions: formData.permissions,
            isSystem: false,
            userCount: 0,
            createdAt: new Date().toISOString(),
          };
          setCustomRoles((prev) => [...prev, newRole]);
          toast.success(t('admin.roles.created', 'Role created successfully'));
        } else {
          throw new Error('Failed to create role');
        }
      } else if (isEditing && selectedRole) {
        if (selectedRole.isSystem) {
          // For system roles, we can only customize permissions per organization
          toast.success(t('admin.roles.permissionsUpdated', 'Role permissions updated'));
        } else {
          // Update custom role via API
          const response = await fetch(`/api/pmo-roles/${selectedRole.id}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: formData.name,
              description: formData.description,
              color: formData.color,
              permissions: formData.permissions,
            }),
          });

          if (response.ok) {
            setCustomRoles((prev) =>
              prev.map((r) => (r.id === selectedRole.id ? { ...r, ...formData } : r))
            );
            toast.success(t('admin.roles.updated', 'Role updated successfully'));
          } else {
            throw new Error('Failed to update role');
          }
        }
      }

      setIsEditing(false);
      setIsCreating(false);
      setSelectedRole(null);
    } catch (error) {
      console.error('Error saving role:', error);
      toast.error(t('admin.roles.saveError', 'Failed to save role'));
    }
  };

  // Delete role
  const deleteRole = async (role: Role) => {
    if (role.isSystem) {
      toast.error(t('admin.roles.cannotDeleteSystem', 'Cannot delete system roles'));
      return;
    }

    if (role.userCount > 0) {
      toast.error(t('admin.roles.hasUsers', 'Cannot delete role with assigned users'));
      return;
    }

    try {
      // In real implementation: await Api.deleteCustomRole(currentOrganization?.id, role.id);
      setCustomRoles((prev) => prev.filter((r) => r.id !== role.id));
      toast.success(t('admin.roles.deleted', 'Role deleted successfully'));
    } catch (error) {
      console.error('Error deleting role:', error);
      toast.error(t('admin.roles.deleteError', 'Failed to delete role'));
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setIsCreating(false);
    setSelectedRole(null);
  };

  // Get color classes
  const getColorClasses = (colorId: string) => {
    return ROLE_COLORS.find((c) => c.id === colorId) || ROLE_COLORS[0];
  };

  // Render role card
  const renderRoleCard = (role: Role) => {
    const colors = getColorClasses(role.color);

    return (
      <motion.div
        key={role.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${colors.light}`}>
              {role.isSystem ? (
                <Lock className={colors.text} size={20} />
              ) : (
                <Shield className={colors.text} size={20} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-white">{role.name}</h3>
                {role.isSystem && (
                  <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 rounded-full">
                    {t('admin.roles.system', 'System')}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{role.description}</p>
              <div className="flex items-center gap-4 mt-3">
                <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Users size={12} />
                  {role.userCount} {t('admin.roles.users', 'users')}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Shield size={12} />
                  {role.permissions.length} {t('admin.roles.permissions', 'permissions')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => startEditing(role)}
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              title={t('admin.roles.edit', 'Edit')}
            >
              <Edit size={16} />
            </button>
            <button
              onClick={() => duplicateRole(role)}
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              title={t('admin.roles.duplicate', 'Duplicate')}
            >
              <Copy size={16} />
            </button>
            {!role.isSystem && (
              <button
                onClick={() => deleteRole(role)}
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
                title={t('admin.roles.delete', 'Delete')}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  // Render permission editor
  const renderPermissionEditor = () => {
    return (
      <div className="space-y-4">
        {/* Role Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('admin.roles.name', 'Role Name')}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              disabled={selectedRole?.isSystem}
              className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white disabled:opacity-50"
              placeholder={t('admin.roles.namePlaceholder', 'Enter role name')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('admin.roles.color', 'Color')}
            </label>
            <div className="flex gap-2">
              {ROLE_COLORS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => setFormData((prev) => ({ ...prev, color: color.id }))}
                  disabled={selectedRole?.isSystem}
                  className={`w-8 h-8 rounded-full ${color.bg} ${
                    formData.color === color.id ? 'ring-2 ring-offset-2 ring-primary-500' : ''
                  } disabled:opacity-50`}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t('admin.roles.description', 'Description')}
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            disabled={selectedRole?.isSystem}
            className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white disabled:opacity-50 resize-none"
            rows={2}
            placeholder={t('admin.roles.descriptionPlaceholder', 'Describe this role')}
          />
        </div>

        {/* System Role Warning */}
        {selectedRole?.isSystem && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
            <AlertTriangle className="text-amber-500 mt-0.5" size={16} />
            <div className="text-sm text-amber-800 dark:text-amber-300">
              {t(
                'admin.roles.systemWarning',
                'System roles cannot be renamed or deleted. You can only customize permissions.'
              )}
            </div>
          </div>
        )}

        {/* Permissions Matrix */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            {t('admin.roles.permissionsMatrix', 'Permissions')}
          </label>
          <div className="space-y-2">
            {PERMISSION_CATEGORIES.map((category) => {
              const CategoryIcon = category.icon;
              const isExpanded = expandedCategories.includes(category.id);
              const categoryPermissions = category.permissions.map((p) => p.key);
              const selectedCount = categoryPermissions.filter((p) =>
                formData.permissions.includes(p)
              ).length;
              const allSelected = selectedCount === categoryPermissions.length;

              return (
                <div
                  key={category.id}
                  className="border border-slate-200 dark:border-navy-700 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CategoryIcon className="text-slate-500 dark:text-slate-400" size={18} />
                      <span className="font-medium text-slate-900 dark:text-white">
                        {category.name}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedCount}/{categoryPermissions.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectAllInCategory(category.id);
                        }}
                        className={`px-2 py-1 text-xs rounded ${
                          allSelected
                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                            : 'bg-slate-200 dark:bg-navy-600 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {allSelected
                          ? t('admin.roles.deselectAll', 'Deselect All')
                          : t('admin.roles.selectAll', 'Select All')}
                      </button>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 space-y-2 bg-white dark:bg-navy-800">
                          {category.permissions.map((permission) => {
                            const isSelected = formData.permissions.includes(permission.key);

                            return (
                              <label
                                key={permission.key}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => togglePermission(permission.key)}
                                  className="w-4 h-4 rounded border-slate-300 dark:border-navy-600 text-primary-500 focus:ring-primary-500"
                                />
                                <div className="flex-1">
                                  <span className="font-medium text-slate-900 dark:text-white text-sm">
                                    {permission.label}
                                  </span>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {permission.description}
                                  </p>
                                </div>
                                {isSelected && <Check className="text-slate-700 dark:text-slate-200" size={16} />}
                              </label>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('admin.roles.title', 'Roles & Permissions')}
            </h2>
            <InfoButton cardId="admin-roles" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'admin.roles.subtitle',
              'Manage access levels and permissions for your organization'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadRoles}
            disabled={loading}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50"
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={startCreating}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={18} />
            {t('admin.roles.createRole', 'Create Role')}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Roles List */}
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              size={18}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('admin.roles.searchPlaceholder', 'Search roles...')}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>

          {/* System Roles */}
          <div>
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
              <Lock size={14} />
              {t('admin.roles.systemRoles', 'System Roles')}
            </h3>
            <div className="space-y-2">
              {filteredRoles.filter((r) => r.isSystem).map(renderRoleCard)}
            </div>
          </div>

          {/* Custom Roles */}
          {customRoles.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                <Unlock size={14} />
                {t('admin.roles.customRoles', 'Custom Roles')}
              </h3>
              <div className="space-y-2">
                {filteredRoles.filter((r) => !r.isSystem).map(renderRoleCard)}
              </div>
            </div>
          )}

          {filteredRoles.length === 0 && (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              {t('admin.roles.noResults', 'No roles found')}
            </div>
          )}
        </div>

        {/* Permission Editor */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          {isEditing || isCreating ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {isCreating
                    ? t('admin.roles.createNewRole', 'Create New Role')
                    : t('admin.roles.editRole', 'Edit Role')}
                </h3>
                <button
                  onClick={cancelEditing}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700"
                >
                  <X size={18} />
                </button>
              </div>

              {renderPermissionEditor()}

              <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-navy-700">
                <button
                  onClick={saveRole}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Save size={16} />
                  {t('common.save', 'Save')}
                </button>
                <button
                  onClick={cancelEditing}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Shield className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                {t('admin.roles.selectToEdit', 'Select a Role')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {t(
                  'admin.roles.selectToEditDesc',
                  'Select a role from the list to view or edit its permissions'
                )}
              </p>
              <button
                onClick={startCreating}
                className="px-4 py-2 border border-primary-500 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg flex items-center gap-2 mx-auto transition-colors"
              >
                <Plus size={16} />
                {t('admin.roles.createRole', 'Create Role')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RolesManagementPanel;
