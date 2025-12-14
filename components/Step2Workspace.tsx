
import React from 'react';
import { ArrowRight, Target, CheckCircle2 } from 'lucide-react';
import { CompanyProfile, FreeSession } from '../types';


interface Step2WorkspaceProps {
  profile: Partial<CompanyProfile>;
  sessionData: Partial<FreeSession>;
  onNextStep: () => void;
}

export const Step2Workspace: React.FC<Step2WorkspaceProps> = ({
  profile,
  sessionData,
  onNextStep
}) => {

  return (
    <div className="flex flex-col h-full bg-navy-900">
      {/* Header */}
      <div className="h-20 border-b border-white/5 flex flex-col justify-center px-8 bg-navy-900 shrink-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-semibold text-white tracking-wide">
            Step 2 of 3 — Strategic Profile
          </span>
          <span className="text-xs text-slate-500">
            Quick Assessment
          </span>
        </div>
        <div className="w-full h-1 bg-navy-800 rounded-full overflow-hidden">
          <div className="h-full bg-purple-500 w-2/3 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">

        {/* Card: Strategic Goals */}
        <div className="bg-navy-950/50 border border-white/10 rounded-xl p-6 relative">
          <div className="absolute top-0 right-0 p-6 opacity-5">
            <Target size={64} className="text-white" />
          </div>

          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
            Strategic Goals
          </h3>

          <div className="space-y-4">
            {sessionData.strategicGoals && sessionData.strategicGoals.length > 0 ? (
              sessionData.strategicGoals.map(goal => (
                <div key={goal.id} className="p-4 bg-white/5 rounded-lg border border-white/5 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider
                         ${goal.priority === 'High' ? 'bg-red-500/20 text-red-300' :
                        goal.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-blue-500/20 text-blue-300'}`}>
                      {goal.priority} Priority
                    </span>
                    <span className="text-xs text-slate-500">{goal.horizon} Horizon</span>
                  </div>
                  <h4 className="text-white font-medium">{goal.title}</h4>
                  {goal.description && <p className="text-sm text-slate-400">{goal.description}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-slate-300">{goal.type}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 italic border border-dashed border-white/10 rounded-lg">
                No strategic goals defined yet. Chat with AI to define them.
              </div>
            )}
          </div>
        </div>

        {/* Card: Success Criteria */}
        <div className="bg-navy-950/50 border border-white/10 rounded-xl p-6 relative">
          <h3 className="text-lg font-semibold text-green-200 mb-4 flex items-center gap-2">
            <CheckCircle2 size={20} />
            Success Criteria
          </h3>
          <div className="p-4 bg-white/5 rounded-lg border border-white/5 min-h-[80px]">
            <p className="text-slate-300 italic">
              {sessionData.successCriteria || 'Not defined yet.'}
            </p>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="p-6 border-t border-white/5 bg-navy-900 flex justify-end">
        <button
          onClick={onNextStep}
          disabled={!sessionData.step2Completed}
          className={`flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-sm transition-all shadow-lg ${sessionData.step2Completed
            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30'
            : 'bg-navy-800 text-slate-500 cursor-not-allowed'
            }`}
        >
          Go to Expectations (Step 3)
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};