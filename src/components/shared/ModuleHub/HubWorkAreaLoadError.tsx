import React from 'react';

type HubWorkAreaLoadErrorProps = {
  title: string;
  message: string;
  errorCode?: string | null;
  retryLabel: string;
  dismissLabel: string;
  onRetry: () => void;
  onDismiss: () => void;
  className?: string;
};

export const HubWorkAreaLoadError: React.FC<HubWorkAreaLoadErrorProps> = ({
  title,
  message,
  errorCode,
  retryLabel,
  dismissLabel,
  onRetry,
  onDismiss,
  className,
}) => {
  const rootClassName = className || 'flex items-center justify-center h-full px-6';
  return (
    <div className={rootClassName}>
      {/* M07 Complete MVP (2026-08-05): paleta była zahardkodowana pod DARK
          (`text-red-300`, `text-red-200/90`, `text-red-100`, `text-slate-200`,
          `border-white/20`) i nie miała wariantów light ani tokenów `c-*`.
          Zmierzone kontrasty w motywie JASNYM: tytuł 1,48:1 · treść 1,28:1 ·
          „Spróbuj ponownie" 1,01:1 · „Zamknij" 1,04:1 — przy wymaganiu WCAG AA
          4,5:1 przycisk ponowienia był praktycznie niewidoczny. Przejście na
          tokeny `c-danger`/`c-text`/`c-border`, które mają warianty dla obu
          motywów (FOUNDATION_TOKEN_CONTRACT). */}
      <div
        className="max-w-xl w-full p-5 rounded-2xl border border-c-danger/30 bg-c-danger/5"
        role="alert"
      >
        <div className="text-sm font-semibold text-c-danger">{title}</div>
        <p className="mt-1 text-sm text-c-text">{message}</p>
        {errorCode ? (
          <p className="mt-1 text-xs text-c-text-secondary font-mono">code: {errorCode}</p>
        ) : null}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="h-9 rounded-lg border border-c-danger/40 px-3 text-sm font-medium text-c-danger hover:bg-c-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {retryLabel}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="h-9 rounded-lg border border-c-border px-3 text-sm text-c-text hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
