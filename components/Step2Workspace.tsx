
import React from 'react';
import { ArrowRight } from 'lucide-react';
import { CompanyProfile, FreeSession, Language } from '../types';
import { translations } from '../translations';

interface Step2WorkspaceProps {
  profile: Partial<CompanyProfile>;
  sessionData: Partial<FreeSession>;
  onNextStep: () => void;
  language: Language;
}

export const Step2Workspace: React.FC<Step2WorkspaceProps> = ({ 
  profile, 
  sessionData, 
  onNextStep,
  language
}) => {
  const t = translations.step1; // Using common labels

  return (
    <div className="flex flex-col h-full bg-navy-900">
      {/* Header */}
      <div className="h-20 border-b border-white/5 flex flex-col justify-center px-8 bg-navy-900 shrink-0">
         <div className="flex justify-between items-center mb-1">
           <span className="text-sm font-semibold text-white tracking-wide">Step 2 of 3 — Challenges & Profile</span>
           <span className="text-xs text-slate-500">Quick Assessment</span>
         </div>
         <div className="w-full h-1 bg-navy-800 rounded-full overflow-hidden">
           <div className="h-full bg-purple-500 w-2/3 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
         </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        
        {/* Card 1: Extended Profile */}
        <div className="bg-navy-950/50 border border-white/10 rounded-xl p-6 relative">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
            Profile Details
          </h3>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">Digital Maturity</label>
              <div className="flex gap-1">
                 {[1,2,3,4,5].map(star => (
                    <div key={star} className={`w-3 h-3 rounded-full ${parseInt(sessionData.digitalMaturity || '0') >= star ? 'bg-purple-500' : 'bg-navy-700'}`}></div>
                 ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">Revenue</label>
              <p className="text-slate-200">{sessionData.revenueBracket || '---'}</p>
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">Main Pain Points</label>
               {sessionData.painPoints && sessionData.painPoints.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-1">
                  {sessionData.painPoints.map((point, idx) => (
                    <span key={idx} className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-full">
                      {point}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm mt-1">Not selected...</p>
              )}
            </div>
             <div className="space-y-1 col-span-2">
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">Priority Area</label>
              <p className="text-purple-300 font-medium">{sessionData.priorityArea || '---'}</p>
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="p-6 border-t border-white/5 bg-navy-900 flex justify-end">
        <button 
          onClick={onNextStep}
          disabled={!sessionData.step2Completed}
          className={`flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-sm transition-all shadow-lg ${
            sessionData.step2Completed 
              ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30' 
              : 'bg-navy-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          Go to Recommendations (Step 3)
          <ArrowRight size={18} className={language === 'AR' ? 'rotate-180' : ''} />
        </button>
      </div>
    </div>
  );
};
    