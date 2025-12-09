
import React from 'react';
import { Pencil, ArrowRight } from 'lucide-react';
import { CompanyProfile, FreeSession, Language } from '../types';
import { translations } from '../translations';

interface Step1WorkspaceProps {
  profile: Partial<CompanyProfile>;
  sessionData: Partial<FreeSession>;
  isStepComplete: boolean;
  onNextStep: () => void;
  language: Language;
}

export const Step1Workspace: React.FC<Step1WorkspaceProps> = ({ 
  profile, 
  sessionData, 
  isStepComplete, 
  onNextStep,
  language
}) => {
  const t = translations.step1;

  return (
    <div className="flex flex-col h-full bg-navy-900">
      {/* Header / Progress */}
      <div className="h-20 border-b border-white/5 flex flex-col justify-center px-8 bg-navy-900 shrink-0">
         <div className="flex justify-between items-center mb-1">
           <span className="text-sm font-semibold text-white tracking-wide">{t.title[language]}</span>
           <span className="text-xs text-slate-500">{t.subtitle[language]}</span>
         </div>
         <div className="w-full h-1 bg-navy-800 rounded-full overflow-hidden">
           <div className="h-full bg-purple-500 w-1/3 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
         </div>
      </div>
      
      {/* Content Scrollable */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        
        {/* Card 1: Company Profile */}
        <div className="bg-gradient-to-br from-navy-950/80 to-navy-900/80 border border-white/10 rounded-xl p-6 relative group hover:border-purple-500/30 transition-colors backdrop-blur-sm shadow-xl">
          <div className={`absolute top-4 ${language === 'AR' ? 'left-4' : 'right-4'} opacity-0 group-hover:opacity-10 transition-opacity cursor-pointer text-slate-500 hover:text-purple-400`}>
            <Pencil size={16} />
          </div>
          
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
            {t.profile[language]}
          </h3>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">{t.role[language]}</label>
              <p className="text-purple-300 font-medium">{profile.role || '---'}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">{t.industry[language]}</label>
              <p className="text-slate-200">
                {profile.industry || '---'} 
                {profile.subIndustry && <span className="text-slate-400 text-sm"> / {profile.subIndustry}</span>}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">{t.size[language]}</label>
              <p className="text-slate-200">{profile.size || '---'}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">{t.country[language]}</label>
              <p className="text-slate-200">{profile.country || '---'}</p>
            </div>
          </div>
        </div>

        {/* Card 2: Expectations */}
        <div className="bg-gradient-to-br from-navy-950/80 to-navy-900/80 border border-white/10 rounded-xl p-6 relative group hover:border-blue-500/30 transition-colors backdrop-blur-sm shadow-xl">
          <div className={`absolute top-4 ${language === 'AR' ? 'left-4' : 'right-4'} opacity-0 group-hover:opacity-10 transition-opacity cursor-pointer text-slate-500 hover:text-blue-400`}>
            <Pencil size={16} />
          </div>

          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
            {t.expectations[language]}
          </h3>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">{t.mainGoal[language]}</label>
              <div className="p-3 bg-navy-900 border border-white/5 rounded text-sm text-blue-200">
                {sessionData.goal || t.toBeDefined[language]}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">{t.horizon[language]}</label>
              <p className="text-slate-200 font-medium">
                {sessionData.timeHorizon ? `${sessionData.timeHorizon} ${t.months[language]}` : '---'}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Footer / CTA */}
      <div className="p-6 border-t border-white/5 bg-navy-900 flex justify-end">
        <button 
          onClick={onNextStep}
          disabled={!isStepComplete}
          className={`flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-sm transition-all shadow-lg ${
            isStepComplete 
              ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30' 
              : 'bg-navy-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {t.nextStep[language]}
          <ArrowRight size={18} className={language === 'AR' ? 'rotate-180' : ''} />
        </button>
      </div>
    </div>
  );
};
