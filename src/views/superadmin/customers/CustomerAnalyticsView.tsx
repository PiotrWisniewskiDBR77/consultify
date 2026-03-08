/**
 * CustomerAnalyticsView - Customer Analytics Dashboard
 */

import { BarChart3, Building2, Loader2, TrendingDown, TrendingUp, Users } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { Card } from '../../../components/Admin/shared/Card';
import { InfoButton } from '../../../components/shared/InfoButton';
import Api from '../../../services/api';

interface OrgMetrics {
  org_id: string;
  org_name: string;
  user_count: number;
  ai_calls_30d: number;
  last_activity?: string | null;
  health_score: number | null;
}

const CustomerAnalyticsView: React.FC = () => {
  const [metrics, setMetrics] = useState<OrgMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    totalOrgs: 0,
    totalUsers: 0,
    avgHealthScore: 0,
    totalAICalls: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const usage = await Api.getUsageByOrganization();

        const orgMetrics: OrgMetrics[] = (usage || []).map((org: any) => {
          const safeName =
            org.name || org.org_name || org.organization_name || 'Unknown Organization';
          const aiCalls = Number(org.ai_calls || org.ai_calls_30d || 0);
          const userCount = Number(org.user_count || 0);
          const rawHealth = org.health_score;
          const health =
            rawHealth === null || rawHealth === undefined || rawHealth === ''
              ? null
              : Number(rawHealth);
          return {
            org_id: org.id,
            org_name: String(safeName),
            user_count: userCount,
            ai_calls_30d: aiCalls,
            last_activity: org.last_ai_activity || org.updated_at || null,
            health_score:
              health === null || Number.isNaN(health)
                ? null
                : Math.min(100, Math.max(0, Math.round(health))),
          };
        });

        setMetrics(orgMetrics);

        const totalUsers = orgMetrics.reduce((acc, o) => acc + (o.user_count || 0), 0);
        const totalAICalls = orgMetrics.reduce((acc, o) => acc + (o.ai_calls_30d || 0), 0);
        const healthValues = orgMetrics
          .map((m) => m.health_score)
          .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
        const avgHealthScore =
          healthValues.length > 0
            ? Math.round(healthValues.reduce((acc, v) => acc + v, 0) / healthValues.length)
            : 0;

        setSummary({
          totalOrgs: orgMetrics.length,
          totalUsers,
          avgHealthScore,
          totalAICalls,
        });
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        setMetrics([]);
        setSummary({ totalOrgs: 0, totalUsers: 0, avgHealthScore: 0, totalAICalls: 0 });
        setError('Failed to load customer analytics. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const sortedMetrics = useMemo(
    () => [...metrics].sort((a, b) => (b.ai_calls_30d || 0) - (a.ai_calls_30d || 0)),
    [metrics]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Customer Analytics</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Overview of customer health and engagement
          </p>
        </div>
        <InfoButton cardId="superadmin-analytics-customers" />
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {summary.totalOrgs}
              </p>
              <span className="text-xs text-slate-600 dark:text-slate-400">Organizations</span>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {summary.totalUsers}
              </p>
              <span className="text-xs text-slate-600 dark:text-slate-400">Total Users</span>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <BarChart3 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {summary.avgHealthScore}%
              </p>
              <span className="text-xs text-slate-600 dark:text-slate-400">Avg Health Score</span>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {summary.totalAICalls.toLocaleString()}
              </p>
              <span className="text-xs text-slate-600 dark:text-slate-400">AI Calls (30d)</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Organization Health Table */}
      <Card padding="sm">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Organization Health
        </h3>
        {sortedMetrics.length === 0 ? (
          <div className="py-10 text-center text-slate-600 dark:text-slate-400">
            No analytics data available yet.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 text-sm border-b border-slate-200 dark:border-white/10">
                <th className="pb-3">Organization</th>
                <th className="pb-3">Users</th>
                <th className="pb-3">AI Calls (30d)</th>
                <th className="pb-3">Health Score</th>
                <th className="pb-3">Trend</th>
              </tr>
            </thead>
            <tbody>
              {sortedMetrics.map((org) => (
                <tr
                  key={org.org_id}
                  className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <td className="py-3 text-slate-900 dark:text-white font-medium">
                    {org.org_name}
                  </td>
                  <td className="py-3 text-slate-700 dark:text-slate-300">{org.user_count}</td>
                  <td className="py-3 text-slate-700 dark:text-slate-300">
                    {org.ai_calls_30d.toLocaleString()}
                  </td>
                  <td className="py-3">
                    {typeof org.health_score === 'number' ? (
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              org.health_score >= 80
                                ? 'bg-green-500'
                                : org.health_score >= 60
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                            }`}
                            style={{ width: `${org.health_score}%` }}
                          />
                        </div>
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {org.health_score}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-600 dark:text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3">
                    {typeof org.health_score === 'number' && org.health_score >= 70 ? (
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    ) : typeof org.health_score === 'number' ? (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};

export default CustomerAnalyticsView;
