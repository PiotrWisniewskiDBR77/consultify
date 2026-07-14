import { buildPorterStaircasePromptRules } from '@/config/porter/porterInsightStaircase';
import {
  buildForceLadderPromptBlock,
  PORTER_FORCE_IDS,
  PORTER_FORCE_LABELS,
} from '@/config/porter/porterQuestionBank';
import {
  buildPorterMoveConclusionPromptRules,
  intensityFromScore,
  mapIndustryProfitability,
  type PorterForceVerdict,
  synthesizeForceIntensity,
} from '@/config/porter/porterSynthesisEngine';
import type {
  InitiativeDraft,
  PorterData,
  PorterForceId,
  ProposalStatus,
  ToolType,
} from '@/store/useToolStore';

import type { ToolAiPendingAction } from './dynamicSwot';
import { GROUNDING_RULES_BOTH } from './groundingRules';
import { pickW2SummaryFields } from './w2SummaryFields';
const FORCE_IDS: PorterForceId[] = PORTER_FORCE_IDS;

/**
 * Closed facts block for Market Forces (ConclusionInput.facts §4.1): the ONLY
 * admissible source of numbers/facts downstream. Mirrors buildSwotFactsBlock.
 */
export function buildPorterFactsBlock(porterData: PorterData | undefined): string {
  const lines: string[] = [];
  const ctx = porterData?.context;
  lines.push('MARKET BRIEF (framing — not evidence):');
  lines.push(`- industry: ${ctx?.industry || 'not defined'}`);
  lines.push(`- geographicScope: ${ctx?.geographicScope || 'not defined'}`);
  lines.push(`- position: ${ctx?.position || 'challenger'}`);
  lines.push(`- goal: ${ctx?.goal || 'not defined'}`);
  if (ctx?.constraints) lines.push(`- constraints: ${ctx.constraints}`);

  const signals = (porterData?.signals || []).filter(
    (s) => s.proposalStatus !== 'rejected' && s.proposalStatus !== 'rethinking'
  );
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
  return lines.join('\n');
}

const PORTER_HARD_RULES_BLOCK = `HARD RULES (CONCLUSION_LAYER_STANDARD §4):
- You are a partner at a consulting firm (HBS, MBA, 10 years of practice). You sign this output in front of the client's board.
- Numbers and facts EXCLUSIVELY from the facts block above. Never compute, never estimate, never quote statistics from outside the input.
- Every interpretive claim carries "factRefs" — ids from the facts block. A claim without evidence must be named a hypothesis.
- Evidence marked "declared" -> write "as declared, to be confirmed". No data -> "to be established (where/when)" — never an invented number.
- Rate each force intensity low/medium/high WITH A REASON grounded in a structural driver (concentration / switching costs / barriers / scale economics) — never a bare 1-5 slider.
- Answer-first (Minto): lead with the conclusion (which force dominates margin), then the evidence.
- No filler that fits any company on earth ("dynamic market", "intense competition"). Every conclusion must be falsifiable.
- Respond in the user's language (Polish or English) — professional partner tone, active voice.`;

/**
 * Laddered interview prompt for ONE force: the AI mentor walks the q-bank
 * (single source of truth with the wizard), one question at a time, branching on
 * answers, then proposes the force verdict WITH its insight staircase + driver.
 */
export function buildMarketForcesForceLadderPrompt(
  porterData: PorterData | undefined,
  force: PorterForceId,
  language: 'pl' | 'en' = 'en'
): string {
  const ladder = buildForceLadderPromptBlock(force, language);
  const label = PORTER_FORCE_LABELS[force][language];
  return `${buildPorterFactsBlock(porterData)}

You are interviewing the client about the "${label}" force. Use the laddered question bank below as your interview protocol — it is the single source of truth. Ask ONE question at a time, then branch on the answer using the branch keys.

QUESTION LADDER (${force}):
${ladder}

INTERVIEW RULES:
- Start at the level-1 question unless the ladder position is already known from the conversation.
- Classify the user's answer into one of the branch keys and follow that branch. If the answer is vague, use the probe before moving on.
- Dig from surface -> structural evidence (concentration / switching costs / barriers) -> a quantified anchor -> the 24-month trend. Do not accept a rating without a structural driver.
- When the ladder completes, propose the force verdict WITH its insight staircase, intensity, dominant driver and evidence status.

${buildPorterStaircasePromptRules(language)}

${PORTER_HARD_RULES_BLOCK}

When proposing the force verdict, return JSON:
{"force":"${force}","intensity":"low|medium|high","score":1-5,"trend":"increasing|stable|decreasing","drivers":[{"dimension":"concentration|switching-costs|barriers|scale-economics","finding":"..."}],"staircase":{"fact":"...","factRefs":["signal-id"],"interpretation":"...","implication":"..."},"evidenceStatus":"confirmed|declared","ladderAnswers":[{"questionId":"...","answerKey":"...","note":"..."}]}`;
}

interface MarketForcesActionHandlers {
  updateInputData: (data: Partial<PorterData>) => void;
  setInitiatives: (initiatives: Omit<InitiativeDraft, 'id'>[]) => void;
  setSessionGenerationStatus: (status: 'idle' | 'generating' | 'ready' | 'error') => void;
  updateCardAfterRethink: (cardType: any, cardId: string, updates: Record<string, unknown>) => void;
}

interface ApplyMarketForcesPendingActionOptions {
  pendingAction: ToolAiPendingAction;
  parsed: Record<string, any>;
  currentStepId?: string;
  porterData: PorterData;
  rethinkTarget?: { cardType: string; cardId: string } | null;
  toolType: ToolType;
  actions: MarketForcesActionHandlers;
}

export function buildMarketForcesFullSessionPrompt(
  porterData: PorterData | undefined,
  orgContext: string
): string {
  return `You are a senior strategy consultant running a Porter Five Forces session.
The client has framed a market question. Produce a COMPLETE first-draft Market Forces session.

=== MARKET BRIEF ===
- Industry / market: ${porterData?.context?.industry || 'not yet defined'}
- Geographic scope: ${porterData?.context?.geographicScope || 'not yet defined'}
- Market position: ${porterData?.context?.position || 'challenger'}
- Decision question: ${porterData?.context?.goal || 'not yet defined'}
- Success signal: ${porterData?.context?.successSignal || 'not yet defined'}
- Constraints: ${porterData?.context?.constraints || 'none specified'}

=== ORGANIZATION CONTEXT ===
${orgContext}
=== END CONTEXT ===

=== SESSION FACTS ===
${buildPorterFactsBlock(porterData)}
=== END FACTS ===

${PORTER_HARD_RULES_BLOCK}

${buildPorterStaircasePromptRules('en')}

${buildPorterMoveConclusionPromptRules('en')}

Generate a consulting-grade first draft. Everything is a proposal for user review.
For EACH force: rate intensity low/medium/high with an insight staircase (fact/factRefs/interpretation/implication) and a dominant structural "driver"; a high/medium force without a named driver will be rejected.
Then synthesize an industry-attractiveness verdict naming WHICH force(s) dominate margin, and 3-5 strategic responses EACH carrying tradeoff + rejectedAlternative.


${GROUNDING_RULES_BOTH}
Return one JSON object with this exact structure:
{
  "signals": [
    {"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["rivalry"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}
  ],
  "forces": {
    "rivalry": {"score": 1-5, "intensity": "low|medium|high", "trend": "increasing|stable|decreasing", "drivers": [{"dimension": "concentration|switching-costs|barriers|scale-economics", "finding": "..."}], "staircase": {"fact": "...", "factRefs": ["..."], "interpretation": "...", "implication": "..."}, "evidence": ["..."], "implication": "...", "evidenceStatus": "confirmed|declared", "confidence": 1-5},
    "newEntrants": {"score": 1-5, "intensity": "low|medium|high", "trend": "increasing|stable|decreasing", "drivers": [{"dimension": "concentration|switching-costs|barriers|scale-economics", "finding": "..."}], "staircase": {"fact": "...", "factRefs": ["..."], "interpretation": "...", "implication": "..."}, "evidence": ["..."], "implication": "...", "evidenceStatus": "confirmed|declared", "confidence": 1-5},
    "substitutes": {"score": 1-5, "intensity": "low|medium|high", "trend": "increasing|stable|decreasing", "drivers": [{"dimension": "concentration|switching-costs|barriers|scale-economics", "finding": "..."}], "staircase": {"fact": "...", "factRefs": ["..."], "interpretation": "...", "implication": "..."}, "evidence": ["..."], "implication": "...", "evidenceStatus": "confirmed|declared", "confidence": 1-5},
    "buyerPower": {"score": 1-5, "intensity": "low|medium|high", "trend": "increasing|stable|decreasing", "drivers": [{"dimension": "concentration|switching-costs|barriers|scale-economics", "finding": "..."}], "staircase": {"fact": "...", "factRefs": ["..."], "interpretation": "...", "implication": "..."}, "evidence": ["..."], "implication": "...", "evidenceStatus": "confirmed|declared", "confidence": 1-5},
    "supplierPower": {"score": 1-5, "intensity": "low|medium|high", "trend": "increasing|stable|decreasing", "drivers": [{"dimension": "concentration|switching-costs|barriers|scale-economics", "finding": "..."}], "staircase": {"fact": "...", "factRefs": ["..."], "interpretation": "...", "implication": "..."}, "evidence": ["..."], "implication": "...", "evidenceStatus": "confirmed|declared", "confidence": 1-5}
  },
  "profitabilityMap": {"attractiveness": "structurally-unattractive|mixed|structurally-attractive", "dominantForces": ["rivalry"], "verdict": "answer-first: which force(s) dominate margin and why"},
  "implications": [
    {"title": "...", "forceIds": ["rivalry"], "insight": "...", "marginImpact": "high|medium|low", "urgency": "high|medium|low", "recommendation": "...", "confidence": 1-5}
  ],
  "moves": [
    {"title": "...", "category": "positioning|pricing|partnership|capability-build|defensive-move", "rationale": "why — anchored in listed forceIds/implicationIds", "linkedForceIds": ["buyerPower"], "linkedImplicationIds": ["..."], "tradeoff": {"chosen": "...", "deferred": "...", "cost": "..."}, "rejectedAlternative": {"option": "...", "reason": "..."}, "expectedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "riskLevel": "high|medium|low", "confidence": 1-5, "firstStep": "verb + artifact + role"}
  ],
  "outputCandidates": [
    {"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "rationale": "...", "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}
  ],
  "summary": {
    "executiveSummary": "...",
    "keyInsights": ["..."],
    "appliedConclusions": ["..."]
  },
  "initiatives": [
    {"title": "...", "description": "...", "type": "strategic|operational|defensive|growth", "rationale": "...", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "linkedItems": ["rivalry"]}
  ]
}`;
}

export function buildMarketForcesImplicationsPrompt(porterData: PorterData): string | null {
  // Deterministic pre-computation: intensity band + industry-profitability map from
  // the scored forces, so the model NARRATES a synthesis that verifiably follows from
  // the session rather than inventing a verdict (mirrors SWOT tension pre-computation).
  const verdicts = {} as Record<PorterForceId, PorterForceVerdict>;
  FORCE_IDS.forEach((forceId) => {
    const force = porterData.forces[forceId];
    const answers = Array.isArray((force as any)?.ladderAnswers)
      ? (force as any).ladderAnswers
      : [];
    verdicts[forceId] =
      answers.length > 0
        ? synthesizeForceIntensity(forceId, answers)
        : {
            force: forceId,
            intensity: intensityFromScore(force?.score ?? 3),
            score: force?.score ?? 3,
            reasonKeys: [],
            provisional: false,
          };
  });
  const map = mapIndustryProfitability(verdicts);

  const forces = FORCE_IDS.map((forceId) => {
    const force = porterData.forces[forceId];
    return `- ${forceId}: intensity ${verdicts[forceId].intensity} (score ${force.score}/5, ${force.trend}); drivers: ${(force.drivers || []).join('; ')}`;
  }).join('\n');

  if (!forces.trim()) return null;

  return `Act as a strategy consultant. Turn this Porter Five Forces synthesis into strategic implications and W2 responses. You NARRATE a verdict that follows from the pre-computed synthesis — you do not invent the attractiveness band.

FORCE SCORECARD (with deterministic intensity):
${forces}

PRE-COMPUTED INDUSTRY-PROFITABILITY MAP (your working conclusion):
- attractiveness: ${map.attractiveness} (pressure ${map.pressureScore}/10)
- dominant force(s): ${map.dominantForces.join(', ') || 'none'}
- ${map.verdictEn}

${buildPorterMoveConclusionPromptRules('en')}

Rules:
- Lead each implication with the answer (which force squeezes margin), then the evidence.
- Prioritize responses where a HIGH force dominates; sequence with prerequisites named.

Return JSON:
{
  "profitabilityMap": {"attractiveness": "${map.attractiveness}", "dominantForces": ${JSON.stringify(map.dominantForces)}, "verdict": "..."},
  "implications": [{"title":"...","forceIds":["rivalry"],"insight":"...","marginImpact":"high|medium|low","urgency":"high|medium|low","recommendation":"...","confidence":4}],
  "moves": [{"title":"...","category":"positioning|pricing|partnership|capability-build|defensive-move","rationale":"...","linkedForceIds":["buyerPower"],"linkedImplicationIds":["..."],"tradeoff":{"chosen":"...","deferred":"...","cost":"..."},"rejectedAlternative":{"option":"...","reason":"..."},"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}]
}`;
}

export function buildMarketForcesRethinkPrompt(
  porterData: PorterData,
  cardType: string,
  cardId: string,
  userComment?: string
): string {
  let cardContent = '';
  if (cardType === 'signal') {
    const signal = porterData.signals.find((item) => item.id === cardId);
    cardContent = signal ? `[${signal.type}] ${signal.content}` : '';
  } else if (cardType === 'item') {
    const force = porterData.forces[cardId as PorterForceId];
    cardContent = force
      ? `${force.name}: ${force.score}/5, ${force.trend}, drivers: ${force.drivers.join('; ')}`
      : '';
  } else if (cardType === 'tension') {
    const implication = porterData.implications.find((item) => item.id === cardId);
    cardContent = implication ? `${implication.title}: ${implication.insight}` : '';
  } else if (cardType === 'move') {
    const move = porterData.recommendedMoves.find((item) => item.id === cardId);
    cardContent = move ? `${move.title}: ${move.rationale}` : '';
  } else if (cardType === 'output-candidate') {
    const output = porterData.outputCandidates.find((item) => item.id === cardId);
    cardContent = output ? `${output.title}: ${output.description}` : '';
  } else if (cardType === 'conclusion') {
    cardContent = JSON.stringify(porterData.summary || {}, null, 2);
  }

  return `The user wants you to rethink this Market Forces ${cardType} card.

Current card:
${cardContent}

User feedback: ${userComment || 'Please improve it.'}

Market context:
- Industry: ${porterData.context.industry || 'N/A'}
- Scope: ${porterData.context.geographicScope || 'N/A'}

Return JSON with improved fields for the same card type.`;
}

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cleanForceIds = (value: unknown): PorterForceId[] =>
  Array.isArray(value) ? value.filter((id): id is PorterForceId => FORCE_IDS.includes(id)) : [];

function normalizePorterTradeoff(
  raw: any
): { chosen: string; deferred: string; cost: string } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const chosen = typeof raw.chosen === 'string' ? raw.chosen : '';
  const deferred = typeof raw.deferred === 'string' ? raw.deferred : '';
  const cost = typeof raw.cost === 'string' ? raw.cost : '';
  if (!chosen && !deferred && !cost) return undefined;
  return { chosen, deferred, cost };
}

function normalizePorterRejectedAlternative(
  raw: any
): { option: string; reason: string } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const option = typeof raw.option === 'string' ? raw.option : '';
  const reason = typeof raw.reason === 'string' ? raw.reason : '';
  if (!option && !reason) return undefined;
  return { option, reason };
}

const proposalStatus: ProposalStatus = 'ai-proposed';

export function applyMarketForcesPendingAction({
  pendingAction,
  parsed,
  currentStepId,
  porterData,
  rethinkTarget,
  toolType,
  actions,
}: ApplyMarketForcesPendingActionOptions): { clearRethinkTarget?: boolean } {
  if (pendingAction === 'rethink' && rethinkTarget) {
    actions.updateCardAfterRethink(rethinkTarget.cardType, rethinkTarget.cardId, parsed);
    return { clearRethinkTarget: true };
  }

  if (pendingAction === 'suggestions' && currentStepId === 'mission') {
    const mission = parsed.mission && typeof parsed.mission === 'object' ? parsed.mission : parsed;
    actions.updateInputData({
      context: {
        ...porterData.context,
        industry: mission.industry || porterData.context.industry,
        geographicScope: mission.geographicScope || porterData.context.geographicScope,
        position: mission.position || porterData.context.position,
        goal: mission.goal || porterData.context.goal,
        successSignal: mission.successSignal || porterData.context.successSignal,
        constraints: mission.constraints || porterData.context.constraints,
        assumptions: mission.assumptions || porterData.context.assumptions,
        kpiTarget: mission.kpiTarget || porterData.context.kpiTarget,
      },
    });
    return {};
  }

  if (pendingAction === 'suggestions' && currentStepId === 'input') {
    const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
    actions.updateInputData({
      signals: [
        ...(porterData.signals || []),
        ...signals
          .filter((signal) => signal?.content)
          .map((signal) => ({
            id: makeId('signal'),
            type: signal.type || 'ai',
            content: String(signal.content),
            sourceLabel: String(signal.sourceLabel || 'AI consultant'),
            confidence: typeof signal.confidence === 'number' ? signal.confidence : 3,
            tags: Array.isArray(signal.tags) ? signal.tags.filter(Boolean) : [],
            evidenceType: signal.evidenceType || 'observation',
            state: 'proposed' as const,
            provenance: String(signal.provenance || signal.sourceLabel || 'AI consultant'),
            proposalStatus,
          })),
      ],
    });
    return {};
  }

  if (
    (pendingAction === 'suggestions' && currentStepId === 'forces') ||
    pendingAction === 'full-session'
  ) {
    const nextForces = { ...porterData.forces };
    const forces = parsed.forces && typeof parsed.forces === 'object' ? parsed.forces : {};
    FORCE_IDS.forEach((forceId) => {
      const force = forces[forceId];
      if (!force) return;
      // "drivers" may arrive as plain strings (legacy) or as structural driver
      // objects {dimension, finding}. Keep the string list for the scorecard UI and
      // split the structured ones into structuralDrivers.
      const rawDrivers = Array.isArray(force.drivers) ? force.drivers : [];
      const stringDrivers = rawDrivers
        .map((d: any) =>
          typeof d === 'string' ? d : typeof d?.finding === 'string' ? d.finding : ''
        )
        .filter(Boolean);
      const structuralDrivers = rawDrivers
        .filter(
          (d: any) =>
            d &&
            typeof d === 'object' &&
            ['concentration', 'switching-costs', 'barriers', 'scale-economics'].includes(
              d.dimension
            ) &&
            typeof d.finding === 'string' &&
            d.finding.trim()
        )
        .map((d: any) => ({ dimension: d.dimension, finding: String(d.finding) }));

      const staircase =
        force.staircase &&
        typeof force.staircase === 'object' &&
        typeof force.staircase.fact === 'string'
          ? {
              fact: force.staircase.fact,
              factRefs: Array.isArray(force.staircase.factRefs)
                ? force.staircase.factRefs.filter(Boolean).map(String)
                : [],
              interpretation:
                typeof force.staircase.interpretation === 'string'
                  ? force.staircase.interpretation
                  : '',
              implication:
                typeof force.staircase.implication === 'string' ? force.staircase.implication : '',
            }
          : nextForces[forceId].staircase;

      nextForces[forceId] = {
        ...nextForces[forceId],
        score: typeof force.score === 'number' ? force.score : nextForces[forceId].score,
        trend: ['increasing', 'stable', 'decreasing'].includes(force.trend)
          ? force.trend
          : nextForces[forceId].trend,
        drivers: stringDrivers.length > 0 ? stringDrivers : nextForces[forceId].drivers,
        evidence: Array.isArray(force.evidence) ? force.evidence.filter(Boolean) : [],
        implication:
          typeof force.implication === 'string'
            ? force.implication
            : nextForces[forceId].implication,
        confidence: typeof force.confidence === 'number' ? force.confidence : 3,
        ...(['low', 'medium', 'high'].includes(force.intensity)
          ? { intensity: force.intensity }
          : {}),
        ...(staircase ? { staircase } : {}),
        ...(structuralDrivers.length > 0 ? { structuralDrivers } : {}),
        ...(force.evidenceStatus === 'confirmed' || force.evidenceStatus === 'declared'
          ? { evidenceStatus: force.evidenceStatus }
          : {}),
        proposalStatus,
      };
    });
    actions.updateInputData({ forces: nextForces });
  }

  if (
    pendingAction === 'correlations' ||
    pendingAction === 'summary' ||
    pendingAction === 'full-session'
  ) {
    const implications = Array.isArray(parsed.implications) ? parsed.implications : [];
    const moves = Array.isArray(parsed.moves) ? parsed.moves : [];
    const pm = parsed.profitabilityMap;
    const profitabilityMap =
      pm &&
      typeof pm === 'object' &&
      ['structurally-unattractive', 'mixed', 'structurally-attractive'].includes(pm.attractiveness)
        ? {
            attractiveness: pm.attractiveness,
            dominantForces: cleanForceIds(pm.dominantForces),
            verdict: typeof pm.verdict === 'string' ? pm.verdict : '',
          }
        : undefined;
    actions.updateInputData({
      ...(profitabilityMap ? { profitabilityMap } : {}),
      ...(implications.length > 0
        ? {
            implications: implications
              .filter((item) => item?.title && item?.insight)
              .map((item) => ({
                id: makeId('implication'),
                title: item.title,
                forceIds: cleanForceIds(item.forceIds),
                insight: item.insight,
                marginImpact: item.marginImpact || 'medium',
                urgency: item.urgency || 'medium',
                recommendation: item.recommendation || '',
                confidence: typeof item.confidence === 'number' ? item.confidence : 3,
                proposalStatus,
              })),
          }
        : {}),
      ...(moves.length > 0
        ? {
            recommendedMoves: moves
              .filter((move) => move?.title)
              .map((move) => ({
                id: makeId('move'),
                title: move.title,
                category: move.category || 'positioning',
                rationale: move.rationale || '',
                linkedImplicationIds: Array.isArray(move.linkedImplicationIds)
                  ? move.linkedImplicationIds.filter(Boolean).map(String)
                  : [],
                linkedForceIds: cleanForceIds(move.linkedForceIds),
                expectedImpact: move.expectedImpact || 'medium',
                estimatedEffort: move.estimatedEffort || 'medium',
                riskLevel: move.riskLevel || 'medium',
                confidence: typeof move.confidence === 'number' ? move.confidence : 3,
                firstStep: move.firstStep || '',
                tradeoff: normalizePorterTradeoff(move.tradeoff),
                rejectedAlternative: normalizePorterRejectedAlternative(move.rejectedAlternative),
                proposalStatus,
              })),
          }
        : {}),
    });
  }

  if (pendingAction === 'summary' || pendingAction === 'full-session') {
    const summaryObj = parsed.summary && typeof parsed.summary === 'object' ? parsed.summary : null;
    const initiatives = Array.isArray(parsed.initiatives) ? parsed.initiatives : [];
    const outputCandidates = Array.isArray(parsed.outputCandidates) ? parsed.outputCandidates : [];

    actions.updateInputData({
      summary: {
        proposalId: 'porter-summary',
        ...pickW2SummaryFields(summaryObj),
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
        proposalStatus,
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
      },
      outputCandidates: outputCandidates
        .filter((candidate) => candidate?.title)
        .map((candidate) => ({
          id: makeId('output'),
          outputType: candidate.outputType || 'initiative',
          title: candidate.title,
          description: candidate.description || '',
          linkedMoveIds: [],
          linkedForceIds: cleanForceIds(candidate.linkedForceIds),
          rationale: candidate.rationale || '',
          readiness: candidate.readiness || 'keep-as-idea',
          proposalStatus,
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
  }

  if (pendingAction === 'full-session') {
    const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
    actions.updateInputData({
      signals: signals
        .filter((signal) => signal?.content)
        .map((signal) => ({
          id: makeId('signal'),
          type: signal.type || 'ai',
          content: String(signal.content),
          sourceLabel: String(signal.sourceLabel || 'AI consultant'),
          confidence: typeof signal.confidence === 'number' ? signal.confidence : 3,
          tags: Array.isArray(signal.tags) ? signal.tags.filter(Boolean) : [],
          evidenceType: signal.evidenceType || 'observation',
          state: 'proposed' as const,
          provenance: String(signal.provenance || signal.sourceLabel || 'AI consultant'),
          proposalStatus,
        })),
    });
    actions.setSessionGenerationStatus('ready');
  }

  return {};
}
