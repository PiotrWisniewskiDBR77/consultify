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

import { useDemo } from '../../hooks/useDemo';
import { useDemoSession } from '../../hooks/useDemoSession';
import { Api } from '../../services/api';
import { trackTourCompleted, trackUpgradeClick } from '../../services/demoAnalyticsService';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import { useAppStore } from '../../store/useAppStore';
import { DemoConversionCTA, type ValueMomentType } from './DemoConversionCTA';
import { DemoLoadingOverlay } from './DemoLoadingOverlay';
import { DemoSignupModal } from './DemoSignupModal';
import { DemoTrialButton } from './DemoTrialButton';
import { DemoUpgradePrompt } from './DemoUpgradePrompt';
import { DemoWelcomeTour } from './DemoWelcomeTour';
import { ExitIntentModal } from './ExitIntentModal';
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
  const { currentUser, isDemoMode, isDemoLoading } = useAppStore();
  const { demoExperienceType, exitDemoMode } = useDemo();
  const {
    isDemo,
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
  const isWorkspaceDemo = demoExperienceType === 'workspace_demo';

  // Get session ID for analytics
  const sessionId = sessionStorage.getItem('demo_session_id') || 'unknown';

  // UI State
  const [showTour, setShowTour] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradePromptFeature, setUpgradePromptFeature] = useState<string>('');
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [sessionWarningType, setSessionWarningType] = useState<'1h' | '5min' | 'expired'>('1h');
  const [entrySource, setEntrySource] = useState<string | null>(null);
  const [demoOrgName, setDemoOrgName] = useState('Atelier Toys');
  const [demoScenarios, setDemoScenarios] = useState<
    Array<{ id: string; title: string; duration?: string; audience?: string; persona?: string }>
  >([]);

  // T090: Conversion flow state
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showValueCTA, setShowValueCTA] = useState(false);
  const [currentValueMoment, setCurrentValueMoment] = useState<ValueMomentType>('report_generated');

  // Exit intent detection
  const { showExitIntent, dismissExitIntent } = useExitIntent({
    disabled: !isDemo || isWorkspaceDemo,
    delayMs: 10000, // Wait 10 seconds before enabling
    triggerOnce: true,
  });

  useEffect(() => {
    if (!isDemo) return;

    const source =
      sessionStorage.getItem('demo_entry_source') ||
      (isDemoMode ? 'profile_menu' : currentUser?.isDemo ? 'landing_page' : 'demo_session');
    setEntrySource(source);

    let active = true;
    Api.getDemoOrganization()
      .then((response) => {
        if (!active || !response?.success) return;
        setDemoOrgName(response.organization?.name || 'Atelier Toys');
        setDemoScenarios(Array.isArray(response.scenarios) ? response.scenarios : []);
      })
      .catch(() => {
        if (!active) return;
        setDemoOrgName('Atelier Toys');
        setDemoScenarios([]);
      });

    return () => {
      active = false;
    };
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
      organization: demoOrgName,
      scenarioCount: demoScenarios.length,
    });
  }, [
    demoExperienceType,
    demoOrgName,
    demoScenarios.length,
    entrySource,
    isDemo,
    isDemoMode,
    sessionId,
  ]);

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
    if (isWorkspaceDemo) return;
    if (upgradePromptsShown >= CONFIG.MAX_UPGRADE_PROMPTS) return;
    if (hasCompletedTour === false) return; // Wait for tour completion

    if (sessionDurationMs >= CONFIG.UPGRADE_PROMPT_DELAY_MS && upgradePromptsShown === 0) {
      setUpgradePromptFeature('time');
      setShowUpgradePrompt(true);
      incrementUpgradePrompts();
    }
  }, [
    hasCompletedTour,
    incrementUpgradePrompts,
    isDemo,
    isWorkspaceDemo,
    sessionDurationMs,
    upgradePromptsShown,
  ]);

  // Feature exploration upgrade prompt
  useEffect(() => {
    if (!isDemo) return;
    if (isWorkspaceDemo) return;
    if (upgradePromptsShown >= CONFIG.MAX_UPGRADE_PROMPTS) return;

    if (
      featuresExplored.length >= CONFIG.UPGRADE_PROMPT_FEATURE_THRESHOLD &&
      upgradePromptsShown < 2
    ) {
      // Only show if we haven't shown the time-based one recently
      if (sessionDurationMs > CONFIG.UPGRADE_PROMPT_DELAY_MS + 60000) {
        setUpgradePromptFeature('features');
        setShowUpgradePrompt(true);
        incrementUpgradePrompts();
      }
    }
  }, [
    featuresExplored,
    incrementUpgradePrompts,
    isDemo,
    isWorkspaceDemo,
    sessionDurationMs,
    upgradePromptsShown,
  ]);

  // --------------------------------------------------------
  // SESSION WARNINGS
  // --------------------------------------------------------

  useEffect(() => {
    if (!isDemo) return;

    // 1 hour warning
    if (
      timeRemainingMs <= CONFIG.SESSION_WARNING_1H_MS &&
      timeRemainingMs > CONFIG.SESSION_WARNING_5MIN_MS
    ) {
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
      t(
        'demo.tourComplete.message',
        isWorkspaceDemo
          ? "You're ready to explore the sample workspace. Use it as a safe reference before applying the same workflow in your own environment."
          : "You're ready to explore! This platform typically saves teams 3+ weeks of consulting work."
      ),
      {
        duration: 5000,
        icon: '🎉',
        style: {
          background: 'linear-gradient(135deg, #A51C30 0%, #A51C30 100%)',
          color: 'white',
          fontWeight: '500',
        },
      }
    );
  }, [isWorkspaceDemo, markTourCompleted, sessionId, t]);

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

  // T090: Value moment CTA trigger (can be called externally via window event)
  useEffect(() => {
    if (!isDemo) return;
    if (isWorkspaceDemo) return;

    const handleValueMoment = (e: CustomEvent<{ type: ValueMomentType }>) => {
      setCurrentValueMoment(e.detail.type);
      setShowValueCTA(true);
      trackFunnelEvent('demo_value_moment_reached', { type: e.detail.type });
    };

    window.addEventListener('demo:value_moment', handleValueMoment as EventListener);
    return () =>
      window.removeEventListener('demo:value_moment', handleValueMoment as EventListener);
  }, [isDemo, isWorkspaceDemo]);

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
      // Track upgrade click
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

  // Don't render anything if not in demo mode
  if (!isDemo) {
    return null;
  }

  return (
    <>
      {/* Loading overlay while demo environment is being prepared */}
      <DemoLoadingOverlay isVisible={isDemoLoading} />

      {/* Welcome Tour - First visit only */}
      <DemoWelcomeTour
        isOpen={showTour}
        onClose={handleTourClose}
        onComplete={handleTourComplete}
        entrySource={entrySource}
        organizationName={demoOrgName}
        scenarios={demoScenarios}
      />

      {!isWorkspaceDemo && (
        <>
          {/* Upgrade Prompt - Strategic moments */}
          <DemoUpgradePrompt
            isVisible={showUpgradePrompt}
            onClose={handleUpgradePromptClose}
            feature={upgradePromptFeature}
            variant="toast"
          />

          {/* Exit Intent Modal - When leaving */}
          <ExitIntentModal isOpen={showExitIntent} onClose={handleExitIntentClose} />
        </>
      )}

      {/* Session Warning Modal */}
      {showSessionWarning && (
        <SessionWarningModal
          type={sessionWarningType}
          onExtend={handleExtendSession}
          onContactSales={() => handleContactSales('session_warning')}
          actionLabel={
            isWorkspaceDemo
              ? t('demo.session.returnWorkspace', 'Back to my workspace')
              : t('demo.session.fullAccess', 'Get Full Access')
          }
          onDismiss={() => setShowSessionWarning(false)}
          isWorkspaceDemo={isWorkspaceDemo}
        />
      )}

      {isWorkspaceDemo ? (
        <WorkspaceDemoNextSteps
          isVisible={!showTour}
          organizationName={demoOrgName}
          scenarios={demoScenarios}
          onExit={exitDemoMode}
        />
      ) : (
        <>
          {/* T090: Persistent Trial Button */}
          <DemoTrialButton onClick={() => setShowSignupModal(true)} />

          {/* T090: Contextual Value Moment CTA */}
          <DemoConversionCTA
            isVisible={showValueCTA}
            valueMoment={currentValueMoment}
            onStartTrial={handleStartTrialFromCTA}
            onDismiss={() => setShowValueCTA(false)}
          />

          {/* T090: Signup Modal */}
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
// SESSION WARNING MODAL
// ============================================================

interface SessionWarningModalProps {
  type: '1h' | '5min' | 'expired';
  onExtend: () => void;
  onContactSales: () => void;
  actionLabel: string;
  onDismiss: () => void;
  isWorkspaceDemo: boolean;
}

const SessionWarningModal: React.FC<SessionWarningModalProps> = ({
  type,
  onExtend,
  onContactSales,
  actionLabel,
  onDismiss,
  isWorkspaceDemo,
}) => {
  const getContent = () => {
    switch (type) {
      case '1h':
        return {
          title: 'Session Ending Soon',
          description: isWorkspaceDemo
            ? 'Your sample workspace will refresh in 1 hour. Extend the session if you want to keep exploring.'
            : 'Your demo session will expire in 1 hour. Would you like to extend it?',
          showExtend: true,
        };
      case '5min':
        return {
          title: 'Session Almost Over',
          description: isWorkspaceDemo
            ? 'Only 5 minutes remain in this sample workspace. Extend it or return to your own workspace.'
            : 'Only 5 minutes left in your demo. Extend now or schedule a full demo with our team.',
          showExtend: true,
        };
      case 'expired':
        return {
          title: 'Session Expired',
          description: isWorkspaceDemo
            ? 'This sample workspace has expired. Start a fresh sample session or return to your own workspace.'
            : 'Your demo session has ended. Start a new session or get full access with your own data.',
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
            {actionLabel}
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

interface WorkspaceDemoNextStepsProps {
  isVisible: boolean;
  organizationName: string;
  scenarios: Array<{
    id: string;
    title: string;
    duration?: string;
    audience?: string;
    persona?: string;
  }>;
  onExit: () => void | Promise<void>;
}

const WorkspaceDemoNextSteps: React.FC<WorkspaceDemoNextStepsProps> = ({
  isVisible,
  organizationName,
  scenarios,
  onExit,
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-6 z-40 max-w-md rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur dark:border-c-border-subtle dark:bg-navy-900/95">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-300">
        Sample workspace
      </p>
      <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
        {organizationName} is here to show you how the workflow looks in practice.
      </h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Review a guided scenario, note the flow you want to reuse, then return to your own workspace
        to apply it on real data.
      </p>
      {scenarios.length > 0 && (
        <div className="mt-3 space-y-2">
          {scenarios.slice(0, 3).map((scenario) => (
            <div
              key={scenario.id}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-c-border-subtle"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {scenario.title}
                </span>
                {scenario.duration ? (
                  <span className="text-slate-600 dark:text-slate-500">{scenario.duration}</span>
                ) : null}
              </div>
              {(scenario.persona || scenario.audience) && (
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  {[scenario.persona, scenario.audience].filter(Boolean).join(' • ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void onExit()}
          className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
        >
          Back to my workspace
        </button>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-c-border-subtle dark:text-slate-200 dark:hover:bg-white/5"
        >
          Review the walkthrough
        </button>
      </div>
    </div>
  );
};

export default DemoSessionManager;
