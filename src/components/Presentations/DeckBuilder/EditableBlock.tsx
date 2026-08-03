/**
 * EditableBlock — wraps any block with selection, hover state, and floating toolbar.
 * Uses TipTap for rich-text inline editing on text-based blocks.
 */

import { ChevronDown, ChevronUp, Copy, GripVertical, Image, RefreshCw, Trash2 } from 'lucide-react';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import type { CardBlock } from '../wizard/types';
import { TipTapEditor } from './TipTapEditor';

interface EditableBlockProps {
  block: CardBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<CardBlock>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRefresh?: () => void;
  /** Fala 1 — przenieś blok w obrębie tego samego regionu (patrz `blockOps.ts`). */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  children: React.ReactNode;
}

/**
 * U1 fix (2026-07-28, odbiór nadzorcy) — the toolbar used to be a plain
 * `absolute -top-8` anchor. That silently assumed there is always ≥32px of
 * clear space directly above the block, which is false right where it
 * matters most: the FIRST block of a card only has the card's own padding
 * above it (tight, no margin for error on a wrapped 2-line title), and
 * flipping it to "always below" just moves the same problem onto the NEXT
 * sibling block instead (verified live — both break with a fixed CSS
 * anchor). The only anchor-free fix is what Notion/Figma actually do:
 * MEASURE the block, MEASURE the available space, and render the toolbar in
 * a portal at a `position: fixed` pixel coordinate that is guaranteed clear
 * of the block's own box — flipping above/below based on real viewport
 * room, not a guess baked into a class name.
 */
const TOOLBAR_HEIGHT_PX = 32; // approx rendered height incl. border; used for the flip decision only
const TOOLBAR_GAP_PX = 6;
const VIEWPORT_TOP_SAFE_PX = 8; // never place the toolbar's top edge above this

function useFloatingToolbarPosition(
  anchorRef: React.RefObject<HTMLElement | null>,
  isSelected: boolean
): { top: number; left: number } | null {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!isSelected) {
      setPos(null);
      return;
    }
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const spaceAbove = rect.top;
      const fitsAbove = spaceAbove - TOOLBAR_HEIGHT_PX - TOOLBAR_GAP_PX >= VIEWPORT_TOP_SAFE_PX;
      const top = fitsAbove
        ? rect.top - TOOLBAR_GAP_PX - TOOLBAR_HEIGHT_PX
        : rect.bottom + TOOLBAR_GAP_PX;
      setPos({ top, left: rect.left });
    };
    update();
    // `scroll` doesn't bubble, but capture-phase listeners on window still see
    // it fire on any descendant scrollable ancestor (the CardCanvas list).
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelected, anchorRef]);

  return pos;
}

const TEXT_BLOCK_TYPES = ['heading', 'paragraph', 'bullet_list', 'numbered_list'];

export const EditableBlock: React.FC<EditableBlockProps> = ({
  block,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onRefresh,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  children,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const isTextBlock = TEXT_BLOCK_TYPES.includes(block.type);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const toolbarPos = useFloatingToolbarPosition(wrapperRef, isSelected);

  const handleDoubleClick = useCallback(() => {
    if (isTextBlock) {
      setIsEditing(true);
    }
  }, [isTextBlock]);

  const handleContentChange = useCallback(
    (html: string) => {
      const plainText = html.replace(/<[^>]+>/g, '').trim();
      if (block.type === 'heading' || block.type === 'paragraph') {
        onUpdate({ content: { ...block.content, text: plainText, html } });
      } else if (block.type === 'bullet_list' || block.type === 'numbered_list') {
        const items = html
          .split(/<li[^>]*>/g)
          .slice(1)
          .map((li) =>
            li
              .replace(/<\/li>.*$/s, '')
              .replace(/<[^>]+>/g, '')
              .trim()
          )
          .filter(Boolean);
        if (items.length > 0) {
          onUpdate({ content: { ...block.content, items } });
        }
      }
    },
    [block, onUpdate]
  );

  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  const getEditorContent = (): string => {
    if (block.content.html) return block.content.html as string;
    if (block.type === 'heading' || block.type === 'paragraph') {
      return (block.content.text as string) || '';
    }
    if (block.type === 'bullet_list' || block.type === 'numbered_list') {
      const items = (block.content.items as string[]) || [];
      const tag = block.type === 'numbered_list' ? 'ol' : 'ul';
      return `<${tag}>${items.map((i) => `<li>${i}</li>`).join('')}</${tag}>`;
    }
    return '';
  };

  const toolbar =
    isSelected && toolbarPos
      ? createPortal(
          <div
            style={{ position: 'fixed', top: toolbarPos.top, left: toolbarPos.left, zIndex: 9999 }}
            className="flex items-center gap-1 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg shadow-lg px-1 py-0.5"
          >
            <button
              className="p-1 text-c-text-secondary cursor-grab hover:text-c-text-secondary"
              title={t('presentations.builder.block.drag', 'Drag to reorder')}
            >
              <GripVertical size={12} />
            </button>
            {(onMoveUp || onMoveDown) && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveUp?.();
                  }}
                  disabled={!canMoveUp}
                  className="p-1 text-c-text-secondary hover:text-c-text-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                  title={t('presentations.builder.block.moveUp', 'Move up')}
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveDown?.();
                  }}
                  disabled={!canMoveDown}
                  className="p-1 text-c-text-secondary hover:text-c-text-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                  title={t('presentations.builder.block.moveDown', 'Move down')}
                >
                  <ChevronDown size={12} />
                </button>
              </>
            )}
            {block.is_refreshable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRefresh?.();
                }}
                className="p-1 text-blue-400 hover:text-blue-600"
                title={t('presentations.builder.block.refresh', 'Refresh from source')}
              >
                <RefreshCw size={12} />
              </button>
            )}
            {block.type === 'image' && (
              <button
                className="p-1 text-c-text-secondary hover:text-c-text-secondary"
                title={t('presentations.builder.block.replaceImage', 'Replace image')}
              >
                <Image size={12} />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              className="p-1 text-c-text-secondary hover:text-c-text-secondary"
              title={t('presentations.builder.block.duplicate', 'Duplicate block')}
            >
              <Copy size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              // U2 (odbiór nadzorcy) — usuwanie jest akcją destrukcyjną, więc
              // czerwień jest tu uprawniona (CLAUDE.md §UI.3), ale MUSI iść z
              // tokenu semantyki krytycznej `danger-*` (skala oddzielna od
              // `primary` = crimson), nie z `primary-*`. Ten sam token co
              // istniejący przycisk usuwania w `SlideSorter.tsx`.
              className="p-1 text-danger-400 hover:text-danger-600"
              title={t('presentations.builder.block.delete', 'Delete block')}
            >
              <Trash2 size={12} />
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={wrapperRef}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={handleDoubleClick}
      className={`relative group rounded-lg transition-all ${
        isSelected ? 'ring-2 ring-c-focus bg-c-accent-soft0' : 'hover:ring-1 hover:ring-c-border'
      }`}
    >
      {toolbar}

      {isEditing && isTextBlock ? (
        <div className="p-1">
          <TipTapEditor
            content={getEditorContent()}
            onChange={handleContentChange}
            onBlur={handleBlur}
            isHeading={block.type === 'heading'}
            headingLevel={(block.content.level as 1 | 2 | 3 | 4) || 2}
            className={block.type === 'heading' ? 'text-2xl font-bold' : 'text-sm'}
            placeholder={t('presentations.builder.block.startTyping', 'Start typing...')}
          />
        </div>
      ) : (
        children
      )}
    </div>
  );
};
