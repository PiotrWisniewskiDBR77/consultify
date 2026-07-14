import {
  ChevronDown,
  Clipboard,
  ClipboardCopy,
  Grid3X3,
  Layers,
  Layout,
  Maximize,
  Plus,
  Scissors,
  Sparkles,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';

import { ContextMenuPortal } from './ContextMenuPortal';
import { MENU_CONTAINER_CLASS, type MenuItemBase, menuItemClass } from './contextMenuTypes';

export interface PaneContextMenuProps {
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  isPl: boolean;
  isLocked: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  hasSelection: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
}

export const PaneContextMenu: React.FC<PaneContextMenuProps> = ({
  x,
  y,
  isPl,
  isLocked,
  canUndo,
  canRedo,
  canPaste,
  hasSelection,
  onClose,
  onAction,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleClick = useCallback(
    (action: string) => {
      onAction(action);
      onClose();
    },
    [onAction, onClose]
  );

  const items: MenuItemBase[] = [
    {
      id: 'pane_add_node',
      labelPl: 'Dodaj temat (do korzenia)',
      labelEn: 'Add topic (to root)',
      icon: Plus,
      shortcut: 'N',
      disabled: isLocked,
    },
    {
      id: 'pane_copy',
      labelPl: 'Kopiuj węzły',
      labelEn: 'Copy nodes',
      icon: ClipboardCopy,
      shortcut: '⌘C',
      disabled: !hasSelection,
    },
    {
      id: 'pane_cut',
      labelPl: 'Wytnij węzły',
      labelEn: 'Cut nodes',
      icon: Scissors,
      shortcut: '⌘X',
      disabled: isLocked || !hasSelection,
    },
    {
      id: 'pane_paste',
      labelPl: 'Wklej węzły',
      labelEn: 'Paste nodes',
      icon: Clipboard,
      shortcut: '⌘V',
      disabled: isLocked || !canPaste,
      dividerAfter: true,
    },
    {
      id: 'pane_select_all',
      labelPl: 'Zaznacz wszystko',
      labelEn: 'Select all',
      icon: Grid3X3,
      shortcut: '⌘A',
    },
    {
      id: 'pane_fit_view',
      labelPl: 'Dopasuj widok',
      labelEn: 'Fit view',
      icon: Maximize,
      shortcut: '⌘0',
    },
    {
      id: 'pane_auto_layout',
      labelPl: 'Automatyczny układ',
      labelEn: 'Auto layout',
      icon: Layout,
      shortcut: '⌘L',
    },
    {
      id: 'pane_auto_cluster',
      labelPl: 'Auto-grupowanie',
      labelEn: 'Auto-cluster',
      icon: Layers,
      shortcut: '',
      disabled: isLocked,
      dividerAfter: true,
    },
    {
      id: 'pane_collapse_all',
      labelPl: 'Zwiń wszystko',
      labelEn: 'Collapse all',
      icon: ChevronDown,
      shortcut: 'Alt+0',
    },
    {
      id: 'pane_fold_1',
      labelPl: 'Pokaż poziom 1',
      labelEn: 'Show level 1',
      icon: ChevronDown,
      shortcut: 'Alt+1',
    },
    {
      id: 'pane_fold_2',
      labelPl: 'Pokaż poziom 2',
      labelEn: 'Show level 2',
      icon: ChevronDown,
      shortcut: 'Alt+2',
    },
    {
      id: 'pane_expand_all',
      labelPl: 'Rozwiń wszystko',
      labelEn: 'Expand all',
      icon: ChevronDown,
      shortcut: 'Alt+9',
      dividerAfter: true,
    },
    {
      id: 'pane_ai_suggest',
      labelPl: 'AI: Zasugeruj węzły',
      labelEn: 'AI: Suggest nodes',
      icon: Sparkles,
      disabled: isLocked,
    },
  ];

  const clampedX = Math.min(x, window.innerWidth - 240);
  const clampedY = Math.min(y, window.innerHeight - items.length * 34 - 20);

  return (
    <ContextMenuPortal>
      <div ref={ref} className={MENU_CONTAINER_CLASS} style={{ left: clampedX, top: clampedY }}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <React.Fragment key={item.id}>
              <button
                type="button"
                disabled={item.disabled}
                onClick={() => handleClick(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-[7px] text-left text-[11px] font-medium transition-colors ${menuItemClass(item)}`}
              >
                <Icon
                  size={13}
                  className="text-c-text-secondary dark:text-c-text-secondary shrink-0"
                />
                <span className="flex-1">{isPl ? item.labelPl : item.labelEn}</span>
                {item.shortcut && (
                  <span className="text-[9px] text-c-text-secondary dark:text-c-text-secondary font-mono ml-3">
                    {item.shortcut}
                  </span>
                )}
              </button>
              {item.dividerAfter && (
                <div className="my-1 mx-2 h-px bg-c-surface-raised dark:bg-c-surface-raised" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </ContextMenuPortal>
  );
};
