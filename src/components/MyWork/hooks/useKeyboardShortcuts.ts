/**
 * useKeyboardShortcuts
 * Keyboard shortcuts hook for MyWork module
 * Provides power-user keyboard navigation and actions
 */

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

interface ShortcutHelp {
  key: string;
  description: string;
  category: 'navigation' | 'actions' | 'status' | 'selection';
}

export const SHORTCUTS_HELP: ShortcutHelp[] = [
  // Navigation
  { key: '↑ / k', description: 'Move selection up', category: 'navigation' },
  { key: '↓ / j', description: 'Move selection down', category: 'navigation' },
  { key: 'Home', description: 'Go to first item', category: 'navigation' },
  { key: 'End', description: 'Go to last item', category: 'navigation' },
  { key: 'Enter', description: 'Open selected item', category: 'navigation' },
  { key: 'Escape', description: 'Close / Cancel', category: 'navigation' },
  
  // Actions
  { key: 'n', description: 'New task/decision', category: 'actions' },
  { key: 'e', description: 'Edit selected', category: 'actions' },
  { key: 'd', description: 'Duplicate selected', category: 'actions' },
  { key: 'Delete', description: 'Delete selected', category: 'actions' },
  { key: 'Ctrl+S', description: 'Save changes', category: 'actions' },
  { key: '/', description: 'Focus search', category: 'actions' },
  
  // Status
  { key: '1', description: 'Set priority: Low', category: 'status' },
  { key: '2', description: 'Set priority: Medium', category: 'status' },
  { key: '3', description: 'Set priority: High', category: 'status' },
  { key: '4', description: 'Set priority: Critical', category: 'status' },
  { key: 'x', description: 'Toggle complete', category: 'status' },
  
  // Selection
  { key: 'Ctrl+A', description: 'Select all', category: 'selection' },
  { key: 'Space', description: 'Toggle selection', category: 'selection' },
  { key: 'Ctrl+D', description: 'Clear selection', category: 'selection' },
];

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
    onSetPriority,
    onToggleComplete,
    onSelectAll,
    onClearSelection,
    onToggleSelection,
    onSearch,
    enabled = true,
  } = config;

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
      if (event.key === 'ArrowUp' || event.key === 'k') {
        event.preventDefault();
        onNavigateUp?.();
        return;
      }
      
      if (event.key === 'ArrowDown' || event.key === 'j') {
        event.preventDefault();
        onNavigateDown?.();
        return;
      }
      
      if (event.key === 'Home') {
        event.preventDefault();
        onNavigateFirst?.();
        return;
      }
      
      if (event.key === 'End') {
        event.preventDefault();
        onNavigateLast?.();
        return;
      }
      
      if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        onOpen?.();
        return;
      }
      
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel?.();
        setShowHelp(false);
        return;
      }

      // Action shortcuts
      if (event.key === 'n' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        onNew?.();
        return;
      }
      
      if (event.key === 'e' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        onEdit?.();
        return;
      }
      
      if (event.key === 'd' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        onDuplicate?.();
        return;
      }
      
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        onDelete?.();
        return;
      }
      
      if (event.key === 's' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        onSave?.();
        return;
      }
      
      if (event.key === '/') {
        event.preventDefault();
        onSearch?.();
        return;
      }

      // Priority shortcuts (1-4)
      if (event.key === '1' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        onSetPriority?.('low');
        return;
      }
      
      if (event.key === '2' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        onSetPriority?.('medium');
        return;
      }
      
      if (event.key === '3' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        onSetPriority?.('high');
        return;
      }
      
      if (event.key === '4' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        onSetPriority?.('critical');
        return;
      }
      
      if (event.key === 'x' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        onToggleComplete?.();
        return;
      }

      // Selection shortcuts
      if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        onSelectAll?.();
        return;
      }
      
      if (event.key === 'd' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        onClearSelection?.();
        return;
      }
      
      if (event.key === ' ') {
        event.preventDefault();
        onToggleSelection?.();
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
    shortcuts: SHORTCUTS_HELP,
  };
};

export default useKeyboardShortcuts;
