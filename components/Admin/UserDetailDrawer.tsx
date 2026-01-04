/**
 * UserDetailDrawer - Detailed user information panel
 *
 * Features:
 * - User profile information
 * - Active sessions list with terminate option
 * - Login history (last 10 entries)
 * - Role & permissions summary
 * - Activity timeline
 */

import {
    Activity,
    AlertCircle,
    Calendar,
    Check,
    Clock,
    Crown,
    Globe,
    History,
    Key,
    LogOut,
    Mail,
    Monitor,
    RefreshCw,
    Shield,
    Smartphone,
    User,
    X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface UserDetails {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    status: string;
    avatarUrl?: string;
    isOwner?: boolean;
    createdAt?: string;
    lastLogin?: string;
}

interface Session {
    id: string;
    deviceInfo: string;
    ipAddress: string;
    userAgent: string;
    location?: string;
    createdAt: string;
    lastActiveAt: string;
    isCurrent?: boolean;
}

interface LoginHistoryItem {
    id: string;
    ipAddress: string;
    userAgent?: string;
    location?: string;
    status: 'success' | 'failed';
    failureReason?: string;
    createdAt: string;
}

interface UserDetailDrawerProps {
    user: UserDetails | null;
    isOpen: boolean;
    onClose: () => void;
    onUserUpdated?: () => void;
}

export const UserDetailDrawer: React.FC<UserDetailDrawerProps> = ({ user, isOpen, onClose, onUserUpdated }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'profile' | 'sessions' | 'history'>('profile');
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);

    const token = localStorage.getItem('token');

    useEffect(() => {
        if (isOpen && user) {
            fetchUserData();
        }
    }, [isOpen, user]);

    const fetchUserData = async () => {
        if (!user) return;

        setLoading(true);
        try {
            // For now, we'll use the security sessions endpoint
            // In a full implementation, you'd have user-specific endpoints
            const [sessionsRes, historyRes] = await Promise.all([
                fetch('/api/security/sessions/all', {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`/api/security/login-history?all=true&limit=10`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            if (sessionsRes.ok) {
                const data = await sessionsRes.json();
                // Filter sessions for this user
                setSessions((data.sessions || []).filter((s: any) => s.userId === user.id));
            }

            if (historyRes.ok) {
                const data = await historyRes.json();
                // Filter history for this user
                setLoginHistory((data.history || []).filter((h: any) => h.userId === user.id));
            }
        } catch (err) {
            console.error('Failed to fetch user data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleTerminateSession = async (sessionId: string) => {
        if (!confirm('Are you sure you want to terminate this session?')) return;

        try {
            const res = await fetch(`/api/security/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                throw new Error('Failed to terminate session');
            }

            toast.success('Session terminated');
            fetchUserData();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleTerminateAllSessions = async () => {
        if (!user) return;
        if (!confirm('Are you sure you want to terminate all sessions for this user?')) return;

        try {
            const res = await fetch(`/api/security/sessions/user/${user.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                throw new Error('Failed to terminate sessions');
            }

            toast.success('All sessions terminated');
            fetchUserData();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getDeviceIcon = (userAgent?: string) => {
        if (!userAgent) return <Monitor size={16} />;
        if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
            return <Smartphone size={16} />;
        }
        return <Monitor size={16} />;
    };

    const getRoleBadgeColor = (role?: string, isOwner?: boolean) => {
        if (isOwner || role === 'OWNER') return 'bg-amber-500/20 text-amber-400';
        if (role === 'SUPERADMIN') return 'bg-red-500/20 text-red-400';
        if (role === 'ADMIN') return 'bg-purple-500/20 text-purple-400';
        return 'bg-blue-500/20 text-blue-400';
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

            {/* Drawer */}
            <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-navy-900 border-l border-white/10 shadow-2xl z-50 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/10">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-white text-2xl font-medium">
                                    {user?.firstName?.[0] || '?'}
                                </div>
                                {(user?.isOwner || user?.role === 'OWNER') && (
                                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                                        <Crown size={14} className="text-white" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">
                                    {user?.firstName} {user?.lastName}
                                </h2>
                                <p className="text-slate-400">{user?.email}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span
                                        className={`px-2 py-1 rounded-full text-xs ${getRoleBadgeColor(user?.role, user?.isOwner)}`}
                                    >
                                        {user?.isOwner ? 'Owner' : user?.role || 'USER'}
                                    </span>
                                    <span
                                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                            user?.status === 'active'
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-red-500/20 text-red-400'
                                        }`}
                                    >
                                        {user?.status === 'active' ? <Check size={12} /> : <AlertCircle size={12} />}
                                        {user?.status || 'active'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    {['profile', 'sessions', 'history'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                                activeTab === tab
                                    ? 'text-purple-400 border-b-2 border-purple-500'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {tab === 'profile' && 'Profile'}
                            {tab === 'sessions' && `Sessions (${sessions.length})`}
                            {tab === 'history' && 'Login History'}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
                        </div>
                    ) : (
                        <>
                            {/* Profile Tab */}
                            {activeTab === 'profile' && (
                                <div className="space-y-6">
                                    <div className="grid gap-4">
                                        <div className="p-4 bg-navy-800/50 rounded-lg">
                                            <div className="flex items-center gap-3 text-slate-400 text-sm mb-1">
                                                <Mail size={16} />
                                                Email
                                            </div>
                                            <p className="text-white">{user?.email}</p>
                                        </div>

                                        <div className="p-4 bg-navy-800/50 rounded-lg">
                                            <div className="flex items-center gap-3 text-slate-400 text-sm mb-1">
                                                <Key size={16} />
                                                Role
                                            </div>
                                            <p className="text-white">
                                                {user?.isOwner ? 'Owner (Billing Admin)' : user?.role}
                                            </p>
                                        </div>

                                        {user?.createdAt && (
                                            <div className="p-4 bg-navy-800/50 rounded-lg">
                                                <div className="flex items-center gap-3 text-slate-400 text-sm mb-1">
                                                    <Calendar size={16} />
                                                    Joined
                                                </div>
                                                <p className="text-white">{formatDate(user.createdAt)}</p>
                                            </div>
                                        )}

                                        {user?.lastLogin && (
                                            <div className="p-4 bg-navy-800/50 rounded-lg">
                                                <div className="flex items-center gap-3 text-slate-400 text-sm mb-1">
                                                    <Activity size={16} />
                                                    Last Login
                                                </div>
                                                <p className="text-white">{formatDate(user.lastLogin)}</p>
                                            </div>
                                        )}
                                    </div>

                                    {(user?.isOwner || user?.role === 'OWNER') && (
                                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                            <div className="flex items-center gap-2 text-amber-400 font-medium mb-2">
                                                <Crown size={16} />
                                                Account Owner
                                            </div>
                                            <p className="text-sm text-amber-200/70">
                                                This user is the billing owner of the organization and cannot be deleted
                                                or deactivated.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Sessions Tab */}
                            {activeTab === 'sessions' && (
                                <div className="space-y-4">
                                    {sessions.length > 0 && (
                                        <div className="flex justify-end">
                                            <button
                                                onClick={handleTerminateAllSessions}
                                                className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm flex items-center gap-2"
                                            >
                                                <LogOut size={14} />
                                                Terminate All
                                            </button>
                                        </div>
                                    )}

                                    {sessions.length === 0 ? (
                                        <div className="text-center py-8 text-slate-500">No active sessions</div>
                                    ) : (
                                        sessions.map((session) => (
                                            <div
                                                key={session.id}
                                                className={`p-4 rounded-lg border ${
                                                    session.isCurrent
                                                        ? 'bg-green-500/10 border-green-500/30'
                                                        : 'bg-navy-800/50 border-white/5'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        {getDeviceIcon(session.userAgent)}
                                                        <div>
                                                            <p className="text-white font-medium">
                                                                {session.deviceInfo || 'Unknown Device'}
                                                                {session.isCurrent && (
                                                                    <span className="ml-2 text-xs text-green-400">
                                                                        (Current)
                                                                    </span>
                                                                )}
                                                            </p>
                                                            <p className="text-xs text-slate-400">
                                                                {session.ipAddress} •{' '}
                                                                {session.location || 'Unknown location'}
                                                            </p>
                                                            <p className="text-xs text-slate-500 mt-1">
                                                                Last active: {formatDate(session.lastActiveAt)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {!session.isCurrent && (
                                                        <button
                                                            onClick={() => handleTerminateSession(session.id)}
                                                            className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400"
                                                            title="Terminate session"
                                                        >
                                                            <LogOut size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* History Tab */}
                            {activeTab === 'history' && (
                                <div className="space-y-3">
                                    {loginHistory.length === 0 ? (
                                        <div className="text-center py-8 text-slate-500">No login history</div>
                                    ) : (
                                        loginHistory.map((item) => (
                                            <div
                                                key={item.id}
                                                className="p-4 bg-navy-800/50 rounded-lg border border-white/5"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        {item.status === 'success' ? (
                                                            <Check className="text-green-400" size={16} />
                                                        ) : (
                                                            <AlertCircle className="text-red-400" size={16} />
                                                        )}
                                                        <div>
                                                            <p
                                                                className={`font-medium ${
                                                                    item.status === 'success'
                                                                        ? 'text-green-400'
                                                                        : 'text-red-400'
                                                                }`}
                                                            >
                                                                {item.status === 'success'
                                                                    ? 'Successful login'
                                                                    : 'Failed login'}
                                                            </p>
                                                            <p className="text-xs text-slate-400">
                                                                {item.ipAddress} • {item.location || 'Unknown'}
                                                            </p>
                                                            {item.failureReason && (
                                                                <p className="text-xs text-red-400 mt-1">
                                                                    Reason: {item.failureReason}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-slate-500">
                                                        {formatDate(item.createdAt)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default UserDetailDrawer;
