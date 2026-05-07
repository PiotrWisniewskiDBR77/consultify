/**
 * SubscriberHealthBadge
 *
 * Compact, accessible health indicator for the read-only subscriber
 * dashboard. Mirrors the three states emitted by
 * `presentationSubscriberDashboardService.buildSubscriberDashboardSnapshot`:
 *
 *   - `healthy`   → emerald check
 *   - `degraded`  → amber alert
 *   - `unhealthy` → rose cross
 *
 * Reasons (when present) are surfaced via the native `title` tooltip
 * AND embedded in `aria-label` so screen readers announce both the
 * state and the underlying explanation. The badge is purely
 * presentational — it never re-classifies the data; the server is the
 * source of truth.
 */

import { CheckCircle2, ShieldAlert, ShieldOff } from 'lucide-react';
import React from 'react';

import type { SubscriberHealthOverall } from '../../services/subscriberDashboardClient';

const COPY = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  unhealthy: 'Unhealthy',
} as const;

const TONE: Record<SubscriberHealthOverall, string> = {
  healthy:
    'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/30',
  degraded:
    'bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-500/30',
  unhealthy:
    'bg-rose-100 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:ring-rose-500/30',
};

const ICON: Record<
  SubscriberHealthOverall,
  React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
> = {
  healthy: CheckCircle2,
  degraded: ShieldAlert,
  unhealthy: ShieldOff,
};

export interface SubscriberHealthBadgeProps {
  overall: SubscriberHealthOverall;
  reasons?: string[];
  className?: string;
  size?: 'sm' | 'md';
}

const SubscriberHealthBadge: React.FC<SubscriberHealthBadgeProps> = ({
  overall,
  reasons = [],
  className = '',
  size = 'md',
}) => {
  const Icon = ICON[overall];
  const label = COPY[overall];
  const reasonText = reasons.filter((r) => typeof r === 'string' && r.length > 0).join(' · ');
  const ariaLabel = reasonText
    ? `${label}: ${reasonText}`
    : `Subscription health: ${label}`;

  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      title={reasonText || label}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${padding} ${TONE[overall]} ${className}`.trim()}
    >
      <Icon size={iconSize} aria-hidden className="shrink-0" />
      {label}
    </span>
  );
};

export default SubscriberHealthBadge;
