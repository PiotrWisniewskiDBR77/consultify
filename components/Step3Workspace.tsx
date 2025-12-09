
import React, { useState } from 'react';
import { CompanyProfile, FreeSession, Language } from '../types';
import { translations } from '../translations';
import { ArrowRight, Download, Zap, Target, TrendingUp, X, Save, Pencil } from 'lucide-react';

interface Step3WorkspaceProps {
  profile: Partial<CompanyProfile>;
  sessionData: Partial<FreeSession>;
  onStartFullProject: () => void;
  language: Language;
  onUpdateQuickWin?: (index: number, updatedWin: { title: string; desc: string }) => void;
}

export const Step3Workspace: React.FC<Step3WorkspaceProps> = ({ 
  profile, 
  sessionData, 
  onStartFullProject,
  language,
  onUpdateQuickWin
}) => {
  const t = translations.step3;
  const [editingWinIndex, setEditingWinIndex] = useState<number | null>(null);
  const [winModalData, setWinModalData] = useState<{ title: string; desc: string } | null>(null);

  const handleWinClick = (index: number, win: { title: string; desc: string }) => {
    setEditingWinIndex(index);
    setWinModalData({ ...win });
  };

  const handleWinSave = () => {
    if (editingWinIndex !== null && winModalData && onUpdateQuickWin) {
      onUpdateQuickWin(editingWinIndex, winModalData);
      setEditingWinIndex(null);
      setWinModalData(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-navy-900">
      {/* Header / Progress */}
      <div className="h-20 border-b border-white/5 flex flex-col justify-center px-8 bg-navy-900 shrink-0">
         <div className="flex justify-between items-center mb-1">
           <span className="text-sm font-semibold text-white tracking-wide">{t.title[language]}</span>
           <span className="text-xs text-slate-500 uppercase tracking-widest">Phase 3/3</span>
         </div>
         <div className="w-full h-1 bg-navy-800 rounded-full overflow-hidden">
           <div className="h-full bg-purple-500 w-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
         </div>
      </div>
      
      {/* Content Scrollable */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin scrollbar-thumb-navy-700">
        
        {/* Card 1: Company Snapshot */}
        <div className="bg-gradient-to-br from-navy-950/90 to-navy-900/90 border border-white/10 rounded-xl p-6 backdrop-blur-sm shadow-xl relative overflow-hidden group hover:border-blue-500/20 transition-colors">
          <div className="absolute -top-6 -right-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp size={120} className="text-white" />
          </div>
          
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
            {t.snapshot[language]}
          </h3>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-8 relative z-10">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1 block">Role</label>
              <p className="text-white text-sm font-medium">{profile.role || '---'}</p>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1 block">Industry</label>
              <p className="text-white text-sm font-medium">{profile.industry || '---'}</p>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1 block">Size</label>
              <p className="text-white text-sm font-medium">{profile.size || '---'}</p>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1 block">Country</label>
              <p className="text-white text-sm font-medium">{profile.country || '---'}</p>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1 block">{t.revenue[language]}</label>
              <p className="text-white text-sm font-medium">{sessionData.revenueBracket || '---'}</p>
            </div>
             <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1 block">{t.maturity[language]}</label>
              <div className="flex gap-1 mt-1">
                 {[1,2,3,4,5].map(star => (
                    <div key={star} className={`w-2 h-2 rounded-full ${parseInt(sessionData.digitalMaturity || '2') >= star ? 'bg-purple-500 shadow-[0_0_5px_rgba(168,85,247,0.5)]' : 'bg-navy-700'}`}></div>
                 ))}
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-white/5">
             <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1 block">Main Transformation Goal</label>
             <p className="text-purple-300 font-medium text-sm">{sessionData.goal || 'Not defined'}</p>
          </div>
        </div>

        {/* Card 2: Recommended Focus Areas */}
        <div className="bg-gradient-to-br from-navy-950/90 to-navy-900/90 border border-white/10 rounded-xl p-6 backdrop-blur-sm shadow-xl">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
            {t.focusAreas[language]}
          </h3>

          <div className="flex flex-wrap gap-3">
            {sessionData.generatedFocusAreas?.map((area, idx) => (
              <div key={idx} className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-200 text-sm font-medium hover:bg-purple-500/20 transition-colors cursor-default">
                <Target size={16} className="text-purple-400" />
                {area}
              </div>
            ))}
            {!sessionData.generatedFocusAreas && (
               <div className="flex items-center gap-2 text-slate-500 italic text-sm">
                 <span className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"></span>
                 Generating recommendations...
               </div>
            )}
          </div>
        </div>

        {/* Card 3: Quick Wins */}
        <div className="bg-gradient-to-br from-navy-950/90 to-navy-900/90 border border-white/10 rounded-xl p-6 backdrop-blur-sm shadow-xl">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-green-500 rounded-full"></span>
            {t.quickWins[language]}
          </h3>

          <div className="space-y-4">
            {sessionData.generatedQuickWins?.map((win, idx) => (
              <div 
                key={idx} 
                onClick={() => handleWinClick(idx, win)}
                className="flex gap-4 p-4 rounded-lg bg-navy-950/50 border border-white/5 hover:border-green-500/30 transition-colors group cursor-pointer relative"
              >
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-white">
                  <Pencil size={14} />
                </div>
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 border border-green-500/20 group-hover:bg-green-500/20 transition-colors">
                   <Zap size={16} className="text-green-400" />
                </div>
                <div className="flex-1 pr-6">
                   <h4 className="text-white font-medium text-sm mb-1 group-hover:text-green-300 transition-colors">{win.title}</h4>
                   <p className="text-slate-400 text-xs leading-relaxed">{win.desc}</p>
                </div>
              </div>
            ))}
             {!sessionData.generatedQuickWins && (
               <div className="flex items-center gap-2 text-slate-500 italic text-sm">
                  <span className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"></span>
                  Calculating quick wins...
               </div>
            )}
          </div>
        </div>

      </div>

      {/* Footer / CTA */}
      <div className="p-6 border-t border-white/5 bg-navy-900 flex justify-between items-center gap-4">
        <button 
          className="flex items-center gap-2 px-6 py-4 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg text-sm font-medium transition-colors"
        >
          <Download size={18} />
          {t.download[language]}
        </button>

        <button 
          onClick={onStartFullProject}
          className="flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold text-sm transition-all shadow-lg bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30 group"
        >
          {t.startFull[language]}
          <ArrowRight size={18} className={`group-hover:translate-x-1 transition-transform ${language === 'AR' ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Edit Modal */}
      {winModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4">
           <div className="bg-navy-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-navy-950">
                 <h3 className="font-semibold text-white">Edit Quick Win</h3>
                 <button onClick={() => { setEditingWinIndex(null); setWinModalData(null); }} className="text-slate-500 hover:text-white"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-4">
                 <div>
                    <label className="text-xs uppercase text-slate-500 font-bold mb-1 block">Title</label>
                    <input 
                      value={winModalData.title}
                      onChange={e => setWinModalData({...winModalData, title: e.target.value})}
                      className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white focus:border-green-500 outline-none"
                    />
                 </div>
                 
                 <div>
                    <label className="text-xs uppercase text-slate-500 font-bold mb-1 block">Description (One line)</label>
                    <textarea 
                      value={winModalData.desc}
                      onChange={e => setWinModalData({...winModalData, desc: e.target.value})}
                      className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white focus:border-green-500 outline-none h-20 resize-none"
                    />
                 </div>
              </div>
              <div className="p-4 border-t border-white/10 bg-navy-950 flex justify-end gap-3">
                 <button onClick={() => { setEditingWinIndex(null); setWinModalData(null); }} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
                 <button onClick={handleWinSave} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium flex items-center gap-2">
                    <Save size={16} /> Save Changes
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
