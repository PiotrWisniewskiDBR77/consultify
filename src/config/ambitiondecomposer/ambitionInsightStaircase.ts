/**
 * Ambition Decomposer — insight staircase + forced decomposition (OXFORD O3).
 *
 * Pattern mirror of src/config/swot/swotInsightStaircase.ts, retargeted from
 * SWOT items to the AMBITION itself. The audit gap this closes: a session can
 * declare a big "umbrella" ambition ("być liderem rynku", "transformacja
 * cyfrowa", "operational excellence") and never be forced to break it into the
 * distinct, independently-deliverable themes that a partner would insist on
 * before anyone commits budget. This module enforces two disciplines:
 *
 *   1. FORCED DECOMPOSITION — an umbrella ambition statement with fewer than
 *      MIN_THEMES_FOR_UMBRELLA accepted themes is not actionable yet; the
 *      session must name the distinct workstreams that together deliver it.
 *   2. K1->K2->K3 STAIRCASE per theme — fact (what we observe) -> interpretation
 *      (what it means for THIS ambition) -> implication (what follows for
 *      sequencing), so every theme is traceable to why it is on the list.
 *
 * A third discipline, shared with Portfolio Priority (portfolioValueStaircase.ts),
 * is the INVENTED-NUMBER GUARD: a theme that states a measurable target
 * (targetValue) with no evidence and no explicit "declared" status is flagged —
 * numbers must have a source, never be conjured to look rigorous.
 */

// ---------------------------------------------------------------------------
// Forced decomposition of the umbrella ambition
// ---------------------------------------------------------------------------

/**
 * Umbrella terms that hide a whole strategy behind one aspirational phrase.
 * An ambition statement matching one of these, with too few decomposed themes,
 * is a slogan, not a plan. Matching is substring-based on lowercased text
 * (PL + EN forms), mirroring SWOT's UMBRELLA_TERMS.
 */
const UMBRELLA_AMBITION_TERMS: { pattern: RegExp; labelEn: string; labelPl: string }[] = [
  {
    pattern: /market leader|lider(em)? rynku|lider branży/i,
    labelEn: 'market leadership',
    labelPl: 'przywództwo rynkowe',
  },
  {
    pattern: /digital transformation|transformacj[aęi] cyfrow/i,
    labelEn: 'digital transformation',
    labelPl: 'transformacja cyfrowa',
  },
  {
    pattern: /operational excellence|doskonałoś[cć] operacyjn/i,
    labelEn: 'operational excellence',
    labelPl: 'doskonałość operacyjna',
  },
  {
    pattern: /best (place to work|employer)|najlepszy pracodawca/i,
    labelEn: 'employer of choice',
    labelPl: 'najlepszy pracodawca',
  },
  {
    pattern: /customer[- ]centric|klientocentryczn/i,
    labelEn: 'customer-centricity',
    labelPl: 'klientocentryczność',
  },
  {
    pattern: /\binnovat|innowacyjn/i,
    labelEn: 'innovation leadership',
    labelPl: 'przywództwo innowacyjne',
  },
  {
    pattern: /sustainable growth|zrównoważon[ay] wzrost/i,
    labelEn: 'sustainable growth',
    labelPl: 'zrównoważony wzrost',
  },
  {
    pattern: /world[- ]class|światow(a|ej) klas/i,
    labelEn: 'world-class',
    labelPl: 'światowa klasa',
  },
  { pattern: /\bscale\b|skalowa(nie|ć)/i, labelEn: 'scale', labelPl: 'skalowanie' },
  {
    pattern: /double (revenue|the business)|podwoi[cć] (przychody|biznes)/i,
    labelEn: 'doubling the business',
    labelPl: 'podwojenie biznesu',
  },
];

export function detectUmbrellaAmbition(text: string): { labelEn: string; labelPl: string } | null {
  for (const term of UMBRELLA_AMBITION_TERMS) {
    if (term.pattern.test(text)) return { labelEn: term.labelEn, labelPl: term.labelPl };
  }
  return null;
}

export function isUmbrellaAmbition(text: string): boolean {
  return detectUmbrellaAmbition(text) !== null;
}

/**
 * A parasol ambition is only actionable once it has been cascaded into at
 * least this many distinct, accepted themes. Below this, the session is still
 * at the slogan stage.
 */
export const MIN_THEMES_FOR_UMBRELLA = 2;

// ---------------------------------------------------------------------------
// K1 -> K2 -> K3 staircase per theme
// ---------------------------------------------------------------------------

export interface AmbitionInsightStaircase {
  /** K1 — the observable fact, with references into session signals. */
  fact: string;
  /** Signal ids / fact keys backing the fact. Empty = declared, unconfirmed. */
  factRefs: string[];
  /** K2 — what the fact means FOR THIS AMBITION (not a generic truth). */
  interpretation: string;
  /** K3 seed — what follows for sequencing / the initiatives under this theme. */
  implication: string;
}

export interface AmbitionStaircaseIssue {
  code:
    | 'missing-fact'
    | 'missing-interpretation'
    | 'missing-implication'
    | 'missing-fact-refs'
    | 'interpretation-is-restatement'
    | 'ambition-needs-decomposition'
    | 'invented-number';
  themeId?: string;
  messageEn: string;
  messagePl: string;
}

interface ThemeStaircaseInput {
  id?: string;
  title: string;
  description?: string;
  targetValue?: string;
  evidence?: unknown[];
  staircase?: AmbitionInsightStaircase;
  evidenceStatus?: 'confirmed' | 'declared' | 'missing';
}

/** Validates the fact->interpretation->implication structure of one theme. */
export function validateAmbitionInsightStaircase(
  item: ThemeStaircaseInput
): AmbitionStaircaseIssue[] {
  const issues: AmbitionStaircaseIssue[] = [];
  const s = item.staircase;

  if (!s || !s.fact?.trim()) {
    issues.push({
      code: 'missing-fact',
      themeId: item.id,
      messageEn: 'Theme has no underlying fact (K1) — where does this theme come from?',
      messagePl: 'Wątek nie ma faktu bazowego (K1) — skąd pochodzi ten wątek?',
    });
  }
  if (!s || !s.interpretation?.trim()) {
    issues.push({
      code: 'missing-interpretation',
      themeId: item.id,
      messageEn: 'Theme has no interpretation (K2) — what does the fact mean for THIS ambition?',
      messagePl: 'Wątek nie ma interpretacji (K2) — co ten fakt znaczy dla TEJ ambicji?',
    });
  }
  if (!s || !s.implication?.trim()) {
    issues.push({
      code: 'missing-implication',
      themeId: item.id,
      messageEn: 'Theme has no implication (K3 seed) — what follows for sequencing?',
      messagePl: 'Wątek nie ma implikacji (zalążek K3) — co z tego wynika dla sekwencji?',
    });
  }
  if (s && s.fact?.trim() && (!s.factRefs || s.factRefs.length === 0)) {
    if (item.evidenceStatus === 'confirmed') {
      issues.push({
        code: 'missing-fact-refs',
        themeId: item.id,
        messageEn: 'Theme is marked confirmed but references no session evidence.',
        messagePl: 'Wątek oznaczony jako potwierdzony, ale nie wskazuje dowodu z sesji.',
      });
    }
  }
  if (s && s.fact?.trim() && s.interpretation?.trim()) {
    const fact = s.fact.trim().toLowerCase();
    const interp = s.interpretation.trim().toLowerCase();
    if (fact === interp || (interp.length > 20 && fact.includes(interp))) {
      issues.push({
        code: 'interpretation-is-restatement',
        themeId: item.id,
        messageEn:
          'Interpretation restates the fact instead of explaining what it means for the ambition.',
        messagePl: 'Interpretacja powtarza fakt zamiast wyjaśnić, co znaczy dla ambicji.',
      });
    }
  }

  issues.push(...validateInventedNumberGuard(item));

  return issues;
}

// ---------------------------------------------------------------------------
// Invented-number guard (shared discipline with Portfolio Priority)
// ---------------------------------------------------------------------------

/**
 * Terms that PROMISE a number ("30%", "2x", "€1.2M") but must be backed by a
 * source. A theme's targetValue/description that quantifies without evidence
 * and without an explicit "declared" status is an invented number.
 */
const QUANTIFIED_CLAIM =
  /(\d[\d.,]*\s?%)|(\d[\d.,]*\s?(k|m|mln|tys|x|×)\b)|(\bpln\b|\beur\b|\busd\b|€|\$|zł)/i;

export function textMakesQuantifiedClaim(text: string): boolean {
  return QUANTIFIED_CLAIM.test(text);
}

function validateInventedNumberGuard(item: ThemeStaircaseInput): AmbitionStaircaseIssue[] {
  const haystack = `${item.title} ${item.description || ''} ${item.targetValue || ''}`;
  if (!textMakesQuantifiedClaim(haystack)) return [];

  const isDeclared = item.evidenceStatus === 'declared';
  const hasEvidence = (item.evidence?.length || 0) > 0;
  if (hasEvidence || isDeclared) return [];

  return [
    {
      code: 'invented-number',
      themeId: item.id,
      messageEn:
        'Theme states a number with no evidence behind it — attach a source or mark it "declared, unconfirmed" (no invented numbers).',
      messagePl:
        'Wątek podaje liczbę, której nie kryje żaden dowód — podepnij źródło albo oznacz jako „deklaracja, niepotwierdzone" (zakaz zmyślania liczb).',
    },
  ];
}

// ---------------------------------------------------------------------------
// Ambition-level decomposition gate
// ---------------------------------------------------------------------------

interface AmbitionDecompositionInput {
  ambitionStatement?: string;
  /** Themes already accepted into the session (proposalStatus filter applied by caller). */
  acceptedThemeCount: number;
}

/**
 * The forced-decomposition gate: an umbrella ambition statement must cascade
 * into at least MIN_THEMES_FOR_UMBRELLA accepted themes before the session can
 * be considered actionable. Returns a single issue (or none).
 */
export function validateAmbitionDecomposition(
  input: AmbitionDecompositionInput
): AmbitionStaircaseIssue[] {
  const statement = input.ambitionStatement?.trim();
  if (!statement) return [];

  const umbrella = detectUmbrellaAmbition(statement);
  if (!umbrella) return [];
  if (input.acceptedThemeCount >= MIN_THEMES_FOR_UMBRELLA) return [];

  return [
    {
      code: 'ambition-needs-decomposition',
      messageEn: `"${umbrella.labelEn}" is an umbrella ambition — it hides several distinct workstreams. Decompose it into at least ${MIN_THEMES_FOR_UMBRELLA} named, independently-deliverable themes before sequencing moves.`,
      messagePl: `„${umbrella.labelPl}" to ambicja parasolowa — kryje kilka odrębnych strumieni pracy. Zdekomponuj ją na co najmniej ${MIN_THEMES_FOR_UMBRELLA} nazwane, niezależnie dowożalne wątki, zanim ułożysz sekwencję ruchów.`,
    },
  ];
}

/** Prompt block teaching the model the staircase + decomposition + guard contract (PL/EN aware). */
export function buildAmbitionStaircasePromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `DEKOMPOZYCJA WYMUSZONA: jeśli ambicja jest parasolowa (np. "lider rynku", "transformacja cyfrowa", "doskonałość operacyjna") — NIE WOLNO zostawić jej jako jednej tezy. Rozłóż ją na co najmniej ${MIN_THEMES_FOR_UMBRELLA} nazwane, niezależnie dowożalne wątki (themes), z których każdy ma własny mierzalny cel.
KAŻDY wątek niesie drabinę wniosku (insight staircase):
- "staircase.fact" (K1): obserwowalny fakt Z SESJI, nigdy wymyślony; "factRefs" wskazują id sygnałów.
- "staircase.interpretation" (K2): co ten fakt znaczy dla TEJ ambicji (nie ogólna prawda).
- "staircase.implication" (K3-zalążek): co z tego wynika dla sekwencji/inicjatyw.
ZAKAZ ZMYŚLONYCH LICZB: jeśli "targetValue" albo opis podaje liczbę (%, x, kwotę), musi mieć dowód w "evidence" LUB być jawnie oznaczony jako "declared" (deklaracja, niepotwierdzone) — nigdy liczba bez źródła.`;
  }
  return `FORCED DECOMPOSITION: if the ambition is an umbrella claim (e.g. "market leader", "digital transformation", "operational excellence") you MUST NOT leave it as one thesis. Break it into at least ${MIN_THEMES_FOR_UMBRELLA} named, independently-deliverable themes, each with its own measurable target.
EVERY theme carries an insight staircase:
- "staircase.fact" (K1): an observable fact FROM THE SESSION, never invented; "factRefs" point at signal ids.
- "staircase.interpretation" (K2): what the fact means for THIS ambition (not a generic truth).
- "staircase.implication" (K3 seed): what follows for sequencing / initiatives.
NO INVENTED NUMBERS: if "targetValue" or the description states a number (%, x, amount), it must have "evidence" OR be explicitly marked "declared" (declared, unconfirmed) — never a number with no source.`;
}
