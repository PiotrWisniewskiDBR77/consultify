/**
 * Decision Engine — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (decisionEngine.ts) with the AI
 * runtime. The engine produces a grounded matrix + six-link score + weakest-link
 * diagnosis + sensitivity/tornado + structural diagnostics + move sequence; this
 * builder turns that into an INSIGHT-FIRST prompt so the model produces the
 * sentences that change how the organization thinks about the choice — NOT a
 * table recap — WITHOUT inventing options, weights or uncertainties the session
 * does not support.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / moves / expectedEffect) used by the SMED/Inventory prompts, so the
 * operational summary renderer consumes Decision output the same way.
 */

import {
  analyzeSensitivity,
  buildMatrix,
  buildMoveSequence,
  detectFalseBinarity,
  detectHiddenCriterion,
  scoreLinks,
  splitDisputes,
  weakestLink,
  type DecisionSession,
} from './decisionEngine';
import { localizeLadder } from './index';
import { decisionLinkLabel, type DecisionElementId } from './deepeningLadder';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded, insight-first synthesis prompt: seeds the model with the engine's
 * matrix, link scores, weakest link, tornado and structural diagnostics so its
 * output stays consistent with the scored facts — and demands the four insight
 * patterns of the doctrine (real trade-off, reversal point, sequence-not-0-1,
 * weakest link) rather than a recap. Returns null when there is nothing to
 * conclude on (no criteria and no alternatives).
 */
export function buildDecisionConclusionPrompt(
  session: DecisionSession,
  isPolish: boolean
): string | null {
  const matrix = buildMatrix(session);
  if (matrix.alternatives.length === 0 && session.criteria.length === 0) return null;

  const links = scoreLinks(session);
  const weakest = weakestLink(session);
  const sensitivity = analyzeSensitivity(session, matrix);
  const falseBinary = detectFalseBinarity(session);
  const hidden = detectHiddenCriterion(session);
  const disputes = splitDisputes(session);
  const sequence = buildMoveSequence(session);

  const frameLine = isPolish
    ? `Rama: „${session.frame.question || '(brak pytania decyzyjnego)'}"${session.frame.decisionMaker ? `; decydent: ${session.frame.decisionMaker}` : ''}${session.frame.horizon ? `; horyzont: ${session.frame.horizon}` : ''}${session.frame.binary ? '; UWAGA: postawiona binarnie' : ''}.`
    : `Frame: "${session.frame.question || '(no decision question)'}"${session.frame.decisionMaker ? `; decision-maker: ${session.frame.decisionMaker}` : ''}${session.frame.horizon ? `; horizon: ${session.frame.horizon}` : ''}${session.frame.binary ? '; NOTE: stated as a binary' : ''}.`;

  const matrixLines = matrix.ranked
    .map(
      (a, i) =>
        `${i + 1}. ${a.label}: weighted ${a.weightedScore}/5${a.strawman ? ' [STRAW MAN]' : ''}${a.doable ? '' : ' [not doable]'}${a.realOption ? ' [real option]' : ''}`
    )
    .join('\n');

  const recommended = matrix.ranked.find((a) => a.id === matrix.recommendedId);
  const recommendationLine = recommended
    ? isPolish
      ? `Rekomendacja macierzy: „${recommended.label}" (przewaga nad drugą opcją: ${matrix.margin}). Solidność: ${sensitivity.robustness === 'robust' ? 'solidna' : 'KRUCHA'}.`
      : `Matrix recommendation: "${recommended.label}" (margin over runner-up: ${matrix.margin}). Robustness: ${sensitivity.robustness === 'robust' ? 'robust' : 'FRAGILE'}.`
    : isPolish
      ? 'Macierz nie wskazuje jednoznacznej rekomendacji — brak danych o opcjach lub kryteriach.'
      : 'The matrix yields no clear recommendation — options or criteria data is missing.';

  const linkLines = links
    .map((l) => `- ${localize(l.label.pl, l.label.en, isPolish)}: ${l.score}/100 — ${localize(l.reason.pl, l.reason.en, isPolish)}`)
    .join('\n');

  const weakestLine = isPolish
    ? `NAJSŁABSZE OGNIWO: „${decisionLinkLabel(weakest.link).pl.toLowerCase()}" (${weakest.score}/100). ${weakest.reason.pl} Naprawa: ${weakest.remedy.pl}`
    : `WEAKEST LINK: "${decisionLinkLabel(weakest.link).en.toLowerCase()}" (${weakest.score}/100). ${weakest.reason.en} Remedy: ${weakest.remedy.en}`;

  const tornadoLines = sensitivity.bars
    .map(
      (b) =>
        `- ${b.label}: span ${b.span} (low ${b.low} / high ${b.high})${b.flipsRecommendation ? ' [FLIPS THE RECOMMENDATION]' : ''}`
    )
    .join('\n');
  const tornadoBlock = tornadoLines || (isPolish ? '(brak niepewności podanych jako zakresy)' : '(no uncertainties given as ranges)');

  const diagnosticsLines = [
    localize(falseBinary.message.pl, falseBinary.message.en, isPolish),
    localize(hidden.message.pl, hidden.message.en, isPolish),
    localize(disputes.message.pl, disputes.message.en, isPolish),
  ]
    .map((d) => `- ${d}`)
    .join('\n');

  const seqLines = sequence
    .map(
      (m) =>
        `${m.order}. [${m.link}] ${localize(m.title.pl, m.title.en, isPolish)} — rationale: ${localize(
          m.rationale.pl,
          m.rationale.en,
          isPolish
        )} | trade-off: ${localize(m.tradeOff.pl, m.tradeOff.en, isPolish)} | rejected variant: ${localize(
          m.rejectedVariant.pl,
          m.rejectedVariant.en,
          isPolish
        )}`
    )
    .join('\n');

  const header = isPolish
    ? 'Działaj jako partner ds. jakości decyzji (Decision Quality — SDG, Howard/Spetzler + debiasing McKinsey). Poniżej masz ugruntowaną na danych macierz alternatywy × kryteria, ocenę sześciu ogniw, diagnozę najsłabszego ogniwa, analizę tornado i diagnostykę strukturalną. Twoim PRODUKTEM są INSIGHTY — zdania, które zmieniają sposób, w jaki organizacja myśli o wyborze — nie streszczenie tabeli. NIE wymyślaj opcji, wag ani niepewności niepopartych danymi sesji.'
    : 'Act as a decision-quality partner (Decision Quality — SDG, Howard/Spetzler + McKinsey debiasing). Below is a data-grounded alternatives × criteria matrix, a six-link score, the weakest-link diagnosis, a tornado analysis and structural diagnostics. Your PRODUCT is INSIGHTS — sentences that change how the organization thinks about the choice — not a recap of the table. Do NOT invent options, weights or uncertainties the session facts do not support.';

  const rules = isPolish
    ? [
        'INSIGHT-FIRST. Aktywnie szukaj i nazwij wprost: (1) prawdziwy trade-off — „zespół dyskutuje X, ale realny spór to X vs Y"; (2) punkt odwrócenia — „rekomendacja X jest słuszna, chyba że założenie Z jest błędne — wtedy wygrywa Y"; (3) sekwencję, nie 0-1 — „to nie decyzja A czy B, tylko tani krok diagnostyczny teraz + decyzja odroczona"; (4) najsłabsze ogniwo — nazwane precyzyjnie, z konkretną naprawą (nie „przemyśl jeszcze raz").',
        'Zmienna, która przełącza rekomendację (oznaczona FLIPS powyżej), to prawdziwy decision driver — postaw ją w centrum, nie temat dyskutowany najdłużej.',
        'Jeśli wykryto fałszywą binarność lub ukryte kryterium — nazwij to wprost jako insight; to często najcenniejszy moment sesji.',
        'Rozdziel spór o fakty (rozstrzyga go domiar danych) od sporu o wartości (rozstrzyga go jawna rozmowa o preferencjach) — nie uśredniaj po cichu.',
        'Liczby (oceny, wagi, rozpiętości, ogniwa) wyłącznie z bloków powyżej — nie licz i nie zmyślaj.',
      ]
    : [
        'INSIGHT-FIRST. Actively hunt for and name explicitly: (1) the real trade-off — "the team debates X, but the real dispute is X vs Y"; (2) the reversal point — "recommendation X is right, unless assumption Z is wrong — then Y wins"; (3) the sequence, not 0-1 — "this is not A vs B, it is a cheap diagnostic step now + a deferred decision"; (4) the weakest link — named precisely, with a concrete remedy (not "rethink it").',
        'The variable that flips the recommendation (marked FLIPS above) is the real decision driver — put it at the centre, not the topic debated the longest.',
        'If a false binary or a hidden criterion was detected — name it explicitly as an insight; it is often the most valuable moment of the session.',
        'Separate the fact dispute (settled by measuring) from the value dispute (settled by an explicit conversation about preferences) — do not silently average.',
        'Numbers (scores, weights, spans, links) come exclusively from the blocks above — do not compute or invent them.',
      ];

  return `${header}

=== DECISION FRAME (facts) ===
${frameLine}

=== ALTERNATIVES × CRITERIA MATRIX (ranked; the only admissible scores) ===
${matrixLines}
${recommendationLine}

=== SIX DECISION-QUALITY LINKS (chain is only as good as its weakest link) ===
${linkLines}
${weakestLine}

=== SENSITIVITY / TORNADO (what could flip the recommendation) ===
${tornadoBlock}

=== STRUCTURAL DIAGNOSTICS ===
${diagnosticsLines}

=== MOVE SEQUENCE (grounded draft — raise the weakest link, then commit) ===
${seqLines}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

QUALITY BARS:
- Insight-first: "verdict" is the single sharpest insight about the choice (real trade-off / reversal point / sequence / weakest link), not a recap of the matrix.
- Numbers exclusively from the facts above; do not compute or invent new ones.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
- Every sentence falsifiable: with opposite facts it would read differently.
- Map the grounded move sequence above into 3-5 "initiatives", preserving its order (order = priority).
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.

Return JSON:
{
  "summary": {
    "verdict": "insight-first, 1-2 sentences: the sharpest single truth about this decision — the real trade-off, the reversal point, or which link is weakest",
    "executiveSummary": "3-4 sentences: the verdict, then why — anchored in the matrix recommendation, its robustness, and the weakest link above",
    "keyInsights": ["the real trade-off (X vs Y, not whether X)", "the reversal point (recommendation flips if assumption Z / the FLIPS variable)", "sequence-not-0-1 OR the hidden criterion OR the weakest link — whichever the facts most support"],
    "appliedConclusions": ["what to strengthen first (the weakest link)", "what NOT to decide yet (and why)", "which variable to measure before committing"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"the decision-quality change, behaviorally observable (fewer reversed decisions, a named checkpoint, a resolved dispute)","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"strategic","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the trade-off (chosen at the cost of what) and the rejected variant"}]
}`;
}

/**
 * Builds the deepening prompt for a single element rung — used when the user asks
 * AI to "think deeper" on a specific Decision-Quality element (frame,
 * alternatives, criteria, uncertainty, assumptions).
 */
export function buildDecisionDeepenPrompt(
  element: DecisionElementId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(element, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}
