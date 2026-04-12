/**
 * Demo Mode Slice
 *
 * Manages demo mode state for viewing Acme Digital Corp demo data.
 * When enabled, user sees data from the demo organization instead of their own.
 */
import { StateCreator } from 'zustand';

import { AppState } from '../useAppStore';

// ==========================================
// TYPES
// ==========================================

export interface DemoOrganization {
  id: string;
  name: string;
  slug: string;
  description: string;
  industry?: string;
  size?: string;
  region?: string;
  branding?: {
    primaryColor: string;
    secondaryColor?: string;
    logo?: string;
  };
}

export interface DemoStats {
  projects: number;
  initiatives: number;
  tasks: number;
  assessments: number;
}

export interface DemoTour {
  id: string;
  name: string;
  description: string;
  duration: string;
  steps: number;
  category: 'beginner' | 'core' | 'advanced';
}

export interface DemoSlice {
  // State
  isDemoMode: boolean;
  demoSessionOrgId: string | null;
  demoLocale: 'en' | 'pl' | null;
  demoOrganization: DemoOrganization | null;
  demoStats: DemoStats | null;
  demoHints: string[];
  isDemoLoading: boolean;
  demoError: string | null;
  activeTour: DemoTour | null;
  availableTours: DemoTour[];

  // Actions
  setDemoMode: (enabled: boolean) => void;
  setDemoSessionOrgId: (organizationId: string | null) => void;
  setDemoLocale: (locale: 'en' | 'pl' | null) => void;
  setDemoOrganization: (org: DemoOrganization | null) => void;
  setDemoStats: (stats: DemoStats | null) => void;
  setDemoHints: (hints: string[]) => void;
  setDemoLoading: (loading: boolean) => void;
  setDemoError: (error: string | null) => void;
  setActiveTour: (tour: DemoTour | null) => void;
  setAvailableTours: (tours: DemoTour[]) => void;

  // Async actions will be in separate hooks
  resetDemoState: () => void;
}

// ==========================================
// INITIAL STATE
// ==========================================

const initialDemoState = {
  isDemoMode: false,
  demoSessionOrgId: null,
  demoLocale: null,
  demoOrganization: null,
  demoStats: null,
  demoHints: [],
  isDemoLoading: false,
  demoError: null,
  activeTour: null,
  availableTours: [],
};

// ==========================================
// SLICE CREATOR
// ==========================================

export const createDemoSlice: StateCreator<AppState, [], [], DemoSlice> = (set) => ({
  ...initialDemoState,

  setDemoMode: (enabled) => set({ isDemoMode: enabled }),

  setDemoSessionOrgId: (organizationId) => set({ demoSessionOrgId: organizationId }),

  setDemoLocale: (locale) => set({ demoLocale: locale }),

  setDemoOrganization: (org) => set({ demoOrganization: org }),

  setDemoStats: (stats) => set({ demoStats: stats }),

  setDemoHints: (hints) => set({ demoHints: hints }),

  setDemoLoading: (loading) => set({ isDemoLoading: loading }),

  setDemoError: (error) => set({ demoError: error }),

  setActiveTour: (tour) => set({ activeTour: tour }),

  setAvailableTours: (tours) => set({ availableTours: tours }),

  resetDemoState: () => set(initialDemoState),
});
