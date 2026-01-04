/**
 * InlineResponseFeedback Component
 *
 * Non-intrusive inline feedback collector for AI responses.
 * Allows users to rate responses and provide detailed feedback
 * on length, detail level, and format preferences.
 *
 * Part of the AI Response Personalization System
 *
 * @version 1.0.0
 */

import { Brain, ChevronDown, ChevronUp, MessageSquare, Send, ThumbsDown, ThumbsUp, X, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ResponseFeedback } from '../../types';

interface InlineResponseFeedbackProps {
    messageId: string;
    conversationId?: string;
    responseMode?: 'quick' | 'standard' | 'deepStudy';
    responseLength?: number;
    onFeedback: (feedback: ResponseFeedback) => void;
    compact?: boolean;
}

export const InlineResponseFeedback: React.FC<InlineResponseFeedbackProps> = ({
    messageId,
    conversationId,
    responseMode,
    responseLength,
    onFeedback,
    compact = false,
}) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [feedback, setFeedback] = useState<Partial<ResponseFeedback>>({});

    const handleQuickFeedback = (rating: 'positive' | 'negative') => {
        const completeFeedback: ResponseFeedback = {
            rating,
            ...feedback,
        };
        onFeedback(completeFeedback);
        setSubmitted(true);

        // Reset after animation
        setTimeout(() => {
            setSubmitted(false);
            setFeedback({});
            setExpanded(false);
        }, 2000);
    };

    const handleDetailedFeedback = () => {
        if (!feedback.rating) {
            setFeedback({ ...feedback, rating: 'neutral' });
        }

        const completeFeedback: ResponseFeedback = {
            rating: feedback.rating || 'neutral',
            lengthFeedback: feedback.lengthFeedback,
            detailFeedback: feedback.detailFeedback,
            formatFeedback: feedback.formatFeedback,
            wantedMode: feedback.wantedMode,
            customFeedback: feedback.customFeedback,
        };

        onFeedback(completeFeedback);
        setSubmitted(true);

        setTimeout(() => {
            setSubmitted(false);
            setFeedback({});
            setExpanded(false);
        }, 2000);
    };

    if (submitted) {
        return (
            <div className="flex items-center gap-2 text-xs text-emerald-400 py-1 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <ThumbsUp size={10} />
                </div>
                <span>Dziękujemy za feedback!</span>
            </div>
        );
    }

    if (compact) {
        return (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => handleQuickFeedback('positive')}
                    className="p-1 rounded hover:bg-emerald-500/20 text-slate-500 hover:text-emerald-400 transition-colors"
                    title="Helpful"
                >
                    <ThumbsUp size={12} />
                </button>
                <button
                    onClick={() => handleQuickFeedback('negative')}
                    className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                    title="Not helpful"
                >
                    <ThumbsDown size={12} />
                </button>
            </div>
        );
    }

    return (
        <div className="mt-2 border-t border-white/5 pt-2">
            {/* Quick feedback buttons */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => handleQuickFeedback('positive')}
                    className={`p-1.5 rounded-md transition-all ${
                        feedback.rating === 'positive'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-400'
                    }`}
                    title="Helpful"
                >
                    <ThumbsUp size={14} />
                </button>
                <button
                    onClick={() => handleQuickFeedback('negative')}
                    className={`p-1.5 rounded-md transition-all ${
                        feedback.rating === 'negative'
                            ? 'bg-red-500/20 text-red-400'
                            : 'hover:bg-red-500/10 text-slate-500 hover:text-red-400'
                    }`}
                    title="Not helpful"
                >
                    <ThumbsDown size={14} />
                </button>

                <div className="w-px h-4 bg-white/10 mx-1" />

                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded hover:bg-white/5"
                >
                    {expanded ? (
                        <>
                            <ChevronUp size={12} />
                            Mniej opcji
                        </>
                    ) : (
                        <>
                            <ChevronDown size={12} />
                            Więcej opcji
                        </>
                    )}
                </button>

                {responseMode && (
                    <span className="text-[10px] text-slate-600 ml-auto font-mono">
                        {responseMode} • {responseLength || '?'} znaków
                    </span>
                )}
            </div>

            {/* Expanded feedback options */}
            {expanded && (
                <div className="mt-3 space-y-4 animate-in slide-in-from-top-2 duration-200 p-3 bg-white/5 rounded-lg">
                    {/* Length feedback */}
                    <div>
                        <span className="text-xs text-slate-400 block mb-2">Długość odpowiedzi:</span>
                        <div className="flex gap-1.5">
                            {[
                                { value: 'too_short', label: 'Za krótka', icon: '↓' },
                                { value: 'just_right', label: 'W sam raz', icon: '✓' },
                                { value: 'too_long', label: 'Za długa', icon: '↑' },
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setFeedback({ ...feedback, lengthFeedback: opt.value as any })}
                                    className={`flex-1 px-2 py-1.5 text-xs rounded-md border transition-all ${
                                        feedback.lengthFeedback === opt.value
                                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                                            : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300'
                                    }`}
                                >
                                    {opt.icon} {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Detail level feedback */}
                    <div>
                        <span className="text-xs text-slate-400 block mb-2">Poziom szczegółowości:</span>
                        <div className="flex gap-1.5">
                            {[
                                { value: 'needs_more_detail', label: 'Potrzebuję więcej' },
                                { value: 'good_detail', label: 'Odpowiedni' },
                                { value: 'too_detailed', label: 'Za szczegółowo' },
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setFeedback({ ...feedback, detailFeedback: opt.value as any })}
                                    className={`flex-1 px-2 py-1.5 text-xs rounded-md border transition-all ${
                                        feedback.detailFeedback === opt.value
                                            ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                                            : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Wanted mode */}
                    <div>
                        <span className="text-xs text-slate-400 block mb-2">Chciałem odpowiedź typu:</span>
                        <div className="flex gap-1.5">
                            {[
                                { value: 'quick', label: 'Quick', icon: <Zap size={12} />, color: 'amber' },
                                {
                                    value: 'standard',
                                    label: 'Standard',
                                    icon: <MessageSquare size={12} />,
                                    color: 'blue',
                                },
                                { value: 'deepStudy', label: 'Deep Study', icon: <Brain size={12} />, color: 'purple' },
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setFeedback({ ...feedback, wantedMode: opt.value as any })}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md border transition-all ${
                                        feedback.wantedMode === opt.value
                                            ? `border-${opt.color}-500/50 bg-${opt.color}-500/10 text-${opt.color}-400`
                                            : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300'
                                    }`}
                                >
                                    {opt.icon}
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom feedback */}
                    <div>
                        <span className="text-xs text-slate-400 block mb-2">Dodatkowy komentarz (opcjonalnie):</span>
                        <textarea
                            value={feedback.customFeedback || ''}
                            onChange={(e) => setFeedback({ ...feedback, customFeedback: e.target.value })}
                            placeholder="Co mogłoby być lepiej?"
                            className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:border-white/20 focus:outline-none resize-none h-16"
                        />
                    </div>

                    {/* Submit button */}
                    <div className="flex justify-between items-center pt-2">
                        <button
                            onClick={() => {
                                setExpanded(false);
                                setFeedback({});
                            }}
                            className="text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors flex items-center gap-1"
                        >
                            <X size={12} />
                            Anuluj
                        </button>
                        <button
                            onClick={handleDetailedFeedback}
                            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                        >
                            <Send size={12} />
                            Wyślij feedback
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InlineResponseFeedback;


