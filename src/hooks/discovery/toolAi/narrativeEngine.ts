import type {
  InitiativeDraft,
  NarrativeEngineData,
  ProposalStatus,
  ToolType,
} from '@/store/useToolStore';

import type { ToolAiPendingAction } from './dynamicSwot';

interface NarrativeEngineActionHandlers {
  updateInputData: (data: Partial<NarrativeEngineData>) => void;
  setInitiatives: (initiatives: Omit<InitiativeDraft, 'id'>[]) => void;
  setSessionGenerationStatus: (status: 'idle' | 'generating' | 'ready' | 'error') => void;
  updateCardAfterRethink: (cardType: any, cardId: string, updates: Record<string, unknown>) => void;
}

interface ApplyNarrativeEnginePendingActionOptions {
  pendingAction: ToolAiPendingAction;
  parsed: Record<string, any>;
  currentStepId?: string;
  narrativeData: NarrativeEngineData;
  rethinkTarget?: { cardType: string; cardId: string } | null;
  toolType: ToolType;
  actions: NarrativeEngineActionHandlers;
}

export function buildNarrativeEngineFullSessionPrompt(
  narrativeData: NarrativeEngineData | undefined,
  orgContext: string
): string {
  return `You are a senior strategy consultant running a Narrative Engine session.
The client wants to build a persuasive narrative from a defined audience and core message,
shape it into message pillars (each with proof points), weave storyline threads, and choose
delivery moves. Produce a COMPLETE first-draft Narrative Engine session.

=== NARRATIVE ENGINE BRIEF ===
- Audience: ${narrativeData?.context?.audience || 'not yet defined'}
- Core message: ${narrativeData?.context?.coreMessage || 'not yet defined'}
- Persuasion goal: ${narrativeData?.context?.goal || 'not yet defined'}
- Success signal: ${narrativeData?.context?.successSignal || 'not yet defined'}
- Constraints: ${narrativeData?.context?.constraints || 'none specified'}

=== ORGANIZATION CONTEXT ===
${orgContext}
=== END CONTEXT ===

Generate a consulting-grade first draft. Everything is a proposal for user review.
Identify the most persuasive message pillars (each pillar makes ONE claim/message and is backed by
concrete proof points). For EACH pillar assess how strongly it will resonate with the named audience
(high/medium/low) and capture the drivers behind it. Then weave storyline threads (each thread links
several pillars into a coherent argument), choose delivery moves (open / build / prove / cta /
reframe) that sequence how the narrative is delivered, then synthesize outputs, an executive summary,
and initiatives. Ground every claim in the organization context above. Explicitly flag any claim or
assumption you cannot ground in the context (label it as a hypothesis) — do NOT invent specific
numbers or external facts you cannot support.

Return one JSON object with this exact structure:
{
  "signals": [
    {"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["audience"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}
  ],
  "pillars": [
    {"title": "...", "message": "...", "proofPoints": ["..."], "audienceResonance": "high|medium|low", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5}
  ],
  "threads": [
    {"title": "...", "pillarIds": [], "insight": "...", "priority": "high|medium|low", "urgency": "high|medium|low", "recommendation": "...", "confidence": 1-5}
  ],
  "moves": [
    {"title": "...", "category": "open|build|prove|cta|reframe", "rationale": "...", "linkedThreadIds": [], "linkedPillarIds": [], "expectedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "riskLevel": "high|medium|low", "confidence": 1-5, "firstStep": "..."}
  ],
  "outputCandidates": [
    {"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "rationale": "...", "linkedPillarIds": [], "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}
  ],
  "summary": {
    "executiveSummary": "...",
    "keyInsights": ["..."],
    "appliedConclusions": ["..."]
  },
  "initiatives": [
    {"title": "...", "description": "...", "type": "strategic|operational|defensive|growth", "rationale": "...", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "linkedItems": []}
  ]
}`;
}

export function buildNarrativeEngineThreadsPrompt(
  narrativeData: NarrativeEngineData
): string | null {
  const pillars = (narrativeData.pillars || [])
    .map((pillar) => {
      if (!pillar) return '';
      return `- [${pillar.id}] ${pillar.title}: message="${pillar.message}", resonance=${pillar.audienceResonance}, proofPoints: ${(pillar.proofPoints || []).join('; ')}; drivers: ${(pillar.drivers || []).join('; ')}`;
    })
    .filter(Boolean)
    .join('\n');

  if (!pillars.trim()) return null;

  return `Act as a strategy consultant. Convert these message pillars (each makes one claim backed by proof points and rated for audience resonance) into storyline threads and recommended delivery moves.

${pillars}

Return JSON:
{
  "threads": [{"title":"...","pillarIds":[],"insight":"...","priority":"high|medium|low","urgency":"high|medium|low","recommendation":"...","confidence":4}],
  "moves": [{"title":"...","category":"open|build|prove|cta|reframe","rationale":"...","linkedThreadIds":[],"linkedPillarIds":[],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}]
}`;
}

export function buildNarrativeEngineRethinkPrompt(
  narrativeData: NarrativeEngineData,
  cardType: string,
  cardId: string,
  userComment?: string
): string {
  let cardContent = '';
  if (cardType === 'signal') {
    const signal = narrativeData.signals.find((item) => item.id === cardId);
    cardContent = signal ? `[${signal.type}] ${signal.content}` : '';
  } else if (cardType === 'pillar') {
    const pillar = narrativeData.pillars.find((item) => item.id === cardId);
    cardContent = pillar
      ? `${pillar.title}: message="${pillar.message}", resonance=${pillar.audienceResonance}, proofPoints: ${(pillar.proofPoints || []).join('; ')}, drivers: ${(pillar.drivers || []).join('; ')}`
      : '';
  } else if (cardType === 'thread') {
    const thread = narrativeData.threads.find((item) => item.id === cardId);
    cardContent = thread ? `${thread.title}: ${thread.insight}` : '';
  } else if (cardType === 'move') {
    const move = narrativeData.recommendedMoves.find((item) => item.id === cardId);
    cardContent = move ? `${move.title}: ${move.rationale}` : '';
  } else if (cardType === 'output-candidate') {
    const output = narrativeData.outputCandidates.find((item) => item.id === cardId);
    cardContent = output ? `${output.title}: ${output.description}` : '';
  } else if (cardType === 'conclusion') {
    cardContent = JSON.stringify(narrativeData.summary || {}, null, 2);
  }

  return `The user wants you to rethink this Narrative Engine ${cardType} card.

Current card:
${cardContent}

User feedback: ${userComment || 'Please improve it.'}

Narrative engine context:
- Audience: ${narrativeData.context.audience || 'N/A'}
- Core message: ${narrativeData.context.coreMessage || 'N/A'}

Return JSON with improved fields for the same card type.`;
}

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cleanStringIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];

const proposalStatus: ProposalStatus = 'ai-proposed';

export function applyNarrativeEnginePendingAction({
  pendingAction,
  parsed,
  currentStepId,
  narrativeData,
  rethinkTarget,
  toolType,
  actions,
}: ApplyNarrativeEnginePendingActionOptions): { clearRethinkTarget?: boolean } {
  if (pendingAction === 'rethink' && rethinkTarget) {
    actions.updateCardAfterRethink(rethinkTarget.cardType, rethinkTarget.cardId, parsed);
    return { clearRethinkTarget: true };
  }

  if (pendingAction === 'suggestions' && currentStepId === 'mission') {
    const mission = parsed.mission && typeof parsed.mission === 'object' ? parsed.mission : parsed;
    actions.updateInputData({
      context: {
        ...narrativeData.context,
        audience: mission.audience || narrativeData.context.audience,
        coreMessage: mission.coreMessage || narrativeData.context.coreMessage,
        goal: mission.goal || narrativeData.context.goal,
        successSignal: mission.successSignal || narrativeData.context.successSignal,
        constraints: mission.constraints || narrativeData.context.constraints,
        assumptions: mission.assumptions || narrativeData.context.assumptions,
        kpiTarget: mission.kpiTarget || narrativeData.context.kpiTarget,
      },
    });
    return {};
  }

  if (pendingAction === 'suggestions' && currentStepId === 'input') {
    const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
    actions.updateInputData({
      signals: [
        ...(narrativeData.signals || []),
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
    (pendingAction === 'suggestions' && currentStepId === 'pillars') ||
    pendingAction === 'full-session'
  ) {
    const pillars = Array.isArray(parsed.pillars) ? parsed.pillars : [];
    if (pillars.length > 0) {
      actions.updateInputData({
        pillars: [
          ...(narrativeData.pillars || []),
          ...pillars
            .filter((pillar) => pillar?.title)
            .map((pillar) => ({
              id: makeId('pillar'),
              title: String(pillar.title),
              message: typeof pillar.message === 'string' ? pillar.message : '',
              proofPoints: Array.isArray(pillar.proofPoints)
                ? pillar.proofPoints.filter(Boolean)
                : [],
              audienceResonance: ['high', 'medium', 'low'].includes(pillar.audienceResonance)
                ? pillar.audienceResonance
                : 'medium',
              drivers: Array.isArray(pillar.drivers) ? pillar.drivers.filter(Boolean) : [],
              evidence: Array.isArray(pillar.evidence) ? pillar.evidence.filter(Boolean) : [],
              implication:
                typeof pillar.implication === 'string' ? pillar.implication : undefined,
              confidence: typeof pillar.confidence === 'number' ? pillar.confidence : 3,
              proposalStatus,
            })),
        ],
      });
    }
  }

  if (
    pendingAction === 'correlations' ||
    pendingAction === 'summary' ||
    pendingAction === 'full-session'
  ) {
    const threads = Array.isArray(parsed.threads) ? parsed.threads : [];
    const moves = Array.isArray(parsed.moves) ? parsed.moves : [];
    actions.updateInputData({
      ...(threads.length > 0
        ? {
            threads: threads
              .filter((item) => item?.title && item?.insight)
              .map((item) => ({
                id: makeId('thread'),
                title: item.title,
                pillarIds: cleanStringIds(item.pillarIds),
                insight: item.insight,
                priority: ['high', 'medium', 'low'].includes(item.priority)
                  ? item.priority
                  : 'medium',
                urgency: ['high', 'medium', 'low'].includes(item.urgency) ? item.urgency : 'medium',
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
                category: ['open', 'build', 'prove', 'cta', 'reframe'].includes(move.category)
                  ? move.category
                  : 'build',
                rationale: move.rationale || '',
                linkedThreadIds: cleanStringIds(move.linkedThreadIds),
                linkedPillarIds: cleanStringIds(move.linkedPillarIds),
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
        proposalId: 'narrative-engine-summary',
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
          linkedMoveIds: cleanStringIds(candidate.linkedMoveIds),
          linkedPillarIds: cleanStringIds(candidate.linkedPillarIds),
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
