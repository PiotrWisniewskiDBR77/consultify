import type React from 'react';

export interface MenuItemBase {
  id: string;
  labelPl: string;
  labelEn: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  dividerAfter?: boolean;
}

export const MENU_CONTAINER_CLASS =
  'fixed z-[100] min-w-[220px] py-1 rounded-xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl border border-slate-200/60 dark:border-navy-700/60 shadow-2xl animate-in fade-in zoom-in-95 duration-100';

export const menuItemClass = (item: Pick<MenuItemBase, 'disabled' | 'danger'>) => {
  if (item.disabled) return 'text-slate-600 dark:text-slate-400 cursor-not-allowed';
  if (item.danger) return 'text-danger-600 dark:text-danger-400 hover:bg-danger-500/10';
  return 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-white/[0.04]';
};
