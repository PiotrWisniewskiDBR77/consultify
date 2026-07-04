/**
 * LoginAttemptsPanel - Login Attempts History & Analysis
 *
 * Features:
 * - Tabela login attempts z filtrami
 * - Failed vs success ratio
 * - IP-based analysis
 * - Unlock account button
 */

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  Globe,
  Key,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Shield,
  TrendingDown,
  TrendingUp,
  Unlock,
  User,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

interface LoginAttempt {
  id: string;
  user_email: string;
  user_id?: string;
  organization_id?: string;
  success: number;
  failure_reason?: string;
  auth_method?: string;
  ip_address?: string;
  user_agent?: string;
  location?: string;
  risk_score?: number;
  risk_factors?: string;
  created_at: string;
}

interface Lockout {
  id: string;
  user_email: string;
  user_id?: string;
  firstName?: string;
  lastName?: string;
  reason: string;
  failed_attempts: number;
  locked_at: string;
  expires_at?: string;
  ip_address?: string;
}

interface Organization {
  id: string;
  name: string;
}

interface Stats {
  activeSessions: number;
  loginAttempts: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  };
  activeLockouts: number;
  customPolicies: number;
  loginTrend: Array<{ date: string; successful: number; failed: number }>;
}

export const LoginAttemptsPanel: React.FC = () => {
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [lockouts, setLockouts] = useState<Lockout[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed'>('all');
  const [unlockingIds, setUnlockingIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResult, lockoutsResult] = await Promise.all([
        Api.get('/security-policies/stats?days=7'),
        Api.get('/security-policies/lockouts/all?active=true'),
      ]);
      setStats(statsResult);
      setLockouts(lockoutsResult.lockouts || []);

      // Fetch login attempts
      if (selectedOrgId === 'all') {
        // For SuperAdmin, we need to fetch from multiple orgs or a combined endpoint
        const orgs = await Api.getOrganizations();
        setOrganizations(orgs);

        // Fetch from first few orgs for now
        const allAttempts: LoginAttempt[] = [];
        for (const org of orgs.slice(0, 5)) {
          try {
            const result = await Api.get(`/security-policies/${org.id}/login-attempts?limit=50`);
            allAttempts.push(...(result.attempts || []));
          } catch (e) {
            // Skip failed orgs
          }
        }
        setAttempts(
          allAttempts
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 100)
        );
      } else {
        const result = await Api.get(
          `/security-policies/${selectedOrgId}/login-attempts?limit=100`
        );
        setAttempts(result.attempts || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUnlockAccount = async (email: string) => {
    setUnlockingIds((prev) => new Set(prev).add(email));
    try {
      await Api.post('/security-policies/unlock-account', { email });
      toast.success(`Account ${email} unlocked`);
      setLockouts((prev) => prev.filter((l) => l.user_email !== email));
    } catch (error: any) {
      toast.error(error.message || 'Failed to unlock account');
    } finally {
      setUnlockingIds((prev) => {
        const next = new Set(prev);
        next.delete(email);
        return next;
      });
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const filteredAttempts = attempts.filter((attempt) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !attempt.user_email?.toLowerCase().includes(query) &&
        !attempt.ip_address?.includes(query)
      ) {
        return false;
      }
    }
    if (filterStatus === 'success' && !attempt.success) return false;
    if (filterStatus === 'failed' && attempt.success) return false;
    return true;
  });

  const renderStats = () => {
    if (!stats) return null;

    return (
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={18} className="text-primary-400" />
            <span className="text-sm text-slate-600 dark:text-slate-500">Success Rate</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-c-text">
              {stats.loginAttempts.successRate}%
            </span>
            {stats.loginAttempts.successRate >= 95 ? (
              <TrendingUp size={16} className="text-emerald-400" />
            ) : (
              <TrendingDown size={16} className="text-danger-400" />
            )}
          </div>
        </div>

        <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span className="text-sm text-slate-600 dark:text-slate-500">Successful</span>
          </div>
          <span className="text-2xl font-bold text-c-text">{stats.loginAttempts.successful}</span>
          <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">/ 7 days</span>
        </div>

        <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={18} className="text-danger-400" />
            <span className="text-sm text-slate-600 dark:text-slate-500">Failed</span>
          </div>
          <span className="text-2xl font-bold text-c-text">{stats.loginAttempts.failed}</span>
          <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">/ 7 days</span>
        </div>

        <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-amber-400" />
            <span className="text-sm text-slate-600 dark:text-slate-500">Active Lockouts</span>
          </div>
          <span className="text-2xl font-bold text-c-text">{stats.activeLockouts}</span>
        </div>
      </div>
    );
  };

  const renderLockouts = () => {
    if (lockouts.length === 0) return null;

    return (
      <div className="bg-danger-500/10 border border-danger-500/20 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={20} className="text-danger-400" />
          <h3 className="font-semibold text-c-text">Active Account Lockouts</h3>
          <span className="px-2 py-0.5 bg-danger-500/20 text-danger-400 rounded text-sm">
            {lockouts.length}
          </span>
        </div>

        <div className="space-y-3">
          {lockouts.map((lockout) => (
            <div
              key={lockout.id}
              className="flex items-center justify-between p-3 bg-c-surface/50 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-danger-500/20 flex items-center justify-center">
                  <User size={18} className="text-danger-400" />
                </div>
                <div>
                  <p className="font-medium text-c-text">
                    {lockout.firstName} {lockout.lastName || lockout.user_email}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-500">
                    {lockout.failed_attempts} failed attempts • {lockout.reason}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-sm">
                  <p className="text-slate-600 dark:text-slate-500">
                    Locked {formatDate(lockout.locked_at)}
                  </p>
                  {lockout.expires_at && (
                    <p className="text-slate-500 dark:text-slate-400">
                      Expires {formatDate(lockout.expires_at)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleUnlockAccount(lockout.user_email)}
                  disabled={unlockingIds.has(lockout.user_email)}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors disabled:opacity-50"
                >
                  {unlockingIds.has(lockout.user_email) ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Unlock size={16} />
                  )}
                  Unlock
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      {renderStats()}

      {/* Lockouts */}
      {renderLockouts()}

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
              placeholder="Search by email or IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text placeholder:text-slate-500 dark:text-slate-400 focus:border-c-focus-solid outline-none w-64"
            />
          </div>

          <div className="flex bg-c-surface-raised rounded-lg p-1">
            {(['all', 'success', 'failed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  filterStatus === status
                    ? 'bg-c-text text-c-bg'
                    : 'text-slate-600 dark:text-slate-500 hover:text-white'
                }`}
              >
                {status === 'all' ? 'All' : status === 'success' ? 'Success' : 'Failed'}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={fetchData}
          className="p-2.5 bg-c-surface-raised hover:bg-c-surface-raised rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw
            size={18}
            className={`text-slate-600 dark:text-slate-500 ${loading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* Attempts Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      ) : filteredAttempts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600 dark:text-slate-500">
          <Key size={48} className="mb-4 opacity-50" />
          <p>No login attempts found</p>
        </div>
      ) : (
        <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl overflow-hidden">
          <table /* §27-exempt: panel konfiguracyjny/billingowy, mala tabela ustawien poza zakresem listowym */  className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  Status
                </th>
                <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  User
                </th>
                <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  Method
                </th>
                <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  IP Address
                </th>
                <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  Location
                </th>
                <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAttempts.map((attempt) => (
                <tr key={attempt.id} className="border-b border-white/[0.04] hover:bg-c-surface-raised/50">
                  <td className="p-4">
                    {attempt.success ? (
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 size={16} />
                        <span className="text-sm">Success</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-danger-400">
                          <XCircle size={16} />
                          <span className="text-sm">Failed</span>
                        </div>
                        {attempt.failure_reason && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {attempt.failure_reason}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="text-c-text">{attempt.user_email}</span>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-c-surface/50 rounded text-xs text-slate-600">
                      {attempt.auth_method || 'password'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-500">
                      <Globe size={14} />
                      <span className="text-sm font-mono">{attempt.ip_address || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    {attempt.location && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-500">
                        <MapPin size={14} />
                        <span className="text-sm">{attempt.location}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-500">
                      <Clock size={14} />
                      <span className="text-sm">{formatDate(attempt.created_at)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LoginAttemptsPanel;
