import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../routes/routeConfig';
import { trackFunnelEvent } from '../../services/funnelAnalytics';

type AccessBlockedCTA = {
  label: string;
  labelKey?: string;
  href: string;
};

type AccessBlockedDetail = {
  code?: string;
  message?: string;
  cta?: AccessBlockedCTA;
  accessContext?: any;
};

const ERROR_CODE_CTA_MAP: Record<string, { labelKey: string; href: string }> = {
  ORG_NOT_FOUND: { labelKey: 'access.cta.goToBilling', href: '/auth?mode=login' },
  ORG_INACTIVE: { labelKey: 'access.cta.goToBilling', href: '/auth?mode=login' },
  TRIAL_PROFILE_INCOMPLETE: { labelKey: 'access.cta.completeSetup', href: ROUTES.ORG_SETUP },
  DEMO_TIME_EXPIRED: { labelKey: 'access.cta.startTrial', href: '/trial/start' },
  DEMO_AI_SESSION_LIMIT_REACHED: { labelKey: 'access.cta.startTrial', href: '/trial/start' },
  DEMO_READ_ONLY: { labelKey: 'access.cta.startTrial', href: '/trial/start' },
  TRIAL_EXPIRED: { labelKey: 'access.cta.upgradeNow', href: '/settings?tab=billing' },
  AI_LIMIT_REACHED: { labelKey: 'access.cta.upgradePlan', href: '/settings?tab=billing' },
  AI_TOKEN_BUDGET_EXCEEDED: {
    labelKey: 'access.cta.addPaymentMethod',
    href: '/settings?tab=billing',
  },
  INSUFFICIENT_TOKENS: { labelKey: 'access.cta.addPaymentMethod', href: '/settings?tab=billing' },
  PROJECT_LIMIT_REACHED: { labelKey: 'access.cta.upgradePlan', href: '/settings?tab=billing' },
  INITIATIVE_LIMIT_REACHED: { labelKey: 'access.cta.upgradePlan', href: '/settings?tab=billing' },
  USER_LIMIT_REACHED: { labelKey: 'access.cta.upgradePlan', href: '/settings?tab=billing' },
  STORAGE_LIMIT_REACHED: { labelKey: 'access.cta.upgradePlan', href: '/settings?tab=billing' },
  SUBSCRIPTION_PAST_DUE: { labelKey: 'access.cta.fixPayment', href: '/settings?tab=billing' },
  SUBSCRIPTION_CANCELLED: { labelKey: 'access.cta.upgradePlan', href: '/settings?tab=billing' },
};

export const AccessBlockedModal: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<AccessBlockedDetail>({});

  const resolved = useMemo(() => {
    const code = detail.code || 'ACCESS_BLOCKED';
    const messageKey = `access.blocked.${code}`;
    const translatedMessage = t(messageKey, { defaultValue: '' });
    const message =
      detail.message ||
      (translatedMessage && translatedMessage !== messageKey
        ? translatedMessage
        : t('access.blocked.default'));

    const ctaConfig = ERROR_CODE_CTA_MAP[code];
    const cta: AccessBlockedCTA | undefined =
      detail.cta ||
      (ctaConfig
        ? { label: t(ctaConfig.labelKey), labelKey: ctaConfig.labelKey, href: ctaConfig.href }
        : undefined);

    const isDemoBlock =
      code === 'DEMO_TIME_EXPIRED' ||
      code === 'DEMO_AI_SESSION_LIMIT_REACHED' ||
      code === 'DEMO_READ_ONLY';
    const isOrgError = code === 'ORG_NOT_FOUND' || code === 'ORG_INACTIVE';
    const isTrialBlock =
      code === 'TRIAL_EXPIRED' ||
      code === 'AI_LIMIT_REACHED' ||
      code === 'AI_TOKEN_BUDGET_EXCEEDED' ||
      code === 'INSUFFICIENT_TOKENS';
    const isLimitBlock =
      code === 'PROJECT_LIMIT_REACHED' ||
      code === 'INITIATIVE_LIMIT_REACHED' ||
      code === 'USER_LIMIT_REACHED' ||
      code === 'STORAGE_LIMIT_REACHED';

    return { code, message, cta, isDemoBlock, isOrgError, isTrialBlock, isLimitBlock };
  }, [detail, t]);

  useEffect(() => {
    const onBlocked = (evt: Event) => {
      const e = evt as CustomEvent<AccessBlockedDetail>;
      setDetail(e.detail || {});
      setOpen(true);
    };
    const onDemoBlocked = (evt: Event) => {
      const e = evt as CustomEvent<{ message?: string; action?: string }>;
      // Feedback #4180b14f: backend was returning a hardcoded English
      // "Demo mode cannot…" message which was rendered verbatim for every
      // locale, so DE/ES/AR/JP users never saw a translated popup. We now
      // always prefer the localized access.blocked.DEMO_READ_ONLY string and
      // only fall back to the backend message when the i18n catalog is
      // genuinely missing the key (shouldn't happen after this sprint).
      const localized = t('access.blocked.DEMO_READ_ONLY');
      const fallbackMessage =
        !localized || localized === 'access.blocked.DEMO_READ_ONLY'
          ? e.detail?.message || 'Demo mode is read-only.'
          : localized;
      setDetail({
        code: 'DEMO_READ_ONLY',
        message: fallbackMessage,
      });
      setOpen(true);
    };
    window.addEventListener('access:blocked', onBlocked as EventListener);
    window.addEventListener('DEMO_ACTION_BLOCKED', onDemoBlocked as EventListener);
    return () => {
      window.removeEventListener('access:blocked', onBlocked as EventListener);
      window.removeEventListener('DEMO_ACTION_BLOCKED', onDemoBlocked as EventListener);
    };
  }, [t]);

  useEffect(() => {
    if (!open) return;
    try {
      trackFunnelEvent('ai_access_blocked', { code: resolved.code });
    } catch {
      // ignore
    }
  }, [open, resolved.code]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

      <div className="relative w-[92vw] max-w-lg rounded-2xl bg-white dark:bg-navy-900 shadow-2xl border border-slate-200 dark:border-navy-700 p-6">
        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">{resolved.code}</div>
        <div className="mt-2 text-lg font-semibold text-navy-900 dark:text-white">
          {t('access.modal.title')}
        </div>
        <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{resolved.message}</div>

        {(resolved.isTrialBlock || resolved.isLimitBlock) && (
          <div className="mt-4 p-3 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20">
            <p className="text-xs text-purple-700 dark:text-purple-300">
              {t('access.upgrade.instantUnlock')}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2 justify-end">
          <button
            onClick={() => setOpen(false)}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          >
            {t('access.modal.close')}
          </button>

          {resolved.cta && (
            <button
              onClick={() => {
                try {
                  trackFunnelEvent('upgrade_cta_clicked', {
                    reason: resolved.code,
                    location: 'blocked_modal',
                    action: 'primary_cta',
                  });
                } catch {
                  // ignore
                }
                setOpen(false);
                navigate(resolved.cta!.href);
              }}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              {resolved.cta.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
