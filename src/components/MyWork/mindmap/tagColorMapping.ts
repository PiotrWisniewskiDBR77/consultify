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
    bg: 'bg-c-danger dark:bg-c-danger',
    text: 'text-c-danger dark:text-c-danger',
    border: 'border-c-danger dark:border-c-danger',
  },
  opportunity: {
    color: '#22c55e',
    bg: 'bg-c-success dark:bg-c-success',
    text: 'text-c-success dark:text-c-success',
    border: 'border-c-success dark:border-c-success',
  },
  hypothesis: {
    color: '#6366f1',
    bg: 'bg-c-accent dark:bg-c-accent',
    text: 'text-c-accent dark:text-c-accent',
    border: 'border-c-accent dark:border-c-accent',
  },
  evidence: {
    color: '#3b82f6',
    bg: 'bg-c-info dark:bg-c-info',
    text: 'text-c-info dark:text-c-info',
    border: 'border-c-info dark:border-c-info',
  },
  action: {
    color: '#f59e0b',
    bg: 'bg-c-warning dark:bg-c-warning',
    text: 'text-c-warning dark:text-c-warning',
    border: 'border-c-warning dark:border-c-warning',
  },
  question: {
    color: '#3b82f6',
    bg: 'bg-c-info dark:bg-c-info',
    text: 'text-c-info dark:text-c-info',
    border: 'border-c-info dark:border-c-info',
  },
  blocker: {
    color: '#dc2626',
    bg: 'bg-c-danger dark:bg-c-danger',
    text: 'text-c-danger dark:text-c-danger',
    border: 'border-c-danger dark:border-c-danger',
  },
  insight: {
    color: '#a855f7',
    bg: 'bg-c-accent dark:bg-c-accent',
    text: 'text-c-accent dark:text-c-accent',
    border: 'border-c-accent dark:border-c-accent',
  },
  decision: {
    color: '#10b981',
    bg: 'bg-c-success dark:bg-c-success',
    text: 'text-c-success dark:text-c-success',
    border: 'border-c-success dark:border-c-success',
  },
  goal: {
    color: '#3b82f6',
    bg: 'bg-c-info dark:bg-c-info',
    text: 'text-c-info dark:text-c-info',
    border: 'border-c-info dark:border-c-info',
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
