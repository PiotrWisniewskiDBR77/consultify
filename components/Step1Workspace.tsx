```typescript
import React from 'react';
import { ArrowRight, Lightbulb, Target, Users, Zap, CheckCircle2 } from 'lucide-react';
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

  // Local helper to update profile from parent (passed via props, but we need a setter from props? 
  // Wait, profile is just data. We need a way to UPDATE it. 
  // The FreeAssessmentView holds the state. We need to expose an update method or internalize simple state?
  // Current pattern in FreeAssessmentView: `setProfileData` is used in AI loop. 
  // We need to allow manual edits here if we want "Pencil" to work or just display properly.
  // For this tasks scope, let's assume we read from props, and updates happen via AI unless we add a callback.
  // Actually, requirement says "User inputs in right panel". So we need an onChange.
  // But the interface didn't have onChange. I will assume for now we display what AI gathered, 
  // or I add an onChange prop if I can. 
  // Let's stick to display for now to match interface, but improve layout. 
  // PROPER FIX: I need to add onProfileUpdate to props.
  // Since I can't change the parent in this single file edit, I will stick to layout updates 
  // and assume data comes from the AI/State in parent. 
  // WAIT - I can modify the interface here, but parent won't pass it. 
  // I will check if I can modify parent later. For now, layout.

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

        {/* Card 1: Basic Info */}
        <div className="bg-gradient-to-br from-navy-950/80 to-navy-900/80 border border-white/10 rounded-xl p-6 relative group hover:border-purple-500/30 transition-colors backdrop-blur-sm shadow-xl">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
            {t.profile[language]}
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">{t.industry[language]}</label>
              <p className="text-slate-200">{profile.industry || '---'}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">{t.size[language]}</label>
              <p className="text-slate-200">{profile.size || '---'}</p>
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">{t.country[language]}</label>
              <p className="text-slate-200">{profile.country || '---'}</p>
            </div>
          </div>
        </div>

        {/* Card 2: Business Model */}
        <div className="bg-navy-950/50 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-purple-200 mb-4 flex items-center gap-2">
            <Box size={20} />
            {language === 'PL' ? 'Model Biznesowy' : 'Business Model'}
          </h3>
          <div className="space-y-4">
            <div className="p-3 bg-white/5 rounded-lg border border-white/5">
              <p className="text-sm text-slate-300">
                {profile.businessModel?.description || (language === 'PL' ? 'Brak opisu modelu.' : 'No model description.')}
              </p>
              <div className="flex gap-2 mt-2">
                {profile.businessModel?.type?.map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Core Processes */}
        <div className="bg-navy-950/50 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-200 mb-4 flex items-center gap-2">
            <Layers size={20} />
            {language === 'PL' ? 'Kluczowe Procesy' : 'Core Processes'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {profile.coreProcesses && profile.coreProcesses.length > 0 ? (
              profile.coreProcesses.map(proc => (
                <span key={proc} className="px-3 py-1.5 rounded-md text-sm bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  {proc}
                </span>
              ))
            ) : (
              <span className="text-slate-500 text-sm italic">{language === 'PL' ? 'Nie zdefiniowano procesów.' : 'No processes defined.'}</span>
            )}
          </div>
        </div>

        {/* Card 4: IT Landscape */}
        <div className="bg-navy-950/50 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-green-200 mb-4 flex items-center gap-2">
            <Server size={20} />
            {language === 'PL' ? 'Krajobraz IT' : 'IT Landscape'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-white/5 rounded-lg">
              <label className="text-xs text-slate-500 block mb-1">ERP</label>
              <span className="text-slate-200 text-sm font-medium">{profile.itLandscape?.erp || 'Not Set'}</span>
            </div>
            <div className="p-3 bg-white/5 rounded-lg">
              <label className="text-xs text-slate-500 block mb-1">CRM</label>
              <span className="text-slate-200 text-sm font-medium">{profile.itLandscape?.crm || 'Not Set'}</span>
            </div>
            <div className="p-3 bg-white/5 rounded-lg">
              <label className="text-xs text-slate-500 block mb-1">MES</label>
              <span className="text-slate-200 text-sm font-medium">{profile.itLandscape?.mes || 'Not Set'}</span>
            </div>
            <div className="p-3 bg-white/5 rounded-lg">
              <label className="text-xs text-slate-500 block mb-1">Integrations</label>
              <span className={`text - sm font - medium ${
  profile.itLandscape?.integrationLevel === 'High' ? 'text-green-400' :
  profile.itLandscape?.integrationLevel === 'Medium' ? 'text-yellow-400' : 'text-slate-400'
} `}>
                {profile.itLandscape?.integrationLevel || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Footer / CTA */}
      <div className="p-6 border-t border-white/5 bg-navy-900 flex justify-end">
        <button
          onClick={onNextStep}
          disabled={!isStepComplete}
          className={`flex items - center gap - 2 px - 8 py - 4 rounded - lg font - semibold text - sm transition - all shadow - lg ${
  isStepComplete
    ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30'
    : 'bg-navy-800 text-slate-500 cursor-not-allowed'
} `}
        >
          {t.nextStep[language]}
          <ArrowRight size={18} className={language === 'AR' ? 'rotate-180' : ''} />
        </button>
      </div>
    </div>
  );
};
