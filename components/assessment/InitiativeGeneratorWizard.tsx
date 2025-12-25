/**
 * InitiativeGeneratorWizard
 * 
 * Multi-step wizard for generating initiatives from assessment gaps.
 * Steps:
 * 1. Gap Selection - Select which gaps to address
 * 2. AI Constraints - Set budget, timeline, risk appetite
 * 3. Review & Edit - Review generated initiatives
 * 4. Approve & Transfer - Send to Module 3
 */

import React, { useState, useMemo } from 'react';
import {
    ArrowRight,
    ArrowLeft,
    Check,
    Sparkles,
    Target,
    DollarSign,
    Clock,
    Users,
    Shield,
    Loader2,
    AlertCircle,
    Plus,
    CheckCircle2,
    Send
} from 'lucide-react';
import { useInitiativeGenerator } from '../../hooks/useInitiativeGenerator';
import { GeneratedInitiativeCard } from './GeneratedInitiativeCard';
import { InitiativeEditor } from './InitiativeEditor';
import { 
    GapForGeneration, 
    GeneratedInitiative, 
    InitiativeGeneratorConstraints,
    DRDAxis,
    AppView 
} from '../../types';

type WizardStep = 'gaps' | 'constraints' | 'review' | 'approve';

interface InitiativeGeneratorWizardProps {
    assessmentId: string;
    projectId: string;
    onComplete: (transferredIds: string[]) => void;
    onCancel: () => void;
}

const STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
    { id: 'gaps', label: 'Select Gaps', icon: <Target size={18} /> },
    { id: 'constraints', label: 'Set Constraints', icon: <Shield size={18} /> },
    { id: 'review', label: 'Review', icon: <Sparkles size={18} /> },
    { id: 'approve', label: 'Approve', icon: <Send size={18} /> }
];

export const InitiativeGeneratorWizard: React.FC<InitiativeGeneratorWizardProps> = ({
    assessmentId,
    projectId,
    onComplete,
    onCancel
}) => {
    // State
    const [currentStep, setCurrentStep] = useState<WizardStep>('gaps');
    const [constraints, setConstraints] = useState<InitiativeGeneratorConstraints>({
        maxBudget: undefined,
        maxTimeline: '6 months',
        teamSize: '5-10',
        riskAppetite: 'moderate',
        focusAreas: []
    });
    const [editingInitiative, setEditingInitiative] = useState<GeneratedInitiative | null>(null);
    const [transferResult, setTransferResult] = useState<{ transferred: string[]; failed: string[] } | null>(null);

    // Hook
    const {
        gaps,
        generatedInitiatives,
        isLoading,
        isGenerating,
        isSaving,
        error,
        selectGap,
        selectAllGaps,
        generateWithAI,
        editInitiative,
        removeInitiative,
        addCustomInitiative,
        saveDraft,
        approveAndTransfer
    } = useInitiativeGenerator(assessmentId);

    // Derived state
    const selectedGapsCount = useMemo(() => gaps.filter(g => g.selected).length, [gaps]);
    const stepIndex = STEPS.findIndex(s => s.id === currentStep);

    // Calculate totals for selected initiatives
    const totals = useMemo(() => {
        return generatedInitiatives.reduce((acc, init) => ({
            budget: acc.budget + init.estimatedBudget,
            roi: acc.roi + init.estimatedROI
        }), { budget: 0, roi: 0 });
    }, [generatedInitiatives]);

    // Handlers
    const handleNext = async () => {
        if (currentStep === 'gaps') {
            setCurrentStep('constraints');
        } else if (currentStep === 'constraints') {
            await generateWithAI(constraints);
            setCurrentStep('review');
        } else if (currentStep === 'review') {
            setCurrentStep('approve');
        }
    };

    const handleBack = () => {
        const stepIndex = STEPS.findIndex(s => s.id === currentStep);
        if (stepIndex > 0) {
            setCurrentStep(STEPS[stepIndex - 1].id);
        }
    };

    const handleApprove = async () => {
        const result = await approveAndTransfer(projectId);
        setTransferResult(result);
        
        if (result.transferred.length > 0) {
            onComplete(result.transferred);
        }
    };

    const handleEditSave = (updates: Partial<GeneratedInitiative>) => {
        if (editingInitiative) {
            editInitiative(editingInitiative.id, updates);
            setEditingInitiative(null);
        }
    };

    const canProceed = () => {
        switch (currentStep) {
            case 'gaps':
                return selectedGapsCount > 0;
            case 'constraints':
                return true;
            case 'review':
                return generatedInitiatives.length > 0;
            case 'approve':
                return generatedInitiatives.length > 0;
            default:
                return false;
        }
    };

    // Render step content
    const renderStepContent = () => {
        switch (currentStep) {
            case 'gaps':
                return renderGapSelection();
            case 'constraints':
                return renderConstraints();
            case 'review':
                return renderReview();
            case 'approve':
                return renderApprove();
            default:
                return null;
        }
    };

    // Gap Selection Step
    const renderGapSelection = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                        Select Gaps to Address
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Choose which maturity gaps should be addressed with new initiatives
                    </p>
                </div>
                <button
                    onClick={() => selectAllGaps(selectedGapsCount !== gaps.length)}
                    className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                >
                    {selectedGapsCount === gaps.length ? 'Deselect All' : 'Select All'}
                </button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
            ) : gaps.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No gaps found in this assessment.</p>
                    <p className="text-sm">Complete the assessment first to identify gaps.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {gaps.map((gap) => (
                        <div
                            key={gap.axisId}
                            onClick={() => selectGap(gap.axisId, !gap.selected)}
                            className={`
                                p-4 rounded-xl border-2 cursor-pointer transition-all
                                ${gap.selected 
                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                                    : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                                }
                            `}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`
                                        w-6 h-6 rounded-full flex items-center justify-center border-2
                                        ${gap.selected 
                                            ? 'bg-purple-600 border-purple-600' 
                                            : 'border-slate-300 dark:border-slate-600'
                                        }
                                    `}>
                                        {gap.selected && <Check size={14} className="text-white" />}
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-navy-900 dark:text-white">
                                            {gap.axisName}
                                        </h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {gap.currentScore} → {gap.targetScore} (gap: {gap.gap})
                                        </p>
                                    </div>
                                </div>
                                <span className={`
                                    px-3 py-1 rounded-full text-xs font-semibold
                                    ${gap.priority === 'CRITICAL' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                      gap.priority === 'HIGH' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                      gap.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                    }
                                `}>
                                    {gap.priority}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    // Constraints Step
    const renderConstraints = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                    Set Generation Constraints
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Define parameters for AI initiative generation
                </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Budget */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <DollarSign size={16} />
                        Max Budget (PLN)
                    </label>
                    <input
                        type="number"
                        value={constraints.maxBudget || ''}
                        onChange={(e) => setConstraints(prev => ({ 
                            ...prev, 
                            maxBudget: e.target.value ? parseInt(e.target.value) : undefined 
                        }))}
                        placeholder="No limit"
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                    />
                </div>

                {/* Timeline */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <Clock size={16} />
                        Max Timeline
                    </label>
                    <select
                        value={constraints.maxTimeline || ''}
                        onChange={(e) => setConstraints(prev => ({ ...prev, maxTimeline: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                    >
                        <option value="3 months">3 months</option>
                        <option value="6 months">6 months</option>
                        <option value="12 months">12 months</option>
                        <option value="18 months">18 months</option>
                        <option value="24 months">24 months</option>
                    </select>
                </div>

                {/* Team Size */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <Users size={16} />
                        Team Size
                    </label>
                    <select
                        value={constraints.teamSize || ''}
                        onChange={(e) => setConstraints(prev => ({ ...prev, teamSize: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                    >
                        <option value="1-5">1-5 people</option>
                        <option value="5-10">5-10 people</option>
                        <option value="10-20">10-20 people</option>
                        <option value="20+">20+ people</option>
                    </select>
                </div>

                {/* Risk Appetite */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <Shield size={16} />
                        Risk Appetite
                    </label>
                    <select
                        value={constraints.riskAppetite || ''}
                        onChange={(e) => setConstraints(prev => ({ 
                            ...prev, 
                            riskAppetite: e.target.value as 'conservative' | 'moderate' | 'aggressive' 
                        }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                    >
                        <option value="conservative">Conservative - Lower risk, smaller scope</option>
                        <option value="moderate">Moderate - Balanced approach</option>
                        <option value="aggressive">Aggressive - Higher risk, bigger impact</option>
                    </select>
                </div>
            </div>

            {/* Selected Gaps Summary */}
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <h4 className="text-sm font-medium text-purple-900 dark:text-purple-300 mb-2">
                    Selected Gaps ({selectedGapsCount})
                </h4>
                <div className="flex flex-wrap gap-2">
                    {gaps.filter(g => g.selected).map(gap => (
                        <span 
                            key={gap.axisId}
                            className="px-2 py-1 bg-white dark:bg-navy-900 rounded text-xs text-navy-900 dark:text-white"
                        >
                            {gap.axisName}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );

    // Review Step
    const renderReview = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                        Review Generated Initiatives
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Review, edit, or remove initiatives before approval
                    </p>
                </div>
                <button
                    onClick={() => addCustomInitiative({})}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
                >
                    <Plus size={16} />
                    Add Custom
                </button>
            </div>

            {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">
                        AI is generating initiatives...
                    </p>
                </div>
            ) : generatedInitiatives.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No initiatives generated yet.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {generatedInitiatives.map((initiative) => (
                        <GeneratedInitiativeCard
                            key={initiative.id}
                            initiative={initiative}
                            onEdit={() => setEditingInitiative(initiative)}
                            onRemove={() => removeInitiative(initiative.id)}
                        />
                    ))}
                </div>
            )}

            {/* Totals */}
            {generatedInitiatives.length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-navy-950 rounded-xl border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Total Budget</p>
                            <p className="text-xl font-bold text-navy-900 dark:text-white">
                                {totals.budget.toLocaleString()} PLN
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Avg. ROI</p>
                            <p className="text-xl font-bold text-green-600 dark:text-green-400">
                                {(totals.roi / generatedInitiatives.length).toFixed(1)}x
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Initiatives</p>
                            <p className="text-xl font-bold text-navy-900 dark:text-white">
                                {generatedInitiatives.length}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // Approve Step
    const renderApprove = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                    Approve & Transfer to Initiatives Module
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Confirm and send initiatives to the project roadmap
                </p>
            </div>

            {transferResult ? (
                <div className="space-y-4">
                    {transferResult.transferred.length > 0 && (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-500/20">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                                <div>
                                    <h4 className="font-medium text-green-900 dark:text-green-300">
                                        Successfully Transferred
                                    </h4>
                                    <p className="text-sm text-green-700 dark:text-green-400">
                                        {transferResult.transferred.length} initiative(s) sent to Module 3
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {transferResult.failed.length > 0 && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-500/20">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                                <div>
                                    <h4 className="font-medium text-red-900 dark:text-red-300">
                                        Transfer Failed
                                    </h4>
                                    <p className="text-sm text-red-700 dark:text-red-400">
                                        {transferResult.failed.length} initiative(s) could not be transferred
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Summary */}
                    <div className="p-6 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl text-white">
                        <h4 className="text-lg font-semibold mb-4">Transfer Summary</h4>
                        <div className="grid grid-cols-3 gap-6">
                            <div>
                                <p className="text-purple-200 text-sm">Initiatives</p>
                                <p className="text-3xl font-bold">{generatedInitiatives.length}</p>
                            </div>
                            <div>
                                <p className="text-purple-200 text-sm">Total Budget</p>
                                <p className="text-3xl font-bold">{(totals.budget / 1000).toFixed(0)}k PLN</p>
                            </div>
                            <div>
                                <p className="text-purple-200 text-sm">Expected ROI</p>
                                <p className="text-3xl font-bold">{(totals.roi / generatedInitiatives.length).toFixed(1)}x</p>
                            </div>
                        </div>
                    </div>

                    {/* Initiative List */}
                    <div className="divide-y divide-slate-200 dark:divide-white/10 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                        {generatedInitiatives.map((init, idx) => (
                            <div key={init.id} className="p-4 flex items-center justify-between bg-white dark:bg-navy-900">
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-sm font-bold text-purple-600 dark:text-purple-400">
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <p className="font-medium text-navy-900 dark:text-white">{init.name}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {init.timeline} • {init.estimatedBudget.toLocaleString()} PLN
                                        </p>
                                    </div>
                                </div>
                                <span className={`
                                    px-2 py-1 rounded text-xs font-medium
                                    ${init.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                      init.riskLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    }
                                `}>
                                    {init.riskLevel}
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-white dark:bg-navy-900">
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-white/10">
                <h2 className="text-xl font-bold text-navy-900 dark:text-white">
                    Initiative Generator
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Generate transformation initiatives from assessment gaps
                </p>
            </div>

            {/* Progress Steps */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950">
                <div className="flex items-center justify-between max-w-3xl mx-auto">
                    {STEPS.map((step, idx) => {
                        const isActive = step.id === currentStep;
                        const isCompleted = idx < stepIndex;

                        return (
                            <React.Fragment key={step.id}>
                                <div className="flex items-center gap-3">
                                    <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center
                                        ${isCompleted ? 'bg-green-500 text-white' :
                                          isActive ? 'bg-purple-600 text-white' :
                                          'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                        }
                                    `}>
                                        {isCompleted ? <Check size={18} /> : step.icon}
                                    </div>
                                    <span className={`
                                        text-sm font-medium
                                        ${isActive ? 'text-purple-600 dark:text-purple-400' :
                                          isCompleted ? 'text-green-600 dark:text-green-400' :
                                          'text-slate-500 dark:text-slate-400'
                                        }
                                    `}>
                                        {step.label}
                                    </span>
                                </div>
                                {idx < STEPS.length - 1 && (
                                    <div className={`
                                        flex-1 h-0.5 mx-4
                                        ${idx < stepIndex ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}
                                    `} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-2">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}
                    {renderStepContent()}
                </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                        Cancel
                    </button>

                    <div className="flex items-center gap-3">
                        {stepIndex > 0 && !transferResult && (
                            <button
                                onClick={handleBack}
                                disabled={isGenerating || isSaving}
                                className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                <ArrowLeft size={18} />
                                Back
                            </button>
                        )}

                        {currentStep !== 'approve' ? (
                            <button
                                onClick={handleNext}
                                disabled={!canProceed() || isGenerating}
                                className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-400 text-white rounded-lg font-medium transition-colors"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        {currentStep === 'constraints' ? 'Generate' : 'Next'}
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        ) : !transferResult ? (
                            <button
                                onClick={handleApprove}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-slate-400 text-white rounded-lg font-semibold transition-colors"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Transferring...
                                    </>
                                ) : (
                                    <>
                                        <Send size={18} />
                                        Approve & Transfer
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={() => onComplete(transferResult.transferred)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
                            >
                                <CheckCircle2 size={18} />
                                Done
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Initiative Editor Modal */}
            {editingInitiative && (
                <InitiativeEditor
                    initiative={editingInitiative}
                    onSave={handleEditSave}
                    onCancel={() => setEditingInitiative(null)}
                />
            )}
        </div>
    );
};

export default InitiativeGeneratorWizard;

