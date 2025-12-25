import { CheckCircle2, Circle, MessageSquare, AlertCircle, Sparkles, BrainCircuit, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAssessmentButtonClasses } from '../../utils/assessmentColors';
import { useDeviceType } from '../../hooks/useDeviceType';

interface LevelDetailCardProps {
    level: number;
    title: string;
    description: string;
    helperQuestions?: string[];
    formula?: string;
    isActual: boolean;
    isTarget: boolean;
    onSetActual: () => void;
    onSetTarget: () => void;
    onSetNA: () => void;
    notes?: string;
    onNotesChange: (notes: string) => void;
    onAiAssist?: () => void;
    isAiLoading?: boolean;
}

export const LevelDetailCard: React.FC<LevelDetailCardProps> = ({
    level,
    title,
    description,
    helperQuestions = [],
    formula,
    isActual,
    isTarget,
    onSetActual,
    onSetTarget,
    onSetNA,
    notes,
    onNotesChange,
    onAiAssist,
    isAiLoading = false
}) => {
    const { t } = useTranslation();
    const cardT = t('assessment.card', { returnObjects: true }) as any;
    const { isTablet, isMobile, isTouchDevice } = useDeviceType();
    const isCompact = isTablet || isMobile;

    return (
        <div className={`bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-white/5 rounded-2xl relative overflow-hidden flex flex-col items-center text-center shadow-lg dark:shadow-none ${isCompact ? 'p-4 md:p-6' : 'p-8'}`}>

            {/* Background Number Decor - smaller on mobile */}
            <div className={`absolute top-0 right-0 opacity-5 pointer-events-none select-none ${isCompact ? 'p-4' : 'p-10'}`}>
                <span className={`font-bold text-slate-900/5 dark:text-white leading-none ${isCompact ? 'text-[80px]' : 'text-[150px]'}`}>{level}</span>
            </div>

            <div className="relative z-10 w-full max-w-2xl">
                {/* Header - Sticky on touch devices */}
                <div className={`${isCompact ? 'mb-4' : 'mb-8'} ${isTouchDevice ? 'sticky top-0 bg-white/95 dark:bg-navy-950/95 backdrop-blur-sm -mx-4 px-4 py-3 md:-mx-6 md:px-6 z-20 border-b border-slate-100 dark:border-white/5' : ''}`}>
                    <span className="text-purple-400 font-bold tracking-wider text-xs uppercase mb-2 block">{cardT.level || 'LEVEL'} {level}</span>
                    <h1 className={`font-bold text-navy-900 dark:text-white mb-3 leading-tight ${isCompact ? 'text-xl' : 'text-2xl md:text-3xl'}`}>
                        {title}
                    </h1>
                    <p className={`text-slate-600 dark:text-slate-300 leading-relaxed text-justify ${isCompact ? 'text-sm' : 'text-base'}`}>
                        {description}
                    </p>
                </div>

                {/* Helper Questions - Collapsible on mobile */}
                {Array.isArray(helperQuestions) && helperQuestions.length > 0 && (
                    <div className={`bg-slate-50 dark:bg-white/5 rounded-xl text-left border border-slate-200 dark:border-white/5 ${isCompact ? 'p-4 mb-4' : 'p-6 mb-8'}`}>
                        <div className="flex items-center gap-2 mb-3 text-purple-400 dark:text-purple-300 font-semibold text-sm">
                            <AlertCircle size={16} />
                            <span>{cardT.helperQuestions || 'Helper Questions'}</span>
                        </div>
                        <ul className="space-y-2">
                            {helperQuestions.map((q, idx) => (
                                <li key={idx} className={`text-slate-600 dark:text-slate-400 flex gap-2 ${isCompact ? 'text-xs' : 'text-sm'}`}>
                                    <span className="text-purple-500/50 shrink-0">•</span>
                                    <span>{q}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Working Formula / Logic - Hidden on very small screens */}
                {formula && (
                    <div className={`bg-blue-50 dark:bg-blue-900/10 rounded-xl text-left border border-blue-200 dark:border-blue-500/10 ${isCompact ? 'p-3 mb-4 hidden sm:block' : 'p-4 mb-8'}`}>
                        <div className="flex items-center gap-2 mb-2 text-blue-400 dark:text-blue-300 font-semibold text-xs uppercase tracking-wider">
                            <BrainCircuit size={14} />
                            <span>{cardT.workingFormula || 'Working Formula (Logic)'}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-sm italic">
                            "{formula}"
                        </p>
                    </div>
                )}

                {/* Actions - Horizontal layout */}
                <div className={`flex flex-wrap items-center justify-center gap-3 ${isCompact ? 'mb-4' : 'mb-8'}`}>
                    <button
                        onClick={onSetActual}
                        className={`
                            touch-target touch-ripple rounded-xl font-bold transition-all border flex items-center justify-center gap-2
                            ${getAssessmentButtonClasses('actual', isActual)}
                            ${isCompact
                                ? 'px-3 py-4 text-sm flex-col'
                                : 'px-6 py-3 text-sm min-w-[160px]'
                            }
                        `}
                    >
                        {isActual && <CheckCircle2 size={isCompact ? 20 : 16} />}
                        <span className={isCompact ? 'text-xs' : ''}>{cardT.actual || 'Actual'}</span>
                    </button>

                    <button
                        onClick={onSetTarget}
                        className={`
                            touch-target touch-ripple rounded-xl font-bold transition-all border flex items-center justify-center gap-2
                            ${getAssessmentButtonClasses('target', isTarget)}
                            ${isCompact
                                ? 'px-3 py-4 text-sm flex-col'
                                : 'px-6 py-3 text-sm min-w-[160px]'
                            }
                        `}
                    >
                        {isTarget && <CheckCircle2 size={isCompact ? 20 : 16} />}
                        <span className={isCompact ? 'text-xs' : ''}>{cardT.target || 'Target'}</span>
                    </button>

                    <button
                        onClick={onSetNA}
                        className={`
                            touch-target touch-ripple rounded-xl font-medium transition-all border 
                            bg-slate-100 dark:bg-navy-950/30 border-slate-200 dark:border-white/10 
                            text-slate-400 active:bg-slate-200 dark:active:bg-white/10
                            flex items-center justify-center gap-2
                            ${isCompact
                                ? 'px-3 py-4 text-sm flex-col'
                                : 'px-6 py-3 text-sm hover:border-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-600 dark:hover:text-white'
                            }
                        `}
                    >
                        <X size={isCompact ? 20 : 16} />
                        <span className={isCompact ? 'text-xs' : ''}>{isCompact ? 'N/A' : (cardT.notApplicable || 'Not Applicable')}</span>
                    </button>
                </div>

                {/* Notes Section */}
                <div className="w-full text-left bg-slate-50 dark:bg-navy-950/30 rounded-xl p-4 border border-slate-200 dark:border-white/5">
                    <div className="flex items-center mb-3">
                        <label className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-2">
                            <MessageSquare size={14} />
                            {cardT.note || 'Note'}
                        </label>
                    </div>

                    <div className="relative">
                        <textarea
                            value={notes || ''}
                            onChange={(e) => onNotesChange(e.target.value)}
                            placeholder={cardT.notePlaceholder || "Type your observations... AI will help you expand and format them."}
                            className="w-full bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm text-navy-900 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all min-h-[150px] resize-y"
                        />
                    </div>

                    <div className="flex items-center justify-between mt-3">
                        <p className="text-[10px] text-slate-500 italic">
                            {cardT.accuracyHint || 'Accurate notes help generate better recommendations.'}
                        </p>

                        <div className="flex gap-2">
                            {/* Save Button */}
                            {notes && (
                                <button className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 bg-white dark:bg-white/5 hover:bg-green-50 dark:hover:bg-green-500/10 px-3 py-1.5 rounded-full transition-all border border-slate-200 dark:border-white/10 hover:border-green-500/30">
                                    <CheckCircle2 size={12} />
                                    {cardT.save || 'Save'}
                                </button>
                            )}

                            {/* AI Button */}
                            {onAiAssist && (
                                <button
                                    onClick={onAiAssist}
                                    disabled={isAiLoading}
                                    className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full transition-all border ${isAiLoading
                                            ? 'text-purple-300 bg-purple-500/10 border-purple-500/20 cursor-wait'
                                            : 'text-purple-400 hover:text-white bg-purple-500/20 hover:bg-purple-500 border-purple-500/30'
                                        }`}
                                >
                                    {isAiLoading ? (
                                        <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                        <Sparkles size={12} />
                                    )}
                                    {isAiLoading ? (cardT.thinking || 'Myślę...') : (cardT.ai || 'AI')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
