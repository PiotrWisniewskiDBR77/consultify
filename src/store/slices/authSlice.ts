import { StateCreator } from 'zustand';

import { AppView, AuthStep, SessionMode, User } from '../../types';
import { AppState } from '../useAppStore';

export interface AuthSlice {
  currentUser: User | null;
  sessionMode: SessionMode;
  authInitialStep: AuthStep;
  currentOrganization: { id: string; name: string } | null;
  isAuthInitializing: boolean; // Prevents form remount during auth check

  // Actions
  setCurrentUser: (user: User | null) => void;
  setSessionMode: (mode: SessionMode) => void;
  setAuthInitialStep: (step: AuthStep) => void;
  setCurrentOrganization: (org: { id: string; name: string } | null) => void;
  setAuthInitializing: (value: boolean) => void;
  logout: () => void;
}

export const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set) => ({
  currentUser: null,
  sessionMode: SessionMode.FREE,
  authInitialStep: AuthStep.REGISTER,
  currentOrganization: null,
  isAuthInitializing: true, // Start as true, will be set to false after initial auth check

  setCurrentUser: (user) => set({ currentUser: user }),
  setSessionMode: (mode) => set({ sessionMode: mode }),
  setAuthInitialStep: (step) => set({ authInitialStep: step }),
  setCurrentOrganization: (org) => set({ currentOrganization: org }),
  setAuthInitializing: (value) => set({ isAuthInitializing: value }),

  logout: () => {
    // Get token BEFORE removing it (for API logout call)
    const token = localStorage.getItem('token');

    // Clear ALL auth-related localStorage items
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('consultify-storage');
    localStorage.removeItem('consultify_demo_session');
    localStorage.removeItem('consultify_current_org_id');
    localStorage.removeItem('demo_events');

    try {
      sessionStorage.removeItem('isDemo');
      sessionStorage.removeItem('demo_session_id');
      sessionStorage.removeItem('demo_events');
    } catch {
      // ignore
    }

    // Call API logout (fire and forget)
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {}); // Ignore errors
    }

    // Force page refresh to clear all state
    window.location.href = '/';

    set({
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
      aiConfig: {
        autoMode: true,
        maxMode: false,
        multiModel: false,
        selectedModelId: null,
        // Keep chat experience competitive after logout/login cycles.
        selectedTier: 'STANDARD',
        deepResearch: false,
        marketResearch: false,
        coThinkerMode: null,
        privateMode: false,
        webSearch: true,
        showReasoning: false,
        multiAgent: false,
        knowledgeSources: {
          pmoDocuments: true,
          projectData: true,
          organizationData: false,
        },
        responseStyle: 'normal' as const,
        textToSpeech: false,
        ttsVoice: 'default',
        ttsRate: 1.0,
        ttsPitch: 1.0,
      },

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
        step5Completed: false,
      },
    });
  },
});
