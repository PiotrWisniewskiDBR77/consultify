export const RTL_LANGS = new Set(['ar', 'ar-sa', 'ar-eg']);

export function normalizeLangCode(lang?: string | null): string {
  return String(lang || '')
    .trim()
    .toLowerCase();
}

export function isRtlLanguage(lang?: string | null): boolean {
  const normalized = normalizeLangCode(lang);
  if (!normalized) return false;
  if (RTL_LANGS.has(normalized)) return true;
  const base = normalized.split('-')[0];
  return RTL_LANGS.has(base);
}

export function textDirection(lang?: string | null): 'rtl' | 'ltr' {
  return isRtlLanguage(lang) ? 'rtl' : 'ltr';
}
