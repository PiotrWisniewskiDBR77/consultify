import { Activity, AlertTriangle, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import React, { useMemo } from 'react';

import { AppView, FullSession, InitiativeStatus } from '../../types';

interface DashboardExecutionSnapshotProps {
  session: FullSession | null | undefined;
  onNavigate: (view: AppView) => void;
}

export const DashboardExecutionSnapshot: React.FC<DashboardExecutionSnapshotProps> = ({
  session,
  onNavigate,
}) => {
  const safeSession = session || {
    step1Completed: false,
    step2Completed: false,
    step3Completed: false,
    step4Completed: false,
    step5Completed: false,
    initiatives: [],
    kpiResults: {},
  };

  // Project Status Calculations
  const progressStats = useMemo(() => {
    let score = 0;
    if (safeSession.step1Completed) score += 20;
    if (safeSession.step2Completed) score += 20;
    if (safeSession.step3Completed) score += 25;
    if (safeSession.step5Completed) score += 15;
    return Math.min(100, score);
  }, [safeSession]);

  const currentPhase = useMemo(() => {
    if (!safeSession.step2Completed)
      return { name: 'Assessment', number: 1, description: 'Defining baseline maturity and gaps.' };
    if (!safeSession.step3Completed)
      return { name: 'Roadmap', number: 2, description: 'Planning initiatives' };
    if (!safeSession.step5Completed)
      return {
        name: 'Pilot Execution',
        number: 3,
        description: 'Testing solutions in controlled environment.',
      };
    return {
      name: 'Full Rollout',
      number: 4,
      description: 'Scaling solutions across organization.',
    };
  }, [safeSession]);

  // Initiative Statistics
  const initiativeStats = useMemo(() => {
    const inits = safeSession.initiatives || [];
    const inProgress = inits.filter(
      (i) => i.status === InitiativeStatus.IN_EXECUTION || i.status === InitiativeStatus.PENDING_APPROVAL
    ).length;
    const done = inits.filter((i) => i.status === InitiativeStatus.CLOSED).length;
    const delayed = inits.filter((i) => i.status === InitiativeStatus.IN_EXECUTION).length;
    const todo = inits.filter(
      (i) => i.status === InitiativeStatus.DRAFT || i.status === InitiativeStatus.PENDING_APPROVAL
    ).length;

    return { total: inits.length, inProgress, done, delayed, todo };
  }, [safeSession]);

  // Active initiatives (not done, not archived)
  const activeInitiatives = useMemo(() => {
    return (safeSession.initiatives || []).filter(
      (i) => i.status !== InitiativeStatus.CLOSED && i.status !== InitiativeStatus.CLOSED
    );
  }, [safeSession]);

  // KPIs from session or defaults
  const kpis = useMemo(() => {
    const kpiResults = safeSession.kpiResults || {};
    return {
      cycleTime: (kpiResults as any).cycleTime || '12d',
      budgetUsage: (kpiResults as any).budgetUsage || '45%',
      roiRealized: (kpiResults as any).roiRealized || '$12k',
    };
  }, [safeSession.kpiResults]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Project Status Overview */}
      <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-6">
          Project Status Overview
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Overall Progress */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6">
            <h3 className="text-slate-500 font-medium text-sm uppercase tracking-wide mb-2">
              Overall Progress
            </h3>
            <div className="flex items-end gap-2 mb-4">
              <span className="text-4xl font-bold text-navy-900 dark:text-white">
                {progressStats.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-primary-600 h-full rounded-full transition-all duration-1000"
                style={{ width: `${progressStats}%` }}
              ></div>
            </div>
          </div>

          {/* Current Phase */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6">
            <h3 className="text-slate-500 font-medium text-sm uppercase tracking-wide mb-2">
              Current Phase
            </h3>
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400 mb-1">
              {currentPhase.name}
            </div>
            <p className="text-xs text-slate-600">{currentPhase.description}</p>
            <div className="mt-2 text-xs text-slate-500">Phase {currentPhase.number}/6</div>
          </div>

          {/* Priority Alerts */}
          <div className="bg-danger-50 dark:bg-danger-900/10 rounded-xl p-6 border border-danger-100 dark:border-danger-500/20">
            <h3 className="text-danger-600 dark:text-danger-400 font-bold text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
              <AlertTriangle size={16} />
              Priority Alerts
            </h3>
            <ul className="space-y-2">
              {initiativeStats.delayed > 0 && (
                <li className="text-sm text-danger-800 dark:text-danger-200 flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-danger-500 shrink-0"></span>
                  {initiativeStats.delayed} initiatives are currently delayed.
                </li>
              )}
              {!safeSession.step2Completed && (
                <li className="text-sm text-danger-800 dark:text-danger-200 flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-danger-500 shrink-0"></span>
                  Assessment incomplete: Missing key data points.
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Initiative Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-navy-900 dark:text-white">
              {initiativeStats.total}
            </div>
            <div className="text-xs text-slate-500 mt-1">Total Initiatives</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {initiativeStats.inProgress}
            </div>
            <div className="text-xs text-slate-500 mt-1">In Progress</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {initiativeStats.done}
            </div>
            <div className="text-xs text-slate-500 mt-1">Completed</div>
          </div>
          <div className="bg-danger-50 dark:bg-danger-900/20 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-danger-600 dark:text-danger-400">
              {initiativeStats.delayed}
            </div>
            <div className="text-xs text-slate-500 mt-1">Delayed</div>
          </div>
        </div>
      </div>

      {/* Live Active Initiatives */}
      <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-navy-900 dark:text-white">
            Live Active Initiatives
          </h3>
          <button
            onClick={() => onNavigate(AppView.FULL_STEP2_INITIATIVES)}
            className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-2"
          >
            Manage All Initiatives
            <ArrowRight size={16} />
          </button>
        </div>

        {activeInitiatives.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>No active initiatives currently tracked.</p>
            <p className="text-sm mt-2">Start by creating initiatives in the Roadmap phase.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeInitiatives.slice(0, 5).map((initiative) => (
              <div
                key={initiative.id}
                className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-white/10"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-navy-900 dark:text-white">
                      {initiative.name}
                    </h4>
                    {initiative.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {initiative.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          initiative.status === InitiativeStatus.IN_EXECUTION ||
                          initiative.status === InitiativeStatus.PENDING_APPROVAL
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : initiative.status === InitiativeStatus.IN_EXECUTION
                              ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {initiative.status}
                      </span>
                      {initiative.priority && (
                        <span className="text-xs text-slate-500">
                          Priority: {initiative.priority}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Key Performance Indicators */}
      <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
        <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-6">
          Key Performance Indicators
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6">
            <div className="text-sm text-slate-500 mb-2">Cycle Time</div>
            <div className="text-3xl font-bold text-navy-900 dark:text-white">{kpis.cycleTime}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6">
            <div className="text-sm text-slate-500 mb-2">Budget Usage</div>
            <div className="text-3xl font-bold text-navy-900 dark:text-white">
              {kpis.budgetUsage}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6">
            <div className="text-sm text-slate-500 mb-2">ROI Realized</div>
            <div className="text-3xl font-bold text-navy-900 dark:text-white">
              {kpis.roiRealized}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
