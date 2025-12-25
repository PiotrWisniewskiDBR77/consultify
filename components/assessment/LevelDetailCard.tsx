import { CheckCircle2, Circle, MessageSquare, AlertCircle, Sparkles, BrainCircuit, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAssessmentButtonClasses } from '../../utils/assessmentColors';

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

    return (
        <div className="bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-white/5 rounded-2xl p-8 relative overflow-hidden flex flex-col items-center text-center shadow-lg dark:shadow-none">

            {/* Background Number Decor */}
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none select-none">
                <span className="text-[150px] font-bold text-slate-900/5 dark:text-white leading-none">{level}</span>
            </div>

            <div className="relative z-10 w-full max-w-2xl">
                {/* Header */}
                <div className="mb-8">
                    <span className="text-purple-400 font-bold tracking-wider text-xs uppercase mb-3 block">{cardT.level || 'LEVEL'} {level}</span>
                    <h1 className="text-2xl md:text-3xl font-bold text-navy-900 dark:text-white mb-4 leading-tight">
                        {title}
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed text-justify">
                        {description}
                    </p>
                </div>

                {/* Helper Questions */}
                {Array.isArray(helperQuestions) && helperQuestions.length > 0 && (
                    <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-6 mb-8 text-left border border-slate-200 dark:border-white/5">
                        <div className="flex items-center gap-2 mb-3 text-purple-300 font-semibold text-sm">
                            <AlertCircle size={16} />
                            <span>{cardT.helperQuestions || 'Helper Questions'}</span>
                        </div>
                        <ul className="space-y-2">
                            {helperQuestions.map((q, idx) => (
                                <li key={idx} className="text-slate-600 dark:text-slate-400 text-sm flex gap-2">
                                    <span className="text-purple-500/50">•</span>
                                    {q}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Working Formula / Logic */}
                {formula && (
                    <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 mb-8 text-left border border-blue-200 dark:border-blue-500/10">
                        <div className="flex items-center gap-2 mb-2 text-blue-300 font-semibold text-xs uppercase tracking-wider">
                            <BrainCircuit size={14} />
                            <span>{cardT.workingFormula || 'Working Formula (Logic)'}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-sm italic">
                            "{formula}"
                        </p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
                    <button
                        onClick={onSetActual}
                        className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border flex items-center gap-2 min-w-[160px] justify-center ${getAssessmentButtonClasses('actual', isActual)}`}
                    >
                        {isActual && <CheckCircle2 size={16} />}
                        {cardT.actual || 'Actual'}
                    </button>

                    <button
                        onClick={onSetTarget}
                        className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border flex items-center gap-2 min-w-[160px] justify-center ${getAssessmentButtonClasses('target', isTarget)}`}
                    >
                        {isTarget && <CheckCircle2 size={16} />}
                        {cardT.target || 'Target'}
                    </button>

                    <button
                        onClick={onSetNA}
                        className="px-6 py-3 rounded-xl font-medium text-sm transition-all border bg-slate-100 dark:bg-navy-950/30 border-slate-200 dark:border-white/10 text-slate-400 hover:border-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-600 dark:hover:text-white"
                    >
                        {cardT.notApplicable || 'Not Applicable'}
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
                            className="w-full bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm text-navy-900 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all min-h-[100px] resize-none"
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
                                    className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full transition-all border ${
                                        isAiLoading 
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
