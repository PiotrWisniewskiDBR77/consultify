/**
 * Admin Sessions View
 * 
 * Manages SuperAdmin sessions with MFA tracking, IP logging,
 * and session revocation capabilities.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardWithHeader, Section } from '../../../components/Admin/shared/Card';
import {
    Monitor, Smartphone, Globe, Shield, ShieldCheck, ShieldX,
    Clock, Trash2, LogOut, RefreshCw, Loader2, AlertTriangle, Users
} from 'lucide-react';
import { Api } from '../../../services/api';

interface AdminSession {
    id: string;
    adminId: string;
    ipAddress: string;
    userAgent: string;
    mfaVerified: boolean;
    createdAt: string;
    expiresAt: string;
    isActive: boolean;
    admin: {
        email: string;
        firstName: string;
        lastName: string;
    };
}

interface SessionStats {
    totalSessions: number;
    activeSessions: number;
    mfaVerifiedSessions: number;
    uniqueAdmins: number;
}

const AdminSessionsView: React.FC = () => {
    const [sessions, setSessions] = useState<AdminSession[]>([]);
    const [stats, setStats] = useState<SessionStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [sessionsData, statsData] = await Promise.all([
                Api.getAdminSessions(),
                Api.getAdminSessionStats()
            ]);
            setSessions(sessionsData);
            setStats(statsData);
        } catch (err: any) {
            setError(err.message || 'Failed to load sessions');
        } finally {
            setLoading(false);
        }
    };

    const handleRevokeSession = async (sessionId: string) => {
        try {
            setActionLoading(sessionId);
            await Api.revokeAdminSession(sessionId);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            if (stats) {
                setStats({ ...stats, activeSessions: stats.activeSessions - 1 });
            }
        } catch (err: any) {
            setError(err.message || 'Failed to revoke session');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRevokeAll = async () => {
        if (!confirm('Are you sure you want to revoke all admin sessions? This will log out all admins.')) {
            return;
        }

        try {
            setActionLoading('all');
            await Api.revokeAllAdminSessions(undefined, true);
            await loadData();
        } catch (err: any) {
            setError(err.message || 'Failed to revoke all sessions');
        } finally {
            setActionLoading(null);
        }
    };

    const getDeviceIcon = (userAgent: string) => {
        const ua = userAgent.toLowerCase();
        if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
            return <Smartphone className="w-4 h-4" />;
        }
        return <Monitor className="w-4 h-4" />;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const isExpired = (expiresAt: string) => {
        return new Date(expiresAt) < new Date();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card variant="bordered" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <Users className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Total Sessions</p>
                            <p className="text-xl font-semibold">{stats?.totalSessions || 0}</p>
                        </div>
                    </div>
                </Card>

                <Card variant="bordered" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <Shield className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Active Sessions</p>
                            <p className="text-xl font-semibold">{stats?.activeSessions || 0}</p>
                        </div>
                    </div>
                </Card>

                <Card variant="bordered" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-500/10 rounded-lg">
                            <ShieldCheck className="w-5 h-5 text-violet-500" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">MFA Verified</p>
                            <p className="text-xl font-semibold">{stats?.mfaVerifiedSessions || 0}</p>
                        </div>
                    </div>
                </Card>

                <Card variant="bordered" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                            <Users className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Unique Admins</p>
                            <p className="text-xl font-semibold">{stats?.uniqueAdmins || 0}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Error Alert */}
            {error && (
                <Card variant="bordered" className="p-4 border-red-500/30 bg-red-500/5">
                    <div className="flex items-center gap-2 text-red-400">
                        <AlertTriangle className="w-5 h-5" />
                        <span>{error}</span>
                        <button
                            onClick={() => setError(null)}
                            className="ml-auto text-sm hover:text-red-300"
                        >
                            Dismiss
                        </button>
                    </div>
                </Card>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Active Sessions</h2>
                <div className="flex gap-2">
                    <button
                        onClick={loadData}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <button
                        onClick={handleRevokeAll}
                        disabled={actionLoading === 'all' || sessions.length === 0}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {actionLoading === 'all' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <LogOut className="w-4 h-4" />
                        )}
                        Revoke All Sessions
                    </button>
                </div>
            </div>

            {/* Sessions Table */}
            <CardWithHeader
                title="Admin Sessions"
                subtitle={`${sessions.length} active sessions`}
            >
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Admin</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Device</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">IP Address</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">MFA</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Created</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Expires</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-8 text-slate-400">
                                        No active sessions found
                                    </td>
                                </tr>
                            ) : (
                                sessions.map((session) => (
                                    <tr
                                        key={session.id}
                                        className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors"
                                    >
                                        <td className="py-3 px-4">
                                            <div>
                                                <p className="font-medium">
                                                    {session.admin.firstName} {session.admin.lastName}
                                                </p>
                                                <p className="text-sm text-slate-400">{session.admin.email}</p>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                {getDeviceIcon(session.userAgent)}
                                                <span className="text-sm text-slate-300 truncate max-w-[200px]">
                                                    {session.userAgent.split(' ')[0]}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <Globe className="w-4 h-4 text-slate-400" />
                                                <span className="text-sm">{session.ipAddress || 'Unknown'}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            {session.mfaVerified ? (
                                                <span className="flex items-center gap-1 text-emerald-400">
                                                    <ShieldCheck className="w-4 h-4" />
                                                    Verified
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-amber-400">
                                                    <ShieldX className="w-4 h-4" />
                                                    Not Verified
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-1 text-sm text-slate-300">
                                                <Clock className="w-4 h-4 text-slate-400" />
                                                {formatDate(session.createdAt)}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`text-sm ${isExpired(session.expiresAt) ? 'text-red-400' : 'text-slate-300'}`}>
                                                {formatDate(session.expiresAt)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <button
                                                onClick={() => handleRevokeSession(session.id)}
                                                disabled={actionLoading === session.id}
                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                                title="Revoke Session"
                                            >
                                                {actionLoading === session.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </CardWithHeader>
        </div>
    );
};

export default AdminSessionsView;






