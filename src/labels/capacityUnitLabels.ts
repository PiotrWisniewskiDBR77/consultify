const CAPACITY_UNIT_LABELS = {
  MONTH: { pl: 'miesiąc', en: 'month' },
  WEEK: { pl: 'tydzień', en: 'week' },
  'FTE-MONTH': { pl: 'miesiąc FTE', en: 'FTE-month' },
  'FTE-WEEK': { pl: 'tydzień FTE', en: 'FTE-week' },
} as const;

const UNKNOWN_CAPACITY_UNIT = { pl: 'nieznana jednostka', en: 'unknown unit' } as const;

export function capacityUnitLabel(value: string | null | undefined, isPolish: boolean): string {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();
  const labels = CAPACITY_UNIT_LABELS[normalized as keyof typeof CAPACITY_UNIT_LABELS];
  const locale = isPolish ? 'pl' : 'en';
  return labels?.[locale] ?? UNKNOWN_CAPACITY_UNIT[locale];
}

export const capacityUnitLabelEntries = CAPACITY_UNIT_LABELS;
