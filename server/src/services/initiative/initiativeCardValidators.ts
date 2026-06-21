/**
 * Initiative card §B3 validators (M13 Depth · Seria K · K1).
 *
 * Deterministic, cheap quality checks from CARD_CONTENT_FORMULA §B3 — a fast
 * complement to the LLM reviewer (G2). ADVISORY per decision Q7 (soft, like the
 * gate soft-block): they surface issues, they never block a save. Each rule maps
 * 1:1 to the formula: lang_pl · no_filler · problem_len · hypothesis_format.
 */

export interface CardValidationIssue {
  rule: string;
  message: string;
}

export type CardRule = 'lang_pl' | 'no_filler' | 'problem_len' | 'hypothesis_format';

// §A5 — acronyms/methodologies allowed inside otherwise-Polish prose.
const ALLOWED_TOKENS = new Set(
  [
    'sipoc',
    'flowchart',
    'raci',
    'raid',
    'kpi',
    'sla',
    'otif',
    'tto',
    'ttr',
    'nps',
    'mece',
    'pmo',
    'wbs',
    'capex',
    'opex',
    'roi',
    'scada',
    'osd',
    'osp',
    'pse',
    'npv',
    'go',
    'no',
  ].map((s) => s.toLowerCase())
);

// Common English function words — their presence in prose signals EN drift.
const EN_STOPWORDS = new Set([
  'the',
  'and',
  'with',
  'this',
  'that',
  'for',
  'are',
  'will',
  'from',
  'which',
  'have',
  'has',
  'these',
  'those',
  'their',
  'them',
  'they',
  'because',
  'should',
  'would',
  'could',
  'about',
  'into',
  'over',
  'between',
  'process',
  'value',
]);

const FILLER_PATTERNS: RegExp[] = [
  /\blorem ipsum\b/i,
  /\bTODO\b/,
  /\bTBD\b/i,
  /\bplaceholder\b/i,
  /\bfoo\b|\bbar\b/i,
  /\bxxx+\b/i,
  /\blik\.{2,}\b/i,
  /\[[^\]]*\]/, // [bracketed placeholder]
  /\bto be (defined|determined|added)\b/i,
];

const HYPOTHESIS_RE = /Jeśli .+ to .+ (bo|ponieważ) .+/i;

function words(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-ząćęłńóśźż0-9]+/)
    .filter(Boolean);
}

/**
 * Run the requested §B3 rules against a card field's text. Returns the issues
 * found (empty = clean). Default runs the two universal rules (lang_pl,
 * no_filler).
 */
export function validateCardContent(
  text: string,
  rules: CardRule[] = ['lang_pl', 'no_filler']
): CardValidationIssue[] {
  const issues: CardValidationIssue[] = [];
  const raw = String(text || '').trim();
  if (!raw) return issues; // empty handled by empty_fields_justified elsewhere

  if (rules.includes('lang_pl')) {
    const enHits = new Set(words(raw).filter((w) => EN_STOPWORDS.has(w) && !ALLOWED_TOKENS.has(w)));
    if (enHits.size >= 2) {
      issues.push({
        rule: 'lang_pl',
        message: `Proza wygląda na angielską (np. ${[...enHits].slice(0, 3).join(', ')}). Karta powinna być po polsku.`,
      });
    }
  }

  if (rules.includes('no_filler')) {
    const hit = FILLER_PATTERNS.find((re) => re.test(raw));
    if (hit) {
      issues.push({
        rule: 'no_filler',
        message: 'Wykryto placeholder / wypełniacz — uzupełnij treścią.',
      });
    }
  }

  if (rules.includes('problem_len')) {
    const n = words(raw).length;
    if (n < 120 || n > 250) {
      issues.push({
        rule: 'problem_len',
        message: `Opis problemu ma ${n} słów (oczekiwane 120–250).`,
      });
    }
  }

  if (rules.includes('hypothesis_format')) {
    if (!HYPOTHESIS_RE.test(raw)) {
      issues.push({
        rule: 'hypothesis_format',
        message: 'Hipoteza powinna mieć format „Jeśli … to … bo/ponieważ …".',
      });
    }
  }

  return issues;
}
