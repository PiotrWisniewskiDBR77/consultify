import type {
  InitiativeDraft,
  PorterData,
  PorterForceId,
  ProposalStatus,
  ToolType,
} from '@/store/useToolStore';

import type { ToolAiPendingAction } from './dynamicSwot';

const FORCE_IDS: PorterForceId[] = [
  'rivalry',
  'newEntrants',
  'substitutes',
  'buyerPower',
  'supplierPower',
];

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

Generate a consulting-grade first draft. Everything is a proposal for user review.

Return one JSON object with this exact structure:
{
  "signals": [
    {"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["rivalry"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}
  ],
  "forces": {
    "rivalry": {"score": 1-5, "trend": "increasing|stable|decreasing", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5},
    "newEntrants": {"score": 1-5, "trend": "increasing|stable|decreasing", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5},
    "substitutes": {"score": 1-5, "trend": "increasing|stable|decreasing", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5},
    "buyerPower": {"score": 1-5, "trend": "increasing|stable|decreasing", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5},
    "supplierPower": {"score": 1-5, "trend": "increasing|stable|decreasing", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5}
  },
  "implications": [
    {"title": "...", "forceIds": ["rivalry"], "insight": "...", "marginImpact": "high|medium|low", "urgency": "high|medium|low", "recommendation": "...", "confidence": 1-5}
  ],
  "moves": [
    {"title": "...", "category": "positioning|pricing|partnership|capability-build|defensive-move", "rationale": "...", "linkedForceIds": ["buyerPower"], "expectedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "riskLevel": "high|medium|low", "confidence": 1-5, "firstStep": "..."}
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
  const forces = FORCE_IDS.map((forceId) => {
    const force = porterData.forces[forceId];
    return `- ${forceId}: ${force.score}/5, ${force.trend}; drivers: ${(force.drivers || []).join('; ')}`;
  }).join('\n');

  if (!forces.trim()) return null;

  return `Act as a strategy consultant. Convert this Porter Five Forces scorecard into strategic implications and moves.

${forces}

Return JSON:
{
  "implications": [{"title":"...","forceIds":["rivalry"],"insight":"...","marginImpact":"high|medium|low","urgency":"high|medium|low","recommendation":"...","confidence":4}],
  "moves": [{"title":"...","category":"positioning|pricing|partnership|capability-build|defensive-move","rationale":"...","linkedForceIds":["buyerPower"],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}]
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
      nextForces[forceId] = {
        ...nextForces[forceId],
        score: typeof force.score === 'number' ? force.score : nextForces[forceId].score,
        trend: ['increasing', 'stable', 'decreasing'].includes(force.trend)
          ? force.trend
          : nextForces[forceId].trend,
        drivers: Array.isArray(force.drivers)
          ? force.drivers.filter(Boolean)
          : nextForces[forceId].drivers,
        evidence: Array.isArray(force.evidence) ? force.evidence.filter(Boolean) : [],
        implication:
          typeof force.implication === 'string'
            ? force.implication
            : nextForces[forceId].implication,
        confidence: typeof force.confidence === 'number' ? force.confidence : 3,
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
    actions.updateInputData({
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
                linkedImplicationIds: [],
                linkedForceIds: cleanForceIds(move.linkedForceIds),
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
        proposalId: 'porter-summary',
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
