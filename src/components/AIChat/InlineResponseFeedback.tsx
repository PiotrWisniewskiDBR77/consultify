/**
 * InlineResponseFeedback
 *
 * Inline feedback component for AI responses.
 * Shows thumbs up/down initially, then detailed options after rating.
 * Integrates with FeedbackLearningService for AI improvement.
 *
 * @version 2.0.0
 */

import { Check, ChevronDown, ChevronUp, ThumbsDown, ThumbsUp } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FeedbackLearningService } from '../../services/feedbackLearningService';
import { ResponseFeedback } from '../../types';

interface InlineResponseFeedbackProps {
  messageId: string;
  conversationId?: string;
  responseMode?: string;
  responseLength?: number;
  workspaceContext?: string;
  focusMode?: string;
  onFeedback: (feedback: ResponseFeedback) => void;
  compact?: boolean;
}

type LengthFeedback = 'too_short' | 'just_right' | 'too_long';
type DetailFeedback = 'too_basic' | 'just_right' | 'too_detailed';
type StyleFeedback = 'too-formal' | 'just-right' | 'too-casual';

export const InlineResponseFeedback: React.FC<InlineResponseFeedbackProps> = ({
  messageId,
  conversationId,
  responseMode,
  responseLength = 0,
  workspaceContext,
  focusMode,
  onFeedback,
  compact = false,
}) => {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState<'positive' | 'negative' | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Detailed feedback
  const [lengthFeedback, setLengthFeedback] = useState<LengthFeedback | null>(null);
  const [detailFeedback, setDetailFeedback] = useState<DetailFeedback | null>(null);
  const [styleFeedback, setStyleFeedback] = useState<StyleFeedback | null>(null);

  const handleInitialRating = (r: 'positive' | 'negative') => {
    setRating(r);

    // For positive feedback, submit immediately but show option for details
    if (r === 'positive') {
      submitFeedback(r);
      setShowDetails(false);
    } else {
      // For negative, show detailed options
      setShowDetails(true);
    }
  };

  const submitFeedback = async (r: 'positive' | 'negative') => {
    setSubmitted(true);

    const feedback: ResponseFeedback = {
      rating: r,
      lengthFeedback: lengthFeedback || undefined,
      detailFeedback: detailFeedback || undefined,
      timestamp: new Date(),
    };

    // Send to parent
    onFeedback(feedback);

    // Send to learning service
    await FeedbackLearningService.submitFeedback({
      messageId,
      conversationId: conversationId || '',
      rating: r,
      lengthFeedback: lengthFeedback || undefined,
      detailFeedback: detailFeedback || undefined,
      styleFeedback: styleFeedback || undefined,
      responseLength,
      focusMode,
      workspaceContext,
    });
  };

  const handleSubmitDetailed = () => {
    if (rating) {
      submitFeedback(rating);
    }
  };

  // Submitted state
  if (submitted) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 animate-fade-in py-1">
        <Check size={10} className="text-green-500" />
        {t('chat.feedback.thankYou', 'Dziękujemy za opinię!')}
      </div>
    );
  }

  // Initial thumbs up/down
  if (!rating || (rating === 'positive' && !showDetails)) {
    return (
      <div className={`flex items-center gap-2 py-1 ${compact ? 'scale-90 origin-left' : ''}`}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleInitialRating('positive')}
            className={`p-1 rounded transition-colors ${
              rating === 'positive'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-500'
                : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-slate-400 dark:text-slate-500 hover:text-green-500'
            }`}
            title={t('chat.actions.helpful', 'Pomocne')}
          >
            <ThumbsUp size={12} />
          </button>
          <button
            onClick={() => handleInitialRating('negative')}
            className={`p-1 rounded transition-colors ${
              rating === 'negative'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-500'
                : 'hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 dark:text-slate-500 hover:text-red-500'
            }`}
            title={t('chat.actions.notHelpful', 'Niepomocne')}
          >
            <ThumbsDown size={12} />
          </button>
        </div>
      );
    }

    // Check if rating is negative (for type narrowing)
    if (rating !== 'negative') {
      return null;
    }
      </div>
    );
  }

  // Detailed feedback form (after negative rating)
  return (
    <div className="py-2 space-y-2 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
          {t('chat.feedback.helpUsImprove', 'Pomóż nam się poprawić')}
        </span>
        <button
          onClick={() => {
            setRating(null);
            setShowDetails(false);
          }}
          className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          {t('common.cancel', 'Anuluj')}
        </button>
      </div>

      {/* Length feedback */}
      <div className="space-y-1">
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          {t('chat.feedback.length', 'Długość odpowiedzi:')}
        </span>
        <div className="flex gap-1">
          {(['too-short', 'just-right', 'too-long'] as LengthFeedback[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setLengthFeedback(opt)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                lengthFeedback === opt
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {opt === 'too-short' && t('chat.feedback.tooShort', 'Za krótka')}
              {opt === 'just-right' && t('chat.feedback.justRight', 'W sam raz')}
              {opt === 'too-long' && t('chat.feedback.tooLong', 'Za długa')}
            </button>
          ))}
        </div>
      </div>

      {/* Detail feedback */}
      <div className="space-y-1">
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          {t('chat.feedback.detail', 'Poziom szczegółowości:')}
        </span>
        <div className="flex gap-1">
          {(['too-little', 'just-right', 'too-much'] as DetailFeedback[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setDetailFeedback(opt)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                detailFeedback === opt
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {opt === 'too-little' && t('chat.feedback.tooLittle', 'Za mało')}
              {opt === 'just-right' && t('chat.feedback.justRight', 'W sam raz')}
              {opt === 'too-much' && t('chat.feedback.tooMuch', 'Za dużo')}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmitDetailed}
        className="w-full px-3 py-1.5 text-[11px] font-medium bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
      >
        {t('chat.feedback.submit', 'Wyślij opinię')}
      </button>
    </div>
  );
};

export default InlineResponseFeedback;
