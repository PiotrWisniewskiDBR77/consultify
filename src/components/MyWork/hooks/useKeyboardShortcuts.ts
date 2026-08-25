/**
 * useKeyboardShortcuts
 * Keyboard shortcuts hook for MyWork module
 * Provides power-user keyboard navigation and actions
 */

import i18n from '../../../i18n';
import { useCallback, useEffect, useState } from 'react';

export interface KeyboardShortcutsConfig {
  // Navigation
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onNavigateFirst?: () => void;
  onNavigateLast?: () => void;

  // Actions
  onNew?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  onOpen?: () => void;

  // Canvas-specific
  onAddChild?: () => void;
  onAddSibling?: () => void;
  onGroup?: () => void;
  onAIExpand?: () => void;
  onSlashCommand?: () => void;
  onToggleCollapse?: () => void;
  onFocusSelection?: () => void;
  onReparentPromote?: () => void;
  onReparentDemote?: () => void;

  // Status changes
  onSetPriority?: (priority: 'low' | 'medium' | 'high' | 'critical') => void;
  onToggleComplete?: () => void;

  // Selection
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onToggleSelection?: () => void;

  // Search
  onSearch?: () => void;

  // Enabled state
  enabled?: boolean;
}

export interface ShortcutHelp {
  key: string;
  description: string;
  category: 'navigation' | 'actions' | 'status' | 'selection';
}

export const SHORTCUTS_HELP: ShortcutHelp[] = [
  // Navigation
  {
    key: '↑ / k',
    description: i18n.t('myWork.shortcuts.moveUp', 'Move selection up'),
    category: 'navigation',
  },
  {
    key: '↓ / j',
    description: i18n.t('myWork.shortcuts.moveDown', 'Move selection down'),
    category: 'navigation',
  },
  {
    key: 'Home',
    description: i18n.t('myWork.shortcuts.goFirst', 'Go to first item'),
    category: 'navigation',
  },
  {
    key: 'End',
    description: i18n.t('myWork.shortcuts.goLast', 'Go to last item'),
    category: 'navigation',
  },
  {
    key: 'Enter',
    description: i18n.t('myWork.shortcuts.openSelected', 'Open selected item'),
    category: 'navigation',
  },
  {
    key: 'Escape',
    description: i18n.t('myWork.shortcuts.closeCancel', 'Close / Cancel'),
    category: 'navigation',
  },

  // Actions
  {
    key: 'n',
    description: i18n.t('myWork.shortcuts.newTaskDecision', 'New task/decision'),
    category: 'actions',
  },
  {
    key: 'e',
    description: i18n.t('myWork.shortcuts.editSelected', 'Edit selected'),
    category: 'actions',
  },
  {
    key: 'd',
    description: i18n.t('myWork.shortcuts.duplicateSelected', 'Duplicate selected'),
    category: 'actions',
  },
  {
    key: 'Delete',
    description: i18n.t('myWork.shortcuts.deleteSelected', 'Delete selected'),
    category: 'actions',
  },
  {
    key: 'Ctrl+S',
    description: i18n.t('myWork.shortcuts.saveChanges', 'Save changes'),
    category: 'actions',
  },
  {
    key: '/',
    description: i18n.t('myWork.shortcuts.focusSearch', 'Focus search'),
    category: 'actions',
  },

  // Status
  {
    key: '1',
    description: i18n.t('myWork.shortcuts.priorityLow', 'Set priority: Low'),
    category: 'status',
  },
  {
    key: '2',
    description: i18n.t('myWork.shortcuts.priorityMedium', 'Set priority: Medium'),
    category: 'status',
  },
  {
    key: '3',
    description: i18n.t('myWork.shortcuts.priorityHigh', 'Set priority: High'),
    category: 'status',
  },
  {
    key: '4',
    description: i18n.t('myWork.shortcuts.priorityCritical', 'Set priority: Critical'),
    category: 'status',
  },
  {
    key: 'x',
    description: i18n.t('myWork.shortcuts.toggleComplete', 'Toggle complete'),
    category: 'status',
  },

  // Canvas
  {
    key: 'Ctrl+G',
    description: i18n.t('myWork.shortcuts.groupNodes', 'Group selected nodes'),
    category: 'actions',
  },
  {
    key: 'Ctrl+Shift+A',
    description: i18n.t('myWork.shortcuts.aiExpandSelected', 'AI expand selected'),
    category: 'actions',
  },
  {
    key: 'Tab',
    description: i18n.t('myWork.shortcuts.addChildNode', 'Add child node'),
    category: 'actions',
  },
  {
    key: 'Shift+Enter',
    description: i18n.t('myWork.shortcuts.addSiblingNode', 'Add sibling node'),
    category: 'actions',
  },
  {
    key: 'Space',
    description: i18n.t(
      'myWork.shortcuts.toggleCollapseExpand',
      'Toggle collapse/expand (mindmap)'
    ),
    category: 'actions',
  },
  {
    key: 'f',
    description: i18n.t('myWork.shortcuts.focusSelectedNode', 'Focus selected node'),
    category: 'actions',
  },
  {
    key: 'Alt+Shift+←',
    description: i18n.t('myWork.shortcuts.promoteNode', 'Promote node one level'),
    category: 'actions',
  },
  {
    key: 'Alt+Shift+→',
    description: i18n.t('myWork.shortcuts.demoteNode', 'Demote node under previous sibling'),
    category: 'actions',
  },

  // Selection
  {
    key: 'Ctrl+A',
    description: i18n.t('myWork.shortcuts.selectAll', 'Select all'),
    category: 'selection',
  },
  {
    key: 'Ctrl+D',
    description: i18n.t('myWork.shortcuts.clearSelection', 'Clear selection'),
    category: 'selection',
  },
];

export function buildShortcutHelp(config: KeyboardShortcutsConfig): ShortcutHelp[] {
  const shortcuts: ShortcutHelp[] = [
    {
      key: '?',
      description: i18n.t('myWork.shortcuts.showHideHelp', 'Show / hide keyboard help'),
      category: 'navigation',
    },
  ];

  if (config.onNavigateUp) shortcuts.push(SHORTCUTS_HELP[0]);
  if (config.onNavigateDown) shortcuts.push(SHORTCUTS_HELP[1]);
  if (config.onNavigateFirst) shortcuts.push(SHORTCUTS_HELP[2]);
  if (config.onNavigateLast) shortcuts.push(SHORTCUTS_HELP[3]);
  if (config.onOpen) shortcuts.push(SHORTCUTS_HELP[4]);
  if (config.onCancel) shortcuts.push(SHORTCUTS_HELP[5]);
  if (config.onNew) shortcuts.push(SHORTCUTS_HELP[6]);
  if (config.onEdit) shortcuts.push(SHORTCUTS_HELP[7]);
  if (config.onDuplicate) shortcuts.push(SHORTCUTS_HELP[8]);
  if (config.onDelete) shortcuts.push(SHORTCUTS_HELP[9]);
  if (config.onSave) shortcuts.push(SHORTCUTS_HELP[10]);
  if (config.onSlashCommand || config.onSearch) shortcuts.push(SHORTCUTS_HELP[11]);
  if (config.onSetPriority) shortcuts.push(...SHORTCUTS_HELP.slice(12, 16));
  if (config.onToggleComplete) shortcuts.push(SHORTCUTS_HELP[16]);
  if (config.onGroup) shortcuts.push(SHORTCUTS_HELP[17]);
  if (config.onAIExpand) shortcuts.push(SHORTCUTS_HELP[18]);
  if (config.onAddChild) shortcuts.push(SHORTCUTS_HELP[19]);
  if (config.onAddSibling) shortcuts.push(SHORTCUTS_HELP[20]);
  if (config.onToggleCollapse || config.onToggleSelection) shortcuts.push(SHORTCUTS_HELP[21]);
  if (config.onFocusSelection) shortcuts.push(SHORTCUTS_HELP[22]);
  if (config.onReparentPromote) shortcuts.push(SHORTCUTS_HELP[23]);
  if (config.onReparentDemote) shortcuts.push(SHORTCUTS_HELP[24]);
  if (config.onSelectAll) shortcuts.push(SHORTCUTS_HELP[25]);
  if (config.onClearSelection) shortcuts.push(SHORTCUTS_HELP[26]);

  return shortcuts;
}

export const useKeyboardShortcuts = (config: KeyboardShortcutsConfig) => {
  const [showHelp, setShowHelp] = useState(false);

  const {
    onNavigateUp,
    onNavigateDown,
    onNavigateFirst,
    onNavigateLast,
    onNew,
    onEdit,
    onDelete,
    onDuplicate,
    onSave,
    onCancel,
    onOpen,
    onAddChild,
    onAddSibling,
    onSetPriority,
    onToggleComplete,
    onSelectAll,
    onClearSelection,
    onToggleSelection,
    onGroup,
    onAIExpand,
    onSlashCommand,
    onToggleCollapse,
    onFocusSelection,
    onReparentPromote,
    onReparentDemote,
    onSearch,
    enabled = true,
  } = config;
  const shortcuts = buildShortcutHelp(config);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      const isEditable = target.isContentEditable;

      if (isInput || isEditable) {
        // Only allow Escape and Ctrl+S in inputs
        if (event.key === 'Escape' && onCancel) {
          event.preventDefault();
          onCancel();
          return;
        }
        if (event.key === 's' && (event.ctrlKey || event.metaKey) && onSave) {
          event.preventDefault();
          onSave();
          return;
        }
        return;
      }

      // Show help with ?
      if (event.key === '?' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }

      // Navigation shortcuts
      if ((event.key === 'ArrowUp' || event.key === 'k') && onNavigateUp) {
        event.preventDefault();
        onNavigateUp();
        return;
      }

      if ((event.key === 'ArrowDown' || event.key === 'j') && onNavigateDown) {
        event.preventDefault();
        onNavigateDown();
        return;
      }

      if (event.key === 'Home' && onNavigateFirst) {
        event.preventDefault();
        onNavigateFirst();
        return;
      }

      if (event.key === 'End' && onNavigateLast) {
        event.preventDefault();
        onNavigateLast();
        return;
      }

      if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.shiftKey && onOpen) {
        event.preventDefault();
        onOpen();
        return;
      }

      if (event.key === 'Escape' && (onCancel || showHelp)) {
        event.preventDefault();
        onCancel?.();
        setShowHelp(false);
        return;
      }

      // Action shortcuts
      if (event.key === 'n' && !event.ctrlKey && !event.metaKey && onNew) {
        event.preventDefault();
        onNew();
        return;
      }

      if (event.key === 'e' && !event.ctrlKey && !event.metaKey && onEdit) {
        event.preventDefault();
        onEdit();
        return;
      }

      if (event.key === 'd' && !event.ctrlKey && !event.metaKey && onDuplicate) {
        event.preventDefault();
        onDuplicate();
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && onDelete) {
        event.preventDefault();
        onDelete();
        return;
      }

      if (event.key === 's' && (event.ctrlKey || event.metaKey) && onSave) {
        event.preventDefault();
        onSave();
        return;
      }

      if (event.key === 'Tab' && !event.shiftKey) {
        if (onAddChild) {
          event.preventDefault();
          onAddChild();
          return;
        }
      }

      if (event.key === 'Enter' && event.shiftKey) {
        if (onAddSibling) {
          event.preventDefault();
          onAddSibling();
          return;
        }
      }

      if (event.key === '/' && (onSlashCommand || onSearch)) {
        event.preventDefault();
        if (onSlashCommand) onSlashCommand();
        else onSearch?.();
        return;
      }

      // Canvas shortcuts
      if (event.key === 'g' && (event.ctrlKey || event.metaKey) && onGroup) {
        event.preventDefault();
        onGroup();
        return;
      }

      if (event.key === 'A' && (event.ctrlKey || event.metaKey) && event.shiftKey && onAIExpand) {
        event.preventDefault();
        onAIExpand();
        return;
      }

      if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (onFocusSelection) {
          event.preventDefault();
          onFocusSelection();
          return;
        }
      }

      if (event.altKey && event.shiftKey && event.key === 'ArrowLeft') {
        if (onReparentPromote) {
          event.preventDefault();
          onReparentPromote();
          return;
        }
      }

      if (event.altKey && event.shiftKey && event.key === 'ArrowRight') {
        if (onReparentDemote) {
          event.preventDefault();
          onReparentDemote();
          return;
        }
      }

      // Priority shortcuts (1-4)
      if (event.key === '1' && !event.ctrlKey && !event.metaKey && onSetPriority) {
        event.preventDefault();
        onSetPriority('low');
        return;
      }

      if (event.key === '2' && !event.ctrlKey && !event.metaKey && onSetPriority) {
        event.preventDefault();
        onSetPriority('medium');
        return;
      }

      if (event.key === '3' && !event.ctrlKey && !event.metaKey && onSetPriority) {
        event.preventDefault();
        onSetPriority('high');
        return;
      }

      if (event.key === '4' && !event.ctrlKey && !event.metaKey && onSetPriority) {
        event.preventDefault();
        onSetPriority('critical');
        return;
      }

      if (event.key === 'x' && !event.ctrlKey && !event.metaKey && onToggleComplete) {
        event.preventDefault();
        onToggleComplete();
        return;
      }

      // Selection shortcuts
      if (event.key === 'a' && (event.ctrlKey || event.metaKey) && onSelectAll) {
        event.preventDefault();
        onSelectAll();
        return;
      }

      if (event.key === 'd' && (event.ctrlKey || event.metaKey) && onClearSelection) {
        event.preventDefault();
        onClearSelection();
        return;
      }

      if (event.key === ' ' && (onToggleCollapse || onToggleSelection)) {
        event.preventDefault();
        if (onToggleCollapse) onToggleCollapse();
        else onToggleSelection?.();
        return;
      }
    },
    [
      enabled,
      onNavigateUp,
      onNavigateDown,
      onNavigateFirst,
      onNavigateLast,
      onNew,
      onEdit,
      onDelete,
      onDuplicate,
      onSave,
      onCancel,
      onOpen,
      onAddChild,
      onAddSibling,
      onGroup,
      onAIExpand,
      onSlashCommand,
      onToggleCollapse,
      onFocusSelection,
      onReparentPromote,
      onReparentDemote,
      onSetPriority,
      onToggleComplete,
      onSelectAll,
      onClearSelection,
      onToggleSelection,
      onSearch,
    ]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    showHelp,
    setShowHelp,
    shortcuts,
  };
};

export default useKeyboardShortcuts;
