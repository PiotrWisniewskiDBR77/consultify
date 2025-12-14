import { CheckCircle2, Circle, MessageSquare, AlertCircle, Sparkles, BrainCircuit } from 'lucide-react';

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
    onAiAssist
}) => {
    return (
        <div className="bg-navy-950/50 border border-white/5 rounded-2xl p-8 relative overflow-hidden flex flex-col items-center text-center">

            {/* Background Number Decor */}
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none select-none">
                <span className="text-[150px] font-bold text-white leading-none">{level}</span>
            </div>

            <div className="relative z-10 w-full max-w-2xl">
                {/* Header */}
                <div className="mb-8">
                    <span className="text-purple-400 font-bold tracking-wider text-xs uppercase mb-3 block">POZIOM {level}</span>
                    <h1 className="text-2xl md:text-3xl font-bold text-white mb-4 leading-tight">
                        {title}
                    </h1>
                    <p className="text-slate-300 text-base leading-relaxed text-justify">
                        {description}
                    </p>
                </div>

                {/* Helper Questions */}
                {Array.isArray(helperQuestions) && helperQuestions.length > 0 && (
                    <div className="bg-white/5 rounded-xl p-6 mb-8 text-left border border-white/5">
                        <div className="flex items-center gap-2 mb-3 text-purple-300 font-semibold text-sm">
                            <AlertCircle size={16} />
                            <span>Pytania Pomocnicze</span>
                        </div>
                        <ul className="space-y-2">
                            {helperQuestions.map((q, idx) => (
                                <li key={idx} className="text-slate-400 text-sm flex gap-2">
                                    <span className="text-purple-500/50">•</span>
                                    {q}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Working Formula / Logic */}
                {formula && (
                    <div className="bg-blue-900/10 rounded-xl p-4 mb-8 text-left border border-blue-500/10">
                        <div className="flex items-center gap-2 mb-2 text-blue-300 font-semibold text-xs uppercase tracking-wider">
                            <BrainCircuit size={14} />
                            <span>Formuła Pracy (Logic)</span>
                        </div>
                        <p className="text-slate-400 text-sm italic">
                            "{formula}"
                        </p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
                    <button
                        onClick={onSetActual}
                        className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border flex items-center gap-2 min-w-[160px] justify-center ${isActual
                            ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40'
                            : 'bg-navy-950/30 border-blue-500/30 text-slate-300 hover:border-blue-500 hover:bg-blue-500/10 hover:text-white hover:shadow-lg hover:shadow-blue-900/20'
                            }`}
                    >
                        {isActual && <CheckCircle2 size={16} />}
                        {/* Just "Obecny" whether selected or not, as per request "Just words..." */}
                        Obecny
                    </button>

                    <button
                        onClick={onSetTarget}
                        className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border flex items-center gap-2 min-w-[160px] justify-center ${isTarget
                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/40'
                            : 'bg-navy-950/30 border-purple-500/30 text-slate-300 hover:border-purple-500 hover:bg-purple-500/10 hover:text-white hover:shadow-lg hover:shadow-purple-900/20'
                            }`}
                    >
                        {isTarget && <CheckCircle2 size={16} />}
                        Docelowy
                    </button>

                    <button
                        onClick={onSetNA}
                        className="px-6 py-3 rounded-xl font-medium text-sm transition-all border bg-navy-950/30 border-white/10 text-slate-400 hover:border-slate-400 hover:bg-white/5 hover:text-white"
                    >
                        Nie dotyczy
                    </button>
                </div>

                {/* Notes Section */}
                <div className="w-full text-left bg-navy-950/30 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center mb-3">
                        <label className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-2">
                            <MessageSquare size={14} />
                            Notatka
                        </label>
                    </div>

                    <div className="relative">
                        <textarea
                            value={notes || ''}
                            onChange={(e) => onNotesChange(e.target.value)}
                            placeholder="Wpisz swoje spostrzeżenia... a AI pomoże Ci je rozwinąć i sformatować."
                            className="w-full bg-navy-900/50 border border-white/10 rounded-lg p-3 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all min-h-[100px] resize-none"
                        />
                    </div>

                    <div className="flex items-center justify-between mt-3">
                        <p className="text-[10px] text-slate-500 italic">
                            Dokładne notatki pomagają generować lepsze rekomendacje.
                        </p>

                        <div className="flex gap-2">
                            {/* Save Button */}
                            {notes && (
                                <button className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-green-400 bg-white/5 hover:bg-green-500/10 px-3 py-1.5 rounded-full transition-all border border-white/10 hover:border-green-500/30">
                                    <CheckCircle2 size={12} />
                                    Zapisz
                                </button>
                            )}

                            {/* AI Button */}
                            {onAiAssist && (
                                <button
                                    onClick={onAiAssist}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-purple-400 hover:text-white bg-purple-500/20 hover:bg-purple-500 px-3 py-1.5 rounded-full transition-all border border-purple-500/30"
                                >
                                    <Sparkles size={12} />
                                    AI
                                </button>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
