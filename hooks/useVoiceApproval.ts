/**
 * useVoiceApproval Hook
 * 
 * Integrates voice commands with the HITL approval workflow.
 * Extends useUniversalVoice to detect and execute approval commands.
 * 
 * Commands supported:
 * - "approve" / "akceptuj" - Approve current action
 * - "reject [reason]" / "odrzuć [powód]" - Reject with reason
 * - "skip" / "pomiń" - Skip to next action
 * - "details" / "szczegóły" - Get action details
 * - "always approve this" / "zawsze akceptuj takie" - Learn pattern
 * - "always reject this" / "zawsze odrzucaj takie" - Learn pattern
 * 
 * @version 1.0.0
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useUniversalVoice, UseUniversalVoiceOptions, VoiceSettings } from './useUniversalVoice';
import api from '../services/api';

// ============================================================================
// Types
// ============================================================================

export interface PendingAction {
    id: string;
    action_type: string;
    payload: any;
    draftContent?: any;
    created_at: string;
    risk_level?: 'LOW' | 'MEDIUM' | 'HIGH';
    patternInfo?: {
        message: string;
        decisionCount: number;
        decision: string;
    };
}

export interface ApprovalCommandResult {
    success: boolean;
    commandType: string;
    actionId?: string;
    message: string;
    patternLearned?: boolean;
    error?: string;
}

export interface UseVoiceApprovalOptions extends UseUniversalVoiceOptions {
    onApprovalCommand?: (result: ApprovalCommandResult) => void;
    onPendingActionsChange?: (actions: PendingAction[]) => void;
    language?: 'en' | 'pl';
    projectId?: string;
}

export interface UseVoiceApprovalReturn {
    // From useUniversalVoice
    voiceState: ReturnType<typeof useUniversalVoice>['state'];
    voiceSettings: VoiceSettings;
    isSupported: boolean;
    startListening: () => void;
    stopListening: () => void;
    toggleListening: () => void;
    speak: (text: string) => Promise<void>;
    stopSpeaking: () => void;
    startConversation: () => void;
    endConversation: () => void;
    updateSettings: (settings: Partial<VoiceSettings>) => void;
    
    // Approval-specific
    pendingActions: PendingAction[];
    currentAction: PendingAction | null;
    currentActionIndex: number;
    isLoading: boolean;
    lastCommandResult: ApprovalCommandResult | null;
    
    // Approval controls (for manual use)
    approveCurrentAction: (alwaysApprove?: boolean) => Promise<ApprovalCommandResult>;
    rejectCurrentAction: (reason?: string, alwaysReject?: boolean) => Promise<ApprovalCommandResult>;
    skipToNextAction: () => void;
    refreshPendingActions: () => Promise<void>;
    readCurrentActionDetails: () => Promise<void>;
    
    // Pattern management
    toggleAutoApply: (patternId: string, enabled: boolean) => Promise<void>;
    getPatternStats: () => Promise<any>;
}

// ============================================================================
// Command Parsing (client-side mirror of server logic)
// ============================================================================

const COMMAND_TYPES = {
    APPROVE: 'APPROVE',
    REJECT: 'REJECT',
    SKIP: 'SKIP',
    DETAILS: 'DETAILS',
    APPROVE_ALL_LOW_RISK: 'APPROVE_ALL_LOW_RISK',
    ALWAYS_APPROVE: 'ALWAYS_APPROVE',
    ALWAYS_REJECT: 'ALWAYS_REJECT',
    LIST_PENDING: 'LIST_PENDING',
    HELP: 'HELP',
    UNKNOWN: 'UNKNOWN'
} as const;

type CommandType = typeof COMMAND_TYPES[keyof typeof COMMAND_TYPES];

interface ParsedCommand {
    type: CommandType;
    params: { reason?: string };
    confidence: number;
}

function parseVoiceCommand(text: string): ParsedCommand {
    const normalized = text.trim().toLowerCase();
    
    // APPROVE patterns
    if (/^(approve|akceptuj|zatwierdź|zatwierdz|ok|yes|tak|accept)$/i.test(normalized)) {
        return { type: COMMAND_TYPES.APPROVE, params: {}, confidence: 1.0 };
    }
    
    // REJECT patterns
    if (/^(reject|odrzuć|odrzuc|no|nie)$/i.test(normalized)) {
        return { type: COMMAND_TYPES.REJECT, params: {}, confidence: 1.0 };
    }
    const rejectWithReason = normalized.match(/^(?:reject|odrzuć|odrzuc)\s+(?:because|bo|ponieważ)?\s*(.+)$/i);
    if (rejectWithReason) {
        return { type: COMMAND_TYPES.REJECT, params: { reason: rejectWithReason[1] }, confidence: 0.9 };
    }
    
    // SKIP patterns
    if (/^(skip|pomiń|pomin|next|następny|nastepny|later|później|pozniej)$/i.test(normalized)) {
        return { type: COMMAND_TYPES.SKIP, params: {}, confidence: 1.0 };
    }
    
    // DETAILS patterns
    if (/^(details|szczegóły|szczegoly|info|więcej|wiecej|more)$/i.test(normalized)) {
        return { type: COMMAND_TYPES.DETAILS, params: {}, confidence: 1.0 };
    }
    
    // ALWAYS APPROVE patterns
    if (/^(always|zawsze)\s+(approve|akceptuj)/i.test(normalized) ||
        /^(auto.?approve|auto.?akceptuj)/i.test(normalized) ||
        /^(zapamiętaj|zapamietaj)\s+(że)?\s*(akceptuję|akceptuje)/i.test(normalized)) {
        return { type: COMMAND_TYPES.ALWAYS_APPROVE, params: {}, confidence: 0.95 };
    }
    
    // ALWAYS REJECT patterns
    if (/^(always|zawsze)\s+(reject|odrzuć|odrzucaj)/i.test(normalized) ||
        /^(auto.?reject|auto.?odrzuć)/i.test(normalized)) {
        return { type: COMMAND_TYPES.ALWAYS_REJECT, params: {}, confidence: 0.95 };
    }
    
    // LIST PENDING patterns
    if (/^(list|pokaż|pokaz|show)\s+(pending|oczekujące|oczekujace)/i.test(normalized) ||
        /^ile\s+(mam|jest)/i.test(normalized)) {
        return { type: COMMAND_TYPES.LIST_PENDING, params: {}, confidence: 0.9 };
    }
    
    // HELP patterns
    if (/^(help|pomoc|commands|komendy)$/i.test(normalized)) {
        return { type: COMMAND_TYPES.HELP, params: {}, confidence: 1.0 };
    }
    
    return { type: COMMAND_TYPES.UNKNOWN, params: {}, confidence: 0 };
}

// ============================================================================
// Voice Responses
// ============================================================================

function getVoiceResponse(
    commandType: CommandType, 
    result: ApprovalCommandResult, 
    language: 'en' | 'pl' = 'en'
): string {
    const responses: Record<string, Record<CommandType, string>> = {
        en: {
            [COMMAND_TYPES.APPROVE]: result.success 
                ? `Approved.${result.patternLearned ? ' Pattern learned for future.' : ''}` 
                : `Could not approve: ${result.error}`,
            [COMMAND_TYPES.REJECT]: result.success 
                ? `Rejected.${result.patternLearned ? ' Pattern learned for future.' : ''}` 
                : `Could not reject: ${result.error}`,
            [COMMAND_TYPES.SKIP]: 'Skipped. Moving to next.',
            [COMMAND_TYPES.DETAILS]: 'Here are the details.',
            [COMMAND_TYPES.ALWAYS_APPROVE]: 'I will automatically approve similar actions.',
            [COMMAND_TYPES.ALWAYS_REJECT]: 'I will automatically reject similar actions.',
            [COMMAND_TYPES.LIST_PENDING]: result.message,
            [COMMAND_TYPES.HELP]: 'Say approve, reject, skip, or details.',
            [COMMAND_TYPES.UNKNOWN]: 'I did not understand. Try saying approve or reject.',
            [COMMAND_TYPES.APPROVE_ALL_LOW_RISK]: 'Approved all low risk actions.'
        },
        pl: {
            [COMMAND_TYPES.APPROVE]: result.success 
                ? `Zatwierdzono.${result.patternLearned ? ' Wzorzec zapamiętany.' : ''}` 
                : `Nie można zatwierdzić: ${result.error}`,
            [COMMAND_TYPES.REJECT]: result.success 
                ? `Odrzucono.${result.patternLearned ? ' Wzorzec zapamiętany.' : ''}` 
                : `Nie można odrzucić: ${result.error}`,
            [COMMAND_TYPES.SKIP]: 'Pominięto. Następna akcja.',
            [COMMAND_TYPES.DETAILS]: 'Oto szczegóły.',
            [COMMAND_TYPES.ALWAYS_APPROVE]: 'Będę automatycznie akceptować podobne akcje.',
            [COMMAND_TYPES.ALWAYS_REJECT]: 'Będę automatycznie odrzucać podobne akcje.',
            [COMMAND_TYPES.LIST_PENDING]: result.message,
            [COMMAND_TYPES.HELP]: 'Powiedz akceptuj, odrzuć, pomiń lub szczegóły.',
            [COMMAND_TYPES.UNKNOWN]: 'Nie zrozumiałem. Spróbuj powiedzieć akceptuj lub odrzuć.',
            [COMMAND_TYPES.APPROVE_ALL_LOW_RISK]: 'Zatwierdzono wszystkie akcje o niskim ryzyku.'
        }
    };
    
    return responses[language]?.[commandType] || responses.en[commandType] || responses.en[COMMAND_TYPES.UNKNOWN];
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useVoiceApproval(options: UseVoiceApprovalOptions = {}): UseVoiceApprovalReturn {
    const {
        onApprovalCommand,
        onPendingActionsChange,
        language = 'pl',
        projectId,
        ...voiceOptions
    } = options;

    // State
    const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
    const [currentActionIndex, setCurrentActionIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [lastCommandResult, setLastCommandResult] = useState<ApprovalCommandResult | null>(null);
    
    const processingCommandRef = useRef(false);

    // Current action
    const currentAction = pendingActions[currentActionIndex] || null;

    // Handle transcript from voice
    const handleTranscript = useCallback(async (text: string, isFinal: boolean) => {
        if (!isFinal || processingCommandRef.current) return;
        
        const parsed = parseVoiceCommand(text);
        
        // Only process if it looks like a command
        if (parsed.type === COMMAND_TYPES.UNKNOWN || parsed.confidence < 0.8) {
            // Pass through to regular chat if configured
            voiceOptions.onTranscript?.(text, isFinal);
            return;
        }
        
        processingCommandRef.current = true;
        
        try {
            let result: ApprovalCommandResult;
            
            switch (parsed.type) {
                case COMMAND_TYPES.APPROVE:
                    result = await approveCurrentAction(false);
                    break;
                    
                case COMMAND_TYPES.REJECT:
                    result = await rejectCurrentAction(parsed.params.reason, false);
                    break;
                    
                case COMMAND_TYPES.SKIP:
                    skipToNextAction();
                    result = { success: true, commandType: COMMAND_TYPES.SKIP, message: 'Skipped' };
                    break;
                    
                case COMMAND_TYPES.DETAILS:
                    await readCurrentActionDetails();
                    result = { success: true, commandType: COMMAND_TYPES.DETAILS, message: 'Details read' };
                    break;
                    
                case COMMAND_TYPES.ALWAYS_APPROVE:
                    result = await approveCurrentAction(true);
                    break;
                    
                case COMMAND_TYPES.ALWAYS_REJECT:
                    result = await rejectCurrentAction(parsed.params.reason, true);
                    break;
                    
                case COMMAND_TYPES.LIST_PENDING:
                    await refreshPendingActions();
                    result = { 
                        success: true, 
                        commandType: COMMAND_TYPES.LIST_PENDING, 
                        message: `You have ${pendingActions.length} pending actions` 
                    };
                    break;
                    
                case COMMAND_TYPES.HELP:
                    result = { 
                        success: true, 
                        commandType: COMMAND_TYPES.HELP, 
                        message: language === 'pl' 
                            ? 'Powiedz: akceptuj, odrzuć, pomiń, szczegóły, zawsze akceptuj takie, lub zawsze odrzucaj takie'
                            : 'Say: approve, reject, skip, details, always approve this, or always reject this'
                    };
                    break;
                    
                default:
                    result = { success: false, commandType: parsed.type, message: 'Unknown command' };
            }
            
            setLastCommandResult(result);
            onApprovalCommand?.(result);
            
            // Speak the response
            const voiceResponse = getVoiceResponse(parsed.type, result, language);
            await voice.speak(voiceResponse);
            
        } finally {
            processingCommandRef.current = false;
        }
    }, [currentAction, pendingActions.length, language, onApprovalCommand]);

    // Initialize voice with our transcript handler
    const voice = useUniversalVoice({
        ...voiceOptions,
        onTranscript: handleTranscript,
        settings: {
            ...voiceOptions.settings,
            language
        }
    });

    // Fetch pending actions
    const refreshPendingActions = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/ai/actions/pending', {
                params: { projectId }
            });
            
            const actions = response.data?.actions || [];
            setPendingActions(actions);
            onPendingActionsChange?.(actions);
            
            // Reset index if current action is no longer valid
            if (currentActionIndex >= actions.length) {
                setCurrentActionIndex(Math.max(0, actions.length - 1));
            }
        } catch (error) {
            console.error('[VoiceApproval] Failed to fetch pending actions:', error);
        } finally {
            setIsLoading(false);
        }
    }, [projectId, currentActionIndex, onPendingActionsChange]);

    // Approve current action
    const approveCurrentAction = useCallback(async (alwaysApprove = false): Promise<ApprovalCommandResult> => {
        if (!currentAction) {
            return { 
                success: false, 
                commandType: COMMAND_TYPES.APPROVE, 
                message: 'No pending action to approve',
                error: 'No action selected'
            };
        }
        
        setIsLoading(true);
        try {
            const response = await api.post(`/ai/actions/${currentAction.id}/approve`, {
                alwaysApprove
            });
            
            if (response.data?.success) {
                // Remove from list and move to next
                setPendingActions(prev => prev.filter(a => a.id !== currentAction.id));
                
                return {
                    success: true,
                    commandType: alwaysApprove ? COMMAND_TYPES.ALWAYS_APPROVE : COMMAND_TYPES.APPROVE,
                    actionId: currentAction.id,
                    message: 'Action approved',
                    patternLearned: response.data?.patternLearned
                };
            } else {
                return {
                    success: false,
                    commandType: COMMAND_TYPES.APPROVE,
                    actionId: currentAction.id,
                    message: 'Approval failed',
                    error: response.data?.error
                };
            }
        } catch (error: any) {
            return {
                success: false,
                commandType: COMMAND_TYPES.APPROVE,
                message: 'Approval failed',
                error: error.message
            };
        } finally {
            setIsLoading(false);
        }
    }, [currentAction]);

    // Reject current action
    const rejectCurrentAction = useCallback(async (
        reason?: string, 
        alwaysReject = false
    ): Promise<ApprovalCommandResult> => {
        if (!currentAction) {
            return { 
                success: false, 
                commandType: COMMAND_TYPES.REJECT, 
                message: 'No pending action to reject',
                error: 'No action selected'
            };
        }
        
        setIsLoading(true);
        try {
            const response = await api.post(`/ai/actions/${currentAction.id}/reject`, {
                reason,
                alwaysReject
            });
            
            if (response.data?.success) {
                // Remove from list
                setPendingActions(prev => prev.filter(a => a.id !== currentAction.id));
                
                return {
                    success: true,
                    commandType: alwaysReject ? COMMAND_TYPES.ALWAYS_REJECT : COMMAND_TYPES.REJECT,
                    actionId: currentAction.id,
                    message: 'Action rejected',
                    patternLearned: response.data?.patternLearned
                };
            } else {
                return {
                    success: false,
                    commandType: COMMAND_TYPES.REJECT,
                    actionId: currentAction.id,
                    message: 'Rejection failed',
                    error: response.data?.error
                };
            }
        } catch (error: any) {
            return {
                success: false,
                commandType: COMMAND_TYPES.REJECT,
                message: 'Rejection failed',
                error: error.message
            };
        } finally {
            setIsLoading(false);
        }
    }, [currentAction]);

    // Skip to next action
    const skipToNextAction = useCallback(() => {
        setCurrentActionIndex(prev => 
            prev < pendingActions.length - 1 ? prev + 1 : 0
        );
    }, [pendingActions.length]);

    // Read current action details (speak them)
    const readCurrentActionDetails = useCallback(async () => {
        if (!currentAction) {
            await voice.speak(language === 'pl' 
                ? 'Nie ma akcji do wyświetlenia.' 
                : 'No action to show.'
            );
            return;
        }
        
        const riskText = currentAction.risk_level || 'LOW';
        const actionType = currentAction.action_type.replace(/_/g, ' ').toLowerCase();
        
        let details: string;
        if (language === 'pl') {
            details = `Akcja typu ${actionType}. Poziom ryzyka: ${riskText}. `;
            if (currentAction.patternInfo) {
                details += `${currentAction.patternInfo.message}. `;
            }
            if (currentAction.draftContent?.title) {
                details += `Tytuł: ${currentAction.draftContent.title}. `;
            }
        } else {
            details = `Action type: ${actionType}. Risk level: ${riskText}. `;
            if (currentAction.patternInfo) {
                details += `${currentAction.patternInfo.message}. `;
            }
            if (currentAction.draftContent?.title) {
                details += `Title: ${currentAction.draftContent.title}. `;
            }
        }
        
        await voice.speak(details);
    }, [currentAction, language, voice]);

    // Toggle auto-apply for a pattern
    const toggleAutoApply = useCallback(async (patternId: string, enabled: boolean) => {
        try {
            await api.patch(`/ai/patterns/${patternId}/auto-apply`, { enabled });
        } catch (error) {
            console.error('[VoiceApproval] Failed to toggle auto-apply:', error);
        }
    }, []);

    // Get pattern stats
    const getPatternStats = useCallback(async () => {
        try {
            const response = await api.get('/ai/patterns/stats');
            return response.data;
        } catch (error) {
            console.error('[VoiceApproval] Failed to get pattern stats:', error);
            return null;
        }
    }, []);

    // Initial fetch of pending actions
    useEffect(() => {
        refreshPendingActions();
    }, [projectId]);

    return {
        // Voice controls
        voiceState: voice.state,
        voiceSettings: voice.settings,
        isSupported: voice.isSupported,
        startListening: voice.startListening,
        stopListening: voice.stopListening,
        toggleListening: voice.toggleListening,
        speak: voice.speak,
        stopSpeaking: voice.stopSpeaking,
        startConversation: voice.startConversation,
        endConversation: voice.endConversation,
        updateSettings: voice.updateSettings,
        
        // Approval state
        pendingActions,
        currentAction,
        currentActionIndex,
        isLoading,
        lastCommandResult,
        
        // Approval controls
        approveCurrentAction,
        rejectCurrentAction,
        skipToNextAction,
        refreshPendingActions,
        readCurrentActionDetails,
        
        // Pattern management
        toggleAutoApply,
        getPatternStats
    };
}

export default useVoiceApproval;


