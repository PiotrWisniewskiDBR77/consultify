const INTERVIEW_CATEGORY_LABELS = {
  commercial: { pl: 'Komercyjne', en: 'Commercial' },
} as const;

const UNKNOWN_INTERVIEW_CATEGORY = {
  pl: 'Inna kategoria',
  en: 'Other category',
} as const;

export function normalizeTemplateCategory(
  value: string | null | undefined,
  isPolish = true
): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  const labels = INTERVIEW_CATEGORY_LABELS[normalized as keyof typeof INTERVIEW_CATEGORY_LABELS];
  const locale = isPolish ? 'pl' : 'en';
  return labels?.[locale] ?? UNKNOWN_INTERVIEW_CATEGORY[locale];
}

export const interviewCategoryLabelEntries = INTERVIEW_CATEGORY_LABELS;
