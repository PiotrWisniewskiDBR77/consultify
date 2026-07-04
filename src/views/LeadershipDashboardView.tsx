// import { translations } from '../translations';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  DollarSign,
  PieChart,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { sendMessageToAI } from '@/services/ai/gemini';
import { Api } from '@/services/api';

import { SplitLayout } from '../components/layout/SplitLayout';
import { useAppStore } from '../store/useAppStore';

interface HealthData {
  initiativesByStatus?: Array<{ status: string; count: number }>;
  overdueTasks?: number;
}
interface EconomicsData {
  total_cost?: number;
  expected_benefit?: number;
  actualSpend?: number;
}
interface PerformanceUser {
  id: string;
  first_name: string;
  last_name: string;
  completed_tasks: number;
  total_tasks: number;
  overdue_tasks: number;
}
interface MetricCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  trend?: string;
  trendUp?: boolean;
  icon: React.ReactNode;
  color: string;
}
const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subValue,
  trend,
  trendUp,
  icon,
  color,
}) => (
  <div className="bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-xl p-4 relative overflow-hidden group hover:border-blue-500/30 dark:hover:border-c-border-subtle transition-colors shadow-sm dark:shadow-none">
    <div
      className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}
    >
      {icon}
    </div>
    <div className="relative z-10">
      <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wider">
        <span className={color}>{icon}</span>
        {title}
      </div>
      <div className="text-2xl font-bold text-navy-900 dark:text-white mb-1">{value}</div>
      {(subValue || trend) && (
        <div className="flex items-center gap-2 text-xs">
          {subValue && <span className="text-slate-500 dark:text-slate-400">{subValue}</span>}
          {trend && (
            <span
              className={`flex items-center gap-0.5 ${trendUp ? 'text-green-400' : 'text-danger-400'}`}
            >
              {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  </div>
);
export const LeadershipDashboardView: React.FC = () => {
  const { currentUser, addChatMessage: addMessage } = useAppStore();
  // State for dashboard data
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceUser[]>([]);
  const [economicsData, setEconomicsData] = useState<EconomicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const language = currentUser?.preferredLanguage || 'EN';
  useEffect(() => {
    const loadAnalytics = async () => {
      if (!currentUser?.organizationId) return;
      try {
        // Use Api service for analytics endpoints
        const [healthRes, perfRes, ecoRes] = await Promise.all([
          Api.getAnalyticsHealth(),
          Api.getAnalyticsPerformance(),
          Api.getAnalyticsEconomics(),
        ]);
        setHealthData(healthRes);
        setPerformanceData(perfRes);
        setEconomicsData(ecoRes);
      } catch (error) {
        console.error('Failed to load analytics', error);
      } finally {
        setLoading(false);
      }
    };
    loadAnalytics();
  }, [currentUser]);
  const handleAiChat = (text: string) => {
    addMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() });
  };
  if (loading) {
    return (
      <SplitLayout title="Leadership Dashboard">
        <div className="w-full h-full bg-gray-50 dark:bg-navy-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </SplitLayout>
    );
  }
  return (
    <SplitLayout title="Leadership Dashboard">
      <div className="w-full h-full bg-gray-50 dark:bg-navy-900 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Section 1: Economic Impact (The "CFO View") */}
          <div>
            <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
              <DollarSign className="text-green-400" /> Economic Value Realization
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricCard
                title="Total Investment"
                key="capex"
                value={`$${(economicsData?.total_cost || 0) / 1000}k`}
                subValue="Capex + Opex"
                icon={<DollarSign size={16} />}
                color="text-blue-400"
              />
              <MetricCard
                title="Expected ROI"
                key="roi"
                value={`${(economicsData?.expected_benefit || 0) / 1000}k`}
                subValue="Annual Benefit"
                trend="+24%"
                trendUp={true}
                icon={<TrendingUp size={16} />}
                color="text-green-400"
              />
              <MetricCard
                title="Actual Spend"
                key="spend"
                value={`$${(economicsData?.actualSpend || 0) / 1000}k`}
                subValue={`${Math.round(((economicsData?.actualSpend || 0) / (economicsData?.total_cost || 1)) * 100)}% of Budget`}
                icon={<Activity size={16} />}
                color="text-primary-400"
              />
              <MetricCard
                title="Net Value"
                key="net"
                value={`$${((economicsData?.expected_benefit || 0) - (economicsData?.actualSpend || 0)) / 1000}k`}
                subValue="Projected"
                icon={<PieChart size={16} />}
                color="text-slate-600 dark:text-slate-500"
              />
            </div>
          </div>
          {/* Section 2: Initiative Health (The "COO View") */}
          <div>
            <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity className="text-blue-400" /> Initiative Health
            </h2>
            <div className="bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-xl p-6 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-around text-center">
                {healthData?.initiativesByStatus?.map(
                  (statusItem: { status: string; count: number }) => (
                    <div key={statusItem.status} className="flex flex-col gap-2">
                      <div className="text-3xl font-bold text-navy-900 dark:text-white">
                        {statusItem.count}
                      </div>
                      <div className="text-xs uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wider">
                        {statusItem.status.replace('_', ' ')}
                      </div>
                      <div className="h-1 w-12 bg-blue-500/20 rounded-full mx-auto overflow-hidden">
                        <div className="h-full bg-blue-500 w-full"></div>
                      </div>
                    </div>
                  )
                )}
                {!healthData?.initiativesByStatus?.length && (
                  <div className="text-slate-500 dark:text-slate-400">
                    No active initiatives found.
                  </div>
                )}
                <div className="w-px h-16 bg-white/10"></div>
                <div className="flex flex-col gap-2">
                  <div className="text-3xl font-bold text-danger-400">
                    {healthData?.overdueTasks || 0}
                  </div>
                  <div className="text-xs uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wider">
                    Overdue Tasks
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Section 3: People & Teams (The "CHRO View") */}
          <div>
            <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="text-primary-400" /> Team Performance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {performanceData.map((user: PerformanceUser) => (
                <div
                  key={user.id}
                  className="bg-white dark:bg-navy-950/30 border border-slate-200 dark:border-navy-700 rounded-xl p-4 flex items-center gap-4 shadow-sm dark:shadow-none"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-lg font-bold text-white">
                    {user.first_name[0]}
                    {user.last_name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-navy-900 dark:text-white">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                      Completion Rate:{' '}
                      {Math.round((user.completed_tasks / (user.total_tasks || 1)) * 100)}%
                    </div>
                    <div className="w-full h-1.5 bg-navy-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-primary-500"
                        style={{
                          width: `${Math.min(100, Math.round((user.completed_tasks / (user.total_tasks || 1)) * 100))}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  {user.overdue_tasks > 0 && (
                    <div className="text-danger-400 text-xs font-bold bg-danger-500/10 px-2 py-1 rounded border border-danger-500/20">
                      {user.overdue_tasks} Overdue
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SplitLayout>
  );
};
