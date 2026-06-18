export interface TagColorRule {
  tag: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

const TAG_COLOR_MAP: Record<string, { color: string; bg: string; text: string; border: string }> = {
  risk: {
    color: '#f43f5e',
    bg: 'bg-danger-50 dark:bg-danger-900/20',
    text: 'text-danger-700 dark:text-danger-300',
    border: 'border-danger-300 dark:border-danger-700',
  },
  opportunity: {
    color: '#22c55e',
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-300 dark:border-green-700',
  },
  hypothesis: {
    color: '#6366f1',
    bg: 'bg-primary-50 dark:bg-primary-900/20',
    text: 'text-primary-700 dark:text-primary-300',
    border: 'border-primary-300 dark:border-primary-700',
  },
  evidence: {
    color: '#3b82f6',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-700',
  },
  action: {
    color: '#f59e0b',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700',
  },
  question: {
    color: '#3b82f6',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-700',
  },
  blocker: {
    color: '#dc2626',
    bg: 'bg-danger-100 dark:bg-danger-900/30',
    text: 'text-danger-800 dark:text-danger-200',
    border: 'border-danger-400 dark:border-danger-600',
  },
  insight: {
    color: '#a855f7',
    bg: 'bg-primary-50 dark:bg-primary-900/20',
    text: 'text-primary-700 dark:text-primary-300',
    border: 'border-primary-300 dark:border-primary-700',
  },
  decision: {
    color: '#10b981',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-700',
  },
  goal: {
    color: '#3b82f6',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-700',
  },
};

export function resolveTagColor(tags: string[]): TagColorRule | null {
  if (!tags || tags.length === 0) return null;
  const firstTag = tags[0].toLowerCase().trim();
  const match = TAG_COLOR_MAP[firstTag];
  if (!match) return null;
  return {
    tag: firstTag,
    color: match.color,
    bgClass: match.bg,
    textClass: match.text,
    borderClass: match.border,
  };
}

export function getTagColor(tag: string): string {
  const lower = tag.toLowerCase().trim();
  return TAG_COLOR_MAP[lower]?.color || '#94a3b8';
}

export const ALL_TAG_COLORS = TAG_COLOR_MAP;
