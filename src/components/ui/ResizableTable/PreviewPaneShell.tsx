import { X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface PreviewPaneShellProps {
  /**
   * @deprecated KANON v3: header preview nie pokazuje kickera ("Preview/Podgląd").
   * Jeśli potrzebujesz meta/etykiety — renderuj ją w body jako "Brief/Meta card".
   */
  kicker?: string;
  title: string;
  onClose?: () => void;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Unread changes count — displayed as a badge next to the title */
  unreadCount?: number;
  /** Render only the preview body when a parent layout already owns header and footer chrome. */
  embedded?: boolean;
}

export const PreviewPaneShell: React.FC<PreviewPaneShellProps> = ({
  title,
  onClose,
  actions,
  footer,
  children,
  className = '',
  bodyClassName = '',
  unreadCount,
  embedded = false,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={[
        'h-full flex flex-col overflow-hidden',
        embedded ? '' : 'rounded-xl border border-slate-200/70 dark:border-white/[0.06]',
        embedded ? '' : 'bg-white/70 dark:bg-navy-900/70',
        embedded ? '' : 'backdrop-blur',
        className,
      ].join(' ')}
    >
      {/* Panel Header (KANON v3 / Golden Standard §6.10a) — sticky top-0 z-10 per canon §7.3 */}
      {!embedded ? (
        <div className="sticky top-0 z-10 shrink-0 flex items-center justify-between gap-3 px-4 py-3 min-h-[64px] border-b border-slate-200/70 dark:border-white/[0.06] bg-white/80 dark:bg-navy-900/80 backdrop-blur">
          <div className="min-w-0 flex items-center gap-2">
            <div
              className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate"
              title={title}
            >
              {title}
            </div>
            {unreadCount && unreadCount > 0 ? (
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold leading-none bg-danger-500 text-white shrink-0">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {actions}
            {onClose ? (
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center h-9 w-9 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
                aria-label={t('common.close', 'Close')}
                title={t('common.close', 'Close')}
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={[embedded ? 'flex-1' : 'flex-1 overflow-y-auto p-4', bodyClassName].join(' ')}
      >
        {children}
      </div>

      {footer && embedded ? (
        <div className="mt-4 shrink-0 border-t border-slate-200/70 pt-4 dark:border-white/[0.06]">
          {footer}
        </div>
      ) : null}

      {footer && !embedded ? (
        <div className="shrink-0 border-t border-slate-200/70 dark:border-white/[0.06] p-4">
          {footer}
        </div>
      ) : null}
    </div>
  );
};

export default PreviewPaneShell;
