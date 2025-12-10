import React from 'react';
import { CompanyProfile, FreeSession, Language } from '../types';
import { translations } from '../translations';
import { ArrowRight, Target, AlertTriangle, Lock, FileText, CheckCircle } from 'lucide-react';

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
  language
}) => {
  const t = translations.step1;

  return (
    <div className="flex flex-col h-full bg-navy-900">
      {/* Header / Progress */}
      <div className="h-20 border-b border-white/5 flex flex-col justify-center px-8 bg-navy-900 shrink-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-semibold text-white tracking-wide">
            {language === 'PL' ? 'Krok 3 z 3 — Mapa Wyzwań & Ryzyka' : 'Step 3 of 3 — Challenges & Risks'}
          </span>
          <span className="text-xs text-slate-500 uppercase tracking-widest">Phase 3/3</span>
        </div>
        <div className="w-full h-1 bg-navy-800 rounded-full overflow-hidden">
          <div className="h-full bg-purple-500 w-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
        </div>
      </div>

      {/* Content Scrollable */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin scrollbar-thumb-navy-700">

        {/* Card 1: Challenges Map */}
        <div className="bg-navy-950/50 border border-white/10 rounded-xl p-6 relative group border-l-4 border-l-red-500/50">
          <div className="absolute top-0 right-0 p-6 opacity-5">
            <AlertTriangle size={64} className="text-red-500" />
          </div>

          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-red-500 rounded-full"></span>
            {language === 'PL' ? 'Mapa Wyzwań' : 'Challenges Map'}
          </h3>

          <div className="space-y-3">
            {sessionData.challengesMap && sessionData.challengesMap.length > 0 ? (
              sessionData.challengesMap.map(challenge => (
                <div key={challenge.id} className="p-3 bg-white/5 rounded-lg border border-white/5 flex flex-col gap-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{challenge.area}</span>
                    <div className="flex gap-2">
                      <span className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-300 rounded border border-red-500/20">Sev: {challenge.severity}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-orange-500/10 text-orange-300 rounded border border-orange-500/20">Imp: {challenge.impact}</span>
                    </div>
                  </div>
                  <p className="text-white text-sm font-medium">{challenge.title}</p>
                  {challenge.description && <p className="text-xs text-slate-500">{challenge.description}</p>}
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-slate-500 italic border border-dashed border-white/10 rounded-lg">
                {language === 'PL' ? 'Nie zidentyfikowano jeszcze wyzwań.' : 'No challenges identified yet.'}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Constraints & Risks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Constraints */}
          <div className="bg-navy-950/50 border border-white/10 rounded-xl p-6 relative">
            <h3 className="text-md font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Lock size={16} />
              {language === 'PL' ? 'Ograniczenia' : 'Constraints'}
            </h3>
            <div className="space-y-2">
              {sessionData.constraints && sessionData.constraints.length > 0 ? (
                sessionData.constraints.map(c => (
                  <div key={c.id} className="text-sm p-2 bg-white/5 rounded border border-white/5 flex justify-between">
                    <span className="text-slate-300">{c.type}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${c.impactLevel === 'High' ? 'bg-red-900/40 text-red-200' : 'bg-slate-700 text-slate-300'}`}>{c.impactLevel}</span>
                  </div>
                ))
              ) : (
                <span className="text-xs text-slate-600 block italic">None defined</span>
              )}
            </div>
          </div>

          {/* Documents */}
          <div className="bg-navy-950/50 border border-white/10 rounded-xl p-6 relative">
            <h3 className="text-md font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <FileText size={16} />
              {language === 'PL' ? 'Dokumenty' : 'Documents'}
            </h3>
            <div className="border border-dashed border-white/10 rounded bg-white/5 h-24 flex items-center justify-center text-xs text-slate-500 hover:bg-white/10 cursor-pointer transition-colors">
              {language === 'PL' ? 'Przeciągnij pliki strategii tutaj' : 'Drag strategy files here'}
            </div>
          </div>
        </div>


        {/* Card 3: Summary / Ready */}
        {sessionData.step3Completed && (
          <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-6 flex gap-4 items-start">
            <div className="mt-1 text-green-400">
              <CheckCircle size={24} />
            </div>
            <div>
              <h4 className="text-green-400 font-medium mb-1">
                {language === 'PL' ? 'Kontekst Strategiczny Gotowy' : 'Strategic Context Ready'}
              </h4>
              <p className="text-green-400/70 text-sm">
                {language === 'PL'
                  ? 'AI zbudowało model kontekstu. Możemy przejść do Assessmentu.'
                  : 'AI has built the context model. We can proceed to Assessment.'}
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Footer / CTA */}
      <div className="p-6 border-t border-white/5 bg-navy-900 flex justify-end items-center gap-4">
        <button
          onClick={onStartFullProject}
          disabled={!sessionData.step3Completed}
          className={`flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold text-sm transition-all shadow-lg group ${sessionData.step3Completed
            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30'
            : 'bg-navy-800 text-slate-500 cursor-not-allowed'
            }`}
        >
          {language === 'PL' ? 'Przejdź do Assessmentu (Moduł 2)' : 'Go to Assessment (Module 2)'}
          <ArrowRight size={18} className={`group-hover:translate-x-1 transition-transform ${language === 'AR' ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};
