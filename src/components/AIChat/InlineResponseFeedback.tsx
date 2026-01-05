import { ThumbsDown, ThumbsUp } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ResponseFeedback } from '../../types';

interface InlineResponseFeedbackProps {
    messageId: string;
    conversationId?: string;
    responseMode?: string;
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
    const [submitted, setSubmitted] = useState(false);
    const [rating, setRating] = useState<'positive' | 'negative' | null>(null);

    const handleRating = (r: 'positive' | 'negative') => {
        setRating(r);
        setSubmitted(true);
        onFeedback({
            rating: r,
            timestamp: new Date(),
        } as ResponseFeedback);
    };

    if (submitted) {
        return (
            <div className="text-[10px] text-slate-500 animate-fade-in py-1">
                {t('chat.feedback.thankYou', 'Thank you for your feedback!')}
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-2 py-1 ${compact ? 'scale-90 origin-left' : ''}`}>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                {t('chat.feedback.rateResponse', 'Rate Response')}
            </span>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => handleRating('positive')}
                    className="p-1 rounded hover:bg-green-50 dark:hover:bg-green-900/20 text-slate-400 hover:text-green-500 transition-colors"
                    title={t('chat.actions.helpful', 'Helpful')}
                >
                    <ThumbsUp size={12} />
                </button>
                <button
                    onClick={() => handleRating('negative')}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                    title={t('chat.actions.notHelpful', 'Not helpful')}
                >
                    <ThumbsDown size={12} />
                </button>
            </div>
        </div>
    );
};

export default InlineResponseFeedback;
