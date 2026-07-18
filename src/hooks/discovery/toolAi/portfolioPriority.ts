import { buildPortfolioLadderPromptBlock } from '@/config/portfolio/portfolioQuestionBank';
import type {
  InitiativeDraft,
  PortfolioItem,
  PortfolioPriorityData,
  ProposalStatus,
  ToolType,
} from '@/store/useToolStore';

import type { ToolAiPendingAction } from './dynamicSwot';
import { GROUNDING_RULES_BOTH } from './groundingRules';
import { pickW2SummaryFields } from './w2SummaryFields';

/**
 * Conversation-layer protocol appended to the system prompt for the Portfolio
 * Priority "items" step: the mentor in chat interviews with the SAME laddered
 * per-element question bank as the wizard (single source of truth), one element
 * at a time, branching on answers. Mirrors buildDynamicSwotConversationProtocol /
 * buildValueChainConversationProtocol / buildMarketForcesConversationProtocol —
 * this tool had the ladder content (portfolioQuestionBank.ts) but no dedicated
 * prompt builder and no wiring into the live chat mentor at all (O3 audit gap,
 * closed here). Returns '' for other steps so it is a no-op there.
 */
export function buildPortfolioConversationProtocol(
  stepId: string | undefined,
  language: 'pl' | 'en' = 'en'
): string {
  if (stepId !== 'items') return '';
  const ladder = buildPortfolioLadderPromptBlock(language);
  return `

INTERVIEW PROTOCOL (laddered portfolio-element question bank — the single source of truth for this step):
When the user explores a portfolio element (initiative / project / product) in conversation, walk this ladder. Ask ONE question at a time; classify the answer into a branch key and follow the branch. Vague answer -> use the probe. Dig from surface -> WHERE the value numbers come from -> feasibility and dependencies between elements -> the urgency window. Do not accept a value/effort score without a sourced proof; an element with no session evidence is "declared, unconfirmed". When a ladder path completes, propose the scored element with its evidence status.

${ladder}`;
}

interface PortfolioActionHandlers {
  updateInputData: (data: Partial<PortfolioPriorityData>) => void;
  setInitiatives: (initiatives: Omit<InitiativeDraft, 'id'>[]) => void;
  setSessionGenerationStatus: (status: 'idle' | 'generating' | 'ready' | 'error') => void;
  updateCardAfterRethink: (cardType: any, cardId: string, updates: Record<string, unknown>) => void;
}

interface ApplyPortfolioPendingActionOptions {
  pendingAction: ToolAiPendingAction;
  parsed: Record<string, any>;
  currentStepId?: string;
  portfolioData: PortfolioPriorityData;
  rethinkTarget?: { cardType: string; cardId: string } | null;
  toolType: ToolType;
  actions: PortfolioActionHandlers;
}

const proposalStatus: ProposalStatus = 'ai-proposed';

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getCategory = (growth: number, share: number): PortfolioItem['category'] => {
  if (growth >= 4 && share >= 4) return 'star';
  if (growth >= 4 && share < 4) return 'question-mark';
  if (growth < 4 && share >= 4) return 'cash-cow';
  return 'dog';
};

export function buildPortfolioFullSessionPrompt(
  portfolioData: PortfolioPriorityData | undefined,
  orgContext: string
): string {
  return `You are a senior strategy consultant running a Portfolio Priority / BCG resource allocation session.
Produce a COMPLETE first-draft Portfolio Priority session. Everything is a proposal for user review.

=== PORTFOLIO BRIEF ===
- Decision goal: ${portfolioData?.context?.goal || 'not yet defined'}
- Scope: ${portfolioData?.context?.scope || 'not yet defined'}
- Success signal: ${portfolioData?.context?.successSignal || 'not yet defined'}
- Timeframe: ${portfolioData?.context?.timeframe || 'medium'}
- Constraints: ${portfolioData?.context?.constraints || 'none specified'}

=== ORGANIZATION CONTEXT ===
${orgContext}
=== END CONTEXT ===


${GROUNDING_RULES_BOTH}
Return one JSON object with this exact structure:
{
  "signals": [
    {"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["portfolio"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}
  ],
  "items": [
    {"title": "...", "description": "...", "marketGrowth": 1-5, "marketShare": 1-5, "investmentLevel": 1-5, "rationale": "...", "evidence": ["..."], "recommendation": "invest|maintain|test|harvest|stop", "confidence": 1-5}
  ],
  "tradeOffs": [
    {"title": "...", "insight": "...", "linkedItemIds": [], "recommendation": "...", "priority": "high|medium|low", "confidence": 1-5}
  ],
  "moves": [
    {"title": "...", "category": "invest|maintain|test|harvest|stop", "rationale": "...", "linkedItemIds": [], "expectedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "riskLevel": "high|medium|low", "confidence": 1-5, "firstStep": "..."}
  ],
  "outputCandidates": [
    {"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "rationale": "...", "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked", "linkedItemIds": []}
  ],
  "summary": {
    "executiveSummary": "...",
    "keyInsights": ["..."],
    "appliedConclusions": ["..."]
  },
  "initiatives": [
    {"title": "...", "description": "...", "type": "strategic|growth|operational", "rationale": "...", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "linkedItems": []}
  ]
}`;
}

export function buildPortfolioSynthesisPrompt(portfolioData: PortfolioPriorityData): string | null {
  const items = (portfolioData.initiatives || [])
    .map(
      (item) =>
        `- ${item.title}: ${item.category}, growth ${item.marketGrowth}/5, share ${item.marketShare}/5, investment ${item.investmentLevel}/5`
    )
    .join('\n');

  if (!items.trim()) return null;

  return `Act as a portfolio strategy consultant. Convert these BCG portfolio items into trade-offs and recommended resource moves.

${items}

Rules:
- recommend a portfolio allocation sequence, not a balanced wishlist
- make explicit what to invest in, maintain, test, harvest, and stop
- expose opportunity cost and resource constraints

Return JSON:
{
  "tradeOffs": [{"title":"...","insight":"...","linkedItemIds":[],"recommendation":"...","priority":"high|medium|low","confidence":4}],
  "moves": [{"title":"...","category":"invest|maintain|test|harvest|stop","rationale":"...","linkedItemIds":[],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}]
}`;
}

export function buildPortfolioRethinkPrompt(
  portfolioData: PortfolioPriorityData,
  cardType: string,
  cardId: string,
  userComment?: string
): string {
  let cardContent = '';
  if (cardType === 'signal') {
    const signal = portfolioData.signals.find((item) => item.id === cardId);
    cardContent = signal ? `[${signal.type}] ${signal.content}` : '';
  } else if (cardType === 'item') {
    const item = portfolioData.initiatives.find((entry) => entry.id === cardId);
    cardContent = item ? `${item.title}: ${item.description}` : '';
  } else if (cardType === 'tension' || cardType === 'correlation') {
    const tradeOff = portfolioData.tradeOffs.find((entry) => entry.id === cardId);
    cardContent = tradeOff ? `${tradeOff.title}: ${tradeOff.insight}` : '';
  } else if (cardType === 'move') {
    const move = portfolioData.recommendedMoves.find((entry) => entry.id === cardId);
    cardContent = move ? `${move.title}: ${move.rationale}` : '';
  } else if (cardType === 'output-candidate') {
    const output = portfolioData.outputCandidates.find((entry) => entry.id === cardId);
    cardContent = output ? `${output.title}: ${output.description}` : '';
  } else if (cardType === 'conclusion') {
    cardContent = JSON.stringify(portfolioData.summary || {}, null, 2);
  }

  return `The user wants you to rethink this Portfolio Priority ${cardType} card.

Current card:
${cardContent}

User feedback: ${userComment || 'Please improve it.'}

Portfolio context:
- Goal: ${portfolioData.context.goal || 'N/A'}
- Scope: ${portfolioData.context.scope || 'N/A'}

Return JSON with improved fields for the same card type.`;
}

const normalizeItems = (items: any[]) =>
  items
    .filter((item) => item?.title)
    .map((item) => {
      const marketGrowth = typeof item.marketGrowth === 'number' ? item.marketGrowth : 3;
      const marketShare = typeof item.marketShare === 'number' ? item.marketShare : 3;
      return {
        id: makeId('portfolio-item'),
        title: item.title,
        description: item.description || '',
        marketGrowth,
        marketShare,
        investmentLevel: typeof item.investmentLevel === 'number' ? item.investmentLevel : 3,
        category: item.category || getCategory(marketGrowth, marketShare),
        rationale: item.rationale || '',
        evidence: Array.isArray(item.evidence) ? item.evidence.filter(Boolean) : [],
        recommendation: item.recommendation || 'test',
        confidence: typeof item.confidence === 'number' ? item.confidence : 3,
        proposalStatus,
      };
    });

export function applyPortfolioPendingAction({
  pendingAction,
  parsed,
  currentStepId,
  portfolioData,
  rethinkTarget,
  toolType,
  actions,
}: ApplyPortfolioPendingActionOptions): { clearRethinkTarget?: boolean } {
  if (pendingAction === 'rethink' && rethinkTarget) {
    actions.updateCardAfterRethink(rethinkTarget.cardType, rethinkTarget.cardId, parsed);
    return { clearRethinkTarget: true };
  }

  if (pendingAction === 'suggestions' && currentStepId === 'mission') {
    const mission = parsed.mission && typeof parsed.mission === 'object' ? parsed.mission : parsed;
    actions.updateInputData({
      context: {
        ...portfolioData.context,
        goal: mission.goal || portfolioData.context.goal,
        scope: mission.scope || portfolioData.context.scope,
        successSignal: mission.successSignal || portfolioData.context.successSignal,
        timeframe: mission.timeframe || portfolioData.context.timeframe,
        constraints: mission.constraints || portfolioData.context.constraints,
        assumptions: mission.assumptions || portfolioData.context.assumptions,
        kpiTarget: mission.kpiTarget || portfolioData.context.kpiTarget,
      },
    });
    return {};
  }

  if (pendingAction === 'suggestions' && currentStepId === 'input') {
    const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
    actions.updateInputData({
      signals: [
        ...(portfolioData.signals || []),
        ...signals
          .filter((signal) => signal?.content)
          .map((signal) => ({
            id: makeId('portfolio-signal'),
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
    (pendingAction === 'suggestions' && currentStepId === 'items') ||
    pendingAction === 'full-session'
  ) {
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    if (items.length > 0) {
      actions.updateInputData({ initiatives: normalizeItems(items) });
    }
  }

  if (
    pendingAction === 'correlations' ||
    pendingAction === 'summary' ||
    pendingAction === 'full-session'
  ) {
    const tradeOffs = Array.isArray(parsed.tradeOffs) ? parsed.tradeOffs : [];
    const moves = Array.isArray(parsed.moves) ? parsed.moves : [];
    actions.updateInputData({
      ...(tradeOffs.length > 0
        ? {
            tradeOffs: tradeOffs
              .filter((item) => item?.title && item?.insight)
              .map((item) => ({
                id: makeId('portfolio-tradeoff'),
                title: item.title,
                insight: item.insight,
                linkedItemIds: Array.isArray(item.linkedItemIds)
                  ? item.linkedItemIds.filter(Boolean)
                  : [],
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
                id: makeId('portfolio-move'),
                title: move.title,
                category: move.category || 'test',
                rationale: move.rationale || '',
                linkedItemIds: Array.isArray(move.linkedItemIds)
                  ? move.linkedItemIds.filter(Boolean)
                  : [],
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
        proposalId: 'portfolio-summary',
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
          estimatedImpact: initiative.estimatedImpact || initiative.impact || 'medium',
          estimatedEffort: initiative.estimatedEffort || initiative.effort || 'medium',
          rationale: initiative.rationale || '',
        })),
      },
      outputCandidates: outputCandidates
        .filter((candidate) => candidate?.title)
        .map((candidate) => ({
          id: makeId('portfolio-output'),
          outputType: candidate.outputType || 'initiative',
          title: candidate.title,
          description: candidate.description || '',
          linkedItemIds: Array.isArray(candidate.linkedItemIds)
            ? candidate.linkedItemIds.filter(Boolean)
            : [],
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
          id: makeId('portfolio-signal'),
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
