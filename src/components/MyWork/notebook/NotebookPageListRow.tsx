import { Archive, FileText, MoreVertical, Pin, Play } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import type { NotebookPage } from '@/types/myWork';

import { ConvertToOutputMenu } from '../ConvertToOutputMenu';

export interface NotebookPageListRowProps {
  page: NotebookPage;
  isActive: boolean;
  /** Pre-computed relative time label (e.g. "3h", "2d") — empty string if unknown. */
  timeAgo: string;
  onSelect: () => void;
  onTogglePin: () => void;
  onStartWorking: () => void;
  onArchive: () => void;
  onConvertComplete: (outputType: string, outputId: string) => void;
}

/**
 * ODMROZENIE 07_MY_WORK_AGENT DEC-397 (zlecenie 1.1-J) — single-line
 * notebook list row.
 *
 * Owner (06.09, przejście "Moja Praca → Notatnik"): "trzeba tu zrobić
 * porządek: wszystkie tytuły notatek w jednej linii, bez opisów pod spodem,
 * i pionowy kebab — wtedy będziemy mieli porządek."
 *
 * Everything that used to render as a second/third line under the title —
 * summary text, the maturity chip, verified/stale badges, the upload-source
 * badge, the converted-output checkmark badge, the orphan "Unlinked" badge,
 * the reminder chip, and tags — is gone from the row. None of it is lost:
 * it stays visible in the note's own detail surface (right rail / header),
 * just not duplicated here.
 *
 * The four icon-buttons that used to appear top-right ONLY on hover (Start
 * working / Convert to output / Pin / Archive) collapse into the single
 * vertical kebab (⋮, `aria-label="Więcej"`, canon TRIADA: pionowy, nie
 * poziomy) — no action added, exactly the four that existed before.
 *
 * Row height is fixed (~36–40px, `h-9`) regardless of content — no per-row
 * growth from a pinned icon or a long title (ellipsis + `title` attribute
 * carries the full text instead).
 */
export const NotebookPageListRow: React.FC<NotebookPageListRowProps> = ({
  page,
  isActive,
  timeAgo,
  onSelect,
  onTogglePin,
  onStartWorking,
  onArchive,
  onConvertComplete,
}) => {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const kebabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [menuOpen]);

  const title = page.title || t('notebook.notebookContent.label40', 'Untitled');
  const canStartWorking = page.status === 'inbox';
  const canArchive = page.status !== 'archived';
  const hasEmojiIcon = !!page.icon && /\p{Emoji}/u.test(page.icon);

  const openMenu = () => {
    const rect = kebabRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ x: Math.max(8, rect.right - 220), y: rect.bottom + 4 });
    setMenuOpen(true);
  };

  return (
    <div
      data-testid="notebook-page-row"
      className={`group relative flex h-9 items-center gap-1.5 rounded-xl px-2 transition-colors duration-200 ${
        isActive
          ? 'bg-c-surface-raised border border-c-border-subtle shadow-sm'
          : 'hover:bg-c-surface-raised border border-transparent'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        {hasEmojiIcon ? (
          <span className="shrink-0 text-sm leading-none">{page.icon}</span>
        ) : (
          <FileText size={14} className="shrink-0 text-c-text-muted" />
        )}
        {page.pinned && (
          <Pin
            size={10}
            className="shrink-0 text-amber-500"
            aria-hidden="true"
            data-testid="notebook-row-pin-indicator"
          />
        )}
        <span title={title} className="min-w-0 flex-1 truncate text-[13px] font-semibold text-c-text">
          {title}
        </span>
        {timeAgo && (
          <span className="shrink-0 text-[10px] tabular-nums text-c-text-muted">{timeAgo}</span>
        )}
      </button>

      <button
        ref={kebabRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (menuOpen) {
            setMenuOpen(false);
          } else {
            openMenu();
          }
        }}
        aria-label={t('notebook.notebookContent.rowMenuAriaLabel', 'More')}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="shrink-0 rounded-lg p-1 text-c-text-muted transition-colors hover:bg-c-surface hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        <MoreVertical size={16} />
      </button>

      {menuOpen &&
        menuPos &&
        createPortal(
          <>
            {/* Full-screen invisible click-catcher — same idiom as
                ConvertToOutputMenu's own dropdown (z-dropdown below the
                menu box at z-overlay) so a nested Convert-to-output submenu
                painted later in the DOM sits on top and keeps receiving its
                own clicks instead of this row's menu swallowing them. */}
            <div
              className="fixed inset-0 z-dropdown"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              role="menu"
              aria-label={t('notebook.notebookContent.rowMenuAriaLabel', 'More')}
              className="fixed z-overlay min-w-[210px] rounded-lg border border-c-border-subtle bg-c-surface py-1 shadow-xl"
              style={{ top: menuPos.y, left: menuPos.x }}
            >
              {canStartWorking && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onStartWorking();
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-c-text-secondary transition-colors hover:bg-c-surface-raised"
                >
                  <Play size={14} className="shrink-0 text-c-text-muted" />
                  {t('notebook.notebookContent.title4', 'Start working')}
                </button>
              )}

              <div className="px-1 py-0.5">
                <ConvertToOutputMenu
                  sourceType="notebook"
                  sourceId={page.id}
                  sourceTitle={page.title || ''}
                  onConvertComplete={(outputType, outputId) => {
                    setMenuOpen(false);
                    onConvertComplete(outputType, outputId);
                  }}
                  variant="dropdown"
                  className="w-full"
                />
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onTogglePin();
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-c-text-secondary transition-colors hover:bg-c-surface-raised"
              >
                <Pin
                  size={14}
                  className={`shrink-0 ${page.pinned ? 'text-amber-500' : 'text-c-text-muted'}`}
                />
                {page.pinned
                  ? t('notebook.notebookContent.unpinAction', 'Unpin')
                  : t('notebook.notebookContent.title5', 'Pin')}
              </button>

              {canArchive && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onArchive();
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-c-text-secondary transition-colors hover:bg-c-surface-raised"
                >
                  <Archive size={14} className="shrink-0 text-c-text-muted" />
                  {t('notebook.notebookContent.title6', 'Archive')}
                </button>
              )}
            </div>
          </>,
          document.body
        )}
    </div>
  );
};

export default NotebookPageListRow;
