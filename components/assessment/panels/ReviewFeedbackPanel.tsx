/**
 * ReviewFeedbackPanel
 * 
 * Slide-in panel for reviewers to submit their assessment review.
 * Includes:
 * - Star rating (1-5)
 * - General feedback/comments
 * - Per-axis comments (optional)
 * - Recommendation (Approve/Reject/Request Changes)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    X,
    Star,
    MessageSquare,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Loader2,
    ChevronDown,
    ChevronUp,
    Send
} from 'lucide-react';

// DRD Axis labels
const AXIS_LABELS: Record<string, string> = {
    processes: 'Procesy',
    digitalProducts: 'Produkty Cyfrowe',
    businessModels: 'Modele Biznesowe',
    dataManagement: 'Zarządzanie Danymi',
    culture: 'Kultura',
    cybersecurity: 'Cyberbezpieczeństwo',
    aiMaturity: 'Dojrzałość AI'
};

type Recommendation = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';

interface ReviewFeedbackPanelProps {
    reviewId: string;
    assessmentId: string;
    assessmentName: string;
    isOpen: boolean;
    onClose: () => void;
    onSubmitted: () => void;
}

export const ReviewFeedbackPanel: React.FC<ReviewFeedbackPanelProps> = ({
    reviewId,
    assessmentId,
    assessmentName,
    isOpen,
    onClose,
    onSubmitted
}) => {
    const panelRef = useRef<HTMLDivElement>(null);

    // State
    const [rating, setRating] = useState<number>(0);
    const [hoverRating, setHoverRating] = useState<number>(0);
    const [comments, setComments] = useState('');
    const [axisComments, setAxisComments] = useState<Record<string, string>>({});
    const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
    const [showAxisComments, setShowAxisComments] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when panel is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Handle axis comment change
    const handleAxisCommentChange = useCallback((axisId: string, comment: string) => {
        setAxisComments(prev => ({
            ...prev,
            [axisId]: comment
        }));
    }, []);

    // Submit review
    const handleSubmit = async () => {
        if (!recommendation) {
            setError('Wybierz rekomendację');
            return;
        }

        if (recommendation === 'REJECT' && !comments.trim()) {
            setError('Podaj uzasadnienie odrzucenia');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/assessment-workflow/reviews/${reviewId}/submit`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rating: rating || null,
                    comments: comments.trim(),
                    axisComments: Object.fromEntries(
                        Object.entries(axisComments).filter(([_, v]) => v.trim())
                    ),
                    recommendation
                })
            });

            if (response.ok) {
                setSuccess(true);
                setTimeout(() => {
                    onSubmitted();
                    onClose();
                }, 1500);
            } else {
                const data = await response.json();
                setError(data.error || 'Nie udało się wysłać recenzji');
            }
        } catch (err) {
            console.error('[ReviewFeedbackPanel] Submit error:', err);
            setError('Błąd połączenia');
        } finally {
            setSubmitting(false);
        }
    };

    // Recommendation config
    const recommendations: { id: Recommendation; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
        {
            id: 'APPROVE',
            label: 'Zatwierdź',
            icon: <CheckCircle2 size={20} />,
            color: 'text-green-600 dark:text-green-400',
            bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-500/30'
        },
        {
            id: 'REQUEST_CHANGES',
            label: 'Poproś o zmiany',
            icon: <AlertTriangle size={20} />,
            color: 'text-amber-600 dark:text-amber-400',
            bgColor: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/30'
        },
        {
            id: 'REJECT',
            label: 'Odrzuć',
            icon: <XCircle size={20} />,
            color: 'text-red-600 dark:text-red-400',
            bgColor: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/30'
        }
    ];

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Panel */}
            <div
                ref={panelRef}
                className={`
                    fixed top-0 right-0 h-full w-full max-w-lg bg-white dark:bg-navy-900 shadow-2xl z-50
                    transform transition-transform duration-300 ease-out
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                `}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-white/10">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-navy-900 dark:text-white">
                                    Wystawienie Recenzji
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {assessmentName}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {success ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mb-4">
                                    <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                                </div>
                                <p className="text-lg font-medium text-navy-900 dark:text-white">
                                    Recenzja wysłana!
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Dziękujemy za Twoją opinię
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Star Rating */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Ogólna ocena (opcjonalna)
                                    </label>
                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => setRating(star)}
                                                onMouseEnter={() => setHoverRating(star)}
                                                onMouseLeave={() => setHoverRating(0)}
                                                className="p-1 transition-transform hover:scale-110"
                                            >
                                                <Star
                                                    size={28}
                                                    className={`transition-colors ${
                                                        star <= (hoverRating || rating)
                                                            ? 'text-amber-400 fill-amber-400'
                                                            : 'text-slate-300 dark:text-slate-600'
                                                    }`}
                                                />
                                            </button>
                                        ))}
                                        {rating > 0 && (
                                            <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                                                {rating}/5
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Recommendation */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Twoja rekomendacja <span className="text-red-500">*</span>
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {recommendations.map((rec) => (
                                            <button
                                                key={rec.id}
                                                onClick={() => setRecommendation(rec.id)}
                                                className={`
                                                    flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                                                    ${recommendation === rec.id
                                                        ? rec.bgColor + ' border-current'
                                                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                                                    }
                                                `}
                                            >
                                                <span className={recommendation === rec.id ? rec.color : 'text-slate-400'}>
                                                    {rec.icon}
                                                </span>
                                                <span className={`text-xs font-medium ${
                                                    recommendation === rec.id ? rec.color : 'text-slate-600 dark:text-slate-400'
                                                }`}>
                                                    {rec.label}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* General Comments */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Komentarze i feedback
                                        {recommendation === 'REJECT' && <span className="text-red-500"> *</span>}
                                    </label>
                                    <textarea
                                        value={comments}
                                        onChange={(e) => setComments(e.target.value)}
                                        placeholder="Twoje uwagi do całego assessmentu..."
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                {/* Per-Axis Comments (Collapsible) */}
                                <div>
                                    <button
                                        onClick={() => setShowAxisComments(!showAxisComments)}
                                        className="flex items-center justify-between w-full py-2 text-sm font-medium text-slate-700 dark:text-slate-300"
                                    >
                                        <span className="flex items-center gap-2">
                                            <MessageSquare size={16} />
                                            Komentarze do poszczególnych osi
                                        </span>
                                        {showAxisComments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>

                                    {showAxisComments && (
                                        <div className="mt-3 space-y-3">
                                            {Object.entries(AXIS_LABELS).map(([axisId, label]) => (
                                                <div key={axisId}>
                                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                                        {label}
                                                    </label>
                                                    <textarea
                                                        value={axisComments[axisId] || ''}
                                                        onChange={(e) => handleAxisCommentChange(axisId, e.target.value)}
                                                        placeholder={`Komentarz do ${label}...`}
                                                        rows={2}
                                                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Error */}
                                {error && (
                                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-sm">
                                        <AlertTriangle size={16} />
                                        {error}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    {!success && (
                        <div className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 rounded-lg font-medium hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                                >
                                    Anuluj
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={!recommendation || submitting}
                                    className={`
                                        flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all
                                        ${recommendation && !submitting
                                            ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                        }
                                    `}
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Wysyłam...
                                        </>
                                    ) : (
                                        <>
                                            <Send size={16} />
                                            Wyślij recenzję
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

