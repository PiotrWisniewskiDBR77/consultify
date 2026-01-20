/**
 * DemoSessionManager
 * 
 * Central orchestration component for the demo experience.
 * Manages all demo UI elements and their triggers:
 * - Welcome Tour (first visit)
 * - Smart Demo Banner (always visible in demo)
 * - Exit Intent Modal (on leave)
 * - Upgrade Prompts (strategic moments)
 * - Session Expiry Warnings
 * 
 * BCG/McKinsey class experience design.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDemoSession } from '../../hooks/useDemoSession';
import { trackTourCompleted, trackUpgradeClick } from '../../services/demoAnalyticsService';

import { DemoLoadingOverlay } from './DemoLoadingOverlay';
import { DemoUpgradePrompt } from './DemoUpgradePrompt';
import { DemoWelcomeTour } from './DemoWelcomeTour';
import { ExitIntentModal } from './ExitIntentModal';
import { SmartDemoBanner } from './SmartDemoBanner';
import { useExitIntent } from './useExitIntent';

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  // Show upgrade prompt after N minutes in demo
  UPGRADE_PROMPT_DELAY_MS: 5 * 60 * 1000, // 5 minutes

  // Show upgrade prompt after exploring N features
  UPGRADE_PROMPT_FEATURE_THRESHOLD: 3,

  // Session warning thresholds
  SESSION_WARNING_1H_MS: 60 * 60 * 1000, // 1 hour remaining
  SESSION_WARNING_5MIN_MS: 5 * 60 * 1000, // 5 minutes remaining

  // Max upgrade prompts per session
  MAX_UPGRADE_PROMPTS: 3,
};

// ============================================================
// COMPONENT
// ============================================================

export const DemoSessionManager: React.FC = () => {
  const { t } = useTranslation();
  const {
    isDemo,
    sessionStartTime,
    sessionDurationMs,
    timeRemainingMs,
    hasCompletedTour,
    hasSeenWelcome,
    featuresExplored,
    upgradePromptsShown,
    markTourCompleted,
    markWelcomeSeen,
    incrementUpgradePrompts,
    markExitIntent,
    extendSession,
  } = useDemoSession();

  // Get session ID for analytics
  const sessionId = sessionStorage.getItem('demo_session_id') || 'unknown';

  // UI State
  const [showTour, setShowTour] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradePromptFeature, setUpgradePromptFeature] = useState<string>('');
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [sessionWarningType, setSessionWarningType] = useState<'1h' | '5min' | 'expired'>('1h');

  // Exit intent detection
  const { showExitIntent, dismissExitIntent } = useExitIntent({
    disabled: !isDemo,
    delayMs: 10000, // Wait 10 seconds before enabling
    triggerOnce: true,
  });

  // --------------------------------------------------------
  // TOUR TRIGGER
  // --------------------------------------------------------

  useEffect(() => {
    if (!isDemo) return undefined;

    // Show tour on first demo visit (if not seen welcome yet)
    if (!hasSeenWelcome && !hasCompletedTour) {
      // Small delay to let the page load
      const timer = setTimeout(() => {
        setShowTour(true);
        markWelcomeSeen();
      }, 1500);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isDemo, hasSeenWelcome, hasCompletedTour, markWelcomeSeen]);

  // --------------------------------------------------------
  // UPGRADE PROMPT TRIGGERS
  // --------------------------------------------------------

  // Time-based upgrade prompt
  useEffect(() => {
    if (!isDemo) return;
    if (upgradePromptsShown >= CONFIG.MAX_UPGRADE_PROMPTS) return;
    if (hasCompletedTour === false) return; // Wait for tour completion

    if (sessionDurationMs >= CONFIG.UPGRADE_PROMPT_DELAY_MS && upgradePromptsShown === 0) {
      setUpgradePromptFeature('time');
      setShowUpgradePrompt(true);
      incrementUpgradePrompts();
    }
  }, [isDemo, sessionDurationMs, upgradePromptsShown, hasCompletedTour, incrementUpgradePrompts]);

  // Feature exploration upgrade prompt
  useEffect(() => {
    if (!isDemo) return;
    if (upgradePromptsShown >= CONFIG.MAX_UPGRADE_PROMPTS) return;

    if (featuresExplored.length >= CONFIG.UPGRADE_PROMPT_FEATURE_THRESHOLD && upgradePromptsShown < 2) {
      // Only show if we haven't shown the time-based one recently
      if (sessionDurationMs > CONFIG.UPGRADE_PROMPT_DELAY_MS + 60000) {
        setUpgradePromptFeature('features');
        setShowUpgradePrompt(true);
        incrementUpgradePrompts();
      }
    }
  }, [isDemo, featuresExplored, upgradePromptsShown, sessionDurationMs, incrementUpgradePrompts]);

  // --------------------------------------------------------
  // SESSION WARNINGS
  // --------------------------------------------------------

  useEffect(() => {
    if (!isDemo) return;

    // 1 hour warning
    if (timeRemainingMs <= CONFIG.SESSION_WARNING_1H_MS && timeRemainingMs > CONFIG.SESSION_WARNING_5MIN_MS) {
      if (sessionWarningType !== '1h') {
        setSessionWarningType('1h');
        // Don't auto-show modal, let banner handle it
      }
    }

    // 5 minute warning
    if (timeRemainingMs <= CONFIG.SESSION_WARNING_5MIN_MS && timeRemainingMs > 0) {
      if (sessionWarningType !== '5min') {
        setSessionWarningType('5min');
        setShowSessionWarning(true);
      }
    }

    // Session expired
    if (timeRemainingMs <= 0) {
      setSessionWarningType('expired');
      setShowSessionWarning(true);
    }
  }, [isDemo, timeRemainingMs, sessionWarningType]);

  // --------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------

  const handleTourClose = useCallback(() => {
    setShowTour(false);
  }, []);

  const handleTourComplete = useCallback(() => {
    setShowTour(false);
    markTourCompleted();

    // Track analytics
    trackTourCompleted(sessionId);

    // Show celebration toast with "aha moment" messaging
    toast.success(
      t('demo.tourComplete.message', "You're ready to explore! This platform typically saves teams 3+ weeks of consulting work."),
      {
        duration: 5000,
        icon: '🎉',
        style: {
          background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
          color: 'white',
          fontWeight: '500',
        },
      }
    );
  }, [markTourCompleted, sessionId, t]);

  const handleUpgradePromptClose = useCallback(() => {
    setShowUpgradePrompt(false);
  }, []);

  const handleExitIntentClose = useCallback(() => {
    dismissExitIntent();
    markExitIntent();
  }, [dismissExitIntent, markExitIntent]);

  const handleExtendSession = useCallback(() => {
    extendSession();
    setShowSessionWarning(false);
  }, [extendSession]);

  const handleContactSales = useCallback((source: string = 'banner') => {
    // Track upgrade click
    trackUpgradeClick(sessionId, source);

    window.open(
      'https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017',
      '_blank'
    );
  }, [sessionId]);

  // --------------------------------------------------------
  // RENDER
  // --------------------------------------------------------

  // Don't render anything if not in demo mode
  if (!isDemo) {
    return null;
  }

  return (
    <>
      {/* Smart Demo Banner - Always visible in demo */}
      <SmartDemoBanner
        sessionStartTime={sessionStartTime || new Date()}
        onUpgradeClick={() => handleContactSales('banner_upgrade')}
        onContactSales={() => handleContactSales('banner_contact')}
        demoEmail="demo@legolex.com"
      />

      {/* Welcome Tour - First visit only */}
      <DemoWelcomeTour
        isOpen={showTour}
        onClose={handleTourClose}
        onComplete={handleTourComplete}
      />

      {/* Upgrade Prompt - Strategic moments */}
      <DemoUpgradePrompt
        isVisible={showUpgradePrompt}
        onClose={handleUpgradePromptClose}
        feature={upgradePromptFeature}
        variant="toast"
      />

      {/* Exit Intent Modal - When leaving */}
      <ExitIntentModal
        isOpen={showExitIntent}
        onClose={handleExitIntentClose}
      />

      {/* Session Warning Modal */}
      {showSessionWarning && (
        <SessionWarningModal
          type={sessionWarningType}
          onExtend={handleExtendSession}
          onContactSales={() => handleContactSales('session_warning')}
          onDismiss={() => setShowSessionWarning(false)}
        />
      )}
    </>
  );
};

// ============================================================
// SESSION WARNING MODAL
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
          description: 'Only 5 minutes left in your demo. Extend now or schedule a full demo with our team.',
          showExtend: true,
        };
      case 'expired':
        return {
          title: 'Session Expired',
          description: 'Your demo session has ended. Start a new session or get full access with your own data.',
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

        <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-3">
          {content.title}
        </h3>

        <p className="text-slate-600 dark:text-slate-400 mb-6">
          {content.description}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          {content.showExtend && (
            <button
              onClick={onExtend}
              className="flex-1 py-3 px-6 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all"
            >
              Extend Session
            </button>
          )}
          <button
            onClick={onContactSales}
            className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/25"
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
