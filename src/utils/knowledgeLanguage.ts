export type KnowledgeLanguage = 'en' | 'pl' | 'de' | 'ar' | 'ja' | 'es';

const KB_LANGUAGES: KnowledgeLanguage[] = ['en', 'pl', 'de', 'ar', 'ja', 'es'];

export function resolveKnowledgeLanguage(raw: string | undefined | null): KnowledgeLanguage {
  const lang = String(raw || '')
    .trim()
    .toLowerCase();
  const base = lang.split('-')[0];
  // Legacy alias: this app used to store/serve Japanese as 'jp' (not a valid
  // BCP47 subtag) — map any leftover persisted/cached value to 'ja'.
  if (base === 'jp') return 'ja';
  if ((KB_LANGUAGES as string[]).includes(base)) return base as KnowledgeLanguage;
  return 'en';
}
