import { createConsultingMissionContext, type ConsultingMissionContext } from '@/config/consultingToolsStandard';
import type {
  SessionGenerationStatus,
  SWOTCorrelation,
  SWOTData,
  SWOTItem,
  SWOTTension,
  ToolType,
} from '@/store/useToolStore';

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
  setSWOTOutputCandidates: (
    candidates: Omit<SWOTData['outputCandidates'][number], 'id'>[]
  ) => void;
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

export function buildDynamicSwotCorrelationsPrompt(swotData: SWOTData): string | null {
  const items = swotData.items || [];
  if (items.length < 4) return null;

  const itemsSummary = items
    .map(
      (item: SWOTItem) =>
        `[${item.id}] ${item.quadrant.toUpperCase()}: ${item.text} (${item.impact} impact)`
    )
    .join('\n');

  return `Analyze these SWOT items and identify strategic correlations.
Act as an AI strategy mentor: explain the most meaningful tensions, not just mechanically pair items.

${itemsSummary}

Generate 4-6 strategic correlations that connect:
- Strengths with Opportunities (SO) - offensive strategies
- Weaknesses with Opportunities (WO) - reorientation strategies
- Strengths with Threats (ST) - defensive strategies
- Weaknesses with Threats (WT) - survival strategies

Return as JSON:
{"correlations": [{"items": ["id1", "id2"], "type": "SO|WO|ST|WT", "insight": "strategic insight", "initiativeProposal": "proposed action"}]}`;
}

export function buildDynamicSwotFullSessionPrompt(
  swotData: SWOTData | undefined,
  orgContext: string
): string {
  return `You are a senior strategy consultant presenting initial findings to a CEO.
The client has framed their strategic question. Now produce a COMPLETE first-draft Dynamic SWOT session.

=== MISSION BRIEF ===
- Strategic question: ${swotData?.context?.goal || 'not yet defined'}
- Scope: ${swotData?.context?.scope || 'not yet defined'}
- Success signal: ${swotData?.context?.successSignal || 'not yet defined'}
- Time horizon: ${swotData?.context?.timeframe || 'medium'}
- Constraints: ${swotData?.context?.constraints || 'none specified'}
- Assumptions: ${swotData?.context?.assumptions || 'none specified'}
- KPI target: ${swotData?.context?.kpiTarget || 'none specified'}

=== ORGANIZATION CONTEXT ===
${orgContext}
=== END CONTEXT ===

Generate a complete consulting-grade session covering ALL phases. Be specific, grounded, and actionable.
Every item you produce is a PROPOSAL for the client to review -- mark everything as proposed.

Return a single JSON object with this exact structure:
{
  "signals": [
    {"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["..."], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}
  ],
  "items": [
    {"text": "...", "impact": "high|medium|low", "quadrant": "strengths|weaknesses|opportunities|threats", "confidence": 1-5, "status": "proposed"}
  ],
  "correlations": [
    {"type": "SO|WO|ST|WT", "insight": "...", "initiativeProposal": "..."}
  ],
  "tensions": [
    {"title": "...", "type": "attack|repair|defend|protect", "insight": "...", "whyNow": "...", "confidence": 1-5}
  ],
  "moves": [
    {"title": "...", "category": "quick-win|big-bet|defensive-move|capability-build", "rationale": "...", "expectedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "riskLevel": "high|medium|low", "confidence": 1-5, "firstStep": "..."}
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
    {"title": "...", "description": "...", "type": "strategic|operational|defensive|growth", "rationale": "...", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low"}
  ]
}

Guidelines:
- Generate 4-8 signals from diverse sources (interviews, benchmarks, AI context)
- Generate 8-12 SWOT items across all 4 quadrants (at least 2 per quadrant)
- Generate 3-5 correlations covering different tension types
- Generate 3-5 tensions with clear "why now" rationale
- Generate 3-5 strategic moves across different categories
- Generate 2-4 output candidates
- Write a concise executive summary (3-5 sentences)
- List 3-5 key insights and 3-5 applied conclusions
- Propose 2-4 initiative drafts`;
}

export function buildDynamicSwotRethinkPrompt(
  swotData: SWOTData,
  cardType: string,
  cardId: string,
  userComment?: string
): string {
  let cardContent = '';
  if (cardType === 'signal') {
    const signal = swotData.signals.find((s) => s.id === cardId);
    cardContent = signal ? `[${signal.type}] ${signal.content} (source: ${signal.sourceLabel})` : '';
  } else if (cardType === 'item') {
    const item = swotData.items.find((i) => i.id === cardId);
    cardContent = item ? `[${item.quadrant}] ${item.text} (impact: ${item.impact})` : '';
  } else if (cardType === 'tension') {
    const tension = swotData.tensions.find((t) => t.id === cardId);
    cardContent = tension ? `[${tension.type}] ${tension.title}: ${tension.insight}` : '';
  } else if (cardType === 'move') {
    const move = swotData.recommendedMoves.find((m) => m.id === cardId);
    cardContent = move ? `[${move.category}] ${move.title}: ${move.rationale}` : '';
  } else if (cardType === 'output-candidate') {
    const output = swotData.outputCandidates.find((o) => o.id === cardId);
    cardContent = output ? `[${output.outputType}] ${output.title}: ${output.description}` : '';
  } else if (cardType === 'conclusion') {
    cardContent = JSON.stringify(
      {
        executiveSummary: swotData.summary?.executiveSummary || '',
        keyInsights: swotData.summary?.keyInsights || [],
        appliedConclusions: swotData.summary?.appliedConclusions || [],
      },
      null,
      2
    );
  }

  return `The user wants you to RETHINK this specific ${cardType} card.

Current card content:
${cardContent}

User feedback: ${userComment || 'Please provide a better version.'}

Session context:
- Strategic question: ${swotData.context?.goal || 'N/A'}
- Scope: ${swotData.context?.scope || 'N/A'}

Provide an improved version of this card. Keep the same type/structure but make it sharper, more grounded, and responsive to the user's feedback.

Return JSON with the updated fields for this ${cardType}. Use the same field names as the original.
If the card type is conclusion, return:
{"executiveSummary":"...","keyInsights":["..."],"appliedConclusions":["..."]}`;
}

function normalizeMissionSuggestion(parsed: Record<string, any>): Partial<ConsultingMissionContext> | null {
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
    constraints: typeof parsed.mission.constraints === 'string' ? parsed.mission.constraints : undefined,
    assumptions: typeof parsed.mission.assumptions === 'string' ? parsed.mission.assumptions : undefined,
    kpiTarget: typeof parsed.mission.kpiTarget === 'string' ? parsed.mission.kpiTarget : undefined,
  };
}

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
        });
      });
    }

    return {};
  }

  if (pendingAction === 'correlations') {
    const correlations = Array.isArray(parsed.correlations) ? parsed.correlations : [];
    const currentCorrelations = (swotData.correlations || []) as SWOTCorrelation[];
    const normalizedCorrelations = correlations.filter(
      (corr) =>
        Array.isArray(corr?.items) &&
        corr.items.length >= 2 &&
        typeof corr?.type === 'string' &&
        typeof corr?.insight === 'string'
    );

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
      const derivedTension: SWOTTension = {
        id: `derived-${corr.type}-${corr.items.join('-')}-${corr.insight}`,
        title:
          corr.type === 'SO'
            ? 'Attack opportunity'
            : corr.type === 'WO'
              ? 'Repair to capture'
              : corr.type === 'ST'
                ? 'Defend with strength'
                : 'Protect against exposure',
        type:
          corr.type === 'SO'
            ? 'attack'
            : corr.type === 'WO'
              ? 'repair'
              : corr.type === 'ST'
                ? 'defend'
                : 'protect',
        linkedCorrelationIds: [],
        linkedItemIds: corr.items,
        insight: corr.insight,
        whyNow: corr.initiativeProposal,
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

    actions.setSWOTSummary({
      proposalId: 'swot-summary',
      executiveSummary: typeof parsed.summary === 'string' ? parsed.summary : '',
      keyInsights: Array.isArray(parsed.insights) ? parsed.insights.filter(Boolean) : [],
      appliedConclusions: Array.isArray(parsed.appliedConclusions)
        ? parsed.appliedConclusions.filter(Boolean)
        : [],
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

    actions.setSWOTMoves(
      moves.map((move) => ({
        title: move.title,
        category: move.category || 'quick-win',
        rationale: move.rationale || '',
        linkedTensionIds: move.linkedTensionIds || [],
        linkedItemIds: move.linkedItemIds || [],
        expectedImpact: move.expectedImpact || 'medium',
        estimatedEffort: move.estimatedEffort || 'medium',
        riskLevel: move.riskLevel || 'medium',
        confidence: typeof move.confidence === 'number' ? move.confidence : 3,
        firstStep: move.firstStep || '',
      }))
    );

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
    signals.forEach((signal) => {
      if (!signal?.content || !signal?.type) return;
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
    items.forEach((item) => {
      if (!item?.text || !item?.quadrant) return;
      actions.addSWOTItem({
        text: String(item.text),
        quadrant: item.quadrant,
        impact: item.impact || 'medium',
        source: 'ai',
        confidence: typeof item.confidence === 'number' ? item.confidence : 3,
        status: 'proposed',
        proposalStatus: 'ai-proposed',
      });
    });

    const correlations = Array.isArray(parsed.correlations) ? parsed.correlations : [];
    correlations.forEach((corr) => {
      if (!corr?.type || !corr?.insight) return;
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
          title: move.title,
          category: move.category || 'quick-win',
          rationale: move.rationale || '',
          linkedTensionIds: [],
          linkedItemIds: [],
          expectedImpact: move.expectedImpact || 'medium',
          estimatedEffort: move.estimatedEffort || 'medium',
          riskLevel: move.riskLevel || 'medium',
          confidence: typeof move.confidence === 'number' ? move.confidence : 3,
          firstStep: move.firstStep || '',
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
