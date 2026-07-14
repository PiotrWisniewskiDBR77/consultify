/**
 * AccountTypesManager - Account types system component
 *
 * Features:
 * - Account type cards: Guest, Member, Admin, Owner
 * - View/edit permissions for each type
 * - Assign users to account types
 * - Visual comparison of capabilities
 *
 * Design: Card grid with permission comparison matrix
 */

import {
  Check,
  ChevronRight,
  Crown,
  Edit2,
  Eye,
  HelpCircle,
  Shield,
  ShieldCheck,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Account type definition
export interface AccountType {
  id: 'guest' | 'member' | 'admin' | 'owner';
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  userCount: number;
  permissions: Record<string, boolean>;
  canBeAssigned: boolean;
  isDefault?: boolean;
}

// Permission category
export interface PermissionCategory {
  id: string;
  name: string;
  permissions: {
    id: string;
    name: string;
    description?: string;
  }[];
}

interface AccountTypesManagerProps {
  accountTypes: AccountType[];
  permissionCategories: PermissionCategory[];
  onViewUsers?: (accountTypeId: string) => void;
  onEditType?: (accountType: AccountType) => void;
  className?: string;
}

// Default account types
const defaultAccountTypes: AccountType[] = [
  {
    id: 'guest',
    name: 'Guest',
    description: 'Limited access for external collaborators',
    icon: Eye,
    color: 'slate',
    userCount: 0,
    canBeAssigned: true,
    permissions: {},
  },
  {
    id: 'member',
    name: 'Member',
    description: 'Standard team member with full workspace access',
    icon: User,
    color: 'blue',
    userCount: 0,
    canBeAssigned: true,
    isDefault: true,
    permissions: {},
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Full administrative access to workspace settings',
    icon: ShieldCheck,
    color: 'violet',
    userCount: 0,
    canBeAssigned: true,
    permissions: {},
  },
  {
    id: 'owner',
    name: 'Owner',
    description: 'Complete control over the organization',
    icon: Crown,
    color: 'amber',
    userCount: 0,
    canBeAssigned: false,
    permissions: {},
  },
];

// Default permission categories
const defaultPermissionCategories: PermissionCategory[] = [
  {
    id: 'workspace',
    name: 'Workspace',
    permissions: [
      { id: 'view_workspace', name: 'View workspace' },
      { id: 'create_projects', name: 'Create projects' },
      { id: 'delete_projects', name: 'Delete projects' },
      { id: 'manage_workspace', name: 'Manage workspace settings' },
    ],
  },
  {
    id: 'team',
    name: 'Team',
    permissions: [
      { id: 'view_members', name: 'View team members' },
      { id: 'invite_members', name: 'Invite members' },
      { id: 'remove_members', name: 'Remove members' },
      { id: 'manage_roles', name: 'Manage roles' },
    ],
  },
  {
    id: 'billing',
    name: 'Billing',
    permissions: [
      { id: 'view_billing', name: 'View billing' },
      { id: 'manage_billing', name: 'Manage billing' },
      { id: 'manage_subscriptions', name: 'Manage subscriptions' },
    ],
  },
  {
    id: 'security',
    name: 'Security',
    permissions: [
      { id: 'view_audit_logs', name: 'View audit logs' },
      { id: 'manage_security', name: 'Manage security settings' },
      { id: 'manage_sso', name: 'Configure SSO' },
    ],
  },
];

export const AccountTypesManager: React.FC<AccountTypesManagerProps> = ({
  accountTypes = defaultAccountTypes,
  permissionCategories = defaultPermissionCategories,
  onViewUsers,
  onEditType,
  className,
}) => {
  const { t } = useTranslation();
  const [showComparison, setShowComparison] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Get color classes
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'slate':
        return {
          bg: 'bg-slate-100 dark:bg-slate-800',
          text: 'text-slate-600 dark:text-slate-400',
          border: 'border-slate-200 dark:border-slate-700',
          gradient: 'from-slate-500 to-slate-600',
        };
      case 'blue':
        return {
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          text: 'text-blue-600 dark:text-blue-400',
          border: 'border-blue-200 dark:border-blue-800',
          gradient: 'from-blue-500 to-blue-600',
        };
      case 'violet':
        return {
          bg: 'bg-primary-100 dark:bg-primary-900/30',
          text: 'text-primary-600 dark:text-primary-400',
          border: 'border-primary-200 dark:border-primary-800',
          gradient: 'from-primary-500 to-primary-600',
        };
      case 'amber':
        return {
          bg: 'bg-amber-100 dark:bg-amber-900/30',
          text: 'text-amber-600 dark:text-amber-400',
          border: 'border-amber-200 dark:border-amber-800',
          gradient: 'from-amber-500 to-amber-600',
        };
      default:
        return {
          bg: 'bg-slate-100 dark:bg-slate-800',
          text: 'text-slate-600 dark:text-slate-400',
          border: 'border-slate-200 dark:border-slate-700',
          gradient: 'from-slate-500 to-slate-600',
        };
    }
  };

  // Total users
  const totalUsers = useMemo(() => {
    return accountTypes.reduce((sum, type) => sum + type.userCount, 0);
  }, [accountTypes]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
            {t('admin.team.accountTypes.title', 'Account Types')}
            <Tooltip
              content={t(
                'admin.team.accountTypes.tooltip',
                'Different account types have different levels of access and permissions'
              )}
            >
              <HelpCircle size={16} className="text-slate-400 dark:text-slate-500" />
            </Tooltip>
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t(
              'admin.team.accountTypes.subtitle',
              '{{count}} users across {{types}} account types',
              {
                count: totalUsers,
                types: accountTypes.length,
              }
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowComparison(!showComparison)}>
          {showComparison
            ? t('admin.team.accountTypes.hideComparison', 'Hide Comparison')
            : t('admin.team.accountTypes.showComparison', 'Compare Permissions')}
        </Button>
      </div>

      {/* Account Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {accountTypes.map((type) => {
          const colors = getColorClasses(type.color);
          const Icon = type.icon;
          const isSelected = selectedType === type.id;

          return (
            <div
              key={type.id}
              className={cn(
                'relative p-4 bg-white dark:bg-navy-800 rounded-xl border transition-all cursor-pointer',
                isSelected
                  ? `${colors.border} ring-2 ring-${type.color}-500/20`
                  : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
              )}
              onClick={() => setSelectedType(isSelected ? null : type.id)}
            >
              {/* Default Badge */}
              {type.isDefault && (
                <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">
                  {t('admin.team.accountTypes.default', 'Default')}
                </span>
              )}

              {/* Icon */}
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center mb-4',
                  `bg-gradient-to-br ${colors.gradient}`
                )}
              >
                <Icon size={24} className="text-c-text" />
              </div>

              {/* Info */}
              <h4 className="font-semibold text-navy-900 dark:text-white mb-1">{type.name}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{type.description}</p>

              {/* User Count */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-slate-400 dark:text-slate-500" />
                  <span className="text-sm font-medium text-navy-900 dark:text-white">
                    {type.userCount}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('admin.team.accountTypes.users', 'users')}
                  </span>
                </div>
                {onViewUsers && type.userCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewUsers(type.id);
                    }}
                    className="h-7 px-2"
                  >
                    <ChevronRight size={14} />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Permission Comparison Matrix */}
      {showComparison && (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-navy-700">
            <h4 className="font-semibold text-navy-900 dark:text-white">
              {t('admin.team.accountTypes.permissionComparison', 'Permission Comparison')}
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table
              /* §27-exempt: panel konfiguracyjny/billingowy, mala tabela ustawien poza zakresem listowym */ className="w-full"
            >
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-900">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600 dark:text-slate-400 min-w-[200px]">
                    {t('admin.team.accountTypes.permission', 'Permission')}
                  </th>
                  {accountTypes.map((type) => {
                    const colors = getColorClasses(type.color);
                    return (
                      <th key={type.id} className="px-4 py-3 text-center min-w-[100px]">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full',
                            colors.bg,
                            colors.text
                          )}
                        >
                          {type.name}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {permissionCategories.map((category) => (
                  <React.Fragment key={category.id}>
                    {/* Category Header */}
                    <tr className="bg-slate-50/50 dark:bg-navy-900/50">
                      <td colSpan={accountTypes.length + 1} className="px-4 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {category.name}
                        </span>
                      </td>
                    </tr>
                    {/* Permissions */}
                    {category.permissions.map((permission) => (
                      <tr
                        key={permission.id}
                        className="border-t border-slate-100 dark:border-navy-700"
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm text-navy-900 dark:text-white">
                            {permission.name}
                          </span>
                        </td>
                        {accountTypes.map((type) => {
                          // Default permission logic based on account type
                          let hasPermission = false;
                          if (type.id === 'owner') {
                            hasPermission = true; // Owner has all permissions
                          } else if (type.id === 'admin') {
                            hasPermission =
                              !permission.id.includes('billing') ||
                              permission.id === 'view_billing';
                          } else if (type.id === 'member') {
                            hasPermission = [
                              'view_workspace',
                              'create_projects',
                              'view_members',
                            ].includes(permission.id);
                          } else {
                            hasPermission = permission.id === 'view_workspace';
                          }

                          // Override with explicit permissions if set
                          if (type.permissions[permission.id] !== undefined) {
                            hasPermission = type.permissions[permission.id];
                          }

                          return (
                            <td
                              key={`${type.id}-${permission.id}`}
                              className="px-4 py-3 text-center"
                            >
                              {hasPermission ? (
                                <Check size={16} className="mx-auto text-emerald-500" />
                              ) : (
                                <X
                                  size={16}
                                  className="mx-auto text-slate-300 dark:text-navy-600"
                                />
                              )}
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
        </div>
      )}

      {/* Selected Type Details */}
      {selectedType && (
        <div className="p-6 bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700">
          {(() => {
            const type = accountTypes.find((t) => t.id === selectedType);
            if (!type) return null;
            const colors = getColorClasses(type.color);
            const Icon = type.icon;

            return (
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                    `bg-gradient-to-br ${colors.gradient}`
                  )}
                >
                  <Icon size={24} className="text-c-text" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-navy-900 dark:text-white">{type.name}</h4>
                    <div className="flex gap-2">
                      {onViewUsers && type.userCount > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewUsers(type.id)}
                          icon={<Users size={14} />}
                        >
                          {t('admin.team.accountTypes.viewUsers', 'View Users')}
                        </Button>
                      )}
                      {onEditType && type.id !== 'owner' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEditType(type)}
                          icon={<Edit2 size={14} />}
                        >
                          {t('admin.team.accountTypes.editType', 'Edit Type')}
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {type.description}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Users size={14} />
                      {type.userCount} {t('admin.team.accountTypes.users', 'users')}
                    </span>
                    {type.isDefault && (
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <UserCheck size={14} />
                        {t('admin.team.accountTypes.defaultForNewUsers', 'Default for new users')}
                      </span>
                    )}
                    {!type.canBeAssigned && (
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Shield size={14} />
                        {t(
                          'admin.team.accountTypes.cannotBeAssigned',
                          'Cannot be manually assigned'
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default AccountTypesManager;
