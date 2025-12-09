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
    ChatMessage
} from '../types';

interface AppState {
    currentView: AppView;
    sessionMode: SessionMode;
    currentUser: User | null;
    authInitialStep: AuthStep;
    language: Language;
    isSidebarOpen: boolean;

    // Chat State
    activeChatMessages: ChatMessage[];
    isBotTyping: boolean;

    freeSessionData: Partial<FreeSession>;
    fullSessionData: FullSession;

    // Project Context
    currentProjectId: string | null;
    setCurrentProjectId: (projectId: string | null) => void;

    // LLM Model Selection
    selectedModelId: string | null;
    setSelectedModelId: (modelId: string | null) => void;

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
    clearChat: () => void;

    setFreeSessionData: (data: Partial<FreeSession> | ((prev: Partial<FreeSession>) => Partial<FreeSession>)) => void;
    setFullSessionData: (data: Partial<FullSession> | ((prev: FullSession) => FullSession)) => void;
    logout: () => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
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
    assessment: {
        processes: { score: 0, answers: [], status: 'NOT_STARTED' },
        digitalProducts: { score: 0, answers: [], status: 'NOT_STARTED' },
        businessModels: { score: 0, answers: [], status: 'NOT_STARTED' },
        dataManagement: { score: 0, answers: [], status: 'NOT_STARTED' },
        culture: { score: 0, answers: [], status: 'NOT_STARTED' },
        cybersecurity: { score: 0, answers: [], status: 'NOT_STARTED' },
        aiMaturity: { score: 0, answers: [], status: 'NOT_STARTED' },
        completedAxes: []
    },
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
            freeSessionData: initialFreeSession,
            fullSessionData: initialFullSession,
            currentProjectId: null,
            selectedModelId: null,

            setCurrentView: (view) => set({ currentView: view }),
            setSessionMode: (mode) => set({ sessionMode: mode }),
            setCurrentUser: (user) => set({ currentUser: user }),
            setAuthInitialStep: (step) => set({ authInitialStep: step }),
            setLanguage: (lang) => set({ language: lang }),
            setIsSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
            setCurrentProjectId: (pid) => set({ currentProjectId: pid }),
            setSelectedModelId: (modelId) => set({ selectedModelId: modelId }),

            addChatMessage: (message) => set((state) => ({ activeChatMessages: [...state.activeChatMessages, message] })),
            setChatMessages: (messages) => set({ activeChatMessages: messages }),
            setIsBotTyping: (isTyping) => set({ isBotTyping: isTyping }),
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
                selectedModelId: null
            }),
            theme: 'dark',
            toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
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
                selectedModelId: state.selectedModelId,
                theme: state.theme
            }),
        }
    )
);
