/**
 * MainExtraTeams - Main team vs extra teams management component
 *
 * Features:
 * - Designate main team for users
 * - Add/remove extra team memberships
 * - Team hierarchy visualization
 * - Bulk assignment
 *
 * Design: User cards with team tags
 */

import {
    ArrowRight,
    Check,
    ChevronDown,
    ChevronRight,
    Crown,
    HelpCircle,
    Plus,
    Search,
    Star,
    Trash2,
    Users,
    X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Avatar } from '../../ui/primitives/Avatar';
import { Button } from '../../ui/primitives/Button';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Team
export interface Team {
    id: string;
    name: string;
    description?: string;
    memberCount: number;
    color?: string;
}

// User with team assignments
export interface UserTeamAssignment {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    mainTeamId: string | null;
    extraTeamIds: string[];
}

interface MainExtraTeamsProps {
    users: UserTeamAssignment[];
    teams: Team[];
    onSetMainTeam?: (userId: string, teamId: string) => void;
    onAddExtraTeam?: (userId: string, teamId: string) => void;
    onRemoveExtraTeam?: (userId: string, teamId: string) => void;
    onBulkAssign?: (userIds: string[], teamId: string, isMain: boolean) => void;
    className?: string;
}

export const MainExtraTeams: React.FC<MainExtraTeamsProps> = ({
    users,
    teams,
    onSetMainTeam,
    onAddExtraTeam,
    onRemoveExtraTeam,
    onBulkAssign,
    className,
}) => {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTeamFilter, setSelectedTeamFilter] = useState<string | 'all'>('all');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [addingTeamTo, setAddingTeamTo] = useState<string | null>(null);

    // Filter users
    const filteredUsers = useMemo(() => {
        return users.filter((user) => {
            if (selectedTeamFilter !== 'all') {
                if (user.mainTeamId !== selectedTeamFilter && !user.extraTeamIds.includes(selectedTeamFilter)) {
                    return false;
                }
            }
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
    }, [users, selectedTeamFilter, searchQuery]);

    // Get team by ID
    const getTeam = useCallback((teamId: string) => teams.find((t) => t.id === teamId), [teams]);

    // Get available teams for user (not already assigned)
    const getAvailableTeams = useCallback(
        (user: UserTeamAssignment) => {
            const assignedTeamIds = new Set([user.mainTeamId, ...user.extraTeamIds].filter(Boolean));
            return teams.filter((t) => !assignedTeamIds.has(t.id));
        },
        [teams],
    );

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

    // Stats
    const stats = useMemo(() => {
        const noMainTeam = users.filter((u) => !u.mainTeamId).length;
        const multipleTeams = users.filter((u) => u.extraTeamIds.length > 0).length;
        return { noMainTeam, multipleTeams };
    }, [users]);

    return (
        <div className={cn('space-y-6', className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
                        {t('admin.team.mainExtra.title', 'Team Assignments')}
                        <Tooltip
                            content={t(
                                'admin.team.mainExtra.tooltip',
                                'Manage primary and additional team memberships',
                            )}
                        >
                            <HelpCircle size={16} className="text-slate-400" />
                        </Tooltip>
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t('admin.team.mainExtra.subtitle', 'Assign users to main and extra teams')}
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                            {t('admin.team.mainExtra.totalUsers', 'Total Users')}
                        </span>
                        <Users size={16} className="text-slate-400" />
                    </div>
                    <p className="text-2xl font-bold text-navy-900 dark:text-white">{users.length}</p>
                </div>
                <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                            {t('admin.team.mainExtra.noMainTeam', 'No Main Team')}
                        </span>
                        <Star size={16} className="text-amber-500" />
                    </div>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.noMainTeam}</p>
                </div>
                <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                            {t('admin.team.mainExtra.multipleTeams', 'Multiple Teams')}
                        </span>
                        <Crown size={16} className="text-violet-500" />
                    </div>
                    <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{stats.multipleTeams}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('admin.team.mainExtra.searchPlaceholder', 'Search users...')}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
                    />
                </div>

                <select
                    value={selectedTeamFilter}
                    onChange={(e) => setSelectedTeamFilter(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
                >
                    <option value="all">{t('admin.team.mainExtra.allTeams', 'All Teams')}</option>
                    {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                            {team.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Bulk Actions */}
            {selectedUsers.size > 0 && onBulkAssign && (
                <div className="flex items-center gap-4 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
                    <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                        {t('admin.team.mainExtra.selected', '{{count}} selected', {
                            count: selectedUsers.size,
                        })}
                    </span>
                    <div className="flex-1" />
                    <select
                        onChange={(e) => {
                            if (e.target.value) {
                                onBulkAssign(Array.from(selectedUsers), e.target.value, true);
                                setSelectedUsers(new Set());
                            }
                        }}
                        className="px-3 py-1.5 text-sm bg-white dark:bg-navy-800 border border-violet-300 dark:border-violet-700 rounded-lg"
                        defaultValue=""
                    >
                        <option value="" disabled>
                            {t('admin.team.mainExtra.assignMainTeam', 'Assign main team...')}
                        </option>
                        {teams.map((team) => (
                            <option key={team.id} value={team.id}>
                                {team.name}
                            </option>
                        ))}
                    </select>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedUsers(new Set())}>
                        {t('admin.team.mainExtra.clear', 'Clear')}
                    </Button>
                </div>
            )}

            {/* User List */}
            <div className="space-y-2">
                {filteredUsers.map((user) => {
                    const mainTeam = user.mainTeamId ? getTeam(user.mainTeamId) : null;
                    const extraTeams = user.extraTeamIds.map(getTeam).filter(Boolean) as Team[];
                    const availableTeams = getAvailableTeams(user);
                    const isExpanded = expandedUser === user.userId;

                    return (
                        <div
                            key={user.userId}
                            className={cn(
                                'bg-white dark:bg-navy-800 rounded-lg border transition-all',
                                selectedUsers.has(user.userId)
                                    ? 'border-violet-400 dark:border-violet-600'
                                    : 'border-slate-200 dark:border-navy-700',
                            )}
                        >
                            <div className="flex items-center gap-3 p-3">
                                {/* Checkbox */}
                                <input
                                    type="checkbox"
                                    checked={selectedUsers.has(user.userId)}
                                    onChange={() => toggleUserSelection(user.userId)}
                                    className="rounded border-slate-300"
                                />

                                {/* User Info */}
                                <Avatar name={`${user.firstName} ${user.lastName}`} src={user.avatarUrl} size="sm" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-navy-900 dark:text-white truncate">
                                        {user.firstName} {user.lastName}
                                    </p>
                                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                </div>

                                {/* Main Team */}
                                <div className="flex items-center gap-2">
                                    {mainTeam ? (
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-lg">
                                            <Star size={12} />
                                            <span className="text-sm font-medium">{mainTeam.name}</span>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-amber-600 dark:text-amber-400">
                                            {t('admin.team.mainExtra.noMainTeam', 'No main team')}
                                        </span>
                                    )}

                                    {/* Extra Teams Count */}
                                    {extraTeams.length > 0 && (
                                        <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 rounded-full">
                                            +{extraTeams.length}
                                        </span>
                                    )}
                                </div>

                                {/* Expand Button */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setExpandedUser(isExpanded ? null : user.userId)}
                                    className="h-8 w-8 p-0"
                                >
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </Button>
                            </div>

                            {/* Expanded Content */}
                            {isExpanded && (
                                <div className="px-4 pb-4 pt-2 border-t border-slate-200 dark:border-navy-700 space-y-3">
                                    {/* Main Team Section */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                            {t('admin.team.mainExtra.mainTeam', 'Main Team')}
                                        </label>
                                        <select
                                            value={user.mainTeamId || ''}
                                            onChange={(e) => onSetMainTeam?.(user.userId, e.target.value)}
                                            className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-navy-900 dark:text-white"
                                        >
                                            <option value="">
                                                {t('admin.team.mainExtra.selectMainTeam', 'Select main team...')}
                                            </option>
                                            {teams.map((team) => (
                                                <option key={team.id} value={team.id}>
                                                    {team.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Extra Teams Section */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                            {t('admin.team.mainExtra.extraTeams', 'Extra Teams')}
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {extraTeams.map((team) => (
                                                <div
                                                    key={team.id}
                                                    className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-navy-700 text-slate-700 dark:text-slate-300 rounded-lg"
                                                >
                                                    <span className="text-sm">{team.name}</span>
                                                    {onRemoveExtraTeam && (
                                                        <button
                                                            onClick={() => onRemoveExtraTeam(user.userId, team.id)}
                                                            className="text-slate-400 hover:text-rose-500"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}

                                            {/* Add Extra Team */}
                                            {addingTeamTo === user.userId ? (
                                                <select
                                                    autoFocus
                                                    onChange={(e) => {
                                                        if (e.target.value && onAddExtraTeam) {
                                                            onAddExtraTeam(user.userId, e.target.value);
                                                        }
                                                        setAddingTeamTo(null);
                                                    }}
                                                    onBlur={() => setAddingTeamTo(null)}
                                                    className="px-2 py-1 text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg"
                                                >
                                                    <option value="">
                                                        {t('admin.team.mainExtra.selectTeam', 'Select team...')}
                                                    </option>
                                                    {availableTeams.map((team) => (
                                                        <option key={team.id} value={team.id}>
                                                            {team.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                availableTeams.length > 0 &&
                                                onAddExtraTeam && (
                                                    <button
                                                        onClick={() => setAddingTeamTo(user.userId)}
                                                        className="flex items-center gap-1 px-2 py-1 text-sm text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg"
                                                    >
                                                        <Plus size={14} />
                                                        {t('admin.team.mainExtra.addTeam', 'Add team')}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Empty State */}
            {filteredUsers.length === 0 && (
                <div className="text-center py-12 bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 border-dashed">
                    <Users size={48} className="mx-auto mb-4 text-slate-300 dark:text-navy-600" />
                    <p className="text-slate-500 dark:text-slate-400">
                        {t('admin.team.mainExtra.noUsers', 'No users match your filters')}
                    </p>
                </div>
            )}
        </div>
    );
};

export default MainExtraTeams;

