
import React, { useState } from 'react';
import { FullSession, FullInitiative, Language, InitiativeStatus } from '../types';
import { translations } from '../translations';
import { ArrowRight, User, Calendar, AlertCircle, Clock, X, BarChart2 } from 'lucide-react';
import { InitiativeTaskBoard } from './InitiativeTaskBoard';

interface FullStep5WorkspaceProps {
   fullSession: FullSession;
   onUpdateInitiative: (initiative: FullInitiative) => void;
   onNextStep: () => void;
   language: Language;
}

export const FullStep5Workspace: React.FC<FullStep5WorkspaceProps> = ({
   fullSession,
   onUpdateInitiative,
   onNextStep,
   language
}) => {
   const t = translations.fullExecution;
   const initiatives = fullSession.initiatives || [];

   const [selectedInitiative, setSelectedInitiative] = useState<FullInitiative | null>(null);

   // Group by Status
   const columns: { id: string; label: string; color: string }[] = [
      { id: 'To Do', label: t.columns.todo[language], color: 'border-slate-500/50' },
      { id: 'In Progress', label: t.columns.inProgress[language], color: 'border-blue-500/50' },
      { id: 'Blocked', label: t.columns.blocked[language], color: 'border-red-500/50' },
      { id: 'Done', label: t.columns.done[language], color: 'border-green-500/50' }
   ];

   const getInitiativesByStatus = (status: string) => {
      // Filter only valid Kanban statuses
      return initiatives.filter(i => {
         if (status === 'To Do') return ['To Do', 'Draft', 'Ready'].includes(i.status); // Map old statuses to To Do
         return i.status === status;
      });
   };

   const handleCardClick = (init: FullInitiative) => {
      setSelectedInitiative(init);
   };

   // KPIs
   const total = initiatives.length;
   const doneCount = initiatives.filter(i => i.status === 'Done').length;
   const blockedCount = initiatives.filter(i => i.status === 'Blocked').length;
   const completionRate = total > 0 ? (doneCount / total) * 100 : 0;

   if (selectedInitiative) {
      return (
         <InitiativeTaskBoard
            initiative={selectedInitiative}
            onClose={() => setSelectedInitiative(null)}
         />
      );
   }

   return (
      <div className="flex flex-col h-full bg-navy-900">
         {/* Header with KPIs */}
         <div className="h-14 border-b border-white/5 flex items-center px-6 bg-navy-900 shrink-0 gap-8 overflow-x-auto">
            <div className="flex flex-col">
               <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t.kpi.total[language]}</span>
               <span className="text-lg font-bold text-white">{total}</span>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="flex flex-col">
               <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t.kpi.completion[language]}</span>
               <span className="text-lg font-bold text-blue-400">{completionRate.toFixed(0)}%</span>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="flex flex-col">
               <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t.columns.blocked[language]}</span>
               <span className={`text-lg font-bold ${blockedCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>{blockedCount}</span>
            </div>
         </div>

         {/* Kanban Board */}
         <div className="flex-1 overflow-x-auto p-4 md:p-6">
            <div className="flex gap-3 h-full min-w-[1000px]">
               {columns.map(col => (
                  <div key={col.id} className="flex-1 flex flex-col bg-navy-950/30 rounded-lg border border-white/5">
                     {/* Column Header */}
                     <div className={`p-3 border-b border-white/5 flex justify-between items-center ${col.id === 'Blocked' ? 'bg-red-500/5' : ''}`}>
                        <h4 className="font-semibold text-white text-xs">{col.label}</h4>
                        <span className="text-[10px] bg-navy-900 px-1.5 py-0.5 rounded text-slate-400">
                           {getInitiativesByStatus(col.id).length}
                        </span>
                     </div>

                     {/* Cards Container */}
                     <div className="p-2 space-y-2 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-navy-700">
                        {getInitiativesByStatus(col.id).map(init => (
                           <div
                              key={init.id}
                              onClick={() => handleCardClick(init)}
                              className={`
                             bg-navy-900 p-3 rounded-lg border hover:border-blue-500/50 cursor-pointer shadow-lg transition-all group relative
                             ${col.id === 'Blocked' ? 'border-red-500/20' : 'border-white/5'}
                           `}
                           >
                              {/* Axis Label */}
                              <div className="flex justify-between items-start mb-1.5">
                                 <span className="text-[10px] uppercase text-slate-500 font-bold bg-navy-950 px-1.5 py-0.5 rounded">
                                    {init.axis}
                                 </span>
                                 {init.priority === 'High' && <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>}
                              </div>

                              <h5 className="text-white text-xs font-medium mb-2 leading-snug">{init.name}</h5>

                              {/* Meta Info */}
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                 <div className="flex items-center gap-1.5">
                                    {init.owner ? (
                                       <div className="flex items-center gap-1 text-blue-300" title={init.owner}>
                                          <User size={10} />
                                          <span className="max-w-[50px] truncate">{init.owner}</span>
                                       </div>
                                    ) : (
                                       <span className="text-slate-600">-</span>
                                    )}
                                 </div>

                                 <div className="flex items-center gap-1.5">
                                    {init.dueDate ? (
                                       <div className="flex items-center gap-1" title={init.dueDate}>
                                          <Calendar size={10} />
                                          <span>{new Date(init.dueDate).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</span>
                                       </div>
                                    ) : (
                                       <span className="text-slate-600">-</span>
                                    )}
                                 </div>
                              </div>

                              {/* Progress Bar */}
                              <div className="mt-2 h-1 w-full bg-navy-950 rounded-full overflow-hidden">
                                 <div
                                    className={`h-full ${col.id === 'Done' ? 'bg-green-500' : 'bg-blue-500'}`}
                                    style={{ width: `${init.progress || 0}%` }}
                                 ></div>
                              </div>

                              {/* Hint to click */}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
                                 <div className="bg-navy-950/80 px-2 py-1 rounded text-[10px] text-white backdrop-blur flex items-center gap-1 border border-white/10">
                                    <BarChart2 size={10} /> Manage
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               ))}
            </div>
         </div>

         {/* Footer */}
         <div className="p-4 border-t border-white/5 bg-navy-900 flex justify-end">
            <button
               onClick={onNextStep}
               className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-lg bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30"
            >
               {t.nextStep[language]}
               <ArrowRight size={16} className={language === 'AR' ? 'rotate-180' : ''} />
            </button>
         </div>
      </div>
   );
};
