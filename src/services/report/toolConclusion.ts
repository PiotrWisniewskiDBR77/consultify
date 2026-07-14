/**
 * toolConclusion — CONCLUSION LAYER for Discovery/Tools outputs (OXFORD O2.3,
 * `docs/standards/CONCLUSION_LAYER_STANDARD.md` variant **W2**: verdict /
 * rationale / tradeoffs (>=1) / moves (K3, impact×effort) / expectedEffect.
 *
 * WHY THIS EXISTS (the gap this closes)
 * -------------------------------------
 * All 19 discovery tools already have a `conclusionPrompts.ts` that asks the
 * LLM for a W2 finishing block (verdict/rationale/tradeoffs/moves/
 * expectedEffect — see e.g. `src/config/swot/conclusionPrompts.ts`), and
 * `server/src/services/conclusions/toolConclusionBridge.ts` already persists
 * that block into the Conclusions layer. But the SCREEN THE USER SEES
 * (`src/components/DiscoveryTools/steps/SummaryStep.tsx`) never renders any
 * of it — it shows `summary.executiveSummary` (a sentence) plus bullet-dumps
 * of `keyInsights`/`appliedConclusions`. That is the "sklejka sekcji" the
 * task description names: a glued list, not a wniosek.
 *
 * This module is the missing piece: a deterministic MODEL BUILDER that
 * assembles a validated K1→K4 conclusion for the summary screen from
 * whatever the session actually has —
 *   - PREFERS the tool's own LLM-generated W2 fields (`summary.verdict`,
 *     `verdictRationale`, `tradeoffs`, `expectedEffect`) when present — those
 *     are already grounded per each tool's `conclusionPrompts.ts` contract.
 *   - The K3 ranking (top-3 "co robić najpierw") is ALWAYS computed
 *     deterministically from `recommendedMoves[].expectedImpact` /
 *     `.estimatedEffort` (session/engine facts, never re-invented) — even
 *     when the LLM prose is missing, the ranking itself is never LLM output.
 *   - Falls back to a deterministic assembly (from `keyInsights` + the
 *     top-ranked move) when the tool has no LLM W2 block yet.
 * The result is run through the 12 §4.4 validators (`conclusionValidators`);
 * a session that fails the hard gate is NOT published as a wniosek — the
 * caller renders the old fallback rather than a broken "conclusion".
 *
 * HARD RULE: every number in the output (impact/effort labels, move counts,
 * evidence counts) comes from the session's own moves/insights — nothing is
 * computed or guessed by this module.
 */

import {
  type ConclusionValidationReport,
  type ValidatableConclusion,
  validateConclusion,
} from './conclusionValidators';

export type ToolConclusionLanguage = 'pl' | 'en';

export type ImpactEffortLevel = 'high' | 'medium' | 'low';

/** Tool-agnostic move fact — every one of the 19 tools' *Move types (SWOTMove,
 * PorterMove, ValueChainMove, CapabilityMove, …) structurally satisfies this. */
export interface ToolMoveFact {
  id: string;
  title: string;
  rationale?: string;
  expectedImpact: ImpactEffortLevel;
  estimatedEffort: ImpactEffortLevel;
  firstStep?: string;
  ownerRole?: string;
  tradeoff?: { chosen: string; deferred: string; cost: string };
  rejectedAlternative?: { option: string; reason: string };
}

/** Pre-existing LLM-generated W2 block, when the tool's conclusionPrompts.ts
 * has already produced one (read from `session.summary.*`). Optional — the
 * builder degrades to a deterministic assembly when absent. */
export interface ToolLlmConclusion {
  verdict?: string;
  rationale?: string;
  tradeoffs?: { chosen: string; rejected: string; why: string }[];
  expectedEffect?: { text: string; horizon: string };
}

export interface ToolConclusionFacts {
  language: ToolConclusionLanguage;
  toolName: string;
  /** Ranking source (K3) — always engine/session facts, never LLM-ranked. */
  moves: ToolMoveFact[];
  /** Accepted-session observations (bullet facts), used as a K1/K2 fallback. */
  keyInsights: string[];
  /** Count of accepted/evidence-bearing session elements — drives confidence. */
  evidenceCount: number;
  llm?: ToolLlmConclusion;
}

export interface ToolK3Action {
  action: string;
  whyFirst: string;
  ownerRole: string;
  impact: ImpactEffortLevel;
  effort: ImpactEffortLevel;
}

export interface ToolConclusionModel {
  toolName: string;
  language: ToolConclusionLanguage;
  headline: string;
  rationale: string;
  k3Actions: ToolK3Action[];
  tradeoffs: { chosen: string; rejected: string; why: string }[];
  effect: { text: string; horizon: string } | null;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  /** Provenance — surfaced so a deterministic fallback is never passed off as
   * the tool's authored LLM conclusion (CONCLUSION_LAYER_STANDARD §2 R2). */
  source: 'llm' | 'deterministic';
  validation: ConclusionValidationReport;
  /** True only when the hard §4.4 gate passes — caller MUST NOT render this
   * as a wniosek otherwise (falls back to the legacy summary view). */
  isPublishable: boolean;
}

// ---------------------------------------------------------------------------
// Ranking (K3) — always deterministic, impact×effort, never LLM-ordered.
// ---------------------------------------------------------------------------

const LEVEL_WEIGHT: Record<ImpactEffortLevel, number> = { high: 3, medium: 2, low: 1 };

/** impact×effort score: high impact + low effort ranks first (quick wins). */
function moveScore(m: ToolMoveFact): number {
  return LEVEL_WEIGHT[m.expectedImpact] * 2 - LEVEL_WEIGHT[m.estimatedEffort];
}

/** Rank moves by impact×effort, deterministic tie-break by id. Pure. */
export function rankMoves(moves: ToolMoveFact[]): ToolMoveFact[] {
  return [...moves].sort((a, b) => moveScore(b) - moveScore(a) || a.id.localeCompare(b.id));
}

function confidenceFor(evidenceCount: number): ToolConclusionModel['confidence'] {
  if (evidenceCount === 0) return 'insufficient';
  if (evidenceCount >= 5) return 'high';
  if (evidenceCount >= 3) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Deterministic fallback prose (used when the tool has no LLM W2 block yet)
// ---------------------------------------------------------------------------

function fallbackHeadline(isPL: boolean, top: ToolMoveFact | undefined, toolName: string): string {
  if (!top) {
    return isPL
      ? `${toolName}: analiza niekompletna — brak rekomendacji do jednoznacznego werdyktu.`
      : `${toolName}: analysis incomplete — no recommendation for a firm verdict.`;
  }
  return isPL
    ? `Priorytet: „${top.title}” (wpływ ${top.expectedImpact}, wysiłek ${top.estimatedEffort}) — najwyższa dźwignia impact×effort z tej analizy.`
    : `Priority: "${top.title}" (impact ${top.expectedImpact}, effort ${top.estimatedEffort}) — the highest impact×effort leverage in this analysis.`;
}

function fallbackRationale(
  isPL: boolean,
  insights: string[],
  top: ToolMoveFact | undefined
): string {
  if (top?.rationale) return top.rationale;
  if (insights.length > 0) return insights.slice(0, 3).join(' ');
  return isPL
    ? 'Uzasadnienie do ustalenia — sesja nie ma jeszcze wystarczających zaakceptowanych elementów.'
    : 'Rationale to be established — the session lacks sufficient accepted elements yet.';
}

function fallbackTradeoffs(
  ranked: ToolMoveFact[]
): { chosen: string; rejected: string; why: string }[] {
  if (ranked.length === 0) return [];
  const top = ranked[0];
  if (top.tradeoff) {
    return [
      { chosen: top.tradeoff.chosen, rejected: top.tradeoff.deferred, why: top.tradeoff.cost },
    ];
  }
  if (ranked.length < 2) return [];
  const second = ranked[1];
  return [
    {
      chosen: top.title,
      rejected: second.title,
      why: `impact×effort ${top.expectedImpact}/${top.estimatedEffort} > ${second.expectedImpact}/${second.estimatedEffort}`,
    },
  ];
}

function fallbackEffect(
  isPL: boolean,
  ranked: ToolMoveFact[]
): { text: string; horizon: string } | null {
  if (ranked.length === 0) return null;
  const top = ranked[0];
  const horizon = isPL ? '1 kwartał' : '1 quarter';
  const text = isPL
    ? `Wdrożenie „${top.title}” w horyzoncie ${horizon} przesuwa priorytet z analizy do działania — mierzalnie: pierwszy krok („${top.firstStep || 'do doprecyzowania'}”) wykonany i zweryfikowany.`
    : `Executing "${top.title}" within ${horizon} moves the priority from analysis to action — measurably: the first step ("${top.firstStep || 'to be refined'}") executed and verified.`;
  return { text, horizon };
}

function toActions(isPL: boolean, ranked: ToolMoveFact[]): ToolK3Action[] {
  return ranked.slice(0, 3).map((m) => ({
    action: m.firstStep ? `${m.title} — ${m.firstStep}` : m.title,
    whyFirst:
      m.rationale ||
      (isPL
        ? `impact ${m.expectedImpact}, effort ${m.estimatedEffort} — najwyższa dźwignia wśród rekomendacji.`
        : `impact ${m.expectedImpact}, effort ${m.estimatedEffort} — highest leverage among the recommendations.`),
    ownerRole: m.ownerRole || (isPL ? 'Zespół projektowy' : 'Project team'),
    impact: m.expectedImpact,
    effort: m.estimatedEffort,
  }));
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

/**
 * Build a validated W2 conclusion model for a tool session's summary screen.
 * Prefers the tool's own LLM-generated block; the K3 ranking is always
 * deterministic. Runs the §4.4 validators and marks `isPublishable` — the
 * caller (SummaryStep) must fall back to the legacy view when false.
 */
export function buildToolConclusionModel(facts: ToolConclusionFacts): ToolConclusionModel {
  const isPL = facts.language === 'pl';
  const ranked = rankMoves(facts.moves);
  const top = ranked[0];

  const usingLlm = Boolean(facts.llm?.verdict && facts.llm.verdict.trim().length > 0);
  const headline = usingLlm
    ? facts.llm!.verdict!.trim()
    : fallbackHeadline(isPL, top, facts.toolName);
  const rationale =
    facts.llm?.rationale && facts.llm.rationale.trim().length > 0
      ? facts.llm.rationale.trim()
      : fallbackRationale(isPL, facts.keyInsights, top);
  const tradeoffs =
    facts.llm?.tradeoffs && facts.llm.tradeoffs.length > 0
      ? facts.llm.tradeoffs
      : fallbackTradeoffs(ranked);
  const effect =
    facts.llm?.expectedEffect && facts.llm.expectedEffect.text.trim().length > 0
      ? facts.llm.expectedEffect
      : fallbackEffect(isPL, ranked);
  const k3Actions = toActions(isPL, ranked);
  const confidence = confidenceFor(facts.evidenceCount);

  const validatable: ValidatableConclusion = {
    headline,
    k1Text:
      facts.keyInsights.length > 0
        ? facts.keyInsights.slice(0, 3).join(' ')
        : top
          ? `${top.title} (impact ${top.expectedImpact}, effort ${top.estimatedEffort}).`
          : '',
    k1FactRefs: ranked.map((m) => m.id),
    k2Text: rationale,
    k2FactRefs: top ? [top.id] : [],
    k3Actions: k3Actions.map((a) => ({
      action: a.action,
      whyFirst: a.whyFirst,
      ownerRole: a.ownerRole,
    })),
    k4Text: effect?.text || '',
    k4Horizon: effect?.horizon || '',
    confidence: confidence === 'insufficient' ? 'insufficient' : confidence,
    language: facts.language,
    facts: {
      moves: facts.moves,
      keyInsights: facts.keyInsights,
      evidenceCount: facts.evidenceCount,
    },
    tradeoffs,
  };

  const validation = validateConclusion(validatable);

  return {
    toolName: facts.toolName,
    language: facts.language,
    headline,
    rationale,
    k3Actions,
    tradeoffs,
    effect,
    confidence,
    source: usingLlm ? 'llm' : 'deterministic',
    validation,
    isPublishable: validation.allHardPass && k3Actions.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Session adapter — tool-agnostic extraction of ToolConclusionFacts.
//
// The 19 tools' `inputData` shapes differ (SWOTData, PorterData, …) but all
// converge on the same generic contract: `recommendedMoves[]` (impact/effort
// engine facts) + `summary` (keyInsights + optional LLM W2 block). This
// adapter reads that generic contract defensively (unknown-typed) instead of
// importing every per-tool type, mirroring the same key-based extraction
// `toolConclusionBridge.ts` uses server-side.
// ---------------------------------------------------------------------------

const REJECTED_MARKERS = new Set([
  'ai-proposed',
  'rejected',
  'rethinking',
  'proposed',
  'needs-evidence',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isAccepted(el: unknown): boolean {
  const rec = asRecord(el);
  if (!rec) return true;
  const marker = rec.proposalStatus ?? rec.status ?? rec.state;
  if (marker == null) return true;
  return !REJECTED_MARKERS.has(String(marker).toLowerCase());
}

function countAcceptedEvidence(data: Record<string, unknown>): number {
  const collectionKeys = [
    'items',
    'signals',
    'tensions',
    'correlations',
    'capabilities',
    'risks',
    'assumptions',
    'scenarios',
    'comparisons',
    'options',
    'insights',
  ];
  let count = 0;
  for (const key of collectionKeys) {
    const coll = data[key];
    if (Array.isArray(coll)) count += coll.filter(isAccepted).length;
  }
  return count;
}

function isImpactEffortLevel(value: unknown): value is ImpactEffortLevel {
  return value === 'high' || value === 'medium' || value === 'low';
}

function moveFromRecord(rec: Record<string, unknown>, index: number): ToolMoveFact | null {
  const title = typeof rec.title === 'string' ? rec.title : null;
  if (!title) return null;
  const impact = isImpactEffortLevel(rec.expectedImpact)
    ? rec.expectedImpact
    : isImpactEffortLevel(rec.estimatedImpact)
      ? (rec.estimatedImpact as ImpactEffortLevel)
      : 'medium';
  const effort = isImpactEffortLevel(rec.estimatedEffort) ? rec.estimatedEffort : 'medium';
  const tradeoff = asRecord(rec.tradeoff);
  const rejectedAlternative = asRecord(rec.rejectedAlternative);
  return {
    id: typeof rec.id === 'string' && rec.id ? rec.id : `move-${index}`,
    title,
    rationale: typeof rec.rationale === 'string' ? rec.rationale : undefined,
    expectedImpact: impact,
    estimatedEffort: effort,
    firstStep: typeof rec.firstStep === 'string' ? rec.firstStep : undefined,
    ownerRole: typeof rec.ownerRole === 'string' ? rec.ownerRole : undefined,
    tradeoff:
      tradeoff &&
      typeof tradeoff.chosen === 'string' &&
      typeof tradeoff.deferred === 'string' &&
      typeof tradeoff.cost === 'string'
        ? { chosen: tradeoff.chosen, deferred: tradeoff.deferred, cost: tradeoff.cost }
        : undefined,
    rejectedAlternative:
      rejectedAlternative &&
      typeof rejectedAlternative.option === 'string' &&
      typeof rejectedAlternative.reason === 'string'
        ? { option: rejectedAlternative.option, reason: rejectedAlternative.reason }
        : undefined,
  };
}

export interface ExtractToolConclusionFactsParams {
  toolName: string;
  language: ToolConclusionLanguage;
  /** `session.inputData` — any of the 19 tools' data shapes. */
  inputData: unknown;
  /** `session.generatedInitiatives` — used as a moves fallback for tools that
   * have not yet been ported to `recommendedMoves` (K3 still engine-ranked). */
  fallbackInitiatives?: Array<{
    id: string;
    title: string;
    rationale?: string;
    estimatedImpact: ImpactEffortLevel;
    estimatedEffort: ImpactEffortLevel;
  }>;
}

/** Tool-agnostic extraction of `ToolConclusionFacts` from a session's
 * `inputData` (any of the 19 shapes). Numbers ONLY from the session's own
 * moves/insights — nothing invented here (R5). */
export function extractToolConclusionFacts(
  params: ExtractToolConclusionFactsParams
): ToolConclusionFacts {
  const data = asRecord(params.inputData) ?? {};
  const summary = asRecord(data.summary);

  const rawMoves = Array.isArray(data.recommendedMoves)
    ? data.recommendedMoves
    : Array.isArray(data.moves)
      ? data.moves
      : [];
  let moves = rawMoves
    .map((m, i) => moveFromRecord(asRecord(m) ?? {}, i))
    .filter((m): m is ToolMoveFact => m !== null);

  if (moves.length === 0 && params.fallbackInitiatives && params.fallbackInitiatives.length > 0) {
    moves = params.fallbackInitiatives.map((i) => ({
      id: i.id,
      title: i.title,
      rationale: i.rationale,
      expectedImpact: i.estimatedImpact,
      estimatedEffort: i.estimatedEffort,
    }));
  }

  const keyInsights = Array.isArray(summary?.keyInsights)
    ? (summary!.keyInsights as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  const evidenceCount = countAcceptedEvidence(data) || moves.length;

  const tradeoffsRaw = Array.isArray(summary?.tradeoffs) ? (summary!.tradeoffs as unknown[]) : [];
  const tradeoffs = tradeoffsRaw
    .map((t) => asRecord(t))
    .filter((t): t is Record<string, unknown> => t !== null)
    .map((t) => ({
      chosen: typeof t.chosen === 'string' ? t.chosen : '',
      rejected: typeof t.rejected === 'string' ? t.rejected : '',
      why: typeof t.why === 'string' ? t.why : '',
    }))
    .filter((t) => t.chosen && t.rejected && t.why);

  const expectedEffectRec = asRecord(summary?.expectedEffect);
  const expectedEffect =
    expectedEffectRec &&
    typeof expectedEffectRec.text === 'string' &&
    typeof expectedEffectRec.horizon === 'string'
      ? { text: expectedEffectRec.text, horizon: expectedEffectRec.horizon }
      : undefined;

  const verdictRationaleRec = asRecord(summary?.verdictRationale);
  const rationale =
    typeof verdictRationaleRec?.text === 'string'
      ? verdictRationaleRec.text
      : typeof summary?.executiveSummary === 'string'
        ? (summary.executiveSummary as string)
        : undefined;

  const llm: ToolLlmConclusion | undefined = summary
    ? {
        verdict: typeof summary.verdict === 'string' ? summary.verdict : undefined,
        rationale,
        tradeoffs: tradeoffs.length > 0 ? tradeoffs : undefined,
        expectedEffect,
      }
    : undefined;

  return {
    language: params.language,
    toolName: params.toolName,
    moves,
    keyInsights,
    evidenceCount,
    llm,
  };
}
