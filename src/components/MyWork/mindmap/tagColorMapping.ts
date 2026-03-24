export interface TagColorRule {
  tag: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

const TAG_COLOR_MAP: Record<string, { color: string; bg: string; text: string; border: string }> = {
  risk: { color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', border: 'border-red-300 dark:border-red-700' },
  opportunity: { color: '#22c55e', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-300 dark:border-green-700' },
  hypothesis: { color: '#8b5cf6', bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-300 dark:border-violet-700' },
  evidence: { color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700' },
  action: { color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700' },
  question: { color: '#06b6d4', bg: 'bg-cyan-50 dark:bg-cyan-900/20', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-300 dark:border-cyan-700' },
  blocker: { color: '#dc2626', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-200', border: 'border-red-400 dark:border-red-600' },
  insight: { color: '#a855f7', bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-700' },
  decision: { color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-700' },
  goal: { color: '#14b8a6', bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-300 dark:border-teal-700' },
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
