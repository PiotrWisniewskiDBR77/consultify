import { X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { PREVIEW_FOOTER_MAX_HEIGHT } from '@/components/shared/PreviewPane/previewGeometry';

export interface PreviewPaneShellProps {
  /**
   * @deprecated KANON v3: header preview nie pokazuje kickera ("Preview/Podgląd").
   * Jeśli potrzebujesz meta/etykiety — renderuj ją w body jako "Brief/Meta card".
   */
  kicker?: string;
  title: string;
  onClose?: () => void;
  closeLabel?: string;
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
  closeLabel,
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
        <div
          data-preview-block="header"
          className="sticky top-0 z-10 shrink-0 flex flex-col gap-2 px-4 py-3 min-h-[64px] border-b border-slate-200/70 dark:border-white/[0.06] bg-white/80 dark:bg-navy-900/80 backdrop-blur"
        >
          {/*
            NAPRAWA (audyt MVP 06.09, evidence/audyt-mvp-20260906/A3/
            RAPORT_A3.md, WAŻNY #3): tytuł i pas akcji (zakładki Rekord/Teresa
            + „Otwórz" + X w `JedenPrawyPanel.tsx`) dzieliły JEDEN wiersz —
            dla "Supply Chain Optimization" zostawiało to tytułowi ~5 znaków
            szerokości, więc nawet `line-clamp-2` renderował się jako
            "Suppl/y…". Nagłówek jest teraz DWUWIERSZOWY: wiersz 1 = tytuł
            (pełna szerokość, `line-clamp-2`, natywny `title` na hover) + X;
            wiersz 2 = `actions` (zakładki/„Otwórz"), wyrównane do prawej —
            tytuł dostaje całą szerokość panelu zamiast dzielić ją z resztą.
          */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex items-start gap-2">
              <div
                className="text-base font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 break-words"
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
            {onClose ? (
              <button
                onClick={onClose}
                className="inline-flex shrink-0 items-center justify-center h-9 w-9 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
                aria-label={closeLabel ?? t('common.close', 'Close')}
                title={closeLabel ?? t('common.close', 'Close')}
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
          {actions ? (
            <div className="flex items-center justify-end gap-1.5">{actions}</div>
          ) : null}
        </div>
      ) : null}

      <div
        className={[embedded ? 'flex-1' : 'flex-1 overflow-y-auto p-4', bodyClassName].join(' ')}
        // axe `scrollable-region-focusable`: a scrollable container needs to
        // be reachable by keyboard even when its content happens to hold no
        // focusable elements of its own (e.g. a text-only report summary).
        // `embedded` mode has no overflow here (parent owns scrolling), so
        // it's excluded — this is the shared shell behind every StandardPreview
        // pane in the app, so this one tabIndex fixes the rule everywhere it
        // was scrollable-but-unreachable, not just this screen.
        tabIndex={embedded ? undefined : 0}
      >
        {children}
      </div>

      {footer && embedded ? (
        <div className="mt-4 shrink-0 border-t border-slate-200/70 pt-4 dark:border-white/[0.06]">
          {footer}
        </div>
      ) : null}

      {/*
        SUFIT STOPKI (2026-09-05) — patrz `previewGeometry.PREVIEW_FOOTER_MAX_HEIGHT`.
        `shrink-0` bez sufitu oddawał stopce tyle pionu, ile chciała (zmierzone:
        500 z 728 px panelu Pomysłów), a `flex-1` treści zostawiał 138 px — blok
        „Szczegóły" wychodził ucięty na nagłówku tabeli właściwości. Sufit liczy
        się z kanonu (`CANON_PREVIEW_BLOCK_HEIGHT.detailsMin`), więc stopki, które
        się mieszczą, renderują się bez żadnej zmiany.
      */}
      {footer && !embedded ? (
        <div
          data-preview-block="footer"
          className="app-table-scrollbar shrink-0 overflow-y-auto border-t border-slate-200/70 dark:border-white/[0.06] p-4"
          style={{ maxHeight: PREVIEW_FOOTER_MAX_HEIGHT }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
};

export default PreviewPaneShell;
