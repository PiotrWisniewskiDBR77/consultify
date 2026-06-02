/**
 * SubscriberDashboardLayout
 *
 * Embeddable wrapper for the subscriber dashboard. Renders an honest,
 * brand-light shell:
 *
 *   - Top bar with the "Consultify" wordmark (placeholder for a future
 *     org-supplied logo) and an optional right-side slot (e.g. a sign-out
 *     button or refresh control).
 *   - Centered content column capped at ~960px so the page is readable
 *     when iframed inside a wider host page.
 *   - Footer with a "Powered by Consultify" link and a privacy reminder
 *     ("This dashboard never displays your signing secret.") so the
 *     subscriber knows what kind of surface they're looking at without
 *     reading the docs.
 *
 * The `embed` flag (typically driven by `?embed=1`) collapses the
 * chrome down to the minimum: no top bar logo, no footer, reduced
 * padding. Use this when the page is hosted inside a subscriber's own
 * ops dashboard.
 */

import React from 'react';

const COPY = {
  brand: 'Consultify',
  poweredBy: 'Powered by Consultify',
  privacyNote: 'This dashboard never displays your signing secret.',
} as const;

export interface SubscriberDashboardLayoutProps {
  embed?: boolean;
  rightHeaderContent?: React.ReactNode;
  children: React.ReactNode;
}

const SubscriberDashboardLayout: React.FC<SubscriberDashboardLayoutProps> = ({
  embed = false,
  rightHeaderContent,
  children,
}) => {
  const containerPad = embed ? 'px-4 py-4' : 'px-4 py-8 sm:px-6';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {!embed && (
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mx-auto flex max-w-[960px] items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-xs font-bold text-white"
              >
                C
              </span>
              <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {COPY.brand}
              </span>
            </div>
            {rightHeaderContent ? (
              <div className="flex items-center gap-2">{rightHeaderContent}</div>
            ) : null}
          </div>
        </header>
      )}

      {embed && rightHeaderContent ? (
        <div className="mx-auto flex max-w-[960px] items-center justify-end px-4 pt-3 sm:px-6">
          <div className="flex items-center gap-2">{rightHeaderContent}</div>
        </div>
      ) : null}

      <main className={`mx-auto max-w-[960px] ${containerPad}`}>{children}</main>

      {!embed && (
        <footer className="border-t border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mx-auto flex max-w-[960px] flex-col gap-1 px-4 py-4 text-[11px] text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <a
              href="https://consultify.example.com"
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400"
            >
              {COPY.poweredBy}
            </a>
            <span>{COPY.privacyNote}</span>
          </div>
        </footer>
      )}
    </div>
  );
};

export default SubscriberDashboardLayout;
