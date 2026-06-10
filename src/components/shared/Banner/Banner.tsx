/**
 * Banner — canonical inline module banner (Wave 1 design system)
 *
 * A standardized, soft, rounded inline banner for surfacing module-level
 * status: info, warning, danger, success, or a degraded/partial state.
 * Uses the semantic `--c-*` status tokens (via the Tailwind `c` namespace)
 * so it adapts to light + dark automatically with no gradients.
 *
 * Replaces bespoke per-module banners (e.g. FinanceDegradedBanner) so every
 * module surfaces status the same way.
 *
 * @example
 * <Banner
 *   variant="degraded"
 *   title="Finance lane has 2 active issue(s)"
 *   message="Revenue model out of date: re-run the projection."
 *   action={{ label: 'View all', onClick: openIssues }}
 * />
 */

import { AlertTriangle, CheckCircle2, Info, OctagonAlert, WifiOff, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';

export type BannerVariant = 'info' | 'warning' | 'danger' | 'success' | 'degraded';

export interface BannerAction {
  /** Visible button label */
  label: string;
  /** Click handler */
  onClick: () => void;
}

export interface BannerProps {
  /** Status variant — drives color tokens, icon and a11y role */
  variant: BannerVariant;
  /** Short, bold headline */
  title: string;
  /** Optional supporting body copy */
  message?: React.ReactNode;
  /** Optional inline action button rendered on the right */
  action?: BannerAction;
  /** When true, renders a dismiss (×) control */
  dismissible?: boolean;
  /** Fired after the banner is dismissed */
  onDismiss?: () => void;
  /** Override the default per-variant icon. Pass `null` to hide the icon. */
  icon?: React.ReactNode | null;
  /** Additional class names on the root */
  className?: string;
}

interface VariantStyle {
  /** Root container surface + border classes */
  container: string;
  /** Icon color */
  icon: string;
  /** Title text color */
  title: string;
  /** Body text color */
  message: string;
  /** Action button classes */
  action: string;
  /** Default icon element */
  defaultIcon: React.ReactNode;
}

const ICON_SIZE = 16;

const VARIANT_STYLES: Record<BannerVariant, VariantStyle> = {
  info: {
    container: 'bg-c-info/[0.08] border-c-info/25',
    icon: 'text-c-info',
    title: 'text-c-text',
    message: 'text-c-text-secondary',
    action: 'text-c-info hover:bg-c-info/10',
    defaultIcon: <Info size={ICON_SIZE} aria-hidden="true" />,
  },
  warning: {
    container: 'bg-c-warning/[0.08] border-c-warning/25',
    icon: 'text-c-warning',
    title: 'text-c-text',
    message: 'text-c-text-secondary',
    action: 'text-c-warning hover:bg-c-warning/10',
    defaultIcon: <AlertTriangle size={ICON_SIZE} aria-hidden="true" />,
  },
  danger: {
    container: 'bg-c-danger/[0.08] border-c-danger/25',
    icon: 'text-c-danger',
    title: 'text-c-text',
    message: 'text-c-text-secondary',
    action: 'text-c-danger hover:bg-c-danger/10',
    defaultIcon: <OctagonAlert size={ICON_SIZE} aria-hidden="true" />,
  },
  success: {
    container: 'bg-c-success/[0.08] border-c-success/25',
    icon: 'text-c-success',
    title: 'text-c-text',
    message: 'text-c-text-secondary',
    action: 'text-c-success hover:bg-c-success/10',
    defaultIcon: <CheckCircle2 size={ICON_SIZE} aria-hidden="true" />,
  },
  degraded: {
    container: 'bg-c-warning/[0.06] border-c-warning/20',
    icon: 'text-c-warning',
    title: 'text-c-text',
    message: 'text-c-text-secondary',
    action: 'text-c-warning hover:bg-c-warning/10',
    defaultIcon: <WifiOff size={ICON_SIZE} aria-hidden="true" />,
  },
};

/** Variants that warrant an assertive a11y announcement. */
const ALERT_VARIANTS: ReadonlySet<BannerVariant> = new Set<BannerVariant>(['danger']);

export const Banner: React.FC<BannerProps> = ({
  variant,
  title,
  message,
  action,
  dismissible = false,
  onDismiss,
  icon,
  className = '',
}) => {
  const [dismissed, setDismissed] = useState(false);
  const styles = VARIANT_STYLES[variant];

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  if (dismissed) return null;

  const resolvedIcon = icon === undefined ? styles.defaultIcon : icon;
  const isAlert = ALERT_VARIANTS.has(variant);

  return (
    <div
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
      className={`flex items-start gap-3 rounded-xl border p-3 ${styles.container} ${className}`.trim()}
    >
      {resolvedIcon !== null && (
        <span className={`mt-0.5 flex-shrink-0 ${styles.icon}`}>{resolvedIcon}</span>
      )}

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold leading-snug ${styles.title}`}>{title}</p>
        {message != null && message !== '' && (
          <div className={`mt-0.5 text-xs leading-relaxed ${styles.message}`}>{message}</div>
        )}
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={`flex-shrink-0 rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${styles.action}`}
        >
          {action.label}
        </button>
      )}

      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 rounded-lg p-1 text-c-text-muted transition-colors hover:bg-c-border-subtle hover:text-c-text"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

Banner.displayName = 'Banner';

export default Banner;
