import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
    ScreenContextPayload,
    validateScreenContext,
    ScreenContextSchema
} from '../types/AIContract';
import { AppView, DRDAxis } from '../types';

// --- PMO Context Types ---
interface PMOContext {
    organizationId: string | null;
    projectId: string | null;
    currentPhase: string;
    currentScreen: string;
    userRole: string;
    selectedObject: { type: 'task' | 'initiative' | null; id: string | null };
    // AI Roles Model
    aiRole: 'ADVISOR' | 'MANAGER' | 'OPERATOR';
}

// --- Assessment Context Types ---
interface AssessmentContext {
    isInAssessmentMode: boolean;
    currentAxis: DRDAxis | null;
    currentScore: number | null;
    targetScore: number | null;
    justification: string | null;
    completedAxes: DRDAxis[];
    assessmentProgress: number; // 0-100
}

interface AIContextProps {
    isChatOpen: boolean;
    toggleChat: () => void;
    openChat: (initialMessage?: string) => void;
    // screenContext is now strictly typed
    screenContext: ScreenContextPayload | null;
    setScreenContext: (ctx: unknown) => void;
    globalContext: any;
    // NEW: Full PMO Context
    pmoContext: PMOContext;
    // NEW: Auto-summary trigger
    triggerProjectSummary: () => void;
    autoSummaryEnabled: boolean;
    setAutoSummaryEnabled: (enabled: boolean) => void;
    // NEW: Assessment Context
    assessmentContext: AssessmentContext;
    updateAssessmentContext: (update: Partial<AssessmentContext>) => void;
    clearAssessmentContext: () => void;
    // NEW: Assessment AI helpers
    requestAssessmentGuidance: (axisId: DRDAxis) => void;
    requestGapAnalysis: () => void;
}

const AIContext = createContext<AIContextProps | undefined>(undefined);

// Helper: Map AppView to Phase name
const viewToPhase = (view: AppView): string => {
    if (view.includes('ASSESSMENT')) return 'Assessment';
    if (view.includes('INITIATIVES')) return 'Planning';
    if (view.includes('ROADMAP')) return 'Planning';
    if (view.includes('ROI')) return 'Business Case';
    if (view.includes('EXECUTION')) return 'Execution';
    if (view.includes('PILOT')) return 'Pilot';
    if (view.includes('ROLLOUT')) return 'Rollout';
    if (view.includes('REPORTS')) return 'Reporting';
    if (view.includes('CONTEXT_BUILDER')) return 'Context Setup';
    if (view.includes('DASHBOARD')) return 'Overview';
    if (view.includes('ADMIN')) return 'Administration';
    if (view.includes('SETTINGS')) return 'Settings';
    return 'General';
};

// Helper: Map AppView to screen name
const viewToScreen = (view: AppView): string => {
    return view.replace(/_/g, ' ').toLowerCase();
};

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const {
        currentUser,
        currentProjectId,
        currentView,
        addChatMessage
    } = useAppStore();

    // Local state for chat visibility
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [autoSummaryEnabled, setAutoSummaryEnabled] = useState(true);
    const [lastSummarizedProject, setLastSummarizedProject] = useState<string | null>(null);

    // Strict Screen Context State
    const [screenContext, _setScreenContext] = useState<ScreenContextPayload | null>(null);

    // Selected object state (for task/initiative focus)
    const [selectedObject, setSelectedObject] = useState<{ type: 'task' | 'initiative' | null; id: string | null }>({ type: null, id: null });

    // AI Roles Model: Project AI role state
    const [projectAIRole, setProjectAIRole] = useState<'ADVISOR' | 'MANAGER' | 'OPERATOR'>('ADVISOR');

    // Assessment Context State
    const [assessmentContext, setAssessmentContext] = useState<AssessmentContext>({
        isInAssessmentMode: false,
        currentAxis: null,
        currentScore: null,
        targetScore: null,
        justification: null,
        completedAxes: [],
        assessmentProgress: 0
    });

    // Update assessment context
    const updateAssessmentContext = useCallback((update: Partial<AssessmentContext>) => {
        setAssessmentContext(prev => ({ ...prev, ...update }));
    }, []);

    // Clear assessment context
    const clearAssessmentContext = useCallback(() => {
        setAssessmentContext({
            isInAssessmentMode: false,
            currentAxis: null,
            currentScore: null,
            targetScore: null,
            justification: null,
            completedAxes: [],
            assessmentProgress: 0
        });
    }, []);

    // Request assessment guidance via chat
    const requestAssessmentGuidance = useCallback(async (axisId: DRDAxis) => {
        if (!currentProjectId) return;

        const axisNames: Record<DRDAxis, string> = {
            processes: 'Procesy Cyfrowe',
            digitalProducts: 'Produkty Cyfrowe',
            businessModels: 'Modele Biznesowe',
            dataManagement: 'Zarządzanie Danymi',
            culture: 'Kultura Organizacyjna',
            cybersecurity: 'Cyberbezpieczeństwo',
            aiMaturity: 'Dojrzałość AI'
        };

        const guidanceMsg = {
            id: `guidance-${Date.now()}`,
            role: 'ai' as const,
            content: `🎯 **Wsparcie AI dla: ${axisNames[axisId]}**

Jestem gotowy pomóc Ci z oceną tej osi. Mogę:
- Zasugerować odpowiedni poziom na podstawie opisu sytuacji
- Wyjaśnić różnice między poziomami
- Pomóc sformułować uzasadnienie
- Zasugerować dowody wspierające ocenę

**Jak mogę Ci pomóc?** Opisz aktualny stan w Twojej organizacji, a ja pomogę określić właściwy poziom.`,
            timestamp: new Date()
        };

        addChatMessage(guidanceMsg);
        setIsChatOpen(true);
    }, [currentProjectId, addChatMessage]);

    // Request gap analysis via chat
    const requestGapAnalysis = useCallback(async () => {
        if (!currentProjectId) return;

        const analysisMsg = {
            id: `gap-${Date.now()}`,
            role: 'ai' as const,
            content: `📊 **Analiza Luk - Assessment**

Analizuję Twoją ocenę dojrzałości cyfrowej...

${assessmentContext.completedAxes.length > 0 
    ? `✅ Ukończono ocenę ${assessmentContext.completedAxes.length} osi.`
    : '⏳ Rozpocznij ocenę osi, aby zobaczyć analizę luk.'}

${assessmentContext.currentAxis && assessmentContext.currentScore && assessmentContext.targetScore
    ? `\n**Aktualna oś:** ${assessmentContext.currentAxis}
**Obecny poziom:** ${assessmentContext.currentScore}/7
**Cel:** ${assessmentContext.targetScore}/7
**Gap:** ${assessmentContext.targetScore - assessmentContext.currentScore} poziomów`
    : ''}

Zapytaj mnie o:
- Szczegółową ścieżkę rozwoju dla wybranej osi
- Priorytetyzację obszarów do poprawy
- Szacowany czas i zasoby potrzebne do osiągnięcia celu`,
            timestamp: new Date()
        };

        addChatMessage(analysisMsg);
        setIsChatOpen(true);
    }, [currentProjectId, assessmentContext, addChatMessage]);

    // Auto-detect assessment mode from view
    useEffect(() => {
        const isAssessmentView = currentView.includes('ASSESSMENT') || 
                                  currentView.includes('FULL_STEP1') ||
                                  currentView.includes('FULL_STEP2') ||
                                  currentView.includes('FULL_STEP3') ||
                                  currentView.includes('FULL_STEP4') ||
                                  currentView.includes('FULL_STEP5');
        
        if (isAssessmentView !== assessmentContext.isInAssessmentMode) {
            updateAssessmentContext({ isInAssessmentMode: isAssessmentView });
        }
    }, [currentView, assessmentContext.isInAssessmentMode, updateAssessmentContext]);

    // Compute PMO Context from store
    const pmoContext = useMemo<PMOContext>(() => ({
        organizationId: currentUser?.organizationId || null,
        projectId: currentProjectId,
        currentPhase: viewToPhase(currentView),
        currentScreen: viewToScreen(currentView),
        userRole: currentUser?.role || 'user',
        selectedObject,
        // AI Roles Model
        aiRole: projectAIRole
    }), [currentUser?.organizationId, currentProjectId, currentView, currentUser?.role, selectedObject, projectAIRole]);

    // Robust setter with validation
    const setScreenContext = useCallback((rawContext: unknown) => {
        // If null/undefined passed, clear context
        if (!rawContext) {
            _setScreenContext(null);
            return;
        }

        // Validate against contract
        const validContext = validateScreenContext(rawContext);
        if (validContext) {
            _setScreenContext(validContext);
        } else {
            console.warn("[AIContext] Invalid context payload rejected", rawContext);
        }
    }, []);

    const toggleChat = () => setIsChatOpen(prev => !prev);

    const openChat = (initialMessage?: string) => {
        setIsChatOpen(true);
        if (initialMessage) {
            console.log("Open with message:", initialMessage);
        }
    };

    // NEW: Trigger project summary with REAL data
    const triggerProjectSummary = useCallback(async () => {
        if (!currentProjectId || !currentUser) {
            console.log('[AIContext] Cannot summarize: no project or user');
            return;
        }

        try {
            // Fetch real PMO context from backend
            const { Api } = await import('../services/api');
            const pmoData = await Api.getPMOContext(currentProjectId);

            // Build summary message with real data
            const phase = pmoData.currentPhase || 'Unknown';
            const phaseNum = pmoData.phaseNumber || '?';
            const totalPhases = pmoData.totalPhases || 6;
            const gateStatus = pmoData.gateStatus === 'READY' ? '✅ Ready' : '⏳ Not Ready';

            // Format blockers
            const blockers = pmoData.blockingIssues || [];
            const blockersText = blockers.length > 0
                ? `\n\n**🚨 Blocking Issues (${blockers.length}):**\n${blockers.slice(0, 3).map((b: any) => `- ${b.title}`).join('\n')}`
                : '\n\n✅ No blocking issues.';

            // Format pending decisions
            const decisions = pmoData.pendingDecisions || [];
            const decisionsText = decisions.length > 0
                ? `\n\n**📋 Pending Decisions (${decisions.length}):**\n${decisions.slice(0, 3).map((d: any) => `- ${d.title}`).join('\n')}`
                : '';

            // Format risks
            const risks = pmoData.risks || [];
            const risksText = risks.length > 0
                ? `\n\n**⚠️ Active Risks (${risks.length}):**\n${risks.slice(0, 2).map((r: any) => `- ${r.title}`).join('\n')}`
                : '';

            const welcomeMsg = {
                id: `auto-${Date.now()}`,
                role: 'ai' as const,
                content: `🔍 **Project Summary**

**Phase:** ${phaseNum}/${totalPhases} - ${phase}
**Gate Status:** ${gateStatus}
${blockersText}${decisionsText}${risksText}

---
_I'm ready to assist with your PMO tasks. Ask me about current status, blockers, or recommendations._`,
                timestamp: new Date()
            };

            addChatMessage(welcomeMsg);
            setIsChatOpen(true);
        } catch (error) {
            console.error('[AIContext] Failed to fetch PMO context:', error);

            // Fallback to static message
            const welcomeMsg = {
                id: `auto-${Date.now()}`,
                role: 'ai' as const,
                content: `🔍 **Project Context Loaded**

You are in the **${viewToPhase(currentView)}** phase.

I'm ready to assist with your PMO tasks. Ask me about:
- Current project status
- Blockers and risks
- Pending decisions
- Task recommendations

_Context: ${pmoContext.currentScreen}_`,
                timestamp: new Date()
            };

            addChatMessage(welcomeMsg);
            setIsChatOpen(true);
        }
    }, [currentProjectId, currentUser, currentView, pmoContext.currentScreen, addChatMessage]);

    // Auto-trigger summary on project change
    useEffect(() => {
        if (autoSummaryEnabled && currentProjectId && currentUser && currentProjectId !== lastSummarizedProject) {
            // Small delay to let UI settle
            const timer = setTimeout(() => {
                triggerProjectSummary();
                setLastSummarizedProject(currentProjectId);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [currentProjectId, currentUser, autoSummaryEnabled, lastSummarizedProject, triggerProjectSummary]);

    // AI Roles Model: Fetch project AI role when project changes
    useEffect(() => {
        if (currentProjectId) {
            const fetchAIRole = async () => {
                try {
                    const { Api } = await import('../services/api');
                    const response = await Api.get(`/api/projects/${currentProjectId}/ai-role`);
                    if (response?.aiRole) {
                        setProjectAIRole(response.aiRole);
                    }
                } catch (error) {
                    console.warn('[AIContext] Failed to fetch AI role, defaulting to ADVISOR:', error);
                    setProjectAIRole('ADVISOR');
                }
            };
            fetchAIRole();
        } else {
            setProjectAIRole('ADVISOR');
        }
    }, [currentProjectId]);

    const globalContext = {
        user: currentUser,
        company: currentUser ? { name: currentUser.companyName } : null,
        // Include PMO context in global context for API calls
        pmo: pmoContext,
        // Include Assessment context for AI calls
        assessment: assessmentContext
    };

    return (
        <AIContext.Provider value={{
            isChatOpen,
            toggleChat,
            openChat,
            screenContext,
            setScreenContext,
            globalContext,
            pmoContext,
            triggerProjectSummary,
            autoSummaryEnabled,
            setAutoSummaryEnabled,
            // Assessment context
            assessmentContext,
            updateAssessmentContext,
            clearAssessmentContext,
            requestAssessmentGuidance,
            requestGapAnalysis
        }}>
            {children}
        </AIContext.Provider>
    );
};

export const useAIContext = () => {
    const context = useContext(AIContext);
    if (!context) {
        throw new Error('useAIContext must be used within an AIProvider');
    }
    return context;
};

