/**
 * Portfolio Colors Configuration
 *
 * Centralized color definitions for portfolio views (Kanban, Timeline, Matrix, List)
 */

// Axis colors for DRD framework — kolory DANYCH kategorycznych (per oś) → paleta c-tag-*.
// Przypisanie po STABILNYM indeksie (kolejność w mapie). NIGDY crimson jako dana
// (digital/ai były bg-/text-primary-* = crimson-leak → usunięte).
// `.bg` = solidny fill kropki/belki kategorii (konsumenci: grid w-1.5 pasek, matrix <circle>).
// UWAGA §15.1: 7 osi > 5 serii widocznych — łamie limit czytelności; do decyzji Piotra
// o grupowaniu osi (zalogowane w RAPORCIE Fala 4). Ten config = wyłącznie klaster Portfolio.
export const AXIS_COLORS = {
  processes: {
    bg: 'bg-c-tag-1',
    text: 'text-c-tag-1',
    border: 'border-c-tag-1',
  },
  digital: {
    bg: 'bg-c-tag-2',
    text: 'text-c-tag-2',
    border: 'border-c-tag-2',
  },
  models: {
    bg: 'bg-c-tag-3',
    text: 'text-c-tag-3',
    border: 'border-c-tag-3',
  },
  data: {
    bg: 'bg-c-tag-4',
    text: 'text-c-tag-4',
    border: 'border-c-tag-4',
  },
  culture: {
    bg: 'bg-c-tag-5',
    text: 'text-c-tag-5',
    border: 'border-c-tag-5',
  },
  cybersecurity: {
    bg: 'bg-c-tag-6',
    text: 'text-c-tag-6',
    border: 'border-c-tag-6',
  },
  ai: {
    bg: 'bg-c-tag-7',
    text: 'text-c-tag-7',
    border: 'border-c-tag-7',
  },
} as const;

export function getAxisColor(axis: string) {
  const normalizedAxis = axis.toLowerCase();
  return AXIS_COLORS[normalizedAxis as keyof typeof AXIS_COLORS] || AXIS_COLORS.processes;
}

// Priority colors
export const PRIORITY_COLORS = {
  CRITICAL: {
    bg: 'bg-danger-100 dark:bg-danger-900/30',
    text: 'text-danger-700 dark:text-danger-300',
    dot: 'bg-danger-500',
  },
  HIGH: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
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
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    bgDark: 'dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    textDark: 'dark:text-amber-300',
    border: 'border-amber-300',
    borderDark: 'dark:border-amber-700',
    indicator: 'bg-amber-500',
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
  // SCHEDULED = status → semantyczny, ale NIGDY crimson (§9.1). primary-* (crimson-leak)
  // → indigo (neutralny „zaplanowane", odróżnia od blue EXECUTING/amber REVIEW).
  SCHEDULED: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    bgDark: 'dark:bg-indigo-900/30',
    text: 'text-indigo-700 dark:text-indigo-300',
    textDark: 'dark:text-indigo-300',
    border: 'border-indigo-300',
    borderDark: 'dark:border-indigo-700',
    indicator: 'bg-indigo-500',
  },
  EXECUTING: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    bgDark: 'dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    textDark: 'dark:text-blue-300',
    border: 'border-blue-300',
    borderDark: 'dark:border-blue-700',
    indicator: 'bg-blue-500',
  },
  BLOCKED: {
    bg: 'bg-danger-100 dark:bg-danger-900/30',
    bgDark: 'dark:bg-danger-900/30',
    text: 'text-danger-700 dark:text-danger-300',
    textDark: 'dark:text-danger-300',
    border: 'border-danger-300',
    borderDark: 'dark:border-danger-700',
    indicator: 'bg-danger-500',
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
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    bgDark: 'dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    textDark: 'dark:text-blue-300',
    border: 'border-blue-300',
    borderDark: 'dark:border-blue-700',
    indicator: 'bg-blue-500',
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
    text: 'text-slate-600 dark:text-slate-400',
    textDark: 'dark:text-slate-400',
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
  PENDING_REVIEW: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  REVIEW: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  PROMOTED: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  PLANNING: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
  APPROVED: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  SCHEDULED: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
  EXECUTING: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  BLOCKED: 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800',
  DONE: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  TRACKING: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  CANCELLED: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800',
  ARCHIVED: 'bg-slate-50 dark:bg-slate-900/30 border-slate-300 dark:border-slate-800',
} as const;

// Timeline colors
export const TIMELINE_COLORS = {
  past: 'bg-slate-200 dark:bg-slate-700',
  current: 'bg-navy-900 dark:bg-slate-300',
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
