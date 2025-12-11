import { create } from 'zustand';
import {
    AppView,
    SessionMode,
    User,
    AuthStep,
    Language,
    FreeSession,
    FullSession,
    ChatMessage,
    UserRole
} from './types';


interface AppState {
    // Navigation & UI
    currentView: AppView;
    sessionMode: SessionMode;
    language: Language;
    isSidebarOpen: boolean;

    // Auth
    currentUser: User | null;
    authInitialStep: AuthStep;

    // Session Data
    freeSessionData: Partial<FreeSession>;
    fullSessionData: FullSession;

    // Chat
    messages: ChatMessage[];
    isTyping: boolean;
    chatHandler: (text: string) => void;

    // Actions
    setAppView: (view: AppView) => void;
    setSessionMode: (mode: SessionMode) => void;
    setLanguage: (lang: Language) => void;
    toggleSidebar: () => void;
    setSidebarOpen: (isOpen: boolean) => void;

    setCurrentUser: (user: User | null) => void;
    setAuthInitialStep: (step: AuthStep) => void;

    updateFreeSession: (data: Partial<FreeSession>) => void;
    updateFullSession: (data: Partial<FullSession>) => void;

    addMessage: (message: ChatMessage) => void;
    setTyping: (isTyping: boolean) => void;
    setChatHandler: (handler: (text: string) => void) => void;
    resetSession: () => void;
}

// Initial States
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
        processes: { actual: 1, target: 1, justification: '', notes: '' },
        digitalProducts: { actual: 1, target: 1, justification: '', notes: '' },
        businessModels: { actual: 1, target: 1, justification: '', notes: '' },
        dataManagement: { actual: 1, target: 1, justification: '', notes: '' },
        culture: { actual: 1, target: 1, justification: '', notes: '' },
        cybersecurity: { actual: 1, target: 1, justification: '', notes: '' },
        aiMaturity: { actual: 1, target: 1, justification: '', notes: '' },
        completedAxes: []
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

export const useStore = create<AppState>((set) => ({
    // Defaults
    currentView: AppView.WELCOME,
    sessionMode: SessionMode.FREE,
    language: 'EN',
    isSidebarOpen: false,
    currentUser: null,
    authInitialStep: AuthStep.REGISTER,
    freeSessionData: initialFreeSession,
    fullSessionData: initialFullSession,
    messages: [],
    isTyping: false,
    chatHandler: () => { /* Default no-op handler */ },

    // Actions
    setAppView: (view) => set({ currentView: view }),
    setSessionMode: (mode) => set({ sessionMode: mode }),
    setLanguage: (lang) => set({ language: lang }),
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),

    setCurrentUser: (user) => set({ currentUser: user }),
    setAuthInitialStep: (step) => set({ authInitialStep: step }),

    updateFreeSession: (data) => set((state) => ({
        freeSessionData: { ...state.freeSessionData, ...data }
    })),

    updateFullSession: (data) => set((state) => ({
        fullSessionData: { ...state.fullSessionData, ...data }
    })),

    addMessage: (message) => set((state) => ({
        messages: [...state.messages, message]
    })),

    setTyping: (isTyping) => set({ isTyping }),
    setChatHandler: (handler) => set({ chatHandler: handler }),

    resetSession: () => set({
        currentUser: null,
        currentView: AppView.WELCOME,
        isSidebarOpen: false,
        freeSessionData: initialFreeSession,
        fullSessionData: initialFullSession,
        messages: []
    })
}));
