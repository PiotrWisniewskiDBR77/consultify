/**
 * Chat V9 / TRUST T-PM1 — Private mode details popover.
 *
 * Why this exists
 * ---------------
 * `UnifiedChatPanel` already renders a small "Private mode" badge when
 * `aiConfig.privateMode === true`. The badge carries a one-line static
 * tooltip ("Disable memory injection and personalization for this
 * chat"). That tooltip is ambiguous — it implies everything is private,
 * which isn't accurate. This component turns the badge into a button
 * whose popover honestly lists:
 *
 *   - What private mode DOES disable (memory injection, personalisation).
 *   - What still happens (the message still goes to the model, standard
 *     logs, etc.). RODO honesty over marketing honesty.
 *   - How to turn it off (one short sentence).
 *
 * DoD
 * ---
 *   - Badge is visually identical to the legacy `<div>` chip when
 *     closed — we don't want to alarm users who are mid-conversation.
 *   - Flag gate (`isPrivateModeDetailsEnabled()`): when OFF, the badge
 *     falls back to the legacy read-only chip (no button semantics, no
 *     popover).
 *   - Telemetry: `private_mode_details_opened` fires once per open
 *     gesture (re-open after close counts — each open is a distinct
 *     "what does this guarantee mean?" signal).
 *   - Close-on-Escape + close-on-outside-click.
 *   - Does NOT change `aiConfig.privateMode` — purely a read-only
 *     explainer surface.
 */

import { Lock } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { isPrivateModeDetailsEnabled } from '../../utils/privateModeDetailsFlag';

interface PrivateModeDetailsProps {
  /**
   * Read the feature flag. Exposed as a prop purely so unit tests can
   * force the enabled / disabled paths without touching URL / localStorage
   * / env. Production callers never pass this.
   */
  isEnabled?: () => boolean;
}

const BADGE_CLASSNAME =
  'mr-1 inline-flex h-8 shrink-0 items-center gap-1 rounded-xl border border-primary-200 bg-primary-50 px-2 text-[11px] font-medium text-primary-700 dark:border-primary-800/70 dark:bg-primary-900/25 dark:text-primary-300';

export const PrivateModeDetails: React.FC<PrivateModeDetailsProps> = ({
  isEnabled = isPrivateModeDetailsEnabled,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const label = t('aiChat.menu.modes.privateMode.label', 'Private mode');
  const tooltip = t(
    'aiChat.menu.modes.privateMode.desc',
    'Disable memory injection and personalization for this chat'
  );

  const handleOpen = useCallback(() => {
    setOpen(true);
    try {
      trackFunnelEvent('private_mode_details_opened', {});
    } catch {
      // Telemetry is advisory. A broken sink must never block the
      // popover — the explainer is the higher-value side effect.
    }
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

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
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Flag OFF → fall back to the legacy static chip. Callers can then
  // swap the old inline chip for this component unconditionally and the
  // visual remains identical when the flag kill-switch is flipped.
  if (!isEnabled()) {
    return (
      <div
        data-testid="private-mode-badge-static"
        data-chat-header-control-variant="status-selector"
        className={BADGE_CLASSNAME}
        title={tooltip}
        aria-label={label}
      >
        <Lock size={11} strokeWidth={2} />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      data-chat-header-control-variant="status-selector"
    >
      <button
        type="button"
        data-testid="private-mode-badge-trigger"
        onClick={open ? handleClose : handleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={open ? undefined : tooltip}
        className={`${BADGE_CLASSNAME} cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900/40 focus:outline-none focus:ring-2 focus:ring-primary-400/50`}
      >
        <Lock size={11} strokeWidth={2} />
        <span>{label}</span>
      </button>

      {open && (
        <div
          role="dialog"
          data-testid="private-mode-details-popover"
          aria-label={t('trust.privateMode.details.title', 'What private mode does')}
          className="absolute top-full right-0 mt-2 z-50 w-80 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-lg p-3 text-[12px] text-slate-700 dark:text-slate-200"
        >
          <div className="font-semibold text-slate-900 dark:text-white mb-2">
            {t('trust.privateMode.details.title', 'What private mode does')}
          </div>

          {/* Row 1 — what IS turned off. Keep phrasing concrete so a
              user who reads it once knows exactly what changed. */}
          <div className="mb-2">
            <div className="font-medium text-emerald-700 dark:text-emerald-300 mb-1">
              {t('trust.privateMode.details.offTitle', 'Turned off for this chat')}
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
              <li>
                {t(
                  'trust.privateMode.details.offItemMemory',
                  'Long-term memory — nothing from this chat is saved to your profile.'
                )}
              </li>
              <li>
                {t(
                  'trust.privateMode.details.offItemPersonalization',
                  'Personalisation — prior preferences are not injected into prompts.'
                )}
              </li>
            </ul>
          </div>

          {/* Row 2 — what is NOT affected. Critical for trust — we do
              not want the user to assume "private" means "air-gapped". */}
          <div className="mb-2">
            <div className="font-medium text-amber-700 dark:text-amber-300 mb-1">
              {t('trust.privateMode.details.onTitle', 'Still happens')}
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
              <li>
                {t(
                  'trust.privateMode.details.onItemModel',
                  'Your messages are still sent to the AI model to produce a reply.'
                )}
              </li>
              <li>
                {t(
                  'trust.privateMode.details.onItemLogs',
                  'Standard operational logs (latency, errors) are retained without message content.'
                )}
              </li>
            </ul>
          </div>

          {/* Row 3 — actionable exit. */}
          <div className="pt-2 border-t border-slate-200 dark:border-navy-800 text-slate-500 dark:text-slate-400">
            {t(
              'trust.privateMode.details.exitHint',
              'To turn off: open the mode menu above and toggle "Private mode" again.'
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivateModeDetails;
