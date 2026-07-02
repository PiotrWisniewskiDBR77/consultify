/**
 * Value Chain (Porter) — activity insight staircase (OXFORD O3, tool #4).
 *
 * Sibling of src/config/swot/swotInsightStaircase.ts. Where SWOT enforces
 * fact -> interpretation -> implication on every item, a value-chain activity
 * carries a FOUR-rung deepening ladder, because scoring an activity "high cost /
 * weak maturity" is worthless unless the consultant can say WHERE that shows up
 * and WHAT lever it unlocks:
 *
 *   R1 surface     — how the activity is actually run today (the practice).
 *   R2 cost/value  — the cost-value proof: its share of cost AND its effect on
 *                    what the client can charge (willingness-to-pay). A score
 *                    with no cost-value evidence is a guess.
 *   R3 benchmark   — maturity vs a reference: in-house vs outsourced, manual vs
 *                    digitalized, best-in-class vs behind. This locates the gap.
 *   R4 potential   — the improvement lever the gap unlocks (what better looks
 *                    like, and roughly how much headroom).
 *
 * The rungs mirror the ValueActivity fields already in the store
 * (costContribution / valueContribution / maturity / marginRole) so the config
 * and the runtime speak the same language. Every function is pure — tests, the
 * review gate, and the AI prompts all consume the same contract.
 */

export type ValueChainStaircaseRung = 'surface' | 'costValue' | 'benchmark' | 'potential';

export interface ValueChainInsightStaircase {
  /** R1 — how the activity is run today (observable practice, not a rating). */
  surface: string;
  /** R2 — cost-value proof: share of cost + effect on willingness-to-pay. */
  costValueProof: string;
  /** Signal ids / fact keys backing the cost-value proof. Empty = declared. */
  proofRefs: string[];
  /** R3 — maturity vs a benchmark (in-house/outsourced, manual/digital, vs best-in-class). */
  benchmark: string;
  /** R4 — the improvement lever the gap unlocks (what "better" looks like). */
  potential: string;
}

export interface ValueChainStaircaseIssue {
  code:
    | 'missing-surface'
    | 'missing-cost-value-proof'
    | 'missing-proof-refs'
    | 'missing-benchmark'
    | 'missing-potential'
    | 'proof-restates-surface'
    | 'needs-cost-value-split'
    | 'vague-driver';
  messageEn: string;
  messagePl: string;
}

/**
 * Vague activity descriptors that assert a rating without saying where it shows
 * up. Matching one of these with no cost-value proof means the score is folklore.
 * Substring match on lowercased text (PL + EN forms).
 */
const VAGUE_TERMS: { pattern: RegExp; labelEn: string; labelPl: string }[] = [
  { pattern: /inefficien|nieefektywn|nieoptymaln/i, labelEn: 'inefficiency', labelPl: 'nieefektywność' },
  { pattern: /expensive|kosztown|drog[iea]/i, labelEn: 'expensive', labelPl: 'kosztowność' },
  { pattern: /outdated|przestarza|legacy|stare\b/i, labelEn: 'outdated', labelPl: 'przestarzałość' },
  { pattern: /manual|ręczn|reczn/i, labelEn: 'manual', labelPl: 'ręczność' },
  { pattern: /bottleneck|wąsk|wask.*gardł|waskie gardlo/i, labelEn: 'bottleneck', labelPl: 'wąskie gardło' },
  { pattern: /world.?class|klasy świat|klasy swiat/i, labelEn: 'world-class', labelPl: 'klasa światowa' },
];

export function detectVagueDriver(
  text: string
): { labelEn: string; labelPl: string } | null {
  for (const term of VAGUE_TERMS) {
    if (term.pattern.test(text)) return { labelEn: term.labelEn, labelPl: term.labelPl };
  }
  return null;
}

/**
 * A cost-value proof that mentions cost OR value but not both hides half the
 * picture: an activity can be a big cost AND irrelevant to the customer (cut it),
 * or a small cost that drives the whole premium (protect it). The lever differs.
 */
export function mentionsCost(text: string): boolean {
  return /\bcost|koszt|cena|price|spend|nakład|naklad|opex|capex/i.test(text);
}

export function mentionsValue(text: string): boolean {
  return /\bvalue|wartoś|wartos|differ|różnic|roznic|willingness|premi|jakoś|jakos|customer|klient|payer/i.test(
    text
  );
}

interface StaircaseValidationInput {
  /** Free-text label/driver of the activity, scanned for vague terms. */
  text: string;
  staircase?: ValueChainInsightStaircase;
  /** 'declared' activities may legitimately have zero proofRefs. */
  evidenceStatus?: 'confirmed' | 'declared' | 'missing';
}

/**
 * Validates the surface -> cost/value -> benchmark -> potential ladder of one
 * activity. Consumed by tests, by the review-gap computation, and as an
 * adversarial checklist fed back into the AI prompt.
 */
export function validateValueChainStaircase(
  item: StaircaseValidationInput
): ValueChainStaircaseIssue[] {
  const issues: ValueChainStaircaseIssue[] = [];
  const s = item.staircase;

  if (!s || !s.surface?.trim()) {
    issues.push({
      code: 'missing-surface',
      messageEn: 'Activity has no surface description (R1) — how is it actually run today?',
      messagePl: 'Ogniwo nie ma opisu powierzchni (R1) — jak jest dziś realizowane?',
    });
  }
  if (!s || !s.costValueProof?.trim()) {
    issues.push({
      code: 'missing-cost-value-proof',
      messageEn:
        'Activity has no cost-value proof (R2) — its share of cost AND its effect on what the client can charge.',
      messagePl:
        'Ogniwo nie ma dowodu kosztowo-wartościowego (R2) — udziału w koszcie ORAZ wpływu na to, ile klient może liczyć.',
    });
  }
  if (!s || !s.benchmark?.trim()) {
    issues.push({
      code: 'missing-benchmark',
      messageEn:
        'Activity has no benchmark (R3) — maturity vs a reference (in-house/outsourced, manual/digital, vs best-in-class).',
      messagePl:
        'Ogniwo nie ma benchmarku (R3) — dojrzałości wobec punktu odniesienia (in-house/outsourcing, ręcznie/cyfrowo, vs najlepsi).',
    });
  }
  if (!s || !s.potential?.trim()) {
    issues.push({
      code: 'missing-potential',
      messageEn: 'Activity has no potential (R4) — what improvement lever does the gap unlock?',
      messagePl: 'Ogniwo nie ma potencjału (R4) — jaką dźwignię poprawy odblokowuje luka?',
    });
  }
  if (s && s.costValueProof?.trim() && (!s.proofRefs || s.proofRefs.length === 0)) {
    if (item.evidenceStatus === 'confirmed') {
      issues.push({
        code: 'missing-proof-refs',
        messageEn: 'Activity is marked confirmed but its cost-value proof references no session evidence.',
        messagePl: 'Ogniwo oznaczone jako potwierdzone, ale dowód kosztowo-wartościowy nie wskazuje dowodu z sesji.',
      });
    }
  }
  // The cost-value proof must add evidence, not echo the surface description.
  if (s && s.surface?.trim() && s.costValueProof?.trim()) {
    const surface = s.surface.trim().toLowerCase();
    const proof = s.costValueProof.trim().toLowerCase();
    if (surface === proof || (proof.length > 20 && surface.includes(proof))) {
      issues.push({
        code: 'proof-restates-surface',
        messageEn: 'Cost-value proof restates the surface description instead of adding cost/value evidence.',
        messagePl: 'Dowód kosztowo-wartościowy powtarza opis powierzchni zamiast dodawać dowód kosztu/wartości.',
      });
    }
    // A proof must speak to BOTH cost and value, or explain which side dominates.
    if (!mentionsCost(proof) || !mentionsValue(proof)) {
      issues.push({
        code: 'needs-cost-value-split',
        messageEn:
          'Cost-value proof addresses only one side — name BOTH the share of cost and the effect on customer value (or why one dominates); the lever differs.',
        messagePl:
          'Dowód kosztowo-wartościowy dotyka tylko jednej strony — nazwij OBIE: udział w koszcie i wpływ na wartość dla klienta (lub czemu jedna przeważa); dźwignia jest inna.',
      });
    }
  }
  // A vague driver with no proof is folklore, not a finding.
  const vague = detectVagueDriver(item.text);
  if (vague && (!s || !s.costValueProof?.trim())) {
    issues.push({
      code: 'vague-driver',
      messageEn: `"${vague.labelEn}" is a rating, not evidence — back it with a cost-value proof (where does it show up in cost or in what the customer will pay?).`,
      messagePl: `„${vague.labelPl}" to ocena, nie dowód — podeprzyj dowodem kosztowo-wartościowym (gdzie widać to w koszcie lub w tym, ile zapłaci klient?).`,
    });
  }
  return issues;
}

/** Prompt block teaching the model the activity staircase contract (PL/EN aware). */
export function buildValueChainStaircasePromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `KAŻDE ogniwo łańcucha wartości musi nieść drabinę pogłębiającą (insight staircase):
- "staircase.surface" (R1): jak ogniwo jest DZIŚ realizowane — praktyka, nie ocena.
- "staircase.costValueProof" (R2): dowód kosztowo-wartościowy — udział w koszcie ORAZ wpływ na wartość dla klienta (ile może liczyć); "proofRefs" wskazują id sygnałów. Nazwij OBIE strony — inaczej dźwignia jest zgadywana.
- "staircase.benchmark" (R3): dojrzałość wobec punktu odniesienia — in-house vs outsourcing, ręcznie vs cyfrowo, vs najlepsi w klasie. To lokalizuje lukę.
- "staircase.potential" (R4): dźwignia poprawy, którą luka odblokowuje — jak wygląda „lepiej" i ile jest zapasu.
- Ogniwo bez dowodu w sesji: proofRefs=[] i evidenceStatus="declared" — jawnie „deklaracja, niepotwierdzone".
- Nie oznaczaj ogniwa etykietą-oceną („kosztowne", „ręczne", „silne") bez dowodu kosztowo-wartościowego.`;
  }
  return `EVERY value-chain activity must carry a deepening insight staircase:
- "staircase.surface" (R1): how the activity is run TODAY — the practice, not a rating.
- "staircase.costValueProof" (R2): a cost-value proof — its share of cost AND its effect on customer value (what the client can charge); "proofRefs" point at signal ids. Name BOTH sides — otherwise the lever is a guess.
- "staircase.benchmark" (R3): maturity vs a reference — in-house vs outsourced, manual vs digital, vs best-in-class. This locates the gap.
- "staircase.potential" (R4): the improvement lever the gap unlocks — what "better" looks like and roughly how much headroom.
- An activity with no session evidence: proofRefs=[] and evidenceStatus="declared" — explicitly "declared, unconfirmed".
- Do not label an activity with a rating word ("expensive", "manual", "strong") without a cost-value proof.`;
}
