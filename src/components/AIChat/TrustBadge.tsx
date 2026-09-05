/**
 * Chat V9 / TRUST T-TR1 — AI response trust badge.
 *
 * Purpose
 * -------
 * The existing chat surface renders citations in a full `CitationList`
 * (when `msg.citations` has entries) and reserves a slot for the WIP
 * `TrustPanel` / `SourcesStrip` (both currently stubbed to `null`).
 * Users therefore see NO compact at-a-glance signal for "where did this
 * answer come from?" on a busy conversation scroll.
 *
 * `TrustBadge` fills that gap: a single always-visible chip beneath
 * every non-streaming AI reply showing
 *
 *   - how many cited sources back the reply (`3 sources` / `No sources`),
 *   - optionally the model name (`GPT-4o`), when available on `msg.metadata`.
 *
 * Clicking the chip opens a small popover listing the first few
 * citation titles (using the existing `ChatCitation` shape so no
 * backend changes are needed) with an honest "What does this mean?"
 * footer. The badge is advisory — it does not replace `CitationList`,
 * which remains the source of truth for deep dives.
 *
 * DoD
 * ---
 *   - Pure read: never mutates `msg`, never refetches, never talks to
 *     the backend.
 *   - Flag-gated (`isTrustBadgeEnabled()`). When OFF, returns null.
 *   - Telemetry: `trust_badge_opened` — closed-enum bucketed payload
 *     (no ids, no text, no model names).
 *   - Defensive: handles malformed `citations` (non-array) and absent
 *     metadata without throwing.
 *   - Close-on-Escape + close-on-outside-click.
 */

import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardCopy,
  ClipboardX,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';
import type { ChatCitation } from '@/types';

import { buildTrustBadgeCitationsText } from '../../utils/buildTrustBadgeCitationsText';
import { buildTrustBadgeReasoning } from '../../utils/buildTrustBadgeReasoning';
import { buildTrustBadgeReasoningText } from '../../utils/buildTrustBadgeReasoningText';
import {
  type ClipboardWriteResult,
  copyTextToClipboard as defaultCopyToClipboard,
} from '../../utils/chatV9FlagsSnapshotText';
import { extractCitationDomain } from '../../utils/extractCitationDomain';
import { formatTrustBadgeModelLabel } from '../../utils/formatTrustBadgeModelLabel';
import { isSafeCitationLink } from '../../utils/isSafeCitationLink';
import { isTrustBadgeCitationDomainEnabled } from '../../utils/trustBadgeCitationDomainFlag';
import { isTrustBadgeCitationLinksEnabled } from '../../utils/trustBadgeCitationLinksFlag';
import { isTrustBadgeCopyCitationsEnabled } from '../../utils/trustBadgeCopyCitationsFlag';
import { isTrustBadgeCopyReasoningEnabled } from '../../utils/trustBadgeCopyReasoningFlag';
import { isTrustBadgeEnabled } from '../../utils/trustBadgeFlag';
import { isTrustBadgeHumanizeModelEnabled } from '../../utils/trustBadgeHumanizeModelFlag';
import { isTrustBadgeReasoningEnabled } from '../../utils/trustBadgeReasoningFlag';

interface TrustBadgeProps {
  /**
   * Citations attached to the AI reply. Accepts `unknown` so callers can
   * pass `msg.citations` without asserting the backend-returned shape —
   * we sanitise defensively below.
   */
  citations?: unknown;
  /**
   * Optional model identifier (e.g. `gpt-4o`). Rendered only when
   * present; never sent in telemetry.
   */
  modelUsed?: string | null;
  /**
   * Test-only override for the feature flag resolver. Production callers
   * never pass this.
   */
  isEnabled?: () => boolean;
  /**
   * Test-only override for the T-TR1.2 humanizer flag resolver.
   * Production callers never pass this.
   */
  isHumanizeModelEnabled?: () => boolean;
  /**
   * Test-only override for the T-TR1.3 copy-citations flag resolver.
   * Production callers never pass this.
   */
  isCopyCitationsEnabled?: () => boolean;
  /**
   * Test-only override for the T-TR1.4 copy-reasoning flag resolver.
   * Production callers never pass this.
   */
  isCopyReasoningEnabled?: () => boolean;
  /**
   * Test-only override for the T-TR3-lite citation-links flag
   * resolver. Production callers never pass this.
   */
  isCitationLinksEnabled?: () => boolean;
  /**
   * Test-only override for the T-TR3.4 citation-domain pill
   * flag resolver. Production callers never pass this. The
   * pill renders independently of `isCitationLinksEnabled`:
   * the domain is useful provenance even on tenants that
   * must stay non-interactive.
   */
  isCitationDomainEnabled?: () => boolean;
  /**
   * Test-only override for the T-TR2 reasoning-disclosure flag
   * resolver. Production callers never pass this.
   */
  isReasoningEnabled?: () => boolean;
  /**
   * Test-only override for the clipboard writer. Production callers
   * never pass this; it exists so we can assert the exact payload
   * that would hit the system clipboard without needing a real
   * `navigator.clipboard` mock in every test.
   */
  writeToClipboard?: (text: string) => Promise<ClipboardWriteResult>;
  /** Optional test-only className passthrough for alignment. */
  className?: string;
}

// Closed-enum bucket for the telemetry payload. `none` / `few` / `many`
// captures the dashboard question ("are replies generally cited?")
// without turning each event into a per-message counter.
type SourceCountBucket = 'none' | 'few' | 'many';

function bucketSourceCount(n: number): SourceCountBucket {
  if (!Number.isFinite(n) || n <= 0) return 'none';
  if (n <= 3) return 'few';
  return 'many';
}

// Extract a best-effort `ChatCitation[]` from an `unknown` input. We do
// NOT assume the backend returns a clean array — persisted messages
// may come back as undefined, null, a string, or a legacy shape.
function normalizeCitations(raw: unknown): ChatCitation[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatCitation[] = [];
  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const e = entry as Record<string, unknown>;
    const id = typeof e.id === 'string' && e.id.trim() ? e.id.trim() : `citation-${index + 1}`;
    const rawTitle =
      typeof e.title === 'string'
        ? e.title
        : typeof e.sourceTitle === 'string'
          ? e.sourceTitle
          : '';
    const rawType =
      typeof e.type === 'string'
        ? e.type
        : typeof e.sourceType === 'string'
          ? e.sourceType
          : 'external';
    const type = ['assessment', 'initiative', 'report', 'roadmap', 'external'].includes(rawType)
      ? (rawType as ChatCitation['type'])
      : 'external';
    const genericTitle =
      /^source\s+\d+$/i.test(rawTitle.trim()) || /^rag_\d+$/i.test(rawTitle.trim());
    const title =
      rawTitle.trim() && !genericTitle
        ? rawTitle.trim()
        : type === 'external'
          ? 'External source'
          : 'Knowledge base source';
    out.push({
      id,
      title,
      type,
      reference:
        typeof e.reference === 'string'
          ? e.reference
          : typeof e.sourceId === 'string'
            ? e.sourceId
            : '',
      link:
        typeof e.link === 'string'
          ? e.link
          : typeof e.sourceUrl === 'string'
            ? e.sourceUrl
            : undefined,
      excerpt: typeof e.excerpt === 'string' ? e.excerpt : undefined,
      entityId: typeof e.entityId === 'string' ? e.entityId : undefined,
    });
  });
  return out;
}

const PREVIEW_LIMIT = 5;

type CopyFeedback = 'idle' | 'copied' | 'failed';

// Transient feedback window matches the AG1 v1.2 "Copy snapshot"
// button so the two ops affordances feel like one family.
const COPY_FEEDBACK_MS = 1800;

export const TrustBadge: React.FC<TrustBadgeProps> = ({
  citations,
  modelUsed,
  isEnabled = isTrustBadgeEnabled,
  isHumanizeModelEnabled = isTrustBadgeHumanizeModelEnabled,
  isCopyCitationsEnabled = isTrustBadgeCopyCitationsEnabled,
  isCopyReasoningEnabled = isTrustBadgeCopyReasoningEnabled,
  isCitationLinksEnabled = isTrustBadgeCitationLinksEnabled,
  isCitationDomainEnabled = isTrustBadgeCitationDomainEnabled,
  isReasoningEnabled = isTrustBadgeReasoningEnabled,
  writeToClipboard = defaultCopyToClipboard,
  className,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>('idle');
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // T-TR1.4 — independent feedback state + timer for the reasoning
  // copy button so the two affordances never clobber each other.
  // They share the same tone scheme but the user may trigger both
  // in rapid succession and expect each to reflect its own result.
  const [reasoningCopyFeedback, setReasoningCopyFeedback] = useState<CopyFeedback>('idle');
  const reasoningCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const safeCitations = useMemo(() => normalizeCitations(citations), [citations]);
  const count = safeCitations.length;
  const hasSources = count > 0;

  // T-TR1.2: when the humanizer flag is ON, run the raw `modelUsed`
  // through the dictionary formatter (`gpt-4o-2024-08-06` → `GPT-4o`,
  // uuid → `Private model`). When OFF, fall back to the pre-T-TR1.2
  // path that just trims + rejects empties, so the kill-switch
  // returns the badge to its shipped T-TR1 behaviour exactly.
  const humanizeEnabled = isHumanizeModelEnabled();
  const modelLabel = useMemo(() => {
    if (humanizeEnabled) return formatTrustBadgeModelLabel(modelUsed);
    if (typeof modelUsed !== 'string') return null;
    const trimmed = modelUsed.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [humanizeEnabled, modelUsed]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    try {
      trackFunnelEvent('trust_badge_opened', {
        sourceCount: bucketSourceCount(count),
        hasModel: modelLabel !== null,
      });
    } catch {
      // Telemetry is advisory. The popover is the higher-value side
      // effect; a broken sink must never block the explanation.
    }
  }, [count, modelLabel]);

  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event: MouseEvent) => {
      const root = containerRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Reset the transient feedback state AND collapse the T-TR2
  // reasoning disclosure whenever the popover closes, so re-opening
  // the badge never flashes stale "Copied" / "Copy failed" state and
  // always starts with the disclosure collapsed (matches the user's
  // mental model of the popover being a "fresh" surface each click).
  useEffect(() => {
    if (!open) {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
      if (reasoningCopyTimerRef.current) {
        clearTimeout(reasoningCopyTimerRef.current);
        reasoningCopyTimerRef.current = null;
      }
      setCopyFeedback('idle');
      setReasoningCopyFeedback('idle');
      setReasoningExpanded(false);
    }
  }, [open]);

  // Clean up the timer on unmount so a mid-flight transient feedback
  // schedule never leaks into the next test / render.
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
      if (reasoningCopyTimerRef.current) {
        clearTimeout(reasoningCopyTimerRef.current);
        reasoningCopyTimerRef.current = null;
      }
    };
  }, []);

  const copyCitationsEnabled = isCopyCitationsEnabled();
  const copyReasoningEnabled = isCopyReasoningEnabled();
  const citationLinksEnabled = isCitationLinksEnabled();
  const citationDomainEnabled = isCitationDomainEnabled();
  const reasoningEnabled = isReasoningEnabled();
  // The reasoning observations close over exactly the same inputs the
  // badge already computes for the trigger pill — citation count and
  // the humanised model label. Recompute-on-change is free and keeps
  // the disclosure trivially in sync with the rest of the popover.
  const reasoningObservations = useMemo(
    () => buildTrustBadgeReasoning({ citationCount: count, modelLabel }),
    [count, modelLabel]
  );

  const handleCopyCitations = useCallback(async () => {
    const payload = buildTrustBadgeCitationsText(safeCitations, {
      modelLabel: humanizeEnabled ? modelLabel : null,
    });
    try {
      const result = await writeToClipboard(payload);
      setCopyFeedback(result.ok ? 'copied' : 'failed');
    } catch {
      // A thrown clipboard writer is still a user-visible failure.
      setCopyFeedback('failed');
    } finally {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setCopyFeedback('idle');
        feedbackTimerRef.current = null;
      }, COPY_FEEDBACK_MS);
    }
  }, [humanizeEnabled, modelLabel, safeCitations, writeToClipboard]);

  // T-TR1.4 — mirror of `handleCopyCitations` but for the
  // reasoning observations. Uses its own feedback state + timer
  // so the two copy buttons stay independent.
  const handleCopyReasoning = useCallback(async () => {
    const payload = buildTrustBadgeReasoningText(reasoningObservations, {
      modelLabel: humanizeEnabled ? modelLabel : null,
    });
    try {
      const result = await writeToClipboard(payload);
      setReasoningCopyFeedback(result.ok ? 'copied' : 'failed');
    } catch {
      setReasoningCopyFeedback('failed');
    } finally {
      if (reasoningCopyTimerRef.current) {
        clearTimeout(reasoningCopyTimerRef.current);
      }
      reasoningCopyTimerRef.current = setTimeout(() => {
        setReasoningCopyFeedback('idle');
        reasoningCopyTimerRef.current = null;
      }, COPY_FEEDBACK_MS);
    }
  }, [humanizeEnabled, modelLabel, reasoningObservations, writeToClipboard]);

  // If there are no citations, don't render the badge: it is often interpreted as a system error
  // ("No cited sources" while the answer contains [1] markers) and creates noise for simple chats.
  if (!isEnabled() || !hasSources) return null;

  const Icon = hasSources ? CheckCircle2 : AlertCircle;
  const sourceLabel = hasSources
    ? t('trust.badge.sources', { count })
    : t('trust.badge.noSources');

  // Two tones — emerald when sources are present, amber when they are
  // not. The amber is not a warning per se; it's an honest "this reply
  // is based on the model's own reasoning, not retrieved material".
  const toneClasses = hasSources
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-900/25 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-900/25 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40';

  return (
    <div ref={containerRef} className={`relative inline-flex ${className ?? ''}`}>
      <button
        type="button"
        data-testid="trust-badge-trigger"
        data-source-count={count}
        data-has-model={modelLabel !== null}
        onClick={open ? handleClose : handleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('trust.badge.ariaLabel', 'Response sources')}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400/50 ${toneClasses}`}
      >
        <Icon size={11} strokeWidth={2} />
        <span>{sourceLabel}</span>
        {modelLabel && (
          <>
            <span aria-hidden="true" className="opacity-60">
              ·
            </span>
            <span data-testid="trust-badge-model">{modelLabel}</span>
          </>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('trust.badge.dialogLabel', 'Sources for this response')}
          data-testid="trust-badge-popover"
          className="absolute top-full left-0 mt-2 z-50 w-80 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-lg p-3 text-[12px] text-slate-700 dark:text-slate-200"
        >
          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white mb-2">
            <BookOpen size={13} strokeWidth={2} />
            <span>{t('trust.badge.dialogLabel', 'Sources for this response')}</span>
          </div>

          {/* T-TR1.2 — "Answered by" line. Reuses the already-
              humanised `modelLabel` so the pill in the trigger and
              the line here stay trivially in sync. Rendered only when
              a label is available and the humanizer flag is ON, so
              flipping the kill-switch collapses both surfaces at
              once. */}
          {humanizeEnabled && modelLabel && (
            <div
              data-testid="trust-badge-answered-by"
              className="mb-2 flex items-center gap-1.5 text-slate-500 dark:text-slate-400"
            >
              <span className="uppercase tracking-wide text-[10px] font-semibold text-slate-600 dark:text-slate-500">
                {t('trust.badge.answeredBy', 'Answered by')}
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{modelLabel}</span>
            </div>
          )}

          {hasSources ? (
            <>
              <ul
                data-testid="trust-badge-source-list"
                className="space-y-1 max-h-40 overflow-y-auto"
              >
                {safeCitations.slice(0, PREVIEW_LIMIT).map((c, idx) => {
                  // T-TR3-lite — linkify the row only when the kill-
                  // switch is ON AND the citation's `link` passes the
                  // sanitiser. Untrusted / absent links degrade to plain
                  // text so the popover never renders a broken <a> and
                  // never becomes an XSS vector through a stray
                  // `javascript:` URL.
                  const safeLink = citationLinksEnabled ? isSafeCitationLink(c.link) : null;
                  // T-TR3.4 — extract the hostname from the raw link
                  // *independently* of `citationLinksEnabled`. The domain
                  // pill is a provenance signal, not a navigation control,
                  // so tenants that keep links non-interactive still
                  // benefit from seeing "nytimes.com" next to the title.
                  // Hidden when the kill-switch is OFF or the URL cannot
                  // be parsed safely.
                  const citationDomain = citationDomainEnabled
                    ? extractCitationDomain(c.link)
                    : null;
                  return (
                    <li
                      key={c.id || `${c.title}-${idx}`}
                      className="text-slate-700 dark:text-slate-200 truncate"
                      title={c.title}
                    >
                      <span
                        aria-hidden="true"
                        className="inline-block w-4 text-slate-600 dark:text-slate-500"
                      >
                        {idx + 1}.
                      </span>
                      {safeLink ? (
                        <a
                          data-testid={`trust-badge-citation-link-${idx}`}
                          href={safeLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline decoration-slate-400/50 underline-offset-2 hover:text-c-text hover:decoration-c-border-strong dark:hover:text-c-text focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded-sm"
                          aria-label={t(
                            'trust.badge.openSource',
                            'Open source in a new tab: {{title}}',
                            { title: c.title }
                          )}
                        >
                          {c.title}
                        </a>
                      ) : (
                        <span data-testid={`trust-badge-citation-plain-${idx}`}>{c.title}</span>
                      )}
                      {citationDomain && (
                        <span
                          data-testid={`trust-badge-citation-domain-${idx}`}
                          data-citation-domain={citationDomain}
                          className="ml-1.5 inline-flex items-center text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400"
                          aria-label={t('trust.badge.citationDomain', 'Source domain: {{domain}}', {
                            domain: citationDomain,
                          })}
                        >
                          <span aria-hidden="true" className="text-slate-600 dark:text-navy-600">
                            ·
                          </span>
                          <span aria-hidden="true" className="ml-1">
                            {citationDomain}
                          </span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {count > PREVIEW_LIMIT && (
                <div className="mt-1 text-slate-500 dark:text-slate-400">
                  {t('trust.badge.more', '… and {{n}} more in the full list below.', {
                    n: count - PREVIEW_LIMIT,
                  })}
                </div>
              )}
            </>
          ) : (
            <div
              data-testid="trust-badge-no-sources-body"
              className="text-slate-600 dark:text-slate-400"
            >
              {t(
                'trust.badge.noSourcesBody',
                'This reply is based on the model\u2019s own reasoning, not on retrieved documents or search results.'
              )}
            </div>
          )}

          {/* T-TR2 — "Why this answer?" collapsible disclosure.
              Renders a short, deterministic snippet derived from the
              same (citationCount, modelLabel) pair the badge already
              uses, so the disclosure never contradicts the trigger
              pill. Kill-switch: flag OFF removes the button + body
              entirely; the popover collapses back to the T-TR1.3
              layout pixel-for-pixel. Telemetry: none — the
              `trust_badge_opened` event already covers engagement. */}
          {reasoningEnabled && (
            <div
              data-testid="trust-badge-reasoning"
              data-expanded={reasoningExpanded}
              className="mt-2 pt-2 border-t border-slate-200 dark:border-navy-800"
            >
              <button
                type="button"
                data-testid="trust-badge-reasoning-toggle"
                onClick={() => setReasoningExpanded((prev) => !prev)}
                aria-expanded={reasoningExpanded}
                aria-controls="trust-badge-reasoning-body"
                className="w-full inline-flex items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 rounded"
              >
                {reasoningExpanded ? (
                  <ChevronDown size={12} strokeWidth={2} aria-hidden />
                ) : (
                  <ChevronRight size={12} strokeWidth={2} aria-hidden />
                )}
                <span>{t('trust.badge.reasoningToggle', 'Why this answer?')}</span>
              </button>
              {reasoningExpanded && (
                <div id="trust-badge-reasoning-body" data-testid="trust-badge-reasoning-body">
                  <ul className="mt-2 space-y-1.5">
                    {reasoningObservations.map((obs) => (
                      <li
                        key={obs.id}
                        data-testid={`trust-badge-reasoning-${obs.id}`}
                        className="flex flex-col gap-0.5"
                      >
                        <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                          {obs.headline}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300 leading-snug">
                          {obs.body}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {/* T-TR1.4 — Copy reasoning button. Kill-switched
                      independently from T-TR1.3 so ops can silence
                      either copy affordance without touching the other.
                      Visual language mirrors T-TR1.3 / AG1 v1.2 so the
                      three Copy buttons in Chat V9 feel like a family. */}
                  {copyReasoningEnabled && (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        data-testid="trust-badge-copy-reasoning"
                        data-copy-state={reasoningCopyFeedback}
                        onClick={handleCopyReasoning}
                        disabled={reasoningCopyFeedback !== 'idle'}
                        aria-label={t(
                          'trust.badge.copyReasoningAriaLabel',
                          'Copy reasoning observations to clipboard'
                        )}
                        className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400/50 ${
                          reasoningCopyFeedback === 'copied'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : reasoningCopyFeedback === 'failed'
                              ? 'border-danger-300 bg-danger-50 text-danger-700 dark:border-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-300 dark:hover:bg-navy-800'
                        }`}
                      >
                        {reasoningCopyFeedback === 'copied' ? (
                          <>
                            <ClipboardCheck size={11} strokeWidth={2} />
                            <span>{t('trust.badge.copied', 'Copied')}</span>
                          </>
                        ) : reasoningCopyFeedback === 'failed' ? (
                          <>
                            <ClipboardX size={11} strokeWidth={2} />
                            <span>{t('trust.badge.copyFailed', 'Copy failed')}</span>
                          </>
                        ) : (
                          <>
                            <ClipboardCopy size={11} strokeWidth={2} />
                            <span>{t('trust.badge.copy', 'Copy')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Honest footer — explain what the badge actually means so
              users don't mistake "3 sources" for "this is verified". */}
          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-navy-800 text-slate-500 dark:text-slate-400">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                {t(
                  'trust.badge.disclaimer',
                  'Sources tell you what was retrieved. Always verify claims that matter to you.'
                )}
              </div>
              {/* T-TR1.3 — Copy citations button. Only rendered when
                  the kill-switch is on AND at least one citation exists
                  (copying "No cited sources" adds zero value). The
                  three visual states below mirror AG1 v1.2's
                  Copy-snapshot button so the two ops affordances feel
                  like one family. */}
              {copyCitationsEnabled && hasSources && (
                <button
                  type="button"
                  data-testid="trust-badge-copy-citations"
                  data-copy-state={copyFeedback}
                  onClick={handleCopyCitations}
                  disabled={copyFeedback !== 'idle'}
                  aria-label={t(
                    'trust.badge.copyCitationsAriaLabel',
                    'Copy citation list to clipboard'
                  )}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400/50 ${
                    copyFeedback === 'copied'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : copyFeedback === 'failed'
                        ? 'border-danger-300 bg-danger-50 text-danger-700 dark:border-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-300 dark:hover:bg-navy-800'
                  }`}
                >
                  {copyFeedback === 'copied' ? (
                    <>
                      <ClipboardCheck size={11} strokeWidth={2} />
                      <span>{t('trust.badge.copied', 'Copied')}</span>
                    </>
                  ) : copyFeedback === 'failed' ? (
                    <>
                      <ClipboardX size={11} strokeWidth={2} />
                      <span>{t('trust.badge.copyFailed', 'Copy failed')}</span>
                    </>
                  ) : (
                    <>
                      <ClipboardCopy size={11} strokeWidth={2} />
                      <span>{t('trust.badge.copy', 'Copy')}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrustBadge;
