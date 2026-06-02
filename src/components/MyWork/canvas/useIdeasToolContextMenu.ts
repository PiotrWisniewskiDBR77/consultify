/**
 * Shared context menu infrastructure for Ideas workspace tools.
 * Provides consistent positioning, visibility, and common actions
 * across Mind Map, Process Flow, and Whiteboard.
 */

import { useCallback, useState } from 'react';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export type ContextMenuTarget =
  | { kind: 'node'; nodeId: string; nodeType?: string }
  | { kind: 'edge'; edgeId: string }
  | { kind: 'pane' };

export interface ContextMenuState {
  open: boolean;
  position: ContextMenuPosition;
  target: ContextMenuTarget | null;
}

export interface ContextMenuAction {
  id: string;
  label: string;
  labelPl?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  dividerBefore?: boolean;
  onClick: () => void;
}

const INITIAL_STATE: ContextMenuState = {
  open: false,
  position: { x: 0, y: 0 },
  target: null,
};

export function useCanvasContextMenu() {
  const [menuState, setMenuState] = useState<ContextMenuState>(INITIAL_STATE);

  const openNodeMenu = useCallback(
    (event: React.MouseEvent, nodeId: string, nodeType?: string) => {
      event.preventDefault();
      event.stopPropagation();
      setMenuState({
        open: true,
        position: { x: event.clientX, y: event.clientY },
        target: { kind: 'node', nodeId, nodeType },
      });
    },
    []
  );

  const openEdgeMenu = useCallback((event: React.MouseEvent, edgeId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuState({
      open: true,
      position: { x: event.clientX, y: event.clientY },
      target: { kind: 'edge', edgeId },
    });
  }, []);

  const openPaneMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuState({
      open: true,
      position: { x: event.clientX, y: event.clientY },
      target: { kind: 'pane' },
    });
  }, []);

  const closeMenu = useCallback(() => {
    setMenuState(INITIAL_STATE);
  }, []);

  return {
    menuState,
    openNodeMenu,
    openEdgeMenu,
    openPaneMenu,
    closeMenu,
  };
}

/**
 * Build common context menu actions shared across all canvas tools.
 * Tool-specific actions should be appended by each tool.
 */
export function getCommonContextMenuActions(options: {
  isPolish: boolean;
  locked: boolean;
  target: ContextMenuTarget | null;
  onAddChild?: () => void;
  onAddSibling?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
}): ContextMenuAction[] {
  const { isPolish, locked, target, onAddChild, onAddSibling, onEdit, onDuplicate, onDelete, onCopy, onPaste } = options;
  const actions: ContextMenuAction[] = [];

  if (target?.kind === 'node') {
    if (onEdit) {
      actions.push({
        id: 'edit',
        label: 'Edit',
        labelPl: 'Edytuj',
        shortcut: 'F2',
        onClick: onEdit,
      });
    }

    if (onAddChild) {
      actions.push({
        id: 'add-child',
        label: 'Add Child',
        labelPl: 'Dodaj gałąź',
        shortcut: 'Tab',
        disabled: locked,
        onClick: onAddChild,
      });
    }

    if (onAddSibling) {
      actions.push({
        id: 'add-sibling',
        label: 'Add Sibling',
        labelPl: 'Dodaj sąsiedni',
        shortcut: 'Enter',
        disabled: locked,
        onClick: onAddSibling,
      });
    }

    if (onCopy) {
      actions.push({
        id: 'copy',
        label: 'Copy',
        labelPl: 'Kopiuj',
        shortcut: '⌘C',
        dividerBefore: true,
        onClick: onCopy,
      });
    }

    if (onDuplicate) {
      actions.push({
        id: 'duplicate',
        label: 'Duplicate',
        labelPl: 'Duplikuj',
        shortcut: '⌘D',
        disabled: locked,
        onClick: onDuplicate,
      });
    }

    if (onDelete) {
      actions.push({
        id: 'delete',
        label: 'Delete',
        labelPl: 'Usuń',
        shortcut: 'Del',
        disabled: locked,
        danger: true,
        dividerBefore: true,
        onClick: onDelete,
      });
    }
  }

  if (target?.kind === 'pane') {
    if (onPaste) {
      actions.push({
        id: 'paste',
        label: 'Paste',
        labelPl: 'Wklej',
        shortcut: '⌘V',
        disabled: locked,
        onClick: onPaste,
      });
    }

    if (onAddChild) {
      actions.push({
        id: 'add-node',
        label: 'Add Node',
        labelPl: 'Dodaj węzeł',
        disabled: locked,
        onClick: onAddChild,
      });
    }
  }

  return actions;
}
