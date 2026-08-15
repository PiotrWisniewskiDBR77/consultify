/**
 * WorkloadView - Team capacity heatmap
 * Part of My Work Module PMO Upgrade
 *
 * Features:
 * - Team member capacity visualization
 * - Workload status indicators
 * - Overload warnings
 * - Team average summary
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import type {
  TeamWorkloadAiAssessment,
  UserWorkloadAiAssessment,
  WorkloadAiStatus,
} from '../../types/myWork';

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  role: string;
  capacity: number; // Percentage 0-150+
  tasksAssigned: number;
  tasksCompleted: number;
  avatarUrl?: string;
  aiAssessment?: UserWorkloadAiAssessment;
}

const AI_STATUS_STYLES: Record<WorkloadAiStatus, string> = {
  overloaded: 'bg-danger-50 text-danger-700 dark:bg-danger-500/15 dark:text-danger-300',
  optimal: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  underutilized: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
};

/**
 * Capacity Bar Component
 */
const CapacityBar: React.FC<{ capacity: number }> = ({ capacity }) => {
  const getCapacityColor = (value: number) => {
    if (value > 100) return 'bg-rose-500';
    if (value > 80) return 'bg-amber-500';
    if (value > 50) return 'bg-blue-500';
    return 'bg-green-500';
  };

  return (
    <div className="flex-1 h-6 bg-slate-100 dark:bg-navy-800/40 dark:bg-navy-800 rounded-full overflow-hidden relative">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(capacity, 100)}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`h-full ${getCapacityColor(capacity)} rounded-full`}
      />
      {capacity > 100 && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(capacity - 100, 50)}%` }}
          transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
          className="absolute top-0 right-0 h-full bg-rose-300 dark:bg-rose-700 opacity-50"
          style={{ width: `${Math.min(capacity - 100, 50)}%` }}
        />
      )}
    </div>
  );
};

/**
 * Status Badge Component
 */
const StatusBadge: React.FC<{ capacity: number }> = ({ capacity }) => {
  const { t } = useTranslation();

  if (capacity > 100) {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 font-medium flex items-center gap-1">
        <AlertTriangle size={10} />
        {t('workload.overloaded', 'Overloaded')}
      </span>
    );
  }
  if (capacity < 50) {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium flex items-center gap-1">
        <CheckCircle2 size={10} />
        {t('workload.available', 'Available')}
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-navy-800/40 text-slate-600 dark:bg-white/5 dark:text-slate-400 font-medium">
      {t('workload.ok', 'OK')}
    </span>
  );
};

/**
 * Team Member Row Component
 */
const TeamMemberRow: React.FC<{ member: TeamMember }> = ({ member }) => {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-3 bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700 hover:shadow-sm transition-shadow"
    >
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-crimson-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt={member.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            member.initials
          )}
        </div>

        {/* Name & Role */}
        <div className="w-32 min-w-0 shrink-0">
          <p className="text-sm font-medium text-navy-900 dark:text-white truncate">{member.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{member.role}</p>
        </div>

        {/* Capacity Bar */}
        <CapacityBar capacity={member.capacity} />

        {/* Percentage */}
        <span
          className={`w-14 text-sm font-bold text-right shrink-0 ${
            member.capacity > 100
              ? 'text-rose-500'
              : member.capacity > 80
                ? 'text-amber-500'
                : 'text-navy-900 dark:text-white'
          }`}
        >
          {member.capacity}%
        </span>

        {/* Status */}
        <div className="w-24 shrink-0">
          <StatusBadge capacity={member.capacity} />
        </div>

        {/* Tasks */}
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {member.tasksCompleted}/{member.tasksAssigned}
          </p>
        </div>
      </div>

      {member.aiAssessment && (
        <div className="mt-3 ml-14 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${AI_STATUS_STYLES[member.aiAssessment.status]}`}
            >
              <Sparkles size={10} />
              {t(`workload.aiStatus.${member.aiAssessment.status}`, member.aiAssessment.status)}
            </span>
            {typeof member.aiAssessment.meetingHours === 'number' && (
              <span className="text-[10px] text-c-text-muted">
                {member.aiAssessment.meetingHours}h {t('workload.meetings', 'meetings')}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-c-text">{member.aiAssessment.assessment}</p>
          <p className="mt-0.5 text-[11px] text-c-text-muted">
            <span className="font-medium">{t('workload.recommendation', 'Recommendation')}: </span>
            {member.aiAssessment.recommendation}
          </p>
        </div>
      )}
    </motion.div>
  );
};

/**
 * WorkloadView Component - Main Export
 */
export const WorkloadView: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [aiUsed, setAiUsed] = useState<boolean | null>(null);

  const currentProjectId = useAppStore((state) => state.currentProjectId);

  useEffect(() => {
    fetchWorkload();
  }, [currentProjectId]);

  const fetchWorkload = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const url = currentProjectId
        ? `/my-work/team-workload?projectId=${currentProjectId}`
        : `/my-work/team-workload`;

      const [workloadResult, assessmentResult] = await Promise.allSettled([
        Api.get(url),
        Api.get(`/my-work/team-workload/ai-assessment${isRefresh ? '?refresh=1' : ''}`),
      ]);
      const response = workloadResult.status === 'fulfilled' ? workloadResult.value : null;
      const assessment =
        assessmentResult.status === 'fulfilled'
          ? (assessmentResult.value as TeamWorkloadAiAssessment)
          : null;
      const byUser = new Map((assessment?.users || []).map((item) => [item.userId, item]));
      if (Array.isArray(response)) {
        setTeamMembers(
          response.map((member: TeamMember) => ({
            ...member,
            aiAssessment: byUser.get(member.id),
          }))
        );
        setAiUsed(typeof assessment?.aiUsed === 'boolean' ? assessment.aiUsed : null);
      } else {
        setTeamMembers([]);
        setAiUsed(null);
      }
    } catch (error) {
      console.error('Failed to fetch workload:', error);
      setTeamMembers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Calculate team stats
  const avgCapacity =
    teamMembers.length > 0
      ? Math.round(teamMembers.reduce((sum, m) => sum + m.capacity, 0) / teamMembers.length)
      : 0;
  const overloadedCount = teamMembers.filter((m) => m.capacity > 100).length;
  const availableCount = teamMembers.filter((m) => m.capacity < 50).length;

  if (loading) {
    return (
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-8">
        <LoadingState variant="spinner" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 shadow-sm">
      {/* Header */}
      <div className="p-5 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-lg shadow-sm">
              <Users size={20} />
            </div>
            <div>
              <h3 className="font-bold text-navy-900 dark:text-white">
                {t('workload.title', 'Team Workload')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {teamMembers.length} {t('workload.members', 'team members')}
              </p>
              {aiUsed !== null && (
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-c-text-muted">
                  <Sparkles size={10} />
                  {aiUsed
                    ? t('workload.aiAssessment', 'AI assessment')
                    : t('workload.heuristicAssessment', 'Deterministic assessment')}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => fetchWorkload(true)}
            disabled={refreshing}
            className="p-2 rounded-lg bg-slate-100 dark:bg-navy-800/40 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-600 dark:text-slate-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-5 border-b border-slate-200 dark:border-navy-700">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-slate-50 dark:bg-navy-800 rounded-lg">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              {t('workload.avgCapacity', 'Avg Capacity')}
            </p>
            <p
              className={`text-2xl font-bold ${
                avgCapacity > 80 ? 'text-amber-500' : 'text-navy-900 dark:text-white'
              }`}
            >
              {avgCapacity}%
            </p>
          </div>
          <div className="text-center p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
            <p className="text-xs text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1">
              {t('workload.overloaded', 'Overloaded')}
            </p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{overloadedCount}</p>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-xs text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">
              {t('workload.available', 'Available')}
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {availableCount}
            </p>
          </div>
        </div>
      </div>

      {/* Team Members List */}
      <div className="p-5">
        {teamMembers.length > 0 ? (
          <div className="space-y-2">
            {/* Header Row */}
            <div className="flex items-center gap-4 px-3 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <div className="w-10 shrink-0"></div>
              <div className="w-32 shrink-0">{t('workload.member', 'Member')}</div>
              <div className="flex-1">{t('workload.capacity', 'Capacity')}</div>
              <div className="w-14 text-right shrink-0">%</div>
              <div className="w-24 shrink-0">{t('workload.status', 'Status')}</div>
              <div className="text-right shrink-0">{t('workload.tasks', 'Tasks')}</div>
            </div>

            {/* Member Rows */}
            {teamMembers.map((member, index) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <TeamMemberRow member={member} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400 dark:text-slate-500">
            <User size={32} className="mx-auto mb-2 text-slate-700 dark:text-slate-300" />
            <p className="text-sm">{t('workload.noMembers', 'No team members found')}</p>
          </div>
        )}
      </div>

      {/* Team Summary Footer */}
      <div className="px-5 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50 rounded-b-2xl">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            {t('workload.teamAverage', 'Team Average')}:
          </span>
          <div className="flex items-center gap-3">
            <div className="w-32 h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  avgCapacity > 100
                    ? 'bg-rose-500'
                    : avgCapacity > 80
                      ? 'bg-amber-500'
                      : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(avgCapacity, 100)}%` }}
              />
            </div>
            <span className="font-bold text-navy-900 dark:text-white">{avgCapacity}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkloadView;
