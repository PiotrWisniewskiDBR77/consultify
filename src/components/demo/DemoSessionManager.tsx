/**
 * DemoSessionManager
 *
 * Orchestrates the demo experience per docs/demo/DEMO_JOURNEY_REDESIGN.md
 * ("showroom, not onboarding"):
 *
 *  - NO blocking welcome tour, NO persona/scenario board, NO slide deck.
 *  - workspace_demo (presenter, profile-menu toggle): zero chrome — the
 *    StoryRail can be opened on demand via the `demo:open_story_rail` event.
 *  - sales_demo (prospect): StoryRail auto-opens once (✕ dismisses forever);
 *    conversion = value-moment CTAs + trial button + the rail's end-of-story
 *    close. No timer-based or feature-count upgrade nags, no exit-intent modal.
 *  - Session-expiry warnings only for sales_demo (a live presentation is
 *    never interrupted).
 */

import React, { useCallback, useEffect, useState } from 'react';

import { useDemo } from '../../hooks/useDemo';
import { useDemoSession } from '../../hooks/useDemoSession';
import { trackUpgradeClick } from '../../services/demoAnalyticsService';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import { useAppStore } from '../../store/useAppStore';
import { DemoConversionCTA, type ValueMomentType } from './DemoConversionCTA';
import { DemoLoadingOverlay } from './DemoLoadingOverlay';
import { DemoSignupModal } from './DemoSignupModal';
import { DemoTrialButton } from './DemoTrialButton';
import { StoryRail } from './StoryRail';
import { STORY_RAIL_DISMISSED_KEY } from './storyRailStops';

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  // Session warning thresholds (sales_demo only)
  SESSION_WARNING_1H_MS: 60 * 60 * 1000,
  SESSION_WARNING_5MIN_MS: 5 * 60 * 1000,
};

/** Event other surfaces can dispatch to open the rail on demand (presenter). */
export const OPEN_STORY_RAIL_EVENT = 'demo:open_story_rail';

function isStoryRailDismissed(): boolean {
  try {
    return localStorage.getItem(STORY_RAIL_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

// ============================================================
// COMPONENT
// ============================================================

export const DemoSessionManager: React.FC = () => {
  const { currentUser, isDemoMode, isDemoLoading } = useAppStore();
  const { demoExperienceType, exitDemoMode } = useDemo();
  const { isDemo, timeRemainingMs, extendSession } = useDemoSession();
  const isWorkspaceDemo = demoExperienceType === 'workspace_demo';
  const isSalesDemo = isDemo && !isWorkspaceDemo;

  // Get session ID for analytics
  const sessionId = sessionStorage.getItem('demo_session_id') || 'unknown';

  // UI State
  const [showStoryRail, setShowStoryRail] = useState(false);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [sessionWarningType, setSessionWarningType] = useState<'1h' | '5min' | 'expired'>('1h');
  const [entrySource, setEntrySource] = useState<string | null>(null);

  // Conversion flow state
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showValueCTA, setShowValueCTA] = useState(false);
  const [currentValueMoment, setCurrentValueMoment] = useState<ValueMomentType>('report_generated');

  useEffect(() => {
    if (!isDemo) return;
    const source =
      sessionStorage.getItem('demo_entry_source') ||
      (isDemoMode ? 'profile_menu' : currentUser?.isDemo ? 'landing_page' : 'demo_session');
    setEntrySource(source);
  }, [currentUser?.isDemo, isDemo, isDemoMode]);

  useEffect(() => {
    if (!isDemo || !sessionId) return;

    const dedupeKey = `demo_started_tracked:${sessionId}`;
    if (sessionStorage.getItem(dedupeKey) === 'true') return;

    sessionStorage.setItem(dedupeKey, 'true');
    trackFunnelEvent('demo_started', {
      source: entrySource || 'demo_session',
      isDemoMode,
      demoExperienceType: demoExperienceType || 'sales_demo',
    });
  }, [demoExperienceType, entrySource, isDemo, isDemoMode, sessionId]);

  // --------------------------------------------------------
  // STORY RAIL TRIGGERS
  // --------------------------------------------------------

  // Prospects get the rail automatically, once, unless permanently dismissed.
  useEffect(() => {
    if (!isSalesDemo) return;
    if (isStoryRailDismissed()) return;
    setShowStoryRail(true);
  }, [isSalesDemo]);

  // Presenters (and anyone else) can open it on demand.
  useEffect(() => {
    if (!isDemo) return;
    const handleOpen = () => setShowStoryRail(true);
    window.addEventListener(OPEN_STORY_RAIL_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_STORY_RAIL_EVENT, handleOpen);
  }, [isDemo]);

  // --------------------------------------------------------
  // SESSION WARNINGS (sales_demo only)
  // --------------------------------------------------------

  useEffect(() => {
    if (!isSalesDemo) return;

    if (
      timeRemainingMs <= CONFIG.SESSION_WARNING_1H_MS &&
      timeRemainingMs > CONFIG.SESSION_WARNING_5MIN_MS
    ) {
      if (sessionWarningType !== '1h') {
        setSessionWarningType('1h');
        // Banner-level information only; no modal at the 1h mark.
      }
    }

    if (timeRemainingMs <= CONFIG.SESSION_WARNING_5MIN_MS && timeRemainingMs > 0) {
      if (sessionWarningType !== '5min') {
        setSessionWarningType('5min');
        setShowSessionWarning(true);
      }
    }

    if (timeRemainingMs <= 0) {
      setSessionWarningType('expired');
      setShowSessionWarning(true);
    }
  }, [isSalesDemo, timeRemainingMs, sessionWarningType]);

  // --------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------

  const handleExtendSession = useCallback(() => {
    extendSession();
    setShowSessionWarning(false);
  }, [extendSession]);

  // Value moment CTA trigger (dispatched via window event by feature code)
  useEffect(() => {
    if (!isSalesDemo) return;

    const handleValueMoment = (e: CustomEvent<{ type: ValueMomentType }>) => {
      setCurrentValueMoment(e.detail.type);
      setShowValueCTA(true);
      trackFunnelEvent('demo_value_moment_reached', { type: e.detail.type });
    };

    window.addEventListener('demo:value_moment', handleValueMoment as EventListener);
    return () =>
      window.removeEventListener('demo:value_moment', handleValueMoment as EventListener);
  }, [isSalesDemo]);

  const handleStartTrialFromCTA = useCallback(() => {
    setShowValueCTA(false);
    setShowSignupModal(true);
    trackFunnelEvent('demo_cta_clicked', { location: 'value_moment_cta' });
  }, []);

  const handleSignupComplete = useCallback((email: string) => {
    setShowSignupModal(false);
    trackFunnelEvent('trial_activated', { source: 'demo_conversion', email });
    window.location.href = '/auth?step=login&from=demo';
  }, []);

  const handleContactSales = useCallback(
    (source: string = 'banner') => {
      if (isWorkspaceDemo) {
        void exitDemoMode();
        return;
      }
      trackUpgradeClick(sessionId, source);
      window.open(
        'https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017',
        '_blank'
      );
    },
    [exitDemoMode, isWorkspaceDemo, sessionId]
  );

  // --------------------------------------------------------
  // RENDER
  // --------------------------------------------------------

  if (!isDemo) {
    return null;
  }

  return (
    <>
      {/* Loading overlay while demo environment is being prepared */}
      <DemoLoadingOverlay isVisible={isDemoLoading} />

      {/* The one guide: slim, dismissible, navigates to real screens */}
      <StoryRail
        isOpen={showStoryRail}
        isSalesDemo={isSalesDemo}
        onClose={() => setShowStoryRail(false)}
        onStartTrial={() => setShowSignupModal(true)}
      />

      {/* Session Warning Modal — prospects only */}
      {isSalesDemo && showSessionWarning && (
        <SessionWarningModal
          type={sessionWarningType}
          onExtend={handleExtendSession}
          onContactSales={() => handleContactSales('session_warning')}
          onDismiss={() => setShowSessionWarning(false)}
        />
      )}

      {isSalesDemo && (
        <>
          {/* Persistent Trial Button */}
          <DemoTrialButton onClick={() => setShowSignupModal(true)} />

          {/* Contextual Value Moment CTA */}
          <DemoConversionCTA
            isVisible={showValueCTA}
            valueMoment={currentValueMoment}
            onStartTrial={handleStartTrialFromCTA}
            onDismiss={() => setShowValueCTA(false)}
          />

          {/* Signup Modal */}
          <DemoSignupModal
            isOpen={showSignupModal}
            onClose={() => setShowSignupModal(false)}
            onSignupComplete={handleSignupComplete}
          />
        </>
      )}
    </>
  );
};

// ============================================================
// SESSION WARNING MODAL (sales_demo only)
// ============================================================

interface SessionWarningModalProps {
  type: '1h' | '5min' | 'expired';
  onExtend: () => void;
  onContactSales: () => void;
  onDismiss: () => void;
}

const SessionWarningModal: React.FC<SessionWarningModalProps> = ({
  type,
  onExtend,
  onContactSales,
  onDismiss,
}) => {
  const getContent = () => {
    switch (type) {
      case '1h':
        return {
          title: 'Session Ending Soon',
          description: 'Your demo session will expire in 1 hour. Would you like to extend it?',
          showExtend: true,
        };
      case '5min':
        return {
          title: 'Session Almost Over',
          description:
            'Only 5 minutes left in your demo. Extend now or schedule a full demo with our team.',
          showExtend: true,
        };
      case 'expired':
        return {
          title: 'Session Expired',
          description:
            'Your demo session has ended. Start a new session or get full access with your own data.',
          showExtend: false,
        };
    }
  };

  const content = getContent();

  return (
    <div className="fixed inset-0 z-[500] bg-navy-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-amber-600 dark:text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-3">{content.title}</h3>

        <p className="text-slate-600 dark:text-slate-400 mb-6">{content.description}</p>

        <div className="flex flex-col sm:flex-row gap-3">
          {content.showExtend && (
            <button
              onClick={onExtend}
              className="flex-1 py-3 px-6 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-semibold rounded-xl transition-all"
            >
              Extend Session
            </button>
          )}
          <button
            onClick={onContactSales}
            className="flex-1 py-3 px-6 bg-gradient-to-r from-primary-600 to-crimson-600 hover:from-primary-500 hover:to-crimson-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary-500/25"
          >
            Get Full Access
          </button>
        </div>

        {content.showExtend && (
          <button
            onClick={onDismiss}
            className="mt-4 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Remind me later
          </button>
        )}
      </div>
    </div>
  );
};

export default DemoSessionManager;
