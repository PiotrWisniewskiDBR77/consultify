
import React, { useState } from 'react';
import { FullSession, FullInitiative, Quarter, Wave, User } from '../types';
import { useTranslation } from 'react-i18next';
import { ArrowRight, AlertTriangle, Calendar, LayoutGrid, List, Clock, Brain, RefreshCw, Users, Zap } from 'lucide-react';
import { RoadmapKanban } from './RoadmapKanban';
import { RoadmapGantt } from './RoadmapGantt';
import { PilotDecisionWorkspace } from './PilotDecisionWorkspace';
import { AIFeedbackButton } from './AIFeedbackButton';

interface FullStep3WorkspaceProps {
  fullSession: FullSession;
  onUpdateInitiative: (initiative: FullInitiative) => void;
  onNextStep: () => void;
  users?: User[]; // Added
  currentUser?: User | null; // Added
}

export const FullStep3Workspace: React.FC<FullStep3WorkspaceProps> = ({
  fullSession,
  onUpdateInitiative,
  onNextStep,
  users, // Destructure
  currentUser // Destructure
}) => {
  const [subStep, setSubStep] = useState<'roadmap' | 'pilot'>('roadmap');
  const [viewMode, setViewMode] = useState<'gantt' | 'board' | 'table'>('gantt');

  const { t: translate } = useTranslation();
  const t = translate('fullRoadmap', { returnObjects: true }) as any;
  const ti = translate('fullInitiatives', { returnObjects: true }) as any;
  const ts = translate('sidebar', { returnObjects: true }) as any;
  const initiatives = fullSession.initiatives || [];

  const quarters: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];
  const waves: Wave[] = ['Wave 1', 'Wave 2', 'Wave 3'];

  // Workload Calc (Enhanced)
  const workload = quarters.reduce((acc, q) => {
    const inits = initiatives.filter(i => i.quarter === q);
    const count = inits.length;

    // Sum effort
    let totalEffort = 0;
    let changeEffort = 0;

    inits.forEach(i => {
      const effort = i.effortProfile ? (i.effortProfile.analytical + i.effortProfile.operational + i.effortProfile.change) / 3 : 1;
      // Normalize: if profile exists, sum/3 is roughly 1-5 scale per init? No, sum is total points.
      // Let's usetotal points. Max per init = 15. Avg = 8.
      const points = i.effortProfile ? (i.effortProfile.analytical + i.effortProfile.operational + i.effortProfile.change) : 3;
      totalEffort += points;
      changeEffort += i.effortProfile?.change || 1;
    });

    acc[q] = { count, totalEffort, changeEffort };
    return acc;
  }, {} as Record<string, { count: number, totalEffort: number, changeEffort: number }>);

  const getAxisLabel = (id: string) => {
    const key = `fullStep1_${id === 'digitalProducts' ? 'prod' : id.substring(0, 4)}` as keyof typeof ts;
    return ts[key] || id;
  };

  const handleNext = () => {
    if (subStep === 'roadmap') {
      setSubStep('pilot');
    } else {
      onNextStep();
    }
  };

  // If in Pilot Decision mode, render that component
  if (subStep === 'pilot') {
    return (
      <PilotDecisionWorkspace
        fullSession={fullSession}
        onUpdateInitiative={onUpdateInitiative}
        onNextStep={onNextStep}

      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="h-14 border-b border-slate-200 dark:border-white/5 flex flex-col justify-center px-6 bg-white dark:bg-navy-900 shrink-0">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-sm font-semibold text-navy-900 dark:text-white tracking-wide truncate max-w-[500px]">Strategic Roadmap Builder</span>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="bg-slate-100 dark:bg-navy-950 p-0.5 rounded-md border border-slate-200 dark:border-white/5 flex gap-0.5">
              <button
                onClick={() => setViewMode('gantt')}
                className={`p-1 rounded ${viewMode === 'gantt' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'}`}
                title="Gantt Timeline"
              >
                <Clock size={14} />
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`p-1 rounded ${viewMode === 'board' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'}`}
                title="Kanban Board"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1 rounded ${viewMode === 'table' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'}`}
                title="List View"
              >
                <List size={14} />
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1"></div>

            <AIFeedbackButton context="roadmap" data={initiatives} />

          </div>
        </div>
        <div className="w-full h-0.5 bg-navy-800 rounded-full overflow-hidden mt-1">
          <div className="h-full bg-blue-500 w-3/4 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">

        {/* ZONE B: CONTEXT AI ACTIONS (Between Header and Roadmap) */}
        <div className="flex items-center justify-between bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/5 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Brain size={14} className="text-blue-500" /> AI Strategy Consultant
            </h4>
            <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>
            <div className="flex gap-2">
              {/* B1 Primary */}
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-lg text-xs font-bold hover:bg-blue-500/20 transition-colors">
                <RefreshCw size={12} />
                Rebalance Roadmap
              </button>
              {/* B2 Secondary */}
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 dark:text-slate-300 border border-transparent hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-xs font-medium transition-colors">
                <Users size={12} />
                Optimize for Change Capacity
              </button>
              {/* B3 Secondary */}
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 dark:text-slate-300 border border-transparent hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-xs font-medium transition-colors">
                <Zap size={12} />
                Optimize for Value
              </button>
            </div>
          </div>
        </div>

        {/* Workload Summary with Zone C Actions (Inline) */}
        <div className="bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-white/5 rounded-xl p-4 shadow-sm dark:shadow-none">
          <h4 className="text-xs font-semibold text-navy-900 dark:text-white mb-3 flex items-center gap-2">
            <Calendar size={14} className="text-blue-400" />
            Quarter Health Monitor & Actions
          </h4>
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
            {quarters.map(q => {
              const { count, totalEffort, changeEffort } = workload[q] || { count: 0, totalEffort: 0, changeEffort: 0 };

              // Thresholds
              const isOverloaded = totalEffort > 25; // Example threshold
              const isHighChange = changeEffort > 12; // Example threshold
              const isWarning = isOverloaded || isHighChange;

              return (
                <div key={q} className={`p-2 rounded border flex flex-col items-center justify-center relative group transition-all min-h-[80px] ${isWarning
                  ? 'bg-red-500/5 border-red-500/30'
                  : count > 0 ? 'bg-slate-50 dark:bg-navy-900 border-slate-100 dark:border-white/5 hover:border-blue-500/30' : 'bg-transparent border-transparent opacity-50'
                  }`}>

                  {/* ZONE C1: Quarter Actions (On Hover) */}
                  <div className="absolute inset-0 bg-navy-950/90 rounded flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 gap-1 backdrop-blur-sm">
                    <button className="text-[9px] font-bold text-white bg-blue-600 px-2 py-1 rounded-full w-20 hover:scale-105 transition-transform">
                      Review
                    </button>
                    {isWarning && (
                      <button className="text-[9px] font-bold text-white bg-red-500 px-2 py-1 rounded-full w-20 hover:scale-105 transition-transform">
                        Lighten
                      </button>
                    )}
                  </div>

                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">{q}</span>
                  <div className="flex items-end gap-1">
                    <span className={`text-sm font-bold ${isWarning ? 'text-red-500 dark:text-red-400' : 'text-navy-900 dark:text-white'}`}>{count}</span>
                    <span className="text-[9px] text-slate-400 mb-0.5">inits</span>
                  </div>

                  {isWarning && (
                    <div className="absolute top-1 right-1">
                      <AlertTriangle size={10} className="text-red-500 animate-pulse" />
                    </div>
                  )}

                  {/* Tooltip */}
                  {count > 0 && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-32 bg-navy-900 text-white text-[10px] p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
                      <div className="font-bold border-b border-white/10 pb-1 mb-1">{q} Analysis</div>
                      <div className="flex justify-between"><span>Effort:</span> <span>{totalEffort} pts</span></div>
                      <div className="flex justify-between text-red-300"><span>Change:</span> <span>{changeEffort} pts</span></div>
                      {isHighChange && <div className="mt-1 text-red-400 font-bold">High Change Fatigue Risk!</div>}
                      {isOverloaded && <div className="mt-1 text-red-400 font-bold">Capacity Overload!</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main View Area */}
        {viewMode === 'gantt' && (
          <div className="h-[600px] w-full">
            <RoadmapGantt
              initiatives={initiatives}
              onUpdateInitiative={onUpdateInitiative}

            />
          </div>
        )}

        {viewMode === 'board' && (
          <div className="h-[500px] w-full">
            <RoadmapKanban
              initiatives={initiatives}
              onUpdateInitiative={onUpdateInitiative}

              users={users}
              currentUser={currentUser}
            />
          </div>
        )}

        {viewMode === 'table' && (
          <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-navy-950/50 shadow-sm dark:shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-900 border-b border-slate-200 dark:border-white/10 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="p-3">{ti.tableHeader.initiative}</th>
                  <th className="p-3">Role</th> {/* New */}
                  <th className="p-3">Effort Profile</th> {/* New */}
                  <th className="p-3">{ti.tableHeader.axis}</th>
                  <th className="p-3">{t.tableHeader.quarter}</th>
                  <th className="p-3">{t.tableHeader.wave}</th>
                </tr>
              </thead>
              <tbody>
                {initiatives.map((init) => (
                  <tr key={init.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-3">
                      <div className="font-medium text-navy-900 dark:text-white text-xs">{init.name}</div>
                      <div className="flex gap-1.5 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${init.priority === 'High' ? 'border-red-500/30 text-red-400 bg-red-500/10' :
                          init.priority === 'Medium' ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10' :
                            'border-green-500/30 text-green-400 bg-green-500/10'
                          }`}>
                          {init.priority}
                        </span>
                      </div>
                    </td>
                    {/* Strategic Role Column */}
                    <td className="p-3">
                      {init.strategicRole ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                          {init.strategicRole}
                        </span>
                      ) : <span className="text-[10px] text-slate-400">-</span>}
                    </td>
                    {/* Effort Profile Column */}
                    <td className="p-3">
                      {init.effortProfile ? (
                        <div className="flex items-end gap-1 h-4 w-16">
                          <div className="bg-blue-500 w-1/3 rounded-sm" style={{ height: `${(init.effortProfile.analytical / 5) * 100}%` }} title={`Analytical: ${init.effortProfile.analytical}`}></div>
                          <div className="bg-emerald-500 w-1/3 rounded-sm" style={{ height: `${(init.effortProfile.operational / 5) * 100}%` }} title={`Operational: ${init.effortProfile.operational}`}></div>
                          <div className="bg-rose-500 w-1/3 rounded-sm" style={{ height: `${(init.effortProfile.change / 5) * 100}%` }} title={`Change: ${init.effortProfile.change}`}></div>
                        </div>
                      ) : <span className="text-[10px] text-slate-400">-</span>}
                    </td>
                    <td className="p-3 text-[10px] text-slate-400">
                      {getAxisLabel(init.axis)}
                    </td>
                    <td className="p-3">
                      <select
                        value={init.quarter}
                        onChange={(e) => onUpdateInitiative({ ...init, quarter: e.target.value as Quarter })}
                        className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 text-[10px] rounded px-1.5 py-1 outline-none focus:border-blue-500 text-navy-900 dark:text-slate-300 w-16"
                      >
                        {quarters.map(q => <option key={q} value={q}>{q}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                      <select
                        value={init.wave}
                        onChange={(e) => onUpdateInitiative({ ...init, wave: e.target.value as Wave })}
                        className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 text-[10px] rounded px-1.5 py-1 outline-none focus:border-blue-500 text-navy-900 dark:text-slate-300 w-20"
                      >
                        {waves.map(w => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-navy-900 flex justify-end">
        <button
          onClick={handleNext}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-lg bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30"
        >
          {subStep === 'roadmap' ? 'Proceed to Pilot Selection' : 'Finish Module 3'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div >
  );
};
