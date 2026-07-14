import type {
  InitiativeDraft,
  ProposalStatus,
  RiskUncertaintyData,
  ToolType,
} from '@/store/useToolStore';

import type { ToolAiPendingAction } from './dynamicSwot';
import { GROUNDING_RULES_BOTH } from './groundingRules';
import { pickW2SummaryFields } from './w2SummaryFields';
interface RiskActionHandlers {
  updateInputData: (data: Partial<RiskUncertaintyData>) => void;
  setInitiatives: (initiatives: Omit<InitiativeDraft, 'id'>[]) => void;
  setSessionGenerationStatus: (status: 'idle' | 'generating' | 'ready' | 'error') => void;
  updateCardAfterRethink: (cardType: any, cardId: string, updates: Record<string, unknown>) => void;
}

interface ApplyRiskPendingActionOptions {
  pendingAction: ToolAiPendingAction;
  parsed: Record<string, any>;
  currentStepId?: string;
  riskData: RiskUncertaintyData;
  rethinkTarget?: { cardType: string; cardId: string } | null;
  toolType: ToolType;
  actions: RiskActionHandlers;
}

const proposalStatus: ProposalStatus = 'ai-proposed';
const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function buildRiskFullSessionPrompt(
  riskData: RiskUncertaintyData | undefined,
  orgContext: string
): string {
  return `You are a senior strategy consultant running a Risk & Uncertainty session.
Produce a COMPLETE first-draft risk session. Everything is a proposal for user review.

=== RISK BRIEF ===
- Decision goal: ${riskData?.context?.goal || 'not yet defined'}
- Scope: ${riskData?.context?.scope || 'not yet defined'}
- Success signal: ${riskData?.context?.successSignal || 'not yet defined'}
- Timeframe: ${riskData?.context?.timeframe || 'medium'}
- Constraints: ${riskData?.context?.constraints || 'none specified'}

=== ORGANIZATION CONTEXT ===
${orgContext}
=== END CONTEXT ===


${GROUNDING_RULES_BOTH}
Return one JSON object with this exact structure:
{
  "signals": [{"type":"interview|file|link|ai|benchmark","content":"...","sourceLabel":"...","confidence":1-5,"tags":["risk"],"evidenceType":"fact|observation|hypothesis","state":"proposed","provenance":"..."}],
  "assumptions": [{"text":"...","confidence":1-5,"evidence":["..."],"consequenceIfWrong":"...","validationMethod":"..."}],
  "risks": [{"title":"...","description":"...","probability":1-5,"impact":1-5,"mitigation":"...","trigger":"...","owner":"...","evidence":["..."],"confidence":1-5}],
  "scenarios": [{"title":"...","likelihood":1-5,"notes":"...","posture":"base|upside|downside|stress","signalsToWatch":["..."],"response":"..."}],
  "moves": [{"title":"...","category":"validate|mitigate|monitor|hedge|escalate","rationale":"...","linkedRiskIds":[],"linkedAssumptionIds":[],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","confidence":1-5,"firstStep":"..."}],
  "outputCandidates": [{"outputType":"initiative|report|presentation|idea","title":"...","description":"...","rationale":"...","readiness":"ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked","linkedRiskIds":[],"linkedScenarioIds":[]}],
  "summary": {"executiveSummary":"...","keyInsights":["..."],"appliedConclusions":["..."]},
  "initiatives": [{"title":"...","description":"...","type":"strategic|operational","rationale":"...","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","linkedItems":[]}]
}`;
}

export function buildRiskSynthesisPrompt(riskData: RiskUncertaintyData): string | null {
  const risks = (riskData.risks || [])
    .map((risk) => `- ${risk.title || risk.description}: P${risk.probability}/I${risk.impact}`)
    .join('\n');
  const assumptions = (riskData.assumptions || [])
    .map((assumption) => `- ${assumption.text}: confidence ${assumption.confidence}/5`)
    .join('\n');

  if (!risks.trim() && !assumptions.trim()) return null;

  return `Act as a strategic risk consultant. Convert these assumptions and risks into recommended resilience moves.

ASSUMPTIONS:
${assumptions || '- none'}

RISKS:
${risks || '- none'}

Rules:
- recommend validation for low-confidence assumptions
- recommend mitigation for high-impact risks
- include monitoring and escalation moves where early warning matters

Return JSON:
{
  "moves": [{"title":"...","category":"validate|mitigate|monitor|hedge|escalate","rationale":"...","linkedRiskIds":[],"linkedAssumptionIds":[],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","confidence":4,"firstStep":"..."}],
  "appliedConclusions": ["..."]
}`;
}

export function buildRiskRethinkPrompt(
  riskData: RiskUncertaintyData,
  cardType: string,
  cardId: string,
  userComment?: string
): string {
  let cardContent = '';
  if (cardType === 'signal') {
    const signal = riskData.signals.find((item) => item.id === cardId);
    cardContent = signal ? `[${signal.type}] ${signal.content}` : '';
  } else if (cardType === 'item') {
    const assumption = riskData.assumptions.find((item) => item.id === cardId);
    const risk = riskData.risks.find((item) => item.id === cardId);
    const scenario = riskData.scenarios.find((item) => item.id === cardId);
    cardContent = assumption?.text || risk?.description || scenario?.title || '';
  } else if (cardType === 'move' || cardType === 'tension') {
    const move = riskData.recommendedMoves.find((item) => item.id === cardId);
    cardContent = move ? `${move.title}: ${move.rationale}` : '';
  } else if (cardType === 'output-candidate') {
    const output = riskData.outputCandidates.find((item) => item.id === cardId);
    cardContent = output ? `${output.title}: ${output.description}` : '';
  } else if (cardType === 'conclusion') {
    cardContent = JSON.stringify(riskData.summary || {}, null, 2);
  }

  return `The user wants you to rethink this Risk & Uncertainty ${cardType} card.

Current card:
${cardContent}

User feedback: ${userComment || 'Please improve it.'}

Risk context:
- Goal: ${riskData.context.goal || 'N/A'}
- Scope: ${riskData.context.scope || 'N/A'}

Return JSON with improved fields for the same card type.`;
}

export function applyRiskPendingAction({
  pendingAction,
  parsed,
  currentStepId,
  riskData,
  rethinkTarget,
  toolType,
  actions,
}: ApplyRiskPendingActionOptions): { clearRethinkTarget?: boolean } {
  if (pendingAction === 'rethink' && rethinkTarget) {
    actions.updateCardAfterRethink(rethinkTarget.cardType, rethinkTarget.cardId, parsed);
    return { clearRethinkTarget: true };
  }

  if (pendingAction === 'suggestions' && currentStepId === 'mission') {
    const mission = parsed.mission && typeof parsed.mission === 'object' ? parsed.mission : parsed;
    actions.updateInputData({
      context: {
        ...riskData.context,
        goal: mission.goal || riskData.context.goal,
        scope: mission.scope || riskData.context.scope,
        successSignal: mission.successSignal || riskData.context.successSignal,
        timeframe: mission.timeframe || riskData.context.timeframe,
        constraints: mission.constraints || riskData.context.constraints,
        assumptions: mission.assumptions || riskData.context.assumptions,
        kpiTarget: mission.kpiTarget || riskData.context.kpiTarget,
      },
    });
    return {};
  }

  if (pendingAction === 'suggestions' && currentStepId === 'input') {
    const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
    actions.updateInputData({
      signals: [
        ...(riskData.signals || []),
        ...signals
          .filter((signal) => signal?.content)
          .map((signal) => ({
            id: makeId('risk-signal'),
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
    (pendingAction === 'suggestions' && currentStepId === 'assumptions') ||
    pendingAction === 'full-session'
  ) {
    actions.updateInputData({
      ...(Array.isArray(parsed.assumptions)
        ? {
            assumptions: parsed.assumptions
              .filter((item) => item?.text)
              .map((item) => ({
                id: makeId('risk-assumption'),
                text: item.text,
                confidence: typeof item.confidence === 'number' ? item.confidence : 3,
                evidence: Array.isArray(item.evidence) ? item.evidence.filter(Boolean) : [],
                consequenceIfWrong: item.consequenceIfWrong || '',
                validationMethod: item.validationMethod || '',
                proposalStatus,
              })),
          }
        : {}),
      ...(Array.isArray(parsed.risks)
        ? {
            risks: parsed.risks
              .filter((item) => item?.description || item?.title)
              .map((item) => ({
                id: makeId('risk-item'),
                title: item.title || '',
                description: item.description || item.title || '',
                probability: typeof item.probability === 'number' ? item.probability : 3,
                impact: typeof item.impact === 'number' ? item.impact : 3,
                mitigation: item.mitigation || '',
                trigger: item.trigger || '',
                owner: item.owner || '',
                evidence: Array.isArray(item.evidence) ? item.evidence.filter(Boolean) : [],
                confidence: typeof item.confidence === 'number' ? item.confidence : 3,
                proposalStatus,
              })),
          }
        : {}),
      ...(Array.isArray(parsed.scenarios)
        ? {
            scenarios: parsed.scenarios
              .filter((item) => item?.title)
              .map((item) => ({
                id: makeId('risk-scenario'),
                title: item.title,
                likelihood: typeof item.likelihood === 'number' ? item.likelihood : 3,
                notes: item.notes || '',
                posture: item.posture || 'base',
                signalsToWatch: Array.isArray(item.signalsToWatch)
                  ? item.signalsToWatch.filter(Boolean)
                  : [],
                response: item.response || '',
                proposalStatus,
              })),
          }
        : {}),
    });
  }

  if (
    pendingAction === 'correlations' ||
    pendingAction === 'summary' ||
    pendingAction === 'full-session'
  ) {
    const moves = Array.isArray(parsed.moves) ? parsed.moves : [];
    if (moves.length > 0) {
      actions.updateInputData({
        recommendedMoves: moves
          .filter((move) => move?.title)
          .map((move) => ({
            id: makeId('risk-move'),
            title: move.title,
            category: move.category || 'mitigate',
            rationale: move.rationale || '',
            linkedRiskIds: Array.isArray(move.linkedRiskIds)
              ? move.linkedRiskIds.filter(Boolean)
              : [],
            linkedAssumptionIds: Array.isArray(move.linkedAssumptionIds)
              ? move.linkedAssumptionIds.filter(Boolean)
              : [],
            expectedImpact: move.expectedImpact || 'medium',
            estimatedEffort: move.estimatedEffort || 'medium',
            confidence: typeof move.confidence === 'number' ? move.confidence : 3,
            firstStep: move.firstStep || '',
            proposalStatus,
          })),
      });
    }
  }

  if (pendingAction === 'summary' || pendingAction === 'full-session') {
    const summaryObj = parsed.summary && typeof parsed.summary === 'object' ? parsed.summary : null;
    const initiatives = Array.isArray(parsed.initiatives) ? parsed.initiatives : [];
    const outputCandidates = Array.isArray(parsed.outputCandidates) ? parsed.outputCandidates : [];

    actions.updateInputData({
      summary: {
        proposalId: 'risk-summary',
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
          id: makeId('risk-output'),
          outputType: candidate.outputType || 'initiative',
          title: candidate.title,
          description: candidate.description || '',
          linkedRiskIds: Array.isArray(candidate.linkedRiskIds)
            ? candidate.linkedRiskIds.filter(Boolean)
            : [],
          linkedScenarioIds: Array.isArray(candidate.linkedScenarioIds)
            ? candidate.linkedScenarioIds.filter(Boolean)
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
          id: makeId('risk-signal'),
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
