import { X } from 'lucide-react';
import React from 'react';

export interface PreviewPaneShellProps {
  kicker?: string;
  title: string;
  onClose?: () => void;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export const PreviewPaneShell: React.FC<PreviewPaneShellProps> = ({
  kicker,
  title,
  onClose,
  actions,
  footer,
  children,
  className = '',
  bodyClassName = '',
}) => {
  return (
    <div
      className={[
        'h-full flex flex-col overflow-hidden',
        'rounded-xl border border-slate-200 dark:border-navy-700',
        'bg-white/70 dark:bg-navy-900/70',
        'backdrop-blur',
        className,
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-200/70 dark:border-navy-700/70 bg-white/60 dark:bg-navy-900/60 backdrop-blur">
        <div className="min-w-0">
          {kicker ? (
            <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {kicker}
            </div>
          ) : null}
          <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{title}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {actions}
          {onClose ? (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-navy-800/60 transition-colors"
              aria-label="Close preview"
              title="Close"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      </div>

      <div className={['flex-1 overflow-y-auto p-4', bodyClassName].join(' ')}>{children}</div>

      {footer ? (
        <div className="shrink-0 border-t border-slate-200/70 dark:border-navy-700/70 p-4 bg-white/40 dark:bg-navy-900/40">
          {footer}
        </div>
      ) : null}
    </div>
  );
};

export default PreviewPaneShell;

