/**
 * Portfolio Colors Configuration
 *
 * Centralized color definitions for portfolio views (Kanban, Timeline, Matrix, List)
 */

// Axis colors for DRD framework
export const AXIS_COLORS = {
  processes: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  digital: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
  },
  models: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  data: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  culture: {
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
  },
  cybersecurity: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
  },
  ai: {
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-800',
  },
} as const;

export function getAxisColor(axis: string) {
  const normalizedAxis = axis.toLowerCase();
  return AXIS_COLORS[normalizedAxis as keyof typeof AXIS_COLORS] || AXIS_COLORS.processes;
}

// Priority colors
export const PRIORITY_COLORS = {
  CRITICAL: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
  },
  HIGH: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-300',
    dot: 'bg-orange-500',
  },
  MEDIUM: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-300',
    dot: 'bg-yellow-500',
  },
  LOW: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
} as const;

export function getPriorityColors(priority: string) {
  return PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.MEDIUM;
}

export function getPriorityClasses(priority: string) {
  return getPriorityColors(priority);
}

// Status colors — complete set covering all 13 InitiativeStatus values
export const STATUS_COLORS = {
  DRAFT: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    bgDark: 'dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    textDark: 'dark:text-slate-400',
    border: 'border-slate-300',
    borderDark: 'dark:border-slate-700',
    indicator: 'bg-slate-400',
  },
  PENDING_REVIEW: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    bgDark: 'dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-300',
    textDark: 'dark:text-orange-300',
    border: 'border-orange-300',
    borderDark: 'dark:border-orange-700',
    indicator: 'bg-orange-500',
  },
  REVIEW: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    bgDark: 'dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    textDark: 'dark:text-amber-300',
    border: 'border-amber-300',
    borderDark: 'dark:border-amber-700',
    indicator: 'bg-amber-500',
  },
  PROMOTED: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    bgDark: 'dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    textDark: 'dark:text-blue-300',
    border: 'border-blue-300',
    borderDark: 'dark:border-blue-700',
    indicator: 'bg-blue-500',
  },
  PLANNING: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    bgDark: 'dark:bg-indigo-900/30',
    text: 'text-indigo-700 dark:text-indigo-300',
    textDark: 'dark:text-indigo-300',
    border: 'border-indigo-300',
    borderDark: 'dark:border-indigo-700',
    indicator: 'bg-indigo-500',
  },
  APPROVED: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    bgDark: 'dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    textDark: 'dark:text-emerald-300',
    border: 'border-emerald-300',
    borderDark: 'dark:border-emerald-700',
    indicator: 'bg-emerald-500',
  },
  SCHEDULED: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    bgDark: 'dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-300',
    textDark: 'dark:text-purple-300',
    border: 'border-purple-300',
    borderDark: 'dark:border-purple-700',
    indicator: 'bg-purple-500',
  },
  EXECUTING: {
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    bgDark: 'dark:bg-cyan-900/30',
    text: 'text-cyan-700 dark:text-cyan-300',
    textDark: 'dark:text-cyan-300',
    border: 'border-cyan-300',
    borderDark: 'dark:border-cyan-700',
    indicator: 'bg-cyan-500',
  },
  BLOCKED: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    bgDark: 'dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    textDark: 'dark:text-red-300',
    border: 'border-red-300',
    borderDark: 'dark:border-red-700',
    indicator: 'bg-red-500',
  },
  DONE: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    bgDark: 'dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
    textDark: 'dark:text-green-300',
    border: 'border-green-300',
    borderDark: 'dark:border-green-700',
    indicator: 'bg-green-500',
  },
  TRACKING: {
    bg: 'bg-teal-100 dark:bg-teal-900/30',
    bgDark: 'dark:bg-teal-900/30',
    text: 'text-teal-700 dark:text-teal-300',
    textDark: 'dark:text-teal-300',
    border: 'border-teal-300',
    borderDark: 'dark:border-teal-700',
    indicator: 'bg-teal-500',
  },
  CANCELLED: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    bgDark: 'dark:bg-gray-800',
    text: 'text-gray-500 dark:text-gray-500',
    textDark: 'dark:text-gray-500',
    border: 'border-gray-300',
    borderDark: 'dark:border-gray-700',
    indicator: 'bg-gray-400',
  },
  ARCHIVED: {
    bg: 'bg-slate-50 dark:bg-slate-900',
    bgDark: 'dark:bg-slate-900',
    text: 'text-slate-400 dark:text-slate-600',
    textDark: 'dark:text-slate-600',
    border: 'border-slate-200',
    borderDark: 'dark:border-slate-800',
    indicator: 'bg-slate-300',
  },
} as const;

export function getStatusColors(status: string) {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.DRAFT;
}

export function getStatusClasses(status: string) {
  return getStatusColors(status);
}

// Kanban column colors — complete set matching all 13 statuses
export const KANBAN_COLUMN_COLORS = {
  DRAFT: 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800',
  PENDING_REVIEW: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  REVIEW: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  PROMOTED: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  PLANNING: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
  APPROVED: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  SCHEDULED: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
  EXECUTING: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800',
  BLOCKED: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  DONE: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  TRACKING: 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800',
  CANCELLED: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800',
  ARCHIVED: 'bg-slate-50 dark:bg-slate-900/30 border-slate-300 dark:border-slate-800',
} as const;

// Timeline colors
export const TIMELINE_COLORS = {
  past: 'bg-slate-200 dark:bg-slate-700',
  current: 'bg-violet-500 dark:bg-violet-600',
  future: 'bg-slate-300 dark:bg-slate-600',
  milestone: 'bg-amber-500 dark:bg-amber-600',
} as const;

// Matrix quadrant colors
export const MATRIX_QUADRANT_COLORS = {
  'high-high': {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-300 dark:border-emerald-700',
    label: 'text-emerald-700 dark:text-emerald-300',
  },
  'high-low': {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-300 dark:border-amber-700',
    label: 'text-amber-700 dark:text-amber-300',
  },
  'low-high': {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-300 dark:border-blue-700',
    label: 'text-blue-700 dark:text-blue-300',
  },
  'low-low': {
    bg: 'bg-slate-50 dark:bg-slate-900/20',
    border: 'border-slate-300 dark:border-slate-700',
    label: 'text-slate-600 dark:text-slate-400',
  },
  // Named quadrant colors (aliases)
  quickWins: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-300 dark:border-emerald-700',
    label: 'text-emerald-700 dark:text-emerald-300',
  },
  majorInvest: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-300 dark:border-amber-700',
    label: 'text-amber-700 dark:text-amber-300',
  },
  niceToHave: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-300 dark:border-blue-700',
    label: 'text-blue-700 dark:text-blue-300',
  },
  avoid: {
    bg: 'bg-slate-50 dark:bg-slate-900/20',
    border: 'border-slate-300 dark:border-slate-700',
    label: 'text-slate-600 dark:text-slate-400',
  },
} as const;
