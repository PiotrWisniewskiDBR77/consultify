
import React, { useState } from 'react';
import { FullSession, FullInitiative, Language, Quarter, Wave } from '../types';
import { translations } from '../translations';
import { ArrowRight, AlertTriangle, Calendar, LayoutGrid, List } from 'lucide-react';
import { RoadmapKanban } from './RoadmapKanban';

interface FullStep3WorkspaceProps {
  fullSession: FullSession;
  onUpdateInitiative: (initiative: FullInitiative) => void;
  onNextStep: () => void;
  language: Language;
}

export const FullStep3Workspace: React.FC<FullStep3WorkspaceProps> = ({
  fullSession,
  onUpdateInitiative,
  onNextStep,
  language
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'board'>('board'); // Default to board for wow effect

  const t = translations.fullRoadmap;
  const ti = translations.fullInitiatives;
  const ts = translations.sidebar;
  const initiatives = fullSession.initiatives || [];

  const quarters: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];
  const waves: Wave[] = ['Wave 1', 'Wave 2', 'Wave 3'];

  // Workload Calc
  const workload = quarters.reduce((acc, q) => {
    acc[q] = initiatives.filter(i => i.quarter === q).length;
    return acc;
  }, {} as Record<string, number>);

  const getAxisLabel = (id: string) => {
    const key = `fullStep1_${id === 'digitalProducts' ? 'prod' : id.substring(0, 4)}` as any;
    return ts[key]?.[language] || id;
  };

  return (
    <div className="flex flex-col h-full bg-navy-900">
      {/* Header */}
      <div className="h-20 border-b border-white/5 flex flex-col justify-center px-8 bg-navy-900 shrink-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-semibold text-white tracking-wide">{t.intro[language].substring(0, 30)}...</span>
          <div className="flex items-center gap-4">
            {/* View Toggle */}
            <div className="bg-navy-950 p-1 rounded-lg border border-white/5 flex gap-1">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                title="List View"
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`p-1.5 rounded ${viewMode === 'board' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                title="Kanban Board"
              >
                <LayoutGrid size={16} />
              </button>
            </div>
            <span className="text-xs text-slate-500">STEP 3</span>
          </div>
        </div>
        <div className="w-full h-1 bg-navy-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 w-3/6 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">

        {/* Workload Summary - Make compact if in Board mode? Keep as is for now. */}
        <div className="bg-navy-950/50 border border-white/5 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-blue-400" />
            {t.workload.title[language]}
          </h4>
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
            {quarters.map(q => {
              const count = workload[q] || 0;
              const isHigh = count > 5;
              return (
                <div key={q} className={`p-3 rounded border flex flex-col items-center justify-center ${isHigh ? 'bg-red-500/10 border-red-500/30' : 'bg-navy-900 border-white/5'
                  }`}>
                  <span className="text-xs font-bold text-slate-400 mb-1">{q}</span>
                  <span className={`text-lg font-bold ${isHigh ? 'text-red-400' : 'text-white'}`}>{count}</span>
                  {isHigh && <AlertTriangle size={12} className="text-red-500 mt-1" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Board vs Table */}
        {viewMode === 'board' ? (
          <div className="h-[500px] w-full">
            <RoadmapKanban
              initiatives={initiatives}
              onUpdateInitiative={onUpdateInitiative}
              language={language}
            />
          </div>
        ) : (
          <div className="border border-white/10 rounded-xl overflow-hidden bg-navy-950/50 shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-navy-900 border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                  <th className="p-4">{ti.tableHeader.initiative[language]}</th>
                  <th className="p-4">{ti.tableHeader.axis[language]}</th>
                  <th className="p-4">{t.tableHeader.quarter[language]}</th>
                  <th className="p-4">{t.tableHeader.wave[language]}</th>
                </tr>
              </thead>
              <tbody>
                {initiatives.map((init) => (
                  <tr key={init.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-white text-sm">{init.name}</div>
                      <div className="flex gap-2 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${init.priority === 'High' ? 'border-red-500/30 text-red-400 bg-red-500/10' :
                            init.priority === 'Medium' ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10' :
                              'border-green-500/30 text-green-400 bg-green-500/10'
                          }`}>
                          {init.priority}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-xs text-slate-400">
                      {getAxisLabel(init.axis)}
                    </td>
                    <td className="p-4">
                      <select
                        value={init.quarter}
                        onChange={(e) => onUpdateInitiative({ ...init, quarter: e.target.value as Quarter })}
                        className="bg-navy-900 border border-white/10 text-xs rounded px-2 py-1 outline-none focus:border-blue-500 text-slate-300 w-20"
                      >
                        {quarters.map(q => <option key={q} value={q}>{q}</option>)}
                      </select>
                    </td>
                    <td className="p-4">
                      <select
                        value={init.wave}
                        onChange={(e) => onUpdateInitiative({ ...init, wave: e.target.value as Wave })}
                        className="bg-navy-900 border border-white/10 text-xs rounded px-2 py-1 outline-none focus:border-blue-500 text-slate-300 w-24"
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
      <div className="p-6 border-t border-white/5 bg-navy-900 flex justify-end">
        <button
          onClick={onNextStep}
          className="flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-sm transition-all shadow-lg bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30"
        >
          {t.nextStep[language]}
          <ArrowRight size={18} className={language === 'AR' ? 'rotate-180' : ''} />
        </button>
      </div>
    </div>
  );
};
