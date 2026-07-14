/**
 * UsageStatsPanel - Usage Statistics Component
 *
 * Shows platform usage statistics per organization.
 */

import {
  AlertTriangle,
  BarChart3,
  Building2,
  Loader2,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Api } from '../../services/api';

interface OrgUsage {
  id: string;
  name: string;
  plan: string;
  userCount: number;
  aiCalls: number;
  tokensUsed: number;
  lastActive: string;
}

export const UsageStatsPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [orgUsage, setOrgUsage] = useState<OrgUsage[]>([]);
  const [totals, setTotals] = useState({
    totalOrgs: 0,
    totalUsers: 0,
    totalAiCalls: 0,
    totalTokens: 0,
  });

  useEffect(() => {
    fetchUsageData();
  }, []);

  const fetchUsageData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Fetch real usage data from the new endpoint
      const [usageData, dashboard] = await Promise.all([
        Api.getUsageByOrganization(),
        Api.getSuperAdminDashboard(),
      ]);

      const usage: OrgUsage[] = usageData.map((org: any) => ({
        id: org.id,
        name: org.name,
        plan: org.plan || 'free',
        userCount: org.user_count || 0,
        aiCalls: org.ai_calls || 0,
        tokensUsed: org.tokens_used || 0,
        lastActive: org.last_ai_activity || '',
      }));

      setOrgUsage(usage);
      setTotals({
        totalOrgs: usageData.length,
        totalUsers: dashboard?.counts?.total_users || 0,
        totalAiCalls: dashboard?.ai?.total_ai_calls || 0,
        totalTokens: dashboard?.ai?.total_tokens || 0,
      });
    } catch (error) {
      console.error('Failed to fetch usage data:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to fetch usage data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-slate-600 dark:text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-danger-200 dark:border-danger-500/20 bg-danger-50 dark:bg-danger-500/10 p-4 text-danger-700 dark:text-danger-300">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            <span>{loadError}</span>
          </div>
          <button
            onClick={fetchUsageData}
            className="px-3 py-1.5 rounded-lg bg-danger-100 hover:bg-danger-200 dark:bg-danger-500/20 dark:hover:bg-danger-500/30 text-sm font-medium"
          >
            Retry
          </button>
        </div>
      )}
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <Building2 size={20} className="text-blue-400" />
            <span className="text-sm text-slate-600 dark:text-slate-500">Organizations</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {totals.totalOrgs}
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <Users size={20} className="text-green-400" />
            <span className="text-sm text-slate-600 dark:text-slate-500">Total Users</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {totals.totalUsers}
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <Zap size={20} className="text-amber-400" />
            <span className="text-sm text-slate-600 dark:text-slate-500">AI Calls</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {totals.totalAiCalls.toLocaleString()}
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={20} className="text-primary-400" />
            <span className="text-sm text-slate-600 dark:text-slate-500">Tokens Used</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {(totals.totalTokens / 1000000).toFixed(2)}M
          </div>
        </div>
      </div>

      {/* Usage Table */}
      <div className="bg-white dark:bg-navy-950/20 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-slate-600 dark:text-slate-500" />
            <h3 className="font-medium text-slate-900 dark:text-white">Usage by Organization</h3>
          </div>
          <button
            onClick={fetchUsageData}
            className="p-2 text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table
            /* §27-exempt: data-viz/render analityczny read-only, nie lista encji */ className="w-full"
          >
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/5">
                <th className="text-left p-4 text-xs text-slate-500 dark:text-slate-400 uppercase">
                  Organization
                </th>
                <th className="text-left p-4 text-xs text-slate-500 dark:text-slate-400 uppercase">
                  Plan
                </th>
                <th className="text-right p-4 text-xs text-slate-500 dark:text-slate-400 uppercase">
                  Users
                </th>
                <th className="text-right p-4 text-xs text-slate-500 dark:text-slate-400 uppercase">
                  AI Calls
                </th>
                <th className="text-right p-4 text-xs text-slate-500 dark:text-slate-400 uppercase">
                  Tokens
                </th>
              </tr>
            </thead>
            <tbody>
              {orgUsage.map((org) => (
                <tr
                  key={org.id}
                  className="border-b border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-navy-800/20"
                >
                  <td className="p-4">
                    <div className="font-medium text-slate-900 dark:text-white">{org.name}</div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        org.plan === 'enterprise'
                          ? 'bg-primary-500/20 text-primary-400'
                          : org.plan === 'pro'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-slate-500/20 text-slate-600 dark:text-slate-500'
                      }`}
                    >
                      {org.plan}
                    </span>
                  </td>
                  <td className="p-4 text-right text-slate-700 dark:text-slate-300">
                    {org.userCount}
                  </td>
                  <td className="p-4 text-right text-slate-700 dark:text-slate-300">
                    {org.aiCalls.toLocaleString()}
                  </td>
                  <td className="p-4 text-right text-slate-700 dark:text-slate-300">
                    {(org.tokensUsed / 1000).toFixed(1)}k
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UsageStatsPanel;
