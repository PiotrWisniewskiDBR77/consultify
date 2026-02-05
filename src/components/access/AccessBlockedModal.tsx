import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { trackFunnelEvent } from '../../services/funnelAnalytics';

type AccessBlockedCTA = {
  label: string;
  href: string;
};

type AccessBlockedDetail = {
  code?: string;
  message?: string;
  cta?: AccessBlockedCTA;
  accessContext?: any;
};

const SALES_CALL_URL =
  'https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017';

function getDefaultCta(code?: string): AccessBlockedCTA | null {
  switch (code) {
    case 'ORG_NOT_FOUND':
    case 'ORG_INACTIVE':
      return { label: 'Log in again', href: '/auth?mode=login' };
    case 'TRIAL_PROFILE_INCOMPLETE':
      return { label: 'Complete setup', href: '/org-setup' };
    case 'DEMO_TIME_EXPIRED':
    case 'DEMO_AI_SESSION_LIMIT_REACHED':
    case 'DEMO_READ_ONLY':
      return { label: 'Start free trial', href: '/auth?mode=register' };
    case 'TRIAL_EXPIRED':
    case 'AI_LIMIT_REACHED':
    case 'AI_TOKEN_BUDGET_EXCEEDED':
    case 'INSUFFICIENT_TOKENS':
      return {
        label: code === 'AI_TOKEN_BUDGET_EXCEEDED' ? 'Add payment method' : 'Go to billing',
        href: '/settings/billing',
      };
    default:
      return null;
  }
}

export const AccessBlockedModal: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<AccessBlockedDetail>({});

  const resolved = useMemo(() => {
    const code = detail.code || 'ACCESS_BLOCKED';
    const message =
      detail.message ||
      (code === 'ORG_NOT_FOUND'
        ? 'Organization not found. Please log in again to refresh your session.'
        : code === 'ORG_INACTIVE'
          ? 'Your organization is inactive. Please contact support or log in again.'
          : code === 'TRIAL_PROFILE_INCOMPLETE'
            ? 'Complete organization setup to start your trial AI experience.'
            : code === 'AI_TOKEN_BUDGET_EXCEEDED'
              ? 'Your trial AI budget has been used. Add a payment method to continue using AI.'
              : code === 'AI_LIMIT_REACHED'
                ? 'You have reached your AI limit. Upgrade to continue.'
                : code === 'TRIAL_EXPIRED'
                  ? 'Your trial has expired. Upgrade to continue.'
                  : 'This action is blocked in your current access level.');
    const cta = detail.cta || getDefaultCta(code) || undefined;
    const isDemoBlock =
      code === 'DEMO_TIME_EXPIRED' ||
      code === 'DEMO_AI_SESSION_LIMIT_REACHED' ||
      code === 'DEMO_READ_ONLY';
    const isOrgError = code === 'ORG_NOT_FOUND' || code === 'ORG_INACTIVE';
    return { code, message, cta, isDemoBlock, isOrgError };
  }, [detail]);

  useEffect(() => {
    const onBlocked = (evt: Event) => {
      const e = evt as CustomEvent<AccessBlockedDetail>;
      setDetail(e.detail || {});
      setOpen(true);
    };
    const onDemoBlocked = (evt: Event) => {
      const e = evt as CustomEvent<{ message?: string; action?: string }>;
      setDetail({
        code: 'DEMO_READ_ONLY',
        message:
          e.detail?.message ||
          'Demo mode is read-only. Start a free trial to create your own data.',
      });
      setOpen(true);
    };
    window.addEventListener('access:blocked', onBlocked as EventListener);
    window.addEventListener('DEMO_ACTION_BLOCKED', onDemoBlocked as EventListener);
    return () => {
      window.removeEventListener('access:blocked', onBlocked as EventListener);
      window.removeEventListener('DEMO_ACTION_BLOCKED', onDemoBlocked as EventListener);
    };
  }, []);

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
          Access required
        </div>
        <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{resolved.message}</div>

        <div className="mt-6 flex flex-wrap gap-2 justify-end">
          {resolved.isDemoBlock && (
            <button
              onClick={() => window.open(SALES_CALL_URL, '_blank')}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-navy-700 text-navy-900 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Book a call
            </button>
          )}

          <button
            onClick={() => setOpen(false)}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          >
            Close
          </button>

          {resolved.cta && (
            <button
              onClick={() => {
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
