/**
 * AI Feedback Buttons Component
 * 
 * Allows users to provide feedback on AI responses.
 * Supports thumbs up/down and optional detailed feedback.
 */

import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, X, Check } from 'lucide-react';
import api from '../../services/api';

interface FeedbackButtonsProps {
    interactionId?: string;
    draftId?: string;
    capability: string;
    modelUsed?: string;
    onFeedbackSubmitted?: (feedback: FeedbackData) => void;
    compact?: boolean;
}

interface FeedbackData {
    type: 'HELPFUL' | 'NOT_HELPFUL' | 'ACCURATE' | 'INACCURATE' | 'RATING';
    rating?: number;
    comment?: string;
}

export function FeedbackButtons({
    interactionId,
    draftId,
    capability,
    modelUsed,
    onFeedbackSubmitted,
    compact = false
}: FeedbackButtonsProps) {
    const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null);
    const [showCommentForm, setShowCommentForm] = useState(false);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const submitFeedback = async (type: FeedbackData['type'], additionalData?: Partial<FeedbackData>) => {
        if (submitting) return;
        setSubmitting(true);

        try {
            const feedbackData: FeedbackData = {
                type,
                ...additionalData
            };

            await api.post('/ai-feedback', {
                interactionId,
                draftId,
                feedbackType: type,
                rating: additionalData?.rating,
                comment: additionalData?.comment,
                capability,
                modelUsed
            });

            setFeedbackGiven(type);
            setShowCommentForm(false);
            
            if (onFeedbackSubmitted) {
                onFeedbackSubmitted(feedbackData);
            }
        } catch (error) {
            console.error('[FeedbackButtons] Error submitting feedback:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleThumbsUp = () => {
        submitFeedback('HELPFUL');
    };

    const handleThumbsDown = () => {
        setShowCommentForm(true);
    };

    const handleCommentSubmit = () => {
        submitFeedback('NOT_HELPFUL', { comment });
    };

    if (feedbackGiven) {
        return (
            <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'} text-gray-500`}>
                <Check className="w-4 h-4 text-green-500" />
                <span>Dziękujemy za opinię!</span>
            </div>
        );
    }

    if (showCommentForm) {
        return (
            <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Co można poprawić?</span>
                    <button 
                        onClick={() => setShowCommentForm(false)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Opisz problem lub sugestię..."
                    className="w-full p-2 text-sm border rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                />
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => setShowCommentForm(false)}
                        className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                        Anuluj
                    </button>
                    <button
                        onClick={handleCommentSubmit}
                        disabled={submitting}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {submitting ? 'Wysyłanie...' : 'Wyślij'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-1 ${compact ? '' : 'gap-2'}`}>
            <span className={`text-gray-500 ${compact ? 'text-xs' : 'text-sm'}`}>
                {compact ? '' : 'Czy to było pomocne?'}
            </span>
            <button
                onClick={handleThumbsUp}
                disabled={submitting}
                className={`p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors ${
                    compact ? '' : 'p-2'
                }`}
                title="Pomocne"
            >
                <ThumbsUp className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
            </button>
            <button
                onClick={handleThumbsDown}
                disabled={submitting}
                className={`p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors ${
                    compact ? '' : 'p-2'
                }`}
                title="Niepomocne"
            >
                <ThumbsDown className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
            </button>
            {!compact && (
                <button
                    onClick={() => setShowCommentForm(true)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Dodaj komentarz"
                >
                    <MessageSquare className="w-5 h-5" />
                </button>
            )}
        </div>
    );
}

/**
 * Star Rating Component for detailed feedback
 */
export function StarRating({
    value,
    onChange,
    size = 'md'
}: {
    value: number;
    onChange: (rating: number) => void;
    size?: 'sm' | 'md' | 'lg';
}) {
    const [hover, setHover] = useState(0);

    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8'
    };

    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    onClick={() => onChange(star)}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    className="focus:outline-none"
                >
                    <svg
                        className={`${sizeClasses[size]} ${
                            star <= (hover || value)
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-300'
                        } transition-colors`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                </button>
            ))}
        </div>
    );
}

export default FeedbackButtons;








