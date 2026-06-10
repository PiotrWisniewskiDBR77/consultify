/**
 * OnboardingHint - Shared state primitive (X1 Design System)
 *
 * Dismissible onboarding nudge. The `inline` / `banner` variants render a
 * crimson-tinted banner with a left brand border and a dismiss control whose
 * state persists in localStorage. The `tooltip` variant simply wraps children
 * (placeholder until tooltip behaviour is wired) and respects dismissal too.
 *
 * @example
 * <OnboardingHint
 *   id="mywork-intro"
 *   title="Welcome to My Work"
 *   body="Everything assigned to you lives here."
 *   ctaLabel="Learn more"
 *   ctaHref="/docs/my-work"
 * />
 */

import { X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'onboarding_dismissed';

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistDismissed(id: string): void {
  try {
    const next = Array.from(new Set([...readDismissed(), id]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* localStorage unavailable — fail silently */
  }
}

export interface OnboardingHintProps {
  /** Stable id persisted to localStorage to remember dismissal */
  id: string;
  /** Hint title */
  title: string;
  /** Hint body copy */
  body: string;
  /** Optional CTA label */
  ctaLabel?: string;
  /** Optional CTA href */
  ctaHref?: string;
  /** Presentation style */
  position?: 'inline' | 'tooltip' | 'banner';
  /** For the tooltip variant — the element the hint wraps */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export const OnboardingHint: React.FC<OnboardingHintProps> = ({
  id,
  title,
  body,
  ctaLabel,
  ctaHref,
  position = 'inline',
  children,
  className = '',
}) => {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(readDismissed().includes(id));
  }, [id]);

  const handleDismiss = useCallback(() => {
    persistDismissed(id);
    setDismissed(true);
  }, [id]);

  if (position === 'tooltip') {
    // Placeholder: render children; dismissal still respected for future tooltip wiring.
    return <>{children}</>;
  }

  if (dismissed) return null;

  return (
    <div
      role="note"
      className={`relative flex items-start gap-3 rounded-token-md border-l-4 border-crimson-600 bg-crimson-50 p-4 pr-10 dark:border-crimson-400 dark:bg-crimson-950/40 ${className}`.trim()}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-navy-900 dark:text-white">{title}</p>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-300">{body}</p>
        {ctaLabel && ctaHref && (
          <a
            href={ctaHref}
            className="mt-2 inline-block text-sm font-medium text-crimson-600 hover:text-crimson-700 dark:text-crimson-400 dark:hover:text-crimson-300"
          >
            {ctaLabel}
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 rounded-token-sm p-1 text-navy-400 transition-colors hover:bg-crimson-100 hover:text-navy-600 dark:hover:bg-crimson-900/40 dark:hover:text-white"
      >
        <X size={16} />
      </button>
    </div>
  );
};

OnboardingHint.displayName = 'OnboardingHint';

export default OnboardingHint;
