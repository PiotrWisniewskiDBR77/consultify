/**
 * InlineResponseFeedback
 *
 * Inline feedback component for AI responses.
 * Shows thumbs up/down initially, then detailed options after rating.
 * Integrates with FeedbackLearningService for AI improvement.
 *
 * Extended in v3.0.0 with:
 * - Actionability rating (1-5)
 * - Accuracy rating (1-5)
 * - Expected format selection
 * - Missing info textarea
 *
 * @version 3.0.0
 */

import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FeedbackLearningService } from '../../services/feedbackLearningService';
import { MessageFeedback, ResponseFeedback } from '../../types';

interface InlineResponseFeedbackProps {
  messageId: string;
  conversationId?: string;
  responseMode?: string;
  responseLength?: number;
  workspaceContext?: string;
  focusMode?: string;
  screenContext?: string;
  onFeedback: (feedback: ResponseFeedback) => void;
  compact?: boolean;
  thumbsOnly?: boolean;
  /**
   * M01-P03 §7 — "Feedback: zapis → hard reload → wartość zachowana".
   * Rating/`submitted` used to always start blank on mount, so a fresh
   * reopen showed the same "rate this" prompt even for a message the user
   * had already rated in a prior session — nothing round-tripped the saved
   * value back into the UI. When the caller has a persisted rating for this
   * message (`msg.feedback` on `ChatMessage`), pass it here so the initial
   * render is honest about "already rated" instead of re-asking.
   *
   * M01-P03B (2026-08-05) — the gap this prop was built ahead of is now
   * closed: `GET /api/conversations/:id` in `conversations.routes.ts` joins
   * the caller's own rating from `ai_response_feedback` onto each message,
   * so `msg.feedback` is populated on real data and this prop now actually
   * hydrates on reopen. See the M01-P03B report for the full trace,
   * including a root-cause correction: the original M01-036 finding named
   * `ai_feedback` as the table to join, but that table receives zero rows
   * from this component's write path (InlineResponseFeedback ->
   * feedbackLearningService -> POST /api/ai-feedback/response ->
   * adaptiveResponseService.processFeedback inserts into
   * `ai_response_feedback` instead) — joining `ai_feedback` would have
   * compiled and run but stayed permanently empty.
   */
  existingFeedback?: MessageFeedback | null;
}

type LengthFeedback = 'too-short' | 'just-right' | 'too-long';
type DetailFeedback = 'too-little' | 'just-right' | 'too-much';
type StyleFeedback = 'too-formal' | 'just-right' | 'too-casual';
type FormatPreference = 'bullets' | 'paragraphs' | 'structured' | 'conversational';

/**
 * M01-P03B (coordinator fix-required, 2026-08-05) — explicit save-status
 * state machine, replacing the old boolean `submitted`. The old code called
 * `setSubmitted(true)` SYNCHRONOUSLY, before the network call to
 * `feedbackLearningService.submitFeedback()` had even started, let alone
 * resolved — combined with that service swallowing the POST's rejection,
 * a failed save (500) and a forbidden save (403) rendered IDENTICALLY to a
 * real success. That is a false-success (P1) per the packet's explicit
 * "brak atrap success:true" requirement. `saved` is now reachable ONLY
 * after the backend call actually resolves.
 */
type SubmitStatus = 'idle' | 'saving' | 'saved' | 'error' | 'forbidden';

export const InlineResponseFeedback: React.FC<InlineResponseFeedbackProps> = ({
  messageId,
  conversationId,
  responseMode,
  responseLength = 0,
  workspaceContext,
  focusMode,
  screenContext,
  onFeedback,
  compact = false,
  thumbsOnly = false,
  existingFeedback = null,
}) => {
  const { t } = useTranslation();
  // Lazy initializers: hydrate from a persisted rating the moment one is
  // available (fresh reopen), instead of always starting blank and letting
  // the user re-rate a message they already rated.
  const [status, setStatus] = useState<SubmitStatus>(() =>
    existingFeedback?.rating ? 'saved' : 'idle'
  );
  const [rating, setRating] = useState<'positive' | 'negative' | null>(
    () => existingFeedback?.rating ?? null
  );
  const [showDetails, setShowDetails] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Basic feedback
  const [lengthFeedback, setLengthFeedback] = useState<LengthFeedback | null>(null);
  const [detailFeedback, setDetailFeedback] = useState<DetailFeedback | null>(null);
  const [styleFeedback, setStyleFeedback] = useState<StyleFeedback | null>(null);

  // Advanced feedback (new in v3.0)
  const [actionability, setActionability] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [expectedFormat, setExpectedFormat] = useState<FormatPreference | null>(null);
  const [missingInfo, setMissingInfo] = useState<string>('');

  const handleInitialRating = (r: 'positive' | 'negative') => {
    setRating(r);

    if (thumbsOnly) {
      submitFeedback(r);
      return;
    }

    // C8.1 / C8.2: Both positive and negative feedback show detail options
    if (r === 'positive') {
      // C8.2: For positive feedback, submit immediately but show optional "what was good" form
      submitFeedback(r);
      setShowDetails(true);
    } else {
      // C8.1: For negative, show detailed options to understand what went wrong
      setShowDetails(true);
    }
  };

  const submitFeedback = async (r: 'positive' | 'negative') => {
    setRating(r);
    setStatus('saving');

    const feedback: ResponseFeedback = {
      rating: r,
      lengthFeedback: lengthFeedback || undefined,
      detailFeedback: detailFeedback || undefined,
      actionability: actionability || undefined,
      accuracy: accuracy || undefined,
      expectedFormat: expectedFormat || undefined,
      missingInfo: missingInfo || undefined,
      timestamp: new Date(),
    };

    // Send to parent — UnifiedChatPanel.handleFeedback runs its OWN,
    // separate POST to /api/ai-feedback/response (own try/catch, own
    // console.error). That is a different, pre-existing call chain outside
    // this component's file ownership; this component's saved/error/
    // forbidden state below is governed ONLY by the call it owns, directly
    // below.
    onFeedback(feedback);

    // Send to learning service — this call now actually gates "saved":
    // see feedbackLearningService.submitFeedback()'s M01-P03B comment for
    // why it no longer swallows the error.
    try {
      await FeedbackLearningService.submitFeedback({
        messageId,
        conversationId: conversationId || '',
        rating: r,
        lengthFeedback: lengthFeedback || undefined,
        detailFeedback: detailFeedback || undefined,
        styleFeedback: styleFeedback || undefined,
        actionability: actionability || undefined,
        accuracy: accuracy || undefined,
        expectedFormat: expectedFormat || undefined,
        missingInfo: missingInfo || undefined,
        responseLength,
        focusMode,
        workspaceContext,
        screenContext,
      });
      setStatus('saved');
    } catch (err: any) {
      // Api.aiFeedback() -> handleResponse() attaches `.status` to the
      // thrown Error (same convention as ~50 other Api.* call sites) so a
      // denied request can be told apart from a 500 (save genuinely failed)
      // or a network error, which ARE worth retrying.
      //
      // Both 403 and 404 are treated as "denied, do not retry": the
      // ownership check this packet added on POST /api/ai-feedback/response
      // (see ai-feedback.routes.ts) deliberately returns 404 "Message not
      // found" for BOTH "doesn't exist" and "not yours" — a no-existence-
      // oracle pattern (same as the attachment ACL elsewhere in this
      // module), not a bug. 403 is kept here too for forward/defensive
      // compatibility with any endpoint that does distinguish them.
      // Retrying either with the identical request would fail identically.
      const httpStatus = typeof err?.status === 'number' ? err.status : undefined;
      setStatus(httpStatus === 403 || httpStatus === 404 ? 'forbidden' : 'error');
    }
  };

  const handleSubmitDetailed = () => {
    if (rating) {
      submitFeedback(rating);
    }
  };

  // Rating slider component
  const RatingSlider: React.FC<{
    value: number | null;
    onChange: (v: number) => void;
    label: string;
    lowLabel: string;
    highLabel: string;
  }> = ({ value, onChange, label, lowLabel, highLabel }) => (
    <div className="space-y-1">
      <span className="text-[10px] text-slate-500 dark:text-slate-400">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-slate-600 w-12">{lowLabel}</span>
        <div className="flex gap-0.5 flex-1 justify-center">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={`w-6 h-6 text-[10px] rounded transition-colors ${
                value === n
                  ? 'bg-navy-900 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="text-[9px] text-slate-600 w-12 text-right">{highLabel}</span>
      </div>
    </div>
  );

  // Saving — shown while the POST to /api/ai-feedback/response is in
  // flight, i.e. BEFORE we know whether it actually succeeded. This state
  // is what closes the false-success gap: previously there was no gap
  // between "clicked" and "shown as saved" at all.
  if (status === 'saving') {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 py-1">
        <Loader2 size={10} className="animate-spin" />
        {t('aiChat.feedback.saving', 'Zapisywanie…')}
      </div>
    );
  }

  // Error / forbidden — the save genuinely did not go through. M01-P03B
  // (coordinator fix-required): before this, both of these rendered
  // identically to `saved` ("Thank you for your feedback!"), which is a
  // confirmed false-success. `forbidden` (403, or 404 — the ownership check
  // this packet added on POST /api/ai-feedback/response deliberately
  // returns 404 "Message not found" for BOTH "doesn't exist" and "not
  // yours", a no-existence-oracle pattern, so the copy below stays
  // non-committal instead of claiming "no permission" specifically) has no
  // retry: resubmitting the exact same request will fail the exact same
  // way. `error` (500 / network) does, reusing whatever length/detail/
  // advanced values are still in state.
  if (status === 'error' || status === 'forbidden') {
    return (
      <div className="flex items-center gap-1.5 text-[10px] py-1" data-testid="feedback-error-state">
        <AlertCircle size={10} className="text-danger-500 shrink-0" />
        <span className="text-danger-600 dark:text-danger-400">
          {status === 'forbidden'
            ? t('aiChat.feedback.forbidden', 'Nie można zapisać oceny dla tej wiadomości.')
            : t('aiChat.feedback.saveFailed', 'Nie udało się zapisać oceny.')}
        </span>
        {status === 'error' && rating && (
          <button
            onClick={() => submitFeedback(rating)}
            // Neutral, not crimson: `primary-*` in this codebase's tailwind
            // config IS the crimson brand color (CLAUDE.md UI rule #1) —
            // reserved for critical/destructive semantics, never a plain
            // CTA like "retry". Matches the neutral style already used by
            // the "Anuluj" cancel button just below in this same component.
            className="text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus rounded-sm"
            data-testid="feedback-retry"
          >
            {t('common.retry', 'Spróbuj ponownie')}
          </button>
        )}
      </div>
    );
  }

  // Saved — reachable ONLY after FeedbackLearningService.submitFeedback()
  // actually resolved (see submitFeedback() above).
  if (status === 'saved') {
    // M01-P03B — "selected state w UI po reopen" (packet scope): before this,
    // a fresh reopen showing a persisted positive rating and one showing a
    // persisted negative rating rendered IDENTICALLY (same generic checkmark
    // + "Thank you"), so the UI never actually told the user WHICH rating
    // they had given, only that they had rated at all. Surface the actual
    // selected thumb here too, not just on first click.
    const RatingIcon = rating === 'negative' ? ThumbsDown : rating === 'positive' ? ThumbsUp : Check;
    const ratingIconClass =
      rating === 'negative' ? 'text-danger-500' : rating === 'positive' ? 'text-green-500' : 'text-green-500';
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 animate-fade-in py-1">
        <RatingIcon size={10} className={ratingIconClass} />
        {t('aiChat.feedback.thankYou', 'Thank you for your feedback!')}
      </div>
    );
  }

  // Initial thumbs up/down (status === 'idle')
  if (!rating || (rating === 'positive' && !showDetails)) {
    return (
      <div className={`flex items-center gap-2 py-1 ${compact ? 'scale-90 origin-left' : ''}`}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleInitialRating('positive')}
            className={`p-1 rounded transition-colors ${
              rating === 'positive'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-500'
                : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-slate-600 dark:text-slate-500 hover:text-green-500'
            }`}
            title={t('aiChat.actions.helpful', 'Pomocne')}
          >
            <ThumbsUp size={12} />
          </button>
          <button
            onClick={() => handleInitialRating('negative')}
            className="p-1 rounded transition-colors hover:bg-danger-50 dark:hover:bg-danger-900/20 text-slate-600 dark:text-slate-500 hover:text-danger-500"
            title={t('aiChat.actions.notHelpful', 'Niepomocne')}
          >
            <ThumbsDown size={12} />
          </button>
        </div>
      </div>
    );
  }

  // Detailed feedback form (after positive or negative rating)
  return (
    <div className="py-2 space-y-2 animate-fade-in">
      {/* Header — C8.1/C8.2: context-aware header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
          {rating === 'positive'
            ? t('aiChat.feedback.whatWasGood', 'Co było dobre? (opcjonalnie)')
            : t('aiChat.feedback.helpUsImprove', 'Pomóż nam się poprawić')}
        </span>
        <button
          onClick={() => {
            setRating(null);
            setShowDetails(false);
            setShowAdvanced(false);
            // Defensive: this branch only renders while status is 'idle'
            // (saving/error/forbidden/saved all return earlier), so status
            // is already 'idle' here in practice — reset explicitly anyway
            // so Cancel can never leave a stale error/forbidden behind.
            setStatus('idle');
          }}
          className="text-[10px] text-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
        >
          {t('common.cancel', 'Anuluj')}
        </button>
      </div>

      {/* Length feedback */}
      <div className="space-y-1">
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          {t('aiChat.feedback.length', 'Długość odpowiedzi:')}
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
              {opt === 'too-short' && t('aiChat.feedback.tooShort', 'Za krótka')}
              {opt === 'just-right' && t('aiChat.feedback.justRight', 'W sam raz')}
              {opt === 'too-long' && t('aiChat.feedback.tooLong', 'Za długa')}
            </button>
          ))}
        </div>
      </div>

      {/* Detail feedback */}
      <div className="space-y-1">
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          {t('aiChat.feedback.detail', 'Poziom szczegółowości:')}
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
              {opt === 'too-little' && t('aiChat.feedback.tooLittle', 'Za mało')}
              {opt === 'just-right' && t('aiChat.feedback.justRight', 'W sam raz')}
              {opt === 'too-much' && t('aiChat.feedback.tooMuch', 'Za dużo')}
            </button>
          ))}
        </div>
      </div>

      {/* Toggle advanced options */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-[10px] text-primary-600 dark:text-primary-400 hover:underline"
      >
        {showAdvanced ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {t('aiChat.feedback.advancedOptions', 'Więcej opcji')}
      </button>

      {/* Advanced feedback options */}
      {showAdvanced && (
        <div className="space-y-3 pt-1 border-t border-slate-200 dark:border-slate-700">
          {/* Actionability rating */}
          <RatingSlider
            value={actionability}
            onChange={setActionability}
            label={t('aiChat.feedback.actionability', 'Przydatność:')}
            lowLabel={t('aiChat.feedback.notUseful', 'Mało')}
            highLabel={t('aiChat.feedback.veryUseful', 'Bardzo')}
          />

          {/* Accuracy rating */}
          <RatingSlider
            value={accuracy}
            onChange={setAccuracy}
            label={t('aiChat.feedback.accuracy', 'Trafność:')}
            lowLabel={t('aiChat.feedback.inaccurate', 'Nietrafna')}
            highLabel={t('aiChat.feedback.veryAccurate', 'Trafna')}
          />

          {/* Expected format */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {t('aiChat.feedback.preferredFormat', 'Preferowany format:')}
            </span>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { value: 'bullets', label: t('aiChat.feedback.formatBullets', 'Punkty') },
                  { value: 'paragraphs', label: t('aiChat.feedback.formatParagraphs', 'Akapity') },
                  {
                    value: 'structured',
                    label: t('aiChat.feedback.formatStructured', 'Strukturalny'),
                  },
                  {
                    value: 'conversational',
                    label: t('aiChat.feedback.formatConversational', 'Swobodny'),
                  },
                ] as { value: FormatPreference; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setExpectedFormat(opt.value)}
                  className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                    expectedFormat === opt.value
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Missing info textarea */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {t('aiChat.feedback.missingInfo', 'Czego brakowało? (opcjonalnie)')}
            </span>
            <textarea
              value={missingInfo}
              onChange={(e) => setMissingInfo(e.target.value)}
              placeholder={t(
                'chat.feedback.missingInfoPlaceholder',
                'Opisz czego brakowało w odpowiedzi...'
              )}
              className="w-full px-2 py-1.5 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={2}
            />
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmitDetailed}
        className="w-full px-3 py-1.5 text-[11px] font-medium bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
      >
        {t('aiChat.feedback.submit', 'Wyślij opinię')}
      </button>
    </div>
  );
};

export default InlineResponseFeedback;
