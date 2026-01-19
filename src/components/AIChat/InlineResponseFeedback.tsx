/**
 * InlineResponseFeedback
 *
 * Inline feedback component for AI responses.
 * Shows thumbs up/down initially, then detailed options after rating.
 * Integrates with FeedbackLearningService and AILearningService for AI improvement.
 *
 * @version 3.0.0 - Extended with accuracy and helpfulness feedback
 */

import { Check, ChevronDown, ChevronUp, MessageSquare, ThumbsDown, ThumbsUp, X } from 'lucide-react';
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
  // Extended props for learning
  query?: string;
  response?: string;
  modelUsed?: string;
  instructionsUsed?: string[];
}

type LengthFeedback = 'too-short' | 'just-right' | 'too-long';
type DetailFeedback = 'too-little' | 'just-right' | 'too-much';
type StyleFeedback = 'too-formal' | 'just-right' | 'too-casual';
type AccuracyFeedback = 'accurate' | 'partially-accurate' | 'inaccurate';
type HelpfulnessFeedback = 'very-helpful' | 'somewhat-helpful' | 'not-helpful';

export const InlineResponseFeedback: React.FC<InlineResponseFeedbackProps> = ({
  messageId,
  conversationId,
  responseMode,
  responseLength = 0,
  workspaceContext,
  focusMode,
  onFeedback,
  compact = false,
  query,
  response,
  modelUsed,
  instructionsUsed,
}) => {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState<'positive' | 'negative' | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCommentField, setShowCommentField] = useState(false);

  // Detailed feedback
  const [lengthFeedback, setLengthFeedback] = useState<LengthFeedback | null>(null);
  const [detailFeedback, setDetailFeedback] = useState<DetailFeedback | null>(null);
  const [styleFeedback, setStyleFeedback] = useState<StyleFeedback | null>(null);
  const [accuracyFeedback, setAccuracyFeedback] = useState<AccuracyFeedback | null>(null);
  const [helpfulnessFeedback, setHelpfulnessFeedback] = useState<HelpfulnessFeedback | null>(null);
  const [comment, setComment] = useState('');

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

    // Send to legacy learning service
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

    // Send extended feedback to new AILearningService
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/ai/learning/interaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: conversationId || '',
          messageId,
          query,
          response,
          rating: r,
          lengthFeedback: lengthFeedback || undefined,
          detailFeedback: detailFeedback || undefined,
          styleFeedback: styleFeedback || undefined,
          accuracyFeedback: accuracyFeedback || undefined,
          helpfulnessFeedback: helpfulnessFeedback || undefined,
          comment: comment || undefined,
          responseLength,
          focusMode,
          workspaceContext,
          modelUsed,
          instructionsUsed,
        }),
      });
    } catch (error) {
      // Silently fail - don't interrupt user experience
      console.warn('Failed to send extended feedback:', error);
    }
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
            className="p-1 rounded transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 dark:text-slate-500 hover:text-red-500"
            title={t('chat.actions.notHelpful', 'Niepomocne')}
          >
            <ThumbsDown size={12} />
          </button>
        </div>
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

      {/* Accuracy feedback - NEW */}
      <div className="space-y-1">
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          {t('chat.feedback.accuracy', 'Dokładność informacji:')}
        </span>
        <div className="flex gap-1">
          {(['accurate', 'partially-accurate', 'inaccurate'] as AccuracyFeedback[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setAccuracyFeedback(opt)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                accuracyFeedback === opt
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {opt === 'accurate' && t('chat.feedback.accurate', 'Dokładne')}
              {opt === 'partially-accurate' && t('chat.feedback.partiallyAccurate', 'Częściowo')}
              {opt === 'inaccurate' && t('chat.feedback.inaccurate', 'Niedokładne')}
            </button>
          ))}
        </div>
      </div>

      {/* Helpfulness feedback - NEW */}
      <div className="space-y-1">
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          {t('chat.feedback.helpfulness', 'Przydatność:')}
        </span>
        <div className="flex gap-1">
          {(['very-helpful', 'somewhat-helpful', 'not-helpful'] as HelpfulnessFeedback[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setHelpfulnessFeedback(opt)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                helpfulnessFeedback === opt
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {opt === 'very-helpful' && t('chat.feedback.veryHelpful', 'Bardzo')}
              {opt === 'somewhat-helpful' && t('chat.feedback.somewhatHelpful', 'Trochę')}
              {opt === 'not-helpful' && t('chat.feedback.notHelpful', 'Wcale')}
            </button>
          ))}
        </div>
      </div>

      {/* Comment field toggle - NEW */}
      <div className="space-y-1">
        <button
          onClick={() => setShowCommentField(!showCommentField)}
          className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <MessageSquare size={10} />
          {showCommentField 
            ? t('chat.feedback.hideComment', 'Ukryj komentarz')
            : t('chat.feedback.addComment', 'Dodaj komentarz')
          }
        </button>
        {showCommentField && (
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('chat.feedback.commentPlaceholder', 'Opisz co było nie tak...')}
            className="w-full px-2 py-1.5 text-[10px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded resize-none"
            rows={2}
          />
        )}
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
