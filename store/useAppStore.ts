import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
    AppView,
    SessionMode,
    User,
    AuthStep,
    Language,
    FreeSession,
    FullSession,
    ChatMessage,
    Notification
} from '../types';

interface AppState {
    currentView: AppView;
    sessionMode: SessionMode;
    currentUser: User | null;
    authInitialStep: AuthStep;
    language: Language;
    isSidebarOpen: boolean;
    isSidebarCollapsed: boolean;
    toggleSidebarCollapse: () => void;

    // Chat State
    activeChatMessages: ChatMessage[];
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
        maxMode: boolean;
        multiModel: boolean;
        selectedModelId: string | null;
    };
    setAIConfig: (config: Partial<AppState['aiConfig']>) => void;

    // Notifications
    notifications: Notification[];
    addNotification: (notification: Notification) => void;
    markNotificationAsRead: (id: string) => void;
    clearNotifications: () => void;

    // Actions
    setCurrentView: (view: AppView) => void;
    setSessionMode: (mode: SessionMode) => void;
    setCurrentUser: (user: User | null) => void;
    setAuthInitialStep: (step: AuthStep) => void;
    setLanguage: (lang: Language) => void;
    setIsSidebarOpen: (isOpen: boolean) => void;

    // Chat Actions
    addChatMessage: (message: ChatMessage) => void;
    setChatMessages: (messages: ChatMessage[]) => void;
    setIsBotTyping: (isTyping: boolean) => void;
    setCurrentStreamContent: (content: string) => void;
    clearChat: () => void;

    setFreeSessionData: (data: Partial<FreeSession> | ((prev: Partial<FreeSession>) => Partial<FreeSession>)) => void;
    setFullSessionData: (data: Partial<FullSession> | ((prev: FullSession) => FullSession)) => void;
    logout: () => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    updateLastChatMessage: (content: string) => void;
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
            language: 'EN',
            isSidebarOpen: false,
            activeChatMessages: [],
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
                selectedModelId: null
            },
            setAIConfig: (newConfig) => set((state) => ({
                aiConfig: { ...state.aiConfig, ...newConfig }
            })),

            addNotification: (notification) => set((state) => ({ notifications: [notification, ...state.notifications] })),
            markNotificationAsRead: (id) => set((state) => ({
                notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
            })),
            clearNotifications: () => set({ notifications: [] }),

            setCurrentView: (view) => set({ currentView: view }),
            setSessionMode: (mode) => set({ sessionMode: mode }),
            setCurrentUser: (user) => set({ currentUser: user }),
            setAuthInitialStep: (step) => set({ authInitialStep: step }),
            setLanguage: (lang) => set({ language: lang }),
            setIsSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
            isSidebarCollapsed: false,
            toggleSidebarCollapse: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

            setCurrentProjectId: (pid) => set({ currentProjectId: pid }),

            addChatMessage: (message) => set((state) => ({ activeChatMessages: [...state.activeChatMessages, message] })),
            setChatMessages: (messages) => set({ activeChatMessages: messages }),
            setIsBotTyping: (isTyping) => set({ isBotTyping: isTyping }),
            setCurrentStreamContent: (content) => set({ currentStreamContent: content }),
            clearChat: () => set({ activeChatMessages: [] }),

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
                aiConfig: { autoMode: true, maxMode: false, multiModel: false, selectedModelId: null }
            }),
            theme: 'dark',
            toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

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
        }),
        {
            name: 'consultify-storage', // unique name for localStorage
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                currentView: state.currentView,
                sessionMode: state.sessionMode,
                currentUser: state.currentUser,
                language: state.language,
                activeChatMessages: state.activeChatMessages, // Persisting chat!
                freeSessionData: state.freeSessionData,
                fullSessionData: state.fullSessionData,
                currentProjectId: state.currentProjectId,
                aiConfig: state.aiConfig,
                theme: state.theme,
                notifications: state.notifications
            }),
        }
    )
);
