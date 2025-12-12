import React, { useState } from 'react';
import { DRDAxis, MaturityLevel, AxisAssessment, Language } from '../../types';
import { ArrowRight, Info, CheckCircle2, AlertTriangle, BrainCircuit, TrendingUp, Lightbulb } from 'lucide-react';

interface AssessmentAxisWorkspaceProps {
    axis: DRDAxis;
    data: Partial<AxisAssessment>;
    onChange: (data: Partial<AxisAssessment>) => void;
    onNext: () => void;
    language: Language;
    context: {
        goals: string[];
        challenges: string[];
        industry: string;
    };
}

// Placeholder content - In real app, this should come from detailed content library or AI
const AXIS_CONTENT: Record<DRDAxis, { title: Record<Language, string>; levels: string[] }> = {
    processes: {
        title: { EN: 'Digital Processes', PL: 'Cyfryzacja Procesów', DE: 'Digitale Prozesse', AR: 'Digital Processes' },
        levels: [
            'Analog / Manual',
            'Digital Islands (Isolated Systems)',
            'Connected (Integrated Systems)',
            'Real-time Visibility',
            'Predictive / Optimized',
            'Autonomous',
            'Symbiotic (Ecosystem)'
        ]
    },
    digitalProducts: {
        title: { EN: 'Digital Products', PL: 'Produkty Cyfrowe', DE: 'Digitale Produkte', AR: 'Digital Products' },
        levels: [
            'Physical Only', 'Digital Extension', 'Connected Product', 'Smart Product', 'Product as a Service', 'Platform', 'Ecosystem'
        ]
    },
    businessModels: {
        title: { EN: 'Business Models', PL: 'Modele Biznesowe', DE: 'Geschäftsmodelle', AR: 'Business Models' },
        levels: [
            'Traditional Sales', 'E-commerce', 'Service-based', 'Subscription', 'Usage-based', 'Outcome-based', 'Ecosystem orchestrator'
        ]
    },
    dataManagement: {
        title: { EN: 'Data Management', PL: 'Zarządzanie Danymi', DE: 'Datenmanagement', AR: 'Data Management' },
        levels: [
            'No Data', 'Descriptive (What happened)', 'Diagnostic (Why)', 'Predictive (What will happen)', 'Prescriptive (What to do)', 'Cognitive (AI)', 'Generative'
        ]
    },
    culture: {
        title: { EN: 'Culture', PL: 'Kultura', DE: 'Kultur', AR: 'Culture' },
        levels: [
            'Resistant', 'Aware', 'Curious', 'Agile', 'Data-driven', 'Innovator', 'Digital Native'
        ]
    },
    cybersecurity: {
        title: { EN: "Cybersecurity", PL: "Cyberbezpieczeństwo", DE: "Cybersicherheit", AR: "الأمن السيبراني" },
        levels: [
            'None', 'Basic (Firewall)', 'Compliance-based', 'Proactive', 'Resilient', 'Zero Trust', 'Immune'
        ]
    },
    aiMaturity: {
        title: { EN: 'AI Maturity', PL: 'Dojrzałość AI', DE: 'KI-Reife', AR: 'AI Maturity' },
        levels: [
            'None', 'Experiments', 'Point Solutions', 'Integrated AI', 'AI-First Strategy', 'Autonomous Agents', 'Superintelligence'
        ]
    }
};

export const AssessmentAxisWorkspace: React.FC<AssessmentAxisWorkspaceProps> = ({
    axis,
    data,
    onChange,
    onNext,
    language,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context
}) => {
    const content = AXIS_CONTENT[axis];
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiFeedback, setAiFeedback] = useState<{ status: 'ok' | 'warning'; message: string } | null>(null);

    const handleLevelSelect = (type: 'actual' | 'target', level: MaturityLevel) => {
        onChange({ ...data, [type]: level });
        setAiFeedback(null); // Reset feedback on change
    };

    const runSenseCheck = () => {
        setIsAnalyzing(true);
        // Mock AI Logic Check
        setTimeout(() => {
            const actual = data.actual || 0;
            const target = data.target || 0;
            const gap = target - actual;

            if (gap > 2) {
                setAiFeedback({
                    status: 'warning',
                    message: "Senior Consultant Alert: Jumping more than 2 levels in one cycle creates high failure risk (70%+). I recommend targeting Level " + (actual + 2) + " first."
                });
            } else if (gap <= 0) {
                setAiFeedback({
                    status: 'warning',
                    message: "Logic Check: Target level must be higher than Actual level to drive transformation value."
                });
            } else {
                setAiFeedback({
                    status: 'ok',
                    message: "Logic Verified: This trajectory is ambitious yet achievable given your resource profile."
                });
            }
            setIsAnalyzing(false);
        }, 1500);
    };

    return (
        <div className="flex flex-col h-full bg-navy-900 text-white">
            {/* Header */}
            <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-navy-900 shrink-0">
                <div>
                    <div className="text-xs text-purple-400 font-bold uppercase tracking-wider mb-1">DRD Assessment</div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        {content.title[language]}
                        <Info size={16} className="text-slate-500 cursor-pointer hover:text-white transition-colors" />
                    </h2>
                </div>
                <div className="flex items-center gap-4">
                    {/* Sense Check Button */}
                    <button
                        onClick={runSenseCheck}
                        disabled={!data.actual || !data.target || isAnalyzing}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${aiFeedback?.status === 'ok' ? 'bg-green-500/10 border-green-500/50 text-green-400' :
                            aiFeedback?.status === 'warning' ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400' :
                                'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                            }`}
                    >
                        {isAnalyzing ? <BrainCircuit size={14} className="animate-pulse" /> : <BrainCircuit size={14} />}
                        {isAnalyzing ? 'Analyzing...' : aiFeedback ? (aiFeedback.status === 'ok' ? 'Logic Verified' : 'Logic Warning') : 'AI Sense Check'}
                    </button>

                    <div className="flex gap-2 border-l border-white/10 pl-4">
                        <div className={`px-3 py-1 rounded text-xs font-bold ${data.actual ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-500'}`}>
                            Actual: {data.actual || '-'}
                        </div>
                        <div className={`px-3 py-1 rounded text-xs font-bold ${data.target ? 'bg-purple-500 text-white' : 'bg-white/10 text-slate-500'}`}>
                            Target: {data.target || '-'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8">

                {/* AI Feedback Banner */}
                {aiFeedback && (
                    <div className={`mb-8 p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${aiFeedback.status === 'ok' ? 'bg-green-500/10 border-green-500/20' : 'bg-yellow-500/10 border-yellow-500/20'
                        }`}>
                        {aiFeedback.status === 'ok' ? <CheckCircle2 className="text-green-500 mt-0.5" size={18} /> : <AlertTriangle className="text-yellow-500 mt-0.5" size={18} />}
                        <div>
                            <h4 className={`text-sm font-bold mb-1 ${aiFeedback.status === 'ok' ? 'text-green-400' : 'text-yellow-400'}`}>
                                {aiFeedback.status === 'ok' ? 'Assessment Validated' : 'Consultant Warning'}
                            </h4>
                            <p className="text-xs text-slate-300 leading-relaxed">{aiFeedback.message}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* LEFT: Levels Description */}
                    <div className="bg-navy-950/50 border border-white/10 rounded-xl p-6">
                        <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wide">Maturity Levels</h3>
                        <div className="space-y-4 relative">
                            {/* Vertical Line */}
                            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-white/10"></div>
                            {content.levels.map((lvl, idx) => {
                                const levelNum = idx + 1 as MaturityLevel;
                                const isActual = data.actual === levelNum;
                                const isTarget = data.target === levelNum;
                                return (
                                    <div
                                        key={idx}
                                        className={`relative pl-8 py-2 transition-all cursor-pointer group ${isActual || isTarget ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
                                        onClick={() => !data.actual ? handleLevelSelect('actual', levelNum) : handleLevelSelect('target', levelNum)}
                                    >
                                        <div className={`absolute left-0 top-3 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-navy-900 z-10 transition-colors
                                            ${isActual ? 'border-blue-500 text-blue-500' : isTarget ? 'border-purple-500 text-purple-500' : 'border-white/20 text-slate-500 group-hover:border-white/40'}
                                        `}>
                                            <span className="text-xs font-bold">{levelNum}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className={`text-sm font-medium ${isActual || isTarget ? 'text-white' : 'text-slate-400'}`}>{lvl}</span>
                                            {isActual && <span className="text-[10px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded">ACTUAL</span>}
                                            {isTarget && <span className="text-[10px] font-bold bg-purple-500 text-white px-2 py-0.5 rounded">TARGET</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* RIGHT: Pathway & Justification */}
                    <div className="space-y-6">

                        {/* Transformation Pathway (PRO FEATURE) */}
                        <div className="bg-navy-950/50 border border-white/10 rounded-xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <TrendingUp size={100} />
                            </div>
                            <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wide flex items-center gap-2">
                                <TrendingUp size={16} className="text-purple-500" />
                                Transformation Pathway
                            </h3>

                            {data.actual && data.target && data.target > data.actual ? (
                                <div className="space-y-4">
                                    <p className="text-xs text-slate-400 mb-2">
                                        To move from <span className="text-blue-400 font-bold">Level {data.actual}</span> to <span className="text-purple-400 font-bold">Level {data.target}</span>, the following key shifts are required:
                                    </p>
                                    <div className="space-y-3">
                                        {Array.from({ length: (data.target - data.actual) }).map((_, i) => (
                                            <div key={i} className="flex gap-3 items-start p-2 rounded hover:bg-white/5 transition-colors">
                                                <div className="mt-1 w-5 h-5 rounded-full border border-purple-500/30 flex items-center justify-center text-[10px] text-purple-400 font-mono">
                                                    {i + 1}
                                                </div>
                                                <div>
                                                    <h5 className="text-sm font-semibold text-white">Transition Phase {i + 1}</h5>
                                                    <p className="text-xs text-slate-500">
                                                        implied step from {content.levels[(data.actual || 0) + i - 1]} to {content.levels[(data.actual || 0) + i]}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-32 flex items-center justify-center text-slate-600 text-sm italic">
                                    Select Actual and Target levels to visualize the pathway.
                                </div>
                            )}
                        </div>

                        {/* Justification Input */}
                        <div className="bg-navy-950/50 border border-white/10 rounded-xl p-6">
                            <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wide flex items-center gap-2">
                                <Lightbulb size={16} className="text-yellow-500" />
                                Strategic Rationale
                            </h3>
                            <textarea
                                value={data.justification || ''}
                                onChange={(e) => onChange({ ...data, justification: e.target.value })}
                                placeholder={language === 'PL' ? "Dlaczego taki poziom? Podaj przykłady..." : "Why is this target critical for your business strategy?"}
                                className="w-full h-24 bg-navy-900 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 transition-all"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-navy-900 flex justify-between items-center">
                <div className="text-xs text-slate-500">
                    PRO Mode Active: Logic Validation Enabled
                </div>
                <button
                    onClick={onNext}
                    disabled={!data.actual || !data.target}
                    className={`flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-sm transition-all shadow-lg ${data.actual && data.target
                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30'
                        : 'bg-navy-800 text-slate-500 cursor-not-allowed'
                        }`}
                >
                    Confirm & Next
                    <ArrowRight size={18} />
                </button>
            </div>
        </div>
    );
};
