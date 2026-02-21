import React from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useHelp, useHelpPlaybooks, useHelpSidePanel } from '../../contexts/HelpContext';
import { useAppStore } from '../../store/useAppStore';

const shownKey = (userId: string) => `consultify_onboarding_cta_shown:${userId}`;
const dismissedKey = (userId: string) => `consultify_onboarding_cta_dismissed:${userId}`;

export const OnboardingFirstLoginCTA: React.FC = () => {
  const { t } = useTranslation();
  const currentUser = useAppStore((s) => s.currentUser);
  const { logEvent } = useHelp();
  const { setOpen, setActiveTab } = useHelpSidePanel();
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
        <div className="max-w-sm w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-xl rounded-xl p-4">
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {t('help.onboarding.cta.toast.title', 'Start onboarding')}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
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
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              {t('help.onboarding.cta.toast.later', 'Later')}
            </button>
            <button
              onClick={async () => {
                try {
                  localStorage.setItem('consultify_onboarding_autostart_playbook', 'first-30-min');
                } catch {
                  // ignore
                }
                await logEvent('first-30-min', 'STARTED', { source: 'first_login_toast' });
                setActiveTab('onboarding');
                setOpen(true);
                toast.dismiss(toastInstance.id);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors"
            >
              {t('help.onboarding.cta.toast.start', 'Start')}
            </button>
          </div>
        </div>
      ),
      { duration: 12000 }
    );

    return () => toast.dismiss(id);
  }, [currentUser?.id, logEvent, playbooks, setActiveTab, setOpen, t]);

  return null;
};

export default OnboardingFirstLoginCTA;
