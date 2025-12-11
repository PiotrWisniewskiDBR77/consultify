import React from 'react';
import { Play, CheckCircle2, Circle, Target, Map, Flag, BarChart2 } from 'lucide-react';
import { FullSession } from '../../types';

interface DashboardOverviewProps {
    onStartModule1: () => void;
    session?: FullSession;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onStartModule1, session }) => {
    // Helper to determine step status
    const getStatus = (step: number) => {
        if (!session) return step === 1 ? 'pending' : 'locked';

        switch (step) {
            case 1: // Expectations & Challenges
                return session.step1Completed ? 'completed' : 'pending';
            case 2: // Assessment
                if (!session.step1Completed) return 'locked';
                return session.step2Completed ? 'completed' : 'pending';
            case 3: // Initiatives & Roadmap
                if (!session.step2Completed) return 'locked';
                return session.step3Completed ? 'completed' : 'pending';
            case 4: // Pilot Execution
                if (!session.step3Completed) return 'locked';
                return session.step5Completed ? 'completed' : 'pending';
            case 5: // Full Rollout
                if (!session.step5Completed) return 'locked';
                return 'pending';
            default: return 'locked';
        }
    };

    const currentStep = [1, 2, 3, 4, 5].find(s => getStatus(s) === 'pending') || 1;

    const steps = [
        { id: 1, label: 'Expectations & Challenges', icon: <Target className="w-5 h-5" />, description: 'Define goals and identify key pain points.' },
        { id: 2, label: 'Assessment', icon: <BarChart2 className="w-5 h-5" />, description: 'Analyze maturity across 7 key dimensions.' },
        { id: 3, label: 'Initiatives & Roadmap', icon: <Map className="w-5 h-5" />, description: 'Develop a strategic plan and prioritize initiatives.' },
        { id: 4, label: 'Pilot Execution', icon: <Flag className="w-5 h-5" />, description: 'Validate hypotheses with targeted pilot projects.' },
        { id: 5, label: 'Full Rollout', icon: <CheckCircle2 className="w-5 h-5" />, description: 'Scale solutions and measure economic impact.' },
    ];

    return (
        <div className="max-w-6xl mx-auto animate-fade-in relative z-10">
            {/* Header Section */}
            <div className="mb-10 text-center">
                <h1 className="text-3xl font-bold text-navy-900 dark:text-white tracking-tight mb-3">
                    Your Transformation Journey
                </h1>
                <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                    A structured 5-step process to achieve operational excellence.
                    Track your progress from assessment to full-scale rollout.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* Left Panel: Process Steps (Step 1-5) */}
                <div className="lg:col-span-8 space-y-4">
                    {steps.map((step) => {
                        const status = getStatus(step.id);
                        const isCurrent = status === 'pending' && (step.id === 1 || getStatus(step.id - 1) === 'completed');
                        const isCompleted = status === 'completed';
                        const isLocked = status === 'locked';

                        return (
                            <div
                                key={step.id}
                                className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${isCurrent
                                    ? 'bg-white dark:bg-navy-800 border-purple-500 shadow-lg shadow-purple-500/10 scale-[1.02] z-10'
                                    : isCompleted
                                        ? 'bg-slate-50 dark:bg-navy-900/50 border-green-200 dark:border-green-900/30 opacity-90'
                                        : 'bg-slate-50 dark:bg-navy-950 border-transparent opacity-50 grayscale'
                                    }`}
                            >
                                <div className="p-6 flex items-center gap-6">
                                    {/* Number / Status Icon */}
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${isCompleted
                                        ? 'bg-green-100 border-green-500 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                                        : isCurrent
                                            ? 'bg-purple-100 border-purple-500 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'
                                            : 'bg-slate-200 border-slate-300 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
                                        }`}>
                                        {isCompleted ? <CheckCircle2 size={24} /> : <span className="text-xl font-bold">{step.id}</span>}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className={`text-xl font-bold ${isCurrent ? 'text-navy-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                                                }`}>
                                                {step.label}
                                            </h3>
                                            {isCurrent && (
                                                <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-md">
                                                    In Progress
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-slate-500 dark:text-slate-400">
                                            {step.description}
                                        </p>
                                    </div>

                                    {/* Icon */}
                                    <div className={`hidden sm:flex items-center justify-center w-12 h-12 rounded-xl ${isCurrent ? 'bg-purple-50 text-purple-600 dark:bg-white/5 dark:text-purple-300' : 'bg-transparent text-slate-300 dark:text-slate-600'
                                        }`}>
                                        {React.cloneElement(step.icon as React.ReactElement<any>, { size: 24 })}
                                    </div>
                                </div>

                                {/* Progress Bar for Current Item (Optional visual flair) */}
                                {isCurrent && (
                                    <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500 w-1/3 rounded-r-full" />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Right Panel: Status & CTA */}
                <div className="lg:col-span-4 sticky top-6">
                    <div className="bg-white dark:bg-navy-800 rounded-2xl border border-slate-200 dark:border-white/10 p-8 shadow-xl relative overflow-hidden">
                        {/* Decorative background blob */}
                        <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

                        <div className="relative z-10 text-center">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                                Current Phase
                            </h2>

                            <div className="text-4xl font-black text-navy-900 dark:text-white mb-2">
                                Step {currentStep}
                            </div>
                            <div className="text-purple-600 dark:text-purple-400 font-medium mb-8">
                                {steps[currentStep - 1]?.label}
                            </div>

                            {/* CTA Button */}
                            {currentStep === 1 && !session?.step1Completed ? (
                                <button
                                    onClick={onStartModule1}
                                    className="w-full group relative flex items-center justify-center gap-3 bg-navy-900 dark:bg-white text-white dark:text-navy-900 px-6 py-4 rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300"
                                >
                                    <span>Start Assessment</span>
                                    <Play size={20} className="fill-current" />
                                </button>
                            ) : (
                                <div className="bg-slate-50 dark:bg-navy-900/50 rounded-xl p-4 text-sm text-slate-500 dark:text-slate-400">
                                    Continue your journey in the <strong>Cockpit</strong> tab.
                                </div>
                            )}

                            {/* Divider with small info */}
                            <div className="my-8 border-t border-slate-100 dark:border-white/5" />

                            <div className="text-left space-y-4">
                                <h3 className="text-sm font-bold text-navy-900 dark:text-white">Next Milestones</h3>
                                <ul className="space-y-3">
                                    {(steps.slice(currentStep - 1, currentStep + 2)).map((s, idx) => (
                                        <li key={s.id} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                            <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-purple-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                            <span className={idx === 0 ? 'font-medium text-purple-600 dark:text-purple-300' : ''}>
                                                {s.label}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
