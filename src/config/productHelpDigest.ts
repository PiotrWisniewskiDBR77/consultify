import { HELP_DOCUMENTS, getLocalizedText, type SupportedHelpLanguage } from './helpExperience';

/**
 * Single source of truth digest of the in-app Help documentation, condensed for
 * AI assistants (Anna on the landing page, Teresa voice copilot). It is derived
 * directly from HELP_DOCUMENTS so it can never drift from what users see in the
 * Help panel. Keep it compact — it is injected into voice system instructions.
 */

// Curated, ordered list of product-facing modules. We intentionally exclude the
// SuperAdmin runtime docs (kind: 'system' control-plane screens) which are not
// relevant to product how-to questions.
const DIGEST_DOCUMENT_IDS: string[] = [
  'chat',
  'interview',
  'tools_assessments',
  'audits',
  'initiatives',
  'execution',
  'results',
  'finance',
  'my_work',
  'ideas',
  'presentations',
  'document_studio',
  'presentation_studio',
  'table_studio',
  'meeting',
  'settings',
];

const HEADING: Record<'en' | 'pl', string> = {
  en: 'CONSULTIFY — PRODUCT MODULES (use to answer how-to / what-is questions about the app)',
  pl: 'CONSULTIFY — MODUŁY PRODUKTU (używaj do odpowiedzi na pytania jak / co robi aplikacja)',
};

const LABELS: Record<'en' | 'pl', { does: string; ai: string }> = {
  en: { does: 'What you do', ai: 'How AI helps' },
  pl: { does: 'Co robisz', ai: 'Jak pomaga AI' },
};

/**
 * Build a compact bilingual-aware product help digest for the given language.
 * Falls back to English content when a localized field is missing.
 */
export function buildProductHelpDigest(language: SupportedHelpLanguage = 'en'): string {
  const lang: 'en' | 'pl' = language === 'pl' ? 'pl' : 'en';
  const labels = LABELS[lang];

  const lines = DIGEST_DOCUMENT_IDS.map((id) => {
    const doc = HELP_DOCUMENTS[id];
    if (!doc) return null;
    const title = getLocalizedText(doc.title, lang);
    const summary = getLocalizedText(doc.summary, lang);
    const does = doc.whatYouDoHere
      .slice(0, 3)
      .map((t) => getLocalizedText(t, lang))
      .join(' ');
    const ai = doc.howAiHelpsHere
      .slice(0, 2)
      .map((t) => getLocalizedText(t, lang))
      .join(' ');
    return `- ${title}: ${summary} ${labels.does}: ${does} ${labels.ai}: ${ai}`;
  }).filter(Boolean);

  return [HEADING[lang], ...lines].join('\n');
}
