/**
 * Chat V9 / VOICE VM3 (+ VM1-lite) — "Voice modes" legend popover.
 *
 * Spec
 * ----
 * `VOICE_MODE_AUDIO_EXPERIENCE_DEVELOPMENT_PLAN_2026-04-18.md#VM3`
 *
 *   > Legenda: rozmowa vs dyktacja — popover tłumaczący różnice między
 *   > Dyktacją a rozmową.
 *
 * VM1-lite extension (pass 36)
 * ----------------------------
 * When the caller reports `unavailable={true}` (the host browser lacks
 * the STT signals the chat input looks for), the popover replaces the
 * two-mode content with a single "voice is unavailable" row + a short
 * remediation hint. Rationale: an unsupported browser already hides
 * the mic button entirely, so the legend button is the user's only
 * surface to learn *why* voice doesn't work. Silent-fail becomes an
 * explicit "your browser cannot do this" message.
 *
 * DoD (original VM3)
 * ------------------
 *   - A small "?" affordance sits next to the mic in `EnhancedChatInput`.
 *   - Click / focus opens a small popover with **two** rows: Dictation
 *     and Conversation (live). The rows mirror the two mic modes this
 *     UI actually exposes today, not the full SPEC_VOICE_CONTRACT matrix
 *     that may or may not be implemented on this branch. Honest labels
 *     over aspirational ones.
 *   - Telemetry: `voice_mode_legend_opened` fires **once per open** (a
 *     re-open in the same session still counts — each open is a distinct
 *     "I needed the explanation right now" signal).
 *   - Close-on-escape + close-on-outside-click.
 *   - Kill-switch: `isVoiceModeLegendEnabled()` returns false → component
 *     renders nothing. The mic button is independent.
 */

import { AlertTriangle, Check, ClipboardCopy, ClipboardX, HelpCircle } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { buildVoiceLegendCopyText } from '../../utils/buildVoiceLegendCopyText';
import {
  copyTextToClipboard,
  type ClipboardWriteResult,
} from '../../utils/chatV9FlagsSnapshotText';
import { VOICE_LEGEND_OPEN_EVENT } from '../../utils/voiceLegendShortcutFlag';
import { isVoiceLegendCopyTextEnabled } from '../../utils/voiceLegendCopyTextFlag';
import { isVoiceModeLegendEnabled } from '../../utils/voiceModeLegendFlag';

interface VoiceModeLegendProps {
  /** Optional className passthrough for the trigger button. */
  className?: string;
  /**
   * Read the feature flag. Exposed as a prop purely so unit tests can force
   * the enabled / disabled paths deterministically without touching the
   * URL / localStorage / env triad at runtime. Production code should
   * never pass this — the default `isVoiceModeLegendEnabled` is correct.
   */
  isEnabled?: () => boolean;
  /**
   * VM1-lite — when `true`, the popover replaces its two-mode content
   * with an explicit "voice is unavailable in this browser" row. The
   * trigger button stays visible so the user can still reach the
   * explanation; the flag gate for the whole component is independent.
   */
  unavailable?: boolean;
  /**
   * VM3.2 — kill-switch test seam for the "Copy legend" button.
   * Production always uses `isVoiceLegendCopyTextEnabled`; tests
   * inject a stub to force the ON / OFF paths without touching
   * localStorage.
   */
  isCopyTextEnabled?: () => boolean;
  /**
   * VM3.2 — test seam for the clipboard writer. Production
   * always uses `copyTextToClipboard`. Tests inject a stub that
   * records the payload and returns a canned success / failure
   * result so the feedback transitions can be pinned
   * deterministically.
   */
  writeToClipboard?: (text: string) => Promise<ClipboardWriteResult>;
}

type CopyFeedback = 'idle' | 'copied' | 'failed';

const COPY_FEEDBACK_MS = 2000;

export const VoiceModeLegend: React.FC<VoiceModeLegendProps> = ({
  className,
  isEnabled = isVoiceModeLegendEnabled,
  unavailable = false,
  isCopyTextEnabled = isVoiceLegendCopyTextEnabled,
  writeToClipboard = copyTextToClipboard,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // VM3.2 — transient feedback for the "Copy legend" button.
  // Kept local so the button can announce "copied" / "failed"
  // for a short window without pulling in a global toast layer.
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>('idle');
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTextEnabled = isCopyTextEnabled();

  const handleOpen = useCallback(() => {
    setOpen(true);
    try {
      trackFunnelEvent('voice_mode_legend_opened', {});
    } catch {
      // Telemetry is advisory — never block the popover render on it.
    }
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  // VM3.2 — reset any lingering "copied" / "failed" feedback
  // when the popover closes. The next open should start clean;
  // otherwise re-opening right after a copy would still flash
  // the old status for ~2 s until the timer ticks.
  useEffect(() => {
    if (open) return;
    if (copyFeedbackTimerRef.current) {
      clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = null;
    }
    if (copyFeedback !== 'idle') {
      setCopyFeedback('idle');
    }
  }, [open, copyFeedback]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current) {
        clearTimeout(copyFeedbackTimerRef.current);
        copyFeedbackTimerRef.current = null;
      }
    };
  }, []);

  const handleCopyLegend = useCallback(async () => {
    if (copyFeedbackTimerRef.current) {
      clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = null;
    }
    // Build the payload from the same translated strings the
    // popover renders, so the clipboard text never drifts
    // from the visible content.
    const payload = unavailable
      ? {
          title: t('voice.legend.title', 'Voice modes'),
          unavailable: {
            title: t(
              'voice.legend.unavailable.title',
              'Voice is unavailable in this browser'
            ),
            body: t(
              'voice.legend.unavailable.body',
              'Try Chrome or Edge on desktop, or Safari on iOS 15+. Microphone access must be allowed for this site.'
            ),
          },
        }
      : {
          title: t('voice.legend.title', 'Voice modes'),
          modes: [
            {
              title: t('voice.legend.dictation.title', 'Dictation'),
              body: t(
                'voice.legend.dictation.body',
                'Speech fills the input field. You review the text and press send — nothing is sent automatically.'
              ),
            },
            {
              title: t('voice.legend.conversation.title', 'Conversation (live)'),
              body: t(
                'voice.legend.conversation.body',
                'Continuous back-and-forth: each turn is transcribed and sent as soon as you pause. Tap the volume icon to stop the current read.'
              ),
            },
          ],
        };
    let result: ClipboardWriteResult;
    try {
      const text = buildVoiceLegendCopyText(payload);
      result = await writeToClipboard(text);
    } catch {
      result = { ok: false as const, reason: 'failed' as const };
    }
    setCopyFeedback(result.ok ? 'copied' : 'failed');
    copyFeedbackTimerRef.current = setTimeout(() => {
      setCopyFeedback('idle');
      copyFeedbackTimerRef.current = null;
    }, COPY_FEEDBACK_MS);
  }, [t, unavailable, writeToClipboard]);

  // Close on outside click. We attach the listener only when the popover is
  // open so we don't pay for a global listener when the popover is hidden.
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

  // Close on Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // VM3.1 — react to the global open event dispatched by the
  // headless `VoiceLegendShortcut`. Mounted unconditionally so
  // flipping the shortcut kill-switch alone (without touching the
  // VM3 flag) is sufficient to stop the popover from opening via
  // keyboard. Listener checks the component's own flag gate on
  // fire so a disabled legend never opens even if the shortcut
  // fires the event.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onOpen = () => {
      if (!isEnabled()) return;
      handleOpen();
    };
    window.addEventListener(VOICE_LEGEND_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(VOICE_LEGEND_OPEN_EVENT, onOpen);
  }, [handleOpen, isEnabled]);

  if (!isEnabled()) return null;

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={open ? handleClose : handleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('voice.legend.trigger', 'Voice modes explained')}
        title={t('voice.legend.trigger', 'Voice modes explained')}
        data-testid="voice-mode-legend-trigger"
        className={`p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors ${
          className ?? ''
        }`}
      >
        <HelpCircle size={14} strokeWidth={1.75} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('voice.legend.title', 'Voice modes')}
          data-testid="voice-mode-legend-popover"
          className="absolute bottom-full right-0 mb-2 z-50 w-72 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-lg p-3 text-[12px] text-slate-700 dark:text-slate-200"
        >
          <div className="font-semibold text-slate-900 dark:text-white mb-2">
            {t('voice.legend.title', 'Voice modes')}
          </div>

          {unavailable ? (
            // VM1-lite — voice capture is not available in this browser.
            // Keep the copy concrete (what browsers DO work) so the user
            // has something actionable instead of a dead-end apology.
            <div
              data-testid="voice-mode-legend-unavailable"
              className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-2"
            >
              <AlertTriangle
                size={14}
                strokeWidth={1.75}
                className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <div>
                <div className="font-medium text-amber-900 dark:text-amber-100">
                  {t('voice.legend.unavailable.title', 'Voice is unavailable in this browser')}
                </div>
                <div className="text-amber-800/90 dark:text-amber-200/90">
                  {t(
                    'voice.legend.unavailable.body',
                    'Try Chrome or Edge on desktop, or Safari on iOS 15+. Microphone access must be allowed for this site.'
                  )}
                </div>
              </div>
            </div>
          ) : (
            <dl className="space-y-2">
              <div>
                <dt className="font-medium text-slate-800 dark:text-slate-100">
                  {t('voice.legend.dictation.title', 'Dictation')}
                </dt>
                <dd className="text-slate-600 dark:text-slate-400">
                  {t(
                    'voice.legend.dictation.body',
                    'Speech fills the input field. You review the text and press send — nothing is sent automatically.'
                  )}
                </dd>
              </div>

              <div>
                <dt className="font-medium text-slate-800 dark:text-slate-100">
                  {t('voice.legend.conversation.title', 'Conversation (live)')}
                </dt>
                <dd className="text-slate-600 dark:text-slate-400">
                  {t(
                    'voice.legend.conversation.body',
                    'Continuous back-and-forth: each turn is transcribed and sent as soon as you pause. Tap the volume icon to stop the current read.'
                  )}
                </dd>
              </div>
            </dl>
          )}

          {copyTextEnabled && (
            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-navy-700 flex justify-end">
              <button
                type="button"
                onClick={handleCopyLegend}
                data-testid="voice-mode-legend-copy"
                data-state={copyFeedback}
                aria-label={
                  copyFeedback === 'copied'
                    ? t('voice.legend.copy.copied', 'Voice legend copied to clipboard')
                    : copyFeedback === 'failed'
                      ? t('voice.legend.copy.failed', 'Copying voice legend failed')
                      : t('voice.legend.copy.idle', 'Copy voice legend to clipboard')
                }
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
                  copyFeedback === 'copied'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600/60 dark:bg-emerald-900/30 dark:text-emerald-200'
                    : copyFeedback === 'failed'
                      ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-600/60 dark:bg-rose-900/30 dark:text-rose-200'
                      : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                }`}
              >
                {copyFeedback === 'copied' ? (
                  <Check size={12} strokeWidth={2} aria-hidden="true" />
                ) : copyFeedback === 'failed' ? (
                  <ClipboardX size={12} strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <ClipboardCopy size={12} strokeWidth={1.75} aria-hidden="true" />
                )}
                <span>
                  {copyFeedback === 'copied'
                    ? t('voice.legend.copy.copied_short', 'Copied')
                    : copyFeedback === 'failed'
                      ? t('voice.legend.copy.failed_short', 'Failed')
                      : t('voice.legend.copy.idle_short', 'Copy')}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceModeLegend;
