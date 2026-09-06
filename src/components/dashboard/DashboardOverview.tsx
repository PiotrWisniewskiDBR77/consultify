import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  Circle,
  FileText,
  LayoutDashboard,
  Map,
  Plus,
  Rocket,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import React, { useMemo } from 'react';

import { useDashboardPreferences } from '../../hooks/useDashboardPreferences';
import { AppView, FullSession, InitiativeStatus } from '../../types';

interface DashboardOverviewProps {
  onStartModule1: () => void;
  session: FullSession | null | undefined;
  onCreateTask: () => void;
  onEditTask: (taskId: string) => void;
  refreshTrigger: number;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  onStartModule1,
  session,
  onCreateTask,
  onEditTask,
  refreshTrigger,
}) => {
  const { preferences: dashPrefs } = useDashboardPreferences();
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

    const initiatives = safeSession.initiatives || [];
    const totalInit = initiatives.length;
    const completedInit = initiatives.filter(
      (i) => i.status === InitiativeStatus.CLOSED || i.status === InitiativeStatus.CLOSED
    ).length;
    const executionScore = totalInit > 0 ? (completedInit / totalInit) * 20 : 0;

    return Math.min(100, score + executionScore);
  }, [safeSession]);

  const currentPhase = useMemo(() => {
    if (!safeSession.step2Completed) return 'Assessment';
    if (!safeSession.step3Completed) return 'Strategy & Roadmap';
    if (!safeSession.step5Completed) return 'Pilot Execution';
    return 'Full Rollout';
  }, [safeSession]);

  // Initiative Summary
  const initiativeStats = useMemo(() => {
    const inits = safeSession.initiatives || [];
    const onTrack = inits.filter((i) =>
      [InitiativeStatus.IN_EXECUTION, InitiativeStatus.CLOSED, InitiativeStatus.CLOSED].includes(
        i.status as InitiativeStatus
      )
    ).length;
    const atRisk = inits.filter(
      (i) =>
        i.priority === 'High' && [InitiativeStatus.IN_EXECUTION].includes(i.status as InitiativeStatus)
    ).length;
    const delayed = inits.filter((i) => i.status === InitiativeStatus.IN_EXECUTION).length;
    const done = inits.filter((i) => i.status === InitiativeStatus.CLOSED).length;

    return { total: inits.length, onTrack, atRisk, delayed, done };
  }, [safeSession]);

  // KPIs from session or defaults
  const kpis = useMemo(() => {
    const kpiResults = safeSession.kpiResults || {};
    return [
      {
        label: 'Cycle Time',
        value: (kpiResults as any).cycleTime || '12d',
        trend: 'good' as const,
        baseline: '4 days',
      },
      {
        label: 'Budget Usage',
        value: (kpiResults as any).budgetUsage || '45%',
        trend: 'good' as const,
        baseline: '$0',
      },
      {
        label: 'ROI Realized',
        value: (kpiResults as any).roiRealized || '$12k',
        trend: 'good' as const,
        baseline: '$0',
      },
      {
        label: 'Quality',
        value: (kpiResults as any).quality || '-5%',
        trend: 'good' as const,
        baseline: '2.1%',
      },
    ];
  }, [safeSession.kpiResults]);

  // AI Insights
  const aiInsights = useMemo(
    () => ({
      summary: `Your transformation journey is ${Math.round(progressStats)}% complete. ${
        initiativeStats.delayed > 0
          ? `${initiativeStats.delayed} initiative(s) need attention.`
          : 'All initiatives are on track.'
      }`,
      actions: [
        initiativeStats.delayed > 0
          ? `Review ${initiativeStats.delayed} blocked initiative(s)`
          : 'Continue executing planned initiatives',
        safeSession.step3Completed
          ? 'Monitor pilot execution progress'
          : 'Complete roadmap planning',
        'Review KPI performance regularly',
      ],
      risk:
        initiativeStats.atRisk > 0
          ? `${initiativeStats.atRisk} high-priority initiative(s) are at risk.`
          : 'No immediate risks identified.',
    }),
    [progressStats, initiativeStats, safeSession.step3Completed]
  );

  const hasStarted =
    safeSession.step1Completed || safeSession.step2Completed || safeSession.step3Completed;

  // Compact Mode tightens vertical spacing across the dashboard.
  const compact = dashPrefs.compactMode;

  return (
    <div
      className={`max-w-7xl mx-auto animate-fade-in ${compact ? 'space-y-3 pb-6' : 'space-y-6 pb-12'}`}
    >
      {/* Welcome/Start Section — gated by the Show Greeting preference */}
      {!hasStarted && dashPrefs.showGreeting && (
        <div className="bg-gradient-to-br from-primary-600 to-crimson-700 rounded-2xl p-8 text-white shadow-lg">
          <h2 className="text-2xl font-bold mb-2">Welcome to Your Transformation Dashboard</h2>
          <p className="text-primary-100 mb-6">
            Start your digital transformation journey by completing the initial assessment and
            planning.
          </p>
          <button
            onClick={onStartModule1}
            className="bg-white text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors flex items-center gap-2"
          >
            <Rocket size={20} />
            Start Transformation
          </button>
        </div>
      )}

      {/* Project Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Overall Progress */}
        <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Activity size={100} />
          </div>
          <h3 className="text-slate-500 font-medium text-sm uppercase tracking-wide mb-2">
            Overall Progress
          </h3>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-4xl font-bold text-navy-900 dark:text-white">
              {progressStats.toFixed(0)}%
            </span>
            <span className="text-slate-600 mb-1 font-medium">completed</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-primary-600 h-full rounded-full transition-all duration-1000"
              style={{ width: `${progressStats}%` }}
            ></div>
          </div>
        </div>

        {/* Current Phase */}
        <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-center">
          <h3 className="text-slate-500 font-medium text-sm uppercase tracking-wide mb-2">
            Current Phase
          </h3>
          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400 mb-1">
            {currentPhase}
          </div>
          <p className="text-xs text-slate-600">
            {currentPhase === 'Assessment' && 'Defining baseline maturity and gaps.'}
            {currentPhase === 'Strategy & Roadmap' && 'Planning initiatives and ROI.'}
            {currentPhase === 'Pilot Execution' && 'Testing solutions in controlled environment.'}
            {currentPhase === 'Full Rollout' && 'Scaling solutions across organization.'}
          </p>
        </div>

        {/* Priority Alerts */}
        <div className="bg-danger-50 dark:bg-danger-900/10 rounded-2xl p-6 border border-danger-100 dark:border-danger-500/20 shadow-sm">
          <h3 className="text-danger-600 dark:text-danger-400 font-bold text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
            <AlertOctagon size={16} />
            Priority Alerts
          </h3>
          <ul className="space-y-2">
            {!safeSession.step2Completed && (
              <li className="text-sm text-danger-800 dark:text-danger-200 flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-danger-500 shrink-0"></span>
                Assessment incomplete: Missing key data points.
              </li>
            )}
            {initiativeStats.delayed > 0 && (
              <li className="text-sm text-danger-800 dark:text-danger-200 flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-danger-500 shrink-0"></span>
                {initiativeStats.delayed} initiatives are currently delayed.
              </li>
            )}
            {initiativeStats.atRisk > 0 && (
              <li className="text-sm text-danger-800 dark:text-danger-200 flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-danger-500 shrink-0"></span>
                {initiativeStats.atRisk} high-priority initiatives at risk.
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Module Completion Status */}
      {hasStarted && (
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/10 shadow-sm flex flex-wrap gap-4 justify-between items-center">
          {[
            {
              label: 'Goals & Challenges',
              completed: safeSession.step1Completed,
              view: AppView.FULL_STEP1_ASSESSMENT,
            },
            {
              label: 'Assessment',
              completed: safeSession.step2Completed,
              view: AppView.FULL_STEP1_ASSESSMENT,
            },
            {
              label: 'Roadmap',
              completed: safeSession.step3Completed,
              view: AppView.FULL_STEP3_ROADMAP,
            },
            {
              label: 'Pilot',
              completed: safeSession.step5Completed,
              view: AppView.FULL_STEP5_EXECUTION,
            },
            { label: 'Rollout', completed: false, view: AppView.FULL_STEP5_EXECUTION },
          ].map((mod, i) => (
            <button
              key={i}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg border transition-all ${
                mod.completed
                  ? 'border-green-200 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'border-slate-200 bg-slate-50 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {mod.completed ? (
                <CheckCircle2 size={18} />
              ) : (
                <Circle size={18} className="text-slate-600" />
              )}
              <span className="font-medium text-sm">{mod.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Initiative Summary & KPIs */}
        <div className="space-y-6">
          {/* Initiative Summary */}
          {dashPrefs.widgets.initiatives && (
            <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
              <h3 className="font-bold text-navy-900 dark:text-white mb-4">Initiative Summary</h3>
              <div className="flex justify-between items-end mb-6">
                <div>
                  <div className="text-3xl font-bold">{initiativeStats.total}</div>
                  <div className="text-xs text-slate-500">Total Initiatives</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span> On Track
                  </span>
                  <span className="font-mono font-bold">{initiativeStats.onTrack}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span> At Risk
                  </span>
                  <span className="font-mono font-bold">{initiativeStats.atRisk}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-danger-500"></span> Delayed
                  </span>
                  <span className="font-mono font-bold">{initiativeStats.delayed}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> Completed
                  </span>
                  <span className="font-mono font-bold">{initiativeStats.done}</span>
                </div>
              </div>
            </div>
          )}

          {/* KPI Snapshot */}
          {dashPrefs.widgets.metrics && (
            <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
              <h3 className="font-bold text-navy-900 dark:text-white mb-4">
                Key Performance Indicators
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {kpis.map((kpi, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div className="text-xs text-slate-500 mb-1">{kpi.label}</div>
                    <div className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
                      {kpi.value}
                      {kpi.trend === 'good' ? (
                        <TrendingUp size={14} className="text-green-500" />
                      ) : (
                        <TrendingDown size={14} className="text-danger-500" />
                      )}
                    </div>
                    <div className="text-[10px] text-slate-600">Baseline: {kpi.baseline}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Insights */}
        <div className="lg:col-span-2 space-y-6">
          {dashPrefs.widgets.aiInsights && (
            <div className="bg-gradient-to-br from-crimson-900 to-primary-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden min-h-[400px]">
              <div className="absolute top-0 right-0 p-8 opacity-20">
                <BrainCircuit size={180} />
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <BrainCircuit size={24} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold">AI Executive Insights</h3>
                </div>

                <div className="space-y-6">
                  {/* Weekly Summary */}
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/10">
                    <h4 className="text-sm font-semibold text-indigo-200 uppercase tracking-wider mb-2">
                      Executive Summary
                    </h4>
                    <p className="leading-relaxed text-indigo-50">{aiInsights.summary}</p>
                  </div>

                  {/* Recommended Actions */}
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/10">
                    <h4 className="text-sm font-semibold text-indigo-200 uppercase tracking-wider mb-3">
                      Recommended Actions
                    </h4>
                    <ul className="space-y-3">
                      {aiInsights.actions.map((action, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <CheckCircle2 size={18} className="text-green-400 mt-0.5 shrink-0" />
                          <span className="text-sm text-indigo-50">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Predictive Risk */}
                  {initiativeStats.atRisk > 0 && (
                    <div className="bg-danger-500/20 backdrop-blur-md rounded-xl p-5 border border-danger-500/20 flex items-start gap-4">
                      <AlertTriangle size={24} className="text-danger-300 shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-danger-200 uppercase tracking-wider mb-1">
                          Early Predictive Risk
                        </h4>
                        <p className="text-sm text-white/90">{aiInsights.risk}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {dashPrefs.widgets.quickActions && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={onCreateTask}
                className="p-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 transition-colors text-center group"
              >
                <Plus className="mx-auto mb-2 text-primary-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold">New Task</span>
              </button>
              <button className="p-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 transition-colors text-center group">
                <LayoutDashboard className="mx-auto mb-2 text-primary-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold">Assessment</span>
              </button>
              <button className="p-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 transition-colors text-center group">
                <Map className="mx-auto mb-2 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold">Roadmap</span>
              </button>
              <button className="p-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 transition-colors text-center group">
                <Rocket className="mx-auto mb-2 text-amber-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold">Pilot</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
