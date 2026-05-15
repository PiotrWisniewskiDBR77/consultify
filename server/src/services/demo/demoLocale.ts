export type DemoLocale = 'en' | 'pl';

export function normalizeDemoLocale(raw: string | null | undefined): DemoLocale {
  const base = String(raw || '')
    .trim()
    .toLowerCase()
    .split(/[-_,;]/)[0];

  if (base === 'pl') return 'pl';
  return 'en';
}

export function isDemoLocale(value: string | null | undefined): value is DemoLocale {
  return normalizeDemoLocale(value) === value;
}
