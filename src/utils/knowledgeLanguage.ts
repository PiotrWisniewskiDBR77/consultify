export type KnowledgeLanguage = 'en' | 'pl' | 'de' | 'ar' | 'jp' | 'es';

const KB_LANGUAGES: KnowledgeLanguage[] = ['en', 'pl', 'de', 'ar', 'jp', 'es'];

export function resolveKnowledgeLanguage(raw: string | undefined | null): KnowledgeLanguage {
  const lang = String(raw || '').trim().toLowerCase();
  const base = lang.split('-')[0];
  if (base === 'ja') return 'jp';
  if ((KB_LANGUAGES as string[]).includes(base)) return base as KnowledgeLanguage;
  return 'en';
}
