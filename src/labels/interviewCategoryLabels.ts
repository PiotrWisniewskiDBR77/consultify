const INTERVIEW_CATEGORY_LABELS = {
  commercial: { pl: 'Komercyjne', en: 'Commercial' },
  strategy: { pl: 'Strategia', en: 'Strategy' },
  operations: { pl: 'Operacje', en: 'Operations' },
  operational: { pl: 'Operacyjne', en: 'Operational' },
  digital: { pl: 'Cyfryzacja', en: 'Digital' },
  people: { pl: 'Ludzie', en: 'People' },
  finance: { pl: 'Finanse', en: 'Finance' },
  cost: { pl: 'Koszty', en: 'Cost' },
  data: { pl: 'Dane', en: 'Data' },
  quick: { pl: 'Szybkie', en: 'Quick' },
  custom: { pl: 'Niestandardowe', en: 'Custom' },
  general: { pl: 'Ogólne', en: 'General' },
  executive: { pl: 'Zarząd', en: 'Executive' },
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
