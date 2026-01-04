import {
    AlertTriangle,
    Briefcase,
    Calendar,
    Check,
    ChevronDown,
    Crown,
    Eye,
    Loader2,
    MoreVertical,
    Percent,
    Shield,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { PMORoleSelector } from './PMORoleSelector';

/**
 * Project Team Board Component
 *
 * Visual board for managing project team members with PMO roles.
 * Shows team organized by role level (Executive, Manager, Lead, Member, Stakeholder).
 *
 * Part of Work Dimensions System
 * ISO 21500 / PMBOK / PRINCE2 Compliant
 */

interface TeamMember {
    userId: string;
    userName: string;
    userEmail: string;
    userAvatar?: string;
    pmoRole: {
        id: string;
        code: string;
        name: string;
        namePl: string;
        level: number;
    } | null;
    allocationPercent: number;
    startDate?: string;
    endDate?: string;
}

interface TeamStats {
    totalMembers: number;
    totalAllocation: number;
    averageAllocation: number;
    byLevel: {
        executive: number;
        manager: number;
        lead: number;
        member: number;
        stakeholder: number;
    };
    requiredRoles: {
        total: number;
        filled: number;
        missing: { code: string; name: string }[];
    };
}

interface User {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar?: string;
}

interface ProjectTeamBoardProps {
    projectId: string;
    projectName?: string;
    readOnly?: boolean;
}

const LEVEL_CONFIG = [
    { level: 0, key: 'executive', label: 'Executive', labelPl: 'Zarząd', icon: Crown, color: 'amber' },
    { level: 1, key: 'manager', label: 'Management', labelPl: 'Zarządzanie', icon: Briefcase, color: 'blue' },
    { level: 2, key: 'lead', label: 'Leads', labelPl: 'Liderzy', icon: Shield, color: 'purple' },
    { level: 3, key: 'member', label: 'Team', labelPl: 'Zespół', icon: Users, color: 'green' },
    { level: 4, key: 'stakeholder', label: 'Stakeholders', labelPl: 'Interesariusze', icon: Eye, color: 'gray' },
];

export const ProjectTeamBoard: React.FC<ProjectTeamBoardProps> = ({ projectId, projectName, readOnly = false }) => {
    const { t, i18n } = useTranslation();
    const isPl = i18n.language === 'pl';

    // State
    const [teamByLevel, setTeamByLevel] = useState<Record<string, TeamMember[]>>({
        executive: [],
        manager: [],
        lead: [],
        member: [],
        stakeholder: [],
        unassigned: [],
    });
    const [stats, setStats] = useState<TeamStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddMember, setShowAddMember] = useState(false);
    const [availableUsers, setAvailableUsers] = useState<User[]>([]);
    const [pmoRoles, setPmoRoles] = useState<any[]>([]);

    // Add member form
    const [newMember, setNewMember] = useState({
        userId: '',
        pmoRoleId: '',
        allocationPercent: 100,
    });
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        fetchTeam();
        fetchAvailableUsers();
        fetchRoles();
    }, [projectId]);

    const fetchTeam = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [teamRes, statsRes] = await Promise.all([
                fetch(`/api/pmo-roles/projects/${projectId}/team?grouped=true`, { headers }),
                fetch(`/api/pmo-roles/projects/${projectId}/team/stats`, { headers }),
            ]);

            if (teamRes.ok) {
                const data = await teamRes.json();
                setTeamByLevel(data);
            }

            if (statsRes.ok) {
                const data = await statsRes.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Failed to fetch team:', err);
            toast.error(t('projects.team.fetchError', 'Failed to load team'));
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAvailableUsers = async () => {
        try {
            const res = await fetch('/api/users', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (res.ok) {
                const data = await res.json();
                setAvailableUsers(Array.isArray(data) ? data : data.users || []);
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    };

    const fetchRoles = async () => {
        try {
            const res = await fetch('/api/pmo-roles', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (res.ok) {
                const data = await res.json();
                setPmoRoles(data);
            }
        } catch (err) {
            console.error('Failed to fetch roles:', err);
        }
    };

    const handleAddMember = async () => {
        if (!newMember.userId || !newMember.pmoRoleId) return;

        setIsAdding(true);
        try {
            const res = await fetch(`/api/pmo-roles/projects/${projectId}/team`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify(newMember),
            });

            if (res.ok) {
                toast.success(t('projects.team.memberAdded', 'Team member added'));
                setShowAddMember(false);
                setNewMember({ userId: '', pmoRoleId: '', allocationPercent: 100 });
                fetchTeam();
            } else {
                const error = await res.json();
                toast.error(error.error || t('projects.team.addError', 'Failed to add member'));
            }
        } catch (err) {
            toast.error(t('projects.team.addError', 'Failed to add member'));
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!confirm(t('projects.team.confirmRemove', 'Remove this team member?'))) return;

        try {
            const res = await fetch(`/api/pmo-roles/projects/${projectId}/team/${userId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });

            if (res.ok) {
                toast.success(t('projects.team.memberRemoved', 'Team member removed'));
                fetchTeam();
            }
        } catch (err) {
            toast.error(t('projects.team.removeError', 'Failed to remove member'));
        }
    };

    const getColorClasses = (color: string) => ({
        bg: `bg-${color}-100 dark:bg-${color}-900/30`,
        text: `text-${color}-600 dark:text-${color}-400`,
        border: `border-${color}-200 dark:border-${color}-800`,
    });

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
                <div className="flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                            <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {t('projects.team.title', 'Project Team')}
                            </h2>
                            {projectName && <p className="text-sm text-gray-500 dark:text-gray-400">{projectName}</p>}
                        </div>
                    </div>

                    {!readOnly && (
                        <button
                            onClick={() => setShowAddMember(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg
                       hover:bg-blue-700 transition-colors"
                        >
                            <UserPlus className="h-4 w-4" />
                            {t('projects.team.addMember', 'Add Member')}
                        </button>
                    )}
                </div>

                {/* Stats */}
                {stats && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalMembers}</div>
                            <div className="text-sm text-gray-500">
                                {t('projects.team.totalMembers', 'Total Members')}
                            </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                {stats.totalAllocation}%
                            </div>
                            <div className="text-sm text-gray-500">
                                {t('projects.team.totalAllocation', 'Total Allocation')}
                            </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                {stats.requiredRoles.filled}/{stats.requiredRoles.total}
                            </div>
                            <div className="text-sm text-gray-500">
                                {t('projects.team.requiredRoles', 'Required Roles')}
                            </div>
                        </div>
                        {stats.requiredRoles.missing.length > 0 && (
                            <div className="bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg">
                                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                    <AlertTriangle className="h-5 w-5" />
                                    <span className="font-medium">{t('projects.team.missingRoles', 'Missing')}</span>
                                </div>
                                <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                    {stats.requiredRoles.missing.map((r) => r.name).join(', ')}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Team Board */}
            <div className="p-6 space-y-6">
                {LEVEL_CONFIG.map(({ level, key, label, labelPl, icon: Icon, color }) => {
                    const members = teamByLevel[key] || [];
                    const colorClasses = {
                        bg:
                            color === 'amber'
                                ? 'bg-amber-100 dark:bg-amber-900/30'
                                : color === 'blue'
                                  ? 'bg-blue-100 dark:bg-blue-900/30'
                                  : color === 'purple'
                                    ? 'bg-purple-100 dark:bg-purple-900/30'
                                    : color === 'green'
                                      ? 'bg-green-100 dark:bg-green-900/30'
                                      : 'bg-gray-100 dark:bg-gray-900/30',
                        text:
                            color === 'amber'
                                ? 'text-amber-600 dark:text-amber-400'
                                : color === 'blue'
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : color === 'purple'
                                    ? 'text-purple-600 dark:text-purple-400'
                                    : color === 'green'
                                      ? 'text-green-600 dark:text-green-400'
                                      : 'text-gray-600 dark:text-gray-400',
                    };

                    return (
                        <div key={key}>
                            {/* Level Header */}
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`p-1.5 rounded-lg ${colorClasses.bg}`}>
                                    <Icon className={`h-4 w-4 ${colorClasses.text}`} />
                                </div>
                                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {isPl ? labelPl : label}
                                </h3>
                                <span className="text-xs text-gray-400">({members.length})</span>
                            </div>

                            {/* Members Grid */}
                            {members.length === 0 ? (
                                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-center text-sm text-gray-500">
                                    {t('projects.team.noMembers', 'No team members at this level')}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {members.map((member) => (
                                        <div
                                            key={member.userId}
                                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg group"
                                        >
                                            <div className="flex items-center gap-3">
                                                {/* Avatar */}
                                                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                                                    {member.userAvatar ? (
                                                        <img
                                                            src={member.userAvatar}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                                            {member.userName
                                                                .split(' ')
                                                                .map((n) => n[0])
                                                                .join('')
                                                                .slice(0, 2)}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div>
                                                    <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                                                        {member.userName}
                                                    </h4>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <span>
                                                            {isPl ? member.pmoRole?.namePl : member.pmoRole?.name}
                                                        </span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <Percent className="h-3 w-3" />
                                                            {member.allocationPercent}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            {!readOnly && (
                                                <button
                                                    onClick={() => handleRemoveMember(member.userId)}
                                                    className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Add Member Modal */}
            {showAddMember && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {t('projects.team.addMember', 'Add Team Member')}
                                </h3>
                                <button
                                    onClick={() => setShowAddMember(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                >
                                    <X className="h-5 w-5 text-gray-500" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* User Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('projects.team.selectUser', 'Select User')}
                                </label>
                                <select
                                    value={newMember.userId}
                                    onChange={(e) => setNewMember((prev) => ({ ...prev, userId: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                    <option value="">{t('common.select', 'Select...')}</option>
                                    {availableUsers.map((user) => (
                                        <option key={user.id} value={user.id}>
                                            {user.first_name} {user.last_name} ({user.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* PMO Role Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('projects.team.selectRole', 'PMO Role')}
                                </label>
                                <PMORoleSelector
                                    value={newMember.pmoRoleId}
                                    onChange={(roleId) => setNewMember((prev) => ({ ...prev, pmoRoleId: roleId }))}
                                    roles={pmoRoles}
                                />
                            </div>

                            {/* Allocation */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('projects.team.allocation', 'Time Allocation')}
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={newMember.allocationPercent}
                                        onChange={(e) =>
                                            setNewMember((prev) => ({
                                                ...prev,
                                                allocationPercent: parseInt(e.target.value),
                                            }))
                                        }
                                        className="flex-1"
                                    />
                                    <span className="w-12 text-right text-gray-900 dark:text-white font-medium">
                                        {newMember.allocationPercent}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                            <button
                                onClick={() => setShowAddMember(false)}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={handleAddMember}
                                disabled={!newMember.userId || !newMember.pmoRoleId || isAdding}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md
                         hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isAdding ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="h-4 w-4" />
                                )}
                                {t('common.add', 'Add')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectTeamBoard;


