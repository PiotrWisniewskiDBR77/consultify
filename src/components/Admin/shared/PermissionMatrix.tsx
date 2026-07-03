/**
 * PermissionMatrix - Slack-style permission matrix component
 *
 * Features:
 * - Table: Permissions (rows) × Roles (columns)
 * - Checkboxes for toggling
 * - Search bar: "Filter by name or keyword..."
 * - Bulk actions: "Grant all to role", "Revoke all from role"
 * - Permission categories (grouped rows)
 * - Expandable sections
 *
 * Design: Slack-style permission matrix
 */

import {
  Check,
  ChevronDown,
  ChevronRight,
  Filter,
  HelpCircle,
  Lock,
  Minus,
  Search,
  Shield,
  Unlock,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Permission definition
export interface Permission {
  id: string;
  name: string;
  description?: string;
  category: string;
  isSystem?: boolean;
}

// Role definition
export interface Role {
  id: string;
  name: string;
  isSystem?: boolean;
  color?: string;
}

// Permission-role mapping
export interface PermissionMapping {
  permissionId: string;
  roleId: string;
  granted: boolean;
}

interface PermissionMatrixProps {
  permissions: Permission[];
  roles: Role[];
  mappings: PermissionMapping[];
  onToggle: (permissionId: string, roleId: string, granted: boolean) => void;
  onBulkGrant?: (roleId: string, permissionIds: string[]) => void;
  onBulkRevoke?: (roleId: string, permissionIds: string[]) => void;
  readOnly?: boolean;
  className?: string;
}

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  permissions,
  roles,
  mappings,
  onToggle,
  onBulkGrant,
  onBulkRevoke,
  readOnly = false,
  className,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Group permissions by category
  const permissionsByCategory = useMemo(() => {
    const groups: Record<string, Permission[]> = {};
    permissions.forEach((perm) => {
      if (!groups[perm.category]) {
        groups[perm.category] = [];
      }
      groups[perm.category].push(perm);
    });
    return groups;
  }, [permissions]);

  // Filter permissions by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return permissionsByCategory;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, Permission[]> = {};

    Object.entries(permissionsByCategory).forEach(([category, perms]) => {
      const matchingPerms = perms.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          category.toLowerCase().includes(query)
      );
      if (matchingPerms.length > 0) {
        filtered[category] = matchingPerms;
      }
    });

    return filtered;
  }, [permissionsByCategory, searchQuery]);

  // Get all categories
  const categories = useMemo(() => Object.keys(filteredCategories).sort(), [filteredCategories]);

  // Initialize all categories as expanded when searching
  React.useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedCategories(new Set(categories));
    }
  }, [searchQuery, categories]);

  // Get mapping for a permission-role pair
  const getMapping = useCallback(
    (permissionId: string, roleId: string): boolean => {
      const mapping = mappings.find((m) => m.permissionId === permissionId && m.roleId === roleId);
      return mapping?.granted ?? false;
    },
    [mappings]
  );

  // Toggle category expansion
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Handle checkbox toggle
  const handleToggle = useCallback(
    (permissionId: string, roleId: string) => {
      if (readOnly) return;
      const current = getMapping(permissionId, roleId);
      onToggle(permissionId, roleId, !current);
    },
    [readOnly, getMapping, onToggle]
  );

  // Calculate role stats
  const getRoleStats = useCallback(
    (roleId: string, categoryPerms: Permission[]) => {
      const granted = categoryPerms.filter((p) => getMapping(p.id, roleId)).length;
      return { granted, total: categoryPerms.length };
    },
    [getMapping]
  );

  // Handle bulk grant for a category
  const handleBulkGrant = useCallback(
    (roleId: string, categoryPerms: Permission[]) => {
      if (readOnly || !onBulkGrant) return;
      const permissionIds = categoryPerms.map((p) => p.id);
      onBulkGrant(roleId, permissionIds);
    },
    [readOnly, onBulkGrant]
  );

  // Handle bulk revoke for a category
  const handleBulkRevoke = useCallback(
    (roleId: string, categoryPerms: Permission[]) => {
      if (readOnly || !onBulkRevoke) return;
      const permissionIds = categoryPerms.map((p) => p.id);
      onBulkRevoke(roleId, permissionIds);
    },
    [readOnly, onBulkRevoke]
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('admin.permissions.searchPlaceholder', 'Filter by name or keyword...')}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-navy-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Expand/Collapse All */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpandedCategories(new Set(categories))}
            className="text-sm text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
          >
            {t('admin.permissions.expandAll', 'Expand all')}
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={() => setExpandedCategories(new Set())}
            className="text-sm text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
          >
            {t('admin.permissions.collapseAll', 'Collapse all')}
          </button>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto border border-slate-200 dark:border-navy-700 rounded-xl">
        <table /* §27-exempt: macierz/komorki kalkulacyjne, osobny spec matrix-editor */  className="w-full">
          {/* Header */}
          <thead className="bg-slate-50 dark:bg-navy-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[250px]">
                {t('admin.permissions.permission', 'Permission')}
              </th>
              {roles.map((role) => (
                <th
                  key={role.id}
                  className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[100px]"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px]',
                        role.color || 'bg-slate-200 dark:bg-navy-700'
                      )}
                    >
                      {role.name}
                    </span>
                    {role.isSystem && (
                      <Lock size={10} className="text-slate-400 dark:text-slate-500" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body - Categories */}
          <tbody className="bg-white dark:bg-navy-800">
            {categories.length === 0 ? (
              <tr>
                <td
                  colSpan={roles.length + 1}
                  className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                >
                  {t('admin.permissions.noResults', 'No permissions found')}
                </td>
              </tr>
            ) : (
              categories.map((category) => {
                const categoryPerms = filteredCategories[category];
                const isExpanded = expandedCategories.has(category);

                return (
                  <React.Fragment key={category}>
                    {/* Category Header Row */}
                    <tr className="bg-slate-100 dark:bg-navy-900/50 border-t border-slate-200 dark:border-navy-700">
                      <td className="px-4 py-2">
                        <button
                          onClick={() => toggleCategory(category)}
                          className="flex items-center gap-2 text-sm font-semibold text-navy-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          {category}
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                            ({categoryPerms.length})
                          </span>
                        </button>
                      </td>
                      {roles.map((role) => {
                        const stats = getRoleStats(role.id, categoryPerms);
                        const allGranted = stats.granted === stats.total;
                        const someGranted = stats.granted > 0 && stats.granted < stats.total;

                        return (
                          <td key={role.id} className="px-4 py-2 text-center">
                            {!readOnly && (
                              <Tooltip
                                content={
                                  allGranted
                                    ? t('admin.permissions.revokeAll', 'Revoke all in category')
                                    : t('admin.permissions.grantAll', 'Grant all in category')
                                }
                              >
                                <button
                                  onClick={() =>
                                    allGranted
                                      ? handleBulkRevoke(role.id, categoryPerms)
                                      : handleBulkGrant(role.id, categoryPerms)
                                  }
                                  className={cn(
                                    'w-6 h-6 rounded flex items-center justify-center transition-all',
                                    allGranted
                                      ? 'bg-primary-600 text-white'
                                      : someGranted
                                        ? 'bg-primary-200 dark:bg-primary-900/50 text-primary-600'
                                        : 'bg-slate-200 dark:bg-navy-700 text-slate-400 dark:text-slate-500 hover:bg-slate-300 dark:hover:bg-navy-600'
                                  )}
                                >
                                  {allGranted ? (
                                    <Check size={14} />
                                  ) : someGranted ? (
                                    <Minus size={14} />
                                  ) : null}
                                </button>
                              </Tooltip>
                            )}
                            {readOnly && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {stats.granted}/{stats.total}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Permission Rows */}
                    {isExpanded &&
                      categoryPerms.map((permission) => (
                        <tr
                          key={permission.id}
                          className="border-t border-slate-100 dark:border-navy-700/50 hover:bg-slate-50 dark:hover:bg-navy-800/50"
                        >
                          <td className="px-4 py-2.5 pl-10">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-navy-900 dark:text-white">
                                {permission.name}
                              </span>
                              {permission.description && (
                                <Tooltip content={permission.description}>
                                  <HelpCircle
                                    size={14}
                                    className="text-slate-400 dark:text-slate-500"
                                  />
                                </Tooltip>
                              )}
                              {permission.isSystem && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400 rounded">
                                  System
                                </span>
                              )}
                            </div>
                          </td>
                          {roles.map((role) => {
                            const granted = getMapping(permission.id, role.id);
                            const isLocked = permission.isSystem || role.isSystem;

                            return (
                              <td key={role.id} className="px-4 py-2.5 text-center">
                                <button
                                  onClick={() => !isLocked && handleToggle(permission.id, role.id)}
                                  disabled={readOnly || isLocked}
                                  className={cn(
                                    'w-5 h-5 rounded flex items-center justify-center transition-all',
                                    granted
                                      ? 'bg-primary-600 text-white'
                                      : 'bg-slate-200 dark:bg-navy-700',
                                    !readOnly &&
                                      !isLocked &&
                                      'cursor-pointer hover:ring-2 hover:ring-primary-500/20',
                                    (readOnly || isLocked) && 'cursor-not-allowed opacity-60'
                                  )}
                                >
                                  {granted && <Check size={12} />}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-c-surface flex items-center justify-center">
            <Check size={10} className="text-c-text" />
          </div>
          <span>{t('admin.permissions.legend.granted', 'Granted')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-primary-200 dark:bg-primary-900/50 flex items-center justify-center">
            <Minus size={10} className="text-primary-600" />
          </div>
          <span>{t('admin.permissions.legend.partial', 'Partial')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-slate-200 dark:bg-navy-700" />
          <span>{t('admin.permissions.legend.denied', 'Not granted')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock size={12} />
          <span>{t('admin.permissions.legend.system', 'System (read-only)')}</span>
        </div>
      </div>
    </div>
  );
};

export default PermissionMatrix;
