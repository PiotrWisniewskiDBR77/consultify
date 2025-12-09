
import React from 'react';
import { FullSession, Language, AxisId } from '../types';
import { translations } from '../translations';
import {
  ArrowRight,
  CheckCircle2,
  PlayCircle,
  BarChart3,
  Lock,
  Database,
  Users,
  Settings,
  Smartphone,
  Briefcase,
  BrainCircuit,
  Info
} from 'lucide-react';
import { RadarChart } from './RadarChart';
// Card import removed

interface FullStep1WorkspaceProps {
  fullSession: FullSession;
  currentAxisId?: AxisId;
  onStartAxis: (axisId: AxisId) => void;
  onNextStep: () => void;
  language: Language;
}

export const FullStep1Workspace: React.FC<FullStep1WorkspaceProps> = ({
  fullSession,
  currentAxisId,
  onStartAxis,
  onNextStep,
  language
}) => {
  const t = translations.fullAssessment;
  const ts = translations.sidebar;

  const axes: { id: AxisId; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'processes', label: ts.fullStep1_proc[language], icon: <Settings size={20} />, desc: t.descriptions.processes[language] },
    { id: 'digitalProducts', label: ts.fullStep1_prod[language], icon: <Smartphone size={20} />, desc: t.descriptions.digitalProducts[language] },
    { id: 'businessModels', label: ts.fullStep1_model[language], icon: <Briefcase size={20} />, desc: t.descriptions.businessModels[language] },
    { id: 'dataManagement', label: ts.fullStep1_data[language], icon: <Database size={20} />, desc: t.descriptions.dataManagement[language] },
    { id: 'culture', label: ts.fullStep1_cult[language], icon: <Users size={20} />, desc: t.descriptions.culture[language] },
    { id: 'aiMaturity', label: ts.fullStep1_ai[language], icon: <BrainCircuit size={20} />, desc: t.descriptions.aiMaturity[language] },
  ];

  const getScoreColor = (score: number) => {
    if (score < 3) return 'text-red-400';
    if (score < 5) return 'text-yellow-400';
    return 'text-green-400';
  };

  const allCompleted = axes.every(a => fullSession.assessment.completedAxes.includes(a.id));

  // Prepare data for Radar Chart
  const chartData = axes.map(axis => ({
    label: axis.label,
    value: fullSession.assessment[axis.id].score || 0
  }));

  return (
    <div className="flex flex-col h-full bg-navy-900">
      {/* Header */}
      <div className="h-20 border-b border-white/5 flex flex-col justify-center px-8 bg-navy-900 shrink-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-semibold text-white tracking-wide">{t.maturityOverview[language]}</span>
          <span className="text-xs text-slate-500">DRD 6-AXES</span>
        </div>
        <div className="w-full h-1 bg-navy-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${(fullSession.assessment.completedAxes.length / 6) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8">

        {/* Intro Microcopy */}
        <div className="flex items-start gap-3 p-4 bg-blue-900/10 border border-blue-500/20 rounded-lg text-xs text-blue-200">
          <Info size={16} className="mt-0.5 shrink-0" />
          <p>{t.introMicrocopy[language]}</p>
        </div>

        {/* Radar Chart Section */}
        <div className="flex justify-center py-6 bg-navy-950/30 rounded-xl border border-white/5">
          <RadarChart data={chartData} size={280} />
        </div>

        {/* Axis Grid */}
        <div className="grid grid-cols-2 gap-4">
          {axes.map((axis) => {
            const data = fullSession.assessment[axis.id];
            const isCompleted = fullSession.assessment.completedAxes.includes(axis.id);
            const inProgress = !isCompleted && data.answers.length > 0;
            const isActive = currentAxisId === axis.id;

            return (
              <div
                key={axis.id}
                onClick={() => !isCompleted && onStartAxis(axis.id)}
                className={`
                  relative border rounded-xl p-5 transition-all flex flex-col h-36 justify-between group
                  ${isActive
                    ? 'bg-blue-900/20 border-blue-500/50 shadow-glow'
                    : isCompleted
                      ? 'bg-navy-950/50 border-white/10 opacity-70 hover:opacity-100'
                      : 'bg-navy-950/50 border-white/5 hover:border-blue-500/30 hover:bg-navy-900 cursor-pointer'
                  }
                `}
              >
                <div className="flex justify-between items-start">
                  <div className={`p-2 rounded-lg ${isActive || inProgress ? 'bg-blue-500/20 text-blue-400' : isCompleted ? 'bg-green-500/10 text-green-500' : 'bg-navy-800 text-slate-500'}`}>
                    {axis.icon}
                  </div>
                  {isCompleted ? (
                    <CheckCircle2 size={18} className="text-green-500" />
                  ) : (
                    <div className={`w-2 h-2 rounded-full ${inProgress ? 'bg-yellow-500 animate-pulse' : 'bg-navy-800'}`}></div>
                  )}
                </div>

                <div>
                  <h4 className={`text-xs font-bold uppercase tracking-wider mb-1 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'}`}>
                    {axis.label}
                  </h4>
                  <p className="text-[10px] text-slate-500 mb-2 truncate">{axis.desc}</p>

                  {isCompleted ? (
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xl font-bold ${getScoreColor(data.score)}`}>{data.score.toFixed(1)}</span>
                      <span className="text-xs text-slate-600 font-medium">/ 7.0</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-slate-500 group-hover:text-blue-400 transition-colors font-medium">
                      {isActive ? t.currentAxis[language] : inProgress ? t.continue[language] : t.startAxis[language]}
                      {!isActive && <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Footer / CTA */}
      <div className="p-6 border-t border-white/5 bg-navy-900 flex justify-end">
        <button
          onClick={onNextStep}
          disabled={!allCompleted}
          className={`flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-sm transition-all shadow-lg ${allCompleted
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30'
              : 'bg-navy-800 text-slate-500 cursor-not-allowed'
            }`}
        >
          {allCompleted ? t.nextStep[language] : (
            <>
              <Lock size={16} />
              Complete all axes to proceed
            </>
          )}
          {allCompleted && <ArrowRight size={18} className={language === 'AR' ? 'rotate-180' : ''} />}
        </button>
      </div>
    </div>
  );
};
