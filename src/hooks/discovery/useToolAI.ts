/**
 * useToolAI - Hook for AI interactions in strategic tools
 *
 * Wraps useAIStream to provide tool-specific AI capabilities:
 * - Structured prompts with organization context
 * - JSON extraction from AI responses
 * - Tool-specific analysis generation
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

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
  applyDynamicSwotPendingAction,
  buildDynamicSwotConversationProtocol,
  buildDynamicSwotCorrelationsPrompt,
  buildDynamicSwotFullSessionPrompt,
  buildDynamicSwotRethinkPrompt,
  createEmptyMissionContext,
  type ToolAiPendingAction,
} from './toolAi/dynamicSwot';
import {
  applyGrowthPathsPendingAction,
  buildGrowthPathsFullSessionPrompt,
  buildGrowthPathsRethinkPrompt,
  buildGrowthPathsSynthesisPrompt,
} from './toolAi/growthPaths';
import {
  applyMarketForcesPendingAction,
  buildMarketForcesFullSessionPrompt,
  buildMarketForcesImplicationsPrompt,
  buildMarketForcesRethinkPrompt,
} from './toolAi/marketForces';
import { getToolStepOpeningQuestion } from './toolAi/openingQuestions';
import {
  applyPortfolioPendingAction,
  buildPortfolioFullSessionPrompt,
  buildPortfolioRethinkPrompt,
  buildPortfolioSynthesisPrompt,
} from './toolAi/portfolioPriority';
import { getToolSuggestionPrompt, getToolSummaryPrompt } from './toolAi/promptRegistry';
import {
  applyRiskPendingAction,
  buildRiskFullSessionPrompt,
  buildRiskRethinkPrompt,
  buildRiskSynthesisPrompt,
} from './toolAi/riskUncertainty';
import { getToolSystemPrompt } from './toolAi/systemPrompts';
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
  requestSuggestions: () => Promise<void>;
  generateCorrelations: () => Promise<void>;
  generateSummary: () => Promise<void>;
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
        const systemPrompt = getSystemPrompt();
        // Build context about current step
        const stepContext = currentStepDef
          ? `\n\nCURRENT STEP: ${currentStepDef.name}\nSTEP DESCRIPTION: ${currentStepDef.description}`
          : '';
        // Dynamic SWOT: the chat mentor interviews with the laddered question bank
        // (same source of truth as the wizard) during the SWOT step.
        const interviewProtocol =
          toolType === 'dynamic-swot'
            ? buildDynamicSwotConversationProtocol(currentStepDef?.id)
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
  const requestSuggestions = useCallback(async () => {
    setError(null);

    if (!currentStepDef) return;

    const prompt = getToolSuggestionPrompt(toolType, currentStepDef.id, currentSession?.inputData);

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
  }, [currentSession?.inputData, currentStepDef, sendMessage, toolType]);

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
  const generateSummary = useCallback(async () => {
    if (!currentSession) return;

    setError(null);
    const prompt = getToolSummaryPrompt(toolType, currentSession.inputData);

    if (prompt) {
      setPendingAction('summary');
      setActiveAiActionId('finalize-outputs');
      await sendMessage(prompt);
    }
  }, [toolType, currentSession, sendMessage]);

  const generateFullSession = useCallback(async () => {
    if (!currentSession) return;

    setError(null);
    setSessionGenerationStatus('generating');
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
        toolType !== 'growth-paths' &&
        toolType !== 'portfolio-priority' &&
        toolType !== 'risk-uncertainty')
    )
      return;

    const parsed = extractObject(streamedContent);
    if (!parsed) {
      setPendingAction(null);
      setActiveAiActionId(null);
      return;
    }

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
