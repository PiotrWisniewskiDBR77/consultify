import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
    AppView,
    SessionMode,
    User,
    AuthStep,
    FreeSession,
    FullSession,
    ChatMessage,
    Notification
} from '../types';
import { NavigationOptions, WorkspaceContext } from '../types/workspace';

interface AppState {
    currentView: AppView;
    sessionMode: SessionMode;
    currentUser: User | null;
    authInitialStep: AuthStep;
    isSidebarOpen: boolean;
    isSidebarCollapsed: boolean;
    toggleSidebarCollapse: () => void;

    // Chat Panel Visibility
    isChatCollapsed: boolean;
    toggleChatCollapse: () => void;

    // Chat Panel Width (persisted across module changes)
    chatPanelWidth: number;
    setChatPanelWidth: (width: number) => void;

    // Chat Sliding Panel (Claude-style sidebar)
    isChatSlidingPanelOpen: boolean;
    toggleChatSlidingPanel: () => void;
    setChatSlidingPanelOpen: (open: boolean) => void;

    // Side Panels (Mutually Exclusive)
    activeSidePanel: 'HELP' | 'DOCUMENTS' | 'FEEDBACK' | null;
    toggleSidePanel: (panel: 'HELP' | 'DOCUMENTS' | 'FEEDBACK') => void;
    closeSidePanel: () => void;

    // Report Context (for report-centric assessment workflow)
    currentReportId: string | null;
    currentReportMode: 'new' | 'view' | 'edit';
    setCurrentReport: (id: string | null, mode: 'new' | 'view' | 'edit') => void;

    // Chat State
    activeChatMessages: ChatMessage[];
    projectChatMessages: Record<string, ChatMessage[]>; // MED-01: Per-project chat storage
    isBotTyping: boolean;
    /* 
     * PERFORMANCE CRITICAL: 
     * `currentStreamContent` is for high-frequency updates (typing effect).
     * It is EXCLUDED from persistence. 
     * DO NOT use `activeChatMessages` for streaming as it triggers sync localStorage writes 
     * which will freeze the main thread.
     */
    currentStreamContent: string; // Non-persisted high-frequency update

    freeSessionData: Partial<FreeSession>;
    fullSessionData: FullSession;

    // Project Context
    currentProjectId: string | null;
    setCurrentProjectId: (projectId: string | null) => void;

    // LLM Model Selection
    aiConfig: {
        autoMode: boolean;
        maxMode: boolean; // Acts as "REASONING" tier toggle often
        multiModel: boolean;
        selectedModelId: string | null; // Keep for backward compatibility / admin override
        selectedTier: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING' | null;
    };
    setAIConfig: (config: Partial<AppState['aiConfig']>) => void;

    // Notifications
    notifications: Notification[];
    addNotification: (notification: Notification) => void;
    markNotificationAsRead: (id: string) => void;
    clearNotifications: () => void;

    // Organization Context
    currentOrganization: { id: string; name: string } | null;
    setCurrentOrganization: (org: { id: string; name: string } | null) => void;

    // Actions
    setCurrentView: (view: AppView) => void;
    setSessionMode: (mode: SessionMode) => void;
    setCurrentUser: (user: User | null) => void;
    setAuthInitialStep: (step: AuthStep) => void;
    setIsSidebarOpen: (isOpen: boolean) => void;

    // Chat Actions
    addChatMessage: (message: ChatMessage) => void;
    setChatMessages: (messages: ChatMessage[]) => void;
    setIsBotTyping: (isTyping: boolean) => void;
    setCurrentStreamContent: (content: string) => void;
    clearChat: () => void;
    // MED-01: Per-project chat actions
    loadProjectChat: () => void;
    saveProjectChat: () => void;
    // World-Class Chat 2025: Edit and regenerate actions
    editChatMessage: (messageId: string, newContent: string) => void;
    deleteChatMessage: (messageId: string) => void;
    setMessageFeedback: (messageId: string, feedback: { rating: 'positive' | 'negative'; reason?: string }) => void;

    setFreeSessionData: (data: Partial<FreeSession> | ((prev: Partial<FreeSession>) => Partial<FreeSession>)) => void;
    setFullSessionData: (data: Partial<FullSession> | ((prev: FullSession) => FullSession)) => void;
    logout: () => void;
    theme: 'light' | 'dark' | 'system';
    toggleTheme: (newTheme?: 'light' | 'dark' | 'system') => void;
    updateLastChatMessage: (content: string) => void;

    // AI Freeze Status (Budget/Hard Freeze)
    aiFreezeStatus: {
        isFrozen: boolean;
        reason: string | null;
        scope: string | null;
    };
    setAiFreezeStatus: (status: Partial<AppState['aiFreezeStatus']>) => void;

    // ==================== UNIFIED CHAT NAVIGATION ====================
    /**
     * Previous view for "back" functionality
     */
    previousView: AppView | null;
    
    /**
     * Navigate to a view while preserving chat context
     * This triggers the conversation store to switch to split mode
     */
    navigateWithChatContext: (view: AppView, options?: NavigationOptions) => void;
    
    /**
     * Return to full-screen AI Chat view
     */
    returnToFullChat: () => void;
    
    /**
     * Set previous view for navigation
     */
    setPreviousView: (view: AppView | null) => void;
}


const initialFreeSession: Partial<FreeSession> = {
    painPoints: [],
    goal: '',
    timeHorizon: '',
    step1Completed: false,
    step2Completed: false,
    step3Completed: false,
};

const initialFullSession: FullSession = {
    id: '',
    assessment: {
        completedAxes: [],
        processes: { actual: 1, target: 1, justification: '', notes: '' },
        digitalProducts: { actual: 1, target: 1, justification: '', notes: '' },
        businessModels: { actual: 1, target: 1, justification: '', notes: '' },
        dataManagement: { actual: 1, target: 1, justification: '', notes: '' },
        culture: { actual: 1, target: 1, justification: '', notes: '' },
        cybersecurity: { actual: 1, target: 1, justification: '', notes: '' },
        aiMaturity: { actual: 1, target: 1, justification: '', notes: '' },
    },
    audits: [],
    roadmap: [],
    initiatives: [],
    economics: { totalCost: 0, totalAnnualBenefit: 0, overallROI: 0, paybackPeriodYears: 0 },
    step1Completed: false,
    step2Completed: false,
    step3Completed: false,
    step4Completed: false,
    step5Completed: false
};

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            currentView: AppView.WELCOME,
            sessionMode: SessionMode.FREE,
            currentUser: null,
            authInitialStep: AuthStep.REGISTER,
            isSidebarOpen: false,
            activeChatMessages: [],
            projectChatMessages: {}, // MED-01: Per-project chat storage
            isBotTyping: false,
            currentStreamContent: '',
            freeSessionData: initialFreeSession,
            fullSessionData: initialFullSession,
            currentProjectId: null,
            notifications: [],

            // AI Config
            aiConfig: {
                autoMode: true,
                maxMode: false,
                multiModel: false,
                selectedModelId: null,
                selectedTier: 'BUDGET' // Default to BUDGET
            },
            setAIConfig: (newConfig) => set((state) => ({
                aiConfig: { ...state.aiConfig, ...newConfig }
            })),

            addNotification: (notification) => set((state) => ({ notifications: [notification, ...state.notifications] })),
            markNotificationAsRead: (id) => set((state) => ({
                notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
            })),
            clearNotifications: () => set({ notifications: [] }),

            currentOrganization: null,
            setCurrentOrganization: (org) => set({ currentOrganization: org }),

            setCurrentView: (view) => set({ currentView: view }),
            setSessionMode: (mode) => set({ sessionMode: mode }),
            setCurrentUser: (user) => set({ currentUser: user }),
            setAuthInitialStep: (step) => set({ authInitialStep: step }),
            setIsSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
            isSidebarCollapsed: true,
            toggleSidebarCollapse: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

            // Chat Panel Visibility
            isChatCollapsed: false,
            toggleChatCollapse: () => set((state) => ({ isChatCollapsed: !state.isChatCollapsed })),

            // Chat Sliding Panel (Claude-style sidebar)
            isChatSlidingPanelOpen: false,
            toggleChatSlidingPanel: () => set((state) => ({ isChatSlidingPanelOpen: !state.isChatSlidingPanelOpen })),
            setChatSlidingPanelOpen: (open) => set({ isChatSlidingPanelOpen: open }),

            // Side Panels
            activeSidePanel: null,
            toggleSidePanel: (panel) => set((state) => ({
                activeSidePanel: state.activeSidePanel === panel ? null : panel
            })),
            closeSidePanel: () => set({ activeSidePanel: null }),

            // Chat Panel Width (persisted across module changes)
            chatPanelWidth: 380,
            setChatPanelWidth: (width) => set({ chatPanelWidth: width }),

            // Report Context (for report-centric assessment workflow)
            currentReportId: null,
            currentReportMode: 'new',
            setCurrentReport: (id, mode) => set({ currentReportId: id, currentReportMode: mode }),

            setCurrentProjectId: (pid) => set((state) => {
                // MED-01: Save current chat before switching projects
                const MAX_MESSAGES = 100;
                const currentKey = state.currentProjectId || 'global';
                const trimmedMessages = state.activeChatMessages.slice(-MAX_MESSAGES);

                // Load chat for new project
                const newMessages = pid ? (state.projectChatMessages[pid] || []) : [];

                return {
                    currentProjectId: pid,
                    activeChatMessages: newMessages,
                    projectChatMessages: {
                        ...state.projectChatMessages,
                        [currentKey]: trimmedMessages
                    }
                };
            }),

            addChatMessage: (message) => set((state) => {
                const MAX_MESSAGES = 100;
                const newMessages = [...state.activeChatMessages, message].slice(-MAX_MESSAGES);
                const projectKey = state.currentProjectId || 'global';

                return {
                    activeChatMessages: newMessages,
                    projectChatMessages: {
                        ...state.projectChatMessages,
                        [projectKey]: newMessages
                    }
                };
            }),
            setChatMessages: (messages) => set((state) => {
                const projectKey = state.currentProjectId || 'global';
                const trimmedMessages = messages.slice(-100);
                return {
                    activeChatMessages: trimmedMessages,
                    projectChatMessages: {
                        ...state.projectChatMessages,
                        [projectKey]: trimmedMessages
                    }
                };
            }),
            setIsBotTyping: (isTyping) => set({ isBotTyping: isTyping }),
            setCurrentStreamContent: (content) => set({ currentStreamContent: content }),
            clearChat: () => set((state) => {
                const projectKey = state.currentProjectId || 'global';
                return {
                    activeChatMessages: [],
                    projectChatMessages: {
                        ...state.projectChatMessages,
                        [projectKey]: []
                    }
                };
            }),
            // MED-01: Helper functions for project chat - moved outside persist to avoid circular reference
            loadProjectChat: () => set((state) => {
                const projectKey = state.currentProjectId || 'global';
                const messages = state.projectChatMessages[projectKey] || [];
                return { activeChatMessages: messages };
            }),
            saveProjectChat: () => set((state) => {
                const projectKey = state.currentProjectId || 'global';
                const MAX_MESSAGES = 100;
                const trimmedMessages = state.activeChatMessages.slice(-MAX_MESSAGES);
                return {
                    projectChatMessages: {
                        ...state.projectChatMessages,
                        [projectKey]: trimmedMessages
                    }
                };
            }),

            // World-Class Chat 2025: Edit, delete, and feedback actions
            editChatMessage: (messageId, newContent) => set((state) => {
                const projectKey = state.currentProjectId || 'global';
                const messages = state.activeChatMessages.map(msg =>
                    msg.id === messageId
                        ? { ...msg, content: newContent, canEdit: true }
                        : msg
                );
                return {
                    activeChatMessages: messages,
                    projectChatMessages: {
                        ...state.projectChatMessages,
                        [projectKey]: messages
                    }
                };
            }),

            deleteChatMessage: (messageId) => set((state) => {
                const projectKey = state.currentProjectId || 'global';
                const messages = state.activeChatMessages.filter(msg => msg.id !== messageId);
                return {
                    activeChatMessages: messages,
                    projectChatMessages: {
                        ...state.projectChatMessages,
                        [projectKey]: messages
                    }
                };
            }),

            setMessageFeedback: (messageId, feedback) => set((state) => {
                const projectKey = state.currentProjectId || 'global';
                const messages = state.activeChatMessages.map(msg =>
                    msg.id === messageId
                        ? {
                            ...msg,
                            feedback: {
                                rating: feedback.rating,
                                reason: feedback.reason,
                                timestamp: new Date()
                            }
                        }
                        : msg
                );
                return {
                    activeChatMessages: messages,
                    projectChatMessages: {
                        ...state.projectChatMessages,
                        [projectKey]: messages
                    }
                };
            }),

            setFreeSessionData: (data) => set((state) => ({
                freeSessionData: typeof data === 'function' ? data(state.freeSessionData) : { ...state.freeSessionData, ...data }
            })),

            setFullSessionData: (data) => set((state) => ({
                fullSessionData: typeof data === 'function' ? data(state.fullSessionData) : { ...state.fullSessionData, ...data }
            })),

            logout: () => set({
                currentUser: null,
                currentView: AppView.WELCOME,
                isSidebarOpen: false,
                activeChatMessages: [],
                freeSessionData: initialFreeSession,
                fullSessionData: initialFullSession,
                currentProjectId: null,
                notifications: [],
                aiConfig: { autoMode: true, maxMode: false, multiModel: false, selectedModelId: null, selectedTier: 'BUDGET' }
            }),
            theme: 'dark', // Default
            toggleTheme: (newTheme) => set((state) => {
                if (newTheme) return { theme: newTheme };
                return { theme: state.theme === 'dark' ? 'light' : 'dark' };
            }),

            updateLastChatMessage: (content: string) => set((state) => {
                const messages = [...state.activeChatMessages];
                if (messages.length > 0) {
                    const lastMsg = messages[messages.length - 1];
                    // Only update if it's an AI message (safety check)
                    if (lastMsg.role === 'ai') {
                        messages[messages.length - 1] = { ...lastMsg, content: content }; // Replace content
                    }
                }
                return { activeChatMessages: messages };
            }),

            aiFreezeStatus: {
                isFrozen: false,
                reason: null,
                scope: null
            },
            setAiFreezeStatus: (status) => set((state) => ({
                aiFreezeStatus: { ...state.aiFreezeStatus, ...status }
            })),

            // ==================== UNIFIED CHAT NAVIGATION ====================
            previousView: null,
            
            navigateWithChatContext: (view: AppView, options?: NavigationOptions) => set((state) => {
                console.log('[AppStore] navigateWithChatContext:', view, options);
                
                // Import conversation store dynamically to avoid circular dependency
                // The actual displayMode change happens in useConversationStore
                // Here we just handle the view change
                const newState: Partial<AppState> = {
                    previousView: state.currentView,
                    currentView: view
                };
                
                return newState;
            }),
            
            returnToFullChat: () => set((state) => {
                console.log('[AppStore] returnToFullChat from:', state.currentView);
                return {
                    previousView: state.currentView,
                    currentView: AppView.AI_CHAT
                };
            }),
            
            setPreviousView: (view: AppView | null) => set({ previousView: view }),
        }),

        {
            name: 'consultify-storage', // unique name for localStorage
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                currentView: state.currentView,
                sessionMode: state.sessionMode,
                currentUser: state.currentUser,
                activeChatMessages: state.activeChatMessages, // Persisting chat!
                projectChatMessages: state.projectChatMessages, // MED-01: Persist per-project chat
                freeSessionData: state.freeSessionData,
                fullSessionData: state.fullSessionData,
                currentProjectId: state.currentProjectId,
                aiConfig: state.aiConfig,
                theme: state.theme,
                notifications: state.notifications,
                currentOrganization: state.currentOrganization,
                isChatCollapsed: state.isChatCollapsed,
                chatPanelWidth: state.chatPanelWidth,
                isChatSlidingPanelOpen: state.isChatSlidingPanelOpen,
                previousView: state.previousView // Unified Chat System
            }),
        }
    )
);
