import { buildFocusLadderPromptBlock } from '@/config/focustradeoffs/focusQuestionBank';
import type {
  FocusTradeoffData,
  InitiativeDraft,
  ProposalStatus,
  ToolType,
} from '@/store/useToolStore';

import type { ToolAiPendingAction } from './dynamicSwot';
import { GROUNDING_RULES_BOTH } from './groundingRules';
import { pickW2SummaryFields } from './w2SummaryFields';

const FOCUS_HARD_RULES_BLOCK = `HARD RULES (CONCLUSION_LAYER_STANDARD §4):
- You are a partner at a consulting firm (HBS, MBA, 10 years of practice). You sign this output in front of the client's board.
- Numbers and facts EXCLUSIVELY from the facts/signals block. Never compute, never estimate, never quote statistics from outside the input.
- Level 3 of the ladder (forced trade-off) is MANDATORY: an option cannot be scored "pursue" without naming a specific OTHER option on the list that loses attention/budget because of it — "we will do both" is the anti-focus failure mode this tool exists to catch.
- Answer-first (Minto): lead with which option wins scarce attention, then the evidence.
- Respond in the user's language (Polish or English) — professional partner tone, active voice.`;

/**
 * Conversation-layer protocol appended to the system prompt for the Focus &
 * Trade-offs "priorities" step: the mentor in chat interviews with the SAME
 * laddered question bank as the wizard (single source of truth), one
 * competing option at a time, branching on answers. Mirrors
 * buildDynamicSwotConversationProtocol / buildMarketForcesConversationProtocol
 * / buildPortfolioConversationProtocol — this tool had the ladder content
 * (focusQuestionBank.ts) and a per-option prompt builder
 * (buildFocusOptionLadderPrompt below) but was never wired into the live chat
 * mentor (O3 audit gap, closed here). Returns '' for other steps so it is a
 * no-op there.
 */
export function buildFocusTradeoffConversationProtocol(
  stepId: string | undefined,
  language: 'pl' | 'en' = 'en'
): string {
  if (stepId !== 'priorities') return '';
  const ladder = buildFocusLadderPromptBlock(language);
  return `

INTERVIEW PROTOCOL (laddered focus/trade-off question bank — the single source of truth for this step):
When the user explores a competing option/direction in conversation, walk this ladder. Ask ONE question at a time; classify the answer into a branch key and follow the branch. Vague answer -> use the probe. Dig from surface -> evidence -> FORCED trade-off (name the specific alternative that loses) -> rejection justification. Do not accept level 3 without a NAMED alternative option — re-ask using the probe if the user says "everything" or names nothing. When a ladder path completes, propose the priority's scores (value/effort/fit) with its insight staircase and the named trade-off.

${ladder}`;
}

/**
 * Laddered interview prompt for ONE competing option: the AI mentor walks the
 * q-bank (single source of truth with the wizard) — surface -> evidence ->
 * FORCED trade-off -> rejection justification — one question at a time,
 * branching on answers. Mirrors buildMarketForcesForceLadderPrompt in
 * marketForces.ts. Exported for the future interview-step wiring; the
 * "priorities" step now also gets the ladder via
 * buildFocusTradeoffConversationProtocol above (wired into useToolAI.ts's
 * sendMessage), mirroring how Porter keeps both a per-force prompt AND a
 * conversation-protocol wrapper.
 */
export function buildFocusOptionLadderPrompt(
  focusData: FocusTradeoffData | undefined,
  language: 'pl' | 'en' = 'en'
): string {
  const ladder = buildFocusLadderPromptBlock(language);
  const competing = focusData?.context?.competingPriorities || 'not yet defined';

  return `You are interviewing the client about ONE competing option/direction (of: ${competing}). Use the laddered question bank below as your interview protocol — it is the single source of truth. Ask ONE question at a time, then branch on the answer using the branch keys.

QUESTION LADDER:
${ladder}

INTERVIEW RULES:
- Start at the level-1 question (opt1-surface) unless the ladder position is already known from the conversation.
- Classify the user's answer into one of the branch keys and follow that branch. If the answer is vague, use the probe before moving on.
- Dig from surface -> evidence -> FORCED trade-off (name the specific alternative that loses) -> rejection justification. Do not accept level 3 without a NAMED alternative option — re-ask using the probe if the user says "everything" or names nothing.
- When the ladder completes, propose the priority's scores (value/effort/fit) WITH its insight staircase and the named trade-off.

${FOCUS_HARD_RULES_BLOCK}

When proposing the priority verdict, return JSON:
{"title":"...","valueScore":1-5,"effortScore":1-5,"strategicFit":1-5,"recommendation":"pursue|defer|drop","staircase":{"fact":"...","factRefs":["signal-id"],"interpretation":"...","implication":"..."},"drivers":[{"dimension":"evidence-strength|strategic-fit|resource-scarcity|timing-window","finding":"..."}],"forcedTradeoff":{"rejectedOptionTitle":"...","justification":"..."},"ladderAnswers":[{"questionId":"...","answerKey":"...","note":"..."}]}`;
}

interface FocusTradeoffActionHandlers {
  updateInputData: (data: Partial<FocusTradeoffData>) => void;
  setInitiatives: (initiatives: Omit<InitiativeDraft, 'id'>[]) => void;
  setSessionGenerationStatus: (status: 'idle' | 'generating' | 'ready' | 'error') => void;
  updateCardAfterRethink: (cardType: any, cardId: string, updates: Record<string, unknown>) => void;
}

interface ApplyFocusTradeoffPendingActionOptions {
  pendingAction: ToolAiPendingAction;
  parsed: Record<string, any>;
  currentStepId?: string;
  focusData: FocusTradeoffData;
  rethinkTarget?: { cardType: string; cardId: string } | null;
  toolType: ToolType;
  actions: FocusTradeoffActionHandlers;
}

export function buildFocusTradeoffFullSessionPrompt(
  focusData: FocusTradeoffData | undefined,
  orgContext: string
): string {
  return `You are a senior strategy consultant running a Focus & Trade-offs session.
The client wants to score competing priorities on value, effort, and strategic fit, surface the
trade-offs between them, and decide where to focus — commit, sequence, or cut. Produce a COMPLETE
first-draft Focus & Trade-offs session.

=== FOCUS & TRADE-OFFS BRIEF ===
- Competing priorities: ${focusData?.context?.competingPriorities || 'not yet defined'}
- Decision criteria: ${focusData?.context?.decisionCriteria || 'not yet defined'}
- Decision question / goal: ${focusData?.context?.goal || 'not yet defined'}
- Success signal: ${focusData?.context?.successSignal || 'not yet defined'}
- Constraints: ${focusData?.context?.constraints || 'none specified'}

=== ORGANIZATION CONTEXT ===
${orgContext}
=== END CONTEXT ===

Generate a consulting-grade first draft. Everything is a proposal for user review.
Identify the most strategically relevant competing priorities. Score EACH priority on strategic
value (1-5), effort/cost (1-5), and strategic fit (1-5). The methodology: high value + low effort +
high fit favors pursuing; low value or weak fit favors dropping; everything else is a candidate to
defer. For each priority recommend pursue / defer / drop given its scores. Then synthesize the key
trade-offs between priorities (where pursuing one starves another), recommended focus moves
(commit / sequence / cut / rebalance / experiment), outputs, an executive summary, and initiatives.
Ground every claim in the organization context above. Explicitly flag any benchmark or assumption
you cannot ground in the context (label it as a hypothesis) — do NOT invent specific numbers or
external benchmarks you cannot support.


${GROUNDING_RULES_BOTH}
Return one JSON object with this exact structure:
{
  "signals": [
    {"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["value"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}
  ],
  "priorities": [
    {"title": "...", "description": "...", "valueScore": 1-5, "effortScore": 1-5, "strategicFit": 1-5, "recommendation": "pursue|defer|drop", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5}
  ],
  "tradeoffs": [
    {"title": "...", "priorityIds": [], "insight": "...", "priority": "high|medium|low", "urgency": "high|medium|low", "recommendation": "...", "confidence": 1-5}
  ],
  "moves": [
    {"title": "...", "category": "commit|sequence|cut|rebalance|experiment", "rationale": "...", "linkedTradeoffIds": [], "linkedPriorityIds": [], "expectedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "riskLevel": "high|medium|low", "confidence": 1-5, "firstStep": "..."}
  ],
  "outputCandidates": [
    {"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "rationale": "...", "linkedPriorityIds": [], "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}
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

export function buildFocusTradeoffTradeoffsPrompt(focusData: FocusTradeoffData): string | null {
  const priorities = (focusData.priorities || [])
    .map((priority) => {
      if (!priority) return '';
      return `- [${priority.id}] ${priority.title}: value=${priority.valueScore}/5, effort=${priority.effortScore}/5, fit=${priority.strategicFit}/5, recommendation=${priority.recommendation || 'n/a'}; drivers: ${(priority.drivers || []).join('; ')}`;
    })
    .filter(Boolean)
    .join('\n');

  if (!priorities.trim()) return null;

  return `Act as a strategy consultant. Convert this Focus scorecard (each competing priority scored on strategic value, effort/cost, and strategic fit, with a pursue/defer/drop recommendation) into key trade-offs and recommended focus moves.

${priorities}

Return JSON:
{
  "tradeoffs": [{"title":"...","priorityIds":[],"insight":"...","priority":"high|medium|low","urgency":"high|medium|low","recommendation":"...","confidence":4}],
  "moves": [{"title":"...","category":"commit|sequence|cut|rebalance|experiment","rationale":"...","linkedTradeoffIds":[],"linkedPriorityIds":[],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}]
}`;
}

export function buildFocusTradeoffRethinkPrompt(
  focusData: FocusTradeoffData,
  cardType: string,
  cardId: string,
  userComment?: string
): string {
  let cardContent = '';
  if (cardType === 'signal') {
    const signal = focusData.signals.find((item) => item.id === cardId);
    cardContent = signal ? `[${signal.type}] ${signal.content}` : '';
  } else if (cardType === 'priority') {
    const priority = focusData.priorities.find((item) => item.id === cardId);
    cardContent = priority
      ? `${priority.title}: value=${priority.valueScore}/5, effort=${priority.effortScore}/5, fit=${priority.strategicFit}/5, recommendation=${priority.recommendation || 'n/a'}, drivers: ${(priority.drivers || []).join('; ')}`
      : '';
  } else if (cardType === 'tradeoff') {
    const tradeoff = focusData.tradeoffs.find((item) => item.id === cardId);
    cardContent = tradeoff ? `${tradeoff.title}: ${tradeoff.insight}` : '';
  } else if (cardType === 'move') {
    const move = focusData.recommendedMoves.find((item) => item.id === cardId);
    cardContent = move ? `${move.title}: ${move.rationale}` : '';
  } else if (cardType === 'output-candidate') {
    const output = focusData.outputCandidates.find((item) => item.id === cardId);
    cardContent = output ? `${output.title}: ${output.description}` : '';
  } else if (cardType === 'conclusion') {
    cardContent = JSON.stringify(focusData.summary || {}, null, 2);
  }

  return `The user wants you to rethink this Focus & Trade-offs ${cardType} card.

Current card:
${cardContent}

User feedback: ${userComment || 'Please improve it.'}

Focus & trade-offs context:
- Competing priorities: ${focusData.context.competingPriorities || 'N/A'}
- Decision criteria: ${focusData.context.decisionCriteria || 'N/A'}

Return JSON with improved fields for the same card type.`;
}

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cleanStringIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];

const proposalStatus: ProposalStatus = 'ai-proposed';

const clampScore = (value: unknown, fallback: number): number =>
  typeof value === 'number' && value >= 1 && value <= 5 ? Math.round(value) : fallback;

export function applyFocusTradeoffPendingAction({
  pendingAction,
  parsed,
  currentStepId,
  focusData,
  rethinkTarget,
  toolType,
  actions,
}: ApplyFocusTradeoffPendingActionOptions): { clearRethinkTarget?: boolean } {
  if (pendingAction === 'rethink' && rethinkTarget) {
    actions.updateCardAfterRethink(rethinkTarget.cardType, rethinkTarget.cardId, parsed);
    return { clearRethinkTarget: true };
  }

  if (pendingAction === 'suggestions' && currentStepId === 'mission') {
    const mission = parsed.mission && typeof parsed.mission === 'object' ? parsed.mission : parsed;
    actions.updateInputData({
      context: {
        ...focusData.context,
        competingPriorities: mission.competingPriorities || focusData.context.competingPriorities,
        decisionCriteria: mission.decisionCriteria || focusData.context.decisionCriteria,
        goal: mission.goal || focusData.context.goal,
        successSignal: mission.successSignal || focusData.context.successSignal,
        constraints: mission.constraints || focusData.context.constraints,
        assumptions: mission.assumptions || focusData.context.assumptions,
        kpiTarget: mission.kpiTarget || focusData.context.kpiTarget,
      },
    });
    return {};
  }

  if (pendingAction === 'suggestions' && currentStepId === 'input') {
    const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
    actions.updateInputData({
      signals: [
        ...(focusData.signals || []),
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
    (pendingAction === 'suggestions' && currentStepId === 'priorities') ||
    pendingAction === 'full-session'
  ) {
    const priorities = Array.isArray(parsed.priorities) ? parsed.priorities : [];
    if (priorities.length > 0) {
      actions.updateInputData({
        priorities: [
          ...(focusData.priorities || []),
          ...priorities
            .filter((priority) => priority?.title)
            .map((priority) => ({
              id: makeId('priority'),
              title: String(priority.title),
              description: String(priority.description || ''),
              valueScore: clampScore(priority.valueScore, 3),
              effortScore: clampScore(priority.effortScore, 3),
              strategicFit: clampScore(priority.strategicFit, 3),
              recommendation: ['pursue', 'defer', 'drop'].includes(priority.recommendation)
                ? priority.recommendation
                : 'defer',
              drivers: Array.isArray(priority.drivers) ? priority.drivers.filter(Boolean) : [],
              evidence: Array.isArray(priority.evidence) ? priority.evidence.filter(Boolean) : [],
              implication:
                typeof priority.implication === 'string' ? priority.implication : undefined,
              confidence: typeof priority.confidence === 'number' ? priority.confidence : 3,
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
    const tradeoffs = Array.isArray(parsed.tradeoffs) ? parsed.tradeoffs : [];
    const moves = Array.isArray(parsed.moves) ? parsed.moves : [];
    actions.updateInputData({
      ...(tradeoffs.length > 0
        ? {
            tradeoffs: tradeoffs
              .filter((item) => item?.title && item?.insight)
              .map((item) => ({
                id: makeId('tradeoff'),
                title: item.title,
                priorityIds: cleanStringIds(item.priorityIds),
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
                category: ['commit', 'sequence', 'cut', 'rebalance', 'experiment'].includes(
                  move.category
                )
                  ? move.category
                  : 'commit',
                rationale: move.rationale || '',
                linkedTradeoffIds: cleanStringIds(move.linkedTradeoffIds),
                linkedPriorityIds: cleanStringIds(move.linkedPriorityIds),
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
        proposalId: 'focus-tradeoff-summary',
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
          linkedPriorityIds: cleanStringIds(candidate.linkedPriorityIds),
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
