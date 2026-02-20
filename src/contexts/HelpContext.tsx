/**
 * Help Context
 *
 * React Context for the In-App Help + Training + Playbooks system.
 * Provides contextual help based on AccessPolicy and user role.
 *
 * Extended with Module Documentation, FAQ, and Video Tutorials system.
 *
 * Step 6: Enterprise+ Ready
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { CARD_DOCS, CardDocumentation } from '../config/cardDocumentation';
import { FAQItem, getFAQsForModule } from '../config/faqContent';
import { getModuleHelp, ModuleHelp } from '../config/moduleHelpContent';
import { getVideosForModule, VideoTutorial } from '../config/videoTutorialsContent';
import { getHelpMapping, HelpModuleId, ViewHelpMapping } from '../config/viewToModuleMapping';
import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';

// Types
export interface PlaybookStep {
  id: string;
  stepOrder: number;
  title: string;
  contentMd: string;
  uiTarget: string | null;
  actionType: 'INFO' | 'CTA' | 'LINK';
  actionPayload: Record<string, any>;
  whatYouGet?: string | null;
  expectedTimeMinutes?: number | null;
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';
}

export interface Playbook {
  id: string;
  key: string;
  title: string;
  description: string | null;
  targetRole: string;
  targetOrgType: string;
  priority: number;
  isActive: boolean;
  isCompleted: boolean;
  isDismissed: boolean;
  status: 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED';
  isRecommended?: boolean;
  recommendationReason?: string;
  lastEventAt?: string | null;
  resumeStepIndex?: number;
  steps?: PlaybookStep[];
}

export interface HelpHint {
  featureKey: string;
  isBlocked: boolean;
  isLimited: boolean;
  reason: string | null;
  playbook: {
    key: string;
    title: string;
    description: string;
  } | null;
  suggestedAction: 'upgrade' | 'learn' | null;
}

// New types for contextual help system - 3 tabs: Overview, FAQ, Knowledge Base
export type HelpTab = 'overview' | 'onboarding' | 'updates' | 'faq' | 'knowledge';

export interface ContextualHelpState {
  moduleId: HelpModuleId;
  cardId?: string;
  moduleHelp: ModuleHelp | undefined;
  cardHelp: CardDocumentation | undefined;
  faqs: FAQItem[];
  videos: VideoTutorial[];
}

interface HelpContextValue {
  playbooks: Playbook[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logEvent: (
    playbookKey: string,
    eventType: string,
    context?: Record<string, any>
  ) => Promise<void>;
  getPlaybook: (key: string) => Promise<Playbook | null>;
  getHelpHint: (featureKey: string) => Promise<HelpHint | null>;
  isPanelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  currentRoute: string;
  setCurrentRoute: (route: string) => void;

  // New contextual help system
  isHelpSidePanelOpen: boolean;
  setHelpSidePanelOpen: (open: boolean) => void;
  toggleHelpSidePanel: () => void;
  activeHelpTab: HelpTab;
  setActiveHelpTab: (tab: HelpTab) => void;
  contextualHelp: ContextualHelpState;
  getHelpForView: (view: AppView | string) => ContextualHelpState;
}

const HelpContext = createContext<HelpContextValue | undefined>(undefined);

// Helper to get auth token
const getAuthToken = (): string | null => {
  try {
    const stored = localStorage.getItem('consultinity-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.state?.currentUser?.token || localStorage.getItem('auth_token') || null;
    }
    return localStorage.getItem('auth_token');
  } catch {
    return null;
  }
};

export const HelpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, currentView } = useAppStore();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<string>('');

  // New contextual help system state - Synced with Global Store
  const { activeSidePanel, toggleSidePanel } = useAppStore();
  const isHelpSidePanelOpen = activeSidePanel === 'HELP';
  const [activeHelpTab, setActiveHelpTab] = useState<HelpTab>('overview');

  // Toggle help side panel
  const toggleHelpSidePanel = useCallback(() => {
    toggleSidePanel('HELP');
  }, [toggleSidePanel]);

  // Set help side panel open (internal helper to match interface, but delegates to store)
  const setHelpSidePanelOpen = useCallback(
    (open: boolean) => {
      if (open) {
        if (activeSidePanel !== 'HELP') toggleSidePanel('HELP');
      } else {
        if (activeSidePanel === 'HELP') toggleSidePanel('HELP');
      }
    },
    [activeSidePanel, toggleSidePanel]
  );

  // Get contextual help for a specific view
  const getHelpForView = useCallback((view: AppView | string): ContextualHelpState => {
    const mapping: ViewHelpMapping = getHelpMapping(view);
    const moduleHelp = getModuleHelp(mapping.moduleId);
    const cardHelp = mapping.cardId ? CARD_DOCS[mapping.cardId] : undefined;
    const faqs = getFAQsForModule(mapping.moduleId);
    const videos = getVideosForModule(mapping.moduleId);

    return {
      moduleId: mapping.moduleId,
      cardId: mapping.cardId,
      moduleHelp: moduleHelp ?? undefined,
      cardHelp,
      faqs,
      videos,
    };
  }, []);

  // Memoized contextual help based on current view
  const contextualHelp = useMemo(() => {
    return getHelpForView(currentView);
  }, [currentView, getHelpForView]);

  // Fetch playbooks
  const fetchPlaybooks = useCallback(async () => {
    const token = getAuthToken();
    if (!currentUser || !token) {
      setPlaybooks([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/help/playbooks?route=${encodeURIComponent(currentRoute)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch playbooks');
      }

      const data = await response.json();
      setPlaybooks(data.playbooks || []);
    } catch (err: any) {
      console.error('[HelpContext] Error fetching playbooks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser, currentRoute]);

  // Fetch on mount and when route changes
  useEffect(() => {
    if (currentUser) {
      fetchPlaybooks();
    }
  }, [fetchPlaybooks, currentUser]);

  // Log event (append-only)
  const logEvent = useCallback(
    async (playbookKey: string, eventType: string, context: Record<string, any> = {}) => {
      const token = getAuthToken();
      if (!token) return;

      try {
        await fetch('/api/help/events', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            playbookKey,
            eventType,
            context: {
              ...context,
              route: currentRoute,
            },
          }),
        });

        // Refresh playbooks to update progress/completion status
        const et = String(eventType || '').toLowerCase();
        if (et.includes('completed') || et.includes('dismiss')) {
          await fetchPlaybooks();
        }
      } catch (err) {
        console.error('[HelpContext] Error logging event:', err);
      }
    },
    [currentRoute, fetchPlaybooks]
  );

  // Get single playbook with steps
  const getPlaybook = useCallback(async (key: string): Promise<Playbook | null> => {
    const token = getAuthToken();
    if (!token) return null;

    try {
      const response = await fetch(`/api/help/playbooks/${key}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (err) {
      console.error('[HelpContext] Error fetching playbook:', err);
      return null;
    }
  }, []);

  // Get help hint for feature
  const getHelpHint = useCallback(async (featureKey: string): Promise<HelpHint | null> => {
    const token = getAuthToken();
    if (!token) return null;

    try {
      const response = await fetch(`/api/help/hint/${featureKey}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.hint;
    } catch (err) {
      console.error('[HelpContext] Error fetching hint:', err);
      return null;
    }
  }, []);

  return (
    <HelpContext.Provider
      value={{
        playbooks,
        loading,
        error,
        refresh: fetchPlaybooks,
        logEvent,
        getPlaybook,
        getHelpHint,
        isPanelOpen,
        setPanelOpen,
        currentRoute,
        setCurrentRoute,
        // New contextual help system
        isHelpSidePanelOpen,
        setHelpSidePanelOpen,
        toggleHelpSidePanel,
        activeHelpTab,
        setActiveHelpTab,
        contextualHelp,
        getHelpForView,
      }}
    >
      {children}
    </HelpContext.Provider>
  );
};

// Main hook
export const useHelp = (): HelpContextValue => {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error('useHelp must be used within HelpProvider');
  }
  return context;
};

// Convenience hooks
export const useHelpPlaybooks = (): Playbook[] => {
  const { playbooks } = useHelp();
  return playbooks;
};

export const useHelpPanel = () => {
  const { isPanelOpen, setPanelOpen } = useHelp();
  return {
    isPanelOpen,
    openPanel: () => setPanelOpen(true),
    closePanel: () => setPanelOpen(false),
  };
};

/**
 * Hook for the new contextual help side panel
 */
export const useHelpSidePanel = () => {
  const {
    isHelpSidePanelOpen,
    setHelpSidePanelOpen,
    toggleHelpSidePanel,
    activeHelpTab,
    setActiveHelpTab,
    contextualHelp,
    getHelpForView,
  } = useHelp();

  return {
    isOpen: isHelpSidePanelOpen,
    setOpen: setHelpSidePanelOpen,
    toggle: toggleHelpSidePanel,
    activeTab: activeHelpTab,
    setActiveTab: setActiveHelpTab,
    help: contextualHelp,
    getHelpForView,
  };
};

/**
 * Hook for getting module help content
 */
export const useModuleHelp = () => {
  const { contextualHelp } = useHelp();
  return contextualHelp.moduleHelp;
};

/**
 * Hook for getting card-specific help content
 */
export const useCardHelp = () => {
  const { contextualHelp } = useHelp();
  return contextualHelp.cardHelp;
};

/**
 * Hook for getting FAQs for current module
 */
export const useModuleFAQs = () => {
  const { contextualHelp } = useHelp();
  return contextualHelp.faqs;
};

/**
 * Hook for getting videos for current module
 */
export const useModuleVideos = () => {
  const { contextualHelp } = useHelp();
  return contextualHelp.videos;
};

/**
 * Hook for inline help hints
 * Use in components to show contextual help for specific features
 */
export const useHelpHint = (featureKey: string) => {
  const { getHelpHint } = useHelp();
  const [hint, setHint] = useState<HelpHint | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!featureKey) return;

    setLoading(true);
    getHelpHint(featureKey)
      .then(setHint)
      .finally(() => setLoading(false));
  }, [featureKey, getHelpHint]);

  return { hint, loading };
};
