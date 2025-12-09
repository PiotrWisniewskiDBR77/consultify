
import React, { useState } from 'react';
import { FullSession, FullInitiative, Language, AxisId } from '../types';
import { translations } from '../translations';
import { ArrowRight, Pencil, Save, X, Trash2 } from 'lucide-react';

interface FullStep2WorkspaceProps {
  fullSession: FullSession;
  onUpdateInitiative: (initiative: FullInitiative) => void;
  onNextStep: () => void;
  language: Language;
}

export const FullStep2Workspace: React.FC<FullStep2WorkspaceProps> = ({ 
  fullSession, 
  onUpdateInitiative, 
  onNextStep, 
  language 
}) => {
  const t = translations.fullInitiatives;
  const ts = translations.sidebar;
  const initiatives = fullSession.initiatives || [];
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalData, setModalData] = useState<FullInitiative | null>(null);

  const handleEditClick = (init: FullInitiative) => {
    setModalData({ ...init });
  };

  const handleModalSave = () => {
    if (modalData) {
      onUpdateInitiative(modalData);
      setModalData(null);
    }
  };

  const axisOptions: AxisId[] = ['processes', 'digitalProducts', 'businessModels', 'dataManagement', 'culture', 'aiMaturity'];

  const getAxisLabel = (id: string) => {
    const key = `fullStep1_${id === 'digitalProducts' ? 'prod' : id.substring(0,4)}` as any;
    return ts[key]?.[language] || id;
  };

  const renderDropdown = (
    currentValue: string, 
    options: string[], 
    onChange: (val: any) => void,
    colors?: Record<string, string>
  ) => (
    <select
      value={currentValue}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={`bg-navy-950 border border-white/10 text-xs rounded px-2 py-1 outline-none focus:border-blue-500 cursor-pointer ${colors ? colors[currentValue] : 'text-slate-300'}`}
    >
      {options.map(opt => (
        <option key={opt} value={opt}>{t[colors ? 'priorities' : 'statuses'][opt]?.[language] || opt}</option>
      ))}
    </select>
  );

  return (
    <div className="flex flex-col h-full bg-navy-900">
       {/* Header */}
       <div className="h-20 border-b border-white/5 flex flex-col justify-center px-8 bg-navy-900 shrink-0">
         <div className="flex justify-between items-center mb-1">
           <span className="text-sm font-semibold text-white tracking-wide">{t.intro ? t.intro[language].substring(0, 30) + '...' : 'Initiatives Generator'}</span>
           <span className="text-xs text-slate-500">STEP 2</span>
         </div>
         <div className="w-full h-1 bg-navy-800 rounded-full overflow-hidden">
           <div className="h-full bg-blue-500 w-2/6 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
         </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="border border-white/10 rounded-xl overflow-hidden bg-navy-950/50 shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-navy-900 border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <th className="p-4">{t.tableHeader.initiative[language]}</th>
                <th className="p-4">{t.tableHeader.axis[language]}</th>
                <th className="p-4">{t.tableHeader.priority[language]}</th>
                <th className="p-4">{t.tableHeader.complexity[language]}</th>
                <th className="p-4">{t.tableHeader.status[language]}</th>
                <th className="p-4 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {initiatives.map((init) => (
                <tr 
                  key={init.id} 
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                  onClick={() => handleEditClick(init)}
                >
                  <td className="p-4">
                    <div className="font-medium text-white text-sm">{init.name}</div>
                    {init.description && <div className="text-xs text-slate-500 mt-1 truncate max-w-xs">{init.description}</div>}
                  </td>
                  <td className="p-4 text-xs text-slate-400">
                     <span className="px-2 py-1 bg-navy-900 rounded border border-white/5">
                        {getAxisLabel(init.axis)}
                     </span>
                  </td>
                  <td className="p-4">
                    {renderDropdown(
                      init.priority, 
                      ['High', 'Medium', 'Low'], 
                      (val) => onUpdateInitiative({...init, priority: val}),
                      { 'High': 'text-red-400', 'Medium': 'text-yellow-400', 'Low': 'text-green-400' }
                    )}
                  </td>
                  <td className="p-4">
                    {renderDropdown(
                        init.complexity, 
                        ['High', 'Medium', 'Low'], 
                        (val) => onUpdateInitiative({...init, complexity: val})
                    )}
                  </td>
                  <td className="p-4">
                     <span className={`text-xs px-2 py-1 rounded border ${
                        init.status === 'Ready' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                        init.status === 'Archived' ? 'bg-slate-700/20 border-slate-600/30 text-slate-500' :
                        'bg-blue-500/10 border-blue-500/20 text-blue-400'
                     }`}>
                        {t.statuses[init.status]?.[language]}
                     </span>
                  </td>
                  <td className="p-4 text-right">
                    <button className="p-1.5 hover:bg-white/10 rounded-full text-slate-500 hover:text-white transition-colors">
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {initiatives.length === 0 && (
                 <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                       Generating initiatives...
                    </td>
                 </tr>
              )}
            </tbody>
          </table>
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
                 <h3 className="font-semibold text-white">Edit Initiative</h3>
                 <button onClick={() => setModalData(null)} className="text-slate-500 hover:text-white"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
                 <div>
                    <label className="text-xs uppercase text-slate-500 font-bold mb-1 block">Initiative Name</label>
                    <input 
                      value={modalData.name}
                      onChange={e => setModalData({...modalData, name: e.target.value})}
                      className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white focus:border-blue-500 outline-none"
                    />
                 </div>
                 
                 <div>
                    <label className="text-xs uppercase text-slate-500 font-bold mb-1 block">Description</label>
                    <textarea 
                      value={modalData.description || ''}
                      onChange={e => setModalData({...modalData, description: e.target.value})}
                      className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white focus:border-blue-500 outline-none h-20 resize-none"
                      placeholder="Short description of the initiative..."
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs uppercase text-slate-500 font-bold mb-1 block">Axis</label>
                        <select 
                           value={modalData.axis}
                           onChange={e => setModalData({...modalData, axis: e.target.value as AxisId})}
                           className="w-full bg-navy-950 border border-white/10 rounded p-2 text-slate-300 outline-none"
                        >
                           {axisOptions.map(a => <option key={a} value={a}>{getAxisLabel(a)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs uppercase text-slate-500 font-bold mb-1 block">Status</label>
                         <select 
                           value={modalData.status}
                           onChange={e => setModalData({...modalData, status: e.target.value as any})}
                           className="w-full bg-navy-950 border border-white/10 rounded p-2 text-slate-300 outline-none"
                        >
                           {['Draft', 'Ready', 'Archived'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs uppercase text-slate-500 font-bold mb-1 block">Priority</label>
                        <select 
                           value={modalData.priority}
                           onChange={e => setModalData({...modalData, priority: e.target.value as any})}
                           className="w-full bg-navy-950 border border-white/10 rounded p-2 text-slate-300 outline-none"
                        >
                           {['High', 'Medium', 'Low'].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs uppercase text-slate-500 font-bold mb-1 block">Complexity</label>
                         <select 
                           value={modalData.complexity}
                           onChange={e => setModalData({...modalData, complexity: e.target.value as any})}
                           className="w-full bg-navy-950 border border-white/10 rounded p-2 text-slate-300 outline-none"
                        >
                           {['High', 'Medium', 'Low'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                 </div>

                 <div>
                    <label className="text-xs uppercase text-slate-500 font-bold mb-1 block">Notes / Implementation Details</label>
                    <textarea 
                      value={modalData.notes || ''}
                      onChange={e => setModalData({...modalData, notes: e.target.value})}
                      className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white focus:border-blue-500 outline-none h-24 resize-none"
                      placeholder="Add specific notes, resources needed, or risks..."
                    />
                 </div>
              </div>
              <div className="p-4 border-t border-white/10 bg-navy-950 flex justify-end gap-3">
                 <button onClick={() => setModalData(null)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
                 <button onClick={handleModalSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium flex items-center gap-2">
                    <Save size={16} /> Save Changes
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
