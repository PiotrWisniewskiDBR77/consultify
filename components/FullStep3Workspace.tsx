import React, { useState } from 'react';
import { FullSession, FullInitiative, Language, Quarter, Wave, User } from '../types';
import { translations } from '../translations';
import { ArrowRight, AlertTriangle, Calendar, LayoutGrid, List, Clock } from 'lucide-react';
import { RoadmapKanban } from './RoadmapKanban';
import { RoadmapGantt } from './RoadmapGantt';
import { PilotDecisionWorkspace } from './PilotDecisionWorkspace';

interface FullStep3WorkspaceProps {
  fullSession: FullSession;
  onUpdateInitiative: (initiative: FullInitiative) => void;
  onNextStep: () => void;
  language: Language;
  users?: User[]; // Added
  currentUser?: User | null; // Added
}

export const FullStep3Workspace: React.FC<FullStep3WorkspaceProps> = ({
  fullSession,
  onUpdateInitiative,
  onNextStep,
  language,
  users, // Destructure
  currentUser // Destructure
}) => {
  const [subStep, setSubStep] = useState<'roadmap' | 'pilot'>('roadmap');
  const [viewMode, setViewMode] = useState<'gantt' | 'board' | 'table'>('gantt');

  const t = translations.fullRoadmap;
  const ti = translations.fullInitiatives;
  const ts = translations.sidebar;
  const initiatives = fullSession.initiatives || [];

  const quarters: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];
  const waves: Wave[] = ['Wave 1', 'Wave 2', 'Wave 3'];
  // ... (rest of code logic remains same until return)

  // Workload Calc
  const workload = quarters.reduce((acc, q) => {
    acc[q] = initiatives.filter(i => i.quarter === q).length;
    return acc;
  }, {} as Record<string, number>);

  const getAxisLabel = (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const key = `fullStep1_${id === 'digitalProducts' ? 'prod' : id.substring(0, 4)}` as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (ts as any)[key]?.[language] || id;
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
            <span className="text-[10px] text-slate-500 font-bold tracking-wider">STEP 3.1</span>
          </div>
        </div>
        <div className="w-full h-0.5 bg-navy-800 rounded-full overflow-hidden mt-1">
          <div className="h-full bg-blue-500 w-3/4 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">

        {/* Workload Summary */}
        <div className="bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-white/5 rounded-xl p-4 shadow-sm dark:shadow-none">
          <h4 className="text-xs font-semibold text-navy-900 dark:text-white mb-3 flex items-center gap-2">
            <Calendar size={14} className="text-blue-400" />
            {t.workload.title[language]}
          </h4>
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
            {quarters.map(q => {
              const count = workload[q] || 0;
              const isHigh = count > 5;
              return (
                <div key={q} className={`p-2 rounded border flex flex-col items-center justify-center ${isHigh ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-50 dark:bg-navy-900 border-slate-100 dark:border-white/5'
                  }`}>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">{q}</span>
                  <span className={`text-sm font-bold ${isHigh ? 'text-red-500 dark:text-red-400' : 'text-navy-900 dark:text-white'}`}>{count}</span>
                  {isHigh && <AlertTriangle size={10} className="text-red-500 mt-0.5" />}
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
              language={language}
            />
          </div>
        )}

        {viewMode === 'board' && (
          <div className="h-[500px] w-full">
            <RoadmapKanban
              initiatives={initiatives}
              onUpdateInitiative={onUpdateInitiative}
              language={language}
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
                  <th className="p-3">{ti.tableHeader.initiative[language]}</th>
                  <th className="p-3">{ti.tableHeader.axis[language]}</th>
                  <th className="p-3">{t.tableHeader.quarter[language]}</th>
                  <th className="p-3">{t.tableHeader.wave[language]}</th>
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
          <ArrowRight size={16} className={language === 'AR' ? 'rotate-180' : ''} />
        </button>
      </div>
    </div>
  );
};
