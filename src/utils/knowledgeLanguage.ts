export function resolveKnowledgeLanguage(raw: string | undefined | null): 'en' | 'pl' | 'de' {
  const lang = String(raw || '').trim().toLowerCase();
  if (lang === 'pl' || lang.startsWith('pl-')) return 'pl';
  if (lang === 'de' || lang.startsWith('de-')) return 'de';
  return 'en';
}
