import { buildValueChainStaircasePromptRules } from '@/config/valuechain/valueChainInsightStaircase';
import {
  buildValueChainMovePromptRules,
  computeMarginMap,
  deriveLeverCandidates,
} from '@/config/valuechain/valueChainMarginEngine';
import {
  buildActivityLadderPromptBlock,
  VALUE_CHAIN_ACTIVITIES,
} from '@/config/valuechain/valueChainQuestionBank';
import type {
  InitiativeDraft,
  ValueActivityId,
  ValueChainData,
  ProposalStatus,
  ToolType,
} from '@/store/useToolStore';

import type { ToolAiPendingAction } from './dynamicSwot';
import { pickW2SummaryFields } from './w2SummaryFields';

import { GROUNDING_RULES_BOTH } from './groundingRules';
const ACTIVITY_IDS: ValueActivityId[] = [
  'inboundLogistics',
  'operations',
  'outboundLogistics',
  'marketingSales',
  'service',
  'infrastructure',
  'hrManagement',
  'technology',
  'procurement',
];

interface ValueChainActionHandlers {
  updateInputData: (data: Partial<ValueChainData>) => void;
  setInitiatives: (initiatives: Omit<InitiativeDraft, 'id'>[]) => void;
  setSessionGenerationStatus: (status: 'idle' | 'generating' | 'ready' | 'error') => void;
  updateCardAfterRethink: (cardType: any, cardId: string, updates: Record<string, unknown>) => void;
}

interface ApplyValueChainPendingActionOptions {
  pendingAction: ToolAiPendingAction;
  parsed: Record<string, any>;
  currentStepId?: string;
  valueChainData: ValueChainData;
  rethinkTarget?: { cardType: string; cardId: string } | null;
  toolType: ToolType;
  actions: ValueChainActionHandlers;
}

/**
 * Conversation-layer protocol appended to the system prompt for the value-chain
 * "activities" step: the mentor in chat interviews with the SAME laddered question
 * bank as the wizard (single source of truth), one activity at a time, walking the
 * 4-rung ladder (surface -> cost/value -> benchmark -> potential) and branching on
 * answers. Returns '' for other steps so it is a no-op there.
 */
export function buildValueChainConversationProtocol(
  stepId: string | undefined,
  language: 'pl' | 'en' = 'en'
): string {
  if (stepId !== 'activities') return '';
  const ladders = VALUE_CHAIN_ACTIVITIES.map(
    (meta) =>
      `--- ${(language === 'pl' ? meta.namePl : meta.nameEn).toUpperCase()} (${meta.id}, ${meta.kind}) ---\n${buildActivityLadderPromptBlock(meta.id, language)}`
  ).join('\n');
  return `

INTERVIEW PROTOCOL (laddered value-chain question bank — the single source of truth for this step):
When the user explores an activity, walk its ladder. Ask ONE question at a time; classify the answer into a branch key and follow the branch. Vague answer -> use the probe. Do not accept a score without the cost-value proof; an activity with no session evidence is "declared, unconfirmed". When a ladder path completes, propose the scored activity with its full insight staircase.

${ladders}`;
}

export function buildValueChainFullSessionPrompt(
  valueChainData: ValueChainData | undefined,
  orgContext: string
): string {
  return `You are a senior strategy consultant running a Porter Value Chain Analysis session.
The client has framed a value-chain question. Produce a COMPLETE first-draft Value Chain session.

=== VALUE CHAIN BRIEF ===
- Industry / market: ${valueChainData?.context?.industry || 'not yet defined'}
- Value chain scope: ${valueChainData?.context?.valueChainScope || 'not yet defined'}
- Strategic position: ${valueChainData?.context?.position || 'undefined'}
- Decision question: ${valueChainData?.context?.goal || 'not yet defined'}
- Success signal: ${valueChainData?.context?.successSignal || 'not yet defined'}
- Constraints: ${valueChainData?.context?.constraints || 'none specified'}

=== ORGANIZATION CONTEXT ===
${orgContext}
=== END CONTEXT ===

Generate a consulting-grade first draft. Everything is a proposal for user review.
Score all 9 canonical Porter value-chain activities (5 primary: inboundLogistics, operations,
outboundLogistics, marketingSales, service; 4 support: infrastructure, hrManagement, technology,
procurement). Then synthesize margin levers, recommended strategic moves, a positioning verdict
(cost-advantage vs differentiation vs stuck-in-the-middle), outputs, an executive summary, and
initiatives. Ground every claim in the organization context above. Explicitly flag any benchmark or
assumption you cannot ground in the context (label it as a hypothesis) — do NOT invent specific
numbers or external benchmarks you cannot support.

${buildValueChainStaircasePromptRules('en')}

${buildValueChainMovePromptRules('en')}

Attach a "staircase" {surface, costValueProof, proofRefs, benchmark, potential} to every scored
activity, and set "evidenceStatus" to "confirmed" only when proofRefs point at a real signal,
otherwise "declared". Focus the levers and moves on the 2-3 activities where high cost meets low
maturity meets impact on customer value (the margin map's leak/creator gradient).


${GROUNDING_RULES_BOTH}
Return one JSON object with this exact structure:
{
  "signals": [
    {"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["operations"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}
  ],
  "activities": {
    "inboundLogistics": {"costContribution": "high|medium|low", "valueContribution": "high|medium|low", "marginRole": "creator|neutral|drain", "maturity": "strong|adequate|weak", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5, "staircase": {"surface": "...", "costValueProof": "...", "proofRefs": ["signal-id"], "benchmark": "...", "potential": "..."}, "evidenceStatus": "confirmed|declared"},
    "operations": {"costContribution": "high|medium|low", "valueContribution": "high|medium|low", "marginRole": "creator|neutral|drain", "maturity": "strong|adequate|weak", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5, "staircase": {"surface": "...", "costValueProof": "...", "proofRefs": ["signal-id"], "benchmark": "...", "potential": "..."}, "evidenceStatus": "confirmed|declared"},
    "outboundLogistics": {"costContribution": "high|medium|low", "valueContribution": "high|medium|low", "marginRole": "creator|neutral|drain", "maturity": "strong|adequate|weak", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5},
    "marketingSales": {"costContribution": "high|medium|low", "valueContribution": "high|medium|low", "marginRole": "creator|neutral|drain", "maturity": "strong|adequate|weak", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5},
    "service": {"costContribution": "high|medium|low", "valueContribution": "high|medium|low", "marginRole": "creator|neutral|drain", "maturity": "strong|adequate|weak", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5},
    "infrastructure": {"costContribution": "high|medium|low", "valueContribution": "high|medium|low", "marginRole": "creator|neutral|drain", "maturity": "strong|adequate|weak", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5},
    "hrManagement": {"costContribution": "high|medium|low", "valueContribution": "high|medium|low", "marginRole": "creator|neutral|drain", "maturity": "strong|adequate|weak", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5},
    "technology": {"costContribution": "high|medium|low", "valueContribution": "high|medium|low", "marginRole": "creator|neutral|drain", "maturity": "strong|adequate|weak", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5},
    "procurement": {"costContribution": "high|medium|low", "valueContribution": "high|medium|low", "marginRole": "creator|neutral|drain", "maturity": "strong|adequate|weak", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5}
  },
  "positioningVerdict": {"positioning": "cost-advantage|differentiation|stuck-in-the-middle", "summary": "..."},
  "levers": [
    {"title": "...", "activityIds": ["operations"], "insight": "...", "leverType": "cost-reduction|value-enhancement|linkage-optimization|outsource|integrate", "marginImpact": "high|medium|low", "urgency": "high|medium|low", "recommendation": "...", "confidence": 1-5}
  ],
  "moves": [
    {"title": "...", "category": "cost-advantage|differentiation|linkage-optimization|capability-build|restructure", "rationale": "...", "linkedLeverIds": [], "linkedActivityIds": ["operations"], "tradeoff": {"chosen": "...", "deferred": "...", "cost": "..."}, "rejectedAlternative": {"option": "...", "reason": "..."}, "expectedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "riskLevel": "high|medium|low", "confidence": 1-5, "firstStep": "..."}
  ],
  "outputCandidates": [
    {"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "rationale": "...", "linkedActivityIds": ["operations"], "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}
  ],
  "summary": {
    "executiveSummary": "...",
    "keyInsights": ["..."],
    "appliedConclusions": ["..."]
  },
  "initiatives": [
    {"title": "...", "description": "...", "type": "strategic|operational|defensive|growth", "rationale": "...", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "linkedItems": ["operations"]}
  ]
}`;
}

export function buildValueChainLeversPrompt(valueChainData: ValueChainData): string | null {
  const activities = ACTIVITY_IDS.map((activityId) => {
    const activity = valueChainData.activities[activityId];
    if (!activity) return '';
    return `- ${activityId} (${activity.kind}): cost=${activity.costContribution}, value=${activity.valueContribution}, marginRole=${activity.marginRole}; drivers: ${(activity.drivers || []).join('; ')}`;
  })
    .filter(Boolean)
    .join('\n');

  if (!activities.trim()) return null;

  // Deterministic synthesis first: margin map (creators vs drains) and the 2-3
  // lever activities, computed from the SCORED activities — not from the LLM.
  const marginMap = computeMarginMap(valueChainData.activities);
  const candidates = deriveLeverCandidates(valueChainData.activities, 3);
  const mapLine =
    marginMap.entries.length > 0
      ? `- creators (build margin): ${marginMap.creators.join(', ') || 'none'}\n- drains (erode margin): ${marginMap.drains.join(', ') || 'none'}\n- cost concentrated in drains: ${marginMap.costInDrains} vs in creators: ${marginMap.costInCreators}`
      : '- (no scored activities yet — score activities before synthesizing levers)';
  const candidateLines =
    candidates.length > 0
      ? candidates
          .map(
            (c) =>
              `- [${c.activityId}] pole=${c.pole}, leverScore=${c.leverScore}, suggested=${c.suggestedLeverType} — ${c.rationaleEn}`
          )
          .join('\n')
      : '- (not enough scored activities to pre-compute lever candidates)';

  return `Act as a strategy consultant. Convert this Porter Value Chain scorecard (9 activities scored on cost contribution, value contribution, and margin role) into margin levers and strategic moves.

${activities}

MARGIN MAP (computed from the scores — where value is created vs where it leaks):
${mapLine}

PRE-COMPUTED LEVER CANDIDATES (high cost x low maturity x value impact — your working set):
${candidateLines}

You NARRATE levers on top of the candidate activities that verifiably exist in the scorecard — you do not invent activities. Suggested lever types are a hypothesis; confirm or override with reasoning.

${buildValueChainMovePromptRules('en')}

Return JSON:
{
  "levers": [{"title":"...","activityIds":["operations"],"insight":"...","leverType":"cost-reduction|value-enhancement|linkage-optimization|outsource|integrate","marginImpact":"high|medium|low","urgency":"high|medium|low","recommendation":"...","confidence":4}],
  "moves": [{"title":"...","category":"cost-advantage|differentiation|linkage-optimization|capability-build|restructure","rationale":"...","linkedLeverIds":[],"linkedActivityIds":["operations"],"tradeoff":{"chosen":"...","deferred":"...","cost":"..."},"rejectedAlternative":{"option":"...","reason":"..."},"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}]
}`;
}

export function buildValueChainRethinkPrompt(
  valueChainData: ValueChainData,
  cardType: string,
  cardId: string,
  userComment?: string
): string {
  let cardContent = '';
  if (cardType === 'signal') {
    const signal = valueChainData.signals.find((item) => item.id === cardId);
    cardContent = signal ? `[${signal.type}] ${signal.content}` : '';
  } else if (cardType === 'activity') {
    const activity = valueChainData.activities[cardId as ValueActivityId];
    cardContent = activity
      ? `${activity.name} (${activity.kind}): cost=${activity.costContribution}, value=${activity.valueContribution}, marginRole=${activity.marginRole}, drivers: ${activity.drivers.join('; ')}`
      : '';
  } else if (cardType === 'lever') {
    const lever = valueChainData.levers.find((item) => item.id === cardId);
    cardContent = lever ? `${lever.title}: ${lever.insight}` : '';
  } else if (cardType === 'move') {
    const move = valueChainData.recommendedMoves.find((item) => item.id === cardId);
    cardContent = move ? `${move.title}: ${move.rationale}` : '';
  } else if (cardType === 'output-candidate') {
    const output = valueChainData.outputCandidates.find((item) => item.id === cardId);
    cardContent = output ? `${output.title}: ${output.description}` : '';
  } else if (cardType === 'conclusion') {
    cardContent = JSON.stringify(valueChainData.summary || {}, null, 2);
  }

  return `The user wants you to rethink this Value Chain ${cardType} card.

Current card:
${cardContent}

User feedback: ${userComment || 'Please improve it.'}

Value chain context:
- Industry: ${valueChainData.context.industry || 'N/A'}
- Scope: ${valueChainData.context.valueChainScope || 'N/A'}

Return JSON with improved fields for the same card type.`;
}

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cleanActivityIds = (value: unknown): ValueActivityId[] =>
  Array.isArray(value)
    ? value.filter((id): id is ValueActivityId => ACTIVITY_IDS.includes(id))
    : [];

const proposalStatus: ProposalStatus = 'ai-proposed';

function normalizeStaircase(raw: any): ValueChainData['activities'][ValueActivityId]['staircase'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const surface = typeof raw.surface === 'string' ? raw.surface : '';
  const costValueProof = typeof raw.costValueProof === 'string' ? raw.costValueProof : '';
  const benchmark = typeof raw.benchmark === 'string' ? raw.benchmark : '';
  const potential = typeof raw.potential === 'string' ? raw.potential : '';
  if (!surface && !costValueProof && !benchmark && !potential) return undefined;
  return {
    surface,
    costValueProof,
    proofRefs: Array.isArray(raw.proofRefs) ? raw.proofRefs.filter(Boolean).map(String) : [],
    benchmark,
    potential,
  };
}

function normalizeTradeoff(raw: any): { chosen: string; deferred: string; cost: string } | undefined {
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

export function applyValueChainPendingAction({
  pendingAction,
  parsed,
  currentStepId,
  valueChainData,
  rethinkTarget,
  toolType,
  actions,
}: ApplyValueChainPendingActionOptions): { clearRethinkTarget?: boolean } {
  if (pendingAction === 'rethink' && rethinkTarget) {
    actions.updateCardAfterRethink(rethinkTarget.cardType, rethinkTarget.cardId, parsed);
    return { clearRethinkTarget: true };
  }

  if (pendingAction === 'suggestions' && currentStepId === 'mission') {
    const mission = parsed.mission && typeof parsed.mission === 'object' ? parsed.mission : parsed;
    actions.updateInputData({
      context: {
        ...valueChainData.context,
        industry: mission.industry || valueChainData.context.industry,
        valueChainScope: mission.valueChainScope || valueChainData.context.valueChainScope,
        position: (['cost-leader', 'differentiator', 'hybrid', 'undefined'].includes(
          mission.position
        )
          ? mission.position
          : valueChainData.context.position) as ValueChainData['context']['position'],
        goal: mission.goal || valueChainData.context.goal,
        successSignal: mission.successSignal || valueChainData.context.successSignal,
        constraints: mission.constraints || valueChainData.context.constraints,
        assumptions: mission.assumptions || valueChainData.context.assumptions,
        kpiTarget: mission.kpiTarget || valueChainData.context.kpiTarget,
      },
    });
    return {};
  }

  if (pendingAction === 'suggestions' && currentStepId === 'input') {
    const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
    actions.updateInputData({
      signals: [
        ...(valueChainData.signals || []),
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
    (pendingAction === 'suggestions' && currentStepId === 'activities') ||
    pendingAction === 'full-session'
  ) {
    const nextActivities = { ...valueChainData.activities };
    const activities =
      parsed.activities && typeof parsed.activities === 'object' ? parsed.activities : {};
    ACTIVITY_IDS.forEach((activityId) => {
      const activity = activities[activityId];
      if (!activity) return;
      nextActivities[activityId] = {
        ...nextActivities[activityId],
        costContribution: ['high', 'medium', 'low'].includes(activity.costContribution)
          ? activity.costContribution
          : nextActivities[activityId].costContribution,
        valueContribution: ['high', 'medium', 'low'].includes(activity.valueContribution)
          ? activity.valueContribution
          : nextActivities[activityId].valueContribution,
        marginRole: ['creator', 'neutral', 'drain'].includes(activity.marginRole)
          ? activity.marginRole
          : nextActivities[activityId].marginRole,
        maturity: ['strong', 'adequate', 'weak'].includes(activity.maturity)
          ? activity.maturity
          : nextActivities[activityId].maturity,
        drivers: Array.isArray(activity.drivers)
          ? activity.drivers.filter(Boolean)
          : nextActivities[activityId].drivers,
        evidence: Array.isArray(activity.evidence) ? activity.evidence.filter(Boolean) : [],
        implication:
          typeof activity.implication === 'string'
            ? activity.implication
            : nextActivities[activityId].implication,
        confidence: typeof activity.confidence === 'number' ? activity.confidence : 3,
        ...(() => {
          const staircase = normalizeStaircase(activity.staircase);
          const evidenceStatus =
            activity.evidenceStatus === 'confirmed' ||
            activity.evidenceStatus === 'declared' ||
            activity.evidenceStatus === 'missing'
              ? activity.evidenceStatus
              : staircase
                ? staircase.proofRefs.length > 0
                  ? 'confirmed'
                  : 'declared'
                : nextActivities[activityId].evidenceStatus;
          return {
            ...(staircase ? { staircase } : {}),
            ...(evidenceStatus ? { evidenceStatus } : {}),
          };
        })(),
        proposalStatus,
      };
    });

    const verdict =
      parsed.positioningVerdict && typeof parsed.positioningVerdict === 'object'
        ? parsed.positioningVerdict
        : null;

    actions.updateInputData({
      activities: nextActivities,
      ...(verdict &&
      ['cost-advantage', 'differentiation', 'stuck-in-the-middle'].includes(verdict.positioning)
        ? {
            positioningVerdict: {
              positioning: verdict.positioning,
              summary: typeof verdict.summary === 'string' ? verdict.summary : '',
            },
          }
        : {}),
    });
  }

  if (
    pendingAction === 'correlations' ||
    pendingAction === 'summary' ||
    pendingAction === 'full-session'
  ) {
    const levers = Array.isArray(parsed.levers) ? parsed.levers : [];
    const moves = Array.isArray(parsed.moves) ? parsed.moves : [];
    actions.updateInputData({
      ...(levers.length > 0
        ? {
            levers: levers
              .filter((item) => item?.title && item?.insight)
              .map((item) => ({
                id: makeId('lever'),
                title: item.title,
                activityIds: cleanActivityIds(item.activityIds),
                insight: item.insight,
                leverType: item.leverType || 'cost-reduction',
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
                category: move.category || 'cost-advantage',
                rationale: move.rationale || '',
                linkedLeverIds: Array.isArray(move.linkedLeverIds)
                  ? move.linkedLeverIds.filter(Boolean).map(String)
                  : [],
                linkedActivityIds: cleanActivityIds(move.linkedActivityIds),
                ...(() => {
                  const tradeoff = normalizeTradeoff(move.tradeoff);
                  const rejectedAlternative = normalizeRejectedAlternative(move.rejectedAlternative);
                  return {
                    ...(tradeoff ? { tradeoff } : {}),
                    ...(rejectedAlternative ? { rejectedAlternative } : {}),
                  };
                })(),
                expectedImpact: move.expectedImpact || 'medium',
                estimatedEffort: move.estimatedEffort || 'medium',
                riskLevel: move.riskLevel || 'medium',
                confidence: typeof move.confidence === 'number' ? move.confidence : 3,
                firstStep: move.firstStep || '',
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
        proposalId: 'value-chain-summary',
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
          linkedActivityIds: cleanActivityIds(candidate.linkedActivityIds),
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
