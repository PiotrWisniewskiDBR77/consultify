/**
 * LastActiveTracker - Last active tracking with inactive user detection
 *
 * Features:
 * - User list with last active timestamps
 * - Inactive user detection (configurable threshold)
 * - Activity status indicators
 * - Bulk actions for inactive users
 * - Activity trends
 *
 * Design: Data table with status badges and activity indicators
 */

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  HelpCircle,
  Mail,
  MoreVertical,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  UserMinus,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Avatar } from '../../ui/primitives/Avatar';
import { Button } from '../../ui/primitives/Button';
import { Progress } from '../../ui/primitives/Progress';
import { Tooltip } from '../../ui/primitives/Tooltip';

// User activity data
export interface UserActivity {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role?: string;
  teamName?: string;
  lastActiveAt: string | null;
  lastLoginAt?: string | null;
  status: 'online' | 'away' | 'offline' | 'inactive';
  activityScore?: number; // 0-100
}

// Inactivity settings
export interface InactivitySettings {
  inactiveDays: number;
  warnDays: number;
  autoDeactivateEnabled: boolean;
  autoDeactivateDays: number;
  sendReminderEmail: boolean;
}

interface LastActiveTrackerProps {
  users: UserActivity[];
  settings: InactivitySettings;
  onUpdateSettings?: (settings: InactivitySettings) => void;
  onSendReminder?: (userIds: string[]) => void;
  onDeactivateUsers?: (userIds: string[]) => void;
  onViewUser?: (userId: string) => void;
  className?: string;
}

export const LastActiveTracker: React.FC<LastActiveTrackerProps> = ({
  users,
  settings,
  onUpdateSettings,
  onSendReminder,
  onDeactivateUsers,
  onViewUser,
  className,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'online' | 'away' | 'offline' | 'inactive'
  >('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [sortBy, setSortBy] = useState<'lastActive' | 'name'>('lastActive');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Calculate days since last active
  const getDaysSinceActive = (lastActiveAt: string | null): number | null => {
    if (!lastActiveAt) return null;
    const now = new Date();
    const lastActive = new Date(lastActiveAt);
    const diffTime = now.getTime() - lastActive.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Get activity status
  const getActivityStatus = (
    user: UserActivity
  ): 'online' | 'away' | 'offline' | 'inactive' | 'warning' => {
    if (user.status === 'online') return 'online';
    if (user.status === 'away') return 'away';

    const daysSince = getDaysSinceActive(user.lastActiveAt);
    if (daysSince === null) return 'inactive';
    if (daysSince >= settings.inactiveDays) return 'inactive';
    if (daysSince >= settings.warnDays) return 'warning';
    return 'offline';
  };

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    const result = users.filter((user) => {
      if (statusFilter !== 'all' && user.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          user.firstName.toLowerCase().includes(query) ||
          user.lastName.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
        );
      }
      return true;
    });

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      } else {
        const daysA = getDaysSinceActive(a.lastActiveAt) ?? Infinity;
        const daysB = getDaysSinceActive(b.lastActiveAt) ?? Infinity;
        return sortOrder === 'asc' ? daysB - daysA : daysA - daysB;
      }
    });

    return result;
  }, [users, statusFilter, searchQuery, sortBy, sortOrder, settings]);

  // Stats
  const stats = useMemo(() => {
    const online = users.filter((u) => u.status === 'online').length;
    const away = users.filter((u) => u.status === 'away').length;
    const inactive = users.filter((u) => {
      const days = getDaysSinceActive(u.lastActiveAt);
      return days !== null && days >= settings.inactiveDays;
    }).length;
    const warning = users.filter((u) => {
      const days = getDaysSinceActive(u.lastActiveAt);
      return days !== null && days >= settings.warnDays && days < settings.inactiveDays;
    }).length;

    return { online, away, inactive, warning, total: users.length };
  }, [users, settings]);

  // Toggle user selection
  const toggleUserSelection = useCallback((userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  // Select all inactive
  const selectAllInactive = useCallback(() => {
    const inactiveIds = filteredUsers
      .filter((u) => getActivityStatus(u) === 'inactive')
      .map((u) => u.userId);
    setSelectedUsers(new Set(inactiveIds));
  }, [filteredUsers]);

  // Get status badge
  const getStatusBadge = (status: ReturnType<typeof getActivityStatus>) => {
    switch (status) {
      case 'online':
        return (
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {t('admin.team.activity.online', 'Online')}
          </span>
        );
      case 'away':
        return (
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {t('admin.team.activity.away', 'Away')}
          </span>
        );
      case 'offline':
        return (
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            {t('admin.team.activity.offline', 'Offline')}
          </span>
        );
      case 'warning':
        return (
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <AlertTriangle size={12} />
            {t('admin.team.activity.warning', 'At risk')}
          </span>
        );
      case 'inactive':
        return (
          <span className="flex items-center gap-1.5 text-danger-600 dark:text-danger-400">
            <WifiOff size={12} />
            {t('admin.team.activity.inactive', 'Inactive')}
          </span>
        );
    }
  };

  // Format last active time
  const formatLastActive = (lastActiveAt: string | null) => {
    if (!lastActiveAt) return t('admin.team.activity.never', 'Never');

    const days = getDaysSinceActive(lastActiveAt);
    if (days === null) return t('admin.team.activity.never', 'Never');
    if (days === 0) return t('admin.team.activity.today', 'Today');
    if (days === 1) return t('admin.team.activity.yesterday', 'Yesterday');
    if (days < 7) return t('admin.team.activity.daysAgo', '{{days}} days ago', { days });
    if (days < 30) {
      const weeks = Math.floor(days / 7);
      return t('admin.team.activity.weeksAgo', '{{weeks}} weeks ago', { weeks });
    }
    const months = Math.floor(days / 30);
    return t('admin.team.activity.monthsAgo', '{{months}} months ago', { months });
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          className={cn(
            'p-4 rounded-xl border cursor-pointer transition-all',
            statusFilter === 'online'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
              : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 hover:border-emerald-300'
          )}
          onClick={() => setStatusFilter(statusFilter === 'online' ? 'all' : 'online')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.team.activity.online', 'Online')}
            </span>
            <Wifi size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.online}
          </p>
        </div>

        <div
          className={cn(
            'p-4 rounded-xl border cursor-pointer transition-all',
            statusFilter === 'away'
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
              : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 hover:border-amber-300'
          )}
          onClick={() => setStatusFilter(statusFilter === 'away' ? 'all' : 'away')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.team.activity.away', 'Away')}
            </span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.away}</p>
        </div>

        <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.team.activity.atRisk', 'At Risk')}
            </span>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.warning}</p>
        </div>

        <div
          className={cn(
            'p-4 rounded-xl border cursor-pointer transition-all',
            statusFilter === 'inactive'
              ? 'bg-danger-50 dark:bg-danger-900/20 border-danger-300 dark:border-danger-700'
              : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 hover:border-danger-300'
          )}
          onClick={() => setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.team.activity.inactive', 'Inactive')}
            </span>
            <WifiOff size={16} className="text-danger-500" />
          </div>
          <p className="text-2xl font-bold text-danger-600 dark:text-danger-400">
            {stats.inactive}
          </p>
        </div>
      </div>

      {/* Filters and Actions */}
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
            placeholder={t('admin.team.activity.searchPlaceholder', 'Search users...')}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAllInactive}
            disabled={stats.inactive === 0}
          >
            {t('admin.team.activity.selectInactive', 'Select Inactive')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            icon={<Settings size={16} />}
          >
            {t('admin.team.activity.settings', 'Settings')}
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && onUpdateSettings && (
        <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700">
          <h4 className="font-medium text-navy-900 dark:text-white mb-4">
            {t('admin.team.activity.inactivitySettings', 'Inactivity Settings')}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t('admin.team.activity.warningDays', 'Warning after (days)')}
              </label>
              <input
                type="number"
                min="1"
                value={settings.warnDays}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    warnDays: parseInt(e.target.value) || 14,
                  })
                }
                className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t('admin.team.activity.inactiveDays', 'Inactive after (days)')}
              </label>
              <input
                type="number"
                min="1"
                value={settings.inactiveDays}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    inactiveDays: parseInt(e.target.value) || 30,
                  })
                }
                className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedUsers.size > 0 && (
        <div className="flex items-center gap-4 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800">
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            {t('admin.team.activity.selected', '{{count}} selected', {
              count: selectedUsers.size,
            })}
          </span>
          <div className="flex-1" />
          {onSendReminder && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSendReminder(Array.from(selectedUsers))}
              icon={<Mail size={14} />}
            >
              {t('admin.team.activity.sendReminder', 'Send Reminder')}
            </Button>
          )}
          {onDeactivateUsers && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDeactivateUsers(Array.from(selectedUsers))}
              className="text-danger-600 border-danger-300 hover:bg-danger-50"
              icon={<UserMinus size={14} />}
            >
              {t('admin.team.activity.deactivate', 'Deactivate')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setSelectedUsers(new Set())}>
            {t('admin.team.activity.clearSelection', 'Clear')}
          </Button>
        </div>
      )}

      {/* User List */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 text-sm font-medium text-slate-600 dark:text-slate-400">
          <div className="col-span-1 flex items-center">
            <input
              type="checkbox"
              checked={selectedUsers.size > 0 && selectedUsers.size === filteredUsers.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedUsers(new Set(filteredUsers.map((u) => u.userId)));
                } else {
                  setSelectedUsers(new Set());
                }
              }}
              className="rounded border-slate-300 dark:border-navy-700"
            />
          </div>
          <div
            className="col-span-4 cursor-pointer flex items-center gap-1"
            onClick={() => {
              if (sortBy === 'name') {
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              } else {
                setSortBy('name');
                setSortOrder('asc');
              }
            }}
          >
            {t('admin.team.activity.user', 'User')}
            {sortBy === 'name' && (
              <ChevronDown size={14} className={cn(sortOrder === 'desc' && 'rotate-180')} />
            )}
          </div>
          <div className="col-span-2">{t('admin.team.activity.status', 'Status')}</div>
          <div
            className="col-span-3 cursor-pointer flex items-center gap-1"
            onClick={() => {
              if (sortBy === 'lastActive') {
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              } else {
                setSortBy('lastActive');
                setSortOrder('asc');
              }
            }}
          >
            {t('admin.team.activity.lastActive', 'Last Active')}
            {sortBy === 'lastActive' && (
              <ChevronDown size={14} className={cn(sortOrder === 'desc' && 'rotate-180')} />
            )}
          </div>
          <div className="col-span-2 text-right">{t('admin.team.activity.actions', 'Actions')}</div>
        </div>

        {/* User Rows */}
        <div className="divide-y divide-slate-200 dark:divide-navy-700">
          {filteredUsers.map((user) => {
            const status = getActivityStatus(user);
            const daysSince = getDaysSinceActive(user.lastActiveAt);

            return (
              <div
                key={user.userId}
                className={cn(
                  'grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-navy-900',
                  selectedUsers.has(user.userId) && 'bg-primary-50 dark:bg-primary-900/20'
                )}
              >
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(user.userId)}
                    onChange={() => toggleUserSelection(user.userId)}
                    className="rounded border-slate-300 dark:border-navy-700"
                  />
                </div>
                <div
                  className="col-span-4 flex items-center gap-3 cursor-pointer"
                  onClick={() => onViewUser?.(user.userId)}
                >
                  <Avatar
                    name={`${user.firstName} ${user.lastName}`}
                    src={user.avatarUrl}
                    size="sm"
                  />
                  <div>
                    <p className="font-medium text-navy-900 dark:text-white">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                  </div>
                </div>
                <div className="col-span-2 text-sm">{getStatusBadge(status)}</div>
                <div className="col-span-3 text-sm text-slate-600 dark:text-slate-400">
                  {formatLastActive(user.lastActiveAt)}
                  {daysSince !== null && daysSince >= settings.warnDays && (
                    <span className="ml-2 text-xs text-danger-500">({daysSince}d)</span>
                  )}
                </div>
                <div className="col-span-2 flex justify-end gap-1">
                  {onSendReminder && status === 'inactive' && (
                    <Tooltip content={t('admin.team.activity.sendReminder', 'Send reminder')}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSendReminder([user.userId])}
                        className="h-8 w-8 p-0"
                      >
                        <Mail size={14} />
                      </Button>
                    </Tooltip>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewUser?.(user.userId)}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredUsers.length === 0 && (
          <div className="py-12 text-center">
            <Users size={48} className="mx-auto mb-4 text-slate-300 dark:text-navy-600" />
            <p className="text-slate-500 dark:text-slate-400">
              {t('admin.team.activity.noUsers', 'No users match your filters')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LastActiveTracker;
