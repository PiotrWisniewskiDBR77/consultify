import { ArrowLeftRight, ArrowRight, Edit3, Paintbrush, Plus, Trash2, Type } from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ContextMenuPortal } from './ContextMenuPortal';
import { MENU_CONTAINER_CLASS, type MenuItemBase, menuItemClass } from './contextMenuTypes';

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
      if (action === EDGE_ARROW_ACTION) {
        window.dispatchEvent(
          new CustomEvent('idea-workspace-quick-action', {
            detail: { action: 'mm_edge_arrow', edgeId },
          })
        );
        onClose();
        return;
      }
      onAction(action);
      onClose();
    },
    [edgeId, onAction, onClose]
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

  const clampedX = Math.min(x, window.innerWidth - 250);
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
                className={`w-full flex items-center gap-2.5 px-3 py-[7px] text-left text-[11px] font-medium transition-colors rounded-md ${menuItemClass(item)}`}
              >
                <Icon
                  size={13}
                  className={`shrink-0 ${item.danger ? 'text-c-danger' : 'text-c-text-secondary dark:text-c-text-secondary'}`}
                />
                <span className="flex-1">
                  {t(`myWorkMindmap.edgeMenu.${item.id}`, item.labelEn)}
                </span>
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
