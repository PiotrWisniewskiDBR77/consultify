import { AlertTriangle, ArrowRight } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { usePolicySnapshot } from '../../contexts/AccessPolicyContext';

interface TrialBannerProps {
  daysRemaining: number;
  warningLevel: 'none' | 'warning' | 'critical' | 'expired';
  onUpgradeClick: () => void;
  bannerText?: string | null;
  actionLabel?: string | null;
  usageToday?: { aiCalls: number; tokensUsed: number; storageMb: number };
  limits?: { maxAICallsPerDay: number; maxTotalTokens: number; maxStorageMb: number };
}

/**
 * TrialBanner - Persistent banner for Trial organizations (DBR77 tech-sexy)
 * Always visible during trial; shows days remaining and upgrade CTA
 */
const TrialBanner: React.FC<TrialBannerProps> = ({
  daysRemaining,
  warningLevel,
  onUpgradeClick,
  bannerText,
  actionLabel,
  usageToday,
  limits,
}) => {
  const { t } = useTranslation();
  const { isApproachingLimit } = usePolicySnapshot();
  const approachingAi = isApproachingLimit('aiCalls');
  const approachingTokens = isApproachingLimit('tokens');
  const showLimitWarning = approachingAi || approachingTokens;

  const handleAction = () => {
    onUpgradeClick();
  };

  // Always show during trial (plan: "constantly" remind user)
  // DBR77: navy/slate base, single accent for CTA, urgency via border-left
  const getBannerStyles = () => {
    switch (warningLevel) {
      case 'warning':
        return 'bg-amber-500/10 dark:bg-amber-500/5 border-l-4 border-amber-500 text-slate-800 dark:text-slate-200';
      case 'critical':
        return 'bg-amber-500/15 dark:bg-amber-500/10 border-l-4 border-amber-600 text-slate-800 dark:text-slate-200';
      case 'expired':
        return 'bg-danger-500/10 dark:bg-danger-500/5 border-l-4 border-danger-500 text-slate-800 dark:text-slate-200';
      default:
        return 'bg-navy-800/40 dark:bg-navy-800/60 border-l-4 border-primary-500/50 text-slate-700 dark:text-slate-300';
    }
  };

  const getMessage = () => {
    if (bannerText) return bannerText;
    if (warningLevel === 'expired') {
      return t('trial.expired', 'Your trial has expired. Upgrade to continue.');
    }
    if (daysRemaining === 1) {
      return t('trial.lastDay', 'Trial: 1 day left — upgrade to save your work');
    }
    return t('trial.daysRemaining', 'Trial: {{days}} days left • Upgrade to keep your data', {
      days: daysRemaining,
    });
  };

  return (
    <div
      className={`px-4 py-2.5 flex items-center justify-between gap-4 ${getBannerStyles()}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 min-w-0">
        {(warningLevel === 'warning' || warningLevel === 'critical') && (
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-500" />
        )}
        <span className="font-medium text-sm truncate">{getMessage()}</span>
        {usageToday && limits && limits.maxAICallsPerDay > 0 && (
          <span className="hidden sm:inline text-slate-500 text-xs">
            • AI: {usageToday.aiCalls ?? 0}/{limits.maxAICallsPerDay}
          </span>
        )}
        {showLimitWarning && (
          <span className="hidden sm:inline text-amber-600 dark:text-amber-500 text-xs font-medium">
            • {t('access.banner.approachingLimits', 'Approaching limit')}
          </span>
        )}
      </div>
      <button
        onClick={handleAction}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-c-text hover:bg-c-text-secondary text-c-bg transition-colors flex-shrink-0"
      >
        {actionLabel || t('trial.upgrade', 'Upgrade')}
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default TrialBanner;
