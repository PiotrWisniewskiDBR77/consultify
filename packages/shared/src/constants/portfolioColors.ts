/**
 * Portfolio Color Configuration
 *
 * Centralized color definitions for portfolio components.
 * Uses explicit Tailwind classes (no dynamic string interpolation).
 */

// ============================================
// STATUS COLORS
// ============================================

export interface StatusColorConfig {
  bg: string;
  bgDark: string;
  text: string;
  textDark: string;
  border: string;
  borderDark: string;
  indicator: string;
}

export const STATUS_COLORS: Record<string, StatusColorConfig> = {
  DRAFT: {
    bg: 'bg-slate-100',
    bgDark: 'dark:bg-slate-800',
    text: 'text-slate-600',
    textDark: 'dark:text-slate-400',
    border: 'border-slate-300',
    borderDark: 'dark:border-slate-600',
    indicator: 'bg-slate-400',
  },
  PLANNING: {
    bg: 'bg-amber-100',
    bgDark: 'dark:bg-amber-900/30',
    text: 'text-amber-700',
    textDark: 'dark:text-amber-400',
    border: 'border-amber-300',
    borderDark: 'dark:border-amber-600',
    indicator: 'bg-amber-500',
  },
  REVIEW: {
    bg: 'bg-yellow-100',
    bgDark: 'dark:bg-yellow-900/30',
    text: 'text-yellow-700',
    textDark: 'dark:text-yellow-400',
    border: 'border-yellow-300',
    borderDark: 'dark:border-yellow-600',
    indicator: 'bg-yellow-500',
  },
  APPROVED: {
    bg: 'bg-blue-100',
    bgDark: 'dark:bg-blue-900/30',
    text: 'text-blue-700',
    textDark: 'dark:text-blue-400',
    border: 'border-blue-300',
    borderDark: 'dark:border-blue-600',
    indicator: 'bg-blue-500',
  },
  EXECUTING: {
    bg: 'bg-purple-100',
    bgDark: 'dark:bg-purple-900/30',
    text: 'text-purple-700',
    textDark: 'dark:text-purple-400',
    border: 'border-purple-300',
    borderDark: 'dark:border-purple-600',
    indicator: 'bg-purple-500',
  },
  DONE: {
    bg: 'bg-green-100',
    bgDark: 'dark:bg-green-900/30',
    text: 'text-green-700',
    textDark: 'dark:text-green-400',
    border: 'border-green-300',
    borderDark: 'dark:border-green-600',
    indicator: 'bg-green-500',
  },
  BLOCKED: {
    bg: 'bg-red-100',
    bgDark: 'dark:bg-red-900/30',
    text: 'text-red-700',
    textDark: 'dark:text-red-400',
    border: 'border-red-300',
    borderDark: 'dark:border-red-600',
    indicator: 'bg-red-500',
  },
  CANCELLED: {
    bg: 'bg-gray-100',
    bgDark: 'dark:bg-gray-800',
    text: 'text-gray-500',
    textDark: 'dark:text-gray-400',
    border: 'border-gray-300',
    borderDark: 'dark:border-gray-600',
    indicator: 'bg-gray-400',
  },
  ARCHIVED: {
    bg: 'bg-gray-50',
    bgDark: 'dark:bg-gray-900',
    text: 'text-gray-400',
    textDark: 'dark:text-gray-500',
    border: 'border-gray-200',
    borderDark: 'dark:border-gray-700',
    indicator: 'bg-gray-300',
  },
};

export const getStatusColors = (status: string): StatusColorConfig => {
  return STATUS_COLORS[status] || STATUS_COLORS.DRAFT;
};

export const getStatusClasses = (status: string): string => {
  const colors = getStatusColors(status);
  return `${colors.bg} ${colors.bgDark} ${colors.text} ${colors.textDark}`;
};

// ============================================
// PRIORITY COLORS
// ============================================

export interface PriorityColorConfig {
  bg: string;
  bgDark: string;
  text: string;
  textDark: string;
  dot: string;
}

export const PRIORITY_COLORS: Record<string, PriorityColorConfig> = {
  CRITICAL: {
    bg: 'bg-red-500',
    bgDark: 'dark:bg-red-600',
    text: 'text-white',
    textDark: 'dark:text-white',
    dot: 'bg-red-500',
  },
  HIGH: {
    bg: 'bg-orange-500',
    bgDark: 'dark:bg-orange-600',
    text: 'text-white',
    textDark: 'dark:text-white',
    dot: 'bg-orange-500',
  },
  MEDIUM: {
    bg: 'bg-blue-500',
    bgDark: 'dark:bg-blue-600',
    text: 'text-white',
    textDark: 'dark:text-white',
    dot: 'bg-blue-500',
  },
  LOW: {
    bg: 'bg-green-500',
    bgDark: 'dark:bg-green-600',
    text: 'text-white',
    textDark: 'dark:text-white',
    dot: 'bg-green-500',
  },
};

export const getPriorityColors = (priority: string): PriorityColorConfig => {
  return PRIORITY_COLORS[priority] || PRIORITY_COLORS.MEDIUM;
};

export const getPriorityClasses = (priority: string): string => {
  const colors = getPriorityColors(priority);
  return `${colors.bg} ${colors.bgDark} ${colors.text} ${colors.textDark}`;
};

// ============================================
// KANBAN COLUMN COLORS
// ============================================

export const KANBAN_COLUMN_COLORS: Record<string, { header: string; bg: string }> = {
  DRAFT: {
    header: 'bg-slate-200 dark:bg-slate-800',
    bg: 'bg-slate-50 dark:bg-slate-900/50',
  },
  PLANNING: {
    header: 'bg-amber-200 dark:bg-amber-900/50',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
  },
  REVIEW: {
    header: 'bg-yellow-200 dark:bg-yellow-900/50',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
  },
  APPROVED: {
    header: 'bg-blue-200 dark:bg-blue-900/50',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
  },
  EXECUTING: {
    header: 'bg-purple-200 dark:bg-purple-900/50',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
  },
};

// ============================================
// TIMELINE COLORS
// ============================================

export const TIMELINE_COLORS = {
  today: 'bg-red-500',
  criticalPath: 'bg-red-400 dark:bg-red-600',
  dependency: 'stroke-slate-400 dark:stroke-slate-600',
  milestone: 'bg-purple-500 dark:bg-purple-400',
};

// ============================================
// MATRIX QUADRANT COLORS
// ============================================

export const MATRIX_QUADRANT_COLORS = {
  quickWins: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    label: 'text-green-700 dark:text-green-400',
  },
  majorInvest: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    label: 'text-blue-700 dark:text-blue-400',
  },
  niceToHave: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    label: 'text-amber-700 dark:text-amber-400',
  },
  avoid: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    label: 'text-red-700 dark:text-red-400',
  },
};

// ============================================
// AXIS COLORS (for initiative categories)
// ============================================

export const AXIS_COLORS: Record<string, string> = {
  processes: 'bg-blue-500',
  digitalProducts: 'bg-purple-500',
  businessModels: 'bg-green-500',
  dataManagement: 'bg-cyan-500',
  culture: 'bg-amber-500',
  cybersecurity: 'bg-red-500',
  aiMaturity: 'bg-pink-500',
};

export const getAxisColor = (axis: string): string => {
  return AXIS_COLORS[axis] || 'bg-slate-500';
};
