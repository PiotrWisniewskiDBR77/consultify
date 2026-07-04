/**
 * DemoModeBanner Component
 *
 * Displays a prominent banner when demo mode is active.
 * Shows demo organization info and provides quick exit action.
 */
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronUp,
  Eye,
  FlaskConical,
  HelpCircle,
  Lightbulb,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { usePolicySnapshot } from '../../contexts/AccessPolicyContext';
import { useDemo } from '../../hooks/useDemo';
import { useAppStore } from '../../store/useAppStore';

interface DemoModeBannerProps {
  className?: string;
}

export const DemoModeBanner: React.FC<DemoModeBannerProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAppStore();
  const {
    isDemoMode,
    demoExperienceType,
    demoOrganization,
    demoStats,
    demoHints,
    isDemoLoading,
    exitDemoMode,
  } = useDemo();
  const { snapshot, isApproachingLimit } = usePolicySnapshot();
  const approachingAi = isApproachingLimit('aiCalls');
  const approachingTokens = isApproachingLimit('tokens');

  const [isExpanded, setIsExpanded] = useState(false);

  // Don't show demo banner for SuperAdmin - they have access to all orgs including demo
  const isSuperAdmin = currentUser?.role?.toUpperCase() === 'SUPERADMIN';
  const isWorkspaceDemo = demoExperienceType === 'workspace_demo';

  if (!isDemoMode || isSuperAdmin) return null;

  // Common button styles for uniform size
  const buttonBaseClass =
    'flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors';
  const buttonPrimaryClass = `${buttonBaseClass} bg-navy-800/60 hover:bg-navy-800 border border-c-border-subtle text-slate-200 hover:text-slate-100`;
  const buttonSecondaryClass = `${buttonBaseClass} bg-navy-800/40 hover:bg-navy-800/60 border border-c-border-subtle text-slate-600 hover:text-slate-200`;

  return (
    <AnimatePresence>
      {/*
       * Feedback #f574311b "Pasek Limitations - wizualnie": previously the
       * outer banner animated in with `y: -100 → 0` (CSS translate). During
       * the enter animation the banner is visually offset upwards while
       * still occupying its layout slot, which made the translated banner
       * draw on top of the sibling `TrialBanner` below — reproducing the
       * "bar overlaps bar below" report. Opacity-only entry keeps the
       * layout stable so the expanded section only pushes content down in
       * normal document flow and never floats above other bars.
       */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className={`relative z-0 bg-navy-900/95 dark:bg-navy-950 border-b border-c-border-subtle text-slate-100 ${className}`}
      >
        {/* Main Banner Row */}
        <div className="px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Left: Demo indicator */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1.5">
                <FlaskConical className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">
                  {isWorkspaceDemo
                    ? t('demo.banner.sampleWorkspace', 'Sample Workspace')
                    : t('demo.banner.mode', 'Demo Mode')}
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span className="font-medium text-sm">
                  {demoOrganization?.name || 'Atelier Toys'}
                </span>
              </div>

              {/* Stats badges + usage meters */}
              <div className="hidden md:flex items-center gap-2 text-xs">
                {demoStats && (
                  <>
                    <span className="bg-navy-800/50 rounded-lg px-3 py-1.5 text-slate-600 border border-c-border-subtle">
                      {demoStats.projects ?? 0} {t('demo.banner.projects', 'projects')}
                    </span>
                    <span className="bg-navy-800/50 rounded-lg px-3 py-1.5 text-slate-600 border border-c-border-subtle">
                      {demoStats.initiatives ?? 0} {t('demo.banner.initiatives', 'initiatives')}
                    </span>
                  </>
                )}
                {snapshot?.limits && snapshot?.usageToday && (
                  <span
                    className={`rounded-lg px-3 py-1.5 border ${
                      approachingAi
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-navy-800/50 text-slate-600 border-c-border-subtle'
                    }`}
                    title={t('demo.banner.aiUsageTooltip', 'AI calls used today / daily limit')}
                  >
                    {/*
                      Feedback #a26d96f3: the old "AI: 25/25" label was read by
                      users as "25 remaining of 25", so they assumed they still
                      had quota while the chat was actually blocked. Show the
                      direction explicitly with a "used" suffix and keep the
                      tooltip for the full explanation.
                    */}
                    {t('demo.banner.aiUsageLabel', 'AI')} {snapshot.usageToday.aiCalls ?? 0}/
                    {snapshot.limits.maxAICallsPerDay ?? 10} {t('demo.banner.used', 'used')}
                  </span>
                )}
                {snapshot?.limits &&
                  snapshot?.usageToday &&
                  (snapshot.limits.maxTotalTokens ?? 0) > 0 && (
                    <span
                      className={`rounded-lg px-3 py-1.5 border ${
                        approachingTokens
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-navy-800/50 text-slate-600 border-c-border-subtle'
                      }`}
                      title={t('demo.banner.tokenUsageTooltip', 'Tokens used today / daily limit')}
                    >
                      {(snapshot.usageToday.tokensUsed ?? 0) / 1000}k/
                      {(snapshot.limits.maxTotalTokens ?? 10000) / 1000}k{' '}
                      {t('demo.banner.used', 'used')}
                    </span>
                  )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* Expand/collapse button — feedback #b85f5a91 wants a clear
                   "Limitations" label across all locales. The toggle flips
                   between "Limitations" / "Ograniczenia" when collapsed and
                   "Hide" / "Ukryj" when expanded. */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`hidden sm:flex ${buttonSecondaryClass}`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>
                  {isExpanded
                    ? t('demo.banner.hideLimitations', 'Hide')
                    : t('demo.banner.showLimitations', 'Limitations')}
                </span>
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Exit demo button */}
              <button
                onClick={exitDemoMode}
                disabled={isDemoLoading}
                className={`${buttonPrimaryClass} disabled:opacity-50`}
              >
                {isDemoLoading ? (
                  <div className="w-4 h-4 border-2 border-c-border border-t-white rounded-full animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {isWorkspaceDemo
                    ? t('demo.banner.exitWorkspace', 'Exit Sample Workspace')
                    : t('demo.banner.exit', 'Exit Demo')}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Expanded hints section */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 py-3 bg-navy-900/80 border-t border-c-border-subtle">
                <div className="max-w-7xl mx-auto">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Info Cards */}
                    <div className="flex flex-wrap items-center gap-6">
                      {/* Warning */}
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-slate-200">
                            {t('demo.banner.readOnlyTitle', 'Read-only mode')}
                          </p>
                          <p className="text-slate-600 text-xs">
                            {t(
                              'demo.banner.readOnlyDesc',
                              'Changes are not saved and the sample can be explored safely'
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex items-center gap-2 text-sm">
                        <Eye className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-slate-200">
                            {t('demo.banner.exploreTitle', 'Understand the workflow')}
                          </p>
                          <p className="text-slate-600 text-xs">
                            {t(
                              'demo.banner.exploreDesc',
                              'See how dashboards, initiatives, and AI fit together'
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Hints */}
                      <div className="flex items-center gap-2 text-sm">
                        <Lightbulb className="w-4 h-4 text-primary-400 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-slate-200">
                            {t('demo.banner.hintTitle', 'What to review next')}
                          </p>
                          <p className="text-slate-600 text-xs">
                            {demoHints?.[0] ||
                              t(
                                'demo.banner.defaultHint',
                                'Open one initiative and trace the linked tasks, decisions, and AI context'
                              )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {/* Help Button */}
                      <button
                        onClick={() => navigate('/help')}
                        className={`${buttonSecondaryClass} bg-white/10 hover:bg-white/20`}
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>{t('demo.banner.help', 'Help')}</span>
                      </button>

                      {/* Return to workspace */}
                      <button
                        onClick={() => void exitDemoMode()}
                        className={`${buttonSecondaryClass} bg-white/10 hover:bg-white/20`}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>{t('demo.banner.backToWorkspace', 'Back to my workspace')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default DemoModeBanner;
