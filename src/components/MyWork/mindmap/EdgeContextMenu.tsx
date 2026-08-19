import { ArrowLeftRight, ArrowRight, Edit3, Paintbrush, Plus, Trash2, Type } from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { CanvasContextMenu } from '@/components/shared/CanvasContextMenu';

import { type MenuItemBase } from './contextMenuTypes';

export interface EdgeContextMenuProps {
  x: number;
  y: number;
  edgeId: string;
  isPl: boolean;
  isLocked: boolean;
  isUserCreated: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
}

// Strzałka kierunku (2026-07-28). Pozycja NIE idzie przez `onAction` tylko
// dyspozycją `idea-workspace-quick-action` → `mm_edge_arrow`, bo logika cyklu
// (none → end → both → start) potrzebuje dostępu do samej krawędzi; obsługuje
// ją `mindmap/useMindMapQuickActions.ts`, tak jak resztę akcji `mm_*`.
// Wzorzec cyklu 1:1 z sąsiednim „Zmień styl linii" (jeden klik = następny stan,
// bieżący stan raportuje toast) — świadomie NIE dokładamy tu nowego typu
// kontrolki, żeby menu krawędzi zostało jednorodną listą pozycji.
const EDGE_ARROW_ACTION = 'edge_arrow_direction';

export const EdgeContextMenu: React.FC<EdgeContextMenuProps> = ({
  x,
  y,
  edgeId,
  isPl: _isPl,
  isLocked,
  isUserCreated,
  onClose,
  onAction,
}) => {
  const { t } = useTranslation();

  const handleClick = useCallback(
    (action: string) => {
      if (action === EDGE_ARROW_ACTION) {
        window.dispatchEvent(
          new CustomEvent('idea-workspace-quick-action', {
            detail: { action: 'mm_edge_arrow', edgeId },
          })
        );
        return;
      }
      onAction(action);
    },
    [edgeId, onAction]
  );

  const items: MenuItemBase[] = [
    {
      id: 'edge_add_label',
      labelEn: 'Add / edit label',
      icon: Type,
      disabled: isLocked,
    },
    {
      id: 'edge_insert_node',
      labelEn: 'Insert node on edge',
      icon: Plus,
      disabled: isLocked,
    },
    {
      id: 'edge_reverse',
      labelEn: 'Reverse direction',
      icon: ArrowLeftRight,
      disabled: isLocked,
    },
    {
      id: EDGE_ARROW_ACTION,
      labelEn: 'Arrow direction',
      icon: ArrowRight,
      disabled: isLocked,
    },
    {
      id: 'edge_change_style',
      labelEn: 'Change line style',
      icon: Paintbrush,
      disabled: isLocked,
    },
    {
      id: 'edge_edit_relation',
      labelEn: 'Edit relation',
      icon: Edit3,
      disabled: isLocked,
      dividerAfter: true,
    },
    {
      id: 'edge_delete',
      labelEn: 'Delete connection',
      icon: Trash2,
      danger: true,
      disabled: isLocked || !isUserCreated,
    },
  ];

  return (
    <CanvasContextMenu
      x={x}
      y={y}
      onClose={onClose}
      ariaLabel={t('myWorkMindmap.edgeMenu.ariaLabel', 'Mind map connection actions')}
      testId="mindmap-edge-context-menu"
      items={items.map((item) => {
        const Icon = item.icon;
        return {
          id: item.id,
          label: t(`myWorkMindmap.edgeMenu.${item.id}`, item.labelEn),
          icon: <Icon size={14} />,
          disabled: item.disabled,
          disabledReason: item.disabled
            ? t('myWorkMindmap.edgeMenu.disabledReason', 'Connection cannot be changed')
            : undefined,
          danger: item.danger,
          separatorAfter: item.dividerAfter,
          onSelect: () => handleClick(item.id),
        };
      })}
    />
  );
};
