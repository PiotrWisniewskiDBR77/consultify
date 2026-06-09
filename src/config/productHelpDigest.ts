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

// How the two core deliverables are documented — so the assistants can answer
// "how do we document an insight / an initiative". Mirrors the in-app Help docs
// (CARD_CONTENT_FORMULA + INITIATIVE_FORMULA).
const METHODS: Record<'en' | 'pl', string[]> = {
  en: [
    'HOW WE DOCUMENT INSIGHTS & INITIATIVES:',
    '- Insight (Wniosek) from interviews: answer-first (first sentence = conclusion), evidence-grounded via an evidence map (every claim links to a session/document/data), ≥3 themes, ≥2 issues, missing data, material quality, honest about uncertainty, MECE. Flow: questions → assignment → insights → initiatives.',
    '- Initiative: starts as a charter-lite — falsifiable thesis ("if X then Y because Z"), one owner, impact × effort, ≥1 KPI (baseline → target), and a mandatory source link (lineage). The full charter (scope, deliverables, success/kill criteria, milestones, RAID, RACI) is filled progressively through gates DRAFT → review → approved → executing → done → tracking → archived.',
  ],
  pl: [
    'JAK DOKUMENTUJEMY WNIOSKI I INICJATYWY:',
    '- Wniosek z wywiadów: answer-first (pierwsze zdanie = konkluzja), ugruntowany w dowodach przez mapę dowodów (każda teza wiąże się z sesją/dokumentem/danymi), ≥3 motywy, ≥2 problemy, braki danych, jakość materiału, uczciwa niepewność, MECE. Przepływ: pytania → przypisanie → insighty → inicjatywy.',
    '- Inicjatywa: startuje jako charter-lite — falsyfikowalna teza („jeśli X to Y bo Z"), jeden owner, impact × effort, ≥1 KPI (baseline → target) i obowiązkowe powiązanie ze źródłem (lineage). Pełny charter (zakres, rezultaty, kryteria sukcesu/zatrzymania, kamienie milowe, RAID, RACI) uzupełniany progresywnie przez bramki DRAFT → review → approved → executing → done → tracking → archived.',
  ],
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

  return [HEADING[lang], ...lines, '', ...METHODS[lang]].join('\n');
}
