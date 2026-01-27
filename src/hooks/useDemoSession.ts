/**
 * useDemoSession Hook
 *
 * Enterprise-grade demo session lifecycle management.
 * Handles session timing, milestone tracking, and conversion optimization.
 *
 * BCG/McKinsey class experience - designed to maximize:
 * - Demo Start Rate (>40%)
 * - Tour Completion (>60%)
 * - Session Duration (>5 min)
 * - Upgrade Click Rate (>15%)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAppStore } from '../store/useAppStore';

// ============================================================
// TYPES
// ============================================================

export interface DemoMilestone {
  id: string;
  name: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface DemoSessionState {
  // Session basics
  isDemo: boolean;
  sessionStartTime: Date | null;
  sessionDurationMs: number;
  timeRemainingMs: number;
  aiInteractionsUsed: number;
  aiInteractionsLimit: number;
  aiInteractionsRemaining: number;

  // Lifecycle stages
  hasCompletedTour: boolean;
  hasSeenWelcome: boolean;
  hasInteractedWithAI: boolean;
  featuresExplored: string[];

  // Conversion tracking
  upgradePromptsShown: number;
  exitIntentTriggered: boolean;

  // Milestones
  milestones: DemoMilestone[];
}

export interface DemoSessionActions {
  // Lifecycle
  startDemoSession: () => void;
  endDemoSession: () => void;
  extendSession: () => void;

  // Progress tracking
  markTourCompleted: () => void;
  markWelcomeSeen: () => void;
  markAIInteraction: () => void;
  consumeAIInteraction: () => void;
  trackFeatureExplored: (featureId: string) => void;
  addMilestone: (id: string, name: string, metadata?: Record<string, unknown>) => void;

  // Conversion
  incrementUpgradePrompts: () => void;
  markExitIntent: () => void;

  // Analytics
  getSessionAnalytics: () => DemoAnalytics;
}

export interface DemoAnalytics {
  sessionId: string;
  durationMinutes: number;
  tourCompleted: boolean;
  featuresExploredCount: number;
  aiInteractions: boolean;
  upgradePromptsShown: number;
  exitIntentTriggered: boolean;
  milestones: DemoMilestone[];
}

// ============================================================
// CONSTANTS
// ============================================================

const DEMO_SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_WARNING_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour before expiry
const DEMO_AI_INTERACTIONS_LIMIT = 25; // hard session quota for demo (AI messages / interactions)
const STORAGE_KEY = 'consultinity_demo_session';

// ============================================================
// STORAGE HELPERS
// ============================================================

interface StoredDemoSession {
  sessionId: string;
  startTime: string;
  hasCompletedTour: boolean;
  hasSeenWelcome: boolean;
  hasInteractedWithAI: boolean;
  aiInteractionsUsed: number;
  featuresExplored: string[];
  upgradePromptsShown: number;
  exitIntentTriggered: boolean;
  milestones: DemoMilestone[];
}

const loadStoredSession = (): StoredDemoSession | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

const saveSession = (session: StoredDemoSession): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('[useDemoSession] Failed to save session:', e);
  }
};

const clearStoredSession = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

const generateSessionId = (): string => {
  return `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================================
// HOOK
// ============================================================

export const useDemoSession = (): DemoSessionState & DemoSessionActions => {
  const { currentUser } = useAppStore();

  // Demo account identity (single source of truth)
  const DEMO_EMAIL = 'piotr.wisniewski@demo.com';

  // Determine if user is in demo mode
  const isDemo = useMemo(() => {
    return (
      currentUser?.isDemo === true ||
      (sessionStorage.getItem('isDemo') === 'true' && currentUser?.email === DEMO_EMAIL)
    );
  }, [currentUser]);

  // Session state
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionDurationMs, setSessionDurationMs] = useState(0);
  const [timeRemainingMs, setTimeRemainingMs] = useState(DEMO_SESSION_DURATION_MS);
  const [aiInteractionsUsed, setAiInteractionsUsed] = useState(0);

  // Progress tracking
  const [hasCompletedTour, setHasCompletedTour] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);
  const [hasInteractedWithAI, setHasInteractedWithAI] = useState(false);
  const [featuresExplored, setFeaturesExplored] = useState<string[]>([]);

  // Conversion tracking
  const [upgradePromptsShown, setUpgradePromptsShown] = useState(0);
  const [exitIntentTriggered, setExitIntentTriggered] = useState(false);

  // Milestones
  const [milestones, setMilestones] = useState<DemoMilestone[]>([]);

  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------

  useEffect(() => {
    if (!isDemo) return;

    // Try to restore existing session
    const stored = loadStoredSession();

    if (stored) {
      const startTime = new Date(stored.startTime);
      const elapsed = Date.now() - startTime.getTime();

      // Check if session is still valid
      if (elapsed < DEMO_SESSION_DURATION_MS) {
        setSessionId(stored.sessionId);
        setSessionStartTime(startTime);
        setSessionDurationMs(elapsed);
        setTimeRemainingMs(DEMO_SESSION_DURATION_MS - elapsed);
        setHasCompletedTour(stored.hasCompletedTour);
        setHasSeenWelcome(stored.hasSeenWelcome);
        setHasInteractedWithAI(stored.hasInteractedWithAI);
        setAiInteractionsUsed(stored.aiInteractionsUsed || 0);
        setFeaturesExplored(stored.featuresExplored || []);
        setUpgradePromptsShown(stored.upgradePromptsShown || 0);
        setExitIntentTriggered(stored.exitIntentTriggered || false);
        setMilestones(stored.milestones || []);
        return;
      } else {
        // Session expired
        clearStoredSession();
      }
    }

    // Start new session
    const newSessionId = generateSessionId();
    const newStartTime = new Date();

    setSessionId(newSessionId);
    setSessionStartTime(newStartTime);
    setTimeRemainingMs(DEMO_SESSION_DURATION_MS);
    setAiInteractionsUsed(0);

    saveSession({
      sessionId: newSessionId,
      startTime: newStartTime.toISOString(),
      hasCompletedTour: false,
      hasSeenWelcome: false,
      hasInteractedWithAI: false,
      aiInteractionsUsed: 0,
      featuresExplored: [],
      upgradePromptsShown: 0,
      exitIntentTriggered: false,
      milestones: [
        {
          id: 'session_start',
          name: 'Demo Session Started',
          timestamp: Date.now(),
        },
      ],
    });

    // Track demo start
    trackDemoEvent('demo_session_started', { sessionId: newSessionId });
  }, [isDemo]);

  // --------------------------------------------------------
  // TIMER
  // --------------------------------------------------------

  useEffect(() => {
    if (!isDemo || !sessionStartTime) return;

    const updateTimer = () => {
      const elapsed = Date.now() - sessionStartTime.getTime();
      const remaining = Math.max(0, DEMO_SESSION_DURATION_MS - elapsed);

      setSessionDurationMs(elapsed);
      setTimeRemainingMs(remaining);
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isDemo, sessionStartTime]);

  // --------------------------------------------------------
  // PERSISTENCE
  // --------------------------------------------------------

  useEffect(() => {
    if (!isDemo || !sessionId) return;

    saveSession({
      sessionId,
      startTime: sessionStartTime?.toISOString() || new Date().toISOString(),
      hasCompletedTour,
      hasSeenWelcome,
      hasInteractedWithAI,
      aiInteractionsUsed,
      featuresExplored,
      upgradePromptsShown,
      exitIntentTriggered,
      milestones,
    });
  }, [
    isDemo,
    sessionId,
    sessionStartTime,
    hasCompletedTour,
    hasSeenWelcome,
    hasInteractedWithAI,
    aiInteractionsUsed,
    featuresExplored,
    upgradePromptsShown,
    exitIntentTriggered,
    milestones,
  ]);

  // --------------------------------------------------------
  // ACTIONS
  // --------------------------------------------------------

  // Define addMilestone first since other callbacks depend on it
  const addMilestone = useCallback(
    (id: string, name: string, metadata?: Record<string, unknown>) => {
      setMilestones((prev) => [
        ...prev,
        {
          id,
          name,
          timestamp: Date.now(),
          metadata,
        },
      ]);
    },
    []
  );

  const startDemoSession = useCallback(() => {
    const newSessionId = generateSessionId();
    const newStartTime = new Date();

    setSessionId(newSessionId);
    setSessionStartTime(newStartTime);
    setTimeRemainingMs(DEMO_SESSION_DURATION_MS);
    setAiInteractionsUsed(0);
    setHasCompletedTour(false);
    setHasSeenWelcome(false);
    setHasInteractedWithAI(false);
    setFeaturesExplored([]);
    setUpgradePromptsShown(0);
    setExitIntentTriggered(false);
    setMilestones([
      {
        id: 'session_start',
        name: 'Demo Session Started',
        timestamp: Date.now(),
      },
    ]);

    trackDemoEvent('demo_session_started', { sessionId: newSessionId });
  }, []);

  const endDemoSession = useCallback(() => {
    trackDemoEvent('demo_session_ended', {
      sessionId,
      durationMinutes: Math.round(sessionDurationMs / 60000),
      tourCompleted: hasCompletedTour,
      featuresExploredCount: featuresExplored.length,
      aiInteractionsUsed,
    });

    clearStoredSession();

    setSessionId('');
    setSessionStartTime(null);
    setSessionDurationMs(0);
    setTimeRemainingMs(0);
    setAiInteractionsUsed(0);
  }, [sessionId, sessionDurationMs, hasCompletedTour, featuresExplored, aiInteractionsUsed]);

  const extendSession = useCallback(() => {
    if (sessionStartTime) {
      const newStartTime = new Date();
      setSessionStartTime(newStartTime);
      setTimeRemainingMs(DEMO_SESSION_DURATION_MS);

      addMilestone('session_extended', 'Session Extended');
      trackDemoEvent('demo_session_extended', { sessionId });
    }
  }, [sessionStartTime, sessionId, addMilestone]);

  const markTourCompleted = useCallback(() => {
    setHasCompletedTour(true);
    addMilestone('tour_completed', 'Onboarding Tour Completed');
    trackDemoEvent('demo_tour_completed', { sessionId });
  }, [sessionId, addMilestone]);

  const markWelcomeSeen = useCallback(() => {
    setHasSeenWelcome(true);
  }, []);

  const markAIInteraction = useCallback(() => {
    if (!hasInteractedWithAI) {
      setHasInteractedWithAI(true);
      addMilestone('first_ai_interaction', 'First AI Interaction');
      trackDemoEvent('demo_first_ai_interaction', { sessionId });
    }
  }, [hasInteractedWithAI, sessionId, addMilestone]);

  const consumeAIInteraction = useCallback(() => {
    setAiInteractionsUsed((prev) => {
      const next = prev + 1;
      trackDemoEvent('demo_ai_interaction', { sessionId, aiInteractionsUsed: next });
      return next;
    });
    markAIInteraction();
  }, [sessionId, markAIInteraction]);

  const trackFeatureExplored = useCallback(
    (featureId: string) => {
      setFeaturesExplored((prev) => {
        if (prev.includes(featureId)) return prev;
        const updated = [...prev, featureId];

        // Track milestone for first 3 features
        if (updated.length === 3) {
          addMilestone('features_explored_3', '3 Features Explored');
        }
        if (updated.length === 5) {
          addMilestone('features_explored_5', '5 Features Explored');
        }

        trackDemoEvent('demo_feature_explored', { sessionId, featureId });
        return updated;
      });
    },
    [sessionId, addMilestone]
  );

  const incrementUpgradePrompts = useCallback(() => {
    setUpgradePromptsShown((prev) => prev + 1);
  }, []);

  const markExitIntent = useCallback(() => {
    if (!exitIntentTriggered) {
      setExitIntentTriggered(true);
      trackDemoEvent('demo_exit_intent', { sessionId });
    }
  }, [exitIntentTriggered, sessionId]);

  const getSessionAnalytics = useCallback((): DemoAnalytics => {
    return {
      sessionId,
      durationMinutes: Math.round(sessionDurationMs / 60000),
      tourCompleted: hasCompletedTour,
      featuresExploredCount: featuresExplored.length,
      aiInteractions: hasInteractedWithAI,
      upgradePromptsShown,
      exitIntentTriggered,
      milestones,
    };
  }, [
    sessionId,
    sessionDurationMs,
    hasCompletedTour,
    featuresExplored,
    hasInteractedWithAI,
    upgradePromptsShown,
    exitIntentTriggered,
    milestones,
  ]);

  return {
    // State
    isDemo,
    sessionStartTime,
    sessionDurationMs,
    timeRemainingMs,
    aiInteractionsUsed,
    aiInteractionsLimit: DEMO_AI_INTERACTIONS_LIMIT,
    aiInteractionsRemaining: Math.max(0, DEMO_AI_INTERACTIONS_LIMIT - aiInteractionsUsed),
    hasCompletedTour,
    hasSeenWelcome,
    hasInteractedWithAI,
    featuresExplored,
    upgradePromptsShown,
    exitIntentTriggered,
    milestones,

    // Actions
    startDemoSession,
    endDemoSession,
    extendSession,
    markTourCompleted,
    markWelcomeSeen,
    markAIInteraction,
    consumeAIInteraction,
    trackFeatureExplored,
    addMilestone,
    incrementUpgradePrompts,
    markExitIntent,
    getSessionAnalytics,
  };
};

// ============================================================
// ANALYTICS HELPER
// ============================================================

const trackDemoEvent = (eventName: string, data: Record<string, unknown>) => {
  // Console log for debugging
  console.log(`[DemoAnalytics] ${eventName}`, data);

  // Integration with analytics (if available)
  try {
    // Google Analytics 4
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, data);
    }

    // Custom analytics
    if (typeof window !== 'undefined' && (window as any).journeyAnalytics) {
      (window as any).journeyAnalytics.trackMilestone?.(eventName, data);
    }

    // Store in session for retrieval
    try {
      const events = JSON.parse(sessionStorage.getItem('demo_events') || '[]');
      events.push({ eventName, data, timestamp: Date.now() });
      sessionStorage.setItem('demo_events', JSON.stringify(events.slice(-50))); // Keep last 50
    } catch {
      // ignore
    }
  } catch (e) {
    console.warn('[DemoAnalytics] Failed to track event:', e);
  }
};

export default useDemoSession;
