import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Mail,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { LoadingState as SharedLoadingState } from '@/components/shared/states';
import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';

export const AdminMetricsDashboardView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [helpMetrics, setHelpMetrics] = useState<any>(null);
  const [teamMetrics, setTeamMetrics] = useState<any>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [overviewData, helpData, teamData, eventsData] = await Promise.all([
        Api.getOrgMetricsOverview(),
        Api.getOrgMetricsHelp(),
        Api.getOrgMetricsTeam(),
        Api.getOrgMetricsEvents(20).catch(() => ({ events: [] })),
      ]);

      setOverview({
        ...overviewData,
        // Use real active users from overview
        activeUsers: overviewData?.activeUsers || 0,
        // Use real seat data if available
        seatConfiguration: overviewData?.seatConfiguration,
      });
      setHelpMetrics(helpData);
      setTeamMetrics({
        ...teamData,
        // Use real seat management data
        seatManagement: teamData?.seatManagement,
      });
      setRecentEvents(eventsData.events || []);
    } catch (err: any) {
      console.error('Failed to fetch org metrics:', err);
      toast.error('Failed to load organization metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <SharedLoadingState variant="progress" label="Crunching your organization's data…" />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
      <InfoButton cardId="admin-metrics" position="top-right" />
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-c-surface p-6 rounded-xl border border-c-border-subtle shadow-sm dark:shadow-none">
        <div>
          <h1 className="text-3xl font-extrabold text-navy-900 dark:text-white tracking-tight flex items-center gap-3">
            <TrendingUp className="text-blue-400" size={32} />
            Conversion Intelligence
          </h1>
          <p className="text-c-text-muted mt-1 max-w-2xl">
            Monitor your organization's adoption, efficiency, and growth metrics in real-time.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95 whitespace-nowrap"
        >
          <RefreshCw size={18} /> Refresh Analysis
        </button>
      </div>

      {/* Top Level KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Team Adoption Rate"
          value={`${teamMetrics?.invitations?.acceptanceRate || 0}%`}
          subtitle={`${teamMetrics?.invitations?.accepted || 0} / ${teamMetrics?.invitations?.sent || 0} accepted`}
          icon={<Users className="text-primary-400" />}
          trend={
            teamMetrics?.seatManagement
              ? `${teamMetrics.seatManagement.seatsUsed}/${teamMetrics.seatManagement.totalSeats} seats`
              : teamMetrics?.invitations?.sent > 0
                ? `${teamMetrics.invitations.pending} pending`
                : 'No data'
          }
          color="purple"
        />
        <MetricCard
          title="Playbook Completion"
          value={`${helpMetrics?.byPlaybook?.length > 0 ? Math.round(helpMetrics.byPlaybook.reduce((acc: any, p: any) => acc + p.completionRate, 0) / helpMetrics.byPlaybook.length) : 0}%`}
          subtitle="Avg. Help Effectiveness"
          icon={<BookOpen className="text-blue-400" />}
          trend={
            helpMetrics?.byPlaybook?.length > 0
              ? `${helpMetrics.byPlaybook.length} playbooks`
              : 'No data'
          }
          color="cyan"
        />
        <MetricCard
          title="Active Users"
          value={overview?.activeUsers || overview?.seatConfiguration?.seatsUsed || 0}
          subtitle={
            overview?.seatConfiguration
              ? `${overview.seatConfiguration.seatsRemaining} seats remaining`
              : '30-Day Activity'
          }
          icon={<Activity className="text-green-400" />}
          trend={
            overview?.seatConfiguration
              ? `${overview.seatConfiguration.utilizationPercent}% utilized`
              : overview?.activeUsers > 0
                ? 'Active'
                : 'No activity'
          }
          color="green"
        />
        <MetricCard
          title="Conversion Success"
          value={
            overview?.conversionTarget || overview?.orgStatus === 'enterprise'
              ? 'Enterprise'
              : 'Paid'
          }
          subtitle="Current Status"
          icon={<Target className="text-amber-400" />}
          trend={
            overview?.orgStatus === 'trial' ? `${overview?.daysLeft || 0} days left` : 'ON TRACK'
          }
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Team Readiness Funnel */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-c-surface border border-c-border-subtle rounded-xl p-8 shadow-sm dark:shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-500/10 rounded-lg">
                  <Users className="text-primary-400" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-navy-900 dark:text-white">
                    Team Onboarding Funnel
                  </h2>
                  <p className="text-xs text-c-text-muted">
                    How your team is joining the platform
                  </p>
                </div>
              </div>
            </div>

            <div className="relative pt-4 pb-8">
              <FunnelStep
                label="Invitations Sent"
                value={teamMetrics?.invitations?.sent || 0}
                percent={100}
                color="bg-slate-700"
              />
              <div className="h-8 flex justify-center py-1">
                <div className="w-0.5 bg-gradient-to-b from-slate-700 to-primary-600 opacity-50" />
              </div>
              <FunnelStep
                label="Invitations Accepted"
                value={teamMetrics?.invitations?.accepted || 0}
                percent={teamMetrics?.invitations?.acceptanceRate || 0}
                color="bg-navy-900"
              />
              <div className="h-8 flex justify-center py-1">
                <div className="w-0.5 bg-gradient-to-b from-primary-600 to-green-600 opacity-50" />
              </div>
              <FunnelStep
                label="Self-Service Users"
                value={overview?.selfServeUsers || overview?.activeUsers || 0}
                percent={
                  teamMetrics?.invitations?.sent > 0 && overview?.activeUsers > 0
                    ? Math.round((overview.activeUsers / teamMetrics.invitations.sent) * 100)
                    : overview?.activeUsers > 0
                      ? 100
                      : 0
                }
                color="bg-green-600"
              />
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4 pt-6 border-t border-white/5 text-center">
              <div>
                <p className="text-[10px] text-c-text-muted uppercase font-bold tracking-widest">
                  Sent
                </p>
                <p className="text-xl font-bold text-navy-900 dark:text-white mt-1">
                  {teamMetrics?.invitations?.sent || 0}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-c-text-muted uppercase font-bold tracking-widest">
                  Pending
                </p>
                <p className="text-xl font-bold text-amber-400 mt-1">
                  {teamMetrics?.invitations?.pending || 0}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-c-text-muted uppercase font-bold tracking-widest">
                  Success Rate
                </p>
                <p className="text-xl font-bold text-blue-400 mt-1">
                  {teamMetrics?.invitations?.acceptanceRate || 0}%
                </p>
              </div>
            </div>
          </div>

          {/* Playbook Adoption */}
          <div className="bg-c-surface border border-c-border-subtle rounded-xl p-8 shadow-sm dark:shadow-xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <BookOpen className="text-blue-400" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-navy-900 dark:text-white">
                  Help & Training ROI
                </h2>
                <p className="text-xs text-c-text-muted">
                  Completion rates across guidance playbooks
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {helpMetrics?.byPlaybook?.length > 0 ? (
                helpMetrics.byPlaybook.map((playbook: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-c-surface-raised/50 border border-c-border-subtle rounded-xl p-4 hover:border-secondary-500/30 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-navy-900 dark:text-white truncate group-hover:text-secondary-600 dark:group-hover:text-blue-400 transition-colors">
                          {playbook.playbookKey.replace(/_/g, ' ')}
                        </h3>
                        <p className="text-[10px] text-c-text-muted mt-0.5">
                          {playbook.started} Attempts
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-secondary-600 dark:text-blue-400">
                          {playbook.completionRate}%
                        </p>
                        <p className="text-[10px] text-c-text-muted uppercase font-bold tracking-tighter">
                          Success
                        </p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-200 dark:bg-navy-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-secondary-600 to-primary-500 dark:from-blue-600 dark:to-blue-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                        style={{ width: `${playbook.completionRate}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center py-12 text-c-text-muted italic">
                  No playbook interactions recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity & Status - DBR77 Compatible */}
        <div className="space-y-8">
          <div className="bg-c-surface dark:bg-gradient-to-br dark:from-blue-900/40 dark:to-navy-900 border border-c-border-subtle dark:border-blue-500/20 rounded-xl p-6 shadow-sm dark:shadow-xl relative overflow-hidden group">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-c-surface-raised dark:bg-blue-500/10 rounded-full blur-3xl group-hover:bg-slate-200 dark:group-hover:bg-blue-500/20 transition-all duration-700" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 text-c-text-secondary dark:text-blue-400 mb-4 font-bold text-xs uppercase tracking-widest">
                <CheckCircle2 size={16} />
                Conversion Status
              </div>
              <h3 className="text-2xl font-black text-navy-900 dark:text-white mb-2">
                {overview?.orgStatus === 'trial' ? 'Organization in Trial' : 'Enterprise Account'}
              </h3>
              <p className="text-c-text-secondary text-sm leading-relaxed mb-6">
                {overview?.orgStatus === 'trial'
                  ? `Your trial expires in ${overview?.daysLeft || 0} days. Your engagement score is high, indicating a healthy adoption path.`
                  : 'Your organization is fully licensed and performing at peak efficiency.'}
              </p>
              <div className="flex items-center gap-4 pt-4 border-t border-white/20 dark:border-navy-700">
                <div className="flex-1">
                  <div className="flex justify-between text-[10px] font-bold text-c-text-secondary mb-1 uppercase">
                    <span>Trial Progress</span>
                    <span>{Math.round(((30 - (overview?.daysLeft || 0)) / 30) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-c-surface/20 dark:bg-navy-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-c-surface dark:bg-blue-500"
                      style={{
                        width: `${Math.round(((30 - (overview?.daysLeft || 0)) / 30) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-c-surface border border-c-border-subtle rounded-xl overflow-hidden shadow-sm dark:shadow-xl">
            <div className="p-6 border-b border-c-border-subtle flex items-center justify-between">
              <h3 className="font-bold text-navy-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-widest">
                <Activity size={16} className="text-success-600 dark:text-green-400" />
                Metric Feed
              </h3>
              <button className="text-[10px] font-bold text-primary-600 dark:text-blue-400 hover:text-primary-700 dark:hover:text-blue-300 transition-colors">
                VIEW ALL
              </button>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-white/5 max-h-[500px] overflow-y-auto">
              {recentEvents.length > 0 ? (
                recentEvents.map((event, idx) => <EventRow key={idx} event={event} />)
              ) : (
                <div className="p-12 text-center text-c-text-muted text-xs italic">
                  No recent events tracked.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend: string;
  color: 'blue' | 'purple' | 'cyan' | 'green' | 'orange';
}

/**
 * MetricCard - DBR77 Color System Compatible
 * Light mode: white background, dark text
 * Dark mode: navy background, light text
 */
const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon, trend, color }) => {
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30 dark:border-blue-500/20',
    purple:
      'text-primary-600 dark:text-primary-400 bg-primary-500/10 border-primary-500/30 dark:border-primary-500/20',
    cyan: 'text-secondary-600 dark:text-blue-400 bg-secondary-500/10 border-secondary-500/30 dark:border-blue-500/20',
    green:
      'text-success-600 dark:text-green-400 bg-success-500/10 border-success-500/30 dark:border-green-500/20',
    orange:
      'text-primary-600 dark:text-amber-400 bg-primary-500/10 border-primary-500/30 dark:border-amber-500/20',
  };

  return (
    <div className="bg-c-surface/80 border border-c-border-subtle rounded-xl p-6 shadow-sm dark:shadow-lg backdrop-blur-sm group hover:border-primary-500/30 dark:hover:border-white/20 transition-all hover:translate-y-[-2px]">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl border ${colorClasses[color]}`}>
          {React.cloneElement(icon as React.ReactElement, { size: 24 } as any)}
        </div>
        <div className="flex flex-col items-end">
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-full ${colorClasses[color]}`}
          >
            {trend}
          </span>
          <span className="text-[9px] text-c-text-muted mt-1 uppercase font-bold tracking-tighter">
            v. Prev Month
          </span>
        </div>
      </div>
      <h3 className="text-c-text-secondary text-xs font-bold uppercase tracking-widest">
        {title}
      </h3>
      <div className="flex items-baseline gap-2 mt-1">
        <p className="text-3xl font-black text-navy-900 dark:text-white tracking-tighter">
          {value}
        </p>
        <p className="text-[10px] text-c-text-muted font-medium truncate">
          {subtitle}
        </p>
      </div>
    </div>
  );
};

const FunnelStep: React.FC<{ label: string; value: number; percent: number; color: string }> = ({
  label,
  value,
  percent,
  color,
}) => (
  <div className="group">
    <div className="flex items-center gap-4 mb-2 px-2">
      <div className="w-24 text-right">
        <p className="text-xs font-bold text-c-text-secondary">{label}</p>
        <p className="text-[10px] text-primary-600 dark:text-amber-400 font-black">
          {Math.round(percent)}% COV
        </p>
      </div>
      <div className="flex-1 h-12 relative flex items-center">
        <div className="absolute inset-0 bg-c-surface-raised dark:bg-c-surface/5 rounded-xl border border-c-border-subtle" />
        <div
          className={`h-full ${color} rounded-xl transition-all duration-1000 shadow-xl opacity-80 group-hover:opacity-100`}
          style={{ width: `${percent}%` }}
        />
        <div className="absolute left-4 font-black text-white text-xl tracking-tighter drop-shadow-md">
          {value}
        </div>
      </div>
    </div>
  </div>
);

const EventRow: React.FC<{ event: any }> = ({ event }) => {
  const isHelp = event.event_type.includes('help');
  const isInvite = event.event_type.includes('invite');
  const isTrial = event.event_type.includes('trial');

  const getIcon = () => {
    if (isHelp) return <BookOpen size={14} className="text-blue-400" />;
    if (isInvite) return <Mail size={14} className="text-primary-400" />;
    if (isTrial) return <Clock size={14} className="text-blue-400" />;
    return <Activity size={14} className="text-c-text-muted" />;
  };

  const formatContext = () => {
    if (event.context?.playbookKey)
      return `Playbook: ${event.context.playbookKey.replace(/_/g, ' ')}`;
    if (event.context?.email) return `Target: ${event.context.email}`;
    return event.source || 'System';
  };

  return (
    <div className="p-4 hover:bg-c-bg dark:hover:bg-c-surface/5 transition-colors flex items-center gap-4 group">
      <div className="w-8 h-8 rounded-lg bg-c-surface-raised border border-c-border-subtle flex items-center justify-center shrink-0 group-hover:border-primary-500/30 dark:group-hover:border-white/20 transition-all">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-navy-900 dark:text-white uppercase tracking-tight truncate">
          {event.event_type.replace(/_/g, ' ')}
        </p>
        <p className="text-[10px] text-c-text-muted mt-0.5 truncate">
          {formatContext()}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[10px] font-bold text-c-text-muted">
          {new Date(event.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <p className="text-[9px] text-c-text-muted mt-0.5">
          {new Date(event.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};
