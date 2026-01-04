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

