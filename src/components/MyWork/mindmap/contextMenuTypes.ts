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
