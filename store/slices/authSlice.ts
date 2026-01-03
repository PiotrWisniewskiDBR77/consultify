import { StateCreator } from 'zustand';
import { AppState } from '../useAppStore';
import { User, SessionMode, AuthStep, AppView } from '../../types';

export interface AuthSlice {
    currentUser: User | null;
    sessionMode: SessionMode;
    authInitialStep: AuthStep;
    currentOrganization: { id: string; name: string } | null;

    // Actions
    setCurrentUser: (user: User | null) => void;
    setSessionMode: (mode: SessionMode) => void;
    setAuthInitialStep: (step: AuthStep) => void;
    setCurrentOrganization: (org: { id: string; name: string } | null) => void;
    logout: () => void;
}

export const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set) => ({
    currentUser: null,
    sessionMode: SessionMode.FREE,
    authInitialStep: AuthStep.REGISTER,
    currentOrganization: null,

    setCurrentUser: (user) => set({ currentUser: user }),
    setSessionMode: (mode) => set({ sessionMode: mode }),
    setAuthInitialStep: (step) => set({ authInitialStep: step }),
    setCurrentOrganization: (org) => set({ currentOrganization: org }),

    logout: () => set((state) => ({
        // Auth Reset
        currentUser: null,
        currentOrganization: null,
        sessionMode: SessionMode.FREE,

        // UI Reset
        currentView: AppView.WELCOME,
        isSidebarOpen: false,
        activeSidePanel: null,

        // Chat Reset
        activeChatMessages: [],
        currentStreamContent: '',
        aiConfig: { autoMode: true, maxMode: false, multiModel: false, selectedModelId: null, selectedTier: 'BUDGET' },

        // Project/Session Reset
        currentProjectId: null,
        notifications: [],
        freeSessionData: {
            painPoints: [],
            goal: '',
            timeHorizon: '',
            step1Completed: false,
            step2Completed: false,
            step3Completed: false,
        },
        fullSessionData: {
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
        }
    })),
});
