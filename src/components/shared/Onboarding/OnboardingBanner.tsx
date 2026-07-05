/**
 * OnboardingBanner — first-use guidance banner for empty modules (Wave 1).
 *
 * A soft, crimson-accented card shown when a module has no content yet:
 * icon + title + body + primary CTA + optional dismiss. Light + dark via the
 * semantic `--c-*` tokens, no gradients.
 *
 * Distinct from the tooltip-style `OnboardingHint` primitive: this is a
 * prominent empty-state surface, not an inline nudge.
 *
 * @example
 * <OnboardingBanner
 *   icon={<Sparkles size={20} />}
 *   title="Start your first projection"
 *   body="Add revenue and cost lines and Teresa will model the runway for you."
 *   cta={{ label: 'New projection', onClick: createProjection }}
 *   dismissible
 *   onDismiss={hideOnboarding}
 * />
 */

import { X } from 'lucide-react';
import React, { useCallback, useState } from 'react';

export interface OnboardingBannerCta {
  /** CTA button label */
  label: string;
  /** CTA click handler */
  onClick: () => void;
}

export interface OnboardingBannerProps {
  /** Title headline */
  title: string;
  /** Supporting body copy */
  body: React.ReactNode;
  /** Leading icon (rendered inside a crimson chip). Pass `null` to hide. */
  icon?: React.ReactNode | null;
  /** Primary call-to-action button */
  cta?: OnboardingBannerCta;
  /** When true, renders a dismiss (×) control */
  dismissible?: boolean;
  /** Fired after the banner is dismissed */
  onDismiss?: () => void;
  /** Additional class names on the root */
  className?: string;
}

export const OnboardingBanner: React.FC<OnboardingBannerProps> = ({
  title,
  body,
  icon,
  cta,
  dismissible = false,
  onDismiss,
  className = '',
}) => {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  if (dismissed) return null;

  return (
    <div
      role="region"
      aria-label={title}
      className={`relative flex items-start gap-4 rounded-xl border border-c-border-subtle bg-c-accent-soft p-4 ${className}`.trim()}
    >
      {icon !== null && icon !== undefined && (
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-c-accent-soft text-c-accent">
          {icon}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-c-text">{title}</p>
        <div className="mt-1 text-sm leading-relaxed text-c-text-secondary">{body}</div>

        {cta && (
          <button
            type="button"
            onClick={cta.onClick}
            className="mt-3 inline-flex items-center rounded-full bg-c-accent px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {cta.label}
          </button>
        )}
      </div>

      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 rounded-lg p-1 text-c-text-muted transition-colors hover:bg-c-surface-raised hover:text-c-text"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

OnboardingBanner.displayName = 'OnboardingBanner';

export default OnboardingBanner;
