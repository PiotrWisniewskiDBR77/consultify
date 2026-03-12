import {
  AlignCenter,
  Clipboard,
  FoldVertical,
  GitBranch,
  Grid3X3,
  Layout,
  Maximize,
  Plus,
  Redo2,
  Sparkles,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';

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
  onClose: () => void;
  onAction: (action: string) => void;
}

interface MenuItem {
  id: string;
  labelPl: string;
  labelEn: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  shortcut?: string;
  disabled?: boolean;
  dividerAfter?: boolean;
}

export const PaneContextMenu: React.FC<PaneContextMenuProps> = ({
  x,
  y,
  isPl,
  isLocked,
  canUndo,
  canRedo,
  canPaste,
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
    [onAction, onClose],
  );

  const items: MenuItem[] = [
    {
      id: 'pane_add_node',
      labelPl: 'Dodaj węzeł tutaj',
      labelEn: 'Add node here',
      icon: Plus,
      shortcut: 'N',
      disabled: isLocked,
    },
    {
      id: 'pane_add_topic',
      labelPl: 'Dodaj temat',
      labelEn: 'Add topic',
      icon: GitBranch,
      disabled: isLocked,
      dividerAfter: true,
    },
    {
      id: 'pane_paste',
      labelPl: 'Wklej',
      labelEn: 'Paste',
      icon: Clipboard,
      shortcut: '⌘V',
      disabled: isLocked || !canPaste,
    },
    {
      id: 'pane_undo',
      labelPl: 'Cofnij',
      labelEn: 'Undo',
      icon: Undo2,
      shortcut: '⌘Z',
      disabled: !canUndo,
    },
    {
      id: 'pane_redo',
      labelPl: 'Ponów',
      labelEn: 'Redo',
      icon: Redo2,
      shortcut: '⌘⇧Z',
      disabled: !canRedo,
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
      id: 'pane_collapse_all',
      labelPl: 'Zwiń wszystko',
      labelEn: 'Collapse all',
      icon: FoldVertical,
    },
    {
      id: 'pane_expand_all',
      labelPl: 'Rozwiń wszystko',
      labelEn: 'Expand all',
      icon: FoldVertical,
      dividerAfter: true,
    },
    {
      id: 'pane_auto_layout',
      labelPl: 'Automatyczny układ',
      labelEn: 'Auto layout',
      icon: Layout,
      shortcut: '⌘L',
    },
    {
      id: 'pane_fit_view',
      labelPl: 'Dopasuj widok',
      labelEn: 'Fit view',
      icon: Maximize,
      shortcut: '⌘0',
    },
    {
      id: 'pane_center_root',
      labelPl: 'Centruj na korzeniu',
      labelEn: 'Center on root',
      icon: AlignCenter,
      dividerAfter: true,
    },
    {
      id: 'pane_zoom_in',
      labelPl: 'Przybliż',
      labelEn: 'Zoom in',
      icon: ZoomIn,
      shortcut: '⌘+',
    },
    {
      id: 'pane_zoom_out',
      labelPl: 'Oddal',
      labelEn: 'Zoom out',
      icon: ZoomOut,
      shortcut: '⌘−',
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
    <div
      ref={ref}
      className="fixed z-[100] min-w-[220px] py-1 rounded-xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl border border-slate-200/60 dark:border-navy-700/60 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
      style={{ left: clampedX, top: clampedY }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <React.Fragment key={item.id}>
            <button
              type="button"
              disabled={item.disabled}
              onClick={() => handleClick(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-[7px] text-left text-[11px] font-medium transition-colors ${
                item.disabled
                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'
              }`}
            >
              <Icon
                size={13}
                className="text-slate-400 dark:text-slate-500 shrink-0"
              />
              <span className="flex-1">{isPl ? item.labelPl : item.labelEn}</span>
              {item.shortcut && (
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono ml-3">
                  {item.shortcut}
                </span>
              )}
            </button>
            {item.dividerAfter && (
              <div className="my-1 mx-2 h-px bg-slate-200/40 dark:bg-white/[0.04]" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
