import React from 'react';
import { FullSession, Language, AxisId } from '../types';
import { translations } from '../translations';
import {
  ArrowRight,
  CheckCircle2,
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
    { id: 'processes', label: ts.fullStep1_proc[language], icon: <Settings size={22} />, desc: t.descriptions.processes[language] },
    { id: 'digitalProducts', label: ts.fullStep1_prod[language], icon: <Smartphone size={22} />, desc: t.descriptions.digitalProducts[language] },
    { id: 'businessModels', label: ts.fullStep1_model[language], icon: <Briefcase size={22} />, desc: t.descriptions.businessModels[language] },
    { id: 'dataManagement', label: ts.fullStep1_data[language], icon: <Database size={22} />, desc: t.descriptions.dataManagement[language] },
    { id: 'culture', label: ts.fullStep1_cult[language], icon: <Users size={22} />, desc: t.descriptions.culture[language] },
    { id: 'cybersecurity', label: "Cybersecurity" /* Add translation later if needed */, icon: <Lock size={22} />, desc: "Security and Risk Management" },
    { id: 'aiMaturity', label: ts.fullStep1_ai[language], icon: <BrainCircuit size={22} />, desc: t.descriptions.aiMaturity[language] },
  ];

  // Helper to get granular score color
  const getScoreColor = (score: number) => {
    if (score < 3) return 'text-amber-500';
    if (score < 5) return 'text-blue-400';
    return 'text-emerald-400';
  };

  const completedCount = fullSession.assessment.completedAxes.length;
  const totalAxes = 7;
  const progressPercent = (completedCount / totalAxes) * 100;
  const allCompleted = completedCount === totalAxes;

  const chartData = axes.map(axis => ({
    label: axis.label,
    value: fullSession.assessment[axis.id].score || 0
  }));

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-slate-100 font-sans transition-colors duration-300">

      {/* Header Section */}
      <div className="h-24 px-8 border-b border-slate-200 dark:border-white/5 flex items-center justify-between shrink-0 bg-white dark:bg-navy-950 transition-colors duration-300">
        <div>
          <h1 className="text-2xl font-light tracking-wide text-navy-950 dark:text-white">
            Digital Maturity Assessment
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Evaluate your organization across 7 key dimensions of the Digital Roadmap Logic.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Overall Progress
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-navy-900 dark:text-white">{completedCount}/{totalAxes}</span>
            <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* content */}
      <div className="flex-1 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Visualizer Column */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/5 rounded-2xl p-6 relative overflow-hidden shadow-sm dark:shadow-none transition-colors duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-50"></div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 text-center">
                Maturity Profile
              </h3>
              <div className="flex justify-center -ml-4">
                <RadarChart data={chartData} size={300} />
              </div>
              <div className="mt-6 text-center">
                <p className="text-xs text-slate-500 leading-relaxed px-4">
                  This chart visualizes your current digital footprint. Complete all axes to generate a holistic transformation plan.
                </p>
              </div>
            </div>
          </div>

          {/* Grid Column */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {axes.map(axis => {
                const data = fullSession.assessment[axis.id];
                const isCompleted = fullSession.assessment.completedAxes.includes(axis.id);
                const inProgress = !isCompleted && data.answers.length > 0;

                return (
                  <button
                    key={axis.id}
                    onClick={() => !isCompleted && onStartAxis(axis.id)}
                    disabled={isCompleted}
                    className={`
                                        group relative overflow-hidden text-left p-6 rounded-xl border transition-all duration-300
                                        ${isCompleted
                        ? 'bg-slate-50 dark:bg-navy-900/50 border-slate-200 dark:border-white/5 opacity-60'
                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/5 hover:border-blue-500/50 hover:bg-slate-50 dark:hover:bg-navy-800 hover:shadow-lg'
                      }
                                    `}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={`
                                            p-3 rounded-lg transition-colors
                                            ${isCompleted ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 group-hover:text-blue-700 dark:group-hover:text-blue-300'}
                                        `}>
                        {axis.icon}
                      </div>
                      {isCompleted && (
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-500 text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-500/10 px-2 py-1 rounded-full">
                          <CheckCircle2 size={12} /> Done
                        </div>
                      )}
                    </div>

                    <h3 className="text-lg font-medium text-navy-900 dark:text-white mb-2 group-hover:text-blue-700 dark:group-hover:text-blue-100 transition-colors">
                      {axis.label}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                      {axis.desc}
                    </p>

                    {/* Footer of Card */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                      {isCompleted ? (
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase tracking-widest">Score</span>
                          <span className={`text-xl font-bold ${getScoreColor(data.score)}`}>
                            {data.score.toFixed(1)} <span className="text-sm text-slate-400 dark:text-slate-600 font-normal">/ 7.0</span>
                          </span>
                        </div>
                      ) : (
                        <>
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:underline decoration-blue-500/30 underline-offset-4">
                            {inProgress ? 'Continue Assessment' : 'Start Assessment'}
                          </span>
                          <ArrowRight size={16} className="text-blue-600 dark:text-blue-400 transform group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* CTA Section */}
            <div className="mt-8 flex justify-end">
              <button
                onClick={onNextStep}
                disabled={!allCompleted}
                className={`
                                flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-sm transition-all duration-300 shadow-xl
                                ${allCompleted
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20 dark:shadow-blue-900/20'
                    : 'bg-slate-100 dark:bg-navy-800/50 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-white/5'
                  }
                            `}
              >
                {allCompleted ? t.nextStep[language] : (
                  <>
                    <Lock size={16} /> Complete All Axes to Unlock Strategy
                  </>
                )}
                {allCompleted && <ArrowRight size={18} />}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
