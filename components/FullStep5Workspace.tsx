
import React, { useState } from 'react';
import { FullSession, FullInitiative, Language, InitiativeStatus } from '../types';
import { translations } from '../translations';
import { ArrowRight, User, Calendar, AlertCircle, CheckCircle2, Clock, MoreHorizontal, X, Save } from 'lucide-react';

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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalData, setModalData] = useState<FullInitiative | null>(null);

  // Group by Status
  const columns: { id: InitiativeStatus; label: string; color: string }[] = [
    { id: 'To Do', label: t.columns.todo[language], color: 'border-slate-500/50' },
    { id: 'In Progress', label: t.columns.inProgress[language], color: 'border-blue-500/50' },
    { id: 'Blocked', label: t.columns.blocked[language], color: 'border-red-500/50' },
    { id: 'Done', label: t.columns.done[language], color: 'border-green-500/50' }
  ];

  const getInitiativesByStatus = (status: InitiativeStatus) => {
     // Filter only valid Kanban statuses
     return initiatives.filter(i => {
         if (status === 'To Do') return ['To Do', 'Draft', 'Ready'].includes(i.status); // Map old statuses to To Do
         return i.status === status;
     });
  };

  const handleCardClick = (init: FullInitiative) => {
    setModalData({ ...init });
  };

  const handleModalSave = () => {
    if (modalData) {
      onUpdateInitiative(modalData);
      setModalData(null);
    }
  };

  // KPIs
  const total = initiatives.length;
  const doneCount = initiatives.filter(i => i.status === 'Done').length;
  const blockedCount = initiatives.filter(i => i.status === 'Blocked').length;
  const completionRate = total > 0 ? (doneCount / total) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-navy-900">
       {/* Header with KPIs */}
       <div className="h-24 border-b border-white/5 flex items-center px-8 bg-navy-900 shrink-0 gap-6 overflow-x-auto">
          <div className="flex flex-col">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{t.kpi.total[language]}</span>
              <span className="text-2xl font-bold text-white">{total}</span>
          </div>
          <div className="w-px h-10 bg-white/10"></div>
          <div className="flex flex-col">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{t.kpi.completion[language]}</span>
              <span className="text-2xl font-bold text-blue-400">{completionRate.toFixed(0)}%</span>
          </div>
          <div className="w-px h-10 bg-white/10"></div>
          <div className="flex flex-col">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{t.columns.blocked[language]}</span>
              <span className={`text-2xl font-bold ${blockedCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>{blockedCount}</span>
          </div>
       </div>

       {/* Kanban Board */}
       <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4 h-full min-w-[1000px]">
             {columns.map(col => (
                <div key={col.id} className="flex-1 flex flex-col bg-navy-950/30 rounded-xl border border-white/5">
                   {/* Column Header */}
                   <div className={`p-4 border-b border-white/5 flex justify-between items-center ${col.id === 'Blocked' ? 'bg-red-500/5' : ''}`}>
                      <h4 className="font-semibold text-white text-sm">{col.label}</h4>
                      <span className="text-xs bg-navy-900 px-2 py-0.5 rounded text-slate-400">
                         {getInitiativesByStatus(col.id).length}
                      </span>
                   </div>

                   {/* Cards Container */}
                   <div className="p-3 space-y-3 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-navy-700">
                      {getInitiativesByStatus(col.id).map(init => (
                         <div 
                           key={init.id}
                           onClick={() => handleCardClick(init)}
                           className={`
                             bg-navy-900 p-4 rounded-lg border hover:border-blue-500/50 cursor-pointer shadow-lg transition-all group relative
                             ${col.id === 'Blocked' ? 'border-red-500/20' : 'border-white/5'}
                           `}
                         >
                            {/* Axis Label */}
                            <div className="flex justify-between items-start mb-2">
                               <span className="text-[10px] uppercase text-slate-500 font-bold bg-navy-950 px-1.5 py-0.5 rounded">
                                  {init.axis}
                               </span>
                               {init.priority === 'High' && <div className="w-2 h-2 rounded-full bg-red-500"></div>}
                            </div>
                            
                            <h5 className="text-white text-sm font-medium mb-3 leading-snug">{init.name}</h5>
                            
                            {/* Meta Info */}
                            <div className="flex items-center justify-between text-xs text-slate-400">
                               <div className="flex items-center gap-2">
                                  {init.owner ? (
                                     <div className="flex items-center gap-1 text-blue-300" title={init.owner}>
                                        <User size={12} />
                                        <span className="max-w-[60px] truncate">{init.owner}</span>
                                     </div>
                                  ) : (
                                     <span className="text-slate-600">-</span>
                                  )}
                               </div>
                               
                               <div className="flex items-center gap-2">
                                  {init.dueDate ? (
                                     <div className="flex items-center gap-1" title={init.dueDate}>
                                        <Calendar size={12} />
                                        <span>{new Date(init.dueDate).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}</span>
                                     </div>
                                  ) : (
                                     <span className="text-slate-600">-</span>
                                  )}
                               </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-3 h-1 w-full bg-navy-950 rounded-full overflow-hidden">
                               <div 
                                 className={`h-full ${col.id === 'Done' ? 'bg-green-500' : 'bg-blue-500'}`} 
                                 style={{ width: `${init.progress || 0}%` }}
                               ></div>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
             ))}
          </div>
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

       {/* Edit Modal */}
       {modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4">
           <div className="bg-navy-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-navy-950">
                 <h3 className="font-semibold text-white">Update Initiative</h3>
                 <button onClick={() => setModalData(null)} className="text-slate-500 hover:text-white"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-5">
                 <div>
                    <h4 className="text-white font-medium text-lg">{modalData.name}</h4>
                    <p className="text-slate-400 text-sm mt-1">{modalData.description || 'No description provided.'}</p>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs uppercase text-slate-500 font-bold mb-1 block">{t.fields.owner[language]}</label>
                        <input 
                           value={modalData.owner || ''}
                           onChange={e => setModalData({...modalData, owner: e.target.value})}
                           className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white focus:border-blue-500 outline-none text-sm"
                           placeholder="Unassigned"
                        />
                    </div>
                    <div>
                        <label className="text-xs uppercase text-slate-500 font-bold mb-1 block">{t.fields.dueDate[language]}</label>
                        <input 
                           type="date"
                           value={modalData.dueDate || ''}
                           onChange={e => setModalData({...modalData, dueDate: e.target.value})}
                           className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white focus:border-blue-500 outline-none text-sm"
                        />
                    </div>
                 </div>

                 <div>
                    <label className="text-xs uppercase text-slate-500 font-bold mb-1 block">Status</label>
                    <div className="flex gap-2">
                       {['To Do', 'In Progress', 'Blocked', 'Done'].map(s => (
                          <button
                            key={s}
                            onClick={() => setModalData({...modalData, status: s as any})}
                            className={`flex-1 py-2 rounded text-xs font-medium border transition-colors ${
                                modalData.status === s 
                                    ? 'bg-blue-500/20 border-blue-500 text-blue-300' 
                                    : 'bg-navy-950 border-white/10 text-slate-400 hover:bg-navy-800'
                            }`}
                          >
                             {s}
                          </button>
                       ))}
                    </div>
                 </div>

                 <div>
                    <label className="text-xs uppercase text-slate-500 font-bold mb-1 flex justify-between">
                        <span>{t.fields.progress[language]}</span>
                        <span className="text-blue-400">{modalData.progress || 0}%</span>
                    </label>
                    <input 
                       type="range"
                       min="0"
                       max="100"
                       step="5"
                       value={modalData.progress || 0}
                       onChange={e => setModalData({...modalData, progress: parseInt(e.target.value)})}
                       className="w-full h-2 bg-navy-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                 </div>
              </div>
              <div className="p-4 border-t border-white/10 bg-navy-950 flex justify-end gap-3">
                 <button onClick={() => setModalData(null)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
                 <button onClick={handleModalSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium flex items-center gap-2">
                    <Save size={16} /> Update Task
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
