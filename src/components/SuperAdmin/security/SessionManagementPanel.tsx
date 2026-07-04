/**
 * SessionManagementPanel - Active Session Management
 *
 * Features:
 * - Lista aktywnych sesji per user/org
 * - Force logout funkcjonalność
 * - Device fingerprint display
 * - Geolocation info
 */

import {
  Activity,
  AlertTriangle,
  Building2,
  ChevronDown,
  Clock,
  Filter,
  Globe,
  Loader2,
  LogOut,
  MapPin,
  Monitor,
  RefreshCw,
  Search,
  Smartphone,
  Tablet,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

interface Session {
  id: string;
  user_id: string;
  organization_id: string;
  user_email?: string;
  user_first_name?: string;
  user_last_name?: string;
  organization_name?: string;
  device_fingerprint?: string;
  device_type?: string;
  device_name?: string;
  browser?: string;
  os?: string;
  ip_address?: string;
  location?: string;
  created_at: string;
  last_activity: string;
  expires_at: string;
  is_active: boolean;
}

interface Organization {
  id: string;
  name: string;
}

export const SessionManagementPanel: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [terminatingIds, setTerminatingIds] = useState<Set<string>>(new Set());

  const fetchOrganizations = useCallback(async () => {
    try {
      const orgs = await Api.getOrganizations();
      setOrganizations(orgs);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      if (selectedOrgId === 'all') {
        const result = await Api.get('/security-policies/sessions/all');
        setSessions(result.sessions || []);
      } else {
        const result = await Api.get(`/security-policies/${selectedOrgId}/sessions`);
        setSessions(result.sessions || []);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleTerminateSession = async (sessionId: string) => {
    setTerminatingIds((prev) => new Set(prev).add(sessionId));
    try {
      await Api.post(`/security-policies/sessions/${sessionId}/terminate`, {
        reason: 'admin_action',
      });
      toast.success('Session terminated');
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (error: any) {
      toast.error(error.message || 'Failed to terminate session');
    } finally {
      setTerminatingIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

  const handleTerminateAllForUser = async (userId: string, orgId: string) => {
    try {
      await Api.post(`/security-policies/${orgId}/sessions/terminate-all`, {
        userId,
        reason: 'admin_action',
      });
      toast.success('All user sessions terminated');
      setSessions((prev) => prev.filter((s) => s.user_id !== userId));
    } catch (error: any) {
      toast.error(error.message || 'Failed to terminate sessions');
    }
  };

  const getDeviceIcon = (deviceType?: string) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
      case 'phone':
        return <Smartphone size={18} />;
      case 'tablet':
        return <Tablet size={18} />;
      default:
        return <Monitor size={18} />;
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diff = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const filteredSessions = sessions.filter((session) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      session.user_email?.toLowerCase().includes(query) ||
      session.user_first_name?.toLowerCase().includes(query) ||
      session.user_last_name?.toLowerCase().includes(query) ||
      session.ip_address?.includes(query) ||
      session.location?.toLowerCase().includes(query)
    );
  });

  // Group sessions by user
  const sessionsByUser = filteredSessions.reduce(
    (acc, session) => {
      const key = session.user_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(session);
      return acc;
    },
    {} as Record<string, Session[]>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
            />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text placeholder:text-slate-500 dark:text-slate-400 focus:border-c-focus-solid outline-none w-64"
            />
          </div>

          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:border-c-focus-solid outline-none"
          >
            <option value="all">All Organizations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-c-surface-raised/50 rounded-lg">
            <Activity size={16} className="text-emerald-400" />
            <span className="text-sm text-slate-600">{sessions.length} Active</span>
          </div>
          <button
            onClick={fetchSessions}
            className="p-2.5 bg-c-surface-raised hover:bg-c-surface-raised rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw
              size={18}
              className={`text-slate-600 dark:text-slate-500 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Sessions List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600 dark:text-slate-500">
          <Users size={48} className="mb-4 opacity-50" />
          <p>No active sessions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(sessionsByUser).map(([userId, userSessions]) => {
            const firstSession = userSessions[0];
            return (
              <div
                key={userId}
                className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl overflow-hidden"
              >
                {/* User Header */}
                <div className="flex items-center justify-between p-4 bg-c-surface/30">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-crimson-700 flex items-center justify-center text-white font-semibold">
                      {firstSession.user_first_name?.[0] || firstSession.user_email?.[0] || 'U'}
                    </div>
                    <div>
                      <p className="font-medium text-c-text">
                        {firstSession.user_first_name}{' '}
                        {firstSession.user_last_name || firstSession.user_email}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-500">
                        {firstSession.user_email}
                      </p>
                    </div>
                    {firstSession.organization_name && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-c-surface-raised rounded-full">
                        <Building2 size={12} className="text-slate-600 dark:text-slate-500" />
                        <span className="text-xs text-slate-600">
                          {firstSession.organization_name}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 dark:text-slate-500">
                      {userSessions.length} session(s)
                    </span>
                    {userSessions.length > 1 && (
                      <button
                        onClick={() =>
                          handleTerminateAllForUser(userId, firstSession.organization_id)
                        }
                        className="flex items-center gap-2 px-3 py-1.5 bg-danger-500/10 hover:bg-danger-500/20 text-danger-400 rounded-lg text-sm transition-colors"
                      >
                        <LogOut size={14} />
                        End All
                      </button>
                    )}
                  </div>
                </div>

                {/* Sessions */}
                <div className="divide-y divide-white/[0.04]">
                  {userSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 hover:bg-c-surface-raised/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-c-surface/50 flex items-center justify-center text-slate-600 dark:text-slate-500">
                          {getDeviceIcon(session.device_type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-c-text">
                              {session.browser || 'Unknown Browser'}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">•</span>
                            <span className="text-slate-600 dark:text-slate-500">
                              {session.os || 'Unknown OS'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <Globe size={12} />
                              {session.ip_address || 'Unknown IP'}
                            </span>
                            {session.location && (
                              <span className="flex items-center gap-1">
                                <MapPin size={12} />
                                {session.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-500">
                            <Clock size={14} />
                            <span>Active {formatTimeAgo(session.last_activity)}</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Started {new Date(session.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleTerminateSession(session.id)}
                          disabled={terminatingIds.has(session.id)}
                          className="p-2 hover:bg-danger-500/10 text-slate-600 dark:text-slate-500 hover:text-danger-400 rounded-lg transition-colors disabled:opacity-50"
                          title="Terminate Session"
                        >
                          {terminatingIds.has(session.id) ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <LogOut size={18} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SessionManagementPanel;
