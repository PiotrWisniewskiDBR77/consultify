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
 *   output -> { insights[], moves[], initiatives[], outputCandidates[] }
 * with rationale/tradeOff/rejectedVariant on every move (W2).
 */

import type { RiskUncertaintyData } from '@/store/useToolStore';

import { localizeLadder } from './index';
import { rankRisks, buildW2MoveSequence } from './moveValidator';

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

Return JSON:
{
  "insights": ["..."],
  "moves": [{"title":"...","category":"validate|mitigate|monitor|hedge|escalate","rationale":"...","tradeOff":"...","rejectedVariant":"...","linkedRiskIds":[],"linkedAssumptionIds":[],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","confidence":4,"firstStep":"..."}],
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
