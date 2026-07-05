/**
 * Dynamic SWOT — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic tension engine (swotTensionEngine.ts) with the AI
 * runtime. The engine derives SO/WO/ST/WT tension candidates from ACCEPTED items
 * only — each pair explicit and traceable — plus a coverage verdict (which
 * postures are covered / structurally impossible / missing). This builder turns
 * that grounded skeleton into a prompt so the model refines wording and fills
 * gaps WITHOUT inventing items, tensions or impact levels the session facts do
 * not support.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / moves / expectedEffect / selfCheck) used by the Porter/Ansoff/SMED
 * prompts, so the summary renderer consumes SWOT output the same way. Read-only
 * against the engine — this file is the conclusion LAYER, it does not re-score.
 */

import type { SWOTItem, SWOTTension } from '@/store/useToolStore';

import {
  buildMoveConclusionPromptRules,
  computeTensionCoverage,
  deriveTensionCandidates,
  isAcceptedSwotItem,
  TENSION_TYPE_TO_POSTURE,
  type DerivedTensionCandidate,
  type SwotTensionType,
} from './swotTensionEngine';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

const QUADRANT_LABEL: Record<SWOTItem['quadrant'], { pl: string; en: string }> = {
  strengths: { pl: 'siły', en: 'strengths' },
  weaknesses: { pl: 'słabości', en: 'weaknesses' },
  opportunities: { pl: 'szanse', en: 'opportunities' },
  threats: { pl: 'zagrożenia', en: 'threats' },
};

const TYPE_LABEL: Record<SwotTensionType, { pl: string; en: string }> = {
  SO: { pl: 'siła × szansa', en: 'strength × opportunity' },
  WO: { pl: 'słabość × szansa', en: 'weakness × opportunity' },
  ST: { pl: 'siła × zagrożenie', en: 'strength × threat' },
  WT: { pl: 'słabość × zagrożenie', en: 'weakness × threat' },
};

/**
 * Grounded conclusion prompt: seeds the model with the engine's derived tension
 * candidates (SO/WO/ST/WT, ranked by impact weight, each linked to real accepted
 * items) and the coverage verdict, plus the W2 move rules, so its finishing block
 * stays consistent with the scored session. Returns null when no accepted item
 * exists yet (renderer falls through to the generic summary — never a fabricated
 * conclusion).
 */
export function buildSwotConclusionPrompt(
  data: { items?: SWOTItem[]; tensions?: SWOTTension[] } | undefined,
  isPolish: boolean
): string | null {
  const items = data?.items;
  if (!items || items.length === 0) return null;

  const accepted = items.filter(isAcceptedSwotItem);
  if (accepted.length === 0) return null;

  const candidates = deriveTensionCandidates(accepted);
  if (candidates.length === 0) return null;

  const coverage = computeTensionCoverage(accepted, data?.tensions ?? []);
  const itemById = new Map(accepted.map((i) => [i.id, i]));

  const itemLine = (id: string): string => {
    const it = itemById.get(id);
    if (!it) return `[${id}]`;
    const q = localize(QUADRANT_LABEL[it.quadrant].pl, QUADRANT_LABEL[it.quadrant].en, isPolish);
    const ev =
      it.evidenceStatus === 'confirmed'
        ? 'confirmed'
        : it.evidenceStatus === 'missing'
          ? 'missing'
          : 'declared';
    return `"${it.text}" (${q}, impact ${it.impact}, ${ev})`;
  };

  const candLine = (c: DerivedTensionCandidate): string => {
    const posture = TENSION_TYPE_TO_POSTURE[c.type];
    const postureTitle = localize(posture.titlePl, posture.titleEn, isPolish);
    const typeLabel = localize(TYPE_LABEL[c.type].pl, TYPE_LABEL[c.type].en, isPolish);
    return `- [${c.type} · ${typeLabel} · ${postureTitle}] weight ${c.weight}: ${itemLine(
      c.linkedItemIds[0]
    )} ⨯ ${itemLine(c.linkedItemIds[1])}`;
  };

  const tensionLines = candidates.map(candLine).join('\n');

  const fmtTypes = (types: SwotTensionType[]): string =>
    types.length
      ? types.map((t) => localize(TYPE_LABEL[t].pl, TYPE_LABEL[t].en, isPolish)).join(', ')
      : localize('brak', 'none', isPolish);

  const coverageLine = isPolish
    ? `Pokryte napięcia: ${fmtTypes(coverage.covered)}. Możliwe, ale brakujące (do zaadresowania): ${fmtTypes(
        coverage.missing
      )}. Strukturalnie niemożliwe (brak zaakceptowanych elementów w kwadrancie): ${fmtTypes(
        coverage.structurallyEmpty
      )}.`
    : `Covered tensions: ${fmtTypes(coverage.covered)}. Formable but missing (address these): ${fmtTypes(
        coverage.missing
      )}. Structurally impossible (no accepted items in a quadrant): ${fmtTypes(
        coverage.structurallyEmpty
      )}.`;

  const header = isPolish
    ? 'Działaj jako partner ds. strategii. Poniżej masz ugruntowane na sesji napięcia SWOT (SO/WO/ST/WT wyprowadzone WYŁĄCZNIE z zaakceptowanych elementów, każde powiązane z realnymi pozycjami) oraz werdykt pokrycia i zasady ruchów W2. Napisz blok domykający wg CONCLUSION_LAYER_STANDARD wariant W2. NIE wymyślaj elementów, napięć ani poziomów impact niepopartych sesją; łącz każdy ruch z KONKRETNYMI napięciami/elementami powyżej.'
    : 'Act as a strategy partner. Below are session-grounded SWOT tensions (SO/WO/ST/WT derived EXCLUSIVELY from accepted items, each linked to real positions), a coverage verdict and the W2 move rules. Write the finishing block per CONCLUSION_LAYER_STANDARD variant W2. Do NOT invent items, tensions or impact levels the session does not support; link every move to SPECIFIC tensions/elements above.';

  return `${header}

=== SWOT TENSIONS (engine-derived from accepted items — the ONLY admissible pairings, ranked by impact weight) ===
${tensionLines}

=== TENSION COVERAGE (engine verdict) ===
${coverageLine}

${buildMoveConclusionPromptRules(isPolish ? 'pl' : 'en')}

W2 STRUCTURE (mandatory):
1. "verdict" — answer-first, 1-2 sentences: what this SWOT means for the client's DECISION (which posture to take first — attack / repair / defend / protect). Lead with the strategic tension, not a four-quadrant recap.
2. "rationale" — why, anchored in the highest-weight tensions and their linked items above (evidence, R2).
3. "tradeoffs" — >= 1 at recommendation level: what we choose AT THE COST of what; which posture was deprioritized and why.
4. "moves" (3-5) — each a strategic RESPONSE tied to a tension (attack / repair / defend / protect), each with tradeoff (chosen/deferred/cost) + rejectedAlternative + firstStep + linked ids.
5. "expectedEffect" — positioning/risk change, behaviorally observable, WITH a time horizon; no amounts absent from the facts.

QUALITY BARS:
- Numbers and impact levels exclusively from the tensions block; items marked "declared" flagged "as declared, to be confirmed", "missing" flagged "to be established".
- Zero filler; every sentence falsifiable — with opposite items it would read differently.
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.

Return JSON:
{
  "verdict": "answer-first, 1-2 sentences: what this analysis means for the strategic decision",
  "rationale": "why — anchored in the highest-weight tensions and their linked items above",
  "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
  "moves": [{"title":"...","category":"quick-win|big-bet|defensive-move|capability-build","posture":"attack|repair|defend|protect","rationale":"...","tradeoff":{"chosen":"...","deferred":"...","cost":"..."},"rejectedAlternative":{"option":"...","reason":"..."},"linkedItemIds":["..."],"linkedTensionIds":["..."],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"...","ownerRole":"..."}],
  "expectedEffect": {"text":"positioning/risk change, behaviorally observable","horizon":"..."},
  "selfCheck": {"signature":"pass|fail","formulaComplete":"pass|fail","numbersFromFacts":"pass|fail","falsifiable":"pass|fail","tradeoffPresent":"pass|fail","effectHasHorizon":"pass|fail"}
}`;
}
