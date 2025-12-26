
import React, { useState } from 'react';
import { FullSession, FullInitiative, InitiativeStatus } from '../types';
import { useTranslation } from 'react-i18next';
import { ArrowRight, User, Calendar, BarChart2 } from 'lucide-react';
import { InitiativeTaskBoard } from './InitiativeTaskBoard';

interface FullStep5WorkspaceProps {
   fullSession: FullSession;
   onUpdateInitiative: (initiative: FullInitiative) => void;
   onNextStep: () => void;
}

export const FullStep5Workspace: React.FC<FullStep5WorkspaceProps> = ({
   fullSession,
   onUpdateInitiative: _onUpdateInitiative,
   onNextStep
}) => {
   const { t: translate } = useTranslation();
   const t = translate('fullExecution', { returnObjects: true }) as any;
   const initiatives = fullSession.initiatives || [];

   const [selectedInitiative, setSelectedInitiative] = useState<FullInitiative | null>(null);
   const [showMyOnly, setShowMyOnly] = useState(false);
   const [showBlockedOnly, setShowBlockedOnly] = useState(false);

   // Group by Status
   const columns: { id: string; label: string; color: string }[] = [
      { id: 'To Do', label: t.columns.todo, color: 'border-slate-500/50' },
      { id: 'In Progress', label: t.columns.inProgress, color: 'border-blue-500/50' },
      { id: 'Blocked', label: t.columns.blocked, color: 'border-red-500/50' },
      { id: 'Done', label: t.columns.done, color: 'border-green-500/50' }
   ];

   const getInitiativesByStatus = (status: string) => {
      // Filter only valid Kanban statuses
      return initiatives.filter(i => {
         // Filter: My Initiatives (Mock user match for demo or real if ownerId checks out)
         if (showMyOnly) {
            // Logic: Check if current user is owner (business or execution)
            // For now assumption: we don't have easy currentUserId in this component, so just showing a subset or mock
            // TODO: Pass currentUserId prop
         }

         // Filter: Blocked Only
         if (showBlockedOnly && i.status !== InitiativeStatus.BLOCKED && status !== 'Blocked') return false;

         if (status === 'To Do') return [InitiativeStatus.DRAFT, InitiativeStatus.PLANNING, InitiativeStatus.APPROVED].includes(i.status);
         if (status === 'In Progress') return i.status === InitiativeStatus.EXECUTING;
         if (status === 'Blocked') return i.status === InitiativeStatus.BLOCKED;
         if (status === 'Done') return i.status === InitiativeStatus.DONE;
         return false;
      });
   };

   const handleCardClick = (init: FullInitiative) => {
      setSelectedInitiative(init);
   };

   // KPIs
   const total = initiatives.length;
   const doneCount = initiatives.filter(i => i.status === InitiativeStatus.DONE).length;
   const blockedCount = initiatives.filter(i => i.status === InitiativeStatus.BLOCKED).length;
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
      <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-900 font-sans">
         {/* Header with KPIs */}
         <div className="h-14 border-b border-slate-200 dark:border-white/5 flex items-center px-6 bg-white dark:bg-navy-900 shrink-0 gap-8 overflow-x-auto shadow-sm dark:shadow-none">
            <div className="flex flex-col">
               <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t.kpi.total}</span>
               <span className="text-lg font-bold text-navy-900 dark:text-white">{total}</span>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-white/10"></div>
            <div className="flex flex-col">
               <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t.kpi.completion}</span>
               <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{completionRate.toFixed(0)}%</span>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-white/10"></div>
            <div className="flex flex-col">
               <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t.columns.blocked}</span>
               <span className={`text-lg font-bold ${blockedCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>{blockedCount}</span>
            </div>

            <div className="flex-1"></div>

            {/* Filter Toggles */}
            <div className="flex items-center gap-3">
               <button
                  onClick={() => setShowMyOnly(!showMyOnly)}
                  className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${showMyOnly ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-50 dark:bg-navy-800 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700'}`}
               >
                  My Initiatives
               </button>
               <button
                  onClick={() => setShowBlockedOnly(!showBlockedOnly)}
                  className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${showBlockedOnly ? 'bg-red-100 dark:bg-red-900/50 border-red-500 text-red-600 dark:text-red-200' : 'bg-slate-50 dark:bg-navy-800 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700'}`}
               >
                  Show Blocked
               </button>
            </div>
         </div>

         {/* Kanban Board */}
         <div className="flex-1 overflow-x-auto p-4 md:p-6 bg-slate-50 dark:bg-navy-950">
            <div className="flex gap-3 h-full min-w-[1000px]">
               {columns.map(col => (
                  <div key={col.id} className="flex-1 flex flex-col bg-slate-100 dark:bg-navy-950/30 rounded-lg border border-slate-200 dark:border-white/5">
                     {/* Column Header */}
                     <div className={`p-3 border-b border-slate-200 dark:border-white/5 flex justify-between items-center ${col.id === 'Blocked' ? 'bg-red-50 dark:bg-red-500/5' : ''}`}>
                        <h4 className="font-semibold text-navy-900 dark:text-white text-xs">{col.label}</h4>
                        <span className="text-[10px] bg-white dark:bg-navy-900 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10">
                           {getInitiativesByStatus(col.id).length}
                        </span>
                     </div>

                     {/* Cards Container */}
                     <div className="p-2 space-y-2 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-navy-700">
                        {getInitiativesByStatus(col.id).map(init => (
                           <div
                              key={init.id}
                              onClick={() => handleCardClick(init)}
                              className={`
                             bg-white dark:bg-navy-900 p-3 rounded-lg border hover:border-blue-500/50 cursor-pointer shadow-sm hover:shadow-md dark:shadow-lg transition-all group relative
                             ${col.id === 'Blocked' ? 'border-red-200 dark:border-red-500/20' : 'border-slate-200 dark:border-white/5'}
                           `}
                           >
                              {/* Axis Label */}
                              <div className="flex justify-between items-start mb-1.5">
                                 <span className="text-[10px] uppercase text-slate-500 font-bold bg-slate-50 dark:bg-navy-950 px-1.5 py-0.5 rounded border border-slate-100 dark:border-white/5">
                                    {init.axis}
                                 </span>
                                 {init.priority === 'High' && <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>}
                              </div>

                              <h5 className="text-navy-900 dark:text-white text-xs font-medium mb-2 leading-snug">{init.name}</h5>

                              {/* Meta Info */}
                              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                 <div className="flex items-center gap-1.5">
                                    {init.ownerBusiness ? (
                                       <div className="flex items-center gap-1 text-blue-600 dark:text-blue-300" title={`${init.ownerBusiness.firstName} ${init.ownerBusiness.lastName}`}>
                                          <User size={10} />
                                          <span className="max-w-[50px] truncate">{init.ownerBusiness.lastName}</span>
                                       </div>
                                    ) : (
                                       <span className="text-slate-400 dark:text-slate-600">-</span>
                                    )}
                                 </div>

                                 <div className="flex items-center gap-1.5">
                                    {init.endDate ? (
                                       <div className="flex items-center gap-1" title={init.endDate}>
                                          <Calendar size={10} />
                                          <span>{new Date(init.endDate).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</span>
                                       </div>
                                    ) : (
                                       <span className="text-slate-400 dark:text-slate-600">-</span>
                                    )}
                                 </div>
                              </div>

                              {/* Progress Bar */}
                              <div className="mt-2 h-1 w-full bg-slate-100 dark:bg-navy-950 rounded-full overflow-hidden">
                                 <div
                                    className={`h-full ${col.id === 'Done' ? 'bg-green-500' : 'bg-blue-500'}`}
                                    style={{ width: `${init.progress || 0}%` }}
                                 ></div>
                              </div>

                              {/* Hint to click */}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-slate-900/5 dark:group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
                                 <div className="bg-white/90 dark:bg-navy-950/80 px-2 py-1 rounded text-[10px] text-navy-900 dark:text-white backdrop-blur flex items-center gap-1 border border-slate-200 dark:border-white/10 shadow-sm">
                                    <BarChart2 size={10} /> View
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
         <div className="p-4 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-navy-900 flex justify-end">
            <button
               onClick={onNextStep}
               className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-lg bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30"
            >
               {t.nextStep}
               <ArrowRight size={16} />
            </button>
         </div>
      </div>
   );
};
