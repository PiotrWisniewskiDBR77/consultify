/**
 * Help Feedback Widget Component
 *
 * "Was this helpful?" widget for collecting user feedback on help content.
 * Includes helpful/not helpful buttons and optional comment field.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Check, MessageSquare, Send, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

type FeedbackContentType = 'module' | 'card' | 'faq' | 'video';

interface HelpFeedbackWidgetProps {
  contentType: FeedbackContentType;
  contentId: string;
  compact?: boolean;
  className?: string;
  onFeedbackSubmit?: (isHelpful: boolean) => void;
}

export const HelpFeedbackWidget: React.FC<HelpFeedbackWidgetProps> = ({
  contentType,
  contentId,
  compact = false,
  className = '',
  onFeedbackSubmit,
}) => {
  const { t, i18n } = useTranslation();
  const HELP_LANGS = ['en', 'pl', 'de', 'ar', 'ja', 'es'];
  const baseLang = (i18n.language || 'en').split('-')[0].toLowerCase();
  const lang = HELP_LANGS.includes(baseLang) ? baseLang : 'en';

  const [submitted, setSubmitted] = useState(false);
  const [isHelpful, setIsHelpful] = useState<boolean | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Translations derived from i18n
  const tTrans = {
    title: t('help.feedback.title'),
    yes: t('help.feedback.yes'),
    no: t('help.feedback.no'),
    addComment: t('help.feedback.addComment'),
    commentPlaceholder: t('help.feedback.commentPlaceholder'),
    submit: t('help.feedback.submit'),
    skip: t('help.feedback.skip'),
    thanks: t('help.feedback.thanks'),
    error: t('help.feedback.error'),
  };

  // Submit feedback
  const submitFeedback = async (helpful: boolean, feedbackComment?: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await Api.post('/api/help/feedback', {
        contentType,
        contentId,
        isHelpful: helpful,
        comment: feedbackComment,
        metadata: {
          url: window.location.pathname,
          timestamp: new Date().toISOString(),
        },
      });

      setSubmitted(true);
      setIsHelpful(helpful);
      onFeedbackSubmit?.(helpful);

      // Track analytics event
      try {
        await Api.post('/api/help/analytics/event', {
          eventType: 'feedback_submit',
          contentType,
          contentId,
          metadata: { isHelpful: helpful, hasComment: !!feedbackComment },
        });
      } catch {
        // Ignore analytics errors
      }
    } catch (err) {
      console.error('[HelpFeedback] Error:', err);
      setError(tTrans.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle button click
  const handleClick = (helpful: boolean) => {
    if (submitted) return;

    setIsHelpful(helpful);

    if (!helpful) {
      // Show comment field for negative feedback
      setShowComment(true);
    } else {
      // Submit immediately for positive feedback
      submitFeedback(true);
    }
  };

  // Handle comment submit
  const handleCommentSubmit = () => {
    if (isHelpful === null) return;
    submitFeedback(isHelpful, comment);
  };

  // Compact version
  if (compact) {
    if (submitted) {
      return (
        <div
          className={`flex items-center gap-2 text-green-600 dark:text-green-400 text-sm ${className}`}
        >
          <Check size={16} />
          <span>{tTrans.thanks}</span>
        </div>
      );
    }

    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-sm text-slate-500 dark:text-slate-400">{tTrans.title}</span>
        <button
          onClick={() => handleClick(true)}
          disabled={isSubmitting}
          className="p-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors disabled:opacity-50"
          title={tTrans.yes}
        >
          <ThumbsUp size={16} />
        </button>
        <button
          onClick={() => handleClick(false)}
          disabled={isSubmitting}
          className="p-1.5 rounded-lg hover:bg-danger-100 dark:hover:bg-danger-900/30 text-slate-500 dark:text-slate-400 hover:text-danger-600 dark:hover:text-danger-400 transition-colors disabled:opacity-50"
          title={tTrans.no}
        >
          <ThumbsDown size={16} />
        </button>
      </div>
    );
  }

  // Full version
  return (
    <div className={`bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 ${className}`}>
      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="thanks"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 justify-center py-2"
          >
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check size={18} className="text-green-600 dark:text-green-400" />
            </div>
            <span className="text-green-600 dark:text-green-400 font-medium">{tTrans.thanks}</span>
          </motion.div>
        ) : showComment ? (
          <motion.div
            key="comment"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {tTrans.addComment}
              </span>
              <button
                onClick={() => setShowComment(false)}
                className="p-1 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={tTrans.commentPlaceholder}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
            />

            {error && <p className="text-sm text-danger-500">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => submitFeedback(false)}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {t('common.skip', 'Skip')}
              </button>
              <button
                onClick={handleCommentSubmit}
                disabled={isSubmitting || !comment.trim()}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50"
              >
                <Send size={14} />
                {tTrans.submit}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="buttons"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <p className="text-center text-sm font-medium text-slate-700 dark:text-slate-300">
              {tTrans.title}
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handleClick(true)}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 text-slate-700 dark:text-slate-300 hover:text-green-600 dark:hover:text-green-400 transition-all disabled:opacity-50"
              >
                <ThumbsUp size={18} />
                <span>{tTrans.yes}</span>
              </button>

              <button
                onClick={() => handleClick(false)}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 text-slate-700 dark:text-slate-300 hover:text-danger-600 dark:hover:text-danger-400 transition-all disabled:opacity-50"
              >
                <ThumbsDown size={18} />
                <span>{tTrans.no}</span>
              </button>
            </div>

            {error && <p className="text-center text-sm text-danger-500">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HelpFeedbackWidget;
