import React from 'react';
import { DRDAxis, AxisAssessment, Language } from '../../types';
import { ArrowRight, BarChart2, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { translations } from '../../translations';

interface AssessmentSummaryWorkspaceProps {
    assessment: Partial<Record<DRDAxis, AxisAssessment>>;
    onGenerateInitiatives: () => void;
    language: Language;
}

export const AssessmentSummaryWorkspace: React.FC<AssessmentSummaryWorkspaceProps> = ({
    assessment,
    onGenerateInitiatives,
    language
}) => {
    const t = translations;

    const labels: Record<DRDAxis, string> = {
        processes: t.sidebar.fullStep1_proc[language],
        digitalProducts: t.sidebar.fullStep1_prod[language],
        businessModels: t.sidebar.fullStep1_model[language],
        dataManagement: t.sidebar.fullStep1_data[language],
        culture: t.sidebar.fullStep1_cult[language],
        cybersecurity: "Cybersecurity",
        aiMaturity: t.sidebar.fullStep1_ai[language],
    };

    const axes: DRDAxis[] = ['processes', 'digitalProducts', 'businessModels', 'dataManagement', 'culture', 'cybersecurity', 'aiMaturity'];

    // Calculate generic stats
    const totalGap = axes.reduce((acc, axis) => {
        const data = assessment[axis];
        if (data && data.actual && data.target) {
            return acc + Math.max(0, data.target - data.actual);
        }
        return acc;
    }, 0);

    const avgMaturity = (axes.reduce((acc, axis) => acc + (assessment[axis]?.actual || 0), 0) / 7).toFixed(1);

    return (
        <div className="flex flex-col h-full bg-navy-900 text-white p-8">

            {/* Header */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
                        <TrendingUp className="text-purple-500" />
                        {language === 'PL' ? 'Mapa Luk (Gap Analysis)' : 'Gap Map Analysis'}
                    </h2>
                    <p className="text-slate-400 text-sm">
                        {language === 'PL'
                            ? 'Podsumowanie dojrzałości cyfrowej. Te luki będą podstawą do generowania inicjatyw.'
                            : 'Summary of digital maturity. These gaps will directly drive initiative generation.'}
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-navy-950/50 p-3 rounded-xl border border-white/5 text-center min-w-[100px]">
                        <div className="text-2xl font-bold text-blue-400">{avgMaturity}</div>
                        <div className="text-[10px] uppercase text-slate-500 font-bold">Avg Actual</div>
                    </div>
                    <div className="bg-navy-950/50 p-3 rounded-xl border border-white/5 text-center min-w-[100px]">
                        <div className="text-2xl font-bold text-red-400">{totalGap}</div>
                        <div className="text-[10px] uppercase text-slate-500 font-bold">Total Gap Points</div>
                    </div>
                </div>
            </div>

            {/* Main Chart / Table */}
            <div className="bg-navy-950/50 border border-white/10 rounded-xl p-6 mb-6">
                <div className="grid grid-cols-7 gap-4 mb-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center border-b border-white/5 pb-2">
                    {axes.map(axis => <div key={axis}>{labels[axis]}</div>)}
                </div>

                {/* Visual Bars */}
                <div className="grid grid-cols-7 gap-4 h-64 items-end pb-4 border-b border-white/5">
                    {axes.map(axis => {
                        const data = assessment[axis];
                        const actual = data?.actual || 0;
                        const target = data?.target || 0;
                        const gap = Math.max(0, target - actual);

                        return (
                            <div key={axis} className="flex flex-col items-center justify-end h-full gap-1 group relative">
                                {/* Tooltip */}
                                <div className="absolute -top-12 opacity-0 group-hover:opacity-100 bg-white text-navy-900 text-xs p-2 rounded shadow-lg transition-opacity z-10 pointer-events-none whitespace-nowrap">
                                    Actual: {actual} → Target: {target}
                                </div>

                                {/* Gap Bar (Top) */}
                                {gap > 0 && (
                                    <div
                                        style={{ height: `${gap * 10}%` }}
                                        className="w-full bg-white/5 border border-dashed border-white/20 rounded-t relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-red-500/10"></div>
                                    </div>
                                )}

                                {/* Actual Bar (Bottom) */}
                                <div
                                    style={{ height: `${actual * 10}%` }}
                                    className={`w-full rounded-b transition-all ${!data ? 'bg-slate-800' : 'bg-gradient-to-t from-blue-900 to-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]'
                                        }`}
                                ></div>

                                <div className="mt-2 text-xs font-mono text-slate-400">
                                    {actual} <span className="text-slate-600">/</span> <span className="text-purple-400 font-bold">{target}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* AI Summary */}
            <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-6 flex gap-4 items-start mb-6">
                <div className="mt-1 text-purple-400 shrink-0">
                    <BarChart2 size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-purple-200 mb-2">AI Assessment Summary</h3>
                    <div className="text-sm text-slate-300 space-y-2">
                        <p>
                            Based on your assessment, the biggest transformation gap is in <strong>Data & Analytics ({(assessment.dataManagement?.target || 0) - (assessment.dataManagement?.actual || 0)} levels)</strong>.
                            Since <strong>Cybersecurity</strong> is also lagging, I recommend treating Data Foundation and Security as a prerequisite before scaling AI initiatives.
                        </p>
                        <p className="text-slate-400 italic">
                            "Ambition in Business Models (Level {assessment.businessModels?.target}) is high compared to current operational maturity. Consider bridging Process gaps first."
                        </p>
                    </div>
                </div>
            </div>

            {/* CTA */}
            <div className="flex justify-end p-4 border-t border-white/5">
                <button
                    onClick={onGenerateInitiatives}
                    className="flex items-center gap-3 px-8 py-5 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-xl font-bold shadow-lg shadow-green-900/40 transform hover:scale-[1.02] transition-all"
                >
                    <div>
                        <div className="text-xs font-normal opacity-80 uppercase tracking-wide">Next Step</div>
                        <div className="text-lg">Generate AI Initiatives</div>
                    </div>
                    <ArrowRight size={24} />
                </button>
            </div>

        </div>
    );
};
