import { buildAnsoffConclusionPrompt, buildAnsoffQuestionBankPromptRules } from '@/config/ansoff';
import type {
  GrowthPathsData,
  GrowthQuadrantId,
  InitiativeDraft,
  ProposalStatus,
  ToolType,
} from '@/store/useToolStore';

import type { ToolAiPendingAction } from './dynamicSwot';
import { GROUNDING_RULES_BOTH } from './groundingRules';
import { pickW2SummaryFields } from './w2SummaryFields';
const QUADRANTS: GrowthQuadrantId[] = [
  'marketPenetration',
  'marketDevelopment',
  'productDevelopment',
  'diversification',
];

interface GrowthPathsActionHandlers {
  updateInputData: (data: Partial<GrowthPathsData>) => void;
  setInitiatives: (initiatives: Omit<InitiativeDraft, 'id'>[]) => void;
  setSessionGenerationStatus: (status: 'idle' | 'generating' | 'ready' | 'error') => void;
  updateCardAfterRethink: (cardType: any, cardId: string, updates: Record<string, unknown>) => void;
}

interface ApplyGrowthPathsPendingActionOptions {
  pendingAction: ToolAiPendingAction;
  parsed: Record<string, any>;
  currentStepId?: string;
  growthData: GrowthPathsData;
  rethinkTarget?: { cardType: string; cardId: string } | null;
  toolType: ToolType;
  actions: GrowthPathsActionHandlers;
}

export function buildGrowthPathsFullSessionPrompt(
  growthData: GrowthPathsData | undefined,
  orgContext: string
): string {
  return `You are a senior growth strategy consultant running an Ansoff Growth Paths session.
Produce a COMPLETE first-draft Growth Paths session. Everything is a proposal for user review.

=== GROWTH BRIEF ===
- Growth goal: ${growthData?.context?.goal || 'not yet defined'}
- Scope: ${growthData?.context?.scope || 'not yet defined'}
- Success signal: ${growthData?.context?.successSignal || 'not yet defined'}
- Timeframe: ${growthData?.context?.timeframe || 'medium'}
- Constraints: ${growthData?.context?.constraints || 'none specified'}

=== ORGANIZATION CONTEXT ===
${orgContext}
=== END CONTEXT ===

${buildAnsoffQuestionBankPromptRules('en')}

${GROUNDING_RULES_BOTH}
Return one JSON object with this exact structure:
{
  "signals": [
    {"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["marketPenetration"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}
  ],
  "options": {
    "marketPenetration": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "riskLevel": "high|medium|low", "rationale": "...", "evidence": ["..."], "confidence": 1-5, "firstStep": "..."}],
    "marketDevelopment": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "riskLevel": "high|medium|low", "rationale": "...", "evidence": ["..."], "confidence": 1-5, "firstStep": "..."}],
    "productDevelopment": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "riskLevel": "high|medium|low", "rationale": "...", "evidence": ["..."], "confidence": 1-5, "firstStep": "..."}],
    "diversification": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "riskLevel": "high|medium|low", "rationale": "...", "evidence": ["..."], "confidence": 1-5, "firstStep": "..."}]
  },
  "comparisons": [
    {"title": "...", "insight": "...", "linkedQuadrants": ["marketPenetration"], "recommendation": "...", "priority": "high|medium|low", "confidence": 1-5}
  ],
  "moves": [
    {"title": "...", "category": "scale-core|enter-market|build-product|diversify|validate-first", "rationale": "...", "linkedOptionIds": [], "linkedQuadrants": ["marketPenetration"], "expectedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "riskLevel": "high|medium|low", "confidence": 1-5, "firstStep": "..."}
  ],
  "outputCandidates": [
    {"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "rationale": "...", "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked", "linkedQuadrants": ["marketPenetration"]}
  ],
  "summary": {
    "executiveSummary": "...",
    "keyInsights": ["..."],
    "appliedConclusions": ["..."]
  },
  "initiatives": [
    {"title": "...", "description": "...", "type": "growth|strategic|operational", "rationale": "...", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "linkedItems": ["marketPenetration"]}
  ]
}`;
}

export function buildGrowthPathsSynthesisPrompt(growthData: GrowthPathsData): string | null {
  // Prefer the fact-grounded Ansoff engine (scoring + W2 move sequence) when
  // there is at least one accepted option. Falls back to the generic prompt
  // for empty sessions so behavior stays backward-compatible.
  const isPolish = (growthData.context?.goal || '').match(/[ąćęłńóśźż]/i) !== null;
  const grounded = buildAnsoffConclusionPrompt(growthData, isPolish);
  if (grounded) return grounded;

  const options = QUADRANTS.map((quadrant) => {
    const items = growthData.quadrants[quadrant] || [];
    return `- ${quadrant}: ${items.map((item) => `${item.title} (${item.impact}/${item.effort}/${item.riskLevel || 'medium'})`).join('; ') || 'none'}`;
  }).join('\n');

  if (!options.trim()) return null;

  return `Act as a growth strategy consultant. Convert these Ansoff options into strategic comparisons and recommended moves.

${options}

Rules:
- compare options using impact, effort, risk, evidence, and fit with the growth mission
- recommend a sequence, not a wishlist
- include at least one validate-first move if uncertainty is high

Return JSON:
{
  "comparisons": [{"title":"...","insight":"...","linkedQuadrants":["marketPenetration"],"recommendation":"...","priority":"high|medium|low","confidence":4}],
  "moves": [{"title":"...","category":"scale-core|enter-market|build-product|diversify|validate-first","rationale":"...","linkedOptionIds":[],"linkedQuadrants":["marketPenetration"],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}]
}`;
}

export function buildGrowthPathsRethinkPrompt(
  growthData: GrowthPathsData,
  cardType: string,
  cardId: string,
  userComment?: string
): string {
  let cardContent = '';
  if (cardType === 'signal') {
    const signal = growthData.signals.find((item) => item.id === cardId);
    cardContent = signal ? `[${signal.type}] ${signal.content}` : '';
  } else if (cardType === 'item') {
    const option = QUADRANTS.flatMap((quadrant) => growthData.quadrants[quadrant]).find(
      (item) => item.id === cardId
    );
    cardContent = option ? `${option.title}: ${option.description}` : '';
  } else if (cardType === 'tension' || cardType === 'correlation') {
    const comparison = growthData.comparisons.find((item) => item.id === cardId);
    cardContent = comparison ? `${comparison.title}: ${comparison.insight}` : '';
  } else if (cardType === 'move') {
    const move = growthData.recommendedMoves.find((item) => item.id === cardId);
    cardContent = move ? `${move.title}: ${move.rationale}` : '';
  } else if (cardType === 'output-candidate') {
    const output = growthData.outputCandidates.find((item) => item.id === cardId);
    cardContent = output ? `${output.title}: ${output.description}` : '';
  } else if (cardType === 'conclusion') {
    cardContent = JSON.stringify(growthData.summary || {}, null, 2);
  }

  return `The user wants you to rethink this Growth Paths ${cardType} card.

Current card:
${cardContent}

User feedback: ${userComment || 'Please improve it.'}

Growth context:
- Goal: ${growthData.context.goal || 'N/A'}
- Scope: ${growthData.context.scope || 'N/A'}

Return JSON with improved fields for the same card type.`;
}

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cleanQuadrants = (value: unknown): GrowthQuadrantId[] =>
  Array.isArray(value) ? value.filter((id): id is GrowthQuadrantId => QUADRANTS.includes(id)) : [];

const proposalStatus: ProposalStatus = 'ai-proposed';

const normalizeOptions = (parsedOptions: any, growthData: GrowthPathsData) => {
  const source = parsedOptions && typeof parsedOptions === 'object' ? parsedOptions : {};
  const nextQuadrants = { ...growthData.quadrants };
  QUADRANTS.forEach((quadrant) => {
    const options = Array.isArray(source[quadrant]) ? source[quadrant] : [];
    if (!options.length) return;
    nextQuadrants[quadrant] = options
      .filter((option: any) => option?.title)
      .map((option: any) => ({
        id: makeId('growth-option'),
        title: option.title,
        description: option.description || '',
        impact: option.impact || 'medium',
        effort: option.effort || 'medium',
        quadrant,
        rationale: option.rationale || '',
        evidence: Array.isArray(option.evidence) ? option.evidence.filter(Boolean) : [],
        riskLevel: option.riskLevel || 'medium',
        confidence: typeof option.confidence === 'number' ? option.confidence : 3,
        firstStep: option.firstStep || '',
        proposalStatus,
      }));
  });
  return nextQuadrants;
};

export function applyGrowthPathsPendingAction({
  pendingAction,
  parsed,
  currentStepId,
  growthData,
  rethinkTarget,
  toolType,
  actions,
}: ApplyGrowthPathsPendingActionOptions): { clearRethinkTarget?: boolean } {
  if (pendingAction === 'rethink' && rethinkTarget) {
    actions.updateCardAfterRethink(rethinkTarget.cardType, rethinkTarget.cardId, parsed);
    return { clearRethinkTarget: true };
  }

  if (pendingAction === 'suggestions' && currentStepId === 'mission') {
    const mission = parsed.mission && typeof parsed.mission === 'object' ? parsed.mission : parsed;
    actions.updateInputData({
      context: {
        ...growthData.context,
        goal: mission.goal || growthData.context.goal,
        scope: mission.scope || growthData.context.scope,
        successSignal: mission.successSignal || growthData.context.successSignal,
        timeframe: mission.timeframe || growthData.context.timeframe,
        constraints: mission.constraints || growthData.context.constraints,
        assumptions: mission.assumptions || growthData.context.assumptions,
        kpiTarget: mission.kpiTarget || growthData.context.kpiTarget,
      },
    });
    return {};
  }

  if (pendingAction === 'suggestions' && currentStepId === 'input') {
    const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
    actions.updateInputData({
      signals: [
        ...(growthData.signals || []),
        ...signals
          .filter((signal) => signal?.content)
          .map((signal) => ({
            id: makeId('growth-signal'),
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
    (pendingAction === 'suggestions' && currentStepId === 'options') ||
    pendingAction === 'full-session'
  ) {
    actions.updateInputData({
      quadrants: normalizeOptions(parsed.options || parsed.quadrants, growthData),
    });
  }

  if (
    pendingAction === 'correlations' ||
    pendingAction === 'summary' ||
    pendingAction === 'full-session'
  ) {
    const comparisons = Array.isArray(parsed.comparisons) ? parsed.comparisons : [];
    const moves = Array.isArray(parsed.moves) ? parsed.moves : [];
    actions.updateInputData({
      ...(comparisons.length > 0
        ? {
            comparisons: comparisons
              .filter((item) => item?.title && item?.insight)
              .map((item) => ({
                id: makeId('growth-comparison'),
                title: item.title,
                insight: item.insight,
                linkedQuadrants: cleanQuadrants(item.linkedQuadrants),
                recommendation: item.recommendation || '',
                priority: item.priority || 'medium',
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
                id: makeId('growth-move'),
                title: move.title,
                category: move.category || 'validate-first',
                // W2 contract: fold trade-off + rejected variant into the
                // single rationale field the store carries, so the "move must
                // justify itself" content is never lost.
                rationale: [move.rationale, move.tradeOff, move.rejectedVariant]
                  .filter((part) => typeof part === 'string' && part.trim())
                  .join(' ')
                  .trim(),
                linkedOptionIds: Array.isArray(move.linkedOptionIds)
                  ? move.linkedOptionIds.filter(Boolean)
                  : [],
                linkedQuadrants: cleanQuadrants(move.linkedQuadrants),
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
        proposalId: 'growth-summary',
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
          type: initiative.type || 'growth',
          source: toolType,
          linkedItems: initiative.linkedItems || [],
          estimatedImpact: initiative.estimatedImpact || initiative.impact || 'medium',
          estimatedEffort: initiative.estimatedEffort || initiative.effort || 'medium',
          rationale: initiative.rationale || '',
        })),
      },
      outputCandidates: outputCandidates
        .filter((candidate) => candidate?.title)
        .map((candidate) => ({
          id: makeId('growth-output'),
          outputType: candidate.outputType || 'initiative',
          title: candidate.title,
          description: candidate.description || '',
          linkedOptionIds: Array.isArray(candidate.linkedOptionIds)
            ? candidate.linkedOptionIds.filter(Boolean)
            : [],
          linkedQuadrants: cleanQuadrants(candidate.linkedQuadrants),
          rationale: candidate.rationale || '',
          readiness: candidate.readiness || 'keep-as-idea',
          proposalStatus,
        })),
    });

    actions.setInitiatives(
      initiatives.map((initiative) => ({
        title: initiative.title || '',
        description: initiative.description || '',
        type: initiative.type || 'growth',
        source: toolType,
        linkedItems: initiative.linkedItems || [],
        estimatedImpact: initiative.estimatedImpact || initiative.impact || 'medium',
        estimatedEffort: initiative.estimatedEffort || initiative.effort || 'medium',
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
          id: makeId('growth-signal'),
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
