import React from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useHelp, useHelpPlaybooks } from '../../contexts/HelpContext';
import { ROUTES } from '../../routes/routeConfig';
import { useAppStore } from '../../store/useAppStore';

const shownKey = (userId: string) => `consultify_onboarding_cta_shown:${userId}`;
const dismissedKey = (userId: string) => `consultify_onboarding_cta_dismissed:${userId}`;

export const OnboardingFirstLoginCTA: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const { logEvent } = useHelp();
  const playbooks = useHelpPlaybooks();

  const hasShownRef = React.useRef(false);

  React.useEffect(() => {
    const userId = currentUser?.id;
    if (!userId) return;
    if (hasShownRef.current) return;

    try {
      if (localStorage.getItem(dismissedKey(userId)) === 'true') return;
      if (localStorage.getItem(shownKey(userId)) === 'true') return;
    } catch {
      // ignore storage errors
    }

    const first30 = playbooks.find((p) => p.key === 'first-30-min');
    if (!first30) return;

    // Only nudge if there's something to do.
    if (first30.status === 'COMPLETED' || first30.status === 'DISMISSED') return;

    hasShownRef.current = true;
    try {
      localStorage.setItem(shownKey(userId), 'true');
    } catch {
      // ignore
    }

    const id = toast.custom(
      (toastInstance) => (
        <div className="max-w-sm w-full bg-c-surface border border-slate-200/60 dark:border-white/[0.03] shadow-xl rounded-xl p-4">
          <div className="text-sm font-bold text-c-text">
            {t('help.onboarding.cta.toast.title', 'Start onboarding')}
          </div>
          <div className="text-sm text-c-text-secondary mt-1 leading-relaxed">
            {t(
              'help.onboarding.cta.toast.body',
              'Take the “First 30 minutes” path to reach your first value fast — no walls of text, just steps and deep links.'
            )}
          </div>
          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              onClick={async () => {
                try {
                  localStorage.setItem(dismissedKey(userId), 'true');
                } catch {
                  // ignore
                }
                await logEvent('first-30-min', 'CTA_DISMISSED', { source: 'first_login_toast' });
                toast.dismiss(toastInstance.id);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised transition-colors"
            >
              {t('help.onboarding.cta.toast.later', 'Later')}
            </button>
            <button
              onClick={async () => {
                await logEvent('first-30-min', 'INTRO_OPENED', { source: 'first_login_toast' });
                toast.dismiss(toastInstance.id);
                navigate(ROUTES.APP_INTRO);
              }}
 className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-c-text text-c-surface hover:opacity-90 transition-colors"
            >
              {t('help.onboarding.cta.toast.start', 'Open intro')}
            </button>
          </div>
        </div>
      ),
      { duration: 12000 }
    );

    return () => toast.dismiss(id);
  }, [currentUser?.id, logEvent, navigate, playbooks, t]);

  return null;
};

export default OnboardingFirstLoginCTA;
