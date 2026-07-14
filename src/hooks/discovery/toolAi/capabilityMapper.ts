import type {
  CapabilityMapperData,
  InitiativeDraft,
  ProposalStatus,
  ToolType,
} from '@/store/useToolStore';

import type { ToolAiPendingAction } from './dynamicSwot';
import { GROUNDING_RULES_BOTH } from './groundingRules';
import { pickW2SummaryFields } from './w2SummaryFields';
interface CapabilityMapperActionHandlers {
  updateInputData: (data: Partial<CapabilityMapperData>) => void;
  setInitiatives: (initiatives: Omit<InitiativeDraft, 'id'>[]) => void;
  setSessionGenerationStatus: (status: 'idle' | 'generating' | 'ready' | 'error') => void;
  updateCardAfterRethink: (cardType: any, cardId: string, updates: Record<string, unknown>) => void;
}

interface ApplyCapabilityMapperPendingActionOptions {
  pendingAction: ToolAiPendingAction;
  parsed: Record<string, any>;
  currentStepId?: string;
  capabilityData: CapabilityMapperData;
  rethinkTarget?: { cardType: string; cardId: string } | null;
  toolType: ToolType;
  actions: CapabilityMapperActionHandlers;
}

export function buildCapabilityMapperFullSessionPrompt(
  capabilityData: CapabilityMapperData | undefined,
  orgContext: string
): string {
  return `You are a senior strategy consultant running a Capability Mapper session.
The client wants to map organizational capabilities, score the gap between current and target
maturity, and decide where to build, buy, partner, or sustain. Produce a COMPLETE first-draft
Capability Mapper session.

=== CAPABILITY MAPPER BRIEF ===
- Industry / market: ${capabilityData?.context?.industry || 'not yet defined'}
- Capability domains in scope: ${capabilityData?.context?.capabilityDomains || 'not yet defined'}
- Strategic priorities: ${capabilityData?.context?.strategicPriorities || 'not yet defined'}
- Decision question: ${capabilityData?.context?.goal || 'not yet defined'}
- Success signal: ${capabilityData?.context?.successSignal || 'not yet defined'}
- Constraints: ${capabilityData?.context?.constraints || 'none specified'}

=== ORGANIZATION CONTEXT ===
${orgContext}
=== END CONTEXT ===

Generate a consulting-grade first draft. Everything is a proposal for user review.
Identify the most strategically relevant organizational capabilities (group them by domain, e.g.
technology, talent, processes, data, partnerships). Score EACH capability on current maturity (1-5),
target maturity (1-5), and strategic importance (high/medium/low). The methodology: gap =
(targetMaturity - currentMaturity) weighted by importance → classify gapSize as critical, moderate,
or minor. For each capability recommend a sourcing strategy (build / buy / partner / sustain) given
its gap and importance. Then synthesize capability gaps (prioritized), recommended moves
(build/buy/partner roadmap), outputs, an executive summary, and initiatives. Ground every claim in
the organization context above. Explicitly flag any benchmark or assumption you cannot ground in the
context (label it as a hypothesis) — do NOT invent specific numbers or external benchmarks you
cannot support.


${GROUNDING_RULES_BOTH}
Return one JSON object with this exact structure:
{
  "signals": [
    {"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["technology"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}
  ],
  "capabilities": [
    {"name": "...", "domain": "technology|talent|processes|data|partnerships|...", "currentMaturity": 1-5, "targetMaturity": 1-5, "importance": "high|medium|low", "gapSize": "critical|moderate|minor", "sourcing": "build|buy|partner|sustain", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5}
  ],
  "gaps": [
    {"title": "...", "capabilityIds": [], "insight": "...", "priority": "high|medium|low", "urgency": "high|medium|low", "recommendation": "...", "confidence": 1-5}
  ],
  "moves": [
    {"title": "...", "category": "build|buy|partner|reskill|restructure", "rationale": "...", "linkedGapIds": [], "linkedCapabilityIds": [], "expectedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "riskLevel": "high|medium|low", "confidence": 1-5, "firstStep": "..."}
  ],
  "outputCandidates": [
    {"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "rationale": "...", "linkedCapabilityIds": [], "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}
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

export function buildCapabilityMapperGapsPrompt(
  capabilityData: CapabilityMapperData
): string | null {
  const capabilities = (capabilityData.capabilities || [])
    .map((capability) => {
      if (!capability) return '';
      return `- [${capability.id}] ${capability.name} (${capability.domain}): current=${capability.currentMaturity}/5, target=${capability.targetMaturity}/5, importance=${capability.importance}, gapSize=${capability.gapSize || 'n/a'}, sourcing=${capability.sourcing || 'n/a'}; drivers: ${(capability.drivers || []).join('; ')}`;
    })
    .filter(Boolean)
    .join('\n');

  if (!capabilities.trim()) return null;

  return `Act as a strategy consultant. Convert this Capability Maturity scorecard (each capability scored on current vs target maturity and strategic importance, with a build/buy/partner/sustain sourcing recommendation) into prioritized capability gaps and recommended moves.

${capabilities}

Return JSON:
{
  "gaps": [{"title":"...","capabilityIds":[],"insight":"...","priority":"high|medium|low","urgency":"high|medium|low","recommendation":"...","confidence":4}],
  "moves": [{"title":"...","category":"build|buy|partner|reskill|restructure","rationale":"...","linkedGapIds":[],"linkedCapabilityIds":[],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}]
}`;
}

export function buildCapabilityMapperRethinkPrompt(
  capabilityData: CapabilityMapperData,
  cardType: string,
  cardId: string,
  userComment?: string
): string {
  let cardContent = '';
  if (cardType === 'signal') {
    const signal = capabilityData.signals.find((item) => item.id === cardId);
    cardContent = signal ? `[${signal.type}] ${signal.content}` : '';
  } else if (cardType === 'capability') {
    const capability = capabilityData.capabilities.find((item) => item.id === cardId);
    cardContent = capability
      ? `${capability.name} (${capability.domain}): current=${capability.currentMaturity}/5, target=${capability.targetMaturity}/5, importance=${capability.importance}, sourcing=${capability.sourcing || 'n/a'}, drivers: ${(capability.drivers || []).join('; ')}`
      : '';
  } else if (cardType === 'gap') {
    const gap = capabilityData.gaps.find((item) => item.id === cardId);
    cardContent = gap ? `${gap.title}: ${gap.insight}` : '';
  } else if (cardType === 'move') {
    const move = capabilityData.recommendedMoves.find((item) => item.id === cardId);
    cardContent = move ? `${move.title}: ${move.rationale}` : '';
  } else if (cardType === 'output-candidate') {
    const output = capabilityData.outputCandidates.find((item) => item.id === cardId);
    cardContent = output ? `${output.title}: ${output.description}` : '';
  } else if (cardType === 'conclusion') {
    cardContent = JSON.stringify(capabilityData.summary || {}, null, 2);
  }

  return `The user wants you to rethink this Capability Mapper ${cardType} card.

Current card:
${cardContent}

User feedback: ${userComment || 'Please improve it.'}

Capability mapper context:
- Industry: ${capabilityData.context.industry || 'N/A'}
- Capability domains: ${capabilityData.context.capabilityDomains || 'N/A'}

Return JSON with improved fields for the same card type.`;
}

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cleanStringIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];

const proposalStatus: ProposalStatus = 'ai-proposed';

const clampMaturity = (value: unknown, fallback: number): number =>
  typeof value === 'number' && value >= 1 && value <= 5 ? Math.round(value) : fallback;

export function applyCapabilityMapperPendingAction({
  pendingAction,
  parsed,
  currentStepId,
  capabilityData,
  rethinkTarget,
  toolType,
  actions,
}: ApplyCapabilityMapperPendingActionOptions): { clearRethinkTarget?: boolean } {
  if (pendingAction === 'rethink' && rethinkTarget) {
    actions.updateCardAfterRethink(rethinkTarget.cardType, rethinkTarget.cardId, parsed);
    return { clearRethinkTarget: true };
  }

  if (pendingAction === 'suggestions' && currentStepId === 'mission') {
    const mission = parsed.mission && typeof parsed.mission === 'object' ? parsed.mission : parsed;
    actions.updateInputData({
      context: {
        ...capabilityData.context,
        industry: mission.industry || capabilityData.context.industry,
        capabilityDomains: mission.capabilityDomains || capabilityData.context.capabilityDomains,
        strategicPriorities:
          mission.strategicPriorities || capabilityData.context.strategicPriorities,
        goal: mission.goal || capabilityData.context.goal,
        successSignal: mission.successSignal || capabilityData.context.successSignal,
        constraints: mission.constraints || capabilityData.context.constraints,
        assumptions: mission.assumptions || capabilityData.context.assumptions,
        kpiTarget: mission.kpiTarget || capabilityData.context.kpiTarget,
      },
    });
    return {};
  }

  if (pendingAction === 'suggestions' && currentStepId === 'input') {
    const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
    actions.updateInputData({
      signals: [
        ...(capabilityData.signals || []),
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
    (pendingAction === 'suggestions' && currentStepId === 'capabilities') ||
    pendingAction === 'full-session'
  ) {
    const capabilities = Array.isArray(parsed.capabilities) ? parsed.capabilities : [];
    if (capabilities.length > 0) {
      actions.updateInputData({
        capabilities: [
          ...(capabilityData.capabilities || []),
          ...capabilities
            .filter((capability) => capability?.name)
            .map((capability) => ({
              id: makeId('capability'),
              name: String(capability.name),
              domain: String(capability.domain || 'general'),
              currentMaturity: clampMaturity(capability.currentMaturity, 1),
              targetMaturity: clampMaturity(capability.targetMaturity, 3),
              importance: ['high', 'medium', 'low'].includes(capability.importance)
                ? capability.importance
                : 'medium',
              gapSize: ['critical', 'moderate', 'minor'].includes(capability.gapSize)
                ? capability.gapSize
                : undefined,
              sourcing: ['build', 'buy', 'partner', 'sustain'].includes(capability.sourcing)
                ? capability.sourcing
                : undefined,
              drivers: Array.isArray(capability.drivers) ? capability.drivers.filter(Boolean) : [],
              evidence: Array.isArray(capability.evidence)
                ? capability.evidence.filter(Boolean)
                : [],
              implication:
                typeof capability.implication === 'string' ? capability.implication : undefined,
              confidence: typeof capability.confidence === 'number' ? capability.confidence : 3,
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
    const gaps = Array.isArray(parsed.gaps) ? parsed.gaps : [];
    const moves = Array.isArray(parsed.moves) ? parsed.moves : [];
    actions.updateInputData({
      ...(gaps.length > 0
        ? {
            gaps: gaps
              .filter((item) => item?.title && item?.insight)
              .map((item) => ({
                id: makeId('gap'),
                title: item.title,
                capabilityIds: cleanStringIds(item.capabilityIds),
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
                category: ['build', 'buy', 'partner', 'reskill', 'restructure'].includes(
                  move.category
                )
                  ? move.category
                  : 'build',
                rationale: move.rationale || '',
                linkedGapIds: cleanStringIds(move.linkedGapIds),
                linkedCapabilityIds: cleanStringIds(move.linkedCapabilityIds),
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
        proposalId: 'capability-mapper-summary',
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
          linkedCapabilityIds: cleanStringIds(candidate.linkedCapabilityIds),
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
