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
import { SWOTData, ToolType, useToolStore } from '@/store/useToolStore';

import {
  applyDynamicSwotPendingAction,
  buildDynamicSwotCorrelationsPrompt,
  buildDynamicSwotFullSessionPrompt,
  buildDynamicSwotRethinkPrompt,
  createEmptyMissionContext,
  type ToolAiPendingAction,
} from './toolAi/dynamicSwot';
import { getToolStepOpeningQuestion } from './toolAi/openingQuestions';
import { getToolSuggestionPrompt, getToolSummaryPrompt } from './toolAi/promptRegistry';
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

        await startStream(
          message,
          currentSession?.chatHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })) || [],
          systemPrompt + stepContext
        );
      } catch (e) {
        setError('Failed to send message');
        setActiveAiActionId(null);
        console.error('[useToolAI] Error sending message:', e);
      }
    },
    [currentSession, currentStepDef, getSystemPrompt, startStream]
  );

  // Request AI suggestions for current step
  const requestSuggestions = useCallback(async () => {
    setError(null);

    if (!currentStepDef) return;

    const prompt = getToolSuggestionPrompt(toolType, currentStepDef.id, currentSession?.inputData);

    if (prompt) {
      setPendingAction('suggestions');
      setActiveAiActionId('suggest-step');
      await sendMessage(prompt);
    }
  }, [currentSession?.inputData, currentStepDef, sendMessage, toolType]);

  // Generate correlations (SWOT-specific)
  const generateCorrelations = useCallback(async () => {
    if (toolType !== 'dynamic-swot' || !currentSession) return;

    setError(null);

    const swotData = currentSession.inputData as SWOTData;
    const prompt = buildDynamicSwotCorrelationsPrompt(swotData);
    if (!prompt) {
      setError('Need at least 4 SWOT items to generate correlations');
      return;
    }

    setPendingAction('correlations');
    setActiveAiActionId('generate-correlations');
    await sendMessage(prompt);
  }, [toolType, currentSession, sendMessage]);

  // Generate summary and initiatives
  const generateSummary = useCallback(async () => {
    if (!currentSession) return;

    setError(null);
    const prompt = getToolSummaryPrompt(toolType, currentSession.inputData);

    if (prompt) {
      setPendingAction('summary');
      setActiveAiActionId('generate-summary');
      await sendMessage(prompt);
    }
  }, [toolType, currentSession, sendMessage]);

  const generateFullSession = useCallback(async () => {
    if (toolType !== 'dynamic-swot' || !currentSession) return;

    setError(null);
    setSessionGenerationStatus('generating');
    const prompt = buildDynamicSwotFullSessionPrompt(
      currentSession.inputData as SWOTData | undefined,
      formatForPrompt()
    );

    setPendingAction('full-session');
    setActiveAiActionId('generate-full-session');
    await sendMessage(prompt);
  }, [toolType, currentSession, formatForPrompt, sendMessage, setSessionGenerationStatus]);

  const runPhaseAiAction = useCallback(
    async (actionId: ToolPhaseAiActionId) => {
      if (actionId === 'suggest-step') {
        await requestSuggestions();
        return;
      }
      if (actionId === 'generate-correlations') {
        await generateCorrelations();
        return;
      }
      if (actionId === 'generate-summary') {
        await generateSummary();
        return;
      }
      if (actionId === 'generate-full-session') {
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
      if (toolType !== 'dynamic-swot' || !currentSession) return;

      setError(null);
      markRethinking(cardType as any, cardId);
      setRethinkTarget({ phaseId, cardType, cardId });
      const prompt = buildDynamicSwotRethinkPrompt(
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
    if (isStreaming || !pendingAction || !streamedContent || toolType !== 'dynamic-swot') return;

    const parsed = extractObject(streamedContent);
    if (!parsed) {
      setPendingAction(null);
      setActiveAiActionId(null);
      return;
    }

    const result = applyDynamicSwotPendingAction({
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
    if (result.missionSuggestion !== undefined) {
      setMissionSuggestion(result.missionSuggestion);
    }
    if (result.clearRethinkTarget) {
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
