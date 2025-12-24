/**
 * RapidLean Assessment Wizard
 * Guided 18-question assessment for Lean maturity
 * 
 * Sprint 4 Enhancements:
 * - Mode selection: Quick Assessment vs Full Observation
 * - Progress saving with localStorage
 * - Help tooltips with benchmarking context
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ArrowRight, ArrowLeft, Check, HelpCircle, Award,
    Zap, ClipboardList, Save, RefreshCw, Pause,
    BarChart3, AlertCircle, Clock, Target
} from 'lucide-react';
import { RAPID_LEAN_QUESTIONNAIRE, LEAN_SCALE, LeanDimension } from '../../data/rapidLeanQuestionnaire';

// Storage key for drafts
const DRAFT_STORAGE_KEY = 'rapidlean_wizard_draft';

// Assessment modes
type AssessmentMode = 'quick' | 'full' | null;

interface WizardDraft {
    projectId?: string;
    mode: AssessmentMode;
    currentDimensionIndex: number;
    currentQuestionIndex: number;
    responses: Record<string, number>;
    lastSaved: number;
}

// Industry benchmarks for context display
const INDUSTRY_BENCHMARKS: Record<string, number> = {
    valueStreamEfficiency: 2.8,
    wasteElimination: 2.5,
    flowPullSystems: 2.3,
    qualityAtSource: 3.1,
    continuousImprovement: 2.6,
    visualManagement: 2.4
};

interface RapidLeanWizardProps {
    projectId?: string;
    onComplete: (responses: Record<string, number>, mode: AssessmentMode) => void;
    onCancel: () => void;
    initialMode?: AssessmentMode;
}

export const RapidLeanWizard: React.FC<RapidLeanWizardProps> = ({
    projectId,
    onComplete,
    onCancel,
    initialMode
}) => {
    const { t } = useTranslation();

    // Mode selection state
    const [assessmentMode, setAssessmentMode] = useState<AssessmentMode>(initialMode || null);
    const [showModeSelection, setShowModeSelection] = useState(!initialMode);

    // Progress state
    const [currentDimensionIndex, setCurrentDimensionIndex] = useState(0);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [responses, setResponses] = useState<Record<string, number>>({});
    const [showHelp, setShowHelp] = useState(false);

    // Draft management
    const [hasDraft, setHasDraft] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [showDraftPrompt, setShowDraftPrompt] = useState(false);

    const currentDimension = RAPID_LEAN_QUESTIONNAIRE[currentDimensionIndex];
    const currentQuestion = currentDimension.questions[currentQuestionIndex];
    const totalQuestions = RAPID_LEAN_QUESTIONNAIRE.reduce((sum, dim) => sum + dim.questions.length, 0);
    const answeredQuestions = Object.keys(responses).length;
    const progress = (answeredQuestions / totalQuestions) * 100;

    // Check for existing draft on mount
    useEffect(() => {
        const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (draft) {
            try {
                const parsed: WizardDraft = JSON.parse(draft);
                // Only show prompt if draft matches this project (or no project specified)
                if (!projectId || parsed.projectId === projectId) {
                    setHasDraft(true);
                    setShowDraftPrompt(true);
                }
            } catch (e) {
                localStorage.removeItem(DRAFT_STORAGE_KEY);
            }
        }
    }, [projectId]);

    // Auto-save draft every 10 seconds when there are responses
    useEffect(() => {
        if (Object.keys(responses).length === 0 || !assessmentMode) return;

        const saveInterval = setInterval(() => {
            saveDraft();
        }, 10000);

        return () => clearInterval(saveInterval);
    }, [responses, currentDimensionIndex, currentQuestionIndex, assessmentMode]);

    // Save draft to localStorage
    const saveDraft = useCallback(() => {
        const draft: WizardDraft = {
            projectId,
            mode: assessmentMode,
            currentDimensionIndex,
            currentQuestionIndex,
            responses,
            lastSaved: Date.now()
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
        setLastSaved(new Date());
    }, [projectId, assessmentMode, currentDimensionIndex, currentQuestionIndex, responses]);

    // Restore draft from localStorage
    const restoreDraft = useCallback(() => {
        const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (draft) {
            try {
                const parsed: WizardDraft = JSON.parse(draft);
                setAssessmentMode(parsed.mode);
                setShowModeSelection(false);
                setCurrentDimensionIndex(parsed.currentDimensionIndex);
                setCurrentQuestionIndex(parsed.currentQuestionIndex);
                setResponses(parsed.responses);
                setLastSaved(new Date(parsed.lastSaved));
                setShowDraftPrompt(false);
            } catch (e) {
                console.error('Failed to restore draft:', e);
            }
        }
    }, []);

    // Clear draft and start fresh
    const clearDraft = useCallback(() => {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setHasDraft(false);
        setShowDraftPrompt(false);
    }, []);

    // Handle mode selection
    const handleModeSelect = (mode: AssessmentMode) => {
        setAssessmentMode(mode);
        setShowModeSelection(false);
        clearDraft(); // Clear any old draft when starting fresh
    };

    // Get benchmark for current dimension
    const getCurrentBenchmark = () => {
        const dimensionKey = Object.keys(INDUSTRY_BENCHMARKS)[currentDimensionIndex];
        return INDUSTRY_BENCHMARKS[dimensionKey] || 2.5;
    };

    const handleAnswer = (score: number) => {
        setResponses(prev => ({ ...prev, [currentQuestion.id]: score }));

        // Auto-advance
        setTimeout(() => {
            if (currentQuestionIndex < currentDimension.questions.length - 1) {
                setCurrentQuestionIndex(currentQuestionIndex + 1);
            } else if (currentDimensionIndex < RAPID_LEAN_QUESTIONNAIRE.length - 1) {
                setCurrentDimensionIndex(currentDimensionIndex + 1);
                setCurrentQuestionIndex(0);
            }
        }, 300);
    };

    const handleBack = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        } else if (currentDimensionIndex > 0) {
            setCurrentDimensionIndex(currentDimensionIndex - 1);
            setCurrentQuestionIndex(RAPID_LEAN_QUESTIONNAIRE[currentDimensionIndex - 1].questions.length - 1);
        }
    };

    const handleNext = () => {
        if (!responses[currentQuestion.id]) return;

        if (currentQuestionIndex < currentDimension.questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else if (currentDimensionIndex < RAPID_LEAN_QUESTIONNAIRE.length - 1) {
            setCurrentDimensionIndex(currentDimensionIndex + 1);
            setCurrentQuestionIndex(0);
        }
    };

    const handleComplete = () => {
        if (Object.keys(responses).length === totalQuestions) {
            // Clear draft on completion
            localStorage.removeItem(DRAFT_STORAGE_KEY);
            onComplete(responses, assessmentMode);
        }
    };

    const handleSaveAndExit = () => {
        saveDraft();
        onCancel();
    };

    const isLastQuestion = currentDimensionIndex === RAPID_LEAN_QUESTIONNAIRE.length - 1 &&
        currentQuestionIndex === currentDimension.questions.length - 1;

    // MODE SELECTION SCREEN
    if (showModeSelection) {
        return (
            <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-500 to-green-500 text-white p-6">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Award className="w-6 h-6" />
                            RapidLean Assessment
                        </h2>
                        <p className="text-blue-100 mt-2">Select your assessment mode</p>
                    </div>

                    {/* Draft Prompt */}
                    {showDraftPrompt && hasDraft && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-300 dark:border-yellow-600 p-4">
                            <div className="flex items-start gap-3">
                                <RefreshCw className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="font-medium text-yellow-800 dark:text-yellow-200">
                                        You have an unfinished assessment
                                    </p>
                                    <p className="text-sm text-yellow-600 dark:text-yellow-300 mt-1">
                                        Would you like to continue where you left off?
                                    </p>
                                    <div className="flex gap-3 mt-3">
                                        <button
                                            onClick={restoreDraft}
                                            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm font-medium"
                                        >
                                            Continue Draft
                                        </button>
                                        <button
                                            onClick={clearDraft}
                                            className="px-4 py-2 text-yellow-700 dark:text-yellow-200 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 rounded-lg text-sm"
                                        >
                                            Start Fresh
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mode Selection Cards */}
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Quick Assessment */}
                            <button
                                onClick={() => handleModeSelect('quick')}
                                className="text-left p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
                                        <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                            Quick Assessment
                                        </h3>
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> 15-20 min
                                        </span>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    18 structured questions for rapid Lean maturity evaluation.
                                    Ideal for initial assessments or progress checks.
                                </p>
                                <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                    <li className="flex items-center gap-1">
                                        <Check className="w-3 h-3 text-green-500" />
                                        6 Lean dimensions covered
                                    </li>
                                    <li className="flex items-center gap-1">
                                        <Check className="w-3 h-3 text-green-500" />
                                        Automatic DRD mapping
                                    </li>
                                    <li className="flex items-center gap-1">
                                        <Check className="w-3 h-3 text-green-500" />
                                        AI-powered recommendations
                                    </li>
                                </ul>
                            </button>

                            {/* Full Observation */}
                            <button
                                onClick={() => handleModeSelect('full')}
                                className="text-left p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-800/50 transition-colors">
                                        <ClipboardList className="w-6 h-6 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                            Full Observation
                                        </h3>
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> 60-90 min
                                        </span>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    Complete Gemba Walk with photo evidence and detailed observations.
                                    Best for comprehensive assessments.
                                </p>
                                <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                    <li className="flex items-center gap-1">
                                        <Check className="w-3 h-3 text-green-500" />
                                        Production floor observations
                                    </li>
                                    <li className="flex items-center gap-1">
                                        <Check className="w-3 h-3 text-green-500" />
                                        Photo documentation
                                    </li>
                                    <li className="flex items-center gap-1">
                                        <Check className="w-3 h-3 text-green-500" />
                                        DBR77 format report
                                    </li>
                                </ul>
                            </button>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-green-500 text-white p-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Award className="w-6 h-6" />
                        RapidLean Assessment
                    </h2>
                    <p className="text-blue-100 mt-2">
                        Dimension {currentDimensionIndex + 1}/6: {currentDimension.name}
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-gray-200 dark:bg-gray-700">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-240px)]">
                    {/* Dimension Description */}
                    <div className="bg-blue-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
                        <p className="text-gray-700 dark:text-gray-300">
                            {currentDimension.description}
                        </p>
                    </div>

                    {/* Question */}
                    <div className="mb-6">
                        <div className="flex items-start justify-between mb-4">
                            <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex-1">
                                Question {answeredQuestions + 1}/{totalQuestions}
                            </h3>
                            <button
                                onClick={() => setShowHelp(!showHelp)}
                                className="text-blue-500 hover:text-blue-600"
                            >
                                <HelpCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                            {currentQuestion.text}
                        </p>

                        {showHelp && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 mb-4">
                                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                                    💡 {currentQuestion.helpText}
                                </p>
                                {/* Benchmarking Context */}
                                <div className="mt-3 pt-3 border-t border-yellow-300 dark:border-yellow-600">
                                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                        <BarChart3 className="w-4 h-4" />
                                        <span>Industry Benchmark for {currentDimension.name}:</span>
                                        <span className="font-bold text-blue-600 dark:text-blue-400">
                                            {getCurrentBenchmark().toFixed(1)}/5.0
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Rating Buttons */}
                    <div className="space-y-3">
                        {LEAN_SCALE.map(scale => (
                            <button
                                key={scale.value}
                                onClick={() => handleAnswer(scale.value)}
                                className={`w-full p-4 rounded-lg border-2 transition-all duration-200 text-left ${responses[currentQuestion.id] === scale.value
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl font-bold text-blue-500">
                                            {scale.value}
                                        </span>
                                        <div>
                                            <p className="font-semibold text-gray-800 dark:text-white">
                                                {scale.label}
                                            </p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                {scale.description}
                                            </p>
                                        </div>
                                    </div>
                                    {responses[currentQuestion.id] === scale.value && (
                                        <Check className="w-6 h-6 text-blue-500" />
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t dark:border-gray-700 p-4 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800"
                        >
                            Cancel
                        </button>
                        {/* Save & Exit Button */}
                        {Object.keys(responses).length > 0 && (
                            <button
                                onClick={handleSaveAndExit}
                                className="px-4 py-2 text-blue-600 hover:text-blue-700 flex items-center gap-1.5 text-sm"
                                title="Save progress and continue later"
                            >
                                <Pause className="w-4 h-4" />
                                Save & Exit
                            </button>
                        )}
                        {/* Last Saved Indicator */}
                        {lastSaved && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Save className="w-3 h-3" />
                                Saved {lastSaved.toLocaleTimeString()}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleBack}
                            disabled={currentDimensionIndex === 0 && currentQuestionIndex === 0}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 disabled:opacity-30 flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>

                        {isLastQuestion && Object.keys(responses).length === totalQuestions ? (
                            <button
                                onClick={handleComplete}
                                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-green-500 text-white rounded-lg hover:from-blue-600 hover:to-green-600 flex items-center gap-2"
                            >
                                Complete Assessment
                                <Check className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                onClick={handleNext}
                                disabled={!responses[currentQuestion.id]}
                                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-30 flex items-center gap-2"
                            >
                                Next
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
