export interface TagColorRule {
  tag: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

// Node tag colors = DATA (categorical/status). `color` = CSS var string for
// canvas/inline rendering; *Class = theme utility classes. Status tags use
// c-success/warning/danger/info; neutral concept tags use the c-tag identity
// palette (NEVER c-accent/crimson as data).
const TAG_COLOR_MAP: Record<string, { color: string; bg: string; text: string; border: string }> = {
  risk: {
    color: 'var(--c-danger)',
    bg: 'bg-c-danger',
    text: 'text-c-danger',
    border: 'border-c-danger',
  },
  opportunity: {
    color: 'var(--c-success)',
    bg: 'bg-c-success',
    text: 'text-c-success',
    border: 'border-c-success',
  },
  hypothesis: {
    color: 'var(--c-tag-2)',
    bg: 'bg-c-tag-2',
    text: 'text-c-tag-2',
    border: 'border-c-tag-2',
  },
  evidence: {
    color: 'var(--c-info)',
    bg: 'bg-c-info',
    text: 'text-c-info',
    border: 'border-c-info',
  },
  action: {
    color: 'var(--c-warning)',
    bg: 'bg-c-warning',
    text: 'text-c-warning',
    border: 'border-c-warning',
  },
  question: {
    color: 'var(--c-info)',
    bg: 'bg-c-info',
    text: 'text-c-info',
    border: 'border-c-info',
  },
  blocker: {
    color: 'var(--c-danger)',
    bg: 'bg-c-danger',
    text: 'text-c-danger',
    border: 'border-c-danger',
  },
  insight: {
    color: 'var(--c-tag-3)',
    bg: 'bg-c-tag-3',
    text: 'text-c-tag-3',
    border: 'border-c-tag-3',
  },
  decision: {
    color: 'var(--c-success)',
    bg: 'bg-c-success',
    text: 'text-c-success',
    border: 'border-c-success',
  },
  goal: {
    color: 'var(--c-info)',
    bg: 'bg-c-info',
    text: 'text-c-info',
    border: 'border-c-info',
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
  return TAG_COLOR_MAP[lower]?.color || 'var(--c-tag-8)';
}

export const ALL_TAG_COLORS = TAG_COLOR_MAP;
