export type LabelLocale = 'pl' | 'en';

const IDEA_SOURCE_LABELS = {
  manual: { pl: 'Ręcznie', en: 'Manual' },
  ai: { pl: 'AI', en: 'AI' },
} as const;

const UNKNOWN_IDEA_SOURCE = {
  pl: 'Nieznane źródło',
  en: 'Unknown source',
} as const;

export function sourceLabel(value: string | null | undefined, isPolish: boolean): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  const labels = IDEA_SOURCE_LABELS[normalized as keyof typeof IDEA_SOURCE_LABELS];
  const locale: LabelLocale = isPolish ? 'pl' : 'en';
  return labels?.[locale] ?? UNKNOWN_IDEA_SOURCE[locale];
}

export const ideaSourceLabelEntries = IDEA_SOURCE_LABELS;
