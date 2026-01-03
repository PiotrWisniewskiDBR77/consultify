import { StateCreator } from 'zustand';
import { AppState } from '../useAppStore';
import { FreeSession, FullSession, Notification } from '../../types';

export interface ProjectSlice {
    currentProjectId: string | null;
    freeSessionData: Partial<FreeSession>;
    fullSessionData: FullSession;
    notifications: Notification[];

    // Report Context
    currentReportId: string | null;
    currentReportMode: 'new' | 'view' | 'edit';

    // Actions
    setCurrentProjectId: (projectId: string | null) => void;
    setFreeSessionData: (data: Partial<FreeSession> | ((prev: Partial<FreeSession>) => Partial<FreeSession>)) => void;
    setFullSessionData: (data: Partial<FullSession> | ((prev: FullSession) => FullSession)) => void;
    addNotification: (notification: Notification) => void;
    markNotificationAsRead: (id: string) => void;
    clearNotifications: () => void;
    setCurrentReport: (id: string | null, mode: 'new' | 'view' | 'edit') => void;
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

export const createProjectSlice: StateCreator<AppState, [], [], ProjectSlice> = (set) => ({
    currentProjectId: null,
    freeSessionData: initialFreeSession,
    fullSessionData: initialFullSession,
    notifications: [],

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

    setFreeSessionData: (data) => set((state) => ({
        freeSessionData: typeof data === 'function' ? data(state.freeSessionData) : { ...state.freeSessionData, ...data }
    })),

    setFullSessionData: (data) => set((state) => ({
        fullSessionData: typeof data === 'function' ? data(state.fullSessionData) : { ...state.fullSessionData, ...data }
    })),

    addNotification: (notification) => set((state) => ({ notifications: [notification, ...state.notifications] })),
    markNotificationAsRead: (id) => set((state) => ({
        notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
    })),
    clearNotifications: () => set({ notifications: [] }),
});
