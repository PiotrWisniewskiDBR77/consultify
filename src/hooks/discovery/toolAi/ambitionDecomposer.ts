import type {
  AmbitionDecomposerData,
  InitiativeDraft,
  ProposalStatus,
  ToolType,
} from '@/store/useToolStore';

import type { ToolAiPendingAction } from './dynamicSwot';
import { GROUNDING_RULES_BOTH } from './groundingRules';
import { pickW2SummaryFields } from './w2SummaryFields';
interface AmbitionDecomposerActionHandlers {
  updateInputData: (data: Partial<AmbitionDecomposerData>) => void;
  setInitiatives: (initiatives: Omit<InitiativeDraft, 'id'>[]) => void;
  setSessionGenerationStatus: (status: 'idle' | 'generating' | 'ready' | 'error') => void;
  updateCardAfterRethink: (cardType: any, cardId: string, updates: Record<string, unknown>) => void;
}

interface ApplyAmbitionDecomposerPendingActionOptions {
  pendingAction: ToolAiPendingAction;
  parsed: Record<string, any>;
  currentStepId?: string;
  ambitionData: AmbitionDecomposerData;
  rethinkTarget?: { cardType: string; cardId: string } | null;
  toolType: ToolType;
  actions: AmbitionDecomposerActionHandlers;
}

export function buildAmbitionDecomposerFullSessionPrompt(
  ambitionData: AmbitionDecomposerData | undefined,
  orgContext: string
): string {
  return `You are a senior strategy consultant running an Ambition Decomposer session.
The client has a big, ambitious goal and wants to cascade it into strategic themes with measurable
targets, prioritize those themes, and decide the enabling moves that will deliver the ambition.
Produce a COMPLETE first-draft Ambition Decomposer session.

=== AMBITION DECOMPOSER BRIEF ===
- Ambition statement: ${ambitionData?.context?.ambitionStatement || 'not yet defined'}
- Scope in focus: ${ambitionData?.context?.scope || 'not yet defined'}
- Decision question / goal: ${ambitionData?.context?.goal || 'not yet defined'}
- Success signal: ${ambitionData?.context?.successSignal || 'not yet defined'}
- KPI target: ${ambitionData?.context?.kpiTarget || 'not yet defined'}
- Constraints: ${ambitionData?.context?.constraints || 'none specified'}
- Assumptions: ${ambitionData?.context?.assumptions || 'none specified'}

=== ORGANIZATION CONTEXT ===
${orgContext}
=== END CONTEXT ===

Generate a consulting-grade first draft. Everything is a proposal for user review.
Decompose the ambition into the most strategically relevant THEMES — the distinct workstreams that
together deliver the ambition. For EACH theme define a measurable target: a clear targetMetric (what
to measure) and a targetValue (the goal value), a delivery horizon (short / medium / long), and a
strategic importance (high / medium / low). The methodology: a theme with high importance and a
demanding target on a short horizon rises to the top of the priority stack. For each theme capture
the drivers behind it. Then synthesize prioritized PRIORITIES (which themes to attack first and why),
recommended MOVES (the enabling moves — foundation / accelerator / bet / enabler / quick-win — that
deliver the priorities), outputs, an executive summary, and initiatives. Ground every claim in the
organization context above. Explicitly flag any benchmark or assumption you cannot ground in the
context (label it as a hypothesis) — do NOT invent specific numbers or external benchmarks you
cannot support.


${GROUNDING_RULES_BOTH}
Return one JSON object with this exact structure:
{
  "signals": [
    {"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["growth"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}
  ],
  "themes": [
    {"title": "...", "description": "...", "targetMetric": "...", "targetValue": "...", "horizon": "short|medium|long", "importance": "high|medium|low", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5}
  ],
  "priorities": [
    {"title": "...", "themeIds": [], "insight": "...", "priority": "high|medium|low", "urgency": "high|medium|low", "recommendation": "...", "confidence": 1-5}
  ],
  "moves": [
    {"title": "...", "category": "foundation|accelerator|bet|enabler|quick-win", "rationale": "...", "linkedPriorityIds": [], "linkedThemeIds": [], "expectedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "riskLevel": "high|medium|low", "confidence": 1-5, "firstStep": "..."}
  ],
  "outputCandidates": [
    {"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "rationale": "...", "linkedMoveIds": [], "linkedThemeIds": [], "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}
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

export function buildAmbitionDecomposerPrioritiesPrompt(
  ambitionData: AmbitionDecomposerData
): string | null {
  const themes = (ambitionData.themes || [])
    .map((theme) => {
      if (!theme) return '';
      return `- [${theme.id}] ${theme.title}: target ${theme.targetMetric}=${theme.targetValue}, horizon=${theme.horizon}, importance=${theme.importance}; drivers: ${(theme.drivers || []).join('; ')}`;
    })
    .filter(Boolean)
    .join('\n');

  if (!themes.trim()) return null;

  return `Act as a strategy consultant. Convert this set of ambition themes (each with a measurable target — targetMetric and targetValue — a delivery horizon, and a strategic importance) into prioritized priorities and the enabling moves that deliver them.

${themes}

Return JSON:
{
  "priorities": [{"title":"...","themeIds":[],"insight":"...","priority":"high|medium|low","urgency":"high|medium|low","recommendation":"...","confidence":4}],
  "moves": [{"title":"...","category":"foundation|accelerator|bet|enabler|quick-win","rationale":"...","linkedPriorityIds":[],"linkedThemeIds":[],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}]
}`;
}

export function buildAmbitionDecomposerRethinkPrompt(
  ambitionData: AmbitionDecomposerData,
  cardType: string,
  cardId: string,
  userComment?: string
): string {
  let cardContent = '';
  if (cardType === 'signal') {
    const signal = ambitionData.signals.find((item) => item.id === cardId);
    cardContent = signal ? `[${signal.type}] ${signal.content}` : '';
  } else if (cardType === 'theme') {
    const theme = ambitionData.themes.find((item) => item.id === cardId);
    cardContent = theme
      ? `${theme.title}: ${theme.description}; target ${theme.targetMetric}=${theme.targetValue}, horizon=${theme.horizon}, importance=${theme.importance}, drivers: ${(theme.drivers || []).join('; ')}`
      : '';
  } else if (cardType === 'priority') {
    const priority = ambitionData.priorities.find((item) => item.id === cardId);
    cardContent = priority ? `${priority.title}: ${priority.insight}` : '';
  } else if (cardType === 'move') {
    const move = ambitionData.recommendedMoves.find((item) => item.id === cardId);
    cardContent = move ? `${move.title}: ${move.rationale}` : '';
  } else if (cardType === 'output-candidate') {
    const output = ambitionData.outputCandidates.find((item) => item.id === cardId);
    cardContent = output ? `${output.title}: ${output.description}` : '';
  } else if (cardType === 'conclusion') {
    cardContent = JSON.stringify(ambitionData.summary || {}, null, 2);
  }

  return `The user wants you to rethink this Ambition Decomposer ${cardType} card.

Current card:
${cardContent}

User feedback: ${userComment || 'Please improve it.'}

Ambition decomposer context:
- Ambition: ${ambitionData.context.ambitionStatement || 'N/A'}
- Scope: ${ambitionData.context.scope || 'N/A'}

Return JSON with improved fields for the same card type.`;
}

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cleanStringIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];

const proposalStatus: ProposalStatus = 'ai-proposed';

export function applyAmbitionDecomposerPendingAction({
  pendingAction,
  parsed,
  currentStepId,
  ambitionData,
  rethinkTarget,
  toolType,
  actions,
}: ApplyAmbitionDecomposerPendingActionOptions): { clearRethinkTarget?: boolean } {
  if (pendingAction === 'rethink' && rethinkTarget) {
    actions.updateCardAfterRethink(rethinkTarget.cardType, rethinkTarget.cardId, parsed);
    return { clearRethinkTarget: true };
  }

  if (pendingAction === 'suggestions' && currentStepId === 'mission') {
    const mission = parsed.mission && typeof parsed.mission === 'object' ? parsed.mission : parsed;
    actions.updateInputData({
      context: {
        ...ambitionData.context,
        ambitionStatement: mission.ambitionStatement || ambitionData.context.ambitionStatement,
        scope: mission.scope || ambitionData.context.scope,
        goal: mission.goal || ambitionData.context.goal,
        successSignal: mission.successSignal || ambitionData.context.successSignal,
        constraints: mission.constraints || ambitionData.context.constraints,
        assumptions: mission.assumptions || ambitionData.context.assumptions,
        kpiTarget: mission.kpiTarget || ambitionData.context.kpiTarget,
      },
    });
    return {};
  }

  if (pendingAction === 'suggestions' && currentStepId === 'input') {
    const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
    actions.updateInputData({
      signals: [
        ...(ambitionData.signals || []),
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
    (pendingAction === 'suggestions' && currentStepId === 'themes') ||
    pendingAction === 'full-session'
  ) {
    const themes = Array.isArray(parsed.themes) ? parsed.themes : [];
    if (themes.length > 0) {
      actions.updateInputData({
        themes: [
          ...(ambitionData.themes || []),
          ...themes
            .filter((theme) => theme?.title)
            .map((theme) => ({
              id: makeId('theme'),
              title: String(theme.title),
              description: typeof theme.description === 'string' ? theme.description : '',
              targetMetric: typeof theme.targetMetric === 'string' ? theme.targetMetric : '',
              targetValue: typeof theme.targetValue === 'string' ? theme.targetValue : '',
              horizon: ['short', 'medium', 'long'].includes(theme.horizon)
                ? theme.horizon
                : 'medium',
              importance: ['high', 'medium', 'low'].includes(theme.importance)
                ? theme.importance
                : 'medium',
              drivers: Array.isArray(theme.drivers) ? theme.drivers.filter(Boolean) : [],
              evidence: Array.isArray(theme.evidence) ? theme.evidence.filter(Boolean) : [],
              implication: typeof theme.implication === 'string' ? theme.implication : undefined,
              confidence: typeof theme.confidence === 'number' ? theme.confidence : 3,
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
    const priorities = Array.isArray(parsed.priorities) ? parsed.priorities : [];
    const moves = Array.isArray(parsed.moves) ? parsed.moves : [];
    actions.updateInputData({
      ...(priorities.length > 0
        ? {
            priorities: priorities
              .filter((item) => item?.title && item?.insight)
              .map((item) => ({
                id: makeId('priority'),
                title: item.title,
                themeIds: cleanStringIds(item.themeIds),
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
                category: ['foundation', 'accelerator', 'bet', 'enabler', 'quick-win'].includes(
                  move.category
                )
                  ? move.category
                  : 'foundation',
                rationale: move.rationale || '',
                linkedPriorityIds: cleanStringIds(move.linkedPriorityIds),
                linkedThemeIds: cleanStringIds(move.linkedThemeIds),
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
        proposalId: 'ambition-decomposer-summary',
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
          linkedMoveIds: cleanStringIds(candidate.linkedMoveIds),
          linkedThemeIds: cleanStringIds(candidate.linkedThemeIds),
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
