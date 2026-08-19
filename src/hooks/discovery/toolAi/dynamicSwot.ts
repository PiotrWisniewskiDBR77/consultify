/**
 * Dynamic SWOT — AI prompt builders + pending-action reducers (OXFORD O3 pilot).
 *
 * Doctrine:
 * - docs/standards/CONCLUSION_LAYER_STANDARD.md — §4 ConclusionInput/Output contract,
 *   variant W2 (verdict + rationale + MANDATORY trade-off + rejected alternative).
 * - src/config/swot/* — laddered question bank, insight staircase, tension engine.
 *
 * Hard rules encoded into every prompt:
 * - Numbers and facts ONLY from the session facts block (signals + accepted elements).
 *   The LLM never computes and never invents numbers.
 * - Every interpretive claim carries factRefs into the session.
 * - Items without session evidence are explicitly "declared, unconfirmed".
 */

import {
  type ConsultingMissionContext,
  createConsultingMissionContext,
} from '@/config/consultingToolsStandard';
import {
  buildQuadrantLadderPromptBlock,
  type SwotQuadrant,
} from '@/config/swot/dynamicSwotQuestionBank';
import { buildStaircasePromptRules } from '@/config/swot/swotInsightStaircase';
import {
  buildMoveConclusionPromptRules,
  deriveTensionCandidates,
  type SwotTensionType,
  TENSION_TYPE_TO_POSTURE,
} from '@/config/swot/swotTensionEngine';
import type {
  SessionGenerationStatus,
  SWOTCorrelation,
  SWOTData,
  SWOTItem,
  SWOTTension,
  ToolType,
} from '@/store/useToolStore';

import { GROUNDING_RULES_BOTH } from './groundingRules';
export type ToolAiPendingAction =
  | 'suggestions'
  | 'correlations'
  | 'summary'
  | 'full-session'
  | 'rethink';

interface DynamicSwotActionHandlers {
  updateInputData: (data: Partial<SWOTData>) => void;
  addSWOTSignal: (signal: Omit<SWOTData['signals'][number], 'id'>) => void;
  addSWOTItem: (item: Omit<SWOTData['items'][number], 'id'>) => void;
  addCorrelation: (correlation: Omit<SWOTCorrelation, 'id'>) => void;
  setSWOTTensions: (tensions: Omit<SWOTData['tensions'][number], 'id'>[]) => void;
  setSWOTMoves: (moves: Omit<SWOTData['recommendedMoves'][number], 'id'>[]) => void;
  setSWOTOutputCandidates: (candidates: Omit<SWOTData['outputCandidates'][number], 'id'>[]) => void;
  setSWOTSummary: (summary: NonNullable<SWOTData['summary']>) => void;
  setInitiatives: (initiatives: any[]) => void;
  setSessionGenerationStatus: (status: SessionGenerationStatus) => void;
  updateCardAfterRethink: (cardType: any, cardId: string, updates: Record<string, unknown>) => void;
}

interface ApplyDynamicSwotPendingActionOptions {
  pendingAction: ToolAiPendingAction;
  parsed: Record<string, any>;
  currentStepId?: string;
  swotData: SWOTData;
  rethinkTarget?: { cardType: string; cardId: string } | null;
  toolType: ToolType;
  actions: DynamicSwotActionHandlers;
}

export interface DynamicSwotApplyResult {
  missionSuggestion?: Partial<ConsultingMissionContext> | null;
  clearRethinkTarget?: boolean;
}

// ---------------------------------------------------------------------------
// ConclusionInput-style facts block (§4.1) — the ONLY source of facts/numbers
// ---------------------------------------------------------------------------

const isActiveCard = (card: { proposalStatus?: string }) =>
  card.proposalStatus !== 'rejected' && card.proposalStatus !== 'rethinking';

const isAccepted = (card: { proposalStatus?: string; status?: string }) =>
  card.proposalStatus === 'accepted' ||
  (!card.proposalStatus && (card.status === 'accepted' || card.status === undefined));

/**
 * Serializes the session into a closed facts block (ConclusionInput.facts).
 * Every entry carries a stable ref key the model must echo back as factRefs.
 */
export function buildSwotFactsBlock(swotData: SWOTData): string {
  const lines: string[] = [];
  const ctx = swotData.context;
  lines.push('MISSION (org framing — not evidence):');
  lines.push(`- goal: ${ctx?.goal || 'not defined'}`);
  lines.push(`- scope: ${ctx?.scope || 'not defined'}`);
  lines.push(`- successSignal: ${ctx?.successSignal || 'not defined'}`);
  lines.push(`- timeframe: ${ctx?.timeframe || 'medium'}`);
  if (ctx?.constraints) lines.push(`- constraints: ${ctx.constraints}`);
  if (ctx?.assumptions) lines.push(`- assumptions: ${ctx.assumptions}`);
  if (ctx?.kpiTarget) lines.push(`- kpiTarget: ${ctx.kpiTarget}`);

  const signals = (swotData.signals || []).filter(isActiveCard);
  lines.push('');
  lines.push('EVIDENCE (facts[] — the ONLY admissible source of numbers and facts):');
  if (signals.length === 0) {
    lines.push('- (no evidence captured yet — everything downstream is a declaration)');
  }
  signals.forEach((signal) => {
    const conf =
      signal.evidenceType === 'fact'
        ? 'confirmed'
        : signal.evidenceType === 'hypothesis'
          ? 'missing'
          : 'declared';
    lines.push(
      `- [${signal.id}] (${signal.type}, ${conf}) ${signal.content} — source: ${signal.sourceLabel}`
    );
  });

  const items = (swotData.items || []).filter(isActiveCard);
  if (items.length > 0) {
    lines.push('');
    lines.push('SWOT ELEMENTS (accepted = client-validated, proposed = pending):');
    items.forEach((item) => {
      const state = isAccepted(item) ? 'accepted' : 'proposed';
      const evidence = item.evidenceStatus ? `, evidence: ${item.evidenceStatus}` : '';
      lines.push(
        `- [${item.id}] ${item.quadrant.toUpperCase()} (${state}, impact ${item.impact}${evidence}) ${item.text}`
      );
      if (item.staircase?.fact) {
        lines.push(
          `    fact: ${item.staircase.fact} | interpretation: ${item.staircase.interpretation} | implication: ${item.staircase.implication}`
        );
      }
    });
  }

  const tensions = (swotData.tensions || []).filter(isActiveCard);
  if (tensions.length > 0) {
    lines.push('');
    lines.push('TENSIONS:');
    tensions.forEach((tension) => {
      lines.push(
        `- [${tension.id}] (${tension.type}) ${tension.title}: ${tension.insight} [items: ${(tension.linkedItemIds || []).join(', ') || 'none'}]`
      );
    });
  }
  return lines.join('\n');
}

const HARD_RULES_BLOCK = `HARD RULES (CONCLUSION_LAYER_STANDARD §4):
- You are a partner at a consulting firm (HBS, MBA, 10 years of practice). You sign this output with your own name in front of the client's board.
- Numbers and facts EXCLUSIVELY from the facts block above. Never compute, never estimate, never quote statistics from outside the input.
- Every interpretive claim carries "factRefs" — ids from the facts block. A claim without evidence must be named a hypothesis.
- Evidence marked "declared" -> write "wg deklaracji, do potwierdzenia" / "as declared, to be confirmed". No data -> "do ustalenia (gdzie/kiedy)" / "to be established (where/when)" — never an invented number.
- No filler phrases that fit any company on earth ("improve communication", "optimize processes", "dynamic market"). Every conclusion must be falsifiable: with opposite data it would read differently.
- Answer-first (Minto): the first sentence of every conclusion unit is the conclusion, not an introduction.
- Actions: verb + artifact + accountable role. Effects: measurable or behaviorally observable, with a time horizon.
- Respond in the user's language (Polish or English) — professional partner tone, active voice.`;

// ---------------------------------------------------------------------------
// Laddered question prompt (q-bank as single source of truth)
// ---------------------------------------------------------------------------

/**
 * Builds the interviewing prompt for a quadrant: the AI mentor must walk the
 * laddered question bank, branching on the user's answers, and must not accept
 * an element without either evidence or an explicit "declared, unconfirmed".
 */
export function buildDynamicSwotQuadrantLadderPrompt(
  swotData: SWOTData,
  quadrant: SwotQuadrant,
  language: 'pl' | 'en' = 'en'
): string {
  const ladder = buildQuadrantLadderPromptBlock(quadrant, language);
  return `${buildSwotFactsBlock(swotData)}

You are interviewing the client about the "${quadrant}" quadrant. Use the laddered question bank below as your interview protocol — it is the single source of truth. Ask ONE question at a time, then branch on the answer using the branch keys.

QUESTION LADDER (${quadrant}):
${ladder}

INTERVIEW RULES:
- Start at the level-1 question unless the ladder position is already known from the conversation.
- Classify the user's answer into one of the branch keys and follow that branch. If the answer is vague, use the probe before moving on.
- ${quadrant === 'strengths' ? 'Distinguish a NICHE STRENGTH from a CORE COMPETENCY: external validation + broad scope + durability = core competency; validated but segment-bound = niche strength; no external proof = claimed strength (declared, unconfirmed).' : ''}
- ${quadrant === 'weaknesses' ? 'Umbrella claims ("lack of agility", "poor communication") MUST be decomposed: process / tools / skills / incentives — each root demands a different move.' : ''}
- When the ladder completes, propose the resulting SWOT item WITH its insight staircase and evidence status.

${buildStaircasePromptRules(language)}

${HARD_RULES_BLOCK}

When proposing the resulting item, return JSON:
{"items":[{"text":"...","quadrant":"${quadrant}","impact":"high|medium|low","confidence":1-5,"status":"proposed","staircase":{"fact":"...","factRefs":["signal-id"],"interpretation":"...","implication":"..."},"decomposition":[{"dimension":"process|tools|skills|incentives","finding":"..."}],"evidenceStatus":"confirmed|declared","classification":"core-competency|niche-strength|claimed-strength|table-stakes","ladderAnswers":[{"questionId":"...","answerKey":"...","note":"..."}]}]}
("decomposition" required only for umbrella claims; "classification" only for strengths.)`;
}

/**
 * Conversation-layer protocol appended to the system prompt for the SWOT step:
 * the mentor in chat interviews with the SAME laddered question bank as the wizard
 * (single source of truth), one question at a time, branching on answers.
 */
export function buildDynamicSwotConversationProtocol(
  stepId: string | undefined,
  language: 'pl' | 'en' = 'en'
): string {
  if (stepId !== 'swot') return '';
  const quadrants: SwotQuadrant[] = ['strengths', 'weaknesses', 'opportunities', 'threats'];
  const ladders = quadrants
    .map(
      (quadrant) =>
        `--- ${quadrant.toUpperCase()} ---\n${buildQuadrantLadderPromptBlock(quadrant, language)}`
    )
    .join('\n');
  return `

INTERVIEW PROTOCOL (laddered question bank — the single source of truth for this step):
When the user explores a quadrant in conversation, walk this ladder. Ask ONE question at a time; classify the answer into a branch key and follow the branch. Vague answer -> use the probe. When a ladder path completes, propose the resulting item with its insight staircase and evidence status ("confirmed" only with session evidence, otherwise explicitly "declared, unconfirmed").

${ladders}`;
}

// ---------------------------------------------------------------------------
// Correlations / tensions — computed pairs first, narration second
// ---------------------------------------------------------------------------

export function buildDynamicSwotCorrelationsPrompt(swotData: SWOTData): string | null {
  const items = swotData.items || [];
  if (items.length < 4) return null;

  // Deterministic engine output: explicit SO/WO/ST/WT pairs from ACCEPTED items.
  const candidates = deriveTensionCandidates(items.filter(isActiveCard), 3);
  const acceptedItems = items.filter((item) => isActiveCard(item) && isAccepted(item));
  const itemsForPrompt = (acceptedItems.length >= 4 ? acceptedItems : items.filter(isActiveCard))
    .map(
      (item: SWOTItem) =>
        `[${item.id}] ${item.quadrant.toUpperCase()} (${item.impact} impact${item.evidenceStatus ? `, evidence: ${item.evidenceStatus}` : ''}): ${item.text}`
    )
    .join('\n');

  const candidateLines =
    candidates.length > 0
      ? candidates
          .map(
            (c) =>
              `- ${c.type} pair [${c.linkedItemIds[0]} x ${c.linkedItemIds[1]}] (weight ${c.weight})`
          )
          .join('\n')
      : '- (not enough accepted items to pre-compute pairs — pair only from the ids listed above)';

  return `${buildSwotFactsBlock(swotData)}

SWOT ITEMS IN SCOPE:
${itemsForPrompt}

PRE-COMPUTED TENSION CANDIDATES (from ACCEPTED items, impact-ranked — your working set):
${candidateLines}

Task: turn the strongest candidate pairs into strategic correlations. You NARRATE tensions that verifiably exist in the session — you do not invent pairs.

RULES:
- "items" in each correlation MUST be ids from the list above (they will be validated; invalid ids are dropped).
- Cover the four postures where the material allows: SO (attack), WO (repair), ST (defend), WT (protect). If a posture cannot be formed, say so in "coverageNote" instead of forcing it.
- Each "insight" must say WHY these two elements together demand a decision — not restate both items. Falsifiable, grounded in factRefs.
- "whyNow" names the timing pressure (window closing, compounding cost, visible early signal) — from the facts block only.

${HARD_RULES_BLOCK}

Return as JSON:
{"correlations":[{"items":["itemId1","itemId2"],"type":"SO|WO|ST|WT","insight":"...","factRefs":["signal-id"],"whyNow":"...","initiativeProposal":"..."}],"coverageNote":"which postures could not be formed and why"}`;
}

// ---------------------------------------------------------------------------
// Full session draft
// ---------------------------------------------------------------------------

export function buildDynamicSwotFullSessionPrompt(
  swotData: SWOTData | undefined,
  orgContext: string
): string {
  return `You are a senior strategy partner presenting first findings to a CEO. Produce a COMPLETE first-draft Dynamic SWOT session. Everything you produce is a PROPOSAL for the client to review.

=== SESSION FACTS ===
${swotData ? buildSwotFactsBlock(swotData) : '(empty session)'}
=== ORGANIZATION CONTEXT ===
${orgContext}
=== END CONTEXT ===

${HARD_RULES_BLOCK}

${buildStaircasePromptRules('en')}

${buildMoveConclusionPromptRules('en')}


${GROUNDING_RULES_BOTH}
Return a single JSON object with this exact structure:
{
  "signals": [
    {"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["..."], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}
  ],
  "items": [
    {"text": "...", "impact": "high|medium|low", "quadrant": "strengths|weaknesses|opportunities|threats", "confidence": 1-5, "status": "proposed",
     "staircase": {"fact": "...", "factRefs": ["..."], "interpretation": "...", "implication": "..."},
     "decomposition": [{"dimension": "process|tools|skills|incentives", "finding": "..."}],
     "evidenceStatus": "confirmed|declared",
     "classification": "core-competency|niche-strength|claimed-strength|table-stakes"}
  ],
  "correlations": [
    {"type": "SO|WO|ST|WT", "insight": "...", "factRefs": ["..."], "initiativeProposal": "..."}
  ],
  "tensions": [
    {"title": "...", "type": "attack|repair|defend|protect", "insight": "...", "whyNow": "...", "confidence": 1-5}
  ],
  "moves": [
    {"title": "...", "category": "quick-win|big-bet|defensive-move|capability-build", "rationale": "...",
     "tradeoff": {"chosen": "...", "deferred": "...", "cost": "..."},
     "rejectedAlternative": {"option": "...", "reason": "..."},
     "whyFirst": "...", "ownerRole": "...",
     "expectedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "riskLevel": "high|medium|low", "confidence": 1-5, "firstStep": "..."}
  ],
  "outputCandidates": [
    {"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "rationale": "...", "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}
  ],
  "summary": {
    "verdict": "answer-first, 1-2 sentences: what this analysis means for the client's decision",
    "verdictRationale": {"text": "why — referencing specific elements", "factRefs": ["..."]},
    "tradeoffs": [{"chosen": "...", "rejected": "...", "why": "..."}],
    "expectedEffect": {"text": "...", "horizon": "e.g. 2 quarters"},
    "executiveSummary": "...",
    "keyInsights": ["..."],
    "appliedConclusions": ["..."]
  },
  "initiatives": [
    {"title": "...", "description": "...", "type": "strategic|operational|defensive|growth", "rationale": "...", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low"}
  ]
}

Guidelines:
- 4-8 signals from diverse sources; every downstream fact must trace to one of them.
- 8-12 SWOT items across all 4 quadrants (>= 2 per quadrant), each with a complete staircase; umbrella weaknesses decomposed.
- 3-5 correlations and 3-5 tensions covering different postures with clear "why now".
- 3-5 moves, EACH with tradeoff + rejectedAlternative — a move without a trade-off will be rejected by validation.
- Summary: verdict first; >= 1 trade-off at recommendation level; effect with horizon.
- 2-4 output candidates and 2-4 initiative drafts.`;
}

// ---------------------------------------------------------------------------
// Rethink
// ---------------------------------------------------------------------------

export function buildDynamicSwotRethinkPrompt(
  swotData: SWOTData,
  cardType: string,
  cardId: string,
  userComment?: string
): string {
  let cardContent = '';
  if (cardType === 'signal') {
    const signal = swotData.signals.find((s) => s.id === cardId);
    cardContent = signal
      ? `[${signal.type}] ${signal.content} (source: ${signal.sourceLabel})`
      : '';
  } else if (cardType === 'item') {
    const item = swotData.items.find((i) => i.id === cardId);
    cardContent = item
      ? `[${item.quadrant}] ${item.text} (impact: ${item.impact})${
          item.staircase
            ? `\nstaircase: fact="${item.staircase.fact}" | interpretation="${item.staircase.interpretation}" | implication="${item.staircase.implication}"`
            : ''
        }`
      : '';
  } else if (cardType === 'tension') {
    const tension = swotData.tensions.find((t) => t.id === cardId);
    cardContent = tension ? `[${tension.type}] ${tension.title}: ${tension.insight}` : '';
  } else if (cardType === 'move') {
    const move = swotData.recommendedMoves.find((m) => m.id === cardId);
    cardContent = move
      ? `[${move.category}] ${move.title}: ${move.rationale}${
          move.tradeoff
            ? `\ntradeoff: chosen="${move.tradeoff.chosen}" deferred="${move.tradeoff.deferred}" cost="${move.tradeoff.cost}"`
            : ''
        }`
      : '';
  } else if (cardType === 'output-candidate') {
    const output = swotData.outputCandidates.find((o) => o.id === cardId);
    cardContent = output ? `[${output.outputType}] ${output.title}: ${output.description}` : '';
  } else if (cardType === 'conclusion') {
    cardContent = JSON.stringify(
      {
        verdict: swotData.summary?.verdict || '',
        executiveSummary: swotData.summary?.executiveSummary || '',
        keyInsights: swotData.summary?.keyInsights || [],
        appliedConclusions: swotData.summary?.appliedConclusions || [],
        tradeoffs: swotData.summary?.tradeoffs || [],
      },
      null,
      2
    );
  }

  return `The user wants you to RETHINK this specific ${cardType} card.

Current card content:
${cardContent}

User feedback: ${userComment || 'Please provide a better version.'}

=== SESSION FACTS ===
${buildSwotFactsBlock(swotData)}
=== END FACTS ===

${HARD_RULES_BLOCK}

Provide an improved version of this card. Keep the same type/structure but make it sharper, grounded in the facts block, and responsive to the user's feedback.
${cardType === 'item' ? 'The improved item MUST include the full "staircase" (fact/factRefs/interpretation/implication).' : ''}
${cardType === 'move' ? 'The improved move MUST include "tradeoff" {chosen,deferred,cost} and "rejectedAlternative" {option,reason}.' : ''}

Return JSON with the updated fields for this ${cardType}. Use the same field names as the original.
If the card type is conclusion, return:
{"verdict":"...","verdictRationale":{"text":"...","factRefs":["..."]},"tradeoffs":[{"chosen":"...","rejected":"...","why":"..."}],"expectedEffect":{"text":"...","horizon":"..."},"executiveSummary":"...","keyInsights":["..."],"appliedConclusions":["..."]}`;
}

// ---------------------------------------------------------------------------
// Parsers for the new structured fields
// ---------------------------------------------------------------------------

function normalizeStaircase(raw: any): SWOTItem['staircase'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const fact = typeof raw.fact === 'string' ? raw.fact : '';
  const interpretation = typeof raw.interpretation === 'string' ? raw.interpretation : '';
  const implication = typeof raw.implication === 'string' ? raw.implication : '';
  if (!fact && !interpretation && !implication) return undefined;
  return {
    fact,
    factRefs: Array.isArray(raw.factRefs) ? raw.factRefs.filter(Boolean).map(String) : [],
    interpretation,
    implication,
  };
}

function normalizeDecomposition(raw: any): SWOTItem['decomposition'] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const valid = raw.filter(
    (d: any) =>
      d &&
      ['process', 'tools', 'skills', 'incentives'].includes(d.dimension) &&
      typeof d.finding === 'string' &&
      d.finding.trim()
  );
  return valid.length > 0
    ? valid.map((d: any) => ({ dimension: d.dimension, finding: String(d.finding) }))
    : undefined;
}

function normalizeItemConclusionFields(item: any): Partial<Omit<SWOTItem, 'id'>> {
  const extras: Partial<Omit<SWOTItem, 'id'>> = {};
  const staircase = normalizeStaircase(item.staircase);
  if (staircase) extras.staircase = staircase;
  const decomposition = normalizeDecomposition(item.decomposition);
  if (decomposition) extras.decomposition = decomposition;
  if (item.evidenceStatus === 'confirmed' || item.evidenceStatus === 'declared') {
    extras.evidenceStatus = item.evidenceStatus;
  } else if (staircase) {
    extras.evidenceStatus = staircase.factRefs.length > 0 ? 'confirmed' : 'declared';
  }
  if (
    ['core-competency', 'niche-strength', 'claimed-strength', 'table-stakes'].includes(
      item.classification
    )
  ) {
    extras.classification = item.classification;
  }
  if (Array.isArray(item.ladderAnswers)) {
    const answers = item.ladderAnswers.filter(
      (a: any) => a && typeof a.questionId === 'string' && typeof a.answerKey === 'string'
    );
    if (answers.length > 0) {
      extras.ladderAnswers = answers.map((a: any) => ({
        questionId: a.questionId,
        answerKey: a.answerKey,
        note: typeof a.note === 'string' ? a.note : undefined,
      }));
    }
  }
  return extras;
}

function normalizeMoveTradeoff(
  raw: any
): { chosen: string; deferred: string; cost: string } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const chosen = typeof raw.chosen === 'string' ? raw.chosen : '';
  const deferred = typeof raw.deferred === 'string' ? raw.deferred : '';
  const cost = typeof raw.cost === 'string' ? raw.cost : '';
  if (!chosen && !deferred && !cost) return undefined;
  return { chosen, deferred, cost };
}

function normalizeRejectedAlternative(raw: any): { option: string; reason: string } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const option = typeof raw.option === 'string' ? raw.option : '';
  const reason = typeof raw.reason === 'string' ? raw.reason : '';
  if (!option && !reason) return undefined;
  return { option, reason };
}

function normalizeMove(move: any): Omit<SWOTData['recommendedMoves'][number], 'id'> {
  return {
    title: move.title,
    category: move.category || 'quick-win',
    rationale: move.rationale || '',
    linkedTensionIds: Array.isArray(move.linkedTensionIds) ? move.linkedTensionIds : [],
    linkedItemIds: Array.isArray(move.linkedItemIds) ? move.linkedItemIds : [],
    expectedImpact: move.expectedImpact || 'medium',
    estimatedEffort: move.estimatedEffort || 'medium',
    riskLevel: move.riskLevel || 'medium',
    confidence: typeof move.confidence === 'number' ? move.confidence : 3,
    firstStep: move.firstStep || '',
    tradeoff: normalizeMoveTradeoff(move.tradeoff),
    rejectedAlternative: normalizeRejectedAlternative(move.rejectedAlternative),
    whyFirst: typeof move.whyFirst === 'string' ? move.whyFirst : undefined,
    ownerRole: typeof move.ownerRole === 'string' ? move.ownerRole : undefined,
  };
}

function normalizeSummaryConclusionFields(summaryObj: any, parsed: Record<string, any>) {
  const source = summaryObj && typeof summaryObj === 'object' ? summaryObj : parsed;
  const verdict = typeof source.verdict === 'string' ? source.verdict : undefined;
  const rationaleRaw = source.verdictRationale;
  const verdictRationale =
    rationaleRaw && typeof rationaleRaw === 'object' && typeof rationaleRaw.text === 'string'
      ? {
          text: rationaleRaw.text,
          factRefs: Array.isArray(rationaleRaw.factRefs)
            ? rationaleRaw.factRefs.filter(Boolean).map(String)
            : [],
        }
      : undefined;
  const tradeoffs = Array.isArray(source.tradeoffs)
    ? source.tradeoffs
        .filter(
          (t: any) =>
            t &&
            typeof t.chosen === 'string' &&
            (typeof t.rejected === 'string' || typeof t.why === 'string')
        )
        .map((t: any) => ({
          chosen: t.chosen,
          rejected: typeof t.rejected === 'string' ? t.rejected : '',
          why: typeof t.why === 'string' ? t.why : '',
        }))
    : undefined;
  const effectRaw = source.expectedEffect;
  const expectedEffect =
    effectRaw && typeof effectRaw === 'object' && typeof effectRaw.text === 'string'
      ? {
          text: effectRaw.text,
          horizon: typeof effectRaw.horizon === 'string' ? effectRaw.horizon : '',
        }
      : undefined;
  return { verdict, verdictRationale, tradeoffs, expectedEffect };
}

function normalizeMissionSuggestion(
  parsed: Record<string, any>
): Partial<ConsultingMissionContext> | null {
  if (!parsed.mission) return null;
  return {
    goal: typeof parsed.mission.goal === 'string' ? parsed.mission.goal : undefined,
    scope: typeof parsed.mission.scope === 'string' ? parsed.mission.scope : undefined,
    successSignal:
      typeof parsed.mission.successSignal === 'string' ? parsed.mission.successSignal : undefined,
    timeframe:
      parsed.mission.timeframe === 'short' ||
      parsed.mission.timeframe === 'medium' ||
      parsed.mission.timeframe === 'long'
        ? parsed.mission.timeframe
        : undefined,
    constraints:
      typeof parsed.mission.constraints === 'string' ? parsed.mission.constraints : undefined,
    assumptions:
      typeof parsed.mission.assumptions === 'string' ? parsed.mission.assumptions : undefined,
    kpiTarget: typeof parsed.mission.kpiTarget === 'string' ? parsed.mission.kpiTarget : undefined,
  };
}

// ---------------------------------------------------------------------------
// Pending-action reducer
// ---------------------------------------------------------------------------

export function applyDynamicSwotPendingAction({
  pendingAction,
  parsed,
  currentStepId,
  swotData,
  rethinkTarget,
  toolType,
  actions,
}: ApplyDynamicSwotPendingActionOptions): DynamicSwotApplyResult {
  if (pendingAction === 'suggestions') {
    if (currentStepId === 'mission') {
      return { missionSuggestion: normalizeMissionSuggestion(parsed) };
    }

    if (currentStepId === 'input') {
      const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
      const existingSignals = (swotData.signals || []).map(
        (signal) => `${signal.type}:${signal.content.toLowerCase().trim()}`
      );

      signals.forEach((signal) => {
        if (!signal?.content || !signal?.type) return;
        const key = `${signal.type}:${String(signal.content).toLowerCase().trim()}`;
        if (existingSignals.includes(key)) return;
        actions.addSWOTSignal({
          type: signal.type,
          content: String(signal.content),
          sourceLabel: String(signal.sourceLabel || 'AI mentor'),
          confidence: typeof signal.confidence === 'number' ? signal.confidence : 3,
          tags: Array.isArray(signal.tags) ? signal.tags.filter(Boolean) : [],
          evidenceType:
            signal.evidenceType === 'fact' ||
            signal.evidenceType === 'observation' ||
            signal.evidenceType === 'hypothesis'
              ? signal.evidenceType
              : 'observation',
          state:
            signal.state === 'accepted' ||
            signal.state === 'proposed' ||
            signal.state === 'needs-evidence'
              ? signal.state
              : 'proposed',
          provenance: String(signal.provenance || signal.sourceLabel || 'AI mentor'),
          proposalStatus: 'ai-proposed',
        });
      });
      return {};
    }

    if (currentStepId === 'swot') {
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      const existingItems = (swotData.items || []).map(
        (item) => `${item.quadrant}:${item.text.toLowerCase().trim()}`
      );

      items.forEach((item) => {
        if (!item?.text || !item?.quadrant) return;
        const key = `${item.quadrant}:${String(item.text).toLowerCase().trim()}`;
        if (existingItems.includes(key)) return;
        actions.addSWOTItem({
          text: String(item.text),
          quadrant: item.quadrant,
          impact: item.impact || 'medium',
          source: 'ai',
          confidence: typeof item.confidence === 'number' ? item.confidence : 3,
          status: 'proposed',
          proposalStatus: 'ai-proposed',
          ...normalizeItemConclusionFields(item),
        });
      });
    }

    return {};
  }

  if (pendingAction === 'correlations') {
    const correlations = Array.isArray(parsed.correlations) ? parsed.correlations : [];
    const currentCorrelations = (swotData.correlations || []) as SWOTCorrelation[];
    // Traceability gate: correlation item ids must exist in the session.
    const knownItemIds = new Set((swotData.items || []).map((item) => item.id));
    const normalizedCorrelations = correlations
      .filter(
        (corr) =>
          Array.isArray(corr?.items) &&
          corr.items.length >= 2 &&
          typeof corr?.type === 'string' &&
          typeof corr?.insight === 'string'
      )
      .map((corr) => ({
        ...corr,
        items: corr.items.filter((id: string) => knownItemIds.has(id)),
      }))
      .filter((corr) => corr.items.length >= 2);

    normalizedCorrelations.forEach((corr) => {
      const duplicate = currentCorrelations.some(
        (existing) =>
          existing.type === corr.type &&
          existing.insight === corr.insight &&
          existing.items.join('|') === corr.items.join('|')
      );
      if (!duplicate) {
        actions.addCorrelation({
          items: corr.items,
          type: corr.type,
          insight: corr.insight,
          initiativeProposal: corr.initiativeProposal,
          proposalStatus: 'ai-proposed',
        });
      }
    });

    const existingTensions = swotData.tensions || [];
    const mergedTensions = [...existingTensions];
    normalizedCorrelations.forEach((corr) => {
      const posture = TENSION_TYPE_TO_POSTURE[corr.type as SwotTensionType];
      if (!posture) return;
      const derivedTension: SWOTTension = {
        id: `derived-${corr.type}-${corr.items.join('-')}-${corr.insight}`,
        title: posture.titleEn,
        type: posture.type,
        linkedCorrelationIds: [],
        linkedItemIds: corr.items,
        insight: corr.insight,
        whyNow: typeof corr.whyNow === 'string' ? corr.whyNow : corr.initiativeProposal,
        confidence: 4,
        proposalStatus: 'ai-proposed',
      };
      const duplicateTension = mergedTensions.some(
        (existing) =>
          existing.type === derivedTension.type &&
          existing.insight === derivedTension.insight &&
          (existing.linkedItemIds || []).join('|') === derivedTension.linkedItemIds.join('|')
      );
      if (!duplicateTension) {
        mergedTensions.push(derivedTension);
      }
    });
    actions.updateInputData({ tensions: mergedTensions });
    return {};
  }

  if (pendingAction === 'summary') {
    const initiatives = Array.isArray(parsed.initiatives) ? parsed.initiatives : [];
    const moves = Array.isArray(parsed.moves) ? parsed.moves : [];
    const outputCandidates = Array.isArray(parsed.outputCandidates) ? parsed.outputCandidates : [];
    const summaryObj = parsed.summary && typeof parsed.summary === 'object' ? parsed.summary : null;
    const conclusionFields = normalizeSummaryConclusionFields(summaryObj, parsed);

    actions.setSWOTSummary({
      proposalId: 'swot-summary',
      executiveSummary:
        typeof summaryObj?.executiveSummary === 'string'
          ? summaryObj.executiveSummary
          : typeof parsed.summary === 'string'
            ? parsed.summary
            : '',
      keyInsights: Array.isArray(summaryObj?.keyInsights)
        ? summaryObj.keyInsights.filter(Boolean)
        : Array.isArray(parsed.insights)
          ? parsed.insights.filter(Boolean)
          : [],
      appliedConclusions: Array.isArray(summaryObj?.appliedConclusions)
        ? summaryObj.appliedConclusions.filter(Boolean)
        : Array.isArray(parsed.appliedConclusions)
          ? parsed.appliedConclusions.filter(Boolean)
          : [],
      ...conclusionFields,
      proposalStatus: 'ai-proposed',
      recommendedInitiatives: initiatives.map((initiative) => ({
        id: '',
        title: initiative.title,
        description: initiative.description || '',
        type: initiative.type || 'strategic',
        source: toolType,
        linkedItems: initiative.linkedItems || [],
        estimatedImpact: initiative.estimatedImpact || 'medium',
        estimatedEffort: initiative.estimatedEffort || 'medium',
        rationale: initiative.rationale || '',
      })),
    });

    actions.setSWOTMoves(moves.filter((move) => move?.title).map(normalizeMove));

    actions.setSWOTOutputCandidates(
      outputCandidates.map((candidate) => ({
        outputType: candidate.outputType || 'initiative',
        title: candidate.title,
        description: candidate.description || '',
        linkedMoveIds: candidate.linkedMoveIds || [],
        linkedItemIds: candidate.linkedItemIds || [],
        rationale: candidate.rationale || '',
        readiness:
          candidate.readiness === 'ready-for-initiative' ||
          candidate.readiness === 'ready-for-presentation' ||
          candidate.readiness === 'ready-for-report' ||
          candidate.readiness === 'keep-as-idea' ||
          candidate.readiness === 'blocked'
            ? candidate.readiness
            : 'keep-as-idea',
      }))
    );

    actions.setInitiatives(
      initiatives.map((initiative) => ({
        title: initiative.title,
        description: initiative.description || '',
        type: initiative.type || 'strategic',
        source: toolType,
        linkedItems: initiative.linkedItems || [],
        estimatedImpact: initiative.estimatedImpact || 'medium',
        estimatedEffort: initiative.estimatedEffort || 'medium',
        rationale: initiative.rationale || '',
      }))
    );
    return {};
  }

  if (pendingAction === 'full-session') {
    const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
    const signalKeys = new Set(
      (swotData.signals || []).map(
        (signal) => `${signal.type}:${signal.content.toLowerCase().trim()}`
      )
    );
    signals.forEach((signal) => {
      if (!signal?.content || !signal?.type) return;
      const key = `${signal.type}:${String(signal.content).toLowerCase().trim()}`;
      if (signalKeys.has(key)) return;
      signalKeys.add(key);
      actions.addSWOTSignal({
        type: signal.type,
        content: String(signal.content),
        sourceLabel: String(signal.sourceLabel || 'AI consultant'),
        confidence: typeof signal.confidence === 'number' ? signal.confidence : 3,
        tags: Array.isArray(signal.tags) ? signal.tags.filter(Boolean) : [],
        evidenceType:
          signal.evidenceType === 'fact' ||
          signal.evidenceType === 'observation' ||
          signal.evidenceType === 'hypothesis'
            ? signal.evidenceType
            : 'observation',
        state: 'proposed',
        provenance: String(signal.provenance || signal.sourceLabel || 'AI consultant'),
        proposalStatus: 'ai-proposed',
      });
    });

    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const itemKeys = new Set(
      (swotData.items || []).map((item) => `${item.quadrant}:${item.text.toLowerCase().trim()}`)
    );
    items.forEach((item) => {
      if (!item?.text || !item?.quadrant) return;
      const key = `${item.quadrant}:${String(item.text).toLowerCase().trim()}`;
      if (itemKeys.has(key)) return;
      itemKeys.add(key);
      actions.addSWOTItem({
        text: String(item.text),
        quadrant: item.quadrant,
        impact: item.impact || 'medium',
        source: 'ai',
        confidence: typeof item.confidence === 'number' ? item.confidence : 3,
        status: 'proposed',
        proposalStatus: 'ai-proposed',
        ...normalizeItemConclusionFields(item),
      });
    });

    const correlations = Array.isArray(parsed.correlations) ? parsed.correlations : [];
    const correlationKey = (correlation: { type?: string; items?: string[]; insight?: string }) =>
      `${correlation.type || ''}:${[...(correlation.items || [])].sort().join(',')}:${String(
        correlation.insight || ''
      )
        .toLowerCase()
        .trim()}`;
    const correlationKeys = new Set((swotData.correlations || []).map(correlationKey));
    correlations.forEach((corr) => {
      if (!corr?.type || !corr?.insight) return;
      const key = correlationKey(corr);
      if (correlationKeys.has(key)) return;
      correlationKeys.add(key);
      actions.addCorrelation({
        items: corr.items || [],
        type: corr.type,
        insight: corr.insight,
        initiativeProposal: corr.initiativeProposal,
        proposalStatus: 'ai-proposed',
      });
    });

    const tensions = Array.isArray(parsed.tensions) ? parsed.tensions : [];
    actions.setSWOTTensions(
      tensions
        .filter((t) => t?.title && t?.type)
        .map((t) => ({
          title: t.title,
          type: t.type,
          linkedCorrelationIds: [],
          linkedItemIds: [],
          insight: t.insight || '',
          whyNow: t.whyNow || '',
          confidence: typeof t.confidence === 'number' ? t.confidence : 3,
          proposalStatus: 'ai-proposed' as const,
        }))
    );

    const moves = Array.isArray(parsed.moves) ? parsed.moves : [];
    actions.setSWOTMoves(
      moves
        .filter((move) => move?.title)
        .map((move) => ({
          ...normalizeMove(move),
          proposalStatus: 'ai-proposed' as const,
        }))
    );

    const outputCandidates = Array.isArray(parsed.outputCandidates) ? parsed.outputCandidates : [];
    actions.setSWOTOutputCandidates(
      outputCandidates
        .filter((output) => output?.title)
        .map((output) => ({
          outputType: output.outputType || 'initiative',
          title: output.title,
          description: output.description || '',
          linkedMoveIds: [],
          linkedItemIds: [],
          rationale: output.rationale || '',
          readiness: output.readiness || 'keep-as-idea',
          proposalStatus: 'ai-proposed' as const,
        }))
    );

    const summaryObj = parsed.summary && typeof parsed.summary === 'object' ? parsed.summary : null;
    const initiatives = Array.isArray(parsed.initiatives) ? parsed.initiatives : [];
    const conclusionFields = normalizeSummaryConclusionFields(summaryObj, parsed);
    actions.setSWOTSummary({
      proposalId: 'swot-summary',
      executiveSummary:
        typeof summaryObj?.executiveSummary === 'string'
          ? summaryObj.executiveSummary
          : typeof parsed.summary === 'string'
            ? parsed.summary
            : '',
      keyInsights: Array.isArray(summaryObj?.keyInsights)
        ? summaryObj.keyInsights.filter(Boolean)
        : Array.isArray(parsed.insights)
          ? parsed.insights.filter(Boolean)
          : [],
      appliedConclusions: Array.isArray(summaryObj?.appliedConclusions)
        ? summaryObj.appliedConclusions.filter(Boolean)
        : Array.isArray(parsed.appliedConclusions)
          ? parsed.appliedConclusions.filter(Boolean)
          : [],
      ...conclusionFields,
      proposalStatus: 'ai-proposed',
      recommendedInitiatives: initiatives.map((initiative) => ({
        id: '',
        title: initiative.title || '',
        description: initiative.description || '',
        type: initiative.type || 'strategic',
        source: toolType,
        linkedItems: initiative.linkedItems || [],
        estimatedImpact: initiative.estimatedImpact || 'medium',
        estimatedEffort: initiative.estimatedEffort || 'medium',
        rationale: initiative.rationale || '',
      })),
    });

    actions.setInitiatives(
      initiatives.map((initiative) => ({
        title: initiative.title || '',
        description: initiative.description || '',
        type: initiative.type || 'strategic',
        source: toolType,
        linkedItems: initiative.linkedItems || [],
        estimatedImpact: initiative.estimatedImpact || 'medium',
        estimatedEffort: initiative.estimatedEffort || 'medium',
        rationale: initiative.rationale || '',
      }))
    );

    actions.setSessionGenerationStatus('ready');
    return {};
  }

  if (pendingAction === 'rethink' && rethinkTarget) {
    const { cardType, cardId } = rethinkTarget;
    if (cardType === 'conclusion') {
      const conclusionFields = normalizeSummaryConclusionFields(parsed, parsed);
      actions.updateCardAfterRethink(cardType as any, cardId, {
        executiveSummary:
          typeof parsed.executiveSummary === 'string'
            ? parsed.executiveSummary
            : typeof parsed.summary === 'string'
              ? parsed.summary
              : undefined,
        keyInsights: Array.isArray(parsed.keyInsights)
          ? parsed.keyInsights.filter(Boolean)
          : Array.isArray(parsed.insights)
            ? parsed.insights.filter(Boolean)
            : undefined,
        appliedConclusions: Array.isArray(parsed.appliedConclusions)
          ? parsed.appliedConclusions.filter(Boolean)
          : undefined,
        ...(conclusionFields.verdict !== undefined ? { verdict: conclusionFields.verdict } : {}),
        ...(conclusionFields.verdictRationale
          ? { verdictRationale: conclusionFields.verdictRationale }
          : {}),
        ...(conclusionFields.tradeoffs ? { tradeoffs: conclusionFields.tradeoffs } : {}),
        ...(conclusionFields.expectedEffect
          ? { expectedEffect: conclusionFields.expectedEffect }
          : {}),
      });
    } else if (cardType === 'item') {
      actions.updateCardAfterRethink(cardType as any, cardId, {
        ...parsed,
        ...normalizeItemConclusionFields(parsed),
      });
    } else if (cardType === 'move') {
      const tradeoff = normalizeMoveTradeoff(parsed.tradeoff);
      const rejectedAlternative = normalizeRejectedAlternative(parsed.rejectedAlternative);
      actions.updateCardAfterRethink(cardType as any, cardId, {
        ...parsed,
        ...(tradeoff ? { tradeoff } : {}),
        ...(rejectedAlternative ? { rejectedAlternative } : {}),
      });
    } else {
      actions.updateCardAfterRethink(cardType as any, cardId, parsed);
    }
    return { clearRethinkTarget: true };
  }

  return {};
}

export function createEmptyMissionContext(): ConsultingMissionContext {
  return createConsultingMissionContext();
}
