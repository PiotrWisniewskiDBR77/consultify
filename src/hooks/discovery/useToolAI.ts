/**
 * useToolAI - Hook for AI interactions in strategic tools
 *
 * Wraps useAIStream to provide tool-specific AI capabilities:
 * - Structured prompts with organization context
 * - JSON extraction from AI responses
 * - Tool-specific analysis generation
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getToolPhaseAiActions,
  type ToolPhaseAiActionDefinition,
  type ToolPhaseAiActionId,
} from '@/components/DiscoveryTools/toolAiActions';
import type { ConsultingMissionContext } from '@/config/consultingToolsStandard';
import { useAIStream } from '@/hooks/useAIStream';
import {
  GrowthPathsData,
  PortfolioPriorityData,
  RiskUncertaintyData,
  SWOTData,
  ToolType,
  useToolStore,
} from '@/store/useToolStore';

import {
  applyAmbitionDecomposerPendingAction,
  buildAmbitionDecomposerFullSessionPrompt,
  buildAmbitionDecomposerPrioritiesPrompt,
  buildAmbitionDecomposerRethinkPrompt,
} from './toolAi/ambitionDecomposer';
import {
  applyCapabilityMapperPendingAction,
  buildCapabilityMapperConversationProtocol,
  buildCapabilityMapperFullSessionPrompt,
  buildCapabilityMapperGapsPrompt,
  buildCapabilityMapperRethinkPrompt,
} from './toolAi/capabilityMapper';
import {
  applyDynamicSwotPendingAction,
  buildDynamicSwotConversationProtocol,
  buildDynamicSwotCorrelationsPrompt,
  buildDynamicSwotFullSessionPrompt,
  buildDynamicSwotRethinkPrompt,
  createEmptyMissionContext,
  type ToolAiPendingAction,
} from './toolAi/dynamicSwot';
import {
  applyFocusTradeoffPendingAction,
  buildFocusTradeoffConversationProtocol,
  buildFocusTradeoffFullSessionPrompt,
  buildFocusTradeoffRethinkPrompt,
  buildFocusTradeoffTradeoffsPrompt,
} from './toolAi/focusTradeoff';
import { validateGrounding } from './toolAi/groundingValidator';
import {
  applyGrowthPathsPendingAction,
  buildGrowthPathsFullSessionPrompt,
  buildGrowthPathsRethinkPrompt,
  buildGrowthPathsSynthesisPrompt,
} from './toolAi/growthPaths';
import {
  applyMarketForcesPendingAction,
  buildMarketForcesConversationProtocol,
  buildMarketForcesFullSessionPrompt,
  buildMarketForcesImplicationsPrompt,
  buildMarketForcesRethinkPrompt,
} from './toolAi/marketForces';
import {
  applyNarrativeEnginePendingAction,
  buildNarrativeEngineConversationProtocol,
  buildNarrativeEngineFullSessionPrompt,
  buildNarrativeEngineRethinkPrompt,
  buildNarrativeEngineThreadsPrompt,
} from './toolAi/narrativeEngine';
import { getToolStepOpeningQuestion } from './toolAi/openingQuestions';
import {
  applyOperationalPendingAction,
  buildOperationalFullSessionPrompt,
  type OperationalSectionMeta,
} from './toolAi/operationalTool';
import {
  applyPortfolioPendingAction,
  buildPortfolioConversationProtocol,
  buildPortfolioFullSessionPrompt,
  buildPortfolioRethinkPrompt,
  buildPortfolioSynthesisPrompt,
} from './toolAi/portfolioPriority';
import {
  getToolSuggestionPrompt,
  getToolSummaryPrompt,
  type ToolDetailLevel,
} from './toolAi/promptRegistry';
import {
  applyRiskPendingAction,
  buildRiskFullSessionPrompt,
  buildRiskRethinkPrompt,
  buildRiskSynthesisPrompt,
} from './toolAi/riskUncertainty';
import { getToolSystemPrompt } from './toolAi/systemPrompts';
import {
  applyValueChainPendingAction,
  buildValueChainConversationProtocol,
  buildValueChainFullSessionPrompt,
  buildValueChainLeversPrompt,
  buildValueChainRethinkPrompt,
} from './toolAi/valueChain';
import { useOrganizationContext } from './useOrganizationContext';

// ==================== TYPES ====================

interface UseToolAIOptions {
  toolType: ToolType;
}

interface UseToolAIReturn {
  // Stream state
  isStreaming: boolean;
  streamedContent: string;
  error: string | null;

  // Actions
  sendMessage: (message: string) => Promise<void>;
  // K5 — opcjonalny poziom szczegółowości ('short'|'medium'|'full'); brak = dziś.
  requestSuggestions: (level?: ToolDetailLevel) => Promise<void>;
  generateCorrelations: () => Promise<void>;
  generateSummary: (level?: ToolDetailLevel) => Promise<void>;
  generateFullSession: () => Promise<void>;
  runPhaseAiAction: (actionId: ToolPhaseAiActionId) => Promise<void>;
  rethinkCard: (
    phaseId: string,
    cardType: string,
    cardId: string,
    userComment?: string
  ) => Promise<void>;
  abortStream: () => void;
  phaseAiActions: ToolPhaseAiActionDefinition[];
  activeAiActionId: ToolPhaseAiActionId | null;
  missionSuggestion: Partial<ConsultingMissionContext> | null;
  applyMissionSuggestion: () => void;
  dismissMissionSuggestion: () => void;

  // Utilities
  getStepOpeningQuestion: () => string;
}

// ==================== HOOK ====================

// Operational/digital tools that share OperationalToolData and are deepened with
// a single generic AI handler (sections + summary).
const OPERATIONAL_AI_TOOLS: ReadonlySet<ToolType> = new Set<ToolType>([
  'sop-builder',
  'a3-problem-solving',
  'smed-planner',
  'dms-builder',
  'inventory-autopilot',
  'ai-discovery',
  'pain-explorer',
  'rpa-scanner',
  'process-automation',
]);

const OPERATIONAL_AI_TOOL_NAMES: Partial<Record<ToolType, string>> = {
  'sop-builder': 'SOP Builder',
  'a3-problem-solving': 'A3 Problem Solving',
  'smed-planner': 'SMED Planner',
  'dms-builder': 'Daily Management System',
  'inventory-autopilot': 'Inventory Autopilot',
  'ai-discovery': 'AI Discovery',
  'pain-explorer': 'Pain Explorer',
  'rpa-scanner': 'RPA Scanner',
  'process-automation': 'Process Automation',
};

export const useToolAI = ({ toolType }: UseToolAIOptions): UseToolAIReturn => {
  const { formatForPrompt } = useOrganizationContext();
  const {
    currentSession,
    currentStep,
    getStepDefinitions,
    updateInputData,
    addSWOTSignal,
    addSWOTItem,
    addCorrelation,
    setSWOTTensions,
    setSWOTMoves,
    setSWOTOutputCandidates,
    setSWOTSummary,
    setInitiatives,
    setSessionGenerationStatus,
    markRethinking,
    updateCardAfterRethink,
  } = useToolStore();

  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ToolAiPendingAction | null>(null);
  const [activeAiActionId, setActiveAiActionId] = useState<ToolPhaseAiActionId | null>(null);
  const [missionSuggestion, setMissionSuggestion] =
    useState<Partial<ConsultingMissionContext> | null>(null);
  const [rethinkTarget, setRethinkTarget] = useState<{
    phaseId: string;
    cardType: string;
    cardId: string;
  } | null>(null);

  const { startStream, isStreaming, streamedContent, abortStream } = useAIStream();

  // O-C2 grounding validator: the exact text sent as the user prompt for the
  // in-flight request — this IS the grounding source (it already carries the
  // built org context + brief fields inline; see toolAi/*.ts builders). Used
  // to deterministically catch fabricated numbers in the parsed AI response
  // before it reaches any apply*PendingAction() store writer.
  const lastPromptSentRef = useRef<string>('');

  // Get the appropriate system prompt
  const getSystemPrompt = useCallback(() => {
    return getToolSystemPrompt(toolType, formatForPrompt());
  }, [toolType, formatForPrompt]);

  const extractObject = useCallback((content: string): Record<string, any> | null => {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('[useToolAI] Failed to extract object:', e);
      return null;
    }
  }, []);

  const currentStepDef = useMemo(() => {
    const stepDefs = getStepDefinitions();
    return stepDefs[currentStep - 1];
  }, [currentStep, getStepDefinitions]);
  const phaseAiActions = useMemo(
    () => getToolPhaseAiActions(toolType, currentStepDef),
    [toolType, currentStepDef]
  );

  // Send a message to the AI
  const sendMessage = useCallback(
    async (message: string) => {
      setError(null);

      try {
        lastPromptSentRef.current = message;
        const systemPrompt = getSystemPrompt();
        // Build context about current step
        const stepContext = currentStepDef
          ? `\n\nCURRENT STEP: ${currentStepDef.name}\nSTEP DESCRIPTION: ${currentStepDef.description}`
          : '';
        // Dynamic SWOT / Market Forces / Value Chain / Portfolio Priority /
        // Focus & Trade-offs / Capability Mapper / Narrative Engine: the chat
        // mentor interviews with each tool's laddered question bank (same
        // source of truth as the wizard/tests) during that tool's build step.
        const interviewProtocol =
          toolType === 'dynamic-swot'
            ? buildDynamicSwotConversationProtocol(currentStepDef?.id)
            : toolType === 'value-chain'
              ? buildValueChainConversationProtocol(currentStepDef?.id)
              : toolType === 'market-forces'
                ? buildMarketForcesConversationProtocol(currentStepDef?.id)
                : toolType === 'portfolio-priority'
                  ? buildPortfolioConversationProtocol(currentStepDef?.id)
                  : toolType === 'focus-tradeoff'
                    ? buildFocusTradeoffConversationProtocol(currentStepDef?.id)
                    : toolType === 'capability-mapper'
                      ? buildCapabilityMapperConversationProtocol(currentStepDef?.id)
                      : toolType === 'narrative-engine'
                        ? buildNarrativeEngineConversationProtocol(currentStepDef?.id)
                        : '';

        await startStream(
          message,
          currentSession?.chatHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })) || [],
          systemPrompt + stepContext + interviewProtocol
        );
      } catch (e) {
        setError('Failed to send message');
        setActiveAiActionId(null);
        console.error('[useToolAI] Error sending message:', e);
      }
    },
    [currentSession, currentStepDef, getSystemPrompt, startStream, toolType]
  );

  // Request AI suggestions for current step
  const requestSuggestions = useCallback(
    async (level?: ToolDetailLevel) => {
      setError(null);

      if (!currentStepDef) return;

      const prompt = getToolSuggestionPrompt(
        toolType,
        currentStepDef.id,
        currentSession?.inputData,
        level
      );

      if (prompt) {
        setPendingAction('suggestions');
        setActiveAiActionId(
          currentStepDef.id === 'mission'
            ? 'frame-mission'
            : currentStepDef.id === 'input'
              ? 'find-signals'
              : 'build-analysis'
        );
        await sendMessage(prompt);
      }
    },
    [currentSession?.inputData, currentStepDef, sendMessage, toolType]
  );

  // Generate correlations / synthesis for strategic tools
  const generateCorrelations = useCallback(async () => {
    if (!currentSession) return;

    if (toolType === 'risk-uncertainty') {
      setError(null);
      const prompt = buildRiskSynthesisPrompt(currentSession.inputData as RiskUncertaintyData);
      if (!prompt) {
        setError('Need assumptions or risks to generate synthesis');
        return;
      }
      setPendingAction('correlations');
      setActiveAiActionId('synthesize-insights');
      await sendMessage(prompt);
      return;
    }

    if (toolType === 'portfolio-priority') {
      setError(null);
      const prompt = buildPortfolioSynthesisPrompt(
        currentSession.inputData as PortfolioPriorityData
      );
      if (!prompt) {
        setError('Need portfolio items to generate synthesis');
        return;
      }
      setPendingAction('correlations');
      setActiveAiActionId('synthesize-insights');
      await sendMessage(prompt);
      return;
    }

    if (toolType === 'growth-paths') {
      setError(null);
      const prompt = buildGrowthPathsSynthesisPrompt(currentSession.inputData as GrowthPathsData);
      if (!prompt) {
        setError('Need growth options to generate synthesis');
        return;
      }
      setPendingAction('correlations');
      setActiveAiActionId('synthesize-insights');
      await sendMessage(prompt);
      return;
    }

    if (toolType === 'market-forces') {
      setError(null);
      const prompt = buildMarketForcesImplicationsPrompt(currentSession.inputData as any);
      if (!prompt) {
        setError('Need Porter forces to generate implications');
        return;
      }
      setPendingAction('correlations');
      setActiveAiActionId('synthesize-insights');
      await sendMessage(prompt);
      return;
    }

    if (toolType === 'value-chain') {
      setError(null);
      const prompt = buildValueChainLeversPrompt(currentSession.inputData as any);
      if (!prompt) {
        setError('Need scored value-chain activities to generate levers');
        return;
      }
      setPendingAction('correlations');
      setActiveAiActionId('synthesize-insights');
      await sendMessage(prompt);
      return;
    }

    if (toolType === 'capability-mapper') {
      setError(null);
      const prompt = buildCapabilityMapperGapsPrompt(currentSession.inputData as any);
      if (!prompt) {
        setError('Need scored capabilities to generate gaps');
        return;
      }
      setPendingAction('correlations');
      setActiveAiActionId('synthesize-insights');
      await sendMessage(prompt);
      return;
    }

    if (toolType === 'ambition-decomposer') {
      setError(null);
      const prompt = buildAmbitionDecomposerPrioritiesPrompt(currentSession.inputData as any);
      if (!prompt) {
        setError('Need strategic themes to generate priorities');
        return;
      }
      setPendingAction('correlations');
      setActiveAiActionId('synthesize-insights');
      await sendMessage(prompt);
      return;
    }

    if (toolType === 'focus-tradeoff') {
      setError(null);
      const prompt = buildFocusTradeoffTradeoffsPrompt(currentSession.inputData as any);
      if (!prompt) {
        setError('Need scored priorities to generate trade-offs');
        return;
      }
      setPendingAction('correlations');
      setActiveAiActionId('synthesize-insights');
      await sendMessage(prompt);
      return;
    }

    if (toolType === 'narrative-engine') {
      setError(null);
      const prompt = buildNarrativeEngineThreadsPrompt(currentSession.inputData as any);
      if (!prompt) {
        setError('Need narrative pillars to generate the storyline');
        return;
      }
      setPendingAction('correlations');
      setActiveAiActionId('synthesize-insights');
      await sendMessage(prompt);
      return;
    }

    if (toolType !== 'dynamic-swot') return;

    setError(null);

    const swotData = currentSession.inputData as SWOTData;
    const prompt = buildDynamicSwotCorrelationsPrompt(swotData);
    if (!prompt) {
      setError('Need at least 4 SWOT items to generate correlations');
      return;
    }

    setPendingAction('correlations');
    setActiveAiActionId('synthesize-insights');
    await sendMessage(prompt);
  }, [toolType, currentSession, sendMessage]);

  // Generate summary and initiatives
  const generateSummary = useCallback(
    async (level?: ToolDetailLevel) => {
      if (!currentSession) return;

      setError(null);
      const prompt = getToolSummaryPrompt(toolType, currentSession.inputData, level);

      if (prompt) {
        setPendingAction('summary');
        setActiveAiActionId('finalize-outputs');
        await sendMessage(prompt);
      }
    },
    [toolType, currentSession, sendMessage]
  );

  const generateFullSession = useCallback(async () => {
    if (!currentSession) return;

    setError(null);
    setSessionGenerationStatus('generating');

    if (OPERATIONAL_AI_TOOLS.has(toolType)) {
      const opData = currentSession.inputData as any;
      const sectionIds = Object.keys(opData?.sections || {});
      if (!sectionIds.length) {
        setSessionGenerationStatus('idle');
        return;
      }
      const stepsById = new Map(((currentSession.steps || []) as any[]).map((s) => [s.id, s]));
      const sectionMeta: OperationalSectionMeta[] = sectionIds.map((id) => {
        const step = stepsById.get(id) as any;
        return {
          id,
          name: step?.name || step?.title || id.replace(/[-_]/g, ' '),
          description: step?.description,
        };
      });
      const opPrompt = buildOperationalFullSessionPrompt(
        opData,
        sectionMeta,
        OPERATIONAL_AI_TOOL_NAMES[toolType] || toolType,
        formatForPrompt()
      );
      setPendingAction('full-session');
      setActiveAiActionId('draft-session');
      await sendMessage(opPrompt);
      return;
    }

    const prompt =
      toolType === 'risk-uncertainty'
        ? buildRiskFullSessionPrompt(
            currentSession.inputData as RiskUncertaintyData,
            formatForPrompt()
          )
        : toolType === 'portfolio-priority'
          ? buildPortfolioFullSessionPrompt(
              currentSession.inputData as PortfolioPriorityData,
              formatForPrompt()
            )
          : toolType === 'growth-paths'
            ? buildGrowthPathsFullSessionPrompt(
                currentSession.inputData as GrowthPathsData,
                formatForPrompt()
              )
            : toolType === 'market-forces'
              ? buildMarketForcesFullSessionPrompt(
                  currentSession.inputData as any,
                  formatForPrompt()
                )
              : toolType === 'value-chain'
                ? buildValueChainFullSessionPrompt(
                    currentSession.inputData as any,
                    formatForPrompt()
                  )
                : toolType === 'capability-mapper'
                  ? buildCapabilityMapperFullSessionPrompt(
                      currentSession.inputData as any,
                      formatForPrompt()
                    )
                  : toolType === 'ambition-decomposer'
                    ? buildAmbitionDecomposerFullSessionPrompt(
                        currentSession.inputData as any,
                        formatForPrompt()
                      )
                    : toolType === 'focus-tradeoff'
                      ? buildFocusTradeoffFullSessionPrompt(
                          currentSession.inputData as any,
                          formatForPrompt()
                        )
                      : toolType === 'narrative-engine'
                        ? buildNarrativeEngineFullSessionPrompt(
                            currentSession.inputData as any,
                            formatForPrompt()
                          )
                        : toolType === 'dynamic-swot'
                          ? buildDynamicSwotFullSessionPrompt(
                              currentSession.inputData as SWOTData | undefined,
                              formatForPrompt()
                            )
                          : '';

    if (!prompt) {
      setSessionGenerationStatus('idle');
      return;
    }

    setPendingAction('full-session');
    setActiveAiActionId('draft-session');
    await sendMessage(prompt);
  }, [toolType, currentSession, formatForPrompt, sendMessage, setSessionGenerationStatus]);

  const runPhaseAiAction = useCallback(
    async (actionId: ToolPhaseAiActionId) => {
      if (
        actionId === 'frame-mission' ||
        actionId === 'find-signals' ||
        actionId === 'build-analysis'
      ) {
        await requestSuggestions();
        return;
      }
      if (actionId === 'synthesize-insights') {
        await generateCorrelations();
        return;
      }
      if (actionId === 'finalize-outputs') {
        await generateSummary();
        return;
      }
      if (actionId === 'draft-session') {
        await generateFullSession();
      }
    },
    [generateCorrelations, generateFullSession, generateSummary, requestSuggestions]
  );

  const applyMissionSuggestion = useCallback(() => {
    if (toolType !== 'dynamic-swot' || !currentSession || !missionSuggestion) return;
    const swotData = (currentSession.inputData as SWOTData | undefined) || {
      context: createEmptyMissionContext(),
    };
    updateInputData({
      ...swotData,
      context: {
        ...swotData.context,
        ...missionSuggestion,
      },
    });
    setMissionSuggestion(null);
  }, [toolType, currentSession, missionSuggestion, updateInputData]);

  const dismissMissionSuggestion = useCallback(() => {
    setMissionSuggestion(null);
  }, []);

  const rethinkCard = useCallback(
    async (phaseId: string, cardType: string, cardId: string, userComment?: string) => {
      if (
        !currentSession ||
        (toolType !== 'dynamic-swot' &&
          toolType !== 'market-forces' &&
          toolType !== 'value-chain' &&
          toolType !== 'capability-mapper' &&
          toolType !== 'ambition-decomposer' &&
          toolType !== 'focus-tradeoff' &&
          toolType !== 'narrative-engine' &&
          toolType !== 'growth-paths' &&
          toolType !== 'portfolio-priority' &&
          toolType !== 'risk-uncertainty')
      )
        return;

      setError(null);
      markRethinking(cardType as any, cardId);
      setRethinkTarget({ phaseId, cardType, cardId });
      const prompt =
        toolType === 'risk-uncertainty'
          ? buildRiskRethinkPrompt(
              currentSession.inputData as RiskUncertaintyData,
              cardType,
              cardId,
              userComment
            )
          : toolType === 'portfolio-priority'
            ? buildPortfolioRethinkPrompt(
                currentSession.inputData as PortfolioPriorityData,
                cardType,
                cardId,
                userComment
              )
            : toolType === 'growth-paths'
              ? buildGrowthPathsRethinkPrompt(
                  currentSession.inputData as GrowthPathsData,
                  cardType,
                  cardId,
                  userComment
                )
              : toolType === 'market-forces'
                ? buildMarketForcesRethinkPrompt(
                    currentSession.inputData as any,
                    cardType,
                    cardId,
                    userComment
                  )
                : toolType === 'value-chain'
                  ? buildValueChainRethinkPrompt(
                      currentSession.inputData as any,
                      cardType,
                      cardId,
                      userComment
                    )
                  : toolType === 'capability-mapper'
                    ? buildCapabilityMapperRethinkPrompt(
                        currentSession.inputData as any,
                        cardType,
                        cardId,
                        userComment
                      )
                    : toolType === 'ambition-decomposer'
                      ? buildAmbitionDecomposerRethinkPrompt(
                          currentSession.inputData as any,
                          cardType,
                          cardId,
                          userComment
                        )
                      : toolType === 'focus-tradeoff'
                        ? buildFocusTradeoffRethinkPrompt(
                            currentSession.inputData as any,
                            cardType,
                            cardId,
                            userComment
                          )
                        : toolType === 'narrative-engine'
                          ? buildNarrativeEngineRethinkPrompt(
                              currentSession.inputData as any,
                              cardType,
                              cardId,
                              userComment
                            )
                          : buildDynamicSwotRethinkPrompt(
                              currentSession.inputData as SWOTData,
                              cardType,
                              cardId,
                              userComment
                            );

      setPendingAction('rethink');
      await sendMessage(prompt);
    },
    [toolType, currentSession, markRethinking, sendMessage]
  );

  useEffect(() => {
    if (
      isStreaming ||
      !pendingAction ||
      !streamedContent ||
      (toolType !== 'dynamic-swot' &&
        toolType !== 'market-forces' &&
        toolType !== 'value-chain' &&
        toolType !== 'capability-mapper' &&
        toolType !== 'ambition-decomposer' &&
        toolType !== 'focus-tradeoff' &&
        toolType !== 'narrative-engine' &&
        toolType !== 'growth-paths' &&
        toolType !== 'portfolio-priority' &&
        toolType !== 'risk-uncertainty' &&
        !OPERATIONAL_AI_TOOLS.has(toolType))
    )
      return;

    let parsed = extractObject(streamedContent);
    if (!parsed) {
      setPendingAction(null);
      setActiveAiActionId(null);
      return;
    }

    // O-C2: deterministic post-parse grounding check — downgrade any
    // fact/high-confidence/client-provenance field that carries a number not
    // present in the sources actually sent to the model, and cap QA/test
    // artifacts below 'fact'/'confirmed'. Runs for every tool that reaches
    // this effect (operational tools + all strategic tools below).
    const groundingSources = [lastPromptSentRef.current, formatForPrompt()].filter(Boolean);
    const { output: groundedParsed, downgrades } = validateGrounding(parsed, groundingSources);
    if (downgrades.length > 0) {
      // eslint-disable-next-line no-console
      console.debug(
        `[groundingValidator] ${toolType}/${pendingAction}: downgraded ${downgrades.length} unverified number(s)`,
        downgrades
      );
    }
    parsed = groundedParsed;

    const result =
      toolType === 'risk-uncertainty'
        ? applyRiskPendingAction({
            pendingAction,
            parsed,
            currentStepId: currentStepDef?.id,
            riskData: (currentSession?.inputData as RiskUncertaintyData | undefined) || {
              context: createEmptyMissionContext(),
              signals: [],
              assumptions: [],
              risks: [],
              scenarios: [],
              recommendedMoves: [],
              outputCandidates: [],
            },
            rethinkTarget,
            toolType,
            actions: {
              updateInputData,
              setInitiatives,
              setSessionGenerationStatus,
              updateCardAfterRethink,
            },
          })
        : toolType === 'portfolio-priority'
          ? applyPortfolioPendingAction({
              pendingAction,
              parsed,
              currentStepId: currentStepDef?.id,
              portfolioData: (currentSession?.inputData as PortfolioPriorityData | undefined) || {
                context: createEmptyMissionContext(),
                signals: [],
                initiatives: [],
                tradeOffs: [],
                recommendedMoves: [],
                outputCandidates: [],
              },
              rethinkTarget,
              toolType,
              actions: {
                updateInputData,
                setInitiatives,
                setSessionGenerationStatus,
                updateCardAfterRethink,
              },
            })
          : toolType === 'growth-paths'
            ? applyGrowthPathsPendingAction({
                pendingAction,
                parsed,
                currentStepId: currentStepDef?.id,
                growthData: (currentSession?.inputData as GrowthPathsData | undefined) || {
                  context: createEmptyMissionContext(),
                  signals: [],
                  quadrants: {
                    marketPenetration: [],
                    marketDevelopment: [],
                    productDevelopment: [],
                    diversification: [],
                  },
                  comparisons: [],
                  recommendedMoves: [],
                  outputCandidates: [],
                },
                rethinkTarget,
                toolType,
                actions: {
                  updateInputData,
                  setInitiatives,
                  setSessionGenerationStatus,
                  updateCardAfterRethink,
                },
              })
            : toolType === 'market-forces'
              ? applyMarketForcesPendingAction({
                  pendingAction,
                  parsed,
                  currentStepId: currentStepDef?.id,
                  porterData: (currentSession?.inputData as any) || {
                    context: { industry: '', geographicScope: '', position: 'challenger' },
                    signals: [],
                    forces: {},
                    implications: [],
                    recommendedMoves: [],
                    outputCandidates: [],
                  },
                  rethinkTarget,
                  toolType,
                  actions: {
                    updateInputData,
                    setInitiatives,
                    setSessionGenerationStatus,
                    updateCardAfterRethink,
                  },
                })
              : toolType === 'value-chain'
                ? applyValueChainPendingAction({
                    pendingAction,
                    parsed,
                    currentStepId: currentStepDef?.id,
                    valueChainData: (currentSession?.inputData as any) || {
                      context: { industry: '', valueChainScope: '', position: 'undefined' },
                      signals: [],
                      activities: {},
                      levers: [],
                      recommendedMoves: [],
                      outputCandidates: [],
                    },
                    rethinkTarget,
                    toolType,
                    actions: {
                      updateInputData,
                      setInitiatives,
                      setSessionGenerationStatus,
                      updateCardAfterRethink,
                    },
                  })
                : toolType === 'capability-mapper'
                  ? applyCapabilityMapperPendingAction({
                      pendingAction,
                      parsed,
                      currentStepId: currentStepDef?.id,
                      capabilityData: (currentSession?.inputData as any) || {
                        context: { industry: '', capabilityDomains: '' },
                        signals: [],
                        capabilities: [],
                        gaps: [],
                        recommendedMoves: [],
                        outputCandidates: [],
                      },
                      rethinkTarget,
                      toolType,
                      actions: {
                        updateInputData,
                        setInitiatives,
                        setSessionGenerationStatus,
                        updateCardAfterRethink,
                      },
                    })
                  : toolType === 'ambition-decomposer'
                    ? applyAmbitionDecomposerPendingAction({
                        pendingAction,
                        parsed,
                        currentStepId: currentStepDef?.id,
                        ambitionData: (currentSession?.inputData as any) || {
                          context: { ambitionStatement: '', scope: '' },
                          signals: [],
                          themes: [],
                          priorities: [],
                          recommendedMoves: [],
                          outputCandidates: [],
                        },
                        rethinkTarget,
                        toolType,
                        actions: {
                          updateInputData,
                          setInitiatives,
                          setSessionGenerationStatus,
                          updateCardAfterRethink,
                        },
                      })
                    : toolType === 'focus-tradeoff'
                      ? applyFocusTradeoffPendingAction({
                          pendingAction,
                          parsed,
                          currentStepId: currentStepDef?.id,
                          focusData: (currentSession?.inputData as any) || {
                            context: { competingPriorities: '', decisionCriteria: '' },
                            signals: [],
                            priorities: [],
                            tradeoffs: [],
                            recommendedMoves: [],
                            outputCandidates: [],
                          },
                          rethinkTarget,
                          toolType,
                          actions: {
                            updateInputData,
                            setInitiatives,
                            setSessionGenerationStatus,
                            updateCardAfterRethink,
                          },
                        })
                      : toolType === 'narrative-engine'
                        ? applyNarrativeEnginePendingAction({
                            pendingAction,
                            parsed,
                            currentStepId: currentStepDef?.id,
                            narrativeData: (currentSession?.inputData as any) || {
                              context: { audience: '', coreMessage: '' },
                              signals: [],
                              pillars: [],
                              threads: [],
                              recommendedMoves: [],
                              outputCandidates: [],
                            },
                            rethinkTarget,
                            toolType,
                            actions: {
                              updateInputData,
                              setInitiatives,
                              setSessionGenerationStatus,
                              updateCardAfterRethink,
                            },
                          })
                        : OPERATIONAL_AI_TOOLS.has(toolType)
                          ? applyOperationalPendingAction({
                              pendingAction,
                              parsed,
                              currentStepId: currentStepDef?.id,
                              operationalData: (currentSession?.inputData as any) || {
                                context: {},
                                sections: {},
                              },
                              toolType,
                              actions: {
                                updateInputData,
                                setInitiatives,
                                setSessionGenerationStatus,
                              },
                            })
                          : applyDynamicSwotPendingAction({
                              pendingAction,
                              parsed,
                              currentStepId: currentStepDef?.id,
                              swotData: (currentSession?.inputData as SWOTData | undefined) || {
                                context: createEmptyMissionContext(),
                                signals: [],
                                items: [],
                                correlations: [],
                                tensions: [],
                                recommendedMoves: [],
                                outputCandidates: [],
                              },
                              rethinkTarget,
                              toolType,
                              actions: {
                                updateInputData,
                                addSWOTSignal,
                                addSWOTItem,
                                addCorrelation,
                                setSWOTTensions,
                                setSWOTMoves,
                                setSWOTOutputCandidates,
                                setSWOTSummary,
                                setInitiatives,
                                setSessionGenerationStatus,
                                updateCardAfterRethink,
                              },
                            });
    const normalizedResult = result as {
      missionSuggestion?: Partial<ConsultingMissionContext> | null;
      clearRethinkTarget?: boolean;
    };
    if (normalizedResult.missionSuggestion !== undefined) {
      setMissionSuggestion(normalizedResult.missionSuggestion);
    }
    if (normalizedResult.clearRethinkTarget) {
      setRethinkTarget(null);
    }

    setPendingAction(null);
    setActiveAiActionId(null);
  }, [
    addSWOTSignal,
    addCorrelation,
    addSWOTItem,
    currentSession?.inputData,
    currentStepDef,
    extractObject,
    isStreaming,
    pendingAction,
    rethinkTarget,
    updateInputData,
    setInitiatives,
    setSWOTMoves,
    setSWOTOutputCandidates,
    setSWOTSummary,
    setSWOTTensions,
    setSessionGenerationStatus,
    setMissionSuggestion,
    updateCardAfterRethink,
    streamedContent,
    toolType,
    formatForPrompt,
  ]);

  // Get opening question for current step
  const getStepOpeningQuestion = useCallback((): string => {
    return getToolStepOpeningQuestion(toolType, currentStepDef?.id);
  }, [toolType, currentStepDef?.id]);

  return {
    isStreaming,
    streamedContent,
    error,
    sendMessage,
    requestSuggestions,
    generateCorrelations,
    generateSummary,
    generateFullSession,
    runPhaseAiAction,
    rethinkCard,
    abortStream,
    phaseAiActions,
    activeAiActionId,
    missionSuggestion,
    applyMissionSuggestion,
    dismissMissionSuggestion,
    getStepOpeningQuestion,
  };
};

export default useToolAI;
