import React from 'react';
import { Play, CheckCircle2, Circle, Bot, Info, ChevronRight, Map, Flag, Target } from 'lucide-react';
import { AppView, FullSession } from '../../types';

interface OnboardingDashboardProps {
    onStartModule1: () => void;
    session?: FullSession;
}

export const OnboardingDashboard: React.FC<OnboardingDashboardProps> = ({ onStartModule1, session }) => {
    // Determine status of each step based on session data
    const getStatus = (step: number) => {
        if (!session) return step === 1 ? 'pending' : 'locked';

        switch (step) {
            case 1: // Expectations
                return session.step1Completed ? 'completed' : 'pending';
            case 2: // Assessment
                if (!session.step1Completed) return 'locked';
                return session.step2Completed ? 'completed' : 'pending';
            case 3: // Initiatives
                if (!session.step2Completed) return 'locked';
                return session.step3Completed ? 'completed' : 'pending';
            case 4: // Pilot
                if (!session.step3Completed) return 'locked';
                return session.step5Completed ? 'completed' : 'pending';
            case 5: // Rollout
                if (!session.step5Completed) return 'locked';
                return 'pending'; // Rollout effectively never 'ends' until project close
            default: return 'locked';
        }
    };

    const currentStep = [1, 2, 3, 4, 5].find(s => getStatus(s) === 'pending') || 1;

    const steps = [
        { id: 1, label: 'Expectations & Challenges', icon: <Target size={18} /> },
        { id: 2, label: 'Assessment', icon: <Bot size={18} /> },
        { id: 3, label: 'Initiatives & Roadmap', icon: <Map size={18} /> },
        { id: 4, label: 'Pilot Execution', icon: <Flag size={18} /> },
        { id: 5, label: 'Full Rollout (+ Economics & Reports)', icon: <CheckCircle2 size={18} /> },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
            {/* Minimalist Overview Header */}
            <div className="text-center mb-6">
                <h1 className="text-3xl font-bold text-navy-900 dark:text-white mb-2">Digital Transformation Journey</h1>
                <p className="text-slate-500 dark:text-slate-400">Step-by-step roadmap to operational excellence.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: The Process (1-5) */}
                <div className="lg:col-span-2 bg-white dark:bg-navy-900 rounded-xl p-5 border border-slate-200 dark:border-white/10 shadow-sm">
                    <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-6 flex items-center gap-2">
                        <Map size={20} className="text-purple-500" />
                        Process Overview
                    </h3>

                    <div className="space-y-4">
                        {steps.map((step) => {
                            const status = getStatus(step.id);
                            const isCurrent = status === 'pending' && (!session || getStatus(step.id - 1) === 'completed' || step.id === 1);

                            return (
                                <div key={step.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${isCurrent
                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md ring-1 ring-purple-500/20'
                                    : status === 'completed'
                                        ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10'
                                        : 'border-slate-100 bg-slate-50 dark:bg-navy-950 dark:border-white/5 opacity-60'
                                    }`}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${status === 'completed'
                                        ? 'bg-green-500 text-white'
                                        : isCurrent
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-slate-200 text-slate-400 dark:bg-slate-800'
                                        }`}>
                                        {status === 'completed' ? <CheckCircle2 size={20} /> : <span className="font-bold">{step.id}</span>}
                                    </div>

                                    <div className="flex-1">
                                        <h4 className={`font-semibold text-lg ${isCurrent ? 'text-purple-900 dark:text-purple-100' : 'text-slate-700 dark:text-slate-300'
                                            }`}>
                                            {step.label}
                                        </h4>
                                        {isCurrent && (
                                            <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                                                Current Phase • In Progress
                                            </p>
                                        )}
                                        {status === 'completed' && (
                                            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                                                Completed
                                            </p>
                                        )}
                                    </div>

                                    {isCurrent && (
                                        <div className="bg-purple-100 dark:bg-purple-500/30 text-purple-700 dark:text-purple-200 p-2 rounded-lg">
                                            {step.icon}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Action Panel */}
                <div className="space-y-6">
                    {/* Status Card */}
                    <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600 mb-4">
                            <Info size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-2">Current Status</h3>
                        <div className="text-purple-600 dark:text-purple-400 font-medium bg-purple-50 dark:bg-purple-900/20 py-2 px-4 rounded-full inline-block mb-6">
                            Step {currentStep} in progress
                        </div>

                        {(currentStep === 1 || !session?.step1Completed) && (
                            <button
                                onClick={onStartModule1}
                                className="w-full group flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-purple-500/30 transition-all transform hover:-translate-y-0.5"
                            >
                                <Play size={20} className="fill-current" />
                                Start with Expectations & Challenges
                            </button>
                        )}
                        {/* Fallback CTA if step 1 done but sticking around in Overview */}
                        {session?.step1Completed && currentStep > 1 && (
                            <div className="text-sm text-slate-500">
                                Please proceed to the active module via the sidebar or Cockpit tab.
                            </div>
                        )}
                    </div>

                    {/* Quick Tip */}
                    <div className="bg-blue-50 dark:bg-navy-800/50 rounded-2xl p-6 border border-blue-100 dark:border-white/5">
                        <h4 className="font-bold text-navy-900 dark:text-white mb-2 flex items-center gap-2">
                            <Bot size={16} className="text-blue-500" />
                            AI Assistant
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            "I am monitoring your progress. Once you complete the Expectations phase, I will prepare a tailored assessment structure for you."
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
