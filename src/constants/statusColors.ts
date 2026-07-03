/**
 * statusColors.ts — Canonical color palette for all badges, statuses, priorities, and labels.
 *
 * Three visual tiers:
 *   alarm   – Blocked, Overdue, Critical, Rejected  → vivid background
 *   subtle  – Done, Approved, In Progress, Pending   → ghost background + colored text
 *   neutral – Draft, Category, Type labels            → monochromatic slate/navy
 *
 * Semantic palette (5 colors only):
 *   emerald → success (Done, Approved, Active, Completed)
 *   red     → danger  (Blocked, Rejected, Critical, Overdue)
 *   amber   → warning (Pending, Escalated, Due Today, Warning)
 *   blue    → info    (In Progress, Scheduled, Generating, Assigned)
 *   slate   → neutral (Draft, Cancelled, Archived, labels)
 */

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type ColorTier = 'alarm' | 'subtle' | 'neutral';

export interface BadgeStyle {
  /** Background class (includes dark variant) */
  bg: string;
  /** Text color class (includes dark variant) */
  text: string;
  /** Dot / indicator color */
  dot: string;
  /** The visual tier for this status */
  tier: ColorTier;
}

// ─────────────────────────────────────────────
// TIER DEFINITIONS
// ─────────────────────────────────────────────

const ALARM = {
  red: {
    bg: 'bg-danger-100 dark:bg-danger-500/20',
    text: 'text-danger-700 dark:text-danger-400',
    dot: 'bg-danger-500',
    tier: 'alarm' as const,
  },
  amber: {
    bg: 'bg-amber-100 dark:bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
    tier: 'alarm' as const,
  },
};

const SUBTLE = {
  emerald: {
    bg: 'bg-emerald-50/70 dark:bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    tier: 'subtle' as const,
  },
  blue: {
    bg: 'bg-blue-50/70 dark:bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
    tier: 'subtle' as const,
  },
  amber: {
    bg: 'bg-amber-50/70 dark:bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
    tier: 'subtle' as const,
  },
  red: {
    bg: 'bg-danger-50/70 dark:bg-danger-500/10',
    text: 'text-danger-600 dark:text-danger-400',
    dot: 'bg-danger-500',
    tier: 'subtle' as const,
  },
};

const NEUTRAL: BadgeStyle = {
  bg: 'bg-c-surface-raised',
  text: 'text-c-text-secondary',
  dot: 'bg-slate-400 dark:bg-slate-500',
  tier: 'neutral',
};

// ─────────────────────────────────────────────
// STATUS MAP (initiative + assessment + report)
// ─────────────────────────────────────────────

export const STATUS_STYLES: Record<string, BadgeStyle> = {
  // ── Alarm tier ──
  BLOCKED: ALARM.red,
  REJECTED: ALARM.red,

  // ── Subtle tier ──
  DONE: SUBTLE.emerald,
  COMPLETED: SUBTLE.emerald,
  APPROVED: SUBTLE.emerald,
  ACTIVE: SUBTLE.emerald,
  UTILIZED: SUBTLE.emerald,
  TRACKING: SUBTLE.emerald,

  IN_PROGRESS: SUBTLE.blue,
  EXECUTING: SUBTLE.blue,
  SCHEDULED: SUBTLE.blue,
  GENERATING: SUBTLE.blue,
  PROMOTED: SUBTLE.blue,

  PENDING: SUBTLE.amber,
  PENDING_REVIEW: SUBTLE.amber,
  PENDING_APPROVAL: SUBTLE.amber,
  AWAITING_APPROVAL: SUBTLE.amber,
  IN_REVIEW: SUBTLE.amber,
  REVIEW: SUBTLE.amber,
  PLANNING: SUBTLE.amber,
  ESCALATED: SUBTLE.amber,

  // ── Neutral tier ──
  DRAFT: NEUTRAL,
  CANCELLED: NEUTRAL,
  ARCHIVED: NEUTRAL,
  FINAL: NEUTRAL,
  DEFAULT: NEUTRAL,
};

/**
 * Get badge style for a status string.
 * Case-insensitive, normalises spaces to underscores.
 */
export function getStatusStyle(status?: string): BadgeStyle {
  if (!status) return NEUTRAL;
  const key = status.toUpperCase().replace(/[\s-]+/g, '_');
  return STATUS_STYLES[key] || NEUTRAL;
}

// ─────────────────────────────────────────────
// PRIORITY MAP
// ─────────────────────────────────────────────

export const PRIORITY_STYLES: Record<string, BadgeStyle> = {
  CRITICAL: ALARM.red,
  URGENT: ALARM.red,
  HIGH: ALARM.amber,
  MEDIUM: { ...SUBTLE.blue, tier: 'subtle' },
  LOW: NEUTRAL,
  NORMAL: NEUTRAL,
};

/**
 * Get badge style for a priority string.
 */
export function getPriorityStyle(priority?: string): BadgeStyle {
  if (!priority) return NEUTRAL;
  const key = priority.toUpperCase().replace(/[\s-]+/g, '_');
  return PRIORITY_STYLES[key] || NEUTRAL;
}

// ─────────────────────────────────────────────
// TYPE / CATEGORY — always neutral
// ─────────────────────────────────────────────

/**
 * Type and category labels (APPROVAL, VENDOR_SELECTION, Strategic, digital, etc.)
 * are ALWAYS neutral — they are informational labels, not statuses.
 */
export function getTypeStyle(_type?: string): BadgeStyle {
  return NEUTRAL;
}

// ─────────────────────────────────────────────
// DUE DATE STYLES
// ─────────────────────────────────────────────

export const DUE_DATE_STYLES: Record<string, BadgeStyle> = {
  overdue: ALARM.red,
  due_today: ALARM.amber,
  due_soon: SUBTLE.amber,
  upcoming: NEUTRAL,
  completed: SUBTLE.emerald,
  no_date: {
    bg: 'bg-c-surface-raised',
    text: 'text-c-text-secondary',
    dot: 'bg-slate-300 dark:bg-slate-600',
    tier: 'neutral',
  },
};

// ─────────────────────────────────────────────
// NOTIFICATION SEVERITY
// ─────────────────────────────────────────────

export const SEVERITY_STYLES: Record<string, BadgeStyle> = {
  CRITICAL: ALARM.red,
  WARNING: ALARM.amber,
  INFO: NEUTRAL,
};

export function getSeverityStyle(severity?: string): BadgeStyle {
  if (!severity) return NEUTRAL;
  return SEVERITY_STYLES[severity.toUpperCase()] || NEUTRAL;
}

// ─────────────────────────────────────────────
// STATUS DOT COLORS (for dropdown / filter indicators)
// ─────────────────────────────────────────────

/**
 * Returns just the dot-color class for a status (used in StatusDropdown triggers).
 */
export function getStatusDotColor(status?: string): string {
  return getStatusStyle(status).dot;
}

// ─────────────────────────────────────────────
// PILL NAVIGATION — single active color
// ─────────────────────────────────────────────

/** Active pill tab style — ONE color, not per-tab rainbow */
export const PILL_ACTIVE = 'bg-slate-800 dark:bg-white/15 text-white';
export const PILL_INACTIVE =
  'text-c-text-secondary hover:bg-slate-200/80 dark:hover:bg-navy-800/60';

// ─────────────────────────────────────────────
// PROGRESS BAR COLOR
// ─────────────────────────────────────────────

/** Standard progress bar fill — always primary, green when 100% */
export const PROGRESS_BAR_FILL = 'bg-navy-900';
export const PROGRESS_BAR_COMPLETE = 'bg-emerald-500';
export const PROGRESS_BAR_TRACK = 'bg-c-border-subtle';
