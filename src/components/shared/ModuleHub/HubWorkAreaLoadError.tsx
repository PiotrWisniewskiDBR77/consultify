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
      <div
        className="max-w-xl w-full p-5 rounded-2xl border border-red-500/20 bg-red-900/10"
        role="alert"
      >
        <div className="text-sm font-semibold text-red-300">{title}</div>
        <p className="mt-1 text-sm text-red-200/90">{message}</p>
        {errorCode ? (
          <p className="mt-1 text-xs text-red-200/70 font-mono">code: {errorCode}</p>
        ) : null}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="h-9 rounded-lg border border-red-400/40 px-3 text-sm text-red-100 hover:bg-red-500/20"
          >
            {retryLabel}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="h-9 rounded-lg border border-c-border px-3 text-sm text-slate-200 hover:bg-white/10"
          >
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
