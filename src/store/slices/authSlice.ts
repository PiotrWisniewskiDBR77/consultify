import { StateCreator } from 'zustand';

import { clearOrganizationDefaultLanguageCache } from '../../services/languagePreference';
import { AppView, AuthStep, SessionMode, User } from '../../types';
import type { AppState } from '../useAppStore';

const USER_STORAGE_KEY = 'user';

function syncStoredUser(user: User | null) {
  try {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

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
  logout: (options?: { reload?: boolean }) => void;
}

export const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set) => ({
  currentUser: null,
  sessionMode: SessionMode.FREE,
  authInitialStep: AuthStep.LOGIN,
  currentOrganization: null,
  isAuthInitializing: true, // Start as true, will be set to false after initial auth check

  setCurrentUser: (user) => {
    syncStoredUser(user);
    set({ currentUser: user });
  },
  setSessionMode: (mode) => set({ sessionMode: mode }),
  setAuthInitialStep: (step) => set({ authInitialStep: step }),
  setCurrentOrganization: (org) => set({ currentOrganization: org }),
  setAuthInitializing: (value) => set({ isAuthInitializing: value }),

  logout: (options) => {
    const shouldReload = options?.reload ?? true;
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
      sessionStorage.removeItem('attribution_ref');
      sessionStorage.removeItem('attribution_invite');
    } catch {
      // ignore
    }
    // 2026-07-28 (język konta fix): don't let a shared browser tab carry the
    // previous account's organization-language guess into the next login.
    clearOrganizationDefaultLanguageCache();

    // Call API logout (fire and forget)
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {}); // Ignore errors
    }

    set({
      // Auth Reset
      currentUser: null,
      currentOrganization: null,
      sessionMode: SessionMode.FREE,
      authInitialStep: AuthStep.LOGIN,

      // UI Reset
      currentView: AppView.WELCOME,
      isSidebarOpen: false,
      activeSidePanel: null,

      // Demo Reset
      // Demo state is persisted together with the root Zustand store. Clearing
      // localStorage alone does not clear the live in-memory state, so a user
      // who logs out of the public demo and signs into a real workspace can
      // otherwise keep sending the stale demo organization header until the
      // next full reload.
      isDemoMode: false,
      demoSessionOrgId: null,
      demoExperienceType: null,
      demoLocale: null,
      demoOrganization: null,
      demoStats: null,
      demoHints: [],
      isDemoLoading: false,
      demoError: null,
      activeTour: null,
      availableTours: [],

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
          organizationData: true,
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

    if (shouldReload) {
      window.location.href = '/';
    }
  },
});
