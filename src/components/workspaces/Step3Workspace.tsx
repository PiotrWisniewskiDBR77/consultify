import { AlertTriangle, ArrowRight, CheckCircle, FileText, Lock } from 'lucide-react';
import React from 'react';

import { CompanyProfile, FreeSession } from '../../types';

interface Step3WorkspaceProps {
  profile: Partial<CompanyProfile>;
  sessionData: Partial<FreeSession>;
  onStartFullProject: () => void;
  onUpdateQuickWin?: (index: number, updatedWin: { title: string; desc: string }) => void;
}

export const Step3Workspace: React.FC<Step3WorkspaceProps> = ({
  profile,
  sessionData,
  onStartFullProject,
}) => {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-navy-900">
      {/* Header / Progress */}
      <div className="h-20 border-b border-slate-200 dark:border-c-border-subtle flex flex-col justify-center px-8 bg-white dark:bg-navy-900 shrink-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-semibold text-slate-900 dark:text-white tracking-wide">
            Step 3 of 3 — Challenges & Risks
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            Phase 3/3
          </span>
        </div>
        <div className="w-full h-1 bg-slate-50 dark:bg-navy-800 rounded-full overflow-hidden">
          <div className="h-full bg-navy-900 w-full "></div>
        </div>
      </div>

      {/* Content Scrollable */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-navy-700">
        {/* Card 1: Challenges Map */}
        <div className="bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-c-border-subtle rounded-xl p-6 relative group border-l-4 border-l-danger-500/50">
          <div className="absolute top-0 right-0 p-6 opacity-5">
            <AlertTriangle size={64} className="text-danger-500" />
          </div>

          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-danger-500 rounded-full"></span>
            Challenges Map
          </h3>

          <div className="space-y-3">
            {sessionData.challengesMap && sessionData.challengesMap.length > 0 ? (
              sessionData.challengesMap.map((challenge) => (
                <div
                  key={challenge.id}
                  className="p-3 bg-slate-50/30 dark:bg-navy-950/20 rounded-lg border border-slate-200 dark:border-c-border-subtle flex flex-col gap-2"
                >
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider">
                      {challenge.area}
                    </span>
                    <div className="flex gap-2">
                      <span className="text-[10px] px-2 py-0.5 bg-danger-500/10 text-danger-300 rounded border border-danger-500/20">
                        Sev: {challenge.severity}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-300 rounded border border-amber-500/20">
                        Imp: {challenge.impact}
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-900 dark:text-white text-sm font-medium">
                    {challenge.title}
                  </p>
                  {challenge.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {challenge.description}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-slate-500 dark:text-slate-400 italic border border-dashed border-slate-200 dark:border-c-border-subtle rounded-lg">
                No challenges identified yet.
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Constraints & Risks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Constraints */}
          <div className="bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-c-border-subtle rounded-xl p-6 relative">
            <h3 className="text-md font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
              <Lock size={16} />
              Constraints
            </h3>
            <div className="space-y-2">
              {sessionData.constraints && sessionData.constraints.length > 0 ? (
                sessionData.constraints.map((c) => (
                  <div
                    key={c.id}
                    className="text-sm p-2 bg-slate-50/30 dark:bg-navy-950/20 rounded border border-slate-200 dark:border-c-border-subtle flex justify-between"
                  >
                    <span className="text-slate-700 dark:text-slate-300">{c.type}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${c.impactLevel === 'High' ? 'bg-danger-100 dark:bg-danger-900/40 text-danger-600 dark:text-danger-200' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                    >
                      {c.impactLevel}
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-xs text-slate-600 dark:text-slate-400 block italic">
                  None defined
                </span>
              )}
            </div>
          </div>

          {/* Documents */}
          <div className="bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-c-border-subtle rounded-xl p-6 relative">
            <h3 className="text-md font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
              <FileText size={16} />
              Documents
            </h3>
            <div className="border border-dashed border-slate-200 dark:border-c-border-subtle rounded bg-slate-50/30 dark:bg-navy-950/20 h-24 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/40 cursor-pointer transition-colors">
              Drag strategy files here
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
              <h4 className="text-green-400 font-medium mb-1">Strategic Context Ready</h4>
              <p className="text-green-400/70 text-sm">
                AI has built the context model. We can proceed to Assessment.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer / CTA */}
      <div className="p-6 border-t border-slate-200 dark:border-c-border-subtle bg-white dark:bg-navy-900 flex justify-end items-center gap-4">
        <button
          onClick={onStartFullProject}
          disabled={!sessionData.step3Completed}
          className={`flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold text-sm transition-all shadow-lg group ${
            sessionData.step3Completed
              ? 'bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] shadow-primary-900/30'
              : 'bg-slate-50 dark:bg-navy-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
          }`}
        >
          Go to Assessment (Module 2)
          <ArrowRight size={18} className={`group-hover:translate-x-1 transition-transform`} />
        </button>
      </div>
    </div>
  );
};
