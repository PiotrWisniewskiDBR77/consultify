/**
 * FeatureFlagsManager - Feature access control system component
 *
 * Features:
 * - Feature flag list with status (enabled/disabled)
 * - Toggle individual features
 * - Rollout percentage control
 * - User/group targeting
 * - Dependency visualization
 *
 * Design: Card list with toggle controls and targeting options
 */

import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Code,
  Eye,
  Filter,
  Flag,
  HelpCircle,
  Layers,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Progress } from '../../ui/primitives/Progress';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Feature flag
export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetedUsers?: string[];
  targetedGroups?: string[];
  excludedUsers?: string[];
  dependencies?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  isNew?: boolean;
  isBeta?: boolean;
}

// Feature category
export interface FeatureCategory {
  id: string;
  name: string;
  icon: React.ElementType;
}

interface FeatureFlagsManagerProps {
  flags: FeatureFlag[];
  categories?: FeatureCategory[];
  onToggle?: (flagId: string, enabled: boolean) => void;
  onUpdateRollout?: (flagId: string, percentage: number) => void;
  onEditFlag?: (flag: FeatureFlag) => void;
  onAddFlag?: () => void;
  onDeleteFlag?: (flagId: string) => void;
  className?: string;
}

// Default categories
const defaultCategories: FeatureCategory[] = [
  { id: 'core', name: 'Core Features', icon: Layers },
  { id: 'ai', name: 'AI & Automation', icon: Sparkles },
  { id: 'ui', name: 'UI & Experience', icon: Eye },
  { id: 'integrations', name: 'Integrations', icon: Zap },
  { id: 'experimental', name: 'Experimental', icon: Code },
];

export const FeatureFlagsManager: React.FC<FeatureFlagsManagerProps> = ({
  flags,
  categories = defaultCategories,
  onToggle,
  onUpdateRollout,
  onEditFlag,
  onAddFlag,
  onDeleteFlag,
  className,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null);

  // Filter flags
  const filteredFlags = useMemo(() => {
    return flags.filter((flag) => {
      if (categoryFilter !== 'all' && flag.category !== categoryFilter) return false;
      if (statusFilter !== 'all') {
        if (statusFilter === 'enabled' && !flag.enabled) return false;
        if (statusFilter === 'disabled' && flag.enabled) return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          flag.name.toLowerCase().includes(query) ||
          flag.key.toLowerCase().includes(query) ||
          flag.description.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [flags, categoryFilter, statusFilter, searchQuery]);

  // Group by category
  const groupedFlags = useMemo(() => {
    const groups: Record<string, FeatureFlag[]> = {};
    filteredFlags.forEach((flag) => {
      if (!groups[flag.category]) {
        groups[flag.category] = [];
      }
      groups[flag.category].push(flag);
    });
    return groups;
  }, [filteredFlags]);

  // Stats
  const stats = useMemo(() => {
    const total = flags.length;
    const enabled = flags.filter((f) => f.enabled).length;
    const beta = flags.filter((f) => f.isBeta).length;
    const rolling = flags.filter((f) => f.enabled && f.rolloutPercentage < 100).length;
    return { total, enabled, disabled: total - enabled, beta, rolling };
  }, [flags]);

  // Handle rollout change
  const handleRolloutChange = useCallback(
    (flagId: string, value: number) => {
      onUpdateRollout?.(flagId, Math.min(100, Math.max(0, value)));
    },
    [onUpdateRollout]
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.features.total', 'Total Features')}
            </span>
            <Flag size={16} className="text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-navy-900 dark:text-white">{stats.total}</p>
        </div>

        <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.features.enabled', 'Enabled')}
            </span>
            <ToggleRight size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.enabled}
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.features.rolling', 'Rolling Out')}
            </span>
            <Percent size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.rolling}</p>
        </div>

        <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.features.beta', 'Beta')}
            </span>
            <Sparkles size={16} className="text-primary-500" />
          </div>
          <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{stats.beta}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('admin.features.searchPlaceholder', 'Search features...')}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
          >
            <option value="all">{t('admin.features.allCategories', 'All Categories')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'enabled' | 'disabled')}
            className="px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
          >
            <option value="all">{t('admin.features.allStatus', 'All Status')}</option>
            <option value="enabled">{t('admin.features.enabled', 'Enabled')}</option>
            <option value="disabled">{t('admin.features.disabled', 'Disabled')}</option>
          </select>

          {onAddFlag && (
            <Button onClick={onAddFlag} icon={<Plus size={16} />}>
              {t('admin.features.addFlag', 'Add Feature')}
            </Button>
          )}
        </div>
      </div>

      {/* Feature Flags List */}
      <div className="space-y-6">
        {Object.entries(groupedFlags).map(([categoryId, categoryFlags]) => {
          const category = categories.find((c) => c.id === categoryId);
          const Icon = category?.icon || Flag;

          return (
            <div
              key={categoryId}
              className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden"
            >
              {/* Category Header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
                <Icon size={18} className="text-slate-500 dark:text-slate-400" />
                <span className="font-medium text-navy-900 dark:text-white">
                  {category?.name || categoryId}
                </span>
                <span className="px-2 py-0.5 text-xs bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400 rounded-full">
                  {categoryFlags.length}
                </span>
              </div>

              {/* Flags */}
              <div className="divide-y divide-slate-200 dark:divide-navy-700">
                {categoryFlags.map((flag) => {
                  const isExpanded = expandedFlag === flag.id;

                  return (
                    <div key={flag.id}>
                      <div className="flex items-center gap-4 p-4">
                        {/* Toggle */}
                        <button
                          onClick={() => onToggle?.(flag.id, !flag.enabled)}
                          className={cn(
                            'relative w-12 h-6 rounded-full transition-colors flex-shrink-0',
                            flag.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-navy-600'
                          )}
                        >
                          <span
                            className={cn(
                              'absolute top-1 w-4 h-4 bg-white dark:bg-navy-900 rounded-full shadow transition-transform',
                              flag.enabled ? 'left-7' : 'left-1'
                            )}
                          />
                        </button>

                        {/* Info */}
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => setExpandedFlag(isExpanded ? null : flag.id)}
                        >
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-navy-900 dark:text-white truncate">
                              {flag.name}
                            </h4>
                            {flag.isNew && (
                              <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                {t('admin.features.new', 'NEW')}
                              </span>
                            )}
                            {flag.isBeta && (
                              <span className="px-1.5 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                                {t('admin.features.beta', 'BETA')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                            {flag.description}
                          </p>
                        </div>

                        {/* Key */}
                        <code className="hidden md:block px-2 py-1 text-xs bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 rounded font-mono">
                          {flag.key}
                        </code>

                        {/* Rollout */}
                        {flag.enabled && flag.rolloutPercentage < 100 && (
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <Progress
                              value={flag.rolloutPercentage}
                              size="sm"
                              color="primary"
                              className="flex-1"
                            />
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {flag.rolloutPercentage}%
                            </span>
                          </div>
                        )}

                        {/* Expand */}
                        <button
                          onClick={() => setExpandedFlag(isExpanded ? null : flag.id)}
                          className="text-slate-400 hover:text-slate-600 dark:text-slate-400"
                        >
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 bg-slate-50 dark:bg-navy-900">
                          <div className="pt-4 space-y-4">
                            {/* Rollout Control */}
                            {flag.enabled && onUpdateRollout && (
                              <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                                  {t('admin.features.rolloutPercentage', 'Rollout Percentage')}
                                </label>
                                <div className="flex items-center gap-4">
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={flag.rolloutPercentage}
                                    onChange={(e) =>
                                      handleRolloutChange(flag.id, parseInt(e.target.value))
                                    }
                                    className="flex-1"
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={flag.rolloutPercentage}
                                    onChange={(e) =>
                                      handleRolloutChange(flag.id, parseInt(e.target.value) || 0)
                                    }
                                    className="w-20 px-2 py-1 text-center bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded text-sm"
                                  />
                                  <span className="text-sm text-slate-500 dark:text-slate-400">
                                    %
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Targeting */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {flag.targetedUsers && flag.targetedUsers.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                    {t('admin.features.targetedUsers', 'Targeted Users')}
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {flag.targetedUsers.slice(0, 5).map((userId) => (
                                      <span
                                        key={userId}
                                        className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                                      >
                                        {userId}
                                      </span>
                                    ))}
                                    {flag.targetedUsers.length > 5 && (
                                      <span className="px-2 py-0.5 text-xs bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400 rounded">
                                        +{flag.targetedUsers.length - 5}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {flag.targetedGroups && flag.targetedGroups.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                    {t('admin.features.targetedGroups', 'Targeted Groups')}
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {flag.targetedGroups.map((groupId) => (
                                      <span
                                        key={groupId}
                                        className="px-2 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded"
                                      >
                                        {groupId}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Dependencies */}
                            {flag.dependencies && flag.dependencies.length > 0 && (
                              <div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  {t('admin.features.dependencies', 'Dependencies')}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {flag.dependencies.map((dep) => (
                                    <span
                                      key={dep}
                                      className="px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded font-mono"
                                    >
                                      {dep}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-navy-700">
                              <p className="text-xs text-slate-400 dark:text-slate-500">
                                {t('admin.features.lastUpdated', 'Last updated:')}{' '}
                                {new Date(flag.updatedAt).toLocaleDateString()}
                              </p>
                              <div className="flex gap-2">
                                {onEditFlag && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onEditFlag(flag)}
                                    icon={<Settings size={14} />}
                                  >
                                    {t('admin.features.configure', 'Configure')}
                                  </Button>
                                )}
                                {onDeleteFlag && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onDeleteFlag(flag.id)}
                                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                    icon={<Trash2 size={14} />}
                                  >
                                    {t('admin.features.delete', 'Delete')}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredFlags.length === 0 && (
        <div className="p-8 text-center bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 border-dashed">
          <Flag size={48} className="mx-auto mb-4 text-slate-300 dark:text-navy-600" />
          <h4 className="font-medium text-navy-900 dark:text-white mb-2">
            {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all'
              ? t('admin.features.noMatchingFeatures', 'No matching features')
              : t('admin.features.noFeatures', 'No features configured')}
          </h4>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all'
              ? t('admin.features.tryDifferentFilters', 'Try different search or filters')
              : t('admin.features.addFirstFeature', 'Add your first feature flag to get started')}
          </p>
        </div>
      )}
    </div>
  );
};

export default FeatureFlagsManager;
