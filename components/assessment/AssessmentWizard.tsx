import React, { useState } from 'react';
import { DRDAxis, MaturityLevel } from '../../types';
import { ArrowRight, Check, X, HelpCircle, Award, RefreshCcw, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AssessmentWizardProps {
    axis: DRDAxis;
    onComplete: (level: MaturityLevel, justification: string, areaScores: Record<string, number[]>) => void;
    onCancel: () => void;
}

export const AssessmentWizard: React.FC<AssessmentWizardProps> = ({
    axis,
    onComplete,
    onCancel
}) => {
    const [step, setStep] = useState<'intro' | 'questions' | 'result'>('intro');
    const [currentAreaIdx, setCurrentAreaIdx] = useState(0);
    // Store selected level for each area: { areaKey: level }
    const [areaRatings, setAreaRatings] = useState<Record<string, number>>({});
    const [recommendedLevel, setRecommendedLevel] = useState<MaturityLevel>(1);

    const { t } = useTranslation();
    const axisContent = t(`assessment.axisContent.${axis}`, { returnObjects: true }) as any;
    const wizT = t('assessment.wizard', { returnObjects: true }) as any;

    // Get areas from the new structure
    const areas = axisContent?.areas || {};
    const areaKeys = Object.keys(areas);
    const currentAreaKey = areaKeys[currentAreaIdx];
    const currentArea = areas[currentAreaKey];

    // Check if we have valid areas
    if (areaKeys.length === 0) {
        return (
            <div className="p-8 text-center">
                <p className="text-slate-400 mb-4">No detailed areas defined for this axis yet.</p>
                <button onClick={onCancel} className="text-purple-400 hover:text-purple-300">
                    {wizT.cancel || 'Return'}
                </button>
            </div>
        );
    }

    const calculateResult = (finalRatings: Record<string, number>) => {
        let total = 0;
        let count = 0;
        Object.values(finalRatings).forEach(level => {
            if (level > 0) {
                total += level;
                count++;
            }
        });

        const avg = count > 0 ? Math.round(total / count) : 1;
        let finalLevel = avg as MaturityLevel;
        if (finalLevel < 1) finalLevel = 1;
        if (finalLevel > 7) finalLevel = 7;

        setRecommendedLevel(finalLevel);
        setStep('result');
    };

    const handleLevelSelect = (level: number) => {
        const newRatings = { ...areaRatings, [currentAreaKey]: level };
        setAreaRatings(newRatings);

        if (currentAreaIdx < areaKeys.length - 1) {
            setCurrentAreaIdx(currentAreaIdx + 1);
        } else {
            calculateResult(newRatings);
        }
    };

    const handleComplete = () => {
        // Convert simple ratings { "sales": 3 } to areaScores format { "sales": [3, target?] }
        // For the wizard, we act as setting the "Actual" state. 
        // We can assume Target = Actual + 1 or just leave it 0 (user sets it later).
        // Let's set Target = 0 so user is forced to think about it in the Workspace.
        const areaScores: Record<string, number[]> = {};
        Object.entries(areaRatings).forEach(([key, level]) => {
            areaScores[key] = [level, 0];
        });

        onComplete(
            recommendedLevel,
            "Assessment completed via Wizard for all sub-areas.",
            areaScores
        );
    };

    const getLevelsForCurrentArea = () => {
        if (!currentArea?.levels) return [];
        return Array.isArray(currentArea.levels)
            ? currentArea.levels
            : Object.values(currentArea.levels);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-900 text-navy-900 dark:text-white relative overflow-hidden transition-colors">

            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none translate-y-1/3 -translate-x-1/3"></div>

            <div className="relative z-10 flex-1 flex flex-col max-w-4xl mx-auto w-full p-8 justify-center min-h-[500px]">

                {/* BACK / CANCEL BUTTON */}
                <button
                    onClick={onCancel}
                    className="absolute top-8 left-8 text-slate-500 hover:text-navy-900 dark:hover:text-white transition-colors flex items-center gap-2 text-sm"
                >
                    <ArrowLeft size={16} />
                    {wizT.cancel || 'Cancel'}
                </button>

                {/* STEP 1: INTRO */}
                {step === 'intro' && (
                    <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="w-20 h-20 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto border border-purple-500/20 mb-6 font-bold text-purple-600 dark:text-purple-400">
                            <RefreshCcw size={40} />
                        </div>

                        <div>
                            <h2 className="text-3xl font-bold mb-4 text-navy-900 dark:text-white">
                                {axisContent.title} Assessment
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400 text-lg max-w-xl mx-auto leading-relaxed text-justify">
                                {axisContent.intro || wizT.startDesc}
                            </p>
                            <p className="text-sm text-slate-500 mt-4">
                                You will assess {areaKeys.length} key areas.
                            </p>
                        </div>

                        <button
                            onClick={() => setStep('questions')}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-lg shadow-purple-900/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto"
                        >
                            {wizT.startBtn}
                            <ArrowRight size={20} />
                        </button>
                    </div>
                )}

                {/* STEP 2: AREA SCORING */}
                {step === 'questions' && (
                    <div className="max-w-3xl mx-auto w-full animate-in fade-in slide-in-from-right-8 duration-500">
                        {/* Progress */}
                        <div className="mb-8">
                            <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                                <span>Area {currentAreaIdx + 1} / {areaKeys.length}</span>
                                <span>{Math.round(((currentAreaIdx) / areaKeys.length) * 100)}%</span>
                            </div>
                            <div className="h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-purple-500 transition-all duration-500 ease-out"
                                    style={{ width: `${((currentAreaIdx) / areaKeys.length) * 100}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Area Title */}
                        <div className="mb-8 text-center">
                            <h3 className="text-2xl font-bold mb-2 text-navy-900 dark:text-white">{currentArea.title}</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">Select the level that best describes your current state.</p>
                        </div>

                        {/* Level Options */}
                        <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto pr-2">
                            {getLevelsForCurrentArea().map((lvl: string, idx: number) => {
                                const levelNum = idx + 1;
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleLevelSelect(levelNum)}
                                        className="group flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-purple-50 dark:hover:bg-purple-500/10 hover:border-purple-500/50 transition-all text-left shadow-sm dark:shadow-none"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-navy-900 border border-slate-300 dark:border-white/20 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:border-purple-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 shrink-0">
                                            {levelNum}
                                        </div>
                                        <span className="text-sm md:text-base text-slate-700 dark:text-slate-300 group-hover:text-navy-900 dark:group-hover:text-white transition-colors">
                                            {lvl}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* STEP 3: RESULT */}
                {step === 'result' && (
                    <div className="text-center max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="mb-6 relative inline-block">
                            <div className="absolute inset-0 bg-purple-500 blur-2xl opacity-20 rounded-full"></div>
                            <Award size={80} className="text-purple-500 dark:text-purple-400 relative z-10" />
                        </div>

                        <div className="mb-8">
                            <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                                {wizT.recommendedLevel}
                            </h2>
                            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 mb-4">
                                Level {recommendedLevel}
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 text-lg">
                                Based on your detailed assessment of {areaKeys.length} sub-areas.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <button
                                onClick={handleComplete}
                                className="w-full bg-navy-900 dark:bg-white text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-slate-200 px-8 py-4 rounded-xl font-bold text-lg shadow-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <Check size={20} />
                                {wizT.acceptResult}
                            </button>

                            <button
                                onClick={onCancel}
                                className="w-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 px-8 py-4 rounded-xl font-semibold transition-colors"
                            >
                                {wizT.adjustManually}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
