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
import { useTranslation } from 'react-i18next';

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
  isPl: _isPl,
  isLocked,
  canUndo,
  canRedo,
  canPaste,
  hasSelection,
  onClose,
  onAction,
}) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Faza przechwytywania — obowiązkowa: d3-zoom pod ReactFlow woła
    // `stopImmediatePropagation()` na `mousedown` w `.react-flow__pane`, więc
    // zwykły listener na `window` nigdy się nie odpali (patrz NodeContextMenu).
    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true);
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
      labelEn: 'Add topic (to root)',
      icon: Plus,
      shortcut: 'N',
      disabled: isLocked,
    },
    {
      id: 'pane_copy',
      labelEn: 'Copy nodes',
      icon: ClipboardCopy,
      shortcut: '⌘C',
      disabled: !hasSelection,
    },
    {
      id: 'pane_cut',
      labelEn: 'Cut nodes',
      icon: Scissors,
      shortcut: '⌘X',
      disabled: isLocked || !hasSelection,
    },
    {
      id: 'pane_paste',
      labelEn: 'Paste nodes',
      icon: Clipboard,
      shortcut: '⌘V',
      disabled: isLocked || !canPaste,
      dividerAfter: true,
    },
    {
      id: 'pane_select_all',
      labelEn: 'Select all',
      icon: Grid3X3,
      shortcut: '⌘A',
    },
    {
      id: 'pane_fit_view',
      labelEn: 'Fit view',
      icon: Maximize,
      shortcut: '⌘0',
    },
    {
      id: 'pane_auto_layout',
      labelEn: 'Auto layout',
      icon: Layout,
      shortcut: '⌘L',
    },
    {
      id: 'pane_auto_cluster',
      labelEn: 'Auto-cluster',
      icon: Layers,
      shortcut: '',
      disabled: isLocked,
      dividerAfter: true,
    },
    {
      id: 'pane_collapse_all',
      labelEn: 'Collapse all',
      icon: ChevronDown,
      shortcut: 'Alt+0',
    },
    {
      id: 'pane_fold_1',
      labelEn: 'Show level 1',
      icon: ChevronDown,
      shortcut: 'Alt+1',
    },
    {
      id: 'pane_fold_2',
      labelEn: 'Show level 2',
      icon: ChevronDown,
      shortcut: 'Alt+2',
    },
    {
      id: 'pane_expand_all',
      labelEn: 'Expand all',
      icon: ChevronDown,
      shortcut: 'Alt+9',
      dividerAfter: true,
    },
    {
      id: 'pane_ai_suggest',
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
                <span className="flex-1">
                  {t(`myWorkMindmap.paneMenu.${item.id}`, item.labelEn)}
                </span>
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
