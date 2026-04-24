import { ArrowRight, Clock3, FlaskConical, Sparkles, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { usePolicySnapshot } from '../../contexts/AccessPolicyContext';
import { useDemo } from '../../hooks/useDemo';
import { useDemoSession } from '../../hooks/useDemoSession';
import { normalizeLanguageCode } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';

interface DemoTopbarStatusProps {
  className?: string;
  compact?: boolean;
}

function formatRemainingTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export const DemoTopbarStatus: React.FC<DemoTopbarStatusProps> = ({
  className = '',
  compact = false,
}) => {
  const { t } = useTranslation();
  const currentUser = useAppStore((s) => s.currentUser);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const { snapshot } = usePolicySnapshot();
  const {
    demoOrganization,
    demoLocale,
    isDemoLoading,
    isDemoLocaleMismatch,
    toggleDemoMode,
    exitDemoMode,
  } = useDemo();
  const { isDemo, timeRemainingMs } = useDemoSession();

  if (!isDemo) return null;

  const orgName = demoOrganization?.name || 'Atelier Toys';
  const aiUsed = snapshot?.usageToday?.aiCalls ?? null;
  const aiLimit = snapshot?.limits?.maxAICallsPerDay ?? null;
  const tokenUsed = snapshot?.usageToday?.tokensUsed ?? null;
  const tokenLimit = snapshot?.limits?.maxTotalTokens ?? null;
  const desiredLocale = normalizeLanguageCode(
    typeof document !== 'undefined' ? document.documentElement.lang : 'en'
  );
  const restartTargetLocale = desiredLocale === 'pl' ? 'PL' : 'EN';

  return (
    <div className={`min-w-0 items-center gap-2 ${className}`}>
      <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs text-violet-200">
        <FlaskConical className="h-3.5 w-3.5" />
        <span className="font-semibold uppercase tracking-wide">
          {t('demo.banner.mode', 'Demo Mode')}
        </span>
      </div>

      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-1 text-xs text-slate-600 dark:text-slate-300">
        <span className="font-medium">{orgName}</span>
        <span className="text-slate-400 dark:text-slate-500">read-only</span>
        {demoLocale && (
          <span className="rounded-full bg-slate-200/80 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
            {demoLocale}
          </span>
        )}
      </div>

      {!compact && (
        <div className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-1 text-xs text-slate-600 dark:text-slate-300">
          <Clock3 className="h-3.5 w-3.5" />
          <span>{formatRemainingTime(timeRemainingMs)}</span>
        </div>
      )}

      {!compact && typeof aiUsed === 'number' && typeof aiLimit === 'number' && aiLimit > 0 && (
        <div className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-1 text-xs text-slate-600 dark:text-slate-300">
          <Sparkles className="h-3.5 w-3.5" />
          <span>
            AI {aiUsed}/{aiLimit}
          </span>
        </div>
      )}

      {!compact &&
        typeof tokenUsed === 'number' &&
        typeof tokenLimit === 'number' &&
        tokenLimit > 0 && (
          <div className="hidden 2xl:inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-1 text-xs text-slate-600 dark:text-slate-300">
            <span>
              {Math.round(tokenUsed / 1000)}k/{Math.round(tokenLimit / 1000)}k tokens
            </span>
          </div>
        )}

      {compact && (
        <div className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-1 text-xs text-slate-600 dark:text-slate-300">
          <Clock3 className="h-3.5 w-3.5" />
          <span>{formatRemainingTime(timeRemainingMs)}</span>
        </div>
      )}

      {isDemoMode && isDemoLocaleMismatch && (
        <button
          type="button"
          onClick={() => toggleDemoMode(true, { source: 'demo_locale_restart' })}
          disabled={isDemoLoading}
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-200 transition-colors hover:bg-amber-500/15 disabled:opacity-50"
        >
          <span>
            {t('demo.banner.restartLocale', 'Reload demo in {{locale}}', {
              locale: restartTargetLocale,
            })}
          </span>
        </button>
      )}

      {isDemoMode ? (
        <button
          type="button"
          onClick={exitDemoMode}
          disabled={isDemoLoading}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          <span>
            {compact ? t('demo.banner.exitShort', 'Exit') : t('demo.banner.exit', 'Exit Demo')}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => window.location.assign('/auth?action=trial')}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-primary-600"
        >
          <span>
            {currentUser?.isDemo
              ? t('demo.banner.startTrial', 'Start Trial')
              : t('trial.upgrade', 'Upgrade')}
          </span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export default DemoTopbarStatus;
