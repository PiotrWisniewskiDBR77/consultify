import { ArrowLeftRight, Edit3, Paintbrush, Plus, Trash2, Type } from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';

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

export const EdgeContextMenu: React.FC<EdgeContextMenuProps> = ({
  x,
  y,
  isPl,
  isLocked,
  isUserCreated,
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
      id: 'edge_add_label',
      labelPl: 'Dodaj / edytuj etykietę',
      labelEn: 'Add / edit label',
      icon: Type,
      disabled: isLocked,
    },
    {
      id: 'edge_insert_node',
      labelPl: 'Wstaw węzeł na połączeniu',
      labelEn: 'Insert node on edge',
      icon: Plus,
      disabled: isLocked,
    },
    {
      id: 'edge_reverse',
      labelPl: 'Odwróć kierunek',
      labelEn: 'Reverse direction',
      icon: ArrowLeftRight,
      disabled: isLocked,
    },
    {
      id: 'edge_change_style',
      labelPl: 'Zmień styl linii',
      labelEn: 'Change line style',
      icon: Paintbrush,
      disabled: isLocked,
    },
    {
      id: 'edge_edit_relation',
      labelPl: 'Edytuj relację',
      labelEn: 'Edit relation',
      icon: Edit3,
      disabled: isLocked,
      dividerAfter: true,
    },
    {
      id: 'edge_delete',
      labelPl: 'Usuń połączenie',
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
                <span className="flex-1">{isPl ? item.labelPl : item.labelEn}</span>
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
