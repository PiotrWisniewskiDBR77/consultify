import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api';
import { AppView } from '../types';
import { Loader2, CheckCircle, ArrowRight, Play, Briefcase, Zap, Target, Users, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

export const OnboardingWizard = () => {
    const { setCurrentView, currentUser } = useAppStore();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [loading, setLoading] = useState(false);

    // Idempotency key (generated once per session)
    const [acceptKey] = useState(() => `accept-${uuidv4()}`);

    // Check if user is a consultant (read-only mode)
    const isConsultant = currentUser?.role === 'CONSULTANT';

    // Step 1: Context
    const [context, setContext] = useState({
        role: currentUser?.role || '',
        industry: '',
        problems: '',
        urgency: 'Normal',
        targets: ''
    });

    // Step 3: Plan
    const [plan, setPlan] = useState<any>(null);
    const [selectedInitiativeIds, setSelectedInitiativeIds] = useState<string[]>([]);

    const handleGeneratePlan = async () => {
        if (!context.role || !context.problems) {
            toast.error("Please fill in the required fields");
            return;
        }

        setLoading(true);
        try {
            // Save context first
            await Api.saveOnboardingContext(context);

            // Advance to "Thinking" UI immediately while waiting
            setStep(2);

            // Generate Plan
            const response = await Api.generateFirstValuePlan();
            const generatedPlan = response.plan || response;
            setPlan(generatedPlan);

            // Auto-select all initiatives by ID
            if (generatedPlan.suggested_initiatives) {
                setSelectedInitiativeIds(generatedPlan.suggested_initiatives.map((i: any) => i.id));
            }

            setStep(3);
        } catch (error: any) {
            console.error(error);
            if (error.message?.includes('Rate limit')) {
                toast.error("Too many requests. Please wait before regenerating.");
            } else {
                toast.error("Failed to generate plan. Please try again.");
            }
            setStep(1); // Go back to edit
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptPlan = async () => {
        if (isConsultant) {
            toast.error("Consultants cannot accept plans. Contact an Admin.");
            return;
        }

        setLoading(true);
        try {
            await Api.acceptFirstValuePlan(selectedInitiativeIds, acceptKey);

            toast.success("Plan Accepted! Initiatives created.");

            // Redirect to User Dashboard
            setCurrentView(AppView.USER_DASHBOARD);
        } catch (error: any) {
            console.error(error);
            if (error.message?.includes('already accepted')) {
                toast.error("This plan has already been accepted.");
            } else {
                toast.error("Failed to accept plan");
            }
        } finally {
            setLoading(false);
        }
    };

    const toggleInitiative = (id: string) => {
        if (selectedInitiativeIds.includes(id)) {
            setSelectedInitiativeIds(selectedInitiativeIds.filter(i => i !== id));
        } else {
            setSelectedInitiativeIds([...selectedInitiativeIds, id]);
        }
    };

    // --- RENDER STEPS ---

    // STEP 1: CONTEXT INPUT
    if (step === 1) {
        return (
            <div className="max-w-3xl mx-auto p-8 pt-16">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-navy-900 dark:text-white mb-2">Let's fast-track your success.</h1>
                    <p className="text-slate-500 text-lg">Tell us a bit about your situation, and our AI will build a custom "First Value" plan for you.</p>
                </div>

                <div className="bg-white dark:bg-navy-800 rounded-xl shadow-lg border border-slate-200 dark:border-white/10 p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Your Role</label>
                            <div className="relative">
                                <Users className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    className="w-full pl-10 p-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                    placeholder="e.g. Program Manager, CTO"
                                    value={context.role}
                                    onChange={e => setContext({ ...context, role: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Industry</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    className="w-full pl-10 p-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                    placeholder="e.g. Fintech, Manufacturing"
                                    value={context.industry}
                                    onChange={e => setContext({ ...context, industry: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Biggest Challenge Right Now</label>
                            <div className="relative">
                                <Zap className="absolute left-3 top-3 text-slate-400" size={18} />
                                <textarea
                                    className="w-full pl-10 p-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                    placeholder="e.g. Deadlines are slipping, team communication is siloed..."
                                    rows={3}
                                    value={context.problems}
                                    onChange={e => setContext({ ...context, problems: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Urgency Level</label>
                            <select
                                className="w-full p-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                value={context.urgency}
                                onChange={e => setContext({ ...context, urgency: e.target.value })}
                            >
                                <option>Low</option>
                                <option>Normal</option>
                                <option>High</option>
                                <option>Critical</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Key Goal (The "Win")</label>
                            <div className="relative">
                                <Target className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    className="w-full pl-10 p-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                    placeholder="e.g. Launch in Q1, Reduce bugs by 50%"
                                    value={context.targets}
                                    onChange={e => setContext({ ...context, targets: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            onClick={handleGeneratePlan}
                            disabled={loading}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-purple-500/30 flex items-center gap-2 transition-all hover:scale-105 disabled:opacity-50 disabled:scale-100"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Play size={20} fill="currentColor" />}
                            Generate My Strategy
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // STEP 2: THINKING LOADER
    if (step === 2) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center p-8">
                <div className="relative w-24 h-24 mb-8">
                    <div className="absolute inset-0 border-4 border-slate-200 dark:border-white/10 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Zap className="text-purple-500" size={32} />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">Analyzing your context...</h2>
                <p className="text-slate-500 animate-pulse">Designing a high-imapct intervention plan for {context.role} in {context.industry}...</p>
            </div>
        );
    }

    // STEP 3: PLAN REVIEW
    if (step === 3 && plan) {
        return (
            <div className="max-w-5xl mx-auto p-4 md:p-8 pt-8">
                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
                        Recommended Strategy
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-navy-900 dark:text-white mb-4">{plan.plan_title}</h1>
                    <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">{plan.executive_summary}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Col: The Process Steps */}
                    <div className="lg:col-span-2 space-y-8">
                        <div>
                            <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">1</div>
                                Strategic Roadmap
                            </h3>
                            <div className="space-y-4">
                                {plan.steps?.map((step: any, idx: number) => (
                                    <div key={idx} className="bg-white dark:bg-navy-800 p-5 rounded-xl border border-slate-200 dark:border-white/10 relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 dark:bg-white/10 group-hover:bg-blue-500 transition-colors"></div>
                                        <div className="pl-4">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="font-bold text-lg text-navy-900 dark:text-white">{step.title}</h4>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded">
                                                    {step.action_type}
                                                </span>
                                            </div>
                                            <p className="text-slate-600 dark:text-slate-300 mb-2">{step.description}</p>
                                            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                                                <Zap size={14} />
                                                Value Add: {step.value_add}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Col: Actionable Initiatives */}
                    <div className="space-y-6">
                        <div className="bg-purple-50 dark:bg-purple-900/10 rounded-2xl p-6 border border-purple-100 dark:border-purple-500/20">
                            <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-bold">2</div>
                                Suggested Initiatives
                            </h3>
                            <p className="text-sm text-slate-500 mb-4">Select the initiatives you want to launch immediately in the platform.</p>

                            <div className="space-y-3">
                                {plan.suggested_initiatives?.map((init: any) => (
                                    <div
                                        key={init.id}
                                        onClick={() => toggleInitiative(init.id)}
                                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${selectedInitiativeIds.includes(init.id)
                                            ? 'bg-white dark:bg-navy-800 border-purple-500 shadow-md'
                                            : 'bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${selectedInitiativeIds.includes(init.id) ? 'bg-purple-500 border-purple-500' : 'border-slate-300'
                                                }`}>
                                                {selectedInitiativeIds.includes(init.id) && <CheckCircle size={12} className="text-white" />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-navy-900 dark:text-white text-sm">{init.title}</h4>
                                                <p className="text-xs text-slate-500 line-clamp-2 mt-1">{init.summary}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 pt-6 border-t border-purple-200 dark:border-purple-500/20">
                                <button
                                    onClick={handleAcceptPlan}
                                    disabled={loading || selectedInitiativeIds.length === 0 || isConsultant}
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                                    {isConsultant ? 'Read-Only Mode' : 'Accept & Start Execution'}
                                </button>
                                <p className="text-center text-xs text-slate-400 mt-3">
                                    {isConsultant ? 'Viewing as Consultant — cannot create initiatives.' : `Adds ${selectedInitiativeIds.length} initiatives to your workspace.`}
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        );
    }

    return null;
};
