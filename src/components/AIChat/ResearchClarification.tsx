/**
 * ResearchClarification Component
 *
 * Modal/inline component that shows clarification questions before starting
 * deep research. Inspired by ChatGPT Research mode's clarification flow.
 *
 * When user enables Deep Research and sends a message, this component:
 * 1. Fetches 2-3 clarification questions from the backend
 * 2. Displays them as multi-choice options
 * 3. User can answer or skip ("Start research now")
 * 4. Answers are passed as clarificationAnswers in the research context
 */

import { ChevronRight, HelpCircle, Loader2, Search, SkipForward, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

// ==========================================
// TYPES
// ==========================================

interface ClarificationQuestion {
  id: string;
  question: string;
  options: string[];
}

interface ResearchClarificationProps {
  /** The user's message to research */
  message: string;
  /** Called when user completes or skips clarification */
  onComplete: (answers: Record<string, string> | null) => void;
  /** Called to cancel */
  onCancel: () => void;
  /** Custom class */
  className?: string;
}

// ==========================================
// COMPONENT
// ==========================================

export const ResearchClarification: React.FC<ResearchClarificationProps> = ({
  message,
  onComplete,
  onCancel,
  className = '',
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [researchType, setResearchType] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Fetch clarification questions on mount
  useEffect(() => {
    let cancelled = false;

    const fetchQuestions = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await Api.deepResearchClarify(message);

        if (cancelled) return;

        if (result.success && result.questions && result.questions.length > 0) {
          setQuestions(result.questions);
          setResearchType(result.researchType || '');
        } else {
          // No questions generated — skip clarification
          onComplete(null);
        }
      } catch (err: any) {
        if (cancelled) return;
        console.warn('[ResearchClarification] Failed to fetch questions:', err);
        // On error, skip clarification and proceed with research
        onComplete(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchQuestions();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  const handleOptionSelect = useCallback((questionId: string, option: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: option,
    }));
  }, []);

  const handleSubmit = useCallback(() => {
    // Convert answers map to question:answer format
    const formattedAnswers: Record<string, string> = {};
    for (const q of questions) {
      if (answers[q.id]) {
        formattedAnswers[q.question] = answers[q.id];
      }
    }
    onComplete(Object.keys(formattedAnswers).length > 0 ? formattedAnswers : null);
  }, [answers, questions, onComplete]);

  const handleSkip = useCallback(() => {
    onComplete(null);
  }, [onComplete]);

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]);

  // Loading state
  if (loading) {
    return (
      <div
        className={`bg-gradient-to-br from-crimson-50 to-primary-50 dark:from-navy-800 dark:to-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800/50 p-4 ${className}`}
      >
        <div className="flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-primary-500" />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {t('research.preparingQuestions', 'Preparing research scope...')}
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800/50 p-4 ${className}`}
      >
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        <button onClick={handleSkip} className="mt-2 text-xs text-rose-500 hover:underline">
          {t('research.skipAndSearch', 'Skip and start research')}
        </button>
      </div>
    );
  }

  // No questions — should not render (onComplete was already called)
  if (questions.length === 0) return null;

  return (
    <div
      className={`bg-gradient-to-br from-crimson-50 to-primary-50 dark:from-navy-800 dark:to-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800/50 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-primary-100 dark:border-primary-800/30">
        <div className="p-1.5 bg-primary-100 dark:bg-primary-900/50 rounded-lg">
          <HelpCircle size={16} className="text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('research.focusResearch', 'Focus your research')}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              'research.focusDescription',
              'Answer these questions to get more targeted results, or skip to search broadly.'
            )}
          </p>
        </div>
        {researchType && (
          <span className="ml-auto text-[10px] px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium capitalize">
            {researchType.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Questions */}
      <div className="p-4 space-y-4">
        {questions.map((q, qIndex) => (
          <div key={q.id}>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              {qIndex + 1}. {q.question}
            </p>
            <div className="flex flex-wrap gap-2">
              {q.options.map((option) => (
                <button
                  key={option}
                  onClick={() => handleOptionSelect(q.id, option)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                    answers[q.id] === option
                      ? 'bg-primary-100 dark:bg-primary-900/50 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300 font-medium shadow-sm'
                      : 'bg-white dark:bg-navy-700 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:border-primary-200 dark:hover:border-primary-800'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-primary-100 dark:border-primary-800/30 bg-white/50 dark:bg-navy-900/30">
        <button
          onClick={onCancel}
          className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          {t('common.cancel', 'Cancel')}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSkip}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
          >
            <SkipForward size={12} />
            {t('research.skipSearchBroadly', 'Skip & search broadly')}
          </button>

          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
              allAnswered
                ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            <Search size={12} />
            {t('research.startFocusedResearch', 'Start focused research')}
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResearchClarification;
