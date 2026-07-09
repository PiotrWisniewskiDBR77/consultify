/**
 * Risk & Uncertainty — conclusion prompt contract.
 *
 * Bridges the deterministic synthesis engine (moveValidator.ts) with the AI
 * runtime. The engine produces a grounded risk exposure ranking + W2 resilience
 * move sequence; these builders turn that into a prompt so the model refines
 * wording and fills gaps WITHOUT inventing risks the facts do not support.
 *
 * Shape intentionally matches the risk-uncertainty summary contract used by the
 * existing handler (src/hooks/discovery/toolAi/riskUncertainty.ts):
 *   input  -> assumptions + risks + scenarios + mission context
 *   output -> { summary{verdict,tradeoffs,expectedEffect}, moves[], initiatives[], outputCandidates[] } (W2)
 * with rationale/tradeOff/rejectedVariant on every move (W2).
 */

import type { RiskUncertaintyData } from '@/store/useToolStore';

import { localizeLadder } from './index';
import { rankRisks, buildW2MoveSequence } from './moveValidator';

import { groundingRules } from '@/hooks/discovery/toolAi/groundingRules';
const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded synthesis prompt: seeds the model with the engine's exposure ranking
 * and W2 resilience sequence so its output stays consistent with the scored
 * facts. Returns null when the session has no accepted risks or assumptions.
 */
export function buildRiskConclusionPrompt(
  data: RiskUncertaintyData,
  isPolish: boolean
): string | null {
  const ranking = rankRisks(data);
  if (ranking.risks.length === 0 && ranking.assumptions.length === 0) return null;

  const sequence = buildW2MoveSequence(data);

  const riskLines = ranking.risks
    .map(
      (r) =>
        `- [${r.id}] ${r.title}: P${r.probability}×I${r.impact}=${r.exposure}/25${
          r.responseReady ? ', response ready' : ', NO full response'
        }, ${r.evidenceBacked ? 'evidence-backed' : 'unconfirmed'}`
    )
    .join('\n');

  const assumptionLines = ranking.assumptions
    .map(
      (a) =>
        `- [${a.id}] ${a.text}: confidence ${a.confidence}/5, fragility ${a.fragility}/5${
          a.hasValidation ? ', validation planned' : ', NO validation'
        }`
    )
    .join('\n');

  const seqLines = sequence
    .map(
      (m) =>
        `${m.order}. [${m.category}] ${localize(m.title.pl, m.title.en, isPolish)} — rationale: ${localize(
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
    ? 'Działaj jako partner ds. ryzyka i niepewności. Poniżej masz ugruntowany na faktach ranking ekspozycji ryzyk, kruchości założeń i sekwencję ruchów odporności W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj ryzyk niepopartych zebranymi sygnałami.'
    : 'Act as a risk & uncertainty partner. Below is a fact-grounded ranking of risk exposure, assumption fragility, and a W2 resilience move sequence. Refine the wording and fill gaps, but do NOT invent risks the collected signals do not support.';

  const rules = isPolish
    ? [
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Sekwencja: najpierw zwaliduj najbardziej kruche założenie, potem złagodź ryzyko o najwyższej ekspozycji, na końcu monitoruj ogon scenariuszowy.',
        'Priorytet ryzyka to prawdopodobieństwo × wpływ; nie traktujcie wszystkich ryzyk równo.',
        'Ryzyka i założenia nadające się do rejestru RAID inicjatywy oznacz jako outputCandidate readiness="ready-for-initiative".',
      ]
    : [
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Sequence: validate the most fragile assumption first, then mitigate the highest-exposure risk, then monitor the scenario tail.',
        'Risk priority is probability × impact; do not treat all risks equally.',
        'Flag risks and assumptions fit for the initiative RAID register as outputCandidate readiness="ready-for-initiative".',
      ];

  return `${header}

=== RISK EXPOSURE (probability × impact) ===
${riskLines || '- (no accepted risks)'}

=== ASSUMPTION FRAGILITY ===
${assumptionLines || '- (no accepted assumptions)'}

=== W2 RESILIENCE MOVE SEQUENCE (grounded draft) ===
${seqLines || '- (no moves synthesized)'}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

W2 STRUCTURE (mandatory):
1. "summary.verdict" — answer-first, 1-2 sentences: what the risk landscape means for the decision — which assumption or exposure gates the plan.
2. "summary.executiveSummary" — 3-4 sentences: restates the verdict, then the why, anchored in the exposure ranking and assumption fragility above (cite ids).
3. "summary.tradeoffs" — >= 1 at recommendation level: what we protect AT THE COST of what; the canonical rejected alternative is "mitigate everything at once -> diluted response".
4. "moves" (3-5) — each a resilience DECISION (validate/mitigate/monitor/hedge/escalate) with its trade-off (chosen at the cost of what) and rejected variant folded into "rationale", plus firstStep, linked to risk/assumption ids.
5. "summary.expectedEffect" — exposure change, behaviorally observable, WITH a time horizon; no probabilities absent from the facts.

QUALITY BARS:
- Risk priority is probability × impact from the ranking above — do not re-score.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
- Numbers exclusively from the facts above; do not compute or invent new ones.
- Every sentence falsifiable: with opposite facts it would read differently.
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.


${groundingRules(isPolish)}

Return JSON:
{
  "summary": {
    "verdict": "answer-first, 1-2 sentences: which assumption or exposure gates the plan and what to do about it first",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the exposure ranking and assumption fragility above",
    "keyInsights": ["3 insights, each tied to named session elements"],
    "appliedConclusions": ["what to validate first", "what to mitigate", "what to monitor", "what NOT to do"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"exposure change, behaviorally observable","horizon":"..."}
  },
  "moves": [{"title":"...","category":"validate|mitigate|monitor|hedge|escalate","rationale":"why — anchored in listed element ids; MUST name the trade-off (chosen at the cost of what) and the rejected variant","linkedRiskIds":[],"linkedAssumptionIds":[],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","confidence":4,"firstStep":"verb + artifact + role"}],
  "initiatives": [{"title":"...","description":"...","type":"strategic|operational","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"...","linkedItems":[]}],
  "outputCandidates": [{"outputType":"initiative|report|presentation|idea","title":"...","description":"...","linkedRiskIds":[],"linkedScenarioIds":[],"rationale":"...","readiness":"ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}]
}`;
}

/**
 * Builds the deepening prompt for a single dimension rung — used when the user
 * asks AI to "think deeper" on assumptions, risks, or scenarios.
 */
export function buildRiskDeepenPrompt(
  dimension: Parameters<typeof localizeLadder>[0],
  rungId: 'surface' | 'evidence' | 'quantification' | 'response-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(dimension, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;

  return `${rung.question}\n\n${
    isPolish ? 'Kontekst konsultanta' : 'Consultant framing'
  }: ${rung.rationale}`;
}
