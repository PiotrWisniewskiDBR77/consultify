/**
 * DeckReviewPanel — one neutral "Review" panel for a presentation (U-43, DEC-543).
 *
 * Replaces DeckQualityGatesPanel ("choinka"): Deck Score 65, BLOCKED_P1 badges,
 * "Export Blocked" / "Share Warning" pills, three P0/P1/P2 tiles, a "Result:"
 * line and red/amber/blue cards — five semantic colours and the same fact told
 * three times. What stays is the only thing a consultant needs: a list of
 * findings in plain language, the slide each one is about, and a way to get there.
 *
 * Canon:
 *  • DEC-543 — a review is a WARNING, never a blocker. This panel shows no
 *    export/share verdict at all; export and Present are always available.
 *  • Colour: ONE amber icon + a thin left edge on "Needs attention"; everything
 *    else neutral (c-* tokens). Zero crimson (`primary-*` = #85182F).
 *  • Wpis 119 — body text uses c-text / c-text-secondary in both themes
 *    (≥4.5:1); `text-c-warning` (#a3541c light, #e8a33d dark) is used on the
 *    ICON and border only, i.e. as a graphic mark (≥3:1), never as body text.
 */

import { AlertTriangle, CheckCircle2, Info, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  countReadySlides,
  describeFinding,
  reviewGroupOf,
  type DeckReviewFinding,
} from './deckReviewCopy';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface DeckReviewReport {
  deckId: string;
  gates: DeckReviewFinding[];
  checkedAt: string;
}

export interface DeckReviewPanelProps {
  deckId: string;
  isOpen: boolean;
  /** Total slides in the deck — enables the "4 of 6 slides ready" line. */
  totalSlides?: number;
  onClose?: () => void;
  onJumpToCard?: (cardIndex: number) => void;
  /** Optional AI repair for a single slide (DeckBuilder: handleRewriteCard). */
  onFixWithAi?: (cardIndex: number) => void;
  displayMode?: 'overlay' | 'embedded';
}

function getHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  };
}

export const DeckReviewPanel: React.FC<DeckReviewPanelProps> = ({
  deckId,
  isOpen,
  totalSlides,
  onClose,
  onJumpToCard,
  onFixWithAi,
  displayMode = 'overlay',
}) => {
  const { t } = useTranslation();
  const [report, setReport] = useState<DeckReviewReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runReview = useCallback(async () => {
    if (!deckId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/presentations/decks/${deckId}/quality-gates`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setReport(json?.data || null);
      } else {
        setError(json?.error || t('presentations.review.failed', 'The review could not be run.'));
      }
    } catch (err: any) {
      setError(err?.message || t('presentations.review.failed', 'The review could not be run.'));
    } finally {
      setLoading(false);
    }
  }, [deckId, t]);

  useEffect(() => {
    if (isOpen && deckId) runReview();
  }, [isOpen, deckId, runReview]);

  const findings = useMemo(() => report?.gates ?? [], [report]);
  const attention = useMemo(
    () => findings.filter((f) => reviewGroupOf(f) === 'attention'),
    [findings]
  );
  const suggestions = useMemo(
    () => findings.filter((f) => reviewGroupOf(f) === 'suggestion'),
    [findings]
  );

  if (!isOpen) return null;

  const readyLine =
    typeof totalSlides === 'number' && totalSlides > 0
      ? t('presentations.review.slidesReady', '{{ready}} of {{total}} slides ready', {
          ready: countReadySlides(findings, totalSlides),
          total: totalSlides,
        })
      : null;

  const renderFinding = (finding: DeckReviewFinding, group: 'attention' | 'suggestion') => {
    const hasSlide = typeof finding.cardIndex === 'number' && finding.cardIndex >= 0;
    const slideNumber = hasSlide ? (finding.cardIndex as number) + 1 : null;
    const Icon = group === 'attention' ? AlertTriangle : Info;
    return (
      <li
        key={finding.id}
        data-testid="deck-review-finding"
        className={`rounded-md bg-c-surface-raised p-3 ${
          group === 'attention' ? 'border-l-2 border-c-warning' : ''
        }`}
      >
        <div className="flex items-start gap-2">
          <Icon
            size={14}
            aria-hidden
            className={`mt-0.5 flex-shrink-0 ${
              group === 'attention' ? 'text-c-warning' : 'text-c-text-secondary'
            }`}
          />
          <p className="text-xs leading-relaxed text-c-text">{describeFinding(finding, t)}</p>
        </div>
        {(slideNumber || onFixWithAi) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
            {slideNumber && (
              <span className="text-[11px] text-c-text-secondary">
                {t('presentations.review.slideNumber', 'Slide {{number}}', {
                  number: slideNumber,
                })}
              </span>
            )}
            {slideNumber && onJumpToCard && (
              <button
                type="button"
                onClick={() => onJumpToCard(finding.cardIndex as number)}
                className="min-h-8 rounded-md border border-c-border px-2 text-[11px] font-medium text-c-text hover:bg-c-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {t('presentations.review.goToSlide', 'Go to slide')}
              </button>
            )}
            {slideNumber && onFixWithAi && (
              <button
                type="button"
                onClick={() => onFixWithAi(finding.cardIndex as number)}
                className="inline-flex min-h-8 items-center gap-1 rounded-md border border-c-border px-2 text-[11px] font-medium text-c-text hover:bg-c-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <Sparkles size={12} aria-hidden className="text-c-ai" />
                {t('presentations.review.fixWithAi', 'Fix with AI')}
              </button>
            )}
          </div>
        )}
      </li>
    );
  };

  const renderGroup = (
    group: 'attention' | 'suggestion',
    label: string,
    items: DeckReviewFinding[]
  ) => {
    if (items.length === 0) return null;
    return (
      <section aria-label={label}>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary">
          {label} ({items.length})
        </h4>
        <ul className="space-y-2">{items.map((finding) => renderFinding(finding, group))}</ul>
      </section>
    );
  };

  return (
    <div
      className={
        displayMode === 'embedded'
          ? 'flex h-full min-h-0 w-full flex-col bg-c-surface'
          : 'absolute right-0 top-0 z-30 flex h-full w-80 flex-col border-l border-c-border-subtle bg-c-surface shadow-xl'
      }
      data-testid="presentation-review-findings"
    >
      {/* Embedded in the left rail the tab above already says "Review" — a
          second identical title would be the old panel's habit of saying the
          same thing twice. Only the overlay needs its own header + close. */}
      {displayMode === 'overlay' && (
      <div className="flex shrink-0 items-center justify-between border-b border-c-border-subtle px-4 py-3">
        <h3 className="text-sm font-semibold text-c-text">
          {t('presentations.review.title', 'Review')}
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            title={t('common.close', 'Close')}
            className="inline-flex h-9 w-9 items-center justify-center rounded text-c-text-secondary hover:bg-c-surface-hover hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <X size={16} aria-hidden />
          </button>
        )}
      </div>
      )}

      {report && !loading && (
        <div className="shrink-0 border-b border-c-border-subtle px-4 py-3">
          {readyLine && <p className="text-sm font-medium text-c-text">{readyLine}</p>}
          <p className="mt-1 text-[11px] text-c-text-secondary">
            {t(
              'presentations.review.neverBlocks',
              'A review never blocks exporting or presenting.'
            )}
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {error && (
          <div className="rounded-md border border-c-border bg-c-surface-raised p-3 text-xs text-c-text">
            {error}
          </div>
        )}

        {loading && (
          <p className="py-8 text-center text-xs text-c-text-secondary">
            {t('presentations.review.running', 'Running the review…')}
          </p>
        )}

        {!loading && report && findings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 size={28} aria-hidden className="mb-2 text-c-text-secondary" />
            <p className="text-sm font-medium text-c-text">
              {t('presentations.review.noFindings', 'Nothing to fix right now.')}
            </p>
          </div>
        )}

        {!loading &&
          renderGroup(
            'attention',
            t('presentations.review.needsAttention', 'Needs attention'),
            attention
          )}
        {!loading &&
          renderGroup('suggestion', t('presentations.review.suggestions', 'Suggestions'), suggestions)}
      </div>

      <div className="shrink-0 border-t border-c-border-subtle px-4 py-2">
        <button
          type="button"
          onClick={runReview}
          disabled={loading}
          className="min-h-9 w-full rounded-md border border-c-border bg-c-surface px-3 text-xs font-medium text-c-text hover:bg-c-surface-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {loading
            ? t('presentations.review.running', 'Running the review…')
            : t('presentations.review.run', 'Run review')}
        </button>
      </div>
    </div>
  );
};

export default DeckReviewPanel;
