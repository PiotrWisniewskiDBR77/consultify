/**
 * Demo Analytics Service
 * 
 * Centralized analytics tracking for demo sessions.
 * Tracks key metrics for BCG/McKinsey class conversion optimization:
 * - Demo Start Rate (target >40%)
 * - Tour Completion (target >60%)
 * - Session Duration (target >5 min)
 * - Upgrade Click Rate (target >15%)
 */

// ============================================================
// TYPES
// ============================================================

export interface DemoEvent {
  name: string;
  timestamp: number;
  sessionId: string;
  data?: Record<string, unknown>;
}

export interface DemoMetrics {
  totalDemoStarts: number;
  tourCompletions: number;
  avgSessionDurationMin: number;
  upgradeClicks: number;
  exitIntentShown: number;
  featuresExplored: Record<string, number>;
}

// ============================================================
// STORAGE
// ============================================================

const EVENTS_STORAGE_KEY = 'demo_analytics_events';
const METRICS_STORAGE_KEY = 'demo_analytics_metrics';
const MAX_EVENTS_STORED = 100;

// ============================================================
// EVENT TRACKING
// ============================================================

/**
 * Track a demo analytics event
 */
export const trackDemoEvent = (
  eventName: string,
  sessionId: string,
  data?: Record<string, unknown>
): void => {
  const event: DemoEvent = {
    name: eventName,
    timestamp: Date.now(),
    sessionId,
    data,
  };

  // Console log for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DemoAnalytics] ${eventName}`, { sessionId, ...data });
  }

  // Store locally
  storeEvent(event);

  // Send to analytics providers
  sendToAnalytics(event);
};

/**
 * Track demo session start
 */
export const trackDemoStart = (sessionId: string): void => {
  trackDemoEvent('demo_session_started', sessionId);
  incrementMetric('totalDemoStarts');
};

/**
 * Track tour completion
 */
export const trackTourCompleted = (sessionId: string): void => {
  trackDemoEvent('demo_tour_completed', sessionId);
  incrementMetric('tourCompletions');
};

/**
 * Track feature exploration
 */
export const trackFeatureExplored = (
  sessionId: string,
  featureId: string,
  featureName: string
): void => {
  trackDemoEvent('demo_feature_explored', sessionId, { featureId, featureName });
  incrementFeatureMetric(featureId);
};

/**
 * Track upgrade click
 */
export const trackUpgradeClick = (sessionId: string, source: string): void => {
  trackDemoEvent('demo_upgrade_clicked', sessionId, { source });
  incrementMetric('upgradeClicks');
};

/**
 * Track exit intent shown
 */
export const trackExitIntent = (sessionId: string): void => {
  trackDemoEvent('demo_exit_intent_shown', sessionId);
  incrementMetric('exitIntentShown');
};

/**
 * Track session end
 */
export const trackSessionEnd = (
  sessionId: string,
  durationMinutes: number,
  tourCompleted: boolean,
  featuresExploredCount: number
): void => {
  trackDemoEvent('demo_session_ended', sessionId, {
    durationMinutes,
    tourCompleted,
    featuresExploredCount,
  });

  // Update average session duration
  updateAvgSessionDuration(durationMinutes);
};

/**
 * Track AI interaction in demo
 */
export const trackAIInteraction = (
  sessionId: string,
  interactionType: 'chat' | 'recommendation' | 'analysis'
): void => {
  trackDemoEvent('demo_ai_interaction', sessionId, { interactionType });
};

// ============================================================
// STORAGE HELPERS
// ============================================================

const storeEvent = (event: DemoEvent): void => {
  try {
    const events = getStoredEvents();
    events.push(event);
    
    // Keep only last N events
    const trimmedEvents = events.slice(-MAX_EVENTS_STORED);
    sessionStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(trimmedEvents));
  } catch (e) {
    console.warn('[DemoAnalytics] Failed to store event:', e);
  }
};

const getStoredEvents = (): DemoEvent[] => {
  try {
    const stored = sessionStorage.getItem(EVENTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const incrementMetric = (metricName: keyof DemoMetrics): void => {
  try {
    const metrics = getStoredMetrics();
    if (typeof metrics[metricName] === 'number') {
      (metrics[metricName] as number)++;
    }
    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(metrics));
  } catch {
    // ignore
  }
};

const incrementFeatureMetric = (featureId: string): void => {
  try {
    const metrics = getStoredMetrics();
    if (!metrics.featuresExplored) {
      metrics.featuresExplored = {};
    }
    metrics.featuresExplored[featureId] = (metrics.featuresExplored[featureId] || 0) + 1;
    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(metrics));
  } catch {
    // ignore
  }
};

const updateAvgSessionDuration = (newDurationMin: number): void => {
  try {
    const metrics = getStoredMetrics();
    const totalSessions = metrics.totalDemoStarts || 1;
    const currentAvg = metrics.avgSessionDurationMin || 0;
    
    // Calculate new rolling average
    metrics.avgSessionDurationMin = 
      (currentAvg * (totalSessions - 1) + newDurationMin) / totalSessions;
    
    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(metrics));
  } catch {
    // ignore
  }
};

const getStoredMetrics = (): DemoMetrics => {
  try {
    const stored = localStorage.getItem(METRICS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  
  return {
    totalDemoStarts: 0,
    tourCompletions: 0,
    avgSessionDurationMin: 0,
    upgradeClicks: 0,
    exitIntentShown: 0,
    featuresExplored: {},
  };
};

// ============================================================
// ANALYTICS PROVIDERS
// ============================================================

const sendToAnalytics = (event: DemoEvent): void => {
  // Google Analytics 4
  if (typeof window !== 'undefined' && (window as any).gtag) {
    try {
      (window as any).gtag('event', event.name, {
        event_category: 'demo',
        session_id: event.sessionId,
        ...event.data,
      });
    } catch {
      // ignore
    }
  }

  // Mixpanel
  if (typeof window !== 'undefined' && (window as any).mixpanel) {
    try {
      (window as any).mixpanel.track(event.name, {
        sessionId: event.sessionId,
        ...event.data,
      });
    } catch {
      // ignore
    }
  }

  // Amplitude
  if (typeof window !== 'undefined' && (window as any).amplitude) {
    try {
      (window as any).amplitude.logEvent(event.name, {
        sessionId: event.sessionId,
        ...event.data,
      });
    } catch {
      // ignore
    }
  }

  // Custom journey analytics (internal)
  if (typeof window !== 'undefined' && (window as any).journeyAnalytics) {
    try {
      (window as any).journeyAnalytics.trackMilestone?.(event.name, {
        sessionId: event.sessionId,
        ...event.data,
      });
    } catch {
      // ignore
    }
  }
};

// ============================================================
// REPORTING
// ============================================================

/**
 * Get current demo metrics for reporting
 */
export const getDemoMetrics = (): DemoMetrics => {
  return getStoredMetrics();
};

/**
 * Get conversion rates
 */
export const getConversionRates = (): {
  tourCompletionRate: number;
  upgradeClickRate: number;
  avgSessionMinutes: number;
} => {
  const metrics = getStoredMetrics();
  const totalStarts = Math.max(metrics.totalDemoStarts, 1);
  
  return {
    tourCompletionRate: (metrics.tourCompletions / totalStarts) * 100,
    upgradeClickRate: (metrics.upgradeClicks / totalStarts) * 100,
    avgSessionMinutes: metrics.avgSessionDurationMin,
  };
};

/**
 * Get events for current session
 */
export const getCurrentSessionEvents = (sessionId: string): DemoEvent[] => {
  return getStoredEvents().filter(e => e.sessionId === sessionId);
};

/**
 * Clear all demo analytics data (for testing)
 */
export const clearDemoAnalytics = (): void => {
  try {
    sessionStorage.removeItem(EVENTS_STORAGE_KEY);
    localStorage.removeItem(METRICS_STORAGE_KEY);
  } catch {
    // ignore
  }
};

// ============================================================
// EXPORT
// ============================================================

export default {
  trackDemoEvent,
  trackDemoStart,
  trackTourCompleted,
  trackFeatureExplored,
  trackUpgradeClick,
  trackExitIntent,
  trackSessionEnd,
  trackAIInteraction,
  getDemoMetrics,
  getConversionRates,
  getCurrentSessionEvents,
  clearDemoAnalytics,
};
