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
  health_score: number;
}

const CustomerAnalyticsView: React.FC = () => {
  const [metrics, setMetrics] = useState<OrgMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalOrgs: 0,
    totalUsers: 0,
    avgHealthScore: 0,
    totalAICalls: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const usage = await Api.getUsageByOrganization();

        const orgMetrics: OrgMetrics[] = (usage || []).map((org: any) => {
          const safeName =
            org.name || org.org_name || org.organization_name || 'Unknown Organization';
          const aiCalls = Number(org.ai_calls || org.ai_calls_30d || 0);
          const userCount = Number(org.user_count || 0);
          const derivedHealth =
            aiCalls > 0
              ? Math.min(
                  100,
                  Math.max(50, 60 + Math.log(aiCalls + 1) * 10 + Math.min(userCount, 10))
                )
              : 60;
          return {
            org_id: org.id,
            org_name: String(safeName),
            user_count: userCount,
            ai_calls_30d: aiCalls,
            last_activity: org.last_ai_activity || org.updated_at || null,
            health_score: Math.min(
              100,
              Math.max(0, Math.round(org.health_score || derivedHealth || 0))
            ),
          };
        });

        // Fallback if no usage data
        if (orgMetrics.length === 0) {
          const orgs = await Api.getOrganizations();
          orgMetrics.push(
            ...orgs.map((org: any) => ({
              org_id: org.id,
              org_name: String(org.name || org.organization_name || 'Unknown Organization'),
              user_count: org.user_count || 0,
              ai_calls_30d: 0,
              last_activity: org.updated_at || null,
              health_score: 0,
            }))
          );
        }

        setMetrics(orgMetrics);

        const totalUsers = orgMetrics.reduce((acc, o) => acc + (o.user_count || 0), 0);
        const totalAICalls = orgMetrics.reduce((acc, o) => acc + (o.ai_calls_30d || 0), 0);
        const avgHealthScore =
          orgMetrics.length > 0
            ? Math.round(
                orgMetrics.reduce((acc, m) => acc + (m.health_score || 0), 0) / orgMetrics.length
              )
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
          <h2 className="text-2xl font-bold text-white">Customer Analytics</h2>
          <p className="text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">
            Overview of customer health and engagement
          </p>
        </div>
        <InfoButton cardId="superadmin-analytics-customers" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{summary.totalOrgs}</p>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                Organizations
              </span>
            </div>
          </div>
        </Card>
        <Card className="bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{summary.totalUsers}</p>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                Total Users
              </span>
            </div>
          </div>
        </Card>
        <Card className="bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <BarChart3 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{summary.avgHealthScore}%</p>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                Avg Health Score
              </span>
            </div>
          </div>
        </Card>
        <Card className="bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {summary.totalAICalls.toLocaleString()}
              </p>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                AI Calls (30d)
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Organization Health Table */}
      <Card className="bg-gray-800 p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Organization Health</h3>
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-400 dark:text-gray-500 dark:text-gray-400 text-sm border-b border-gray-700">
              <th className="pb-3">Organization</th>
              <th className="pb-3">Users</th>
              <th className="pb-3">AI Calls (30d)</th>
              <th className="pb-3">Health Score</th>
              <th className="pb-3">Trend</th>
            </tr>
          </thead>
          <tbody>
            {sortedMetrics.map((org) => (
              <tr key={org.org_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-3 text-white font-medium">{org.org_name}</td>
                <td className="py-3 text-gray-300">{org.user_count}</td>
                <td className="py-3 text-gray-300">{org.ai_calls_30d.toLocaleString()}</td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
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
                    <span className="text-sm text-gray-300">{org.health_score}%</span>
                  </div>
                </td>
                <td className="py-3">
                  {org.health_score >= 70 ? (
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

export default CustomerAnalyticsView;
