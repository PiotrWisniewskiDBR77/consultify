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
  Rocket,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { Api } from '@/services/api';

import { AppView, FullSession, InitiativeStatus } from '../../types';
import { zJednostka } from '@/utils/jednostka';

interface LiveDashboardProps {
  session: FullSession;
  onNavigate: (view: AppView) => void;
}

export const LiveDashboard: React.FC<LiveDashboardProps> = ({ session, onNavigate }) => {
  // --- 1. Project Status Calculations ---
  const progressStats = useMemo(() => {
    let score = 0;
    if (session.step1Completed) score += 20; // Expectations
    if (session.step2Completed) score += 20; // Assessment
    if (session.step3Completed) score += 25; // Roadmap (Initiatives)
    if (session.step4Completed) score += 0; // ROI (Part of Roadmap typically, but let's say it's bundled)
    if (session.step5Completed) score += 15; // Pilot
    // Rollout not explicitly tracked as a boolean in FullSession, assuming logical deduction

    // Calculate Initiative Execution Progress
    const initiatives = session.initiatives || [];
    const totalInit = initiatives.length;
    const completedInit = initiatives.filter(
      (i) => i.status === InitiativeStatus.CLOSED || i.status === InitiativeStatus.CLOSED
    ).length;
    const executionScore = totalInit > 0 ? (completedInit / totalInit) * 20 : 0;

    return Math.min(100, score + executionScore);
  }, [session]);

  const currentPhase = useMemo(() => {
    if (!session.step2Completed) return 'Assessment';
    if (!session.step3Completed) return 'Strategy & Roadmap';
    if (!session.step5Completed) return 'Pilot Execution';
    return 'Full Rollout';
  }, [session]);

  // --- 3. Initiative Summary ---
  const initiativeStats = useMemo(() => {
    const inits = session.initiatives || [];
    const onTrack = inits.filter((i) =>
      [InitiativeStatus.IN_EXECUTION, InitiativeStatus.CLOSED, InitiativeStatus.CLOSED].includes(
        i.status as InitiativeStatus
      )
    ).length;
    const atRisk = inits.filter(
      (i) =>
        i.priority === 'High' && [InitiativeStatus.IN_EXECUTION].includes(i.status as InitiativeStatus)
    ).length;
    const delayed = inits.filter((i) => i.status === InitiativeStatus.IN_EXECUTION).length; // Simplified logic
    const done = inits.filter((i) => i.status === InitiativeStatus.CLOSED).length; // Simplified logic

    return { total: inits.length, onTrack, atRisk, delayed, done };
  }, [session]);

  // --- 4. KPIs (fetched from API) ---
  const [kpis, setKpis] = useState<
    { label: string; value: string; trend: 'good' | 'bad' | 'neutral'; baseline: string }[]
  >([]);

  // --- 5. AI Insights (generated from real initiative data) ---
  const aiInsights = useMemo(() => {
    const inits = session.initiatives || [];
    const total = inits.length;
    const blocked = inits.filter((i) => i.status === InitiativeStatus.IN_EXECUTION).length;
    const executing = inits.filter((i) => i.status === InitiativeStatus.IN_EXECUTION).length;
    const done = inits.filter((i) => i.status === InitiativeStatus.CLOSED).length;

    if (total === 0) {
      return {
        summary: 'No initiatives defined yet. Start by creating your transformation roadmap.',
        actions: [
          'Define strategic initiatives in the Roadmap module',
          'Complete the Assessment to identify gaps',
        ],
        risk: '',
      };
    }

    const completionRate = Math.round((done / total) * 100);
    const summaryParts: string[] = [];
    summaryParts.push(
      `${total} initiatives tracked: ${done} completed (${completionRate}%), ${executing} in execution, ${blocked} blocked.`
    );

    if (blocked > 0) {
      summaryParts.push(
        `${blocked} initiative${blocked > 1 ? 's are' : ' is'} currently blocked and require${blocked === 1 ? 's' : ''} attention.`
      );
    }

    const actions: string[] = [];
    if (blocked > 0)
      actions.push(
        `Unblock ${blocked} stalled initiative${blocked > 1 ? 's' : ''} — review dependencies and escalate if needed`
      );
    if (executing > 0)
      actions.push(
        `Monitor ${executing} active initiative${executing > 1 ? 's' : ''} for milestone completion`
      );
    if (!session.step2Completed)
      actions.push('Complete the Assessment phase to establish a baseline');
    if (done > 0 && done < total) actions.push('Review completed initiatives for lessons learned');

    const risk =
      blocked > 2
        ? `High risk: ${blocked} initiatives are blocked. This may cascade into timeline delays across the portfolio.`
        : blocked > 0
          ? `Moderate risk: ${blocked} blocked initiative${blocked > 1 ? 's' : ''} could impact overall delivery timeline.`
          : '';

    return { summary: summaryParts.join(' '), actions, risk };
  }, [session]);

  // Fetch KPIs from API
  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const res = await Api.get('/pmo/dashboard/kpis');
        if (Array.isArray(res) && res.length > 0) {
          setKpis(
            res
              .slice(0, 4)
              .map(
                (k: {
                  name?: string;
                  actual?: number;
                  target?: number;
                  unit?: string;
                  trend?: string;
                }) => ({
                  label: k.name || 'KPI',
                  value: zJednostka(k.actual, k.unit),
                  trend: (k.trend === 'UP' ? 'good' : k.trend === 'DOWN' ? 'bad' : 'neutral') as
                    | 'good'
                    | 'bad'
                    | 'neutral',
                  baseline: zJednostka(k.target, k.unit),
                })
              )
          );
          return;
        }
      } catch {
        // API not available — derive from initiative data
      }

      // Derive KPIs from session data
      const inits = session.initiatives || [];
      const total = inits.length;
      const done = inits.filter((i) => i.status === InitiativeStatus.CLOSED).length;
      const blocked = inits.filter((i) => i.status === InitiativeStatus.IN_EXECUTION).length;
      const executing = inits.filter((i) => i.status === InitiativeStatus.IN_EXECUTION).length;

      setKpis([
        {
          label: 'Completion Rate',
          value: total > 0 ? `${Math.round((done / total) * 100)}%` : '—',
          trend: done > 0 ? 'good' : 'neutral',
          baseline: `${total} total`,
        },
        {
          label: 'Active Initiatives',
          value: `${executing}`,
          trend: executing > 0 ? 'good' : 'neutral',
          baseline: `of ${total}`,
        },
        {
          label: 'Blocked',
          value: `${blocked}`,
          trend: blocked > 0 ? 'bad' : 'good',
          baseline: blocked > 0 ? 'needs attention' : 'all clear',
        },
        {
          label: 'Phase Progress',
          value: `${progressStats.toFixed(0)}%`,
          trend: progressStats >= 50 ? 'good' : progressStats >= 25 ? 'neutral' : 'bad',
          baseline: currentPhase,
        },
      ]);
    };
    fetchKPIs();
  }, [session, progressStats, currentPhase]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* SECTION 1: Project Status Overview */}
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
              style={{ width: `${progressStats}% ` }}
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
            {!session.step2Completed && (
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
            {initiativeStats.total === 0 && (
              <li className="text-sm text-danger-800 dark:text-danger-200 flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-danger-500 shrink-0"></span>
                No initiatives defined yet — create a roadmap to begin.
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* SECTION 2: Module Completion Status */}
      <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/10 shadow-sm flex flex-wrap gap-4 justify-between items-center">
        {[
          {
            label: 'Goals & Challenges',
            completed: session.step1Completed,
            view: AppView.FULL_STEP1_ASSESSMENT,
          }, // technically step1 is just goal?
          {
            label: 'Assessment',
            completed: session.step2Completed,
            view: AppView.FULL_STEP1_ASSESSMENT,
          },
          { label: 'Roadmap', completed: session.step3Completed, view: AppView.FULL_STEP3_ROADMAP },
          { label: 'Pilot', completed: session.step5Completed, view: AppView.FULL_STEP5_EXECUTION },
          { label: 'Rollout', completed: false, view: AppView.FULL_STEP5_EXECUTION },
        ].map((mod, i) => (
          <button
            key={i}
            onClick={() => onNavigate(mod.view)}
            className={`flex items - center gap - 3 px - 4 py - 2 rounded - lg border transition - all ${mod.completed ? 'border-green-200 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'border-slate-200 bg-slate-50 dark:bg-slate-800 text-slate-500'} `}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SECTION 3: Initiative Summary & KPIs */}
        <div className="space-y-6">
          {/* Initiative Summary */}
          <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
            <h3 className="font-bold text-navy-900 dark:text-white mb-4">Initiative Summary</h3>
            <div className="flex justify-between items-end mb-6">
              <div>
                <div className="text-3xl font-bold">{initiativeStats.total}</div>
                <div className="text-xs text-slate-500">Total Initiatives</div>
              </div>
              <button
                onClick={() => onNavigate(AppView.FULL_STEP2_INITIATIVES)}
                className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                View All <ArrowRight size={12} />
              </button>
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
            </div>
          </div>

          {/* KPI Snapshot */}
          <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
            <h3 className="font-bold text-navy-900 dark:text-white mb-4">KPI Snapshot</h3>
            {kpis.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {kpis.map((kpi, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div className="text-xs text-slate-500 mb-1">{kpi.label}</div>
                    <div className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
                      {kpi.value}
                      {kpi.trend === 'good' && <TrendingUp size={14} className="text-green-500" />}
                      {kpi.trend === 'bad' && (
                        <TrendingDown size={14} className="text-danger-500" />
                      )}
                    </div>
                    <div className="text-[10px] text-slate-600">Baseline: {kpi.baseline}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-24 text-slate-600 dark:text-slate-500">
                <p className="text-sm italic">Loading KPI data...</p>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 5: AI Insights */}
        <div className="lg:col-span-2 space-y-6">
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
                    Weekly Executive Summary
                  </h4>
                  <p className="leading-relaxed text-indigo-50">{aiInsights.summary}</p>
                </div>

                {/* Recommended Actions */}
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/10">
                  <h4 className="text-sm font-semibold text-indigo-200 uppercase tracking-wider mb-3">
                    Recommended Actions
                  </h4>
                  {aiInsights.actions.length > 0 ? (
                    <ul className="space-y-3">
                      {aiInsights.actions.map((action, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <CheckCircle2 size={18} className="text-green-400 mt-0.5 shrink-0" />
                          <span className="text-sm text-indigo-50">{action}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-indigo-200/60 italic">
                      No actions available yet. Connect data sources to generate recommendations.
                    </p>
                  )}
                </div>

                {/* Predictive Risk */}
                {aiInsights.risk ? (
                  <div className="bg-danger-500/20 backdrop-blur-md rounded-xl p-5 border border-danger-500/20 flex items-start gap-4">
                    <AlertTriangle size={24} className="text-danger-300 shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-danger-200 uppercase tracking-wider mb-1">
                        Early Predictive Risk
                      </h4>
                      <p className="text-sm text-white/90">{aiInsights.risk}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Navigation Shortcuts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => onNavigate(AppView.FULL_STEP1_ASSESSMENT)}
              className="p-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 transition-colors text-center group"
            >
              <LayoutDashboard className="mx-auto mb-2 text-primary-600 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold">Assessment</span>
            </button>
            <button
              onClick={() => onNavigate(AppView.FULL_STEP3_ROADMAP)}
              className="p-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 transition-colors text-center group"
            >
              <Map className="mx-auto mb-2 text-blue-600 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold">Roadmap</span>
            </button>
            <button
              onClick={() => onNavigate(AppView.FULL_STEP5_EXECUTION)}
              className="p-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 transition-colors text-center group"
            >
              <Rocket className="mx-auto mb-2 text-amber-600 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold">Pilot</span>
            </button>
            <button
              onClick={() => onNavigate(AppView.FULL_STEP6_REPORTS)}
              className="p-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 transition-colors text-center group"
            >
              <FileText className="mx-auto mb-2 text-green-600 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold">Reports</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
