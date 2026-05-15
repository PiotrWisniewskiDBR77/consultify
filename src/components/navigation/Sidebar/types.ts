/**
 * Sidebar Types - Apple HIG Design System
 */

import { AppView } from '../../../types';

export interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  viewId?: AppView;
  subItems?: MenuItem[];
  requiresView?: AppView;
  isFloating?: boolean;
  badge?: 'beta' | 'new' | 'soon'; // Optional badge for items in development
  isLocked?: boolean;
  lockedMessage?: string;
  lockedCtaHref?: string;
}

export interface FloatingMenuPosition {
  top: number;
  left: number;
}

export interface ActiveFloatingState {
  id: string;
  rect: DOMRect;
  items: MenuItem[];
  title: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';
