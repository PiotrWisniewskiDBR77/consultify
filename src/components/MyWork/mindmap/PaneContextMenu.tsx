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
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CanvasContextMenu } from '@/components/shared/CanvasContextMenu';

import { type MenuItemBase } from './contextMenuTypes';

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

  return (
    <CanvasContextMenu
      x={x}
      y={y}
      onClose={onClose}
      ariaLabel={t('myWorkMindmap.paneMenu.ariaLabel', 'Mind map canvas actions')}
      testId="mindmap-pane-context-menu"
      items={items.map((item) => {
        const Icon = item.icon;
        return {
          id: item.id,
          label: t(`myWorkMindmap.paneMenu.${item.id}`, item.labelEn),
          icon: <Icon size={14} />,
          shortcut: item.shortcut,
          disabled: item.disabled,
          disabledReason: item.disabled
            ? t('myWorkMindmap.paneMenu.disabledReason', 'Unavailable in the current selection')
            : undefined,
          separatorAfter: item.dividerAfter,
          onSelect: () => onAction(item.id),
        };
      })}
    />
  );
};
