import type React from 'react';

export interface MenuItemBase {
  id: string;
  labelPl?: string;
  labelEn: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  dividerAfter?: boolean;
}

export const MENU_CONTAINER_CLASS =
  'fixed z-[100] min-w-[220px] py-1 rounded-xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl border border-c-border-subtle dark:border-c-border-subtle shadow-2xl animate-in fade-in zoom-in-95 duration-100';

export const menuItemClass = (item: Pick<MenuItemBase, 'disabled' | 'danger'>) => {
  if (item.disabled) return 'text-c-text-secondary dark:text-c-text-muted cursor-not-allowed';
  if (item.danger) return 'text-c-danger dark:text-c-danger hover:bg-c-danger';
  return 'text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised';
};
